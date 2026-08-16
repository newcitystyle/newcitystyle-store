import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CustomerWhatsAppType =
  | "DUE_REMINDER"
  | "PAYMENT_RECEIVED"
  | "RETURN_COMPLETED"
  | "EXCHANGE_COMPLETED";

type CustomerWhatsAppRequest = {
  type?: CustomerWhatsAppType;
  to?: string;
  customerName?: string;
  currentDue?: number | string;
  amount?: number | string;
  remainingDue?: number | string;
  paymentMethod?: string;

  billNumber?: string;
  returnNumber?: string;
  returnedAmount?: number | string;
  exchangeValue?: number | string;
  differenceAmount?: number | string;
  settlementDirection?: string;
  settlementMethod?: string;
};

type MetaSuccessResponse = {
  messaging_product?: string;
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
    error_data?: {
      messaging_product?: string;
      details?: string;
    };
  };
};

function normalizePhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (
    digits.length === 12 &&
    digits.startsWith("91")
  ) {
    return digits;
  }

  return digits;
}

function normalizeText(
  value: unknown,
  fallback: string,
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.trim();
  return cleaned || fallback;
}

function normalizeAmount(
  value: unknown,
): string {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value.toFixed(2);
  }

  if (typeof value === "string") {
    const cleaned = value
      .replace(/[₹,\s]/g, "")
      .trim();

    const parsed = Number(cleaned);

    if (
      cleaned &&
      Number.isFinite(parsed)
    ) {
      return parsed.toFixed(2);
    }
  }

  return "0.00";
}

function maskPhone(
  value: string,
): string {
  const digits =
    value.replace(/\D/g, "");

  if (digits.length <= 4) {
    return digits;
  }

  return `${"*".repeat(
    Math.max(0, digits.length - 4),
  )}${digits.slice(-4)}`;
}

function buildMetaError(
  data: MetaErrorResponse,
) {
  const error = data.error;

  return {
    metaErrorCode:
      error?.code ?? null,
    metaErrorSubcode:
      error?.error_subcode ?? null,
    metaErrorType:
      error?.type ?? null,
    metaErrorMessage:
      error?.message ?? null,
    metaErrorDetails:
      error?.error_data?.details ?? null,
    fbtraceId:
      error?.fbtrace_id ?? null,
  };
}

export async function POST(
  request: NextRequest,
) {
  try {
    /*
     * IMPORTANT:
     * This is a NEW, isolated customer-message route.
     * It does NOT change the existing invoice WhatsApp route,
     * webhook, token, phone-number ID, or invoice templates.
     */
    const accessToken =
      process.env.WHATSAPP_ACCESS_TOKEN;

    const phoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID;

    const apiVersion =
      process.env.WHATSAPP_API_VERSION ||
      "v25.0";

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WHATSAPP_ACCESS_TOKEN is missing.",
        },
        { status: 500 },
      );
    }

    if (!phoneNumberId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WHATSAPP_PHONE_NUMBER_ID is missing.",
        },
        { status: 500 },
      );
    }

    let body:
      CustomerWhatsAppRequest;

    try {
      body =
        (await request.json()) as
          CustomerWhatsAppRequest;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Request body must be valid JSON.",
        },
        { status: 400 },
      );
    }

    const messageType =
      body.type;

    if (
      messageType !== "DUE_REMINDER" &&
      messageType !== "PAYMENT_RECEIVED" &&
      messageType !== "RETURN_COMPLETED" &&
      messageType !== "EXCHANGE_COMPLETED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "type must be DUE_REMINDER, PAYMENT_RECEIVED, RETURN_COMPLETED, or EXCHANGE_COMPLETED.",
        },
        { status: 400 },
      );
    }

    const recipientPhone =
      normalizePhoneNumber(
        body.to?.trim() || "",
      );

    if (
      recipientPhone.length < 10 ||
      recipientPhone.length > 15
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enter a valid customer phone number with country code.",
        },
        { status: 400 },
      );
    }

    const customerName =
      normalizeText(
        body.customerName,
        "Customer",
      );

    const templateName =
      messageType === "DUE_REMINDER"
        ? process.env
            .WHATSAPP_CUSTOMER_DUE_TEMPLATE_NAME
            ?.trim()
        : messageType === "PAYMENT_RECEIVED"
          ? process.env
              .WHATSAPP_PAYMENT_RECEIVED_TEMPLATE_NAME
              ?.trim()
          : messageType === "RETURN_COMPLETED"
            ? process.env
                .WHATSAPP_RETURN_COMPLETED_TEMPLATE_NAME
                ?.trim()
            : process.env
                .WHATSAPP_EXCHANGE_COMPLETED_TEMPLATE_NAME
                ?.trim();

    const templateLanguage =
      (
        messageType === "DUE_REMINDER"
          ? process.env
              .WHATSAPP_CUSTOMER_DUE_TEMPLATE_LANGUAGE
          : messageType === "PAYMENT_RECEIVED"
            ? process.env
                .WHATSAPP_PAYMENT_RECEIVED_TEMPLATE_LANGUAGE
            : messageType === "RETURN_COMPLETED"
              ? process.env
                  .WHATSAPP_RETURN_COMPLETED_TEMPLATE_LANGUAGE
              : process.env
                  .WHATSAPP_EXCHANGE_COMPLETED_TEMPLATE_LANGUAGE
      )?.trim() || "en";

    /*
     * Do NOT silently reuse the invoice template here.
     * A reminder/payment message should use its own approved
     * WhatsApp template. If it is not configured, this route
     * returns a safe error and the Android app can fall back
     * to the existing wa.me flow.
     */
    if (!templateName) {
      return NextResponse.json(
        {
          success: false,
          fallbackRecommended: true,
          type: messageType,
          error:
            messageType === "DUE_REMINDER"
              ? "WHATSAPP_CUSTOMER_DUE_TEMPLATE_NAME is not configured."
              : messageType === "PAYMENT_RECEIVED"
                ? "WHATSAPP_PAYMENT_RECEIVED_TEMPLATE_NAME is not configured."
                : messageType === "RETURN_COMPLETED"
                  ? "WHATSAPP_RETURN_COMPLETED_TEMPLATE_NAME is not configured."
                  : "WHATSAPP_EXCHANGE_COMPLETED_TEMPLATE_NAME is not configured.",
        },
        { status: 503 },
      );
    }

    const parameters =
      messageType === "DUE_REMINDER"
        ? [
            {
              type: "text",
              text: customerName,
            },
            {
              type: "text",
              text: normalizeAmount(
                body.currentDue,
              ),
            },
          ]
        : messageType === "PAYMENT_RECEIVED"
          ? [
              {
                type: "text",
                text: customerName,
              },
              {
                type: "text",
                text: normalizeAmount(
                  body.amount,
                ),
              },
              {
                type: "text",
                text: normalizeText(
                  body.paymentMethod,
                  "Payment",
                ),
              },
              {
                type: "text",
                text: normalizeAmount(
                  body.remainingDue,
                ),
              },
            ]
          : messageType === "RETURN_COMPLETED"
            ? [
                {
                  type: "text",
                  text: customerName,
                },
                {
                  type: "text",
                  text: normalizeText(
                    body.billNumber,
                    "Bill",
                  ),
                },
                {
                  type: "text",
                  text: normalizeText(
                    body.returnNumber,
                    "Return",
                  ),
                },
                {
                  type: "text",
                  text: normalizeAmount(
                    body.returnedAmount,
                  ),
                },
                {
                  type: "text",
                  text: normalizeText(
                    body.paymentMethod,
                    "Refund",
                  ),
                },
              ]
            : [
                {
                  type: "text",
                  text: customerName,
                },
                {
                  type: "text",
                  text: normalizeText(
                    body.billNumber,
                    "Bill",
                  ),
                },
                {
                  type: "text",
                  text: normalizeText(
                    body.returnNumber,
                    "Exchange",
                  ),
                },
                {
                  type: "text",
                  text: normalizeAmount(
                    body.returnedAmount,
                  ),
                },
                {
                  type: "text",
                  text: normalizeAmount(
                    body.exchangeValue,
                  ),
                },
                {
                  type: "text",
                  text: normalizeText(
                    body.settlementDirection,
                    "even",
                  ),
                },
                {
                  type: "text",
                  text: normalizeAmount(
                    body.differenceAmount,
                  ),
                },
                {
                  type: "text",
                  text: normalizeText(
                    body.settlementMethod,
                    "none",
                  ),
                },
              ];

    const messagePayload = {
      messaging_product:
        "whatsapp",
      recipient_type:
        "individual",
      to: recipientPhone,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: templateLanguage,
        },
        components: [
          {
            type: "body",
            parameters,
          },
        ],
      },
    };

    console.log(
      "Customer WhatsApp request:",
      JSON.stringify(
        {
          type: messageType,
          to: maskPhone(
            recipientPhone,
          ),
          templateName,
          templateLanguage,
          parameterCount:
            parameters.length,
        },
        null,
        2,
      ),
    );

    const metaResponse =
      await fetch(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            messagePayload,
          ),
          cache: "no-store",
        },
      );

    const metaData =
      (await metaResponse.json()) as
        | MetaSuccessResponse
        | MetaErrorResponse;

    if (
      !metaResponse.ok ||
      !(
        "messages" in
        metaData
      ) ||
      !Array.isArray(
        metaData.messages,
      ) ||
      metaData.messages.length ===
        0
    ) {
      console.error(
        "Customer WhatsApp Meta error:",
        JSON.stringify(
          metaData,
          null,
          2,
        ),
      );

      return NextResponse.json(
        {
          success: false,
          fallbackRecommended: true,
          type: messageType,
          templateName,
          templateLanguage,
          ...buildMetaError(
            metaData as
              MetaErrorResponse,
          ),
        },
        {
          status:
            metaResponse.status ||
            500,
        },
      );
    }

    const firstMessage =
      metaData.messages?.[0];

    return NextResponse.json(
      {
        success: true,
        directWhatsAppSent: true,
        type: messageType,
        message:
          messageType === "DUE_REMINDER"
            ? "Customer due reminder accepted by WhatsApp."
            : messageType === "PAYMENT_RECEIVED"
              ? "Payment received message accepted by WhatsApp."
              : messageType === "RETURN_COMPLETED"
                ? "Return completed message accepted by WhatsApp."
                : "Exchange completed message accepted by WhatsApp.",
        recipientPhone:
          maskPhone(
            recipientPhone,
          ),
        whatsappMessageId:
          firstMessage?.id ||
          null,
        messageStatus:
          firstMessage
            ?.message_status ||
          "accepted",
        recipientWhatsAppId:
          metaData.contacts?.[0]
            ?.wa_id ||
          null,
        templateName,
        templateLanguage,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Customer WhatsApp route error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        fallbackRecommended: true,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected customer WhatsApp error.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route:
      "/api/whatsapp/customer-message",
    method: "POST",
    isolatedFromInvoiceRoute:
      true,
    dueReminderTemplateConfigured:
      Boolean(
        process.env
          .WHATSAPP_CUSTOMER_DUE_TEMPLATE_NAME,
      ),
    paymentReceivedTemplateConfigured:
      Boolean(
        process.env
          .WHATSAPP_PAYMENT_RECEIVED_TEMPLATE_NAME,
      ),
    returnCompletedTemplateConfigured:
      Boolean(
        process.env
          .WHATSAPP_RETURN_COMPLETED_TEMPLATE_NAME,
      ),
    exchangeCompletedTemplateConfigured:
      Boolean(
        process.env
          .WHATSAPP_EXCHANGE_COMPLETED_TEMPLATE_NAME,
      ),
    message:
      "NEW CITY STYLE customer WhatsApp direct-send route is ready.",
  });
}