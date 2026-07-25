"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Product = {
  id: string | number;
  name?: string | null;
  price?: number | string | null;
  stock?: number | string | null;
  image?: string | null;
  image_url?: string | null;
};

export default function FeaturedProducts() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .limit(12);

      if (error) {
        console.error("Featured products error:", error);
        setProducts([]);
      } else {
        setProducts(data || []);
      }

      setLoading(false);
    }

    loadProducts();
  }, []);

  if (loading) {
    return (
      <section className="featuredSection">
        <h2>Featured Products</h2>
        <p className="statusText">Loading products...</p>

        <style jsx>{styles}</style>
      </section>
    );
  }

  return (
    <section className="featuredSection">
      <div className="headingArea">
        <span>NEW CITY STYLE</span>
        <h2>Featured Products</h2>
        <p>Premium fashion selected for every member of the family.</p>
      </div>

      {products.length === 0 ? (
        <p className="statusText">No featured products available.</p>
      ) : (
        <div className="productGrid">
          {products.map((item) => {
            const imageSource = item.image_url || item.image || "";
            const productName = item.name || "Premium Product";

            return (
              <article
                key={item.id}
                className="productCard"
                onClick={() => router.push(`/product/${item.id}`)}
              >
                <div className="imageArea">
                  {imageSource ? (
                    <img src={imageSource} alt={productName} loading="lazy" />
                  ) : (
                    <div className="imageFallback">NCS</div>
                  )}

                  <span className="newBadge">NEW</span>
                </div>

                <div className="productContent">
                  <h3>{productName}</h3>

                  <div className="price">₹{item.price ?? 0}</div>

                  <div className="stock">
                    {Number(item.stock || 0) > 0
                      ? `${item.stock} in stock`
                      : "Out of stock"}
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      router.push(`/product/${item.id}`);
                    }}
                  >
                    View Product
                    <span>→</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style jsx>{styles}</style>
    </section>
  );
}

const styles = `
  .featuredSection {
    padding: 65px 20px;
    background: #f8f9fc;
  }

  .headingArea {
    max-width: 850px;
    margin: 0 auto 38px;
    text-align: center;
  }

  .headingArea > span {
    color: #d4af37;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 2px;
  }

  h2 {
    margin: 10px 0 0;
    color: #0a2e73;
    font-size: clamp(34px, 4vw, 48px);
    font-weight: 900;
    line-height: 1.1;
  }

  .headingArea p {
    margin: 13px 0 0;
    color: #697386;
    font-size: 15px;
  }

  .productGrid {
    width: min(1400px, 100%);
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 22px;
    margin: 0 auto;
  }

  .productCard {
    overflow: hidden;
    border: 1px solid #e7e9ef;
    border-radius: 18px;
    background: #ffffff;
    cursor: pointer;
    box-shadow: 0 10px 28px rgba(7, 29, 73, 0.09);
    transition:
      transform 0.28s ease,
      box-shadow 0.28s ease;
  }

  .productCard:hover {
    transform: translateY(-7px);
    box-shadow: 0 20px 42px rgba(7, 29, 73, 0.16);
  }

  .imageArea {
    position: relative;
    overflow: hidden;
    aspect-ratio: 4 / 5;
    background: #edf1f8;
  }

  .imageArea img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    transition: transform 0.4s ease;
  }

  .productCard:hover img {
    transform: scale(1.05);
  }

  .imageFallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #d4af37;
    font-size: 28px;
    font-weight: 900;
    background: linear-gradient(145deg, #0a2e73, #174ba9);
  }

  .newBadge {
    position: absolute;
    top: 12px;
    left: 12px;
    padding: 6px 10px;
    border-radius: 999px;
    background: #d4af37;
    color: #0a2e73;
    font-size: 10px;
    font-weight: 900;
  }

  .productContent {
    padding: 17px;
  }

  .productContent h3 {
    min-height: 48px;
    display: -webkit-box;
    overflow: hidden;
    margin: 0;
    color: #0a2e73;
    font-size: 18px;
    font-weight: 800;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .price {
    margin-top: 12px;
    color: #d4af37;
    font-size: 24px;
    font-weight: 900;
  }

  .stock {
    margin-top: 7px;
    color: #6f7787;
    font-size: 12px;
  }

  .productContent button {
    width: 100%;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    margin-top: 15px;
    border: 0;
    border-radius: 11px;
    background: linear-gradient(90deg, #0a2e73, #1548a6);
    color: #ffffff;
    font-size: 12px;
    font-weight: 850;
    cursor: pointer;
  }

  .productContent button span {
    font-size: 17px;
  }

  .statusText {
    margin: 35px 0;
    color: #687385;
    text-align: center;
  }

  @media (max-width: 1050px) {
    .productGrid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 700px) {
    .featuredSection {
      padding: 45px 10px;
    }

    .headingArea {
      margin-bottom: 25px;
    }

    .headingArea > span {
      font-size: 9px;
      letter-spacing: 1.4px;
    }

    h2 {
      font-size: 32px;
    }

    .headingArea p {
      font-size: 12px;
    }

    .productGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .productCard {
      border-radius: 14px;
    }

    .newBadge {
      top: 8px;
      left: 8px;
      padding: 5px 8px;
      font-size: 8px;
    }

    .productContent {
      padding: 11px;
    }

    .productContent h3 {
      min-height: 38px;
      font-size: 14px;
      line-height: 1.3;
    }

    .price {
      margin-top: 8px;
      font-size: 19px;
    }

    .stock {
      margin-top: 5px;
      font-size: 10px;
    }

    .productContent button {
      min-height: 38px;
      margin-top: 11px;
      border-radius: 9px;
      font-size: 10px;
    }

    .productCard:hover {
      transform: none;
    }

    .productCard:hover img {
      transform: none;
    }
  }
`;