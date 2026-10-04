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

type AppliedClubVoucher = {
  code: string;
  discountAmount: number;
  memberId?: number | null;
  expiresAt?: string | null;
};

type AppliedStoreCoupon = {
  id: number;
  code: string;
  title: string;
  discountAmount: number;
  discountType: "percentage" | "fixed";
  discountValue: number;
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

async function recordPurchaseAnalytics({
  orderId,
  total,
  subtotal,
  shipping,
  tax,
  paymentMethod,
  paymentStatus,
  items,
}: {
  orderId: string | number;
  total: number;
  subtotal: number;
  shipping: number;
  tax: number;
  paymentMethod: string;
  paymentStatus: string;
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

    const purchaseKey =
      `ncs_purchase_tracked_${String(orderId)}`;

    if (
      sessionStorage.getItem(purchaseKey) === "1"
    ) {
      return;
    }

    const attribution = getStoredAttribution();

    const { error } = await supabase
      .from("website_visits")
      .insert({
        visitor_id: visitorId,
        session_id: sessionId,
        page_path: window.location.pathname,
        page_title: document.title || "Payment",
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

        event_type: "purchase",
        event_value: total,

        metadata: {
          order_id: String(orderId),
          payment_method: paymentMethod,
          payment_status: paymentStatus,
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
            color: item.color || null,
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
        "Website purchase tracking error:",
        error
      );
      return;
    }

    sessionStorage.setItem(
      purchaseKey,
      "1"
    );
  } catch (error) {
    console.error(
      "Unable to record purchase analytics:",
      error
    );
  }
}

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
  const [clubCode, setClubCode] = useState("");
  const [clubVoucher, setClubVoucher] =
    useState<AppliedClubVoucher | null>(null);
  const [clubChecking, setClubChecking] = useState(false);
  const [clubMessage, setClubMessage] = useState("");
  const [storeCouponCode, setStoreCouponCode] = useState("");
  const [storeCoupon, setStoreCoupon] =
    useState<AppliedStoreCoupon | null>(null);
  const [storeCouponChecking, setStoreCouponChecking] = useState(false);
  const [storeCouponMessage, setStoreCouponMessage] = useState("");

  useEffect(() => {
    loadPaymentData();
  }, []);

  useEffect(() => {
    if (paymentMethod === "cod" && clubVoucher) {
      setClubVoucher(null);
      setClubMessage(
        "Club welcome voucher is reserved for online / UPI payment."
      );
    }
  }, [paymentMethod, clubVoucher]);

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

  const baseTotal =
    typeof savedSummary?.total === "number"
      ? savedSummary.total
      : subtotal + shipping + tax;

  const clubDiscount =
    paymentMethod === "online" && clubVoucher
      ? Math.min(
          Math.max(0, Number(clubVoucher.discountAmount || 0)),
          Math.max(0, baseTotal)
        )
      : 0;

  const storeCouponDiscount = storeCoupon
    ? Math.min(
        Math.max(0, Number(storeCoupon.discountAmount || 0)),
        Math.max(0, baseTotal)
      )
    : 0;

  // Money-off offers do not stack. NEW CITY STYLE Club welcome voucher
  // and a normal store coupon are mutually exclusive.
  const totalDiscount =
    clubDiscount > 0 ? clubDiscount : storeCouponDiscount;

  const total = Math.max(0, baseTotal - totalDiscount);

  async function applyClubVoucher() {
    if (storeCoupon) {
      setClubMessage(
        "Remove the regular offer coupon first. Only one money-off coupon can be used per order."
      );
      return;
    }

    if (!checkoutDetails) {
      setClubMessage("Shipping details are required before applying the voucher.");
      return;
    }

    const code = clubCode.trim().toUpperCase();

    if (!code) {
      setClubMessage("Enter your NEW CITY STYLE Club voucher code.");
      return;
    }

    if (paymentMethod !== "online") {
      setClubVoucher(null);
      setClubMessage("₹100 Club welcome voucher is available only with online / UPI payment.");
      return;
    }

    setClubChecking(true);
    setClubMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "ncs_validate_club_voucher_v1",
        {
          p_code: code,
          p_phone: checkoutDetails.mobile,
          p_order_amount: baseTotal,
          p_payment_method: "UPI",
        }
      );

      if (error) throw error;

      const payload = (data || {}) as {
        success?: boolean;
        valid?: boolean;
        member_id?: number;
        discount_amount?: number | string;
        voucher_expires_at?: string;
        message?: string;
      };

      if (payload.success !== true || payload.valid !== true) {
        setClubVoucher(null);
        setClubMessage(
          payload.message || "This Club voucher is not valid for this order."
        );
        return;
      }

      const discountAmount = Math.max(
        0,
        Number(payload.discount_amount || 0)
      );

      setClubVoucher({
        code,
        discountAmount,
        memberId: payload.member_id || null,
        expiresAt: payload.voucher_expires_at || null,
      });
      setClubCode(code);
      setClubMessage(
        payload.message ||
          `NEW CITY STYLE Club ₹${discountAmount.toFixed(0)} voucher applied.`
      );
    } catch (error) {
      console.error("Club voucher validation error:", error);
      setClubVoucher(null);
      setClubMessage(
        error instanceof Error
          ? error.message
          : "Unable to validate Club voucher."
      );
    } finally {
      setClubChecking(false);
    }
  }

  function removeClubVoucher() {
    setClubVoucher(null);
    setClubMessage("Club voucher removed.");
  }

  async function markClubVoucherUsed(orderId: string | number) {
    if (!clubVoucher || !checkoutDetails) return;

    try {
      const { data, error } = await supabase.rpc(
        "ncs_mark_club_voucher_used_v1",
        {
          p_code: clubVoucher.code,
          p_phone: checkoutDetails.mobile,
          p_order_id: String(orderId),
        }
      );

      if (error) throw error;

      const payload = (data || {}) as {
        success?: boolean;
        message?: string;
      };

      if (payload.success !== true) {
        console.error(
          "Club voucher usage was not confirmed:",
          payload.message || "Unknown voucher error"
        );
      }
    } catch (error) {
      console.error("Unable to mark Club voucher used:", error);
    }
  }

  async function applyStoreCoupon() {
    const code = storeCouponCode.trim().toUpperCase();

    if (!code) {
      setStoreCouponMessage("Enter your offer coupon code.");
      return;
    }

    if (clubVoucher) {
      setStoreCouponMessage(
        "Remove the NCS Club welcome voucher first. Only one money-off coupon can be used per order."
      );
      return;
    }

    setStoreCouponChecking(true);
    setStoreCouponMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "ncs_validate_store_coupon_v1",
        {
          p_code: code,
          p_order_amount: baseTotal,
        }
      );

      if (error) throw error;

      const payload = (data || {}) as {
        success?: boolean;
        valid?: boolean;
        coupon_id?: number;
        code?: string;
        title?: string;
        discount_type?: "percentage" | "fixed";
        discount_value?: number | string;
        discount_amount?: number | string;
        message?: string;
      };

      if (payload.success !== true || payload.valid !== true) {
        setStoreCoupon(null);
        setStoreCouponMessage(
          payload.message || "This coupon is not valid for this order."
        );
        return;
      }

      const discountAmount = Math.max(
        0,
        Number(payload.discount_amount || 0)
      );

      setStoreCoupon({
        id: Number(payload.coupon_id || 0),
        code: payload.code || code,
        title: payload.title || "NEW CITY STYLE Offer",
        discountType:
          payload.discount_type === "fixed" ? "fixed" : "percentage",
        discountValue: Number(payload.discount_value || 0),
        discountAmount,
      });
      setStoreCouponCode(payload.code || code);
      setStoreCouponMessage(
        payload.message ||
          `Coupon applied. You saved ₹${discountAmount.toFixed(0)}.`
      );
    } catch (error) {
      console.error("Store coupon validation error:", error);
      setStoreCoupon(null);
      setStoreCouponMessage(
        error instanceof Error
          ? error.message
          : "Unable to validate coupon."
      );
    } finally {
      setStoreCouponChecking(false);
    }
  }

  function removeStoreCoupon() {
    setStoreCoupon(null);
    setStoreCouponMessage("Offer coupon removed.");
  }

  async function markStoreCouponUsed(orderId: string | number) {
    if (!storeCoupon) return;

    try {
      const { data, error } = await supabase.rpc(
        "ncs_mark_store_coupon_used_v1",
        {
          p_coupon_id: storeCoupon.id,
          p_code: storeCoupon.code,
          p_order_id: String(orderId),
        }
      );

      if (error) throw error;

      const payload = (data || {}) as {
        success?: boolean;
        message?: string;
      };

      if (payload.success !== true) {
        console.error(
          "Store coupon usage was not confirmed:",
          payload.message || "Unknown coupon error"
        );
      }
    } catch (error) {
      console.error("Unable to mark store coupon used:", error);
    }
  }

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

  async function syncPaidWebOrderToPos({
    orderId,
    razorpayOrderId,
    razorpayPaymentId,
  }: {
    orderId: string | number;
    razorpayOrderId?: string | null;
    razorpayPaymentId: string;
  }) {
    const response = await fetch("/api/orders/auto-pos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId: String(orderId),
        razorpayOrderId: razorpayOrderId || null,
        razorpayPaymentId,
        sendWhatsApp: true,
      }),
    });

    const result = (await response.json()) as {
      success?: boolean;
      duplicate?: boolean;
      invoiceNumber?: string;
      whatsappSent?: boolean;
      whatsappMessageId?: string | null;
      warning?: string | null;
      error?: string;
    };

    if (!response.ok || result.success !== true) {
      throw new Error(
        result.error ||
          "Paid order was saved, but Auto POS sync could not be completed."
      );
    }

    if (result.whatsappSent === false && result.warning) {
      console.info(
        "V9 Auto POS completed; WhatsApp will retry on the next safe sync:",
        result.warning
      );
    }

    return result;
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
        try {
          await syncPaidWebOrderToPos({
            orderId: existingOrder.id,
            razorpayOrderId: razorpayOrderId || null,
            razorpayPaymentId,
          });
        } catch (autoPosError) {
          console.error(
            "Existing paid order Auto POS retry failed:",
            autoPosError
          );
        }

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

    if (
      paymentStatus === "Paid" &&
      razorpayPaymentId &&
      data?.id
    ) {
      try {
        await syncPaidWebOrderToPos({
          orderId: data.id,
          razorpayOrderId: razorpayOrderId || null,
          razorpayPaymentId,
        });
      } catch (autoPosError) {
        console.error(
          "Paid web order saved, but V9 Auto POS sync needs retry:",
          autoPosError
        );
      }
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

      await recordPurchaseAnalytics({
        orderId: data.id,
        total,
        subtotal,
        shipping,
        tax,
        paymentMethod: method,
        paymentStatus,
        items: cartItems,
      });

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

      if (storeCoupon) {
        await markStoreCouponUsed(data.id);
      }

      if (paymentStatus === "Paid" && clubVoucher) {
        await markClubVoucherUsed(data.id);
      }
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

    if (clubCode.trim() && !clubVoucher) {
      throw new Error(
        "Please apply your Club voucher code first, or clear the code before payment."
      );
    }

    if (storeCouponCode.trim() && !storeCoupon) {
      throw new Error(
        "Please apply your offer coupon first, or clear the code before payment."
      );
    }

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
            ncs_club_voucher: clubVoucher?.code || "",
            ncs_club_discount: String(clubDiscount || 0),
            ncs_store_coupon: storeCoupon?.code || "",
            ncs_store_coupon_discount: String(storeCouponDiscount || 0),
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
        ncs_club_voucher: clubVoucher?.code || "",
        ncs_club_discount: String(clubDiscount || 0),
        ncs_store_coupon: storeCoupon?.code || "",
        ncs_store_coupon_discount: String(storeCouponDiscount || 0),
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
    return (
      <main className="loadingPage">
        <div className="loader" />
        <span>NEW CITY STYLE</span>
        <h2>Preparing Payment</h2>
        <p>Loading your order, offers and secure payment options…</p>

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

  if (!checkoutDetails) {
    return (
      <main className="missingPage">
        <section>
          <div>⌂</div>
          <span>CHECKOUT DETAILS REQUIRED</span>
          <h1>Complete Delivery Details First</h1>

          <p>
            Return to checkout and complete your delivery information before
            selecting a payment method.
          </p>

          <button onClick={() => router.push("/checkout")}>
            Return to Checkout →
          </button>
        </section>

        <style jsx>{`
          .missingPage {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 20px;
            background:
              radial-gradient(circle at 82% 14%, rgba(212,175,55,.12), transparent 25%),
              #f7f9fc;
          }

          section {
            width: min(520px, 100%);
            padding: 38px;
            border: 1px solid rgba(10,46,115,.08);
            border-radius: 22px;
            background: white;
            text-align: center;
            box-shadow: 0 18px 48px rgba(16,24,40,.08);
          }

          section > div {
            width: 62px;
            height: 62px;
            display: grid;
            place-items: center;
            margin: 0 auto;
            border-radius: 18px;
            background: #f8f3df;
            color: #0a2e73;
            font-size: 28px;
          }

          section > span {
            display: block;
            margin-top: 16px;
            color: #b18b15;
            font-size: 8px;
            font-weight: 950;
            letter-spacing: 1.2px;
          }

          h1 {
            margin: 7px 0 0;
            color: #0a2e73;
            font-size: 30px;
          }

          p {
            margin: 10px 0 0;
            color: #667085;
            font-size: 11px;
            line-height: 1.65;
          }

          button {
            min-height: 43px;
            margin-top: 20px;
            padding: 0 15px;
            border: 1px solid #d4af37;
            border-radius: 10px;
            background: #0a2e73;
            color: white;
            font-size: 9px;
            font-weight: 900;
            cursor: pointer;
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
            <span className="eyebrow">NEW CITY STYLE • PAYMENT</span>

            <h1>Choose How You Want to Pay</h1>

            <p>
              Review your delivery address, apply any valid offer and complete
              your order using the payment method you prefer.
            </p>

            <div className="stepRail">
              <div className="step done">
                <span>1</span>
                <p>
                  <strong>Cart</strong>
                  <small>Done</small>
                </p>
              </div>

              <i />

              <div className="step done">
                <span>2</span>
                <p>
                  <strong>Delivery</strong>
                  <small>Done</small>
                </p>
              </div>

              <i />

              <div className="step active">
                <span>3</span>
                <p>
                  <strong>Payment</strong>
                  <small>Current step</small>
                </p>
              </div>
            </div>
          </div>

          <div className="heroStats">
            <div>
              <span>{cartItems.length}</span>
              <small>Products</small>
            </div>

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
              <span>₹{total.toLocaleString("en-IN")}</span>
              <small>Payable</small>
            </div>
          </div>
        </section>

        <section className="paymentSignals">
          <div>
            <span>⌂</span>
            <p>
              <strong>Address Confirmed</strong>
              <small>Edit before placing the order if needed</small>
            </p>
          </div>

          <div>
            <span>⌁</span>
            <p>
              <strong>Offers Checked Live</strong>
              <small>Coupon rules are validated before use</small>
            </p>
          </div>

          <div>
            <span>🔒</span>
            <p>
              <strong>Server Verification</strong>
              <small>Online Razorpay payments are verified before paid status</small>
            </p>
          </div>
        </section>

        <div className="layout">
          <div className="leftColumn">
            <section className="card addressCard">
              <div className="cardHeading">
                <div>
                  <span>DELIVERY</span>
                  <h2>Delivery Address</h2>
                </div>

                <button
                  className="outlineButton"
                  onClick={() => router.push("/checkout")}
                >
                  Edit
                </button>
              </div>

              <div className="customerIdentity">
                <div className="identityMark">
                  {checkoutDetails.fullName
                    .trim()
                    .slice(0, 1)
                    .toUpperCase() || "N"}
                </div>

                <div>
                  <h3>{checkoutDetails.fullName}</h3>
                  <p>{checkoutDetails.mobile}</p>
                  {checkoutDetails.email && (
                    <p>{checkoutDetails.email}</p>
                  )}
                </div>
              </div>

              <div className="addressText">
                <span>DELIVER TO</span>
                <p>
                  {checkoutDetails.address}, {checkoutDetails.city},{" "}
                  {checkoutDetails.state} - {checkoutDetails.pincode}
                </p>
              </div>
            </section>

            <section className="card paymentCard">
              <div className="cardHeading">
                <div>
                  <span>PAYMENT METHOD</span>
                  <h2>Select Payment</h2>
                </div>

                <small>Choose one</small>
              </div>

              <div className="paymentOptions">
                <PaymentOption
                  value="cod"
                  selectedValue={paymentMethod}
                  onChange={setPaymentMethod}
                  title="Cash on Delivery"
                  description="Place the order now and pay when the order is delivered."
                  icon="₹"
                />

                <PaymentOption
                  value="online"
                  selectedValue={paymentMethod}
                  onChange={setPaymentMethod}
                  title="Razorpay Online Payment"
                  description="Continue to Razorpay for supported UPI, card, net-banking and wallet options."
                  icon="▣"
                />
              </div>

              <div className="methodStatus">
                <span className={paymentMethod === "online" ? "onlineDot" : "codDot"} />
                <p>
                  <strong>
                    {paymentMethod === "online"
                      ? "Online Payment Selected"
                      : "Cash on Delivery Selected"}
                  </strong>

                  <small>
                    {paymentMethod === "online"
                      ? "The order is marked Paid only after server-side Razorpay verification."
                      : "The order will be created with payment status Pending."}
                  </small>
                </p>
              </div>
            </section>

            <section className="card offersCard">
              <div className="cardHeading">
                <div>
                  <span>OFFERS & VOUCHERS</span>
                  <h2>Apply Savings</h2>
                </div>

                <small>One money-off offer at a time</small>
              </div>

              <div className="offerGrid">
                <div className="storeCouponBox">
                  <div className="couponHead">
                    <div>
                      <span>STORE OFFER</span>
                      <strong>Coupon Code</strong>
                    </div>
                    <b>⌁</b>
                  </div>

                  <p>
                    Valid store coupons can work with Cash on Delivery or
                    Online Payment. Eligibility is checked automatically.
                  </p>

                  <div className="couponEntry">
                    <input
                      value={storeCouponCode}
                      onChange={(event) => {
                        setStoreCouponCode(
                          event.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9_-]/g, "")
                            .slice(0, 30)
                        );

                        if (storeCoupon) {
                          setStoreCoupon(null);
                        }
                      }}
                      placeholder="Enter offer code"
                      disabled={storeCouponChecking}
                    />

                    {storeCoupon ? (
                      <button
                        type="button"
                        className="removeCoupon"
                        onClick={removeStoreCoupon}
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="applyCoupon"
                        onClick={() => void applyStoreCoupon()}
                        disabled={
                          storeCouponChecking || !storeCouponCode.trim()
                        }
                      >
                        {storeCouponChecking ? "Checking..." : "Apply"}
                      </button>
                    )}
                  </div>

                  {storeCouponMessage && (
                    <div
                      className={
                        storeCoupon
                          ? "couponMessage success"
                          : "couponMessage"
                      }
                    >
                      {storeCouponMessage}
                    </div>
                  )}

                  {storeCoupon && (
                    <div className="appliedOffer">
                      <span>✓ {storeCoupon.code}</span>
                      <strong>
                        -₹{storeCouponDiscount.toLocaleString("en-IN")}
                      </strong>
                    </div>
                  )}
                </div>

                <div className="clubVoucherBox">
                  <div className="couponHead">
                    <div>
                      <span>NEW CITY STYLE CLUB</span>
                      <strong>Welcome Voucher</strong>
                    </div>
                    <b>✦</b>
                  </div>

                  <p>
                    Club welcome voucher follows the current NCS Club rules and
                    is available only with Online / UPI payment.
                  </p>

                  <div className="couponEntry">
                    <input
                      value={clubCode}
                      onChange={(event) => {
                        setClubCode(
                          event.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, "")
                            .slice(0, 20)
                        );

                        if (clubVoucher) {
                          setClubVoucher(null);
                        }
                      }}
                      placeholder="Enter Club voucher"
                      disabled={paymentMethod !== "online" || clubChecking}
                    />

                    {clubVoucher ? (
                      <button
                        type="button"
                        className="removeCoupon"
                        onClick={removeClubVoucher}
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="applyCoupon"
                        onClick={() => void applyClubVoucher()}
                        disabled={
                          paymentMethod !== "online" ||
                          clubChecking ||
                          !clubCode.trim()
                        }
                      >
                        {clubChecking ? "Checking..." : "Apply"}
                      </button>
                    )}
                  </div>

                  {paymentMethod !== "online" && (
                    <small className="offerHint">
                      Select Online Payment to use a Club voucher.
                    </small>
                  )}

                  {clubMessage && (
                    <div
                      className={
                        clubVoucher
                          ? "couponMessage success"
                          : "couponMessage"
                      }
                    >
                      {clubMessage}
                    </div>
                  )}

                  {clubVoucher && (
                    <div className="appliedOffer">
                      <span>✓ {clubVoucher.code}</span>
                      <strong>
                        -₹{clubDiscount.toLocaleString("en-IN")}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          <section className="card summaryCard">
            <div className="summaryHeading">
              <div>
                <span>FINAL REVIEW</span>
                <h2>Order Summary</h2>
              </div>

              <button
                type="button"
                onClick={() => router.push("/cart")}
              >
                Edit Cart
              </button>
            </div>

            <div className="orderList">
              {cartItems.map((item) => (
                <article className="orderItem" key={item.id}>
                  <div className="orderImage">
                    {item.image ? (
                      <img src={item.image} alt={item.name} />
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

                      {item.color && (
                        <span>
                          <b>Colour</b>
                          {item.color}
                        </span>
                      )}

                      {item.design_unit_id && (
                        <span>
                          <b>Design</b>
                          Selected
                        </span>
                      )}
                    </div>

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

              {tax > 0 && (
                <SummaryRow
                  title={`Tax (${Math.round(
                    Number(savedSummary?.tax_rate || 0.05) * 100
                  )}%)`}
                  value={`₹${tax.toLocaleString("en-IN")}`}
                />
              )}

              {storeCouponDiscount > 0 && clubDiscount === 0 && (
                <SummaryRow
                  title={`Coupon ${storeCoupon?.code || ""}`}
                  value={`-₹${storeCouponDiscount.toLocaleString("en-IN")}`}
                />
              )}

              {clubDiscount > 0 && (
                <SummaryRow
                  title="NCS Club Voucher"
                  value={`-₹${clubDiscount.toLocaleString("en-IN")}`}
                />
              )}
            </div>

            {totalDiscount > 0 && (
              <div className="savingsRow">
                <span>You Save</span>
                <strong>
                  ₹{totalDiscount.toLocaleString("en-IN")}
                </strong>
              </div>
            )}

            <div className="totalRow">
              <div>
                <span>Final Payable</span>

                {totalDiscount > 0 && (
                  <del>
                    ₹{baseTotal.toLocaleString("en-IN")}
                  </del>
                )}
              </div>

              <strong>₹{total.toLocaleString("en-IN")}</strong>
            </div>

            <button
              className="placeOrderButton"
              onClick={placeOrder}
              disabled={placingOrder}
            >
              <span>
                {placingOrder
                  ? paymentMethod === "online"
                    ? "Opening Secure Payment..."
                    : "Placing Order..."
                  : paymentMethod === "online"
                    ? `Pay ₹${total.toLocaleString("en-IN")} Securely`
                    : "Place Cash on Delivery Order"}
              </span>
              <b>→</b>
            </button>

            <div className="securityList">
              <div>
                <span>🔒</span>
                <p>
                  <strong>Online Verification</strong>
                  <small>
                    Razorpay payments are verified before an order is saved as Paid
                  </small>
                </p>
              </div>

              <div>
                <span>✓</span>
                <p>
                  <strong>Inventory Sync</strong>
                  <small>
                    Successful orders continue through the current stock-sync flow
                  </small>
                </p>
              </div>

              <div>
                <span>☏</span>
                <p>
                  <strong>Order Messages</strong>
                  <small>
                    Existing owner and customer WhatsApp confirmations remain active
                  </small>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {cartItems.length > 0 && (
        <div className="mobilePayBar">
          <div>
            <span>
              {paymentMethod === "online" ? "Payable" : "Order Total"}
            </span>
            <strong>₹{total.toLocaleString("en-IN")}</strong>
          </div>

          <button
            type="button"
            onClick={placeOrder}
            disabled={placingOrder}
          >
            {placingOrder
              ? "Please Wait..."
              : paymentMethod === "online"
                ? "Pay Securely →"
                : "Place Order →"}
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
        input {
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
          width: min(1440px, 100%);
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
          max-width: 780px;
          margin: 8px 0 0;
          font-size: clamp(40px, 5vw, 66px);
          line-height: 1;
          letter-spacing: -2px;
        }

        .heroCopy > p {
          max-width: 700px;
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

        .paymentSignals {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .paymentSignals > div {
          min-height: 62px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border: 1px solid rgba(10,46,115,.08);
          border-radius: 14px;
          background: rgba(255,255,255,.84);
        }

        .paymentSignals > div > span {
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

        .paymentSignals p {
          margin: 0;
        }

        .paymentSignals strong,
        .paymentSignals small {
          display: block;
        }

        .paymentSignals strong {
          color: #0a2e73;
          font-size: 9px;
        }

        .paymentSignals small {
          margin-top: 3px;
          color: #667085;
          font-size: 8px;
        }

        .layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(380px, .82fr);
          gap: 22px;
          align-items: start;
          margin-top: 20px;
        }

        .leftColumn {
          display: grid;
          gap: 14px;
        }

        .card {
          border: 1px solid rgba(10,46,115,.08);
          border-radius: 19px;
          background: #fff;
          box-shadow: 0 14px 36px rgba(16,24,40,.06);
        }

        .addressCard,
        .paymentCard,
        .offersCard {
          padding: 20px;
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
          gap: 14px;
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
          font-size: 25px;
        }

        .cardHeading > small {
          color: #98a2b3;
          font-size: 8px;
        }

        .outlineButton,
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

        .customerIdentity {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-top: 17px;
          padding: 13px;
          border: 1px solid #eaecf0;
          border-radius: 12px;
          background: #fbfcfe;
        }

        .identityMark {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          flex: 0 0 46px;
          border-radius: 13px;
          background: linear-gradient(135deg, #0a2e73, #164b9d);
          color: #d4af37;
          font-size: 16px;
          font-weight: 950;
        }

        .customerIdentity h3 {
          margin: 0;
          color: #0a2e73;
          font-size: 13px;
        }

        .customerIdentity p {
          margin: 3px 0 0;
          color: #667085;
          font-size: 8px;
        }

        .addressText {
          margin-top: 11px;
          padding: 12px 13px;
          border-radius: 11px;
          background: #f8fafc;
        }

        .addressText > span {
          color: #b18b15;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: .9px;
        }

        .addressText p {
          margin: 6px 0 0;
          color: #475467;
          font-size: 9px;
          line-height: 1.55;
        }

        .paymentOptions {
          margin-top: 17px;
        }

        .methodStatus {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 3px;
          padding: 11px 12px;
          border: 1px solid #eaecf0;
          border-radius: 10px;
          background: #f8fafc;
        }

        .methodStatus > span {
          width: 8px;
          height: 8px;
          flex: 0 0 8px;
          border-radius: 50%;
        }

        .onlineDot {
          background: #17b26a;
          box-shadow: 0 0 0 5px rgba(23,178,106,.1);
        }

        .codDot {
          background: #d4af37;
          box-shadow: 0 0 0 5px rgba(212,175,55,.12);
        }

        .methodStatus p {
          margin: 0;
        }

        .methodStatus strong,
        .methodStatus small {
          display: block;
        }

        .methodStatus strong {
          color: #0a2e73;
          font-size: 8px;
        }

        .methodStatus small {
          margin-top: 3px;
          color: #667085;
          font-size: 7px;
          line-height: 1.45;
        }

        .offerGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 11px;
          margin-top: 17px;
        }

        .storeCouponBox,
        .clubVoucherBox {
          padding: 14px;
          border: 1px solid #eaecf0;
          border-radius: 13px;
          background: #fbfcfe;
        }

        .couponHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .couponHead span,
        .couponHead strong {
          display: block;
        }

        .couponHead span {
          color: #b18b15;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: .9px;
        }

        .couponHead strong {
          margin-top: 3px;
          color: #0a2e73;
          font-size: 12px;
        }

        .couponHead b {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          flex: 0 0 34px;
          border-radius: 9px;
          background: #f8f3df;
          color: #0a2e73;
          font-size: 13px;
        }

        .storeCouponBox > p,
        .clubVoucherBox > p {
          min-height: 48px;
          margin: 10px 0 0;
          color: #667085;
          font-size: 8px;
          line-height: 1.5;
        }

        .couponEntry {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 7px;
          margin-top: 11px;
        }

        .couponEntry input {
          min-width: 0;
          height: 39px;
          padding: 0 10px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: #fff;
          color: #172033;
          outline: none;
          font-size: 8px;
        }

        .couponEntry input:focus {
          border-color: #0a2e73;
          box-shadow: 0 0 0 3px rgba(10,46,115,.07);
        }

        .couponEntry button {
          min-height: 39px;
          padding: 0 10px;
          border-radius: 9px;
          font-size: 8px;
          font-weight: 900;
          cursor: pointer;
        }

        .applyCoupon {
          border: 1px solid #d4af37;
          background: #0a2e73;
          color: #fff;
        }

        .removeCoupon {
          border: 1px solid #fecdca;
          background: #fff5f4;
          color: #b42318;
        }

        .couponEntry button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .offerHint {
          display: block;
          margin-top: 8px;
          color: #667085;
          font-size: 7px;
        }

        .couponMessage {
          margin-top: 8px;
          padding: 8px 9px;
          border-radius: 8px;
          background: #fff4ed;
          color: #b54708;
          font-size: 7px;
          line-height: 1.45;
        }

        .couponMessage.success {
          background: #ecfdf3;
          color: #067647;
        }

        .appliedOffer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 9px;
          padding: 8px 9px;
          border: 1px solid #d1fadf;
          border-radius: 8px;
          background: #f1fcf5;
        }

        .appliedOffer span {
          color: #067647;
          font-size: 7px;
          font-weight: 900;
        }

        .appliedOffer strong {
          color: #067647;
          font-size: 11px;
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

        .orderInfo > strong {
          display: block;
          margin-top: 8px;
          color: #b18b15;
          font-size: 14px;
        }

        .summaryRows {
          display: grid;
          gap: 10px;
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid #eaecf0;
        }

        .savingsRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 12px;
          padding: 9px 10px;
          border: 1px solid #d1fadf;
          border-radius: 9px;
          background: #f1fcf5;
        }

        .savingsRow span,
        .savingsRow strong {
          color: #067647;
          font-size: 8px;
          font-weight: 900;
        }

        .totalRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-top: 15px;
          padding: 14px;
          border-radius: 12px;
          background: linear-gradient(135deg, #071a3f, #0a2e73);
          color: #fff;
        }

        .totalRow span,
        .totalRow del {
          display: block;
        }

        .totalRow span {
          font-size: 9px;
          font-weight: 850;
        }

        .totalRow del {
          margin-top: 3px;
          color: rgba(255,255,255,.42);
          font-size: 7px;
        }

        .totalRow > strong {
          color: #e7cb68;
          font-size: 24px;
        }

        .placeOrderButton {
          width: 100%;
          min-height: 49px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 13px;
          border: 1px solid #d4af37;
          border-radius: 11px;
          background: linear-gradient(135deg, #0a2e73, #164b9d);
          color: #fff;
          font-size: 9px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 12px 25px rgba(10,46,115,.16);
        }

        .placeOrderButton b {
          color: #d4af37;
          font-size: 15px;
        }

        .placeOrderButton:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .securityList {
          display: grid;
          gap: 9px;
          margin-top: 16px;
          padding-top: 15px;
          border-top: 1px solid #eaecf0;
        }

        .securityList > div {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .securityList > div > span {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          flex: 0 0 30px;
          border-radius: 8px;
          background: #f8f3df;
          font-size: 10px;
        }

        .securityList p {
          margin: 0;
        }

        .securityList strong,
        .securityList small {
          display: block;
        }

        .securityList strong {
          color: #0a2e73;
          font-size: 8px;
        }

        .securityList small {
          margin-top: 2px;
          color: #667085;
          font-size: 7px;
          line-height: 1.4;
        }

        .mobilePayBar {
          display: none;
        }

        @media (max-width: 1050px) {
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

        @media (max-width: 760px) {
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

          .paymentSignals {
            display: flex;
            overflow-x: auto;
            gap: 8px;
            margin-right: -9px;
            padding-right: 9px;
            scrollbar-width: none;
          }

          .paymentSignals::-webkit-scrollbar {
            display: none;
          }

          .paymentSignals > div {
            min-width: 235px;
            flex: 0 0 235px;
          }

          .addressCard,
          .paymentCard,
          .offersCard,
          .summaryCard {
            padding: 16px;
            border-radius: 15px;
          }

          .cardHeading h2,
          .summaryHeading h2 {
            font-size: 22px;
          }

          .offerGrid {
            grid-template-columns: 1fr;
          }

          .storeCouponBox > p,
          .clubVoucherBox > p {
            min-height: 0;
          }

          .placeOrderButton {
            display: none;
          }

          .mobilePayBar {
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

          .mobilePayBar span,
          .mobilePayBar strong {
            display: block;
          }

          .mobilePayBar span {
            color: #667085;
            font-size: 7px;
          }

          .mobilePayBar strong {
            margin-top: 2px;
            color: #b18b15;
            font-size: 16px;
          }

          .mobilePayBar button {
            min-height: 44px;
            border: 1px solid #d4af37;
            border-radius: 10px;
            background: #0a2e73;
            color: #fff;
            font-size: 9px;
            font-weight: 950;
            cursor: pointer;
          }

          .mobilePayBar button:disabled {
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