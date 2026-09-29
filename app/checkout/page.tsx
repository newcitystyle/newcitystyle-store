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

  tax_enabled: boolean | null;

  tax_percent: number | string | null;

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

  tax_enabled: false,

  tax_percent: 5,

};



type StoredAttribution = {

  source?: string;

  medium?: string;

  campaign?: string;

  utmContent?: string;

  utmTerm?: string;

  fbclid?: string;

  landingUrl?: string;

  landingPath?: string;

  initialReferrer?: string;

};



function getAnalyticsDeviceType() {

  const userAgent = navigator.userAgent.toLowerCase();



  if (/tablet|ipad|playbook|silk/.test(userAgent)) {

    return "tablet";

  }



  if (

    /mobile|iphone|ipod|android|blackberry|opera mini|iemobile/.test(

      userAgent

    )

  ) {

    return "mobile";

  }



  return "desktop";

}



function getAnalyticsBrowserName() {

  const userAgent = navigator.userAgent;



  if (userAgent.includes("Edg/")) return "Edge";

  if (userAgent.includes("OPR/") || userAgent.includes("Opera")) return "Opera";

  if (userAgent.includes("Chrome/")) return "Chrome";

  if (userAgent.includes("Firefox/")) return "Firefox";



  if (

    userAgent.includes("Safari/") &&

    !userAgent.includes("Chrome/")

  ) {

    return "Safari";

  }



  return "Unknown";

}



function getStoredAttribution(): StoredAttribution {

  try {

    const raw = sessionStorage.getItem("ncs_visit_attribution");



    if (!raw) {

      return {};

    }



    const parsed = JSON.parse(raw) as StoredAttribution;



    return parsed && typeof parsed === "object"

      ? parsed

      : {};

  } catch {

    return {};

  }

}



async function recordCheckoutAnalytics({

  eventType,

  total,

  subtotal,

  shipping,

  tax,

  items,

}: {

  eventType: "checkout" | "checkout_continue";

  total: number;

  subtotal: number;

  shipping: number;

  tax: number;

  items: CartItem[];

}) {

  try {

    const visitorId =

      localStorage.getItem("ncs_visitor_id") || "";



    const sessionId =

      sessionStorage.getItem("ncs_session_id") || "";



    if (!visitorId || !sessionId) {

      return;

    }



    const attribution = getStoredAttribution();



    const { error } = await supabase

      .from("website_visits")

      .insert({

        visitor_id: visitorId,

        session_id: sessionId,

        page_path: window.location.pathname,

        page_title: document.title || "Checkout",

        referrer: document.referrer || "",

        device_type: getAnalyticsDeviceType(),

        browser: getAnalyticsBrowserName(),

        visited_at: new Date().toISOString(),



        source: attribution.source || "direct",

        medium: attribution.medium || "none",

        campaign: attribution.campaign || "",

        utm_content: attribution.utmContent || "",

        utm_term: attribution.utmTerm || "",

        fbclid: attribution.fbclid || "",



        event_type: eventType,

        event_value: total,



        metadata: {

          subtotal,

          shipping,

          tax,

          total,

          item_count: items.reduce(

            (sum, item) => sum + Number(item.quantity || 0),

            0

          ),

          unique_products: items.length,

          product_ids: items.map((item) => item.product_id),

          items: items.map((item) => ({

            product_id: item.product_id,

            name: item.name,

            price: Number(item.price || 0),

            quantity: Number(item.quantity || 0),

            size: item.size || null,

            design_unit_id: item.design_unit_id || null,

            variant_id: item.variant_id || null,

            barcode: item.barcode || null,

          })),

          landing_url: attribution.landingUrl || "",

          landing_path: attribution.landingPath || "",

          initial_referrer: attribution.initialReferrer || "",

        },

      });



    if (error) {

      console.error(

        `Website ${eventType} tracking error:`,

        error

      );

    }

  } catch (error) {

    console.error(

      `Unable to record ${eventType} analytics:`,

      error

    );

  }

}



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

            "free_shipping,free_shipping_min,flat_rate,estimated_days,tax_enabled,tax_percent"

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

          tax_enabled:

            shippingData.tax_enabled ??

            defaultShippingSettings.tax_enabled,

          tax_percent:

            shippingData.tax_percent ??

            defaultShippingSettings.tax_percent,

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



  const taxEnabled =

    shippingSettings.tax_enabled === true;



  const taxPercent = Math.max(

    0,

    Number(

      shippingSettings.tax_percent ??

        defaultShippingSettings.tax_percent

    ) || 0

  );



  const taxRate = taxPercent / 100;



  const tax = taxEnabled

    ? Math.round(subtotal * taxRate)

    : 0;



  const total = subtotal + shipping + tax;



  useEffect(() => {

    if (

      loading ||

      cartItems.length === 0

    ) {

      return;

    }



    const sessionId =

      sessionStorage.getItem("ncs_session_id") || "";



    if (!sessionId) {

      return;

    }



    const cartSignature = cartItems

      .map(

        (item) =>

          `${item.product_id}:${item.quantity}:${item.size || ""}:${item.design_unit_id || ""}`

      )

      .sort()

      .join("|");



    const checkoutTrackKey =

      `ncs_checkout_tracked\_${sessionId}\_${cartSignature}`;



    if (

      sessionStorage.getItem(checkoutTrackKey) === "1"

    ) {

      return;

    }



    sessionStorage.setItem(

      checkoutTrackKey,

      "1"

    );



    recordCheckoutAnalytics({

      eventType: "checkout",

      total,

      subtotal,

      shipping,

      tax,

      items: cartItems,

    }).catch((error) => {

      console.error(

        "Checkout analytics promise error:",

        error

      );

    });

  }, [

    loading,

    cartItems,

    subtotal,

    shipping,

    tax,

    total,

  ]);



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

        tax_enabled: taxEnabled,

        tax_rate: taxEnabled ? taxRate : 0,

        total,

        items: cleanItems,

      })

    );



    recordCheckoutAnalytics({

      eventType: "checkout_continue",

      total,

      subtotal,

      shipping,

      tax,

      items: cleanItems,

    }).catch((error) => {

      console.error(

        "Continue-to-payment analytics error:",

        error

      );

    });



    router.push("/payment");

  }



  if (loading) {
    return (
      <main className="loadingPage">
        <div className="loader" />
        <span>NEW CITY STYLE</span>
        <h2>Preparing Secure Checkout</h2>
        <p>Loading your cart, delivery settings and saved details…</p>

        <style jsx>{`
          .loadingPage {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px;
            background:
              radial-gradient(circle at 82% 14%, rgba(212,175,55,.12), transparent 25%),
              #f7f9fc;
            color: #0a2e73;
            text-align: center;
          }

          .loader {
            width: 50px;
            height: 50px;
            margin-bottom: 18px;
            border: 4px solid #e6eaf0;
            border-top-color: #d4af37;
            border-radius: 50%;
            animation: spin .8s linear infinite;
          }

          .loadingPage > span {
            color: #b18b15;
            font-size: 9px;
            font-weight: 950;
            letter-spacing: 1.5px;
          }

          .loadingPage h2 {
            margin: 8px 0 0;
            font-size: 28px;
          }

          .loadingPage p {
            margin: 8px 0 0;
            color: #667085;
            font-size: 12px;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="ambientGrid" />
      <div className="ambientGlow glowOne" />
      <div className="ambientGlow glowTwo" />

      <div className="container">
        <section className="hero">
          <div className="heroCopy">
            <span className="eyebrow">NEW CITY STYLE • SECURE CHECKOUT</span>

            <h1>Complete Your Order</h1>

            <p>
              Confirm your delivery details, review the final order amount and
              continue to the payment page.
            </p>

            <div className="stepRail">
              <div className="step done">
                <span>1</span>
                <p>
                  <strong>Cart</strong>
                  <small>Reviewed</small>
                </p>
              </div>

              <i />

              <div className="step active">
                <span>2</span>
                <p>
                  <strong>Delivery</strong>
                  <small>Current step</small>
                </p>
              </div>

              <i />

              <div className="step">
                <span>3</span>
                <p>
                  <strong>Payment</strong>
                  <small>Next</small>
                </p>
              </div>
            </div>
          </div>

          <div className="heroStats">
            <div>
              <span>
                {cartItems.reduce(
                  (sum, item) => sum + Number(item.quantity || 0),
                  0
                )}
              </span>
              <small>Items</small>
            </div>

            <div>
              <span>{cartItems.length}</span>
              <small>Products</small>
            </div>

            <div>
              <span>₹{total.toLocaleString("en-IN")}</span>
              <small>Current Total</small>
            </div>
          </div>
        </section>

        <section className="checkoutSignals">
          <div>
            <span>⌂</span>
            <p>
              <strong>Saved Details</strong>
              <small>Your checkout form is remembered on this device</small>
            </p>
          </div>

          <div>
            <span>▣</span>
            <p>
              <strong>Live Order Summary</strong>
              <small>Shipping and tax come from current store settings</small>
            </p>
          </div>

          <div>
            <span>→</span>
            <p>
              <strong>Payment Next</strong>
              <small>Payment options are shown on the next page</small>
            </p>
          </div>
        </section>

        <div className="layout">
          <form
            id="ncs-checkout-form"
            className="addressCard"
            onSubmit={continueToPayment}
          >
            <div className="cardHeading">
              <div>
                <span>DELIVERY DETAILS</span>
                <h2>Shipping Address</h2>
              </div>

              <small>Fields marked * are required</small>
            </div>

            <div className="contactBlock">
              <span className="blockLabel">CONTACT</span>

              <Field label="Full Name" required>
                <input
                  autoComplete="name"
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
                    autoComplete="tel"
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
                    autoComplete="email"
                    value={details.email}
                    onChange={(event) =>
                      updateField("email", event)
                    }
                    placeholder="Enter your email"
                  />
                </Field>
              </div>
            </div>

            <div className="addressBlock">
              <span className="blockLabel">DELIVERY ADDRESS</span>

              <Field label="Complete Delivery Address" required>
                <textarea
                  autoComplete="street-address"
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
                    autoComplete="address-level2"
                    value={details.city}
                    onChange={(event) =>
                      updateField("city", event)
                    }
                    placeholder="Enter city or village"
                  />
                </Field>

                <Field label="State" required>
                  <input
                    autoComplete="address-level1"
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
                  autoComplete="postal-code"
                  maxLength={6}
                  value={details.pincode}
                  onChange={(event) =>
                    updateField("pincode", event)
                  }
                  placeholder="6-digit pincode"
                />
              </Field>
            </div>

            <div className="formNote">
              <span>✓</span>
              <p>
                Your delivery details are used to continue this order and are
                saved locally on this device for convenience.
              </p>
            </div>

            <button
              type="submit"
              className="continueButton"
              disabled={continuing || cartItems.length === 0}
            >
              <span>
                {continuing
                  ? "Opening Payment..."
                  : "Continue to Payment"}
              </span>
              <b>→</b>
            </button>
          </form>

          <section className="summaryCard">
            <div className="summaryHeading">
              <div>
                <span>ORDER REVIEW</span>
                <h2>Order Summary</h2>
              </div>

              <button
                type="button"
                onClick={() => router.push("/cart")}
              >
                Edit Cart
              </button>
            </div>

            {cartItems.length === 0 ? (
              <div className="emptyCart">
                <span>⌑</span>
                <strong>Your cart is empty.</strong>
                <button
                  type="button"
                  onClick={() => router.push("/search")}
                >
                  Continue Shopping
                </button>
              </div>
            ) : (
              <div className="orderList">
                {cartItems.map((item) => (
                  <article
                    className="orderItem"
                    key={item.id}
                  >
                    <div className="orderImage">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                        />
                      ) : (
                        <div>NCS</div>
                      )}

                      <span>{item.quantity}</span>
                    </div>

                    <div className="orderInfo">
                      <h3>{item.name}</h3>

                      <div className="orderMeta">
                        {item.size && (
                          <span>
                            <b>Size</b>
                            {item.size}
                          </span>
                        )}

                        {item.design_unit_id && (
                          <span>
                            <b>Design</b>
                            Selected
                          </span>
                        )}
                      </div>

                      {item.barcode && (
                        <p className="trackingMeta">
                          Item Ref: {item.barcode}
                        </p>
                      )}

                      <strong>
                        ₹{(
                          Number(item.price || 0) *
                          Number(item.quantity || 0)
                        ).toLocaleString("en-IN")}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="summaryRows">
              <SummaryRow
                title="Subtotal"
                value={`₹${subtotal.toLocaleString("en-IN")}`}
              />

              <SummaryRow
                title="Shipping"
                value={
                  shipping === 0
                    ? "FREE"
                    : `₹${shipping.toLocaleString("en-IN")}`
                }
              />

              {taxEnabled && (
                <div className="summaryRow">
                  <span>Tax ({taxPercent}%)</span>
                  <strong>
                    ₹{tax.toLocaleString("en-IN")}
                  </strong>
                </div>
              )}
            </div>

            {shippingSettings.free_shipping &&
              subtotal < freeShippingMinimum && (
                <div className="freeShippingNotice">
                  Add ₹
                  {Math.max(
                    freeShippingMinimum - subtotal,
                    0
                  ).toLocaleString("en-IN")}{" "}
                  more to reach the configured free-shipping threshold.
                </div>
              )}

            {shippingSettings.estimated_days && (
              <div className="deliveryEstimate">
                <span>🚚</span>
                <p>
                  <small>Configured delivery estimate</small>
                  <strong>
                    {shippingSettings.estimated_days}
                  </strong>
                </p>
              </div>
            )}

            <div className="totalRow">
              <div>
                <span>Total</span>
                <small>
                  Current total before the payment page
                </small>
              </div>

              <strong>
                ₹{total.toLocaleString("en-IN")}
              </strong>
            </div>

            <div className="paymentPreview">
              <span className="paymentIcon">▣</span>
              <div>
                <strong>Payment is the next step</strong>
                <small>
                  Continue to view the payment options currently available for
                  this order.
                </small>
              </div>
            </div>

            <p className="protectedText">
              🔒 Checkout details are handled inside the NEW CITY STYLE order
              flow.
            </p>
          </section>
        </div>
      </div>

      {cartItems.length > 0 && (
        <div className="mobileContinueBar">
          <div>
            <span>Order Total</span>
            <strong>₹{total.toLocaleString("en-IN")}</strong>
          </div>

          <button
            type="submit"
            form="ncs-checkout-form"
            disabled={continuing}
          >
            {continuing ? "Opening..." : "Continue →"}
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
          font-family: Inter, Poppins, Arial, sans-serif;
        }

        button,
        input,
        textarea {
          font: inherit;
        }

        .page {
          position: relative;
          overflow: hidden;
          min-height: 100vh;
          padding: 38px 20px 90px;
          background:
            radial-gradient(circle at 92% 5%, rgba(212,175,55,.11), transparent 24%),
            radial-gradient(circle at 3% 88%, rgba(10,46,115,.07), transparent 24%),
            #f7f9fc;
        }

        .container {
          position: relative;
          z-index: 3;
          width: min(1420px, 100%);
          margin: 0 auto;
        }

        .ambientGrid {
          position: absolute;
          inset: 0;
          opacity: .035;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(10,46,115,.18) 1px, transparent 1px),
            linear-gradient(90deg, rgba(10,46,115,.18) 1px, transparent 1px);
          background-size: 66px 66px;
          mask-image: linear-gradient(180deg, rgba(0,0,0,.8), transparent 88%);
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
          background: rgba(212,175,55,.09);
        }

        .glowTwo {
          left: -150px;
          bottom: 0;
          width: 390px;
          height: 390px;
          background: rgba(10,46,115,.06);
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(350px, .65fr);
          gap: 24px;
          padding: 30px;
          border: 1px solid rgba(212,175,55,.23);
          border-radius: 24px;
          background:
            radial-gradient(circle at 88% 18%, rgba(212,175,55,.18), transparent 28%),
            linear-gradient(135deg, #071a3f, #0a2e73 60%, #164b9d);
          color: #fff;
          box-shadow: 0 24px 60px rgba(10,46,115,.15);
        }

        .eyebrow {
          color: #e7cb68;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1.7px;
        }

        .hero h1 {
          margin: 8px 0 0;
          font-size: clamp(40px, 5vw, 66px);
          line-height: 1;
          letter-spacing: -2px;
        }

        .heroCopy > p {
          max-width: 660px;
          margin: 14px 0 0;
          color: rgba(255,255,255,.64);
          font-size: 12px;
          line-height: 1.7;
        }

        .stepRail {
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: 650px;
          margin-top: 22px;
        }

        .stepRail > i {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,.16);
        }

        .step {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .step > span {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          flex: 0 0 30px;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 50%;
          background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.7);
          font-size: 8px;
          font-weight: 900;
        }

        .step.done > span,
        .step.active > span {
          border-color: #d4af37;
          background: #d4af37;
          color: #0a2e73;
        }

        .step p {
          margin: 0;
        }

        .step strong,
        .step small {
          display: block;
        }

        .step strong {
          color: #fff;
          font-size: 8px;
        }

        .step small {
          margin-top: 2px;
          color: rgba(255,255,255,.42);
          font-size: 6px;
        }

        .heroStats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          padding: 15px;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 17px;
          background: rgba(255,255,255,.06);
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
          background: rgba(255,255,255,.05);
          text-align: center;
        }

        .heroStats span {
          max-width: 100%;
          overflow: hidden;
          color: #e7cb68;
          font-size: 18px;
          font-weight: 950;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .heroStats small {
          margin-top: 3px;
          color: rgba(255,255,255,.45);
          font-size: 7px;
          text-transform: uppercase;
          letter-spacing: .7px;
        }

        .checkoutSignals {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .checkoutSignals > div {
          min-height: 62px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border: 1px solid rgba(10,46,115,.08);
          border-radius: 14px;
          background: rgba(255,255,255,.84);
        }

        .checkoutSignals > div > span {
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

        .checkoutSignals p {
          margin: 0;
        }

        .checkoutSignals strong,
        .checkoutSignals small {
          display: block;
        }

        .checkoutSignals strong {
          color: #0a2e73;
          font-size: 9px;
        }

        .checkoutSignals small {
          margin-top: 3px;
          color: #667085;
          font-size: 8px;
        }

        .layout {
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(380px, .92fr);
          gap: 22px;
          align-items: start;
          margin-top: 20px;
        }

        .addressCard,
        .summaryCard {
          border: 1px solid rgba(10,46,115,.08);
          border-radius: 19px;
          background: #fff;
          box-shadow: 0 14px 36px rgba(16,24,40,.06);
        }

        .addressCard {
          padding: 23px;
        }

        .summaryCard {
          position: sticky;
          top: 96px;
          padding: 20px;
        }

        .cardHeading,
        .summaryHeading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .cardHeading > div > span,
        .summaryHeading > div > span {
          color: #b18b15;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1.2px;
        }

        .cardHeading h2,
        .summaryHeading h2 {
          margin: 4px 0 0;
          color: #0a2e73;
          font-size: 26px;
        }

        .cardHeading > small {
          color: #98a2b3;
          font-size: 8px;
        }

        .summaryHeading button {
          min-height: 34px;
          padding: 0 10px;
          border: 1px solid #d4af37;
          border-radius: 8px;
          background: #fffaf0;
          color: #0a2e73;
          font-size: 8px;
          font-weight: 900;
          cursor: pointer;
        }

        .contactBlock,
        .addressBlock {
          margin-top: 20px;
          padding: 17px;
          border: 1px solid #eaecf0;
          border-radius: 14px;
          background: #fbfcfe;
        }

        .blockLabel {
          display: block;
          margin-bottom: 12px;
          color: #b18b15;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 1.1px;
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        :global(.checkoutField) {
          margin-bottom: 14px;
        }

        :global(.checkoutField label) {
          display: block;
          margin-bottom: 7px;
          color: #344054;
          font-size: 9px;
          font-weight: 850;
        }

        :global(.checkoutField input),
        :global(.checkoutField textarea) {
          width: 100%;
          padding: 12px 13px;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          background: #fff;
          color: #172033;
          outline: none;
          font-size: 10px;
          transition:
            border-color .2s ease,
            box-shadow .2s ease;
        }

        :global(.checkoutField input) {
          min-height: 43px;
        }

        :global(.checkoutField textarea) {
          min-height: 112px;
          resize: vertical;
          line-height: 1.55;
        }

        :global(.checkoutField input:focus),
        :global(.checkoutField textarea:focus) {
          border-color: #0a2e73;
          box-shadow: 0 0 0 3px rgba(10,46,115,.08);
        }

        .formNote {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-top: 14px;
          padding: 11px 12px;
          border: 1px solid #d1fadf;
          border-radius: 10px;
          background: #f1fcf5;
        }

        .formNote > span {
          color: #067647;
          font-size: 10px;
          font-weight: 900;
        }

        .formNote p {
          margin: 0;
          color: #475467;
          font-size: 8px;
          line-height: 1.5;
        }

        .continueButton {
          width: 100%;
          min-height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 14px;
          border: 1px solid #d4af37;
          border-radius: 11px;
          background: linear-gradient(135deg, #0a2e73, #164b9d);
          color: #fff;
          font-size: 10px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 12px 25px rgba(10,46,115,.16);
        }

        .continueButton b {
          color: #d4af37;
          font-size: 16px;
        }

        .continueButton:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .orderList {
          max-height: 430px;
          overflow-y: auto;
          margin-top: 16px;
          padding-right: 4px;
          scrollbar-width: thin;
        }

        .orderItem {
          display: grid;
          grid-template-columns: 82px minmax(0, 1fr);
          gap: 11px;
          padding: 11px 0;
          border-bottom: 1px solid #eaecf0;
        }

        .orderImage {
          position: relative;
          overflow: hidden;
          aspect-ratio: 4 / 5;
          border-radius: 10px;
          background: #eef2f7;
        }

        .orderImage img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .orderImage > div {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          background: #0a2e73;
          color: #d4af37;
          font-size: 13px;
          font-weight: 950;
        }

        .orderImage > span {
          position: absolute;
          top: 6px;
          right: 6px;
          min-width: 20px;
          height: 20px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: rgba(3,22,54,.8);
          color: #fff;
          font-size: 7px;
          font-weight: 900;
        }

        .orderInfo {
          min-width: 0;
        }

        .orderInfo h3 {
          display: -webkit-box;
          overflow: hidden;
          margin: 1px 0 0;
          color: #0a2e73;
          font-size: 12px;
          line-height: 1.35;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .orderMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 7px;
        }

        .orderMeta span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 23px;
          padding: 0 6px;
          border: 1px solid rgba(10,46,115,.08);
          border-radius: 7px;
          background: #f8fafc;
          color: #344054;
          font-size: 7px;
        }

        .orderMeta b {
          color: #667085;
          font-size: 6px;
        }

        .trackingMeta {
          margin: 6px 0 0;
          color: #98a2b3;
          font-size: 6px;
        }

        .orderInfo > strong {
          display: block;
          margin-top: 8px;
          color: #b18b15;
          font-size: 14px;
        }

        .summaryRows {
          display: grid;
          gap: 0;
          margin-top: 17px;
          padding-top: 10px;
          border-top: 1px solid #eaecf0;
        }

        .summaryRow {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 10px 0;
          border-bottom: 1px solid #f1f3f6;
        }

        .summaryRow span {
          color: #667085;
          font-size: 9px;
        }

        .summaryRow strong {
          color: #344054;
          font-size: 9px;
        }

        .freeShippingNotice {
          margin-top: 13px;
          padding: 10px 11px;
          border: 1px solid #fde68a;
          border-radius: 9px;
          background: #fffbeb;
          color: #92400e;
          font-size: 8px;
          line-height: 1.5;
        }

        .deliveryEstimate {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 10px;
          padding: 10px 11px;
          border: 1px solid #bfdbfe;
          border-radius: 9px;
          background: #eff6ff;
        }

        .deliveryEstimate > span {
          font-size: 13px;
        }

        .deliveryEstimate p {
          margin: 0;
        }

        .deliveryEstimate small,
        .deliveryEstimate strong {
          display: block;
        }

        .deliveryEstimate small {
          color: #667085;
          font-size: 7px;
        }

        .deliveryEstimate strong {
          margin-top: 2px;
          color: #0a2e73;
          font-size: 8px;
        }

        .totalRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-top: 16px;
          padding: 14px;
          border-radius: 12px;
          background: linear-gradient(135deg, #071a3f, #0a2e73);
          color: #fff;
        }

        .totalRow span,
        .totalRow small {
          display: block;
        }

        .totalRow span {
          font-size: 10px;
          font-weight: 850;
        }

        .totalRow small {
          margin-top: 3px;
          color: rgba(255,255,255,.45);
          font-size: 6px;
        }

        .totalRow > strong {
          color: #e7cb68;
          font-size: 24px;
        }

        .paymentPreview {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
          padding: 11px;
          border: 1px solid rgba(10,46,115,.08);
          border-radius: 10px;
          background: #f8fafc;
        }

        .paymentIcon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          flex: 0 0 34px;
          border-radius: 9px;
          background: #f8f3df;
          color: #0a2e73;
          font-size: 12px;
        }

        .paymentPreview strong,
        .paymentPreview small {
          display: block;
        }

        .paymentPreview strong {
          color: #0a2e73;
          font-size: 8px;
        }

        .paymentPreview small {
          margin-top: 3px;
          color: #667085;
          font-size: 7px;
          line-height: 1.45;
        }

        .protectedText {
          margin: 13px 0 0;
          color: #667085;
          font-size: 7px;
          line-height: 1.5;
          text-align: center;
        }

        .emptyCart {
          display: grid;
          justify-items: center;
          gap: 10px;
          margin-top: 16px;
          padding: 28px;
          border: 1px dashed #cbd5e1;
          border-radius: 12px;
          background: #f8fafc;
          text-align: center;
        }

        .emptyCart > span {
          font-size: 32px;
          color: #0a2e73;
        }

        .emptyCart strong {
          color: #0a2e73;
          font-size: 11px;
        }

        .emptyCart button {
          min-height: 36px;
          padding: 0 11px;
          border: 0;
          border-radius: 8px;
          background: #0a2e73;
          color: #fff;
          font-size: 8px;
          font-weight: 850;
          cursor: pointer;
        }

        .mobileContinueBar {
          display: none;
        }

        @media (max-width: 1000px) {
          .hero {
            grid-template-columns: 1fr;
          }

          .heroStats {
            max-width: 560px;
          }

          .layout {
            grid-template-columns: 1fr;
          }

          .summaryCard {
            position: static;
          }
        }

        @media (max-width: 700px) {
          .page {
            padding:
              18px 9px
              calc(100px + env(safe-area-inset-bottom));
          }

          .hero {
            padding: 20px;
            border-radius: 19px;
          }

          .hero h1 {
            font-size: 40px;
          }

          .heroCopy > p {
            font-size: 11px;
          }

          .stepRail {
            gap: 6px;
          }

          .step p {
            display: none;
          }

          .stepRail > i {
            min-width: 20px;
          }

          .heroStats {
            padding: 11px;
          }

          .heroStats span {
            font-size: 15px;
          }

          .checkoutSignals {
            display: flex;
            overflow-x: auto;
            gap: 8px;
            margin-right: -9px;
            padding-right: 9px;
            scrollbar-width: none;
          }

          .checkoutSignals::-webkit-scrollbar {
            display: none;
          }

          .checkoutSignals > div {
            min-width: 235px;
            flex: 0 0 235px;
          }

          .addressCard,
          .summaryCard {
            padding: 16px;
            border-radius: 15px;
          }

          .cardHeading,
          .summaryHeading {
            align-items: flex-start;
          }

          .cardHeading h2,
          .summaryHeading h2 {
            font-size: 22px;
          }

          .cardHeading > small {
            display: none;
          }

          .contactBlock,
          .addressBlock {
            padding: 13px;
          }

          .formGrid {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .continueButton {
            display: none;
          }

          .summaryCard {
            margin-bottom: 6px;
          }

          .mobileContinueBar {
            position: fixed;
            right: 0;
            bottom: 0;
            left: 0;
            z-index: 5000;
            display: grid;
            grid-template-columns: minmax(110px, 1fr) minmax(145px, 1fr);
            align-items: center;
            gap: 9px;
            padding:
              9px 10px
              calc(9px + env(safe-area-inset-bottom));
            border-top: 1px solid rgba(10,46,115,.09);
            background: rgba(255,255,255,.96);
            box-shadow: 0 -12px 30px rgba(16,24,40,.12);
            backdrop-filter: blur(14px);
          }

          .mobileContinueBar span,
          .mobileContinueBar strong {
            display: block;
          }

          .mobileContinueBar span {
            color: #667085;
            font-size: 7px;
          }

          .mobileContinueBar strong {
            margin-top: 2px;
            color: #b18b15;
            font-size: 16px;
          }

          .mobileContinueBar button {
            min-height: 44px;
            border: 1px solid #d4af37;
            border-radius: 10px;
            background: #0a2e73;
            color: #fff;
            font-size: 9px;
            font-weight: 950;
            cursor: pointer;
          }

          .mobileContinueBar button:disabled {
            opacity: .55;
          }
        }

        @media (max-width: 430px) {
          .hero h1 {
            font-size: 36px;
          }

          .orderItem {
            grid-template-columns: 72px minmax(0, 1fr);
          }

          .totalRow > strong {
            font-size: 21px;
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