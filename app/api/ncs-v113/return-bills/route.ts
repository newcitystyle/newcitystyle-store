import "server-only";
import {createClient} from "@supabase/supabase-js";
import {ownerSessionValid} from "@/lib/ncs-neon-vercel-owner-session";
import {requireRecoveryAdmin} from "@/lib/ncs-recovery-admin-server";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const fail=(error:string,status=503)=>Response.json({ok:false,error},{status,headers:H});
async function owner(r:Request){if(ownerSessionValid(r))return true;if(!/^Bearer\s+\S+$/i.test(r.headers.get("authorization")||""))return false;try{return (await requireRecoveryAdmin(r)).ok===true}catch{return false}}
export async function GET(r:Request){
 if(!await owner(r))return fail("OWNER_LOGIN_REQUIRED",401);
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY;
 if(!key)return fail("SUPABASE_SERVER_KEY_MISSING");
 try{
  const db=createClient("https://uskpoaszucenqxlzgmcy.supabase.co",key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc("ncs_recovery_sales_history_v59",{p_kind:"sales",p_sale_id:null,p_offset:0,p_limit:250});
  if(error){console.error("V113_RECORDED_SALES",error.code||"UNKNOWN");return fail("RECOVERED_BILL_FEED_UNAVAILABLE");}
  if(!data||!Array.isArray(data.rows)||data.source!=="SUPABASE_RECOVERED_OCT12_V59")return fail("RECOVERED_BILL_FEED_INVALID");
  const now=Date.now()-45*86400000;
  const sales=data.rows.filter((x:Record<string,unknown>)=>typeof x.created_at==="string"&&Date.parse(x.created_at)>=now)
   .map((x:Record<string,unknown>)=>({id:x.id,invoice_number:x.invoice_number,customer_name:x.customer_name||null,
    customer_phone:x.customer_phone||null,total_amount:x.total_amount,created_at:x.created_at,
    sale_status:x.sale_status||"completed",source:"V60"}));
  return Response.json({ok:true,sales,source:"V59_COMBINED_HISTORY",readOnly:true,historicalReconciliationPending:true},{headers:H});
 }catch{return fail("RECOVERED_BILL_FEED_FAILED");}
}
