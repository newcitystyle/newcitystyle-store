import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectAndClearState(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.cookies.delete("google_business_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const code = searchParams.get("code");
    const returnedState = searchParams.get("state");
    const googleError = searchParams.get("error");

    const savedState = request.cookies.get(
      "google_business_oauth_state"
    )?.value;

    if (googleError) {
      console.error("Google OAuth error:", googleError);

      return redirectAndClearState(
        request,
        `/admin?google_business=error&reason=${encodeURIComponent(
          googleError
        )}`
      );
    }

    if (!returnedState || !savedState || returnedState !== savedState) {
      console.error("Google OAuth state verification failed.");

      return redirectAndClearState(
        request,
        "/admin?google_business=invalid_state"
      );
    }

    if (!code) {
      return redirectAndClearState(
        request,
        "/admin?google_business=missing_code"
      );
    }

    const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_BUSINESS_REDIRECT_URI;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error(
        "Missing Google Business OAuth environment variables."
      );

      return redirectAndClearState(
        request,
        "/admin?google_business=config_error"
      );
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error(
        "Missing Supabase server environment variables."
      );

      return redirectAndClearState(
        request,
        "/admin?google_business=supabase_config_error"
      );
    }

    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
        cache: "no-store",
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Google token exchange failed:", tokenData);

      return redirectAndClearState(
        request,
        "/admin?google_business=token_error"
      );
    }

    const refreshToken =
      typeof tokenData?.refresh_token === "string"
        ? tokenData.refresh_token
        : null;

    const scope =
      typeof tokenData?.scope === "string"
        ? tokenData.scope
        : null;

    if (!refreshToken) {
      console.warn(
        "Google OAuth completed but no refresh token was returned."
      );

      return redirectAndClearState(
        request,
        "/admin?google_business=no_refresh_token"
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const now = new Date().toISOString();

    const { error: saveError } = await supabaseAdmin
      .from("google_business_credentials")
      .upsert(
        {
          id: "primary",
          refresh_token: refreshToken,
          scope,
          updated_at: now,
        },
        {
          onConflict: "id",
        }
      );

    if (saveError) {
      console.error(
        "Failed to save Google Business refresh token:",
        saveError
      );

      return redirectAndClearState(
        request,
        "/admin?google_business=save_error"
      );
    }

    console.log(
      "Google Business Profile OAuth connected and refresh token stored successfully."
    );

    return redirectAndClearState(
      request,
      "/admin?google_business=connected"
    );
  } catch (error) {
    console.error("Google Business callback error:", error);

    return redirectAndClearState(
      request,
      "/admin?google_business=server_error"
    );
  }
}