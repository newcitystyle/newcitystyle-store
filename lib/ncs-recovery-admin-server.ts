import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const NCS_ADMIN_EMAIL =
  "badri.nsv@gmail.com";

export function recoveryConfig() {
  return {
    baseUrl:
      process.env.NCS_RECOVERY_BASE_URL
        ?.trim()
        .replace(/\/$/, "") || "",
    apiKey:
      process.env.NCS_RECOVERY_API_KEY
        ?.trim() || "",
  };
}

function createServerSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL
      ?.trim() ||
    process.env.SUPABASE_URL?.trim();

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY
      ?.trim() ||
    process.env.SUPABASE_SERVICE_KEY
      ?.trim();

  if (!url || !key) {
    throw new Error(
      "Supabase server credentials are missing.",
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function requireRecoveryAdmin(
  request: Request,
) {
  const authorization =
    request.headers
      .get("authorization")
      ?.trim() || "";

  const token = authorization
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          ok: false,
          error: "Missing admin authorization.",
        },
        { status: 401 },
      ),
    };
  }

  const supabase = createServerSupabase();
  const { data, error } =
    await supabase.auth.getUser(token);

  const email =
    data.user?.email
      ?.trim()
      .toLowerCase() || "";

  if (
    error ||
    !data.user ||
    email !== NCS_ADMIN_EMAIL
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          ok: false,
          error: "Unauthorized admin request.",
        },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true as const,
    userId: data.user.id,
    email,
  };
}