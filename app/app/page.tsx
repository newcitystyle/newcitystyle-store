"use client";

import { useEffect, useState } from "react";

type LatestApp = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  sha256: string;
  sizeMb?: number;
  force?: boolean;
  releaseNotes?: string[];
  publishedAt?: string;
};

const FALLBACK: LatestApp = {
  versionCode: 2,
  versionName: "2.0.0",
  apkUrl: "/app/new-city-style.apk",
  sha256: "",
  releaseNotes: [
    "Premium NEW CITY STYLE shopping experience",
    "Advanced Ask NCS live catalogue search",
    "Secure direct updates from newcitystyle.store",
  ],
};

function shortHash(value: string) {
  if (!value) return "Generated with the signed release";
  if (value.length <= 28) return value;
  return `${value.slice(0, 14)}…${value.slice(-14)}`;
}

export default function AndroidAppDownloadPage() {
  const [latest, setLatest] = useState<LatestApp>(FALLBACK);

  useEffect(() => {
    let alive = true;

    fetch("/app/latest.json", {
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error("Version file unavailable");
        return response.json();
      })
      .then((value: LatestApp) => {
        if (alive) setLatest(value);
      })
      .catch(() => {
        // Keep the safe fallback page available even before the first release.
      });

    return () => {
      alive = false;
    };
  }, []);

  const downloadUrl = "/api/app-download";

  return (
    <main className="page">
      <section className="hero">
        <div className="brandBar">
          <div className="mark">NCS</div>
          <div>
            <span className="eyebrow">NEW CITY STYLE • ANDROID</span>
            <h1>Shop with NEW CITY STYLE</h1>
          </div>
          <div className="official">OFFICIAL</div>
        </div>

        <div className="heroGrid">
          <div className="copy">
            <div className="securePill">✓ SECURE DIRECT DOWNLOAD</div>

            <h2>
              Your store.
              <br />
              Now in your pocket.
            </h2>

            <p className="lead">
              Browse live products, use Ask NCS, save favourites, manage your
              cart and shop directly from the official NEW CITY STYLE Android
              app.
            </p>

            <div className="actions">
              <button
                type="button"
                className="download"
                onClick={() => {
                  window.location.href =
                    "/api/app-download";
                }}
              >
                <span>↓</span>
                Download Android App
              </button>

              <a className="secondary" href="#install">
                How to install
              </a>
            </div>

            <p className="downloadFallback">
              Secure download not starting?{" "}
              <a href="/api/app-download">
                Tap here to download the APK directly
              </a>
              .
            </p>

            <div className="trust">
              <div>
                <span>VERSION</span>
                <strong>{latest.versionName}</strong>
              </div>
              <div>
                <span>SIZE</span>
                <strong>
                  {latest.sizeMb ? `${latest.sizeMb} MB` : "Release build"}
                </strong>
              </div>
              <div>
                <span>SOURCE</span>
                <strong>newcitystyle.store</strong>
              </div>
            </div>
          </div>

          <div className="phone">
            <div className="phoneTop">
              <span>NEW CITY STYLE</span>
              <span>LIVE</span>
            </div>

            <div className="screen">
              <div className="screenHero">
                <span>SMART SHOPPING</span>
                <h3>Find exactly what you want</h3>
              </div>

              <div className="ask">✦ ASK NCS</div>

              <div className="search">
                <span>⌕</span>
                black shirt XL under 999
              </div>

              <div className="miniGrid">
                <div>MEN</div>
                <div>WOMEN</div>
                <div>KIDS</div>
              </div>

              <div className="product">
                <div className="productImage">NCS</div>
                <div>
                  <span>LIVE CATALOGUE</span>
                  <strong>Premium fashion, ready to shop</strong>
                </div>
              </div>
            </div>

            <div className="phoneNav">
              <span>HOME</span>
              <span>SHOP</span>
              <span>♡</span>
              <span>CART</span>
            </div>
          </div>
        </div>
      </section>

      <section className="release">
        <div>
          <span className="eyebrow dark">CURRENT RELEASE</span>
          <h3>Version {latest.versionName}</h3>
          <p>
            Future versions are detected automatically inside the app. Update
            only from this official NEW CITY STYLE website.
          </p>
        </div>

        <ul>
          {(latest.releaseNotes ?? FALLBACK.releaseNotes)?.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section className="install" id="install">
        <div className="installTitle">
          <span className="eyebrow dark">FIRST INSTALL</span>
          <h3>Four simple steps</h3>
        </div>

        <div className="steps">
          <article>
            <b>01</b>
            <h4>Download</h4>
            <p>Tap “Download Android App” on this page.</p>
          </article>

          <article>
            <b>02</b>
            <h4>Open the APK</h4>
            <p>Open the downloaded NEW CITY STYLE APK from your browser.</p>
          </article>

          <article>
            <b>03</b>
            <h4>Allow this source</h4>
            <p>
              If Android asks, allow installation from your browser for this
              one install.
            </p>
          </article>

          <article>
            <b>04</b>
            <h4>Install / Update</h4>
            <p>
              Tap Install. Future signed versions update the same NEW CITY
              STYLE app.
            </p>
          </article>
        </div>
      </section>

      <section className="security">
        <div className="shield">✓</div>
        <div>
          <span className="eyebrow dark">SECURITY CHECK</span>
          <h3>Official NEW CITY STYLE release</h3>
          <p>
            Only install an APK downloaded from{" "}
            <strong>newcitystyle.store</strong>. Every release uses the same
            private NEW CITY STYLE signing key so Android can verify future
            updates belong to the same app.
          </p>
          <code>SHA-256: {shortHash(latest.sha256)}</code>
        </div>
      </section>

      <footer>
        <strong>NEW CITY STYLE</strong>
        <span>READY MADE • Android App</span>
      </footer>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          background: #f4f5f7;
          color: #122038;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 88% 2%,
              rgba(219, 183, 95, 0.2),
              transparent 28%
            ),
            #f4f5f7;
        }

        .hero {
          padding: 24px clamp(18px, 5vw, 76px) 62px;
          color: white;
          background:
            radial-gradient(
              circle at 75% 34%,
              rgba(23, 120, 229, 0.3),
              transparent 28%
            ),
            linear-gradient(135deg, #04142a 0%, #082a50 54%, #0c4b82 100%);
          overflow: hidden;
        }

        .brandBar {
          max-width: 1180px;
          margin: 0 auto 54px;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .mark {
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(217, 184, 102, 0.55);
          border-radius: 17px;
          color: #dfbd69;
          font-weight: 900;
          letter-spacing: 1px;
          background: rgba(255, 255, 255, 0.06);
        }

        .brandBar h1 {
          margin: 3px 0 0;
          font-size: clamp(17px, 2vw, 24px);
        }

        .eyebrow {
          color: #dfbd69;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.7px;
        }

        .eyebrow.dark {
          color: #0d4ea6;
        }

        .official {
          margin-left: auto;
          padding: 7px 11px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          color: #b9d7f5;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .heroGrid {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(300px, 0.72fr);
          align-items: center;
          gap: clamp(34px, 7vw, 92px);
        }

        .securePill {
          width: fit-content;
          padding: 8px 11px;
          border-radius: 999px;
          color: #a6dbff;
          background: rgba(23, 120, 229, 0.13);
          border: 1px solid rgba(166, 219, 255, 0.2);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .copy h2 {
          max-width: 700px;
          margin: 18px 0;
          font-size: clamp(44px, 7vw, 84px);
          line-height: 0.96;
          letter-spacing: -4px;
        }

        .lead {
          max-width: 650px;
          color: #c5d6e8;
          font-size: clamp(15px, 2vw, 19px);
          line-height: 1.7;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 30px;
        }

        .actions a,
        .actions button {
          min-height: 54px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 0 21px;
          border-radius: 17px;
          font-weight: 900;
          text-decoration: none;
          font: inherit;
          cursor: pointer;
        }

        .download {
          border: 0;
          color: #06182e;
          background: linear-gradient(135deg, #f0d284, #d9b25d);
          box-shadow: 0 16px 34px rgba(217, 178, 93, 0.2);
        }

        .downloadFallback {
          margin: 12px 0 0;
          color: #9fb7cf;
          font-size: 11px;
          line-height: 1.6;
        }

        .downloadFallback a {
          color: #f0d284;
          font-weight: 800;
        }

        .secondary {
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.05);
        }

        .trust {
          margin-top: 30px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .trust div {
          min-width: 135px;
          padding: 12px 14px;
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.09);
        }

        .trust span,
        .trust strong {
          display: block;
        }

        .trust span {
          color: #88a7c5;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .trust strong {
          margin-top: 4px;
          font-size: 12px;
        }

        .phone {
          width: min(100%, 350px);
          margin: auto;
          padding: 11px;
          border-radius: 39px;
          background: #071221;
          border: 1px solid rgba(217, 184, 102, 0.35);
          box-shadow:
            0 34px 70px rgba(0, 0, 0, 0.28),
            0 0 70px rgba(23, 120, 229, 0.13);
        }

        .phoneTop,
        .phoneNav {
          padding: 11px 15px;
          display: flex;
          justify-content: space-between;
          color: #8297ad;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.8px;
        }

        .screen {
          min-height: 500px;
          padding: 18px;
          border-radius: 29px;
          color: #122038;
          background:
            radial-gradient(
              circle at 92% 0%,
              rgba(217, 184, 102, 0.18),
              transparent 28%
            ),
            linear-gradient(180deg, #ffffff, #f4f7fa);
        }

        .screenHero span {
          color: #0d4ea6;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .screenHero h3 {
          margin: 5px 0 14px;
          font-size: 24px;
          line-height: 1.05;
        }

        .ask {
          width: fit-content;
          margin-bottom: 13px;
          padding: 9px 11px;
          border-radius: 13px;
          color: #e2bd65;
          background: #071a33;
          font-size: 8px;
          font-weight: 900;
        }

        .search {
          padding: 14px;
          border-radius: 15px;
          background: white;
          border: 1px solid #e1e6eb;
          color: #687386;
          font-size: 11px;
          box-shadow: 0 7px 19px rgba(7, 26, 51, 0.06);
        }

        .miniGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 7px;
          margin-top: 13px;
        }

        .miniGrid div {
          padding: 12px 5px;
          border-radius: 13px;
          text-align: center;
          color: #0d4ea6;
          background: #eef5fb;
          font-size: 8px;
          font-weight: 900;
        }

        .product {
          margin-top: 14px;
          padding: 11px;
          display: flex;
          gap: 11px;
          align-items: center;
          border-radius: 17px;
          color: white;
          background: linear-gradient(135deg, #071a33, #0d4ea6);
        }

        .productImage {
          width: 63px;
          height: 76px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          color: #071a33;
          background: #e0bd69;
          font-size: 10px;
          font-weight: 950;
        }

        .product span,
        .product strong {
          display: block;
        }

        .product span {
          color: #e0bd69;
          font-size: 7px;
          font-weight: 900;
        }

        .product strong {
          max-width: 150px;
          margin-top: 5px;
          font-size: 13px;
          line-height: 1.35;
        }

        .phoneNav {
          justify-content: space-around;
          color: #b5c3d1;
        }

        .release,
        .install,
        .security {
          max-width: 1180px;
          margin: 0 auto;
          padding: 62px clamp(18px, 5vw, 42px);
        }

        .release {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 38px;
          align-items: center;
        }

        .release h3,
        .install h3,
        .security h3 {
          margin: 7px 0 10px;
          color: #071a33;
          font-size: clamp(28px, 4vw, 42px);
          letter-spacing: -1.5px;
        }

        .release p,
        .security p {
          max-width: 620px;
          color: #687386;
          line-height: 1.7;
        }

        .release ul {
          margin: 0;
          padding: 20px 24px 20px 42px;
          border-radius: 24px;
          color: #233149;
          background: white;
          border: 1px solid #e2e7eb;
          line-height: 2;
          box-shadow: 0 14px 35px rgba(7, 26, 51, 0.05);
        }

        .install {
          max-width: none;
          padding-left: max(18px, calc((100vw - 1180px) / 2 + 42px));
          padding-right: max(18px, calc((100vw - 1180px) / 2 + 42px));
          background: #fff;
        }

        .steps {
          margin-top: 25px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .steps article {
          min-height: 185px;
          padding: 21px;
          border-radius: 22px;
          background: #f7f8fa;
          border: 1px solid #e6e9ed;
        }

        .steps b {
          color: #d7b35c;
          font-size: 28px;
        }

        .steps h4 {
          margin: 13px 0 7px;
          color: #071a33;
          font-size: 18px;
        }

        .steps p {
          margin: 0;
          color: #687386;
          font-size: 13px;
          line-height: 1.65;
        }

        .security {
          display: flex;
          gap: 20px;
          align-items: flex-start;
        }

        .shield {
          flex: 0 0 auto;
          width: 62px;
          height: 62px;
          display: grid;
          place-items: center;
          border-radius: 22px;
          color: #071a33;
          background: #e4c36f;
          font-size: 25px;
          font-weight: 950;
        }

        .security code {
          display: block;
          width: fit-content;
          max-width: 100%;
          padding: 10px 13px;
          overflow-wrap: anywhere;
          border-radius: 11px;
          color: #46536a;
          background: white;
          border: 1px solid #e2e7eb;
        }

        footer {
          padding: 28px 18px;
          display: flex;
          justify-content: center;
          gap: 10px;
          color: #7b8596;
          border-top: 1px solid #e2e7eb;
          font-size: 10px;
          letter-spacing: 0.5px;
        }

        footer strong {
          color: #071a33;
        }

        @media (max-width: 820px) {
          .brandBar {
            margin-bottom: 38px;
          }

          .heroGrid,
          .release {
            grid-template-columns: 1fr;
          }

          .copy h2 {
            letter-spacing: -2.5px;
          }

          .phone {
            margin-top: 10px;
          }

          .steps {
            grid-template-columns: 1fr 1fr;
          }

          .security {
            align-items: flex-start;
          }
        }

        @media (max-width: 520px) {
          .hero {
            padding-left: 15px;
            padding-right: 15px;
          }

          .official {
            display: none;
          }

          .copy h2 {
            font-size: 48px;
          }

          .actions {
            display: grid;
          }

          .actions a,
          .actions button {
            width: 100%;
          }

          .steps {
            grid-template-columns: 1fr;
          }

          .security {
            display: grid;
          }

          footer {
            display: grid;
            text-align: center;
          }
        }
      `}</style>
    </main>
  );
}
