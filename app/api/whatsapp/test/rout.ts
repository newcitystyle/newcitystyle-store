import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WhatsAppTestRequest = {
  to?: string;
};

function normalizePhoneNumber(value: string): string {
  return value.replace(/[^\d]/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion =
      process.env.WHATSAPP_API_VERSION || "v25.0";

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WHATSAPP_ACCESS_TOKEN is missing in environment variables.",
        },
        { status: 500 }
      );
    }

    if (!phoneNumberId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WHATSAPP_PHONE_NUMBER_ID is missing in environment variables.",
        },
        { status: 500 }
      );
    }

    let body: WhatsAppTestRequest;

    try {
      body = (await request.json()) as WhatsAppTestRequest;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Request body must be valid JSON.",
        },
        { status: 400 }
      );
    }

    const rawPhoneNumber = body.to?.trim() || "";
    const recipientPhoneNumber =
      normalizePhoneNumber(rawPhoneNumber);

    if (!recipientPhoneNumber) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Recipient phone number is required. Example: 919876543210",
        },
        { status: 400 }
      );
    }

    if (
      recipientPhoneNumber.length < 10 ||
      recipientPhoneNumber.length > 15
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enter a valid phone number with country code.",
        },
        { status: 400 }
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
          recipient_type: "individual",
          to: recipientPhoneNumber,
          type: "template",
          template: {
            name: "hello_world",
            language: {
              code: "en_US",
            },
          },
        }),
        cache: "no-store",
      }
    );

    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error(
        "WhatsApp Cloud API error:",
        JSON.stringify(metaData)
      );

      return NextResponse.json(
        {
          success: false,
          error:
            metaData?.error?.message ||
            "WhatsApp message could not be sent.",
          metaErrorCode:
            metaData?.error?.code || null,
          metaErrorSubcode:
            metaData?.error?.error_subcode || null,
        },
        { status: metaResponse.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "WhatsApp test message sent successfully.",
        whatsappMessageId:
          metaData?.messages?.[0]?.id || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("WhatsApp test route error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      message:
        "NEW CITY STYLE WhatsApp test API is ready. Use POST with a recipient number.",
      exampleBody: {
        to: "919876543210",
      },
    },
    { status: 200 }
  );
}