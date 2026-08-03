import { NextRequest, NextResponse } from "next/server";

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

function maskPhone(value?: string): string | null {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");

  if (digits.length <= 4) {
    return digits;
  }

  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

/*
 * META WEBHOOK VERIFICATION
 *
 * Meta calls this GET route when the Callback URL is first configured.
 *
 * Add the same secret text in:
 * 1. .env.local:
 *    WHATSAPP_VERIFY_TOKEN=your_private_verify_token
 *
 * 2. Meta App Dashboard:
 *    WhatsApp -> Configuration -> Webhook -> Verify token
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  const verifyToken =
    process.env.WHATSAPP_VERIFY_TOKEN?.trim();

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
    console.log("WhatsApp webhook verification successful.");

    return new NextResponse(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  console.warn("WhatsApp webhook verification failed.", {
    mode,
    hasToken: Boolean(token),
    hasChallenge: Boolean(challenge),
  });

  return new NextResponse("Forbidden", {
    status: 403,
  });
}

/*
 * WHATSAPP DELIVERY AND INCOMING MESSAGE EVENTS
 *
 * This receives:
 * - sent
 * - delivered
 * - read
 * - failed
 * - customer replies
 *
 * For now it safely logs the complete delivery result in the Vercel/server
 * terminal. After delivery is confirmed, this route can also update a
 * Supabase whatsapp_message_logs table without changing the send route.
 */
export async function POST(request: NextRequest) {
  try {
    const payload =
      (await request.json()) as WhatsAppWebhookPayload;

    if (payload.object !== "whatsapp_business_account") {
      console.info(
        "Ignored non-WhatsApp webhook payload.",
        {
          object: payload.object || null,
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

    const deliveryEvents: Array<Record<string, unknown>> = [];
    const incomingMessages: Array<Record<string, unknown>> = [];

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;

        for (const status of value?.statuses || []) {
          const firstError = status.errors?.[0];

          const event = {
            whatsappBusinessAccountId: entry.id || null,
            phoneNumberId:
              value?.metadata?.phone_number_id || null,
            displayPhoneNumber:
              value?.metadata?.display_phone_number || null,
            messageId: status.id || null,
            status: status.status || "unknown",
            recipient:
              maskPhone(status.recipient_id) || null,
            timestamp: status.timestamp || null,
            conversationId:
              status.conversation?.id || null,
            conversationCategory:
              status.conversation?.origin?.type || null,
            billable:
              status.pricing?.billable ?? null,
            pricingCategory:
              status.pricing?.category ||
              status.pricing?.type ||
              null,
            errorCode: firstError?.code ?? null,
            errorTitle: firstError?.title || null,
            errorMessage: firstError?.message || null,
            errorDetails:
              firstError?.error_data?.details || null,
          };

          deliveryEvents.push(event);

          if (status.status === "failed") {
            console.error(
              "WHATSAPP MESSAGE FAILED:",
              JSON.stringify(event, null, 2),
            );
          } else {
            console.log(
              "WHATSAPP MESSAGE STATUS:",
              JSON.stringify(event, null, 2),
            );
          }
        }

        for (const message of value?.messages || []) {
          const incoming = {
            whatsappBusinessAccountId: entry.id || null,
            phoneNumberId:
              value?.metadata?.phone_number_id || null,
            messageId: message.id || null,
            from: maskPhone(message.from) || null,
            timestamp: message.timestamp || null,
            type: message.type || null,
            text: message.text?.body || null,
          };

          incomingMessages.push(incoming);

          console.log(
            "WHATSAPP INCOMING MESSAGE:",
            JSON.stringify(incoming, null, 2),
          );
        }

        for (const error of value?.errors || []) {
          console.error(
            "WHATSAPP WEBHOOK ERROR:",
            JSON.stringify(
              {
                code: error.code ?? null,
                title: error.title || null,
                message: error.message || null,
                details:
                  error.error_data?.details || null,
              },
              null,
              2,
            ),
          );
        }
      }
    }

    /*
     * Meta expects a fast HTTP 200 response.
     * Never return an error merely because a WhatsApp message status is
     * "failed"; the failure details are inside the webhook payload.
     */
    return NextResponse.json(
      {
        success: true,
        received: true,
        deliveryEventCount: deliveryEvents.length,
        incomingMessageCount: incomingMessages.length,
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

    /*
     * A malformed request receives 400.
     * Valid Meta webhook payloads will normally reach the success response.
     */
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