import "server-only";
import { neon } from "@neondatabase/serverless";
import { ownerSessionValid } from "@/lib/ncs-neon-vercel-owner-session";

/**
 * An ADDITIVE API solely for updating EXISTING products from the original
 * Android Native Product Editor. Neither inventory movements nor variant /
 * design / AI / financial tables are written here.
 *
 * The pre-existing `simple-product` API is deliberately left UNTOUCHED.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = {
  "Cache-Control": "private, no-store",
  "Vary": "Cookie",
  "X-Content-Type-Options": "nosniff",
  "X-NCS-Native-Endpoint": "2036-v2",
};
const reply = (code: string, status: number) =>
  Response.json({ ok: false, code }, { status, headers: HEADERS });
const has = (x: Record<string, unknown>, name: string) =>
  Object.prototype.hasOwnProperty.call(x, name);

export async function POST(req: Request) {
  if (!ownerSessionValid(req)) return reply("NCS_OWNER_LOGIN_REQUIRED", 401);
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin) return reply("INVALID_ORIGIN", 403);
  if (Number(req.headers.get("content-length") || 0) > 12000)
    return reply("BODY_TOO_LARGE", 413);
  const connection = process.env.NCS_NEON_DATABASE_URL;
  if (!connection) return reply("NEON_NOT_CONFIGURED", 503);

  let body: Record<string, unknown>;
  try {
    const input: unknown = await req.json();
    if (!input || Array.isArray(input) || typeof input !== "object") throw Error();
    body = input as Record<string, unknown>;
  } catch { return reply("INVALID_JSON", 400); }
  const allowed = new Set([
    "productId", "name", "description", "mrp", "price",
    "onlineStockLimit", "sellOnline", "imageUrl",
  ]);
  if (Object.keys(body).some((k) => !allowed.has(k)))
    return reply("UNKNOWN_FIELD", 400);
  const id = Number(body.productId);
  const mrp = Number(body.mrp);
  const price = Number(body.price);
  const name = body.name;
  const description = body.description;
  if (!Number.isSafeInteger(id) || id <= 0 ||
      typeof name !== "string" || name.trim().length < 1 || name.length > 300 ||
      typeof description !== "string" || description.length > 10000 ||
      !Number.isFinite(mrp) || mrp < 0 || mrp > 100000000 ||
      !Number.isFinite(price) || price < 0 || price > 100000000) {
    return reply("INVALID_PRODUCT_DETAILS", 400);
  }
  const changeOnlineLimit = has(body, "onlineStockLimit");
  const limit = changeOnlineLimit ? Number(body.onlineStockLimit) : null;
  if (changeOnlineLimit && (limit === null || !Number.isSafeInteger(limit) || limit < 0 || limit > 1000000))
    return reply("INVALID_ONLINE_LIMIT", 400);
  const changeVisibility = has(body, "sellOnline");
  if (changeVisibility && typeof body.sellOnline !== "boolean")
    return reply("INVALID_VISIBILITY", 400);

  const imageUrl = has(body, "imageUrl") ? body.imageUrl : null;
  if (imageUrl !== null) {
    if (typeof imageUrl !== "string" || imageUrl.length > 2048)
      return reply("INVALID_IMAGE", 400);
    const base = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
    if (!base || !base.startsWith("https://")) return reply("R2_BASE_NOT_CONFIGURED", 503);
    try {
      const photo = new URL(imageUrl);
      const expected = new URL(base);
      if (photo.protocol !== "https:" || photo.origin !== expected.origin ||
          !photo.pathname.startsWith(expected.pathname.replace(/\/$/, "") + "/")) {
        return reply("IMAGE_MUST_BE_STORE_R2", 400);
      }
    } catch { return reply("INVALID_IMAGE", 400); }
  }

  try {
    const db = neon(connection);
    // Canonical product row; never write stock, variants, design units, POS or cashbook.
    const result = await db.query(`
      UPDATE "ncs_business_fresh_20261012_162606"."products"
      SET name = $2, description = $3, mrp = $4, price = $5,
          online_stock_limit = CASE WHEN $6::boolean THEN $7::integer ELSE online_stock_limit END,
          sell_online = CASE WHEN $8::boolean THEN $9::boolean ELSE sell_online END,
          image = COALESCE($10::text, image),
          image_url = COALESCE($10::text, image_url),
          updated_at = now()
      WHERE id = $1 AND COALESCE(is_active, true) = true
      RETURNING id, name, mrp, price, image_url
    `, [
      id, name.trim(), description, mrp, price,
      changeOnlineLimit, limit, changeVisibility,
      changeVisibility ? body.sellOnline : null, imageUrl,
    ]);
    if (!Array.isArray(result)) return reply("UNEXPECTED_NEON_RESULT", 503);
    if (result.length !== 1) return reply("PRODUCT_NOT_FOUND_OR_INACTIVE", 404);
    return Response.json({ ok: true, product: result[0] }, { headers: HEADERS });
  } catch (err) {
    console.error("NCS_NATIVE_EXISTING_PRODUCT_SAVE_FAILED", err instanceof Error ? err.name : "UNKNOWN");
    return reply("NEON_PRODUCT_SAVE_UNAVAILABLE", 503);
  }
}
