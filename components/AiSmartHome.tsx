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

type ProductDesignLink = {
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

  image: string;

  price: number;

  mrp: number;

  stock: number;

  category: string;

  brand: string;

  isNewArrival: boolean;

  isFeatured: boolean;

  isOnSale: boolean;

  createdOrder: number;
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

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function enabled(value: unknown) {
  if (
    value === true ||
    value === 1
  ) {
    return true;
  }

  return [
    "true",
    "1",
    "yes",
    "on",
  ].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  );
}

function productName(product: Product) {
  return (
    product.name ||
    product.product_name ||
    product.title ||
    "Premium Product"
  );
}

function productImage(product: Product) {
  return (
    product.image_url ||
    product.image ||
    ""
  );
}

function productOnlineStock(
  product: Product
) {
  const stock = Math.max(
    0,
    num(product.stock)
  );

  const onlineLimit = Math.max(
    0,
    num(product.online_stock_limit)
  );

  if (
    stock <= 0 ||
    onlineLimit <= 0
  ) {
    return 0;
  }

  return Math.min(
    stock,
    onlineLimit
  );
}

function productDiscount(
  product: Product
) {
  const price = num(product.price);

  const mrp = Math.max(
    price,
    num(product.mrp)
  );

  const saved =
    num(product.discount_percent);

  if (saved > 0) {
    return Math.round(saved);
  }

  if (
    price <= 0 ||
    mrp <= price
  ) {
    return 0;
  }

  return Math.round(
    ((mrp - price) / mrp) *
      100
  );
}

function money(value: number) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

export default function AiSmartHome() {
  const router = useRouter();

  const [
    parentProducts,
    setParentProducts,
  ] = useState<Product[]>([]);

  const [
    storeCards,
    setStoreCards,
  ] = useState<StoreCard[]>([]);

  const [
    aiProducts,
    setAiProducts,
  ] = useState<AiProduct[]>([]);

  const [
    aiAnswer,
    setAiAnswer,
  ] = useState("");

  const [
    lastQuery,
    setLastQuery,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(() => {
    void loadCatalogue();
  }, []);

  async function loadCatalogue() {
    setLoading(true);

    try {
      /*
       * -------------------------------------------------------
       * 1. LOAD ONLINE PARENT PRODUCTS
       * -------------------------------------------------------
       */

      const {
        data: productData,
        error: productError,
      } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("id", {
          ascending: false,
        })
        .limit(120);

      if (productError) {
        throw productError;
      }

      const allProducts =
        ((productData ||
          []) as Product[]);

      /*
       * Parent product must still be
       * available for online selling.
       */

      const onlineProducts =
        allProducts.filter(
          (item) =>
            item.is_active === true &&
            item.sell_online === true &&
            num(item.price) > 0 &&
            productOnlineStock(item) > 0
        );

      setParentProducts(
        onlineProducts
      );

      const productIds =
        onlineProducts
          .map((item) =>
            Number(item.id)
          )
          .filter(
            (id) =>
              Number.isFinite(id) &&
              id > 0
          );

      /*
       * -------------------------------------------------------
       * 2. LOAD DESIGN UNITS + DESIGN LINKS
       * -------------------------------------------------------
       *
       * IMPORTANT:
       *
       * We DO NOT use variant_id as
       * the unique storefront card.
       *
       * One variant can have many
       * different design units.
       *
       * design_unit.id is the unique
       * shopping card identity.
       */

      let designUnits:
        ProductDesignUnit[] = [];

      let designLinks:
        ProductDesignLink[] = [];

      if (productIds.length > 0) {
        const [
          designResponse,
          linkResponse,
        ] = await Promise.all([
          supabase
            .from(
              "product_design_units"
            )
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
            .in(
              "product_id",
              productIds
            )
            .neq(
              "status",
              "hidden"
            )
            .order(
              "sort_order",
              {
                ascending: true,
              }
            )
            .order("id", {
              ascending: true,
            }),

          supabase
            .from(
              "product_design_unit_variants"
            )
            .select(
              `
                id,
                product_id,
                design_unit_id,
                variant_id,
                status
              `
            )
            .in(
              "product_id",
              productIds
            )
            .neq(
              "status",
              "hidden"
            )
            .order("id", {
              ascending: true,
            }),
        ]);

        if (
          designResponse.error
        ) {
          console.error(
            "Design units error:",
            designResponse.error
          );
        } else {
          designUnits =
            (designResponse.data ||
              []) as ProductDesignUnit[];
        }

        if (
          linkResponse.error
        ) {
          console.error(
            "Design links error:",
            linkResponse.error
          );
        } else {
          designLinks =
            (linkResponse.data ||
              []) as ProductDesignLink[];
        }
      }

      /*
       * -------------------------------------------------------
       * 3. EXPAND EACH PARENT PRODUCT
       *    INTO INDIVIDUAL DESIGN CARDS
       * -------------------------------------------------------
       */

      const cards:
        StoreCard[] = [];

      for (
        const product of onlineProducts
      ) {
        const id =
          Number(product.id);

        const designs =
          designUnits
            .filter(
              (design) =>
                Number(
                  design.product_id
                ) === id &&
                design.status !==
                  "hidden" &&
                Boolean(
                  design.image_url?.trim()
                )
            )
            .sort((a, b) => {
              const sortA = num(
                a.sort_order
              );

              const sortB = num(
                b.sort_order
              );

              if (
                sortA !== sortB
              ) {
                return (
                  sortA -
                  sortB
                );
              }

              return (
                Number(a.id) -
                Number(b.id)
              );
            });

        /*
         * A design is considered
         * available when:
         *
         * - design itself is available
         * - AND at least one link is
         *   marked available
         *
         * This matches Product Details.
         */

        const availableDesigns =
          designs.filter(
            (design) => {
              if (
                design.status ===
                "sold_out"
              ) {
                return false;
              }

              return designLinks.some(
                (link) =>
                  Number(
                    link.design_unit_id
                  ) ===
                    Number(
                      design.id
                    ) &&
                  link.status ===
                    "available"
              );
            }
          );

        /*
         * -----------------------------------------
         * DESIGN PRODUCT
         *
         * Each design becomes
         * ONE SEPARATE CARD.
         * -----------------------------------------
         */

        if (
          availableDesigns.length >
          0
        ) {
          availableDesigns.forEach(
            (design, index) => {
              const price =
                num(product.price);

              const mrp =
                Math.max(
                  price,
                  num(product.mrp)
                );

              cards.push({
                key:
                  `product-${id}` +
                  `-design-${design.id}`,

                productId:
                  product.id,

                designId:
                  Number(design.id),

                name:
                  productName(
                    product
                  ),

                designName:
                  design.design_name?.trim() ||
                  `Design ${
                    index + 1
                  }`,

                image:
                  design.image_url?.trim() ||
                  productImage(
                    product
                  ),

                price,

                mrp,

                /*
                 * Parent online stock is
                 * used for display only.
                 *
                 * Design availability is
                 * controlled by the
                 * design link status.
                 */
                stock:
                  productOnlineStock(
                    product
                  ),

                category:
                  product.category ||
                  "Fashion",

                brand:
                  product.brand ||
                  "NEW CITY STYLE",

                isNewArrival:
                  enabled(
                    product.is_new_arrival
                  ),

                isFeatured:
                  enabled(
                    product.is_featured
                  ),

                isOnSale:
                  enabled(
                    product.is_on_sale
                  ) ||
                  productDiscount(
                    product
                  ) > 0,

                createdOrder:
                  Number(
                    design.sort_order ||
                      design.id
                  ),
              });
            }
          );

          /*
           * IMPORTANT:
           *
           * Do NOT add parent card
           * after designs are added.
           */
          continue;
        }

        /*
         * -----------------------------------------
         * NORMAL / LEGACY PRODUCT
         *
         * No design units:
         * keep original one-card system.
         * -----------------------------------------
         */

        cards.push({
          key:
            `product-${id}`,

          productId:
            product.id,

          designId:
            null,

          name:
            productName(
              product
            ),

          designName: "",

          image:
            productImage(
              product
            ),

          price:
            num(product.price),

          mrp:
            Math.max(
              num(product.price),
              num(product.mrp)
            ),

          stock:
            productOnlineStock(
              product
            ),

          category:
            product.category ||
            "Fashion",

          brand:
            product.brand ||
            "NEW CITY STYLE",

          isNewArrival:
            enabled(
              product.is_new_arrival
            ),

          isFeatured:
            enabled(
              product.is_featured
            ),

          isOnSale:
            enabled(
              product.is_on_sale
            ) ||
            productDiscount(
              product
            ) > 0,

          createdOrder: id,
        });
      }

      /*
       * Latest parent products first.
       * Designs remain in their
       * saved sort order.
       */

      setStoreCards(cards);

      /*
       * -------------------------------------------------------
       * 4. EXISTING AI PERSONALIZATION
       * -------------------------------------------------------
       */

      let storedQuery = "";

      try {
        storedQuery =
          window.localStorage
            .getItem(
              "ncs_ai_last_query"
            )
            ?.trim() || "";
      } catch {
        // optional
      }

      setLastQuery(
        storedQuery
      );

      if (storedQuery) {
        try {
          const response =
            await fetch(
              "/api/ai-shopping",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    question:
                      storedQuery,

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
              (
                result.products ||
                []
              ).filter(
                (item) =>
                  num(
                    item.price
                  ) > 0 &&
                  num(
                    item.onlineStock
                  ) > 0
              )
            );

            setAiAnswer(
              result.answer ||
                ""
            );
          }
        } catch (
          aiError
        ) {
          console.info(
            "AI recommendation fallback:",
            aiError
          );
        }
      }
    } catch (error) {
      console.error(
        "AI Smart Home load error:",
        error
      );

      setParentProducts(
        []
      );

      setStoreCards([]);
    } finally {
      setLoading(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * NEW ARRIVALS
   * ---------------------------------------------------------
   */

  const newArrivals =
    useMemo(() => {
      return [
        ...storeCards,
      ]
        .filter(
          (item) =>
            item.stock > 0
        )
        .sort((a, b) => {
          const newDiff =
            Number(
              b.isNewArrival
            ) -
            Number(
              a.isNewArrival
            );

          if (
            newDiff !== 0
          ) {
            return newDiff;
          }

          return (
            Number(
              b.productId
            ) -
            Number(
              a.productId
            )
          );
        })
        /*
         * More than 4 so all six
         * designs can appear.
         */
        .slice(0, 12);
    }, [storeCards]);

  /*
   * ---------------------------------------------------------
   * DEALS
   * ---------------------------------------------------------
   */

  const smartDeals =
    useMemo(() => {
      return [
        ...storeCards,
      ]
        .filter(
          (item) =>
            item.stock > 0 &&
            item.price > 0 &&
            item.mrp >
              item.price
        )
        .sort((a, b) => {
          const discountA =
            a.mrp > 0
              ? ((a.mrp -
                  a.price) /
                  a.mrp) *
                100
              : 0;

          const discountB =
            b.mrp > 0
              ? ((b.mrp -
                  b.price) /
                  b.mrp) *
                100
              : 0;

          return (
            discountB -
            discountA
          );
        })
        .slice(0, 12);
    }, [storeCards]);

  /*
   * ---------------------------------------------------------
   * SMART PICKS
   * ---------------------------------------------------------
   */

  const fastMoving =
    useMemo(() => {
      return [
        ...storeCards,
      ]
        .filter(
          (item) =>
            item.stock > 0
        )
        .sort((a, b) => {
          const featuredDiff =
            Number(
              b.isFeatured
            ) -
            Number(
              a.isFeatured
            );

          if (
            featuredDiff !== 0
          ) {
            return featuredDiff;
          }

          return (
            Number(
              b.productId
            ) -
            Number(
              a.productId
            )
          );
        })
        .slice(0, 12);
    }, [storeCards]);

  /*
   * ---------------------------------------------------------
   * STORE DESIGN CARD
   * ---------------------------------------------------------
   */

  function renderStoreCard(
    item: StoreCard,
    prefix: string
  ) {
    const discount =
      item.mrp >
        item.price &&
      item.mrp > 0
        ? Math.round(
            ((item.mrp -
              item.price) /
              item.mrp) *
              100
          )
        : 0;

    const url =
      item.designId !== null
        ? `/product/${item.productId}?design=${item.designId}`
        : `/product/${item.productId}`;

    return (
      <button
        type="button"
        key={`${prefix}-${item.key}`}
        className="smartProduct"
        onClick={() =>
          router.push(url)
        }
      >
        <div className="smartImage">
          {item.image ? (
            <img
              src={item.image}
              alt={
                item.designName
                  ? `${item.name} - ${item.designName}`
                  : item.name
              }
              loading="lazy"
            />
          ) : (
            <span>NCS</span>
          )}

          {discount >
            0 && (
            <b className="dealBadge">
              {discount}% OFF
            </b>
          )}

          {item.designName && (
            <span className="designBadge">
              DESIGN
            </span>
          )}
        </div>

        <div className="smartProductInfo">
          <strong>
            {item.name}
          </strong>

          {item.designName && (
            <span className="designName">
              {item.designName}
            </span>
          )}

          <div className="priceLine">
            <b>
              {money(
                item.price
              )}
            </b>

            {item.mrp >
              item.price && (
              <del>
                {money(
                  item.mrp
                )}
              </del>
            )}
          </div>

          <small>
            Available online
          </small>

          <em>
            View Product →
          </em>
        </div>
      </button>
    );
  }

  /*
   * ---------------------------------------------------------
   * EXISTING AI CARD
   * ---------------------------------------------------------
   */

  function renderAiProduct(
    item: AiProduct,
    prefix: string
  ) {
    const price =
      num(item.price);

    const mrp =
      Math.max(
        price,
        num(item.mrp)
      );

    const discount =
      mrp > price &&
      mrp > 0
        ? Math.round(
            ((mrp -
              price) /
              mrp) *
              100
          )
        : 0;

    return (
      <button
        type="button"
        key={`${prefix}-${item.id}`}
        className="smartProduct"
        onClick={() =>
          router.push(
            `/product/${item.id}`
          )
        }
      >
        <div className="smartImage">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
            />
          ) : (
            <span>NCS</span>
          )}

          {discount >
            0 && (
            <b className="dealBadge">
              {discount}% OFF
            </b>
          )}
        </div>

        <div className="smartProductInfo">
          <strong>
            {item.name}
          </strong>

          <div className="priceLine">
            <b>
              {money(price)}
            </b>

            {mrp >
              price && (
              <del>
                {money(mrp)}
              </del>
            )}
          </div>

          <small>
            {num(
              item.onlineStock
            ) > 0
              ? `${item.onlineStock} available online`
              : "Available online"}
          </small>

          <em>
            View Product →
          </em>
        </div>
      </button>
    );
  }

  /*
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
   */

  if (loading) {
    return (
      <section className="smartHomeShell">
        <div className="smartLoading">
          <span />

          <strong>
            Preparing smart
            shopping picks…
          </strong>
        </div>

        <style jsx>
          {styles}
        </style>
      </section>
    );
  }

  if (
    storeCards.length ===
      0 &&
    parentProducts.length ===
      0
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
            Smarter Shopping,
            Live From Our
            Catalogue
          </h2>

          <p>
            Recommendations adapt
            to live online stock,
            offers and your recent
            Ask NCS shopping
            intent.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/search"
            )
          }
        >
          Explore All Products →
        </button>
      </div>

      {lastQuery &&
        aiProducts.length >
          0 && (
          <section className="aiPersonalCard">
            <div className="aiPersonalHeader">
              <div className="aiIcon">
                AI
              </div>

              <div>
                <span>
                  PERSONALIZED FOR
                  YOU
                </span>

                <h3>
                  Based on your
                  recent Ask NCS
                  request
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

      {newArrivals.length >
        0 && (
        <div className="smartSection">
          <div className="sectionTitle">
            <div>
              <span>
                JUST IN
              </span>

              <h3>
                Fresh & Available
                Now
              </h3>
            </div>

            <small>
              Individual designs
              shown separately
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

      {smartDeals.length >
        0 && (
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
              Current price vs MRP
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

      {fastMoving.length >
        0 && (
        <div className="smartSection">
          <div className="sectionTitle">
            <div>
              <span>
                SMART PICKS
              </span>

              <h3>
                Popular-Looking
                Picks Ready To Shop
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
          <b>
            Live Stock
          </b>

          <span>
            Online availability
            respected
          </span>
        </div>

        <div>
          <b>
            Individual Designs
          </b>

          <span>
            Every available design
            can appear separately
          </span>
        </div>

        <div>
          <b>
            AI-Safe Fallback
          </b>

          <span>
            Shopping works even
            without AI
          </span>
        </div>

        <div>
          <b>
            NEW CITY STYLE
          </b>

          <span>
            Premium catalogue
            experience
          </span>
        </div>
      </div>

      <style jsx>
        {styles}
      </style>
    </section>
  );
}

const styles = `
.smartHomeShell {
  padding: 70px 20px;
  background:
    radial-gradient(
      circle at 90% 0%,
      rgba(var(--ncs-secondary-rgb, 212,175,55), .09),
      transparent 30%
    ),
    linear-gradient(
      180deg,
      var(--ncs-page-bg, #F7F8FC) 0%,
      var(--ncs-surface, #ffffff) 45%,
      color-mix(in srgb, var(--ncs-page-bg, #F7F8FC) 88%, var(--ncs-secondary, #D4AF37) 12%) 100%
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
  color: color-mix(in srgb, var(--ncs-secondary, #D4AF37) 86%, black 14%);
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 1.7px;
}

.smartHeading h2 {
  max-width: 850px;
  margin: 8px 0 0;
  color: var(--ncs-primary, #0a2e73);
  font-size:
    clamp(34px, 4.5vw, 58px);
  line-height: 1.05;
  letter-spacing: -1.8px;
}

.smartHeading p {
  max-width: 760px;
  margin: 13px 0 0;
  color: var(--ncs-muted, #667085);
  font-size: 14px;
  line-height: 1.7;
}

.smartHeading > button {
  min-height: 48px;
  flex: 0 0 auto;
  padding: 0 18px;
  border:
    1px solid var(--ncs-secondary, #d4af37);
  border-radius: 12px;
  background: var(--ncs-primary, #0a2e73);
  color: #fff;
  font-size: 11px;
  font-weight: 850;
  cursor: pointer;
}

.aiPersonalCard,
.smartSection {
  width: min(1400px, 100%);
  margin: 0 auto 30px;
  padding: 24px;
  border:
    1px solid
    rgba(var(--ncs-primary-rgb, 10,46,115), .09);
  border-radius: 24px;
  background:
    color-mix(in srgb, var(--ncs-surface, #ffffff) 96%, transparent 4%);
  box-shadow:
    0 16px 45px
    rgba(var(--ncs-primary-rgb, 10,46,115), .07);
}

.aiPersonalCard {
  border-color:
    rgba(var(--ncs-secondary-rgb, 212,175,55), .40);
  background:
    radial-gradient(
      circle at 100% 0%,
      rgba(var(--ncs-secondary-rgb, 212,175,55), .13),
      transparent 28%
    ),
    #fff;
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
      var(--ncs-primary, #0a2e73),
      color-mix(in srgb, var(--ncs-primary, #0A2E73) 72%, white 28%)
    );
  color: color-mix(in srgb, var(--ncs-secondary, #D4AF37) 70%, white 30%);
  font-size: 13px;
  font-weight: 950;
}

.aiPersonalHeader h3,
.sectionTitle h3 {
  margin: 5px 0 0;
  color: var(--ncs-primary, #0a2e73);
  font-size: 24px;
}

.aiPersonalHeader p {
  margin: 5px 0 0;
  color: var(--ncs-muted, #667085);
  font-size: 11px;
}

.aiAnswerPreview {
  margin: 16px 0 0;
  padding: 13px 15px;
  border-left:
    3px solid var(--ncs-secondary, #d4af37);
  border-radius:
    0 10px 10px 0;
  background: color-mix(in srgb, var(--ncs-secondary, #D4AF37) 5%, white 95%);
  color: var(--ncs-muted, #475467);
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
  color: var(--ncs-muted, #98a2b3);
  font-size: 9px;
  font-weight: 700;
}

.smartGrid {
  display: grid;
  grid-template-columns:
    repeat(
      4,
      minmax(0, 1fr)
    );
  gap: 14px;
  margin-top: 18px;
}

.smartProduct {
  overflow: hidden;
  display: block;
  padding: 0;
  border:
    1px solid var(--ncs-border, #e5e9f0);
  border-radius: 16px;
  background: #fff;
  color: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow:
    0 8px 22px
    rgba(var(--ncs-primary-rgb, 10,46,115), .05);
  transition:
    transform .22s ease,
    box-shadow .22s ease;
}

.smartProduct:hover {
  transform:
    translateY(-4px);
  box-shadow:
    0 16px 32px
    rgba(var(--ncs-primary-rgb, 10,46,115), .11);
}

.smartImage {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--ncs-primary, #0A2E73) 7%, white 93%);
  color: var(--ncs-secondary, #d4af37);
  font-weight: 950;
}

.smartImage img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.dealBadge {
  position: absolute;
  top: 9px;
  left: 9px;
  z-index: 3;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--ncs-secondary, #d4af37);
  color: var(--ncs-primary, #0a2e73);
  font-size: 8px;
  font-weight: 950;
}

.designBadge {
  position: absolute;
  top: 9px;
  right: 9px;
  z-index: 3;
  padding: 5px 8px;
  border-radius: 999px;
  background:
    rgba(var(--ncs-primary-rgb, 10,46,115), .92);
  color: #fff;
  font-size: 8px;
  font-weight: 900;
}

.smartProductInfo {
  padding: 13px;
}

.smartProductInfo > strong {
  min-height: 38px;
  display: -webkit-box;
  overflow: hidden;
  color: var(--ncs-primary, #0a2e73);
  font-size: 12px;
  line-height: 1.4;
  -webkit-box-orient:
    vertical;
  -webkit-line-clamp: 2;
}

.designName {
  min-height: 28px;
  display: -webkit-box;
  overflow: hidden;
  margin-top: 5px;
  color: var(--ncs-muted, #667085);
  font-size: 9px;
  font-weight: 750;
  line-height: 1.45;
  -webkit-box-orient:
    vertical;
  -webkit-line-clamp: 2;
}

.priceLine {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 8px;
}

.priceLine b {
  color: color-mix(in srgb, var(--ncs-secondary, #D4AF37) 86%, black 14%);
  font-size: 15px;
}

.priceLine del {
  color: var(--ncs-muted, #98a2b3);
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
  color: var(--ncs-primary, #0a2e73);
  font-size: 8px;
  font-style: normal;
  font-weight: 850;
}

.smartTrustStrip {
  width: min(1400px, 100%);
  display: grid;
  grid-template-columns:
    repeat(
      4,
      minmax(0, 1fr)
    );
  gap: 10px;
  margin: 0 auto;
}

.smartTrustStrip > div {
  padding: 15px;
  border:
    1px solid
    rgba(var(--ncs-primary-rgb, 10,46,115), .08);
  border-radius: 14px;
  background: #fff;
}

.smartTrustStrip b,
.smartTrustStrip span {
  display: block;
}

.smartTrustStrip b {
  color: var(--ncs-primary, #0a2e73);
  font-size: 11px;
}

.smartTrustStrip span {
  margin-top: 4px;
  color: var(--ncs-muted, #667085);
  font-size: 8px;
  line-height: 1.4;
}

.smartLoading {
  min-height: 180px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  color: var(--ncs-primary, #0a2e73);
}

.smartLoading span {
  width: 34px;
  height: 34px;
  border:
    3px solid color-mix(in srgb, var(--ncs-primary, #0A2E73) 8%, white 92%);
  border-top-color:
    var(--ncs-secondary, #d4af37);
  border-radius: 50%;
  animation:
    smartSpin .8s
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
    border-radius: 17px;
  }

  .smartGrid {
    gap: 8px;
  }

  .smartProduct {
    border-radius: 12px;
  }

  .smartProductInfo {
    padding: 9px;
  }

  .smartProductInfo > strong {
    min-height: 34px;
    font-size: 10px;
  }

  .designName {
    font-size: 8px;
  }

  .smartHeading h2 {
    font-size: 34px;
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
    font-size: 19px;
  }
}
`;