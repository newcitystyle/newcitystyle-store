"use client";

import { CSSProperties, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Product = {
  id: number | string;
  name?: string | null;
  price?: number | string | null;
  mrp?: number | string | null;
  stock?: number | string | null;
  online_stock_limit?: number | string | null;
  image?: string | null;
  image_url?: string | null;
  sell_online?: boolean | null;
  is_active?: boolean | null;
  category?: string | null;
  subcategory?: string | null;
};

type DesignUnit = {
  id: number;
  product_id: number;
  parent_variant_id?: number | null;
  parent_barcode?: string | null;
  design_name?: string | null;
  image_url?: string | null;
  status?: string | null;
  sort_order?: number | null;
};

type DesignLink = {
  id: number;
  product_id: number;
  design_unit_id: number;
  variant_id: number;
  status?: string | null;
  mrp?: number | string | null;
  online_price?: number | string | null;
  online_quantity?: number | string | null;
};

type ProductVariant = {
  id: number;
  product_id: number;
  size?: string | null;
  stock?: number | string | null;
  online_stock_limit?: number | string | null;
  sell_online?: boolean | null;
};

type ProductCard = {
  key: string;
  productId: number | string;
  designId: number | null;
  slotNumber: number | null;
  name: string;
  designName: string;
  price: number;
  mrp: number;
  image: string;
  quantity: number;
  isDesign: boolean;
  isLegacySlot: boolean;
  availableSizes: string[];
};

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parentOnlineQuantity(product: Product) {
  const stock = Math.max(0, numberValue(product.stock));
  const onlineLimit = Math.max(0, numberValue(product.online_stock_limit));

  if (stock <= 0 || onlineLimit <= 0) return 0;

  return Math.min(stock, onlineLimit);
}

function variantAvailableQuantity(variant: ProductVariant) {
  const stock = Math.max(0, numberValue(variant.stock));
  if (stock <= 0) return 0;

  // Explicitly disabled variants must never be shown online.
  if (variant.sell_online === false) return 0;

  const onlineLimit = Math.max(0, numberValue(variant.online_stock_limit));

  // Legacy rows may not yet have their own online quantity.
  // In that case use physical variant stock, while the parent product
  // remains the online visibility gate.
  if (onlineLimit <= 0) return stock;

  return Math.min(stock, onlineLimit);
}

function cleanSize(value: unknown) {
  return String(value ?? "").trim();
}


function isLegacyShirtFamily(product: Product) {
  const text = [
    product.name,
    product.category,
    product.subcategory,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const isSetOrCombo =
    text.includes(" set") ||
    text.includes("combo") ||
    text.includes("shorts set") ||
    text.includes("t-shirt and shorts") ||
    text.includes("t shirt and shorts");

  if (isSetOrCombo) return false;

  return (
    text.includes("t-shirt") ||
    text.includes("t shirt") ||
    text.includes("tee shirt") ||
    /shirt/.test(text)
  );
}

export default function FeaturedProducts() {
  const router = useRouter();

  const [cards, setCards] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);

    try {
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select(
          `
            id,
            name,
            price,
            mrp,
            stock,
            online_stock_limit,
            image,
            image_url,
            sell_online,
            is_active,
            category,
            subcategory
          `
        )
        .eq("sell_online", true)
        .eq("is_active", true)
        .gt("stock", 0)
        .gt("online_stock_limit", 0)
        .gt("price", 0)
        .order("id", { ascending: false })
        .limit(80);

      if (productError) throw productError;

      const products = ((productData || []) as Product[]).filter(
        (product) =>
          product.sell_online === true &&
          product.is_active === true &&
          numberValue(product.price) > 0 &&
          parentOnlineQuantity(product) > 0
      );

      if (products.length === 0) {
        setCards([]);
        return;
      }

      const productIds = products
        .map((product) => Number(product.id))
        .filter((id) => Number.isFinite(id) && id > 0);

      const [designResponse, linkResponse, variantResponse] = await Promise.all([
        supabase
          .from("product_design_units")
          .select(
            `
              id,
              product_id,
              parent_variant_id,
              parent_barcode,
              design_name,
              image_url,
              status,
              sort_order
            `
          )
          .in("product_id", productIds)
          .neq("status", "hidden")
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true }),

        supabase
          .from("product_design_unit_variants")
          .select(
            `
              id,
              product_id,
              design_unit_id,
              variant_id,
              status,
              mrp,
              online_price,
              online_quantity
            `
          )
          .in("product_id", productIds)
          .neq("status", "hidden"),

        supabase
          .from("product_variants")
          .select(
            `
              id,
              product_id,
              size,
              stock,
              online_stock_limit,
              sell_online
            `
          )
          .in("product_id", productIds)
          .order("id", { ascending: true }),
      ]);

      if (designResponse.error) {
        console.error("Featured design units error:", designResponse.error);
      }

      if (linkResponse.error) {
        console.error("Featured design links error:", linkResponse.error);
      }

      if (variantResponse.error) {
        console.error("Featured variants error:", variantResponse.error);
      }

      const designUnits = (designResponse.data || []) as DesignUnit[];
      const designLinks = (linkResponse.data || []) as DesignLink[];
      const variants = (variantResponse.data || []) as ProductVariant[];

      const finalCards: ProductCard[] = [];

      for (const product of products) {
        const productId = Number(product.id);
        const productName = product.name?.trim() || "Premium Product";
        const parentImage =
          product.image_url?.trim() ||
          product.image?.trim() ||
          "";

        const price = numberValue(product.price);
        const mrp = Math.max(price, numberValue(product.mrp));

        const productVariants = variants.filter(
          (variant) =>
            Number(variant.product_id) === productId &&
            cleanSize(variant.size) &&
            variantAvailableQuantity(variant) > 0
        );

        const productDesigns = designUnits
          .filter(
            (design) =>
              Number(design.product_id) === productId &&
              design.status !== "hidden" &&
              design.status !== "sold_out" &&
              Boolean(design.image_url?.trim())
          )
          .sort((a, b) => {
            const orderA = numberValue(a.sort_order);
            const orderB = numberValue(b.sort_order);

            if (orderA !== orderB) return orderA - orderB;

            return Number(a.id) - Number(b.id);
          });

        const availableDesigns = productDesigns.filter((design) =>
          designLinks.some((link) => {
            if (
              Number(link.design_unit_id) !== Number(design.id) ||
              link.status !== "available" ||
              !(
                link.online_quantity === null ||
                link.online_quantity === undefined ||
                numberValue(link.online_quantity) > 0
              )
            ) {
              return false;
            }

            const linkedVariant = productVariants.find(
              (variant) => Number(variant.id) === Number(link.variant_id)
            );

            return Boolean(
              linkedVariant &&
                variantAvailableQuantity(linkedVariant) > 0
            );
          })
        );

        /*
         * =========================================================
         * 1. GENUINE DESIGN CARDS
         * =========================================================
         *
         * Every available product_design_unit is a separate storefront card.
         * One design can link to multiple sizes/barcodes.
         */
        const linkedVariantIdsForDesigns = new Set<number>();

        availableDesigns.forEach((design, index) => {
          const availableLinksForDesign = designLinks.filter((link) => {
            if (
              Number(link.design_unit_id) !== Number(design.id) ||
              link.status !== "available" ||
              !(
                link.online_quantity === null ||
                link.online_quantity === undefined ||
                numberValue(link.online_quantity) > 0
              )
            ) {
              return false;
            }

            const linkedVariant = productVariants.find(
              (variant) => Number(variant.id) === Number(link.variant_id)
            );

            return Boolean(
              linkedVariant &&
                variantAvailableQuantity(linkedVariant) > 0
            );
          });

          const linkedVariantIds = availableLinksForDesign.map(
            (link) => Number(link.variant_id)
          );

          linkedVariantIds.forEach((id) => linkedVariantIdsForDesigns.add(id));

          const sizes = productVariants
            .filter((variant) =>
              linkedVariantIds.includes(Number(variant.id))
            )
            .map((variant) => cleanSize(variant.size))
            .filter(Boolean);

          if (sizes.length === 0) {
            return;
          }

          const designOnlinePrices = availableLinksForDesign
            .map((link) => numberValue(link.online_price))
            .filter((value) => value > 0);

          const designMrps = availableLinksForDesign
            .map((link) => numberValue(link.mrp))
            .filter((value) => value > 0);

          const cardPrice =
            designOnlinePrices.length > 0
              ? Math.min(...designOnlinePrices)
              : price;

          const cardMrp =
            designMrps.length > 0
              ? Math.max(cardPrice, Math.min(...designMrps))
              : Math.max(cardPrice, mrp);

          finalCards.push({
            key: `product-${productId}-design-${design.id}`,
            productId: product.id,
            designId: Number(design.id),
            slotNumber: null,
            name: productName,
            designName:
              design.design_name?.trim() || `Design ${index + 1}`,
            price: cardPrice,
            mrp: cardMrp,
            image: design.image_url?.trim() || parentImage,
            quantity: 1,
            isDesign: true,
            isLegacySlot: false,
            availableSizes: Array.from(new Set(sizes)),
          });
        });

        /*
         * =========================================================
         * 2. LEFTOVER LEGACY SHIRT / T-SHIRT VARIANTS
         * =========================================================
         *
         * Important hybrid rule:
         *
         * - Designs already represented by product_design_units stay as
         *   genuine separate cards.
         * - Any remaining standalone SHIRT / T-SHIRT stock that is NOT linked
         *   to a design unit is converted into quantity slots.
         *
         * Example:
         *   5 genuine M-only design units
         *   + one old design whose remaining stock is M/L/XL
         *   => 5 design cards + 1 M/L/XL legacy card = 6 cards total.
         */
        const unlinkedVariants = productVariants.filter(
          (variant) => !linkedVariantIdsForDesigns.has(Number(variant.id))
        );

        if (isLegacyShirtFamily(product) && unlinkedVariants.length > 0) {
          const sizeQuantities = unlinkedVariants.map((variant) => ({
            size: cleanSize(variant.size),
            quantity: variantAvailableQuantity(variant),
          }));

          const maximumSlots = Math.max(
            0,
            ...sizeQuantities.map((item) => item.quantity)
          );

          if (maximumSlots > 0) {
            for (let slotIndex = 0; slotIndex < maximumSlots; slotIndex += 1) {
              const availableSizes = Array.from(
                new Set(
                  sizeQuantities
                    .filter((item) => item.quantity > slotIndex)
                    .map((item) => item.size)
                    .filter(Boolean)
                )
              );

              if (availableSizes.length === 0) continue;

              finalCards.push({
                key: `product-${productId}-slot-${slotIndex + 1}`,
                productId: product.id,
                designId: null,
                slotNumber: slotIndex + 1,
                name: productName,
                designName: "",
                price,
                mrp,
                image: parentImage,
                quantity: 1,
                isDesign: false,
                isLegacySlot: true,
                availableSizes,
              });
            }

            continue;
          }
        }

        /*
         * =========================================================
         * 3. NORMAL PRODUCT FALLBACK
         * =========================================================
         *
         * If genuine design cards already exist, do not add another duplicate
         * parent card. Otherwise show the ordinary product once.
         */
        if (availableDesigns.length > 0) {
          continue;
        }

        const quantity = parentOnlineQuantity(product);

        if (quantity <= 0) continue;

        finalCards.push({
          key: `product-${productId}`,
          productId: product.id,
          designId: null,
          slotNumber: null,
          name: productName,
          designName: "",
          price,
          mrp,
          image: parentImage,
          quantity,
          isDesign: false,
          isLegacySlot: false,
          availableSizes: [],
        });
      }

      // Final rule:
      // - Parent online quantity must be > 0.
      // - Every genuine available design unit becomes its own card.
      // - No card-count cap.
      setCards(finalCards);
    } catch (error) {
      console.error("Featured products load error:", error);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }

  function openProduct(item: ProductCard) {
    if (item.designId !== null) {
      router.push(`/product/${item.productId}?design=${item.designId}`);
      return;
    }

    if (item.slotNumber !== null) {
      router.push(`/product/${item.productId}?slot=${item.slotNumber}`);
      return;
    }

    router.push(`/product/${item.productId}`);
  }

  if (loading) {
    return (
      <section style={styles.section}>
        <div style={styles.heading}>
          <span style={styles.eyebrow}>NEW CITY STYLE</span>
          <h2 style={styles.title}>Featured Products</h2>
          <p style={styles.subtitle}>Loading premium fashion...</p>
        </div>
      </section>
    );
  }

  if (cards.length === 0) return null;

  return (
    <section style={styles.section}>
      <div style={styles.heading}>
        <span style={styles.eyebrow}>NEW CITY STYLE</span>

        <h2 style={styles.title}>Featured Products</h2>

        <p style={styles.subtitle}>
          Premium fashion selected for every member of the family.
        </p>
      </div>

      <div style={styles.grid}>
        {cards.map((item) => {
          const discount =
            item.mrp > item.price && item.mrp > 0
              ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
              : 0;

          return (
            <article
              key={item.key}
              style={styles.card}
              onClick={() => openProduct(item)}
            >
              <div style={styles.imageBox}>
                {item.image ? (
                  <img
                    src={item.image}
                    alt={
                      item.designName
                        ? `${item.name} - ${item.designName}`
                        : item.name
                    }
                    loading="lazy"
                    style={styles.image}
                  />
                ) : (
                  <div style={styles.fallback}>NEW CITY STYLE</div>
                )}

                <span style={styles.newBadge}>NEW</span>

                {discount > 0 && (
                  <span style={styles.discountBadge}>{discount}% OFF</span>
                )}

                {item.isLegacySlot && (
                  <span style={styles.slotBadge}>
                    {item.availableSizes.join(" • ")}
                  </span>
                )}
              </div>

              <div style={styles.content}>
                <h3 style={styles.name}>
                  {item.isDesign ? item.designName : item.name}
                </h3>

                {item.isDesign && (
                  <div style={styles.parentName}>{item.name}</div>
                )}

                {item.availableSizes.length > 0 && (
                  <div style={styles.sizesLine}>
                    Sizes: {item.availableSizes.join(" • ")}
                  </div>
                )}

                <div style={styles.priceRow}>
                  <strong style={styles.price}>
                    ₹{item.price.toLocaleString("en-IN")}
                  </strong>

                  {item.mrp > item.price && (
                    <del style={styles.mrp}>
                      ₹{item.mrp.toLocaleString("en-IN")}
                    </del>
                  )}
                </div>

                <div style={styles.stock}>
                  {item.isDesign || item.isLegacySlot
                    ? "Available online"
                    : `${item.quantity} available online`}
                </div>

                <button
                  type="button"
                  style={styles.button}
                  onClick={(event) => {
                    event.stopPropagation();
                    openProduct(item);
                  }}
                >
                  View Product
                  <span style={styles.arrow}>→</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  section: {
    padding: "58px 4%",
    background: "var(--ncs-page-bg, #f7f9fc)",
  },

  heading: {
    maxWidth: 900,
    margin: "0 auto 34px",
    textAlign: "center",
  },

  eyebrow: {
    display: "block",
    color: "var(--ncs-secondary, #d4af37)",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 2,
  },

  title: {
    margin: "8px 0 0",
    color: "var(--ncs-primary, #0a2e73)",
    fontSize: "clamp(32px,4vw,48px)",
    fontWeight: 900,
  },

  subtitle: {
    margin: "10px 0 0",
    color: "var(--ncs-muted, #667085)",
    fontSize: 14,
  },

  grid: {
    width: "min(1500px,100%)",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(245px,1fr))",
    gap: 22,
    margin: "0 auto",
  },

  card: {
    overflow: "hidden",
    border: "1px solid var(--ncs-border, #e3e7ef)",
    borderRadius: 18,
    background: "var(--ncs-surface, #ffffff)",
    boxShadow: "0 10px 28px rgba(var(--ncs-primary-rgb, 10,46,115), .10)",
    cursor: "pointer",
  },

  imageBox: {
    position: "relative",
    overflow: "hidden",
    aspectRatio: "4 / 5",
    background: "color-mix(in srgb, var(--ncs-primary, #0A2E73) 7%, white 93%)",
  },

  image: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
  },

  fallback: {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg,var(--ncs-primary, #0A2E73),color-mix(in srgb, var(--ncs-primary, #0A2E73) 76%, white 24%))",
    color: "var(--ncs-secondary, #d4af37)",
    fontWeight: 900,
  },

  newBadge: {
    position: "absolute",
    top: 13,
    left: 13,
    padding: "6px 11px",
    borderRadius: 999,
    background: "var(--ncs-secondary, #D4AF37)",
    color: "var(--ncs-primary, #082b6e)",
    fontSize: 10,
    fontWeight: 900,
  },

  discountBadge: {
    position: "absolute",
    top: 13,
    right: 13,
    padding: "6px 10px",
    borderRadius: 999,
    background: "var(--ncs-primary, #0a2e73)",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 900,
  },

  slotBadge: {
    position: "absolute",
    right: 13,
    bottom: 13,
    maxWidth: "80%",
    overflow: "hidden",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(var(--ncs-primary-rgb, 10,46,115), .92)",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 900,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  content: {
    padding: "18px 18px 20px",
  },

  name: {
    minHeight: 52,
    margin: 0,
    overflow: "hidden",
    color: "var(--ncs-primary, #082b6e)",
    fontSize: 19,
    fontWeight: 900,
    lineHeight: 1.35,
  },

  parentName: {
    marginTop: 5,
    color: "var(--ncs-muted, #667085)",
    fontSize: 10,
    fontWeight: 700,
  },

  sizesLine: {
    marginTop: 7,
    color: "var(--ncs-primary, #0a2e73)",
    fontSize: 10,
    fontWeight: 800,
  },

  priceRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 13,
  },

  price: {
    color: "var(--ncs-secondary, #d3aa25)",
    fontSize: 27,
    fontWeight: 900,
  },

  mrp: {
    color: "#98a2b3",
    fontSize: 13,
  },

  stock: {
    marginTop: 8,
    color: "#08783e",
    fontSize: 11,
    fontWeight: 800,
  },

  button: {
    width: "100%",
    minHeight: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 17,
    border: 0,
    borderRadius: 11,
    background: "linear-gradient(90deg,var(--ncs-primary, #0A2E73),color-mix(in srgb, var(--ncs-primary, #0A2E73) 74%, white 26%))",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  arrow: {
    fontSize: 20,
  },
};