"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type PurchaseRow = {
  id: string;
  purchase_number?: string | null;
  supplier_id?: number | null;
  supplier_name?: string | null;
  supplier_phone?: string | null;
  supplier_invoice_number?: string | null;
  purchase_date?: string | null;
  subtotal?: number | string | null;
  discount_amount?: number | string | null;
  tax_amount?: number | string | null;
  transport_charge?: number | string | null;
  other_charge?: number | string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  purchase_status?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  supplier_gstin?: string | null;
  supplier_state?: string | null;
  supplier_state_code?: string | null;
  place_of_supply?: string | null;
  tax_type?: string | null;
  taxable_amount?: number | string | null;
  cgst_amount?: number | string | null;
  sgst_amount?: number | string | null;
  igst_amount?: number | string | null;
  cess_amount?: number | string | null;
};

type PurchaseItemRow = {
  id: number;
  purchase_id: string;
  product_id?: number | null;
  variant_id?: number | null;
  product_name?: string | null;
  size?: string | null;
  color?: string | null;
  sku?: string | null;
  barcode?: string | null;
  quantity?: number | string | null;
  purchase_price?: number | string | null;
  selling_price?: number | string | null;
  mrp?: number | string | null;
  tax_percent?: number | string | null;
  tax_amount?: number | string | null;
  line_total?: number | string | null;
  stock_before?: number | string | null;
  stock_after?: number | string | null;
  created_at?: string | null;
  hsn_code?: string | null;
  taxable_value?: number | string | null;
  cgst_percent?: number | string | null;
  cgst_amount?: number | string | null;
  sgst_percent?: number | string | null;
  sgst_amount?: number | string | null;
  igst_percent?: number | string | null;
  igst_amount?: number | string | null;
  cess_percent?: number | string | null;
  cess_amount?: number | string | null;
};

type StatusFilter = "all" | "paid" | "partial" | "unpaid" | "due";
type DateFilter = "all" | "today" | "7days" | "30days";

const ROYAL_BLUE = "#0A2E73";
const DEEP_BLUE = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";

function toNumber(value: number | string | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function getPaymentStatus(purchase: PurchaseRow) {
  const due = toNumber(purchase.due_amount);
  const total = toNumber(purchase.total_amount);
  const paid = toNumber(purchase.paid_amount);
  const stored = normalize(purchase.payment_status);

  if (stored) return stored;
  if (due <= 0 && total > 0) return "paid";
  if (paid > 0 && due > 0) return "partial";
  return "unpaid";
}

export default function PurchaseHistoryPage() {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [itemsByPurchase, setItemsByPurchase] = useState<
    Record<string, PurchaseItemRow[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const [selectedPurchase, setSelectedPurchase] =
    useState<PurchaseRow | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [savingPayment, setSavingPayment] = useState(false);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");

    try {
      const { data: purchaseData, error: purchaseError } = await supabase
        .from("purchases")
        .select("*")
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (purchaseError) throw purchaseError;

      const { data: itemData, error: itemError } = await supabase
        .from("purchase_items")
        .select("*")
        .order("created_at", { ascending: true });

      if (itemError) throw itemError;

      const purchaseRows = (purchaseData || []) as unknown as PurchaseRow[];
      const itemRows = (itemData || []) as unknown as PurchaseItemRow[];

      const grouped: Record<string, PurchaseItemRow[]> = {};

      itemRows.forEach((item) => {
        if (!grouped[item.purchase_id]) {
          grouped[item.purchase_id] = [];
        }

        grouped[item.purchase_id].push(item);
      });

      setPurchases(purchaseRows);
      setItemsByPurchase(grouped);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load purchase history.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPurchases = useMemo(() => {
    const query = normalize(searchQuery);
    const now = new Date();

    return purchases.filter((purchase) => {
      const purchaseItems = itemsByPurchase[purchase.id] || [];
      const status = getPaymentStatus(purchase);
      const due = toNumber(purchase.due_amount);

      const matchesSearch =
        !query ||
        [
          purchase.purchase_number,
          purchase.supplier_name,
          purchase.supplier_phone,
          purchase.supplier_invoice_number,
          purchase.supplier_gstin,
          purchase.payment_method,
          ...purchaseItems.flatMap((item) => [
            item.product_name,
            item.barcode,
            item.sku,
          ]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "due" && due > 0) ||
        status === statusFilter;

      let matchesDate = true;

      if (dateFilter !== "all") {
        const dateValue = new Date(purchase.purchase_date || purchase.created_at || "");
        const diffMs = now.getTime() - dateValue.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (dateFilter === "today") {
          matchesDate =
            dateValue.toDateString() === now.toDateString();
        } else if (dateFilter === "7days") {
          matchesDate = diffDays >= 0 && diffDays <= 7;
        } else if (dateFilter === "30days") {
          matchesDate = diffDays >= 0 && diffDays <= 30;
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [dateFilter, itemsByPurchase, purchases, searchQuery, statusFilter]);

  const statistics = useMemo(() => {
    const totalPurchase = purchases.reduce(
      (sum, purchase) => sum + toNumber(purchase.total_amount),
      0,
    );

    const totalPaid = purchases.reduce(
      (sum, purchase) => sum + toNumber(purchase.paid_amount),
      0,
    );

    const totalDue = purchases.reduce(
      (sum, purchase) => sum + toNumber(purchase.due_amount),
      0,
    );

    const dueSuppliers = new Set(
      purchases
        .filter((purchase) => toNumber(purchase.due_amount) > 0)
        .map((purchase) => purchase.supplier_name || purchase.supplier_id)
        .filter(Boolean),
    ).size;

    return {
      count: purchases.length,
      totalPurchase,
      totalPaid,
      totalDue,
      dueSuppliers,
    };
  }, [purchases]);

  async function recordDuePayment() {
    if (!selectedPurchase) return;

    const currentPaid = toNumber(selectedPurchase.paid_amount);
    const currentDue = toNumber(selectedPurchase.due_amount);
    const amount = Math.max(0, Math.min(paymentAmount, currentDue));

    if (amount <= 0) {
      setNotice("Enter a valid payment amount.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    setSavingPayment(true);

    try {
      const nextPaid = currentPaid + amount;
      const nextDue = Math.max(0, currentDue - amount);
      const nextStatus = nextDue <= 0 ? "paid" : "partial";

      const { error } = await supabase
        .from("purchases")
        .update({
          paid_amount: nextPaid,
          due_amount: nextDue,
          payment_status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedPurchase.id);

      if (error) throw error;

      if (selectedPurchase.supplier_id) {
        const { data: supplierData } = await supabase
          .from("suppliers")
          .select(
            "id,total_paid_amount,current_balance,total_purchase_amount",
          )
          .eq("id", selectedPurchase.supplier_id)
          .maybeSingle();

        if (supplierData) {
          const supplierPaid = toNumber(supplierData.total_paid_amount) + amount;
          const supplierPurchase = toNumber(supplierData.total_purchase_amount);
          const supplierBalance = Math.max(0, supplierPurchase - supplierPaid);

          await supabase
            .from("suppliers")
            .update({
              total_paid_amount: supplierPaid,
              current_balance: supplierBalance,
              updated_at: new Date().toISOString(),
            })
            .eq("id", selectedPurchase.supplier_id);
        }
      }

      setShowPaymentModal(false);
      setPaymentAmount(0);
      setNotice("Supplier due payment updated successfully.");
      window.setTimeout(() => setNotice(""), 3500);
      await loadData(true);
    } catch (error) {
      console.error(error);
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update supplier payment.",
      );
      window.setTimeout(() => setNotice(""), 3500);
    } finally {
      setSavingPayment(false);
    }
  }

  function openPaymentModal(purchase: PurchaseRow) {
    setSelectedPurchase(purchase);
    setPaymentAmount(toNumber(purchase.due_amount));
    setShowPaymentModal(true);
  }

  function printPurchase(purchase: PurchaseRow) {
    const purchaseItems = itemsByPurchase[purchase.id] || [];

    const itemRows = purchaseItems
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>
              <strong>${item.product_name || "Product"}</strong>
              ${
                item.size || item.color
                  ? `<div>${[item.size, item.color]
                      .filter(Boolean)
                      .join(" • ")}</div>`
                  : ""
              }
              ${item.barcode ? `<small>${item.barcode}</small>` : ""}
            </td>
            <td>${toNumber(item.quantity)}</td>
            <td>${formatCurrency(toNumber(item.purchase_price))}</td>
            <td>${formatCurrency(toNumber(item.tax_amount))}</td>
            <td>${formatCurrency(toNumber(item.line_total))}</td>
          </tr>
        `,
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=900,height=800");

    if (!printWindow) {
      setNotice("Allow browser pop-ups to print purchase bills.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${purchase.purchase_number || "Purchase Bill"}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 24px;
              color: #222;
              font-family: Arial, sans-serif;
            }
            .header {
              display: flex;
              justify-content: space-between;
              gap: 20px;
              padding-bottom: 18px;
              border-bottom: 2px solid #0A2E73;
            }
            h1 {
              margin: 0;
              color: #0A2E73;
              font-size: 26px;
            }
            .brand {
              color: #D4AF37;
              font-weight: 900;
              letter-spacing: 1px;
            }
            .details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 14px;
              margin-top: 18px;
            }
            .box {
              padding: 14px;
              border: 1px solid #ddd;
              border-radius: 10px;
            }
            .box p {
              margin: 5px 0;
              font-size: 13px;
            }
            table {
              width: 100%;
              margin-top: 18px;
              border-collapse: collapse;
            }
            th, td {
              padding: 9px;
              border: 1px solid #ddd;
              font-size: 12px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background: #f4f6fb;
              color: #0A2E73;
            }
            .totals {
              width: 340px;
              margin: 18px 0 0 auto;
            }
            .totals p {
              display: flex;
              justify-content: space-between;
              margin: 0;
              padding: 8px 0;
              border-bottom: 1px solid #eee;
            }
            .grand {
              color: #0A2E73;
              font-size: 16px;
              font-weight: 900;
            }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">NEW CITY STYLE</div>
              <h1>Purchase Bill</h1>
            </div>
            <div>
              <strong>${purchase.purchase_number || "—"}</strong><br/>
              <span>${formatDate(purchase.purchase_date)}</span>
            </div>
          </div>

          <div class="details">
            <div class="box">
              <strong>Supplier</strong>
              <p>${purchase.supplier_name || "Not provided"}</p>
              <p>${purchase.supplier_phone || ""}</p>
              <p>${purchase.supplier_gstin || ""}</p>
            </div>
            <div class="box">
              <strong>Purchase Details</strong>
              <p>Invoice: ${purchase.supplier_invoice_number || "—"}</p>
              <p>Payment: ${purchase.payment_method || "—"}</p>
              <p>Status: ${getPaymentStatus(purchase)}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Purchase Price</th>
                <th>Tax</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          <div class="totals">
            <p><span>Subtotal</span><strong>${formatCurrency(
              toNumber(purchase.subtotal),
            )}</strong></p>
            <p><span>Tax</span><strong>${formatCurrency(
              toNumber(purchase.tax_amount),
            )}</strong></p>
            <p><span>Discount</span><strong>− ${formatCurrency(
              toNumber(purchase.discount_amount),
            )}</strong></p>
            <p><span>Transport</span><strong>${formatCurrency(
              toNumber(purchase.transport_charge),
            )}</strong></p>
            <p class="grand"><span>Total</span><strong>${formatCurrency(
              toNumber(purchase.total_amount),
            )}</strong></p>
            <p><span>Paid</span><strong>${formatCurrency(
              toNumber(purchase.paid_amount),
            )}</strong></p>
            <p><span>Due</span><strong>${formatCurrency(
              toNumber(purchase.due_amount),
            )}</strong></p>
          </div>

          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  return (
    <main className="purchaseHistoryPage">
      <section className="pageHeader">
        <div>
          <span>NEW CITY STYLE • ACCOUNTS</span>
          <h1>Purchase History & Supplier Due</h1>
          <p>
            Review every stock purchase, supplier payment and pending balance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "↻ Refresh"}
        </button>
      </section>

      {notice && <div className="notice">{notice}</div>}
      {errorMessage && <div className="error">{errorMessage}</div>}

      <section className="statsGrid">
        <article>
          <span>Total Purchases</span>
          <strong>{statistics.count}</strong>
        </article>

        <article>
          <span>Purchase Value</span>
          <strong>{formatCurrency(statistics.totalPurchase)}</strong>
        </article>

        <article>
          <span>Total Paid</span>
          <strong>{formatCurrency(statistics.totalPaid)}</strong>
        </article>

        <article>
          <span>Total Supplier Due</span>
          <strong>{formatCurrency(statistics.totalDue)}</strong>
        </article>

        <article>
          <span>Suppliers With Due</span>
          <strong>{statistics.dueSuppliers}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="toolbar">
          <div className="searchBox">
            <span>⌕</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search purchase no, supplier, invoice, product or barcode..."
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="partial">Partially Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="due">Has Due</option>
          </select>

          <select
            value={dateFilter}
            onChange={(event) =>
              setDateFilter(event.target.value as DateFilter)
            }
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
        </div>

        {loading ? (
          <div className="loadingState">
            <div className="spinner" />
            <h2>Loading purchase history...</h2>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="emptyState">
            <h2>No matching purchases</h2>
            <p>Try changing the search or filters.</p>
          </div>
        ) : (
          <div className="purchaseList">
            {filteredPurchases.map((purchase) => {
              const purchaseItems = itemsByPurchase[purchase.id] || [];
              const status = getPaymentStatus(purchase);
              const due = toNumber(purchase.due_amount);

              return (
                <article className="purchaseCard" key={purchase.id}>
                  <header>
                    <div>
                      <span>{purchase.purchase_number || "PURCHASE"}</span>
                      <h2>{purchase.supplier_name || "Unknown Supplier"}</h2>
                      <p>
                        {formatDate(purchase.purchase_date)} •{" "}
                        {purchase.supplier_phone || "No phone"}
                      </p>
                    </div>

                    <span className={`statusBadge status-${status}`}>
                      {status === "partial"
                        ? "Partially Paid"
                        : status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </header>

                  <div className="purchaseMeta">
                    <div>
                      <span>Invoice</span>
                      <strong>
                        {purchase.supplier_invoice_number || "—"}
                      </strong>
                    </div>

                    <div>
                      <span>Items</span>
                      <strong>{purchaseItems.length}</strong>
                    </div>

                    <div>
                      <span>Total</span>
                      <strong>
                        {formatCurrency(toNumber(purchase.total_amount))}
                      </strong>
                    </div>

                    <div>
                      <span>Paid</span>
                      <strong>
                        {formatCurrency(toNumber(purchase.paid_amount))}
                      </strong>
                    </div>

                    <div>
                      <span>Due</span>
                      <strong className={due > 0 ? "dueText" : ""}>
                        {formatCurrency(due)}
                      </strong>
                    </div>

                    <div>
                      <span>Payment</span>
                      <strong>{purchase.payment_method || "—"}</strong>
                    </div>
                  </div>

                  <div className="itemPreview">
                    {purchaseItems.slice(0, 4).map((item) => (
                      <div key={item.id}>
                        <strong>{item.product_name || "Product"}</strong>
                        <span>
                          Qty {toNumber(item.quantity)}
                          {item.size ? ` • ${item.size}` : ""}
                          {item.barcode ? ` • ${item.barcode}` : ""}
                        </span>
                      </div>
                    ))}

                    {purchaseItems.length > 4 && (
                      <div>
                        <strong>+{purchaseItems.length - 4} more items</strong>
                      </div>
                    )}
                  </div>

                  <footer>
                    <button
                      type="button"
                      onClick={() => setSelectedPurchase(purchase)}
                    >
                      View Details
                    </button>

                    <button
                      type="button"
                      onClick={() => printPurchase(purchase)}
                    >
                      Print Bill
                    </button>

                    {due > 0 && (
                      <button
                        type="button"
                        className="payButton"
                        onClick={() => openPaymentModal(purchase)}
                      >
                        Record Due Payment
                      </button>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedPurchase && !showPaymentModal && (
        <div className="modalOverlay">
          <section className="detailsModal">
            <button
              type="button"
              className="closeButton"
              onClick={() => setSelectedPurchase(null)}
            >
              ×
            </button>

            <span>PURCHASE DETAILS</span>
            <h2>{selectedPurchase.purchase_number}</h2>

            <div className="detailsGrid">
              <p>
                <span>Supplier</span>
                <strong>{selectedPurchase.supplier_name || "—"}</strong>
              </p>
              <p>
                <span>Date</span>
                <strong>{formatDate(selectedPurchase.purchase_date)}</strong>
              </p>
              <p>
                <span>Total</span>
                <strong>
                  {formatCurrency(toNumber(selectedPurchase.total_amount))}
                </strong>
              </p>
              <p>
                <span>Due</span>
                <strong>
                  {formatCurrency(toNumber(selectedPurchase.due_amount))}
                </strong>
              </p>
            </div>

            <div className="detailsItems">
              {(itemsByPurchase[selectedPurchase.id] || []).map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.product_name || "Product"}</strong>
                    <span>
                      {[item.size, item.color].filter(Boolean).join(" • ") ||
                        "Standard Product"}
                    </span>
                    {item.barcode && <span>{item.barcode}</span>}
                  </div>

                  <div>
                    <strong>
                      {toNumber(item.quantity)} ×{" "}
                      {formatCurrency(toNumber(item.purchase_price))}
                    </strong>
                    <span>
                      {formatCurrency(toNumber(item.line_total))}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <div className="modalActions">
              <button
                type="button"
                onClick={() => printPurchase(selectedPurchase)}
              >
                Print Purchase Bill
              </button>

              {toNumber(selectedPurchase.due_amount) > 0 && (
                <button
                  type="button"
                  onClick={() => openPaymentModal(selectedPurchase)}
                >
                  Record Due Payment
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {showPaymentModal && selectedPurchase && (
        <div className="modalOverlay">
          <section className="paymentModal">
            <button
              type="button"
              className="closeButton"
              onClick={() => {
                setShowPaymentModal(false);
                setSelectedPurchase(null);
              }}
            >
              ×
            </button>

            <span>SUPPLIER PAYMENT</span>
            <h2>{selectedPurchase.supplier_name || "Supplier"}</h2>
            <p>
              Current due:{" "}
              <strong>
                {formatCurrency(toNumber(selectedPurchase.due_amount))}
              </strong>
            </p>

            <label>
              <span>Payment Amount</span>
              <input
                type="number"
                min="0"
                max={toNumber(selectedPurchase.due_amount)}
                step="0.01"
                value={paymentAmount || ""}
                onChange={(event) =>
                  setPaymentAmount(
                    Math.max(0, toNumber(event.target.value)),
                  )
                }
              />
            </label>

            <button
              type="button"
              onClick={recordDuePayment}
              disabled={savingPayment}
            >
              {savingPayment ? "Updating..." : "Save Payment"}
            </button>
          </section>
        </div>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .purchaseHistoryPage {
          min-height: 100vh;
          padding: 26px;
          background:
            radial-gradient(
              circle at 10% 0%,
              rgba(212, 175, 55, 0.12),
              transparent 26%
            ),
            ${IVORY};
          color: #2c2c2c;
          font-family: Poppins, Inter, Arial, sans-serif;
        }

        .pageHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
          padding: 22px 24px;
          border: 1px solid rgba(212, 175, 55, 0.35);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 88% 0%,
              rgba(212, 175, 55, 0.23),
              transparent 32%
            ),
            linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: #ffffff;
          box-shadow: 0 18px 45px rgba(3, 21, 63, 0.18);
        }

        .pageHeader > div > span {
          color: ${GOLD};
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .pageHeader h1 {
          margin: 5px 0 0;
          font-size: 32px;
          font-weight: 950;
        }

        .pageHeader p {
          margin: 6px 0 0;
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
        }

        .pageHeader button {
          min-height: 44px;
          padding: 0 15px;
          border: 1px solid ${GOLD};
          border-radius: 12px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-weight: 900;
          cursor: pointer;
        }

        .notice,
        .error {
          margin-bottom: 14px;
          padding: 13px 15px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 750;
        }

        .notice {
          border: 1px solid #a6f4c5;
          background: #ecfdf3;
          color: #067647;
        }

        .error {
          border: 1px solid #fecdca;
          background: #fef3f2;
          color: #b42318;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .statsGrid article {
          position: relative;
          isolation: isolate;
          min-height: 108px;
          overflow: hidden;
          padding: 18px;
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 18px;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.99),
            rgba(3, 21, 63, 0.98)
          );
          box-shadow:
            0 12px 28px rgba(3, 21, 63, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          transition:
            transform 0.22s ease,
            box-shadow 0.22s ease,
            border-color 0.22s ease;
          animation: purchaseStatRise 0.45s ease both;
        }

        .statsGrid article:nth-child(1) {
          animation-delay: 0.04s;
        }

        .statsGrid article:nth-child(2) {
          animation-delay: 0.09s;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.99),
            rgba(18, 44, 101, 0.98),
            rgba(103, 79, 16, 0.9)
          );
        }

        .statsGrid article:nth-child(3) {
          animation-delay: 0.14s;
        }

        .statsGrid article:nth-child(4) {
          animation-delay: 0.19s;
          background: linear-gradient(
            135deg,
            rgba(8, 37, 98, 0.99),
            rgba(3, 21, 63, 0.98),
            rgba(95, 72, 13, 0.9)
          );
        }

        .statsGrid article:nth-child(5) {
          animation-delay: 0.24s;
        }

        .statsGrid article::before {
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

        .statsGrid article::after {
          content: "";
          position: absolute;
          top: -145%;
          left: -36%;
          width: 42%;
          height: 370%;
          transform: rotate(22deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.14),
            transparent
          );
          animation: purchaseStatShine 5.2s ease-in-out infinite;
          pointer-events: none;
        }

        .statsGrid article:nth-child(2)::after {
          animation-delay: 0.7s;
        }

        .statsGrid article:nth-child(3)::after {
          animation-delay: 1.4s;
        }

        .statsGrid article:nth-child(4)::after {
          animation-delay: 2.1s;
        }

        .statsGrid article:nth-child(5)::after {
          animation-delay: 2.8s;
        }

        .statsGrid article:hover {
          transform: translateY(-2px) scale(1.004);
          border-color: rgba(212, 175, 55, 0.42);
          box-shadow:
            0 16px 32px rgba(3, 21, 63, 0.22),
            0 0 0 1px rgba(212, 175, 55, 0.1);
        }

        .statsGrid article:hover::before {
          transform: scale(1.08);
        }

        .statsGrid span {
          position: relative;
          z-index: 2;
          display: block;
          color: rgba(212, 175, 55, 0.94);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.55px;
          text-transform: uppercase;
        }

        .statsGrid strong {
          position: relative;
          z-index: 2;
          display: block;
          margin-top: 9px;
          color: #ffffff;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -0.45px;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
        }

        .statsGrid article:nth-child(2) strong,
        .statsGrid article:nth-child(4) strong {
          color: #f6d676;
        }

        .panel {
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 20px;
          background: white;
          box-shadow: 0 12px 32px rgba(10, 46, 115, 0.07);
        }

        .toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 190px 190px;
          gap: 10px;
          padding: 16px;
          border-bottom: 1px solid #edf0f4;
        }

        .searchBox {
          display: flex;
          align-items: center;
          min-height: 46px;
          padding: 0 12px;
          border: 1px solid #dfe4eb;
          border-radius: 11px;
          background: #fbfcfe;
        }

        .searchBox span {
          margin-right: 8px;
          color: ${ROYAL_BLUE};
          font-size: 21px;
        }

        .searchBox input,
        .toolbar select,
        .paymentModal input {
          width: 100%;
          min-height: 43px;
          padding: 0 10px;
          border: 1px solid #dfe4eb;
          border-radius: 10px;
          outline: none;
          background: white;
          font: inherit;
          font-size: 11px;
          font-weight: 700;
        }

        .searchBox input {
          min-height: auto;
          padding: 0;
          border: 0;
          background: transparent;
        }

        .purchaseList {
          display: grid;
          gap: 13px;
          padding: 15px;
          background: #f8fafc;
        }

        .purchaseCard {
          padding: 16px;
          border: 1px solid #e4e7ec;
          border-radius: 16px;
          background: white;
          box-shadow: 0 6px 18px rgba(16, 24, 40, 0.05);
        }

        .purchaseCard header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .purchaseCard header > div > span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .purchaseCard h2 {
          margin: 4px 0 0;
          color: ${DEEP_BLUE};
          font-size: 17px;
        }

        .purchaseCard header p {
          margin: 5px 0 0;
          color: #8a93a0;
          font-size: 10px;
        }

        .statusBadge {
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 850;
        }

        .status-paid {
          background: #ecfdf3;
          color: #067647;
        }

        .status-partial {
          background: #fff4e8;
          color: #b54708;
        }

        .status-unpaid {
          background: #fef3f2;
          color: #b42318;
        }

        .purchaseMeta {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 9px;
          margin-top: 14px;
        }

        .purchaseMeta > div {
          padding: 10px;
          border-radius: 10px;
          background: #f8fafc;
        }

        .purchaseMeta span,
        .purchaseMeta strong {
          display: block;
        }

        .purchaseMeta span {
          color: #98a2b3;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .purchaseMeta strong {
          margin-top: 4px;
          color: #344054;
          font-size: 10px;
        }

        .dueText {
          color: #b42318 !important;
        }

        .itemPreview {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-top: 12px;
        }

        .itemPreview > div {
          min-width: 0;
          padding: 10px;
          border: 1px solid #e4e7ec;
          border-radius: 10px;
        }

        .itemPreview strong,
        .itemPreview span {
          display: block;
        }

        .itemPreview strong {
          overflow: hidden;
          color: ${ROYAL_BLUE};
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .itemPreview span {
          margin-top: 4px;
          color: #8a93a0;
          font-size: 8px;
        }

        .purchaseCard footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 13px;
        }

        .purchaseCard footer button,
        .modalActions button,
        .paymentModal > button:last-child {
          min-height: 38px;
          padding: 0 12px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: white;
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 850;
          cursor: pointer;
        }

        .purchaseCard footer .payButton {
          border-color: ${GOLD};
          background: ${ROYAL_BLUE};
          color: white;
        }

        .loadingState,
        .emptyState {
          min-height: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          text-align: center;
        }

        .spinner {
          width: 43px;
          height: 43px;
          border: 4px solid #e6eaf0;
          border-top-color: ${ROYAL_BLUE};
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loadingState h2,
        .emptyState h2 {
          margin: 14px 0 0;
          color: ${ROYAL_BLUE};
          font-size: 19px;
        }

        .modalOverlay {
          position: fixed;
          z-index: 1000;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(3, 21, 63, 0.68);
        }

        .detailsModal,
        .paymentModal {
          position: relative;
          width: min(760px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          padding: 24px;
          border: 1px solid rgba(212, 175, 55, 0.4);
          border-radius: 20px;
          background: white;
          box-shadow: 0 28px 70px rgba(3, 21, 63, 0.28);
        }

        .paymentModal {
          width: min(440px, 100%);
        }

        .detailsModal > span,
        .paymentModal > span {
          color: ${GOLD};
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .detailsModal h2,
        .paymentModal h2 {
          margin: 7px 0 0;
          color: ${ROYAL_BLUE};
        }

        .closeButton {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 34px;
          height: 34px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: white;
          font-size: 20px;
          cursor: pointer;
        }

        .detailsGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 9px;
          margin-top: 16px;
        }

        .detailsGrid p {
          margin: 0;
          padding: 10px;
          border-radius: 10px;
          background: #f8fafc;
        }

        .detailsGrid span,
        .detailsGrid strong {
          display: block;
        }

        .detailsGrid span {
          color: #98a2b3;
          font-size: 8px;
          font-weight: 800;
        }

        .detailsGrid strong {
          margin-top: 4px;
          color: #344054;
          font-size: 10px;
        }

        .detailsItems {
          display: grid;
          gap: 8px;
          margin-top: 15px;
        }

        .detailsItems article {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 11px;
          border: 1px solid #e4e7ec;
          border-radius: 10px;
        }

        .detailsItems strong,
        .detailsItems span {
          display: block;
        }

        .detailsItems strong {
          color: ${ROYAL_BLUE};
          font-size: 10px;
        }

        .detailsItems span {
          margin-top: 3px;
          color: #8a93a0;
          font-size: 8px;
        }

        .modalActions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 16px;
        }

        .paymentModal p {
          color: #667085;
          font-size: 12px;
        }

        .paymentModal label {
          display: grid;
          gap: 6px;
          margin-top: 15px;
        }

        .paymentModal label span {
          color: #667085;
          font-size: 10px;
          font-weight: 800;
        }

        .paymentModal > button:last-child {
          width: 100%;
          margin-top: 14px;
          border-color: ${GOLD};
          background: ${ROYAL_BLUE};
          color: white;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes purchaseStatRise {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes purchaseStatShine {
          0%,
          62% {
            left: -42%;
            opacity: 0;
          }
          68% {
            opacity: 0.7;
          }
          100% {
            left: 126%;
            opacity: 0;
          }
        }

        @media (max-width: 1100px) {
          .statsGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .purchaseMeta {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .itemPreview {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .purchaseHistoryPage {
            padding: 16px 10px 40px;
          }

          .pageHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .pageHeader button {
            width: 100%;
          }

          .statsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .toolbar {
            grid-template-columns: 1fr;
          }

          .purchaseMeta {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .detailsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .purchaseCard footer,
          .modalActions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .purchaseMeta,
          .itemPreview,
          .detailsGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}