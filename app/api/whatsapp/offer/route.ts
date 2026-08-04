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

type OfferRequest = {
  to?: string;
  customerName?: string;
  offerMessage?: string;
};

function normalizePhone(value: string) {
  let digits = String(value || "").replace(/\D/g, "");

  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }

  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  return digits;
}

function safeTemplateText(value: unknown, fallback: string) {
  const text = String(value || "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text || fallback;
}

function buildMetaError(metaData: MetaErrorResponse) {
  const metaError = metaData?.error;

  return {
    error:
      metaError?.message ||
      "WhatsApp Cloud API request failed.",
    metaErrorCode: metaError?.code ?? null,
    metaErrorSubcode: metaError?.error_subcode ?? null,
    metaErrorType: metaError?.type ?? null,
    fbtraceId: metaError?.fbtrace_id ?? null,
    errorUserTitle: metaError?.error_user_title ?? null,
    errorUserMessage: metaError?.error_user_msg ?? null,
    errorDetails: metaError?.error_data?.details ?? null,
    messagingProduct:
      metaError?.error_data?.messaging_product ?? null,
    fullMetaError: metaData,
  };
}

export async function POST(request: Request) {
  try {
    const accessToken =
      process.env.WHATSAPP_ACCESS_TOKEN?.trim();

    const phoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

    const apiVersion =
      process.env.WHATSAPP_API_VERSION?.trim() || "v25.0";

    /*
     * Do not hard-code an unapproved Meta template here.
     * After Meta approves the marketing template, add:
     *
     * WHATSAPP_MARKETING_TEMPLATE_NAME=your_approved_template_name
     *
     * to the existing environment settings.
     */
    const templateName =
      process.env.WHATSAPP_MARKETING_TEMPLATE_NAME?.trim();

    const templateLanguage =
      process.env.WHATSAPP_MARKETING_TEMPLATE_LANGUAGE?.trim() ||
      "en_US";

    if (!accessToken || !phoneNumberId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID.",
        },
        { status: 500 },
      );
    }

    if (!templateName) {
      return NextResponse.json(
        {
          success: false,
          stage: "template_configuration",
          error:
            "WHATSAPP_MARKETING_TEMPLATE_NAME is not configured. Add it only after the marketing template is approved in Meta.",
        },
        { status: 503 },
      );
    }

    const contentType =
      request.headers.get("content-type") || "";

    let rawTo = "";
    let rawCustomerName = "";
    let rawOfferMessage = "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as OfferRequest;
      rawTo = body.to || "";
      rawCustomerName = body.customerName || "";
      rawOfferMessage = body.offerMessage || "";
    } else {
      const formData = await request.formData();
      rawTo = String(formData.get("to") || "");
      rawCustomerName = String(
        formData.get("customerName") || "",
      );
      rawOfferMessage = String(
        formData.get("offerMessage") || "",
      );
    }

    const recipientPhone = normalizePhone(rawTo);
    const customerName = safeTemplateText(
      rawCustomerName,
      "Customer",
    );
    const offerMessage = safeTemplateText(
      rawOfferMessage,
      "A special offer is available at NEW CITY STYLE.",
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
          receivedPhone: recipientPhone,
        },
        { status: 400 },
      );
    }

    /*
     * Expected approved template body:
     *
     * Hello {{1}},
     *
     * {{2}}
     *
     * NEW CITY STYLE
     * Style for Every Family
     *
     * Parameters:
     * {{1}} Customer name
     * {{2}} Offer message
     */
    const messagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
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
            parameters: [
              {
                type: "text",
                text: customerName,
              },
              {
                type: "text",
                text: offerMessage,
              },
            ],
          },
        ],
      },
    };

    const messageResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
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
      !Array.isArray(messageData.messages) ||
      messageData.messages.length === 0
    ) {
      console.error(
        "WhatsApp marketing template error:",
        JSON.stringify(messageData, null, 2),
      );

      return NextResponse.json(
        {
          success: false,
          stage: "marketing_template_send",
          templateName,
          templateLanguage,
          sentParameters: {
            customerName,
            offerMessage,
          },
          ...buildMetaError(
            messageData as MetaErrorResponse,
          ),
        },
        {
          status: messageResponse.status || 500,
        },
      );
    }

    const firstMessage = messageData.messages?.[0];

    return NextResponse.json({
      success: true,
      message:
        "NEW CITY STYLE WhatsApp offer sent successfully.",
      whatsappMessageId: firstMessage?.id || null,
      messageStatus:
        firstMessage?.message_status || "accepted",
      recipientWhatsAppId:
        messageData.contacts?.[0]?.wa_id ||
        recipientPhone,
      templateName,
      templateLanguage,
      sentParameters: {
        customerName,
        offerMessage,
      },
    });
  } catch (error) {
    console.error(
      "WhatsApp marketing route error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected WhatsApp marketing error.",
      },
      { status: 500 },
    );
  }
}