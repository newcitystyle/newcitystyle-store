"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "badri.nsv@gmail.com";

export default function CustomerLoginPage() {
  const router = useRouter();

  const [isSignup, setIsSignup] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    checkExistingSession();
  }, []);

  async function checkExistingSession() {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Session check error:", error.message);
      }

      if (!session?.user) {
        setCheckingSession(false);
        return;
      }

      const loggedInEmail =
        session.user.email?.trim().toLowerCase() || "";

      if (loggedInEmail === ADMIN_EMAIL) {
        window.location.href = "/admin";
        return;
      }

      window.location.href = "/";
    } catch (error) {
      console.error("Customer session error:", error);
      setCheckingSession(false);
    }
  }

  function clearMessages() {
    setErrorMessage("");
    setSuccessMessage("");
  }

  function changeMode() {
    clearMessages();

    setIsSignup((current) => !current);
    setPassword("");
    setConfirmPassword("");
  }

  function validateForm() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return null;
    }

    if (cleanEmail === ADMIN_EMAIL) {
      setErrorMessage(
        "This is the Admin email. Please use the Admin Login page."
      );
      return null;
    }

    if (isSignup && cleanName.length < 2) {
      setErrorMessage("Please enter your full name.");
      return null;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return null;
    }

    if (password.length < 6) {
      setErrorMessage(
        "Password must contain at least 6 characters."
      );
      return null;
    }

    if (isSignup && password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return null;
    }

    return {
      cleanEmail,
      cleanName,
    };
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    clearMessages();

    const validated = validateForm();

    if (!validated) return;

    const { cleanEmail, cleanName } = validated;

    setSubmitting(true);

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
              role: "customer",
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data.session && data.user) {
          setSuccessMessage(
            "Account created successfully. Opening Home Page..."
          );

          window.setTimeout(() => {
            window.location.href = "/";
          }, 700);

          return;
        }

        setSuccessMessage(
          "Account created successfully. Please check your email and confirm your account."
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

      if (error) {
        throw error;
      }

      if (!data.user || !data.session) {
        throw new Error(
          "Unable to create a secure customer session."
        );
      }

      const loggedInEmail =
        data.user.email?.trim().toLowerCase() || "";

      if (loggedInEmail === ADMIN_EMAIL) {
        await supabase.auth.signOut({
          scope: "local",
        });

        throw new Error(
          "Please use the Admin Login page for this account."
        );
      }

      setSuccessMessage(
        "Login successful. Opening Home Page..."
      );

      window.setTimeout(() => {
        window.location.href = "/";
      }, 500);
    } catch (error) {
      console.error("Customer login error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to complete login.";

      const lowerMessage = message.toLowerCase();

      if (
        lowerMessage.includes("invalid login credentials")
      ) {
        setErrorMessage(
          "Incorrect email or password. Please check and try again."
        );
      } else if (
        lowerMessage.includes("email not confirmed")
      ) {
        setErrorMessage(
          "Please confirm your email before logging in."
        );
      } else if (
        lowerMessage.includes("user already registered")
      ) {
        setErrorMessage(
          "An account already exists with this email. Please login instead."
        );
      } else if (
        lowerMessage.includes("rate limit")
      ) {
        setErrorMessage(
          "Too many attempts. Please wait and try again."
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

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage(
        "Please enter your email address first."
      );
      return;
    }

    if (cleanEmail === ADMIN_EMAIL) {
      setErrorMessage(
        "Please use Admin Login to reset the Admin password."
      );
      return;
    }

    setSendingReset(true);

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo: `${window.location.origin}/reset-password?account=customer`,
          }
        );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "Password reset email sent. Open the newest email to create a new password."
      );
    } catch (error) {
      console.error("Password reset error:", error);

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
            padding: 20px;
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

          .spinner {
            width: 44px;
            height: 44px;
            margin-top: 24px;
            border: 4px solid rgba(255, 255, 255, 0.2);
            border-top-color: #d4af37;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          h2 {
            margin-top: 18px;
            font-size: 19px;
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
      <div className="glow glowOne" />
      <div className="glow glowTwo" />

      <section className="loginCard">
        <div className="brandPanel">
          <div className="brandLogo">NCS</div>

          <p className="eyebrow">NEW CITY STYLE</p>

          <h1>
            {isSignup
              ? "Join Our Fashion Family"
              : "Welcome Back"}
          </h1>

          <p className="brandDescription">
            Login to save your wishlist, manage orders and
            enjoy a faster shopping experience.
          </p>

          <div className="features">
            <div>
              <span>✓</span>
              Secure customer account
            </div>

            <div>
              <span>✓</span>
              Saved wishlist and orders
            </div>

            <div>
              <span>✓</span>
              Faster and easier checkout
            </div>
          </div>
        </div>

        <form
          className="formPanel"
          onSubmit={handleSubmit}
        >
          <div className="formHeading">
            <span>
              {isSignup
                ? "CREATE CUSTOMER ACCOUNT"
                : "CUSTOMER LOGIN"}
            </span>

            <h2>
              {isSignup ? "Create Account" : "Login"}
            </h2>

            <p>
              {isSignup
                ? "Enter your details to create your NEW CITY STYLE account."
                : "Login using your registered email and password."}
            </p>
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

          {isSignup && (
            <>
              <label htmlFor="full-name">
                Full Name
              </label>

              <div className="inputWrap">
                <span>👤</span>

                <input
                  id="full-name"
                  type="text"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  placeholder="Enter your full name"
                  autoComplete="name"
                  disabled={submitting}
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
              placeholder="Enter your email address"
              autoComplete="email"
              disabled={submitting}
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
                showPassword ? "text" : "password"
              }
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Minimum 6 characters"
              autoComplete={
                isSignup
                  ? "new-password"
                  : "current-password"
              }
              disabled={submitting}
            />

            <button
              type="button"
              className="showPasswordButton"
              onClick={() =>
                setShowPassword((current) => !current)
              }
              disabled={submitting}
            >
              {showPassword ? "Hide" : "Show"}
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
                    showPassword ? "text" : "password"
                  }
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  placeholder="Enter password again"
                  autoComplete="new-password"
                  disabled={submitting}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="loginButton"
            disabled={
              submitting || sendingReset
            }
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
            <button
              type="button"
              className="forgotButton"
              onClick={handleForgotPassword}
              disabled={
                submitting || sendingReset
              }
            >
              {sendingReset
                ? "Sending Reset Email..."
                : "Forgot Password?"}
            </button>
          )}

          <button
            type="button"
            className="switchButton"
            onClick={changeMode}
            disabled={
              submitting || sendingReset
            }
          >
            {isSignup
              ? "Already have an account? Login"
              : "New customer? Create Account"}
          </button>

          <button
            type="button"
            className="storeButton"
            onClick={() => {
              window.location.href = "/";
            }}
            disabled={
              submitting || sendingReset
            }
          >
            ← Return to Store
          </button>

          <div className="securityNote">
            🔐 Your account is securely protected by
            Supabase Authentication.
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
          position: relative;
          overflow: hidden;
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

        .loginCard {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 1040px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          overflow: hidden;
          border: 1px solid
            rgba(255, 255, 255, 0.2);
          border-radius: 28px;
          box-shadow:
            0 35px 90px
            rgba(2, 17, 48, 0.42);
        }

        .brandPanel {
          min-height: 650px;
          display: flex;
          flex-direction: column;
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

        .brandPanel h1 {
          margin: 0;
          font-size: clamp(
            40px,
            5vw,
            58px
          );
          line-height: 1.08;
        }

        .brandDescription {
          max-width: 420px;
          margin: 21px 0 0;
          color: rgba(
            255,
            255,
            255,
            0.72
          );
          font-size: 15px;
          line-height: 1.8;
        }

        .features {
          display: grid;
          gap: 12px;
          margin-top: 34px;
          color: rgba(
            255,
            255,
            255,
            0.85
          );
          font-size: 13px;
          font-weight: 700;
        }

        .features div {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .features span {
          color: #d4af37;
        }

        .formPanel {
          min-height: 650px;
          padding: 50px;
          background: #ffffff;
          color: #172033;
        }

        .formHeading > span {
          color: #d4af37;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .formHeading h2 {
          margin: 8px 0 0;
          color: #0a2e73;
          font-size: 32px;
        }

        .formHeading p {
          margin: 10px 0 0;
          color: #667085;
          font-size: 14px;
          line-height: 1.6;
        }

        .message {
          display: flex;
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
          flex-shrink: 0;
          border-radius: 50%;
          color: #ffffff;
        }

        .message p {
          margin: 3px 0 0;
          line-height: 1.5;
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

        .formPanel label {
          display: block;
          margin-top: 20px;
          margin-bottom: 8px;
          color: #344054;
          font-size: 12px;
          font-weight: 800;
        }

        .inputWrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .inputWrap > span {
          position: absolute;
          left: 15px;
          z-index: 2;
          pointer-events: none;
        }

        .inputWrap input {
          width: 100%;
          height: 51px;
          padding: 0 15px 0 45px;
          border: 1px solid #d0d5dd;
          border-radius: 12px;
          outline: none;
          color: #172033;
          font-size: 14px;
        }

        .inputWrap input:focus {
          border-color: #0a2e73;
          box-shadow:
            0 0 0 4px
            rgba(10, 46, 115, 0.09);
        }

        .passwordWrap input {
          padding-right: 75px;
        }

        .showPasswordButton {
          position: absolute;
          right: 12px;
          border: 0;
          background: transparent;
          color: #0a2e73;
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
        }

        .loginButton,
        .forgotButton,
        .switchButton,
        .storeButton {
          width: 100%;
          min-height: 47px;
          border-radius: 11px;
          font-size: 12px;
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
          margin-top: 10px;
          border: 1px solid #d4af37;
          background: #fff8e4;
          color: #0a2e73;
        }

        .switchButton {
          margin-top: 10px;
          border: 1px solid #0a2e73;
          background: #ffffff;
          color: #0a2e73;
        }

        .storeButton {
          margin-top: 10px;
          border: 1px solid #d0d5dd;
          background: #ffffff;
          color: #475467;
        }

        button:disabled,
        input:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .securityNote {
          margin-top: 20px;
          padding-top: 18px;
          border-top:
            1px solid #eaecf0;
          color: #98a2b3;
          font-size: 10px;
          line-height: 1.6;
        }

        footer {
          margin-top: 22px;
          color: rgba(
            255,
            255,
            255,
            0.55
          );
          font-size: 10px;
        }

        .glow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .glowOne {
          top: 8%;
          left: 5%;
          width: 180px;
          height: 180px;
          background: rgba(
            212,
            175,
            55,
            0.2
          );
        }

        .glowTwo {
          right: 5%;
          bottom: 8%;
          width: 230px;
          height: 230px;
          background: rgba(
            68,
            125,
            255,
            0.25
          );
        }

        @media (max-width: 850px) {
          .loginCard {
            max-width: 590px;
            grid-template-columns: 1fr;
          }

          .brandPanel,
          .formPanel {
            min-height: auto;
            padding: 38px;
          }

          .features {
            display: none;
          }
        }

        @media (max-width: 520px) {
          .page {
            justify-content: flex-start;
            padding: 15px 9px 28px;
          }

          .loginCard {
            border-radius: 20px;
          }

          .brandPanel,
          .formPanel {
            padding: 28px 21px;
          }

          .brandPanel h1 {
            font-size: 35px;
          }

          .formHeading h2 {
            font-size: 27px;
          }
        }
      `}</style>
    </main>
  );
}