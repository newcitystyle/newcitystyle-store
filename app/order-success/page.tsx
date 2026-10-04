"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NcsLiveOrderPulse2036 from "@/components/NcsLiveOrderPulse2036";

export default function OrderSuccessPage() {
  const router = useRouter();
  const [orderId, setOrderId] = useState("");

  useEffect(() => {
    setOrderId(
      localStorage.getItem("new-city-style-last-order-id") || ""
    );
  }, []);

  return (
    <main className="successPage">
      <section className="successShell">
        <div className="signalMark">
          <div className="ring ringA" />
          <div className="ring ringB" />
          <div className="core">✓</div>
        </div>

        <span className="eyebrow">
          NEW CITY STYLE • ORDER SIGNAL ACQUIRED
        </span>

        <h1>Order locked in.</h1>

        <p className="lead">
          Your order is now connected to the NEW CITY STYLE fulfilment flow.
          {orderId ? ` Order #${orderId}.` : ""}
        </p>

        <div className="flow">
          <span className="active">CONFIRMED</span>
          <i />
          <span>PACKED</span>
          <i />
          <span>SHIPPED</span>
          <i />
          <span>DELIVERED</span>
        </div>

        <NcsLiveOrderPulse2036 />

        <div className="actions">
          <button
            className="primary"
            onClick={() =>
              router.push(
                orderId
                  ? `/my-orders?order=${encodeURIComponent(orderId)}`
                  : "/my-orders"
              )
            }
          >
            OPEN MY ORDER PULSE
          </button>

          <button
            className="secondary"
            onClick={() => router.push("/")}
          >
            CONTINUE SHOPPING
          </button>
        </div>
      </section>

      <style jsx>{`
        .successPage {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px 16px 60px;
          background:
            radial-gradient(circle at 50% 10%, rgba(63,255,215,.13), transparent 28%),
            radial-gradient(circle at 80% 20%, rgba(71,104,255,.12), transparent 28%),
            linear-gradient(180deg, #02090c, #03171b 55%, #02080a);
          color: #f5fffd;
          font-family: Arial, sans-serif;
        }

        .successShell {
          width: min(100%, 620px);
          text-align: center;
        }

        .signalMark {
          position: relative;
          width: 110px;
          height: 110px;
          margin: 0 auto 22px;
          display: grid;
          place-items: center;
        }

        .ring {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(80,255,214,.24);
          border-radius: 50%;
        }

        .ringA {
          animation: pulse 2.4s ease-out infinite;
        }

        .ringB {
          inset: 16px;
          animation: pulse 2.4s .7s ease-out infinite;
        }

        @keyframes pulse {
          70%, 100% {
            transform: scale(1.23);
            opacity: 0;
          }
        }

        .core {
          position: relative;
          z-index: 2;
          width: 62px;
          height: 62px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: linear-gradient(145deg, #4cf4cf, #8cffdf);
          color: #04251f;
          font-size: 29px;
          font-weight: 950;
          box-shadow: 0 0 42px rgba(70,255,211,.28);
        }

        .eyebrow {
          color: rgba(143,255,228,.54);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .18em;
        }

        h1 {
          margin: 8px 0 0;
          font-size: clamp(36px, 9vw, 58px);
          letter-spacing: -.055em;
        }

        .lead {
          max-width: 510px;
          margin: 13px auto 0;
          color: rgba(255,255,255,.6);
          font-size: 14px;
          line-height: 1.65;
        }

        .flow {
          display: grid;
          grid-template-columns: auto 1fr auto 1fr auto 1fr auto;
          align-items: center;
          gap: 7px;
          margin: 28px 0 16px;
          color: rgba(255,255,255,.25);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .09em;
        }

        .flow i {
          height: 1px;
          background: linear-gradient(
            90deg,
            rgba(77,255,215,.3),
            rgba(255,255,255,.05)
          );
        }

        .flow .active {
          color: #70ffdc;
        }

        .actions {
          display: grid;
          grid-template-columns: 1.25fr .75fr;
          gap: 10px;
          margin-top: 14px;
        }

        button {
          min-height: 48px;
          border-radius: 14px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .08em;
        }

        .primary {
          border: 0;
          background: linear-gradient(90deg, #47f0cb, #8cffdf);
          color: #03251f;
          box-shadow: 0 12px 32px rgba(68,255,211,.13);
        }

        .secondary {
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.035);
          color: rgba(255,255,255,.72);
        }

        @media (max-width: 520px) {
          .actions {
            grid-template-columns: 1fr;
          }

          .flow {
            gap: 4px;
            font-size: 7px;
          }
        }
      `}</style>
    </main>
  );
}
