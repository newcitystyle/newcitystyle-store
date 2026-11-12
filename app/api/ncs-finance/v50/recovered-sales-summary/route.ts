import "server-only";
import {createClient} from "@supabase/supabase-js";
import {ownerSessionValid} from "@/lib/ncs-neon-vercel-owner-session";
import {requireRecoveryAdmin} from "@/lib/ncs-recovery-admin-server";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie, Authorization","X-Content-Type-Options":"nosniff"};
const fail=(code:string,status=503)=>Response.json({ok:false,code},{status,headers:H});
export async function GET(r:Request){
 let valid=ownerSessionValid(r);
 if(!valid&&/^Bearer\s+\S+$/i.test(r.headers.get("authorization")||"")){
  try{valid=(await requireRecoveryAdmin(r)).ok===true;}catch{valid=false;}
 }
 if(!valid)return fail("OWNER_LOGIN_REQUIRED",401);
 const key=(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||"").trim();
 if(!key)return fail("SERVICE_KEY_NOT_CONFIGURED");
 try{
  const db=createClient("https://uskpoaszucenqxlzgmcy.supabase.co",key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc("ncs_v50_owner_dashboard_sales_ist");
  if(error){console.error("NCS_V50_DASHBOARD_RPC",error.code||"UNKNOWN");return fail("RECOVERED_SALES_READ_FAILED");}
  if(!data||typeof data!=="object"||Array.isArray(data)||data.ok!==true||
     data.readOnly!==true||data.source!=="NCS_V59_COMBINED_SALES"||
     data.timeZone!=="Asia/Kolkata"||data.historicalReconciliationPending!==true)
     return fail("RECOVERED_SALES_INVALID");
  const numbers=["todaySales","yesterdaySales","monthSales","todayBills","yesterdayBills","monthBills"];
  if(numbers.some(k=>!Number.isFinite(Number(data[k]))||Number(data[k])<0))
     return fail("RECOVERED_SALES_INVALID_TOTAL");
  return Response.json(data,{headers:H});
 }catch(e){console.error("NCS_V50_DASHBOARD_READ",e instanceof Error?e.name:"UNKNOWN");return fail("RECOVERED_SALES_UNAVAILABLE");}
}
