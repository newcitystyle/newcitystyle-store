"use client";

import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ProductRow = {
  category?: string | null;
  subcategory?: string | null;
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
  men: "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=900&q=85",
  women:
    "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=900&q=85",
  kids: "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=900&q=85",
  sarees:
    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=85",
  default:
    "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=85",
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
        supabase.from("products").select("category,subcategory"),
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

  return (
    <section className="categoriesSection">
      <div className="decor decorOne" />
      <div className="decor decorTwo" />

      <div className="container">
        <div className="headingArea">
          <p className="eyebrow">DISCOVER YOUR STYLE</p>

          <h2>Shop By Category</h2>

          <p className="subtitle">
            Explore premium collections created for every member of the
            family.
          </p>
        </div>

        {loading ? (
          <div className="categoryGrid">
            {[1, 2, 3, 4].map((item) => (
              <div className="skeletonCard" key={item}>
                <div className="skeletonImage" />
                <div className="skeletonContent">
                  <div className="skeletonTitle" />
                  <div className="skeletonLine" />
                  <div className="skeletonButton" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="categoryGrid">
            {categories.map((item, index) => (
              <article
                key={`${item.title}-${index}`}
                className="categoryCard"
                onClick={() => openCategory(item)}
              >
                <div className="cardGlow" />

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

                  <span className="categoryNumber">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className="cardContent">
                  <h3>{item.title}</h3>

                  <p>{item.subtitle}</p>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openCategory(item);
                    }}
                  >
                    Explore
                    <span>→</span>
                  </button>
                </div>

                <div className="bottomAccent" />
              </article>
            ))}
          </div>
        )}

        <div className="footerNote">
          <span className="footerDot" />
          Category images update automatically from Admin Categories.
        </div>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .categoriesSection {
          position: relative;
          overflow: hidden;
          padding: 78px 20px;
          background:
            radial-gradient(
              circle at 15% 20%,
              rgba(212, 175, 55, 0.11),
              transparent 26%
            ),
            radial-gradient(
              circle at 85% 80%,
              rgba(10, 46, 115, 0.08),
              transparent 28%
            ),
            linear-gradient(180deg, #f8f4ec 0%, #ffffff 100%);
        }

        .container {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 1380px;
          margin: 0 auto;
        }

        .headingArea {
          max-width: 760px;
          margin: 0 auto;
          text-align: center;
        }

        .eyebrow {
          margin: 0 0 12px;
          color: #d4af37;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2.3px;
        }

        h2 {
          margin: 0;
          color: #0a2e73;
          font-size: clamp(38px, 5vw, 58px);
          line-height: 1.08;
          letter-spacing: -1.6px;
        }

        .subtitle {
          margin: 17px auto 0;
          color: #667085;
          font-size: 17px;
          line-height: 1.7;
        }

        .categoryGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 20px;
          margin-top: 46px;
        }

        .categoryCard,
        .skeletonCard {
          position: relative;
          overflow: hidden;
          min-height: 340px;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.97);
          box-shadow: 0 12px 32px rgba(16, 24, 40, 0.08);
        }

        .categoryCard {
          cursor: pointer;
          transition:
            transform 0.35s ease,
            box-shadow 0.35s ease,
            border-color 0.35s ease;
        }

        .categoryCard:hover {
          transform: translateY(-10px);
          border-color: rgba(212, 175, 55, 0.75);
          box-shadow: 0 26px 55px rgba(16, 24, 40, 0.16);
        }

        .cardGlow {
          position: absolute;
          top: -85px;
          right: -85px;
          z-index: 1;
          width: 190px;
          height: 190px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(212, 175, 55, 0.2),
            transparent 70%
          );
          pointer-events: none;
        }

        .imageWrap {
          position: relative;
          width: 100%;
          height: 180px;
          overflow: hidden;
          background: #f8f4ec;
        }

        .imageWrap img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          object-position: center;
          transition: transform 0.55s ease;
        }

        .categoryCard:hover .imageWrap img {
          transform: scale(1.07);
        }

        .imageOverlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(10, 46, 115, 0.02) 20%,
            rgba(10, 46, 115, 0.45) 100%
          );
          pointer-events: none;
        }

        .categoryNumber {
          position: absolute;
          top: 14px;
          right: 15px;
          z-index: 2;
          min-width: 48px;
          padding: 8px 10px;
          border: 1px solid rgba(212, 175, 55, 0.8);
          border-radius: 12px;
          background: rgba(10, 46, 115, 0.86);
          color: #ffffff;
          font-size: 17px;
          font-weight: 950;
          line-height: 1;
          text-align: center;
          backdrop-filter: blur(7px);
        }

        .cardContent {
          position: relative;
          z-index: 2;
          padding: 20px 22px 22px;
        }

        h3 {
          position: relative;
          z-index: 2;
          margin: 0;
          color: #0a2e73;
          font-size: 25px;
          font-weight: 900;
          line-height: 1.2;
        }

        .categoryCard p {
          position: relative;
          z-index: 2;
          min-height: 43px;
          margin: 9px 0 0;
          color: #667085;
          font-size: 13px;
          line-height: 1.6;
        }

        .categoryCard button {
          position: relative;
          z-index: 2;
          width: 100%;
          min-height: 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 18px;
          border: 1px solid #d4af37;
          border-radius: 11px;
          background: linear-gradient(135deg, #d4af37, #f1d26a);
          color: #0a2e73;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .categoryCard button:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(212, 175, 55, 0.28);
        }

        .bottomAccent {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 3;
          height: 5px;
          background: linear-gradient(
            90deg,
            #0a2e73,
            #d4af37,
            #0a2e73
          );
          transform: scaleX(0);
          transition: transform 0.35s ease;
        }

        .categoryCard:hover .bottomAccent {
          transform: scaleX(1);
        }

        .footerNote {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 31px;
          color: #667085;
          font-size: 12px;
          text-align: center;
        }

        .footerDot {
          width: 8px;
          height: 8px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: #d4af37;
          box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.16);
        }

        .decor {
          position: absolute;
          border: 1px solid rgba(212, 175, 55, 0.22);
          pointer-events: none;
        }

        .decorOne {
          top: 12%;
          left: 4%;
          width: 54px;
          height: 54px;
          transform: rotate(45deg);
        }

        .decorTwo {
          right: 5%;
          bottom: 14%;
          width: 34px;
          height: 34px;
          border-radius: 50%;
        }

        .skeletonImage,
        .skeletonTitle,
        .skeletonLine,
        .skeletonButton {
          background: linear-gradient(
            90deg,
            #eef1f5,
            #f8f9fb,
            #eef1f5
          );
          background-size: 200% 100%;
          animation: skeleton 1.3s infinite linear;
        }

        .skeletonImage {
          width: 100%;
          height: 180px;
        }

        .skeletonContent {
          padding: 20px 22px 22px;
        }

        .skeletonTitle {
          width: 62%;
          height: 22px;
          border-radius: 999px;
        }

        .skeletonLine {
          width: 90%;
          height: 12px;
          margin-top: 16px;
          border-radius: 999px;
        }

        .skeletonButton {
          width: 100%;
          height: 43px;
          margin-top: 30px;
          border-radius: 11px;
        }

        @keyframes skeleton {
          from {
            background-position: 200% 0;
          }

          to {
            background-position: -200% 0;
          }
        }

        @media (max-width: 1050px) {
          .categoryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .categoriesSection {
            padding: 58px 10px;
          }

          .categoryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-top: 32px;
          }

          .categoryCard,
          .skeletonCard {
            min-height: 282px;
            border-radius: 17px;
          }

          .imageWrap,
          .skeletonImage {
            height: 128px;
          }

          .categoryNumber {
            top: 10px;
            right: 10px;
            min-width: 39px;
            padding: 7px 8px;
            border-radius: 10px;
            font-size: 13px;
          }

          .cardContent,
          .skeletonContent {
            padding: 14px 13px 15px;
          }

          h3 {
            font-size: 18px;
          }

          .categoryCard p {
            min-height: 47px;
            font-size: 10px;
            line-height: 1.5;
          }

          .categoryCard button {
            min-height: 37px;
            margin-top: 12px;
            font-size: 10px;
          }

          .eyebrow {
            font-size: 9px;
          }

          h2 {
            font-size: 34px;
          }

          .subtitle {
            font-size: 13px;
          }
        }
      `}</style>
    </section>
  );
}
