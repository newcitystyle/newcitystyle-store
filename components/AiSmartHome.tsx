"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string | number;
  name?: string | null;
  product_name?: string | null;
  title?: string | null;
  price?: number | string | null;
  mrp?: number | string | null;
  stock?: number | string | null;
  online_stock_limit?: number | string | null;
  image?: string | null;
  image_url?: string | null;
  brand?: string | null;
  category?: string | null;
  sizes?: string[] | string | null;
  colors?: string[] | string | null;
  is_new_arrival?: boolean | string | number | null;
  is_featured?: boolean | string | number | null;
  is_on_sale?: boolean | string | number | null;
  discount_percent?: number | string | null;
  sell_online?: boolean | null;
  is_active?: boolean | null;
};

type AiProduct = {
  id: string | number;
  name: string;
  price: number;
  mrp: number;
  stock: number;
  onlineStock: number;
  brand: string;
  category: string;
  sizes: string[];
  colors: string[];
  image: string;
};

type AiResponse = {
  success?: boolean;
  answer?: string;
  products?: AiProduct[];
};

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function enabled(value: unknown) {
  if (value === true || value === 1) return true;
  return ["true", "1", "yes", "on"].includes(
    String(value ?? "").trim().toLowerCase(),
  );
}

function nameOf(product: Product) {
  return (
    product.name ||
    product.product_name ||
    product.title ||
    "Premium Product"
  );
}

function imageOf(product: Product) {
  return product.image_url || product.image || "";
}

function onlineStock(product: Product) {
  const stock = Math.max(0, num(product.stock));
  const limit = Math.max(0, num(product.online_stock_limit));
  return limit > 0 ? Math.min(stock, limit) : stock;
}

function discountOf(product: Product) {
  const price = num(product.price);
  const mrp = Math.max(price, num(product.mrp));
  if (num(product.discount_percent) > 0) {
    return Math.round(num(product.discount_percent));
  }
  return mrp > price && mrp > 0
    ? Math.round(((mrp - price) / mrp) * 100)
    : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AiSmartHome() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [aiProducts, setAiProducts] = useState<AiProduct[]>([]);
  const [aiAnswer, setAiAnswer] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("sell_online", true)
        .eq("is_active", true)
        .limit(80);

      if (error) throw error;

      const rows = (data || []) as Product[];
      setProducts(rows);

      let storedQuery = "";
      try {
        storedQuery =
          window.localStorage.getItem("ncs_ai_last_query")?.trim() || "";
      } catch {
        // Personalization is optional.
      }

      setLastQuery(storedQuery);

      if (storedQuery) {
        try {
          const response = await fetch("/api/ai-shopping", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              question: storedQuery,
              path: "/",
            }),
          });

          const result = (await response.json()) as AiResponse;

          if (response.ok && result.success) {
            setAiProducts(result.products || []);
            setAiAnswer(result.answer || "");
          }
        } catch {
          // Fall back to deterministic live catalogue sections.
        }
      }
    } catch (error) {
      console.error("AI Smart Home load error:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  const newArrivals = useMemo(
    () =>
      products
        .filter((item) => onlineStock(item) > 0)
        .sort((a, b) => {
          const newDiff =
            Number(enabled(b.is_new_arrival)) -
            Number(enabled(a.is_new_arrival));
          if (newDiff !== 0) return newDiff;
          return onlineStock(b) - onlineStock(a);
        })
        .slice(0, 4),
    [products],
  );

  const smartDeals = useMemo(
    () =>
      products
        .filter((item) => onlineStock(item) > 0)
        .sort((a, b) => discountOf(b) - discountOf(a))
        .filter((item) => discountOf(item) > 0)
        .slice(0, 4),
    [products],
  );

  const fastMoving = useMemo(
    () =>
      products
        .filter((item) => onlineStock(item) > 0)
        .sort((a, b) => {
          const featured =
            Number(enabled(b.is_featured)) -
            Number(enabled(a.is_featured));
          if (featured !== 0) return featured;
          return onlineStock(a) - onlineStock(b);
        })
        .slice(0, 4),
    [products],
  );

  function renderProduct(product: Product | AiProduct, keyPrefix: string) {
    const isAi = "onlineStock" in product;
    const id = product.id;
    const name = isAi ? product.name : nameOf(product);
    const image = isAi ? product.image : imageOf(product);
    const price = isAi ? product.price : num(product.price);
    const mrp = isAi
      ? Math.max(product.price, product.mrp)
      : Math.max(price, num(product.mrp));
    const stock = isAi ? product.onlineStock : onlineStock(product);
    const discount =
      mrp > price && mrp > 0
        ? Math.round(((mrp - price) / mrp) * 100)
        : 0;

    return (
      <button
        type="button"
        key={`${keyPrefix}-${id}`}
        className="smartProduct"
        onClick={() => router.push(`/product/${id}`)}
      >
        <div className="smartImage">
          {image ? (
            <img src={image} alt={name} loading="lazy" />
          ) : (
            <span>NCS</span>
          )}

          {discount > 0 && (
            <b className="dealBadge">{discount}% OFF</b>
          )}
        </div>

        <div className="smartProductInfo">
          <strong>{name}</strong>
          <div>
            <b>{money(price)}</b>
            {mrp > price && <del>{money(mrp)}</del>}
          </div>
          <small>
            {stock > 0 ? `${stock} available online` : "Out of stock"}
          </small>
          <em>View product →</em>
        </div>
      </button>
    );
  }

  if (loading) {
    return (
      <section className="smartHomeShell">
        <div className="smartLoading">
          <span />
          <strong>Preparing smart shopping picks…</strong>
        </div>

        <style jsx>{styles}</style>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="smartHomeShell">
      <div className="smartHeading">
        <div>
          <span>✦ NEW CITY STYLE INTELLIGENCE</span>
          <h2>Smarter Shopping, Live From Our Catalogue</h2>
          <p>
            Recommendations adapt to live online stock, offers and your recent
            Ask NCS shopping intent.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/search")}
        >
          Explore All Products →
        </button>
      </div>

      {lastQuery && aiProducts.length > 0 && (
        <section className="aiPersonalCard">
          <div className="aiPersonalHeader">
            <div className="aiIcon">AI</div>
            <div>
              <span>PERSONALIZED FOR YOU</span>
              <h3>Based on your recent Ask NCS request</h3>
              <p>
                “{lastQuery}”
              </p>
            </div>
          </div>

          {aiAnswer && (
            <div className="aiAnswerPreview">
              {aiAnswer.length > 280
                ? `${aiAnswer.slice(0, 280)}…`
                : aiAnswer}
            </div>
          )}

          <div className="smartGrid">
            {aiProducts.map((item) => renderProduct(item, "ai"))}
          </div>
        </section>
      )}

      <div className="smartSection">
        <div className="sectionTitle">
          <div>
            <span>JUST IN</span>
            <h3>Fresh & Available Now</h3>
          </div>
          <small>Live catalogue • in-stock first</small>
        </div>

        <div className="smartGrid">
          {newArrivals.map((item) => renderProduct(item, "new"))}
        </div>
      </div>

      {smartDeals.length > 0 && (
        <div className="smartSection">
          <div className="sectionTitle">
            <div>
              <span>SMART VALUE</span>
              <h3>Best Live Deals</h3>
            </div>
            <small>Calculated from current price vs MRP</small>
          </div>

          <div className="smartGrid">
            {smartDeals.map((item) => renderProduct(item, "deal"))}
          </div>
        </div>
      )}

      <div className="smartSection">
        <div className="sectionTitle">
          <div>
            <span>SMART PICKS</span>
            <h3>Popular-Looking Picks Ready To Shop</h3>
          </div>
          <small>Featured + live-stock signals</small>
        </div>

        <div className="smartGrid">
          {fastMoving.map((item) => renderProduct(item, "smart"))}
        </div>
      </div>

      <div className="smartTrustStrip">
        <div>
          <b>Live Stock</b>
          <span>Recommendations respect online availability</span>
        </div>
        <div>
          <b>Ask NCS Memory</b>
          <span>Your recent shopping intent can shape home picks</span>
        </div>
        <div>
          <b>AI-Safe Fallback</b>
          <span>Core shopping still works if AI is unavailable</span>
        </div>
        <div>
          <b>Private by Design</b>
          <span>No payment or private customer data is sent to AI</span>
        </div>
      </div>

      <style jsx>{styles}</style>
    </section>
  );
}

const styles = `
.smartHomeShell {
  padding: 70px 20px;
  background:
    radial-gradient(circle at 90% 0%, rgba(212, 175, 55, 0.09), transparent 30%),
    linear-gradient(180deg, #f7f9fc 0%, #ffffff 45%, #f8f4ec 100%);
}

.smartHeading {
  width: min(1400px, 100%);
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 25px;
  margin: 0 auto 30px;
}

.smartHeading span,
.sectionTitle span,
.aiPersonalHeader span {
  color: #c89d1e;
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 1.7px;
}

.smartHeading h2 {
  max-width: 850px;
  margin: 8px 0 0;
  color: #0a2e73;
  font-size: clamp(34px, 4.5vw, 58px);
  line-height: 1.05;
  letter-spacing: -1.8px;
}

.smartHeading p {
  max-width: 760px;
  margin: 13px 0 0;
  color: #667085;
  font-size: 14px;
  line-height: 1.7;
}

.smartHeading > button {
  min-height: 48px;
  flex: 0 0 auto;
  padding: 0 18px;
  border: 1px solid #d4af37;
  border-radius: 12px;
  background: #0a2e73;
  color: #ffffff;
  font-size: 11px;
  font-weight: 850;
  cursor: pointer;
}

.aiPersonalCard,
.smartSection {
  width: min(1400px, 100%);
  margin: 0 auto 30px;
  padding: 24px;
  border: 1px solid rgba(10, 46, 115, 0.09);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 16px 45px rgba(10, 46, 115, 0.07);
}

.aiPersonalCard {
  border-color: rgba(212, 175, 55, 0.4);
  background:
    radial-gradient(circle at 100% 0%, rgba(212, 175, 55, 0.13), transparent 28%),
    #ffffff;
}

.aiPersonalHeader {
  display: flex;
  align-items: center;
  gap: 13px;
}

.aiIcon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  flex: 0 0 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #0a2e73, #164ca9);
  color: #f2d66c;
  font-size: 13px;
  font-weight: 950;
}

.aiPersonalHeader h3,
.sectionTitle h3 {
  margin: 5px 0 0;
  color: #0a2e73;
  font-size: 24px;
}

.aiPersonalHeader p {
  margin: 5px 0 0;
  color: #667085;
  font-size: 11px;
}

.aiAnswerPreview {
  margin: 16px 0 0;
  padding: 13px 15px;
  border-left: 3px solid #d4af37;
  border-radius: 0 10px 10px 0;
  background: #fffdf5;
  color: #475467;
  font-size: 11px;
  line-height: 1.6;
}

.sectionTitle {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.sectionTitle small {
  color: #98a2b3;
  font-size: 9px;
  font-weight: 700;
}

.smartGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.smartProduct {
  overflow: hidden;
  display: block;
  padding: 0;
  border: 1px solid #e5e9f0;
  border-radius: 16px;
  background: #ffffff;
  color: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(10, 46, 115, 0.05);
  transition: transform 0.22s ease, box-shadow 0.22s ease;
}

.smartProduct:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 32px rgba(10, 46, 115, 0.11);
}

.smartImage {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: #edf1f8;
  color: #d4af37;
  font-weight: 950;
}

.smartImage img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dealBadge {
  position: absolute;
  top: 9px;
  left: 9px;
  padding: 5px 8px;
  border-radius: 999px;
  background: #d4af37;
  color: #0a2e73;
  font-size: 8px;
  font-weight: 950;
}

.smartProductInfo {
  padding: 13px;
}

.smartProductInfo > strong {
  min-height: 38px;
  display: -webkit-box;
  overflow: hidden;
  color: #0a2e73;
  font-size: 12px;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.smartProductInfo > div {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 8px;
}

.smartProductInfo > div b {
  color: #c49a1f;
  font-size: 15px;
}

.smartProductInfo del {
  color: #98a2b3;
  font-size: 9px;
}

.smartProductInfo small,
.smartProductInfo em {
  display: block;
}

.smartProductInfo small {
  margin-top: 6px;
  color: #067647;
  font-size: 8px;
  font-weight: 800;
}

.smartProductInfo em {
  margin-top: 9px;
  color: #0a2e73;
  font-size: 8px;
  font-style: normal;
  font-weight: 850;
}

.smartTrustStrip {
  width: min(1400px, 100%);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 0 auto;
}

.smartTrustStrip > div {
  padding: 15px;
  border: 1px solid rgba(10, 46, 115, 0.08);
  border-radius: 14px;
  background: #ffffff;
}

.smartTrustStrip b,
.smartTrustStrip span {
  display: block;
}

.smartTrustStrip b {
  color: #0a2e73;
  font-size: 11px;
}

.smartTrustStrip span {
  margin-top: 4px;
  color: #667085;
  font-size: 8px;
  line-height: 1.4;
}

.smartLoading {
  min-height: 180px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  color: #0a2e73;
}

.smartLoading span {
  width: 34px;
  height: 34px;
  border: 3px solid #e7ebf3;
  border-top-color: #d4af37;
  border-radius: 50%;
  animation: smartSpin 0.8s linear infinite;
}

@keyframes smartSpin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1000px) {
  .smartGrid,
  .smartTrustStrip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .smartHeading {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 600px) {
  .smartHomeShell {
    padding: 45px 9px;
  }

  .aiPersonalCard,
  .smartSection {
    padding: 13px;
    border-radius: 17px;
  }

  .smartGrid {
    gap: 8px;
  }

  .smartProduct {
    border-radius: 12px;
  }

  .smartProductInfo {
    padding: 9px;
  }

  .smartProductInfo > strong {
    min-height: 34px;
    font-size: 10px;
  }

  .smartHeading h2 {
    font-size: 34px;
  }

  .sectionTitle {
    align-items: flex-start;
    flex-direction: column;
    gap: 5px;
  }

  .sectionTitle h3,
  .aiPersonalHeader h3 {
    font-size: 19px;
  }
}
`;