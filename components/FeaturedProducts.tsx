"use client";

import { CSSProperties, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Product = {
  id: string | number;
  name?: string | null;
  price?: number | string | null;
  stock?: number | string | null;
  online_stock_limit?: number | string | null;
  image?: string | null;
  image_url?: string | null;
  sell_online?: boolean | null;
  is_active?: boolean | null;
};

export default function FeaturedProducts() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    async function loadProducts() {
      setLoading(true);

      const { data, error } = await supabase
        .from("products")
        .select(
          `
            id,
            name,
            price,
            stock,
            online_stock_limit,
            image,
            image_url,
            sell_online,
            is_active
          `
        )
        .eq("sell_online", true)
        .eq("is_active", true)
        .limit(12);

      if (error) {
        console.error("Featured products error:", error);
        setProducts([]);
      } else {
        setProducts((data as Product[]) || []);
      }

      setLoading(false);
    }

    loadProducts();
  }, []);

  if (!mounted || loading) {
    return (
      <section style={styles.featuredSection}>
        <div style={styles.headingArea}>
          <span style={styles.eyebrow}>NEW CITY STYLE</span>
          <h2 style={styles.heading}>Featured Products</h2>
          <p style={styles.headingText}>
            Premium fashion selected for every member of the family.
          </p>
        </div>

        <p style={styles.statusText}>Loading products...</p>
      </section>
    );
  }

  return (
    <section style={styles.featuredSection}>
      <div style={styles.headingArea}>
        <span style={styles.eyebrow}>NEW CITY STYLE</span>
        <h2 style={styles.heading}>Featured Products</h2>
        <p style={styles.headingText}>
          Premium fashion selected for every member of the family.
        </p>
      </div>

      {products.length === 0 ? (
        <p style={styles.statusText}>No online products available.</p>
      ) : (
        <div style={styles.productGrid}>
          {products.map((item) => {
            const imageSource = item.image_url || item.image || "";
            const productName = item.name || "Premium Product";

            const totalStock = Number(item.stock || 0);
            const onlineLimit = Number(item.online_stock_limit || 0);

            const onlineQuantity =
              onlineLimit > 0
                ? Math.min(onlineLimit, totalStock)
                : totalStock;

            const isAvailableOnline =
              onlineQuantity > 0 && totalStock > 0;

            return (
              <article
                key={item.id}
                style={styles.productCard}
                onClick={() => router.push(`/product/${item.id}`)}
              >
                <div style={styles.imageArea}>
                  {imageSource ? (
                    <img
                      src={imageSource}
                      alt={productName}
                      loading="lazy"
                      style={styles.image}
                    />
                  ) : (
                    <div style={styles.imageFallback}>NCS</div>
                  )}

                  <span style={styles.newBadge}>NEW</span>
                </div>

                <div style={styles.productContent}>
                  <h3 style={styles.productName}>{productName}</h3>

                  <div style={styles.price}>
                    ₹{Number(item.price || 0).toLocaleString("en-IN")}
                  </div>

                  <div
                    style={{
                      ...styles.stock,
                      color: isAvailableOnline ? "#067647" : "#b42318",
                    }}
                  >
                    {isAvailableOnline
                      ? `${onlineQuantity} available online`
                      : "Out of stock"}
                  </div>

                  <button
                    type="button"
                    style={styles.button}
                    onClick={(event) => {
                      event.stopPropagation();
                      router.push(`/product/${item.id}`);
                    }}
                  >
                    <span>View Product</span>
                    <span style={styles.arrow}>→</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  featuredSection: {
    padding: "65px 20px",
    background: "#f8f9fc",
  },
  headingArea: {
    maxWidth: 850,
    margin: "0 auto 38px",
    textAlign: "center",
  },
  eyebrow: {
    color: "#d4af37",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 2,
  },
  heading: {
    margin: "10px 0 0",
    color: "#0a2e73",
    fontSize: "clamp(34px, 4vw, 48px)",
    fontWeight: 900,
    lineHeight: 1.1,
  },
  headingText: {
    margin: "13px 0 0",
    color: "#697386",
    fontSize: 15,
  },
  productGrid: {
    width: "min(1400px, 100%)",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 22,
    margin: "0 auto",
  },
  productCard: {
    overflow: "hidden",
    border: "1px solid #e7e9ef",
    borderRadius: 18,
    background: "#ffffff",
    cursor: "pointer",
    boxShadow: "0 10px 28px rgba(7, 29, 73, 0.09)",
  },
  imageArea: {
    position: "relative",
    overflow: "hidden",
    aspectRatio: "4 / 5",
    background: "#edf1f8",
  },
  image: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
  },
  imageFallback: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#d4af37",
    fontSize: 28,
    fontWeight: 900,
    background: "linear-gradient(145deg, #0a2e73, #174ba9)",
  },
  newBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "#d4af37",
    color: "#0a2e73",
    fontSize: 10,
    fontWeight: 900,
  },
  productContent: {
    padding: 17,
  },
  productName: {
    minHeight: 48,
    margin: 0,
    overflow: "hidden",
    color: "#0a2e73",
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.35,
  },
  price: {
    marginTop: 12,
    color: "#d4af37",
    fontSize: 24,
    fontWeight: 900,
  },
  stock: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: 700,
  },
  button: {
    width: "100%",
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 15,
    border: 0,
    borderRadius: 11,
    background: "linear-gradient(90deg, #0a2e73, #1548a6)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },
  arrow: {
    fontSize: 17,
  },
  statusText: {
    margin: "35px 0",
    color: "#687385",
    textAlign: "center",
  },
};