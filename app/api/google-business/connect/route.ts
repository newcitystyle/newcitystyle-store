import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_BUSINESS_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        {
          success: false,
          error: "Google Business OAuth configuration is incomplete.",
        },
        { status: 500 }
      );
    }

    const state = crypto.randomBytes(32).toString("hex");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set(
      "scope",
      "https://www.googleapis.com/auth/business.manage"
    );
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authUrl);

    response.cookies.set("google_business_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Google Business connect error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to start Google Business OAuth.",
      },
      { status: 500 }
    );
  }
}