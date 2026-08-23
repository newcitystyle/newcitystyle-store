"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type FestivalCampaignRow = {
  id: number | string;
  festival_key: string;
  festival_name: string;
  festival_date: string;
  greeting_title: string;
  greeting_message?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  image_url?: string | null;
  cta_text?: string | null;
  cta_url?: string | null;
  pre_days?: number | string | null;
  post_days?: number | string | null;
  priority?: number | string | null;
  is_enabled?: boolean | null;
};

type ActiveFestival = FestivalCampaignRow & {
  distanceDays: number;
  isFestivalDay: boolean;
};

const DEFAULT_PRIMARY = "#0A2E73";
const DEFAULT_SECONDARY = "#D4AF37";

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function validHex(value: string | null | undefined, fallback: string) {
  const text = String(value || "").trim();
  return /^#[0-9A-Fa-f]{6}$/.test(text) ? text : fallback;
}

function isoDayToIndex(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) return Number.NaN;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function getIndiaDateIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function festivalIcon(name: string, key: string) {
  const text = `${name} ${key}`.toLowerCase();

  if (text.includes("sankranti")) return "🪁";
  if (text.includes("ugadi")) return "🌿";
  if (text.includes("diwali")) return "🪔";
  if (text.includes("dussehra") || text.includes("dashami")) return "✨";
  if (text.includes("vinayaka") || text.includes("ganesh")) return "🌺";
  if (text.includes("janmashtami") || text.includes("krishna")) return "🦚";
  if (text.includes("shivaratri")) return "🔱";
  if (text.includes("holi")) return "🎨";
  if (text.includes("eid")) return "🌙";
  if (text.includes("christmas")) return "🎄";
  if (text.includes("republic") || text.includes("independence")) return "🇮🇳";
  if (text.includes("gandhi")) return "🕊️";
  if (text.includes("new year")) return "🎉";
  if (text.includes("good friday")) return "🕊️";

  return "✦";
}

function festivalMotifs(name: string, key: string) {
  const text = `${name} ${key}`.toLowerCase();

  if (text.includes("sankranti")) {
    return ["🪁", "🌾", "☀️"];
  }

  if (text.includes("ugadi")) {
    return ["🌿", "🥭", "🌼"];
  }

  if (text.includes("diwali")) {
    return ["🪔", "✨", "🪔"];
  }

  if (text.includes("dussehra") || text.includes("dashami")) {
    return ["🌺", "✨", "🏹"];
  }

  if (text.includes("vinayaka") || text.includes("ganesh")) {
    return ["🌺", "🪔", "🌿"];
  }

  if (text.includes("janmashtami") || text.includes("krishna")) {
    return ["🦚", "🪈", "🌼"];
  }

  if (text.includes("shivaratri")) {
    return ["🔱", "🌙", "🪔"];
  }

  if (text.includes("holi")) {
    return ["🎨", "🌈", "✨"];
  }

  if (text.includes("eid")) {
    return ["🌙", "⭐", "✨"];
  }

  if (text.includes("christmas")) {
    return ["🎄", "⭐", "🎁"];
  }

  if (text.includes("republic") || text.includes("independence")) {
    return ["🟧", "⚪", "🟩"];
  }

  if (text.includes("gandhi")) {
    return ["🕊️", "🌿", "✦"];
  }

  if (text.includes("new year")) {
    return ["🎉", "✨", "🎊"];
  }

  if (text.includes("good friday")) {
    return ["🕊️", "✦", "🌿"];
  }

  return ["✦", "◇", "✦"];
}

function getPhaseLabel(item: ActiveFestival) {
  if (item.isFestivalDay) return "TODAY • CELEBRATION";

  if (item.distanceDays > 0) {
    return item.distanceDays === 1
      ? "TOMORROW • FESTIVE EDIT"
      : `${item.distanceDays} DAYS TO GO • FESTIVE EDIT`;
  }

  return "FESTIVE MOMENTS • NEW CITY STYLE";
}

export default function FestivalGreeting() {
  const router = useRouter();

  const [campaign, setCampaign] = useState<ActiveFestival | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadFestivalGreeting();
  }, []);

  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  async function loadFestivalGreeting() {
    setLoading(true);

    try {
      const todayIso = getIndiaDateIso();
      const todayIndex = isoDayToIndex(todayIso);

      const { data, error } = await supabase
        .from("festival_campaigns")
        .select(
          [
            "id",
            "festival_key",
            "festival_name",
            "festival_date",
            "greeting_title",
            "greeting_message",
            "primary_color",
            "secondary_color",
            "image_url",
            "cta_text",
            "cta_url",
            "pre_days",
            "post_days",
            "priority",
            "is_enabled",
          ].join(",")
        )
        .eq("is_enabled", true)
        .order("priority", { ascending: false })
        .order("festival_date", { ascending: true });

      if (error) throw error;

      const campaignRows =
        (data ?? []) as unknown as FestivalCampaignRow[];

      const active = campaignRows
        .map((item): ActiveFestival | null => {
          const festivalIndex = isoDayToIndex(item.festival_date);

          if (!Number.isFinite(festivalIndex)) return null;

          const preDays = Math.max(0, safeNumber(item.pre_days));
          const postDays = Math.max(0, safeNumber(item.post_days));

          const start = festivalIndex - preDays;
          const end = festivalIndex + postDays;

          if (todayIndex < start || todayIndex > end) return null;

          return {
            ...item,
            distanceDays: festivalIndex - todayIndex,
            isFestivalDay: festivalIndex === todayIndex,
          };
        })
        .filter((item): item is ActiveFestival => Boolean(item))
        .sort((a, b) => {
          if (a.isFestivalDay !== b.isFestivalDay) {
            return a.isFestivalDay ? -1 : 1;
          }

          const priorityDiff =
            safeNumber(b.priority) - safeNumber(a.priority);

          if (priorityDiff !== 0) return priorityDiff;

          return Math.abs(a.distanceDays) - Math.abs(b.distanceDays);
        });

      const selected = active[0] || null;

      if (!selected) {
        setCampaign(null);
        setVisible(false);
        return;
      }

      const seenKey = `ncs-festival-seen:${selected.festival_key}:${todayIso}`;

      try {
        if (window.localStorage.getItem(seenKey) === "1") {
          setCampaign(selected);
          setVisible(false);
          return;
        }
      } catch {
        // Local storage is optional. The greeting can still work without it.
      }

      setCampaign(selected);
      setVisible(true);
    } catch (error) {
      console.error("Festival greeting load error:", error);
      setCampaign(null);
      setVisible(false);
    } finally {
      setLoading(false);
    }
  }

  const primary = useMemo(
    () => validHex(campaign?.primary_color, DEFAULT_PRIMARY),
    [campaign?.primary_color]
  );

  const secondary = useMemo(
    () => validHex(campaign?.secondary_color, DEFAULT_SECONDARY),
    [campaign?.secondary_color]
  );

  function rememberSeen() {
    if (!campaign) return;

    const todayIso = getIndiaDateIso();
    const seenKey = `ncs-festival-seen:${campaign.festival_key}:${todayIso}`;

    try {
      window.localStorage.setItem(seenKey, "1");
    } catch {
      // Ignore storage errors.
    }
  }

  function closeGreeting() {
    rememberSeen();
    setVisible(false);
  }

  function openCampaign() {
    if (!campaign) return;

    rememberSeen();
    setVisible(false);

    const route = campaign.cta_url?.trim() || "/search";

    if (/^https?:\/\//i.test(route)) {
      window.location.href = route;
      return;
    }

    router.push(route.startsWith("/") ? route : `/${route}`);
  }

  if (loading || !campaign || !visible) {
    return null;
  }

  const icon = festivalIcon(
    campaign.festival_name,
    campaign.festival_key
  );

  const motifs = festivalMotifs(
    campaign.festival_name,
    campaign.festival_key
  );

  const phaseLabel = getPhaseLabel(campaign);

  return (
    <div
      className="festivalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="festivalGreetingTitle"
      style={
        {
          "--festival-primary": primary,
          "--festival-secondary": secondary,
        } as React.CSSProperties
      }
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeGreeting();
        }
      }}
    >
      <section className="festivalCard">
        <div className="festivalAura auraOne" />
        <div className="festivalAura auraTwo" />
        <div className="festivalSpark sparkOne">✦</div>
        <div className="festivalSpark sparkTwo">✧</div>
        <div className="festivalSpark sparkThree">✦</div>

        <button
          type="button"
          className="closeButton"
          onClick={closeGreeting}
          aria-label="Close festival greeting"
        >
          ×
        </button>

        {campaign.image_url?.trim() ? (
          <div className="festivalImageWrap">
            <img
              src={campaign.image_url.trim()}
              alt={campaign.festival_name}
            />
            <div className="festivalImageOverlay" />
          </div>
        ) : (
          <div className="festivalVisual">
            <div className="festivalTopOrnament">
              <span>{motifs[0]}</span>
              <i />
              <span>{motifs[1]}</span>
              <i />
              <span>{motifs[2]}</span>
            </div>

            <div className="festivalHalo haloOuter" />
            <div className="festivalHalo haloMiddle" />

            <div className="festivalIconRing">
              <div className="festivalIcon">{icon}</div>
            </div>

            <div className="festivalMotif motifLeft">{motifs[0]}</div>
            <div className="festivalMotif motifRight">{motifs[2]}</div>

            <div className="festivalVisualCaption">
              <small>CELEBRATING</small>
              <strong>{campaign.festival_name}</strong>
            </div>

            <div className="miniBrand">NCS</div>
          </div>
        )}

        <div className="festivalContent">
          <div className="phasePill">
            <span />
            {phaseLabel}
            <span />
          </div>

          <p className="brandLine">NEW CITY STYLE</p>

          <h2 id="festivalGreetingTitle">
            {campaign.greeting_title}
          </h2>

          <p className="festivalName">
            {campaign.festival_name}
          </p>

          {campaign.greeting_message?.trim() && (
            <p className="message">
              {campaign.greeting_message.trim()}
            </p>
          )}

          <div className="brandSignature">
            <span className="signatureLine" />
            <div>
              <strong>Style for Every Family</strong>
              <small>With warm wishes from NEW CITY STYLE</small>
            </div>
            <span className="signatureLine" />
          </div>

          <div className="actions">
            <button
              type="button"
              className="shopButton"
              onClick={openCampaign}
            >
              <span>{campaign.cta_text?.trim() || "Shop Now"}</span>
              <b>→</b>
            </button>

            <button
              type="button"
              className="continueButton"
              onClick={closeGreeting}
            >
              Continue Shopping
            </button>
          </div>

          <p className="onceNote">
            This greeting is shown only once today on this device.
          </p>
        </div>
      </section>

      <style jsx>{`
        .festivalOverlay {
          position: fixed;
          z-index: 2147483000;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 20px;
          background:
            radial-gradient(
              circle at 50% 20%,
              color-mix(
                in srgb,
                var(--festival-secondary) 18%,
                transparent
              ),
              transparent 35%
            ),
            rgba(4, 9, 25, 0.76);
          backdrop-filter: blur(16px);
          animation: overlayIn 0.28s ease both;
        }

        .festivalCard {
          position: relative;
          width: min(980px, 100%);
          max-height: min(760px, calc(100dvh - 30px));
          display: grid;
          grid-template-columns: minmax(260px, 0.86fr) minmax(0, 1.14fr);
          overflow: hidden;
          border:
            1px solid
            color-mix(
              in srgb,
              var(--festival-secondary) 65%,
              white 35%
            );
          border-radius: 32px;
          background:
            radial-gradient(
              circle at 15% 15%,
              color-mix(
                in srgb,
                var(--festival-secondary) 16%,
                transparent
              ),
              transparent 31%
            ),
            linear-gradient(
              135deg,
              color-mix(
                in srgb,
                var(--festival-primary) 96%,
                black 4%
              ),
              color-mix(
                in srgb,
                var(--festival-primary) 78%,
                black 22%
              )
            );
          color: white;
          box-shadow:
            0 40px 100px rgba(0, 0, 0, 0.42),
            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
          animation: cardIn 0.45s cubic-bezier(0.2, 0.85, 0.2, 1) both;
        }

        .closeButton {
          position: absolute;
          z-index: 20;
          top: 15px;
          right: 15px;
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          padding: 0 0 3px;
          border: 1px solid rgba(255, 255, 255, 0.26);
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.11);
          color: white;
          font-size: 28px;
          line-height: 1;
          cursor: pointer;
          backdrop-filter: blur(12px);
          transition:
            transform 0.2s ease,
            background 0.2s ease;
        }

        .closeButton:hover {
          transform: rotate(5deg) scale(1.05);
          background: rgba(255, 255, 255, 0.18);
        }

        .festivalVisual,
        .festivalImageWrap {
          position: relative;
          min-height: 540px;
          overflow: hidden;
          border-right:
            1px solid
            color-mix(
              in srgb,
              var(--festival-secondary) 28%,
              transparent
            );
        }

        .festivalVisual {
          display: grid;
          place-items: center;
          background:
            radial-gradient(
              circle at center,
              color-mix(
                in srgb,
                var(--festival-secondary) 22%,
                transparent
              ) 0 24%,
              transparent 25% 100%
            ),
            repeating-radial-gradient(
              circle at center,
              transparent 0 35px,
              color-mix(
                in srgb,
                var(--festival-secondary) 11%,
                transparent
              ) 36px 37px
            ),
            linear-gradient(
              155deg,
              color-mix(
                in srgb,
                var(--festival-primary) 86%,
                white 14%
              ),
              var(--festival-primary)
            );
        }

        .festivalTopOrnament {
          position: absolute;
          top: 28px;
          left: 50%;
          z-index: 6;
          display: flex;
          align-items: center;
          gap: 9px;
          transform: translateX(-50%);
          color: var(--festival-secondary);
          font-size: 18px;
          filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.18));
        }

        .festivalTopOrnament i {
          width: 26px;
          height: 1px;
          background:
            linear-gradient(
              90deg,
              transparent,
              var(--festival-secondary),
              transparent
            );
          opacity: 0.7;
        }

        .festivalHalo {
          position: absolute;
          left: 50%;
          top: 50%;
          pointer-events: none;
          border-radius: 50%;
          transform: translate(-50%, -50%);
        }

        .haloOuter {
          width: 340px;
          height: 340px;
          border:
            1px solid
            color-mix(
              in srgb,
              var(--festival-secondary) 24%,
              transparent
            );
          box-shadow:
            0 0 55px
            color-mix(
              in srgb,
              var(--festival-secondary) 8%,
              transparent
            );
          animation: haloPulse 5.8s ease-in-out infinite;
        }

        .haloMiddle {
          width: 260px;
          height: 260px;
          border:
            1px dashed
            color-mix(
              in srgb,
              var(--festival-secondary) 34%,
              transparent
            );
          animation: haloSpin 15s linear infinite;
        }

        .festivalMotif {
          position: absolute;
          z-index: 4;
          top: 50%;
          font-size: 34px;
          opacity: 0.82;
          filter: drop-shadow(0 10px 22px rgba(0, 0, 0, 0.22));
          animation: motifFloat 4.8s ease-in-out infinite;
        }

        .motifLeft {
          left: 12%;
          transform: translateY(-50%) rotate(-8deg);
        }

        .motifRight {
          right: 12%;
          transform: translateY(-50%) rotate(8deg);
          animation-delay: 0.9s;
        }

        .festivalVisualCaption {
          position: absolute;
          left: 50%;
          bottom: 69px;
          z-index: 6;
          width: 78%;
          text-align: center;
          transform: translateX(-50%);
        }

        .festivalVisualCaption small,
        .festivalVisualCaption strong {
          display: block;
        }

        .festivalVisualCaption small {
          color: rgba(255, 255, 255, 0.48);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .festivalVisualCaption strong {
          margin-top: 6px;
          color:
            color-mix(
              in srgb,
              var(--festival-secondary) 88%,
              white 12%
            );
          font-family: "Playfair Display", Georgia, serif;
          font-size: 20px;
          font-weight: 900;
          line-height: 1.1;
          text-wrap: balance;
        }

        .festivalVisual::before,
        .festivalVisual::after {
          position: absolute;
          width: 230px;
          height: 230px;
          content: "";
          border:
            1px solid
            color-mix(
              in srgb,
              var(--festival-secondary) 40%,
              transparent
            );
          border-radius: 50%;
          animation: ringFloat 7s linear infinite;
        }

        .festivalVisual::after {
          width: 310px;
          height: 310px;
          opacity: 0.5;
          animation-direction: reverse;
          animation-duration: 10s;
        }

        .festivalIconRing {
          position: relative;
          z-index: 3;
          width: 190px;
          height: 190px;
          display: grid;
          place-items: center;
          border:
            1px solid
            color-mix(
              in srgb,
              var(--festival-secondary) 72%,
              white 28%
            );
          border-radius: 50%;
          background:
            radial-gradient(
              circle,
              color-mix(
                in srgb,
                var(--festival-secondary) 22%,
                transparent
              ),
              rgba(255, 255, 255, 0.035)
            );
          box-shadow:
            0 0 70px
              color-mix(
                in srgb,
                var(--festival-secondary) 25%,
                transparent
              ),
            inset 0 0 35px rgba(255, 255, 255, 0.05);
          animation: iconFloat 4s ease-in-out infinite;
        }

        .festivalIcon {
          font-size: 86px;
          filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.22));
        }

        .miniBrand {
          position: absolute;
          bottom: 28px;
          left: 50%;
          z-index: 5;
          padding: 8px 13px;
          border:
            1px solid
            color-mix(
              in srgb,
              var(--festival-secondary) 70%,
              transparent
            );
          border-radius: 999px;
          color: var(--festival-secondary);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 2.2px;
          transform: translateX(-50%);
        }

        .festivalImageWrap img {
          width: 100%;
          height: 100%;
          min-height: 540px;
          display: block;
          object-fit: cover;
          animation: imageZoom 8s ease-out both;
        }

        .festivalImageOverlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(
              180deg,
              transparent 35%,
              color-mix(
                in srgb,
                var(--festival-primary) 72%,
                transparent
              )
            );
        }

        .festivalContent {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          padding: 64px 52px 44px;
          text-align: center;
        }

        .phasePill {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          color:
            color-mix(
              in srgb,
              var(--festival-secondary) 82%,
              white 18%
            );
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1.7px;
        }

        .phasePill span {
          width: 28px;
          height: 1px;
          background: var(--festival-secondary);
        }

        .brandLine {
          margin: 20px 0 0;
          color: rgba(255, 255, 255, 0.66);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 3px;
        }

        h2 {
          max-width: 600px;
          margin: 12px 0 0;
          color: var(--festival-secondary);
          font-family: "Playfair Display", Georgia, serif;
          font-size: clamp(42px, 5vw, 70px);
          font-weight: 900;
          line-height: 0.98;
          letter-spacing: -1.8px;
          text-wrap: balance;
          text-shadow:
            0 14px 40px
            color-mix(
              in srgb,
              var(--festival-secondary) 20%,
              transparent
            );
        }

        .festivalName {
          margin: 14px 0 0;
          color: white;
          font-size: 13px;
          font-weight: 850;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .message {
          max-width: 600px;
          margin: 22px 0 0;
          color: rgba(255, 255, 255, 0.83);
          font-size: 15px;
          line-height: 1.75;
          text-wrap: balance;
        }

        .brandSignature {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 14px;
          margin-top: 25px;
        }

        .signatureLine {
          height: 1px;
          background:
            linear-gradient(
              90deg,
              transparent,
              color-mix(
                in srgb,
                var(--festival-secondary) 58%,
                transparent
              )
            );
        }

        .signatureLine:last-child {
          background:
            linear-gradient(
              90deg,
              color-mix(
                in srgb,
                var(--festival-secondary) 58%,
                transparent
              ),
              transparent
            );
        }

        .brandSignature strong,
        .brandSignature small {
          display: block;
        }

        .brandSignature strong {
          color: var(--festival-secondary);
          font-size: 11px;
        }

        .brandSignature small {
          margin-top: 4px;
          color: rgba(255, 255, 255, 0.52);
          font-size: 8px;
        }

        .actions {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 28px;
        }

        .actions button {
          min-height: 50px;
          border-radius: 14px;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            background 0.2s ease;
        }

        .actions button:hover {
          transform: translateY(-2px);
        }

        .shopButton {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          border: 0;
          background:
            linear-gradient(
              135deg,
              var(--festival-secondary),
              color-mix(
                in srgb,
                var(--festival-secondary) 68%,
                white 32%
              )
            );
          color: var(--festival-primary);
          box-shadow:
            0 14px 30px
            color-mix(
              in srgb,
              var(--festival-secondary) 20%,
              transparent
            );
        }

        .shopButton b {
          font-size: 18px;
        }

        .continueButton {
          border: 1px solid rgba(255, 255, 255, 0.24);
          background: rgba(255, 255, 255, 0.07);
          color: white;
        }

        .continueButton:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        .onceNote {
          margin: 14px 0 0;
          color: rgba(255, 255, 255, 0.38);
          font-size: 8px;
        }

        .festivalAura {
          position: absolute;
          z-index: 1;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(2px);
        }

        .auraOne {
          top: -140px;
          right: -100px;
          width: 300px;
          height: 300px;
          background:
            radial-gradient(
              circle,
              color-mix(
                in srgb,
                var(--festival-secondary) 18%,
                transparent
              ),
              transparent 68%
            );
        }

        .auraTwo {
          bottom: -160px;
          left: 28%;
          width: 360px;
          height: 360px;
          background:
            radial-gradient(
              circle,
              color-mix(
                in srgb,
                var(--festival-secondary) 10%,
                transparent
              ),
              transparent 70%
            );
        }

        .festivalSpark {
          position: absolute;
          z-index: 8;
          color: var(--festival-secondary);
          pointer-events: none;
          animation: sparkle 3s ease-in-out infinite;
        }

        .sparkOne {
          top: 12%;
          left: 42%;
          font-size: 18px;
        }

        .sparkTwo {
          right: 7%;
          bottom: 18%;
          font-size: 24px;
          animation-delay: 0.8s;
        }

        .sparkThree {
          bottom: 10%;
          left: 35%;
          font-size: 14px;
          animation-delay: 1.4s;
        }

        @keyframes overlayIn {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }

        @keyframes cardIn {
          from {
            opacity: 0;
            transform: translateY(28px) scale(0.97);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes iconFloat {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }

          50% {
            transform: translateY(-10px) scale(1.025);
          }
        }

        @keyframes ringFloat {
          from {
            transform: rotate(0deg) scale(1);
          }

          50% {
            transform: rotate(180deg) scale(1.05);
          }

          to {
            transform: rotate(360deg) scale(1);
          }
        }

        @keyframes sparkle {
          0%,
          100% {
            opacity: 0.25;
            transform: scale(0.7) rotate(0deg);
          }

          50% {
            opacity: 1;
            transform: scale(1.2) rotate(18deg);
          }
        }

        @keyframes haloPulse {
          0%,
          100% {
            opacity: 0.55;
            transform: translate(-50%, -50%) scale(0.98);
          }

          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.04);
          }
        }

        @keyframes haloSpin {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }

          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }

        @keyframes motifFloat {
          0%,
          100% {
            margin-top: 0;
          }

          50% {
            margin-top: -12px;
          }
        }

        @keyframes imageZoom {
          from {
            transform: scale(1.07);
          }

          to {
            transform: scale(1);
          }
        }

        @media (max-width: 760px) {
          .festivalOverlay {
            padding: 10px;
          }

          .festivalCard {
            max-height: calc(100dvh - 20px);
            grid-template-columns: 1fr;
            overflow-y: auto;
            border-radius: 24px;
          }

          .festivalVisual,
          .festivalImageWrap {
            min-height: 205px;
            border-right: 0;
            border-bottom:
              1px solid
              color-mix(
                in srgb,
                var(--festival-secondary) 22%,
                transparent
              );
          }

          .festivalImageWrap img {
            min-height: 205px;
            height: 205px;
          }

          .festivalHalo {
            display: none;
          }

          .festivalTopOrnament {
            top: 13px;
          }

          .festivalMotif {
            font-size: 24px;
          }

          .motifLeft {
            left: 10%;
          }

          .motifRight {
            right: 10%;
          }

          .festivalVisualCaption {
            bottom: 46px;
          }

          .festivalVisualCaption strong {
            font-size: 16px;
          }

          .festivalIconRing {
            width: 125px;
            height: 125px;
          }

          .festivalIcon {
            font-size: 58px;
          }

          .festivalVisual::before {
            width: 160px;
            height: 160px;
          }

          .festivalVisual::after {
            width: 215px;
            height: 215px;
          }

          .miniBrand {
            bottom: 14px;
          }

          .festivalContent {
            padding: 35px 20px 24px;
          }

          h2 {
            font-size: clamp(38px, 12vw, 55px);
          }

          .message {
            margin-top: 17px;
            font-size: 13px;
            line-height: 1.65;
          }

          .brandSignature {
            gap: 8px;
            margin-top: 20px;
          }

          .actions {
            grid-template-columns: 1fr;
            margin-top: 22px;
          }

          .closeButton {
            position: fixed;
            top: 20px;
            right: 20px;
          }

          .sparkOne {
            left: 8%;
          }

          .sparkThree {
            display: none;
          }
        }

        @media (max-width: 390px) {
          .festivalContent {
            padding-right: 15px;
            padding-left: 15px;
          }

          .phasePill {
            font-size: 8px;
            letter-spacing: 1px;
          }

          .phasePill span {
            width: 18px;
          }

          .brandSignature {
            grid-template-columns: 24px 1fr 24px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .festivalOverlay,
          .festivalCard,
          .festivalIconRing,
          .festivalVisual::before,
          .festivalVisual::after,
          .festivalSpark,
          .festivalHalo,
          .festivalMotif,
          .festivalImageWrap img {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
