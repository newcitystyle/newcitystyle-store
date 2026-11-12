import "server-only";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { ownerSessionValid } from "@/lib/ncs-neon-vercel-owner-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const fail = (code: string, status = 422) => Response.json(
  { ok: false, code, safeToMarkLocalSaleSynced: false }, { status, headers });
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const cents = (v: unknown): number | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v * 100);
  return Number.isSafeInteger(n) && Math.abs(v * 100 - n) < 0.00001 ? n : null;
};
const positiveInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const validId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9:_-]{12,128}$/.test(v);

/** Owner-authenticated, same-ID Neon inbox + canonical commit for Android/LIVA.
 * NEVER acknowledge from inbox receipt. The DB coordinator alone authorizes SYNCED.
 * No manual stock writes: canonical coordinator remains the sole stock writer.
 */
export async function POST(req: Request) {
  if (!ownerSessionValid(req)) return fail("OWNER_SESSION_REQUIRED",401);
  if (req.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return fail("JSON_REQUIRED",415);
  let input: unknown;
  try { const raw = await req.text(); if (Buffer.byteLength(raw,"utf8") > 65536) return fail("TOO_LARGE",413); input = JSON.parse(raw); }
  catch { return fail("INVALID_JSON",400); }
  if (!object(input) || !validId(input.clientTransactionId) || typeof input.invoiceNumber !== "string" ||
      input.invoiceNumber.length < 4 || input.invoiceNumber.length > 128 || !Array.isArray(input.items) ||
      input.items.length === 0 || input.items.length > 100) return fail("INVALID_SALE");
  if (typeof input.createdAt !== "string" || !Number.isFinite(Date.parse(input.createdAt))) return fail("INVALID_DATE");
  const subtotal = cents(input.subtotal), total = cents(input.total), paid = cents(input.paid), due = cents(input.due),
    discount = cents(input.billDiscount), roundoff = cents(input.roundOff);
  if ([subtotal,total,paid,due,discount,roundoff].some(v=>v===null) || total! <= 0 || paid! < 0 ||
      due! < 0 || paid!+due! !== total! || subtotal! - discount! + roundoff! !== total!) return fail("AMOUNTS_MISMATCH");
  // Safe first rollout: paid cash/UPI/card only. Mixed tender and credit need separate approved mapping.
  const method = input.paymentMethod;
  if (!(["cash","upi","card"] as unknown[]).includes(method) || due !== 0 || paid !== total)
    return fail("ANDROID_MIXED_OR_CREDIT_NEEDS_RECONCILIATION",422);
  const rows: Record<string,unknown>[] = [];
  let itemSum = 0;
  for (const raw of input.items) {
    if (!object(raw) || !positiveInt(raw.quantity) || raw.quantity > 500 ||
        typeof raw.name !== "string" || !raw.name.trim() || raw.name.length > 250) return fail("INVALID_ITEM");
    const line = cents(raw.lineTotal), mrp = cents(raw.mrp), price = cents(raw.unitPrice);
    if (line === null || line < 0 || mrp === null || mrp < 0 || price === null || price < 0) return fail("INVALID_ITEM_MONEY");
    if (price * raw.quantity !== line) return fail("ANDROID_LINE_DISCOUNT_NEEDS_MAPPING",422);
    const quick = raw.isQuickItem === true;
    if (!quick && !positiveInt(raw.productId)) return fail("CATALOG_PRODUCT_ID_REQUIRED",422);
    if (raw.variantId != null && !positiveInt(raw.variantId)) return fail("INVALID_VARIANT_ID",422);
    itemSum += line;
    rows.push({ productId: quick ? 0 : raw.productId, variantId: raw.variantId ?? null,
      name: raw.name, size: typeof raw.size === "string" ? raw.size : "",
      color: typeof raw.color === "string" ? raw.color : "", quantity: raw.quantity,
      price: price / 100, mrp: mrp / 100, taxPercent: 0, isQuickItem: quick,
      quickPurchasePrice: null, quickSaveAsProduct: false, quickRemainingStock: null });
  }
  if (itemSum !== subtotal) return fail("ITEM_SUBTOTAL_MISMATCH");
  const name = typeof input.customerName === "string" ? input.customerName.slice(0,200) : "";
  const phone = typeof input.customerPhone === "string" ? input.customerPhone.slice(0,40) : "";
  const payload = { clientTransactionId: input.clientTransactionId, offlineInvoiceNumber: input.invoiceNumber,
    createdAt: input.createdAt, customerName: name, customerPhone: phone, items: rows,
    subtotal: subtotal! / 100, taxAmount: 0, billDiscountAmount: discount! / 100,
    rewardDiscountAmount: 0, rewardPointsUsed: 0, roundOffAmount: -roundoff! / 100,
    finalPayable: total! / 100, paidAmount: paid! / 100, dueAmount: 0,
    paymentMethod: method, paymentBreakdown: { cash: method==="cash"? paid! / 100 : 0,
      upi: method==="upi"? paid! / 100 : 0, card: method==="card"? paid! / 100 : 0 }, creditDueDate: null };
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const dbUrl = process.env.NCS_NEON_DATABASE_URL;
  if (!dbUrl || !/^postgres(?:ql)?:\/\//i.test(dbUrl)) return fail("NEON_NOT_CONFIGURED",503);
  try {
    const sql = neon(dbUrl);
    const inserted = await sql`INSERT INTO ncs_core_cloud_2036.pending_bill_inbox
      (client_transaction_id,payload_sha256,payload,device_id,total_amount,paid_amount,due_amount)
      VALUES (${payload.clientTransactionId},${hash},${JSON.stringify(payload)}::jsonb,
        ${"android-liva"},${payload.finalPayable}::numeric,${payload.paidAmount}::numeric,0::numeric)
      ON CONFLICT (client_transaction_id) DO UPDATE SET
        last_seen_at = now(), seen_count = ncs_core_cloud_2036.pending_bill_inbox.seen_count + 1
      WHERE ncs_core_cloud_2036.pending_bill_inbox.payload_sha256 = EXCLUDED.payload_sha256
      RETURNING client_transaction_id`;
    if (inserted.length !== 1) return fail("DUPLICATE_TRANSACTION_PAYLOAD_CONFLICT",409);
    const committed = await sql`SELECT ncs_core_cloud_2036.commit_inbox_atomic_v1(
      ${payload.clientTransactionId}::text,${hash}::text) AS receipt`;
    const receipt = committed[0]?.receipt as Record<string,unknown> | undefined;
    if (!receipt || receipt.committed !== true || receipt.clientTransactionId !== payload.clientTransactionId ||
        receipt.payloadFingerprint !== hash || typeof receipt.saleId !== "string" ||
        ["idempotencyVerified","itemsVerified","paymentsVerified","stockVerified",
         "cashBookVerified","creditVerified","ledgersVerified"].some(k=>receipt[k]!==true))
      return fail("CANONICAL_RECEIPT_NOT_VERIFIED_KEEP_PENDING",409);
    return Response.json({ ok: true, code: "ANDROID_NEON_CANONICAL_COMMITTED",
      safeToMarkLocalSaleSynced: true, saleId: receipt.saleId,
      clientTransactionId: payload.clientTransactionId, invoiceNumber: payload.offlineInvoiceNumber },
      { status: 200, headers });
  } catch (e) {
    console.error("ANDROID_NEON_COMMIT_UNCONFIRMED", e instanceof Error ? e.name : "unknown");
    return fail("ANDROID_COMMIT_UNCONFIRMED_RETRY_SAME_ID",503);
  }
}
