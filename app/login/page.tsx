"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "badri.nsv@gmail.com";

type AuthMethod = "mobile" | "email";
type MobileMode = "login" | "signup";

function normalizeIndianPhone(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  if (digits.length === 13 && value.trim().startsWith("+91")) {
    return `+${digits}`;
  }

  return value.trim().startsWith("+")
    ? value.trim()
    : `+${digits}`;
}

function displayIndianPhone(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length >= 10) {
    return digits.slice(-10);
  }

  return digits;
}

export default function CustomerLoginPage() {
  const router = useRouter();

  const [authMethod, setAuthMethod] =
    useState<AuthMethod>("mobile");

  const [mobileMode, setMobileMode] =
    useState<MobileMode>("login");

  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);

  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingReset, setSendingReset] =
    useState(false);

  const [checkingSession, setCheckingSession] =
    useState(true);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const cleanMobile = useMemo(
    () => normalizeIndianPhone(mobile),
    [mobile]
  );

  useEffect(() => {
    void checkExistingSession();
  }, []);

  async function checkExistingSession() {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (!session?.user) return;

      const currentEmail =
        session.user.email?.trim().toLowerCase() || "";

      if (currentEmail === ADMIN_EMAIL) {
        router.replace("/admin");
        router.refresh();
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error(
        "Customer session check error:",
        error
      );
    } finally {
      setCheckingSession(false);
    }
  }

  function clearMessages() {
    setErrorMessage("");
    setSuccessMessage("");
  }

  function switchAuthMethod(method: AuthMethod) {
    clearMessages();
    setAuthMethod(method);

    if (method === "mobile") {
      setOtp("");
      setOtpSent(false);
    }
  }

  function switchMobileMode(mode: MobileMode) {
    clearMessages();
    setMobileMode(mode);
    setOtp("");
    setOtpSent(false);
  }

  function switchEmailMode() {
    clearMessages();
    setIsSignup((current) => !current);
    setPassword("");
    setConfirmPassword("");
  }

  function validateMobile(): boolean {
    const digits = cleanMobile.replace(/\D/g, "");

    if (
      digits.length !== 12 ||
      !digits.startsWith("91")
    ) {
      setErrorMessage(
        "Please enter a valid 10-digit Indian mobile number."
      );
      return false;
    }

    if (
      mobileMode === "signup" &&
      fullName.trim().length < 2
    ) {
      setErrorMessage("Please enter your full name.");
      return false;
    }

    return true;
  }

  async function sendMobileOtp() {
    clearMessages();

    if (!validateMobile()) return;

    setOtpSending(true);

    try {
      const { error } =
        await supabase.auth.signInWithOtp({
          phone: cleanMobile,
          options: {
            shouldCreateUser: mobileMode === "signup",
            data:
              mobileMode === "signup"
                ? {
                    full_name: fullName.trim(),
                    role: "customer",
                    phone_number: cleanMobile,
                  }
                : undefined,
          },
        });

      if (error) throw error;

      setOtpSent(true);
      setOtp("");
      setSuccessMessage(
        `OTP sent to +91 ${displayIndianPhone(
          cleanMobile
        )}.`
      );
    } catch (error) {
      console.error("Send mobile OTP error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to send OTP.";

      const lower = message.toLowerCase();

      if (
        lower.includes("signup") &&
        lower.includes("disabled")
      ) {
        setErrorMessage(
          "This mobile number is not registered. Choose Create Account."
        );
      } else if (
        lower.includes("sms") ||
        lower.includes("provider")
      ) {
        setErrorMessage(
          "Mobile OTP service is not configured yet. Please use Email Login for now."
        );
      } else if (
        lower.includes("rate") ||
        lower.includes("too many")
      ) {
        setErrorMessage(
          "Too many OTP requests. Please wait a little and try again."
        );
      } else {
        setErrorMessage(message);
      }
    } finally {
      setOtpSending(false);
    }
  }

  async function verifyMobileOtp(
    event?: FormEvent<HTMLFormElement>
  ) {
    event?.preventDefault();
    clearMessages();

    if (!validateMobile()) return;

    const cleanOtp = otp.replace(/\D/g, "");

    if (cleanOtp.length < 6) {
      setErrorMessage(
        "Please enter the 6-digit OTP."
      );
      return;
    }

    setOtpVerifying(true);

    try {
      const { data, error } =
        await supabase.auth.verifyOtp({
          phone: cleanMobile,
          token: cleanOtp,
          type: "sms",
        });

      if (error) throw error;

      if (!data.session || !data.user) {
        throw new Error(
          "Unable to create a secure customer session."
        );
      }

      if (
        mobileMode === "signup" &&
        fullName.trim().length >= 2
      ) {
        const { error: updateError } =
          await supabase.auth.updateUser({
            data: {
              full_name: fullName.trim(),
              role: "customer",
              phone_number: cleanMobile,
            },
          });

        if (updateError) {
          console.error(
            "Customer profile metadata update error:",
            updateError
          );
        }
      }

      setSuccessMessage(
        mobileMode === "signup"
          ? "Account created successfully. Opening NEW CITY STYLE..."
          : "Login successful. Opening NEW CITY STYLE..."
      );

      window.setTimeout(() => {
        window.location.replace("/");
      }, 500);
    } catch (error) {
      console.error(
        "Verify mobile OTP error:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unable to verify OTP.";

      const lower = message.toLowerCase();

      if (
        lower.includes("expired") ||
        lower.includes("invalid")
      ) {
        setErrorMessage(
          "OTP is invalid or expired. Please request a new OTP."
        );
      } else {
        setErrorMessage(message);
      }
    } finally {
      setOtpVerifying(false);
    }
  }

  async function handleEmailSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    clearMessages();

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanEmail) {
      setErrorMessage(
        "Please enter your email address."
      );
      return;
    }

    if (cleanEmail === ADMIN_EMAIL) {
      setErrorMessage(
        "This is the administrator email. Please use the Admin Login page."
      );
      return;
    }

    if (isSignup && cleanName.length < 2) {
      setErrorMessage("Please enter your full name.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage(
        "Password must contain at least 6 characters."
      );
      return;
    }

    if (
      isSignup &&
      password !== confirmPassword
    ) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      if (isSignup) {
        const { data, error } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                full_name: cleanName,
                role: "customer",
              },
            },
          });

        if (error) throw error;

        if (data.session && data.user) {
          setSuccessMessage(
            "Account created successfully. Opening NEW CITY STYLE..."
          );

          window.setTimeout(() => {
            window.location.replace("/");
          }, 700);
          return;
        }

        setSuccessMessage(
          "Account created. Please confirm your email, then login."
        );
        setIsSignup(false);
        setPassword("");
        setConfirmPassword("");
        return;
      }

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) throw error;

      if (!data.session || !data.user) {
        throw new Error(
          "Unable to create a secure customer session."
        );
      }

      setSuccessMessage(
        "Login successful. Opening NEW CITY STYLE..."
      );

      window.setTimeout(() => {
        window.location.replace("/");
      }, 500);
    } catch (error) {
      console.error(
        "Customer email authentication error:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unable to complete authentication.";

      const lowerMessage =
        message.toLowerCase();

      if (
        lowerMessage.includes(
          "invalid login credentials"
        )
      ) {
        setErrorMessage(
          "Incorrect email or password."
        );
      } else if (
        lowerMessage.includes(
          "email not confirmed"
        )
      ) {
        setErrorMessage(
          "Please confirm your email address before logging in."
        );
      } else if (
        lowerMessage.includes(
          "user already registered"
        )
      ) {
        setErrorMessage(
          "An account already exists with this email. Please login instead."
        );
      } else if (
        lowerMessage.includes("rate limit")
      ) {
        setErrorMessage(
          "Too many attempts. Please wait a few minutes and try again."
        );
      } else {
        setErrorMessage(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    clearMessages();

    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage(
        "Enter your email address first."
      );
      return;
    }

    if (cleanEmail === ADMIN_EMAIL) {
      setErrorMessage(
        "Use the Admin Login page to reset the administrator password."
      );
      return;
    }

    setSendingReset(true);

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo:
              typeof window !== "undefined"
                ? `${window.location.origin}/reset-password?account=customer`
                : undefined,
          }
        );

      if (error) throw error;

      setSuccessMessage(
        "Password reset email sent. Open the newest email to create a new password."
      );
    } catch (error) {
      console.error(
        "Customer reset password error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to send password reset email."
      );
    } finally {
      setSendingReset(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="loadingPage">
        <div className="loadingLogo">NCS</div>
        <div className="spinner" />
        <h2>Checking Your Account...</h2>

        <style jsx>{`
          .loadingPage {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 18px;
            background:
              radial-gradient(
                circle at 20% 15%,
                rgba(212, 175, 55, 0.18),
                transparent 28%
              ),
              linear-gradient(
                135deg,
                #03153f,
                #0a2e73 58%,
                #164ca8
              );
            color: white;
            font-family:
              Inter, Poppins, Arial, sans-serif;
          }

          .loadingLogo {
            width: 76px;
            height: 76px;
            border-radius: 50%;
            display: grid;
            place-items: center;
            background: #d4af37;
            color: #0a2e73;
            font-size: 24px;
            font-weight: 900;
          }

          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid
              rgba(255, 255, 255, 0.25);
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

  const busy =
    submitting ||
    sendingReset ||
    otpSending ||
    otpVerifying;

  return (
    <main className="page">
      <section className="authCard">
        <aside className="brandPanel">
          <div className="brandLogo">NCS</div>

          <div>
            <div className="eyebrow">
              NEW CITY STYLE
            </div>
            <h1>Style for Every Family</h1>
            <p className="brandText">
              Secure customer access for orders,
              wishlist, checkout and profile.
            </p>
          </div>

          <div className="featureList">
            <div>
              <span>✓</span>
              <p>
                <strong>Mobile OTP Login</strong>
                <small>
                  Fast sign-in using your phone.
                </small>
              </p>
            </div>

            <div>
              <span>✓</span>
              <p>
                <strong>No Password Needed</strong>
                <small>
                  OTP is enough for mobile login.
                </small>
              </p>
            </div>

            <div>
              <span>✓</span>
              <p>
                <strong>Email Login Preserved</strong>
                <small>
                  Existing customers can continue
                  using email and password.
                </small>
              </p>
            </div>
          </div>
        </aside>

        <section className="formPanel">
          <div className="formHeader">
            <div className="miniLabel">
              CUSTOMER ACCOUNT
            </div>
            <h2>
              {authMethod === "mobile"
                ? mobileMode === "signup"
                  ? "Create Account"
                  : "Welcome Back"
                : isSignup
                  ? "Create Account"
                  : "Welcome Back"}
            </h2>
            <p>
              {authMethod === "mobile"
                ? "Use your mobile number and OTP."
                : "Use your email and password."}
            </p>
          </div>

          <div className="methodTabs">
            <button
              type="button"
              className={
                authMethod === "mobile"
                  ? "methodTab active"
                  : "methodTab"
              }
              onClick={() =>
                switchAuthMethod("mobile")
              }
              disabled={busy}
            >
              📱 Mobile OTP
            </button>

            <button
              type="button"
              className={
                authMethod === "email"
                  ? "methodTab active"
                  : "methodTab"
              }
              onClick={() =>
                switchAuthMethod("email")
              }
              disabled={busy}
            >
              ✉ Email & Password
            </button>
          </div>

          {errorMessage && (
            <div className="message errorMessage">
              <strong>!</strong>
              <p>{errorMessage}</p>
            </div>
          )}

          {successMessage && (
            <div className="message successMessage">
              <strong>✓</strong>
              <p>{successMessage}</p>
            </div>
          )}

          {authMethod === "mobile" ? (
            <form
              className="form"
              onSubmit={verifyMobileOtp}
            >
              <div className="modeToggle">
                <button
                  type="button"
                  className={
                    mobileMode === "login"
                      ? "modeButton selected"
                      : "modeButton"
                  }
                  onClick={() =>
                    switchMobileMode("login")
                  }
                  disabled={busy}
                >
                  Login
                </button>

                <button
                  type="button"
                  className={
                    mobileMode === "signup"
                      ? "modeButton selected"
                      : "modeButton"
                  }
                  onClick={() =>
                    switchMobileMode("signup")
                  }
                  disabled={busy}
                >
                  Create Account
                </button>
              </div>

              {mobileMode === "signup" && (
                <>
                  <label htmlFor="mobile-name">
                    Full Name
                  </label>

                  <div className="inputWrap">
                    <span>👤</span>
                    <input
                      id="mobile-name"
                      type="text"
                      value={fullName}
                      onChange={(event) =>
                        setFullName(
                          event.target.value
                        )
                      }
                      placeholder="Enter your full name"
                      autoComplete="name"
                      disabled={busy}
                    />
                  </div>
                </>
              )}

              <label htmlFor="customer-mobile">
                Mobile Number
              </label>

              <div className="phoneWrap">
                <div className="countryCode">
                  +91
                </div>

                <input
                  id="customer-mobile"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={displayIndianPhone(
                    mobile
                  )}
                  onChange={(event) => {
                    const digits =
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10);

                    setMobile(digits);
                    setOtp("");
                    setOtpSent(false);
                    clearMessages();
                  }}
                  placeholder="10-digit mobile number"
                  autoComplete="tel"
                  disabled={busy}
                />
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  className="primaryButton"
                  onClick={sendMobileOtp}
                  disabled={busy}
                >
                  {otpSending
                    ? "Sending OTP..."
                    : mobileMode === "signup"
                      ? "Send OTP & Create Account"
                      : "Send Login OTP"}
                </button>
              ) : (
                <>
                  <label htmlFor="customer-otp">
                    Enter OTP
                  </label>

                  <div className="inputWrap otpWrap">
                    <span>🔐</span>
                    <input
                      id="customer-otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(event) =>
                        setOtp(
                          event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 6)
                        )
                      }
                      placeholder="6-digit OTP"
                      autoComplete="one-time-code"
                      disabled={busy}
                    />
                  </div>

                  <button
                    type="submit"
                    className="primaryButton"
                    disabled={busy}
                  >
                    {otpVerifying
                      ? "Verifying OTP..."
                      : mobileMode === "signup"
                        ? "Verify & Create Account"
                        : "Verify & Login"}
                  </button>

                  <div className="otpActions">
                    <button
                      type="button"
                      className="textButton"
                      onClick={sendMobileOtp}
                      disabled={busy}
                    >
                      Resend OTP
                    </button>

                    <button
                      type="button"
                      className="textButton"
                      onClick={() => {
                        setOtp("");
                        setOtpSent(false);
                        clearMessages();
                      }}
                      disabled={busy}
                    >
                      Change Number
                    </button>
                  </div>
                </>
              )}

              {mobileMode === "login" && (
                <button
                  type="button"
                  className="forgotButton"
                  onClick={() => {
                    clearMessages();
                    setSuccessMessage(
                      "No password needed. Enter your mobile number and use OTP to login."
                    );
                  }}
                  disabled={busy}
                >
                  Forgot Password? Login with OTP
                </button>
              )}
            </form>
          ) : (
            <form
              className="form"
              onSubmit={handleEmailSubmit}
            >
              {isSignup && (
                <>
                  <label htmlFor="customer-name">
                    Full Name
                  </label>

                  <div className="inputWrap">
                    <span>👤</span>
                    <input
                      id="customer-name"
                      type="text"
                      value={fullName}
                      onChange={(event) =>
                        setFullName(
                          event.target.value
                        )
                      }
                      placeholder="Enter your full name"
                      autoComplete="name"
                      disabled={busy}
                    />
                  </div>
                </>
              )}

              <label htmlFor="customer-email">
                Email Address
              </label>

              <div className="inputWrap">
                <span>✉</span>
                <input
                  id="customer-email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="Enter your email"
                  autoComplete="email"
                  disabled={busy}
                />
              </div>

              <label htmlFor="customer-password">
                Password
              </label>

              <div className="inputWrap passwordWrap">
                <span>🔒</span>
                <input
                  id="customer-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder="Minimum 6 characters"
                  autoComplete={
                    isSignup
                      ? "new-password"
                      : "current-password"
                  }
                  disabled={busy}
                />

                <button
                  type="button"
                  className="showPasswordButton"
                  onClick={() =>
                    setShowPassword(
                      (current) => !current
                    )
                  }
                  disabled={busy}
                >
                  {showPassword
                    ? "Hide"
                    : "Show"}
                </button>
              </div>

              {isSignup && (
                <>
                  <label htmlFor="confirm-password">
                    Confirm Password
                  </label>

                  <div className="inputWrap">
                    <span>🔑</span>
                    <input
                      id="confirm-password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(
                          event.target.value
                        )
                      }
                      placeholder="Enter password again"
                      autoComplete="new-password"
                      disabled={busy}
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                className="primaryButton"
                disabled={busy}
              >
                {submitting
                  ? isSignup
                    ? "Creating Account..."
                    : "Logging In..."
                  : isSignup
                    ? "Create Customer Account"
                    : "Login to My Account"}
              </button>

              {!isSignup && (
                <>
                  <button
                    type="button"
                    className="forgotButton"
                    onClick={
                      handleForgotPassword
                    }
                    disabled={busy}
                  >
                    {sendingReset
                      ? "Sending Reset Email..."
                      : "Forgot Password by Email?"}
                  </button>

                  <button
                    type="button"
                    className="mobileRecoveryButton"
                    onClick={() =>
                      switchAuthMethod("mobile")
                    }
                    disabled={busy}
                  >
                    📱 Forgot Password? Use Mobile OTP
                  </button>
                </>
              )}

              <button
                type="button"
                className="switchButton"
                onClick={switchEmailMode}
                disabled={busy}
              >
                {isSignup
                  ? "Already have an account? Login"
                  : "New customer? Create Account"}
              </button>
            </form>
          )}

          <button
            type="button"
            className="storeButton"
            onClick={() => router.push("/")}
            disabled={busy}
          >
            ← Return to Store
          </button>

          <div className="securityNote">
            🔐 Secure authentication powered by
            Supabase.
          </div>
        </section>
      </section>

      <footer>
        © 2026 NEW CITY STYLE. All Rights
        Reserved.
      </footer>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          font-family:
            Inter, Poppins, Arial, sans-serif;
        }

        button,
        input {
          font: inherit;
        }

        button {
          -webkit-tap-highlight-color:
            transparent;
        }

        .page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 35px 20px;
          background:
            radial-gradient(
              circle at 12% 14%,
              rgba(212, 175, 55, 0.2),
              transparent 27%
            ),
            radial-gradient(
              circle at 88% 82%,
              rgba(70, 130, 255, 0.28),
              transparent 29%
            ),
            linear-gradient(
              135deg,
              #03153f,
              #0a2e73 52%,
              #164ca8
            );
          color: #ffffff;
        }

        .authCard {
          width: 100%;
          max-width: 1060px;
          display: grid;
          grid-template-columns: 0.92fr 1.08fr;
          overflow: hidden;
          border:
            1px solid
            rgba(255, 255, 255, 0.2);
          border-radius: 28px;
          box-shadow:
            0 35px 90px
            rgba(2, 17, 48, 0.42);
          background: #ffffff;
        }

        .brandPanel {
          position: relative;
          display: flex;
          min-height: 620px;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 20% 10%,
              rgba(212, 175, 55, 0.24),
              transparent 26%
            ),
            linear-gradient(
              145deg,
              #061d4b,
              #0a2e73 60%,
              #123f91
            );
        }

        .brandPanel::after {
          content: "";
          position: absolute;
          width: 300px;
          height: 300px;
          right: -130px;
          bottom: -130px;
          border:
            42px solid
            rgba(212, 175, 55, 0.12);
          border-radius: 50%;
        }

        .brandLogo {
          position: relative;
          z-index: 1;
          width: 88px;
          height: 88px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border:
            3px solid
            rgba(255, 255, 255, 0.7);
          background: #d4af37;
          color: #0a2e73;
          font-size: 26px;
          font-weight: 950;
          letter-spacing: 1px;
          box-shadow:
            0 14px 40px
            rgba(0, 0, 0, 0.25);
        }

        .eyebrow {
          margin-top: 36px;
          color: #d4af37;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 3px;
        }

        .brandPanel h1 {
          margin: 10px 0 12px;
          font-size: clamp(
            34px,
            4vw,
            52px
          );
          line-height: 1.03;
        }

        .brandText {
          max-width: 390px;
          margin: 0;
          color:
            rgba(255, 255, 255, 0.82);
          line-height: 1.75;
        }

        .featureList {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 14px;
        }

        .featureList > div {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 14px 16px;
          border:
            1px solid
            rgba(255, 255, 255, 0.13);
          border-radius: 16px;
          background:
            rgba(255, 255, 255, 0.07);
          backdrop-filter: blur(8px);
        }

        .featureList span {
          color: #d4af37;
          font-weight: 950;
        }

        .featureList p {
          display: grid;
          gap: 3px;
          margin: 0;
        }

        .featureList strong {
          font-size: 14px;
        }

        .featureList small {
          color:
            rgba(255, 255, 255, 0.68);
          line-height: 1.4;
        }

        .formPanel {
          padding: 44px 46px 38px;
          color: #2c2c2c;
          background:
            linear-gradient(
              180deg,
              #ffffff,
              #fbfcff
            );
        }

        .formHeader {
          margin-bottom: 20px;
        }

        .miniLabel {
          color: #0a2e73;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 2px;
        }

        .formHeader h2 {
          margin: 7px 0 4px;
          color: #092a68;
          font-size: 32px;
        }

        .formHeader p {
          margin: 0;
          color: #6d7484;
        }

        .methodTabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 6px;
          margin-bottom: 20px;
          border-radius: 16px;
          background: #f1f4fa;
        }

        .methodTab {
          min-height: 46px;
          border: 0;
          border-radius: 12px;
          background: transparent;
          color: #566074;
          font-weight: 900;
          cursor: pointer;
          transition:
            transform 0.16s ease,
            background 0.16s ease,
            color 0.16s ease;
        }

        .methodTab.active {
          background: #0a2e73;
          color: white;
          box-shadow:
            0 8px 22px
            rgba(10, 46, 115, 0.22);
        }

        .methodTab:not(:disabled):hover {
          transform: translateY(-1px);
        }

        .modeToggle {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 16px;
        }

        .modeButton {
          min-height: 40px;
          border:
            1px solid #dde3ef;
          border-radius: 12px;
          background: white;
          color: #687285;
          font-weight: 850;
          cursor: pointer;
        }

        .modeButton.selected {
          border-color:
            rgba(212, 175, 55, 0.65);
          background:
            rgba(212, 175, 55, 0.12);
          color: #0a2e73;
        }

        .form {
          display: grid;
          gap: 10px;
        }

        label {
          margin-top: 2px;
          color: #273044;
          font-size: 13px;
          font-weight: 850;
        }

        .inputWrap {
          min-height: 52px;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 14px;
          border:
            1px solid #dce2ed;
          border-radius: 14px;
          background: #ffffff;
          transition:
            border-color 0.16s ease,
            box-shadow 0.16s ease;
        }

        .inputWrap:focus-within,
        .phoneWrap:focus-within {
          border-color: #0a2e73;
          box-shadow:
            0 0 0 3px
            rgba(10, 46, 115, 0.1);
        }

        .inputWrap input,
        .phoneWrap input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #202839;
        }

        .inputWrap input::placeholder,
        .phoneWrap input::placeholder {
          color: #a0a8b7;
        }

        .phoneWrap {
          min-height: 54px;
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          overflow: hidden;
          border:
            1px solid #dce2ed;
          border-radius: 14px;
          background: white;
        }

        .countryCode {
          height: 100%;
          display: flex;
          align-items: center;
          padding: 0 15px;
          border-right:
            1px solid #e3e7ef;
          background: #f7f9fd;
          color: #0a2e73;
          font-weight: 900;
        }

        .phoneWrap input {
          height: 52px;
          padding: 0 14px;
        }

        .otpWrap input {
          letter-spacing: 8px;
          font-size: 21px;
          font-weight: 900;
        }

        .passwordWrap {
          padding-right: 7px;
        }

        .showPasswordButton {
          border: 0;
          border-radius: 10px;
          padding: 9px 11px;
          background: #eef2fa;
          color: #0a2e73;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .primaryButton {
          width: 100%;
          min-height: 52px;
          margin-top: 8px;
          border: 0;
          border-radius: 14px;
          background:
            linear-gradient(
              135deg,
              #0a2e73,
              #144da8
            );
          color: white;
          font-weight: 950;
          cursor: pointer;
          box-shadow:
            0 14px 28px
            rgba(10, 46, 115, 0.2);
        }

        .primaryButton:not(:disabled):hover {
          transform: translateY(-1px);
        }

        .otpActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .textButton,
        .forgotButton,
        .mobileRecoveryButton,
        .switchButton,
        .storeButton {
          width: 100%;
          min-height: 42px;
          border-radius: 12px;
          font-weight: 850;
          cursor: pointer;
        }

        .textButton {
          border:
            1px solid #dce2ed;
          background: #ffffff;
          color: #0a2e73;
        }

        .forgotButton {
          margin-top: 3px;
          border: 0;
          background: transparent;
          color: #8b6914;
        }

        .mobileRecoveryButton {
          border:
            1px solid
            rgba(10, 46, 115, 0.16);
          background: #f5f8ff;
          color: #0a2e73;
        }

        .switchButton {
          border:
            1px solid
            rgba(212, 175, 55, 0.55);
          background:
            rgba(212, 175, 55, 0.09);
          color: #705510;
        }

        .storeButton {
          margin-top: 12px;
          border:
            1px solid #dce2ed;
          background: white;
          color: #4c5668;
        }

        .message {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin: 0 0 14px;
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.5;
        }

        .message p {
          margin: 0;
        }

        .errorMessage {
          border:
            1px solid
            rgba(190, 36, 36, 0.18);
          background: #fff2f2;
          color: #9c2222;
        }

        .successMessage {
          border:
            1px solid
            rgba(17, 131, 82, 0.2);
          background: #effaf5;
          color: #126f4a;
        }

        .securityNote {
          margin-top: 14px;
          padding: 11px 13px;
          border-radius: 12px;
          background: #f5f7fb;
          color: #667084;
          font-size: 12px;
          text-align: center;
        }

        button:disabled,
        input:disabled {
          cursor: not-allowed;
          opacity: 0.62;
        }

        footer {
          margin-top: 18px;
          color:
            rgba(255, 255, 255, 0.72);
          font-size: 12px;
        }

        @media (max-width: 820px) {
          .page {
            padding: 18px 12px;
          }

          .authCard {
            grid-template-columns: 1fr;
            max-width: 560px;
            border-radius: 22px;
          }

          .brandPanel {
            min-height: auto;
            padding: 28px;
            gap: 22px;
          }

          .brandLogo {
            width: 68px;
            height: 68px;
            font-size: 21px;
          }

          .brandPanel h1 {
            font-size: 32px;
          }

          .featureList {
            display: none;
          }

          .formPanel {
            padding: 30px 22px 26px;
          }

          .formHeader h2 {
            font-size: 27px;
          }
        }

        @media (max-width: 440px) {
          .methodTabs {
            grid-template-columns: 1fr;
          }

          .otpActions {
            grid-template-columns: 1fr;
          }

          .formPanel {
            padding:
              26px 16px 22px;
          }

          .brandPanel {
            padding: 22px 20px;
          }
        }
      `}</style>
    </main>
  );
}