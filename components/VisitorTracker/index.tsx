"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  const storageKey = "ncs_visitor_id";

  let visitorId = localStorage.getItem(storageKey);

  if (!visitorId) {
    visitorId = createRandomId("visitor");
    localStorage.setItem(storageKey, visitorId);
  }

  return visitorId;
}

function getSessionId() {
  const storageKey = "ncs_session_id";

  let sessionId = sessionStorage.getItem(storageKey);

  if (!sessionId) {
    sessionId = createRandomId("session");
    sessionStorage.setItem(storageKey, sessionId);
  }

  return sessionId;
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

        const visitorId = getVisitorId();
        const sessionId = getSessionId();

        const { error } = await supabase
          .from("website_visits")
          .insert({
            visitor_id: visitorId,
            session_id: sessionId,
            page_path: pathname,
            page_title: document.title || "",
            referrer: document.referrer || "",
            device_type: getDeviceType(),
            browser: getBrowserName(),
            visited_at: new Date().toISOString(),
          });

        if (error) {
          console.error("Website visit tracking error:", error);
        }
      } catch (error) {
        console.error("Unable to record website visit:", error);
      }
    }

    recordVisit();
  }, [pathname]);

  return null;
}