"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type BrandingSettings = {
  brand_name: string | null;
  tagline: string | null;
  logo_url: string | null;
  mobile_logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

const DEFAULT_BRANDING: BrandingSettings = {
  brand_name: "NEW CITY STYLE",
  tagline: "Style for Every Family",
  logo_url: null,
  mobile_logo_url: null,
  primary_color: "#0A2E73",
  secondary_color: "#D4AF37",
};

export default function Header() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [branding, setBranding] =
    useState<BrandingSettings>(DEFAULT_BRANDING);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [mobileLogoLoadFailed, setMobileLogoLoadFailed] =
    useState(false);

  useEffect(() => {
    loadBranding();
  }, []);

  async function loadBranding() {
    const { data, error } = await supabase
      .from("branding_settings")
      .select(
        "brand_name, tagline, logo_url, mobile_logo_url, primary_color, secondary_color"
      )
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Unable to load branding settings:", error);
      return;
    }

    if (!data) return;

    setBranding({
      brand_name:
        data.brand_name?.trim() || DEFAULT_BRANDING.brand_name,
      tagline: data.tagline?.trim() || DEFAULT_BRANDING.tagline,
      logo_url: data.logo_url?.trim() || null,
      mobile_logo_url: data.mobile_logo_url?.trim() || null,
      primary_color:
        data.primary_color?.trim() ||
        DEFAULT_BRANDING.primary_color,
      secondary_color:
        data.secondary_color?.trim() ||
        DEFAULT_BRANDING.secondary_color,
    });

    setLogoLoadFailed(false);
    setMobileLogoLoadFailed(false);
  }

  function searchProduct() {
    const cleanSearch = search.trim();

    if (!cleanSearch) return;

    router.push(`/search?q=${encodeURIComponent(cleanSearch)}`);
  }

  const brandName =
    branding.brand_name || DEFAULT_BRANDING.brand_name;

  const tagline = branding.tagline || DEFAULT_BRANDING.tagline;

  const primaryColor =
    branding.primary_color ||
    DEFAULT_BRANDING.primary_color ||
    "#0A2E73";

  const secondaryColor =
    branding.secondary_color ||
    DEFAULT_BRANDING.secondary_color ||
    "#D4AF37";

  const desktopLogoUrl =
    branding.logo_url && !logoLoadFailed
      ? branding.logo_url
      : null;

  const mobileLogoUrl =
    branding.mobile_logo_url && !mobileLogoLoadFailed
      ? branding.mobile_logo_url
      : desktopLogoUrl;

  return (
    <>
      <header
        className="ncs-header"
        style={
          {
            "--ncs-primary": primaryColor,
            "--ncs-secondary": secondaryColor,
          } as React.CSSProperties
        }
      >
        <div className="ncs-header-top">
          <Link
            href="/"
            className="ncs-brand"
            aria-label={`${brandName} homepage`}
          >
            {desktopLogoUrl ? (
              <img
                src={desktopLogoUrl}
                alt={`${brandName} logo`}
                className="ncs-logo ncs-desktop-logo"
                onError={() => setLogoLoadFailed(true)}
              />
            ) : (
              <div className="ncs-fallback-brand ncs-desktop-brand">
                <span className="ncs-fallback-mark">NCS</span>

                <span className="ncs-fallback-copy">
                  <strong>{brandName}</strong>
                  <small>{tagline}</small>
                </span>
              </div>
            )}

            {mobileLogoUrl ? (
              <img
                src={mobileLogoUrl}
                alt={`${brandName} mobile logo`}
                className="ncs-logo ncs-mobile-logo"
                onError={() => {
                  if (branding.mobile_logo_url) {
                    setMobileLogoLoadFailed(true);
                  } else {
                    setLogoLoadFailed(true);
                  }
                }}
              />
            ) : (
              <div className="ncs-fallback-brand ncs-mobile-brand">
                <span className="ncs-fallback-mark">NCS</span>

                <span className="ncs-fallback-copy">
                  <strong>{brandName}</strong>
                  <small>{tagline}</small>
                </span>
              </div>
            )}
          </Link>

          <div className="ncs-search">
            <input
              type="search"
              placeholder="Search shirts, sarees, jeans..."
              value={search}
              aria-label="Search products"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  searchProduct();
                }
              }}
            />

            {search.trim() && (
              <button
                type="button"
                className="ncs-clear-search"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}

            <button
              type="button"
              className="ncs-search-button"
              onClick={searchProduct}
              aria-label="Search"
            >
              <svg
                viewBox="0 0 24 24"
                width="21"
                height="21"
                aria-hidden="true"
              >
                <path
                  d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <nav className="ncs-nav" aria-label="Main navigation">
          <Link href="/" className="ncs-nav-link">
            <span aria-hidden="true">⌂</span>
            <span>Home</span>
          </Link>

          <Link href="/wishlist" className="ncs-nav-link">
            <span aria-hidden="true">♡</span>
            <span>Wishlist</span>
          </Link>

          <Link href="/orders" className="ncs-nav-link">
            <span aria-hidden="true">▣</span>
            <span>Orders</span>
          </Link>

          <Link href="/cart" className="ncs-nav-link">
            <span aria-hidden="true">🛒</span>
            <span>Cart</span>
          </Link>

          <Link href="/profile" className="ncs-nav-link">
            <span aria-hidden="true">♙</span>
            <span>Account</span>
          </Link>
        </nav>
      </header>

      <style jsx>{`
        .ncs-header {
          position: sticky;
          top: 0;
          z-index: 1000;
          width: 100%;
          color: #ffffff;
          background:
            radial-gradient(
              circle at top right,
              rgba(255, 255, 255, 0.12),
              transparent 36%
            ),
            linear-gradient(
              135deg,
              var(--ncs-primary) 0%,
              #123f96 100%
            );
          border-bottom: 2px solid var(--ncs-secondary);
          box-shadow: 0 10px 30px rgba(10, 46, 115, 0.22);
        }

        .ncs-header-top {
          width: min(1440px, 100%);
          min-height: 104px;
          margin: 0 auto;
          padding: 14px 34px;
          display: grid;
          grid-template-columns: minmax(230px, 370px) minmax(
              300px,
              620px
            );
          justify-content: space-between;
          align-items: center;
          gap: 30px;
        }

        .ncs-brand {
          min-width: 0;
          display: flex;
          align-items: center;
          text-decoration: none;
        }

        .ncs-logo {
          display: block;
          max-width: 100%;
          width: auto;
          object-fit: contain;
          object-position: left center;
        }

        .ncs-desktop-logo {
          max-width: 360px;
          height: 78px;
        }

        .ncs-mobile-logo,
        .ncs-mobile-brand {
          display: none;
        }

        .ncs-fallback-brand {
          display: flex;
          align-items: center;
          gap: 13px;
          color: var(--ncs-secondary);
        }

        .ncs-fallback-mark {
          width: 60px;
          height: 60px;
          flex: 0 0 60px;
          display: grid;
          place-items: center;
          border: 2px solid var(--ncs-secondary);
          border-radius: 17px;
          font-size: 17px;
          font-weight: 900;
          letter-spacing: 1.5px;
          box-shadow: inset 0 0 0 3px rgba(212, 175, 55, 0.12);
        }

        .ncs-fallback-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          line-height: 1.08;
        }

        .ncs-fallback-copy strong {
          overflow: hidden;
          color: var(--ncs-secondary);
          font-size: clamp(20px, 2vw, 31px);
          font-weight: 900;
          letter-spacing: 1.6px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncs-fallback-copy small {
          margin-top: 7px;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .ncs-search {
          position: relative;
          width: 100%;
          min-width: 0;
          display: flex;
          align-items: stretch;
          overflow: hidden;
          background: #ffffff;
          border: 2px solid var(--ncs-secondary);
          border-radius: 16px;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
        }

        .ncs-search input {
          width: 100%;
          min-width: 0;
          height: 54px;
          padding: 0 50px 0 18px;
          color: #17233d;
          background: #ffffff;
          border: none;
          outline: none;
          font-size: 15px;
        }

        .ncs-search input::placeholder {
          color: #7b8497;
        }

        .ncs-search input::-webkit-search-cancel-button {
          display: none;
        }

        .ncs-clear-search {
          position: absolute;
          top: 50%;
          right: 67px;
          width: 30px;
          height: 30px;
          padding: 0;
          display: grid;
          place-items: center;
          transform: translateY(-50%);
          color: #6b7280;
          background: #f3f4f6;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          font-size: 20px;
          line-height: 1;
        }

        .ncs-search-button {
          width: 62px;
          min-width: 62px;
          display: grid;
          place-items: center;
          color: var(--ncs-primary);
          background: var(--ncs-secondary);
          border: none;
          cursor: pointer;
          transition:
            filter 0.2s ease,
            transform 0.2s ease;
        }

        .ncs-search-button:hover {
          filter: brightness(1.07);
        }

        .ncs-search-button:active {
          transform: scale(0.96);
        }

        .ncs-nav {
          width: min(1440px, 100%);
          margin: 0 auto;
          padding: 0 34px 13px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        .ncs-nav-link {
          min-height: 42px;
          padding: 9px 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          color: #ffffff;
          text-decoration: none;
          border: 1px solid transparent;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          transition:
            color 0.2s ease,
            background 0.2s ease,
            border-color 0.2s ease,
            transform 0.2s ease;
        }

        .ncs-nav-link:hover {
          color: var(--ncs-secondary);
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(212, 175, 55, 0.5);
          transform: translateY(-1px);
        }

        .ncs-nav-link > span:first-child {
          font-size: 19px;
          line-height: 1;
        }

        @media (max-width: 900px) {
          .ncs-header {
            position: relative;
          }

          .ncs-header-top {
            min-height: auto;
            padding: 12px 16px;
            grid-template-columns: 1fr;
            gap: 13px;
          }

          .ncs-brand {
            justify-content: center;
          }

          .ncs-desktop-logo,
          .ncs-desktop-brand {
            display: none;
          }

          .ncs-mobile-logo {
            display: block;
            width: auto;
            max-width: min(100%, 310px);
            height: 68px;
            object-position: center;
          }

          .ncs-mobile-brand {
            display: flex;
          }

          .ncs-search input {
            height: 50px;
            font-size: 14px;
          }

          .ncs-nav {
            padding: 0 12px 11px;
            justify-content: space-between;
            gap: 5px;
            overflow-x: auto;
            scrollbar-width: none;
          }

          .ncs-nav::-webkit-scrollbar {
            display: none;
          }

          .ncs-nav-link {
            min-width: 60px;
            padding: 7px 8px;
            flex-direction: column;
            gap: 3px;
            font-size: 11px;
          }

          .ncs-nav-link > span:first-child {
            font-size: 18px;
          }
        }

        @media (max-width: 420px) {
          .ncs-header-top {
            padding-right: 10px;
            padding-left: 10px;
          }

          .ncs-mobile-logo {
            max-width: 280px;
            height: 62px;
          }

          .ncs-fallback-mark {
            width: 50px;
            height: 50px;
            flex-basis: 50px;
            border-radius: 14px;
            font-size: 14px;
          }

          .ncs-fallback-copy strong {
            font-size: 20px;
          }

          .ncs-fallback-copy small {
            font-size: 11px;
          }

          .ncs-search-button {
            width: 55px;
            min-width: 55px;
          }

          .ncs-clear-search {
            right: 60px;
          }
        }
      `}</style>
    </>
  );
}