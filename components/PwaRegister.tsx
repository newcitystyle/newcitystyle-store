"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
      } catch (error) {
        console.error(
          "NEW CITY STYLE service worker registration failed:",
          error
        );
      }
    };

    if (document.readyState === "complete") {
      void registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker, {
      once: true,
    });

    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  return null;
}