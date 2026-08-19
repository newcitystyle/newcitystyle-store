import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OwnerOrderItem = {
  name?: string;
  quantity?: number | string;
  price?: number | string;
  size?: string | null;
  color?: string | null;
  barcode?: string | null;
};

type OwnerOrderAlertRequest = {
  orderId?: string | number;
  customerName?: string;
  customerPhone?: string;
  totalAmount?: number | string;
  paymentMethod?: string;
  paymentStatus?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  items?: OwnerOrderItem[];
};

type MetaSuccessResponse = {
  contacts?: Array<{
    input?: string;
    wa_id?: string;
  }>;
  messages?: Array<{
    id?: string;
    message_status?: string;
  }>;
};

type MetaErrorResponse = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_user_title?: string;
    error_user_msg?: string;
    error_data?: {
      details?: string;
      messaging_product?: string;
    };
  };
};

function normalizePhoneNumber(value: string): string {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }

  return digits;
}

function normalizeText(
  value: unknown,
  fallback: string
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.trim();
  return cleaned || fallback;
}

function normalizeAmount(value: unknown): string {
  const parsed = Number(
    String(value ?? "").replace(/[₹,\s]/g, "")
  );

  if (!Number.isFinite(parsed)) {
    return "0";
  }

  return Number.isInteger(parsed)
    ? String(parsed)
    : parsed.toFixed(2);
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length <= 4) {
    return digits;
  }

  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

function buildItemSummary(
  items: OwnerOrderItem[]
): string {
  if (!Array.isArray(items) || items.length === 0) {
    return "Order items unavailable";
  }

  const lines = items
    .slice(0, 8)
    .map((item, index) => {
      const name = normalizeText(
        item.name,
        "Product"
      );

      const qty = Math.max(
        1,
        Number(item.quantity || 1) || 1
      );

      const price = normalizeAmount(item.price);

      const variant = [
        item.size,
        item.color,
      ]
        .filter(
          (value) =>
            typeof value === "string" &&
            value.trim()
        )
        .join(" / ");

      const barcode =
        typeof item.barcode === "string" &&
        item.barcode.trim()
          ? ` • ${item.barcode.trim()}`
          : "";

      return `${index + 1}. ${name}${
        variant ? ` (${variant})` : ""
      } x${qty} @ ₹${price}${barcode}`;
    });

  if (items.length > 8) {
    lines.push(
      `+ ${items.length - 8} more item(s)`
    );
  }

  return lines.join("\n");
}

function buildMetaError(
  data: MetaErrorResponse
) {
  const error = data?.error;

  return {
    error:
      error?.error_data?.details ||
      error?.error_user_msg ||
      error?.message ||
      "Meta WhatsApp rejected the owner order alert.",
    metaMessage: error?.message ?? null,
    metaType: error?.type ?? null,
    metaErrorCode: error?.code ?? null,
    metaErrorSubcode:
      error?.error_subcode ?? null,
    errorUserTitle:
      error?.error_user_title ?? null,
    errorUserMessage:
      error?.error_user_msg ?? null,
    errorDetails:
      error?.error_data?.details ?? null,
    messagingProduct:
      error?.error_data?.messaging_product ??
      null,
    fbtraceId: error?.fbtrace_id ?? null,
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const accessToken =
      process.env.WHATSAPP_ACCESS_TOKEN?.trim();

    const phoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

    const apiVersion =
      process.env.WHATSAPP_API_VERSION?.trim() ||
      "v25.0";

    const ownerPhone = normalizePhoneNumber(
      process.env.WHATSAPP_OWNER_PHONE?.trim() ||
        ""
    );

    const templateName =
      process.env.WHATSAPP_OWNER_ORDER_TEMPLATE_NAME?.trim() ||
      "";

    const templateLanguage =
      process.env.WHATSAPP_OWNER_ORDER_TEMPLATE_LANGUAGE?.trim() ||
      "en";

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WHATSAPP_ACCESS_TOKEN is missing.",
        },
        { status: 500 }
      );
    }

    if (!phoneNumberId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WHATSAPP_PHONE_NUMBER_ID is missing.",
        },
        { status: 500 }
      );
    }

    if (
      ownerPhone.length < 10 ||
      ownerPhone.length > 15
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WHATSAPP_OWNER_PHONE is missing or invalid.",
        },
        { status: 500 }
      );
    }

    if (!templateName) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WHATSAPP_OWNER_ORDER_TEMPLATE_NAME is not configured.",
        },
        { status: 503 }
      );
    }

    const body =
      (await request.json()) as OwnerOrderAlertRequest;

    const orderId = normalizeText(
      String(body.orderId ?? ""),
      "NCS Order"
    );

    const customerName = normalizeText(
      body.customerName,
      "Customer"
    );

    const customerPhone =
      normalizePhoneNumber(
        normalizeText(
          body.customerPhone,
          ""
        )
      );

    const totalAmount =
      normalizeAmount(body.totalAmount);

    const paymentMethod = normalizeText(
      body.paymentMethod,
      "Cash on Delivery"
    );

    const paymentStatus = normalizeText(
      body.paymentStatus,
      "Pending"
    );

    const deliveryAddress = [
      body.address,
      body.city,
      body.state,
      body.pincode,
    ]
      .map((value) =>
        normalizeText(value, "")
      )
      .filter(Boolean)
      .join(", ");

    const itemSummary =
      buildItemSummary(body.items || []);

    /*
     * This MUST match the approved owner template exactly:
     *
     * {{1}} = Order Details
     * {{2}} = Customer Details
     * {{3}} = Delivery & Payment
     *
     * Buttons in the approved template:
     * 0 = Quick Reply: "Order Processed"
     * 1 = Static URL: "View Order"
     *
     * Static URL buttons do not need a runtime parameter.
     * Quick Reply gets an internal payload so replies are usable later.
     */
    const orderDetails = [
      `Order ${orderId}`,
      itemSummary,
      `Total ₹${totalAmount}`,
    ].join("\n");

    const customerDetails = [
      customerName,
      customerPhone || "Not provided",
    ].join(" | ");

    const deliveryAndPayment = [
      `${paymentMethod} - ${paymentStatus}`,
      deliveryAddress ||
        "Address unavailable",
    ].join(" | ");

    const templatePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: ownerPhone,
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
                text: orderDetails,
              },
              {
                type: "text",
                text: customerDetails,
              },
              {
                type: "text",
                text: deliveryAndPayment,
              },
            ],
          },
          {
            type: "button",
            sub_type: "quick_reply",
            index: "0",
            parameters: [
              {
                type: "payload",
                payload: `ORDER_PROCESSED_${orderId}`,
              },
            ],
          },
        ],
      },
    };

    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          templatePayload
        ),
        cache: "no-store",
      }
    );

    const data =
      (await response.json()) as
        | MetaSuccessResponse
        | MetaErrorResponse;

    if (
      !response.ok ||
      !("messages" in data) ||
      !Array.isArray(data.messages) ||
      data.messages.length === 0
    ) {
      const metaError = buildMetaError(
        data as MetaErrorResponse
      );

      console.error(
        "Owner order WhatsApp Meta error:",
        {
          status: response.status,
          templateName,
          templateLanguage,
          ...metaError,
          raw: data,
        }
      );

      return NextResponse.json(
        {
          success: false,
          ...metaError,
          templateName,
          templateLanguage,
        },
        {
          status:
            response.status || 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      directWhatsAppSent: true,
      message:
        "Owner new-order alert accepted by WhatsApp.",
      orderId,
      ownerPhone: maskPhone(ownerPhone),
      whatsappMessageId:
        data.messages?.[0]?.id || null,
      messageStatus:
        data.messages?.[0]
          ?.message_status ||
        "accepted",
      recipientWhatsAppId:
        data.contacts?.[0]?.wa_id ||
        null,
      templateName,
      templateLanguage,
    });
  } catch (error) {
    console.error(
      "Owner order WhatsApp route error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected owner order WhatsApp error.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route:
      "/api/whatsapp/owner-order-alert",
    configured: {
      accessToken: Boolean(
        process.env.WHATSAPP_ACCESS_TOKEN?.trim()
      ),
      phoneNumberId: Boolean(
        process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
      ),
      ownerPhone: Boolean(
        process.env.WHATSAPP_OWNER_PHONE?.trim()
      ),
      templateName:
        process.env.WHATSAPP_OWNER_ORDER_TEMPLATE_NAME?.trim() ||
        null,
      templateLanguage:
        process.env.WHATSAPP_OWNER_ORDER_TEMPLATE_LANGUAGE?.trim() ||
        "en",
    },
  });
}