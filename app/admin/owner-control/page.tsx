"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const BLUE = "#0A2E73";
const DEEP = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";

type TabKey = "closing" | "guard" | "profit" | "trends" | "cash" | "customers";

type PosSale = {
  id: string;
  invoice_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  sale_status?: string | null;
  payment_method?: string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  is_deleted?: boolean | null;
  created_at?: string | null;
};

type Expense = {
  id: string;
  expense_date: string;
  category_name?: string | null;
  amount?: number | string | null;
  payment_method?: string | null;
  is_deleted?: boolean | null;
};

type Purchase = {
  id: string;
  purchase_number?: string | null;
  supplier_name?: string | null;
  purchase_date?: string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  purchase_status?: string | null;
  deleted_at?: string | null;
};

type CashBankTransaction = {
  id: string;
  transaction_date: string;
  account_type?: string | null;
  direction?: "in" | "out" | null;
  amount?: number | string | null;
  is_deleted?: boolean | null;
};

type ProfitAlert = {
  id: number;
  alert_type: string;
  source?: string | null;
  invoice_number?: string | null;
  product_name?: string | null;
  purchase_price?: number | string | null;
  actual_selling_price?: number | string | null;
  profit_per_unit?: number | string | null;
  margin_percent?: number | string | null;
  final_bill_amount?: number | string | null;
  registered_revenue?: number | string | null;
  registered_purchase_cost?: number | string | null;
  bill_profit?: number | string | null;
  created_at?: string | null;
};

type GuardSettings = {
  id: number;
  minimum_profit_margin_percent: number;
  low_profit_alert_enabled: boolean;
  loss_sale_alert_enabled: boolean;
  bill_profit_summary_enabled: boolean;
};

type CashClosing = {
  id?: number;
  closing_date: string;
  opening_cash: number;
  expected_cash: number;
  actual_cash: number;
  difference: number;
  notes: string;
};

type OrderRow = {
  id: string | number;
  customer_name?: string | null;
  phone?: string | null;
  email?: string | null;
  total_amount?: number | string | null;
  order_status?: string | null;
  status?: string | null;
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

type Customer360 = {
  key: string;
  name: string;
  phone: string;
  email: string;
  posSpend: number;
  onlineSpend: number;
  posBills: number;
  onlineOrders: number;
  due: number;
  nextDueDate: string | null;
  lastPurchaseAt: string | null;
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

function todayInput() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function localRange(dateValue: string) {
  const start = new Date(`${dateValue}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function cleanPhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function safeStatus(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export default function OwnerControlCenterPage() {
  const [tab, setTab] = useState<TabKey>("closing");
  const [selectedDate, setSelectedDate] = useState(todayInput());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [sales, setSales] = useState<PosSale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashBankTransaction[]>([]);
  const [profitAlerts, setProfitAlerts] = useState<ProfitAlert[]>([]);
  const [allProfitHistory, setAllProfitHistory] = useState<ProfitAlert[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [credits, setCredits] = useState<CreditRow[]>([]);

  const [settings, setSettings] = useState<GuardSettings>({
    id: 1,
    minimum_profit_margin_percent: 15,
    low_profit_alert_enabled: true,
    loss_sale_alert_enabled: true,
    bill_profit_summary_enabled: true,
  });

  const [closing, setClosing] = useState<CashClosing>({
    closing_date: todayInput(),
    opening_cash: 0,
    expected_cash: 0,
    actual_cash: 0,
    difference: 0,
    notes: "",
  });

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [profitPage, setProfitPage] = useState(1);
  const [profitTrendRange, setProfitTrendRange] = useState<7 | 30>(7);
  const PROFIT_PAGE_SIZE = 15;

  const loadCore = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { start, end } = localRange(selectedDate);

    try {
      const [
        saleResult,
        expenseResult,
        purchaseResult,
        cashResult,
        dayProfitResult,
        profitHistoryResult,
        settingsResult,
        closingResult,
        ordersResult,
        creditsResult,
      ] = await Promise.all([
        supabase
          .from("pos_sales")
          .select("id,invoice_number,customer_name,customer_phone,sale_status,payment_method,total_amount,paid_amount,due_amount,is_deleted,created_at")
          .eq("is_deleted", false)
          .gte("created_at", start)
          .lt("created_at", end)
          .order("created_at", { ascending: false }),
        supabase
          .from("expenses")
          .select("id,expense_date,category_name,amount,payment_method,is_deleted")
          .eq("is_deleted", false)
          .gte("expense_date", start)
          .lt("expense_date", end)
          .order("expense_date", { ascending: false }),
        supabase
          .from("purchases")
          .select("id,purchase_number,supplier_name,purchase_date,total_amount,paid_amount,due_amount,purchase_status,deleted_at")
          .is("deleted_at", null)
          .gte("purchase_date", start)
          .lt("purchase_date", end)
          .order("purchase_date", { ascending: false }),
        supabase
          .from("cash_bank_transactions")
          .select("id,transaction_date,account_type,direction,amount,is_deleted")
          .eq("is_deleted", false)
          .gte("transaction_date", start)
          .lt("transaction_date", end)
          .order("transaction_date", { ascending: false }),
        supabase
          .from("owner_profit_alerts")
          .select("*")
          .eq("alert_type", "BILL_PROFIT_SUMMARY")
          .gte("created_at", start)
          .lt("created_at", end)
          .order("created_at", { ascending: false }),
        supabase
          .from("owner_profit_alerts")
          .select("*")
          .eq("alert_type", "BILL_PROFIT_SUMMARY")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("owner_business_settings")
          .select("*")
          .eq("id", 1)
          .maybeSingle(),
        supabase
          .from("owner_daily_cash_closings")
          .select("*")
          .eq("closing_date", selectedDate)
          .maybeSingle(),
        supabase
          .from("orders")
          .select("id,customer_name,phone,email,total_amount,order_status,status,created_at")
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("customer_credit_accounts")
          .select("id,customer_name,customer_phone,current_balance,next_due_date,is_active")
          .eq("is_active", true)
          .order("current_balance", { ascending: false }),
      ]);

      if (saleResult.error) throw saleResult.error;
      if (settingsResult.error) throw settingsResult.error;
      if (closingResult.error) throw closingResult.error;

      setSales((saleResult.data || []) as PosSale[]);
      setExpenses(expenseResult.error ? [] : ((expenseResult.data || []) as Expense[]));
      setPurchases(purchaseResult.error ? [] : ((purchaseResult.data || []) as Purchase[]));
      setCashTransactions(cashResult.error ? [] : ((cashResult.data || []) as CashBankTransaction[]));
      setProfitAlerts(dayProfitResult.error ? [] : ((dayProfitResult.data || []) as ProfitAlert[]));
      setAllProfitHistory(profitHistoryResult.error ? [] : ((profitHistoryResult.data || []) as ProfitAlert[]));
      setOrders(ordersResult.error ? [] : ((ordersResult.data || []) as OrderRow[]));
      setCredits(creditsResult.error ? [] : ((creditsResult.data || []) as CreditRow[]));

      if (settingsResult.data) {
        setSettings({
          id: 1,
          minimum_profit_margin_percent: n(settingsResult.data.minimum_profit_margin_percent),
          low_profit_alert_enabled: settingsResult.data.low_profit_alert_enabled !== false,
          loss_sale_alert_enabled: settingsResult.data.loss_sale_alert_enabled !== false,
          bill_profit_summary_enabled: settingsResult.data.bill_profit_summary_enabled !== false,
        });
      }

      const saved = closingResult.data as any;
      setClosing(
        saved
          ? {
              id: saved.id,
              closing_date: saved.closing_date,
              opening_cash: n(saved.opening_cash),
              expected_cash: n(saved.expected_cash),
              actual_cash: n(saved.actual_cash),
              difference: n(saved.difference),
              notes: String(saved.notes || ""),
            }
          : {
              closing_date: selectedDate,
              opening_cash: 0,
              expected_cash: 0,
              actual_cash: 0,
              difference: 0,
              notes: "",
            },
      );
    } catch (error) {
      console.error("Owner Control Center load error:", error);
      setMessage(error instanceof Error ? error.message : "Unable to load owner control data.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  const completedSales = useMemo(
    () =>
      sales.filter((sale) => {
        const status = safeStatus(sale.sale_status || "completed");
        return !["cancelled", "void", "refunded", "deleted"].includes(status);
      }),
    [sales],
  );

  const daily = useMemo(() => {
    const salesTotal = completedSales.reduce((sum, row) => sum + n(row.total_amount), 0);
    const paidTotal = completedSales.reduce((sum, row) => sum + n(row.paid_amount), 0);
    const duesCreated = completedSales.reduce((sum, row) => sum + n(row.due_amount), 0);
    const cashSales = completedSales
      .filter((row) => safeStatus(row.payment_method) === "cash")
      .reduce((sum, row) => sum + n(row.paid_amount || row.total_amount), 0);
    const upiSales = completedSales
      .filter((row) => safeStatus(row.payment_method) === "upi")
      .reduce((sum, row) => sum + n(row.paid_amount || row.total_amount), 0);
    const cardSales = completedSales
      .filter((row) => safeStatus(row.payment_method) === "card")
      .reduce((sum, row) => sum + n(row.paid_amount || row.total_amount), 0);
    const creditSales = completedSales
      .filter((row) => safeStatus(row.payment_method) === "credit")
      .reduce((sum, row) => sum + n(row.total_amount), 0);

    const expenseTotal = expenses.reduce((sum, row) => sum + n(row.amount), 0);
    const purchaseTotal = purchases.reduce((sum, row) => sum + n(row.total_amount), 0);
    const purchasePaid = purchases.reduce((sum, row) => sum + n(row.paid_amount), 0);

    const registeredRevenue = profitAlerts.reduce(
      (sum, row) => sum + n(row.registered_revenue || row.actual_selling_price),
      0,
    );
    const registeredCost = profitAlerts.reduce(
      (sum, row) => sum + n(row.registered_purchase_cost || row.purchase_price),
      0,
    );
    const grossProfit = profitAlerts.reduce(
      (sum, row) => sum + n(row.bill_profit ?? row.profit_per_unit),
      0,
    );
    const margin = registeredRevenue > 0 ? (grossProfit / registeredRevenue) * 100 : 0;

    const cashIn = cashTransactions
      .filter((row) => safeStatus(row.account_type) === "cash" && safeStatus(row.direction) === "in")
      .reduce((sum, row) => sum + n(row.amount), 0);
    const cashOut = cashTransactions
      .filter((row) => safeStatus(row.account_type) === "cash" && safeStatus(row.direction) === "out")
      .reduce((sum, row) => sum + n(row.amount), 0);

    return {
      salesTotal,
      paidTotal,
      duesCreated,
      cashSales,
      upiSales,
      cardSales,
      creditSales,
      expenseTotal,
      purchaseTotal,
      purchasePaid,
      registeredRevenue,
      registeredCost,
      grossProfit,
      margin,
      cashIn,
      cashOut,
      cashNet: cashIn - cashOut,
      bills: completedSales.length,
      operatingResult: grossProfit - expenseTotal,
    };
  }, [cashTransactions, completedSales, expenses, profitAlerts, purchases]);

  const expectedCash = closing.opening_cash + daily.cashNet;
  const cashDifference = closing.actual_cash - expectedCash;

  const customerRows = useMemo<Customer360[]>(() => {
    const map = new Map<string, Customer360>();

    const ensure = (
      nameValue: string | null | undefined,
      phoneValue: string | null | undefined,
      emailValue = "",
    ) => {
      const phone = cleanPhone(phoneValue);
      const name = String(nameValue || "Customer").trim() || "Customer";
      const email = String(emailValue || "").trim().toLowerCase();
      const key = phone || email || name.toLowerCase();

      const current =
        map.get(key) ||
        ({
          key,
          name,
          phone,
          email,
          posSpend: 0,
          onlineSpend: 0,
          posBills: 0,
          onlineOrders: 0,
          due: 0,
          nextDueDate: null,
          lastPurchaseAt: null,
        } satisfies Customer360);

      if (current.name === "Customer" && name !== "Customer") current.name = name;
      if (!current.phone && phone) current.phone = phone;
      if (!current.email && email) current.email = email;
      map.set(key, current);
      return current;
    };

    // Use the profit-history period plus today's loaded sale detail for current web owner view.
    // Customer 360 queries all recent orders, while POS detail is fetched separately below on demand in future app sync.
    sales.forEach((sale) => {
      const status = safeStatus(sale.sale_status || "completed");
      if (["cancelled", "void", "refunded", "deleted"].includes(status)) return;
      const customer = ensure(sale.customer_name, sale.customer_phone);
      customer.posSpend += n(sale.total_amount);
      customer.posBills += 1;
      if (
        sale.created_at &&
        (!customer.lastPurchaseAt ||
          new Date(sale.created_at).getTime() > new Date(customer.lastPurchaseAt).getTime())
      ) {
        customer.lastPurchaseAt = sale.created_at;
      }
    });

    orders.forEach((order) => {
      if (safeStatus(order.order_status || order.status) === "cancelled") return;
      const customer = ensure(order.customer_name, order.phone, order.email || "");
      customer.onlineSpend += n(order.total_amount);
      customer.onlineOrders += 1;
      if (
        order.created_at &&
        (!customer.lastPurchaseAt ||
          new Date(order.created_at).getTime() > new Date(customer.lastPurchaseAt).getTime())
      ) {
        customer.lastPurchaseAt = order.created_at;
      }
    });

    credits.forEach((credit) => {
      const customer = ensure(credit.customer_name, credit.customer_phone);
      customer.due = Math.max(customer.due, n(credit.current_balance));
      customer.nextDueDate = credit.next_due_date || customer.nextDueDate;
    });

    const query = customerSearch.trim().toLowerCase();

    return [...map.values()]
      .filter((row) => {
        if (!query) return true;
        return [row.name, row.phone, row.email].some((value) =>
          value.toLowerCase().includes(query),
        );
      })
      .sort(
        (a, b) =>
          b.posSpend + b.onlineSpend - (a.posSpend + a.onlineSpend),
      );
  }, [credits, customerSearch, orders, sales]);

  const selectedCustomer =
    customerRows.find((row) => row.key === selectedCustomerKey) ||
    customerRows[0] ||
    null;

  const profitTrendRows = useMemo(() => {
    const rows: {
      key: string;
      label: string;
      revenue: number;
      profit: number;
      margin: number;
      bills: number;
    }[] = [];

    for (let index = profitTrendRange - 1; index >= 0; index -= 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - index);

      const key = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

      const dayRows = allProfitHistory.filter((row) => {
        if (!row.created_at) return false;
        const created = new Date(row.created_at);
        if (Number.isNaN(created.getTime())) return false;

        const createdKey = [
          created.getFullYear(),
          String(created.getMonth() + 1).padStart(2, "0"),
          String(created.getDate()).padStart(2, "0"),
        ].join("-");

        return createdKey === key;
      });

      const revenue = dayRows.reduce(
        (sum, row) => sum + n(row.registered_revenue || row.actual_selling_price),
        0,
      );

      const profit = dayRows.reduce(
        (sum, row) => sum + n(row.bill_profit ?? row.profit_per_unit),
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
  }, [allProfitHistory, profitTrendRange]);

  const maxProfitTrendValue = Math.max(
    1,
    ...profitTrendRows.map((row) => Math.abs(row.profit)),
  );

  function buildOwnerClosingText() {
    return [
      "NEW CITY STYLE — OWNER CLOSING REPORT",
      selectedDate,
      "",
      `Sales: ${money(daily.salesTotal)}`,
      `Bills: ${daily.bills}`,
      `Registered Revenue: ${money(daily.registeredRevenue)}`,
      `Registered Purchase Cost: ${money(daily.registeredCost)}`,
      `Actual Gross Profit: ${money(daily.grossProfit)}`,
      `Profit Margin: ${daily.margin.toFixed(1)}%`,
      `Expenses: ${money(daily.expenseTotal)}`,
      `Operating Result: ${money(daily.operatingResult)}`,
      `Customer Due Created: ${money(daily.duesCreated)}`,
      `Cash In: ${money(daily.cashIn)}`,
      `Cash Out: ${money(daily.cashOut)}`,
      "",
      "Profit rule: actual sold value minus registered purchase cost. MRP and Quick Items are excluded from profit.",
    ].join("\n");
  }

  function printOwnerClosing() {
    window.print();
  }

  async function copyOwnerClosing() {
    try {
      await navigator.clipboard.writeText(buildOwnerClosingText());
      setMessage("Owner closing report copied.");
    } catch {
      setMessage("Unable to copy owner closing report.");
    }
  }

  function shareOwnerClosingWhatsApp() {
    const text = encodeURIComponent(buildOwnerClosingText());
    window.open(
      `https://wa.me/919010014001?text=${text}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const totalProfitPages = Math.max(1, Math.ceil(allProfitHistory.length / PROFIT_PAGE_SIZE));
  const safeProfitPage = Math.min(profitPage, totalProfitPages);
  const pagedProfit = allProfitHistory.slice(
    (safeProfitPage - 1) * PROFIT_PAGE_SIZE,
    safeProfitPage * PROFIT_PAGE_SIZE,
  );

  async function saveSettings() {
    setSaving(true);
    setMessage("");
    const { error } = await supabase
      .from("owner_business_settings")
      .update({
        minimum_profit_margin_percent: Math.max(
          0,
          Math.min(100, n(settings.minimum_profit_margin_percent)),
        ),
        low_profit_alert_enabled: settings.low_profit_alert_enabled,
        loss_sale_alert_enabled: settings.loss_sale_alert_enabled,
        bill_profit_summary_enabled: settings.bill_profit_summary_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    setSaving(false);
    setMessage(error ? error.message : "Profit Guard settings saved.");
  }

  async function saveCashClosing() {
    setSaving(true);
    setMessage("");

    const payload = {
      closing_date: selectedDate,
      opening_cash: Number(closing.opening_cash.toFixed(2)),
      expected_cash: Number(expectedCash.toFixed(2)),
      actual_cash: Number(closing.actual_cash.toFixed(2)),
      difference: Number(cashDifference.toFixed(2)),
      notes: closing.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("owner_daily_cash_closings")
      .upsert(payload, { onConflict: "closing_date" });

    setSaving(false);
    setMessage(error ? error.message : "Daily cash closing saved.");
    if (!error) void loadCore();
  }

  if (loading) {
    return (
      <main className="occLoading">
        <div>NCS</div>
        <h2>Building Owner Control Center...</h2>
        <p>Sales • Profit • Cash • Customers</p>
        <style jsx>{`
          .occLoading{min-height:75vh;display:grid;place-content:center;text-align:center;background:${IVORY};font-family:Poppins,Inter,Arial;color:${BLUE}}
          .occLoading div{width:68px;height:68px;border-radius:22px;margin:auto;display:grid;place-items:center;background:${BLUE};color:${GOLD};font-weight:950;font-size:20px}
          .occLoading h2{margin:16px 0 4px;font-size:18px}.occLoading p{margin:0;color:#667085;font-size:11px}
        `}</style>
      </main>
    );
  }

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "closing", label: "Daily Closing", icon: "📋" },
    { key: "guard", label: "Profit Guard", icon: "🛡️" },
    { key: "profit", label: "Bill Profit", icon: "💹" },
    { key: "trends", label: "Profit Trends", icon: "📈" },
    { key: "cash", label: "Cash Closing", icon: "💵" },
    { key: "customers", label: "Customer 360", icon: "👤" },
  ];

  return (
    <main className="occPage">
      <section className="occHero">
        <div>
          <span>NEW CITY STYLE • OWNER COMMAND</span>
          <h1>Business Control Center</h1>
          <p>One private screen for daily closing, real profit, cash control and customer intelligence.</p>
        </div>

        <div className="occDateBox">
          <label>Business Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => {
              setSelectedDate(event.target.value);
              setProfitPage(1);
            }}
          />
          <button type="button" onClick={() => void loadCore()}>
            Refresh
          </button>
        </div>
      </section>

      <nav className="occTabs">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? "active" : ""}
            onClick={() => setTab(item.key)}
          >
            <b>{item.icon}</b>
            {item.label}
          </button>
        ))}
      </nav>

      {message && <div className="occMessage">{message}</div>}

      {tab === "closing" && (
        <>
          <section className="occMetrics">
            <Metric label="Today Sales" value={money(daily.salesTotal)} note={`${daily.bills} completed bills`} />
            <Metric label="Actual Gross Profit" value={money(daily.grossProfit)} note={`${daily.margin.toFixed(1)}% registered-stock margin`} tone={daily.grossProfit < 0 ? "red" : "green"} />
            <Metric label="Operating Result" value={money(daily.operatingResult)} note="Gross profit − expenses" tone={daily.operatingResult < 0 ? "red" : "green"} />
            <Metric label="Expenses" value={money(daily.expenseTotal)} note={`${expenses.length} expense entries`} tone="gold" />
            <Metric label="Purchases" value={money(daily.purchaseTotal)} note={`${purchases.length} supplier purchases`} />
            <Metric label="Dues Created" value={money(daily.duesCreated)} note="Customer credit created today" tone="gold" />
          </section>

          <section className="occGridTwo">
            <Panel title="Payment Mix" eyebrow="TODAY MONEY">
              <MoneyRows
                rows={[
                  ["Cash Sales", daily.cashSales],
                  ["UPI Sales", daily.upiSales],
                  ["Card Sales", daily.cardSales],
                  ["Credit Sales", daily.creditSales],
                  ["Paid / Collected at Billing", daily.paidTotal],
                ]}
              />
            </Panel>

            <Panel title="Profit Reality" eyebrow="REGISTERED STOCK ONLY">
              <MoneyRows
                rows={[
                  ["Registered Revenue", daily.registeredRevenue],
                  ["Registered Purchase Cost", daily.registeredCost],
                  ["Actual Gross Profit", daily.grossProfit],
                  ["Operating Expenses", daily.expenseTotal],
                  ["After Expense Result", daily.operatingResult],
                ]}
              />
              <div className="occRule">
                MRP is not used. Quick Items are excluded from profit.
              </div>
            </Panel>
          </section>

          <section className="occGridTwo">
            <Panel title="Cash Movement" eyebrow="CASH & BANK BOOK">
              <MoneyRows
                rows={[
                  ["Cash In", daily.cashIn],
                  ["Cash Out", daily.cashOut],
                  ["Net Cash Movement", daily.cashNet],
                ]}
              />
            </Panel>

            <Panel title="Owner Attention" eyebrow="CLOSING SIGNAL">
              <div className={`occHealth ${daily.operatingResult >= 0 ? "good" : "bad"}`}>
                <strong>{daily.operatingResult >= 0 ? "BUSINESS POSITIVE" : "ATTENTION REQUIRED"}</strong>
                <span>
                  {daily.operatingResult >= 0
                    ? `Registered-stock gross profit is ${money(daily.grossProfit)} before owner-level adjustments.`
                    : `Expenses are currently above registered-stock gross profit by ${money(Math.abs(daily.operatingResult))}.`}
                </span>
              </div>
            </Panel>
          </section>

          <section className="occReportTools noPrint">
            <div>
              <span>OWNER CLOSING REPORT</span>
              <strong>Print, save as PDF or send the summary to your own WhatsApp.</strong>
            </div>
            <div>
              <button type="button" onClick={printOwnerClosing}>Print / Save PDF</button>
              <button type="button" onClick={() => void copyOwnerClosing()}>Copy Report</button>
              <button type="button" className="wa" onClick={shareOwnerClosingWhatsApp}>WhatsApp Owner</button>
              <a href="/admin/business-action-center">Open Action Center →</a>
            </div>
          </section>
        </>
      )}

      {tab === "guard" && (
        <section className="occSettings">
          <div className="occSectionHeading">
            <span>OWNER PROFIT GUARD</span>
            <h2>Private Margin Rules</h2>
            <p>These settings control the web POS pre-bill profit alerts. Customer-facing invoice screens do not show cost or profit.</p>
          </div>

          <div className="occSettingGrid">
            <label className="occSettingCard">
              <span>Minimum Profit Margin</span>
              <strong>{n(settings.minimum_profit_margin_percent).toFixed(1)}%</strong>
              <input
                type="range"
                min="0"
                max="50"
                step="0.5"
                value={settings.minimum_profit_margin_percent}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    minimum_profit_margin_percent: Number(event.target.value),
                  }))
                }
              />
              <small>Below this margin → Low Profit alert.</small>
            </label>

            <Toggle
              title="Low Profit Alerts"
              text="Alert before bill completion when margin drops below your target."
              checked={settings.low_profit_alert_enabled}
              onChange={(checked) =>
                setSettings((current) => ({ ...current, low_profit_alert_enabled: checked }))
              }
            />

            <Toggle
              title="Loss Sale Alerts"
              text="Critical alert when actual selling value goes below purchase cost."
              checked={settings.loss_sale_alert_enabled}
              onChange={(checked) =>
                setSettings((current) => ({ ...current, loss_sale_alert_enabled: checked }))
              }
            />

            <Toggle
              title="Per-Bill Profit Summary"
              text="Save private actual profit after each completed registered-stock bill."
              checked={settings.bill_profit_summary_enabled}
              onChange={(checked) =>
                setSettings((current) => ({ ...current, bill_profit_summary_enabled: checked }))
              }
            />
          </div>

          <button className="occPrimary" type="button" disabled={saving} onClick={() => void saveSettings()}>
            {saving ? "Saving..." : "Save Owner Guard Settings"}
          </button>
        </section>
      )}

      {tab === "profit" && (
        <section className="occTablePanel">
          <div className="occSectionHeading">
            <span>BILL PROFIT HISTORY</span>
            <h2>Actual Profit by Completed Bill</h2>
            <p>Actual registered-stock revenue minus registered purchase cost. MRP and Quick Items are excluded.</p>
          </div>

          <div className="occTableWrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Final Bill</th>
                  <th>Registered Revenue</th>
                  <th>Purchase Cost</th>
                  <th>Actual Profit</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {pagedProfit.length === 0 ? (
                  <tr><td colSpan={7} className="occEmpty">No completed-bill profit summaries yet.</td></tr>
                ) : (
                  pagedProfit.map((row) => {
                    const revenue = n(row.registered_revenue || row.actual_selling_price);
                    const cost = n(row.registered_purchase_cost || row.purchase_price);
                    const profit = n(row.bill_profit ?? row.profit_per_unit);
                    return (
                      <tr key={row.id}>
                        <td>{row.created_at ? new Date(row.created_at).toLocaleString("en-IN") : "—"}</td>
                        <td><strong>{row.invoice_number || "—"}</strong></td>
                        <td>{money(n(row.final_bill_amount))}</td>
                        <td>{money(revenue)}</td>
                        <td>{money(cost)}</td>
                        <td className={profit < 0 ? "occRed" : "occGreen"}>{money(profit)}</td>
                        <td>{n(row.margin_percent).toFixed(1)}%</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="occPager">
            <span>{allProfitHistory.length} bills</span>
            <div>
              <button type="button" disabled={safeProfitPage <= 1} onClick={() => setProfitPage((p) => Math.max(1, p - 1))}>← Previous</button>
              <strong>{safeProfitPage} / {totalProfitPages}</strong>
              <button type="button" disabled={safeProfitPage >= totalProfitPages} onClick={() => setProfitPage((p) => Math.min(totalProfitPages, p + 1))}>Next →</button>
            </div>
          </div>
        </section>
      )}

      {tab === "trends" && (
        <section className="occTablePanel">
          <div className="occSectionHeading occTrendHeading">
            <div>
              <span>ACTUAL PROFIT TREND</span>
              <h2>Daily Registered-Stock Profit</h2>
              <p>Actual sold value minus purchase cost. MRP and Quick Items are excluded.</p>
            </div>

            <select
              value={profitTrendRange}
              onChange={(event) =>
                setProfitTrendRange(Number(event.target.value) as 7 | 30)
              }
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>

          <div className="occProfitTrend">
            {profitTrendRows.map((row) => {
              const height =
                row.profit === 0
                  ? 3
                  : Math.max(
                      5,
                      (Math.abs(row.profit) / maxProfitTrendValue) * 100,
                    );

              return (
                <div className="occProfitTrendColumn" key={row.key}>
                  <div className="occProfitTrendValue">
                    {row.bills > 0 ? money(row.profit) : "—"}
                  </div>
                  <div className="occProfitTrendTrack">
                    <div
                      className={row.profit < 0 ? "negative" : "positive"}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <strong>{row.label}</strong>
                  <small>{row.bills} bill{row.bills === 1 ? "" : "s"} • {row.margin.toFixed(0)}%</small>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === "cash" && (
        <section className="occSettings">
          <div className="occSectionHeading">
            <span>DAILY CASH CLOSING</span>
            <h2>Expected Cash vs Drawer Cash</h2>
            <p>Expected cash uses Cash & Bank Book movement, so collections, expenses, supplier payments and refunds already flow through the same accounting source.</p>
          </div>

          <section className="occMetrics occCashMetrics">
            <Metric label="Opening Cash" value={money(closing.opening_cash)} note="You enter this once for the day" />
            <Metric label="Cash In" value={money(daily.cashIn)} note="Cash & Bank Book" tone="green" />
            <Metric label="Cash Out" value={money(daily.cashOut)} note="Cash & Bank Book" tone="red" />
            <Metric label="Expected Drawer" value={money(expectedCash)} note="Opening + Cash In − Cash Out" />
            <Metric label="Actual Drawer" value={money(closing.actual_cash)} note="Count cash physically" />
            <Metric
              label="Difference"
              value={money(cashDifference)}
              note={cashDifference === 0 ? "Matched" : cashDifference > 0 ? "Excess cash" : "Cash shortage"}
              tone={Math.abs(cashDifference) < 0.01 ? "green" : "red"}
            />
          </section>

          <div className="occCashForm">
            <label>
              <span>Opening Cash</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={closing.opening_cash}
                onChange={(event) => setClosing((current) => ({ ...current, opening_cash: n(event.target.value) }))}
              />
            </label>
            <label>
              <span>Actual Cash Count</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={closing.actual_cash}
                onChange={(event) => setClosing((current) => ({ ...current, actual_cash: n(event.target.value) }))}
              />
            </label>
            <label className="wide">
              <span>Closing Notes</span>
              <textarea
                rows={3}
                value={closing.notes}
                onChange={(event) => setClosing((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Shortage reason, cash removed, owner withdrawal..."
              />
            </label>
          </div>

          <button className="occPrimary" type="button" disabled={saving} onClick={() => void saveCashClosing()}>
            {saving ? "Saving..." : "Save Daily Cash Closing"}
          </button>
        </section>
      )}

      {tab === "customers" && (
        <section className="occCustomerPanel">
          <div className="occSectionHeading">
            <span>CUSTOMER 360</span>
            <h2>One Customer, One Business View</h2>
            <p>POS spend, online orders, current due and last purchase in one owner screen.</p>
          </div>

          <input
            className="occCustomerSearch"
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
            placeholder="Search customer name, mobile or email..."
          />

          <div className="occCustomerGrid">
            <div className="occCustomerList">
              {customerRows.slice(0, 100).map((row) => (
                <button
                  type="button"
                  key={row.key}
                  className={selectedCustomer?.key === row.key ? "active" : ""}
                  onClick={() => setSelectedCustomerKey(row.key)}
                >
                  <strong>{row.name}</strong>
                  <span>{row.phone || row.email || "No contact"}</span>
                  <b>{money(row.posSpend + row.onlineSpend)}</b>
                </button>
              ))}
              {customerRows.length === 0 && <div className="occEmpty">No customer found.</div>}
            </div>

            <div className="occCustomerDetail">
              {selectedCustomer ? (
                <>
                  <div className="occAvatar">
                    {selectedCustomer.name.slice(0, 1).toUpperCase()}
                  </div>
                  <h3>{selectedCustomer.name}</h3>
                  <p>{selectedCustomer.phone || "No phone"} {selectedCustomer.email ? `• ${selectedCustomer.email}` : ""}</p>

                  <div className="occMiniGrid">
                    <Mini label="Total Spend" value={money(selectedCustomer.posSpend + selectedCustomer.onlineSpend)} />
                    <Mini label="POS Bills" value={String(selectedCustomer.posBills)} />
                    <Mini label="Online Orders" value={String(selectedCustomer.onlineOrders)} />
                    <Mini label="Current Due" value={money(selectedCustomer.due)} tone={selectedCustomer.due > 0 ? "red" : ""} />
                    <Mini label="Next Due" value={selectedCustomer.nextDueDate || "—"} />
                    <Mini
                      label="Last Purchase"
                      value={
                        selectedCustomer.lastPurchaseAt
                          ? new Date(selectedCustomer.lastPurchaseAt).toLocaleDateString("en-IN")
                          : "—"
                      }
                    />
                  </div>
                </>
              ) : (
                <div className="occEmpty">Select a customer.</div>
              )}
            </div>
          </div>
        </section>
      )}

      <style jsx global>{`
        .occPage{min-height:100vh;background:${IVORY};padding:18px;font-family:Poppins,Inter,Arial,sans-serif;color:${DEEP}}
        .occHero{position:relative;overflow:hidden;display:flex;justify-content:space-between;gap:20px;align-items:center;padding:24px;border-radius:24px;background:linear-gradient(135deg,${DEEP},${BLUE} 65%,#174da4);color:#fff;border:1px solid rgba(212,175,55,.55);box-shadow:0 18px 42px rgba(3,21,63,.18)}
        .occHero:after{content:"";position:absolute;width:260px;height:260px;right:-100px;top:-150px;border-radius:50%;background:rgba(212,175,55,.19)}
        .occHero span,.occSectionHeading span{font-size:9px;font-weight:950;letter-spacing:1.2px;color:${GOLD}}
        .occHero h1{margin:5px 0;font-size:28px;line-height:1.1}.occHero p{max-width:720px;margin:0;color:rgba(255,255,255,.7);font-size:11px;line-height:1.6}
        .occDateBox{position:relative;z-index:1;display:grid;grid-template-columns:1fr auto;gap:7px;min-width:260px;padding:12px;border:1px solid rgba(255,255,255,.15);border-radius:15px;background:rgba(255,255,255,.07)}
        .occDateBox label{grid-column:1/-1;font-size:8px;font-weight:900;color:${GOLD};letter-spacing:.7px}.occDateBox input,.occDateBox button{height:36px;border-radius:9px;border:1px solid rgba(255,255,255,.17);font:inherit;font-size:10px;font-weight:800}.occDateBox input{padding:0 9px;background:#fff;color:${DEEP}}.occDateBox button{padding:0 12px;background:${GOLD};color:${DEEP};cursor:pointer}
        .occTabs{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.occTabs button{display:flex;align-items:center;gap:7px;min-height:42px;padding:0 14px;border:1px solid #e1e5ec;border-radius:12px;background:#fff;color:${BLUE};font:inherit;font-size:10px;font-weight:900;cursor:pointer;box-shadow:0 5px 14px rgba(3,21,63,.04)}.occTabs button.active{background:${BLUE};color:#fff;border-color:${GOLD};box-shadow:0 8px 20px rgba(10,46,115,.16)}.occTabs b{font-size:15px}
        .occMessage{margin:10px 0;padding:11px 13px;border-radius:11px;border:1px solid rgba(212,175,55,.4);background:#fff9df;color:#6f5510;font-size:10px;font-weight:800}
        .occMetrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-top:12px}.occMetric{min-height:112px;padding:15px;border:1px solid #e4e7ec;border-radius:16px;background:#fff;box-shadow:0 8px 20px rgba(3,21,63,.05)}.occMetric span{display:block;color:#667085;font-size:8px;font-weight:900;letter-spacing:.5px}.occMetric strong{display:block;margin-top:10px;color:${BLUE};font-size:20px}.occMetric small{display:block;margin-top:8px;color:#98a2b3;font-size:8px;line-height:1.4}.occMetric.green strong{color:#087a55}.occMetric.red strong{color:#b42318}.occMetric.gold strong{color:#9b7410}
        .occGridTwo{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.occPanel,.occSettings,.occTablePanel,.occCustomerPanel{border:1px solid #e3e7ee;border-radius:18px;background:#fff;box-shadow:0 8px 24px rgba(3,21,63,.05)}.occPanel{padding:17px}.occPanelHeader span{font-size:8px;font-weight:950;color:${GOLD};letter-spacing:.8px}.occPanelHeader h3{margin:3px 0 12px;font-size:15px;color:${BLUE}}
        .occMoneyRows{display:grid;gap:7px}.occMoneyRows div{display:flex;justify-content:space-between;gap:15px;padding:9px 10px;border-radius:9px;background:#f8fafc}.occMoneyRows span{font-size:9px;color:#667085}.occMoneyRows strong{font-size:10px;color:${DEEP}}.occRule{margin-top:10px;padding:10px;border-radius:9px;background:rgba(212,175,55,.1);color:#735a12;font-size:9px;font-weight:800}
        .occHealth{min-height:150px;display:flex;flex-direction:column;justify-content:center;padding:18px;border-radius:14px}.occHealth.good{background:#ecfdf3;color:#067647}.occHealth.bad{background:#fef3f2;color:#b42318}.occHealth strong{font-size:17px}.occHealth span{margin-top:7px;font-size:10px;line-height:1.6}
        .occSettings,.occTablePanel,.occCustomerPanel{padding:20px}.occSectionHeading h2{margin:4px 0 5px;color:${BLUE};font-size:20px}.occSectionHeading p{margin:0;color:#667085;font-size:10px;line-height:1.6}
        .occSettingGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin:18px 0}.occSettingCard{min-height:170px;padding:16px;border:1px solid #e4e7ec;border-radius:15px;background:#fbfcff}.occSettingCard span{display:block;color:${BLUE};font-size:10px;font-weight:950}.occSettingCard strong{display:block;margin:10px 0;font-size:24px;color:${GOLD}}.occSettingCard small{display:block;margin-top:10px;color:#667085;font-size:8px;line-height:1.5}.occSettingCard input[type=range]{width:100%;accent-color:${BLUE}}
        .occToggle{display:flex;justify-content:space-between;gap:14px}.occToggle input{display:none}.occSwitch{flex:0 0 44px;height:24px;border-radius:99px;background:#d0d5dd;position:relative;transition:.2s}.occSwitch:after{content:"";position:absolute;width:18px;height:18px;left:3px;top:3px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2);transition:.2s}.occToggle input:checked + .occSwitch{background:${BLUE}}.occToggle input:checked + .occSwitch:after{transform:translateX(20px)}
        .occPrimary{height:42px;padding:0 18px;border:1px solid ${GOLD};border-radius:11px;background:${BLUE};color:#fff;font:inherit;font-size:10px;font-weight:950;cursor:pointer}.occPrimary:disabled{opacity:.5}
        .occTableWrap{overflow:auto;margin-top:15px;border:1px solid #edf0f4;border-radius:13px}.occTableWrap table{width:100%;border-collapse:collapse;min-width:900px}.occTableWrap th{padding:11px 10px;background:#f7f8fb;color:#667085;text-align:left;font-size:8px;letter-spacing:.4px}.occTableWrap td{padding:11px 10px;border-top:1px solid #eef1f5;color:#344054;font-size:9px}.occTableWrap td strong{color:${BLUE}}.occGreen{color:#067647!important;font-weight:950}.occRed{color:#b42318!important;font-weight:950}.occEmpty{padding:30px!important;text-align:center!important;color:#98a2b3!important}
        .occPager{display:flex;justify-content:space-between;align-items:center;margin-top:12px;color:#667085;font-size:9px}.occPager div{display:flex;align-items:center;gap:8px}.occPager button{height:32px;padding:0 10px;border:1px solid #d9dee8;border-radius:8px;background:#fff;color:${BLUE};font:inherit;font-size:8px;font-weight:900;cursor:pointer}.occPager button:disabled{opacity:.35}
        .occCashMetrics{grid-template-columns:repeat(6,minmax(0,1fr))}.occCashForm{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}.occCashForm label{display:grid;gap:6px}.occCashForm label.wide{grid-column:1/-1}.occCashForm span{font-size:9px;font-weight:900;color:${BLUE}}.occCashForm input,.occCashForm textarea{width:100%;box-sizing:border-box;border:1px solid #d8dde7;border-radius:10px;padding:10px;font:inherit;font-size:10px;outline:none}.occCashForm input:focus,.occCashForm textarea:focus{border-color:${GOLD};box-shadow:0 0 0 3px rgba(212,175,55,.11)}
        .occCustomerSearch{width:100%;box-sizing:border-box;height:42px;margin:15px 0;border:1px solid #d8dde7;border-radius:11px;padding:0 12px;font:inherit;font-size:10px;outline:none}.occCustomerSearch:focus{border-color:${GOLD}}
        .occCustomerGrid{display:grid;grid-template-columns:minmax(260px,390px) 1fr;gap:12px}.occCustomerList{max-height:570px;overflow:auto;border:1px solid #edf0f4;border-radius:13px;padding:7px}.occCustomerList button{width:100%;display:grid;grid-template-columns:1fr auto;gap:3px 8px;text-align:left;padding:11px;border:0;border-bottom:1px solid #eef1f5;background:#fff;cursor:pointer}.occCustomerList button.active{background:#f1f5ff;border-radius:9px}.occCustomerList strong{grid-column:1;color:${BLUE};font-size:10px}.occCustomerList span{grid-column:1;color:#667085;font-size:8px}.occCustomerList b{grid-row:1/3;grid-column:2;align-self:center;color:#087a55;font-size:9px}.occCustomerDetail{min-height:360px;border:1px solid #edf0f4;border-radius:15px;padding:22px;background:linear-gradient(180deg,#fff,#fbfcff)}.occAvatar{width:58px;height:58px;display:grid;place-items:center;border-radius:18px;background:${BLUE};color:${GOLD};font-size:24px;font-weight:950}.occCustomerDetail h3{margin:11px 0 2px;color:${BLUE};font-size:20px}.occCustomerDetail p{margin:0;color:#667085;font-size:9px}.occMiniGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:18px}.occMini{min-height:85px;padding:12px;border:1px solid #e7eaf0;border-radius:12px;background:#fff}.occMini span{display:block;color:#98a2b3;font-size:8px;font-weight:850}.occMini strong{display:block;margin-top:8px;color:${BLUE};font-size:13px}.occMini.red strong{color:#b42318}
        .occReportTools{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:12px;padding:14px;border:1px solid rgba(212,175,55,.45);border-radius:14px;background:#fff9e8}.occReportTools>div:first-child span{display:block;color:#9b7410;font-size:8px;font-weight:950;letter-spacing:.7px}.occReportTools>div:first-child strong{display:block;margin-top:4px;color:${BLUE};font-size:10px}.occReportTools>div:last-child{display:flex;flex-wrap:wrap;gap:7px}.occReportTools button,.occReportTools a{min-height:34px;display:inline-flex;align-items:center;padding:0 10px;border:1px solid #d9dee8;border-radius:8px;background:#fff;color:${BLUE};font:inherit;font-size:8px;font-weight:900;text-decoration:none;cursor:pointer}.occReportTools button.wa{background:#0a7a50;color:#fff;border-color:#61cfa4}.occTrendHeading{display:flex;justify-content:space-between;gap:12px;align-items:center}.occTrendHeading select{height:34px;border:1px solid #d8dde7;border-radius:9px;padding:0 9px;background:#fff;color:${BLUE};font:inherit;font-size:8px;font-weight:900}.occProfitTrend{height:280px;display:flex;align-items:flex-end;gap:7px;overflow-x:auto;margin-top:17px;padding:5px}.occProfitTrendColumn{min-width:45px;flex:1;height:100%;display:grid;grid-template-rows:28px 1fr 18px 20px;text-align:center}.occProfitTrendValue{overflow:hidden;color:#667085;font-size:7px;font-weight:850;text-overflow:ellipsis;white-space:nowrap}.occProfitTrendTrack{display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid #dfe3ea;background:linear-gradient(180deg,rgba(10,46,115,.02),rgba(10,46,115,.05))}.occProfitTrendTrack div{width:55%;max-width:26px;border-radius:5px 5px 1px 1px}.occProfitTrendTrack .positive{background:linear-gradient(180deg,#18a86b,#0a7b51)}.occProfitTrendTrack .negative{background:linear-gradient(180deg,#ec6a5e,#b42318)}.occProfitTrendColumn>strong{align-self:end;color:${BLUE};font-size:7px}.occProfitTrendColumn>small{color:#98a2b3;font-size:6px;line-height:1.3}
        @media print{.ncsSidebar,.ncsBusinessTicker,.ncsMobileMenuButton,.noPrint{display:none!important}.ncsAdminContent{margin-left:0!important}.occPage{padding:0;background:#fff}.occHero{background:#fff!important;color:${DEEP};box-shadow:none}.occHero p{color:#555}.occTabs{display:none}.occPanel,.occSettings,.occTablePanel,.occCustomerPanel{box-shadow:none}}
        @media(max-width:1200px){.occMetrics,.occCashMetrics{grid-template-columns:repeat(3,minmax(0,1fr))}.occSettingGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:760px){.occPage{padding:10px}.occHero{align-items:stretch;flex-direction:column}.occDateBox{min-width:0}.occMetrics,.occCashMetrics,.occGridTwo,.occSettingGrid,.occCustomerGrid,.occMiniGrid{grid-template-columns:1fr}.occCashForm{grid-template-columns:1fr}.occTabs{display:grid;grid-template-columns:1fr 1fr}.occTabs button{justify-content:center}.occHero h1{font-size:23px}}
      `}</style>
    </main>
  );
}

function Metric({
  label,
  value,
  note,
  tone = "",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "green" | "red" | "gold" | "";
}) {
  return (
    <div className={`occMetric ${tone}`}>
      <span>{label.toUpperCase()}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="occPanel">
      <div className="occPanelHeader">
        <span>{eyebrow}</span>
        <h3>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MoneyRows({ rows }: { rows: [string, number][] }) {
  return (
    <div className="occMoneyRows">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{money(value)}</strong>
        </div>
      ))}
    </div>
  );
}

function Toggle({
  title,
  text,
  checked,
  onChange,
}: {
  title: string;
  text: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="occSettingCard occToggle">
      <div>
        <span>{title}</span>
        <small>{text}</small>
      </div>
      <div>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <i className="occSwitch" />
      </div>
    </label>
  );
}

function Mini({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string;
  tone?: "red" | "";
}) {
  return (
    <div className={`occMini ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}