"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "badri.nsv@gmail.com";
const OFFLINE_PIN_HASH_KEY = "ncs_offline_pos_pin_hash_v1";
const OFFLINE_PIN_SALT_KEY = "ncs_offline_pos_pin_salt_v1";
const OFFLINE_POS_SESSION_KEY = "ncs_offline_pos_session_v1";
const OFFLINE_POS_TRUST_KEY = "ncs_offline_pos_trusted_access_v1";
const OFFLINE_TRUST_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const CANONICAL_PRODUCTION_HOST = "www.newcitystyle.store";

function isBrowserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function rememberTrustedOfflineAccess() {
  if (typeof window === "undefined") return;

  const payload = {
    unlockedAt: new Date().toISOString(),
    expiresAt: Date.now() + OFFLINE_TRUST_DURATION_MS,
    access: "pos-only",
  };

  try {
    window.sessionStorage.setItem(
      OFFLINE_POS_SESSION_KEY,
      JSON.stringify(payload),
    );
    window.localStorage.setItem(
      OFFLINE_POS_TRUST_KEY,
      JSON.stringify(payload),
    );
  } catch (error) {
    console.info("Unable to remember trusted Offline POS access:", error);
  }
}

function hasTrustedOfflineAccess() {
  if (typeof window === "undefined") return false;

  try {
    const saved = window.localStorage.getItem(OFFLINE_POS_TRUST_KEY);

    if (!saved) return false;

    const parsed = JSON.parse(saved) as {
      expiresAt?: number;
      access?: string;
    };

    return Boolean(
      parsed.access === "pos-only" &&
        parsed.expiresAt &&
        parsed.expiresAt > Date.now(),
    );
  } catch {
    return false;
  }
}

function restoreTrustedOfflineAccess() {
  if (typeof window === "undefined") return false;

  try {
    const saved = window.localStorage.getItem(OFFLINE_POS_TRUST_KEY);

    if (!saved) return false;

    const parsed = JSON.parse(saved) as {
      expiresAt?: number;
      access?: string;
    };

    if (
      parsed.access !== "pos-only" ||
      !parsed.expiresAt ||
      parsed.expiresAt <= Date.now()
    ) {
      window.localStorage.removeItem(OFFLINE_POS_TRUST_KEY);
      return false;
    }

    window.sessionStorage.setItem(
      OFFLINE_POS_SESSION_KEY,
      saved,
    );

    return true;
  } catch {
    return false;
  }
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

  /*
   * Do not force a hostname hop while offline. A cached page must stay on the
   * origin that is already available instead of attempting a network redirect.
   */
  if (
    isBrowserOnline() &&
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

async function isOfflinePosShellCached() {
  if (
    typeof window === "undefined" ||
    !("caches" in window)
  ) {
    return false;
  }

  try {
    const response = await window.caches.match("/admin/pos");
    return Boolean(response);
  } catch {
    return false;
  }
}

async function cacheOfflineShellNow(): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return false;
  }

  try {
    const registration = await withTimeout(
      navigator.serviceWorker.ready,
      4500,
      "Service worker was not ready in time.",
    );

    const worker =
      registration.active ||
      registration.waiting ||
      registration.installing;

    worker?.postMessage({
      type: "CACHE_OFFLINE_SHELL_NOW",
    });

    /*
     * Fetch the POS document once while authenticated. The service worker
     * recognizes /admin/pos and stores the valid HTML plus its static assets.
     * This closes the gap where the PIN existed but the POS shell itself had
     * never been cached.
     */
    if (isBrowserOnline()) {
      try {
        await withTimeout(
          fetch("/admin/pos", {
            method: "GET",
            credentials: "include",
            cache: "reload",
            headers: {
              Accept: "text/html",
            },
          }),
          6000,
          "Offline POS preparation timed out.",
        );
      } catch (error) {
        console.info("POS warm-cache request did not complete:", error);
      }
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (await isOfflinePosShellCached()) {
        return true;
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 250);
      });
    }

    return await isOfflinePosShellCached();
  } catch (error) {
    console.info(
      "Offline shell cache request was not completed:",
      error,
    );
    return false;
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
  const [offlineShellReady, setOfflineShellReady] = useState(false);
  const [offlineTrustReady, setOfflineTrustReady] = useState(false);
  const [offlinePreparing, setOfflinePreparing] = useState(false);

  useEffect(() => {
    if (enforceCanonicalProductionOrigin()) {
      return;
    }

    const updateNetworkState = () => {
      setIsOnline(isBrowserOnline());
      setOfflinePinConfigured(hasOfflinePinConfigured());
      setOfflineTrustReady(hasTrustedOfflineAccess());
      void isOfflinePosShellCached().then(setOfflineShellReady);
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
    const openTrustedOfflinePos = async () => {
      if (!restoreTrustedOfflineAccess()) {
        return false;
      }

      const shellReady = await isOfflinePosShellCached();
      setOfflineShellReady(shellReady);
      setOfflineTrustReady(true);

      if (!shellReady) {
        setErrorMessage(
          "Offline access is trusted, but this browser has not cached the POS shell yet. Connect once and use PREPARE OFFLINE POS.",
        );
        return false;
      }

      window.location.replace("/admin/pos?offline=1");
      return true;
    };

    if (!isBrowserOnline()) {
      setIsOnline(false);
      setOfflinePinConfigured(hasOfflinePinConfigured());

      if (await openTrustedOfflinePos()) {
        return;
      }

      setCheckingSession(false);
      return;
    }

    try {
      const {
        data: { session },
      } = await withTimeout(
        supabase.auth.getSession(),
        5000,
        "Session check timed out.",
      );

      const sessionEmail =
        session?.user?.email?.trim().toLowerCase() || "";

      if (session?.user && sessionEmail === ADMIN_EMAIL) {
        rememberTrustedOfflineAccess();
        setOfflineTrustReady(true);

        const cached = await cacheOfflineShellNow();
        setOfflineShellReady(cached);

        router.replace("/admin/dashboard");
        return;
      }

      if (session?.user && sessionEmail !== ADMIN_EMAIL) {
        await supabase.auth.signOut({ scope: "local" });
      }
    } catch (error) {
      console.info("Admin session check did not complete:", error);

      /*
       * navigator.onLine can stay true when Wi-Fi is connected but the
       * internet is actually unavailable. Fall back to the trusted local
       * session instead of leaving the user stuck on the online login.
       */
      setIsOnline(false);

      if (await openTrustedOfflinePos()) {
        return;
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

    try {
      if ("storage" in navigator && "persist" in navigator.storage) {
        await navigator.storage.persist();
      }
    } catch (error) {
      console.info("Persistent browser storage request was skipped:", error);
    }

    alert(
      "Offline POS PIN saved on this trusted computer. It will not be requested during every online login.",
    );

    return true;
  }

  async function handleConfigureOfflinePin() {
    setErrorMessage("");

    if (!isBrowserOnline()) {
      setErrorMessage(
        "Connect to the internet once to set or change the Offline POS PIN.",
      );
      return;
    }

    await ensureOfflinePinConfigured();
    setOfflinePinConfigured(hasOfflinePinConfigured());
  }

  async function handlePrepareOfflinePos() {
    setErrorMessage("");
    setOfflinePreparing(true);

    try {
      if (!isBrowserOnline()) {
        throw new Error(
          "Connect to the internet once to prepare the Offline POS shell.",
        );
      }

      rememberTrustedOfflineAccess();
      setOfflineTrustReady(true);

      try {
        if ("storage" in navigator && "persist" in navigator.storage) {
          await navigator.storage.persist();
        }
      } catch {
        // Persistent storage is helpful but not required.
      }

      const ready = await cacheOfflineShellNow();
      setOfflineShellReady(ready);

      if (!ready) {
        throw new Error(
          "Offline POS shell could not be verified. Open Billing / POS once while online and try PREPARE OFFLINE POS again.",
        );
      }

      setErrorMessage(
        "Offline POS is READY on this computer. You can now disconnect the internet and reopen Billing / POS.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to prepare Offline POS.",
      );
    } finally {
      setOfflinePreparing(false);
    }
  }

  async function handleTrustedOfflineOpen() {
    setErrorMessage("");

    if (!restoreTrustedOfflineAccess()) {
      setOfflineTrustReady(false);
      setErrorMessage(
        "Trusted offline access is not available or has expired. Login online once to renew it.",
      );
      return;
    }

    const ready = await isOfflinePosShellCached();
    setOfflineShellReady(ready);

    if (!ready) {
      setErrorMessage(
        "Offline POS shell is not cached yet. Connect once and press PREPARE OFFLINE POS.",
      );
      return;
    }

    window.location.replace("/admin/pos?offline=1");
  }

  async function handleOfflineUnlock() {
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

      rememberTrustedOfflineAccess();
      setOfflineTrustReady(true);

      const shellReady = await isOfflinePosShellCached();
      setOfflineShellReady(shellReady);

      if (!shellReady) {
        throw new Error(
          "Offline PIN is correct, but the POS shell is not cached on this computer. Connect once and press PREPARE OFFLINE POS.",
        );
      }

      window.location.replace("/admin/pos?offline=1");
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
    window.localStorage.removeItem(OFFLINE_POS_TRUST_KEY);
    window.sessionStorage.removeItem(OFFLINE_POS_SESSION_KEY);
    setOfflinePinConfigured(false);
    setOfflineTrustReady(false);
    setOfflinePin("");
    setErrorMessage("Offline POS PIN and trusted access were removed from this computer.");
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");

    if (!isBrowserOnline()) {
      setIsOnline(false);

      if (hasTrustedOfflineAccess()) {
        await handleTrustedOfflineOpen();
        return;
      }

      setErrorMessage(
        offlinePinConfigured
          ? "Internet is unavailable. Use the Offline POS PIN below."
          : "Internet is unavailable and Offline POS is not prepared on this computer.",
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
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        }),
        12000,
        "Login request timed out. Please check the connection and try again.",
      );

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

      rememberTrustedOfflineAccess();
      setOfflineTrustReady(true);

      const offlineReady = await cacheOfflineShellNow();
      setOfflineShellReady(offlineReady);

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
        message.toLowerCase().includes("network") ||
        message.toLowerCase().includes("timed out")
      ) {
        setIsOnline(false);

        if (hasTrustedOfflineAccess()) {
          await handleTrustedOfflineOpen();
          return;
        }

        setErrorMessage(
          offlinePinConfigured
            ? "Internet is unavailable. Unlock Offline POS with your PIN below."
            : "Internet is unavailable. Connect once, login successfully, then press PREPARE OFFLINE POS.",
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
        <div className="loadingHalo">
          <div className="loadingLogo">NCS</div>
        </div>
        <div className="loader" />
        <h2>Preparing Admin Access</h2>
        <p>Checking secure session and trusted offline state…</p>

        <style jsx>{`
          .loadingPage {
            min-height: 100vh;
            display: grid;
            place-items: center;
            align-content: center;
            gap: 14px;
            padding: 24px;
            background:
              radial-gradient(circle at 50% 30%, rgba(43, 119, 255, 0.22), transparent 28%),
              linear-gradient(145deg, #020a18 0%, #061a3c 48%, #0a2e73 100%);
            color: #ffffff;
            text-align: center;
          }

          .loadingHalo {
            width: 118px;
            height: 118px;
            display: grid;
            place-items: center;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(212, 175, 55, 0.18), transparent 66%);
          }

          .loadingLogo {
            width: 72px;
            height: 72px;
            display: grid;
            place-items: center;
            border: 1px solid rgba(212, 175, 55, 0.75);
            border-radius: 24px;
            color: #f2d56b;
            background: rgba(4, 18, 47, 0.82);
            font-size: 22px;
            font-weight: 950;
            letter-spacing: 2px;
            box-shadow: 0 18px 60px rgba(0, 0, 0, 0.32);
          }

          .loader {
            width: 34px;
            height: 34px;
            border: 3px solid rgba(255, 255, 255, 0.12);
            border-top-color: #f2d56b;
            border-radius: 50%;
            animation: spin 0.75s linear infinite;
          }

          .loadingPage h2 {
            margin: 0;
            font-size: 22px;
          }

          .loadingPage p {
            margin: 0;
            color: rgba(255, 255, 255, 0.62);
            font-size: 12px;
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

  const offlineReady =
    offlineShellReady && (offlineTrustReady || offlinePinConfigured);

  return (
    <main className="page">
      <div className="ambientGrid" />

      <section className="accessShell">
        <aside className="identityPanel">
          <div className="identityTop">
            <div className="brandMark">
              <span>NCS</span>
              <small>2036</small>
            </div>

            <div className="liveBadge">
              <i />
              ADMIN ACCESS
            </div>
          </div>

          <div className="identityCore">
            <p className="eyebrow">NEW CITY STYLE</p>
            <h1>
              Command
              <br />
              Studio
            </h1>
            <p className="identityCopy">
              One secure entry for store operations, billing,
              inventory, orders and owner intelligence.
            </p>
          </div>

          <div className="systemRail">
            <div>
              <span>NETWORK</span>
              <strong className={isOnline ? "okText" : "warnText"}>
                {isOnline ? "LIVE" : "OFFLINE"}
              </strong>
            </div>
            <div>
              <span>POS SHELL</span>
              <strong className={offlineShellReady ? "okText" : "warnText"}>
                {offlineShellReady ? "READY" : "NOT CACHED"}
              </strong>
            </div>
            <div>
              <span>TRUST</span>
              <strong className={offlineTrustReady ? "okText" : "mutedText"}>
                {offlineTrustReady ? "ACTIVE" : "LOCKED"}
              </strong>
            </div>
          </div>

          <div className="identityFooter">
            <span>SECURE SESSION</span>
            <span>SUPABASE AUTH</span>
            <span>LOCAL POS FALLBACK</span>
          </div>
        </aside>

        <section className="authPanel">
          <div className="authTopline">
            <div>
              <p>ADMIN STUDIO</p>
              <h2>Welcome back</h2>
            </div>

            <div
              className={
                isOnline
                  ? "networkPill onlinePill"
                  : "networkPill offlinePill"
              }
            >
              <span />
              {isOnline ? "ONLINE" : "OFFLINE"}
            </div>
          </div>

          <p className="authIntro">
            Use your administrator password online, or open the
            trusted Offline POS when the connection is unavailable.
          </p>

          {errorMessage && (
            <div
              className={
                errorMessage.includes("READY")
                  ? "messageBox successBox"
                  : "messageBox errorBox"
              }
            >
              <strong>
                {errorMessage.includes("READY") ? "✓" : "!"}
              </strong>
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="loginForm" onSubmit={handleLogin}>
            <div className="field">
              <label htmlFor="admin-email">ADMIN EMAIL</label>
              <div className="inputWrap">
                <span className="fieldIcon">✉</span>
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
              <label htmlFor="admin-password">PASSWORD</label>
              <div className="inputWrap">
                <span className="fieldIcon">◆</span>
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="loginButton"
              disabled={submitting}
            >
              <span>
                {submitting ? "AUTHENTICATING…" : "ENTER ADMIN STUDIO"}
              </span>
              <b>→</b>
            </button>
          </form>

          <div className="secondaryRow">
            <button
              type="button"
              className="textAction"
              onClick={handleForgotPassword}
              disabled={submitting}
            >
              Forgot / Create Password
            </button>

            <button
              type="button"
              className="textAction"
              onClick={() => router.push("/")}
              disabled={submitting}
            >
              Return to Store
            </button>
          </div>

          <div className="offlineVault">
            <div className="vaultHeader">
              <div>
                <p>OFFLINE POS VAULT</p>
                <h3>
                  {offlineReady
                    ? "Ready for internet-free billing"
                    : "Prepare this trusted computer"}
                </h3>
              </div>

              <div className={offlineReady ? "readyChip" : "setupChip"}>
                {offlineReady ? "READY" : "SETUP"}
              </div>
            </div>

            <div className="vaultSignals">
              <span className={offlineShellReady ? "signalOn" : ""}>
                <i />
                POS SHELL
              </span>
              <span className={offlineTrustReady ? "signalOn" : ""}>
                <i />
                30-DAY TRUST
              </span>
              <span className={offlinePinConfigured ? "signalOn" : ""}>
                <i />
                PIN
              </span>
            </div>

            {isOnline && (
              <button
                type="button"
                className="prepareButton"
                onClick={() => void handlePrepareOfflinePos()}
                disabled={
                  submitting ||
                  offlineUnlocking ||
                  offlinePreparing
                }
              >
                {offlinePreparing
                  ? "PREPARING OFFLINE POS…"
                  : offlineShellReady
                    ? "REFRESH OFFLINE POS CACHE"
                    : "PREPARE OFFLINE POS"}
              </button>
            )}

            {!isOnline && offlineTrustReady && offlineShellReady && (
              <button
                type="button"
                className="trustedOpenButton"
                onClick={() => void handleTrustedOfflineOpen()}
                disabled={offlineUnlocking}
              >
                OPEN TRUSTED OFFLINE POS
              </button>
            )}

            <div className="pinHead">
              <span>
                {offlinePinConfigured
                  ? "PIN BACKUP ACTIVE"
                  : "OPTIONAL PIN BACKUP"}
              </span>

              {isOnline && (
                <button
                  type="button"
                  onClick={() => void handleConfigureOfflinePin()}
                  disabled={submitting || offlinePreparing}
                >
                  {offlinePinConfigured ? "CHANGE PIN" : "SET PIN"}
                </button>
              )}
            </div>

            {offlinePinConfigured && (
              <div className="pinGrid">
                <div className="inputWrap compactInput">
                  <span className="fieldIcon">#</span>
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
                    placeholder="4–6 digit Offline PIN"
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
                    {showOfflinePin ? "HIDE" : "SHOW"}
                  </button>
                </div>

                <button
                  type="button"
                  className="pinOpenButton"
                  onClick={() => void handleOfflineUnlock()}
                  disabled={offlineUnlocking}
                >
                  {offlineUnlocking ? "CHECKING…" : "OPEN POS"}
                </button>
              </div>
            )}

            {offlinePinConfigured && (
              <button
                type="button"
                className="removePinButton"
                onClick={forgetOfflinePin}
                disabled={offlineUnlocking}
              >
                Remove saved Offline PIN
              </button>
            )}

            <p className="vaultNote">
              First prepare the POS once while online. After that,
              cached billing can reopen from this same browser without
              waiting for Supabase.
            </p>
          </div>

          <div className="securityFooter">
            <span>●</span>
            <p>
              Password login never sends OTP automatically. Email is
              used only when you choose password reset.
            </p>
          </div>
        </section>
      </section>

      <footer>© 2026 NEW CITY STYLE • ADMIN COMMAND STUDIO</footer>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          font-family: Inter, Poppins, Arial, sans-serif;
          background: #030914;
        }

        button,
        input {
          font: inherit;
        }

        button {
          -webkit-tap-highlight-color: transparent;
        }

        .page {
          position: relative;
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 28px 18px 46px;
          overflow: hidden;
          background:
            radial-gradient(circle at 14% 18%, rgba(34, 95, 203, 0.22), transparent 28%),
            radial-gradient(circle at 88% 78%, rgba(40, 103, 255, 0.20), transparent 32%),
            linear-gradient(135deg, #020914 0%, #07182f 45%, #0b2d67 100%);
          color: #ffffff;
        }

        .ambientGrid {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.22;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at center, black, transparent 84%);
        }

        .accessShell {
          position: relative;
          z-index: 1;
          width: min(1120px, 100%);
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 34px;
          background: rgba(3, 12, 28, 0.78);
          box-shadow:
            0 42px 120px rgba(0, 0, 0, 0.48),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(22px);
        }

        .identityPanel {
          min-height: 660px;
          display: flex;
          flex-direction: column;
          padding: 38px 40px 30px;
          background:
            radial-gradient(circle at 75% 18%, rgba(212, 175, 55, 0.14), transparent 24%),
            linear-gradient(150deg, rgba(5, 22, 55, 0.98), rgba(5, 35, 83, 0.88));
        }

        .identityTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .brandMark {
          width: 68px;
          height: 68px;
          display: grid;
          place-items: center;
          align-content: center;
          border: 1px solid rgba(242, 213, 107, 0.7);
          border-radius: 22px;
          background: rgba(4, 17, 42, 0.62);
          box-shadow: 0 16px 50px rgba(0, 0, 0, 0.28);
        }

        .brandMark span {
          color: #f2d56b;
          font-size: 21px;
          font-weight: 950;
          letter-spacing: 1.8px;
        }

        .brandMark small {
          margin-top: 1px;
          color: rgba(255, 255, 255, 0.34);
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 1.4px;
        }

        .liveBadge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 10px;
          border: 1px solid rgba(95, 233, 178, 0.18);
          border-radius: 999px;
          color: rgba(255, 255, 255, 0.68);
          background: rgba(255, 255, 255, 0.04);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.8px;
        }

        .liveBadge i,
        .networkPill span,
        .vaultSignals i {
          width: 6px;
          height: 6px;
          display: block;
          border-radius: 50%;
          background: #5fe9b2;
          box-shadow: 0 0 16px rgba(95, 233, 178, 0.72);
        }

        .identityCore {
          margin: auto 0;
          padding: 38px 0;
        }

        .eyebrow {
          margin: 0 0 12px;
          color: #f2d56b;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 2.2px;
        }

        .identityCore h1 {
          margin: 0;
          color: #ffffff;
          font-size: clamp(48px, 5vw, 68px);
          line-height: 0.98;
          letter-spacing: -2.8px;
        }

        .identityCopy {
          max-width: 390px;
          margin: 22px 0 0;
          color: rgba(255, 255, 255, 0.58);
          font-size: 13px;
          line-height: 1.75;
        }

        .systemRail {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .systemRail div {
          min-width: 0;
          padding: 11px;
          border: 1px solid rgba(255, 255, 255, 0.075);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.035);
        }

        .systemRail span {
          display: block;
          color: rgba(255, 255, 255, 0.34);
          font-size: 6.5px;
          font-weight: 900;
          letter-spacing: 0.75px;
        }

        .systemRail strong {
          display: block;
          margin-top: 4px;
          font-size: 8px;
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .okText {
          color: #66efb9;
        }

        .warnText {
          color: #ffd477;
        }

        .mutedText {
          color: #8ca0b6;
        }

        .identityFooter {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 20px;
          color: rgba(255, 255, 255, 0.29);
          font-size: 6.5px;
          font-weight: 900;
          letter-spacing: 0.7px;
        }

        .authPanel {
          min-height: 660px;
          padding: 34px 42px;
          background:
            radial-gradient(circle at 100% 0%, rgba(69, 128, 255, 0.08), transparent 28%),
            linear-gradient(180deg, #ffffff 0%, #f6f9ff 100%);
          color: #152238;
        }

        .authTopline {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .authTopline p {
          margin: 0 0 5px;
          color: #bd900f;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1.5px;
        }

        .authTopline h2 {
          margin: 0;
          color: #082d73;
          font-size: 30px;
          letter-spacing: -0.9px;
        }

        .networkPill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 3px;
          padding: 8px 10px;
          border-radius: 999px;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.7px;
        }

        .onlinePill {
          color: #087a4b;
          background: #eafbf3;
          border: 1px solid #b9efd3;
        }

        .offlinePill {
          color: #98520b;
          background: #fff7e7;
          border: 1px solid #f1d197;
        }

        .offlinePill span {
          background: #ef9d37;
          box-shadow: 0 0 14px rgba(239, 157, 55, 0.45);
        }

        .authIntro {
          margin: 10px 0 0;
          color: #6b778b;
          font-size: 11px;
          line-height: 1.55;
        }

        .messageBox {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-top: 14px;
          padding: 11px 12px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.4;
        }

        .messageBox strong {
          width: 21px;
          height: 21px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 50%;
        }

        .errorBox {
          color: #a63428;
          background: #fff1f0;
          border: 1px solid #f4c9c4;
        }

        .errorBox strong {
          color: #ffffff;
          background: #c93d30;
        }

        .successBox {
          color: #12633e;
          background: #ecfbf3;
          border: 1px solid #bcebd1;
        }

        .successBox strong {
          color: #ffffff;
          background: #15945d;
        }

        .loginForm {
          margin-top: 18px;
        }

        .field + .field {
          margin-top: 14px;
        }

        .field label {
          display: block;
          margin-bottom: 6px;
          color: #5c6b7f;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.8px;
        }

        .inputWrap {
          min-height: 50px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          border: 1px solid #d8e0eb;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.92);
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            transform 0.18s ease;
        }

        .inputWrap:focus-within {
          border-color: rgba(32, 89, 194, 0.58);
          box-shadow: 0 0 0 4px rgba(32, 89, 194, 0.08);
        }

        .fieldIcon {
          width: 26px;
          height: 26px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          color: #164ca8;
          background: #eef4ff;
          font-size: 11px;
          font-weight: 900;
        }

        .inputWrap input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          color: #17243a;
          background: transparent;
          font-size: 13px;
          font-weight: 650;
        }

        .inputWrap input::placeholder {
          color: #9ca9ba;
          font-weight: 500;
        }

        .showButton {
          border: 0;
          color: #164ca8;
          background: transparent;
          font-size: 7px;
          font-weight: 950;
          cursor: pointer;
        }

        .loginButton {
          width: 100%;
          min-height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 17px;
          border: 0;
          border-radius: 14px;
          color: #ffffff;
          background:
            linear-gradient(135deg, #082d73 0%, #1757ba 65%, #2d74df 100%);
          box-shadow: 0 14px 34px rgba(20, 77, 171, 0.22);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.25px;
          cursor: pointer;
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease;
        }

        .loginButton:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 18px 38px rgba(20, 77, 171, 0.30);
        }

        .loginButton b {
          font-size: 16px;
        }

        .secondaryRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 8px;
        }

        .textAction {
          min-height: 38px;
          border: 1px solid #e0e6ef;
          border-radius: 12px;
          color: #5d6d82;
          background: rgba(255, 255, 255, 0.72);
          font-size: 8px;
          font-weight: 850;
          cursor: pointer;
        }

        .offlineVault {
          margin-top: 16px;
          padding: 14px;
          border: 1px solid rgba(212, 175, 55, 0.32);
          border-radius: 18px;
          background:
            radial-gradient(circle at 100% 0%, rgba(212, 175, 55, 0.09), transparent 34%),
            linear-gradient(145deg, #fffdf7, #f9fbff);
        }

        .vaultHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .vaultHeader p {
          margin: 0 0 4px;
          color: #b28716;
          font-size: 6.5px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .vaultHeader h3 {
          margin: 0;
          color: #0a2e73;
          font-size: 13px;
        }

        .readyChip,
        .setupChip {
          padding: 6px 8px;
          border-radius: 999px;
          font-size: 6px;
          font-weight: 950;
          letter-spacing: 0.7px;
        }

        .readyChip {
          color: #087a4b;
          background: #e7f9f0;
          border: 1px solid #bcebd1;
        }

        .setupChip {
          color: #9a6411;
          background: #fff7e4;
          border: 1px solid #efd79c;
        }

        .vaultSignals {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 10px;
        }

        .vaultSignals span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 7px;
          border-radius: 999px;
          color: #8a96a6;
          background: #f1f4f8;
          font-size: 6px;
          font-weight: 900;
          letter-spacing: 0.45px;
        }

        .vaultSignals i {
          width: 5px;
          height: 5px;
          background: #a8b2c0;
          box-shadow: none;
        }

        .vaultSignals .signalOn {
          color: #0a6d47;
          background: #e9f8f1;
        }

        .vaultSignals .signalOn i {
          background: #36bd82;
          box-shadow: 0 0 10px rgba(54, 189, 130, 0.35);
        }

        .prepareButton,
        .trustedOpenButton,
        .pinOpenButton {
          border: 0;
          color: #082d73;
          background: linear-gradient(135deg, #e7c75f, #f5df8b);
          font-weight: 950;
          cursor: pointer;
        }

        .prepareButton,
        .trustedOpenButton {
          width: 100%;
          min-height: 39px;
          margin-top: 10px;
          border-radius: 11px;
          font-size: 7.5px;
          letter-spacing: 0.4px;
        }

        .trustedOpenButton {
          color: #ffffff;
          background: linear-gradient(135deg, #0b7650, #19a56e);
        }

        .pinHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 10px;
          padding-top: 9px;
          border-top: 1px solid #ece2c5;
        }

        .pinHead span {
          color: #8a7650;
          font-size: 6px;
          font-weight: 950;
          letter-spacing: 0.65px;
        }

        .pinHead button {
          border: 0;
          color: #164ca8;
          background: transparent;
          font-size: 6.5px;
          font-weight: 950;
          cursor: pointer;
        }

        .pinGrid {
          display: grid;
          grid-template-columns: 1fr 94px;
          gap: 7px;
          margin-top: 8px;
        }

        .compactInput {
          min-height: 42px;
        }

        .pinOpenButton {
          border-radius: 11px;
          font-size: 7px;
        }

        .removePinButton {
          margin-top: 7px;
          padding: 0;
          border: 0;
          color: #9a6f62;
          background: transparent;
          font-size: 6.5px;
          font-weight: 800;
          cursor: pointer;
        }

        .vaultNote {
          margin: 8px 0 0;
          color: #7e8896;
          font-size: 7.5px;
          line-height: 1.45;
        }

        .securityFooter {
          display: flex;
          align-items: flex-start;
          gap: 7px;
          margin-top: 11px;
          color: #8c98a8;
        }

        .securityFooter span {
          color: #4bbf8d;
          font-size: 7px;
        }

        .securityFooter p {
          margin: 0;
          font-size: 7px;
          line-height: 1.45;
        }

        button:disabled,
        input:disabled {
          cursor: not-allowed;
          opacity: 0.58;
        }

        footer {
          position: relative;
          z-index: 1;
          margin-top: 15px;
          color: rgba(255, 255, 255, 0.36);
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 0.55px;
        }

        @media (max-width: 900px) {
          .page {
            padding: 18px 12px 34px;
          }

          .accessShell {
            max-width: 620px;
            grid-template-columns: 1fr;
          }

          .identityPanel {
            min-height: auto;
            padding: 24px;
          }

          .identityCore {
            padding: 30px 0 24px;
          }

          .identityCore h1 {
            font-size: 44px;
          }

          .identityCopy {
            margin-top: 14px;
          }

          .identityFooter {
            display: none;
          }

          .authPanel {
            min-height: auto;
            padding: 28px 24px;
          }
        }

        @media (max-width: 520px) {
          .page {
            display: block;
            padding: 10px 8px 28px;
          }

          .accessShell {
            border-radius: 24px;
          }

          .identityPanel {
            padding: 18px;
          }

          .brandMark {
            width: 54px;
            height: 54px;
            border-radius: 18px;
          }

          .brandMark span {
            font-size: 17px;
          }

          .identityCore {
            padding: 22px 0 18px;
          }

          .identityCore h1 {
            font-size: 37px;
            letter-spacing: -1.8px;
          }

          .identityCopy {
            font-size: 11px;
          }

          .systemRail {
            grid-template-columns: 1fr 1fr 1fr;
          }

          .authPanel {
            padding: 24px 18px;
          }

          .authTopline h2 {
            font-size: 26px;
          }

          .secondaryRow {
            grid-template-columns: 1fr;
          }

          .pinGrid {
            grid-template-columns: 1fr;
          }

          .pinOpenButton {
            min-height: 40px;
          }
        }
      `}</style>
    </main>
  );
}
