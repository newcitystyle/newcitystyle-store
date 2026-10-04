import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  installationId?: string;
  fcmToken?: string;
  phone?: string;
  email?: string;
  enabled?: boolean;
  appVersion?: string;
  platform?: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePhone(value: unknown) {
  return clean(value).replace(/\D/g, "").slice(-10);
}

function normalizeEmail(value: unknown) {
  return clean(value).toLowerCase();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function createServerSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Supabase server credentials are missing.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Payload;

    const installationId = clean(body.installationId);
    const fcmToken = clean(body.fcmToken);
    const phone = normalizePhone(body.phone);
    const email = normalizeEmail(body.email);
    const enabled = body.enabled !== false;

    if (!isUuid(installationId)) {
      return NextResponse.json(
        { success: false, error: "Valid installationId is required." },
        { status: 400 }
      );
    }

    if (fcmToken.length < 40 || fcmToken.length > 4096) {
      return NextResponse.json(
        { success: false, error: "Valid FCM token is required." },
        { status: 400 }
      );
    }

    if (phone && phone.length !== 10) {
      return NextResponse.json(
        { success: false, error: "Phone must resolve to 10 digits." },
        { status: 400 }
      );
    }

    const phoneHash = phone ? sha256(phone) : null;
    const emailHash = email ? sha256(email) : null;

    const supabase = createServerSupabase();

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("customer_native_push_devices")
      .upsert(
        {
          installation_id: installationId,
          fcm_token: fcmToken,
          phone_hash: phoneHash,
          email_hash: emailHash,
          notifications_enabled: enabled,
          platform: clean(body.platform) || "android",
          app_version: clean(body.appVersion) || null,
          last_seen_at: now,
          last_error: null,
          updated_at: now,
        },
        {
          onConflict: "installation_id",
        }
      );

    if (error) throw error;

    return NextResponse.json({
      success: true,
      registered: true,
      enabled,
      identity: {
        phoneLinked: Boolean(phoneHash),
        emailLinked: Boolean(emailHash),
      },
    });
  } catch (error) {
    console.error("NCS native device registration error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to register native push device.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "NCS Native Customer Device Registration",
    configured: {
      supabaseServer: Boolean(
        (
          process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
          process.env.SUPABASE_URL?.trim()
        ) &&
          (
            process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
            process.env.SUPABASE_SERVICE_KEY?.trim()
          )
      ),
    },
  });
}
