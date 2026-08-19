"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string | number;
  name?: string | null;
  product_name?: string | null;
  title?: string | null;
  price?: number | string | null;
  mrp?: number | string | null;
  stock?: number | string | null;
  online_stock_limit?: number | string | null;
  image?: string | null;
  image_url?: string | null;
  brand?: string | null;
  category?: string | null;
  sizes?: string[] | string | null;
  colors?: string[] | string | null;
  is_new_arrival?: boolean | string | number | null;
  is_featured?: boolean | string | number | null;
  is_on_sale?: boolean | string | number | null;
  discount_percent?: number | string | null;
  sell_online?: boolean | null;
  is_active?: boolean | null;
};

type ProductVariant = {
  id: number;
  product_id: number;
  variant_name?: string | null;
  size?: string | null;
  color?: string | null;
  barcode?: string | null;
  stock?: number | string | null;
  online_stock_limit?: number | string | null;
  sell_online?: boolean | null;
  mrp?: number | string | null;
  online_price?: number | string | null;
  main_image?: string | null;
};

type ProductDesignUnit = {
  id: number;
  product_id: number;
  parent_variant_id?: number | null;
  parent_barcode?: string | null;
  design_name?: string | null;
  image_url?: string | null;
  status?: string | null;
  sort_order?: number | null;
};

type ProductDesignVariantLink = {
  id: number;
  product_id: number;
  design_unit_id: number;
  variant_id: number;
  status?: string | null;
};

type StoreCard = {
  key: string;
  productId: string | number;
  designId: number | null;
  name: string;
  designName: string;
  price: number;
  mrp: number;
  stock: number;
  brand: string;
  category: string;
  image: string;
  isNewArrival: boolean;
  isFeatured: boolean;
  isOnSale: boolean;
};

type AiProduct = {
  id: string | number;
  name: string;
  price: number;
  mrp: number;
  stock: number;
  onlineStock: number;
  brand: string;
  category: string;
  sizes: string[];
  colors: string[];
  image: string;
};

type AiResponse = {
  success?: boolean;
  answer?: string;
  products?: AiProduct[];
};

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function enabled(value: unknown) {
  if (value === true || value === 1) return true;

  return ["true", "1", "yes", "on"].includes(
    String(value ?? "").trim().toLowerCase()
  );
}

function nameOf(product: Product) {
  return (
    product.name ||
    product.product_name ||
    product.title ||
    "Premium Product"
  );
}

function imageOf(product: Product) {
  return product.image_url || product.image || "";
}

function onlineStock(product: Product) {
  const stock = Math.max(0, num(product.stock));
  const limit = Math.max(0, num(product.online_stock_limit));

  if (limit <= 0 || stock <= 0) return 0;

  return Math.min(stock, limit);
}

function variantOnlineStock(variant: ProductVariant) {
  if (variant.sell_online !== true) return 0;

  const stock = Math.max(0, num(variant.stock));
  const limit = Math.max(0, num(variant.online_stock_limit));

  if (stock <= 0 || limit <= 0) return 0;

  return Math.min(stock, limit);
}

function discountOf(product: Product) {
  const price = num(product.price);

  if (price <= 0) return 0;

  const mrp = Math.max(price, num(product.mrp));

  if (num(product.discount_percent) > 0) {
    return Math.round(num(product.discount_percent));
  }

  return mrp > price && mrp > 0
    ? Math.round(((mrp - price) / mrp) * 100)
    : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AiSmartHome() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [storeCards, setStoreCards] = useState<StoreCard[]>([]);

  const [aiProducts, setAiProducts] = useState<AiProduct[]>([]);
  const [aiAnswer, setAiAnswer] = useState("");
  const [lastQuery, setLastQuery] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);

    try {
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .limit(100);

      if (productError) {
        throw productError;
      }

      const parentProducts = ((productData || []) as Product[]).filter(
        (item) => item.is_active === true
      );

      const productIds = parentProducts
        .map((item) => Number(item.id))
        .filter((id) => Number.isFinite(id) && id > 0);

      let variants: ProductVariant[] = [];
      let designUnits: ProductDesignUnit[] = [];
      let designLinks: ProductDesignVariantLink[] = [];

      if (productIds.length > 0) {
        const [
          variantResponse,
          designResponse,
          designLinkResponse,
        ] = await Promise.all([
          supabase
            .from("product_variants")
            .select(
              `
                id,
                product_id,
                variant_name,
                size,
                color,
                barcode,
                stock,
                online_stock_limit,
                sell_online,
                mrp,
                online_price,
                main_image
              `
            )
            .in("product_id", productIds)
            .order("id", { ascending: true }),

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
                status
              `
            )
            .in("product_id", productIds)
            .neq("status", "hidden")
            .order("id", { ascending: true }),
        ]);

        if (variantResponse.error) {
          console.info(
            "AI Smart Home variants load error:",
            variantResponse.error.message
          );
        } else {
          variants =
            (variantResponse.data || []) as ProductVariant[];
        }

        if (designResponse.error) {
          console.info(
            "AI Smart Home design units load error:",
            designResponse.error.message
          );
        } else {
          designUnits =
            (designResponse.data || []) as ProductDesignUnit[];
        }

        if (designLinkResponse.error) {
          console.info(
            "AI Smart Home design links load error:",
            designLinkResponse.error.message
          );
        } else {
          designLinks =
            (designLinkResponse.data ||
              []) as ProductDesignVariantLink[];
        }
      }

      const expandedCards: StoreCard[] = [];

      for (const parent of parentProducts) {
        const parentId = Number(parent.id);
        const parentName = nameOf(parent);
        const parentImage = imageOf(parent);

        const parentPrice = num(parent.price);

        const parentMrp = Math.max(
          parentPrice,
          num(parent.mrp)
        );

        const productDesigns = designUnits.filter(
          (unit) =>
            Number(unit.product_id) === parentId &&
            unit.status !== "hidden" &&
            Boolean(unit.image_url?.trim())
        );

        const productVariants = variants.filter(
          (variant) =>
            Number(variant.product_id) === parentId
        );

        const individualDesignCards: StoreCard[] = [];

        for (const design of productDesigns) {
          const linkedVariantIds = designLinks
            .filter(
              (link) =>
                Number(link.design_unit_id) ===
                  Number(design.id) &&
                link.status === "available"
            )
            .map((link) => Number(link.variant_id));

          if (
            linkedVariantIds.length === 0 &&
            Number(design.parent_variant_id || 0) > 0
          ) {
            linkedVariantIds.push(
              Number(design.parent_variant_id)
            );
          }

          const linkedVariants = productVariants.filter(
            (variant) =>
              linkedVariantIds.includes(Number(variant.id))
          );

          const availableVariants = linkedVariants.filter(
            (variant) => variantOnlineStock(variant) > 0
          );

          const designQuantity = availableVariants.reduce(
            (total, variant) =>
              total + variantOnlineStock(variant),
            0
          );

          if (designQuantity <= 0) {
            continue;
          }

          const firstAvailableVariant =
            availableVariants[0] || null;

          const variantPrice =
            firstAvailableVariant &&
            num(firstAvailableVariant.online_price) > 0
              ? num(firstAvailableVariant.online_price)
              : parentPrice;

          const variantMrp =
            firstAvailableVariant &&
            num(firstAvailableVariant.mrp) > 0
              ? Math.max(
                  variantPrice,
                  num(firstAvailableVariant.mrp)
                )
              : Math.max(variantPrice, parentMrp);

          individualDesignCards.push({
            key: `product-${parentId}-design-${design.id}`,

            productId: parent.id,

            designId: Number(design.id),

            name: parentName,

            designName:
              design.design_name?.trim() ||
              firstAvailableVariant?.variant_name?.trim() ||
              [firstAvailableVariant?.color]
                .filter(Boolean)
                .join(" • ") ||
              `Design ${design.id}`,

            price: variantPrice,

            mrp: variantMrp,

            stock: designQuantity,

            brand:
              parent.brand || "NEW CITY STYLE",

            category:
              parent.category || "Fashion",

            image:
              design.image_url?.trim() ||
              firstAvailableVariant?.main_image?.trim() ||
              parentImage,

            isNewArrival: enabled(
              parent.is_new_arrival
            ),

            isFeatured: enabled(
              parent.is_featured
            ),

            isOnSale:
              enabled(parent.is_on_sale) ||
              variantMrp > variantPrice,
          });
        }

        /*
         * IMPORTANT:
         * If this parent product has individual online designs,
         * do NOT show the parent as one card.
         * Show every design separately.
         */
        if (individualDesignCards.length > 0) {
          expandedCards.push(...individualDesignCards);
          continue;
        }

        /*
         * Legacy / normal product:
         * no design units = original single-card behaviour.
         */
        const parentOnlineQuantity =
          onlineStock(parent);

        if (
          parent.sell_online === true &&
          parent.is_active === true &&
          parentPrice > 0 &&
          parentOnlineQuantity > 0
        ) {
          expandedCards.push({
            key: `product-${parentId}`,

            productId: parent.id,

            designId: null,

            name: parentName,

            designName: "",

            price: parentPrice,

            mrp: parentMrp,

            stock: parentOnlineQuantity,

            brand:
              parent.brand || "NEW CITY STYLE",

            category:
              parent.category || "Fashion",

            image: parentImage,

            isNewArrival: enabled(
              parent.is_new_arrival
            ),

            isFeatured: enabled(
              parent.is_featured
            ),

            isOnSale:
              enabled(parent.is_on_sale) ||
              parentMrp > parentPrice,
          });
        }
      }

      setStoreCards(expandedCards);

      /*
       * Keep parent products for existing AI API.
       * We are not changing the AI endpoint now.
       */
      const onlineParentProducts =
        parentProducts.filter(
          (item) =>
            item.sell_online === true &&
            item.is_active === true &&
            num(item.price) > 0 &&
            onlineStock(item) > 0
        );

      setProducts(onlineParentProducts);

      let storedQuery = "";

      try {
        storedQuery =
          window.localStorage
            .getItem("ncs_ai_last_query")
            ?.trim() || "";
      } catch {
        // Personalization is optional.
      }

      setLastQuery(storedQuery);

      if (storedQuery) {
        try {
          const response = await fetch(
            "/api/ai-shopping",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                question: storedQuery,
                path: "/",
              }),
            }
          );

          const result =
            (await response.json()) as AiResponse;

          if (
            response.ok &&
            result.success
          ) {
            setAiProducts(
              (result.products || []).filter(
                (item) =>
                  num(item.price) > 0 &&
                  num(item.onlineStock) > 0
              )
            );

            setAiAnswer(
              result.answer || ""
            );
          }
        } catch {
          // Existing catalogue remains available.
        }
      }
    } catch (error) {
      console.error(
        "AI Smart Home load error:",
        error
      );

      setProducts([]);
      setStoreCards([]);
    } finally {
      setLoading(false);
    }
  }

  const newArrivals = useMemo(() => {
    return [...storeCards]
      .filter((item) => item.stock > 0)
      .sort((a, b) => {
        const newDiff =
          Number(b.isNewArrival) -
          Number(a.isNewArrival);

        if (newDiff !== 0) {
          return newDiff;
        }

        return b.stock - a.stock;
      })
      .slice(0, 8);
  }, [storeCards]);

  const smartDeals = useMemo(() => {
    return [...storeCards]
      .filter(
        (item) =>
          item.stock > 0 &&
          item.price > 0 &&
          item.mrp > item.price
      )
      .sort((a, b) => {
        const discountA =
          a.mrp > 0
            ? ((a.mrp - a.price) /
                a.mrp) *
              100
            : 0;

        const discountB =
          b.mrp > 0
            ? ((b.mrp - b.price) /
                b.mrp) *
              100
            : 0;

        return discountB - discountA;
      })
      .slice(0, 8);
  }, [storeCards]);

  const fastMoving = useMemo(() => {
    return [...storeCards]
      .filter((item) => item.stock > 0)
      .sort((a, b) => {
        const featuredDiff =
          Number(b.isFeatured) -
          Number(a.isFeatured);

        if (featuredDiff !== 0) {
          return featuredDiff;
        }

        return a.stock - b.stock;
      })
      .slice(0, 8);
  }, [storeCards]);

  function renderAiProduct(
    product: AiProduct,
    keyPrefix: string
  ) {
    const id = product.id;
    const name = product.name;
    const image = product.image;
    const price = num(product.price);

    const mrp = Math.max(
      price,
      num(product.mrp)
    );

    const stock =
      num(product.onlineStock);

    const discount =
      mrp > price &&
      mrp > 0
        ? Math.round(
            ((mrp - price) / mrp) *
              100
          )
        : 0;

    return (
      <button
        type="button"
        key={`${keyPrefix}-${id}`}
        className="smartProduct"
        onClick={() =>
          router.push(`/product/${id}`)
        }
      >
        <div className="smartImage">
          {image ? (
            <img
              src={image}
              alt={name}
              loading="lazy"
            />
          ) : (
            <span>NCS</span>
          )}

          {discount > 0 && (
            <b className="dealBadge">
              {discount}% OFF
            </b>
          )}
        </div>

        <div className="smartProductInfo">
          <strong>{name}</strong>

          <div>
            <b>{money(price)}</b>

            {mrp > price && (
              <del>{money(mrp)}</del>
            )}
          </div>

          <small>
            {stock > 0
              ? `${stock} available online`
              : "Out of stock"}
          </small>

          <em>View product →</em>
        </div>
      </button>
    );
  }

  function renderStoreCard(
    product: StoreCard,
    keyPrefix: string
  ) {
    const discount =
      product.mrp > product.price &&
      product.mrp > 0
        ? Math.round(
            ((product.mrp -
              product.price) /
              product.mrp) *
              100
          )
        : 0;

    const productUrl =
      product.designId !== null
        ? `/product/${product.productId}?design=${product.designId}`
        : `/product/${product.productId}`;

    return (
      <button
        type="button"
        key={`${keyPrefix}-${product.key}`}
        className="smartProduct"
        onClick={() =>
          router.push(productUrl)
        }
      >
        <div className="smartImage">
          {product.image ? (
            <img
              src={product.image}
              alt={
                product.designName
                  ? `${product.name} ${product.designName}`
                  : product.name
              }
              loading="lazy"
            />
          ) : (
            <span>NCS</span>
          )}

          {discount > 0 && (
            <b className="dealBadge">
              {discount}% OFF
            </b>
          )}

          {product.designName && (
            <span className="designBadge">
              {product.designName}
            </span>
          )}
        </div>

        <div className="smartProductInfo">
          <strong>
            {product.name}
          </strong>

          {product.designName && (
            <span className="designTitle">
              {product.designName}
            </span>
          )}

          <div>
            <b>
              {money(product.price)}
            </b>

            {product.mrp >
              product.price && (
              <del>
                {money(product.mrp)}
              </del>
            )}
          </div>

          <small>
            {product.stock} available online
          </small>

          <em>View product →</em>
        </div>
      </button>
    );
  }

  if (loading) {
    return (
      <section className="smartHomeShell">
        <div className="smartLoading">
          <span />

          <strong>
            Preparing smart shopping
            picks…
          </strong>
        </div>

        <style jsx>{styles}</style>
      </section>
    );
  }

  if (
    storeCards.length === 0 &&
    products.length === 0
  ) {
    return null;
  }

  return (
    <section className="smartHomeShell">
      <div className="smartHeading">
        <div>
          <span>
            ✦ NEW CITY STYLE
            INTELLIGENCE
          </span>

          <h2>
            Smarter Shopping, Live From
            Our Catalogue
          </h2>

          <p>
            Recommendations adapt to
            live online stock, offers
            and your recent Ask NCS
            shopping intent.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push("/search")
          }
        >
          Explore All Products →
        </button>
      </div>

      {lastQuery &&
        aiProducts.length > 0 && (
          <section className="aiPersonalCard">
            <div className="aiPersonalHeader">
              <div className="aiIcon">
                AI
              </div>

              <div>
                <span>
                  PERSONALIZED FOR YOU
                </span>

                <h3>
                  Based on your recent
                  Ask NCS request
                </h3>

                <p>
                  “{lastQuery}”
                </p>
              </div>
            </div>

            {aiAnswer && (
              <div className="aiAnswerPreview">
                {aiAnswer.length >
                280
                  ? `${aiAnswer.slice(
                      0,
                      280
                    )}…`
                  : aiAnswer}
              </div>
            )}

            <div className="smartGrid">
              {aiProducts.map(
                (item) =>
                  renderAiProduct(
                    item,
                    "ai"
                  )
              )}
            </div>
          </section>
        )}

      {newArrivals.length > 0 && (
        <div className="smartSection">
          <div className="sectionTitle">
            <div>
              <span>JUST IN</span>

              <h3>
                Fresh & Available Now
              </h3>
            </div>

            <small>
              Live catalogue • each
              available design shown
              separately
            </small>
          </div>

          <div className="smartGrid">
            {newArrivals.map(
              (item) =>
                renderStoreCard(
                  item,
                  "new"
                )
            )}
          </div>
        </div>
      )}

      {smartDeals.length > 0 && (
        <div className="smartSection">
          <div className="sectionTitle">
            <div>
              <span>
                SMART VALUE
              </span>

              <h3>
                Best Live Deals
              </h3>
            </div>

            <small>
              Calculated from current
              price vs MRP
            </small>
          </div>

          <div className="smartGrid">
            {smartDeals.map(
              (item) =>
                renderStoreCard(
                  item,
                  "deal"
                )
            )}
          </div>
        </div>
      )}

      {fastMoving.length > 0 && (
        <div className="smartSection">
          <div className="sectionTitle">
            <div>
              <span>
                SMART PICKS
              </span>

              <h3>
                Popular-Looking Picks
                Ready To Shop
              </h3>
            </div>

            <small>
              Featured + live-stock
              signals
            </small>
          </div>

          <div className="smartGrid">
            {fastMoving.map(
              (item) =>
                renderStoreCard(
                  item,
                  "smart"
                )
            )}
          </div>
        </div>
      )}

      <div className="smartTrustStrip">
        <div>
          <b>Live Stock</b>

          <span>
            Recommendations respect
            online availability
          </span>
        </div>

        <div>
          <b>
            Individual Designs
          </b>

          <span>
            Available designs can appear
            as separate shopping cards
          </span>
        </div>

        <div>
          <b>AI-Safe Fallback</b>

          <span>
            Core shopping still works if
            AI is unavailable
          </span>
        </div>

        <div>
          <b>Private by Design</b>

          <span>
            No payment or private
            customer data is sent to AI
          </span>
        </div>
      </div>

      <style jsx>{styles}</style>
    </section>
  );
}

const styles = `
.smartHomeShell {
  padding: 70px 20px;
  background:
    radial-gradient(
      circle at 90% 0%,
      rgba(212, 175, 55, 0.09),
      transparent 30%
    ),
    linear-gradient(
      180deg,
      #f7f9fc 0%,
      #ffffff 45%,
      #f8f4ec 100%
    );
}

.smartHeading {
  width: min(1400px, 100%);
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 25px;
  margin: 0 auto 30px;
}

.smartHeading span,
.sectionTitle span,
.aiPersonalHeader span {
  color: #c89d1e;
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 1.7px;
}

.smartHeading h2 {
  max-width: 850px;
  margin: 8px 0 0;
  color: #0a2e73;
  font-size: clamp(34px, 4.5vw, 58px);
  line-height: 1.05;
  letter-spacing: -1.8px;
}

.smartHeading p {
  max-width: 760px;
  margin: 13px 0 0;
  color: #667085;
  font-size: 14px;
  line-height: 1.7;
}

.smartHeading > button {
  min-height: 48px;
  flex: 0 0 auto;
  padding: 0 18px;
  border: 1px solid #d4af37;
  border-radius: 12px;
  background: #0a2e73;
  color: #ffffff;
  font-size: 11px;
  font-weight: 850;
  cursor: pointer;
}

.aiPersonalCard,
.smartSection {
  width: min(1400px, 100%);
  margin: 0 auto 30px;
  padding: 24px;
  border: 1px solid rgba(10, 46, 115, 0.09);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 16px 45px
    rgba(10, 46, 115, 0.07);
}

.aiPersonalCard {
  border-color:
    rgba(212, 175, 55, 0.4);
  background:
    radial-gradient(
      circle at 100% 0%,
      rgba(212, 175, 55, 0.13),
      transparent 28%
    ),
    #ffffff;
}

.aiPersonalHeader {
  display: flex;
  align-items: center;
  gap: 13px;
}

.aiIcon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  flex: 0 0 48px;
  border-radius: 14px;
  background:
    linear-gradient(
      135deg,
      #0a2e73,
      #164ca9
    );
  color: #f2d66c;
  font-size: 13px;
  font-weight: 950;
}

.aiPersonalHeader h3,
.sectionTitle h3 {
  margin: 5px 0 0;
  color: #0a2e73;
  font-size: 24px;
}

.aiPersonalHeader p {
  margin: 5px 0 0;
  color: #667085;
  font-size: 11px;
}

.aiAnswerPreview {
  margin: 16px 0 0;
  padding: 13px 15px;
  border-left:
    3px solid #d4af37;
  border-radius:
    0 10px 10px 0;
  background: #fffdf5;
  color: #475467;
  font-size: 11px;
  line-height: 1.6;
}

.sectionTitle {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.sectionTitle small {
  color: #98a2b3;
  font-size: 9px;
  font-weight: 700;
}

.smartGrid {
  display: grid;
  grid-template-columns:
    repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.smartProduct {
  overflow: hidden;
  display: block;
  padding: 0;
  border:
    1px solid #e5e9f0;
  border-radius: 16px;
  background: #ffffff;
  color: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow:
    0 8px 22px
    rgba(10, 46, 115, 0.05);
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease;
}

.smartProduct:hover {
  transform:
    translateY(-4px);
  box-shadow:
    0 16px 32px
    rgba(10, 46, 115, 0.11);
}

.smartImage {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: #edf1f8;
  color: #d4af37;
  font-weight: 950;
}

.smartImage img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dealBadge {
  position: absolute;
  top: 9px;
  left: 9px;
  z-index: 3;
  padding: 5px 8px;
  border-radius: 999px;
  background: #d4af37;
  color: #0a2e73;
  font-size: 8px;
  font-weight: 950;
}

.designBadge {
  position: absolute;
  right: 9px;
  bottom: 9px;
  z-index: 3;
  max-width: 80%;
  overflow: hidden;
  padding: 5px 8px;
  border-radius: 999px;
  background:
    rgba(10, 46, 115, 0.92);
  color: #ffffff;
  font-size: 8px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smartProductInfo {
  padding: 13px;
}

.smartProductInfo > strong {
  min-height: 38px;
  display: -webkit-box;
  overflow: hidden;
  color: #0a2e73;
  font-size: 12px;
  line-height: 1.4;
  -webkit-box-orient:
    vertical;
  -webkit-line-clamp: 2;
}

.designTitle {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: #667085;
  font-size: 9px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smartProductInfo > div {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 8px;
}

.smartProductInfo > div b {
  color: #c49a1f;
  font-size: 15px;
}

.smartProductInfo del {
  color: #98a2b3;
  font-size: 9px;
}

.smartProductInfo small,
.smartProductInfo em {
  display: block;
}

.smartProductInfo small {
  margin-top: 6px;
  color: #067647;
  font-size: 8px;
  font-weight: 800;
}

.smartProductInfo em {
  margin-top: 9px;
  color: #0a2e73;
  font-size: 8px;
  font-style: normal;
  font-weight: 850;
}

.smartTrustStrip {
  width: min(1400px, 100%);
  display: grid;
  grid-template-columns:
    repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 0 auto;
}

.smartTrustStrip > div {
  padding: 15px;
  border:
    1px solid
    rgba(10, 46, 115, 0.08);
  border-radius: 14px;
  background: #ffffff;
}

.smartTrustStrip b,
.smartTrustStrip span {
  display: block;
}

.smartTrustStrip b {
  color: #0a2e73;
  font-size: 11px;
}

.smartTrustStrip span {
  margin-top: 4px;
  color: #667085;
  font-size: 8px;
  line-height: 1.4;
}

.smartLoading {
  min-height: 180px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  color: #0a2e73;
}

.smartLoading span {
  width: 34px;
  height: 34px;
  border:
    3px solid #e7ebf3;
  border-top-color:
    #d4af37;
  border-radius: 50%;
  animation:
    smartSpin 0.8s
    linear infinite;
}

@keyframes smartSpin {
  to {
    transform:
      rotate(360deg);
  }
}

@media (max-width: 1000px) {
  .smartGrid,
  .smartTrustStrip {
    grid-template-columns:
      repeat(
        2,
        minmax(0, 1fr)
      );
  }

  .smartHeading {
    align-items:
      flex-start;
    flex-direction:
      column;
  }
}

@media (max-width: 600px) {
  .smartHomeShell {
    padding:
      45px 9px;
  }

  .aiPersonalCard,
  .smartSection {
    padding: 13px;
    border-radius:
      17px;
  }

  .smartGrid {
    gap: 8px;
  }

  .smartProduct {
    border-radius:
      12px;
  }

  .smartProductInfo {
    padding: 9px;
  }

  .smartProductInfo > strong {
    min-height:
      34px;
    font-size:
      10px;
  }

  .smartHeading h2 {
    font-size:
      34px;
  }

  .sectionTitle {
    align-items:
      flex-start;
    flex-direction:
      column;
    gap: 5px;
  }

  .sectionTitle h3,
  .aiPersonalHeader h3 {
    font-size:
      19px;
  }
}
`;