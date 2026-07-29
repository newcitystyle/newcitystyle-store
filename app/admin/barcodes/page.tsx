"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import JsBarcode from "jsbarcode";

type ProductRow = {
  id: number;
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  price?: number | string | null;
  mrp?: number | string | null;
  stock?: number | string | null;
  barcode?: string | null;
  sku?: string | null;
  image?: string | null;
  image_url?: string | null;
  sell_online?: boolean | null;
  online_stock_limit?: number | string | null;
  is_active?: boolean | null;
  status?: string | null;
};

type VariantRow = {
  id: number;
  product_id: number;
  size?: string | null;
  color?: string | null;
  barcode?: string | null;
  sku?: string | null;
  stock?: number | string | null;
  mrp?: number | string | null;
  selling_price?: number | string | null;
  sell_online?: boolean | null;
  online_stock_limit?: number | string | null;
  is_active?: boolean | null;
};

type BarcodeItem = {
  key: string;
  productId: number;
  variantId: number | null;
  name: string;
  category: string;
  size: string;
  color: string;
  barcode: string;
  sku: string;
  stock: number;
  mrp: number;
  sellingPrice: number;
  sellOnline: boolean;
  onlineStock: number;
  imageUrl: string;
};

type StockFilter = "all" | "in-stock" | "low-stock" | "out-of-stock";
type OnlineFilter = "all" | "online" | "offline";

const ROYAL_BLUE = "#0A2E73";
const DEEP_BLUE = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";

function toNumber(value: number | string | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getImage(product: ProductRow) {
  return product.image_url?.trim() || product.image?.trim() || "";
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] || character,
  );
}

export default function BarcodesPage() {
  const router = useRouter();
  const previewSvgRef = useRef<SVGSVGElement | null>(null);

  const [items, setItems] = useState<BarcodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [onlineFilter, setOnlineFilter] = useState<OnlineFilter>("all");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const [previewItem, setPreviewItem] = useState<BarcodeItem | null>(null);
  const [labelSize, setLabelSize] = useState("tsc-te244-2up");
  const [showMrp, setShowMrp] = useState(true);
  const [copies, setCopies] = useState(1);

  const loadItems = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");

    try {
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select(
          [
            "id",
            "name",
            "category",
            "subcategory",
            "price",
            "mrp",
            "stock",
            "barcode",
            "sku",
            "image",
            "image_url",
            "sell_online",
            "online_stock_limit",
            "is_active",
            "status",
          ].join(","),
        )
        .order("created_at", { ascending: false });

      if (productError) throw productError;

      const { data: variantData, error: variantError } = await supabase
        .from("product_variants")
        .select(
          [
            "id",
            "product_id",
            "size",
            "color",
            "barcode",
            "sku",
            "stock",
            "mrp",
            "selling_price",
            "sell_online",
            "online_stock_limit",
            "is_active",
          ].join(","),
        );

      if (variantError) {
        console.warn("Variants could not be loaded:", variantError.message);
      }

      const products = (productData || []) as unknown as ProductRow[];
      const variants = (variantData || []) as unknown as VariantRow[];

      const variantsByProduct = new Map<number, VariantRow[]>();

      variants.forEach((variant) => {
        if (variant.is_active === false) return;

        const current = variantsByProduct.get(variant.product_id) || [];
        current.push(variant);
        variantsByProduct.set(variant.product_id, current);
      });

      const mapped: BarcodeItem[] = [];

      products.forEach((product) => {
        if (
          product.is_active === false ||
          normalize(product.status) === "inactive"
        ) {
          return;
        }

        const productId = Number(product.id);
        const productVariants = variantsByProduct.get(productId) || [];
        const name = product.name?.trim() || "NEW CITY STYLE Product";
        const category =
          product.category?.trim() ||
          product.subcategory?.trim() ||
          "Others";
        const imageUrl = getImage(product);

        if (productVariants.length > 0) {
          productVariants.forEach((variant) => {
            mapped.push({
              key: `variant-${variant.id}`,
              productId,
              variantId: variant.id,
              name,
              category,
              size: variant.size?.trim() || "",
              color: variant.color?.trim() || "",
              barcode:
                variant.barcode?.trim() || product.barcode?.trim() || "",
              sku: variant.sku?.trim() || product.sku?.trim() || "",
              stock: Math.max(0, toNumber(variant.stock)),
              mrp:
                toNumber(variant.mrp) ||
                toNumber(product.mrp) ||
                toNumber(product.price),
              sellingPrice:
                toNumber(variant.selling_price) || toNumber(product.price),
              sellOnline: variant.sell_online === true,
              onlineStock: Math.max(0, toNumber(variant.online_stock_limit)),
              imageUrl,
            });
          });

          return;
        }

        mapped.push({
          key: `product-${productId}`,
          productId,
          variantId: null,
          name,
          category,
          size: "",
          color: "",
          barcode: product.barcode?.trim() || "",
          sku: product.sku?.trim() || "",
          stock: Math.max(0, toNumber(product.stock)),
          mrp: toNumber(product.mrp) || toNumber(product.price),
          sellingPrice: toNumber(product.price),
          sellOnline: product.sell_online === true,
          onlineStock: Math.max(0, toNumber(product.online_stock_limit)),
          imageUrl,
        });
      });

      setItems(mapped);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load barcodes.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!previewItem?.barcode || !previewSvgRef.current) return;

    try {
      JsBarcode(previewSvgRef.current, previewItem.barcode, {
        format: "CODE128",
        width: 2,
        height: 48,
        displayValue: true,
        fontSize: 12,
        margin: 4,
        background: "#FFFFFF",
        lineColor: "#000000",
      });
    } catch (error) {
      console.error("Barcode preview error:", error);
    }
  }, [previewItem]);

  const duplicateBarcodeSet = useMemo(() => {
    const counts = new Map<string, number>();

    items.forEach((item) => {
      const barcode = item.barcode.trim();
      if (!barcode) return;
      counts.set(barcode, (counts.get(barcode) || 0) + 1);
    });

    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([barcode]) => barcode),
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = normalize(searchQuery);

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.name,
          item.category,
          item.size,
          item.color,
          item.barcode,
          item.sku,
          String(item.productId),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "in-stock" && item.stock > 5) ||
        (stockFilter === "low-stock" && item.stock > 0 && item.stock <= 5) ||
        (stockFilter === "out-of-stock" && item.stock <= 0);

      const matchesOnline =
        onlineFilter === "all" ||
        (onlineFilter === "online" && item.sellOnline) ||
        (onlineFilter === "offline" && !item.sellOnline);

      return matchesSearch && matchesStock && matchesOnline;
    });
  }, [items, onlineFilter, searchQuery, stockFilter]);

  const allVisibleSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedKeys.includes(item.key));

  const statistics = useMemo(() => {
    return {
      total: items.length,
      missingBarcode: items.filter((item) => !item.barcode).length,
      duplicates: duplicateBarcodeSet.size,
      outOfStock: items.filter((item) => item.stock <= 0).length,
      online: items.filter((item) => item.sellOnline).length,
    };
  }, [duplicateBarcodeSet, items]);

  function toggleItem(key: string) {
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key],
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visibleKeys = new Set(filteredItems.map((item) => item.key));
      setSelectedKeys((current) =>
        current.filter((key) => !visibleKeys.has(key)),
      );
      return;
    }

    setSelectedKeys((current) => {
      const next = new Set(current);
      filteredItems.forEach((item) => next.add(item.key));
      return Array.from(next);
    });
  }

  function buildBarcodeSvg(barcode: string) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    JsBarcode(svg, barcode, {
      format: "CODE128",
      width: 2,
      height: 48,
      displayValue: true,
      fontSize: 12,
      margin: 4,
      background: "#FFFFFF",
      lineColor: "#000000",
    });

    return svg.outerHTML;
  }

  function printItems(selectedItems: BarcodeItem[], copyCount = 1) {
    const printableItems = selectedItems.filter((item) => item.barcode);

    if (printableItems.length === 0) {
      setNotice("Select at least one product with a barcode.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    const labelSizes: Record<
      string,
      { pageWidth: number; pageHeight: number; labelWidth: number; columns: number }
    > = {
      "38x25": { pageWidth: 38, pageHeight: 25, labelWidth: 38, columns: 1 },
      "50x25": { pageWidth: 50, pageHeight: 25, labelWidth: 50, columns: 1 },
      "50x30": { pageWidth: 50, pageHeight: 30, labelWidth: 50, columns: 1 },
      "60x40": { pageWidth: 60, pageHeight: 40, labelWidth: 60, columns: 1 },
      "tsc-te244-2up": {
        pageWidth: 100,
        pageHeight: 30,
        labelWidth: 49,
        columns: 2,
      },
    };

    const selectedSize = labelSizes[labelSize] || labelSizes["tsc-te244-2up"];
    const safeCopies = Math.max(1, Math.min(500, Math.floor(copyCount)));

    const labelList = printableItems.flatMap((item) =>
      Array.from({ length: safeCopies }, () => {
        const sizeText = item.size?.trim() ? `SIZE: ${item.size.trim()}` : "";
        const svg = buildBarcodeSvg(item.barcode);

        return `
          <div class="label">
            <p class="store">NEW CITY STYLE</p>
            <p class="product">${escapeHtml(item.name)}</p>
            ${sizeText ? `<p class="variant">${escapeHtml(sizeText)}</p>` : ""}
            <div class="barcode">${svg}</div>
            <div class="priceRow">
              ${
                showMrp && item.mrp > 0
                  ? `<span>MRP ₹${item.mrp.toFixed(2)}</span>`
                  : ""
              }
            </div>
          </div>
        `;
      }),
    );

    const sheets: string[] = [];

    for (let index = 0; index < labelList.length; index += selectedSize.columns) {
      const rowLabels = labelList.slice(index, index + selectedSize.columns);

      while (rowLabels.length < selectedSize.columns) {
        rowLabels.push('<div class="label emptyLabel"></div>');
      }

      sheets.push(`<div class="sheet">${rowLabels.join("")}</div>`);
    }

    const labels = sheets.join("");

    const printWindow = window.open("", "_blank", "width=760,height=760");

    if (!printWindow) {
      setNotice("Allow browser pop-ups to print labels.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>NEW CITY STYLE Barcodes</title>
          <style>
            @page {
              size: ${selectedSize.pageWidth}mm ${selectedSize.pageHeight}mm;
              margin: 0;
            }

            * { box-sizing: border-box; }

            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              font-family: Arial, sans-serif;
            }

            .sheet {
              width: ${selectedSize.pageWidth}mm;
              height: ${selectedSize.pageHeight}mm;
              display: flex;
              align-items: stretch;
              justify-content: flex-start;
              gap: ${selectedSize.columns === 2 ? 2 : 0}mm;
              overflow: hidden;
              page-break-after: always;
              break-after: page;
            }

            .sheet:last-child {
              page-break-after: auto;
              break-after: auto;
            }

            .label {
              width: ${selectedSize.labelWidth}mm;
              height: ${selectedSize.pageHeight}mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              flex: 0 0 ${selectedSize.labelWidth}mm;
              padding: 0.7mm 1mm;
              overflow: hidden;
              color: #000;
              text-align: center;
            }

            .emptyLabel {
              visibility: hidden;
            }

            .store {
              margin: 0 0 .25mm;
              font-size: ${selectedSize.labelWidth <= 38 ? 7 : 8}px;
              font-weight: 900;
              letter-spacing: .7px;
            }

            .product {
              width: 100%;
              margin: 0;
              overflow: hidden;
              font-size: ${selectedSize.labelWidth <= 38 ? 7 : 8}px;
              font-weight: 700;
              line-height: 1.15;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .variant {
              margin: .2mm 0 0;
              padding: .35mm 1.2mm;
              border: 1px solid #000;
              border-radius: 1mm;
              font-size: ${selectedSize.labelWidth <= 38 ? 7 : 8}px;
              font-weight: 900;
              letter-spacing: .3px;
            }

            .barcode {
              width: 100%;
              margin-top: .15mm;
            }

            .barcode svg {
              width: 100%;
              height: ${selectedSize.pageHeight <= 25 ? 10 : 11.5}mm;
              display: block;
            }

            .priceRow {
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 2mm;
              margin-top: .1mm;
              padding-bottom: .4mm;
              font-size: ${selectedSize.labelWidth <= 38 ? 9 : 11}px;
              font-weight: 950;
              line-height: 1;
              white-space: nowrap;
            }
          </style>
        </head>
        <body>
          ${labels}
          <script>
            window.onload = function () {
              window.print();
              window.onafterprint = function () {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  function printSelected() {
    const selectedItems = items.filter((item) =>
      selectedKeys.includes(item.key),
    );
    printItems(selectedItems, copies);
  }

  function printSingle(item: BarcodeItem) {
    printItems([item], copies);
  }

  return (
    <main className="barcodePage">
      <section className="pageHeader">
        <div>
          <span>NEW CITY STYLE • INVENTORY</span>
          <h1>Barcodes & Stock</h1>
          <p>
            Search products, check stock, detect duplicate barcodes and print
            labels.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadItems(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "↻ Refresh"}
        </button>
      </section>

      {notice && <div className="notice">{notice}</div>}
      {errorMessage && <div className="error">{errorMessage}</div>}

      <section className="statsGrid">
        <article>
          <span>Total Barcode Items</span>
          <strong>{statistics.total}</strong>
        </article>

        <article>
          <span>Missing Barcode</span>
          <strong>{statistics.missingBarcode}</strong>
        </article>

        <article>
          <span>Duplicate Codes</span>
          <strong>{statistics.duplicates}</strong>
        </article>

        <article>
          <span>Out of Stock</span>
          <strong>{statistics.outOfStock}</strong>
        </article>

        <article>
          <span>Sell Online</span>
          <strong>{statistics.online}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="toolbar">
          <div className="searchBox">
            <span>⌕</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search product, barcode, SKU, size..."
            />
          </div>

          <select
            value={stockFilter}
            onChange={(event) =>
              setStockFilter(event.target.value as StockFilter)
            }
          >
            <option value="all">All Stock</option>
            <option value="in-stock">In Stock</option>
            <option value="low-stock">Low Stock</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>

          <select
            value={onlineFilter}
            onChange={(event) =>
              setOnlineFilter(event.target.value as OnlineFilter)
            }
          >
            <option value="all">All Visibility</option>
            <option value="online">Sell Online</option>
            <option value="offline">Shop Only</option>
          </select>
        </div>

        <div className="printBar">
          <label>
            <span>Copies</span>
            <input
              type="number"
              min="1"
              max="500"
              value={copies}
              onChange={(event) =>
                setCopies(
                  Math.max(
                    1,
                    Math.min(500, Math.floor(toNumber(event.target.value, 1))),
                  ),
                )
              }
            />
          </label>

          <label>
            <span>Label Size</span>
            <select
              value={labelSize}
              onChange={(event) => setLabelSize(event.target.value)}
            >
              <option value="tsc-te244-2up">
                TSC TE244 — 2 Labels (50 × 30)
              </option>
              <option value="38x25">38 × 25 mm — Single</option>
              <option value="50x25">50 × 25 mm — Single</option>
              <option value="50x30">50 × 30 mm — Single</option>
              <option value="60x40">60 × 40 mm — Single</option>
            </select>
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={showMrp}
              onChange={(event) => setShowMrp(event.target.checked)}
            />
            MRP
          </label>

          <button
            type="button"
            className="printSelected"
            onClick={printSelected}
            disabled={selectedKeys.length === 0}
          >
            🖨 Print Selected ({selectedKeys.length})
          </button>
        </div>

        {loading ? (
          <div className="loadingState">
            <div className="spinner" />
            <h2>Loading barcodes...</h2>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="emptyState">
            <h2>No matching products</h2>
            <p>Try changing the search or filters.</p>
          </div>
        ) : (
          <>
            <div className="selectAll">
              <label>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                />
                Select all visible ({filteredItems.length})
              </label>

              <button
                type="button"
                onClick={() => setSelectedKeys([])}
                disabled={selectedKeys.length === 0}
              >
                Clear Selection
              </button>
            </div>

            <div className="desktopTable">
              <table>
                <thead>
                  <tr>
                    <th />
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>Stock</th>
                    <th>MRP</th>
                    <th>Online</th>
                    <th>Photo</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.map((item) => {
                    const duplicate =
                      item.barcode && duplicateBarcodeSet.has(item.barcode);

                    return (
                      <tr key={item.key}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedKeys.includes(item.key)}
                            onChange={() => toggleItem(item.key)}
                          />
                        </td>

                        <td>
                          <div className="productCell">
                            <div className="image">
                              {item.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.imageUrl} alt={item.name} />
                              ) : (
                                <span>NCS</span>
                              )}
                            </div>

                            <div>
                              <strong>{item.name}</strong>
                              <span>{item.category}</span>
                              {(item.size || item.color) && (
                                <span>
                                  {[item.size, item.color]
                                    .filter(Boolean)
                                    .join(" • ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="barcodeCell">
                            <strong>{item.barcode || "Missing"}</strong>
                            {item.sku && <span>SKU: {item.sku}</span>}
                            {duplicate && (
                              <b>Duplicate barcode warning</b>
                            )}
                          </div>
                        </td>

                        <td>
                          <span
                            className={`stockBadge ${
                              item.stock <= 0
                                ? "out"
                                : item.stock <= 5
                                  ? "low"
                                  : "good"
                            }`}
                          >
                            {item.stock}
                          </span>
                        </td>

                        <td>{formatCurrency(item.mrp)}</td>

                        <td>
                          <span
                            className={
                              item.sellOnline
                                ? "onlineBadge"
                                : "offlineBadge"
                            }
                          >
                            {item.sellOnline
                              ? `Online (${item.onlineStock})`
                              : "Shop Only"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              item.imageUrl ? "photoYes" : "photoNo"
                            }
                          >
                            {item.imageUrl ? "Photo Added" : "No Photo"}
                          </span>
                        </td>

                        <td>
                          <div className="actions">
                            <button
                              type="button"
                              onClick={() => setPreviewItem(item)}
                              disabled={!item.barcode}
                            >
                              Preview
                            </button>

                            <button
                              type="button"
                              onClick={() => printSingle(item)}
                              disabled={!item.barcode}
                            >
                              Print
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/admin/products/edit/${item.productId}`,
                                )
                              }
                            >
                              Edit
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
              {filteredItems.map((item) => {
                const duplicate =
                  item.barcode && duplicateBarcodeSet.has(item.barcode);

                return (
                  <article key={item.key} className="mobileCard">
                    <div className="mobileTop">
                      <input
                        type="checkbox"
                        checked={selectedKeys.includes(item.key)}
                        onChange={() => toggleItem(item.key)}
                      />

                      <span
                        className={
                          item.sellOnline ? "onlineBadge" : "offlineBadge"
                        }
                      >
                        {item.sellOnline ? "Online" : "Shop Only"}
                      </span>
                    </div>

                    <div className="mobileProduct">
                      <div className="image">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt={item.name} />
                        ) : (
                          <span>NCS</span>
                        )}
                      </div>

                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.category}</span>
                        <span>
                          {[item.size, item.color].filter(Boolean).join(" • ") ||
                            "Standard Product"}
                        </span>
                      </div>
                    </div>

                    <div className="mobileInfo">
                      <p>
                        <span>Barcode</span>
                        <strong>{item.barcode || "Missing"}</strong>
                      </p>

                      <p>
                        <span>Stock</span>
                        <strong>{item.stock}</strong>
                      </p>

                      <p>
                        <span>MRP</span>
                        <strong>{formatCurrency(item.mrp)}</strong>
                      </p>

                      <p>
                        <span>Photo</span>
                        <strong>{item.imageUrl ? "Added" : "Missing"}</strong>
                      </p>
                    </div>

                    {duplicate && (
                      <div className="duplicateWarning">
                        Duplicate barcode warning
                      </div>
                    )}

                    <div className="mobileActions">
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        disabled={!item.barcode}
                      >
                        Preview
                      </button>

                      <button
                        type="button"
                        onClick={() => printSingle(item)}
                        disabled={!item.barcode}
                      >
                        Print
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/admin/products/edit/${item.productId}`)
                        }
                      >
                        Edit
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {previewItem && (
        <div className="modalOverlay">
          <section className="previewModal">
            <button
              type="button"
              className="close"
              onClick={() => setPreviewItem(null)}
            >
              ×
            </button>

            <span>BARCODE PREVIEW</span>
            <h2>{previewItem.name}</h2>
            <p>
              {[previewItem.size, previewItem.color]
                .filter(Boolean)
                .join(" • ") || "Standard Product"}
            </p>

            <div className="barcodePreview">
              <svg ref={previewSvgRef} />
            </div>

            <strong>{previewItem.barcode}</strong>

            <div className="previewActions">
              <button type="button" onClick={() => printSingle(previewItem)}>
                🖨 Print Label
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(`/admin/products/edit/${previewItem.productId}`)
                }
              >
                Edit Product
              </button>
            </div>
          </section>
        </div>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .barcodePage {
          min-height: 100vh;
          padding: 26px;
          background:
            radial-gradient(
              circle at 10% 0%,
              rgba(212, 175, 55, 0.12),
              transparent 26%
            ),
            ${IVORY};
          color: #2c2c2c;
          font-family: Poppins, Inter, Arial, sans-serif;
        }

        .pageHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
          padding: 22px 24px;
          border: 1px solid rgba(212, 175, 55, 0.35);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 88% 0%,
              rgba(212, 175, 55, 0.23),
              transparent 32%
            ),
            linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: white;
          box-shadow: 0 18px 45px rgba(3, 21, 63, 0.18);
        }

        .pageHeader > div > span {
          color: ${GOLD};
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .pageHeader h1 {
          margin: 5px 0 0;
          font-size: 32px;
          font-weight: 950;
        }

        .pageHeader p {
          margin: 6px 0 0;
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
        }

        .pageHeader button {
          min-height: 44px;
          padding: 0 15px;
          border: 1px solid ${GOLD};
          border-radius: 12px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-weight: 900;
          cursor: pointer;
        }

        .notice,
        .error {
          margin-bottom: 14px;
          padding: 13px 15px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 750;
        }

        .notice {
          border: 1px solid #a6f4c5;
          background: #ecfdf3;
          color: #067647;
        }

        .error {
          border: 1px solid #fecdca;
          background: #fef3f2;
          color: #b42318;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .statsGrid article {
          position: relative;
          isolation: isolate;
          min-height: 108px;
          overflow: hidden;
          padding: 18px;
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 18px;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.99),
            rgba(3, 21, 63, 0.98)
          );
          box-shadow:
            0 12px 28px rgba(3, 21, 63, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          transition:
            transform 0.22s ease,
            box-shadow 0.22s ease,
            border-color 0.22s ease;
          animation: barcodeStatRise 0.45s ease both;
        }

        .statsGrid article:nth-child(1) {
          animation-delay: 0.04s;
        }

        .statsGrid article:nth-child(2) {
          animation-delay: 0.09s;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.99),
            rgba(18, 44, 101, 0.98),
            rgba(103, 79, 16, 0.9)
          );
        }

        .statsGrid article:nth-child(3) {
          animation-delay: 0.14s;
          background: linear-gradient(
            135deg,
            rgba(5, 25, 74, 0.99),
            rgba(8, 37, 96, 0.98)
          );
        }

        .statsGrid article:nth-child(4) {
          animation-delay: 0.19s;
          background: linear-gradient(
            135deg,
            rgba(8, 37, 98, 0.99),
            rgba(3, 21, 63, 0.98),
            rgba(95, 72, 13, 0.9)
          );
        }

        .statsGrid article:nth-child(5) {
          animation-delay: 0.24s;
        }

        .statsGrid article::before {
          content: "";
          position: absolute;
          z-index: -1;
          top: -42%;
          right: -18%;
          width: 126px;
          height: 126px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(212, 175, 55, 0.34),
            rgba(212, 175, 55, 0)
          );
          transition: transform 0.28s ease;
        }

        .statsGrid article::after {
          content: "";
          position: absolute;
          top: -145%;
          left: -36%;
          width: 42%;
          height: 370%;
          transform: rotate(22deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.14),
            transparent
          );
          animation: barcodeStatShine 5.2s ease-in-out infinite;
          pointer-events: none;
        }

        .statsGrid article:nth-child(2)::after {
          animation-delay: 0.7s;
        }

        .statsGrid article:nth-child(3)::after {
          animation-delay: 1.4s;
        }

        .statsGrid article:nth-child(4)::after {
          animation-delay: 2.1s;
        }

        .statsGrid article:nth-child(5)::after {
          animation-delay: 2.8s;
        }

        .statsGrid article:hover {
          transform: translateY(-2px) scale(1.004);
          border-color: rgba(212, 175, 55, 0.42);
          box-shadow:
            0 16px 32px rgba(3, 21, 63, 0.22),
            0 0 0 1px rgba(212, 175, 55, 0.1);
        }

        .statsGrid article:hover::before {
          transform: scale(1.08);
        }

        .statsGrid span {
          position: relative;
          z-index: 2;
          display: block;
          color: rgba(212, 175, 55, 0.94);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.55px;
          text-transform: uppercase;
        }

        .statsGrid strong {
          position: relative;
          z-index: 2;
          display: block;
          margin-top: 9px;
          color: #ffffff;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -0.45px;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
        }

        .statsGrid article:nth-child(2) strong,
        .statsGrid article:nth-child(4) strong {
          color: #f6d676;
        }

        .panel {
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 20px;
          background: white;
          box-shadow: 0 12px 32px rgba(10, 46, 115, 0.07);
        }

        .toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 190px 190px;
          gap: 10px;
          padding: 16px;
          border-bottom: 1px solid #edf0f4;
        }

        .searchBox {
          display: flex;
          align-items: center;
          min-height: 46px;
          padding: 0 12px;
          border: 1px solid #dfe4eb;
          border-radius: 11px;
          background: #fbfcfe;
        }

        .searchBox span {
          margin-right: 8px;
          color: ${ROYAL_BLUE};
          font-size: 21px;
        }

        .searchBox input,
        .toolbar select,
        .printBar input,
        .printBar select {
          width: 100%;
          min-height: 43px;
          border: 1px solid #dfe4eb;
          border-radius: 10px;
          outline: none;
          background: white;
          font: inherit;
          font-size: 11px;
          font-weight: 700;
        }

        .searchBox input {
          min-height: auto;
          padding: 0;
          border: 0;
          background: transparent;
        }

        .toolbar select,
        .printBar input,
        .printBar select {
          padding: 0 10px;
        }

        .printBar {
          display: flex;
          align-items: end;
          gap: 10px;
          padding: 13px 16px;
          border-bottom: 1px solid #edf0f4;
          background: #f8fafc;
        }

        .printBar label {
          display: grid;
          gap: 5px;
        }

        .printBar label > span {
          color: #667085;
          font-size: 9px;
          font-weight: 800;
        }

        .printBar .check {
          min-height: 43px;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 0 11px;
          border: 1px solid #dfe4eb;
          border-radius: 10px;
          background: white;
          font-size: 10px;
          font-weight: 800;
        }

        .printBar .check input {
          width: 16px;
          min-height: auto;
          height: 16px;
          accent-color: ${ROYAL_BLUE};
        }

        .printSelected {
          min-height: 43px;
          margin-left: auto;
          padding: 0 16px;
          border: 1px solid rgba(212, 175, 55, 0.9);
          border-radius: 11px;
          background: linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: #ffffff;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(3, 21, 63, 0.16);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            filter 0.2s ease;
        }

        .printSelected:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 14px 28px rgba(3, 21, 63, 0.22);
          filter: brightness(1.06);
        }

        .printSelected:disabled,
        button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .selectAll {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid #edf0f4;
          background: #fffdf5;
        }

        .selectAll label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #475467;
          font-size: 11px;
          font-weight: 800;
        }

        .selectAll input {
          width: 17px;
          height: 17px;
          accent-color: ${ROYAL_BLUE};
        }

        .selectAll button {
          min-height: 34px;
          padding: 0 10px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: white;
          color: #475467;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .desktopTable {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1180px;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 12px;
          border-bottom: 1px solid #f0f1f3;
          text-align: left;
          vertical-align: middle;
        }

        th {
          background: #f8fafc;
          color: #667085;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
        }

        td {
          color: #344054;
          font-size: 11px;
        }

        .productCell {
          min-width: 230px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .image {
          width: 56px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
          border-radius: 10px;
          background: ${ROYAL_BLUE};
          color: ${GOLD};
          font-size: 10px;
          font-weight: 950;
        }

        .image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .productCell strong,
        .productCell span {
          display: block;
        }

        .productCell strong {
          color: ${DEEP_BLUE};
          font-size: 11px;
        }

        .productCell span {
          margin-top: 3px;
          color: #8a93a0;
          font-size: 9px;
        }

        .barcodeCell strong,
        .barcodeCell span,
        .barcodeCell b {
          display: block;
        }

        .barcodeCell strong {
          color: ${ROYAL_BLUE};
          font-size: 11px;
        }

        .barcodeCell span {
          margin-top: 3px;
          color: #8a93a0;
          font-size: 9px;
        }

        .barcodeCell b,
        .duplicateWarning {
          margin-top: 5px;
          color: #b42318;
          font-size: 9px;
        }

        .stockBadge,
        .onlineBadge,
        .offlineBadge,
        .photoYes,
        .photoNo {
          display: inline-flex;
          padding: 6px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 850;
          white-space: nowrap;
        }

        .stockBadge.good,
        .onlineBadge,
        .photoYes {
          background: #ecfdf3;
          color: #067647;
        }

        .stockBadge.low {
          background: #fff4e8;
          color: #b54708;
        }

        .stockBadge.out,
        .photoNo {
          background: #fef3f2;
          color: #b42318;
        }

        .offlineBadge {
          background: #f2f4f7;
          color: #667085;
        }

        .actions {
          display: flex;
          gap: 6px;
        }

        .actions button,
        .mobileActions button {
          min-height: 34px;
          padding: 0 10px;
          border: 1px solid rgba(10, 46, 115, 0.16);
          border-radius: 9px;
          background: linear-gradient(180deg, #ffffff, #f6f8fc);
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            border-color 0.18s ease;
        }

        .actions button:hover:not(:disabled),
        .mobileActions button:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(212, 175, 55, 0.58);
          box-shadow: 0 8px 18px rgba(3, 21, 63, 0.1);
        }

        .actions button:nth-child(2),
        .mobileActions button:nth-child(2) {
          border-color: rgba(212, 175, 55, 0.65);
          background: linear-gradient(135deg, ${GOLD}, #f0d267);
          color: ${DEEP_BLUE};
        }

        .mobileList {
          display: none;
        }

        .loadingState,
        .emptyState {
          min-height: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          text-align: center;
        }

        .spinner {
          width: 43px;
          height: 43px;
          border: 4px solid #e6eaf0;
          border-top-color: ${ROYAL_BLUE};
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loadingState h2,
        .emptyState h2 {
          margin: 14px 0 0;
          color: ${ROYAL_BLUE};
          font-size: 19px;
        }

        .emptyState p {
          color: #667085;
        }

        .modalOverlay {
          position: fixed;
          z-index: 1000;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(3, 21, 63, 0.68);
        }

        .previewModal {
          position: relative;
          width: min(460px, 100%);
          padding: 25px;
          border: 1px solid rgba(212, 175, 55, 0.4);
          border-radius: 20px;
          background: white;
          text-align: center;
          box-shadow: 0 28px 70px rgba(3, 21, 63, 0.28);
        }

        .previewModal > span {
          color: ${GOLD};
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .previewModal h2 {
          margin: 8px 0 0;
          color: ${ROYAL_BLUE};
        }

        .previewModal p {
          color: #667085;
          font-size: 11px;
        }

        .close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 34px;
          height: 34px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: white;
          font-size: 20px;
          cursor: pointer;
        }

        .barcodePreview {
          margin: 18px 0 8px;
          padding: 12px;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
          background: white;
        }

        .barcodePreview svg {
          width: 100%;
          height: auto;
        }

        .previewActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 18px;
        }

        .previewActions button {
          min-height: 42px;
          border: 1px solid ${GOLD};
          border-radius: 10px;
          background: ${ROYAL_BLUE};
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes barcodeStatRise {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes barcodeStatShine {
          0%,
          62% {
            left: -42%;
            opacity: 0;
          }
          68% {
            opacity: 0.7;
          }
          100% {
            left: 126%;
            opacity: 0;
          }
        }

        @media (max-width: 1100px) {
          .statsGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .toolbar {
            grid-template-columns: 1fr 1fr;
          }

          .searchBox {
            grid-column: 1 / -1;
          }

          .printBar {
            flex-wrap: wrap;
          }

          .printSelected {
            margin-left: 0;
          }
        }

        @media (max-width: 900px) {
          .barcodePage {
            padding: 16px 10px 40px;
          }

          .pageHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .pageHeader button {
            width: 100%;
          }

          .statsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .toolbar {
            grid-template-columns: 1fr;
          }

          .searchBox {
            grid-column: auto;
          }

          .printBar {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .printSelected {
            grid-column: 1 / -1;
          }

          .desktopTable {
            display: none;
          }

          .mobileList {
            display: grid;
            gap: 12px;
            padding: 12px;
            background: #f8fafc;
          }

          .mobileCard {
            padding: 13px;
            border: 1px solid #e4e7ec;
            border-radius: 15px;
            background: white;
          }

          .mobileTop {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .mobileTop input {
            width: 17px;
            height: 17px;
            accent-color: ${ROYAL_BLUE};
          }

          .mobileProduct {
            display: flex;
            align-items: center;
            gap: 11px;
            margin-top: 11px;
          }

          .mobileProduct strong,
          .mobileProduct span {
            display: block;
          }

          .mobileProduct strong {
            color: ${DEEP_BLUE};
            font-size: 12px;
          }

          .mobileProduct span {
            margin-top: 4px;
            color: #8a93a0;
            font-size: 9px;
          }

          .mobileInfo {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-top: 12px;
            padding: 10px;
            border-radius: 11px;
            background: #f8fafc;
          }

          .mobileInfo p {
            margin: 0;
          }

          .mobileInfo span,
          .mobileInfo strong {
            display: block;
          }

          .mobileInfo span {
            color: #98a2b3;
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
          }

          .mobileInfo strong {
            margin-top: 3px;
            color: #344054;
            font-size: 10px;
          }

          .mobileActions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
            margin-top: 11px;
          }
        }

        @media (max-width: 560px) {
          .statsGrid {
            grid-template-columns: 1fr 1fr;
          }

          .printBar {
            grid-template-columns: 1fr;
          }

          .printSelected {
            grid-column: auto;
          }

          .mobileActions {
            grid-template-columns: 1fr;
          }

          .previewActions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}