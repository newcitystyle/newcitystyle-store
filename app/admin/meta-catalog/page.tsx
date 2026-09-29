"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type StatusPayload = {
  ok?: boolean;
  stage?: string;
  feedUrl?: string;
  catalog?: Record<string, number>;
  configuration?: Record<string, unknown>;
  latestLogs?: Array<Record<string, unknown>>;
  error?: string;
};

export default function MetaCatalogAdminPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"" | "dry" | "push">("");
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("ncs_meta_sync_secret") || "";
    setSecret(saved);
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/meta/catalog/status", { cache: "no-store" });
      const json = (await response.json()) as StatusPayload;
      setStatus(json);
      if (!response.ok) setError(json.error || "Unable to load status.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load status.");
    } finally {
      setLoading(false);
    }
  }

  async function run(mode: "dry_run" | "push") {
    setBusy(mode === "dry_run" ? "dry" : "push");
    setError("");
    setResult(null);
    window.localStorage.setItem("ncs_meta_sync_secret", secret);
    try {
      const response = await fetch("/api/meta/catalog/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-meta-sync-secret": secret,
        },
        body: JSON.stringify({ mode }),
      });
      const json = await response.json();
      setResult(json);
      if (!response.ok) setError(json?.error || "Sync failed.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setBusy("");
    }
  }

  const cards = useMemo(() => {
    const c = status?.catalog || {};
    return [
      ["Generated Items", c.generatedItems ?? 0],
      ["In Stock", c.inStockItems ?? 0],
      ["Out of Stock", c.outOfStockItems ?? 0],
      ["Variants", c.variantsRead ?? 0],
      ["Skipped", c.skippedItems ?? 0],
      ["Tracked", c.trackedStateItems ?? 0],
    ];
  }, [status]);

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>NEW CITY STYLE • META COMMERCE</div>
            <h1 style={styles.title}>Catalog Master Sync</h1>
            <p style={styles.sub}>
              Supabase products and variants are the master source. Meta Catalog becomes a synced mirror.
            </p>
          </div>
          <button style={styles.secondary} onClick={() => void refresh()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {error ? <div style={styles.error}>⚠ {error}</div> : null}

        <section style={styles.grid}>
          {cards.map(([label, value]) => (
            <article key={String(label)} style={styles.card}>
              <span style={styles.cardLabel}>{label}</span>
              <strong style={styles.cardValue}>{String(value)}</strong>
            </article>
          ))}
        </section>

        <section style={styles.panel}>
          <div style={styles.rowBetween}>
            <div>
              <h2 style={styles.h2}>Live Meta Feed</h2>
              <p style={styles.muted}>Use this URL as the scheduled data feed inside Meta Commerce Manager.</p>
            </div>
            <span style={styles.badge}>MASTER FEED</span>
          </div>
          <div style={styles.code}>{status?.feedUrl || "Loading…"}</div>
          <div style={styles.actions}>
            <a style={styles.linkButton} href={status?.feedUrl || "#"} target="_blank" rel="noreferrer">
              Open CSV Feed
            </a>
            <a
              style={styles.linkButton}
              href={(status?.feedUrl || "").includes("?") ? `${status?.feedUrl}&format=json` : `${status?.feedUrl}?format=json`}
              target="_blank"
              rel="noreferrer"
            >
              Preview JSON
            </a>
          </div>
        </section>

        <section style={styles.panel}>
          <h2 style={styles.h2}>Direct Graph Sync</h2>
          <p style={styles.muted}>
            First use Dry Run. Enable Push only after the scheduled feed is verified in Meta Commerce Manager.
          </p>
          <input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="META_CATALOG_SYNC_SECRET"
            type="password"
            style={styles.input}
          />
          <div style={styles.actions}>
            <button style={styles.secondary} onClick={() => void run("dry_run")} disabled={Boolean(busy)}>
              {busy === "dry" ? "Checking…" : "Dry Run"}
            </button>
            <button style={styles.primary} onClick={() => void run("push")} disabled={Boolean(busy)}>
              {busy === "push" ? "Submitting…" : "Push Changes"}
            </button>
          </div>
          {result ? <pre style={styles.pre}>{JSON.stringify(result, null, 2)}</pre> : null}
        </section>

        <section style={styles.panel}>
          <h2 style={styles.h2}>Configuration</h2>
          <div style={styles.configGrid}>
            {Object.entries(status?.configuration || {}).map(([key, value]) => (
              <div key={key} style={styles.configRow}>
                <span>{key}</span>
                <strong>{String(value)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.panel}>
          <h2 style={styles.h2}>Recent Sync Activity</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Time</th>
                  <th style={styles.th}>Mode</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Items</th>
                  <th style={styles.th}>Changed</th>
                  <th style={styles.th}>Deleted</th>
                  <th style={styles.th}>Error</th>
                </tr>
              </thead>
              <tbody>
                {(status?.latestLogs || []).map((row, index) => (
                  <tr key={String(row.id ?? index)}>
                    <td style={styles.td}>{String(row.created_at ?? "")}</td>
                    <td style={styles.td}>{String(row.mode ?? "")}</td>
                    <td style={styles.td}>{String(row.status ?? "")}</td>
                    <td style={styles.td}>{String(row.total_items ?? 0)}</td>
                    <td style={styles.td}>{String(row.changed_items ?? 0)}</td>
                    <td style={styles.td}>{String(row.deleted_items ?? 0)}</td>
                    <td style={styles.td}>{String(row.error_message ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#06101f", color: "#eef5ff", padding: "32px 18px 60px", fontFamily: "Arial, sans-serif" },
  shell: { maxWidth: 1180, margin: "0 auto" },
  hero: { display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", marginBottom: 24 },
  eyebrow: { fontSize: 12, letterSpacing: 1.4, color: "#d8b85c", fontWeight: 800 },
  title: { fontSize: 34, margin: "8px 0 6px" },
  sub: { margin: 0, color: "#9fb2cb", maxWidth: 720, lineHeight: 1.6 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 },
  card: { background: "#0c1a2d", border: "1px solid #1c3451", borderRadius: 18, padding: 18 },
  cardLabel: { display: "block", color: "#91a6bf", fontSize: 12, marginBottom: 9 },
  cardValue: { fontSize: 26 },
  panel: { background: "#0b1728", border: "1px solid #1c3451", borderRadius: 20, padding: 20, marginTop: 16 },
  h2: { margin: "0 0 8px", fontSize: 19 },
  muted: { color: "#91a6bf", lineHeight: 1.5 },
  rowBetween: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  badge: { fontSize: 11, background: "#15344e", border: "1px solid #2a5878", borderRadius: 99, padding: "7px 10px", color: "#8fe5ff" },
  code: { background: "#050b13", borderRadius: 12, padding: 13, wordBreak: "break-all", color: "#8fe5ff", marginTop: 14, fontFamily: "monospace" },
  actions: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 },
  primary: { border: 0, borderRadius: 12, padding: "11px 16px", background: "#d8b85c", color: "#06101f", fontWeight: 800, cursor: "pointer" },
  secondary: { border: "1px solid #35516c", borderRadius: 12, padding: "11px 16px", background: "#10243a", color: "#eaf4ff", fontWeight: 700, cursor: "pointer" },
  linkButton: { display: "inline-block", border: "1px solid #35516c", borderRadius: 12, padding: "11px 16px", background: "#10243a", color: "#eaf4ff", fontWeight: 700, textDecoration: "none" },
  input: { width: "100%", boxSizing: "border-box", marginTop: 12, borderRadius: 12, border: "1px solid #35516c", background: "#050b13", color: "#fff", padding: "12px 14px" },
  error: { background: "#381619", border: "1px solid #7d3138", color: "#ffc6ca", padding: 13, borderRadius: 12, marginBottom: 16 },
  pre: { marginTop: 16, maxHeight: 420, overflow: "auto", background: "#050b13", padding: 14, borderRadius: 12, color: "#bfeaff", fontSize: 12 },
  configGrid: { display: "grid", gap: 8, marginTop: 14 },
  configRow: { display: "flex", justifyContent: "space-between", gap: 20, padding: "9px 0", borderBottom: "1px solid #16283d", color: "#c7d4e3" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 850, marginTop: 12 },
  th: { textAlign: "left", color: "#8fa7c0", fontSize: 12, padding: "10px 8px", borderBottom: "1px solid #29415c" },
  td: { padding: "11px 8px", borderBottom: "1px solid #14263a", fontSize: 12, verticalAlign: "top" },
};
