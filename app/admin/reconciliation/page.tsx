"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Period = "today" | "7days" | "30days" | "custom";

type ReconciliationIssue = {
  issue_type: string;
  source_table: string;
  source_id: string;
  entry_type: string;
  source_date?: string | null;
  reference_number?: string | null;
  party_name?: string | null;
  expected_amount: number;
  book_amount: number;
  difference: number;
  row_count: number;
  message: string;
};

type ReconciliationResult = {
  success: boolean;
  status: "balanced" | "attention_required";
  start_date: string;
  end_date: string;
  checked_at: string;
  summary: {
    issue_count: number;
    missing_count: number;
    mismatch_count: number;
    duplicate_count: number;
    account_balance_mismatch_count: number;
    source_net_total: number;
    cash_book_net_total: number;
    net_difference: number;
  };
  issues: ReconciliationIssue[];
};

const BLUE = "#0A2E73";
const DEEP = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";

function dateValue(date: Date) {
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return local.toISOString().slice(0, 10);
}

function money(value: unknown) {
  const number = Number(value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase(),
  );
}

export default function ReconciliationPage() {
  const today = new Date();

  const [period, setPeriod] = useState<Period>("today");
  const [customFrom, setCustomFrom] = useState(dateValue(today));
  const [customTo, setCustomTo] = useState(dateValue(today));
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [filter, setFilter] = useState("all");

  const range = useMemo(() => {
    const now = new Date();

    if (period === "today") {
      const value = dateValue(now);
      return { from: value, to: value, name: "Today" };
    }

    const from = new Date(now);

    if (period === "7days") {
      from.setDate(from.getDate() - 6);
      return {
        from: dateValue(from),
        to: dateValue(now),
        name: "Last 7 Days",
      };
    }

    if (period === "30days") {
      from.setDate(from.getDate() - 29);
      return {
        from: dateValue(from),
        to: dateValue(now),
        name: "Last 30 Days",
      };
    }

    return {
      from: customFrom,
      to: customTo,
      name: `${customFrom} to ${customTo}`,
    };
  }, [customFrom, customTo, period]);

  const runCheck = useCallback(
    async (manual = false) => {
      if (manual) setChecking(true);
      else setLoading(true);

      setErrorText("");

      try {
        const { data, error } = await supabase.rpc(
          "ncs_run_accounting_reconciliation",
          {
            p_start_date: range.from,
            p_end_date: range.to,
          },
        );

        if (error) throw error;
        setResult(data as ReconciliationResult);
      } catch (error) {
        console.error("Reconciliation check error:", error);
        setErrorText(
          error instanceof Error
            ? error.message
            : "Unable to run reconciliation check.",
        );
      } finally {
        setLoading(false);
        setChecking(false);
      }
    },
    [range.from, range.to],
  );

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const visibleIssues = useMemo(() => {
    const issues = result?.issues || [];

    if (filter === "all") return issues;
    return issues.filter((issue) => issue.issue_type === filter);
  }, [filter, result]);

  function exportCsv() {
    if (!result) return;

    const rows = [
      ["NEW CITY STYLE Accounting Reconciliation"],
      ["Period", range.name],
      ["Status", result.status],
      ["Checked At", result.checked_at],
      [],
      ["Summary", "Value"],
      ["Issues", result.summary.issue_count],
      ["Missing Entries", result.summary.missing_count],
      ["Amount / Balance Mismatches", result.summary.mismatch_count],
      ["Duplicate Entries", result.summary.duplicate_count],
      ["Source Net Total", result.summary.source_net_total],
      ["Cash Book Net Total", result.summary.cash_book_net_total],
      ["Net Difference", result.summary.net_difference],
      [],
      [
        "Issue",
        "Source",
        "Reference",
        "Party",
        "Expected",
        "Cash Book",
        "Difference",
        "Message",
      ],
      ...result.issues.map((issue) => [
        issue.issue_type,
        issue.source_table,
        issue.reference_number || issue.source_id,
        issue.party_name || "",
        issue.expected_amount,
        issue.book_amount,
        issue.difference,
        issue.message,
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
    anchor.download = `ncs-reconciliation-${range.from}-${range.to}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <main className="loadingPage">
        <div>NCS</div>
        <span />
        <h2>Checking Accounts...</h2>
        <p>Comparing every source transaction with Cash & Bank Book.</p>

        <style jsx>{`
          .loadingPage {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: ${IVORY};
            color: ${BLUE};
            font-family: Poppins, Inter, Arial, sans-serif;
          }

          .loadingPage > div {
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

          .loadingPage > span {
            width: 44px;
            height: 44px;
            margin-top: 22px;
            border: 4px solid #e1e5ec;
            border-top-color: ${GOLD};
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          .loadingPage h2 {
            margin: 17px 0 0;
          }

          .loadingPage p {
            margin: 7px 0 0;
            color: #707887;
            font-size: 11px;
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
    <main className="auditPage">
      <section className="hero">
        <div>
          <span>NEW CITY STYLE • FINANCIAL CONTROL</span>
          <h1>Accounting Reconciliation</h1>
          <p>
            Verifies POS sales, expenses, customer collections, supplier
            payments, purchases, refunds and Cash & Bank Book entries.
          </p>
        </div>

        <div className="heroActions">
          <button
            type="button"
            onClick={() => void runCheck(true)}
            disabled={checking}
          >
            {checking ? "Checking..." : "✓ Run Check"}
          </button>
          <button type="button" onClick={exportCsv}>
            ⇩ Export CSV
          </button>
          <button type="button" onClick={() => window.print()}>
            🖨 Print
          </button>
        </div>
      </section>

      {errorText && <div className="errorBox">{errorText}</div>}

      <section className="periodBar">
        <div>
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
          <div className="dateInputs">
            <input
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
            />
            <input
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
            />
          </div>
        )}

        <strong>{range.name}</strong>
      </section>

      {result && (
        <>
          <section
            className={
              result.status === "balanced"
                ? "statusBanner balanced"
                : "statusBanner attention"
            }
          >
            <div>
              {result.status === "balanced" ? "✓" : "!"}
            </div>
            <section>
              <span>
                {result.status === "balanced"
                  ? "ALL ACCOUNTS BALANCED"
                  : "ATTENTION REQUIRED"}
              </span>
              <h2>
                {result.status === "balanced"
                  ? "No reconciliation problems found"
                  : `${result.summary.issue_count} issue(s) found`}
              </h2>
              <p>
                Source net {money(result.summary.source_net_total)} • Cash
                Book net {money(result.summary.cash_book_net_total)}
              </p>
            </section>
            <strong>
              Difference {money(result.summary.net_difference)}
            </strong>
          </section>

          <section className="summaryGrid">
            <SummaryCard
              label="Total Issues"
              value={result.summary.issue_count}
              note="Needs review"
            />
            <SummaryCard
              label="Missing Entries"
              value={result.summary.missing_count}
              note="Not synced to Cash Book"
            />
            <SummaryCard
              label="Mismatches"
              value={result.summary.mismatch_count}
              note="Amount or balance difference"
            />
            <SummaryCard
              label="Duplicates"
              value={result.summary.duplicate_count}
              note="Repeated accounting entry"
            />
            <SummaryCard
              label="Source Net"
              value={money(result.summary.source_net_total)}
              note="Calculated from source modules"
            />
            <SummaryCard
              label="Cash Book Net"
              value={money(result.summary.cash_book_net_total)}
              note="Synced accounting entries"
            />
          </section>

          <section className="issuePanel">
            <header>
              <div>
                <span>AUDIT DETAILS</span>
                <h2>Reconciliation Issues</h2>
              </div>

              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="all">All Issues</option>
                <option value="missing">Missing</option>
                <option value="mismatch">Amount Mismatch</option>
                <option value="direction_mismatch">
                  Direction Mismatch
                </option>
                <option value="duplicate">Duplicates</option>
                <option value="account_balance_mismatch">
                  Account Balance
                </option>
              </select>
            </header>

            {visibleIssues.length === 0 ? (
              <div className="emptyState">
                <div>✓</div>
                <h3>No issues in this filter</h3>
                <p>The selected accounting records are balanced.</p>
              </div>
            ) : (
              <div className="issueTableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Issue</th>
                      <th>Source / Reference</th>
                      <th>Party</th>
                      <th>Expected</th>
                      <th>Cash Book</th>
                      <th>Difference</th>
                      <th>Explanation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleIssues.map((issue, index) => (
                      <tr
                        key={`${issue.source_table}-${issue.source_id}-${issue.entry_type}-${index}`}
                      >
                        <td>
                          <span
                            className={`issueBadge ${issue.issue_type}`}
                          >
                            {label(issue.issue_type)}
                          </span>
                        </td>
                        <td>
                          <strong>
                            {issue.reference_number || issue.source_id}
                          </strong>
                          <small>
                            {label(issue.source_table)} •{" "}
                            {issue.source_date || "Account balance"}
                          </small>
                        </td>
                        <td>{issue.party_name || "—"}</td>
                        <td>{money(issue.expected_amount)}</td>
                        <td>{money(issue.book_amount)}</td>
                        <td
                          className={
                            Math.abs(Number(issue.difference)) > 0.01
                              ? "difference"
                              : ""
                          }
                        >
                          {money(issue.difference)}
                        </td>
                        <td>{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .auditPage {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(
              circle at 8% 0%,
              rgba(212, 175, 55, 0.14),
              transparent 27%
            ),
            ${IVORY};
          color: #2c2c2c;
          font-family: Poppins, Inter, Arial, sans-serif;
        }

        .hero {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          padding: 26px;
          border: 1px solid rgba(212, 175, 55, 0.35);
          border-radius: 24px;
          background:
            radial-gradient(
              circle at 90% 0%,
              rgba(212, 175, 55, 0.26),
              transparent 32%
            ),
            linear-gradient(135deg, ${DEEP}, ${BLUE});
          color: #fff;
          box-shadow: 0 18px 45px rgba(3, 21, 63, 0.18);
        }

        .hero span,
        .issuePanel header span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1.2px;
        }

        .hero h1 {
          margin: 6px 0 5px;
          font-size: clamp(30px, 4vw, 43px);
        }

        .hero p {
          max-width: 720px;
          margin: 0;
          color: rgba(255, 255, 255, 0.69);
          font-size: 11px;
          line-height: 1.6;
        }

        .heroActions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .heroActions button {
          min-height: 42px;
          padding: 0 13px;
          border: 1px solid rgba(212, 175, 55, 0.65);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          font: inherit;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .heroActions button:first-child {
          background: ${GOLD};
          color: ${DEEP};
        }

        .errorBox {
          margin-top: 14px;
          padding: 13px 15px;
          border-radius: 12px;
          background: #ffe7e7;
          color: #a72828;
          font-size: 11px;
          font-weight: 800;
        }

        .periodBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 15px;
          padding: 12px;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 16px;
          background: #fff;
        }

        .periodBar > div {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .periodBar button {
          min-height: 36px;
          padding: 0 12px;
          border: 1px solid #dfe4ed;
          border-radius: 9px;
          background: #fff;
          color: ${BLUE};
          font: inherit;
          font-size: 8px;
          font-weight: 900;
          cursor: pointer;
        }

        .periodBar button.active {
          border-color: ${GOLD};
          background: ${BLUE};
          color: #fff;
        }

        .dateInputs input {
          height: 36px;
          padding: 0 8px;
          border: 1px solid #dfe4ed;
          border-radius: 9px;
          font: inherit;
          font-size: 8px;
        }

        .periodBar > strong {
          color: ${BLUE};
          font-size: 9px;
        }

        .statusBanner {
          min-height: 115px;
          display: grid;
          grid-template-columns: 54px minmax(0, 1fr) auto;
          align-items: center;
          gap: 15px;
          margin-top: 15px;
          padding: 19px;
          border-radius: 18px;
        }

        .statusBanner.balanced {
          border: 1px solid #abefc6;
          background: linear-gradient(135deg, #ecfdf3, #fff);
        }

        .statusBanner.attention {
          border: 1px solid #fedf89;
          background: linear-gradient(135deg, #fffaeb, #fff);
        }

        .statusBanner > div {
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          background: ${BLUE};
          color: ${GOLD};
          font-size: 24px;
          font-weight: 950;
        }

        .statusBanner span {
          color: ${BLUE};
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.8px;
        }

        .statusBanner h2 {
          margin: 4px 0 0;
          color: ${DEEP};
          font-size: 20px;
        }

        .statusBanner p {
          margin: 5px 0 0;
          color: #667085;
          font-size: 8px;
        }

        .statusBanner > strong {
          color: ${BLUE};
          font-size: 13px;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 9px;
          margin-top: 11px;
        }

        .issuePanel {
          margin-top: 15px;
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 12px 30px rgba(3, 21, 63, 0.07);
        }

        .issuePanel header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 17px;
          border-bottom: 1px solid #edf0f5;
        }

        .issuePanel header h2 {
          margin: 4px 0 0;
          color: ${DEEP};
          font-size: 18px;
        }

        .issuePanel select {
          min-height: 36px;
          padding: 0 10px;
          border: 1px solid #dfe4ed;
          border-radius: 9px;
          background: #fff;
          color: ${BLUE};
          font: inherit;
          font-size: 8px;
          font-weight: 850;
        }

        .issueTableWrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 12px;
          border-bottom: 1px solid #edf0f5;
          text-align: left;
          vertical-align: middle;
          white-space: nowrap;
        }

        th {
          background: #f8fafc;
          color: #667085;
          font-size: 7px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        td {
          color: #475467;
          font-size: 8px;
        }

        td strong,
        td small {
          display: block;
        }

        td strong {
          color: ${DEEP};
          font-size: 9px;
        }

        td small {
          margin-top: 3px;
          color: #98a2b3;
          font-size: 6.5px;
        }

        td.difference {
          color: #b42318;
          font-weight: 900;
        }

        .issueBadge {
          display: inline-flex;
          padding: 6px 8px;
          border-radius: 999px;
          background: #fffaeb;
          color: #b54708;
          font-size: 6.5px;
          font-weight: 900;
        }

        .issueBadge.missing {
          background: #fef3f2;
          color: #b42318;
        }

        .issueBadge.duplicate {
          background: #fff4ed;
          color: #c4320a;
        }

        .issueBadge.account_balance_mismatch {
          background: #eff8ff;
          color: #175cd3;
        }

        .emptyState {
          min-height: 280px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .emptyState > div {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          border-radius: 17px;
          background: #ecfdf3;
          color: #067647;
          font-size: 25px;
          font-weight: 950;
        }

        .emptyState h3 {
          margin: 13px 0 0;
          color: ${BLUE};
        }

        .emptyState p {
          margin: 6px 0 0;
          color: #667085;
          font-size: 9px;
        }

        @media (max-width: 1150px) {
          .summaryGrid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 760px) {
          .auditPage {
            padding: 12px;
          }

          .hero {
            align-items: flex-start;
            flex-direction: column;
          }

          .heroActions {
            width: 100%;
          }

          .heroActions button {
            flex: 1;
          }

          .periodBar,
          .statusBanner {
            align-items: flex-start;
            grid-template-columns: 1fr;
            flex-direction: column;
          }

          .summaryGrid {
            grid-template-columns: 1fr;
          }

          .dateInputs {
            width: 100%;
          }

          .dateInputs input {
            flex: 1;
            width: 100%;
          }
        }

        @media print {
          .heroActions,
          .periodBar,
          .issuePanel select,
          .errorBox {
            display: none !important;
          }

          .auditPage {
            padding: 0;
            background: #fff;
          }

          .hero,
          .issuePanel {
            box-shadow: none;
          }
        }
      `}</style>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number | string;
  note: string;
}) {
  return (
    <article className="summaryCard">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>

      <style jsx>{`
        .summaryCard {
          min-width: 0;
          min-height: 94px;
          padding: 13px;
          border: 1px solid rgba(212, 175, 55, 0.24);
          border-radius: 14px;
          background: linear-gradient(135deg, ${BLUE}, ${DEEP});
          color: #fff;
        }

        span,
        strong,
        small {
          display: block;
        }

        span {
          color: ${GOLD};
          font-size: 7px;
          font-weight: 950;
          text-transform: uppercase;
        }

        strong {
          margin-top: 6px;
          overflow: hidden;
          font-size: 17px;
          font-weight: 950;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        small {
          margin-top: 5px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 6.5px;
        }
      `}</style>
    </article>
  );
}