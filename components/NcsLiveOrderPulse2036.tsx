"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type PulseState =
  | "unsupported"
  | "signed_out"
  | "blocked"
  | "idle"
  | "enabling"
  | "enabled"
  | "error";

function base64UrlToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase();

  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/windows/.test(ua)) return "windows";
  if (/mac os/.test(ua)) return "mac";
  return "web";
}

export default function NcsLiveOrderPulse2036() {
  const [state, setState] = useState<PulseState>("idle");
  const [detail, setDetail] = useState("");

  const publicKey =
    process.env.NEXT_PUBLIC_NCS_VAPID_PUBLIC_KEY?.trim() || "";

  const canUsePush = useMemo(
    () =>
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window,
    []
  );

  useEffect(() => {
    void inspectCurrentState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function inspectCurrentState() {
    if (!canUsePush || !publicKey) {
      setState("unsupported");
      setDetail("Live browser push is not available on this device yet.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setState("signed_out");
      setDetail("Sign in to attach Live Order Pulse to your account.");
      return;
    }

    if (Notification.permission === "denied") {
      setState("blocked");
      setDetail("Notifications are blocked in browser settings.");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription =
      await registration.pushManager.getSubscription();

    if (subscription) {
      await persistSubscription(subscription, user.id);
      setState("enabled");
      setDetail("Live Order Pulse is active on this device.");
      return;
    }

    setState("idle");
    setDetail("Enable one living notification for order progress.");
  }

  async function persistSubscription(
    subscription: PushSubscription,
    userId: string
  ) {
    const raw = subscription.toJSON();

    const endpoint = raw.endpoint || subscription.endpoint;
    const p256dh = raw.keys?.p256dh || "";
    const auth = raw.keys?.auth || "";

    if (!endpoint || !p256dh || !auth) {
      throw new Error("Push subscription keys are incomplete.");
    }

    const { error } = await supabase
      .from("customer_push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
          platform: detectPlatform(),
          is_active: true,
          last_seen_at: new Date().toISOString(),
          last_error: null,
        },
        {
          onConflict: "endpoint",
        }
      );

    if (error) throw error;
  }

  async function enablePulse() {
    if (!canUsePush || !publicKey) {
      setState("unsupported");
      return;
    }

    setState("enabling");
    setDetail("Connecting this device to NEW CITY STYLE…");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setState("signed_out");
        setDetail("Please sign in first, then enable Live Order Pulse.");
        return;
      }

      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "idle");
        setDetail(
          permission === "denied"
            ? "Notifications are blocked in browser settings."
            : "Notification permission was not granted."
        );
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              base64UrlToUint8Array(publicKey),
          });
      }

      await persistSubscription(subscription, user.id);

      setState("enabled");
      setDetail(
        "Live Order Pulse is active. Confirmed → Packed → Shipped → Delivered will evolve on this device."
      );
    } catch (error) {
      console.error("NCS Live Order Pulse enable error:", error);
      setState("error");
      setDetail(
        error instanceof Error
          ? error.message
          : "Unable to enable Live Order Pulse."
      );
    }
  }

  if (state === "signed_out") {
    return (
      <div className="ncsPulse ncsPulseMuted">
        <div className="ncsPulseOrb" />
        <div>
          <strong>LIVE ORDER PULSE</strong>
          <p>{detail}</p>
        </div>

        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <section className="ncsPulse">
      <div className="ncsPulseTop">
        <div className="ncsPulseIdentity">
          <div
            className={`ncsPulseOrb ${
              state === "enabled" ? "active" : ""
            }`}
          />
          <div>
            <span className="eyebrow">NCS • LIVE COMMERCE SIGNAL</span>
            <h3>Live Order Pulse</h3>
          </div>
        </div>

        <span className={`state state-${state}`}>
          {state === "enabled"
            ? "LIVE"
            : state === "enabling"
              ? "CONNECTING"
              : state === "blocked"
                ? "BLOCKED"
                : "READY"}
        </span>
      </div>

      <p className="detail">{detail}</p>

      {state !== "enabled" &&
        state !== "unsupported" &&
        state !== "blocked" && (
          <button
            type="button"
            onClick={enablePulse}
            disabled={state === "enabling"}
          >
            {state === "enabling"
              ? "CONNECTING DEVICE…"
              : "ENABLE LIVE ORDER PULSE"}
          </button>
        )}

      {state === "blocked" && (
        <p className="hint">
          Browser site settingsలో Notificationsని Allow చేసి page reload చేయండి.
        </p>
      )}

      <style jsx>{styles}</style>
    </section>
  );
}

const styles = `
  .ncsPulse {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(99, 255, 218, .22);
    border-radius: 24px;
    padding: 18px;
    background:
      radial-gradient(circle at 12% 0%, rgba(31,255,210,.15), transparent 34%),
      linear-gradient(145deg, rgba(3,17,31,.97), rgba(4,32,41,.96));
    box-shadow:
      0 24px 80px rgba(0,0,0,.34),
      inset 0 1px rgba(255,255,255,.06);
    color: #f5fffd;
  }

  .ncsPulse::after {
    content: "";
    position: absolute;
    width: 180px;
    height: 180px;
    right: -92px;
    bottom: -110px;
    border-radius: 50%;
    background: rgba(47,255,213,.08);
    filter: blur(2px);
  }

  .ncsPulseMuted {
    display: flex;
    gap: 13px;
    align-items: center;
  }

  .ncsPulseTop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .ncsPulseIdentity {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .ncsPulseOrb {
    width: 13px;
    height: 13px;
    flex: 0 0 13px;
    border-radius: 50%;
    background: #78908b;
    box-shadow: 0 0 0 7px rgba(120,144,139,.08);
  }

  .ncsPulseOrb.active {
    background: #4dffd7;
    box-shadow:
      0 0 0 7px rgba(77,255,215,.08),
      0 0 26px rgba(77,255,215,.8);
    animation: breathe 1.9s ease-in-out infinite;
  }

  @keyframes breathe {
    50% { transform: scale(.78); opacity: .65; }
  }

  .eyebrow {
    display: block;
    color: rgba(183,255,239,.58);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .16em;
  }

  h3 {
    margin: 4px 0 0;
    font-size: 19px;
    letter-spacing: -.02em;
  }

  .state {
    position: relative;
    z-index: 1;
    padding: 7px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,.11);
    background: rgba(255,255,255,.04);
    color: rgba(255,255,255,.72);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .12em;
  }

  .state-enabled {
    color: #4dffd7;
    border-color: rgba(77,255,215,.34);
    background: rgba(77,255,215,.08);
  }

  .state-blocked,
  .state-error {
    color: #ff9d9d;
    border-color: rgba(255,100,100,.25);
  }

  .detail {
    position: relative;
    z-index: 1;
    margin: 15px 0 0;
    color: rgba(240,255,252,.73);
    font-size: 13px;
    line-height: 1.6;
  }

  button {
    position: relative;
    z-index: 1;
    width: 100%;
    margin-top: 15px;
    border: 0;
    border-radius: 14px;
    padding: 13px 14px;
    background: linear-gradient(90deg, #43f0ca, #81ffdd);
    color: #02251f;
    cursor: pointer;
    font-size: 12px;
    font-weight: 950;
    letter-spacing: .07em;
    box-shadow: 0 10px 32px rgba(64,255,211,.14);
  }

  button:disabled {
    opacity: .58;
    cursor: progress;
  }

  .hint {
    margin-bottom: 0;
    color: rgba(255,255,255,.55);
    font-size: 11px;
  }
`;
