import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const verifiedSupabaseProjectUrl = "https://uskpoaszucenqxlzgmcy.supabase.co";
const ownerEmail = "badri.nsv@gmail.com";

function noCache(data: Record<string, unknown>, status: number) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

// GET is deliberately read-only. This route never writes bills, payments or stock.
// It exposes only summary totals, and only to the verified shop-owner session.
export async function GET(request: NextRequest) {
  const accessToken = request.headers.get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return noCache({ ok: false, error: "OWNER_LOGIN_REQUIRED" }, 401);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return noCache({ ok: false, error: "LEDGER_SERVICE_NOT_CONFIGURED" }, 503);
  try {
    const client = createClient(verifiedSupabaseProjectUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { data: userResult, error: userError } =
      await client.auth.getUser(accessToken);
    if (userError || userResult.user?.email?.trim().toLowerCase() !== ownerEmail) {
      return noCache({ ok: false, error: "OWNER_AUTH_FAILED" }, 403);
    }
    const { data: ledger, error } = await client.rpc("ncs_account_read_v69", {
      p_kind: "suppliers",
    });
    if (error || ledger?.ok !== true || !Array.isArray(ledger.suppliers)) {
      return noCache({ ok: false, error: "V69_LEDGER_READ_FAILED" }, 503);
    }
    let totalPurchase = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let dueSuppliers = 0;
    for (const row of ledger.suppliers) {
      if (row?.is_active === false) continue;
      const purchase = Number(row.total_purchase_amount ?? 0);
      const paid = Number(row.total_paid_amount ?? 0);
      const due = Number(row.current_balance ?? 0);
      if (![purchase, paid, due].every(Number.isFinite)) {
        return noCache({ ok: false, error: "INVALID_LEDGER_TOTAL" }, 503);
      }
      totalPurchase += purchase;
      totalPaid += paid;
      totalDue += due;
      if (due > 0) dueSuppliers++;
    }
    const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    return noCache({
      ok: true,
      source: "SUPABASE_ACCOUNTS_V69",
      totalPurchase: round(totalPurchase),
      totalPaid: round(totalPaid),
      totalDue: round(totalDue),
      dueSuppliers,
    }, 200);
  } catch {
    return noCache({ ok: false, error: "V69_LEDGER_UNAVAILABLE" }, 503);
  }
}
