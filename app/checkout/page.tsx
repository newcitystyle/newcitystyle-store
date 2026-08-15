"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CartItem = {
  id: number | string;
  product_id: number | string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  size?: string | null;
  design_unit_id?: number | null;
  variant_id?: number | null;
  barcode?: string | null;
};

type CheckoutDetails = {
  fullName: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

type ShippingSettings = {
  free_shipping: boolean | null;
  free_shipping_min: number | string | null;
  flat_rate: number | string | null;
  estimated_days: string | null;
};

const initialDetails: CheckoutDetails = {
  fullName: "",
  mobile: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

const defaultShippingSettings: ShippingSettings = {
  free_shipping: true,
  free_shipping_min: 999,
  flat_rate: 79,
  estimated_days: "3-7 business days",
};

export default function CheckoutPage() {
  const router = useRouter();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [details, setDetails] =
    useState<CheckoutDetails>(initialDetails);
  const [shippingSettings, setShippingSettings] =
    useState<ShippingSettings>(defaultShippingSettings);

  const [loading, setLoading] = useState(true);
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    loadCheckoutData();
  }, []);

  async function loadCheckoutData() {
    setLoading(true);

    try {
      const savedCheckout = localStorage.getItem(
        "new-city-style-checkout"
      );

      if (savedCheckout) {
        try {
          const parsed = JSON.parse(
            savedCheckout
          ) as Partial<CheckoutDetails>;

          setDetails((current) => ({
            ...current,
            ...parsed,
          }));
        } catch (error) {
          console.error(
            "Saved checkout details could not be read:",
            error
          );
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let cartQuery = supabase
        .from("cart")
        .select(
          "id,product_id,name,image,price,quantity,size,design_unit_id,variant_id,barcode"
        )
        .order("id", { ascending: false });

      if (user) {
        cartQuery = cartQuery.eq("user_id", user.id);
      }

      const [
        { data: cartData, error: cartError },
        { data: shippingData, error: shippingError },
      ] = await Promise.all([
        cartQuery,
        supabase
          .from("shipping_settings")
          .select(
            "free_shipping,free_shipping_min,flat_rate,estimated_days"
          )
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cartError) throw cartError;

      setCartItems((cartData as CartItem[]) || []);

      if (shippingError) {
        console.error(
          "Shipping settings load error:",
          shippingError
        );
      } else if (shippingData) {
        setShippingSettings({
          free_shipping:
            shippingData.free_shipping ??
            defaultShippingSettings.free_shipping,
          free_shipping_min:
            shippingData.free_shipping_min ??
            defaultShippingSettings.free_shipping_min,
          flat_rate:
            shippingData.flat_rate ??
            defaultShippingSettings.flat_rate,
          estimated_days:
            shippingData.estimated_days ||
            defaultShippingSettings.estimated_days,
        });
      }

      if (user) {
        setDetails((current) => ({
          ...current,
          email: current.email || user.email || "",
        }));
      }
    } catch (error) {
      console.error("Checkout load error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Unable to load checkout information."
      );
    } finally {
      setLoading(false);
    }
  }

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) =>
          sum +
          Number(item.price || 0) *
            Number(item.quantity || 0),
        0
      ),
    [cartItems]
  );

  const flatRate = Math.max(
    0,
    Number(
      shippingSettings.flat_rate ??
        defaultShippingSettings.flat_rate
    ) || 0
  );

  const freeShippingMinimum = Math.max(
    0,
    Number(
      shippingSettings.free_shipping_min ??
        defaultShippingSettings.free_shipping_min
    ) || 0
  );

  const shipping =
    shippingSettings.free_shipping &&
    subtotal >= freeShippingMinimum
      ? 0
      : flatRate;

  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + shipping + tax;

  function updateField(
    field: keyof CheckoutDetails,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const value = event.target.value;

    setDetails((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function validateCheckout() {
    if (!details.fullName.trim()) {
      alert("Please enter your full name.");
      return false;
    }

    if (!/^[6-9]\d{9}$/.test(details.mobile.trim())) {
      alert("Please enter a valid 10-digit mobile number.");
      return false;
    }

    if (
      details.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        details.email.trim()
      )
    ) {
      alert("Please enter a valid email address.");
      return false;
    }

    if (!details.address.trim()) {
      alert("Please enter your complete delivery address.");
      return false;
    }

    if (!details.city.trim()) {
      alert("Please enter your city or village.");
      return false;
    }

    if (!details.state.trim()) {
      alert("Please enter your state.");
      return false;
    }

    if (!/^\d{6}$/.test(details.pincode.trim())) {
      alert("Please enter a valid 6-digit pincode.");
      return false;
    }

    if (cartItems.length === 0) {
      alert("Your cart is empty.");
      return false;
    }

    return true;
  }

  function continueToPayment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!validateCheckout() || continuing) return;

    setContinuing(true);

    const cleanDetails: CheckoutDetails = {
      fullName: details.fullName.trim(),
      mobile: details.mobile.trim(),
      email: details.email.trim(),
      address: details.address.trim(),
      city: details.city.trim(),
      state: details.state.trim(),
      pincode: details.pincode.trim(),
    };

    const cleanItems = cartItems.map((item) => ({
      ...item,
      size: item.size || null,
      design_unit_id:
        Number(item.design_unit_id || 0) > 0
          ? Number(item.design_unit_id)
          : null,
      variant_id:
        Number(item.variant_id || 0) > 0
          ? Number(item.variant_id)
          : null,
      barcode: item.barcode || null,
    }));

    localStorage.setItem(
      "new-city-style-checkout",
      JSON.stringify(cleanDetails)
    );

    localStorage.setItem(
      "new-city-style-order-summary",
      JSON.stringify({
        subtotal,
        shipping,
        tax,
        total,
        items: cleanItems,
      })
    );

    router.push("/payment");
  }

  if (loading) {
    return (
      <main className="loadingPage">
        <div className="loader" />
        <h2>Loading Checkout...</h2>

        <style jsx>{`
          .loadingPage {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #f8f4ec;
            color: #0a2e73;
          }

          .loader {
            width: 52px;
            height: 52px;
            margin-bottom: 16px;
            border: 5px solid #e5e7eb;
            border-top-color: #0a2e73;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
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
    <main className="page">
      <div className="container">
        <section className="hero">
          <p>NEW CITY STYLE</p>
          <h1>Secure Checkout</h1>
          <span>
            Enter your delivery details and continue to payment.
          </span>
        </section>

        <div className="layout">
          <form
            className="addressCard"
            onSubmit={continueToPayment}
          >
            <h2>Shipping Address</h2>

            <Field label="Full Name" required>
              <input
                value={details.fullName}
                onChange={(event) =>
                  updateField("fullName", event)
                }
                placeholder="Enter your full name"
              />
            </Field>

            <div className="formGrid">
              <Field label="Mobile Number" required>
                <input
                  inputMode="numeric"
                  maxLength={10}
                  value={details.mobile}
                  onChange={(event) =>
                    updateField("mobile", event)
                  }
                  placeholder="10-digit mobile number"
                />
              </Field>

              <Field label="Email Address">
                <input
                  type="email"
                  value={details.email}
                  onChange={(event) =>
                    updateField("email", event)
                  }
                  placeholder="Enter your email"
                />
              </Field>
            </div>

            <Field label="Complete Delivery Address" required>
              <textarea
                value={details.address}
                onChange={(event) =>
                  updateField("address", event)
                }
                placeholder="House number, street, area and landmark"
              />
            </Field>

            <div className="formGrid">
              <Field label="City / Village" required>
                <input
                  value={details.city}
                  onChange={(event) =>
                    updateField("city", event)
                  }
                  placeholder="Enter city or village"
                />
              </Field>

              <Field label="State" required>
                <input
                  value={details.state}
                  onChange={(event) =>
                    updateField("state", event)
                  }
                  placeholder="Enter state"
                />
              </Field>
            </div>

            <Field label="Pincode" required>
              <input
                inputMode="numeric"
                maxLength={6}
                value={details.pincode}
                onChange={(event) =>
                  updateField("pincode", event)
                }
                placeholder="6-digit pincode"
              />
            </Field>

            <button
              type="submit"
              className="continueButton"
              disabled={
                continuing || cartItems.length === 0
              }
            >
              {continuing
                ? "Opening Payment..."
                : "Continue to Payment"}
            </button>
          </form>

          <section className="summaryCard">
            <h2>Order Summary</h2>

            {cartItems.length === 0 ? (
              <div className="emptyCart">
                <span>🛍️</span>
                <strong>Your cart is empty.</strong>
                <button
                  type="button"
                  onClick={() => router.push("/")}
                >
                  Continue Shopping
                </button>
              </div>
            ) : (
              cartItems.map((item) => (
                <article
                  className="orderItem"
                  key={item.id}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                  />

                  <div>
                    <h3>{item.name}</h3>
                    <p>Quantity: {item.quantity}</p>
                    {item.size && (
                      <p>Size: {item.size}</p>
                    )}
                    {item.barcode && (
                      <p className="trackingMeta">
                        Item Ref: {item.barcode}
                      </p>
                    )}
                    <strong>
                      ₹
                      {(
                        Number(item.price) *
                        Number(item.quantity)
                      ).toLocaleString("en-IN")}
                    </strong>
                  </div>
                </article>
              ))
            )}

            <div className="summaryRows">
              <SummaryRow
                title="Subtotal"
                value={`₹${subtotal.toLocaleString(
                  "en-IN"
                )}`}
              />

              <SummaryRow
                title="Shipping"
                value={
                  shipping === 0
                    ? "FREE"
                    : `₹${shipping.toLocaleString(
                        "en-IN"
                      )}`
                }
              />

              <SummaryRow
                title="Tax (5%)"
                value={`₹${tax.toLocaleString("en-IN")}`}
              />
            </div>

            {shippingSettings.free_shipping &&
              subtotal < freeShippingMinimum && (
                <div className="freeShippingNotice">
                  Add ₹
                  {Math.max(
                    freeShippingMinimum - subtotal,
                    0
                  ).toLocaleString("en-IN")}{" "}
                  more to get free shipping.
                </div>
              )}

            {shippingSettings.estimated_days && (
              <div className="deliveryEstimate">
                🚚 Estimated delivery:{" "}
                <strong>
                  {shippingSettings.estimated_days}
                </strong>
              </div>
            )}

            <div className="totalRow">
              <span>Total</span>
              <strong>
                ₹{total.toLocaleString("en-IN")}
              </strong>
            </div>

            <p className="protectedText">
              🔒 Your checkout information is protected.
            </p>
          </section>
        </div>
      </div>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          background: #f8f4ec;
          color: #172033;
          font-family: Inter, Poppins, Arial, sans-serif;
        }

        button,
        input,
        textarea {
          font: inherit;
        }

        .page {
          min-height: 100vh;
          padding: 35px 20px 70px;
          background:
            radial-gradient(
              circle at top right,
              rgba(212, 175, 55, 0.11),
              transparent 28%
            ),
            #f8f4ec;
        }

        .container {
          width: 100%;
          max-width: 1300px;
          margin: 0 auto;
        }

        .hero {
          margin-bottom: 28px;
          padding: 30px;
          border-radius: 22px;
          background: linear-gradient(
            135deg,
            #071a43,
            #0a2e73 55%,
            #164ca8
          );
          color: white;
          box-shadow: 0 14px 38px
            rgba(10, 46, 115, 0.25);
        }

        .hero p {
          margin: 0 0 8px;
          color: #d4af37;
          font-weight: 900;
          letter-spacing: 1.3px;
        }

        .hero h1 {
          margin: 0;
          font-size: 42px;
        }

        .hero span {
          display: block;
          margin-top: 10px;
          opacity: 0.9;
        }

        .layout {
          display: grid;
          grid-template-columns:
            minmax(0, 1.15fr)
            minmax(360px, 0.85fr);
          gap: 28px;
          align-items: start;
        }

        .addressCard,
        .summaryCard {
          padding: 28px;
          border: 1px solid
            rgba(10, 46, 115, 0.08);
          border-radius: 20px;
          background: white;
          box-shadow: 0 10px 30px
            rgba(0, 0, 0, 0.07);
        }

        .addressCard h2,
        .summaryCard h2 {
          margin: 0 0 24px;
          color: #0a2e73;
          font-size: 28px;
        }

        .formGrid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        :global(.checkoutField) {
          margin-bottom: 18px;
        }

        :global(.checkoutField label) {
          display: block;
          margin-bottom: 8px;
          color: #0a2e73;
          font-weight: 800;
        }

        :global(.checkoutField input),
        :global(.checkoutField textarea) {
          width: 100%;
          padding: 13px 14px;
          border: 1px solid #d1d5db;
          border-radius: 11px;
          background: white;
          color: #111827;
          outline: none;
        }

        :global(.checkoutField textarea) {
          min-height: 125px;
          resize: vertical;
          line-height: 1.6;
        }

        :global(.checkoutField input:focus),
        :global(.checkoutField textarea:focus) {
          border-color: #0a2e73;
          box-shadow: 0 0 0 3px
            rgba(10, 46, 115, 0.1);
        }

        .continueButton {
          width: 100%;
          min-height: 54px;
          margin-top: 8px;
          border: 1px solid #d4af37;
          border-radius: 12px;
          background: linear-gradient(
            135deg,
            #d4af37,
            #f0cf63
          );
          color: #0a2e73;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 12px 25px
            rgba(212, 175, 55, 0.24);
        }

        .continueButton:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .summaryCard {
          position: sticky;
          top: 95px;
        }

        .orderItem {
          display: flex;
          gap: 14px;
          margin-bottom: 17px;
          padding-bottom: 17px;
          border-bottom: 1px solid #e5e7eb;
        }

        .orderItem img {
          width: 88px;
          height: 105px;
          flex-shrink: 0;
          border-radius: 11px;
          background: #f3f4f6;
          object-fit: cover;
        }

        .orderItem h3 {
          margin: 0 0 7px;
          color: #0a2e73;
          font-size: 17px;
        }

        .orderItem p {
          margin: 0 0 5px;
          color: #667085;
          font-size: 13px;
        }

        .orderItem strong {
          color: #d4af37;
          font-size: 18px;
        }

        .trackingMeta {
          opacity: 0.72;
          font-size: 11px !important;
        }

        .summaryRows {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .freeShippingNotice,
        .deliveryEstimate {
          margin-top: 16px;
          padding: 12px 14px;
          border-radius: 11px;
          font-size: 13px;
          line-height: 1.55;
        }

        .freeShippingNotice {
          border: 1px solid #fde68a;
          background: #fffbeb;
          color: #92400e;
        }

        .deliveryEstimate {
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #0a2e73;
        }

        .totalRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 22px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
        }

        .totalRow span {
          color: #0a2e73;
          font-size: 22px;
          font-weight: 850;
        }

        .totalRow strong {
          color: #d4af37;
          font-size: 30px;
        }

        .protectedText {
          margin: 16px 0 0;
          color: #667085;
          font-size: 12px;
          text-align: center;
        }

        .emptyCart {
          display: grid;
          justify-items: center;
          gap: 12px;
          padding: 32px;
          border: 1px dashed #cbd5e1;
          border-radius: 14px;
          background: #f8fafc;
          text-align: center;
        }

        .emptyCart span {
          font-size: 42px;
        }

        .emptyCart strong {
          color: #0a2e73;
        }

        .emptyCart button {
          padding: 11px 17px;
          border: 0;
          border-radius: 9px;
          background: #0a2e73;
          color: white;
          font-weight: 800;
          cursor: pointer;
        }

        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .summaryCard {
            position: static;
          }
        }

        @media (max-width: 650px) {
          .page {
            padding: 18px 10px 45px;
          }

          .hero,
          .addressCard,
          .summaryCard {
            padding: 18px;
            border-radius: 16px;
          }

          .hero h1 {
            font-size: 32px;
          }

          .formGrid {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .orderItem img {
            width: 72px;
            height: 88px;
          }
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="checkoutField">
      <label>
        {label}
        {required && (
          <span style={{ color: "#DC2626" }}> *</span>
        )}
      </label>
      {children}
    </div>
  );
}

function SummaryRow({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="summaryRow">
      <span>{title}</span>
      <strong>{value}</strong>

      <style jsx>{`
        .summaryRow {
          display: flex;
          justify-content: space-between;
          gap: 15px;
        }

        span {
          color: #555;
        }

        strong {
          color: #0a2e73;
        }
      `}</style>
    </div>
  );
}