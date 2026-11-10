import "server-only";
import { neon } from "@neondatabase/serverless";
import { ownerSessionValid } from "@/lib/ncs-neon-vercel-owner-session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = {"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const reply=(code:string,status:number)=>Response.json({ok:false,code},{status,headers:HEADERS});
export async function POST(req:Request) {
  if(!ownerSessionValid(req)) return reply("NCS_OWNER_LOGIN_REQUIRED",401);
  const origin=req.headers.get("origin");
  if(origin && origin!==new URL(req.url).origin) return reply("INVALID_ORIGIN",403);
  if(Number(req.headers.get("content-length")||0)>12000) return reply("BODY_TOO_LARGE",413);
  const url=process.env.NCS_NEON_DATABASE_URL;
  if(!url) return reply("NEON_NOT_CONFIGURED",503);
  let b:Record<string,unknown>;
  try {b=await req.json();if(!b||Array.isArray(b)||typeof b!=="object") throw Error();}
  catch {return reply("INVALID_JSON",400);}
  const id=Number(b.productId),name=b.name,description=b.description;
  const mrp=Number(b.mrp),price=Number(b.price),onlineStockLimit=Number(b.onlineStockLimit);
  if(!Number.isSafeInteger(id)||id<=0||typeof name!=="string"||name.trim().length===0||name.length>300||
     typeof description!=="string"||description.length>10000||
     !Number.isFinite(mrp)||mrp<0||mrp>1e8||!Number.isFinite(price)||price<0||price>1e8||
     !Number.isSafeInteger(onlineStockLimit)||onlineStockLimit<0||onlineStockLimit>1000000||
     typeof b.sellOnline!=="boolean")return reply("INVALID_PRODUCT_DETAILS",400);
  const photo=b.imageUrl===undefined?null:b.imageUrl;
  if(photo!==null) {
    if(typeof photo!=="string"||photo.length>2048) return reply("INVALID_IMAGE_URL",400);
    try { if(new URL(photo).protocol!=="https:") return reply("INVALID_IMAGE_URL",400); }
    catch{return reply("INVALID_IMAGE_URL",400);}
  }
  try {
    const db=neon(url);
    const rows=await db.query(`UPDATE "ncs_business_fresh_20261012_162606"."products" SET
      name=$2,description=$3,mrp=$4,price=$5,online_stock_limit=$6,sell_online=$7,
      image=COALESCE($8,image),image_url=COALESCE($8,image_url),updated_at=now()
      WHERE id=$1 AND COALESCE(is_active,true)=true RETURNING id,name,image_url,price,mrp,sell_online`,
      [id,name.trim(),description,mrp,price,onlineStockLimit,b.sellOnline,photo]);
    if(!Array.isArray(rows)||rows.length!==1)return reply("PRODUCT_NOT_FOUND_OR_INACTIVE",404);
    return Response.json({ok:true,product:rows[0]},{headers:HEADERS});
  } catch(e) {
    console.error("NCS_NATIVE_PRODUCT_UPDATE_FAILED",e instanceof Error?e.name:"UNKNOWN");
    return reply("NEON_PRODUCT_UPDATE_FAILED",503);
  }
}
