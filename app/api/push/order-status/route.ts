import { createHash } from "crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  orderId?: string | number;
  order_id?: string | number;
  status?: string;
  orderStatus?: string;
  newStatus?: string;
};

type OrderRow = {
  id: number;
  email?: string | null;
  phone?: string | null;
  order_status?: string | null;
  status?: string | null;
  courier_name?: string | null;
  tracking_id?: string | null;
  expected_delivery_date?: string | null;
};

type DeviceRow = {
  installation_id: string;
  fcm_token: string;
  failure_count?: number | null;
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

function normalizeStatus(value: unknown) {
  const status = clean(value).toLowerCase();

  if (status === "pending") return "Pending";
  if (status === "confirmed") return "Confirmed";
  if (status === "packed") return "Packed";
  if (status === "shipped") return "Shipped";
  if (status === "out for delivery") return "Out for Delivery";
  if (status === "delivered") return "Delivered";
  if (status === "cancelled" || status === "canceled") return "Cancelled";

  return "";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
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

function getFirebaseMessaging() {
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() || "";

  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing.");
  }

  let account: {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  try {
    account = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }

  const projectId = clean(account.project_id);
  const clientEmail = clean(account.client_email);
  const privateKey = clean(account.private_key).replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase service account JSON is incomplete.");
  }

  if (projectId !== "new-city-style") {
    throw new Error(
      `Firebase project mismatch. Expected new-city-style, received ${projectId}.`
    );
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return getMessaging();
}

function notificationBody(order: OrderRow, status: string) {
  if (status === "Confirmed") {
    return `Order #${order.id} confirmed. We are preparing it now.`;
  }

  if (status === "Packed") {
    return `Order #${order.id} packed and ready for dispatch.`;
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

async function loadMatchingDevices(
  supabase: ReturnType<typeof createServerSupabase>,
  order: OrderRow
) {
  const phone = normalizePhone(order.phone);
  const email = normalizeEmail(order.email);

  const devices = new Map<string, DeviceRow>();

  if (phone) {
    const { data, error } = await supabase
      .from("customer_native_push_devices")
      .select("installation_id,fcm_token,failure_count")
      .eq("notifications_enabled", true)
      .eq("phone_hash", sha256(phone));

    if (error) throw error;

    for (const row of (data || []) as DeviceRow[]) {
      devices.set(row.installation_id, row);
    }
  }

  if (email) {
    const { data, error } = await supabase
      .from("customer_native_push_devices")
      .select("installation_id,fcm_token,failure_count")
      .eq("notifications_enabled", true)
      .eq("email_hash", sha256(email));

    if (error) throw error;

    for (const row of (data || []) as DeviceRow[]) {
      devices.set(row.installation_id, row);
    }
  }

  return [...devices.values()];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Payload;

    const orderId = Number(body.orderId ?? body.order_id);
    const requestedStatus = normalizeStatus(
      body.status ?? body.orderStatus ?? body.newStatus
    );

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid orderId is required." },
        { status: 400 }
      );
    }

    if (!requestedStatus || requestedStatus === "Pending") {
      return NextResponse.json(
        { success: false, error: "Supported customer status is required." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id,email,phone,order_status,status,courier_name,tracking_id,expected_delivery_date"
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

    /*
     * Safety gate:
     * This route NEVER changes order status. It only sends a push when
     * the database already contains exactly the requested status.
     * This lets the existing Android owner app call it after the real
     * order update without putting a service-role secret inside the APK.
     */
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

    const devices = await loadMatchingDevices(supabase, order);

    if (devices.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        orderId,
        status: requestedStatus,
        reason:
          "No enabled native app device matched this order phone/email.",
      });
    }

    const messaging = getFirebaseMessaging();

    let sent = 0;
    let failed = 0;
    let duplicateSkipped = 0;

    const title = "NEW CITY STYLE • ORDER UPDATE";
    const bodyText = notificationBody(order, requestedStatus);

    for (const device of devices) {
      const { data: existingLog, error: existingLogError } =
        await supabase
          .from("customer_native_push_delivery_log")
          .select("id,delivery_status")
          .eq("installation_id", device.installation_id)
          .eq("order_id", orderId)
          .eq("order_status", requestedStatus)
          .maybeSingle();

      if (existingLogError) throw existingLogError;

      if (existingLog?.delivery_status === "sent") {
        duplicateSkipped += 1;
        continue;
      }

      try {
        const messageId = await messaging.send({
          token: device.fcm_token,
          data: {
            kind: "order_status",
            title,
            body: bodyText,
            orderId: String(orderId),
            status: requestedStatus,
            courierName: clean(order.courier_name),
            trackingId: clean(order.tracking_id),
            expectedDeliveryDate: clean(
              order.expected_delivery_date
            ),
            openScreen: "orders",
            source: "NCS_ORDER_STATUS",
          },
          android: {
            priority: "high",
            ttl: 60 * 60 * 12 * 1000,
          },
        });

        sent += 1;

        await supabase
          .from("customer_native_push_devices")
          .update({
            failure_count: 0,
            last_success_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("installation_id", device.installation_id);

        await supabase
          .from("customer_native_push_delivery_log")
          .upsert(
            {
              installation_id: device.installation_id,
              order_id: orderId,
              order_status: requestedStatus,
              firebase_message_id: messageId,
              delivery_status: "sent",
              last_error: null,
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "installation_id,order_id,order_status",
            }
          );
      } catch (error: unknown) {
        failed += 1;

        const message =
          error instanceof Error
            ? error.message
            : "Firebase order push failed.";

        const code =
          typeof error === "object" &&
          error !== null &&
          "code" in error
            ? clean((error as { code?: unknown }).code)
            : "";

        const invalidToken =
          code.includes("registration-token-not-registered") ||
          code.includes("invalid-registration-token");

        await supabase
          .from("customer_native_push_devices")
          .update({
            notifications_enabled: invalidToken ? false : true,
            failure_count: Number(device.failure_count || 0) + 1,
            last_error: message.slice(0, 1000),
            updated_at: new Date().toISOString(),
          })
          .eq("installation_id", device.installation_id);

        await supabase
          .from("customer_native_push_delivery_log")
          .upsert(
            {
              installation_id: device.installation_id,
              order_id: orderId,
              order_status: requestedStatus,
              delivery_status: "failed",
              last_error: message.slice(0, 1000),
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "installation_id,order_id,order_status",
            }
          );
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      status: requestedStatus,
      matchedDevices: devices.length,
      sent,
      failed,
      duplicateSkipped,
    });
  } catch (error) {
    console.error("NCS native order status push error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected native order push error.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "NCS Native Order Status Push",
    configured: {
      firebaseServiceAccount: Boolean(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
      ),
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
    firebaseProject: "new-city-style",
    delivery: "direct-device-token",
    dedupe: "order + status + installation",
  });
}
