import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !clientId ||
      !clientSecret ||
      !supabaseUrl ||
      !supabaseServiceRoleKey
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Server configuration is incomplete.",
        },
        { status: 500 }
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

    const { data: credentials, error: credentialsError } =
      await supabaseAdmin
        .from("google_business_credentials")
        .select("refresh_token")
        .eq("id", "primary")
        .single();

    if (credentialsError || !credentials?.refresh_token) {
      console.error(
        "Google Business credentials not found:",
        credentialsError
      );

      return NextResponse.json(
        {
          success: false,
          connected: false,
          error: "Google Business refresh token not found.",
        },
        { status: 404 }
      );
    }

    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: credentials.refresh_token,
          grant_type: "refresh_token",
        }),
        cache: "no-store",
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData?.access_token) {
      console.error(
        "Google access token refresh failed:",
        tokenData
      );

      return NextResponse.json(
        {
          success: false,
          connected: false,
          error: "Unable to refresh Google access token.",
        },
        { status: 502 }
      );
    }

    const accountsResponse = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
        cache: "no-store",
      }
    );

    const accountsData = await accountsResponse.json();

    if (!accountsResponse.ok) {
      console.error(
        "Google Business accounts request failed:",
        accountsData
      );

      return NextResponse.json(
        {
          success: false,
          connected: true,
          googleApiReady: false,
          status: accountsResponse.status,
          error:
            accountsData?.error?.message ||
            "Google Business Account Management API request failed.",
        },
        { status: accountsResponse.status }
      );
    }

    const accounts = Array.isArray(accountsData?.accounts)
      ? accountsData.accounts.map((account: any) => ({
          name: account?.name ?? null,
          accountName: account?.accountName ?? null,
          type: account?.type ?? null,
          role: account?.role ?? null,
          verificationState:
            account?.verificationState ?? null,
          vettedState: account?.vettedState ?? null,
        }))
      : [];

    return NextResponse.json({
      success: true,
      connected: true,
      googleApiReady: true,
      accountCount: accounts.length,
      accounts,
    });
  } catch (error) {
    console.error(
      "Google Business status route error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}