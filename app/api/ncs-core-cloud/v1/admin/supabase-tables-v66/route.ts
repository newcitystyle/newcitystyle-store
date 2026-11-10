import { ownerSessionValid } from '@/lib/ncs-neon-vercel-owner-session';
import { ncsV72Read } from '@/lib/ncs-v72-server-supabase';

/**
 * Backward-compatible owner-only Products listing for the existing
 * NEW CITY STYLE Website Android App.
 * Read-only. Never changes stock, publishing, variants or finances.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS: Record<string,string> = {
  'Cache-Control': 'private, no-store',
  'Vary': 'Cookie',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET(req: Request) {
  if (!ownerSessionValid(req)) {
    return Response.json({ ok: false, code: 'OWNER_LOGIN_REQUIRED' }, {status:401,headers:HEADERS});
  }
  const url = new URL(req.url);
  if (url.searchParams.get('kind') !== 'catalog') {
    return Response.json({ ok: false, code: 'CATALOG_ONLY' }, {status:400,headers:HEADERS});
  }
  try {
    const products = await ncsV72Read('products', new URLSearchParams({
      select: '*',
      order: 'id.desc',
      limit: '1000',
    }), 20000);
    return Response.json({ ok: true, source: 'SUPABASE_CANONICAL_READ_ONLY', products }, {headers:HEADERS});
  } catch (error) {
    console.error('NCS_WEBSITE_APP_PRODUCTS_READ', error instanceof Error ? error.message : 'UNKNOWN');
    return Response.json({ ok:false, code:'SUPABASE_PRODUCTS_READ_FAILED' }, {status:503,headers:HEADERS});
  }
}
