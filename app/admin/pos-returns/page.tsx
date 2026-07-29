"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type PosReturn = {
  id: string;
  return_number: string;
  sale_id: string;
  invoice_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  return_type?: string | null;
  return_status?: string | null;
  reason?: string | null;
  notes?: string | null;
  total_return_amount?: number | string | null;
  refund_method?: string | null;
  created_at?: string | null;
};

type ReturnItem = {
  id: number;
  return_id: string;
  sale_item_id: number;
  sale_id: string;
  product_id: number;
  variant_id?: number | null;
  product_name?: string | null;
  size?: string | null;
  color?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  refund_amount?: number | string | null;
  reason?: string | null;
  restock?: boolean | null;
  created_at?: string | null;
};

type Refund = {
  id: number;
  return_id: string;
  sale_id: string;
  refund_method?: string | null;
  amount?: number | string | null;
  refund_status?: string | null;
  reference_number?: string | null;
  refunded_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type ReturnDetails = PosReturn & {
  items: ReturnItem[];
  refunds: Refund[];
};

const BLUE = "#0A2E73";
const DEEP = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";
const CHARCOAL = "#2C2C2C";

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num(value));

const norm = (value?: string | null) =>
  value?.trim().toLowerCase() || "";

const label = (value?: string | null) => {
  const text = norm(value).replaceAll("_", " ");
  return text
    ? text.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Unknown";
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

export default function PosReturnHistoryPage() {
  const [returns, setReturns] = useState<PosReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [returnType, setReturnType] = useState("all");
  const [refundMethod, setRefundMethod] = useState("all");
  const [selected, setSelected] = useState<ReturnDetails | null>(
    null
  );
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadReturns = useCallback(async () => {
    setLoading(true);
    setErrorText("");

    try {
      const { data, error } = await supabase
        .from("pos_returns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setReturns((data || []) as PosReturn[]);
    } catch (error) {
      console.warn("Unable to load POS returns:", error);
      setErrorText(
        error instanceof Error
          ? error.message
          : "Unable to load return history."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReturns();
  }, [loadReturns]);

  useEffect(() => {
    if (!notice) return;

    const timeout = window.setTimeout(() => {
      setNotice("");
    }, 4200);

    return () => window.clearTimeout(timeout);
  }, [notice]);

  const filteredReturns = useMemo(() => {
    const query = norm(search);

    return returns.filter((entry) => {
      const matchesSearch =
        !query ||
        [
          entry.return_number,
          entry.invoice_number,
          entry.customer_name,
          entry.customer_phone,
          entry.reason,
        ].some((value) => norm(value).includes(query));

      const matchesType =
        returnType === "all" ||
        norm(entry.return_type) === returnType;

      const matchesRefundMethod =
        refundMethod === "all" ||
        norm(entry.refund_method) === refundMethod;

      return matchesSearch && matchesType && matchesRefundMethod;
    });
  }, [returns, search, returnType, refundMethod]);

  const summary = useMemo(() => {
    const total = returns.reduce(
      (sum, entry) => sum + num(entry.total_return_amount),
      0
    );

    const refunds = returns.filter(
      (entry) => norm(entry.return_type) === "refund"
    ).length;

    const exchanges = returns.filter(
      (entry) => norm(entry.return_type) === "exchange"
    ).length;

    const storeCredit = returns.filter(
      (entry) => norm(entry.return_type) === "store_credit"
    ).length;

    return {
      count: returns.length,
      total,
      refunds,
      exchanges,
      storeCredit,
    };
  }, [returns]);

  async function openDetails(entry: PosReturn) {
    setDetailsLoading(true);

    try {
      const [itemsResult, refundsResult] = await Promise.all([
        supabase
          .from("pos_return_items")
          .select("*")
          .eq("return_id", entry.id)
          .order("id", { ascending: true }),
        supabase
          .from("pos_refunds")
          .select("*")
          .eq("return_id", entry.id)
          .order("created_at", { ascending: false }),
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (refundsResult.error) throw refundsResult.error;

      setSelected({
        ...entry,
        items: (itemsResult.data || []) as ReturnItem[],
        refunds: (refundsResult.data || []) as Refund[],
      });
    } catch (error) {
      console.warn("Unable to load return details:", error);
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load return details."
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  function buildWhatsAppMessage(entry: ReturnDetails) {
    const itemLines = entry.items
      .map((item, index) => {
        const variant =
          [item.size, item.color].filter(Boolean).join(" / ") ||
          "No variant";

        return [
          `${index + 1}. ${item.product_name || "Product"}`,
          `   ${variant}`,
          `   Qty ${num(item.quantity)} × ${money(
            item.unit_price
          )} = ${money(item.refund_amount)}`,
        ].join("\n");
      })
      .join("\n");

    return [
      "↩️ *NEW CITY STYLE RETURN RECEIPT*",
      "_Style for Every Family_",
      "",
      `Return No: ${entry.return_number}`,
      `Invoice: ${entry.invoice_number || "—"}`,
      `Date: ${formatDate(entry.created_at)}`,
      `Customer: ${entry.customer_name || "Walk-in Customer"}`,
      entry.customer_phone
        ? `Mobile: ${entry.customer_phone}`
        : "",
      `Type: ${label(entry.return_type)}`,
      entry.refund_method
        ? `Refund Method: ${label(entry.refund_method)}`
        : "",
      "",
      "*Returned Items*",
      itemLines,
      "",
      `*Return Value: ${money(entry.total_return_amount)}*`,
      entry.reason ? `Reason: ${entry.reason}` : "",
      "",
      "Thank you for shopping with NEW CITY STYLE.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function shareWhatsApp(entry: ReturnDetails) {
    const digits = (entry.customer_phone || "").replace(/\D/g, "");
    const phone =
      digits.length === 10 ? `91${digits}` : digits;
    const message = buildWhatsAppMessage(entry);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(
          message
        )}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    const popup = window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );

    if (!popup) {
      setNotice(
        "Please allow popups to share the return receipt."
      );
    }
  }

  function printReceipt(entry: ReturnDetails) {
    const rows = entry.items
      .map(
        (item) => `
          <tr>
            <td>${item.product_name || "Product"}</td>
            <td>${
              [item.size, item.color]
                .filter(Boolean)
                .join(" / ") || "—"
            }</td>
            <td>${num(item.quantity)}</td>
            <td>${money(item.unit_price)}</td>
            <td>${money(item.refund_amount)}</td>
          </tr>
        `
      )
      .join("");

    const popup = window.open(
      "",
      "_blank",
      "width=900,height=900"
    );

    if (!popup) {
      setNotice("Please allow popups to print the receipt.");
      return;
    }

    popup.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${entry.return_number}</title>
        <style>
          body{font-family:Arial,sans-serif;color:#222;padding:28px}
          .head{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #0A2E73;padding-bottom:18px}
          h1{margin:4px 0;color:#0A2E73}.gold{color:#D4AF37;font-weight:900}
          .info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}
          .box{border:1px solid #ddd;border-radius:10px;padding:12px}
          table{width:100%;border-collapse:collapse}
          th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}
          th{background:#F8F4EC}.total{width:360px;margin:20px 0 0 auto}
          .line{display:flex;justify-content:space-between;padding:7px 0}
          .grand{border-top:2px solid #0A2E73;padding-top:12px;color:#0A2E73;font-size:20px}
        </style>
      </head>
      <body>
        <div class="head">
          <div>
            <div class="gold">NEW CITY STYLE</div>
            <h1>Return Receipt</h1>
            <div>Style for Every Family</div>
          </div>
          <div>
            <b>${entry.return_number}</b><br/>
            ${formatDate(entry.created_at)}
          </div>
        </div>

        <div class="info">
          <div class="box">
            <b>Customer</b><br/>
            ${entry.customer_name || "Walk-in Customer"}<br/>
            ${entry.customer_phone || ""}
          </div>
          <div class="box">
            <b>Original Invoice</b><br/>
            ${entry.invoice_number || "—"}<br/>
            ${label(entry.return_type)}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Variant</th>
              <th>Qty</th>
              <th>Refund / Item</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="total">
          <div class="line">
            <span>Refund Method</span>
            <b>${label(entry.refund_method)}</b>
          </div>
          <div class="line grand">
            <span>Return Value</span>
            <b>${money(entry.total_return_amount)}</b>
          </div>
        </div>

        ${
          entry.reason
            ? `<p><b>Reason:</b> ${entry.reason}</p>`
            : ""
        }

        <script>window.onload=()=>window.print()</script>
      </body>
      </html>
    `);

    popup.document.close();
  }

  return (
    <main className="returnHistoryPage">
      {notice && <div className="notice">{notice}</div>}

      <section className="hero">
        <div>
          <span className="eyebrow">NEW CITY STYLE POS</span>
          <h1>Return History</h1>
          <p>
            Track every refund, exchange and store-credit return
            from one premium dashboard.
          </p>
        </div>

        <button
          type="button"
          className="refreshButton"
          onClick={() => void loadReturns()}
          disabled={loading}
        >
          <span>{loading ? "…" : "↻"}</span>
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </section>

      <section className="stats">
        <article>
          <span>Total Returns</span>
          <strong>{summary.count}</strong>
        </article>

        <article>
          <span>Return Value</span>
          <strong>{money(summary.total)}</strong>
        </article>

        <article>
          <span>Refunds</span>
          <strong>{summary.refunds}</strong>
        </article>

        <article>
          <span>Exchanges</span>
          <strong>{summary.exchanges}</strong>
        </article>

        <article>
          <span>Store Credit</span>
          <strong>{summary.storeCredit}</strong>
        </article>
      </section>

      <section className="filters">
        <label className="searchBox">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search return no, invoice, customer or phone..."
          />
        </label>

        <select
          value={returnType}
          onChange={(event) =>
            setReturnType(event.target.value)
          }
        >
          <option value="all">All Return Types</option>
          <option value="refund">Refund</option>
          <option value="exchange">Exchange</option>
          <option value="store_credit">Store Credit</option>
        </select>

        <select
          value={refundMethod}
          onChange={(event) =>
            setRefundMethod(event.target.value)
          }
        >
          <option value="all">All Refund Methods</option>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="store_credit">Store Credit</option>
          <option value="none">No Refund</option>
        </select>
      </section>

      {errorText && <section className="errorBox">{errorText}</section>}

      <section className="returnList">
        {loading ? (
          <div className="emptyState">Loading return history...</div>
        ) : filteredReturns.length === 0 ? (
          <div className="emptyState">
            No matching returns found.
          </div>
        ) : (
          filteredReturns.map((entry) => (
            <article className="returnCard" key={entry.id}>
              <div className="returnTop">
                <div>
                  <span className="returnNumber">
                    {entry.return_number}
                  </span>
                  <h2>{entry.invoice_number || "No Invoice"}</h2>
                  <p>{formatDate(entry.created_at)}</p>
                </div>

                <div className="badges">
                  <span
                    className={`typeBadge ${norm(
                      entry.return_type
                    )}`}
                  >
                    {label(entry.return_type)}
                  </span>
                  <span className="statusBadge">
                    {label(entry.return_status)}
                  </span>
                </div>
              </div>

              <div className="returnGrid">
                <div>
                  <span>Customer</span>
                  <strong>
                    {entry.customer_name || "Walk-in Customer"}
                  </strong>
                  <small>{entry.customer_phone || "No mobile"}</small>
                </div>

                <div>
                  <span>Refund Method</span>
                  <strong>{label(entry.refund_method)}</strong>
                  <small>{entry.reason || "No reason added"}</small>
                </div>

                <div className="amountBlock">
                  <span>Return Value</span>
                  <strong>
                    {money(entry.total_return_amount)}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                className="viewButton"
                onClick={() => void openDetails(entry)}
                disabled={detailsLoading}
              >
                <span>↗</span>
                View Return Receipt
              </button>
            </article>
          ))
        )}
      </section>

      {selected && (
        <div
          className="modalOverlay"
          onMouseDown={() => setSelected(null)}
        >
          <section
            className="receiptModal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="receiptHeader">
              <div>
                <span>RETURN RECEIPT</span>
                <h2>{selected.return_number}</h2>
                <p>{selected.invoice_number || "No invoice"}</p>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
            </header>

            <div className="receiptCustomer">
              <div>
                <span>Customer</span>
                <strong>
                  {selected.customer_name || "Walk-in Customer"}
                </strong>
                <small>{selected.customer_phone || "No mobile"}</small>
              </div>

              <div>
                <span>Return Type</span>
                <strong>{label(selected.return_type)}</strong>
                <small>{formatDate(selected.created_at)}</small>
              </div>

              <div className="receiptTotal">
                <span>Return Value</span>
                <strong>
                  {money(selected.total_return_amount)}
                </strong>
              </div>
            </div>

            <section className="receiptItems">
              <div className="sectionTitle">
                <span>RETURNED ITEMS</span>
                <strong>{selected.items.length}</strong>
              </div>

              {selected.items.map((item) => (
                <article key={item.id}>
                  <div>
                    <h3>{item.product_name || "Product"}</h3>
                    <p>
                      {[item.size, item.color]
                        .filter(Boolean)
                        .join(" • ") || "No variant"}
                    </p>
                    <small>
                      {item.restock
                        ? "Stock restored"
                        : "Not restocked"}
                    </small>
                  </div>

                  <div className="itemAmount">
                    <span>
                      {num(item.quantity)} × {money(item.unit_price)}
                    </span>
                    <strong>{money(item.refund_amount)}</strong>
                  </div>
                </article>
              ))}
            </section>

            <div className="receiptInfo">
              <div>
                <span>Refund Method</span>
                <strong>{label(selected.refund_method)}</strong>
              </div>

              <div>
                <span>Status</span>
                <strong>{label(selected.return_status)}</strong>
              </div>

              <div>
                <span>Reason</span>
                <strong>{selected.reason || "—"}</strong>
              </div>

              {selected.notes && (
                <div>
                  <span>Notes</span>
                  <strong>{selected.notes}</strong>
                </div>
              )}
            </div>

            <footer className="receiptActions">
              <button
                type="button"
                className="closeAction"
                onClick={() => setSelected(null)}
              >
                Close
              </button>

              <button
                type="button"
                className="whatsAppAction"
                onClick={() => shareWhatsApp(selected)}
              >
                <span>◉</span>
                WhatsApp Receipt
              </button>

              <button
                type="button"
                className="printAction"
                onClick={() => printReceipt(selected)}
              >
                Print Receipt
              </button>
            </footer>
          </section>
        </div>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f4f6fa;
          color: ${CHARCOAL};
        }

        .returnHistoryPage {
          min-height: 100vh;
          padding: 22px;
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(212, 175, 55, 0.12),
              transparent 24%
            ),
            #f4f6fa;
          font-family: Inter, Arial, sans-serif;
        }

        .notice {
          position: fixed;
          z-index: 11000;
          top: 18px;
          left: 50%;
          transform: translateX(-50%);
          width: min(560px, calc(100% - 30px));
          padding: 13px 16px;
          border: 1px solid rgba(212, 175, 55, 0.34);
          border-radius: 13px;
          background: ${DEEP};
          color: #ffffff;
          font-size: 11px;
          font-weight: 850;
          text-align: center;
          box-shadow: 0 18px 45px rgba(3, 21, 63, 0.25);
        }

        .hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 28px;
          border: 1px solid rgba(212, 175, 55, 0.28);
          border-radius: 24px;
          background:
            radial-gradient(
              circle at 88% 8%,
              rgba(212, 175, 55, 0.22),
              transparent 32%
            ),
            linear-gradient(135deg, ${DEEP}, ${BLUE});
          color: #ffffff;
          box-shadow: 0 22px 60px rgba(3, 21, 63, 0.17);
        }

        .eyebrow {
          color: ${GOLD};
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 1.5px;
        }

        .hero h1 {
          margin: 7px 0 5px;
          font-size: clamp(32px, 5vw, 52px);
          line-height: 1;
        }

        .hero p {
          max-width: 620px;
          margin: 0;
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          line-height: 1.6;
        }

        .refreshButton {
          min-width: 140px;
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 0;
          border-radius: 14px;
          background: linear-gradient(135deg, ${GOLD}, #f0d267);
          color: ${DEEP};
          font: inherit;
          font-size: 11px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 14px 30px rgba(212, 175, 55, 0.24);
          transition: transform 0.2s ease;
        }

        .refreshButton:hover:not(:disabled) {
          transform: translateY(-3px);
        }

        .refreshButton span {
          font-size: 19px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          margin: 16px 0;
        }

        .stats article {
          position: relative;
          isolation: isolate;
          min-height: 108px;
          overflow: hidden;
          padding: 18px;
          border: 1px solid rgba(212, 175, 55, 0.18);
          border-radius: 19px;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.98),
            rgba(3, 21, 63, 0.97)
          );
          box-shadow:
            0 10px 24px rgba(3, 21, 63, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            inset 0 -1px 0 rgba(212, 175, 55, 0.08);
          backdrop-filter: blur(10px);
          transition:
            transform 0.22s ease,
            box-shadow 0.22s ease,
            border-color 0.22s ease;
          animation: statCardRise 0.45s ease both;
        }

        .stats article:nth-child(1) {
          animation-delay: 0.04s;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.99),
            rgba(4, 28, 82, 0.98)
          );
        }

        .stats article:nth-child(2) {
          animation-delay: 0.09s;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.99),
            rgba(22, 46, 102, 0.98),
            rgba(110, 84, 16, 0.92)
          );
        }

        .stats article:nth-child(3) {
          animation-delay: 0.14s;
          background: linear-gradient(
            135deg,
            rgba(5, 25, 74, 0.99),
            rgba(8, 37, 96, 0.98)
          );
        }

        .stats article:nth-child(4) {
          animation-delay: 0.19s;
          background: linear-gradient(
            135deg,
            rgba(8, 40, 103, 0.99),
            rgba(6, 31, 86, 0.98)
          );
        }

        .stats article:nth-child(5) {
          animation-delay: 0.24s;
          background: linear-gradient(
            135deg,
            rgba(7, 33, 90, 0.99),
            rgba(10, 46, 115, 0.98),
            rgba(88, 67, 15, 0.94)
          );
        }

        .stats article::before {
          content: "";
          position: absolute;
          z-index: -1;
          top: -42%;
          right: -18%;
          width: 126px;
          height: 126px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(212, 175, 55, 0.34),
            rgba(212, 175, 55, 0)
          );
          transition: transform 0.28s ease;
        }

        .stats article::after {
          content: "";
          position: absolute;
          top: -140%;
          left: -34%;
          width: 42%;
          height: 360%;
          transform: rotate(22deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.14),
            transparent
          );
          animation: statShine 5.2s ease-in-out infinite;
          pointer-events: none;
        }

        .stats article:nth-child(2)::after {
          animation-delay: 0.7s;
        }

        .stats article:nth-child(3)::after {
          animation-delay: 1.4s;
        }

        .stats article:nth-child(4)::after {
          animation-delay: 2.1s;
        }

        .stats article:nth-child(5)::after {
          animation-delay: 2.8s;
        }

        .stats article:hover {
          transform: translateY(-2px) scale(1.004);
          border-color: rgba(212, 175, 55, 0.4);
          box-shadow:
            0 14px 28px rgba(3, 21, 63, 0.2),
            0 0 0 1px rgba(212, 175, 55, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .stats article:hover::before {
          transform: scale(1.08);
        }

        .stats span {
          position: relative;
          z-index: 2;
          color: rgba(212, 175, 55, 0.92);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.55px;
          text-transform: uppercase;
        }

        .stats strong {
          position: relative;
          z-index: 2;
          display: block;
          margin-top: 9px;
          color: #ffffff;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -0.5px;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
        }

        .stats article:nth-child(2) strong,
        .stats article:nth-child(5) strong {
          color: #f6d676;
        }

        .filters {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 210px 210px;
          gap: 10px;
          padding: 13px;
          border: 1px solid #e4e8f0;
          border-radius: 18px;
          background: #ffffff;
        }

        .searchBox {
          display: flex;
          align-items: center;
          gap: 9px;
          min-height: 46px;
          padding: 0 13px;
          border: 1px solid #dfe4ed;
          border-radius: 12px;
          background: #ffffff;
        }

        .searchBox span {
          color: ${BLUE};
          font-size: 20px;
        }

        .searchBox input {
          width: 100%;
          border: 0;
          outline: none;
          background: transparent;
          font: inherit;
          font-size: 11px;
        }

        .filters select {
          min-height: 46px;
          border: 1px solid #dfe4ed;
          border-radius: 12px;
          background: #ffffff;
          padding: 0 12px;
          font: inherit;
          font-size: 11px;
          outline: none;
        }

        .returnList {
          display: grid;
          gap: 12px;
          margin-top: 14px;
        }

        .returnCard {
          padding: 18px;
          border: 1px solid #e4e8ef;
          border-radius: 19px;
          background: #ffffff;
          box-shadow: 0 12px 34px rgba(3, 21, 63, 0.05);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .returnCard:hover {
          transform: translateY(-3px);
          box-shadow: 0 18px 44px rgba(3, 21, 63, 0.09);
        }

        .returnTop {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding-bottom: 14px;
          border-bottom: 1px solid #edf0f5;
        }

        .returnNumber {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .returnTop h2 {
          margin: 5px 0 2px;
          color: ${DEEP};
          font-size: 18px;
        }

        .returnTop p {
          margin: 0;
          color: #9299a6;
          font-size: 9px;
        }

        .badges {
          display: flex;
          align-items: flex-start;
          gap: 7px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .badges span {
          padding: 7px 10px;
          border-radius: 20px;
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .typeBadge {
          background: #eef2f8;
          color: ${BLUE};
        }

        .typeBadge.refund {
          background: #fff1f1;
          color: #ba2f2f;
        }

        .typeBadge.exchange {
          background: #eef4ff;
          color: #1e58a5;
        }

        .typeBadge.store_credit {
          background: #fff7df;
          color: #8d6c04;
        }

        .statusBadge {
          background: #edf8f1;
          color: #167842;
        }

        .returnGrid {
          display: grid;
          grid-template-columns: 1fr 1fr 0.8fr;
          gap: 10px;
          padding: 14px 0;
        }

        .returnGrid > div {
          padding: 12px;
          border-radius: 13px;
          background: #f7f8fb;
        }

        .returnGrid span,
        .receiptCustomer span,
        .receiptInfo span {
          display: block;
          color: #8a91a0;
          font-size: 8px;
          font-weight: 850;
          text-transform: uppercase;
        }

        .returnGrid strong,
        .receiptCustomer strong,
        .receiptInfo strong {
          display: block;
          margin-top: 5px;
          color: ${DEEP};
          font-size: 12px;
          font-weight: 900;
        }

        .returnGrid small,
        .receiptCustomer small {
          display: block;
          margin-top: 3px;
          color: #8a91a0;
          font-size: 8px;
        }

        .returnGrid .amountBlock {
          background: linear-gradient(135deg, ${DEEP}, ${BLUE});
        }

        .returnGrid .amountBlock span {
          color: rgba(255, 255, 255, 0.62);
        }

        .returnGrid .amountBlock strong {
          color: ${GOLD};
          font-size: 18px;
        }

        .viewButton {
          min-height: 43px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 0;
          border-radius: 12px;
          padding: 0 15px;
          background: linear-gradient(135deg, ${DEEP}, ${BLUE});
          color: #ffffff;
          font: inherit;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .viewButton:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(10, 46, 115, 0.2);
        }

        .viewButton span {
          color: ${GOLD};
          font-size: 16px;
        }

        .emptyState,
        .errorBox {
          padding: 40px 20px;
          border: 1px solid #e4e8ef;
          border-radius: 18px;
          background: #ffffff;
          color: #7b8290;
          font-size: 12px;
          text-align: center;
        }

        .errorBox {
          margin-top: 14px;
          border-color: #f1cccc;
          background: #fff6f6;
          color: #a52d2d;
        }

        .modalOverlay {
          position: fixed;
          z-index: 10050;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(3, 21, 63, 0.78);
          backdrop-filter: blur(10px);
        }

        .receiptModal {
          width: min(820px, 100%);
          max-height: 94vh;
          overflow: auto;
          border: 1px solid rgba(212, 175, 55, 0.34);
          border-radius: 24px;
          background: #ffffff;
          box-shadow: 0 35px 100px rgba(0, 0, 0, 0.36);
          animation: receiptEnter 0.25s ease-out;
        }

        .receiptHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 24px;
          background:
            radial-gradient(
              circle at 88% 0%,
              rgba(212, 175, 55, 0.2),
              transparent 30%
            ),
            linear-gradient(135deg, ${DEEP}, ${BLUE});
          color: #ffffff;
        }

        .receiptHeader span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1.4px;
        }

        .receiptHeader h2 {
          margin: 6px 0 3px;
          font-size: 26px;
        }

        .receiptHeader p {
          margin: 0;
          color: rgba(255, 255, 255, 0.66);
          font-size: 10px;
        }

        .receiptHeader button {
          width: 40px;
          height: 40px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          font-size: 23px;
          cursor: pointer;
        }

        .receiptCustomer {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          padding: 18px;
        }

        .receiptCustomer > div {
          padding: 14px;
          border-radius: 14px;
          background: #f6f8fb;
        }

        .receiptCustomer .receiptTotal {
          background: linear-gradient(135deg, ${DEEP}, ${BLUE});
        }

        .receiptCustomer .receiptTotal span {
          color: rgba(255, 255, 255, 0.62);
        }

        .receiptCustomer .receiptTotal strong {
          color: ${GOLD};
          font-size: 19px;
        }

        .receiptItems {
          padding: 0 18px 18px;
        }

        .sectionTitle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 9px;
        }

        .sectionTitle span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .sectionTitle strong {
          color: ${DEEP};
          font-size: 14px;
        }

        .receiptItems article {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          align-items: center;
          padding: 13px;
          border: 1px solid #e7eaf0;
          border-radius: 14px;
          margin-bottom: 8px;
        }

        .receiptItems h3 {
          margin: 0;
          color: ${DEEP};
          font-size: 12px;
        }

        .receiptItems p {
          margin: 4px 0;
          color: #8b929f;
          font-size: 9px;
        }

        .receiptItems small {
          color: #1f8b50;
          font-size: 8px;
          font-weight: 850;
        }

        .itemAmount {
          text-align: right;
        }

        .itemAmount span {
          display: block;
          color: #8a91a0;
          font-size: 8px;
        }

        .itemAmount strong {
          display: block;
          margin-top: 4px;
          color: ${BLUE};
          font-size: 14px;
        }

        .receiptInfo {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          padding: 0 18px 18px;
        }

        .receiptInfo > div {
          padding: 12px;
          border-radius: 13px;
          background: ${IVORY};
        }

        .receiptActions {
          display: flex;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 9px;
          padding: 0 18px 18px;
        }

        .receiptActions button {
          min-height: 46px;
          border: 0;
          border-radius: 12px;
          padding: 0 16px;
          font: inherit;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .receiptActions button:hover {
          transform: translateY(-2px);
        }

        .closeAction {
          background: #e9edf4;
          color: ${CHARCOAL};
        }

        .whatsAppAction {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #1f9d55;
          color: #ffffff;
          box-shadow: 0 12px 28px rgba(31, 157, 85, 0.2);
        }

        .whatsAppAction span {
          font-size: 16px;
        }

        .printAction {
          background: linear-gradient(135deg, ${GOLD}, #f0d267);
          color: ${DEEP};
          box-shadow: 0 12px 28px rgba(212, 175, 55, 0.2);
        }

        @keyframes receiptEnter {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes statCardRise {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes statShine {
          0%,
          62% {
            left: -42%;
            opacity: 0;
          }
          68% {
            opacity: 0.8;
          }
          100% {
            left: 126%;
            opacity: 0;
          }
        }

        @media (max-width: 1050px) {
          .stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .filters {
            grid-template-columns: 1fr 1fr;
          }

          .searchBox {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 720px) {
          .returnHistoryPage {
            padding: 12px;
          }

          .hero {
            align-items: flex-start;
            flex-direction: column;
            padding: 21px;
          }

          .refreshButton {
            width: 100%;
          }

          .stats {
            grid-template-columns: 1fr 1fr;
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .searchBox {
            grid-column: auto;
          }

          .returnTop {
            flex-direction: column;
          }

          .badges {
            justify-content: flex-start;
          }

          .returnGrid {
            grid-template-columns: 1fr;
          }

          .viewButton {
            width: 100%;
          }

          .modalOverlay {
            padding: 7px;
          }

          .receiptModal {
            max-height: 97vh;
            border-radius: 19px;
          }

          .receiptCustomer,
          .receiptInfo {
            grid-template-columns: 1fr;
          }

          .receiptActions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .receiptActions button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}