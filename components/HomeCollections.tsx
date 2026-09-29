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

  men: "https\://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1200&q=88",

  women:

    "https\://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=88",

  kids:

    "https\://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1200&q=88",

  sarees:

    "https\://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=88",

  default:

    "https\://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=88",

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



  const heroCollection = activeCollections[0] || null;
  const storyCollections = activeCollections.slice(1, 4);
  const moreCollections = activeCollections.slice(4);

  return (
    <section className="collectionsSection">
      <div className="ambientGrid" />
      <div className="ambientGlow glowOne" />
      <div className="ambientGlow glowTwo" />

      <div className="collectionsContainer">
        <div className="collectionsHeading">
          <div className="headingCopy">
            <p className="eyebrow">EDITORIAL COLLECTIONS • LIVE FROM ADMIN</p>

            <h2>
              Curated Fashion
              <strong>Stories To Shop</strong>
            </h2>

            <p className="subtitle">
              Explore live NEW CITY STYLE collections as premium fashion stories,
              designed to feel closer to a modern commerce magazine than a basic
              product grid.
            </p>
          </div>

          <Link href="/collections" className="viewAllButton">
            <span>View All Collections</span>
            <b>→</b>
          </Link>
        </div>

        <div className="collectionSignals">
          <div>
            <span className="livePulse" />
            <p>
              <b>ADMIN CONNECTED</b>
              <small>Active collections update automatically</small>
            </p>
          </div>

          <div>
            <span>✦</span>
            <p>
              <b>EDITORIAL DISCOVERY</b>
              <small>Image-first fashion storytelling</small>
            </p>
          </div>

          <div>
            <span>◈</span>
            <p>
              <b>SHOP DIRECT</b>
              <small>Every story routes into live search</small>
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loadingStage">
            <div className="loadingHero" />
            <div className="loadingSide">
              <div className="loadingCard" />
              <div className="loadingCard" />
              <div className="loadingCard" />
            </div>
          </div>
        ) : loadError ? (
          <div className="messageBox">
            Collections could not be loaded right now.
          </div>
        ) : (
          <>
            {heroCollection && (
              <div className="storyStage">
                <article className="heroStory">
                  <img
                    src={getCollectionImage(heroCollection)}
                    alt={getCollectionName(heroCollection)}
                    loading="eager"
                    onError={(event) => {
                      event.currentTarget.src = getFallbackImage(
                        getCollectionName(heroCollection)
                      );
                    }}
                  />

                  <div className="heroShade" />
                  <div className="heroGlow" />

                  <div className="storyTop">
                    <span className="storyNumber">01</span>
                    <span className="storyBadge">FEATURED COLLECTION</span>
                  </div>

                  <div className="heroStoryContent">
                    <span className="miniLabel">NEW CITY STYLE EDIT</span>

                    <h3>{getCollectionName(heroCollection)}</h3>

                    <p>
                      {heroCollection.description?.trim() ||
                        "A premium fashion edit curated for the NEW CITY STYLE customer."}
                    </p>

                    <Link
                      href={`/search?q=${encodeURIComponent(
                        getCollectionName(heroCollection)
                      )}`}
                      className="heroShopButton"
                    >
                      <span>Shop The Collection</span>
                      <b>→</b>
                    </Link>
                  </div>
                </article>

                <div className="storyStack">
                  {storyCollections.map((collection, index) => {
                    const name = getCollectionName(collection);
                    const image = getCollectionImage(collection);

                    return (
                      <article
                        className="storyCard"
                        key={String(collection.id)}
                      >
                        <img
                          src={image}
                          alt={name}
                          loading="eager"
                          onError={(event) => {
                            event.currentTarget.src = getFallbackImage(name);
                          }}
                        />

                        <div className="storyShade" />

                        <span className="storyIndex">
                          {String(index + 2).padStart(2, "0")}
                        </span>

                        <div className="storyCardContent">
                          <span>CURATED COLLECTION</span>
                          <h4>{name}</h4>

                          <Link
                            href={`/search?q=${encodeURIComponent(name)}`}
                            className="storyLink"
                          >
                            Explore →
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {moreCollections.length > 0 && (
              <div className="moreSection">
                <div className="moreHeading">
                  <div>
                    <span>MORE COLLECTIONS</span>
                    <h3>Continue Exploring</h3>
                  </div>

                  <small>Swipe on mobile • Shop instantly</small>
                </div>

                <div className="moreRail">
                  {moreCollections.map((collection, index) => {
                    const name = getCollectionName(collection);
                    const image = getCollectionImage(collection);

                    return (
                      <article
                        className="moreCard"
                        key={String(collection.id)}
                      >
                        <div className="moreImage">
                          <img
                            src={image}
                            alt={name}
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.src =
                                getFallbackImage(name);
                            }}
                          />

                          <div className="moreOverlay" />

                          <span>
                            {String(index + 5).padStart(2, "0")}
                          </span>
                        </div>

                        <div className="moreInfo">
                          <h4>{name}</h4>

                          <p>
                            {collection.description?.trim() ||
                              "Explore this active NEW CITY STYLE collection."}
                          </p>

                          <Link
                            href={`/search?q=${encodeURIComponent(name)}`}
                            className="moreButton"
                          >
                            Shop Now →
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <div className="collectionsFooter">
          <div>
            <span className="footerDot" />
            <p>
              <b>Live collection publishing</b>
              <small>
                Admin collection status, names and images continue to control
                this section.
              </small>
            </p>
          </div>

          <Link href="/collections">Browse Collection Hub →</Link>
        </div>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .collectionsSection {
          position: relative;
          overflow: hidden;
          padding: 92px 20px 96px;
          background:
            radial-gradient(
              circle at 88% 14%,
              rgba(var(--ncs-secondary-rgb, 212,175,55), .13),
              transparent 28%
            ),
            radial-gradient(
              circle at 8% 88%,
              rgba(var(--ncs-primary-rgb, 10,46,115), .09),
              transparent 25%
            ),
            linear-gradient(
              180deg,
              var(--ncs-surface, #ffffff) 0%,
              color-mix(
                in srgb,
                var(--ncs-page-bg, #F7F8FC) 92%,
                white 8%
              ) 100%
            );
        }

        .collectionsContainer {
          position: relative;
          z-index: 3;
          width: min(1420px, 100%);
          margin: 0 auto;
        }

        .ambientGrid {
          position: absolute;
          inset: 0;
          opacity: .045;
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
          top: 0;
          right: -120px;
          width: 350px;
          height: 350px;
          background: rgba(var(--ncs-secondary-rgb, 212,175,55), .11);
        }

        .glowTwo {
          left: -140px;
          bottom: 30px;
          width: 370px;
          height: 370px;
          background: rgba(var(--ncs-primary-rgb, 10,46,115), .07);
        }

        .collectionsHeading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 30px;
        }

        .headingCopy {
          max-width: 860px;
        }

        .eyebrow {
          margin: 0 0 11px;
          color: color-mix(
            in srgb,
            var(--ncs-secondary, #D4AF37) 85%,
            black 15%
          );
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 2px;
        }

        h2 {
          margin: 0;
          color: var(--ncs-primary, #0a2e73);
          font-size: clamp(42px, 5.4vw, 70px);
          line-height: .98;
          letter-spacing: -2.2px;
        }

        h2 strong {
          display: block;
          color: color-mix(
            in srgb,
            var(--ncs-secondary, #D4AF37) 84%,
            black 16%
          );
          font-weight: 950;
        }

        .subtitle {
          max-width: 760px;
          margin: 18px 0 0;
          color: var(--ncs-muted, #667085);
          font-size: 15px;
          line-height: 1.75;
        }

        :global(.viewAllButton) {
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
          text-decoration: none;
          box-shadow:
            0 12px 30px
            rgba(var(--ncs-primary-rgb, 10,46,115), .12);
        }

        :global(.viewAllButton b) {
          color: var(--ncs-secondary, #D4AF37);
          font-size: 17px;
        }

        .collectionSignals {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 30px;
        }

        .collectionSignals > div {
          min-height: 60px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border:
            1px solid
            rgba(var(--ncs-primary-rgb, 10,46,115), .08);
          border-radius: 14px;
          background: rgba(255,255,255,.76);
          backdrop-filter: blur(10px);
        }

        .collectionSignals > div > span {
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

        .collectionSignals .livePulse {
          position: relative;
          background:
            color-mix(
              in srgb,
              #17b26a 9%,
              white 91%
            );
        }

        .collectionSignals .livePulse::after {
          width: 8px;
          height: 8px;
          content: "";
          border-radius: 50%;
          background: #17b26a;
          box-shadow:
            0 0 0 5px rgba(23,178,106,.1);
        }

        .collectionSignals p {
          margin: 0;
        }

        .collectionSignals b,
        .collectionSignals small {
          display: block;
        }

        .collectionSignals b {
          color: var(--ncs-primary, #0A2E73);
          font-size: 9px;
          letter-spacing: .8px;
        }

        .collectionSignals small {
          margin-top: 3px;
          color: var(--ncs-muted, #667085);
          font-size: 8px;
        }

        .storyStage {
          display: grid;
          grid-template-columns:
            minmax(0, 1.45fr)
            minmax(320px, .8fr);
          gap: 14px;
          margin-top: 38px;
        }

        .heroStory,
        .storyCard {
          position: relative;
          overflow: hidden;
          border:
            1px solid
            rgba(var(--ncs-primary-rgb, 10,46,115), .09);
          border-radius: 24px;
          background: #eef2f8;
          box-shadow:
            0 18px 45px rgba(16,24,40,.1);
        }

        .heroStory {
          min-height: 610px;
        }

        .heroStory > img,
        .storyCard > img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform .6s ease;
        }

        .heroStory:hover > img,
        .storyCard:hover > img {
          transform: scale(1.045);
        }

        .heroShade,
        .storyShade {
          position: absolute;
          inset: 0;
        }

        .heroShade {
          background:
            linear-gradient(
              180deg,
              rgba(3,18,48,.06) 0%,
              rgba(3,18,48,.14) 40%,
              rgba(3,18,48,.9) 100%
            );
        }

        .heroGlow {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(
              circle at 82% 18%,
              rgba(var(--ncs-secondary-rgb, 212,175,55), .2),
              transparent 27%
            );
        }

        .storyTop {
          position: absolute;
          z-index: 3;
          top: 18px;
          right: 18px;
          left: 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .storyNumber,
        .storyBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border:
            1px solid rgba(255,255,255,.23);
          background: rgba(3,22,54,.58);
          color: #fff;
          backdrop-filter: blur(10px);
        }

        .storyNumber {
          min-width: 46px;
          height: 38px;
          border-radius: 11px;
          font-size: 13px;
          font-weight: 950;
        }

        .storyBadge {
          min-height: 30px;
          padding: 0 10px;
          border-color: rgba(212,175,55,.38);
          border-radius: 999px;
          color: #eed36f;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: .9px;
        }

        .heroStoryContent {
          position: absolute;
          z-index: 4;
          right: 0;
          bottom: 0;
          left: 0;
          padding: 32px;
        }

        .miniLabel {
          color: #eed36f;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1.5px;
        }

        .heroStoryContent h3 {
          max-width: 760px;
          margin: 8px 0 0;
          color: #fff;
          font-size: clamp(36px, 4.2vw, 62px);
          line-height: .98;
          letter-spacing: -1.8px;
        }

        .heroStoryContent p {
          max-width: 650px;
          margin: 14px 0 0;
          color: rgba(255,255,255,.72);
          font-size: 12px;
          line-height: 1.65;
        }

        :global(.heroShopButton) {
          min-height: 43px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 20px;
          padding: 0 15px;
          border:
            1px solid rgba(255,255,255,.24);
          border-radius: 11px;
          background: rgba(255,255,255,.1);
          color: #fff;
          font-size: 9px;
          font-weight: 900;
          text-decoration: none;
          backdrop-filter: blur(10px);
        }

        :global(.heroShopButton b) {
          color: var(--ncs-secondary, #D4AF37);
          font-size: 16px;
        }

        .storyStack {
          display: grid;
          grid-template-rows: repeat(3, 1fr);
          gap: 14px;
        }

        .storyCard {
          min-height: 194px;
        }

        .storyShade {
          background:
            linear-gradient(
              90deg,
              rgba(3,18,48,.84) 0%,
              rgba(3,18,48,.45) 58%,
              rgba(3,18,48,.12) 100%
            );
        }

        .storyIndex {
          position: absolute;
          z-index: 3;
          top: 13px;
          right: 13px;
          min-width: 38px;
          padding: 6px 8px;
          border:
            1px solid rgba(255,255,255,.2);
          border-radius: 9px;
          background: rgba(3,22,54,.54);
          color: #fff;
          font-size: 10px;
          font-weight: 950;
          text-align: center;
          backdrop-filter: blur(9px);
        }

        .storyCardContent {
          position: absolute;
          z-index: 4;
          right: 0;
          bottom: 0;
          left: 0;
          padding: 18px;
        }

        .storyCardContent > span {
          color: #eed36f;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 1.2px;
        }

        .storyCardContent h4 {
          margin: 5px 0 0;
          color: #fff;
          font-size: 22px;
          line-height: 1.05;
        }

        :global(.storyLink) {
          display: inline-flex;
          margin-top: 9px;
          color: rgba(255,255,255,.8);
          font-size: 8px;
          font-weight: 850;
          text-decoration: none;
        }

        .moreSection {
          margin-top: 36px;
          padding-top: 28px;
          border-top:
            1px solid
            rgba(var(--ncs-primary-rgb, 10,46,115), .08);
        }

        .moreHeading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
        }

        .moreHeading span {
          color:
            color-mix(
              in srgb,
              var(--ncs-secondary, #D4AF37) 85%,
              black 15%
            );
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1.3px;
        }

        .moreHeading h3 {
          margin: 5px 0 0;
          color: var(--ncs-primary, #0A2E73);
          font-size: 26px;
        }

        .moreHeading small {
          color: var(--ncs-muted, #667085);
          font-size: 8px;
        }

        .moreRail {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 16px;
        }

        .moreCard {
          overflow: hidden;
          border:
            1px solid
            rgba(var(--ncs-primary-rgb, 10,46,115), .08);
          border-radius: 16px;
          background: #fff;
          box-shadow:
            0 10px 26px rgba(16,24,40,.06);
        }

        .moreImage {
          position: relative;
          height: 160px;
          overflow: hidden;
          background: #eef2f8;
        }

        .moreImage img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .moreOverlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(
              180deg,
              transparent,
              rgba(3,20,50,.4)
            );
        }

        .moreImage > span {
          position: absolute;
          z-index: 2;
          right: 9px;
          bottom: 9px;
          color: rgba(255,255,255,.78);
          font-size: 22px;
          font-weight: 950;
        }

        .moreInfo {
          padding: 14px;
        }

        .moreInfo h4 {
          margin: 0;
          color: var(--ncs-primary, #0A2E73);
          font-size: 15px;
        }

        .moreInfo p {
          min-height: 34px;
          display: -webkit-box;
          overflow: hidden;
          margin: 7px 0 0;
          color: var(--ncs-muted, #667085);
          font-size: 9px;
          line-height: 1.5;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        :global(.moreButton) {
          display: inline-flex;
          margin-top: 10px;
          color: var(--ncs-primary, #0A2E73);
          font-size: 8px;
          font-weight: 900;
          text-decoration: none;
        }

        .collectionsFooter {
          min-height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 30px;
          padding: 12px 14px;
          border:
            1px solid
            rgba(var(--ncs-primary-rgb, 10,46,115), .08);
          border-radius: 14px;
          background: rgba(255,255,255,.74);
        }

        .collectionsFooter > div {
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

        .collectionsFooter p {
          margin: 0;
        }

        .collectionsFooter b,
        .collectionsFooter small {
          display: block;
        }

        .collectionsFooter b {
          color: var(--ncs-primary, #0A2E73);
          font-size: 9px;
        }

        .collectionsFooter small {
          margin-top: 3px;
          color: var(--ncs-muted, #667085);
          font-size: 8px;
        }

        .collectionsFooter :global(a) {
          flex: 0 0 auto;
          color: var(--ncs-primary, #0A2E73);
          font-size: 8px;
          font-weight: 900;
          text-decoration: none;
        }

        .loadingStage {
          display: grid;
          grid-template-columns:
            minmax(0, 1.45fr)
            minmax(320px, .8fr);
          gap: 14px;
          margin-top: 38px;
        }

        .loadingHero,
        .loadingCard {
          border-radius: 24px;
          background:
            linear-gradient(
              90deg,
              #edf0f5,
              #f7f9fb,
              #edf0f5
            );
          background-size: 200% 100%;
          animation:
            shimmer 1.25s linear infinite;
        }

        .loadingHero {
          min-height: 610px;
        }

        .loadingSide {
          display: grid;
          grid-template-rows: repeat(3, 1fr);
          gap: 14px;
        }

        .loadingCard {
          min-height: 194px;
        }

        .messageBox {
          margin-top: 34px;
          padding: 22px;
          border: 1px solid #fedf89;
          border-radius: 14px;
          background: #fffaeb;
          color: #93370d;
          font-size: 12px;
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

        @media (max-width: 1100px) {
          .collectionsHeading {
            align-items: flex-start;
            flex-direction: column;
          }

          .collectionSignals {
            grid-template-columns: 1fr;
          }

          .storyStage {
            grid-template-columns: 1fr;
          }

          .heroStory {
            min-height: 520px;
          }

          .storyStack {
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: none;
          }

          .storyCard {
            min-height: 250px;
          }

          .moreRail {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .collectionsSection {
            padding: 62px 9px 78px;
          }

          .collectionsHeading {
            gap: 18px;
          }

          h2 {
            font-size: 40px;
          }

          .subtitle {
            font-size: 12px;
            line-height: 1.6;
          }

          :global(.viewAllButton) {
            width: 100%;
          }

          .collectionSignals {
            display: flex;
            overflow-x: auto;
            gap: 8px;
            margin-right: -9px;
            padding-right: 9px;
            scrollbar-width: none;
          }

          .collectionSignals::-webkit-scrollbar {
            display: none;
          }

          .collectionSignals > div {
            min-width: 230px;
            flex: 0 0 230px;
          }

          .storyStage {
            display: block;
          }

          .heroStory {
            min-height: 470px;
            border-radius: 18px;
          }

          .heroStoryContent {
            padding: 20px;
          }

          .heroStoryContent h3 {
            font-size: 38px;
          }

          .heroStoryContent p {
            font-size: 10px;
          }

          .storyStack {
            display: flex;
            overflow-x: auto;
            gap: 10px;
            margin-top: 10px;
            margin-right: -9px;
            padding-right: 9px;
            scrollbar-width: none;
          }

          .storyStack::-webkit-scrollbar {
            display: none;
          }

          .storyCard {
            min-width: 78vw;
            min-height: 310px;
            flex: 0 0 78vw;
            border-radius: 18px;
          }

          .storyCardContent h4 {
            font-size: 27px;
          }

          .moreHeading {
            align-items: flex-start;
            flex-direction: column;
            gap: 5px;
          }

          .moreRail {
            display: flex;
            overflow-x: auto;
            gap: 9px;
            margin-right: -9px;
            padding-right: 9px;
            scrollbar-width: none;
          }

          .moreRail::-webkit-scrollbar {
            display: none;
          }

          .moreCard {
            min-width: 255px;
            flex: 0 0 255px;
          }

          .collectionsFooter {
            align-items: flex-start;
            flex-direction: column;
          }

          .loadingStage {
            grid-template-columns: 1fr;
          }

          .loadingHero {
            min-height: 470px;
          }

          .loadingSide {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}
