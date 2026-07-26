"use client";

import Link from "next/link";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type BrandingSettings = {
  id: number;
  brand_name: string | null;
  tagline: string | null;
  logo_url: string | null;
  mobile_logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  font_heading: string | null;
  font_body: string | null;
  store_phone: string | null;
  whatsapp_number: string | null;
  whatsapp_default_message: string | null;
  store_email: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  twitter_url: string | null;
  show_whatsapp_button: boolean | null;
  show_instagram_icon: boolean | null;
  show_facebook_icon: boolean | null;
  show_youtube_icon: boolean | null;
  show_twitter_icon: boolean | null;
  updated_at: string | null;
};

type ProductRow = Record<string, unknown> & {
  id?: string | number;
  name?: string | null;
  title?: string | null;
  product_name?: string | null;
  slug?: string | null;
  url_slug?: string | null;
  price?: number | string | null;
  sale_price?: number | string | null;
  offer_price?: number | string | null;
  mrp?: number | string | null;
  image_url?: string | null;
  image?: string | null;
  thumbnail?: string | null;
  images?: unknown;
  active?: boolean | null;
  is_active?: boolean | null;
  status?: string | null;
};

type IconName =
  | "share"
  | "copy"
  | "whatsapp"
  | "coupon"
  | "post"
  | "product"
  | "catalog"
  | "qr"
  | "card"
  | "instagram"
  | "facebook"
  | "youtube"
  | "twitter"
  | "external"
  | "refresh"
  | "check"
  | "phone"
  | "mail"
  | "link"
  | "download"
  | "sparkles";

const ROYAL_BLUE = "#0A2E73";
const LUXURY_GOLD = "#D4AF37";
const IVORY = "#F8F4EC";
const WHITE = "#FFFFFF";
const CHARCOAL = "#2C2C2C";

const emptyBranding: BrandingSettings = {
  id: 0,
  brand_name: "NEW CITY STYLE",
  tagline: "Style for Every Family",
  logo_url: null,
  mobile_logo_url: null,
  favicon_url: null,
  primary_color: ROYAL_BLUE,
  secondary_color: LUXURY_GOLD,
  font_heading: "Playfair Display",
  font_body: "Poppins",
  store_phone: null,
  whatsapp_number: null,
  whatsapp_default_message:
    "Hello NEW CITY STYLE, I need help with my order.",
  store_email: null,
  instagram_url: null,
  facebook_url: null,
  youtube_url: null,
  twitter_url: null,
  show_whatsapp_button: true,
  show_instagram_icon: true,
  show_facebook_icon: true,
  show_youtube_icon: true,
  show_twitter_icon: true,
  updated_at: null,
};

function Icon({
  name,
  size = 22,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<IconName, ReactNode> = {
    share: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 10.6 6.8-4.1M8.6 13.4l6.8 4.1" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    whatsapp: (
      <>
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.8 8.8 0 0 1-3.7-.9L3 20.5l1.5-5.1A8.4 8.4 0 1 1 21 11.5Z" />
        <path d="M8.2 8.1c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.8 1.9c.1.3 0 .5-.1.7l-.6.8c-.2.2-.1.4 0 .6.6 1 1.5 1.8 2.6 2.3.3.1.5.1.7-.1l.8-1c.2-.2.4-.3.7-.2l1.9.9c.3.1.4.3.4.5 0 .4-.2 1.5-1 2-.7.5-1.7.7-2.7.4-1.2-.3-2.7-1-4.2-2.4-1.2-1.1-2.1-2.5-2.5-3.7-.4-1.1-.1-2 .4-2.6Z" />
      </>
    ),
    coupon: (
      <>
        <path d="M3 7a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4Z" />
        <path d="M13 5v2M13 11v2M13 17v2" />
      </>
    ),
    post: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </>
    ),
    product: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
      </>
    ),
    catalog: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        <path d="M9 7h7M9 11h7" />
      </>
    ),
    qr: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 18v3" />
      </>
    ),
    card: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4" />
      </>
    ),
    instagram: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    facebook: (
      <path d="M14 8h4V3h-4c-4 0-6 2.5-6 6v3H4v5h4v5h5v-5h4l1-5h-5V9c0-.7.3-1 1-1Z" />
    ),
    youtube: (
      <>
        <path d="M22 12s0-3.4-.4-5c-.2-1-1-1.8-2-2C18 4.5 12 4.5 12 4.5s-6 0-7.6.5c-1 .2-1.8 1-2 2C2 8.6 2 12 2 12s0 3.4.4 5c.2 1 1 1.8 2 2 1.6.5 7.6.5 7.6.5s6 0 7.6-.5c1-.2 1.8-1 2-2 .4-1.6.4-5 .4-5Z" />
        <path d="m10 15 5-3-5-3v6Z" />
      </>
    ),
    twitter: <path d="M4 4l16 16M20 4 4 20M8 4l12 16M4 8l12 12" />,
    external: (
      <>
        <path d="M15 3h6v6M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8.1 8.1 0 1 0 .2 4" />
        <path d="M20 4v7h-7" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    phone: (
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12M7 10l5 5 5-5" />
        <path d="M5 21h14" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3-1 3-3 1 3 1 1 3 1-3 3-1-3-1-1-3Z" />
        <path d="m19 13-.8 2.2L16 16l2.2.8L19 19l.8-2.2L22 16l-2.2-.8L19 13Z" />
        <path d="m5 13-.7 1.8-1.8.7 1.8.7L5 18l.7-1.8 1.8-.7-1.8-.7L5 13Z" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function productName(product: ProductRow) {
  return firstString(product.name, product.title, product.product_name) || "Product";
}

function productSlug(product: ProductRow) {
  return firstString(product.slug, product.url_slug);
}

function productImage(product: ProductRow) {
  const direct = firstString(product.image_url, product.image, product.thumbnail);
  if (direct) return direct;

  if (Array.isArray(product.images)) {
    for (const image of product.images) {
      if (typeof image === "string" && image.trim()) return image.trim();
      if (image && typeof image === "object") {
        const row = image as Record<string, unknown>;
        const nested = firstString(row.url, row.image_url, row.src);
        if (nested) return nested;
      }
    }
  }

  return "";
}

function productPrice(product: ProductRow) {
  const candidates = [
    product.sale_price,
    product.offer_price,
    product.price,
    product.mrp,
  ];

  for (const candidate of candidates) {
    const value = typeof candidate === "number" ? candidate : Number(candidate);
    if (Number.isFinite(value) && value >= 0) return value;
  }

  return 0;
}

function isProductVisible(product: ProductRow) {
  if (product.active === false || product.is_active === false) return false;
  if (typeof product.status === "string") {
    const status = product.status.toLowerCase();
    if (["inactive", "disabled", "draft", "archived"].includes(status)) return false;
  }
  return true;
}

function normalizeWhatsApp(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

function safeUrl(value: string | null | undefined) {
  const url = (value || "").trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function MarketingPage() {
  const [branding, setBranding] = useState<BrandingSettings>(emptyBranding);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [marketingMessage, setMarketingMessage] = useState(
    "Discover premium family fashion at NEW CITY STYLE. Shop the latest styles for Men, Women, Kids and Sarees today."
  );
  const [postCaption, setPostCaption] = useState(
    "New styles have arrived at NEW CITY STYLE ✨\nPremium fashion for the whole family.\nShop now and discover your next favourite look."
  );
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const primary = branding.primary_color || ROYAL_BLUE;
  const secondary = branding.secondary_color || LUXURY_GOLD;
  const brandName = branding.brand_name || "NEW CITY STYLE";
  const tagline = branding.tagline || "Style for Every Family";

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWebsiteUrl(window.location.origin);
    }
    void loadDashboard();
  }, []);

  async function loadDashboard(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true);
    setErrorMessage("");

    await Promise.all([loadBranding(), loadProducts()]);

    setLoading(false);
    setRefreshing(false);
  }

  async function loadBranding() {
    const { data, error } = await supabase
      .from("branding_settings")
      .select("*")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Unable to load branding settings:", error);
      setErrorMessage(
        `Branding settings could not be loaded: ${error.message}`
      );
      return;
    }

    if (data) setBranding(data as BrandingSettings);
  }

  async function loadProducts() {
    setProductsLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("id", { ascending: false })
      .limit(250);

    if (error) {
      console.error("Unable to load products:", error);
      setErrorMessage((current) =>
        current
          ? `${current} Product list could not be loaded: ${error.message}`
          : `Product list could not be loaded: ${error.message}`
      );
      setProductsLoading(false);
      return;
    }

    const rows = ((data || []) as ProductRow[]).filter(isProductVisible);
    setProducts(rows);
    setSelectedProductId((current) => {
      if (current && rows.some((row) => String(row.id ?? "") === current)) {
        return current;
      }
      return rows.length ? String(rows[0].id ?? "") : "";
    });
    setProductsLoading(false);
  }

  const selectedProduct = useMemo(
    () =>
      products.find(
        (product) => String(product.id ?? "") === selectedProductId
      ) || null,
    [products, selectedProductId]
  );

  const selectedProductUrl = useMemo(() => {
    if (!selectedProduct) return websiteUrl;
    const slug = productSlug(selectedProduct);
    const id = String(selectedProduct.id ?? "");
    return `${websiteUrl}/product/${encodeURIComponent(slug || id)}`;
  }, [selectedProduct, websiteUrl]);

  const qrImageUrl = useMemo(
    () =>
      websiteUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=900x900&margin=24&data=${encodeURIComponent(
            websiteUrl
          )}`
        : "",
    [websiteUrl]
  );

  async function copyText(text: string, label: string) {
    if (!text) {
      alert(`${label} is not configured yet.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    }
  }

  async function shareWebsite() {
    const shareData = {
      title: brandName,
      text: `${brandName} — ${tagline}`,
      url: websiteUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    await copyText(`${shareData.text}\n${shareData.url}`, "Website link");
  }

  function openUrl(url: string, missingMessage: string) {
    const value = safeUrl(url);
    if (!value) {
      alert(missingMessage);
      return;
    }
    window.open(value, "_blank", "noopener,noreferrer");
  }

  function shareWebsiteWhatsApp() {
    const phone = normalizeWhatsApp(branding.whatsapp_number);
    const text = `${brandName} — ${tagline}\n${websiteUrl}`;
    const destination = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(destination, "_blank", "noopener,noreferrer");
  }

  function sendWhatsAppMarketing() {
    const phone = normalizeWhatsApp(branding.whatsapp_number);
    const text = `${marketingMessage.trim()}\n\n${websiteUrl}`;
    const destination = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(destination, "_blank", "noopener,noreferrer");
  }

  function productShareText() {
    if (!selectedProduct) return "";
    const price = productPrice(selectedProduct);
    return `${productName(selectedProduct)}${
      price ? ` — ₹${price.toLocaleString("en-IN")}` : ""
    }\nAvailable at ${brandName}\n${selectedProductUrl}`;
  }

  async function shareSelectedProduct() {
    if (!selectedProduct) {
      alert("Please select a product first.");
      return;
    }

    const shareData = {
      title: productName(selectedProduct),
      text: productShareText(),
      url: selectedProductUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    await copyText(productShareText(), "Product link");
  }

  function shareProductWhatsApp() {
    if (!selectedProduct) {
      alert("Please select a product first.");
      return;
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(productShareText())}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function shareToFacebook() {
    const url = selectedProduct ? selectedProductUrl : websiteUrl;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function shareToTwitter() {
    const url = selectedProduct ? selectedProductUrl : websiteUrl;
    const text = selectedProduct
      ? productName(selectedProduct)
      : `${brandName} — ${tagline}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        text
      )}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function prepareInstagramPost() {
    const caption = `${postCaption.trim()}\n\n${
      selectedProduct ? selectedProductUrl : websiteUrl
    }`;
    await copyText(caption, "Instagram caption");
    if (branding.instagram_url) {
      window.open(safeUrl(branding.instagram_url), "_blank", "noopener,noreferrer");
    } else {
      alert(
        "Caption copied. Add your Instagram URL in Admin Branding Settings to open the profile automatically."
      );
    }
  }

  function printStoreQr() {
    if (!qrImageUrl) return;
    const popup = window.open("", "_blank", "width=760,height=900");
    if (!popup) {
      alert("Please allow pop-ups to print the store QR code.");
      return;
    }

    popup.document.write(`<!doctype html>
<html><head><title>${escapeHtml(brandName)} Store QR</title>
<style>
@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#0A2E73;background:#fff}.sheet{min-height:267mm;border:3px solid #D4AF37;border-radius:24px;padding:34px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.logo{max-width:230px;max-height:100px;object-fit:contain;margin-bottom:22px}.brand{font-family:Georgia,serif;font-size:34px;font-weight:800;letter-spacing:.08em;margin:0}.tag{font-size:17px;color:#555;margin:10px 0 28px}.qr{width:360px;height:360px;border:12px solid #F8F4EC;border-radius:24px}.scan{font-size:28px;font-weight:800;margin:28px 0 8px}.url{font-size:16px;word-break:break-all;color:#555}.footer{margin-top:30px;font-size:13px;color:#777}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
</head><body><div class="sheet">
${branding.logo_url ? `<img class="logo" src="${escapeHtml(branding.logo_url)}" alt="Logo"/>` : ""}
<h1 class="brand">${escapeHtml(brandName)}</h1><p class="tag">${escapeHtml(tagline)}</p>
<img class="qr" src="${escapeHtml(qrImageUrl)}" alt="Store QR Code"/>
<div class="scan">SCAN TO SHOP ONLINE</div><div class="url">${escapeHtml(websiteUrl)}</div>
<div class="footer">Premium family fashion • Men • Women • Kids • Sarees</div>
</div><script>window.onload=()=>setTimeout(()=>window.print(),500)</script></body></html>`);
    popup.document.close();
  }

  function downloadBusinessCard() {
    const phone = branding.store_phone || branding.whatsapp_number || "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
      brandName
    )} Digital Business Card</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F8F4EC;font-family:Arial,sans-serif;padding:24px}.card{width:min(760px,100%);background:linear-gradient(145deg,#0A2E73,#071d49);color:#fff;border:3px solid #D4AF37;border-radius:30px;padding:48px;box-shadow:0 30px 80px #0a2e7333;position:relative;overflow:hidden}.card:after{content:"";position:absolute;width:260px;height:260px;border:1px solid #d4af3766;border-radius:50%;right:-100px;top:-100px}.logo{max-width:210px;max-height:90px;object-fit:contain;background:#fff;border-radius:16px;padding:10px;margin-bottom:28px}.brand{font-family:Georgia,serif;color:#D4AF37;font-size:38px;letter-spacing:.08em;margin:0 0 8px}.tag{font-size:18px;margin:0 0 34px;opacity:.9}.line{padding:10px 0;border-bottom:1px solid #ffffff22;font-size:16px;word-break:break-word}.button{display:inline-block;margin-top:26px;padding:14px 22px;border-radius:999px;background:#D4AF37;color:#0A2E73;text-decoration:none;font-weight:800}.small{margin-top:24px;font-size:12px;opacity:.7}</style></head><body><div class="card">
${branding.logo_url ? `<img class="logo" src="${escapeHtml(branding.logo_url)}" alt="Logo">` : ""}
<h1 class="brand">${escapeHtml(brandName)}</h1><p class="tag">${escapeHtml(tagline)}</p>
${phone ? `<div class="line">Phone: ${escapeHtml(phone)}</div>` : ""}
${branding.store_email ? `<div class="line">Email: ${escapeHtml(branding.store_email)}</div>` : ""}
<div class="line">Website: ${escapeHtml(websiteUrl)}</div>
<a class="button" href="${escapeHtml(websiteUrl)}">Visit Online Store</a>
<div class="small">Save this file and share it with your customers.</div></div></body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-digital-business-card.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function generateCatalogPdf() {
    if (!products.length) {
      alert("No products are available for the catalog.");
      return;
    }

    const popup = window.open("", "_blank", "width=1100,height=900");
    if (!popup) {
      alert("Please allow pop-ups to generate the product catalog PDF.");
      return;
    }

    const productCards = products
      .slice(0, 120)
      .map((product) => {
        const name = productName(product);
        const image = productImage(product);
        const price = productPrice(product);
        const slug = productSlug(product);
        const id = String(product.id ?? "");
        const url = `${websiteUrl}/product/${encodeURIComponent(slug || id)}`;

        return `<article class="product">
          <div class="imageBox">${
            image
              ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}">`
              : `<div class="placeholder">NEW CITY STYLE</div>`
          }</div>
          <h3>${escapeHtml(name)}</h3>
          ${price ? `<div class="price">₹${price.toLocaleString("en-IN")}</div>` : ""}
          <div class="productUrl">${escapeHtml(url)}</div>
        </article>`;
      })
      .join("");

    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
      brandName
    )} Product Catalog</title><style>
@page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;color:#2C2C2C;font-family:Arial,sans-serif;background:#fff}.cover{height:270mm;border:3px solid #D4AF37;background:linear-gradient(145deg,#0A2E73,#071d49);color:#fff;border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:35px;page-break-after:always}.coverLogo{max-width:260px;max-height:120px;background:#fff;border-radius:18px;padding:12px;object-fit:contain;margin-bottom:34px}.cover h1{font-family:Georgia,serif;color:#D4AF37;font-size:46px;letter-spacing:.08em;margin:0}.cover p{font-size:20px}.cover .edition{margin-top:50px;padding:10px 20px;border:1px solid #d4af37;border-radius:999px}.header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #D4AF37;padding:0 0 12px;margin-bottom:18px}.header h2{color:#0A2E73;font-family:Georgia,serif;margin:0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.product{border:1px solid #ddd;border-radius:12px;padding:9px;break-inside:avoid;min-height:280px}.imageBox{height:180px;background:#F8F4EC;border-radius:9px;display:grid;place-items:center;overflow:hidden}.imageBox img{width:100%;height:100%;object-fit:contain}.placeholder{font-size:12px;color:#0A2E73;font-weight:800}.product h3{font-size:14px;line-height:1.35;margin:9px 0 6px;color:#0A2E73}.price{font-size:16px;font-weight:800;color:#8a6a00}.productUrl{font-size:7px;color:#777;word-break:break-all;margin-top:7px}.footer{margin-top:18px;border-top:1px solid #ddd;padding-top:10px;text-align:center;font-size:10px;color:#777}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<section class="cover">${
      branding.logo_url
        ? `<img class="coverLogo" src="${escapeHtml(branding.logo_url)}" alt="Logo">`
        : ""
    }<h1>${escapeHtml(brandName)}</h1><p>${escapeHtml(tagline)}</p><div class="edition">Premium Product Catalog</div></section>
<div class="header"><h2>${escapeHtml(brandName)} Collection</h2><span>${products.length} products</span></div>
<main class="grid">${productCards}</main><footer class="footer">${escapeHtml(
      websiteUrl
    )} • ${escapeHtml(branding.store_phone || "")}</footer>
<script>window.onload=()=>setTimeout(()=>window.print(),1000)</script></body></html>`);
    popup.document.close();
  }

  const configuredCount = [
    branding.logo_url,
    branding.store_phone,
    branding.whatsapp_number,
    branding.store_email,
    branding.instagram_url,
    branding.facebook_url,
    branding.youtube_url,
    branding.twitter_url,
  ].filter(Boolean).length;

  return (
    <main
      style={
        {
          "--primary": primary,
          "--secondary": secondary,
          "--ivory": IVORY,
          "--charcoal": CHARCOAL,
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top right, rgba(212,175,55,.14), transparent 34%), #f6f7fb",
          color: CHARCOAL,
          fontFamily: `${branding.font_body || "Poppins"}, Arial, sans-serif`,
        } as CSSProperties
      }
    >
      <style>{`
        * { box-sizing: border-box; }
        button, input, textarea, select { font: inherit; }
        .marketing-shell { width: min(1480px, 100%); margin: 0 auto; padding: 18px 14px 70px; }
        .hero { position: relative; overflow: hidden; border-radius: 28px; padding: 24px; color: white; background: linear-gradient(135deg, var(--primary), #061b43); box-shadow: 0 24px 60px rgba(10,46,115,.22); }
        .hero:before { content: ""; position: absolute; width: 270px; height: 270px; border: 1px solid rgba(212,175,55,.34); border-radius: 50%; right: -85px; top: -120px; }
        .hero:after { content: ""; position: absolute; width: 130px; height: 130px; background: rgba(212,175,55,.12); border-radius: 50%; right: 95px; bottom: -75px; }
        .hero-grid { position: relative; z-index: 1; display: grid; gap: 22px; }
        .hero-brand { display: flex; align-items: center; gap: 16px; }
        .hero-logo { width: 72px; height: 72px; border-radius: 18px; object-fit: contain; background: white; padding: 8px; border: 1px solid rgba(212,175,55,.7); }
        .hero-logo-fallback { display: grid; place-items: center; width: 72px; height: 72px; border-radius: 18px; background: var(--secondary); color: var(--primary); font-weight: 900; font-size: 23px; }
        .eyebrow { display: inline-flex; align-items: center; gap: 8px; color: var(--secondary); font-weight: 800; font-size: 12px; letter-spacing: .13em; text-transform: uppercase; }
        .hero h1 { margin: 7px 0 7px; font-size: clamp(28px, 6vw, 48px); font-family: ${branding.font_heading || "Playfair Display"}, Georgia, serif; line-height: 1.05; }
        .hero p { margin: 0; color: rgba(255,255,255,.78); line-height: 1.6; }
        .hero-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .button { min-height: 44px; border: 0; border-radius: 13px; padding: 11px 15px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 800; cursor: pointer; text-decoration: none; transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease; }
        .button:hover { transform: translateY(-1px); }
        .button:disabled { cursor: not-allowed; opacity: .55; transform: none; }
        .button-gold { background: var(--secondary); color: var(--primary); box-shadow: 0 10px 30px rgba(212,175,55,.22); }
        .button-light { background: rgba(255,255,255,.1); color: white; border: 1px solid rgba(255,255,255,.2); }
        .button-blue { background: var(--primary); color: white; }
        .button-outline { background: white; color: var(--primary); border: 1px solid #dce2ee; }
        .button-soft { background: #eef3ff; color: var(--primary); }
        .stats { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
        .stat { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: 17px; padding: 14px; backdrop-filter: blur(8px); }
        .stat strong { display: block; color: var(--secondary); font-size: 23px; }
        .stat span { display: block; margin-top: 3px; font-size: 12px; color: rgba(255,255,255,.7); }
        .section { margin-top: 24px; }
        .section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 13px; }
        .section-heading h2 { margin: 0; color: var(--primary); font-family: ${branding.font_heading || "Playfair Display"}, Georgia, serif; font-size: clamp(23px, 4vw, 31px); }
        .section-heading p { margin: 4px 0 0; color: #6d7280; font-size: 14px; }
        .tool-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .tool-card { background: white; border: 1px solid #e5e8ef; border-radius: 20px; padding: 18px; box-shadow: 0 10px 28px rgba(10,46,115,.06); display: flex; flex-direction: column; min-height: 190px; }
        .tool-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .tool-icon { width: 48px; height: 48px; border-radius: 15px; display: grid; place-items: center; background: linear-gradient(145deg, var(--primary), #173f83); color: var(--secondary); box-shadow: 0 9px 22px rgba(10,46,115,.18); }
        .tool-badge { border-radius: 999px; padding: 5px 9px; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; font-weight: 900; background: #f6efd6; color: #795d00; }
        .tool-card h3 { margin: 15px 0 7px; color: var(--primary); font-size: 17px; }
        .tool-card p { margin: 0 0 16px; color: #737885; font-size: 13px; line-height: 1.55; flex: 1; }
        .panel-grid { display: grid; gap: 14px; }
        .panel { background: white; border: 1px solid #e5e8ef; border-radius: 22px; padding: 18px; box-shadow: 0 12px 35px rgba(10,46,115,.06); }
        .panel h3 { margin: 0 0 4px; color: var(--primary); font-size: 19px; }
        .panel-sub { color: #737885; font-size: 13px; margin-bottom: 16px; }
        .field { display: grid; gap: 7px; margin-bottom: 13px; }
        .field label { color: var(--primary); font-size: 12px; font-weight: 900; }
        .input { width: 100%; min-height: 46px; border: 1px solid #d9deea; border-radius: 13px; padding: 11px 13px; outline: none; background: #fff; color: #242833; }
        .input:focus { border-color: var(--secondary); box-shadow: 0 0 0 3px rgba(212,175,55,.14); }
        textarea.input { min-height: 112px; resize: vertical; line-height: 1.5; }
        .actions { display: flex; flex-wrap: wrap; gap: 9px; }
        .product-preview { display: grid; grid-template-columns: 84px 1fr; gap: 13px; align-items: center; background: var(--ivory); border-radius: 16px; padding: 11px; margin-bottom: 14px; }
        .product-preview img { width: 84px; height: 94px; object-fit: contain; border-radius: 11px; background: white; }
        .product-placeholder { width: 84px; height: 94px; display: grid; place-items: center; border-radius: 11px; background: white; color: var(--primary); font-size: 10px; font-weight: 900; text-align: center; }
        .product-preview strong { display: block; color: var(--primary); line-height: 1.35; }
        .product-preview span { display: block; margin-top: 4px; color: #8a6a00; font-weight: 800; }
        .qr-preview { display: grid; place-items: center; background: var(--ivory); border-radius: 18px; padding: 18px; margin-bottom: 14px; }
        .qr-preview img { width: min(240px, 100%); aspect-ratio: 1; object-fit: contain; border-radius: 15px; background: white; padding: 8px; }
        .social-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
        .social-card { min-height: 118px; border-radius: 17px; padding: 14px; border: 1px solid #e4e8ef; background: white; display: flex; flex-direction: column; justify-content: space-between; text-decoration: none; color: var(--primary); cursor: pointer; }
        .social-card strong { font-size: 14px; }
        .social-card span { color: #777d89; font-size: 11px; word-break: break-word; }
        .social-icon { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 11px; background: #eef3ff; }
        .setup-list { display: grid; gap: 9px; }
        .setup-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 12px; border-radius: 13px; background: #f8f9fc; }
        .setup-row span { display: flex; align-items: center; gap: 9px; font-size: 13px; color: #555b67; }
        .status-ok { color: #08783e; font-size: 11px; font-weight: 900; }
        .status-missing { color: #aa4d00; font-size: 11px; font-weight: 900; }
        .notice { margin-top: 16px; padding: 13px 15px; border-radius: 14px; background: #fff8de; border: 1px solid #ead98e; color: #745b00; font-size: 13px; line-height: 1.5; }
        .error { margin-top: 16px; padding: 13px 15px; border-radius: 14px; background: #fff0f0; border: 1px solid #f0caca; color: #9a2525; font-size: 13px; }
        .skeleton { animation: pulse 1.2s infinite; background: linear-gradient(90deg,#eef0f5,#f8f9fb,#eef0f5); background-size: 200% 100%; }
        @keyframes pulse { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        @media (min-width: 680px) { .marketing-shell { padding: 24px 22px 80px; } .tool-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } .hero { padding: 30px; } .stats { grid-template-columns: repeat(4,minmax(0,1fr)); } }
        @media (min-width: 980px) { .hero-grid { grid-template-columns: minmax(0,1.3fr) minmax(430px,.7fr); align-items: end; } .tool-grid { grid-template-columns: repeat(4,minmax(0,1fr)); } .panel-grid.two { grid-template-columns: minmax(0,1.15fr) minmax(340px,.85fr); } .panel-grid.three { grid-template-columns: repeat(3,minmax(0,1fr)); } .social-grid { grid-template-columns: repeat(4,minmax(0,1fr)); } }
      `}</style>

      <div className="marketing-shell">
        <section className="hero">
          <div className="hero-grid">
            <div>
              <div className="hero-brand">
                {branding.logo_url ? (
                  <img
                    className="hero-logo"
                    src={branding.logo_url}
                    alt={`${brandName} logo`}
                  />
                ) : (
                  <div className="hero-logo-fallback">NCS</div>
                )}
                <div>
                  <div className="eyebrow">
                    <Icon name="sparkles" size={16} /> Admin Marketing Studio
                  </div>
                  <h1>Grow {brandName}</h1>
                  <p>
                    Share your showroom, promote products, create customer-ready
                    marketing material and keep every channel connected.
                  </p>
                </div>
              </div>

              <div className="hero-actions" style={{ marginTop: 22 }}>
                <button className="button button-gold" onClick={shareWebsite}>
                  <Icon name="share" size={18} /> Share Website
                </button>
                <button
                  className="button button-light"
                  onClick={() => copyText(websiteUrl, "Website link")}
                >
                  <Icon name={copied === "Website link" ? "check" : "copy"} size={18} />
                  {copied === "Website link" ? "Copied" : "Copy Link"}
                </button>
                <button
                  className="button button-light"
                  onClick={() => void loadDashboard(true)}
                  disabled={refreshing}
                >
                  <Icon name="refresh" size={18} />
                  {refreshing ? "Refreshing" : "Refresh"}
                </button>
              </div>
            </div>

            <div className="stats">
              <div className="stat">
                <strong>{products.length}</strong>
                <span>Products Ready</span>
              </div>
              <div className="stat">
                <strong>{configuredCount}/8</strong>
                <span>Brand Details</span>
              </div>
              <div className="stat">
                <strong>{branding.whatsapp_number ? "ON" : "SET"}</strong>
                <span>WhatsApp</span>
              </div>
              <div className="stat">
                <strong>{websiteUrl ? "LIVE" : "—"}</strong>
                <span>Website Link</span>
              </div>
            </div>
          </div>
        </section>

        {errorMessage && <div className="error">{errorMessage}</div>}

        <section className="section">
          <div className="section-heading">
            <div>
              <h2>Main Marketing Tools</h2>
              <p>Fast customer-sharing and promotion actions.</p>
            </div>
          </div>

          <div className="tool-grid">
            <ToolCard
              icon="share"
              title="Share Website Link"
              description="Open your phone share menu and send the NEW CITY STYLE website through any installed app."
              actionLabel="Share Website"
              onAction={shareWebsite}
            />
            <ToolCard
              icon={copied === "Website link" ? "check" : "copy"}
              title="Copy Website Link"
              description="Copy the live store address for messages, bios, advertisements and customer replies."
              actionLabel={copied === "Website link" ? "Link Copied" : "Copy Website Link"}
              onAction={() => copyText(websiteUrl, "Website link")}
            />
            <ToolCard
              icon="whatsapp"
              title="Share through WhatsApp"
              description="Send the showroom website with your brand name and tagline through WhatsApp."
              actionLabel="Open WhatsApp"
              onAction={shareWebsiteWhatsApp}
            />
            <ToolCard
              icon="coupon"
              title="Create Discount Coupon"
              description="Open the existing Admin Coupons page and create a new offer for your campaign."
              actionLabel="Manage Coupons"
              href="/admin/coupons"
            />
            <ToolCard
              icon="post"
              title="Social Media & Sales Posts"
              description="Prepare a reusable caption for Instagram, Facebook, WhatsApp Status and other channels."
              actionLabel="Prepare Post"
              onAction={() =>
                document.getElementById("social-post-studio")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            />
            <ToolCard
              icon="product"
              title="Share Product with Customer"
              description="Choose a product from Supabase and share its name, price and direct product page link."
              actionLabel="Choose Product"
              onAction={() =>
                document.getElementById("product-sharing")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            />
            <ToolCard
              icon="catalog"
              title="Product Catalog PDF"
              description="Generate a premium printable catalog from the current products in your Supabase products table."
              actionLabel="Generate Catalog"
              onAction={generateCatalogPdf}
              disabled={!products.length}
            />
            <ToolCard
              icon="qr"
              title="Printable Store QR Code"
              description="Create an A4 store QR poster that customers can scan to open your online showroom."
              actionLabel="Print QR Poster"
              onAction={printStoreQr}
            />
            <ToolCard
              icon="card"
              title="Digital Business Card"
              description="Download a shareable NEW CITY STYLE digital business card with contact and website details."
              actionLabel="Download Card"
              onAction={downloadBusinessCard}
            />
            <ToolCard
              icon="instagram"
              title="Instagram Sharing"
              description="Copy a ready caption and open the Instagram profile configured in Branding Settings."
              actionLabel="Prepare Instagram"
              onAction={prepareInstagramPost}
            />
            <ToolCard
              icon="facebook"
              title="Facebook Sharing"
              description="Open Facebook sharing for the selected product or your main website."
              actionLabel="Share on Facebook"
              onAction={shareToFacebook}
            />
            <ToolCard
              icon="youtube"
              title="YouTube Channel"
              description="Open the YouTube URL saved in Branding Settings to manage or share your channel."
              actionLabel="Open YouTube"
              onAction={() =>
                openUrl(
                  branding.youtube_url || "",
                  "YouTube URL is not configured in Branding Settings."
                )
              }
            />
            <ToolCard
              icon="twitter"
              title="X / Twitter Sharing"
              description="Create an X post with the selected product or your website link."
              actionLabel="Post on X"
              onAction={shareToTwitter}
            />
          </div>
        </section>

        <section className="section" id="product-sharing">
          <div className="section-heading">
            <div>
              <h2>Product Sharing Studio</h2>
              <p>Products load directly from the existing Supabase products table.</p>
            </div>
          </div>

          <div className="panel-grid two">
            <div className="panel">
              <h3>Select a Product</h3>
              <div className="panel-sub">
                Share a direct customer-ready product link in seconds.
              </div>

              <div className="field">
                <label htmlFor="product-select">Product</label>
                <select
                  id="product-select"
                  className="input"
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                  disabled={productsLoading || !products.length}
                >
                  {!products.length && (
                    <option value="">
                      {productsLoading ? "Loading products..." : "No products found"}
                    </option>
                  )}
                  {products.map((product) => (
                    <option key={String(product.id)} value={String(product.id)}>
                      {productName(product)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div className="product-preview">
                  {productImage(selectedProduct) ? (
                    <img
                      src={productImage(selectedProduct)}
                      alt={productName(selectedProduct)}
                    />
                  ) : (
                    <div className="product-placeholder">NO IMAGE</div>
                  )}
                  <div>
                    <strong>{productName(selectedProduct)}</strong>
                    {productPrice(selectedProduct) > 0 && (
                      <span>
                        ₹{productPrice(selectedProduct).toLocaleString("en-IN")}
                      </span>
                    )}
                    <small
                      style={{
                        display: "block",
                        marginTop: 6,
                        color: "#747985",
                        wordBreak: "break-all",
                      }}
                    >
                      {selectedProductUrl}
                    </small>
                  </div>
                </div>
              )}

              <div className="actions">
                <button
                  className="button button-blue"
                  onClick={shareSelectedProduct}
                  disabled={!selectedProduct}
                >
                  <Icon name="share" size={18} /> Share Product
                </button>
                <button
                  className="button button-outline"
                  onClick={shareProductWhatsApp}
                  disabled={!selectedProduct}
                >
                  <Icon name="whatsapp" size={18} /> WhatsApp
                </button>
                <button
                  className="button button-outline"
                  onClick={() => copyText(productShareText(), "Product link")}
                  disabled={!selectedProduct}
                >
                  <Icon
                    name={copied === "Product link" ? "check" : "copy"}
                    size={18}
                  />
                  {copied === "Product link" ? "Copied" : "Copy Details"}
                </button>
              </div>
            </div>

            <div className="panel">
              <h3>Catalog Generator</h3>
              <div className="panel-sub">
                Create a premium catalog from up to 120 currently visible products.
              </div>
              <div
                style={{
                  padding: 18,
                  borderRadius: 17,
                  background: `linear-gradient(145deg, ${primary}, #061b43)`,
                  color: WHITE,
                  marginBottom: 15,
                }}
              >
                <div
                  style={{
                    color: secondary,
                    fontWeight: 900,
                    fontSize: 12,
                    letterSpacing: ".1em",
                  }}
                >
                  PREMIUM PRODUCT CATALOG
                </div>
                <div
                  style={{
                    marginTop: 9,
                    fontFamily: `${branding.font_heading || "Playfair Display"}, Georgia, serif`,
                    fontSize: 26,
                    fontWeight: 800,
                  }}
                >
                  {brandName}
                </div>
                <div style={{ opacity: 0.76, marginTop: 5 }}>{tagline}</div>
                <div style={{ marginTop: 24, fontSize: 13, opacity: 0.8 }}>
                  {products.length} products available
                </div>
              </div>
              <button
                className="button button-gold"
                style={{ width: "100%" }}
                onClick={generateCatalogPdf}
                disabled={!products.length}
              >
                <Icon name="catalog" size={19} /> Generate & Save as PDF
              </button>
              <div className="notice">
                The browser print screen opens automatically. Choose <b>Save as PDF</b>
                to download the catalog.
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="social-post-studio">
          <div className="section-heading">
            <div>
              <h2>WhatsApp & Social Marketing</h2>
              <p>Create polished messages using your saved brand settings.</p>
            </div>
          </div>

          <div className="panel-grid two">
            <div className="panel">
              <h3>WhatsApp Marketing</h3>
              <div className="panel-sub">
                Edit the campaign text and open WhatsApp with the website link attached.
              </div>
              <div className="field">
                <label htmlFor="whatsapp-message">Campaign Message</label>
                <textarea
                  id="whatsapp-message"
                  className="input"
                  value={marketingMessage}
                  maxLength={1200}
                  onChange={(event) => setMarketingMessage(event.target.value)}
                />
              </div>
              <div className="actions">
                <button
                  className="button button-blue"
                  onClick={sendWhatsAppMarketing}
                  disabled={!marketingMessage.trim()}
                >
                  <Icon name="whatsapp" size={18} /> Open WhatsApp
                </button>
                <button
                  className="button button-outline"
                  onClick={() =>
                    copyText(
                      `${marketingMessage.trim()}\n\n${websiteUrl}`,
                      "Marketing message"
                    )
                  }
                  disabled={!marketingMessage.trim()}
                >
                  <Icon
                    name={copied === "Marketing message" ? "check" : "copy"}
                    size={18}
                  />
                  {copied === "Marketing message" ? "Copied" : "Copy Message"}
                </button>
              </div>
            </div>

            <div className="panel">
              <h3>Social Media Post</h3>
              <div className="panel-sub">
                Keep one caption ready for Instagram, Facebook and sales posts.
              </div>
              <div className="field">
                <label htmlFor="social-caption">Post Caption</label>
                <textarea
                  id="social-caption"
                  className="input"
                  value={postCaption}
                  maxLength={1800}
                  onChange={(event) => setPostCaption(event.target.value)}
                />
              </div>
              <div className="actions">
                <button
                  className="button button-blue"
                  onClick={prepareInstagramPost}
                  disabled={!postCaption.trim()}
                >
                  <Icon name="instagram" size={18} /> Instagram
                </button>
                <button className="button button-outline" onClick={shareToFacebook}>
                  <Icon name="facebook" size={18} /> Facebook
                </button>
                <button className="button button-outline" onClick={shareToTwitter}>
                  <Icon name="twitter" size={18} /> X / Twitter
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <div>
              <h2>Store QR & Digital Card</h2>
              <p>Ready for your counter, carry bags, posters and customer chats.</p>
            </div>
          </div>

          <div className="panel-grid two">
            <div className="panel">
              <h3>Printable Store QR Code</h3>
              <div className="panel-sub">
                This QR always points to the current live website domain.
              </div>
              <div className="qr-preview">
                {qrImageUrl ? (
                  <img src={qrImageUrl} alt="NEW CITY STYLE website QR code" />
                ) : (
                  <div className="skeleton" style={{ width: 230, height: 230 }} />
                )}
              </div>
              <div className="actions">
                <button className="button button-blue" onClick={printStoreQr}>
                  <Icon name="qr" size={18} /> Print QR Poster
                </button>
                <button
                  className="button button-outline"
                  onClick={() => copyText(websiteUrl, "Website link")}
                >
                  <Icon name="copy" size={18} /> Copy QR Link
                </button>
              </div>
            </div>

            <div className="panel">
              <h3>Digital Business Card</h3>
              <div className="panel-sub">
                Includes your brand, phone, email and live website address.
              </div>
              <div
                style={{
                  borderRadius: 19,
                  padding: 21,
                  background: `linear-gradient(145deg, ${primary}, #061b43)`,
                  color: WHITE,
                  border: `2px solid ${secondary}`,
                  marginBottom: 15,
                }}
              >
                <div
                  style={{
                    color: secondary,
                    fontFamily: `${branding.font_heading || "Playfair Display"}, Georgia, serif`,
                    fontSize: 25,
                    fontWeight: 900,
                  }}
                >
                  {brandName}
                </div>
                <div style={{ opacity: 0.8, marginTop: 4, marginBottom: 18 }}>
                  {tagline}
                </div>
                {branding.store_phone && (
                  <div style={{ marginTop: 9, display: "flex", gap: 8 }}>
                    <Icon name="phone" size={16} /> {branding.store_phone}
                  </div>
                )}
                {branding.store_email && (
                  <div style={{ marginTop: 9, display: "flex", gap: 8 }}>
                    <Icon name="mail" size={16} /> {branding.store_email}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 9,
                    display: "flex",
                    gap: 8,
                    wordBreak: "break-all",
                  }}
                >
                  <Icon name="link" size={16} /> {websiteUrl}
                </div>
              </div>
              <button
                className="button button-gold"
                style={{ width: "100%" }}
                onClick={downloadBusinessCard}
              >
                <Icon name="download" size={18} /> Download Digital Card
              </button>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <div>
              <h2>Connected Social Channels</h2>
              <p>These links are loaded from the existing Branding Settings record.</p>
            </div>
          </div>

          <div className="panel">
            <div className="social-grid">
              <SocialCard
                icon="instagram"
                name="Instagram"
                url={branding.instagram_url}
                onClick={() =>
                  openUrl(
                    branding.instagram_url || "",
                    "Instagram URL is not configured in Branding Settings."
                  )
                }
              />
              <SocialCard
                icon="facebook"
                name="Facebook"
                url={branding.facebook_url}
                onClick={() =>
                  openUrl(
                    branding.facebook_url || "",
                    "Facebook URL is not configured in Branding Settings."
                  )
                }
              />
              <SocialCard
                icon="youtube"
                name="YouTube"
                url={branding.youtube_url}
                onClick={() =>
                  openUrl(
                    branding.youtube_url || "",
                    "YouTube URL is not configured in Branding Settings."
                  )
                }
              />
              <SocialCard
                icon="twitter"
                name="X / Twitter"
                url={branding.twitter_url}
                onClick={() =>
                  openUrl(
                    branding.twitter_url || "",
                    "X / Twitter URL is not configured in Branding Settings."
                  )
                }
              />
            </div>
          </div>
        </section>

        <section className="section">
          <div className="panel-grid two">
            <div className="panel">
              <h3>Marketing Setup Status</h3>
              <div className="panel-sub">
                Complete missing details from the Admin Branding page.
              </div>
              <div className="setup-list">
                <SetupRow label="Official Logo" value={branding.logo_url} />
                <SetupRow label="Store Phone" value={branding.store_phone} />
                <SetupRow label="WhatsApp Number" value={branding.whatsapp_number} />
                <SetupRow label="Store Email" value={branding.store_email} />
                <SetupRow label="Instagram URL" value={branding.instagram_url} />
                <SetupRow label="Facebook URL" value={branding.facebook_url} />
                <SetupRow label="YouTube URL" value={branding.youtube_url} />
                <SetupRow label="X / Twitter URL" value={branding.twitter_url} />
              </div>
              <Link
                href="/admin/branding"
                className="button button-soft"
                style={{ marginTop: 15 }}
              >
                Update Branding Settings <Icon name="external" size={17} />
              </Link>
            </div>

            <div className="panel">
              <h3>Website Information</h3>
              <div className="panel-sub">
                The website URL is detected from the current live domain.
              </div>
              <div className="field">
                <label>Live Website URL</label>
                <div
                  className="input"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    wordBreak: "break-all",
                    background: "#f8f9fc",
                  }}
                >
                  {websiteUrl || "Detecting website URL..."}
                </div>
              </div>
              <div className="actions">
                <button
                  className="button button-blue"
                  onClick={() => openUrl(websiteUrl, "Website URL is not available.")}
                >
                  <Icon name="external" size={18} /> Open Website
                </button>
                <button
                  className="button button-outline"
                  onClick={() => copyText(websiteUrl, "Website link")}
                >
                  <Icon name="copy" size={18} /> Copy Link
                </button>
              </div>
              <div className="notice">
                Your uploaded Branding page uses the <b>branding_settings</b> table.
                It does not contain a separate website URL column, so this page uses
                the active website domain automatically.
              </div>
            </div>
          </div>
        </section>

        {loading && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(246,247,251,.78)",
              backdropFilter: "blur(4px)",
              display: "grid",
              placeItems: "center",
              zIndex: 50,
            }}
          >
            <div
              style={{
                background: WHITE,
                border: "1px solid #e4e8ef",
                borderRadius: 18,
                padding: "22px 26px",
                boxShadow: "0 20px 60px rgba(10,46,115,.16)",
                color: primary,
                fontWeight: 900,
              }}
            >
              Loading Marketing Studio...
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function ToolCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  href,
  disabled = false,
}: {
  icon: IconName;
  title: string;
  description: string;
  actionLabel: string;
  onAction?: () => void | Promise<void>;
  href?: string;
  disabled?: boolean;
}) {
  return (
    <article className="tool-card">
      <div className="tool-top">
        <div className="tool-icon">
          <Icon name={icon} size={23} />
        </div>
        <div className="tool-badge">Marketing</div>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {href ? (
        <Link className="button button-soft" href={href}>
          {actionLabel} <Icon name="external" size={16} />
        </Link>
      ) : (
        <button
          className="button button-soft"
          onClick={() => void onAction?.()}
          disabled={disabled}
        >
          {actionLabel}
        </button>
      )}
    </article>
  );
}

function SocialCard({
  icon,
  name,
  url,
  onClick,
}: {
  icon: IconName;
  name: string;
  url: string | null;
  onClick: () => void;
}) {
  return (
    <button className="social-card" onClick={onClick} type="button">
      <div className="social-icon">
        <Icon name={icon} size={20} />
      </div>
      <div style={{ textAlign: "left" }}>
        <strong>{name}</strong>
        <span>{url || "Not configured"}</span>
      </div>
    </button>
  );
}

function SetupRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const configured = Boolean(value && value.trim());
  return (
    <div className="setup-row">
      <span>
        <Icon name={configured ? "check" : "link"} size={17} /> {label}
      </span>
      <strong className={configured ? "status-ok" : "status-missing"}>
        {configured ? "CONFIGURED" : "MISSING"}
      </strong>
    </div>
  );
}
