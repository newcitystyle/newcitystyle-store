"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import JsBarcode from "jsbarcode";

type ProductRow = {
  id: number;
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  price?: number | string | null;
  mrp?: number | string | null;
  stock?: number | string | null;
  sku?: string | null;
  barcode?: string | null;
  image?: string | null;
  image_url?: string | null;
  tax_percent?: number | string | null;
  online_stock_limit?: number | string | null;
  sell_online?: boolean | null;
  is_active?: boolean | null;
  status?: string | null;
};

type VariantRow = {
  id: number;
  product_id: number;
  size?: string | null;
  color?: string | null;
  sku?: string | null;
  barcode?: string | null;
  purchase_price?: number | string | null;
  selling_price?: number | string | null;
  mrp?: number | string | null;
  stock?: number | string | null;
  online_stock_limit?: number | string | null;
  sell_online?: boolean | null;
  is_active?: boolean | null;
};

type PurchaseProduct = {
  key: string;
  productId: number;
  variantId: number | null;
  name: string;
  category: string;
  price: number;
  mrp: number;
  stock: number;
  sku: string;
  barcode: string;
  size: string;
  color: string;
  taxPercent: number;
  imageUrl: string;
  onlineStockLimit: number;
  sellOnline: boolean;
};

type PurchaseItem = PurchaseProduct & {
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  purchaseMrp: number;
  purchaseTaxPercent: number;
  onlineStockLimit: number;
  sellOnline: boolean;
};

type PaymentMethod =
  | "cash"
  | "upi"
  | "card"
  | "bank_transfer"
  | "credit"
  | "other";

type TaxType =
  | "intra_state"
  | "inter_state"
  | "non_gst";

type DesignMode = "same_design" | "different_designs";

type GeneratedProductResult = NewProductPurchaseResult & {
  sequence: number;
};

type PurchaseResult = {
  success?: boolean;
  purchase_id?: string;
  purchase_number?: string;
  supplier_id?: number;
  subtotal?: number;
  tax_amount?: number;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  cess_amount?: number;
  tax_type?: TaxType;
  discount_amount?: number;
  transport_charge?: number;
  other_charge?: number;
  total_amount?: number;
  paid_amount?: number;
  due_amount?: number;
  payment_status?: string;
  message?: string;
};

type NewProductPurchaseResult = {
  success?: boolean;
  product_id?: number;
  variant_id?: number | null;
  product_name?: string;
  product_barcode?: string;
  variant_barcode?: string | null;
  barcode?: string;
  available_in_pos?: boolean;
  sell_online?: boolean;
  purchase?: PurchaseResult;
  message?: string;
};

const ROYAL_BLUE = "#0A2E73";
const DEEP_BLUE = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";
const CHARCOAL = "#2C2C2C";

function toNumber(
  value: number | string | null | undefined,
  fallback = 0
) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function getImage(product: ProductRow) {
  return (
    product.image_url?.trim() ||
    product.image?.trim() ||
    ""
  );
}

export default function PurchasesPage() {
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const [products, setProducts] = useState<PurchaseProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);

  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierGstin, setSupplierGstin] = useState("");
  const [supplierState, setSupplierState] =
    useState("Andhra Pradesh");
  const [supplierStateCode, setSupplierStateCode] =
    useState("37");
  const [placeOfSupply, setPlaceOfSupply] =
    useState("Andhra Pradesh");
  const [taxType, setTaxType] =
    useState<TaxType>("intra_state");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] =
    useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [discountAmount, setDiscountAmount] = useState(0);
  const [transportCharge, setTransportCharge] = useState(0);
  const [otherCharge, setOtherCharge] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<
    "success" | "error" | "info"
  >("info");

  const [successPurchase, setSuccessPurchase] =
    useState<PurchaseResult | null>(null);

  const [showNewProductForm, setShowNewProductForm] =
    useState(false);
  const [creatingNewProduct, setCreatingNewProduct] =
    useState(false);

  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] =
    useState("");
  const [newProductSubcategory, setNewProductSubcategory] =
    useState("");
  const [newProductBrand, setNewProductBrand] =
    useState("NEW CITY STYLE");
  const [newProductSize, setNewProductSize] = useState("");
  const [newProductColor, setNewProductColor] = useState("");
  const [newProductQuantity, setNewProductQuantity] =
    useState(1);
  const [newProductDesignMode, setNewProductDesignMode] =
    useState<DesignMode>("same_design");
  const [newProductPurchasePrice, setNewProductPurchasePrice] =
    useState(0);
  const [newProductSellingPrice, setNewProductSellingPrice] =
    useState(0);
  const [newProductMrp, setNewProductMrp] = useState(0);
  const [newProductHsn, setNewProductHsn] = useState("");
  const [newProductTaxPercent, setNewProductTaxPercent] =
    useState(0);
  const [newProductCessPercent, setNewProductCessPercent] =
    useState(0);
  const [newProductSellOnline, setNewProductSellOnline] =
    useState(false);
  const [
    newProductOnlineQuantity,
    setNewProductOnlineQuantity,
  ] = useState(0);
  const [newProductResult, setNewProductResult] =
    useState<NewProductPurchaseResult | null>(null);
  const [generatedProductResults, setGeneratedProductResults] =
    useState<GeneratedProductResult[]>([]);

  const [barcodePrintQuantity, setBarcodePrintQuantity] =
    useState(1);
  const [barcodeLabelSize, setBarcodeLabelSize] =
    useState("50x30");
  const [showPriceOnBarcode, setShowPriceOnBarcode] =
    useState(true);
  const [showMrpOnBarcode, setShowMrpOnBarcode] =
    useState(true);

  const showNotice = useCallback(
    (
      message: string,
      type: "success" | "error" | "info" = "info"
    ) => {
      setNotice(message);
      setNoticeType(type);

      window.setTimeout(() => {
        setNotice("");
      }, 3500);
    },
    []
  );

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .select(
            [
              "id",
              "name",
              "category",
              "subcategory",
              "brand",
              "price",
              "mrp",
              "stock",
              "sku",
              "barcode",
              "image",
              "image_url",
              "tax_percent",
              "online_stock_limit",
              "sell_online",
              "is_active",
              "status",
            ].join(",")
          )
          .order("created_at", {
            ascending: false,
          });

      if (productError) {
        throw productError;
      }

      const { data: variantData } = await supabase
        .from("product_variants")
        .select(
          [
            "id",
            "product_id",
            "size",
            "color",
            "sku",
            "barcode",
            "purchase_price",
            "selling_price",
            "mrp",
            "stock",
            "online_stock_limit",
            "sell_online",
            "is_active",
          ].join(",")
        )
        .eq("is_active", true);

      const safeProducts =
        (productData || []) as unknown as ProductRow[];
      const safeVariants =
        (variantData || []) as unknown as VariantRow[];

      const variantsByProduct = new Map<number, VariantRow[]>();

      safeVariants.forEach((variant) => {
        const current =
          variantsByProduct.get(variant.product_id) || [];

        current.push(variant);
        variantsByProduct.set(
          variant.product_id,
          current
        );
      });

      const mapped: PurchaseProduct[] = [];

      safeProducts.forEach((product) => {
        if (
          product.is_active === false ||
          normalizeText(product.status) === "inactive"
        ) {
          return;
        }

        const productId = Number(product.id);
        const variants =
          variantsByProduct.get(productId) || [];

        const common = {
          productId,
          name:
            product.name?.trim() ||
            "NEW CITY STYLE Product",
          category:
            product.category?.trim() || "Others",
          imageUrl: getImage(product),
          taxPercent: Math.max(
            0,
            toNumber(product.tax_percent)
          ),
          onlineStockLimit: Math.max(
            0,
            toNumber(product.online_stock_limit)
          ),
          sellOnline:
            product.sell_online === true,
        };

        if (variants.length > 0) {
          variants.forEach((variant) => {
            const sellingPrice =
              toNumber(variant.selling_price) ||
              toNumber(product.price);

            mapped.push({
              ...common,
              key: `variant-${variant.id}`,
              variantId: variant.id,
              price: sellingPrice,
              mrp:
                toNumber(variant.mrp) ||
                toNumber(product.mrp) ||
                sellingPrice,
              stock: Math.max(
                0,
                toNumber(variant.stock)
              ),
              sku:
                variant.sku?.trim() ||
                product.sku?.trim() ||
                "",
              barcode:
                variant.barcode?.trim() ||
                product.barcode?.trim() ||
                "",
              size: variant.size?.trim() || "",
              color: variant.color?.trim() || "",
              onlineStockLimit: Math.max(
                0,
                toNumber(variant.online_stock_limit)
              ),
              sellOnline:
                variant.sell_online === true,
            });
          });

          return;
        }

        const price = toNumber(product.price);

        mapped.push({
          ...common,
          key: `product-${productId}`,
          variantId: null,
          price,
          mrp: toNumber(product.mrp) || price,
          stock: Math.max(
            0,
            toNumber(product.stock)
          ),
          sku: product.sku?.trim() || "",
          barcode: product.barcode?.trim() || "",
          size: "",
          color: "",
        });
      });

      setProducts(mapped);
    } catch (error) {
      console.error(error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load products."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const barcodeValue =
      newProductResult?.barcode?.trim();

    if (!barcodeValue || !barcodeSvgRef.current) {
      return;
    }

    try {
      JsBarcode(
        barcodeSvgRef.current,
        barcodeValue,
        {
          format: "CODE128",
          width: 2,
          height: 58,
          displayValue: true,
          fontSize: 15,
          margin: 8,
          background: "#FFFFFF",
          lineColor: "#000000",
        }
      );
    } catch (error) {
      console.error(
        "Unable to render barcode:",
        error
      );
    }
  }, [newProductResult]);

  const filteredProducts = useMemo(() => {
    const query = normalizeText(searchQuery);

    if (!query) {
      return products;
    }

    return products.filter((product) =>
      [
        product.name,
        product.category,
        product.sku,
        product.barcode,
        product.size,
        product.color,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [products, searchQuery]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (total, item) =>
          total +
          item.purchasePrice * item.quantity,
        0
      ),
    [items]
  );

  const taxAmount = useMemo(
    () =>
      taxType === "non_gst"
        ? 0
        : items.reduce((total, item) => {
            const line =
              item.purchasePrice * item.quantity;

            return (
              total +
              (line * item.purchaseTaxPercent) / 100
            );
          }, 0),
    [items, taxType]
  );

  const cgstAmount =
    taxType === "intra_state"
      ? taxAmount / 2
      : 0;

  const sgstAmount =
    taxType === "intra_state"
      ? taxAmount - cgstAmount
      : 0;

  const igstAmount =
    taxType === "inter_state"
      ? taxAmount
      : 0;

  const totalAmount = Math.max(
    0,
    subtotal +
      taxAmount +
      transportCharge +
      otherCharge -
      discountAmount
  );

  const safePaidAmount = Math.min(
    Math.max(0, paidAmount),
    totalAmount
  );

  const dueAmount = Math.max(
    0,
    totalAmount - safePaidAmount
  );

  function addProduct(product: PurchaseProduct) {
    setItems((current) => {
      const existing = current.find(
        (item) => item.key === product.key
      );

      if (existing) {
        return current.map((item) =>
          item.key === product.key
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...current,
        {
          ...product,
          quantity: 1,
          purchasePrice: 0,
          sellingPrice: product.price,
          purchaseMrp: product.mrp,
          purchaseTaxPercent: product.taxPercent,
          onlineStockLimit:
            product.onlineStockLimit,
          sellOnline: product.sellOnline,
        },
      ];
    });

    setSearchQuery("");
    showNotice(
      `${product.name} added to purchase.`,
      "success"
    );
  }

  function updateItem(
    key: string,
    field:
      | "quantity"
      | "purchasePrice"
      | "sellingPrice"
      | "purchaseMrp"
      | "purchaseTaxPercent"
      | "onlineStockLimit",
    value: number
  ) {
    setItems((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              [field]:
                field === "quantity"
                  ? Math.max(1, Math.floor(value))
                  : Math.max(0, value),
            }
          : item
      )
    );
  }

  function removeItem(key: string) {
    setItems((current) =>
      current.filter((item) => item.key !== key)
    );
  }

  function clearForm() {
    setItems([]);
    setSupplierName("");
    setSupplierPhone("");
    setSupplierGstin("");
    setSupplierState("Andhra Pradesh");
    setSupplierStateCode("37");
    setPlaceOfSupply("Andhra Pradesh");
    setTaxType("intra_state");
    setSupplierInvoiceNumber("");
    setPurchaseDate(
      new Date().toISOString().slice(0, 10)
    );
    setDiscountAmount(0);
    setTransportCharge(0);
    setOtherCharge(0);
    setPaidAmount(0);
    setPaymentMethod("cash");
    setNotes("");
  }

  function printGeneratedBarcode() {
    const barcodeValue =
      newProductResult?.barcode?.trim();
    const barcodeSvg =
      barcodeSvgRef.current?.outerHTML;

    if (!barcodeValue || !barcodeSvg) {
      showNotice(
        "Barcode is not ready to print.",
        "error"
      );
      return;
    }

    const productName =
      newProductResult?.product_name ||
      "NEW CITY STYLE Product";

    const printCount = Math.max(
      1,
      Math.floor(barcodePrintQuantity)
    );

    const labelSizes: Record<
      string,
      { width: number; height: number }
    > = {
      "38x25": { width: 38, height: 25 },
      "50x25": { width: 50, height: 25 },
      "50x30": { width: 50, height: 30 },
      "60x40": { width: 60, height: 40 },
    };

    const selectedSize =
      labelSizes[barcodeLabelSize] ||
      labelSizes["50x30"];

    const sellingPrice =
      newProductSellingPrice > 0
        ? newProductSellingPrice
        : 0;

    const mrp =
      newProductMrp > 0
        ? newProductMrp
        : sellingPrice;

    const escapeHtml = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (character) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
          })[character] || character
      );

    const variantText = [
      newProductSize,
      newProductColor,
    ]
      .filter(Boolean)
      .join(" • ");

    const labelHtml = Array.from({
      length: printCount,
    })
      .map(
        () => `
          <div class="label">
            <p class="store">NEW CITY STYLE</p>
            <p class="product">${escapeHtml(
              productName
            )}</p>
            ${
              variantText
                ? `<p class="variant">${escapeHtml(
                    variantText
                  )}</p>`
                : ""
            }
            <div class="barcode">${barcodeSvg}</div>
            <div class="priceRow">
              ${
                showPriceOnBarcode &&
                sellingPrice > 0
                  ? `<span class="price">₹${sellingPrice.toFixed(
                      2
                    )}</span>`
                  : ""
              }
              ${
                showMrpOnBarcode &&
                mrp > 0
                  ? `<span class="mrp">MRP ₹${mrp.toFixed(
                      2
                    )}</span>`
                  : ""
              }
            </div>
          </div>
        `
      )
      .join("");

    const printWindow = window.open(
      "",
      "_blank",
      "width=700,height=700"
    );

    if (!printWindow) {
      showNotice(
        "Allow browser pop-ups to print barcodes.",
        "error"
      );
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${barcodeValue}</title>
          <style>
            @page {
              size: ${selectedSize.width}mm ${selectedSize.height}mm;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              font-family: Arial, sans-serif;
            }

            .label {
              width: ${selectedSize.width}mm;
              height: ${selectedSize.height}mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 1.5mm;
              overflow: hidden;
              page-break-after: always;
              break-after: page;
              background: #ffffff;
              color: #000000;
              text-align: center;
            }

            .label:last-child {
              page-break-after: auto;
              break-after: auto;
            }

            .store {
              margin: 0 0 0.6mm;
              font-size: ${
                selectedSize.width <= 38 ? 6 : 7
              }px;
              font-weight: 800;
              letter-spacing: 0.4px;
            }

            .product {
              max-width: 100%;
              margin: 0;
              overflow: hidden;
              font-size: ${
                selectedSize.width <= 38 ? 6 : 7
              }px;
              font-weight: 700;
              line-height: 1.15;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .variant {
              margin: 0.5mm 0 0;
              font-size: ${
                selectedSize.width <= 38 ? 5 : 6
              }px;
              font-weight: 700;
            }

            .barcode {
              width: 100%;
              margin-top: 0.5mm;
            }

            .barcode svg {
              width: 100%;
              height: ${
                selectedSize.height <= 25 ? 12 : 16
              }mm;
              display: block;
            }

            .priceRow {
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 2mm;
              margin-top: 0.5mm;
              font-size: ${
                selectedSize.width <= 38 ? 6 : 7
              }px;
              font-weight: 800;
            }

            .mrp {
              font-weight: 700;
            }

            @media print {
              body {
                width: ${selectedSize.width}mm;
              }
            }
          </style>
        </head>

        <body>
          ${labelHtml}

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

  function printAllGeneratedBarcodes() {
    if (generatedProductResults.length === 0) {
      showNotice("No generated barcodes are ready.", "error");
      return;
    }

    const labelSizes: Record<string, { width: number; height: number }> = {
      "38x25": { width: 38, height: 25 },
      "50x25": { width: 50, height: 25 },
      "50x30": { width: 50, height: 30 },
      "60x40": { width: 60, height: 40 },
    };

    const selectedSize =
      labelSizes[barcodeLabelSize] || labelSizes["50x30"];

    const labels = generatedProductResults
      .map((result) => {
        const barcodeValue =
          result.barcode?.trim() ||
          result.product_barcode?.trim() ||
          result.variant_barcode?.trim() ||
          "";

        if (!barcodeValue) return "";

        const svg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg"
        );

        JsBarcode(svg, barcodeValue, {
          format: "CODE128",
          width: 2,
          height: 58,
          displayValue: true,
          fontSize: 15,
          margin: 8,
          background: "#FFFFFF",
          lineColor: "#000000",
        });

        const productName =
          result.product_name || `Design ${result.sequence}`;

        return `
          <div class="label">
            <p class="store">NEW CITY STYLE</p>
            <p class="product">${productName.replace(/[&<>"']/g, "")}</p>
            <div class="barcode">${svg.outerHTML}</div>
            <p class="code">${barcodeValue}</p>
          </div>
        `;
      })
      .filter(Boolean)
      .join("");

    if (!labels) {
      showNotice("Generated barcode values are missing.", "error");
      return;
    }

    const printWindow = window.open(
      "",
      "_blank",
      "width=800,height=750"
    );

    if (!printWindow) {
      showNotice("Allow browser pop-ups to print barcodes.", "error");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>NEW CITY STYLE - Individual Barcodes</title>
          <style>
            @page { size: ${selectedSize.width}mm ${selectedSize.height}mm; margin: 0; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; background: #fff; font-family: Arial, sans-serif; }
            .label { width: ${selectedSize.width}mm; height: ${selectedSize.height}mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1.5mm; overflow: hidden; page-break-after: always; break-after: page; text-align: center; }
            .label:last-child { page-break-after: auto; break-after: auto; }
            .store { margin: 0 0 .5mm; font-size: 7px; font-weight: 800; letter-spacing: .4px; }
            .product { width: 100%; margin: 0; overflow: hidden; font-size: 7px; font-weight: 700; white-space: nowrap; text-overflow: ellipsis; }
            .barcode { width: 100%; margin-top: .4mm; }
            .barcode svg { width: 100%; height: ${selectedSize.height <= 25 ? 12 : 16}mm; display: block; }
            .code { margin: .2mm 0 0; font-size: 6px; font-weight: 700; }
          </style>
        </head>
        <body>
          ${labels}
          <script>
            window.onload = function () {
              window.print();
              window.onafterprint = function () { window.close(); };
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  function resetNewProductForm() {
    setNewProductName("");
    setNewProductCategory("");
    setNewProductSubcategory("");
    setNewProductBrand("NEW CITY STYLE");
    setNewProductSize("");
    setNewProductColor("");
    setNewProductQuantity(1);
    setNewProductDesignMode("same_design");
    setNewProductPurchasePrice(0);
    setNewProductSellingPrice(0);
    setNewProductMrp(0);
    setNewProductHsn("");
    setNewProductTaxPercent(0);
    setNewProductCessPercent(0);
    setNewProductSellOnline(false);
    setNewProductOnlineQuantity(0);
  }

  async function createNewProductPurchase(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (creatingNewProduct) return;

    if (!newProductName.trim()) {
      showNotice("Product name is required.", "error");
      return;
    }

    if (!newProductCategory.trim()) {
      showNotice("Category is required.", "error");
      return;
    }

    if (newProductQuantity <= 0) {
      showNotice("Quantity must be greater than zero.", "error");
      return;
    }

    if (newProductMrp <= 0) {
      showNotice("Please enter the product MRP.", "error");
      return;
    }

    if (newProductSellOnline && newProductSellingPrice <= 0) {
      showNotice(
        "Online selling price is required only when Sell Online is ON.",
        "error"
      );
      return;
    }

    if (
      newProductSellOnline &&
      newProductOnlineQuantity > newProductQuantity
    ) {
      showNotice(
        "Online quantity cannot exceed total quantity.",
        "error"
      );
      return;
    }

    setCreatingNewProduct(true);
    setGeneratedProductResults([]);

    try {
      const createCount =
        newProductDesignMode === "different_designs"
          ? newProductQuantity
          : 1;

      const createdResults: GeneratedProductResult[] = [];

      for (let index = 0; index < createCount; index += 1) {
        const isDifferentDesign =
          newProductDesignMode === "different_designs";
        const sequence = index + 1;
        const productName = isDifferentDesign
          ? `${newProductName.trim()} - Design ${String(sequence).padStart(2, "0")}`
          : newProductName.trim();
        const itemSellOnline =
          newProductSellOnline &&
          (!isDifferentDesign || sequence <= newProductOnlineQuantity);

        const { data, error } = await supabase.rpc(
          "create_new_product_purchase_gst",
          {
            p_product_name: productName,
            p_category: newProductCategory.trim(),
            p_subcategory: newProductSubcategory.trim() || null,
            p_brand: newProductBrand.trim() || "NEW CITY STYLE",
            p_size: newProductSize.trim() || null,
            p_color: newProductColor.trim() || null,
            p_quantity: isDifferentDesign ? 1 : newProductQuantity,
            p_purchase_price: newProductPurchasePrice,
            p_selling_price:
              itemSellOnline && newProductSellingPrice > 0
                ? newProductSellingPrice
                : newProductMrp,
            p_mrp: newProductMrp,
            p_hsn_code: newProductHsn.trim() || null,
            p_tax_percent:
              taxType === "non_gst" ? 0 : newProductTaxPercent,
            p_cess_percent:
              taxType === "non_gst" ? 0 : newProductCessPercent,
            p_available_in_pos: true,
            p_sell_online: itemSellOnline,
            p_supplier_id: null,
            p_supplier_name: supplierName.trim() || null,
            p_supplier_phone: supplierPhone.trim() || null,
            p_supplier_gstin: supplierGstin.trim() || null,
            p_supplier_state: supplierState.trim() || null,
            p_supplier_state_code: supplierStateCode.trim() || null,
            p_place_of_supply: placeOfSupply.trim() || null,
            p_tax_type: taxType,
            p_supplier_invoice_number:
              supplierInvoiceNumber.trim() || null,
            p_purchase_date: purchaseDate,
            p_discount_amount: index === 0 ? discountAmount : 0,
            p_transport_charge: index === 0 ? transportCharge : 0,
            p_other_charge: index === 0 ? otherCharge : 0,
            p_paid_amount: index === 0 ? safePaidAmount : 0,
            p_payment_method: paymentMethod,
            p_notes: notes.trim() || null,
          }
        );

        if (error) throw error;

        const result =
          (data || {}) as unknown as NewProductPurchaseResult;

        if (result.success === false) {
          throw new Error(
            result.message || `Unable to create product ${sequence}.`
          );
        }

        if (result.product_id) {
          const onlineQuantity = isDifferentDesign
            ? itemSellOnline
              ? 1
              : 0
            : newProductSellOnline
              ? Math.min(newProductOnlineQuantity, newProductQuantity)
              : 0;

          const { error: onlineStockError } = await supabase.rpc(
            "set_product_online_stock",
            {
              p_product_id: result.product_id,
              p_variant_id: result.variant_id || null,
              p_online_quantity: onlineQuantity,
              p_sell_online: itemSellOnline,
            }
          );

          if (onlineStockError) throw onlineStockError;
        }

        createdResults.push({
          ...result,
          product_name: result.product_name || productName,
          sell_online: itemSellOnline,
          sequence,
        });
      }

      const firstResult = createdResults[0] || null;
      setGeneratedProductResults(createdResults);
      setNewProductResult(firstResult);
      setBarcodePrintQuantity(
        newProductDesignMode === "different_designs"
          ? 1
          : Math.max(1, newProductQuantity)
      );
      setShowNewProductForm(false);
      resetNewProductForm();
      clearForm();
      await loadProducts();

      showNotice(
        createdResults.length > 1
          ? `${createdResults.length} products and separate barcodes created successfully.`
          : `${firstResult?.product_name || "New product"} created successfully.`,
        "success"
      );
    } catch (error) {
      console.error("Unable to create new product purchase:", error);
      showNotice(
        error instanceof Error
          ? error.message
          : "Unable to create new product.",
        "error"
      );
    } finally {
      setCreatingNewProduct(false);
    }
  }

  async function completePurchase(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (items.length === 0) {
      showNotice(
        "Add at least one product.",
        "error"
      );
      return;
    }

    const invalidItem = items.find(
      (item) =>
        item.quantity <= 0 ||
        item.purchasePrice < 0 ||
        item.purchaseMrp <= 0 ||
        (item.sellOnline &&
          item.sellingPrice <= 0)
    );

    if (invalidItem) {
      showNotice(
        invalidItem.sellOnline &&
          invalidItem.sellingPrice <= 0
          ? `Enter the online selling price for ${invalidItem.name}.`
          : `Check quantity, purchase price and MRP for ${invalidItem.name}.`,
        "error"
      );
      return;
    }

    setSaving(true);

    try {
      const rpcItems = items.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
        purchase_price: item.purchasePrice,
        selling_price:
          item.sellOnline &&
          item.sellingPrice > 0
            ? item.sellingPrice
            : item.purchaseMrp,
        mrp: item.purchaseMrp,
        tax_percent: item.purchaseTaxPercent,
      }));

      const { data, error } = await supabase.rpc(
        "complete_stock_purchase_gst",
        {
          p_items: rpcItems,
          p_supplier_id: null,
          p_supplier_name:
            supplierName.trim() || null,
          p_supplier_phone:
            supplierPhone.trim() || null,
          p_supplier_gstin:
            supplierGstin.trim() || null,
          p_supplier_state:
            supplierState.trim() || null,
          p_supplier_state_code:
            supplierStateCode.trim() || null,
          p_place_of_supply:
            placeOfSupply.trim() || null,
          p_tax_type: taxType,
          p_supplier_invoice_number:
            supplierInvoiceNumber.trim() || null,
          p_purchase_date: purchaseDate,
          p_discount_amount: discountAmount,
          p_transport_charge: transportCharge,
          p_other_charge: otherCharge,
          p_paid_amount: safePaidAmount,
          p_payment_method: paymentMethod,
          p_notes: notes.trim() || null,
        }
      );

      if (error) {
        throw error;
      }

      const result =
        (data || {}) as unknown as PurchaseResult;

      if (result.success === false) {
        throw new Error(
          result.message ||
            "Unable to complete purchase."
        );
      }

      for (const item of items) {
        const totalStockAfterPurchase =
          item.stock + item.quantity;

        const { error: onlineStockError } =
          await supabase.rpc(
            "set_product_online_stock",
            {
              p_product_id: item.productId,
              p_variant_id: item.variantId,
              p_online_quantity:
                item.sellOnline
                  ? Math.min(
                      item.onlineStockLimit,
                      totalStockAfterPurchase
                    )
                  : 0,
              p_sell_online: item.sellOnline,
            }
          );

        if (onlineStockError) {
          throw onlineStockError;
        }
      }

      setSuccessPurchase(result);
      clearForm();
      await loadProducts();

      showNotice(
        `${result.purchase_number || "Purchase"} completed successfully.`,
        "success"
      );
    } catch (error) {
      console.error(error);
      showNotice(
        error instanceof Error
          ? error.message
          : "Unable to complete purchase.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="ncsPurchasePage">
      {notice && (
        <div
          className={`ncsPurchaseNotice ncsPurchaseNotice-${noticeType}`}
        >
          <span>
            {noticeType === "success"
              ? "✓"
              : noticeType === "error"
                ? "!"
                : "i"}
          </span>
          <p>{notice}</p>
        </div>
      )}

      <section className="ncsPurchaseHeader">
        <div>
          <span>NEW CITY STYLE • INVENTORY</span>
          <h1>Purchase Stock Entry</h1>
          <p>
            Add supplier purchases, update stock and keep
            barcodes ready for billing.
          </p>
        </div>

        <button
          type="button"
          onClick={loadProducts}
          disabled={loading}
        >
          ↻ Refresh Products
        </button>
      </section>

      <form
        className="ncsPurchaseLayout"
        onSubmit={completePurchase}
      >
        <section className="ncsPurchaseMain">
          <div className="ncsPurchaseCard">
            <div className="ncsPurchaseCardTitle">
              <div>
                <span>SUPPLIER DETAILS</span>
                <h2>Purchase Information</h2>
              </div>
            </div>

            <div className="ncsPurchaseFormGrid">
              <label>
                <span>Supplier Name</span>
                <input
                  value={supplierName}
                  onChange={(event) =>
                    setSupplierName(event.target.value)
                  }
                  placeholder="Supplier name"
                />
              </label>

              <label>
                <span>Supplier Mobile</span>
                <input
                  value={supplierPhone}
                  onChange={(event) =>
                    setSupplierPhone(
                      event.target.value.replace(
                        /[^0-9+]/g,
                        ""
                      )
                    )
                  }
                  placeholder="Mobile number"
                />
              </label>

              <label>
                <span>Supplier GSTIN</span>
                <input
                  value={supplierGstin}
                  onChange={(event) =>
                    setSupplierGstin(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 15)
                    )
                  }
                  placeholder="15-digit GSTIN"
                  maxLength={15}
                />
              </label>

              <label>
                <span>Supplier State</span>
                <input
                  value={supplierState}
                  onChange={(event) =>
                    setSupplierState(event.target.value)
                  }
                  placeholder="State"
                />
              </label>

              <label>
                <span>State Code</span>
                <input
                  value={supplierStateCode}
                  onChange={(event) =>
                    setSupplierStateCode(
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 2)
                    )
                  }
                  placeholder="37"
                />
              </label>

              <label>
                <span>Place of Supply</span>
                <input
                  value={placeOfSupply}
                  onChange={(event) =>
                    setPlaceOfSupply(event.target.value)
                  }
                  placeholder="Place of supply"
                />
              </label>

              <label>
                <span>Tax Type</span>
                <select
                  value={taxType}
                  onChange={(event) =>
                    setTaxType(
                      event.target.value as TaxType
                    )
                  }
                >
                  <option value="intra_state">
                    Intra-state (CGST + SGST)
                  </option>
                  <option value="inter_state">
                    Inter-state (IGST)
                  </option>
                  <option value="non_gst">
                    Non-GST
                  </option>
                </select>
              </label>

              <label>
                <span>Supplier Invoice No.</span>
                <input
                  value={supplierInvoiceNumber}
                  onChange={(event) =>
                    setSupplierInvoiceNumber(
                      event.target.value
                    )
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                <span>Purchase Date</span>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(event) =>
                    setPurchaseDate(event.target.value)
                  }
                />
              </label>
            </div>
          </div>

          <div className="ncsPurchaseCard">
            <div className="ncsPurchaseCardTitle">
              <div>
                <span>PRODUCT SEARCH</span>
                <h2>Add Stock Items</h2>
              </div>

              <div className="ncsPurchaseTitleActions">
                <b>{products.length} Products</b>

                <button
                  type="button"
                  onClick={() =>
                    setShowNewProductForm(true)
                  }
                >
                  + Add New Product
                </button>
              </div>
            </div>

            <div className="ncsPurchaseSearch">
              <span>⌕</span>
              <input
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                placeholder="Search name, barcode, SKU, size or colour..."
              />
            </div>

            {loadError && (
              <div className="ncsPurchaseError">
                {loadError}
              </div>
            )}

            <div className="ncsPurchaseProductGrid">
              {loading ? (
                <p>Loading products...</p>
              ) : (
                filteredProducts
                  .slice(0, 20)
                  .map((product) => (
                    <article
                      key={product.key}
                      className="ncsPurchaseProduct"
                    >
                      <button
                        type="button"
                        className="ncsPurchaseProductMain"
                        onClick={() => addProduct(product)}
                        aria-label={`Add ${product.name} to purchase`}
                      >
                        <div>
                          {product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                            />
                          ) : (
                            <span>NCS</span>
                          )}
                        </div>

                        <section>
                          <small>{product.category}</small>
                          <strong>{product.name}</strong>
                          <p>
                            {[product.size, product.color]
                              .filter(Boolean)
                              .join(" • ") || "Standard Product"}
                          </p>
                          <em>Stock: {product.stock}</em>
                          <b>
                            {product.barcode ||
                              product.sku ||
                              "Barcode ready"}
                          </b>
                        </section>
                      </button>

                      <div className="ncsPurchaseProductActions">
                        <button
                          type="button"
                          className="ncsPurchaseEditButton"
                          onClick={() => {
                            window.location.href =
                              `/admin/products/edit/${product.productId}`;
                          }}
                          title="Edit product details, photo and online settings"
                        >
                          ✎ Edit
                        </button>

                        <button
                          type="button"
                          className="ncsPurchaseAddButton"
                          onClick={() => addProduct(product)}
                          title="Add this item to purchase"
                        >
                          + Add
                        </button>
                      </div>
                    </article>
                  ))
              )}
            </div>
          </div>

          <div className="ncsPurchaseCard">
            <div className="ncsPurchaseCardTitle">
              <div>
                <span>PURCHASE ITEMS</span>
                <h2>Stock & Price Entry</h2>
              </div>

              <b>{items.length} Item(s)</b>
            </div>

            {items.length === 0 ? (
              <div className="ncsPurchaseEmpty">
                <div>📦</div>
                <h3>No purchase items</h3>
                <p>Select products from above.</p>
              </div>
            ) : (
              <div className="ncsPurchaseItems">
                {items.map((item) => (
                  <article key={item.key}>
                    <header>
                      <div>
                        <h3>{item.name}</h3>
                        <p>
                          {[item.size, item.color]
                            .filter(Boolean)
                            .join(" • ") ||
                            item.category}
                        </p>
                        <small>
                          Barcode:{" "}
                          {item.barcode || "Auto generated"}
                        </small>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeItem(item.key)
                        }
                      >
                        ×
                      </button>
                    </header>

                    <div className="ncsPurchaseItemFields">
                      <label>
                        <span>Quantity</span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(
                              item.key,
                              "quantity",
                              toNumber(event.target.value)
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>Purchase Price</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.purchasePrice}
                          onChange={(event) =>
                            updateItem(
                              item.key,
                              "purchasePrice",
                              toNumber(event.target.value)
                            )
                          }
                        />
                      </label>

                      {item.sellOnline && (
                        <label>
                          <span>Online Selling Price</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.sellingPrice || ""}
                            onChange={(event) =>
                              updateItem(
                                item.key,
                                "sellingPrice",
                                toNumber(event.target.value)
                              )
                            }
                            placeholder="Required for online"
                          />
                        </label>
                      )}

                      <label>
                        <span>MRP *</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.purchaseMrp}
                          onChange={(event) =>
                            updateItem(
                              item.key,
                              "purchaseMrp",
                              toNumber(event.target.value)
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>Tax %</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            taxType === "non_gst"
                              ? 0
                              : item.purchaseTaxPercent
                          }
                          disabled={taxType === "non_gst"}
                          onChange={(event) =>
                            updateItem(
                              item.key,
                              "purchaseTaxPercent",
                              toNumber(event.target.value)
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          Online Qty After Purchase
                        </span>
                        <input
                          type="number"
                          min="0"
                          max={
                            item.stock + item.quantity
                          }
                          value={
                            item.sellOnline
                              ? item.onlineStockLimit
                              : 0
                          }
                          disabled={!item.sellOnline}
                          onChange={(event) =>
                            updateItem(
                              item.key,
                              "onlineStockLimit",
                              Math.min(
                                item.stock +
                                  item.quantity,
                                Math.max(
                                  0,
                                  Math.floor(
                                    toNumber(
                                      event.target.value
                                    )
                                  )
                                )
                              )
                            )
                          }
                        />
                      </label>

                      <label className="ncsPurchaseOnlineToggle">
                        <input
                          type="checkbox"
                          checked={item.sellOnline}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map(
                                (currentItem) =>
                                  currentItem.key ===
                                  item.key
                                    ? {
                                        ...currentItem,
                                        sellOnline:
                                          event.target
                                            .checked,
                                        onlineStockLimit:
                                          event.target
                                            .checked
                                            ? Math.min(
                                                currentItem
                                                  .onlineStockLimit,
                                                currentItem
                                                  .stock +
                                                  currentItem
                                                    .quantity
                                              )
                                            : 0,
                                      }
                                    : currentItem
                              )
                            )
                          }
                        />

                        <span>Sell Online</span>
                      </label>

                      <div className="ncsPurchaseLineTotal">
                        <span>Line Total</span>
                        <strong>
                          {formatCurrency(
                            item.purchasePrice *
                              item.quantity *
                              (1 +
                                item.purchaseTaxPercent /
                                  100)
                          )}
                        </strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="ncsPurchaseSummary">
          <div className="ncsPurchaseSummaryHeader">
            <span>PURCHASE SUMMARY</span>
            <h2>Stock Receipt</h2>
          </div>

          <div className="ncsPurchaseSummaryBody">
            <label>
              <span>Discount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountAmount || ""}
                onChange={(event) =>
                  setDiscountAmount(
                    Math.max(
                      0,
                      toNumber(event.target.value)
                    )
                  )
                }
              />
            </label>

            <label>
              <span>Transport Charge</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={transportCharge || ""}
                onChange={(event) =>
                  setTransportCharge(
                    Math.max(
                      0,
                      toNumber(event.target.value)
                    )
                  )
                }
              />
            </label>

            <label>
              <span>Other Charge</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={otherCharge || ""}
                onChange={(event) =>
                  setOtherCharge(
                    Math.max(
                      0,
                      toNumber(event.target.value)
                    )
                  )
                }
              />
            </label>

            <div className="ncsPurchaseTotals">
              <p>
                <span>Subtotal</span>
                <strong>
                  {formatCurrency(subtotal)}
                </strong>
              </p>

              <p>
                <span>Taxable Amount</span>
                <strong>
                  {formatCurrency(subtotal)}
                </strong>
              </p>

              {taxType === "intra_state" && (
                <>
                  <p>
                    <span>CGST</span>
                    <strong>
                      {formatCurrency(cgstAmount)}
                    </strong>
                  </p>

                  <p>
                    <span>SGST</span>
                    <strong>
                      {formatCurrency(sgstAmount)}
                    </strong>
                  </p>
                </>
              )}

              {taxType === "inter_state" && (
                <p>
                  <span>IGST</span>
                  <strong>
                    {formatCurrency(igstAmount)}
                  </strong>
                </p>
              )}

              {taxType === "non_gst" && (
                <p>
                  <span>GST</span>
                  <strong>
                    {formatCurrency(0)}
                  </strong>
                </p>
              )}

              <p>
                <span>Total GST</span>
                <strong>
                  {formatCurrency(taxAmount)}
                </strong>
              </p>

              <p>
                <span>Discount</span>
                <strong>
                  − {formatCurrency(discountAmount)}
                </strong>
              </p>

              <p className="ncsPurchaseGrandTotal">
                <span>Total Amount</span>
                <strong>
                  {formatCurrency(totalAmount)}
                </strong>
              </p>
            </div>

            <label>
              <span>Paid Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paidAmount || ""}
                onChange={(event) =>
                  setPaidAmount(
                    Math.max(
                      0,
                      toNumber(event.target.value)
                    )
                  )
                }
              />
            </label>

            <div className="ncsPurchaseDue">
              <span>Supplier Due</span>
              <strong>
                {formatCurrency(dueAmount)}
              </strong>
            </div>

            <span className="ncsPurchasePaymentLabel">
              Payment Method
            </span>

            <div className="ncsPurchasePaymentGrid">
              {(
                [
                  ["cash", "Cash"],
                  ["upi", "UPI"],
                  ["card", "Card"],
                  ["bank_transfer", "Bank"],
                  ["credit", "Credit"],
                  ["other", "Other"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setPaymentMethod(value)
                  }
                  className={
                    paymentMethod === value
                      ? "active"
                      : ""
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            <label>
              <span>Notes</span>
              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Optional purchase notes"
              />
            </label>

            <button
              type="submit"
              className="ncsPurchaseComplete"
              disabled={saving || items.length === 0}
            >
              <span>{saving ? "…" : "✓"}</span>
              <div>
                <strong>
                  {saving
                    ? "Updating Stock..."
                    : "Complete Purchase"}
                </strong>
                <small>
                  {formatCurrency(totalAmount)}
                </small>
              </div>
              <b>→</b>
            </button>
          </div>
        </aside>
      </form>

      {showNewProductForm && (
        <div className="ncsPurchaseModalOverlay">
          <form
            className="ncsNewProductModal"
            onSubmit={createNewProductPurchase}
          >
            <header>
              <div>
                <span>NEW SHOP STOCK</span>
                <h2>Create New Product</h2>
                <p>
                  Product, barcode and stock will be created
                  together.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowNewProductForm(false)
                }
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="ncsNewProductFormGrid">
              <label className="ncsNewProductWide">
                <span>Product Name *</span>
                <input
                  value={newProductName}
                  onChange={(event) =>
                    setNewProductName(event.target.value)
                  }
                  placeholder="Example: Men Cotton Shirt"
                  autoFocus
                />
              </label>

              <label>
                <span>Category *</span>
                <input
                  value={newProductCategory}
                  onChange={(event) =>
                    setNewProductCategory(
                      event.target.value
                    )
                  }
                  placeholder="Men / Women / Kids"
                />
              </label>

              <label>
                <span>Subcategory</span>
                <input
                  value={newProductSubcategory}
                  onChange={(event) =>
                    setNewProductSubcategory(
                      event.target.value
                    )
                  }
                  placeholder="Shirts / Jeans / Sarees"
                />
              </label>

              <label>
                <span>Brand</span>
                <input
                  value={newProductBrand}
                  onChange={(event) =>
                    setNewProductBrand(
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>Size</span>
                <input
                  value={newProductSize}
                  onChange={(event) =>
                    setNewProductSize(event.target.value)
                  }
                  placeholder="M / L / XL"
                />
              </label>

              <label>
                <span>Colour</span>
                <input
                  value={newProductColor}
                  onChange={(event) =>
                    setNewProductColor(event.target.value)
                  }
                  placeholder="Blue"
                />
              </label>

              <div className="ncsNewProductWide ncsDesignModeBox">
                <span>Stock Design Type *</span>
                <div className="ncsDesignModeButtons">
                  <button
                    type="button"
                    className={newProductDesignMode === "same_design" ? "active" : ""}
                    onClick={() => setNewProductDesignMode("same_design")}
                  >
                    Same Design
                    <small>One barcode, multiple quantity</small>
                  </button>

                  <button
                    type="button"
                    className={newProductDesignMode === "different_designs" ? "active" : ""}
                    onClick={() => setNewProductDesignMode("different_designs")}
                  >
                    Different Designs
                    <small>One barcode for every piece</small>
                  </button>
                </div>
                <small className="ncsDesignModeHelp">
                  Colour is ignored for barcode logic. Different Designs select చేస్తే quantity ఎంత ఉంటే అంత separate products మరియు separate barcodes వస్తాయి.
                </small>
              </div>

              <label>
                <span>Quantity *</span>
                <input
                  type="number"
                  min="1"
                  value={newProductQuantity}
                  onChange={(event) =>
                    setNewProductQuantity(
                      Math.max(
                        1,
                        Math.floor(
                          toNumber(event.target.value, 1)
                        )
                      )
                    )
                  }
                />
              </label>

              <label>
                <span>Purchase Price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProductPurchasePrice || ""}
                  onChange={(event) =>
                    setNewProductPurchasePrice(
                      Math.max(
                        0,
                        toNumber(event.target.value)
                      )
                    )
                  }
                />
              </label>

              {newProductSellOnline && (
                <label>
                  <span>Online Selling Price *</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newProductSellingPrice || ""}
                    onChange={(event) =>
                      setNewProductSellingPrice(
                        Math.max(
                          0,
                          toNumber(event.target.value)
                        )
                      )
                    }
                    placeholder="Required only for online sale"
                  />
                </label>
              )}

              <label>
                <span>MRP</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProductMrp || ""}
                  onChange={(event) =>
                    setNewProductMrp(
                      Math.max(
                        0,
                        toNumber(event.target.value)
                      )
                    )
                  }
                />
              </label>

              <label>
                <span>HSN Code</span>
                <input
                  value={newProductHsn}
                  onChange={(event) =>
                    setNewProductHsn(
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 8)
                    )
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                <span>GST %</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    taxType === "non_gst"
                      ? 0
                      : newProductTaxPercent
                  }
                  disabled={taxType === "non_gst"}
                  onChange={(event) =>
                    setNewProductTaxPercent(
                      Math.max(
                        0,
                        toNumber(event.target.value)
                      )
                    )
                  }
                />
              </label>

              <label>
                <span>Cess %</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    taxType === "non_gst"
                      ? 0
                      : newProductCessPercent
                  }
                  disabled={taxType === "non_gst"}
                  onChange={(event) =>
                    setNewProductCessPercent(
                      Math.max(
                        0,
                        toNumber(event.target.value)
                      )
                    )
                  }
                />
              </label>

              <label className="ncsNewProductToggle">
                <input
                  type="checkbox"
                  checked={newProductSellOnline}
                  onChange={(event) => {
                    const checked =
                      event.target.checked;

                    setNewProductSellOnline(checked);
                    setNewProductOnlineQuantity(
                      checked
                        ? Math.min(
                            newProductQuantity,
                            Math.max(
                              1,
                              newProductOnlineQuantity
                            )
                          )
                        : 0
                    );
                  }}
                />

                <div>
                  <strong>Sell Online</strong>
                  <span>
                    OFF = POS/shop only, ON = website/app
                  </span>
                </div>
              </label>

              <label className="ncsNewProductWide">
                <span>
                  Online Quantity
                </span>
                <input
                  type="number"
                  min="0"
                  max={newProductQuantity}
                  value={
                    newProductSellOnline
                      ? newProductOnlineQuantity
                      : 0
                  }
                  disabled={!newProductSellOnline}
                  onChange={(event) =>
                    setNewProductOnlineQuantity(
                      Math.min(
                        newProductQuantity,
                        Math.max(
                          0,
                          Math.floor(
                            toNumber(
                              event.target.value
                            )
                          )
                        )
                      )
                    )
                  }
                />
                <small>
                  Total {newProductQuantity}లో onlineలో
                  అమ్మాల్సిన quantity మాత్రమే పెట్టండి.
                </small>
              </label>
            </div>

            <div className="ncsLocalPriceNote">
              <strong>Local POS Price:</strong>
              Barcode scan చేసినప్పుడు MRP వస్తుంది. Billingలో
              discount ఇచ్చి final price నిర్ణయించవచ్చు.
              Online Selling Price మాత్రం Sell Online ON చేసినప్పుడు
              మాత్రమే అవసరం.
            </div>

            <div className="ncsNewProductSummary">
              <div>
                <span>Stock Value</span>
                <strong>
                  {formatCurrency(
                    newProductPurchasePrice *
                      newProductQuantity
                  )}
                </strong>
              </div>

              <div>
                <span>Visibility</span>
                <strong>
                  {newProductSellOnline
                    ? `POS + Online (${newProductOnlineQuantity})`
                    : "POS / Shop Only"}
                </strong>
              </div>

              <div>
                <span>Barcode</span>
                <strong>
                  {newProductDesignMode === "different_designs"
                    ? `${newProductQuantity} Separate Codes`
                    : "One Auto Barcode"}
                </strong>
              </div>
            </div>

            <footer>
              <button
                type="button"
                onClick={() =>
                  setShowNewProductForm(false)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={creatingNewProduct}
              >
                {creatingNewProduct
                  ? "Creating Product..."
                  : "Create Product & Add Stock"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {newProductResult && (
        <div className="ncsPurchaseModalOverlay">
          <section className="ncsNewProductSuccess">
            <div>✓</div>
            <span>PRODUCT CREATED</span>
            <h2>
              {generatedProductResults.length > 1
                ? `${generatedProductResults.length} Different Products Created`
                : newProductResult.product_name}
            </h2>
            <p>
              {generatedProductResults.length > 1
                ? "Each design has stock 1 and its own barcode."
                : "Product, stock and purchase entry were saved successfully."}
            </p>

            <section className="ncsGeneratedBarcodeCard">
              <span>Generated Barcode</span>

              <div className="ncsGeneratedBarcodePreview">
                <svg ref={barcodeSvgRef} />
              </div>

              <strong>
                {newProductResult.barcode ||
                  "Barcode generated"}
              </strong>
            </section>

            {generatedProductResults.length > 1 && (
              <div className="ncsGeneratedBarcodeList">
                {generatedProductResults.map((result) => (
                  <article key={`${result.product_id}-${result.sequence}`}>
                    <span>Design {String(result.sequence).padStart(2, "0")}</span>
                    <strong>{result.barcode || result.product_barcode || "Generated"}</strong>
                    <button
                      type="button"
                      onClick={() => {
                        if (result.product_id) {
                          window.location.href = `/admin/products/edit/${result.product_id}`;
                        }
                      }}
                    >
                      Edit / Upload Photo
                    </button>
                  </article>
                ))}
              </div>
            )}

            <small>
              {newProductResult.sell_online
                ? `Available in POS and online quantity ${newProductOnlineQuantity}.`
                : "Available in POS/shop only."}
            </small>

            <div className="ncsBarcodePrintSettings">
              <label>
                <span>Number of Labels</span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={barcodePrintQuantity}
                  onChange={(event) =>
                    setBarcodePrintQuantity(
                      Math.max(
                        1,
                        Math.min(
                          500,
                          Math.floor(
                            toNumber(
                              event.target.value,
                              1
                            )
                          )
                        )
                      )
                    )
                  }
                />
              </label>

              <label>
                <span>Label Size</span>
                <select
                  value={barcodeLabelSize}
                  onChange={(event) =>
                    setBarcodeLabelSize(
                      event.target.value
                    )
                  }
                >
                  <option value="38x25">
                    38 × 25 mm
                  </option>
                  <option value="50x25">
                    50 × 25 mm
                  </option>
                  <option value="50x30">
                    50 × 30 mm
                  </option>
                  <option value="60x40">
                    60 × 40 mm
                  </option>
                </select>
              </label>

              <label className="ncsBarcodePrintCheck">
                <input
                  type="checkbox"
                  checked={showPriceOnBarcode}
                  onChange={(event) =>
                    setShowPriceOnBarcode(
                      event.target.checked
                    )
                  }
                />
                <span>Show Selling Price</span>
              </label>

              <label className="ncsBarcodePrintCheck">
                <input
                  type="checkbox"
                  checked={showMrpOnBarcode}
                  onChange={(event) =>
                    setShowMrpOnBarcode(
                      event.target.checked
                    )
                  }
                />
                <span>Show MRP</span>
              </label>
            </div>

            <div className="ncsNewProductSuccessActions">
              <button
                type="button"
                onClick={
                  generatedProductResults.length > 1
                    ? printAllGeneratedBarcodes
                    : printGeneratedBarcode
                }
              >
                {generatedProductResults.length > 1
                  ? "🖨 Print All Separate Barcodes"
                  : "🖨 Print Labels"}
              </button>

              <button
                type="button"
                onClick={() =>
                  setNewProductResult(null)
                }
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}

      {successPurchase && (
        <div className="ncsPurchaseModalOverlay">
          <section className="ncsPurchaseSuccessModal">
            <div>✓</div>
            <span>PURCHASE COMPLETED</span>
            <h2>
              {successPurchase.purchase_number}
            </h2>
            <p>
              Stock and supplier balance updated
              successfully.
            </p>

            <section>
              <p>
                <span>Total</span>
                <strong>
                  {formatCurrency(
                    toNumber(
                      successPurchase.total_amount
                    )
                  )}
                </strong>
              </p>

              <p>
                <span>Taxable</span>
                <strong>
                  {formatCurrency(
                    toNumber(
                      successPurchase.taxable_amount
                    )
                  )}
                </strong>
              </p>

              <p>
                <span>CGST</span>
                <strong>
                  {formatCurrency(
                    toNumber(
                      successPurchase.cgst_amount
                    )
                  )}
                </strong>
              </p>

              <p>
                <span>SGST</span>
                <strong>
                  {formatCurrency(
                    toNumber(
                      successPurchase.sgst_amount
                    )
                  )}
                </strong>
              </p>

              <p>
                <span>IGST</span>
                <strong>
                  {formatCurrency(
                    toNumber(
                      successPurchase.igst_amount
                    )
                  )}
                </strong>
              </p>

              <p>
                <span>Paid</span>
                <strong>
                  {formatCurrency(
                    toNumber(
                      successPurchase.paid_amount
                    )
                  )}
                </strong>
              </p>

              <p>
                <span>Due</span>
                <strong>
                  {formatCurrency(
                    toNumber(
                      successPurchase.due_amount
                    )
                  )}
                </strong>
              </p>
            </section>

            <button
              type="button"
              onClick={() =>
                setSuccessPurchase(null)
              }
            >
              New Purchase
            </button>
          </section>
        </div>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .ncsPurchasePage {
          min-height: 100vh;
          padding: 26px;
          background:
            radial-gradient(
              circle at 10% 0%,
              rgba(212, 175, 55, 0.12),
              transparent 26%
            ),
            ${IVORY};
          color: ${CHARCOAL};
          font-family:
            Poppins, Inter, Arial, sans-serif;
        }

        .ncsPurchaseHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
          padding: 22px 24px;
          border: 1px solid
            rgba(212, 175, 55, 0.35);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 88% 0%,
              rgba(212, 175, 55, 0.23),
              transparent 32%
            ),
            linear-gradient(
              135deg,
              ${DEEP_BLUE},
              ${ROYAL_BLUE}
            );
          color: #ffffff;
          box-shadow: 0 18px 45px
            rgba(3, 21, 63, 0.18);
        }

        .ncsPurchaseHeader span {
          color: ${GOLD};
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .ncsPurchaseHeader h1 {
          margin: 5px 0 0;
          color: #ffffff;
          font-size: 32px;
          font-weight: 950;
        }

        .ncsPurchaseHeader p {
          margin: 6px 0 0;
          color: rgba(255, 255, 255, 0.68);
          font-size: 12px;
          font-weight: 600;
        }

        .ncsPurchaseHeader button {
          min-height: 44px;
          padding: 0 15px;
          border: 1px solid ${GOLD};
          border-radius: 12px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-family: inherit;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsPurchaseLayout {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(340px, 390px);
          gap: 20px;
          align-items: start;
        }

        .ncsPurchaseMain {
          min-width: 0;
          display: grid;
          gap: 16px;
        }

        .ncsPurchaseCard {
          position: relative;
          overflow: hidden;
          padding: 18px;
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 20px;
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 1),
              rgba(248, 250, 253, 0.99)
            );
          box-shadow:
            0 12px 32px rgba(3, 21, 63, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.95);
          transition:
            border-color 0.22s ease,
            box-shadow 0.22s ease;
        }

        .ncsPurchaseCard:hover {
          border-color: rgba(212, 175, 55, 0.38);
          box-shadow: 0 15px 36px rgba(3, 21, 63, 0.11);
        }

        .ncsPurchaseCardTitle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .ncsPurchaseCardTitle span {
          display: block;
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .ncsPurchaseCardTitle h2 {
          margin: 3px 0 0;
          color: ${DEEP_BLUE};
          font-size: 19px;
          font-weight: 950;
        }

        .ncsPurchaseCardTitle > b {
          padding: 7px 10px;
          border-radius: 20px;
          background: #eef2f9;
          color: ${ROYAL_BLUE};
          font-size: 9px;
        }

        .ncsPurchaseTitleActions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ncsPurchaseTitleActions > b {
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 12px;
          border: 1px solid rgba(212, 175, 55, 0.22);
          border-radius: 20px;
          background: linear-gradient(135deg, #eef3ff, #ffffff);
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 900;
          white-space: nowrap;
        }

        .ncsPurchaseTitleActions > button {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 14px;
          border: 1px solid rgba(212, 175, 55, 0.82);
          border-radius: 10px;
          background: linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: #ffffff;
          font-family: inherit;
          font-size: 9px;
          font-weight: 900;
          white-space: nowrap;
          cursor: pointer;
          box-shadow: 0 9px 20px rgba(3, 21, 63, 0.16);
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            filter 0.18s ease;
        }

        .ncsPurchaseTitleActions > button:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(3, 21, 63, 0.22);
          filter: brightness(1.05);
        }

        .ncsPurchaseTitleActions > button {
          min-height: 35px;
          padding: 0 11px;
          border: 1px solid ${GOLD};
          border-radius: 10px;
          background: ${ROYAL_BLUE};
          color: #ffffff;
          font-family: inherit;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsPurchaseFormGrid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 11px;
        }

        .ncsPurchaseFormGrid label,
        .ncsPurchaseSummaryBody label,
        .ncsPurchaseItemFields label {
          display: grid;
          gap: 5px;
        }

        .ncsPurchaseFormGrid label > span,
        .ncsPurchaseSummaryBody label > span,
        .ncsPurchaseItemFields label > span {
          color: #68717e;
          font-size: 9px;
          font-weight: 800;
        }

        .ncsPurchaseFormGrid input,
        .ncsPurchaseFormGrid select,
        .ncsPurchaseSummaryBody input,
        .ncsPurchaseSummaryBody textarea,
        .ncsPurchaseItemFields input {
          width: 100%;
          min-width: 0;
          min-height: 41px;
          padding: 0 10px;
          border: 1px solid #dfe4eb;
          border-radius: 10px;
          outline: none;
          background: #ffffff;
          color: ${CHARCOAL};
          font-family: inherit;
          font-size: 10px;
          font-weight: 700;
        }

        .ncsPurchaseFormGrid input:focus,
        .ncsPurchaseFormGrid select:focus,
        .ncsPurchaseSummaryBody input:focus,
        .ncsPurchaseSummaryBody textarea:focus,
        .ncsPurchaseItemFields input:focus {
          border-color: ${GOLD};
          box-shadow: 0 0 0 3px
            rgba(212, 175, 55, 0.12);
        }

        .ncsPurchaseSearch {
          display: flex;
          align-items: center;
          min-height: 50px;
          padding: 0 13px;
          border: 1px solid #dfe4eb;
          border-radius: 13px;
          background: #fafbfe;
        }

        .ncsPurchaseSearch span {
          margin-right: 9px;
          color: ${ROYAL_BLUE};
          font-size: 22px;
        }

        .ncsPurchaseSearch input {
          width: 100%;
          border: 0;
          outline: none;
          background: transparent;
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
        }

        .ncsPurchaseProductGrid {
          max-height: 440px;
          display: grid;
          grid-template-columns: repeat(
            auto-fill,
            minmax(290px, 1fr)
          );
          gap: 12px;
          margin-top: 13px;
          padding: 2px;
          overflow-y: auto;
        }

        .ncsPurchaseProduct {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border: 1px solid #e5e8ee;
          border-radius: 14px;
          background: #ffffff;
          text-align: left;
          cursor: pointer;
        }

        .ncsPurchaseProduct:hover {
          border-color: ${GOLD};
        }

        .ncsPurchaseProduct > div {
          width: 58px;
          height: 65px;
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

        .ncsPurchaseProduct img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ncsPurchaseProduct section {
          min-width: 0;
          flex: 1;
        }

        .ncsPurchaseProduct small,
        .ncsPurchaseProduct strong,
        .ncsPurchaseProduct p,
        .ncsPurchaseProduct em,
        .ncsPurchaseProduct section > b {
          display: block;
        }

        .ncsPurchaseProduct small {
          color: ${GOLD};
          font-size: 8px;
          font-weight: 900;
        }

        .ncsPurchaseProduct strong {
          margin-top: 3px;
          color: ${DEEP_BLUE};
          font-size: 10px;
          line-height: 1.4;
        }

        .ncsPurchaseProduct p,
        .ncsPurchaseProduct em,
        .ncsPurchaseProduct section > b {
          margin: 3px 0 0;
          color: #858c98;
          font-size: 8px;
          font-style: normal;
          font-weight: 650;
        }

        .ncsPurchaseProduct section > b {
          color: ${ROYAL_BLUE};
        }

        .ncsPurchaseProduct > i {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 9px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-size: 18px;
          font-style: normal;
          font-weight: 950;
        }

        .ncsPurchaseProduct {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 86px;
          align-items: stretch;
          gap: 10px;
          min-height: 96px;
          padding: 10px;
          border-color: rgba(10, 46, 115, 0.12);
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 1),
              rgba(247, 249, 253, 0.98)
            );
          box-shadow: 0 7px 18px rgba(3, 21, 63, 0.06);
          text-align: left;
          cursor: default;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            border-color 0.2s ease;
        }

        .ncsPurchaseProduct:hover {
          transform: translateY(-2px);
          border-color: rgba(212, 175, 55, 0.52);
          box-shadow: 0 12px 26px rgba(3, 21, 63, 0.11);
        }

        .ncsPurchaseProductMain {
          min-width: 0;
          width: 100%;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 2px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .ncsPurchaseProductMain > div {
          width: 58px;
          height: 65px;
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

        .ncsPurchaseProductMain section {
          min-width: 0;
          flex: 1;
        }

        .ncsPurchaseProductActions {
          position: relative;
          z-index: 5;
          width: 86px;
          min-width: 86px;
          display: grid;
          grid-template-rows: 1fr 1fr;
          align-content: stretch;
          gap: 8px;
        }

        .ncsPurchaseProductActions button {
          width: 100%;
          min-width: 0;
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 8px;
          border-radius: 9px;
          font-family: inherit;
          font-size: 9px;
          font-weight: 900;
          line-height: 1;
          white-space: nowrap;
          cursor: pointer;
          overflow: hidden;
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            filter 0.18s ease;
        }

        .ncsPurchaseEditButton {
          border: 1px solid rgba(10, 46, 115, 0.26);
          background: linear-gradient(180deg, #ffffff, #eef3ff);
          color: ${ROYAL_BLUE};
        }

        .ncsPurchaseEditButton:hover {
          transform: translateY(-1px);
          border-color: rgba(212, 175, 55, 0.62);
          background: linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: #ffffff;
          box-shadow: 0 8px 18px rgba(3, 21, 63, 0.18);
        }

        .ncsPurchaseAddButton {
          border: 1px solid rgba(212, 175, 55, 0.92);
          background: linear-gradient(135deg, ${GOLD}, #f0d267);
          color: ${DEEP_BLUE};
          box-shadow: 0 7px 16px rgba(212, 175, 55, 0.18);
        }

        .ncsPurchaseAddButton:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 20px rgba(212, 175, 55, 0.25);
          filter: brightness(1.03);
        }

        .ncsPurchaseItems {
          display: grid;
          gap: 10px;
        }

        .ncsPurchaseItems article {
          padding: 14px;
          border: 1px solid rgba(10, 46, 115, 0.12);
          border-radius: 15px;
          background: linear-gradient(180deg, #ffffff, #f7f9fd);
          box-shadow: 0 7px 18px rgba(3, 21, 63, 0.05);
        }

        .ncsPurchaseItems article header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .ncsPurchaseItems h3 {
          margin: 0;
          color: ${DEEP_BLUE};
          font-size: 12px;
          font-weight: 900;
        }

        .ncsPurchaseItems header p,
        .ncsPurchaseItems header small {
          margin: 3px 0 0;
          color: #858c98;
          font-size: 8px;
          font-weight: 650;
        }

        .ncsPurchaseItems header button {
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 9px;
          background: #fff0f0;
          color: #b63b3b;
          font-size: 18px;
          cursor: pointer;
        }

        .ncsPurchaseItemFields {
          display: grid;
          grid-template-columns: repeat(
            8,
            minmax(90px, 1fr)
          );
          gap: 8px;
          margin-top: 11px;
        }

        .ncsPurchaseOnlineToggle {
          display: flex !important;
          align-items: center;
          justify-content: center;
          gap: 7px !important;
          min-height: 41px;
          align-self: end;
          padding: 8px;
          border: 1px solid #dfe4eb;
          border-radius: 10px;
          background: #ffffff;
          cursor: pointer;
        }

        .ncsPurchaseOnlineToggle input {
          width: 17px;
          min-height: 17px;
          accent-color: ${ROYAL_BLUE};
        }

        .ncsPurchaseOnlineToggle span {
          color: ${DEEP_BLUE} !important;
          font-size: 8px !important;
          font-weight: 850 !important;
        }

        .ncsPurchaseLineTotal {
          display: grid;
          align-content: center;
          padding: 8px;
          border-radius: 10px;
          background: ${ROYAL_BLUE};
          color: #ffffff;
        }

        .ncsPurchaseLineTotal span {
          color: ${GOLD};
          font-size: 8px;
          font-weight: 800;
        }

        .ncsPurchaseLineTotal strong {
          margin-top: 3px;
          font-size: 10px;
        }

        .ncsPurchaseEmpty {
          min-height: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px dashed #dfe4eb;
          border-radius: 15px;
          background: #fafbfe;
          text-align: center;
        }

        .ncsPurchaseEmpty div {
          font-size: 28px;
        }

        .ncsPurchaseEmpty h3 {
          margin: 8px 0 2px;
          color: ${DEEP_BLUE};
          font-size: 13px;
        }

        .ncsPurchaseEmpty p {
          margin: 0;
          color: #8d94a0;
          font-size: 9px;
        }

        .ncsPurchaseSummary {
          position: sticky;
          top: 18px;
          overflow: hidden;
          border: 1px solid
            rgba(10, 46, 115, 0.12);
          border-radius: 20px;
          background: #ffffff;
          box-shadow: 0 18px 48px
            rgba(3, 21, 63, 0.13);
        }

        .ncsPurchaseSummaryHeader {
          padding: 18px;
          background:
            radial-gradient(
              circle at 85% 0%,
              rgba(212, 175, 55, 0.2),
              transparent 30%
            ),
            linear-gradient(
              135deg,
              ${DEEP_BLUE},
              ${ROYAL_BLUE}
            );
        }

        .ncsPurchaseSummaryHeader span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .ncsPurchaseSummaryHeader h2 {
          margin: 4px 0 0;
          color: #ffffff;
          font-size: 20px;
          font-weight: 950;
        }

        .ncsPurchaseSummaryBody {
          display: grid;
          gap: 11px;
          padding: 16px;
        }

        .ncsPurchaseSummaryBody textarea {
          min-height: 76px;
          padding-top: 10px;
          resize: vertical;
        }

        .ncsPurchaseTotals {
          padding: 12px;
          border-radius: 13px;
          background: #f7f9fc;
        }

        .ncsPurchaseTotals p {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin: 0;
          padding: 4px 0;
          color: #6e7683;
          font-size: 9px;
          font-weight: 700;
        }

        .ncsPurchaseTotals strong {
          color: ${DEEP_BLUE};
          font-size: 10px;
        }

        .ncsPurchaseGrandTotal {
          margin-top: 7px !important;
          padding-top: 10px !important;
          border-top: 1px dashed #d5dbe4;
        }

        .ncsPurchaseGrandTotal span {
          color: ${DEEP_BLUE};
          font-size: 12px;
          font-weight: 950;
        }

        .ncsPurchaseGrandTotal strong {
          color: ${ROYAL_BLUE};
          font-size: 18px;
        }

        .ncsPurchaseDue {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px;
          border-radius: 11px;
          background: #fff4e8;
          color: #9d5c13;
          font-size: 10px;
          font-weight: 900;
        }

        .ncsPurchasePaymentLabel {
          color: ${DEEP_BLUE};
          font-size: 9px;
          font-weight: 900;
        }

        .ncsPurchasePaymentGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 7px;
        }

        .ncsPurchasePaymentGrid button {
          min-height: 38px;
          border: 1px solid #dfe4eb;
          border-radius: 9px;
          background: #ffffff;
          color: #66707d;
          font-family: inherit;
          font-size: 8px;
          font-weight: 850;
          cursor: pointer;
        }

        .ncsPurchasePaymentGrid button.active {
          border-color: ${GOLD};
          background: rgba(212, 175, 55, 0.13);
          color: ${ROYAL_BLUE};
        }

        .ncsPurchaseComplete {
          min-height: 59px;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 8px 13px;
          border: 1px solid ${GOLD};
          border-radius: 13px;
          background: linear-gradient(
            135deg,
            ${ROYAL_BLUE},
            #174da4
          );
          color: #ffffff;
          font-family: inherit;
          cursor: pointer;
        }

        .ncsPurchaseComplete:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .ncsPurchaseComplete > span {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-size: 17px;
          font-weight: 950;
        }

        .ncsPurchaseComplete > div {
          min-width: 0;
          flex: 1;
          text-align: left;
        }

        .ncsPurchaseComplete strong,
        .ncsPurchaseComplete small {
          display: block;
        }

        .ncsPurchaseComplete strong {
          font-size: 11px;
          font-weight: 950;
        }

        .ncsPurchaseComplete small {
          margin-top: 3px;
          color: ${GOLD};
          font-size: 10px;
          font-weight: 850;
        }

        .ncsPurchaseComplete > b {
          font-size: 18px;
        }

        .ncsPurchaseNotice {
          position: fixed;
          z-index: 500;
          top: 20px;
          right: 20px;
          max-width: min(
            380px,
            calc(100vw - 40px)
          );
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 15px;
          border-radius: 13px;
          background: #ffffff;
          box-shadow: 0 18px 48px
            rgba(3, 21, 63, 0.2);
        }

        .ncsPurchaseNotice > span {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          font-weight: 950;
        }

        .ncsPurchaseNotice p {
          margin: 0;
          font-size: 10px;
          font-weight: 750;
        }

        .ncsPurchaseNotice-success > span {
          background: #e9f8ef;
          color: #158348;
        }

        .ncsPurchaseNotice-error > span {
          background: #fff0f0;
          color: #b43d3d;
        }

        .ncsPurchaseError {
          margin-top: 10px;
          padding: 10px;
          border-radius: 10px;
          background: #fff0f0;
          color: #a33a3a;
          font-size: 9px;
          font-weight: 750;
        }

        .ncsPurchaseModalOverlay {
          position: fixed;
          z-index: 700;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(3, 21, 63, 0.65);
          backdrop-filter: blur(7px);
        }

        .ncsPurchaseSuccessModal {
          width: min(420px, 100%);
          padding: 26px;
          border: 1px solid ${GOLD};
          border-radius: 22px;
          background: #ffffff;
          text-align: center;
          box-shadow: 0 30px 80px
            rgba(0, 0, 0, 0.28);
        }

        .ncsPurchaseSuccessModal > div {
          width: 58px;
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          border-radius: 18px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-size: 25px;
          font-weight: 950;
        }

        .ncsPurchaseSuccessModal > span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .ncsPurchaseSuccessModal h2 {
          margin: 5px 0;
          color: ${DEEP_BLUE};
          font-size: 22px;
          font-weight: 950;
        }

        .ncsPurchaseSuccessModal > p {
          margin: 0;
          color: #7c8490;
          font-size: 10px;
          font-weight: 650;
        }

        .ncsPurchaseSuccessModal section {
          margin: 16px 0;
          padding: 12px;
          border-radius: 12px;
          background: #f7f9fc;
        }

        .ncsPurchaseSuccessModal section p {
          display: flex;
          justify-content: space-between;
          margin: 0;
          padding: 4px 0;
          color: #6d7683;
          font-size: 9px;
          font-weight: 700;
        }

        .ncsPurchaseSuccessModal section strong {
          color: ${ROYAL_BLUE};
        }

        .ncsPurchaseSuccessModal button {
          width: 100%;
          min-height: 45px;
          border: 1px solid ${GOLD};
          border-radius: 11px;
          background: ${ROYAL_BLUE};
          color: #ffffff;
          font-family: inherit;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsNewProductModal {
          width: min(820px, 100%);
          max-height: 92vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid ${GOLD};
          border-radius: 22px;
          background: #ffffff;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.3);
        }

        .ncsNewProductModal > header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          padding: 18px 20px;
          background:
            radial-gradient(
              circle at 86% 0%,
              rgba(212, 175, 55, 0.22),
              transparent 32%
            ),
            linear-gradient(
              135deg,
              ${DEEP_BLUE},
              ${ROYAL_BLUE}
            );
          color: #ffffff;
        }

        .ncsNewProductModal > header span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .ncsNewProductModal > header h2 {
          margin: 4px 0 0;
          color: #ffffff;
          font-size: 21px;
          font-weight: 950;
        }

        .ncsNewProductModal > header p {
          margin: 4px 0 0;
          color: rgba(255, 255, 255, 0.64);
          font-size: 9px;
          font-weight: 650;
        }

        .ncsNewProductModal > header button {
          width: 39px;
          height: 39px;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          font-size: 20px;
          cursor: pointer;
        }

        .ncsNewProductFormGrid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 11px;
          padding: 18px 20px;
          overflow-y: auto;
        }

        .ncsNewProductFormGrid label {
          display: grid;
          gap: 5px;
        }

        .ncsNewProductFormGrid label > span {
          color: #69717e;
          font-size: 9px;
          font-weight: 800;
        }

        .ncsNewProductFormGrid input {
          width: 100%;
          min-width: 0;
          min-height: 41px;
          padding: 0 10px;
          border: 1px solid #dfe4eb;
          border-radius: 10px;
          outline: none;
          background: #ffffff;
          color: ${CHARCOAL};
          font-family: inherit;
          font-size: 10px;
          font-weight: 700;
        }

        .ncsNewProductFormGrid input:focus {
          border-color: ${GOLD};
          box-shadow: 0 0 0 3px
            rgba(212, 175, 55, 0.12);
        }

        .ncsNewProductWide {
          grid-column: 1 / -1;
        }

        .ncsNewProductWide > small {
          color: #858d99;
          font-size: 8px;
          font-weight: 650;
        }

        .ncsNewProductToggle {
          grid-column: 1 / -1;
          display: flex !important;
          align-items: center;
          gap: 11px !important;
          padding: 12px;
          border: 1px solid #dfe4eb;
          border-radius: 12px;
          background: #fafbfe;
          cursor: pointer;
        }

        .ncsNewProductToggle input {
          width: 20px;
          min-height: 20px;
          flex-shrink: 0;
          accent-color: ${ROYAL_BLUE};
        }

        .ncsNewProductToggle strong,
        .ncsNewProductToggle span {
          display: block;
        }

        .ncsNewProductToggle strong {
          color: ${DEEP_BLUE};
          font-size: 10px;
          font-weight: 900;
        }

        .ncsNewProductToggle span {
          margin-top: 3px;
          color: #858d99;
          font-size: 8px;
          font-weight: 650;
        }

        .ncsLocalPriceNote {
          margin: 0 20px 13px;
          padding: 11px 12px;
          border: 1px solid rgba(212, 175, 55, 0.45);
          border-radius: 11px;
          background: #fffaf0;
          color: #64551f;
          font-size: 9px;
          font-weight: 650;
          line-height: 1.55;
        }

        .ncsLocalPriceNote strong {
          color: #0A2E73;
        }

        .ncsNewProductSummary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 9px;
          margin: 0 20px 15px;
          padding: 12px;
          border-radius: 13px;
          background: #f6f8fc;
        }

        .ncsNewProductSummary div {
          min-width: 0;
        }

        .ncsNewProductSummary span,
        .ncsNewProductSummary strong {
          display: block;
        }

        .ncsNewProductSummary span {
          color: #8a919c;
          font-size: 8px;
          font-weight: 750;
        }

        .ncsNewProductSummary strong {
          margin-top: 3px;
          overflow: hidden;
          color: ${ROYAL_BLUE};
          font-size: 10px;
          font-weight: 900;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsNewProductModal > footer {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 9px;
          padding: 14px 20px 18px;
          border-top: 1px solid #edf0f4;
          background: #fbfcff;
        }

        .ncsNewProductModal > footer button {
          min-height: 45px;
          border-radius: 11px;
          font-family: inherit;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsNewProductModal > footer button:first-child {
          border: 1px solid #dfe4eb;
          background: #ffffff;
          color: ${ROYAL_BLUE};
        }

        .ncsNewProductModal > footer button:last-child {
          border: 1px solid ${GOLD};
          background: ${ROYAL_BLUE};
          color: #ffffff;
        }

        .ncsNewProductModal > footer button:disabled {
          cursor: wait;
          opacity: 0.6;
        }

        .ncsNewProductSuccess {
          width: min(430px, 100%);
          padding: 27px;
          border: 1px solid ${GOLD};
          border-radius: 22px;
          background: #ffffff;
          text-align: center;
          box-shadow: 0 30px 85px rgba(0, 0, 0, 0.3);
        }

        .ncsNewProductSuccess > div {
          width: 59px;
          height: 59px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          border-radius: 18px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-size: 25px;
          font-weight: 950;
        }

        .ncsNewProductSuccess > span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .ncsNewProductSuccess h2 {
          margin: 5px 0;
          color: ${DEEP_BLUE};
          font-size: 20px;
          font-weight: 950;
        }

        .ncsNewProductSuccess > p {
          margin: 0;
          color: #7d8591;
          font-size: 10px;
          font-weight: 650;
        }

        .ncsNewProductSuccess > section {
          margin: 17px 0 10px;
          padding: 14px;
          border: 1px dashed ${GOLD};
          border-radius: 13px;
          background: #fffdf5;
        }

        .ncsNewProductSuccess > section span,
        .ncsNewProductSuccess > section strong {
          display: block;
        }

        .ncsNewProductSuccess > section span {
          color: #8b7a42;
          font-size: 8px;
          font-weight: 800;
        }

        .ncsNewProductSuccess > section strong {
          margin-top: 5px;
          color: ${ROYAL_BLUE};
          font-size: 18px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .ncsGeneratedBarcodePreview {
          margin-top: 10px;
          padding: 8px;
          overflow-x: auto;
          border-radius: 10px;
          background: #ffffff;
        }

        .ncsGeneratedBarcodePreview svg {
          width: 100%;
          min-width: 240px;
          height: auto;
          display: block;
        }

        .ncsBarcodePrintSettings {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 15px;
          padding: 12px;
          border: 1px solid #e4e8ef;
          border-radius: 13px;
          background: #f8f9fc;
          text-align: left;
        }

        .ncsBarcodePrintSettings label {
          display: grid;
          gap: 5px;
        }

        .ncsBarcodePrintSettings label > span {
          color: #6f7784;
          font-size: 8px;
          font-weight: 800;
        }

        .ncsBarcodePrintSettings input,
        .ncsBarcodePrintSettings select {
          width: 100%;
          min-height: 38px;
          padding: 0 9px;
          border: 1px solid #dfe4eb;
          border-radius: 9px;
          outline: none;
          background: #ffffff;
          color: ${DEEP_BLUE};
          font-family: inherit;
          font-size: 9px;
          font-weight: 800;
        }

        .ncsBarcodePrintCheck {
          display: flex !important;
          align-items: center;
          gap: 8px !important;
          padding: 9px;
          border: 1px solid #e3e7ed;
          border-radius: 9px;
          background: #ffffff;
          cursor: pointer;
        }

        .ncsBarcodePrintCheck input {
          width: 17px;
          min-height: 17px;
          flex-shrink: 0;
          accent-color: ${ROYAL_BLUE};
        }

        .ncsBarcodePrintCheck span {
          color: ${DEEP_BLUE} !important;
          font-size: 8px !important;
          font-weight: 850 !important;
        }

        .ncsNewProductSuccessActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 16px;
        }

        .ncsNewProductSuccessActions button {
          width: 100%;
          min-height: 45px;
          border-radius: 11px;
          font-family: inherit;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsNewProductSuccessActions button:first-child {
          border: 1px solid ${GOLD};
          background: #fffaf0;
          color: ${ROYAL_BLUE};
        }

        .ncsNewProductSuccessActions button:last-child {
          border: 1px solid ${GOLD};
          background: ${ROYAL_BLUE};
          color: #ffffff;
        }

        .ncsNewProductSuccess > small {
          display: block;
          color: #7f8793;
          font-size: 9px;
          font-weight: 700;
        }



        .ncsDesignModeBox { display: grid; gap: 8px; padding: 13px; border: 1px solid rgba(10, 46, 115, 0.15); border-radius: 13px; background: #f8faff; }
        .ncsDesignModeBox > span { color: #68717e; font-size: 9px; font-weight: 900; }
        .ncsDesignModeButtons { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
        .ncsDesignModeButtons button { min-height: 60px; display: grid; gap: 4px; align-content: center; padding: 9px 12px; border: 1px solid #d9dfeb; border-radius: 11px; background: #fff; color: ${CHARCOAL}; font-family: inherit; font-size: 10px; font-weight: 950; text-align: left; cursor: pointer; pointer-events: auto; }
        .ncsDesignModeButtons button small { color: #7d8796; font-size: 8px; font-weight: 700; }
        .ncsDesignModeButtons button.active { border-color: ${GOLD}; background: ${ROYAL_BLUE}; color: #fff; box-shadow: 0 8px 20px rgba(10, 46, 115, 0.16); }
        .ncsDesignModeButtons button.active small { color: rgba(255,255,255,.72); }
        .ncsDesignModeHelp { color: #68717e; font-size: 8px; line-height: 1.55; }
        .ncsGeneratedBarcodeList { width: 100%; max-height: 260px; display: grid; gap: 8px; margin-top: 12px; overflow-y: auto; text-align: left; }
        .ncsGeneratedBarcodeList article { display: grid; grid-template-columns: 90px minmax(0,1fr) auto; align-items: center; gap: 9px; padding: 10px; border: 1px solid #e3e8f2; border-radius: 10px; background: #f8faff; }
        .ncsGeneratedBarcodeList article span { color: #68717e; font-size: 9px; font-weight: 800; }
        .ncsGeneratedBarcodeList article strong { color: ${ROYAL_BLUE}; font-size: 11px; word-break: break-all; }
        .ncsGeneratedBarcodeList article button { min-height: 34px; padding: 0 10px; border: 1px solid ${GOLD}; border-radius: 8px; background: ${GOLD}; color: ${ROYAL_BLUE}; font-family: inherit; font-size: 8px; font-weight: 900; cursor: pointer; }
        .ncsPurchasePage button { position: relative; z-index: 2; pointer-events: auto; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        .ncsPurchaseProductActions { position: relative; z-index: 5; }

        @media (max-width: 1050px) {
          .ncsPurchaseLayout {
            grid-template-columns: 1fr;
          }

          .ncsPurchaseSummary {
            position: static;
          }

          .ncsPurchaseItemFields {
            grid-template-columns: repeat(
              3,
              minmax(0, 1fr)
            );
          }
        }

        @media (max-width: 700px) {
          .ncsPurchasePage {
            padding: 12px;
          }

          .ncsPurchaseHeader {
            align-items: stretch;
            flex-direction: column;
          }

          .ncsPurchaseHeader h1 {
            font-size: 26px;
          }

          .ncsPurchaseFormGrid,
          .ncsPurchaseItemFields {
            grid-template-columns: 1fr;
          }

          .ncsPurchaseProductGrid {
            grid-template-columns: 1fr;
          }

          .ncsPurchaseProduct {
            grid-template-columns: minmax(0, 1fr) 82px;
          }

          .ncsPurchaseProductActions {
            width: 82px;
            min-width: 82px;
          }

          .ncsPurchaseCardTitle {
            align-items: flex-start;
            flex-direction: column;
          }

          .ncsPurchaseTitleActions {
            width: 100%;
            justify-content: space-between;
          }

          .ncsNewProductFormGrid,
          .ncsNewProductSummary {
            grid-template-columns: 1fr;
          }

          .ncsNewProductWide,
          .ncsNewProductToggle {
            grid-column: auto;
          }

          .ncsNewProductModal > footer {
            grid-template-columns: 1fr;
          }

          .ncsBarcodePrintSettings,
          .ncsNewProductSuccessActions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}