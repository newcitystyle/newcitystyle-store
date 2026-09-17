import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WhatsAppStatusError = {
  code?: number;
  title?: string;
  message?: string;
  error_data?: {
    details?: string;
  };
};

type WhatsAppStatus = {
  id?: string;
  status?: "sent" | "delivered" | "read" | "failed" | string;
  timestamp?: string;
  recipient_id?: string;
  conversation?: {
    id?: string;
    expiration_timestamp?: string;
    origin?: {
      type?: string;
    };
  };
  pricing?: {
    billable?: boolean;
    pricing_model?: string;
    category?: string;
    type?: string;
  };
  errors?: WhatsAppStatusError[];
};

type WhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;

        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };

        contacts?: Array<{
          profile?: {
            name?: string;
          };
          wa_id?: string;
        }>;

        messages?: Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: {
            body?: string;
          };
        }>;

        statuses?: WhatsAppStatus[];
        errors?: WhatsAppStatusError[];
      };
    }>;
  }>;
};

/* ============================================================
   PHONE PRIVACY
============================================================ */

function maskPhone(
  value?: string,
): string | null {
  if (!value) {
    return null;
  }

  const digits =
    value.replace(/\D/g, "");

  if (digits.length <= 4) {
    return digits;
  }

  return `${"*".repeat(
    Math.max(
      0,
      digits.length - 4,
    ),
  )}${digits.slice(-4)}`;
}

function recipientLast4(
  value?: string,
): string | null {
  if (!value) {
    return null;
  }

  const digits =
    value.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  return digits.slice(-4);
}

/* ============================================================
   META TIMESTAMP
============================================================ */

function metaTimestamp(
  value?: string,
): string | null {
  if (!value) {
    return null;
  }

  const seconds =
    Number(value);

  if (
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return null;
  }

  return new Date(
    seconds * 1000,
  ).toISOString();
}

/* ============================================================
   SUPABASE SERVER CLIENT
============================================================ */

function createWebhookSupabaseAdmin() {
  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL
      ?.trim() ||
    process.env
      .SUPABASE_URL
      ?.trim();

  const key =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY
      ?.trim() ||
    process.env
      .SUPABASE_SERVICE_KEY
      ?.trim();

  if (
    !url ||
    !key
  ) {
    return null;
  }

  return createClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

/* ============================================================
   META WEBHOOK VERIFICATION
============================================================ */

export async function GET(
  request: NextRequest,
) {
  const mode =
    request.nextUrl
      .searchParams
      .get("hub.mode");

  const token =
    request.nextUrl
      .searchParams
      .get(
        "hub.verify_token",
      );

  const challenge =
    request.nextUrl
      .searchParams
      .get("hub.challenge");

  const verifyToken =
    process.env
      .WHATSAPP_VERIFY_TOKEN
      ?.trim();

  if (!verifyToken) {
    console.error(
      "WHATSAPP_VERIFY_TOKEN is missing from environment variables.",
    );

    return new NextResponse(
      "Webhook verify token is not configured.",
      {
        status: 500,
      },
    );
  }

  if (
    mode === "subscribe" &&
    token === verifyToken &&
    challenge
  ) {
    console.log(
      "WhatsApp webhook verification successful.",
    );

    return new NextResponse(
      challenge,
      {
        status: 200,
        headers: {
          "Content-Type":
            "text/plain",
        },
      },
    );
  }

  console.warn(
    "WhatsApp webhook verification failed.",
    {
      mode,
      hasToken:
        Boolean(token),
      hasChallenge:
        Boolean(challenge),
    },
  );

  return new NextResponse(
    "Forbidden",
    {
      status: 403,
    },
  );
}

/* ============================================================
   WHATSAPP DELIVERY + INCOMING MESSAGE WEBHOOK

   Receives:
   - sent
   - delivered
   - read
   - failed
   - customer replies

   Delivery state is stored in:
   public.whatsapp_message_logs

   LIVA later reads only the delivery status through the
   website message-status API.
============================================================ */

export async function POST(
  request: NextRequest,
) {
  try {
    const payload =
      (await request.json()) as
        WhatsAppWebhookPayload;

    if (
      payload.object !==
      "whatsapp_business_account"
    ) {
      console.info(
        "Ignored non-WhatsApp webhook payload.",
        {
          object:
            payload.object ||
            null,
        },
      );

      return NextResponse.json(
        {
          success: true,
          ignored: true,
        },
        {
          status: 200,
        },
      );
    }

    const deliveryEvents:
      Array<
        Record<
          string,
          unknown
        >
      > = [];

    const incomingMessages:
      Array<
        Record<
          string,
          unknown
        >
      > = [];

    const deliveryRows:
      Array<
        Record<
          string,
          unknown
        >
      > = [];

    for (
      const entry of
      payload.entry || []
    ) {
      for (
        const change of
        entry.changes || []
      ) {
        const value =
          change.value;

        /* ====================================================
           DELIVERY STATUS
        ==================================================== */

        for (
          const status of
          value?.statuses || []
        ) {
          const firstError =
            status.errors?.[0];

          const event = {
            whatsappBusinessAccountId:
              entry.id || null,

            phoneNumberId:
              value?.metadata
                ?.phone_number_id ||
              null,

            displayPhoneNumber:
              value?.metadata
                ?.display_phone_number ||
              null,

            messageId:
              status.id || null,

            status:
              status.status ||
              "unknown",

            recipient:
              maskPhone(
                status.recipient_id,
              ),

            timestamp:
              status.timestamp ||
              null,

            conversationId:
              status.conversation
                ?.id || null,

            conversationCategory:
              status.conversation
                ?.origin
                ?.type || null,

            billable:
              status.pricing
                ?.billable ??
              null,

            pricingCategory:
              status.pricing
                ?.category ||
              status.pricing
                ?.type ||
              null,

            errorCode:
              firstError?.code ??
              null,

            errorTitle:
              firstError?.title ||
              null,

            errorMessage:
              firstError?.message ||
              null,

            errorDetails:
              firstError
                ?.error_data
                ?.details ||
              null,
          };

          deliveryEvents.push(
            event,
          );

          /*
           * Store delivery status only when Meta supplied
           * a real WhatsApp message id.
           */
          if (status.id) {
            deliveryRows.push(
              {
                message_id:
                  status.id,

                status:
                  status.status ||
                  "unknown",

                recipient_last4:
                  recipientLast4(
                    status.recipient_id,
                  ),

                conversation_id:
                  status
                    .conversation
                    ?.id ||
                  null,

                conversation_category:
                  status
                    .conversation
                    ?.origin
                    ?.type ||
                  null,

                error_code:
                  firstError?.code ??
                  null,

                error_title:
                  firstError?.title ||
                  null,

                error_message:
                  firstError
                    ?.message ||
                  null,

                error_details:
                  firstError
                    ?.error_data
                    ?.details ||
                  null,

                meta_timestamp:
                  metaTimestamp(
                    status.timestamp,
                  ),

                updated_at:
                  new Date()
                    .toISOString(),
              },
            );
          }

          if (
            status.status ===
            "failed"
          ) {
            console.error(
              "WHATSAPP MESSAGE FAILED:",
              JSON.stringify(
                event,
                null,
                2,
              ),
            );
          } else {
            console.log(
              "WHATSAPP MESSAGE STATUS:",
              JSON.stringify(
                event,
                null,
                2,
              ),
            );
          }
        }

        /* ====================================================
           CUSTOMER INCOMING MESSAGE
        ==================================================== */

        for (
          const message of
          value?.messages || []
        ) {
          const incoming = {
            whatsappBusinessAccountId:
              entry.id || null,

            phoneNumberId:
              value?.metadata
                ?.phone_number_id ||
              null,

            messageId:
              message.id || null,

            from:
              maskPhone(
                message.from,
              ),

            timestamp:
              message.timestamp ||
              null,

            type:
              message.type ||
              null,

            text:
              message.text
                ?.body ||
              null,
          };

          incomingMessages.push(
            incoming,
          );

          console.log(
            "WHATSAPP INCOMING MESSAGE:",
            JSON.stringify(
              incoming,
              null,
              2,
            ),
          );
        }

        /* ====================================================
           WEBHOOK LEVEL ERRORS
        ==================================================== */

        for (
          const error of
          value?.errors || []
        ) {
          console.error(
            "WHATSAPP WEBHOOK ERROR:",
            JSON.stringify(
              {
                code:
                  error.code ??
                  null,

                title:
                  error.title ||
                  null,

                message:
                  error.message ||
                  null,

                details:
                  error.error_data
                    ?.details ||
                  null,
              },
              null,
              2,
            ),
          );
        }
      }
    }

    /* ========================================================
       SAVE REAL DELIVERY STATE TO SUPABASE
    ======================================================== */

    if (
      deliveryRows.length >
      0
    ) {
      const admin =
        createWebhookSupabaseAdmin();

      if (!admin) {
        console.warn(
          "WhatsApp delivery DB logging skipped: Supabase service credentials are not configured.",
        );
      } else {
        const {
          error: logError,
        } =
          await admin
            .from(
              "whatsapp_message_logs",
            )
            .upsert(
              deliveryRows,
              {
                onConflict:
                  "message_id",
              },
            );

        if (logError) {
          console.error(
            "Unable to persist WhatsApp delivery status:",
            logError.message,
          );
        } else {
          console.log(
            `WhatsApp delivery status saved: ${deliveryRows.length} event(s).`,
          );
        }
      }
    }

    /*
     * Meta expects HTTP 200 quickly.
     *
     * A WhatsApp delivery failure itself must NOT cause
     * the webhook HTTP request to return an error.
     */
    return NextResponse.json(
      {
        success: true,
        received: true,

        deliveryEventCount:
          deliveryEvents.length,

        incomingMessageCount:
          incomingMessages.length,

        deliveryRowsSaved:
          deliveryRows.length,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "WhatsApp webhook processing error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Invalid WhatsApp webhook payload.",
      },
      {
        status: 400,
      },
    );
  }
}