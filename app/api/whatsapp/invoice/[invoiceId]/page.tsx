import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PublicSale = {
  id: string;
  invoice_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  sale_status?: string | null;
  subtotal?: number | string | null;
  bill_discount?: number | string | null;
  tax_amount?: number | string | null;
  round_off?: number | string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  created_at?: string | null;
  is_deleted?: boolean | null;
};

type PublicSaleItem = {
  id: number;
  product_name?: string | null;
  barcode?: string | null;
  size?: string | null;
  color?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  line_total?: number | string | null;
};

const REVIEW_URL = "https://g.page/r/CZveSWbz9DT2EBM/review";

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num(value));
}

function pretty(value?: string | null) {
  const cleaned = String(value || "").trim().replaceAll("_", " ");
  return cleaned
    ? cleaned.replace(/\b\w/g, (character) => character.toUpperCase())
    : "—";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function maskPhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 4) return "";
  return `******${digits.slice(-4)}`;
}

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const supabase = getServerSupabase();

  if (!supabase || !invoiceId) notFound();

  const { data: saleData, error: saleError } = await supabase
    .from("pos_sales")
    .select("*")
    .eq("id", invoiceId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (saleError || !saleData) notFound();

  const sale = saleData as PublicSale;

  const { data: itemData, error: itemError } = await supabase
    .from("pos_sale_items")
    .select("id,product_name,barcode,size,color,quantity,unit_price,line_total")
    .eq("sale_id", sale.id)
    .order("id", { ascending: true });

  if (itemError) notFound();

  const items = (itemData || []) as PublicSaleItem[];
  const totalQty = items.reduce(
    (sum, item) => sum + Math.max(0, num(item.quantity)),
    0,
  );
  const dueAmount = Math.max(0, num(sale.due_amount));

  return (
    <main className="invoicePage">
      <section className="invoiceCard">
        <div className="brandBar" />

        <header className="header">
          <div>
            <span className="eyebrow">NEW CITY STYLE</span>
            <h1>Style for Every Family</h1>
            <p>Main Road, Opp. Govt. MPDO Office, Sarubujjili, Srikakulam - 532458</p>
            <p>+91 90100 14001 • newcitystyle.store</p>
          </div>
          <div className="invoiceBadge">
            <small>RETAIL INVOICE</small>
            <strong>{sale.invoice_number || "NCS INVOICE"}</strong>
            <span>{formatDate(sale.created_at)}</span>
          </div>
        </header>

        <section className="metaGrid">
          <article>
            <small>BILLED TO</small>
            <strong>{sale.customer_name || "Walk-in Customer"}</strong>
            {maskPhone(sale.customer_phone) && (
              <span>{maskPhone(sale.customer_phone)}</span>
            )}
          </article>
          <article>
            <small>PAYMENT</small>
            <strong>{pretty(sale.payment_method)}</strong>
            <span>{pretty(sale.payment_status || sale.sale_status)}</span>
          </article>
        </section>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.product_name || "Product"}</strong>
                    <span>
                      {[item.size, item.color].filter(Boolean).join(" • ") ||
                        item.barcode ||
                        "Standard"}
                    </span>
                  </td>
                  <td>{num(item.quantity)}</td>
                  <td>{money(item.unit_price)}</td>
                  <td>{money(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="summaryArea">
          <div className="summaryNote">
            <small>TOTAL QUANTITY</small>
            <strong>{totalQty}</strong>
            <p>Thank you for choosing NEW CITY STYLE.</p>
          </div>
          <div className="totals">
            <p><span>Subtotal</span><strong>{money(sale.subtotal)}</strong></p>
            {num(sale.bill_discount) > 0 && (
              <p><span>Discount</span><strong>-{money(sale.bill_discount)}</strong></p>
            )}
            {num(sale.tax_amount) > 0 && (
              <p><span>GST Included</span><strong>{money(sale.tax_amount)}</strong></p>
            )}
            {num(sale.round_off) !== 0 && (
              <p><span>Round Off</span><strong>{money(sale.round_off)}</strong></p>
            )}
            <div className="grand">
              <span>NET AMOUNT</span>
              <strong>{money(sale.total_amount)}</strong>
            </div>
            <p><span>Paid</span><strong>{money(sale.paid_amount)}</strong></p>
            {dueAmount > 0 && (
              <p className="due"><span>Due</span><strong>{money(dueAmount)}</strong></p>
            )}
          </div>
        </section>

        <section className="reviewCard">
          <div>
            <small>HAPPY WITH YOUR SHOPPING?</small>
            <strong>Rate NEW CITY STYLE on Google</strong>
            <p>Your feedback helps local customers discover us.</p>
          </div>
          <a href={REVIEW_URL} target="_blank" rel="noreferrer">
            Write a Google Review
          </a>
        </section>

        <footer>
          <strong>Thank you for shopping with NEW CITY STYLE.</strong>
          <span>Exchange subject to store policy. Please retain your invoice.</span>
        </footer>
      </section>

      <style>{`
        *{box-sizing:border-box}
        body{margin:0;background:#f5f6f9;color:#2c2c2c;font-family:Inter,Arial,sans-serif}
        .invoicePage{min-height:100vh;padding:28px 14px}
        .invoiceCard{position:relative;max-width:920px;margin:0 auto;background:#fff;border:1px solid #e7e9ef;border-radius:24px;overflow:hidden;box-shadow:0 18px 60px rgba(3,21,63,.10)}
        .brandBar{height:7px;background:#0A2E73}
        .header{display:flex;justify-content:space-between;gap:24px;padding:32px 34px 24px;border-bottom:1px solid #eceef3}
        .eyebrow{display:block;color:#0A2E73;font-weight:900;letter-spacing:.12em;font-size:22px}
        .header h1{margin:5px 0 12px;color:#D4AF37;font-size:15px;letter-spacing:.08em;text-transform:uppercase}
        .header p{margin:4px 0;color:#6b7280;font-size:13px}
        .invoiceBadge{min-width:230px;background:#0A2E73;color:#fff;border-radius:18px;padding:18px 20px;align-self:flex-start}
        .invoiceBadge small{color:#D4AF37;font-weight:800;letter-spacing:.1em}
        .invoiceBadge strong{display:block;font-size:20px;margin:7px 0}
        .invoiceBadge span{font-size:12px;opacity:.9}
        .metaGrid{display:grid;grid-template-columns:1.3fr .7fr;gap:14px;padding:22px 34px}
        .metaGrid article{background:#f8f9fc;border:1px solid #eceef3;border-radius:16px;padding:16px 18px}
        .metaGrid small,.summaryNote small,.reviewCard small{display:block;color:#D4AF37;font-weight:900;letter-spacing:.11em;font-size:11px}
        .metaGrid strong{display:block;color:#0A2E73;font-size:17px;margin:5px 0}
        .metaGrid span{color:#6b7280;font-size:13px}
        .tableWrap{padding:0 34px;overflow:auto}
        table{width:100%;border-collapse:collapse;min-width:620px}
        th{padding:12px 10px;background:#f6f7fb;color:#0A2E73;font-size:11px;letter-spacing:.08em;text-transform:uppercase;text-align:right;border-top:2px solid #D4AF37}
        th:first-child{text-align:left}
        td{padding:15px 10px;border-bottom:1px dashed #e0e3e9;text-align:right;font-size:14px}
        td:first-child{text-align:left}
        td strong{display:block;color:#2c2c2c}
        td span{display:block;color:#8a909b;font-size:12px;margin-top:4px}
        .summaryArea{display:grid;grid-template-columns:1fr 340px;gap:30px;padding:28px 34px}
        .summaryNote{align-self:end}
        .summaryNote strong{display:block;font-size:34px;color:#0A2E73;margin:3px 0 12px}
        .summaryNote p{color:#6b7280;font-size:13px}
        .totals p{display:flex;justify-content:space-between;margin:0;padding:7px 0;border-bottom:1px solid #f0f1f4;font-size:13px}
        .grand{display:flex;justify-content:space-between;align-items:center;background:#0A2E73;color:#fff;border-top:4px solid #D4AF37;padding:14px 15px;margin:10px 0;border-radius:12px}
        .grand span{color:#D4AF37;font-weight:900;font-size:12px;letter-spacing:.08em}
        .grand strong{font-size:21px}
        .due{color:#a61b1b;font-weight:800}
        .reviewCard{margin:0 34px 28px;border:1px solid #ead996;background:#fffaf0;border-radius:18px;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;gap:18px}
        .reviewCard strong{display:block;color:#0A2E73;font-size:17px;margin:4px 0}
        .reviewCard p{margin:0;color:#6b7280;font-size:12px}
        .reviewCard a{white-space:nowrap;background:#0A2E73;color:#fff;text-decoration:none;font-weight:800;border-radius:12px;padding:12px 15px}
        footer{border-top:1px solid #eceef3;padding:18px 34px 24px;text-align:center}
        footer strong{display:block;color:#0A2E73}
        footer span{display:block;color:#8a909b;font-size:12px;margin-top:5px}
        @media(max-width:700px){
          .invoicePage{padding:0}.invoiceCard{border-radius:0;border-left:0;border-right:0;box-shadow:none}
          .header{display:block;padding:24px 18px 18px}.invoiceBadge{margin-top:18px;min-width:0}
          .metaGrid{grid-template-columns:1fr;padding:16px 18px}.tableWrap{padding:0 18px}
          .summaryArea{grid-template-columns:1fr;padding:22px 18px}.reviewCard{margin:0 18px 22px;display:block}
          .reviewCard a{display:block;text-align:center;margin-top:14px}footer{padding:18px}
        }
      `}</style>
    </main>
  );
}
