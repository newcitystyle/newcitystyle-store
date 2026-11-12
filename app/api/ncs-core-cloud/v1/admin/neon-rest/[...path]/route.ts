import "server-only";
import { ownerSessionValid } from "@/lib/ncs-neon-vercel-owner-session";
import { requireRecoveryAdmin } from "@/lib/ncs-recovery-admin-server";
import { ncsV274ServerKeys } from "@/lib/ncs-v72-server-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compatibility adapter for installed Android Billing + Website control apps.
 * Existing clients call /ncs-core-cloud/v1/admin/neon-rest/{table}.
 * Finance/stock writes must NOT pass through this adapter.
 * Configuration and new-online-credit READS come from the current Supabase store,
 * NEVER an October 2026 Neon snapshot.
 */
const CONFIG = new Set(["branding_settings","store_settings","site_content",
  "seo_settings","analytics_settings","shipping_settings","payment_settings"]);
const CREDIT_READ_ONLY = new Set(["customer_credit_accounts","customer_credit_transactions"]);
const ALLOWED = new Set([...CONFIG,...CREDIT_READ_ONLY]);
const OUT = {"Cache-Control":"private, no-store",Vary:"Cookie, Authorization",
  "X-Content-Type-Options":"nosniff","X-NCS-Source":"SUPABASE_LIVE_COMPAT_V46"};
const err = (code:string,status:number) => Response.json(
  {code,message:code,details:null,hint:null},{status,headers:OUT});

async function allowedOwner(r:Request){
 if(ownerSessionValid(r))return true;
 if(!/^Bearer\s+\S+$/i.test(r.headers.get("authorization")||""))return false;
 try {return (await requireRecoveryAdmin(r)).ok===true;}catch{return false;}
}
type Ctx={params:Promise<{path:string[]}>};
async function handle(r:Request,{params}:Ctx){
 if(!(await allowedOwner(r)))return err("OWNER_SESSION_REQUIRED",401);
 const {path}=await params;
 if(path.length!==1||!ALLOWED.has(path[0]))return err("NEON_RESOURCE_NOT_MIGRATED",409);
 const table=path[0],method=r.method.toUpperCase(),read=method==="GET"||method==="HEAD";
 if(!read&&!CONFIG.has(table))return err("CREDIT_WRITE_NOT_MIGRATED",409);
 if(!["GET","HEAD","PATCH","POST","DELETE"].includes(method))return err("METHOD_NOT_ALLOWED",405);
 const input=new URL(r.url);
 if(input.search.length>7000)return err("QUERY_TOO_LONG",413);
 const limit=input.searchParams.get("limit");
 if(limit!==null && (!/^\d{1,4}$/.test(limit)||Number(limit)>2000))return err("INVALID_LIMIT",422);
 if(!read){
  const origin=r.headers.get("origin"),site=r.headers.get("sec-fetch-site");
  // Browser cross-origin writes are forbidden; no-origin authenticated native
  // JSON writes are supported without changing the installed Android APK.
  if(origin && origin!==input.origin)return err("SAME_ORIGIN_REQUIRED",403);
  if(site && !["same-origin","none"].includes(site))return err("SAME_ORIGIN_REQUIRED",403);
  if(method==="DELETE"&&!origin)return err("ORIGIN_REQUIRED",403);
  if(method!=="DELETE"&&r.headers.get("content-type")?.split(";")[0]?.trim()!=="application/json")
    return err("JSON_REQUIRED",415);
 }
 let body:string|undefined;
 if(!read && method!=="DELETE"){
  if(Number(r.headers.get("content-length")||0)>131072)return err("BODY_TOO_LARGE",413);
  body=await r.text();
  if(Buffer.byteLength(body)>131072)return err("BODY_TOO_LARGE",413);
  try {JSON.parse(body);}catch{return err("INVALID_JSON",422);}
 }
 const target=new URL("https://uskpoaszucenqxlzgmcy.supabase.co/rest/v1/"+table);
 target.search=input.search;
 const keys=ncsV274ServerKeys();
 if(!keys.length)return err("SUPABASE_SERVER_KEY_MISSING",503);
 for(let i=0;i<keys.length;i++){
  const key=keys[i];
  const headers:Record<string,string>={apikey:key};
  if(key.startsWith("eyJ"))headers.Authorization="Bearer "+key;
  for(const h of ["accept","prefer","content-type","range","range-unit"]){
   const v=r.headers.get(h);if(v)headers[h]=v;
  }
  try{
   const response=await fetch(target,{method,headers,body,cache:"no-store",
    redirect:"error",signal:AbortSignal.timeout(18000)});
   if([401,403].includes(response.status)&&i+1<keys.length)continue;
   const oh=new Headers(OUT);
   for(const h of ["content-type","content-range","range-unit"]){
    const v=response.headers.get(h);if(v)oh.set(h,v);
   }
   const text=method==="HEAD"||response.status===204?null:await response.text();
   return new Response(text,{status:response.status,headers:oh});
  }catch(e){
   if(i+1<keys.length)continue;
   console.error("NCS_V46_COMPAT_BACKEND_FAILURE",table,method,e instanceof Error?e.name:"unknown");
   return err("SUPABASE_COMPAT_BACKEND_UNAVAILABLE",503);
  }
 }
 return err("SUPABASE_COMPAT_SERVICE_KEYS_REJECTED",503);
}
export {handle as GET,handle as HEAD,handle as PATCH,handle as POST,handle as DELETE};
