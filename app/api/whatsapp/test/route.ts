import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WhatsAppBillRequest = {
  to?: string;
  customerName?: string;
  billNumber?: string;
  billAmount?: string | number;
  paidAmount?: string | number;
  dueAmount?: string | number;
  paymentMethod?: string;
};

type MetaErrorResponse = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
    fbtrace_id?: string;
  };
};

type MetaSuccessResponse = {
  messages?: Array<{
    id?: string;
    message_status?: string;
  }>;
  contacts?: Array<{
    input?: string;
    wa_id?: string;
  }>;
};

function normalizePhoneNumber(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

function normalizeAmount(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "").trim();
    const parsed = Number(cleaned);

    if (cleaned && Number.isFinite(parsed)) {
      return parsed.toFixed(2);
    }
  }

  return "0.00";
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v25.0";

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

    let body: WhatsAppBillRequest;

    try {
      body = (await request.json()) as WhatsAppBillRequest;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Request body must be valid JSON.",
        },
        { status: 400 }
      );
    }

    const recipientPhoneNumber = normalizePhoneNumber(body.to?.trim() || "");

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
          error: "Enter a valid phone number with country code.",
        },
        { status: 400 }
      );
    }

    const customerName = normalizeText(body.customerName, "Customer");
    const billNumber = normalizeText(body.billNumber, "NCS-BILL");
    const billAmount = normalizeAmount(body.billAmount);
    const paidAmount = normalizeAmount(body.paidAmount);
    const dueAmount = normalizeAmount(body.dueAmount);
    const paymentMethod = normalizeText(body.paymentMethod, "Cash");

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
            name: "new_city_style_bill_confirmation",
            language: {
              code: "en_US",
            },
            components: [
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
        }),
        cache: "no-store",
      }
    );

    const metaData = (await metaResponse.json()) as
      | MetaSuccessResponse
      | MetaErrorResponse;

    if (!metaResponse.ok) {
      const metaError = (metaData as MetaErrorResponse).error;

      console.error(
        "WhatsApp Cloud API error:",
        JSON.stringify(metaData)
      );

      return NextResponse.json(
        {
          success: false,
          error:
            metaError?.message ||
            "WhatsApp bill confirmation could not be sent.",
          metaErrorCode: metaError?.code || null,
          metaErrorSubcode: metaError?.error_subcode || null,
          metaErrorType: metaError?.type || null,
          fbtraceId: metaError?.fbtrace_id || null,
        },
        { status: metaResponse.status }
      );
    }

    const successData = metaData as MetaSuccessResponse;

    return NextResponse.json(
      {
        success: true,
        message:
          "NEW CITY STYLE bill confirmation sent successfully.",
        whatsappMessageId: successData.messages?.[0]?.id || null,
        messageStatus:
          successData.messages?.[0]?.message_status || null,
        recipientWhatsAppId:
          successData.contacts?.[0]?.wa_id || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("WhatsApp bill route error:", error);

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
        "NEW CITY STYLE WhatsApp bill confirmation API is ready.",
      templateName: "new_city_style_bill_confirmation",
      exampleBody: {
        to: "919876543210",
        customerName: "Badri",
        billNumber: "NCS-1001",
        billAmount: 2500,
        paidAmount: 2000,
        dueAmount: 500,
        paymentMethod: "Cash",
      },
    },
    { status: 200 }
  );
}