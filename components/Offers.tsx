"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CouponRow = {
  id: string | number;
  code?: string | null;
  title?: string | null;
  description?: string | null;
  discount_type?: string | null;
  discount_value?: number | string | null;
  minimum_order?: number | string | null;
  maximum_discount?: number | string | null;
  usage_limit?: number | string | null;
  used_count?: number | string | null;
  is_active?: boolean | null;
  end_date?: string | null;
  created_at?: string | null;
};

type OfferCard = {
  id: string;
  icon: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  code: string;
  route: string;
  theme: "gold" | "white" | "blue" | "ivory";
};

const fallbackOffers: OfferCard[] = [
  {
    id: "fallback-1",
    icon: "🎉",
    badge: "LIMITED",
    title: "Flat 50% OFF",
    subtitle: "Selected Items",
    description: "Premium fashion collections at special prices.",
    code: "",
    route: "/search?q=offer",
    theme: "gold",
  },
  {
    id: "fallback-2",
    icon: "👨‍👩‍👧",
    badge: "FAMILY DEAL",
    title: "Buy 2 Get 1",
    subtitle: "Family Collection",
    description: "Extra value for the entire family.",
    code: "",
    route: "/search?q=family",
    theme: "white",
  },
  {
    id: "fallback-3",
    icon: "⚡",
    badge: "FLASH SALE",
    title: "Extra 20% OFF",
    subtitle: "New Arrivals",
    description: "Fresh fashion collections with launch offers.",
    code: "",
    route: "/search?q=new",
    theme: "blue",
  },
  {
    id: "fallback-4",
    icon: "✨",
    badge: "FESTIVE",
    title: "Special Savings",
    subtitle: "Festive Fashion",
    description: "Celebrate every occasion with premium style.",
    code: "",
    route: "/search?q=festive",
    theme: "ivory",
  },
];

const themes: OfferCard["theme"][] = [
  "gold",
  "white",
  "blue",
  "ivory",
];

const icons = ["🎉", "⚡", "🎁", "✨"];

function toNumber(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function isCouponExpired(endDate?: string | null) {
  if (!endDate) return false;

  const date = new Date(endDate);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  date.setHours(23, 59, 59, 999);

  return date.getTime() < Date.now();
}

function getDiscountTitle(coupon: CouponRow) {
  const value = toNumber(coupon.discount_value);
  const type = (coupon.discount_type || "").trim().toLowerCase();

  if (
    type.includes("percent") ||
    type.includes("percentage")
  ) {
    return `${value}% OFF`;
  }

  if (
    type.includes("fixed") ||
    type.includes("amount") ||
    type.includes("flat")
  ) {
    return `₹${value.toLocaleString("en-IN")} OFF`;
  }

  if (value > 0) {
    return `${value}% OFF`;
  }

  return coupon.title?.trim() || "Special Offer";
}

function getSubtitle(coupon: CouponRow) {
  const minimumOrder = toNumber(coupon.minimum_order);

  if (minimumOrder > 0) {
    return `On orders above ₹${minimumOrder.toLocaleString("en-IN")}`;
  }

  return coupon.title?.trim() || "NEW CITY STYLE Offer";
}

function getBadge(coupon: CouponRow) {
  const code = coupon.code?.trim();

  if (code) {
    return code.toUpperCase();
  }

  return "ACTIVE OFFER";
}

function getDescription(coupon: CouponRow) {
  const text = coupon.description?.trim();

  if (text) {
    return text;
  }

  const maximumDiscount = toNumber(coupon.maximum_discount);

  if (maximumDiscount > 0) {
    return `Save up to ₹${maximumDiscount.toLocaleString("en-IN")} with this offer.`;
  }

  return "Apply this active coupon during checkout and enjoy special savings.";
}

function mapCouponToOffer(
  coupon: CouponRow,
  index: number
): OfferCard {
  const searchValue =
    coupon.title?.trim() ||
    coupon.code?.trim() ||
    "offer";

  return {
    id: String(coupon.id),
    icon: icons[index % icons.length],
    badge: getBadge(coupon),
    title: getDiscountTitle(coupon),
    subtitle: getSubtitle(coupon),
    description: getDescription(coupon),
    code: coupon.code?.trim() || "",
    route: `/search?q=${encodeURIComponent(searchValue)}`,
    theme: themes[index % themes.length],
  };
}

export default function Offers() {
  const router = useRouter();

  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveCoupons();
  }, []);

  async function loadActiveCoupons() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const activeCoupons = ((data as CouponRow[]) || [])
        .filter((coupon) => !isCouponExpired(coupon.end_date))
        .filter((coupon) => {
          const usageLimit = toNumber(coupon.usage_limit);
          const usedCount = toNumber(coupon.used_count);

          if (usageLimit <= 0) return true;

          return usedCount < usageLimit;
        });

      setCoupons(activeCoupons);
    } catch (error) {
      console.error("Home offers loading error:", error);
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }

  const offers = useMemo<OfferCard[]>(() => {
    if (coupons.length === 0) {
      return fallbackOffers;
    }

    return coupons
      .slice(0, 8)
      .map((coupon, index) =>
        mapCouponToOffer(coupon, index)
      );
  }, [coupons]);

  function openOffer(route: string) {
    router.push(route);
  }

  async function copyCouponCode(
    event: React.MouseEvent<HTMLButtonElement>,
    code: string
  ) {
    event.stopPropagation();

    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      alert(`Coupon code ${code} copied.`);
    } catch {
      alert(`Use coupon code: ${code}`);
    }
  }

  return (
    <section className="offersSection">
      <div className="offersContainer">
        <div className="headingArea">
          <div className="eyebrow">
            <span />
            NEW CITY STYLE EXCLUSIVE
            <span />
          </div>

          <h2>
            <b>🔥</b>
            Special Offers
          </h2>

          <p>
            Active coupons from the NEW CITY STYLE Admin Studio.
          </p>
        </div>

        {loading ? (
          <div className="offerGrid">
            {[1, 2, 3, 4].map((item) => (
              <div className="skeletonCard" key={item}>
                <div className="skeletonTop">
                  <div className="skeletonIcon" />
                  <div className="skeletonBadge" />
                </div>

                <div className="skeletonTitle" />
                <div className="skeletonLine" />
                <div className="skeletonButton" />
              </div>
            ))}
          </div>
        ) : (
          <div className="offerGrid">
            {offers.map((offer) => (
              <article
                key={offer.id}
                className={`offerCard ${offer.theme}`}
                onClick={() => openOffer(offer.route)}
              >
                <div className="topRow">
                  <div className="iconBox">{offer.icon}</div>

                  <span className="badge">{offer.badge}</span>
                </div>

                <div className="offerContent">
                  <h3>{offer.title}</h3>
                  <h4>{offer.subtitle}</h4>
                  <p>{offer.description}</p>
                </div>

                <div className="cardActions">
                  {offer.code ? (
                    <button
                      type="button"
                      className="couponButton"
                      onClick={(event) =>
                        copyCouponCode(event, offer.code)
                      }
                    >
                      Copy {offer.code}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="couponButton"
                      onClick={(event) => {
                        event.stopPropagation();
                        openOffer(offer.route);
                      }}
                    >
                      Explore
                    </button>
                  )}

                  <button
                    type="button"
                    className="arrowButton"
                    onClick={(event) => {
                      event.stopPropagation();
                      openOffer(offer.route);
                    }}
                    aria-label={`Open ${offer.title}`}
                  >
                    →
                  </button>
                </div>

                <div className="circle circleOne" />
                <div className="circle circleTwo" />
              </article>
            ))}
          </div>
        )}

        <button
          type="button"
          className="allOffersButton"
          onClick={() => router.push("/search?q=offer")}
        >
          Shop All Offers
          <span>→</span>
        </button>

        <p className="notice">
          ⏳ Limited-period offers. Availability, conditions and
          discounts may vary.
        </p>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .offersSection {
          position: relative;
          overflow: hidden;
          width: 100%;
          padding: 62px 20px;
          background:
            radial-gradient(
              circle at 12% 15%,
              rgba(212, 175, 55, 0.2),
              transparent 23%
            ),
            radial-gradient(
              circle at 88% 80%,
              rgba(60, 126, 255, 0.24),
              transparent 26%
            ),
            linear-gradient(
              135deg,
              #03153f,
              #0a2e73 55%,
              #164ca8
            );
          color: #ffffff;
        }

        .offersContainer {
          width: min(1280px, 100%);
          margin: 0 auto;
          text-align: center;
        }

        .headingArea {
          margin-bottom: 32px;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #f1d26a;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .eyebrow span {
          width: 35px;
          height: 2px;
          background: #d4af37;
        }

        h2 {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin: 13px 0 0;
          color: #d4af37;
          font-size: clamp(36px, 5vw, 58px);
          line-height: 1.05;
          letter-spacing: -1.5px;
        }

        h2 b {
          font-size: 0.8em;
        }

        .headingArea > p {
          margin: 13px 0 0;
          color: rgba(255, 255, 255, 0.72);
          font-size: 15px;
        }

        .offerGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .offerCard,
        .skeletonCard {
          position: relative;
          overflow: hidden;
          min-height: 250px;
          display: flex;
          flex-direction: column;
          padding: 19px;
          border-radius: 20px;
          text-align: left;
          box-shadow: 0 18px 38px rgba(0, 0, 0, 0.2);
        }

        .offerCard {
          cursor: pointer;
          transition:
            transform 0.25s ease,
            box-shadow 0.25s ease;
        }

        .offerCard:hover {
          transform: translateY(-6px);
          box-shadow: 0 25px 48px rgba(0, 0, 0, 0.27);
        }

        .gold {
          border: 1px solid rgba(255, 255, 255, 0.5);
          background: linear-gradient(135deg, #c99d24, #f1d26a);
          color: #061b45;
        }

        .white {
          border: 1px solid rgba(255, 255, 255, 0.75);
          background: linear-gradient(145deg, #ffffff, #edf3ff);
          color: #0a2e73;
        }

        .blue {
          border: 1px solid rgba(212, 175, 55, 0.5);
          background: linear-gradient(145deg, #03153f, #164ca8);
          color: #ffffff;
        }

        .ivory {
          border: 1px solid rgba(212, 175, 55, 0.55);
          background: linear-gradient(145deg, #f8f4ec, #e8d594);
          color: #0a2e73;
        }

        .topRow {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .iconBox {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.32);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.18);
          font-size: 23px;
          backdrop-filter: blur(8px);
        }

        .badge {
          max-width: 120px;
          overflow: hidden;
          padding: 6px 9px;
          border-radius: 999px;
          background: rgba(10, 46, 115, 0.12);
          color: inherit;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.7px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .blue .badge {
          background: rgba(212, 175, 55, 0.16);
          color: #f1d26a;
        }

        .offerContent {
          position: relative;
          z-index: 2;
          margin-top: 21px;
        }

        .offerContent h3 {
          margin: 0;
          font-size: clamp(20px, 2.2vw, 27px);
          line-height: 1.12;
          letter-spacing: -0.6px;
        }

        .offerContent h4 {
          margin: 8px 0 0;
          font-size: 12px;
          line-height: 1.35;
        }

        .offerContent p {
          display: -webkit-box;
          min-height: 38px;
          margin: 10px 0 0;
          overflow: hidden;
          font-size: 10px;
          line-height: 1.5;
          opacity: 0.7;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .cardActions {
          position: relative;
          z-index: 3;
          display: grid;
          grid-template-columns: 1fr 42px;
          gap: 8px;
          margin-top: auto;
          padding-top: 15px;
        }

        .cardActions button {
          min-height: 40px;
          border: 1px solid rgba(255, 255, 255, 0.4);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.17);
          color: inherit;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
          backdrop-filter: blur(8px);
        }

        .blue .cardActions button {
          border-color: rgba(212, 175, 55, 0.45);
          color: #f1d26a;
        }

        .arrowButton {
          font-size: 17px !important;
        }

        .circle {
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.09);
          pointer-events: none;
        }

        .circleOne {
          top: 65px;
          right: -25px;
          width: 80px;
          height: 80px;
        }

        .circleTwo {
          right: -45px;
          bottom: -55px;
          width: 145px;
          height: 145px;
        }

        .allOffersButton {
          min-width: 240px;
          min-height: 54px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 13px;
          margin-top: 28px;
          padding: 0 28px;
          border: 1px solid rgba(255, 255, 255, 0.38);
          border-radius: 14px;
          background: linear-gradient(135deg, #d4af37, #f1d26a);
          color: #0a2e73;
          font-size: 15px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 15px 32px rgba(212, 175, 55, 0.25);
        }

        .allOffersButton span {
          font-size: 22px;
        }

        .notice {
          margin: 16px 0 0;
          color: rgba(255, 255, 255, 0.55);
          font-size: 10px;
        }

        .skeletonCard {
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
        }

        .skeletonTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .skeletonIcon,
        .skeletonBadge,
        .skeletonTitle,
        .skeletonLine,
        .skeletonButton {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.18),
            rgba(255, 255, 255, 0.08)
          );
          background-size: 200% 100%;
          animation: skeletonMove 1.2s linear infinite;
        }

        .skeletonIcon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
        }

        .skeletonBadge {
          width: 75px;
          height: 22px;
          border-radius: 999px;
        }

        .skeletonTitle {
          width: 72%;
          height: 25px;
          margin-top: 25px;
          border-radius: 8px;
        }

        .skeletonLine {
          width: 88%;
          height: 12px;
          margin-top: 13px;
          border-radius: 8px;
        }

        .skeletonButton {
          width: 100%;
          height: 40px;
          margin-top: auto;
          border-radius: 11px;
        }

        @keyframes skeletonMove {
          from {
            background-position: 200% 0;
          }

          to {
            background-position: -200% 0;
          }
        }

        @media (max-width: 950px) {
          .offerGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .offersSection {
            padding: 45px 10px;
          }

          .headingArea {
            margin-bottom: 24px;
          }

          .eyebrow {
            gap: 7px;
            font-size: 8px;
            letter-spacing: 1.2px;
          }

          .eyebrow span {
            width: 20px;
          }

          h2 {
            gap: 6px;
            margin-top: 10px;
            font-size: 32px;
          }

          .headingArea > p {
            margin-top: 9px;
            font-size: 12px;
          }

          .offerGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
          }

          .offerCard,
          .skeletonCard {
            min-height: 225px;
            padding: 13px;
            border-radius: 16px;
          }

          .iconBox,
          .skeletonIcon {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            font-size: 19px;
          }

          .badge {
            max-width: 82px;
            padding: 5px 7px;
            font-size: 7px;
            letter-spacing: 0.3px;
          }

          .offerContent {
            margin-top: 16px;
          }

          .offerContent h3 {
            min-height: 40px;
            font-size: 17px;
            line-height: 1.15;
          }

          .offerContent h4 {
            min-height: 28px;
            margin-top: 5px;
            font-size: 9px;
          }

          .offerContent p {
            min-height: 31px;
            margin-top: 6px;
            font-size: 8px;
            line-height: 1.4;
          }

          .cardActions {
            grid-template-columns: 1fr 36px;
            gap: 6px;
            padding-top: 10px;
          }

          .cardActions button {
            min-height: 35px;
            border-radius: 9px;
            font-size: 8px;
          }

          .allOffersButton {
            width: calc(100% - 24px);
            min-height: 50px;
            margin-top: 23px;
            font-size: 14px;
          }

          .notice {
            padding: 0 15px;
            font-size: 9px;
            line-height: 1.5;
          }

          .circleOne {
            width: 60px;
            height: 60px;
          }

          .circleTwo {
            width: 105px;
            height: 105px;
          }
        }
      `}</style>
    </section>
  );
}
