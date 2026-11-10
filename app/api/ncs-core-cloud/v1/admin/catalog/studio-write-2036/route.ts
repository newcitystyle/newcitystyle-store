import { neon } from "@neondatabase/serverless";
import { ownerSessionValid } from "@/lib/ncs-neon-vercel-owner-session";

/**
 * TEMPORARY OWNER-ONLY LEGACY READER.
 * Existing design photos and links live in historical Neon data.
 * No POST or writes are exposed. All new design publication goes to
 * the separate Supabase Studio V11 endpoint.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SCHEMA = "ncs_business_fresh_20261012_162606";
const HEADERS = { "Cache-Control": "private,no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" };
const fail=(code:string,status:number)=>Response.json({ok:false,code},{status,headers:HEADERS});

export async function GET(req:Request) {
 if(!ownerSessionValid(req)) return fail("OWNER_LOGIN_REQUIRED",401);
 const raw=new URL(req.url).searchParams.get("productId")||"";
 if(!/^[1-9][0-9]{0,14}$/.test(raw)) return fail("INVALID_PRODUCT_ID",400);
 const id=Number(raw);
 if(!Number.isSafeInteger(id)) return fail("INVALID_PRODUCT_ID",400);
 const connection=process.env.NCS_NEON_DATABASE_URL;
 if(!connection) return fail("LEGACY_DESIGN_ARCHIVE_NOT_CONFIGURED",503);
 try {
   const sql=neon(connection);
   const rows=await sql.query(`
      SELECT p.id,p.name,p.barcode,p.sell_online,p.is_active,p.price,
      COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id)
        FROM "${SCHEMA}".product_variants v WHERE v.product_id=p.id),'[]'::jsonb) AS variants,
      COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.sort_order,d.id)
        FROM "${SCHEMA}".product_design_units d WHERE d.product_id=p.id),'[]'::jsonb) AS designs,
      COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id)
        FROM "${SCHEMA}".product_design_unit_variants l WHERE l.product_id=p.id),'[]'::jsonb) AS links
      FROM "${SCHEMA}".products p WHERE p.id=$1::bigint LIMIT 1
   `,[id]);
   if(!Array.isArray(rows)||rows.length!==1)return fail("LEGACY_PRODUCT_NOT_FOUND",404);
   const p=rows[0] as Record<string,unknown>;
   const variants=Array.isArray(p.variants)?p.variants:[];
   const designs=Array.isArray(p.designs)?p.designs:[];
   const links=Array.isArray(p.links)?p.links:[];
   const stock=variants.reduce((n:number,v:any)=>n+Math.max(0,Number(v.stock||0)-Number(v.reserved_stock||0)),0);
   const blockers:string[]=[];
   if(p.sell_online!==true)blockers.push("Online sale is OFF in legacy catalog");
   const badge=`Product #${id} | ${String(p.barcode||"No barcode")} | Available stock: ${stock}`;
   return Response.json({ok:true,version:36,productId:id,
     variants,designs,links,availableStock:stock,blockers,
     message:badge+(blockers.length?" | "+blockers.join(". "):
       " | Legacy design snapshot; website publication must be confirmed in Supabase."),
     checkedAt:new Date().toISOString(),source:"LEGACY_READ_ONLY"}, {headers:HEADERS});
 }catch(e){
   console.error("NCS_STUDIO_LEGACY_READ_FAILED",e instanceof Error?e.name:"UNKNOWN");
   return fail("LEGACY_DESIGN_READ_UNAVAILABLE",503);
 }
}
