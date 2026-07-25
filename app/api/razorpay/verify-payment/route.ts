import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type VerifyPaymentBody = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  expected_order_id?: string;
};

export async function POST(request: NextRequest) {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return NextResponse.json(
        { error: "Razorpay secret is missing." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as VerifyPaymentBody;

    const razorpayOrderId = body.razorpay_order_id?.trim();
    const razorpayPaymentId = body.razorpay_payment_id?.trim();
    const razorpaySignature = body.razorpay_signature?.trim();
    const expectedOrderId = body.expected_order_id?.trim();

    if (
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !razorpaySignature ||
      !expectedOrderId
    ) {
      return NextResponse.json(
        { error: "Payment verification details are incomplete." },
        { status: 400 }
      );
    }

    if (razorpayOrderId !== expectedOrderId) {
      return NextResponse.json(
        { error: "Razorpay order ID mismatch." },
        { status: 400 }
      );
    }

    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${expectedOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    const generatedBuffer = Buffer.from(generatedSignature, "utf8");
    const receivedBuffer = Buffer.from(razorpaySignature, "utf8");

    const signatureIsValid =
      generatedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(generatedBuffer, receivedBuffer);

    if (!signatureIsValid) {
      return NextResponse.json(
        { error: "Payment signature verification failed." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
    });
  } catch (error) {
    console.error("Verify Razorpay payment error:", error);

    return NextResponse.json(
      { error: "Unable to verify payment." },
      { status: 500 }
    );
  }
}
