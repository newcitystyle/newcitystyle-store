"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Period = "today" | "7days" | "30days" | "custom";

type SaleRow = {
  id: string;
  invoice_number?: string | null;
  payment_method?: string | null;
  sale_status?: string | null;
  subtotal?: number | string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  created_at?: string | null;
};

type SaleItemRow = {
  id: number;
  sale_id: string;
  product_id?: number | null;
  variant_id?: number | null;
  product_name?: string | null;
  quantity?: number | string | null;
  line_total?: number | string | null;
  unit_price?: number | string | null;
  created_at?: string | null;
};

type PurchaseRow = {
  id: string;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  purchase_status?: string | null;
  purchase_date?: string | null;
  created_at?: string | null;
};

type PurchaseItemRow = {
  id: number;
  purchase_id: string;
  product_id?: number | null;
  variant_id?: number | null;
  product_name?: string | null;
  quantity?: number | string | null;
  purchase_price?: number | string | null;
  created_at?: string | null;
};

type ProductRow = {
  id: number;
  name?: string | null;
  stock?: number | string | null;
  price?: number | string | null;
  mrp?: number | string | null;
  is_active?: boolean | null;
  status?: string | null;
};

type VariantRow = {
  id: number;
  product_id: number;
  stock?: number | string | null;
  purchase_price?: number | string | null;
  selling_price?: number | string | null;
  mrp?: number | string | null;
  is_active?: boolean | null;
};

type ReturnRow = {
  id: string;
  return_type?: string | null;
  return_status?: string | null;
  total_return_amount?: number | string | null;
  created_at?: string | null;
};

type RefundRow = {
  id: string;
  amount?: number | string | null;
  refund_status?: string | null;
  refunded_at?: string | null;
  created_at?: string | null;
};

type ExchangeSettlementRow = {
  id: string;
  returned_value?: number | string | null;
  exchange_value?: number | string | null;
  difference_amount?: number | string | null;
  settlement_direction?: string | null;
  settlement_status?: string | null;
  created_at?: string | null;
};

type CreditAccountRow = {
  id: number;
  current_balance?: number | string | null;
  is_active?: boolean | null;
};

const BLUE = "#0A2E73";
const DEEP = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";

const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(numberValue(value));

const normalize = (value?: string | null) =>
  value?.trim().toLowerCase() || "";

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function safeDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isBetween(
  value: string | null | undefined,
  from: Date,
  to: Date,
) {
  const date = safeDate(value);
  return Boolean(date && date >= from && date <= to);
}

function formatShortDate(value: Date) {
  return value.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

export default function BillingReportsPage() {
  const today = new Date();
  const [period, setPeriod] = useState<Period>("today");
  const [customFrom, setCustomFrom] = useState(dateInputValue(today));
  const [customTo, setCustomTo] = useState(dateInputValue(today));

  const [sales, setSales] = useState<SaleRow[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItemRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [exchangeSettlements, setExchangeSettlements] = useState<
    ExchangeSettlementRow[]
  >([]);
  const [creditAccounts, setCreditAccounts] = useState<CreditAccountRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const loadReports = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setErrorText("");
    setWarnings([]);

    try {
      const results = await Promise.all([
        supabase.from("pos_sales").select("*").order("created_at", { ascending: false }),
        supabase.from("pos_sale_items").select("*").order("created_at", { ascending: false }),
        supabase.from("purchases").select("*").order("created_at", { ascending: false }),
        supabase.from("purchase_items").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("id,name,stock,price,mrp,is_active,status"),
        supabase.from("product_variants").select(
          "id,product_id,stock,purchase_price,selling_price,mrp,is_active",
        ),
        supabase.from("pos_returns").select("*").order("created_at", { ascending: false }),
        supabase.from("pos_refunds").select("*").order("created_at", { ascending: false }),
        supabase
          .from("pos_exchange_settlements")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("customer_credit_accounts").select("*"),
      ]);

      const [
        salesResult,
        saleItemsResult,
        purchasesResult,
        purchaseItemsResult,
        productsResult,
        variantsResult,
        returnsResult,
        refundsResult,
        exchangesResult,
        creditResult,
      ] = results;

      const mandatoryErrors = [
        salesResult.error,
        saleItemsResult.error,
        purchasesResult.error,
        purchaseItemsResult.error,
        productsResult.error,
      ].filter(Boolean);

      if (mandatoryErrors.length > 0) {
        throw mandatoryErrors[0];
      }

      const optionalWarnings = [
        variantsResult.error
          ? `Variants: ${variantsResult.error.message}`
          : "",
        returnsResult.error
          ? `Returns: ${returnsResult.error.message}`
          : "",
        refundsResult.error
          ? `Refunds: ${refundsResult.error.message}`
          : "",
        exchangesResult.error
          ? `Exchanges: ${exchangesResult.error.message}`
          : "",
        creditResult.error
          ? `Customer dues: ${creditResult.error.message}`
          : "",
      ].filter(Boolean);

      setWarnings(optionalWarnings);
      setSales((salesResult.data || []) as unknown as SaleRow[]);
      setSaleItems((saleItemsResult.data || []) as unknown as SaleItemRow[]);
      setPurchases((purchasesResult.data || []) as unknown as PurchaseRow[]);
      setPurchaseItems(
        (purchaseItemsResult.data || []) as unknown as PurchaseItemRow[],
      );
      setProducts((productsResult.data || []) as unknown as ProductRow[]);
      setVariants((variantsResult.data || []) as unknown as VariantRow[]);
      setReturns((returnsResult.data || []) as unknown as ReturnRow[]);
      setRefunds((refundsResult.data || []) as unknown as RefundRow[]);
      setExchangeSettlements(
        (exchangesResult.data || []) as unknown as ExchangeSettlementRow[],
      );
      setCreditAccounts(
        (creditResult.data || []) as unknown as CreditAccountRow[],
      );
    } catch (error) {
      console.error("Billing reports load error:", error);
      setErrorText(
        error instanceof Error
          ? error.message
          : "Unable to load billing reports.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const dateRange = useMemo(() => {
    const now = new Date();

    if (period === "today") {
      return {
        from: startOfDay(now),
        to: endOfDay(now),
        label: "Today",
      };
    }

    if (period === "7days") {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { from, to: endOfDay(now), label: "Last 7 Days" };
    }

    if (period === "30days") {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      return { from, to: endOfDay(now), label: "Last 30 Days" };
    }

    const parsedFrom = startOfDay(new Date(`${customFrom}T00:00:00`));
    const parsedTo = endOfDay(new Date(`${customTo}T00:00:00`));

    return {
      from: parsedFrom,
      to: parsedTo,
      label: `${customFrom} to ${customTo}`,
    };
  }, [customFrom, customTo, period]);

  const filteredSales = useMemo(
    () =>
      sales.filter(
        (sale) =>
          isBetween(sale.created_at, dateRange.from, dateRange.to) &&
          normalize(sale.sale_status) !== "cancelled",
      ),
    [dateRange, sales],
  );

  const filteredPurchases = useMemo(
    () =>
      purchases.filter((purchase) =>
        isBetween(
          purchase.purchase_date || purchase.created_at,
          dateRange.from,
          dateRange.to,
        ),
      ),
    [dateRange, purchases],
  );

  const filteredReturns = useMemo(
    () =>
      returns.filter((row) =>
        isBetween(row.created_at, dateRange.from, dateRange.to),
      ),
    [dateRange, returns],
  );

  const filteredRefunds = useMemo(
    () =>
      refunds.filter((row) =>
        isBetween(
          row.refunded_at || row.created_at,
          dateRange.from,
          dateRange.to,
        ),
      ),
    [dateRange, refunds],
  );

  const filteredExchanges = useMemo(
    () =>
      exchangeSettlements.filter((row) =>
        isBetween(row.created_at, dateRange.from, dateRange.to),
      ),
    [dateRange, exchangeSettlements],
  );

  const saleIdSet = useMemo(
    () => new Set(filteredSales.map((sale) => sale.id)),
    [filteredSales],
  );

  const filteredSaleItems = useMemo(
    () => saleItems.filter((item) => saleIdSet.has(item.sale_id)),
    [saleIdSet, saleItems],
  );

  const latestCostMap = useMemo(() => {
    const map = new Map<string, number>();

    [...purchaseItems]
      .sort((a, b) => {
        const first = safeDate(a.created_at)?.getTime() || 0;
        const second = safeDate(b.created_at)?.getTime() || 0;
        return second - first;
      })
      .forEach((item) => {
        const key =
          item.variant_id != null
            ? `variant-${item.variant_id}`
            : `product-${item.product_id}`;

        if (!map.has(key)) {
          map.set(key, numberValue(item.purchase_price));
        }
      });

    variants.forEach((variant) => {
      const key = `variant-${variant.id}`;
      if (!map.has(key) && numberValue(variant.purchase_price) > 0) {
        map.set(key, numberValue(variant.purchase_price));
      }
    });

    return map;
  }, [purchaseItems, variants]);

  const report = useMemo(() => {
    const salesValue = filteredSales.reduce(
      (sum, sale) => sum + numberValue(sale.total_amount),
      0,
    );
    const salesPaid = filteredSales.reduce(
      (sum, sale) => sum + numberValue(sale.paid_amount),
      0,
    );
    const salesDue = filteredSales.reduce(
      (sum, sale) => sum + numberValue(sale.due_amount),
      0,
    );
    const purchaseValue = filteredPurchases.reduce(
      (sum, purchase) => sum + numberValue(purchase.total_amount),
      0,
    );
    const purchasePaid = filteredPurchases.reduce(
      (sum, purchase) => sum + numberValue(purchase.paid_amount),
      0,
    );
    const supplierDue = purchases.reduce(
      (sum, purchase) => sum + numberValue(purchase.due_amount),
      0,
    );
    const customerDue = creditAccounts
      .filter((account) => account.is_active !== false)
      .reduce(
        (sum, account) => sum + numberValue(account.current_balance),
        0,
      );

    const refundValue = filteredRefunds
      .filter((refund) => normalize(refund.refund_status) !== "cancelled")
      .reduce((sum, refund) => sum + numberValue(refund.amount), 0);

    const returnValue = filteredReturns
      .filter((row) => normalize(row.return_status) !== "cancelled")
      .reduce(
        (sum, row) => sum + numberValue(row.total_return_amount),
        0,
      );

    const exchangeValue = filteredExchanges
      .filter(
        (row) => normalize(row.settlement_status) !== "cancelled",
      )
      .reduce(
        (sum, row) => sum + numberValue(row.exchange_value),
        0,
      );

    const estimatedCost = filteredSaleItems.reduce((sum, item) => {
      const key =
        item.variant_id != null
          ? `variant-${item.variant_id}`
          : `product-${item.product_id}`;
      const cost = latestCostMap.get(key) || 0;
      return sum + cost * numberValue(item.quantity);
    }, 0);

    const estimatedProfit = salesValue - refundValue - estimatedCost;

    const paymentTotals = filteredSales.reduce<Record<string, number>>(
      (totals, sale) => {
        const method = normalize(sale.payment_method) || "other";
        totals[method] =
          (totals[method] || 0) + numberValue(sale.paid_amount);
        return totals;
      },
      {},
    );

    const stockValue = products.reduce((sum, product) => {
      const productVariants = variants.filter(
        (variant) =>
          variant.product_id === product.id &&
          variant.is_active !== false,
      );

      if (productVariants.length > 0) {
        return (
          sum +
          productVariants.reduce((variantTotal, variant) => {
            const cost =
              latestCostMap.get(`variant-${variant.id}`) ||
              numberValue(variant.purchase_price);
            return variantTotal + cost * numberValue(variant.stock);
          }, 0)
        );
      }

      const cost =
        latestCostMap.get(`product-${product.id}`) ||
        numberValue(product.price);
      return sum + cost * numberValue(product.stock);
    }, 0);

    const lowStock = products.filter(
      (product) =>
        product.is_active !== false &&
        normalize(product.status) !== "inactive" &&
        numberValue(product.stock) <= 5,
    ).length;

    return {
      bills: filteredSales.length,
      salesValue,
      salesPaid,
      salesDue,
      purchaseValue,
      purchasePaid,
      supplierDue,
      customerDue,
      returnValue,
      refundValue,
      exchangeValue,
      estimatedCost,
      estimatedProfit,
      paymentTotals,
      stockValue,
      lowStock,
    };
  }, [
    creditAccounts,
    filteredExchanges,
    filteredPurchases,
    filteredRefunds,
    filteredReturns,
    filteredSaleItems,
    filteredSales,
    latestCostMap,
    products,
    purchases,
    variants,
  ]);

  const bestSellers = useMemo(() => {
    const map = new Map<
      string,
      { name: string; quantity: number; value: number }
    >();

    filteredSaleItems.forEach((item) => {
      const key =
        item.variant_id != null
          ? `variant-${item.variant_id}`
          : item.product_id != null
            ? `product-${item.product_id}`
            : item.product_name || `item-${item.id}`;

      const current = map.get(key) || {
        name: item.product_name || "Product",
        quantity: 0,
        value: 0,
      };

      current.quantity += numberValue(item.quantity);
      current.value +=
        numberValue(item.line_total) ||
        numberValue(item.unit_price) * numberValue(item.quantity);

      map.set(key, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);
  }, [filteredSaleItems]);

  const dailyTrend = useMemo(() => {
    const days: Array<{ date: Date; label: string; value: number }> = [];

    for (let index = 6; index >= 0; index -= 1) {
      const date = startOfDay(new Date());
      date.setDate(date.getDate() - index);
      days.push({ date, label: formatShortDate(date), value: 0 });
    }

    filteredSales.forEach((sale) => {
      const saleDate = safeDate(sale.created_at);
      if (!saleDate) return;

      const row = days.find(
        (day) => day.date.toDateString() === saleDate.toDateString(),
      );

      if (row) row.value += numberValue(sale.total_amount);
    });

    return days;
  }, [filteredSales]);

  const maxDailyValue = Math.max(
    1,
    ...dailyTrend.map((day) => day.value),
  );

  function exportCsv() {
    const rows = [
      ["NEW CITY STYLE Billing Report"],
      ["Period", dateRange.label],
      [],
      ["Metric", "Value"],
      ["Total Bills", report.bills],
      ["Sales Value", report.salesValue],
      ["Sales Paid", report.salesPaid],
      ["Sales Due", report.salesDue],
      ["Purchase Value", report.purchaseValue],
      ["Supplier Due", report.supplierDue],
      ["Customer Due", report.customerDue],
      ["Refunds", report.refundValue],
      ["Exchange Value", report.exchangeValue],
      ["Estimated Cost", report.estimatedCost],
      ["Estimated Gross Profit", report.estimatedProfit],
      ["Current Stock Value", report.stockValue],
      [],
      ["Payment Method", "Collected"],
      ...Object.entries(report.paymentTotals).map(([method, value]) => [
        method,
        value,
      ]),
      [],
      ["Best Selling Product", "Quantity", "Sales Value"],
      ...bestSellers.map((item) => [
        item.name,
        item.quantity,
        item.value,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ncs-billing-report-${dateInputValue(new Date())}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <main className="reportLoading">
        <div>NCS</div>
        <span />
        <h2>Preparing Billing Reports...</h2>
        <p>Sales, purchases, dues and stock are being calculated.</p>
        <style jsx>{`
          .reportLoading {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: ${IVORY};
            color: ${BLUE};
            font-family: Poppins, Inter, Arial, sans-serif;
          }
          .reportLoading > div {
            width: 78px;
            height: 78px;
            display: grid;
            place-items: center;
            border: 2px solid ${GOLD};
            border-radius: 22px;
            background: ${BLUE};
            color: ${GOLD};
            font-size: 22px;
            font-weight: 950;
          }
          .reportLoading > span {
            width: 44px;
            height: 44px;
            margin-top: 22px;
            border: 4px solid #e1e5ec;
            border-top-color: ${GOLD};
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          .reportLoading h2 {
            margin: 17px 0 0;
          }
          .reportLoading p {
            margin: 7px 0 0;
            color: #707887;
            font-size: 12px;
          }
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="reportsPage">
      <section className="reportsHero">
        <div>
          <span>NEW CITY STYLE • BUSINESS INTELLIGENCE</span>
          <h1>Billing Reports</h1>
          <p>
            Sales, profit estimate, purchases, dues, returns and stock in one
            owner dashboard.
          </p>
        </div>

        <div className="heroActions">
          <button
            type="button"
            onClick={() => loadReports(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
          <button type="button" onClick={exportCsv}>
            ⇩ Export CSV
          </button>
          <button type="button" onClick={() => window.print()}>
            🖨 Print Report
          </button>
        </div>
      </section>

      {errorText && <div className="reportError">{errorText}</div>}

      {warnings.length > 0 && (
        <div className="reportWarning">
          Some optional report sections could not load: {warnings.join(" • ")}
        </div>
      )}

      <section className="periodBar">
        <div className="periodButtons">
          {(
            [
              ["today", "Today"],
              ["7days", "7 Days"],
              ["30days", "30 Days"],
              ["custom", "Custom"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              className={period === value ? "active" : ""}
              onClick={() => setPeriod(value)}
            >
              {text}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="customDates">
            <label>
              <span>From</span>
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
              />
            </label>
            <label>
              <span>To</span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
              />
            </label>
          </div>
        )}

        <strong>{dateRange.label}</strong>
      </section>

      <section className="primaryStats">
        <ReportCard
          label="Sales Value"
          value={money(report.salesValue)}
          note={`${report.bills} completed bills`}
          icon="₹"
        />
        <ReportCard
          label="Estimated Gross Profit"
          value={money(report.estimatedProfit)}
          note={`Estimated cost ${money(report.estimatedCost)}`}
          icon="↗"
          highlight
        />
        <ReportCard
          label="Purchase Value"
          value={money(report.purchaseValue)}
          note={`Paid ${money(report.purchasePaid)}`}
          icon="📥"
        />
        <ReportCard
          label="Customer Due"
          value={money(report.customerDue)}
          note={`Period sale due ${money(report.salesDue)}`}
          icon="👥"
        />
        <ReportCard
          label="Supplier Due"
          value={money(report.supplierDue)}
          note="Current pending supplier balance"
          icon="🏭"
        />
        <ReportCard
          label="Stock Value"
          value={money(report.stockValue)}
          note={`${report.lowStock} low-stock products`}
          icon="▥"
        />
      </section>

      <section className="reportGrid">
        <article className="reportPanel paymentPanel">
          <header>
            <div>
              <span>PAYMENT COLLECTION</span>
              <h2>Payment Method Totals</h2>
            </div>
            <strong>{money(report.salesPaid)}</strong>
          </header>

          <div className="paymentRows">
            {["cash", "upi", "card", "bank_transfer", "credit", "other"].map(
              (method) => {
                const value = report.paymentTotals[method] || 0;
                const percentage =
                  report.salesPaid > 0
                    ? Math.min(100, (value / report.salesPaid) * 100)
                    : 0;

                return (
                  <div key={method}>
                    <div>
                      <span>{method.replaceAll("_", " ").toUpperCase()}</span>
                      <strong>{money(value)}</strong>
                    </div>
                    <div className="track">
                      <span style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </article>

        <article className="reportPanel returnPanel">
          <header>
            <div>
              <span>AFTER-SALES ACTIVITY</span>
              <h2>Returns & Exchanges</h2>
            </div>
          </header>

          <div className="returnStats">
            <div>
              <span>Return Requests</span>
              <strong>{filteredReturns.length}</strong>
            </div>
            <div>
              <span>Returned Value</span>
              <strong>{money(report.returnValue)}</strong>
            </div>
            <div>
              <span>Refunded</span>
              <strong>{money(report.refundValue)}</strong>
            </div>
            <div>
              <span>Exchanges</span>
              <strong>{filteredExchanges.length}</strong>
            </div>
            <div>
              <span>Exchange Value</span>
              <strong>{money(report.exchangeValue)}</strong>
            </div>
          </div>
        </article>

        <article className="reportPanel trendPanel">
          <header>
            <div>
              <span>RECENT PERFORMANCE</span>
              <h2>Last 7 Days Sales</h2>
            </div>
          </header>

          <div className="trendChart">
            {dailyTrend.map((day) => (
              <div key={day.label}>
                <strong>{money(day.value)}</strong>
                <div>
                  <span
                    style={{
                      height: `${Math.max(
                        4,
                        (day.value / maxDailyValue) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <small>{day.label}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="reportPanel bestPanel">
          <header>
            <div>
              <span>PRODUCT PERFORMANCE</span>
              <h2>Best Selling Products</h2>
            </div>
          </header>

          {bestSellers.length === 0 ? (
            <div className="emptyReport">No sales found for this period.</div>
          ) : (
            <div className="bestList">
              {bestSellers.map((item, index) => (
                <div key={`${item.name}-${index}`}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.quantity} item(s) sold</small>
                  </div>
                  <b>{money(item.value)}</b>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <p className="profitNote">
        Estimated gross profit uses the latest available purchase price for
        each sold product or variant. It does not include rent, salaries,
        electricity or other operating expenses.
      </p>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .reportsPage {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(
              circle at 8% 0%,
              rgba(212, 175, 55, 0.12),
              transparent 28%
            ),
            ${IVORY};
          color: #2c2c2c;
          font-family: Poppins, Inter, Arial, sans-serif;
        }

        .reportsHero {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          padding: 26px;
          border: 1px solid rgba(212, 175, 55, 0.32);
          border-radius: 24px;
          background:
            radial-gradient(
              circle at 88% 0%,
              rgba(212, 175, 55, 0.24),
              transparent 32%
            ),
            linear-gradient(135deg, ${DEEP}, ${BLUE});
          color: #fff;
          box-shadow: 0 18px 45px rgba(3, 21, 63, 0.18);
        }

        .reportsHero span,
        .reportPanel header span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1.25px;
        }

        .reportsHero h1 {
          margin: 6px 0 5px;
          font-size: clamp(30px, 4vw, 43px);
        }

        .reportsHero p {
          margin: 0;
          color: rgba(255, 255, 255, 0.68);
          font-size: 12px;
        }

        .heroActions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .heroActions button {
          min-height: 42px;
          padding: 0 13px;
          border: 1px solid rgba(212, 175, 55, 0.68);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          font: inherit;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .heroActions button:nth-child(2) {
          background: ${GOLD};
          color: ${DEEP};
        }

        .heroActions button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .reportError,
        .reportWarning {
          margin-top: 14px;
          padding: 13px 15px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 750;
        }

        .reportError {
          background: #ffe7e7;
          color: #a72828;
        }

        .reportWarning {
          background: #fff4d9;
          color: #805b00;
        }

        .periodBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-top: 16px;
          padding: 13px;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 17px;
          background: #fff;
          box-shadow: 0 9px 25px rgba(3, 21, 63, 0.06);
        }

        .periodButtons {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .periodButtons button {
          min-height: 37px;
          padding: 0 13px;
          border: 1px solid #dfe4ed;
          border-radius: 10px;
          background: #fff;
          color: ${BLUE};
          font: inherit;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .periodButtons button.active {
          border-color: ${GOLD};
          background: linear-gradient(135deg, ${DEEP}, ${BLUE});
          color: #fff;
        }

        .customDates {
          display: flex;
          gap: 8px;
        }

        .customDates label span {
          display: block;
          margin-bottom: 3px;
          color: #7d8491;
          font-size: 7px;
          font-weight: 850;
          text-transform: uppercase;
        }

        .customDates input {
          height: 37px;
          border: 1px solid #dfe4ed;
          border-radius: 9px;
          padding: 0 8px;
          font: inherit;
          font-size: 9px;
        }

        .periodBar > strong {
          color: ${BLUE};
          font-size: 10px;
        }

        .primaryStats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 16px;
        }

        .reportCard {
          position: relative;
          isolation: isolate;
          min-height: 145px;
          overflow: hidden;
          padding: 19px;
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 18px;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.99),
            rgba(3, 21, 63, 0.98)
          );
          box-shadow: 0 12px 28px rgba(3, 21, 63, 0.15);
          transition: 0.2s ease;
        }

        .reportCard:hover {
          transform: translateY(-2px);
          border-color: rgba(212, 175, 55, 0.46);
          box-shadow: 0 16px 32px rgba(3, 21, 63, 0.21);
        }

        .reportCard::before {
          content: "";
          position: absolute;
          z-index: -1;
          top: -45%;
          right: -15%;
          width: 130px;
          height: 130px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(212, 175, 55, 0.34),
            transparent 68%
          );
        }

        .reportCard.highlight {
          background: linear-gradient(
            135deg,
            ${DEEP},
            ${BLUE},
            #6d5310
          );
        }

        .reportCardTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .reportCardIcon {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.08);
          color: ${GOLD};
          font-size: 18px;
          font-weight: 950;
        }

        .reportCard p {
          margin: 14px 0 4px;
          color: rgba(212, 175, 55, 0.94);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .reportCard strong {
          display: block;
          overflow: hidden;
          color: #fff;
          font-size: clamp(22px, 3vw, 29px);
          font-weight: 950;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .reportCard.highlight strong {
          color: #f5d56b;
        }

        .reportCard small {
          display: block;
          margin-top: 7px;
          color: rgba(255, 255, 255, 0.61);
          font-size: 8px;
        }

        .reportGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-top: 16px;
        }

        .reportPanel {
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 19px;
          background: #fff;
          box-shadow: 0 10px 28px rgba(3, 21, 63, 0.07);
        }

        .reportPanel header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 18px;
          border-bottom: 1px solid #edf0f5;
        }

        .reportPanel header h2 {
          margin: 3px 0 0;
          color: ${DEEP};
          font-size: 17px;
        }

        .reportPanel header > strong {
          color: ${BLUE};
          font-size: 17px;
        }

        .paymentRows {
          display: grid;
          gap: 13px;
          padding: 18px;
        }

        .paymentRows > div > div:first-child {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .paymentRows span {
          color: #747c8b;
          font-size: 8px;
          font-weight: 850;
        }

        .paymentRows strong {
          color: ${DEEP};
          font-size: 10px;
        }

        .track {
          height: 7px;
          margin-top: 6px;
          overflow: hidden;
          border-radius: 20px;
          background: #edf0f5;
        }

        .track > span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, ${BLUE}, ${GOLD});
        }

        .returnStats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 9px;
          padding: 18px;
        }

        .returnStats > div {
          padding: 13px;
          border: 1px solid #e8ebf1;
          border-radius: 13px;
          background: #f9fafc;
        }

        .returnStats span {
          display: block;
          color: #818997;
          font-size: 8px;
          font-weight: 850;
          text-transform: uppercase;
        }

        .returnStats strong {
          display: block;
          margin-top: 5px;
          color: ${BLUE};
          font-size: 17px;
        }

        .trendPanel,
        .bestPanel {
          grid-column: span 1;
        }

        .trendChart {
          height: 260px;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          align-items: end;
          gap: 9px;
          padding: 22px 18px 16px;
        }

        .trendChart > div {
          min-width: 0;
          text-align: center;
        }

        .trendChart strong {
          display: block;
          overflow: hidden;
          color: ${BLUE};
          font-size: 7px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .trendChart > div > div {
          height: 170px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          margin: 6px 0;
          overflow: hidden;
          border-radius: 8px;
          background: #f0f3f8;
        }

        .trendChart > div > div span {
          width: 65%;
          min-height: 4px;
          border-radius: 7px 7px 0 0;
          background: linear-gradient(180deg, ${GOLD}, ${BLUE});
        }

        .trendChart small {
          color: #737c8a;
          font-size: 7px;
        }

        .bestList {
          padding: 7px 18px;
        }

        .bestList > div {
          display: grid;
          grid-template-columns: 33px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          min-height: 62px;
          border-bottom: 1px solid #edf0f5;
        }

        .bestList > div:last-child {
          border-bottom: 0;
        }

        .bestList > div > span {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: ${BLUE};
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
        }

        .bestList strong,
        .bestList small {
          display: block;
        }

        .bestList strong {
          overflow: hidden;
          color: ${DEEP};
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bestList small {
          margin-top: 3px;
          color: #858d9a;
          font-size: 7px;
        }

        .bestList b {
          color: ${BLUE};
          font-size: 9px;
          white-space: nowrap;
        }

        .emptyReport {
          padding: 60px 20px;
          color: #7c8492;
          font-size: 10px;
          text-align: center;
        }

        .profitNote {
          margin: 15px 0 0;
          padding: 12px 14px;
          border: 1px dashed rgba(10, 46, 115, 0.22);
          border-radius: 12px;
          color: #707887;
          font-size: 9px;
          line-height: 1.6;
        }

        @media (max-width: 1050px) {
          .primaryStats {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 760px) {
          .reportsPage {
            padding: 12px;
          }

          .reportsHero {
            align-items: flex-start;
            flex-direction: column;
          }

          .heroActions {
            width: 100%;
          }

          .heroActions button {
            flex: 1;
          }

          .periodBar {
            align-items: flex-start;
            flex-direction: column;
          }

          .customDates {
            width: 100%;
          }

          .customDates label {
            flex: 1;
          }

          .customDates input {
            width: 100%;
          }

          .primaryStats,
          .reportGrid {
            grid-template-columns: 1fr;
          }

          .trendPanel,
          .bestPanel {
            grid-column: auto;
          }
        }

        @media print {
          .heroActions,
          .periodButtons,
          .customDates,
          .reportWarning,
          .reportError {
            display: none !important;
          }

          .reportsPage {
            padding: 0;
            background: #fff;
          }

          .reportsHero {
            box-shadow: none;
          }

          .reportCard,
          .reportPanel {
            break-inside: avoid;
            box-shadow: none;
          }
        }
      `}</style>
    </main>
  );
}

function ReportCard({
  label,
  value,
  note,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <article className={highlight ? "reportCard highlight" : "reportCard"}>
      <div className="reportCardTop">
        <div className="reportCardIcon">{icon}</div>
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}