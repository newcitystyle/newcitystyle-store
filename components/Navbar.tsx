"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type BrandingSettings = Record<string, unknown> & {
  id?: number | string;
};

type NavbarBranding = {
  brandName: string;
  tagline: string;
  logoUrl: string;
  mobileLogoUrl: string;
  primaryColor: string;
  secondaryColor: string;
};

type Product = {
  id: string | number;
  name?: string | null;
  product_name?: string | null;
  title?: string | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  price?: number | string | null;
  stock?: number | string | null;
  online_stock_limit?: number | string | null;
  sell_online?: boolean | null;
  is_active?: boolean | null;
  image?: string | null;
  image_url?: string | null;
  images?: string[] | string | null;
};

const DEFAULT_BRANDING: NavbarBranding = {
  brandName: "NEW CITY STYLE",
  tagline: "Style for Every Family",
  logoUrl: "",
  mobileLogoUrl: "",
  primaryColor: "#0A2E73",
  secondaryColor: "#D4AF37",
};

const quickLinks = [
  { label: "Men", query: "Men" },
  { label: "Women", query: "Women" },
  { label: "Kids", query: "Kids" },
  { label: "New Arrivals", query: "new arrivals" },
  { label: "Best Deals", query: "offers" },
];

const commerceLinks = [
  { label: "Home", href: "/", icon: "⌂" },
  { label: "Collections", href: "/collections", icon: "◫" },
  { label: "Wishlist", href: "/wishlist", icon: "♡" },
  { label: "Orders", href: "/orders", icon: "▣" },
];

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

function hexToRgbCss(value: string) {
  const normalized = value.trim().replace("#", "");

  if (!/^[0-9A-F]{6}$/i.test(normalized)) {
    return "10, 46, 115";
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `${red}, ${green}, ${blue}`;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const desktopSearchWrapperRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchWrapperRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [branding, setBranding] =
    useState<NavbarBranding>(DEFAULT_BRANDING);

  useEffect(() => {
    const root = document.documentElement;

    root.style.setProperty("--ncs-primary", branding.primaryColor);
    root.style.setProperty("--ncs-secondary", branding.secondaryColor);
    root.style.setProperty(
      "--ncs-primary-rgb",
      hexToRgbCss(branding.primaryColor)
    );
    root.style.setProperty(
      "--ncs-secondary-rgb",
      hexToRgbCss(branding.secondaryColor)
    );

    root.style.setProperty("--ncs-surface", "#FFFFFF");
    root.style.setProperty("--ncs-page-bg", "#F7F8FC");
    root.style.setProperty("--ncs-text", "#172033");
    root.style.setProperty("--ncs-muted", "#667085");
    root.style.setProperty("--ncs-border", "#E4E7EC");

    root.dataset.ncsThemeReady = "true";

    window.dispatchEvent(
      new CustomEvent("ncs-theme-change", {
        detail: {
          primaryColor: branding.primaryColor,
          secondaryColor: branding.secondaryColor,
        },
      })
    );
  }, [branding.primaryColor, branding.secondaryColor]);

  useEffect(() => {
    void loadProducts();
    void loadCounts();
    void loadBranding();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadCounts();
    });

    return () => subscription.unsubscribe();
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
        () => void loadCounts()
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
        () => void loadCounts()
      )
      .subscribe();

    const brandingChannel = supabase
      .channel("navbar-branding-settings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "branding_settings",
        },
        () => void loadBranding()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(cartChannel);
      void supabase.removeChannel(wishlistChannel);
      void supabase.removeChannel(brandingChannel);
    };
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;

      if (
        !desktopSearchWrapperRef.current?.contains(target) &&
        !mobileSearchWrapperRef.current?.contains(target)
      ) {
        setShowSuggestions(false);
        setActiveIndex(-1);
      }
    }

    function handleScroll() {
      setScrolled(window.scrollY > 18);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [search]);

  async function loadBranding() {
    try {
      const { data, error } = await supabase
        .from("branding_settings")
        .select(
          "brand_name, tagline, logo_url, primary_color, secondary_color"
        )
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      const settings = data as BrandingSettings | null;

      if (!settings) {
        setBranding(DEFAULT_BRANDING);
        return;
      }

      const readText = (...keys: string[]) => {
        for (const key of keys) {
          const value = settings[key];
          if (typeof value === "string" && value.trim()) {
            return value.trim();
          }
        }
        return "";
      };

      const officialLogo = readText("logo_url");

      setBranding({
        brandName: readText("brand_name") || DEFAULT_BRANDING.brandName,
        tagline: readText("tagline") || DEFAULT_BRANDING.tagline,
        logoUrl: officialLogo,
        mobileLogoUrl: officialLogo,
        primaryColor:
          readText("primary_color") || DEFAULT_BRANDING.primaryColor,
        secondaryColor:
          readText("secondary_color") || DEFAULT_BRANDING.secondaryColor,
      });
    } catch (error) {
      console.error("Navbar branding load error:", error);
      setBranding(DEFAULT_BRANDING);
    }
  }

  async function loadProducts() {
    setLoadingProducts(true);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("sell_online", true)
        .eq("is_active", true)
        .gt("stock", 0)
        .gt("online_stock_limit", 0)
        .order("created_at", { ascending: false })
        .limit(120);

      if (error) throw error;

      const onlineProducts = ((data as Product[]) || []).filter(
        (product) =>
          product.sell_online === true &&
          product.is_active === true &&
          Number(product.stock ?? 0) > 0 &&
          Number(product.online_stock_limit ?? 0) > 0
      );

      setProducts(onlineProducts);
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
        supabase.from("cart").select("quantity").eq("user_id", user.id),
        supabase
          .from("wishlist")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      if (!cartResponse.error) {
        const quantityTotal = (cartResponse.data || []).reduce(
          (sum, item: { quantity?: number | string | null }) =>
            sum + Number(item.quantity || 0),
          0
        );
        setCartCount(quantityTotal);
      }

      if (!wishlistResponse.error) {
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
        const category = String(product.category || "").toLowerCase();
        const subcategory = String(product.subcategory || "").toLowerCase();
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

  function rememberSearch(query: string) {
    try {
      window.localStorage.setItem("ncs_ai_last_query", query);
    } catch {
      // Optional personalization only.
    }
  }

  function handleSearch() {
    const query = search.trim();
    if (!query) return;

    rememberSearch(query);
    setShowSuggestions(false);
    setMobileMenuOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function openQuickSearch(query: string) {
    rememberSearch(query);
    setSearch("");
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

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!showSuggestions) setShowSuggestions(true);
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

  function renderSuggestions(mobile = false) {
    if (!showSuggestions || !search.trim()) return null;

    return (
      <div
        className={`suggestions ${mobile ? "mobileSuggestions" : ""}`}
      >
        <div className="suggestionHeader">
          <div>
            <span>SMART SEARCH</span>
            <small>Live online catalogue</small>
          </div>

          <button type="button" onClick={handleSearch}>
            View all →
          </button>
        </div>

        {loadingProducts ? (
          <div className="suggestionState">
            <div className="miniLoader" />
            Finding live products...
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
                    activeIndex === index ? "suggestionActive" : ""
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
                      {product.brand ? ` • ${product.brand}` : ""}
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
            No direct match yet. Search “{search.trim()}” across the full
            catalogue.
          </div>
        )}

        <button
          type="button"
          className="searchAllButton"
          onClick={handleSearch}
        >
          Search “{search.trim()}” across NEW CITY STYLE →
        </button>
      </div>
    );
  }

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const cssVars = {
    "--navbar-primary": "var(--ncs-primary, #0A2E73)",
    "--navbar-secondary": "var(--ncs-secondary, #D4AF37)",
  } as CSSProperties;

  return (
    <>
      <nav
        className={`navbar ${scrolled ? "navbarScrolled" : ""}`}
        style={cssVars}
      >
        <div className="utilityBar">
          <div className="utilityInner">
            <div className="utilityLeft">
              <span className="liveDot" />
              <b>LIVE ONLINE STORE</b>
              <span>Smart shopping • Family fashion • Secure checkout</span>
            </div>

            <div className="utilityRight">
              <Link href="/orders">Track Order</Link>
              <Link href="/contact">Help</Link>
              <span>NEW CITY STYLE • INDIA</span>
            </div>
          </div>
        </div>

        <div className="navbarInner">
          <Link
            href="/"
            className="brand"
            onClick={() => setMobileMenuOpen(false)}
          >
            {branding.logoUrl ? (
              <span className="brandLogoFrame">
                <img
                  className="brandLogo brandLogoDesktop"
                  src={branding.logoUrl}
                  alt={`${branding.brandName} official logo`}
                />
                <img
                  className="brandLogo brandLogoMobile"
                  src={branding.mobileLogoUrl || branding.logoUrl}
                  alt={`${branding.brandName} mobile logo`}
                />
              </span>
            ) : (
              <span className="brandMark">NCS</span>
            )}

            <span className="brandText">
              <strong>{branding.brandName}</strong>
              <small>{branding.tagline}</small>
            </span>
          </Link>

          <div
            className="searchWrapper desktopSearchWrapper"
            ref={desktopSearchWrapperRef}
          >
            <div className="searchBar">
              <div className="searchLead">
                <span className="searchIcon">⌕</span>
                <small>SMART SEARCH</small>
              </div>

              <input
                type="search"
                placeholder="Try: black shirt under ₹1200, saree, kids set..."
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

            {renderSuggestions()}
          </div>

          <div className="desktopActions">
            <Link href="/wishlist" className="actionButton">
              <span>♡</span>
              <small>Wishlist</small>
              {wishlistCount > 0 && (
                <b className="countBadge">
                  {wishlistCount > 99 ? "99+" : wishlistCount}
                </b>
              )}
            </Link>

            <Link href="/orders" className="actionButton">
              <span>▣</span>
              <small>Orders</small>
            </Link>

            <Link href="/cart" className="actionButton cartAction">
              <span>🛒</span>
              <small>Cart</small>
              {cartCount > 0 && (
                <b className="countBadge">
                  {cartCount > 99 ? "99+" : cartCount}
                </b>
              )}
            </Link>

            <Link href="/login" className="accountButton">
              <span>♙</span>
              <div>
                <small>Account</small>
                <b>Sign in</b>
              </div>
            </Link>
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
        </div>

        <div className="commerceRail">
          <div className="commerceRailInner">
            <div className="railLinks">
              {quickLinks.map((item) => (
                <button
                  type="button"
                  key={item.label}
                  onClick={() => openQuickSearch(item.query)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="railSignal">
              <span>✦</span>
              <b>AI SHOPPING READY</b>
              <small>Ask naturally. Find faster.</small>
            </div>
          </div>
        </div>

        <div
          className={`mobilePanel ${
            mobileMenuOpen ? "mobilePanelOpen" : ""
          }`}
        >
          <div className="mobilePanelHeader">
            <div>
              <small>NEW CITY STYLE</small>
              <strong>Shop, track & manage</strong>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              ×
            </button>
          </div>

          <div className="mobilePanelLinks">
            {commerceLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>{item.icon}</span>
                <b>{item.label}</b>

                {item.href === "/wishlist" && wishlistCount > 0 && (
                  <em>{wishlistCount > 99 ? "99+" : wishlistCount}</em>
                )}
              </Link>
            ))}

            <Link
              href="/cart"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>🛒</span>
              <b>Cart</b>
              {cartCount > 0 && (
                <em>{cartCount > 99 ? "99+" : cartCount}</em>
              )}
            </Link>

            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>♙</span>
              <b>Login / Account</b>
            </Link>
          </div>

          <div className="mobileQuickGrid">
            {quickLinks.map((item) => (
              <button
                type="button"
                key={item.label}
                onClick={() => openQuickSearch(item.query)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mobileSearch">
          <div
            className="searchWrapper"
            ref={mobileSearchWrapperRef}
          >
            <div className="searchBar">
              <span className="searchIcon mobileSearchIcon">⌕</span>

              <input
                type="search"
                placeholder="Search products, categories, brands..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleSearchKeyDown}
                aria-label="Search products on mobile"
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
                Go
              </button>
            </div>

            {renderSuggestions(true)}
          </div>
        </div>

        <style jsx>{`
          .navbar {
            position: sticky;
            z-index: 1000;
            top: 0;
            width: 100%;
            background:
              linear-gradient(
                110deg,
                color-mix(in srgb, var(--navbar-primary) 91%, black 9%),
                var(--navbar-primary) 56%,
                color-mix(in srgb, var(--navbar-primary) 82%, white 18%)
              );
            color: #fff;
            box-shadow: 0 8px 28px rgba(2, 17, 48, 0.19);
            transition:
              box-shadow .22s ease,
              backdrop-filter .22s ease;
          }

          .navbarScrolled {
            box-shadow: 0 14px 34px rgba(2, 17, 48, 0.28);
            backdrop-filter: blur(16px);
          }

          .utilityBar {
            border-bottom: 1px solid rgba(255,255,255,.08);
            background: rgba(1, 13, 34, .3);
          }

          .utilityInner {
            width: min(1500px, calc(100% - 38px));
            min-height: 29px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin: 0 auto;
          }

          .utilityLeft,
          .utilityRight {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }

          .utilityLeft {
            color: rgba(255,255,255,.65);
            font-size: 8px;
            letter-spacing: .5px;
          }

          .utilityLeft b {
            color: #fff;
            font-size: 8px;
            letter-spacing: 1px;
          }

          .liveDot {
            width: 6px;
            height: 6px;
            flex: 0 0 6px;
            border-radius: 50%;
            background: #78f0a4;
            box-shadow: 0 0 10px rgba(120,240,164,.8);
          }

          .utilityRight {
            font-size: 8px;
            font-weight: 700;
          }

          .utilityRight :global(a),
          .utilityRight span {
            color: rgba(255,255,255,.65);
            text-decoration: none;
          }

          .utilityRight :global(a:hover) {
            color: var(--navbar-secondary);
          }

          .navbarInner {
            width: min(1540px, calc(100% - 38px));
            min-height: 78px;
            display: flex;
            align-items: center;
            gap: 18px;
            margin: 0 auto;
          }

          .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
            color: #fff;
            text-decoration: none;
          }

          .brandLogoFrame {
            width: 54px;
            height: 46px;
            display: grid;
            place-items: center;
            flex: 0 0 54px;
            overflow: hidden;
            border: 1px solid color-mix(in srgb, var(--navbar-secondary) 70%, transparent);
            border-radius: 12px;
            background: #fff;
            box-shadow: 0 8px 20px rgba(0,0,0,.16);
          }

          .brandLogo {
            width: 100%;
            height: 100%;
            display: block;
            padding: 4px;
            object-fit: contain;
          }

          .brandLogoMobile {
            display: none;
          }

          .brandMark {
            width: 45px;
            height: 45px;
            display: grid;
            place-items: center;
            border: 1px solid rgba(212,175,55,.78);
            border-radius: 12px;
            background: rgba(212,175,55,.1);
            color: var(--navbar-secondary);
            font-size: 11px;
            font-weight: 950;
            letter-spacing: 1px;
          }

          .brandText strong,
          .brandText small {
            display: block;
            white-space: nowrap;
          }

          .brandText strong {
            color: var(--navbar-secondary);
            font-size: 18px;
            line-height: 1.05;
            letter-spacing: .4px;
          }

          .brandText small {
            margin-top: 4px;
            color: rgba(255,255,255,.62);
            font-size: 8px;
            letter-spacing: 1px;
          }

          .searchWrapper {
            position: relative;
            min-width: 0;
            flex: 1;
          }

          .desktopSearchWrapper {
            max-width: 650px;
            margin: 0 auto;
          }

          .searchBar {
            position: relative;
            display: flex;
            align-items: center;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,.18);
            border-radius: 14px;
            background: #fff;
            box-shadow: 0 8px 20px rgba(2,17,48,.14);
          }

          .searchBar:focus-within {
            border-color: var(--navbar-secondary);
            box-shadow:
              0 0 0 4px rgba(212,175,55,.13),
              0 12px 27px rgba(2,17,48,.2);
          }

          .searchLead {
            width: 88px;
            align-self: stretch;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            flex: 0 0 88px;
            border-right: 1px solid #edf0f5;
            background: #f8fafc;
          }

          .searchLead .searchIcon {
            color: var(--navbar-primary);
            font-size: 19px;
            line-height: 1;
          }

          .searchLead small {
            margin-top: 1px;
            color: #98a2b3;
            font-size: 6px;
            font-weight: 950;
            letter-spacing: .8px;
          }

          .searchBar input {
            width: 100%;
            height: 48px;
            min-width: 0;
            padding: 0 44px 0 14px;
            border: 0;
            outline: 0;
            background: transparent;
            color: #172033;
            font-size: 12px;
          }

          .clearSearch {
            position: absolute;
            z-index: 2;
            right: 91px;
            width: 28px;
            height: 28px;
            border: 0;
            border-radius: 50%;
            background: #f2f4f7;
            color: #667085;
            font-size: 18px;
            cursor: pointer;
          }

          .searchButton {
            align-self: stretch;
            min-width: 80px;
            border: 0;
            background: linear-gradient(135deg, var(--navbar-secondary), #f0d77e);
            color: var(--navbar-primary);
            font-size: 10px;
            font-weight: 950;
            cursor: pointer;
          }

          .desktopActions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
          }

          :global(.desktopActions .actionButton),
          :global(.desktopActions .accountButton) {
            position: relative;
            min-height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(255,255,255,.15);
            border-radius: 13px;
            background: rgba(4,31,68,.22);
            color: #fff !important;
            text-decoration: none !important;
            backdrop-filter: blur(12px);
            transition: .18s ease;
          }

          :global(.desktopActions .actionButton:link),
          :global(.desktopActions .actionButton:visited),
          :global(.desktopActions .actionButton:hover),
          :global(.desktopActions .actionButton:active),
          :global(.desktopActions .accountButton:link),
          :global(.desktopActions .accountButton:visited),
          :global(.desktopActions .accountButton:hover),
          :global(.desktopActions .accountButton:active) {
            color: #fff !important;
            text-decoration: none !important;
          }

          :global(.desktopActions .actionButton) {
            min-width: 74px;
            flex-direction: row;
            gap: 8px;
            padding: 0 12px;
          }

          :global(.desktopActions .actionButton:hover),
          :global(.desktopActions .accountButton:hover) {
            transform: translateY(-1px);
            border-color: rgba(212,175,55,.58);
            background: rgba(212,175,55,.10);
          }

          :global(.desktopActions .actionButton > span) {
            color: #f1d777 !important;
            font-size: 17px;
            line-height: 1;
          }

          :global(.desktopActions .actionButton > small) {
            margin: 0;
            color: #fff !important;
            font-size: 10px;
            font-weight: 900;
            line-height: 1;
            text-decoration: none !important;
            white-space: nowrap;
          }

          :global(.desktopActions .accountButton) {
            min-width: 116px;
            gap: 9px;
            padding: 0 13px;
            border-color: rgba(212,175,55,.48);
            background:
              linear-gradient(
                135deg,
                rgba(212,175,55,.14),
                rgba(255,255,255,.04)
              );
          }

          :global(.desktopActions .accountButton > span) {
            width: 31px;
            height: 31px;
            display: grid;
            place-items: center;
            flex: 0 0 31px;
            border-radius: 10px;
            background: rgba(212,175,55,.13);
            color: #f1d777 !important;
            font-size: 17px;
          }

          :global(.desktopActions .accountButton small),
          :global(.desktopActions .accountButton b) {
            display: block;
            text-decoration: none !important;
            white-space: nowrap;
          }

          :global(.desktopActions .accountButton small) {
            color: rgba(255,255,255,.64) !important;
            font-size: 7px;
            font-weight: 800;
          }

          :global(.desktopActions .accountButton b) {
            margin-top: 4px;
            color: #f2d978 !important;
            font-size: 10px;
            font-weight: 950;
          }

          :global(.desktopActions a),
          :global(.desktopActions a *),
          :global(.brand),
          :global(.brand *) {
            color: inherit;
            text-decoration: none !important;
          }

          .countBadge {
            position: absolute;
            top: 0;
            right: 0;
            min-width: 17px;
            height: 17px;
            display: grid;
            place-items: center;
            padding: 0 4px;
            border: 2px solid var(--navbar-primary);
            border-radius: 999px;
            background: var(--navbar-secondary);
            color: var(--navbar-primary);
            font-size: 7px;
            font-weight: 950;
          }

          .commerceRail {
            border-top: 1px solid rgba(255,255,255,.08);
            border-bottom: 1px solid rgba(255,255,255,.05);
            background: rgba(3,22,55,.46);
          }

          .commerceRailInner {
            width: min(1540px, calc(100% - 38px));
            min-height: 46px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            margin: 0 auto;
          }

          .railLinks {
            display: flex;
            align-items: center;
            gap: 7px;
          }

          .railLinks button {
            min-height: 34px;
            padding: 0 16px;
            border: 1px solid transparent;
            border-radius: 10px;
            background: transparent;
            color: rgba(255,255,255,.95);
            font-size: 11px;
            font-weight: 900;
            cursor: pointer;
            transition: .18s ease;
          }

          .railLinks button:hover {
            border-color: rgba(212,175,55,.34);
            background: rgba(212,175,55,.10);
            color: #f2d978;
          }

          .railSignal {
            display: flex;
            align-items: center;
            gap: 7px;
            min-height: 32px;
            padding: 0 11px;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 999px;
            background: rgba(255,255,255,.035);
            color: rgba(255,255,255,.58);
          }

          .railSignal > span {
            color: var(--navbar-secondary);
            font-size: 13px;
          }

          .railSignal b {
            color: #fff;
            font-size: 8px;
            letter-spacing: .8px;
          }

          .railSignal small {
            font-size: 8px;
          }

          .suggestions {
            position: absolute;
            z-index: 1200;
            top: calc(100% + 9px);
            right: 0;
            left: 0;
            overflow: hidden;
            border: 1px solid #e4e7ec;
            border-radius: 16px;
            background: #fff;
            color: #172033;
            box-shadow: 0 26px 70px rgba(2,17,48,.25);
            animation: suggestionsOpen .18s ease both;
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

          .suggestionHeader span,
          .suggestionHeader small {
            display: block;
          }

          .suggestionHeader span {
            color: var(--navbar-primary);
            font-size: 9px;
            font-weight: 950;
            letter-spacing: 1px;
          }

          .suggestionHeader small {
            margin-top: 2px;
            color: #98a2b3;
            font-size: 7px;
          }

          .suggestionHeader button {
            border: 0;
            background: transparent;
            color: var(--navbar-primary);
            font-size: 9px;
            font-weight: 850;
            cursor: pointer;
          }

          .suggestionList {
            max-height: 420px;
            overflow-y: auto;
          }

          .suggestionItem {
            width: 100%;
            display: grid;
            grid-template-columns: 54px minmax(0, 1fr) auto;
            align-items: center;
            gap: 11px;
            padding: 10px 13px;
            border: 0;
            border-bottom: 1px solid #f0f1f3;
            background: #fff;
            text-align: left;
            cursor: pointer;
          }

          .suggestionItem:hover,
          .suggestionActive {
            background: #f3f6fb;
          }

          .suggestionImage {
            width: 54px;
            height: 60px;
            overflow: hidden;
            display: grid;
            place-items: center;
            border-radius: 9px;
            background: var(--navbar-primary);
            color: var(--navbar-secondary);
            font-size: 9px;
            font-weight: 950;
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
            font-size: 11px;
          }

          .suggestionInfo span {
            margin-top: 4px;
            color: #98a2b3;
            font-size: 8px;
          }

          .suggestionPrice {
            color: var(--navbar-primary);
            font-size: 11px;
            font-weight: 950;
            white-space: nowrap;
          }

          .suggestionState {
            min-height: 90px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 18px;
            color: #667085;
            font-size: 11px;
            text-align: center;
          }

          .miniLoader {
            width: 20px;
            height: 20px;
            border: 3px solid #e4e7ec;
            border-top-color: var(--navbar-primary);
            border-radius: 50%;
            animation: spin .7s linear infinite;
          }

          .searchAllButton {
            width: 100%;
            min-height: 42px;
            border: 0;
            border-top: 1px solid #e4e7ec;
            background: var(--navbar-primary);
            color: #fff;
            font-size: 9px;
            font-weight: 900;
            cursor: pointer;
          }

          .mobileMenuButton,
          .mobilePanel,
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

            .desktopActions {
              gap: 5px;
            }

            .actionButton {
              min-width: 48px;
              padding-inline: 6px;
            }

            .accountButton {
              min-width: 82px;
              padding-inline: 8px;
            }

            .accountButton small {
              display: none;
            }
          }

          @media (max-width: 920px) {
            .utilityBar,
            .commerceRail,
            .desktopSearchWrapper,
            .desktopActions {
              display: none;
            }

            .navbarInner {
              width: calc(100% - 24px);
              min-height: 62px;
            }

            .brandLogoFrame {
              width: 43px;
              height: 43px;
              flex-basis: 43px;
            }

            .brandLogoDesktop {
              display: none;
            }

            .brandLogoMobile {
              display: block;
            }

            .brandText strong {
              font-size: 14px;
            }

            .brandText small {
              display: block;
              font-size: 6px;
            }

            .mobileMenuButton {
              width: 41px;
              height: 41px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 5px;
              margin-left: auto;
              border: 1px solid rgba(255,255,255,.2);
              border-radius: 10px;
              background: rgba(255,255,255,.07);
              cursor: pointer;
            }

            .mobileMenuButton span {
              width: 18px;
              height: 2px;
              border-radius: 999px;
              background: #fff;
            }

            .mobilePanel {
              position: absolute;
              z-index: 1300;
              top: 62px;
              right: 10px;
              left: 10px;
              overflow: hidden;
              padding: 13px;
              border: 1px solid rgba(255,255,255,.13);
              border-radius: 16px;
              background:
                linear-gradient(180deg, rgba(6,31,79,.99), rgba(3,20,50,.99));
              box-shadow: 0 24px 60px rgba(0,0,0,.32);
              backdrop-filter: blur(18px);
            }

            .mobilePanelOpen {
              display: block;
            }

            .mobilePanelHeader {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              padding: 4px 3px 12px;
              border-bottom: 1px solid rgba(255,255,255,.08);
            }

            .mobilePanelHeader small,
            .mobilePanelHeader strong {
              display: block;
            }

            .mobilePanelHeader small {
              color: var(--navbar-secondary);
              font-size: 7px;
              font-weight: 950;
              letter-spacing: 1px;
            }

            .mobilePanelHeader strong {
              margin-top: 3px;
              font-size: 12px;
            }

            .mobilePanelHeader button {
              width: 34px;
              height: 34px;
              border: 1px solid rgba(255,255,255,.14);
              border-radius: 9px;
              background: rgba(255,255,255,.06);
              color: #fff;
              font-size: 20px;
            }

            .mobilePanelLinks {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 7px;
              margin-top: 11px;
            }

            .mobilePanelLinks :global(a) {
              position: relative;
              min-height: 62px;
              display: flex;
              align-items: center;
              gap: 9px;
              padding: 10px;
              border: 1px solid rgba(255,255,255,.08);
              border-radius: 11px;
              background: rgba(255,255,255,.05);
              color: #fff;
              text-decoration: none;
            }

            .mobilePanelLinks :global(a span) {
              color: var(--navbar-secondary);
              font-size: 17px;
            }

            .mobilePanelLinks :global(a b) {
              font-size: 9px;
            }

            .mobilePanelLinks :global(a em) {
              position: absolute;
              top: 7px;
              right: 7px;
              min-width: 17px;
              height: 17px;
              display: grid;
              place-items: center;
              padding: 0 4px;
              border-radius: 999px;
              background: var(--navbar-secondary);
              color: var(--navbar-primary);
              font-size: 7px;
              font-style: normal;
              font-weight: 950;
            }

            .mobileQuickGrid {
              display: flex;
              gap: 6px;
              overflow-x: auto;
              margin-top: 10px;
              padding-bottom: 2px;
              scrollbar-width: none;
            }

            .mobileQuickGrid::-webkit-scrollbar {
              display: none;
            }

            .mobileQuickGrid button {
              flex: 0 0 auto;
              min-height: 31px;
              padding: 0 11px;
              border: 1px solid rgba(212,175,55,.28);
              border-radius: 999px;
              background: rgba(212,175,55,.08);
              color: #eed66f;
              font-size: 8px;
              font-weight: 850;
            }

            .mobileSearch {
              position: relative;
              z-index: 1250;
              display: block;
              overflow: visible;
              padding: 0 12px 10px;
            }

            .mobileSearch .searchWrapper {
              position: static;
            }

            .mobileSearch .searchBar input {
              height: 43px;
              padding-left: 39px;
              font-size: 10px;
            }

            .mobileSearchIcon {
              position: absolute;
              z-index: 2;
              left: 13px;
              color: #667085;
              font-size: 18px;
              pointer-events: none;
            }

            .mobileSearch .clearSearch {
              right: 51px;
              width: 25px;
              height: 25px;
              font-size: 16px;
            }

            .mobileSearch .searchButton {
              min-width: 46px;
              font-size: 9px;
            }

            .mobileSearch .mobileSuggestions {
              position: fixed;
              z-index: 2147483000;
              top: 115px;
              right: 12px;
              left: 12px;
              max-height: calc(100dvh - 130px);
            }

            .mobileSearch .suggestionList {
              max-height: calc(100dvh - 265px);
              overscroll-behavior: contain;
              -webkit-overflow-scrolling: touch;
            }
          }

          @media (max-width: 520px) {
            .navbarInner {
              width: calc(100% - 20px);
            }

            .brandText strong {
              font-size: 13px;
            }

            .brandText small {
              font-size: 5.5px;
            }

            .suggestionItem {
              grid-template-columns: 48px minmax(0, 1fr) auto;
              padding: 8px 9px;
            }

            .suggestionImage {
              width: 48px;
              height: 54px;
            }

            .suggestionPrice {
              font-size: 9px;
            }
          }
        `}</style>
      </nav>

      <div className="mobileBottomBar">
        <Link href="/" className={pathname === "/" ? "activeBottom" : ""}>
          <span>⌂</span>
          <small>Home</small>
        </Link>

        <Link
          href="/search"
          className={pathname?.startsWith("/search") ? "activeBottom" : ""}
        >
          <span>⌕</span>
          <small>Search</small>
        </Link>

        <Link
          href="/wishlist"
          className={pathname?.startsWith("/wishlist") ? "activeBottom" : ""}
        >
          <span>♡</span>
          <small>Wishlist</small>
          {wishlistCount > 0 && (
            <b>{wishlistCount > 9 ? "9+" : wishlistCount}</b>
          )}
        </Link>

        <Link
          href="/cart"
          className={pathname?.startsWith("/cart") ? "activeBottom" : ""}
        >
          <span>🛒</span>
          <small>Cart</small>
          {cartCount > 0 && <b>{cartCount > 9 ? "9+" : cartCount}</b>}
        </Link>

        <Link
          href="/login"
          className={pathname?.startsWith("/login") ? "activeBottom" : ""}
        >
          <span>♙</span>
          <small>Account</small>
        </Link>

        <style jsx>{`
          .mobileBottomBar {
            display: none;
          }

          @media (max-width: 920px) {
            .mobileBottomBar {
              position: fixed;
              z-index: 999;
              right: 9px;
              bottom: max(8px, env(safe-area-inset-bottom));
              left: 9px;
              height: 61px;
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              align-items: center;
              padding: 5px 7px;
              border: 1px solid rgba(10,46,115,.09);
              border-radius: 18px;
              background: rgba(255,255,255,.94);
              box-shadow: 0 16px 45px rgba(2,17,48,.2);
              backdrop-filter: blur(18px);
            }

            .mobileBottomBar :global(a) {
              position: relative;
              min-width: 0;
              height: 50px;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-direction: column;
              gap: 2px;
              border-radius: 12px;
              color: #667085;
              text-decoration: none;
            }

            .mobileBottomBar :global(a span) {
              font-size: 17px;
              line-height: 1;
            }

            .mobileBottomBar :global(a small) {
              font-size: 7px;
              font-weight: 800;
            }

            .mobileBottomBar :global(a.activeBottom) {
              background: color-mix(in srgb, var(--ncs-primary, #0A2E73) 7%, white 93%);
              color: var(--ncs-primary, #0A2E73);
            }

            .mobileBottomBar :global(a b) {
              position: absolute;
              top: 2px;
              right: calc(50% - 20px);
              min-width: 15px;
              height: 15px;
              display: grid;
              place-items: center;
              padding: 0 3px;
              border-radius: 999px;
              background: var(--ncs-secondary, #D4AF37);
              color: var(--ncs-primary, #0A2E73);
              font-size: 6px;
              font-weight: 950;
            }
          }
        `}</style>
      </div>
    </>
  );
}
