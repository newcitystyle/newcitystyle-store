"use client";



import { useEffect, useState } from "react";

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



  const onlineLimit = Math.max(

    0,

    numberValue(variant.online_stock_limit)

  );



  // NEW CITY STYLE legacy-safe rule:

  // Many older variants have sell_online=false / online_stock_limit=0 even

  // though the parent product is online and physical stock is available.

  // Therefore physical variant stock is the authoritative size gate.

  // A specific uploaded design is still controlled separately by its

  // product_design_unit_variants status + online_quantity.

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

    /\bshirt\b/.test(text)

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
      <section className="featuredSection">
        <div className="featuredShell">
          <div className="headingRow">
            <div>
              <span className="eyebrow">NEW CITY STYLE • LIVE CATALOGUE</span>
              <h2>
                Featured Fashion
                <strong>Ready To Shop</strong>
              </h2>
              <p>Preparing live products, designs and available sizes…</p>
            </div>
          </div>

          <div className="loadingGrid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="loadingCard" key={index}>
                <div className="loadingImage" />
                <div className="loadingLine wide" />
                <div className="loadingLine" />
                <div className="loadingButton" />
              </div>
            ))}
          </div>
        </div>

        <style jsx>{`
          .featuredSection {
            padding: 86px 20px 96px;
            background: var(--ncs-page-bg, #f7f9fc);
          }

          .featuredShell {
            width: min(1480px, 100%);
            margin: 0 auto;
          }

          .headingRow {
            margin-bottom: 28px;
          }

          .eyebrow {
            color: color-mix(
              in srgb,
              var(--ncs-secondary, #D4AF37) 84%,
              black 16%
            );
            font-size: 10px;
            font-weight: 950;
            letter-spacing: 1.8px;
          }

          h2 {
            margin: 8px 0 0;
            color: var(--ncs-primary, #0A2E73);
            font-size: clamp(40px, 5vw, 64px);
            line-height: 1;
            letter-spacing: -2px;
          }

          h2 strong {
            display: block;
            color: color-mix(
              in srgb,
              var(--ncs-secondary, #D4AF37) 84%,
              black 16%
            );
          }

          .headingRow p {
            margin: 14px 0 0;
            color: var(--ncs-muted, #667085);
            font-size: 13px;
          }

          .loadingGrid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
          }

          .loadingCard {
            overflow: hidden;
            padding-bottom: 14px;
            border-radius: 18px;
            background: #fff;
          }

          .loadingImage,
          .loadingLine,
          .loadingButton {
            background: linear-gradient(
              90deg,
              #edf0f5,
              #f8fafc,
              #edf0f5
            );
            background-size: 200% 100%;
            animation: shimmer 1.2s linear infinite;
          }

          .loadingImage {
            aspect-ratio: 4 / 5;
          }

          .loadingLine {
            width: 52%;
            height: 11px;
            margin: 12px 14px 0;
            border-radius: 999px;
          }

          .loadingLine.wide {
            width: 74%;
            height: 16px;
          }

          .loadingButton {
            height: 38px;
            margin: 15px 14px 0;
            border-radius: 10px;
          }

          @keyframes shimmer {
            from { background-position: 200% 0; }
            to { background-position: -200% 0; }
          }

          @media (max-width: 950px) {
            .loadingGrid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
        `}</style>
      </section>
    );
  }

  if (cards.length === 0) return null;

  const visibleCards = cards.slice(0, 12);
  const featuredCard = visibleCards[0] || null;
  const productCards = visibleCards.slice(1);

  return (
    <section className="featuredSection">
      <div className="ambientGrid" />
      <div className="ambientGlow glowOne" />
      <div className="ambientGlow glowTwo" />

      <div className="featuredShell">
        <div className="headingRow">
          <div className="headingCopy">
            <span className="eyebrow">LIVE PRODUCTS • DESIGNS • SIZES</span>

            <h2>
              Featured Fashion
              <strong>Ready To Shop</strong>
            </h2>

            <p>
              Shop live NEW CITY STYLE products with separate design cards,
              available sizes and current online pricing.
            </p>
          </div>

          <button
            type="button"
            className="allProductsButton"
            onClick={() => router.push("/search")}
          >
            <span>View Full Catalogue</span>
            <b>→</b>
          </button>
        </div>

        <div className="commerceSignals">
          <div>
            <span className="liveDot" />
            <p>
              <b>LIVE ONLINE</b>
              <small>Only available products are shown</small>
            </p>
          </div>

          <div>
            <span>◫</span>
            <p>
              <b>DESIGN AWARE</b>
              <small>Available designs stay separate</small>
            </p>
          </div>

          <div>
            <span>↔</span>
            <p>
              <b>SIZE READY</b>
              <small>Available sizes remain visible</small>
            </p>
          </div>
        </div>

        {featuredCard && (
          <article
            className="spotlightCard"
            onClick={() => openProduct(featuredCard)}
          >
            <div className="spotlightImage">
              {featuredCard.image ? (
                <img
                  src={featuredCard.image}
                  alt={
                    featuredCard.designName
                      ? `${featuredCard.name} - ${featuredCard.designName}`
                      : featuredCard.name
                  }
                  loading="eager"
                />
              ) : (
                <div className="imageFallback">NEW CITY STYLE</div>
              )}

              <div className="spotlightShade" />

              <span className="spotlightBadge">
                FEATURED NOW
              </span>

              {featuredCard.mrp > featuredCard.price && (
                <span className="spotlightDiscount">
                  {Math.round(
                    ((featuredCard.mrp - featuredCard.price) /
                      featuredCard.mrp) *
                      100
                  )}
                  % OFF
                </span>
              )}
            </div>

            <div className="spotlightContent">
              <span className="miniLabel">
                NEW CITY STYLE • LIVE PICK
              </span>

              <h3>
                {featuredCard.isDesign
                  ? featuredCard.designName
                  : featuredCard.name}
              </h3>

              {featuredCard.isDesign && (
                <p className="parentName">
                  {featuredCard.name}
                </p>
              )}

              {featuredCard.availableSizes.length > 0 && (
                <div className="sizeRow">
                  {featuredCard.availableSizes.map((size) => (
                    <span key={size}>{size}</span>
                  ))}
                </div>
              )}

              <div className="priceRow">
                <strong>
                  ₹{featuredCard.price.toLocaleString("en-IN")}
                </strong>

                {featuredCard.mrp > featuredCard.price && (
                  <del>
                    ₹{featuredCard.mrp.toLocaleString("en-IN")}
                  </del>
                )}
              </div>

              <div className="availability">
                <span className="availabilityDot" />
                Available online
              </div>

              <button
                type="button"
                className="spotlightButton"
                onClick={(event) => {
                  event.stopPropagation();
                  openProduct(featuredCard);
                }}
              >
                <span>View Product</span>
                <b>→</b>
              </button>
            </div>
          </article>
        )}

        {productCards.length > 0 && (
          <div className="productGrid">
            {productCards.map((item, index) => {
              const discount =
                item.mrp > item.price && item.mrp > 0
                  ? Math.round(
                      ((item.mrp - item.price) / item.mrp) * 100
                    )
                  : 0;

              return (
                <article
                  key={item.key}
                  className="productCard"
                  onClick={() => openProduct(item)}
                >
                  <div className="imageBox">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={
                          item.designName
                            ? `${item.name} - ${item.designName}`
                            : item.name
                        }
                        loading={index < 4 ? "eager" : "lazy"}
                      />
                    ) : (
                      <div className="imageFallback">
                        NEW CITY STYLE
                      </div>
                    )}

                    <div className="imageShade" />

                    <span className="cardIndex">
                      {String(index + 2).padStart(2, "0")}
                    </span>

                    {discount > 0 && (
                      <span className="discountBadge">
                        {discount}% OFF
                      </span>
                    )}

                    {item.isDesign && (
                      <span className="designBadge">
                        DESIGN
                      </span>
                    )}

                    {item.isLegacySlot &&
                      item.availableSizes.length > 0 && (
                        <span className="slotBadge">
                          {item.availableSizes.join(" • ")}
                        </span>
                      )}

                    <button
                      type="button"
                      className="quickView"
                      onClick={(event) => {
                        event.stopPropagation();
                        openProduct(item);
                      }}
                    >
                      Quick View
                    </button>
                  </div>

                  <div className="content">
                    <span className="productLabel">
                      {item.isDesign
                        ? "DESIGN PICK"
                        : "NEW CITY STYLE"}
                    </span>

                    <h3>
                      {item.isDesign
                        ? item.designName
                        : item.name}
                    </h3>

                    {item.isDesign && (
                      <div className="parentName">
                        {item.name}
                      </div>
                    )}

                    {item.availableSizes.length > 0 && (
                      <div className="sizesLine">
                        {item.availableSizes
                          .slice(0, 5)
                          .map((size) => (
                            <span key={size}>{size}</span>
                          ))}
                      </div>
                    )}

                    <div className="priceRow compact">
                      <strong>
                        ₹{item.price.toLocaleString("en-IN")}
                      </strong>

                      {item.mrp > item.price && (
                        <del>
                          ₹{item.mrp.toLocaleString("en-IN")}
                        </del>
                      )}
                    </div>

                    <div className="cardFooter">
                      <div className="availability">
                        <span className="availabilityDot" />
                        {item.isDesign || item.isLegacySlot
                          ? "Available online"
                          : `${item.quantity} available online`}
                      </div>

                      <span className="arrow">→</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="shopFooter">
          <div>
            <span className="footerDot" />
            <p>
              <b>Live commerce cards</b>
              <small>
                Product, design, size and price availability remain connected
                to your current catalogue logic.
              </small>
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/search")}
          >
            Continue Shopping →
          </button>
        </div>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .featuredSection {
          position: relative;
          overflow: hidden;
          padding: 90px 20px 104px;
          background:
            radial-gradient(
              circle at 92% 8%,
              rgba(var(--ncs-secondary-rgb, 212,175,55), .11),
              transparent 26%
            ),
            radial-gradient(
              circle at 4% 90%,
              rgba(var(--ncs-primary-rgb, 10,46,115), .08),
              transparent 24%
            ),
            linear-gradient(
              180deg,
              var(--ncs-page-bg, #f7f9fc),
              #ffffff
            );
        }

        .featuredShell {
          position: relative;
          z-index: 3;
          width: min(1480px, 100%);
          margin: 0 auto;
        }

        .ambientGrid {
          position: absolute;
          inset: 0;
          opacity: .04;
          pointer-events: none;
          background-image:
            linear-gradient(
              rgba(var(--ncs-primary-rgb, 10,46,115), .18) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(var(--ncs-primary-rgb, 10,46,115), .18) 1px,
              transparent 1px
            );
          background-size: 64px 64px;
          mask-image: linear-gradient(
            180deg,
            rgba(0,0,0,.8),
            transparent 90%
          );
        }

        .ambientGlow {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
        }

        .glowOne {
          top: 10px;
          right: -120px;
          width: 340px;
          height: 340px;
          background:
            rgba(var(--ncs-secondary-rgb, 212,175,55), .11);
        }

        .glowTwo {
          left: -140px;
          bottom: 20px;
          width: 370px;
          height: 370px;
          background:
            rgba(var(--ncs-primary-rgb, 10,46,115), .07);
        }

        .headingRow {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 30px;
        }

        .headingCopy {
          max-width: 880px;
        }

        .eyebrow {
          color:
            color-mix(
              in srgb,
              var(--ncs-secondary, #D4AF37) 84%,
              black 16%
            );
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 1.9px;
        }

        h2 {
          margin: 8px 0 0;
          color: var(--ncs-primary, #0A2E73);
          font-size: clamp(42px, 5.4vw, 70px);
          line-height: .98;
          letter-spacing: -2.3px;
        }

        h2 strong {
          display: block;
          color:
            color-mix(
              in srgb,
              var(--ncs-secondary, #D4AF37) 84%,
              black 16%
            );
          font-weight: 950;
        }

        .headingCopy > p {
          max-width: 760px;
          margin: 17px 0 0;
          color: var(--ncs-muted, #667085);
          font-size: 14px;
          line-height: 1.7;
        }

        .allProductsButton {
          min-height: 49px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          flex: 0 0 auto;
          padding: 0 18px;
          border:
            1px solid var(--ncs-secondary, #D4AF37);
          border-radius: 13px;
          background: var(--ncs-primary, #0A2E73);
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .allProductsButton b {
          color: var(--ncs-secondary, #D4AF37);
          font-size: 17px;
        }

        .commerceSignals {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 30px;
        }

        .commerceSignals > div {
          min-height: 60px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border:
            1px solid
            rgba(var(--ncs-primary-rgb, 10,46,115), .08);
          border-radius: 14px;
          background: rgba(255,255,255,.78);
          backdrop-filter: blur(10px);
        }

        .commerceSignals > div > span {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          flex: 0 0 30px;
          border-radius: 9px;
          background:
            color-mix(
              in srgb,
              var(--ncs-secondary, #D4AF37) 11%,
              white 89%
            );
          color: var(--ncs-primary, #0A2E73);
          font-size: 12px;
          font-weight: 950;
        }

        .commerceSignals .liveDot {
          position: relative;
          background:
            color-mix(in srgb, #17b26a 9%, white 91%);
        }

        .commerceSignals .liveDot::after {
          width: 8px;
          height: 8px;
          content: "";
          border-radius: 50%;
          background: #17b26a;
          box-shadow:
            0 0 0 5px rgba(23,178,106,.1);
        }

        .commerceSignals p {
          margin: 0;
        }

        .commerceSignals b,
        .commerceSignals small {
          display: block;
        }

        .commerceSignals b {
          color: var(--ncs-primary, #0A2E73);
          font-size: 9px;
          letter-spacing: .8px;
        }

        .commerceSignals small {
          margin-top: 3px;
          color: var(--ncs-muted, #667085);
          font-size: 8px;
        }

        .spotlightCard {
          display: grid;
          grid-template-columns:
            minmax(0, 1.1fr)
            minmax(330px, .9fr);
          overflow: hidden;
          min-height: 520px;
          margin-top: 38px;
          border:
            1px solid
            rgba(var(--ncs-primary-rgb, 10,46,115), .09);
          border-radius: 25px;
          background: #fff;
          box-shadow:
            0 22px 60px rgba(16,24,40,.11);
          cursor: pointer;
        }

        .spotlightImage {
          position: relative;
          min-height: 520px;
          overflow: hidden;
          background: #eef2f8;
        }

        .spotlightImage > img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform .6s ease;
        }

        .spotlightCard:hover .spotlightImage > img {
          transform: scale(1.035);
        }

        .spotlightShade {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(
              180deg,
              transparent 55%,
              rgba(3,20,50,.25)
            );
        }

        .spotlightBadge,
        .spotlightDiscount {
          position: absolute;
          top: 16px;
          padding: 8px 10px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .8px;
        }

        .spotlightBadge {
          left: 16px;
          background: rgba(4,22,55,.78);
          color: #fff;
          backdrop-filter: blur(9px);
        }

        .spotlightDiscount {
          right: 16px;
          background: var(--ncs-secondary, #D4AF37);
          color: var(--ncs-primary, #0A2E73);
        }

        .spotlightContent {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 38px;
        }

        .miniLabel {
          color:
            color-mix(
              in srgb,
              var(--ncs-secondary, #D4AF37) 84%,
              black 16%
            );
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1.4px;
        }

        .spotlightContent h3 {
          margin: 8px 0 0;
          color: var(--ncs-primary, #0A2E73);
          font-size: clamp(30px, 3.3vw, 48px);
          line-height: 1.02;
          letter-spacing: -1.5px;
        }

        .parentName {
          margin-top: 7px;
          color: var(--ncs-muted, #667085);
          font-size: 10px;
          font-weight: 750;
        }

        .sizeRow,
        .sizesLine {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .sizeRow {
          margin-top: 20px;
        }

        .sizeRow span,
        .sizesLine span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 31px;
          min-height: 27px;
          padding: 0 8px;
          border:
            1px solid
            rgba(var(--ncs-primary-rgb, 10,46,115), .13);
          border-radius: 8px;
          background:
            color-mix(
              in srgb,
              var(--ncs-primary, #0A2E73) 4%,
              white 96%
            );
          color: var(--ncs-primary, #0A2E73);
          font-size: 8px;
          font-weight: 850;
        }

        .priceRow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 21px;
        }

        .priceRow strong {
          color:
            color-mix(
              in srgb,
              var(--ncs-secondary, #D4AF37) 84%,
              black 16%
            );
          font-size: 32px;
          font-weight: 950;
        }

        .priceRow del {
          color: #98a2b3;
          font-size: 13px;
        }

        .availability {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 10px;
          color: #067647;
          font-size: 9px;
          font-weight: 850;
        }

        .availabilityDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #17b26a;
          box-shadow:
            0 0 0 4px rgba(23,178,106,.1);
        }

        .spotlightButton {
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          align-self: flex-start;
          margin-top: 23px;
          padding: 0 18px;
          border: 0;
          border-radius: 12px;
          background:
            linear-gradient(
              135deg,
              var(--ncs-primary, #0A2E73),
              color-mix(
                in srgb,
                var(--ncs-primary, #0A2E73) 75%,
                white 25%
              )
            );
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .spotlightButton b {
          color: var(--ncs-secondary, #D4AF37);
          font-size: 18px;
        }

        .imageFallback {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          background:
            linear-gradient(
              135deg,
              var(--ncs-primary, #0A2E73),
              color-mix(
                in srgb,
                var(--ncs-primary, #0A2E73) 74%,
                white 26%
              )
            );
          color: var(--ncs-secondary, #D4AF37);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 1.2px;
        }

        .productGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 16px;
        }

        .productCard {
          overflow: hidden;
          border:
            1px solid
            rgba(var(--ncs-primary-rgb, 10,46,115), .08);
          border-radius: 18px;
          background: #fff;
          box-shadow:
            0 12px 30px rgba(16,24,40,.07);
          cursor: pointer;
          transition:
            transform .24s ease,
            box-shadow .24s ease,
            border-color .24s ease;
        }

        .productCard:hover {
          transform: translateY(-5px);
          border-color:
            rgba(var(--ncs-secondary-rgb, 212,175,55), .5);
          box-shadow:
            0 20px 42px rgba(16,24,40,.12);
        }

        .imageBox {
          position: relative;
          overflow: hidden;
          aspect-ratio: 4 / 5;
          background: #eef2f8;
        }

        .imageBox > img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform .45s ease;
        }

        .productCard:hover .imageBox > img {
          transform: scale(1.04);
        }

        .imageShade {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              180deg,
              transparent 70%,
              rgba(3,20,50,.18)
            );
        }

        .cardIndex,
        .discountBadge,
        .designBadge,
        .slotBadge {
          position: absolute;
          z-index: 2;
        }

        .cardIndex {
          top: 10px;
          left: 10px;
          min-width: 34px;
          padding: 6px 7px;
          border:
            1px solid rgba(255,255,255,.2);
          border-radius: 8px;
          background: rgba(3,22,54,.58);
          color: #fff;
          font-size: 8px;
          font-weight: 950;
          text-align: center;
          backdrop-filter: blur(8px);
        }

        .discountBadge {
          top: 10px;
          right: 10px;
          padding: 6px 8px;
          border-radius: 999px;
          background: var(--ncs-secondary, #D4AF37);
          color: var(--ncs-primary, #0A2E73);
          font-size: 7px;
          font-weight: 950;
        }

        .designBadge {
          right: 10px;
          bottom: 10px;
          padding: 6px 8px;
          border-radius: 999px;
          background: rgba(3,22,54,.78);
          color: #fff;
          font-size: 7px;
          font-weight: 900;
          backdrop-filter: blur(8px);
        }

        .slotBadge {
          right: 10px;
          bottom: 10px;
          left: 10px;
          overflow: hidden;
          padding: 6px 8px;
          border-radius: 999px;
          background: rgba(3,22,54,.8);
          color: #fff;
          font-size: 7px;
          font-weight: 900;
          text-overflow: ellipsis;
          white-space: nowrap;
          backdrop-filter: blur(8px);
        }

        .quickView {
          position: absolute;
          z-index: 3;
          right: 12px;
          bottom: 12px;
          left: 12px;
          min-height: 38px;
          opacity: 0;
          transform: translateY(10px);
          border: 1px solid rgba(255,255,255,.22);
          border-radius: 10px;
          background: rgba(3,22,54,.82);
          color: #fff;
          font-size: 8px;
          font-weight: 900;
          cursor: pointer;
          backdrop-filter: blur(10px);
          transition:
            opacity .2s ease,
            transform .2s ease;
        }

        .productCard:hover .quickView {
          opacity: 1;
          transform: translateY(0);
        }

        .content {
          padding: 14px;
        }

        .productLabel {
          color:
            color-mix(
              in srgb,
              var(--ncs-secondary, #D4AF37) 84%,
              black 16%
            );
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .content h3 {
          min-height: 38px;
          display: -webkit-box;
          overflow: hidden;
          margin: 6px 0 0;
          color: var(--ncs-primary, #0A2E73);
          font-size: 14px;
          line-height: 1.35;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .sizesLine {
          margin-top: 9px;
        }

        .sizesLine span {
          min-width: 26px;
          min-height: 23px;
          padding: 0 6px;
          font-size: 7px;
        }

        .priceRow.compact {
          margin-top: 12px;
        }

        .priceRow.compact strong {
          font-size: 19px;
        }

        .priceRow.compact del {
          font-size: 10px;
        }

        .cardFooter {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 8px;
          margin-top: 3px;
        }

        .cardFooter .availability {
          min-width: 0;
          font-size: 7px;
        }

        .arrow {
          color: var(--ncs-primary, #0A2E73);
          font-size: 18px;
          font-weight: 900;
        }

        .shopFooter {
          min-height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 28px;
          padding: 12px 14px;
          border:
            1px solid
            rgba(var(--ncs-primary-rgb, 10,46,115), .08);
          border-radius: 14px;
          background: rgba(255,255,255,.76);
        }

        .shopFooter > div {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .footerDot {
          width: 8px;
          height: 8px;
          flex: 0 0 8px;
          border-radius: 50%;
          background: #17b26a;
          box-shadow:
            0 0 0 5px rgba(23,178,106,.1);
        }

        .shopFooter p {
          margin: 0;
        }

        .shopFooter b,
        .shopFooter small {
          display: block;
        }

        .shopFooter b {
          color: var(--ncs-primary, #0A2E73);
          font-size: 9px;
        }

        .shopFooter small {
          margin-top: 3px;
          color: var(--ncs-muted, #667085);
          font-size: 8px;
        }

        .shopFooter button {
          min-height: 34px;
          flex: 0 0 auto;
          padding: 0 11px;
          border:
            1px solid var(--ncs-secondary, #D4AF37);
          border-radius: 9px;
          background: transparent;
          color: var(--ncs-primary, #0A2E73);
          font-size: 8px;
          font-weight: 900;
          cursor: pointer;
        }

        @media (max-width: 1100px) {
          .headingRow {
            align-items: flex-start;
            flex-direction: column;
          }

          .commerceSignals {
            grid-template-columns: 1fr;
          }

          .spotlightCard {
            grid-template-columns: 1fr;
          }

          .spotlightImage {
            min-height: 460px;
          }

          .productGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .featuredSection {
            padding: 62px 9px 80px;
          }

          h2 {
            font-size: 40px;
          }

          .headingCopy > p {
            font-size: 12px;
            line-height: 1.6;
          }

          .allProductsButton {
            width: 100%;
          }

          .commerceSignals {
            display: flex;
            overflow-x: auto;
            gap: 8px;
            margin-right: -9px;
            padding-right: 9px;
            scrollbar-width: none;
          }

          .commerceSignals::-webkit-scrollbar {
            display: none;
          }

          .commerceSignals > div {
            min-width: 230px;
            flex: 0 0 230px;
          }

          .spotlightCard {
            min-height: 0;
            border-radius: 18px;
          }

          .spotlightImage {
            min-height: 390px;
          }

          .spotlightContent {
            padding: 20px;
          }

          .spotlightContent h3 {
            font-size: 34px;
          }

          .priceRow strong {
            font-size: 27px;
          }

          .spotlightButton {
            width: 100%;
          }

          .productGrid {
            display: flex;
            overflow-x: auto;
            gap: 10px;
            margin-right: -9px;
            padding-right: 9px;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
          }

          .productGrid::-webkit-scrollbar {
            display: none;
          }

          .productCard {
            min-width: 72vw;
            flex: 0 0 72vw;
            scroll-snap-align: start;
          }

          .quickView {
            display: none;
          }

          .content h3 {
            font-size: 13px;
          }

          .shopFooter {
            align-items: flex-start;
            flex-direction: column;
          }

          .shopFooter button {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}
