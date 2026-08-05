"use client";

import { supabase } from "@/lib/supabase";
import {
  getPendingOfflinePurchases,
  isPurchaseBrowserOnline,
  markOfflinePurchaseError,
  markOfflinePurchaseSynced,
  markOfflinePurchaseSyncing,
  type OfflinePendingPurchase,
  type OfflinePurchaseItem,
} from "@/lib/ncs-purchase-offline";

type PurchaseResult = {
  success?: boolean;
  purchase_id?: string | number | null;
  purchase_number?: string | null;
  supplier_id?: number | null;
  previous_supplier_balance?: number | string | null;
  current_purchase_due?: number | string | null;
  closing_supplier_balance?: number | string | null;
  taxable_amount?: number | string | null;
  cgst_amount?: number | string | null;
  sgst_amount?: number | string | null;
  igst_amount?: number | string | null;
  cess_amount?: number | string | null;
  tax_amount?: number | string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  payment_status?: string | null;
  message?: string | null;
};

export type OfflinePurchaseSyncItemResult = {
  localPurchaseId: string;
  clientTransactionId: string;
  offlinePurchaseNumber: string;
  cloudPurchaseId: string | null;
  cloudPurchaseNumber: string | null;
  success: boolean;
  error: string | null;
};

export type OfflinePurchaseSyncSummary = {
  startedAt: string;
  finishedAt: string;
  total: number;
  synced: number;
  failed: number;
  items: OfflinePurchaseSyncItemResult[];
};

type SyncCallbacks = {
  onStart?: (pendingCount: number) => void;
  onProgress?: (
    completed: number,
    total: number,
    result: OfflinePurchaseSyncItemResult,
  ) => void;
  onComplete?: (
    summary: OfflinePurchaseSyncSummary,
  ) => void;
};

let activeSyncPromise:
  | Promise<OfflinePurchaseSyncSummary>
  | null = null;

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message || "Unknown purchase sync error.";
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(
      (error as { message?: unknown }).message ||
        "Unknown purchase sync error.",
    );
  }

  return String(
    error || "Unknown purchase sync error.",
  );
}

function createIndividualBarcode(
  rowId: string,
  index: number,
) {
  const now = new Date();

  const datePart = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const timePart = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  const rowPart = rowId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-4)
    .toUpperCase();

  return `NCSI${datePart}${timePart}${rowPart}${String(
    index + 1,
  ).padStart(3, "0")}`;
}

function buildRpcItems(
  purchase: OfflinePendingPurchase,
) {
  return purchase.items.flatMap(
    (item: OfflinePurchaseItem) => {
      const quantity = Math.max(
        1,
        Math.floor(item.quantity),
      );

      const commonItem = {
        product_name: item.productName.trim(),
        design_code: item.designCode.trim(),
        category: item.category.trim(),
        subcategory:
          item.subcategory.trim() || null,
        brand:
          item.brand.trim() || "NEW CITY STYLE",
        size: item.size.trim() || null,
        color: item.color.trim() || null,
        purchase_price: Math.max(
          0,
          item.purchasePrice -
            item.purchaseDiscount,
        ),
        mrp: Math.max(0, item.mrp),
        tax_percent:
          purchase.taxType === "non_gst"
            ? 0
            : Math.max(0, item.taxPercent),
        cess_percent:
          purchase.taxType === "non_gst"
            ? 0
            : Math.max(0, item.cessPercent),
        sell_online: item.sellOnline,
        online_selling_price:
          item.sellOnline
            ? Math.max(
                0,
                item.onlineSellingPrice,
              )
            : 0,
      };

      if (item.barcodeMode === "individual") {
        return Array.from(
          { length: quantity },
          (_, index) => {
            const uniqueBarcode =
              createIndividualBarcode(
                item.rowId,
                index,
              );

            return {
              ...commonItem,
              product_id: null,
              variant_id: null,
              sku: `${uniqueBarcode}-SKU`,
              barcode: uniqueBarcode,
              quantity: 1,
              online_quantity:
                item.sellOnline &&
                index < item.onlineQuantity
                  ? 1
                  : 0,
            };
          },
        );
      }

      return [
        {
          ...commonItem,
          product_id: item.productId,
          variant_id: item.variantId,
          sku: item.sku.trim() || null,
          barcode:
            item.barcode.trim() || null,
          quantity,
          online_quantity:
            item.sellOnline
              ? Math.min(
                  Math.max(
                    0,
                    Math.floor(
                      item.onlineQuantity,
                    ),
                  ),
                  quantity,
                )
              : 0,
        },
      ];
    },
  );
}

async function syncOnePurchase(
  purchase: OfflinePendingPurchase,
): Promise<OfflinePurchaseSyncItemResult> {
  await markOfflinePurchaseSyncing(
    purchase.id,
  );

  try {
    const rpcItems =
      buildRpcItems(purchase);

    const rpcPayments =
      purchase.payments
        .filter(
          (payment) => payment.amount > 0,
        )
        .map((payment) => ({
          method: payment.method,
          amount: payment.amount,
          reference:
            payment.reference.trim() || null,
        }));

    const { data, error } =
      await supabase.rpc(
        "ncs_complete_purchase_v2",
        {
          p_items: rpcItems,
          p_supplier_id:
            purchase.selectedSupplierId,
          p_supplier_name:
            purchase.supplierName.trim(),
          p_supplier_phone:
            purchase.supplierPhone.trim() ||
            null,
          p_supplier_gstin:
            purchase.supplierGstin.trim() ||
            null,
          p_supplier_state:
            purchase.supplierState.trim() ||
            null,
          p_supplier_state_code:
            purchase.supplierStateCode.trim() ||
            null,
          p_place_of_supply:
            purchase.placeOfSupply.trim() ||
            null,
          p_tax_type: purchase.taxType,
          p_supplier_invoice_number:
            purchase.supplierInvoiceNumber.trim() ||
            null,
          p_purchase_date:
            purchase.purchaseDate,
          p_due_date:
            purchase.dueDate || null,
          p_discount_amount:
            purchase.discountAmount,
          p_transport_charge:
            purchase.transportCharge,
          p_other_charge:
            purchase.otherCharge,
          p_payments: rpcPayments,
          p_notes: [
            purchase.notes.trim(),
            `Offline purchase ${purchase.offlinePurchaseNumber}`,
            `Client transaction ${purchase.clientTransactionId}`,
          ]
            .filter(Boolean)
            .join(" • "),
        },
      );

    if (error) {
      throw error;
    }

    const result =
      (data || {}) as PurchaseResult;

    if (result.success === false) {
      throw new Error(
        result.message ||
          "Unable to sync offline purchase.",
      );
    }

    const cloudPurchaseId =
      result.purchase_id === null ||
      result.purchase_id === undefined
        ? null
        : String(result.purchase_id);

    const cloudPurchaseNumber =
      result.purchase_number?.trim() ||
      purchase.offlinePurchaseNumber;

    await markOfflinePurchaseSynced(
      purchase.id,
      cloudPurchaseId,
      cloudPurchaseNumber,
    );

    return {
      localPurchaseId: purchase.id,
      clientTransactionId:
        purchase.clientTransactionId,
      offlinePurchaseNumber:
        purchase.offlinePurchaseNumber,
      cloudPurchaseId,
      cloudPurchaseNumber,
      success: true,
      error: null,
    };
  } catch (error) {
    const message =
      safeErrorMessage(error);

    await markOfflinePurchaseError(
      purchase.id,
      message,
    );

    return {
      localPurchaseId: purchase.id,
      clientTransactionId:
        purchase.clientTransactionId,
      offlinePurchaseNumber:
        purchase.offlinePurchaseNumber,
      cloudPurchaseId: null,
      cloudPurchaseNumber: null,
      success: false,
      error: message,
    };
  }
}

async function runSync(
  callbacks: SyncCallbacks = {},
): Promise<OfflinePurchaseSyncSummary> {
  const startedAt =
    new Date().toISOString();

  if (!isPurchaseBrowserOnline()) {
    return {
      startedAt,
      finishedAt:
        new Date().toISOString(),
      total: 0,
      synced: 0,
      failed: 0,
      items: [],
    };
  }

  const pendingPurchases =
    await getPendingOfflinePurchases();

  callbacks.onStart?.(
    pendingPurchases.length,
  );

  const results: OfflinePurchaseSyncItemResult[] =
    [];

  for (
    let index = 0;
    index < pendingPurchases.length;
    index += 1
  ) {
    if (!isPurchaseBrowserOnline()) {
      break;
    }

    const result =
      await syncOnePurchase(
        pendingPurchases[index],
      );

    results.push(result);

    callbacks.onProgress?.(
      results.length,
      pendingPurchases.length,
      result,
    );
  }

  const summary: OfflinePurchaseSyncSummary = {
    startedAt,
    finishedAt:
      new Date().toISOString(),
    total: pendingPurchases.length,
    synced: results.filter(
      (item) => item.success,
    ).length,
    failed: results.filter(
      (item) => !item.success,
    ).length,
    items: results,
  };

  callbacks.onComplete?.(summary);

  return summary;
}

export function syncPendingOfflinePurchases(
  callbacks: SyncCallbacks = {},
) {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = runSync(
    callbacks,
  ).finally(() => {
    activeSyncPromise = null;
  });

  return activeSyncPromise;
}

export function installOfflinePurchaseAutoSync(
  callbacks: SyncCallbacks = {},
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  let stopped = false;

  const triggerSync = () => {
    if (
      stopped ||
      !isPurchaseBrowserOnline()
    ) {
      return;
    }

    void syncPendingOfflinePurchases(
      callbacks,
    );
  };

  window.addEventListener(
    "online",
    triggerSync,
  );

  const intervalId =
    window.setInterval(
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

    window.clearInterval(
      intervalId,
    );
  };
}