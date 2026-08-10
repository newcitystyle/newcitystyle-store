import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InvoiceItem = {
  name?: string;
  quantity?: number | string;
  mrp?: number | string;
  price?: number | string;
  total?: number | string;
  size?: string;
  color?: string;
};

type InvoiceRequest = {
  to?: string;
  sendWhatsApp?: boolean;
  customerName?: string;
  customerPhone?: string;
  billNumber?: string;
  billDate?: string;
  paymentMethod?: string;
  subtotal?: number | string;
  discountAmount?: number | string;
  taxAmount?: number | string;
  roundOff?: number | string;
  billAmount?: number | string;
  paidAmount?: number | string;
  dueAmount?: number | string;
  whatsappLanguage?: "en" | "te" | "english" | "telugu" | string;
  items?: InvoiceItem[];
  invoiceStudio?: Record<string, unknown> | null;
  duplicateCopy?: boolean;
};

type MetaErrorResponse = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
    fbtrace_id?: string;
    error_user_title?: string;
    error_user_msg?: string;
    error_data?: {
      messaging_product?: string;
      details?: string;
    };
  };
};

type MetaMediaUploadResponse = {
  id?: string;
};

type MetaMessageResponse = {
  messages?: Array<{
    id?: string;
    message_status?: string;
  }>;
  contacts?: Array<{
    input?: string;
    wa_id?: string;
  }>;
};

const BLUE = rgb(10 / 255, 46 / 255, 115 / 255);
const GOLD = rgb(212 / 255, 175 / 255, 55 / 255);
const IVORY = rgb(248 / 255, 244 / 255, 236 / 255);
const CHARCOAL = rgb(44 / 255, 44 / 255, 44 / 255);
const GRAY = rgb(0.45, 0.45, 0.45);

function text(value: unknown, fallback: string): string {
  const cleaned = String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || fallback;
}

function amount(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(
    String(value ?? "")
      .replace(/₹/g, "")
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, "")
      .trim(),
  );

  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: unknown): string {
  return `Rs. ${amount(value).toFixed(2)}`;
}

function templateAmount(value: unknown): string {
  return amount(value).toFixed(2);
}

function safeFileName(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "NCS-INVOICE"
  );
}

function normalizePhone(value: unknown): string {
  let digits = String(value ?? "").replace(/\D/g, "");

  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }

  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  return digits;
}

function resolveInvoiceTemplate(languageValue: unknown) {
  const normalized = String(languageValue ?? "")
    .trim()
    .toLowerCase();

  if (
    normalized === "en" ||
    normalized === "english" ||
    normalized === "en_us" ||
    normalized === "en-us"
  ) {
    return {
      templateName:
        process.env.WHATSAPP_INVOICE_TEMPLATE_ENGLISH?.trim() ||
        "new_city_style_invoice_document_v2",
      templateLanguage:
        process.env.WHATSAPP_INVOICE_TEMPLATE_ENGLISH_LANGUAGE?.trim() ||
        "en_US",
      selectedLanguage: "english" as const,
    };
  }

  return {
    templateName:
      process.env.WHATSAPP_INVOICE_TEMPLATE_TELUGU?.trim() ||
      "new_city_style_bill_telugu",
    templateLanguage:
      process.env.WHATSAPP_INVOICE_TEMPLATE_TELUGU_LANGUAGE?.trim() ||
      "te",
    selectedLanguage: "telugu" as const,
  };
}

function studioText(
  studio: Record<string, unknown> | null | undefined,
  key: string,
): string {
  return String(studio?.[key] ?? "").trim();
}

function studioBool(
  studio: Record<string, unknown> | null | undefined,
  key: string,
  fallback = false,
): boolean {
  const value = studio?.[key];
  return typeof value === "boolean" ? value : fallback;
}

async function loadUpiQrPng(
  upiId: string,
  payeeName: string,
): Promise<Uint8Array | null> {
  const cleanUpi = upiId.trim();
  if (!cleanUpi) return null;

  try {
    const params = new URLSearchParams({
      pa: cleanUpi,
      pn: payeeName || "NEW CITY STYLE",
      cu: "INR",
    });
    const upiUrl = `upi://pay?${params.toString()}`;
    const qrUrl =
      `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=12&data=${encodeURIComponent(
        upiUrl,
      )}`;

    const response = await fetch(qrUrl, {
      cache: "no-store",
    });

    if (!response.ok) return null;

    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}


function buildMetaError(metaData: MetaErrorResponse) {
  const metaError = metaData?.error;

  return {
    error:
      metaError?.message ||
      "WhatsApp Cloud API request failed.",
    metaErrorCode: metaError?.code ?? null,
    metaErrorSubcode: metaError?.error_subcode ?? null,
    metaErrorType: metaError?.type ?? null,
    fbtraceId: metaError?.fbtrace_id ?? null,
    errorUserTitle: metaError?.error_user_title ?? null,
    errorUserMessage: metaError?.error_user_msg ?? null,
    errorDetails: metaError?.error_data?.details ?? null,
    messagingProduct:
      metaError?.error_data?.messaging_product ?? null,
    fullMetaError: metaData,
  };
}

async function createInvoicePdf(body: InvoiceRequest) {
  const customerName = text(body.customerName, "Customer");
  const customerPhone = text(body.customerPhone, "-");
  const billNumber = text(body.billNumber, "NCS-INVOICE");
  const billDate = text(
    body.billDate,
    new Date().toLocaleString("en-IN"),
  );
  const paymentMethod = text(body.paymentMethod, "Cash");
  const duplicateCopy = body.duplicateCopy === true;

  const billAmount = amount(body.billAmount);
  const paidAmount = amount(body.paidAmount);
  const dueAmount = amount(
    body.dueAmount,
    Math.max(0, billAmount - paidAmount),
  );
  const subtotal = amount(body.subtotal, billAmount);
  const discountAmount = amount(body.discountAmount);
  const taxAmount = amount(body.taxAmount);
  const roundOff = amount(body.roundOff);

  const items =
    Array.isArray(body.items) && body.items.length > 0
      ? body.items
      : [
          {
            name: "Retail Purchase",
            quantity: 1,
            mrp: billAmount,
            price: billAmount,
            total: billAmount,
          },
        ];

  const studio = body.invoiceStudio || null;
  const studioMode = (
    studioText(studio, "active_tab") || "a4"
  ).toLowerCase();
  const studioTheme = (
    studioText(studio, "theme") || "signature"
  ).toLowerCase();
  const isMinimalTheme = studioTheme === "minimal";
  const isCounterTheme = studioTheme === "counter";
  const isSignatureTheme =
    !isMinimalTheme && !isCounterTheme;

  const upiId = studioText(studio, "upi_id");
  const showUpiQr =
    Boolean(upiId) &&
    studioBool(studio, "show_upi_qr", true);
  const showBank = studioBool(studio, "show_bank", false);
  const showTerms = studioBool(studio, "show_terms", true);
  const bankName = studioText(studio, "bank_name");
  const accountNumber = studioText(studio, "account_number");
  const ifscCode = studioText(studio, "ifsc_code");
  const footerMessage =
    studioText(studio, "footer_message") ||
    "Thank you for shopping with NEW CITY STYLE.";
  const termsText =
    studioText(studio, "terms_text") ||
    "Please retain this invoice for return or exchange reference.";

  const pdf = await PDFDocument.create();
  const upiQrBytes =
    showUpiQr && upiId
      ? await loadUpiQrPng(upiId, "NEW CITY STYLE")
      : null;
  const upiQrImage = upiQrBytes
    ? await pdf.embedPng(upiQrBytes)
    : null;
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(
    StandardFonts.HelveticaBold,
  );

  // True thermal mode: use real 58/80mm paper width and dynamic receipt height.
  // This prevents browser printing from creating a long A4/1-metre-looking receipt.
  if (studioMode === "thermal") {
    const rawThermalWidth = Number(
      (studio as Record<string, unknown> | null)?.thermal_width ?? 80,
    );
    const thermalMm = rawThermalWidth === 58 ? 58 : 80;
    const pageWidth =
      thermalMm === 58 ? 164.41 : 226.77; // millimetres converted to PDF points
    const margin = thermalMm === 58 ? 10 : 14;
    const contentWidth = pageWidth - margin * 2;

    const showPhone = studioBool(studio, "show_phone", true);
    const showAddress = studioBool(studio, "show_address", true);
    const showEmail = studioBool(studio, "show_email", true);
    const boldText = studioBool(studio, "bold_text", true);

    const itemRowHeight = thermalMm === 58 ? 22 : 24;
    const identityHeight =
      74 +
      (showAddress ? 22 : 0) +
      (showPhone ? 12 : 0) +
      (showEmail ? 12 : 0);
    const metaHeight = 78;
    const totalsHeight = 104;
    const payHeight = showUpiQr || showBank ? 100 : 0;
    const termsHeight = showTerms && termsText ? 34 : 0;
    const footerBlockHeight = 46;

    const pageHeight = Math.max(
      thermalMm === 58 ? 340 : 390,
      identityHeight +
        metaHeight +
        items.length * itemRowHeight +
        totalsHeight +
        payHeight +
        termsHeight +
        footerBlockHeight +
        38,
    );

    const page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - 18;

    const centerText = (
      value: string,
      size: number,
      font = regular,
      color = CHARCOAL,
    ) => {
      const safe = text(value, "");
      page.drawText(safe, {
        x: Math.max(
          margin,
          pageWidth / 2 -
            font.widthOfTextAtSize(safe, size) / 2,
        ),
        y,
        size,
        font,
        color,
        maxWidth: contentWidth,
      });
    };

    // Premium compact top line.
    page.drawRectangle({
      x: 0,
      y: pageHeight - 5,
      width: pageWidth,
      height: 5,
      color: isCounterTheme
        ? GOLD
        : isMinimalTheme
          ? rgb(0.82, 0.84, 0.88)
          : BLUE,
    });

    y -= 13;

    // Compact premium brand lockup for thermal paper.
    centerText(
      "NEW CITY STYLE",
      thermalMm === 58 ? 12.5 : 15,
      bold,
      BLUE,
    );
    y -= thermalMm === 58 ? 14 : 17;

    centerText(
      "STYLE FOR EVERY FAMILY",
      thermalMm === 58 ? 5.4 : 6.2,
      bold,
      GOLD,
    );
    y -= 11;

    page.drawLine({
      start: { x: margin + 12, y },
      end: { x: pageWidth - margin - 12, y },
      thickness: 0.8,
      color: GOLD,
    });
    y -= 10;

    if (showAddress) {
      centerText(
        "Main Road, Opp. Govt. MPDO Office",
        thermalMm === 58 ? 5.1 : 5.8,
        regular,
        GRAY,
      );
      y -= 9;
      centerText(
        "Sarubujjili, Srikakulam - 532458",
        thermalMm === 58 ? 5.1 : 5.8,
        regular,
        GRAY,
      );
      y -= 9;
    }

    if (showPhone) {
      centerText(
        "Ph / WhatsApp: +91 90100 14001",
        thermalMm === 58 ? 5.1 : 5.8,
        regular,
        GRAY,
      );
      y -= 9;
    }

    if (showEmail) {
      centerText(
        "www.newcitystyle.store",
        thermalMm === 58 ? 4.9 : 5.5,
        regular,
        GRAY,
      );
      y -= 9;
    }

    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.55,
      color: rgb(0.76, 0.78, 0.81),
      dashArray: [2, 2],
    });
    y -= 12;

    if (duplicateCopy) {
      centerText(
        "DUPLICATE COPY",
        thermalMm === 58 ? 7 : 8,
        bold,
        BLUE,
      );
      y -= 13;
    }

    const metaSize = thermalMm === 58 ? 5.8 : 6.5;
    const metaBold = thermalMm === 58 ? 6.1 : 6.8;

    const drawMetaRow = (labelText: string, valueText: string) => {
      page.drawText(labelText, {
        x: margin,
        y,
        size: metaSize,
        font: regular,
        color: GRAY,
      });

      const value = text(valueText, "-");
      page.drawText(value, {
        x: margin + (thermalMm === 58 ? 38 : 50),
        y,
        size: metaBold,
        font: bold,
        color: CHARCOAL,
        maxWidth:
          contentWidth - (thermalMm === 58 ? 38 : 50),
      });
      y -= 12;
    };

    drawMetaRow("Invoice", billNumber);
    drawMetaRow("Customer", customerName);
    if (customerPhone && customerPhone !== "-") {
      drawMetaRow("Mobile", customerPhone);
    }
    drawMetaRow("Payment", paymentMethod);
    drawMetaRow(
      "Date",
      new Date(billDate).toString() === "Invalid Date"
        ? billDate
        : new Date(billDate).toLocaleString("en-IN"),
    );

    y -= 4;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.7,
      color: rgb(0.72, 0.74, 0.78),
    });
    y -= 12;

    const itemFont = thermalMm === 58 ? 6.1 : 7;
    const smallFont = thermalMm === 58 ? 5.2 : 5.8;

    page.drawRectangle({
      x: margin,
      y: y - 5,
      width: contentWidth,
      height: 15,
      color: rgb(0.965, 0.97, 0.985),
    });

    page.drawText("ITEM", {
      x: margin + 4,
      y,
      size: smallFont,
      font: bold,
      color: BLUE,
    });
    page.drawText("QTY", {
      x: pageWidth - margin - (thermalMm === 58 ? 48 : 64),
      y,
      size: smallFont,
      font: bold,
      color: BLUE,
    });
    page.drawText("AMOUNT", {
      x: pageWidth - margin - (thermalMm === 58 ? 30 : 38),
      y,
      size: smallFont,
      font: bold,
      color: BLUE,
    });
    y -= 13;

    for (const item of items) {
      const qty = Math.max(1, amount(item.quantity, 1));
      const price = amount(item.price);
      const total = amount(item.total, qty * price);
      const variant = [item.size, item.color]
        .map((v) => text(v, ""))
        .filter(Boolean)
        .join(" / ");
      const itemName = `${text(item.name, "Product")}${
        variant ? ` (${variant})` : ""
      }`;

      page.drawText(itemName, {
        x: margin,
        y,
        size: itemFont,
        font: boldText ? bold : regular,
        color: CHARCOAL,
        maxWidth:
          contentWidth - (thermalMm === 58 ? 66 : 88),
      });

      const qtyText = qty.toFixed(qty % 1 === 0 ? 0 : 2);
      page.drawText(qtyText, {
        x: pageWidth - margin - (thermalMm === 58 ? 48 : 64),
        y,
        size: itemFont,
        font: regular,
        color: CHARCOAL,
      });

      const totalText = money(total);
      page.drawText(totalText, {
        x:
          pageWidth -
          margin -
          bold.widthOfTextAtSize(totalText, itemFont),
        y,
        size: itemFont,
        font: bold,
        color: CHARCOAL,
      });

      y -= itemRowHeight;

      page.drawLine({
        start: { x: margin, y: y + 8 },
        end: { x: pageWidth - margin, y: y + 8 },
        thickness: 0.35,
        color: rgb(0.86, 0.87, 0.89),
        dashArray: [1.5, 2],
      });
    }

    y -= 2;

    const drawMoneyRow = (
      labelText: string,
      value: number,
      emphasize = false,
    ) => {
      const size = emphasize
        ? thermalMm === 58
          ? 8
          : 9
        : thermalMm === 58
          ? 6.2
          : 7;

      page.drawText(labelText, {
        x: margin,
        y,
        size,
        font: emphasize ? bold : regular,
        color: emphasize ? BLUE : CHARCOAL,
      });

      const valueText = money(value);
      page.drawText(valueText, {
        x:
          pageWidth -
          margin -
          (emphasize ? bold : regular).widthOfTextAtSize(
            valueText,
            size,
          ),
        y,
        size,
        font: emphasize ? bold : regular,
        color: emphasize ? BLUE : CHARCOAL,
      });

      y -= emphasize ? 18 : 13;
    };

    drawMoneyRow("Subtotal", subtotal);
    if (discountAmount > 0) {
      drawMoneyRow("Discount", -discountAmount);
    }
    if (taxAmount > 0) {
      drawMoneyRow("GST Included", taxAmount);
    }
    if (roundOff !== 0) {
      drawMoneyRow("Round Off", roundOff);
    }

    page.drawRectangle({
      x: margin,
      y: y - 5,
      width: contentWidth,
      height: thermalMm === 58 ? 24 : 28,
      color: BLUE,
    });

    page.drawText("TOTAL", {
      x: margin + 7,
      y: y + (thermalMm === 58 ? 3 : 5),
      size: thermalMm === 58 ? 7.7 : 8.8,
      font: bold,
      color: GOLD,
    });

    const totalReceiptText = money(billAmount);
    page.drawText(totalReceiptText, {
      x:
        pageWidth -
        margin -
        7 -
        bold.widthOfTextAtSize(
          totalReceiptText,
          thermalMm === 58 ? 7.7 : 8.8,
        ),
      y: y + (thermalMm === 58 ? 3 : 5),
      size: thermalMm === 58 ? 7.7 : 8.8,
      font: bold,
      color: rgb(1, 1, 1),
    });

    y -= thermalMm === 58 ? 32 : 36;

    page.drawText(`Paid: ${money(paidAmount)}`, {
      x: margin,
      y,
      size: smallFont,
      font: regular,
      color: GRAY,
    });
    y -= 11;

    if (dueAmount > 0) {
      page.drawText(`Due: ${money(dueAmount)}`, {
        x: margin,
        y,
        size: smallFont,
        font: bold,
        color: rgb(0.72, 0.12, 0.12),
      });
      y -= 12;
    }

    if (showUpiQr || showBank) {
      y -= 4;
      page.drawLine({
        start: { x: margin, y },
        end: { x: pageWidth - margin, y },
        thickness: 0.6,
        color: rgb(0.80, 0.81, 0.84),
      });
      y -= 13;

      if (upiQrImage) {
        const qrSize = thermalMm === 58 ? 62 : 76;
        page.drawImage(upiQrImage, {
          x: pageWidth / 2 - qrSize / 2,
          y: y - qrSize,
          width: qrSize,
          height: qrSize,
        });
        y -= qrSize + 9;
        centerText(
          "SCAN & PAY",
          thermalMm === 58 ? 6 : 7,
          bold,
          BLUE,
        );
        y -= 10;
        centerText(
          upiId,
          thermalMm === 58 ? 5 : 5.6,
          regular,
          GRAY,
        );
        y -= 11;
      }

      if (showBank) {
        const bankLines = [
          bankName,
          accountNumber ? `A/C ${accountNumber}` : "",
          ifscCode ? `IFSC ${ifscCode}` : "",
        ].filter(Boolean);

        for (const line of bankLines) {
          centerText(
            line,
            thermalMm === 58 ? 5 : 5.6,
            regular,
            GRAY,
          );
          y -= 10;
        }
      }
    }

    if (showTerms && termsText) {
      y -= 4;
      page.drawLine({
        start: { x: margin, y },
        end: { x: pageWidth - margin, y },
        thickness: 0.5,
        color: rgb(0.84, 0.85, 0.87),
        dashArray: [2, 2],
      });
      y -= 12;
      centerText(
        termsText,
        thermalMm === 58 ? 4.8 : 5.5,
        regular,
        GRAY,
      );
      y -= 18;
    }

    centerText(
      dueAmount > 0 ? "PAYMENT PARTIAL" : "PAYMENT RECEIVED",
      thermalMm === 58 ? 5.2 : 5.8,
      bold,
      dueAmount > 0 ? rgb(0.72, 0.12, 0.12) : BLUE,
    );
    y -= 11;

    centerText(
      footerMessage,
      thermalMm === 58 ? 5.7 : 6.4,
      bold,
      BLUE,
    );
    y -= 11;

    centerText(
      "Powered by NCS Billing",
      thermalMm === 58 ? 4.4 : 4.9,
      regular,
      GOLD,
    );

    const thermalPdfBytes = await pdf.save();
    const thermalFileName = `${safeFileName(billNumber)}.pdf`;

    return {
      pdfBytes: new Uint8Array(thermalPdfBytes),
      fileName: thermalFileName,
      customerName,
      customerPhone,
      billNumber,
      billAmount,
      paidAmount,
      dueAmount,
      paymentMethod,
    };
  }

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 38;
  const footerHeight = 42;
  const headerHeight = 150;
  const tableTop = pageHeight - 292;
  const rowHeight = isCounterTheme ? 24 : 28;

  const themeTopColor = isMinimalTheme
    ? rgb(0.85, 0.86, 0.90)
    : isCounterTheme
      ? GOLD
      : BLUE;
  const themeTopHeight = isSignatureTheme
    ? 8
    : isCounterTheme
      ? 5
      : 3;

  const tableFill = rgb(1, 1, 1);
  const tableText = GRAY;
  const softRowFill = rgb(1, 1, 1);
  const summaryFill = rgb(1, 1, 1);

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = tableTop;

  const drawHeader = () => {
    // Premium editorial masthead: restrained, international and print-friendly.
    page.drawRectangle({
      x: 0,
      y: pageHeight - themeTopHeight,
      width: pageWidth,
      height: themeTopHeight,
      color: themeTopColor,
    });

    // Left identity block.
    const markSize = 48;
    const markX = margin;
    const markY = pageHeight - 78;

    page.drawRectangle({
      x: markX,
      y: markY,
      width: markSize,
      height: markSize,
      color: BLUE,
    });

    page.drawRectangle({
      x: markX + 4,
      y: markY + 4,
      width: markSize - 8,
      height: markSize - 8,
      borderColor: GOLD,
      borderWidth: 1,
    });

    page.drawText("NCS", {
      x: markX + 8,
      y: markY + 17,
      size: 15,
      font: bold,
      color: GOLD,
    });

    const brandX = markX + markSize + 16;

    page.drawText("NEW CITY STYLE", {
      x: brandX,
      y: pageHeight - 46,
      size: 22,
      font: bold,
      color: BLUE,
    });

    page.drawText("STYLE FOR EVERY FAMILY", {
      x: brandX,
      y: pageHeight - 61,
      size: 7,
      font: bold,
      color: GOLD,
    });

    page.drawText(
      "Main Road, Opp. Govt. MPDO Office • Sarubujjili • Srikakulam",
      {
        x: brandX,
        y: pageHeight - 77,
        size: 7,
        font: regular,
        color: GRAY,
      },
    );

    page.drawText(
      "Andhra Pradesh 532458 • +91 90100 14001 • newcitystyle.store",
      {
        x: brandX,
        y: pageHeight - 89,
        size: 7,
        font: regular,
        color: GRAY,
      },
    );

    // Right invoice identity.
    const rightX = pageWidth - margin - 150;

    page.drawText(
      studioMode === "whatsapp"
        ? "WHATSAPP INVOICE"
        : duplicateCopy
          ? "DUPLICATE INVOICE"
          : "RETAIL INVOICE",
      {
        x: rightX,
        y: pageHeight - 44,
        size: 12,
        font: bold,
        color: BLUE,
      },
    );

    page.drawText(
      isCounterTheme
        ? "Counter Compact"
        : isMinimalTheme
          ? "Clean Minimal"
          : "NCS Signature",
      {
        x: rightX,
        y: pageHeight - 59,
        size: 7,
        font: bold,
        color: GOLD,
      },
    );

    if (duplicateCopy) {
      page.drawRectangle({
        x: rightX,
        y: pageHeight - 86,
        width: 106,
        height: 18,
        color: rgb(1, 0.97, 0.84),
        borderColor: GOLD,
        borderWidth: 0.8,
      });

      page.drawText("DUPLICATE COPY", {
        x: rightX + 11,
        y: pageHeight - 81,
        size: 8,
        font: bold,
        color: BLUE,
      });
    }

    // Editorial divider.
    page.drawLine({
      start: { x: margin, y: pageHeight - 112 },
      end: { x: pageWidth - margin, y: pageHeight - 112 },
      thickness: 1,
      color: rgb(0.86, 0.88, 0.92),
    });

    page.drawLine({
      start: { x: margin, y: pageHeight - 115 },
      end: { x: margin + 122, y: pageHeight - 115 },
      thickness: 2,
      color: GOLD,
    });
  };

  const drawFooter = () => {
    page.drawLine({
      start: { x: margin, y: 42 },
      end: { x: pageWidth - margin, y: 42 },
      thickness: 0.7,
      color: rgb(0.87, 0.89, 0.92),
      dashArray: [2, 2],
    });

    const footerLabel =
      footerMessage ||
      "Thank you for shopping with NEW CITY STYLE.";

    page.drawText(footerLabel, {
      x:
        pageWidth / 2 -
        bold.widthOfTextAtSize(footerLabel, 8) / 2,
      y: 25,
      size: 8,
      font: bold,
      color: BLUE,
      maxWidth: pageWidth - margin * 2,
    });

    page.drawText("Powered by NCS Billing", {
      x:
        pageWidth / 2 -
        regular.widthOfTextAtSize(
          "Powered by NCS Billing",
          6.5,
        ) /
          2,
      y: 13,
      size: 6.5,
      font: regular,
      color: GOLD,
    });
  };

  const drawInvoiceInfo = () => {
    const topY = pageHeight - headerHeight - 16;
    const gap = 12;
    const totalWidth = pageWidth - margin * 2;
    const leftWidth = totalWidth * 0.56;
    const rightWidth = totalWidth - leftWidth - gap;
    const cardHeight = 70;

    // Customer card.
    page.drawRectangle({
      x: margin,
      y: topY - cardHeight,
      width: leftWidth,
      height: cardHeight,
      color: rgb(0.975, 0.98, 0.99),
      borderColor: rgb(0.90, 0.91, 0.94),
      borderWidth: 0.7,
    });

    page.drawText("BILLED TO", {
      x: margin + 12,
      y: topY - 17,
      size: 6.5,
      font: bold,
      color: GOLD,
    });

    page.drawText(customerName, {
      x: margin + 12,
      y: topY - 34,
      size: 10,
      font: bold,
      color: BLUE,
      maxWidth: leftWidth - 24,
    });

    if (customerPhone && customerPhone !== "-") {
      page.drawText(customerPhone, {
        x: margin + 12,
        y: topY - 50,
        size: 7.5,
        font: regular,
        color: GRAY,
      });
    }

    // Bill meta card.
    const metaX = margin + leftWidth + gap;

    page.drawRectangle({
      x: metaX,
      y: topY - cardHeight,
      width: rightWidth,
      height: cardHeight,
      color: BLUE,
    });

    const formattedDate =
      new Date(billDate).toString() === "Invalid Date"
        ? billDate
        : new Date(billDate).toLocaleString("en-IN");

    const metaRows = [
      ["INVOICE", billNumber],
      ["DATE", formattedDate],
      ["PAYMENT", paymentMethod],
    ];

    let rowY = topY - 17;

    metaRows.forEach(([labelText, valueText]) => {
      page.drawText(labelText, {
        x: metaX + 12,
        y: rowY,
        size: 5.8,
        font: bold,
        color: GOLD,
      });

      page.drawText(valueText, {
        x: metaX + 62,
        y: rowY,
        size: 6.7,
        font: bold,
        color: rgb(1, 1, 1),
        maxWidth: rightWidth - 74,
      });

      rowY -= 17;
    });
  };

  const columns = [
    { label: "ITEM", x: margin, width: 330 },
    { label: "QTY", x: margin + 336, width: 54 },
    { label: "AMOUNT", x: margin + 396, width: 123 },
  ];

  const drawTableHeader = () => {
    page.drawRectangle({
      x: margin,
      y: y - 14,
      width: pageWidth - margin * 2,
      height: 22,
      color: rgb(0.965, 0.97, 0.985),
    });

    page.drawLine({
      start: { x: margin, y: y + 8 },
      end: { x: pageWidth - margin, y: y + 8 },
      thickness: 0.8,
      color: GOLD,
    });

    columns.forEach((column, index) => {
      const labelWidth = bold.widthOfTextAtSize(
        column.label,
        6.4,
      );

      const x =
        index === 0
          ? column.x + 7
          : column.x + column.width - labelWidth - 7;

      page.drawText(column.label, {
        x,
        y: y - 5,
        size: 6.4,
        font: bold,
        color: BLUE,
      });
    });

    y -= 24;
  };

  const newPage = () => {
    drawFooter();
    page = pdf.addPage([pageWidth, pageHeight]);
    drawHeader();
    y = pageHeight - headerHeight - 50;
    drawTableHeader();
  };

  drawHeader();
  drawInvoiceInfo();
  drawTableHeader();

  for (let index = 0; index < items.length; index += 1) {
    if (y - rowHeight < 220) {
      newPage();
    }

    const item = items[index];
    const qty = Math.max(1, amount(item.quantity, 1));
    const price = amount(item.price);
    const total = amount(item.total, qty * price);

    const variant = [item.size, item.color]
      .map((value) => text(value, ""))
      .filter(Boolean)
      .join(" / ");

    const itemName = `${text(item.name, "Product")}${
      variant ? ` (${variant})` : ""
    }`;

    page.drawText(itemName, {
      x: columns[0].x,
      y: y - 8,
      size: 8,
      font: regular,
      color: CHARCOAL,
      maxWidth: columns[0].width - 8,
    });

    const qtyText = qty.toFixed(
      qty % 1 === 0 ? 0 : 2,
    );
    const amountText = money(total);

    page.drawText(qtyText, {
      x:
        columns[1].x +
        columns[1].width -
        regular.widthOfTextAtSize(qtyText, 8),
      y: y - 8,
      size: 8,
      font: regular,
      color: CHARCOAL,
    });

    page.drawText(amountText, {
      x:
        columns[2].x +
        columns[2].width -
        bold.widthOfTextAtSize(amountText, 8),
      y: y - 8,
      size: 8,
      font: bold,
      color: CHARCOAL,
    });

    page.drawLine({
      start: { x: margin, y: y - rowHeight + 6 },
      end: { x: pageWidth - margin, y: y - rowHeight + 6 },
      thickness: 0.35,
      color: rgb(0.89, 0.90, 0.92),
      dashArray: [2, 2],
    });

    y -= rowHeight;
  }

  if (y < 220) {
    newPage();
  }

  y -= 18;

  const summaryX = pageWidth - margin - 225;
  const summaryWidth = 225;

  const summaryRows: Array<
    [string, string, boolean]
  > = [
    ["Subtotal", money(subtotal), false],
    ["Discount", money(discountAmount), false],
  ];

  let summaryY = y;

  summaryRows.forEach(([label, value]) => {
    page.drawText(label, {
      x: summaryX,
      y: summaryY,
      size: 8,
      font: regular,
      color: CHARCOAL,
    });

    page.drawText(value, {
      x:
        summaryX +
        summaryWidth -
        regular.widthOfTextAtSize(value, 8),
      y: summaryY,
      size: 8,
      font: regular,
      color: CHARCOAL,
    });

    summaryY -= 17;
  });

  page.drawRectangle({
    x: summaryX,
    y: summaryY - 8,
    width: summaryWidth,
    height: 32,
    color: BLUE,
  });

  page.drawRectangle({
    x: summaryX,
    y: summaryY + 21,
    width: summaryWidth,
    height: 3,
    color: GOLD,
  });

  page.drawText("TOTAL PAID", {
    x: summaryX + 12,
    y: summaryY + 4,
    size: 8.5,
    font: bold,
    color: GOLD,
  });

  const grandText = money(billAmount);
  page.drawText(grandText, {
    x:
      summaryX +
      summaryWidth -
      12 -
      bold.widthOfTextAtSize(grandText, 9),
    y: summaryY + 4,
    size: 9,
    font: bold,
    color: rgb(1, 1, 1),
  });

  page.drawText(
    "GST, where applicable, is included in the selling price.",
    {
      x: summaryX,
      y: summaryY - 18,
      size: 6.5,
      font: regular,
      color: GRAY,
      maxWidth: summaryWidth,
    },
  );

  const footerTextY = Math.max(115, summaryY - 70);

  if (showTerms && termsText) {
    page.drawRectangle({
      x: margin,
      y: footerTextY - 6,
      width: pageWidth - margin * 2,
      height: 24,
      color: rgb(0.97, 0.975, 0.985),
    });

    page.drawText(termsText, {
      x: margin + 10,
      y: footerTextY + 2,
      size: 6.5,
      font: regular,
      color: GRAY,
      maxWidth: pageWidth - margin * 2 - 20,
    });
  }

  if (showUpiQr || showBank) {
    const payY = Math.max(
      150,
      footerTextY + (showTerms ? 38 : 8),
    );

    page.drawRectangle({
      x: margin,
      y: payY,
      width: 250,
      height: 88,
      color: rgb(1, 0.995, 0.96),
      borderColor: GOLD,
      borderWidth: 0.8,
    });

    let textX = margin + 92;

    if (upiQrImage) {
      page.drawImage(upiQrImage, {
        x: margin + 10,
        y: payY + 10,
        width: 68,
        height: 68,
      });
    } else if (showUpiQr && upiId) {
      page.drawText("UPI", {
        x: margin + 28,
        y: payY + 42,
        size: 12,
        font: bold,
        color: BLUE,
      });
    }

    if (showUpiQr && upiId) {
      page.drawText("Scan & Pay", {
        x: textX,
        y: payY + 56,
        size: 8,
        font: bold,
        color: BLUE,
      });

      page.drawText(upiId, {
        x: textX,
        y: payY + 42,
        size: 7,
        font: regular,
        color: GRAY,
        maxWidth: 145,
      });
    }

    if (showBank) {
      const bankLines = [
        bankName ? bankName : "",
        accountNumber ? `A/C ${accountNumber}` : "",
        ifscCode ? `IFSC ${ifscCode}` : "",
      ].filter(Boolean);

      let bankY = payY + (showUpiQr ? 28 : 58);

      for (const line of bankLines.slice(0, 3)) {
        page.drawText(line, {
          x: textX,
          y: bankY,
          size: 6.5,
          font: regular,
          color: GRAY,
          maxWidth: 145,
        });
        bankY -= 11;
      }
    }
  }

  drawFooter();

  const pdfBytes = await pdf.save();
  const fileName = `${safeFileName(billNumber)}.pdf`;

  return {
    pdfBytes: new Uint8Array(pdfBytes),
    fileName,
    customerName,
    customerPhone,
    billNumber,
    billAmount,
    paidAmount,
    dueAmount,
    paymentMethod,
  };
}

async function uploadPdfToWhatsApp({
  pdfBytes,
  fileName,
  accessToken,
  phoneNumberId,
  apiVersion,
}: {
  pdfBytes: Uint8Array;
  fileName: string;
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
}) {
  const formData = new FormData();

  const pdfArrayBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfArrayBuffer).set(pdfBytes);

  formData.append("messaging_product", "whatsapp");
  formData.append("type", "application/pdf");
  formData.append(
    "file",
    new Blob([pdfArrayBuffer], {
      type: "application/pdf",
    }),
    fileName,
  );

  const uploadResponse = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
      cache: "no-store",
    },
  );

  const uploadData =
    (await uploadResponse.json()) as
      | MetaMediaUploadResponse
      | MetaErrorResponse;

  if (
    !uploadResponse.ok ||
    !("id" in uploadData) ||
    !uploadData.id
  ) {
    return {
      success: false as const,
      status: uploadResponse.status || 500,
      stage: "media_upload",
      ...buildMetaError(uploadData as MetaErrorResponse),
    };
  }

  return {
    success: true as const,
    mediaId: uploadData.id,
  };
}

async function sendInvoiceTemplate({
  recipientPhone,
  customerName,
  billNumber,
  billAmount,
  paidAmount,
  dueAmount,
  paymentMethod,
  mediaId,
  fileName,
  accessToken,
  phoneNumberId,
  apiVersion,
  templateName,
  templateLanguage,
}: {
  recipientPhone: string;
  customerName: string;
  billNumber: string;
  billAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: string;
  mediaId: string;
  fileName: string;
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  templateName: string;
  templateLanguage: string;
}) {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipientPhone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: templateLanguage,
      },
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "document",
              document: {
                id: mediaId,
                filename: fileName,
              },
            },
          ],
        },
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: customerName,
            },
            {
              type: "text",
              text: billNumber,
            },
            {
              type: "text",
              text: templateAmount(billAmount),
            },
            {
              type: "text",
              text: templateAmount(paidAmount),
            },
            {
              type: "text",
              text: templateAmount(dueAmount),
            },
            {
              type: "text",
              text: paymentMethod,
            },
          ],
        },
      ],
    },
  };

  const messageResponse = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  const messageData =
    (await messageResponse.json()) as
      | MetaMessageResponse
      | MetaErrorResponse;

  if (
    !messageResponse.ok ||
    !("messages" in messageData) ||
    !Array.isArray(messageData.messages) ||
    messageData.messages.length === 0
  ) {
    return {
      success: false as const,
      status: messageResponse.status || 500,
      stage: "template_message_send",
      ...buildMetaError(messageData as MetaErrorResponse),
    };
  }

  return {
    success: true as const,
    messageId: messageData.messages[0]?.id || null,
    messageStatus:
      messageData.messages[0]?.message_status || "accepted",
    recipientWhatsAppId:
      messageData.contacts?.[0]?.wa_id ||
      recipientPhone,
  };
}

export async function POST(request: NextRequest) {
  try {
    let body: InvoiceRequest;

    try {
      const contentType =
        request.headers.get("content-type") || "";

      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();

        body = {
          to: String(formData.get("to") || ""),
          sendWhatsApp: true,
          customerName: String(
            formData.get("customerName") || "",
          ),
          customerPhone: String(
            formData.get("customerPhone") ||
              formData.get("to") ||
              "",
          ),
          billNumber: String(
            formData.get("billNumber") || "",
          ),
          billDate: String(
            formData.get("billDate") || "",
          ),
          paymentMethod: String(
            formData.get("paymentMethod") || "Cash",
          ),
          subtotal: String(
            formData.get("subtotal") ||
              formData.get("billAmount") ||
              "0",
          ),
          discountAmount: String(
            formData.get("discountAmount") || "0",
          ),
          taxAmount: String(
            formData.get("taxAmount") || "0",
          ),
          roundOff: String(
            formData.get("roundOff") || "0",
          ),
          billAmount: String(
            formData.get("billAmount") || "0",
          ),
          paidAmount: String(
            formData.get("paidAmount") || "0",
          ),
          dueAmount: String(
            formData.get("dueAmount") || "0",
          ),
          whatsappLanguage: String(
            formData.get("whatsappLanguage") ||
              formData.get("language") ||
              "telugu",
          ),
          items: (() => {
            try {
              const raw = String(
                formData.get("itemsJson") || "[]",
              );
              const parsed = JSON.parse(raw);
              return Array.isArray(parsed)
                ? (parsed as InvoiceItem[])
                : [];
            } catch {
              return [];
            }
          })(),
          duplicateCopy:
            String(formData.get("duplicateCopy") || "")
              .trim()
              .toLowerCase() === "true",
          invoiceStudio: (() => {
            try {
              const raw = String(
                formData.get("invoiceStudioJson") || "",
              );
              if (!raw) return null;
              const parsed = JSON.parse(raw);
              return parsed &&
                typeof parsed === "object" &&
                !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : null;
            } catch {
              return null;
            }
          })(),
        };
      } else {
        body = (await request.json()) as InvoiceRequest;
      }
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Request body must be valid JSON or multipart form data.",
        },
        {
          status: 400,
        },
      );
    }

    const invoice = await createInvoicePdf(body);

    if (!body.sendWhatsApp) {
      return new NextResponse(invoice.pdfBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${invoice.fileName}"`,
          "Cache-Control": "no-store, max-age=0",
          "X-NCS-Invoice-Engine": "canonical-v3",
          "X-NCS-UPI-Enabled":
            studioBool(
              body.invoiceStudio || null,
              "show_upi_qr",
              false,
            )
              ? "1"
              : "0",
          "X-NCS-UPI-ID":
            studioText(
              body.invoiceStudio || null,
              "upi_id",
            ) || "missing",
          "X-NCS-Invoice-Theme":
            studioText(
              body.invoiceStudio || null,
              "theme",
            ) || "signature",
          "X-NCS-Invoice-Mode":
            studioText(
              body.invoiceStudio || null,
              "active_tab",
            ) || "a4",
          "X-NCS-Duplicate-Copy":
            body.duplicateCopy === true ? "1" : "0",
        },
      });
    }

    const recipientPhone = normalizePhone(
      body.to || body.customerPhone,
    );

    if (
      recipientPhone.length < 10 ||
      recipientPhone.length > 15
    ) {
      return NextResponse.json(
        {
          success: false,
          stage: "phone_validation",
          error:
            "A valid WhatsApp number with country code is required.",
          receivedPhone: recipientPhone,
        },
        {
          status: 400,
        },
      );
    }

    const accessToken =
      process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const apiVersion =
      process.env.WHATSAPP_API_VERSION?.trim() ||
      "v25.0";
    const {
      templateName,
      templateLanguage,
      selectedLanguage,
    } = resolveInvoiceTemplate(body.whatsappLanguage);

    if (!accessToken || !phoneNumberId) {
      return NextResponse.json(
        {
          success: false,
          stage: "environment_validation",
          error:
            "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID.",
        },
        {
          status: 500,
        },
      );
    }

    const uploadResult = await uploadPdfToWhatsApp({
      pdfBytes: invoice.pdfBytes,
      fileName: invoice.fileName,
      accessToken,
      phoneNumberId,
      apiVersion,
    });

    if (!uploadResult.success) {
      return NextResponse.json(
        {
          ...uploadResult,
          whatsappPdfSent: false,
          whatsappTextSent: false,
          templateName,
          templateLanguage,
          selectedLanguage,
        },
        {
          status: uploadResult.status,
        },
      );
    }

    const sendResult = await sendInvoiceTemplate({
      recipientPhone,
      customerName: invoice.customerName,
      billNumber: invoice.billNumber,
      billAmount: invoice.billAmount,
      paidAmount: invoice.paidAmount,
      dueAmount: invoice.dueAmount,
      paymentMethod: invoice.paymentMethod,
      mediaId: uploadResult.mediaId,
      fileName: invoice.fileName,
      accessToken,
      phoneNumberId,
      apiVersion,
      templateName,
      templateLanguage,
    });

    if (!sendResult.success) {
      return NextResponse.json(
        {
          whatsappPdfSent: false,
          whatsappTextSent: false,
          templateName,
          templateLanguage,
          selectedLanguage,
          ...sendResult,
        },
        {
          status: sendResult.status,
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        /*
         * Keep whatsappPdfSent=true for compatibility with the existing
         * offline-sync caller, while the actual approved delivery is the
         * message-only TEXT template.
         */
        whatsappPdfSent: true,
        whatsappTextSent: true,
        message:
          "NEW CITY STYLE invoice PDF sent to WhatsApp successfully.",
        billNumber: invoice.billNumber,
        fileName: invoice.fileName,
        recipientPhone,
        messageMode: "DOCUMENT_TEMPLATE",
        whatsappMessageId: sendResult.messageId,
        messageStatus: sendResult.messageStatus,
        recipientWhatsAppId:
          sendResult.recipientWhatsAppId,
        templateName,
        templateLanguage,
        selectedLanguage,
        invoiceItemCount:
          Array.isArray(body.items) ? body.items.length : 0,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "NEW CITY STYLE invoice PDF route error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        whatsappPdfSent: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected invoice PDF error.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "/api/whatsapp/invoice-pdf",
    method: "POST",
    message:
      "NEW CITY STYLE premium PDF invoice generator and WhatsApp sender is ready.",
    englishTemplateName:
      process.env.WHATSAPP_INVOICE_TEMPLATE_ENGLISH?.trim() ||
      "new_city_style_invoice_document_v2",
    englishTemplateLanguage:
      process.env.WHATSAPP_INVOICE_TEMPLATE_ENGLISH_LANGUAGE?.trim() ||
      "en_US",
    teluguTemplateName:
      process.env.WHATSAPP_INVOICE_TEMPLATE_TELUGU?.trim() ||
      "new_city_style_bill_telugu",
    teluguTemplateLanguage:
      process.env.WHATSAPP_INVOICE_TEMPLATE_TELUGU_LANGUAGE?.trim() ||
      "te",
    whatsappMode: "DOCUMENT_TEMPLATE",
  });
}