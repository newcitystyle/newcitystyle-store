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

type MetaTemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
};

type MetaTemplateDetails = {
  id?: string;
  name?: string;
  language?: string;
  status?: string;
  parameter_format?: "POSITIONAL" | "NAMED" | string;
  components?: MetaTemplateComponent[];
  error?: MetaErrorResponse["error"];
};

const INVOICE_TEMPLATE_NAME = "new_city_style_invoice_document";
const INVOICE_TEMPLATE_LANGUAGE = "en_US";

// Template ID visible in WhatsApp Manager.
// It can be overridden safely from Vercel Environment Variables.
const DEFAULT_INVOICE_TEMPLATE_ID = "1046855767891190";

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


function extractNamedParameters(
  templateText: string,
) {
  return Array.from(
    templateText.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g),
  ).map((match) => match[1]);
}

function extractPositionalParameterCount(
  templateText: string,
) {
  const indexes = Array.from(
    templateText.matchAll(/\{\{\s*(\d+)\s*\}\}/g),
  ).map((match) => Number(match[1]));

  return indexes.length > 0
    ? Math.max(...indexes)
    : 0;
}

function normalizedParameterKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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

    const invoiceTemplateId =
      process.env.WHATSAPP_INVOICE_TEMPLATE_ID?.trim() ||
      DEFAULT_INVOICE_TEMPLATE_ID;

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

    /*
     * Read the approved template directly from Meta before sending.
     * This prevents POSITIONAL/NAMED parameter-format mismatches.
     */
    const templateResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${invoiceTemplateId}?fields=id,name,language,status,parameter_format,components`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      },
    );

    const templateData =
      (await templateResponse.json()) as MetaTemplateDetails;

    if (
      !templateResponse.ok ||
      templateData.error
    ) {
      console.error(
        "WhatsApp template details error:",
        JSON.stringify(templateData, null, 2),
      );

      return NextResponse.json(
        {
          success: false,
          stage: "template_lookup",
          templateId: invoiceTemplateId,
          ...buildMetaError(
            templateData as MetaErrorResponse,
          ),
        },
        {
          status: templateResponse.status || 500,
        },
      );
    }

    const approvedTemplateName =
      templateData.name?.trim() ||
      INVOICE_TEMPLATE_NAME;

    const approvedTemplateLanguage =
      templateData.language?.trim() ||
      INVOICE_TEMPLATE_LANGUAGE;

    const bodyTemplateText =
      templateData.components?.find(
        (component) =>
          component.type?.toUpperCase() === "BODY",
      )?.text || "";

    const parameterValues = [
      customerName,
      billNumber,
      billAmount,
      paidAmount,
      dueAmount,
      paymentMethod,
    ];

    const valueByName: Record<string, string> = {
      customer_name: customerName,
      customer: customerName,
      name: customerName,

      bill_number: billNumber,
      invoice_number: billNumber,
      bill_no: billNumber,
      invoice_no: billNumber,

      bill_amount: billAmount,
      invoice_amount: billAmount,
      total_amount: billAmount,
      total: billAmount,

      paid_amount: paidAmount,
      amount_paid: paidAmount,
      paid: paidAmount,

      due_amount: dueAmount,
      balance_due: dueAmount,
      due: dueAmount,

      payment_method: paymentMethod,
      payment_mode: paymentMethod,
      method: paymentMethod,
    };

    const parameterFormat =
      templateData.parameter_format
        ?.trim()
        .toUpperCase() || "POSITIONAL";

    let bodyParameters:
      Array<{
        type: "text";
        text: string;
        parameter_name?: string;
      }>;

    if (parameterFormat === "NAMED") {
      const namedParameters =
        extractNamedParameters(
          bodyTemplateText,
        );

      if (namedParameters.length === 0) {
        return NextResponse.json(
          {
            success: false,
            stage: "template_validation",
            error:
              "Meta reports a NAMED template, but no named body placeholders were found.",
            templateId: invoiceTemplateId,
            templateName: approvedTemplateName,
            parameterFormat,
            bodyTemplateText,
          },
          { status: 500 },
        );
      }

      bodyParameters =
        namedParameters.map(
          (parameterName, index) => {
            const normalizedName =
              normalizedParameterKey(
                parameterName,
              );

            return {
              type: "text" as const,
              parameter_name:
                parameterName,
              text:
                valueByName[
                  normalizedName
                ] ??
                parameterValues[index] ??
                "",
            };
          },
        );
    } else {
      const positionalCount =
        extractPositionalParameterCount(
          bodyTemplateText,
        );

      const requiredCount =
        positionalCount > 0
          ? positionalCount
          : parameterValues.length;

      bodyParameters =
        parameterValues
          .slice(0, requiredCount)
          .map((text) => ({
            type: "text" as const,
            text,
          }));
    }

    const messagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone,
      type: "template",
      template: {
        name: approvedTemplateName,
        language: {
          code: approvedTemplateLanguage,
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
            parameters: bodyParameters,
          },
        ],
      },
    };

    console.log(
      "WhatsApp invoice request:",
      JSON.stringify(
        {
          to: recipientPhone,
          templateId: invoiceTemplateId,
          templateName: approvedTemplateName,
          templateLanguage:
            approvedTemplateLanguage,
          parameterFormat,
          bodyTemplateText,
          mediaId,
          fileName,
          bodyParameters,
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
          templateId: invoiceTemplateId,
          templateName: approvedTemplateName,
          templateLanguage:
            approvedTemplateLanguage,
          parameterFormat,
          bodyTemplateText,
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
      templateId: invoiceTemplateId,
      templateName: approvedTemplateName,
      templateLanguage:
        approvedTemplateLanguage,
      parameterFormat,
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