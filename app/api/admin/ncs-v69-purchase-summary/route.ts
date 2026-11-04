import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL = "https://uskpoaszucenqxlzgmcy.supabase.co";
const OWNER_EMAIL = "badri.nsv@gmail.com";

function respond(data: Record<string, unknown>, status: number) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

// Read-only owner ledger summary. Never allow anonymous access to financial data.
export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return respond({ ok: false, error: "LOGIN_REQUIRED" }, 401);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return respond({ ok: false, error: "LEDGER_SERVER_NOT_CONFIGURED" }, 503);

  try {
    const db = createClient(SUPABASE_URL, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || auth.user?.email?.trim().toLowerCase() !== OWNER_EMAIL) {
      return respond({ ok: false, error: "OWNER_LOGIN_REQUIRED" }, 403);
    }

    const { data, error } = await db.rpc("ncs_account_read_v69", {
      p_kind: "suppliers",
    });
    if (error || !data?.ok || !Array.isArray(data.suppliers)) {
      return respond({ ok: false, error: "V69_LEDGER_UNAVAILABLE" }, 503);
    }

    let totalPurchase = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let dueSuppliers = 0;
    for (const entry of data.suppliers) {
      if (entry?.is_active === false) continue;
      const purchase = Number(entry.total_purchase_amount ?? 0);
      const paid = Number(entry.total_paid_amount ?? 0);
      const due = Number(entry.current_balance ?? 0);
      if (![purchase, paid, due].every(Number.isFinite)) {
        return respond({ ok: false, error: "V69_LEDGER_INVALID_VALUE" }, 503);
      }
      totalPurchase += purchase;
      totalPaid += paid;
      totalDue += due;
      if (due > 0) dueSuppliers += 1;
    }
    const rounded = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    return respond({
      ok: true,
      source: "SUPABASE_ACCOUNTS_V69",
      totalPurchase: rounded(totalPurchase),
      totalPaid: rounded(totalPaid),
      totalDue: rounded(totalDue),
      dueSuppliers,
    }, 200);
  } catch {
    return respond({ ok: false, error: "V69_LEDGER_READ_FAILED" }, 503);
  }
}
