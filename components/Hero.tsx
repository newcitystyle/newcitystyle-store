"use client";

import { useEffect, useMemo, useState } from "react";
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
};

const slides: HeroSlide[] = [
  {
    id: 1,
    eyebrow: "NEW SEASON • PREMIUM FAMILY FASHION",
    title: "Style That Brings",
    highlight: "Every Family Together",
    description:
      "Discover premium fashion for men, women and kids—carefully selected for comfort, quality and confidence.",
    primaryLabel: "Shop New Arrivals",
    primaryPath: "/products",
    secondaryLabel: "Explore Collections",
    secondaryPath: "/collections",
    
      image:
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=2200&q=90",
position: "center 42%",
  },
  {
    id: 2,
    eyebrow: "MEN'S PREMIUM COLLECTION",
    title: "Confidence Begins",
    highlight: "With The Right Look",
    description:
      "Sharp shirts, premium denim and versatile everyday styles designed for modern men.",
    primaryLabel: "Shop Men",
    primaryPath: "/products?category=Men",
    secondaryLabel: "View Trending Styles",
    secondaryPath: "/collections",
    image:
      "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=2200&q=88",
    position: "center 30%",
  },
  {
    id: 3,
    eyebrow: "WOMEN & KIDS FESTIVE EDIT",
    title: "Celebrate Every Moment",
    highlight: "In Signature Style",
    description:
      "Elegant sarees, festive wear and charming kids' fashion for every celebration and special memory.",
    primaryLabel: "Shop Women",
    primaryPath: "/products?category=Women",
    secondaryLabel: "Shop Kids",
    secondaryPath: "/products?category=Kids",
    image:
      "https://images.unsplash.com/photo-1583391733956-6c78276477e2?auto=format&fit=crop&w=2200&q=88",
    position: "center 28%",
  },
];

export default function Hero() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const activeSlide = slides[activeIndex];

  useEffect(() => {
    if (paused) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 6500);

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

  return (
    <section
      className="hero"
      aria-label="NEW CITY STYLE promotional banner"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
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
                  onAnimationEnd={() => undefined}
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
              <div className="blueOverlay" />
              <div className="goldGlow" />
              <div className="patternOverlay" />

              <div className="contentShell">
                <div className="heroContent">
                  <div className="eyebrow">
                    <span className="eyebrowLine" />
                    {slide.eyebrow}
                  </div>

                  <h1>
                    <span>{slide.title}</span>
                    <strong>{slide.highlight}</strong>
                  </h1>

                  <p>{slide.description}</p>

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
                      <span>✓</span>
                      <p>
                        <strong>Premium Quality</strong>
                        <small>Carefully selected fashion</small>
                      </p>
                    </div>

                    <div>
                      <span>🚚</span>
                      <p>
                        <strong>Fast Delivery</strong>
                        <small>Secure shipping across India</small>
                      </p>
                    </div>

                    <div>
                      <span>↺</span>
                      <p>
                        <strong>Easy Returns</strong>
                        <small>Simple customer-friendly policy</small>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="floatingCard">
                  <span className="floatingLabel">NEW CITY STYLE</span>
                  <strong>Style for Every Family</strong>
                  <p>Premium fashion. Trusted quality. Honest value.</p>

                  <div className="floatingStats">
                    <div>
                      <b>Men</b>
                      <small>Modern essentials</small>
                    </div>

                    <div>
                      <b>Women</b>
                      <small>Elegant collections</small>
                    </div>

                    <div>
                      <b>Kids</b>
                      <small>Comfort with style</small>
                    </div>
                  </div>
                </div>
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

      <div className="bottomCurve" />

      <style jsx>{`
        .hero {
          position: relative;
          min-height: min(820px, calc(100vh - 80px));
          overflow: hidden;
          isolation: isolate;
          background: #061b45;
        }

        .slides,
        .slide {
          position: absolute;
          inset: 0;
        }

        .slide {
          opacity: 0;
          visibility: hidden;
          transform: scale(1.025);
          transition:
            opacity 0.8s ease,
            visibility 0.8s ease,
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
        .blueOverlay,
        .goldGlow,
        .patternOverlay {
          position: absolute;
          inset: 0;
        }

        .backgroundImage {
          z-index: 1;
          background-repeat: no-repeat;
          background-size: cover;
          filter: saturate(0.98) contrast(1.04);
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
            radial-gradient(
              circle at 78% 36%,
              rgba(212, 175, 55, 0.24),
              transparent 25%
            ),
            linear-gradient(120deg, #061b45 0%, #0a2e73 52%, #123f91 100%);
        }

        .blueOverlay {
          z-index: 2;
          background:
            linear-gradient(
              90deg,
              rgba(3, 19, 52, 0.98) 0%,
              rgba(6, 31, 79, 0.94) 34%,
              rgba(8, 38, 94, 0.7) 58%,
              rgba(7, 28, 67, 0.3) 100%
            ),
            linear-gradient(
              180deg,
              rgba(3, 14, 39, 0.15),
              rgba(3, 14, 39, 0.5)
            );
        }

        .goldGlow {
          z-index: 3;
          background:
            radial-gradient(
              circle at 80% 26%,
              rgba(212, 175, 55, 0.23),
              transparent 22%
            ),
            radial-gradient(
              circle at 18% 78%,
              rgba(212, 175, 55, 0.13),
              transparent 25%
            );
          pointer-events: none;
        }

        .patternOverlay {
          z-index: 4;
          opacity: 0.18;
          background-image:
            linear-gradient(
              rgba(255, 255, 255, 0.08) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.08) 1px,
              transparent 1px
            );
          background-size: 70px 70px;
          mask-image: linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.8),
            transparent 68%
          );
        }

        .contentShell {
          position: relative;
          z-index: 6;
          width: min(1500px, calc(100% - 48px));
          min-height: min(820px, calc(100vh - 80px));
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(310px, 420px);
          align-items: center;
          gap: 70px;
          margin: 0 auto;
          padding: 90px 0 110px;
        }

        .heroContent {
          max-width: 830px;
          color: white;
          animation: contentReveal 0.9s ease both;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 22px;
          color: #f1d26a;
          font-size: clamp(11px, 1.2vw, 14px);
          font-weight: 850;
          letter-spacing: 2.4px;
        }

        .eyebrowLine {
          width: 48px;
          height: 2px;
          background: linear-gradient(90deg, #d4af37, #fff0aa);
          box-shadow: 0 0 18px rgba(212, 175, 55, 0.7);
        }

        h1 {
          margin: 0;
          font-size: clamp(48px, 6.5vw, 96px);
          line-height: 0.98;
          letter-spacing: -3.2px;
          text-wrap: balance;
        }

        h1 span,
        h1 strong {
          display: block;
        }

        h1 span {
          color: #ffffff;
          font-weight: 720;
        }

        h1 strong {
          margin-top: 8px;
          color: #d4af37;
          font-weight: 900;
          text-shadow: 0 10px 38px rgba(212, 175, 55, 0.2);
        }

        .heroContent > p {
          max-width: 700px;
          margin: 27px 0 0;
          color: rgba(255, 255, 255, 0.84);
          font-size: clamp(16px, 1.5vw, 20px);
          line-height: 1.75;
          text-wrap: balance;
        }

        .heroActions {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 35px;
        }

        .heroActions button {
          min-height: 58px;
          padding: 0 24px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 850;
          cursor: pointer;
          transition:
            transform 0.25s ease,
            box-shadow 0.25s ease,
            background 0.25s ease;
        }

        .heroActions button:hover {
          transform: translateY(-3px);
        }

        .primaryButton {
          position: relative;
          overflow: hidden;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          border: 1px solid #d4af37;
          background: linear-gradient(135deg, #d4af37, #f1d26a);
          color: #071d49;
          box-shadow: 0 16px 35px rgba(212, 175, 55, 0.25);
        }

        .primaryButton::after {
          position: absolute;
          top: -65%;
          left: -65%;
          width: 35%;
          height: 230%;
          content: "";
          background: rgba(255, 255, 255, 0.5);
          transform: rotate(24deg);
          animation: buttonShine 3.2s infinite;
        }

        .primaryButton b {
          font-size: 19px;
        }

        .secondaryButton {
          border: 1px solid rgba(255, 255, 255, 0.42);
          background: rgba(255, 255, 255, 0.09);
          color: white;
          backdrop-filter: blur(12px);
        }

        .secondaryButton:hover {
          border-color: #d4af37;
          background: rgba(212, 175, 55, 0.12);
        }

        .trustRow {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          max-width: 760px;
          margin-top: 42px;
        }

        .trustRow > div {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.07);
          backdrop-filter: blur(12px);
        }

        .trustRow > div > span {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 10px;
          background: rgba(212, 175, 55, 0.17);
          color: #f1d26a;
          font-size: 15px;
          font-weight: 900;
        }

        .trustRow p {
          margin: 0;
        }

        .trustRow strong,
        .trustRow small {
          display: block;
        }

        .trustRow strong {
          color: white;
          font-size: 11px;
        }

        .trustRow small {
          margin-top: 3px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 9px;
        }

        .floatingCard {
          align-self: end;
          margin-bottom: 90px;
          padding: 27px;
          border: 1px solid rgba(255, 255, 255, 0.24);
          border-radius: 24px;
          background: rgba(6, 30, 75, 0.64);
          color: white;
          box-shadow: 0 24px 70px rgba(2, 12, 34, 0.32);
          backdrop-filter: blur(18px);
          animation: floatingReveal 1s 0.15s ease both;
        }

        .floatingLabel {
          display: inline-flex;
          padding: 6px 9px;
          border-radius: 999px;
          background: rgba(212, 175, 55, 0.16);
          color: #f1d26a;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.4px;
        }

        .floatingCard > strong {
          display: block;
          margin-top: 15px;
          color: #d4af37;
          font-size: 26px;
          line-height: 1.2;
        }

        .floatingCard > p {
          margin: 10px 0 0;
          color: rgba(255, 255, 255, 0.76);
          font-size: 13px;
          line-height: 1.6;
        }

        .floatingStats {
          display: grid;
          gap: 9px;
          margin-top: 21px;
        }

        .floatingStats > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 10px 12px;
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.08);
        }

        .floatingStats b {
          color: white;
          font-size: 12px;
        }

        .floatingStats small {
          color: rgba(255, 255, 255, 0.58);
          font-size: 10px;
        }

        .sliderArrow {
          position: absolute;
          z-index: 12;
          top: 50%;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          background: rgba(4, 22, 58, 0.58);
          color: white;
          font-size: 34px;
          cursor: pointer;
          backdrop-filter: blur(10px);
          transform: translateY(-50%);
          transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            background 0.2s ease;
        }

        .sliderArrow:hover {
          border-color: #d4af37;
          background: rgba(10, 46, 115, 0.9);
          transform: translateY(-50%) scale(1.06);
        }

        .leftArrow {
          left: 18px;
        }

        .rightArrow {
          right: 18px;
        }

        .sliderFooter {
          position: absolute;
          z-index: 12;
          right: max(42px, calc((100% - 1500px) / 2 + 24px));
          bottom: 44px;
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .dots {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dots button {
          width: 33px;
          height: 8px;
          overflow: hidden;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.27);
          cursor: pointer;
          transition:
            width 0.25s ease,
            background 0.25s ease;
        }

        .dots button span {
          display: block;
          width: 100%;
          height: 100%;
        }

        .dots .activeDot {
          width: 60px;
          background: #d4af37;
        }

        .slideCounter {
          display: flex;
          align-items: baseline;
          gap: 5px;
          color: white;
        }

        .slideCounter strong {
          color: #d4af37;
          font-size: 18px;
        }

        .slideCounter span,
        .slideCounter small {
          color: rgba(255, 255, 255, 0.62);
        }

        .progressTrack {
          position: absolute;
          z-index: 13;
          right: 0;
          bottom: 0;
          left: 0;
          height: 4px;
          background: rgba(255, 255, 255, 0.12);
        }

        .progressTrack span {
          display: block;
          width: 0;
          height: 100%;
          background: linear-gradient(90deg, #d4af37, #fff0aa);
          animation: progress 6.5s linear forwards;
        }

        .bottomCurve {
          position: absolute;
          z-index: 10;
          right: -4%;
          bottom: -55px;
          left: -4%;
          height: 105px;
          border-radius: 50% 50% 0 0;
          background: #f8f4ec;
        }

        @keyframes cinematicZoom {
          from {
            transform: scale(1.09);
          }
          to {
            transform: scale(1);
          }
        }

        @keyframes contentReveal {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes floatingReveal {
          from {
            opacity: 0;
            transform: translateY(25px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes buttonShine {
          0% {
            left: -65%;
          }
          58%,
          100% {
            left: 135%;
          }
        }

        @keyframes progress {
          from {
            width: 0;
          }
          to {
            width: 100%;
          }
        }

        @media (max-width: 1150px) {
          .contentShell {
            grid-template-columns: 1fr;
          }

          .floatingCard {
            display: none;
          }

          .heroContent {
            max-width: 850px;
          }
        }

        @media (max-width: 760px) {
          .hero {
            min-height: 760px;
          }

          .contentShell {
            width: calc(100% - 28px);
            min-height: 760px;
            padding: 80px 4px 110px;
          }

          .blueOverlay {
            background:
              linear-gradient(
                180deg,
                rgba(3, 19, 52, 0.9) 0%,
                rgba(5, 29, 74, 0.9) 45%,
                rgba(3, 18, 48, 0.96) 100%
              );
          }

          .backgroundImage {
            background-position: center top !important;
          }

          h1 {
            font-size: clamp(45px, 13vw, 67px);
            letter-spacing: -2px;
          }

          .heroContent > p {
            font-size: 15px;
            line-height: 1.65;
          }

          .heroActions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .heroActions button {
            width: 100%;
          }

          .trustRow {
            grid-template-columns: 1fr;
            max-width: 360px;
            gap: 8px;
            margin-top: 28px;
          }

          .sliderArrow {
            top: auto;
            bottom: 44px;
            width: 42px;
            height: 42px;
            font-size: 28px;
          }

          .leftArrow {
            left: 15px;
          }

          .rightArrow {
            right: 15px;
          }

          .sliderFooter {
            right: 50%;
            bottom: 52px;
            transform: translateX(50%);
          }

          .slideCounter {
            display: none;
          }

          .bottomCurve {
            bottom: -68px;
          }
        }

        @media (max-width: 430px) {
          .hero {
            min-height: 790px;
          }

          .contentShell {
            min-height: 790px;
          }

          .eyebrow {
            align-items: flex-start;
            line-height: 1.5;
          }

          .eyebrowLine {
            margin-top: 7px;
          }

          .trustRow > div:nth-child(3) {
            display: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .slide,
          .backgroundImage,
          .heroContent,
          .floatingCard,
          .progressTrack span,
          .primaryButton::after {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
