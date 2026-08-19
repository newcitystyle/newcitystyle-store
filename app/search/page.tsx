"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string | number;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  price?: number | string | null;
  mrp?: number | string | null;
  stock?: number | string | null;
  online_stock_limit?: number | string | null;
  sell_online?: boolean | null;
  is_active?: boolean | null;
  image?: string | null;
  image_url?: string | null;
  images?: string[] | string | null;
  size?: string | null;
  sizes?: string[] | string | null;
  color?: string | null;
  colors?: string[] | string | null;
  tags?: string[] | string | null;
  material?: string | null;
  gender?: string | null;
  is_new_arrival?: boolean | null;
  is_featured?: boolean | null;
  is_on_sale?: boolean | null;
  discount_percent?: number | string | null;
  created_at?: string | null;

  // Storefront-only fields for individual uploaded designs.
  listing_key?: string | null;
  design_unit_id?: number | null;
  design_name?: string | null;
  parent_name?: string | null;
  is_design_card?: boolean | null;
};

type ProductDesignUnit = {
  id: number;
  product_id: number;
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

type SortOption =
  | "relevance"
  | "newest"
  | "price-low"
  | "price-high"
  | "name-asc"
  | "name-desc"
  | "stock-high"
  | "discount-high";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

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

function getStringArray(value?: string[] | string | null) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    }
  } catch {
    // Continue with comma-separated fallback.
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getProductName(product: Product) {
  return product.name || "Untitled Product";
}

function getProductCardKey(product: Product) {
  return product.listing_key || String(product.id);
}

function getProductHref(product: Product) {
  return product.design_unit_id
    ? `/product/${product.id}?design=${product.design_unit_id}`
    : `/product/${product.id}`;
}

function getPrice(product: Product) {
  const value = Number(product.price ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getMrp(product: Product) {
  const value = Number(product.mrp ?? product.price ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getStock(product: Product) {
  const physicalStock = Number(product.stock ?? 0);
  const onlineStock = Number(product.online_stock_limit ?? 0);

  const safePhysicalStock =
    Number.isFinite(physicalStock) ? Math.max(0, physicalStock) : 0;

  const safeOnlineStock =
    Number.isFinite(onlineStock) ? Math.max(0, onlineStock) : 0;

  return Math.min(safePhysicalStock, safeOnlineStock);
}

function getDiscount(product: Product) {
  const savedDiscount = Number(product.discount_percent ?? 0);

  if (Number.isFinite(savedDiscount) && savedDiscount > 0) {
    return Math.round(savedDiscount);
  }

  const price = getPrice(product);
  const mrp = getMrp(product);

  if (mrp <= price || mrp <= 0) return 0;

  return Math.round(((mrp - price) / mrp) * 100);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("all");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [newArrivalOnly, setNewArrivalOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [discountFilter, setDiscountFilter] = useState("all");
  const [sortOption, setSortOption] = useState<SortOption>("relevance");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const [maxPrice, setMaxPrice] = useState(5000);
  const [priceLimit, setPriceLimit] = useState(5000);
  const [visibleCount, setVisibleCount] = useState(12);

  const [busyProductId, setBusyProductId] = useState<
    string | number | null
  >(null);

  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    loadProducts();
  }, [query]);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadProducts() {
    setLoading(true);
    setErrorMessage("");
    setVisibleCount(12);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("sell_online", true)
        .eq("is_active", true)
        .gt("stock", 0)
        .gt("online_stock_limit", 0)
        .order("id", { ascending: false });

      if (error) throw error;

      const parentProducts = ((data as Product[]) || []).filter((product) =>
        product.sell_online === true &&
        product.is_active === true &&
        Number(product.stock ?? 0) > 0 &&
        Number(product.online_stock_limit ?? 0) > 0
      );

      const productIds = parentProducts
        .map((product) => Number(product.id))
        .filter((id) => Number.isFinite(id) && id > 0);

      let designUnits: ProductDesignUnit[] = [];
      let designLinks: ProductDesignLink[] = [];

      if (productIds.length > 0) {
        const [designResponse, linkResponse] = await Promise.all([
          supabase
            .from("product_design_units")
            .select("id,product_id,design_name,image_url,status,sort_order")
            .in("product_id", productIds)
            .neq("status", "hidden")
            .order("sort_order", { ascending: true })
            .order("id", { ascending: true }),

          supabase
            .from("product_design_unit_variants")
            .select("id,product_id,design_unit_id,variant_id,status")
            .in("product_id", productIds)
            .neq("status", "hidden"),
        ]);

        if (designResponse.error) {
          console.info("Search design units error:", designResponse.error.message);
        } else {
          designUnits = (designResponse.data || []) as ProductDesignUnit[];
        }

        if (linkResponse.error) {
          console.info("Search design links error:", linkResponse.error.message);
        } else {
          designLinks = (linkResponse.data || []) as ProductDesignLink[];
        }
      }

      const expandedProducts: Product[] = [];

      for (const parent of parentProducts) {
        const parentId = Number(parent.id);
        const parentName = getProductName(parent);

        const availableDesigns = designUnits
          .filter((design) =>
            Number(design.product_id) === parentId &&
            design.status !== "hidden" &&
            design.status !== "sold_out" &&
            Boolean(design.image_url?.trim()) &&
            designLinks.some((link) =>
              Number(link.design_unit_id) === Number(design.id) &&
              link.status === "available"
            )
          )
          .sort((a, b) => {
            const orderDiff = Number(a.sort_order || 0) - Number(b.sort_order || 0);
            return orderDiff !== 0 ? orderDiff : Number(a.id) - Number(b.id);
          });

        if (availableDesigns.length > 0) {
          availableDesigns.forEach((design, index) => {
            expandedProducts.push({
              ...parent,
              name: design.design_name?.trim() || `${parentName} Design ${index + 1}`,
              parent_name: parentName,
              image_url: design.image_url?.trim() || getProductImage(parent),
              image: design.image_url?.trim() || getProductImage(parent),
              stock: 1,
              online_stock_limit: 1,
              listing_key: `product-${parentId}-design-${design.id}`,
              design_unit_id: Number(design.id),
              design_name: design.design_name?.trim() || `Design ${index + 1}`,
              is_design_card: true,
            });
          });
          continue;
        }

        expandedProducts.push({
          ...parent,
          listing_key: `product-${parentId}`,
          design_unit_id: null,
          design_name: null,
          parent_name: null,
          is_design_card: false,
        });
      }

      const normalizedQuery = query.toLowerCase();

      const allProducts = expandedProducts.filter((product) => {
        if (!query) return true;

        return [
          product.name,
          product.parent_name,
          product.design_name,
          product.description,
          product.category,
          product.subcategory,
          product.brand,
          product.color,
          product.size,
          product.material,
          product.gender,
          ...getStringArray(product.tags),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      });

      const highestPrice = Math.max(
        1000,
        ...allProducts.map((product) => getPrice(product))
      );

      setMaxPrice(Math.ceil(highestPrice / 500) * 500);
      setPriceLimit(Math.ceil(highestPrice / 500) * 500);
      setProducts(allProducts);
    } catch (error) {
      console.error("Search page error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to search products."
      );
    } finally {
      setLoading(false);
    }
  }

  async function addToWishlist(product: Product) {
    setBusyProductId(getProductCardKey(product));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setToast({
          type: "error",
          message: "Please login first.",
        });

        router.push("/login");
        return;
      }

      const { data: existing, error: existingError } = await supabase
        .from("wishlist")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .eq("image", getProductImage(product))
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        setToast({
          type: "success",
          message: "Product is already in your wishlist.",
        });
        return;
      }

      const { error } = await supabase.from("wishlist").insert({
        user_id: user.id,
        product_id: product.id,
        name: getProductName(product),
        image: getProductImage(product),
        price: getPrice(product),
      });

      if (error) throw error;

      setToast({
        type: "success",
        message: "Added to wishlist.",
      });
    } catch (error) {
      console.error("Wishlist error:", error);

      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to add to wishlist.",
      });
    } finally {
      setBusyProductId(null);
    }
  }

  async function addToCart(product: Product) {
    if (product.design_unit_id) {
      router.push(getProductHref(product));
      return;
    }

    setBusyProductId(getProductCardKey(product));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setToast({
          type: "error",
          message: "Please login first.",
        });

        router.push("/login");
        return;
      }

      const { data: existing, error: existingError } = await supabase
        .from("cart")
        .select("*")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        const { error: updateError } = await supabase
          .from("cart")
          .update({
            quantity: Number(existing.quantity || 0) + 1,
          })
          .eq("id", existing.id);

        if (updateError) throw updateError;
      } else {
        const productSizes = getStringArray(product.sizes);
        const productColors = getStringArray(product.colors);

        const { error: insertError } = await supabase.from("cart").insert({
          user_id: user.id,
          product_id: product.id,
          name: getProductName(product),
          image: getProductImage(product),
          price: getPrice(product),
          quantity: 1,
          size: product.size || productSizes[0] || "M",
          color: product.color || productColors[0] || "Blue",
        });

        if (insertError) throw insertError;
      }

      setToast({
        type: "success",
        message: "Product added to cart.",
      });
    } catch (error) {
      console.error("Cart error:", error);

      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to add product to cart.",
      });
    } finally {
      setBusyProductId(null);
    }
  }

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        products
          .flatMap((product) => [
            product.category || "",
            product.subcategory || "",
          ])
          .map((value) => String(value).trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const brands = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((product) => String(product.brand || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const sizes = useMemo(() => {
    return Array.from(
      new Set(
        products.flatMap((product) => [
          ...(product.size ? [product.size] : []),
          ...getStringArray(product.sizes),
        ])
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const colors = useMemo(() => {
    return Array.from(
      new Set(
        products.flatMap((product) => [
          ...(product.color ? [product.color] : []),
          ...getStringArray(product.colors),
        ])
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const materials = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((product) => String(product.material || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const genders = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((product) => String(product.gender || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const tags = useMemo(() => {
    return Array.from(
      new Set(products.flatMap((product) => getStringArray(product.tags)))
    ).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const category = String(product.category || "").toLowerCase();
      const subcategory = String(product.subcategory || "").toLowerCase();
      const brand = String(product.brand || "").toLowerCase();
      const material = String(product.material || "").toLowerCase();
      const gender = String(product.gender || "").toLowerCase();
      const productTags = getStringArray(product.tags).map((item) =>
        item.toLowerCase()
      );
      const stock = getStock(product);
      const price = getPrice(product);
      const discount = getDiscount(product);

      const productSizes = [
        ...(product.size ? [product.size] : []),
        ...getStringArray(product.sizes),
      ].map((item) => item.toLowerCase());

      const productColors = [
        ...(product.color ? [product.color] : []),
        ...getStringArray(product.colors),
      ].map((item) => item.toLowerCase());

      const matchesCategory =
        categoryFilter === "all" ||
        category === categoryFilter.toLowerCase() ||
        subcategory === categoryFilter.toLowerCase();

      const matchesBrand =
        brandFilter === "all" ||
        brand === brandFilter.toLowerCase();

      const matchesSize =
        sizeFilter === "all" ||
        productSizes.includes(sizeFilter.toLowerCase());

      const matchesColor =
        colorFilter === "all" ||
        productColors.includes(colorFilter.toLowerCase());

      const matchesMaterial =
        materialFilter === "all" ||
        material === materialFilter.toLowerCase();

      const matchesGender =
        genderFilter === "all" ||
        gender === genderFilter.toLowerCase();

      const matchesTag =
        tagFilter === "all" ||
        productTags.includes(tagFilter.toLowerCase());

      const matchesNewArrival =
        !newArrivalOnly || product.is_new_arrival === true;

      const matchesFeatured =
        !featuredOnly || product.is_featured === true;

      const matchesOnSale =
        !onSaleOnly || product.is_on_sale === true || discount > 0;

      const matchesPrice = price <= priceLimit;

      let matchesStock = true;

      if (stockFilter === "in-stock") {
        matchesStock = stock > 0;
      } else if (stockFilter === "out-of-stock") {
        matchesStock = stock <= 0;
      } else if (stockFilter === "low-stock") {
        matchesStock = stock > 0 && stock <= 5;
      }

      let matchesDiscount = true;

      if (discountFilter === "10") {
        matchesDiscount = discount >= 10;
      } else if (discountFilter === "20") {
        matchesDiscount = discount >= 20;
      } else if (discountFilter === "30") {
        matchesDiscount = discount >= 30;
      } else if (discountFilter === "40") {
        matchesDiscount = discount >= 40;
      } else if (discountFilter === "50") {
        matchesDiscount = discount >= 50;
      }

      return (
        matchesCategory &&
        matchesBrand &&
        matchesSize &&
        matchesColor &&
        matchesMaterial &&
        matchesGender &&
        matchesTag &&
        matchesNewArrival &&
        matchesFeatured &&
        matchesOnSale &&
        matchesPrice &&
        matchesStock &&
        matchesDiscount
      );
    });

    return [...filtered].sort((a, b) => {
      const priceA = getPrice(a);
      const priceB = getPrice(b);
      const nameA = getProductName(a).toLowerCase();
      const nameB = getProductName(b).toLowerCase();
      const stockA = getStock(a);
      const stockB = getStock(b);
      const discountA = getDiscount(a);
      const discountB = getDiscount(b);

      switch (sortOption) {
        case "newest":
          return (
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
          );

        case "price-low":
          return priceA - priceB;

        case "price-high":
          return priceB - priceA;

        case "name-asc":
          return nameA.localeCompare(nameB);

        case "name-desc":
          return nameB.localeCompare(nameA);

        case "stock-high":
          return stockB - stockA;

        case "discount-high":
          return discountB - discountA;

        case "relevance":
        default:
          return 0;
      }
    });
  }, [
    products,
    categoryFilter,
    brandFilter,
    stockFilter,
    sizeFilter,
    colorFilter,
    materialFilter,
    genderFilter,
    tagFilter,
    newArrivalOnly,
    featuredOnly,
    onSaleOnly,
    discountFilter,
    priceLimit,
    sortOption,
  ]);

  const displayedProducts = visibleProducts.slice(0, visibleCount);

  function clearFilters() {
    setCategoryFilter("all");
    setBrandFilter("all");
    setStockFilter("all");
    setSizeFilter("all");
    setColorFilter("all");
    setMaterialFilter("all");
    setGenderFilter("all");
    setTagFilter("all");
    setNewArrivalOnly(false);
    setFeaturedOnly(false);
    setOnSaleOnly(false);
    setDiscountFilter("all");
    setSortOption("relevance");
    setPriceLimit(maxPrice);
    setVisibleCount(12);
  }

  const activeFilterCount = [
    categoryFilter !== "all",
    brandFilter !== "all",
    sizeFilter !== "all",
    colorFilter !== "all",
    materialFilter !== "all",
    genderFilter !== "all",
    tagFilter !== "all",
    stockFilter !== "all",
    discountFilter !== "all",
    newArrivalOnly,
    featuredOnly,
    onSaleOnly,
    priceLimit < maxPrice,
  ].filter(Boolean).length;

  const filterControls = (
    <>
      <FilterSelect
        label="Category"
        value={categoryFilter}
        onChange={setCategoryFilter}
        options={categories}
        defaultLabel="All Categories"
      />

      <FilterSelect
        label="Brand"
        value={brandFilter}
        onChange={setBrandFilter}
        options={brands}
        defaultLabel="All Brands"
      />

      <FilterSelect
        label="Size"
        value={sizeFilter}
        onChange={setSizeFilter}
        options={sizes}
        defaultLabel="All Sizes"
      />

      <FilterSelect
        label="Color"
        value={colorFilter}
        onChange={setColorFilter}
        options={colors}
        defaultLabel="All Colors"
      />

      <FilterSelect
        label="Material"
        value={materialFilter}
        onChange={setMaterialFilter}
        options={materials}
        defaultLabel="All Materials"
      />

      <FilterSelect
        label="Gender"
        value={genderFilter}
        onChange={setGenderFilter}
        options={genders}
        defaultLabel="All Genders"
      />

      <FilterSelect
        label="Tags"
        value={tagFilter}
        onChange={setTagFilter}
        options={tags}
        defaultLabel="All Tags"
      />

      <div className="filterBlock">
        <label>Stock Status</label>
        <select
          value={stockFilter}
          onChange={(event) => setStockFilter(event.target.value)}
        >
          <option value="all">All Stock</option>
          <option value="in-stock">In Stock</option>
          <option value="low-stock">Low Stock</option>
          <option value="out-of-stock">Out of Stock</option>
        </select>
      </div>

      <div className="filterBlock">
        <label>Minimum Discount</label>
        <select
          value={discountFilter}
          onChange={(event) => setDiscountFilter(event.target.value)}
        >
          <option value="all">All Discounts</option>
          <option value="10">10% and above</option>
          <option value="20">20% and above</option>
          <option value="30">30% and above</option>
          <option value="40">40% and above</option>
          <option value="50">50% and above</option>
        </select>
      </div>

      <div className="premiumToggleGroup">
        <span className="toggleGroupTitle">Premium Collections</span>

        <label className="toggleRow">
          <input
            type="checkbox"
            checked={newArrivalOnly}
            onChange={(event) => setNewArrivalOnly(event.target.checked)}
          />
          <span>New Arrivals</span>
        </label>

        <label className="toggleRow">
          <input
            type="checkbox"
            checked={featuredOnly}
            onChange={(event) => setFeaturedOnly(event.target.checked)}
          />
          <span>Featured Products</span>
        </label>

        <label className="toggleRow">
          <input
            type="checkbox"
            checked={onSaleOnly}
            onChange={(event) => setOnSaleOnly(event.target.checked)}
          />
          <span>On Sale</span>
        </label>
      </div>

      <div className="priceBlock">
        <div className="priceHeader">
          <label>Maximum Price</label>
          <strong>{formatCurrency(priceLimit)}</strong>
        </div>

        <input
          type="range"
          min="0"
          max={maxPrice}
          step="100"
          value={priceLimit}
          onChange={(event) => setPriceLimit(Number(event.target.value))}
        />

        <div className="priceScale">
          <span>₹0</span>
          <span>{formatCurrency(maxPrice)}</span>
        </div>
      </div>
    </>
  );

  if (loading) {
    return (
      <main className="statePage">
        <div className="loader" />
        <h2>Searching Products...</h2>
        <p>Please wait while we find the best matches.</p>

        <style jsx>{`
          .statePage {
            min-height: 70vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #f8f4ec;
            color: #0a2e73;
            text-align: center;
          }

          .loader {
            width: 48px;
            height: 48px;
            margin-bottom: 18px;
            border: 4px solid #e4e7ec;
            border-top-color: #0a2e73;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          h2 {
            margin: 0;
          }

          p {
            color: #667085;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="page">
      {toast && (
        <div className={`toast ${toast.type}`}>
          <strong>{toast.type === "success" ? "✓" : "!"}</strong>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="container">
        <section className="hero">
          <div>
            <p className="eyebrow">NEW CITY STYLE SEARCH</p>
            <h1>Search Results</h1>
            <p>
              Showing results for{" "}
              <strong>“{query || "All Products"}”</strong>
            </p>
          </div>

          <div className="resultCount">
            <span>{visibleProducts.length}</span>
            <small>Products Found</small>
          </div>
        </section>

        {errorMessage && (
          <div className="alert">
            <strong>!</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        <section className="layout">
          <aside className="sidebar">
            <div className="sidebarHeader">
              <div>
                <span>FILTER PRODUCTS</span>
                <h2>Refine Results</h2>
              </div>

              <button type="button" onClick={clearFilters}>
                Reset
              </button>
            </div>

            {filterControls}

            <button
              type="button"
              className="clearFiltersButton"
              onClick={clearFilters}
            >
              Clear All Filters
            </button>
          </aside>

          <div
            className={`mobileDrawerOverlay ${
              isFilterDrawerOpen ? "open" : ""
            }`}
            onClick={() => setIsFilterDrawerOpen(false)}
            aria-hidden={!isFilterDrawerOpen}
          />

          <aside
            className={`mobileFilterDrawer ${
              isFilterDrawerOpen ? "open" : ""
            }`}
            aria-hidden={!isFilterDrawerOpen}
          >
            <div className="mobileDrawerHeader">
              <div>
                <span>NEW CITY STYLE</span>
                <h2>Product Filters</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                aria-label="Close filters"
              >
                ×
              </button>
            </div>

            <div className="mobileDrawerBody">{filterControls}</div>

            <div className="mobileDrawerFooter">
              <button type="button" className="drawerReset" onClick={clearFilters}>
                Reset
              </button>
              <button
                type="button"
                className="drawerApply"
                onClick={() => setIsFilterDrawerOpen(false)}
              >
                Show {visibleProducts.length} Products
              </button>
            </div>
          </aside>

          <section className="resultsArea">
            <div className="toolbar">
              <div>
                <strong>{visibleProducts.length}</strong>
                <span> matching products</span>
              </div>

              <button
                type="button"
                className="mobileFilterButton"
                onClick={() => setIsFilterDrawerOpen(true)}
              >
                <span>Filters</span>
                {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
              </button>

              <label>
                Sort By
                <select
                  value={sortOption}
                  onChange={(event) =>
                    setSortOption(event.target.value as SortOption)
                  }
                >
                  <option value="relevance">Relevance</option>
                  <option value="newest">Newest First</option>
                  <option value="price-low">
                    Price: Low to High
                  </option>
                  <option value="price-high">
                    Price: High to Low
                  </option>
                  <option value="discount-high">
                    Highest Discount
                  </option>
                  <option value="name-asc">Name: A to Z</option>
                  <option value="name-desc">Name: Z to A</option>
                  <option value="stock-high">
                    Stock: High to Low
                  </option>
                </select>
              </label>
            </div>

            {visibleProducts.length === 0 ? (
              <section className="emptyState">
                <div className="emptyIcon">⌕</div>
                <h2>No Products Found</h2>
                <p>
                  Try another product name, category or filter.
                </p>
                <button type="button" onClick={clearFilters}>
                  Clear Filters
                </button>
              </section>
            ) : (
              <>
                <section className="productGrid">
                  {displayedProducts.map((product) => {
                    const image = getProductImage(product);
                    const name = getProductName(product);
                    const price = getPrice(product);
                    const mrp = getMrp(product);
                    const stock = getStock(product);
                    const savings = Math.max(mrp - price, 0);
                    const discount = getDiscount(product);
                    const isBusy = busyProductId === getProductCardKey(product);

                    return (
                      <article
                        key={getProductCardKey(product)}
                        className="productCard"
                      >
                        <div className="imageWrap">
                          <Link href={getProductHref(product)}>
                            {image ? (
                              <img src={image} alt={name} />
                            ) : (
                              <div className="imageFallback">
                                NCS
                              </div>
                            )}
                          </Link>

                          {product.is_new_arrival && (
                            <span className="newBadge">NEW</span>
                          )}

                          {product.is_featured && (
                            <span className="featuredBadge">FEATURED</span>
                          )}

                          {discount > 0 && (
                            <span className="discountBadge">
                              {discount}% OFF
                            </span>
                          )}

                          <button
                            type="button"
                            className="wishlistButton"
                            disabled={isBusy}
                            onClick={() => addToWishlist(product)}
                            aria-label={`Add ${name} to wishlist`}
                          >
                            ♥
                          </button>

                          <Link
                            href={getProductHref(product)}
                            className="quickView"
                          >
                            Quick View
                          </Link>
                        </div>

                        <div className="productBody">
                          <span className="category">
                            {product.category ||
                              product.subcategory ||
                              "Fashion"}
                          </span>

                          <Link
                            href={getProductHref(product)}
                            className="productName"
                          >
                            {name}
                          </Link>

                          <div className="rating">
                            <span>★★★★★</span>
                            <small>4.8</small>
                          </div>

                          <div className="priceRow">
                            <strong>{formatCurrency(price)}</strong>

                            {mrp > price && (
                              <del>{formatCurrency(mrp)}</del>
                            )}
                          </div>

                          {savings > 0 && (
                            <p className="saveText">
                              You save {formatCurrency(savings)}
                            </p>
                          )}

                          <p className="description">
                            {product.description ||
                              "Premium fashion selected for comfort and style."}
                          </p>

                          <div className="stockRow">
                            <span
                              className={
                                stock > 5
                                  ? "stock inStock"
                                  : stock > 0
                                    ? "stock lowStock"
                                    : "stock outStock"
                              }
                            >
                              {stock > 5
                                ? "In Stock"
                                : stock > 0
                                  ? `${stock} left`
                                  : "Out of Stock"}
                            </span>
                          </div>

                          <div className="cardActions">
                            <button
                              type="button"
                              disabled={isBusy || stock <= 0}
                              onClick={() => addToCart(product)}
                            >
                              {isBusy
                                ? "Please Wait..."
                                : stock <= 0
                                  ? "Out of Stock"
                                  : product.design_unit_id
                                    ? "Choose Options"
                                    : "Add to Cart"}
                            </button>

                            <Link href={getProductHref(product)}>
                              View
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </section>

                {visibleCount < visibleProducts.length && (
                  <div className="loadMoreWrap">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleCount((count) => count + 12)
                      }
                    >
                      Load More Products
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </section>
      </div>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          background: #f8f4ec;
          color: #172033;
          font-family: Inter, Poppins, Arial, sans-serif;
        }

        button,
        input,
        select {
          font: inherit;
        }

        .page {
          min-height: 100vh;
          padding: 38px 20px 70px;
          background:
            radial-gradient(
              circle at top right,
              rgba(212, 175, 55, 0.12),
              transparent 28%
            ),
            #f8f4ec;
        }

        .container {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
        }

        .toast {
          position: fixed;
          top: 95px;
          right: 22px;
          z-index: 4000;
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: 380px;
          padding: 14px 17px;
          border-radius: 12px;
          color: white;
          font-size: 13px;
          font-weight: 800;
          box-shadow: 0 18px 40px rgba(16, 24, 40, 0.24);
        }

        .toast.success {
          background: #067647;
        }

        .toast.error {
          background: #b42318;
        }

        .hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
          padding: 28px;
          border: 1px solid rgba(10, 46, 115, 0.08);
          border-radius: 20px;
          background: linear-gradient(135deg, #0a2e73, #16499d);
          color: white;
          box-shadow: 0 18px 42px rgba(10, 46, 115, 0.18);
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #d4af37;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(31px, 4vw, 48px);
        }

        .hero p {
          margin: 10px 0 0;
          color: rgba(255, 255, 255, 0.78);
        }

        .resultCount {
          min-width: 140px;
          padding: 18px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.08);
          text-align: center;
          backdrop-filter: blur(10px);
        }

        .resultCount span,
        .resultCount small {
          display: block;
        }

        .resultCount span {
          color: #d4af37;
          font-size: 35px;
          font-weight: 900;
        }

        .resultCount small {
          margin-top: 4px;
          color: rgba(255, 255, 255, 0.72);
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          padding: 14px 16px;
          border: 1px solid #fecdca;
          border-radius: 12px;
          background: #fef3f2;
          color: #b42318;
          font-weight: 700;
        }

        .layout {
          display: grid;
          grid-template-columns: 290px minmax(0, 1fr);
          gap: 24px;
          align-items: start;
        }

        .sidebar {
          position: sticky;
          top: 100px;
          padding: 20px;
          border: 1px solid #e4e7ec;
          border-radius: 18px;
          background: white;
          box-shadow: 0 10px 28px rgba(16, 24, 40, 0.06);
        }

        .sidebarHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 20px;
        }

        .sidebarHeader span {
          color: #d4af37;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.3px;
        }

        .sidebarHeader h2 {
          margin: 4px 0 0;
          color: #0a2e73;
          font-size: 22px;
        }

        .sidebarHeader button {
          border: 0;
          background: transparent;
          color: #0a2e73;
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
        }

        .filterBlock,
        .priceBlock {
          padding: 15px 0;
          border-top: 1px solid #eaecf0;
        }

        .filterBlock label,
        .priceBlock label {
          display: block;
          margin-bottom: 8px;
          color: #475467;
          font-size: 12px;
          font-weight: 800;
        }

        .filterBlock select {
          width: 100%;
          height: 42px;
          padding: 0 10px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: white;
          color: #344054;
          outline: none;
        }

        .priceHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .priceHeader strong {
          color: #d4af37;
          font-size: 13px;
        }

        .priceBlock input {
          width: 100%;
          accent-color: #0a2e73;
        }

        .priceScale {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
          color: #98a2b3;
          font-size: 10px;
        }

        .clearFiltersButton {
          width: 100%;
          min-height: 43px;
          margin-top: 15px;
          border: 1px solid #d4af37;
          border-radius: 10px;
          background: #fff9e8;
          color: #0a2e73;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .resultsArea {
          min-width: 0;
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
          padding: 16px 18px;
          border: 1px solid #e4e7ec;
          border-radius: 15px;
          background: white;
          box-shadow: 0 8px 22px rgba(16, 24, 40, 0.05);
        }

        .toolbar strong {
          color: #0a2e73;
        }

        .toolbar span {
          color: #667085;
          font-size: 12px;
        }

        .toolbar label {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #475467;
          font-size: 12px;
          font-weight: 800;
        }

        .toolbar select {
          min-width: 190px;
          height: 40px;
          padding: 0 10px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: white;
        }

        .productGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 22px;
        }

        .productCard {
          height: 100%;
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.08);
          border-radius: 18px;
          background: white;
          box-shadow: 0 10px 28px rgba(16, 24, 40, 0.08);
          transition:
            transform 0.35s ease,
            box-shadow 0.35s ease,
            border-color 0.35s ease;
        }

        .productCard:hover {
          transform: translateY(-9px);
          border-color: rgba(212, 175, 55, 0.65);
          box-shadow: 0 24px 50px rgba(16, 24, 40, 0.16);
        }

        .imageWrap {
          position: relative;
          height: 315px;
          overflow: hidden;
          background: #f5f7fb;
        }

        .imageWrap :global(a) {
          display: block;
          width: 100%;
          height: 100%;
        }

        .imageWrap img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform 0.45s ease;
        }

        .productCard:hover .imageWrap img {
          transform: scale(1.08);
        }

        .imageFallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a2e73, #16499d);
          color: #d4af37;
          font-size: 24px;
          font-weight: 900;
        }

        .newBadge,
        .discountBadge {
          position: absolute;
          top: 13px;
          z-index: 2;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 900;
        }

        .newBadge {
          left: 13px;
          background: #d4af37;
          color: #0a2e73;
        }

        .discountBadge {
          right: 13px;
          background: #ecfdf3;
          color: #067647;
        }

        .wishlistButton {
          position: absolute;
          top: 52px;
          right: 13px;
          z-index: 3;
          width: 38px;
          height: 38px;
          border: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.94);
          color: #d92d20;
          font-size: 17px;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(16, 24, 40, 0.16);
        }

        .quickView {
          position: absolute;
          right: 14px;
          bottom: 14px;
          left: 14px;
          padding: 12px;
          border-radius: 10px;
          background: rgba(10, 46, 115, 0.92);
          color: white;
          font-size: 12px;
          font-weight: 850;
          text-align: center;
          text-decoration: none;
          opacity: 0;
          transform: translateY(12px);
          transition:
            opacity 0.25s ease,
            transform 0.25s ease;
          backdrop-filter: blur(10px);
        }

        .productCard:hover .quickView {
          opacity: 1;
          transform: translateY(0);
        }

        .productBody {
          padding: 17px;
        }

        .category {
          display: inline-block;
          margin-bottom: 8px;
          color: #d4af37;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }

        .productName {
          display: block;
          color: #0a2e73;
          font-size: 19px;
          font-weight: 850;
          line-height: 1.3;
          text-decoration: none;
        }

        .rating {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 9px;
        }

        .rating span {
          color: #f59e0b;
          letter-spacing: 1px;
        }

        .rating small {
          color: #667085;
          font-weight: 700;
        }

        .priceRow {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 11px;
        }

        .priceRow strong {
          color: #d4af37;
          font-size: 23px;
        }

        .priceRow del {
          color: #98a2b3;
          font-size: 12px;
        }

        .saveText {
          margin: 5px 0 0;
          color: #067647;
          font-size: 11px;
          font-weight: 750;
        }

        .description {
          display: -webkit-box;
          overflow: hidden;
          margin: 11px 0 0;
          color: #667085;
          font-size: 12px;
          line-height: 1.6;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .stockRow {
          margin-top: 12px;
        }

        .stock {
          display: inline-flex;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 850;
        }

        .inStock {
          background: #ecfdf3;
          color: #067647;
        }

        .lowStock {
          background: #fff4e8;
          color: #b54708;
        }

        .outStock {
          background: #fef3f2;
          color: #b42318;
        }

        .cardActions {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 9px;
          margin-top: 15px;
        }

        .cardActions button,
        .cardActions :global(a) {
          min-height: 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          font-size: 11px;
          font-weight: 850;
          text-decoration: none;
          cursor: pointer;
        }

        .cardActions button {
          border: 0;
          background: linear-gradient(135deg, #0a2e73, #16499d);
          color: white;
        }

        .cardActions :global(a) {
          padding: 0 14px;
          border: 1px solid #d4af37;
          background: #fff9e8;
          color: #0a2e73;
        }

        .loadMoreWrap {
          display: flex;
          justify-content: center;
          margin-top: 30px;
        }

        .loadMoreWrap button {
          min-height: 48px;
          padding: 0 24px;
          border: 1px solid #d4af37;
          border-radius: 11px;
          background: linear-gradient(135deg, #d4af37, #f1d26a);
          color: #0a2e73;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 12px 24px rgba(212, 175, 55, 0.23);
        }

        .emptyState {
          min-height: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          border: 1px solid #e4e7ec;
          border-radius: 18px;
          background: white;
          text-align: center;
        }

        .emptyIcon {
          width: 82px;
          height: 82px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 22px;
          background: linear-gradient(135deg, #0a2e73, #16499d);
          color: #d4af37;
          font-size: 38px;
        }

        .emptyState h2 {
          margin: 17px 0 7px;
          color: #0a2e73;
        }

        .emptyState p {
          color: #667085;
        }

        .emptyState button {
          min-height: 44px;
          margin-top: 13px;
          padding: 0 18px;
          border: 0;
          border-radius: 9px;
          background: #d4af37;
          color: #0a2e73;
          font-weight: 850;
          cursor: pointer;
        }

        .premiumToggleGroup {
          padding: 15px 0;
          border-top: 1px solid #eaecf0;
        }

        .toggleGroupTitle {
          display: block;
          margin-bottom: 10px;
          color: #475467;
          font-size: 12px;
          font-weight: 800;
        }

        .toggleRow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 9px 0;
          color: #344054;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .toggleRow input {
          width: 17px;
          height: 17px;
          accent-color: #0a2e73;
        }

        .mobileFilterButton {
          display: none;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 15px;
          border: 1px solid #d4af37;
          border-radius: 9px;
          background: #fff9e8;
          color: #0a2e73;
          font-weight: 850;
          cursor: pointer;
        }

        .mobileFilterButton b {
          min-width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #0a2e73;
          color: #d4af37;
          font-size: 11px;
        }

        .mobileDrawerOverlay,
        .mobileFilterDrawer {
          display: none;
        }

        .featuredBadge {
          position: absolute;
          top: 48px;
          left: 12px;
          z-index: 2;
          padding: 6px 9px;
          border-radius: 999px;
          background: #0a2e73;
          color: #d4af37;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.6px;
        }

        @media (max-width: 1050px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .sidebar {
            display: none;
          }

          .mobileFilterButton {
            display: inline-flex;
          }

          .mobileDrawerOverlay {
            position: fixed;
            inset: 0;
            z-index: 4998;
            display: block;
            background: rgba(10, 28, 60, 0.58);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease;
            backdrop-filter: blur(3px);
          }

          .mobileDrawerOverlay.open {
            opacity: 1;
            pointer-events: auto;
          }

          .mobileFilterDrawer {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            z-index: 4999;
            width: min(430px, 92vw);
            display: flex;
            flex-direction: column;
            background: #f8f4ec;
            box-shadow: -20px 0 50px rgba(10, 46, 115, 0.25);
            transform: translateX(105%);
            transition: transform 0.28s ease;
          }

          .mobileFilterDrawer.open {
            transform: translateX(0);
          }

          .mobileDrawerHeader {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            padding: 20px;
            background: linear-gradient(135deg, #0a2e73, #16499d);
            color: white;
          }

          .mobileDrawerHeader span {
            color: #d4af37;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 1.5px;
          }

          .mobileDrawerHeader h2 {
            margin: 4px 0 0;
            font-size: 22px;
          }

          .mobileDrawerHeader button {
            width: 40px;
            height: 40px;
            border: 1px solid rgba(255, 255, 255, 0.22);
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 27px;
            cursor: pointer;
          }

          .mobileDrawerBody {
            flex: 1;
            overflow-y: auto;
            padding: 8px 20px 24px;
          }

          .mobileDrawerFooter {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 10px;
            padding: 14px 16px;
            border-top: 1px solid #e4e7ec;
            background: white;
          }

          .mobileDrawerFooter button {
            min-height: 48px;
            padding: 0 17px;
            border-radius: 10px;
            font-weight: 900;
            cursor: pointer;
          }

          .drawerReset {
            border: 1px solid #d0d5dd;
            background: white;
            color: #475467;
          }

          .drawerApply {
            border: 0;
            background: linear-gradient(135deg, #0a2e73, #16499d);
            color: white;
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 22px 10px 50px;
          }

          .hero {
            align-items: flex-start;
            flex-direction: column;
          }

          .resultCount {
            width: 100%;
          }

          .toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .toolbar label {
            justify-content: space-between;
          }

          .toolbar select {
            flex: 1;
          }

          .productGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .imageWrap {
            height: 240px;
          }

          .productBody {
            padding: 13px;
          }

          .productName {
            font-size: 16px;
          }

          .priceRow strong {
            font-size: 20px;
          }

          .description {
            display: none;
          }

          .cardActions {
            grid-template-columns: 1fr;
          }

          .toast {
            top: 80px;
            right: 10px;
            left: 10px;
            max-width: none;
          }
        }

        @media (max-width: 430px) {
          .productGrid {
            grid-template-columns: 1fr;
          }

          .imageWrap {
            height: 360px;
          }
        }
      `}</style>
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  defaultLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  defaultLabel: string;
}) {
  return (
    <div className="filterBlock">
      <label>{label}</label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="all">{defaultLabel}</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <style jsx>{`
        .filterBlock {
          padding: 15px 0;
          border-top: 1px solid #eaecf0;
        }

        label {
          display: block;
          margin-bottom: 8px;
          color: #475467;
          font-size: 12px;
          font-weight: 800;
        }

        select {
          width: 100%;
          height: 42px;
          padding: 0 10px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: white;
          color: #344054;
          outline: none;
        }

        @media (max-width: 1050px) {
          .filterBlock {
            padding: 0;
            border-top: 0;
          }
        }
      `}</style>
    </div>
  );
}
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "70vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#F8F4EC",
            color: "#0A2E73",
            fontFamily: "Inter, Poppins, Arial, sans-serif",
          }}
        >
          <h2>Loading Search...</h2>
        </main>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}