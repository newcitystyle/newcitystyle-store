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

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedImage, setSelectedImage] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const [addingToCart, setAddingToCart] = useState(false);
  const [addingToWishlist, setAddingToWishlist] = useState(false);
  const [activeDetailsTab, setActiveDetailsTab] = useState<
    "details" | "specifications" | "faq" | "lifestyle" | "shipping" | "reviews"
  >("details");

  const imageAreaRef = useRef<HTMLDivElement | null>(null);

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
      const images = parseImages(loadedProduct);

      setProduct(loadedProduct);
      setSelectedImage(images[0] || "");
      setSelectedSize("");
      setSelectedColor("");
      setQuantity(1);
    } catch (error) {
      console.error("Load product error:", error);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }

  const images = useMemo(
    () => (product ? parseImages(product) : []),
    [product]
  );

  const sizes = useMemo(() => {
    if (!product) return [];

    const directSizes = parseListField(product.sizes);

    return directSizes.length > 0
      ? directSizes
      : parseVariationValues(product, "Size", []);
  }, [product]);

  const colors = useMemo(() => {
    if (!product) return [];

    const directColors = parseListField(product.colors);

    if (directColors.length > 0) return directColors;

    const colorValues = parseVariationValues(product, "Color", []);
    return colorValues.length > 0
      ? colorValues
      : parseVariationValues(product, "Colour", []);
  }, [product]);

  const tags = useMemo(
    () => (product ? parseListField(product.tags) : []),
    [product]
  );

  useEffect(() => {
    if (selectedSize && !sizes.includes(selectedSize)) {
      setSelectedSize("");
    }
  }, [sizes, selectedSize]);

  useEffect(() => {
    if (selectedColor && !colors.includes(selectedColor)) {
      setSelectedColor("");
    }
  }, [colors, selectedColor]);

  const price = Number(product?.price ?? 0);
  const mrp = Number(product?.mrp ?? price + 200);
  const savings = Math.max(mrp - price, 0);
  const calculatedDiscount =
    mrp > price && mrp > 0
      ? Math.round(((mrp - price) / mrp) * 100)
      : 0;
  const savedDiscount = Math.max(0, Number(product?.discount_percent ?? 0));
  const discount = savedDiscount > 0 ? savedDiscount : calculatedDiscount;
  const stock = Number(product?.stock ?? 0);
  const isNewArrival = isEnabled(product?.is_new_arrival);
  const isFeatured = isEnabled(product?.is_featured);
  const isOnSale = isEnabled(product?.is_on_sale) || discount > 0;

  async function addToCart(goToCart = true): Promise<boolean> {
    if (!product || addingToCart) return false;

    if (sizes.length > 0 && !selectedSize) {
      alert("Please select a size");
      return false;
    }

    if (colors.length > 0 && !selectedColor) {
      alert("Please select a colour");
      return false;
    }

    setAddingToCart(true);

    try {
      const user = await getCurrentUser();

      if (!user) {
        alert("Please Login First");
        router.push("/login");
        return false;
      }

      const { data: existingItem } = await supabase
        .from("cart")
        .select("*")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .eq("size", selectedSize)
        .eq("color", selectedColor)
        .maybeSingle();

      if (existingItem) {
        const { error } = await supabase
          .from("cart")
          .update({
            quantity: Number(existingItem.quantity || 0) + quantity,
          })
          .eq("id", existingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("cart").insert({
          user_id: user.id,
          product_id: product.id,
          name: getProductName(product),
          image: selectedImage || images[0] || "",
          price,
          quantity,
          size: selectedSize,
          color: selectedColor,
        });

        if (error) throw error;
      }

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

    setAddingToWishlist(true);

    try {
      const user = await getCurrentUser();

      if (!user) {
        alert("Please Login First");
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("wishlist")
        .select("*")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .maybeSingle();

      if (data) {
        alert("Product Already in Wishlist ❤️");
        return;
      }

      const { error } = await supabase.from("wishlist").insert({
        user_id: user.id,
        product_id: product.id,
        name: getProductName(product),
        image: selectedImage || images[0] || "",
        price,
      });

      if (error) throw error;

      alert("Added To Wishlist ❤️");
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
    const shareData = {
      title: getProductName(product || ({} as Product)),
      text: `Check out ${getProductName(
        product || ({} as Product)
      )} on NEW CITY STYLE`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Product link copied.");
      }
    } catch {
      // User cancelled share.
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

        <style jsx>{`
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

        <style jsx>{`
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
    { label: "Selected Color", value: selectedColor || "—" },
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
                {images.length > 0 ? (
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
                      onClick={() => setSelectedSize(size)}
                      aria-pressed={selectedSize === size}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {colors.length > 0 && (
              <div className="choiceSection">
                <h3>Select Color</h3>

                <div className="choiceGrid">
                  {colors.map((color) => (
                    <button
                      type="button"
                      key={color}
                      className={
                        selectedColor === color ? "choiceActive" : ""
                      }
                      onClick={() => setSelectedColor(color)}
                      aria-pressed={selectedColor === color}
                    >
                      {color}
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
                      Math.min(Math.max(stock, 1), current + 1)
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
                <span>Stock Available</span>
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
                disabled={addingToCart || stock <= 0}
              >
                {addingToCart ? "Adding..." : "🛒 Add to Cart"}
              </button>

              <button
                type="button"
                className="buyButton"
                onClick={buyNow}
                disabled={addingToCart || stock <= 0}
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
