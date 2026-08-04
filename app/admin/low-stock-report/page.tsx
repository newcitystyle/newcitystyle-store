"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ProductRow = {
  id: number | string;
  name: string | null;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  stock: number | string | null;
  low_stock_limit: number | string | null;
  sku: string | null;
  barcode: string | null;
  is_active: boolean | null;
  status: string | null;
};

type VariantRow = {
  id: number | string;
  product_id: number | string;
  variant_name: string | null;
  size: string | null;
  color: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number | string | null;
  reserved_stock: number | string | null;
  low_stock_limit: number | string | null;
  is_active: boolean | null;
};

type LowStockItem = {
  key: string;
  productId: number;
  variantId: number | null;
  productName: string;
  category: string;
  subcategory: string;
  brand: string;
  size: string;
  color: string;
  sku: string;
  barcode: string;
  stock: number;
  reservedStock: number;
  availableStock: number;
  lowStockLimit: number;
};

type StockFilter = "below5" | "below10" | "out" | "custom";

const ROYAL_BLUE = "#0A2E73";
const DEEP_BLUE = "#061D4A";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";
const CHARCOAL = "#2C2C2C";
const SOFT_GRAY = "#6F7280";
const SUCCESS = "#16834A";
const DANGER = "#B3261E";

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalize(value: unknown): string {
  return clean(value).toLowerCase();
}

function safeFileName(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "low-stock-report"
  );
}

function formatDateTime(date = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export default function LowStockReportPage() {
  const router = useRouter();

  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sizeFilter, setSizeFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState<StockFilter>("below5");
  const [customLimit, setCustomLimit] = useState(5);
  const [groupByBrand, setGroupByBrand] = useState(true);
  const [whatsAppSending, setWhatsAppSending] = useState(false);

  const loadLowStock = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      setErrorMessage("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          router.replace("/admin/login");
          return;
        }

        const [productsResponse, variantsResponse] = await Promise.all([
          supabase
            .from("products")
            .select(
              [
                "id",
                "name",
                "category",
                "subcategory",
                "brand",
                "stock",
                "low_stock_limit",
                "sku",
                "barcode",
                "is_active",
                "status",
              ].join(","),
            )
            .order("brand", { ascending: true })
            .order("name", { ascending: true }),

          supabase
            .from("product_variants")
            .select(
              [
                "id",
                "product_id",
                "variant_name",
                "size",
                "color",
                "sku",
                "barcode",
                "stock",
                "reserved_stock",
                "low_stock_limit",
                "is_active",
              ].join(","),
            )
            .eq("is_active", true),
        ]);

        if (productsResponse.error) throw productsResponse.error;

        if (variantsResponse.error) {
          console.info(
            "Product variants could not be loaded:",
            variantsResponse.error.message,
          );
        }

        const products = (productsResponse.data || []) as unknown as ProductRow[];
        const variants = variantsResponse.error
          ? []
          : ((variantsResponse.data || []) as unknown as VariantRow[]);

        const variantsByProduct = new Map<number, VariantRow[]>();

        variants.forEach((variant) => {
          const productId = numberValue(variant.product_id);
          const current = variantsByProduct.get(productId) || [];
          current.push(variant);
          variantsByProduct.set(productId, current);
        });

        const mapped: LowStockItem[] = [];

        products.forEach((product) => {
          if (
            product.is_active === false ||
            normalize(product.status) === "inactive"
          ) {
            return;
          }

          const productId = numberValue(product.id);
          const productName = clean(product.name, "NEW CITY STYLE Product");
          const category = clean(product.category, "Others");
          const subcategory = clean(product.subcategory);
          const brand = clean(product.brand, "NEW CITY STYLE");
          const productVariants = variantsByProduct.get(productId) || [];
          const productLimit = Math.max(
            0,
            Math.floor(numberValue(product.low_stock_limit) || 5),
          );

          if (productVariants.length > 0) {
            productVariants.forEach((variant) => {
              const stock = Math.max(0, numberValue(variant.stock));
              const reservedStock = Math.max(
                0,
                numberValue(variant.reserved_stock),
              );
              const availableStock = Math.max(0, stock - reservedStock);
              const lowStockLimit = Math.max(
                0,
                Math.floor(
                  numberValue(variant.low_stock_limit) || productLimit || 5,
                ),
              );

              mapped.push({
                key: `variant-${variant.id}`,
                productId,
                variantId: numberValue(variant.id),
                productName,
                category,
                subcategory,
                brand,
                size: clean(variant.size, "—"),
                color: clean(variant.color, "—"),
                sku: clean(variant.sku, clean(product.sku, "—")),
                barcode: clean(
                  variant.barcode,
                  clean(product.barcode, "—"),
                ),
                stock,
                reservedStock,
                availableStock,
                lowStockLimit,
              });
            });

            return;
          }

          const stock = Math.max(0, numberValue(product.stock));

          mapped.push({
            key: `product-${productId}`,
            productId,
            variantId: null,
            productName,
            category,
            subcategory,
            brand,
            size: "—",
            color: "—",
            sku: clean(product.sku, "—"),
            barcode: clean(product.barcode, "—"),
            stock,
            reservedStock: 0,
            availableStock: stock,
            lowStockLimit: productLimit,
          });
        });

        setItems(
          mapped.sort((a, b) => {
            if (a.availableStock !== b.availableStock) {
              return a.availableStock - b.availableStock;
            }

            const brandCompare = a.brand.localeCompare(b.brand);
            if (brandCompare !== 0) return brandCompare;

            const nameCompare = a.productName.localeCompare(b.productName);
            if (nameCompare !== 0) return nameCompare;

            return a.size.localeCompare(b.size);
          }),
        );
      } catch (error) {
        console.error("Unable to load low stock report:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load low stock report.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadLowStock();
  }, [loadLowStock]);

  useEffect(() => {
    let timer: number | null = null;

    const scheduleRefresh = () => {
      if (timer !== null) window.clearTimeout(timer);

      timer = window.setTimeout(() => {
        void loadLowStock(true);
        timer = null;
      }, 500);
    };

    const channel = supabase
      .channel("ncs-low-stock-report-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_variants",
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [loadLowStock]);

  const stockLimit = useMemo(() => {
    if (stockFilter === "below10") return 10;
    if (stockFilter === "custom") {
      return Math.max(0, Math.floor(customLimit || 0));
    }
    return 5;
  }, [customLimit, stockFilter]);

  const brands = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.brand))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  );

  const categories = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.category))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  );

  const sizes = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.size)
            .filter((value) => value && value !== "—"),
        ),
      ).sort((a, b) =>
        a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      ),
    [items],
  );

  const filteredItems = useMemo(() => {
    const query = normalize(search);

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.productName,
          item.brand,
          item.category,
          item.subcategory,
          item.size,
          item.color,
          item.sku,
          item.barcode,
        ]
          .map(normalize)
          .some((value) => value.includes(query));

      if (!matchesSearch) return false;
      if (brandFilter !== "ALL" && item.brand !== brandFilter) return false;
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
        return false;
      }
      if (sizeFilter !== "ALL" && item.size !== sizeFilter) return false;

      if (stockFilter === "out") return item.availableStock <= 0;

      return item.availableStock <= stockLimit;
    });
  }, [
    brandFilter,
    categoryFilter,
    items,
    search,
    sizeFilter,
    stockFilter,
    stockLimit,
  ]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, LowStockItem[]>();

    filteredItems.forEach((item) => {
      const key = groupByBrand ? item.brand : item.category;
      const current = groups.get(key) || [];
      current.push(item);
      groups.set(key, current);
    });

    return Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
  }, [filteredItems, groupByBrand]);

  const summary = useMemo(() => {
    const outOfStock = filteredItems.filter(
      (item) => item.availableStock <= 0,
    ).length;

    const critical = filteredItems.filter(
      (item) => item.availableStock > 0 && item.availableStock <= 2,
    ).length;

    const totalUnits = filteredItems.reduce(
      (sum, item) => sum + item.availableStock,
      0,
    );

    return {
      total: filteredItems.length,
      outOfStock,
      critical,
      totalUnits,
    };
  }, [filteredItems]);

  function stockStatus(item: LowStockItem) {
    if (item.availableStock <= 0) {
      return {
        label: "OUT OF STOCK",
        className: "danger",
      };
    }

    if (item.availableStock <= 2) {
      return {
        label: "CRITICAL",
        className: "critical",
      };
    }

    return {
      label: "LOW STOCK",
      className: "warning",
    };
  }

  function clearFilters() {
    setSearch("");
    setBrandFilter("ALL");
    setCategoryFilter("ALL");
    setSizeFilter("ALL");
    setStockFilter("below5");
    setCustomLimit(5);
  }

  async function downloadPdf() {
    if (filteredItems.length === 0) {
      window.alert("No low stock items are available for this filter.");
      return;
    }

    try {
      const { jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable =
        autoTableModule.default ||
        (autoTableModule as unknown as {
          autoTable: typeof autoTableModule.default;
        }).autoTable;

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();

      pdf.setFillColor(10, 46, 115);
      pdf.rect(0, 0, pageWidth, 30, "F");

      pdf.setTextColor(212, 175, 55);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("NEW CITY STYLE", 14, 12);

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.text("Style for Every Family", 14, 19);

      pdf.setFontSize(14);
      pdf.text("LOW STOCK REORDER REPORT", pageWidth - 14, 12, {
        align: "right",
      });

      pdf.setFontSize(8);
      pdf.text(
        `Generated: ${formatDateTime()}`,
        pageWidth - 14,
        19,
        {
          align: "right",
        },
      );

      pdf.setTextColor(44, 44, 44);
      pdf.setFontSize(9);

      const filterLabel =
        stockFilter === "out"
          ? "Out of Stock"
          : `Stock ${stockLimit} or Below`;

      pdf.text(
        `Filter: ${filterLabel}   |   Brand: ${
          brandFilter === "ALL" ? "All Brands" : brandFilter
        }   |   Category: ${
          categoryFilter === "ALL" ? "All Categories" : categoryFilter
        }`,
        14,
        37,
      );

      pdf.text(
        `Low Stock Lines: ${summary.total}   |   Out of Stock: ${
          summary.outOfStock
        }   |   Critical: ${summary.critical}`,
        14,
        43,
      );

      const body = filteredItems.map((item, index) => [
        index + 1,
        item.brand,
        item.productName,
        item.category,
        item.size,
        item.color,
        item.sku,
        item.availableStock,
        item.lowStockLimit,
        item.availableStock <= 0
          ? "OUT OF STOCK"
          : item.availableStock <= 2
            ? "CRITICAL"
            : "LOW STOCK",
      ]);

      autoTable(pdf, {
        startY: 48,
        head: [
          [
            "#",
            "Brand",
            "Product",
            "Category",
            "Size",
            "Colour",
            "SKU",
            "Stock",
            "Alert",
            "Status",
          ],
        ],
        body,
        theme: "grid",
        margin: {
          left: 14,
          right: 14,
          bottom: 16,
        },
        styles: {
          font: "helvetica",
          fontSize: 7.5,
          cellPadding: 2.2,
          textColor: [44, 44, 44],
          lineColor: [220, 220, 220],
        },
        headStyles: {
          fillColor: [10, 46, 115],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [248, 244, 236],
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 9 },
          7: { halign: "center", cellWidth: 13 },
          8: { halign: "center", cellWidth: 13 },
          9: { cellWidth: 23 },
        },
        didParseCell: (data) => {
          if (data.section !== "body" || data.column.index !== 9) return;

          const value = String(data.cell.raw || "");

          if (value === "OUT OF STOCK") {
            data.cell.styles.textColor = [179, 38, 30];
            data.cell.styles.fontStyle = "bold";
          } else if (value === "CRITICAL") {
            data.cell.styles.textColor = [205, 87, 0];
            data.cell.styles.fontStyle = "bold";
          }
        },
        didDrawPage: () => {
          const pageHeight = pdf.internal.pageSize.getHeight();
          pdf.setFontSize(7);
          pdf.setTextColor(111, 114, 128);
          pdf.text(
            "NEW CITY STYLE • Internal Stock Reorder Report",
            14,
            pageHeight - 7,
          );
          pdf.text(
            `Page ${pdf.getNumberOfPages()}`,
            pageWidth - 14,
            pageHeight - 7,
            {
              align: "right",
            },
          );
        },
      });

      const fileName = safeFileName(
        `NEW-CITY-STYLE-low-stock-${new Date()
          .toISOString()
          .slice(0, 10)}`,
      );

      pdf.save(`${fileName}.pdf`);
    } catch (error) {
      console.error("Unable to create PDF:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to create PDF report.",
      );
    }
  }

  async function sendLowStockPdfViaWhatsApp() {
    if (whatsAppSending) return;

    if (filteredItems.length === 0) {
      window.alert("No low stock items are available for this filter.");
      return;
    }

    const enteredPhone = window.prompt(
      "Enter WhatsApp mobile number:",
      "",
    );

    if (enteredPhone === null) return;

    const digits = enteredPhone.replace(/\D/g, "");
    const recipientPhone =
      digits.length === 10 ? `91${digits}` : digits;

    if (
      recipientPhone.length < 10 ||
      recipientPhone.length > 15
    ) {
      window.alert("Enter a valid WhatsApp mobile number.");
      return;
    }

    setWhatsAppSending(true);

    try {
      const now = new Date();
      const reportNumber = `LOW-STOCK-${now
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "")}`;

      const reportItems = filteredItems.slice(0, 80).map((item) => ({
        name: `${item.brand} - ${item.productName}`,
        quantity: Math.max(1, item.lowStockLimit - item.availableStock),
        mrp: 0,
        price: 0,
        total: 0,
        size: item.size === "—" ? "" : item.size,
        color: [
          item.color === "—" ? "" : item.color,
          `Available ${item.availableStock}`,
          `Alert ${item.lowStockLimit}`,
        ]
          .filter(Boolean)
          .join(" • "),
      }));

      const response = await fetch(
        "/api/whatsapp/invoice-pdf",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: recipientPhone,
            sendWhatsApp: true,
            customerName: "Low Stock Reorder Report",
            customerPhone: enteredPhone,
            billNumber: reportNumber,
            billDate: now.toLocaleString("en-IN"),
            paymentMethod: "STOCK REORDER",
            subtotal: 0,
            discountAmount: 0,
            taxAmount: 0,
            roundOff: 0,
            billAmount: 0,
            paidAmount: 0,
            dueAmount: 0,
            items: reportItems,
          }),
        },
      );

      const result = (await response.json()) as {
        success?: boolean;
        whatsappPdfSent?: boolean;
        error?: string;
        stage?: string;
        errorDetails?: string | null;
      };

      if (
        !response.ok ||
        result.success !== true ||
        result.whatsappPdfSent !== true
      ) {
        const stageText = result.stage
          ? ` (${result.stage})`
          : "";
        const detailText = result.errorDetails
          ? ` - ${result.errorDetails}`
          : "";

        throw new Error(
          `${
            result.error ||
            "Low-stock WhatsApp PDF could not be sent."
          }${stageText}${detailText}`,
        );
      }

      window.alert("Low-stock PDF sent directly on WhatsApp.");
    } catch (error) {
      console.error(
        "Unable to send low-stock WhatsApp PDF:",
        error,
      );

      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to send low-stock WhatsApp PDF.",
      );
    } finally {
      setWhatsAppSending(false);
    }
  }

  function downloadCsv() {
    if (filteredItems.length === 0) {
      window.alert("No low stock items are available for this filter.");
      return;
    }

    const headers = [
      "Brand",
      "Product",
      "Category",
      "Subcategory",
      "Size",
      "Colour",
      "SKU",
      "Barcode",
      "Stock",
      "Reserved",
      "Available Stock",
      "Low Stock Limit",
    ];

    const rows = filteredItems.map((item) => [
      item.brand,
      item.productName,
      item.category,
      item.subcategory,
      item.size,
      item.color,
      item.sku,
      item.barcode,
      item.stock,
      item.reservedStock,
      item.availableStock,
      item.lowStockLimit,
    ]);

    const csv = [
      headers.map(csvCell).join(","),
      ...rows.map((row) => row.map(csvCell).join(",")),
    ].join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `NEW-CITY-STYLE-low-stock-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="ncsLowStockPage">
      <section className="ncsLowStockHero">
        <div>
          <span>NEW CITY STYLE • INVENTORY INTELLIGENCE</span>
          <h1>Low Stock Command Center</h1>
          <p>
            Brand-wise and size-wise live stock report for products that need
            immediate reorder.
          </p>
        </div>

        <div className="ncsHeroActions">
          <button
            type="button"
            className="secondary"
            onClick={() => router.back()}
          >
            ← Back
          </button>

          <button
            type="button"
            className="secondary"
            disabled={refreshing}
            onClick={() => void loadLowStock(true)}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh Live Stock"}
          </button>

          <button type="button" className="gold" onClick={downloadPdf}>
            ↓ Download PDF
          </button>

          <button
            type="button"
            className="whatsApp"
            disabled={whatsAppSending}
            onClick={() => void sendLowStockPdfViaWhatsApp()}
          >
            {whatsAppSending
              ? "Sending..."
              : "💬 WhatsApp PDF"}
          </button>
        </div>
      </section>

      {errorMessage && (
        <div className="ncsMessage error">{errorMessage}</div>
      )}

      <section className="ncsSummaryGrid">
        <article>
          <span>LOW STOCK LINES</span>
          <strong>{summary.total}</strong>
          <small>Matching selected filters</small>
        </article>

        <article className="dangerCard">
          <span>OUT OF STOCK</span>
          <strong>{summary.outOfStock}</strong>
          <small>Immediate purchase required</small>
        </article>

        <article className="criticalCard">
          <span>CRITICAL 1–2</span>
          <strong>{summary.critical}</strong>
          <small>Very limited availability</small>
        </article>

        <article className="stockCard">
          <span>AVAILABLE UNITS</span>
          <strong>{summary.totalUnits}</strong>
          <small>Across filtered low-stock lines</small>
        </article>
      </section>

      <section className="ncsFilterPanel">
        <div className="ncsFilterTitle">
          <div>
            <span>SMART FILTERS</span>
            <h2>Find required stock quickly</h2>
          </div>

          <button type="button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>

        <div className="ncsFilterGrid">
          <label>
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Product, brand, size, colour, SKU..."
            />
          </label>

          <label>
            <span>Brand</span>
            <select
              value={brandFilter}
              onChange={(event) => setBrandFilter(event.target.value)}
            >
              <option value="ALL">All Brands</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Category</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="ALL">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Size</span>
            <select
              value={sizeFilter}
              onChange={(event) => setSizeFilter(event.target.value)}
            >
              <option value="ALL">All Sizes</option>
              {sizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Stock Level</span>
            <select
              value={stockFilter}
              onChange={(event) =>
                setStockFilter(event.target.value as StockFilter)
              }
            >
              <option value="below5">5 or Below</option>
              <option value="below10">10 or Below</option>
              <option value="out">Out of Stock Only</option>
              <option value="custom">Custom Limit</option>
            </select>
          </label>

          {stockFilter === "custom" && (
            <label>
              <span>Custom Limit</span>
              <input
                type="number"
                min={0}
                step={1}
                value={customLimit}
                onChange={(event) =>
                  setCustomLimit(
                    Math.max(0, Math.floor(numberValue(event.target.value))),
                  )
                }
              />
            </label>
          )}

          <label>
            <span>Group Report By</span>
            <select
              value={groupByBrand ? "brand" : "category"}
              onChange={(event) =>
                setGroupByBrand(event.target.value === "brand")
              }
            >
              <option value="brand">Brand</option>
              <option value="category">Category</option>
            </select>
          </label>
        </div>

        <div className="ncsExportRow">
          <span>
            Showing <strong>{filteredItems.length}</strong> low-stock lines
          </span>

          <div>
            <button type="button" onClick={downloadCsv}>
              ↓ Download CSV
            </button>
            <button type="button" className="gold" onClick={downloadPdf}>
              ↓ Download PDF
            </button>
            <button
              type="button"
              className="whatsApp"
              disabled={whatsAppSending}
              onClick={() => void sendLowStockPdfViaWhatsApp()}
            >
              {whatsAppSending
                ? "Sending..."
                : "💬 WhatsApp PDF"}
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="ncsLoading">
          <div className="spinner" />
          <h3>Loading live stock...</h3>
          <p>Reading products and variants from Supabase.</p>
        </section>
      ) : groupedItems.length === 0 ? (
        <section className="ncsEmpty">
          <div>✓</div>
          <h2>No low-stock items found</h2>
          <p>Try changing the brand, category, size, or stock filter.</p>
        </section>
      ) : (
        <section className="ncsReportGroups">
          {groupedItems.map(([groupName, groupItems]) => (
            <article className="ncsBrandGroup" key={groupName}>
              <header>
                <div>
                  <span>{groupByBrand ? "BRAND" : "CATEGORY"}</span>
                  <h2>{groupName}</h2>
                </div>

                <div>
                  <strong>{groupItems.length}</strong>
                  <small>low-stock line(s)</small>
                </div>
              </header>

              <div className="ncsTableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Size</th>
                      <th>Colour</th>
                      <th>SKU</th>
                      <th>Stock</th>
                      <th>Reserved</th>
                      <th>Available</th>
                      <th>Alert At</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {groupItems.map((item) => {
                      const status = stockStatus(item);

                      return (
                        <tr key={item.key}>
                          <td>
                            <strong>{item.productName}</strong>
                            {item.subcategory && (
                              <small>{item.subcategory}</small>
                            )}
                          </td>
                          <td>{item.category}</td>
                          <td>
                            <span className="variantBadge">{item.size}</span>
                          </td>
                          <td>
                            <span className="variantBadge">{item.color}</span>
                          </td>
                          <td>{item.sku}</td>
                          <td>{item.stock}</td>
                          <td>{item.reservedStock}</td>
                          <td>
                            <strong
                              className={
                                item.availableStock <= 0
                                  ? "stockZero"
                                  : item.availableStock <= 2
                                    ? "stockCritical"
                                    : "stockLow"
                              }
                            >
                              {item.availableStock}
                            </strong>
                          </td>
                          <td>{item.lowStockLimit}</td>
                          <td>
                            <span
                              className={`statusBadge ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </section>
      )}

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .ncsLowStockPage {
          min-height: 100vh;
          padding: 26px;
          color: ${CHARCOAL};
          background:
            radial-gradient(
              circle at 90% 0%,
              rgba(212, 175, 55, 0.16),
              transparent 34%
            ),
            linear-gradient(180deg, #f8f4ec, #eee6d8);
        }

        .ncsLowStockHero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 28px 30px;
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.58);
          border-radius: 26px;
          color: #ffffff;
          background: linear-gradient(
            135deg,
            ${DEEP_BLUE},
            ${ROYAL_BLUE},
            #1b4f9c
          );
          box-shadow: 0 22px 48px rgba(6, 29, 74, 0.2);
        }

        .ncsLowStockHero span,
        .ncsFilterTitle span,
        .ncsBrandGroup header span {
          color: ${GOLD};
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 1.2px;
        }

        .ncsLowStockHero h1 {
          margin: 7px 0 8px;
          font-size: clamp(28px, 4vw, 46px);
          line-height: 1;
          font-weight: 950;
        }

        .ncsLowStockHero p {
          max-width: 720px;
          margin: 0;
          color: rgba(255, 255, 255, 0.76);
          font-size: 14px;
          line-height: 1.6;
        }

        .ncsHeroActions,
        .ncsExportRow > div {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        button {
          min-height: 42px;
          border: 1px solid rgba(10, 46, 115, 0.2);
          border-radius: 13px;
          padding: 0 15px;
          color: ${ROYAL_BLUE};
          background: #ffffff;
          font: inherit;
          font-size: 12px;
          font-weight: 850;
          cursor: pointer;
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease;
        }

        button:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(6, 29, 74, 0.12);
        }

        button:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        button.gold {
          border-color: ${GOLD};
          color: ${DEEP_BLUE};
          background: linear-gradient(135deg, #f8df7f, ${GOLD});
        }

        button.secondary {
          border-color: rgba(255, 255, 255, 0.22);
          color: #ffffff;
          background: rgba(255, 255, 255, 0.09);
        }

        button.whatsApp {
          border-color: #1fa855;
          color: #067647;
          background: #ecfdf3;
        }

        .ncsMessage {
          margin-top: 16px;
          padding: 14px 16px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 800;
        }

        .ncsMessage.error {
          border: 1px solid rgba(179, 38, 30, 0.3);
          color: ${DANGER};
          background: #fff1f0;
        }

        .ncsSummaryGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 16px;
        }

        .ncsSummaryGrid article {
          min-height: 128px;
          padding: 20px;
          border: 1px solid rgba(10, 46, 115, 0.12);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 12px 28px rgba(6, 29, 74, 0.08);
        }

        .ncsSummaryGrid span {
          color: ${SOFT_GRAY};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.8px;
        }

        .ncsSummaryGrid strong {
          display: block;
          margin: 10px 0 5px;
          color: ${ROYAL_BLUE};
          font-size: 34px;
          line-height: 1;
        }

        .ncsSummaryGrid small {
          color: ${SOFT_GRAY};
          font-size: 10px;
        }

        .ncsSummaryGrid .dangerCard strong {
          color: ${DANGER};
        }

        .ncsSummaryGrid .criticalCard strong {
          color: #cb5700;
        }

        .ncsSummaryGrid .stockCard strong {
          color: ${SUCCESS};
        }

        .ncsFilterPanel {
          margin-top: 16px;
          padding: 22px;
          border: 1px solid rgba(212, 175, 55, 0.38);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 14px 32px rgba(6, 29, 74, 0.08);
        }

        .ncsFilterTitle,
        .ncsExportRow,
        .ncsBrandGroup > header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .ncsFilterTitle h2,
        .ncsBrandGroup header h2 {
          margin: 4px 0 0;
          color: ${ROYAL_BLUE};
          font-size: 22px;
          font-weight: 950;
        }

        .ncsFilterGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
        }

        .ncsFilterGrid label {
          display: grid;
          gap: 7px;
        }

        .ncsFilterGrid label > span {
          color: ${DEEP_BLUE};
          font-size: 10px;
          font-weight: 850;
        }

        input,
        select {
          width: 100%;
          min-height: 46px;
          border: 1px solid #d9dde6;
          border-radius: 13px;
          padding: 0 13px;
          outline: 0;
          color: ${CHARCOAL};
          background: #ffffff;
          font: inherit;
          font-size: 12px;
        }

        input:focus,
        select:focus {
          border-color: ${GOLD};
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.12);
        }

        .ncsExportRow {
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid #ece7dd;
          color: ${SOFT_GRAY};
          font-size: 12px;
        }

        .ncsExportRow strong {
          color: ${ROYAL_BLUE};
        }

        .ncsLoading,
        .ncsEmpty {
          margin-top: 16px;
          padding: 55px 20px;
          border: 1px dashed rgba(10, 46, 115, 0.26);
          border-radius: 22px;
          text-align: center;
          background: rgba(255, 255, 255, 0.88);
        }

        .spinner {
          width: 42px;
          height: 42px;
          margin: 0 auto 16px;
          border: 4px solid rgba(10, 46, 115, 0.12);
          border-top-color: ${GOLD};
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .ncsEmpty > div {
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          margin: 0 auto 14px;
          border-radius: 50%;
          color: #ffffff;
          background: ${SUCCESS};
          font-size: 24px;
          font-weight: 950;
        }

        .ncsLoading h3,
        .ncsEmpty h2 {
          margin: 0 0 7px;
          color: ${ROYAL_BLUE};
        }

        .ncsLoading p,
        .ncsEmpty p {
          margin: 0;
          color: ${SOFT_GRAY};
          font-size: 12px;
        }

        .ncsReportGroups {
          display: grid;
          gap: 16px;
          margin-top: 16px;
        }

        .ncsBrandGroup {
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.12);
          border-radius: 22px;
          background: #ffffff;
          box-shadow: 0 14px 32px rgba(6, 29, 74, 0.08);
        }

        .ncsBrandGroup > header {
          padding: 18px 20px;
          color: #ffffff;
          background: linear-gradient(
            135deg,
            ${DEEP_BLUE},
            ${ROYAL_BLUE}
          );
        }

        .ncsBrandGroup header h2 {
          color: #ffffff;
        }

        .ncsBrandGroup header > div:last-child {
          text-align: right;
        }

        .ncsBrandGroup header strong {
          display: block;
          color: ${GOLD};
          font-size: 25px;
        }

        .ncsBrandGroup header small {
          color: rgba(255, 255, 255, 0.7);
          font-size: 9px;
        }

        .ncsTableWrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1060px;
        }

        th,
        td {
          padding: 13px 14px;
          border-bottom: 1px solid #eceff3;
          text-align: left;
          font-size: 11px;
          white-space: nowrap;
        }

        th {
          color: ${ROYAL_BLUE};
          background: #f6f8fc;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.5px;
        }

        tbody tr:hover {
          background: #fffcf3;
        }

        td:first-child {
          min-width: 190px;
          white-space: normal;
        }

        td:first-child strong {
          display: block;
          color: ${DEEP_BLUE};
          font-size: 12px;
        }

        td:first-child small {
          display: block;
          margin-top: 3px;
          color: ${SOFT_GRAY};
          font-size: 9px;
        }

        .variantBadge {
          display: inline-flex;
          min-width: 34px;
          justify-content: center;
          padding: 5px 8px;
          border: 1px solid rgba(10, 46, 115, 0.15);
          border-radius: 9px;
          color: ${ROYAL_BLUE};
          background: #f6f8fc;
          font-weight: 850;
        }

        .statusBadge {
          display: inline-flex;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.4px;
        }

        .statusBadge.danger {
          color: ${DANGER};
          background: #ffefed;
        }

        .statusBadge.critical {
          color: #b84c00;
          background: #fff2df;
        }

        .statusBadge.warning {
          color: #846500;
          background: #fff7d8;
        }

        .stockZero {
          color: ${DANGER};
        }

        .stockCritical {
          color: #cb5700;
        }

        .stockLow {
          color: #846500;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1050px) {
          .ncsLowStockHero {
            align-items: flex-start;
            flex-direction: column;
          }

          .ncsSummaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ncsFilterGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 650px) {
          .ncsLowStockPage {
            padding: 12px;
          }

          .ncsLowStockHero {
            padding: 20px;
            border-radius: 20px;
          }

          .ncsHeroActions {
            width: 100%;
          }

          .ncsHeroActions button {
            flex: 1;
          }

          .ncsSummaryGrid {
            gap: 8px;
          }

          .ncsSummaryGrid article {
            min-height: 108px;
            padding: 15px;
          }

          .ncsSummaryGrid strong {
            font-size: 28px;
          }

          .ncsFilterPanel {
            padding: 16px;
          }

          .ncsFilterGrid {
            grid-template-columns: 1fr;
          }

          .ncsFilterTitle,
          .ncsExportRow {
            align-items: stretch;
            flex-direction: column;
          }

          .ncsExportRow > div {
            width: 100%;
          }

          .ncsExportRow button {
            flex: 1;
          }
        }
      `}</style>
    </main>
  );
}