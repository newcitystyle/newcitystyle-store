"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Product = {
  id: string | number;
  name?: string | null;
  product_name?: string | null;
  title?: string | null;
  slug?: string | null;
  sku?: string | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  price?: number | string | null;
  mrp?: number | string | null;
  sale_price?: number | string | null;
  offer_price?: number | string | null;
  sell_online?: boolean | null;
  stock?: number | string | null;
  quantity?: number | string | null;
  image_url?: string | null;
  image?: string | null;
  images?: string[] | string | null;
  status?: string | null;
  is_active?: boolean | null;
  is_featured?: boolean | null;
  featured?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type SortOption =
  | "newest"
  | "oldest"
  | "name-asc"
  | "name-desc"
  | "price-low"
  | "price-high"
  | "stock-low"
  | "stock-high";

function isQuickBillingProduct(product: Product) {
  const sku = String(product.sku || "")
    .trim()
    .toUpperCase();

  return sku.startsWith("QUICK-");
}

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

  if (typeof product.images === "string") {
    try {
      const parsed = JSON.parse(product.images);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }

      if (typeof parsed === "string") {
        return parsed;
      }
    } catch {
      return product.images;
    }
  }

  return "";
}

function toPositiveNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : 0;
}

function getProductOnlinePrice(product: Product) {
  if (product.sell_online !== true) return 0;

  return (
    toPositiveNumber(product.offer_price) ||
    toPositiveNumber(product.sale_price) ||
    toPositiveNumber(product.price)
  );
}

function getProductMrp(product: Product) {
  return (
    toPositiveNumber(product.mrp) ||
    getProductOnlinePrice(product)
  );
}

function getProductSortPrice(product: Product) {
  return getProductOnlinePrice(product) || getProductMrp(product);
}

function normalizeBrandDisplay(value: unknown) {
  const clean = String(value || "")
    .trim()
    .replace(/\s+/g, " ");

  return clean ? clean.toUpperCase() : "";
}

function getProductStock(product: Product) {
  const value = product.stock ?? product.quantity ?? 0;
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getProductStatus(product: Product) {
  if (typeof product.is_active === "boolean") {
    return product.is_active ? "active" : "inactive";
  }

  const status = String(product.status || "active").toLowerCase();

  if (
    status === "inactive" ||
    status === "draft" ||
    status === "disabled" ||
    status === "hidden"
  ) {
    return status;
  }

  return "active";
}

function isFeaturedProduct(product: Product) {
  return Boolean(product.is_featured ?? product.featured ?? false);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function AdminProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [featuredUpdatingId, setFeaturedUpdatingId] = useState<
    string | number | null
  >(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadProducts = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const catalogueProducts = ((data as Product[]) || []).filter(
        (product) => !isQuickBillingProduct(product),
      );

      setProducts(catalogueProducts);
    } catch (error) {
      console.error("Error loading products:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load products. Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!message && !errorMessage) return;

    const timer = window.setTimeout(() => {
      setMessage("");
      setErrorMessage("");
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [message, errorMessage]);

  const categories = useMemo(() => {
    const values = products
      .map((product) => product.category || product.subcategory || "")
      .filter(Boolean)
      .map((value) => String(value).trim());

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const result = products.filter((product) => {
      const productName = getProductName(product).toLowerCase();
      const slug = String(product.slug || "").toLowerCase();
      const category = String(product.category || "").toLowerCase();
      const subcategory = String(product.subcategory || "").toLowerCase();
      const brand = String(product.brand || "").toLowerCase();
      const status = getProductStatus(product);
      const stock = getProductStock(product);

      const matchesSearch =
        !query ||
        productName.includes(query) ||
        slug.includes(query) ||
        category.includes(query) ||
        subcategory.includes(query) ||
        brand.includes(query) ||
        String(product.id).toLowerCase().includes(query);

      const selectedCategory = categoryFilter.toLowerCase();

      const matchesCategory =
        categoryFilter === "all" ||
        category === selectedCategory ||
        subcategory === selectedCategory;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "featured"
          ? isFeaturedProduct(product)
          : status === statusFilter);

      let matchesStock = true;

      if (stockFilter === "in-stock") {
        matchesStock = stock > 5;
      } else if (stockFilter === "low-stock") {
        matchesStock = stock > 0 && stock <= 5;
      } else if (stockFilter === "out-of-stock") {
        matchesStock = stock <= 0;
      }

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesStock
      );
    });

    return [...result].sort((a, b) => {
      const nameA = getProductName(a).toLowerCase();
      const nameB = getProductName(b).toLowerCase();
      const priceA = getProductSortPrice(a);
      const priceB = getProductSortPrice(b);
      const stockA = getProductStock(a);
      const stockB = getProductStock(b);
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();

      switch (sortOption) {
        case "oldest":
          return dateA - dateB;

        case "name-asc":
          return nameA.localeCompare(nameB);

        case "name-desc":
          return nameB.localeCompare(nameA);

        case "price-low":
          return priceA - priceB;

        case "price-high":
          return priceB - priceA;

        case "stock-low":
          return stockA - stockB;

        case "stock-high":
          return stockB - stockA;

        case "newest":
        default:
          return dateB - dateA;
      }
    });
  }, [
    products,
    searchQuery,
    categoryFilter,
    statusFilter,
    stockFilter,
    sortOption,
  ]);

  const statistics = useMemo(() => {
    const total = products.length;

    const active = products.filter(
      (product) => getProductStatus(product) === "active",
    ).length;

    const featured = products.filter(isFeaturedProduct).length;

    const lowStock = products.filter((product) => {
      const stock = getProductStock(product);
      return stock > 0 && stock <= 5;
    }).length;

    const outOfStock = products.filter(
      (product) => getProductStock(product) <= 0,
    ).length;

    return {
      total,
      active,
      featured,
      lowStock,
      outOfStock,
    };
  }, [products]);

  const allVisibleSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) => selectedIds.includes(product.id));

  function toggleSelectProduct(id: string | number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      const visibleIds = new Set(
        filteredProducts.map((product) => product.id),
      );

      setSelectedIds((current) =>
        current.filter((id) => !visibleIds.has(id)),
      );

      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);

      filteredProducts.forEach((product) => {
        next.add(product.id);
      });

      return Array.from(next);
    });
  }

  function clearFilters() {
    setSearchQuery("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setStockFilter("all");
    setSortOption("newest");
  }

  async function deleteProduct(product: Product) {
    const productName = getProductName(product);

    const confirmed = window.confirm(
      `Are you sure you want to delete "${productName}"?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingId(product.id);
    setMessage("");
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (error) {
        throw error;
      }

      setProducts((current) =>
        current.filter((item) => item.id !== product.id),
      );

      setSelectedIds((current) =>
        current.filter((id) => id !== product.id),
      );

      setMessage(`${productName} deleted successfully.`);
    } catch (error) {
      console.error("Error deleting product:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete the product.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteSelectedProducts() {
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.length} selected product${
        selectedIds.length === 1 ? "" : "s"
      }?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) return;

    setMessage("");
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .in("id", selectedIds);

      if (error) {
        throw error;
      }

      const deletedIds = new Set(selectedIds);

      setProducts((current) =>
        current.filter((product) => !deletedIds.has(product.id)),
      );

      const deletedCount = selectedIds.length;
      setSelectedIds([]);

      setMessage(
        `${deletedCount} product${
          deletedCount === 1 ? "" : "s"
        } deleted successfully.`,
      );
    } catch (error) {
      console.error("Error deleting selected products:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete the selected products.",
      );
    }
  }

  async function toggleFeatured(product: Product) {
    const nextValue = !isFeaturedProduct(product);

    setFeaturedUpdatingId(product.id);
    setMessage("");
    setErrorMessage("");

    try {
      let updateResult = await supabase
        .from("products")
        .update({ is_featured: nextValue })
        .eq("id", product.id);

      if (
        updateResult.error &&
        updateResult.error.message
          .toLowerCase()
          .includes("is_featured")
      ) {
        updateResult = await supabase
          .from("products")
          .update({ featured: nextValue })
          .eq("id", product.id);
      }

      if (updateResult.error) {
        throw updateResult.error;
      }

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                is_featured: nextValue,
                featured: nextValue,
              }
            : item,
        ),
      );

      setMessage(
        `${getProductName(product)} ${
          nextValue ? "added to" : "removed from"
        } Featured Products.`,
      );
    } catch (error) {
      console.error("Error updating featured status:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update featured status.",
      );
    } finally {
      setFeaturedUpdatingId(null);
    }
  }

  function viewProduct(product: Product) {
    if (product.slug) {
      router.push(`/product/${product.slug}`);
      return;
    }

    router.push(`/product/${product.id}`);
  }

  function editProduct(product: Product) {
    router.push(`/admin/products/edit/${product.id}`);
  }

  return (
    <main className="admin-products-page">
      <div className="page-container">
        <section className="page-header premium-products-hero">
          <div>
            <div className="eyebrow">NEW CITY STYLE ADMIN</div>

            <h1>Product Management</h1>

            <p>
              Add, edit, organise and manage your complete product catalogue.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-button premium-secondary-button"
              onClick={() => loadProducts(true)}
              disabled={refreshing}
            >
              <span className={refreshing ? "spin" : ""}>↻</span>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

<Link
  href="/admin/add-product"
  className="primary-button premium-primary-button"
>
  <span>＋</span>
  Add New Product
</Link>
          </div>
        </section>

        {message && (
          <div className="alert success-alert">
            <span className="alert-icon">✓</span>
            <span>{message}</span>

            <button
              type="button"
              aria-label="Close success message"
              onClick={() => setMessage("")}
            >
              ×
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="alert error-alert">
            <span className="alert-icon">!</span>
            <span>{errorMessage}</span>

            <button
              type="button"
              aria-label="Close error message"
              onClick={() => setErrorMessage("")}
            >
              ×
            </button>
          </div>
        )}

        <section className="statistics-grid premium-products-statistics">
          <article className="stat-card premium-stat-card">
            <div className="stat-icon blue">▦</div>

            <div>
              <span>Total Products</span>
              <strong>{statistics.total}</strong>
            </div>
          </article>

          <article className="stat-card premium-stat-card">
            <div className="stat-icon green">✓</div>

            <div>
              <span>Active Products</span>
              <strong>{statistics.active}</strong>
            </div>
          </article>

          <article className="stat-card premium-stat-card">
            <div className="stat-icon gold">★</div>

            <div>
              <span>Featured Products</span>
              <strong>{statistics.featured}</strong>
            </div>
          </article>

          <article className="stat-card premium-stat-card">
            <div className="stat-icon orange">!</div>

            <div>
              <span>Low Stock</span>
              <strong>{statistics.lowStock}</strong>
            </div>
          </article>

          <article className="stat-card premium-stat-card">
            <div className="stat-icon red">×</div>

            <div>
              <span>Out of Stock</span>
              <strong>{statistics.outOfStock}</strong>
            </div>
          </article>
        </section>

        <section className="products-panel premium-products-panel">
          <div className="filters-section">
            <div className="search-wrapper">
              <span className="search-icon">⌕</span>

              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by product name, ID, category or brand..."
                aria-label="Search products"
              />

              {searchQuery && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <div className="filter-grid">
              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
                aria-label="Filter by category"
              >
                <option value="all">All Categories</option>

                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
                <option value="featured">Featured</option>
              </select>

              <select
                value={stockFilter}
                onChange={(event) =>
                  setStockFilter(event.target.value)
                }
                aria-label="Filter by stock"
              >
                <option value="all">All Stock</option>
                <option value="in-stock">In Stock</option>
                <option value="low-stock">Low Stock</option>
                <option value="out-of-stock">Out of Stock</option>
              </select>

              <select
                value={sortOption}
                onChange={(event) =>
                  setSortOption(event.target.value as SortOption)
                }
                aria-label="Sort products"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name-asc">Name: A to Z</option>
                <option value="name-desc">Name: Z to A</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="stock-low">Stock: Low to High</option>
                <option value="stock-high">Stock: High to Low</option>
              </select>
            </div>

            <div className="filter-footer">
              <p>
                Showing <strong>{filteredProducts.length}</strong> of{" "}
                <strong>{products.length}</strong> products
              </p>

              <button
                type="button"
                className="text-button"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="bulk-action-bar">
              <div>
                <strong>{selectedIds.length}</strong> product
                {selectedIds.length === 1 ? "" : "s"} selected
              </div>

              <div className="bulk-actions">
                <button
                  type="button"
                  className="clear-selection-button"
                  onClick={() => setSelectedIds([])}
                >
                  Clear Selection
                </button>

                <button
                  type="button"
                  className="delete-selected-button"
                  onClick={deleteSelectedProducts}
                >
                  Delete Selected
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <div className="loader" />
              <h2>Loading products...</h2>
              <p>Please wait while we load your product catalogue.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">▣</div>

              <h2>
                {products.length === 0
                  ? "No products added yet"
                  : "No matching products found"}
              </h2>

              <p>
                {products.length === 0
                  ? "Start building your NEW CITY STYLE catalogue by adding your first product."
                  : "Try changing your search text or product filters."}
              </p>

              {products.length === 0 ? (
                <Link
                  href="/admin/add-product"
                  className="primary-button premium-primary-button"
                >
                  <span>＋</span>
                  Add New Product
                </Link>
              ) : (
                <button
                  type="button"
                  className="secondary-button premium-secondary-button"
                  onClick={clearFilters}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="desktop-table-wrapper">
                <table className="products-table">
                  <thead>
                    <tr>
                      <th className="checkbox-column">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                          aria-label="Select all visible products"
                        />
                      </th>

                      <th>Product</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Status</th>
                      <th>Featured</th>
                      <th>Created</th>
                      <th className="actions-heading">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredProducts.map((product) => {
                      const productName = getProductName(product);
                      const imageUrl = getProductImage(product);
                      const sellingPrice = getProductOnlinePrice(product);
                      const mrp = getProductMrp(product);
                      const stock = getProductStock(product);
                      const status = getProductStatus(product);
                      const featured = isFeaturedProduct(product);
                      const selected = selectedIds.includes(product.id);

                      return (
                        <tr
                          key={String(product.id)}
                          className={selected ? "selected-row" : ""}
                        >
                          <td className="checkbox-column">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() =>
                                toggleSelectProduct(product.id)
                              }
                              aria-label={`Select ${productName}`}
                            />
                          </td>

                          <td>
                            <div className="product-cell">
                              <div className="product-image-wrapper">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={productName}
                                    loading="lazy"
                                    onError={(event) => {
                                      event.currentTarget.style.display =
                                        "none";

                                      const fallback =
                                        event.currentTarget
                                          .nextElementSibling as HTMLElement | null;

                                      if (fallback) {
                                        fallback.style.display = "flex";
                                      }
                                    }}
                                  />
                                ) : null}

                                <div
                                  className="image-fallback"
                                  style={{
                                    display: imageUrl ? "none" : "flex",
                                  }}
                                >
                                  NCS
                                </div>
                              </div>

                              <div className="product-information">
                                <button
                                  type="button"
                                  className="product-name-button"
                                  onClick={() => viewProduct(product)}
                                >
                                  {productName}
                                </button>

                                <span>
                                  ID: {String(product.id).slice(0, 18)}
                                </span>

                                {product.brand && (
                                  <span>{normalizeBrandDisplay(product.brand)}</span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="category-cell">
                              <strong>
                                {product.category || "Uncategorised"}
                              </strong>

                              {product.subcategory && (
                                <span>{product.subcategory}</span>
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="price-cell">
                              {sellingPrice > 0 ? (
                                <>
                                  <strong>{formatCurrency(sellingPrice)}</strong>
                                  {mrp > sellingPrice && (
                                    <span>{formatCurrency(mrp)}</span>
                                  )}
                                  <small>Online price</small>
                                </>
                              ) : mrp > 0 ? (
                                <>
                                  <strong>{formatCurrency(mrp)}</strong>
                                  <small>MRP • Flexible billing price</small>
                                </>
                              ) : (
                                <>
                                  <strong>Price not set</strong>
                                  <small>Add MRP in product edit</small>
                                </>
                              )}
                            </div>
                          </td>

                          <td>
                            <span
                              className={`stock-badge ${
                                stock <= 0
                                  ? "out-stock"
                                  : stock <= 5
                                    ? "low-stock"
                                    : "in-stock"
                              }`}
                            >
                              {stock <= 0
                                ? "Out of stock"
                                : stock <= 5
                                  ? `${stock} left`
                                  : `${stock} in stock`}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`status-badge status-${status}`}
                            >
                              <span className="status-dot" />
                              {status.charAt(0).toUpperCase() +
                                status.slice(1)}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className={`featured-button ${
                                featured ? "featured-active" : ""
                              }`}
                              onClick={() => toggleFeatured(product)}
                              disabled={
                                featuredUpdatingId === product.id
                              }
                              title={
                                featured
                                  ? "Remove from featured products"
                                  : "Add to featured products"
                              }
                              aria-label={
                                featured
                                  ? `Remove ${productName} from featured products`
                                  : `Add ${productName} to featured products`
                              }
                            >
                              {featuredUpdatingId === product.id
                                ? "…"
                                : featured
                                  ? "★"
                                  : "☆"}
                            </button>
                          </td>

                          <td>
                            <span className="date-text">
                              {formatDate(product.created_at)}
                            </span>
                          </td>

                          <td>
                            <div className="action-buttons">
                              <button
                                type="button"
                                className="icon-button view-button"
                                onClick={() => viewProduct(product)}
                                title="View product"
                                aria-label={`View ${productName}`}
                              >
                                ◉
                              </button>

                              <button
                                type="button"
                                className="icon-button edit-button"
                                onClick={() => editProduct(product)}
                                title="Edit product"
                                aria-label={`Edit ${productName}`}
                              >
                                ✎
                              </button>

                              <button
                                type="button"
                                className="icon-button delete-button"
                                onClick={() => deleteProduct(product)}
                                disabled={deletingId === product.id}
                                title="Delete product"
                                aria-label={`Delete ${productName}`}
                              >
                                {deletingId === product.id ? "…" : "⌫"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mobile-products-list">
                <label className="mobile-select-all">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                  />
                  Select all visible products
                </label>

                {filteredProducts.map((product) => {
                  const productName = getProductName(product);
                  const imageUrl = getProductImage(product);
                  const sellingPrice = getProductOnlinePrice(product);
                  const mrp = getProductMrp(product);
                  const stock = getProductStock(product);
                  const status = getProductStatus(product);
                  const featured = isFeaturedProduct(product);
                  const selected = selectedIds.includes(product.id);

                  return (
                    <article
                      key={String(product.id)}
                      className={`mobile-product-card ${
                        selected ? "mobile-card-selected" : ""
                      }`}
                    >
                      <div className="mobile-card-top">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            toggleSelectProduct(product.id)
                          }
                          aria-label={`Select ${productName}`}
                        />

                        <button
                          type="button"
                          className={`featured-button ${
                            featured ? "featured-active" : ""
                          }`}
                          onClick={() => toggleFeatured(product)}
                          disabled={featuredUpdatingId === product.id}
                          aria-label={
                            featured
                              ? `Remove ${productName} from featured products`
                              : `Add ${productName} to featured products`
                          }
                        >
                          {featuredUpdatingId === product.id
                            ? "…"
                            : featured
                              ? "★"
                              : "☆"}
                        </button>
                      </div>

                      <div className="mobile-product-main">
                        <div className="mobile-product-image">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={productName}
                              loading="lazy"
                            />
                          ) : (
                            <div className="image-fallback">NCS</div>
                          )}
                        </div>

                        <div className="mobile-product-details">
                          <button
                            type="button"
                            className="product-name-button"
                            onClick={() => viewProduct(product)}
                          >
                            {productName}
                          </button>

                          <span className="mobile-product-id">
                            ID: {String(product.id).slice(0, 18)}
                          </span>

                          <div className="mobile-price">
                            {sellingPrice > 0 ? (
                              <>
                                <strong>{formatCurrency(sellingPrice)}</strong>
                                {mrp > sellingPrice && (
                                  <span>{formatCurrency(mrp)}</span>
                                )}
                                <small>Online price</small>
                              </>
                            ) : mrp > 0 ? (
                              <>
                                <strong>{formatCurrency(mrp)}</strong>
                                <small>MRP • Flexible billing</small>
                              </>
                            ) : (
                              <>
                                <strong>Price not set</strong>
                                <small>Add MRP</small>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mobile-product-meta">
                        <div>
                          <span>Category</span>
                          <strong>
                            {product.category ||
                              product.subcategory ||
                              "Uncategorised"}
                          </strong>
                        </div>

                        <div>
                          <span>Stock</span>
                          <strong
                            className={
                              stock <= 0
                                ? "stock-red"
                                : stock <= 5
                                  ? "stock-orange"
                                  : "stock-green"
                            }
                          >
                            {stock}
                          </strong>
                        </div>

                        <div>
                          <span>Status</span>
                          <strong>
                            {status.charAt(0).toUpperCase() +
                              status.slice(1)}
                          </strong>
                        </div>

                        <div>
                          <span>Created</span>
                          <strong>
                            {formatDate(product.created_at)}
                          </strong>
                        </div>
                      </div>

                      <div className="mobile-card-actions">
                        <button
                          type="button"
                          className="mobile-view-button"
                          onClick={() => viewProduct(product)}
                        >
                          View
                        </button>

                        <button
                          type="button"
                          className="mobile-edit-button"
                          onClick={() => editProduct(product)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="mobile-delete-button"
                          onClick={() => deleteProduct(product)}
                          disabled={deletingId === product.id}
                        >
                          {deletingId === product.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
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
          font-family:
            Inter, Poppins, Arial, Helvetica, sans-serif;
        }

        button,
        input,
        select {
          font: inherit;
        }

        button {
          -webkit-tap-highlight-color: transparent;
        }

        .admin-products-page {
          position: relative;
          isolation: isolate;
          min-height: 100vh;
          overflow-x: hidden;
          padding: 32px 24px 60px;
          background:
            radial-gradient(
              circle at 8% 0%,
              rgba(212, 175, 55, 0.15),
              transparent 27%
            ),
            radial-gradient(
              circle at 95% 8%,
              rgba(10, 46, 115, 0.1),
              transparent 25%
            ),
            linear-gradient(180deg, #f8f4ec, #ffffff);
        }

        .admin-products-page::before,
        .admin-products-page::after {
          content: "";
          position: fixed;
          z-index: -1;
          border-radius: 50%;
          pointer-events: none;
        }

        .admin-products-page::before {
          width: 420px;
          height: 420px;
          top: -150px;
          right: -120px;
          background: radial-gradient(
            circle,
            rgba(212, 175, 55, 0.18),
            transparent 68%
          );
          animation: products-float 11s ease-in-out infinite;
        }

        .admin-products-page::after {
          width: 360px;
          height: 360px;
          left: -130px;
          bottom: -120px;
          background: radial-gradient(
            circle,
            rgba(10, 46, 115, 0.14),
            transparent 68%
          );
          animation: products-float 13s ease-in-out infinite reverse;
        }

        .page-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          position: relative;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          overflow: hidden;
          margin-bottom: 24px;
          padding: 28px;
          border: 1px solid rgba(212, 175, 55, 0.42);
          border-radius: 24px;
          background:
            radial-gradient(
              circle at 90% 5%,
              rgba(212, 175, 55, 0.28),
              transparent 30%
            ),
            linear-gradient(135deg, #03153f 0%, #0a2e73 60%, #164ca8);
          color: #ffffff;
          box-shadow: 0 20px 48px rgba(3, 21, 63, 0.23);
          animation: products-rise 0.7s ease both;
        }

        .page-header::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            120deg,
            transparent 0%,
            rgba(255, 255, 255, 0.08) 45%,
            transparent 63%
          );
          transform: translateX(-120%);
          animation: products-hero-shine 6s ease-in-out infinite;
          pointer-events: none;
        }

        .page-header::after {
          content: "PRODUCTS";
          position: absolute;
          right: 30px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(212, 175, 55, 0.08);
          font-size: clamp(55px, 8vw, 120px);
          font-weight: 950;
          letter-spacing: 6px;
          pointer-events: none;
        }

        .page-header > div,
        .header-actions {
          position: relative;
          z-index: 2;
        }

        .eyebrow {
          margin-bottom: 8px;
          color: #d4af37;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .page-header h1 {
          margin: 0;
          color: #ffffff;
          font-size: clamp(31px, 4vw, 45px);
          line-height: 1.05;
          letter-spacing: -1px;
        }

        .page-header p {
          margin: 10px 0 0;
          color: rgba(255, 255, 255, 0.74);
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
          pointer-events: auto;
        }

        .primary-button,
        .secondary-button {
          position: relative;
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          overflow: hidden;
          padding: 0 18px;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
          text-decoration: none;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            background 0.2s ease,
            border-color 0.2s ease;
        }

        .primary-button {
          border: 1px solid #d4af37;
          background: linear-gradient(135deg, #d4af37, #b99525);
          color: #03153f;
          box-shadow: 0 10px 24px rgba(212, 175, 55, 0.25);
        }

        .primary-button::after {
          content: "";
          position: absolute;
          top: -130%;
          left: -35%;
          width: 28%;
          height: 360%;
          transform: rotate(22deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.5),
            transparent
          );
          animation: products-button-shine 4.2s ease-in-out infinite;
        }

        .primary-button:hover,
        .secondary-button:hover {
          transform: translateY(-2px);
        }

        .primary-button:hover {
          box-shadow: 0 15px 30px rgba(212, 175, 55, 0.34);
        }

        .secondary-button {
          border: 1px solid rgba(255, 255, 255, 0.28);
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          backdrop-filter: blur(8px);
        }

        .secondary-button:hover {
          border-color: #d4af37;
          color: #d4af37;
        }

        .primary-button:disabled,
        .secondary-button:disabled {
          cursor: not-allowed;
          opacity: 0.65;
          transform: none;
        }

        .spin {
          display: inline-block;
          animation: rotate 0.9s linear infinite;
        }

        .alert {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding: 14px 52px 14px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 650;
          animation: products-rise 0.35s ease both;
        }

        .alert-icon {
          width: 26px;
          height: 26px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 50%;
          font-weight: 900;
        }

        .success-alert {
          border: 1px solid #a6f4c5;
          background: #ecfdf3;
          color: #067647;
        }

        .success-alert .alert-icon {
          background: #d1fadf;
        }

        .error-alert {
          border: 1px solid #fecdca;
          background: #fef3f2;
          color: #b42318;
        }

        .error-alert .alert-icon {
          background: #fee4e2;
        }

        .alert button {
          position: absolute;
          top: 50%;
          right: 15px;
          width: 30px;
          height: 30px;
          border: 0;
          background: transparent;
          color: inherit;
          font-size: 23px;
          cursor: pointer;
          transform: translateY(-50%);
        }

        .statistics-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .stat-card {
          position: relative;
          min-height: 118px;
          display: flex;
          align-items: center;
          gap: 14px;
          overflow: hidden;
          padding: 18px;
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 17px;
          background:
            radial-gradient(
              circle at 88% 10%,
              rgba(212, 175, 55, 0.22),
              transparent 34%
            ),
            linear-gradient(135deg, #0a2e73, #03153f);
          box-shadow:
            0 14px 32px rgba(3, 21, 63, 0.17),
            inset 0 1px 0 rgba(255, 255, 255, 0.07);
          animation: products-card-enter 0.55s ease both;
          transition:
            transform 0.22s ease,
            box-shadow 0.22s ease,
            border-color 0.22s ease;
        }

        .stat-card:nth-child(2) {
          animation-delay: 0.07s;
        }

        .stat-card:nth-child(3) {
          animation-delay: 0.14s;
        }

        .stat-card:nth-child(4) {
          animation-delay: 0.21s;
        }

        .stat-card:nth-child(5) {
          animation-delay: 0.28s;
        }

        .stat-card::after {
          content: "";
          position: absolute;
          top: -175%;
          left: -38%;
          width: 42%;
          height: 450%;
          transform: rotate(23deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.13),
            transparent
          );
          animation: products-card-shine 5.4s ease-in-out infinite;
          pointer-events: none;
        }

        .stat-card:hover {
          transform: translateY(-5px) scale(1.01);
          border-color: rgba(212, 175, 55, 0.62);
          box-shadow:
            0 22px 42px rgba(3, 21, 63, 0.25),
            0 0 0 1px rgba(212, 175, 55, 0.1);
        }

        .stat-icon {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid rgba(212, 175, 55, 0.36);
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.09) !important;
          color: #d4af37 !important;
          font-size: 20px;
          font-weight: 900;
        }

        .stat-card span {
          display: block;
          margin-bottom: 5px;
          color: rgba(212, 175, 55, 0.95);
          font-size: 11px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: 0.35px;
        }

        .stat-card strong {
          display: block;
          color: #ffffff;
          font-size: 28px;
          line-height: 1;
        }

        .products-panel {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.24);
          border-radius: 19px;
          background: white;
          box-shadow: 0 14px 36px rgba(3, 21, 63, 0.09);
          animation: products-rise 0.65s ease both;
        }

        .products-panel::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 3px;
          background: linear-gradient(
            90deg,
            #0a2e73,
            #d4af37,
            #0a2e73
          );
          background-size: 200% 100%;
          animation: products-gold-flow 4s linear infinite;
          z-index: 2;
        }

        .filters-section {
          position: relative;
          padding: 20px;
          border-bottom: 1px solid #eaecf0;
          background:
            radial-gradient(
              circle at 96% 0%,
              rgba(212, 175, 55, 0.08),
              transparent 30%
            ),
            linear-gradient(180deg, #ffffff, #fbfcff);
        }

        .search-wrapper {
          position: relative;
          margin-bottom: 14px;
        }

        .search-wrapper input {
          width: 100%;
          height: 50px;
          padding: 0 48px 0 45px;
          border: 1px solid #d0d5dd;
          border-radius: 12px;
          outline: none;
          background: white;
          color: #101828;
          font-size: 14px;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            transform 0.2s ease;
        }

        .search-wrapper input:focus,
        .filter-grid select:focus {
          border-color: #d4af37;
          box-shadow:
            0 0 0 4px rgba(212, 175, 55, 0.13),
            0 8px 20px rgba(10, 46, 115, 0.08);
          transform: translateY(-1px);
        }

        .search-icon {
          position: absolute;
          top: 50%;
          left: 16px;
          color: #0a2e73;
          font-size: 24px;
          transform: translateY(-53%);
          pointer-events: none;
        }

        .clear-search {
          position: absolute;
          top: 50%;
          right: 12px;
          width: 31px;
          height: 31px;
          border: 0;
          border-radius: 50%;
          background: #f2f4f7;
          color: #475467;
          font-size: 20px;
          cursor: pointer;
          transform: translateY(-50%);
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .filter-grid select {
          width: 100%;
          height: 44px;
          padding: 0 38px 0 13px;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          outline: none;
          background: white;
          color: #344054;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            transform 0.2s ease;
        }

        .filter-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 15px;
        }

        .filter-footer p {
          margin: 0;
          color: #667085;
          font-size: 13px;
        }

        .filter-footer strong {
          color: #0a2e73;
        }

        .text-button {
          border: 0;
          background: transparent;
          color: #0a2e73;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
        }

        .text-button:hover {
          color: #b68c13;
          text-decoration: underline;
        }

        .bulk-action-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 13px 20px;
          border-bottom: 1px solid rgba(212, 175, 55, 0.35);
          background: linear-gradient(90deg, #eef3ff, #fff8df);
          color: #0a2e73;
          font-size: 14px;
        }

        .bulk-actions {
          display: flex;
          gap: 10px;
        }

        .clear-selection-button,
        .delete-selected-button {
          min-height: 36px;
          padding: 0 13px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .clear-selection-button:hover,
        .delete-selected-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 16px rgba(3, 21, 63, 0.12);
        }

        .clear-selection-button {
          border: 1px solid #b9c8eb;
          background: white;
          color: #0a2e73;
        }

        .delete-selected-button {
          border: 1px solid #d92d20;
          background: #d92d20;
          color: white;
        }

        .desktop-table-wrapper {
          overflow-x: auto;
        }

        .products-table {
          width: 100%;
          min-width: 1200px;
          border-collapse: collapse;
        }

        .products-table th {
          padding: 13px 14px;
          border-bottom: 1px solid #eaecf0;
          background: linear-gradient(180deg, #f8fafc, #f2f5fa);
          color: #0a2e73;
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0.5px;
          text-align: left;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .products-table td {
          padding: 15px 14px;
          border-bottom: 1px solid #f0f1f3;
          color: #344054;
          font-size: 13px;
          vertical-align: middle;
        }

        .products-table tbody tr {
          transition:
            background 0.2s ease,
            transform 0.2s ease;
        }

        .products-table tbody tr:hover {
          background: #fffdf7;
        }

        .products-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .products-table .selected-row {
          background: #f3f6ff;
        }

        .checkbox-column {
          width: 46px;
          text-align: center !important;
        }

        .checkbox-column input,
        .mobile-card-top input,
        .mobile-select-all input {
          width: 17px;
          height: 17px;
          accent-color: #0a2e73;
          cursor: pointer;
        }

        .product-cell {
          min-width: 250px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .product-image-wrapper {
          position: relative;
          width: 64px;
          height: 72px;
          overflow: hidden;
          flex-shrink: 0;
          border: 1px solid rgba(212, 175, 55, 0.28);
          border-radius: 10px;
          background: #f8f9fc;
          box-shadow: 0 6px 14px rgba(3, 21, 63, 0.08);
        }

        .product-image-wrapper img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform 0.35s ease;
        }

        .products-table tbody tr:hover .product-image-wrapper img {
          transform: scale(1.06);
        }

        .image-fallback {
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a2e73, #03153f);
          color: #d4af37;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .product-information {
          min-width: 0;
        }

        .product-name-button {
          max-width: 240px;
          display: block;
          overflow: hidden;
          padding: 0;
          border: 0;
          background: transparent;
          color: #101828;
          font-size: 14px;
          font-weight: 800;
          text-align: left;
          text-overflow: ellipsis;
          white-space: nowrap;
          cursor: pointer;
        }

        .product-name-button:hover {
          color: #0a2e73;
          text-decoration: underline;
        }

        .product-information span {
          display: block;
          max-width: 210px;
          overflow: hidden;
          margin-top: 5px;
          color: #98a2b3;
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .category-cell strong {
          display: block;
          color: #344054;
          font-size: 13px;
        }

        .category-cell span {
          display: block;
          margin-top: 4px;
          color: #98a2b3;
          font-size: 11px;
        }

        .price-cell strong {
          display: block;
          color: #0a2e73;
          font-size: 14px;
        }

        .price-cell small,
        .mobile-price small {
          display: block;
          margin-top: 4px;
          color: #667085;
          font-size: 10px;
          font-weight: 750;
          white-space: nowrap;
        }

        .price-cell span {
          display: block;
          margin-top: 3px;
          color: #98a2b3;
          font-size: 11px;
          text-decoration: line-through;
        }

        .stock-badge,
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 750;
          white-space: nowrap;
        }

        .in-stock {
          background: #ecfdf3;
          color: #067647;
        }

        .low-stock {
          background: #fff4e8;
          color: #b54708;
        }

        .out-stock {
          background: #fef3f2;
          color: #b42318;
        }

        .status-badge {
          background: #f2f4f7;
          color: #475467;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
        }

        .status-active {
          background: #ecfdf3;
          color: #067647;
        }

        .status-inactive,
        .status-disabled,
        .status-hidden {
          background: #f2f4f7;
          color: #667085;
        }

        .status-draft {
          background: #fff8e8;
          color: #a15c00;
        }

        .featured-button {
          width: 38px;
          height: 38px;
          border: 1px solid rgba(212, 175, 55, 0.38);
          border-radius: 10px;
          background: white;
          color: #98a2b3;
          font-size: 21px;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            background 0.2s ease,
            box-shadow 0.2s ease;
        }

        .featured-button:hover {
          border-color: #d4af37;
          transform: scale(1.08);
          box-shadow: 0 8px 16px rgba(212, 175, 55, 0.18);
        }

        .featured-button:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        .featured-active {
          border-color: #f1d26a;
          background: #fff9e8;
          color: #d4af37;
        }

        .date-text {
          color: #667085;
          font-size: 12px;
          white-space: nowrap;
        }

        .actions-heading {
          text-align: center !important;
        }

        .action-buttons {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }

        .icon-button {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: white;
          font-size: 16px;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            background 0.2s ease,
            box-shadow 0.2s ease;
        }

        .icon-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(3, 21, 63, 0.12);
        }

        .view-button {
          border: 1px solid #b9c8eb;
          color: #0a2e73;
        }

        .view-button:hover {
          background: #eef3ff;
        }

        .edit-button {
          border: 1px solid #f2d978;
          color: #9a7200;
        }

        .edit-button:hover {
          background: #fff9e8;
        }

        .delete-button {
          border: 1px solid #fecdca;
          color: #d92d20;
        }

        .delete-button:hover {
          background: #fef3f2;
        }

        .delete-button:disabled {
          cursor: wait;
          opacity: 0.55;
        }

        .loading-state,
        .empty-state {
          min-height: 390px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 50px 20px;
          text-align: center;
        }

        .loader {
          width: 47px;
          height: 47px;
          margin-bottom: 20px;
          border: 4px solid #e7ebf3;
          border-top-color: #d4af37;
          border-radius: 50%;
          animation: rotate 0.8s linear infinite;
        }

        .loading-state h2,
        .empty-state h2 {
          margin: 0 0 8px;
          color: #0a2e73;
          font-size: 21px;
        }

        .loading-state p,
        .empty-state p {
          max-width: 480px;
          margin: 0 0 23px;
          color: #667085;
          font-size: 14px;
          line-height: 1.6;
        }

        .empty-icon {
          width: 70px;
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 19px;
          border: 1px solid rgba(212, 175, 55, 0.28);
          border-radius: 20px;
          background: linear-gradient(135deg, #0a2e73, #03153f);
          color: #d4af37;
          font-size: 31px;
          box-shadow: 0 12px 24px rgba(3, 21, 63, 0.16);
        }

        .mobile-products-list {
          display: none;
        }

        @keyframes rotate {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes products-rise {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes products-card-enter {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes products-card-shine {
          0%,
          62% {
            left: -40%;
            opacity: 0;
          }
          70% {
            opacity: 0.8;
          }
          100% {
            left: 128%;
            opacity: 0;
          }
        }

        @keyframes products-hero-shine {
          0%,
          64% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(120%);
          }
        }

        @keyframes products-button-shine {
          0%,
          68% {
            left: -35%;
            opacity: 0;
          }
          76% {
            opacity: 0.7;
          }
          100% {
            left: 120%;
            opacity: 0;
          }
        }

        @keyframes products-gold-flow {
          to {
            background-position: 200% 0;
          }
        }

        @keyframes products-float {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, 18px, 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .admin-products-page *,
          .admin-products-page::before,
          .admin-products-page::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
          }
        }

        @media (max-width: 1180px) {
          .statistics-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .admin-products-page {
            padding: 22px 15px 45px;
          }

          .page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button,
          .header-actions a {
            flex: 1;
          }

          .statistics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .desktop-table-wrapper {
            display: none;
          }

          .mobile-products-list {
            display: block;
            padding: 15px;
            background: #f8fafc;
          }

          .mobile-select-all {
            display: flex;
            align-items: center;
            gap: 9px;
            margin-bottom: 13px;
            padding: 12px 13px;
            border: 1px solid rgba(212, 175, 55, 0.24);
            border-radius: 11px;
            background: white;
            color: #475467;
            font-size: 13px;
            font-weight: 700;
          }

          .mobile-product-card {
            position: relative;
            margin-bottom: 14px;
            padding: 14px;
            overflow: hidden;
            border: 1px solid rgba(212, 175, 55, 0.24);
            border-radius: 15px;
            background: white;
            box-shadow: 0 8px 20px rgba(3, 21, 63, 0.08);
            animation: products-card-enter 0.5s ease both;
            transition:
              transform 0.22s ease,
              box-shadow 0.22s ease;
          }

          .mobile-product-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 14px 28px rgba(3, 21, 63, 0.14);
          }

          .mobile-product-card:last-child {
            margin-bottom: 0;
          }

          .mobile-card-selected {
            border-color: #d4af37;
            background: #fffdf7;
          }

          .mobile-card-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
          }

          .mobile-product-main {
            display: flex;
            align-items: center;
            gap: 13px;
          }

          .mobile-product-image {
            width: 82px;
            height: 92px;
            overflow: hidden;
            flex-shrink: 0;
            border: 1px solid rgba(212, 175, 55, 0.24);
            border-radius: 11px;
            background: #f8fafc;
          }

          .mobile-product-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .mobile-product-details {
            min-width: 0;
            flex: 1;
          }

          .mobile-product-details .product-name-button {
            max-width: 100%;
            font-size: 15px;
          }

          .mobile-product-id {
            display: block;
            overflow: hidden;
            margin-top: 7px;
            color: #98a2b3;
            font-size: 11px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mobile-price {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 10px;
          }

          .mobile-price strong {
            color: #0a2e73;
            font-size: 16px;
          }

          .mobile-price span {
            color: #98a2b3;
            font-size: 12px;
            text-decoration: line-through;
          }

          .mobile-product-meta {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-top: 14px;
            padding: 12px;
            border-radius: 11px;
            background: #f8fafc;
          }

          .mobile-product-meta div {
            min-width: 0;
          }

          .mobile-product-meta span {
            display: block;
            margin-bottom: 4px;
            color: #98a2b3;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .mobile-product-meta strong {
            display: block;
            overflow: hidden;
            color: #344054;
            font-size: 12px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mobile-product-meta .stock-green {
            color: #067647;
          }

          .mobile-product-meta .stock-orange {
            color: #b54708;
          }

          .mobile-product-meta .stock-red {
            color: #b42318;
          }

          .mobile-card-actions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            margin-top: 13px;
          }

          .mobile-card-actions button {
            min-height: 39px;
            border-radius: 9px;
            font-size: 12px;
            font-weight: 750;
            cursor: pointer;
            transition:
              transform 0.2s ease,
              box-shadow 0.2s ease;
          }

          .mobile-card-actions button:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 16px rgba(3, 21, 63, 0.1);
          }

          .mobile-view-button {
            border: 1px solid #b9c8eb;
            background: #eef3ff;
            color: #0a2e73;
          }

          .mobile-edit-button {
            border: 1px solid #f1d26a;
            background: #fff9e8;
            color: #8a6500;
          }

          .mobile-delete-button {
            border: 1px solid #fecdca;
            background: #fef3f2;
            color: #b42318;
          }
        }

        @media (max-width: 620px) {
          .admin-products-page {
            padding: 17px 10px 35px;
          }

          .page-header {
            margin-bottom: 18px;
            padding: 22px;
          }

          .page-header::after {
            right: 8px;
            font-size: 42px;
          }

          .page-header h1 {
            font-size: 28px;
          }

          .page-header p {
            font-size: 13px;
            line-height: 1.5;
          }

          .header-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .statistics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
          }

          .stat-card {
            min-height: 102px;
            gap: 10px;
            padding: 13px;
          }

          .stat-icon {
            width: 39px;
            height: 39px;
            border-radius: 11px;
            font-size: 17px;
          }

          .stat-card span {
            font-size: 10px;
          }

          .stat-card strong {
            font-size: 23px;
          }

          .filters-section {
            padding: 14px;
          }

          .filter-grid {
            grid-template-columns: 1fr;
          }

          .filter-footer {
            align-items: flex-start;
            flex-direction: column;
            gap: 9px;
          }

          .bulk-action-bar {
            align-items: flex-start;
            flex-direction: column;
          }

          .bulk-actions {
            width: 100%;
          }

          .bulk-actions button {
            flex: 1;
          }

          .mobile-products-list {
            padding: 10px;
          }

          .mobile-product-card {
            padding: 12px;
          }

          .mobile-product-image {
            width: 72px;
            height: 82px;
          }
        }

        @media (max-width: 380px) {
          .statistics-grid {
            grid-template-columns: 1fr;
          }

          .mobile-product-meta {
            grid-template-columns: 1fr;
          }

          .mobile-card-actions {
            grid-template-columns: 1fr;
          }
        }

        /* ============================================================
           NCS PRODUCTS / INVENTORY — MOBILE COMMAND DECK PREMIUM FINAL
           Visual-only redesign. Product load/search/filter/edit/delete/
           feature/view logic remains untouched.
           ============================================================ */

        :global(body) {
          background:#f5f6f8 !important;
          color:#20283a !important;
        }

        .admin-products-page {
          padding:18px 18px 58px !important;
          background:
            radial-gradient(circle at 0% 0%,rgba(91,72,145,.04),transparent 23%),
            radial-gradient(circle at 100% 6%,rgba(65,115,132,.04),transparent 23%),
            linear-gradient(180deg,#f7f7f8 0%,#f3f4f6 52%,#f7f4ee 100%) !important;
        }

        .admin-products-page::before,
        .admin-products-page::after {
          opacity:.32 !important;
          filter:saturate(.55) !important;
        }

        .page-container {
          max-width:1520px !important;
        }

        /* HERO */
        .page-header {
          align-items:center !important;
          margin-bottom:15px !important;
          padding:22px 24px !important;
          border:1px solid rgba(255,255,255,.14) !important;
          border-radius:26px !important;
          background:
            radial-gradient(circle at 88% -10%,rgba(241,211,109,.10),transparent 29%),
            radial-gradient(circle at 10% 112%,rgba(171,88,141,.11),transparent 31%),
            linear-gradient(120deg,#2b1b49 0%,#493578 40%,#31516f 72%,#245d60 100%) !important;
          color:#fff !important;
          box-shadow:0 16px 38px rgba(28,25,46,.15) !important;
        }

        .page-header::before {
          opacity:.22 !important;
        }

        .page-header::after {
          content:"NCS" !important;
          right:24px !important;
          top:-22px !important;
          transform:none !important;
          color:rgba(255,255,255,.025) !important;
          font-size:118px !important;
          line-height:1 !important;
          letter-spacing:-8px !important;
        }

        .eyebrow {
          margin-bottom:5px !important;
          color:#d8d1ea !important;
          font-size:9px !important;
          font-weight:900 !important;
          letter-spacing:1.15px !important;
        }

        .page-header h1 {
          color:#fff !important;
          font-size:34px !important;
          letter-spacing:-1px !important;
        }

        .page-header p {
          margin-top:6px !important;
          color:rgba(255,255,255,.70) !important;
          font-size:11px !important;
        }

        .header-actions {
          gap:9px !important;
        }

        .primary-button,
        .secondary-button {
          min-height:43px !important;
          border-radius:13px !important;
          padding:0 15px !important;
          box-shadow:none !important;
        }

        .primary-button {
          border-color:transparent !important;
          background:linear-gradient(135deg,#f1d56d,#e3bb53) !important;
          color:#2b1b49 !important;
        }

        .primary-button::after {
          display:none !important;
        }

        .secondary-button {
          border:1px solid rgba(255,255,255,.16) !important;
          background:rgba(255,255,255,.08) !important;
          color:#fff !important;
        }

        .secondary-button:hover {
          border-color:rgba(255,255,255,.28) !important;
          color:#fff !important;
          background:rgba(255,255,255,.12) !important;
        }

        /* ALERTS */
        .alert {
          margin-bottom:14px !important;
          border-radius:14px !important;
          box-shadow:none !important;
        }

        .success-alert {
          border-color:#d9e9e1 !important;
          background:#eef7f3 !important;
          color:#4f806f !important;
        }

        .error-alert {
          border-color:#eedada !important;
          background:#faf0f0 !important;
          color:#956262 !important;
        }

        /* SUMMARY / INVENTORY KPI CARDS */
        .statistics-grid {
          gap:10px !important;
          margin-bottom:14px !important;
        }

        .stat-card {
          min-height:105px !important;
          gap:12px !important;
          padding:15px !important;
          border:1px solid #e5e7ec !important;
          border-radius:18px !important;
          background:#fff !important;
          box-shadow:0 7px 18px rgba(32,39,55,.045) !important;
          animation:none !important;
        }

        .stat-card::after {
          top:auto !important;
          left:auto !important;
          right:-24px !important;
          bottom:-30px !important;
          width:88px !important;
          height:88px !important;
          border-radius:50% !important;
          transform:none !important;
          background:currentColor !important;
          opacity:.055 !important;
          animation:none !important;
        }

        .stat-card:nth-child(1) {
          color:#655492 !important;
          background:#f6f4fa !important;
          border-color:#e3dff0 !important;
        }

        .stat-card:nth-child(2) {
          color:#4f806f !important;
          background:#f2f7f4 !important;
          border-color:#dfece5 !important;
        }

        .stat-card:nth-child(3) {
          color:#626a92 !important;
          background:#f4f5f8 !important;
          border-color:#e2e4ec !important;
        }

        .stat-card:nth-child(4) {
          color:#9a774a !important;
          background:#faf6ed !important;
          border-color:#eee5d4 !important;
        }

        .stat-card:nth-child(5) {
          color:#956262 !important;
          background:#faf0f0 !important;
          border-color:#eedada !important;
        }

        .stat-card:hover {
          transform:translateY(-2px) !important;
          border-color:color-mix(in srgb,currentColor 28%,#e5e7ec) !important;
          box-shadow:0 10px 22px rgba(32,39,55,.06) !important;
        }

        .stat-icon {
          width:43px !important;
          height:43px !important;
          border:1px solid currentColor !important;
          border-radius:13px !important;
          background:rgba(255,255,255,.70) !important;
          color:currentColor !important;
          font-size:17px !important;
        }

        .stat-card span {
          color:currentColor !important;
          font-size:8px !important;
          font-weight:900 !important;
          letter-spacing:.55px !important;
        }

        .stat-card strong {
          color:#273042 !important;
          font-size:24px !important;
        }

        /* MAIN PRODUCTS PANEL */
        .products-panel {
          border:1px solid #e5e8ed !important;
          border-radius:22px !important;
          background:#fff !important;
          box-shadow:0 9px 24px rgba(32,39,55,.055) !important;
          animation:none !important;
        }

        .products-panel::before {
          height:2px !important;
          background:linear-gradient(90deg,#655492,#4d7d89,#4f806f) !important;
          animation:none !important;
          opacity:.70 !important;
        }

        .filters-section {
          padding:17px !important;
          border-bottom:1px solid #e8eaee !important;
          background:
            radial-gradient(circle at 98% 0%,rgba(91,72,145,.035),transparent 27%),
            #fff !important;
        }

        .search-wrapper {
          margin-bottom:11px !important;
        }

        .search-wrapper input {
          height:48px !important;
          border:1px solid #dfe3e9 !important;
          border-radius:13px !important;
          background:#f9fafb !important;
          color:#273042 !important;
          box-shadow:none !important;
        }

        .search-wrapper input:focus,
        .filter-grid select:focus {
          border-color:#77679c !important;
          box-shadow:0 0 0 3px rgba(101,84,146,.08) !important;
          transform:none !important;
        }

        .search-icon {
          color:#655492 !important;
        }

        .clear-search {
          background:#eef0f3 !important;
          color:#596170 !important;
        }

        .filter-grid {
          gap:9px !important;
        }

        .filter-grid select {
          height:42px !important;
          border:1px solid #dfe3e9 !important;
          border-radius:12px !important;
          background:#f9fafb !important;
          color:#344054 !important;
        }

        .filter-footer {
          margin-top:12px !important;
        }

        .filter-footer p {
          color:#737b8a !important;
        }

        .filter-footer strong,
        .text-button {
          color:#655492 !important;
        }

        .text-button:hover {
          color:#4d7d89 !important;
        }

        /* BULK ACTION BAR */
        .bulk-action-bar {
          padding:11px 17px !important;
          border-bottom:1px solid #ded9e9 !important;
          background:linear-gradient(90deg,#f5f2f9,#f2f7f7) !important;
          color:#4f4569 !important;
        }

        .clear-selection-button {
          border:1px solid #d9dce4 !important;
          background:#fff !important;
          color:#4e5767 !important;
        }

        .delete-selected-button {
          border:1px solid #e2caca !important;
          background:#faf0f0 !important;
          color:#956262 !important;
        }

        /* DESKTOP TABLE */
        .desktop-table-wrapper {
          background:#fff !important;
        }

        .products-table {
          color:#273042 !important;
        }

        .products-table thead th {
          padding-top:12px !important;
          padding-bottom:12px !important;
          border-bottom:1px solid #e8eaee !important;
          background:#f7f8fa !important;
          color:#687084 !important;
          font-size:8px !important;
          font-weight:900 !important;
          letter-spacing:.65px !important;
          text-transform:uppercase !important;
        }

        .products-table tbody tr {
          border-bottom-color:#edf0f3 !important;
          background:#fff !important;
          transition:background .18s ease !important;
        }

        .products-table tbody tr:hover {
          background:#fafbfc !important;
        }

        .products-table tbody tr:nth-child(even) {
          background:#fcfcfd !important;
        }

        .products-table tbody tr.selected-row {
          background:#f5f3f9 !important;
          box-shadow:inset 4px 0 #655492 !important;
        }

        .products-table td {
          color:#344054 !important;
        }

        .product-cell {
          gap:12px !important;
        }

        .product-image-wrapper {
          width:58px !important;
          height:68px !important;
          border:1px solid #e4e7ec !important;
          border-radius:13px !important;
          background:#f7f8fa !important;
          box-shadow:none !important;
        }

        .image-fallback {
          background:linear-gradient(145deg,#42335f,#3f6571) !important;
          color:#e4d29a !important;
        }

        .product-name-button {
          color:#293247 !important;
          font-weight:900 !important;
        }

        .product-name-button:hover {
          color:#655492 !important;
        }

        .product-information span,
        .category-cell span,
        .date-text {
          color:#7a8190 !important;
        }

        .category-cell strong {
          color:#4d5668 !important;
        }

        .price-cell strong {
          color:#293247 !important;
        }

        .price-cell span {
          color:#8b909c !important;
        }

        .price-cell small {
          color:#4f806f !important;
        }

        /* STOCK / STATUS */
        .stock-badge,
        .status-badge {
          border:1px solid transparent !important;
          border-radius:999px !important;
          font-size:8px !important;
          font-weight:900 !important;
          box-shadow:none !important;
        }

        .in-stock {
          border-color:#d7e9e1 !important;
          background:#eef7f3 !important;
          color:#4f806f !important;
        }

        .low-stock {
          border-color:#eee2ce !important;
          background:#faf6ed !important;
          color:#9a774a !important;
        }

        .out-stock {
          border-color:#eedada !important;
          background:#faf0f0 !important;
          color:#956262 !important;
        }

        .status-active {
          border-color:#d7e9e1 !important;
          background:#eef7f3 !important;
          color:#4f806f !important;
        }

        .status-inactive,
        .status-disabled,
        .status-hidden {
          border-color:#e1e4e9 !important;
          background:#f3f4f6 !important;
          color:#687084 !important;
        }

        .status-draft {
          border-color:#ded9e9 !important;
          background:#f5f3f9 !important;
          color:#655492 !important;
        }

        .status-dot {
          box-shadow:none !important;
        }

        /* FEATURED / ROW ACTIONS */
        .featured-button {
          border:1px solid #e0e3e8 !important;
          background:#f7f8fa !important;
          color:#8b909c !important;
          box-shadow:none !important;
        }

        .featured-button:hover {
          border-color:#cfc8df !important;
          background:#f3f1f8 !important;
          color:#655492 !important;
        }

        .featured-active {
          border-color:#e2d6b4 !important;
          background:#faf6ed !important;
          color:#9a774a !important;
        }

        .action-buttons {
          gap:6px !important;
        }

        .icon-button {
          width:34px !important;
          height:34px !important;
          border:1px solid #e1e4e9 !important;
          border-radius:10px !important;
          box-shadow:none !important;
        }

        .view-button {
          background:#f5f3f9 !important;
          color:#655492 !important;
        }

        .edit-button {
          background:#f1f6f7 !important;
          color:#4d7d89 !important;
        }

        .delete-button {
          background:#faf0f0 !important;
          color:#956262 !important;
        }

        .icon-button:hover {
          transform:translateY(-1px) !important;
          box-shadow:0 6px 13px rgba(32,39,55,.05) !important;
        }

        /* LOADING / EMPTY */
        .loading-state,
        .empty-state {
          min-height:330px !important;
          color:#737b8a !important;
          background:#fff !important;
        }

        .loading-state h2,
        .empty-state h2 {
          color:#293247 !important;
        }

        .loader {
          border-color:#e5e7eb !important;
          border-top-color:#655492 !important;
        }

        .empty-icon {
          background:#f3f1f8 !important;
          color:#655492 !important;
          box-shadow:none !important;
        }

        /* MOBILE PRODUCT CARDS */
        .mobile-products-list {
          background:#fff !important;
        }

        .mobile-select-all {
          border-bottom-color:#e8eaee !important;
          background:#f8f9fb !important;
          color:#596170 !important;
        }

        .mobile-product-card {
          position:relative !important;
          overflow:hidden !important;
          border:1px solid #e5e8ed !important;
          border-radius:18px !important;
          background:#fff !important;
          box-shadow:0 7px 18px rgba(32,39,55,.045) !important;
        }

        .mobile-product-card::before {
          content:"";
          position:absolute;
          inset:0 auto 0 0;
          width:4px;
          background:#655492;
        }

        .mobile-product-card:nth-child(5n+2)::before {background:#4f806f}
        .mobile-product-card:nth-child(5n+3)::before {background:#4d7d89}
        .mobile-product-card:nth-child(5n+4)::before {background:#94617e}
        .mobile-product-card:nth-child(5n+5)::before {background:#9a774a}

        .mobile-card-selected {
          background:#f7f5fa !important;
          border-color:#cfc8df !important;
        }

        .mobile-product-image {
          border-color:#e4e7ec !important;
          background:#f7f8fa !important;
        }

        .mobile-product-id,
        .mobile-product-meta span,
        .mobile-price small {
          color:#7a8190 !important;
        }

        .mobile-price strong,
        .mobile-product-meta strong {
          color:#293247 !important;
        }

        .stock-green {color:#4f806f !important}
        .stock-orange {color:#9a774a !important}
        .stock-red {color:#956262 !important}

        .mobile-product-meta {
          border-color:#e8eaee !important;
          background:#fafbfc !important;
        }

        .mobile-view-button,
        .mobile-edit-button,
        .mobile-delete-button {
          min-height:39px !important;
          border-radius:11px !important;
          box-shadow:none !important;
        }

        .mobile-view-button {
          border:1px solid #ded9e9 !important;
          background:#f5f3f9 !important;
          color:#655492 !important;
        }

        .mobile-edit-button {
          border:1px solid #dce9ec !important;
          background:#f1f6f7 !important;
          color:#4d7d89 !important;
        }

        .mobile-delete-button {
          border:1px solid #eedada !important;
          background:#faf0f0 !important;
          color:#956262 !important;
        }

        /* CHECKBOX ACCENT */
        .admin-products-page input[type="checkbox"] {
          accent-color:#655492 !important;
        }

        @media(max-width:1100px){
          .statistics-grid {
            grid-template-columns:repeat(3,minmax(0,1fr)) !important;
          }
        }

        @media(max-width:760px){
          .admin-products-page {
            padding:10px 10px 42px !important;
          }

          .page-header {
            border-radius:21px !important;
            padding:18px 16px !important;
          }

          .page-header h1 {
            font-size:28px !important;
          }

          .page-header::after {
            font-size:72px !important;
            top:-6px !important;
            right:8px !important;
          }

          .statistics-grid {
            grid-template-columns:repeat(2,minmax(0,1fr)) !important;
            gap:8px !important;
          }

          .stat-card {
            min-height:92px !important;
            border-radius:16px !important;
          }

          .products-panel {
            border-radius:18px !important;
          }

          .filters-section {
            padding:13px !important;
          }

          .filter-grid {
            grid-template-columns:repeat(2,minmax(0,1fr)) !important;
          }
        }

        @media(max-width:480px){
          .statistics-grid {
            grid-template-columns:1fr 1fr !important;
          }

          .filter-grid {
            grid-template-columns:1fr !important;
          }

          .header-actions {
            width:100% !important;
          }

          .header-actions .primary-button,
          .header-actions .secondary-button {
            flex:1 !important;
          }
        }


        /* ============================================================
           NCS PRODUCTS — INTERNATIONAL COLORFUL PREMIUM V2
           Strong visible redesign: premium motion + richer cards
           ============================================================ */

        .admin-products-page {
          background:
            radial-gradient(circle at 4% 0%,rgba(111,78,190,.10),transparent 24%),
            radial-gradient(circle at 96% 5%,rgba(25,155,164,.10),transparent 24%),
            radial-gradient(circle at 55% 100%,rgba(231,166,83,.08),transparent 26%),
            linear-gradient(180deg,#f7f7fb 0%,#f1f4f8 50%,#f8f4ed 100%) !important;
        }

        /* HERO — richer premium animated deck */
        .page-header {
          min-height:150px !important;
          background:
            radial-gradient(circle at 82% -15%,rgba(255,215,115,.30),transparent 31%),
            radial-gradient(circle at 12% 115%,rgba(230,86,170,.28),transparent 34%),
            linear-gradient(118deg,#31184f 0%,#5c32a8 35%,#3c6f93 68%,#1f8a7e 100%) !important;
          box-shadow:0 22px 55px rgba(40,31,72,.20) !important;
        }

        .page-header::before {
          opacity:.55 !important;
          animation:products-hero-shine 5.5s ease-in-out infinite !important;
        }

        .page-header::after {
          content:"PRODUCTS" !important;
          right:20px !important;
          top:50% !important;
          transform:translateY(-50%) !important;
          color:rgba(255,255,255,.055) !important;
          font-size:clamp(66px,8vw,122px) !important;
          letter-spacing:2px !important;
        }

        .eyebrow {
          color:#f4d979 !important;
        }

        .page-header h1 {
          font-size:38px !important;
          text-shadow:0 2px 12px rgba(0,0,0,.12) !important;
        }

        .premium-primary-button {
          background:linear-gradient(135deg,#f4d86f,#f0aa45) !important;
          color:#26163f !important;
          border:1px solid rgba(255,255,255,.45) !important;
          box-shadow:0 10px 24px rgba(238,172,69,.24) !important;
        }

        .premium-secondary-button {
          background:rgba(255,255,255,.12) !important;
          border-color:rgba(255,255,255,.28) !important;
          backdrop-filter:blur(12px) !important;
        }

        /* KPI — make them visually distinct */
        .statistics-grid {
          gap:12px !important;
        }

        .stat-card {
          min-height:116px !important;
          border-radius:21px !important;
          border-width:1.5px !important;
          box-shadow:0 12px 28px rgba(39,44,61,.07) !important;
          transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease !important;
        }

        .stat-card:hover {
          transform:translateY(-4px) scale(1.015) !important;
          box-shadow:0 18px 34px rgba(39,44,61,.12) !important;
        }

        .stat-card:nth-child(1) {
          background:linear-gradient(135deg,#ede7ff 0%,#f9f7ff 65%,#e8f4ff 100%) !important;
          border-color:#c8baf4 !important;
          color:#6549ba !important;
        }

        .stat-card:nth-child(2) {
          background:linear-gradient(135deg,#dcf6ec 0%,#f7fffb 64%,#def8f2 100%) !important;
          border-color:#a6dec9 !important;
          color:#27866c !important;
        }

        .stat-card:nth-child(3) {
          background:linear-gradient(135deg,#e7eafd 0%,#fafbff 65%,#e9f3ff 100%) !important;
          border-color:#b9c5ed !important;
          color:#596ba4 !important;
        }

        .stat-card:nth-child(4) {
          background:linear-gradient(135deg,#fff0cd 0%,#fffaf1 65%,#ffe5d4 100%) !important;
          border-color:#efc880 !important;
          color:#b0762b !important;
        }

        .stat-card:nth-child(5) {
          background:linear-gradient(135deg,#ffe1e8 0%,#fff5f7 65%,#ffe4d8 100%) !important;
          border-color:#efacb9 !important;
          color:#b05269 !important;
        }

        .stat-icon {
          width:50px !important;
          height:50px !important;
          border:0 !important;
          color:#fff !important;
          box-shadow:0 8px 18px rgba(40,40,65,.14) !important;
        }

        .stat-card:nth-child(1) .stat-icon {background:linear-gradient(135deg,#6748c8,#8a65e5)!important}
        .stat-card:nth-child(2) .stat-icon {background:linear-gradient(135deg,#23876d,#43b691)!important}
        .stat-card:nth-child(3) .stat-icon {background:linear-gradient(135deg,#5769a8,#7f8fd0)!important}
        .stat-card:nth-child(4) .stat-icon {background:linear-gradient(135deg,#d78d30,#f0b45e)!important}
        .stat-card:nth-child(5) .stat-icon {background:linear-gradient(135deg,#b55167,#df7388)!important}

        .stat-card strong {
          font-size:28px !important;
          color:#20283a !important;
        }

        /* FILTER PANEL */
        .products-panel {
          border-radius:24px !important;
          border-color:#dde2ea !important;
          box-shadow:0 14px 36px rgba(39,44,61,.075) !important;
        }

        .filters-section {
          background:
            linear-gradient(135deg,#fbfbff 0%,#ffffff 45%,#f3fbfb 100%) !important;
          padding:18px !important;
        }

        .search-wrapper input {
          height:52px !important;
          background:#fff !important;
          border-color:#d9dee8 !important;
          box-shadow:0 5px 14px rgba(39,44,61,.035) !important;
        }

        .search-wrapper input:focus {
          border-color:#755fc0 !important;
          box-shadow:0 0 0 4px rgba(117,95,192,.10),0 8px 20px rgba(39,44,61,.05) !important;
        }

        .search-icon {
          color:#6c53b4 !important;
        }

        .filter-grid select {
          height:44px !important;
          background:#fff !important;
          border-color:#dde2ea !important;
          box-shadow:0 4px 11px rgba(39,44,61,.025) !important;
        }

        /* TABLE HEADER more premium */
        .products-table thead th {
          background:linear-gradient(180deg,#f4f3f9,#eef2f6) !important;
          color:#505b70 !important;
          border-bottom:1px solid #dce1e8 !important;
        }

        .products-table tbody tr {
          transition:background .18s ease,transform .18s ease,box-shadow .18s ease !important;
        }

        .products-table tbody tr:hover {
          background:linear-gradient(90deg,#fbf9ff,#f5fbfb) !important;
          box-shadow:inset 4px 0 #6e55b9 !important;
        }

        .product-image-wrapper {
          width:64px !important;
          height:74px !important;
          border-radius:15px !important;
          background:linear-gradient(145deg,#fafafa,#f1f4f7) !important;
          box-shadow:0 5px 14px rgba(39,44,61,.06) !important;
        }

        .product-name-button {
          font-size:13px !important;
          color:#20283a !important;
        }

        .product-name-button:hover {
          color:#6e55b9 !important;
        }

        .price-cell strong {
          font-size:14px !important;
          color:#20283a !important;
        }

        /* Stock badges stronger */
        .in-stock {
          background:#e8f7f0 !important;
          border-color:#bfe4d4 !important;
          color:#2c8067 !important;
        }
        .low-stock {
          background:#fff4dc !important;
          border-color:#efd49e !important;
          color:#a97429 !important;
        }
        .out-stock {
          background:#fff0f2 !important;
          border-color:#edc2c9 !important;
          color:#a74f60 !important;
        }

        .status-active {
          background:#e8f7f0 !important;
          border-color:#bfe4d4 !important;
          color:#2c8067 !important;
        }

        /* Action buttons */
        .icon-button {
          width:36px !important;
          height:36px !important;
          border-radius:11px !important;
          transition:transform .18s ease,box-shadow .18s ease !important;
        }

        .view-button {
          background:#eee9fb !important;
          border-color:#d4c8ef !important;
          color:#6650ad !important;
        }

        .edit-button {
          background:#e9f6f8 !important;
          border-color:#c6e4e9 !important;
          color:#3f7f8b !important;
        }

        .delete-button {
          background:#fff0f1 !important;
          border-color:#edc7cd !important;
          color:#a65361 !important;
        }

        .icon-button:hover {
          transform:translateY(-2px) scale(1.05) !important;
          box-shadow:0 7px 14px rgba(39,44,61,.10) !important;
        }

        .featured-active {
          background:linear-gradient(135deg,#fff2c7,#fff8e5) !important;
          border-color:#e8c96f !important;
          color:#a87a22 !important;
          box-shadow:0 5px 12px rgba(193,147,47,.10) !important;
        }

        /* subtle page entrance motion */
        .premium-products-hero {
          animation:ncs-products-enter .55s cubic-bezier(.2,.8,.2,1) both !important;
        }

        .premium-products-statistics {
          animation:ncs-products-enter .65s .06s cubic-bezier(.2,.8,.2,1) both !important;
        }

        .premium-products-panel {
          animation:ncs-products-enter .72s .10s cubic-bezier(.2,.8,.2,1) both !important;
        }

        @keyframes ncs-products-enter {
          from { opacity:0; transform:translateY(14px); }
          to { opacity:1; transform:translateY(0); }
        }

        @media(prefers-reduced-motion:reduce){
          .premium-products-hero,
          .premium-products-statistics,
          .premium-products-panel,
          .page-header::before {
            animation:none !important;
          }
        }

        @media(max-width:760px){
          .page-header {
            min-height:auto !important;
          }
          .stat-card {
            min-height:100px !important;
          }
        }

      `}</style>
    </main>
  );
}