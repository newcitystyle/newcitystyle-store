import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LeadRow = {
  id: string;
  phone: string;
  customer_name: string | null;
  lead_score: number | null;
  lead_temperature: "HOT" | "WARM" | "COLD" | null;
  status: "ACTIVE" | "WON" | "LOST" | "ARCHIVED" | null;
  primary_interest: string | null;
  interested_category: string | null;
  interested_product_name: string | null;
  booking_intent_count: number | null;
  needs_human_followup: boolean | null;
  last_seen_at: string | null;
};

type PaymentRow = {
  id: string;
  phone: string;
  customer_name: string | null;
  amount: number | string | null;
  order_reference: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
};

type SettingsRow = {
  enabled: boolean;
  auto_low_risk: boolean;
  lead_followup_after_minutes: number;
  booking_followup_after_minutes: number;
  payment_reminder_after_minutes: number;
  max_auto_sends_per_run: number;
};

function adminClient(): SupabaseClient | null {
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

function digits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function minutesSince(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - t) / 60000);
}

function withinWhatsAppWindow(value: string | null | undefined) {
  const mins = minutesSince(value);
  return mins >= 0 && mins <= 24 * 60;
}

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function safeName(value: string | null | undefined) {
  return String(value || "").trim() || "Customer";
}

function safeAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function authorize(request: NextRequest, admin: SupabaseClient) {
  const bearer = request.headers.get("authorization") || "";
  const token = bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : "";

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && token && token === cronSecret) {
    return { ok: true, actor: "VERCEL_CRON" };
  }

  if (!token) {
    return { ok: false, actor: "" };
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, actor: "" };
  }

  return {
    ok: true,
    actor: data.user.email || data.user.id,
  };
}

async function sendWhatsAppText(to: string, message: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || "v25.0";

  if (!accessToken || !phoneNumberId) {
    throw new Error(
      "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID.",
    );
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
        to: digits(to),
        type: "text",
        text: {
          preview_url: false,
          body: message.slice(0, 4096),
        },
      }),
      cache: "no-store",
    },
  );

  const data = await response.json();

  if (!response.ok || !Array.isArray(data?.messages) || !data.messages[0]?.id) {
    throw new Error(
      data?.error?.message ||
        data?.error?.error_data?.details ||
        `WhatsApp send failed with HTTP ${response.status}.`,
    );
  }

  return String(data.messages[0].id);
}

async function queueCandidate(
  admin: SupabaseClient,
  row: {
    source_key: string;
    lead_id?: string | null;
    payment_request_id?: string | null;
    phone: string;
    customer_name?: string | null;
    automation_type: "LEAD_FOLLOWUP" | "BOOKING_FOLLOWUP" | "PAYMENT_REMINDER";
    risk_level: "LOW" | "MEDIUM" | "SENSITIVE";
    status: "PENDING" | "APPROVAL";
    message_text: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await admin
    .from("ncs_whatsapp_automation_queue")
    .upsert(
      {
        ...row,
        due_at: new Date().toISOString(),
        metadata: row.metadata || {},
      },
      {
        onConflict: "source_key",
        ignoreDuplicates: true,
      },
    );

  if (error) {
    throw new Error(`Unable to queue automation: ${error.message}`);
  }
}

async function runAutopilot(admin: SupabaseClient) {
  const { data: settingsData, error: settingsError } = await admin
    .from("ncs_whatsapp_automation_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const settings: SettingsRow = {
    enabled: settingsData?.enabled !== false,
    auto_low_risk: settingsData?.auto_low_risk !== false,
    lead_followup_after_minutes: Number(
      settingsData?.lead_followup_after_minutes || 120,
    ),
    booking_followup_after_minutes: Number(
      settingsData?.booking_followup_after_minutes || 90,
    ),
    payment_reminder_after_minutes: Number(
      settingsData?.payment_reminder_after_minutes || 180,
    ),
    max_auto_sends_per_run: Math.max(
      1,
      Math.min(20, Number(settingsData?.max_auto_sends_per_run || 5)),
    ),
  };

  if (!settings.enabled) {
    return {
      enabled: false,
      queued: 0,
      sent: 0,
      approvals: 0,
    };
  }

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const [leadResult, paymentResult, recentOutboundResult] = await Promise.all([
    admin
      .from("ncs_whatsapp_leads")
      .select(
        "id,phone,customer_name,lead_score,lead_temperature,status,primary_interest,interested_category,interested_product_name,booking_intent_count,needs_human_followup,last_seen_at",
      )
      .eq("status", "ACTIVE")
      .order("last_seen_at", { ascending: false })
      .limit(300),

    admin
      .from("ncs_whatsapp_payment_requests")
      .select(
        "id,phone,customer_name,amount,order_reference,status,created_at,sent_at",
      )
      .in("status", ["PENDING", "SENT"])
      .order("created_at", { ascending: false })
      .limit(150),

    admin
      .from("ncs_whatsapp_automation_queue")
      .select("phone,sent_at")
      .eq("status", "SENT")
      .gte("sent_at", sixHoursAgo)
      .limit(500),
  ]);

  if (leadResult.error) throw new Error(leadResult.error.message);
  if (paymentResult.error) throw new Error(paymentResult.error.message);
  if (recentOutboundResult.error) throw new Error(recentOutboundResult.error.message);

  const leads = (leadResult.data || []) as LeadRow[];
  const payments = (paymentResult.data || []) as PaymentRow[];
  const recentlyMessaged = new Set(
    (recentOutboundResult.data || []).map((x: { phone: string }) => digits(x.phone)),
  );

  const leadByPhone = new Map<string, LeadRow>();
  for (const lead of leads) {
    leadByPhone.set(digits(lead.phone), lead);
  }

  let queued = 0;

  for (const lead of leads) {
    const phone = digits(lead.phone);
    const idleMinutes = minutesSince(lead.last_seen_at);

    if (!phone || !withinWhatsAppWindow(lead.last_seen_at)) continue;
    if (recentlyMessaged.has(phone)) continue;

    const interest =
      lead.interested_product_name ||
      lead.interested_category ||
      lead.primary_interest ||
      "our collection";

    const warmEnough =
      lead.lead_temperature === "HOT" ||
      lead.lead_temperature === "WARM" ||
      Number(lead.lead_score || 0) >= 35;

    if (
      warmEnough &&
      idleMinutes >= settings.lead_followup_after_minutes
    ) {
      await queueCandidate(admin, {
        source_key: `LEAD_FOLLOWUP:${lead.id}:${dayKey()}`,
        lead_id: lead.id,
        phone,
        customer_name: lead.customer_name,
        automation_type: "LEAD_FOLLOWUP",
        risk_level: "LOW",
        status: "PENDING",
        message_text:
          `Hi ${safeName(lead.customer_name)} 👋\n\n` +
          `You were checking ${interest} at NEW CITY STYLE. ` +
          `Need help with size, colour or price? Reply here and we’ll help.`,
        metadata: {
          interest,
          stage: 14,
        },
      });
      queued += 1;
    }

    if (
      Number(lead.booking_intent_count || 0) > 0 &&
      idleMinutes >= settings.booking_followup_after_minutes
    ) {
      await queueCandidate(admin, {
        source_key: `BOOKING_FOLLOWUP:${lead.id}:${dayKey()}`,
        lead_id: lead.id,
        phone,
        customer_name: lead.customer_name,
        automation_type: "BOOKING_FOLLOWUP",
        risk_level: "MEDIUM",
        status: "APPROVAL",
        message_text:
          `Hi ${safeName(lead.customer_name)} 👋\n\n` +
          `You had shown interest in booking ${interest} at NEW CITY STYLE. ` +
          `Would you like us to keep it aside for you?`,
        metadata: {
          interest,
          stage: 14,
        },
      });
      queued += 1;
    }
  }

  for (const payment of payments) {
    const phone = digits(payment.phone);
    const lead = leadByPhone.get(phone);
    const ageMinutes = minutesSince(payment.sent_at || payment.created_at);

    if (!phone) continue;
    if (!lead || !withinWhatsAppWindow(lead.last_seen_at)) continue;
    if (ageMinutes < settings.payment_reminder_after_minutes) continue;

    const amount = safeAmount(payment.amount);
    const ref = String(payment.order_reference || "").trim();

    await queueCandidate(admin, {
      source_key: `PAYMENT_REMINDER:${payment.id}:${dayKey()}`,
      lead_id: lead.id,
      payment_request_id: payment.id,
      phone,
      customer_name: payment.customer_name || lead.customer_name,
      automation_type: "PAYMENT_REMINDER",
      risk_level: "SENSITIVE",
      status: "APPROVAL",
      message_text:
        `Hi ${safeName(payment.customer_name || lead.customer_name)},\n\n` +
        `💳 NEW CITY STYLE payment reminder.\n` +
        `Amount: ₹${amount.toLocaleString("en-IN")}` +
        `${ref ? `\nReference: ${ref}` : ""}\n\n` +
        `Please complete the payment when convenient.`,
      metadata: {
        amount,
        order_reference: ref,
        stage: 14,
      },
    });
    queued += 1;
  }

  let sent = 0;
  let failed = 0;

  if (settings.auto_low_risk) {
    const { data: pending, error: pendingError } = await admin
      .from("ncs_whatsapp_automation_queue")
      .select("id,phone,message_text,lead_id")
      .eq("status", "PENDING")
      .eq("risk_level", "LOW")
      .lte("due_at", new Date().toISOString())
      .order("due_at", { ascending: true })
      .limit(settings.max_auto_sends_per_run);

    if (pendingError) throw new Error(pendingError.message);

    for (const item of pending || []) {
      try {
        let canSend = true;

        if (item.lead_id) {
          const { data: lead } = await admin
            .from("ncs_whatsapp_leads")
            .select("last_seen_at")
            .eq("id", item.lead_id)
            .maybeSingle();

          canSend = withinWhatsAppWindow(lead?.last_seen_at || null);
        }

        if (!canSend) {
          await admin
            .from("ncs_whatsapp_automation_queue")
            .update({
              status: "SKIPPED",
              last_error: "24-hour WhatsApp customer-service window expired.",
            })
            .eq("id", item.id);
          continue;
        }

        const metaMessageId = await sendWhatsAppText(
          String(item.phone),
          String(item.message_text),
        );

        await admin
          .from("ncs_whatsapp_automation_queue")
          .update({
            status: "SENT",
            sent_at: new Date().toISOString(),
            meta_message_id: metaMessageId,
            last_error: null,
          })
          .eq("id", item.id);

        sent += 1;
      } catch (error) {
        await admin
          .from("ncs_whatsapp_automation_queue")
          .update({
            status: "FAILED",
            last_error:
              error instanceof Error ? error.message : "Unknown send error.",
          })
          .eq("id", item.id);

        failed += 1;
      }
    }
  }

  const { count: approvalCount } = await admin
    .from("ncs_whatsapp_automation_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "APPROVAL");

  return {
    enabled: true,
    queued,
    sent,
    failed,
    approvals: approvalCount || 0,
  };
}

async function sendApprovedItem(
  admin: SupabaseClient,
  itemId: string,
  actor: string,
) {
  const { data: item, error } = await admin
    .from("ncs_whatsapp_automation_queue")
    .select("id,phone,message_text,lead_id,status")
    .eq("id", itemId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!item) throw new Error("Automation item not found.");
  if (item.status !== "APPROVAL" && item.status !== "FAILED") {
    throw new Error("This automation item is not waiting for approval.");
  }

  if (item.lead_id) {
    const { data: lead } = await admin
      .from("ncs_whatsapp_leads")
      .select("last_seen_at")
      .eq("id", item.lead_id)
      .maybeSingle();

    if (!withinWhatsAppWindow(lead?.last_seen_at || null)) {
      throw new Error(
        "24-hour WhatsApp window ముగిసింది. Approved template అవసరం.",
      );
    }
  }

  const metaMessageId = await sendWhatsAppText(
    String(item.phone),
    String(item.message_text),
  );

  const now = new Date().toISOString();

  const { error: updateError } = await admin
    .from("ncs_whatsapp_automation_queue")
    .update({
      status: "SENT",
      sent_at: now,
      approved_at: now,
      approved_by: actor,
      meta_message_id: metaMessageId,
      last_error: null,
    })
    .eq("id", item.id);

  if (updateError) throw new Error(updateError.message);

  return { id: item.id, metaMessageId };
}

async function handle(request: NextRequest, isCron: boolean) {
  const admin = adminClient();

  if (!admin) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Supabase service credentials are missing.",
      },
      { status: 500 },
    );
  }

  const auth = await authorize(request, admin);

  if (!auth.ok) {
    return NextResponse.json(
      {
        success: false,
        error:
          isCron && !process.env.CRON_SECRET
            ? "CRON_SECRET is not configured."
            : "Unauthorized.",
      },
      { status: 401 },
    );
  }

  try {
    if (isCron) {
      const result = await runAutopilot(admin);
      return NextResponse.json({ success: true, ...result });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "RUN").trim().toUpperCase();

    if (action === "RUN") {
      const result = await runAutopilot(admin);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "SEND_QUEUE_ITEM") {
      const itemId = String(body?.itemId || "").trim();
      if (!itemId) {
        return NextResponse.json(
          { success: false, error: "itemId is required." },
          { status: 400 },
        );
      }

      const result = await sendApprovedItem(admin, itemId, auth.actor);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "DISMISS_QUEUE_ITEM") {
      const itemId = String(body?.itemId || "").trim();
      if (!itemId) {
        return NextResponse.json(
          { success: false, error: "itemId is required." },
          { status: 400 },
        );
      }

      const { error } = await admin
        .from("ncs_whatsapp_automation_queue")
        .update({
          status: "CANCELLED",
          approved_by: auth.actor,
          approved_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (error) throw new Error(error.message);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Stage 14 autopilot failed.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request, true);
}

export async function POST(request: NextRequest) {
  return handle(request, false);
}
