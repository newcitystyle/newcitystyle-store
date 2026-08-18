"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type WishlistItem = {
  id: number | string;
  created_at?: string | null;
  product_id: number | string;
  name: string;
  image: string;
  price: number;
  mrp?: number | null;
  stock?: number | null;
  category?: string | null;
  description?: string | null;
  size?: string | null;
  color?: string | null;
  design_unit_id?: number | null;
  variant_id?: number | null;
  barcode?: string | null;
};

type ToastState = {
  message: string;
  type: "success" | "error";
} | null;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function WishlistPage() {
  const router = useRouter();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<number | string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [sortOption, setSortOption] = useState<
    "newest" | "price-low" | "price-high" | "name"
  >("newest");

  useEffect(() => {
    loadWishlist();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadWishlist() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let query = supabase
        .from("wishlist")
        .select("*")
        .order("created_at", { ascending: false });

      if (user) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      setItems((data as WishlistItem[]) || []);
    } catch (error) {
      console.error("Wishlist load error:", error);
      setToast({
        message:
          error instanceof Error ? error.message : "Unable to load wishlist.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(id: number | string) {
    const confirmed = window.confirm(
      "Remove this product from your wishlist?"
    );

    if (!confirmed) return;

    setBusyItemId(id);

    try {
      const { error } = await supabase
        .from("wishlist")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setItems((current) => current.filter((item) => item.id !== id));
      setToast({
        message: "Product removed from wishlist.",
        type: "success",
      });
    } catch (error) {
      console.error("Wishlist remove error:", error);
      setToast({
        message:
          error instanceof Error ? error.message : "Unable to remove product.",
        type: "error",
      });
    } finally {
      setBusyItemId(null);
    }
  }

  async function moveToCart(item: WishlistItem) {
    setBusyItemId(item.id);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setToast({ message: "Please login first.", type: "error" });
        router.push("/login");
        return;
      }

      /*
       * Keep each selected design separate in cart.
       * Older wishlist rows may not yet contain design_unit_id/variant_id,
       * so image + size remain safe fallback identity fields.
       */
      let existingQuery = supabase
        .from("cart")
        .select("*")
        .eq("user_id", user.id)
        .eq("product_id", item.product_id)
        .eq("image", item.image || "")
        .eq("size", item.size || "");

      if (item.design_unit_id != null) {
        existingQuery = existingQuery.eq(
          "design_unit_id",
          item.design_unit_id
        );
      }

      if (item.variant_id != null) {
        existingQuery = existingQuery.eq(
          "variant_id",
          item.variant_id
        );
      }

      const { data: existingItems, error: existingError } =
        await existingQuery.limit(1);

      if (existingError) throw existingError;

      const existingItem = existingItems?.[0] || null;

      if (existingItem) {
        const { error: updateError } = await supabase
          .from("cart")
          .update({
            quantity: Number(existingItem.quantity || 0) + 1,
          })
          .eq("id", existingItem.id);

        if (updateError) throw updateError;
      } else {
        const cartRow: Record<string, unknown> = {
          user_id: user.id,
          product_id: item.product_id,
          name: item.name,
          image: item.image,
          price: Number(item.price),
          quantity: 1,
          size: item.size || "",
          color: item.color || null,
        };

        if (item.design_unit_id != null) {
          cartRow.design_unit_id = item.design_unit_id;
        }

        if (item.variant_id != null) {
          cartRow.variant_id = item.variant_id;
        }

        if (item.barcode) {
          cartRow.barcode = item.barcode;
        }

        const { error: insertError } = await supabase
          .from("cart")
          .insert(cartRow);

        if (insertError) throw insertError;
      }

      const { error: removeError } = await supabase
        .from("wishlist")
        .delete()
        .eq("id", item.id);

      if (removeError) throw removeError;

      setItems((current) =>
        current.filter((wishlistItem) => wishlistItem.id !== item.id)
      );

      setToast({
        message: "Selected design moved to cart successfully.",
        type: "success",
      });
    } catch (error) {
      console.error("Move to cart error:", error);
      setToast({
        message:
          error instanceof Error
            ? error.message
            : "Unable to move product to cart.",
        type: "error",
      });
    } finally {
      setBusyItemId(null);
    }
  }

  const sortedItems = useMemo(() => {
    const copiedItems = [...items];

    if (sortOption === "price-low") {
      return copiedItems.sort(
        (a, b) => Number(a.price) - Number(b.price)
      );
    }

    if (sortOption === "price-high") {
      return copiedItems.sort(
        (a, b) => Number(b.price) - Number(a.price)
      );
    }

    if (sortOption === "name") {
      return copiedItems.sort((a, b) => a.name.localeCompare(b.name));
    }

    return copiedItems.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [items, sortOption]);

  if (loading) {
    return (
      <main className="loadingPage">
        <div className="loader" />
        <h2>Loading Wishlist...</h2>
        <p>Your saved fashion is getting ready.</p>

        <style jsx>{`
          .loadingPage {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #f8f4ec;
            color: #0a2e73;
            text-align: center;
          }
          .loader {
            width: 50px;
            height: 50px;
            margin-bottom: 18px;
            border: 4px solid #e7eaf0;
            border-top-color: #d4af37;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          h2 { margin: 0; }
          p { color: #667085; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </main>
    );
  }

  return (
    <main className="page">
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === "success" ? "✓" : "!"}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="container">
        <section className="hero">
          <div>
            <p className="eyebrow">NEW CITY STYLE</p>
            <h1>My Wishlist</h1>
            <p className="subtitle">
              Your favourite fashion, saved in one premium place.
            </p>
          </div>

          <div className="wishlistCount">
            <span>{items.length}</span>
            <small>Saved Products</small>
          </div>
        </section>

        {items.length === 0 ? (
          <section className="emptyState">
            <div className="emptyIcon">♡</div>
            <p className="eyebrow">YOUR COLLECTION</p>
            <h2>Your Wishlist is Empty</h2>
            <p>
              Save your favourite products here and shop them whenever you are
              ready.
            </p>
            <Link href="/">Explore Collections</Link>
          </section>
        ) : (
          <>
            <section className="toolbar">
              <div>
                <strong>{items.length}</strong>
                <span>
                  {items.length === 1 ? " product saved" : " products saved"}
                </span>
              </div>

              <label>
                Sort By
                <select
                  value={sortOption}
                  onChange={(event) =>
                    setSortOption(
                      event.target.value as
                        | "newest"
                        | "price-low"
                        | "price-high"
                        | "name"
                    )
                  }
                >
                  <option value="newest">Newest First</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="name">Name: A to Z</option>
                </select>
              </label>
            </section>

            <section className="grid">
              {sortedItems.map((item) => {
                const price = Number(item.price || 0);
                const mrp = Number(item.mrp || price + 200);
                const stock =
                  typeof item.stock === "number" ? item.stock : 10;
                const discount =
                  mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
                const isBusy = busyItemId === item.id;

                return (
                  <article className="card" key={item.id}>
                    <div className="imageWrap">
                      {item.image ? (
                        <img src={item.image} alt={item.name} />
                      ) : (
                        <div className="imageFallback">NCS</div>
                      )}

                      <span className="heartBadge">♥</span>

                      {discount > 0 && (
                        <span className="discountBadge">{discount}% OFF</span>
                      )}

                      <Link
                        href={`/product/${item.product_id}`}
                        className="quickView"
                      >
                        View Product
                      </Link>
                    </div>

                    <div className="cardBody">
                      <div className="topMeta">
                        <span className="category">
                          {item.category || "Premium Fashion"}
                        </span>

                        <span
                          className={
                            stock > 5
                              ? "stock inStock"
                              : stock > 0
                                ? "stock lowStock"
                                : "stock outStock"
                          }
                        >
                          {stock > 5
                            ? "In Stock"
                            : stock > 0
                              ? `${stock} left`
                              : "Out of Stock"}
                        </span>
                      </div>

                      <Link
                        href={`/product/${item.product_id}`}
                        className="productName"
                      >
                        {item.name}
                      </Link>

                      <div className="rating">
                        <span>★★★★★</span>
                        <small>4.8</small>
                      </div>

                      <div className="priceRow">
                        <strong>{formatCurrency(price)}</strong>
                        {mrp > price && <del>{formatCurrency(mrp)}</del>}
                      </div>

                      <p className="saveText">
                        You save {formatCurrency(Math.max(mrp - price, 0))}
                      </p>

                      <p className="description">
                        {item.description ||
                          "Premium quality fashion selected for comfort, style and confidence."}
                      </p>

                      <div className="actions">
                        <button
                          className="cartButton"
                          onClick={() => moveToCart(item)}
                          disabled={isBusy || stock <= 0}
                        >
                          {isBusy
                            ? "Please Wait..."
                            : stock <= 0
                              ? "Out of Stock"
                              : "Move to Cart"}
                        </button>

                        <button
                          className="removeButton"
                          onClick={() => removeItem(item.id)}
                          disabled={isBusy}
                          aria-label={`Remove ${item.name}`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        )}
      </div>

      <style jsx>{`
        :global(*) { box-sizing: border-box; }
        :global(body) {
          margin: 0;
          background: #f8f4ec;
          color: #172033;
          font-family: Inter, Poppins, Arial, sans-serif;
        }
        .page {
          min-height: 100vh;
          padding: 35px 20px 75px;
          background: radial-gradient(circle at top right, rgba(212,175,55,.12), transparent 26%), #f8f4ec;
        }
        .container { width: 100%; max-width: 1450px; margin: 0 auto; }
        .toast {
          position: fixed;
          top: 95px;
          right: 22px;
          z-index: 3000;
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: 360px;
          padding: 14px 17px;
          border-radius: 12px;
          color: white;
          font-size: 13px;
          font-weight: 800;
          box-shadow: 0 18px 40px rgba(16,24,40,.24);
          animation: slideIn .25s ease;
        }
        .toast.success { background: #067647; }
        .toast.error { background: #b42318; }
        .hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
          padding: 30px;
          border-radius: 22px;
          background: linear-gradient(135deg, #0a2e73, #164ca8);
          color: white;
          box-shadow: 0 18px 42px rgba(10,46,115,.2);
        }
        .eyebrow {
          margin: 0 0 8px;
          color: #d4af37;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2px;
        }
        .hero h1 { margin: 0; font-size: clamp(34px,5vw,50px); }
        .subtitle { margin: 10px 0 0; color: rgba(255,255,255,.76); }
        .wishlistCount {
          min-width: 145px;
          padding: 18px;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 18px;
          background: rgba(255,255,255,.08);
          text-align: center;
          backdrop-filter: blur(10px);
        }
        .wishlistCount span, .wishlistCount small { display: block; }
        .wishlistCount span { color: #d4af37; font-size: 36px; font-weight: 950; }
        .wishlistCount small { margin-top: 4px; color: rgba(255,255,255,.72); }
        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
          padding: 17px 20px;
          border: 1px solid #e4e7ec;
          border-radius: 15px;
          background: white;
          box-shadow: 0 8px 24px rgba(16,24,40,.05);
        }
        .toolbar strong { color: #0a2e73; }
        .toolbar span { color: #667085; font-size: 13px; }
        .toolbar label {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #475467;
          font-size: 12px;
          font-weight: 800;
        }
        .toolbar select {
          min-width: 170px;
          height: 40px;
          padding: 0 11px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: white;
          color: #344054;
          outline: none;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
        }
        .card {
          overflow: hidden;
          border: 1px solid rgba(10,46,115,.08);
          border-radius: 20px;
          background: white;
          box-shadow: 0 10px 30px rgba(16,24,40,.08);
          transition: transform .35s ease, box-shadow .35s ease, border-color .35s ease;
        }
        .card:hover {
          transform: translateY(-10px);
          border-color: rgba(212,175,55,.65);
          box-shadow: 0 24px 52px rgba(16,24,40,.16);
        }
        .imageWrap { position: relative; height: 355px; overflow: hidden; background: #f5f7fb; }
        .imageWrap img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform .45s ease;
        }
        .card:hover .imageWrap img { transform: scale(1.08); }
        .imageFallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg,#0a2e73,#164ca8);
          color: #d4af37;
          font-size: 28px;
          font-weight: 950;
        }
        .heartBadge, .discountBadge {
          position: absolute;
          top: 14px;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .heartBadge {
          left: 14px;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(255,255,255,.92);
          color: #d92d20;
          box-shadow: 0 7px 18px rgba(16,24,40,.18);
        }
        .discountBadge {
          right: 14px;
          padding: 7px 10px;
          border-radius: 999px;
          background: #ecfdf3;
          color: #067647;
          font-size: 10px;
          font-weight: 900;
        }
        .quickView {
          position: absolute;
          right: 15px;
          bottom: 15px;
          left: 15px;
          padding: 12px;
          border-radius: 10px;
          background: rgba(10,46,115,.92);
          color: white;
          font-size: 12px;
          font-weight: 850;
          text-align: center;
          text-decoration: none;
          opacity: 0;
          transform: translateY(14px);
          transition: opacity .25s ease, transform .25s ease;
          backdrop-filter: blur(10px);
        }
        .card:hover .quickView { opacity: 1; transform: translateY(0); }
        .cardBody { padding: 19px; }
        .topMeta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }
        .category {
          color: #d4af37;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .9px;
          text-transform: uppercase;
        }
        .stock { padding: 6px 9px; border-radius: 999px; font-size: 10px; font-weight: 850; }
        .inStock { background: #ecfdf3; color: #067647; }
        .lowStock { background: #fff4e8; color: #b54708; }
        .outStock { background: #fef3f2; color: #b42318; }
        .productName {
          display: block;
          color: #0a2e73;
          font-size: 21px;
          font-weight: 850;
          line-height: 1.25;
          text-decoration: none;
        }
        .rating { display: flex; align-items: center; gap: 7px; margin-top: 10px; }
        .rating span { color: #f59e0b; letter-spacing: 1px; }
        .rating small { color: #667085; font-weight: 750; }
        .priceRow { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; margin-top: 12px; }
        .priceRow strong { color: #d4af37; font-size: 25px; }
        .priceRow del { color: #98a2b3; font-size: 13px; }
        .saveText { margin: 6px 0 0; color: #067647; font-size: 12px; font-weight: 750; }
        .description {
          display: -webkit-box;
          overflow: hidden;
          margin: 12px 0 0;
          color: #667085;
          font-size: 13px;
          line-height: 1.6;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }
        .actions { display: grid; grid-template-columns: 1fr auto; gap: 10px; margin-top: 19px; }
        .actions button { min-height: 44px; border-radius: 10px; font-weight: 850; cursor: pointer; }
        .actions button:disabled { opacity: .6; cursor: not-allowed; }
        .cartButton { border: 0; background: linear-gradient(135deg,#0a2e73,#164ca8); color: white; }
        .removeButton { padding: 0 15px; border: 1px solid #f04438; background: white; color: #b42318; }
        .emptyState {
          min-height: 470px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 50px 20px;
          border: 1px solid #e4e7ec;
          border-radius: 20px;
          background: radial-gradient(circle at center, rgba(212,175,55,.08), transparent 42%), white;
          text-align: center;
          box-shadow: 0 14px 34px rgba(16,24,40,.06);
        }
        .emptyIcon {
          width: 90px;
          height: 90px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 22px;
          border-radius: 25px;
          background: linear-gradient(135deg,#0a2e73,#164ca8);
          color: #d4af37;
          font-size: 46px;
          box-shadow: 0 16px 36px rgba(10,46,115,.22);
        }
        .emptyState h2 { margin: 0; color: #0a2e73; font-size: 31px; }
        .emptyState > p:not(.eyebrow) {
          max-width: 500px;
          margin: 14px 0 25px;
          color: #667085;
          line-height: 1.7;
        }
        .emptyState :global(a) {
          padding: 14px 24px;
          border-radius: 11px;
          background: linear-gradient(135deg,#d4af37,#f1d26a);
          color: #0a2e73;
          font-weight: 900;
          text-decoration: none;
          box-shadow: 0 12px 24px rgba(212,175,55,.24);
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @media (max-width: 780px) {
          .hero { align-items: flex-start; flex-direction: column; }
          .wishlistCount { width: 100%; }
          .toolbar { align-items: stretch; flex-direction: column; }
          .toolbar label { justify-content: space-between; }
          .toolbar select { flex: 1; }
        }
        @media (max-width: 620px) {
          .page { padding: 20px 10px 50px; }
          .hero { padding: 20px; }
          .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .imageWrap { height: 240px; }
          .cardBody { padding: 13px; }
          .productName { font-size: 16px; }
          .priceRow strong { font-size: 20px; }
          .description { display: none; }
          .topMeta { align-items: flex-start; flex-direction: column; }
          .actions { grid-template-columns: 1fr; }
          .removeButton { min-height: 40px !important; }
          .toast { top: 80px; right: 10px; left: 10px; max-width: none; }
        }
        @media (max-width: 390px) {
          .grid { grid-template-columns: 1fr; }
          .imageWrap { height: 340px; }
        }
      `}</style>
    </main>
  );
}