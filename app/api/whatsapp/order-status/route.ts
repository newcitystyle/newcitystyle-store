import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderStatusPayload = {
  orderId?: string | number;
  status?: string;
};

type OrderRow = {
  id: number;
  order_status?: string | null;
  status?: string | null;
  mobile?: string | null;
  phone?: string | null;
  full_name?: string | null;
  customer_name?: string | null;
  courier_name?: string | null;
  tracking_id?: string | null;
  expected_delivery_date?: string | null;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePhone(value: unknown): string {
  const digits = text(value).replace(/\D/g, "");

  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;

  return digits;
}

function normalizeStatus(value: unknown): string {
  switch (text(value).toLowerCase()) {
    case "confirmed":
      return "Confirmed";
    case "packed":
      return "Packed";
    case "shipped":
      return "Shipped";
    case "delivered":
      return "Delivered";
    case "cancelled":
    case "canceled":
      return "Cancelled";
    default:
      return "";
  }
}

function createServerSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase server credentials are missing."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function templateForStatus(status: string) {
  const generic =
    process.env.WHATSAPP_CUSTOMER_ORDER_STATUS_TEMPLATE_NAME?.trim();

  switch (status) {
    case "Confirmed":
      return (
        process.env.WHATSAPP_ORDER_CONFIRMED_TEMPLATE_NAME?.trim() ||
        generic
      );
    case "Packed":
      return (
        process.env.WHATSAPP_ORDER_PACKED_TEMPLATE_NAME?.trim() ||
        generic
      );
    case "Shipped":
      return (
        process.env.WHATSAPP_ORDER_SHIPPED_TEMPLATE_NAME?.trim() ||
        generic
      );
    case "Delivered":
      return (
        process.env.WHATSAPP_ORDER_DELIVERED_TEMPLATE_NAME?.trim() ||
        generic
      );
    case "Cancelled":
      return (
        process.env.WHATSAPP_ORDER_CANCELLED_TEMPLATE_NAME?.trim() ||
        generic
      );
    default:
      return generic;
  }
}

function buildDetail(row: OrderRow, status: string) {
  if (status === "Shipped") {
    const parts = [
      row.courier_name ? `Courier: ${row.courier_name}` : "",
      row.tracking_id ? `Tracking: ${row.tracking_id}` : "",
      row.expected_delivery_date
        ? `Expected delivery: ${row.expected_delivery_date}`
        : "",
    ].filter(Boolean);

    return parts.join(" • ") || "Your order has been shipped.";
  }

  if (status === "Confirmed") {
    return "Your order is confirmed and is being prepared.";
  }

  if (status === "Packed") {
    return "Your order is packed and ready for dispatch.";
  }

  if (status === "Delivered") {
    return "Your order has been delivered. Thank you for shopping with NEW CITY STYLE.";
  }

  if (status === "Cancelled") {
    return "Your order has been cancelled.";
  }

  return `Order status: ${status}`;
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret =
      process.env.NCS_ORDER_STATUS_WEBHOOK_SECRET?.trim();

    if (!webhookSecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "NCS_ORDER_STATUS_WEBHOOK_SECRET is not configured.",
        },
        { status: 500 }
      );
    }

    const providedSecret =
      request.headers.get("x-ncs-order-status-secret")?.trim();

    if (!providedSecret || providedSecret !== webhookSecret) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as OrderStatusPayload;

    const orderId = Number(payload.orderId);
    const requestedStatus = normalizeStatus(payload.status);

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid orderId is required.",
        },
        { status: 400 }
      );
    }

    if (!requestedStatus) {
      return NextResponse.json(
        {
          success: false,
          error: "Supported order status is required.",
        },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: order, error: orderError } =
      await supabase
        .from("orders")
        .select(
          "id,order_status,status,mobile,phone,full_name,customer_name,courier_name,tracking_id,expected_delivery_date"
        )
        .eq("id", orderId)
        .single<OrderRow>();

    if (orderError || !order) {
      return NextResponse.json(
        {
          success: false,
          error:
            orderError?.message ||
            `Order #${orderId} was not found.`,
        },
        { status: 404 }
      );
    }

    const currentStatus = normalizeStatus(
      order.order_status || order.status
    );

    if (currentStatus !== requestedStatus) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Order status mismatch. Database=${currentStatus || "-"}, request=${requestedStatus}.`,
        },
        { status: 409 }
      );
    }

    const customerPhone = normalizePhone(
      order.mobile || order.phone
    );

    if (!customerPhone) {
      return NextResponse.json(
        {
          success: false,
          skipped: true,
          error: "Customer phone is missing.",
        },
        { status: 400 }
      );
    }

    const dedupeKey =
      `DIRECT_WA:ORDER:${orderId}:${requestedStatus.toUpperCase()}`;

    const { data: existing } =
      await supabase
        .from("ncs_whatsapp_outbound_messages")
        .select("id,status")
        .eq("action_type", dedupeKey)
        .in("status", ["SENT", "PENDING"])
        .limit(1);

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message:
          "This order status WhatsApp was already processed.",
      });
    }

    const accessToken =
      process.env.WHATSAPP_ACCESS_TOKEN?.trim();

    const phoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

    const apiVersion =
      process.env.WHATSAPP_API_VERSION?.trim() || "v25.0";

    const templateName =
      templateForStatus(requestedStatus);

    const templateLanguage =
      process.env.WHATSAPP_CUSTOMER_ORDER_STATUS_TEMPLATE_LANGUAGE?.trim() ||
      "en";

    if (!accessToken || !phoneNumberId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing.",
        },
        { status: 500 }
      );
    }

    if (!templateName) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Order-status WhatsApp template is not configured.",
        },
        { status: 500 }
      );
    }

    const customerName =
      text(order.full_name) ||
      text(order.customer_name) ||
      "Customer";

    const detail = buildDetail(
      order,
      requestedStatus
    );

    const { data: logRow, error: logInsertError } =
      await supabase
        .from("ncs_whatsapp_outbound_messages")
        .insert({
          phone: customerPhone,
          customer_name: customerName,
          action_type: dedupeKey,
          message_text: detail,
          delivery_mode: "TEMPLATE",
          window_active: false,
          status: "PENDING",
        })
        .select("id")
        .single();

    if (logInsertError) {
      console.warn(
        "Unable to create WhatsApp outbound log:",
        logInsertError.message
      );
    }

    const metaResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: customerPhone,
          type: "template",
          template: {
            name: templateName,
            language: {
              code: templateLanguage,
            },
            components: [
              {
                type: "body",
                parameters: [
                  {
                    type: "text",
                    text: customerName,
                  },
                  {
                    type: "text",
                    text: String(orderId),
                  },
                  {
                    type: "text",
                    text: requestedStatus,
                  },
                  {
                    type: "text",
                    text: detail,
                  },
                ],
              },
            ],
          },
        }),
      }
    );

    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
      if (logRow?.id) {
        await supabase
          .from("ncs_whatsapp_outbound_messages")
          .update({
            status: "FAILED",
            error_message:
              metaData?.error?.message ||
              "Meta WhatsApp send failed.",
          })
          .eq("id", logRow.id);
      }

      return NextResponse.json(
        {
          success: false,
          error:
            metaData?.error?.message ||
            "Unable to send order status WhatsApp.",
          meta: metaData,
        },
        { status: metaResponse.status || 500 }
      );
    }

    const whatsappMessageId =
      metaData?.messages?.[0]?.id || null;

    if (logRow?.id) {
      await supabase
        .from("ncs_whatsapp_outbound_messages")
        .update({
          status: "SENT",
          whatsapp_message_id:
            whatsappMessageId,
          sent_at:
            new Date().toISOString(),
          error_message: null,
        })
        .eq("id", logRow.id);
    }

    return NextResponse.json({
      success: true,
      duplicate: false,
      orderId,
      status: requestedStatus,
      whatsappMessageId,
    });
  } catch (error) {
    console.error(
      "Order status direct WhatsApp error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected order status WhatsApp error.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "NEW CITY STYLE direct order status WhatsApp",
    configured: {
      webhookSecret: Boolean(
        process.env.NCS_ORDER_STATUS_WEBHOOK_SECRET?.trim()
      ),
      accessToken: Boolean(
        process.env.WHATSAPP_ACCESS_TOKEN?.trim()
      ),
      phoneNumberId: Boolean(
        process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
      ),
      genericTemplate: Boolean(
        process.env.WHATSAPP_CUSTOMER_ORDER_STATUS_TEMPLATE_NAME?.trim()
      ),
      language:
        process.env.WHATSAPP_CUSTOMER_ORDER_STATUS_TEMPLATE_LANGUAGE?.trim() ||
        "en",
    },
  });
}
