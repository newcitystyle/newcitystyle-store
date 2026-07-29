"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type TaxType = "intra_state" | "inter_state" | "non_gst";
type PaymentMethod =
  | "cash"
  | "upi"
  | "card"
  | "bank_transfer"
  | "other";

type SupplierRow = {
  id: number;
  supplier_name: string;
  phone?: string | null;
  gst_number?: string | null;
  state?: string | null;
  state_code?: string | null;
  place_of_supply?: string | null;
  current_balance?: number | string | null;
  is_active?: boolean | null;
};

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
  cess_percent?: number | string | null;
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
  sku?: string | null;
  barcode?: string | null;
  purchase_price?: number | string | null;
  selling_price?: number | string | null;
  mrp?: number | string | null;
  stock?: number | string | null;
  tax_percent?: number | string | null;
  cess_percent?: number | string | null;
  sell_online?: boolean | null;
  online_stock_limit?: number | string | null;
  is_active?: boolean | null;
};

type ProductOption = {
  key: string;
  productId: number;
  variantId: number | null;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  size: string;
  color: string;
  sku: string;
  barcode: string;
  stock: number;
  purchasePrice: number;
  onlineSellingPrice: number;
  mrp: number;
  taxPercent: number;
  cessPercent: number;
  sellOnline: boolean;
  onlineQuantity: number;
  imageUrl: string;
};

type PurchaseItem = {
  rowId: string;
  productId: number | null;
  variantId: number | null;
  productName: string;
  category: string;
  subcategory: string;
  brand: string;
  size: string;
  color: string;
  sku: string;
  barcode: string;
  quantity: number;
  purchasePrice: number;
  mrp: number;
  taxPercent: number;
  cessPercent: number;
  sellOnline: boolean;
  onlineQuantity: number;
  onlineSellingPrice: number;
  currentStock: number;
};

type PaymentRow = {
  id: string;
  method: PaymentMethod;
  amount: number;
  reference: string;
};

type PurchaseResult = {
  success?: boolean;
  purchase_id?: string;
  purchase_number?: string;
  supplier_id?: number;
  previous_supplier_balance?: number;
  current_purchase_due?: number;
  closing_supplier_balance?: number;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  cess_amount?: number;
  tax_amount?: number;
  total_amount?: number;
  paid_amount?: number;
  due_amount?: number;
  payment_status?: string;
  message?: string;
};

const ROYAL_BLUE = "#0A2E73";
const DEEP_BLUE = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";
const CHARCOAL = "#2C2C2C";

function toNumber(
  value: number | string | null | undefined,
  fallback = 0,
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

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function createBlankItem(): PurchaseItem {
  return {
    rowId: newId("item"),
    productId: null,
    variantId: null,
    productName: "",
    category: "",
    subcategory: "",
    brand: "NEW CITY STYLE",
    size: "",
    color: "",
    sku: "",
    barcode: "",
    quantity: 1,
    purchasePrice: 0,
    mrp: 0,
    taxPercent: 0,
    cessPercent: 0,
    sellOnline: false,
    onlineQuantity: 0,
    onlineSellingPrice: 0,
    currentStock: 0,
  };
}

function createBlankPayment(): PaymentRow {
  return {
    id: newId("payment"),
    method: "cash",
    amount: 0,
    reference: "",
  };
}

export default function PurchasesPage() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierResults, setShowSupplierResults] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(
    null,
  );
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierGstin, setSupplierGstin] = useState("");
  const [supplierState, setSupplierState] = useState("Andhra Pradesh");
  const [supplierStateCode, setSupplierStateCode] = useState("37");
  const [placeOfSupply, setPlaceOfSupply] = useState("Andhra Pradesh");
  const [previousSupplierBalance, setPreviousSupplierBalance] = useState(0);

  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dueDate, setDueDate] = useState("");
  const [taxType, setTaxType] = useState<TaxType>("intra_state");

  const [items, setItems] = useState<PurchaseItem[]>([createBlankItem()]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductResults, setShowProductResults] = useState(false);

  const [discountAmount, setDiscountAmount] = useState(0);
  const [transportCharge, setTransportCharge] = useState(0);
  const [otherCharge, setOtherCharge] = useState(0);
  const [payments, setPayments] = useState<PaymentRow[]>([
    createBlankPayment(),
  ]);
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<
    "success" | "error" | "info"
  >("info");
  const [successPurchase, setSuccessPurchase] =
    useState<PurchaseResult | null>(null);

  const showNotice = useCallback(
    (
      message: string,
      type: "success" | "error" | "info" = "info",
    ) => {
      setNotice(message);
      setNoticeType(type);
      window.setTimeout(() => setNotice(""), 4000);
    },
    [],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const [supplierResponse, productResponse, variantResponse] =
        await Promise.all([
          supabase
            .from("suppliers")
            .select(
              "id,supplier_name,phone,gst_number,state,state_code,place_of_supply,current_balance,is_active",
            )
            .eq("is_active", true)
            .order("supplier_name", { ascending: true }),
          supabase
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
                "cess_percent",
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
                "sku",
                "barcode",
                "purchase_price",
                "selling_price",
                "mrp",
                "stock",
                "tax_percent",
                "cess_percent",
                "sell_online",
                "online_stock_limit",
                "is_active",
              ].join(","),
            )
            .eq("is_active", true),
        ]);

      if (supplierResponse.error) throw supplierResponse.error;
      if (productResponse.error) throw productResponse.error;
      if (variantResponse.error) throw variantResponse.error;

      const safeSuppliers = (supplierResponse.data || []) as SupplierRow[];
      const safeProducts = (productResponse.data || []) as unknown as ProductRow[];
      const safeVariants = (variantResponse.data || []) as unknown as VariantRow[];

      setSuppliers(safeSuppliers);

      const variantsByProduct = new Map<number, VariantRow[]>();

      safeVariants.forEach((variant) => {
        const list = variantsByProduct.get(variant.product_id) || [];
        list.push(variant);
        variantsByProduct.set(variant.product_id, list);
      });

      const mapped: ProductOption[] = [];

      safeProducts.forEach((product) => {
        if (
          product.is_active === false ||
          normalizeText(product.status) === "inactive"
        ) {
          return;
        }

        const productId = Number(product.id);
        const variants = variantsByProduct.get(productId) || [];
        const imageUrl =
          product.image_url?.trim() || product.image?.trim() || "";

        if (variants.length > 0) {
          variants.forEach((variant) => {
            mapped.push({
              key: `variant-${variant.id}`,
              productId,
              variantId: Number(variant.id),
              name: product.name?.trim() || "NEW CITY STYLE Product",
              category: product.category?.trim() || "Others",
              subcategory: product.subcategory?.trim() || "",
              brand: product.brand?.trim() || "NEW CITY STYLE",
              size: variant.size?.trim() || "",
              color: variant.color?.trim() || "",
              sku: variant.sku?.trim() || product.sku?.trim() || "",
              barcode:
                variant.barcode?.trim() || product.barcode?.trim() || "",
              stock: Math.max(0, toNumber(variant.stock)),
              purchasePrice: Math.max(
                0,
                toNumber(variant.purchase_price),
              ),
              onlineSellingPrice: Math.max(
                0,
                toNumber(variant.selling_price) ||
                  toNumber(product.price),
              ),
              mrp:
                Math.max(0, toNumber(variant.mrp)) ||
                Math.max(0, toNumber(product.mrp)),
              taxPercent: Math.max(
                0,
                toNumber(variant.tax_percent) ||
                  toNumber(product.tax_percent),
              ),
              cessPercent: Math.max(
                0,
                toNumber(variant.cess_percent) ||
                  toNumber(product.cess_percent),
              ),
              sellOnline: variant.sell_online === true,
              onlineQuantity: Math.max(
                0,
                toNumber(variant.online_stock_limit),
              ),
              imageUrl,
            });
          });
          return;
        }

        mapped.push({
          key: `product-${productId}`,
          productId,
          variantId: null,
          name: product.name?.trim() || "NEW CITY STYLE Product",
          category: product.category?.trim() || "Others",
          subcategory: product.subcategory?.trim() || "",
          brand: product.brand?.trim() || "NEW CITY STYLE",
          size: "",
          color: "",
          sku: product.sku?.trim() || "",
          barcode: product.barcode?.trim() || "",
          stock: Math.max(0, toNumber(product.stock)),
          purchasePrice: 0,
          onlineSellingPrice: Math.max(0, toNumber(product.price)),
          mrp: Math.max(0, toNumber(product.mrp)),
          taxPercent: Math.max(0, toNumber(product.tax_percent)),
          cessPercent: Math.max(0, toNumber(product.cess_percent)),
          sellOnline: product.sell_online === true,
          onlineQuantity: Math.max(
            0,
            toNumber(product.online_stock_limit),
          ),
          imageUrl,
        });
      });

      setProducts(mapped);
    } catch (error) {
      console.error(error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load purchase data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSuppliers = useMemo(() => {
    const query = normalizeText(supplierSearch);

    if (!query) return suppliers.slice(0, 10);

    return suppliers
      .filter((supplier) =>
        [
          supplier.supplier_name,
          supplier.phone,
          supplier.gst_number,
          supplier.state,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 12);
  }, [supplierSearch, suppliers]);

  const filteredProducts = useMemo(() => {
    const query = normalizeText(productSearch);

    if (!query) return products.slice(0, 12);

    return products
      .filter((product) =>
        [
          product.name,
          product.category,
          product.subcategory,
          product.size,
          product.color,
          product.sku,
          product.barcode,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 20);
  }, [productSearch, products]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + item.purchasePrice * item.quantity,
        0,
      ),
    [items],
  );

  const taxAmount = useMemo(() => {
    if (taxType === "non_gst") return 0;

    return items.reduce((sum, item) => {
      const taxable = item.purchasePrice * item.quantity;
      return sum + (taxable * item.taxPercent) / 100;
    }, 0);
  }, [items, taxType]);

  const cessAmount = useMemo(() => {
    if (taxType === "non_gst") return 0;

    return items.reduce((sum, item) => {
      const taxable = item.purchasePrice * item.quantity;
      return sum + (taxable * item.cessPercent) / 100;
    }, 0);
  }, [items, taxType]);

  const cgstAmount = taxType === "intra_state" ? taxAmount / 2 : 0;
  const sgstAmount =
    taxType === "intra_state" ? taxAmount - cgstAmount : 0;
  const igstAmount = taxType === "inter_state" ? taxAmount : 0;

  const totalAmount = Math.max(
    0,
    subtotal +
      taxAmount +
      cessAmount +
      transportCharge +
      otherCharge -
      discountAmount,
  );

  const totalPaid = useMemo(
    () => payments.reduce((sum, payment) => sum + payment.amount, 0),
    [payments],
  );

  const safePaid = Math.min(totalPaid, totalAmount);
  const currentPurchaseDue = Math.max(0, totalAmount - safePaid);
  const closingSupplierBalance =
    previousSupplierBalance + currentPurchaseDue;

  function selectSupplier(supplier: SupplierRow) {
    setSelectedSupplierId(supplier.id);
    setSupplierSearch(supplier.supplier_name);
    setSupplierName(supplier.supplier_name);
    setSupplierPhone(supplier.phone || "");
    setSupplierGstin(supplier.gst_number || "");
    setSupplierState(supplier.state || "Andhra Pradesh");
    setSupplierStateCode(supplier.state_code || "37");
    setPlaceOfSupply(
      supplier.place_of_supply ||
        supplier.state ||
        "Andhra Pradesh",
    );
    setPreviousSupplierBalance(
      Math.max(0, toNumber(supplier.current_balance)),
    );
    setShowSupplierResults(false);
  }

  function clearSupplierSelection() {
    setSelectedSupplierId(null);
    setSupplierSearch("");
    setSupplierName("");
    setSupplierPhone("");
    setSupplierGstin("");
    setSupplierState("Andhra Pradesh");
    setSupplierStateCode("37");
    setPlaceOfSupply("Andhra Pradesh");
    setPreviousSupplierBalance(0);
  }

  function addExistingProduct(product: ProductOption) {
    setItems((current) => {
      const existingIndex = current.findIndex(
        (item) =>
          item.productId === product.productId &&
          item.variantId === product.variantId,
      );

      if (existingIndex >= 0) {
        return current.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      const newItem: PurchaseItem = {
        rowId: newId("item"),
        productId: product.productId,
        variantId: product.variantId,
        productName: product.name,
        category: product.category,
        subcategory: product.subcategory,
        brand: product.brand,
        size: product.size,
        color: product.color,
        sku: product.sku,
        barcode: product.barcode,
        quantity: 1,
        purchasePrice: product.purchasePrice,
        mrp: product.mrp,
        taxPercent: product.taxPercent,
        cessPercent: product.cessPercent,
        sellOnline: false,
        onlineQuantity: 0,
        onlineSellingPrice: product.onlineSellingPrice,
        currentStock: product.stock,
      };

      const blankOnly =
        current.length === 1 &&
        !current[0].productName.trim() &&
        current[0].productId === null;

      return blankOnly ? [newItem] : [...current, newItem];
    });

    setProductSearch("");
    setShowProductResults(false);
    showNotice(`${product.name} added.`, "success");
  }

  function updateItem<K extends keyof PurchaseItem>(
    rowId: string,
    field: K,
    value: PurchaseItem[K],
  ) {
    setItems((current) =>
      current.map((item) =>
        item.rowId === rowId ? { ...item, [field]: value } : item,
      ),
    );
  }

  function removeItem(rowId: string) {
    setItems((current) => {
      const next = current.filter((item) => item.rowId !== rowId);
      return next.length > 0 ? next : [createBlankItem()];
    });
  }

  function addBlankItem() {
    setItems((current) => [...current, createBlankItem()]);
  }

  function duplicateItem(item: PurchaseItem) {
    setItems((current) => [
      ...current,
      {
        ...item,
        rowId: newId("item"),
        productId: null,
        variantId: null,
        barcode: "",
        sku: "",
        currentStock: 0,
      },
    ]);
  }

  function updatePayment<K extends keyof PaymentRow>(
    id: string,
    field: K,
    value: PaymentRow[K],
  ) {
    setPayments((current) =>
      current.map((payment) =>
        payment.id === id ? { ...payment, [field]: value } : payment,
      ),
    );
  }

  function addPaymentRow() {
    setPayments((current) => [...current, createBlankPayment()]);
  }

  function removePaymentRow(id: string) {
    setPayments((current) => {
      const next = current.filter((payment) => payment.id !== id);
      return next.length > 0 ? next : [createBlankPayment()];
    });
  }

  function resetForm() {
    clearSupplierSelection();
    setSupplierInvoiceNumber("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
    setTaxType("intra_state");
    setItems([createBlankItem()]);
    setProductSearch("");
    setDiscountAmount(0);
    setTransportCharge(0);
    setOtherCharge(0);
    setPayments([createBlankPayment()]);
    setNotes("");
  }

  async function completePurchase(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (saving) return;

    const validItems = items.filter((item) => item.productName.trim());

    if (!supplierName.trim()) {
      showNotice("Select or enter a supplier.", "error");
      return;
    }

    if (validItems.length === 0) {
      showNotice("Add at least one purchase item.", "error");
      return;
    }

    const invalidItem = validItems.find(
      (item) =>
        item.quantity <= 0 ||
        item.purchasePrice < 0 ||
        item.mrp <= 0 ||
        (item.sellOnline &&
          (item.onlineQuantity <= 0 ||
            item.onlineSellingPrice <= 0 ||
            item.onlineQuantity > item.quantity)),
    );

    if (invalidItem) {
      showNotice(
        `Check quantity, purchase price, MRP and online fields for ${invalidItem.productName}.`,
        "error",
      );
      return;
    }

    if (totalPaid > totalAmount + 0.001) {
      showNotice(
        "Total paid amount cannot exceed purchase total.",
        "error",
      );
      return;
    }

    setSaving(true);

    try {
      const rpcItems = validItems.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId,
        product_name: item.productName.trim(),
        category: item.category.trim(),
        subcategory: item.subcategory.trim() || null,
        brand: item.brand.trim() || "NEW CITY STYLE",
        size: item.size.trim() || null,
        color: item.color.trim() || null,
        sku: item.sku.trim() || null,
        barcode: item.barcode.trim() || null,
        quantity: Math.max(1, Math.floor(item.quantity)),
        purchase_price: Math.max(0, item.purchasePrice),
        mrp: Math.max(0, item.mrp),
        tax_percent:
          taxType === "non_gst" ? 0 : Math.max(0, item.taxPercent),
        cess_percent:
          taxType === "non_gst" ? 0 : Math.max(0, item.cessPercent),
        sell_online: item.sellOnline,
        online_quantity: item.sellOnline
          ? Math.min(
              Math.max(0, Math.floor(item.onlineQuantity)),
              Math.max(1, Math.floor(item.quantity)),
            )
          : 0,
        online_selling_price: item.sellOnline
          ? Math.max(0, item.onlineSellingPrice)
          : 0,
      }));

      const rpcPayments = payments
        .filter((payment) => payment.amount > 0)
        .map((payment) => ({
          method: payment.method,
          amount: payment.amount,
          reference: payment.reference.trim() || null,
        }));

      const { data, error } = await supabase.rpc(
        "ncs_complete_purchase_v2",
        {
          p_items: rpcItems,
          p_supplier_id: selectedSupplierId,
          p_supplier_name: supplierName.trim(),
          p_supplier_phone: supplierPhone.trim() || null,
          p_supplier_gstin: supplierGstin.trim() || null,
          p_supplier_state: supplierState.trim() || null,
          p_supplier_state_code:
            supplierStateCode.trim() || null,
          p_place_of_supply: placeOfSupply.trim() || null,
          p_tax_type: taxType,
          p_supplier_invoice_number:
            supplierInvoiceNumber.trim() || null,
          p_purchase_date: purchaseDate,
          p_due_date: dueDate || null,
          p_discount_amount: discountAmount,
          p_transport_charge: transportCharge,
          p_other_charge: otherCharge,
          p_payments: rpcPayments,
          p_notes: notes.trim() || null,
        },
      );

      if (error) throw error;

      const result = (data || {}) as unknown as PurchaseResult;

      if (result.success === false) {
        throw new Error(
          result.message || "Unable to complete purchase.",
        );
      }

      setSuccessPurchase(result);
      resetForm();
      await loadData();

      showNotice(
        `${result.purchase_number || "Purchase"} completed successfully.`,
        "success",
      );
    } catch (error) {
      console.error("Purchase save error:", error);
      showNotice(
        error instanceof Error
          ? error.message
          : "Unable to complete purchase.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="ncsPurchasePage">
      {notice && (
        <div
          className={`ncsNotice ncsNotice-${noticeType}`}
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

      <section className="ncsHero">
        <div>
          <span>NEW CITY STYLE • PURCHASE MANAGEMENT</span>
          <h1>Supplier Purchase Entry</h1>
          <p>
            Enter one supplier invoice with shirts, pants,
            variants, credit and online quantities in a single
            safe transaction.
          </p>
        </div>

        <div className="ncsHeroActions">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "↻ Refresh Data"}
          </button>

          <a href="/admin/purchase-history">
            Purchase History →
          </a>
        </div>
      </section>

      {loadError && (
        <div className="ncsLoadError">{loadError}</div>
      )}

      <form
        className="ncsPurchaseLayout"
        onSubmit={completePurchase}
      >
        <section className="ncsPurchaseMain">
          <article className="ncsCard">
            <header className="ncsCardHeader">
              <div>
                <span>STEP 1</span>
                <h2>Select Supplier</h2>
                <p>
                  Existing supplier select చేస్తే previous due
                  automaticగా కనిపిస్తుంది.
                </p>
              </div>

              {selectedSupplierId && (
                <button
                  type="button"
                  className="ncsSecondaryButton"
                  onClick={clearSupplierSelection}
                >
                  Change Supplier
                </button>
              )}
            </header>

            <div className="ncsSupplierSearchWrap">
              <label>
                <span>Search Supplier *</span>
                <input
                  value={supplierSearch}
                  onFocus={() => setShowSupplierResults(true)}
                  onChange={(event) => {
                    setSupplierSearch(event.target.value);
                    setSupplierName(event.target.value);
                    setSelectedSupplierId(null);
                    setPreviousSupplierBalance(0);
                    setShowSupplierResults(true);
                  }}
                  placeholder="Supplier name, mobile or GSTIN"
                />
              </label>

              {showSupplierResults && (
                <div className="ncsDropdown">
                  {filteredSuppliers.length === 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setShowSupplierResults(false)
                      }
                    >
                      <strong>
                        + Create “{supplierSearch || "New Supplier"}”
                      </strong>
                      <span>
                        Enter remaining supplier details below.
                      </span>
                    </button>
                  ) : (
                    filteredSuppliers.map((supplier) => (
                      <button
                        key={supplier.id}
                        type="button"
                        onClick={() => selectSupplier(supplier)}
                      >
                        <strong>{supplier.supplier_name}</strong>
                        <span>
                          {supplier.phone || "No mobile"} • Due{" "}
                          {formatCurrency(
                            toNumber(supplier.current_balance),
                          )}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="ncsSupplierGrid">
              <label>
                <span>Supplier Name *</span>
                <input
                  value={supplierName}
                  onChange={(event) =>
                    setSupplierName(event.target.value)
                  }
                  placeholder="Supplier name"
                />
              </label>

              <label>
                <span>Mobile</span>
                <input
                  value={supplierPhone}
                  onChange={(event) =>
                    setSupplierPhone(
                      event.target.value.replace(
                        /[^0-9+]/g,
                        "",
                      ),
                    )
                  }
                  placeholder="Mobile number"
                />
              </label>

              <label>
                <span>GSTIN</span>
                <input
                  value={supplierGstin}
                  onChange={(event) =>
                    setSupplierGstin(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 15),
                    )
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                <span>State</span>
                <input
                  value={supplierState}
                  onChange={(event) =>
                    setSupplierState(event.target.value)
                  }
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
                        .slice(0, 2),
                    )
                  }
                />
              </label>

              <label>
                <span>Place of Supply</span>
                <input
                  value={placeOfSupply}
                  onChange={(event) =>
                    setPlaceOfSupply(event.target.value)
                  }
                />
              </label>
            </div>

            <div className="ncsSupplierBalanceStrip">
              <div>
                <span>Previous Supplier Due</span>
                <strong>
                  {formatCurrency(previousSupplierBalance)}
                </strong>
              </div>

              <div>
                <span>Current Purchase Due</span>
                <strong>
                  {formatCurrency(currentPurchaseDue)}
                </strong>
              </div>

              <div>
                <span>Total Outstanding</span>
                <strong>
                  {formatCurrency(closingSupplierBalance)}
                </strong>
              </div>
            </div>

            <div className="ncsInvoiceGrid">
              <label>
                <span>Supplier Invoice No.</span>
                <input
                  value={supplierInvoiceNumber}
                  onChange={(event) =>
                    setSupplierInvoiceNumber(
                      event.target.value,
                    )
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                <span>Purchase Date *</span>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(event) =>
                    setPurchaseDate(event.target.value)
                  }
                />
              </label>

              <label>
                <span>Credit Due Date</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) =>
                    setDueDate(event.target.value)
                  }
                />
              </label>

              <label>
                <span>Tax Type</span>
                <select
                  value={taxType}
                  onChange={(event) =>
                    setTaxType(
                      event.target.value as TaxType,
                    )
                  }
                >
                  <option value="intra_state">
                    Intra-state (CGST + SGST)
                  </option>
                  <option value="inter_state">
                    Inter-state (IGST)
                  </option>
                  <option value="non_gst">Non-GST</option>
                </select>
              </label>
            </div>
          </article>

          <article className="ncsCard">
            <header className="ncsCardHeader">
              <div>
                <span>STEP 2</span>
                <h2>Add Purchase Items</h2>
                <p>
                  Existing barcode/product search చేయండి లేదా
                  new item rowలో details enter చేయండి.
                </p>
              </div>

              <button
                type="button"
                className="ncsPrimarySmall"
                onClick={addBlankItem}
              >
                + Add New Item Row
              </button>
            </header>

            <div className="ncsProductSearchWrap">
              <label>
                <span>Find Existing Product / Barcode</span>
                <input
                  value={productSearch}
                  onFocus={() => setShowProductResults(true)}
                  onChange={(event) => {
                    setProductSearch(event.target.value);
                    setShowProductResults(true);
                  }}
                  placeholder="Search name, barcode, SKU, size or colour"
                />
              </label>

              {showProductResults && (
                <div className="ncsDropdown ncsProductDropdown">
                  {loading ? (
                    <div className="ncsDropdownMessage">
                      Loading products...
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="ncsDropdownMessage">
                      No existing product found. Use “Add New
                      Item Row”.
                    </div>
                  ) : (
                    filteredProducts.map((product) => (
                      <button
                        key={product.key}
                        type="button"
                        onClick={() =>
                          addExistingProduct(product)
                        }
                      >
                        <div className="ncsProductThumb">
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

                        <div>
                          <strong>{product.name}</strong>
                          <span>
                            {[
                              product.size,
                              product.color,
                              product.barcode || product.sku,
                            ]
                              .filter(Boolean)
                              .join(" • ") || "Standard Product"}
                          </span>
                          <small>
                            Current stock: {product.stock}
                          </small>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="ncsPurchaseRows">
              {items.map((item, index) => {
                const lineTax =
                  taxType === "non_gst"
                    ? 0
                    : (item.purchasePrice *
                        item.quantity *
                        item.taxPercent) /
                      100;

                const lineCess =
                  taxType === "non_gst"
                    ? 0
                    : (item.purchasePrice *
                        item.quantity *
                        item.cessPercent) /
                      100;

                const lineTotal =
                  item.purchasePrice * item.quantity +
                  lineTax +
                  lineCess;

                return (
                  <article className="ncsPurchaseRowCard" key={item.rowId}>
                    <header className="ncsPurchaseRowHeader">
                      <div className="ncsPurchaseRowTitle">
                        <span>{index + 1}</span>
                        <div>
                          <strong>
                            {item.productName.trim() ||
                              `Product ${index + 1}`}
                          </strong>
                          <small>
                            {item.productId
                              ? `Existing product • Current stock ${item.currentStock}`
                              : "New product / new design"}
                          </small>
                        </div>
                      </div>

                      <div className="ncsPurchaseRowActions">
                        <button
                          type="button"
                          onClick={() => duplicateItem(item)}
                        >
                          ⧉ Duplicate
                        </button>

                        <button
                          type="button"
                          className="danger"
                          onClick={() => removeItem(item.rowId)}
                        >
                          × Remove
                        </button>
                      </div>
                    </header>

                    <div className="ncsPurchaseRowGrid">
                      <section className="ncsPurchaseRowSection">
                        <h3>Product</h3>

                        <label className="wide">
                          <span>Product Name *</span>
                          <input
                            value={item.productName}
                            onChange={(event) =>
                              updateItem(
                                item.rowId,
                                "productName",
                                event.target.value,
                              )
                            }
                            placeholder="Example: Men Cotton Shirt"
                          />
                        </label>

                        <div className="ncsPurchaseInnerGrid three">
                          <label>
                            <span>Category *</span>
                            <input
                              value={item.category}
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "category",
                                  event.target.value,
                                )
                              }
                              placeholder="Men"
                            />
                          </label>

                          <label>
                            <span>Subcategory</span>
                            <input
                              value={item.subcategory}
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "subcategory",
                                  event.target.value,
                                )
                              }
                              placeholder="Shirts"
                            />
                          </label>

                          <label>
                            <span>Brand</span>
                            <input
                              value={item.brand}
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "brand",
                                  event.target.value,
                                )
                              }
                              placeholder="NEW CITY STYLE"
                            />
                          </label>
                        </div>

                        <div className="ncsPurchaseInnerGrid two">
                          <label>
                            <span>Barcode</span>
                            <input
                              value={item.barcode}
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "barcode",
                                  event.target.value.trim(),
                                )
                              }
                              placeholder="Leave blank for auto"
                            />
                          </label>

                          <label>
                            <span>SKU</span>
                            <input
                              value={item.sku}
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "sku",
                                  event.target.value,
                                )
                              }
                              placeholder="Optional"
                            />
                          </label>
                        </div>
                      </section>

                      <section className="ncsPurchaseRowSection">
                        <h3>Variant & Stock</h3>

                        <div className="ncsPurchaseInnerGrid two">
                          <label>
                            <span>Size</span>
                            <input
                              value={item.size}
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "size",
                                  event.target.value,
                                )
                              }
                              placeholder="M / L / XL"
                            />
                          </label>

                          <label>
                            <span>Colour</span>
                            <input
                              value={item.color}
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "color",
                                  event.target.value,
                                )
                              }
                              placeholder="Blue"
                            />
                          </label>
                        </div>

                        <div className="ncsPurchaseInnerGrid three">
                          <label>
                            <span>Quantity *</span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(event) => {
                                const quantity = Math.max(
                                  1,
                                  Math.floor(
                                    toNumber(event.target.value, 1),
                                  ),
                                );

                                updateItem(
                                  item.rowId,
                                  "quantity",
                                  quantity,
                                );

                                if (item.onlineQuantity > quantity) {
                                  updateItem(
                                    item.rowId,
                                    "onlineQuantity",
                                    quantity,
                                  );
                                }
                              }}
                            />
                          </label>

                          <label>
                            <span>Purchase Price</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.purchasePrice || ""}
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "purchasePrice",
                                  Math.max(
                                    0,
                                    toNumber(event.target.value),
                                  ),
                                )
                              }
                              placeholder="0.00"
                            />
                          </label>

                          <label>
                            <span>MRP *</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.mrp || ""}
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "mrp",
                                  Math.max(
                                    0,
                                    toNumber(event.target.value),
                                  ),
                                )
                              }
                              placeholder="MRP"
                            />
                          </label>
                        </div>

                        <div className="ncsPurchaseInnerGrid two">
                          <label>
                            <span>GST %</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={taxType === "non_gst"}
                              value={
                                taxType === "non_gst"
                                  ? 0
                                  : item.taxPercent
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "taxPercent",
                                  Math.max(
                                    0,
                                    toNumber(event.target.value),
                                  ),
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
                              disabled={taxType === "non_gst"}
                              value={
                                taxType === "non_gst"
                                  ? 0
                                  : item.cessPercent
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "cessPercent",
                                  Math.max(
                                    0,
                                    toNumber(event.target.value),
                                  ),
                                )
                              }
                            />
                          </label>
                        </div>

                        {item.productId &&
                          !item.variantId &&
                          (item.size || item.color) && (
                            <div className="ncsNewVariantMessage">
                              New size/colour variant will be created under
                              this product.
                            </div>
                          )}
                      </section>

                      <section className="ncsPurchaseRowSection ncsOnlineSection">
                        <div className="ncsOnlineHeader">
                          <h3>Online Sale</h3>

                          <label className="ncsToggle">
                            <input
                              type="checkbox"
                              checked={item.sellOnline}
                              onChange={(event) => {
                                const checked =
                                  event.target.checked;

                                updateItem(
                                  item.rowId,
                                  "sellOnline",
                                  checked,
                                );

                                updateItem(
                                  item.rowId,
                                  "onlineQuantity",
                                  checked
                                    ? Math.min(
                                        Math.max(
                                          1,
                                          item.onlineQuantity,
                                        ),
                                        item.quantity,
                                      )
                                    : 0,
                                );
                              }}
                            />
                            <span>Sell Online</span>
                          </label>
                        </div>

                        {item.sellOnline ? (
                          <div className="ncsPurchaseInnerGrid two">
                            <label>
                              <span>Online Quantity</span>
                              <input
                                type="number"
                                min="1"
                                max={item.quantity}
                                value={item.onlineQuantity || ""}
                                onChange={(event) =>
                                  updateItem(
                                    item.rowId,
                                    "onlineQuantity",
                                    Math.min(
                                      item.quantity,
                                      Math.max(
                                        0,
                                        Math.floor(
                                          toNumber(event.target.value),
                                        ),
                                      ),
                                    ),
                                  )
                                }
                              />
                            </label>

                            <label>
                              <span>Online Selling Price</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.onlineSellingPrice || ""}
                                onChange={(event) =>
                                  updateItem(
                                    item.rowId,
                                    "onlineSellingPrice",
                                    Math.max(
                                      0,
                                      toNumber(event.target.value),
                                    ),
                                  )
                                }
                                placeholder="Required"
                              />
                            </label>
                          </div>
                        ) : (
                          <div className="ncsOfflineNote">
                            Local POS only. Selling price is not saved.
                            Barcode scan will use MRP during billing.
                          </div>
                        )}

                        <div className="ncsPurchaseRowTotal">
                          <span>Line Total</span>
                          <strong>{formatCurrency(lineTotal)}</strong>
                        </div>
                      </section>
                    </div>

                    <button
                      type="button"
                      className="ncsAddNextRowButton"
                      onClick={addBlankItem}
                    >
                      + Add Next Product Row
                    </button>
                  </article>
                );
              })}
            </div>

            <div className="ncsItemHelp">
              <strong>How matching works:</strong> Barcode match
              అయితే existing stock increase అవుతుంది. Existing
              productకు కొత్త size/colour enter చేస్తే duplicate
              product కాకుండా new variant create అవుతుంది.
            </div>
          </article>
        </section>

        <aside className="ncsSummary">
          <header>
            <span>STEP 3</span>
            <h2>Payment & Summary</h2>
          </header>

          <div className="ncsSummaryBody">
            <div className="ncsChargeGrid">
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
                        toNumber(event.target.value),
                      ),
                    )
                  }
                />
              </label>

              <label>
                <span>Transport</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={transportCharge || ""}
                  onChange={(event) =>
                    setTransportCharge(
                      Math.max(
                        0,
                        toNumber(event.target.value),
                      ),
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
                        toNumber(event.target.value),
                      ),
                    )
                  }
                />
              </label>
            </div>

            <div className="ncsTotals">
              <p>
                <span>Subtotal</span>
                <strong>{formatCurrency(subtotal)}</strong>
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

              <p>
                <span>Cess</span>
                <strong>{formatCurrency(cessAmount)}</strong>
              </p>

              <p>
                <span>Discount</span>
                <strong>
                  − {formatCurrency(discountAmount)}
                </strong>
              </p>

              <p>
                <span>Extra Charges</span>
                <strong>
                  {formatCurrency(
                    transportCharge + otherCharge,
                  )}
                </strong>
              </p>

              <p className="ncsGrandTotal">
                <span>Purchase Total</span>
                <strong>{formatCurrency(totalAmount)}</strong>
              </p>
            </div>

            <div className="ncsPaymentsHeader">
              <div>
                <span>PAYMENT BREAKDOWN</span>
                <strong>
                  Cash + UPI + Bank + Credit supported
                </strong>
              </div>

              <button
                type="button"
                onClick={addPaymentRow}
              >
                + Add Payment
              </button>
            </div>

            <div className="ncsPayments">
              {payments.map((payment) => (
                <article key={payment.id}>
                  <select
                    value={payment.method}
                    onChange={(event) =>
                      updatePayment(
                        payment.id,
                        "method",
                        event.target
                          .value as PaymentMethod,
                      )
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">
                      Bank Transfer
                    </option>
                    <option value="other">Other</option>
                  </select>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payment.amount || ""}
                    onChange={(event) =>
                      updatePayment(
                        payment.id,
                        "amount",
                        Math.max(
                          0,
                          toNumber(event.target.value),
                        ),
                      )
                    }
                    placeholder="Amount"
                  />

                  <input
                    value={payment.reference}
                    onChange={(event) =>
                      updatePayment(
                        payment.id,
                        "reference",
                        event.target.value,
                      )
                    }
                    placeholder="Reference optional"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      removePaymentRow(payment.id)
                    }
                  >
                    ×
                  </button>
                </article>
              ))}
            </div>

            <div className="ncsPaymentSummary">
              <p>
                <span>Paid Now</span>
                <strong>{formatCurrency(safePaid)}</strong>
              </p>
              <p>
                <span>Current Purchase Due</span>
                <strong>
                  {formatCurrency(currentPurchaseDue)}
                </strong>
              </p>
              <p>
                <span>Previous Supplier Due</span>
                <strong>
                  {formatCurrency(previousSupplierBalance)}
                </strong>
              </p>
              <p className="ncsOutstanding">
                <span>Total Supplier Outstanding</span>
                <strong>
                  {formatCurrency(closingSupplierBalance)}
                </strong>
              </p>
            </div>

            <label className="ncsNotes">
              <span>Notes</span>
              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Purchase, transport or credit notes"
              />
            </label>

            <button
              type="submit"
              className="ncsCompleteButton"
              disabled={
                saving ||
                items.filter((item) =>
                  item.productName.trim(),
                ).length === 0
              }
            >
              <span>{saving ? "…" : "✓"}</span>
              <div>
                <strong>
                  {saving
                    ? "Saving Purchase..."
                    : "Complete Purchase"}
                </strong>
                <small>{formatCurrency(totalAmount)}</small>
              </div>
              <b>→</b>
            </button>

            <small className="ncsSafetyNote">
              Stock, online quantity, purchase history and
              supplier balance save together in one database
              transaction.
            </small>
          </div>
        </aside>
      </form>

      {successPurchase && (
        <div className="ncsModalOverlay">
          <section className="ncsSuccessModal">
            <div className="ncsSuccessIcon">✓</div>
            <span>PURCHASE COMPLETED</span>
            <h2>{successPurchase.purchase_number}</h2>
            <p>
              Stock, supplier ledger and online availability
              were updated successfully.
            </p>

            <div className="ncsSuccessGrid">
              <div>
                <span>Total</span>
                <strong>
                  {formatCurrency(
                    toNumber(successPurchase.total_amount),
                  )}
                </strong>
              </div>

              <div>
                <span>Paid</span>
                <strong>
                  {formatCurrency(
                    toNumber(successPurchase.paid_amount),
                  )}
                </strong>
              </div>

              <div>
                <span>Current Due</span>
                <strong>
                  {formatCurrency(
                    toNumber(successPurchase.due_amount),
                  )}
                </strong>
              </div>

              <div>
                <span>Total Outstanding</span>
                <strong>
                  {formatCurrency(
                    toNumber(
                      successPurchase.closing_supplier_balance,
                    ),
                  )}
                </strong>
              </div>
            </div>

            <div className="ncsSuccessActions">
              <button
                type="button"
                onClick={() =>
                  setSuccessPurchase(null)
                }
              >
                New Purchase
              </button>

              <a href="/admin/purchase-history">
                View Purchase History
              </a>
            </div>
          </section>
        </div>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .ncsPurchasePage {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(
              circle at 8% 0%,
              rgba(212, 175, 55, 0.13),
              transparent 25%
            ),
            ${IVORY};
          color: ${CHARCOAL};
          font-family: Poppins, Inter, Arial, sans-serif;
        }

        .ncsHero {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
          padding: 22px 24px;
          border: 1px solid rgba(212, 175, 55, 0.38);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 90% 0%,
              rgba(212, 175, 55, 0.25),
              transparent 32%
            ),
            linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: #ffffff;
          box-shadow: 0 18px 45px rgba(3, 21, 63, 0.18);
        }

        .ncsHero > div > span,
        .ncsCardHeader span,
        .ncsSummary > header span,
        .ncsPaymentsHeader span,
        .ncsSuccessModal > span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1.2px;
        }

        .ncsHero h1 {
          margin: 5px 0 0;
          font-size: 32px;
          font-weight: 950;
        }

        .ncsHero p {
          max-width: 760px;
          margin: 7px 0 0;
          color: rgba(255, 255, 255, 0.72);
          font-size: 12px;
          line-height: 1.6;
        }

        .ncsHeroActions {
          display: flex;
          gap: 9px;
        }

        .ncsHeroActions button,
        .ncsHeroActions a {
          min-height: 43px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 14px;
          border: 1px solid ${GOLD};
          border-radius: 11px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-size: 10px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        .ncsHeroActions a {
          background: transparent;
          color: #ffffff;
        }

        .ncsPurchaseLayout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(340px, 390px);
          gap: 18px;
          align-items: start;
        }

        .ncsPurchaseMain {
          min-width: 0;
          display: grid;
          gap: 16px;
        }

        .ncsCard,
        .ncsSummary {
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 20px;
          background: #ffffff;
          box-shadow: 0 12px 32px rgba(3, 21, 63, 0.08);
        }

        .ncsCard {
          padding: 18px;
        }

        .ncsCardHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 15px;
        }

        .ncsCardHeader h2,
        .ncsSummary h2 {
          margin: 4px 0 0;
          color: ${ROYAL_BLUE};
          font-size: 19px;
        }

        .ncsCardHeader p {
          margin: 5px 0 0;
          color: #7d8797;
          font-size: 10px;
        }

        .ncsPrimarySmall,
        .ncsSecondaryButton {
          min-height: 38px;
          padding: 0 12px;
          border: 1px solid ${GOLD};
          border-radius: 9px;
          background: ${ROYAL_BLUE};
          color: #ffffff;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsSecondaryButton {
          background: white;
          color: ${ROYAL_BLUE};
        }

        label {
          min-width: 0;
        }

        label > span,
        .ncsChargeGrid span,
        .ncsNotes span {
          display: block;
          margin-bottom: 6px;
          color: #667085;
          font-size: 9px;
          font-weight: 850;
        }

        input,
        select,
        textarea {
          width: 100%;
          min-height: 42px;
          padding: 0 10px;
          border: 1px solid #dbe1e9;
          border-radius: 10px;
          outline: none;
          background: #ffffff;
          color: #344054;
          font: inherit;
          font-size: 10px;
          font-weight: 650;
        }

        textarea {
          min-height: 82px;
          padding: 10px;
          resize: vertical;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: ${GOLD};
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.12);
        }

        .ncsSupplierSearchWrap,
        .ncsProductSearchWrap {
          position: relative;
          margin-bottom: 14px;
        }

        .ncsDropdown {
          position: absolute;
          z-index: 40;
          top: calc(100% + 5px);
          left: 0;
          right: 0;
          max-height: 310px;
          overflow-y: auto;
          border: 1px solid #dfe4eb;
          border-radius: 12px;
          background: white;
          box-shadow: 0 18px 38px rgba(3, 21, 63, 0.18);
        }

        .ncsDropdown button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px;
          border: 0;
          border-bottom: 1px solid #eef1f5;
          background: white;
          text-align: left;
          cursor: pointer;
        }

        .ncsDropdown button:hover {
          background: #f7f9fc;
        }

        .ncsDropdown strong,
        .ncsDropdown span,
        .ncsDropdown small {
          display: block;
        }

        .ncsDropdown strong {
          color: ${ROYAL_BLUE};
          font-size: 10px;
        }

        .ncsDropdown span,
        .ncsDropdown small {
          margin-top: 3px;
          color: #8a93a0;
          font-size: 8px;
        }

        .ncsDropdownMessage {
          padding: 14px;
          color: #667085;
          font-size: 10px;
        }

        .ncsProductThumb {
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
          overflow: hidden;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: ${ROYAL_BLUE};
          color: ${GOLD};
          font-size: 9px;
          font-weight: 900;
        }

        .ncsProductThumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ncsSupplierGrid,
        .ncsInvoiceGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .ncsInvoiceGrid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 12px;
        }

        .ncsSupplierBalanceStrip {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
          margin-top: 12px;
        }

        .ncsSupplierBalanceStrip > div {
          padding: 12px;
          border: 1px solid rgba(212, 175, 55, 0.22);
          border-radius: 12px;
          background: linear-gradient(135deg, #f9fbff, #fffaf0);
        }

        .ncsSupplierBalanceStrip span,
        .ncsSupplierBalanceStrip strong {
          display: block;
        }

        .ncsSupplierBalanceStrip span {
          color: #8a93a0;
          font-size: 8px;
          font-weight: 800;
        }

        .ncsSupplierBalanceStrip strong {
          margin-top: 5px;
          color: ${ROYAL_BLUE};
          font-size: 15px;
        }

        .ncsPurchaseRows {
          display: grid;
          gap: 14px;
        }

        .ncsPurchaseRowCard {
          overflow: hidden;
          border: 1px solid #dfe4eb;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 8px 22px rgba(3, 21, 63, 0.06);
        }

        .ncsPurchaseRowHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-bottom: 1px solid #e8ecf2;
          background: linear-gradient(135deg, #f7f9fc, #fffaf0);
        }

        .ncsPurchaseRowTitle {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ncsPurchaseRowTitle > span {
          display: grid;
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          place-items: center;
          border-radius: 50%;
          background: ${ROYAL_BLUE};
          color: ${GOLD};
          font-size: 11px;
          font-weight: 950;
        }

        .ncsPurchaseRowTitle strong,
        .ncsPurchaseRowTitle small {
          display: block;
        }

        .ncsPurchaseRowTitle strong {
          color: ${ROYAL_BLUE};
          font-size: 12px;
        }

        .ncsPurchaseRowTitle small {
          margin-top: 3px;
          color: #8a93a0;
          font-size: 8px;
        }

        .ncsPurchaseRowActions {
          display: flex;
          gap: 7px;
        }

        .ncsPurchaseRowActions button {
          min-height: 34px;
          padding: 0 10px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          background: white;
          color: ${ROYAL_BLUE};
          font-size: 8px;
          font-weight: 850;
          cursor: pointer;
        }

        .ncsPurchaseRowActions .danger {
          border-color: #f3b7b2;
          background: #fff6f5;
          color: #b42318;
        }

        .ncsPurchaseRowGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr) minmax(280px, 0.9fr);
          gap: 12px;
          padding: 14px;
        }

        .ncsPurchaseRowSection {
          min-width: 0;
          padding: 12px;
          border: 1px solid #edf0f4;
          border-radius: 12px;
          background: #fbfcfe;
        }

        .ncsPurchaseRowSection h3 {
          margin: 0 0 10px;
          color: ${ROYAL_BLUE};
          font-size: 10px;
          font-weight: 900;
        }

        .ncsPurchaseRowSection label {
          display: block;
          margin-bottom: 8px;
        }

        .ncsPurchaseRowSection input {
          min-height: 38px;
          font-size: 9px;
        }

        .ncsPurchaseInnerGrid {
          display: grid;
          gap: 7px;
        }

        .ncsPurchaseInnerGrid.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .ncsPurchaseInnerGrid.three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .ncsNewVariantMessage,
        .ncsOfflineNote {
          margin-top: 6px;
          padding: 9px 10px;
          border-radius: 9px;
          font-size: 8px;
          line-height: 1.45;
        }

        .ncsNewVariantMessage {
          border: 1px solid #fedf89;
          background: #fffaeb;
          color: #b54708;
        }

        .ncsOfflineNote {
          border: 1px solid #b8d8ff;
          background: #eff7ff;
          color: #175cd3;
        }

        .ncsOnlineSection {
          background: linear-gradient(180deg, #f9fbff, #fffaf0);
        }

        .ncsOnlineHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }

        .ncsOnlineHeader h3 {
          margin: 0;
        }

        .ncsToggle {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 0;
        }

        .ncsToggle input {
          width: 16px;
          height: 16px;
          min-height: auto;
          margin: 0;
        }

        .ncsToggle span {
          margin: 0;
          color: ${ROYAL_BLUE};
          font-size: 8px;
          font-weight: 850;
        }

        .ncsPurchaseRowTotal {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 10px;
          padding: 10px 11px;
          border-radius: 10px;
          background: ${ROYAL_BLUE};
          color: white;
        }

        .ncsPurchaseRowTotal span {
          font-size: 8px;
          font-weight: 800;
        }

        .ncsPurchaseRowTotal strong {
          color: ${GOLD};
          font-size: 14px;
        }

        .ncsAddNextRowButton {
          width: calc(100% - 28px);
          min-height: 38px;
          margin: 0 14px 14px;
          border: 1px dashed ${GOLD};
          border-radius: 10px;
          background: #fffdf6;
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsItemHelp {
          margin-top: 11px;
          padding: 11px 12px;
          border: 1px solid #b8d8ff;
          border-radius: 11px;
          background: #eff7ff;
          color: #174d89;
          font-size: 9px;
          line-height: 1.55;
        }

        .ncsSummary {
          position: sticky;
          top: 18px;
          overflow: hidden;
        }

        .ncsSummary > header {
          padding: 18px;
          background: linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: #ffffff;
        }

        .ncsSummary > header h2 {
          color: #ffffff;
        }

        .ncsSummaryBody {
          padding: 16px;
        }

        .ncsChargeGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .ncsTotals {
          margin-top: 13px;
          padding: 12px;
          border-radius: 12px;
          background: #f7f9fc;
        }

        .ncsTotals p,
        .ncsPaymentSummary p {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin: 0;
          padding: 7px 0;
          border-bottom: 1px solid #e7ebf0;
          color: #667085;
          font-size: 9px;
        }

        .ncsTotals strong,
        .ncsPaymentSummary strong {
          color: #344054;
        }

        .ncsGrandTotal {
          margin-top: 5px !important;
          padding-top: 10px !important;
          color: ${ROYAL_BLUE} !important;
          font-size: 12px !important;
          font-weight: 900;
        }

        .ncsGrandTotal strong {
          color: ${ROYAL_BLUE};
          font-size: 16px;
        }

        .ncsPaymentsHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 15px;
        }

        .ncsPaymentsHeader strong {
          display: block;
          margin-top: 3px;
          color: #667085;
          font-size: 8px;
        }

        .ncsPaymentsHeader button {
          min-height: 32px;
          padding: 0 9px;
          border: 1px solid ${GOLD};
          border-radius: 8px;
          background: ${ROYAL_BLUE};
          color: white;
          font-size: 8px;
          font-weight: 850;
          cursor: pointer;
        }

        .ncsPayments {
          display: grid;
          gap: 7px;
          margin-top: 9px;
        }

        .ncsPayments article {
          display: grid;
          grid-template-columns: 100px 90px minmax(0, 1fr) 31px;
          gap: 6px;
        }

        .ncsPayments input,
        .ncsPayments select {
          min-height: 36px;
          font-size: 8px;
        }

        .ncsPayments article button {
          width: 31px;
          height: 36px;
          border: 1px solid #f3b7b2;
          border-radius: 8px;
          background: #fff6f5;
          color: #b42318;
          cursor: pointer;
        }

        .ncsPaymentSummary {
          margin-top: 12px;
          padding: 11px;
          border: 1px solid rgba(212, 175, 55, 0.25);
          border-radius: 12px;
          background: #fffaf0;
        }

        .ncsOutstanding {
          color: ${ROYAL_BLUE} !important;
          font-size: 11px !important;
          font-weight: 900;
        }

        .ncsOutstanding strong {
          color: #b42318;
          font-size: 14px;
        }

        .ncsNotes {
          display: block;
          margin-top: 13px;
        }

        .ncsCompleteButton {
          width: 100%;
          min-height: 60px;
          display: grid;
          grid-template-columns: 32px 1fr 20px;
          align-items: center;
          gap: 9px;
          margin-top: 14px;
          padding: 10px 13px;
          border: 1px solid ${GOLD};
          border-radius: 13px;
          background: linear-gradient(135deg, ${ROYAL_BLUE}, ${DEEP_BLUE});
          color: white;
          cursor: pointer;
        }

        .ncsCompleteButton:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ncsCompleteButton > span {
          display: grid;
          width: 30px;
          height: 30px;
          place-items: center;
          border-radius: 50%;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-weight: 950;
        }

        .ncsCompleteButton div {
          text-align: left;
        }

        .ncsCompleteButton strong,
        .ncsCompleteButton small {
          display: block;
        }

        .ncsCompleteButton strong {
          font-size: 11px;
        }

        .ncsCompleteButton small {
          margin-top: 2px;
          color: ${GOLD};
          font-size: 9px;
        }

        .ncsSafetyNote {
          display: block;
          margin-top: 8px;
          color: #8a93a0;
          font-size: 7px;
          line-height: 1.5;
          text-align: center;
        }

        .ncsNotice {
          position: fixed;
          z-index: 1000;
          top: 18px;
          right: 18px;
          width: min(390px, calc(100vw - 36px));
          display: flex;
          gap: 10px;
          padding: 13px 14px;
          border-radius: 12px;
          box-shadow: 0 18px 38px rgba(3, 21, 63, 0.2);
        }

        .ncsNotice span {
          display: grid;
          width: 24px;
          height: 24px;
          flex: 0 0 24px;
          place-items: center;
          border-radius: 50%;
          font-weight: 900;
        }

        .ncsNotice p {
          margin: 2px 0 0;
          font-size: 10px;
          font-weight: 750;
        }

        .ncsNotice-success {
          border: 1px solid #a6f4c5;
          background: #ecfdf3;
          color: #067647;
        }

        .ncsNotice-error,
        .ncsLoadError {
          border: 1px solid #fecdca;
          background: #fef3f2;
          color: #b42318;
        }

        .ncsNotice-info {
          border: 1px solid #b8d8ff;
          background: #eff7ff;
          color: #175cd3;
        }

        .ncsLoadError {
          margin-bottom: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 10px;
        }

        .ncsModalOverlay {
          position: fixed;
          z-index: 1200;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(3, 21, 63, 0.72);
        }

        .ncsSuccessModal {
          width: min(560px, 100%);
          padding: 25px;
          border: 1px solid rgba(212, 175, 55, 0.5);
          border-radius: 22px;
          background: white;
          text-align: center;
          box-shadow: 0 28px 70px rgba(3, 21, 63, 0.3);
        }

        .ncsSuccessIcon {
          width: 62px;
          height: 62px;
          display: grid;
          place-items: center;
          margin: 0 auto 12px;
          border-radius: 50%;
          background: ${ROYAL_BLUE};
          color: ${GOLD};
          font-size: 28px;
          font-weight: 950;
        }

        .ncsSuccessModal h2 {
          margin: 7px 0 0;
          color: ${ROYAL_BLUE};
        }

        .ncsSuccessModal p {
          color: #667085;
          font-size: 10px;
        }

        .ncsSuccessGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
          margin-top: 16px;
        }

        .ncsSuccessGrid > div {
          padding: 12px;
          border-radius: 11px;
          background: #f7f9fc;
        }

        .ncsSuccessGrid span,
        .ncsSuccessGrid strong {
          display: block;
        }

        .ncsSuccessGrid span {
          color: #8a93a0;
          font-size: 8px;
        }

        .ncsSuccessGrid strong {
          margin-top: 5px;
          color: ${ROYAL_BLUE};
          font-size: 14px;
        }

        .ncsSuccessActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 17px;
        }

        .ncsSuccessActions button,
        .ncsSuccessActions a {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid ${GOLD};
          border-radius: 10px;
          background: ${ROYAL_BLUE};
          color: white;
          font-size: 9px;
          font-weight: 850;
          text-decoration: none;
          cursor: pointer;
        }

        .ncsSuccessActions a {
          background: white;
          color: ${ROYAL_BLUE};
        }

        @media (max-width: 1450px) {
          .ncsPurchaseLayout {
            grid-template-columns: 1fr;
          }

          .ncsSummary {
            position: static;
          }
        }

        @media (max-width: 1080px) {
          .ncsPurchaseRowGrid {
            grid-template-columns: 1fr 1fr;
          }

          .ncsOnlineSection {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 820px) {
          .ncsPurchasePage {
            padding: 14px 9px 36px;
          }

          .ncsHero {
            align-items: flex-start;
            flex-direction: column;
          }

          .ncsHeroActions {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .ncsSupplierGrid,
          .ncsInvoiceGrid,
          .ncsSupplierBalanceStrip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .ncsPurchaseRowHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .ncsPurchaseRowActions {
            width: 100%;
          }

          .ncsPurchaseRowActions button {
            flex: 1;
          }

          .ncsPurchaseRowGrid,
          .ncsPurchaseInnerGrid.two,
          .ncsPurchaseInnerGrid.three {
            grid-template-columns: 1fr;
          }

          .ncsHeroActions,
          .ncsSupplierGrid,
          .ncsInvoiceGrid,
          .ncsSupplierBalanceStrip,
          .ncsChargeGrid,
          .ncsSuccessGrid,
          .ncsSuccessActions {
            grid-template-columns: 1fr;
          }

          .ncsCardHeader {
            flex-direction: column;
          }

          .ncsCardHeader button {
            width: 100%;
          }

          .ncsPayments article {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </main>
  );
}