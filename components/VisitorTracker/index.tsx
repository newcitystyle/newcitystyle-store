"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

type VisitAttribution = {
  source: string;
  medium: string;
  campaign: string;
  utmContent: string;
  utmTerm: string;
  fbclid: string;
  landingUrl: string;
  landingPath: string;
  initialReferrer: string;
};

const VISITOR_ID_KEY = "ncs_visitor_id";
const SESSION_ID_KEY = "ncs_session_id";
const ATTRIBUTION_KEY = "ncs_visit_attribution";
const LAST_TRACK_KEY = "ncs_last_visit_track";

function createRandomId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function getDeviceType() {
  const userAgent = navigator.userAgent.toLowerCase();

  if (/tablet|ipad|playbook|silk/.test(userAgent)) {
    return "tablet";
  }

  if (
    /mobile|iphone|ipod|android|blackberry|opera mini|iemobile/.test(
      userAgent
    )
  ) {
    return "mobile";
  }

  return "desktop";
}

function getBrowserName() {
  const userAgent = navigator.userAgent;

  if (userAgent.includes("Edg/")) {
    return "Edge";
  }

  if (userAgent.includes("OPR/") || userAgent.includes("Opera")) {
    return "Opera";
  }

  if (userAgent.includes("Chrome/")) {
    return "Chrome";
  }

  if (userAgent.includes("Firefox/")) {
    return "Firefox";
  }

  if (
    userAgent.includes("Safari/") &&
    !userAgent.includes("Chrome/")
  ) {
    return "Safari";
  }

  return "Unknown";
}

function getVisitorId() {
  let visitorId = localStorage.getItem(VISITOR_ID_KEY);

  if (!visitorId) {
    visitorId = createRandomId("visitor");
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }

  return visitorId;
}

function getSessionId() {
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);

  if (!sessionId) {
    sessionId = createRandomId("session");
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  return sessionId;
}

function normalizeHost(host: string) {
  return host
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}

function getReferrerHost(referrer: string) {
  if (!referrer) {
    return "";
  }

  try {
    return normalizeHost(new URL(referrer).hostname);
  } catch {
    return "";
  }
}

function deriveTrafficSource(
  params: URLSearchParams,
  referrer: string
) {
  const utmSource = params.get("utm_source")?.trim() || "";
  const utmMedium = params.get("utm_medium")?.trim() || "";
  const fbclid = params.get("fbclid")?.trim() || "";
  const referrerHost = getReferrerHost(referrer);

  if (utmSource) {
    return {
      source: utmSource.toLowerCase(),
      medium: utmMedium || "campaign",
      fbclid,
    };
  }

  if (fbclid) {
    return {
      source: "facebook",
      medium: "paid_social",
      fbclid,
    };
  }

  if (
    referrerHost === "facebook.com" ||
    referrerHost.endsWith(".facebook.com") ||
    referrerHost === "fb.com" ||
    referrerHost.endsWith(".fb.com")
  ) {
    return {
      source: "facebook",
      medium: "social",
      fbclid: "",
    };
  }

  if (
    referrerHost === "instagram.com" ||
    referrerHost.endsWith(".instagram.com")
  ) {
    return {
      source: "instagram",
      medium: "social",
      fbclid: "",
    };
  }

  if (
    referrerHost === "google.com" ||
    referrerHost.endsWith(".google.com") ||
    referrerHost.startsWith("google.")
  ) {
    return {
      source: "google",
      medium: "organic",
      fbclid: "",
    };
  }

  if (
    referrerHost === "bing.com" ||
    referrerHost.endsWith(".bing.com")
  ) {
    return {
      source: "bing",
      medium: "organic",
      fbclid: "",
    };
  }

  if (
    referrerHost === "yahoo.com" ||
    referrerHost.endsWith(".yahoo.com")
  ) {
    return {
      source: "yahoo",
      medium: "organic",
      fbclid: "",
    };
  }

  if (referrerHost) {
    const currentHost = normalizeHost(window.location.hostname);

    if (referrerHost === currentHost) {
      return {
        source: "direct",
        medium: "none",
        fbclid: "",
      };
    }

    return {
      source: referrerHost,
      medium: "referral",
      fbclid: "",
    };
  }

  return {
    source: "direct",
    medium: "none",
    fbclid: "",
  };
}

function buildAttribution(): VisitAttribution {
  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer || "";

  const traffic =
    deriveTrafficSource(
      params,
      referrer
    );

  return {
    source: traffic.source,
    medium:
      params.get("utm_medium")?.trim() ||
      traffic.medium,
    campaign:
      params.get("utm_campaign")?.trim() ||
      "",
    utmContent:
      params.get("utm_content")?.trim() ||
      "",
    utmTerm:
      params.get("utm_term")?.trim() ||
      "",
    fbclid:
      traffic.fbclid ||
      params.get("fbclid")?.trim() ||
      "",
    landingUrl: window.location.href,
    landingPath:
      `${window.location.pathname}${window.location.search}`,
    initialReferrer: referrer,
  };
}

function getSessionAttribution() {
  const existing =
    sessionStorage.getItem(
      ATTRIBUTION_KEY
    );

  if (existing) {
    try {
      const parsed =
        JSON.parse(
          existing
        ) as VisitAttribution;

      if (
        parsed &&
        typeof parsed.source === "string" &&
        typeof parsed.medium === "string"
      ) {
        return parsed;
      }
    } catch {
      sessionStorage.removeItem(
        ATTRIBUTION_KEY
      );
    }
  }

  const attribution =
    buildAttribution();

  sessionStorage.setItem(
    ATTRIBUTION_KEY,
    JSON.stringify(
      attribution
    )
  );

  return attribution;
}

function shouldSkipDuplicateTrack(
  sessionId: string,
  pagePath: string
) {
  const now = Date.now();

  const key =
    `${sessionId}|${pagePath}`;

  const previousRaw =
    sessionStorage.getItem(
      LAST_TRACK_KEY
    );

  if (previousRaw) {
    try {
      const previous =
        JSON.parse(
          previousRaw
        ) as {
          key?: string;
          timestamp?: number;
        };

      if (
        previous.key === key &&
        typeof previous.timestamp === "number" &&
        now - previous.timestamp < 1500
      ) {
        return true;
      }
    } catch {
      sessionStorage.removeItem(
        LAST_TRACK_KEY
      );
    }
  }

  sessionStorage.setItem(
    LAST_TRACK_KEY,
    JSON.stringify({
      key,
      timestamp: now,
    })
  );

  return false;
}

export default function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    async function recordVisit() {
      try {
        if (!pathname) {
          return;
        }

        if (pathname.startsWith("/admin")) {
          return;
        }

        const visitorId =
          getVisitorId();

        const sessionId =
          getSessionId();

        const attribution =
          getSessionAttribution();

        const pagePath =
          `${pathname}${window.location.search}`;

        if (
          shouldSkipDuplicateTrack(
            sessionId,
            pagePath
          )
        ) {
          return;
        }

        const currentReferrer =
          document.referrer || "";

        const { error } =
          await supabase
            .from("website_visits")
            .insert({
              visitor_id:
                visitorId,
              session_id:
                sessionId,
              page_path:
                pathname,
              page_title:
                document.title || "",
              referrer:
                currentReferrer,
              device_type:
                getDeviceType(),
              browser:
                getBrowserName(),
              visited_at:
                new Date().toISOString(),

              source:
                attribution.source,
              medium:
                attribution.medium,
              campaign:
                attribution.campaign,
              utm_content:
                attribution.utmContent,
              utm_term:
                attribution.utmTerm,
              fbclid:
                attribution.fbclid,
              event_type:
                "page_view",

              metadata: {
                landing_url:
                  attribution.landingUrl,
                landing_path:
                  attribution.landingPath,
                initial_referrer:
                  attribution.initialReferrer,
                current_url:
                  window.location.href,
                current_query:
                  window.location.search,
                referrer_host:
                  getReferrerHost(
                    currentReferrer
                  ),
              },
            });

        if (error) {
          console.error(
            "Website visit tracking error:",
            error
          );
        }
      } catch (error) {
        console.error(
          "Unable to record website visit:",
          error
        );
      }
    }

    recordVisit();
  }, [pathname]);

  return null;
}