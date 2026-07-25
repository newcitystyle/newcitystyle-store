"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminHomePreviewPage() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8f4ec",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            border: "none",
            background: "#0A2E73",
            color: "#ffffff",
            padding: "10px 18px",
            borderRadius: "8px",
            cursor: "pointer",
            marginBottom: "24px",
          }}
        >
          ← Back
        </button>

        <section
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            padding: "32px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          }}
        >
          <h1
            style={{
              margin: 0,
              color: "#0A2E73",
              fontSize: "32px",
            }}
          >
            Home Page Preview
          </h1>

          <p
            style={{
              color: "#555555",
              fontSize: "16px",
              lineHeight: 1.7,
              marginTop: "12px",
            }}
          >
            Preview the NEW CITY STYLE customer website home page.
          </p>

          <Link
            href="/"
            target="_blank"
            style={{
              display: "inline-block",
              marginTop: "20px",
              background: "#D4AF37",
              color: "#0A2E73",
              padding: "12px 22px",
              borderRadius: "8px",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Open Customer Home Page
          </Link>
        </section>
      </div>
    </main>
  );
}