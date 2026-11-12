import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireRecoveryAdmin } from "@/lib/ncs-recovery-admin-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const apiHeaders={"Cache-Control":"private, no-store",Vary:"Authorization"};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:apiHeaders});
const authorized=async(request:Request)=>{
  if(!/^Bearer\s+\S+$/i.test(request.headers.get("authorization")||"")) return false;
  try{return (await requireRecoveryAdmin(request)).ok===true;}catch{return false;}
};
function connection(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY;
  if(!url||!key)throw new Error("SERVER_CONFIGURATION_MISSING");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
const kindSet=new Set(["sales","suppliers","cash_bank","expenses"]);
const pack=(items:unknown)=>Array.isArray(items)?items:[];

export async function GET(request:Request){
  if(!(await authorized(request)))return json({ok:false,error:"OWNER_LOGIN_REQUIRED"},401);
  const params=new URL(request.url).searchParams;
  const kind=params.get("kind")||"sales";
  if(!kindSet.has(kind))return json({ok:false,error:"INVALID_MODULE"},400);
  const limit=Math.min(Math.max(Number(params.get("limit"))||80,1),150);
  try{
    const db=connection();
    if(kind==="sales"){
      const {data,error}=await db.from("pos_sales")
        .select("id,invoice_number,customer_name,customer_phone,sale_status,payment_method,total_amount,paid_amount,due_amount,created_at,is_deleted")
        .eq("is_deleted",false).order("created_at",{ascending:false}).limit(limit);
      if(error)throw error;
      const saleId=params.get("saleId");
      let items:unknown[]=[];
      if(saleId&&/^[0-9a-f-]{36}$/i.test(saleId)){
        const detail=await db.from("pos_sale_items")
          .select("id,sale_id,product_name,size,color,quantity,unit_price,line_total,returned_quantity")
          .eq("sale_id",saleId).limit(100);
        if(detail.error)throw detail.error;
        items=pack(detail.data);
      }
      return json({ok:true,kind,records:pack(data),items});
    }
    if(kind==="suppliers"){
      const [a,b,c]=await Promise.all([
        db.from("suppliers").select("id,supplier_name,phone,current_balance,total_paid_amount,total_purchase_amount,is_active").eq("is_active",true).order("current_balance",{ascending:false}).limit(150),
        db.from("supplier_payments").select("id,supplier_id,amount,payment_date,payment_method,payment_reference,notes,created_at,reversed_at")
          .order("created_at",{ascending:false}).limit(150),
        db.from("purchases").select("id,purchase_number,supplier_id,supplier_name,total_amount,paid_amount,due_amount,purchase_date")
          .order("purchase_date",{ascending:false}).limit(100)
      ]);
      if(a.error||b.error||c.error)throw a.error||b.error||c.error;
      return json({ok:true,kind,records:pack(a.data),payments:pack(b.data),purchases:pack(c.data)});
    }
    if(kind==="cash_bank"){
      const [a,b]=await Promise.all([
        db.from("cash_bank_transactions")
          .select("id,transaction_number,transaction_date,account_name,account_type,entry_type,direction,amount,party_name,notes,reference_number,created_at")
          .eq("is_deleted",false).order("created_at",{ascending:false}).limit(limit),
        db.from("cash_bank_accounts").select("id,account_name,account_type,current_balance,is_active")
          .eq("is_active",true).order("sort_order",{ascending:true}).limit(30)
      ]);
      if(a.error||b.error)throw a.error||b.error;
      return json({ok:true,kind,records:pack(a.data),accounts:pack(b.data)});
    }
    const [a,b]=await Promise.all([
      db.from("expenses")
        .select("id,expense_number,expense_date,category,title,amount,payment_method,paid_to,notes,reference_number,created_at")
        .eq("is_deleted",false).order("created_at",{ascending:false}).limit(limit),
      db.from("expense_categories").select("id,name").limit(100)
    ]);
    if(a.error)throw a.error;
    // Categories are optional; the user can still save an Other expense.
    return json({ok:true,kind,records:pack(a.data),categories:b.error?[]:pack(b.data)});
  }catch(err){
    console.error("V43_WORKSPACE_GET_ERROR",(err as {code?:string})?.code||"UNAVAILABLE");
    return json({ok:false,error:"WORKSPACE_TEMPORARILY_UNAVAILABLE"},503);
  }
}
export async function POST(request:Request){
  if(!(await authorized(request)))return json({ok:false,error:"OWNER_LOGIN_REQUIRED"},401);
  let payload:Record<string,unknown>;
  try{
    const parsed=await request.json();
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error();
    payload=parsed;
  }catch{return json({ok:false,error:"INVALID_REQUEST"},400);}
  const operation=String(payload.module||"");
  if(!["supplier_payment","expense","cash_bank"].includes(operation))
    return json({ok:false,error:"UNSUPPORTED_ACTION"},400);
  try{
    const db=connection();
    const {data,error}=await db.rpc("ncs_mobile_workspace_post_v43",{p:payload});
    if(error){console.error("V43_WORKSPACE_POST_ERROR",error.code||"UNKNOWN");return json({ok:false,error:"SAVE_NOT_CONFIRMED_REFRESH_HISTORY"},503);}
    if(!data||data.ok!==true)return json(data||{ok:false,error:"SAVE_REJECTED"},409);
    return json(data);
  }catch{
    return json({ok:false,error:"SAVE_NOT_CONFIRMED_REFRESH_HISTORY"},503);
  }
}
