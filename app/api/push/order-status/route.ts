import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  orderId?: string | number;
  status?: string;
};

type OrderRow = {
  id: number;
  user_id?: string | null;
  order_status?: string | null;
  status?: string | null;
  courier_name?: string | null;
  tracking_id?: string | null;
  expected_delivery_date?: string | null;
};

type PushRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count?: number | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeStatus(value: unknown) {
  const status = clean(value).toLowerCase();

  if (status === "confirmed") return "Confirmed";
  if (status === "packed") return "Packed";
  if (status === "shipped") return "Shipped";
  if (status === "out for delivery") return "Out for Delivery";
  if (status === "delivered") return "Delivered";
  if (status === "cancelled" || status === "canceled") {
    return "Cancelled";
  }

  return "";
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

function configureWebPush() {
  const vapidPublic =
    process.env.NEXT_PUBLIC_NCS_VAPID_PUBLIC_KEY?.trim() || "";
  const vapidPrivate =
    process.env.NCS_VAPID_PRIVATE_KEY?.trim() || "";
  const vapidSubject =
    process.env.NCS_VAPID_SUBJECT?.trim() ||
    "mailto:support@newcitystyle.store";

  if (!vapidPublic || !vapidPrivate) {
    throw new Error("VAPID keys are missing.");
  }

  webpush.setVapidDetails(
    vapidSubject,
    vapidPublic,
    vapidPrivate
  );
}

function orderBody(order: OrderRow, status: string) {
  if (status === "Confirmed") {
    return `Order #${order.id} is confirmed. We are preparing it now.`;
  }

  if (status === "Packed") {
    return `Order #${order.id} is packed and ready for dispatch.`;
  }

  if (status === "Shipped") {
    const extra = [
      clean(order.courier_name),
      clean(order.tracking_id)
        ? `Tracking ${clean(order.tracking_id)}`
        : "",
      clean(order.expected_delivery_date)
        ? `ETA ${clean(order.expected_delivery_date)}`
        : "",
    ]
      .filter(Boolean)
      .join(" • ");

    return extra
      ? `Order #${order.id} shipped • ${extra}`
      : `Order #${order.id} has been shipped.`;
  }

  if (status === "Out for Delivery") {
    return `Order #${order.id} is out for delivery.`;
  }

  if (status === "Delivered") {
    return `Order #${order.id} delivered. Thank you for shopping with NEW CITY STYLE.`;
  }

  if (status === "Cancelled") {
    return `Order #${order.id} has been cancelled.`;
  }

  return `Order #${order.id} status updated to ${status}.`;
}

async function sendOrderPush(orderId: number, requestedStatus: string) {
  configureWebPush();

  const supabase = createServerSupabase();

  const { data: order, error: orderError } =
    await supabase
      .from("orders")
      .select(
        "id,user_id,order_status,status,courier_name,tracking_id,expected_delivery_date"
      )
      .eq("id", orderId)
      .single<OrderRow>();

  if (orderError || !order) {
    return NextResponse.json(
      {
        success: false,
        error:
          orderError?.message ||
          `Order #${orderId} was not found.`,
      },
      { status: 404 }
    );
  }

  const dbStatus = normalizeStatus(
    order.order_status || order.status
  );

  if (dbStatus !== requestedStatus) {
    return NextResponse.json(
      {
        success: false,
        error:
          `Order status mismatch. Database=${dbStatus || "-"}, request=${requestedStatus}.`,
      },
      { status: 409 }
    );
  }

  if (!order.user_id) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason:
        "This order is not linked to an authenticated customer user_id.",
    });
  }

  const { data: subscriptions, error: subscriptionError } =
    await supabase
      .from("customer_push_subscriptions")
      .select("id,endpoint,p256dh,auth,failure_count")
      .eq("user_id", order.user_id)
      .eq("is_active", true);

  if (subscriptionError) throw subscriptionError;

  const rows = (subscriptions || []) as PushRow[];

  if (rows.length === 0) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "No active customer push subscriptions.",
    });
  }

  const pushPayload = JSON.stringify({
    title: "NEW CITY STYLE • ORDER PULSE",
    body: orderBody(order, requestedStatus),
    orderId: String(order.id),
    status: requestedStatus,
    url: `/my-orders?order=${encodeURIComponent(
      String(order.id)
    )}`,
  });

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth,
          },
        },
        pushPayload,
        {
          TTL: 60 * 60 * 12,
          urgency:
            requestedStatus === "Out for Delivery"
              ? "high"
              : "normal",
        }
      );

      sent += 1;

      await supabase
        .from("customer_push_subscriptions")
        .update({
          last_success_at: new Date().toISOString(),
          last_error: null,
          failure_count: 0,
        })
        .eq("id", row.id);
    } catch (error: unknown) {
      failed += 1;

      const maybeStatusCode =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error
          ? Number(
              (error as { statusCode?: unknown }).statusCode
            )
          : 0;

      const message =
        error instanceof Error
          ? error.message
          : "Web Push delivery failed.";

      const expired =
        maybeStatusCode === 404 || maybeStatusCode === 410;

      await supabase
        .from("customer_push_subscriptions")
        .update({
          is_active: expired ? false : true,
          last_error: message.slice(0, 1000),
          failure_count:
            Number(row.failure_count || 0) + 1,
        })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({
    success: true,
    orderId,
    status: requestedStatus,
    subscriptions: rows.length,
    sent,
    failed,
  });
}

export async function POST(request: NextRequest) {
  try {
    const secret =
      process.env.NCS_PUSH_WEBHOOK_SECRET?.trim() || "";

    const provided =
      request.headers.get("x-ncs-push-secret")?.trim() || "";

    if (!secret || provided !== secret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Payload;
    const orderId = Number(body.orderId);
    const requestedStatus = normalizeStatus(body.status);

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid orderId is required." },
        { status: 400 }
      );
    }

    if (!requestedStatus) {
      return NextResponse.json(
        { success: false, error: "Supported status is required." },
        { status: 400 }
      );
    }

    return await sendOrderPush(orderId, requestedStatus);
  } catch (error) {
    console.error("NCS order push error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected push error.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const testMode = url.searchParams.get("test");

    /*
     * TEMPORARY ONE-ORDER PUSH TEST
     * -----------------------------
     * Restricted to historical Order #12 + Delivered.
     * Does NOT change order, stock, POS, payment, or WhatsApp.
     * It only attempts Web Push delivery to existing active subscriptions.
     * Remove this branch after runtime verification.
     */
    if (testMode === "order12") {
      return await sendOrderPush(12, "Delivered");
    }

    return NextResponse.json({
      success: true,
      route: "NCS Live Order Pulse V8",
      configured: {
        webhookSecret: Boolean(
          process.env.NCS_PUSH_WEBHOOK_SECRET?.trim()
        ),
        vapidPublic: Boolean(
          process.env.NEXT_PUBLIC_NCS_VAPID_PUBLIC_KEY?.trim()
        ),
        vapidPrivate: Boolean(
          process.env.NCS_VAPID_PRIVATE_KEY?.trim()
        ),
        subject:
          process.env.NCS_VAPID_SUBJECT?.trim() ||
          "mailto:support@newcitystyle.store",
      },
    });
  } catch (error) {
    console.error("NCS order push GET error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected push error.",
      },
      { status: 500 }
    );
  }
}
