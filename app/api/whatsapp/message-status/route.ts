import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WhatsAppMessageLogRow = {
  message_id: string;
  status: string | null;
  meta_timestamp: string | null;
  updated_at: string | null;
  error_code: number | null;
  error_title: string | null;
  error_message: string | null;
  error_details: string | null;
};

function adminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(
  request: NextRequest,
) {
  const messageId =
    request.nextUrl.searchParams
      .get("messageId")
      ?.trim() || "";

  if (
    !messageId ||
    messageId.length > 512 ||
    /\s/.test(messageId)
  ) {
    return NextResponse.json(
      {
        success: false,
        found: false,
        error:
          "A valid WhatsApp messageId is required.",
      },
      {
        status: 400,
      },
    );
  }

  const supabase =
    adminClient();

  if (!supabase) {
    return NextResponse.json(
      {
        success: false,
        found: false,
        error:
          "WhatsApp delivery-status storage is not configured on the server.",
      },
      {
        status: 503,
      },
    );
  }

  /*
   * IMPORTANT:
   * Keep this SELECT as a literal string.
   *
   * Supabase's TypeScript select parser cannot infer columns correctly
   * when the select expression is built with Array.join(","), and that
   * causes `data` to become GenericStringError during Next.js build.
   */
  const { data, error } =
    await supabase
      .from("whatsapp_message_logs")
      .select(
        "message_id,status,meta_timestamp,updated_at,error_code,error_title,error_message,error_details",
      )
      .eq(
        "message_id",
        messageId,
      )
      .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        success: false,
        found: false,
        error:
          error.message,
      },
      {
        status: 500,
      },
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        success: true,
        found: false,
        status: "accepted",
      },
      {
        status: 200,
      },
    );
  }

  /*
   * The runtime row is guaranteed by the exact column list above.
   * This explicit shape also keeps the route stable across Supabase
   * client type-generation differences.
   */
  const row =
    data as unknown as
      WhatsAppMessageLogRow;

  return NextResponse.json(
    {
      success: true,
      found: true,
      messageId:
        row.message_id,
      status:
        row.status ||
        "unknown",
      metaTimestamp:
        row.meta_timestamp ||
        null,
      updatedAt:
        row.updated_at ||
        null,
      errorCode:
        row.error_code ??
        null,
      errorTitle:
        row.error_title ||
        null,
      errorMessage:
        row.error_message ||
        null,
      errorDetails:
        row.error_details ||
        null,
    },
    {
      status: 200,
    },
  );
}