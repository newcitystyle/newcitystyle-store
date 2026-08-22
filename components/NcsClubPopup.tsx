"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type JoinResult = {
  success?: boolean;
  already_member?: boolean;
  member_id?: number;
  name?: string;
  phone?: string;
  voucher_code?: string;
  voucher_amount?: number;
  minimum_order_amount?: number;
  payment_method_required?: string;
  voucher_expires_at?: string;
  voucher_status?: string;
  message?: string;
};

const POPUP_SEEN_KEY = "ncs-club-popup-seen-v1";
const MEMBER_KEY = "ncs-club-member-v1";

export default function NcsClubPopup() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<JoinResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const pathname = window.location.pathname;
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/payment") ||
      pathname.startsWith("/checkout") ||
      pathname.startsWith("/order-success")
    ) {
      return;
    }

    const existingMember = localStorage.getItem(MEMBER_KEY);
    if (existingMember) return;

    const lastSeenRaw = localStorage.getItem(POPUP_SEEN_KEY);
    const lastSeen = Number(lastSeenRaw || 0);
    const twelveHours = 12 * 60 * 60 * 1000;

    if (lastSeen && Date.now() - lastSeen < twelveHours) return;

    const timer = window.setTimeout(() => setOpen(true), 2800);
    return () => window.clearTimeout(timer);
  }, []);

  const expiryLabel = useMemo(() => {
    if (!result?.voucher_expires_at) return "";
    const date = new Date(result.voucher_expires_at);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [result?.voucher_expires_at]);

  function closePopup() {
    localStorage.setItem(POPUP_SEEN_KEY, String(Date.now()));
    setOpen(false);
  }

  async function joinClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const cleanName = name.trim();
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);

    if (cleanName.length < 2) {
      alert("Please enter your name.");
      return;
    }

    if (cleanPhone.length !== 10) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase.rpc("ncs_join_club_v1", {
        p_name: cleanName,
        p_phone: cleanPhone,
      });

      if (error) throw error;

      const payload = (data || {}) as JoinResult;
      if (payload.success !== true) {
        throw new Error(payload.message || "Unable to join NEW CITY STYLE Club.");
      }

      setResult(payload);

      localStorage.setItem(
        MEMBER_KEY,
        JSON.stringify({
          memberId: payload.member_id || null,
          name: payload.name || cleanName,
          phone: payload.phone || cleanPhone,
          voucherCode: payload.voucher_code || "",
          voucherAmount: Number(payload.voucher_amount || 0),
          voucherExpiresAt: payload.voucher_expires_at || "",
        }),
      );

      // Best-effort WhatsApp send. Club signup must still succeed even if Meta is unavailable.
      if (payload.voucher_code && Number(payload.voucher_amount || 0) > 0) {
        void fetch("/api/whatsapp/club-welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: cleanPhone,
            customerName: payload.name || cleanName,
            voucherCode: payload.voucher_code,
            voucherAmount: Number(payload.voucher_amount || 100),
            minimumOrderAmount: Number(payload.minimum_order_amount || 1000),
            expiresAt: payload.voucher_expires_at || "",
          }),
        }).catch((error) => {
          console.info("Club welcome WhatsApp could not be sent:", error);
        });
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to join NEW CITY STYLE Club.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyCode() {
    if (!result?.voucher_code) return;

    try {
      await navigator.clipboard.writeText(result.voucher_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      alert(`Your voucher code is ${result.voucher_code}`);
    }
  }

  if (!open) return null;

  return (
    <div className="ncsClubBackdrop" role="dialog" aria-modal="true">
      <section className="ncsClubCard">
        <button
          type="button"
          className="ncsClubClose"
          onClick={closePopup}
          aria-label="Close NEW CITY STYLE Club popup"
        >
          ×
        </button>

        <div className="ncsClubCrown">NCS</div>
        <span className="ncsClubEyebrow">NEW CITY STYLE CLUB</span>

        {!result ? (
          <>
            <h2>Unlock Your ₹100 Welcome Voucher</h2>
            <p className="ncsClubLead">
              Join free. On your first UPI order of ₹1,000 or more, use your
              personal Club code and save ₹100 instantly.
            </p>

            <div className="ncsClubBenefits">
              <span>✓ Free membership</span>
              <span>✓ Personal voucher code</span>
              <span>✓ WhatsApp Club card</span>
            </div>

            <form onSubmit={joinClub}>
              <label>
                Your Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                  autoComplete="name"
                />
              </label>

              <label>
                WhatsApp Mobile
                <div className="ncsClubPhone">
                  <span>+91</span>
                  <input
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit number"
                    autoComplete="tel"
                  />
                </div>
              </label>

              <button type="submit" className="ncsClubJoin" disabled={saving}>
                {saving ? "Creating Your Club Card..." : "JOIN FREE & GET ₹100"}
              </button>
            </form>

            <small className="ncsClubTerms">
              One welcome voucher per mobile number • Valid for 7 days •
              Minimum order ₹1,000 • UPI payment only • Cannot be combined with
              another monetary coupon.
            </small>
          </>
        ) : (
          <div className="ncsClubSuccess">
            <div className="ncsClubTick">✓</div>
            <h2>Welcome to the Club, {result.name || name}!</h2>
            <p>{result.message || "Your NEW CITY STYLE Club membership is active."}</p>

            {result.voucher_code && Number(result.voucher_amount || 0) > 0 ? (
              <>
                <div className="ncsClubVoucher">
                  <small>YOUR ₹100 WELCOME CODE</small>
                  <strong>{result.voucher_code}</strong>
                  <button type="button" onClick={copyCode}>
                    {copied ? "Copied ✓" : "Copy Code"}
                  </button>
                </div>

                <p className="ncsClubUse">
                  Use on UPI payment when your order is ₹1,000+.{" "}
                  {expiryLabel ? `Valid until ${expiryLabel}.` : ""}
                </p>
                <p className="ncsClubWhatsApp">
                  We’ll also try to send this Club card to your WhatsApp.
                </p>
              </>
            ) : (
              <p className="ncsClubUse">
                Your membership is already registered with this mobile number.
              </p>
            )}

            <button type="button" className="ncsClubDone" onClick={closePopup}>
              Continue Shopping
            </button>
          </div>
        )}
      </section>

      <style jsx>{`
        .ncsClubBackdrop {
          position: fixed;
          inset: 0;
          z-index: 2147483000;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(3, 21, 63, 0.58);
          backdrop-filter: blur(7px);
        }

        .ncsClubCard {
          position: relative;
          width: min(430px, 100%);
          max-height: calc(100vh - 30px);
          overflow: auto;
          padding: 31px 26px 25px;
          border: 1px solid rgba(212, 175, 55, 0.72);
          border-radius: 26px;
          background:
            radial-gradient(circle at 90% 0%, rgba(212,175,55,.20), transparent 28%),
            linear-gradient(160deg, #ffffff 0%, #fffaf0 55%, #f8f4ec 100%);
          box-shadow: 0 30px 90px rgba(3, 21, 63, 0.34);
          color: #2c2c2c;
          text-align: center;
        }

        .ncsClubClose {
          position: absolute;
          top: 12px;
          right: 13px;
          width: 34px;
          height: 34px;
          border: 1px solid #e6dcc4;
          border-radius: 50%;
          background: rgba(255,255,255,.9);
          color: #0a2e73;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
        }

        .ncsClubCrown {
          width: 62px;
          height: 62px;
          margin: 0 auto 12px;
          display: grid;
          place-items: center;
          border: 2px solid #d4af37;
          border-radius: 19px;
          background: linear-gradient(145deg, #0a2e73, #03153f);
          color: #d4af37;
          font-size: 17px;
          font-weight: 950;
          letter-spacing: 1px;
          box-shadow: 0 13px 30px rgba(10,46,115,.2);
        }

        .ncsClubEyebrow {
          display: block;
          color: #9a7620;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.6px;
        }

        h2 {
          margin: 8px auto 0;
          max-width: 340px;
          color: #0a2e73;
          font-size: 26px;
          line-height: 1.14;
        }

        .ncsClubLead {
          margin: 12px auto 0;
          max-width: 360px;
          color: #636363;
          font-size: 13px;
          line-height: 1.65;
        }

        .ncsClubBenefits {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 15px;
        }

        .ncsClubBenefits span {
          padding: 6px 9px;
          border: 1px solid #eadfbf;
          border-radius: 999px;
          background: #fffdf8;
          color: #6e5923;
          font-size: 10px;
          font-weight: 800;
        }

        form {
          display: grid;
          gap: 12px;
          margin-top: 18px;
          text-align: left;
        }

        label {
          color: #374151;
          font-size: 11px;
          font-weight: 800;
        }

        input {
          width: 100%;
          height: 48px;
          margin-top: 6px;
          padding: 0 13px;
          border: 1px solid #d9dfe9;
          border-radius: 12px;
          outline: none;
          background: white;
          color: #222;
          font-size: 14px;
        }

        input:focus {
          border-color: #d4af37;
          box-shadow: 0 0 0 3px rgba(212,175,55,.13);
        }

        .ncsClubPhone {
          display: grid;
          grid-template-columns: 54px 1fr;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
        }

        .ncsClubPhone span {
          height: 48px;
          display: grid;
          place-items: center;
          border: 1px solid #d9dfe9;
          border-radius: 12px;
          background: #f8fafc;
          color: #0a2e73;
          font-size: 12px;
          font-weight: 900;
        }

        .ncsClubPhone input {
          margin-top: 0;
        }

        .ncsClubJoin,
        .ncsClubDone {
          min-height: 50px;
          border: none;
          border-radius: 13px;
          background: linear-gradient(135deg, #d4af37, #f1d36b);
          color: #0a2e73;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: .35px;
          cursor: pointer;
          box-shadow: 0 12px 27px rgba(212,175,55,.22);
        }

        .ncsClubJoin:disabled {
          opacity: .65;
          cursor: wait;
        }

        .ncsClubTerms {
          display: block;
          margin-top: 12px;
          color: #8b8b8b;
          font-size: 9px;
          line-height: 1.55;
        }

        .ncsClubSuccess {
          display: grid;
          justify-items: center;
        }

        .ncsClubTick {
          width: 54px;
          height: 54px;
          margin-top: 7px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #eaf8ef;
          color: #168347;
          font-size: 25px;
          font-weight: 900;
        }

        .ncsClubSuccess > p {
          margin: 9px 0 0;
          color: #69707d;
          font-size: 12px;
          line-height: 1.6;
        }

        .ncsClubVoucher {
          width: 100%;
          margin-top: 18px;
          padding: 18px;
          border: 1px dashed #d4af37;
          border-radius: 17px;
          background: linear-gradient(135deg, #081f52, #0a2e73);
          color: white;
        }

        .ncsClubVoucher small {
          display: block;
          color: #eed472;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .ncsClubVoucher strong {
          display: block;
          margin-top: 8px;
          font-size: 27px;
          letter-spacing: 2px;
        }

        .ncsClubVoucher button {
          margin-top: 12px;
          padding: 9px 14px;
          border: 1px solid rgba(255,255,255,.25);
          border-radius: 9px;
          background: rgba(255,255,255,.11);
          color: white;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsClubUse {
          color: #0a2e73 !important;
          font-weight: 800;
        }

        .ncsClubWhatsApp {
          font-size: 10px !important;
        }

        .ncsClubDone {
          width: 100%;
          margin-top: 17px;
        }

        @media (max-width: 520px) {
          .ncsClubBackdrop {
            align-items: end;
            padding: 10px;
          }

          .ncsClubCard {
            width: 100%;
            border-radius: 24px 24px 18px 18px;
            padding: 27px 18px 20px;
          }

          h2 {
            font-size: 23px;
          }
        }
      `}</style>
    </div>
  );
}