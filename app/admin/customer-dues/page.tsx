"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CreditAccount = {
  id: number;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  credit_limit?: number | string | null;
  total_credit_given?: number | string | null;
  total_credit_paid?: number | string | null;
  current_balance?: number | string | null;
  last_credit_date?: string | null;
  last_payment_date?: string | null;
  next_due_date?: string | null;
  is_blocked?: boolean | null;
  is_active?: boolean | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CreditTransaction = {
  id: number;
  credit_account_id?: number | null;
  customer_id?: number | null;
  customer_phone?: string | null;
  sale_id?: string | number | null;
  transaction_type?: string | null;
  amount_change?: number | string | null;
  balance_before?: number | string | null;
  balance_after?: number | string | null;
  payment_method?: string | null;
  reference_number?: string | null;
  due_date?: string | null;
  description?: string | null;
  notes?: string | null;
  received_by?: string | null;
  created_at?: string | null;
};

type ReminderLog = {
  id: number;
  credit_account_id?: number | null;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  outstanding_balance?: number | string | null;
  due_date?: string | null;
  reminder_type?: string | null;
  reminder_status?: string | null;
  message_text?: string | null;
  sent_by?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
};

type AccountFilter = "all" | "due" | "overdue" | "blocked" | "clear";

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

function isOverdue(account: CreditAccount) {
  const balance = toNumber(account.current_balance);
  if (balance <= 0 || !account.next_due_date) return false;

  const dueDate = new Date(account.next_due_date);
  const today = new Date();

  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return dueDate.getTime() < today.getTime();
}

export default function CustomerDuesPage() {
  const [accounts, setAccounts] = useState<CreditAccount[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [reminderLogs, setReminderLogs] = useState<ReminderLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<AccountFilter>("all");

  const [selectedAccount, setSelectedAccount] =
    useState<CreditAccount | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [whatsAppSendingAccountId, setWhatsAppSendingAccountId] =
    useState<number | null>(null);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");

    try {
      const { data: accountData, error: accountError } = await supabase
        .from("customer_credit_accounts")
        .select("*")
        .order("current_balance", { ascending: false });

      if (accountError) throw accountError;

      const { data: transactionData, error: transactionError } = await supabase
        .from("customer_credit_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (transactionError) throw transactionError;

      const { data: reminderData, error: reminderError } = await supabase
        .from("credit_reminder_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (reminderError) {
        console.warn("Reminder logs could not be loaded:", reminderError.message);
      }

      setAccounts((accountData || []) as unknown as CreditAccount[]);
      setTransactions(
        (transactionData || []) as unknown as CreditTransaction[],
      );
      setReminderLogs((reminderData || []) as unknown as ReminderLog[]);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load customer credit accounts.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredAccounts = useMemo(() => {
    const query = normalize(searchQuery);

    return accounts.filter((account) => {
      const balance = toNumber(account.current_balance);
      const overdue = isOverdue(account);

      const matchesSearch =
        !query ||
        [
          account.customer_name,
          account.customer_phone,
          account.customer_email,
          account.customer_address,
          account.customer_id ? String(account.customer_id) : "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesFilter =
        filter === "all" ||
        (filter === "due" && balance > 0) ||
        (filter === "overdue" && overdue) ||
        (filter === "blocked" && account.is_blocked === true) ||
        (filter === "clear" && balance <= 0);

      return matchesSearch && matchesFilter;
    });
  }, [accounts, filter, searchQuery]);

  const statistics = useMemo(() => {
    const totalCreditGiven = accounts.reduce(
      (sum, account) => sum + toNumber(account.total_credit_given),
      0,
    );

    const totalCreditPaid = accounts.reduce(
      (sum, account) => sum + toNumber(account.total_credit_paid),
      0,
    );

    const totalBalance = accounts.reduce(
      (sum, account) => sum + toNumber(account.current_balance),
      0,
    );

    return {
      customers: accounts.length,
      totalCreditGiven,
      totalCreditPaid,
      totalBalance,
      overdue: accounts.filter(isOverdue).length,
      blocked: accounts.filter((account) => account.is_blocked === true).length,
    };
  }, [accounts]);

  const selectedTransactions = useMemo(() => {
    if (!selectedAccount) return [];

    return transactions.filter(
      (transaction) =>
        transaction.credit_account_id === selectedAccount.id ||
        (selectedAccount.customer_id &&
          transaction.customer_id === selectedAccount.customer_id),
    );
  }, [selectedAccount, transactions]);

  const selectedReminders = useMemo(() => {
    if (!selectedAccount) return [];

    return reminderLogs.filter(
      (log) =>
        log.credit_account_id === selectedAccount.id ||
        (selectedAccount.customer_id &&
          log.customer_id === selectedAccount.customer_id),
    );
  }, [reminderLogs, selectedAccount]);

  function openPaymentModal(account: CreditAccount) {
    setSelectedAccount(account);
    setPaymentAmount(toNumber(account.current_balance));
    setPaymentMethod("cash");
    setReferenceNumber("");
    setPaymentNotes("");
    setShowPaymentModal(true);
  }

  async function savePayment() {
    if (!selectedAccount || savingPayment) return;

    const currentBalance = toNumber(selectedAccount.current_balance);
    const amount = Math.round(Math.max(0, paymentAmount) * 100) / 100;

    if (amount <= 0) {
      setNotice("Enter a valid payment amount.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    if (amount > currentBalance) {
      setNotice(
        `Payment cannot exceed current due of ${formatCurrency(
          currentBalance,
        )}.`,
      );
      window.setTimeout(() => setNotice(""), 3500);
      return;
    }

    setSavingPayment(true);

    try {
      const { data, error } = await supabase.rpc(
        "receive_customer_credit_payment",
        {
          p_credit_account_id: selectedAccount.id,
          p_amount: amount,
          p_payment_method: paymentMethod,
          p_reference_number: referenceNumber.trim() || null,
          p_notes: paymentNotes.trim() || null,
        },
      );

      if (error) throw error;

      const result = (data || {}) as {
        success?: boolean;
        balance_after?: number;
        fully_settled?: boolean;
        message?: string;
      };

      if (result.success === false) {
        throw new Error(result.message || "Unable to save customer payment.");
      }

      setShowPaymentModal(false);
      setSelectedAccount(null);
      setPaymentAmount(0);
      setReferenceNumber("");
      setPaymentNotes("");

      setNotice(
        result.fully_settled
          ? "Customer due fully settled successfully."
          : `Partial payment saved. Remaining due: ${formatCurrency(
              toNumber(result.balance_after),
            )}.`,
      );

      window.setTimeout(() => setNotice(""), 4000);
      await loadData(true);
    } catch (error) {
      console.error("Customer payment error:", error);

      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error
          ? String(
              (error as { message?: unknown }).message ||
                "Unable to save customer payment.",
            )
          : "Unable to save customer payment.";

      setNotice(message);
      window.setTimeout(() => setNotice(""), 4000);
    } finally {
      setSavingPayment(false);
    }
  }

  async function toggleBlocked(account: CreditAccount) {
    try {
      const { error } = await supabase
        .from("customer_credit_accounts")
        .update({
          is_blocked: account.is_blocked !== true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      if (error) throw error;

      setNotice(
        account.is_blocked
          ? "Customer credit account unblocked."
          : "Customer credit account blocked.",
      );
      window.setTimeout(() => setNotice(""), 3000);
      await loadData(true);
    } catch (error) {
      console.error(error);
      setNotice(
        error instanceof Error ? error.message : "Unable to update account.",
      );
      window.setTimeout(() => setNotice(""), 3000);
    }
  }

  async function sendWhatsAppReminder(account: CreditAccount) {
    if (whatsAppSendingAccountId !== null) return;

    const digits = (account.customer_phone || "").replace(/\D/g, "");
    const recipientPhone =
      digits.length === 10 ? `91${digits}` : digits;
    const balance = Math.max(0, toNumber(account.current_balance));

    if (
      recipientPhone.length < 10 ||
      recipientPhone.length > 15
    ) {
      setNotice("Customer phone number is missing or invalid.");
      window.setTimeout(() => setNotice(""), 3500);
      return;
    }

    if (balance <= 0) {
      setNotice("This customer does not have a pending due.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    const accountTransactions = transactions.filter(
      (transaction) =>
        transaction.credit_account_id === account.id ||
        (account.customer_id &&
          transaction.customer_id === account.customer_id),
    );

    const latestCreditTransaction = accountTransactions.find(
      (transaction) =>
        normalize(transaction.transaction_type) !== "payment" &&
        toNumber(transaction.amount_change) > 0,
    );

    const invoiceNumber =
      latestCreditTransaction?.reference_number?.trim() ||
      `DUE-${account.id}-${new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "")}`;

    const totalCreditGiven = Math.max(
      balance,
      toNumber(account.total_credit_given),
    );
    const totalCreditPaid = Math.max(
      0,
      toNumber(account.total_credit_paid),
    );

    setWhatsAppSendingAccountId(account.id);
    setNotice("");

    try {
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
            customerName:
              account.customer_name || "Customer",
            customerPhone:
              account.customer_phone || "",
            billNumber: invoiceNumber,
            billDate: new Date().toLocaleString("en-IN"),
            paymentMethod: "CREDIT DUE REMINDER",
            subtotal: totalCreditGiven,
            discountAmount: 0,
            taxAmount: 0,
            roundOff: 0,
            billAmount: totalCreditGiven,
            paidAmount: totalCreditPaid,
            dueAmount: balance,
            items: [
              {
                name: "Outstanding Credit Balance",
                quantity: 1,
                mrp: balance,
                price: balance,
                total: balance,
                size: account.next_due_date
                  ? `Due: ${formatDate(account.next_due_date)}`
                  : "",
                color: "",
              },
            ],
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
            "WhatsApp due reminder PDF could not be sent."
          }${stageText}${detailText}`,
        );
      }

      const sentAt = new Date().toISOString();
      const reminderMessage = [
        `Pending due: ${formatCurrency(balance)}`,
        account.next_due_date
          ? `Due date: ${formatDate(account.next_due_date)}`
          : "",
        `Reference: ${invoiceNumber}`,
      ]
        .filter(Boolean)
        .join(" • ");

      const { error: logError } = await supabase
        .from("credit_reminder_logs")
        .insert({
          credit_account_id: account.id,
          customer_id: account.customer_id || null,
          customer_name:
            account.customer_name || "Customer",
          customer_phone:
            account.customer_phone || null,
          outstanding_balance: balance,
          due_date: account.next_due_date || null,
          reminder_type: "WHATSAPP_PDF",
          reminder_status: "SENT",
          message_text: reminderMessage,
          sent_by: "WEBSITE_ADMIN",
          sent_at: sentAt,
          created_at: sentAt,
        });

      if (logError) {
        console.info(
          "WhatsApp reminder sent, but reminder log was not saved:",
          logError.message,
        );
      }

      setNotice(
        `WhatsApp due reminder PDF sent directly to ${
          account.customer_name || "customer"
        }.`,
      );
      window.setTimeout(() => setNotice(""), 4000);
      await loadData(true);
    } catch (error) {
      console.error(
        "Unable to send WhatsApp due reminder PDF:",
        error,
      );
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to send WhatsApp due reminder PDF.",
      );
      window.setTimeout(() => setNotice(""), 5000);
    } finally {
      setWhatsAppSendingAccountId(null);
    }
  }

  return (
    <main className="customerDuesPage">
      <section className="pageHeader">
        <div>
          <span>NEW CITY STYLE • CUSTOMER ACCOUNTS</span>
          <h1>Customer Credit & Due</h1>
          <p>
            Track customer balances, receive payments and send WhatsApp
            reminders.
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
          <span>Credit Customers</span>
          <strong>{statistics.customers}</strong>
        </article>

        <article>
          <span>Total Credit Given</span>
          <strong>{formatCurrency(statistics.totalCreditGiven)}</strong>
        </article>

        <article>
          <span>Total Credit Paid</span>
          <strong>{formatCurrency(statistics.totalCreditPaid)}</strong>
        </article>

        <article>
          <span>Current Customer Due</span>
          <strong>{formatCurrency(statistics.totalBalance)}</strong>
        </article>

        <article>
          <span>Overdue Accounts</span>
          <strong>{statistics.overdue}</strong>
        </article>

        <article>
          <span>Blocked Accounts</span>
          <strong>{statistics.blocked}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="toolbar">
          <div className="searchBox">
            <span>⌕</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search customer name, phone, email or address..."
            />
          </div>

          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as AccountFilter)
            }
          >
            <option value="all">All Accounts</option>
            <option value="due">Has Due</option>
            <option value="overdue">Overdue</option>
            <option value="blocked">Blocked</option>
            <option value="clear">No Due</option>
          </select>
        </div>

        {loading ? (
          <div className="loadingState">
            <div className="spinner" />
            <h2>Loading customer dues...</h2>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="emptyState">
            <h2>No customer credit accounts</h2>
            <p>Credit sales from POS will appear here.</p>
          </div>
        ) : (
          <div className="accountList">
            {filteredAccounts.map((account) => {
              const balance = toNumber(account.current_balance);
              const creditLimit = toNumber(account.credit_limit);
              const overdue = isOverdue(account);

              return (
                <article className="accountCard" key={account.id}>
                  <header>
                    <div className="avatar">
                      {(account.customer_name || "C")
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="customerTitle">
                      <h2>{account.customer_name || "Unnamed Customer"}</h2>
                      <p>
                        {account.customer_phone || "No phone"}
                        {account.customer_email
                          ? ` • ${account.customer_email}`
                          : ""}
                      </p>
                    </div>

                    <div className="badges">
                      {overdue && <span className="overdueBadge">Overdue</span>}
                      {account.is_blocked && (
                        <span className="blockedBadge">Blocked</span>
                      )}
                      {!account.is_active && (
                        <span className="inactiveBadge">Inactive</span>
                      )}
                    </div>
                  </header>

                  <div className="accountMeta">
                    <div>
                      <span>Credit Limit</span>
                      <strong>{formatCurrency(creditLimit)}</strong>
                    </div>

                    <div>
                      <span>Total Given</span>
                      <strong>
                        {formatCurrency(toNumber(account.total_credit_given))}
                      </strong>
                    </div>

                    <div>
                      <span>Total Paid</span>
                      <strong>
                        {formatCurrency(toNumber(account.total_credit_paid))}
                      </strong>
                    </div>

                    <div>
                      <span>Current Due</span>
                      <strong className={balance > 0 ? "dueText" : ""}>
                        {formatCurrency(balance)}
                      </strong>
                    </div>

                    <div>
                      <span>Next Due Date</span>
                      <strong>{formatDate(account.next_due_date)}</strong>
                    </div>

                    <div>
                      <span>Last Payment</span>
                      <strong>{formatDate(account.last_payment_date)}</strong>
                    </div>
                  </div>

                  {creditLimit > 0 && (
                    <div className="creditProgress">
                      <div>
                        <span>
                          Credit used:{" "}
                          {Math.min(
                            100,
                            Math.round((balance / creditLimit) * 100),
                          )}
                          %
                        </span>
                        <strong>
                          {formatCurrency(balance)} /{" "}
                          {formatCurrency(creditLimit)}
                        </strong>
                      </div>

                      <div className="track">
                        <span
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, (balance / creditLimit) * 100),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <footer>
                    <button
                      type="button"
                      onClick={() => setSelectedAccount(account)}
                    >
                      View History
                    </button>

                    {balance > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void sendWhatsAppReminder(account)
                          }
                          disabled={
                            whatsAppSendingAccountId !== null
                          }
                        >
                          {whatsAppSendingAccountId === account.id
                            ? "Sending..."
                            : "WhatsApp PDF Reminder"}
                        </button>

                        <button
                          type="button"
                          className="payButton"
                          onClick={() => openPaymentModal(account)}
                        >
                          Receive Payment
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleBlocked(account)}
                    >
                      {account.is_blocked ? "Unblock Credit" : "Block Credit"}
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedAccount && !showPaymentModal && (
        <div className="modalOverlay">
          <section className="historyModal">
            <button
              type="button"
              className="closeButton"
              onClick={() => setSelectedAccount(null)}
            >
              ✕
            </button>

            <span>CUSTOMER CREDIT HISTORY</span>
            <h2>{selectedAccount.customer_name || "Customer"}</h2>
            <p>
              Current due:{" "}
              <strong>
                {formatCurrency(toNumber(selectedAccount.current_balance))}
              </strong>
            </p>

            <div className="historyList">
              {selectedTransactions.length === 0 ? (
                <div className="historyEmpty">No transactions found.</div>
              ) : (
                selectedTransactions.map((transaction) => {
                  const isPayment =
                    normalize(transaction.transaction_type) === "payment" ||
                    toNumber(transaction.amount_change) < 0;

                  return (
                    <article key={transaction.id}>
                      <div>
                        <strong>
                          {transaction.description ||
                            (isPayment ? "Payment Received" : "Credit Sale")}
                        </strong>
                        <span>
                          {formatDate(transaction.created_at)}
                          {transaction.payment_method
                            ? ` • ${transaction.payment_method}`
                            : ""}
                        </span>
                        {transaction.reference_number && (
                          <span>
                            Ref: {transaction.reference_number}
                          </span>
                        )}
                      </div>

                      <div>
                        <strong
                          className={isPayment ? "paymentText" : "creditText"}
                        >
                          {isPayment ? "− " : "+ "}
                          {formatCurrency(
                            Math.abs(toNumber(transaction.amount_change)),
                          )}
                        </strong>
                        <span>
                          Balance:{" "}
                          {formatCurrency(toNumber(transaction.balance_after))}
                        </span>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {selectedReminders.length > 0 && (
              <div className="reminderHistory">
                <h3>Reminder History</h3>
                {selectedReminders.slice(0, 5).map((log) => (
                  <p key={log.id}>
                    <strong>{log.reminder_type || "Reminder"}</strong>
                    <span>
                      {formatDate(log.sent_at || log.created_at)} •{" "}
                      {log.reminder_status || "Recorded"}
                    </span>
                  </p>
                ))}
              </div>
            )}

            {toNumber(selectedAccount.current_balance) > 0 && (
              <div className="modalActions">
                <button
                  type="button"
                  onClick={() =>
                    void sendWhatsAppReminder(selectedAccount)
                  }
                  disabled={
                    whatsAppSendingAccountId !== null
                  }
                >
                  {whatsAppSendingAccountId === selectedAccount.id
                    ? "Sending..."
                    : "Send WhatsApp PDF Reminder"}
                </button>

                <button
                  type="button"
                  onClick={() => openPaymentModal(selectedAccount)}
                >
                  Receive Payment
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {showPaymentModal && selectedAccount && (
        <div className="modalOverlay">
          <section className="paymentModal">
            <button
              type="button"
              className="closeButton"
              onClick={() => {
                setShowPaymentModal(false);
                setSelectedAccount(null);
              }}
            >
              ✕
            </button>

            <span>RECEIVE CUSTOMER PAYMENT</span>
            <h2>{selectedAccount.customer_name || "Customer"}</h2>
            <p>
              Current due:{" "}
              <strong>
                {formatCurrency(toNumber(selectedAccount.current_balance))}
              </strong>
            </p>

            <div className="paymentQuickRow">
              <span>Payment Amount</span>
              <button
                type="button"
                onClick={() =>
                  setPaymentAmount(
                    toNumber(selectedAccount.current_balance),
                  )
                }
              >
                Pay Full Due
              </button>
            </div>

            <label>
              <span>Payment Amount</span>
              <input
                type="number"
                min="0"
                max={toNumber(selectedAccount.current_balance)}
                step="0.01"
                value={paymentAmount || ""}
                onChange={(event) =>
                  setPaymentAmount(
                    Math.max(0, toNumber(event.target.value)),
                  )
                }
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
                <option value="bank">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              <span>Reference Number</span>
              <input
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
                placeholder="Optional payment reference"
              />
            </label>

            <label>
              <span>Notes</span>
              <textarea
                value={paymentNotes}
                onChange={(event) => setPaymentNotes(event.target.value)}
                placeholder="Optional payment notes"
              />
            </label>

            <div className="paymentPreview">
              <span>Remaining Due After Payment</span>
              <strong>
                {formatCurrency(
                  Math.max(
                    0,
                    toNumber(selectedAccount.current_balance) -
                      Math.min(
                        Math.max(0, paymentAmount),
                        toNumber(selectedAccount.current_balance),
                      ),
                  ),
                )}
              </strong>
            </div>

            <button
              type="button"
              onClick={savePayment}
              disabled={
                savingPayment ||
                paymentAmount <= 0 ||
                paymentAmount >
                  toNumber(selectedAccount.current_balance)
              }
            >
              {savingPayment ? "Saving..." : "Save Payment"}
            </button>
          </section>
        </div>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .customerDuesPage {
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
          color: white;
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
          grid-template-columns: repeat(6, minmax(0, 1fr));
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
          animation: customerDueStatRise 0.45s ease both;
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

        .statsGrid article:nth-child(6) {
          animation-delay: 0.29s;
          background: linear-gradient(
            135deg,
            rgba(5, 25, 74, 0.99),
            rgba(8, 37, 96, 0.98)
          );
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
          animation: customerDueStatShine 5.2s ease-in-out infinite;
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

        .statsGrid article:nth-child(6)::after {
          animation-delay: 3.5s;
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
          font-size: 22px;
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
          grid-template-columns: minmax(0, 1fr) 210px;
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

        .accountList {
          display: grid;
          gap: 13px;
          padding: 15px;
          background: #f8fafc;
        }

        .accountCard {
          padding: 17px;
          border: 1px solid rgba(10, 46, 115, 0.12);
          border-radius: 17px;
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 1),
              rgba(248, 250, 253, 0.98)
            );
          box-shadow: 0 8px 22px rgba(3, 21, 63, 0.06);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            border-color 0.2s ease;
        }

        .accountCard:hover {
          transform: translateY(-2px);
          border-color: rgba(212, 175, 55, 0.4);
          box-shadow: 0 14px 30px rgba(3, 21, 63, 0.1);
        }

        .accountCard header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .avatar {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 14px;
          background: linear-gradient(135deg, ${ROYAL_BLUE}, #164ca8);
          color: ${GOLD};
          font-size: 16px;
          font-weight: 950;
        }

        .customerTitle {
          min-width: 0;
          flex: 1;
        }

        .customerTitle h2 {
          margin: 0;
          color: ${DEEP_BLUE};
          font-size: 17px;
        }

        .customerTitle p {
          margin: 5px 0 0;
          overflow: hidden;
          color: #8a93a0;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .badges {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 6px;
        }

        .overdueBadge,
        .blockedBadge,
        .inactiveBadge {
          padding: 6px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 850;
        }

        .overdueBadge {
          background: #fff4e8;
          color: #b54708;
        }

        .blockedBadge {
          background: #fef3f2;
          color: #b42318;
        }

        .inactiveBadge {
          background: #f2f4f7;
          color: #667085;
        }

        .accountMeta {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 9px;
          margin-top: 14px;
        }

        .accountMeta > div {
          padding: 10px;
          border-radius: 10px;
          background: #f8fafc;
        }

        .accountMeta span,
        .accountMeta strong {
          display: block;
        }

        .accountMeta span {
          color: #98a2b3;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .accountMeta strong {
          margin-top: 4px;
          color: #344054;
          font-size: 10px;
        }

        .dueText {
          color: #b42318 !important;
        }

        .creditProgress {
          margin-top: 12px;
          padding: 10px;
          border-radius: 10px;
          background: #fffdf5;
        }

        .creditProgress > div:first-child {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: #667085;
          font-size: 9px;
          font-weight: 800;
        }

        .track {
          height: 8px;
          margin-top: 8px;
          overflow: hidden;
          border-radius: 999px;
          background: #e4e7ec;
        }

        .track span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, ${GOLD}, #ef7d3c);
        }

        .accountCard footer {
          display: flex;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 13px;
        }

        .accountCard footer button,
        .modalActions button,
        .paymentModal > button:last-child {
          min-height: 39px;
          padding: 0 13px;
          border: 1px solid rgba(10, 46, 115, 0.16);
          border-radius: 10px;
          background: linear-gradient(180deg, #ffffff, #f5f7fb);
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            border-color 0.18s ease,
            filter 0.18s ease;
        }

        .accountCard footer button:hover:not(:disabled),
        .modalActions button:hover:not(:disabled),
        .paymentModal > button:last-child:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(212, 175, 55, 0.58);
          box-shadow: 0 8px 18px rgba(3, 21, 63, 0.1);
        }

        .accountCard footer button:nth-child(2),
        .modalActions button:first-child {
          border-color: rgba(31, 157, 85, 0.35);
          background: linear-gradient(135deg, #1f9d55, #167a42);
          color: #ffffff;
        }

        .accountCard footer .payButton,
        .modalActions button:last-child,
        .paymentModal > button:last-child {
          border-color: rgba(212, 175, 55, 0.82);
          background: linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: #ffffff;
          box-shadow: 0 10px 22px rgba(3, 21, 63, 0.15);
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

        .historyModal,
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
          width: min(460px, 100%);
        }

        .historyModal > span,
        .paymentModal > span {
          color: ${GOLD};
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .historyModal h2,
        .paymentModal h2 {
          margin: 7px 0 0;
          color: ${ROYAL_BLUE};
        }

        .historyModal > p,
        .paymentModal > p {
          color: #667085;
          font-size: 12px;
        }

        .closeButton {
          position: absolute;
          z-index: 5;
          top: 12px;
          right: 12px;
          width: 38px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 1px solid rgba(10, 46, 115, 0.28);
          border-radius: 10px;
          background: #ffffff;
          color: ${ROYAL_BLUE};
          font-family: Arial, Helvetica, sans-serif;
          font-size: 22px;
          font-weight: 900;
          line-height: 1;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(3, 21, 63, 0.12);
          transition:
            transform 0.18s ease,
            background 0.18s ease,
            color 0.18s ease,
            border-color 0.18s ease;
        }

        .closeButton:hover {
          transform: scale(1.04);
          border-color: ${GOLD};
          background: ${ROYAL_BLUE};
          color: #ffffff;
        }

        .historyList {
          display: grid;
          gap: 8px;
          margin-top: 16px;
        }

        .historyList article {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 11px;
          border: 1px solid #e4e7ec;
          border-radius: 10px;
        }

        .historyList strong,
        .historyList span {
          display: block;
        }

        .historyList strong {
          color: ${ROYAL_BLUE};
          font-size: 10px;
        }

        .historyList span {
          margin-top: 3px;
          color: #8a93a0;
          font-size: 8px;
        }

        .paymentText {
          color: #067647 !important;
        }

        .creditText {
          color: #b42318 !important;
        }

        .historyEmpty {
          padding: 25px;
          border-radius: 10px;
          background: #f8fafc;
          color: #667085;
          text-align: center;
          font-size: 11px;
        }

        .reminderHistory {
          margin-top: 17px;
          padding-top: 14px;
          border-top: 1px solid #e4e7ec;
        }

        .reminderHistory h3 {
          color: ${ROYAL_BLUE};
          font-size: 13px;
        }

        .reminderHistory p {
          margin: 8px 0 0;
          padding: 9px;
          border-radius: 9px;
          background: #f8fafc;
        }

        .reminderHistory strong,
        .reminderHistory span {
          display: block;
        }

        .reminderHistory strong {
          font-size: 9px;
        }

        .reminderHistory span {
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

        .paymentQuickRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 14px;
        }

        .paymentQuickRow > span {
          color: #667085;
          font-size: 10px;
          font-weight: 800;
        }

        .paymentQuickRow button {
          min-height: 33px;
          padding: 0 10px;
          border: 1px solid rgba(212, 175, 55, 0.75);
          border-radius: 9px;
          background: linear-gradient(135deg, ${GOLD}, #f0d267);
          color: ${DEEP_BLUE};
          font: inherit;
          font-size: 8px;
          font-weight: 900;
          cursor: pointer;
        }

        .paymentPreview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 14px;
          padding: 12px;
          border: 1px solid rgba(10, 46, 115, 0.12);
          border-radius: 11px;
          background: #f7f9fc;
        }

        .paymentPreview span {
          color: #667085;
          font-size: 9px;
          font-weight: 800;
        }

        .paymentPreview strong {
          color: ${ROYAL_BLUE};
          font-size: 14px;
          font-weight: 950;
        }

        .paymentModal label {
          display: grid;
          gap: 6px;
          margin-top: 13px;
        }

        .paymentModal label span {
          color: #667085;
          font-size: 10px;
          font-weight: 800;
        }

        .paymentModal textarea {
          min-height: 86px;
          padding-top: 10px;
          resize: vertical;
        }

        .paymentModal > button:last-child {
          width: 100%;
          margin-top: 15px;
          border-color: ${GOLD};
          background: ${ROYAL_BLUE};
          color: white;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes customerDueStatRise {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes customerDueStatShine {
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

        @media (max-width: 1200px) {
          .statsGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .accountMeta {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .customerDuesPage {
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

          .accountMeta {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .accountCard header {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .badges {
            width: 100%;
            justify-content: flex-start;
          }

          .accountMeta {
            grid-template-columns: 1fr;
          }

          .accountCard footer,
          .modalActions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .historyList article {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}