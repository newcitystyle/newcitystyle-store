import 'server-only';
import { ownerSessionValid } from '@/lib/ncs-neon-vercel-owner-session';
import { requireRecoveryAdmin } from '@/lib/ncs-recovery-admin-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * V70 owner-only Supabase new-epoch sales reader.
 * Never writes, replays or reconciles a bill; historical data is not claimed complete.
 */
const noStore = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });
const fail = (code: string, status: number) => reply({ ok: false, code }, status);

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

  try {
    const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
    if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
    const response = await fetch(
      'https://uskpoaszucenqxlzgmcy.supabase.co/rest/v1/rpc/ncs_new_bills_dashboard_v70',
      { method: 'POST', headers, body: '{}', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) }
    );
    if (!response.ok) return fail('SUPABASE_V70_SALES_READ_UNAVAILABLE', 503);
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return fail('SUPABASE_V70_INVALID_RESPONSE', 503);
    const value = data as Record<string, unknown>;
    if (value.ok !== true || !Array.isArray(value.sales)) return fail('SUPABASE_V70_CONTRACT_INVALID', 503);
    return reply({ ...value, ok: true, source: 'SUPABASE_NEW_BILLS_V70', historicalReconciliationPending: true });
  } catch {
    return fail('SUPABASE_V70_SALES_READ_UNAVAILABLE', 503);
  }
}
