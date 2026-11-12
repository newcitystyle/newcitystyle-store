import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ownerSessionValid } from "@/lib/ncs-neon-vercel-owner-session";
import { requireRecoveryAdmin } from "@/lib/ncs-recovery-admin-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store",Vary:"Cookie, Authorization","X-Content-Type-Options":"nosniff"};
const fail=(code:string,status=503)=>Response.json({ok:false,code},{status,headers:H});
export async function GET(r:Request){
 let owner=ownerSessionValid(r);
 if(!owner && /^Bearer\s+\S+$/i.test(r.headers.get("authorization")||"")){
  try{owner=(await requireRecoveryAdmin(r)).ok===true;}catch{owner=false;}
 }
 if(!owner)return fail("OWNER_LOGIN_REQUIRED",401);
 const key=(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||"").trim();
 if(!key)return fail("SERVICE_KEY_NOT_CONFIGURED");
 try{
  const db=createClient("https://uskpoaszucenqxlzgmcy.supabase.co",key,
    {auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc("ncs_v49_owner_canonical_ledger_snapshot");
  if(error){console.error("NCS_V49_LEDGER_RPC",error.code||"UNKNOWN");return fail("CANONICAL_LEDGER_READ_FAILED");}
  if(!data||typeof data!=="object"||Array.isArray(data)||data.ok!==true||
     data.source!=="NCS_ACCOUNTS_V69_CANONICAL"||data.readOnly!==true||
     !Array.isArray(data.customers)||!Array.isArray(data.suppliers)||
     data.customers.length<1||data.customers.length>10000||
     data.suppliers.length<1||data.suppliers.length>1000)
     return fail("CANONICAL_LEDGER_INVALID",503);
  const valid=(x:unknown)=>x&&typeof x==="object"&&!Array.isArray(x)&&
    Number.isSafeInteger(Number((x as Record<string,unknown>).id))&&
    typeof (x as Record<string,unknown>).name==="string"&&
    Number.isFinite(Number((x as Record<string,unknown>).due))&&
    Number.isFinite(Number((x as Record<string,unknown>).credit))&&
    Number.isFinite(Number((x as Record<string,unknown>).paid));
  if(!data.customers.every(valid)||!data.suppliers.every(valid))
   return fail("CANONICAL_LEDGER_ROWS_INVALID",503);
  return Response.json(data,{headers:H});
 }catch(e){
  console.error("NCS_V49_CANONICAL_LEDGER",e instanceof Error?e.name:"unknown");
  return fail("CANONICAL_LEDGER_UNAVAILABLE");
 }
}
