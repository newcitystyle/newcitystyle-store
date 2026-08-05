"use client";

import { supabase } from "@/lib/supabase";
import {
  getPendingOfflineSales,
  isBrowserOnline,
  markOfflineSaleError,
  markOfflineSaleSynced,
  markOfflineSaleSyncing,
  markOfflineWhatsAppError,
  markOfflineWhatsAppSent,
  type OfflinePendingSale,
  type OfflineSaleItem,
} from "@/lib/ncs-pos-offline";

type CompleteSaleResult = {
  success?: boolean;
  duplicate?: boolean;
  sale_id?: string | number | null;
  invoice_number?: string | null;
  subtotal?: number | string | null;
  tax_amount?: number | string | null;
  bill_discount?: number | string | null;
  round_off?: number | string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  payment_method?: string | null;
  message?: string | null;
};

export type OfflineSaleSyncItemResult = {
  localSaleId: string;
  clientTransactionId: string;
  offlineInvoiceNumber: string;
  cloudSaleId: string | null;
  cloudInvoiceNumber: string | null;
  success: boolean;
  duplicate: boolean;
  whatsappSent: boolean;
  error: string | null;
};

export type OfflineSaleSyncSummary = {
  startedAt: string;
  finishedAt: string;
  total: number;
  synced: number;
  failed: number;
  whatsappSent: number;
  whatsappFailed: number;
  items: OfflineSaleSyncItemResult[];
};

type SyncCallbacks = {
  onStart?: (pendingCount: number) => void;
  onProgress?: (
    completed: number,
    total: number,
    result: OfflineSaleSyncItemResult,
  ) => void;
  onComplete?: (summary: OfflineSaleSyncSummary) => void;
};

let activeSyncPromise:
  | Promise<OfflineSaleSyncSummary>
  | null = null;

function toNumber(
  value: number | string | null | undefined,
  fallback = 0,
) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message || "Unknown sync error.";
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(
      (error as { message?: unknown }).message ||
        "Unknown sync error.",
    );
  }

  return String(error || "Unknown sync error.");
}

function normalizePhone(rawPhone: string) {
  const digits = rawPhone.replace(/\D/g, "");

  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
}

function createQuickSku() {
  return `OFF-QUICK-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

async function prepareQuickItem(
  item: OfflineSaleItem,
): Promise<{
  productId: number;
  variantId: number | null;
}> {
  const sku = createQuickSku();

  const soldQuantity = Math.max(
    1,
    Math.trunc(toNumber(item.quantity, 1)),
  );
  const remainingQuantity = Math.max(
    0,
    Math.trunc(
      toNumber(item.quickRemainingStock, 0),
    ),
  );
  const totalStock = soldQuantity + remainingQuantity;

  const { data: productData, error: productError } =
    await supabase
      .from("products")
      .insert({
        name: item.name.trim() || "Quick Item",
        category: item.category.trim() || "Others",
        subcategory:
          item.subcategory.trim() || null,
        brand: item.brand.trim() || "NEW CITY STYLE",
        price: Math.max(0, toNumber(item.price)),
        mrp: Math.max(
          toNumber(item.mrp),
          toNumber(item.price),
        ),
        stock: totalStock,
        sku,
        barcode: null,
        tax_percent: Math.max(
          0,
          toNumber(item.taxPercent),
        ),
        is_active:
          item.quickSaveAsProduct === true,
        status:
          item.quickSaveAsProduct === true
            ? "active"
            : "inactive",
      })
      .select("id")
      .single();

  if (productError) {
    throw new Error(
      `Unable to sync quick item "${item.name}": ${productError.message}`,
    );
  }

  const productId = Number(productData.id);

  const { data: variantData, error: variantError } =
    await supabase
      .from("product_variants")
      .insert({
        product_id: productId,
        variant_name: "Offline Quick Item",
        size: item.size.trim() || null,
        color: item.color.trim() || null,
        sku,
        barcode: null,
        purchase_price: Math.max(
          0,
          toNumber(item.quickPurchasePrice),
        ),
        selling_price: Math.max(
          0,
          toNumber(item.price),
        ),
        mrp: Math.max(
          toNumber(item.mrp),
          toNumber(item.price),
        ),
        stock: totalStock,
        reserved_stock: 0,
        low_stock_limit: 0,
        is_active: true,
      })
      .select("id")
      .single();

  if (variantError) {
    console.info(
      `Offline quick-item variant was not created for ${item.name}; product stock will be used.`,
      variantError.message,
    );

    return {
      productId,
      variantId: null,
    };
  }

  return {
    productId,
    variantId: Number(variantData.id),
  };
}

async function createRpcItems(
  sale: OfflinePendingSale,
) {
  const rpcItems: Array<{
    product_id: number;
    variant_id: number | null;
    quantity: number;
  }> = [];

  for (const item of sale.items) {
    const quantity = Math.max(
      1,
      Math.trunc(toNumber(item.quantity, 1)),
    );

    if (item.isQuickItem) {
      const quickProduct =
        await prepareQuickItem(item);

      rpcItems.push({
        product_id: quickProduct.productId,
        variant_id: quickProduct.variantId,
        quantity,
      });

      continue;
    }

    if (!Number.isFinite(item.productId) || item.productId <= 0) {
      throw new Error(
        `Invalid product ID for "${item.name}".`,
      );
    }

    rpcItems.push({
      product_id: item.productId,
      variant_id:
        item.variantId &&
        Number.isFinite(item.variantId)
          ? item.variantId
          : null,
      quantity,
    });
  }

  return rpcItems;
}

async function applyRewardsAfterSync(
  sale: OfflinePendingSale,
  cloudSaleId: string | null,
  invoiceNumber: string,
) {
  const phone = sale.customerPhone.trim();

  if (!phone) {
    return;
  }

  const eligibleAmount =
    sale.paymentMethod === "credit"
      ? Math.max(0, sale.paidAmount)
      : Math.max(0, sale.finalPayable);

  const { error } = await supabase.rpc(
    "ncs_apply_sale_rewards_by_phone",
    {
      p_customer_phone: phone,
      p_sale_id: cloudSaleId,
      p_invoice_number: invoiceNumber,
      p_redeem_points: Math.max(
        0,
        Math.trunc(sale.rewardPointsUsed),
      ),
      p_eligible_amount: eligibleAmount,
    },
  );

  if (error) {
    console.info(
      `Offline sale ${invoiceNumber} synced, but rewards could not be updated:`,
      error.message,
    );
  }
}

async function sendOfflineInvoiceWhatsApp(
  sale: OfflinePendingSale,
  invoiceNumber: string,
  cloudResult: CompleteSaleResult,
) {
  const recipientPhone = normalizePhone(
    sale.customerPhone,
  );

  if (
    recipientPhone.length < 10 ||
    recipientPhone.length > 15
  ) {
    throw new Error(
      "A valid customer mobile number is required for WhatsApp invoice.",
    );
  }

  const response = await fetch(
    "/api/whatsapp/invoice-pdf",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: recipientPhone,
        sendWhatsApp: true,
        customerName:
          sale.customerName.trim() ||
          "Walk-in Customer",
        customerPhone: sale.customerPhone,
        billNumber: invoiceNumber,
        billDate: new Date(
          sale.createdAt,
        ).toLocaleString("en-IN"),
        paymentMethod:
          sale.paymentMethod.toUpperCase(),
        subtotal: toNumber(
          cloudResult.subtotal,
          sale.subtotal,
        ),
        discountAmount: toNumber(
          cloudResult.bill_discount,
          sale.billDiscountAmount +
            sale.rewardDiscountAmount,
        ),
        taxAmount: toNumber(
          cloudResult.tax_amount,
          sale.taxAmount,
        ),
        roundOff: toNumber(
          cloudResult.round_off,
          sale.roundOffAmount,
        ),
        billAmount: toNumber(
          cloudResult.total_amount,
          sale.finalPayable,
        ),
        paidAmount: toNumber(
          cloudResult.paid_amount,
          sale.paidAmount,
        ),
        dueAmount: toNumber(
          cloudResult.due_amount,
          sale.dueAmount,
        ),
        items: sale.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          mrp: item.mrp,
          price: item.price,
          discountPercent: Math.max(
            0,
            item.discountPercent || 0,
          ),
          total: item.price * item.quantity,
          size: item.size,
          color: item.color,
          barcode: item.barcode,
        })),
      }),
    },
  );

  const result = (await response.json()) as {
    success?: boolean;
    whatsappPdfSent?: boolean;
    error?: string;
    stage?: string;
    errorDetails?: string | null;
  };

  if (
    !response.ok ||
    result.success !== true ||
    result.whatsappPdfSent !== true
  ) {
    const stageText = result.stage
      ? ` (${result.stage})`
      : "";
    const detailsText = result.errorDetails
      ? ` - ${result.errorDetails}`
      : "";

    throw new Error(
      `${
        result.error ||
        "WhatsApp invoice could not be sent."
      }${stageText}${detailsText}`,
    );
  }
}

async function syncOneOfflineSale(
  sale: OfflinePendingSale,
): Promise<OfflineSaleSyncItemResult> {
  await markOfflineSaleSyncing(sale.id);

  try {
    const rpcItems =
      await createRpcItems(sale);

    const { data, error } = await supabase.rpc(
      "complete_pos_sale",
      {
        p_items: rpcItems,
        p_customer_name:
          sale.customerName.trim() || null,
        p_customer_phone:
          sale.customerPhone.trim() || null,
        p_customer_email: null,
        p_payment_method: sale.paymentMethod,
        p_bill_discount:
          Math.max(
            0,
            sale.billDiscountAmount,
          ) +
          Math.max(
            0,
            sale.rewardDiscountAmount,
          ),
        p_round_off: Math.max(
          0,
          sale.roundOffAmount,
        ),
        p_notes: [
          `Offline bill ${sale.offlineInvoiceNumber}`,
          sale.items.some(
            (item) => item.isQuickItem,
          )
            ? `${
                sale.items.filter(
                  (item) => item.isQuickItem,
                ).length
              } quick item(s) included`
            : "",
        ]
          .filter(Boolean)
          .join(" • "),
        p_client_transaction_id:
          sale.clientTransactionId,
        p_device_id: "web-admin-pos-offline",
        p_is_offline: true,
      },
    );

    if (error) {
      throw error;
    }

    const result =
      (data || {}) as CompleteSaleResult;

    if (result.success === false) {
      throw new Error(
        result.message ||
          "Unable to sync offline sale.",
      );
    }

    const cloudSaleId =
      result.sale_id === null ||
      result.sale_id === undefined
        ? null
        : String(result.sale_id);

    const cloudInvoiceNumber =
      result.invoice_number?.trim() ||
      sale.offlineInvoiceNumber;

    await markOfflineSaleSynced(
      sale.id,
      cloudSaleId,
      cloudInvoiceNumber,
    );

    await applyRewardsAfterSync(
      sale,
      cloudSaleId,
      cloudInvoiceNumber,
    );

    let whatsappSent = false;

    if (
      sale.customerPhone.trim() &&
      sale.whatsappStatus !== "NOT_REQUIRED"
    ) {
      try {
        await sendOfflineInvoiceWhatsApp(
          sale,
          cloudInvoiceNumber,
          result,
        );

        await markOfflineWhatsAppSent(
          sale.id,
        );
        whatsappSent = true;
      } catch (whatsappError) {
        const whatsappMessage =
          safeErrorMessage(whatsappError);

        await markOfflineWhatsAppError(
          sale.id,
          whatsappMessage,
        );

        console.error(
          `Offline bill ${cloudInvoiceNumber} synced, but WhatsApp failed:`,
          whatsappError,
        );
      }
    }

    return {
      localSaleId: sale.id,
      clientTransactionId:
        sale.clientTransactionId,
      offlineInvoiceNumber:
        sale.offlineInvoiceNumber,
      cloudSaleId,
      cloudInvoiceNumber,
      success: true,
      duplicate:
        result.duplicate === true,
      whatsappSent,
      error: null,
    };
  } catch (error) {
    const message = safeErrorMessage(error);

    await markOfflineSaleError(
      sale.id,
      message,
    );

    return {
      localSaleId: sale.id,
      clientTransactionId:
        sale.clientTransactionId,
      offlineInvoiceNumber:
        sale.offlineInvoiceNumber,
      cloudSaleId: null,
      cloudInvoiceNumber: null,
      success: false,
      duplicate: false,
      whatsappSent: false,
      error: message,
    };
  }
}

async function runSync(
  callbacks: SyncCallbacks = {},
): Promise<OfflineSaleSyncSummary> {
  const startedAt = new Date().toISOString();

  if (!isBrowserOnline()) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      total: 0,
      synced: 0,
      failed: 0,
      whatsappSent: 0,
      whatsappFailed: 0,
      items: [],
    };
  }

  const pendingSales =
    await getPendingOfflineSales();

  callbacks.onStart?.(pendingSales.length);

  const results: OfflineSaleSyncItemResult[] = [];

  for (
    let index = 0;
    index < pendingSales.length;
    index += 1
  ) {
    if (!isBrowserOnline()) {
      break;
    }

    const result =
      await syncOneOfflineSale(
        pendingSales[index],
      );

    results.push(result);

    callbacks.onProgress?.(
      results.length,
      pendingSales.length,
      result,
    );
  }

  const summary: OfflineSaleSyncSummary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    total: pendingSales.length,
    synced: results.filter(
      (item) => item.success,
    ).length,
    failed: results.filter(
      (item) => !item.success,
    ).length,
    whatsappSent: results.filter(
      (item) => item.whatsappSent,
    ).length,
    whatsappFailed: results.filter(
      (item) =>
        item.success &&
        !item.whatsappSent &&
        pendingSales.find(
          (sale) =>
            sale.id === item.localSaleId,
        )?.customerPhone.trim(),
    ).length,
    items: results,
  };

  callbacks.onComplete?.(summary);

  return summary;
}

export function syncPendingOfflineSales(
  callbacks: SyncCallbacks = {},
) {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = runSync(callbacks).finally(
    () => {
      activeSyncPromise = null;
    },
  );

  return activeSyncPromise;
}

export function installOfflineAutoSync(
  callbacks: SyncCallbacks = {},
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  let stopped = false;

  const triggerSync = () => {
    if (
      stopped ||
      !isBrowserOnline()
    ) {
      return;
    }

    void syncPendingOfflineSales(
      callbacks,
    );
  };

  window.addEventListener(
    "online",
    triggerSync,
  );

  const intervalId = window.setInterval(
    triggerSync,
    60_000,
  );

  window.setTimeout(
    triggerSync,
    1_500,
  );

  return () => {
    stopped = true;

    window.removeEventListener(
      "online",
      triggerSync,
    );
    window.clearInterval(intervalId);
  };
}