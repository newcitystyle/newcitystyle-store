"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string | number;
  name?: string | null;
  product_name?: string | null;
  title?: string | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  price?: number | string | null;
  image?: string | null;
  image_url?: string | null;
  images?: string[] | string | null;
};

function getProductName(product: Product) {
  return (
    product.name ||
    product.product_name ||
    product.title ||
    "Untitled Product"
  );
}

function getProductImage(product: Product) {
  if (product.image_url) return product.image_url;
  if (product.image) return product.image;

  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images[0];
  }

  if (typeof product.images === "string" && product.images.trim()) {
    try {
      const parsed = JSON.parse(product.images);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }

      return product.images;
    } catch {
      return product.images;
    }
  }

  return "";
}

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export default function Navbar() {
  const router = useRouter();
  const searchWrapperRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    loadProducts();
    loadCounts();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadCounts();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const cartChannel = supabase
      .channel("navbar-cart-count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cart",
        },
        () => loadCounts()
      )
      .subscribe();

    const wishlistChannel = supabase
      .channel("navbar-wishlist-count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wishlist",
        },
        () => loadCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(cartChannel);
      supabase.removeChannel(wishlistChannel);
    };
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;

      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(target)
      ) {
        setShowSuggestions(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [search]);

  async function loadProducts() {
    setLoadingProducts(true);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      setProducts((data as Product[]) || []);
    } catch (error) {
      console.error("Navbar product search error:", error);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadCounts() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCartCount(0);
        setWishlistCount(0);
        return;
      }

      const [cartResponse, wishlistResponse] = await Promise.all([
        supabase
          .from("cart")
          .select("quantity")
          .eq("user_id", user.id),

        supabase
          .from("wishlist")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      if (cartResponse.error) {
        console.error("Cart count error:", cartResponse.error);
      } else {
        const quantityTotal = (cartResponse.data || []).reduce(
          (sum, item: any) => sum + Number(item.quantity || 0),
          0
        );

        setCartCount(quantityTotal);
      }

      if (wishlistResponse.error) {
        console.error(
          "Wishlist count error:",
          wishlistResponse.error
        );
      } else {
        setWishlistCount(wishlistResponse.count || 0);
      }
    } catch (error) {
      console.error("Navbar count load error:", error);
    }
  }

  const suggestions = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return [];

    return products
      .filter((product) => {
        const name = getProductName(product).toLowerCase();
        const category = String(
          product.category || ""
        ).toLowerCase();
        const subcategory = String(
          product.subcategory || ""
        ).toLowerCase();
        const brand = String(product.brand || "").toLowerCase();

        return (
          name.includes(query) ||
          category.includes(query) ||
          subcategory.includes(query) ||
          brand.includes(query)
        );
      })
      .slice(0, 7);
  }, [products, search]);

  function handleSearch() {
    const query = search.trim();

    if (!query) return;

    setShowSuggestions(false);
    setMobileMenuOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function openProduct(product: Product) {
    setShowSuggestions(false);
    setMobileMenuOpen(false);
    setSearch("");
    router.push(`/product/${product.id}`);
  }

  function handleSearchKeyDown(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!showSuggestions) {
        setShowSuggestions(true);
      }

      setActiveIndex((current) =>
        Math.min(current + 1, suggestions.length - 1)
      );

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, -1));
      return;
    }

    if (event.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      if (activeIndex >= 0 && suggestions[activeIndex]) {
        openProduct(suggestions[activeIndex]);
      } else {
        handleSearch();
      }
    }
  }

  function clearSearch() {
    setSearch("");
    setActiveIndex(-1);
    setShowSuggestions(false);
  }

  return (
    <nav className="navbar">
      <div className="navbarInner">
        <Link
          href="/"
          className="brand"
          onClick={() => setMobileMenuOpen(false)}
        >
          <span className="brandMark">NCS</span>

          <span className="brandText">
            <strong>NEW CITY STYLE</strong>
            <small>Style for Every Family</small>
          </span>
        </Link>

        <div className="searchWrapper" ref={searchWrapperRef}>
          <div className="searchBar">
            <span className="searchIcon">⌕</span>

            <input
              type="search"
              placeholder="Search shirts, sarees, kids wear, brands..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleSearchKeyDown}
              aria-label="Search products"
              autoComplete="off"
            />

            {search && (
              <button
                type="button"
                className="clearSearch"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                ×
              </button>
            )}

            <button
              type="button"
              className="searchButton"
              onClick={handleSearch}
              aria-label="Search"
            >
              Search
            </button>
          </div>

          {showSuggestions && search.trim() && (
            <div className="suggestions">
              <div className="suggestionHeader">
                <span>Search Suggestions</span>

                <button type="button" onClick={handleSearch}>
                  View all results
                </button>
              </div>

              {loadingProducts ? (
                <div className="suggestionState">
                  <div className="miniLoader" />
                  Loading products...
                </div>
              ) : suggestions.length > 0 ? (
                <div className="suggestionList">
                  {suggestions.map((product, index) => {
                    const productName = getProductName(product);
                    const image = getProductImage(product);

                    return (
                      <button
                        type="button"
                        key={String(product.id)}
                        className={`suggestionItem ${
                          activeIndex === index
                            ? "suggestionActive"
                            : ""
                        }`}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => openProduct(product)}
                      >
                        <div className="suggestionImage">
                          {image ? (
                            <img src={image} alt={productName} />
                          ) : (
                            <span>NCS</span>
                          )}
                        </div>

                        <div className="suggestionInfo">
                          <strong>{productName}</strong>

                          <span>
                            {product.category ||
                              product.subcategory ||
                              "Fashion"}

                            {product.brand
                              ? ` • ${product.brand}`
                              : ""}
                          </span>
                        </div>

                        <div className="suggestionPrice">
                          {formatCurrency(product.price)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="suggestionState">
                  No matching products found for “{search.trim()}”
                </div>
              )}

              <button
                type="button"
                className="searchAllButton"
                onClick={handleSearch}
              >
                Search for “{search.trim()}” →
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="mobileMenuButton"
          onClick={() =>
            setMobileMenuOpen((current) => !current)
          }
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          <span />
          <span />
          <span />
        </button>

        <div
          className={`navLinks ${
            mobileMenuOpen ? "navLinksOpen" : ""
          }`}
        >
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span>⌂</span>
            Home
          </Link>

          <Link
            href="/wishlist"
            className="countLink"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span>♡</span>
            Wishlist

            {wishlistCount > 0 && (
              <b className="countBadge">
                {wishlistCount > 99 ? "99+" : wishlistCount}
              </b>
            )}
          </Link>

          <Link
            href="/orders"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span>▣</span>
            Orders
          </Link>

          <Link
            href="/cart"
            className="countLink"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span>🛒</span>
            Cart

            {cartCount > 0 && (
              <b className="countBadge">
                {cartCount > 99 ? "99+" : cartCount}
              </b>
            )}
          </Link>

          <Link
            href="/login"
            className="loginLink"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span>♙</span>
            Login
          </Link>
        </div>
      </div>

      <div className="mobileSearch">
        <div className="searchWrapper">
          <div className="searchBar">
            <span className="searchIcon">⌕</span>

            <input
              type="search"
              placeholder="Search products..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleSearchKeyDown}
              aria-label="Search products on mobile"
            />

            {search && (
              <button
                type="button"
                className="clearSearch"
                onClick={clearSearch}
              >
                ×
              </button>
            )}

            <button
              type="button"
              className="searchButton"
              onClick={handleSearch}
            >
              Search
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .navbar {
          position: sticky;
          z-index: 1000;
          top: 0;
          width: 100%;
          background: linear-gradient(
            90deg,
            rgba(10, 46, 115, 0.98),
            rgba(19, 62, 150, 0.98)
          );
          color: white;
          box-shadow: 0 10px 28px rgba(2, 17, 48, 0.24);
          backdrop-filter: blur(14px);
        }

        .navbarInner {
          width: min(1500px, calc(100% - 38px));
          min-height: 78px;
          display: flex;
          align-items: center;
          gap: 24px;
          margin: 0 auto;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
          flex-shrink: 0;
          color: white;
          text-decoration: none;
        }

        .brandMark {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(212, 175, 55, 0.85);
          border-radius: 13px;
          background: rgba(212, 175, 55, 0.12);
          color: #d4af37;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 1px;
          box-shadow: 0 8px 20px rgba(212, 175, 55, 0.14);
        }

        .brandText {
          display: block;
        }

        .brandText strong,
        .brandText small {
          display: block;
          white-space: nowrap;
        }

        .brandText strong {
          color: #d4af37;
          font-size: 21px;
          line-height: 1.1;
          letter-spacing: 0.5px;
        }

        .brandText small {
          margin-top: 4px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 9px;
          letter-spacing: 1.2px;
        }

        .searchWrapper {
          position: relative;
          min-width: 0;
          flex: 1;
          max-width: 680px;
          margin: 0 auto;
        }

        .searchBar {
          position: relative;
          display: flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.26);
          border-radius: 13px;
          background: white;
          box-shadow: 0 8px 22px rgba(2, 17, 48, 0.18);
          transition:
            box-shadow 0.2s ease,
            border-color 0.2s ease;
        }

        .searchBar:focus-within {
          border-color: #d4af37;
          box-shadow:
            0 0 0 4px rgba(212, 175, 55, 0.16),
            0 10px 25px rgba(2, 17, 48, 0.22);
        }

        .searchIcon {
          position: absolute;
          z-index: 2;
          left: 15px;
          color: #667085;
          font-size: 24px;
          transform: translateY(-2px);
          pointer-events: none;
        }

        .searchBar input {
          width: 100%;
          height: 49px;
          min-width: 0;
          padding: 0 45px 0 45px;
          border: 0;
          outline: none;
          background: transparent;
          color: #172033;
          font-size: 14px;
        }

        .clearSearch {
          position: absolute;
          z-index: 2;
          right: 92px;
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 50%;
          background: #f2f4f7;
          color: #667085;
          font-size: 20px;
          cursor: pointer;
        }

        .searchButton {
          align-self: stretch;
          min-width: 86px;
          border: 0;
          background: linear-gradient(
            135deg,
            #d4af37,
            #f1d26a
          );
          color: #0a2e73;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          transition:
            filter 0.2s ease,
            transform 0.2s ease;
        }

        .searchButton:hover {
          filter: brightness(1.04);
        }

        .suggestions {
          position: absolute;
          z-index: 1200;
          top: calc(100% + 9px);
          right: 0;
          left: 0;
          overflow: hidden;
          border: 1px solid #e4e7ec;
          border-radius: 15px;
          background: white;
          color: #172033;
          box-shadow: 0 22px 55px rgba(2, 17, 48, 0.24);
          animation: suggestionsOpen 0.18s ease both;
        }

        .suggestionHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-bottom: 1px solid #eaecf0;
          background: #f8fafc;
        }

        .suggestionHeader span {
          color: #475467;
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0.7px;
          text-transform: uppercase;
        }

        .suggestionHeader button {
          padding: 0;
          border: 0;
          background: transparent;
          color: #0a2e73;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .suggestionList {
          max-height: 430px;
          overflow-y: auto;
        }

        .suggestionItem {
          width: 100%;
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr) auto;
          align-items: center;
          gap: 11px;
          padding: 10px 13px;
          border: 0;
          border-bottom: 1px solid #f0f1f3;
          background: white;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .suggestionItem:last-child {
          border-bottom: 0;
        }

        .suggestionItem:hover,
        .suggestionActive {
          background: #f2f6ff;
        }

        .suggestionImage {
          width: 52px;
          height: 58px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #0a2e73;
          color: #d4af37;
          font-size: 10px;
          font-weight: 900;
        }

        .suggestionImage img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .suggestionInfo {
          min-width: 0;
        }

        .suggestionInfo strong,
        .suggestionInfo span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .suggestionInfo strong {
          color: #172033;
          font-size: 13px;
        }

        .suggestionInfo span {
          margin-top: 5px;
          color: #98a2b3;
          font-size: 10px;
        }

        .suggestionPrice {
          color: #0a2e73;
          font-size: 13px;
          font-weight: 900;
          white-space: nowrap;
        }

        .suggestionState {
          min-height: 92px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 18px;
          color: #667085;
          font-size: 13px;
          text-align: center;
        }

        .miniLoader {
          width: 21px;
          height: 21px;
          border: 3px solid #e4e7ec;
          border-top-color: #0a2e73;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        .searchAllButton {
          width: 100%;
          min-height: 44px;
          border: 0;
          border-top: 1px solid #e4e7ec;
          background: #0a2e73;
          color: white;
          font-size: 12px;
          font-weight: 850;
          cursor: pointer;
        }

        .navLinks {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
        }

        .navLinks :global(a) {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 9px;
          border-radius: 9px;
          color: white;
          font-size: 12px;
          font-weight: 750;
          text-decoration: none;
          transition:
            background 0.2s ease,
            transform 0.2s ease;
        }

        .navLinks :global(a:hover) {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        .navLinks :global(a span) {
          font-size: 15px;
        }

        .navLinks :global(.loginLink) {
          border: 1px solid rgba(212, 175, 55, 0.55);
          color: #f1d26a;
        }

        .countBadge {
          min-width: 19px;
          height: 19px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 5px;
          border: 2px solid #0a2e73;
          border-radius: 999px;
          background: #d4af37;
          color: #0a2e73;
          font-size: 9px;
          font-weight: 950;
          line-height: 1;
          box-shadow: 0 5px 12px rgba(212, 175, 55, 0.28);
        }

        .mobileMenuButton {
          display: none;
          width: 43px;
          height: 43px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.08);
          cursor: pointer;
        }

        .mobileMenuButton span {
          width: 19px;
          height: 2px;
          border-radius: 999px;
          background: white;
        }

        .mobileSearch {
          display: none;
        }

        @keyframes suggestionsOpen {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1180px) {
          .brandText small {
            display: none;
          }

          .brandText strong {
            font-size: 17px;
          }

          .navLinks {
            gap: 2px;
          }

          .navLinks :global(a) {
            padding: 9px 6px;
            font-size: 11px;
          }
        }

        @media (max-width: 920px) {
          .navbarInner {
            min-height: 68px;
          }

          .navbarInner > .searchWrapper {
            display: none;
          }

          .mobileMenuButton {
            display: flex;
            margin-left: auto;
          }

          .navLinks {
            position: absolute;
            top: 68px;
            right: 12px;
            left: 12px;
            display: none;
            overflow: hidden;
            align-items: stretch;
            flex-direction: column;
            gap: 0;
            padding: 8px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 14px;
            background: rgba(7, 31, 79, 0.98);
            box-shadow: 0 20px 45px rgba(2, 17, 48, 0.3);
            backdrop-filter: blur(15px);
          }

          .navLinksOpen {
            display: flex;
          }

          .navLinks :global(a) {
            justify-content: flex-start;
            padding: 13px 12px;
            font-size: 13px;
          }

          .countBadge {
            margin-left: auto;
          }

          .mobileSearch {
            display: block;
            padding: 0 14px 12px;
          }

          .mobileSearch .searchWrapper {
            max-width: none;
          }

          .mobileSearch .suggestions {
            right: 14px;
            left: 14px;
          }
        }

        @media (max-width: 520px) {
          .navbarInner {
            width: calc(100% - 24px);
          }

          .brandMark {
            width: 40px;
            height: 40px;
          }

          .brandText strong {
            font-size: 15px;
          }

          .searchButton {
            min-width: 72px;
            font-size: 11px;
          }

          .clearSearch {
            right: 77px;
          }
        }
      `}</style>
    </nav>
  );
}
