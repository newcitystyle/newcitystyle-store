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
  items?: InvoiceItem[];
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
  if (typeof value === "number" && Number.isFinite(value)) return value;
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

function safeFileName(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "NCS-INVOICE"
  );
}

export async function POST(request: NextRequest) {
  try {
    let body: InvoiceRequest;

    try {
      body = (await request.json()) as InvoiceRequest;
    } catch {
      return NextResponse.json(
        { success: false, error: "Request body must be valid JSON." },
        { status: 400 },
      );
    }

    const customerName = text(body.customerName, "Customer");
    const customerPhone = text(body.customerPhone, "-");
    const billNumber = text(body.billNumber, "NCS-INVOICE");
    const billDate = text(body.billDate, new Date().toLocaleString("en-IN"));
    const paymentMethod = text(body.paymentMethod, "Cash");

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

    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 38;
    const footerHeight = 34;
    const headerHeight = 112;
    const tableTop = pageHeight - 226;
    const rowHeight = 28;

    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = tableTop;

    const drawHeader = () => {
      page.drawRectangle({
        x: 0,
        y: pageHeight - headerHeight,
        width: pageWidth,
        height: headerHeight,
        color: BLUE,
      });
      page.drawRectangle({
        x: 0,
        y: pageHeight - headerHeight - 4,
        width: pageWidth,
        height: 4,
        color: GOLD,
      });
      page.drawCircle({
        x: margin + 28,
        y: pageHeight - 47,
        size: 27,
        color: GOLD,
      });
      page.drawText("NCS", {
        x: margin + 10,
        y: pageHeight - 54,
        size: 18,
        font: bold,
        color: BLUE,
      });
      page.drawText("NEW CITY STYLE", {
        x: margin + 70,
        y: pageHeight - 42,
        size: 22,
        font: bold,
        color: rgb(1, 1, 1),
      });
      page.drawText("Style for Every Family", {
        x: margin + 70,
        y: pageHeight - 62,
        size: 10,
        font: regular,
        color: GOLD,
      });
      page.drawText("TAX INVOICE", {
        x: pageWidth - margin - 112,
        y: pageHeight - 42,
        size: 16,
        font: bold,
        color: GOLD,
      });
      page.drawText("www.newcitystyle.store", {
        x: pageWidth - margin - 112,
        y: pageHeight - 62,
        size: 8.5,
        font: regular,
        color: rgb(1, 1, 1),
      });
    };

    const drawFooter = () => {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: footerHeight,
        color: BLUE,
      });
      page.drawText(
        "NEW CITY STYLE  |  Style for Every Family  |  www.newcitystyle.store",
        {
          x: margin,
          y: 13,
          size: 8,
          font: regular,
          color: rgb(1, 1, 1),
        },
      );
    };

    const drawInvoiceInfo = () => {
      const top = pageHeight - headerHeight - 30;
      page.drawText("BILL TO", {
        x: margin,
        y: top,
        size: 10,
        font: bold,
        color: GOLD,
      });
      page.drawText(customerName, {
        x: margin,
        y: top - 20,
        size: 12,
        font: bold,
        color: CHARCOAL,
      });
      page.drawText(customerPhone, {
        x: margin,
        y: top - 38,
        size: 9,
        font: regular,
        color: GRAY,
      });

      const infoX = pageWidth - margin - 215;
      const labels = ["Invoice No.", "Date", "Payment"];
      const values = [billNumber, billDate, paymentMethod];

      labels.forEach((label, index) => {
        const rowY = top - index * 19;
        page.drawText(label, {
          x: infoX,
          y: rowY,
          size: 9,
          font: bold,
          color: GRAY,
        });
        page.drawText(values[index], {
          x: infoX + 82,
          y: rowY,
          size: index === 0 ? 8.5 : 8,
          font: index === 0 ? bold : regular,
          color: CHARCOAL,
          maxWidth: 132,
        });
      });
    };

    const columns = [
      { label: "#", x: margin, width: 24 },
      { label: "ITEM", x: margin + 25, width: 220 },
      { label: "QTY", x: margin + 248, width: 42 },
      { label: "MRP", x: margin + 292, width: 62 },
      { label: "PRICE", x: margin + 356, width: 70 },
      { label: "TOTAL", x: margin + 428, width: 90 },
    ];

    const drawTableHeader = () => {
      page.drawRectangle({
        x: margin,
        y: y - 20,
        width: pageWidth - margin * 2,
        height: 28,
        color: BLUE,
      });
      columns.forEach((column, index) => {
        const labelWidth = bold.widthOfTextAtSize(column.label, 8);
        const x =
          index <= 1
            ? column.x + 6
            : column.x + column.width - labelWidth - 6;
        page.drawText(column.label, {
          x,
          y: y - 11,
          size: 8,
          font: bold,
          color: GOLD,
        });
      });
      y -= 28;
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
      if (y - rowHeight < 210) newPage();

      const item = items[index];
      const qty = Math.max(1, amount(item.quantity, 1));
      const price = amount(item.price);
      const mrp = amount(item.mrp, price);
      const total = amount(item.total, qty * price);
      const variant = [item.size, item.color]
        .map((value) => text(value, ""))
        .filter(Boolean)
        .join(" / ");
      const itemName = `${text(item.name, "Product")}${
        variant ? ` (${variant})` : ""
      }`;

      if (index % 2 === 0) {
        page.drawRectangle({
          x: margin,
          y: y - rowHeight + 6,
          width: pageWidth - margin * 2,
          height: rowHeight,
          color: IVORY,
        });
      }

      page.drawText(String(index + 1), {
        x: columns[0].x + 6,
        y: y - 11,
        size: 8,
        font: regular,
        color: CHARCOAL,
      });

      page.drawText(itemName, {
        x: columns[1].x + 6,
        y: y - 11,
        size: 8,
        font: bold,
        color: CHARCOAL,
        maxWidth: columns[1].width - 12,
      });

      const values = [
        qty.toFixed(qty % 1 === 0 ? 0 : 2),
        money(mrp),
        money(price),
        money(total),
      ];

      [2, 3, 4, 5].forEach((columnIndex, valueIndex) => {
        const font = columnIndex === 5 ? bold : regular;
        const size = columnIndex === 2 ? 8 : 7.4;
        const value = values[valueIndex];
        page.drawText(value, {
          x:
            columns[columnIndex].x +
            columns[columnIndex].width -
            font.widthOfTextAtSize(value, size) -
            6,
          y: y - 11,
          size,
          font,
          color: CHARCOAL,
        });
      });

      page.drawLine({
        start: { x: margin, y: y - rowHeight + 6 },
        end: { x: pageWidth - margin, y: y - rowHeight + 6 },
        thickness: 0.4,
        color: rgb(0.86, 0.86, 0.86),
      });

      y -= rowHeight;
    }

    if (y < 220) newPage();

    y -= 18;
    const summaryX = pageWidth - margin - 220;
    const summaryWidth = 220;

    page.drawRectangle({
      x: summaryX,
      y: y - 145,
      width: summaryWidth,
      height: 155,
      color: IVORY,
      borderColor: GOLD,
      borderWidth: 1,
    });

    const summaryRows: Array<[string, string, boolean]> = [
      ["Subtotal", money(subtotal), false],
      ["Discount", money(discountAmount), false],
      ["Tax", money(taxAmount), false],
      ["Round Off", money(roundOff), false],
      ["Bill Total", money(billAmount), true],
      ["Paid", money(paidAmount), false],
      ["Due", money(dueAmount), true],
    ];

    let summaryY = y - 16;
    summaryRows.forEach(([label, value, strong]) => {
      const font = strong ? bold : regular;
      const size = strong ? 9.5 : 8.5;
      const color = strong ? BLUE : CHARCOAL;
      page.drawText(label, {
        x: summaryX + 14,
        y: summaryY,
        size,
        font,
        color,
      });
      page.drawText(value, {
        x:
          summaryX +
          summaryWidth -
          14 -
          font.widthOfTextAtSize(value, size),
        y: summaryY,
        size,
        font,
        color,
      });
      summaryY -= 19;
    });

    page.drawText("Thank you for shopping with NEW CITY STYLE.", {
      x: margin,
      y: Math.max(58, y - 172),
      size: 9.5,
      font: bold,
      color: BLUE,
    });
    page.drawText(
      "Please retain this invoice for return or exchange reference.",
      {
        x: margin,
        y: Math.max(42, y - 189),
        size: 8,
        font: regular,
        color: GRAY,
      },
    );

    drawFooter();

    const pdfBytes = await pdf.save();
    const fileName = `${safeFileName(billNumber)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("NEW CITY STYLE invoice PDF route error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected invoice PDF error.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "/api/whatsapp/invoice-pdf",
    method: "POST",
    message: "NEW CITY STYLE premium PDF invoice generator is ready.",
  });
}