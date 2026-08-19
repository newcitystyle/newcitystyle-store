import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupabaseSmsHookPayload = {
  user?: { phone?: string | null };
  sms?: { otp?: string | null };
};

function normalizeWhatsAppPhone(value: string): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

function getWebhookSecret(): string {
  const raw = process.env.SUPABASE_SEND_SMS_HOOK_SECRET?.trim();
  if (!raw) {
    throw new Error("SUPABASE_SEND_SMS_HOOK_SECRET is not configured.");
  }
  return raw.replace(/^v1,whsec_/, "");
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const webhook = new Webhook(getWebhookSecret());

    let payload: SupabaseSmsHookPayload;

    try {
      payload = webhook.verify(
        rawBody,
        Object.fromEntries(request.headers.entries())
      ) as SupabaseSmsHookPayload;
    } catch (error) {
      console.error("Invalid Supabase Auth Hook signature:", error);
      return NextResponse.json(
        {
          error: {
            http_code: 401,
            message: "Invalid Supabase Auth Hook signature.",
          },
        },
        { status: 401 }
      );
    }

    const phone = normalizeWhatsAppPhone(String(payload.user?.phone || ""));
    const otp = String(payload.sms?.otp || "").trim();

    if (!phone || !otp) {
      return NextResponse.json(
        {
          error: {
            http_code: 400,
            message: "Phone number or OTP is missing.",
          },
        },
        { status: 400 }
      );
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || "v25.0";
    const templateName =
      process.env.WHATSAPP_LOGIN_OTP_TEMPLATE_NAME?.trim() ||
      "new_city_style_login_otp";
    const templateLanguage =
      process.env.WHATSAPP_LOGIN_OTP_TEMPLATE_LANGUAGE?.trim() || "en";

    if (!accessToken || !phoneNumberId) {
      throw new Error(
        "WhatsApp access token or phone number ID is not configured."
      );
    }

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
          to: phone,
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLanguage },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: otp }],
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [{ type: "text", text: otp }],
              },
            ],
          },
        }),
      }
    );

    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error("WhatsApp OTP Meta API error:", metaData);
      return NextResponse.json(
        {
          error: {
            http_code: metaResponse.status || 500,
            message:
              metaData?.error?.message || "Unable to send WhatsApp OTP.",
          },
        },
        { status: metaResponse.status || 500 }
      );
    }

    return NextResponse.json(
      {},
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("WhatsApp OTP hook error:", error);
    return NextResponse.json(
      {
        error: {
          http_code: 500,
          message:
            error instanceof Error
              ? error.message
              : "Unexpected WhatsApp OTP hook error.",
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "NEW CITY STYLE Supabase WhatsApp OTP Hook",
    configured: {
      hookSecret: Boolean(
        process.env.SUPABASE_SEND_SMS_HOOK_SECRET?.trim()
      ),
      whatsappAccessToken: Boolean(
        process.env.WHATSAPP_ACCESS_TOKEN?.trim()
      ),
      whatsappPhoneNumberId: Boolean(
        process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
      ),
      templateName:
        process.env.WHATSAPP_LOGIN_OTP_TEMPLATE_NAME?.trim() ||
        "new_city_style_login_otp",
      templateLanguage:
        process.env.WHATSAPP_LOGIN_OTP_TEMPLATE_LANGUAGE?.trim() || "en",
    },
  });
}