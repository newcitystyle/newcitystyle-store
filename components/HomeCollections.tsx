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

function getCollectionName(collection: CollectionRow) {
  return (
    collection.name ||
    collection.title ||
    collection.collection_name ||
    "NEW CITY STYLE Collection"
  );
}

function getCollectionSlug(collection: CollectionRow) {
  const savedSlug =
    collection.slug || collection.url_slug || "";

  if (savedSlug.trim()) {
    return savedSlug.trim();
  }

  return getCollectionName(collection)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCollectionImage(collection: CollectionRow) {
  return (
    collection.image_url ||
    collection.image ||
    collection.cover_image ||
    collection.banner_image ||
    ""
  );
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
    return collections
      .filter(isCollectionActive)
      .slice(0, 8);
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
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="loadingCard" key={index} />
            ))}
          </div>
        ) : loadError ? (
          <div className="messageBox">
            Collections could not be loaded right now.
          </div>
        ) : (
          <div className="collectionsGrid">
            {activeCollections.map((collection) => {
              const name = getCollectionName(collection);
              const slug = getCollectionSlug(collection);
              const image = getCollectionImage(collection);

              return (
                <article className="collectionCard" key={String(collection.id)}>
                  <div className="imageArea">
                    {image ? (
                      <img src={image} alt={name} />
                    ) : (
                      <div className="imageFallback">NCS</div>
                    )}

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
                      Explore Collection →
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

        .imageFallback {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          color: #d4af37;
          font-size: 46px;
          font-weight: 950;
          letter-spacing: 3px;
        }

        .activeBadge {
          position: absolute;
          top: 15px;
          right: 15px;
          padding: 7px 11px;
          border: 1px solid rgba(255, 255, 255, 0.7);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.9);
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
            padding: 56px 14px;
          }

          .collectionsHeading {
            align-items: flex-start;
            flex-direction: column;
          }

          :global(.viewAllButton) {
            width: 100%;
          }

          .collectionsGrid,
          .loadingGrid {
            grid-template-columns: 1fr;
          }

          .imageArea {
            height: 230px;
          }
        }
      `}</style>
    </section>
  );
}
