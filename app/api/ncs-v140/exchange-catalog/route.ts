import "server-only";
import {ownerSessionValid} from "@/lib/ncs-neon-vercel-owner-session";
import {requireRecoveryAdmin} from "@/lib/ncs-recovery-admin-server";
import {ncsV72Read} from "@/lib/ncs-v72-server-supabase";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const fail=(error:string,status=503)=>Response.json({ok:false,error},{status,headers:H});
async function owner(r:Request){if(ownerSessionValid(r))return true;if(!/^Bearer\s+\S+$/i.test(r.headers.get("authorization")||""))return false;try{return (await requireRecoveryAdmin(r)).ok===true}catch{return false}}
const cols="id,name,barcode,image_url,image,price,mrp,stock,brand,category";
const vars="id,product_id,barcode,size,color,stock,selling_price,mrp";
export async function GET(r:Request){
 if(!await owner(r))return fail("OWNER_LOGIN_REQUIRED",401);
 const q=new URL(r.url).searchParams;const mode=q.get("mode")||"browse";
 try{
  if(mode==="browse"){
   const products=await ncsV72Read("products",new URLSearchParams({select:cols,order:"name.asc",limit:"1000"}));
   return Response.json({ok:true,products},{headers:H});
  }
  if(mode==="design"){
   const id=Number(q.get("productId"));if(!Number.isSafeInteger(id)||id<=0)return fail("INVALID_PRODUCT",400);
   const f="eq."+id;
   const [designs,links,variants]=await Promise.all([
    ncsV72Read("product_design_units",new URLSearchParams({select:"id,product_id,design_name,image_url,status",product_id:f,limit:"500"})),
    ncsV72Read("product_design_unit_variants",new URLSearchParams({select:"design_unit_id,variant_id,status,online_quantity",product_id:f,limit:"1000"})),
    ncsV72Read("product_variants",new URLSearchParams({select:vars,product_id:f,limit:"1000"}))
   ]);
   return Response.json({ok:true,designs,links,variants},{headers:H});
  }
  if(mode==="search"){
   const raw=(q.get("q")||"").trim();if(!raw||raw.length>90)return fail("INVALID_SEARCH",400);
   const barcode=raw.replace(/[*,()\\]/g,"");
   if(!barcode)return fail("INVALID_SEARCH",400);
   const [variants,barcodeProducts]=await Promise.all([
    ncsV72Read("product_variants",new URLSearchParams({select:vars,barcode:"eq."+barcode,limit:"30"})),
    ncsV72Read("products",new URLSearchParams({select:cols,barcode:"eq."+barcode,limit:"30"}))
   ]);
   let products=barcodeProducts;
   if(variants.length){
    const ids=[...new Set(variants.map(x=>Number(x.product_id)).filter(x=>Number.isSafeInteger(x)&&x>0))];
    if(ids.length)products=await ncsV72Read("products",new URLSearchParams({select:cols,id:"in.("+ids.join(",")+")",limit:"100"}));
   }
   if(!products.length && raw.length<=35){
    const safe=raw.replace(/[%_*,()\\]/g,"");
    if(safe)products=await ncsV72Read("products",new URLSearchParams({select:cols,name:"ilike.*"+safe+"*",limit:"40"}));
   }
   return Response.json({ok:true,products,variants},{headers:H});
  }
  return fail("UNSUPPORTED_CATALOG_MODE",400);
 }catch(e){
  console.error("NCS_EXCHANGE_CATALOG_READ",e instanceof Error?e.name:"UNKNOWN");
  return fail("EXCHANGE_CATALOG_UNAVAILABLE");
 }
}
