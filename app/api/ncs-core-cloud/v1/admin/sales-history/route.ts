import 'server-only';
import { ownerSessionValid } from '@/lib/ncs-neon-vercel-owner-session';
import { requireRecoveryAdmin } from '@/lib/ncs-recovery-admin-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Owner-authenticated, read-only, bounded Supabase V70 sales snapshot.
 * This endpoint does not migrate, replay, modify, or book any transaction.
 */
const headersOut = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: headersOut });
const fail = (code: string, status: number) => respond({ ok: false, code }, status);

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('kind') !== 'sales') return fail('SUPPORTED_KIND_SALES_ONLY', 400);

  let authorized = ownerSessionValid(request);
  if (!authorized && /^Bearer\s+\S+$/i.test(request.headers.get('authorization') || '')) {
    try { authorized = (await requireRecoveryAdmin(request)).ok; } catch { authorized = false; }
  }
  if (!authorized) return fail('OWNER_LOGIN_REQUIRED', 401);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();
  if (!key) return fail('SUPABASE_SERVER_KEY_MISSING', 503);

  // ncs_new_bills_dashboard_v70 REQUIRES both date parameters, and rejects
  // spans exceeding 62 days. 60 days covers Home's month and 10-day charts.
  const until = new Date(Date.now() + 60_000).toISOString();
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;

  try {
    const response = await fetch(
      'https://uskpoaszucenqxlzgmcy.supabase.co/rest/v1/rpc/ncs_new_bills_dashboard_v70',
      { method: 'POST', headers,
        body: JSON.stringify({ p_since: since, p_until: until }),
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) }
    );
    if (!response.ok) return fail('SUPABASE_V70_SALES_READ_UNAVAILABLE', 503);
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return fail('SUPABASE_V70_INVALID_RESPONSE', 503);
    const obj = data as Record<string, unknown>;
    if (obj.ok !== true || obj.source !== 'SUPABASE_NEW_BILLS_V60' ||
        !Array.isArray(obj.sales) || typeof obj.truncated !== 'boolean')
      return fail('SUPABASE_V70_CONTRACT_INVALID', 503);
    if (obj.truncated) return fail('SUPABASE_V70_TRUNCATED_KEEP_LOCAL', 503);
    return respond({ ...obj, historicalReconciliationPending: true });
  } catch {
    return fail('SUPABASE_V70_SALES_READ_UNAVAILABLE', 503);
  }
}
