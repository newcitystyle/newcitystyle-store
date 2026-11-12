import "server-only";
import {createClient} from "@supabase/supabase-js";
import {ownerSessionValid} from "@/lib/ncs-neon-vercel-owner-session";
import {requireRecoveryAdmin} from "@/lib/ncs-recovery-admin-server";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const fail=(error:string,status=503)=>Response.json({ok:false,error},{status,headers:H});
async function owner(r:Request){if(ownerSessionValid(r))return true;if(!/^Bearer\s+\S+$/i.test(r.headers.get("authorization")||""))return false;try{return (await requireRecoveryAdmin(r)).ok===true}catch{return false}}
const money=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0};
export async function GET(r:Request){
 if(!await owner(r))return fail("OWNER_LOGIN_REQUIRED",401);
 const id=new URL(r.url).searchParams.get("billId")||"";
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))return fail("INVALID_BILL_ID",400);
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY;
 if(!key)return fail("SUPABASE_SERVER_KEY_MISSING");
 try{
  const db=createClient("https://uskpoaszucenqxlzgmcy.supabase.co",key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc("ncs_recovery_sales_history_v59",{p_kind:"items",p_sale_id:id,p_offset:0,p_limit:250});
  if(error){console.error("V114_RECOVERED_BILL_ITEMS",error.code||"UNKNOWN");return fail("RECOVERED_BILL_ITEMS_UNAVAILABLE");}
  if(!data||!Array.isArray(data.rows)||data.source!=="SUPABASE_RECOVERED_OCT12_V59")return fail("RECOVERED_BILL_ITEMS_INVALID");
  const items=data.rows.slice(0,200).map((x:Record<string,unknown>,index:number)=>({
   id:index+1,sale_id:id,product_name:String(x.product_name||x.name||"Item"),
   barcode:String(x.barcode||""),size:String(x.size||""),color:String(x.color||""),
   quantity:Math.max(0,Math.floor(money(x.quantity))),
   returned_quantity:Math.max(0,Math.floor(money(x.returned_quantity))),
   unit_price:money(x.unit_price??x.unitPrice),
   line_total:money(x.line_total??x.lineTotal)
  }));
  return Response.json({ok:true,items,readOnly:true,historicalReconciliationPending:true},{headers:H});
 }catch{return fail("RECOVERED_BILL_ITEMS_FAILED");}
}
