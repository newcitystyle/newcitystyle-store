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
    icon: "✦",
    badge: "STYLE PICK",
    title: "Shop New Arrivals",
    subtitle: "Fresh Online Collection",
    description: "Explore recently added NEW CITY STYLE products.",
    code: "",
    route: "/search?q=new",
    theme: "gold",
  },
  {
    id: "fallback-2",
    icon: "◫",
    badge: "FAMILY PICKS",
    title: "Shop Family Fashion",
    subtitle: "Men • Women • Kids",
    description: "Browse fashion collections for the whole family.",
    code: "",
    route: "/search?q=family",
    theme: "white",
  },
  {
    id: "fallback-3",
    icon: "→",
    badge: "EXPLORE",
    title: "Browse Best Styles",
    subtitle: "Live Online Products",
    description: "Discover active online products across categories.",
    code: "",
    route: "/search",
    theme: "blue",
  },
  {
    id: "fallback-4",
    icon: "◇",
    badge: "COLLECTIONS",
    title: "Discover Collections",
    subtitle: "Curated NEW CITY STYLE",
    description: "Explore active collections published from Admin.",
    code: "",
    route: "/collections",
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



  const hasLiveCoupons = coupons.length > 0;
  const heroOffer = offers[0] || null;
  const remainingOffers = offers.slice(1);

  return (
    <section className="offersSection">
      <div className="ambientGrid" />
      <div className="ambientGlow glowOne" />
      <div className="ambientGlow glowTwo" />

      <div className="offersContainer">
        <div className="headingRow">
          <div className="headingArea">
            <span className="eyebrow">SMART SAVINGS • LIVE FROM ADMIN</span>

            <h2>
              Offers Worth
              <strong>Opening</strong>
            </h2>

            <p>
              {hasLiveCoupons
                ? "These savings are connected to currently active NEW CITY STYLE coupons."
                : "Explore curated shopping lanes while no live coupon campaign is active."}
            </p>
          </div>

          <button
            type="button"
            className="allOffersButton"
            onClick={() => router.push("/search?q=offer")}
          >
            <span>Shop Offers</span>
            <b>→</b>
          </button>
        </div>

        <div className="offerSignals">
          <div>
            <span className={hasLiveCoupons ? "liveDot" : "neutralDot"} />
            <p>
              <b>{hasLiveCoupons ? "LIVE COUPONS" : "NO LIVE COUPON"}</b>
              <small>
                {hasLiveCoupons
                  ? "Active and valid campaigns only"
                  : "No false discount urgency is shown"}
              </small>
            </p>
          </div>

          <div>
            <span>✓</span>
            <p>
              <b>CONDITION AWARE</b>
              <small>Minimum order and limits stay visible</small>
            </p>
          </div>

          <div>
            <span>⎘</span>
            <p>
              <b>ONE-TAP COPY</b>
              <small>Coupon codes stay easy to use</small>
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loadingStage">
            <div className="loadingHero" />
            <div className="loadingGrid">
              {[1, 2, 3].map((item) => (
                <div className="loadingCard" key={item} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {heroOffer && (
              <article
                className={`heroOffer ${heroOffer.theme}`}
                onClick={() => openOffer(heroOffer.route)}
              >
                <div className="heroDecor heroDecorOne" />
                <div className="heroDecor heroDecorTwo" />

                <div className="heroTop">
                  <span className="campaignType">
                    {hasLiveCoupons ? "LIVE CAMPAIGN" : "SHOPPING PICK"}
                  </span>

                  <span className="heroBadge">{heroOffer.badge}</span>
                </div>

                <div className="heroOfferContent">
                  <div className="heroIcon">{heroOffer.icon}</div>

                  <div>
                    <span className="miniLabel">NEW CITY STYLE SAVINGS</span>
                    <h3>{heroOffer.title}</h3>
                    <h4>{heroOffer.subtitle}</h4>
                    <p>{heroOffer.description}</p>
                  </div>
                </div>

                <div className="heroActions">
                  {heroOffer.code ? (
                    <button
                      type="button"
                      className="couponAction"
                      onClick={(event) =>
                        copyCouponCode(event, heroOffer.code)
                      }
                    >
                      <span>Copy {heroOffer.code}</span>
                      <b>⎘</b>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="couponAction"
                      onClick={(event) => {
                        event.stopPropagation();
                        openOffer(heroOffer.route);
                      }}
                    >
                      <span>Explore This Offer</span>
                      <b>→</b>
                    </button>
                  )}

                  <button
                    type="button"
                    className="shopAction"
                    onClick={(event) => {
                      event.stopPropagation();
                      openOffer(heroOffer.route);
                    }}
                  >
                    Shop Now →
                  </button>
                </div>
              </article>
            )}

            {remainingOffers.length > 0 && (
              <div className="offerRail">
                {remainingOffers.map((offer, index) => (
                  <article
                    key={offer.id}
                    className={`offerCard ${offer.theme}`}
                    onClick={() => openOffer(offer.route)}
                  >
                    <div className="cardTop">
                      <span className="cardIndex">
                        {String(index + 2).padStart(2, "0")}
                      </span>

                      <span className="badge">{offer.badge}</span>
                    </div>

                    <div className="iconBox">{offer.icon}</div>

                    <div className="offerContent">
                      <span className="miniLabel">
                        {hasLiveCoupons ? "ACTIVE SAVING" : "STYLE DISCOVERY"}
                      </span>

                      <h3>{offer.title}</h3>
                      <h4>{offer.subtitle}</h4>
                      <p>{offer.description}</p>
                    </div>

                    <div className="cardActions">
                      {offer.code ? (
                        <button
                          type="button"
                          onClick={(event) =>
                            copyCouponCode(event, offer.code)
                          }
                        >
                          Copy {offer.code}
                        </button>
                      ) : (
                        <button
                          type="button"
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
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        <div className="trustNotice">
          <div>
            <span className="noticeDot" />
            <p>
              <b>Truthful offer display</b>
              <small>
                Expired coupons and exhausted usage-limited coupons remain filtered out.
              </small>
            </p>
          </div>

          <span>
            Terms, eligibility and final discount are confirmed during checkout.
          </span>
        </div>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .offersSection {
          position: relative;
          overflow: hidden;
          padding: 88px 20px 96px;
          background:
            radial-gradient(
              circle at 10% 12%,
              rgba(var(--ncs-secondary-rgb, 212,175,55), .17),
              transparent 26%
            ),
            radial-gradient(
              circle at 90% 88%,
              rgba(45, 93, 177, .24),
              transparent 29%
            ),
            linear-gradient(
              135deg,
              color-mix(
                in srgb,
                var(--ncs-primary, #0A2E73) 88%,
                black 12%
              ),
              var(--ncs-primary, #0A2E73) 58%,
              color-mix(
                in srgb,
                var(--ncs-primary, #0A2E73) 77%,
                white 23%
              )
            );
          color: #fff;
        }

        .offersContainer {
          position: relative;
          z-index: 3;
          width: min(1420px, 100%);
          margin: 0 auto;
        }

        .ambientGrid {
          position: absolute;
          inset: 0;
          opacity: .06;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px);
          background-size: 66px 66px;
          mask-image: linear-gradient(
            180deg,
            rgba(0,0,0,.8),
            transparent 90%
          );
        }

        .ambientGlow {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
        }

        .glowOne {
          top: -100px;
          left: -130px;
          width: 360px;
          height: 360px;
          background: rgba(var(--ncs-secondary-rgb, 212,175,55), .16);
        }

        .glowTwo {
          right: -140px;
          bottom: -100px;
          width: 390px;
          height: 390px;
          background: rgba(86, 132, 223, .18);
        }

        .headingRow {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 30px;
        }

        .headingArea {
          max-width: 860px;
        }

        .eyebrow {
          color: color-mix(
            in srgb,
            var(--ncs-secondary, #D4AF37) 74%,
            white 26%
          );
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 1.9px;
        }

        h2 {
          margin: 9px 0 0;
          color: #fff;
          font-size: clamp(42px, 5.5vw, 70px);
          line-height: .98;
          letter-spacing: -2.3px;
        }

        h2 strong {
          display: block;
          color: var(--ncs-secondary, #D4AF37);
          font-weight: 950;
        }

        .headingArea > p {
          max-width: 760px;
          margin: 18px 0 0;
          color: rgba(255,255,255,.68);
          font-size: 14px;
          line-height: 1.7;
        }

        .allOffersButton {
          min-height: 49px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          flex: 0 0 auto;
          padding: 0 18px;
          border: 1px solid rgba(212,175,55,.58);
          border-radius: 13px;
          background: rgba(255,255,255,.08);
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
          backdrop-filter: blur(10px);
        }

        .allOffersButton b {
          color: var(--ncs-secondary, #D4AF37);
          font-size: 17px;
        }

        .offerSignals {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 30px;
        }

        .offerSignals > div {
          min-height: 60px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border: 1px solid rgba(255,255,255,.11);
          border-radius: 14px;
          background: rgba(255,255,255,.06);
          backdrop-filter: blur(10px);
        }

        .offerSignals > div > span {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          flex: 0 0 30px;
          border-radius: 9px;
          background: rgba(255,255,255,.08);
          color: #eed36f;
          font-size: 12px;
          font-weight: 950;
        }

        .offerSignals .liveDot,
        .offerSignals .neutralDot {
          position: relative;
        }

        .offerSignals .liveDot::after,
        .offerSignals .neutralDot::after {
          width: 8px;
          height: 8px;
          content: "";
          border-radius: 50%;
        }

        .offerSignals .liveDot::after {
          background: #7cf0a5;
          box-shadow: 0 0 0 5px rgba(124,240,165,.1);
        }

        .offerSignals .neutralDot::after {
          background: #c7ced9;
          box-shadow: 0 0 0 5px rgba(199,206,217,.08);
        }

        .offerSignals p {
          margin: 0;
        }

        .offerSignals b,
        .offerSignals small {
          display: block;
        }

        .offerSignals b {
          color: #fff;
          font-size: 9px;
          letter-spacing: .8px;
        }

        .offerSignals small {
          margin-top: 3px;
          color: rgba(255,255,255,.5);
          font-size: 8px;
        }

        .heroOffer {
          position: relative;
          overflow: hidden;
          min-height: 340px;
          margin-top: 38px;
          padding: 28px;
          border-radius: 25px;
          cursor: pointer;
          box-shadow: 0 24px 60px rgba(0,0,0,.2);
        }

        .heroOffer.gold {
          border: 1px solid rgba(255,255,255,.42);
          background:
            linear-gradient(
              135deg,
              color-mix(
                in srgb,
                var(--ncs-secondary, #D4AF37) 84%,
                black 16%
              ),
              color-mix(
                in srgb,
                var(--ncs-secondary, #D4AF37) 72%,
                white 28%
              )
            );
          color: color-mix(
            in srgb,
            var(--ncs-primary, #0A2E73) 86%,
            black 14%
          );
        }

        .heroOffer.white {
          border: 1px solid rgba(255,255,255,.72);
          background: linear-gradient(135deg, #fff, #edf2fa);
          color: var(--ncs-primary, #0A2E73);
        }

        .heroOffer.blue {
          border: 1px solid rgba(212,175,55,.38);
          background:
            linear-gradient(
              135deg,
              #061735,
              var(--ncs-primary, #0A2E73)
            );
          color: #fff;
        }

        .heroOffer.ivory {
          border: 1px solid rgba(212,175,55,.38);
          background:
            linear-gradient(
              135deg,
              #fffdf6,
              #f0d77f
            );
          color: var(--ncs-primary, #0A2E73);
        }

        .heroDecor {
          position: absolute;
          border-radius: 50%;
          background: rgba(255,255,255,.12);
          pointer-events: none;
        }

        .heroDecorOne {
          width: 240px;
          height: 240px;
          top: -90px;
          right: -50px;
        }

        .heroDecorTwo {
          width: 380px;
          height: 380px;
          right: 15%;
          bottom: -300px;
        }

        .heroTop {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .campaignType,
        .heroBadge {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 10px;
          border: 1px solid currentColor;
          border-radius: 999px;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: .8px;
          opacity: .82;
        }

        .heroOfferContent {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: 72px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
          max-width: 900px;
          margin-top: 34px;
        }

        .heroIcon {
          width: 72px;
          height: 72px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.3);
          border-radius: 20px;
          background: rgba(255,255,255,.13);
          font-size: 31px;
          backdrop-filter: blur(8px);
        }

        .miniLabel {
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1.4px;
          opacity: .68;
        }

        .heroOfferContent h3 {
          margin: 6px 0 0;
          font-size: clamp(38px, 5vw, 68px);
          line-height: .96;
          letter-spacing: -2px;
        }

        .heroOfferContent h4 {
          margin: 10px 0 0;
          font-size: 15px;
        }

        .heroOfferContent p {
          max-width: 700px;
          margin: 10px 0 0;
          font-size: 11px;
          line-height: 1.6;
          opacity: .7;
        }

        .heroActions {
          position: relative;
          z-index: 2;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 28px;
        }

        .heroActions button {
          min-height: 44px;
          border-radius: 11px;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .couponAction {
          min-width: 180px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 0 15px;
          border: 1px solid currentColor;
          background: rgba(255,255,255,.14);
          color: inherit;
        }

        .shopAction {
          padding: 0 15px;
          border: 1px solid transparent;
          background: rgba(3,22,54,.82);
          color: #fff;
        }

        .offerRail {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 14px;
        }

        .offerCard {
          position: relative;
          overflow: hidden;
          min-height: 255px;
          display: flex;
          flex-direction: column;
          padding: 18px;
          border-radius: 18px;
          cursor: pointer;
          transition:
            transform .22s ease,
            box-shadow .22s ease;
        }

        .offerCard:hover {
          transform: translateY(-5px);
          box-shadow: 0 22px 42px rgba(0,0,0,.18);
        }

        .offerCard.gold {
          border: 1px solid rgba(255,255,255,.4);
          background:
            linear-gradient(
              135deg,
              color-mix(
                in srgb,
                var(--ncs-secondary, #D4AF37) 82%,
                black 18%
              ),
              color-mix(
                in srgb,
                var(--ncs-secondary, #D4AF37) 70%,
                white 30%
              )
            );
          color: color-mix(
            in srgb,
            var(--ncs-primary, #0A2E73) 86%,
            black 14%
          );
        }

        .offerCard.white {
          border: 1px solid rgba(255,255,255,.72);
          background: linear-gradient(145deg, #fff, #eef3fb);
          color: var(--ncs-primary, #0A2E73);
        }

        .offerCard.blue {
          border: 1px solid rgba(212,175,55,.38);
          background:
            linear-gradient(145deg, #061735, #0b3d8f);
          color: #fff;
        }

        .offerCard.ivory {
          border: 1px solid rgba(212,175,55,.4);
          background:
            linear-gradient(145deg, #fffdf6, #f1dd99);
          color: var(--ncs-primary, #0A2E73);
        }

        .cardTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .cardIndex {
          min-width: 34px;
          padding: 6px 7px;
          border: 1px solid currentColor;
          border-radius: 8px;
          font-size: 8px;
          font-weight: 950;
          text-align: center;
          opacity: .62;
        }

        .badge {
          max-width: 130px;
          overflow: hidden;
          padding: 6px 9px;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
          font-size: 7px;
          font-weight: 950;
          letter-spacing: .6px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .iconBox {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          margin-top: 18px;
          border: 1px solid rgba(255,255,255,.24);
          border-radius: 14px;
          background: rgba(255,255,255,.12);
          font-size: 22px;
        }

        .offerContent {
          margin-top: 14px;
        }

        .offerContent h3 {
          margin: 5px 0 0;
          font-size: 26px;
          line-height: 1.05;
          letter-spacing: -.8px;
        }

        .offerContent h4 {
          margin: 7px 0 0;
          font-size: 11px;
        }

        .offerContent p {
          display: -webkit-box;
          min-height: 33px;
          overflow: hidden;
          margin: 8px 0 0;
          font-size: 9px;
          line-height: 1.5;
          opacity: .7;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .cardActions {
          display: grid;
          grid-template-columns: 1fr 40px;
          gap: 7px;
          margin-top: auto;
          padding-top: 15px;
        }

        .cardActions button {
          min-height: 38px;
          border: 1px solid rgba(255,255,255,.28);
          border-radius: 10px;
          background: rgba(255,255,255,.12);
          color: inherit;
          font-size: 8px;
          font-weight: 900;
          cursor: pointer;
        }

        .arrowButton {
          font-size: 16px !important;
        }

        .trustNotice {
          min-height: 62px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 28px;
          padding: 12px 14px;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 14px;
          background: rgba(255,255,255,.05);
        }

        .trustNotice > div {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .noticeDot {
          width: 8px;
          height: 8px;
          flex: 0 0 8px;
          border-radius: 50%;
          background: #7cf0a5;
          box-shadow: 0 0 0 5px rgba(124,240,165,.08);
        }

        .trustNotice p {
          margin: 0;
        }

        .trustNotice b,
        .trustNotice small {
          display: block;
        }

        .trustNotice b {
          font-size: 9px;
        }

        .trustNotice small,
        .trustNotice > span {
          color: rgba(255,255,255,.48);
          font-size: 8px;
        }

        .trustNotice small {
          margin-top: 3px;
        }

        .loadingStage {
          margin-top: 38px;
        }

        .loadingHero,
        .loadingCard {
          border: 1px solid rgba(255,255,255,.09);
          background:
            linear-gradient(
              90deg,
              rgba(255,255,255,.06),
              rgba(255,255,255,.14),
              rgba(255,255,255,.06)
            );
          background-size: 200% 100%;
          animation: shimmer 1.2s linear infinite;
        }

        .loadingHero {
          min-height: 340px;
          border-radius: 25px;
        }

        .loadingGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 14px;
        }

        .loadingCard {
          min-height: 255px;
          border-radius: 18px;
        }

        @keyframes shimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }

        @media (max-width: 1050px) {
          .headingRow {
            align-items: flex-start;
            flex-direction: column;
          }

          .offerSignals {
            grid-template-columns: 1fr;
          }

          .offerRail,
          .loadingGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .offersSection {
            padding: 62px 9px 78px;
          }

          h2 {
            font-size: 40px;
          }

          .headingArea > p {
            font-size: 12px;
            line-height: 1.6;
          }

          .allOffersButton {
            width: 100%;
          }

          .offerSignals {
            display: flex;
            overflow-x: auto;
            gap: 8px;
            margin-right: -9px;
            padding-right: 9px;
            scrollbar-width: none;
          }

          .offerSignals::-webkit-scrollbar {
            display: none;
          }

          .offerSignals > div {
            min-width: 230px;
            flex: 0 0 230px;
          }

          .heroOffer {
            min-height: 390px;
            padding: 19px;
            border-radius: 19px;
          }

          .heroOfferContent {
            grid-template-columns: 1fr;
            gap: 14px;
          }

          .heroIcon {
            width: 58px;
            height: 58px;
            font-size: 26px;
          }

          .heroOfferContent h3 {
            font-size: 42px;
          }

          .heroActions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .heroActions button {
            width: 100%;
          }

          .offerRail {
            display: flex;
            overflow-x: auto;
            gap: 10px;
            margin-right: -9px;
            padding-right: 9px;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
          }

          .offerRail::-webkit-scrollbar {
            display: none;
          }

          .offerCard {
            min-width: 78vw;
            flex: 0 0 78vw;
            scroll-snap-align: start;
          }

          .trustNotice {
            align-items: flex-start;
            flex-direction: column;
          }

          .loadingGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
