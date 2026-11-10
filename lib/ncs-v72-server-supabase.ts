import 'server-only';

/** Server-only, bounded Supabase REST access. No user-supplied host or path. */
const BASE = 'https://uskpoaszucenqxlzgmcy.supabase.co/rest/v1/';
// NCS_V274_SERVER_KEY_CHAIN: server-only credentials; never expose any key in responses.
export function ncsV274ServerKeys():string[]{
 return [...new Set([process.env.SUPABASE_SERVICE_ROLE_KEY,process.env.SUPABASE_SECRET_KEY,process.env.SUPABASE_SERVICE_KEY].map(x=>(x||'').trim()).filter(Boolean))];
}
export function ncsV72Key(): string { return ncsV274ServerKeys()[0]||''; }
export function ncsV72Headers(extra:Record<string,string>={}):Record<string,string>{
 const key=ncsV72Key();if(!key)throw Error('SUPABASE_SERVER_KEY_MISSING');
 return {apikey:key,...(key.startsWith('eyJ')?{Authorization:`Bearer ${key}`}:{ }),...extra};
}
export async function ncsV72Read(table:string,params:URLSearchParams,timeout=12000):Promise<Record<string,unknown>[]> {
 if(!['branding_settings','products','product_variants','billing_settings','expenses','expense_categories','cash_bank_transactions','product_design_units','product_design_unit_variants'].includes(table))throw Error('V72_TABLE_NOT_ALLOWED');
 const url=new URL('https://uskpoaszucenqxlzgmcy.supabase.co/rest/v1/'+table);url.search=params.toString();
 const keys=ncsV274ServerKeys();if(!keys.length)throw Error('SUPABASE_SERVER_KEY_MISSING');
 for(let i=0;i<keys.length;i++){
  const key=keys[i];const headers:Record<string,string>={apikey:key,Accept:'application/json'};
  if(key.startsWith('eyJ'))headers.Authorization=`Bearer ${key}`;
  const r=await fetch(url,{method:'GET',headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(timeout)});
  if(!r.ok){if([401,403].includes(r.status)&&i+1<keys.length)continue;throw Error(`SUPABASE_${table}_READ_HTTP_${r.status}`)}
  const result:unknown=await r.json();
  if(!Array.isArray(result)||!result.every(x=>x!==null&&typeof x==='object'&&!Array.isArray(x)))throw Error('SUPABASE_RESPONSE_INVALID');
  return result as Record<string,unknown>[];
 }
 throw Error('SUPABASE_SERVICE_KEYS_REJECTED');
}

export async function ncsV72ConfigWrite(table:string,method:'PATCH'|'POST',params:URLSearchParams,payload:unknown):Promise<{status:number;items:Record<string,unknown>[]}> {
  if(table!=='billing_settings')throw Error('V72_WRITE_NOT_ALLOWED');
  const url=new URL(BASE+table);url.search=params.toString();
  const response=await fetch(url,{method,headers:ncsV72Headers({'Content-Type':'application/json',Accept:'application/json',Prefer:'return=representation'}),body:JSON.stringify(payload),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
  const output=await response.text(); let items:unknown=[];
  try{items=output?JSON.parse(output):[];}catch{throw Error('SUPABASE_WRITE_RESPONSE_INVALID');}
  if(!response.ok)return{status:response.status,items:[]};
  if(!Array.isArray(items)||!items.every(x=>x&&typeof x==='object'&&!Array.isArray(x)))throw Error('SUPABASE_WRITE_SHAPE_INVALID');
  return {status:response.status,items:items as Record<string,unknown>[]};
}
export async function ncsV72OwnerTableRead(request:Request,table:string):Promise<Response> {
 const safe=new Set(['products','product_variants','product_design_units','product_design_unit_variants','expense_categories','website_visits','customers','ncs_variant_intelligence_v2','ncs_brand_performance','orders','ncs_whatsapp_leads','ncs_whatsapp_demand_30d','ncs_whatsapp_outbound_messages','ncs_whatsapp_payment_requests','ncs_whatsapp_automation_queue','ncs_whatsapp_automation_settings','owner_profit_alerts']);
 const outHeaders=new Headers({'Cache-Control':'private,no-store',Vary:'Cookie','X-Content-Type-Options':'nosniff','X-NCS-Stock-Verified':'false','X-NCS-Source':'SUPABASE_PUBLIC_SNAPSHOT_V72'});
 if(!safe.has(table))return Response.json({code:'UNMIGRATED_MODULE'}, {status:409,headers:outHeaders});
 if(!['GET','HEAD'].includes(request.method))return Response.json({code:'V72_INVENTORY_WRITE_NOT_MIGRATED'}, {status:409,headers:outHeaders});
 const input=new URL(request.url);
 if(input.search.length>7000)return Response.json({code:'QUERY_TOO_LONG'}, {status:413,headers:outHeaders});
 const target=new URL(BASE+table);target.search=input.search;
 try{
  const requestHeaders:Record<string,string>=ncsV72Headers();
  for(const name of ['accept','prefer','range','range-unit']){
   const val=request.headers.get(name);if(val)requestHeaders[name]=val;
  }
  const r=await fetch(target,{method:request.method,headers:requestHeaders,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(14000)});
  for(const k of ['content-type','content-range','range-unit']){const v=r.headers.get(k);if(v)outHeaders.set(k,v);}
  return new Response(request.method==='HEAD'?null:await r.text(),{status:r.status,headers:outHeaders});
 }catch{
  return Response.json({code:'SUPABASE_PUBLIC_SNAPSHOT_UNAVAILABLE'},{status:503,headers:outHeaders});
 }
}
