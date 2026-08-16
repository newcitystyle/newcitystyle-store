import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OwnerOrderItem = {
  name?: string;
  quantity?: number | string;
  price?: number | string;
  size?: string | null;
  color?: string | null;
  barcode?: string | null;
};

type OwnerOrderAlertRequest = {
  orderId?: string | number;
  customerName?: string;
  customerPhone?: string;
  totalAmount?: number | string;
  paymentMethod?: string;
  paymentStatus?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  items?: OwnerOrderItem[];
};

type MetaSuccessResponse = {
  contacts?: Array<{ input?: string; wa_id?: string }>;
  messages?: Array<{ id?: string; message_status?: string }>;
};

type MetaErrorResponse = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_data?: { details?: string };
  };
};

function normalizePhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim();
  return cleaned || fallback;
}

function normalizeAmount(value: unknown): string {
  const parsed = Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

function buildItemSummary(items: OwnerOrderItem[]): string {
  if (!Array.isArray(items) || items.length === 0) return "Order items unavailable";
  const lines = items.slice(0, 8).map((item, index) => {
    const name = normalizeText(item.name, "Product");
    const qty = Math.max(1, Number(item.quantity || 1) || 1);
    const price = normalizeAmount(item.price);
    const variant = [item.size, item.color]
      .filter((value) => typeof value === "string" && value.trim())
      .join(" / ");
    const barcode = typeof item.barcode === "string" && item.barcode.trim()
      ? ` • ${item.barcode.trim()}`
      : "";
    return `${index + 1}. ${name}${variant ? ` (${variant})` : ""} × ${qty} @ ₹${price}${barcode}`;
  });
  if (items.length > 8) lines.push(`+ ${items.length - 8} more item(s)`);
  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v25.0";
    const ownerPhone = normalizePhoneNumber(process.env.WHATSAPP_OWNER_PHONE?.trim() || "");
    const templateName = process.env.WHATSAPP_OWNER_ORDER_TEMPLATE_NAME?.trim() || "";
    const templateLanguage = process.env.WHATSAPP_OWNER_ORDER_TEMPLATE_LANGUAGE?.trim() || "en";

    if (!accessToken) return NextResponse.json({ success:false, error:"WHATSAPP_ACCESS_TOKEN is missing." }, { status:500 });
    if (!phoneNumberId) return NextResponse.json({ success:false, error:"WHATSAPP_PHONE_NUMBER_ID is missing." }, { status:500 });
    if (ownerPhone.length < 10 || ownerPhone.length > 15) {
      return NextResponse.json({ success:false, error:"WHATSAPP_OWNER_PHONE is missing or invalid." }, { status:500 });
    }
    if (!templateName) {
      return NextResponse.json({ success:false, error:"WHATSAPP_OWNER_ORDER_TEMPLATE_NAME is not configured." }, { status:503 });
    }

    const body = (await request.json()) as OwnerOrderAlertRequest;
    const orderId = normalizeText(String(body.orderId ?? ""), "NCS Order");
    const customerName = normalizeText(body.customerName, "Customer");
    const customerPhone = normalizePhoneNumber(normalizeText(body.customerPhone, ""));
    const totalAmount = normalizeAmount(body.totalAmount);
    const paymentMethod = normalizeText(body.paymentMethod, "Cash on Delivery");
    const paymentStatus = normalizeText(body.paymentStatus, "Pending");
    const deliveryAddress = [body.address, body.city, body.state, body.pincode]
      .map((v) => normalizeText(v, ""))
      .filter(Boolean)
      .join(", ");
    const itemSummary = buildItemSummary(body.items || []);

    const orderDetails = [
      `Order ${orderId}`,
      itemSummary,
      `Total ₹${totalAmount}`,
    ].join("\n");

    const customerDetails = [
      customerName,
      customerPhone || "Not provided",
    ].join(" | ");

    const deliveryAndPayment = [
      `${paymentMethod} - ${paymentStatus}`,
      deliveryAddress || "Address unavailable",
    ].join(" | ");

    const parameters = [
      { type: "text", text: orderDetails },
      { type: "text", text: customerDetails },
      { type: "text", text: deliveryAndPayment },
    ];

    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method:"POST",
      headers:{ Authorization:`Bearer ${accessToken}`, "Content-Type":"application/json" },
      body:JSON.stringify({
        messaging_product:"whatsapp",
        recipient_type:"individual",
        to:ownerPhone,
        type:"template",
        template:{
          name:templateName,
          language:{ code:templateLanguage },
          components:[{ type:"body", parameters }],
        },
      }),
      cache:"no-store",
    });

    const data = (await response.json()) as MetaSuccessResponse | MetaErrorResponse;
    if (!response.ok || !("messages" in data) || !Array.isArray(data.messages) || data.messages.length === 0) {
      const e = (data as MetaErrorResponse).error;
      console.error("Owner order WhatsApp Meta error:", data);
      return NextResponse.json({
        success:false,
        error:e?.error_data?.details || e?.message || "Meta WhatsApp rejected the owner order alert.",
        metaErrorCode:e?.code ?? null,
        metaErrorSubcode:e?.error_subcode ?? null,
        fbtraceId:e?.fbtrace_id ?? null,
      }, { status:response.status || 500 });
    }

    return NextResponse.json({
      success:true,
      directWhatsAppSent:true,
      message:"Owner new-order alert accepted by WhatsApp.",
      orderId,
      ownerPhone:maskPhone(ownerPhone),
      whatsappMessageId:data.messages?.[0]?.id || null,
      messageStatus:data.messages?.[0]?.message_status || "accepted",
      recipientWhatsAppId:data.contacts?.[0]?.wa_id || null,
      templateName,
      templateLanguage,
    });
  } catch (error) {
    return NextResponse.json({ success:false, error:error instanceof Error ? error.message : "Unexpected owner order WhatsApp error." }, { status:500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success:true,
    route:"/api/whatsapp/owner-order-alert",
    ownerPhoneConfigured:Boolean(process.env.WHATSAPP_OWNER_PHONE),
    ownerOrderTemplateConfigured:Boolean(process.env.WHATSAPP_OWNER_ORDER_TEMPLATE_NAME),
  });
}