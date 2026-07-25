"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Product = {
  id: number | string;
  name?: string | null;
  product_name?: string | null;
  title?: string | null;
  slug?: string | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  price?: number | string | null;
  mrp?: number | string | null;
  stock?: number | string | null;
  status?: string | null;
  is_active?: boolean | null;
  is_featured?: boolean | null;
  featured?: boolean | null;
  image_url?: string | null;
  images?: string[] | string | null;
  created_at?: string | null;
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

function getProductPrice(product: Product) {
  const value = Number(product.price ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getProductMrp(product: Product) {
  const value = Number(product.mrp ?? product.price ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getProductStock(product: Product) {
  const value = Number(product.stock ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getProductStatus(product: Product) {
  if (typeof product.is_active === "boolean") {
    return product.is_active ? "active" : "inactive";
  }

  return String(product.status || "active").toLowerCase();
}

function isFeatured(product: Product) {
  return Boolean(product.is_featured ?? product.featured ?? false);
}

function parseImages(product: Product) {
  const urls: string[] = [];

  if (Array.isArray(product.images)) {
    urls.push(...product.images.filter(Boolean));
  } else if (typeof product.images === "string" && product.images.trim()) {
    try {
      const parsed = JSON.parse(product.images);

      if (Array.isArray(parsed)) {
        urls.push(...parsed.filter(Boolean));
      } else {
        urls.push(product.images);
      }
    } catch {
      urls.push(product.images);
    }
  }

  if (product.image_url && !urls.includes(product.image_url)) {
    urls.unshift(product.image_url);
  }

  return urls;
}

function getProductImage(product: Product) {
  return parseImages(product)[0] || "";
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

function extractStoragePath(url: string) {
  try {
    const decodedUrl = decodeURIComponent(url);
    const marker = "/storage/v1/object/public/product-images/";
    const markerIndex = decodedUrl.indexOf(marker);

    if (markerIndex === -1) return "";

    return decodedUrl.slice(markerIndex + marker.length);
  } catch {
    return "";
  }
}

export default function AdminProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [updatingFeaturedId, setUpdatingFeaturedId] = useState<
    number | string | null
  >(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadProducts = useCallback(async (refresh = false) => {
    if (refresh) {
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

      if (error) throw error;

      setProducts((data as Product[]) || []);
    } catch (error) {
      console.error("Load products error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load products."
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
    if (!successMessage && !errorMessage) return;

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
      setErrorMessage("");
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [successMessage, errorMessage]);

  const categories = useMemo(() => {
    const values = products
      .map((product) => product.category || product.subcategory || "")
      .filter(Boolean)
      .map((value) => String(value).trim());

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = products.filter((product) => {
      const name = getProductName(product).toLowerCase();
      const category = String(product.category || "").toLowerCase();
      const subcategory = String(product.subcategory || "").toLowerCase();
      const brand = String(product.brand || "").toLowerCase();
      const status = getProductStatus(product);
      const stock = getProductStock(product);

      const matchesSearch =
        !query ||
        name.includes(query) ||
        category.includes(query) ||
        subcategory.includes(query) ||
        brand.includes(query) ||
        String(product.id).includes(query);

      const selectedCategory = categoryFilter.toLowerCase();

      const matchesCategory =
        categoryFilter === "all" ||
        category === selectedCategory ||
        subcategory === selectedCategory;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "featured"
          ? isFeatured(product)
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
    search,
    categoryFilter,
    statusFilter,
    stockFilter,
    sortOption,
  ]);

  const stats = useMemo(() => {
    return {
      total: products.length,
      active: products.filter(
        (product) => getProductStatus(product) === "active"
      ).length,
      featured: products.filter(isFeatured).length,
      lowStock: products.filter((product) => {
        const stock = getProductStock(product);
        return stock > 0 && stock <= 5;
      }).length,
      outOfStock: products.filter(
        (product) => getProductStock(product) <= 0
      ).length,
    };
  }, [products]);

  const allVisibleSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) => selectedIds.includes(product.id));

  function clearFilters() {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setStockFilter("all");
    setSortOption("newest");
  }

  function toggleSelected(id: number | string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
    );
  }

  function toggleAllVisible() {
    const visibleIds = filteredProducts.map((product) => product.id);

    if (allVisibleSelected) {
      const visibleIdSet = new Set(visibleIds);
      setSelectedIds((current) =>
        current.filter((id) => !visibleIdSet.has(id))
      );
      return;
    }

    setSelectedIds((current) =>
      Array.from(new Set([...current, ...visibleIds]))
    );
  }

  async function removeProductImages(product: Product) {
    const paths = parseImages(product)
      .map(extractStoragePath)
      .filter(Boolean);

    if (paths.length === 0) return;

    const { error } = await supabase.storage
      .from("product-images")
      .remove(paths);

    if (error) {
      console.warn("Storage image delete warning:", error);
    }
  }

  async function deleteProduct(product: Product) {
    const productName = getProductName(product);

    const confirmed = window.confirm(
      `Delete "${productName}"?\n\nThe product and its uploaded images will be removed. This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(product.id);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (error) throw error;

      await removeProductImages(product);

      setProducts((current) =>
        current.filter((item) => item.id !== product.id)
      );

      setSelectedIds((current) =>
        current.filter((id) => id !== product.id)
      );

      setSuccessMessage(`${productName} deleted successfully.`);
    } catch (error) {
      console.error("Delete product error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete the product."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteSelectedProducts() {
    if (selectedIds.length === 0) return;

    const selectedProducts = products.filter((product) =>
      selectedIds.includes(product.id)
    );

    const confirmed = window.confirm(
      `Delete ${selectedProducts.length} selected product${
        selectedProducts.length === 1 ? "" : "s"
      }?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setSuccessMessage("");
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .in("id", selectedIds);

      if (error) throw error;

      for (const product of selectedProducts) {
        await removeProductImages(product);
      }

      const deletedIdSet = new Set(selectedIds);

      setProducts((current) =>
        current.filter((product) => !deletedIdSet.has(product.id))
      );

      const count = selectedIds.length;
      setSelectedIds([]);
      setSuccessMessage(
        `${count} product${count === 1 ? "" : "s"} deleted successfully.`
      );
    } catch (error) {
      console.error("Bulk delete error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete selected products."
      );
    }
  }

  async function toggleFeatured(product: Product) {
    const nextValue = !isFeatured(product);

    setUpdatingFeaturedId(product.id);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("products")
        .update({ is_featured: nextValue })
        .eq("id", product.id);

      if (error) throw error;

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? { ...item, is_featured: nextValue }
            : item
        )
      );

      setSuccessMessage(
        `${getProductName(product)} ${
          nextValue ? "added to" : "removed from"
        } Featured Products.`
      );
    } catch (error) {
      console.error("Featured update error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update featured status."
      );
    } finally {
      setUpdatingFeaturedId(null);
    }
  }

  return (
    <main className="page">
      <div className="container">
        <header className="header">
          <div>
            <p className="eyebrow">NEW CITY STYLE ADMIN</p>
            <h1>Product Management</h1>
            <p className="subtitle">
              Add, edit, organise and manage your complete product catalogue.
            </p>
          </div>

          <div className="headerActions">
            <button
              type="button"
              className="secondaryButton"
              onClick={() => loadProducts(true)}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "↻ Refresh"}
            </button>

            <button
              type="button"
              className="primaryButton"
              onClick={() => router.push("/admin/products/add")}
            >
              ＋ Add New Product
            </button>
          </div>
        </header>

        {successMessage && (
          <div className="alert successAlert">
            <span>✓</span>
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="alert errorAlert">
            <span>!</span>
            {errorMessage}
          </div>
        )}

        <section className="statsGrid">
          <StatCard label="Total Products" value={stats.total} icon="▦" />
          <StatCard label="Active Products" value={stats.active} icon="✓" />
          <StatCard label="Featured" value={stats.featured} icon="★" />
          <StatCard label="Low Stock" value={stats.lowStock} icon="!" />
          <StatCard label="Out of Stock" value={stats.outOfStock} icon="×" />
        </section>

        <section className="panel">
          <div className="filters">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by product name, ID, category or brand..."
            />

            <div className="filterGrid">
              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
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

            <div className="filterFooter">
              <span>
                Showing <strong>{filteredProducts.length}</strong> of{" "}
                <strong>{products.length}</strong> products
              </span>

              <button type="button" onClick={clearFilters}>
                Clear Filters
              </button>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="bulkBar">
              <strong>
                {selectedIds.length} product
                {selectedIds.length === 1 ? "" : "s"} selected
              </strong>

              <div>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                >
                  Clear Selection
                </button>

                <button
                  type="button"
                  className="bulkDeleteButton"
                  onClick={deleteSelectedProducts}
                >
                  Delete Selected
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="state">
              <div className="loader" />
              <h2>Loading products...</h2>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="state">
              <h2>No products found</h2>
              <p>Try changing your search or filters.</p>
            </div>
          ) : (
            <>
              <div className="tableWrapper">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisible}
                        />
                      </th>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Status</th>
                      <th>Featured</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredProducts.map((product) => {
                      const name = getProductName(product);
                      const image = getProductImage(product);
                      const price = getProductPrice(product);
                      const mrp = getProductMrp(product);
                      const stock = getProductStock(product);
                      const status = getProductStatus(product);
                      const featured = isFeatured(product);

                      return (
                        <tr key={String(product.id)}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(product.id)}
                              onChange={() => toggleSelected(product.id)}
                            />
                          </td>

                          <td>
                            <div className="productCell">
                              <div className="imageBox">
                                {image ? (
                                  <img src={image} alt={name} />
                                ) : (
                                  <span>NCS</span>
                                )}
                              </div>

                              <div>
                                <strong>{name}</strong>
                                <small>ID: {product.id}</small>
                                {product.brand && (
                                  <small>{product.brand}</small>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <strong>
                              {product.category || "Uncategorised"}
                            </strong>
                            {product.subcategory && (
                              <small>{product.subcategory}</small>
                            )}
                          </td>

                          <td>
                            <strong className="price">
                              {formatCurrency(price)}
                            </strong>
                            {mrp > price && (
                              <small className="mrp">
                                {formatCurrency(mrp)}
                              </small>
                            )}
                          </td>

                          <td>
                            <span
                              className={`stock ${
                                stock <= 0
                                  ? "out"
                                  : stock <= 5
                                    ? "low"
                                    : "available"
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
                            <span className={`status status-${status}`}>
                              {status.charAt(0).toUpperCase() +
                                status.slice(1)}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className={`featuredButton ${
                                featured ? "featuredActive" : ""
                              }`}
                              onClick={() => toggleFeatured(product)}
                              disabled={updatingFeaturedId === product.id}
                            >
                              {updatingFeaturedId === product.id
                                ? "…"
                                : featured
                                  ? "★"
                                  : "☆"}
                            </button>
                          </td>

                          <td>{formatDate(product.created_at)}</td>

                          <td>
                            <div className="actions">
                              <button
                                type="button"
                                className="viewButton"
                                onClick={() =>
                                  router.push(`/product/${product.id}`)
                                }
                              >
                                View
                              </button>

                              <button
                                type="button"
                                className="editButton"
                                onClick={() =>
                                  router.push(
                                    `/admin/products/edit/${product.id}`
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="deleteButton"
                                disabled={deletingId === product.id}
                                onClick={() => deleteProduct(product)}
                              >
                                {deletingId === product.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mobileList">
                {filteredProducts.map((product) => {
                  const name = getProductName(product);
                  const image = getProductImage(product);
                  const price = getProductPrice(product);
                  const stock = getProductStock(product);

                  return (
                    <article className="mobileCard" key={String(product.id)}>
                      <div className="mobileTop">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(product.id)}
                          onChange={() => toggleSelected(product.id)}
                        />

                        <button
                          type="button"
                          className={`featuredButton ${
                            isFeatured(product) ? "featuredActive" : ""
                          }`}
                          onClick={() => toggleFeatured(product)}
                        >
                          {isFeatured(product) ? "★" : "☆"}
                        </button>
                      </div>

                      <div className="mobileMain">
                        <div className="mobileImage">
                          {image ? (
                            <img src={image} alt={name} />
                          ) : (
                            <span>NCS</span>
                          )}
                        </div>

                        <div>
                          <h3>{name}</h3>
                          <p>{product.category || "Uncategorised"}</p>
                          <strong>{formatCurrency(price)}</strong>
                          <small>{stock} in stock</small>
                        </div>
                      </div>

                      <div className="mobileActions">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/product/${product.id}`)
                          }
                        >
                          View
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/admin/products/edit/${product.id}`
                            )
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="deleteButton"
                          disabled={deletingId === product.id}
                          onClick={() => deleteProduct(product)}
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
          background: #f4f6fb;
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
          padding: 30px 22px 60px;
          background:
            radial-gradient(
              circle at top right,
              rgba(212, 175, 55, 0.1),
              transparent 30%
            ),
            #f4f6fb;
        }

        .container {
          max-width: 1500px;
          margin: auto;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
          margin-bottom: 22px;
        }

        .eyebrow {
          margin: 0 0 7px;
          color: #d4af37;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        h1 {
          margin: 0;
          color: #0a2e73;
          font-size: clamp(30px, 5vw, 43px);
        }

        .subtitle {
          margin: 9px 0 0;
          color: #667085;
        }

        .headerActions {
          display: flex;
          gap: 10px;
        }

        .primaryButton,
        .secondaryButton {
          min-height: 46px;
          padding: 0 18px;
          border-radius: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .primaryButton {
          border: 1px solid #0a2e73;
          background: #0a2e73;
          color: white;
        }

        .secondaryButton {
          border: 1px solid #d0d5dd;
          background: white;
          color: #344054;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
          padding: 14px 16px;
          border-radius: 11px;
          font-weight: 700;
        }

        .successAlert {
          border: 1px solid #a6f4c5;
          background: #ecfdf3;
          color: #067647;
        }

        .errorAlert {
          border: 1px solid #fecdca;
          background: #fef3f2;
          color: #b42318;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 20px;
        }

        .statCard {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 98px;
          padding: 16px;
          border: 1px solid #e4e7ec;
          border-radius: 15px;
          background: white;
        }

        .statIcon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #eef3ff;
          color: #0a2e73;
          font-size: 19px;
          font-weight: 900;
        }

        .statCard span {
          display: block;
          color: #667085;
          font-size: 12px;
        }

        .statCard strong {
          display: block;
          margin-top: 4px;
          font-size: 25px;
        }

        .panel {
          overflow: hidden;
          border: 1px solid #e4e7ec;
          border-radius: 17px;
          background: white;
        }

        .filters {
          padding: 18px;
          border-bottom: 1px solid #eaecf0;
        }

        .filters > input {
          width: 100%;
          height: 48px;
          padding: 0 14px;
          border: 1px solid #d0d5dd;
          border-radius: 11px;
          outline: none;
        }

        .filters > input:focus,
        select:focus {
          border-color: #0a2e73;
          box-shadow: 0 0 0 4px rgba(10, 46, 115, 0.08);
        }

        .filterGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 11px;
          margin-top: 12px;
        }

        .filterGrid select {
          height: 44px;
          padding: 0 12px;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          background: white;
          outline: none;
        }

        .filterFooter {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 13px;
          color: #667085;
          font-size: 13px;
        }

        .filterFooter button {
          border: 0;
          background: transparent;
          color: #0a2e73;
          font-weight: 800;
          cursor: pointer;
        }

        .bulkBar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          padding: 13px 18px;
          border-bottom: 1px solid #b9c8eb;
          background: #eef3ff;
          color: #0a2e73;
        }

        .bulkBar > div {
          display: flex;
          gap: 8px;
        }

        .bulkBar button {
          min-height: 36px;
          padding: 0 12px;
          border: 1px solid #b9c8eb;
          border-radius: 8px;
          background: white;
          cursor: pointer;
        }

        .bulkBar .bulkDeleteButton {
          border-color: #d92d20;
          background: #d92d20;
          color: white;
        }

        .tableWrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1200px;
          border-collapse: collapse;
        }

        th {
          padding: 13px;
          border-bottom: 1px solid #eaecf0;
          background: #f8fafc;
          color: #475467;
          font-size: 11px;
          text-align: left;
          text-transform: uppercase;
        }

        td {
          padding: 14px 13px;
          border-bottom: 1px solid #f0f1f3;
          color: #344054;
          font-size: 13px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #fbfcff;
        }

        input[type="checkbox"] {
          width: 17px;
          height: 17px;
          accent-color: #0a2e73;
        }

        .productCell {
          min-width: 240px;
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .imageBox {
          width: 61px;
          height: 69px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 9px;
          background: #0a2e73;
          color: #d4af37;
          font-weight: 900;
        }

        .imageBox img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        td strong,
        td small {
          display: block;
        }

        td small {
          margin-top: 4px;
          color: #98a2b3;
          font-size: 11px;
        }

        .price {
          color: #0a2e73;
          font-size: 14px;
        }

        .mrp {
          text-decoration: line-through;
        }

        .stock,
        .status {
          display: inline-flex;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .stock.available,
        .status-active {
          background: #ecfdf3;
          color: #067647;
        }

        .stock.low,
        .status-draft {
          background: #fff4e8;
          color: #b54708;
        }

        .stock.out,
        .status-inactive {
          background: #fef3f2;
          color: #b42318;
        }

        .featuredButton {
          width: 38px;
          height: 38px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: white;
          color: #98a2b3;
          font-size: 21px;
          cursor: pointer;
        }

        .featuredActive {
          border-color: #d4af37;
          background: #fff9e8;
          color: #d4af37;
        }

        .actions {
          display: flex;
          gap: 6px;
        }

        .actions button,
        .mobileActions button {
          min-height: 35px;
          padding: 0 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .viewButton {
          border: 1px solid #b9c8eb;
          background: #eef3ff;
          color: #0a2e73;
        }

        .editButton {
          border: 1px solid #f1d26a;
          background: #fff9e8;
          color: #8a6500;
        }

        .deleteButton {
          border: 1px solid #fecdca;
          background: #fef3f2;
          color: #b42318;
        }

        .deleteButton:disabled {
          opacity: 0.55;
          cursor: wait;
        }

        .state {
          min-height: 350px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .state h2 {
          margin: 0;
          color: #0a2e73;
        }

        .state p {
          color: #667085;
        }

        .loader {
          width: 46px;
          height: 46px;
          margin-bottom: 16px;
          border: 4px solid #e7ebf3;
          border-top-color: #0a2e73;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .mobileList {
          display: none;
        }

        @media (max-width: 1100px) {
          .statsGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 850px) {
          .header {
            align-items: flex-start;
            flex-direction: column;
          }

          .headerActions {
            width: 100%;
          }

          .headerActions button {
            flex: 1;
          }

          .filterGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .tableWrapper {
            display: none;
          }

          .mobileList {
            display: block;
            padding: 13px;
            background: #f8fafc;
          }

          .mobileCard {
            margin-bottom: 12px;
            padding: 13px;
            border: 1px solid #e4e7ec;
            border-radius: 13px;
            background: white;
          }

          .mobileTop {
            display: flex;
            justify-content: space-between;
            margin-bottom: 9px;
          }

          .mobileMain {
            display: flex;
            gap: 12px;
          }

          .mobileImage {
            width: 78px;
            height: 88px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            border-radius: 10px;
            background: #0a2e73;
            color: #d4af37;
            font-weight: 900;
          }

          .mobileImage img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .mobileMain h3 {
            margin: 0;
            font-size: 15px;
          }

          .mobileMain p {
            margin: 5px 0;
            color: #667085;
            font-size: 12px;
          }

          .mobileMain strong,
          .mobileMain small {
            display: block;
          }

          .mobileMain strong {
            color: #0a2e73;
          }

          .mobileMain small {
            margin-top: 5px;
            color: #667085;
          }

          .mobileActions {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 7px;
            margin-top: 12px;
          }

          .mobileActions button:first-child {
            border: 1px solid #b9c8eb;
            background: #eef3ff;
            color: #0a2e73;
          }

          .mobileActions button:nth-child(2) {
            border: 1px solid #f1d26a;
            background: #fff9e8;
            color: #8a6500;
          }
        }

        @media (max-width: 620px) {
          .page {
            padding: 17px 10px 40px;
          }

          .statsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .filterGrid {
            grid-template-columns: 1fr;
          }

          .filterFooter,
          .bulkBar {
            align-items: flex-start;
            flex-direction: column;
          }

          .bulkBar > div {
            width: 100%;
          }

          .bulkBar button {
            flex: 1;
          }
        }
      `}</style>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <article className="statCard">
      <div className="statIcon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
