"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type HeroSlide = {
  id: number;
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
  primaryLabel: string;
  primaryPath: string;
  secondaryLabel: string;
  secondaryPath: string;
  image: string;
  position: string;
  accent: string;
};

const slides: HeroSlide[] = [
  {
    id: 1,
    eyebrow: "NEW CITY STYLE • AI COMMERCE EXPERIENCE",
    title: "Your Family Fashion",
    highlight: "Starts With One Smart Search",
    description:
      "Discover live-stock fashion for men, women and kids with faster search, smarter recommendations and a premium NEW CITY STYLE shopping experience.",
    primaryLabel: "Start Shopping",
    primaryPath: "/search",
    secondaryLabel: "Explore Collections",
    secondaryPath: "/collections",
    image:
      "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=2400&q=90",
    position: "center 42%",
    accent: "AI SHOPPING LIVE",
  },
  {
    id: 2,
    eyebrow: "MEN'S PREMIUM EDIT • LIVE ONLINE STOCK",
    title: "Modern Menswear",
    highlight: "Built Around Your Look",
    description:
      "Sharp shirts, denim and everyday essentials—presented with a cleaner, faster, image-first shopping experience.",
    primaryLabel: "Shop Men",
    primaryPath: "/search?q=Men",
    secondaryLabel: "Trending Styles",
    secondaryPath: "/collections",
    image:
      "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=2400&q=90",
    position: "center 30%",
    accent: "MEN • LIVE PICKS",
  },
  {
    id: 3,
    eyebrow: "WOMEN & KIDS • FESTIVE + EVERYDAY",
    title: "Style Every Moment",
    highlight: "For Every Family Member",
    description:
      "From elegant women’s fashion to joyful kidswear, explore fresh designs, live availability and smarter recommendations.",
    primaryLabel: "Shop Women",
    primaryPath: "/search?q=Women",
    secondaryLabel: "Shop Kids",
    secondaryPath: "/search?q=Kids",
    image:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=2400&q=90",
    position: "center 34%",
    accent: "FAMILY STYLE EDIT",
  },
];

const quickIntents = [
  { label: "Men", query: "men" },
  { label: "Women", query: "women" },
  { label: "Kids", query: "kids" },
  { label: "Shirts under ₹999", query: "shirts under 999" },
  { label: "Fresh arrivals", query: "new arrivals" },
];

export default function Hero() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState("");
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const activeSlide = slides[activeIndex];

  useEffect(() => {
    if (paused) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 7000);

    return () => window.clearInterval(timer);
  }, [paused]);

  const progressKey = useMemo(
    () => `${activeIndex}-${paused ? "paused" : "running"}`,
    [activeIndex, paused]
  );

  function goToSlide(index: number) {
    setActiveIndex(index);
  }

  function previousSlide() {
    setActiveIndex((current) =>
      current === 0 ? slides.length - 1 : current - 1
    );
  }

  function nextSlide() {
    setActiveIndex((current) => (current + 1) % slides.length);
  }

  function submitSmartSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const clean = query.trim();
    if (!clean) {
      router.push("/search");
      return;
    }

    try {
      window.localStorage.setItem("ncs_ai_last_query", clean);
    } catch {
      // Optional personalization memory only.
    }

    router.push(`/search?q=${encodeURIComponent(clean)}`);
  }

  function openIntent(value: string) {
    try {
      window.localStorage.setItem("ncs_ai_last_query", value);
    } catch {
      // Optional personalization memory only.
    }

    router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <section
      className="hero"
      aria-label="NEW CITY STYLE premium shopping experience"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="ambientGrid" />
      <div className="ambientOrb orbOne" />
      <div className="ambientOrb orbTwo" />

      <div className="slides">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          const hasImageError = imageErrors[slide.id];

          return (
            <article
              key={slide.id}
              className={`slide ${isActive ? "activeSlide" : ""}`}
              aria-hidden={!isActive}
            >
              {!hasImageError && (
                <div
                  className="backgroundImage"
                  style={{
                    backgroundImage: `url("${slide.image}")`,
                    backgroundPosition: slide.position,
                  }}
                  role="img"
                  aria-label={`${slide.title} ${slide.highlight}`}
                >
                  <img
                    src={slide.image}
                    alt=""
                    aria-hidden="true"
                    className="imagePreloader"
                    onError={() =>
                      setImageErrors((current) => ({
                        ...current,
                        [slide.id]: true,
                      }))
                    }
                  />
                </div>
              )}

              <div className="fallbackBackground" />
              <div className="photoShade" />
              <div className="softGlow" />

              <div className="contentShell">
                <div className="heroContent">
                  <div className="topSignalRow">
                    <span className="livePill">
                      <i />
                      {slide.accent}
                    </span>
                    <span className="eyebrow">{slide.eyebrow}</span>
                  </div>

                  <h1>
                    <span>{slide.title}</span>
                    <strong>{slide.highlight}</strong>
                  </h1>

                  <p className="heroDescription">{slide.description}</p>

                  <form
                    className="smartSearch"
                    onSubmit={submitSmartSearch}
                    role="search"
                  >
                    <div className="searchIcon">⌕</div>
                    <div className="searchCopy">
                      <small>ASK NEW CITY STYLE</small>
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Try: black shirt under ₹1200, size L"
                        aria-label="Search NEW CITY STYLE"
                      />
                    </div>
                    <button type="submit">
                      <span>Find My Style</span>
                      <b>→</b>
                    </button>
                  </form>

                  <div className="intentRow" aria-label="Popular shopping shortcuts">
                    {quickIntents.map((item) => (
                      <button
                        type="button"
                        key={item.label}
                        onClick={() => openIntent(item.query)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="heroActions">
                    <button
                      type="button"
                      className="primaryButton"
                      onClick={() => router.push(slide.primaryPath)}
                    >
                      <span>{slide.primaryLabel}</span>
                      <b>→</b>
                    </button>

                    <button
                      type="button"
                      className="secondaryButton"
                      onClick={() => router.push(slide.secondaryPath)}
                    >
                      {slide.secondaryLabel}
                    </button>
                  </div>

                  <div className="trustRow">
                    <div>
                      <span>LIVE</span>
                      <p>
                        <strong>Live Availability</strong>
                        <small>Shopping reflects online stock</small>
                      </p>
                    </div>

                    <div>
                      <span>AI</span>
                      <p>
                        <strong>Smart Discovery</strong>
                        <small>Intent-driven recommendations</small>
                      </p>
                    </div>

                    <div>
                      <span>✓</span>
                      <p>
                        <strong>Trusted Store</strong>
                        <small>NEW CITY STYLE customer service</small>
                      </p>
                    </div>
                  </div>
                </div>

                <aside className="commerceDeck" aria-label="NEW CITY STYLE quick shopping">
                  <div className="deckTop">
                    <span>NEW CITY STYLE</span>
                    <i>2036 COMMERCE</i>
                  </div>

                  <strong>
                    A smarter way
                    <br />
                    to shop fashion.
                  </strong>

                  <p>
                    Search naturally, discover live products and continue directly
                    into the catalogue.
                  </p>

                  <div className="deckTiles">
                    <button
                      type="button"
                      onClick={() => router.push("/search?q=Men")}
                    >
                      <span>MEN</span>
                      <b>Shop →</b>
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push("/search?q=Women")}
                    >
                      <span>WOMEN</span>
                      <b>Explore →</b>
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push("/search?q=Kids")}
                    >
                      <span>KIDS</span>
                      <b>Discover →</b>
                    </button>
                  </div>

                  <div className="deckFooter">
                    <span className="pulseDot" />
                    <p>
                      <b>AI Shopping is active</b>
                      <small>Search + live catalogue working together</small>
                    </p>
                  </div>
                </aside>
              </div>
            </article>
          );
        })}
      </div>

      <button
        type="button"
        className="sliderArrow leftArrow"
        onClick={previousSlide}
        aria-label="Previous hero slide"
      >
        ‹
      </button>

      <button
        type="button"
        className="sliderArrow rightArrow"
        onClick={nextSlide}
        aria-label="Next hero slide"
      >
        ›
      </button>

      <div className="sliderFooter">
        <div className="dots" role="tablist" aria-label="Hero slides">
          {slides.map((slide, index) => (
            <button
              type="button"
              key={slide.id}
              className={index === activeIndex ? "activeDot" : ""}
              onClick={() => goToSlide(index)}
              aria-label={`Show slide ${index + 1}`}
              aria-selected={index === activeIndex}
              role="tab"
            >
              <span />
            </button>
          ))}
        </div>

        <div className="slideCounter">
          <strong>{String(activeIndex + 1).padStart(2, "0")}</strong>
          <span>/</span>
          <small>{String(slides.length).padStart(2, "0")}</small>
        </div>
      </div>

      {!paused && (
        <div className="progressTrack" key={progressKey}>
          <span />
        </div>
      )}

      <div className="bottomFade" />

      <style jsx>{`
        .hero {
          position: relative;
          min-height: min(860px, calc(100vh - 72px));
          overflow: hidden;
          isolation: isolate;
          background: #061735;
        }

        .slides,
        .slide {
          position: absolute;
          inset: 0;
        }

        .slide {
          opacity: 0;
          visibility: hidden;
          transform: scale(1.018);
          transition:
            opacity 0.75s ease,
            visibility 0.75s ease,
            transform 7s ease;
        }

        .activeSlide {
          opacity: 1;
          visibility: visible;
          transform: scale(1);
          z-index: 2;
        }

        .backgroundImage,
        .fallbackBackground,
        .photoShade,
        .softGlow {
          position: absolute;
          inset: 0;
        }

        .backgroundImage {
          z-index: 1;
          background-repeat: no-repeat;
          background-size: cover;
          filter: saturate(0.94) contrast(1.04);
          animation: cinematicZoom 8s ease-out both;
        }

        .imagePreloader {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }

        .fallbackBackground {
          z-index: 0;
          background:
            radial-gradient(circle at 78% 22%, rgba(212, 175, 55, 0.16), transparent 24%),
            linear-gradient(135deg, #061735 0%, #0a2e73 48%, #174d98 100%);
        }

        .photoShade {
          z-index: 2;
          background:
            linear-gradient(
              90deg,
              rgba(2, 13, 34, 0.98) 0%,
              rgba(4, 26, 65, 0.92) 34%,
              rgba(5, 31, 75, 0.68) 57%,
              rgba(5, 24, 55, 0.3) 100%
            ),
            linear-gradient(
              180deg,
              rgba(0, 0, 0, 0.06),
              rgba(0, 0, 0, 0.52)
            );
        }

        .softGlow {
          z-index: 3;
          pointer-events: none;
          background:
            radial-gradient(circle at 81% 24%, rgba(212, 175, 55, 0.2), transparent 22%),
            radial-gradient(circle at 18% 72%, rgba(74, 144, 226, 0.14), transparent 28%);
        }

        .ambientGrid {
          position: absolute;
          z-index: 4;
          inset: 0;
          opacity: 0.08;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: linear-gradient(90deg, rgba(0,0,0,.85), transparent 72%);
        }

        .ambientOrb {
          position: absolute;
          z-index: 4;
          width: 360px;
          height: 360px;
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
        }

        .orbOne {
          top: -180px;
          left: 6%;
          background: rgba(51, 103, 220, 0.22);
        }

        .orbTwo {
          right: 10%;
          bottom: -220px;
          background: rgba(212, 175, 55, 0.2);
        }

        .contentShell {
          position: relative;
          z-index: 7;
          width: min(1520px, calc(100% - 54px));
          min-height: min(860px, calc(100vh - 72px));
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(330px, 410px);
          align-items: center;
          gap: 78px;
          margin: 0 auto;
          padding: 86px 0 120px;
        }

        .heroContent {
          max-width: 900px;
          color: white;
          animation: contentReveal 0.85s ease both;
        }

        .topSignalRow {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 22px;
        }

        .livePill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 29px;
          padding: 0 11px;
          border: 1px solid rgba(255,255,255,.24);
          border-radius: 999px;
          background: rgba(255,255,255,.08);
          color: #fff;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1.2px;
          backdrop-filter: blur(12px);
        }

        .livePill i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #77f2a6;
          box-shadow: 0 0 12px rgba(119, 242, 166, .95);
        }

        .eyebrow {
          color: #eedc9a;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.9px;
        }

        h1 {
          margin: 0;
          font-size: clamp(48px, 6.1vw, 92px);
          line-height: 0.96;
          letter-spacing: -3.4px;
          text-wrap: balance;
        }

        h1 span,
        h1 strong {
          display: block;
        }

        h1 span {
          color: #fff;
          font-weight: 660;
        }

        h1 strong {
          margin-top: 9px;
          color: #d4af37;
          font-weight: 900;
          text-shadow: 0 16px 48px rgba(212, 175, 55, .2);
        }

        .heroDescription {
          max-width: 730px;
          margin: 25px 0 0;
          color: rgba(255,255,255,.82);
          font-size: clamp(15px, 1.4vw, 19px);
          line-height: 1.72;
        }

        .smartSearch {
          max-width: 810px;
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          margin-top: 30px;
          padding: 9px 10px 9px 12px;
          border: 1px solid rgba(255,255,255,.22);
          border-radius: 18px;
          background: rgba(255,255,255,.11);
          box-shadow:
            0 20px 55px rgba(0,0,0,.18),
            inset 0 1px rgba(255,255,255,.12);
          backdrop-filter: blur(18px);
        }

        .searchIcon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: rgba(212,175,55,.14);
          color: #e8cc6b;
          font-size: 24px;
          font-weight: 900;
        }

        .searchCopy {
          min-width: 0;
        }

        .searchCopy small {
          display: block;
          margin-bottom: 4px;
          color: #e3c865;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1.5px;
        }

        .searchCopy input {
          width: 100%;
          padding: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #fff;
          font-size: 14px;
          font-weight: 650;
        }

        .searchCopy input::placeholder {
          color: rgba(255,255,255,.56);
        }

        .smartSearch > button {
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 0 17px;
          border: 1px solid #d4af37;
          border-radius: 13px;
          background: linear-gradient(135deg, #d4af37, #f0d985);
          color: #071d49;
          font-size: 11px;
          font-weight: 950;
          cursor: pointer;
          white-space: nowrap;
        }

        .smartSearch > button b {
          font-size: 17px;
        }

        .intentRow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .intentRow button {
          min-height: 30px;
          padding: 0 11px;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 999px;
          background: rgba(4,23,58,.48);
          color: rgba(255,255,255,.84);
          font-size: 9px;
          font-weight: 800;
          cursor: pointer;
          backdrop-filter: blur(10px);
          transition: .2s ease;
        }

        .intentRow button:hover {
          border-color: rgba(212,175,55,.8);
          color: #f0d985;
          transform: translateY(-1px);
        }

        .heroActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 26px;
        }

        .heroActions button {
          min-height: 50px;
          padding: 0 20px;
          border-radius: 13px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          transition: .22s ease;
        }

        .heroActions button:hover {
          transform: translateY(-2px);
        }

        .primaryButton {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          border: 1px solid #d4af37;
          background: #d4af37;
          color: #071d49;
          box-shadow: 0 14px 34px rgba(212,175,55,.2);
        }

        .primaryButton b {
          font-size: 17px;
        }

        .secondaryButton {
          border: 1px solid rgba(255,255,255,.3);
          background: rgba(255,255,255,.07);
          color: #fff;
          backdrop-filter: blur(12px);
        }

        .trustRow {
          max-width: 780px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
          margin-top: 26px;
        }

        .trustRow > div {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 10px 11px;
          border: 1px solid rgba(255,255,255,.11);
          border-radius: 12px;
          background: rgba(255,255,255,.05);
          backdrop-filter: blur(10px);
        }

        .trustRow > div > span {
          min-width: 34px;
          height: 28px;
          display: grid;
          place-items: center;
          padding: 0 6px;
          border-radius: 8px;
          background: rgba(212,175,55,.14);
          color: #ecd36e;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .6px;
        }

        .trustRow p {
          margin: 0;
        }

        .trustRow strong,
        .trustRow small {
          display: block;
        }

        .trustRow strong {
          color: #fff;
          font-size: 10px;
        }

        .trustRow small {
          margin-top: 2px;
          color: rgba(255,255,255,.56);
          font-size: 8px;
        }

        .commerceDeck {
          align-self: center;
          padding: 25px;
          border: 1px solid rgba(255,255,255,.22);
          border-radius: 28px;
          background:
            linear-gradient(180deg, rgba(11, 42, 92, .74), rgba(4, 24, 57, .76));
          color: #fff;
          box-shadow:
            0 34px 90px rgba(0,0,0,.3),
            inset 0 1px rgba(255,255,255,.1);
          backdrop-filter: blur(24px);
          animation: deckReveal 1s .12s ease both;
        }

        .deckTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .deckTop span {
          color: #e8cf70;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1.5px;
        }

        .deckTop i {
          padding: 5px 7px;
          border-radius: 999px;
          background: rgba(255,255,255,.07);
          color: rgba(255,255,255,.52);
          font-size: 7px;
          font-style: normal;
          font-weight: 800;
        }

        .commerceDeck > strong {
          display: block;
          margin-top: 20px;
          color: #fff;
          font-size: clamp(26px, 2.2vw, 34px);
          line-height: 1.12;
          letter-spacing: -1.1px;
        }

        .commerceDeck > p {
          margin: 11px 0 0;
          color: rgba(255,255,255,.65);
          font-size: 11px;
          line-height: 1.65;
        }

        .deckTiles {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 20px;
        }

        .deckTiles button {
          min-height: 92px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: space-between;
          padding: 12px;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 14px;
          background: rgba(255,255,255,.06);
          color: #fff;
          cursor: pointer;
          text-align: left;
          transition: .2s ease;
        }

        .deckTiles button:hover {
          border-color: rgba(212,175,55,.62);
          background: rgba(212,175,55,.1);
          transform: translateY(-2px);
        }

        .deckTiles span {
          color: #ead16e;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .deckTiles b {
          font-size: 10px;
        }

        .deckFooter {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 17px;
          padding: 12px;
          border-radius: 13px;
          background: rgba(2, 18, 44, .42);
        }

        .pulseDot {
          width: 9px;
          height: 9px;
          flex: 0 0 9px;
          border-radius: 50%;
          background: #7af0a5;
          box-shadow: 0 0 0 5px rgba(122,240,165,.1), 0 0 16px rgba(122,240,165,.65);
        }

        .deckFooter p {
          margin: 0;
        }

        .deckFooter b,
        .deckFooter small {
          display: block;
        }

        .deckFooter b {
          color: #fff;
          font-size: 9px;
        }

        .deckFooter small {
          margin-top: 2px;
          color: rgba(255,255,255,.48);
          font-size: 7px;
        }

        .sliderArrow {
          position: absolute;
          z-index: 13;
          top: 50%;
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.24);
          border-radius: 50%;
          background: rgba(3, 20, 49, .55);
          color: #fff;
          font-size: 30px;
          cursor: pointer;
          backdrop-filter: blur(10px);
          transform: translateY(-50%);
          transition: .2s ease;
        }

        .sliderArrow:hover {
          border-color: #d4af37;
          transform: translateY(-50%) scale(1.04);
        }

        .leftArrow {
          left: 16px;
        }

        .rightArrow {
          right: 16px;
        }

        .sliderFooter {
          position: absolute;
          z-index: 13;
          right: max(40px, calc((100% - 1520px) / 2 + 24px));
          bottom: 34px;
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .dots {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .dots button {
          width: 28px;
          height: 7px;
          overflow: hidden;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: rgba(255,255,255,.22);
          cursor: pointer;
          transition: .2s ease;
        }

        .dots button span {
          display: block;
          width: 100%;
          height: 100%;
        }

        .dots .activeDot {
          width: 54px;
          background: #d4af37;
        }

        .slideCounter {
          display: flex;
          align-items: baseline;
          gap: 4px;
          color: rgba(255,255,255,.6);
        }

        .slideCounter strong {
          color: #d4af37;
          font-size: 16px;
        }

        .slideCounter small {
          font-size: 10px;
        }

        .progressTrack {
          position: absolute;
          z-index: 14;
          right: 0;
          bottom: 0;
          left: 0;
          height: 3px;
          background: rgba(255,255,255,.08);
        }

        .progressTrack span {
          display: block;
          width: 0;
          height: 100%;
          background: linear-gradient(90deg, #d4af37, #f0da87);
          animation: progress 7s linear forwards;
        }

        .bottomFade {
          position: absolute;
          z-index: 11;
          right: 0;
          bottom: 0;
          left: 0;
          height: 100px;
          pointer-events: none;
          background: linear-gradient(180deg, transparent, rgba(247,248,252,.04));
        }

        @keyframes cinematicZoom {
          from { transform: scale(1.075); }
          to { transform: scale(1); }
        }

        @keyframes contentReveal {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes deckReveal {
          from {
            opacity: 0;
            transform: translateY(22px) scale(.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes progress {
          from { width: 0; }
          to { width: 100%; }
        }

        @media (max-width: 1180px) {
          .contentShell {
            grid-template-columns: 1fr;
            gap: 28px;
          }

          .commerceDeck {
            display: none;
          }

          .heroContent {
            max-width: 920px;
          }
        }

        @media (max-width: 760px) {
          .hero {
            min-height: 820px;
          }

          .contentShell {
            width: calc(100% - 26px);
            min-height: 820px;
            padding: 72px 2px 108px;
          }

          .photoShade {
            background:
              linear-gradient(
                180deg,
                rgba(2, 15, 38, .82) 0%,
                rgba(4, 27, 68, .9) 42%,
                rgba(2, 16, 40, .98) 100%
              );
          }

          .backgroundImage {
            background-position: center top !important;
          }

          h1 {
            font-size: clamp(43px, 12vw, 66px);
            letter-spacing: -2.2px;
          }

          .heroDescription {
            font-size: 14px;
            line-height: 1.62;
          }

          .smartSearch {
            grid-template-columns: 38px 1fr;
            gap: 8px;
            padding: 9px;
          }

          .searchIcon {
            width: 36px;
            height: 36px;
            font-size: 20px;
          }

          .smartSearch > button {
            grid-column: 1 / -1;
            width: 100%;
            min-height: 44px;
          }

          .intentRow {
            overflow-x: auto;
            flex-wrap: nowrap;
            padding-bottom: 3px;
            scrollbar-width: none;
          }

          .intentRow::-webkit-scrollbar {
            display: none;
          }

          .intentRow button {
            flex: 0 0 auto;
          }

          .heroActions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .heroActions button {
            width: 100%;
            min-height: 46px;
            padding: 0 12px;
          }

          .trustRow {
            grid-template-columns: 1fr 1fr;
          }

          .trustRow > div:nth-child(3) {
            display: none;
          }

          .sliderArrow {
            top: auto;
            bottom: 38px;
            width: 40px;
            height: 40px;
            font-size: 25px;
          }

          .leftArrow {
            left: 13px;
          }

          .rightArrow {
            right: 13px;
          }

          .sliderFooter {
            right: 50%;
            bottom: 47px;
            transform: translateX(50%);
          }

          .slideCounter {
            display: none;
          }
        }

        @media (max-width: 430px) {
          .hero {
            min-height: 850px;
          }

          .contentShell {
            min-height: 850px;
          }

          .topSignalRow {
            align-items: flex-start;
          }

          .eyebrow {
            max-width: 220px;
            line-height: 1.45;
          }

          .trustRow {
            grid-template-columns: 1fr;
          }

          .trustRow > div:nth-child(2) {
            display: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .slide,
          .backgroundImage,
          .heroContent,
          .commerceDeck,
          .progressTrack span {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
