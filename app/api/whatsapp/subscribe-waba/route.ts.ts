import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WABA_ID = "7166799981229558";

function env(name: string): string {
  return (process.env[name] || "").trim();
}

async function safeJson(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function compactMetaError(value: any) {
  const err = value?.error;

  if (!err) return value;

  return {
    message: err.message,
    type: err.type,
    code: err.code,
    error_subcode: err.error_subcode,
  };
}

export async function GET() {
  // IMPORTANT:
  // Keep the existing WHATSAPP_ACCESS_TOKEN untouched because it is already
  // used by production bill/reminder messaging.
  //
  // This temporary helper uses a separate management token first.
  const managementToken = env("WHATSAPP_MANAGEMENT_TOKEN");
  const accessToken =
    managementToken ||
    env("WHATSAPP_ACCESS_TOKEN");

  const apiVersion =
    env("WHATSAPP_API_VERSION") ||
    env("FACEBOOK_GRAPH_VERSION") ||
    "v25.0";

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        step: "env",
        error:
          "WHATSAPP_MANAGEMENT_TOKEN is missing. Add the NCS Automation system-user token in Vercel Production environment.",
      },
      { status: 500 },
    );
  }

  const base = `https://graph.facebook.com/${apiVersion}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  try {
    // First confirm the token itself is valid.
    const tokenCheckRes = await fetch(
      `${base}/me?fields=id,name`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      },
    );

    const tokenCheck = await safeJson(tokenCheckRes);

    if (!tokenCheckRes.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "verify_token",
          apiVersion,
          usingManagementToken: Boolean(managementToken),
          meta: compactMetaError(tokenCheck),
        },
        { status: tokenCheckRes.status },
      );
    }

    // Then confirm that this token can see the production WABA.
    const verifyRes = await fetch(
      `${base}/${WABA_ID}?fields=id,name`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      },
    );

    const verify = await safeJson(verifyRes);

    if (!verifyRes.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "verify_waba",
          apiVersion,
          wabaId: WABA_ID,
          usingManagementToken: Boolean(managementToken),
          tokenIdentity: tokenCheck,
          meta: compactMetaError(verify),
          hint:
            "This token is valid, but it does not have management access to the NEW CITY STYLE WABA. Confirm NCS Automation has Full access to the NEW CITY STYLE WhatsApp account and generate the token with whatsapp_business_management + whatsapp_business_messaging.",
        },
        { status: verifyRes.status },
      );
    }

    // Subscribe the app to WABA webhook events.
    const subscribeRes = await fetch(
      `${base}/${WABA_ID}/subscribed_apps`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "",
        cache: "no-store",
      },
    );

    const subscribe = await safeJson(subscribeRes);

    if (!subscribeRes.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "subscribe_waba",
          apiVersion,
          wabaId: WABA_ID,
          usingManagementToken: Boolean(managementToken),
          tokenIdentity: tokenCheck,
          waba: verify,
          meta: compactMetaError(subscribe),
        },
        { status: subscribeRes.status },
      );
    }

    // Read back the subscription.
    const checkRes = await fetch(
      `${base}/${WABA_ID}/subscribed_apps`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      },
    );

    const check = await safeJson(checkRes);

    return NextResponse.json(
      {
        success: true,
        step: "complete",
        apiVersion,
        wabaId: WABA_ID,
        usingManagementToken: Boolean(managementToken),
        tokenIdentity: tokenCheck,
        waba: verify,
        subscription: subscribe,
        subscribedApps: checkRes.ok ? check : compactMetaError(check),
        next:
          "Send Hi from another phone number to the NEW CITY STYLE WhatsApp number and check the webhook auto reply.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        step: "server",
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error.",
      },
      { status: 500 },
    );
  }
}
