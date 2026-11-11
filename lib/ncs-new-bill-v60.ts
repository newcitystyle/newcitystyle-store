import { createHash } from 'node:crypto';
/** Paise-exact invoice storage. This does not claim that historical inventory is reconciled. */
export const BILL_CUTOVER_V60 = '2026-10-30T02:41:52Z';
const obj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);
const money = (x: unknown, signed=false) => {
 if(typeof x !== 'number' || !Number.isFinite(x) || (!signed && x<0)) throw Error('INVALID_MONEY');
 const n=Math.round(x*100); if(!Number.isSafeInteger(n)||Math.abs(n-x*100)>0.00001||Math.abs(n)>1e11) throw Error('INVALID_MONEY'); return n;
};
const text=(x:unknown,max:number)=>{if(typeof x!=='string'||x.length>max)throw Error('INVALID_TEXT');return x;};
export function normalizeBillV60(raw: unknown, now=Date.now()) {
 if(!obj(raw)||!obj(raw.sale))throw Error('INVALID_BILL'); const s=raw.sale;
 const transaction=text(s.clientTransactionId,128), invoice=text(s.invoiceNumber,128),created=text(s.createdAt,45);
 if(!/^[A-Za-z0-9:_-]{12,128}$/.test(transaction)||invoice.length<4)throw Error('INVALID_ID');
 const ts=Date.parse(created);if(!Number.isFinite(ts)||ts<Date.parse(BILL_CUTOVER_V60)||ts>now+600000)throw Error('PRE_CUTOVER_OR_INVALID_DATE');
 const subtotal=money(s.subtotal),discount=money(s.discount),roundOff=money(s.roundOff,true),total=money(s.total),paid=money(s.paid),due=money(s.due);
 if(total<=0||subtotal-discount+roundOff!==total||paid+due!==total)throw Error('AMOUNTS_MISMATCH');
 const name=text(s.customerName,200),phone=text(s.customerPhone,40),method=text(s.paymentMethod,30);
 if(!['cash','upi','card','credit','split','bank_transfer','wallet','other'].includes(method))throw Error('INVALID_PAYMENT_METHOD');
 if(due>0&&(!phone.trim()||!name.trim()))throw Error('CREDIT_CUSTOMER_REQUIRED');
 if(!obj(s.paymentBreakdown))throw Error('PAYMENT_BREAKDOWN_REQUIRED');
 const cash=money(s.paymentBreakdown.cash),upi=money(s.paymentBreakdown.upi),card=money(s.paymentBreakdown.card),unallocated=money(s.paymentBreakdown.unallocated??0);
 if(cash+upi+card+unallocated!==paid)throw Error('PAYMENT_BREAKDOWN_MISMATCH');
 if(!Array.isArray(s.items)||!s.items.length||s.items.length>100)throw Error('INVALID_ITEMS');
 let sum=0;
 const items=s.items.map((i:unknown)=>{
  if(!obj(i)||!Number.isSafeInteger(i.quantity)||i.quantity<1||i.quantity>500)throw Error('INVALID_ITEM');
  const line=money(i.lineTotal),price=money(i.unitPrice),mrp=money(i.mrp),cost=i.unitCost==null?null:money(i.unitCost)/100;
  const tax=i.taxPercent??0;if(typeof tax!=='number'||!Number.isFinite(tax)||tax<0||tax>100)throw Error('INVALID_TAX');
  sum+=line;if(!Number.isSafeInteger(sum))throw Error('INVALID_ITEM_SUM');
  // Preserve source IDs as provenance only. Do not apply them to a stale catalogue.
  const sourceId=(v:unknown)=>v==null?null:text(String(v),100);
  return {name:text(i.name,250),barcode:text(i.barcode??'',100),size:text(i.size??'',100),color:text(i.color??'',100),
   quantity:i.quantity,unitPrice:price/100,lineTotal:line/100,mrp:mrp/100,unitCost:cost,taxPercent:tax,
   productId:sourceId(i.productId),variantId:sourceId(i.variantId),designUnitId:sourceId(i.designUnitId),isQuickItem:i.isQuickItem===true};
 });
 if(sum!==subtotal)throw Error('ITEM_SUBTOTAL_MISMATCH');
 const taxAmount=s.taxAmount??0;if(typeof taxAmount!=='number'||!Number.isFinite(taxAmount)||taxAmount<0)throw Error('INVALID_TAX');
 return {clientTransactionId:transaction,invoiceNumber:invoice,createdAt:new Date(ts).toISOString(),customerName:name,customerPhone:phone,
 subtotal:subtotal/100,discount:discount/100,roundOff:roundOff/100,total:total/100,paid:paid/100,due:due/100,
 paymentMethod:method,paymentBreakdown:{cash:cash/100,upi:upi/100,card:card/100,unallocated:unallocated/100},taxAmount:Math.round(taxAmount*100)/100,items};
}
export function makeNewBillHandlerV60(deps:{authorized:(r:Request)=>Promise<boolean>,serviceKey:()=>string,fetcher?:typeof fetch}) {
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 const fail=(code:string,status:number)=>reply({ok:false,code,safeToMarkLocalSaleSynced:false},status);
 return async(request:Request)=>{
  if(request.method!=='POST')return fail('METHOD_NOT_ALLOWED',405);
  try{if(!await deps.authorized(request))return fail('OWNER_LOGIN_REQUIRED',401);}catch{return fail('OWNER_LOGIN_REQUIRED',401);}
  // NCS_V372_LOOPBACK_ORIGIN_PAIR: authenticated local desktop may use either
  // loopback hostname. This never admits external origins or bypasses owner auth.
  const origin=request.headers.get('origin');
  const requestUrl=new URL(request.url);
  const loopbackServer=requestUrl.protocol==='http:' && requestUrl.port==='32145' &&
    (requestUrl.hostname==='localhost'||requestUrl.hostname==='127.0.0.1');
  const allowedOrigins=['https://www.newcitystyle.store','https://newcitystyle.store',requestUrl.origin];
  if(loopbackServer) allowedOrigins.push('http://127.0.0.1:32145','http://localhost:32145');
  if(origin && !allowedOrigins.includes(origin))return fail('SAME_ORIGIN_REQUIRED',403);
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return fail('JSON_REQUIRED',415);
  let bill:ReturnType<typeof normalizeBillV60>;
  try{const raw=await request.text();if(new TextEncoder().encode(raw).length>131072)return fail('TOO_LARGE',413);bill=normalizeBillV60(JSON.parse(raw));}
  catch(e){return fail(e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'INVALID_JSON',422);}
  const key=deps.serviceKey().trim();if(!key)return fail('SUPABASE_SERVER_KEY_MISSING',503);
  try{
   const headers:Record<string,string>={apikey:key,'Content-Type':'application/json'};if(key.startsWith('eyJ'))headers.Authorization=`Bearer ${key}`;
   const res=await(deps.fetcher??fetch)('https://uskpoaszucenqxlzgmcy.supabase.co/rest/v1/rpc/ncs_store_new_bill_v60',{
    method:'POST',headers,body:JSON.stringify({p_bill:bill}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
   if(!res.ok){const err=await res.json().catch(()=>({}));return fail(err?.code==='23505'?'TRANSACTION_CONFLICT':'SUPABASE_SAVE_UNCONFIRMED_RETRY_SAME_ID',err?.code==='23505'?409:503);}
   const r=await res.json();
   if(!obj(r)||r.ok!==true||r.source!=='SUPABASE_NEW_BILLS_V60'||r.safeToMarkLocalSaleSynced!==true||
    r.clientTransactionId!==bill.clientTransactionId||r.invoiceNumber!==bill.invoiceNumber||typeof r.saleId!=='string'||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.saleId)||
    !/^[a-f0-9]{64}$/.test(String(r.payloadFingerprint))||money(r.total)!==money(bill.total)||money(r.paid)!==money(bill.paid)||money(r.due)!==money(bill.due))return fail('INVALID_STORAGE_RECEIPT_KEEP_PENDING',503);
   // NCS_V374_BILL_STOCK_STAGE: sale receipt is proven before stock phase.
   // A stock failure must NEVER be described as a failed bill insertion.
   // Preserve the original transaction ID and refuse to mark synced until stock is verified.
   const savedStockPending=(code:string)=>reply({ok:false,code,
     stage:'STOCK_PENDING_AFTER_BILL_SAVE',billSaved:true,stockConfirmed:false,
     clientTransactionId:bill.clientTransactionId,invoiceNumber:bill.invoiceNumber,
     safeToMarkLocalSaleSynced:false},503);
   // NCS_V255_ATOMIC_STOCK_COMMIT: existing V60 sale is written first, same ID is retried on failure.
   // The separate V254 Windows worker MUST remain disabled to avoid two competing writers.
   // Only bills created after this cutover are eligible; historical bills require separate reconciliation.
   if (Date.parse(bill.createdAt) >= Date.parse('2026-11-02T13:00:00Z')) {
    const totals=new Map<number,number>();
    for (const item of bill.items) {
     if(item.isQuickItem) continue;
     const variant=Number(item.variantId);
     if(!Number.isSafeInteger(variant)||variant<=0||!Number.isSafeInteger(item.quantity)||item.quantity<=0)
      return savedStockPending('V255_VARIANT_MISSING_BILL_SAVED_STOCK_PENDING');
     totals.set(variant,(totals.get(variant)||0)+item.quantity);
    }
    if(totals.size>0){
     const lines=[...totals.entries()].sort((a,b)=>a[0]-b[0]).map(([variantId,quantity])=>({variantId,quantity}));
     // Python V254 canonical JSON used alphabetic keys; keep hashes compatible.
     const canonical='['+lines.map(x=>'{'+'"quantity":'+x.quantity+',"variantId":'+x.variantId+'}').join(',')+']';
     const digest=createHash('sha256').update(canonical).digest('hex');
     try{
      const post=await(deps.fetcher??fetch)('https://uskpoaszucenqxlzgmcy.supabase.co/rest/v1/rpc/ncs_v254_post_stock',{
       method:'POST',headers,body:JSON.stringify({p_bill_id:bill.clientTransactionId,p_lines:lines,p_hash:digest}),
       cache:'no-store',redirect:'error',signal:AbortSignal.timeout(18000)});
      if(!post.ok) return savedStockPending('V255_STOCK_HTTP_'+post.status+'_BILL_SAVED_KEEP_PENDING');
      const stock=await post.json().catch(()=>null);
      if(!obj(stock)||stock.ok!==true||stock.bill_id!==bill.clientTransactionId)
       return savedStockPending('V255_STOCK_RECEIPT_UNVERIFIED_KEEP_LOCAL_PENDING');
      return reply({...r,stockSync:'CONFIRMED',stockAlreadyPosted:stock.already_posted===true});
     }catch{return savedStockPending('V255_STOCK_NETWORK_FAILURE_BILL_SAVED_KEEP_PENDING');}
    }
    return reply({...r,stockSync:'QUICK_ITEMS_ONLY'});
   }
   return reply({...r,stockSync:'OLDER_BILL_NO_AUTO_STOCK'});
  }catch{return fail('SUPABASE_SAVE_UNCONFIRMED_RETRY_SAME_ID',503);}
 };
}