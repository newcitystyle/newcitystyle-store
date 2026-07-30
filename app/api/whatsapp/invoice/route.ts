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

type MetaUploadResponse = {
  id?: string;
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

const INVOICE_TEMPLATE_NAME = "new_city_style_invoice_document";
const INVOICE_TEMPLATE_LANGUAGE = "en";

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

function safeFileName(value: string) {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!cleaned) {
    return "new-city-style-invoice.pdf";
  }

  return cleaned.toLowerCase().endsWith(".pdf")
    ? cleaned
    : `${cleaned}.pdf`;
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
  fallback = "0",
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

  return String(parsed);
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

    const customerName = safeTemplateText(
      formData.get("customerName"),
      "Customer",
    );

    const billNumber = safeTemplateText(
      formData.get("billNumber"),
      "NCS-INVOICE",
    );

    const billAmount = normalizeAmount(
      formData.get("billAmount"),
    );

    const paidAmount = normalizeAmount(
      formData.get("paidAmount"),
    );

    const dueAmount = normalizeAmount(
      formData.get("dueAmount"),
    );

    const paymentMethod = safeTemplateText(
      formData.get("paymentMethod"),
      "Cash",
    );

    const requestedFileName = safeTemplateText(
      formData.get("fileName"),
      `${billNumber}.pdf`,
    );

    const fileName = safeFileName(requestedFileName);

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
          error: "Only PDF invoice files are accepted.",
          receivedFileType: pdf.type,
        },
        { status: 400 },
      );
    }

    if (pdf.size <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "The PDF invoice file is empty.",
        },
        { status: 400 },
      );
    }

    /*
     * STEP 1:
     * Upload the generated PDF to WhatsApp media.
     */

    const uploadFormData = new FormData();

    uploadFormData.append(
      "messaging_product",
      "whatsapp",
    );

    uploadFormData.append(
      "file",
      new File(
        [await pdf.arrayBuffer()],
        fileName,
        {
          type: "application/pdf",
        },
      ),
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

    const uploadData =
      (await uploadResponse.json()) as
        | MetaUploadResponse
        | MetaErrorResponse;

    if (
      !uploadResponse.ok ||
      !("id" in uploadData) ||
      !uploadData.id
    ) {
      console.error(
        "WhatsApp media upload error:",
        JSON.stringify(uploadData, null, 2),
      );

      return NextResponse.json(
        {
          success: false,
          stage: "media_upload",
          ...buildMetaError(
            uploadData as MetaErrorResponse,
          ),
        },
        {
          status: uploadResponse.status || 500,
        },
      );
    }

    const mediaId = uploadData.id;

    /*
     * Exact approved template structure:
     *
     * Header:
     * Document
     *
     * {{1}} Customer name
     * {{2}} Bill number
     * {{3}} Bill amount
     * {{4}} Paid amount
     * {{5}} Due amount
     * {{6}} Payment method
     */

    const messagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone,
      type: "template",
      template: {
        name: INVOICE_TEMPLATE_NAME,
        language: {
          code: INVOICE_TEMPLATE_LANGUAGE,
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
              {
                type: "text",
                text: customerName,
              },
              {
                type: "text",
                text: billNumber,
              },
              {
                type: "text",
                text: billAmount,
              },
              {
                type: "text",
                text: paidAmount,
              },
              {
                type: "text",
                text: dueAmount,
              },
              {
                type: "text",
                text: paymentMethod,
              },
            ],
          },
        ],
      },
    };

    console.log(
      "WhatsApp invoice request:",
      JSON.stringify(
        {
          to: recipientPhone,
          templateName: INVOICE_TEMPLATE_NAME,
          templateLanguage:
            INVOICE_TEMPLATE_LANGUAGE,
          mediaId,
          fileName,
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

    /*
     * STEP 2:
     * Send the approved WhatsApp template.
     */

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
        "WhatsApp invoice message error:",
        JSON.stringify(messageData, null, 2),
      );

      return NextResponse.json(
        {
          success: false,
          stage: "message_send",
          mediaId,
          templateName: INVOICE_TEMPLATE_NAME,
          templateLanguage:
            INVOICE_TEMPLATE_LANGUAGE,
          sentParameters: {
            customerName,
            billNumber,
            billAmount,
            paidAmount,
            dueAmount,
            paymentMethod,
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
        "NEW CITY STYLE PDF invoice sent to WhatsApp successfully.",
      mediaId,
      whatsappMessageId: firstMessage?.id || null,
      messageStatus:
        firstMessage?.message_status || "accepted",
      recipientWhatsAppId:
        messageData.contacts?.[0]?.wa_id ||
        recipientPhone,
      templateName: INVOICE_TEMPLATE_NAME,
      templateLanguage:
        INVOICE_TEMPLATE_LANGUAGE,
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
      "WhatsApp invoice route error:",
      error,
    );

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