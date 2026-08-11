import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReminderKind = "due" | "inactive" | "birthday" | "thank_you";

type ReminderRequest = {
  to?: string;
  customerName?: string;
  kind?: ReminderKind;
  dueAmount?: number;
  dueDate?: string | null;
  inactiveDays?: number;
};

function normalisePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return digits;

  return digits;
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value?: string | null) {
  if (!value) return "not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTemplateName(kind: ReminderKind) {
  if (kind === "due") {
    return (
      process.env.WHATSAPP_CUSTOMER_DUE_TEMPLATE_NAME ||
      "new_city_style_due_reminder"
    );
  }

  if (kind === "birthday") {
    return (
      process.env.WHATSAPP_BIRTHDAY_TEMPLATE_NAME ||
      "new_city_style_birthday_wish"
    );
  }

  if (kind === "inactive") {
    return (
      process.env.WHATSAPP_COMEBACK_TEMPLATE_NAME ||
      "new_city_style_customer_comeback"
    );
  }

  return (
    process.env.WHATSAPP_THANK_YOU_TEMPLATE_NAME ||
    "new_city_style_customer_thank_you"
  );
}

function getBodyParameters(
  kind: ReminderKind,
  customerName: string,
  dueAmount: number,
  dueDate: string | null,
  inactiveDays: number,
) {
  if (kind === "due") {
    return [
      { type: "text", text: customerName },
      { type: "text", text: money(dueAmount) },
      { type: "text", text: formatDate(dueDate) },
    ];
  }

  if (kind === "inactive") {
    return [
      { type: "text", text: customerName },
      { type: "text", text: String(Math.max(0, Math.round(inactiveDays))) },
    ];
  }

  return [{ type: "text", text: customerName }];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReminderRequest;

    const to = normalisePhone(String(body.to || ""));
    const customerName =
      String(body.customerName || "Customer").trim() || "Customer";
    const kind: ReminderKind =
      body.kind === "birthday" ||
      body.kind === "inactive" ||
      body.kind === "thank_you"
        ? body.kind
        : "due";

    if (!to) {
      return NextResponse.json(
        { success: false, error: "Customer mobile number is missing." },
        { status: 400 },
      );
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v25.0";

    if (!accessToken || !phoneNumberId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WhatsApp API environment variables are not configured.",
        },
        { status: 500 },
      );
    }

    const templateName = getTemplateName(kind);
    const bodyParameters = getBodyParameters(
      kind,
      customerName,
      Number(body.dueAmount || 0),
      body.dueDate || null,
      Number(body.inactiveDays || 0),
    );

    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: {
              code: process.env.WHATSAPP_CUSTOMER_DUE_TEMPLATE_LANGUAGE || "en",
            },
            components: [
              {
                type: "body",
                parameters: bodyParameters,
              },
            ],
          },
        }),
      },
    );

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("WhatsApp reminder API error:", result);

      const metaMessage =
        result?.error?.message ||
        "Meta WhatsApp API rejected the reminder.";

      return NextResponse.json(
        {
          success: false,
          error: metaMessage,
          meta: result,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      kind,
      templateName,
      messageId: result?.messages?.[0]?.id || null,
    });
  } catch (error) {
    console.error("WhatsApp customer reminder route error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to send WhatsApp reminder.",
      },
      { status: 500 },
    );
  }
}