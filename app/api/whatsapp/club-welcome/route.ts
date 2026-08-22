import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClubWelcomeBody = {
  to?: string;
  customerName?: string;
  voucherCode?: string;
  voucherAmount?: number;
  minimumOrderAmount?: number;
  expiresAt?: string;
};

function normalizePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

function cleanText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function formatExpiry(value: string) {
  if (!value) return "7 days";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "7 days";

  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v25.0";
    const templateName =
      process.env.WHATSAPP_CLUB_WELCOME_TEMPLATE_NAME?.trim() || "";
    const templateLanguage =
      process.env.WHATSAPP_CLUB_WELCOME_TEMPLATE_LANGUAGE?.trim() || "en";

    if (!accessToken || !phoneNumberId) {
      return NextResponse.json(
        {
          success: false,
          error: "WhatsApp Meta credentials are not configured.",
        },
        { status: 503 },
      );
    }

    if (!templateName) {
      return NextResponse.json(
        {
          success: false,
          error: "WHATSAPP_CLUB_WELCOME_TEMPLATE_NAME is not configured.",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as ClubWelcomeBody;
    const recipientPhone = normalizePhoneNumber(cleanText(body.to));
    const customerName = cleanText(body.customerName, "Customer");
    const voucherCode = cleanText(body.voucherCode);
    const voucherAmount = Math.max(0, Number(body.voucherAmount || 100));
    const minimumOrderAmount = Math.max(
      0,
      Number(body.minimumOrderAmount || 1000),
    );
    const expiry = formatExpiry(cleanText(body.expiresAt));

    if (recipientPhone.length < 10 || recipientPhone.length > 15) {
      return NextResponse.json(
        { success: false, error: "Invalid WhatsApp mobile number." },
        { status: 400 },
      );
    }

    if (!voucherCode) {
      return NextResponse.json(
        { success: false, error: "Voucher code is required." },
        { status: 400 },
      );
    }

    const parameters = [
      { type: "text", text: customerName },
      { type: "text", text: voucherCode },
      { type: "text", text: String(voucherAmount.toFixed(0)) },
      { type: "text", text: String(minimumOrderAmount.toFixed(0)) },
      { type: "text", text: expiry },
    ];

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
          to: recipientPhone,
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLanguage },
            components: [
              {
                type: "body",
                parameters,
              },
            ],
          },
        }),
        cache: "no-store",
      },
    );

    const metaData = (await metaResponse.json()) as {
      messages?: Array<{ id?: string; message_status?: string }>;
      error?: { message?: string; code?: number };
    };

    if (!metaResponse.ok || !Array.isArray(metaData.messages) || !metaData.messages.length) {
      console.error("NCS Club WhatsApp error:", metaData);
      return NextResponse.json(
        {
          success: false,
          error: metaData.error?.message || "WhatsApp did not accept the Club message.",
        },
        { status: metaResponse.status || 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "NEW CITY STYLE Club welcome message accepted by WhatsApp.",
      whatsappMessageId: metaData.messages[0]?.id || null,
    });
  } catch (error) {
    console.error("NCS Club welcome route error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected Club WhatsApp error.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "/api/whatsapp/club-welcome",
    templateConfigured: Boolean(
      process.env.WHATSAPP_CLUB_WELCOME_TEMPLATE_NAME,
    ),
  });
}