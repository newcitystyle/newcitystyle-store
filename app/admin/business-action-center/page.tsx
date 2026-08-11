"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const BLUE = "#0A2E73";
const DEEP = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";

type ActionTone = "critical" | "high" | "medium" | "good";

type ActionItem = {
  id: string;
  tone: ActionTone;
  title: string;
  message: string;
  value?: string;
  href: string;
  button: string;
};

type ProfitRow = {
  id: number;
  alert_type: string;
  invoice_number?: string | null;
  registered_revenue?: number | string | null;
  registered_purchase_cost?: number | string | null;
  bill_profit?: number | string | null;
  profit_per_unit?: number | string | null;
  margin_percent?: number | string | null;
  final_bill_amount?: number | string | null;
  created_at?: string | null;
};

type CreditRow = {
  id: string | number;
  customer_name?: string | null;
  customer_phone?: string | null;
  current_balance?: number | string | null;
  next_due_date?: string | null;
  is_active?: boolean | null;
};

type SupplierRow = {
  id: string | number;
  supplier_name?: string | null;
  phone?: string | null;
  current_balance?: number | string | null;
  is_active?: boolean | null;
};

type StockRow = {
  variant_id?: number | null;
  product_id?: number | null;
  product_name?: string | null;
  current_stock?: number | string | null;
  money_blocked?: number | string | null;
  final_stock_status?: string | null;
  final_recommended_action?: string | null;
  final_reorder_quantity?: number | string | null;
};

type ExpenseRow = {
  id: string | number;
  expense_date?: string | null;
  amount?: number | string | null;
  category_name?: string | null;
  is_deleted?: boolean | null;
};

type OrderRow = {
  id: string | number;
  order_status?: string | null;
  status?: string | null;
  total_amount?: number | string | null;
  created_at?: string | null;
};

type ChequeRow = {
  id: string | number;
  supplier_name?: string | null;
  bank_name?: string | null;
  cheque_number?: string | null;
  amount?: number | string | null;
  due_date?: string | number | null;
  status?: string | null;
  is_deleted?: boolean | null;
};

type SaleRow = {
  id: string | number;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  payment_method?: string | null;
  sale_status?: string | null;
  is_deleted?: boolean | null;
  created_at?: string | null;
};

type CashClosingRow = {
  id?: number;
  closing_date?: string | null;
  opening_cash?: number | string | null;
  expected_cash?: number | string | null;
  actual_cash?: number | string | null;
  difference?: number | string | null;
};

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function dayKey(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function localStart(daysBack = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysBack);
  return date;
}

function isSuccessfulSale(row: SaleRow) {
  if (row.is_deleted === true) return false;
  const status = String(row.sale_status || "completed").toLowerCase();
  return !["cancelled", "void", "refunded", "deleted"].includes(status);
}

function dueDateMs(value: string | number | null | undefined) {
  if (value == null || value === "") return NaN;
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  return date.getTime();
}

export default function BusinessActionCenterPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [profitRange, setProfitRange] = useState<7 | 30>(7);

  const [profitRows, setProfitRows] = useState<ProfitRow[]>([]);
  const [credits, setCredits] = useState<CreditRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [cheques, setCheques] = useState<ChequeRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [cashClosing, setCashClosing] = useState<CashClosingRow | null>(null);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorText("");

    const thirtyDaysIso = localStart(29).toISOString();
    const today = dayKey(new Date());

    try {
      const [
        profitResult,
        creditResult,
        supplierResult,
        stockResult,
        expenseResult,
        orderResult,
        chequeResult,
        saleResult,
        closingResult,
      ] = await Promise.all([
        supabase
          .from("owner_profit_alerts")
          .select(
            "id,alert_type,invoice_number,registered_revenue,registered_purchase_cost,bill_profit,profit_per_unit,margin_percent,final_bill_amount,created_at",
          )
          .gte("created_at", thirtyDaysIso)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("customer_credit_accounts")
          .select(
            "id,customer_name,customer_phone,current_balance,next_due_date,is_active",
          )
          .eq("is_active", true)
          .order("current_balance", { ascending: false }),
        supabase
          .from("suppliers")
          .select("id,supplier_name,phone,current_balance,is_active")
          .eq("is_active", true)
          .order("current_balance", { ascending: false }),
        supabase
          .from("ncs_variant_intelligence_v2")
          .select(
            "variant_id,product_id,product_name,current_stock,money_blocked,final_stock_status,final_recommended_action,final_reorder_quantity",
          )
          .limit(5000),
        supabase
          .from("expenses")
          .select("id,expense_date,amount,category_name,is_deleted")
          .eq("is_deleted", false)
          .gte("expense_date", dayKey(localStart(29)))
          .order("expense_date", { ascending: false })
          .limit(5000),
        supabase
          .from("orders")
          .select("id,order_status,status,total_amount,created_at")
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("billing_cheques")
          .select(
            "id,supplier_name,bank_name,cheque_number,amount,due_date,status,is_deleted",
          )
          .eq("is_deleted", false)
          .order("due_date", { ascending: true })
          .limit(500),
        supabase
          .from("pos_sales")
          .select(
            "id,total_amount,paid_amount,due_amount,payment_method,sale_status,is_deleted,created_at",
          )
          .eq("is_deleted", false)
          .gte("created_at", thirtyDaysIso)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("owner_daily_cash_closings")
          .select("*")
          .eq("closing_date", today)
          .maybeSingle(),
      ]);

      if (profitResult.error) throw profitResult.error;

      setProfitRows((profitResult.data || []) as ProfitRow[]);
      setCredits(creditResult.error ? [] : ((creditResult.data || []) as CreditRow[]));
      setSuppliers(
        supplierResult.error ? [] : ((supplierResult.data || []) as SupplierRow[]),
      );
      setStockRows(stockResult.error ? [] : ((stockResult.data || []) as StockRow[]));
      setExpenses(
        expenseResult.error ? [] : ((expenseResult.data || []) as ExpenseRow[]),
      );
      setOrders(orderResult.error ? [] : ((orderResult.data || []) as OrderRow[]));
      setCheques(
        chequeResult.error ? [] : ((chequeResult.data || []) as ChequeRow[]),
      );
      setSales(saleResult.error ? [] : ((saleResult.data || []) as SaleRow[]));
      setCashClosing(closingResult.error ? null : ((closingResult.data || null) as CashClosingRow | null));
    } catch (error) {
      console.error("Business Action Center load error:", error);
      setErrorText(
        error instanceof Error
          ? error.message
          : "Unable to load Business Action Center.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const today = dayKey(new Date());

  const todayProfitAlerts = useMemo(
    () => profitRows.filter((row) => dayKey(row.created_at) === today),
    [profitRows, today],
  );

  const billProfitRows = useMemo(
    () =>
      profitRows.filter(
        (row) => row.alert_type === "BILL_PROFIT_SUMMARY",
      ),
    [profitRows],
  );

  const todaySales = useMemo(
    () =>
      sales.filter(
        (row) =>
          isSuccessfulSale(row) && dayKey(row.created_at) === today,
      ),
    [sales, today],
  );

  const todayExpenses = useMemo(
    () =>
      expenses
        .filter((row) => dayKey(row.expense_date) === today)
        .reduce((sum, row) => sum + n(row.amount), 0),
    [expenses, today],
  );

  const recentExpenseAverage = useMemo(() => {
    const totals = new Map<string, number>();

    expenses.forEach((row) => {
      const key = dayKey(row.expense_date);
      if (!key || key === today) return;
      totals.set(key, (totals.get(key) || 0) + n(row.amount));
    });

    const values = [...totals.values()];
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [expenses, today]);

  const trend = useMemo(() => {
    const days = profitRange;
    const rows: {
      key: string;
      label: string;
      revenue: number;
      profit: number;
      margin: number;
      bills: number;
    }[] = [];

    for (let index = days - 1; index >= 0; index -= 1) {
      const date = localStart(index);
      const key = dayKey(date);

      const dayRows = billProfitRows.filter(
        (row) => dayKey(row.created_at) === key,
      );

      const revenue = dayRows.reduce(
        (sum, row) => sum + n(row.registered_revenue),
        0,
      );
      const profit = dayRows.reduce(
        (sum, row) =>
          sum +
          n(
            row.bill_profit != null
              ? row.bill_profit
              : row.profit_per_unit,
          ),
        0,
      );

      rows.push({
        key,
        label: date.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
        }),
        revenue,
        profit,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        bills: dayRows.length,
      });
    }

    return rows;
  }, [billProfitRows, profitRange]);

  const maxProfitBar = Math.max(
    1,
    ...trend.map((row) => Math.abs(row.profit)),
  );

  const summary = useMemo(() => {
    const salesTotal = todaySales.reduce(
      (sum, row) => sum + n(row.total_amount),
      0,
    );

    const paid = todaySales.reduce(
      (sum, row) => sum + n(row.paid_amount),
      0,
    );

    const dueCreated = todaySales.reduce(
      (sum, row) => sum + n(row.due_amount),
      0,
    );

    const todayBillProfit = billProfitRows.filter(
      (row) => dayKey(row.created_at) === today,
    );

    const registeredRevenue = todayBillProfit.reduce(
      (sum, row) => sum + n(row.registered_revenue),
      0,
    );

    const actualProfit = todayBillProfit.reduce(
      (sum, row) =>
        sum +
        n(
          row.bill_profit != null
            ? row.bill_profit
            : row.profit_per_unit,
        ),
      0,
    );

    return {
      salesTotal,
      bills: todaySales.length,
      paid,
      dueCreated,
      todayExpenses,
      registeredRevenue,
      actualProfit,
      operatingResult: actualProfit - todayExpenses,
      profitMargin:
        registeredRevenue > 0
          ? (actualProfit / registeredRevenue) * 100
          : 0,
    };
  }, [billProfitRows, today, todayExpenses, todaySales]);

  const actions = useMemo<ActionItem[]>(() => {
    const result: ActionItem[] = [];

    const lossAlerts = todayProfitAlerts.filter(
      (row) => row.alert_type === "LOSS_SALE",
    );
    if (lossAlerts.length > 0) {
      result.push({
        id: "loss-sales",
        tone: "critical",
        title: "Loss-sale warning needs review",
        message:
          "One or more bills went below registered purchase cost. Review pricing before the next similar sale.",
        value: `${lossAlerts.length} alert${lossAlerts.length === 1 ? "" : "s"}`,
        href: "/admin/owner-control",
        button: "Review Profit Guard",
      });
    }

    if (cashClosing && Math.abs(n(cashClosing.difference)) >= 1) {
      const difference = n(cashClosing.difference);
      result.push({
        id: "cash-difference",
        tone: Math.abs(difference) >= 100 ? "critical" : "high",
        title: difference < 0 ? "Cash drawer shortage" : "Cash drawer excess",
        message:
          "Physical cash does not match the expected drawer balance for today.",
        value: money(Math.abs(difference)),
        href: "/admin/owner-control",
        button: "Review Cash Closing",
      });
    }

    const now = Date.now();
    const overdueCheques = cheques.filter((row) => {
      const status = String(row.status || "UPCOMING").toUpperCase();
      const due = dueDateMs(row.due_date);
      return (
        status !== "CLEARED" &&
        Number.isFinite(due) &&
        due < localStart(0).getTime()
      );
    });

    if (overdueCheques.length > 0) {
      result.push({
        id: "overdue-cheques",
        tone: "critical",
        title: "Bank cheques overdue",
        message:
          "Supplier or bank cheque dates have passed and need immediate confirmation.",
        value: `${overdueCheques.length} cheque${overdueCheques.length === 1 ? "" : "s"}`,
        href: "/admin/cheque-reminders",
        button: "Open Cheques",
      });
    }

    const lowProfit = todayProfitAlerts.filter(
      (row) => row.alert_type === "LOW_PROFIT",
    );
    if (lowProfit.length > 0) {
      result.push({
        id: "low-profit",
        tone: "high",
        title: "Low-margin bills detected",
        message:
          "Selling price stayed above cost, but margin fell below the Owner Profit Guard target.",
        value: `${lowProfit.length} alert${lowProfit.length === 1 ? "" : "s"}`,
        href: "/admin/owner-control",
        button: "Open Bill Profit",
      });
    }

    const overdueCustomers = credits.filter((row) => {
      if (n(row.current_balance) <= 0 || !row.next_due_date) return false;
      return new Date(`${row.next_due_date}T23:59:59`).getTime() < now;
    });

    if (overdueCustomers.length > 0) {
      const amount = overdueCustomers.reduce(
        (sum, row) => sum + n(row.current_balance),
        0,
      );
      result.push({
        id: "customer-dues",
        tone: "high",
        title: "Customer dues overdue",
        message:
          "These customer balances have crossed their next due date and should be followed up.",
        value: `${overdueCustomers.length} • ${money(amount)}`,
        href: "/admin/customer-retention",
        button: "Follow Up Customers",
      });
    }

    const buyNow = stockRows.filter((row) => {
      const action = String(
        row.final_recommended_action || row.final_stock_status || "",
      ).toUpperCase();
      return (
        action.includes("BUY NOW") ||
        action.includes("REORDER") ||
        n(row.current_stock) <= 0
      );
    });

    if (buyNow.length > 0) {
      const units = buyNow.reduce(
        (sum, row) => sum + Math.max(0, n(row.final_reorder_quantity)),
        0,
      );
      result.push({
        id: "stock-buy",
        tone: "high",
        title: "Stock needs purchase attention",
        message:
          "Stock Intelligence has products at zero stock or with a buy/reorder recommendation.",
        value: units > 0 ? `${buyNow.length} items • ${units} units` : `${buyNow.length} items`,
        href: "/admin/stock-intelligence",
        button: "Open Buying Guide",
      });
    }

    const pendingOrders = orders.filter((row) => {
      const status = String(row.order_status || row.status || "pending")
        .trim()
        .toLowerCase();
      return ["pending", "new", "confirmed", "processing"].includes(status);
    });

    if (pendingOrders.length > 0) {
      result.push({
        id: "pending-orders",
        tone: "medium",
        title: "Online orders need processing",
        message:
          "Open online orders are waiting for confirmation, packing or fulfilment.",
        value: `${pendingOrders.length} order${pendingOrders.length === 1 ? "" : "s"}`,
        href: "/admin/orders",
        button: "Open Orders",
      });
    }

    if (
      recentExpenseAverage > 0 &&
      todayExpenses > recentExpenseAverage * 1.5
    ) {
      result.push({
        id: "expense-spike",
        tone: "medium",
        title: "Daily expenses are unusually high",
        message:
          "Today expenses are more than 1.5× the recent active-day average.",
        value: `${money(todayExpenses)} today`,
        href: "/admin/expenses",
        button: "Review Expenses",
      });
    }

    const supplierDue = suppliers.reduce(
      (sum, row) => sum + Math.max(0, n(row.current_balance)),
      0,
    );

    if (supplierDue > 0) {
      result.push({
        id: "supplier-payables",
        tone: "medium",
        title: "Supplier payable balance",
        message:
          "Review upcoming supplier payments before placing the next purchase.",
        value: money(supplierDue),
        href: "/admin/party-ledgers",
        button: "Open Supplier Ledgers",
      });
    }

    if (result.length === 0) {
      result.push({
        id: "all-clear",
        tone: "good",
        title: "No urgent owner actions",
        message:
          "Current profit, cash, stock, dues and order signals have no urgent exception.",
        href: "/admin/dashboard",
        button: "Back to Dashboard",
      });
    }

    const rank: Record<ActionTone, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      good: 3,
    };

    return result.sort((a, b) => rank[a.tone] - rank[b.tone]);
  }, [
    cashClosing,
    cheques,
    credits,
    orders,
    recentExpenseAverage,
    stockRows,
    suppliers,
    todayExpenses,
    todayProfitAlerts,
  ]);

  const actionCounts = useMemo(
    () => ({
      critical: actions.filter((row) => row.tone === "critical").length,
      high: actions.filter((row) => row.tone === "high").length,
      medium: actions.filter((row) => row.tone === "medium").length,
    }),
    [actions],
  );

  function buildOwnerReport() {
    const topActions = actions
      .filter((row) => row.tone !== "good")
      .slice(0, 5)
      .map(
        (row, index) =>
          `${index + 1}. ${row.title}${row.value ? ` — ${row.value}` : ""}`,
      );

    return [
      "NEW CITY STYLE — OWNER CLOSING REPORT",
      new Date().toLocaleString("en-IN"),
      "",
      `Sales: ${money(summary.salesTotal)}`,
      `Bills: ${summary.bills}`,
      `Actual Registered-Stock Profit: ${money(summary.actualProfit)}`,
      `Profit Margin: ${summary.profitMargin.toFixed(1)}%`,
      `Expenses: ${money(summary.todayExpenses)}`,
      `Operating Result: ${money(summary.operatingResult)}`,
      `Customer Due Created: ${money(summary.dueCreated)}`,
      "",
      "Owner Actions:",
      ...(topActions.length > 0 ? topActions : ["No urgent owner actions."]),
      "",
      "Profit rule: actual sold value minus registered purchase cost. MRP and Quick Items are excluded from profit.",
    ].join("\n");
  }

  function printOwnerReport() {
    window.print();
  }

  async function copyOwnerReport() {
    const text = buildOwnerReport();

    try {
      await navigator.clipboard.writeText(text);
      alert("Owner closing report copied.");
    } catch {
      alert("Unable to copy the report.");
    }
  }

  function shareOwnerReportWhatsApp() {
    const text = encodeURIComponent(buildOwnerReport());
    window.open(
      `https://wa.me/919010014001?text=${text}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  if (loading) {
    return (
      <main className="bacLoading">
        <div>NCS</div>
        <h2>Building today&apos;s action plan...</h2>
        <p>Profit • Cash • Stock • Dues • Orders</p>
        <style jsx>{`
          .bacLoading{min-height:78vh;display:grid;place-content:center;text-align:center;background:${IVORY};font-family:Poppins,Inter,Arial;color:${BLUE}}
          .bacLoading div{width:72px;height:72px;margin:auto;display:grid;place-items:center;border:2px solid ${GOLD};border-radius:22px;background:${BLUE};color:${GOLD};font-size:20px;font-weight:950}
          .bacLoading h2{margin:15px 0 3px;font-size:18px}.bacLoading p{margin:0;color:#667085;font-size:10px}
        `}</style>
      </main>
    );
  }

  return (
    <main className="bacPage">
      <section className="bacHero">
        <div>
          <span>NEW CITY STYLE • OWNER PRIORITY ENGINE</span>
          <h1>Business Action Center</h1>
          <p>
            A private owner screen that converts live business data into the
            next actions that need attention.
          </p>
        </div>

        <div className="bacHeroButtons noPrint">
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
          <button type="button" onClick={printOwnerReport}>
            Print / Save PDF
          </button>
          <button type="button" onClick={() => void copyOwnerReport()}>
            Copy Report
          </button>
          <button type="button" className="whatsapp" onClick={shareOwnerReportWhatsApp}>
            WhatsApp Owner
          </button>
        </div>
      </section>

      {errorText && <div className="bacError">{errorText}</div>}

      <section className="bacTopGrid">
        <TopCard
          label="Critical"
          value={String(actionCounts.critical)}
          note="Immediate owner attention"
          tone="critical"
        />
        <TopCard
          label="High Priority"
          value={String(actionCounts.high)}
          note="Handle today"
          tone="high"
        />
        <TopCard
          label="Medium Priority"
          value={String(actionCounts.medium)}
          note="Review before closing"
          tone="medium"
        />
        <TopCard
          label="Today Sales"
          value={money(summary.salesTotal)}
          note={`${summary.bills} completed bills`}
        />
        <TopCard
          label="Actual Profit"
          value={money(summary.actualProfit)}
          note={`${summary.profitMargin.toFixed(1)}% tracked margin`}
          tone={summary.actualProfit < 0 ? "critical" : "good"}
        />
        <TopCard
          label="After Expenses"
          value={money(summary.operatingResult)}
          note={`${money(summary.todayExpenses)} expenses`}
          tone={summary.operatingResult < 0 ? "critical" : "good"}
        />
      </section>

      <section className="bacPanel">
        <div className="bacSectionHeader">
          <div>
            <span>WHAT NEEDS ATTENTION NOW</span>
            <h2>Owner Priority Queue</h2>
          </div>
          <small>{actions.length} live action signal{actions.length === 1 ? "" : "s"}</small>
        </div>

        <div className="bacActionList">
          {actions.map((item, index) => (
            <article className={`bacAction ${item.tone}`} key={item.id}>
              <div className="bacActionRank">{index + 1}</div>
              <div className="bacActionText">
                <span>{item.tone.toUpperCase()}</span>
                <h3>{item.title}</h3>
                <p>{item.message}</p>
              </div>
              {item.value && <strong>{item.value}</strong>}
              <Link href={item.href}>{item.button} →</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="bacPanel">
        <div className="bacSectionHeader bacTrendHeader">
          <div>
            <span>ACTUAL PROFIT TREND</span>
            <h2>Registered-Stock Profit by Day</h2>
            <p>
              Actual sold value minus registered purchase cost. MRP and Quick
              Items are excluded.
            </p>
          </div>

          <select
            className="noPrint"
            value={profitRange}
            onChange={(event) =>
              setProfitRange(Number(event.target.value) as 7 | 30)
            }
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>
        </div>

        <div className="bacTrend">
          {trend.map((row) => {
            const height =
              row.profit === 0
                ? 3
                : Math.max(
                    5,
                    (Math.abs(row.profit) / maxProfitBar) * 100,
                  );

            return (
              <div className="bacTrendColumn" key={row.key}>
                <div className="bacTrendValue">
                  {row.bills > 0 ? money(row.profit) : "—"}
                </div>
                <div className="bacTrendTrack">
                  <div
                    className={row.profit < 0 ? "negative" : "positive"}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <strong>{row.label}</strong>
                <small>
                  {row.bills} bill{row.bills === 1 ? "" : "s"} •{" "}
                  {row.margin.toFixed(0)}%
                </small>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bacClosingReport printOnlyReport">
        <div>
          <span>DAILY OWNER CLOSING</span>
          <h2>{new Date().toLocaleDateString("en-IN", { dateStyle: "full" })}</h2>
        </div>

        <div className="bacReportGrid">
          <ReportRow label="Sales" value={money(summary.salesTotal)} />
          <ReportRow label="Bills" value={String(summary.bills)} />
          <ReportRow label="Paid at Billing" value={money(summary.paid)} />
          <ReportRow label="Due Created" value={money(summary.dueCreated)} />
          <ReportRow label="Registered Revenue" value={money(summary.registeredRevenue)} />
          <ReportRow label="Actual Profit" value={money(summary.actualProfit)} />
          <ReportRow label="Profit Margin" value={`${summary.profitMargin.toFixed(1)}%`} />
          <ReportRow label="Expenses" value={money(summary.todayExpenses)} />
          <ReportRow label="Operating Result" value={money(summary.operatingResult)} />
          <ReportRow
            label="Cash Difference"
            value={cashClosing ? money(n(cashClosing.difference)) : "Not closed"}
          />
        </div>

        <div className="bacReportRule">
          Profit is owner-private and uses actual sold value minus registered
          purchase cost. MRP and Quick Items are excluded from profit.
        </div>
      </section>

      <style jsx global>{`
        .bacPage{min-height:100vh;padding:18px;background:${IVORY};color:${DEEP};font-family:Poppins,Inter,Arial,sans-serif}
        .bacHero{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:23px;border:1px solid rgba(212,175,55,.65);border-radius:23px;background:linear-gradient(135deg,${DEEP},${BLUE} 68%,#1952ae);color:#fff;box-shadow:0 18px 40px rgba(3,21,63,.18)}
        .bacHero:after{content:"";position:absolute;width:250px;height:250px;right:-100px;top:-150px;border-radius:50%;background:rgba(212,175,55,.16)}
        .bacHero>div{position:relative;z-index:1}.bacHero span,.bacSectionHeader span,.bacClosingReport>div>span{color:${GOLD};font-size:8px;font-weight:950;letter-spacing:1px}
        .bacHero h1{margin:5px 0;font-size:28px}.bacHero p{max-width:690px;margin:0;color:rgba(255,255,255,.7);font-size:10px;line-height:1.6}
        .bacHeroButtons{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px;max-width:430px}.bacHeroButtons button{height:37px;padding:0 11px;border:1px solid rgba(255,255,255,.2);border-radius:9px;background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:8px;font-weight:900;cursor:pointer}.bacHeroButtons button:hover{border-color:${GOLD};transform:translateY(-1px)}.bacHeroButtons button.whatsapp{background:#0a7a50;border-color:#8ae0bd}
        .bacError{margin:11px 0;padding:10px 12px;border:1px solid #f1a7a0;border-radius:10px;background:#fef3f2;color:#b42318;font-size:9px;font-weight:800}
        .bacTopGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px;margin-top:13px}.bacTopCard{min-height:105px;padding:14px;border:1px solid #e2e6ed;border-radius:15px;background:#fff;box-shadow:0 7px 18px rgba(3,21,63,.04)}.bacTopCard span{display:block;color:#667085;font-size:7px;font-weight:950;letter-spacing:.6px}.bacTopCard strong{display:block;margin-top:9px;color:${BLUE};font-size:20px}.bacTopCard small{display:block;margin-top:7px;color:#98a2b3;font-size:7px;line-height:1.4}.bacTopCard.critical{background:#fff4f2}.bacTopCard.critical strong{color:#b42318}.bacTopCard.high{background:#fff8e8}.bacTopCard.high strong{color:#a15c00}.bacTopCard.medium strong{color:#735a12}.bacTopCard.good strong{color:#067647}
        .bacPanel,.bacClosingReport{margin-top:12px;padding:18px;border:1px solid #e2e6ed;border-radius:18px;background:#fff;box-shadow:0 8px 24px rgba(3,21,63,.05)}
        .bacSectionHeader{display:flex;align-items:center;justify-content:space-between;gap:15px}.bacSectionHeader h2{margin:3px 0 0;color:${BLUE};font-size:19px}.bacSectionHeader p{margin:5px 0 0;color:#667085;font-size:9px}.bacSectionHeader small{color:#667085;font-size:8px;font-weight:850}.bacTrendHeader select{height:34px;border:1px solid #d8dde7;border-radius:9px;padding:0 9px;background:#fff;color:${BLUE};font:inherit;font-size:8px;font-weight:900}
        .bacActionList{display:grid;gap:8px;margin-top:14px}.bacAction{display:grid;grid-template-columns:36px minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:12px;border:1px solid #e7eaf0;border-left-width:4px;border-radius:13px;background:#fff}.bacAction.critical{border-left-color:#d92d20;background:#fffafa}.bacAction.high{border-left-color:#e59a16;background:#fffdfa}.bacAction.medium{border-left-color:${GOLD}}.bacAction.good{border-left-color:#12b76a;background:#f8fffb}
        .bacActionRank{width:31px;height:31px;display:grid;place-items:center;border-radius:9px;background:${BLUE};color:${GOLD};font-size:10px;font-weight:950}.bacActionText span{font-size:7px;font-weight:950;color:#98a2b3}.bacActionText h3{margin:2px 0;color:${DEEP};font-size:11px}.bacActionText p{margin:0;color:#667085;font-size:8px;line-height:1.45}.bacAction>strong{color:${BLUE};font-size:10px;white-space:nowrap}.bacAction>a{height:32px;display:inline-flex;align-items:center;padding:0 10px;border-radius:8px;background:${BLUE};color:#fff!important;text-decoration:none;font-size:7px;font-weight:900;white-space:nowrap}
        .bacTrend{height:260px;display:flex;gap:7px;align-items:flex-end;overflow-x:auto;margin-top:18px;padding:6px 4px 2px}.bacTrendColumn{min-width:44px;flex:1;height:100%;display:grid;grid-template-rows:27px 1fr 19px 22px;text-align:center}.bacTrendValue{overflow:hidden;color:#667085;font-size:7px;font-weight:850;text-overflow:ellipsis;white-space:nowrap}.bacTrendTrack{position:relative;display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid #dfe3ea;background:linear-gradient(180deg,rgba(10,46,115,.02),rgba(10,46,115,.05))}.bacTrendTrack div{width:55%;max-width:26px;border-radius:5px 5px 1px 1px;transition:height .3s ease}.bacTrendTrack .positive{background:linear-gradient(180deg,#18a86b,#0a7b51)}.bacTrendTrack .negative{background:linear-gradient(180deg,#ec6a5e,#b42318)}.bacTrendColumn>strong{align-self:end;color:${BLUE};font-size:7px}.bacTrendColumn>small{color:#98a2b3;font-size:6px;line-height:1.3}
        .bacClosingReport>div:first-child h2{margin:4px 0 0;color:${BLUE};font-size:18px}.bacReportGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:14px}.bacReportRow{padding:10px;border:1px solid #e8ebf0;border-radius:10px;background:#fbfcfe}.bacReportRow span{display:block;color:#98a2b3;font-size:7px;font-weight:850}.bacReportRow strong{display:block;margin-top:6px;color:${BLUE};font-size:11px}.bacReportRule{margin-top:12px;padding:10px;border-radius:9px;background:rgba(212,175,55,.11);color:#6c5415;font-size:8px;font-weight:800;line-height:1.5}
        @media(max-width:1200px){.bacTopGrid{grid-template-columns:repeat(3,minmax(0,1fr))}.bacReportGrid{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:760px){.bacPage{padding:9px}.bacHero{align-items:stretch;flex-direction:column}.bacHeroButtons{justify-content:flex-start;max-width:none}.bacTopGrid{grid-template-columns:1fr 1fr}.bacAction{grid-template-columns:34px 1fr}.bacAction>strong,.bacAction>a{grid-column:2}.bacAction>a{justify-self:start}.bacReportGrid{grid-template-columns:1fr 1fr}}
        @media print{
          body{background:#fff!important}
          .ncsSidebar,.ncsBusinessTicker,.ncsMobileMenuButton,.noPrint{display:none!important}
          .ncsAdminContent{margin-left:0!important}
          .bacPage{padding:0;background:#fff}
          .bacHero{background:#fff!important;color:${DEEP};border-color:#ddd;box-shadow:none}
          .bacHero p{color:#555}.bacPanel{box-shadow:none;break-inside:avoid}.bacAction>a{display:none}
          .bacClosingReport{box-shadow:none}
        }
      `}</style>
    </main>
  );
}

function TopCard({
  label,
  value,
  note,
  tone = "",
}: {
  label: string;
  value: string;
  note: string;
  tone?: ActionTone | "";
}) {
  return (
    <div className={`bacTopCard ${tone}`}>
      <span>{label.toUpperCase()}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function ReportRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bacReportRow">
      <span>{label.toUpperCase()}</span>
      <strong>{value}</strong>
    </div>
  );
}