"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CartItem = {
  id: number;
  user_id?: string | null;
  product_id?: string | number | null;
  name?: string | null;
  image?: string | null;
  price?: number | string | null;
  quantity?: number | string | null;
  size?: string | null;
  color?: string | null;
  design_unit_id?: number | string | null;
  variant_id?: number | string | null;
  barcode?: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function safeNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function CartPage() {
  const router = useRouter();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadCart();
  }, []);

  async function getCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  }

  async function loadCart() {
    setLoading(true);
    setErrorMessage("");

    const user = await getCurrentUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("cart")
      .select("*")
      .eq("user_id", user.id)
      .order("id", { ascending: false });

    if (error) {
      console.error("Cart load error:", error);
      setErrorMessage(error.message || "Unable to load your cart.");
      setLoading(false);
      return;
    }

    setCart((data || []) as CartItem[]);
    setLoading(false);
  }

  async function updateQuantity(id: number, quantity: number) {
    if (quantity < 1 || busyItemId !== null) return;

    setBusyItemId(id);

    try {
      const { error } = await supabase
        .from("cart")
        .update({ quantity })
        .eq("id", id);

      if (error) throw error;

      setCart((items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                quantity,
              }
            : item
        )
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to update quantity."
      );
    } finally {
      setBusyItemId(null);
    }
  }

  async function removeItem(id: number) {
    if (busyItemId !== null) return;

    const confirmed = window.confirm(
      "Remove this item from your cart?"
    );

    if (!confirmed) return;

    setBusyItemId(id);

    try {
      const { error } = await supabase
        .from("cart")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setCart((items) =>
        items.filter((item) => item.id !== id)
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to remove this item."
      );
    } finally {
      setBusyItemId(null);
    }
  }

  const cartSummary = useMemo(() => {
    const itemCount = cart.reduce(
      (sum, item) => sum + safeNumber(item.quantity),
      0
    );

    const subtotal = cart.reduce(
      (sum, item) =>
        sum +
        safeNumber(item.price) *
          safeNumber(item.quantity),
      0
    );

    return {
      itemCount,
      subtotal,
    };
  }, [cart]);

  if (loading) {
    return (
      <main className="statePage">
        <div className="loader" />
        <span>NEW CITY STYLE</span>
        <h2>Preparing Your Cart</h2>
        <p>Loading your selected products…</p>

        <style jsx>{`
          .statePage {
            min-height: 72vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px;
            background:
              radial-gradient(
                circle at 82% 12%,
                rgba(212, 175, 55, 0.12),
                transparent 25%
              ),
              #f7f9fc;
            color: #0a2e73;
            text-align: center;
          }

          .loader {
            width: 48px;
            height: 48px;
            margin-bottom: 18px;
            border: 4px solid #e6eaf0;
            border-top-color: #d4af37;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          .statePage > span {
            color: #b18b15;
            font-size: 9px;
            font-weight: 950;
            letter-spacing: 1.6px;
          }

          .statePage h2 {
            margin: 8px 0 0;
            font-size: 28px;
          }

          .statePage p {
            margin: 8px 0 0;
            color: #667085;
            font-size: 12px;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="cartPage">
      <div className="ambientGrid" />
      <div className="ambientGlow glowOne" />
      <div className="ambientGlow glowTwo" />

      <div className="pageShell">
        <section className="cartHero">
          <div>
            <span className="eyebrow">
              NEW CITY STYLE • SHOPPING BAG
            </span>

            <h1>Your Cart</h1>

            <p>
              Review your selected styles, sizes and quantities
              before checkout.
            </p>
          </div>

          <div className="heroStats">
            <div>
              <span>{cartSummary.itemCount}</span>
              <small>Items</small>
            </div>

            <div>
              <span>{cart.length}</span>
              <small>Products</small>
            </div>

            <div>
              <span>
                {formatCurrency(cartSummary.subtotal)}
              </span>
              <small>Subtotal</small>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="alert">
            <strong>!</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        {cart.length === 0 ? (
          <section className="emptyState">
            <div className="emptyIcon">⌑</div>

            <span>YOUR BAG IS EMPTY</span>

            <h2>Find Your Next Style</h2>

            <p>
              Browse NEW CITY STYLE products and add your
              favourites to continue.
            </p>

            <button
              type="button"
              onClick={() => router.push("/search")}
            >
              Continue Shopping →
            </button>
          </section>
        ) : (
          <>
            <section className="commerceRail">
              <div>
                <span>◉</span>
                <p>
                  <strong>Live Cart</strong>
                  <small>
                    Your latest selected products
                  </small>
                </p>
              </div>

              <div>
                <span>▣</span>
                <p>
                  <strong>Secure Checkout</strong>
                  <small>
                    Continue to supported payment options
                  </small>
                </p>
              </div>

              <div>
                <span>✦</span>
                <p>
                  <strong>Review Before Pay</strong>
                  <small>
                    Check size, colour and quantity
                  </small>
                </p>
              </div>
            </section>

            <section className="cartLayout">
              <div className="itemsColumn">
                <div className="sectionHeading">
                  <div>
                    <span>YOUR SELECTION</span>
                    <h2>Shopping Bag</h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push("/search")}
                  >
                    + Add More
                  </button>
                </div>

                <div className="cartList">
                  {cart.map((item, index) => {
                    const quantity = Math.max(
                      1,
                      safeNumber(item.quantity)
                    );

                    const price = safeNumber(item.price);
                    const lineTotal = price * quantity;
                    const hasDesign =
                      Number(item.design_unit_id || 0) > 0;
                    const isBusy =
                      busyItemId === item.id;

                    return (
                      <article
                        className="cartCard"
                        key={item.id}
                      >
                        <div className="cardIndex">
                          {String(index + 1).padStart(2, "0")}
                        </div>

                        <button
                          type="button"
                          className="imageButton"
                          onClick={() =>
                            item.product_id
                              ? router.push(
                                  `/product/${item.product_id}${
                                    hasDesign
                                      ? `?design=${item.design_unit_id}`
                                      : ""
                                  }`
                                )
                              : undefined
                          }
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={
                                item.name ||
                                "NEW CITY STYLE product"
                              }
                            />
                          ) : (
                            <div className="imageFallback">
                              <span>NCS</span>
                              <small>NEW CITY STYLE</small>
                            </div>
                          )}

                          {hasDesign && (
                            <span className="designBadge">
                              DESIGN
                            </span>
                          )}
                        </button>

                        <div className="itemInfo">
                          <div className="itemTopline">
                            <span>
                              {hasDesign
                                ? "SELECTED DESIGN"
                                : "NEW CITY STYLE"}
                            </span>

                            <button
                              type="button"
                              className="removeMini"
                              onClick={() =>
                                removeItem(item.id)
                              }
                              disabled={isBusy}
                              aria-label={`Remove ${
                                item.name || "item"
                              }`}
                            >
                              ×
                            </button>
                          </div>

                          <h3>
                            {item.name || "Product"}
                          </h3>

                          <div className="selectionMeta">
                            {item.size && (
                              <span>
                                <b>Size</b>
                                {item.size}
                              </span>
                            )}

                            {item.color && (
                              <span>
                                <b>Colour</b>
                                {item.color}
                              </span>
                            )}

                            {hasDesign && (
                              <span>
                                <b>Design</b>
                                Selected
                              </span>
                            )}
                          </div>

                          <div className="priceLine">
                            <strong>
                              {formatCurrency(price)}
                            </strong>

                            <small>each</small>
                          </div>

                          <div className="cardBottom">
                            <div className="quantityBox">
                              <span>Quantity</span>

                              <div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuantity(
                                      item.id,
                                      quantity - 1
                                    )
                                  }
                                  disabled={
                                    isBusy || quantity <= 1
                                  }
                                >
                                  −
                                </button>

                                <strong>{quantity}</strong>

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuantity(
                                      item.id,
                                      quantity + 1
                                    )
                                  }
                                  disabled={isBusy}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <div className="lineTotal">
                              <span>Item Total</span>
                              <strong>
                                {formatCurrency(lineTotal)}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <aside className="summaryCard">
                <div className="summaryHeader">
                  <span>ORDER SUMMARY</span>
                  <h2>Cart Total</h2>
                </div>

                <div className="summaryRows">
                  <div>
                    <span>
                      Items ({cartSummary.itemCount})
                    </span>
                    <strong>
                      {formatCurrency(
                        cartSummary.subtotal
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Delivery</span>
                    <strong>At checkout</strong>
                  </div>

                  <div>
                    <span>Discounts / Coupons</span>
                    <strong>At checkout</strong>
                  </div>
                </div>

                <div className="summaryTotal">
                  <div>
                    <span>Subtotal</span>
                    <strong>
                      {formatCurrency(
                        cartSummary.subtotal
                      )}
                    </strong>
                  </div>

                  <small>
                    Final payable amount can change after
                    eligible delivery charges, coupons or
                    checkout adjustments.
                  </small>
                </div>

                <button
                  type="button"
                  className="checkoutButton"
                  onClick={() =>
                    router.push("/checkout")
                  }
                >
                  Proceed to Checkout
                  <span>→</span>
                </button>

                <button
                  type="button"
                  className="continueButton"
                  onClick={() => router.push("/search")}
                >
                  Continue Shopping
                </button>

                <div className="trustList">
                  <div>
                    <span>🔒</span>
                    <p>
                      <strong>Secure Checkout</strong>
                      <small>
                        Supported payment methods shown next
                      </small>
                    </p>
                  </div>

                  <div>
                    <span>☏</span>
                    <p>
                      <strong>Need Help?</strong>
                      <small>
                        NEW CITY STYLE shopping support
                      </small>
                    </p>
                  </div>

                  <div>
                    <span>✓</span>
                    <p>
                      <strong>Review First</strong>
                      <small>
                        Confirm product, size and quantity
                      </small>
                    </p>
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}
      </div>

      {cart.length > 0 && (
        <div className="mobileCheckoutBar">
          <div>
            <span>
              {cartSummary.itemCount} item
              {cartSummary.itemCount === 1 ? "" : "s"}
            </span>

            <strong>
              {formatCurrency(cartSummary.subtotal)}
            </strong>
          </div>

          <button
            type="button"
            onClick={() => router.push("/checkout")}
          >
            Checkout →
          </button>
        </div>
      )}

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          background: #f7f9fc;
          color: #172033;
          font-family:
            Inter, Poppins, Arial, sans-serif;
        }

        button {
          font: inherit;
        }

        .cartPage {
          position: relative;
          overflow: hidden;
          min-height: 100vh;
          padding: 38px 20px 90px;
          background:
            radial-gradient(
              circle at 92% 5%,
              rgba(212, 175, 55, 0.11),
              transparent 24%
            ),
            radial-gradient(
              circle at 3% 88%,
              rgba(10, 46, 115, 0.07),
              transparent 24%
            ),
            #f7f9fc;
        }

        .pageShell {
          position: relative;
          z-index: 3;
          width: min(1460px, 100%);
          margin: 0 auto;
        }

        .ambientGrid {
          position: absolute;
          inset: 0;
          opacity: 0.035;
          pointer-events: none;
          background-image:
            linear-gradient(
              rgba(10, 46, 115, 0.18) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(10, 46, 115, 0.18) 1px,
              transparent 1px
            );
          background-size: 66px 66px;
          mask-image:
            linear-gradient(
              180deg,
              rgba(0, 0, 0, 0.8),
              transparent 88%
            );
        }

        .ambientGlow {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
        }

        .glowOne {
          top: -100px;
          right: -120px;
          width: 360px;
          height: 360px;
          background:
            rgba(212, 175, 55, 0.09);
        }

        .glowTwo {
          left: -150px;
          bottom: 0;
          width: 390px;
          height: 390px;
          background:
            rgba(10, 46, 115, 0.06);
        }

        .cartHero {
          display: grid;
          grid-template-columns:
            minmax(0, 1.35fr)
            minmax(350px, 0.65fr);
          gap: 24px;
          padding: 30px;
          border: 1px solid
            rgba(212, 175, 55, 0.23);
          border-radius: 24px;
          background:
            radial-gradient(
              circle at 88% 18%,
              rgba(212, 175, 55, 0.18),
              transparent 28%
            ),
            linear-gradient(
              135deg,
              #071a3f,
              #0a2e73 60%,
              #164b9d
            );
          color: white;
          box-shadow:
            0 24px 60px
            rgba(10, 46, 115, 0.15);
        }

        .eyebrow {
          color: #e7cb68;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1.7px;
        }

        .cartHero h1 {
          margin: 8px 0 0;
          font-size: clamp(40px, 5vw, 66px);
          line-height: 1;
          letter-spacing: -2px;
        }

        .cartHero p {
          max-width: 650px;
          margin: 14px 0 0;
          color:
            rgba(255, 255, 255, 0.64);
          font-size: 12px;
          line-height: 1.7;
        }

        .heroStats {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 8px;
          padding: 15px;
          border: 1px solid
            rgba(255, 255, 255, 0.12);
          border-radius: 17px;
          background:
            rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(10px);
        }

        .heroStats > div {
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 11px 7px;
          border-radius: 11px;
          background:
            rgba(255, 255, 255, 0.05);
          text-align: center;
        }

        .heroStats span {
          max-width: 100%;
          overflow: hidden;
          color: #e7cb68;
          font-size: 20px;
          font-weight: 950;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .heroStats small {
          margin-top: 3px;
          color:
            rgba(255, 255, 255, 0.45);
          font-size: 7px;
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }

        .commerceRail {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .commerceRail > div {
          min-height: 62px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border: 1px solid
            rgba(10, 46, 115, 0.08);
          border-radius: 14px;
          background:
            rgba(255, 255, 255, 0.84);
        }

        .commerceRail > div > span {
          width: 31px;
          height: 31px;
          display: grid;
          place-items: center;
          flex: 0 0 31px;
          border-radius: 9px;
          background: #f8f3df;
          color: #0a2e73;
          font-size: 12px;
          font-weight: 950;
        }

        .commerceRail p {
          margin: 0;
        }

        .commerceRail strong,
        .commerceRail small {
          display: block;
        }

        .commerceRail strong {
          color: #0a2e73;
          font-size: 9px;
        }

        .commerceRail small {
          margin-top: 3px;
          color: #667085;
          font-size: 8px;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
          padding: 13px 15px;
          border: 1px solid #fecdca;
          border-radius: 12px;
          background: #fef3f2;
          color: #b42318;
          font-size: 11px;
          font-weight: 700;
        }

        .cartLayout {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(320px, 380px);
          gap: 22px;
          align-items: start;
          margin-top: 20px;
        }

        .itemsColumn {
          min-width: 0;
        }

        .sectionHeading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 12px;
        }

        .sectionHeading span {
          color: #b18b15;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1.2px;
        }

        .sectionHeading h2 {
          margin: 4px 0 0;
          color: #0a2e73;
          font-size: 27px;
        }

        .sectionHeading button {
          min-height: 37px;
          padding: 0 12px;
          border: 1px solid #d4af37;
          border-radius: 9px;
          background: #fffaf0;
          color: #0a2e73;
          font-size: 8px;
          font-weight: 900;
          cursor: pointer;
        }

        .cartList {
          display: grid;
          gap: 12px;
        }

        .cartCard {
          position: relative;
          display: grid;
          grid-template-columns:
            164px minmax(0, 1fr);
          gap: 17px;
          padding: 14px;
          border: 1px solid
            rgba(10, 46, 115, 0.08);
          border-radius: 18px;
          background: #fff;
          box-shadow:
            0 10px 26px
            rgba(16, 24, 40, 0.055);
        }

        .cardIndex {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 3;
          min-width: 29px;
          padding: 5px 6px;
          border: 1px solid
            rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background:
            rgba(3, 22, 54, 0.6);
          color: #fff;
          font-size: 7px;
          font-weight: 900;
          text-align: center;
          backdrop-filter: blur(7px);
        }

        .imageButton {
          position: relative;
          overflow: hidden;
          width: 100%;
          aspect-ratio: 4 / 5;
          padding: 0;
          border: 0;
          border-radius: 13px;
          background: #eef2f7;
          cursor: pointer;
        }

        .imageButton img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .imageFallback {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          align-content: center;
          background:
            linear-gradient(
              135deg,
              #0a2e73,
              #164b9d
            );
          color: #d4af37;
        }

        .imageFallback span {
          font-size: 23px;
          font-weight: 950;
        }

        .imageFallback small {
          margin-top: 5px;
          font-size: 7px;
          letter-spacing: 1px;
        }

        .designBadge {
          position: absolute;
          right: 8px;
          bottom: 8px;
          padding: 5px 7px;
          border-radius: 999px;
          background:
            rgba(3, 22, 54, 0.78);
          color: #fff;
          font-size: 6px;
          font-weight: 950;
          letter-spacing: 0.8px;
        }

        .itemInfo {
          min-width: 0;
          padding: 3px 3px 2px 0;
        }

        .itemTopline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .itemTopline > span {
          color: #b18b15;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .removeMini {
          width: 31px;
          height: 31px;
          display: grid;
          place-items: center;
          border: 1px solid #fecdca;
          border-radius: 9px;
          background: #fff5f4;
          color: #b42318;
          font-size: 18px;
          cursor: pointer;
        }

        .removeMini:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .itemInfo h3 {
          margin: 6px 0 0;
          color: #0a2e73;
          font-size: 21px;
          line-height: 1.25;
        }

        .selectionMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
        }

        .selectionMeta span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 28px;
          padding: 0 8px;
          border: 1px solid
            rgba(10, 46, 115, 0.09);
          border-radius: 8px;
          background: #f8fafc;
          color: #344054;
          font-size: 8px;
        }

        .selectionMeta b {
          color: #667085;
          font-size: 7px;
        }

        .priceLine {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-top: 13px;
        }

        .priceLine strong {
          color: #b18b15;
          font-size: 22px;
          font-weight: 950;
        }

        .priceLine small {
          color: #98a2b3;
          font-size: 8px;
        }

        .cardBottom {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          margin-top: 19px;
          padding-top: 14px;
          border-top: 1px solid #eaecf0;
        }

        .quantityBox > span,
        .lineTotal > span {
          display: block;
          margin-bottom: 6px;
          color: #667085;
          font-size: 7px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .quantityBox > div {
          display: inline-grid;
          grid-template-columns:
            35px 38px 35px;
          align-items: center;
          overflow: hidden;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: #fff;
        }

        .quantityBox button {
          height: 35px;
          border: 0;
          background: #f8fafc;
          color: #0a2e73;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
        }

        .quantityBox button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .quantityBox strong {
          text-align: center;
          color: #172033;
          font-size: 11px;
        }

        .lineTotal {
          text-align: right;
        }

        .lineTotal strong {
          color: #0a2e73;
          font-size: 20px;
          font-weight: 950;
        }

        .summaryCard {
          position: sticky;
          top: 96px;
          padding: 20px;
          border: 1px solid
            rgba(212, 175, 55, 0.22);
          border-radius: 19px;
          background:
            linear-gradient(
              180deg,
              #fff,
              #fbfcfe
            );
          box-shadow:
            0 16px 40px
            rgba(16, 24, 40, 0.07);
        }

        .summaryHeader > span {
          color: #b18b15;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1.2px;
        }

        .summaryHeader h2 {
          margin: 4px 0 0;
          color: #0a2e73;
          font-size: 26px;
        }

        .summaryRows {
          display: grid;
          gap: 0;
          margin-top: 18px;
          border-top: 1px solid #eaecf0;
        }

        .summaryRows > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #eaecf0;
        }

        .summaryRows span {
          color: #667085;
          font-size: 9px;
        }

        .summaryRows strong {
          color: #344054;
          font-size: 9px;
        }

        .summaryTotal {
          margin-top: 16px;
          padding: 14px;
          border-radius: 12px;
          background:
            linear-gradient(
              135deg,
              #071a3f,
              #0a2e73
            );
          color: white;
        }

        .summaryTotal > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .summaryTotal span {
          color:
            rgba(255, 255, 255, 0.62);
          font-size: 9px;
        }

        .summaryTotal strong {
          color: #e7cb68;
          font-size: 25px;
        }

        .summaryTotal small {
          display: block;
          margin-top: 8px;
          color:
            rgba(255, 255, 255, 0.43);
          font-size: 7px;
          line-height: 1.5;
        }

        .checkoutButton,
        .continueButton {
          width: 100%;
          min-height: 47px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border-radius: 11px;
          font-size: 9px;
          font-weight: 950;
          cursor: pointer;
        }

        .checkoutButton {
          margin-top: 14px;
          border: 1px solid #d4af37;
          background:
            linear-gradient(
              135deg,
              #0a2e73,
              #164b9d
            );
          color: white;
        }

        .checkoutButton span {
          color: #d4af37;
          font-size: 15px;
        }

        .continueButton {
          margin-top: 8px;
          border: 1px solid #d0d5dd;
          background: #fff;
          color: #0a2e73;
        }

        .trustList {
          display: grid;
          gap: 10px;
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid #eaecf0;
        }

        .trustList > div {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .trustList > div > span {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          flex: 0 0 30px;
          border-radius: 8px;
          background: #f8f3df;
          font-size: 10px;
        }

        .trustList p {
          margin: 0;
        }

        .trustList strong,
        .trustList small {
          display: block;
        }

        .trustList strong {
          color: #0a2e73;
          font-size: 8px;
        }

        .trustList small {
          margin-top: 2px;
          color: #667085;
          font-size: 7px;
        }

        .emptyState {
          min-height: 470px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-top: 20px;
          padding: 38px;
          border: 1px solid
            rgba(10, 46, 115, 0.08);
          border-radius: 22px;
          background: #fff;
          text-align: center;
          box-shadow:
            0 14px 36px
            rgba(16, 24, 40, 0.05);
        }

        .emptyIcon {
          width: 64px;
          height: 64px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          background: #f8f3df;
          color: #0a2e73;
          font-size: 28px;
        }

        .emptyState > span {
          margin-top: 16px;
          color: #b18b15;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1.2px;
        }

        .emptyState h2 {
          margin: 7px 0 0;
          color: #0a2e73;
          font-size: 30px;
        }

        .emptyState p {
          max-width: 500px;
          margin: 9px 0 0;
          color: #667085;
          font-size: 11px;
          line-height: 1.6;
        }

        .emptyState button {
          min-height: 43px;
          margin-top: 19px;
          padding: 0 15px;
          border: 1px solid #d4af37;
          border-radius: 10px;
          background: #0a2e73;
          color: #fff;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .mobileCheckoutBar {
          display: none;
        }

        @media (max-width: 1050px) {
          .cartHero {
            grid-template-columns: 1fr;
          }

          .heroStats {
            max-width: 560px;
          }

          .cartLayout {
            grid-template-columns: 1fr;
          }

          .summaryCard {
            position: static;
          }
        }

        @media (max-width: 760px) {
          .cartPage {
            padding:
              18px 9px
              calc(100px + env(safe-area-inset-bottom));
          }

          .cartHero {
            padding: 20px;
            border-radius: 19px;
          }

          .cartHero h1 {
            font-size: 40px;
          }

          .cartHero p {
            font-size: 11px;
          }

          .heroStats {
            padding: 11px;
          }

          .heroStats span {
            font-size: 17px;
          }

          .commerceRail {
            display: flex;
            overflow-x: auto;
            gap: 8px;
            margin-right: -9px;
            padding-right: 9px;
            scrollbar-width: none;
          }

          .commerceRail::-webkit-scrollbar {
            display: none;
          }

          .commerceRail > div {
            min-width: 230px;
            flex: 0 0 230px;
          }

          .sectionHeading h2 {
            font-size: 23px;
          }

          .cartCard {
            grid-template-columns:
              115px minmax(0, 1fr);
            gap: 11px;
            padding: 10px;
            border-radius: 14px;
          }

          .cardIndex {
            display: none;
          }

          .itemInfo h3 {
            font-size: 15px;
          }

          .selectionMeta {
            gap: 5px;
            margin-top: 8px;
          }

          .selectionMeta span {
            min-height: 24px;
            padding: 0 6px;
            font-size: 7px;
          }

          .priceLine {
            margin-top: 9px;
          }

          .priceLine strong {
            font-size: 17px;
          }

          .cardBottom {
            align-items: flex-start;
            flex-direction: column;
            gap: 12px;
            margin-top: 12px;
            padding-top: 11px;
          }

          .lineTotal {
            text-align: left;
          }

          .lineTotal strong {
            font-size: 16px;
          }

          .summaryCard {
            margin-bottom: 10px;
          }

          .mobileCheckoutBar {
            position: fixed;
            right: 0;
            bottom: 0;
            left: 0;
            z-index: 5000;
            display: grid;
            grid-template-columns:
              minmax(110px, 1fr)
              minmax(145px, 1fr);
            align-items: center;
            gap: 9px;
            padding:
              9px 10px
              calc(9px + env(safe-area-inset-bottom));
            border-top: 1px solid
              rgba(10, 46, 115, 0.09);
            background:
              rgba(255, 255, 255, 0.96);
            box-shadow:
              0 -12px 30px
              rgba(16, 24, 40, 0.12);
            backdrop-filter: blur(14px);
          }

          .mobileCheckoutBar span,
          .mobileCheckoutBar strong {
            display: block;
          }

          .mobileCheckoutBar span {
            color: #667085;
            font-size: 7px;
          }

          .mobileCheckoutBar strong {
            margin-top: 2px;
            color: #b18b15;
            font-size: 16px;
          }

          .mobileCheckoutBar button {
            min-height: 44px;
            border: 1px solid #d4af37;
            border-radius: 10px;
            background: #0a2e73;
            color: #fff;
            font-size: 9px;
            font-weight: 950;
            cursor: pointer;
          }
        }

        @media (max-width: 430px) {
          .cartCard {
            grid-template-columns:
              100px minmax(0, 1fr);
          }

          .itemInfo h3 {
            font-size: 14px;
          }

          .quantityBox > div {
            grid-template-columns:
              32px 34px 32px;
          }

          .summaryTotal strong {
            font-size: 22px;
          }
        }
      `}</style>
    </main>
  );
}
