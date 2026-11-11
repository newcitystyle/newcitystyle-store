import 'server-only';
import { ownerSessionValid } from '@/lib/ncs-neon-vercel-owner-session';
import { requireRecoveryAdmin } from '@/lib/ncs-recovery-admin-server';
import { makeNewBillHandlerV60 } from '@/lib/ncs-new-bill-v60';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const POST=makeNewBillHandlerV60({
 authorized:async request=>ownerSessionValid(request)||(/^Bearer\s+\S+$/i.test(request.headers.get('authorization')||'')&&(await requireRecoveryAdmin(request)).ok),
 serviceKey:()=>process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||'',
});