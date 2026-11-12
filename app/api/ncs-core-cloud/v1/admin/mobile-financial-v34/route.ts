import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireRecoveryAdmin } from "@/lib/ncs-recovery-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
  "X-Content-Type-Options": "nosniff",
};
const respond = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });

/** V37 isolated Android owner ledger reader.
 * Based on the exact live-production Git commit. NO ledger/payment writes.
 */
export async function GET(request: Request) {
  if (!/^Bearer\s+\S+$/i.test(request.headers.get("authorization") || "")) {
    return respond({ ok: false, error: "V37_OWNER_TOKEN_REQUIRED" }, 401);
  }

  let authorized = false;
  try {
    authorized = (await requireRecoveryAdmin(request)).ok === true;
  } catch {
    return respond({ ok: false, error: "V37_OWNER_AUTH_UNAVAILABLE" }, 503);
  }
  if (!authorized) {
    return respond({ ok: false, error: "V37_OWNER_AUTH_DENIED" }, 403);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
              process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
              process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) {
    return respond({ ok: false, error: "V37_SERVER_CONFIG_MISSING" }, 503);
  }

  try {
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db.rpc("ncs_account_read_v69", {
      p_kind: "dues",
    });
    if (error) {
      console.error("V37_V69_RPC_FAILED", error.code || "UNKNOWN");
      return respond({ ok: false, error: "V37_LEDGER_READ_FAILED" }, 503);
    }
    if (!data || typeof data !== "object" || Array.isArray(data) ||
        data.ok !== true || data.source !== "SUPABASE_ACCOUNTS_V69" ||
        !Array.isArray(data.accounts) || !Array.isArray(data.transactions)) {
      return respond({ ok: false, error: "V37_V69_LEDGER_NOT_VERIFIED" }, 503);
    }
    return respond(data);
  } catch {
    return respond({ ok: false, error: "V37_LEDGER_READ_FAILED" }, 503);
  }
}

// Payment and reminder mutations are NOT enabled in V37.
export async function POST() {
  return respond({ ok: false, error: "V37_PAYMENTS_NOT_ENABLED_ON_THIS_ROUTE" }, 405);
}
