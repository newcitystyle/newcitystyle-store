"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type SupplierRow = {
  id: number;
  supplier_name: string;
  phone?: string | null;
  gst_number?: string | null;
  state?: string | null;
  state_code?: string | null;
  place_of_supply?: string | null;
  current_balance?: number | string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PurchaseRow = {
  id: string;
  purchase_number?: string | null;
  supplier_id?: number | null;
  supplier_name?: string | null;
  supplier_phone?: string | null;
  supplier_invoice_number?: string | null;
  purchase_date?: string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  purchase_status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
};

type SupplierPaymentRow = {
  id: string | number;
  supplier_id?: number | null;
  purchase_id?: string | null;
  amount?: number | string | null;
  payment_method?: string | null;
  method?: string | null;
  payment_reference?: string | null;
  reference_number?: string | null;
  reference?: string | null;
  payment_date?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type SupplierSummary = {
  supplier: SupplierRow;
  purchases: PurchaseRow[];
  payments: SupplierPaymentRow[];
  totalPurchase: number;
  purchasePaid: number;
  purchaseDue: number;
  recordedPayments: number;
  totalPaid: number;
  currentBalance: number;
  lastPurchaseAt: string | null;
};

type LedgerTab = "purchases" | "payments";
type DueFilter = "all" | "due" | "clear";

const ROYAL_BLUE = "#0A2E73";
const DEEP_BLUE = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";
const CHARCOAL = "#2C2C2C";
const GREEN = "#067647";
const RED = "#B42318";

function toNumber(
  value: number | string | null | undefined,
  fallback = 0,
) {
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

function getPaymentAmount(payment: SupplierPaymentRow) {
  return Math.max(0, toNumber(payment.amount));
}

function getPaymentMethod(payment: SupplierPaymentRow) {
  return (
    payment.payment_method?.trim() ||
    payment.method?.trim() ||
    "other"
  );
}

function getPaymentReference(payment: SupplierPaymentRow) {
  return (
    payment.payment_reference?.trim() ||
    payment.reference_number?.trim() ||
    payment.reference?.trim() ||
    ""
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [payments, setPayments] = useState<SupplierPaymentRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [paymentHistoryWarning, setPaymentHistoryWarning] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [selectedSupplierId, setSelectedSupplierId] =
    useState<number | null>(null);
  const [ledgerTab, setLedgerTab] =
    useState<LedgerTab>("purchases");

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [whatsAppSendingSupplierId, setWhatsAppSendingSupplierId] =
    useState<number | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }, []);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setLoadError("");

    try {
      const [supplierResponse, purchaseResponse] =
        await Promise.all([
          supabase
            .from("suppliers")
            .select("*")
            .order("supplier_name", { ascending: true }),
          supabase
            .from("purchases")
            .select("*")
            .order("purchase_date", { ascending: false })
            .order("created_at", { ascending: false }),
        ]);

      if (supplierResponse.error) throw supplierResponse.error;
      if (purchaseResponse.error) throw purchaseResponse.error;

      const safeSuppliers =
        (supplierResponse.data || []) as unknown as SupplierRow[];

      const safePurchases = (
        (purchaseResponse.data || []) as unknown as PurchaseRow[]
      ).filter((purchase) => !purchase.deleted_at);

      setSuppliers(
        safeSuppliers.filter(
          (supplier) => supplier.is_active !== false,
        ),
      );
      setPurchases(safePurchases);

      const paymentResponse = await supabase
        .from("supplier_payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (paymentResponse.error) {
        console.warn(
          "supplier_payments table could not be loaded:",
          paymentResponse.error.message,
        );
        setPayments([]);
        setPaymentHistoryWarning(
          `Supplier payment history could not be loaded: ${paymentResponse.error.message}`,
        );
      } else {
        setPaymentHistoryWarning("");
        setPayments(
          (paymentResponse.data || []) as unknown as SupplierPaymentRow[],
        );
      }
    } catch (error) {
      console.error(error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load supplier ledgers.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const supplierSummaries = useMemo<SupplierSummary[]>(() => {
    return suppliers.map((supplier) => {
      const supplierPurchases = purchases.filter(
        (purchase) => purchase.supplier_id === supplier.id,
      );

      const supplierPayments = payments.filter(
        (payment) => payment.supplier_id === supplier.id,
      );

      const totalPurchase = supplierPurchases.reduce(
        (sum, purchase) =>
          sum + toNumber(purchase.total_amount),
        0,
      );

      const purchasePaid = supplierPurchases.reduce(
        (sum, purchase) =>
          sum + toNumber(purchase.paid_amount),
        0,
      );

      const purchaseDue = supplierPurchases.reduce(
        (sum, purchase) =>
          sum + toNumber(purchase.due_amount),
        0,
      );

      const recordedPayments = supplierPayments.reduce(
        (sum, payment) =>
          sum + getPaymentAmount(payment),
        0,
      );

      const hasStoredBalance =
        supplier.current_balance !== null &&
        supplier.current_balance !== undefined &&
        String(supplier.current_balance).trim() !== "";

      const storedBalance = Math.max(
        0,
        toNumber(supplier.current_balance),
      );

      // IMPORTANT:
      // If current_balance exists, even a ZERO balance is authoritative.
      // Do not fall back to stale purchase due rows after a supplier is fully paid.
      const currentBalance =
        hasStoredBalance ? storedBalance : purchaseDue;

      // This is the real paid total for the supplier account.
      // It stays correct even when older payment-history rows were not recorded.
      const balanceDerivedPaid = Math.max(
        0,
        Math.min(totalPurchase, totalPurchase - currentBalance),
      );

      const totalPaid = Math.max(
        purchasePaid,
        recordedPayments,
        balanceDerivedPaid,
      );

      const lastPurchaseAt =
        supplierPurchases[0]?.purchase_date ||
        supplierPurchases[0]?.created_at ||
        null;

      return {
        supplier,
        purchases: supplierPurchases,
        payments: supplierPayments,
        totalPurchase,
        purchasePaid,
        purchaseDue,
        recordedPayments,
        totalPaid,
        currentBalance,
        lastPurchaseAt,
      };
    });
  }, [payments, purchases, suppliers]);

  const filteredSuppliers = useMemo(() => {
    const query = normalize(searchQuery);

    return supplierSummaries.filter((summary) => {
      const matchesSearch =
        !query ||
        [
          summary.supplier.supplier_name,
          summary.supplier.phone,
          summary.supplier.gst_number,
          summary.supplier.state,
          summary.supplier.place_of_supply,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesDue =
        dueFilter === "all" ||
        (dueFilter === "due" &&
          summary.currentBalance > 0) ||
        (dueFilter === "clear" &&
          summary.currentBalance <= 0);

      return matchesSearch && matchesDue;
    });
  }, [dueFilter, searchQuery, supplierSummaries]);

  const selectedSummary = useMemo(
    () =>
      supplierSummaries.find(
        (summary) =>
          summary.supplier.id === selectedSupplierId,
      ) || null,
    [selectedSupplierId, supplierSummaries],
  );

  const statistics = useMemo(() => {
    const totalPurchase = supplierSummaries.reduce(
      (sum, summary) => sum + summary.totalPurchase,
      0,
    );

    const totalPaid = supplierSummaries.reduce(
      (sum, summary) => sum + summary.totalPaid,
      0,
    );

    const totalDue = supplierSummaries.reduce(
      (sum, summary) => sum + summary.currentBalance,
      0,
    );

    const dueSuppliers = supplierSummaries.filter(
      (summary) => summary.currentBalance > 0,
    ).length;

    return {
      supplierCount: supplierSummaries.length,
      totalPurchase,
      totalPaid,
      totalDue,
      dueSuppliers,
    };
  }, [supplierSummaries]);

  function openSupplier(summary: SupplierSummary) {
    setSelectedSupplierId(summary.supplier.id);
    setLedgerTab("purchases");
  }

  function openPayment(summary: SupplierSummary) {
    setSelectedSupplierId(summary.supplier.id);
    setPaymentAmount(summary.currentBalance);
    setPaymentMethod("cash");
    setPaymentReference("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentNotes("");
    setShowPaymentModal(true);
  }

  async function sendSupplierStatement(
    summary: SupplierSummary,
  ) {
    if (whatsAppSendingSupplierId !== null) return;

    const supplier = summary.supplier;
    const digits = (supplier.phone || "").replace(/\D/g, "");
    const recipientPhone =
      digits.length === 10 ? `91${digits}` : digits;

    if (
      recipientPhone.length < 10 ||
      recipientPhone.length > 15
    ) {
      showNotice(
        "Add a valid supplier mobile number before sending WhatsApp PDF.",
      );
      return;
    }

    setWhatsAppSendingSupplierId(supplier.id);

    try {
      const now = new Date();
      const statementNumber = `SUP-${supplier.id}-${now
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "")}`;

      const purchaseItems =
        summary.purchases.length > 0
          ? summary.purchases.slice(0, 40).map((purchase) => ({
              name:
                purchase.purchase_number ||
                purchase.supplier_invoice_number ||
                "Supplier Purchase",
              quantity: 1,
              mrp: Math.max(
                0,
                toNumber(purchase.total_amount),
              ),
              price: Math.max(
                0,
                toNumber(purchase.total_amount),
              ),
              total: Math.max(
                0,
                toNumber(purchase.total_amount),
              ),
              size: formatDate(
                purchase.purchase_date ||
                  purchase.created_at,
              ),
              color:
                toNumber(purchase.due_amount) > 0
                  ? `Due ${formatCurrency(
                      toNumber(purchase.due_amount),
                    )}`
                  : "Paid",
            }))
          : [
              {
                name: "Outstanding Supplier Balance",
                quantity: 1,
                mrp: summary.currentBalance,
                price: summary.currentBalance,
                total: summary.currentBalance,
                size: "",
                color: "",
              },
            ];

      const response = await fetch(
        "/api/whatsapp/invoice",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: recipientPhone,
            sendWhatsApp: true,
            customerName: supplier.supplier_name,
            customerPhone: supplier.phone || "",
            billNumber: statementNumber,
            billDate: now.toLocaleString("en-IN"),
            paymentMethod: "SUPPLIER PAYABLE",
            subtotal: summary.totalPurchase,
            discountAmount: 0,
            taxAmount: 0,
            roundOff: 0,
            billAmount: summary.totalPurchase,
            paidAmount: summary.totalPaid,
            dueAmount: summary.currentBalance,
            items: purchaseItems,
          }),
        },
      );

      const result = (await response.json()) as {
        success?: boolean;
        whatsappPdfSent?: boolean;
        error?: string;
        stage?: string;
        errorDetails?: string | null;
      };

      if (
        !response.ok ||
        result.success !== true ||
        result.whatsappPdfSent !== true
      ) {
        const stageText = result.stage
          ? ` (${result.stage})`
          : "";
        const detailText = result.errorDetails
          ? ` - ${result.errorDetails}`
          : "";

        throw new Error(
          `${
            result.error ||
            "Supplier WhatsApp PDF could not be sent."
          }${stageText}${detailText}`,
        );
      }

      showNotice(
        `WhatsApp PDF sent directly to ${supplier.supplier_name}.`,
      );
    } catch (error) {
      console.error(
        "Unable to send supplier WhatsApp PDF:",
        error,
      );
      showNotice(
        error instanceof Error
          ? error.message
          : "Unable to send supplier WhatsApp PDF.",
      );
    } finally {
      setWhatsAppSendingSupplierId(null);
    }
  }

  async function recordPayment(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedSummary || savingPayment) return;

    const due = selectedSummary.currentBalance;
    const amount = Math.max(
      0,
      Math.min(paymentAmount, due),
    );

    if (amount <= 0) {
      showNotice("Enter a valid payment amount.");
      return;
    }

    setSavingPayment(true);

    try {
      const supplierId = selectedSummary.supplier.id;
      const normalizedPaymentDate = paymentDate || new Date().toISOString().slice(0, 10);

      // First keep the existing trusted RPC as the source of truth for
      // supplier balance / due reduction.
      const { data, error } = await supabase.rpc(
        "ncs_record_supplier_payment_v2",
        {
          p_supplier_id: supplierId,
          p_amount: amount,
          p_payment_method: paymentMethod,
          p_payment_reference:
            paymentReference.trim() || null,
          p_payment_date: normalizedPaymentDate,
          p_notes: paymentNotes.trim() || null,
          p_purchase_id: null,
        },
      );

      if (error) throw error;

      const result = (data || {}) as {
        message?: string;
      };

      // Older versions of the RPC reduced the supplier balance but did not
      // always create a supplier_payments history row. Verify that a matching
      // row now exists; if not, save a history-only row without changing the
      // balance a second time.
      const { data: latestPayments, error: latestPaymentsError } =
        await supabase
          .from("supplier_payments")
          .select("*")
          .eq("supplier_id", supplierId)
          .order("created_at", { ascending: false })
          .limit(25);

      let historySaved = false;

      if (!latestPaymentsError) {
        const rows =
          (latestPayments || []) as unknown as SupplierPaymentRow[];

        historySaved = rows.some((row) => {
          const rowAmount = getPaymentAmount(row);
          const rowDate = (
            row.payment_date ||
            row.created_at ||
            ""
          ).slice(0, 10);

          return (
            Math.abs(rowAmount - amount) < 0.01 &&
            rowDate === normalizedPaymentDate
          );
        });
      }

      if (!historySaved) {
        // Try the column names used by the current page first.
        const primaryPayload = {
          supplier_id: supplierId,
          purchase_id: null,
          amount,
          payment_method: paymentMethod,
          payment_reference:
            paymentReference.trim() || null,
          payment_date: normalizedPaymentDate,
          notes: paymentNotes.trim() || null,
        };

        let historyInsert = await supabase
          .from("supplier_payments")
          .insert(primaryPayload)
          .select()
          .maybeSingle();

        // Compatibility fallback for older supplier_payments schemas.
        if (historyInsert.error) {
          const legacyPayload = {
            supplier_id: supplierId,
            purchase_id: null,
            amount,
            method: paymentMethod,
            reference:
              paymentReference.trim() || null,
            payment_date: normalizedPaymentDate,
            notes: paymentNotes.trim() || null,
          };

          historyInsert = await supabase
            .from("supplier_payments")
            .insert(legacyPayload)
            .select()
            .maybeSingle();
        }

        if (historyInsert.error) {
          console.warn(
            "Supplier balance was updated, but payment history row could not be saved:",
            historyInsert.error.message,
          );

          setPaymentHistoryWarning(
            `Payment applied, but history row could not be saved: ${historyInsert.error.message}`,
          );
        } else {
          setPaymentHistoryWarning("");
          historySaved = true;
        }
      }

      setShowPaymentModal(false);
      setPaymentAmount(0);
      setPaymentReference("");
      setPaymentNotes("");
      setLedgerTab("payments");

      showNotice(
        historySaved
          ? result.message ||
              "Supplier payment saved and added to payment history."
          : "Supplier payment applied. Please check the payment-history warning.",
      );

      await loadData(true);
    } catch (error) {
      console.error(error);
      showNotice(
        error instanceof Error
          ? error.message
          : "Unable to save supplier payment.",
      );
    } finally {
      setSavingPayment(false);
    }
  }

  return (
    <main className="suppliersPage">
      {notice && <div className="notice">{notice}</div>}
      {loadError && <div className="error">{loadError}</div>}
      {paymentHistoryWarning && (
        <div className="historyWarning">{paymentHistoryWarning}</div>
      )}

      <section className="pageHero">
        <div>
          <span>NEW CITY STYLE • SUPPLIER ACCOUNTS</span>
          <h1>Suppliers & Ledgers</h1>
          <p>
            Review supplier purchases, balances, payments and
            complete account history in one place.
          </p>
        </div>

        <div className="heroActions">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>

          <a href="/admin/purchases">
            + New Purchase
          </a>
        </div>
      </section>

      <section className="statsGrid">
        <article>
          <span>Suppliers</span>
          <strong>{statistics.supplierCount}</strong>
        </article>

        <article>
          <span>Total Purchase</span>
          <strong>
            {formatCurrency(statistics.totalPurchase)}
          </strong>
        </article>

        <article>
          <span>Total Paid</span>
          <strong>{formatCurrency(statistics.totalPaid)}</strong>
        </article>

        <article>
          <span>Total Due</span>
          <strong>{formatCurrency(statistics.totalDue)}</strong>
        </article>

        <article>
          <span>Suppliers With Due</span>
          <strong>{statistics.dueSuppliers}</strong>
        </article>
      </section>

      <section className="mainPanel">
        <div className="toolbar">
          <div className="searchBox">
            <span>⌕</span>
            <input
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="Search supplier, mobile, GSTIN or state..."
            />
          </div>

          <select
            value={dueFilter}
            onChange={(event) =>
              setDueFilter(
                event.target.value as DueFilter,
              )
            }
          >
            <option value="all">All Suppliers</option>
            <option value="due">Has Due</option>
            <option value="clear">Clear Balance</option>
          </select>
        </div>

        {loading ? (
          <div className="stateBox">
            <div className="spinner" />
            <h2>Loading suppliers...</h2>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="stateBox">
            <h2>No matching suppliers</h2>
            <p>
              Add a purchase or change the current search.
            </p>
          </div>
        ) : (
          <div className="supplierGrid">
            {filteredSuppliers.map((summary) => {
              const supplier = summary.supplier;

              return (
                <article
                  className="supplierCard"
                  key={supplier.id}
                >
                  <header>
                    <div className="supplierAvatar">
                      {supplier.supplier_name
                        .trim()
                        .slice(0, 1)
                        .toUpperCase() || "S"}
                    </div>

                    <div className="supplierIdentity">
                      <h2>{supplier.supplier_name}</h2>
                      <p>
                        {supplier.phone || "Mobile not added"}
                      </p>
                      <small>
                        {supplier.gst_number ||
                          "GSTIN not added"}
                      </small>
                    </div>

                    <span
                      className={
                        summary.currentBalance > 0
                          ? "balanceBadge due"
                          : "balanceBadge clear"
                      }
                    >
                      {summary.currentBalance > 0
                        ? "DUE"
                        : "CLEAR"}
                    </span>
                  </header>

                  <div className="supplierNumbers">
                    <div>
                      <span>Purchases</span>
                      <strong>
                        {summary.purchases.length}
                      </strong>
                    </div>

                    <div>
                      <span>Total Purchase</span>
                      <strong>
                        {formatCurrency(
                          summary.totalPurchase,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Total Paid</span>
                      <strong>
                        {formatCurrency(
                          summary.totalPaid,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Current Due</span>
                      <strong
                        className={
                          summary.currentBalance > 0
                            ? "dueText"
                            : ""
                        }
                      >
                        {formatCurrency(
                          summary.currentBalance,
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="supplierMeta">
                    <span>
                      {supplier.state ||
                        "State not added"}
                    </span>
                    <span>
                      Last purchase:{" "}
                      {formatDate(summary.lastPurchaseAt)}
                    </span>
                  </div>

                  <footer>
                    <button
                      type="button"
                      onClick={() => openSupplier(summary)}
                    >
                      View Ledger
                    </button>

                    {summary.currentBalance > 0 && (
                      <button
                        type="button"
                        className="payButton"
                        onClick={() => openPayment(summary)}
                      >
                        Pay Supplier
                      </button>
                    )}

                    <button
                      type="button"
                      className="whatsAppButton"
                      disabled={
                        whatsAppSendingSupplierId === supplier.id
                      }
                      onClick={() =>
                        void sendSupplierStatement(summary)
                      }
                    >
                      {whatsAppSendingSupplierId === supplier.id
                        ? "Sending..."
                        : "💬 WhatsApp"}
                    </button>

                    <a href="/admin/purchases">
                      Add Purchase
                    </a>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedSummary && !showPaymentModal && (
        <div className="modalOverlay">
          <section className="ledgerModal">
            <button
              type="button"
              className="closeButton"
              onClick={() => setSelectedSupplierId(null)}
              aria-label="Close supplier ledger"
            >
              ✕
            </button>

            <span>SUPPLIER LEDGER</span>
            <h2>
              {selectedSummary.supplier.supplier_name}
            </h2>
            <p className="ledgerSubtitle">
              {selectedSummary.supplier.phone ||
                "Mobile not added"}{" "}
              •{" "}
              {selectedSummary.supplier.gst_number ||
                "GSTIN not added"}
            </p>

            <div className="ledgerStats">
              <div>
                <span>Total Purchase</span>
                <strong>
                  {formatCurrency(
                    selectedSummary.totalPurchase,
                  )}
                </strong>
              </div>

              <div>
                <span>Total Paid</span>
                <strong>
                  {formatCurrency(
                    selectedSummary.totalPaid,
                  )}
                </strong>
              </div>

              <div>
                <span>Current Due</span>
                <strong className="dueText">
                  {formatCurrency(
                    selectedSummary.currentBalance,
                  )}
                </strong>
              </div>

              <div>
                <span>Recorded Payments</span>
                <strong>
                  {formatCurrency(
                    selectedSummary.recordedPayments,
                  )}
                </strong>
              </div>
            </div>

            <div className="ledgerTabs">
              <button
                type="button"
                className={
                  ledgerTab === "purchases"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setLedgerTab("purchases")
                }
              >
                Purchases
              </button>

              <button
                type="button"
                className={
                  ledgerTab === "payments"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setLedgerTab("payments")
                }
              >
                Payments
              </button>
            </div>

            {ledgerTab === "purchases" ? (
              <div className="ledgerList">
                {selectedSummary.purchases.length === 0 ? (
                  <div className="emptyLedger">
                    No purchases found.
                  </div>
                ) : (
                  selectedSummary.purchases.map(
                    (purchase) => (
                      <article
                        key={purchase.id}
                        className="ledgerRow"
                      >
                        <div>
                          <strong>
                            {purchase.purchase_number ||
                              "Purchase"}
                          </strong>
                          <span>
                            {formatDate(
                              purchase.purchase_date ||
                                purchase.created_at,
                            )}
                          </span>
                          <small>
                            Invoice:{" "}
                            {purchase.supplier_invoice_number ||
                              "—"}
                          </small>
                        </div>

                        <div className="ledgerAmounts">
                          <p>
                            <span>Total</span>
                            <strong>
                              {formatCurrency(
                                toNumber(
                                  purchase.total_amount,
                                ),
                              )}
                            </strong>
                          </p>

                          <p>
                            <span>Paid</span>
                            <strong>
                              {formatCurrency(
                                toNumber(
                                  purchase.paid_amount,
                                ),
                              )}
                            </strong>
                          </p>

                          <p>
                            <span>Due</span>
                            <strong className="dueText">
                              {formatCurrency(
                                toNumber(
                                  purchase.due_amount,
                                ),
                              )}
                            </strong>
                          </p>
                        </div>
                      </article>
                    ),
                  )
                )}
              </div>
            ) : (
              <div className="ledgerList">
                {selectedSummary.payments.length === 0 ? (
                  <div className="emptyLedger">
                    No supplier payment history rows found yet.
                    New Pay Supplier entries will be saved here.
                  </div>
                ) : (
                  selectedSummary.payments.map(
                    (payment) => (
                      <article
                        key={payment.id}
                        className="ledgerRow"
                      >
                        <div>
                          <strong>
                            Supplier Payment
                          </strong>
                          <span>
                            {formatDate(
                              payment.payment_date ||
                                payment.created_at,
                            )}
                          </span>
                          <small>
                            {getPaymentMethod(payment)}
                            {getPaymentReference(payment)
                              ? ` • ${getPaymentReference(payment)}`
                              : ""}
                          </small>
                        </div>

                        <div className="paymentValue">
                          {formatCurrency(
                            getPaymentAmount(payment),
                          )}
                        </div>
                      </article>
                    ),
                  )
                )}
              </div>
            )}

            <div className="ledgerActions">
              <a href="/admin/purchases">
                + New Purchase
              </a>

              {selectedSummary.currentBalance > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    openPayment(selectedSummary)
                  }
                >
                  Pay Supplier
                </button>
              )}

              <button
                type="button"
                className="whatsAppButton"
                disabled={
                  whatsAppSendingSupplierId ===
                  selectedSummary.supplier.id
                }
                onClick={() =>
                  void sendSupplierStatement(selectedSummary)
                }
              >
                {whatsAppSendingSupplierId ===
                selectedSummary.supplier.id
                  ? "Sending..."
                  : "💬 WhatsApp PDF"}
              </button>

              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setSelectedSupplierId(null)
                }
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      {showPaymentModal && selectedSummary && (
        <div className="modalOverlay">
          <form
            className="paymentModal"
            onSubmit={recordPayment}
          >
            <button
              type="button"
              className="closeButton"
              onClick={() => {
                setShowPaymentModal(false);
              }}
              aria-label="Close payment form"
            >
              ✕
            </button>

            <span>SUPPLIER PAYMENT</span>
            <h2>
              {selectedSummary.supplier.supplier_name}
            </h2>
            <p>
              Current balance:{" "}
              <strong>
                {formatCurrency(
                  selectedSummary.currentBalance,
                )}
              </strong>
            </p>

            <label>
              <span>Payment Amount *</span>
              <input
                type="number"
                min="0.01"
                max={selectedSummary.currentBalance}
                step="0.01"
                value={paymentAmount || ""}
                onChange={(event) =>
                  setPaymentAmount(
                    Math.max(
                      0,
                      toNumber(event.target.value),
                    ),
                  )
                }
              />
            </label>

            <div className="paymentGrid">
              <label>
                <span>Method</span>
                <select
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value)
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">
                    Bank Transfer
                  </option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                <span>Payment Date</span>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(event) =>
                    setPaymentDate(event.target.value)
                  }
                />
              </label>
            </div>

            <label>
              <span>Reference</span>
              <input
                value={paymentReference}
                onChange={(event) =>
                  setPaymentReference(event.target.value)
                }
                placeholder="UPI / bank reference"
              />
            </label>

            <label>
              <span>Notes</span>
              <textarea
                value={paymentNotes}
                onChange={(event) =>
                  setPaymentNotes(event.target.value)
                }
                placeholder="Optional payment notes"
              />
            </label>

            <button
              type="submit"
              className="savePaymentButton"
              disabled={savingPayment}
            >
              {savingPayment
                ? "Saving Payment..."
                : "Save Supplier Payment"}
            </button>
          </form>
        </div>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .suppliersPage {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(
              circle at 8% 0%,
              rgba(212, 175, 55, 0.13),
              transparent 25%
            ),
            ${IVORY};
          color: ${CHARCOAL};
          font-family: Poppins, Inter, Arial, sans-serif;
        }

        .pageHero {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
          padding: 22px 24px;
          border: 1px solid rgba(212, 175, 55, 0.38);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 90% 0%,
              rgba(212, 175, 55, 0.25),
              transparent 32%
            ),
            linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: #ffffff;
          box-shadow: 0 18px 45px rgba(3, 21, 63, 0.18);
        }

        .pageHero > div > span,
        .ledgerModal > span,
        .paymentModal > span {
          color: ${GOLD};
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 1.25px;
        }

        .pageHero h1 {
          margin: 5px 0 0;
          font-size: 32px;
          font-weight: 950;
        }

        .pageHero p {
          max-width: 720px;
          margin: 7px 0 0;
          color: rgba(255, 255, 255, 0.72);
          font-size: 12px;
          line-height: 1.6;
        }

        .heroActions {
          display: flex;
          gap: 9px;
        }

        .heroActions button,
        .heroActions a {
          min-height: 43px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 14px;
          border: 1px solid ${GOLD};
          border-radius: 11px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-size: 10px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        .heroActions a {
          background: transparent;
          color: #ffffff;
        }

        .notice,
        .error {
          position: fixed;
          z-index: 1100;
          top: 18px;
          right: 18px;
          width: min(400px, calc(100vw - 36px));
          padding: 13px 15px;
          border-radius: 12px;
          box-shadow: 0 18px 38px rgba(3, 21, 63, 0.2);
          font-size: 12px;
          font-weight: 800;
        }

        .notice {
          border: 1px solid #a6f4c5;
          background: #ecfdf3;
          color: ${GREEN};
        }

        .error {
          border: 1px solid #fecdca;
          background: #fef3f2;
          color: ${RED};
        }

        .historyWarning {
          position: fixed;
          z-index: 1100;
          top: 76px;
          right: 18px;
          width: min(480px, calc(100vw - 36px));
          padding: 13px 15px;
          border: 1px solid #f7d070;
          border-radius: 12px;
          background: #fff9e8;
          color: #7a5300;
          box-shadow: 0 18px 38px rgba(3, 21, 63, 0.16);
          font-size: 11px;
          font-weight: 800;
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
          min-height: 126px;
          overflow: hidden;
          padding: 18px;
          border: 1px solid rgba(212, 175, 55, 0.28);
          border-radius: 20px;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.99),
            rgba(3, 21, 63, 0.98)
          );
          box-shadow:
            0 14px 30px rgba(3, 21, 63, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.07);
          transition:
            transform 0.22s ease,
            box-shadow 0.22s ease,
            border-color 0.22s ease;
          animation: supplierStatRise 0.48s ease both;
        }

        .statsGrid article:nth-child(1) {
          animation-delay: 0.04s;
        }

        .statsGrid article:nth-child(2) {
          animation-delay: 0.10s;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.99),
            rgba(25, 55, 121, 0.98),
            rgba(112, 84, 13, 0.88)
          );
        }

        .statsGrid article:nth-child(3) {
          animation-delay: 0.16s;
        }

        .statsGrid article:nth-child(4) {
          animation-delay: 0.22s;
          background: linear-gradient(
            135deg,
            rgba(8, 37, 98, 0.99),
            rgba(3, 21, 63, 0.98),
            rgba(112, 84, 13, 0.88)
          );
        }

        .statsGrid article:nth-child(5) {
          animation-delay: 0.28s;
        }

        .statsGrid article::before {
          content: "";
          position: absolute;
          z-index: -1;
          top: -46%;
          right: -18%;
          width: 138px;
          height: 138px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(212, 175, 55, 0.38),
            rgba(212, 175, 55, 0)
          );
          transition: transform 0.28s ease;
        }

        .statsGrid article::after {
          content: "";
          position: absolute;
          top: -145%;
          left: -40%;
          width: 42%;
          height: 380%;
          transform: rotate(22deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.16),
            transparent
          );
          animation: supplierStatShine 5.4s ease-in-out infinite;
          pointer-events: none;
        }

        .statsGrid article:nth-child(2)::after {
          animation-delay: 0.75s;
        }

        .statsGrid article:nth-child(3)::after {
          animation-delay: 1.50s;
        }

        .statsGrid article:nth-child(4)::after {
          animation-delay: 2.25s;
        }

        .statsGrid article:nth-child(5)::after {
          animation-delay: 3s;
        }

        .statsGrid article:hover {
          transform: translateY(-4px) scale(1.008);
          border-color: rgba(212, 175, 55, 0.52);
          box-shadow:
            0 20px 38px rgba(3, 21, 63, 0.24),
            0 0 0 1px rgba(212, 175, 55, 0.12);
        }

        .statsGrid article:hover::before {
          transform: scale(1.10);
        }

        .statsGrid span,
        .statsGrid strong {
          display: block;
        }

        .statsGrid span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .statsGrid strong {
          margin-top: 9px;
          color: #ffffff;
          font-size: 22px;
          font-weight: 950;
        }

        .mainPanel {
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 20px;
          background: #ffffff;
          box-shadow: 0 12px 32px rgba(3, 21, 63, 0.08);
        }

        .toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 190px;
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
        .paymentModal input,
        .paymentModal select,
        .paymentModal textarea {
          width: 100%;
          min-height: 43px;
          padding: 0 10px;
          border: 1px solid #dfe4eb;
          border-radius: 10px;
          outline: none;
          background: #ffffff;
          color: #344054;
          font: inherit;
          font-size: 10px;
          font-weight: 700;
        }

        .searchBox input {
          min-height: auto;
          padding: 0;
          border: 0;
          background: transparent;
        }

        .supplierGrid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 13px;
          padding: 15px;
          background: #f8fafc;
        }

        .supplierCard {
          position: relative;
          overflow: hidden;
          padding: 16px;
          border: 1px solid #e4e7ec;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 8px 22px rgba(16, 24, 40, 0.07);
          transition:
            transform 0.22s ease,
            box-shadow 0.22s ease,
            border-color 0.22s ease;
          animation: supplierCardIn 0.45s ease both;
        }

        .supplierCard::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(
            90deg,
            ${ROYAL_BLUE},
            ${GOLD},
            ${ROYAL_BLUE}
          );
          opacity: 0.85;
        }

        .supplierCard:hover {
          transform: translateY(-4px);
          border-color: rgba(212, 175, 55, 0.48);
          box-shadow: 0 16px 34px rgba(3, 21, 63, 0.15);
        }

        .supplierCard header {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .supplierAvatar {
          width: 48px;
          height: 48px;
          flex: 0 0 48px;
          display: grid;
          place-items: center;
          border: 1px solid ${GOLD};
          border-radius: 15px;
          background: ${ROYAL_BLUE};
          color: ${GOLD};
          font-size: 19px;
          font-weight: 950;
        }

        .supplierIdentity {
          min-width: 0;
          flex: 1;
        }

        .supplierIdentity h2 {
          overflow: hidden;
          margin: 0;
          color: ${DEEP_BLUE};
          font-size: 15px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .supplierIdentity p,
        .supplierIdentity small {
          display: block;
          margin: 3px 0 0;
          color: #7d8797;
          font-size: 9px;
        }

        .balanceBadge {
          padding: 7px 9px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 900;
        }

        .balanceBadge.due {
          background: #fef3f2;
          color: ${RED};
        }

        .balanceBadge.clear {
          background: #ecfdf3;
          color: ${GREEN};
        }

        .supplierNumbers {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 7px;
          margin-top: 14px;
        }

        .supplierNumbers div {
          min-width: 0;
          padding: 10px 8px;
          border-radius: 10px;
          background: #f8fafc;
        }

        .supplierNumbers span,
        .supplierNumbers strong {
          display: block;
        }

        .supplierNumbers span {
          color: #98a2b3;
          font-size: 7px;
          font-weight: 850;
          text-transform: uppercase;
        }

        .supplierNumbers strong {
          overflow: hidden;
          margin-top: 4px;
          color: #344054;
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dueText {
          color: ${RED} !important;
        }

        .supplierMeta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 11px;
          color: #8a93a0;
          font-size: 8px;
        }

        .supplierCard footer {
          display: flex;
          gap: 7px;
          margin-top: 13px;
        }

        .supplierCard footer button,
        .supplierCard footer a,
        .ledgerActions button,
        .ledgerActions a {
          min-height: 37px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          padding: 0 10px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: #ffffff;
          color: ${ROYAL_BLUE};
          font-size: 8px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        .supplierCard footer .payButton,
        .ledgerActions button:not(.secondary) {
          border-color: ${GOLD};
          background: ${ROYAL_BLUE};
          color: #ffffff;
        }

        .supplierCard footer .whatsAppButton,
        .ledgerActions .whatsAppButton {
          border-color: #1fa855;
          background: #ecfdf3;
          color: #067647;
        }

        .supplierCard footer button:disabled,
        .ledgerActions button:disabled {
          opacity: 0.58;
          cursor: not-allowed;
        }

        .stateBox {
          min-height: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          text-align: center;
        }

        .stateBox h2 {
          margin: 14px 0 0;
          color: ${ROYAL_BLUE};
        }

        .stateBox p {
          color: #7d8797;
          font-size: 11px;
        }

        .spinner {
          width: 43px;
          height: 43px;
          border: 4px solid #e6eaf0;
          border-top-color: ${ROYAL_BLUE};
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
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

        .ledgerModal,
        .paymentModal {
          position: relative;
          width: min(900px, 100%);
          max-height: 91vh;
          overflow-y: auto;
          padding: 24px;
          border: 1px solid rgba(212, 175, 55, 0.45);
          border-radius: 21px;
          background: #ffffff;
          box-shadow: 0 28px 70px rgba(3, 21, 63, 0.28);
        }

        .paymentModal {
          width: min(460px, 100%);
        }

        .ledgerModal h2,
        .paymentModal h2 {
          margin: 6px 0 0;
          color: ${ROYAL_BLUE};
          font-size: 24px;
        }

        .ledgerSubtitle,
        .paymentModal p {
          margin: 5px 0 0;
          color: #667085;
          font-size: 10px;
        }

        .closeButton {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          padding: 0;
          border: 1px solid ${GOLD};
          border-radius: 50%;
          background: ${ROYAL_BLUE};
          color: #ffffff;
          font-size: 16px;
          font-weight: 950;
          cursor: pointer;
        }

        .ledgerStats {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 9px;
          margin-top: 16px;
        }

        .ledgerStats div {
          padding: 12px;
          border-radius: 11px;
          background: #f8fafc;
        }

        .ledgerStats span,
        .ledgerStats strong {
          display: block;
        }

        .ledgerStats span {
          color: #98a2b3;
          font-size: 8px;
          font-weight: 850;
        }

        .ledgerStats strong {
          margin-top: 5px;
          color: ${ROYAL_BLUE};
          font-size: 13px;
        }

        .ledgerTabs {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 8px;
          margin-top: 16px;
        }

        .ledgerTabs button {
          min-height: 42px;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          background: #ffffff;
          color: ${ROYAL_BLUE};
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .ledgerTabs button.active {
          border-color: ${GOLD};
          background: ${ROYAL_BLUE};
          color: #ffffff;
        }

        .ledgerList {
          display: grid;
          gap: 9px;
          margin-top: 13px;
        }

        .ledgerRow {
          display: grid;
          grid-template-columns:
            minmax(190px, 1fr)
            minmax(0, 1.5fr);
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
          background: #fbfcfe;
        }

        .ledgerRow strong,
        .ledgerRow span,
        .ledgerRow small {
          display: block;
        }

        .ledgerRow > div:first-child > strong {
          color: ${ROYAL_BLUE};
          font-size: 11px;
        }

        .ledgerRow span,
        .ledgerRow small {
          margin-top: 3px;
          color: #8a93a0;
          font-size: 8px;
        }

        .ledgerAmounts {
          display: grid;
          grid-template-columns: repeat(
            3,
            minmax(0, 1fr)
          );
          gap: 7px;
        }

        .ledgerAmounts p {
          margin: 0;
          padding: 8px;
          border-radius: 8px;
          background: #ffffff;
        }

        .ledgerAmounts span,
        .ledgerAmounts strong {
          display: block;
        }

        .ledgerAmounts span {
          color: #98a2b3;
          font-size: 7px;
          font-weight: 850;
        }

        .ledgerAmounts strong {
          margin-top: 3px;
          color: #344054;
          font-size: 9px;
        }

        .paymentValue {
          color: ${GREEN};
          font-size: 15px;
          font-weight: 950;
          text-align: right;
        }

        .emptyLedger {
          padding: 28px;
          border: 1px dashed #d0d5dd;
          border-radius: 12px;
          color: #7d8797;
          font-size: 10px;
          text-align: center;
        }

        .ledgerActions {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }

        .ledgerActions .secondary {
          background: #ffffff;
          color: ${ROYAL_BLUE};
        }

        .paymentModal label {
          display: grid;
          gap: 6px;
          margin-top: 13px;
        }

        .paymentModal label > span {
          color: #667085;
          font-size: 9px;
          font-weight: 850;
        }

        .paymentModal textarea {
          min-height: 78px;
          padding: 10px;
          resize: vertical;
        }

        .paymentGrid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 9px;
        }

        .savePaymentButton {
          width: 100%;
          min-height: 48px;
          margin-top: 15px;
          border: 1px solid ${GOLD};
          border-radius: 11px;
          background: ${ROYAL_BLUE};
          color: #ffffff;
          font-size: 10px;
          font-weight: 950;
          cursor: pointer;
        }

        .savePaymentButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes supplierStatRise {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes supplierStatShine {
          0%,
          62% {
            left: -42%;
            opacity: 0;
          }
          68% {
            opacity: 0.75;
          }
          100% {
            left: 126%;
            opacity: 0;
          }
        }

        @keyframes supplierCardIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 1100px) {
          .statsGrid {
            grid-template-columns: repeat(
              3,
              minmax(0, 1fr)
            );
          }

          .supplierGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .suppliersPage {
            padding: 16px 10px 40px;
          }

          .pageHero {
            align-items: flex-start;
            flex-direction: column;
          }

          .heroActions {
            width: 100%;
          }

          .heroActions button,
          .heroActions a {
            flex: 1;
          }

          .statsGrid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .toolbar {
            grid-template-columns: 1fr;
          }

          .supplierNumbers,
          .ledgerStats {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .ledgerRow {
            grid-template-columns: 1fr;
          }

          .paymentValue {
            text-align: left;
          }
        }

        @media (max-width: 520px) {
          .statsGrid,
          .supplierNumbers,
          .ledgerStats,
          .paymentGrid,
          .ledgerAmounts {
            grid-template-columns: 1fr;
          }

          .supplierCard footer,
          .ledgerActions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .supplierMeta {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}