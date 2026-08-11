"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type PosSale = {
  id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  sale_status?: string | null;
  is_deleted?: boolean | null;
  created_at?: string | null;
};

type Order = {
  id: string | number;
  customer_name?: string | null;
  phone?: string | null;
  email?: string | null;
  total_amount?: number | string | null;
  order_status?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type CreditAccount = Record<string, unknown> & {
  id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  current_balance?: number | string | null;
  next_due_date?: string | null;
  is_active?: boolean | null;
};

type CustomerSummary = {
  key: string;
  name: string;
  phone: string;
  email: string;
  totalSpend: number;
  purchaseCount: number;
  lastPurchaseAt: string | null;
  dueAmount: number;
  nextDueDate: string | null;
  birthday: string | null;
};

const ROYAL_BLUE = "#0A2E73";
const DEEP_BLUE = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalisePhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function displayPhone(value: string) {
  return value || "No mobile";
}

function customerKey(name: string, phone: string, email = "") {
  if (phone) return `phone:${phone}`;
  if (email) return `email:${email.trim().toLowerCase()}`;
  return `name:${name.trim().toLowerCase()}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "No purchase date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysSince(value: string | null) {
  if (!value) return 9999;
  const date = new Date(value).getTime();
  if (!Number.isFinite(date)) return 9999;
  return Math.max(0, Math.floor((Date.now() - date) / 86_400_000));
}

function getBirthday(row: CreditAccount) {
  const candidates = [
    row.birthday,
    row.date_of_birth,
    row.dob,
    row.birth_date,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value;
  }

  return null;
}

function birthdayWithinDays(value: string | null, days = 30) {
  if (!value) return false;
  const original = new Date(value);
  if (Number.isNaN(original.getTime())) return false;

  const today = new Date();
  const thisYear = new Date(
    today.getFullYear(),
    original.getMonth(),
    original.getDate(),
  );

  if (thisYear < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    thisYear.setFullYear(today.getFullYear() + 1);
  }

  const difference = Math.ceil(
    (thisYear.getTime() - today.getTime()) / 86_400_000,
  );

  return difference >= 0 && difference <= days;
}

function whatsappHref(phone: string, name: string, message: string) {
  const clean = normalisePhone(phone);
  if (!clean) return "#";

  const full = clean.startsWith("91") && clean.length > 10 ? clean : `91${clean}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(
    `Hi ${name || "Customer"}, ${message}`,
  )}`;
}

export default function CustomerRetentionPage() {
  const [sales, setSales] = useState<PosSale[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [creditAccounts, setCreditAccounts] = useState<CreditAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setErrorMessage("");

    try {
      const [salesResult, ordersResult, creditResult] = await Promise.all([
        supabase
          .from("pos_sales")
          .select(
            "id,customer_name,customer_phone,total_amount,paid_amount,due_amount,sale_status,is_deleted,created_at",
          )
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(10000),

        supabase
          .from("orders")
          .select(
            "id,customer_name,phone,email,total_amount,order_status,status,created_at",
          )
          .order("created_at", { ascending: false })
          .limit(10000),

        supabase
          .from("customer_credit_accounts")
          .select("*")
          .eq("is_active", true)
          .order("current_balance", { ascending: false }),
      ]);

      if (salesResult.error) throw salesResult.error;
      if (ordersResult.error) throw ordersResult.error;
      if (creditResult.error) throw creditResult.error;

      setSales((salesResult.data || []) as PosSale[]);
      setOrders((ordersResult.data || []) as Order[]);
      setCreditAccounts((creditResult.data || []) as CreditAccount[]);
    } catch (error) {
      console.error("Customer retention load error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load customer follow-up data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const customers = useMemo<CustomerSummary[]>(() => {
    const map = new Map<string, CustomerSummary>();

    const ensure = (
      nameValue: string | null | undefined,
      phoneValue: string | null | undefined,
      emailValue = "",
    ) => {
      const name = String(nameValue || "Customer").trim() || "Customer";
      const phone = normalisePhone(phoneValue);
      const email = String(emailValue || "").trim();
      const key = customerKey(name, phone, email);

      const current =
        map.get(key) ||
        ({
          key,
          name,
          phone,
          email,
          totalSpend: 0,
          purchaseCount: 0,
          lastPurchaseAt: null,
          dueAmount: 0,
          nextDueDate: null,
          birthday: null,
        } satisfies CustomerSummary);

      if ((!current.name || current.name === "Customer") && name !== "Customer") {
        current.name = name;
      }
      if (!current.phone && phone) current.phone = phone;
      if (!current.email && email) current.email = email;

      map.set(key, current);
      return current;
    };

    sales.forEach((sale) => {
      const status = String(sale.sale_status || "completed").toLowerCase();
      if (["cancelled", "void", "refunded", "deleted"].includes(status)) return;

      const customer = ensure(sale.customer_name, sale.customer_phone);
      customer.totalSpend += Math.max(0, toNumber(sale.total_amount));
      customer.purchaseCount += 1;

      if (
        sale.created_at &&
        (!customer.lastPurchaseAt ||
          new Date(sale.created_at).getTime() >
            new Date(customer.lastPurchaseAt).getTime())
      ) {
        customer.lastPurchaseAt = sale.created_at;
      }
    });

    orders.forEach((order) => {
      const status = String(order.order_status || order.status || "pending").toLowerCase();
      if (status === "cancelled") return;

      const customer = ensure(order.customer_name, order.phone, order.email || "");
      customer.totalSpend += Math.max(0, toNumber(order.total_amount));
      customer.purchaseCount += 1;

      if (
        order.created_at &&
        (!customer.lastPurchaseAt ||
          new Date(order.created_at).getTime() >
            new Date(customer.lastPurchaseAt).getTime())
      ) {
        customer.lastPurchaseAt = order.created_at;
      }
    });

    creditAccounts.forEach((account) => {
      const customer = ensure(
        account.customer_name,
        account.customer_phone,
      );
      customer.dueAmount = Math.max(
        customer.dueAmount,
        Math.max(0, toNumber(account.current_balance)),
      );
      customer.nextDueDate =
        typeof account.next_due_date === "string"
          ? account.next_due_date
          : customer.nextDueDate;
      customer.birthday = getBirthday(account) || customer.birthday;
    });

    return Array.from(map.values());
  }, [creditAccounts, orders, sales]);

  const repeatCustomers = useMemo(
    () =>
      customers
        .filter((customer) => customer.purchaseCount >= 2)
        .sort((a, b) => b.purchaseCount - a.purchaseCount),
    [customers],
  );

  const inactiveCustomers = useMemo(
    () =>
      customers
        .filter(
          (customer) =>
            customer.purchaseCount > 0 &&
            daysSince(customer.lastPurchaseAt) >= 30 &&
            Boolean(customer.phone),
        )
        .sort(
          (a, b) =>
            daysSince(b.lastPurchaseAt) - daysSince(a.lastPurchaseAt),
        ),
    [customers],
  );

  const topCustomers = useMemo(
    () =>
      [...customers]
        .filter((customer) => customer.totalSpend > 0)
        .sort((a, b) => b.totalSpend - a.totalSpend)
        .slice(0, 10),
    [customers],
  );

  const dueCustomers = useMemo(
    () =>
      customers
        .filter((customer) => customer.dueAmount > 0)
        .sort((a, b) => b.dueAmount - a.dueAmount),
    [customers],
  );

  const birthdayCustomers = useMemo(
    () =>
      customers
        .filter((customer) => birthdayWithinDays(customer.birthday, 30))
        .sort((a, b) =>
          String(a.birthday || "").localeCompare(String(b.birthday || "")),
        ),
    [customers],
  );

  const followUpCustomers = useMemo(() => {
    const keys = new Set<string>();
    const result: CustomerSummary[] = [];

    [...dueCustomers, ...inactiveCustomers, ...birthdayCustomers].forEach(
      (customer) => {
        if (!customer.phone || keys.has(customer.key)) return;
        keys.add(customer.key);
        result.push(customer);
      },
    );

    return result.slice(0, 20);
  }, [birthdayCustomers, dueCustomers, inactiveCustomers]);

  const repeatRate =
    customers.length > 0
      ? Math.round((repeatCustomers.length / customers.length) * 100)
      : 0;

  if (loading) {
    return (
      <main className="retentionLoading">
        <div className="retentionLogo">NCS</div>
        <div className="retentionSpinner" />
        <h2>Preparing Customer Retention...</h2>
        <p>Reading POS, online orders and customer dues.</p>

        <style jsx>{`
          .retentionLoading {
            min-height: 70vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: Poppins, Inter, Arial, sans-serif;
            color: ${ROYAL_BLUE};
          }

          .retentionLogo {
            width: 78px;
            height: 78px;
            display: grid;
            place-items: center;
            border: 2px solid ${GOLD};
            border-radius: 22px;
            background: ${ROYAL_BLUE};
            color: ${GOLD};
            font-weight: 950;
            font-size: 22px;
          }

          .retentionSpinner {
            width: 42px;
            height: 42px;
            margin-top: 20px;
            border: 4px solid #e5e7eb;
            border-top-color: ${GOLD};
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          h2 {
            margin: 16px 0 0;
          }

          p {
            color: #667085;
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
    <main className="retentionPage">
      <section className="retentionHero">
        <div>
          <span>CUSTOMER GROWTH • REPEAT SALES</span>
          <h1>Customer Follow-up & Retention</h1>
          <p>
            Find repeat buyers, inactive customers, high-value customers,
            upcoming birthdays and pending dues from one screen.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "↻ Refresh"}
        </button>
      </section>

      {errorMessage && <div className="errorBox">{errorMessage}</div>}

      <section className="metricGrid">
        <RetentionMetric
          label="Total Customers"
          value={customers.length}
          note="POS + website customer records"
        />
        <RetentionMetric
          label="Repeat Customers"
          value={repeatCustomers.length}
          note={`${repeatRate}% repeat customer rate`}
        />
        <RetentionMetric
          label="30+ Day Inactive"
          value={inactiveCustomers.length}
          note="Good candidates for WhatsApp follow-up"
        />
        <RetentionMetric
          label="Customers With Dues"
          value={dueCustomers.length}
          note={formatCurrency(
            dueCustomers.reduce((sum, customer) => sum + customer.dueAmount, 0),
          )}
        />
        <RetentionMetric
          label="Upcoming Birthdays"
          value={birthdayCustomers.length}
          note="Next 30 days"
        />
        <RetentionMetric
          label="Follow-ups Ready"
          value={followUpCustomers.length}
          note="Customers with a usable mobile number"
        />
      </section>

      <section className="retentionGrid">
        <RetentionPanel
          eyebrow="REPEAT SALES"
          title="Top Spending Customers"
          action={<span>Top 10</span>}
        >
          <CustomerTable
            customers={topCustomers}
            emptyText="No purchase history found yet."
            mode="spend"
          />
        </RetentionPanel>

        <RetentionPanel
          eyebrow="WIN BACK"
          title="30+ Day Inactive Customers"
          action={<span>{inactiveCustomers.length} customers</span>}
        >
          <CustomerTable
            customers={inactiveCustomers.slice(0, 12)}
            emptyText="No inactive customers right now."
            mode="inactive"
          />
        </RetentionPanel>
      </section>

      <section className="retentionGrid">
        <RetentionPanel
          eyebrow="PAYMENT FOLLOW-UP"
          title="Customers With Dues"
          action={
            <Link href="/admin/party-ledgers">Open Party Ledgers</Link>
          }
        >
          <CustomerTable
            customers={dueCustomers.slice(0, 12)}
            emptyText="All customer dues are clear."
            mode="due"
          />
        </RetentionPanel>

        <RetentionPanel
          eyebrow="CUSTOMER DELIGHT"
          title="Upcoming Birthdays"
          action={<span>Next 30 days</span>}
        >
          <CustomerTable
            customers={birthdayCustomers.slice(0, 12)}
            emptyText="No birthday data found for the next 30 days."
            mode="birthday"
          />
        </RetentionPanel>
      </section>

      <section className="followUpPanel">
        <div className="panelHeader">
          <div>
            <span>DAILY ACTION LIST</span>
            <h2>WhatsApp Follow-up Queue</h2>
            <p>
              One-tap messages for customers who need a useful business follow-up.
            </p>
          </div>
        </div>

        <div className="followUpGrid">
          {followUpCustomers.length === 0 ? (
            <div className="emptyState">No follow-ups ready right now.</div>
          ) : (
            followUpCustomers.map((customer) => {
              const inactive = daysSince(customer.lastPurchaseAt) >= 30;
              const hasDue = customer.dueAmount > 0;
              const birthday = birthdayWithinDays(customer.birthday, 30);

              let reason = "Customer follow-up";
              let message =
                "we would love to welcome you back to NEW CITY STYLE. New arrivals are available.";

              if (hasDue) {
                reason = `Due ${formatCurrency(customer.dueAmount)}`;
                message = `this is a friendly reminder that your pending balance is ${formatCurrency(
                  customer.dueAmount,
                )}. Please contact NEW CITY STYLE when convenient.`;
              } else if (birthday) {
                reason = "Upcoming birthday";
                message =
                  "wishing you a wonderful birthday season from NEW CITY STYLE. We would be happy to help you find something special.";
              } else if (inactive) {
                reason = `${daysSince(customer.lastPurchaseAt)} days inactive`;
              }

              return (
                <article className="followUpCard" key={customer.key}>
                  <div>
                    <strong>{customer.name}</strong>
                    <span>{displayPhone(customer.phone)}</span>
                  </div>
                  <b>{reason}</b>
                  <a
                    href={whatsappHref(customer.phone, customer.name, message)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                </article>
              );
            })
          )}
        </div>
      </section>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .retentionPage {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(
              circle at 5% 0%,
              rgba(212, 175, 55, 0.14),
              transparent 25%
            ),
            linear-gradient(180deg, ${IVORY}, #ffffff);
          color: #243044;
          font-family: Poppins, Inter, Arial, sans-serif;
        }

        .retentionHero {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 22px;
          padding: 26px;
          border: 1px solid rgba(212, 175, 55, 0.42);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 90% 0%,
              rgba(212, 175, 55, 0.28),
              transparent 35%
            ),
            linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE} 65%, #174da4);
          color: #ffffff;
          box-shadow: 0 18px 42px rgba(3, 21, 63, 0.2);
        }

        .retentionHero span,
        .panelHeader span {
          color: #f1d26a;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .retentionHero h1 {
          margin: 7px 0 5px;
          font-size: clamp(28px, 4vw, 48px);
          line-height: 1.04;
        }

        .retentionHero p {
          max-width: 760px;
          margin: 0;
          color: rgba(255, 255, 255, 0.74);
          font-size: 13px;
          line-height: 1.6;
        }

        .retentionHero button {
          min-width: 116px;
          min-height: 42px;
          border: 1px solid rgba(255, 255, 255, 0.35);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          font-weight: 900;
          cursor: pointer;
        }

        .retentionHero button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .errorBox {
          margin-top: 16px;
          padding: 13px 15px;
          border: 1px solid #fca5a5;
          border-radius: 12px;
          background: #fff7f7;
          color: #b91c1c;
          font-size: 12px;
          font-weight: 800;
        }

        .metricGrid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 11px;
          margin-top: 16px;
        }

        .retentionGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-top: 16px;
        }

        .retentionPanel,
        .followUpPanel {
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.12);
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 12px 30px rgba(3, 21, 63, 0.07);
        }

        .followUpPanel {
          margin-top: 16px;
        }

        .panelHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 18px 20px;
          border-bottom: 1px solid #edf0f5;
        }

        .panelHeader span {
          color: #b8890b;
        }

        .panelHeader h2 {
          margin: 5px 0 0;
          color: ${ROYAL_BLUE};
          font-size: 20px;
        }

        .panelHeader p {
          margin: 5px 0 0;
          color: #667085;
          font-size: 12px;
        }

        .panelHeader > a,
        .panelHeader > span {
          color: ${ROYAL_BLUE} !important;
          font-size: 10px;
          font-weight: 900;
          text-decoration: none;
        }

        .customerRows {
          display: grid;
        }

        .customerRow {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.9fr) auto;
          gap: 12px;
          align-items: center;
          min-height: 72px;
          padding: 12px 18px;
          border-bottom: 1px solid #eef1f5;
        }

        .customerRow:last-child {
          border-bottom: 0;
        }

        .customerMain {
          min-width: 0;
        }

        .customerMain strong,
        .customerMain span {
          display: block;
        }

        .customerMain strong {
          overflow: hidden;
          color: ${ROYAL_BLUE};
          font-size: 12px;
          font-weight: 950;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .customerMain span {
          margin-top: 4px;
          color: #7a8497;
          font-size: 10px;
        }

        .customerValue {
          color: #26364f;
          font-size: 11px;
          font-weight: 850;
        }

        .customerValue small {
          display: block;
          margin-top: 4px;
          color: #7a8497;
          font-size: 9px;
          font-weight: 700;
        }

        .customerRow a {
          min-width: 82px;
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #25d366;
          border-radius: 9px;
          background: #f0fff5;
          color: #107b36 !important;
          font-size: 10px;
          font-weight: 950;
          text-decoration: none !important;
        }

        .emptyState {
          padding: 32px 18px;
          color: #7a8497;
          font-size: 12px;
          font-weight: 700;
          text-align: center;
        }

        .followUpGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          padding: 16px;
        }

        .followUpCard {
          min-height: 142px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 12px;
          padding: 15px;
          border: 1px solid rgba(212, 175, 55, 0.28);
          border-radius: 14px;
          background:
            linear-gradient(180deg, #fffdf8, #ffffff);
        }

        .followUpCard strong,
        .followUpCard span {
          display: block;
        }

        .followUpCard strong {
          color: ${ROYAL_BLUE};
          font-size: 12px;
          font-weight: 950;
        }

        .followUpCard span {
          margin-top: 4px;
          color: #7a8497;
          font-size: 10px;
        }

        .followUpCard b {
          color: #9a7100;
          font-size: 10px;
        }

        .followUpCard a {
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #128c4a;
          color: #ffffff !important;
          font-size: 10px;
          font-weight: 950;
          text-decoration: none !important;
        }

        @media (max-width: 1280px) {
          .metricGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .followUpGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .retentionPage {
            padding: 100px 12px 18px;
          }

          .retentionHero {
            align-items: stretch;
            flex-direction: column;
          }

          .retentionGrid,
          .metricGrid,
          .followUpGrid {
            grid-template-columns: 1fr;
          }

          .customerRow {
            grid-template-columns: 1fr;
          }

          .customerRow a {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function RetentionMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <article
      style={{
        minHeight: 116,
        padding: 15,
        border: "1px solid rgba(212,175,55,0.28)",
        borderRadius: 15,
        background:
          "linear-gradient(145deg, #03153F, #0A2E73 70%, #124592)",
        color: "#ffffff",
        boxShadow: "0 10px 25px rgba(3,21,63,0.14)",
      }}
    >
      <span
        style={{
          display: "block",
          color: "#F1D26A",
          fontSize: 9,
          fontWeight: 950,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <strong
        style={{
          display: "block",
          marginTop: 10,
          fontSize: 25,
          lineHeight: 1,
        }}
      >
        {value}
      </strong>
      <small
        style={{
          display: "block",
          marginTop: 10,
          color: "rgba(255,255,255,0.65)",
          fontSize: 9,
        }}
      >
        {note}
      </small>
    </article>
  );
}

function RetentionPanel({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="retentionPanel">
      <div className="panelHeader">
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </article>
  );
}

function CustomerTable({
  customers,
  emptyText,
  mode,
}: {
  customers: CustomerSummary[];
  emptyText: string;
  mode: "spend" | "inactive" | "due" | "birthday";
}) {
  if (customers.length === 0) {
    return <div className="emptyState">{emptyText}</div>;
  }

  return (
    <div className="customerRows">
      {customers.map((customer) => {
        let value = formatCurrency(customer.totalSpend);
        let note = `${customer.purchaseCount} purchase${
          customer.purchaseCount === 1 ? "" : "s"
        }`;

        if (mode === "inactive") {
          value = `${daysSince(customer.lastPurchaseAt)} days`;
          note = `Last purchase: ${formatDate(customer.lastPurchaseAt)}`;
        }

        if (mode === "due") {
          value = formatCurrency(customer.dueAmount);
          note = customer.nextDueDate
            ? `Due date: ${customer.nextDueDate}`
            : "Due date not set";
        }

        if (mode === "birthday") {
          value = "Birthday";
          note = customer.birthday
            ? formatDate(customer.birthday)
            : "Date unavailable";
        }

        const message =
          mode === "due"
            ? `this is a friendly reminder that your pending balance is ${formatCurrency(
                customer.dueAmount,
              )}. Please contact NEW CITY STYLE when convenient.`
            : mode === "birthday"
              ? "wishing you a wonderful birthday season from NEW CITY STYLE. We would be happy to help you find something special."
              : mode === "inactive"
                ? "we would love to welcome you back to NEW CITY STYLE. New arrivals are available."
                : "thank you for being one of our valued NEW CITY STYLE customers.";

        return (
          <div className="customerRow" key={customer.key}>
            <div className="customerMain">
              <strong>{customer.name}</strong>
              <span>
                {displayPhone(customer.phone)}
                {customer.email ? ` • ${customer.email}` : ""}
              </span>
            </div>

            <div className="customerValue">
              {value}
              <small>{note}</small>
            </div>

            {customer.phone ? (
              <a
                href={whatsappHref(
                  customer.phone,
                  customer.name,
                  message,
                )}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            ) : (
              <span />
            )}
          </div>
        );
      })}
    </div>
  );
}