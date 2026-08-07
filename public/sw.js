const NCS_CACHE_VERSION = "ncs-pos-pwa-v3-offline-startup";
const NCS_STATIC_CACHE = `${NCS_CACHE_VERSION}-static`;
const NCS_PAGE_CACHE = `${NCS_CACHE_VERSION}-pages`;

const PRECACHE_URLS = [
  "/",
  "/admin/login",
  "/manifest.webmanifest",
];

const NEVER_CACHE_PATHS = [
  "/api/",
  "/auth/",
];

function shouldNeverCache(url) {
  return NEVER_CACHE_PATHS.some((path) =>
    url.pathname.startsWith(path),
  );
}

function isStaticAsset(request, url) {
  return (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image" ||
    request.destination === "video" ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/animations/")
  );
}

function isPosPage(url) {
  return (
    url.pathname === "/admin/pos" ||
    url.pathname.startsWith("/admin/pos/")
  );
}

function isNextRscRequest(request, url) {
  return (
    url.searchParams.has("_rsc") ||
    request.headers.get("RSC") === "1" ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.has("Next-Router-Prefetch") ||
    request.headers.has("Next-Url")
  );
}

function isHtmlResponse(response) {
  const contentType =
    response.headers.get("content-type") || "";

  return contentType
    .toLowerCase()
    .includes("text/html");
}

function getNavigationCacheKey(url) {
  return url.pathname;
}

async function fetchHtmlNavigation(request) {
  const response = await fetch(request, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    return response;
  }

  if (!isHtmlResponse(response)) {
    throw new Error(
      "Navigation response was not HTML.",
    );
  }

  return response;
}

async function cacheHtmlPage(
  cache,
  key,
  response,
  expectedPath,
) {
  if (!response.ok || !isHtmlResponse(response)) {
    return false;
  }

  if (expectedPath) {
    const finalUrl = new URL(
      response.url,
      self.location.origin,
    );

    if (
      response.redirected ||
      finalUrl.pathname !== expectedPath
    ) {
      return false;
    }
  }

  await cache.put(key, response.clone());
  return true;
}

async function fetchAndCachePage(
  cache,
  path,
  expectedPath = path,
) {
  const request = new Request(path, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "text/html",
    },
  });

  const response =
    await fetchHtmlNavigation(request);

  return cacheHtmlPage(
    cache,
    path,
    response,
    expectedPath,
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(NCS_PAGE_CACHE)
      .then(async (cache) => {
        for (const url of PRECACHE_URLS) {
          try {
            const request = new Request(url, {
              method: "GET",
              credentials: "include",
              cache: "no-store",
              headers: {
                Accept: "text/html",
              },
            });

            const response =
              await fetchHtmlNavigation(request);

            await cacheHtmlPage(
              cache,
              getNavigationCacheKey(
                new URL(url, self.location.origin),
              ),
              response,
              new URL(url, self.location.origin).pathname,
            );
          } catch {
            // One URL failed అయినా install ఆగదు.
          }
        }
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("ncs-pos-pwa-") &&
                key !== NCS_STATIC_CACHE &&
                key !== NCS_PAGE_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (shouldNeverCache(url)) {
    return;
  }

  /*
   * Next.js RSC / Flight requestsను HTML cacheలో
   * ఎప్పుడూ save చేయకూడదు.
   */
  if (isNextRscRequest(request, url)) {
    event.respondWith(
      fetch(request, {
        cache: "no-store",
        credentials: "include",
      }).catch(
        () =>
          new Response("", {
            status: 503,
            statusText: "Offline",
            headers: {
              "Cache-Control": "no-store",
            },
          }),
      ),
    );

    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(
      caches.open(NCS_STATIC_CACHE).then(async (cache) => {
        const cachedResponse =
          await cache.match(request);

        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse =
            await fetch(request);

          if (networkResponse.ok) {
            await cache.put(
              request,
              networkResponse.clone(),
            );
          }

          return networkResponse;
        } catch {
          return new Response("", {
            status: 503,
            statusText: "Offline",
          });
        }
      }),
    );

    return;
  }

  if (
    request.mode === "navigate" ||
    isPosPage(url)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(
          NCS_PAGE_CACHE,
        );

        const navigationKey =
          getNavigationCacheKey(url);

        try {
          const networkResponse =
            await fetchHtmlNavigation(request);

          await cacheHtmlPage(
            cache,
            navigationKey,
            networkResponse,
            url.pathname,
          );

          if (isPosPage(url)) {
            await cacheHtmlPage(
              cache,
              "/admin/pos",
              networkResponse,
              "/admin/pos",
            );
          }

          return networkResponse;
        } catch {
          const exactCachedResponse =
            await cache.match(navigationKey);

          if (
            exactCachedResponse &&
            isHtmlResponse(exactCachedResponse)
          ) {
            return exactCachedResponse;
          }

          if (url.pathname === "/admin/login") {
            const cachedLoginPage =
              await cache.match("/admin/login");

            if (
              cachedLoginPage &&
              isHtmlResponse(cachedLoginPage)
            ) {
              return cachedLoginPage;
            }
          }

          const cachedPosPage =
            await cache.match("/admin/pos");

          if (
            cachedPosPage &&
            isHtmlResponse(cachedPosPage)
          ) {
            return cachedPosPage;
          }

          const cachedHomePage =
            await cache.match("/");

          if (
            cachedHomePage &&
            isHtmlResponse(cachedHomePage)
          ) {
            return cachedHomePage;
          }

          return new Response(
            `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />

    <title>NEW CITY STYLE Offline</title>

    <style>
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(
            circle at 20% 15%,
            rgba(212, 175, 55, 0.2),
            transparent 30%
          ),
          linear-gradient(
            135deg,
            #03153f,
            #0a2e73
          );
        color: #ffffff;
        font-family: Arial, sans-serif;
        text-align: center;
      }

      .offlineCard {
        width: min(100%, 520px);
        padding: 32px 24px;
        border: 1px solid #d4af37;
        border-radius: 22px;
        background: rgba(255, 255, 255, 0.08);
        box-shadow:
          0 22px 60px rgba(0, 0, 0, 0.3);
      }

      .offlineLogo {
        width: 82px;
        height: 82px;
        display: grid;
        place-items: center;
        margin: 0 auto 20px;
        border: 2px solid #d4af37;
        border-radius: 22px;
        color: #d4af37;
        font-size: 22px;
        font-weight: 900;
      }

      h1 {
        margin: 0;
        color: #d4af37;
        font-size: 28px;
      }

      h2 {
        margin: 14px 0 0;
        font-size: 21px;
      }

      p {
        margin: 15px 0 0;
        color: rgba(255, 255, 255, 0.82);
        font-size: 14px;
        line-height: 1.7;
      }
    </style>
  </head>

  <body>
    <div class="offlineCard">
      <div class="offlineLogo">NCS</div>

      <h1>NEW CITY STYLE</h1>

      <h2>Offline Mode</h2>

      <p>
        Billing / POS pageను internet ఉన్నప్పుడు కనీసం
        ఒక్కసారి open చేయండి. ఆ తర్వాత ఈ deviceలో
        internet లేకపోయినా billing page open అవుతుంది.
      </p>
    </div>
  </body>
</html>`,
            {
              status: 503,
              headers: {
                "Content-Type":
                  "text/html; charset=utf-8",
                "Cache-Control": "no-store",
              },
            },
          );
        }
      })(),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (
    event.data?.type === "CACHE_POS_NOW" ||
    event.data?.type === "CACHE_OFFLINE_SHELL_NOW"
  ) {
    event.waitUntil(
      caches
        .open(NCS_PAGE_CACHE)
        .then(async (cache) => {
          try {
            await fetchAndCachePage(
              cache,
              "/admin/login",
              "/admin/login",
            );
          } catch {
            // Existing cached login page remains available.
          }

          try {
            await fetchAndCachePage(
              cache,
              "/admin/pos",
              "/admin/pos",
            );
          } catch {
            // Existing cached POS page remains available.
          }
        }),
    );
  }

  if (event.data?.type === "CLEAR_PAGE_CACHE") {
    event.waitUntil(
      caches.delete(NCS_PAGE_CACHE),
    );
  }
});