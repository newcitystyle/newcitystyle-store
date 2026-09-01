"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ChequeStatus = "UPCOMING" | "CLEARED" | "CANCELLED";

type ChequeRow = {
  id: string;
  client_transaction_id: string;
  supplier_name: string;
  bank_name: string;
  cheque_number: string;
  amount: number;
  given_date: number;
  due_date: number;
  notes: string | null;
  status: ChequeStatus;
  cleared_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  device_id: string | null;
  created_at: string;
  updated_at: string;
};

type ChequeFormState = {
  supplierName: string;
  bankName: string;
  chequeNumber: string;
  amount: string;
  givenDate: string;
  dueDate: string;
  notes: string;
};

const DAY_MS = 86_400_000;

function localDateInput(value: number | string | Date) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateInputToMillis(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

function startOfToday() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function emptyForm(): ChequeFormState {
  const today = new Date();
  const due = new Date();
  due.setDate(due.getDate() + 7);

  return {
    supplierName: "",
    bankName: "",
    chequeNumber: "",
    amount: "",
    givenDate: localDateInput(today),
    dueDate: localDateInput(due),
    notes: "",
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getDisplayStatus(cheque: ChequeRow) {
  if (cheque.status === "CLEARED") {
    return {
      label: "CLEARED",
      tone: "cleared",
      days: 0,
    };
  }

  if (cheque.status === "CANCELLED") {
    return {
      label: "CANCELLED",
      tone: "cancelled",
      days: 0,
    };
  }

  const difference = Math.round((cheque.due_date - startOfToday()) / DAY_MS);

  if (difference < 0) {
    return {
      label: `OVERDUE ${Math.abs(difference)} DAY${
        Math.abs(difference) === 1 ? "" : "S"
      }`,
      tone: "overdue",
      days: difference,
    };
  }

  if (difference === 0) {
    return {
      label: "DUE TODAY",
      tone: "today",
      days: difference,
    };
  }

  if (difference === 1) {
    return {
      label: "DUE TOMORROW",
      tone: "soon",
      days: difference,
    };
  }

  if (difference === 2) {
    return {
      label: "DUE IN 2 DAYS",
      tone: "soon",
      days: difference,
    };
  }

  return {
    label: "UPCOMING",
    tone: "upcoming",
    days: difference,
  };
}

export default function BankChequeRemindersPage() {
  const [cheques, setCheques] = useState<ChequeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCheque, setEditingCheque] = useState<ChequeRow | null>(null);
  const [form, setForm] = useState<ChequeFormState>(emptyForm());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "ALL" | "UPCOMING" | "DUE_SOON" | "OVERDUE" | "CLEARED" | "CANCELLED"
  >("ALL");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadCheques(showLoader = false) {
    if (showLoader) setLoading(true);

    const { data, error } = await supabase
      .from("billing_cheques")
      .select("*")
      .eq("is_deleted", false)
      .order("due_date", { ascending: true })
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Load bank cheques error:", error);
      setErrorMessage(error.message);
      setCheques([]);
    } else {
      setErrorMessage("");
      setCheques((data as ChequeRow[]) || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadCheques(true);

    const channel = supabase
      .channel("ncs-admin-bank-cheques")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "billing_cheques",
        },
        () => void loadCheques(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const summary = useMemo(() => {
    const upcoming = cheques.filter((item) => item.status === "UPCOMING");
    const dueSoon = upcoming.filter((item) => {
      const difference = Math.round((item.due_date - startOfToday()) / DAY_MS);

      return difference >= 0 && difference <= 2;
    });
    const overdue = upcoming.filter((item) => item.due_date < startOfToday());

    return {
      upcomingCount: upcoming.length,
      upcomingAmount: upcoming.reduce(
        (total, item) => total + Number(item.amount || 0),
        0,
      ),
      dueSoonCount: dueSoon.length,
      dueSoonAmount: dueSoon.reduce(
        (total, item) => total + Number(item.amount || 0),
        0,
      ),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce(
        (total, item) => total + Number(item.amount || 0),
        0,
      ),
      nextDue:
        upcoming.length > 0
          ? Math.min(...upcoming.map((item) => item.due_date))
          : null,
    };
  }, [cheques]);

  const filteredCheques = useMemo(() => {
    const term = search.trim().toLowerCase();

    return cheques.filter((cheque) => {
      const status = getDisplayStatus(cheque);

      const matchesSearch =
        !term ||
        cheque.supplier_name.toLowerCase().includes(term) ||
        cheque.bank_name.toLowerCase().includes(term) ||
        cheque.cheque_number.toLowerCase().includes(term) ||
        String(cheque.amount).includes(term);

      if (!matchesSearch) return false;

      if (filter === "ALL") return true;
      if (filter === "UPCOMING") {
        return cheque.status === "UPCOMING";
      }
      if (filter === "DUE_SOON") {
        return (
          cheque.status === "UPCOMING" && status.days >= 0 && status.days <= 2
        );
      }
      if (filter === "OVERDUE") {
        return cheque.status === "UPCOMING" && status.days < 0;
      }

      return cheque.status === filter;
    });
  }, [cheques, filter, search]);

  function openAddForm() {
    setEditingCheque(null);
    setForm(emptyForm());
    setErrorMessage("");
    setShowForm(true);
  }

  function openEditForm(cheque: ChequeRow) {
    setEditingCheque(cheque);
    setForm({
      supplierName: cheque.supplier_name,
      bankName: cheque.bank_name,
      chequeNumber: cheque.cheque_number,
      amount: String(cheque.amount),
      givenDate: localDateInput(cheque.given_date),
      dueDate: localDateInput(cheque.due_date),
      notes: cheque.notes || "",
    });
    setErrorMessage("");
    setShowForm(true);
  }

  async function saveCheque(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(form.amount);
    const givenDate = dateInputToMillis(form.givenDate);
    const dueDate = dateInputToMillis(form.dueDate);

    if (!form.supplierName.trim()) {
      setErrorMessage("Enter supplier name.");
      return;
    }

    if (!form.bankName.trim()) {
      setErrorMessage("Enter bank name.");
      return;
    }

    if (!form.chequeNumber.trim()) {
      setErrorMessage("Enter cheque number.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Enter a valid cheque amount.");
      return;
    }

    if (dueDate < givenDate) {
      setErrorMessage("Cheque due date cannot be before the given date.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const now = new Date().toISOString();

    const payload = {
      supplier_name: form.supplierName.trim(),
      bank_name: form.bankName.trim(),
      cheque_number: form.chequeNumber.trim(),
      amount,
      given_date: givenDate,
      due_date: dueDate,
      notes: form.notes.trim() || null,
      status: editingCheque?.status || "UPCOMING",
      is_deleted: false,
      device_id: "website-admin",
      updated_at: now,
    };

    const result = editingCheque
      ? await supabase
          .from("billing_cheques")
          .update(payload)
          .eq("id", editingCheque.id)
      : await supabase.from("billing_cheques").insert({
          id: crypto.randomUUID(),
          client_transaction_id: crypto.randomUUID(),
          ...payload,
          cleared_at: null,
          deleted_at: null,
          deleted_by: null,
          created_at: now,
        });

    if (result.error) {
      console.error("Save bank cheque error:", result.error);
      setErrorMessage(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowForm(false);
    setEditingCheque(null);
    setForm(emptyForm());
    await loadCheques();
  }

  async function updateStatus(cheque: ChequeRow, status: ChequeStatus) {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("billing_cheques")
      .update({
        status,
        cleared_at: status === "CLEARED" ? now : null,
        updated_at: now,
        device_id: "website-admin",
      })
      .eq("id", cheque.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadCheques();
  }

  async function softDeleteCheque(cheque: ChequeRow) {
    const confirmed = window.confirm(
      `Delete cheque ${cheque.cheque_number} for ${cheque.supplier_name}?`,
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("billing_cheques")
      .update({
        is_deleted: true,
        deleted_at: now,
        deleted_by: "website-admin",
        updated_at: now,
        device_id: "website-admin",
      })
      .eq("id", cheque.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadCheques();
  }

  return (
    <main className="chequePage">
      <section className="chequeHero">
        <div>
          <span className="chequeEyebrow">
            NEW CITY STYLE • FINANCIAL CONTROL
          </span>
          <h1>BANK CHEQUE REMINDERS</h1>
          <p>
            App and website cheque records stay synchronized through Supabase.
            The top alert appears only from two days before the due date.
          </p>
        </div>

        <button className="primaryButton" onClick={openAddForm}>
          + ADD BANK CHEQUE
        </button>
      </section>

      <section className="summaryGrid">
        <article className="summaryCard">
          <span>UPCOMING CHEQUES</span>
          <strong>{summary.upcomingCount}</strong>
          <b>{formatMoney(summary.upcomingAmount)}</b>
        </article>

        <article className="summaryCard summaryGold">
          <span>DUE WITHIN 2 DAYS</span>
          <strong>{summary.dueSoonCount}</strong>
          <b>{formatMoney(summary.dueSoonAmount)}</b>
        </article>

        <article className="summaryCard summaryRed">
          <span>OVERDUE</span>
          <strong>{summary.overdueCount}</strong>
          <b>{formatMoney(summary.overdueAmount)}</b>
        </article>

        <article className="summaryCard">
          <span>NEXT DUE DATE</span>
          <strong className="dateStrong">
            {summary.nextDue
              ? formatDate(summary.nextDue)
              : "No pending cheque"}
          </strong>
          <b>Realtime sync active</b>
        </article>
      </section>

      <section className="toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search supplier, bank, cheque number or amount"
        />

        <div className="filterRow">
          {[
            ["ALL", "All"],
            ["UPCOMING", "Upcoming"],
            ["DUE_SOON", "Due Soon"],
            ["OVERDUE", "Overdue"],
            ["CLEARED", "Cleared"],
            ["CANCELLED", "Cancelled"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "activeFilter" : ""}
              onClick={() => setFilter(value as typeof filter)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {errorMessage && !showForm ? (
        <div className="pageError">{errorMessage}</div>
      ) : null}

      {loading ? (
        <section className="emptyState">
          <div className="loader" />
          <h2>Loading bank cheques...</h2>
        </section>
      ) : filteredCheques.length === 0 ? (
        <section className="emptyState">
          <span className="emptyIcon">📝</span>
          <h2>No bank cheques found</h2>
          <p>
            Add the first cheque here or add it in the Android Billing app. It
            will appear on both sides after sync.
          </p>
          <button className="primaryButton" onClick={openAddForm}>
            ADD FIRST CHEQUE
          </button>
        </section>
      ) : (
        <section className="chequeGrid">
          {filteredCheques.map((cheque) => {
            const display = getDisplayStatus(cheque);

            return (
              <article className="chequeCard" key={cheque.id}>
                <div className="chequePaper">
                  <div className="chequeWatermark">NCS</div>

                  <div className="bankLine">
                    <div className="bankMark">₹</div>
                    <div className="bankIdentity">
                      <span>BANK CHEQUE REMINDER</span>
                      <h2>{cheque.bank_name || "BANK NAME"}</h2>
                      <p>NEW CITY STYLE • ACCOUNT PAYEE RECORD</p>
                    </div>

                    <div className="dateBlock">
                      <small>DUE DATE • DD MM YYYY</small>
                      <div className="dateBoxes">
                        {chequeDateDigits(cheque.due_date).map(
                          (digit, index) => (
                            <b key={`${cheque.id}-date-${index}`}>{digit}</b>
                          ),
                        )}
                      </div>
                    </div>
                  </div>

                  <span className={`status status-${display.tone}`}>
                    {display.label}
                  </span>

                  <div className="payLine">
                    <span>PAY</span>
                    <strong>{cheque.supplier_name}</strong>
                  </div>

                  <div className="wordsAndAmount">
                    <div className="wordsLine">
                      <span>RUPEES</span>
                      <strong>{amountInWords(cheque.amount)}</strong>
                    </div>
                    <div className="amountBox">
                      <span>₹</span>
                      <strong>
                        {formatMoney(cheque.amount).replace("₹", "").trim()}
                      </strong>
                    </div>
                  </div>

                  <div className="accountLine">
                    <div>
                      <span>A/C PAYEE ONLY</span>
                      <strong>NEW CITY STYLE BUSINESS CHEQUE</strong>
                    </div>
                    <div className="signatureLine">
                      <span>GIVEN {formatDate(cheque.given_date)}</span>
                      <strong>AUTHORISED SIGNATORY</strong>
                    </div>
                  </div>

                  {cheque.notes ? (
                    <p className="notes">
                      <b>NOTE:</b> {cheque.notes}
                    </p>
                  ) : null}

                  <div className="micrLine">
                    <strong>⑆ {cheque.cheque_number} ⑆</strong>
                    <span>
                      SYNC {new Date(cheque.updated_at).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className="actionRow">
                  <button
                    className="editButton"
                    onClick={() => openEditForm(cheque)}
                  >
                    EDIT
                  </button>

                  {cheque.status === "UPCOMING" ? (
                    <>
                      <button
                        className="clearButton"
                        onClick={() => void updateStatus(cheque, "CLEARED")}
                      >
                        CLEARED
                      </button>

                      <button
                        className="cancelButton"
                        onClick={() => void updateStatus(cheque, "CANCELLED")}
                      >
                        CANCEL
                      </button>
                    </>
                  ) : (
                    <button
                      className="reopenButton"
                      onClick={() => void updateStatus(cheque, "UPCOMING")}
                    >
                      REOPEN
                    </button>
                  )}

                  <button
                    className="deleteButton"
                    onClick={() => void softDeleteCheque(cheque)}
                  >
                    DELETE
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {showForm ? (
        <div
          className="modalOverlay"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setShowForm(false);
            }
          }}
        >
          <form className="chequeModal" onSubmit={saveCheque}>
            <div className="modalHeader">
              <div>
                <span>{editingCheque ? "UPDATE RECORD" : "NEW RECORD"}</span>
                <h2>
                  {editingCheque ? "EDIT BANK CHEQUE" : "ADD BANK CHEQUE"}
                </h2>
              </div>

              <button
                type="button"
                className="closeButton"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>

            <div className="formGrid">
              <label>
                Supplier Name
                <input
                  value={form.supplierName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      supplierName: event.target.value,
                    }))
                  }
                  placeholder="Enter supplier name"
                />
              </label>

              <label>
                Bank Name
                <input
                  value={form.bankName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      bankName: event.target.value,
                    }))
                  }
                  placeholder="Example: SBI"
                />
              </label>

              <label>
                Cheque Number
                <input
                  value={form.chequeNumber}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      chequeNumber: event.target.value,
                    }))
                  }
                  inputMode="numeric"
                  placeholder="Enter cheque number"
                />
              </label>

              <label>
                Amount
                <input
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </label>

              <label>
                Cheque Given Date
                <input
                  type="date"
                  value={form.givenDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      givenDate: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Cheque Due Date
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dueDate: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="fullField">
                Notes (Optional)
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Add payment or supplier notes"
                />
              </label>
            </div>

            {errorMessage ? (
              <div className="formError">{errorMessage}</div>
            ) : null}

            <div className="modalActions">
              <button
                type="button"
                className="secondaryButton"
                onClick={() => setShowForm(false)}
              >
                CANCEL
              </button>

              <button type="submit" className="primaryButton" disabled={saving}>
                {saving ? "SAVING..." : "SAVE CHEQUE"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <style jsx>{`
        .chequePage {
          min-height: 100%;
          padding: 22px;
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(212, 175, 55, 0.13),
              transparent 27%
            ),
            #f8f4ec;
          color: #061d4a;
        }

        .chequeHero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
          padding: 28px;
          border: 1px solid rgba(212, 175, 55, 0.45);
          border-radius: 27px;
          background:
            radial-gradient(
              circle at 85% 15%,
              rgba(212, 175, 55, 0.24),
              transparent 34%
            ),
            linear-gradient(135deg, #020b24, #061d4a, #0a2e73);
          box-shadow: 0 18px 40px rgba(3, 21, 63, 0.2);
          color: white;
        }

        .chequeEyebrow {
          color: #d4af37;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 1.6px;
        }

        .chequeHero h1 {
          margin: 8px 0 5px;
          font-family: "Playfair Display", Georgia, serif;
          font-size: clamp(24px, 3.2vw, 40px);
          line-height: 1.06;
        }

        .chequeHero p {
          max-width: 710px;
          margin: 0;
          color: rgba(255, 255, 255, 0.72);
          font-size: 12px;
          line-height: 1.75;
        }

        .primaryButton,
        .secondaryButton {
          min-height: 43px;
          padding: 0 17px;
          border: 0;
          border-radius: 13px;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.5px;
          cursor: pointer;
        }

        .primaryButton {
          background: linear-gradient(135deg, #f1d16a, #d4af37);
          color: #061d4a;
          box-shadow: 0 10px 22px rgba(212, 175, 55, 0.2);
        }

        .primaryButton:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        .secondaryButton {
          border: 1px solid rgba(10, 46, 115, 0.18);
          background: #ffffff;
          color: #0a2e73;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
          margin-top: 16px;
        }

        .summaryCard {
          min-height: 128px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 18px;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 21px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 9px 24px rgba(3, 21, 63, 0.08);
        }

        .summaryCard span {
          color: #73798a;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.7px;
        }

        .summaryCard strong {
          margin-top: 8px;
          color: #0a2e73;
          font-size: 29px;
          line-height: 1;
        }

        .summaryCard b {
          margin-top: 8px;
          color: #9a7100;
          font-size: 11px;
        }

        .summaryGold {
          border-color: rgba(212, 175, 55, 0.42);
          background: linear-gradient(145deg, #ffffff, #fff8df);
        }

        .summaryRed {
          border-color: rgba(179, 38, 30, 0.28);
          background: linear-gradient(145deg, #ffffff, #fff0ee);
        }

        .summaryRed strong,
        .summaryRed b {
          color: #a11f18;
        }

        .dateStrong {
          font-size: 17px !important;
          line-height: 1.3 !important;
        }

        .toolbar {
          margin-top: 16px;
          padding: 14px;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 19px;
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 8px 20px rgba(3, 21, 63, 0.06);
        }

        .toolbar input {
          width: 100%;
          min-height: 45px;
          padding: 0 15px;
          border: 1px solid rgba(10, 46, 115, 0.17);
          border-radius: 13px;
          outline: 0;
          background: #ffffff;
          color: #2c2c2c;
          font-size: 12px;
        }

        .toolbar input:focus {
          border-color: #d4af37;
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.13);
        }

        .filterRow {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 10px;
        }

        .filterRow button {
          min-height: 34px;
          padding: 0 12px;
          border: 1px solid rgba(10, 46, 115, 0.13);
          border-radius: 999px;
          background: #ffffff;
          color: #536078;
          font-size: 9px;
          font-weight: 850;
          cursor: pointer;
        }

        .filterRow .activeFilter {
          border-color: #d4af37;
          background: #0a2e73;
          color: #ffffff;
        }

        .pageError,
        .formError {
          padding: 11px 13px;
          border: 1px solid rgba(179, 38, 30, 0.24);
          border-radius: 12px;
          background: #fff0ee;
          color: #a11f18;
          font-size: 11px;
          font-weight: 800;
        }

        .pageError {
          margin-top: 14px;
        }

        .chequeGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 16px;
        }

        .chequeCard {
          padding: 10px;
          overflow: hidden;
          border: 1px solid #91b9c3;
          border-radius: 18px;
          background: #edf9f8;
          box-shadow: 0 12px 27px rgba(4, 57, 68, 0.14);
          color: #123e47;
        }

        .chequePaper {
          position: relative;
          overflow: hidden;
          padding: 14px 16px 10px;
          border: 1px solid rgba(33, 118, 133, 0.34);
          border-radius: 12px;
          background:
            repeating-linear-gradient(
              0deg,
              rgba(20, 119, 133, 0.035) 0 1px,
              transparent 1px 5px
            ),
            linear-gradient(125deg, #effcf9, #d7f1f2 56%, #edf9f3);
        }

        .chequeWatermark {
          position: absolute;
          right: 7%;
          bottom: 5%;
          color: rgba(23, 115, 129, 0.07);
          font-size: 86px;
          font-weight: 950;
          letter-spacing: -8px;
          pointer-events: none;
        }

        .bankLine {
          display: flex;
          position: relative;
          z-index: 1;
          align-items: flex-start;
          gap: 10px;
        }

        .bankMark {
          width: 40px;
          height: 40px;
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          border: 2px solid #247c8a;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.58);
          color: #176b78;
          font-size: 20px;
          font-weight: 950;
        }

        .bankIdentity {
          min-width: 0;
          flex: 1;
        }

        .bankIdentity span {
          color: #297987;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.7px;
        }

        .bankIdentity h2 {
          overflow: hidden;
          margin: 2px 0 0;
          color: #124b56;
          font-size: 16px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bankIdentity p {
          margin: 2px 0 0;
          color: #56858d;
          font-size: 7px;
          font-weight: 750;
        }

        .dateBlock {
          flex: 0 0 auto;
          text-align: right;
        }
        .dateBlock small {
          color: #4c7f87;
          font-size: 6px;
          font-weight: 850;
        }
        .dateBoxes {
          display: flex;
          margin-top: 3px;
        }
        .dateBoxes b {
          width: 17px;
          height: 20px;
          display: grid;
          place-items: center;
          border: 1px solid #6c9da5;
          border-right: 0;
          background: rgba(255, 255, 255, 0.72);
          color: #123e47;
          font-size: 10px;
        }
        .dateBoxes b:last-child {
          border-right: 1px solid #6c9da5;
        }

        .payLine,
        .wordsLine {
          display: flex;
          position: relative;
          z-index: 1;
          align-items: flex-end;
          gap: 9px;
          margin-top: 13px;
        }

        .payLine span,
        .wordsLine span {
          flex: 0 0 auto;
          color: #477982;
          font-size: 8px;
          font-weight: 900;
        }

        .payLine strong,
        .wordsLine strong {
          min-height: 18px;
          flex: 1;
          padding: 0 5px 3px;
          border-bottom: 1px solid #739ca3;
          color: #0f3540;
          font-size: 13px;
          text-transform: uppercase;
        }

        .wordsAndAmount {
          display: flex;
          align-items: flex-end;
          gap: 10px;
        }
        .wordsLine {
          flex: 1;
        }
        .wordsLine strong {
          font-size: 9px;
        }
        .amountBox {
          display: flex;
          min-width: 130px;
          align-items: center;
          gap: 6px;
          padding: 7px 9px;
          border: 2px solid #276f7a;
          background: rgba(255, 255, 255, 0.64);
          color: #103f48;
        }
        .amountBox span {
          font-size: 18px;
          font-weight: 900;
        }
        .amountBox strong {
          font-size: 16px;
        }

        .accountLine,
        .micrLine {
          display: flex;
          position: relative;
          z-index: 1;
          justify-content: space-between;
          gap: 10px;
          margin-top: 13px;
        }
        .accountLine span {
          display: block;
          color: #4e7b84;
          font-size: 7px;
          font-weight: 800;
        }
        .accountLine strong {
          color: #164b55;
          font-size: 8px;
        }
        .signatureLine {
          min-width: 145px;
          padding-top: 10px;
          border-top: 1px solid #638c94;
          text-align: center;
        }
        .micrLine {
          align-items: center;
          padding-top: 8px;
          border-top: 1px solid rgba(36, 105, 116, 0.25);
        }
        .micrLine strong {
          color: #123e47;
          font-family: "Courier New", monospace;
          font-size: 13px;
          letter-spacing: 2px;
        }
        .micrLine span {
          color: #5b858c;
          font-size: 6px;
          font-weight: 750;
        }

        .status {
          position: absolute;
          z-index: 2;
          right: 16px;
          bottom: 49px;
          transform: rotate(-7deg);
          padding: 5px 8px;
          border: 2px solid currentColor;
          border-radius: 4px;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.7px;
        }

        .status-upcoming,
        .status-soon {
          color: #a66e00;
          background: rgba(255, 246, 208, 0.82);
        }

        .status-today,
        .status-overdue {
          color: #bd2d27;
          background: rgba(255, 236, 233, 0.82);
        }

        .status-cleared {
          color: #147147;
          background: rgba(231, 252, 239, 0.84);
        }

        .status-cancelled {
          color: #6d747b;
          background: rgba(245, 247, 248, 0.88);
        }

        .notes {
          position: relative;
          z-index: 1;
          margin: 8px 0 0;
          color: #4f737a;
          font-size: 7px;
        }

        .actionRow {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 9px;
        }

        .actionRow button {
          min-height: 34px;
          padding: 0 11px;
          border: 1px solid transparent;
          border-radius: 10px;
          font-size: 8px;
          font-weight: 950;
          cursor: pointer;
        }

        .editButton {
          border-color: #7ba4ab !important;
          background: #ffffff;
          color: #174c56;
        }

        .clearButton {
          background: #16834a;
          color: white;
        }

        .cancelButton {
          background: #fff0ee;
          color: #b3261e;
        }

        .reopenButton {
          background: #d4af37;
          color: #061d4a;
        }

        .deleteButton {
          margin-left: auto;
          background: #ffe9e7;
          color: #b3261e;
        }

        .emptyState {
          min-height: 330px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-top: 16px;
          padding: 30px;
          border: 1px dashed rgba(10, 46, 115, 0.2);
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.74);
          text-align: center;
        }

        .emptyState h2 {
          margin: 12px 0 5px;
          color: #0a2e73;
        }

        .emptyState p {
          max-width: 520px;
          margin: 0 0 16px;
          color: #687084;
          font-size: 11px;
          line-height: 1.65;
        }

        .emptyIcon {
          font-size: 42px;
        }

        .loader {
          width: 38px;
          height: 38px;
          border: 4px solid rgba(10, 46, 115, 0.15);
          border-top-color: #d4af37;
          border-radius: 50%;
          animation: chequeSpin 0.8s linear infinite;
        }

        .modalOverlay {
          position: fixed;
          z-index: 300;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 20px;
          overflow-y: auto;
          background: rgba(2, 11, 36, 0.72);
          backdrop-filter: blur(7px);
        }

        .chequeModal {
          width: min(760px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          padding: 22px;
          border: 1px solid rgba(212, 175, 55, 0.45);
          border-radius: 25px;
          background: #f8f4ec;
          box-shadow: 0 26px 70px rgba(2, 11, 36, 0.42);
        }

        .modalHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
        }

        .modalHeader span {
          color: #a47a05;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .modalHeader h2 {
          margin: 4px 0 0;
          color: #0a2e73;
          font-size: 22px;
        }

        .closeButton {
          width: 37px;
          height: 37px;
          border: 0;
          border-radius: 50%;
          background: #ffffff;
          color: #0a2e73;
          font-size: 23px;
          cursor: pointer;
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
          margin-top: 19px;
        }

        .formGrid label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          color: #0a2e73;
          font-size: 10px;
          font-weight: 850;
        }

        .formGrid input,
        .formGrid textarea {
          width: 100%;
          border: 1px solid rgba(10, 46, 115, 0.23);
          border-radius: 12px;
          outline: 0;
          background: white;
          color: #2c2c2c;
          font: inherit;
          font-size: 12px;
        }

        .formGrid input {
          min-height: 44px;
          padding: 0 12px;
        }

        .formGrid textarea {
          min-height: 90px;
          padding: 12px;
          resize: vertical;
        }

        .formGrid input:focus,
        .formGrid textarea:focus {
          border-color: #d4af37;
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.13);
        }

        .fullField {
          grid-column: 1 / -1;
        }

        .formError {
          margin-top: 13px;
        }

        .modalActions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 17px;
        }

        @keyframes chequeSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1000px) {
          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .chequeGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .chequePage {
            padding: 12px;
          }

          .chequeHero {
            align-items: stretch;
            flex-direction: column;
            padding: 20px;
            border-radius: 21px;
          }

          .chequeHero .primaryButton {
            width: 100%;
          }

          .summaryGrid {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .summaryCard {
            min-height: 111px;
            padding: 13px;
          }

          .summaryCard strong {
            font-size: 23px;
          }

          .chequeCard {
            padding: 7px;
          }

          .chequePaper {
            padding: 12px 11px 9px;
          }

          .bankLine {
            flex-wrap: wrap;
          }

          .dateBlock {
            width: 100%;
            text-align: left;
          }

          .dateBoxes b {
            width: 22px;
          }

          .wordsAndAmount {
            align-items: stretch;
            flex-direction: column;
          }

          .amountBox {
            min-width: 0;
          }

          .accountLine {
            flex-direction: column;
          }

          .signatureLine {
            width: 150px;
            margin-left: auto;
          }

          .status {
            right: 12px;
            bottom: 47px;
            margin-left: 0;
          }

          .micrLine {
            align-items: flex-start;
            flex-direction: column;
          }

          .formGrid {
            grid-template-columns: 1fr;
          }

          .fullField {
            grid-column: auto;
          }

          .modalActions {
            flex-direction: column-reverse;
          }

          .modalActions button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function chequeDateDigits(value: number) {
  const date = new Date(value);
  return `${String(date.getDate()).padStart(2, "0")}${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}${date.getFullYear()}`.split("");
}

function amountInWords(value: number) {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const belowThousand = (number: number) => {
    const parts: string[] = [];
    if (number >= 100) {
      parts.push(`${ones[Math.floor(number / 100)]} Hundred`);
      number %= 100;
    }
    if (number >= 20) {
      parts.push(tens[Math.floor(number / 10)]);
      number %= 10;
    }
    if (number > 0) parts.push(ones[number]);
    return parts.join(" ");
  };

  let number = Math.max(0, Math.floor(value));
  if (number === 0) return "Zero Rupees Only";

  const parts: string[] = [];
  const units = [
    [10_000_000, "Crore"],
    [100_000, "Lakh"],
    [1_000, "Thousand"],
  ] as const;

  units.forEach(([divider, name]) => {
    if (number >= divider) {
      parts.push(`${belowThousand(Math.floor(number / divider))} ${name}`);
      number %= divider;
    }
  });

  if (number > 0) parts.push(belowThousand(number));
  return `${parts.join(" ")} Rupees Only`;
}
