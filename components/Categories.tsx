"use client";



import { useEffect, useMemo, useState, type SyntheticEvent } from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";



type ProductRow = {

  category?: string | null;

  subcategory?: string | null;

  sell_online?: boolean | null;

  is_active?: boolean | null;

};



type CategoryRow = Record<string, unknown> & {

  id?: string | number | null;

  name?: string | null;

  title?: string | null;

  category_name?: string | null;

  slug?: string | null;

  description?: string | null;

  subtitle?: string | null;

  image_url?: string | null;

  image?: string | null;

  category_image?: string | null;

  cover_image?: string | null;

  banner_image?: string | null;

  thumbnail_url?: string | null;

  active?: boolean | null;

  is_active?: boolean | null;

  status?: string | null;

  sort_order?: number | null;

  display_order?: number | null;

  position?: number | null;

};



type CategoryCard = {

  title: string;

  subtitle: string;

  imageUrl: string;

  route: string;

  sortOrder: number;

};



const fallbackImages: Record<string, string> = {

  men: "https\://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=900&q=85",

  women:

    "https\://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=900&q=85",

  kids: "https\://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=900&q=85",

  sarees:

    "https\://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=85",

  default:

    "https\://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=85",

};



const defaultCategories: CategoryCard[] = [

  {

    title: "Men",

    subtitle: "Premium shirts, jeans and everyday fashion",

    imageUrl: fallbackImages.men,

    route: "/search?q=Men",

    sortOrder: 1,

  },

  {

    title: "Women",

    subtitle: "Elegant sarees, tops and modern fashion",

    imageUrl: fallbackImages.women,

    route: "/search?q=Women",

    sortOrder: 2,

  },

  {

    title: "Kids",

    subtitle: "Comfortable and stylish kids wear",

    imageUrl: fallbackImages.kids,

    route: "/search?q=Kids",

    sortOrder: 3,

  },

  {

    title: "Sarees",

    subtitle: "Beautiful sarees for every occasion",

    imageUrl: fallbackImages.sarees,

    route: "/search?q=Sarees",

    sortOrder: 4,

  },

];



function normalizeCategory(value: string) {

  return value.trim().toLowerCase();

}



function formatCategoryName(value: string) {

  const cleanValue = value.trim();



  if (!cleanValue) return "";



  return cleanValue

    .split(/\s+/)

    .map(

      (word) =>

        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()

    )

    .join(" ");

}



function getStringValue(...values: unknown[]) {

  for (const value of values) {

    if (typeof value === "string" && value.trim()) {

      return value.trim();

    }

  }



  return "";

}



function getNumberValue(...values: unknown[]) {

  for (const value of values) {

    if (typeof value === "number" && Number.isFinite(value)) {

      return value;

    }



    if (typeof value === "string" && value.trim()) {

      const parsed = Number(value);



      if (Number.isFinite(parsed)) {

        return parsed;

      }

    }

  }



  return Number.MAX_SAFE_INTEGER;

}



function isCategoryActive(category: CategoryRow) {

  if (category.active === false || category.is_active === false) {

    return false;

  }



  const status = getStringValue(category.status).toLowerCase();



  if (

    status === "inactive" ||

    status === "disabled" ||

    status === "draft"

  ) {

    return false;

  }



  return true;

}



function getCategoryName(category: CategoryRow) {

  return formatCategoryName(

    getStringValue(

      category.name,

      category.title,

      category.category_name

    )

  );

}



function getSavedCategoryImage(category: CategoryRow) {

  return getStringValue(

    category.image_url,

    category.image,

    category.category_image,

    category.cover_image,

    category.banner_image,

    category.thumbnail_url

  );

}



function getFallbackImage(category: string) {

  const value = normalizeCategory(category);



  if (

    value === "men" ||

    value.includes("mens") ||

    value.includes("shirt") ||

    value.includes("jean")

  ) {

    return fallbackImages.men;

  }



  if (

    value === "women" ||

    value.includes("womens") ||

    value.includes("ladies") ||

    value.includes("top") ||

    value.includes("dress")

  ) {

    return fallbackImages.women;

  }



  if (

    value.includes("kid") ||

    value.includes("boy") ||

    value.includes("girl") ||

    value.includes("child")

  ) {

    return fallbackImages.kids;

  }



  if (value.includes("saree") || value.includes("sari")) {

    return fallbackImages.sarees;

  }



  return fallbackImages.default;

}



function getCategorySubtitle(category: string) {

  const value = normalizeCategory(category);



  if (value === "men" || value.includes("mens")) {

    return "Premium shirts, jeans and everyday fashion";

  }



  if (value === "women" || value.includes("womens")) {

    return "Elegant sarees, tops and modern fashion";

  }



  if (value.includes("kid")) {

    return "Comfortable and stylish kids wear";

  }



  if (value.includes("saree") || value.includes("sari")) {

    return "Beautiful sarees for every occasion";

  }



  return `Explore our premium ${formatCategoryName(

    category

  )} collection`;

}



function getCategoryRoute(categoryName: string) {

  return `/search?q=${encodeURIComponent(categoryName)}`;

}



function toCategoryCard(category: CategoryRow): CategoryCard | null {

  const title = getCategoryName(category);



  if (!title || !isCategoryActive(category)) {

    return null;

  }



  return {

    title,

    subtitle:

      getStringValue(category.description, category.subtitle) ||

      getCategorySubtitle(title),

    imageUrl: getSavedCategoryImage(category) || getFallbackImage(title),

    route: getCategoryRoute(title),

    sortOrder: getNumberValue(

      category.sort_order,

      category.display_order,

      category.position

    ),

  };

}



export default function Categories() {

  const router = useRouter();



  const [savedCategories, setSavedCategories] = useState<CategoryCard[]>([]);

  const [productCategories, setProductCategories] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    loadCategories();

  }, []);



  async function loadCategories() {

    setLoading(true);



    try {

      const [categoriesResult, productsResult] = await Promise.all([

        supabase.from("categories").select("*"),

        supabase

          .from("products")

          .select("category,subcategory,sell_online,is_active")

          .eq("sell_online", true)

          .eq("is_active", true),

      ]);



      if (categoriesResult.error) {

        console.error(

          "Categories table load error:",

          categoriesResult.error

        );

      }



      const categoryCards = ((categoriesResult.data as CategoryRow[]) || [])

        .map(toCategoryCard)

        .filter((item): item is CategoryCard => Boolean(item))

        .sort((a, b) => {

          if (a.sortOrder !== b.sortOrder) {

            return a.sortOrder - b.sortOrder;

          }



          return a.title.localeCompare(b.title);

        });



      setSavedCategories(categoryCards);



      if (productsResult.error) {

        console.error(

          "Product categories load error:",

          productsResult.error

        );

        setProductCategories([]);

      } else {

        const uniqueMap = new Map<string, string>();



        ((productsResult.data as ProductRow[]) || []).forEach((item) => {

          [item.category, item.subcategory].forEach((value) => {

            const cleanValue = value?.trim();



            if (!cleanValue) return;



            const normalized = normalizeCategory(cleanValue);



            if (!uniqueMap.has(normalized)) {

              uniqueMap.set(

                normalized,

                formatCategoryName(cleanValue)

              );

            }

          });

        });



        setProductCategories(

          Array.from(uniqueMap.values()).sort((a, b) =>

            a.localeCompare(b)

          )

        );

      }

    } catch (error) {

      console.error("Categories load error:", error);

      setSavedCategories([]);

      setProductCategories([]);

    } finally {

      setLoading(false);

    }

  }



  const categories = useMemo<CategoryCard[]>(() => {

    const combinedMap = new Map<string, CategoryCard>();



    defaultCategories.forEach((item) => {

      combinedMap.set(normalizeCategory(item.title), item);

    });



    savedCategories.forEach((item) => {

      const key = normalizeCategory(item.title);

      const existingItem = combinedMap.get(key);



      combinedMap.set(key, {

        ...existingItem,

        ...item,

        subtitle: item.subtitle || existingItem?.subtitle || "",

        imageUrl:

          item.imageUrl ||

          existingItem?.imageUrl ||

          getFallbackImage(item.title),

        route: existingItem?.route || item.route,

      });

    });



    productCategories.forEach((category) => {

      const key = normalizeCategory(category);



      if (!combinedMap.has(key)) {

        combinedMap.set(key, {

          title: formatCategoryName(category),

          subtitle: getCategorySubtitle(category),

          imageUrl: getFallbackImage(category),

          route: getCategoryRoute(category),

          sortOrder: Number.MAX_SAFE_INTEGER,

        });

      }

    });



    const priority = ["men", "women", "kids", "sarees"];



    return Array.from(combinedMap.values())

      .sort((a, b) => {

        const aPriority = priority.indexOf(normalizeCategory(a.title));

        const bPriority = priority.indexOf(normalizeCategory(b.title));



        if (aPriority !== -1 || bPriority !== -1) {

          if (aPriority === -1) return 1;

          if (bPriority === -1) return -1;

          return aPriority - bPriority;

        }



        if (a.sortOrder !== b.sortOrder) {

          return a.sortOrder - b.sortOrder;

        }



        return a.title.localeCompare(b.title);

      })

      .slice(0, 8);

  }, [productCategories, savedCategories]);



  function openCategory(category: CategoryCard) {

    router.push(category.route);

  }



  function handleImageError(

    event: SyntheticEvent<HTMLImageElement>,

    categoryTitle: string

  ) {

    const image = event.currentTarget;

    const fallback = getFallbackImage(categoryTitle);



    if (image.src !== fallback) {

      image.src = fallback;

    }

  }



  const featured = categories.slice(0, 4);
  const secondary = categories.slice(4);

  return (
    <section className="categoriesSection">
      <div className="ambientGrid" />
      <div className="ambientGlow glowLeft" />
      <div className="ambientGlow glowRight" />

      <div className="container">
        <div className="headingRow">
          <div className="headingArea">
            <p className="eyebrow">SHOP BY MOOD • CATEGORY • FAMILY</p>

            <h2>
              Discover Your
              <strong>Next Look</strong>
            </h2>

            <p className="subtitle">
              Browse premium NEW CITY STYLE collections with live online
              availability, image-first discovery and faster category access.
            </p>
          </div>

          <button
            type="button"
            className="allProductsButton"
            onClick={() => router.push("/search")}
          >
            <span>Explore Full Catalogue</span>
            <b>→</b>
          </button>
        </div>

        <div className="signalStrip">
          <div>
            <span className="signalDot" />
            <p>
              <b>LIVE CATEGORIES</b>
              <small>Built from your active catalogue</small>
            </p>
          </div>

          <div>
            <span>✦</span>
            <p>
              <b>SMART DISCOVERY</b>
              <small>Fast route into product search</small>
            </p>
          </div>

          <div>
            <span>◫</span>
            <p>
              <b>IMAGE FIRST</b>
              <small>Admin category imagery stays connected</small>
            </p>
          </div>
        </div>

        {loading ? (
          <div className="featuredGrid">
            {[1, 2, 3, 4].map((item) => (
              <div className="skeletonCard" key={item}>
                <div className="skeletonImage" />
                <div className="skeletonContent">
                  <div className="skeletonTitle" />
                  <div className="skeletonLine" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="featuredGrid">
              {featured.map((item, index) => (
                <article
                  key={`${item.title}-${index}`}
                  className={`categoryCard featuredCard card${index + 1}`}
                  onClick={() => openCategory(item)}
                >
                  <div className="imageWrap">
                    <img
                      src={item.imageUrl}
                      alt={`${item.title} category`}
                      loading="lazy"
                      onError={(event) =>
                        handleImageError(event, item.title)
                      }
                    />

                    <div className="imageOverlay" />
                    <div className="softTint" />

                    <span className="categoryIndex">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="liveTag">LIVE ONLINE</span>
                  </div>

                  <div className="cardContent">
                    <span className="miniLabel">NEW CITY STYLE</span>
                    <h3>{item.title}</h3>
                    <p>{item.subtitle}</p>

                    <div className="cardFooter">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openCategory(item);
                        }}
                      >
                        Shop {item.title}
                      </button>

                      <span>→</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {secondary.length > 0 && (
              <div className="secondarySection">
                <div className="secondaryHeader">
                  <div>
                    <span>MORE TO EXPLORE</span>
                    <h3>Browse More Collections</h3>
                  </div>

                  <small>Swipe on mobile • Tap any collection to continue</small>
                </div>

                <div className="secondaryRail">
                  {secondary.map((item, index) => (
                    <button
                      type="button"
                      key={`${item.title}-secondary-${index}`}
                      className="miniCard"
                      onClick={() => openCategory(item)}
                    >
                      <div className="miniImage">
                        <img
                          src={item.imageUrl}
                          alt={`${item.title} category`}
                          loading="lazy"
                          onError={(event) =>
                            handleImageError(event, item.title)
                          }
                        />
                        <div className="miniOverlay" />
                      </div>

                      <div className="miniInfo">
                        <strong>{item.title}</strong>
                        <span>Explore collection</span>
                      </div>

                      <b>→</b>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="footerNote">
          <div>
            <span className="footerDot" />
            <p>
              <b>Connected to Admin Categories</b>
              <small>
                Saved images and active product categories update this section automatically.
              </small>
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/search")}
          >
            Shop Everything →
          </button>
        </div>
      </div>

      <style jsx>{`
        * { box-sizing: border-box; }

        .categoriesSection {
          position: relative;
          overflow: hidden;
          padding: 88px 20px 92px;
          background:
            radial-gradient(circle at 8% 10%, rgba(var(--ncs-secondary-rgb, 212,175,55), .12), transparent 28%),
            radial-gradient(circle at 92% 82%, rgba(var(--ncs-primary-rgb, 10,46,115), .09), transparent 26%),
            linear-gradient(180deg, color-mix(in srgb, var(--ncs-page-bg, #F7F8FC) 94%, white 6%) 0%, var(--ncs-surface, #ffffff) 100%);
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
          opacity: .05;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(var(--ncs-primary-rgb, 10,46,115), .15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(var(--ncs-primary-rgb, 10,46,115), .15) 1px, transparent 1px);
          background-size: 62px 62px;
          mask-image: linear-gradient(180deg, rgba(0,0,0,.9), transparent 86%);
        }

        .ambientGlow {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }

        .glowLeft {
          top: 90px;
          left: -120px;
          width: 330px;
          height: 330px;
          background: rgba(var(--ncs-secondary-rgb, 212,175,55), .11);
        }

        .glowRight {
          right: -120px;
          bottom: 40px;
          width: 360px;
          height: 360px;
          background: rgba(var(--ncs-primary-rgb, 10,46,115), .08);
        }

        .headingRow {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 30px;
        }

        .headingArea { max-width: 850px; }

        .eyebrow {
          margin: 0 0 11px;
          color: color-mix(in srgb, var(--ncs-secondary, #D4AF37) 85%, black 15%);
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 2px;
        }

        h2 {
          margin: 0;
          color: var(--ncs-primary, #0a2e73);
          font-size: clamp(42px, 5.5vw, 70px);
          line-height: .98;
          letter-spacing: -2.4px;
        }

        h2 strong {
          display: block;
          color: color-mix(in srgb, var(--ncs-secondary, #D4AF37) 84%, black 16%);
          font-weight: 950;
        }

        .subtitle {
          max-width: 760px;
          margin: 18px 0 0;
          color: var(--ncs-muted, #667085);
          font-size: 15px;
          line-height: 1.75;
        }

        .allProductsButton {
          min-height: 49px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          flex: 0 0 auto;
          padding: 0 18px;
          border: 1px solid var(--ncs-secondary, #D4AF37);
          border-radius: 13px;
          background: var(--ncs-primary, #0A2E73);
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 12px 30px rgba(var(--ncs-primary-rgb,10,46,115), .12);
        }

        .allProductsButton b {
          color: var(--ncs-secondary, #D4AF37);
          font-size: 17px;
        }

        .signalStrip {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 30px;
        }

        .signalStrip > div {
          min-height: 60px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border: 1px solid rgba(var(--ncs-primary-rgb,10,46,115), .08);
          border-radius: 14px;
          background: rgba(255,255,255,.72);
          backdrop-filter: blur(10px);
        }

        .signalStrip > div > span {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          flex: 0 0 30px;
          border-radius: 9px;
          background: color-mix(in srgb, var(--ncs-secondary, #D4AF37) 11%, white 89%);
          color: var(--ncs-primary, #0A2E73);
          font-size: 12px;
          font-weight: 950;
        }

        .signalStrip .signalDot {
          position: relative;
          background: color-mix(in srgb, #17b26a 9%, white 91%);
        }

        .signalStrip .signalDot::after {
          width: 8px;
          height: 8px;
          content: "";
          border-radius: 50%;
          background: #17b26a;
          box-shadow: 0 0 0 5px rgba(23,178,106,.1);
        }

        .signalStrip p { margin: 0; }
        .signalStrip b, .signalStrip small { display: block; }

        .signalStrip b {
          color: var(--ncs-primary, #0A2E73);
          font-size: 9px;
          letter-spacing: .8px;
        }

        .signalStrip small {
          margin-top: 3px;
          color: var(--ncs-muted, #667085);
          font-size: 8px;
        }

        .featuredGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(0, .9fr) minmax(0, .9fr);
          grid-template-rows: repeat(2, minmax(250px, 1fr));
          gap: 14px;
          margin-top: 38px;
        }

        .featuredCard, .skeletonCard {
          position: relative;
          overflow: hidden;
          min-height: 250px;
          border: 1px solid rgba(var(--ncs-primary-rgb,10,46,115), .09);
          border-radius: 22px;
          background: #fff;
          box-shadow: 0 16px 38px rgba(16,24,40,.08);
        }

        .card1 { grid-row: 1 / 3; }
        .card4 { grid-column: 2 / 4; }

        .featuredCard {
          cursor: pointer;
          transition: transform .28s ease, box-shadow .28s ease, border-color .28s ease;
        }

        .featuredCard:hover {
          transform: translateY(-6px);
          border-color: rgba(var(--ncs-secondary-rgb,212,175,55), .6);
          box-shadow: 0 24px 55px rgba(16,24,40,.14);
        }

        .imageWrap {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background: #eef2f8;
        }

        .imageWrap img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform .55s ease;
        }

        .featuredCard:hover .imageWrap img { transform: scale(1.05); }

        .imageOverlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(3,16,42,.06) 0%, rgba(3,19,50,.18) 42%, rgba(3,18,46,.87) 100%);
        }

        .softTint {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 85% 12%, rgba(var(--ncs-secondary-rgb,212,175,55), .17), transparent 28%);
        }

        .categoryIndex, .liveTag {
          position: absolute;
          z-index: 3;
          top: 14px;
        }

        .categoryIndex {
          left: 14px;
          min-width: 42px;
          padding: 7px 9px;
          border: 1px solid rgba(255,255,255,.22);
          border-radius: 10px;
          background: rgba(4,22,55,.58);
          color: #fff;
          font-size: 12px;
          font-weight: 950;
          backdrop-filter: blur(10px);
        }

        .liveTag {
          right: 14px;
          padding: 7px 9px;
          border: 1px solid rgba(212,175,55,.38);
          border-radius: 999px;
          background: rgba(4,22,55,.62);
          color: #eed36f;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: .8px;
          backdrop-filter: blur(10px);
        }

        .cardContent {
          position: absolute;
          z-index: 4;
          right: 0;
          bottom: 0;
          left: 0;
          padding: 22px;
          color: #fff;
        }

        .miniLabel {
          color: #eed36f;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 1.4px;
        }

        .cardContent h3 {
          margin: 7px 0 0;
          color: #fff;
          font-size: clamp(24px, 2.4vw, 38px);
          line-height: 1.05;
          letter-spacing: -1px;
        }

        .cardContent p {
          max-width: 460px;
          margin: 9px 0 0;
          color: rgba(255,255,255,.68);
          font-size: 10px;
          line-height: 1.55;
        }

        .cardFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 16px;
        }

        .cardFooter button {
          min-height: 36px;
          padding: 0 13px;
          border: 1px solid rgba(255,255,255,.24);
          border-radius: 10px;
          background: rgba(255,255,255,.08);
          color: #fff;
          font-size: 9px;
          font-weight: 850;
          cursor: pointer;
          backdrop-filter: blur(10px);
        }

        .cardFooter > span {
          color: var(--ncs-secondary, #D4AF37);
          font-size: 24px;
          font-weight: 900;
        }

        .secondarySection {
          margin-top: 34px;
          padding-top: 26px;
          border-top: 1px solid rgba(var(--ncs-primary-rgb,10,46,115), .08);
        }

        .secondaryHeader {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
        }

        .secondaryHeader span {
          color: color-mix(in srgb, var(--ncs-secondary, #D4AF37) 85%, black 15%);
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1.4px;
        }

        .secondaryHeader h3 {
          margin: 5px 0 0;
          color: var(--ncs-primary, #0A2E73);
          font-size: 24px;
        }

        .secondaryHeader small {
          color: var(--ncs-muted, #667085);
          font-size: 8px;
        }

        .secondaryRail {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 15px;
        }

        .miniCard {
          position: relative;
          min-width: 0;
          display: grid;
          grid-template-columns: 72px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          overflow: hidden;
          padding: 8px;
          border: 1px solid rgba(var(--ncs-primary-rgb,10,46,115), .08);
          border-radius: 14px;
          background: #fff;
          color: inherit;
          text-align: left;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(16,24,40,.05);
          transition: .2s ease;
        }

        .miniCard:hover {
          transform: translateY(-2px);
          border-color: rgba(var(--ncs-secondary-rgb,212,175,55), .45);
        }

        .miniImage {
          position: relative;
          width: 72px;
          height: 78px;
          overflow: hidden;
          border-radius: 10px;
          background: #eef2f8;
        }

        .miniImage img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .miniOverlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, transparent, rgba(3,20,50,.25));
        }

        .miniInfo { min-width: 0; }

        .miniInfo strong, .miniInfo span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .miniInfo strong {
          color: var(--ncs-primary, #0A2E73);
          font-size: 11px;
        }

        .miniInfo span {
          margin-top: 4px;
          color: var(--ncs-muted, #667085);
          font-size: 8px;
        }

        .miniCard > b {
          color: var(--ncs-secondary, #D4AF37);
          font-size: 18px;
        }

        .footerNote {
          min-height: 58px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 28px;
          padding: 12px 14px;
          border: 1px solid rgba(var(--ncs-primary-rgb,10,46,115), .08);
          border-radius: 14px;
          background: rgba(255,255,255,.7);
        }

        .footerNote > div {
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
          box-shadow: 0 0 0 5px rgba(23,178,106,.1);
        }

        .footerNote p { margin: 0; }
        .footerNote b, .footerNote small { display: block; }

        .footerNote b {
          color: var(--ncs-primary, #0A2E73);
          font-size: 9px;
        }

        .footerNote small {
          margin-top: 3px;
          color: var(--ncs-muted, #667085);
          font-size: 8px;
        }

        .footerNote button {
          min-height: 34px;
          flex: 0 0 auto;
          padding: 0 11px;
          border: 1px solid var(--ncs-secondary, #D4AF37);
          border-radius: 9px;
          background: transparent;
          color: var(--ncs-primary, #0A2E73);
          font-size: 8px;
          font-weight: 900;
          cursor: pointer;
        }

        .skeletonImage, .skeletonTitle, .skeletonLine {
          background: linear-gradient(90deg, #eef1f5, #f7f9fb, #eef1f5);
          background-size: 200% 100%;
          animation: skeleton 1.2s infinite linear;
        }

        .skeletonImage {
          position: absolute;
          inset: 0;
        }

        .skeletonContent {
          position: absolute;
          z-index: 2;
          right: 0;
          bottom: 0;
          left: 0;
          padding: 20px;
        }

        .skeletonTitle {
          width: 48%;
          height: 22px;
          border-radius: 999px;
        }

        .skeletonLine {
          width: 72%;
          height: 10px;
          margin-top: 11px;
          border-radius: 999px;
        }

        @keyframes skeleton {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }

        @media (max-width: 1100px) {
          .headingRow {
            align-items: flex-start;
            flex-direction: column;
          }

          .signalStrip { grid-template-columns: 1fr; }

          .featuredGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            grid-template-rows: repeat(2, minmax(280px, 1fr));
          }

          .card1, .card4 {
            grid-row: auto;
            grid-column: auto;
          }

          .secondaryRail {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .categoriesSection {
            padding: 62px 9px 76px;
          }

          .headingRow { gap: 18px; }

          h2 { font-size: 40px; }

          .subtitle {
            font-size: 12px;
            line-height: 1.6;
          }

          .allProductsButton { width: 100%; }

          .signalStrip {
            display: flex;
            overflow-x: auto;
            gap: 8px;
            margin-right: -9px;
            padding-right: 9px;
            scrollbar-width: none;
          }

          .signalStrip::-webkit-scrollbar { display: none; }

          .signalStrip > div {
            min-width: 230px;
            flex: 0 0 230px;
          }

          .featuredGrid {
            display: flex;
            overflow-x: auto;
            gap: 10px;
            margin-right: -9px;
            padding-right: 9px;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
          }

          .featuredGrid::-webkit-scrollbar { display: none; }

          .featuredCard, .skeletonCard {
            min-width: 82vw;
            min-height: 390px;
            flex: 0 0 82vw;
            scroll-snap-align: start;
            border-radius: 18px;
          }

          .cardContent { padding: 17px; }
          .cardContent h3 { font-size: 30px; }
          .cardContent p { font-size: 9px; }

          .secondaryHeader {
            align-items: flex-start;
            flex-direction: column;
            gap: 5px;
          }

          .secondaryRail {
            display: flex;
            overflow-x: auto;
            gap: 8px;
            margin-right: -9px;
            padding-right: 9px;
            scrollbar-width: none;
          }

          .secondaryRail::-webkit-scrollbar { display: none; }

          .miniCard {
            min-width: 270px;
            flex: 0 0 270px;
          }

          .footerNote {
            align-items: flex-start;
            flex-direction: column;
          }

          .footerNote button { width: 100%; }
        }
      `}</style>
    </section>
  );
}
