"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import NcsLiveOrderPulse2036 from "@/components/NcsLiveOrderPulse2036";

type OrderItem = {
  name?: string;
  image?: string;
  quantity?: number | string;
  price?: number | string;
};

type Order = {
  id: number | string;
  created_at?: string | null;
  total_amount?: number | string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  order_status?: string | null;
  status?: string | null;
  courier_name?: string | null;
  tracking_id?: string | null;
  expected_delivery_date?: string | null;
  items?: OrderItem[] | string | null;
};

const STAGES = [
  "Confirmed",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
];

function normalizeStatus(value?: string | null) {
  const raw = String(value || "Pending").trim();
  return raw || "Pending";
}

function parseItems(value: Order["items"]): OrderItem[] {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function money(value: unknown) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function dateText(value?: string | null) {
  if (!value) return "â€”";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function stageIndex(status: string) {
  return STAGES.findIndex(
    (stage) =>
      stage.toLowerCase() === status.trim().toLowerCase()
  );
}

function MyOrdersContent() {
  const router = useRouter();
  const [focusedOrder, setFocusedOrder] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFocusedOrder(params.get("order") || "");

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let alive = true;

    async function boot() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      if (!alive) return;

      const customerUserId = user.id;

      async function load() {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("user_id", customerUserId)
          .order("created_at", { ascending: false });

        if (!alive) return;

        if (error) {
          console.error("Customer order load error:", error);
          setOrders([]);
        } else {
          setOrders((data || []) as Order[]);
        }

        setLoading(false);
      }

      await load();

      channel = supabase
        .channel(`ncs-order-pulse-${customerUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `user_id=eq.${customerUserId}`,
          },
          () => {
            void load();
          }
        )
        .subscribe();
    }

    void boot();

    return () => {
      alive = false;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [router]);

  const sortedOrders = useMemo(() => {
    if (!focusedOrder) return orders;

    return [...orders].sort((a, b) => {
      if (String(a.id) === focusedOrder) return -1;
      if (String(b.id) === focusedOrder) return 1;
      return 0;
    });
  }, [orders, focusedOrder]);

  if (loading) {
    return (
      <main className="page loading">
        <div className="scan" />
        <p>Connecting to your live order fieldâ€¦</p>
        <style jsx>{css}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <span className="eyebrow">NEW CITY STYLE â€¢ CUSTOMER OS</span>
          <h1>My Order Pulse</h1>
          <p>
            One order. One evolving signal. No duplicate notification noise.
          </p>
        </div>

        <button onClick={() => router.push("/")}>
          CONTINUE SHOPPING
        </button>
      </section>

      <NcsLiveOrderPulse2036 />

      <section className="orders">
        {sortedOrders.length === 0 ? (
          <div className="empty">
            <span>NO ACTIVE ORDER SIGNAL</span>
            <h2>Your orders will appear here.</h2>
          </div>
        ) : (
          sortedOrders.map((order) => {
            const status = normalizeStatus(
              order.order_status || order.status
            );

            const currentStage = stageIndex(status);
            const items = parseItems(order.items);
            const first = items[0];

            return (
              <article
                key={String(order.id)}
                className={
                  String(order.id) === focusedOrder
                    ? "orderCard focused"
                    : "orderCard"
                }
              >
                <header>
                  <div>
                    <span className="orderId">
                      ORDER #{order.id}
                    </span>
                    <h2>{status}</h2>
                    <p>{dateText(order.created_at)}</p>
                  </div>

                  <strong className="total">
                    {money(order.total_amount)}
                  </strong>
                </header>

                <div className="stageRail">
                  {STAGES.map((stage, index) => (
                    <div
                      className={`stage ${
                        index <= currentStage
                          ? "reached"
                          : ""
                      }`}
                      key={stage}
                    >
                      <i />
                      <span>{stage}</span>
                    </div>
                  ))}
                </div>

                {first && (
                  <div className="product">
                    {first.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={first.image}
                        alt={first.name || "Order item"}
                      />
                    ) : (
                      <div className="imageFallback">NCS</div>
                    )}

                    <div>
                      <h3>
                        {first.name || "NEW CITY STYLE Product"}
                      </h3>
                      <p>
                        Qty {Number(first.quantity || 1)}
                        {items.length > 1
                          ? ` â€¢ +${items.length - 1} more`
                          : ""}
                      </p>
                    </div>
                  </div>
                )}

                {(status === "Shipped" ||
                  status === "Out for Delivery") && (
                  <div className="tracking">
                    <span>DELIVERY VECTOR</span>
                    <div className="trackingGrid">
                      <div>
                        <small>Courier</small>
                        <strong>
                          {order.courier_name || "Assigned"}
                        </strong>
                      </div>
                      <div>
                        <small>Tracking</small>
                        <strong>
                          {order.tracking_id || "Updating"}
                        </strong>
                      </div>
                      <div>
                        <small>ETA</small>
                        <strong>
                          {order.expected_delivery_date || "Soon"}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                <footer>
                  <span>
                    {String(order.payment_status || "Pending")}
                    {" â€¢ "}
                    {String(order.payment_method || "â€”").toUpperCase()}
                  </span>
                  <span className="live">
                    <i />
                    LIVE
                  </span>
                </footer>
              </article>
            );
          })
        )}
      </section>

      <style jsx>{css}</style>
    </main>
  );
}

const css = `
  .page {
    min-height: 100vh;
    padding: 28px 18px 80px;
    background:
      radial-gradient(circle at 12% 4%, rgba(53,255,213,.13), transparent 24%),
      radial-gradient(circle at 88% 12%, rgba(60,112,255,.14), transparent 28%),
      linear-gradient(180deg, #02090d, #04141a 48%, #02080b);
    color: #f6fffd;
    font-family: Arial, sans-serif;
  }

  .loading {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 20px;
    color: rgba(255,255,255,.65);
  }

  .scan {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid rgba(81,255,215,.15);
    border-top-color: #52fbd5;
    animation: spin .9s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .hero,
  .orders,
  :global(.ncsPulse) {
    width: min(100%, 880px);
    margin-left: auto;
    margin-right: auto;
  }

  .hero {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 18px;
    margin-bottom: 18px;
  }

  .eyebrow {
    color: rgba(146,255,229,.5);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .18em;
  }

  h1 {
    margin: 6px 0 0;
    font-size: clamp(31px, 6vw, 54px);
    letter-spacing: -.055em;
  }

  .hero p {
    margin: 8px 0 0;
    color: rgba(255,255,255,.55);
    font-size: 13px;
  }

  .hero button {
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 14px;
    padding: 11px 13px;
    background: rgba(255,255,255,.04);
    color: #cafff2;
    cursor: pointer;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .1em;
  }

  .orders {
    display: grid;
    gap: 16px;
    margin-top: 16px;
  }

  .orderCard {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.09);
    border-radius: 28px;
    padding: 20px;
    background:
      linear-gradient(145deg, rgba(255,255,255,.045), rgba(255,255,255,.018));
    box-shadow: 0 28px 70px rgba(0,0,0,.25);
  }

  .orderCard.focused {
    border-color: rgba(73,255,215,.38);
    box-shadow:
      0 28px 80px rgba(0,0,0,.3),
      inset 0 0 0 1px rgba(73,255,215,.08);
  }

  .orderCard header,
  .orderCard footer {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    align-items: center;
  }

  .orderId {
    color: rgba(255,255,255,.45);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .13em;
  }

  h2 {
    margin: 5px 0 3px;
    font-size: 27px;
    letter-spacing: -.03em;
  }

  header p {
    margin: 0;
    color: rgba(255,255,255,.4);
    font-size: 11px;
  }

  .total {
    font-size: 22px;
    color: #afffea;
  }

  .stageRail {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 7px;
    margin-top: 20px;
  }

  .stage {
    min-width: 0;
  }

  .stage i {
    display: block;
    height: 3px;
    border-radius: 999px;
    background: rgba(255,255,255,.08);
  }

  .stage span {
    display: block;
    margin-top: 7px;
    overflow: hidden;
    color: rgba(255,255,255,.34);
    font-size: 9px;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stage.reached i {
    background: linear-gradient(90deg, #42f6ce, #87ffe2);
    box-shadow: 0 0 14px rgba(65,246,206,.35);
  }

  .stage.reached span {
    color: #b8ffed;
  }

  .product {
    display: flex;
    align-items: center;
    gap: 13px;
    margin-top: 19px;
    padding: 12px;
    border: 1px solid rgba(255,255,255,.07);
    border-radius: 18px;
    background: rgba(0,0,0,.15);
  }

  .product img,
  .imageFallback {
    width: 58px;
    height: 70px;
    flex: 0 0 auto;
    border-radius: 13px;
    object-fit: cover;
  }

  .imageFallback {
    display: grid;
    place-items: center;
    background: rgba(74,255,215,.08);
    color: #63ffda;
    font-weight: 900;
  }

  .product h3 {
    margin: 0;
    font-size: 14px;
  }

  .product p {
    margin: 6px 0 0;
    color: rgba(255,255,255,.45);
    font-size: 11px;
  }

  .tracking {
    margin-top: 14px;
    padding: 14px;
    border-radius: 18px;
    background: rgba(62,255,215,.05);
    border: 1px solid rgba(62,255,215,.1);
  }

  .tracking > span {
    color: rgba(131,255,227,.48);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .15em;
  }

  .trackingGrid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    margin-top: 11px;
  }

  .trackingGrid small {
    display: block;
    color: rgba(255,255,255,.35);
    font-size: 9px;
  }

  .trackingGrid strong {
    display: block;
    margin-top: 4px;
    color: rgba(255,255,255,.85);
    font-size: 12px;
    word-break: break-word;
  }

  footer {
    margin-top: 17px;
    padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,.06);
    color: rgba(255,255,255,.42);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .08em;
  }

  .live {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #6dffdc;
  }

  .live i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #5cffd8;
    box-shadow: 0 0 15px rgba(92,255,216,.8);
  }

  .empty {
    padding: 46px 20px;
    text-align: center;
    border: 1px dashed rgba(255,255,255,.1);
    border-radius: 25px;
  }

  .empty span {
    color: rgba(99,255,219,.5);
    font-size: 10px;
    letter-spacing: .15em;
  }

  .empty h2 {
    font-size: 20px;
    color: rgba(255,255,255,.7);
  }

  @media (max-width: 640px) {
    .page {
      padding: 18px 12px 60px;
    }

    .hero {
      align-items: start;
      flex-direction: column;
    }

    .hero button {
      align-self: stretch;
    }

    .stage span {
      font-size: 7px;
    }

    .trackingGrid {
      grid-template-columns: 1fr;
    }
  }
`;


export default function MyOrdersPage() {
  return (
    <Suspense fallback={<main className="page loading"><p>Connecting to your live order field…</p></main>}>
      <MyOrdersContent />
    </Suspense>
  );
}

