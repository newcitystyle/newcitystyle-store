"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [checkingLink, setCheckingLink] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;

    function readUrlError() {
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );
      const queryParams = new URLSearchParams(window.location.search);

      const description =
        hashParams.get("error_description") ||
        queryParams.get("error_description");

      const errorCode =
        hashParams.get("error_code") ||
        queryParams.get("error_code");

      if (description || errorCode) {
        setErrorMessage(
          decodeURIComponent(
            (description || "Password reset link is invalid or expired.").replace(
              /\+/g,
              " "
            )
          )
        );
        setRecoveryReady(false);
      }
    }

    async function checkRecoverySession() {
      readUrlError();

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!active) return;

        if (error) {
          throw error;
        }

        if (session?.user) {
          setRecoveryReady(true);
          setErrorMessage("");
        }
      } catch (error) {
        console.error("Recovery session check error:", error);
      } finally {
        if (active) {
          setCheckingLink(false);
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY" && session?.user) {
        setRecoveryReady(true);
        setErrorMessage("");
        setCheckingLink(false);
      }

      if (event === "SIGNED_IN" && session?.user) {
        setRecoveryReady(true);
        setErrorMessage("");
        setCheckingLink(false);
      }
    });

    checkRecoverySession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!recoveryReady) {
      setErrorMessage(
        "This password reset link is invalid or expired. Request a new reset email."
      );
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "Password updated successfully. Opening Admin Login..."
      );

      window.setTimeout(async () => {
        await supabase.auth.signOut({ scope: "local" });
        window.location.replace("/admin/login");
      }, 1200);
    } catch (error) {
      console.error("Password update error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update password."
      );
    } finally {
      setSaving(false);
    }
  }

  if (checkingLink) {
    return (
      <main className="loadingPage">
        <div className="logoBox">NCS</div>
        <div className="spinner" />
        <h2>Checking Reset Link...</h2>

        <style jsx>{`
          .loadingPage {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: linear-gradient(
              135deg,
              #03153f,
              #0a2e73,
              #164ca8
            );
            color: #ffffff;
            text-align: center;
          }

          .logoBox {
            width: 82px;
            height: 82px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #d4af37;
            border-radius: 24px;
            color: #d4af37;
            font-size: 24px;
            font-weight: 950;
          }

          .spinner {
            width: 44px;
            height: 44px;
            margin-top: 24px;
            border: 4px solid rgba(255, 255, 255, 0.2);
            border-top-color: #d4af37;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
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
    <main className="page">
      <section className="card">
        <div className="brandSide">
          <div className="logoBox">NCS</div>
          <p className="eyebrow">NEW CITY STYLE</p>
          <h1>Create New Password</h1>
          <p>
            Set a secure password for your NEW CITY STYLE administrator
            account.
          </p>
        </div>

        <div className="formSide">
          <p className="step">SECURE PASSWORD RESET</p>
          <h2>Reset Password</h2>

          {errorMessage && (
            <div className="message errorMessage">
              <strong>!</strong>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="message successMessage">
              <strong>✓</strong>
              <span>{successMessage}</span>
            </div>
          )}

          {!recoveryReady ? (
            <div className="expiredBox">
              <h3>Reset Link Expired</h3>
              <p>
                Return to Admin Login and press
                <strong> Forgot / Create Password</strong> again. Then open
                only the newest reset email.
              </p>

              <button
                type="button"
                onClick={() => router.replace("/admin/login")}
              >
                Return to Admin Login
              </button>
            </div>
          ) : (
            <form onSubmit={updatePassword}>
              <div className="field">
                <label htmlFor="new-password">New Password</label>

                <div className="inputWrap">
                  <span>🔑</span>

                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    disabled={saving}
                  />

                  <button
                    type="button"
                    className="showButton"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    disabled={saving}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="field">
                <label htmlFor="confirm-password">
                  Confirm New Password
                </label>

                <div className="inputWrap">
                  <span>🔒</span>

                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Enter password again"
                    autoComplete="new-password"
                    disabled={saving}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="primaryButton"
                disabled={saving}
              >
                {saving ? "Updating Password..." : "Save New Password"}
              </button>
            </form>
          )}

          <button
            type="button"
            className="secondaryButton"
            onClick={() => router.replace("/admin/login")}
            disabled={saving}
          >
            ← Back to Admin Login
          </button>
        </div>
      </section>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          font-family: Inter, Poppins, Arial, sans-serif;
        }

        button,
        input {
          font: inherit;
        }

        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px 18px;
          background:
            radial-gradient(
              circle at 15% 15%,
              rgba(212, 175, 55, 0.2),
              transparent 28%
            ),
            linear-gradient(
              135deg,
              #03153f,
              #0a2e73,
              #164ca8
            );
        }

        .card {
          width: 100%;
          max-width: 960px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          overflow: hidden;
          border-radius: 26px;
          box-shadow: 0 35px 90px rgba(2, 17, 48, 0.42);
        }

        .brandSide {
          min-height: 560px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 52px;
          background: linear-gradient(
            145deg,
            #03153f,
            #0a2e73
          );
          color: #ffffff;
        }

        .brandSide .logoBox {
          width: 88px;
          height: 88px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 30px;
          border: 2px solid #d4af37;
          border-radius: 24px;
          color: #d4af37;
          font-size: 25px;
          font-weight: 950;
        }

        .eyebrow,
        .step {
          margin: 0 0 9px;
          color: #d4af37;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.8px;
        }

        .brandSide h1 {
          margin: 0;
          font-size: 46px;
          line-height: 1.08;
        }

        .brandSide > p:last-child {
          margin: 18px 0 0;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.75;
        }

        .formSide {
          min-height: 560px;
          padding: 52px;
          background: #ffffff;
          color: #172033;
        }

        .formSide h2 {
          margin: 0;
          color: #0a2e73;
          font-size: 34px;
        }

        .message {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
          padding: 13px 14px;
          border-radius: 11px;
          font-size: 12px;
          font-weight: 700;
        }

        .message strong {
          width: 23px;
          height: 23px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #ffffff;
        }

        .errorMessage {
          border: 1px solid #fecdca;
          background: #fef3f2;
          color: #b42318;
        }

        .errorMessage strong {
          background: #b42318;
        }

        .successMessage {
          border: 1px solid #abefc6;
          background: #ecfdf3;
          color: #067647;
        }

        .successMessage strong {
          background: #067647;
        }

        .field {
          margin-top: 24px;
        }

        .field label {
          display: block;
          margin-bottom: 8px;
          color: #344054;
          font-size: 12px;
          font-weight: 800;
        }

        .inputWrap {
          min-height: 51px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          border: 1px solid #d0d5dd;
          border-radius: 11px;
        }

        .inputWrap input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          color: #172033;
        }

        .showButton {
          border: 0;
          background: transparent;
          color: #0a2e73;
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
        }

        .primaryButton,
        .secondaryButton,
        .expiredBox button {
          width: 100%;
          min-height: 48px;
          border-radius: 11px;
          font-weight: 850;
          cursor: pointer;
        }

        .primaryButton {
          margin-top: 27px;
          border: 0;
          background: linear-gradient(
            135deg,
            #0a2e73,
            #164ca8
          );
          color: #ffffff;
        }

        .secondaryButton {
          margin-top: 12px;
          border: 1px solid #d0d5dd;
          background: #ffffff;
          color: #344054;
        }

        .expiredBox {
          margin-top: 24px;
          padding: 22px;
          border: 1px solid #fecdca;
          border-radius: 14px;
          background: #fef3f2;
        }

        .expiredBox h3 {
          margin: 0;
          color: #b42318;
        }

        .expiredBox p {
          color: #667085;
          font-size: 13px;
          line-height: 1.65;
        }

        .expiredBox button {
          border: 0;
          background: #0a2e73;
          color: #ffffff;
        }

        button:disabled,
        input:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        @media (max-width: 780px) {
          .card {
            max-width: 560px;
            grid-template-columns: 1fr;
          }

          .brandSide {
            min-height: auto;
            padding: 36px 28px;
          }

          .brandSide h1 {
            font-size: 37px;
          }

          .formSide {
            min-height: auto;
            padding: 36px 28px;
          }
        }

        @media (max-width: 480px) {
          .page {
            padding: 14px 9px;
          }

          .brandSide,
          .formSide {
            padding: 29px 21px;
          }
        }
      `}</style>
    </main>
  );
}
