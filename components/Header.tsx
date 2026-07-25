"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Header() {
  const router = useRouter();

  const [search, setSearch] = useState("");

  function searchProduct() {
    if (!search.trim()) return;

    router.push(
      `/search?q=${encodeURIComponent(search)}`
    );
  }

  return (
    <header
      style={{
        background: "#0A2E73",
        color: "#fff",
        padding: "16px 40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "20px",
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}
    >
      <Link
        href="/"
        style={{
          color: "#D4AF37",
          fontSize: "28px",
          fontWeight: "bold",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        NEW CITY STYLE
      </Link>

      <div
        style={{
          display: "flex",
          flex: 1,
          maxWidth: "550px",
        }}
      >
        <input
          type="text"
          placeholder="Search for products..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              searchProduct();
            }
          }}
          style={{
            flex: 1,
            padding: "12px 16px",
            border: "none",
            outline: "none",
            borderRadius: "10px 0 0 10px",
            fontSize: "15px",
          }}
        />

        <button
          onClick={searchProduct}
          style={{
            background: "#D4AF37",
            color: "#fff",
            border: "none",
            padding: "0 24px",
            borderRadius: "0 10px 10px 0",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          🔍
        </button>
      </div>
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: "22px",
          whiteSpace: "nowrap",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#fff",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Home
        </Link>

        <Link
          href="/wishlist"
          style={{
            color: "#fff",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ❤️ Wishlist
        </Link>

        <Link
          href="/orders"
          style={{
            color: "#fff",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          📦 Orders
        </Link>

        <Link
          href="/cart"
          style={{
            color: "#fff",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          🛒 Cart
        </Link>

        <Link
          href="#"
          style={{
            color: "#fff",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          👤 Account
        </Link>
      </nav>
      </header>
  );
}