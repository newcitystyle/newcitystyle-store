import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOLLOWUP_MIN_HOURS = 6;
const FOLLOWUP_MAX_HOURS = 72;
const FOLLOWUP_COOLDOWN_DAYS = 7;
const MAX_CANDIDATES_PER_RUN = 25;

type SalesConversation = {
  phone: string;
  last_product_name?: string | null;
  last_brand?: string | null;
  last_category?: string | null;
  last_size?: string | null;
  last_color?: string | null;
  last_price?: number | string | null;
  updated_at?: string | null;
};

type FollowupState = {
  phone: string;
  opted_out?: boolean | null;
  last_sent_at?: string | null;
  last_context_updated_at?: string | null;
  last_kind?: string | null;
  send_count?: number | null;
};

function supabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function authorized(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET?.trim();

  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when configured.
  if (!configuredSecret) {
    return false;
  }

  return (
    request.headers.get("authorization") ===
    `Bearer ${configuredSecret}`
  );
}

function safeDate(value?: string | null): number | null {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : null;
}

function hasShoppingMemory(row: SalesConversation): boolean {
  return Boolean(
    row.last_product_name?.trim() ||
      row.last_brand?.trim() ||
      row.last_category?.trim() ||
      row.last_size?.trim() ||
      row.last_color?.trim() ||
      Number(row.last_price || 0) > 0,
  );
}

function eligibleByAge(row: SalesConversation): boolean {
  const updated = safeDate(row.updated_at);
  if (updated == null) {
    return false;
  }

  const ageMs = Date.now() - updated;
  return (
    ageMs >= FOLLOWUP_MIN_HOURS * 60 * 60 * 1000 &&
    ageMs <= FOLLOWUP_MAX_HOURS * 60 * 60 * 1000
  );
}

function cooldownPassed(state?: FollowupState | null): boolean {
  const sent = safeDate(state?.last_sent_at);
  if (sent == null) {
    return true;
  }

  return (
    Date.now() - sent >=
    FOLLOWUP_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  );
}

async function sendTemplateMessage(phone: string): Promise<string | null> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const apiVersion =
    process.env.WHATSAPP_API_VERSION?.trim() || "v25.0";
  const templateName =
    process.env.WHATSAPP_FOLLOWUP_TEMPLATE_NAME?.trim();
  const languageCode =
    process.env.WHATSAPP_FOLLOWUP_TEMPLATE_LANGUAGE?.trim() || "en";

  if (!accessToken || !phoneNumberId || !templateName) {
    return null;
  }

  const response = await fetch(
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
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
        },
      }),
      cache: "no-store",
    },
  );

  const data = (await response.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };

  if (!response.ok || !data.messages?.length) {
    throw new Error(
      data.error?.message ||
        `WhatsApp follow-up template failed with HTTP ${response.status}.`,
    );
  }

  return data.messages[0]?.id || null;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const admin = supabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_service_credentials_missing" },
      { status: 500 },
    );
  }

  const maxAge = new Date(
    Date.now() - FOLLOWUP_MIN_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const minAge = new Date(
    Date.now() - FOLLOWUP_MAX_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: conversations, error: conversationError } =
    await admin
      .from("whatsapp_sales_conversations")
      .select(
        "phone,last_product_name,last_brand,last_category,last_size,last_color,last_price,updated_at",
      )
      .gte("updated_at", minAge)
      .lte("updated_at", maxAge)
      .order("updated_at", { ascending: true })
      .limit(100);

  if (conversationError) {
    return NextResponse.json(
      {
        ok: false,
        error: "conversation_scan_failed",
        detail: conversationError.message,
      },
      { status: 500 },
    );
  }

  const rows = (conversations || []) as SalesConversation[];
  const phones = rows.map((row) => row.phone).filter(Boolean);

  const statesByPhone = new Map<string, FollowupState>();

  if (phones.length > 0) {
    const { data: states, error: stateError } =
      await admin
        .from("whatsapp_sales_followups")
        .select(
          "phone,opted_out,last_sent_at,last_context_updated_at,last_kind,send_count",
        )
        .in("phone", phones);

    if (stateError) {
      return NextResponse.json(
        {
          ok: false,
          error: "followup_state_scan_failed",
          detail: stateError.message,
          hint: "Run the Stage 9 SQL file first.",
        },
        { status: 500 },
      );
    }

    for (const state of (states || []) as FollowupState[]) {
      statesByPhone.set(state.phone, state);
    }
  }

  const candidates = rows
    .filter((row) => eligibleByAge(row))
    .filter((row) => hasShoppingMemory(row))
    .filter((row) => {
      const state = statesByPhone.get(row.phone);
      return state?.opted_out !== true && cooldownPassed(state);
    })
    .slice(0, MAX_CANDIDATES_PER_RUN);

  const templateConfigured = Boolean(
    process.env.WHATSAPP_FOLLOWUP_TEMPLATE_NAME?.trim(),
  );

  const results: Array<Record<string, unknown>> = [];

  for (const candidate of candidates) {
    const previous = statesByPhone.get(candidate.phone);

    if (!templateConfigured) {
      results.push({
        phoneLast4: candidate.phone.slice(-4),
        sent: false,
        dryRun: true,
        reason: "WHATSAPP_FOLLOWUP_TEMPLATE_NAME_missing",
      });
      continue;
    }

    try {
      const messageId = await sendTemplateMessage(candidate.phone);
      const now = new Date().toISOString();

      const { error: saveError } = await admin
        .from("whatsapp_sales_followups")
        .upsert(
          {
            phone: candidate.phone,
            opted_out: false,
            last_sent_at: now,
            last_context_updated_at: candidate.updated_at || null,
            last_kind: "shopping_reengagement",
            send_count: Math.max(0, Number(previous?.send_count || 0)) + 1,
            updated_at: now,
          },
          { onConflict: "phone" },
        );

      if (saveError) {
        throw saveError;
      }

      results.push({
        phoneLast4: candidate.phone.slice(-4),
        sent: true,
        messageId,
      });
    } catch (error) {
      results.push({
        phoneLast4: candidate.phone.slice(-4),
        sent: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    mode: templateConfigured ? "live" : "dry_run",
    scanned: rows.length,
    eligible: candidates.length,
    results,
  });
}
