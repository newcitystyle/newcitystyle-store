"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "badri.nsv@gmail.com";
const OFFLINE_PIN_HASH_KEY = "ncs_offline_pos_pin_hash_v1";
const OFFLINE_PIN_SALT_KEY = "ncs_offline_pos_pin_salt_v1";
const OFFLINE_POS_SESSION_KEY = "ncs_offline_pos_session_v1";
const CANONICAL_PRODUCTION_HOST = "www.newcitystyle.store";

function isBrowserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function hashOfflinePin(pin: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

function createOfflinePinSalt() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function hasOfflinePinConfigured() {
  if (typeof window === "undefined") return false;

  try {
    return Boolean(
      window.localStorage.getItem(OFFLINE_PIN_HASH_KEY) &&
        window.localStorage.getItem(OFFLINE_PIN_SALT_KEY),
    );
  } catch {
    return false;
  }
}

function enforceCanonicalProductionOrigin() {
  if (typeof window === "undefined") return false;

  const { hostname, protocol, pathname, search, hash } =
    window.location;

  if (
    protocol === "https:" &&
    hostname === "newcitystyle.store"
  ) {
    window.location.replace(
      `https://${CANONICAL_PRODUCTION_HOST}${pathname}${search}${hash}`,
    );
    return true;
  }

  return false;
}

async function cacheOfflineShellNow() {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  try {
    const registration =
      await navigator.serviceWorker.ready;

    const worker =
      registration.active ||
      registration.waiting ||
      registration.installing;

    worker?.postMessage({
      type: "CACHE_OFFLINE_SHELL_NOW",
    });
  } catch (error) {
    console.info(
      "Offline shell cache request was not completed:",
      error,
    );
  }
}

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [offlinePinConfigured, setOfflinePinConfigured] =
    useState(false);
  const [offlinePin, setOfflinePin] = useState("");
  const [showOfflinePin, setShowOfflinePin] = useState(false);
  const [offlineUnlocking, setOfflineUnlocking] = useState(false);

  useEffect(() => {
    if (enforceCanonicalProductionOrigin()) {
      return;
    }

    const updateNetworkState = () => {
      setIsOnline(isBrowserOnline());
      setOfflinePinConfigured(hasOfflinePinConfigured());
    };

    updateNetworkState();
    void checkExistingSession();

    window.addEventListener("online", updateNetworkState);
    window.addEventListener("offline", updateNetworkState);

    return () => {
      window.removeEventListener("online", updateNetworkState);
      window.removeEventListener("offline", updateNetworkState);
    };
  }, []);

  async function checkExistingSession() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const sessionEmail =
        session?.user?.email?.trim().toLowerCase() || "";

      if (session?.user && sessionEmail === ADMIN_EMAIL) {
        if (isBrowserOnline()) {
          const pinReady =
            await ensureOfflinePinConfigured();

          if (!pinReady) {
            setErrorMessage(
              "Create the Offline POS PIN once to finish trusted-computer setup.",
            );
            return;
          }

          await cacheOfflineShellNow();
        }

        router.replace("/admin/dashboard");
        return;
      }

      if (session?.user && sessionEmail !== ADMIN_EMAIL) {
        await supabase.auth.signOut({ scope: "local" });
      }
    } catch (error) {
      if (isBrowserOnline()) {
        console.error("Admin session check error:", error);
      }
    } finally {
      setCheckingSession(false);
    }
  }

  async function ensureOfflinePinConfigured(): Promise<boolean> {
    if (hasOfflinePinConfigured()) {
      setOfflinePinConfigured(true);
      return true;
    }

    const firstPin = window.prompt(
      "Create a 4 to 6 digit Offline POS PIN for this trusted shop computer.",
    );

    if (firstPin === null) return false;

    const cleanPin = firstPin.trim();

    if (!/^\d{4,6}$/.test(cleanPin)) {
      alert("Offline POS PIN must contain 4 to 6 digits.");
      return false;
    }

    const confirmPin = window.prompt(
      "Enter the same Offline POS PIN again.",
    );

    if (confirmPin?.trim() !== cleanPin) {
      alert("Offline POS PIN confirmation did not match.");
      return false;
    }

    const salt = createOfflinePinSalt();
    const hash = await hashOfflinePin(cleanPin, salt);

    try {
      window.localStorage.setItem(
        OFFLINE_PIN_SALT_KEY,
        salt,
      );
      window.localStorage.setItem(
        OFFLINE_PIN_HASH_KEY,
        hash,
      );

      const savedSalt =
        window.localStorage.getItem(
          OFFLINE_PIN_SALT_KEY,
        );
      const savedHash =
        window.localStorage.getItem(
          OFFLINE_PIN_HASH_KEY,
        );

      if (savedSalt !== salt || savedHash !== hash) {
        throw new Error(
          "Browser did not preserve Offline PIN storage.",
        );
      }
    } catch {
      alert(
        "Offline PIN could not be saved. Use the normal browser window, allow site storage, and do not use Incognito mode.",
      );
      return false;
    }

    setOfflinePinConfigured(true);

    alert(
      "Offline POS PIN saved permanently on this trusted computer.",
    );

    return true;
  }

  async function handleOfflineUnlock(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setErrorMessage("");

    if (!offlinePinConfigured) {
      setErrorMessage(
        "Offline POS PIN is not configured yet. Connect to the internet and login once to create it.",
      );
      return;
    }

    const cleanPin = offlinePin.trim();

    if (!/^\d{4,6}$/.test(cleanPin)) {
      setErrorMessage("Enter your 4 to 6 digit Offline POS PIN.");
      return;
    }

    setOfflineUnlocking(true);

    try {
      const savedSalt =
        window.localStorage.getItem(OFFLINE_PIN_SALT_KEY) || "";
      const savedHash =
        window.localStorage.getItem(OFFLINE_PIN_HASH_KEY) || "";

      const enteredHash = await hashOfflinePin(cleanPin, savedSalt);

      if (!savedSalt || !savedHash || enteredHash !== savedHash) {
        throw new Error("Offline POS PIN is incorrect.");
      }

      window.sessionStorage.setItem(
        OFFLINE_POS_SESSION_KEY,
        JSON.stringify({
          unlockedAt: new Date().toISOString(),
          access: "pos-only",
        }),
      );

      window.location.replace("/admin/pos");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to unlock Offline POS.",
      );
    } finally {
      setOfflineUnlocking(false);
    }
  }

  function forgetOfflinePin() {
    const confirmed = window.confirm(
      "Remove the Offline POS PIN from this computer?",
    );

    if (!confirmed) return;

    window.localStorage.removeItem(OFFLINE_PIN_HASH_KEY);
    window.localStorage.removeItem(OFFLINE_PIN_SALT_KEY);
    window.sessionStorage.removeItem(OFFLINE_POS_SESSION_KEY);
    setOfflinePinConfigured(false);
    setOfflinePin("");
    setErrorMessage("Offline POS PIN removed from this computer.");
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");

    if (!isBrowserOnline()) {
      setErrorMessage(
        offlinePinConfigured
          ? "Internet is unavailable. Use Offline POS PIN below."
          : "Internet is unavailable and Offline POS PIN is not configured.",
      );
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage("Please enter the admin email address.");
      return;
    }

    if (cleanEmail !== ADMIN_EMAIL) {
      setErrorMessage(
        "This email is not authorized to access NEW CITY STYLE Admin Studio."
      );
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must contain at least 6 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        throw error;
      }

      const loggedInEmail =
        data.user?.email?.trim().toLowerCase() || "";

      if (!data.session || loggedInEmail !== ADMIN_EMAIL) {
        await supabase.auth.signOut({ scope: "local" });

        throw new Error(
          "This account is not authorized as an administrator."
        );
      }

      const pinReady =
        await ensureOfflinePinConfigured();

      if (!pinReady) {
        setErrorMessage(
          "Offline POS PIN setup was not completed. Create it once so billing can open without internet.",
        );
        return;
      }

      await cacheOfflineShellNow();

      window.sessionStorage.removeItem(
        OFFLINE_POS_SESSION_KEY,
      );
      window.location.replace("/admin/dashboard");
    } catch (error) {
      console.error("Admin password login error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to login.";

      if (message.toLowerCase().includes("invalid login credentials")) {
        setErrorMessage(
          "Email or password is incorrect. This account may not have a password yet."
        );
      } else if (
        message.toLowerCase().includes("email not confirmed")
      ) {
        setErrorMessage(
          "Please confirm the admin email before logging in."
        );
      } else if (
        message.toLowerCase().includes("failed to fetch") ||
        message.toLowerCase().includes("network")
      ) {
        setIsOnline(false);
        setErrorMessage(
          offlinePinConfigured
            ? "Internet is unavailable. Unlock Offline POS with your PIN below."
            : "Internet is unavailable. Connect once and login to create an Offline POS PIN.",
        );
      } else {
        setErrorMessage(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    setErrorMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (cleanEmail !== ADMIN_EMAIL) {
      setErrorMessage(
        "Enter the authorized admin email first."
      );
      return;
    }

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/reset-password`
              : undefined,
        });

      if (error) {
        throw error;
      }

      alert(
        "Password reset email sent. Open the email and create a new password."
      );
    } catch (error) {
      console.error("Password reset error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to send password reset email."
      );
    }
  }

  if (checkingSession) {
    return (
      <main className="loadingPage">
        <div className="loadingLogo">NCS</div>
        <div className="loader" />
        <h2>Checking Admin Session...</h2>

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

          .loadingLogo {
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

          .loader {
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
      <section className="loginCard">
        <div className="brandArea">
          <div className="brandLogo">NCS</div>

          <p className="eyebrow">NEW CITY STYLE</p>

          <h1>Admin Studio</h1>

          <p className="subtitle">
            Secure password login for managing products, orders,
            customers and store operations.
          </p>

          <div className="featureList">
            <div>
              <span>✓</span>
              Password protected access
            </div>

            <div>
              <span>✓</span>
              Authorized admin email only
            </div>

            <div>
              <span>✓</span>
              Secure Supabase session
            </div>
          </div>
        </div>

        <form className="loginForm" onSubmit={handleLogin}>
          <div className="formHeading">
            <p>ADMIN LOGIN</p>
            <h2>Welcome Back</h2>
            <span>
              Login with your registered admin email and password.
            </span>
          </div>

          {errorMessage && (
            <div className="errorBox">
              <strong>!</strong>
              <span>{errorMessage}</span>
            </div>
          )}

          <div
            className={
              isOnline
                ? "networkStatus networkOnline"
                : "networkStatus networkOffline"
            }
          >
            <span>{isOnline ? "●" : "●"}</span>
            <strong>{isOnline ? "ONLINE" : "OFFLINE MODE"}</strong>
            <small>
              {isOnline
                ? "Cloud login and sync are available."
                : "Cloud login is unavailable. POS can use cached stock."}
            </small>
          </div>

          <div className="field">
            <label htmlFor="admin-email">Admin Email</label>

            <div className="inputWrap">
              <span>✉</span>

              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter admin email"
                autoComplete="email"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="admin-password">Password</label>

            <div className="inputWrap">
              <span>🔑</span>

              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter admin password"
                autoComplete="current-password"
                disabled={submitting}
              />

              <button
                type="button"
                className="showButton"
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                disabled={submitting}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="loginButton"
            disabled={submitting}
          >
            {submitting ? "Logging in..." : "Login to Admin Studio"}
          </button>

          <button
            type="button"
            className="forgotButton"
            onClick={handleForgotPassword}
            disabled={submitting}
          >
            Forgot / Create Password
          </button>

          <button
            type="button"
            className="storeButton"
            onClick={() => router.push("/")}
            disabled={submitting}
          >
            ← Return to Store
          </button>

          <div className="offlineDivider">
            <span>OFFLINE POS ACCESS</span>
          </div>

          <form className="offlineUnlockBox" onSubmit={handleOfflineUnlock}>
            <div>
              <strong>
                {offlinePinConfigured
                  ? "Unlock Billing / POS"
                  : "Offline PIN Not Configured"}
              </strong>
              <p>
                {offlinePinConfigured
                  ? "Use this only when internet is unavailable. Access is limited to Billing / POS."
                  : "Login online once on this computer to create your Offline POS PIN."}
              </p>
            </div>

            {offlinePinConfigured && (
              <>
                <div className="inputWrap offlinePinWrap">
                  <span>🔢</span>

                  <input
                    type={showOfflinePin ? "text" : "password"}
                    value={offlinePin}
                    onChange={(event) =>
                      setOfflinePin(
                        event.target.value
                          .replace(/\D/g, "")
                          .slice(0, 6),
                      )
                    }
                    placeholder="4 to 6 digit PIN"
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={offlineUnlocking}
                  />

                  <button
                    type="button"
                    className="showButton"
                    onClick={() =>
                      setShowOfflinePin((current) => !current)
                    }
                  >
                    {showOfflinePin ? "Hide" : "Show"}
                  </button>
                </div>

                <button
                  type="submit"
                  className="offlineUnlockButton"
                  disabled={offlineUnlocking}
                >
                  {offlineUnlocking
                    ? "Unlocking..."
                    : "Open Offline Billing / POS"}
                </button>

                <button
                  type="button"
                  className="forgetPinButton"
                  onClick={forgetOfflinePin}
                  disabled={offlineUnlocking}
                >
                  Remove Offline PIN
                </button>
              </>
            )}
          </form>

          <div className="securityNote">
            <span>🔐</span>
            <p>
              Normal login does not send OTP or magic-link emails.
              Email is sent only when you choose password reset.
            </p>
          </div>
        </form>
      </section>

      <footer>
        © 2026 NEW CITY STYLE. All Rights Reserved.
      </footer>

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
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 38px 20px;
          background:
            radial-gradient(
              circle at 15% 15%,
              rgba(212, 175, 55, 0.2),
              transparent 28%
            ),
            radial-gradient(
              circle at 85% 80%,
              rgba(65, 125, 255, 0.28),
              transparent 30%
            ),
            linear-gradient(
              135deg,
              #03153f 0%,
              #0a2e73 52%,
              #164ca8 100%
            );
          color: #ffffff;
        }

        .loginCard {
          width: 100%;
          max-width: 1000px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 28px;
          box-shadow: 0 35px 90px rgba(2, 17, 48, 0.42);
        }

        .brandArea {
          min-height: 590px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          padding: 55px;
          background:
            radial-gradient(
              circle at 80% 20%,
              rgba(212, 175, 55, 0.18),
              transparent 30%
            ),
            linear-gradient(
              145deg,
              rgba(3, 21, 63, 0.98),
              rgba(10, 46, 115, 0.92)
            );
        }

        .brandLogo {
          width: 90px;
          height: 90px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 32px;
          border: 2px solid #d4af37;
          border-radius: 25px;
          color: #d4af37;
          font-size: 26px;
          font-weight: 950;
          letter-spacing: 2px;
        }

        .eyebrow {
          margin: 0 0 10px;
          color: #d4af37;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2.4px;
        }

        .brandArea h1 {
          margin: 0;
          font-size: clamp(42px, 5vw, 60px);
          line-height: 1.05;
        }

        .subtitle {
          max-width: 420px;
          margin: 22px 0 0;
          color: rgba(255, 255, 255, 0.72);
          font-size: 15px;
          line-height: 1.8;
        }

        .featureList {
          display: grid;
          gap: 12px;
          margin-top: 34px;
          color: rgba(255, 255, 255, 0.84);
          font-size: 13px;
          font-weight: 700;
        }

        .featureList div {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .featureList span {
          color: #d4af37;
        }

        .loginForm {
          min-height: 590px;
          padding: 55px;
          background: #ffffff;
          color: #172033;
        }

        .formHeading p {
          margin: 0 0 8px;
          color: #d4af37;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .formHeading h2 {
          margin: 0;
          color: #0a2e73;
          font-size: 34px;
        }

        .formHeading > span {
          display: block;
          margin-top: 10px;
          color: #667085;
          font-size: 14px;
          line-height: 1.6;
        }

        .errorBox {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 22px;
          padding: 13px 14px;
          border: 1px solid #fecdca;
          border-radius: 11px;
          background: #fef3f2;
          color: #b42318;
          font-size: 12px;
          font-weight: 700;
        }

        .errorBox strong {
          width: 23px;
          height: 23px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #b42318;
          color: #ffffff;
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
          min-height: 50px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          border: 1px solid #d0d5dd;
          border-radius: 11px;
          background: #ffffff;
        }

        .inputWrap input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
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

        .loginButton,
        .forgotButton,
        .storeButton {
          width: 100%;
          min-height: 48px;
          border-radius: 11px;
          font-weight: 850;
          cursor: pointer;
        }

        .loginButton {
          margin-top: 26px;
          border: 0;
          background: linear-gradient(
            135deg,
            #0a2e73,
            #164ca8
          );
          color: #ffffff;
        }

        .forgotButton {
          margin-top: 11px;
          border: 1px solid #d4af37;
          background: #fff8e4;
          color: #0a2e73;
        }

        .storeButton {
          margin-top: 11px;
          border: 1px solid #d0d5dd;
          background: #ffffff;
          color: #344054;
        }

        button:disabled,
        input:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .networkStatus {
          display: grid;
          grid-template-columns: auto auto minmax(0, 1fr);
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          padding: 11px 13px;
          border-radius: 11px;
          font-size: 10px;
        }

        .networkStatus span {
          font-size: 13px;
        }

        .networkStatus strong {
          font-size: 10px;
          letter-spacing: 0.6px;
        }

        .networkStatus small {
          color: inherit;
          opacity: 0.75;
        }

        .networkOnline {
          border: 1px solid #abefc6;
          background: #ecfdf3;
          color: #067647;
        }

        .networkOffline {
          border: 1px solid #fedf89;
          background: #fffaeb;
          color: #93370d;
        }

        .offlineDivider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 22px;
          color: #b8890b;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .offlineDivider::before,
        .offlineDivider::after {
          content: "";
          height: 1px;
          flex: 1;
          background: #e7d59a;
        }

        .offlineUnlockBox {
          display: grid;
          gap: 11px;
          margin-top: 12px;
          padding: 14px;
          border: 1px solid #e7d59a;
          border-radius: 13px;
          background: linear-gradient(145deg, #fffdf7, #fff8e4);
        }

        .offlineUnlockBox strong {
          display: block;
          color: #0a2e73;
          font-size: 12px;
        }

        .offlineUnlockBox p {
          margin: 4px 0 0;
          color: #667085;
          font-size: 10px;
          line-height: 1.5;
        }

        .offlinePinWrap {
          min-height: 46px;
        }

        .offlineUnlockButton,
        .forgetPinButton {
          width: 100%;
          min-height: 44px;
          border-radius: 10px;
          font-weight: 850;
          cursor: pointer;
        }

        .offlineUnlockButton {
          border: 0;
          background: linear-gradient(135deg, #d4af37, #f1d26a);
          color: #0a2e73;
        }

        .forgetPinButton {
          border: 1px solid #d0d5dd;
          background: #ffffff;
          color: #667085;
          font-size: 10px;
        }

        .securityNote {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 24px;
          padding: 13px;
          border-radius: 11px;
          background: #f8f4ec;
          color: #667085;
          font-size: 11px;
          line-height: 1.55;
        }

        .securityNote p {
          margin: 0;
        }

        footer {
          margin-top: 20px;
          color: rgba(255, 255, 255, 0.58);
          font-size: 10px;
        }

        @media (max-width: 820px) {
          .loginCard {
            max-width: 560px;
            grid-template-columns: 1fr;
          }

          .brandArea {
            min-height: auto;
            padding: 38px 30px;
          }

          .brandLogo {
            width: 70px;
            height: 70px;
            margin-bottom: 24px;
          }

          .brandArea h1 {
            font-size: 42px;
          }

          .featureList {
            display: none;
          }

          .loginForm {
            min-height: auto;
            padding: 38px 30px;
          }
        }

        @media (max-width: 480px) {
          .page {
            padding: 18px 10px;
          }

          .brandArea,
          .loginForm {
            padding: 30px 22px;
          }

          .formHeading h2 {
            font-size: 29px;
          }
        }
      `}</style>
    </main>
  );
}