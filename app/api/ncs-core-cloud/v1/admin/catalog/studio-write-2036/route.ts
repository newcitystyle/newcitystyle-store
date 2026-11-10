import 'server-only';
import { ownerSessionValid } from '@/lib/ncs-neon-vercel-owner-session';
import { ncsV274ServerKeys, ncsV72Read } from '@/lib/ncs-v72-server-supabase';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const BASE='https://uskpoaszucenqxlzgmcy.supabase.co/rest/v1/';
const H={'Cache-Control':'private,no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
type Obj=Record<string,unknown>;
const obj=(v:unknown):v is Obj=>!!v&&typeof v==='object'&&!Array.isArray(v);
const positive=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
const money=(v:unknown)=>v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<10000000);
const fail=(code:string,status=400)=>Response.json({ok:false,code},{status,headers:H});
const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
function sameOrigin(req:Request):boolean {
 const origin=req.headers.get('origin');
 if(!origin)return false;
 try {
  const o=new URL(origin),u=new URL(req.url);
  return (o.protocol==='https:'&&o.origin===u.origin)||
    (o.protocol==='http:'&&o.hostname==='127.0.0.1'&&o.port==='32145'&&
     u.hostname==='127.0.0.1'&&u.port==='32145');
 }catch{return false;}
}
function imageAllowed(v:unknown):v is string{
 if(typeof v!=='string'||v.length>2000||!v.startsWith('https://'))return false;
 const base=process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/,'');
 if(!base||!base.startsWith('https://'))return false;
 try {const b=new URL(base),u=new URL(v);return u.origin===b.origin&&(u.pathname===b.pathname||u.pathname.startsWith(b.pathname.replace(/\/$/,'')+'/'));}catch{return false;}
}
async function rpc(name:string,body:Obj):Promise<Obj>{
 const keys=ncsV274ServerKeys();if(!keys.length)throw Error('SUPABASE_SERVER_KEY_MISSING');
 for(let i=0;i<keys.length;i++){
  const key=keys[i];
  const r=await fetch(BASE+'rpc/'+name,{method:'POST',headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(18000)});
  if(!r.ok){if([401,403].includes(r.status)&&i+1<keys.length)continue;throw Error('SUPABASE_RPC_HTTP_'+r.status)}
  const value:unknown=await r.json();if(!obj(value))throw Error('SUPABASE_RPC_INVALID_RESPONSE');return value;
 }
 throw Error('SUPABASE_CREDENTIALS_REJECTED');
}
const selectP='id,name,barcode,is_active,sell_online,price,online_stock_limit';
async function getProduct(id:number){
 const q=new URLSearchParams({select:selectP,id:'eq.'+id,limit:'1'});
 const p=await ncsV72Read('products',q);return p.length===1?p[0]:null;
}

export async function POST(req:Request){
 if(!ownerSessionValid(req))return fail('OWNER_LOGIN_REQUIRED',401);
 if(!sameOrigin(req))return fail('INVALID_ORIGIN',403);
 if(Number(req.headers.get('content-length')||0)>65536)return fail('REQUEST_TOO_LARGE',413);
 let b:Obj;try{const x:unknown=await req.json();if(!obj(x))return fail('INVALID_BODY');b=x;}catch{return fail('INVALID_JSON')}
 if(!positive(b.productId))return fail('INVALID_PRODUCT_ID');
 const id=b.productId;
 try{
  if(b.action==='saveAiDraft'){
   if(!obj(b.patch)||JSON.stringify(b.patch).length>40000)return fail('INVALID_AI_PATCH');
   const result=await rpc('ncs_studio_metadata_v6',{p_product_id:id,p_patch:b.patch});
   if(result.ok!==true)return fail('METADATA_NOT_SAVED',409);
   return Response.json({ok:true,saved:'ai',productId:id},{headers:H});
  }
  if(b.action==='publishDesign'){
   if(typeof b.designName!=='string'||!b.designName.trim()||b.designName.length>250||
    !imageAllowed(b.imageUrl)||typeof b.sortOrder!=='number'||!Number.isSafeInteger(b.sortOrder)||b.sortOrder<0||
    !Array.isArray(b.variants)||b.variants.length<1||b.variants.length>60)return fail('INVALID_DESIGN');
   const variants:Obj[]=[];const seen=new Set<number>();
   for(const v of b.variants){
    if(!obj(v)||!positive(v.variant_id)||seen.has(v.variant_id as number)||
       !Number.isSafeInteger(v.online_quantity)||number(v.online_quantity)===null||
       (v.online_quantity as number)<0||!money(v.online_price)||!money(v.mrp))return fail('INVALID_VARIANTS');
    seen.add(v.variant_id as number);
    variants.push({variant_id:v.variant_id,online_quantity:v.online_quantity,online_price:v.online_price,mrp:v.mrp});
   }
   const out=await rpc('ncs_studio_publish_v6',{p_product_id:id,p_design_name:b.designName.trim(),
     p_image_url:b.imageUrl,p_sort_order:b.sortOrder,p_variants:variants});
   if(out.ok!==true||out.published!==true)return fail('PUBLISH_NOT_AVAILABLE_ONLINE',409);
   const p=await getProduct(id as number);
   if(!p||p.sell_online!==true||Number(p.price)<=0)return fail('PUBLISH_READBACK_FAILED',503);
   return Response.json({ok:true,saved:out.already_exists?'already-exists':'design',id:out.design_unit_id,
     verified:true,published:true,productId:id},{headers:H});
  }
  if(b.action==='replaceDesignPhoto'){
   if(!positive(b.designId)||!imageAllowed(b.imageUrl))return fail('INVALID_DESIGN_PHOTO');
   const out=await rpc('ncs_studio_replace_photo_v7',{p_product_id:id,p_design_id:b.designId,p_image_url:b.imageUrl});
   if(out.ok!==true)return fail('PHOTO_REPLACE_NOT_SAVED',409);
   const rows=await ncsV72Read('product_design_units',new URLSearchParams({select:'id,image_url',id:'eq.'+b.designId,product_id:'eq.'+id,limit:'1'}));
   if(rows.length!==1||rows[0].image_url!==b.imageUrl)return fail('PHOTO_REPLACE_READBACK_FAILED',503);
   return Response.json({ok:true,id:b.designId,saved:'photo',verified:true},{headers:H});
  }
  if(b.action==='manageDesign'){
   if(!positive(b.designId)||typeof b.designName!=='string'||!b.designName.trim()||b.designName.length>250||
     !Array.isArray(b.variantIds)||b.variantIds.length<1||b.variantIds.length>60||
     !b.variantIds.every(positive)||new Set(b.variantIds).size!==b.variantIds.length||
     typeof b.sellOnline!=='boolean'||typeof b.soldOut!=='boolean'||
     !money(b.mrp)||!money(b.onlinePrice)||!Number.isSafeInteger(b.onlineQuantity)||
     (b.onlineQuantity as number)<0)return fail('INVALID_DESIGN_SETTINGS');
   const qty=b.sellOnline&&!b.soldOut?b.onlineQuantity as number:0;
   if(qty>0&&!(typeof b.onlinePrice==='number'&&b.onlinePrice>0))return fail('ONLINE_PRICE_REQUIRED');
   if(typeof b.mrp==='number'&&typeof b.onlinePrice==='number'&&b.onlinePrice>b.mrp)return fail('PRICE_EXCEEDS_MRP');
   const out=await rpc('ncs_studio_manage_design_v7',{
     p_product_id:id,p_design_id:b.designId,p_design_name:b.designName.trim(),
     p_variant_ids:b.variantIds,p_mrp:b.mrp,p_online_price:b.onlinePrice,
     p_online_quantity:qty,p_sell_online:b.sellOnline,p_sold_out:b.soldOut});
   if(out.ok!==true)return fail('DESIGN_SETTINGS_NOT_SAVED',409);
   const [designs,links]=await Promise.all([
     ncsV72Read('product_design_units',new URLSearchParams({select:'id,design_name,status',id:'eq.'+b.designId,product_id:'eq.'+id,limit:'1'})),
     ncsV72Read('product_design_unit_variants',new URLSearchParams({select:'variant_id,online_quantity,status',design_unit_id:'eq.'+b.designId,product_id:'eq.'+id,limit:'100'}))]);
   if(designs.length!==1||designs[0].design_name!==b.designName.trim())return fail('DESIGN_READBACK_FAILED',503);
   const selected=new Set(b.variantIds as number[]);
   if(links.filter(v=>v.status==='available').some(v=>!selected.has(Number(v.variant_id))))return fail('DESIGN_LINK_READBACK_FAILED',503);
   if(qty>0&&links.filter(v=>selected.has(Number(v.variant_id))&&v.status==='available'&&Number(v.online_quantity)===qty).length!==selected.size)return fail('DESIGN_LINK_READBACK_FAILED',503);
   return Response.json({ok:true,id:b.designId,saved:'settings',verified:true},{headers:H});
  }
  // Do not fake success for unsupported design mutations.
  return fail('ACTION_NOT_YET_MIGRATED_TO_SUPABASE',409);
 }catch(e){
  console.error('NCS_STUDIO_V7_WRITE',e instanceof Error?e.message:'UNKNOWN');
  return fail('STUDIO_SUPABASE_WRITE_FAILED',503);
 }
}

export async function GET(req:Request){
 if(!ownerSessionValid(req))return fail('OWNER_LOGIN_REQUIRED',401);
 const raw=new URL(req.url).searchParams.get('productId')||'';
 if(!/^[1-9][0-9]{0,14}$/.test(raw))return fail('INVALID_PRODUCT_ID');
 const id=Number(raw);
 try{
  const p=await getProduct(id);if(!p)return fail('PRODUCT_NOT_FOUND',404);
  const q=(table:string,fields:string,order:string)=>ncsV72Read(table,new URLSearchParams({select:fields,product_id:'eq.'+id,order,limit:'600'}));
  const [variants,designs,links]=await Promise.all([
   q('product_variants','id,product_id,size,color,barcode,stock,reserved_stock,is_active,online_mrp,online_price,online_stock_limit,sell_online','id.asc'),
   q('product_design_units','id,product_id,design_name,image_url,status,sort_order','sort_order.asc,id.asc'),
   q('product_design_unit_variants','id,product_id,design_unit_id,variant_id,status,mrp,online_price,online_quantity','id.asc')]);
  const active=variants.filter(v=>v.is_active!==false);
  const stock=active.reduce((a,v)=>a+Math.max(0,Number(v.stock||0)-Number(v.reserved_stock||0)),0);
  const blockers:string[]=[];
  if(p.is_active===false)blockers.push('Product inactive');
  if(p.sell_online!==true)blockers.push('Online sale disabled');
  if(Number(p.price)<=0)blockers.push('Online price missing');
  if(stock<=0)blockers.push('Physical stock unavailable');
  return Response.json({ok:true,version:7,productId:id,variants,designs,links,availableStock:stock,blockers,
   message:blockers.join('. ')||'Product published in Supabase; checkout still validates stock.',checkedAt:new Date().toISOString()},{headers:H});
 }catch{return fail('SUPABASE_STUDIO_READ_FAILED',503)}
}
