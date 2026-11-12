import "server-only";
import {ownerSessionValid} from "@/lib/ncs-neon-vercel-owner-session";
import {requireRecoveryAdmin} from "@/lib/ncs-recovery-admin-server";
import {ncsV274ServerKeys} from "@/lib/ncs-v72-server-supabase";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private,no-store","X-Content-Type-Options":"nosniff"};
const fail=(error:string,status=503)=>Response.json({ok:false,error},{status,headers:H});
async function owner(r:Request){if(ownerSessionValid(r))return true;if(!/^Bearer\s+\S+$/i.test(r.headers.get("authorization")||""))return false;try{return (await requireRecoveryAdmin(r)).ok===true}catch{return false}}
export async function GET(r:Request){
 if(!await owner(r))return fail("OWNER_LOGIN_REQUIRED",401);
 const id=new URL(r.url).searchParams.get("billId")||"";
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))return fail("INVALID_BILL_ID",400);
 const keys=ncsV274ServerKeys();if(!keys.length)return fail("SERVICE_ROLE_UNAVAILABLE");
 try{
  async function read(table:string,fields:string){
   const url=new URL("https://uskpoaszucenqxlzgmcy.supabase.co/rest/v1/"+table);
   url.search=new URLSearchParams({select:fields,bill_id:"eq."+id,limit:"1"}).toString();
   for(let i=0;i<keys.length;i++){
    const key=keys[i];const headers:Record<string,string>={apikey:key};
    if(key.startsWith("eyJ"))headers.Authorization="Bearer "+key;
    const response=await fetch(url,{headers,cache:"no-store",signal:AbortSignal.timeout(12000)});
    if([401,403].includes(response.status)&&i<keys.length-1)continue;
    if(!response.ok)throw Error("AUDIT_READ_UNAVAILABLE");
    const rows=await response.json();if(!Array.isArray(rows))throw Error("AUDIT_INVALID");
    return rows[0]||null;
   }return null;
  }
  const [stock,cancel]=await Promise.all([
    read("ncs_v124_stock_postings","bill_id,review_required"),
    read("ncs_v95_v60_cancellations","bill_id,status")
  ]);
  return Response.json({ok:true,
   status:cancel?"CANCELLATION_AUDIT_EXISTS":stock?"V60_STOCK_POSTED":"V60_STOCK_UNCONFIRMED",
   stockPosted:!!stock,stockReview:stock?.review_required===true,cancelled:!!cancel,
   ledgerWarning:"Refund, stock, payment and dues not fully reconciled. Final save remains locked."
  },{headers:H});
 }catch{return fail("RETURN_AUDIT_UNAVAILABLE");}
}
