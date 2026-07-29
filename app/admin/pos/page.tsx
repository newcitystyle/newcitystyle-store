"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

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
  images?: unknown;
  colors?: unknown;
  sizes?: unknown;
  tax_percent?: number | string | null;
  is_active?: boolean | null;
  status?: string | null;
};

type ProductVariantRow = {
  id: number;
  product_id: number;
  variant_name?: string | null;
  size?: string | null;
  color?: string | null;
  sku?: string | null;
  barcode?: string | null;
  purchase_price?: number | string | null;
  selling_price?: number | string | null;
  mrp?: number | string | null;
  stock?: number | string | null;
  reserved_stock?: number | string | null;
  low_stock_limit?: number | string | null;
  is_active?: boolean | null;
};

type PosProduct = {
  key: string;
  productId: number;
  variantId: number | null;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  price: number;
  mrp: number;
  stock: number;
  sku: string;
  barcode: string;
  imageUrl: string;
  size: string;
  color: string;
  taxPercent: number;
};

type CartItem = PosProduct & {
  quantity: number;
};

type PaymentMethod = "cash" | "upi" | "card" | "credit";

type HeldBill = {
  id: string;
  holdNumber: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  billDiscountPercent?: number;
  billDiscount?: number;
  roundOffAmount?: number;
  paymentMethod: PaymentMethod;
  creditPaidNow?: number;
  creditDueDate?: string;
  createdAt: string;
};

type CompleteSaleResult = {
  success?: boolean;
  duplicate?: boolean;
  sale_id?: string;
  invoice_number?: string;
  subtotal?: number;
  tax_amount?: number;
  bill_discount?: number;
  round_off?: number;
  total_amount?: number;
  paid_amount?: number;
  due_amount?: number;
  payment_method?: string;
  message?: string;
};

type CompletedSale = {
  saleId: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  billDiscount: number;
  roundOff: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  completedAt: string;
};


const ROYAL_BLUE = "#0A2E73";
const DEEP_BLUE = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";
const CHARCOAL = "#2C2C2C";

const HELD_BILLS_STORAGE_KEY = "ncs_pos_held_bills_v1";

function toNumber(
  value: number | string | null | undefined,
  fallback = 0
) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : fallback;
}

function getProductName(product: ProductRow) {
  return (
    product.name?.trim() ||
    "NEW CITY STYLE Product"
  );
}

function getImageFromUnknown(value: unknown): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return "";
    }

    try {
      const parsedValue = JSON.parse(trimmedValue);

      return getImageFromUnknown(parsedValue);
    } catch {
      return trimmedValue;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const image = getImageFromUnknown(item);

      if (image) {
        return image;
      }
    }

    return "";
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    return (
      getImageFromUnknown(record.url) ||
      getImageFromUnknown(record.image_url) ||
      getImageFromUnknown(record.image) ||
      getImageFromUnknown(record.src)
    );
  }

  return "";
}

function getProductImage(product: ProductRow) {
  return (
    getImageFromUnknown(product.image_url) ||
    getImageFromUnknown(product.image) ||
    getImageFromUnknown(product.images)
  );
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

function getAvailableStock(product: PosProduct) {
  return Math.max(0, product.stock);
}

function getDefaultCreditDueDate() {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  return dueDate.toISOString().slice(0, 10);
}

function createHoldNumber() {
  const now = new Date();

  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const timePart = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  return `HOLD-${datePart}-${timePart}`;
}

export default function PosPage() {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [products, setProducts] = useState<PosProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("All");

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [billDiscountPercent, setBillDiscountPercent] = useState(0);
  const [roundOffAmount, setRoundOffAmount] = useState(0);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");

  const [creditPaidNow, setCreditPaidNow] = useState(0);
  const [creditDueDate, setCreditDueDate] = useState(
    getDefaultCreditDueDate()
  );

  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [showHeldBills, setShowHeldBills] = useState(false);

  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<
    "success" | "error" | "info"
  >("info");

  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [isCompletingSale, setIsCompletingSale] = useState(false);
  const [completedSale, setCompletedSale] =
    useState<CompletedSale | null>(null);

  const showNotice = useCallback(
    (
      message: string,
      type: "success" | "error" | "info" = "info"
    ) => {
      setNotice(message);
      setNoticeType(type);

      window.setTimeout(() => {
        setNotice("");
      }, 3200);
    },
    []
  );

  const loadHeldBills = useCallback(() => {
    try {
      const savedValue = window.localStorage.getItem(
        HELD_BILLS_STORAGE_KEY
      );

      if (!savedValue) {
        setHeldBills([]);
        return;
      }

      const parsedValue = JSON.parse(savedValue) as HeldBill[];

      setHeldBills(
        Array.isArray(parsedValue)
          ? parsedValue
          : []
      );
    } catch (error) {
      console.error("Unable to load held bills:", error);
      setHeldBills([]);
    }
  }, []);

  useEffect(() => {
    loadHeldBills();
  }, [loadHeldBills]);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setLoadError("");

    try {
      const { data: productRows, error: productsError } =
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
              "images",
              "colors",
              "sizes",
              "tax_percent",
              "is_active",
              "status",
            ].join(",")
          )
          .order("created_at", {
            ascending: false,
          });

      if (productsError) {
        throw productsError;
      }

      const safeProductRows =
  (productRows || []) as unknown as ProductRow[];

      let variantRows: ProductVariantRow[] = [];

const { data: variantsData, error: variantsError } =
  await supabase
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
        "purchase_price",
        "selling_price",
        "mrp",
        "stock",
        "reserved_stock",
        "low_stock_limit",
        "is_active",
      ].join(",")
    )
    .eq("is_active", true);

if (!variantsError) {
  variantRows =
    (variantsData || []) as unknown as ProductVariantRow[];
} else {
  console.info(
    "Product variants are not available yet:",
    variantsError.message
  );
}

      const variantsByProductId = new Map<
        number,
        ProductVariantRow[]
      >();

      variantRows.forEach((variant) => {
        const existingVariants =
          variantsByProductId.get(variant.product_id) || [];

        existingVariants.push(variant);
        variantsByProductId.set(
          variant.product_id,
          existingVariants
        );
      });

      const mappedProducts: PosProduct[] = [];

      safeProductRows.forEach((product) => {
        const productIsInactive =
          product.is_active === false ||
          normalizeText(product.status) === "inactive";

        if (productIsInactive) {
          return;
        }

        const productId = Number(product.id);
        const productVariants =
          variantsByProductId.get(productId) || [];

        const commonData = {
          productId,
          name: getProductName(product),
          category:
            product.category?.trim() || "Others",
          subcategory:
            product.subcategory?.trim() || "",
          brand:
            product.brand?.trim() || "NEW CITY STYLE",
          imageUrl: getProductImage(product),
          taxPercent: Math.max(
            0,
            toNumber(product.tax_percent)
          ),
        };

        if (productVariants.length > 0) {
          productVariants.forEach((variant) => {
            const sellingPrice =
              toNumber(variant.selling_price) ||
              toNumber(product.price);

            const localMrp =
              toNumber(variant.mrp) ||
              toNumber(product.mrp) ||
              sellingPrice;

            const variantStock = Math.max(
              0,
              toNumber(variant.stock) -
                toNumber(variant.reserved_stock)
            );

            mappedProducts.push({
              ...commonData,
              key: `variant-${variant.id}`,
              variantId: variant.id,
              // Local POS always starts from MRP. The cashier applies
              // the customer discount at billing time.
              price: localMrp,
              mrp: localMrp,
              stock: variantStock,
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
            });
          });

          return;
        }

        const productPrice = toNumber(product.price);
        const localMrp =
          toNumber(product.mrp) || productPrice;

        mappedProducts.push({
          ...commonData,
          key: `product-${productId}`,
          variantId: null,
          // Local POS always starts from MRP.
          price: localMrp,
          mrp: localMrp,
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

      setProducts(mappedProducts);
    } catch (error) {
      console.error("Unable to load POS products:", error);

      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load products."
      );
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const categories = useMemo(() => {
    const categorySet = new Set<string>();

    products.forEach((product) => {
      if (product.category) {
        categorySet.add(product.category);
      }
    });

    return [
      "All",
      ...Array.from(categorySet).sort((a, b) =>
        a.localeCompare(b)
      ),
    ];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery =
      normalizeText(searchQuery);

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "All" ||
        product.category === selectedCategory;

      if (!matchesCategory) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        product.name,
        product.category,
        product.subcategory,
        product.brand,
        product.sku,
        product.barcode,
        product.size,
        product.color,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [products, searchQuery, selectedCategory]);

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (total, item) =>
          total + item.price * item.quantity,
        0
      ),
    [cartItems]
  );

  const itemTax = useMemo(
    () =>
      cartItems.reduce((total, item) => {
        const taxableValue =
          item.price * item.quantity;

        return (
          total +
          (taxableValue * item.taxPercent) / 100
        );
      }, 0),
    [cartItems]
  );

  const billBaseTotal = subtotal + itemTax;

  const safeBillDiscountPercent = Math.min(
    100,
    Math.max(0, billDiscountPercent)
  );

  const billDiscountAmount =
    (billBaseTotal * safeBillDiscountPercent) / 100;

  const grandTotal = Math.max(
    0,
    billBaseTotal - billDiscountAmount
  );

  const safeRoundOffAmount = Math.min(
    grandTotal,
    Math.max(0, roundOffAmount)
  );

  const finalPayable = Math.max(
    0,
    grandTotal - safeRoundOffAmount
  );

  const safeCreditPaidNow =
    paymentMethod === "credit"
      ? Math.min(
          finalPayable,
          Math.max(0, creditPaidNow)
        )
      : finalPayable;

  const creditDueAmount =
    paymentMethod === "credit"
      ? Math.max(0, finalPayable - safeCreditPaidNow)
      : 0;

  const totalQuantity = useMemo(
    () =>
      cartItems.reduce(
        (total, item) => total + item.quantity,
        0
      ),
    [cartItems]
  );

  function addProductToCart(product: PosProduct) {
    if (getAvailableStock(product) <= 0) {
      showNotice(
        `${product.name} is out of stock.`,
        "error"
      );
      return;
    }

    setCartItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.key === product.key
      );

      if (existingItem) {
        if (
          existingItem.quantity >=
          getAvailableStock(product)
        ) {
          showNotice(
            `Only ${product.stock} item(s) available.`,
            "error"
          );

          return currentItems;
        }

        return currentItems.map((item) =>
          item.key === product.key
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...currentItems,
        {
          ...product,
          quantity: 1,
        },
      ];
    });

    showNotice(
      `${product.name} added to bill.`,
      "success"
    );

    setSearchQuery("");
    searchInputRef.current?.focus();
  }

  function increaseQuantity(itemKey: string) {
    setCartItems((currentItems) =>
      currentItems.map((item) => {
        if (item.key !== itemKey) {
          return item;
        }

        if (item.quantity >= item.stock) {
          showNotice(
            `Only ${item.stock} item(s) available.`,
            "error"
          );

          return item;
        }

        return {
          ...item,
          quantity: item.quantity + 1,
        };
      })
    );
  }

  function decreaseQuantity(itemKey: string) {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.key === itemKey
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeCartItem(itemKey: string) {
    setCartItems((currentItems) =>
      currentItems.filter(
        (item) => item.key !== itemKey
      )
    );
  }

  function clearCurrentBill() {
    if (cartItems.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      "Clear all items from the current bill?"
    );

    if (!confirmed) {
      return;
    }

    setCartItems([]);
    setBillDiscountPercent(0);
    setRoundOffAmount(0);
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMethod("cash");
    setCreditPaidNow(0);
    setCreditDueDate(getDefaultCreditDueDate());

    showNotice("Current bill cleared.", "info");
  }

  function saveHeldBills(nextHeldBills: HeldBill[]) {
    setHeldBills(nextHeldBills);

    window.localStorage.setItem(
      HELD_BILLS_STORAGE_KEY,
      JSON.stringify(nextHeldBills)
    );
  }

  function holdCurrentBill() {
    if (cartItems.length === 0) {
      showNotice(
        "Add at least one product before holding the bill.",
        "error"
      );
      return;
    }

    const heldBill: HeldBill = {
      id: crypto.randomUUID(),
      holdNumber: createHoldNumber(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      items: cartItems,
      billDiscountPercent: safeBillDiscountPercent,
      roundOffAmount: safeRoundOffAmount,
      paymentMethod,
      creditPaidNow:
        paymentMethod === "credit"
          ? safeCreditPaidNow
          : 0,
      creditDueDate:
        paymentMethod === "credit"
          ? creditDueDate
          : undefined,
      createdAt: new Date().toISOString(),
    };

    saveHeldBills([heldBill, ...heldBills]);

    setCartItems([]);
    setBillDiscountPercent(0);
    setRoundOffAmount(0);
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMethod("cash");
    setCreditPaidNow(0);
    setCreditDueDate(getDefaultCreditDueDate());

    showNotice(
      `${heldBill.holdNumber} saved successfully.`,
      "success"
    );
  }

  function resumeHeldBill(heldBill: HeldBill) {
    if (cartItems.length > 0) {
      const confirmed = window.confirm(
        "Replace the current bill with this held bill?"
      );

      if (!confirmed) {
        return;
      }
    }

    setCartItems(heldBill.items);
    const heldBaseTotal = heldBill.items.reduce(
      (total, item) =>
        total +
        item.price * item.quantity *
          (1 + item.taxPercent / 100),
      0
    );

    const restoredDiscountPercent =
      typeof heldBill.billDiscountPercent === "number"
        ? heldBill.billDiscountPercent
        : heldBaseTotal > 0
          ? (toNumber(heldBill.billDiscount) /
              heldBaseTotal) *
            100
          : 0;

    setBillDiscountPercent(
      Math.min(100, Math.max(0, restoredDiscountPercent))
    );
    setRoundOffAmount(
      Math.max(0, toNumber(heldBill.roundOffAmount))
    );
    setCustomerName(heldBill.customerName);
    setCustomerPhone(heldBill.customerPhone);
    setPaymentMethod(heldBill.paymentMethod);
    setCreditPaidNow(
      heldBill.paymentMethod === "credit"
        ? Math.max(0, toNumber(heldBill.creditPaidNow))
        : 0
    );
    setCreditDueDate(
      heldBill.creditDueDate ||
        getDefaultCreditDueDate()
    );

    saveHeldBills(
      heldBills.filter(
        (item) => item.id !== heldBill.id
      )
    );

    setShowHeldBills(false);
    setMobileCartOpen(true);

    showNotice(
      `${heldBill.holdNumber} resumed.`,
      "success"
    );
  }

  function deleteHeldBill(heldBillId: string) {
    const confirmed = window.confirm(
      "Delete this held bill?"
    );

    if (!confirmed) {
      return;
    }

    saveHeldBills(
      heldBills.filter(
        (item) => item.id !== heldBillId
      )
    );
  }

  function handleSearchSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const query = searchQuery.trim();

    if (!query) {
      return;
    }

    const normalizedQuery = query.toLowerCase();

    const exactProduct = products.find(
      (product) =>
        normalizeText(product.barcode) ===
          normalizedQuery ||
        normalizeText(product.sku) ===
          normalizedQuery
    );

    if (exactProduct) {
      addProductToCart(exactProduct);
      return;
    }

    if (filteredProducts.length === 1) {
      addProductToCart(filteredProducts[0]);
      return;
    }

    showNotice(
      filteredProducts.length > 1
        ? `${filteredProducts.length} matching products found. Select one.`
        : "No matching product found.",
      filteredProducts.length > 0
        ? "info"
        : "error"
    );
  }

  function handleSearchKeyDown(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Escape") {
      setSearchQuery("");
    }
  }

  async function saveCustomerProfile(
    saleAmount: number
  ): Promise<number | null> {
    const name = customerName.trim();
    const phone = customerPhone.trim();

    if (!name && !phone) {
      return null;
    }

    const now = new Date().toISOString();

    let customerQuery = supabase
      .from("customers")
      .select("id,total_orders,total_spent")
      .limit(1);

    customerQuery = phone
      ? customerQuery.eq("phone", phone)
      : customerQuery.eq("full_name", name);

    const { data: existingCustomer, error: loadError } =
      await customerQuery.maybeSingle();

    if (loadError) {
      throw loadError;
    }

    if (existingCustomer?.id) {
      const { data: updatedCustomer, error: updateError } =
        await supabase
          .from("customers")
          .update({
            full_name: name || "Customer",
            phone: phone || null,
            total_orders:
              toNumber(existingCustomer.total_orders) + 1,
            total_spent:
              toNumber(existingCustomer.total_spent) + saleAmount,
            is_blocked: false,
            updated_at: now,
          })
          .eq("id", existingCustomer.id)
          .select("id")
          .single();

      if (updateError) {
        throw updateError;
      }

      return Number(updatedCustomer.id);
    }

    const { data: newCustomer, error: insertError } =
      await supabase
        .from("customers")
        .insert({
          full_name: name || "Customer",
          email: null,
          phone: phone || null,
          address: null,
          city: null,
          state: null,
          pincode: null,
          total_orders: 1,
          total_spent: saleAmount,
          is_blocked: false,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();

    if (insertError) {
      throw insertError;
    }

    return Number(newCustomer.id);
  }

  async function saveCustomerCredit(
    saleId: string | number | null | undefined,
    invoiceNumber: string,
    syncedCustomerId: number | null
  ) {
    if (
      paymentMethod !== "credit" ||
      creditDueAmount <= 0
    ) {
      return;
    }

    const phone = customerPhone.trim();
    const name = customerName.trim();
    const now = new Date().toISOString();

    const { data: existingAccount, error: accountLoadError } =
      await supabase
        .from("customer_credit_accounts")
        .select("*")
        .eq("customer_phone", phone)
        .maybeSingle();

    if (accountLoadError) {
      throw accountLoadError;
    }

    const previousBalance = toNumber(
      existingAccount?.current_balance
    );
    const previousGiven = toNumber(
      existingAccount?.total_credit_given
    );
    const previousPaid = toNumber(
      existingAccount?.total_credit_paid
    );

    let creditAccountId: string | number;
    let customerId: string | number | null =
      syncedCustomerId ||
      existingAccount?.customer_id ||
      null;

    if (existingAccount?.id) {
      const { data: updatedAccount, error: updateError } =
        await supabase
          .from("customer_credit_accounts")
          .update({
            customer_id: customerId,
            customer_name: name,
            customer_phone: phone,
            total_credit_given:
              previousGiven + finalPayable,
            total_credit_paid:
              previousPaid + safeCreditPaidNow,
            current_balance:
              previousBalance + creditDueAmount,
            last_credit_date: now,
            last_payment_date:
              safeCreditPaidNow > 0
                ? now
                : existingAccount.last_payment_date,
            next_due_date: creditDueDate,
            is_active: true,
            updated_at: now,
          })
          .eq("id", existingAccount.id)
          .select("id,customer_id")
          .single();

      if (updateError) {
        throw updateError;
      }

      creditAccountId = updatedAccount.id;
      customerId =
        updatedAccount.customer_id || customerId;
    } else {
      const { data: newAccount, error: insertError } =
        await supabase
          .from("customer_credit_accounts")
          .insert({
            customer_id: customerId,
            customer_name: name,
            customer_phone: phone,
            customer_email: null,
            customer_address: null,
            credit_limit: 0,
            total_credit_given: finalPayable,
            total_credit_paid: safeCreditPaidNow,
            current_balance: creditDueAmount,
            last_credit_date: now,
            last_payment_date:
              safeCreditPaidNow > 0 ? now : null,
            next_due_date: creditDueDate,
            is_blocked: false,
            is_active: true,
            notes: null,
            created_at: now,
            updated_at: now,
          })
          .select("id,customer_id")
          .single();

      if (insertError) {
        throw insertError;
      }

      creditAccountId = newAccount.id;
      customerId = newAccount.customer_id || null;
    }

    const creditTransaction = {
      credit_account_id: creditAccountId,
      customer_id: customerId,
      customer_phone: phone,
      sale_id: saleId || null,
      transaction_type: "credit_sale",
      amount_change: finalPayable,
      balance_before: previousBalance,
      balance_after:
        previousBalance + finalPayable,
      payment_method: "credit",
      reference_number: invoiceNumber,
      due_date: creditDueDate,
      description: `POS credit sale ${invoiceNumber}`,
      notes:
        safeCreditPaidNow > 0
          ? `Paid now ${formatCurrency(
              safeCreditPaidNow
            )}; due ${formatCurrency(
              creditDueAmount
            )}`
          : null,
      received_by: null,
      created_at: now,
    };

    const transactions = [creditTransaction];

    if (safeCreditPaidNow > 0) {
      transactions.push({
        ...creditTransaction,
        transaction_type: "payment",
        amount_change: -safeCreditPaidNow,
        balance_before:
          previousBalance + finalPayable,
        balance_after:
          previousBalance + creditDueAmount,
        payment_method: "cash",
        description: `Advance payment received for ${invoiceNumber}`,
        notes: null,
      });
    }

    const { error: transactionError } =
      await supabase
        .from("customer_credit_transactions")
        .insert(transactions);

    if (transactionError) {
      throw transactionError;
    }

    if (saleId) {
      const { error: saleAmountError } =
        await supabase
          .from("sales")
          .update({
            paid_amount: safeCreditPaidNow,
            due_amount: creditDueAmount,
          })
          .eq("id", saleId);

      if (saleAmountError) {
        console.info(
          "Sale paid/due columns were not updated:",
          saleAmountError.message
        );
      }

      const { error: saleDueDateError } =
        await supabase
          .from("sales")
          .update({
            due_date: creditDueDate,
          })
          .eq("id", saleId);

      if (saleDueDateError) {
        console.info(
          "Sale due date column is not available:",
          saleDueDateError.message
        );
      }
    }
  }

  function buildWhatsAppInvoiceMessage(sale: CompletedSale) {
    const itemLines = sale.items
      .map((item, index) => {
        const variant =
          [item.size, item.color].filter(Boolean).join(" / ") ||
          item.barcode ||
          item.sku ||
          "";

        return [
          `${index + 1}. ${item.name}`,
          variant ? `   ${variant}` : "",
          `   ${item.quantity} × ${formatCurrency(item.price)} = ${formatCurrency(
            item.price * item.quantity
          )}`,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n");

    return [
      "🛍️ *NEW CITY STYLE*",
      "_Style for Every Family_",
      "",
      `🧾 *Invoice:* ${sale.invoiceNumber}`,
      `📅 *Date:* ${new Date(sale.completedAt).toLocaleString("en-IN")}`,
      `👤 *Customer:* ${sale.customerName || "Walk-in Customer"}`,
      sale.customerPhone ? `📱 *Mobile:* ${sale.customerPhone}` : "",
      "",
      "*Items*",
      itemLines,
      "",
      `Subtotal: ${formatCurrency(sale.subtotal)}`,
      `Tax: ${formatCurrency(sale.taxAmount)}`,
      `Discount: -${formatCurrency(sale.billDiscount)}`,
      `Round Off: -${formatCurrency(sale.roundOff)}`,
      `*Total: ${formatCurrency(sale.totalAmount)}*`,
      `Paid: ${formatCurrency(sale.paidAmount)}`,
      `Due: ${formatCurrency(sale.dueAmount)}`,
      `Payment: ${sale.paymentMethod.toUpperCase()}`,
      "",
      "Thank you for shopping with NEW CITY STYLE.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function shareCompletedSaleOnWhatsApp(sale: CompletedSale) {
    const digits = sale.customerPhone.replace(/\D/g, "");
    const phone =
      digits.length === 10
        ? `91${digits}`
        : digits;

    const message = buildWhatsAppInvoiceMessage(sale);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    const popup = window.open(url, "_blank", "noopener,noreferrer");

    if (!popup) {
      showNotice(
        "Please allow popups to share the invoice on WhatsApp.",
        "error"
      );
    }
  }

  function printCompletedSaleInvoice(sale: CompletedSale) {
    const rows = sale.items
      .map(
        (item) => `
          <tr>
            <td>${item.name}</td>
            <td>${[item.size, item.color].filter(Boolean).join(" / ") || item.barcode || item.sku || "—"}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${formatCurrency(item.price * item.quantity)}</td>
          </tr>
        `
      )
      .join("");

    const popup = window.open("", "_blank", "width=900,height=900");

    if (!popup) {
      showNotice(
        "Please allow popups to print the invoice.",
        "error"
      );
      return;
    }

    popup.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${sale.invoiceNumber}</title>
        <style>
          body{font-family:Arial,sans-serif;color:#222;padding:28px}
          .head{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #0A2E73;padding-bottom:18px}
          h1{margin:4px 0;color:#0A2E73}.gold{color:#D4AF37;font-weight:800}
          .info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}
          .box{border:1px solid #ddd;border-radius:10px;padding:12px}
          table{width:100%;border-collapse:collapse}
          th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}
          th{background:#F8F4EC}.totals{width:360px;margin:20px 0 0 auto}
          .line{display:flex;justify-content:space-between;padding:7px 0}
          .grand{border-top:2px solid #0A2E73;padding-top:12px;color:#0A2E73;font-size:20px}
        </style>
      </head>
      <body>
        <div class="head">
          <div>
            <div class="gold">NEW CITY STYLE</div>
            <h1>Style for Every Family</h1>
          </div>
          <div>
            <b>${sale.invoiceNumber}</b><br/>
            ${new Date(sale.completedAt).toLocaleString("en-IN")}
          </div>
        </div>

        <div class="info">
          <div class="box">
            <b>Customer</b><br/>
            ${sale.customerName || "Walk-in Customer"}<br/>
            ${sale.customerPhone || ""}
          </div>
          <div class="box">
            <b>Payment</b><br/>
            ${sale.paymentMethod.toUpperCase()}<br/>
            ${sale.dueAmount > 0 ? "DUE" : "PAID"}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Variant</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="totals">
          <div class="line"><span>Subtotal</span><b>${formatCurrency(sale.subtotal)}</b></div>
          <div class="line"><span>Tax</span><b>${formatCurrency(sale.taxAmount)}</b></div>
          <div class="line"><span>Discount</span><b>-${formatCurrency(sale.billDiscount)}</b></div>
          <div class="line"><span>Round Off</span><b>-${formatCurrency(sale.roundOff)}</b></div>
          <div class="line grand"><span>Total</span><b>${formatCurrency(sale.totalAmount)}</b></div>
          <div class="line"><span>Paid</span><b>${formatCurrency(sale.paidAmount)}</b></div>
          <div class="line"><span>Due</span><b>${formatCurrency(sale.dueAmount)}</b></div>
        </div>

        <script>window.onload=()=>window.print()</script>
      </body>
      </html>
    `);

    popup.document.close();
  }

  function startNewBill() {
    setCompletedSale(null);
    window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }

  async function handleCompleteSale() {
    if (isCompletingSale) {
      return;
    }

    if (cartItems.length === 0) {
      showNotice(
        "Add products before completing the sale.",
        "error"
      );
      return;
    }

    if (
      paymentMethod === "credit" &&
      !customerName.trim()
    ) {
      showNotice(
        "Customer name is required for a credit bill.",
        "error"
      );
      return;
    }

    if (
      paymentMethod === "credit" &&
      !customerPhone.trim()
    ) {
      showNotice(
        "Customer mobile number is required for a credit bill.",
        "error"
      );
      return;
    }

    if (
      paymentMethod === "credit" &&
      !creditDueDate
    ) {
      showNotice(
        "Select a due date for the credit bill.",
        "error"
      );
      return;
    }

    if (
      paymentMethod === "credit" &&
      creditDueAmount <= 0
    ) {
      showNotice(
        "Due amount must be greater than zero for a credit bill.",
        "error"
      );
      return;
    }

    const invalidStockItem = cartItems.find(
      (item) =>
        item.quantity <= 0 ||
        item.quantity > item.stock
    );

    if (invalidStockItem) {
      showNotice(
        `Available stock changed for ${invalidStockItem.name}. Refresh stock and try again.`,
        "error"
      );
      return;
    }

    setIsCompletingSale(true);

    try {
      const clientTransactionId =
        typeof crypto !== "undefined" &&
        "randomUUID" in crypto
          ? crypto.randomUUID()
          : `POS-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 10)}`;

      const rpcItems = cartItems.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
      }));

      const { data, error } = await supabase.rpc(
        "complete_pos_sale",
        {
          p_items: rpcItems,
          p_customer_name:
            customerName.trim() || null,
          p_customer_phone:
            customerPhone.trim() || null,
          p_customer_email: null,
          p_payment_method: paymentMethod,
          p_bill_discount: billDiscountAmount,
          p_round_off: safeRoundOffAmount,
          p_notes: null,
          p_client_transaction_id:
            clientTransactionId,
          p_device_id: "web-admin-pos",
          p_is_offline: false,
        }
      );

      if (error) {
        throw error;
      }

      const result =
        (data || {}) as unknown as CompleteSaleResult;

      if (result.success === false) {
        throw new Error(
          result.message ||
            "Unable to complete the sale."
        );
      }

      const invoiceNumber =
        result.invoice_number || "Invoice created";

      let syncedCustomerId: number | null = null;
      let customerSyncWarning = "";

      if (customerName.trim() || customerPhone.trim()) {
        try {
          syncedCustomerId = await saveCustomerProfile(
            finalPayable
          );
        } catch (customerError) {
          console.error(
            "Sale completed, but customer profile sync failed:",
            customerError
          );
          customerSyncWarning =
            customerError instanceof Error
              ? customerError.message
              : typeof customerError === "object" &&
                  customerError !== null &&
                  "message" in customerError
                ? String(
                    (customerError as { message?: unknown }).message ||
                      "Customer profile sync failed."
                  )
                : "Customer profile sync failed.";
        }
      }

      if (paymentMethod === "credit") {
        await saveCustomerCredit(
          result.sale_id,
          invoiceNumber,
          syncedCustomerId
        );
      }

      const saleSnapshot: CompletedSale = {
        saleId: result.sale_id || "",
        invoiceNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items: cartItems.map((item) => ({ ...item })),
        subtotal: toNumber(result.subtotal, subtotal),
        taxAmount: toNumber(result.tax_amount, itemTax),
        billDiscount: toNumber(
          result.bill_discount,
          billDiscountAmount
        ),
        roundOff: toNumber(
          result.round_off,
          safeRoundOffAmount
        ),
        totalAmount: toNumber(
          result.total_amount,
          finalPayable
        ),
        paidAmount: toNumber(
          result.paid_amount,
          safeCreditPaidNow
        ),
        dueAmount: toNumber(
          result.due_amount,
          creditDueAmount
        ),
        paymentMethod,
        completedAt: new Date().toISOString(),
      };

      setCompletedSale(saleSnapshot);

      setCartItems([]);
      setBillDiscountPercent(0);
      setRoundOffAmount(0);
      setCustomerName("");
      setCustomerPhone("");
      setPaymentMethod("cash");
      setCreditPaidNow(0);
      setCreditDueDate(getDefaultCreditDueDate());
      setMobileCartOpen(false);
      setSearchQuery("");

      await loadProducts();

      showNotice(
        customerSyncWarning
          ? `${invoiceNumber} completed. Customer sync warning: ${customerSyncWarning}`
          : `${invoiceNumber} completed successfully.`,
        customerSyncWarning ? "info" : "success"
      );

      window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error("Unable to complete POS sale:", error);

      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" &&
              error !== null &&
              "message" in error
            ? String(
                (error as { message?: unknown }).message ||
                  "Unable to complete the sale."
              )
            : "Unable to complete the sale.";

      showNotice(message, "error");

      await loadProducts();
    } finally {
      setIsCompletingSale(false);
    }
  }

  return (
    <main className="ncsPosPage">
      {notice && (
        <div
          className={`ncsPosNotice ncsPosNotice-${noticeType}`}
          role="status"
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

      <section className="ncsPosHeader">
        <div>
          <span className="ncsPosEyebrow">
            NEW CITY STYLE • PREMIUM POS
          </span>

          <h1>Billing Counter</h1>

          <p>
            Fast barcode billing, live stock and customer
            rewards.
          </p>
        </div>

        <div className="ncsPosHeaderActions">
          <button
            type="button"
            className="ncsPosSecondaryButton"
            onClick={() =>
              setShowHeldBills(true)
            }
          >
            <span>⏸</span>
            Held Bills
            {heldBills.length > 0 && (
              <b>{heldBills.length}</b>
            )}
          </button>

          <button
            type="button"
            className="ncsPosRefreshButton"
            onClick={loadProducts}
            disabled={loadingProducts}
          >
            <span
              className={
                loadingProducts
                  ? "ncsPosRotating"
                  : ""
              }
            >
              ↻
            </span>
            Refresh Stock
          </button>
        </div>
      </section>

      <section className="ncsPosWorkspace">
        <div className="ncsPosCatalogue">
          <form
            className="ncsPosSearchPanel"
            onSubmit={handleSearchSubmit}
          >
            <div className="ncsPosSearchIcon">⌕</div>

            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              onKeyDown={handleSearchKeyDown}
              placeholder="Scan barcode or search product, SKU, size, colour..."
              autoComplete="off"
              autoFocus
            />

            {searchQuery && (
              <button
                type="button"
                className="ncsPosClearSearch"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}

            <button
              type="submit"
              className="ncsPosSearchButton"
            >
              Search
            </button>
          </form>

          <div className="ncsPosCategoryRow">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={
                  selectedCategory === category
                    ? "ncsPosCategoryButton ncsPosCategoryActive"
                    : "ncsPosCategoryButton"
                }
                onClick={() =>
                  setSelectedCategory(category)
                }
              >
                {category}
              </button>
            ))}
          </div>

          <div className="ncsPosCatalogueTop">
            <div>
              <h2>Products</h2>

              <p>
                {loadingProducts
                  ? "Loading products..."
                  : `${filteredProducts.length} item(s) available`}
              </p>
            </div>

            <div className="ncsPosStatusBadge">
              <span />
              Live Supabase Stock
            </div>
          </div>

          {loadError && (
            <div className="ncsPosErrorCard">
              <div>!</div>

              <section>
                <strong>
                  Unable to load products
                </strong>
                <p>{loadError}</p>

                <button
                  type="button"
                  onClick={loadProducts}
                >
                  Try Again
                </button>
              </section>
            </div>
          )}

          {loadingProducts ? (
            <div className="ncsPosProductGrid">
              {Array.from({ length: 8 }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="ncsPosSkeletonCard"
                  >
                    <div />
                    <span />
                    <span />
                    <span />
                  </div>
                )
              )}
            </div>
          ) : !loadError &&
            filteredProducts.length === 0 ? (
            <div className="ncsPosEmptyState">
              <div>⌕</div>
              <h3>No products found</h3>
              <p>
                Try another barcode, name, SKU or category.
              </p>
            </div>
          ) : (
            <div className="ncsPosProductGrid">
              {filteredProducts.map((product) => {
                const outOfStock =
                  getAvailableStock(product) <= 0;

                const lowStock =
                  product.stock > 0 &&
                  product.stock <= 5;

                return (
                  <article
                    key={product.key}
                    className={`ncsPosProductCard ${
                      outOfStock
                        ? "ncsPosProductOutOfStock"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="ncsPosProductCardButton"
                      onClick={() =>
                        addProductToCart(product)
                      }
                      disabled={outOfStock}
                    >
                      <div className="ncsPosProductImage">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                          />
                        ) : (
                          <div className="ncsPosImageFallback">
                            NCS
                          </div>
                        )}

                        <span
                          className={`ncsPosStockBadge ${
                            outOfStock
                              ? "ncsPosStockEmpty"
                              : lowStock
                                ? "ncsPosStockLow"
                                : ""
                          }`}
                        >
                          {outOfStock
                            ? "Out of Stock"
                            : `${product.stock} in stock`}
                        </span>
                      </div>

                      <div className="ncsPosProductInfo">
                        <span className="ncsPosProductCategory">
                          {product.category}
                        </span>

                        <h3>{product.name}</h3>

                        {(product.size ||
                          product.color) && (
                          <div className="ncsPosVariantChips">
                            {product.size && (
                              <span>
                                Size: {product.size}
                              </span>
                            )}

                            {product.color && (
                              <span>
                                {product.color}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="ncsPosProductBottom">
                          <div>
                            <strong>
                              {formatCurrency(
                                product.price
                              )}
                            </strong>

                            {product.mrp >
                              product.price && (
                              <del>
                                {formatCurrency(
                                  product.mrp
                                )}
                              </del>
                            )}
                          </div>

                          <span className="ncsPosAddIcon">
                            +
                          </span>
                        </div>

                        {(product.barcode ||
                          product.sku) && (
                          <small>
                            {product.barcode ||
                              product.sku}
                          </small>
                        )}
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside
          className={`ncsPosBillPanel ${
            mobileCartOpen
              ? "ncsPosBillPanelOpen"
              : ""
          }`}
        >
          <div className="ncsPosBillHeader">
            <div>
              <span>Current Bill</span>
              <h2>
                {totalQuantity} Item
                {totalQuantity === 1 ? "" : "s"}
              </h2>
            </div>

            <div className="ncsPosBillHeaderActions">
              <button
                type="button"
                onClick={holdCurrentBill}
                title="Hold bill"
              >
                ⏸
              </button>

              <button
                type="button"
                onClick={clearCurrentBill}
                title="Clear bill"
              >
                ⌫
              </button>

              <button
                type="button"
                className="ncsPosCloseMobileCart"
                onClick={() =>
                  setMobileCartOpen(false)
                }
                aria-label="Close bill"
              >
                ×
              </button>
            </div>
          </div>

          <div className="ncsPosCustomerCard">
            <div className="ncsPosCustomerTitle">
              <span>👤</span>

              <div>
                <strong>Customer</strong>
                <small>
                  Optional for cash sales
                </small>
              </div>
            </div>

            <div className="ncsPosCustomerFields">
              <input
                value={customerName}
                onChange={(event) =>
                  setCustomerName(
                    event.target.value
                  )
                }
                placeholder="Customer name"
              />

              <input
                value={customerPhone}
                onChange={(event) =>
                  setCustomerPhone(
                    event.target.value.replace(
                      /[^0-9+]/g,
                      ""
                    )
                  )
                }
                placeholder="Mobile number"
                inputMode="tel"
              />
            </div>
          </div>

          <div className="ncsPosCartItems">
            {cartItems.length === 0 ? (
              <div className="ncsPosEmptyCart">
                <div>🛍️</div>
                <h3>Bill is empty</h3>
                <p>
                  Scan a barcode or select a product.
                </p>
              </div>
            ) : (
              cartItems.map((item) => (
                <article
                  key={item.key}
                  className="ncsPosCartItem"
                >
                  <div className="ncsPosCartItemTop">
                    <div className="ncsPosCartThumbnail">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                        />
                      ) : (
                        <span>NCS</span>
                      )}
                    </div>

                    <div className="ncsPosCartProductInfo">
                      <h3>{item.name}</h3>

                      <p>
                        {[item.size, item.color]
                          .filter(Boolean)
                          .join(" • ") ||
                          item.category}
                      </p>

                      <strong>
                        {formatCurrency(item.price)}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="ncsPosRemoveItem"
                      onClick={() =>
                        removeCartItem(item.key)
                      }
                      aria-label={`Remove ${item.name}`}
                    >
                      ×
                    </button>
                  </div>

                  <div className="ncsPosCartItemBottom">
                    <div className="ncsPosQuantityControl">
                      <button
                        type="button"
                        onClick={() =>
                          decreaseQuantity(item.key)
                        }
                      >
                        −
                      </button>

                      <span>{item.quantity}</span>

                      <button
                        type="button"
                        onClick={() =>
                          increaseQuantity(item.key)
                        }
                      >
                        +
                      </button>
                    </div>

                    <strong>
                      {formatCurrency(
                        item.price * item.quantity
                      )}
                    </strong>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="ncsPosSummary">
            <label className="ncsPosDiscountField">
              <span>Bill Discount (%)</span>

              <div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={
                    billDiscountPercent === 0
                      ? ""
                      : billDiscountPercent
                  }
                  onChange={(event) =>
                    setBillDiscountPercent(
                      Math.min(
                        100,
                        Math.max(
                          0,
                          toNumber(event.target.value)
                        )
                      )
                    )
                  }
                  placeholder="0"
                  inputMode="decimal"
                />

                <span>%</span>
              </div>
            </label>

            <div className="ncsPosSummaryLine">
              <span>Subtotal</span>
              <strong>
                {formatCurrency(subtotal)}
              </strong>
            </div>

            <div className="ncsPosSummaryLine">
              <span>Tax</span>
              <strong>
                {formatCurrency(itemTax)}
              </strong>
            </div>

            <div className="ncsPosSummaryLine ncsPosDiscountLine">
              <span>
                Discount ({safeBillDiscountPercent.toFixed(2)}%)
              </span>
              <strong>
                − {formatCurrency(billDiscountAmount)}
              </strong>
            </div>

            <label className="ncsPosRoundOffField">
              <span>Round Off Amount</span>

              <div>
                <span>₹</span>
                <input
                  type="number"
                  min="0"
                  max={finalPayable}
                  step="0.01"
                  value={
                    roundOffAmount === 0
                      ? ""
                      : roundOffAmount
                  }
                  onChange={(event) =>
                    setRoundOffAmount(
                      Math.min(
                        grandTotal,
                        Math.max(
                          0,
                          toNumber(event.target.value)
                        )
                      )
                    )
                  }
                  placeholder="0"
                  inputMode="decimal"
                />
              </div>
            </label>

            {safeRoundOffAmount > 0 && (
              <div className="ncsPosSummaryLine ncsPosRoundOffLine">
                <span>Round Off</span>
                <strong>
                  − {formatCurrency(safeRoundOffAmount)}
                </strong>
              </div>
            )}

            <div className="ncsPosTotalLine">
              <div>
                <span>Total Payable</span>
                <small>
                  Inclusive of applicable taxes
                </small>
              </div>

              <strong>
                {formatCurrency(finalPayable)}
              </strong>
            </div>
          </div>

          <div className="ncsPosPaymentSection">
            <span className="ncsPosPaymentLabel">
              Payment Method
            </span>

            <div className="ncsPosPaymentGrid">
              {(
                [
                  {
                    value: "cash",
                    label: "Cash",
                    icon: "₹",
                  },
                  {
                    value: "upi",
                    label: "UPI",
                    icon: "▣",
                  },
                  {
                    value: "card",
                    label: "Card",
                    icon: "▤",
                  },
                  {
                    value: "credit",
                    label: "Credit",
                    icon: "◷",
                  },
                ] as const
              ).map((method) => (
                <button
                  key={method.value}
                  type="button"
                  className={
                    paymentMethod === method.value
                      ? "ncsPosPaymentButton ncsPosPaymentActive"
                      : "ncsPosPaymentButton"
                  }
                  onClick={() => {
                    setPaymentMethod(method.value);

                    if (method.value === "credit") {
                      setCreditPaidNow(0);
                      setCreditDueDate(
                        getDefaultCreditDueDate()
                      );
                    } else {
                      setCreditPaidNow(0);
                    }
                  }}
                >
                  <span>{method.icon}</span>
                  {method.label}
                </button>
              ))}
            </div>

            {paymentMethod === "credit" && (
              <div className="ncsPosCreditPanel">
                <div className="ncsPosCreditTitle">
                  <div>
                    <span>◷</span>
                    <section>
                      <strong>Credit Sale Details</strong>
                      <small>
                        Customer name and mobile are required
                      </small>
                    </section>
                  </div>

                  <b>
                    Due {formatCurrency(creditDueAmount)}
                  </b>
                </div>

                <div className="ncsPosCreditFields">
                  <label>
                    <span>Paid Now</span>
                    <input
                      type="number"
                      min="0"
                      max={finalPayable}
                      step="0.01"
                      value={
                        creditPaidNow === 0
                          ? ""
                          : creditPaidNow
                      }
                      onChange={(event) =>
                        setCreditPaidNow(
                          Math.min(
                            finalPayable,
                            Math.max(
                              0,
                              toNumber(event.target.value)
                            )
                          )
                        )
                      }
                      placeholder="0"
                      inputMode="decimal"
                    />
                  </label>

                  <label>
                    <span>Due Date</span>
                    <input
                      type="date"
                      value={creditDueDate}
                      min={new Date()
                        .toISOString()
                        .slice(0, 10)}
                      onChange={(event) =>
                        setCreditDueDate(
                          event.target.value
                        )
                      }
                    />
                  </label>
                </div>

                <div className="ncsPosCreditSummary">
                  <p>
                    <span>Total Bill</span>
                    <strong>
                      {formatCurrency(finalPayable)}
                    </strong>
                  </p>

                  <p>
                    <span>Paid Now</span>
                    <strong>
                      {formatCurrency(safeCreditPaidNow)}
                    </strong>
                  </p>

                  <p className="ncsPosCreditDueRow">
                    <span>Remaining Due</span>
                    <strong>
                      {formatCurrency(creditDueAmount)}
                    </strong>
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              className="ncsPosCompleteButton"
              onClick={handleCompleteSale}
              disabled={
                cartItems.length === 0 ||
                isCompletingSale
              }
            >
              <span>
                {isCompletingSale ? "…" : "✓"}
              </span>

              <div>
                <strong>
                  {isCompletingSale
                    ? "Saving Sale..."
                    : "Complete Sale"}
                </strong>
                <small>
                  {paymentMethod === "credit"
                    ? `Due ${formatCurrency(
                        creditDueAmount
                      )}`
                    : formatCurrency(finalPayable)}
                </small>
              </div>

              <b>
                {isCompletingSale ? "⌛" : "→"}
              </b>
            </button>
          </div>
        </aside>
      </section>

      <button
        type="button"
        className="ncsPosMobileCartButton"
        onClick={() =>
          setMobileCartOpen(true)
        }
      >
        <span>
          🛒
          {totalQuantity > 0 && (
            <b>{totalQuantity}</b>
          )}
        </span>

        <div>
          <small>Current Bill</small>
          <strong>
            {formatCurrency(finalPayable)}
          </strong>
        </div>

        <i>View →</i>
      </button>

      {mobileCartOpen && (
        <button
          type="button"
          className="ncsPosMobileOverlay"
          onClick={() =>
            setMobileCartOpen(false)
          }
          aria-label="Close bill panel"
        />
      )}

      {showHeldBills && (
        <div className="ncsPosModalOverlay">
          <section className="ncsPosHeldModal">
            <header>
              <div>
                <span>Saved Locally</span>
                <h2>Held Bills</h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowHeldBills(false)
                }
                aria-label="Close held bills"
              >
                ×
              </button>
            </header>

            <div className="ncsPosHeldList">
              {heldBills.length === 0 ? (
                <div className="ncsPosHeldEmpty">
                  <div>⏸</div>
                  <h3>No held bills</h3>
                  <p>
                    Held bills will appear here.
                  </p>
                </div>
              ) : (
                heldBills.map((heldBill) => {
                  const heldBaseTotal =
                    heldBill.items.reduce(
                      (total, item) =>
                        total +
                        item.price *
                          item.quantity *
                          (1 + item.taxPercent / 100),
                      0
                    );

                  const heldDiscountPercent =
                    typeof heldBill.billDiscountPercent ===
                    "number"
                      ? heldBill.billDiscountPercent
                      : heldBaseTotal > 0
                        ? (toNumber(
                            heldBill.billDiscount
                          ) /
                            heldBaseTotal) *
                          100
                        : 0;

                  const heldTotal =
                    heldBaseTotal *
                    (1 -
                      Math.min(
                        100,
                        Math.max(
                          0,
                          heldDiscountPercent
                        )
                      ) /
                        100);

                  const heldQuantity =
                    heldBill.items.reduce(
                      (total, item) =>
                        total + item.quantity,
                      0
                    );

                  return (
                    <article
                      key={heldBill.id}
                      className="ncsPosHeldCard"
                    >
                      <div className="ncsPosHeldCardTop">
                        <div>
                          <strong>
                            {heldBill.holdNumber}
                          </strong>

                          <span>
                            {new Date(
                              heldBill.createdAt
                            ).toLocaleString(
                              "en-IN"
                            )}
                          </span>
                        </div>

                        <b>
                          {formatCurrency(
                            Math.max(0, heldTotal)
                          )}
                        </b>
                      </div>

                      <div className="ncsPosHeldMeta">
                        <span>
                          {heldQuantity} item
                          {heldQuantity === 1
                            ? ""
                            : "s"}
                        </span>

                        <span>
                          {heldBill.customerName ||
                            "Walk-in customer"}
                        </span>

                        <span>
                          {heldBill.paymentMethod.toUpperCase()}
                        </span>
                      </div>

                      <div className="ncsPosHeldActions">
                        <button
                          type="button"
                          onClick={() =>
                            deleteHeldBill(
                              heldBill.id
                            )
                          }
                        >
                          Delete
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            resumeHeldBill(heldBill)
                          }
                        >
                          Resume Bill
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {completedSale && (
        <div className="ncsPosSuccessOverlay">
          <section className="ncsPosSuccessModal">
            <div className="ncsPosSuccessIcon">✓</div>

            <span className="ncsPosSuccessEyebrow">
              SALE COMPLETED
            </span>

            <h2>{completedSale.invoiceNumber}</h2>

            <p className="ncsPosSuccessCustomer">
              {completedSale.customerName || "Walk-in Customer"}
              {completedSale.customerPhone
                ? ` • ${completedSale.customerPhone}`
                : ""}
            </p>

            <div className="ncsPosSuccessAmount">
              <small>Total Paid</small>
              <strong>
                {formatCurrency(completedSale.paidAmount)}
              </strong>

              {completedSale.dueAmount > 0 && (
                <span>
                  Due {formatCurrency(completedSale.dueAmount)}
                </span>
              )}
            </div>

            <div className="ncsPosSuccessSummary">
              <p>
                <span>Items</span>
                <strong>
                  {completedSale.items.reduce(
                    (total, item) =>
                      total + item.quantity,
                    0
                  )}
                </strong>
              </p>
              <p>
                <span>Payment</span>
                <strong>
                  {completedSale.paymentMethod.toUpperCase()}
                </strong>
              </p>
              <p>
                <span>Discount</span>
                <strong>
                  {formatCurrency(completedSale.billDiscount)}
                </strong>
              </p>
              <p>
                <span>Round Off</span>
                <strong>
                  {formatCurrency(completedSale.roundOff)}
                </strong>
              </p>
            </div>

            <div className="ncsPosSuccessActions">
              <button
                type="button"
                className="ncsPosSuccessWhatsApp"
                onClick={() =>
                  shareCompletedSaleOnWhatsApp(completedSale)
                }
              >
                <span>◉</span>
                Send WhatsApp Invoice
              </button>

              <button
                type="button"
                className="ncsPosSuccessPrint"
                onClick={() =>
                  printCompletedSaleInvoice(completedSale)
                }
              >
                Print Invoice
              </button>

              <button
                type="button"
                className="ncsPosSuccessNewBill"
                onClick={startNewBill}
              >
                New Bill
              </button>
            </div>

            <small className="ncsPosSuccessHint">
              WhatsApp opens with the invoice ready. Tap Send to
              deliver it from your logged-in WhatsApp number.
            </small>
          </section>
        </div>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .ncsPosPage {
          width: 100%;
          max-width: 100%;
          min-height: 100vh;
          padding: 22px;
          overflow-x: hidden;
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

        .ncsPosHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
          padding: 22px 24px;
          overflow: hidden;
          border: 1px solid
            rgba(212, 175, 55, 0.32);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 86% 0%,
              rgba(212, 175, 55, 0.25),
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

        .ncsPosEyebrow {
          display: block;
          margin-bottom: 7px;
          color: ${GOLD};
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.7px;
        }

        .ncsPosHeader h1 {
          margin: 0;
          color: #ffffff;
          font-size: clamp(27px, 3vw, 40px);
          font-weight: 950;
          letter-spacing: -1px;
        }

        .ncsPosHeader p {
          margin: 7px 0 0;
          color: rgba(255, 255, 255, 0.68);
          font-size: 13px;
          font-weight: 550;
        }

        .ncsPosHeaderActions {
          display: flex;
          gap: 10px;
          flex-shrink: 0;
        }

        .ncsPosSecondaryButton,
        .ncsPosRefreshButton {
          min-height: 45px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 0 15px;
          border-radius: 12px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 850;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            filter 0.2s ease;
        }

        .ncsPosSecondaryButton {
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.09);
          color: #ffffff;
        }

        .ncsPosSecondaryButton b {
          min-width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 20px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-size: 10px;
        }

        .ncsPosRefreshButton {
          border: 1px solid ${GOLD};
          background: ${GOLD};
          color: ${ROYAL_BLUE};
        }

        .ncsPosSecondaryButton:hover,
        .ncsPosRefreshButton:hover {
          transform: translateY(-2px);
          filter: brightness(1.06);
        }

        .ncsPosRefreshButton:disabled {
          cursor: wait;
          opacity: 0.7;
        }

        .ncsPosRotating {
          display: inline-block;
          animation: ncsPosSpin 0.8s linear
            infinite;
        }

        .ncsPosWorkspace {
          width: 100%;
          min-width: 0;
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(400px, 460px);
          gap: 18px;
          align-items: start;
        }

        .ncsPosCatalogue {
          min-width: 0;
        }

        .ncsPosSearchPanel {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 62px;
          padding: 7px;
          border: 1px solid
            rgba(10, 46, 115, 0.11);
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 14px 35px
            rgba(10, 46, 115, 0.08);
        }

        .ncsPosSearchIcon {
          width: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${ROYAL_BLUE};
          font-size: 26px;
          font-weight: 900;
        }

        .ncsPosSearchPanel input {
          min-width: 0;
          flex: 1;
          height: 48px;
          border: 0;
          outline: none;
          background: transparent;
          color: ${CHARCOAL};
          font-family: inherit;
          font-size: 14px;
          font-weight: 650;
        }

        .ncsPosSearchPanel input::placeholder {
          color: #9298a4;
          font-weight: 550;
        }

        .ncsPosClearSearch {
          width: 35px;
          height: 35px;
          border: 0;
          border-radius: 50%;
          background: #eef1f7;
          color: #626b79;
          font-size: 20px;
          cursor: pointer;
        }

        .ncsPosSearchButton {
          min-width: 95px;
          height: 48px;
          border: 0;
          border-radius: 13px;
          background: linear-gradient(
            135deg,
            ${ROYAL_BLUE},
            #174da4
          );
          color: #ffffff;
          font-family: inherit;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsPosCategoryRow {
          display: flex;
          gap: 9px;
          margin-top: 14px;
          padding: 2px 1px 8px;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .ncsPosCategoryRow::-webkit-scrollbar {
          display: none;
        }

        .ncsPosCategoryButton {
          min-height: 39px;
          flex-shrink: 0;
          padding: 0 15px;
          border: 1px solid
            rgba(10, 46, 115, 0.12);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.84);
          color: #596274;
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .ncsPosCategoryButton:hover {
          border-color: ${GOLD};
          color: ${ROYAL_BLUE};
        }

        .ncsPosCategoryActive {
          border-color: ${ROYAL_BLUE};
          background: ${ROYAL_BLUE};
          color: #ffffff !important;
          box-shadow: 0 8px 20px
            rgba(10, 46, 115, 0.2);
        }

        .ncsPosCatalogueTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin: 16px 0 12px;
        }

        .ncsPosCatalogueTop h2 {
          margin: 0;
          color: ${DEEP_BLUE};
          font-size: 21px;
          font-weight: 950;
        }

        .ncsPosCatalogueTop p {
          margin: 3px 0 0;
          color: #77808f;
          font-size: 11px;
          font-weight: 650;
        }

        .ncsPosStatusBadge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 11px;
          border: 1px solid
            rgba(31, 150, 89, 0.18);
          border-radius: 30px;
          background: rgba(31, 150, 89, 0.08);
          color: #147943;
          font-size: 10px;
          font-weight: 850;
        }

        .ncsPosStatusBadge span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #25a760;
          box-shadow: 0 0 0 4px
            rgba(37, 167, 96, 0.12);
        }

        .ncsPosProductGrid {
          display: grid;
          grid-template-columns: repeat(
            auto-fill,
            minmax(190px, 1fr)
          );
          gap: 14px;
        }

        .ncsPosProductCard {
          min-width: 0;
          overflow: hidden;
          border: 1px solid
            rgba(10, 46, 115, 0.1);
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 10px 28px
            rgba(10, 46, 115, 0.07);
          transition:
            transform 0.22s ease,
            box-shadow 0.22s ease,
            border-color 0.22s ease;
        }

        .ncsPosProductCard:hover {
          transform: translateY(-4px);
          border-color: rgba(212, 175, 55, 0.7);
          box-shadow: 0 18px 38px
            rgba(10, 46, 115, 0.13);
        }

        .ncsPosProductCardButton {
          width: 100%;
          display: block;
          padding: 0;
          border: 0;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .ncsPosProductCardButton:disabled {
          cursor: not-allowed;
        }

        .ncsPosProductImage {
          position: relative;
          height: 165px;
          overflow: hidden;
          background:
            linear-gradient(
              145deg,
              #f4f0e6,
              #ffffff
            );
        }

        .ncsPosProductImage img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform 0.35s ease;
        }

        .ncsPosProductCard:hover
          .ncsPosProductImage
          img {
          transform: scale(1.045);
        }

        .ncsPosImageFallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(
              circle at 30% 20%,
              rgba(212, 175, 55, 0.25),
              transparent 34%
            ),
            linear-gradient(
              135deg,
              ${DEEP_BLUE},
              ${ROYAL_BLUE}
            );
          color: ${GOLD};
          font-size: 25px;
          font-weight: 950;
          letter-spacing: 2px;
        }

        .ncsPosStockBadge {
          position: absolute;
          top: 10px;
          right: 10px;
          padding: 6px 9px;
          border-radius: 30px;
          background: rgba(13, 119, 67, 0.92);
          color: #ffffff;
          font-size: 9px;
          font-weight: 900;
          backdrop-filter: blur(8px);
        }

        .ncsPosStockLow {
          background: rgba(214, 137, 17, 0.94);
        }

        .ncsPosStockEmpty {
          background: rgba(185, 48, 48, 0.94);
        }

        .ncsPosProductOutOfStock {
          opacity: 0.67;
          filter: grayscale(0.25);
        }

        .ncsPosProductInfo {
          padding: 14px;
        }

        .ncsPosProductCategory {
          display: block;
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.7px;
          text-transform: uppercase;
        }

        .ncsPosProductInfo h3 {
          min-height: 42px;
          display: -webkit-box;
          margin: 6px 0 8px;
          overflow: hidden;
          color: ${DEEP_BLUE};
          font-size: 13px;
          font-weight: 850;
          line-height: 1.45;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .ncsPosVariantChips {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-bottom: 9px;
        }

        .ncsPosVariantChips span {
          padding: 4px 7px;
          border-radius: 6px;
          background: #eef2f9;
          color: #586375;
          font-size: 8px;
          font-weight: 800;
        }

        .ncsPosProductBottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .ncsPosProductBottom > div {
          min-width: 0;
        }

        .ncsPosProductBottom strong {
          display: block;
          color: ${ROYAL_BLUE};
          font-size: 15px;
          font-weight: 950;
        }

        .ncsPosProductBottom del {
          display: block;
          margin-top: 1px;
          color: #9b9fac;
          font-size: 9px;
          font-weight: 650;
        }

        .ncsPosAddIcon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: linear-gradient(
            135deg,
            ${GOLD},
            #f0d36d
          );
          color: ${ROYAL_BLUE};
          font-size: 20px;
          font-weight: 950;
          box-shadow: 0 7px 18px
            rgba(212, 175, 55, 0.24);
        }

        .ncsPosProductInfo small {
          display: block;
          margin-top: 9px;
          overflow: hidden;
          color: #9a9faa;
          font-size: 8px;
          font-weight: 650;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsPosBillPanel {
          width: 100%;
          min-width: 0;
          position: sticky;
          top: 18px;
          max-height: calc(100vh - 36px);
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #c8ced8 transparent;
          border: 1px solid
            rgba(10, 46, 115, 0.12);
          border-radius: 22px;
          background: #ffffff;
          box-shadow: 0 18px 48px
            rgba(3, 21, 63, 0.14);
        }

        .ncsPosBillHeader {
          min-height: 79px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 17px 18px;
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
          color: #ffffff;
        }

        .ncsPosBillHeader span {
          display: block;
          color: ${GOLD};
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .ncsPosBillHeader h2 {
          margin: 4px 0 0;
          color: #ffffff;
          font-size: 20px;
          font-weight: 950;
        }

        .ncsPosBillHeaderActions {
          display: flex;
          gap: 7px;
        }

        .ncsPosBillHeaderActions button {
          width: 38px;
          height: 38px;
          border: 1px solid
            rgba(255, 255, 255, 0.18);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.09);
          color: #ffffff;
          font-size: 17px;
          cursor: pointer;
        }

        .ncsPosCloseMobileCart {
          display: none;
        }

        .ncsPosCustomerCard {
          padding: 14px 16px;
          border-bottom: 1px solid #edf0f5;
          background: #fbfcff;
        }

        .ncsPosCustomerTitle {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 10px;
        }

        .ncsPosCustomerTitle > span {
          width: 31px;
          height: 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: rgba(212, 175, 55, 0.15);
          font-size: 15px;
        }

        .ncsPosCustomerTitle strong,
        .ncsPosCustomerTitle small {
          display: block;
        }

        .ncsPosCustomerTitle strong {
          color: ${DEEP_BLUE};
          font-size: 11px;
          font-weight: 900;
        }

        .ncsPosCustomerTitle small {
          margin-top: 2px;
          color: #9298a4;
          font-size: 8px;
          font-weight: 650;
        }

        .ncsPosCustomerFields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .ncsPosCustomerFields input {
          width: 100%;
          min-width: 0;
          height: 39px;
          padding: 0 10px;
          border: 1px solid #e4e8ef;
          border-radius: 10px;
          outline: none;
          background: #ffffff;
          color: ${CHARCOAL};
          font-family: inherit;
          font-size: 10px;
          font-weight: 650;
        }

        .ncsPosCustomerFields input:focus {
          border-color: ${GOLD};
          box-shadow: 0 0 0 3px
            rgba(212, 175, 55, 0.12);
        }

        .ncsPosCartItems {
          min-height: 170px;
          flex: 1;
          padding: 12px 14px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #c8ced8 transparent;
        }

        .ncsPosCartItem {
          padding: 11px;
          border: 1px solid #e8ebf0;
          border-radius: 14px;
          background: #ffffff;
        }

        .ncsPosCartItem + .ncsPosCartItem {
          margin-top: 9px;
        }

        .ncsPosCartItemTop {
          display: flex;
          align-items: flex-start;
          gap: 9px;
        }

        .ncsPosCartThumbnail {
          width: 48px;
          height: 55px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
          border-radius: 10px;
          background: ${ROYAL_BLUE};
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
        }

        .ncsPosCartThumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ncsPosCartProductInfo {
          min-width: 0;
          flex: 1;
        }

        .ncsPosCartProductInfo h3 {
          display: -webkit-box;
          margin: 0;
          overflow: hidden;
          color: ${DEEP_BLUE};
          font-size: 10px;
          font-weight: 850;
          line-height: 1.4;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .ncsPosCartProductInfo p {
          margin: 4px 0;
          color: #8b919d;
          font-size: 8px;
          font-weight: 650;
        }

        .ncsPosCartProductInfo strong {
          color: ${ROYAL_BLUE};
          font-size: 10px;
          font-weight: 900;
        }

        .ncsPosRemoveItem {
          width: 25px;
          height: 25px;
          flex-shrink: 0;
          border: 0;
          border-radius: 8px;
          background: #fff0f0;
          color: #be4141;
          font-size: 16px;
          cursor: pointer;
        }

        .ncsPosCartItemBottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 9px;
          padding-top: 9px;
          border-top: 1px dashed #e5e8ed;
        }

        .ncsPosCartItemBottom > strong {
          color: ${DEEP_BLUE};
          font-size: 12px;
          font-weight: 950;
        }

        .ncsPosQuantityControl {
          display: flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid #dfe4eb;
          border-radius: 9px;
        }

        .ncsPosQuantityControl button {
          width: 30px;
          height: 29px;
          border: 0;
          background: #f2f5fa;
          color: ${ROYAL_BLUE};
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsPosQuantityControl span {
          min-width: 34px;
          color: ${DEEP_BLUE};
          font-size: 11px;
          font-weight: 900;
          text-align: center;
        }

        .ncsPosEmptyCart {
          min-height: 195px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .ncsPosEmptyCart > div {
          width: 55px;
          height: 55px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          background: #f0f3f8;
          font-size: 24px;
        }

        .ncsPosEmptyCart h3 {
          margin: 11px 0 3px;
          color: ${DEEP_BLUE};
          font-size: 13px;
          font-weight: 900;
        }

        .ncsPosEmptyCart p {
          margin: 0;
          color: #969ca7;
          font-size: 9px;
          font-weight: 650;
        }

        .ncsPosSummary {
          padding: 13px 16px;
          border-top: 1px solid #edf0f5;
          background: #fbfcff;
        }

        .ncsPosDiscountField {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 11px;
        }

        .ncsPosDiscountField > span {
          color: #626b78;
          font-size: 10px;
          font-weight: 750;
        }

        .ncsPosDiscountField > div {
          width: 95px;
          height: 35px;
          display: flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid #dfe4eb;
          border-radius: 9px;
          background: #ffffff;
        }

        .ncsPosDiscountField > div > span {
          padding-right: 10px;
          color: ${ROYAL_BLUE};
          font-size: 11px;
          font-weight: 900;
        }

        .ncsPosDiscountField input {
          width: 100%;
          min-width: 0;
          height: 100%;
          padding: 0 4px 0 8px;
          border: 0;
          outline: none;
          background: transparent;
          color: ${DEEP_BLUE};
          font-family: inherit;
          font-size: 11px;
          font-weight: 850;
          text-align: right;
        }

        .ncsPosRoundOffField {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 8px 0 6px;
        }

        .ncsPosRoundOffField > span {
          color: #626b78;
          font-size: 10px;
          font-weight: 750;
        }

        .ncsPosRoundOffField > div {
          width: 105px;
          height: 35px;
          display: flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid #dfe4eb;
          border-radius: 9px;
          background: #ffffff;
        }

        .ncsPosRoundOffField > div > span {
          padding-left: 9px;
          color: ${ROYAL_BLUE};
          font-size: 11px;
          font-weight: 900;
        }

        .ncsPosRoundOffField input {
          width: 100%;
          min-width: 0;
          height: 100%;
          padding: 0 8px 0 4px;
          border: 0;
          outline: none;
          background: transparent;
          color: ${DEEP_BLUE};
          font-family: inherit;
          font-size: 11px;
          font-weight: 850;
          text-align: right;
        }

        .ncsPosRoundOffLine strong {
          color: #b54708;
        }

        .ncsPosSummaryLine {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 0;
          color: #717886;
          font-size: 9px;
          font-weight: 650;
        }

        .ncsPosSummaryLine strong {
          color: ${CHARCOAL};
          font-size: 10px;
          font-weight: 850;
        }

        .ncsPosDiscountLine strong {
          color: #179353;
        }

        .ncsPosTotalLine {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-top: 9px;
          padding-top: 11px;
          border-top: 1px dashed #dce1e8;
        }

        .ncsPosTotalLine span,
        .ncsPosTotalLine small {
          display: block;
        }

        .ncsPosTotalLine span {
          color: ${DEEP_BLUE};
          font-size: 12px;
          font-weight: 950;
        }

        .ncsPosTotalLine small {
          margin-top: 2px;
          color: #9a9faa;
          font-size: 7px;
          font-weight: 650;
        }

        .ncsPosTotalLine > strong {
          color: ${ROYAL_BLUE};
          font-size: 20px;
          font-weight: 950;
          letter-spacing: -0.5px;
        }

        .ncsPosPaymentSection {
          position: sticky;
          z-index: 5;
          bottom: 0;
          flex-shrink: 0;
          padding: 13px 16px 16px;
          border-top: 1px solid #edf0f5;
          background: #ffffff;
          box-shadow: 0 -10px 24px rgba(3, 21, 63, 0.06);
        }

        .ncsPosPaymentLabel {
          display: block;
          margin-bottom: 8px;
          color: ${DEEP_BLUE};
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .ncsPosPaymentGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 7px;
        }

        .ncsPosPaymentButton {
          min-width: 0;
          min-height: 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 6px 3px;
          border: 1px solid #e0e5ec;
          border-radius: 10px;
          background: #ffffff;
          color: #68717f;
          font-family: inherit;
          font-size: 8px;
          font-weight: 800;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .ncsPosPaymentButton span {
          color: ${ROYAL_BLUE};
          font-size: 14px;
          font-weight: 950;
        }

        .ncsPosPaymentActive {
          border-color: ${GOLD};
          background: rgba(212, 175, 55, 0.12);
          color: ${ROYAL_BLUE};
          box-shadow: 0 0 0 2px
            rgba(212, 175, 55, 0.1);
        }

        .ncsPosCreditPanel {
          margin-top: 11px;
          padding: 12px;
          border: 1px solid rgba(212, 175, 55, 0.45);
          border-radius: 13px;
          background:
            linear-gradient(
              135deg,
              rgba(212, 175, 55, 0.12),
              rgba(10, 46, 115, 0.04)
            );
        }

        .ncsPosCreditTitle,
        .ncsPosCreditTitle > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 9px;
        }

        .ncsPosCreditTitle > div > span {
          width: 31px;
          height: 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 10px;
          background: ${ROYAL_BLUE};
          color: ${GOLD};
          font-size: 15px;
          font-weight: 950;
        }

        .ncsPosCreditTitle section strong,
        .ncsPosCreditTitle section small {
          display: block;
        }

        .ncsPosCreditTitle section strong {
          color: ${DEEP_BLUE};
          font-size: 10px;
          font-weight: 950;
        }

        .ncsPosCreditTitle section small {
          margin-top: 2px;
          color: #8a93a0;
          font-size: 7px;
          font-weight: 650;
        }

        .ncsPosCreditTitle > b {
          color: #b42318;
          font-size: 10px;
          white-space: nowrap;
        }

        .ncsPosCreditFields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 10px;
        }

        .ncsPosCreditFields label > span {
          display: block;
          margin-bottom: 5px;
          color: #626b78;
          font-size: 8px;
          font-weight: 850;
        }

        .ncsPosCreditFields input {
          width: 100%;
          min-width: 0;
          height: 38px;
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

        .ncsPosCreditFields input:focus {
          border-color: ${GOLD};
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.12);
        }

        .ncsPosCreditSummary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          margin-top: 9px;
        }

        .ncsPosCreditSummary p {
          margin: 0;
          padding: 8px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.8);
        }

        .ncsPosCreditSummary span,
        .ncsPosCreditSummary strong {
          display: block;
        }

        .ncsPosCreditSummary span {
          color: #8a93a0;
          font-size: 7px;
          font-weight: 750;
        }

        .ncsPosCreditSummary strong {
          margin-top: 3px;
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 950;
        }

        .ncsPosCreditDueRow strong {
          color: #b42318;
        }

        .ncsPosCompleteButton {
          width: 100%;
          min-height: 59px;
          display: flex;
          align-items: center;
          gap: 11px;
          margin-top: 11px;
          padding: 8px 14px;
          border: 1px solid ${GOLD};
          border-radius: 14px;
          background:
            linear-gradient(
              135deg,
              ${ROYAL_BLUE},
              #174da4
            );
          color: #ffffff;
          font-family: inherit;
          cursor: pointer;
          box-shadow: 0 12px 28px
            rgba(10, 46, 115, 0.22);
          transition:
            transform 0.2s ease,
            filter 0.2s ease;
        }

        .ncsPosCompleteButton:hover {
          transform: translateY(-2px);
          filter: brightness(1.06);
        }

        .ncsPosCompleteButton:disabled {
          cursor: not-allowed;
          opacity: 0.52;
          transform: none;
        }

        .ncsPosCompleteButton > span {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-size: 16px;
          font-weight: 950;
        }

        .ncsPosCompleteButton > div {
          min-width: 0;
          flex: 1;
          text-align: left;
        }

        .ncsPosCompleteButton strong,
        .ncsPosCompleteButton small {
          display: block;
        }

        .ncsPosCompleteButton strong {
          font-size: 12px;
          font-weight: 950;
        }

        .ncsPosCompleteButton small {
          margin-top: 3px;
          color: ${GOLD};
          font-size: 10px;
          font-weight: 850;
        }

        .ncsPosCompleteButton > b {
          font-size: 19px;
        }

        .ncsPosNotice {
          position: fixed;
          z-index: 500;
          top: 20px;
          right: 20px;
          max-width: min(380px, calc(100vw - 40px));
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 13px 15px;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 18px 48px
            rgba(3, 21, 63, 0.2);
          animation: ncsPosNoticeIn 0.28s ease;
        }

        .ncsPosNotice > span {
          width: 31px;
          height: 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 950;
        }

        .ncsPosNotice p {
          margin: 0;
          color: ${CHARCOAL};
          font-size: 11px;
          font-weight: 750;
          line-height: 1.45;
        }

        .ncsPosNotice-success {
          border: 1px solid
            rgba(28, 153, 85, 0.25);
        }

        .ncsPosNotice-success > span {
          background: rgba(28, 153, 85, 0.12);
          color: #16864a;
        }

        .ncsPosNotice-error {
          border: 1px solid
            rgba(196, 61, 61, 0.25);
        }

        .ncsPosNotice-error > span {
          background: rgba(196, 61, 61, 0.12);
          color: #b53333;
        }

        .ncsPosNotice-info {
          border: 1px solid
            rgba(10, 46, 115, 0.2);
        }

        .ncsPosNotice-info > span {
          background: rgba(10, 46, 115, 0.1);
          color: ${ROYAL_BLUE};
        }

        .ncsPosErrorCard {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          margin-bottom: 14px;
          padding: 15px;
          border: 1px solid
            rgba(190, 62, 62, 0.2);
          border-radius: 15px;
          background: #fff5f5;
        }

        .ncsPosErrorCard > div {
          width: 37px;
          height: 37px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: #bc3d3d;
          color: #ffffff;
          font-weight: 950;
        }

        .ncsPosErrorCard strong {
          color: #8e2d2d;
          font-size: 12px;
          font-weight: 900;
        }

        .ncsPosErrorCard p {
          margin: 4px 0 8px;
          color: #8f6060;
          font-size: 9px;
          font-weight: 650;
        }

        .ncsPosErrorCard button {
          min-height: 32px;
          padding: 0 12px;
          border: 0;
          border-radius: 8px;
          background: #a93636;
          color: #ffffff;
          font-family: inherit;
          font-size: 9px;
          font-weight: 850;
          cursor: pointer;
        }

        .ncsPosEmptyState {
          min-height: 350px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px dashed
            rgba(10, 46, 115, 0.18);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.62);
          text-align: center;
        }

        .ncsPosEmptyState > div {
          width: 65px;
          height: 65px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 21px;
          background: ${ROYAL_BLUE};
          color: ${GOLD};
          font-size: 30px;
        }

        .ncsPosEmptyState h3 {
          margin: 14px 0 4px;
          color: ${DEEP_BLUE};
          font-size: 16px;
          font-weight: 950;
        }

        .ncsPosEmptyState p {
          margin: 0;
          color: #8e95a0;
          font-size: 10px;
          font-weight: 650;
        }

        .ncsPosSkeletonCard {
          overflow: hidden;
          border-radius: 18px;
          background: #ffffff;
        }

        .ncsPosSkeletonCard div {
          height: 165px;
          background: #eceff4;
        }

        .ncsPosSkeletonCard span {
          height: 10px;
          display: block;
          margin: 13px 14px 0;
          border-radius: 10px;
          background: #eceff4;
        }

        .ncsPosSkeletonCard span:nth-child(3) {
          width: 70%;
        }

        .ncsPosSkeletonCard span:nth-child(4) {
          width: 42%;
          margin-bottom: 15px;
        }

        .ncsPosSkeletonCard div,
        .ncsPosSkeletonCard span {
          background-image: linear-gradient(
            90deg,
            #edf0f4 0%,
            #f8f9fb 50%,
            #edf0f4 100%
          );
          background-size: 200% 100%;
          animation: ncsPosShimmer 1.3s
            infinite;
        }

        .ncsPosModalOverlay {
          position: fixed;
          z-index: 600;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(3, 21, 63, 0.7);
          backdrop-filter: blur(7px);
        }

        .ncsPosHeldModal {
          width: min(620px, 100%);
          max-height: min(720px, 90vh);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid
            rgba(212, 175, 55, 0.45);
          border-radius: 23px;
          background: ${IVORY};
          box-shadow: 0 28px 80px
            rgba(0, 0, 0, 0.3);
          animation: ncsPosModalIn 0.25s ease;
        }

        .ncsPosHeldModal > header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 20px 22px;
          background: linear-gradient(
            135deg,
            ${DEEP_BLUE},
            ${ROYAL_BLUE}
          );
          color: #ffffff;
        }

        .ncsPosHeldModal header span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .ncsPosHeldModal header h2 {
          margin: 4px 0 0;
          font-size: 23px;
          font-weight: 950;
        }

        .ncsPosHeldModal header button {
          width: 41px;
          height: 41px;
          border: 1px solid
            rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.09);
          color: #ffffff;
          font-size: 21px;
          cursor: pointer;
        }

        .ncsPosHeldList {
          padding: 16px;
          overflow-y: auto;
        }

        .ncsPosHeldCard {
          padding: 15px;
          border: 1px solid
            rgba(10, 46, 115, 0.11);
          border-radius: 15px;
          background: #ffffff;
          box-shadow: 0 8px 22px
            rgba(10, 46, 115, 0.06);
        }

        .ncsPosHeldCard + .ncsPosHeldCard {
          margin-top: 10px;
        }

        .ncsPosHeldCardTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .ncsPosHeldCardTop strong,
        .ncsPosHeldCardTop span {
          display: block;
        }

        .ncsPosHeldCardTop strong {
          color: ${DEEP_BLUE};
          font-size: 12px;
          font-weight: 950;
        }

        .ncsPosHeldCardTop span {
          margin-top: 3px;
          color: #9298a4;
          font-size: 8px;
          font-weight: 650;
        }

        .ncsPosHeldCardTop > b {
          color: ${ROYAL_BLUE};
          font-size: 16px;
          font-weight: 950;
        }

        .ncsPosHeldMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 11px;
        }

        .ncsPosHeldMeta span {
          padding: 6px 9px;
          border-radius: 20px;
          background: #eef2f8;
          color: #687280;
          font-size: 8px;
          font-weight: 750;
        }

        .ncsPosHeldActions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 13px;
          padding-top: 11px;
          border-top: 1px dashed #e0e4ea;
        }

        .ncsPosHeldActions button {
          min-height: 35px;
          padding: 0 13px;
          border-radius: 9px;
          font-family: inherit;
          font-size: 9px;
          font-weight: 850;
          cursor: pointer;
        }

        .ncsPosHeldActions button:first-child {
          border: 1px solid #e5bcbc;
          background: #fff4f4;
          color: #a53c3c;
        }

        .ncsPosHeldActions button:last-child {
          border: 1px solid ${GOLD};
          background: ${ROYAL_BLUE};
          color: #ffffff;
        }

        .ncsPosHeldEmpty {
          min-height: 280px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .ncsPosHeldEmpty > div {
          width: 62px;
          height: 62px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 20px;
          background: rgba(212, 175, 55, 0.16);
          font-size: 26px;
        }

        .ncsPosHeldEmpty h3 {
          margin: 13px 0 3px;
          color: ${DEEP_BLUE};
          font-size: 15px;
          font-weight: 950;
        }

        .ncsPosHeldEmpty p {
          margin: 0;
          color: #9298a4;
          font-size: 10px;
          font-weight: 650;
        }

        .ncsPosMobileCartButton,
        .ncsPosMobileOverlay {
          display: none;
        }

        @keyframes ncsPosSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes ncsPosNoticeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes ncsPosModalIn {
          from {
            opacity: 0;
            transform: translateY(12px)
              scale(0.97);
          }

          to {
            opacity: 1;
            transform: translateY(0)
              scale(1);
          }
        }

        @keyframes ncsPosShimmer {
          from {
            background-position: 200% 0;
          }

          to {
            background-position: -200% 0;
          }
        }

        @media (min-width: 1081px) and (max-height: 850px) {
          .ncsPosBillHeader {
            min-height: 66px;
            padding: 12px 16px;
          }

          .ncsPosCustomerCard {
            padding: 10px 14px;
          }

          .ncsPosCustomerTitle {
            margin-bottom: 7px;
          }

          .ncsPosCartItems {
            min-height: 105px;
            max-height: 205px;
            flex: 0 1 205px;
            padding: 9px 12px;
          }

          .ncsPosSummary {
            padding: 10px 14px;
          }

          .ncsPosPaymentSection {
            padding: 10px 14px 12px;
          }

          .ncsPosPaymentButton {
            min-height: 42px;
          }

          .ncsPosCompleteButton {
            min-height: 52px;
            margin-top: 8px;
          }
        }

        @media (max-width: 1280px) {
          .ncsPosWorkspace {
            grid-template-columns:
              minmax(0, 1fr)
              minmax(340px, 370px);
          }

          .ncsPosProductGrid {
            grid-template-columns: repeat(
              auto-fill,
              minmax(175px, 1fr)
            );
          }
        }


        .ncsPosSuccessOverlay {
          position: fixed;
          z-index: 10000;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(3, 21, 63, 0.74);
          backdrop-filter: blur(9px);
        }

        .ncsPosSuccessModal {
          width: min(470px, 100%);
          padding: 27px;
          border: 1px solid rgba(212, 175, 55, 0.45);
          border-radius: 24px;
          background:
            radial-gradient(
              circle at 85% 0%,
              rgba(212, 175, 55, 0.16),
              transparent 30%
            ),
            #ffffff;
          text-align: center;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.32);
          animation: ncsPosSuccessEnter 0.25s ease-out;
        }

        .ncsPosSuccessIcon {
          width: 68px;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 13px;
          border-radius: 50%;
          background: linear-gradient(135deg, #16894b, #27b56a);
          color: #ffffff;
          font-size: 34px;
          font-weight: 950;
          box-shadow: 0 14px 30px rgba(31, 157, 85, 0.25);
        }

        .ncsPosSuccessEyebrow {
          color: ${GOLD};
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 1.5px;
        }

        .ncsPosSuccessModal h2 {
          margin: 6px 0 5px;
          color: ${DEEP_BLUE};
          font-size: 26px;
          font-weight: 950;
        }

        .ncsPosSuccessCustomer {
          margin: 0;
          color: #737b89;
          font-size: 11px;
          font-weight: 650;
        }

        .ncsPosSuccessAmount {
          margin: 18px 0 13px;
          padding: 18px;
          border-radius: 17px;
          background: linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: #ffffff;
        }

        .ncsPosSuccessAmount small,
        .ncsPosSuccessAmount strong,
        .ncsPosSuccessAmount span {
          display: block;
        }

        .ncsPosSuccessAmount small {
          color: rgba(255, 255, 255, 0.65);
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .ncsPosSuccessAmount strong {
          margin-top: 4px;
          color: ${GOLD};
          font-size: 30px;
          font-weight: 950;
        }

        .ncsPosSuccessAmount span {
          margin-top: 5px;
          color: #ffd3d3;
          font-size: 11px;
          font-weight: 850;
        }

        .ncsPosSuccessSummary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 15px;
        }

        .ncsPosSuccessSummary p {
          margin: 0;
          padding: 11px;
          border-radius: 12px;
          background: #f5f7fb;
          text-align: left;
        }

        .ncsPosSuccessSummary span,
        .ncsPosSuccessSummary strong {
          display: block;
        }

        .ncsPosSuccessSummary span {
          color: #89909d;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .ncsPosSuccessSummary strong {
          margin-top: 3px;
          color: ${DEEP_BLUE};
          font-size: 12px;
          font-weight: 900;
        }

        .ncsPosSuccessActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
        }

        .ncsPosSuccessActions button {
          min-height: 46px;
          border: 0;
          border-radius: 12px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsPosSuccessWhatsApp {
          grid-column: 1 / -1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #1f9d55;
          color: #ffffff;
        }

        .ncsPosSuccessWhatsApp span {
          font-size: 17px;
        }

        .ncsPosSuccessPrint {
          background: ${ROYAL_BLUE};
          color: #ffffff;
        }

        .ncsPosSuccessNewBill {
          border: 1px solid rgba(10, 46, 115, 0.15) !important;
          background: #eef2f8;
          color: ${ROYAL_BLUE};
        }

        .ncsPosSuccessHint {
          display: block;
          margin-top: 12px;
          color: #9298a4;
          font-size: 8px;
          line-height: 1.55;
        }

        @keyframes ncsPosSuccessEnter {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 1080px) {
          .ncsPosPage {
            padding: 20px;
          }

          .ncsPosWorkspace {
            grid-template-columns: 1fr;
          }

          .ncsPosBillPanel {
            position: fixed;
            z-index: 430;
            top: 0;
            right: 0;
            bottom: 0;
            width: min(430px, 94vw);
            max-height: none;
            border-radius: 22px 0 0 22px;
            transform: translateX(105%);
            transition: transform 0.25s ease;
          }

          .ncsPosBillPanelOpen {
            transform: translateX(0);
          }

          .ncsPosCloseMobileCart {
            display: block !important;
          }

          .ncsPosMobileCartButton {
            position: fixed;
            z-index: 300;
            right: 18px;
            bottom: 18px;
            left: calc(270px + 18px);
            min-height: 65px;
            display: flex;
            align-items: center;
            gap: 13px;
            padding: 8px 15px;
            border: 1px solid ${GOLD};
            border-radius: 17px;
            background: linear-gradient(
              135deg,
              ${DEEP_BLUE},
              ${ROYAL_BLUE}
            );
            color: #ffffff;
            font-family: inherit;
            cursor: pointer;
            box-shadow: 0 18px 44px
              rgba(3, 21, 63, 0.32);
          }

          .ncsPosMobileCartButton > span {
            position: relative;
            width: 41px;
            height: 41px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            background: ${GOLD};
            font-size: 19px;
          }

          .ncsPosMobileCartButton > span b {
            position: absolute;
            top: -6px;
            right: -6px;
            min-width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid ${ROYAL_BLUE};
            border-radius: 20px;
            background: #ffffff;
            color: ${ROYAL_BLUE};
            font-size: 8px;
          }

          .ncsPosMobileCartButton > div {
            min-width: 0;
            flex: 1;
            text-align: left;
          }

          .ncsPosMobileCartButton small,
          .ncsPosMobileCartButton strong {
            display: block;
          }

          .ncsPosMobileCartButton small {
            color: rgba(255, 255, 255, 0.65);
            font-size: 8px;
            font-weight: 700;
          }

          .ncsPosMobileCartButton strong {
            margin-top: 2px;
            color: ${GOLD};
            font-size: 15px;
            font-weight: 950;
          }

          .ncsPosMobileCartButton i {
            font-size: 10px;
            font-style: normal;
            font-weight: 850;
          }

          .ncsPosMobileOverlay {
            position: fixed;
            z-index: 420;
            inset: 0;
            display: block;
            border: 0;
            background: rgba(3, 21, 63, 0.65);
          }
        }

        @media (max-width: 900px) {
          .ncsPosMobileCartButton {
            left: 18px;
          }

          .ncsPosPage {
            padding: 16px;
            padding-bottom: 100px;
          }

          .ncsPosHeader {
            align-items: flex-start;
            padding: 20px;
          }
        }

        @media (max-width: 700px) {
          .ncsPosHeader {
            display: block;
          }

          .ncsPosHeaderActions {
            margin-top: 15px;
          }

          .ncsPosSecondaryButton,
          .ncsPosRefreshButton {
            flex: 1;
          }

          .ncsPosSearchPanel {
            min-height: 56px;
          }

          .ncsPosSearchIcon {
            width: 39px;
          }

          .ncsPosSearchPanel input {
            height: 42px;
            font-size: 12px;
          }

          .ncsPosSearchButton {
            min-width: 72px;
            height: 42px;
          }

          .ncsPosProductGrid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
            gap: 10px;
          }

          .ncsPosProductImage {
            height: 145px;
          }

          .ncsPosProductInfo {
            padding: 11px;
          }

          .ncsPosProductInfo h3 {
            font-size: 11px;
          }

          .ncsPosCatalogueTop {
            align-items: flex-end;
          }

          .ncsPosStatusBadge {
            font-size: 8px;
          }
        }

        @media (max-width: 440px) {
          .ncsPosPage {
            padding: 12px;
            padding-bottom: 94px;
          }

          .ncsPosHeader {
            border-radius: 17px;
          }

          .ncsPosHeaderActions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .ncsPosSearchButton {
            display: none;
          }

          .ncsPosProductImage {
            height: 128px;
          }

          .ncsPosStockBadge {
            top: 7px;
            right: 7px;
            padding: 5px 7px;
            font-size: 7px;
          }

          .ncsPosProductBottom strong {
            font-size: 13px;
          }

          .ncsPosAddIcon {
            width: 30px;
            height: 30px;
          }

          .ncsPosCustomerFields {
            grid-template-columns: 1fr;
          }

          .ncsPosPaymentGrid {
            gap: 5px;
          }
        }
        @media (max-width: 520px) {
          .ncsPosCreditFields,
          .ncsPosCreditSummary {
            grid-template-columns: 1fr;
          }
        }

      `}</style>
    </main>
  );
}