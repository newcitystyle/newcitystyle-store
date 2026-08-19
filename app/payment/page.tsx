"use client";

import { useEffect, useMemo, useState } from "react";
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
  color?: string | null;
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

type SavedOrderSummary = {
  subtotal?: number;
  shipping?: number;
  tax?: number;
  tax_enabled?: boolean;
  tax_rate?: number;
  total?: number;
  items?: CartItem[];
};

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  keyId: string;
  error?: string;
};

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void | Promise<void>;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  notes: Record<string, string>;
  theme: {
    color: string;
  };
  modal: {
    ondismiss: () => void;
  };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
      on: (
        event: string,
        callback: (response: { error?: { description?: string } }) => void
      ) => void;
    };
  }
}

export default function PaymentPage() {
  const router = useRouter();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [checkoutDetails, setCheckoutDetails] =
    useState<CheckoutDetails | null>(null);
  const [savedSummary, setSavedSummary] =
    useState<SavedOrderSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");

  useEffect(() => {
    loadPaymentData();
  }, []);

  async function loadPaymentData() {
    setLoading(true);

    try {
      const savedCheckout = localStorage.getItem(
        "new-city-style-checkout"
      );
      const savedOrderSummary = localStorage.getItem(
        "new-city-style-order-summary"
      );

      if (savedCheckout) {
        setCheckoutDetails(
          JSON.parse(savedCheckout) as CheckoutDetails
        );
      }

      if (savedOrderSummary) {
        const parsedSummary = JSON.parse(
          savedOrderSummary
        ) as SavedOrderSummary;

        setSavedSummary(parsedSummary);

        if (
          Array.isArray(parsedSummary.items) &&
          parsedSummary.items.length > 0
        ) {
          setCartItems(parsedSummary.items);
          setLoading(false);
          return;
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let query = supabase
        .from("cart")
        .select("*")
        .order("id", { ascending: false });

      if (user) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      setCartItems((data as CartItem[]) || []);
    } catch (error) {
      console.error("Payment data error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Unable to load payment information."
      );
    } finally {
      setLoading(false);
    }
  }

  const subtotal = useMemo(() => {
    if (typeof savedSummary?.subtotal === "number") {
      return savedSummary.subtotal;
    }

    return cartItems.reduce(
      (sum, item) =>
        sum + Number(item.price) * Number(item.quantity),
      0
    );
  }, [cartItems, savedSummary]);

  const shipping =
    typeof savedSummary?.shipping === "number"
      ? savedSummary.shipping
      : subtotal >= 999
        ? 0
        : 99;

  const tax =
    typeof savedSummary?.tax === "number"
      ? savedSummary.tax
      : Math.round(subtotal * 0.05);

  const total =
    typeof savedSummary?.total === "number"
      ? savedSummary.total
      : subtotal + shipping + tax;

  function validateOrder() {
    if (!checkoutDetails) {
      alert("Shipping details are missing. Please return to checkout.");
      return false;
    }

    if (!checkoutDetails.fullName.trim()) {
      alert("Customer name is missing.");
      return false;
    }

    if (!checkoutDetails.mobile.trim()) {
      alert("Mobile number is missing.");
      return false;
    }

    if (!checkoutDetails.address.trim()) {
      alert("Delivery address is missing.");
      return false;
    }

    if (cartItems.length === 0) {
      alert("Your cart is empty.");
      return false;
    }

    return true;
  }

  function loadRazorpayScript() {
    return new Promise<boolean>((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const existingScript = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(true));
        existingScript.addEventListener("error", () => resolve(false));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function clearCustomerCart(userId?: string) {
    if (userId) {
      return await supabase
        .from("cart")
        .delete()
        .eq("user_id", userId);
    }

    const cartIds = cartItems.map((item) => item.id);

    if (cartIds.length === 0) {
      return { error: null };
    }

    return await supabase
      .from("cart")
      .delete()
      .in("id", cartIds);
  }

  async function sendOwnerOrderAlert(payload: {
    orderId: string;
    customerName: string;
    customerPhone: string;
    totalAmount: number;
    paymentMethod: string;
    paymentStatus: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      size?: string | null;
      color?: string | null;
      barcode?: string | null;
    }>;
  }) {
    try {
      const response = await fetch(
        "/api/whatsapp/owner-order-alert",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || data.success === false) {
        console.error(
          "Owner WhatsApp order alert failed:",
          data.error || data.message || "Unknown WhatsApp error"
        );
      }
    } catch (error) {
      console.error(
        "Owner WhatsApp order alert request failed:",
        error
      );
    }
  }


  async function sendCustomerOrderConfirmation(payload: {
    orderId: string;
    customerName: string;
    customerPhone: string;
    totalAmount: number;
    paymentMethod: string;
    paymentStatus: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      size?: string | null;
      color?: string | null;
    }>;
  }) {
    try {
      const response = await fetch(
        "/api/whatsapp/customer-order-confirmation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || data.success === false) {
        console.error(
          "Customer WhatsApp order confirmation failed:",
          data.error || data.message || "Unknown WhatsApp error"
        );
      }
    } catch (error) {
      console.error(
        "Customer WhatsApp order confirmation request failed:",
        error
      );
    }
  }

  async function decrementPurchasedStock(items: CartItem[]) {
    /*
     * Online order stock rule:
     * - Always reduce parent products.stock + products.online_stock_limit.
     * - If variant_id exists, reduce that exact product_variants row too.
     * - When a variant's online quantity reaches zero, mark the linked
     *   design link sold_out. If that design has no available links left,
     *   mark the design unit sold_out as well.
     *
     * This keeps the website, design cards and billing stock aligned.
     */

    const productQuantities = new Map<number, number>();
    const variantQuantities = new Map<number, number>();

    for (const item of items) {
      const quantity = Math.max(1, Number(item.quantity || 1));
      const productId = Number(item.product_id || 0);
      const variantId = Number(item.variant_id || 0);

      if (productId > 0) {
        productQuantities.set(
          productId,
          (productQuantities.get(productId) || 0) + quantity
        );
      }

      if (variantId > 0) {
        variantQuantities.set(
          variantId,
          (variantQuantities.get(variantId) || 0) + quantity
        );
      }
    }

    /*
     * DESIGN-LEVEL AVAILABILITY
     * -------------------------
     * product_design_unit_variants is the availability map for the exact
     * storefront design + size/barcode combination.
     *
     * A parent variant can be shared by several uploaded design cards, so
     * waiting until the aggregate variant quantity reaches zero is not enough:
     * the exact purchased design would continue to appear online.
     *
     * Mark only the purchased design+variant link sold_out immediately.
     * If that design has no other available size/variant links, mark the
     * whole design unit sold_out. Other designs linked to the same parent
     * variant remain untouched.
     */
    for (const item of items) {
      const designUnitId = Number(item.design_unit_id || 0);
      const variantId = Number(item.variant_id || 0);

      if (designUnitId <= 0 || variantId <= 0) {
        continue;
      }

      const { error: exactLinkUpdateError } = await supabase
        .from("product_design_unit_variants")
        .update({ status: "sold_out" })
        .eq("design_unit_id", designUnitId)
        .eq("variant_id", variantId)
        .eq("status", "available");

      if (exactLinkUpdateError) {
        console.error(
          "Unable to mark purchased design/variant sold out:",
          exactLinkUpdateError
        );
      }

      const {
        data: remainingDesignLinks,
        error: remainingDesignLinksError,
      } = await supabase
        .from("product_design_unit_variants")
        .select("id")
        .eq("design_unit_id", designUnitId)
        .eq("status", "available")
        .limit(1);

      if (remainingDesignLinksError) {
        console.error(
          "Unable to check remaining purchased design availability:",
          remainingDesignLinksError
        );
      } else if (
        !remainingDesignLinks ||
        remainingDesignLinks.length === 0
      ) {
        const { error: designSoldOutError } = await supabase
          .from("product_design_units")
          .update({ status: "sold_out" })
          .eq("id", designUnitId);

        if (designSoldOutError) {
          console.error(
            "Unable to mark purchased design sold out:",
            designSoldOutError
          );
        }
      }
    }

    for (const [variantId, quantity] of variantQuantities) {
      const { data: variant, error: variantLoadError } =
        await supabase
          .from("product_variants")
          .select(
            "id,product_id,stock,online_stock_limit,sell_online"
          )
          .eq("id", variantId)
          .maybeSingle();

      if (variantLoadError) throw variantLoadError;
      if (!variant) continue;

      const currentStock = Math.max(
        0,
        Number(variant.stock || 0)
      );
      const currentOnline = Math.max(
        0,
        Number(variant.online_stock_limit || 0)
      );

      const nextStock = Math.max(0, currentStock - quantity);
      const nextOnline = Math.max(
        0,
        currentOnline - quantity
      );

      const { error: variantUpdateError } = await supabase
        .from("product_variants")
        .update({
          stock: nextStock,
          online_stock_limit: nextOnline,
          sell_online: nextOnline > 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", variantId);

      if (variantUpdateError) throw variantUpdateError;

      /*
       * IMPORTANT:
       * A single parent variant may be shared by many uploaded design cards.
       * Never bulk-mark every design linked to a variant as sold_out just
       * because the aggregate variant online_stock_limit reached zero.
       *
       * Exact design availability is handled above using
       * design_unit_id + variant_id. Here we only keep the shared variant
       * row in sync without touching unrelated designs.
       */
      const {
        data: remainingVariantDesignLinks,
        error: remainingVariantDesignLinksError,
      } = await supabase
        .from("product_design_unit_variants")
        .select("id")
        .eq("variant_id", variantId)
        .eq("status", "available");

      if (remainingVariantDesignLinksError) {
        console.error(
          "Unable to check remaining shared design availability:",
          remainingVariantDesignLinksError
        );
      } else {
        const availableDesignLinkCount =
          remainingVariantDesignLinks?.length || 0;

        if (availableDesignLinkCount > 0) {
          const safeOnlineQuantity = Math.max(
            nextOnline,
            availableDesignLinkCount
          );

          const { error: sharedVariantAvailabilityError } =
            await supabase
              .from("product_variants")
              .update({
                online_stock_limit: safeOnlineQuantity,
                sell_online: true,
                updated_at: new Date().toISOString(),
              })
              .eq("id", variantId);

          if (sharedVariantAvailabilityError) {
            console.error(
              "Unable to preserve shared variant online availability:",
              sharedVariantAvailabilityError
            );
          }
        }
      }
    }

    for (const [productId, quantity] of productQuantities) {
      const { data: product, error: productLoadError } =
        await supabase
          .from("products")
          .select(
            "id,stock,online_stock_limit,sell_online"
          )
          .eq("id", productId)
          .maybeSingle();

      if (productLoadError) throw productLoadError;
      if (!product) continue;

      const currentStock = Math.max(
        0,
        Number(product.stock || 0)
      );
      const currentOnline = Math.max(
        0,
        Number(product.online_stock_limit || 0)
      );

      const nextStock = Math.max(0, currentStock - quantity);
      const nextOnline = Math.max(
        0,
        currentOnline - quantity
      );

      const { error: productUpdateError } = await supabase
        .from("products")
        .update({
          stock: nextStock,
          online_stock_limit: nextOnline,
          sell_online: nextOnline > 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId);

      if (productUpdateError) throw productUpdateError;
    }
  }

  function createOrderItems() {
    return cartItems.map((item) => ({
      product_id: item.product_id,
      name: item.name,
      image: item.image,
      price: Number(item.price),
      quantity: Number(item.quantity),
      size: item.size || null,
      color: item.color || null,
      design_unit_id:
        Number(item.design_unit_id || 0) > 0
          ? Number(item.design_unit_id)
          : null,
      variant_id:
        Number(item.variant_id || 0) > 0
          ? Number(item.variant_id)
          : null,
      barcode: item.barcode || null,
      item_total:
        Number(item.price) * Number(item.quantity),
    }));
  }

  async function saveCompletedOrder({
    userId,
    method,
    paymentStatus,
    razorpayOrderId,
    razorpayPaymentId,
  }: {
    userId?: string;
    method: string;
    paymentStatus: string;
    razorpayOrderId?: string | null;
    razorpayPaymentId?: string | null;
  }) {
    if (!checkoutDetails) {
      throw new Error("Shipping details are missing.");
    }

    /*
     * Avoid duplicate paid orders / duplicate stock decrement if a payment
     * callback is retried by the browser or Razorpay.
     */
    if (razorpayPaymentId) {
      const { data: existingOrder, error: existingOrderError } =
        await supabase
          .from("orders")
          .select("id")
          .eq("razorpay_payment_id", razorpayPaymentId)
          .maybeSingle();

      if (existingOrderError) throw existingOrderError;

      if (existingOrder?.id) {
        localStorage.setItem(
          "new-city-style-last-order-id",
          String(existingOrder.id)
        );
        localStorage.removeItem("new-city-style-checkout");
        localStorage.removeItem("new-city-style-order-summary");
        return existingOrder.id;
      }
    }

    const orderItems = createOrderItems();

    const orderData = {
      customer_name: checkoutDetails.fullName,
      phone: checkoutDetails.mobile,
      email: checkoutDetails.email || null,
      address: checkoutDetails.address,
      city: checkoutDetails.city,
      state: checkoutDetails.state,
      pincode: checkoutDetails.pincode,
      items: orderItems,
      total_amount: total,
      payment_method: method,
      payment_status: paymentStatus,
      order_status:
        paymentStatus === "Paid" ? "Confirmed" : "Pending",
      status:
        paymentStatus === "Paid" ? "Confirmed" : "Pending",
      razorpay_order_id: razorpayOrderId || null,
      razorpay_payment_id: razorpayPaymentId || null,
    };

    const { data, error } = await supabase
      .from("orders")
      .insert(orderData)
      .select("id")
      .single();

    if (error) throw error;

    /*
     * Reduce stock only AFTER the order row exists.
     * This applies to paid online orders and COD orders once placed,
     * so reserved online stock cannot be sold twice.
     */
    try {
      await decrementPurchasedStock(cartItems);
    } catch (stockError) {
      console.error(
        "Order created, but stock decrement failed:",
        stockError
      );

      /*
       * Keep the successfully created order. We do not delete it because
       * payment may already be captured. Surface a clear warning instead.
       */
      alert(
        `Order #${data.id} was created, but stock sync needs attention. Please check Admin Orders.`
      );
    }

    const { error: cartError } =
      await clearCustomerCart(userId);

    if (cartError) {
      console.error("Cart clear error:", cartError);
    }

    localStorage.removeItem("new-city-style-checkout");
    localStorage.removeItem("new-city-style-order-summary");

    if (data?.id) {
      localStorage.setItem(
        "new-city-style-last-order-id",
        String(data.id)
      );

      /*
       * Send both WhatsApp messages before navigating away.
       * Notification errors are intentionally non-fatal: the order remains saved.
       */
      await Promise.allSettled([
        sendOwnerOrderAlert({
          orderId: String(data.id),
          customerName: checkoutDetails.fullName,
          customerPhone: checkoutDetails.mobile,
          totalAmount: total,
          paymentMethod: method,
          paymentStatus,
          address: checkoutDetails.address,
          city: checkoutDetails.city,
          state: checkoutDetails.state,
          pincode: checkoutDetails.pincode,
          items: cartItems.map((item) => ({
            name: item.name,
            quantity: Number(item.quantity),
            price: Number(item.price),
            size: item.size || null,
            color: item.color || null,
            barcode: item.barcode || null,
          })),
        }),
        sendCustomerOrderConfirmation({
          orderId: String(data.id),
          customerName: checkoutDetails.fullName,
          customerPhone: checkoutDetails.mobile,
          totalAmount: total,
          paymentMethod: method,
          paymentStatus,
          items: cartItems.map((item) => ({
            name: item.name,
            quantity: Number(item.quantity),
            price: Number(item.price),
            size: item.size || null,
            color: item.color || null,
          })),
        }),
      ]);
    }

    return data?.id;
  }

  async function placeCodOrder() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await saveCompletedOrder({
      userId: user?.id,
      method: "Cash on Delivery",
      paymentStatus: "Pending",
    });

    router.push("/order-success");
  }

  async function startOnlinePayment() {
    if (!checkoutDetails) return;

    const scriptLoaded = await loadRazorpayScript();

    if (!scriptLoaded || !window.Razorpay) {
      throw new Error(
        "Razorpay checkout could not be loaded. Check your internet connection."
      );
    }

    const createOrderResponse = await fetch(
      "/api/razorpay/create-order",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: total,
          currency: "INR",
          receipt: `ncs_${Date.now()}`,
          notes: {
            customer_name: checkoutDetails.fullName,
            customer_mobile: checkoutDetails.mobile,
          },
        }),
      }
    );

    const razorpayOrder =
      (await createOrderResponse.json()) as RazorpayOrderResponse;

    if (!createOrderResponse.ok || !razorpayOrder.id) {
      throw new Error(
        razorpayOrder.error ||
        "Unable to create Razorpay order."
      );
    }

    const options: RazorpayOptions = {
      key: razorpayOrder.keyId,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      name: "NEW CITY STYLE",
      description: `Payment for ${cartItems.length} item${
        cartItems.length === 1 ? "" : "s"
      }`,
      order_id: razorpayOrder.id,
      handler: async (response) => {
        try {
          const verificationResponse = await fetch(
            "/api/razorpay/verify-payment",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ...response,
                expected_order_id: razorpayOrder.id,
              }),
            }
          );

          const verificationData =
            await verificationResponse.json();

          if (
            !verificationResponse.ok ||
            !verificationData.success
          ) {
            throw new Error(
              verificationData.error ||
              "Payment verification failed."
            );
          }

          const {
            data: { user },
          } = await supabase.auth.getUser();

          await saveCompletedOrder({
            userId: user?.id,
            method: "Razorpay Online Payment",
            paymentStatus: "Paid",
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
          });

          router.push("/order-success");
        } catch (error) {
          console.error("Payment completion error:", error);
          alert(
            error instanceof Error
              ? error.message
              : "Payment succeeded, but the order could not be saved. Please contact customer care."
          );
          setPlacingOrder(false);
        }
      },
      prefill: {
        name: checkoutDetails.fullName,
        email: checkoutDetails.email || "",
        contact: checkoutDetails.mobile,
      },
      notes: {
        address: `${checkoutDetails.address}, ${checkoutDetails.city}, ${checkoutDetails.state} - ${checkoutDetails.pincode}`,
      },
      theme: {
        color: "#0A2E73",
      },
      modal: {
        ondismiss: () => {
          setPlacingOrder(false);
        },
      },
    };

    const razorpay = new window.Razorpay(options);

    razorpay.on("payment.failed", (response) => {
      alert(
        response.error?.description ||
        "Online payment failed. Please try again."
      );
      setPlacingOrder(false);
    });

    razorpay.open();
  }

  async function placeOrder() {
    if (!validateOrder() || placingOrder) return;

    setPlacingOrder(true);

    try {
      if (paymentMethod === "cod") {
        await placeCodOrder();
        return;
      }

      await startOnlinePayment();
    } catch (error) {
      console.error("Place order error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Something went wrong while placing your order."
      );
      setPlacingOrder(false);
    }
  }

  if (loading) {
    return <div className="loadingPage">Loading Payment...</div>;
  }

  if (!checkoutDetails) {
    return (
      <main className="missingPage">
        <section>
          <div>📍</div>
          <h1>Shipping Details Required</h1>
          <p>
            Please complete your shipping address before selecting a
            payment method.
          </p>
          <button onClick={() => router.push("/checkout")}>
            Return to Checkout
          </button>
        </section>

        <style jsx>{`
          .missingPage {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: #f8f4ec;
          }

          section {
            width: 100%;
            max-width: 520px;
            padding: 40px;
            border-radius: 18px;
            background: white;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
          }

          section > div {
            font-size: 52px;
          }

          h1 {
            color: #0a2e73;
          }

          p {
            color: #667085;
            line-height: 1.7;
          }

          button {
            padding: 14px 24px;
            border: 0;
            border-radius: 10px;
            background: #d4af37;
            color: #0a2e73;
            font-weight: 800;
            cursor: pointer;
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
          <h1>Secure Payment</h1>
          <span>
            Select your preferred payment method and place your order.
          </span>
        </section>

        <div className="layout">
          <div className="leftColumn">
            <section className="card">
              <h2>Delivery Address</h2>
              <h3>{checkoutDetails.fullName}</h3>
              <p>{checkoutDetails.mobile}</p>
              {checkoutDetails.email && (
                <p>{checkoutDetails.email}</p>
              )}
              <p>
                {checkoutDetails.address}, {checkoutDetails.city},{" "}
                {checkoutDetails.state} - {checkoutDetails.pincode}
              </p>
              <button
                className="outlineButton"
                onClick={() => router.push("/checkout")}
              >
                Edit Address
              </button>
            </section>

            <section className="card">
              <h2>Choose Payment Method</h2>

              <PaymentOption
                value="cod"
                selectedValue={paymentMethod}
                onChange={setPaymentMethod}
                title="Cash on Delivery"
                description="Pay safely when your order arrives."
                icon="💵"
              />

              <PaymentOption
                value="online"
                selectedValue={paymentMethod}
                onChange={setPaymentMethod}
                title="Razorpay Online Payment"
                description="UPI, cards, net banking and supported wallets."
                icon="🔒"
              />

              <div className="securityNote">
                🔐 Online payments are verified securely on the server.
              </div>
            </section>
          </div>

          <section className="card summaryCard">
            <h2>Order Summary</h2>

            {cartItems.map((item) => (
              <article className="orderItem" key={item.id}>
                <img src={item.image} alt={item.name} />

                <div>
                  <h3>{item.name}</h3>
                  <p>Quantity: {item.quantity}</p>
                  {(item.size || item.color) && (
                    <p>
                      {item.size ? `Size: ${item.size}` : ""}
                      {item.size && item.color ? " | " : ""}
                      {item.color ? `Color: ${item.color}` : ""}
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
            ))}

            <div className="summaryRows">
              <SummaryRow
                title="Subtotal"
                value={`₹${subtotal.toLocaleString("en-IN")}`}
              />
              <SummaryRow
                title="Shipping"
                value={shipping === 0 ? "FREE" : `₹${shipping}`}
              />
              {tax > 0 && (
                <SummaryRow
                  title={`Tax (${Math.round(
                    Number(savedSummary?.tax_rate || 0.05) * 100
                  )}%)`}
                  value={`₹${tax.toLocaleString("en-IN")}`}
                />
              )}
            </div>

            <div className="totalRow">
              <span>Total</span>
              <strong>₹{total.toLocaleString("en-IN")}</strong>
            </div>

            <button
              className="placeOrderButton"
              onClick={placeOrder}
              disabled={placingOrder}
            >
              {placingOrder
                ? paymentMethod === "online"
                  ? "Opening Secure Payment..."
                  : "Placing Order..."
                : paymentMethod === "online"
                  ? `Pay ₹${total.toLocaleString("en-IN")} Securely`
                  : "Place Cash on Delivery Order"}
            </button>

            <p className="protectedText">
              🔒 Your payment and order information is securely protected.
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

        button {
          font: inherit;
        }

        .loadingPage {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8f4ec;
          color: #0a2e73;
          font-size: 22px;
          font-weight: 800;
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
          max-width: 1300px;
          margin: 0 auto;
        }

        .hero {
          margin-bottom: 28px;
          padding: 28px;
          border-radius: 20px;
          background: linear-gradient(135deg, #0a2e73, #164ca8);
          color: white;
          box-shadow: 0 12px 35px rgba(10, 46, 115, 0.25);
        }

        .hero p {
          margin: 0 0 7px;
          color: #d4af37;
          font-weight: 850;
          letter-spacing: 1px;
        }

        .hero h1 {
          margin: 0;
          font-size: 34px;
        }

        .hero span {
          display: block;
          margin-top: 9px;
          opacity: 0.88;
        }

        .layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 0.8fr);
          gap: 28px;
          align-items: start;
        }

        .leftColumn {
          display: grid;
          gap: 22px;
        }

        .card {
          padding: 28px;
          border: 1px solid rgba(10, 46, 115, 0.08);
          border-radius: 18px;
          background: white;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.07);
        }

        .card h2 {
          margin: 0 0 22px;
          color: #0a2e73;
        }

        .card h3 {
          margin: 0 0 8px;
        }

        .card p {
          margin: 0 0 7px;
          color: #555;
          line-height: 1.7;
        }

        .outlineButton {
          margin-top: 17px;
          padding: 11px 17px;
          border: 2px solid #0a2e73;
          border-radius: 9px;
          background: white;
          color: #0a2e73;
          font-weight: 800;
          cursor: pointer;
        }

        .securityNote {
          margin-top: 16px;
          padding: 12px 14px;
          border-radius: 10px;
          background: #ecfdf3;
          color: #067647;
          font-size: 12px;
          font-weight: 750;
        }

        .summaryCard {
          position: sticky;
          top: 95px;
        }

        .orderItem {
          display: flex;
          gap: 13px;
          margin-bottom: 17px;
          padding-bottom: 17px;
          border-bottom: 1px solid #e5e7eb;
        }

        .orderItem img {
          width: 70px;
          height: 85px;
          flex-shrink: 0;
          border-radius: 9px;
          background: #f3f4f6;
          object-fit: cover;
        }

        .orderItem h3 {
          margin: 0 0 7px;
          color: #0a2e73;
          font-size: 16px;
        }

        .orderItem p {
          margin: 0 0 5px;
          color: #666;
          font-size: 13px;
        }

        .orderItem strong {
          color: #d4af37;
        }

        .summaryRows {
          display: grid;
          gap: 11px;
          margin-top: 18px;
        }

        .totalRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
        }

        .totalRow span {
          color: #0a2e73;
          font-size: 21px;
          font-weight: 800;
        }

        .totalRow strong {
          color: #d4af37;
          font-size: 27px;
        }

        .placeOrderButton {
          width: 100%;
          min-height: 54px;
          margin-top: 25px;
          border: 0;
          border-radius: 11px;
          background: linear-gradient(135deg, #0a2e73, #164ca8);
          color: white;
          font-size: 16px;
          font-weight: 850;
          cursor: pointer;
          box-shadow: 0 12px 25px rgba(10, 46, 115, 0.2);
        }

        .placeOrderButton:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .protectedText {
          margin: 13px 0 0 !important;
          color: #667085 !important;
          font-size: 12px !important;
          text-align: center;
        }

        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .summaryCard {
            position: static;
          }
        }

        @media (max-width: 600px) {
          .page {
            padding: 20px 10px 45px;
          }

          .hero,
          .card {
            padding: 18px;
          }

          .hero h1 {
            font-size: 28px;
          }
        }
      `}</style>
    </main>
  );
}

function PaymentOption({
  value,
  selectedValue,
  onChange,
  title,
  description,
  icon,
}: {
  value: "cod" | "online";
  selectedValue: "cod" | "online";
  onChange: (value: "cod" | "online") => void;
  title: string;
  description: string;
  icon: string;
}) {
  const selected = selectedValue === value;

  return (
    <label className={`paymentOption ${selected ? "selected" : ""}`}>
      <input
        type="radio"
        name="payment"
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
      />

      <span className="optionIcon">{icon}</span>

      <div>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>

      <style jsx>{`
        .paymentOption {
          display: grid;
          grid-template-columns: auto 42px 1fr;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
          padding: 17px;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          background: white;
          cursor: pointer;
          transition:
            border-color 0.2s ease,
            background 0.2s ease,
            transform 0.2s ease;
        }

        .paymentOption:hover {
          transform: translateY(-1px);
          border-color: #0a2e73;
        }

        .selected {
          border: 2px solid #0a2e73;
          background: #f2f6ff;
        }

        input {
          width: 17px;
          height: 17px;
          accent-color: #0a2e73;
        }

        .optionIcon {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: #eef3ff;
          font-size: 19px;
        }

        strong,
        small {
          display: block;
        }

        strong {
          color: #0a2e73;
          font-size: 14px;
        }

        small {
          margin-top: 5px;
          color: #667085;
          font-size: 11px;
        }
      `}</style>
    </label>
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
    <div className="row">
      <span>{title}</span>
      <strong>{value}</strong>

      <style jsx>{`
        .row {
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