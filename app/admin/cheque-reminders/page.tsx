"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
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

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
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

  const difference = Math.round(
    (cheque.due_date - startOfToday()) / DAY_MS
  );

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
  const [editingCheque, setEditingCheque] =
    useState<ChequeRow | null>(null);
  const [form, setForm] = useState<ChequeFormState>(
    emptyForm()
  );
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
        () => void loadCheques()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const summary = useMemo(() => {
    const upcoming = cheques.filter(
      (item) => item.status === "UPCOMING"
    );
    const dueSoon = upcoming.filter((item) => {
      const difference = Math.round(
        (item.due_date - startOfToday()) / DAY_MS
      );

      return difference >= 0 && difference <= 2;
    });
    const overdue = upcoming.filter(
      (item) => item.due_date < startOfToday()
    );

    return {
      upcomingCount: upcoming.length,
      upcomingAmount: upcoming.reduce(
        (total, item) => total + Number(item.amount || 0),
        0
      ),
      dueSoonCount: dueSoon.length,
      dueSoonAmount: dueSoon.reduce(
        (total, item) => total + Number(item.amount || 0),
        0
      ),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce(
        (total, item) => total + Number(item.amount || 0),
        0
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
          cheque.status === "UPCOMING" &&
          status.days >= 0 &&
          status.days <= 2
        );
      }
      if (filter === "OVERDUE") {
        return (
          cheque.status === "UPCOMING" &&
          status.days < 0
        );
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
      setErrorMessage(
        "Cheque due date cannot be before the given date."
      );
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

  async function updateStatus(
    cheque: ChequeRow,
    status: ChequeStatus
  ) {
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
      `Delete cheque ${cheque.cheque_number} for ${cheque.supplier_name}?`
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
            App and website cheque records stay synchronized through
            Supabase. The top alert appears only from two days before
            the due date.
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
              onClick={() =>
                setFilter(
                  value as typeof filter
                )
              }
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
            Add the first cheque here or add it in the Android Billing
            app. It will appear on both sides after sync.
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
                <div className="cardTop">
                  <div className="rupeeBadge">₹</div>

                  <div className="supplierBlock">
                    <h2>{cheque.supplier_name}</h2>
                    <p>
                      {cheque.bank_name} • {cheque.cheque_number}
                    </p>
                  </div>

                  <span className={`status status-${display.tone}`}>
                    {display.label}
                  </span>
                </div>

                <div className="amountRow">
                  <div>
                    <span>CHEQUE AMOUNT</span>
                    <strong>{formatMoney(cheque.amount)}</strong>
                  </div>

                  <div className="dateColumn">
                    <span>DUE DATE</span>
                    <strong>{formatDate(cheque.due_date)}</strong>
                  </div>
                </div>

                <div className="metaRow">
                  <span>
                    GIVEN: {formatDate(cheque.given_date)}
                  </span>
                  <span>
                    SYNC:{" "}
                    {new Date(cheque.updated_at).toLocaleString(
                      "en-IN"
                    )}
                  </span>
                </div>

                {cheque.notes ? (
                  <p className="notes">{cheque.notes}</p>
                ) : null}

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
                        onClick={() =>
                          void updateStatus(cheque, "CLEARED")
                        }
                      >
                        CLEARED
                      </button>

                      <button
                        className="cancelButton"
                        onClick={() =>
                          void updateStatus(cheque, "CANCELLED")
                        }
                      >
                        CANCEL
                      </button>
                    </>
                  ) : (
                    <button
                      className="reopenButton"
                      onClick={() =>
                        void updateStatus(cheque, "UPCOMING")
                      }
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
                <span>
                  {editingCheque ? "UPDATE RECORD" : "NEW RECORD"}
                </span>
                <h2>
                  {editingCheque
                    ? "EDIT BANK CHEQUE"
                    : "ADD BANK CHEQUE"}
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

              <button
                type="submit"
                className="primaryButton"
                disabled={saving}
              >
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
          padding: 17px;
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.25);
          border-radius: 23px;
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(212, 175, 55, 0.17),
              transparent 31%
            ),
            linear-gradient(145deg, #020b24, #061d4a, #0a2e73);
          box-shadow: 0 13px 29px rgba(3, 21, 63, 0.16);
          color: white;
        }

        .cardTop {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .rupeeBadge {
          width: 45px;
          height: 45px;
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          border-radius: 50%;
          background: #d4af37;
          color: #061d4a;
          font-size: 21px;
          font-weight: 950;
        }

        .supplierBlock {
          min-width: 0;
          flex: 1;
        }

        .supplierBlock h2 {
          overflow: hidden;
          margin: 0;
          color: white;
          font-size: 15px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .supplierBlock p {
          overflow: hidden;
          margin: 4px 0 0;
          color: rgba(255, 255, 255, 0.65);
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .status {
          flex: 0 0 auto;
          padding: 6px 9px;
          border: 1px solid currentColor;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.4px;
        }

        .status-upcoming,
        .status-soon {
          color: #f0cc59;
          background: rgba(212, 175, 55, 0.12);
        }

        .status-today,
        .status-overdue {
          color: #ff7770;
          background: rgba(255, 69, 58, 0.12);
        }

        .status-cleared {
          color: #69e5a1;
          background: rgba(22, 131, 74, 0.13);
        }

        .status-cancelled {
          color: #c4c8d2;
          background: rgba(255, 255, 255, 0.08);
        }

        .amountRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 20px;
        }

        .amountRow span {
          color: rgba(255, 255, 255, 0.48);
          font-size: 8px;
          font-weight: 800;
        }

        .amountRow strong {
          display: block;
          margin-top: 5px;
          color: #d4af37;
          font-size: 21px;
        }

        .dateColumn {
          text-align: right;
        }

        .dateColumn strong {
          color: white;
          font-size: 13px;
        }

        .metaRow {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 8px;
          margin-top: 14px;
          padding-top: 11px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.48);
          font-size: 8px;
          font-weight: 750;
        }

        .notes {
          margin: 10px 0 0;
          padding: 9px 11px;
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.07);
          color: rgba(255, 255, 255, 0.72);
          font-size: 9px;
          line-height: 1.55;
        }

        .actionRow {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 13px;
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
          border-color: rgba(255, 255, 255, 0.24) !important;
          background: rgba(255, 255, 255, 0.08);
          color: white;
        }

        .clearButton {
          background: #16834a;
          color: white;
        }

        .cancelButton {
          background: rgba(255, 255, 255, 0.09);
          color: #ff7770;
        }

        .reopenButton {
          background: #d4af37;
          color: #061d4a;
        }

        .deleteButton {
          margin-left: auto;
          background: rgba(179, 38, 30, 0.16);
          color: #ff7770;
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
            padding: 14px;
          }

          .cardTop {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .status {
            margin-left: 56px;
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