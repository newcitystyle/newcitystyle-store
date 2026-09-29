import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function adminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function safeAmount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100) / 100;
}

function cleanRef(value: unknown) {
  return String(value || "").trim().slice(0, 120);
}

function cleanUtr(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .slice(0, 40);
}

export async function POST(request: NextRequest) {
  const admin = adminClient();

  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Payment verification service is unavailable." },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const amount = safeAmount(body?.amount);
    const reference = cleanRef(body?.reference);
    const utr = cleanUtr(body?.utr);

    if (!amount || !reference) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment amount / reference is missing.",
        },
        { status: 400 },
      );
    }

    if (!/^[A-Za-z0-9]{8,40}$/.test(utr)) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid UTR / transaction reference enter చేయండి.",
        },
        { status: 400 },
      );
    }

    const { data: payment, error: findError } = await admin
      .from("ncs_whatsapp_payment_requests")
      .select("id,status,verification_status,amount,order_reference")
      .eq("order_reference", reference)
      .in("status", ["PENDING", "SENT"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      throw new Error(findError.message);
    }

    if (!payment) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Matching payment request కనిపించలేదు. NEW CITY STYLEను contact చేయండి.",
        },
        { status: 404 },
      );
    }

    if (Math.abs(Number(payment.amount || 0) - amount) > 0.01) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment amount does not match this request.",
        },
        { status: 400 },
      );
    }

    const { data: duplicate } = await admin
      .from("ncs_whatsapp_payment_requests")
      .select("id")
      .eq("utr_number", utr)
      .neq("id", payment.id)
      .limit(1);

    if ((duplicate || []).length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ఈ UTR ఇప్పటికే submit చేయబడింది.",
        },
        { status: 409 },
      );
    }

    const { error: updateError } = await admin
      .from("ncs_whatsapp_payment_requests")
      .update({
        utr_number: utr,
        verification_status: "SUBMITTED",
        proof_submitted_at: new Date().toISOString(),
        verification_note: "Customer submitted UTR from direct UPI payment page.",
      })
      .eq("id", payment.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      success: true,
      message:
        "Payment reference received. NEW CITY STYLE will verify it shortly.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to submit payment reference.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "/api/whatsapp/payment-proof",
    method: "POST",
    stage: 14,
  });
}
