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
  if (input.operation !== "reminder") {
    return respond({ok:false,error:"V38_PAYMENT_POST_NOT_ENABLED"},405);
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
