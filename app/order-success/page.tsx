"use client";

import { useRouter } from "next/navigation";

export default function OrderSuccessPage() {
  const router = useRouter();

  return (
    <div
      style={{
        background: "#F8F4EC",
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial",
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: "50px",
          borderRadius: "15px",
          textAlign: "center",
          boxShadow: "0 10px 25px rgba(0,0,0,.15)",
          maxWidth: "500px",
          width: "100%",
        }}
      >
        <div
          style={{
            fontSize: "70px",
            marginBottom: "20px",
          }}
        >
          ✅
        </div>

        <h1
          style={{
            color: "#0A2E73",
            marginBottom: "15px",
          }}
        >
          Order Placed Successfully!
        </h1>

        <p
          style={{
            color: "#666",
            fontSize: "18px",
            lineHeight: "30px",
          }}
        >
          Thank you for shopping with
          <br />
          <b>NEW CITY STYLE</b>.
          <br />
          Your order has been received successfully.
        </p>

        <button
          onClick={() => router.push("/")}
          style={{
            marginTop: "35px",
            background: "#D4AF37",
            color: "#fff",
            border: "none",
            padding: "15px 35px",
            borderRadius: "10px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "16px",
          }}
        >
          Continue Shopping
        </button>
      </div>
    </div>
  );
}