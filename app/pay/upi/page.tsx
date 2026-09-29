"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";

const UPI_ID = "9010014001@pzw";
const UPI_NAME = "NEW CITY STYLE";

function safeAmount(value: string | null) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) return 0;
  return Math.round(amount * 100) / 100;
}

function buildUpiUri(amount: number, reference: string) {
  const params = new URLSearchParams();
  params.set("pa", UPI_ID);
  params.set("pn", UPI_NAME);
  if (amount > 0) params.set("am", amount.toFixed(2));
  params.set("cu", "INR");

  if (reference) {
    params.set("tn", `NEW CITY STYLE ${reference}`);
    params.set("tr", reference);
  }

  return `upi://pay?${params.toString()}`;
}

export default function UpiPayPage() {
  const [amount, setAmount] = useState(0);
  const [reference, setReference] = useState("");
  const [ready, setReady] = useState(false);

  const [utr, setUtr] = useState("");
  const [proofBusy, setProofBusy] = useState(false);
  const [proofMessage, setProofMessage] = useState("");
  const [proofError, setProofError] = useState("");

  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const [razorpayError, setRazorpayError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAmount(safeAmount(params.get("amount")));
    setReference(String(params.get("ref") || "").trim().slice(0, 120));
    setReady(true);
  }, []);

  const upiUri = useMemo(
    () => buildUpiUri(amount, reference),
    [amount, reference],
  );

  const qrUrl = useMemo(
    () =>
      "https://quickchart.io/qr" +
      "?size=760&margin=2&ecLevel=M" +
      `&text=${encodeURIComponent(upiUri)}`,
    [upiUri],
  );

  async function downloadQr() {
    try {
      const response = await fetch(qrUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("QR download failed.");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = reference
        ? `NCS-UPI-${reference.replace(/[^a-zA-Z0-9_-]+/g, "-")}.png`
        : "NCS-UPI-Payment-QR.png";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      window.open(qrUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function submitUtr() {
    if (proofBusy) return;

    const cleaned = utr.trim().replace(/\s+/g, "");

    if (!reference) {
      setProofError("Payment reference missing. Please ask NEW CITY STYLE for a new link.");
      return;
    }

    if (!/^[A-Za-z0-9]{8,40}$/.test(cleaned)) {
      setProofError("Valid UTR / transaction reference enter చేయండి.");
      return;
    }

    setProofBusy(true);
    setProofError("");
    setProofMessage("");

    try {
      const response = await fetch("/api/whatsapp/payment-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          reference,
          utr: cleaned,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.success !== true) {
        throw new Error(data.error || "Payment reference submit కాలేదు.");
      }

      setProofMessage(
        data.message ||
          "Payment reference received. We will verify it shortly.",
      );
    } catch (error) {
      setProofError(
        error instanceof Error ? error.message : "Payment reference submit కాలేదు.",
      );
    } finally {
      setProofBusy(false);
    }
  }

  async function payWithRazorpay() {
    if (amount <= 0 || razorpayLoading) return;

    setRazorpayLoading(true);
    setRazorpayError("");

    try {
      const response = await fetch("/api/razorpay/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          customerName: "NEW CITY STYLE Customer",
          customerPhone: "",
          orderReference: reference,
          description: `NEW CITY STYLE payment${reference ? ` • ${reference}` : ""}`,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.success !== true || !data.shortUrl) {
        throw new Error(data.error || "Razorpay payment link create కాలేదు.");
      }

      window.location.href = data.shortUrl;
    } catch (error) {
      setRazorpayError(
        error instanceof Error ? error.message : "Razorpay payment open కాలేదు.",
      );
      setRazorpayLoading(false);
    }
  }

  if (!ready) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.brand}>NEW CITY STYLE</div>
          <div style={styles.loading}>Opening payment...</div>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.brand}>NEW CITY STYLE</div>
        <div style={styles.secureBadge}>DIRECT UPI • BANK PAYMENT</div>

        <h1 style={styles.title}>Scan & Pay</h1>

        {amount > 0 ? (
          <div style={styles.amount}>
            ₹{amount.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        ) : (
          <div style={styles.amountMissing}>Amount not available</div>
        )}

        {reference && (
          <p style={styles.reference}>
            Bill / Reference: <strong>{reference}</strong>
          </p>
        )}

        <div style={styles.qrFrame}>
          <img
            src={qrUrl}
            alt="NEW CITY STYLE dynamic UPI payment QR"
            style={styles.qr}
          />
          {amount > 0 && (
            <div style={styles.amountBadge}>
              ₹{amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })} FIXED IN QR
            </div>
          )}
        </div>

        <div style={styles.upiBox}>
          <span style={styles.upiLabel}>PAY TO UPI ID</span>
          <strong style={styles.upiValue}>{UPI_ID}</strong>
        </div>

        <button type="button" onClick={() => void downloadQr()} style={styles.downloadButton}>
          DOWNLOAD / SAVE QR
        </button>

        <div style={styles.samePhoneBox}>
          <strong style={styles.samePhoneTitle}>Same phoneలో pay చేస్తున్నారా?</strong>
          <span style={styles.samePhoneText}>
            QR save చేసి PhonePe / Google Pay / Paytmలో Scan QR → Gallery/Photos
            నుంచి select చేయండి. Amount QRలో ముందే ఉంటుంది.
          </span>
        </div>

        <div style={styles.proofBox}>
          <span style={styles.proofEyebrow}>PAID ALREADY?</span>
          <strong style={styles.proofTitle}>Submit UTR / Transaction Reference</strong>
          <p style={styles.proofText}>
            Payment complete అయిన తర్వాత UTR enter చేయండి. Store admin verify చేసిన
            తర్వాత payment PAIDగా mark అవుతుంది.
          </p>

          <div style={styles.proofRow}>
            <input
              value={utr}
              onChange={(e) =>
                setUtr(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40))
              }
              placeholder="UTR / Transaction ID"
              inputMode="text"
              style={styles.proofInput}
            />
            <button
              type="button"
              onClick={() => void submitUtr()}
              disabled={proofBusy || !utr.trim()}
              style={{
                ...styles.proofButton,
                opacity: proofBusy || !utr.trim() ? 0.55 : 1,
              }}
            >
              {proofBusy ? "SUBMITTING..." : "I HAVE PAID"}
            </button>
          </div>

          {proofMessage && <div style={styles.successBox}>{proofMessage}</div>}
          {proofError && <div style={styles.errorBox}>{proofError}</div>}
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>BACKUP</span>
          <span style={styles.dividerLine} />
        </div>

        <button
          type="button"
          onClick={() => void payWithRazorpay()}
          disabled={amount <= 0 || razorpayLoading}
          style={{
            ...styles.razorpayButton,
            opacity: amount <= 0 || razorpayLoading ? 0.6 : 1,
          }}
        >
          {razorpayLoading ? "OPENING RAZORPAY..." : "PAY WITH RAZORPAY INSTEAD"}
        </button>

        <p style={styles.razorpayHint}>
          Direct UPI QR convenient కాకపోతే మాత్రమే Razorpay backupగా use చేయండి.
        </p>

        {razorpayError && <div style={styles.errorBox}>{razorpayError}</div>}

        <div style={styles.footer}>
          <strong>NEW CITY STYLE READY MADE</strong>
          <span>Secure payment request</span>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background: "#f8f4ec",
    color: "#14213d",
    fontFamily: "Inter, Poppins, Arial, sans-serif",
  },
  card: {
    width: "min(470px, 100%)",
    padding: 25,
    border: "1px solid #e4e7ec",
    borderRadius: 26,
    background: "#ffffff",
    boxShadow: "0 22px 70px rgba(10,46,115,.14)",
    textAlign: "center",
  },
  brand: {
    color: "#0a2e73",
    fontSize: 15,
    fontWeight: 950,
    letterSpacing: 1.3,
  },
  secureBadge: {
    display: "inline-block",
    marginTop: 9,
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ecfdf3",
    color: "#067647",
    fontSize: 9,
    fontWeight: 950,
    letterSpacing: 0.7,
  },
  title: { margin: "14px 0 5px", fontSize: 29, color: "#17233c" },
  amount: {
    color: "#0a2e73",
    fontSize: 38,
    fontWeight: 950,
    lineHeight: 1.1,
  },
  amountMissing: {
    marginTop: 9,
    color: "#b54708",
    fontSize: 17,
    fontWeight: 900,
  },
  reference: { margin: "9px 0 0", color: "#667085", fontSize: 12 },
  qrFrame: {
    position: "relative",
    width: "min(340px, 86vw)",
    margin: "18px auto 0",
    padding: 10,
    border: "1px solid #e4e7ec",
    borderRadius: 22,
    background: "#ffffff",
  },
  qr: {
    width: "100%",
    aspectRatio: "1 / 1",
    objectFit: "contain",
    display: "block",
  },
  amountBadge: {
    position: "absolute",
    left: "50%",
    bottom: 15,
    transform: "translateX(-50%)",
    padding: "7px 12px",
    borderRadius: 999,
    background: "#0a2e73",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  upiBox: { marginTop: 14, padding: 13, borderRadius: 14, background: "#eef6ff" },
  upiLabel: { display: "block", color: "#667085", fontSize: 10, fontWeight: 850 },
  upiValue: { display: "block", marginTop: 4, color: "#0a2e73", fontSize: 19 },
  downloadButton: {
    width: "100%",
    minHeight: 48,
    marginTop: 12,
    border: "1px solid #0a2e73",
    borderRadius: 14,
    background: "#ffffff",
    color: "#0a2e73",
    fontSize: 12,
    fontWeight: 950,
    cursor: "pointer",
  },
  samePhoneBox: {
    marginTop: 11,
    padding: 13,
    borderRadius: 14,
    background: "#f9fafb",
    textAlign: "left",
  },
  samePhoneTitle: { display: "block", color: "#344054", fontSize: 12 },
  samePhoneText: {
    display: "block",
    marginTop: 5,
    color: "#667085",
    fontSize: 11,
    lineHeight: 1.55,
  },
  proofBox: {
    marginTop: 13,
    padding: 14,
    border: "1px solid #d6e4ff",
    borderRadius: 16,
    background: "#f7faff",
    textAlign: "left",
  },
  proofEyebrow: {
    color: "#0a2e73",
    fontSize: 9,
    fontWeight: 950,
    letterSpacing: 0.8,
  },
  proofTitle: {
    display: "block",
    marginTop: 4,
    color: "#17233c",
    fontSize: 14,
  },
  proofText: {
    margin: "5px 0 10px",
    color: "#667085",
    fontSize: 10,
    lineHeight: 1.5,
  },
  proofRow: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 8,
  },
  proofInput: {
    minHeight: 46,
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "0 12px",
    fontSize: 13,
  },
  proofButton: {
    minHeight: 46,
    border: 0,
    borderRadius: 12,
    background: "#067647",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 950,
    cursor: "pointer",
  },
  successBox: {
    marginTop: 9,
    padding: 10,
    borderRadius: 10,
    background: "#ecfdf3",
    color: "#067647",
    fontSize: 10,
    fontWeight: 800,
  },
  errorBox: {
    marginTop: 9,
    padding: 10,
    borderRadius: 10,
    background: "#fef3f2",
    color: "#b42318",
    fontSize: 10,
    fontWeight: 800,
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    margin: "17px 0 12px",
  },
  dividerLine: { height: 1, flex: 1, background: "#e4e7ec" },
  dividerText: { color: "#98a2b3", fontSize: 9, fontWeight: 900 },
  razorpayButton: {
    width: "100%",
    minHeight: 51,
    border: 0,
    borderRadius: 14,
    background: "#0a2e73",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 950,
    cursor: "pointer",
  },
  razorpayHint: {
    margin: "8px 0 0",
    color: "#98a2b3",
    fontSize: 10,
    lineHeight: 1.5,
  },
  footer: {
    display: "grid",
    gap: 3,
    marginTop: 18,
    paddingTop: 14,
    borderTop: "1px solid #eaecf0",
    color: "#667085",
    fontSize: 10,
  },
  loading: { marginTop: 20, color: "#667085", fontSize: 13 },
};
