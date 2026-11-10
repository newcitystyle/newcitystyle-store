import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ownerSessionValid } from "@/lib/ncs-neon-vercel-owner-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" };
const fail = (error: string, status = 400) => Response.json({ ok: false, error }, { status, headers });
function originAllowed(req: Request): boolean {
  const incoming = req.headers.get("origin");
  if (!incoming) return false;
  try {
    const origin = new URL(incoming);
    const target = new URL(req.url);
    const host = req.headers.get("host") || target.host;
    if (origin.origin === target.origin) return true;
    // Desktop loopback is permitted only for a request actually served on that loopback host.
    return origin.protocol === "http:" && origin.hostname === "127.0.0.1" &&
      origin.port === "32145" && host === "127.0.0.1:32145";
  } catch { return false; }
}
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export async function POST(req: Request) {
  if (!ownerSessionValid(req)) return fail("OWNER_LOGIN_REQUIRED", 401);
  if (!originAllowed(req)) return fail("INVALID_ORIGIN", 403);
  if (Number(req.headers.get("content-length") || 0) > 131072) return fail("REQUEST_TOO_LARGE", 413);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "").trim();
  if (!key) return fail("SUPABASE_SERVER_KEY_MISSING", 503);
  let body: unknown;
  try { body = await req.json(); } catch { return fail("INVALID_JSON"); }
  if (!isObject(body) || !Number.isSafeInteger(body.productId) || Number(body.productId) <= 0 ||
      !isObject(body.productPatch) || !Array.isArray(body.variantPatches) ||
      body.variantPatches.length > 160 || JSON.stringify(body).length > 120000) return fail("INVALID_EDITOR_PAYLOAD");
  const client = createClient("https://uskpoaszucenqxlzgmcy.supabase.co", key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-NCS-Caller": "DESKTOP_WEB_EDITOR_V5" } },
  });
  try {
    const { data, error } = await client.rpc("ncs_desktop_product_editor_v5", {
      p_product_id: Number(body.productId),
      p_patch: body.productPatch,
      p_variants: body.variantPatches,
    });
    if (error) {
      console.error("NCS_DESKTOP_EDITOR_V5_RPC", error.code || "UNKNOWN");
      return fail(error.message?.startsWith("NCS_") ? error.message : "PRODUCT_SAVE_REJECTED", 409);
    }
    if (!isObject(data) || data.ok !== true || Number(data.product_id) !== Number(body.productId)) {
      return fail("SAVE_NOT_VERIFIED", 503);
    }
    return Response.json({ ok: true, productId: data.product_id, savedVariants: data.saved_variants, source: "SUPABASE_V5" }, { headers });
  } catch (err) {
    console.error("NCS_DESKTOP_EDITOR_V5", err instanceof Error ? err.name : "UNKNOWN");
    return fail("SUPABASE_SAVE_UNAVAILABLE", 503);
  }
}
