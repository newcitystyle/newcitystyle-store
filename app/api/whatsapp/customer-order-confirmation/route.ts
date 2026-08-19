import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderItem = {
  name?: string;
  quantity?: number;
  price?: number;
  size?: string | null;
  color?: string | null;
};

type CustomerOrderPayload = {
  orderId?: string | number;
  customerName?: string;
  customerPhone?: string;
  totalAmount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  items?: OrderItem[];
};

function normalizeWhatsAppPhone(value: string): string {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }

  return digits;
}

function safeText(value: unknown, fallback = "-"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatAmount(value: unknown): string {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount)) {
    return "0";
  }

  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function buildOrderDetails(items: OrderItem[]): string {
  if (!Array.isArray(items) || items.length === 0) {
    return "Order items";
  }

  const visibleItems = items.slice(0, 8);

  const lines = visibleItems.map((item) => {
    const name = safeText(item.name, "Product");
    const quantity = Math.max(1, Number(item.quantity || 1));

    const variantParts = [
      item.size ? `Size ${safeText(item.size)}` : "",
      item.color ? safeText(item.color) : "",
    ].filter(Boolean);

    const variantText =
      variantParts.length > 0 ? ` (${variantParts.join(" | ")})` : "";

    return `${name}${variantText} x${quantity}`;
  });

  if (items.length > visibleItems.length) {
    lines.push(`+${items.length - visibleItems.length} more item(s)`);
  }

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const apiVersion =
      process.env.WHATSAPP_API_VERSION?.trim() || "v25.0";

    const templateName =
      process.env.WHATSAPP_CUSTOMER_ORDER_TEMPLATE_NAME?.trim();

    const templateLanguage =
      process.env.WHATSAPP_CUSTOMER_ORDER_TEMPLATE_LANGUAGE?.trim() || "en";

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "WHATSAPP_ACCESS_TOKEN is not configured.",
        },
        { status: 500 }
      );
    }

    if (!phoneNumberId) {
      return NextResponse.json(
        {
          success: false,
          error: "WHATSAPP_PHONE_NUMBER_ID is not configured.",
        },
        { status: 500 }
      );
    }

    if (!templateName) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WHATSAPP_CUSTOMER_ORDER_TEMPLATE_NAME is not configured.",
        },
        { status: 500 }
      );
    }

    const payload = (await request.json()) as CustomerOrderPayload;

    const customerPhone = normalizeWhatsAppPhone(
      safeText(payload.customerPhone, "")
    );

    if (!customerPhone) {
      return NextResponse.json(
        {
          success: false,
          error: "Customer WhatsApp phone number is missing.",
        },
        { status: 400 }
      );
    }

    const customerName = safeText(payload.customerName, "Customer");
    const orderId = safeText(payload.orderId, "-");
    const orderDetails = buildOrderDetails(payload.items || []);
    const totalAmount = formatAmount(payload.totalAmount);

    const paymentMethod = safeText(payload.paymentMethod, "Payment");
    const paymentStatus = safeText(payload.paymentStatus, "");
    const paymentText = paymentStatus
      ? `${paymentMethod} - ${paymentStatus}`
      : paymentMethod;

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
                    text: orderId,
                  },
                  {
                    type: "text",
                    text: orderDetails,
                  },
                  {
                    type: "text",
                    text: totalAmount,
                  },
                  {
                    type: "text",
                    text: paymentText,
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
      console.error(
        "Customer WhatsApp order confirmation Meta error:",
        metaData
      );

      return NextResponse.json(
        {
          success: false,
          error:
            metaData?.error?.message ||
            "Unable to send customer WhatsApp order confirmation.",
          meta: metaData,
        },
        { status: metaResponse.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Customer WhatsApp order confirmation sent.",
      data: metaData,
    });
  } catch (error) {
    console.error(
      "Customer WhatsApp order confirmation route error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected customer WhatsApp error.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "NEW CITY STYLE customer order confirmation",
    configured: {
      accessToken: Boolean(
        process.env.WHATSAPP_ACCESS_TOKEN?.trim()
      ),
      phoneNumberId: Boolean(
        process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
      ),
      templateName: Boolean(
        process.env.WHATSAPP_CUSTOMER_ORDER_TEMPLATE_NAME?.trim()
      ),
      templateLanguage:
        process.env.WHATSAPP_CUSTOMER_ORDER_TEMPLATE_LANGUAGE?.trim() ||
        "en",
    },
  });
}