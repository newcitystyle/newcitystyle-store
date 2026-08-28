"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ExpenseCategory = {
  id: number;
  name: string;
  icon?: string | null;
  sort_order?: number | null;
};

type ExpenseRow = {
  id: string;
  expense_number?: string | null;
  expense_date: string;
  expense_time?: string | null;
  category_id?: number | null;
  category_name: string;
  amount: number | string;
  payment_method: string;
  paid_to?: string | null;
  reference_number?: string | null;
  notes?: string | null;
  receipt_url?: string | null;
  is_deleted?: boolean | null;
  created_at?: string | null;
};

type ExpenseSummary = {
  total_expenses?: number | string;
  cash_expenses?: number | string;
  digital_expenses?: number | string;
  expense_count?: number | string;
  top_category?: string | null;
};

const ROYAL_BLUE = "#0A2E73";
const DEEP_BLUE = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthValue() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function ExpensesPage() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [expenseDate, setExpenseDate] = useState(todayValue());
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidTo, setPaidTo] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [filterFrom, setFilterFrom] = useState(startOfMonthValue());
  const [filterTo, setFilterTo] = useState(todayValue());
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === Number(categoryId)),
    [categories, categoryId],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const [categoryResponse, expenseResponse, summaryResponse] =
        await Promise.all([
          supabase
            .from("expense_categories")
            .select("id,name,icon,sort_order")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),

          supabase
            .from("expenses")
            .select("*")
            .eq("is_deleted", false)
            .gte("expense_date", filterFrom)
            .lte("expense_date", filterTo)
            .order("expense_date", { ascending: false })
            .order("created_at", { ascending: false }),

          supabase.rpc("ncs_expense_summary", {
            p_start_date: filterFrom,
            p_end_date: filterTo,
          }),
        ]);

      if (categoryResponse.error) throw categoryResponse.error;
      if (expenseResponse.error) throw expenseResponse.error;
      if (summaryResponse.error) throw summaryResponse.error;

      const categoryRows =
        (categoryResponse.data || []) as unknown as ExpenseCategory[];

      const expenseRows =
        (expenseResponse.data || []) as unknown as ExpenseRow[];

      /*
       * Keep the existing expense-summary RPC for total/count/top-category,
       * but calculate Cash and Digital directly from the exact expense rows
       * already loaded for this date range. This avoids any mismatch in the
       * RPC's payment-method grouping while leaving expense saving, history,
       * filters, delete and all other behaviour unchanged.
       */
      const cashExpenses = expenseRows.reduce((total, expense) => {
        const method = String(expense.payment_method || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_");

        return method === "cash"
          ? total + toNumber(expense.amount)
          : total;
      }, 0);

      const digitalExpenses = expenseRows.reduce((total, expense) => {
        const method = String(expense.payment_method || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_");

        return ["upi", "card", "bank", "bank_transfer", "banktransfer"].includes(
          method,
        )
          ? total + toNumber(expense.amount)
          : total;
      }, 0);

      setCategories(categoryRows);
      setExpenses(expenseRows);
      setSummary({
        ...((summaryResponse.data || {}) as ExpenseSummary),
        cash_expenses: cashExpenses,
        digital_expenses: digitalExpenses,
      });

      if (!categoryId && categoryRows.length > 0) {
        setCategoryId(categoryRows[0].id);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load expenses.",
      );
    } finally {
      setLoading(false);
    }
  }, [categoryId, filterFrom, filterTo]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredExpenses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return expenses.filter((expense) => {
      const matchesSearch =
        !query ||
        [
          expense.expense_number,
          expense.category_name,
          expense.paid_to,
          expense.reference_number,
          expense.notes,
          expense.payment_method,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesCategory =
        categoryFilter === "all" ||
        expense.category_name === categoryFilter;

      const matchesPayment =
        paymentFilter === "all" ||
        expense.payment_method === paymentFilter;

      return matchesSearch && matchesCategory && matchesPayment;
    });
  }, [expenses, searchQuery, categoryFilter, paymentFilter]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const numericAmount = toNumber(amount);

    if (!selectedCategory) {
      setNotice("Select an expense category.");
      return;
    }

    if (numericAmount <= 0) {
      setNotice("Enter a valid expense amount.");
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      const { error } = await supabase.from("expenses").insert({
        expense_date: expenseDate,
        category_id: selectedCategory.id,
        category_name: selectedCategory.name,
        amount: numericAmount,
        payment_method: paymentMethod,
        paid_to: paidTo.trim() || null,
        reference_number: referenceNumber.trim() || null,
        notes: notes.trim() || null,
      });

      if (error) throw error;

      setAmount("");
      setPaidTo("");
      setReferenceNumber("");
      setNotes("");
      setPaymentMethod("cash");
      setNotice("Expense saved successfully.");
      window.setTimeout(() => setNotice(""), 3000);

      await loadData();
    } catch (error) {
      console.error(error);
      setNotice(
        error instanceof Error ? error.message : "Unable to save expense.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(expense: ExpenseRow) {
    const confirmed = window.confirm(
      `Delete ${expense.expense_number || "this expense"}?`,
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("expenses")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", expense.id);

      if (error) throw error;

      setNotice("Expense deleted safely.");
      window.setTimeout(() => setNotice(""), 3000);
      await loadData();
    } catch (error) {
      console.error(error);
      setNotice(
        error instanceof Error ? error.message : "Unable to delete expense.",
      );
    }
  }

  return (
    <main className="expensePage">
      <section className="expenseHeader">
        <div>
          <span>NEW CITY STYLE • BUSINESS CONTROL</span>
          <h1>Daily Expenses</h1>
          <p>
            Record every shop expense, payment method and vendor detail in one
            premium control centre.
          </p>
        </div>

        <button type="button" onClick={() => void loadData()} disabled={loading}>
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </section>

      {notice && <div className="notice">{notice}</div>}
      {errorMessage && <div className="error">{errorMessage}</div>}

      <section className="summaryGrid">
        <article>
          <span>Total Expenses</span>
          <strong>{formatCurrency(toNumber(summary.total_expenses))}</strong>
          <small>{filterFrom} → {filterTo}</small>
        </article>

        <article>
          <span>Cash Expenses</span>
          <strong>{formatCurrency(toNumber(summary.cash_expenses))}</strong>
          <small>Cash drawer impact</small>
        </article>

        <article>
          <span>Digital Expenses</span>
          <strong>{formatCurrency(toNumber(summary.digital_expenses))}</strong>
          <small>UPI / Card / Bank</small>
        </article>

        <article>
          <span>Expense Entries</span>
          <strong>{toNumber(summary.expense_count)}</strong>
          <small>Top: {summary.top_category || "—"}</small>
        </article>
      </section>

      <section className="workspace">
        <form className="expenseForm" onSubmit={handleSubmit}>
          <div className="sectionTitle">
            <span>ADD EXPENSE</span>
            <h2>New Daily Expense</h2>
          </div>

          <div className="formGrid">
            <label>
              <span>Date</span>
              <input
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
              />
            </label>

            <label>
              <span>Category</span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(Number(event.target.value))}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon || "•"} {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="₹0.00"
              />
            </label>

            <label>
              <span>Payment Method</span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              <span>Paid To / Vendor</span>
              <input
                value={paidTo}
                onChange={(event) => setPaidTo(event.target.value)}
                placeholder="Vendor or person name"
              />
            </label>

            <label>
              <span>Reference Number</span>
              <input
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
                placeholder="UPI / bank / receipt reference"
              />
            </label>
          </div>

          <label className="notesField">
            <span>Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional expense details"
            />
          </label>

          <button type="submit" className="saveButton" disabled={saving}>
            {saving ? "Saving Expense..." : "Save Expense"}
          </button>
        </form>

        <section className="historyPanel">
          <div className="historyHeader">
            <div>
              <span>EXPENSE HISTORY</span>
              <h2>Daily Expense Register</h2>
            </div>

            <div className="dateFilters">
              <label>
                <span>From</span>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(event) => setFilterFrom(event.target.value)}
                />
              </label>

              <label>
                <span>To</span>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(event) => setFilterTo(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="filters">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search expense, vendor, reference..."
            />

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value)}
            >
              <option value="all">All Payments</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="other">Other</option>
            </select>
          </div>

          {loading ? (
            <div className="emptyState">Loading expense register...</div>
          ) : filteredExpenses.length === 0 ? (
            <div className="emptyState">
              No expenses found for the selected period.
            </div>
          ) : (
            <div className="expenseList">
              {filteredExpenses.map((expense) => (
                <article key={expense.id} className="expenseCard">
                  <div className="expenseIcon">
                    {categories.find(
                      (category) => category.name === expense.category_name,
                    )?.icon || "🧾"}
                  </div>

                  <div className="expenseMain">
                    <span>{expense.expense_number || "EXPENSE"}</span>
                    <h3>{expense.category_name}</h3>
                    <p>
                      {formatDate(expense.expense_date)}
                      {expense.paid_to ? ` • ${expense.paid_to}` : ""}
                    </p>
                    {expense.notes && <small>{expense.notes}</small>}
                  </div>

                  <div className="expenseMeta">
                    <span>{expense.payment_method.replace("_", " ")}</span>
                    <strong>{formatCurrency(toNumber(expense.amount))}</strong>
                    {expense.reference_number && (
                      <small>{expense.reference_number}</small>
                    )}
                  </div>

                  <button
                    type="button"
                    className="deleteButton"
                    onClick={() => void deleteExpense(expense)}
                  >
                    Delete
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <style jsx global>{`
        * { box-sizing: border-box; }

        .expensePage {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(circle at 10% 0%, rgba(212,175,55,.12), transparent 25%),
            ${IVORY};
          color: #2c2c2c;
          font-family: Poppins, Inter, Arial, sans-serif;
        }

        .expenseHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          padding: 23px 24px;
          border: 1px solid rgba(212,175,55,.34);
          border-radius: 22px;
          background:
            radial-gradient(circle at 90% 0%, rgba(212,175,55,.24), transparent 34%),
            linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: white;
          box-shadow: 0 18px 45px rgba(3,21,63,.18);
        }

        .expenseHeader span,
        .sectionTitle span,
        .historyHeader > div > span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .expenseHeader h1 {
          margin: 5px 0 0;
          font-size: 31px;
          font-weight: 950;
        }

        .expenseHeader p {
          margin: 6px 0 0;
          color: rgba(255,255,255,.72);
          font-size: 10px;
        }

        .expenseHeader button {
          min-height: 42px;
          padding: 0 15px;
          border: 1px solid ${GOLD};
          border-radius: 11px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .notice,
        .error {
          margin-top: 12px;
          padding: 11px 13px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 800;
        }

        .notice {
          background: #ecfdf3;
          color: #067647;
        }

        .error {
          background: #fef3f2;
          color: #b42318;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap: 11px;
          margin: 15px 0;
        }

        .summaryGrid article {
          min-height: 104px;
          padding: 16px;
          border: 1px solid rgba(212,175,55,.25);
          border-radius: 17px;
          background: linear-gradient(135deg, ${ROYAL_BLUE}, ${DEEP_BLUE});
          color: white;
          box-shadow: 0 10px 24px rgba(3,21,63,.12);
        }

        .summaryGrid span,
        .summaryGrid strong,
        .summaryGrid small {
          display: block;
        }

        .summaryGrid span {
          color: ${GOLD};
          font-size: 8px;
          font-weight: 900;
        }

        .summaryGrid strong {
          margin-top: 7px;
          font-size: 22px;
          font-weight: 950;
        }

        .summaryGrid small {
          margin-top: 5px;
          color: rgba(255,255,255,.65);
          font-size: 8px;
        }

        .workspace {
          display: grid;
          grid-template-columns: minmax(300px, .8fr) minmax(0, 1.7fr);
          gap: 14px;
        }

        .expenseForm,
        .historyPanel {
          border: 1px solid rgba(10,46,115,.1);
          border-radius: 19px;
          background: white;
          box-shadow: 0 12px 30px rgba(10,46,115,.07);
        }

        .expenseForm {
          align-self: start;
          padding: 18px;
          position: sticky;
          top: 18px;
        }

        .sectionTitle h2,
        .historyHeader h2 {
          margin: 5px 0 0;
          color: ${ROYAL_BLUE};
          font-size: 19px;
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          gap: 10px;
          margin-top: 16px;
        }

        label > span {
          display: block;
          margin-bottom: 5px;
          color: #667085;
          font-size: 8px;
          font-weight: 850;
        }

        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid #dfe4eb;
          border-radius: 10px;
          outline: none;
          background: #fbfcfe;
          color: #2c2c2c;
          font: inherit;
          font-size: 10px;
          font-weight: 700;
        }

        input,
        select {
          min-height: 42px;
          padding: 0 10px;
        }

        textarea {
          min-height: 88px;
          padding: 10px;
          resize: vertical;
        }

        .notesField {
          display: block;
          margin-top: 10px;
        }

        .saveButton {
          width: 100%;
          min-height: 46px;
          margin-top: 13px;
          border: 1px solid ${GOLD};
          border-radius: 11px;
          background: linear-gradient(135deg, ${ROYAL_BLUE}, ${DEEP_BLUE});
          color: white;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .historyPanel {
          overflow: hidden;
        }

        .historyHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          padding: 18px;
          border-bottom: 1px solid #edf0f4;
        }

        .dateFilters {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .filters {
          display: grid;
          grid-template-columns: minmax(0,1fr) 170px 160px;
          gap: 8px;
          padding: 12px 18px;
          border-bottom: 1px solid #edf0f4;
          background: #f8fafc;
        }

        .expenseList {
          display: grid;
          gap: 8px;
          padding: 12px;
          background: #f8fafc;
        }

        .expenseCard {
          display: grid;
          grid-template-columns: 46px minmax(0,1fr) 150px 70px;
          align-items: center;
          gap: 11px;
          padding: 12px;
          border: 1px solid #e4e7ec;
          border-radius: 13px;
          background: white;
        }

        .expenseIcon {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: ${ROYAL_BLUE};
          font-size: 19px;
        }

        .expenseMain span {
          color: ${GOLD};
          font-size: 7px;
          font-weight: 900;
        }

        .expenseMain h3 {
          margin: 3px 0 0;
          color: ${ROYAL_BLUE};
          font-size: 11px;
        }

        .expenseMain p,
        .expenseMain small {
          display: block;
          margin: 3px 0 0;
          color: #7b8491;
          font-size: 8px;
        }

        .expenseMeta {
          text-align: right;
        }

        .expenseMeta span,
        .expenseMeta strong,
        .expenseMeta small {
          display: block;
        }

        .expenseMeta span {
          color: #7b8491;
          font-size: 7px;
          text-transform: uppercase;
        }

        .expenseMeta strong {
          margin-top: 3px;
          color: ${ROYAL_BLUE};
          font-size: 13px;
        }

        .expenseMeta small {
          margin-top: 2px;
          color: #98a2b3;
          font-size: 7px;
        }

        .deleteButton {
          min-height: 34px;
          border: 1px solid #f3b7b2;
          border-radius: 8px;
          background: #fff6f5;
          color: #b42318;
          font-size: 8px;
          font-weight: 850;
          cursor: pointer;
        }

        .emptyState {
          min-height: 260px;
          display: grid;
          place-items: center;
          padding: 24px;
          color: #667085;
          font-size: 11px;
        }

        @media (max-width: 1100px) {
          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0,1fr));
          }

          .workspace {
            grid-template-columns: 1fr;
          }

          .expenseForm {
            position: static;
          }
        }

        @media (max-width: 700px) {
          .expensePage {
            padding: 12px 8px 30px;
          }

          .expenseHeader,
          .historyHeader {
            align-items: stretch;
            flex-direction: column;
          }

          .summaryGrid,
          .formGrid,
          .dateFilters,
          .filters {
            grid-template-columns: 1fr;
          }

          .expenseCard {
            grid-template-columns: 42px minmax(0,1fr);
          }

          .expenseMeta,
          .deleteButton {
            grid-column: 1 / -1;
          }

          .expenseMeta {
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}