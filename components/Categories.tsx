"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ProductRow = {
  category?: string | null;
  subcategory?: string | null;
};

type CategoryCard = {
  title: string;
  subtitle: string;
  icon: string;
  route: string;
};

const defaultCategories: CategoryCard[] = [
  {
    title: "Men",
    subtitle: "Premium shirts, jeans and everyday fashion",
    icon: "👔",
    route: "/search?q=Men",
  },
  {
    title: "Women",
    subtitle: "Elegant sarees, tops and modern fashion",
    icon: "👗",
    route: "/search?q=Women",
  },
  {
    title: "Kids",
    subtitle: "Comfortable and stylish kids wear",
    icon: "🧒",
    route: "/search?q=Kids",
  },
  {
    title: "Sarees",
    subtitle: "Beautiful sarees for every occasion",
    icon: "🥻",
    route: "/search?q=Sarees",
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
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase()
    )
    .join(" ");
}

function getCategoryIcon(category: string) {
  const value = normalizeCategory(category);

  if (
    value.includes("men") ||
    value.includes("shirt") ||
    value.includes("jean")
  ) {
    return "👔";
  }

  if (
    value.includes("women") ||
    value.includes("ladies") ||
    value.includes("top") ||
    value.includes("dress")
  ) {
    return "👗";
  }

  if (
    value.includes("kid") ||
    value.includes("boy") ||
    value.includes("girl") ||
    value.includes("child")
  ) {
    return "🧒";
  }

  if (
    value.includes("saree") ||
    value.includes("sari")
  ) {
    return "🥻";
  }

  if (
    value.includes("ethnic") ||
    value.includes("festive")
  ) {
    return "✨";
  }

  if (
    value.includes("sports") ||
    value.includes("active")
  ) {
    return "🏃";
  }

  return "🛍️";
}

function getCategorySubtitle(category: string) {
  const value = normalizeCategory(category);

  if (value.includes("men")) {
    return "Premium styles selected for modern men";
  }

  if (value.includes("women")) {
    return "Elegant fashion for every occasion";
  }

  if (value.includes("kid")) {
    return "Comfortable and stylish kids collection";
  }

  if (value.includes("saree")) {
    return "Beautiful sarees for celebrations and daily wear";
  }

  return `Explore our premium ${formatCategoryName(
    category
  )} collection`;
}

export default function Categories() {
  const router = useRouter();

  const [databaseCategories, setDatabaseCategories] = useState<
    string[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("category,subcategory");

      if (error) {
        throw error;
      }

      const uniqueMap = new Map<string, string>();

      ((data as ProductRow[]) || []).forEach((item) => {
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

      setDatabaseCategories(
        Array.from(uniqueMap.values()).sort((a, b) =>
          a.localeCompare(b)
        )
      );
    } catch (error) {
      console.error("Categories load error:", error);
      setDatabaseCategories([]);
    } finally {
      setLoading(false);
    }
  }

  const categories = useMemo<CategoryCard[]>(() => {
    const combinedMap = new Map<string, CategoryCard>();

    defaultCategories.forEach((item) => {
      combinedMap.set(normalizeCategory(item.title), item);
    });

    databaseCategories.forEach((category) => {
      const key = normalizeCategory(category);

      if (!combinedMap.has(key)) {
        combinedMap.set(key, {
          title: formatCategoryName(category),
          subtitle: getCategorySubtitle(category),
          icon: getCategoryIcon(category),
          route: `/search?q=${encodeURIComponent(category)}`,
        });
      }
    });

    return Array.from(combinedMap.values()).slice(0, 8);
  }, [databaseCategories]);

  function openCategory(category: CategoryCard) {
    router.push(category.route);
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
            Explore premium collections created for every member
            of the family.
          </p>
        </div>

        {loading ? (
          <div className="categoryGrid">
            {[1, 2, 3, 4].map((item) => (
              <div className="skeletonCard" key={item}>
                <div className="skeletonIcon" />
                <div className="skeletonTitle" />
                <div className="skeletonLine" />
                <div className="skeletonButton" />
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

                <div className="iconWrap">
                  <span>{item.icon}</span>
                </div>

                <span className="categoryNumber">
                  {String(index + 1).padStart(2, "0")}
                </span>

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

                <div className="bottomAccent" />
              </article>
            ))}
          </div>
        )}

        <div className="footerNote">
          <span>✨</span>
          Categories update automatically from products added in
          Admin.
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
          min-height: 300px;
          padding: 25px 22px 22px;
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
          width: 190px;
          height: 190px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(212, 175, 55, 0.2),
            transparent 70%
          );
        }

        .iconWrap {
          position: relative;
          z-index: 2;
          width: 78px;
          height: 78px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          border: 1px solid rgba(212, 175, 55, 0.45);
          border-radius: 22px;
          background: linear-gradient(145deg, #fff9e8, #ffffff);
          box-shadow: 0 14px 30px rgba(212, 175, 55, 0.16);
        }

        .iconWrap span {
          font-size: 42px;
        }

        .categoryNumber {
          position: absolute;
          top: 20px;
          right: 20px;
          color: rgba(10, 46, 115, 0.12);
          font-size: 40px;
          font-weight: 950;
          line-height: 1;
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

        .categoryCard > p {
          position: relative;
          z-index: 2;
          min-height: 48px;
          margin: 11px 0 0;
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
          margin-top: 22px;
          border: 1px solid #d4af37;
          border-radius: 11px;
          background: linear-gradient(135deg, #d4af37, #f1d26a);
          color: #0a2e73;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
        }

        .bottomAccent {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
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

        .skeletonIcon,
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

        .skeletonIcon {
          width: 78px;
          height: 78px;
          border-radius: 22px;
        }

        .skeletonTitle {
          width: 62%;
          height: 22px;
          margin-top: 24px;
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
            min-height: 245px;
            padding: 16px 13px;
            border-radius: 17px;
          }

          .iconWrap,
          .skeletonIcon {
            width: 58px;
            height: 58px;
            margin-bottom: 18px;
            border-radius: 16px;
          }

          .iconWrap span {
            font-size: 31px;
          }

          .categoryNumber {
            top: 14px;
            right: 13px;
            font-size: 29px;
          }

          h3 {
            font-size: 18px;
          }

          .categoryCard > p {
            min-height: 52px;
            font-size: 10px;
            line-height: 1.5;
          }

          .categoryCard button {
            min-height: 37px;
            margin-top: 14px;
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
