import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  amount?: number;
  customerName?: string;
  customerPhone?: string;
  orderReference?: string;
  description?: string;
};

function cleanEnv(value: string | undefined) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\r?\n/g, "");
}

function normalizePhone(value: unknown) {
  return String(value || "").replace(/[^\d]/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const keyId = cleanEnv(process.env.RAZORPAY_KEY_ID);
    const keySecret = cleanEnv(process.env.RAZORPAY_KEY_SECRET);

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { success: false, error: "Razorpay credentials are missing." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as Body;
    const amount = Number(body.amount || 0);
    const phone = normalizePhone(body.customerPhone);

    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
      return NextResponse.json(
        { success: false, error: "Enter a valid amount." },
        { status: 400 },
      );
    }

    if (!phone || phone.length < 10 || phone.length > 15) {
      return NextResponse.json(
        { success: false, error: "Valid customer phone is required." },
        { status: 400 },
      );
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`, "utf8").toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: "INR",
        accept_partial: false,
        description:
          String(body.description || "").trim() ||
          `NEW CITY STYLE payment${body.orderReference ? ` • ${body.orderReference}` : ""}`,
        customer: {
          name: String(body.customerName || "Customer").trim(),
          contact: phone,
        },
        notify: {
          sms: false,
          email: false,
        },
        reminder_enable: false,
        notes: {
          order_reference: String(body.orderReference || ""),
          source: "NCS_WHATSAPP_LEADS",
        },
      }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            data?.error?.description ||
            data?.error?.reason ||
            "Unable to create Razorpay payment link.",
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      id: data?.id || null,
      shortUrl: data?.short_url || null,
      status: data?.status || null,
      amount: data?.amount || null,
    });
  } catch (error) {
    console.error("NCS Razorpay payment-link error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create payment link.",
      },
      { status: 500 },
    );
  }
}
