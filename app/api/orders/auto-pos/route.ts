import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebOrderItem = {
  product_id?: number | string | null;
  variant_id?: number | string | null;
  design_unit_id?: number | string | null;
  name?: string | null;
  image?: string | null;
  price?: number | string | null;
  quantity?: number | string | null;
  size?: string | null;
  color?: string | null;
  barcode?: string | null;
  item_total?: number | string | null;
};

type SyncRequest = {
  orderId?: string | number;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  sendWhatsApp?: boolean;
};

type PosSaleRow = {
  id: string;
  invoice_number: string;
  client_transaction_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  subtotal?: number | string | null;
  item_discount?: number | string | null;
  bill_discount?: number | string | null;
  tax_amount?: number | string | null;
  round_off?: number | string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  reward_points_earned?: number | string | null;
  reward_points_redeemed?: number | string | null;
  notes?: string | null;
  is_deleted?: boolean | null;
  created_at?: string | null;
};

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function positiveInt(value: unknown, fallback = 1): number {
  const parsed = Math.trunc(num(value, fallback));
  return Math.max(1, parsed);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function serviceClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function loadSaleItems(
  supabase: ReturnType<typeof serviceClient>,
  saleId: string
) {
  const { data, error } = await supabase
    .from("pos_sale_items")
    .select(
      "product_id,variant_id,design_unit_id,product_name,product_image,sku,barcode,size,color,quantity,unit_cost,unit_price,mrp,discount_amount,tax_percent,tax_amount,line_total"
    )
    .eq("sale_id", saleId)
    .order("id", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function sendCanonicalWhatsAppInvoice({
  request,
  supabase,
  sale,
  saleItems,
}: {
  request: NextRequest;
  supabase: ReturnType<typeof serviceClient>;
  sale: PosSaleRow;
  saleItems: Array<Record<string, unknown>>;
}) {
  const alreadySent = clean(sale.notes).includes("V9_WA_SENT:");

  if (alreadySent) {
    return {
      sent: true,
      skipped: true,
      messageId: null as string | null,
      warning: null as string | null,
    };
  }

  const phone = clean(sale.customer_phone);
  if (!phone) {
    return {
      sent: false,
      skipped: true,
      messageId: null,
      warning: "Customer phone is missing; WhatsApp invoice was skipped.",
    };
  }

  let invoiceStudio: Record<string, unknown> | null = null;

  const { data: invoiceSettings, error: invoiceSettingsError } = await supabase
    .from("ncs_invoice_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle();

  if (!invoiceSettingsError && invoiceSettings) {
    invoiceStudio = invoiceSettings as Record<string, unknown>;
  }

  const invoicePayload = {
    to: phone,
    sendWhatsApp: true,
    customerName: clean(sale.customer_name) || "Customer",
    customerPhone: phone,
    saleId: sale.id,
    billNumber: sale.invoice_number,
    billDate: sale.created_at || new Date().toISOString(),
    paymentMethod: "UPI",
    subtotal: num(sale.subtotal),
    discountAmount:
      num(sale.item_discount) + num(sale.bill_discount),
    taxAmount: num(sale.tax_amount),
    roundOff: num(sale.round_off),
    billAmount: num(sale.total_amount),
    paidAmount: num(sale.paid_amount),
    dueAmount: num(sale.due_amount),
    rewardPointsUsed: num(sale.reward_points_redeemed),
    rewardDiscount: 0,
    rewardPointsEarned: num(sale.reward_points_earned),
    rewardClosingBalance: 0,
    whatsappLanguage: "telugu",
    items: saleItems.map((item) => ({
      name: clean(item.product_name) || "Product",
      quantity: positiveInt(item.quantity),
      mrp: num(item.mrp, num(item.unit_price)),
      price: num(item.unit_price),
      total: num(item.line_total),
      size: clean(item.size),
      color: clean(item.color),
      barcode: clean(item.barcode),
    })),
    invoiceStudio,
  };

  const invoiceUrl = new URL("/api/whatsapp/invoice-pdf", request.url);

  const response = await fetch(invoiceUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(invoicePayload),
    cache: "no-store",
  });

  let result: Record<string, unknown> = {};
  try {
    result = (await response.json()) as Record<string, unknown>;
  } catch {
    result = {};
  }

  if (!response.ok || result.success !== true) {
    const warning =
      clean(result.error) ||
      clean(result.message) ||
      "POS sale was created, but WhatsApp invoice could not be sent.";

    return {
      sent: false,
      skipped: false,
      messageId: null,
      warning,
    };
  }

  const messageId = clean(result.whatsappMessageId) || "sent";
  const marker = `V9_WA_SENT:${messageId}`;
  const nextNotes = [clean(sale.notes), marker].filter(Boolean).join(" • ");

  await supabase
    .from("pos_sales")
    .update({
      notes: nextNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sale.id);

  return {
    sent: true,
    skipped: false,
    messageId,
    warning: null,
  };
}

export async function POST(request: NextRequest) {
  try {
    let body: SyncRequest;

    try {
      body = (await request.json()) as SyncRequest;
    } catch {
      return NextResponse.json(
        { success: false, error: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const orderId = Number(body.orderId || 0);
    const razorpayPaymentId = clean(body.razorpayPaymentId);
    const razorpayOrderId = clean(body.razorpayOrderId);
    const shouldSendWhatsApp = body.sendWhatsApp !== false;

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json(
        { success: false, error: "A valid orderId is required." },
        { status: 400 }
      );
    }

    if (!razorpayPaymentId) {
      return NextResponse.json(
        {
          success: false,
          error: "razorpayPaymentId is required for a paid Auto POS sync.",
        },
        { status: 400 }
      );
    }

    const supabase = serviceClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw orderError;

    if (!order) {
      return NextResponse.json(
        { success: false, error: `Order #${orderId} was not found.` },
        { status: 404 }
      );
    }

    if (clean(order.payment_status).toLowerCase() !== "paid") {
      return NextResponse.json(
        {
          success: false,
          error: `Order #${orderId} is not marked Paid.`,
        },
        { status: 409 }
      );
    }

    if (clean(order.razorpay_payment_id) !== razorpayPaymentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Razorpay payment ID does not match this order.",
        },
        { status: 403 }
      );
    }

    if (
      razorpayOrderId &&
      clean(order.razorpay_order_id) &&
      clean(order.razorpay_order_id) !== razorpayOrderId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Razorpay order ID does not match this order.",
        },
        { status: 403 }
      );
    }

    const clientTransactionId = `WEB-ORDER-${orderId}`;

    const { data: existingSale, error: existingSaleError } = await supabase
      .from("pos_sales")
      .select("*")
      .eq("client_transaction_id", clientTransactionId)
      .maybeSingle();

    if (existingSaleError) throw existingSaleError;

    let sale = (existingSale || null) as PosSaleRow | null;
    let duplicate = Boolean(existingSale);

    if (sale?.is_deleted) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This web order already has a deleted Auto POS sale. Restore or reconcile it from admin instead of creating a duplicate.",
          invoiceNumber: sale.invoice_number,
        },
        { status: 409 }
      );
    }

    if (!sale) {
      const items = Array.isArray(order.items)
        ? (order.items as WebOrderItem[])
        : [];

      if (items.length === 0) {
        return NextResponse.json(
          { success: false, error: `Order #${orderId} has no items.` },
          { status: 409 }
        );
      }

      const productIds = Array.from(
        new Set(
          items
            .map((item) => Number(item.product_id || 0))
            .filter((id) => id > 0)
        )
      );

      if (productIds.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Order #${orderId} has no valid product IDs.`,
          },
          { status: 409 }
        );
      }

      const variantIds = Array.from(
        new Set(
          items
            .map((item) => Number(item.variant_id || 0))
            .filter((id) => id > 0)
        )
      );

      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id,name,image_url,image,price,mrp,tax_percent")
        .in("id", productIds);

      if (productsError) throw productsError;

      const productMap = new Map<number, Record<string, unknown>>();
      (products || []).forEach((row) => {
        productMap.set(Number(row.id), row as Record<string, unknown>);
      });

      const variantMap = new Map<number, Record<string, unknown>>();
      if (variantIds.length > 0) {
        const { data: variants, error: variantsError } = await supabase
          .from("product_variants")
          .select(
            "id,product_id,size,color,sku,barcode,purchase_price,selling_price,mrp,tax_percent"
          )
          .in("id", variantIds);

        if (variantsError) throw variantsError;

        (variants || []).forEach((row) => {
          variantMap.set(Number(row.id), row as Record<string, unknown>);
        });
      }

      const latestPurchaseCost = new Map<number, number>();
      const { data: purchaseRows, error: purchaseRowsError } = await supabase
        .from("purchase_items")
        .select("product_id,purchase_price,created_at")
        .in("product_id", productIds)
        .order("created_at", { ascending: false });

      if (!purchaseRowsError) {
        for (const row of purchaseRows || []) {
          const productId = Number(row.product_id || 0);
          if (productId > 0 && !latestPurchaseCost.has(productId)) {
            latestPurchaseCost.set(productId, Math.max(0, num(row.purchase_price)));
          }
        }
      }

      const preparedItems = items.map((item) => {
        const productId = Number(item.product_id || 0);
        const variantId = Number(item.variant_id || 0);
        const designUnitId = Number(item.design_unit_id || 0);
        const product = productMap.get(productId) || {};
        const variant = variantId > 0 ? variantMap.get(variantId) || {} : {};
        const quantity = positiveInt(item.quantity);
        const unitPrice = Math.max(0, num(item.price));
        const mrp = Math.max(
          unitPrice,
          num(variant.mrp, num(product.mrp, unitPrice))
        );
        const taxPercent = Math.max(
          0,
          num(variant.tax_percent, num(product.tax_percent))
        );
        const lineTotal = round2(unitPrice * quantity);
        const taxAmount = round2(
          taxPercent > 0
            ? (lineTotal * taxPercent) / (100 + taxPercent)
            : 0
        );
        const unitCost = Math.max(
          0,
          variantId > 0
            ? num(variant.purchase_price)
            : latestPurchaseCost.get(productId) || 0
        );

        return {
          product_id: productId,
          variant_id: variantId > 0 ? variantId : null,
          design_unit_id: designUnitId > 0 ? designUnitId : null,
          product_name:
            clean(item.name) || clean(product.name) || `Product ${productId}`,
          product_image:
            clean(item.image) || clean(product.image_url) || clean(product.image),
          sku: clean(variant.sku),
          barcode: clean(item.barcode) || clean(variant.barcode),
          size: clean(item.size) || clean(variant.size) || null,
          color: clean(item.color) || clean(variant.color) || null,
          quantity,
          unit_cost: round2(unitCost),
          unit_price: round2(unitPrice),
          mrp: round2(mrp),
          discount_amount: round2(Math.max(0, mrp - unitPrice) * quantity),
          tax_percent: round2(taxPercent),
          tax_amount: taxAmount,
          taxable_value: round2(lineTotal - taxAmount),
          line_total: lineTotal,
          returned_quantity: 0,
        };
      });

      const merchandiseSubtotal = round2(
        preparedItems.reduce((sum, item) => sum + item.line_total, 0)
      );
      const orderTotal = round2(Math.max(0, num(order.total_amount, merchandiseSubtotal)));
      const itemDiscount = round2(
        preparedItems.reduce((sum, item) => sum + item.discount_amount, 0)
      );
      const taxAmount = round2(
        preparedItems.reduce((sum, item) => sum + item.tax_amount, 0)
      );
      const taxableAmount = round2(
        preparedItems.reduce((sum, item) => sum + item.taxable_value, 0)
      );
      const billDiscount = round2(Math.max(0, merchandiseSubtotal - orderTotal));
      const createdAt = clean(order.created_at) || new Date().toISOString();
      const customerAddress = [
        clean(order.address),
        clean(order.city),
        clean(order.state),
        clean(order.pincode),
      ]
        .filter(Boolean)
        .join(", ");

      const { data: insertedSale, error: insertSaleError } = await supabase
        .from("pos_sales")
        .insert({
          client_transaction_id: clientTransactionId,
          customer_name: clean(order.customer_name) || "Customer",
          customer_phone: clean(order.phone) || null,
          customer_email: clean(order.email) || null,
          customer_address: customerAddress || null,
          sale_status: "completed",
          payment_status: "paid",
          payment_method: "upi",
          subtotal: merchandiseSubtotal,
          item_discount: itemDiscount,
          bill_discount: billDiscount,
          coupon_discount: 0,
          reward_discount: 0,
          tax_amount: taxAmount,
          taxable_amount: taxableAmount,
          round_off: 0,
          total_amount: orderTotal,
          paid_amount: orderTotal,
          due_amount: 0,
          reward_points_earned: 0,
          reward_points_redeemed: 0,
          notes: `V9 WEB AUTO POS • WEB ORDER #${orderId} • Razorpay Payment: ${razorpayPaymentId}`,
          is_offline: false,
          sync_status: "synced",
          synced_at: new Date().toISOString(),
          created_at: createdAt,
          is_deleted: false,
          stock_restored: false,
        })
        .select("*")
        .single();

      if (insertSaleError) {
        // A concurrent retry may have won after our initial lookup.
        const { data: concurrentSale, error: concurrentSaleError } = await supabase
          .from("pos_sales")
          .select("*")
          .eq("client_transaction_id", clientTransactionId)
          .maybeSingle();

        if (concurrentSaleError || !concurrentSale) {
          throw insertSaleError;
        }

        sale = concurrentSale as PosSaleRow;
        duplicate = true;
      } else {
        sale = insertedSale as PosSaleRow;

        const saleItemRows = preparedItems.map((item) => ({
          sale_id: sale!.id,
          ...item,
        }));

        const { error: itemInsertError } = await supabase
          .from("pos_sale_items")
          .insert(saleItemRows);

        if (itemInsertError) throw itemInsertError;

        const { error: paymentInsertError } = await supabase
          .from("pos_payments")
          .insert({
            sale_id: sale.id,
            payment_method: "upi",
            amount: orderTotal,
            payment_status: "completed",
            reference_number: razorpayPaymentId,
            provider_name: "Razorpay",
            notes: `V9 Auto POS • Web Order #${orderId}`,
            paid_at: createdAt,
          });

        if (paymentInsertError) throw paymentInsertError;

        const realisedRevenueFactor =
          merchandiseSubtotal > 0
            ? Math.max(0, Math.min(1, orderTotal / merchandiseSubtotal))
            : 0;

        const registeredRevenue = round2(
          preparedItems.reduce(
            (sum, item) => sum + item.line_total * realisedRevenueFactor,
            0
          )
        );
        const purchaseCost = round2(
          preparedItems.reduce(
            (sum, item) => sum + item.unit_cost * item.quantity,
            0
          )
        );
        const billProfit = round2(registeredRevenue - purchaseCost);
        const marginPercent =
          registeredRevenue > 0
            ? round2((billProfit / registeredRevenue) * 100)
            : 0;

        const { data: existingProfit } = await supabase
          .from("owner_profit_alerts")
          .select("id")
          .eq("alert_type", "BILL_PROFIT_SUMMARY")
          .eq("invoice_number", sale.invoice_number)
          .limit(1)
          .maybeSingle();

        if (!existingProfit?.id) {
          await supabase.from("owner_profit_alerts").insert({
            alert_type: "BILL_PROFIT_SUMMARY",
            source: "WEB_AUTO_POS",
            sale_id: sale.id,
            invoice_number: sale.invoice_number,
            customer_name: clean(order.customer_name) || "Customer",
            customer_phone: clean(order.phone) || null,
            product_id: null,
            variant_id: null,
            product_name: "Web Order Auto POS",
            sku: null,
            size: null,
            color: null,
            quantity: preparedItems.reduce((sum, item) => sum + item.quantity, 0),
            purchase_price: purchaseCost,
            actual_selling_price: registeredRevenue,
            profit_per_unit: billProfit,
            margin_percent: marginPercent,
            target_margin_percent: 15,
            bill_discount_percent:
              merchandiseSubtotal > 0
                ? round2((billDiscount / merchandiseSubtotal) * 100)
                : 0,
            final_bill_amount: orderTotal,
            registered_revenue: registeredRevenue,
            registered_purchase_cost: purchaseCost,
            bill_profit: billProfit,
            status: "NEW",
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    if (!sale) {
      throw new Error("Auto POS sale could not be resolved.");
    }

    const saleItems = await loadSaleItems(supabase, sale.id);

    let whatsapp = {
      sent: false,
      skipped: true,
      messageId: null as string | null,
      warning: null as string | null,
    };

    if (shouldSendWhatsApp) {
      whatsapp = await sendCanonicalWhatsAppInvoice({
        request,
        supabase,
        sale,
        saleItems,
      });
    }

    return NextResponse.json({
      success: true,
      duplicate,
      orderId,
      saleId: sale.id,
      invoiceNumber: sale.invoice_number,
      totalAmount: num(sale.total_amount),
      paymentMethod: "upi",
      stockChangedByAutoPos: false,
      whatsappSent: whatsapp.sent,
      whatsappSkipped: whatsapp.skipped,
      whatsappMessageId: whatsapp.messageId,
      warning: whatsapp.warning,
      message: duplicate
        ? "Web order was already linked to POS; safe sync completed."
        : "Paid web order converted to POS successfully.",
    });
  } catch (error) {
    console.error("V9 Auto POS error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to convert the paid web order to POS.",
      },
      { status: 500 }
    );
  }
}
