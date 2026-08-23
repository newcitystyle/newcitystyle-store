"use client";

import {
  MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProductReviews from "@/components/ProductReviews";
type Product = {
  id: string | number;
  name?: string | null;
  product_name?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  material?: string | null;
  gender?: string | null;
  tags?: string[] | string | null;
  sizes?: string[] | string | null;
  colors?: string[] | string | null;
  is_new_arrival?: boolean | string | number | null;
  is_featured?: boolean | string | number | null;
  is_on_sale?: boolean | string | number | null;
  discount_percent?: number | string | null;
  price?: number | string | null;
  mrp?: number | string | null;
  stock?: number | string | null;
  image?: string | null;
  image_url?: string | null;
  images?: string[] | string | null;
  key_features?: string[] | null;
  technical_specifications?:
    | Array<{ label?: string; value?: string }>
    | null;
  variations?:
    | Array<{ name?: string; values?: string[] | string }>
    | null;
  shipping_returns?: string | null;
  faqs?: unknown;
  faq?: unknown;
  faq_items?: unknown;
  faq_questions?: unknown;
  faq_answers?: unknown;
  lifestyle_images?: unknown;
  lifestyle_gallery?: unknown;
  lifestyle_title?: string | null;
  lifestyle_subtitle?: string | null;
  [key: string]: unknown;
};

type ProductDesignUnit = {
  id: number;
  productId: number;
  parentVariantId: number | null;
  parentBarcode: string;
  designName: string;
  imageUrl: string;
  status: "available" | "sold_out" | "hidden";
  sortOrder: number;
};

type ProductVariantRef = {
  id: number;
  size: string;
  barcode: string;
  stock: number;
  onlineStockLimit: number | null;
  sellOnline: boolean | null;
};

type ProductDesignVariantLink = {
  id: number;
  designUnitId: number;
  variantId: number;
  status: "available" | "sold_out" | "hidden";
  mrp: number | null;
  onlinePrice: number | null;
  onlineQuantity: number | null;
};

function getProductName(product: Product) {
  return (
    product.name ||
    product.product_name ||
    product.title ||
    "Premium Product"
  );
}

function parseImages(product: Product) {
  const urls: string[] = [];

  if (Array.isArray(product.images)) {
    urls.push(...product.images.filter(Boolean));
  } else if (typeof product.images === "string" && product.images.trim()) {
    try {
      const parsed = JSON.parse(product.images);

      if (Array.isArray(parsed)) {
        urls.push(...parsed.filter(Boolean));
      } else {
        urls.push(product.images);
      }
    } catch {
      urls.push(product.images);
    }
  }

  if (product.image_url && !urls.includes(product.image_url)) {
    urls.unshift(product.image_url);
  }

  if (product.image && !urls.includes(product.image)) {
    urls.unshift(product.image);
  }

  return urls.filter(Boolean);
}

function parseListField(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value !== "string" || !value.trim()) return [];

  const trimmed = value.trim();

  try {
    const parsed = JSON.parse(trimmed);

    if (Array.isArray(parsed)) {
      return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    }
  } catch {
    // The field may be stored as a comma-separated string.
  }

  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isEnabled(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
  }

  return false;
}

function parseVariationValues(
  product: Product,
  variationName: string,
  fallback: string[]
) {
  const variations = Array.isArray(product.variations)
    ? product.variations
    : [];

  const found = variations.find(
    (item) =>
      String(item.name || "").toLowerCase() === variationName.toLowerCase()
  );

  if (!found) return fallback;

  if (Array.isArray(found.values)) {
    return found.values.map(String).filter(Boolean);
  }

  if (typeof found.values === "string") {
    return found.values
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return fallback;
}


type FaqItem = {
  question: string;
  answer: string;
};

type LifestyleItem = {
  image: string;
  title?: string;
  subtitle?: string;
};

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function firstText(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function normalizeFaqItem(value: unknown): FaqItem | null {
  const parsed = parseJsonValue(value);

  if (Array.isArray(parsed)) {
    if (parsed.length >= 2) {
      const question = String(parsed[0] ?? "").trim();
      const answer = String(parsed[1] ?? "").trim();
      return question && answer ? { question, answer } : null;
    }
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;

  const item = parsed as Record<string, unknown>;
  const question = firstText(item, [
    "question",
    "faq_question",
    "q",
    "title",
    "name",
  ]);
  const answer = firstText(item, [
    "answer",
    "faq_answer",
    "a",
    "description",
    "value",
    "content",
  ]);

  return question && answer ? { question, answer } : null;
}

function parseFaqs(product: Product): FaqItem[] {
  const collected: FaqItem[] = [];
  const seen = new Set<string>();

  const add = (item: FaqItem | null) => {
    if (!item) return;
    const key = `${item.question.toLowerCase()}::${item.answer.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      collected.push(item);
    }
  };

  const addCollection = (value: unknown) => {
    const parsed = parseJsonValue(value);

    if (Array.isArray(parsed)) {
      parsed.forEach((item) => add(normalizeFaqItem(item)));
      return;
    }

    if (parsed && typeof parsed === "object") {
      const objectValue = parsed as Record<string, unknown>;
      const nested =
        objectValue.items ?? objectValue.faqs ?? objectValue.questions ?? null;

      if (nested) {
        addCollection(nested);
      } else {
        add(normalizeFaqItem(objectValue));
      }
    }
  };

  addCollection(product.faqs);
  addCollection(product.faq);
  addCollection(product.faq_items);

  const questionList = parseListField(product.faq_questions);
  const answerList = parseListField(product.faq_answers);
  questionList.forEach((question, index) => {
    const answer = answerList[index] || "";
    add(question && answer ? { question, answer } : null);
  });

  const record = product as Record<string, unknown>;
  for (let index = 1; index <= 20; index += 1) {
    const question = firstText(record, [
      `faq_${index}_question`,
      `faq_question_${index}`,
      `faq${index}_question`,
      `question_${index}`,
      `question${index}`,
    ]);
    const answer = firstText(record, [
      `faq_${index}_answer`,
      `faq_answer_${index}`,
      `faq${index}_answer`,
      `answer_${index}`,
      `answer${index}`,
    ]);
    add(question && answer ? { question, answer } : null);
  }

  Object.entries(record).forEach(([key, value]) => {
    const match = key.match(/^faq[_-]?(\d+)$/i);
    if (match) add(normalizeFaqItem(value));
  });

  return collected;
}

function parseLifestyleItems(product: Product): LifestyleItem[] {
  const source = parseJsonValue(
    product.lifestyle_gallery ?? product.lifestyle_images
  );
  const items: LifestyleItem[] = [];

  const add = (value: unknown) => {
    const parsed = parseJsonValue(value);

    if (typeof parsed === "string" && parsed.trim()) {
      items.push({ image: parsed.trim() });
      return;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;

    const item = parsed as Record<string, unknown>;
    const image = firstText(item, ["image", "image_url", "url", "src"]);
    if (!image) return;

    items.push({
      image,
      title: firstText(item, ["title", "heading", "name"]),
      subtitle: firstText(item, ["subtitle", "description", "caption"]),
    });
  };

  if (Array.isArray(source)) source.forEach(add);
  else if (source && typeof source === "object") {
    const objectSource = source as Record<string, unknown>;
    const nested = objectSource.items ?? objectSource.images ?? objectSource.gallery;
    if (Array.isArray(nested)) nested.forEach(add);
    else add(source);
  } else add(source);

  return items;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

type StoredVisitAttribution = {
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

function createAnalyticsId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function getAnalyticsVisitorId() {
  const storageKey = "ncs_visitor_id";

  let visitorId = localStorage.getItem(storageKey);

  if (!visitorId) {
    visitorId = createAnalyticsId("visitor");
    localStorage.setItem(storageKey, visitorId);
  }

  return visitorId;
}

function getAnalyticsSessionId() {
  const storageKey = "ncs_session_id";

  let sessionId = sessionStorage.getItem(storageKey);

  if (!sessionId) {
    sessionId = createAnalyticsId("session");
    sessionStorage.setItem(storageKey, sessionId);
  }

  return sessionId;
}

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

  if (
    userAgent.includes("OPR/") ||
    userAgent.includes("Opera")
  ) {
    return "Opera";
  }

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

function readStoredVisitAttribution(): StoredVisitAttribution {
  try {
    const raw =
      sessionStorage.getItem(
        "ncs_visit_attribution"
      );

    if (!raw) {
      return {};
    }

    const parsed =
      JSON.parse(
        raw
      ) as StoredVisitAttribution;

    return parsed || {};
  } catch {
    return {};
  }
}

async function trackProductAnalyticsEvent(
  eventType: "product_view" | "add_to_cart",
  product: Product,
  options?: {
    quantity?: number;
    size?: string;
    designUnitId?: number | null;
    designName?: string | null;
    action?: string;
  }
) {
  try {
    const attribution =
      readStoredVisitAttribution();

    const numericProductId =
      Number(product.id);

    const productId =
      Number.isFinite(numericProductId) &&
      numericProductId > 0
        ? numericProductId
        : null;

    const eventValue =
      Number(product.price ?? 0);

    const { error } =
      await supabase
        .from("website_visits")
        .insert({
          visitor_id:
            getAnalyticsVisitorId(),
          session_id:
            getAnalyticsSessionId(),
          page_path:
            window.location.pathname,
          page_title:
            document.title || "",
          referrer:
            document.referrer || "",
          device_type:
            getAnalyticsDeviceType(),
          browser:
            getAnalyticsBrowserName(),
          visited_at:
            new Date().toISOString(),

          source:
            attribution.source ||
            "direct",
          medium:
            attribution.medium ||
            "none",
          campaign:
            attribution.campaign ||
            "",
          utm_content:
            attribution.utmContent ||
            "",
          utm_term:
            attribution.utmTerm ||
            "",
          fbclid:
            attribution.fbclid ||
            "",

          event_type:
            eventType,
          product_id:
            productId,
          event_value:
            Number.isFinite(eventValue)
              ? eventValue
              : 0,

          metadata: {
            product_name:
              getProductName(product),
            brand:
              product.brand || "",
            category:
              product.category || "",
            subcategory:
              product.subcategory || "",
            quantity:
              options?.quantity ?? 1,
            size:
              options?.size || "",
            design_unit_id:
              options?.designUnitId ?? null,
            design_name:
              options?.designName || "",
            action:
              options?.action || "",
            landing_url:
              attribution.landingUrl || "",
            landing_path:
              attribution.landingPath || "",
            current_url:
              window.location.href,
          },
        });

    if (error) {
      console.error(
        `${eventType} analytics error:`,
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

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedImage, setSelectedImage] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [designUnits, setDesignUnits] = useState<ProductDesignUnit[]>([]);
  const [variantRefs, setVariantRefs] = useState<ProductVariantRef[]>([]);
  const [designVariantLinks, setDesignVariantLinks] = useState<ProductDesignVariantLink[]>([]);
  const [selectedDesignId, setSelectedDesignId] = useState<number | null>(null);
  const [openedDesignId, setOpenedDesignId] = useState<number | null>(null);

  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const [addingToCart, setAddingToCart] = useState(false);
  const [addingToWishlist, setAddingToWishlist] = useState(false);
  const [activeDetailsTab, setActiveDetailsTab] = useState<
    "details" | "specifications" | "faq" | "lifestyle" | "shipping" | "reviews"
  >("details");

  const imageAreaRef = useRef<HTMLDivElement | null>(null);

  const trackedProductViewRef =
    useRef<string>("");

  useEffect(() => {
    loadProduct();
  }, [params.id]);

  async function getCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  }

  async function loadProduct() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) throw error;

      const loadedProduct = data as Product;
      const parentImages = parseImages(loadedProduct);

      const [
        { data: variantData, error: variantError },
        { data: designData, error: designError },
        { data: designLinkData, error: designLinkError },
      ] = await Promise.all([
        supabase.from("product_variants").select("id,size,barcode,stock,online_stock_limit,sell_online").eq("product_id", params.id).order("id", { ascending: true }),
        supabase.from("product_design_units").select("id,product_id,parent_variant_id,parent_barcode,design_name,image_url,status,sort_order").eq("product_id", params.id).neq("status", "hidden").order("sort_order", { ascending: true }).order("id", { ascending: true }),
        supabase.from("product_design_unit_variants").select("id,design_unit_id,variant_id,status,mrp,online_price,online_quantity").eq("product_id", params.id).neq("status", "hidden").order("id", { ascending: true }),
      ]);

      if (variantError) {
        console.info("Unable to load product variant references:", variantError.message);
      }

      if (designError) {
        console.info("Unable to load individual design photos:", designError.message);
      }

      if (designLinkError) {
        console.info("Unable to load design/size links:", designLinkError.message);
      }

      const cleanVariantRefs = ((variantData || []) as Record<string, unknown>[]).map(
        (row) => ({
          id: Number(row.id || 0),
          size: typeof row.size === "string" ? row.size.trim() : "",
          barcode: typeof row.barcode === "string" ? row.barcode.trim() : "",
          stock: Math.max(0, Number(row.stock || 0)),
          onlineStockLimit:
            row.online_stock_limit === null || row.online_stock_limit === undefined
              ? null
              : Math.max(0, Number(row.online_stock_limit || 0)),
          sellOnline:
            typeof row.sell_online === "boolean"
              ? row.sell_online
              : null,
        })
      );

      const cleanDesignUnits: ProductDesignUnit[] = (
        (designData || []) as Record<string, unknown>[]
      )
        .map((row): ProductDesignUnit => {
          const status: ProductDesignUnit["status"] =
            row.status === "sold_out"
              ? "sold_out"
              : row.status === "hidden"
                ? "hidden"
                : "available";

          return {
            id: Number(row.id || 0),
            productId: Number(row.product_id || 0),
            parentVariantId:
              Number(row.parent_variant_id || 0) > 0
                ? Number(row.parent_variant_id)
                : null,
            parentBarcode:
              typeof row.parent_barcode === "string"
                ? row.parent_barcode.trim()
                : "",
            designName:
              typeof row.design_name === "string" && row.design_name.trim()
                ? row.design_name.trim()
                : "Design",
            imageUrl:
              typeof row.image_url === "string"
                ? row.image_url.trim()
                : "",
            status,
            sortOrder: Math.max(0, Number(row.sort_order || 0)),
          };
        })
        .filter((unit) => unit.id > 0 && unit.imageUrl);

      const cleanDesignVariantLinks: ProductDesignVariantLink[] = designLinkError
        ? cleanDesignUnits
            .filter((unit) => unit.parentVariantId)
            .map((unit, index) => ({
              id: -(index + 1),
              designUnitId: unit.id,
              variantId: Number(unit.parentVariantId),
              status: unit.status === "sold_out" ? "sold_out" : "available",
              mrp: null,
              onlinePrice: null,
              onlineQuantity: unit.status === "sold_out" ? 0 : 1,
            }))
        : ((designLinkData || []) as Record<string, unknown>[]).map(
            (row): ProductDesignVariantLink => ({
              id: Number(row.id || 0),
              designUnitId: Number(row.design_unit_id || 0),
              variantId: Number(row.variant_id || 0),
              status:
                row.status === "sold_out"
                  ? "sold_out"
                  : row.status === "hidden"
                    ? "hidden"
                    : "available",
              mrp:
                row.mrp === null || row.mrp === undefined
                  ? null
                  : Number(row.mrp || 0),
              onlinePrice:
                row.online_price === null || row.online_price === undefined
                  ? null
                  : Number(row.online_price || 0),
              onlineQuantity:
                row.online_quantity === null || row.online_quantity === undefined
                  ? null
                  : Number(row.online_quantity || 0),
            })
          );

      const loadTimeAvailableLinks = cleanDesignVariantLinks.filter((link) => {
        if (
          link.status !== "available" ||
          !(link.onlineQuantity === null || link.onlineQuantity > 0)
        ) {
          return false;
        }

        const variant = cleanVariantRefs.find(
          (item) => item.id === link.variantId
        );

        // NEW CITY STYLE legacy-safe rule:
        // physical stock > 0 keeps the size/design eligible.
        // Old variant sell_online=false and online_stock_limit=0 values are
        // not treated as sold-out because many older products use them.
        return Boolean(variant && variant.stock > 0);
      });

      const designIdsWithAvailableSize = new Set(
        loadTimeAvailableLinks.map((link) => link.designUnitId)
      );

      const availableDesignUnits = cleanDesignUnits.filter(
        (unit) =>
          unit.status !== "hidden" &&
          designIdsWithAvailableSize.has(unit.id)
      );

      setProduct(loadedProduct);
      setVariantRefs(cleanVariantRefs);
      setDesignUnits(cleanDesignUnits);
      setDesignVariantLinks(cleanDesignVariantLinks);

      if (availableDesignUnits.length > 0) {
        /*
         * Storefront design cards open this page with:
         * /product/<productId>?design=<designUnitId>
         *
         * Read that design id here and select the exact design that the
         * customer clicked. If the URL is missing/invalid/sold-out, safely
         * fall back to the first available design.
         */
        const requestedDesignId =
          typeof window !== "undefined"
            ? Number(
                new URLSearchParams(window.location.search).get("design") || 0
              )
            : 0;

        const requestedDesign =
          requestedDesignId > 0
            ? availableDesignUnits.find(
                (unit) => unit.id === requestedDesignId
              ) || null
            : null;

        // When the customer opens an exact design card (?design=ID),
        // keep this page focused on that one available design only.
        setOpenedDesignId(requestedDesign?.id || null);

        const initialDesign = requestedDesign || availableDesignUnits[0];

        const firstAvailableLink = loadTimeAvailableLinks.find(
          (link) => link.designUnitId === initialDesign.id
        );

        const firstVariant = cleanVariantRefs.find(
          (variant) => variant.id === firstAvailableLink?.variantId
        );

        setSelectedImage(initialDesign.imageUrl);
        setSelectedDesignId(initialDesign.id);
        setSelectedSize(firstVariant?.size || "");
      } else {
        setSelectedImage(parentImages[0] || "");
        setSelectedDesignId(null);
        setSelectedSize("");
        setOpenedDesignId(null);
      }

      setQuantity(1);

      const productViewKey =
        `${loadedProduct.id}|${window.location.search}`;

      if (
        trackedProductViewRef.current !==
        productViewKey
      ) {
        trackedProductViewRef.current =
          productViewKey;

        const requestedDesignForTracking =
          typeof window !== "undefined"
            ? Number(
                new URLSearchParams(
                  window.location.search
                ).get("design") || 0
              )
            : 0;

        const trackedDesign =
          requestedDesignForTracking > 0
            ? cleanDesignUnits.find(
                (unit) =>
                  unit.id ===
                  requestedDesignForTracking
              ) || null
            : availableDesignUnits[0] || null;

        void trackProductAnalyticsEvent(
          "product_view",
          loadedProduct,
          {
            quantity: 1,
            size:
              trackedDesign
                ? cleanVariantRefs.find(
                    (variant) =>
                      variant.id ===
                      cleanDesignVariantLinks.find(
                        (link) =>
                          link.designUnitId ===
                            trackedDesign.id &&
                          link.status ===
                            "available"
                      )?.variantId
                  )?.size || ""
                : "",
            designUnitId:
              trackedDesign?.id ?? null,
            designName:
              trackedDesign?.designName || "",
            action:
              "product_page_open",
          }
        );
      }
    } catch (error) {
      console.error("Load product error:", error);
      setProduct(null);
      setVariantRefs([]);
      setDesignUnits([]);
      setDesignVariantLinks([]);
      setSelectedDesignId(null);
      setOpenedDesignId(null);
    } finally {
      setLoading(false);
    }
  }

  const parentImages = useMemo(
    () => (product ? parseImages(product) : []),
    [product]
  );

  const designMode = designUnits.length > 0;
  const availableDesignVariantLinks = useMemo(
    () =>
      designVariantLinks.filter((link) => {
        if (
          link.status !== "available" ||
          !(link.onlineQuantity === null || link.onlineQuantity > 0)
        ) {
          return false;
        }

        const variant = variantRefs.find(
          (item) => item.id === link.variantId
        );

        // IMPORTANT LEGACY-SAFE RULE:
        // A size disappears only when its real physical stock reaches 0,
        // or when this exact design+size link itself is sold_out / qty 0.
        // Do NOT hide old variants merely because variant.sell_online=false
        // or variant.online_stock_limit=0; older NCS rows legitimately have
        // those values while the parent product is still selling online.
        return Boolean(variant && variant.stock > 0);
      }),
    [designVariantLinks, variantRefs]
  );
  const designIdsWithAvailableSize = useMemo(() => new Set(availableDesignVariantLinks.map((link) => link.designUnitId)), [availableDesignVariantLinks]);
  const availableDesignUnits = useMemo(() => designUnits.filter((unit) => unit.status !== "hidden" && designIdsWithAvailableSize.has(unit.id)), [designUnits, designIdsWithAvailableSize]);

  const storefrontDesignUnits = useMemo(() => {
    if (!designMode) return [];

    const available = availableDesignUnits.filter(
      (unit) => unit.status === "available"
    );

    if (openedDesignId) {
      const exact = available.find((unit) => unit.id === openedDesignId);
      return exact ? [exact] : available;
    }

    return available;
  }, [designMode, availableDesignUnits, openedDesignId]);

  const images = useMemo(
    () =>
      designMode
        ? storefrontDesignUnits.map((unit) => unit.imageUrl)
        : parentImages,
    [designMode, storefrontDesignUnits, parentImages]
  );
  const legacySizes = useMemo(() => { if (!product) return []; const directSizes = parseListField(product.sizes); return directSizes.length > 0 ? directSizes : parseVariationValues(product, "Size", []); }, [product]);
  const selectedDesign = useMemo(() => designUnits.find((unit) => unit.id === selectedDesignId) || null, [designUnits, selectedDesignId]);
  const selectedDesignLinks = useMemo(() => selectedDesignId ? designVariantLinks.filter((link) => link.designUnitId === selectedDesignId && link.status !== "hidden") : [], [designVariantLinks, selectedDesignId]);
  const selectedDesignAvailableLinks = useMemo(
    () =>
      selectedDesignId
        ? availableDesignVariantLinks.filter(
            (link) => link.designUnitId === selectedDesignId
          )
        : [],
    [availableDesignVariantLinks, selectedDesignId]
  );

  const sizes = useMemo(() => {
    if (!designMode) return legacySizes;

    return Array.from(
      new Set(
        selectedDesignAvailableLinks
          .map(
            (link) =>
              variantRefs.find(
                (variant) => variant.id === link.variantId
              )?.size || ""
          )
          .filter(Boolean)
      )
    );
  }, [
    designMode,
    legacySizes,
    selectedDesignAvailableLinks,
    variantRefs,
  ]);
  const tags = useMemo(() => (product ? parseListField(product.tags) : []), [product]);

  useEffect(() => {
    if (designMode) {
      if (!sizes.length) { setSelectedSize(""); return; }
      if (!selectedSize || !sizes.includes(selectedSize)) setSelectedSize(sizes[0]);
      return;
    }
    if (selectedSize && !sizes.includes(selectedSize)) setSelectedSize("");
  }, [designMode, sizes, selectedSize]);

  const visibleDesignUnits = storefrontDesignUnits;
  const availableStock = useMemo(() => !designMode ? Number(product?.stock ?? 0) : availableDesignUnits.length, [designMode, product?.stock, availableDesignUnits]);

  function designHasAvailableSize(designUnitId: number) { return availableDesignVariantLinks.some((link) => link.designUnitId === designUnitId); }
  function isSelectedDesignSizeAvailable() {
    if (!designMode || !selectedDesignId || !selectedSize) return !designMode;
    const variant = variantRefs.find((item) => item.size === selectedSize);
    if (!variant) return false;
    return availableDesignVariantLinks.some((link) => link.designUnitId === selectedDesignId && link.variantId === variant.id);
  }

  const selectedVariantForPrice = useMemo(() => {
    if (!designMode || !selectedDesignId || !selectedSize) return null;
    return variantRefs.find((variant) => variant.size === selectedSize) || null;
  }, [designMode, selectedDesignId, selectedSize, variantRefs]);

  const selectedDesignPriceLink = useMemo(() => {
    if (!selectedDesignId || !selectedVariantForPrice) return null;

    return (
      designVariantLinks.find(
        (link) =>
          link.designUnitId === selectedDesignId &&
          link.variantId === selectedVariantForPrice.id &&
          link.status === "available"
      ) || null
    );
  }, [designVariantLinks, selectedDesignId, selectedVariantForPrice]);

  const parentPrice = Number(product?.price ?? 0);
  const parentMrp = Number(product?.mrp ?? parentPrice + 200);

  const price =
    selectedDesignPriceLink?.onlinePrice &&
    selectedDesignPriceLink.onlinePrice > 0
      ? selectedDesignPriceLink.onlinePrice
      : parentPrice;

  const mrp =
    selectedDesignPriceLink?.mrp &&
    selectedDesignPriceLink.mrp > 0
      ? Math.max(selectedDesignPriceLink.mrp, price)
      : Math.max(parentMrp, price);

  const savings = Math.max(mrp - price, 0);
  const calculatedDiscount =
    mrp > price && mrp > 0
      ? Math.round(((mrp - price) / mrp) * 100)
      : 0;
  const savedDiscount = Math.max(0, Number(product?.discount_percent ?? 0));
  const discount = savedDiscount > 0 ? savedDiscount : calculatedDiscount;
  const stock = availableStock;
  const isNewArrival = isEnabled(product?.is_new_arrival);
  const isFeatured = isEnabled(product?.is_featured);
  const isOnSale = isEnabled(product?.is_on_sale) || discount > 0;

  function selectDesign(unitId: number) {
    const unit = designUnits.find((item) => item.id === unitId);
    if (!unit || !designHasAvailableSize(unit.id)) return;
    const firstAvailableLink = availableDesignVariantLinks.find((link) => link.designUnitId === unit.id);
    const firstVariant = variantRefs.find((variant) => variant.id === firstAvailableLink?.variantId);
    setSelectedDesignId(unit.id); setSelectedImage(unit.imageUrl); setSelectedSize(firstVariant?.size || ""); setQuantity(1);
  }

  function selectSize(size: string) {
    if (designMode) {
      const variant = variantRefs.find((item) => item.size === size);
      const allowed = variant && selectedDesignId && availableDesignVariantLinks.some((link) => link.designUnitId === selectedDesignId && link.variantId === variant.id);
      if (!allowed) return;
    }
    setSelectedSize(size); setQuantity(1);
  }

  function getSelectedDesignVariantForCart() {
    if (!designMode || !selectedDesignId || !selectedSize) return null;

    const variant = variantRefs.find(
      (item) => item.size === selectedSize
    );
    if (!variant) return null;

    const link = availableDesignVariantLinks.find(
      (item) =>
        item.designUnitId === selectedDesignId &&
        item.variantId === variant.id
    );
    if (!link) return null;

    return variant;
  }

  async function addToCart(goToCart = true): Promise<boolean> {
    if (!product || addingToCart) return false;

    if (sizes.length > 0 && !selectedSize) {
      alert("Please select a size");
      return false;
    }

    if (designMode) {
      const selectedDesignForCart = selectedDesign;

      if (!selectedDesignForCart) {
        alert("Please select the design you want.");
        return false;
      }

      if (!designHasAvailableSize(selectedDesignForCart.id)) {
        alert("This design is sold out. Please choose another design.");
        return false;
      }

      if (!isSelectedDesignSizeAvailable()) {
        alert("This size is not available for the selected design.");
        return false;
      }
    }

    setAddingToCart(true);

    try {
      const user = await getCurrentUser();

      if (!user) {
        alert("Please Login First");
        router.push("/login");
        return false;
      }

      const selectedCartVariant = getSelectedDesignVariantForCart();

      if (designMode && !selectedCartVariant) {
        throw new Error(
          "The selected design and size are no longer available. Please select again."
        );
      }

      let existingItemQuery = supabase
        .from("cart")
        .select("*")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .eq("size", selectedSize)
        .eq("image", selectedImage || images[0] || "");

      if (designMode && selectedDesignId) {
        existingItemQuery = existingItemQuery.eq(
          "design_unit_id",
          selectedDesignId
        );
      }

      const { data: existingItem } = await existingItemQuery
        .limit(1)
        .maybeSingle();

      if (existingItem) {
        const { error } = await supabase
          .from("cart")
          .update({
            quantity: designMode
              ? 1
              : Number(existingItem.quantity || 0) + quantity,
          })
          .eq("id", existingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("cart").insert({
          user_id: user.id,
          product_id: product.id,
          name:
            designMode && selectedDesign?.designName
              ? `${getProductName(product)} — ${selectedDesign.designName}`
              : getProductName(product),
          image: selectedImage || images[0] || "",
          price,
          quantity,
          size: selectedSize,
          color: null,
          design_unit_id:
            designMode && selectedDesignId
              ? selectedDesignId
              : null,
          variant_id:
            designMode && selectedCartVariant
              ? selectedCartVariant.id
              : null,
          barcode:
            designMode && selectedCartVariant
              ? selectedCartVariant.barcode || null
              : null,
        });

        if (error) throw error;
      }

      await trackProductAnalyticsEvent(
        "add_to_cart",
        product,
        {
          quantity:
            designMode ? 1 : quantity,
          size:
            selectedSize,
          designUnitId:
            designMode
              ? selectedDesignId
              : null,
          designName:
            designMode
              ? selectedDesign?.designName || ""
              : "",
          action:
            goToCart
              ? "add_to_cart"
              : "buy_now",
        }
      );

      if (goToCart) {
        alert("Product Added To Cart");
        router.push("/cart");
      }

      return true;
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to add product to cart."
      );
      return false;
    } finally {
      setAddingToCart(false);
    }
  }

  async function buyNow() {
    const added = await addToCart(false);

    if (added) {
      router.push("/checkout");
    }
  }

  async function addToWishlist() {
    if (!product || addingToWishlist) return;

    if (designMode && !selectedDesign) {
      alert("Please select the design you want.");
      return;
    }

    if (sizes.length > 0 && !selectedSize) {
      alert("Please select a size");
      return;
    }

    setAddingToWishlist(true);

    try {
      const user = await getCurrentUser();

      if (!user) {
        alert("Please Login First");
        router.push("/login");
        return;
      }

      const wishlistImage = selectedImage || images[0] || "";
      const wishlistName =
        designMode && selectedDesign?.designName
          ? `${getProductName(product)} — ${selectedDesign.designName}`
          : getProductName(product);

      /*
       * IMPORTANT:
       * Wishlist uniqueness is per selected design image, not only product_id.
       * This lets one parent product save multiple design photos separately
       * without changing the existing wishlist table schema.
       */
      const { data: existingItems, error: existingError } = await supabase
        .from("wishlist")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .eq("image", wishlistImage)
        .limit(1);

      if (existingError) throw existingError;

      if ((existingItems || []).length > 0) {
        alert(
          designMode
            ? "This design is already in your Wishlist ❤️"
            : "Product Already in Wishlist ❤️"
        );
        return;
      }

      const { error } = await supabase.from("wishlist").insert({
        user_id: user.id,
        product_id: product.id,
        name: wishlistName,
        image: wishlistImage,
        price,
      });

      if (error) throw error;

      alert(
        designMode && selectedDesign?.designName
          ? `${selectedDesign.designName} added to Wishlist ❤️`
          : "Added To Wishlist ❤️"
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to add product to wishlist."
      );
    } finally {
      setAddingToWishlist(false);
    }
  }

  async function shareProduct() {
    if (!product) return;

    const productTitle = getProductName(product);
    const imageUrl = selectedImage || images[0] || "";

    /*
     * Build the EXACT product/design URL.
     *
     * Even if the customer changed the design after opening the page,
     * the shared link should reopen that selected design directly.
     */
    const shareUrl = new URL(window.location.href);

    if (designMode && selectedDesignId) {
      shareUrl.searchParams.set("design", String(selectedDesignId));
    }

    const productUrl = shareUrl.toString();

    const selectedShareTitle =
      designMode && selectedDesign?.designName
        ? `${productTitle} — ${selectedDesign.designName}`
        : productTitle;

    /*
     * IMPORTANT:
     * Put the clickable website URL INSIDE the share text too.
     *
     * Some apps (especially WhatsApp when sharing an actual image file)
     * may ignore the separate `url` field. Keeping the URL in `text`
     * ensures the customer receives:
     *
     * 1. Product image
     * 2. Product/design name
     * 3. NEW CITY STYLE
     * 4. Clickable website link
     */
    const shareCaption =
      `${selectedShareTitle}
` +
      `NEW CITY STYLE
` +
      `View Product: ${productUrl}`;

    try {
      /*
       * BEST MOBILE EXPERIENCE:
       * Share the actual selected product photo as a file,
       * together with the clickable exact product/design link.
       */
      if (
        navigator.share &&
        typeof navigator.canShare === "function" &&
        imageUrl
      ) {
        try {
          const imageResponse = await fetch(imageUrl, {
            cache: "no-store",
            mode: "cors",
          });

          if (imageResponse.ok) {
            const imageBlob = await imageResponse.blob();
            const mimeType = imageBlob.type || "image/jpeg";

            const extension =
              mimeType.includes("png")
                ? "png"
                : mimeType.includes("webp")
                  ? "webp"
                  : "jpg";

            const safeProductName =
              selectedShareTitle
                .replace(/[^a-z0-9]+/gi, "-")
                .replace(/^-+|-+$/g, "")
                .toLowerCase() || "new-city-style-product";

            const imageFile = new File(
              [imageBlob],
              `${safeProductName}.${extension}`,
              { type: mimeType }
            );

            if (navigator.canShare({ files: [imageFile] })) {
              await navigator.share({
                title: selectedShareTitle,
                text: shareCaption,
                url: productUrl,
                files: [imageFile],
              });
              return;
            }
          }
        } catch (imageShareError) {
          console.info(
            "Direct photo share unavailable; using link preview fallback.",
            imageShareError
          );
        }
      }

      /*
       * FALLBACK:
       * Share caption + exact product URL.
       * This also allows WhatsApp/Facebook to build a normal link preview.
       */
      if (navigator.share) {
        await navigator.share({
          title: selectedShareTitle,
          text: shareCaption,
          url: productUrl,
        });
        return;
      }

      /*
       * Desktop/unsupported-browser fallback:
       * copy the complete share message, not only the bare URL.
       */
      await navigator.clipboard.writeText(shareCaption);
      alert("Product photo link and website link copied.");
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      console.error("Share product error:", error);

      try {
        await navigator.clipboard.writeText(shareCaption);
        alert(
          "Unable to open share menu. Product name and website link copied."
        );
      } catch {
        alert("Unable to share this product right now.");
      }
    }
  }

  function handleZoomMove(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;

    setZoomPosition({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  }

  if (loading) {
    return (
      <main className="statePage">
        <div className="loader" />
        <h2>Loading product...</h2>

        <style>{`
          .statePage {
            min-height: 70vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #f8f4ec;
            color: #0a2e73;
          }

          .loader {
            width: 48px;
            height: 48px;
            margin-bottom: 18px;
            border: 4px solid #e3e8f2;
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

  if (!product) {
    return (
      <main className="statePage">
        <h2>Product Not Found</h2>

        <style>{`
          .statePage {
            min-height: 70vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8f4ec;
            color: #0a2e73;
          }
        `}</style>
      </main>
    );
  }

  const productName = getProductName(product);
  const highlights =
    Array.isArray(product.key_features) && product.key_features.length > 0
      ? product.key_features
      : [
          "Premium Quality Fabric",
          "Comfort Fit",
          "Skin Friendly Material",
          "Long Lasting Stitching",
          "Easy Wash",
        ];

  const storedSpecifications =
    Array.isArray(product.technical_specifications)
      ? product.technical_specifications
      : [];

  const productInformation = [
    { label: "Brand", value: product.brand || "NEW CITY STYLE" },
    { label: "Material", value: product.material || "Not specified" },
    { label: "Gender", value: product.gender || "Unisex" },
    { label: "Category", value: product.category || "Fashion" },
    { label: "Subcategory", value: product.subcategory || "—" },
    { label: "Selected Size", value: selectedSize || "—" },
    { label: "Stock", value: String(stock) },
  ];

  const specifications = [
    ...productInformation,
    ...storedSpecifications.filter((item) =>
      item?.label && item?.value
        ? !productInformation.some(
            (detail) =>
              detail.label.toLowerCase() ===
              String(item.label).toLowerCase()
          )
        : false
    ),
  ];

  const faqs = parseFaqs(product);
  const lifestyleItems = parseLifestyleItems(product);
  const shippingReturns =
    product.shipping_returns ||
    "Free delivery on eligible orders. Products can be returned within 7 days in original, unused condition with tags and packaging intact.";

  return (
    <main className="productPage">
      <div className="pageShell">
        <button
          type="button"
          className="backButton"
          onClick={() => router.back()}
        >
          ← Back
        </button>

        <section className="productHero">
          <div className="galleryColumn">
            <div className="galleryLayout">
              <div className="thumbnailRail">
                {designMode ? (
                  visibleDesignUnits.length > 0 ? (
                    visibleDesignUnits.map((unit, index) => (
                      <button
                        type="button"
                        key={`design-${unit.id}`}
                        className={`thumbnailButton designThumb ${
                          selectedDesignId === unit.id ? "thumbnailActive" : ""
                        }`}
                        onClick={() => selectDesign(unit.id)}
                        title={unit.designName}
                      >
                        <img
                          src={unit.imageUrl}
                          alt={unit.designName || `${productName} design ${index + 1}`}
                        />
                      </button>
                    ))
                  ) : (
                    <div className="thumbnailFallback">NCS</div>
                  )
                ) : images.length > 0 ? (
                  images.map((image, index) => (
                    <button
                      type="button"
                      key={`${image}-${index}`}
                      className={`thumbnailButton ${
                        selectedImage === image ? "thumbnailActive" : ""
                      }`}
                      onClick={() => setSelectedImage(image)}
                    >
                      <img
                        src={image}
                        alt={`${productName} ${index + 1}`}
                      />
                    </button>
                  ))
                ) : (
                  <div className="thumbnailFallback">NCS</div>
                )}
              </div>

              <div
                ref={imageAreaRef}
                className="mainImageFrame"
                onMouseEnter={() => setZoomVisible(true)}
                onMouseLeave={() => setZoomVisible(false)}
                onMouseMove={handleZoomMove}
                onClick={() => selectedImage && setFullscreenOpen(true)}
              >
                {selectedImage ? (
                  <>
                    <img
                      src={selectedImage}
                      alt={productName}
                      className="mainImage"
                    />

                    {zoomVisible && (
                      <div
                        className="zoomLens"
                        style={{
                          left: `${zoomPosition.x}%`,
                          top: `${zoomPosition.y}%`,
                        }}
                      />
                    )}
                  </>
                ) : (
                  <div className="mainImageFallback">NEW CITY STYLE</div>
                )}

                <div className="zoomHint">🔍 Hover to zoom • Click fullscreen</div>
              </div>

              {zoomVisible && selectedImage && (
                <div
                  className="zoomPreview"
                  style={{
                    backgroundImage: `url("${selectedImage}")`,
                    backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
                  }}
                />
              )}
            </div>
          </div>

          <div className="infoColumn">
            <div className="topBadges">
              <span className="premiumBadge">NEW CITY STYLE</span>
              {isNewArrival && <span className="newBadge">New Arrival</span>}
              {isFeatured && <span className="featuredBadge">Featured</span>}
              {isOnSale && <span className="saleBadge">On Sale</span>}
              {discount > 0 && (
                <span className="discountBadge">{discount}% OFF</span>
              )}
            </div>

            <h1>{productName}</h1>

            <div className="ratingRow">
              <span className="ratingBadge">★ 4.8</span>
              <span>125 Reviews</span>
              <span className="verified">Verified Product</span>
            </div>

            <div className="priceBlock">
              <strong>{formatCurrency(price)}</strong>

              {mrp > price && (
                <div>
                  <span>MRP</span>
                  <del>{formatCurrency(mrp)}</del>
                  <b>Save {formatCurrency(savings)}</b>
                </div>
              )}
            </div>

            <p className="taxText">Inclusive of all taxes</p>

            <p className="description">
              {product.description ||
                "Premium fashion selected for comfort, quality and timeless style."}
            </p>

            <div className="productMetaGrid">
              <div>
                <span>Brand</span>
                <strong>{product.brand || "NEW CITY STYLE"}</strong>
              </div>
              <div>
                <span>Material</span>
                <strong>{product.material || "Not specified"}</strong>
              </div>
              <div>
                <span>Gender</span>
                <strong>{product.gender || "Unisex"}</strong>
              </div>
            </div>

            {tags.length > 0 && (
              <div className="tagSection">
                <h3>Product Tags</h3>
                <div className="tagList">
                  {tags.map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {designMode && visibleDesignUnits.length > 1 && (
              <div className="designSection">
                <div className="choiceHeader">
                  <div>
                    <h3>Select Design</h3>
                    <p className="designHelp">
                      {availableDesignUnits.length} unique design{availableDesignUnits.length === 1 ? "" : "s"} available
                    </p>
                  </div>
                  {selectedDesign?.designName && (
                    <span className="selectedDesignName">
                      {selectedDesign.designName}
                    </span>
                  )}
                </div>

                <div className="designGrid">
                  {visibleDesignUnits.map((unit) => (
                    <button
                      type="button"
                      key={`design-card-${unit.id}`}
                      className={`designChoice ${
                        selectedDesignId === unit.id ? "designChoiceActive" : ""
                      }`}
                      onClick={() => selectDesign(unit.id)}
                    >
                      <img src={unit.imageUrl} alt={unit.designName} />
                      <span>{unit.designName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sizes.length > 0 && (
              <div className="choiceSection">
                <div className="choiceHeader">
                  <h3>Select Size</h3>
                  <button type="button">Size Guide</button>
                </div>

                <div className="choiceGrid">
                  {sizes.map((size) => (
                    <button
                      type="button"
                      key={size}
                      className={selectedSize === size ? "choiceActive" : ""}
                      onClick={() => selectSize(size)}
                      aria-pressed={selectedSize === size}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="quantitySection">
              <h3>Quantity</h3>

              <div className="quantityControl">
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) => Math.max(1, current - 1))
                  }
                  aria-label="Decrease quantity"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    focusable="false"
                  >
                    <path d="M5 12h14" />
                  </svg>
                </button>

                <strong>{quantity}</strong>

                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() =>
                    setQuantity((current) =>
                      designMode
                        ? 1
                        : Math.min(Math.max(stock, 1), current + 1)
                    )
                  }
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    focusable="false"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="stockCard">
              <div>
                <span>
                  {designMode ? "Unique Designs Available" : "Stock Available"}
                </span>
                <strong>{stock}</strong>
              </div>

              <div className="stockBar">
                <span
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(8, stock * 4)
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="primaryActions">
              <button
                type="button"
                className="cartButton"
                onClick={() => addToCart(true)}
                disabled={addingToCart || stock <= 0 || (designMode && !selectedDesign)}
              >
                {addingToCart ? "Adding..." : "🛒 Add to Cart"}
              </button>

              <button
                type="button"
                className="buyButton"
                onClick={buyNow}
                disabled={addingToCart || stock <= 0 || (designMode && !selectedDesign)}
              >
                ⚡ Buy Now
              </button>
            </div>

            <div className="secondaryActions">
              <button
                type="button"
                onClick={addToWishlist}
                disabled={addingToWishlist}
              >
                {addingToWishlist
                  ? "Adding..."
                  : "♡ Add to Wishlist"}
              </button>

              <button type="button" onClick={shareProduct}>
                ↗ Share Product
              </button>
            </div>

            <div className="deliveryCard">
              <h3>Delivery & Returns</h3>
              <div className="deliveryGrid">
                <div>
                  <span>🚚</span>
                  <p>
                    <strong>Free Delivery</strong>
                    <small>2–5 business days</small>
                  </p>
                </div>

                <div>
                  <span>↺</span>
                  <p>
                    <strong>Easy Returns</strong>
                    <small>7-day return policy</small>
                  </p>
                </div>

                <div>
                  <span>🔒</span>
                  <p>
                    <strong>Secure Payment</strong>
                    <small>Trusted checkout</small>
                  </p>
                </div>

                <div>
                  <span>✓</span>
                  <p>
                    <strong>Genuine Product</strong>
                    <small>Quality checked</small>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="detailsCard">
          <div className="detailsHeadingRow">
            <div>
              <span className="sectionEyebrow">NEW CITY STYLE</span>
              <h2>Product Information</h2>
            </div>

            <div className="detailsTabs" role="tablist" aria-label="Product information tabs">
              {[
                ["details", "Details"],
                ["specifications", "Specifications"],
                ["faq", `FAQ${faqs.length > 0 ? ` (${faqs.length})` : ""}`],
                ["lifestyle", "Lifestyle"],
                ["shipping", "Shipping & Returns"],
                ["reviews", "Reviews"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={activeDetailsTab === value}
                  className={activeDetailsTab === value ? "detailsTabActive" : ""}
                  onClick={() =>
                    setActiveDetailsTab(
                      value as
                        | "details"
                        | "specifications"
                        | "faq"
                        | "lifestyle"
                        | "shipping"
                        | "reviews"
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="tabPanel" role="tabpanel">
            {activeDetailsTab === "details" && (
              <div className="detailsGrid">
                <div>
                  <h3>Product Description</h3>
                  <p className="detailsDescription">
                    {product.description ||
                      "Premium product selected by NEW CITY STYLE."}
                  </p>
                </div>

                <div>
                  <h3>Highlights</h3>
                  <ul>
                    {highlights.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {activeDetailsTab === "specifications" && (
              <div>
                <h3>Technical Specifications</h3>
                <div className="specificationList">
                  {specifications.map((item, index) => (
                    <div key={`${item.label}-${index}`}>
                      <span>{item.label || "Specification"}</span>
                      <strong>{item.value || "—"}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeDetailsTab === "faq" && (
              <div className="faqList">
                <h3>Frequently Asked Questions</h3>
                {faqs.length > 0 ? (
                  faqs.map((item, index) => (
                    <details key={`${item.question}-${index}`} open={index === 0}>
                      <summary>
                        <span>{item.question}</span>
                        <b>+</b>
                      </summary>
                      <p>{item.answer}</p>
                    </details>
                  ))
                ) : (
                  <div className="emptyTabState">
                    <strong>No FAQs added for this product yet.</strong>
                    <span>Product questions and answers will appear here after they are saved in Admin.</span>
                  </div>
                )}
              </div>
            )}

            {activeDetailsTab === "lifestyle" && (
              <div>
                <div className="lifestyleHeader">
                  <h3>{product.lifestyle_title || "Style Inspiration"}</h3>
                  <p>
                    {product.lifestyle_subtitle ||
                      "Discover the premium look, feel and styling of this product."}
                  </p>
                </div>

                {lifestyleItems.length > 0 ? (
                  <div className="lifestyleGrid">
                    {lifestyleItems.map((item, index) => (
                      <article key={`${item.image}-${index}`}>
                        <img src={item.image} alt={item.title || `${productName} lifestyle ${index + 1}`} />
                        {(item.title || item.subtitle) && (
                          <div>
                            {item.title && <strong>{item.title}</strong>}
                            {item.subtitle && <span>{item.subtitle}</span>}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="emptyTabState">
                    <strong>Lifestyle gallery coming soon.</strong>
                    <span>Saved lifestyle images will appear here automatically.</span>
                  </div>
                )}
              </div>
            )}

            {activeDetailsTab === "shipping" && (
              <div className="shippingTabContent">
                <h3>Shipping & Returns</h3>
                <p>{shippingReturns}</p>
                <div className="shippingPoints">
                  <span>🚚 Fast delivery across India</span>
                  <span>↺ Easy 7-day returns</span>
                  <span>🔒 Secure checkout</span>
                  <span>✓ Quality checked before dispatch</span>
                </div>
              </div>
            )}

            {activeDetailsTab === "reviews" && (
              <ProductReviews
                productId={product.id}
                productName={getProductName(product)}
              />
            )}
          </div>
        </section>

        <section className="trustGrid">
          <article>
            <span>🚚</span>
            <h3>Fast Delivery</h3>
            <p>Free shipping across India with quick delivery.</p>
          </article>

          <article>
            <span>🔒</span>
            <h3>Secure Payment</h3>
            <p>100% secure payment with trusted payment gateways.</p>
          </article>

          <article>
            <span>💯</span>
            <h3>Quality Assurance</h3>
            <p>Every product is carefully checked before dispatch.</p>
          </article>
        </section>
      </div>

      {fullscreenOpen && selectedImage && (
        <div
          className="fullscreenOverlay"
          onClick={() => setFullscreenOpen(false)}
        >
          <button
            type="button"
            onClick={() => setFullscreenOpen(false)}
            aria-label="Close fullscreen image"
          >
            ×
          </button>

          <img
            src={selectedImage}
            alt={productName}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}

      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f8f4ec;
          color: #172033;
          font-family: Inter, Poppins, Arial, sans-serif;
        }

        button {
          font: inherit;
          -webkit-tap-highlight-color: transparent;
        }

        .productPage {
          min-height: 100vh;
          padding: 28px 20px 70px;
          background:
            radial-gradient(
              circle at top right,
              rgba(212, 175, 55, 0.11),
              transparent 28%
            ),
            #f8f4ec;
        }

        .pageShell {
          width: 100%;
          max-width: 1450px;
          margin: 0 auto;
        }

        .backButton {
          margin-bottom: 18px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #0a2e73;
          font-weight: 800;
          cursor: pointer;
        }

        .productHero {
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(430px, 0.92fr);
          gap: 36px;
          align-items: start;
        }

        .galleryColumn,
        .infoColumn,
        .detailsCard,
        .trustGrid article {
          border: 1px solid rgba(10, 46, 115, 0.08);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 42px rgba(16, 24, 40, 0.08);
        }

        .galleryColumn,
        .infoColumn {
          border-radius: 24px;
        }

        .galleryColumn {
          position: sticky;
          top: 24px;
          padding: 22px;
        }

        .galleryLayout {
          position: relative;
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: 16px;
        }

        .thumbnailRail {
          display: flex;
          flex-direction: column;
          gap: 11px;
          max-height: 720px;
          overflow-y: auto;
          padding-right: 3px;
        }

        .thumbnailButton {
          width: 82px;
          height: 92px;
          overflow: hidden;
          flex-shrink: 0;
          padding: 0;
          border: 2px solid transparent;
          border-radius: 13px;
          background: #f7f8fb;
          cursor: pointer;
          transition:
            transform 0.25s ease,
            border-color 0.25s ease,
            box-shadow 0.25s ease;
        }

        .thumbnailButton:hover {
          transform: translateY(-2px) scale(1.03);
          border-color: #d4af37;
        }

        .thumbnailActive {
          border-color: #d4af37;
          box-shadow: 0 8px 20px rgba(212, 175, 55, 0.25);
        }

        .thumbnailButton img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .thumbnailFallback {
          width: 82px;
          height: 92px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          background: #0a2e73;
          color: #d4af37;
          font-weight: 900;
        }

        .mainImageFrame {
          position: relative;
          min-height: 650px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 20px;
          background:
            linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.95),
              rgba(245, 247, 252, 0.96)
            );
          cursor: zoom-in;
        }

        .mainImage {
          width: 100%;
          height: 650px;
          display: block;
          object-fit: contain;
          transition:
            transform 0.35s ease,
            opacity 0.35s ease;
        }

        .mainImageFrame:hover .mainImage {
          transform: scale(1.025);
        }

        .mainImageFallback {
          color: #0a2e73;
          font-size: 22px;
          font-weight: 900;
        }

        .zoomLens {
          position: absolute;
          width: 150px;
          height: 150px;
          border: 2px solid rgba(212, 175, 55, 0.9);
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          box-shadow:
            0 0 0 9999px rgba(10, 46, 115, 0.03),
            0 8px 24px rgba(16, 24, 40, 0.15);
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .zoomHint {
          position: absolute;
          right: 14px;
          bottom: 14px;
          padding: 8px 11px;
          border-radius: 999px;
          background: rgba(10, 46, 115, 0.88);
          color: white;
          font-size: 11px;
          font-weight: 750;
          backdrop-filter: blur(8px);
        }

        .zoomPreview {
          position: absolute;
          z-index: 20;
          top: 0;
          left: calc(100% + 18px);
          width: min(520px, 48vw);
          height: 650px;
          border: 1px solid #d8dfed;
          border-radius: 20px;
          background-repeat: no-repeat;
          background-size: 220%;
          background-color: white;
          box-shadow: 0 20px 55px rgba(16, 24, 40, 0.22);
          pointer-events: none;
        }

        .infoColumn {
          padding: 28px;
        }

        .topBadges {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 17px;
        }

        .premiumBadge,
        .newBadge,
        .featuredBadge,
        .saleBadge,
        .discountBadge {
          display: inline-flex;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.8px;
        }

        .premiumBadge {
          background: #0a2e73;
          color: #d4af37;
        }

        .discountBadge {
          background: #ecfdf3;
          color: #067647;
        }

        .infoColumn h1 {
          margin: 0;
          color: #0a2e73;
          font-size: clamp(32px, 4vw, 49px);
          line-height: 1.08;
          letter-spacing: -1.1px;
        }

        .ratingRow {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 17px;
          color: #667085;
          font-size: 13px;
        }

        .ratingBadge {
          padding: 6px 10px;
          border-radius: 7px;
          background: #16a34a;
          color: white;
          font-weight: 850;
        }

        .verified {
          color: #067647;
          font-weight: 750;
        }

        .priceBlock {
          margin-top: 22px;
        }

        .priceBlock > strong {
          display: block;
          color: #d4af37;
          font-size: 44px;
          line-height: 1;
        }

        .priceBlock > div {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
          color: #667085;
          font-size: 14px;
        }

        .priceBlock b {
          color: #067647;
        }

        .taxText {
          margin: 8px 0 0;
          color: #067647;
          font-size: 12px;
          font-weight: 700;
        }

        .description {
          margin: 23px 0 0;
          color: #475467;
          font-size: 16px;
          line-height: 1.75;
        }

        .productMetaGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 20px;
        }

        .productMetaGrid > div {
          padding: 13px;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 12px;
          background: #f8f4ec;
        }

        .productMetaGrid span,
        .productMetaGrid strong {
          display: block;
        }

        .productMetaGrid span {
          color: #667085;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .productMetaGrid strong {
          margin-top: 5px;
          color: #0a2e73;
          font-size: 13px;
        }

        .tagSection {
          margin-top: 20px;
        }

        .tagSection h3 {
          margin: 0 0 10px;
          color: #0a2e73;
          font-size: 14px;
        }

        .tagList {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tagList span {
          padding: 7px 11px;
          border: 1px solid rgba(212, 175, 55, 0.5);
          border-radius: 999px;
          background: #fffdf5;
          color: #0a2e73;
          font-size: 12px;
          font-weight: 750;
        }

        .choiceSection,
        .quantitySection {
          margin-top: 27px;
        }

        .choiceSection h3,
        .quantitySection h3,
        .deliveryCard h3,
        .detailsCard h2,
        .detailsCard h3 {
          margin: 0;
          color: #0a2e73;
        }

        .choiceHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .choiceHeader button {
          border: 0;
          background: transparent;
          color: #d4af37;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .choiceGrid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 12px;
        }

        .choiceGrid button {
          min-width: 54px;
          min-height: 44px;
          padding: 0 15px;
          border: 1px solid #d0d5dd;
          border-radius: 11px;
          background: white;
          color: #344054;
          font-weight: 800;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            background 0.2s ease,
            color 0.2s ease;
        }

        .choiceGrid button:hover {
          transform: translateY(-2px);
          border-color: #0a2e73;
        }

        .choiceGrid .choiceActive {
          border-color: #0a2e73;
          background: #0a2e73;
          color: white;
          box-shadow: 0 8px 18px rgba(10, 46, 115, 0.2);
        }

        .designSection {
          margin-top: 27px;
        }

        .designHelp {
          margin: 4px 0 0;
          color: #667085;
          font-size: 12px;
        }

        .selectedDesignName {
          max-width: 55%;
          padding: 7px 10px;
          border-radius: 999px;
          background: #eef4ff;
          color: #0a2e73;
          font-size: 11px;
          font-weight: 800;
          text-align: right;
        }

        .designGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
          gap: 10px;
          margin-top: 12px;
        }

        .designChoice {
          position: relative;
          overflow: hidden;
          padding: 6px;
          border: 2px solid transparent;
          border-radius: 13px;
          background: #ffffff;
          color: #344054;
          cursor: pointer;
          text-align: left;
          box-shadow: 0 6px 18px rgba(16, 24, 40, 0.06);
        }

        .designChoice img {
          width: 100%;
          aspect-ratio: 1 / 1.12;
          object-fit: cover;
          display: block;
          border-radius: 9px;
        }

        .designChoice span {
          display: block;
          margin-top: 7px;
          font-size: 11px;
          font-weight: 800;
          line-height: 1.35;
        }

        .designChoiceActive {
          border-color: #d4af37;
          box-shadow: 0 9px 24px rgba(212, 175, 55, 0.24);
        }

        .designChoiceSoldOut,
        .thumbnailSoldOut {
          opacity: 0.48;
          cursor: not-allowed;
          filter: grayscale(0.35);
        }

        .designChoice b,
        .soldOutThumbLabel {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          padding: 5px 7px;
          border-radius: 999px;
          background: rgba(180, 35, 24, 0.92);
          color: #fff;
          font-size: 9px;
          font-weight: 900;
          white-space: nowrap;
        }

        .designThumb {
          position: relative;
        }

        .quantityControl {
          display: inline-grid;
          grid-template-columns: 46px 58px 46px;
          align-items: center;
          overflow: hidden;
          margin-top: 12px;
          border: 1px solid #d0d5dd;
          border-radius: 12px;
          background: white;
        }

        .quantityControl button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 46px;
          min-width: 46px;
          height: 46px;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: #ffffff;
          color: #0a2e73;
          cursor: pointer;
          opacity: 1;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        .quantityControl button svg {
          display: block;
          width: 23px;
          height: 23px;
          overflow: visible;
          fill: none;
          stroke: currentColor;
          stroke-width: 2.8;
          stroke-linecap: round;
          stroke-linejoin: round;
          pointer-events: none;
        }

        .quantityControl button:hover,
        .quantityControl button:focus-visible {
          background: #eef3ff;
          color: #0a2e73;
          outline: none;
        }

        .quantityControl button:active {
          background: #f8f4ec;
        }

        .quantityControl strong {
          color: #0a2e73;
          text-align: center;
          font-size: 16px;
          font-weight: 800;
          line-height: 1;
        }

        .stockCard {
          margin-top: 25px;
          padding: 15px;
          border: 1px solid #e4e7ec;
          border-radius: 13px;
          background: #f8fafc;
        }

        .stockCard > div:first-child {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #475467;
          font-size: 13px;
        }

        .stockCard strong {
          color: #0a2e73;
          font-size: 18px;
        }

        .stockBar {
          height: 7px;
          overflow: hidden;
          margin-top: 10px;
          border-radius: 999px;
          background: #e7ebf3;
        }

        .stockBar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #d4af37, #0a2e73);
        }

        .primaryActions,
        .secondaryActions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 22px;
        }

        .primaryActions button,
        .secondaryActions button {
          min-height: 55px;
          border-radius: 13px;
          font-size: 15px;
          font-weight: 850;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .primaryActions button:hover,
        .secondaryActions button:hover {
          transform: translateY(-2px);
        }

        .primaryActions button:disabled,
        .secondaryActions button:disabled {
          opacity: 0.58;
          cursor: not-allowed;
          transform: none;
        }

        .cartButton {
          border: 1px solid #0a2e73;
          background: linear-gradient(135deg, #0a2e73, #16499d);
          color: white;
          box-shadow: 0 12px 24px rgba(10, 46, 115, 0.2);
        }

        .buyButton {
          position: relative;
          overflow: hidden;
          border: 1px solid #d4af37;
          background: linear-gradient(135deg, #d4af37, #f1d26a);
          color: #0a2e73;
          box-shadow: 0 12px 24px rgba(212, 175, 55, 0.24);
        }

        .buyButton::after {
          position: absolute;
          top: -50%;
          left: -60%;
          width: 35%;
          height: 200%;
          content: "";
          background: rgba(255, 255, 255, 0.52);
          transform: rotate(25deg);
          animation: shine 3.2s infinite;
        }

        @keyframes shine {
          0% {
            left: -60%;
          }
          55%,
          100% {
            left: 130%;
          }
        }

        .secondaryActions button {
          border: 1px solid #b8c7e5;
          background: white;
          color: #0a2e73;
        }

        .deliveryCard {
          margin-top: 24px;
          padding: 20px;
          border: 1px solid #e4e7ec;
          border-radius: 16px;
          background: linear-gradient(180deg, #ffffff, #f8fafc);
        }

        .deliveryGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
          margin-top: 15px;
        }

        .deliveryGrid > div {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          border-radius: 11px;
          background: white;
        }

        .deliveryGrid > div > span {
          font-size: 21px;
        }

        .deliveryGrid p {
          margin: 0;
        }

        .deliveryGrid strong,
        .deliveryGrid small {
          display: block;
        }

        .deliveryGrid strong {
          color: #344054;
          font-size: 12px;
        }

        .deliveryGrid small {
          margin-top: 3px;
          color: #98a2b3;
          font-size: 10px;
        }

        .detailsCard {
          margin-top: 34px;
          padding: 32px;
          border-radius: 22px;
        }

        .detailsDescription {
          margin: 15px 0 0;
          color: #475467;
          font-size: 16px;
          line-height: 1.75;
        }

        .detailsGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 34px;
          margin-top: 28px;
        }

        .detailsGrid ul {
          margin: 14px 0 0;
          padding-left: 20px;
          color: #475467;
          line-height: 2;
        }

        .specificationList {
          overflow: hidden;
          margin-top: 14px;
          border: 1px solid #e4e7ec;
          border-radius: 13px;
        }

        .specificationList > div {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 16px;
          padding: 12px 14px;
          border-bottom: 1px solid #eaecf0;
        }

        .specificationList > div:last-child {
          border-bottom: 0;
        }

        .specificationList span {
          color: #667085;
        }

        .specificationList strong {
          color: #344054;
        }

        .detailsHeadingRow {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .sectionEyebrow {
          display: block;
          margin-bottom: 5px;
          color: #d4af37;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 1.4px;
        }

        .detailsTabs {
          display: flex;
          gap: 8px;
          max-width: 100%;
          padding-bottom: 3px;
          overflow-x: auto;
          scrollbar-width: thin;
        }

        .detailsTabs button {
          flex: 0 0 auto;
          min-height: 42px;
          padding: 0 16px;
          border: 1px solid rgba(10, 46, 115, 0.14);
          border-radius: 999px;
          background: #ffffff;
          color: #0a2e73;
          font-weight: 800;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .detailsTabs button:hover,
        .detailsTabs .detailsTabActive {
          border-color: #0a2e73;
          background: #0a2e73;
          color: #ffffff;
          box-shadow: 0 7px 18px rgba(10, 46, 115, 0.18);
        }

        .tabPanel {
          min-height: 220px;
          padding-top: 4px;
        }

        .faqList {
          max-width: 980px;
        }

        .faqList > h3,
        .shippingTabContent > h3,
        .lifestyleHeader h3 {
          margin: 0 0 16px;
          color: #0a2e73;
        }

        .faqList details {
          margin-bottom: 12px;
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.12);
          border-radius: 14px;
          background: #ffffff;
        }

        .faqList summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 17px 18px;
          color: #0a2e73;
          font-weight: 850;
          cursor: pointer;
          list-style: none;
        }

        .faqList summary::-webkit-details-marker {
          display: none;
        }

        .faqList summary b {
          color: #d4af37;
          font-size: 22px;
          transition: transform 0.2s ease;
        }

        .faqList details[open] summary b {
          transform: rotate(45deg);
        }

        .faqList details p {
          margin: 0;
          padding: 0 18px 18px;
          color: #586277;
          line-height: 1.75;
          white-space: pre-line;
        }

        .emptyTabState {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 26px;
          border: 1px dashed rgba(10, 46, 115, 0.24);
          border-radius: 16px;
          background: #f8f4ec;
          color: #586277;
        }

        .emptyTabState strong {
          color: #0a2e73;
        }

        .lifestyleHeader p,
        .shippingTabContent p {
          max-width: 900px;
          color: #586277;
          line-height: 1.75;
          white-space: pre-line;
        }

        .lifestyleGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 22px;
        }

        .lifestyleGrid article {
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 18px;
          background: #ffffff;
        }

        .lifestyleGrid img {
          display: block;
          width: 100%;
          height: 290px;
          object-fit: cover;
        }

        .lifestyleGrid article > div {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 14px;
        }

        .lifestyleGrid strong {
          color: #0a2e73;
        }

        .lifestyleGrid span {
          color: #697386;
          font-size: 14px;
        }

        .shippingPoints {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          max-width: 900px;
          margin-top: 22px;
        }

        .shippingPoints span {
          padding: 15px;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 13px;
          background: #f8f4ec;
          color: #0a2e73;
          font-weight: 750;
        }

        .trustGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          margin-top: 28px;
        }

        .trustGrid article {
          padding: 25px;
          border-radius: 18px;
          text-align: center;
          transition:
            transform 0.25s ease,
            box-shadow 0.25s ease;
        }

        .trustGrid article:hover {
          transform: translateY(-6px);
          box-shadow: 0 18px 40px rgba(16, 24, 40, 0.12);
        }

        .trustGrid span {
          font-size: 31px;
        }

        .trustGrid h3 {
          margin: 12px 0 8px;
          color: #0a2e73;
        }

        .trustGrid p {
          margin: 0;
          color: #667085;
          line-height: 1.55;
        }

        .fullscreenOverlay {
          position: fixed;
          z-index: 9999;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 35px;
          background: rgba(3, 12, 31, 0.94);
          backdrop-filter: blur(10px);
        }

        .fullscreenOverlay > button {
          position: absolute;
          top: 18px;
          right: 24px;
          width: 48px;
          height: 48px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-size: 30px;
          cursor: pointer;
        }

        .fullscreenOverlay img {
          max-width: 95vw;
          max-height: 92vh;
          object-fit: contain;
          border-radius: 18px;
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.55);
        }

        @media (max-width: 1200px) {
          .productHero {
            grid-template-columns: 1fr;
          }

          .galleryColumn {
            position: static;
          }

          .zoomPreview {
            display: none;
          }
        }

        @media (max-width: 760px) {
          .productPage {
            padding: 18px 10px 45px;
          }

          .galleryColumn,
          .infoColumn,
          .detailsCard {
            padding: 16px;
            border-radius: 17px;
          }

          .galleryLayout {
            grid-template-columns: 1fr;
          }

          .thumbnailRail {
            order: 2;
            flex-direction: row;
            max-height: none;
            overflow-x: auto;
            padding: 2px 0 4px;
          }

          .thumbnailButton,
          .thumbnailFallback {
            width: 72px;
            height: 80px;
          }

          .mainImageFrame {
            min-height: 430px;
          }

          .mainImage {
            height: 430px;
          }

          .zoomLens,
          .zoomHint {
            display: none;
          }

          .infoColumn h1 {
            font-size: 31px;
          }

          .priceBlock > strong {
            font-size: 36px;
          }

          .productMetaGrid,
          .primaryActions,
          .secondaryActions,
          .deliveryGrid,
          .detailsGrid,
          .trustGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 430px) {
          .mainImageFrame {
            min-height: 360px;
          }

          .mainImage {
            height: 360px;
          }

          .choiceGrid button {
            min-width: 48px;
            padding: 0 12px;
          }
        }
      `}</style>
    </main>
  );
}