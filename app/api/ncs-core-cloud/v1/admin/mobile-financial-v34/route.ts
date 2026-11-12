import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireRecoveryAdmin } from "@/lib/ncs-recovery-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
  "X-Content-Type-Options": "nosniff",
};
const respond = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });

/** V37 isolated Android owner ledger reader.
 * Based on the exact live-production Git commit. NO ledger/payment writes.
 */
export async function GET(request: Request) {
  if (!/^Bearer\s+\S+$/i.test(request.headers.get("authorization") || "")) {
    return respond({ ok: false, error: "V37_OWNER_TOKEN_REQUIRED" }, 401);
  }

  let authorized = false;
  try {
    authorized = (await requireRecoveryAdmin(request)).ok === true;
  } catch {
    return respond({ ok: false, error: "V37_OWNER_AUTH_UNAVAILABLE" }, 503);
  }
  if (!authorized) {
    return respond({ ok: false, error: "V37_OWNER_AUTH_DENIED" }, 403);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
              process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
              process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) {
    return respond({ ok: false, error: "V37_SERVER_CONFIG_MISSING" }, 503);
  }

  try {
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db.rpc("ncs_account_read_v69", {
      p_kind: "dues",
    });
    if (error) {
      console.error("V37_V69_RPC_FAILED", error.code || "UNKNOWN");
      return respond({ ok: false, error: "V37_LEDGER_READ_FAILED" }, 503);
    }
    if (!data || typeof data !== "object" || Array.isArray(data) ||
        data.ok !== true || data.source !== "SUPABASE_ACCOUNTS_V69" ||
        !Array.isArray(data.accounts) || !Array.isArray(data.transactions)) {
      return respond({ ok: false, error: "V37_V69_LEDGER_NOT_VERIFIED" }, 503);
    }
    return respond(data);
  } catch {
    return respond({ ok: false, error: "V37_LEDGER_READ_FAILED" }, 503);
  }
}

/** Send a payment confirmation only after a committed, matching V41 receipt.
 * Outbox is inserted by a DB trigger in the same financial transaction.
 * A claimed requestId is never sent twice automatically.
 */
async function notifyPaymentOnce(
  db: ReturnType<typeof createClient>,
  requestId: string,
): Promise<{whatsappStatus:string; whatsappMessageId?:string}> {
  const template=process.env.WHATSAPP_PAYMENT_RECEIVED_TEMPLATE_NAME?.trim();
  const token=process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId=process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if(!template || !token || !phoneId) {
    return {whatsappStatus:"not_configured"};
  }

  const {data:claimed,error:claimError}=await db
    .from("ncs_android_payment_notice_v42")
    .update({state:"sending",updated_at:new Date().toISOString()})
    .eq("request_id",requestId)
    .eq("state","pending")
    .select("request_id,account_id,amount,remaining_due,payment_method")
    .maybeSingle();
  if(claimError) {
    console.error("V42_NOTICE_CLAIM_FAILED",claimError.code||"UNKNOWN");
    return {whatsappStatus:"queue_unavailable"};
  }
  if(!claimed) {
    const {data:existing}=await db.from("ncs_android_payment_notice_v42")
      .select("state,meta_message_id").eq("request_id",requestId).maybeSingle();
    if(existing?.state==="accepted") return {
      whatsappStatus:"accepted",
      whatsappMessageId:String(existing.meta_message_id||"")
    };
    return {whatsappStatus:existing?.state==="failed"?"failed":"pending_review"};
  }

  const mark=async(state:"accepted"|"failed",messageId?:string,error?:string)=>{
    const {error:updateError}=await db.from("ncs_android_payment_notice_v42")
      .update({state,meta_message_id:messageId||null,last_error:error||null,
        updated_at:new Date().toISOString()})
      .eq("request_id",requestId).eq("state","sending");
    if(updateError) console.error("V42_NOTICE_RESULT_LOG_FAILED",updateError.code||"UNKNOWN");
  };

  try {
    const {data:ledger,error:ledgerError}=await db.rpc("ncs_account_read_v69",{p_kind:"dues"});
    if(ledgerError || !ledger || !Array.isArray(ledger.accounts)) {
      await mark("failed",undefined,"ACCOUNT_READ_FAILED");
      return {whatsappStatus:"failed"};
    }
    const account=ledger.accounts.find((a:{id?:unknown})=>
      Number(a.id)===Number(claimed.account_id));
    const digits=String(account?.customer_phone||"").replace(/\D/g,"");
    const phone=digits.length===10?"91"+digits:digits;
    if(!account || !/^91\d{10}$/.test(phone)) {
      await mark("failed",undefined,"CUSTOMER_PHONE_UNVERIFIED");
      return {whatsappStatus:"failed"};
    }
    const payment=Number(claimed.amount);
    const due=Number(claimed.remaining_due);
    if(!Number.isFinite(payment) || !Number.isFinite(due) || payment<=0 || due<0) {
      await mark("failed",undefined,"PAYMENT_AMOUNTS_INVALID");
      return {whatsappStatus:"failed"};
    }
    const method=String(claimed.payment_method||"").toLowerCase();
    const label=method==="upi"?"UPI":method==="card"?"Card":"Cash";
    const payload={
      messaging_product:"whatsapp",recipient_type:"individual",to:phone,
      type:"template",
      template:{
        name:template,
        language:{code:process.env.WHATSAPP_PAYMENT_RECEIVED_TEMPLATE_LANGUAGE?.trim()||"en"},
        components:[{type:"body",parameters:[
          {type:"text",text:String(account.customer_name||"Customer").slice(0,180)},
          {type:"text",text:payment.toFixed(2)},
          {type:"text",text:label},
          {type:"text",text:due.toFixed(2)}
        ]}]
      }
    };
    const response=await fetch(
      `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION||"v25.0"}/${phoneId}/messages`,
      {method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
        body:JSON.stringify(payload),cache:"no-store"}
    );
    const body:unknown=await response.json().catch(()=>null);
    const messageId=body && typeof body==="object" && "messages" in body?
      (body as {messages?:Array<{id?:string}>}).messages?.[0]?.id:undefined;
    if(!response.ok || !messageId) {
      console.error("V42_META_PAYMENT_TEMPLATE_REJECTED",response.status);
      await mark("failed",undefined,"META_TEMPLATE_REJECTED_"+response.status);
      return {whatsappStatus:"failed"};
    }
    await mark("accepted",messageId);
    return {whatsappStatus:"accepted",whatsappMessageId:messageId};
  } catch {
    await mark("failed",undefined,"NOTICE_DELIVERY_EXCEPTION");
    return {whatsappStatus:"failed"};
  }
}

// V38: owner-authorized reminder sending, existing approved Meta template only.
// This endpoint never commits customer payments or updates outstanding balances.
export async function POST(request: Request) {
  const bearer = request.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(bearer)) {
    return respond({ok:false,error:"V38_OWNER_TOKEN_REQUIRED"},401);
  }
  try {
    const auth = await requireRecoveryAdmin(request);
    if (!auth.ok) return respond({ok:false,error:"V38_OWNER_AUTH_DENIED"},403);
  } catch {
    return respond({ok:false,error:"V38_OWNER_AUTH_UNAVAILABLE"},503);
  }

  let input: Record<string,unknown>;
  try {
    const parsed:unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    input=parsed as Record<string,unknown>;
  } catch { return respond({ok:false,error:"INVALID_JSON"},400); }
  if (input.operation === "payment") {
    const accountId=Number(input.accountId);
    const amount=String(input.amount??"");
    const expectedDue=String(input.expectedDue??"");
    const method=String(input.method??"").toLowerCase();
    const reference=String(input.reference??"");
    const requestId=String(input.requestId??"");
    if (!Number.isSafeInteger(accountId) || accountId<=0 ||
        !/^[0-9]{1,8}[.][0-9]{2}$/.test(amount) ||
        !/^[0-9]{1,10}[.][0-9]{2}$/.test(expectedDue) ||
        !["cash","upi","card"].includes(method) ||
        reference.length>120 ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
      return respond({ok:false,error:"INVALID_PAYMENT_REQUEST"},400);
    }
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      process.env.SUPABASE_URL?.trim();
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_KEY?.trim();
    if(!url || !key) return respond({ok:false,error:"PAYMENT_SERVER_CONFIG_MISSING"},503);
    try {
      const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
      const {data,error}=await db.rpc("ncs_android_dual_receive_v41",{
        p:{accountId,amount,expectedDue,method,reference,requestId}
      });
      if(error) {
        console.error("V41_ATOMIC_RECEIVE_ERROR",error.code || "UNKNOWN");
        return respond({ok:false,error:"PAYMENT_NOT_CONFIRMED_VERIFY_LEDGER"},503);
      }
      if(!data || data.ok!==true) {
        const err=String(data?.error||"PAYMENT_NOT_CONFIRMED");
        return respond({ok:false,error:err},
          err==="CROSS_LEDGER_RECONCILIATION_REQUIRED"?409:400);
      }
      // Payment was confirmed by the atomic DB function. WhatsApp is a separate
      // notification result: never turn a committed payment into an API failure.
      const notice=await notifyPaymentOnce(db,requestId);
      return respond({...data,...notice});
    } catch {
      return respond({ok:false,error:"PAYMENT_NOT_CONFIRMED_VERIFY_LEDGER"},503);
    }
  }
  if (input.operation !== "reminder") {
    return respond({ok:false,error:"UNKNOWN_FINANCIAL_OPERATION"},400);
  }

  const accountId=Number(input.accountId);
  const expected=String(input.expectedDue ?? "");
  const requestId=String(input.requestId ?? "");
  if (!Number.isSafeInteger(accountId) || accountId <= 0 ||
      !/^\d{1,10}\.\d{2}$/.test(expected) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return respond({ok:false,error:"INVALID_REMINDER_REQUEST"},400);
  }

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
            process.env.SUPABASE_URL?.trim();
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
            process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) return respond({ok:false,error:"V38_SERVER_CONFIG_MISSING"},503);

  try {
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await db.rpc("ncs_account_read_v69",{p_kind:"dues"});
    if(error || !data || data.ok !== true || !Array.isArray(data.accounts)) {
      return respond({ok:false,error:"V38_LEDGER_UNAVAILABLE"},503);
    }
    const a=data.accounts.find((row:{id?:unknown})=>Number(row.id)===accountId);
    if(!a) return respond({ok:false,error:"ACCOUNT_NOT_FOUND_REFRESH"},404);
    const cents=(value:unknown):number|null=>{
      const v=String(value ?? "");
      const m=v.match(/^(\d{1,10})(?:\.(\d{1,2}))?$/);
      if(!m) return null;
      return Number(m[1])*100+Number((m[2]||"").padEnd(2,"0"));
    };
    const dueCents=cents(a.current_balance);
    if(dueCents===null || dueCents<=0 || dueCents!==cents(expected)) {
      return respond({ok:false,error:"DUE_CHANGED_REFRESH"},409);
    }
    const phone=String(a.customer_phone || "").replace(/\D/g,"");
    const normalized=phone.length===10 ? "91"+phone : phone;
    if(!/^91\d{10}$/.test(normalized)) {
      return respond({ok:false,error:"INVALID_CUSTOMER_PHONE"},422);
    }
    // Verify the live web account by phone and exact paise balance.
    // V69-only or disagreed accounts must be reconciled before contacting customers.
    const {data:webAccounts,error:webError}=await db
      .from("customer_credit_accounts")
      .select("customer_phone,current_balance,is_active")
      .eq("is_active",true);
    if(webError || !Array.isArray(webAccounts)) {
      return respond({ok:false,error:"CROSS_LEDGER_CHECK_UNAVAILABLE"},503);
    }
    const matching=webAccounts.filter((w:{customer_phone?:unknown})=>{
      const digits=String(w.customer_phone||"").replace(/\D/g,"");
      return digits.length>=10 && digits.slice(-10)===normalized.slice(-10);
    });
    if(matching.length!==1 || cents(matching[0].current_balance)!==dueCents) {
      return respond({ok:false,error:"CROSS_LEDGER_MISMATCH_RECONCILE_FIRST"},409);
    }
    if(Array.isArray(data.reminder_logs) &&
      data.reminder_logs.some((log:{id?:unknown})=>String(log.id)===requestId)) {
      return respond({ok:true,duplicate:true,alreadySent:true,requestId});
    }

    const accessToken=process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId=process.env.WHATSAPP_PHONE_NUMBER_ID;
    const template=process.env.WHATSAPP_CUSTOMER_DUE_TEMPLATE_NAME?.trim();
    const language=process.env.WHATSAPP_CUSTOMER_DUE_TEMPLATE_LANGUAGE?.trim()||"en";
    if(!accessToken || !phoneId || !template) {
      return respond({ok:false,error:"WHATSAPP_TEMPLATE_NOT_CONFIGURED"},503);
    }
    const qr=process.env.WHATSAPP_CUSTOMER_DUE_QR_IMAGE_URL?.trim() ||
      "https://www.newcitystyle.store/ncs-upi-qr.png";
    const meta=await fetch(
      `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION||"v25.0"}/${phoneId}/messages`,
      {
        method:"POST",
        headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},
        body:JSON.stringify({
          messaging_product:"whatsapp",recipient_type:"individual",
          to:normalized,type:"template",
          template:{name:template,language:{code:language},components:[
            {type:"header",parameters:[{type:"image",image:{link:qr}}]},
            {type:"body",parameters:[
              {type:"text",text:String(a.customer_name||"Customer").slice(0,180)},
              {type:"text",text:(dueCents/100).toFixed(2)}
            ]}
          ]}
        }),
        cache:"no-store"
      }
    );
    const metaBody:unknown=await meta.json().catch(()=>null);
    const msg=metaBody && typeof metaBody==="object" && "messages" in metaBody ?
      (metaBody as {messages?:Array<{id?:string}>}).messages?.[0]?.id : null;
    if(!meta.ok || !msg) {
      console.error("V38_WHATSAPP_META_REJECTED",meta.status);
      return respond({ok:false,error:"WHATSAPP_META_REJECTED",httpStatus:meta.status},502);
    }

    // Meta accepted the message; never claim it wasn't sent solely due to log failure.
    const {data:logged,error:logError}=await db.rpc("ncs_account_reminder_v69",{
      p_account:accountId,p_request:requestId,
      p_balance:dueCents/100,p_message:"Android owner WhatsApp due reminder accepted by Meta"
    });
    return respond({ok:true,success:true,directWhatsAppSent:true,
      whatsappMessageId:msg,logRecorded:!logError && logged?.ok===true,
      requestId});
  } catch {
    return respond({ok:false,error:"V38_REMINDER_UNAVAILABLE"},503);
  }
}
