import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type CreateOrderBody = {
  amount?: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
};

export async function POST(request: NextRequest) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay environment variables are missing." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as CreateOrderBody;
    const amountInRupees = Number(body.amount);

    if (
      !Number.isFinite(amountInRupees) ||
      amountInRupees <= 0 ||
      amountInRupees > 10000000
    ) {
      return NextResponse.json(
        { error: "Invalid payment amount." },
        { status: 400 }
      );
    }

    const amountInPaise = Math.round(amountInRupees * 100);

    const authorization = Buffer.from(
      `${keyId}:${keySecret}`
    ).toString("base64");

    const razorpayResponse = await fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: body.currency || "INR",
          receipt:
            body.receipt ||
            `ncs_${Date.now()}`,
          notes: body.notes || {},
        }),
        cache: "no-store",
      }
    );

    const razorpayData = await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      console.error("Razorpay order error:", razorpayData);

      return NextResponse.json(
        {
          error:
            razorpayData?.error?.description ||
            "Unable to create Razorpay order.",
        },
        { status: razorpayResponse.status }
      );
    }

    return NextResponse.json({
      id: razorpayData.id,
      amount: razorpayData.amount,
      currency: razorpayData.currency,
      receipt: razorpayData.receipt,
      keyId,
    });
  } catch (error) {
    console.error("Create Razorpay order error:", error);

    return NextResponse.json(
      { error: "Unable to create payment order." },
      { status: 500 }
    );
  }
}
