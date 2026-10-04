/*
 * NEW CITY STYLE • LIVE ORDER PULSE • V8
 * Imported by the existing /public/sw.js.
 * This file intentionally contains NO fetch/cache handler so the existing
 * POS offline vault remains the single owner of caching/navigation.
 */

const NCS_ORDER_NOTIFICATION_TAG_PREFIX = "ncs-order-";

function ncsSafePushPayload(event) {
  try {
    return event.data?.json?.() || {};
  } catch {
    try {
      return {
        title: "NEW CITY STYLE",
        body: event.data?.text?.() || "Your order has an update.",
      };
    } catch {
      return {
        title: "NEW CITY STYLE",
        body: "Your order has an update.",
      };
    }
  }
}

self.addEventListener("push", (event) => {
  const payload = ncsSafePushPayload(event);

  const orderId =
    String(payload.orderId || payload.order_id || "").trim();

  const status =
    String(payload.status || "Updated").trim();

  const title =
    String(payload.title || "NEW CITY STYLE • ORDER PULSE");

  const body =
    String(
      payload.body ||
        (orderId
          ? `Order #${orderId} is now ${status}.`
          : "Your order has a new update.")
    );

  const targetUrl =
    String(
      payload.url ||
        (orderId
          ? `/my-orders?order=${encodeURIComponent(orderId)}`
          : "/my-orders")
    );

  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: orderId
      ? `${NCS_ORDER_NOTIFICATION_TAG_PREFIX}${orderId}`
      : "ncs-order-pulse",
    renotify: true,
    requireInteraction:
      status === "Shipped" || status === "Out for Delivery",
    silent: false,
    timestamp: Date.now(),
    data: {
      url: targetUrl,
      orderId,
      status,
      pulseVersion: 8,
    },
    actions: [
      {
        action: "open_order",
        title: "VIEW ORDER",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification?.data?.url || "/my-orders";

  const absoluteUrl =
    new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then(async (clients) => {
        for (const client of clients) {
          try {
            const clientUrl = new URL(client.url);

            if (clientUrl.origin !== self.location.origin) {
              continue;
            }

            if ("focus" in client) {
              await client.focus();
            }

            if ("navigate" in client) {
              await client.navigate(absoluteUrl);
            }

            return;
          } catch {
            // Keep looking for a usable same-origin client.
          }
        }

        if (self.clients.openWindow) {
          await self.clients.openWindow(absoluteUrl);
        }
      })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  /*
   * Browsers do not consistently provide the applicationServerKey here.
   * The customer page re-registers and refreshes the subscription on next open.
   * Keeping this listener avoids a silent no-op assumption.
   */
  event.waitUntil(Promise.resolve());
});
