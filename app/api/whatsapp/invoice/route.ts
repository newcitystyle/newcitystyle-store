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

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
}

function safeFileName(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned.toLowerCase().endsWith(".pdf")
    ? cleaned
    : `${cleaned || "new-city-style-invoice"}.pdf`;
}

function buildMetaError(metaData: MetaErrorResponse) {
  const metaError = metaData?.error;

  return {
    error: metaError?.message || "WhatsApp Cloud API request failed.",
    metaErrorCode: metaError?.code || null,
    metaErrorSubcode: metaError?.error_subcode || null,
    metaErrorType: metaError?.type || null,
    fbtraceId: metaError?.fbtrace_id || null,
    errorUserTitle: metaError?.error_user_title || null,
    errorUserMessage: metaError?.error_user_msg || null,
    errorDetails: metaError?.error_data?.details || null,
    messagingProduct:
      metaError?.error_data?.messaging_product || null,
    fullMetaError: metaData,
  };
}

export async function POST(request: Request) {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const apiVersion =
      process.env.WHATSAPP_API_VERSION?.trim() || "v25.0";
    const templateName =
      process.env.WHATSAPP_INVOICE_TEMPLATE_NAME?.trim() ||
      "new_city_style_invoice_pdf";
    const templateLanguage =
      process.env.WHATSAPP_INVOICE_TEMPLATE_LANGUAGE?.trim() ||
      "en";

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

    const formData = await request.formData();

    const pdf = formData.get("pdf");
    const recipientPhone = normalizePhone(
      String(formData.get("to") || ""),
    );
    const customerName =
      String(formData.get("customerName") || "").trim() ||
      "Customer";
    const billNumber =
      String(formData.get("billNumber") || "").trim();
    const billAmount =
      String(formData.get("billAmount") || "0").trim();
    const paidAmount =
      String(formData.get("paidAmount") || "0").trim();
    const dueAmount =
      String(formData.get("dueAmount") || "0").trim();
    const paymentMethod =
      String(formData.get("paymentMethod") || "").trim() ||
      "Cash";
    const requestedFileName = String(
      formData.get("fileName") ||
        `${billNumber || "new-city-style-invoice"}.pdf`,
    );
    const fileName = safeFileName(requestedFileName);

    if (
      recipientPhone.length < 10 ||
      recipientPhone.length > 15
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid WhatsApp recipient number is required.",
        },
        { status: 400 },
      );
    }

    if (!(pdf instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "PDF invoice file is required.",
        },
        { status: 400 },
      );
    }

    if (pdf.type !== "application/pdf") {
      return NextResponse.json(
        {
          success: false,
          error: "Only application/pdf files are accepted.",
        },
        { status: 400 },
      );
    }

    if (pdf.size <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "The PDF invoice is empty.",
        },
        { status: 400 },
      );
    }

    const uploadFormData = new FormData();
    uploadFormData.append("messaging_product", "whatsapp");
    uploadFormData.append(
      "file",
      new File([await pdf.arrayBuffer()], fileName, {
        type: "application/pdf",
      }),
    );

    const uploadResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: uploadFormData,
        cache: "no-store",
      },
    );

    const uploadData = (await uploadResponse.json()) as
      | { id?: string }
      | MetaErrorResponse;

    if (!uploadResponse.ok || !("id" in uploadData) || !uploadData.id) {
      console.error(
        "WhatsApp media upload error:",
        JSON.stringify(uploadData),
      );

      return NextResponse.json(
        {
          success: false,
          stage: "media_upload",
          ...buildMetaError(uploadData as MetaErrorResponse),
        },
        { status: uploadResponse.status || 500 },
      );
    }

    const mediaId = uploadData.id;

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
            type: "header",
            parameters: [
              {
                type: "document",
                document: {
                  id: mediaId,
                  filename: fileName,
                },
              },
            ],
          },
          {
            type: "body",
            parameters: [
              { type: "text", text: customerName },
              { type: "text", text: billNumber },
              { type: "text", text: billAmount },
              { type: "text", text: paidAmount },
              { type: "text", text: dueAmount },
              { type: "text", text: paymentMethod },
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

    const messageData = (await messageResponse.json()) as
      | {
          messages?: Array<{
            id?: string;
            message_status?: string;
          }>;
          contacts?: Array<{
            wa_id?: string;
          }>;
        }
      | MetaErrorResponse;

    if (!messageResponse.ok || !("messages" in messageData)) {
      console.error(
        "WhatsApp invoice message error:",
        JSON.stringify(messageData),
      );

      return NextResponse.json(
        {
          success: false,
          stage: "message_send",
          mediaId,
          ...buildMetaError(messageData as MetaErrorResponse),
        },
        { status: messageResponse.status || 500 },
      );
    }

    const firstMessage = messageData.messages?.[0];

    return NextResponse.json({
      success: true,
      message:
        "NEW CITY STYLE PDF invoice sent to WhatsApp successfully.",
      mediaId,
      whatsappMessageId: firstMessage?.id || null,
      messageStatus: firstMessage?.message_status || "accepted",
      recipientWhatsAppId:
        messageData.contacts?.[0]?.wa_id || recipientPhone,
      templateName,
    });
  } catch (error) {
    console.error("WhatsApp invoice route error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected WhatsApp invoice error.",
      },
      { status: 500 },
    );
  }
}