import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import VisitorTracker from "../components/VisitorTracker";
type SeoSettings = {
  site_title: string;
  site_description: string;
  keywords: string;
  canonical_url: string;
  social_title: string;
  social_description: string;
  social_image_url: string;
  google_verification_code: string;
  robots_index: boolean;
  robots_follow: boolean;
  sitemap_enabled: boolean;
};

type AnalyticsSettings = {
  google_analytics_id: string;
  google_tag_manager_id: string;
  meta_pixel_id: string;
  google_ads_id: string;
  tracking_enabled: boolean;
  analytics_enabled: boolean;
  meta_pixel_enabled: boolean;
  tag_manager_enabled: boolean;
};

const defaultSeoSettings: SeoSettings = {
  site_title: "NEW CITY STYLE | Style for Every Family",
  site_description:
    "Shop premium fashion for men, women and kids at NEW CITY STYLE. Discover quality clothing, stylish collections and trusted service for every family.",
  keywords:
    "NEW CITY STYLE, family fashion, men clothing, women clothing, kids clothing, sarees, shirts, jeans, fashion store",
  canonical_url: "",
  social_title: "NEW CITY STYLE | Style for Every Family",
  social_description:
    "Discover premium fashion collections for men, women and kids at NEW CITY STYLE.",
  social_image_url: "",
  google_verification_code: "",
  robots_index: true,
  robots_follow: true,
  sitemap_enabled: true,
};

const defaultAnalyticsSettings: AnalyticsSettings = {
  google_analytics_id: "",
  google_tag_manager_id: "",
  meta_pixel_id: "",
  google_ads_id: "",
  tracking_enabled: false,
  analytics_enabled: false,
  meta_pixel_enabled: false,
  tag_manager_enabled: false,
};

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}

function cleanUrl(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  try {
    const parsedUrl = new URL(trimmedValue);

    return parsedUrl.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function isValidGoogleAnalyticsId(value: string) {
  return /^G-[A-Z0-9]+$/i.test(value.trim());
}

function isValidGoogleTagManagerId(value: string) {
  return /^GTM-[A-Z0-9]+$/i.test(value.trim());
}

function isValidGoogleAdsId(value: string) {
  return /^AW-[0-9]+$/i.test(value.trim());
}

function isValidMetaPixelId(value: string) {
  return /^[0-9]+$/.test(value.trim());
}

async function fetchSupabaseRow<T>(
  tableName: string,
  fallback: T
): Promise<T> {
  const { supabaseUrl, supabaseAnonKey } =
    getSupabaseConfig();

  if (!supabaseUrl || !supabaseAnonKey) {
    return fallback;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${tableName}?id=eq.1&select=*`,
      {
        method: "GET",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(
        `Unable to load ${tableName}:`,
        response.status,
        response.statusText
      );

      return fallback;
    }

    const rows = (await response.json()) as T[];

    if (!Array.isArray(rows) || rows.length === 0) {
      return fallback;
    }

    return {
      ...fallback,
      ...rows[0],
    };
  } catch (error) {
    console.error(`Error loading ${tableName}:`, error);

    return fallback;
  }
}

async function getSeoSettings() {
  return fetchSupabaseRow<SeoSettings>(
    "seo_settings",
    defaultSeoSettings
  );
}

async function getAnalyticsSettings() {
  return fetchSupabaseRow<AnalyticsSettings>(
    "analytics_settings",
    defaultAnalyticsSettings
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();

  const siteTitle =
    seo.site_title.trim() ||
    defaultSeoSettings.site_title;

  const siteDescription =
    seo.site_description.trim() ||
    defaultSeoSettings.site_description;

  const socialTitle =
    seo.social_title.trim() || siteTitle;

  const socialDescription =
    seo.social_description.trim() ||
    siteDescription;

  const canonicalUrl = cleanUrl(
    seo.canonical_url
  );

  const socialImageUrl = cleanUrl(
    seo.social_image_url
  );

  const keywords = seo.keywords
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  const metadata: Metadata = {
    title: {
      default: siteTitle,
      template: `%s | NEW CITY STYLE`,
    },

    description: siteDescription,

    applicationName: "NEW CITY STYLE",

    keywords,

    authors: [
      {
        name: "NEW CITY STYLE",
      },
    ],

    creator: "NEW CITY STYLE",

    publisher: "NEW CITY STYLE",

    robots: {
      index: seo.robots_index,
      follow: seo.robots_follow,

      googleBot: {
        index: seo.robots_index,
        follow: seo.robots_follow,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },

    openGraph: {
      type: "website",
      siteName: "NEW CITY STYLE",
      title: socialTitle,
      description: socialDescription,
      locale: "en_IN",

      ...(canonicalUrl
        ? {
            url: canonicalUrl,
          }
        : {}),

      ...(socialImageUrl
        ? {
            images: [
              {
                url: socialImageUrl,
                alt: socialTitle,
              },
            ],
          }
        : {}),
    },

    twitter: {
      card: socialImageUrl
        ? "summary_large_image"
        : "summary",

      title: socialTitle,
      description: socialDescription,

      ...(socialImageUrl
        ? {
            images: [socialImageUrl],
          }
        : {}),
    },

    ...(canonicalUrl
      ? {
          metadataBase: new URL(canonicalUrl),

          alternates: {
            canonical: canonicalUrl,
          },
        }
      : {}),

    ...(seo.google_verification_code.trim()
      ? {
          verification: {
            google:
              seo.google_verification_code.trim(),
          },
        }
      : {}),
  };

  return metadata;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const analytics =
    await getAnalyticsSettings();

  const masterTrackingEnabled =
    analytics.tracking_enabled === true;

  const googleAnalyticsId =
    analytics.google_analytics_id
      .trim()
      .toUpperCase();

  const googleTagManagerId =
    analytics.google_tag_manager_id
      .trim()
      .toUpperCase();

  const googleAdsId =
    analytics.google_ads_id
      .trim()
      .toUpperCase();

  const metaPixelId =
    analytics.meta_pixel_id.trim();

  const enableGoogleAnalytics =
    masterTrackingEnabled &&
    analytics.analytics_enabled &&
    isValidGoogleAnalyticsId(
      googleAnalyticsId
    );

  const enableGoogleTagManager =
    masterTrackingEnabled &&
    analytics.tag_manager_enabled &&
    isValidGoogleTagManagerId(
      googleTagManagerId
    );

  const enableGoogleAds =
    masterTrackingEnabled &&
    isValidGoogleAdsId(googleAdsId);

  const enableMetaPixel =
    masterTrackingEnabled &&
    analytics.meta_pixel_enabled &&
    isValidMetaPixelId(metaPixelId);

  const primaryGoogleTrackingId =
    enableGoogleAnalytics
      ? googleAnalyticsId
      : enableGoogleAds
        ? googleAdsId
        : "";

  return (
    <html lang="en">
      <head>
        {enableGoogleTagManager && (
          <Script
            id="ncs-google-tag-manager"
            strategy="afterInteractive"
          >
            {`
              (function(w,d,s,l,i){
                w[l]=w[l]||[];
                w[l].push({
                  'gtm.start': new Date().getTime(),
                  event: 'gtm.js'
                });

                var f=d.getElementsByTagName(s)[0],
                    j=d.createElement(s),
                    dl=l!='dataLayer'
                      ? '&l='+l
                      : '';

                j.async=true;
                j.src=
                  'https://www.googletagmanager.com/gtm.js?id='
                  + i + dl;

                f.parentNode.insertBefore(j,f);
              })(
                window,
                document,
                'script',
                'dataLayer',
                '${googleTagManagerId}'
              );
            `}
          </Script>
        )}

        {primaryGoogleTrackingId && (
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${primaryGoogleTrackingId}`}
            strategy="afterInteractive"
          />
        )}

        {primaryGoogleTrackingId && (
          <Script
            id="ncs-google-tracking"
            strategy="afterInteractive"
          >
            {`
              window.dataLayer =
                window.dataLayer || [];

              function gtag(){
                dataLayer.push(arguments);
              }

              gtag('js', new Date());

              ${
                enableGoogleAnalytics
                  ? `gtag('config', '${googleAnalyticsId}', {
                      page_path: window.location.pathname
                    });`
                  : ""
              }

              ${
                enableGoogleAds
                  ? `gtag('config', '${googleAdsId}');`
                  : ""
              }
            `}
          </Script>
        )}

        {enableMetaPixel && (
          <Script
            id="ncs-meta-pixel"
            strategy="afterInteractive"
          >
            {`
              !function(f,b,e,v,n,t,s)
              {
                if(f.fbq)return;

                n=f.fbq=function(){
                  n.callMethod
                    ? n.callMethod.apply(n,arguments)
                    : n.queue.push(arguments);
                };

                if(!f._fbq)f._fbq=n;

                n.push=n;
                n.loaded=!0;
                n.version='2.0';
                n.queue=[];

                t=b.createElement(e);
                t.async=!0;
                t.src=v;

                s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s);
              }(
                window,
                document,
                'script',
                'https://connect.facebook.net/en_US/fbevents.js'
              );

              fbq('init', '${metaPixelId}');
              fbq('track', 'PageView');
            `}
          </Script>
        )}
      </head>

      <body>
        <VisitorTracker />
        {enableGoogleTagManager && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${googleTagManagerId}`}
              height="0"
              width="0"
              style={{
                display: "none",
                visibility: "hidden",
              }}
              title="Google Tag Manager"
            />
          </noscript>
        )}

        {enableMetaPixel && (
          <noscript>
            <img
              height="1"
              width="1"
              style={{
                display: "none",
              }}
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        )}

        {children}
      </body>
    </html>
  );
}