"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type AccountRow = {
  id: number;
  account_name: string;
  account_type: "cash" | "upi" | "bank" | "card" | "other";
  opening_balance?: number | string | null;
};

type CashBankTransaction = {
  id: string;
  transaction_number?: string | null;
  transaction_date: string;
  transaction_time?: string | null;
  account_id?: number | null;
  account_name: string;
  account_type: string;
  entry_type: string;
  direction: "in" | "out";
  amount: number | string;
  party_name?: string | null;
  reference_number?: string | null;
  notes?: string | null;
  source_table?: string | null;
  created_at?: string | null;
};

type CashBankSummary = {
  sales_total?: number | string;
  cash_sales?: number | string;
  digital_sales?: number | string;
  sales_bills?: number | string;
  expenses_total?: number | string;
  cash_expenses?: number | string;
  digital_expenses?: number | string;
  expense_count?: number | string;
  manual_in?: number | string;
  manual_out?: number | string;
  manual_count?: number | string;
  cash_balance?: number | string;
  digital_balance?: number | string;
  net_movement?: number | string;
};

const ROYAL_BLUE = "#0A2E73";
const DEEP_BLUE = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";

const entryTypeOptions = [
  { value: "customer_due_collection", label: "Customer Due Collection", direction: "in" },
  { value: "cash_deposit", label: "Cash Deposit", direction: "in" },
  { value: "bank_transfer_in", label: "Bank Transfer In", direction: "in" },
  { value: "owner_investment", label: "Owner Investment", direction: "in" },
  { value: "other_income", label: "Other Income", direction: "in" },
  { value: "supplier_payment", label: "Supplier Payment", direction: "out" },
  { value: "purchase_payment", label: "Purchase Payment", direction: "out" },
  { value: "cash_withdrawal", label: "Cash Withdrawal", direction: "out" },
  { value: "bank_transfer_out", label: "Bank Transfer Out", direction: "out" },
  { value: "owner_withdrawal", label: "Owner Withdrawal", direction: "out" },
  { value: "other_expense", label: "Other Expense", direction: "out" },
] as const;

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

export default function CashBankBookPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [transactions, setTransactions] = useState<CashBankTransaction[]>([]);
  const [summary, setSummary] = useState<CashBankSummary>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [transactionDate, setTransactionDate] = useState(todayValue());
  const [accountId, setAccountId] = useState<number | "">("");
  const [entryType, setEntryType] = useState("customer_due_collection");
  const [amount, setAmount] = useState("");
  const [partyName, setPartyName] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [filterFrom, setFilterFrom] = useState(startOfMonthValue());
  const [filterTo, setFilterTo] = useState(todayValue());
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === Number(accountId)),
    [accounts, accountId],
  );

  const selectedEntryType = useMemo(
    () => entryTypeOptions.find((option) => option.value === entryType),
    [entryType],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const [accountsResponse, transactionsResponse, summaryResponse] =
        await Promise.all([
          supabase
            .from("cash_bank_accounts")
            .select("id,account_name,account_type,opening_balance")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),

          supabase
            .from("cash_bank_transactions")
            .select("*")
            .eq("is_deleted", false)
            .gte("transaction_date", filterFrom)
            .lte("transaction_date", filterTo)
            .order("transaction_date", { ascending: false })
            .order("created_at", { ascending: false }),

          supabase.rpc("ncs_cash_bank_summary", {
            p_start_date: filterFrom,
            p_end_date: filterTo,
          }),
        ]);

      if (accountsResponse.error) throw accountsResponse.error;
      if (transactionsResponse.error) throw transactionsResponse.error;
      if (summaryResponse.error) throw summaryResponse.error;

      const accountRows =
        (accountsResponse.data || []) as unknown as AccountRow[];

      setAccounts(accountRows);
      setTransactions(
        (transactionsResponse.data || []) as unknown as CashBankTransaction[],
      );
      setSummary((summaryResponse.data || {}) as CashBankSummary);

      if (!accountId && accountRows.length > 0) {
        setAccountId(accountRows[0].id);
      }
    } catch (error) {
      console.error("Unable to load Cash & Bank Book:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Cash & Bank Book.",
      );
    } finally {
      setLoading(false);
    }
  }, [accountId, filterFrom, filterTo]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesSearch =
        !query ||
        [
          transaction.transaction_number,
          transaction.account_name,
          transaction.entry_type,
          transaction.party_name,
          transaction.reference_number,
          transaction.notes,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesDirection =
        directionFilter === "all" ||
        transaction.direction === directionFilter;

      const matchesAccount =
        accountFilter === "all" ||
        transaction.account_name === accountFilter;

      return matchesSearch && matchesDirection && matchesAccount;
    });
  }, [transactions, searchQuery, directionFilter, accountFilter]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const numericAmount = toNumber(amount);

    if (!selectedAccount) {
      setNotice("Select an account.");
      return;
    }

    if (!selectedEntryType) {
      setNotice("Select an entry type.");
      return;
    }

    if (numericAmount <= 0) {
      setNotice("Enter a valid amount.");
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      const { error } = await supabase
        .from("cash_bank_transactions")
        .insert({
          transaction_date: transactionDate,
          account_id: selectedAccount.id,
          account_name: selectedAccount.account_name,
          account_type: selectedAccount.account_type,
          entry_type: selectedEntryType.value,
          direction: selectedEntryType.direction,
          amount: numericAmount,
          party_name: partyName.trim() || null,
          reference_number: referenceNumber.trim() || null,
          notes: notes.trim() || null,
        });

      if (error) throw error;

      setAmount("");
      setPartyName("");
      setReferenceNumber("");
      setNotes("");
      setNotice("Cash / bank entry saved successfully.");
      window.setTimeout(() => setNotice(""), 3000);

      await loadData();
    } catch (error) {
      console.error(error);
      setNotice(
        error instanceof Error ? error.message : "Unable to save the entry.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction(transaction: CashBankTransaction) {
    const confirmed = window.confirm(
      `Delete ${transaction.transaction_number || "this entry"}?`,
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("cash_bank_transactions")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);

      if (error) throw error;

      setNotice("Cash / bank entry deleted safely.");
      window.setTimeout(() => setNotice(""), 3000);
      await loadData();
    } catch (error) {
      console.error(error);
      setNotice(
        error instanceof Error ? error.message : "Unable to delete the entry.",
      );
    }
  }

  return (
    <main className="cashBookPage">
      <section className="cashBookHeader">
        <div>
          <span>NEW CITY STYLE • FINANCIAL CONTROL</span>
          <h1>Cash &amp; Bank Book</h1>
          <p>
            Live POS collections, expenses and manual money movements in one
            premium daily control centre.
          </p>
        </div>

        <button type="button" onClick={() => void loadData()} disabled={loading}>
          {loading ? "Refreshing..." : "↻ Refresh Book"}
        </button>
      </section>

      {notice && <div className="notice">{notice}</div>}
      {errorMessage && <div className="error">{errorMessage}</div>}

      <section className="primarySummary">
        <article className="cashCard">
          <span>ESTIMATED CASH BALANCE</span>
          <strong>{formatCurrency(toNumber(summary.cash_balance))}</strong>
          <small>Cash sales + manual cash in − expenses − cash out</small>
        </article>

        <article className="digitalCard">
          <span>DIGITAL NET BALANCE</span>
          <strong>{formatCurrency(toNumber(summary.digital_balance))}</strong>
          <small>UPI / card / bank movement</small>
        </article>

        <article className="netCard">
          <span>NET MONEY MOVEMENT</span>
          <strong>{formatCurrency(toNumber(summary.net_movement))}</strong>
          <small>Selected date range</small>
        </article>
      </section>

      <section className="miniSummary">
        <article>
          <span>Paid Sales</span>
          <strong>{formatCurrency(toNumber(summary.sales_total))}</strong>
          <small>{toNumber(summary.sales_bills)} bills</small>
        </article>

        <article>
          <span>Cash Sales</span>
          <strong>{formatCurrency(toNumber(summary.cash_sales))}</strong>
          <small>POS cash collections</small>
        </article>

        <article>
          <span>Digital Sales</span>
          <strong>{formatCurrency(toNumber(summary.digital_sales))}</strong>
          <small>UPI / Card / Bank</small>
        </article>

        <article>
          <span>Expenses</span>
          <strong>{formatCurrency(toNumber(summary.expenses_total))}</strong>
          <small>{toNumber(summary.expense_count)} entries</small>
        </article>

        <article>
          <span>Manual Money In</span>
          <strong>{formatCurrency(toNumber(summary.manual_in))}</strong>
          <small>Collections / deposits</small>
        </article>

        <article>
          <span>Manual Money Out</span>
          <strong>{formatCurrency(toNumber(summary.manual_out))}</strong>
          <small>Payments / withdrawals</small>
        </article>
      </section>

      <section className="cashBookWorkspace">
        <form className="entryForm" onSubmit={handleSubmit}>
          <div className="sectionTitle">
            <span>ADD MONEY MOVEMENT</span>
            <h2>New Cash / Bank Entry</h2>
          </div>

          <div className="formGrid">
            <label>
              <span>Date</span>
              <input
                type="date"
                value={transactionDate}
                onChange={(event) => setTransactionDate(event.target.value)}
              />
            </label>

            <label>
              <span>Account</span>
              <select
                value={accountId}
                onChange={(event) => setAccountId(Number(event.target.value))}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Entry Type</span>
              <select
                value={entryType}
                onChange={(event) => setEntryType(event.target.value)}
              >
                {entryTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.direction === "in" ? "Money In • " : "Money Out • "}
                    {option.label}
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
              <span>Party / Customer / Supplier</span>
              <input
                value={partyName}
                onChange={(event) => setPartyName(event.target.value)}
                placeholder="Name"
              />
            </label>

            <label>
              <span>Reference Number</span>
              <input
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
                placeholder="Receipt / UPI / bank reference"
              />
            </label>
          </div>

          <label className="notesField">
            <span>Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional details"
            />
          </label>

          <div
            className={
              selectedEntryType?.direction === "out"
                ? "directionPreview directionOut"
                : "directionPreview directionIn"
            }
          >
            {selectedEntryType?.direction === "out"
              ? "Money will be recorded as OUT"
              : "Money will be recorded as IN"}
          </div>

          <button type="submit" className="saveButton" disabled={saving}>
            {saving ? "Saving Entry..." : "Save Cash / Bank Entry"}
          </button>
        </form>

        <section className="bookPanel">
          <div className="bookHeader">
            <div>
              <span>DAY BOOK</span>
              <h2>Money Movement Register</h2>
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
              placeholder="Search entry, party or reference..."
            />

            <select
              value={directionFilter}
              onChange={(event) => setDirectionFilter(event.target.value)}
            >
              <option value="all">Money In & Out</option>
              <option value="in">Money In</option>
              <option value="out">Money Out</option>
            </select>

            <select
              value={accountFilter}
              onChange={(event) => setAccountFilter(event.target.value)}
            >
              <option value="all">All Accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.account_name}>
                  {account.account_name}
                </option>
              ))}
            </select>
          </div>

          <div className="automaticNote">
            POS sales and Daily Expenses are included automatically in the
            summary. This register shows manually entered collections,
            payments, deposits and withdrawals.
          </div>

          {loading ? (
            <div className="emptyState">Loading Cash &amp; Bank Book...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="emptyState">
              No manual money movements found for this period.
            </div>
          ) : (
            <div className="transactionList">
              {filteredTransactions.map((transaction) => (
                <article
                  key={transaction.id}
                  className={
                    transaction.direction === "in"
                      ? "transactionCard moneyInCard"
                      : "transactionCard moneyOutCard"
                  }
                >
                  <div className="directionIcon">
                    {transaction.direction === "in" ? "↓" : "↑"}
                  </div>

                  <div className="transactionMain">
                    <span>{transaction.transaction_number || "ENTRY"}</span>
                    <h3>
                      {transaction.entry_type
                        .split("_")
                        .map(
                          (word) =>
                            word.charAt(0).toUpperCase() + word.slice(1),
                        )
                        .join(" ")}
                    </h3>
                    <p>
                      {formatDate(transaction.transaction_date)} •{" "}
                      {transaction.account_name}
                      {transaction.party_name
                        ? ` • ${transaction.party_name}`
                        : ""}
                    </p>
                    {transaction.notes && <small>{transaction.notes}</small>}
                  </div>

                  <div className="transactionMeta">
                    <span>
                      {transaction.direction === "in" ? "MONEY IN" : "MONEY OUT"}
                    </span>
                    <strong>
                      {transaction.direction === "in" ? "+" : "-"}
                      {formatCurrency(toNumber(transaction.amount))}
                    </strong>
                    {transaction.reference_number && (
                      <small>{transaction.reference_number}</small>
                    )}
                  </div>

                  <button
                    type="button"
                    className="deleteButton"
                    onClick={() => void deleteTransaction(transaction)}
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

        .cashBookPage {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(circle at 10% 0%, rgba(212,175,55,.13), transparent 25%),
            ${IVORY};
          color: #2c2c2c;
          font-family: Poppins, Inter, Arial, sans-serif;
        }

        .cashBookHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          padding: 23px 24px;
          border: 1px solid rgba(212,175,55,.34);
          border-radius: 22px;
          background:
            radial-gradient(circle at 90% 0%, rgba(212,175,55,.25), transparent 34%),
            linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: white;
          box-shadow: 0 18px 45px rgba(3,21,63,.18);
        }

        .cashBookHeader span,
        .sectionTitle span,
        .bookHeader > div > span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .cashBookHeader h1 {
          margin: 5px 0 0;
          font-size: 31px;
          font-weight: 950;
        }

        .cashBookHeader p {
          margin: 6px 0 0;
          color: rgba(255,255,255,.72);
          font-size: 10px;
        }

        .cashBookHeader button {
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

        .notice { background: #ecfdf3; color: #067647; }
        .error { background: #fef3f2; color: #b42318; }

        .primarySummary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap: 12px;
          margin: 15px 0 11px;
        }

        .primarySummary article {
          min-height: 116px;
          padding: 18px;
          border: 1px solid rgba(212,175,55,.36);
          border-radius: 18px;
          color: white;
          box-shadow: 0 12px 28px rgba(3,21,63,.14);
        }

        .cashCard {
          background: linear-gradient(135deg, #063c7c, ${DEEP_BLUE});
        }

        .digitalCard {
          background: linear-gradient(135deg, #0a2e73, #68500f);
        }

        .netCard {
          background: linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
        }

        .primarySummary span,
        .primarySummary strong,
        .primarySummary small,
        .miniSummary span,
        .miniSummary strong,
        .miniSummary small {
          display: block;
        }

        .primarySummary span,
        .miniSummary span {
          color: ${GOLD};
          font-size: 8px;
          font-weight: 950;
        }

        .primarySummary strong {
          margin-top: 8px;
          font-size: 24px;
          font-weight: 950;
        }

        .primarySummary small,
        .miniSummary small {
          margin-top: 5px;
          color: rgba(255,255,255,.64);
          font-size: 8px;
        }

        .miniSummary {
          display: grid;
          grid-template-columns: repeat(6, minmax(0,1fr));
          gap: 8px;
          margin-bottom: 14px;
        }

        .miniSummary article {
          min-height: 88px;
          padding: 13px;
          border: 1px solid rgba(212,175,55,.25);
          border-radius: 14px;
          background: linear-gradient(135deg, ${ROYAL_BLUE}, ${DEEP_BLUE});
          color: white;
        }

        .miniSummary strong {
          margin-top: 6px;
          font-size: 15px;
          font-weight: 950;
        }

        .cashBookWorkspace {
          display: grid;
          grid-template-columns: minmax(310px,.82fr) minmax(0,1.7fr);
          gap: 14px;
        }

        .entryForm,
        .bookPanel {
          border: 1px solid rgba(10,46,115,.1);
          border-radius: 19px;
          background: white;
          box-shadow: 0 12px 30px rgba(10,46,115,.07);
        }

        .entryForm {
          align-self: start;
          position: sticky;
          top: 18px;
          padding: 18px;
        }

        .sectionTitle h2,
        .bookHeader h2 {
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

        .directionPreview {
          margin-top: 10px;
          padding: 9px 10px;
          border-radius: 9px;
          font-size: 8px;
          font-weight: 900;
          text-align: center;
        }

        .directionIn { background: #ecfdf3; color: #067647; }
        .directionOut { background: #fef3f2; color: #b42318; }

        .saveButton {
          width: 100%;
          min-height: 46px;
          margin-top: 11px;
          border: 1px solid ${GOLD};
          border-radius: 11px;
          background: linear-gradient(135deg, ${ROYAL_BLUE}, ${DEEP_BLUE});
          color: white;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .bookPanel { overflow: hidden; }

        .bookHeader {
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
          grid-template-columns: minmax(0,1fr) 150px 170px;
          gap: 8px;
          padding: 12px 18px;
          border-bottom: 1px solid #edf0f4;
          background: #f8fafc;
        }

        .automaticNote {
          padding: 10px 18px;
          border-bottom: 1px solid #edf0f4;
          background: #fff9e7;
          color: #775d11;
          font-size: 8px;
          font-weight: 750;
        }

        .transactionList {
          display: grid;
          gap: 8px;
          padding: 12px;
          background: #f8fafc;
        }

        .transactionCard {
          display: grid;
          grid-template-columns: 46px minmax(0,1fr) 155px 70px;
          align-items: center;
          gap: 11px;
          padding: 12px;
          border: 1px solid #e4e7ec;
          border-radius: 13px;
          background: white;
        }

        .moneyInCard { border-left: 4px solid #12b76a; }
        .moneyOutCard { border-left: 4px solid #f04438; }

        .directionIcon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: ${ROYAL_BLUE};
          color: ${GOLD};
          font-size: 20px;
          font-weight: 950;
        }

        .transactionMain span {
          color: ${GOLD};
          font-size: 7px;
          font-weight: 900;
        }

        .transactionMain h3 {
          margin: 3px 0 0;
          color: ${ROYAL_BLUE};
          font-size: 11px;
        }

        .transactionMain p,
        .transactionMain small {
          display: block;
          margin: 3px 0 0;
          color: #7b8491;
          font-size: 8px;
        }

        .transactionMeta { text-align: right; }

        .transactionMeta span,
        .transactionMeta strong,
        .transactionMeta small {
          display: block;
        }

        .transactionMeta span {
          color: #7b8491;
          font-size: 7px;
          font-weight: 900;
        }

        .transactionMeta strong {
          margin-top: 3px;
          color: ${ROYAL_BLUE};
          font-size: 13px;
        }

        .transactionMeta small {
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

        @media (max-width: 1180px) {
          .miniSummary {
            grid-template-columns: repeat(3, minmax(0,1fr));
          }

          .cashBookWorkspace {
            grid-template-columns: 1fr;
          }

          .entryForm {
            position: static;
          }
        }

        @media (max-width: 760px) {
          .cashBookPage { padding: 12px 8px 30px; }

          .cashBookHeader,
          .bookHeader {
            align-items: stretch;
            flex-direction: column;
          }

          .primarySummary,
          .miniSummary,
          .formGrid,
          .dateFilters,
          .filters {
            grid-template-columns: 1fr;
          }

          .transactionCard {
            grid-template-columns: 42px minmax(0,1fr);
          }

          .transactionMeta,
          .deleteButton {
            grid-column: 1 / -1;
          }

          .transactionMeta { text-align: left; }
        }
      `}</style>
    </main>
  );
}