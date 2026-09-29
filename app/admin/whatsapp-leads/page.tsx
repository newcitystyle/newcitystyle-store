"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type LeadTemperature = "HOT" | "WARM" | "COLD";
type LeadStatus = "ACTIVE" | "WON" | "LOST" | "ARCHIVED";
type LeadFilter = "ALL" | "HOT" | "WARM" | "COLD" | "FOLLOWUP" | "WON";

type ActionType =
  | "CUSTOM"
  | "ORDER_CONFIRM"
  | "ORDER_CANCEL"
  | "ORDER_READY"
  | "PAYMENT_REMINDER"
  | "BOOKING_CONFIRM"
  | "THANK_YOU";

type PaymentMethod = "RAZORPAY_LINK" | "UPI_LINK" | "UPI_QR";

type WhatsappLead = {
  id: string;
  phone: string;
  customer_name: string | null;
  lead_score: number | null;
  lead_temperature: LeadTemperature | null;
  status: LeadStatus | null;
  primary_interest: string | null;
  interested_category: string | null;
  interested_product_name: string | null;
  requested_size: string | null;
  requested_colour: string | null;
  last_intent: string | null;
  last_message_text: string | null;
  last_seen_at: string | null;
  total_messages: number | null;
  booking_intent_count: number | null;
  price_intent_count: number | null;
  size_intent_count: number | null;
  stock_intent_count: number | null;
  needs_human_followup: boolean | null;
  followup_reason: string | null;
};

type DemandRow = {
  category: string | null;
  demand_events: number | string | null;
  unique_customers: number | string | null;
  booking_signals: number | string | null;
  stock_signals: number | string | null;
};

type OutboundRow = {
  id: string;
  phone: string;
  customer_name: string | null;
  action_type: string;
  message_text: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
};

type PaymentRequestRow = {
  id: string;
  phone: string;
  customer_name: string | null;
  amount: number | string | null;
  order_reference: string | null;
  payment_method: PaymentMethod;
  payment_link: string | null;
  upi_link: string | null;
  status: "PENDING" | "SENT" | "PAID" | "FAILED" | "CANCELLED";
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
  utr_number?: string | null;
  verification_status?: "NONE" | "SUBMITTED" | "VERIFIED" | "REJECTED" | null;
  proof_submitted_at?: string | null;
  verified_at?: string | null;
  verification_note?: string | null;
};

type AutomationQueueRow = {
  id: string;
  source_key: string;
  lead_id: string | null;
  payment_request_id: string | null;
  phone: string;
  customer_name: string | null;
  automation_type: "LEAD_FOLLOWUP" | "BOOKING_FOLLOWUP" | "PAYMENT_REMINDER" | "CUSTOM";
  risk_level: "LOW" | "MEDIUM" | "SENSITIVE";
  status: "PENDING" | "APPROVAL" | "SENT" | "FAILED" | "SKIPPED" | "CANCELLED";
  message_text: string;
  due_at: string;
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
};

type AutomationSettings = {
  id: number;
  enabled: boolean;
  auto_low_risk: boolean;
  lead_followup_after_minutes: number;
  booking_followup_after_minutes: number;
  payment_reminder_after_minutes: number;
  max_auto_sends_per_run: number;
};

const PAGE_SIZE = 8;

const ACTIONS: Array<{ id: ActionType; label: string; icon: string }> = [
  { id: "ORDER_CONFIRM", label: "Order Confirm", icon: "✅" },
  { id: "ORDER_READY", label: "Order Ready", icon: "🛍️" },
  { id: "BOOKING_CONFIRM", label: "Booking Confirm", icon: "📌" },
  { id: "PAYMENT_REMINDER", label: "Payment Reminder", icon: "💳" },
  { id: "ORDER_CANCEL", label: "Order Cancel", icon: "❌" },
  { id: "THANK_YOU", label: "Thank You", icon: "❤️" },
  { id: "CUSTOM", label: "Custom Message", icon: "✍️" },
];

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nameOf(lead: WhatsappLead) {
  return String(lead.customer_name || "").trim() || "WhatsApp Customer";
}

function fmt(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function windowActive(lastSeen: string | null) {
  if (!lastSeen) return false;
  const t = new Date(lastSeen).getTime();
  if (!Number.isFinite(t)) return false;
  const age = Date.now() - t;
  return age >= 0 && age <= 24 * 60 * 60 * 1000;
}

function preset(action: ActionType, name: string) {
  switch (action) {
    case "ORDER_CONFIRM":
      return `Hi ${name} 👋\n\n✅ Your order with NEW CITY STYLE is confirmed.\n\nThank you for shopping with us.`;
    case "ORDER_CANCEL":
      return `Hi ${name},\n\n❌ Your order with NEW CITY STYLE has been cancelled as requested.\n\nMessage us anytime if you need another size, colour or style.`;
    case "ORDER_READY":
      return `Hi ${name} 👋\n\n🛍️ Your NEW CITY STYLE order is READY.\n\nYou can visit the store / collect your order.`;
    case "PAYMENT_REMINDER":
      return `Hi ${name},\n\n💳 Friendly payment reminder from NEW CITY STYLE.\n\nPlease complete the pending payment when convenient.`;
    case "BOOKING_CONFIRM":
      return `Hi ${name} 👋\n\n✅ Your item booking at NEW CITY STYLE is confirmed.`;
    case "THANK_YOU":
      return `Thank you ${name} ❤️\n\nNEW CITY STYLE appreciates your visit and support.`;
    default:
      return "";
  }
}

function createReference() {
  const d = new Date();
  const date =
    String(d.getFullYear()).slice(-2) +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");

  const suffix = String(Date.now()).slice(-6);
  return `NCS-WA-${date}-${suffix}`;
}

export default function WhatsappLeadsPage() {
  const [leads, setLeads] = useState<WhatsappLead[]>([]);
  const [demand, setDemand] = useState<DemandRow[]>([]);
  const [history, setHistory] = useState<OutboundRow[]>([]);
  const [payments, setPayments] = useState<PaymentRequestRow[]>([]);
  const [automationQueue, setAutomationQueue] = useState<AutomationQueueRow[]>([]);
  const [automationSettings, setAutomationSettings] =
    useState<AutomationSettings | null>(null);

  const [filter, setFilter] = useState<LeadFilter>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [selectedLead, setSelectedLead] = useState<WhatsappLead | null>(null);
  const [mode, setMode] = useState<"ACTION" | "PAYMENT" | "HISTORY">("ACTION");

  const [action, setAction] = useState<ActionType>("ORDER_CONFIRM");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [payAmount, setPayAmount] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI_QR");
  const [generatedPaymentLink, setGeneratedPaymentLink] = useState("");

  const [showPayments, setShowPayments] = useState(false);
  const [showAutopilot, setShowAutopilot] = useState(true);
  const [autopilotBusy, setAutopilotBusy] = useState(false);
  const [autopilotNotice, setAutopilotNotice] = useState("");

  async function loadData() {
    setLoading(true);

    const [a, b, c, d, e, f] = await Promise.all([
      supabase
        .from("ncs_whatsapp_leads")
        .select("*")
        .order("lead_score", { ascending: false })
        .order("last_seen_at", { ascending: false })
        .limit(500),

      supabase
        .from("ncs_whatsapp_demand_30d")
        .select("*")
        .neq("category", "UNCLASSIFIED")
        .order("demand_events", { ascending: false })
        .limit(12),

      supabase
        .from("ncs_whatsapp_outbound_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80),

      supabase
        .from("ncs_whatsapp_payment_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(120),

      supabase
        .from("ncs_whatsapp_automation_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(120),

      supabase
        .from("ncs_whatsapp_automation_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    if (!a.error) setLeads((a.data as WhatsappLead[]) || []);
    if (!b.error) setDemand((b.data as DemandRow[]) || []);
    if (!c.error) setHistory((c.data as OutboundRow[]) || []);
    if (!d.error) setPayments((d.data as PaymentRequestRow[]) || []);
    if (!e.error) setAutomationQueue((e.data as AutomationQueueRow[]) || []);
    if (!f.error && f.data) setAutomationSettings(f.data as AutomationSettings);

    setLoading(false);
  }

  useEffect(() => {
    void loadData();

    const channel = supabase
      .channel("ncs-stage14-whatsapp-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ncs_whatsapp_leads" },
        () => void loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ncs_whatsapp_payment_requests" },
        () => void loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ncs_whatsapp_automation_queue" },
        () => void loadData(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const metrics = useMemo(() => {
    const hot = leads.filter((x) => x.lead_temperature === "HOT").length;
    const warm = leads.filter((x) => x.lead_temperature === "WARM").length;
    const followup = leads.filter((x) => Boolean(x.needs_human_followup)).length;
    const pendingPayments = payments.filter(
      (x) => x.status === "PENDING" || x.status === "SENT",
    ).length;
    const verifyPayments = payments.filter(
      (x) => x.verification_status === "SUBMITTED",
    ).length;
    const approvals = automationQueue.filter((x) => x.status === "APPROVAL").length;

    return {
      total: leads.length,
      hot,
      warm,
      followup,
      pendingPayments,
      verifyPayments,
      approvals,
    };
  }, [leads, payments, automationQueue]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return leads.filter((lead) => {
      if (filter === "HOT" && lead.lead_temperature !== "HOT") return false;
      if (filter === "WARM" && lead.lead_temperature !== "WARM") return false;
      if (filter === "COLD" && lead.lead_temperature !== "COLD") return false;
      if (filter === "FOLLOWUP" && !lead.needs_human_followup) return false;
      if (filter === "WON" && lead.status !== "WON") return false;

      if (!q) return true;

      return [
        lead.customer_name,
        lead.phone,
        lead.primary_interest,
        lead.interested_category,
        lead.interested_product_name,
        lead.last_message_text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [filter, leads, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const visibleLeads = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const selectedTimeline = useMemo(() => {
    if (!selectedLead) return [];

    const phone = selectedLead.phone;

    const outbound = history
      .filter((x) => x.phone === phone)
      .map((x) => ({
        id: `O-${x.id}`,
        at: x.sent_at || x.created_at,
        type: "MESSAGE",
        title: x.action_type.replaceAll("_", " "),
        detail: x.message_text || x.status,
      }));

    const pay = payments
      .filter((x) => x.phone === phone)
      .map((x) => ({
        id: `P-${x.id}`,
        at: x.sent_at || x.created_at,
        type: "PAYMENT",
        title: `₹${n(x.amount).toLocaleString("en-IN")} • ${x.status}`,
        detail:
          `${x.payment_method.replaceAll("_", " ")}` +
          `${x.order_reference ? ` • ${x.order_reference}` : ""}` +
          `${x.utr_number ? ` • UTR ${x.utr_number}` : ""}`,
      }));

    return [...outbound, ...pay]
      .sort(
        (a, b) =>
          new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime(),
      )
      .slice(0, 24);
  }, [history, payments, selectedLead]);

  function openAction(
    lead: WhatsappLead,
    actionType: ActionType = "ORDER_CONFIRM",
  ) {
    setSelectedLead(lead);
    setMode("ACTION");
    setAction(actionType);
    setMessage(preset(actionType, nameOf(lead)));
    setNotice("");
    setError("");
  }

  function openPayment(lead: WhatsappLead) {
    setSelectedLead(lead);
    setMode("PAYMENT");
    setPayAmount("");
    setOrderRef(createReference());
    setPayNote("");
    setGeneratedPaymentLink("");
    setPaymentMethod("UPI_QR");
    setNotice("");
    setError("");
  }

  async function sendAction() {
    if (!selectedLead || !message.trim()) return;

    setSending(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/whatsapp/customer-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedLead.phone,
          customerName: nameOf(selectedLead),
          leadId: selectedLead.id,
          action,
          message: message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(
          data.templateRequired
            ? "24-hour window ముగిసింది. Approved WhatsApp template అవసరం."
            : data.error || "Message send కాలేదు.",
        );
        return;
      }

      setNotice("Message WhatsAppలో పంపబడింది.");
      await loadData();
    } finally {
      setSending(false);
    }
  }

  async function generateRazorpayLink() {
    if (!selectedLead) return;

    const amount = Number(payAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Valid payment amount enter చేయండి.");
      return;
    }

    setSending(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/razorpay/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          customerName: nameOf(selectedLead),
          customerPhone: selectedLead.phone,
          orderReference: orderRef.trim() || createReference(),
          description:
            payNote.trim() ||
            `NEW CITY STYLE payment${orderRef.trim() ? ` • ${orderRef.trim()}` : ""}`,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.shortUrl) {
        setError(data.error || "Razorpay payment link create కాలేదు.");
        return;
      }

      setGeneratedPaymentLink(data.shortUrl);
      setNotice("Razorpay payment link ready.");
    } finally {
      setSending(false);
    }
  }

  async function sendPaymentRequest() {
    if (!selectedLead) return;

    const amount = Number(payAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Valid payment amount enter చేయండి.");
      return;
    }

    const finalRef = orderRef.trim() || createReference();
    if (!orderRef.trim()) setOrderRef(finalRef);

    if (paymentMethod === "RAZORPAY_LINK" && !generatedPaymentLink) {
      setError("ముందుగా Razorpay Link Generate చేయండి.");
      return;
    }

    setSending(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/whatsapp/customer-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedLead.phone,
          customerName: nameOf(selectedLead),
          leadId: selectedLead.id,
          action: "PAYMENT_REQUEST",
          amount,
          orderReference: finalRef,
          paymentMethod,
          paymentLink: generatedPaymentLink,
          message: payNote.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(
          data.templateRequired
            ? "24-hour window ముగిసింది. Approved WhatsApp template అవసరం."
            : data.error || "Payment request send కాలేదు.",
        );
        return;
      }

      setNotice(
        data.qrWarning
          ? `Payment link పంపబడింది. QR image warning: ${data.qrWarning}`
          : "Payment request customer WhatsAppకి పంపబడింది.",
      );

      await loadData();
    } finally {
      setSending(false);
    }
  }

  async function updatePaymentVerification(
    row: PaymentRequestRow,
    mode: "VERIFY" | "REJECT",
  ) {
    const verified = mode === "VERIFY";

    const { error: updateError } = await supabase
      .from("ncs_whatsapp_payment_requests")
      .update(
        verified
          ? {
              status: "PAID",
              verification_status: "VERIFIED",
              paid_at: new Date().toISOString(),
              verified_at: new Date().toISOString(),
              verified_by: "NCS ADMIN",
              verification_note: "UTR verified by admin.",
            }
          : {
              verification_status: "REJECTED",
              verified_at: new Date().toISOString(),
              verified_by: "NCS ADMIN",
              verification_note: "UTR rejected by admin.",
            },
      )
      .eq("id", row.id);

    if (updateError) {
      alert(updateError.message);
      return;
    }

    await loadData();
  }

  async function markPayment(
    row: PaymentRequestRow,
    status: "PAID" | "CANCELLED",
  ) {
    const { error: updateError } = await supabase
      .from("ncs_whatsapp_payment_requests")
      .update(
        status === "PAID"
          ? {
              status,
              paid_at: new Date().toISOString(),
              verification_status:
                row.verification_status === "SUBMITTED"
                  ? "VERIFIED"
                  : row.verification_status || "NONE",
              verified_at:
                row.verification_status === "SUBMITTED"
                  ? new Date().toISOString()
                  : row.verified_at || null,
            }
          : { status },
      )
      .eq("id", row.id);

    if (updateError) {
      alert(updateError.message);
      return;
    }

    await loadData();
  }

  async function deletePaymentRequest(row: PaymentRequestRow) {
    const confirmed = window.confirm(
      `Delete this payment request?\n\n${row.customer_name || row.phone}\n₹${n(
        row.amount,
      ).toLocaleString("en-IN")}\n${row.order_reference || "No reference"}`,
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("ncs_whatsapp_payment_requests")
      .delete()
      .eq("id", row.id);

    if (deleteError) {
      alert(deleteError.message);
      return;
    }

    await loadData();
  }

  async function authToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token || "";
  }

  async function callAutopilot(
    action: "RUN" | "SEND_QUEUE_ITEM" | "DISMISS_QUEUE_ITEM",
    itemId?: string,
  ) {
    if (autopilotBusy) return;

    setAutopilotBusy(true);
    setAutopilotNotice("");

    try {
      const token = await authToken();

      if (!token) {
        setAutopilotNotice("Admin session missing. Login again.");
        return;
      }

      const response = await fetch("/api/whatsapp/autopilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          itemId,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.success !== true) {
        setAutopilotNotice(data.error || "Autopilot action failed.");
        return;
      }

      if (action === "RUN") {
        setAutopilotNotice(
          `Autopilot checked • queued ${n(data.queued)} • auto sent ${n(
            data.sent,
          )} • approvals ${n(data.approvals)}`,
        );
      } else if (action === "SEND_QUEUE_ITEM") {
        setAutopilotNotice("Approved follow-up sent.");
      } else {
        setAutopilotNotice("Automation item dismissed.");
      }

      await loadData();
    } finally {
      setAutopilotBusy(false);
    }
  }

  async function toggleAutopilot() {
    if (!automationSettings) return;

    const next = !automationSettings.enabled;

    const { error: settingsError } = await supabase
      .from("ncs_whatsapp_automation_settings")
      .update({ enabled: next })
      .eq("id", 1);

    if (settingsError) {
      alert(settingsError.message);
      return;
    }

    setAutomationSettings({
      ...automationSettings,
      enabled: next,
    });
  }

  async function toggleLowRiskAuto() {
    if (!automationSettings) return;

    const next = !automationSettings.auto_low_risk;

    const { error: settingsError } = await supabase
      .from("ncs_whatsapp_automation_settings")
      .update({ auto_low_risk: next })
      .eq("id", 1);

    if (settingsError) {
      alert(settingsError.message);
      return;
    }

    setAutomationSettings({
      ...automationSettings,
      auto_low_risk: next,
    });
  }

  const startCount =
    filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endCount = Math.min(safePage * PAGE_SIZE, filtered.length);

  const approvals = automationQueue.filter((x) => x.status === "APPROVAL");
  const recentAutomation = automationQueue
    .filter((x) => x.status !== "CANCELLED")
    .slice(0, 14);

  return (
    <main className="s14Page">
      <section className="s14Hero">
        <div>
          <span>STAGE 14 • SALES AUTOPILOT</span>
          <h1>WhatsApp Smart Lead Desk</h1>
          <p>
            Leads, direct UPI verification, payment collection and safe follow-up
            automation in one screen.
          </p>
        </div>

        <div className="s14HeroActions">
          <button type="button" onClick={() => void loadData()}>
            ↻ REFRESH
          </button>
          <button
            type="button"
            className="gold"
            onClick={() => void callAutopilot("RUN")}
            disabled={autopilotBusy}
          >
            {autopilotBusy ? "RUNNING..." : "⚡ RUN AUTOPILOT"}
          </button>
        </div>
      </section>

      <section className="s14Metrics">
        <article>
          <small>TOTAL LEADS</small>
          <strong>{metrics.total}</strong>
        </article>
        <article>
          <small>HOT + WARM</small>
          <strong>{metrics.hot + metrics.warm}</strong>
        </article>
        <article>
          <small>FOLLOW-UP</small>
          <strong>{metrics.followup}</strong>
        </article>
        <article>
          <small>PAYMENT PENDING</small>
          <strong>{metrics.pendingPayments}</strong>
        </article>
        <article className={metrics.verifyPayments > 0 ? "attention" : ""}>
          <small>UTR TO VERIFY</small>
          <strong>{metrics.verifyPayments}</strong>
        </article>
        <article className={metrics.approvals > 0 ? "attention" : ""}>
          <small>AUTOPILOT APPROVAL</small>
          <strong>{metrics.approvals}</strong>
        </article>
      </section>

      <section className="s14Autopilot">
        <header>
          <div>
            <span>SAFE AUTOMATION</span>
            <strong>
              {automationSettings?.enabled === false ? "Autopilot paused" : "Autopilot active"}
            </strong>
            <small>
              Low-risk help messages can send automatically. Booking/payment
              reminders always wait for approval.
            </small>
          </div>

          <div className="s14AutoControls">
            <button
              type="button"
              className={automationSettings?.enabled !== false ? "on" : ""}
              onClick={() => void toggleAutopilot()}
            >
              {automationSettings?.enabled !== false ? "AUTOPILOT ON" : "AUTOPILOT OFF"}
            </button>

            <button
              type="button"
              className={automationSettings?.auto_low_risk !== false ? "on" : ""}
              onClick={() => void toggleLowRiskAuto()}
            >
              LOW-RISK AUTO{" "}
              {automationSettings?.auto_low_risk !== false ? "ON" : "OFF"}
            </button>

            <button type="button" onClick={() => setShowAutopilot((x) => !x)}>
              {showAutopilot ? "HIDE" : "SHOW"}
            </button>
          </div>
        </header>

        {autopilotNotice && <div className="s14AutoNotice">{autopilotNotice}</div>}

        {showAutopilot && (
          <>
            {approvals.length > 0 && (
              <div className="s14ApprovalStrip">
                <b>{approvals.length} items need your approval</b>
                <span>
                  Payment/booking messages are never auto-sent by Stage 14.
                </span>
              </div>
            )}

            <div className="s14Queue">
              {recentAutomation.length === 0 ? (
                <div className="s14Empty">No automation items yet. Run Autopilot once.</div>
              ) : (
                recentAutomation.map((row) => (
                  <article key={row.id}>
                    <div className="s14QueueTop">
                      <div>
                        <b>{row.customer_name || row.phone}</b>
                        <span>{row.automation_type.replaceAll("_", " ")}</span>
                      </div>

                      <div className={`risk ${row.risk_level.toLowerCase()}`}>
                        {row.risk_level}
                      </div>

                      <div className={`queueStatus ${row.status.toLowerCase()}`}>
                        {row.status}
                      </div>
                    </div>

                    <p>{row.message_text}</p>

                    <footer>
                      <span>{fmt(row.sent_at || row.created_at)}</span>

                      {row.status === "APPROVAL" && (
                        <div>
                          <button
                            type="button"
                            className="approve"
                            disabled={autopilotBusy}
                            onClick={() =>
                              void callAutopilot("SEND_QUEUE_ITEM", row.id)
                            }
                          >
                            ✓ APPROVE & SEND
                          </button>
                          <button
                            type="button"
                            disabled={autopilotBusy}
                            onClick={() =>
                              void callAutopilot("DISMISS_QUEUE_ITEM", row.id)
                            }
                          >
                            DISMISS
                          </button>
                        </div>
                      )}

                      {row.last_error && <em>{row.last_error}</em>}
                    </footer>
                  </article>
                ))
              )}
            </div>
          </>
        )}
      </section>

      <section className="s14Radar">
        <header>
          <div>
            <span>30-DAY DEMAND RADAR</span>
            <strong>What customers are asking for</strong>
          </div>
        </header>

        <div className="s14RadarGrid">
          {demand.slice(0, 8).map((row) => (
            <article key={String(row.category)}>
              <strong>{row.category || "General"}</strong>
              <b>{n(row.demand_events)}</b>
              <span>
                {n(row.unique_customers)} customers • {n(row.booking_signals)} booking
                signals
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="s14Toolbar">
        <div className="s14Filters">
          {(
            [
              ["ALL", "ALL"],
              ["HOT", "HOT"],
              ["WARM", "WARM"],
              ["COLD", "COLD"],
              ["FOLLOWUP", "FOLLOW-UP"],
              ["WON", "WON"],
            ] as Array<[LeadFilter, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={filter === id ? "active" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="s14SearchWrap">
          <span>
            {startCount}-{endCount} of {filtered.length}
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer / phone / product..."
          />
        </div>
      </section>

      <section className="s14List">
        {loading ? (
          <div className="s14Empty">Loading WhatsApp leads...</div>
        ) : visibleLeads.length === 0 ? (
          <div className="s14Empty">No matching leads.</div>
        ) : (
          visibleLeads.map((lead) => (
            <article className="s14LeadCard" key={lead.id}>
              <div className="s14Identity">
                <div className="s14Avatar">
                  {nameOf(lead).slice(0, 1).toUpperCase()}
                </div>

                <div>
                  <strong>{nameOf(lead)}</strong>
                  <a href={`tel:+${lead.phone}`}>+{lead.phone}</a>
                  <small>{fmt(lead.last_seen_at)}</small>
                </div>
              </div>

              <div className="s14Score">
                <span className={(lead.lead_temperature || "COLD").toLowerCase()}>
                  {lead.lead_temperature || "COLD"}
                </span>
                <b>{n(lead.lead_score)}</b>
              </div>

              <div className="s14Interest">
                <small>INTEREST</small>
                <strong>
                  {lead.interested_product_name ||
                    lead.interested_category ||
                    lead.primary_interest ||
                    "General"}
                </strong>
                <p>{lead.last_message_text || "—"}</p>
              </div>

              <div className="s14Signal">
                <b className={windowActive(lead.last_seen_at) ? "open" : "closed"}>
                  {windowActive(lead.last_seen_at)
                    ? "● DIRECT MESSAGE READY"
                    : "● TEMPLATE NEEDED"}
                </b>
                {lead.needs_human_followup && (
                  <span>⚡ {lead.followup_reason || "Follow-up needed"}</span>
                )}
                {n(lead.booking_intent_count) > 0 && (
                  <span>📌 Booking signal {n(lead.booking_intent_count)}</span>
                )}
              </div>

              <div className="s14Actions">
                <button
                  type="button"
                  className="blue"
                  onClick={() => openAction(lead)}
                >
                  💬 MESSAGE
                </button>
                <button
                  type="button"
                  className="gold"
                  onClick={() => openPayment(lead)}
                >
                  💳 COLLECT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLead(lead);
                    setMode("HISTORY");
                  }}
                >
                  ◷ HISTORY
                </button>
                <a
                  href={`https://wa.me/${lead.phone}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  🟢 WHATSAPP
                </a>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="s14Pager">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => setPage((x) => Math.max(1, x - 1))}
        >
          ‹ PREV
        </button>

        <span>
          PAGE {safePage} / {totalPages}
        </span>

        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => setPage((x) => Math.min(totalPages, x + 1))}
        >
          NEXT ›
        </button>
      </section>

      <section className="s14Payments">
        <header>
          <div>
            <span>PAYMENT CONTROL</span>
            <strong>
              Direct UPI verification + Razorpay backup
            </strong>
          </div>

          <button type="button" onClick={() => setShowPayments((x) => !x)}>
            {showPayments ? "HIDE HISTORY" : "SHOW HISTORY"}
          </button>
        </header>

        {showPayments && (
          <div className="s14PaymentRows">
            {payments.slice(0, 20).map((row) => (
              <article
                key={row.id}
                className={
                  row.verification_status === "SUBMITTED" ? "verifyNow" : ""
                }
              >
                <div>
                  <strong>{row.customer_name || row.phone}</strong>
                  <span>+{row.phone}</span>
                </div>

                <div>
                  <strong>₹{n(row.amount).toLocaleString("en-IN")}</strong>
                  <span>{row.order_reference || "No reference"}</span>
                </div>

                <div>
                  <strong>{row.payment_method.replaceAll("_", " ")}</strong>
                  <span>{fmt(row.sent_at || row.created_at)}</span>
                </div>

                <div>
                  <strong>
                    {row.verification_status || "NONE"}
                  </strong>
                  <span>
                    {row.utr_number ? `UTR ${row.utr_number}` : "No UTR submitted"}
                  </span>
                </div>

                <div className="s14PayButtons">
                  {row.verification_status === "SUBMITTED" && (
                    <>
                      <button
                        type="button"
                        className="verify"
                        onClick={() =>
                          void updatePaymentVerification(row, "VERIFY")
                        }
                      >
                        ✓ VERIFY
                      </button>
                      <button
                        type="button"
                        className="reject"
                        onClick={() =>
                          void updatePaymentVerification(row, "REJECT")
                        }
                      >
                        REJECT
                      </button>
                    </>
                  )}

                  {row.status !== "PAID" && (
                    <button
                      type="button"
                      onClick={() => void markPayment(row, "PAID")}
                    >
                      MARK PAID
                    </button>
                  )}

                  {row.status !== "CANCELLED" && row.status !== "PAID" && (
                    <button
                      type="button"
                      onClick={() => void markPayment(row, "CANCELLED")}
                    >
                      CANCEL
                    </button>
                  )}

                  <button
                    type="button"
                    className="delete"
                    onClick={() => void deletePaymentRequest(row)}
                  >
                    DELETE
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedLead && (
        <div className="s14Overlay" onMouseDown={() => setSelectedLead(null)}>
          <section className="s14Panel" onMouseDown={(e) => e.stopPropagation()}>
            <header className="s14PanelHeader">
              <div>
                <span>
                  {mode === "PAYMENT"
                    ? "PAYMENT COLLECT CENTER"
                    : mode === "HISTORY"
                      ? "CUSTOMER TIMELINE"
                      : "CUSTOMER ACTION CENTER"}
                </span>
                <strong>{nameOf(selectedLead)}</strong>
                <b>📞 +{selectedLead.phone}</b>
                <small>Last seen: {fmt(selectedLead.last_seen_at)}</small>
              </div>

              <button type="button" onClick={() => setSelectedLead(null)}>
                ×
              </button>
            </header>

            <nav className="s14ModeTabs">
              <button
                type="button"
                className={mode === "ACTION" ? "active" : ""}
                onClick={() => setMode("ACTION")}
              >
                💬 MESSAGE
              </button>
              <button
                type="button"
                className={mode === "PAYMENT" ? "active" : ""}
                onClick={() => setMode("PAYMENT")}
              >
                💳 PAYMENT
              </button>
              <button
                type="button"
                className={mode === "HISTORY" ? "active" : ""}
                onClick={() => setMode("HISTORY")}
              >
                ◷ HISTORY
              </button>
            </nav>

            {mode === "ACTION" && (
              <>
                <div className="s14PresetGrid">
                  {ACTIONS.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      className={action === x.id ? "active" : ""}
                      onClick={() => {
                        setAction(x.id);
                        setMessage(preset(x.id, nameOf(selectedLead)));
                      }}
                    >
                      <span>{x.icon}</span>
                      <strong>{x.label}</strong>
                    </button>
                  ))}
                </div>

                <label className="s14Field">
                  <span>MESSAGE</span>
                  <textarea
                    value={message}
                    onChange={(e) => {
                      setAction("CUSTOM");
                      setMessage(e.target.value);
                    }}
                    rows={7}
                  />
                </label>

                <button
                  className="s14Send"
                  type="button"
                  onClick={() => void sendAction()}
                  disabled={sending || !message.trim()}
                >
                  {sending ? "SENDING..." : "SEND TO WHATSAPP"}
                </button>
              </>
            )}

            {mode === "PAYMENT" && (
              <>
                <div className="s14PaymentForm">
                  <label className="s14Field">
                    <span>AMOUNT ₹</span>
                    <input
                      inputMode="decimal"
                      value={payAmount}
                      onChange={(e) =>
                        setPayAmount(e.target.value.replace(/[^\d.]/g, ""))
                      }
                      placeholder="Example: 850"
                    />
                  </label>

                  <label className="s14Field">
                    <span>REFERENCE</span>
                    <input
                      value={orderRef}
                      onChange={(e) => setOrderRef(e.target.value)}
                    />
                  </label>

                  <label className="s14Field">
                    <span>NOTE</span>
                    <input
                      value={payNote}
                      onChange={(e) => setPayNote(e.target.value)}
                      placeholder="Optional note"
                    />
                  </label>
                </div>

                <div className="s14PaymentMethods">
                  <button
                    type="button"
                    className={paymentMethod === "UPI_QR" ? "active" : ""}
                    onClick={() => {
                      setPaymentMethod("UPI_QR");
                      setGeneratedPaymentLink("");
                    }}
                  >
                    <span>▦</span>
                    <strong>DIRECT UPI QR</strong>
                    <small>Primary • direct bank payment</small>
                  </button>

                  <button
                    type="button"
                    className={paymentMethod === "RAZORPAY_LINK" ? "active" : ""}
                    onClick={() => setPaymentMethod("RAZORPAY_LINK")}
                  >
                    <span>🔒</span>
                    <strong>RAZORPAY</strong>
                    <small>Backup payment link</small>
                  </button>
                </div>

                {paymentMethod === "RAZORPAY_LINK" && (
                  <div className="s14RazorBox">
                    <button
                      type="button"
                      onClick={() => void generateRazorpayLink()}
                      disabled={sending}
                    >
                      {sending ? "GENERATING..." : "GENERATE RAZORPAY LINK"}
                    </button>

                    <input
                      value={generatedPaymentLink}
                      readOnly
                      placeholder="Secure Razorpay link appears here"
                    />
                  </div>
                )}

                {paymentMethod === "UPI_QR" && (
                  <div className="s14InfoBox">
                    Customer gets NEW CITY STYLE HTTPS payment page → dynamic
                    amount QR → download/save QR → UTR submit → admin VERIFY.
                  </div>
                )}

                <button
                  className="s14Send pay"
                  type="button"
                  onClick={() => void sendPaymentRequest()}
                  disabled={sending || !payAmount}
                >
                  {sending ? "SENDING..." : "SEND PAYMENT REQUEST"}
                </button>
              </>
            )}

            {mode === "HISTORY" && (
              <div className="s14Timeline">
                {selectedTimeline.length === 0 ? (
                  <div className="s14Empty">No customer history yet.</div>
                ) : (
                  selectedTimeline.map((item) => (
                    <article key={item.id}>
                      <span>{item.type}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                        <small>{fmt(item.at)}</small>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}

            {notice && <div className="s14Notice">{notice}</div>}
            {error && <div className="s14Error">{error}</div>}
          </section>
        </div>
      )}

      <style jsx global>{`
        .s14Page {
          min-height: 100vh;
          padding: 22px;
          background: #f7f4ed;
          color: #142033;
          font-family: Poppins, Inter, Arial, sans-serif;
        }

        .s14Hero {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          padding: 24px;
          border-radius: 24px;
          background: linear-gradient(135deg,#091a3a,#0a2e73 58%,#0c756d);
          color: #fff;
          box-shadow: 0 18px 50px rgba(10,46,115,.18);
        }

        .s14Hero span,
        .s14Autopilot header span,
        .s14Radar header span,
        .s14Payments header span,
        .s14PanelHeader span {
          color: #78eadc;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 1.1px;
        }

        .s14Hero h1 {
          margin: 6px 0 4px;
          font-size: clamp(28px,3vw,40px);
        }

        .s14Hero p {
          max-width: 760px;
          margin: 0;
          color: rgba(255,255,255,.78);
          font-size: 12px;
        }

        .s14HeroActions {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .s14HeroActions button {
          min-height: 42px;
          padding: 0 14px;
          border: 1px solid rgba(255,255,255,.28);
          border-radius: 11px;
          background: rgba(255,255,255,.12);
          color: #fff;
          font-size: 10px;
          font-weight: 950;
          cursor: pointer;
        }

        .s14HeroActions button.gold {
          border-color: #d4af37;
          background: #d4af37;
          color: #10213a;
        }

        .s14Metrics {
          display: grid;
          grid-template-columns: repeat(6,minmax(0,1fr));
          gap: 9px;
          margin-top: 12px;
        }

        .s14Metrics article {
          padding: 13px 14px;
          border: 1px solid #e3e7ed;
          border-radius: 15px;
          background: #fff;
        }

        .s14Metrics article.attention {
          border-color: #f2c94c;
          background: #fffaf0;
        }

        .s14Metrics small {
          color: #7c8798;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .5px;
        }

        .s14Metrics strong {
          display: block;
          margin-top: 4px;
          color: #0a2e73;
          font-size: 24px;
        }

        .s14Autopilot,
        .s14Radar,
        .s14Payments {
          margin-top: 12px;
          padding: 15px;
          border: 1px solid #e1e6ec;
          border-radius: 18px;
          background: #fff;
        }

        .s14Autopilot header,
        .s14Payments header,
        .s14Radar header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .s14Autopilot header strong,
        .s14Payments header strong,
        .s14Radar header strong {
          display: block;
          margin-top: 3px;
          font-size: 15px;
        }

        .s14Autopilot header small {
          display: block;
          margin-top: 4px;
          color: #7d8796;
          font-size: 10px;
        }

        .s14AutoControls {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .s14AutoControls button,
        .s14Payments header button {
          min-height: 36px;
          padding: 0 11px;
          border: 1px solid #dce2e9;
          border-radius: 10px;
          background: #fff;
          color: #22344f;
          font-size: 9px;
          font-weight: 950;
          cursor: pointer;
        }

        .s14AutoControls button.on {
          border-color: #86efac;
          background: #ecfdf5;
          color: #047857;
        }

        .s14AutoNotice {
          margin-top: 9px;
          padding: 9px 11px;
          border-radius: 10px;
          background: #eff6ff;
          color: #0a2e73;
          font-size: 10px;
          font-weight: 800;
        }

        .s14ApprovalStrip {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 11px;
          background: #fff8e5;
          color: #8a5a00;
          font-size: 10px;
        }

        .s14Queue {
          display: grid;
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 8px;
          margin-top: 10px;
        }

        .s14Queue article {
          padding: 11px;
          border: 1px solid #e7ebf0;
          border-radius: 13px;
          background: #fafbfc;
        }

        .s14QueueTop {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 7px;
          align-items: start;
        }

        .s14QueueTop b,
        .s14QueueTop span {
          display: block;
        }

        .s14QueueTop b {
          font-size: 11px;
        }

        .s14QueueTop span {
          color: #7b8797;
          font-size: 8px;
        }

        .risk,
        .queueStatus {
          padding: 4px 7px;
          border-radius: 999px;
          font-size: 7px;
          font-weight: 950;
        }

        .risk.low { background:#ecfdf5;color:#047857; }
        .risk.medium { background:#fff7ed;color:#b45309; }
        .risk.sensitive { background:#fff1f2;color:#be123c; }

        .queueStatus.approval { background:#fff7ed;color:#b45309; }
        .queueStatus.sent { background:#ecfdf5;color:#047857; }
        .queueStatus.pending { background:#eff6ff;color:#1d4ed8; }
        .queueStatus.failed { background:#fff1f2;color:#be123c; }
        .queueStatus.skipped { background:#f3f4f6;color:#4b5563; }

        .s14Queue p {
          max-height: 52px;
          overflow: hidden;
          margin: 8px 0;
          color: #536174;
          font-size: 9px;
          line-height: 1.45;
          white-space: pre-wrap;
        }

        .s14Queue footer {
          display: grid;
          gap: 7px;
        }

        .s14Queue footer > span {
          color: #8a94a3;
          font-size: 8px;
        }

        .s14Queue footer > div {
          display: flex;
          gap: 6px;
        }

        .s14Queue footer button {
          min-height: 31px;
          padding: 0 8px;
          border: 1px solid #d8dee8;
          border-radius: 8px;
          background: #fff;
          color: #26374e;
          font-size: 8px;
          font-weight: 950;
          cursor: pointer;
        }

        .s14Queue footer button.approve {
          border-color: #86efac;
          background: #ecfdf5;
          color: #047857;
        }

        .s14Queue footer em {
          color: #be123c;
          font-size: 8px;
          font-style: normal;
        }

        .s14RadarGrid {
          display: grid;
          grid-template-columns: repeat(4,minmax(0,1fr));
          gap: 8px;
          margin-top: 10px;
        }

        .s14RadarGrid article {
          padding: 11px;
          border-radius: 12px;
          background: #f7f9fb;
        }

        .s14RadarGrid strong,
        .s14RadarGrid b,
        .s14RadarGrid span {
          display: block;
        }

        .s14RadarGrid strong {
          font-size: 10px;
        }

        .s14RadarGrid b {
          margin-top: 5px;
          color: #0a2e73;
          font-size: 21px;
        }

        .s14RadarGrid span {
          margin-top: 2px;
          color: #7d8796;
          font-size: 8px;
        }

        .s14Toolbar {
          position: sticky;
          top: 84px;
          z-index: 40;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin: 12px 0 9px;
          padding: 9px;
          border: 1px solid #dfe4ea;
          border-radius: 14px;
          background: rgba(255,255,255,.95);
          backdrop-filter: blur(14px);
          box-shadow: 0 8px 24px rgba(20,32,51,.07);
        }

        .s14Filters {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .s14Filters button {
          min-height: 35px;
          padding: 0 11px;
          border: 1px solid #dbe1e8;
          border-radius: 9px;
          background: #fff;
          color: #26364e;
          font-size: 9px;
          font-weight: 950;
          cursor: pointer;
        }

        .s14Filters button.active {
          border-color: #0a2e73;
          background: #0a2e73;
          color: #fff;
        }

        .s14SearchWrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .s14SearchWrap span {
          color: #7c8798;
          font-size: 9px;
          font-weight: 850;
          white-space: nowrap;
        }

        .s14SearchWrap input {
          width: min(330px,32vw);
          min-height: 35px;
          padding: 0 11px;
          border: 1px solid #dbe1e8;
          border-radius: 9px;
          background: #fff;
          font: inherit;
          font-size: 10px;
        }

        .s14List {
          display: grid;
          gap: 7px;
        }

        .s14LeadCard {
          display: grid;
          grid-template-columns:
            minmax(210px,1.15fr)
            76px
            minmax(180px,.9fr)
            minmax(185px,.9fr)
            minmax(250px,1.05fr);
          gap: 10px;
          align-items: center;
          padding: 11px 12px;
          border: 1px solid #e0e5eb;
          border-radius: 14px;
          background: #fff;
          transition: transform .15s ease, box-shadow .15s ease;
        }

        .s14LeadCard:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 26px rgba(20,32,51,.07);
        }

        .s14Identity {
          display: flex;
          gap: 10px;
          align-items: center;
          min-width: 0;
        }

        .s14Avatar {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          flex: 0 0 40px;
          border-radius: 12px;
          background: linear-gradient(135deg,#1558b0,#0d8075);
          color: #fff;
          font-size: 15px;
          font-weight: 950;
        }

        .s14Identity strong,
        .s14Identity a,
        .s14Identity small {
          display: block;
        }

        .s14Identity strong {
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 12px;
          white-space: nowrap;
        }

        .s14Identity a {
          margin-top: 2px;
          color: #0b5bb6;
          font-size: 11px;
          font-weight: 900;
          text-decoration: none;
        }

        .s14Identity small {
          margin-top: 2px;
          color: #8a95a3;
          font-size: 8px;
        }

        .s14Score {
          text-align: center;
        }

        .s14Score span {
          display: inline-block;
          padding: 3px 7px;
          border-radius: 999px;
          font-size: 7px;
          font-weight: 950;
        }

        .s14Score span.hot { background:#fff1f2;color:#be123c; }
        .s14Score span.warm { background:#fff7ed;color:#b45309; }
        .s14Score span.cold { background:#e0f2fe;color:#0369a1; }

        .s14Score b {
          display: block;
          margin-top: 2px;
          font-size: 20px;
        }

        .s14Interest small {
          color: #8792a0;
          font-size: 7px;
          font-weight: 950;
        }

        .s14Interest strong {
          display: block;
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 10px;
          white-space: nowrap;
        }

        .s14Interest p {
          margin: 3px 0 0;
          overflow: hidden;
          color: #6f7a8b;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .s14Signal b,
        .s14Signal span {
          display: block;
        }

        .s14Signal b {
          font-size: 8px;
        }

        .s14Signal b.open { color:#047857; }
        .s14Signal b.closed { color:#b45309; }

        .s14Signal span {
          margin-top: 3px;
          overflow: hidden;
          color: #637083;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .s14Actions {
          display: grid;
          grid-template-columns: repeat(4,1fr);
          gap: 5px;
        }

        .s14Actions button,
        .s14Actions a {
          min-height: 36px;
          display: grid;
          place-items: center;
          padding: 5px 6px;
          border: 1px solid #dce2e9;
          border-radius: 9px;
          background: #fff;
          color: #263549;
          font: inherit;
          font-size: 8px;
          font-weight: 950;
          text-decoration: none;
          cursor: pointer;
        }

        .s14Actions .blue {
          border-color: #1558b0;
          background: #1558b0;
          color: #fff;
        }

        .s14Actions .gold {
          border-color: #d4af37;
          background: #d4af37;
          color: #172033;
        }

        .s14Pager {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-top: 10px;
        }

        .s14Pager button {
          min-height: 34px;
          padding: 0 13px;
          border: 1px solid #d9dfe7;
          border-radius: 9px;
          background: #fff;
          color: #23354d;
          font-size: 9px;
          font-weight: 950;
          cursor: pointer;
        }

        .s14Pager button:disabled {
          opacity: .35;
          cursor: default;
        }

        .s14Pager span {
          color: #7c8798;
          font-size: 9px;
          font-weight: 900;
        }

        .s14PaymentRows {
          display: grid;
          gap: 7px;
          margin-top: 10px;
        }

        .s14PaymentRows article {
          display: grid;
          grid-template-columns: 1fr .7fr .9fr .9fr minmax(320px,auto);
          gap: 9px;
          align-items: center;
          padding: 10px;
          border-radius: 11px;
          background: #f7f9fb;
        }

        .s14PaymentRows article.verifyNow {
          outline: 2px solid rgba(212,175,55,.45);
          background: #fffaf0;
        }

        .s14PaymentRows strong,
        .s14PaymentRows span {
          display: block;
        }

        .s14PaymentRows strong {
          font-size: 9px;
        }

        .s14PaymentRows span {
          margin-top: 2px;
          color: #7c8798;
          font-size: 8px;
        }

        .s14PayButtons {
          display: flex;
          justify-content: flex-end;
          gap: 5px;
          flex-wrap: wrap;
        }

        .s14PayButtons button {
          min-height: 31px;
          padding: 0 8px;
          border: 1px solid #dce2e9;
          border-radius: 8px;
          background: #fff;
          color: #172033;
          font-size: 7px;
          font-weight: 950;
          cursor: pointer;
        }

        .s14PayButtons button.verify {
          border-color: #86efac;
          background: #ecfdf5;
          color: #047857;
        }

        .s14PayButtons button.reject,
        .s14PayButtons button.delete {
          border-color: #fecaca;
          background: #fff1f2;
          color: #be123c;
        }

        .s14Overlay {
          position: fixed;
          z-index: 9999;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(8,18,35,.58);
          backdrop-filter: blur(8px);
        }

        .s14Panel {
          width: min(760px,96vw);
          max-height: 90vh;
          overflow: auto;
          padding: 18px;
          border: 1px solid #dce2e9;
          border-radius: 20px;
          background: #fff;
          box-shadow: 0 28px 90px rgba(0,0,0,.24);
        }

        .s14PanelHeader {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 2px 13px;
          border-bottom: 1px solid #e7ebf0;
        }

        .s14PanelHeader strong,
        .s14PanelHeader b,
        .s14PanelHeader small {
          display: block;
        }

        .s14PanelHeader strong {
          margin-top: 4px;
          font-size: 20px;
        }

        .s14PanelHeader b {
          margin-top: 3px;
          color: #0a2e73;
          font-size: 12px;
        }

        .s14PanelHeader small {
          margin-top: 3px;
          color: #8a95a3;
          font-size: 9px;
        }

        .s14PanelHeader > button {
          width: 36px;
          height: 36px;
          border: 1px solid #dce2e9;
          border-radius: 10px;
          background: #fff;
          color: #263549;
          font-size: 21px;
          cursor: pointer;
        }

        .s14ModeTabs {
          display: grid;
          grid-template-columns: repeat(3,1fr);
          gap: 7px;
          margin-top: 12px;
        }

        .s14ModeTabs button {
          min-height: 40px;
          border: 1px solid #dce2e9;
          border-radius: 10px;
          background: #fff;
          color: #27374f;
          font-size: 9px;
          font-weight: 950;
          cursor: pointer;
        }

        .s14ModeTabs button.active {
          border-color: #0a2e73;
          background: #0a2e73;
          color: #fff;
        }

        .s14PresetGrid {
          display: grid;
          grid-template-columns: repeat(4,1fr);
          gap: 7px;
          margin-top: 12px;
        }

        .s14PresetGrid button {
          min-height: 58px;
          display: grid;
          place-items: center;
          gap: 2px;
          border: 1px solid #dfe4ea;
          border-radius: 11px;
          background: #f8fafc;
          color: #26364d;
          font-size: 8px;
          cursor: pointer;
        }

        .s14PresetGrid button.active {
          border-color: #d4af37;
          background: #fff9e8;
        }

        .s14Field {
          display: block;
          margin-top: 11px;
        }

        .s14Field > span {
          display: block;
          margin-bottom: 4px;
          color: #687589;
          font-size: 8px;
          font-weight: 950;
        }

        .s14Field input,
        .s14Field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d8dee7;
          border-radius: 10px;
          padding: 10px 11px;
          background: #fff;
          color: #172033;
          font: inherit;
          font-size: 11px;
        }

        .s14Send {
          width: 100%;
          min-height: 44px;
          margin-top: 11px;
          border: 0;
          border-radius: 11px;
          background: #1558b0;
          color: #fff;
          font-size: 10px;
          font-weight: 950;
          cursor: pointer;
        }

        .s14Send.pay {
          background: #0a2e73;
        }

        .s14PaymentForm {
          display: grid;
          grid-template-columns: .7fr 1fr 1fr;
          gap: 8px;
        }

        .s14PaymentMethods {
          display: grid;
          grid-template-columns: repeat(2,1fr);
          gap: 8px;
          margin-top: 12px;
        }

        .s14PaymentMethods button {
          min-height: 72px;
          display: grid;
          place-items: center;
          gap: 2px;
          border: 1px solid #dce2e9;
          border-radius: 12px;
          background: #f8fafc;
          color: #26364d;
          cursor: pointer;
        }

        .s14PaymentMethods button.active {
          border-color: #d4af37;
          background: #fff9e8;
        }

        .s14PaymentMethods button strong {
          font-size: 10px;
        }

        .s14PaymentMethods button small {
          color: #7d8796;
          font-size: 8px;
        }

        .s14RazorBox {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 8px;
          margin-top: 10px;
        }

        .s14RazorBox button {
          min-height: 41px;
          padding: 0 12px;
          border: 0;
          border-radius: 10px;
          background: #0a2e73;
          color: #fff;
          font-size: 8px;
          font-weight: 950;
          cursor: pointer;
        }

        .s14RazorBox input {
          min-height: 41px;
          border: 1px solid #dce2e9;
          border-radius: 10px;
          padding: 0 10px;
          font-size: 9px;
        }

        .s14InfoBox {
          margin-top: 10px;
          padding: 10px;
          border-radius: 10px;
          background: #eef6ff;
          color: #536174;
          font-size: 9px;
          line-height: 1.5;
        }

        .s14Timeline {
          display: grid;
          gap: 7px;
          margin-top: 12px;
        }

        .s14Timeline article {
          display: grid;
          grid-template-columns: 70px 1fr;
          gap: 9px;
          padding: 10px;
          border-radius: 10px;
          background: #f8fafc;
        }

        .s14Timeline article > span {
          color: #0a2e73;
          font-size: 8px;
          font-weight: 950;
        }

        .s14Timeline strong,
        .s14Timeline p,
        .s14Timeline small {
          display: block;
        }

        .s14Timeline strong {
          font-size: 10px;
        }

        .s14Timeline p {
          margin: 3px 0;
          color: #667085;
          font-size: 9px;
          white-space: pre-wrap;
        }

        .s14Timeline small {
          color: #98a2b3;
          font-size: 8px;
        }

        .s14Notice,
        .s14Error {
          margin-top: 10px;
          padding: 10px;
          border-radius: 10px;
          font-size: 9px;
          font-weight: 850;
        }

        .s14Notice {
          background: #ecfdf5;
          color: #047857;
        }

        .s14Error {
          background: #fff1f2;
          color: #be123c;
        }

        .s14Empty {
          padding: 20px;
          border: 1px dashed #d9dfe6;
          border-radius: 12px;
          color: #7d8796;
          background: #fff;
          text-align: center;
          font-size: 10px;
        }

        @media (max-width: 1350px) {
          .s14Metrics {
            grid-template-columns: repeat(3,1fr);
          }

          .s14Queue {
            grid-template-columns: repeat(2,1fr);
          }

          .s14LeadCard {
            grid-template-columns: minmax(210px,1.1fr) 70px minmax(170px,.9fr) minmax(180px,.9fr);
          }

          .s14Actions {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 900px) {
          .s14Page {
            padding: 12px;
          }

          .s14Hero,
          .s14Autopilot header,
          .s14Toolbar,
          .s14Payments header {
            flex-direction: column;
            align-items: stretch;
          }

          .s14Metrics,
          .s14Queue,
          .s14RadarGrid {
            grid-template-columns: repeat(2,1fr);
          }

          .s14SearchWrap {
            flex-direction: column;
            align-items: stretch;
          }

          .s14SearchWrap input {
            width: 100%;
          }

          .s14Toolbar {
            position: static;
          }

          .s14LeadCard {
            grid-template-columns: 1fr 72px;
          }

          .s14Interest,
          .s14Signal,
          .s14Actions {
            grid-column: 1 / -1;
          }

          .s14PaymentRows article {
            grid-template-columns: repeat(2,1fr);
          }

          .s14PayButtons {
            grid-column: 1 / -1;
            justify-content: flex-start;
          }

          .s14PaymentForm,
          .s14RazorBox {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .s14Metrics,
          .s14Queue,
          .s14RadarGrid,
          .s14PaymentMethods,
          .s14PresetGrid {
            grid-template-columns: 1fr;
          }

          .s14LeadCard {
            grid-template-columns: 1fr;
          }

          .s14Score,
          .s14Interest,
          .s14Signal,
          .s14Actions {
            grid-column: auto;
          }

          .s14Actions {
            grid-template-columns: repeat(2,1fr);
          }

          .s14PaymentRows article {
            grid-template-columns: 1fr;
          }

          .s14ModeTabs {
            grid-template-columns: 1fr;
          }
        }

        /* ============================================================
           NCS WHATSAPP LEAD DESK • PREMIUM CLEAN SYSTEM
           Visual-only upgrade. Existing Stage 14 data, automation,
           payment verification, messaging and timeline logic preserved.
           ============================================================ */

        .s14Page {
          position: relative;
          min-height: 100vh;
          padding: 18px !important;
          background:
            radial-gradient(circle at 94% 2%, rgba(212,175,55,.075), transparent 22%),
            linear-gradient(180deg,#f8fafc,#f4f7fb 52%,#f8fafc) !important;
          color: #172033 !important;
          font-family: Inter,Poppins,Arial,sans-serif !important;
        }

        .s14Page::before {
          content:"";
          position:fixed;
          inset:0;
          pointer-events:none;
          opacity:.025;
          background-image:
            linear-gradient(rgba(10,46,115,.16) 1px,transparent 1px),
            linear-gradient(90deg,rgba(10,46,115,.16) 1px,transparent 1px);
          background-size:72px 72px;
          mask-image:linear-gradient(180deg,rgba(0,0,0,.8),transparent 86%);
        }

        .s14Page > * {
          position:relative;
          z-index:1;
        }

        /* HERO */
        .s14Hero {
          display:grid !important;
          grid-template-columns:minmax(0,1fr) auto;
          align-items:center !important;
          gap:22px !important;
          padding:26px 28px !important;
          border:1px solid rgba(212,175,55,.22) !important;
          border-radius:22px !important;
          background:
            radial-gradient(circle at 88% 15%,rgba(212,175,55,.16),transparent 28%),
            linear-gradient(135deg,#06152f,#08265f 56%,#0a2e73) !important;
          color:#fff !important;
          box-shadow:0 22px 54px rgba(10,46,115,.14) !important;
        }

        .s14Hero span,
        .s14Autopilot header span,
        .s14Radar header span,
        .s14Payments header span,
        .s14PanelHeader span {
          color:#e7cb68 !important;
          font-size:8px !important;
          font-weight:950 !important;
          letter-spacing:1.25px !important;
        }

        .s14Hero h1 {
          margin:7px 0 0 !important;
          color:#fff !important;
          font-size:clamp(32px,3.4vw,46px) !important;
          line-height:1.02 !important;
          letter-spacing:-1.1px !important;
        }

        .s14Hero p {
          max-width:760px !important;
          margin:10px 0 0 !important;
          color:rgba(255,255,255,.63) !important;
          font-size:11px !important;
          line-height:1.6 !important;
        }

        .s14HeroActions {
          align-self:start !important;
          display:flex !important;
          flex-wrap:wrap;
          justify-content:flex-end;
          gap:8px !important;
        }

        .s14HeroActions button {
          min-height:42px !important;
          padding:0 14px !important;
          border:1px solid rgba(255,255,255,.13) !important;
          border-radius:10px !important;
          background:rgba(255,255,255,.055) !important;
          color:#fff !important;
          font-size:8px !important;
          font-weight:900 !important;
          letter-spacing:.25px;
          box-shadow:none !important;
          backdrop-filter:blur(8px);
        }

        .s14HeroActions button:hover {
          border-color:rgba(212,175,55,.45) !important;
          background:rgba(212,175,55,.08) !important;
          transform:translateY(-1px);
        }

        .s14HeroActions button.gold {
          border-color:#d4af37 !important;
          background:linear-gradient(135deg,#d4af37,#efd878) !important;
          color:#06152f !important;
        }

        /* METRICS */
        .s14Metrics {
          display:grid !important;
          grid-template-columns:repeat(6,minmax(0,1fr)) !important;
          gap:9px !important;
          margin-top:12px !important;
        }

        .s14Metrics article {
          min-height:88px;
          padding:14px !important;
          border:1px solid #e7ebf1 !important;
          border-radius:14px !important;
          background:#fff !important;
          box-shadow:0 7px 20px rgba(16,24,40,.045) !important;
        }

        .s14Metrics article::before {
          display:none !important;
        }

        .s14Metrics article.attention {
          border-color:#f0d98b !important;
          background:linear-gradient(180deg,#fffdf8,#fffaf0) !important;
        }

        .s14Metrics small {
          color:#7b8494 !important;
          font-size:7px !important;
          font-weight:900 !important;
          letter-spacing:.75px !important;
        }

        .s14Metrics strong {
          margin-top:6px !important;
          color:#0a2e73 !important;
          font-size:26px !important;
          line-height:1 !important;
        }

        /* MAIN CONTROL PANELS */
        .s14Autopilot,
        .s14Radar,
        .s14Payments {
          margin-top:12px !important;
          padding:17px !important;
          border:1px solid #e5eaf0 !important;
          border-radius:16px !important;
          background:#fff !important;
          box-shadow:0 8px 24px rgba(16,24,40,.045) !important;
        }

        .s14Autopilot header,
        .s14Payments header,
        .s14Radar header {
          align-items:flex-start !important;
        }

        .s14Autopilot header strong,
        .s14Payments header strong,
        .s14Radar header strong {
          margin-top:4px !important;
          color:#0a2e73 !important;
          font-size:15px !important;
          line-height:1.25 !important;
        }

        .s14Autopilot header small {
          max-width:760px;
          color:#7b8494 !important;
          font-size:9px !important;
          line-height:1.5 !important;
        }

        .s14AutoControls button,
        .s14Payments header button {
          min-height:34px !important;
          padding:0 10px !important;
          border:1px solid #dfe5ec !important;
          border-radius:9px !important;
          background:#f8fafc !important;
          color:#344054 !important;
          font-size:7px !important;
          font-weight:900 !important;
          box-shadow:none !important;
        }

        .s14AutoControls button.on {
          border-color:#b7e5ca !important;
          background:#effaf4 !important;
          color:#067647 !important;
        }

        .s14AutoNotice {
          border-color:#cfe2f8 !important;
          background:#f4f8fd !important;
          color:#285b91 !important;
        }

        .s14ApprovalStrip {
          border:1px solid #f1d58a !important;
          border-radius:10px !important;
          background:#fffaf0 !important;
          color:#7a5a06 !important;
          box-shadow:none !important;
        }

        .s14ApprovalStrip b {
          color:#6f5208 !important;
        }

        /* AUTOMATION QUEUE */
        .s14Queue {
          gap:8px !important;
        }

        .s14Queue article {
          border:1px solid #e7ebf0 !important;
          border-radius:12px !important;
          background:#fbfcfe !important;
          box-shadow:none !important;
        }

        .s14Queue article:hover {
          border-color:#d8dee8 !important;
          background:#fff !important;
        }

        .s14QueueTop b {
          color:#0a2e73 !important;
        }

        .s14QueueTop span,
        .s14Queue article p,
        .s14Queue article footer > span {
          color:#667085 !important;
        }

        .risk,
        .queueStatus {
          border-radius:999px !important;
          font-size:6.5px !important;
          letter-spacing:.45px !important;
        }

        .risk.low,
        .queueStatus.sent {
          border-color:#b7e5ca !important;
          background:#effaf4 !important;
          color:#067647 !important;
        }

        .risk.medium,
        .queueStatus.approval {
          border-color:#f3dba0 !important;
          background:#fffaf0 !important;
          color:#7a5a06 !important;
        }

        .risk.sensitive,
        .queueStatus.failed {
          border-color:#f4c7c3 !important;
          background:#fff5f4 !important;
          color:#b42318 !important;
        }

        /* DEMAND RADAR */
        .s14Radar {
          overflow:hidden;
        }

        .s14RadarGrid {
          gap:9px !important;
        }

        .s14RadarGrid article {
          position:relative;
          overflow:hidden;
          min-height:96px !important;
          padding:13px !important;
          border:1px solid #e7ebf0 !important;
          border-radius:13px !important;
          background:
            linear-gradient(180deg,#fff,#fbfcfe) !important;
          box-shadow:none !important;
        }

        .s14RadarGrid article::after {
          content:"";
          position:absolute;
          right:-28px;
          bottom:-28px;
          width:70px;
          height:70px;
          border-radius:50%;
          background:rgba(212,175,55,.055);
        }

        .s14RadarGrid article > strong {
          color:#0a2e73 !important;
          font-size:11px !important;
        }

        .s14RadarGrid article > b {
          color:#b18b15 !important;
          font-size:24px !important;
        }

        .s14RadarGrid article > span {
          color:#7b8494 !important;
          font-size:7px !important;
          line-height:1.4 !important;
        }

        /* STICKY FILTER BAR */
        .s14Toolbar {
          position:sticky !important;
          z-index:25 !important;
          top:0 !important;
          display:grid !important;
          grid-template-columns:minmax(0,1fr) auto !important;
          align-items:center !important;
          gap:12px !important;
          margin-top:12px !important;
          padding:9px 10px !important;
          border:1px solid #e3e8ef !important;
          border-radius:13px !important;
          background:rgba(255,255,255,.93) !important;
          box-shadow:0 9px 24px rgba(16,24,40,.06) !important;
          backdrop-filter:blur(14px);
        }

        .s14Filters {
          display:flex !important;
          flex-wrap:wrap !important;
          gap:5px !important;
        }

        .s14Filters button {
          min-height:33px !important;
          padding:0 11px !important;
          border:1px solid transparent !important;
          border-radius:9px !important;
          background:#f7f9fc !important;
          color:#667085 !important;
          font-size:7.5px !important;
          font-weight:900 !important;
        }

        .s14Filters button:hover {
          color:#0a2e73 !important;
          background:#f2f5f9 !important;
        }

        .s14Filters button.active {
          border-color:#d4af37 !important;
          background:#0a2e73 !important;
          color:#fff !important;
          box-shadow:none !important;
        }

        .s14SearchWrap {
          min-width:340px !important;
          display:flex !important;
          align-items:center !important;
          gap:8px !important;
        }

        .s14SearchWrap > span {
          color:#7b8494 !important;
          font-size:7px !important;
          white-space:nowrap;
        }

        .s14SearchWrap input {
          min-width:240px !important;
          height:35px !important;
          padding:0 11px !important;
          border:1px solid #d9e0e8 !important;
          border-radius:9px !important;
          background:#fff !important;
          color:#172033 !important;
          font-size:9px !important;
          box-shadow:none !important;
        }

        .s14SearchWrap input:focus {
          border-color:#0a2e73 !important;
          box-shadow:0 0 0 3px rgba(10,46,115,.06) !important;
        }

        /* LEAD LIST */
        .s14List {
          display:grid !important;
          gap:9px !important;
          margin-top:10px !important;
        }

        .s14LeadCard {
          display:grid !important;
          grid-template-columns:minmax(180px,1.05fr) 90px minmax(220px,1.3fr) minmax(170px,.9fr) auto !important;
          align-items:center !important;
          gap:12px !important;
          padding:13px !important;
          border:1px solid #e4e9ef !important;
          border-radius:15px !important;
          background:#fff !important;
          box-shadow:0 7px 20px rgba(16,24,40,.045) !important;
          transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease !important;
        }

        .s14LeadCard:hover {
          transform:translateY(-1px);
          border-color:rgba(212,175,55,.36) !important;
          box-shadow:0 12px 28px rgba(16,24,40,.07) !important;
        }

        .s14Identity {
          min-width:0;
        }

        .s14Avatar {
          width:42px !important;
          height:42px !important;
          flex:0 0 42px !important;
          border:1px solid rgba(212,175,55,.25) !important;
          border-radius:12px !important;
          background:#fffaf0 !important;
          color:#0a2e73 !important;
          font-size:15px !important;
          font-weight:950 !important;
          box-shadow:none !important;
        }

        .s14Identity strong {
          color:#0a2e73 !important;
          font-size:11px !important;
        }

        .s14Identity a {
          color:#475467 !important;
          font-size:8px !important;
          text-decoration:none !important;
        }

        .s14Identity small {
          color:#98a2b3 !important;
          font-size:7px !important;
        }

        .s14Score {
          min-width:0;
          padding:7px 8px !important;
          border:1px solid #edf0f4 !important;
          border-radius:10px !important;
          background:#fafbfd !important;
          text-align:center;
        }

        .s14Score > span {
          border-radius:999px !important;
          padding:4px 7px !important;
          font-size:6px !important;
          font-weight:950 !important;
        }

        .s14Score > span.hot {
          background:#fff0ed !important;
          color:#c4320a !important;
        }

        .s14Score > span.warm {
          background:#fff7e8 !important;
          color:#b54708 !important;
        }

        .s14Score > span.cold {
          background:#eff6ff !important;
          color:#175cd3 !important;
        }

        .s14Score b {
          display:block;
          margin-top:5px !important;
          color:#0a2e73 !important;
          font-size:16px !important;
        }

        .s14Interest {
          min-width:0;
        }

        .s14Interest small {
          color:#b18b15 !important;
          font-size:6.5px !important;
          font-weight:950 !important;
          letter-spacing:.7px !important;
        }

        .s14Interest strong {
          color:#172033 !important;
          font-size:10px !important;
        }

        .s14Interest p {
          display:-webkit-box;
          overflow:hidden;
          margin-top:5px !important;
          color:#667085 !important;
          font-size:8px !important;
          line-height:1.45 !important;
          -webkit-box-orient:vertical;
          -webkit-line-clamp:2;
        }

        .s14Signal {
          min-width:0;
          display:flex !important;
          flex-direction:column !important;
          align-items:flex-start !important;
          gap:4px !important;
        }

        .s14Signal b {
          padding:4px 7px !important;
          border-radius:999px !important;
          font-size:6px !important;
          letter-spacing:.25px !important;
        }

        .s14Signal b.open {
          background:#effaf4 !important;
          color:#067647 !important;
        }

        .s14Signal b.closed {
          background:#fff7ed !important;
          color:#b54708 !important;
        }

        .s14Signal span {
          color:#667085 !important;
          font-size:7px !important;
          line-height:1.35 !important;
        }

        .s14Actions {
          display:grid !important;
          grid-template-columns:repeat(2,minmax(78px,1fr)) !important;
          gap:6px !important;
        }

        .s14Actions button,
        .s14Actions a {
          min-height:32px !important;
          display:flex !important;
          align-items:center !important;
          justify-content:center !important;
          padding:0 8px !important;
          border:1px solid #dfe5ec !important;
          border-radius:8px !important;
          background:#f8fafc !important;
          color:#344054 !important;
          font-size:6.5px !important;
          font-weight:900 !important;
          text-decoration:none !important;
          box-shadow:none !important;
        }

        .s14Actions button.blue {
          border-color:#cfe0f7 !important;
          background:#f3f7fc !important;
          color:#175cd3 !important;
        }

        .s14Actions button.gold {
          border-color:#ead89b !important;
          background:#fffaf0 !important;
          color:#7a5a06 !important;
        }

        .s14Actions a {
          border-color:#b7e5ca !important;
          background:#effaf4 !important;
          color:#067647 !important;
        }

        /* PAGER */
        .s14Pager {
          margin-top:10px !important;
          padding:8px 10px !important;
          border:1px solid #e7ebf0 !important;
          border-radius:11px !important;
          background:#fff !important;
          box-shadow:none !important;
        }

        .s14Pager button {
          min-height:33px !important;
          border:1px solid #dfe5ec !important;
          border-radius:8px !important;
          background:#f8fafc !important;
          color:#0a2e73 !important;
          font-size:7px !important;
          font-weight:900 !important;
        }

        .s14Pager span {
          color:#667085 !important;
          font-size:7px !important;
          font-weight:850 !important;
        }

        /* PAYMENT CONTROL */
        .s14PaymentRows {
          gap:8px !important;
        }

        .s14PaymentRows > article {
          border:1px solid #e7ebf0 !important;
          border-radius:11px !important;
          background:#fbfcfe !important;
          box-shadow:none !important;
        }

        .s14PaymentRows > article.verifyNow {
          border-color:#f0d68b !important;
          background:#fffaf0 !important;
        }

        .s14PaymentRows strong {
          color:#0a2e73 !important;
        }

        .s14PaymentRows span {
          color:#7b8494 !important;
        }

        .s14PayButtons button {
          border-radius:7px !important;
          box-shadow:none !important;
        }

        .s14PayButtons .verify {
          background:#067647 !important;
          color:#fff !important;
        }

        .s14PayButtons .reject,
        .s14PayButtons .delete {
          background:#fff5f4 !important;
          color:#b42318 !important;
        }

        /* CUSTOMER PANEL */
        .s14Overlay {
          background:rgba(4,15,35,.48) !important;
          backdrop-filter:blur(8px);
        }

        .s14Panel {
          width:min(650px,94vw) !important;
          max-height:92vh !important;
          border:1px solid rgba(10,46,115,.1) !important;
          border-radius:19px !important;
          background:#fff !important;
          box-shadow:0 28px 80px rgba(16,24,40,.24) !important;
        }

        .s14PanelHeader {
          padding:18px !important;
          border-bottom:1px solid #edf0f4 !important;
          background:linear-gradient(180deg,#fff,#fafbfd) !important;
        }

        .s14PanelHeader strong {
          color:#0a2e73 !important;
          font-size:19px !important;
        }

        .s14PanelHeader b,
        .s14PanelHeader small {
          color:#667085 !important;
        }

        .s14PanelHeader > button {
          border:1px solid #dfe5ec !important;
          background:#f8fafc !important;
          color:#0a2e73 !important;
          box-shadow:none !important;
        }

        .s14ModeTabs {
          padding:8px 12px !important;
          border-bottom:1px solid #edf0f4 !important;
          background:#fff !important;
        }

        .s14ModeTabs button {
          min-height:35px !important;
          border-radius:8px !important;
          background:#f7f9fc !important;
          color:#667085 !important;
          font-size:7px !important;
          font-weight:900 !important;
        }

        .s14ModeTabs button.active {
          background:#0a2e73 !important;
          color:#fff !important;
        }

        .s14PresetGrid button,
        .s14PaymentMethods button {
          border:1px solid #e1e6ed !important;
          border-radius:10px !important;
          background:#fafbfd !important;
          box-shadow:none !important;
        }

        .s14PresetGrid button.active,
        .s14PaymentMethods button.active {
          border-color:#d4af37 !important;
          background:#fffaf0 !important;
          color:#0a2e73 !important;
        }

        .s14Field span {
          color:#667085 !important;
          font-size:7px !important;
          font-weight:900 !important;
          letter-spacing:.5px !important;
        }

        .s14Field input,
        .s14Field textarea {
          border:1px solid #d9e0e8 !important;
          border-radius:9px !important;
          background:#fff !important;
          color:#172033 !important;
          font-size:9px !important;
          box-shadow:none !important;
        }

        .s14Field input:focus,
        .s14Field textarea:focus {
          border-color:#0a2e73 !important;
          box-shadow:0 0 0 3px rgba(10,46,115,.06) !important;
        }

        .s14Send {
          min-height:43px !important;
          border:1px solid #d4af37 !important;
          border-radius:10px !important;
          background:linear-gradient(135deg,#08265f,#0a2e73) !important;
          color:#fff !important;
          font-size:8px !important;
          font-weight:950 !important;
          box-shadow:none !important;
        }

        .s14InfoBox,
        .s14RazorBox {
          border-color:#e1e6ed !important;
          background:#f8fafc !important;
          color:#475467 !important;
          box-shadow:none !important;
        }

        .s14Timeline article {
          border-color:#e7ebf0 !important;
          background:#fbfcfe !important;
          box-shadow:none !important;
        }

        .s14Timeline article > span {
          border-color:rgba(212,175,55,.22) !important;
          background:#fffaf0 !important;
          color:#7a5a06 !important;
        }

        .s14Timeline strong {
          color:#0a2e73 !important;
        }

        .s14Timeline p,
        .s14Timeline small {
          color:#667085 !important;
        }

        .s14Notice {
          border-color:#b7e5ca !important;
          background:#effaf4 !important;
          color:#067647 !important;
        }

        .s14Error {
          border-color:#f4c7c3 !important;
          background:#fff5f4 !important;
          color:#b42318 !important;
        }

        .s14Empty {
          border:1px dashed #dfe5ec !important;
          border-radius:11px !important;
          background:#fafbfd !important;
          color:#7b8494 !important;
        }

        /* RESPONSIVE */
        @media (max-width:1320px) {
          .s14Metrics {
            grid-template-columns:repeat(3,minmax(0,1fr)) !important;
          }

          .s14LeadCard {
            grid-template-columns:minmax(180px,1fr) 80px minmax(210px,1.2fr) minmax(160px,.9fr) !important;
          }

          .s14Actions {
            grid-column:1 / -1;
            grid-template-columns:repeat(4,minmax(0,1fr)) !important;
          }
        }

        @media (max-width:900px) {
          .s14Page {
            padding:10px !important;
          }

          .s14Hero {
            grid-template-columns:1fr !important;
            padding:20px !important;
          }

          .s14HeroActions {
            justify-content:flex-start !important;
          }

          .s14Metrics {
            grid-template-columns:repeat(2,minmax(0,1fr)) !important;
          }

          .s14Toolbar {
            position:static !important;
            grid-template-columns:1fr !important;
          }

          .s14SearchWrap {
            min-width:0 !important;
            width:100%;
          }

          .s14SearchWrap input {
            min-width:0 !important;
            flex:1;
          }

          .s14LeadCard {
            grid-template-columns:minmax(0,1fr) 80px !important;
          }

          .s14Interest,
          .s14Signal {
            grid-column:1 / -1;
          }

          .s14Actions {
            grid-template-columns:repeat(2,minmax(0,1fr)) !important;
          }

          .s14RadarGrid {
            grid-template-columns:repeat(2,minmax(0,1fr)) !important;
          }
        }

        @media (max-width:560px) {
          .s14Hero h1 {
            font-size:30px !important;
          }

          .s14HeroActions {
            display:grid !important;
            grid-template-columns:1fr 1fr !important;
            width:100%;
          }

          .s14HeroActions button {
            width:100%;
          }

          .s14Metrics {
            grid-template-columns:repeat(2,minmax(0,1fr)) !important;
          }

          .s14Metrics article {
            min-height:78px;
          }

          .s14Autopilot,
          .s14Radar,
          .s14Payments {
            padding:13px !important;
          }

          .s14Autopilot header,
          .s14Payments header,
          .s14Radar header {
            align-items:flex-start !important;
            flex-direction:column;
          }

          .s14AutoControls {
            justify-content:flex-start !important;
          }

          .s14RadarGrid {
            grid-template-columns:1fr !important;
          }

          .s14Filters {
            flex-wrap:nowrap !important;
            overflow-x:auto;
            scrollbar-width:none;
          }

          .s14Filters::-webkit-scrollbar {
            display:none;
          }

          .s14Filters button {
            flex:0 0 auto;
          }

          .s14SearchWrap {
            align-items:stretch !important;
            flex-direction:column !important;
          }

          .s14LeadCard {
            grid-template-columns:1fr !important;
          }

          .s14Score {
            width:max-content;
            text-align:left;
          }

          .s14Actions {
            grid-template-columns:repeat(2,minmax(0,1fr)) !important;
          }

          .s14Panel {
            width:100vw !important;
            max-width:none !important;
            max-height:94vh !important;
            border-radius:18px 18px 0 0 !important;
          }

          .s14ModeTabs {
            overflow-x:auto;
          }
        }

        @media (prefers-reduced-motion:reduce) {
          .s14Page *,
          .s14Page *::before,
          .s14Page *::after {
            scroll-behavior:auto !important;
            animation-duration:.01ms !important;
            animation-iteration-count:1 !important;
            transition-duration:.01ms !important;
          }
        }

      `}</style>
    </main>
  );
}
