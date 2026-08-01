import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MetaErrorResponse = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
    fbtrace_id?: string;
    error_user_title?: string;
    error_user_msg?: string;
    error_data?: {
      messaging_product?: string;
      details?: string;
    };
  };
};

type MetaMessageResponse = {
  messages?: Array<{
    id?: string;
    message_status?: string;
  }>;
  contacts?: Array<{
    wa_id?: string;
  }>;
};

const TEMPLATE_NAME =
  "new_city_style_bill_message";

const TEMPLATE_LANGUAGE =
  "en_US";

function normalizePhone(value: string) {
  let digits = String(value || "")
    .replace(/\D/g, "");

  if (
    digits.startsWith("0") &&
    digits.length === 11
  ) {
    digits = digits.slice(1);
  }

  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  return digits;
}

function safeTemplateText(
  value: FormDataEntryValue | null,
  fallback: string,
) {
  const text = String(value || "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text || fallback;
}

function normalizeAmount(
  value: FormDataEntryValue | null,
  fallback = "0.00",
) {
  const raw = String(value || "")
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed.toFixed(2);
}

function buildMetaError(
  metaData: MetaErrorResponse,
) {
  const metaError = metaData?.error;

  return {
    error:
      metaError?.message ||
      "WhatsApp Cloud API request failed.",
    metaErrorCode:
      metaError?.code ?? null,
    metaErrorSubcode:
      metaError?.error_subcode ?? null,
    metaErrorType:
      metaError?.type ?? null,
    fbtraceId:
      metaError?.fbtrace_id ?? null,
    errorUserTitle:
      metaError?.error_user_title ?? null,
    errorUserMessage:
      metaError?.error_user_msg ?? null,
    errorDetails:
      metaError?.error_data?.details ?? null,
    messagingProduct:
      metaError?.error_data
        ?.messaging_product ?? null,
    fullMetaError: metaData,
  };
}

export async function POST(
  request: Request,
) {
  try {
    const accessToken =
      process.env
        .WHATSAPP_ACCESS_TOKEN
        ?.trim();

    const phoneNumberId =
      process.env
        .WHATSAPP_PHONE_NUMBER_ID
        ?.trim();

    const apiVersion =
      process.env
        .WHATSAPP_API_VERSION
        ?.trim() || "v25.0";

    if (
      !accessToken ||
      !phoneNumberId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID.",
        },
        {
          status: 500,
        },
      );
    }

    const formData =
      await request.formData();

    const recipientPhone =
      normalizePhone(
        String(
          formData.get("to") || "",
        ),
      );

    const customerName =
      safeTemplateText(
        formData.get(
          "customerName",
        ),
        "Customer",
      );

    const billNumber =
      safeTemplateText(
        formData.get(
          "billNumber",
        ),
        "NCS-INVOICE",
      );

    const billAmount =
      normalizeAmount(
        formData.get(
          "billAmount",
        ),
      );

    const paidAmount =
      normalizeAmount(
        formData.get(
          "paidAmount",
        ),
      );

    const dueAmount =
      normalizeAmount(
        formData.get(
          "dueAmount",
        ),
      );

    const paymentMethod =
      safeTemplateText(
        formData.get(
          "paymentMethod",
        ),
        "Cash",
      );

    if (
      recipientPhone.length < 10 ||
      recipientPhone.length > 15
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid WhatsApp recipient number is required.",
          receivedPhone:
            recipientPhone,
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Approved template:
     *
     * Hello {{1}},
     *
     * Thank you for shopping with NEW CITY STYLE.
     *
     * Bill Number: {{2}}
     * Bill Amount: ₹{{3}}
     * Paid Amount: ₹{{4}}
     * Due Amount: ₹{{5}}
     * Payment Method: {{6}}
     *
     * Thank you for your business!
     */

    const messagePayload = {
      messaging_product:
        "whatsapp",
      recipient_type:
        "individual",
      to: recipientPhone,
      type: "template",
      template: {
        name: TEMPLATE_NAME,
        language: {
          code:
            TEMPLATE_LANGUAGE,
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text:
                  customerName,
              },
              {
                type: "text",
                text:
                  billNumber,
              },
              {
                type: "text",
                text:
                  billAmount,
              },
              {
                type: "text",
                text:
                  paidAmount,
              },
              {
                type: "text",
                text:
                  dueAmount,
              },
              {
                type: "text",
                text:
                  paymentMethod,
              },
            ],
          },
        ],
      },
    };

    console.log(
      "WhatsApp bill template request:",
      JSON.stringify(
        {
          to:
            recipientPhone,
          templateName:
            TEMPLATE_NAME,
          templateLanguage:
            TEMPLATE_LANGUAGE,
          bodyParameters: [
            customerName,
            billNumber,
            billAmount,
            paidAmount,
            dueAmount,
            paymentMethod,
          ],
        },
        null,
        2,
      ),
    );

    const messageResponse =
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
          body:
            JSON.stringify(
              messagePayload,
            ),
          cache: "no-store",
        },
      );

    const messageData =
      (await messageResponse.json()) as
        | MetaMessageResponse
        | MetaErrorResponse;

    if (
      !messageResponse.ok ||
      !("messages" in messageData) ||
      !Array.isArray(
        messageData.messages,
      ) ||
      messageData.messages
        .length === 0
    ) {
      console.error(
        "WhatsApp bill template error:",
        JSON.stringify(
          messageData,
          null,
          2,
        ),
      );

      return NextResponse.json(
        {
          success: false,
          stage:
            "template_message_send",
          templateName:
            TEMPLATE_NAME,
          templateLanguage:
            TEMPLATE_LANGUAGE,
          sentParameters: {
            customerName,
            billNumber,
            billAmount,
            paidAmount,
            dueAmount,
            paymentMethod,
          },
          ...buildMetaError(
            messageData as
              MetaErrorResponse,
          ),
        },
        {
          status:
            messageResponse.status ||
            500,
        },
      );
    }

    const firstMessage =
      messageData.messages?.[0];

    return NextResponse.json({
      success: true,
      message:
        "NEW CITY STYLE bill message sent to WhatsApp successfully.",
      whatsappMessageId:
        firstMessage?.id || null,
      messageStatus:
        firstMessage
          ?.message_status ||
        "accepted",
      recipientWhatsAppId:
        messageData.contacts?.[0]
          ?.wa_id ||
        recipientPhone,
      templateName:
        TEMPLATE_NAME,
      templateLanguage:
        TEMPLATE_LANGUAGE,
      sentParameters: {
        customerName,
        billNumber,
        billAmount,
        paidAmount,
        dueAmount,
        paymentMethod,
      },
    });
  } catch (error) {
    console.error(
      "WhatsApp bill template route error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected WhatsApp bill message error.",
      },
      {
        status: 500,
      },
    );
  }
}