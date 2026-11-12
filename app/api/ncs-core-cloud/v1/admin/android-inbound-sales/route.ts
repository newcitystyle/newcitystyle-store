import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ownerSessionValid } from "@/lib/ncs-neon-vercel-owner-session";
import { requireRecoveryAdmin } from "@/lib/ncs-recovery-admin-server";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store",Vary:"Cookie, Authorization","X-Content-Type-Options":"nosniff"};
const fail=(code:string,status=503)=>Response.json({ok:false,code},{status,headers});
async function authorized(r:Request){
 if(ownerSessionValid(r))return true;
 if(!/^Bearer\s+\S+$/i.test(r.headers.get("authorization")||""))return false;
 try{return (await requireRecoveryAdmin(r)).ok===true;}catch{return false;}
}
/** Verified V60 sales inbound to the old Billing App; no writes. */
export async function GET(request:Request){
 if(!(await authorized(request)))return fail("OWNER_SESSION_REQUIRED",401);
 const key=(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||"").trim();
 if(!key)return fail("SUPABASE_SERVER_KEY_MISSING");
 try{
  const db=createClient("https://uskpoaszucenqxlzgmcy.supabase.co",key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc("ncs_v74_android_inbound_sales_read");
  if(error){console.error("V74_INBOUND_READ_ERROR",error.code||"RPC_FAILURE");return fail("V74_READ_UNAVAILABLE");}
  if(!data||typeof data!=="object"||Array.isArray(data)||data.ok!==true||
     data.source!=="SUPABASE_NEW_BILLS_V60"||data.direction!=="CLOUD_TO_ANDROID_ONLY"||
     !Array.isArray(data.sales)||data.sales.length>30||
     !data.sales.every((x:unknown)=>{
       if(!x||typeof x!=="object"||Array.isArray(x))return false;
       const s=x as Record<string,unknown>;
       return typeof s.id==="string"&&/^[a-f0-9-]{36}$/i.test(s.id)&&
        typeof s.invoice_number==="string"&&s.invoice_number.length>0&&
        typeof s.client_transaction_id==="string"&&Array.isArray(s.items)&&
        s.items.length>0&&s.items.length<=100;
     }))return fail("V74_READ_CONTRACT_INVALID");
  return Response.json(data,{headers});
 }catch{return fail("V74_READ_FAILED");}
}
