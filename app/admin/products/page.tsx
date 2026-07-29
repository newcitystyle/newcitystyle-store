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
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  price?: number | string | null;
  mrp?: number | string | null;
  sale_price?: number | string | null;
  offer_price?: number | string | null;
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

function getProductPrice(product: Product) {
  const value =
    product.offer_price ??
    product.sale_price ??
    product.price ??
    product.mrp ??
    0;

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getProductMrp(product: Product) {
  const value = product.mrp ?? product.price ?? getProductPrice(product);
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
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

      setProducts((data as Product[]) || []);
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
      const priceA = getProductPrice(a);
      const priceB = getProductPrice(b);
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
                      const sellingPrice = getProductPrice(product);
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
                                  <span>{String(product.brand)}</span>
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
                              <strong>
                                {formatCurrency(sellingPrice)}
                              </strong>

                              {mrp > sellingPrice && (
                                <span>{formatCurrency(mrp)}</span>
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
                  const sellingPrice = getProductPrice(product);
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
                            <strong>
                              {formatCurrency(sellingPrice)}
                            </strong>

                            {mrp > sellingPrice && (
                              <span>{formatCurrency(mrp)}</span>
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
      `}</style>
    </main>
  );
}