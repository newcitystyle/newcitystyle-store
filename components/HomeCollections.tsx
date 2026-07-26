"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CollectionRow = {
  id: string | number;
  name?: string | null;
  title?: string | null;
  collection_name?: string | null;
  slug?: string | null;
  url_slug?: string | null;
  description?: string | null;
  image_url?: string | null;
  image?: string | null;
  cover_image?: string | null;
  banner_image?: string | null;
  active?: boolean | null;
  is_active?: boolean | null;
  status?: string | null;
  created_at?: string | null;
};

const CATEGORY_FALLBACK_IMAGES = {
  men: "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1200&q=88",
  women:
    "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=88",
  kids:
    "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1200&q=88",
  sarees:
    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=88",
  default:
    "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=88",
};

function getCollectionName(collection: CollectionRow) {
  return (
    collection.name ||
    collection.title ||
    collection.collection_name ||
    "NEW CITY STYLE Collection"
  );
}

function getCollectionSlug(collection: CollectionRow) {
  const savedSlug = collection.slug || collection.url_slug || "";

  if (savedSlug.trim()) {
    return savedSlug.trim();
  }

  return getCollectionName(collection)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getFallbackImage(name: string) {
  const normalizedName = name.toLowerCase();

  if (
    normalizedName.includes("men") ||
    normalizedName.includes("shirt") ||
    normalizedName.includes("jean") ||
    normalizedName.includes("t-shirt")
  ) {
    return CATEGORY_FALLBACK_IMAGES.men;
  }

  if (
    normalizedName.includes("women") ||
    normalizedName.includes("ladies") ||
    normalizedName.includes("top") ||
    normalizedName.includes("dress")
  ) {
    return CATEGORY_FALLBACK_IMAGES.women;
  }

  if (
    normalizedName.includes("kid") ||
    normalizedName.includes("child") ||
    normalizedName.includes("boy") ||
    normalizedName.includes("girl")
  ) {
    return CATEGORY_FALLBACK_IMAGES.kids;
  }

  if (
    normalizedName.includes("saree") ||
    normalizedName.includes("sari") ||
    normalizedName.includes("ethnic")
  ) {
    return CATEGORY_FALLBACK_IMAGES.sarees;
  }

  return CATEGORY_FALLBACK_IMAGES.default;
}

function getCollectionImage(collection: CollectionRow) {
  const savedImage =
    collection.image_url ||
    collection.image ||
    collection.cover_image ||
    collection.banner_image ||
    "";

  return savedImage.trim() || getFallbackImage(getCollectionName(collection));
}

function isCollectionActive(collection: CollectionRow) {
  if (typeof collection.is_active === "boolean") {
    return collection.is_active;
  }

  if (typeof collection.active === "boolean") {
    return collection.active;
  }

  if (collection.status) {
    return collection.status.toLowerCase() === "active";
  }

  return true;
}

export default function HomeCollections() {
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    loadCollections();
  }, []);

  async function loadCollections() {
    setLoading(true);
    setLoadError("");

    try {
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setCollections((data as CollectionRow[]) || []);
    } catch (error) {
      console.error("Homepage collections load error:", error);

      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load collections."
      );
    } finally {
      setLoading(false);
    }
  }

  const activeCollections = useMemo(() => {
    return collections.filter(isCollectionActive).slice(0, 8);
  }, [collections]);

  if (!loading && activeCollections.length === 0) {
    return null;
  }

  return (
    <section className="collectionsSection">
      <div className="collectionsContainer">
        <div className="collectionsHeading">
          <div>
            <p className="eyebrow">CURATED FOR EVERY FAMILY</p>
            <h2>Shop Our Collections</h2>
            <p className="subtitle">
              Discover active collections selected from the NEW CITY STYLE
              admin panel.
            </p>
          </div>

          <Link href="/collections" className="viewAllButton">
            View All Collections →
          </Link>
        </div>

        {loading ? (
          <div className="loadingGrid">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="loadingCard" key={index} />
            ))}
          </div>
        ) : loadError ? (
          <div className="messageBox">
            Collections could not be loaded right now.
          </div>
        ) : (
          <div className="collectionsGrid">
            {activeCollections.map((collection, index) => {
              const name = getCollectionName(collection);
              const slug = getCollectionSlug(collection);
              const image = getCollectionImage(collection);

              return (
                <article className="collectionCard" key={String(collection.id)}>
                  <div className="imageArea">
                    <img
                      src={image}
                      alt={name}
                      loading={index < 4 ? "eager" : "lazy"}
                      onError={(event) => {
                        event.currentTarget.src = getFallbackImage(name);
                      }}
                    />

                    <div className="imageOverlay" />
                    <span className="collectionNumber">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="activeBadge">Active</span>
                  </div>

                  <div className="contentArea">
                    <h3>{name}</h3>

                    <p>
                      {collection.description?.trim() ||
                        "Explore premium fashion selected for every member of the family."}
                    </p>

                    <Link
                      href={`/search?q=${encodeURIComponent(name)}`}
                      className="shopButton"
                      aria-label={`Shop ${name}`}
                    >
                      Explore Collection <span aria-hidden="true">→</span>
                    </Link>

                    <span className="slugText">/{slug}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .collectionsSection {
          padding: 76px 20px;
          background:
            radial-gradient(
              circle at top right,
              rgba(212, 175, 55, 0.14),
              transparent 30%
            ),
            linear-gradient(180deg, #ffffff 0%, #f8f4ec 100%);
        }

        .collectionsContainer {
          width: 100%;
          max-width: 1380px;
          margin: 0 auto;
        }

        .collectionsHeading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 30px;
        }

        .eyebrow {
          margin: 0 0 9px;
          color: #d4af37;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        h2 {
          margin: 0;
          color: #0a2e73;
          font-size: clamp(32px, 4vw, 48px);
          line-height: 1.08;
        }

        .subtitle {
          max-width: 700px;
          margin: 12px 0 0;
          color: #667085;
          font-size: 15px;
          line-height: 1.7;
        }

        :global(.viewAllButton) {
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          padding: 0 18px;
          border: 1px solid #0a2e73;
          border-radius: 12px;
          color: #0a2e73;
          font-size: 13px;
          font-weight: 850;
          text-decoration: none;
        }

        .collectionsGrid,
        .loadingGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 22px;
        }

        .collectionCard {
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.12);
          border-radius: 22px;
          background: #ffffff;
          box-shadow: 0 16px 38px rgba(10, 46, 115, 0.1);
          transition:
            transform 0.25s ease,
            box-shadow 0.25s ease;
        }

        .collectionCard:hover {
          transform: translateY(-5px);
          box-shadow: 0 22px 48px rgba(10, 46, 115, 0.16);
        }

        .imageArea {
          position: relative;
          height: 260px;
          overflow: hidden;
          background: linear-gradient(135deg, #0a2e73, #164ca8);
        }

        .imageArea img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform 0.35s ease;
        }

        .collectionCard:hover .imageArea img {
          transform: scale(1.04);
        }

        .imageOverlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(10, 46, 115, 0.04) 20%,
            rgba(10, 46, 115, 0.42) 100%
          );
          pointer-events: none;
        }

        .collectionNumber {
          position: absolute;
          right: 15px;
          bottom: 10px;
          color: rgba(255, 255, 255, 0.82);
          font-size: 42px;
          font-weight: 900;
          line-height: 1;
          text-shadow: 0 2px 12px rgba(10, 46, 115, 0.32);
        }

        .activeBadge {
          position: absolute;
          top: 15px;
          right: 15px;
          padding: 7px 11px;
          border: 1px solid rgba(255, 255, 255, 0.7);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          color: #067647;
          font-size: 10px;
          font-weight: 850;
          backdrop-filter: blur(8px);
        }

        .contentArea {
          padding: 23px;
        }

        h3 {
          margin: 0;
          color: #0a2e73;
          font-size: 25px;
          line-height: 1.25;
        }

        .contentArea p {
          min-height: 50px;
          margin: 11px 0 0;
          color: #667085;
          font-size: 13px;
          line-height: 1.65;
        }

        :global(.shopButton) {
          min-height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 20px;
          border-radius: 12px;
          background: linear-gradient(135deg, #d4af37, #f1d26a);
          color: #0a2e73;
          font-size: 13px;
          font-weight: 900;
          text-decoration: none;
        }

        .slugText {
          display: block;
          margin-top: 10px;
          overflow: hidden;
          color: #98a2b3;
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .loadingCard {
          min-height: 430px;
          border-radius: 22px;
          background: linear-gradient(
            90deg,
            #eef1f5 25%,
            #f8f9fb 50%,
            #eef1f5 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.3s infinite linear;
        }

        .messageBox {
          padding: 22px;
          border: 1px solid #fedf89;
          border-radius: 14px;
          background: #fffaeb;
          color: #93370d;
          font-size: 13px;
          font-weight: 750;
        }

        @keyframes shimmer {
          from {
            background-position: 200% 0;
          }

          to {
            background-position: -200% 0;
          }
        }

        @media (max-width: 1050px) {
          .collectionsGrid,
          .loadingGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .collectionsSection {
            padding: 56px 12px;
          }

          .collectionsHeading {
            align-items: flex-start;
            flex-direction: column;
            margin-bottom: 22px;
          }

          :global(.viewAllButton) {
            width: 100%;
          }

          .collectionsGrid,
          .loadingGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .collectionCard {
            border-radius: 18px;
          }

          .imageArea {
            height: 180px;
          }

          .activeBadge {
            top: 9px;
            right: 9px;
            padding: 5px 8px;
            font-size: 8px;
          }

          .collectionNumber {
            right: 10px;
            bottom: 8px;
            font-size: 28px;
          }

          .contentArea {
            padding: 15px 12px 14px;
          }

          h3 {
            font-size: 20px;
          }

          .contentArea p {
            min-height: 63px;
            margin-top: 8px;
            font-size: 11px;
            line-height: 1.55;
          }

          :global(.shopButton) {
            min-height: 42px;
            margin-top: 14px;
            padding: 0 8px;
            font-size: 11px;
            text-align: center;
          }

          .slugText {
            display: none;
          }

          .loadingCard {
            min-height: 350px;
          }
        }

        @media (max-width: 390px) {
          .collectionsGrid,
          .loadingGrid {
            gap: 9px;
          }

          .imageArea {
            height: 160px;
          }

          h3 {
            font-size: 18px;
          }

          .contentArea p {
            min-height: 70px;
            font-size: 10px;
          }

          :global(.shopButton) {
            font-size: 10px;
          }
        }
      `}</style>
    </section>
  );
}
