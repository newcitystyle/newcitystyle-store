import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";



export const runtime = "nodejs";

export const dynamic = "force-dynamic";



type ActionType =

  | "CUSTOM"

  | "ORDER_CONFIRM"

  | "ORDER_CANCEL"

  | "ORDER_READY"

  | "PAYMENT_REMINDER"

  | "BOOKING_CONFIRM"

  | "THANK_YOU"

  | "PAYMENT_REQUEST";



type CustomerActionBody = {

  to?: string;

  customerName?: string;

  leadId?: string | null;

  action?: ActionType;

  message?: string;

  amount?: number;

  orderReference?: string;

  paymentMethod?: "RAZORPAY_LINK" | "UPI_LINK" | "UPI_QR";

  paymentLink?: string;

  upiLink?: string;

  qrImageUrl?: string;

};



type MetaResponse = {

  messages?: Array<{

    id?: string;

    message_status?: string;

  }>;

  error?: {

    message?: string;

    code?: number;

    error_subcode?: number;

    type?: string;

    fbtrace_id?: string;

    error_data?: {

      details?: string;

    };

  };

};



const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;



function normalizePhone(value: unknown) {

  return String(value || "").replace(/[^\d]/g, "");

}



function cleanText(value: unknown, max = 2000) {

  return String(value || "").trim().slice(0, max);

}



function buildPresetMessage(

  action: ActionType,

  customerName: string,

): string {

  const name = customerName || "Customer";



  switch (action) {

    case "ORDER_CONFIRM":

      return `Hi ${name} 👋\n\n✅ Your order with NEW CITY STYLE is confirmed.\n\nThank you for shopping with us. We will keep you updated about the next step.`;



    case "ORDER_CANCEL":

      return `Hi ${name},\n\n❌ Your order with NEW CITY STYLE has been cancelled as requested.\n\nIf you need another size, colour or style, just message us anytime.`;



    case "ORDER_READY":

      return `Hi ${name} 👋\n\n🛍️ Your NEW CITY STYLE order is READY.\n\nYou can visit the store / collect your order. If you need any help, reply to this message.`;



    case "PAYMENT_REMINDER":

      return `Hi ${name},\n\n💳 Friendly payment reminder from NEW CITY STYLE.\n\nPlease complete the pending payment when convenient. If you have already paid, you can ignore this message.`;



    case "BOOKING_CONFIRM":

      return `Hi ${name} 👋\n\n✅ Your item booking at NEW CITY STYLE is confirmed.\n\nWe have noted your booking. Reply here if you want any change in size, colour or item.`;



    case "THANK_YOU":

      return `Thank you ${name} ❤️\n\nNEW CITY STYLE appreciates your visit and support. Message us anytime for new arrivals, sizes, colours or offers.`;



    default:

      return "";

  }

}





function money(value: number) {

  return new Intl.NumberFormat("en-IN", {

    style: "currency",

    currency: "INR",

    maximumFractionDigits: 2,

  }).format(value);

}



function buildRawUpiUri(

  amount: number,

  orderReference: string,

) {

  const upiId = String(

    process.env.NCS_UPI_ID || "9010014001@pzw",

  ).trim();



  const payeeName = String(

    process.env.NCS_UPI_NAME || "NEW CITY STYLE",

  ).trim();



  const parts = [

    `pa=${encodeURIComponent(upiId).replace("%40", "@")}`,

    `pn=${encodeURIComponent(payeeName)}`,

    `am=${amount.toFixed(2)}`,

    "cu=INR",

  ];



  if (orderReference) {

    parts.push(

      `tn=${encodeURIComponent(`NEW CITY STYLE ${orderReference}`)}`,

    );

  }



  return `upi://pay?${parts.join("&")}`;

}



function buildClickableUpiPage(

  amount: number,

  orderReference: string,

) {

  const siteUrl = String(

    process.env.NCS_SITE_URL ||

      "https://www\.newcitystyle.store",

  )

    .trim()

    .replace(/\/+$/, "");



  const params = new URLSearchParams();



  if (amount > 0) {

    params.set("amount", amount.toFixed(2));

  }



  if (orderReference) {

    params.set("ref", orderReference);

  }



  return `${siteUrl}/pay/upi?${params.toString()}`;

}



async function sendMetaImage(

  accessToken: string,

  apiVersion: string,

  phoneNumberId: string,

  to: string,

  imageUrl: string,

  caption: string,

) {

  const response = await fetch(

    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,

    {

      method: "POST",

      headers: {

        Authorization: `Bearer ${accessToken}`,

        "Content-Type": "application/json",

      },

      body: JSON.stringify({

        messaging_product: "whatsapp",

        recipient_type: "individual",

        to,

        type: "image",

        image: {

          link: imageUrl,

          caption,

        },

      }),

      cache: "no-store",

    },

  );



  const data = (await response.json()) as MetaResponse;



  if (!response.ok) {

    throw new Error(

      data.error?.message ||

        data.error?.error_data?.details ||

        "QR image could not be sent.",

    );

  }



  return data.messages?.[0]?.id || null;

}






async function sendMetaPaidQuickReply(
  accessToken: string,
  apiVersion: string,
  phoneNumberId: string,
  to: string,
  orderReference: string,
) {
  const safeReference =
    cleanText(orderReference, 120) ||
    `NCS-${Date.now()}`;

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text:
              "Payment complete అయిన తర్వాత కింద ఉన్న I HAVE PAID button ఒక్కసారి tap చేయండి. UTR type చేయాల్సిన అవసరం లేదు.",
          },
          footer: {
            text: "NEW CITY STYLE • Payment Confirmation",
          },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: `PAYMENT_PAID::${safeReference}`.slice(0, 256),
                  title: "I HAVE PAID",
                },
              },
            ],
          },
        },
      }),
      cache: "no-store",
    },
  );

  const data = (await response.json()) as MetaResponse;

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
        data.error?.error_data?.details ||
        "I HAVE PAID button could not be sent.",
    );
  }

  return data.messages?.[0]?.id || null;
}


function createSupabaseAdmin() {

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



async function writeHistory(

  admin: ReturnType<typeof createSupabaseAdmin>,

  data: Record<string, unknown>,

) {

  if (!admin) return;



  try {

    await admin

      .from("ncs_whatsapp_outbound_messages")

      .insert(data);

  } catch (error) {

    console.warn(

      "NCS outbound history save failed:",

      error instanceof Error ? error.message : String(error),

    );

  }

}



export async function POST(request: NextRequest) {

  const admin = createSupabaseAdmin();



  try {

    const body = (await request.json()) as CustomerActionBody;



    const phone = normalizePhone(body.to);

    const customerName = cleanText(body.customerName, 120);

    const leadId = cleanText(body.leadId, 120) || null;

    const action = (body.action || "CUSTOM") as ActionType;



    if (!phone || phone.length < 10 || phone.length > 15) {

      return NextResponse.json(

        {

          success: false,

          error: "Valid WhatsApp phone number with country code is required.",

        },

        { status: 400 },

      );

    }



    if (!admin) {

      return NextResponse.json(

        {

          success: false,

          error:

            "Supabase server credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",

        },

        { status: 500 },

      );

    }



    const { data: lead, error: leadError } = await admin

      .from("ncs_whatsapp_leads")

      .select("id,phone,customer_name,last_seen_at")

      .eq("phone", phone)

      .maybeSingle();



    if (leadError) {

      throw leadError;

    }



    const lastSeenMs = lead?.last_seen_at

      ? new Date(lead.last_seen_at).getTime()

      : NaN;



    const windowActive =

      Number.isFinite(lastSeenMs) &&

      Date.now() - lastSeenMs >= 0 &&

      Date.now() - lastSeenMs <= SESSION_WINDOW_MS;



    const customMessage = cleanText(body.message, 2000);

    const amount =

      Number(body.amount || 0);



    const orderReference =

      cleanText(

        body.orderReference,

        120,

      );



    const paymentMethod =

      body.paymentMethod ||

      "RAZORPAY_LINK";



    const paymentLink =

      cleanText(

        body.paymentLink,

        1800,

      );



    const rawUpiUri =

      amount > 0

        ? buildRawUpiUri(

            amount,

            orderReference,

          )

        : "";



    const upiLink =

      cleanText(

        body.upiLink,

        1800,

      ) ||

      (

        amount > 0

          ? buildClickableUpiPage(

              amount,

              orderReference,

            )

          : ""

      );



    const siteUrl = String(

      process.env.NCS_SITE_URL ||

        "https://www\.newcitystyle.store",

    )

      .trim()

      .replace(/\/+$/, "");



    const qrImageUrl =

      cleanText(

        body.qrImageUrl,

        1800,

      ) ||

      String(

        process.env.NCS_UPI_QR_IMAGE_URL ||

          `${siteUrl}/payments/ncs-upi-qr.png`,

      ).trim();



    const paymentMessage =

      action === "PAYMENT_REQUEST"

        ? [

            `Hi ${customerName || "Customer"} 👋`,

            "",

            "💳 NEW CITY STYLE Payment Request",

            amount > 0

              ? `Amount: ${money(amount)}`

              : "",

            orderReference

              ? `Order / Bill: ${orderReference}`

              : "",

            paymentMethod === "RAZORPAY_LINK" && paymentLink

              ? `Pay securely: ${paymentLink}`

              : "",

            paymentMethod !== "RAZORPAY_LINK" && upiLink

              ? `Pay via UPI: ${upiLink}`

              : "",

            paymentMethod !== "RAZORPAY_LINK"

              ? `UPI ID: ${String(process.env.NCS_UPI_ID || "9010014001@pzw").trim()}`

              : "",

            "",

            "After payment, tap the I HAVE PAID button below. No UTR typing needed.",

          ]

            .filter(Boolean)

            .join("\n")

        : "";



    const message =

      action === "PAYMENT_REQUEST"

        ? paymentMessage

        : action === "CUSTOM"

          ? customMessage

          : customMessage || buildPresetMessage(action, customerName);



    if (!message) {

      return NextResponse.json(

        {

          success: false,

          error: "Message cannot be empty.",

        },

        { status: 400 },

      );

    }



    /*

     * Outside the current customer-service window, arbitrary free-form text

     * should not be sent. The UI clearly tells the owner to use an approved

     * WhatsApp template instead of silently attempting a non-compliant send.

     */

    if (!windowActive) {

      await writeHistory(admin, {

        lead_id: lead?.id || leadId,

        phone,

        customer_name: customerName || lead?.customer_name || null,

        action_type: action,

        message_text: message,

        delivery_mode: "TEMPLATE_REQUIRED",

        window_active: false,

        status: "BLOCKED_WINDOW",

        error_message:

          "Customer-service window is not active. Use an approved WhatsApp template.",

      });



      return NextResponse.json(

        {

          success: false,

          templateRequired: true,

          windowActive: false,

          error:

            "24-hour customer-service window is not active. Use an approved WhatsApp template for this customer.",

        },

        { status: 409 },

      );

    }



    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

    const apiVersion =

      process.env.WHATSAPP_API_VERSION?.trim() || "v25.0";



    if (!accessToken || !phoneNumberId) {

      return NextResponse.json(

        {

          success: false,

          error:

            "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing.",

        },

        { status: 500 },

      );

    }



    const metaResponse = await fetch(

      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,

      {

        method: "POST",

        headers: {

          Authorization: `Bearer ${accessToken}`,

          "Content-Type": "application/json",

        },

        body: JSON.stringify({

          messaging_product: "whatsapp",

          recipient_type: "individual",

          to: phone,

          type: "text",

          text: {

            preview_url: false,

            body: message,

          },

        }),

        cache: "no-store",

      },

    );



    const metaData = (await metaResponse.json()) as MetaResponse;



    if (!metaResponse.ok) {

      const errorText =

        metaData.error?.message ||

        metaData.error?.error_data?.details ||

        "WhatsApp message could not be sent.";



      await writeHistory(admin, {

        lead_id: lead?.id || leadId,

        phone,

        customer_name: customerName || lead?.customer_name || null,

        action_type: action,

        message_text: message,

        delivery_mode: "SESSION_TEXT",

        window_active: true,

        status: "FAILED",

        error_message: errorText,

      });



      return NextResponse.json(

        {

          success: false,

          windowActive: true,

          error: errorText,

          metaErrorCode: metaData.error?.code || null,

          metaErrorSubcode: metaData.error?.error_subcode || null,

          fbtraceId: metaData.error?.fbtrace_id || null,

        },

        { status: metaResponse.status },

      );

    }



    const messageId = metaData.messages?.[0]?.id || null;



    let qrMessageId: string | null = null;



    let qrWarning: string | null = null;

    let paidButtonMessageId: string | null = null;

    let paidButtonWarning: string | null = null;



    if (

      action === "PAYMENT_REQUEST" &&

      paymentMethod === "UPI_QR" &&

      qrImageUrl

    ) {

      try {

        qrMessageId =

          await sendMetaImage(

            accessToken,

            apiVersion,

            phoneNumberId,

            phone,

            qrImageUrl,

            amount > 0

              ? `NEW CITY STYLE • Pay ${money(amount)}${orderReference ? ` • ${orderReference}` : ""}`

              : "NEW CITY STYLE • UPI QR",

          );

      } catch (qrError) {

        qrWarning =

          qrError instanceof Error

            ? qrError.message

            : "QR image send failed.";



        console.warn(

          "NCS QR WhatsApp send warning:",

          qrWarning,

        );

      }

    }



    if (
      action === "PAYMENT_REQUEST"
    ) {
      try {
        paidButtonMessageId =
          await sendMetaPaidQuickReply(
            accessToken,
            apiVersion,
            phoneNumberId,
            phone,
            orderReference,
          );
      } catch (paidButtonError) {
        paidButtonWarning =
          paidButtonError instanceof Error
            ? paidButtonError.message
            : "I HAVE PAID button send failed.";

        console.warn(
          "NCS I HAVE PAID WhatsApp button warning:",
          paidButtonWarning,
        );
      }
    }


    if (

      action === "PAYMENT_REQUEST"

    ) {

      try {

        await admin

          .from(

            "ncs_whatsapp_payment_requests",

          )

          .insert({

            lead_id:

              lead?.id ||

              leadId,

            phone,

            customer_name:

              customerName ||

              lead?.customer_name ||

              null,

            amount:

              Number.isFinite(amount)

                ? amount

                : 0,

            order_reference:

              orderReference ||

              null,

            note:

              customMessage ||

              null,

            payment_method:

              paymentMethod,

            payment_link:

              paymentLink ||

              null,

            upi_link:

              upiLink ||

              null,

            qr_image_url:

              qrImageUrl ||

              null,

            status:

              "SENT",

            sent_at:

              new Date().toISOString(),

          });

      } catch (paymentHistoryError) {

        console.warn(

          "NCS payment request history save failed:",

          paymentHistoryError instanceof Error

            ? paymentHistoryError.message

            : String(paymentHistoryError),

        );

      }

    }



    await writeHistory(admin, {

      lead_id: lead?.id || leadId,

      phone,

      customer_name: customerName || lead?.customer_name || null,

      action_type: action,

      message_text: message,

      delivery_mode: "SESSION_TEXT",

      window_active: true,

      whatsapp_message_id: messageId,

      status: "SENT",

      sent_at: new Date().toISOString(),

    });



    return NextResponse.json(

      {

        success: true,

        windowActive: true,

        message: "WhatsApp message sent successfully.",

        whatsappMessageId: messageId,

        qrWhatsappMessageId: qrMessageId,

        qrWarning,

        paidButtonWhatsappMessageId: paidButtonMessageId,

        paidButtonWarning,

        rawUpiUri,

      },

      { status: 200 },

    );

  } catch (error) {

    console.error("NCS WhatsApp customer action error:", error);



    return NextResponse.json(

      {

        success: false,

        error:

          error instanceof Error

            ? error.message

            : "Unexpected server error.",

      },

      { status: 500 },

    );

  }

}



export async function GET() {

  return NextResponse.json({

    success: true,

    service: "NEW CITY STYLE WhatsApp Customer Action Center",

    actions: [

      "CUSTOM",

      "ORDER_CONFIRM",

      "ORDER_CANCEL",

      "ORDER_READY",

      "PAYMENT_REMINDER",

      "BOOKING_CONFIRM",

      "THANK_YOU",

      "PAYMENT_REQUEST",

    ],

  });

}
