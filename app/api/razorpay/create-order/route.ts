import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateOrderBody = {
  amount?: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
};

function cleanEnvironmentValue(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\r?\n/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const keyId = cleanEnvironmentValue(
      process.env.RAZORPAY_KEY_ID
    );

    const keySecret = cleanEnvironmentValue(
      process.env.RAZORPAY_KEY_SECRET
    );

    if (!keyId || !keySecret) {
      console.error("Razorpay environment variables are missing.", {
        hasKeyId: Boolean(keyId),
        hasKeySecret: Boolean(keySecret),
      });

      return NextResponse.json(
        {
          error: "Razorpay environment variables are missing.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        }
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
        {
          error: "Invalid payment amount.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const amountInPaise = Math.round(amountInRupees * 100);

    const authorization = Buffer.from(
      `${keyId}:${keySecret}`,
      "utf8"
    ).toString("base64");

    const razorpayResponse = await fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: body.currency?.trim() || "INR",
          receipt:
            body.receipt?.trim() ||
            `ncs_${Date.now()}`,
          notes: body.notes || {},
        }),
        cache: "no-store",
      }
    );

    const razorpayData = await razorpayResponse
      .json()
      .catch(() => null);

    if (!razorpayResponse.ok) {
      console.error("Razorpay order creation failed.", {
        status: razorpayResponse.status,
        errorCode: razorpayData?.error?.code,
        description: razorpayData?.error?.description,
        keyMode: keyId.startsWith("rzp_live_")
          ? "live"
          : keyId.startsWith("rzp_test_")
          ? "test"
          : "unknown",
        keyIdLength: keyId.length,
        keySecretLength: keySecret.length,
      });

      return NextResponse.json(
        {
          error:
            razorpayData?.error?.description ||
            "Unable to create Razorpay order.",
        },
        {
          status: razorpayResponse.status,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      {
        id: razorpayData.id,
        amount: razorpayData.amount,
        currency: razorpayData.currency,
        receipt: razorpayData.receipt,
        keyId,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Create Razorpay order error:", error);

    return NextResponse.json(
      {
        error: "Unable to create payment order.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}