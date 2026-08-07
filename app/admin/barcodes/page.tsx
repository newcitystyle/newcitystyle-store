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

type PurchaseRow = {
  id: string;
  purchase_number?: string | null;
  supplier_name?: string | null;
  supplier_phone?: string | null;
  supplier_invoice_number?: string | null;
  purchase_date?: string | null;
  purchase_status?: string | null;
  deleted_at?: string | null;
};

type PurchaseItemRow = {
  id: number;
  purchase_id: string;
  product_id?: number | null;
  variant_id?: number | null;
  product_name?: string | null;
  size?: string | null;
  color?: string | null;
  barcode?: string | null;
  sku?: string | null;
  quantity?: number | string | null;
  returned_quantity?: number | string | null;
  mrp?: number | string | null;
  selling_price?: number | string | null;
  item_status?: string | null;
  created_at?: string | null;
};

type BarcodeItem = {
  key: string;
  source: "purchase" | "product";
  purchaseId: string | null;
  purchaseItemId: number | null;
  purchaseNumber: string;
  supplierName: string;
  supplierPhone: string;
  supplierInvoice: string;
  purchaseDate: string;
  productId: number;
  variantId: number | null;
  name: string;
  category: string;
  size: string;
  color: string;
  barcode: string;
  sku: string;
  purchaseQuantity: number;
  returnedQuantity: number;
  availableQuantity: number;
  stock: number;
  mrp: number;
  sellingPrice: number;
  sellOnline: boolean;
  onlineStock: number;
  imageUrl: string;
};

type ViewMode = "purchases" | "products";
type StockFilter = "all" | "in-stock" | "low-stock" | "out-of-stock";

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

function getImage(product?: ProductRow | null) {
  if (!product) return "";
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

  const [purchaseItems, setPurchaseItems] = useState<BarcodeItem[]>([]);
  const [productItems, setProductItems] = useState<BarcodeItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("purchases");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fixingBarcodes, setFixingBarcodes] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
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
      const [
        productResponse,
        variantResponse,
        purchaseResponse,
        purchaseItemResponse,
      ] = await Promise.all([
        supabase
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
          .order("created_at", { ascending: false }),

        supabase
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
          ),

        supabase
          .from("purchases")
          .select(
            [
              "id",
              "purchase_number",
              "supplier_name",
              "supplier_phone",
              "supplier_invoice_number",
              "purchase_date",
              "purchase_status",
              "deleted_at",
            ].join(","),
          )
          .order("purchase_date", { ascending: false })
          .order("created_at", { ascending: false }),

        supabase
          .from("purchase_items")
          .select(
            [
              "id",
              "purchase_id",
              "product_id",
              "variant_id",
              "product_name",
              "size",
              "color",
              "barcode",
              "sku",
              "quantity",
              "returned_quantity",
              "mrp",
              "selling_price",
              "item_status",
              "created_at",
            ].join(","),
          )
          .order("created_at", { ascending: false }),
      ]);

      if (productResponse.error) throw productResponse.error;
      if (variantResponse.error) throw variantResponse.error;
      if (purchaseResponse.error) throw purchaseResponse.error;
      if (purchaseItemResponse.error) throw purchaseItemResponse.error;

      const products =
        (productResponse.data || []) as unknown as ProductRow[];
      const variants =
        (variantResponse.data || []) as unknown as VariantRow[];
      const purchases =
        (purchaseResponse.data || []) as unknown as PurchaseRow[];
      const purchaseRows =
        (purchaseItemResponse.data || []) as unknown as PurchaseItemRow[];

      const productMap = new Map<number, ProductRow>();
      products.forEach((product) => productMap.set(Number(product.id), product));

      const variantMap = new Map<number, VariantRow>();
      const variantsByProduct = new Map<number, VariantRow[]>();

      variants.forEach((variant) => {
        if (variant.is_active === false) return;

        variantMap.set(Number(variant.id), variant);

        const list = variantsByProduct.get(Number(variant.product_id)) || [];
        list.push(variant);
        variantsByProduct.set(Number(variant.product_id), list);
      });

      const purchaseMap = new Map<string, PurchaseRow>();

      purchases.forEach((purchase) => {
        if (
          purchase.deleted_at ||
          normalize(purchase.purchase_status) === "cancelled"
        ) {
          return;
        }

        purchaseMap.set(purchase.id, purchase);
      });

      const mappedPurchaseItems: BarcodeItem[] = purchaseRows
        .filter((item) => purchaseMap.has(item.purchase_id))
        .map((item) => {
          const purchase = purchaseMap.get(item.purchase_id)!;
          const product = item.product_id
            ? productMap.get(Number(item.product_id))
            : undefined;
          const variant = item.variant_id
            ? variantMap.get(Number(item.variant_id))
            : undefined;

          const quantity = Math.max(0, toNumber(item.quantity));
          const returnedQuantity = Math.max(
            0,
            toNumber(item.returned_quantity),
          );

          return {
            key: `purchase-${item.id}`,
            source: "purchase",
            purchaseId: item.purchase_id,
            purchaseItemId: item.id,
            purchaseNumber:
              purchase.purchase_number?.trim() || "PURCHASE",
            supplierName:
              purchase.supplier_name?.trim() || "Unknown Supplier",
            supplierPhone: purchase.supplier_phone?.trim() || "",
            supplierInvoice:
              purchase.supplier_invoice_number?.trim() || "",
            purchaseDate: purchase.purchase_date || "",
            productId: Number(item.product_id || 0),
            variantId: item.variant_id ? Number(item.variant_id) : null,
            name:
              item.product_name?.trim() ||
              product?.name?.trim() ||
              "NEW CITY STYLE Product",
            category:
              product?.category?.trim() ||
              product?.subcategory?.trim() ||
              "Others",
            size:
              item.size?.trim() || variant?.size?.trim() || "",
            color:
              item.color?.trim() || variant?.color?.trim() || "",
            barcode:
              item.barcode?.trim() ||
              variant?.barcode?.trim() ||
              product?.barcode?.trim() ||
              "",
            sku:
              item.sku?.trim() ||
              variant?.sku?.trim() ||
              product?.sku?.trim() ||
              "",
            purchaseQuantity: quantity,
            returnedQuantity,
            availableQuantity: Math.max(0, quantity - returnedQuantity),
            stock: Math.max(
              0,
              toNumber(variant?.stock) || toNumber(product?.stock),
            ),
            mrp:
              toNumber(item.mrp) ||
              toNumber(variant?.mrp) ||
              toNumber(product?.mrp) ||
              toNumber(product?.price),
            sellingPrice:
              toNumber(item.selling_price) ||
              toNumber(variant?.selling_price) ||
              toNumber(product?.price),
            sellOnline:
              variant?.sell_online === true ||
              (!variant && product?.sell_online === true),
            onlineStock: Math.max(
              0,
              toNumber(variant?.online_stock_limit) ||
                toNumber(product?.online_stock_limit),
            ),
            imageUrl: getImage(product),
          };
        });

      const mappedProductItems: BarcodeItem[] = [];

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
            mappedProductItems.push({
              key: `product-variant-${variant.id}`,
              source: "product",
              purchaseId: null,
              purchaseItemId: null,
              purchaseNumber: "",
              supplierName: "",
              supplierPhone: "",
              supplierInvoice: "",
              purchaseDate: "",
              productId,
              variantId: Number(variant.id),
              name,
              category,
              size: variant.size?.trim() || "",
              color: variant.color?.trim() || "",
              barcode:
                variant.barcode?.trim() || product.barcode?.trim() || "",
              sku: variant.sku?.trim() || product.sku?.trim() || "",
              purchaseQuantity: 0,
              returnedQuantity: 0,
              availableQuantity: 0,
              stock: Math.max(0, toNumber(variant.stock)),
              mrp:
                toNumber(variant.mrp) ||
                toNumber(product.mrp) ||
                toNumber(product.price),
              sellingPrice:
                toNumber(variant.selling_price) ||
                toNumber(product.price),
              sellOnline: variant.sell_online === true,
              onlineStock: Math.max(
                0,
                toNumber(variant.online_stock_limit),
              ),
              imageUrl,
            });
          });

          return;
        }

        mappedProductItems.push({
          key: `product-${productId}`,
          source: "product",
          purchaseId: null,
          purchaseItemId: null,
          purchaseNumber: "",
          supplierName: "",
          supplierPhone: "",
          supplierInvoice: "",
          purchaseDate: "",
          productId,
          variantId: null,
          name,
          category,
          size: "",
          color: "",
          barcode: product.barcode?.trim() || "",
          sku: product.sku?.trim() || "",
          purchaseQuantity: 0,
          returnedQuantity: 0,
          availableQuantity: 0,
          stock: Math.max(0, toNumber(product.stock)),
          mrp: toNumber(product.mrp) || toNumber(product.price),
          sellingPrice: toNumber(product.price),
          sellOnline: product.sell_online === true,
          onlineStock: Math.max(
            0,
            toNumber(product.online_stock_limit),
          ),
          imageUrl,
        });
      });

      setPurchaseItems(mappedPurchaseItems);
      setProductItems(mappedProductItems);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load barcode records.",
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
        font: "Arial",
        fontOptions: "bold",
        fontSize: 13,
        textMargin: 3,
        margin: 4,
        background: "#FFFFFF",
        lineColor: "#000000",
      });
    } catch (error) {
      console.error("Barcode preview error:", error);
    }
  }, [previewItem]);

  const currentItems =
    viewMode === "purchases" ? purchaseItems : productItems;

  const duplicateBarcodeSet = useMemo(() => {
    const counts = new Map<string, number>();

    productItems.forEach((item) => {
      const barcode = item.barcode.trim();
      if (!barcode) return;
      counts.set(barcode, (counts.get(barcode) || 0) + 1);
    });

    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([barcode]) => barcode),
    );
  }, [productItems]);

  const filteredItems = useMemo(() => {
    const query = normalize(searchQuery);

    return currentItems.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.purchaseNumber,
          item.supplierName,
          item.supplierPhone,
          item.supplierInvoice,
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

      return matchesSearch && matchesStock;
    });
  }, [currentItems, searchQuery, stockFilter]);

  const allVisibleSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedKeys.includes(item.key));

  const selectedLabelCount = useMemo(() => {
    const selectedItems = selectedKeys
      .map((key) => currentItems.find((item) => item.key === key))
      .filter((item): item is BarcodeItem => Boolean(item));

    if (viewMode === "purchases") {
      return selectedItems.reduce(
        (total, item) =>
          total +
          Math.max(
            1,
            item.availableQuantity ||
              item.purchaseQuantity ||
              1,
          ),
        0,
      );
    }

    const safeCopies = Math.max(
      1,
      Math.min(500, Math.floor(copies || 1)),
    );

    return selectedItems.length * safeCopies;
  }, [selectedKeys, currentItems, viewMode, copies]);

  const statistics = useMemo(
    () => ({
      purchaseBatches: purchaseItems.length,
      products: productItems.length,
      missingBarcode: currentItems.filter((item) => !item.barcode).length,
      totalPurchasedQty: purchaseItems.reduce(
        (sum, item) => sum + item.purchaseQuantity,
        0,
      ),
      suppliers: new Set(
        purchaseItems.map((item) => item.supplierName).filter(Boolean),
      ).size,
    }),
    [currentItems, productItems.length, purchaseItems],
  );

  function changeView(next: ViewMode) {
    setViewMode(next);
    setSelectedKeys([]);
    setSearchQuery("");
  }

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

  async function generateMissingBarcodes() {
    if (fixingBarcodes) return;

    setFixingBarcodes(true);
    setNotice("");

    try {
      const { data, error } = await supabase.rpc(
        "ncs_fill_missing_barcodes",
      );

      if (error) throw error;

      const result = (data || {}) as {
        total_updated?: number;
        message?: string;
      };

      setNotice(
        result.total_updated && result.total_updated > 0
          ? `${result.total_updated} missing barcode(s) generated successfully.`
          : "All products already have barcodes.",
      );

      await loadItems(true);
      window.setTimeout(() => setNotice(""), 3500);
    } catch (error) {
      console.error(error);
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to generate missing barcodes.",
      );
      window.setTimeout(() => setNotice(""), 3500);
    } finally {
      setFixingBarcodes(false);
    }
  }

  function buildBarcodeSvg(barcode: string) {
    const svg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );

    JsBarcode(svg, barcode, {
      format: "CODE128",
      width: 2,
      height: 48,
      displayValue: true,
      font: "Arial",
      fontOptions: "bold",
      fontSize: 13,
      textMargin: 3,
      margin: 4,
      background: "#FFFFFF",
      lineColor: "#000000",
    });

    return svg.outerHTML;
  }

  function printItems(selectedItems: BarcodeItem[], copyCount: number) {
    const printableItems = selectedItems.filter((item) => item.barcode.trim());

    if (printableItems.length === 0) {
      setNotice("Select at least one item with a barcode.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    const labelSizes: Record<
      string,
      {
        pageWidth: number;
        pageHeight: number;
        labelWidth: number;
        columns: number;
        gap: number;
      }
    > = {
      "38x25": {
        pageWidth: 38,
        pageHeight: 25,
        labelWidth: 38,
        columns: 1,
        gap: 0,
      },
      "50x25": {
        pageWidth: 50,
        pageHeight: 25,
        labelWidth: 50,
        columns: 1,
        gap: 0,
      },
      "50x30": {
        pageWidth: 50,
        pageHeight: 30,
        labelWidth: 50,
        columns: 1,
        gap: 0,
      },
      "60x40": {
        pageWidth: 60,
        pageHeight: 40,
        labelWidth: 60,
        columns: 1,
        gap: 0,
      },
      "tsc-te244-2up": {
        pageWidth: 100,
        pageHeight: 30,
        labelWidth: 49,
        columns: 2,
        gap: 2,
      },
    };

    const selectedSize =
      labelSizes[labelSize] || labelSizes["tsc-te244-2up"];

    const safeCopies = Math.max(
      1,
      Math.min(500, Math.floor(copyCount || 1)),
    );

    /*
     * Build the exact physical label queue first.
     * Example:
     * 2 selected rows × 1 copy = 2 physical labels.
     * 3 selected rows × 2 copies = 6 physical labels.
     *
     * Keeping a flat queue avoids browser/React selection-order surprises.
     */
    const physicalLabels: string[] = [];

    printableItems.forEach((item) => {
      for (let copyIndex = 0; copyIndex < safeCopies; copyIndex += 1) {
        const variantText = [item.size, item.color]
          .filter(Boolean)
          .join(" • ");

        const svg = buildBarcodeSvg(item.barcode);

        physicalLabels.push(`
          <div class="label">
            <p class="store">NEW CITY STYLE</p>
            <p class="product">${escapeHtml(item.name)}</p>
            ${
              variantText
                ? `<p class="variant">${escapeHtml(variantText)}</p>`
                : ""
            }
            <div class="barcode">${svg}</div>
            <div class="priceRow">
              ${
                showMrp && item.mrp > 0
                  ? `<span>MRP ₹${item.mrp.toFixed(2)}</span>`
                  : ""
              }
            </div>
          </div>
        `);
      }
    });

    const pages: string[] = [];

    for (
      let index = 0;
      index < physicalLabels.length;
      index += selectedSize.columns
    ) {
      const pageLabels = physicalLabels.slice(
        index,
        index + selectedSize.columns,
      );

      while (pageLabels.length < selectedSize.columns) {
        pageLabels.push('<div class="label emptyLabel"></div>');
      }

      pages.push(
        `<section class="printPage">${pageLabels.join("")}</section>`,
      );
    }

    const printWindow = window.open(
      "",
      "_blank",
      "width=900,height=760",
    );

    if (!printWindow) {
      setNotice("Allow browser pop-ups to print labels.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    const totalPhysicalLabels = physicalLabels.length;

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>NEW CITY STYLE Barcodes</title>
          <style>
            @page {
              size: ${selectedSize.pageWidth}mm ${selectedSize.pageHeight}mm;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
              width: ${selectedSize.pageWidth}mm;
              background: #ffffff;
              font-family: Arial, Helvetica, sans-serif;
            }

            .printPage {
              width: ${selectedSize.pageWidth}mm;
              height: ${selectedSize.pageHeight}mm;
              display: grid;
              grid-template-columns: repeat(
                ${selectedSize.columns},
                ${selectedSize.labelWidth}mm
              );
              grid-template-rows: ${selectedSize.pageHeight}mm;
              column-gap: ${selectedSize.gap}mm;
              row-gap: 0;
              margin: 0;
              padding: 0;
              overflow: hidden;
              break-after: page;
              page-break-after: always;
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .printPage:last-child {
              break-after: auto;
              page-break-after: auto;
            }

            .label {
              width: ${selectedSize.labelWidth}mm;
              height: ${selectedSize.pageHeight}mm;
              min-width: ${selectedSize.labelWidth}mm;
              max-width: ${selectedSize.labelWidth}mm;
              min-height: ${selectedSize.pageHeight}mm;
              max-height: ${selectedSize.pageHeight}mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              margin: 0;
              padding: 0.7mm 1mm;
              overflow: hidden;
              text-align: center;
              break-inside: avoid;
              page-break-inside: avoid;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .emptyLabel {
              visibility: hidden;
            }

            .store {
              margin: 0 0 0.25mm;
              font-size: 8px;
              font-weight: 900;
              letter-spacing: 0.7px;
            }

            .product {
              width: 100%;
              margin: 0;
              overflow: hidden;
              font-size: 8px;
              font-weight: 700;
              line-height: 1.15;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .variant {
              margin: 0.2mm 0 0;
              padding: 0.3mm 1mm;
              border: 1px solid #000;
              border-radius: 1mm;
              font-size: 7px;
              font-weight: 900;
              line-height: 1;
            }

            .barcode {
              width: 100%;
              margin-top: 0.15mm;
              overflow: hidden;
            }

            .barcode svg {
              width: 100%;
              height: ${selectedSize.pageHeight <= 25 ? 10.8 : 12.3}mm;
              display: block;
              overflow: visible;
              shape-rendering: crispEdges;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .barcode svg text {
              fill: #000000 !important;
              font-family: Arial, Helvetica, sans-serif !important;
              font-size: 13px !important;
              font-weight: 900 !important;
              letter-spacing: 0.55px;
              opacity: 1 !important;
            }

            .priceRow {
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-top: 0.1mm;
              padding-bottom: 0.4mm;
              font-size: 11px;
              font-weight: 950;
              line-height: 1;
              white-space: nowrap;
            }

            @media screen {
              body::before {
                content: "${totalPhysicalLabels} label(s) ready • ${selectedSize.columns}-up layout";
                display: block;
                padding: 8px 10px;
                background: #0A2E73;
                color: white;
                font: 700 12px Arial, sans-serif;
              }

              .printPage {
                outline: 1px dashed #bbbbbb;
              }
            }

            @media print {
              body::before {
                display: none !important;
                content: none !important;
              }
            }
          </style>
        </head>

        <body>
          ${pages.join("")}

          <script>
            window.addEventListener("load", function () {
              requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                  setTimeout(function () {
                    window.focus();
                    window.print();
                  }, 180);
                });
              });

              window.onafterprint = function () {
                window.close();
              };
            });
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();

    setNotice(
      `${totalPhysicalLabels} barcode label(s) prepared for printing.`,
    );
    window.setTimeout(() => setNotice(""), 3000);
  }

  function printSelected() {
    const selectedItems = selectedKeys
      .map((key) => currentItems.find((item) => item.key === key))
      .filter((item): item is BarcodeItem => Boolean(item));

    if (selectedItems.length === 0) {
      setNotice("Select at least one item with a barcode.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    /*
     * Purchase Batches:
     * print the exact remaining label quantity for EACH selected row.
     *
     * Example:
     * row A Labels Available = 3
     * row B Labels Available = 1
     * total physical labels = 4
     *
     * Product Master:
     * keep using the manual "Copies per selected row" value.
     */
    if (viewMode === "purchases") {
      const expandedItems = selectedItems.flatMap((item) => {
        const rowCopies = Math.max(
          1,
          item.availableQuantity || item.purchaseQuantity || 1,
        );

        return Array.from(
          { length: rowCopies },
          () => item,
        );
      });

      printItems(expandedItems, 1);
      return;
    }

    printItems(selectedItems, copies);
  }

  function printSingle(item: BarcodeItem) {
    const defaultCopies =
      item.source === "purchase"
        ? Math.max(1, item.availableQuantity || item.purchaseQuantity)
        : Math.max(1, copies);

    printItems([item], defaultCopies);
  }

  function openPreview(item: BarcodeItem) {
    setPreviewItem(item);
    setCopies(
      item.source === "purchase"
        ? Math.max(1, item.availableQuantity || item.purchaseQuantity)
        : 1,
    );
  }

  return (
    <main className="barcodePage">
      <section className="pageHeader">
        <div>
          <span>NEW CITY STYLE • PURCHASE BARCODES</span>
          <h1>Barcodes by Purchase</h1>
          <p>
            ప్రతి supplier purchase, invoice, product మరియు quantity
            separateగా కనిపిస్తుంది. ఎప్పుడైనా అదే purchase barcode labels
            మళ్లీ print చేయవచ్చు.
          </p>
        </div>

        <div className="pageHeaderActions">
          {statistics.missingBarcode > 0 && (
            <button
              type="button"
              className="fixBarcodeButton"
              onClick={generateMissingBarcodes}
              disabled={fixingBarcodes}
            >
              {fixingBarcodes
                ? "Generating..."
                : `Generate Missing (${statistics.missingBarcode})`}
            </button>
          )}

          <button
            type="button"
            onClick={() => loadItems(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>
      </section>

      {notice && <div className="notice">{notice}</div>}
      {errorMessage && <div className="error">{errorMessage}</div>}

      <section className="statsGrid">
        <article>
          <span>Purchase Item Batches</span>
          <strong>{statistics.purchaseBatches}</strong>
        </article>

        <article>
          <span>Total Purchased Qty</span>
          <strong>{statistics.totalPurchasedQty}</strong>
        </article>

        <article>
          <span>Suppliers</span>
          <strong>{statistics.suppliers}</strong>
        </article>

        <article>
          <span>Product Barcode Items</span>
          <strong>{statistics.products}</strong>
        </article>

        <article>
          <span>Missing Barcode</span>
          <strong>{statistics.missingBarcode}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="viewTabs">
          <button
            type="button"
            className={viewMode === "purchases" ? "active" : ""}
            onClick={() => changeView("purchases")}
          >
            Purchase Batches ({purchaseItems.length})
          </button>

          <button
            type="button"
            className={viewMode === "products" ? "active" : ""}
            onClick={() => changeView("products")}
          >
            Product Master ({productItems.length})
          </button>
        </div>

        <div className="toolbar">
          <div className="searchBox">
            <span>⌕</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={
                viewMode === "purchases"
                  ? "Search supplier, purchase no, invoice, product or barcode..."
                  : "Search product, barcode, SKU, size..."
              }
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
        </div>

        <div className="printBar">
          <label>
            <span>Copies per selected row</span>
            <input
              type="number"
              min="1"
              max="500"
              value={copies}
              onChange={(event) =>
                setCopies(
                  Math.max(
                    1,
                    Math.min(
                      500,
                      Math.floor(toNumber(event.target.value, 1)),
                    ),
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
            🖨 Print Selected — {selectedLabelCount} Label{selectedLabelCount === 1 ? "" : "s"}
          </button>
        </div>

        {selectedKeys.length > 0 && (
          <div className="selectedPrintHint">
            <strong>{selectedKeys.length} row{selectedKeys.length === 1 ? "" : "s"} selected</strong>
            <span>
              Total stickers ready: {selectedLabelCount}. Use the blue
              “Print Selected” button to print all selected quantities together.
            </span>
          </div>
        )}

        {loading ? (
          <div className="loadingState">
            <div className="spinner" />
            <h2>Loading barcode records...</h2>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="emptyState">
            <h2>No matching records</h2>
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

            <div className="batchList">
              {filteredItems.map((item) => {
                const duplicate =
                  item.barcode &&
                  duplicateBarcodeSet.has(item.barcode);

                return (
                  <article className="batchCard" key={item.key}>
                    <div className="batchSelect">
                      <input
                        type="checkbox"
                        checked={selectedKeys.includes(item.key)}
                        onChange={() => toggleItem(item.key)}
                      />
                    </div>

                    <div className="productImage">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt={item.name} />
                      ) : (
                        <span>NCS</span>
                      )}
                    </div>

                    <div className="batchMain">
                      {viewMode === "purchases" && (
                        <div className="purchaseLine">
                          <strong>{item.purchaseNumber}</strong>
                          <span>{formatDate(item.purchaseDate)}</span>
                        </div>
                      )}

                      <h3>{item.name}</h3>

                      <p>
                        {[item.size, item.color]
                          .filter(Boolean)
                          .join(" • ") || item.category}
                      </p>

                      {viewMode === "purchases" && (
                        <div className="supplierLine">
                          <span>Supplier</span>
                          <strong>{item.supplierName}</strong>
                          {item.supplierInvoice && (
                            <small>
                              Invoice: {item.supplierInvoice}
                            </small>
                          )}
                        </div>
                      )}

                      <div className="barcodeLine">
                        <span>Barcode</span>
                        <strong>{item.barcode || "Missing"}</strong>
                        {item.sku && <small>SKU: {item.sku}</small>}
                        {duplicate && (
                          <b>Same product barcode — valid for repeat purchase</b>
                        )}
                      </div>
                    </div>

                    <div className="batchNumbers">
                      {viewMode === "purchases" && (
                        <>
                          <p>
                            <span>Purchased Qty</span>
                            <strong>{item.purchaseQuantity}</strong>
                          </p>

                          <p>
                            <span>Returned</span>
                            <strong>{item.returnedQuantity}</strong>
                          </p>

                          <p>
                            <span>Labels Available</span>
                            <strong>{item.availableQuantity}</strong>
                          </p>
                        </>
                      )}

                      <p>
                        <span>Current Stock</span>
                        <strong>{item.stock}</strong>
                      </p>

                      <p>
                        <span>MRP</span>
                        <strong>{formatCurrency(item.mrp)}</strong>
                      </p>
                    </div>

                    <div className="batchActions">
                      <button
                        type="button"
                        onClick={() => openPreview(item)}
                        disabled={!item.barcode}
                      >
                        Preview
                      </button>

                      <button
                        type="button"
                        className="printButton"
                        onClick={() => printSingle(item)}
                        disabled={!item.barcode}
                      >
                        🖨 Print This Item{" "}
                        {viewMode === "purchases"
                          ? `(${Math.max(
                              1,
                              item.availableQuantity ||
                                item.purchaseQuantity,
                            )})`
                          : ""}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/admin/products/edit/${item.productId}`,
                          )
                        }
                      >
                        Edit Product
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
              aria-label="Close barcode preview"
            >
              ✕
            </button>

            <span>BARCODE PREVIEW</span>
            <h2>{previewItem.name}</h2>

            {previewItem.source === "purchase" && (
              <div className="previewPurchase">
                <strong>{previewItem.purchaseNumber}</strong>
                <span>
                  {previewItem.supplierName} •{" "}
                  {formatDate(previewItem.purchaseDate)}
                </span>
                <small>
                  Purchased {previewItem.purchaseQuantity} • Returned{" "}
                  {previewItem.returnedQuantity}
                </small>
              </div>
            )}

            <p>
              {[previewItem.size, previewItem.color]
                .filter(Boolean)
                .join(" • ") || "Standard Product"}
            </p>

            <div className="barcodePreview">
              <svg ref={previewSvgRef} />
            </div>

            <strong>{previewItem.barcode}</strong>

            <label className="previewCopies">
              <span>Labels to print</span>
              <input
                type="number"
                min="1"
                max="500"
                value={copies}
                onChange={(event) =>
                  setCopies(
                    Math.max(
                      1,
                      Math.min(
                        500,
                        Math.floor(
                          toNumber(event.target.value, 1),
                        ),
                      ),
                    ),
                  )
                }
              />
            </label>

            <div className="previewActions">
              <button
                type="button"
                onClick={() => printItems([previewItem], copies)}
              >
                🖨 Print {copies} Label(s)
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/admin/products/edit/${previewItem.productId}`,
                  )
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
          padding: 24px;
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
          margin-bottom: 18px;
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
          font-size: 31px;
          font-weight: 950;
        }

        .pageHeader p {
          max-width: 760px;
          margin: 6px 0 0;
          color: rgba(255, 255, 255, 0.72);
          font-size: 11px;
          line-height: 1.6;
        }

        .pageHeaderActions {
          display: flex;
          gap: 9px;
        }

        .pageHeader button {
          min-height: 43px;
          padding: 0 14px;
          border: 1px solid ${GOLD};
          border-radius: 11px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .pageHeader .fixBarcodeButton {
          background: rgba(255, 255, 255, 0.12);
          color: white;
        }

        .notice,
        .error {
          margin-bottom: 13px;
          padding: 12px 14px;
          border-radius: 11px;
          font-size: 11px;
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
          gap: 10px;
          margin-bottom: 14px;
        }

        .statsGrid article {
          min-height: 94px;
          padding: 15px;
          border: 1px solid rgba(212, 175, 55, 0.22);
          border-radius: 16px;
          background: linear-gradient(
            135deg,
            ${ROYAL_BLUE},
            ${DEEP_BLUE}
          );
          box-shadow: 0 10px 24px rgba(3, 21, 63, 0.14);
        }

        .statsGrid span,
        .statsGrid strong {
          display: block;
        }

        .statsGrid span {
          color: ${GOLD};
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.55px;
          text-transform: uppercase;
        }

        .statsGrid strong {
          margin-top: 8px;
          color: white;
          font-size: 23px;
          font-weight: 950;
        }

        .panel {
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 20px;
          background: white;
          box-shadow: 0 12px 32px rgba(10, 46, 115, 0.07);
        }

        .viewTabs {
          display: flex;
          gap: 8px;
          padding: 13px 15px 0;
        }

        .viewTabs button {
          min-height: 40px;
          padding: 0 14px;
          border: 1px solid #dfe4eb;
          border-bottom: 0;
          border-radius: 11px 11px 0 0;
          background: #f8fafc;
          color: #667085;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .viewTabs button.active {
          border-color: ${GOLD};
          background: ${ROYAL_BLUE};
          color: white;
        }

        .toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 190px;
          gap: 10px;
          padding: 14px 15px;
          border-top: 1px solid #edf0f4;
          border-bottom: 1px solid #edf0f4;
        }

        .searchBox {
          display: flex;
          align-items: center;
          min-height: 44px;
          padding: 0 12px;
          border: 1px solid #dfe4eb;
          border-radius: 10px;
          background: #fbfcfe;
        }

        .searchBox span {
          margin-right: 8px;
          color: ${ROYAL_BLUE};
          font-size: 20px;
        }

        .searchBox input,
        .toolbar select,
        .printBar input,
        .printBar select,
        .previewCopies input {
          width: 100%;
          min-height: 41px;
          padding: 0 10px;
          border: 1px solid #dfe4eb;
          border-radius: 9px;
          outline: none;
          background: white;
          font: inherit;
          font-size: 10px;
          font-weight: 700;
        }

        .searchBox input {
          min-height: auto;
          padding: 0;
          border: 0;
          background: transparent;
        }

        .printBar {
          display: flex;
          align-items: end;
          gap: 9px;
          padding: 12px 15px;
          border-bottom: 1px solid #edf0f4;
          background: #f8fafc;
        }

        .printBar label {
          display: grid;
          gap: 5px;
        }

        .printBar label > span {
          color: #667085;
          font-size: 8px;
          font-weight: 800;
        }

        .printBar .check {
          min-height: 41px;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 0 11px;
          border: 1px solid #dfe4eb;
          border-radius: 9px;
          background: white;
          font-size: 9px;
          font-weight: 800;
        }

        .printBar .check input {
          width: 16px;
          height: 16px;
          accent-color: ${ROYAL_BLUE};
        }

        .printSelected {
          min-height: 41px;
          margin-left: auto;
          padding: 0 15px;
          border: 1px solid ${GOLD};
          border-radius: 10px;
          background: ${ROYAL_BLUE};
          color: white;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .selectedPrintHint {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 10px 15px;
          border-bottom: 1px solid #edf0f4;
          background: #eef4ff;
          color: #0A2E73;
          font-size: 9px;
        }

        .selectedPrintHint strong {
          font-size: 10px;
          font-weight: 950;
          white-space: nowrap;
        }

        .selectedPrintHint span {
          color: #475467;
          font-weight: 750;
          text-align: right;
        }

        .selectAll {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 15px;
          border-bottom: 1px solid #edf0f4;
          background: #fffdf5;
        }

        .selectAll label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #475467;
          font-size: 10px;
          font-weight: 800;
        }

        .selectAll input {
          width: 17px;
          height: 17px;
          accent-color: ${ROYAL_BLUE};
        }

        .selectAll button {
          min-height: 32px;
          padding: 0 10px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          background: white;
          color: #475467;
          font-size: 9px;
          font-weight: 800;
          cursor: pointer;
        }

        .batchList {
          display: grid;
          gap: 10px;
          padding: 12px;
          background: #f8fafc;
        }

        .batchCard {
          display: grid;
          grid-template-columns:
            28px 58px minmax(260px, 1.5fr)
            minmax(300px, 1fr) 150px;
          align-items: center;
          gap: 11px;
          padding: 12px;
          border: 1px solid #e4e7ec;
          border-radius: 14px;
          background: white;
          box-shadow: 0 6px 16px rgba(16, 24, 40, 0.04);
        }

        .batchSelect input {
          width: 17px;
          height: 17px;
          accent-color: ${ROYAL_BLUE};
        }

        .productImage {
          width: 56px;
          height: 64px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 10px;
          background: ${ROYAL_BLUE};
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
        }

        .productImage img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .purchaseLine {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .purchaseLine strong {
          color: ${GOLD};
          font-size: 9px;
          letter-spacing: 0.4px;
        }

        .purchaseLine span {
          color: #98a2b3;
          font-size: 8px;
        }

        .batchMain h3 {
          margin: 4px 0 0;
          color: ${DEEP_BLUE};
          font-size: 12px;
        }

        .batchMain > p {
          margin: 4px 0 0;
          color: #8a93a0;
          font-size: 8px;
        }

        .supplierLine,
        .barcodeLine {
          margin-top: 7px;
          padding: 8px;
          border-radius: 9px;
          background: #f8fafc;
        }

        .supplierLine span,
        .supplierLine strong,
        .supplierLine small,
        .barcodeLine span,
        .barcodeLine strong,
        .barcodeLine small,
        .barcodeLine b {
          display: block;
        }

        .supplierLine span,
        .barcodeLine span {
          color: #98a2b3;
          font-size: 7px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .supplierLine strong,
        .barcodeLine strong {
          margin-top: 3px;
          color: ${ROYAL_BLUE};
          font-size: 9px;
        }

        .supplierLine small,
        .barcodeLine small,
        .barcodeLine b {
          margin-top: 3px;
          color: #8a93a0;
          font-size: 7px;
        }

        .barcodeLine b {
          color: #067647;
        }

        .batchNumbers {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
        }

        .batchNumbers p {
          margin: 0;
          padding: 8px;
          border-radius: 9px;
          background: #f8fafc;
        }

        .batchNumbers span,
        .batchNumbers strong {
          display: block;
        }

        .batchNumbers span {
          color: #98a2b3;
          font-size: 7px;
          font-weight: 800;
        }

        .batchNumbers strong {
          margin-top: 3px;
          color: ${ROYAL_BLUE};
          font-size: 10px;
        }

        .batchActions {
          display: grid;
          gap: 6px;
        }

        .batchActions button {
          min-height: 34px;
          padding: 0 9px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          background: white;
          color: ${ROYAL_BLUE};
          font-size: 8px;
          font-weight: 850;
          cursor: pointer;
        }

        .batchActions .printButton {
          border-color: ${GOLD};
          background: ${GOLD};
          color: ${DEEP_BLUE};
        }

        .loadingState,
        .emptyState {
          min-height: 330px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          text-align: center;
        }

        .spinner {
          width: 42px;
          height: 42px;
          border: 4px solid #e6eaf0;
          border-top-color: ${ROYAL_BLUE};
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loadingState h2,
        .emptyState h2 {
          margin: 13px 0 0;
          color: ${ROYAL_BLUE};
          font-size: 18px;
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
          width: min(470px, 100%);
          padding: 25px;
          border: 1px solid rgba(212, 175, 55, 0.4);
          border-radius: 20px;
          background: white;
          text-align: center;
          box-shadow: 0 28px 70px rgba(3, 21, 63, 0.28);
        }

        .previewModal > span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .previewModal h2 {
          margin: 8px 0 0;
          color: ${ROYAL_BLUE};
        }

        .previewPurchase {
          margin-top: 10px;
          padding: 10px;
          border-radius: 10px;
          background: #f8fafc;
        }

        .previewPurchase strong,
        .previewPurchase span,
        .previewPurchase small {
          display: block;
        }

        .previewPurchase strong {
          color: ${ROYAL_BLUE};
          font-size: 10px;
        }

        .previewPurchase span,
        .previewPurchase small {
          margin-top: 3px;
          color: #8a93a0;
          font-size: 8px;
        }

        .previewModal p {
          color: #667085;
          font-size: 10px;
        }

        .close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          padding: 0;
          border: 1px solid ${GOLD};
          border-radius: 50%;
          background: ${ROYAL_BLUE};
          color: white;
          font-size: 17px;
          font-weight: 950;
          cursor: pointer;
        }

        .barcodePreview {
          margin: 16px 0 8px;
          padding: 12px;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
          background: white;
        }

        .barcodePreview svg {
          width: 100%;
          height: auto;
          overflow: visible;
          shape-rendering: crispEdges;
        }

        .barcodePreview svg text {
          fill: #000000 !important;
          font-family: Arial, Helvetica, sans-serif !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          letter-spacing: 0.55px;
          opacity: 1 !important;
        }


        .previewCopies {
          display: grid;
          gap: 5px;
          margin-top: 14px;
          text-align: left;
        }

        .previewCopies span {
          color: #667085;
          font-size: 8px;
          font-weight: 800;
        }

        .previewActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 15px;
        }

        .previewActions button {
          min-height: 42px;
          border: 1px solid ${GOLD};
          border-radius: 10px;
          background: ${ROYAL_BLUE};
          color: white;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1180px) {
          .statsGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .batchCard {
            grid-template-columns:
              28px 58px minmax(240px, 1fr)
              minmax(260px, 1fr);
          }

          .batchActions {
            grid-column: 2 / -1;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .barcodePage {
            padding: 14px 9px 36px;
          }

          .pageHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .pageHeaderActions {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .statsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .toolbar {
            grid-template-columns: 1fr;
          }

          .printBar {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .printSelected {
            grid-column: 1 / -1;
            margin-left: 0;
          }

          .batchCard {
            grid-template-columns: 28px 58px minmax(0, 1fr);
          }

          .batchNumbers,
          .batchActions {
            grid-column: 1 / -1;
          }

          .batchActions {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .pageHeaderActions,
          .statsGrid,
          .printBar,
          .previewActions {
            grid-template-columns: 1fr;
          }

          .viewTabs {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .viewTabs button {
            border: 1px solid #dfe4eb;
            border-radius: 9px;
          }

          .batchCard {
            grid-template-columns: 28px 52px minmax(0, 1fr);
          }

          .productImage {
            width: 50px;
            height: 58px;
          }

          .batchNumbers {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .batchActions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
