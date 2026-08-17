"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Sale = {
  id: string;
  invoice_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  sale_status?: string | null;
  subtotal?: number | string | null;
  bill_discount?: number | string | null;
  tax_amount?: number | string | null;
  round_off?: number | string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  created_at?: string | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  refunded_amount?: number | string | null;
};

type SaleItem = {
  id: number;
  sale_id: string;
  product_id?: number | null;
  variant_id?: number | null;
  product_name?: string | null;
  barcode?: string | null;
  size?: string | null;
  color?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  line_total?: number | string | null;
  returned_quantity?: number | string | null;
};

type ExchangeInventoryItem = {
  key: string;
  productId: number;
  variantId: number | null;
  name: string;
  barcode: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
  price: number;
  mrp: number;
};

type ExchangeSelectedItem = ExchangeInventoryItem & {
  quantity: number;
  exchangePrice: number;
};

type ExchangeSettlementMethod =
  | "cash"
  | "upi"
  | "card"
  | "bank_transfer"
  | "store_credit"
  | "credit"
  | "none";

type ReturnType = "refund" | "exchange" | "store_credit";
type RefundMethod =
  | "cash"
  | "upi"
  | "card"
  | "bank_transfer"
  | "store_credit"
  | "none";

type ReturnSelection = {
  saleItemId: number;
  quantity: number;
  restock: boolean;
};

type SaleDetails = Sale & { items: SaleItem[] };

type ExchangeSettlementSummary = {
  id: string;
  difference_amount?: number | string | null;
  settlement_direction?: string | null;
  settlement_method?: string | null;
  settlement_status?: string | null;
  created_at?: string | null;
};


const BLUE = "#0A2E73";
const DEEP = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";

const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const money = (v: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num(v));

const norm = (v?: string | null) => v?.trim().toLowerCase() || "";

const label = (v?: string | null) => {
  const text = norm(v).replaceAll("_", " ");
  return text ? text.replace(/\b\w/g, (m) => m.toUpperCase()) : "Unknown";
};

const formatDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const today = (v?: string | null) => {
  if (!v) return false;
  const d = new Date(v);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
};

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [exchangeSettlements, setExchangeSettlements] = useState<
    ExchangeSettlementSummary[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState("all");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [selected, setSelected] = useState<SaleDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [paymentEditOpen, setPaymentEditOpen] = useState(false);
  const [paymentEditValue, setPaymentEditValue] = useState("cash");
  const [paymentEditCustomerName, setPaymentEditCustomerName] = useState("");
  const [paymentEditPaidAmount, setPaymentEditPaidAmount] = useState("");
  const [paymentBalanceTreatment, setPaymentBalanceTreatment] =
    useState<"due" | "waive">("due");
  const [paymentEditSaving, setPaymentEditSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [whatsAppSendingSaleId, setWhatsAppSendingSaleId] =
    useState<string | null>(null);
  const [duplicateAction, setDuplicateAction] =
    useState<"download" | "print" | "whatsapp" | null>(null);

  const SALES_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnType, setReturnType] = useState<ReturnType>("refund");
  const [refundMethod, setRefundMethod] =
    useState<RefundMethod>("cash");
  const [returnReason, setReturnReason] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnSelections, setReturnSelections] = useState<
    ReturnSelection[]
  >([]);
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  const [exchangeInventory, setExchangeInventory] = useState<
    ExchangeInventoryItem[]
  >([]);
  const [exchangeInventoryLoading, setExchangeInventoryLoading] =
    useState(false);
  const [exchangeSearch, setExchangeSearch] = useState("");
  const [exchangeItems, setExchangeItems] = useState<
    ExchangeSelectedItem[]
  >([]);
  const [exchangeSettlementMethod, setExchangeSettlementMethod] =
    useState<ExchangeSettlementMethod>("cash");

  const loadExchangeInventory = useCallback(async () => {
    setExchangeInventoryLoading(true);

    try {
      const [{ data: productData, error: productError }, { data: variantData }] =
        await Promise.all([
          supabase
            .from("products")
            .select(
              "id,name,price,mrp,stock,sku,barcode,is_active,status"
            )
            .order("created_at", { ascending: false }),
          supabase
            .from("product_variants")
            .select(
              "id,product_id,size,color,sku,barcode,selling_price,mrp,stock,is_active"
            )
            .eq("is_active", true),
        ]);

      if (productError) throw productError;

      const products = (productData || []) as Array<Record<string, unknown>>;
      const variants = (variantData || []) as Array<Record<string, unknown>>;
      const variantsByProduct = new Map<number, Array<Record<string, unknown>>>();

      variants.forEach((variant) => {
        const productId = num(variant.product_id);
        const current = variantsByProduct.get(productId) || [];
        current.push(variant);
        variantsByProduct.set(productId, current);
      });

      const mapped: ExchangeInventoryItem[] = [];

      products.forEach((product) => {
        if (
          product.is_active === false ||
          norm(String(product.status || "")) === "inactive"
        ) {
          return;
        }

        const productId = num(product.id);
        const name =
          String(product.name || "Product").trim() || "Product";
        const productPrice = num(product.price);
        const productMrp = num(product.mrp) || productPrice;
        const productVariants = variantsByProduct.get(productId) || [];

        if (productVariants.length > 0) {
          productVariants.forEach((variant) => {
            const stock = Math.max(0, num(variant.stock));
            const price =
              num(variant.selling_price) || productPrice || productMrp;

            mapped.push({
              key: `variant-${variant.id}`,
              productId,
              variantId: num(variant.id),
              name,
              barcode: String(
                variant.barcode || product.barcode || ""
              ).trim(),
              sku: String(variant.sku || product.sku || "").trim(),
              size: String(variant.size || "").trim(),
              color: String(variant.color || "").trim(),
              stock,
              price,
              mrp: num(variant.mrp) || productMrp || price,
            });
          });
          return;
        }

        mapped.push({
          key: `product-${productId}`,
          productId,
          variantId: null,
          name,
          barcode: String(product.barcode || "").trim(),
          sku: String(product.sku || "").trim(),
          size: "",
          color: "",
          stock: Math.max(0, num(product.stock)),
          price: productPrice || productMrp,
          mrp: productMrp || productPrice,
        });
      });

      setExchangeInventory(mapped);
    } catch (error) {
      console.error("Unable to load exchange inventory:", error);
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load replacement products."
      );
    } finally {
      setExchangeInventoryLoading(false);
    }
  }, []);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setErrorText("");

    const [salesResult, exchangeResult, refundsResult] = await Promise.all([
      supabase
        .from("pos_sales")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("pos_exchange_settlements")
        .select(
          "id,difference_amount,settlement_direction,settlement_method,settlement_status,created_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("pos_refunds")
        .select("sale_id,amount,refund_status")
        .eq("refund_status", "completed"),
    ]);

    if (salesResult.error) {
      console.error(salesResult.error);
      setErrorText(
        salesResult.error.message || "Unable to load sales."
      );
      setSales([]);
    } else {
      const refundBySale = new Map<string, number>();

      if (!refundsResult.error) {
        (
          (refundsResult.data || []) as Array<{
            sale_id?: string | null;
            amount?: number | string | null;
            refund_status?: string | null;
          }>
        ).forEach((refund) => {
          const saleId = String(refund.sale_id || "").trim();
          if (!saleId) return;

          refundBySale.set(
            saleId,
            (refundBySale.get(saleId) || 0) +
              Math.max(0, num(refund.amount)),
          );
        });
      } else {
        console.info(
          "Unable to load completed refunds:",
          refundsResult.error.message
        );
      }

      setSales(
        ((salesResult.data || []) as unknown as Sale[]).map((sale) => ({
          ...sale,
          refunded_amount: refundBySale.get(sale.id) || 0,
        }))
      );
    }

    if (exchangeResult.error) {
      console.info(
        "Unable to load exchange settlements:",
        exchangeResult.error
      );
      setExchangeSettlements([]);
    } else {
      setExchangeSettlements(
        (exchangeResult.data || []) as unknown as
          ExchangeSettlementSummary[]
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadSales();
    loadExchangeInventory();
  }, [loadSales, loadExchangeInventory]);

  const filtered = useMemo(() => {
    const q = norm(search);
    const now = new Date();

    return sales.filter((sale) => {
      if (q) {
        const text = [
          sale.invoice_number,
          sale.customer_name,
          sale.customer_phone,
          sale.payment_method,
          sale.sale_status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!text.includes(q)) return false;
      }

      if (payment !== "all" && norm(sale.payment_method) !== payment) {
        return false;
      }

      if (status !== "all" && norm(sale.sale_status) !== status) {
        return false;
      }

      if (period !== "all") {
        const d = sale.created_at ? new Date(sale.created_at) : null;
        if (!d || Number.isNaN(d.getTime())) return false;

        if (period === "today" && !today(sale.created_at)) return false;

        if (period === "7") {
          const from = new Date(now);
          from.setDate(from.getDate() - 7);
          if (d < from) return false;
        }

        if (period === "30") {
          const from = new Date(now);
          from.setDate(from.getDate() - 30);
          if (d < from) return false;
        }
      }

      return true;
    });
  }, [sales, search, payment, status, period]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / SALES_PER_PAGE)
  );

  const pagedSales = useMemo(() => {
    const start = (currentPage - 1) * SALES_PER_PAGE;
    return filtered.slice(start, start + SALES_PER_PAGE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, payment, status, period]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const stats = useMemo(() => {
    const base = filtered.reduce(
      (a, sale) => {
        if (norm(sale.sale_status) !== "cancelled") {
          const refunded = Math.max(0, num(sale.refunded_amount));
          a.value += Math.max(0, num(sale.total_amount) - refunded);
          a.paid += Math.max(0, num(sale.paid_amount) - refunded);
          a.due += num(sale.due_amount);
        }

        if (today(sale.created_at)) {
          a.today += 1;
        }

        return a;
      },
      {
        bills: filtered.length,
        value: 0,
        paid: 0,
        due: 0,
        today: 0,
      }
    );

    const now = new Date();

    const exchangeRowsForPeriod =
      exchangeSettlements.filter((row) => {
        if (
          norm(row.settlement_status) === "cancelled"
        ) {
          return false;
        }

        const created = row.created_at
          ? new Date(row.created_at)
          : null;

        if (
          !created ||
          Number.isNaN(created.getTime())
        ) {
          return false;
        }

        if (period === "today") {
          return today(row.created_at);
        }

        if (period === "7") {
          const from = new Date(now);
          from.setDate(from.getDate() - 7);
          return created >= from;
        }

        if (period === "30") {
          const from = new Date(now);
          from.setDate(from.getDate() - 30);
          return created >= from;
        }

        return true;
      });

    const exchangeNet = exchangeRowsForPeriod.reduce(
      (sum, row) => {
        const difference = Math.max(
          0,
          num(row.difference_amount)
        );

        if (
          norm(row.settlement_direction) === "collect"
        ) {
          return sum + difference;
        }

        if (
          norm(row.settlement_direction) === "refund"
        ) {
          return sum - difference;
        }

        return sum;
      },
      0
    );

    const todayExchangeCount =
      exchangeSettlements.filter(
        (row) =>
          norm(row.settlement_status) !==
            "cancelled" &&
          today(row.created_at)
      ).length;

    base.value += exchangeNet;
    base.paid += exchangeNet;
    base.today += todayExchangeCount;

    return {
      ...base,
      bills:
        base.bills +
        exchangeRowsForPeriod.length,
    };
  }, [
    exchangeSettlements,
    filtered,
    period,
  ]);

  async function showDetails(sale: Sale) {
    setDetailsLoading(true);

    const { data, error } = await supabase
      .from("pos_sale_items")
      .select("*")
      .eq("sale_id", sale.id)
      .order("id", { ascending: true });

    if (error) {
      console.error(error);
      setNotice(error.message || "Unable to load invoice items.");
    } else {
      setSelected({
        ...sale,
        items: (data || []) as unknown as SaleItem[],
      });
    }

    setDetailsLoading(false);
  }

  function availableReturnQuantity(item: SaleItem) {
    return Math.max(
      0,
      num(item.quantity) - num(item.returned_quantity)
    );
  }

  function getSelectedReturnQuantity(saleItemId: number) {
    return (
      returnSelections.find(
        (selection) => selection.saleItemId === saleItemId
      )?.quantity || 0
    );
  }

  function updateReturnSelection(
    item: SaleItem,
    quantity: number
  ) {
    const maxQuantity = availableReturnQuantity(item);
    const safeQuantity = Math.min(
      maxQuantity,
      Math.max(0, Math.floor(quantity))
    );

    setReturnSelections((current) => {
      const existing = current.find(
        (selection) => selection.saleItemId === item.id
      );

      if (safeQuantity <= 0) {
        return current.filter(
          (selection) => selection.saleItemId !== item.id
        );
      }

      if (existing) {
        return current.map((selection) =>
          selection.saleItemId === item.id
            ? { ...selection, quantity: safeQuantity }
            : selection
        );
      }

      return [
        ...current,
        {
          saleItemId: item.id,
          quantity: safeQuantity,
          restock: true,
        },
      ];
    });
  }

  function toggleReturnRestock(saleItemId: number) {
    setReturnSelections((current) =>
      current.map((selection) =>
        selection.saleItemId === saleItemId
          ? { ...selection, restock: !selection.restock }
          : selection
      )
    );
  }

  function openReturnModal() {
    if (!selected) return;

    const firstAvailableItem = selected.items.find(
      (item) => availableReturnQuantity(item) > 0
    );

    setReturnType("refund");
    setRefundMethod("cash");
    setReturnReason("");
    setReturnNotes("");
    setReturnSelections(
      firstAvailableItem
        ? [
            {
              saleItemId: firstAvailableItem.id,
              quantity: 1,
              restock: true,
            },
          ]
        : []
    );
    setExchangeSearch("");
    setExchangeItems([]);
    setExchangeSettlementMethod("cash");
    setReturnModalOpen(true);
  }

  const selectedReturnTotal = selected
    ? (() => {
        const subtotal = num(selected.subtotal);
        const totalAmount = num(selected.total_amount);
        const payableRatio =
          subtotal > 0
            ? Math.max(0, totalAmount / subtotal)
            : 1;

        return selected.items.reduce((total, item) => {
          const selectedQty =
            getSelectedReturnQuantity(item.id);
          const soldQty = Math.max(1, num(item.quantity));
          const grossLineTotal =
            num(item.line_total) ||
            num(item.unit_price) * soldQty;
          const grossPerUnit =
            grossLineTotal / soldQty;
          const actualRefundPerUnit =
            grossPerUnit * payableRatio;

          return (
            total +
            selectedQty * actualRefundPerUnit
          );
        }, 0);
      })()
    : 0;

  const filteredExchangeInventory = useMemo(() => {
    const query = norm(exchangeSearch);
    const availableItems = exchangeInventory.filter(
      (item) => item.stock > 0
    );

    // Exchange must be able to reach every available product/variant.
    // Do not silently limit the grid to the first 20 items.
    if (!query) return availableItems;

    return availableItems.filter((item) =>
      [
        item.name,
        item.barcode,
        item.sku,
        item.size,
        item.color,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [exchangeInventory, exchangeSearch]);

  const exchangeTotal = useMemo(
    () =>
      exchangeItems.reduce(
        (total, item) =>
          total + item.exchangePrice * item.quantity,
        0
      ),
    [exchangeItems]
  );

  const exchangeDifference = exchangeTotal - selectedReturnTotal;
  const exchangeDirection =
    exchangeDifference > 0
      ? "collect"
      : exchangeDifference < 0
        ? "refund"
        : "even";

  function addExchangeItem(item: ExchangeInventoryItem) {
    setExchangeItems((current) => {
      const existing = current.find((row) => row.key === item.key);

      if (existing) {
        return current.map((row) =>
          row.key === item.key
            ? {
                ...row,
                quantity: Math.min(row.stock, row.quantity + 1),
              }
            : row
        );
      }

      return [
        ...current,
        {
          ...item,
          quantity: 1,
          exchangePrice: item.mrp > 0 ? item.mrp : item.price,
        },
      ];
    });
    setExchangeSearch("");
  }

  function handleExchangeSearchEnter() {
    const query = norm(exchangeSearch);
    if (!query) return;

    // Barcode scanners normally finish with Enter. Prefer an exact
    // barcode/SKU match so a scan adds the correct size/colour instantly.
    const exactItem = exchangeInventory.find((item) => {
      if (item.stock <= 0) return false;
      return (
        norm(item.barcode) === query ||
        norm(item.sku) === query
      );
    });

    if (exactItem) {
      addExchangeItem(exactItem);
      return;
    }

    // If text search leaves exactly one result, Enter adds it too.
    if (filteredExchangeInventory.length === 1) {
      addExchangeItem(filteredExchangeInventory[0]);
      return;
    }

    setNotice(
      filteredExchangeInventory.length > 1
        ? `Found ${filteredExchangeInventory.length} matching products. Select the correct size / colour.`
        : "No in-stock replacement product matched this barcode or search."
    );
  }

  function updateExchangeItem(
    key: string,
    field: "quantity" | "exchangePrice",
    value: number
  ) {
    setExchangeItems((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              [field]:
                field === "quantity"
                  ? Math.max(
                      1,
                      Math.min(item.stock, Math.floor(value))
                    )
                  : Math.max(0, value),
            }
          : item
      )
    );
  }

  function removeExchangeItem(key: string) {
    setExchangeItems((current) =>
      current.filter((item) => item.key !== key)
    );
  }

  function updateExchangeDiscount(
    key: string,
    rawDiscountPercent: number
  ) {
    const safeDiscount = Math.min(
      100,
      Math.max(0, num(rawDiscountPercent))
    );

    setExchangeItems((current) =>
      current.map((item) => {
        if (item.key !== key) return item;

        const baseMrp =
          item.mrp > 0
            ? item.mrp
            : item.price > 0
              ? item.price
              : item.exchangePrice;

        const finalPrice =
          baseMrp > 0
            ? baseMrp - (baseMrp * safeDiscount) / 100
            : item.exchangePrice;

        return {
          ...item,
          exchangePrice: Math.max(
            0,
            Number(finalPrice.toFixed(2))
          ),
        };
      })
    );
  }

  async function sendExchangeWhatsAppConfirmation(
    sale: SaleDetails,
    result: {
      return_number?: string;
      returned_value?: number;
      exchange_value?: number;
      difference_amount?: number;
      settlement_direction?: string;
      settlement_method?: string;
    }
  ) {
    const digits = (sale.customer_phone || "").replace(
      /\D/g,
      ""
    );
    const recipientPhone =
      digits.length === 10 ? `91${digits}` : digits;

    if (
      recipientPhone.length < 10 ||
      recipientPhone.length > 15
    ) {
      return {
        sent: false,
        reason: "no_valid_mobile",
      };
    }

    const direction =
      norm(result.settlement_direction);
    const difference = Math.max(
      0,
      num(result.difference_amount)
    );

    try {
      const response = await fetch(
        "/api/whatsapp/invoice",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: recipientPhone,
            sendWhatsApp: true,
            customerName:
              sale.customer_name ||
              "Walk-in Customer",
            customerPhone:
              sale.customer_phone || "",
            billNumber:
              result.return_number ||
              `EXCHANGE-${sale.invoice_number || sale.id}`,
            billDate: new Date().toISOString(),
            paymentMethod:
              direction === "even"
                ? "NO EXTRA PAYMENT"
                : label(
                    result.settlement_method ||
                      exchangeSettlementMethod
                  ),
            subtotal: num(
              result.exchange_value ||
                exchangeTotal
            ),
            discountAmount: 0,
            taxAmount: 0,
            roundOff: 0,
            billAmount: num(
              result.exchange_value ||
                exchangeTotal
            ),
            paidAmount:
              direction === "collect"
                ? difference
                : 0,
            dueAmount: 0,
            whatsappLanguage: "telugu",
            items: exchangeItems.map(
              (item) => ({
                name: item.name,
                quantity: item.quantity,
                mrp: item.mrp,
                price: item.exchangePrice,
                total:
                  item.exchangePrice *
                  item.quantity,
                size: item.size || "",
                color: item.color || "",
                barcode: item.barcode || "",
              })
            ),
          }),
        }
      );

      const payload = (await response.json()) as {
        success?: boolean;
        whatsappPdfSent?: boolean;
        whatsappTextSent?: boolean;
        error?: string;
      };

      return {
        sent:
          response.ok &&
          payload.success === true &&
          (payload.whatsappPdfSent === true ||
            payload.whatsappTextSent === true),
        reason:
          payload.error ||
          (response.ok
            ? ""
            : "whatsapp_send_failed"),
      };
    } catch (error) {
      console.info(
        "Exchange completed, but WhatsApp confirmation failed:",
        error
      );

      return {
        sent: false,
        reason:
          error instanceof Error
            ? error.message
            : "whatsapp_send_failed",
      };
    }
  }

  async function submitReturn() {
    if (!selected) return;

    if (returnSelections.length === 0) {
      setNotice("Select at least one item and return quantity.");
      return;
    }

    if (!returnReason.trim()) {
      setNotice("Please enter a return reason.");
      return;
    }

    if (returnType === "exchange" && exchangeItems.length === 0) {
      setNotice("Select at least one replacement product.");
      return;
    }

    setReturnSubmitting(true);

    try {
      const rpcItems = returnSelections.map((selection) => ({
        sale_item_id: selection.saleItemId,
        quantity: selection.quantity,
        restock: selection.restock,
      }));

      const rpcResult =
        returnType === "exchange"
          ? await supabase.rpc("process_pos_exchange", {
              p_sale_id: selected.id,
              p_return_items: rpcItems,
              p_exchange_items: exchangeItems.map((item) => ({
                product_id: item.productId,
                variant_id: item.variantId,
                quantity: item.quantity,
                unit_price: item.exchangePrice,
              })),
              p_settlement_method:
                exchangeDirection === "even"
                  ? "none"
                  : exchangeSettlementMethod,
              p_reason: returnReason.trim(),
              p_notes: returnNotes.trim() || null,
            })
          : await supabase.rpc("process_pos_return", {
              p_sale_id: selected.id,
              p_items: rpcItems,
              p_return_type: returnType,
              p_refund_method: refundMethod,
              p_reason: returnReason.trim(),
              p_notes: returnNotes.trim() || null,
            });

      const { data, error } = rpcResult;

      if (error) throw error;

      const result = (data || {}) as {
        success?: boolean;
        return_number?: string;
        total_return_amount?: number;
        returned_value?: number;
        exchange_value?: number;
        difference_amount?: number;
        settlement_direction?: string;
        settlement_method?: string;
        message?: string;
      };

      if (result.success === false) {
        throw new Error(
          result.message || "Unable to process return."
        );
      }

      let whatsappStatus = "";

      if (returnType === "exchange") {
        const whatsappResult =
          await sendExchangeWhatsAppConfirmation(
            selected,
            result
          );

        whatsappStatus = whatsappResult.sent
          ? " WhatsApp sent ✓"
          : (selected.customer_phone || "").replace(
                /\D/g,
                ""
              ).length >= 10
            ? " Exchange saved; WhatsApp not sent."
            : " Exchange saved; no valid mobile for WhatsApp.";
      }

      setNotice(
        returnType === "exchange"
          ? `${result.return_number || "Exchange"} completed. Returned ${money(
              result.returned_value || selectedReturnTotal
            )}, replacement ${money(
              result.exchange_value || exchangeTotal
            )}, ${
              result.settlement_direction === "collect"
                ? "collect"
                : result.settlement_direction === "refund"
                  ? "refund"
                  : "difference"
            } ${money(result.difference_amount || 0)}.${whatsappStatus}`
          : `${result.return_number || "Return"} completed for ${money(
              result.total_return_amount || selectedReturnTotal
            )}.`
      );

      setReturnModalOpen(false);

      const { data: refreshedItems, error: itemsError } =
        await supabase
          .from("pos_sale_items")
          .select("*")
          .eq("sale_id", selected.id)
          .order("id", { ascending: true });

      if (!itemsError) {
        setSelected({
          ...selected,
          sale_status:
            returnSelections.every((selection) => {
              const item = selected.items.find(
                (row) => row.id === selection.saleItemId
              );
              return (
                item &&
                selection.quantity >=
                  availableReturnQuantity(item)
              );
            })
              ? returnType === "exchange"
                ? "exchanged"
                : "returned"
              : returnType === "exchange"
                ? "partially_exchanged"
                : "partially_returned",
          items:
            (refreshedItems || []) as unknown as SaleItem[],
        });
      }

      await loadSales();
    } catch (error: unknown) {
      const supabaseError =
        typeof error === "object" && error !== null
          ? (error as {
              message?: string;
              details?: string;
              hint?: string;
              code?: string;
            })
          : null;

      const errorMessage =
        [
          supabaseError?.message,
          supabaseError?.details,
          supabaseError?.hint,
          supabaseError?.code
            ? `Error code: ${supabaseError.code}`
            : "",
        ]
          .filter(Boolean)
          .join(" • ") ||
        (error instanceof Error
          ? error.message
          : "Unable to process return.");

      console.warn("Unable to process POS return:", {
        message: supabaseError?.message,
        details: supabaseError?.details,
        hint: supabaseError?.hint,
        code: supabaseError?.code,
      });

      setNotice(errorMessage);
    } finally {
      setReturnSubmitting(false);
    }
  }

  function openPaymentEditor() {
    if (!selected) return;

    const currentMethod = norm(selected.payment_method);
    const safeMethod = [
      "cash",
      "upi",
      "card",
      "bank_transfer",
    ].includes(currentMethod)
      ? currentMethod
      : "cash";

    setPaymentEditValue(safeMethod);
    setPaymentEditCustomerName(
      selected.customer_name?.trim() || "Walk-in Customer",
    );
    setPaymentEditPaidAmount(
      num(selected.paid_amount).toFixed(2),
    );
    setPaymentBalanceTreatment(
      num(selected.due_amount) > 0 ? "due" : "waive",
    );
    setPaymentEditOpen(true);
  }

  async function savePaymentMethod() {
    if (!selected) return;

    const customerName = paymentEditCustomerName.trim();

    if (!customerName) {
      setNotice("Enter a valid customer name.");
      return;
    }

    const billTotal = Math.max(0, num(selected.total_amount));
    const previousPaid = Math.max(0, num(selected.paid_amount));
    const enteredPaid = Number(paymentEditPaidAmount);

    if (!Number.isFinite(enteredPaid) || enteredPaid < 0) {
      setNotice("Enter a valid paid amount.");
      return;
    }

    const paidAmount = Math.round(enteredPaid * 100) / 100;

    if (paidAmount > billTotal) {
      setNotice(
        `Paid amount cannot exceed bill total ${money(billTotal)}.`,
      );
      return;
    }

    const remainingAmount =
      Math.round((billTotal - paidAmount) * 100) / 100;

    const currentMethod = norm(selected.payment_method);
    const methodChanged = paymentEditValue !== currentMethod;
    const paidChanged =
      Math.abs(paidAmount - previousPaid) > 0.009;
    const nameChanged =
      customerName !==
      (selected.customer_name?.trim() || "Walk-in Customer");

    if (!methodChanged && !paidChanged && !nameChanged) {
      setNotice(
        "Change customer name, payment method or paid amount before saving.",
      );
      return;
    }

    const dueAmount =
      remainingAmount > 0 && paymentBalanceTreatment === "due"
        ? remainingAmount
        : 0;

    /*
     * When the balance is waived, convert only that remaining amount
     * into an additional bill discount. Items, stock, tax and subtotal
     * stay unchanged. This prevents the amount from appearing in
     * Customer Dues.
     */
    const previousBillDiscount = Math.max(
      0,
      num(selected.bill_discount),
    );

    const waivedAmount =
      remainingAmount > 0 && paymentBalanceTreatment === "waive"
        ? remainingAmount
        : 0;

    const nextBillDiscount =
      Math.round(
        (previousBillDiscount + waivedAmount) * 100,
      ) / 100;

    const nextTotalAmount =
      paymentBalanceTreatment === "waive"
        ? paidAmount
        : billTotal;

    const nextPaymentStatus =
      dueAmount > 0 ? "partial" : "paid";

    const treatmentText =
      remainingAmount <= 0
        ? "fully paid"
        : paymentBalanceTreatment === "due"
          ? `${money(remainingAmount)} customer due`
          : `${money(remainingAmount)} waived off`;

    const confirmed = window.confirm(
      `Update ${selected.invoice_number || "this sale"}?

` +
        `Customer: ${
          selected.customer_name || "Walk-in Customer"
        } → ${customerName}
` +
        `Payment: ${label(selected.payment_method)} → ${label(
          paymentEditValue,
        )}
` +
        `Paid: ${money(previousPaid)} → ${money(paidAmount)}
` +
        `Balance: ${treatmentText}

` +
        `After saving, the updated invoice PDF will be sent directly on WhatsApp.`,
    );

    if (!confirmed) return;

    setPaymentEditSaving(true);

    try {
      const { data: updatedSaleData, error } = await supabase.rpc(
        "update_pos_sale_payment_correction",
        {
          p_sale_id: selected.id,
          p_customer_name: customerName,
          p_payment_method: paymentEditValue,
          p_paid_amount: paidAmount,
          p_balance_treatment: paymentBalanceTreatment,
        },
      );

      if (error) throw error;

      const updatedRow = Array.isArray(updatedSaleData)
        ? updatedSaleData[0]
        : updatedSaleData;

      if (!updatedRow) {
        throw new Error(
          "Payment update completed but the database did not return the updated bill.",
        );
      }

      const updatedSelected: SaleDetails = {
        ...selected,
        ...(updatedRow as Sale),
        items: selected.items,
      };

      setSelected(updatedSelected);
      setSales((current) =>
        current.map((sale) =>
          sale.id === selected.id
            ? {
                ...sale,
                ...(updatedRow as Sale),
              }
            : sale,
        ),
      );

      setPaymentEditOpen(false);
      setNotice(
        `${selected.invoice_number || "Sale"} updated. Sending revised WhatsApp invoice...`,
      );

      /*
       * Send only after Supabase update succeeds, so the PDF carries
       * the corrected method, paid amount, due and waived discount.
       */
      await sendSaleWhatsAppPdf(updatedSelected);
      await loadSales();
    } catch (error) {
      console.error(
        "Unable to update payment correction:",
        error,
      );
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update payment details.",
      );
    } finally {
      setPaymentEditSaving(false);
    }
  }

  async function deleteSelectedSale() {
    if (!selected) return;

    const invoiceNumber =
      selected.invoice_number || "this bill";

    const confirmed = window.confirm(
      `Delete ${invoiceNumber}? This will restore stock, reverse the customer due where applicable, and remove the bill from both web and Android after sync.`
    );

    if (!confirmed) return;

    const secondConfirmed = window.confirm(
      `Final confirmation: permanently hide ${invoiceNumber} from active sales history?`
    );

    if (!secondConfirmed) return;

    setDeleteSaving(true);

    try {
      const { data, error } = await supabase.rpc(
        "soft_delete_pos_sale",
        {
          p_sale_id: selected.id,
          p_deleted_by: "WEB_ADMIN",
        }
      );

      if (error) throw error;

      const result = (data || {}) as {
        success?: boolean;
        already_deleted?: boolean;
        message?: string;
      };

      if (result.success === false) {
        throw new Error(
          result.message || "Unable to delete the bill."
        );
      }

      setSales((current) =>
        current.filter((sale) => sale.id !== selected.id)
      );
      setSelected(null);
      setPaymentEditOpen(false);
      setReturnModalOpen(false);
      setNotice(
        result.already_deleted
          ? `${invoiceNumber} was already deleted.`
          : `${invoiceNumber} deleted. Stock and customer balances were safely reversed.`
      );
      window.setTimeout(() => setNotice(""), 5000);
    } catch (error) {
      console.error("Unable to delete POS bill:", error);
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to delete the bill."
      );
    } finally {
      setDeleteSaving(false);
    }
  }

  async function buildDuplicateInvoicePayload(
    sale: SaleDetails,
    sendWhatsApp: boolean,
  ) {
    const digits = (sale.customer_phone || "").replace(/\D/g, "");
    const recipientPhone =
      digits.length === 10 ? `91${digits}` : digits;

    let invoiceStudio: Record<string, unknown> | null = null;

    try {
      const { data } = await supabase
        .from("ncs_invoice_settings")
        .select("*")
        .eq("id", "default")
        .maybeSingle();

      if (data) {
        invoiceStudio = {
          ...(data as Record<string, unknown>),
          active_tab: "a4",
        };
      }
    } catch (error) {
      console.info(
        "Duplicate invoice will use route defaults:",
        error,
      );
    }

    return {
      to: recipientPhone,
      sendWhatsApp,
      duplicateCopy: true,
      customerName:
        sale.customer_name || "Walk-in Customer",
      customerPhone: sale.customer_phone || "",
      billNumber:
        sale.invoice_number || `POS-${sale.id}`,
      billDate: sale.created_at,
      paymentMethod: label(sale.payment_method),
      subtotal: num(sale.subtotal),
      discountAmount: num(sale.bill_discount),
      taxAmount: num(sale.tax_amount),
      roundOff: num(sale.round_off),
      billAmount: num(sale.total_amount),
      paidAmount: num(sale.paid_amount),
      dueAmount: num(sale.due_amount),
      whatsappLanguage: "telugu",
      items: sale.items.map((item) => ({
        name: item.product_name || "Product",
        quantity: num(item.quantity),
        mrp: num(item.unit_price),
        price: num(item.unit_price),
        total:
          num(item.line_total) ||
          num(item.unit_price) * num(item.quantity),
        size: item.size || "",
        color: item.color || "",
        barcode: item.barcode || "",
      })),
      invoiceStudio: {
        ...(invoiceStudio || {}),
        active_tab: "a4",
      },
    };
  }

  async function fetchDuplicateInvoicePdf(
    sale: SaleDetails,
  ) {
    const response = await fetch(
      "/api/whatsapp/invoice-pdf",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          await buildDuplicateInvoicePayload(
            sale,
            false,
          ),
        ),
      },
    );

    if (!response.ok) {
      let message =
        "Unable to generate duplicate invoice PDF.";

      try {
        const result = (await response.json()) as {
          error?: string;
        };
        if (result.error) message = result.error;
      } catch {
        // Use fallback message.
      }

      throw new Error(message);
    }

    return await response.blob();
  }

  async function downloadDuplicateInvoice(
    sale: SaleDetails,
  ) {
    if (duplicateAction) return;
    setDuplicateAction("download");
    setNotice("");

    try {
      const blob = await fetchDuplicateInvoicePdf(sale);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const billNo =
        sale.invoice_number || `POS-${sale.id}`;

      link.href = url;
      link.download = `${billNo}-DUPLICATE.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(
        () => URL.revokeObjectURL(url),
        2000,
      );

      setNotice("Duplicate PDF downloaded.");
      window.setTimeout(() => setNotice(""), 3000);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to download duplicate PDF.",
      );
      window.setTimeout(() => setNotice(""), 5000);
    } finally {
      setDuplicateAction(null);
    }
  }

  async function printDuplicateInvoice(
    sale: SaleDetails,
  ) {
    if (duplicateAction) return;
    setDuplicateAction("print");
    setNotice("");

    try {
      const blob = await fetchDuplicateInvoicePdf(sale);
      const url = URL.createObjectURL(blob);
      const frame = document.createElement("iframe");

      frame.style.position = "fixed";
      frame.style.right = "0";
      frame.style.bottom = "0";
      frame.style.width = "1px";
      frame.style.height = "1px";
      frame.style.border = "0";
      frame.style.opacity = "0";
      frame.src = url;

      frame.onload = () => {
        window.setTimeout(() => {
          try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
          } finally {
            window.setTimeout(() => {
              frame.remove();
              URL.revokeObjectURL(url);
            }, 3000);
          }
        }, 500);
      };

      document.body.appendChild(frame);
      setNotice("Duplicate copy ready for print.");
      window.setTimeout(() => setNotice(""), 3000);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to print duplicate invoice.",
      );
      window.setTimeout(() => setNotice(""), 5000);
    } finally {
      setDuplicateAction(null);
    }
  }

  async function sendDuplicateInvoiceWhatsApp(
    sale: SaleDetails,
  ) {
    if (duplicateAction) return;

    const digits = (sale.customer_phone || "").replace(/\D/g, "");
    const recipientPhone =
      digits.length === 10 ? `91${digits}` : digits;

    if (
      recipientPhone.length < 10 ||
      recipientPhone.length > 15
    ) {
      setNotice(
        "A valid customer mobile number is required for duplicate WhatsApp PDF.",
      );
      window.setTimeout(() => setNotice(""), 4000);
      return;
    }

    setDuplicateAction("whatsapp");
    setNotice("");

    try {
      const response = await fetch(
        "/api/whatsapp/invoice-pdf",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            await buildDuplicateInvoicePayload(
              sale,
              true,
            ),
          ),
        },
      );

      const result = (await response.json()) as {
        success?: boolean;
        whatsappPdfSent?: boolean;
        error?: string;
      };

      if (
        !response.ok ||
        result.success !== true ||
        result.whatsappPdfSent !== true
      ) {
        throw new Error(
          result.error ||
            "Duplicate WhatsApp PDF could not be sent.",
        );
      }

      setNotice("Duplicate PDF sent on WhatsApp ✓");
      window.setTimeout(() => setNotice(""), 4000);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to send duplicate WhatsApp PDF.",
      );
      window.setTimeout(() => setNotice(""), 5000);
    } finally {
      setDuplicateAction(null);
    }
  }

  async function sendSaleWhatsAppPdf(sale: SaleDetails) {
    if (whatsAppSendingSaleId !== null) return;

    const digits = (sale.customer_phone || "").replace(/\D/g, "");
    const recipientPhone =
      digits.length === 10 ? `91${digits}` : digits;

    if (
      recipientPhone.length < 10 ||
      recipientPhone.length > 15
    ) {
      setNotice("A valid customer mobile number is required.");
      window.setTimeout(() => setNotice(""), 3500);
      return;
    }

    if (norm(sale.sale_status) === "cancelled") {
      setNotice("Cancelled bill cannot be sent.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    setWhatsAppSendingSaleId(sale.id);
    setNotice("");

    try {
      const response = await fetch(
        "/api/whatsapp/invoice",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: recipientPhone,
            sendWhatsApp: true,
            customerName:
              sale.customer_name || "Walk-in Customer",
            customerPhone: sale.customer_phone || "",
            billNumber:
              sale.invoice_number || `POS-${sale.id}`,
            billDate: formatDate(sale.created_at),
            paymentMethod:
              label(sale.payment_method),
            subtotal: num(sale.subtotal),
            discountAmount: num(sale.bill_discount),
            taxAmount: num(sale.tax_amount),
            roundOff: num(sale.round_off),
            billAmount: num(sale.total_amount),
            paidAmount: num(sale.paid_amount),
            dueAmount: num(sale.due_amount),
            items: sale.items.map((item) => ({
              name: item.product_name || "Product",
              quantity: num(item.quantity),
              mrp: num(item.unit_price),
              price: num(item.unit_price),
              total:
                num(item.line_total) ||
                num(item.unit_price) * num(item.quantity),
              size: item.size || "",
              color: item.color || "",
              barcode: item.barcode || "",
            })),
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
            "WhatsApp invoice PDF could not be sent."
          }${stageText}${detailText}`
        );
      }

      setNotice(
        `Invoice PDF sent directly to ${
          sale.customer_name || "customer"
        }.`
      );
      window.setTimeout(() => setNotice(""), 4000);
    } catch (error) {
      console.error(
        "Unable to send Sales History WhatsApp PDF:",
        error
      );
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to send WhatsApp invoice PDF."
      );
      window.setTimeout(() => setNotice(""), 5000);
    } finally {
      setWhatsAppSendingSaleId(null);
    }
  }

  function printInvoice(sale: SaleDetails) {
    const popup = window.open("", "_blank", "width=900,height=900");

    if (!popup) {
      setNotice("Please allow popups to print the invoice.");
      return;
    }

    const rows = sale.items
      .map(
        (item) => `
          <tr>
            <td>${item.product_name || "Product"}</td>
            <td>${[item.size, item.color].filter(Boolean).join(" / ") || item.barcode || "—"}</td>
            <td>${num(item.quantity)}</td>
            <td>${money(item.unit_price)}</td>
            <td>${money(item.line_total)}</td>
          </tr>`
      )
      .join("");

    popup.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>${sale.invoice_number || "POS Invoice"}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:28px;color:#222}
          .head{display:flex;justify-content:space-between;border-bottom:2px solid #0A2E73;padding-bottom:18px}
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
          <div><div class="gold">NEW CITY STYLE</div><h1>Style for Every Family</h1></div>
          <div><b>${sale.invoice_number || "Invoice"}</b><br/>${formatDate(sale.created_at)}</div>
        </div>
        <div class="info">
          <div class="box"><b>Customer</b><br/>${sale.customer_name || "Walk-in Customer"}<br/>${sale.customer_phone || ""}</div>
          <div class="box"><b>Payment</b><br/>${label(sale.payment_method)}<br/>${label(sale.payment_status)}</div>
        </div>
        <table>
          <thead><tr><th>Product</th><th>Variant</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">
          <div class="line"><span>Subtotal</span><b>${money(sale.subtotal)}</b></div>
          <div class="line"><span>Discount</span><b>-${money(sale.bill_discount)}</b></div>
          <div class="line"><span>Tax</span><b>${money(sale.tax_amount)}</b></div>
          <div class="line"><span>Round Off</span><b>-${money(sale.round_off)}</b></div>
          <div class="line grand"><span>Original Total</span><b>${money(sale.total_amount)}</b></div>
          ${
            num(sale.refunded_amount) > 0
              ? `<div class="line"><span>Refunded</span><b>-${money(sale.refunded_amount)}</b></div>
                 <div class="line grand"><span>Net Sale</span><b>${money(
                   Math.max(
                     0,
                     num(sale.total_amount) - num(sale.refunded_amount)
                   )
                 )}</b></div>`
              : ""
          }
          <div class="line"><span>Paid</span><b>${money(sale.paid_amount)}</b></div>
          <div class="line"><span>Due</span><b>${money(sale.due_amount)}</b></div>
        </div>
        <script>window.onload=()=>window.print()</script>
      </body>
      </html>
    `);

    popup.document.close();
  }

  return (
    <main className="salesPage">
      {notice && (
        <button className="toast" onClick={() => setNotice("")}>
          {notice}
        </button>
      )}

      <section className="hero">
        <div>
          <span>NEW CITY STYLE • BILLING REPORTS</span>
          <h1>Sales History</h1>
          <p>Review every POS bill, customer payment, due amount and sold item.</p>
        </div>
        <button onClick={loadSales} disabled={loading}>
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </section>

      <section className="stats">
        <article><span>Total Bills</span><strong>{stats.bills}</strong></article>
        <article><span>Sales Value</span><strong>{money(stats.value)}</strong></article>
        <article><span>Total Paid</span><strong>{money(stats.paid)}</strong></article>
        <article><span>Total Due</span><strong>{money(stats.due)}</strong></article>
        <article><span>Today Bills</span><strong>{stats.today}</strong></article>
      </section>

      <section className="filters">
        <div className="searchBox">
          <span>⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, customer, mobile or payment..."
          />
          {search && <button onClick={() => setSearch("")}>×</button>}
        </div>

        <select value={payment} onChange={(e) => setPayment(e.target.value)}>
          <option value="all">All Payments</option>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
          <option value="credit">Credit</option>
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="returned">Returned</option>
        </select>

        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="all">All Dates</option>
          <option value="today">Today</option>
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
        </select>
      </section>

      {errorText ? (
        <section className="message error">
          <h2>Unable to load sales</h2>
          <p>{errorText}</p>
          <button onClick={loadSales}>Try Again</button>
        </section>
      ) : loading ? (
        <section className="message">Loading sales history...</section>
      ) : filtered.length === 0 ? (
        <section className="message">
          <div className="emptyIcon">🧾</div>
          <h2>No sales found</h2>
          <p>Complete a POS sale or change the filters.</p>
        </section>
      ) : (
        <>
          <section className="saleList">
          {pagedSales.map((sale) => {
            const due = num(sale.due_amount);
            const cancelled = norm(sale.sale_status) === "cancelled";
            const refunded = Math.max(0, num(sale.refunded_amount));
            const netSale = Math.max(
              0,
              num(sale.total_amount) - refunded
            );

            return (
              <article className="saleCard" key={sale.id}>
                <div className="saleTop">
                  <div>
                    <span className="invoice">{sale.invoice_number || "POS Invoice"}</span>
                    <h2>{sale.customer_name || "Walk-in Customer"}</h2>
                    <p>{sale.customer_phone || "No mobile"} • {formatDate(sale.created_at)}</p>
                  </div>

                  <div className="badges">
                    <span className={`badge ${norm(sale.payment_method)}`}>
                      {label(sale.payment_method)}
                    </span>
                    <span className={`badge ${cancelled ? "cancelled" : "completed"}`}>
                      {label(sale.sale_status || "completed")}
                    </span>
                  </div>
                </div>

                <div className="amounts">
                  <div><span>Subtotal</span><strong>{money(sale.subtotal)}</strong></div>
                  <div><span>Discount</span><strong>{money(sale.bill_discount)}</strong></div>
                  <div><span>Original Total</span><strong>{money(sale.total_amount)}</strong></div>
                  {refunded > 0 && (
                    <div className="refundAmount">
                      <span>Refunded</span>
                      <strong>- {money(refunded)}</strong>
                    </div>
                  )}
                  <div className={refunded > 0 ? "netSale" : ""}>
                    <span>Net Sale</span>
                    <strong>{money(netSale)}</strong>
                  </div>
                  <div><span>Paid</span><strong>{money(sale.paid_amount)}</strong></div>
                  <div className={due > 0 ? "due" : ""}><span>Due</span><strong>{money(due)}</strong></div>
                </div>

                <footer>
                  <button onClick={() => showDetails(sale)}>
                    {detailsLoading ? "Loading..." : "View Details"}
                  </button>
                </footer>
              </article>
            );
          })}
        </section>

        {filtered.length > SALES_PER_PAGE && (
          <section className="salesPagination">
            <div className="pageSummary">
              Showing{" "}
              {(currentPage - 1) * SALES_PER_PAGE + 1}–
              {Math.min(
                currentPage * SALES_PER_PAGE,
                filtered.length
              )}{" "}
              of {filtered.length} bills
            </div>

            <div className="pageButtons">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.max(1, page - 1)
                  )
                }
              >
                Previous
              </button>

              {Array.from(
                { length: totalPages },
                (_, index) => index + 1
              )
                .filter(
                  (page) =>
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                )
                .map((page, index, visiblePages) => {
                  const previousPage =
                    visiblePages[index - 1];

                  return (
                    <span
                      key={page}
                      className="pageNumberWrap"
                    >
                      {previousPage &&
                        page - previousPage > 1 && (
                          <span className="pageEllipsis">
                            …
                          </span>
                        )}

                      <button
                        type="button"
                        className={
                          currentPage === page
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setCurrentPage(page)
                        }
                      >
                        {page}
                      </button>
                    </span>
                  );
                })}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(totalPages, page + 1)
                  )
                }
              >
                Next
              </button>
            </div>
          </section>
        )}
        </>
      )}

      {selected && (
        <div className="overlay" onMouseDown={() => setSelected(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <header>
              <div>
                <span>SALE DETAILS</span>
                <h2>{selected.invoice_number || "POS Invoice"}</h2>
                <p>{formatDate(selected.created_at)}</p>
              </div>
              <button onClick={() => setSelected(null)}>×</button>
            </header>

            <div className="customerGrid">
              <div>
                <span>Customer</span>
                <strong>{selected.customer_name || "Walk-in Customer"}</strong>
                <small>{selected.customer_phone || "No mobile number"}</small>
              </div>
              <div>
                <span>Payment</span>
                <strong>{label(selected.payment_method)}</strong>
                <small>{label(selected.payment_status)}</small>
              </div>
            </div>

            <div className="items">
              {selected.items.length === 0 ? (
                <p>No items found for this invoice.</p>
              ) : (
                selected.items.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.product_name || "Product"}</strong>
                      <small>
                        {[item.size, item.color].filter(Boolean).join(" • ") ||
                          item.barcode ||
                          "No variant"}
                      </small>
                    </div>
                    <span>{num(item.quantity)} × {money(item.unit_price)}</span>
                    <b>{money(item.line_total)}</b>
                  </article>
                ))
              )}
            </div>

            <div className="totals">
              <p><span>Subtotal</span><strong>{money(selected.subtotal)}</strong></p>
              <p><span>Discount</span><strong>- {money(selected.bill_discount)}</strong></p>
              <p><span>Tax</span><strong>{money(selected.tax_amount)}</strong></p>
              <p><span>Round Off</span><strong>- {money(selected.round_off)}</strong></p>
              <p className="grand"><span>Original Total</span><strong>{money(selected.total_amount)}</strong></p>
              {num(selected.refunded_amount) > 0 && (
                <>
                  <p className="refundLine">
                    <span>Refunded</span>
                    <strong>- {money(selected.refunded_amount)}</strong>
                  </p>
                  <p className="netLine">
                    <span>Net Sale</span>
                    <strong>
                      {money(
                        Math.max(
                          0,
                          num(selected.total_amount) -
                            num(selected.refunded_amount)
                        )
                      )}
                    </strong>
                  </p>
                </>
              )}
              <p><span>Paid</span><strong>{money(selected.paid_amount)}</strong></p>
              <p className={num(selected.due_amount) > 0 ? "due" : ""}>
                <span>Due</span><strong>{money(selected.due_amount)}</strong>
              </p>
            </div>

            <div className="modalActions">
              <button
                className="close"
                onClick={() => setSelected(null)}
              >
                Close
              </button>

              <button
                className="editPaymentAction"
                onClick={openPaymentEditor}
                disabled={norm(selected.sale_status) === "cancelled"}
              >
                Edit Payment
              </button>

              <button
                className="returnAction"
                onClick={openReturnModal}
                disabled={selected.items.every(
                  (item) => availableReturnQuantity(item) <= 0
                )}
              >
                <span className="returnActionIcon">↩</span>
                Return / Exchange
              </button>

              <button
                className="printAction"
                onClick={() => printInvoice(selected)}
              >
                Print Invoice
              </button>

              <button
                className="whatsAppAction"
                onClick={() =>
                  void sendSaleWhatsAppPdf(selected)
                }
                disabled={
                  whatsAppSendingSaleId !== null ||
                  norm(selected.sale_status) === "cancelled"
                }
              >
                {whatsAppSendingSaleId === selected.id
                  ? "Sending..."
                  : num(selected.due_amount) > 0
                    ? "WhatsApp PDF + Due"
                    : "WhatsApp PDF"}
              </button>

              <div className="duplicateActions">
                <span>DUPLICATE BILL</span>

                <button
                  type="button"
                  onClick={() =>
                    void downloadDuplicateInvoice(selected)
                  }
                  disabled={duplicateAction !== null}
                >
                  {duplicateAction === "download"
                    ? "Preparing..."
                    : "Download PDF"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void printDuplicateInvoice(selected)
                  }
                  disabled={duplicateAction !== null}
                >
                  {duplicateAction === "print"
                    ? "Preparing..."
                    : "Print Duplicate"}
                </button>

                <button
                  type="button"
                  className="duplicateWhatsApp"
                  onClick={() =>
                    void sendDuplicateInvoiceWhatsApp(selected)
                  }
                  disabled={
                    duplicateAction !== null ||
                    norm(selected.sale_status) === "cancelled"
                  }
                >
                  {duplicateAction === "whatsapp"
                    ? "Sending..."
                    : "WhatsApp Duplicate"}
                </button>
              </div>

              <button
                className="deleteAction"
                onClick={deleteSelectedSale}
                disabled={deleteSaving}
              >
                {deleteSaving ? "Deleting..." : "Delete Bill"}
              </button>
            </div>
          </section>
        </div>
      )}

      {selected && paymentEditOpen && (
        <div
          className="paymentEditOverlay"
          onMouseDown={() =>
            !paymentEditSaving && setPaymentEditOpen(false)
          }
        >
          <section
            className="paymentEditModal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>PAYMENT CORRECTION</span>
                <h2>Edit Payment & Settlement</h2>
                <p>{selected.invoice_number || "POS Invoice"}</p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentEditOpen(false)}
                disabled={paymentEditSaving}
              >
                ×
              </button>
            </header>

            <div className="paymentEditBody">
              <div className="paymentCompare">
                <div>
                  <span>Current Method</span>
                  <strong>{label(selected.payment_method)}</strong>
                </div>
                <div>
                  <span>Original Bill Total</span>
                  <strong>{money(selected.total_amount)}</strong>
                </div>
              </div>

              <label className="paymentCustomerNameField">
                <span>Correct Customer Name</span>
                <input
                  type="text"
                  value={paymentEditCustomerName}
                  onChange={(event) =>
                    setPaymentEditCustomerName(event.target.value)
                  }
                  placeholder="Enter customer name"
                  maxLength={80}
                />
              </label>

              <div className="paymentEditFields">
                <label>
                  <span>Correct Payment Method</span>
                  <select
                    value={paymentEditValue}
                    onChange={(event) =>
                      setPaymentEditValue(event.target.value)
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">
                      Bank Transfer
                    </option>
                  </select>
                </label>

                <label>
                  <span>Amount Actually Received</span>
                  <input
                    type="number"
                    min="0"
                    max={num(selected.total_amount)}
                    step="0.01"
                    value={paymentEditPaidAmount}
                    onChange={(event) =>
                      setPaymentEditPaidAmount(event.target.value)
                    }
                    placeholder="Enter received amount"
                  />
                </label>
              </div>

              {(() => {
                const billTotal = Math.max(
                  0,
                  num(selected.total_amount),
                );
                const paid = Math.max(
                  0,
                  Math.min(
                    billTotal,
                    num(paymentEditPaidAmount),
                  ),
                );
                const balance =
                  Math.round((billTotal - paid) * 100) / 100;

                return (
                  <>
                    {balance > 0 && (
                      <div className="balanceTreatment">
                        <span>How should the remaining balance be treated?</span>

                        <div className="balanceTreatmentGrid">
                          <button
                            type="button"
                            className={
                              paymentBalanceTreatment === "due"
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setPaymentBalanceTreatment("due")
                            }
                          >
                            <b>Customer Due</b>
                            <small>
                              Show {money(balance)} in Customer Dues
                            </small>
                          </button>

                          <button
                            type="button"
                            className={
                              paymentBalanceTreatment === "waive"
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setPaymentBalanceTreatment("waive")
                            }
                          >
                            <b>Discount / Waived Off</b>
                            <small>
                              Set due to ₹0 and waive {money(balance)}
                            </small>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="paymentCorrectionSummary">
                      <p>
                        <span>Bill Total</span>
                        <strong>{money(billTotal)}</strong>
                      </p>
                      <p>
                        <span>Received</span>
                        <strong>{money(paid)}</strong>
                      </p>
                      <p>
                        <span>
                          {balance <= 0
                            ? "Balance"
                            : paymentBalanceTreatment === "due"
                              ? "Customer Due"
                              : "Waived Off"}
                        </span>
                        <strong
                          className={
                            balance > 0 ? "paymentBalanceAmount" : ""
                          }
                        >
                          {money(balance)}
                        </strong>
                      </p>
                    </div>
                  </>
                );
              })()}

              <div className="paymentSafetyNote">
                Items and stock remain unchanged. Select Customer Due only
                when the customer will pay later. Select Discount / Waived
                Off when the remaining amount should never appear as due.
                After saving, the revised invoice PDF is sent directly on
                WhatsApp.
              </div>
            </div>

            <footer>
              <button
                type="button"
                className="paymentCancel"
                onClick={() => setPaymentEditOpen(false)}
                disabled={paymentEditSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="paymentSave"
                onClick={savePaymentMethod}
                disabled={
                  paymentEditSaving ||
                  paymentEditCustomerName.trim() === "" ||
                  paymentEditPaidAmount.trim() === "" ||
                  num(paymentEditPaidAmount) < 0 ||
                  num(paymentEditPaidAmount) >
                    num(selected.total_amount)
                }
              >
                {paymentEditSaving
                  ? "Updating & Sending..."
                  : "Save & Send WhatsApp"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {selected && returnModalOpen && (
        <div
          className="returnOverlay"
          onMouseDown={() =>
            !returnSubmitting && setReturnModalOpen(false)
          }
        >
          <section
            className="returnModal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="returnHeader">
              <div>
                <span>PREMIUM RETURN DESK</span>
                <h2>Return / Exchange</h2>
                <p>{selected.invoice_number}</p>
              </div>

              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                disabled={returnSubmitting}
              >
                ×
              </button>
            </header>

            <div className="returnTypeGrid">
              {(
                [
                  {
                    value: "refund",
                    label: "Refund",
                    icon: "₹",
                    caption: "Return money",
                  },
                  {
                    value: "exchange",
                    label: "Exchange",
                    icon: "⇄",
                    caption: "Replace item",
                  },
                  {
                    value: "store_credit",
                    label: "Store Credit",
                    icon: "★",
                    caption: "Save as credit",
                  },
                ] as const
              ).map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={
                    returnType === option.value
                      ? "returnTypeCard active"
                      : "returnTypeCard"
                  }
                  onClick={() => {
                    setReturnType(option.value);

                    if (option.value === "exchange") {
                      setRefundMethod("none");
                    } else if (refundMethod === "none") {
                      setRefundMethod(
                        option.value === "store_credit"
                          ? "store_credit"
                          : "cash"
                      );
                    }
                  }}
                >
                  <span>{option.icon}</span>
                  <strong>{option.label}</strong>
                  <small>{option.caption}</small>
                </button>
              ))}
            </div>

            <div className="returnItems">
              <div className="returnSectionTitle">
                <div>
                  <span>ITEMS</span>
                  <h3>Select products and quantity</h3>
                </div>
                <strong>{money(selectedReturnTotal)}</strong>
              </div>

              {selected.items.map((item) => {
                const available = availableReturnQuantity(item);
                const selectedQty =
                  getSelectedReturnQuantity(item.id);
                const selection = returnSelections.find(
                  (row) => row.saleItemId === item.id
                );

                return (
                  <article
                    key={item.id}
                    className={
                      selectedQty > 0
                        ? "returnItem selected"
                        : "returnItem"
                    }
                  >
                    <div className="returnItemInfo">
                      <span className="returnItemBadge">
                        {available > 0
                          ? `${available} returnable`
                          : "Fully returned"}
                      </span>
                      <h4>{item.product_name || "Product"}</h4>
                      <p>
                        {[item.size, item.color]
                          .filter(Boolean)
                          .join(" • ") ||
                          item.barcode ||
                          "No variant"}
                      </p>
                      <strong>
                        {money(
                          (() => {
                            const subtotal = num(selected.subtotal);
                            const payableRatio =
                              subtotal > 0
                                ? Math.max(
                                    0,
                                    num(selected.total_amount) /
                                      subtotal
                                  )
                                : 1;
                            const soldQty = Math.max(
                              1,
                              num(item.quantity)
                            );
                            const grossLineTotal =
                              num(item.line_total) ||
                              num(item.unit_price) * soldQty;

                            return (
                              (grossLineTotal / soldQty) *
                              payableRatio
                            );
                          })()
                        )}
                        <small className="returnActualPaidLabel">
                          actual refundable / item
                        </small>
                      </strong>
                    </div>

                    <div className="returnQtyControl">
                      <button
                        type="button"
                        onClick={() =>
                          updateReturnSelection(
                            item,
                            selectedQty - 1
                          )
                        }
                        disabled={selectedQty <= 0}
                      >
                        −
                      </button>

                      <span>{selectedQty}</span>

                      <button
                        type="button"
                        onClick={() =>
                          updateReturnSelection(
                            item,
                            selectedQty + 1
                          )
                        }
                        disabled={
                          available <= 0 ||
                          selectedQty >= available
                        }
                      >
                        +
                      </button>
                    </div>

                    <label className="restockToggle">
                      <input
                        type="checkbox"
                        checked={selection?.restock ?? true}
                        disabled={selectedQty <= 0}
                        onChange={() =>
                          toggleReturnRestock(item.id)
                        }
                      />
                      <span />
                      Restock
                    </label>
                  </article>
                );
              })}
            </div>

            {returnType === "exchange" && (
              <section className="exchangeDesk">
                <div className="returnSectionTitle">
                  <div>
                    <span>REPLACEMENT PRODUCTS</span>
                    <h3>Select barcode or product</h3>
                  </div>
                  <strong>{money(exchangeTotal)}</strong>
                </div>

                <div className="exchangeSearchBox">
                  <span>⌕</span>
                  <input
                    value={exchangeSearch}
                    onChange={(event) =>
                      setExchangeSearch(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleExchangeSearchEnter();
                      }
                    }}
                    autoComplete="off"
                    inputMode="search"
                    placeholder="Scan barcode or search any product, SKU, size or colour..."
                  />
                  <button
                    type="button"
                    onClick={loadExchangeInventory}
                    disabled={exchangeInventoryLoading}
                  >
                    {exchangeInventoryLoading ? "…" : "↻"}
                  </button>
                </div>

                <div className="exchangeSearchMeta">
                  <strong>{filteredExchangeInventory.length}</strong> in-stock replacement
                  {filteredExchangeInventory.length === 1 ? " product" : " products"}
                  {exchangeSearch.trim() ? " matched" : " available"}.
                  <span> Scan barcode + Enter for instant add.</span>
                </div>

                <div className="exchangeProductGrid">
                  {filteredExchangeInventory.map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      className="exchangeProductCard"
                      onClick={() => addExchangeItem(item)}
                    >
                      <span>{item.stock} in stock</span>
                      <strong>{item.name}</strong>
                      <small>
                        {[item.size, item.color]
                          .filter(Boolean)
                          .join(" • ") ||
                          item.barcode ||
                          "Standard product"}
                      </small>
                      <b>{money(item.mrp || item.price)}</b>
                      <em>+ Add Replacement</em>
                    </button>
                  ))}
                </div>

                {!exchangeInventoryLoading &&
                  filteredExchangeInventory.length === 0 && (
                    <div className="exchangeEmpty">
                      No in-stock product matched. Try barcode, SKU, product name, size or colour.
                    </div>
                  )}

                {exchangeItems.length === 0 ? (
                  <div className="exchangeEmpty">
                    Select the replacement product from above.
                  </div>
                ) : (
                  <div className="exchangeSelectedList">
                    {exchangeItems.map((item) => (
                      <article key={item.key}>
                        <div className="exchangeSelectedInfo">
                          <strong>{item.name}</strong>
                          <small>
                            {[item.size, item.color]
                              .filter(Boolean)
                              .join(" • ") ||
                              item.barcode ||
                              "Standard product"}
                          </small>
                          <span>Available stock: {item.stock}</span>
                        </div>

                        <label>
                          <span>Qty</span>
                          <input
                            type="number"
                            min="1"
                            max={item.stock}
                            value={item.quantity}
                            onChange={(event) =>
                              updateExchangeItem(
                                item.key,
                                "quantity",
                                num(event.target.value)
                              )
                            }
                          />
                        </label>

                        <label className="exchangeMrpField">
                          <span>MRP</span>
                          <strong>{money(item.mrp || item.price)}</strong>
                        </label>

                        <label>
                          <span>Discount %</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={(() => {
                              const baseMrp =
                                item.mrp > 0
                                  ? item.mrp
                                  : item.price;
                              if (baseMrp <= 0) return 0;
                              return Number(
                                (
                                  ((baseMrp - item.exchangePrice) /
                                    baseMrp) *
                                  100
                                ).toFixed(2)
                              );
                            })()}
                            onChange={(event) =>
                              updateExchangeDiscount(
                                item.key,
                                num(event.target.value)
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>Final Price</span>
                          <input
                            type="number"
                            min="0"
                            max={item.mrp > 0 ? item.mrp : undefined}
                            step="0.01"
                            value={item.exchangePrice}
                            onChange={(event) =>
                              updateExchangeItem(
                                item.key,
                                "exchangePrice",
                                num(event.target.value)
                              )
                            }
                          />
                        </label>

                        <div className="exchangeLineValue">
                          <span>Line Total</span>
                          <strong>
                            {money(
                              item.exchangePrice * item.quantity
                            )}
                          </strong>
                        </div>

                        <button
                          type="button"
                          className="exchangeRemove"
                          onClick={() => removeExchangeItem(item.key)}
                        >
                          ×
                        </button>
                      </article>
                    ))}
                  </div>
                )}

                <div className="exchangeSettlement">
                  <div>
                    <span>Returned Value</span>
                    <strong>{money(selectedReturnTotal)}</strong>
                  </div>
                  <div>
                    <span>Replacement Value</span>
                    <strong>{money(exchangeTotal)}</strong>
                  </div>
                  <div className={`exchangeDifference ${exchangeDirection}`}>
                    <span>
                      {exchangeDirection === "collect"
                        ? "Extra Collection • Today"
                        : exchangeDirection === "refund"
                          ? "Refund Customer"
                          : "Equal Exchange"}
                    </span>
                    <strong>{money(Math.abs(exchangeDifference))}</strong>
                    {exchangeDirection === "collect" && (
                      <small>
                        Only this extra amount is new money collected today.
                      </small>
                    )}
                  </div>
                </div>

                {exchangeDirection !== "even" && (
                  <label className="exchangeSettlementMethod">
                    <span>
                      {exchangeDirection === "collect"
                        ? "Collection Method"
                        : "Refund Method"}
                    </span>
                    <select
                      value={exchangeSettlementMethod}
                      onChange={(event) =>
                        setExchangeSettlementMethod(
                          event.target.value as ExchangeSettlementMethod
                        )
                      }
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="store_credit">Store Credit</option>
                      {exchangeDirection === "collect" && (
                        <option value="credit">Customer Credit</option>
                      )}
                    </select>
                  </label>
                )}
              </section>
            )}

            <div className="returnFormGrid">
              {returnType !== "exchange" && (
                <label>
                  <span>Refund Method</span>
                  <select
                    value={refundMethod}
                    onChange={(event) =>
                      setRefundMethod(
                        event.target.value as RefundMethod
                      )
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">
                      Bank Transfer
                    </option>
                    <option value="store_credit">
                      Store Credit
                    </option>
                  </select>
                </label>
              )}

              <label>
                <span>Return Reason</span>
                <input
                  value={returnReason}
                  onChange={(event) =>
                    setReturnReason(event.target.value)
                  }
                  placeholder="Size issue, damaged, customer changed mind..."
                />
              </label>

              <label className="fullWidth">
                <span>Notes (Optional)</span>
                <textarea
                  value={returnNotes}
                  onChange={(event) =>
                    setReturnNotes(event.target.value)
                  }
                  placeholder="Add any additional return details..."
                  rows={3}
                />
              </label>
            </div>

            <div className="returnSummary">
              <div>
                <span>Selected Items</span>
                <strong>
                  {returnSelections.reduce(
                    (total, row) => total + row.quantity,
                    0
                  )}
                </strong>
              </div>
              <div>
                <span>Return Type</span>
                <strong>{label(returnType)}</strong>
              </div>
              <div className="returnTotal">
                <span>
                  {returnType === "exchange"
                    ? "Old Item Credit"
                    : "Return Value"}
                </span>
                <strong>{money(selectedReturnTotal)}</strong>
              </div>
            </div>

            <footer className="returnFooter">
              <button
                type="button"
                className="returnCancel"
                onClick={() => setReturnModalOpen(false)}
                disabled={returnSubmitting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="returnConfirm"
                onClick={submitReturn}
                disabled={
                  returnSubmitting ||
                  returnSelections.length === 0 ||
                  (returnType === "exchange" &&
                    exchangeItems.length === 0)
                }
              >
                <span>{returnSubmitting ? "…" : "✓"}</span>
                {returnSubmitting
                  ? "Processing..."
                  : `Confirm ${label(returnType)}`}
              </button>
            </footer>
          </section>
        </div>
      )}

      <style jsx global>{`
        *{box-sizing:border-box}
        .salesPage{min-height:100vh;padding:22px;background:${IVORY};color:#2C2C2C;font-family:Poppins,Inter,Arial,sans-serif}
        .hero{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:26px;border-radius:24px;background:linear-gradient(135deg,${DEEP},${BLUE});color:#fff;box-shadow:0 18px 45px rgba(3,21,63,.16)}
        .hero span{color:${GOLD};font-size:11px;font-weight:900;letter-spacing:1.5px}.hero h1{margin:7px 0 5px;font-size:38px;line-height:1}.hero p{margin:0;color:rgba(255,255,255,.7);font-size:13px}
        .hero button{border:0;border-radius:12px;padding:13px 17px;background:${GOLD};color:${BLUE};font-weight:900;cursor:pointer}
        .stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:18px 0}
        .stats article{position:relative;isolation:isolate;min-height:108px;overflow:hidden;padding:18px;border:1px solid rgba(212,175,55,.2);border-radius:18px;background:linear-gradient(135deg,rgba(10,46,115,.99),rgba(3,21,63,.98));box-shadow:0 12px 28px rgba(3,21,63,.16),inset 0 1px 0 rgba(255,255,255,.06);transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease;animation:salesStatRise .45s ease both}
        .stats article:nth-child(1){animation-delay:.04s}
        .stats article:nth-child(2){animation-delay:.09s;background:linear-gradient(135deg,rgba(10,46,115,.99),rgba(18,44,101,.98),rgba(103,79,16,.9))}
        .stats article:nth-child(3){animation-delay:.14s}
        .stats article:nth-child(4){animation-delay:.19s;background:linear-gradient(135deg,rgba(8,37,98,.99),rgba(3,21,63,.98),rgba(95,72,13,.9))}
        .stats article:nth-child(5){animation-delay:.24s}
        .stats article::before{content:"";position:absolute;z-index:-1;top:-42%;right:-18%;width:126px;height:126px;border-radius:50%;background:radial-gradient(circle,rgba(212,175,55,.34),rgba(212,175,55,0));transition:transform .28s ease}
        .stats article::after{content:"";position:absolute;top:-145%;left:-36%;width:42%;height:370%;transform:rotate(22deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.14),transparent);animation:salesStatShine 5.2s ease-in-out infinite;pointer-events:none}
        .stats article:nth-child(2)::after{animation-delay:.7s}.stats article:nth-child(3)::after{animation-delay:1.4s}.stats article:nth-child(4)::after{animation-delay:2.1s}.stats article:nth-child(5)::after{animation-delay:2.8s}
        .stats article:hover{transform:translateY(-2px) scale(1.004);border-color:rgba(212,175,55,.42);box-shadow:0 16px 32px rgba(3,21,63,.22),0 0 0 1px rgba(212,175,55,.1)}
        .stats article:hover::before{transform:scale(1.08)}
        .stats span{position:relative;z-index:2;display:block;color:rgba(212,175,55,.94);font-size:9px;font-weight:900;letter-spacing:.55px;text-transform:uppercase}
        .stats strong{position:relative;z-index:2;display:block;margin-top:9px;color:#fff;font-size:24px;font-weight:950;letter-spacing:-.45px;text-shadow:0 2px 10px rgba(0,0,0,.12)}
        .stats article:nth-child(2) strong,.stats article:nth-child(4) strong{color:#f6d676}
        .filters{display:grid;grid-template-columns:minmax(260px,1fr) 170px 170px 170px;gap:10px;padding:13px;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(10,46,115,.07)}
        .searchBox{display:flex;align-items:center;gap:9px;padding:0 12px;border:1px solid #dfe4ed;border-radius:12px}.searchBox span{color:${BLUE};font-size:22px}.searchBox input{width:100%;height:44px;border:0;outline:0;font:inherit}.searchBox button{border:0;border-radius:50%;width:28px;height:28px;cursor:pointer}
        .filters select{min-height:44px;border:1px solid #dfe4ed;border-radius:12px;background:#fff;padding:0 12px;font:inherit;font-size:12px;font-weight:700}
        .saleList{display:grid;gap:12px;margin-top:16px}.saleCard{padding:18px;border:1px solid rgba(10,46,115,.12);border-radius:18px;background:linear-gradient(180deg,#fff,#f8fafd);box-shadow:0 9px 26px rgba(10,46,115,.06);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.saleCard:hover{transform:translateY(-2px);border-color:rgba(212,175,55,.42);box-shadow:0 15px 32px rgba(3,21,63,.11)}
        .saleTop{display:flex;justify-content:space-between;gap:18px}.invoice{color:${GOLD};font-size:10px;font-weight:950;letter-spacing:1px}.saleTop h2{margin:5px 0 3px;color:${DEEP};font-size:18px}.saleTop p{margin:0;color:#7d8491;font-size:11px}
        .badges{display:flex;gap:7px;align-items:flex-start}.badge{padding:7px 10px;border-radius:30px;background:#eef2f8;color:#596375;font-size:9px;font-weight:900}.badge.cash,.badge.upi,.badge.card,.badge.completed{background:#eaf7ef;color:#157642}.badge.credit{background:#fff4dd;color:#986300}.badge.cancelled{background:#ffe9e9;color:#b43232}
        .amounts{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:16px;padding:14px;border-radius:14px;background:#f8f9fc}.amounts span{display:block;color:#8a91a0;font-size:9px;text-transform:uppercase}.amounts strong{display:block;margin-top:4px;color:${DEEP};font-size:14px}.amounts .due strong{color:#b43232}
        .saleCard footer{display:flex;justify-content:flex-end;margin-top:12px}.saleCard footer button{min-height:40px;border:1px solid rgba(212,175,55,.72);border-radius:10px;padding:10px 15px;background:linear-gradient(135deg,${DEEP},${BLUE});color:#fff;font-weight:900;cursor:pointer;box-shadow:0 10px 22px rgba(3,21,63,.14);transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}.saleCard footer button:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 13px 26px rgba(3,21,63,.2);filter:brightness(1.05)}
        .message{margin-top:16px;padding:50px;text-align:center;border-radius:18px;background:#fff}.emptyIcon{font-size:40px}.message h2{color:${BLUE}}.error h2{color:#b43232}
        .toast{position:fixed;top:18px;right:18px;z-index:10000;max-width:420px;padding:14px 18px;border:0;border-radius:12px;background:#b43232;color:#fff;font-weight:800;box-shadow:0 16px 40px rgba(0,0,0,.2);cursor:pointer}
        .overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,21,63,.68);backdrop-filter:blur(8px)}
        .modal{width:min(820px,100%);max-height:92vh;overflow:auto;border-radius:22px;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.3)}
        .modal>header{display:flex;justify-content:space-between;gap:20px;padding:22px;background:linear-gradient(135deg,${DEEP},${BLUE});color:#fff}.modal>header span{color:${GOLD};font-size:10px;font-weight:900}.modal>header h2{margin:5px 0}.modal>header p{margin:0;color:rgba(255,255,255,.7);font-size:11px}.modal>header button{width:38px;height:38px;border:1px solid rgba(255,255,255,.25);border-radius:10px;background:rgba(255,255,255,.08);color:#fff;font-size:24px;cursor:pointer}
        .customerGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:18px}.customerGrid>div{padding:14px;border-radius:12px;background:#f7f8fb}.customerGrid span,.customerGrid small{display:block;color:#7d8491;font-size:10px}.customerGrid strong{display:block;margin:4px 0;color:${DEEP}}
        .items{padding:0 18px}.items article{display:grid;grid-template-columns:1fr auto auto;gap:14px;align-items:center;padding:13px 0;border-bottom:1px solid #e8ebf1}.items strong,.items small{display:block}.items small{color:#8a91a0;font-size:10px}.items span{font-size:11px}.items b{color:${BLUE}}
        .totals{margin:18px;padding:16px;border-radius:14px;background:#f8f9fc}.totals p{display:flex;justify-content:space-between;margin:8px 0}.totals .grand{padding-top:12px;border-top:2px solid ${BLUE};font-size:19px;color:${BLUE};font-weight:900}.totals .due{color:#b43232}
        .modalActions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px;padding:0 18px 18px}.modalActions button{min-height:46px;border:0;border-radius:12px;padding:12px 17px;background:${BLUE};color:#fff;font-weight:900;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease,filter .2s ease}.modalActions button:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 28px rgba(10,46,115,.18);filter:brightness(1.05)}.modalActions button:disabled{opacity:.45;cursor:not-allowed}.modalActions .close{background:#e9edf4;color:#2C2C2C}.modalActions .returnAction{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,${GOLD},#f3d66f);color:${DEEP};box-shadow:0 10px 24px rgba(212,175,55,.22)}.returnActionIcon{font-size:18px;animation:returnPulse 1.8s ease-in-out infinite}.modalActions .printAction{background:linear-gradient(135deg,${DEEP},${BLUE})}.modalActions .whatsAppAction{background:linear-gradient(135deg,#1f9d55,#167a42);color:#fff;box-shadow:0 10px 24px rgba(31,157,85,.22)}.modalActions .editPaymentAction{background:linear-gradient(135deg,#0f766e,#115e59);color:#fff;box-shadow:0 10px 24px rgba(15,118,110,.2)}.modalActions .deleteAction{background:linear-gradient(135deg,#b42318,#7a1510);color:#fff;box-shadow:0 10px 24px rgba(180,35,24,.22)}
        .paymentEditOverlay{position:fixed;inset:0;z-index:10040;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,21,63,.78);backdrop-filter:blur(10px)}
        .paymentEditModal{width:min(520px,100%);overflow:hidden;border:1px solid rgba(212,175,55,.34);border-radius:22px;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.34);animation:returnModalEnter .24s ease-out}
        .paymentEditModal>header{display:flex;justify-content:space-between;gap:18px;padding:22px;background:radial-gradient(circle at 88% 0%,rgba(212,175,55,.22),transparent 34%),linear-gradient(135deg,${DEEP},${BLUE});color:#fff}
        .paymentEditModal>header span{color:${GOLD};font-size:9px;font-weight:950;letter-spacing:1.3px}.paymentEditModal>header h2{margin:5px 0 3px;font-size:25px}.paymentEditModal>header p{margin:0;color:rgba(255,255,255,.68);font-size:10px}.paymentEditModal>header button{width:40px;height:40px;border:1px solid rgba(255,255,255,.22);border-radius:11px;background:rgba(255,255,255,.08);color:#fff;font-size:23px;cursor:pointer}
        .paymentEditBody{padding:20px}.paymentCompare{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px}.paymentCompare>div{padding:13px;border-radius:13px;background:#f5f7fb}.paymentCompare span{display:block;color:#7d8491;font-size:8px;font-weight:850;text-transform:uppercase}.paymentCompare strong{display:block;margin-top:5px;color:${DEEP};font-size:15px}.paymentEditBody label>span{display:block;margin-bottom:6px;color:#667085;font-size:9px;font-weight:900;text-transform:uppercase}.paymentCustomerNameField{display:block;margin-bottom:12px}.paymentEditFields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.paymentEditBody select,.paymentEditBody input{width:100%;height:46px;border:1px solid #dfe4ed;border-radius:12px;background:#fff;padding:0 12px;color:${DEEP};font:inherit;font-size:12px;font-weight:800;outline:none}.paymentEditBody select:focus,.paymentEditBody input:focus{border-color:${BLUE};box-shadow:0 0 0 3px rgba(10,46,115,.08)}.balanceTreatment{margin-top:15px}.balanceTreatment>span{display:block;margin-bottom:7px;color:#667085;font-size:9px;font-weight:900;text-transform:uppercase}.balanceTreatmentGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.balanceTreatmentGrid button{display:grid;gap:4px;min-height:74px;padding:12px;border:1px solid #dfe4ed;border-radius:12px;background:#fff;color:${DEEP};text-align:left;cursor:pointer}.balanceTreatmentGrid button.active{border-color:${GOLD};background:#fff9e7;box-shadow:0 0 0 3px rgba(212,175,55,.13)}.balanceTreatmentGrid b{font-size:11px}.balanceTreatmentGrid small{color:#6b7280;font-size:8px;line-height:1.4}.paymentCorrectionSummary{display:grid;gap:7px;margin-top:14px;padding:12px;border-radius:12px;background:#f5f7fb}.paymentCorrectionSummary p{display:flex;justify-content:space-between;margin:0;color:#667085;font-size:10px}.paymentCorrectionSummary strong{color:${DEEP}}.paymentBalanceAmount{color:#b43232!important}.paymentSafetyNote{margin-top:13px;padding:12px;border:1px solid #f0d98a;border-radius:12px;background:#fff9e7;color:#715a13;font-size:9px;line-height:1.55;font-weight:700}
        .paymentEditModal>footer{display:flex;justify-content:flex-end;gap:10px;padding:0 20px 20px}.paymentEditModal>footer button{min-height:44px;border:0;border-radius:11px;padding:0 16px;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.paymentEditModal>footer button:disabled{opacity:.45;cursor:not-allowed}.paymentCancel{background:#e9edf4;color:#394150}.paymentSave{background:linear-gradient(135deg,${GOLD},#efcf68);color:${DEEP};box-shadow:0 10px 24px rgba(212,175,55,.24)}
        
        .returnOverlay{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,21,63,.78);backdrop-filter:blur(11px)}
        .returnModal{width:min(1180px,96vw);max-height:96vh;overflow:auto;border:1px solid rgba(212,175,55,.32);border-radius:26px;background:#fff;box-shadow:0 35px 100px rgba(0,0,0,.38);animation:returnModalEnter .26s ease-out}
        .returnHeader{display:flex;justify-content:space-between;gap:18px;padding:24px 26px;background:radial-gradient(circle at 86% 0%,rgba(212,175,55,.22),transparent 32%),linear-gradient(135deg,${DEEP},${BLUE});color:#fff}
        .returnHeader span{color:${GOLD};font-size:10px;font-weight:950;letter-spacing:1.5px}.returnHeader h2{margin:6px 0 4px;font-size:30px}.returnHeader p{margin:0;color:rgba(255,255,255,.68);font-size:11px}.returnHeader button{width:42px;height:42px;border:1px solid rgba(255,255,255,.22);border-radius:12px;background:rgba(255,255,255,.08);color:#fff;font-size:24px;cursor:pointer}
        .returnTypeGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:18px 20px 4px}.returnTypeCard{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:15px;border:1px solid #e5e9f0;border-radius:16px;background:#fff;color:#5f6878;text-align:left;cursor:pointer;transition:.22s ease}.returnTypeCard:hover{transform:translateY(-3px);border-color:${GOLD};box-shadow:0 14px 30px rgba(10,46,115,.09)}.returnTypeCard.active{border-color:${BLUE};background:linear-gradient(145deg,#f9fbff,#eef3fb);box-shadow:0 12px 30px rgba(10,46,115,.12)}.returnTypeCard>span{width:38px;height:38px;display:flex;align-items:center;justify-content:center;margin-bottom:4px;border-radius:12px;background:#eef2f8;color:${BLUE};font-size:20px;font-weight:950}.returnTypeCard.active>span{background:${GOLD};color:${DEEP};animation:returnGlow 1.8s ease-in-out infinite}.returnTypeCard strong{color:${DEEP};font-size:13px}.returnTypeCard small{font-size:9px}
        .returnItems{padding:18px 20px}.returnSectionTitle{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:10px}.returnSectionTitle span{color:${GOLD};font-size:9px;font-weight:950;letter-spacing:1px}.returnSectionTitle h3{margin:3px 0 0;color:${DEEP};font-size:17px}.returnSectionTitle>strong{color:${BLUE};font-size:21px}
        .returnItem{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:14px;align-items:center;margin-bottom:9px;padding:14px;border:1px solid #e8ebf1;border-radius:16px;background:#fff;transition:.2s ease}.returnItem.selected{border-color:rgba(10,46,115,.35);background:linear-gradient(135deg,#fff,#f6f9ff);box-shadow:0 10px 26px rgba(10,46,115,.08)}.returnItemBadge{display:inline-flex;padding:5px 8px;border-radius:20px;background:#edf7f1;color:#167842;font-size:8px;font-weight:900}.returnItemInfo h4{margin:6px 0 2px;color:${DEEP};font-size:13px}.returnItemInfo p{margin:0;color:#89909c;font-size:9px}.returnItemInfo>strong{display:block;margin-top:5px;color:${BLUE};font-size:13px}.returnActualPaidLabel{display:block;margin-top:2px;color:#8a91a0;font-size:7px;font-weight:750;text-transform:uppercase}
        .returnQtyControl{display:flex;align-items:center;gap:9px}.returnQtyControl button{width:34px;height:34px;border:0;border-radius:10px;background:#eef2f8;color:${BLUE};font-size:20px;font-weight:900;cursor:pointer;transition:.18s ease}.returnQtyControl button:hover:not(:disabled){transform:scale(1.08);background:${BLUE};color:#fff}.returnQtyControl button:disabled{opacity:.35;cursor:not-allowed}.returnQtyControl span{min-width:26px;text-align:center;color:${DEEP};font-weight:950}
        .restockToggle{display:flex;align-items:center;gap:7px;color:#5f6878;font-size:9px;font-weight:850}.restockToggle input{display:none}.restockToggle>span{position:relative;width:36px;height:20px;border-radius:30px;background:#d9dee8;transition:.2s ease}.restockToggle>span:after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2);transition:.2s ease}.restockToggle input:checked+span{background:#1f9d55}.restockToggle input:checked+span:after{transform:translateX(16px)}
        .exchangeMrpField{min-width:110px}.exchangeMrpField>strong{min-height:42px;display:flex;align-items:center;padding:0 12px;border:1px solid rgba(10,46,115,.12);border-radius:10px;background:#f8fafc;color:${BLUE};font-size:13px;font-weight:900}.exchangeLineValue{min-width:120px;display:flex;flex-direction:column;gap:5px}.exchangeLineValue>span{color:#6b7280;font-size:8px;font-weight:850;text-transform:uppercase}.exchangeLineValue>strong{color:${BLUE};font-size:14px;font-weight:950}.exchangeDifference small{display:block;margin-top:3px;font-size:8px;font-weight:750;opacity:.8}
        .exchangeDesk{margin:0 20px 18px;padding:16px;border:1px solid rgba(212,175,55,.26);border-radius:18px;background:linear-gradient(180deg,#fbfcff,#f5f8fd)}
        .exchangeSearchBox{display:flex;align-items:center;gap:9px;padding:0 11px;border:1px solid #dfe4ed;border-radius:12px;background:#fff}.exchangeSearchBox>span{color:${BLUE};font-size:21px}.exchangeSearchBox input{width:100%;height:44px;border:0;outline:0;font:inherit;font-size:11px}.exchangeSearchBox button{width:34px;height:34px;border:1px solid rgba(212,175,55,.5);border-radius:9px;background:${GOLD};color:${DEEP};font-weight:950;cursor:pointer}
        .exchangeSearchMeta{margin-top:8px;font-size:10px;color:#596579;display:flex;gap:4px;align-items:center;flex-wrap:wrap}.exchangeSearchMeta strong{color:${DEEP};font-size:11px}.exchangeSearchMeta span{color:#758197}
        .exchangeProductGrid{max-height:235px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px;overflow:auto}.exchangeProductCard{display:flex;flex-direction:column;align-items:flex-start;min-width:0;padding:12px;border:1px solid #e3e8f0;border-radius:13px;background:#fff;text-align:left;cursor:pointer;transition:.18s ease}.exchangeProductCard:hover{transform:translateY(-2px);border-color:${GOLD};box-shadow:0 10px 22px rgba(3,21,63,.09)}.exchangeProductCard>span{padding:4px 7px;border-radius:20px;background:#eaf7ef;color:#167842;font-size:7px;font-weight:900}.exchangeProductCard strong{max-width:100%;margin-top:7px;overflow:hidden;color:${DEEP};font-size:11px;text-overflow:ellipsis;white-space:nowrap}.exchangeProductCard small{max-width:100%;margin-top:3px;overflow:hidden;color:#858d9b;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.exchangeProductCard b{margin-top:7px;color:${BLUE};font-size:12px}.exchangeProductCard em{margin-top:5px;color:${GOLD};font-size:8px;font-style:normal;font-weight:900}
        .exchangeEmpty{margin-top:10px;padding:20px;border:1px dashed #cfd6e2;border-radius:13px;color:#7f8795;font-size:10px;text-align:center}.exchangeSelectedList{display:grid;gap:8px;margin-top:11px}.exchangeSelectedList article{display:grid;grid-template-columns:minmax(0,1fr) 78px 130px auto 34px;gap:9px;align-items:end;padding:11px;border:1px solid #e3e8f0;border-radius:13px;background:#fff}.exchangeSelectedInfo{min-width:0}.exchangeSelectedInfo strong,.exchangeSelectedInfo small,.exchangeSelectedInfo span{display:block}.exchangeSelectedInfo strong{overflow:hidden;color:${DEEP};font-size:11px;text-overflow:ellipsis;white-space:nowrap}.exchangeSelectedInfo small{margin-top:3px;color:#818997;font-size:8px}.exchangeSelectedInfo span{margin-top:4px;color:#167842;font-size:7px;font-weight:850}.exchangeSelectedList label>span{display:block;margin-bottom:4px;color:#7c8492;font-size:7px;font-weight:850;text-transform:uppercase}.exchangeSelectedList input{width:100%;height:36px;border:1px solid #dfe4ed;border-radius:9px;padding:0 8px;font:inherit;font-size:10px}.exchangeLineTotal{align-self:center;color:${BLUE};font-size:11px;white-space:nowrap}.exchangeRemove{width:32px;height:32px;border:0;border-radius:9px;background:#ffe9e9;color:#b43232;font-size:18px;font-weight:900;cursor:pointer}
        .exchangeSettlement{display:grid;grid-template-columns:1fr 1fr 1.25fr;gap:8px;margin-top:12px}.exchangeSettlement>div{padding:11px;border-radius:12px;background:#fff}.exchangeSettlement span{display:block;color:#8a91a0;font-size:7px;font-weight:850;text-transform:uppercase}.exchangeSettlement strong{display:block;margin-top:4px;color:${DEEP};font-size:12px}.exchangeDifference{background:linear-gradient(135deg,${DEEP},${BLUE})!important}.exchangeDifference span{color:rgba(255,255,255,.65)}.exchangeDifference strong{color:${GOLD};font-size:17px}.exchangeDifference.refund strong{color:#8ff0b4}.exchangeSettlementMethod{display:block;margin-top:11px}.exchangeSettlementMethod>span{display:block;margin-bottom:5px;color:#707887;font-size:8px;font-weight:850;text-transform:uppercase}.exchangeSettlementMethod select{width:100%;height:42px;border:1px solid #dfe4ed;border-radius:11px;background:#fff;padding:0 11px;font:inherit;font-size:10px}
        .returnFormGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 20px 18px}.returnFormGrid label{display:block}.returnFormGrid label>span{display:block;margin-bottom:6px;color:#707887;font-size:9px;font-weight:850;text-transform:uppercase}.returnFormGrid input,.returnFormGrid select,.returnFormGrid textarea{width:100%;border:1px solid #dfe4ed;border-radius:12px;background:#fff;padding:12px;font:inherit;font-size:11px;outline:none}.returnFormGrid input:focus,.returnFormGrid select:focus,.returnFormGrid textarea:focus{border-color:${BLUE};box-shadow:0 0 0 3px rgba(10,46,115,.08)}.returnFormGrid .fullWidth{grid-column:1/-1}
        .returnSummary{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:10px;margin:0 20px 18px;padding:14px;border-radius:16px;background:#f6f8fc}.returnSummary>div{padding:10px;border-radius:12px;background:#fff}.returnSummary span{display:block;color:#8a91a0;font-size:8px;font-weight:850;text-transform:uppercase}.returnSummary strong{display:block;margin-top:4px;color:${DEEP};font-size:13px}.returnSummary .returnTotal{background:linear-gradient(135deg,${DEEP},${BLUE})}.returnSummary .returnTotal span{color:rgba(255,255,255,.66)}.returnSummary .returnTotal strong{color:${GOLD};font-size:19px}
        .returnFooter{display:flex;justify-content:flex-end;gap:10px;padding:0 20px 20px}.returnFooter button{min-height:48px;border:0;border-radius:13px;padding:0 18px;font:inherit;font-size:11px;font-weight:900;cursor:pointer;transition:.2s ease}.returnFooter button:hover:not(:disabled){transform:translateY(-2px)}.returnFooter button:disabled{opacity:.5;cursor:not-allowed}.returnCancel{background:#e9edf4;color:#3e4653}.returnConfirm{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:190px;background:linear-gradient(135deg,${GOLD},#f0cf62);color:${DEEP};box-shadow:0 12px 28px rgba(212,175,55,.26)}.returnConfirm>span{font-size:17px}
        @keyframes returnModalEnter{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes returnPulse{0%,100%{transform:translateX(0)}50%{transform:translateX(-3px)}}@keyframes returnGlow{0%,100%{box-shadow:0 0 0 0 rgba(212,175,55,.25)}50%{box-shadow:0 0 0 8px rgba(212,175,55,0)}}@keyframes salesStatRise{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes salesStatShine{0%,62%{left:-42%;opacity:0}68%{opacity:.7}100%{left:126%;opacity:0}}
@media(max-width:1100px){.stats{grid-template-columns:repeat(3,1fr)}.filters{grid-template-columns:1fr 1fr}.searchBox{grid-column:1/-1}}
        @media(max-width:700px){.salesPage{padding:12px}.hero{align-items:flex-start}.hero h1{font-size:29px}.stats{grid-template-columns:1fr 1fr}.filters{grid-template-columns:1fr}.searchBox{grid-column:auto}.saleTop{display:block}.badges{margin-top:12px}.amounts{grid-template-columns:1fr 1fr}.customerGrid{grid-template-columns:1fr}.items article{grid-template-columns:1fr auto}.items b{grid-column:2}.returnOverlay{padding:8px}.returnModal{max-height:97vh;border-radius:20px}.returnTypeGrid{grid-template-columns:1fr}.returnItem{grid-template-columns:1fr}.returnQtyControl{justify-content:flex-start}.returnFormGrid{grid-template-columns:1fr}.returnFormGrid .fullWidth{grid-column:auto}.returnSummary{grid-template-columns:1fr}.exchangeProductGrid{grid-template-columns:1fr}.exchangeSelectedList article{grid-template-columns:1fr 1fr}.exchangeSelectedInfo{grid-column:1/-1}.exchangeLineTotal{align-self:center}.exchangeSettlement{grid-template-columns:1fr}.returnFooter{display:grid;grid-template-columns:1fr}.returnFooter button{width:100%}.paymentCompare{grid-template-columns:1fr}.paymentEditModal>footer{display:grid;grid-template-columns:1fr}.paymentEditModal>footer button{width:100%}}
        .salesPagination{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:18px 0 8px;padding:14px 16px;border:1px solid rgba(10,46,115,.10);border-radius:16px;background:rgba(255,255,255,.94);box-shadow:0 10px 26px rgba(3,21,63,.06)}
        .pageSummary{color:#6b7280;font-size:11px;font-weight:800}
        .pageButtons{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
        .pageButtons button{min-width:36px;height:36px;padding:0 12px;border:1px solid rgba(10,46,115,.14);border-radius:10px;background:#fff;color:#0A2E73;font-size:11px;font-weight:900;cursor:pointer}
        .pageButtons button:hover:not(:disabled){border-color:rgba(212,175,55,.65);box-shadow:0 6px 14px rgba(10,46,115,.08)}
        .pageButtons button.active{background:linear-gradient(135deg,#03153F,#0A2E73);color:#fff;border-color:#D4AF37}
        .pageButtons button:disabled{opacity:.42;cursor:not-allowed}
        .pageNumberWrap{display:flex;align-items:center;gap:7px}
        .pageEllipsis{color:#9ca3af;font-weight:900;padding:0 2px}
        .duplicateActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border:1px solid rgba(212,175,55,.5);border-radius:14px;background:linear-gradient(135deg,#fffdf5,#f7f9fd)}
        .duplicateActions>span{font-size:9px;font-weight:950;letter-spacing:.11em;color:#8a6b00;margin-right:2px}
        .duplicateActions button{border:1px solid rgba(10,46,115,.16);border-radius:10px;padding:10px 12px;background:#fff;color:${BLUE};font-size:11px;font-weight:900;cursor:pointer}
        .duplicateActions button:disabled{opacity:.55;cursor:not-allowed}
        .duplicateActions .duplicateWhatsApp{background:#159447;color:#fff;border-color:#159447}

        /* ============================================================
           NCS SALES HISTORY — MOBILE COMMAND DECK PREMIUM FINAL
           Visual-only layer. Existing billing / refund / exchange /
           WhatsApp / correction / delete logic is untouched.
           ============================================================ */

        .salesPage {
          min-height:100vh !important;
          padding:18px !important;
          background:
            radial-gradient(circle at 0% 0%,rgba(91,72,145,.045),transparent 23%),
            radial-gradient(circle at 100% 6%,rgba(65,115,132,.045),transparent 23%),
            linear-gradient(180deg,#f7f7f8 0%,#f3f4f6 52%,#f7f4ee 100%) !important;
          color:#20283a !important;
        }

        /* HERO */
        .salesPage .hero {
          position:relative !important;
          overflow:hidden !important;
          border:1px solid rgba(255,255,255,.14) !important;
          border-radius:26px !important;
          padding:22px 24px !important;
          background:
            radial-gradient(circle at 88% -10%,rgba(241,211,109,.11),transparent 28%),
            radial-gradient(circle at 10% 112%,rgba(171,88,141,.12),transparent 32%),
            linear-gradient(120deg,#2b1b49 0%,#493578 40%,#31516f 72%,#245d60 100%) !important;
          box-shadow:0 16px 38px rgba(28,25,46,.15) !important;
        }

        .salesPage .hero::after {
          content:"NCS";
          position:absolute;
          right:26px;
          top:-22px;
          color:rgba(255,255,255,.025);
          font-size:118px;
          line-height:1;
          font-weight:1000;
          letter-spacing:-8px;
          pointer-events:none;
        }

        .salesPage .hero > div,
        .salesPage .hero > button {
          position:relative;
          z-index:2;
        }

        .salesPage .hero > div > span {
          color:#d8d1ea !important;
          font-size:9px !important;
          font-weight:900 !important;
          letter-spacing:1.1px !important;
        }

        .salesPage .hero h1 {
          margin:5px 0 5px !important;
          color:#fff !important;
          font-size:34px !important;
          letter-spacing:-1px !important;
        }

        .salesPage .hero p {
          margin:0 !important;
          color:rgba(255,255,255,.70) !important;
          font-size:11px !important;
        }

        .salesPage .hero > button {
          min-height:44px !important;
          border:1px solid rgba(255,255,255,.16) !important;
          border-radius:13px !important;
          padding:0 16px !important;
          background:rgba(255,255,255,.08) !important;
          color:#fff !important;
          box-shadow:none !important;
          backdrop-filter:blur(8px);
        }

        /* STATS — command deck tiles */
        .salesPage .stats {
          gap:10px !important;
          margin-top:14px !important;
        }

        .salesPage .stats article {
          position:relative !important;
          overflow:hidden !important;
          min-height:104px !important;
          border:1px solid #e5e7ec !important;
          border-radius:18px !important;
          padding:15px !important;
          background:#fff !important;
          box-shadow:0 7px 18px rgba(32,39,55,.045) !important;
        }

        .salesPage .stats article::after {
          content:"";
          position:absolute;
          right:-22px;
          bottom:-28px;
          width:82px;
          height:82px;
          border-radius:50%;
          background:currentColor;
          opacity:.055;
          pointer-events:none;
        }

        .salesPage .stats article:nth-child(1) {
          color:#665492 !important;
          background:#f6f4fa !important;
          border-color:#e3dff0 !important;
        }
        .salesPage .stats article:nth-child(2) {
          color:#4f806f !important;
          background:#f2f7f4 !important;
          border-color:#dfece5 !important;
        }
        .salesPage .stats article:nth-child(3) {
          color:#4d7d89 !important;
          background:#f1f6f7 !important;
          border-color:#dce9ec !important;
        }
        .salesPage .stats article:nth-child(4) {
          color:#94617e !important;
          background:#faf2f5 !important;
          border-color:#efdee6 !important;
        }
        .salesPage .stats article:nth-child(5) {
          color:#9a774a !important;
          background:#faf6ed !important;
          border-color:#eee5d4 !important;
        }

        .salesPage .stats article span {
          color:currentColor !important;
          font-size:8px !important;
          font-weight:900 !important;
          letter-spacing:.65px !important;
          text-transform:uppercase !important;
        }

        .salesPage .stats article strong {
          margin-top:8px !important;
          color:#273042 !important;
          font-size:22px !important;
          font-weight:950 !important;
        }

        /* FILTER BAR */
        .salesPage .filters {
          gap:9px !important;
          margin-top:14px !important;
          padding:11px !important;
          border:1px solid #e5e8ed !important;
          border-radius:18px !important;
          background:#fff !important;
          box-shadow:0 7px 18px rgba(32,39,55,.04) !important;
        }

        .salesPage .searchBox {
          border:1px solid #e0e4ea !important;
          border-radius:13px !important;
          background:#f9fafb !important;
        }

        .salesPage .searchBox > span {
          color:#665492 !important;
        }

        .salesPage .searchBox input,
        .salesPage .filters select {
          color:#273042 !important;
          background:#f9fafb !important;
          font-weight:700 !important;
        }

        .salesPage .filters select {
          border:1px solid #e0e4ea !important;
          border-radius:13px !important;
          box-shadow:none !important;
        }

        .salesPage .searchBox:focus-within,
        .salesPage .filters select:focus {
          border-color:#8a7aae !important;
          box-shadow:0 0 0 3px rgba(101,84,146,.08) !important;
        }

        /* SALE LIST */
        .salesPage .saleList {
          gap:10px !important;
          margin-top:14px !important;
        }

        .salesPage .saleCard {
          position:relative !important;
          overflow:hidden !important;
          border:1px solid #e5e8ed !important;
          border-radius:20px !important;
          background:#fff !important;
          box-shadow:0 8px 22px rgba(32,39,55,.05) !important;
        }

        .salesPage .saleCard::before {
          content:"";
          position:absolute;
          inset:0 auto 0 0;
          width:4px;
          background:#655492;
        }

        .salesPage .saleCard:nth-child(5n+2)::before { background:#4f806f; }
        .salesPage .saleCard:nth-child(5n+3)::before { background:#4d7d89; }
        .salesPage .saleCard:nth-child(5n+4)::before { background:#94617e; }
        .salesPage .saleCard:nth-child(5n+5)::before { background:#9a774a; }

        .salesPage .saleTop {
          padding:17px 18px 11px 21px !important;
        }

        .salesPage .invoice {
          display:inline-flex !important;
          width:max-content !important;
          padding:4px 8px !important;
          border-radius:999px !important;
          background:#f3f1f8 !important;
          color:#655492 !important;
          font-size:8px !important;
          font-weight:950 !important;
          letter-spacing:.45px !important;
        }

        .salesPage .saleTop h2 {
          margin:7px 0 3px !important;
          color:#273042 !important;
          font-size:16px !important;
          font-weight:950 !important;
        }

        .salesPage .saleTop p {
          color:#7a8190 !important;
          font-size:9px !important;
        }

        .salesPage .badge {
          border:1px solid transparent !important;
          border-radius:999px !important;
          padding:5px 9px !important;
          font-size:8px !important;
          font-weight:900 !important;
          box-shadow:none !important;
        }

        .salesPage .badge.cash {
          background:#eef7f3 !important;
          color:#4f806f !important;
          border-color:#d9e9e1 !important;
        }

        .salesPage .badge.upi {
          background:#f3f1f8 !important;
          color:#655492 !important;
          border-color:#e0dced !important;
        }

        .salesPage .badge.card,
        .salesPage .badge.bank_transfer {
          background:#edf5f7 !important;
          color:#4d7d89 !important;
          border-color:#d8e8eb !important;
        }

        .salesPage .badge.credit {
          background:#faf5ec !important;
          color:#9a774a !important;
          border-color:#eee2ce !important;
        }

        .salesPage .badge.completed {
          background:#eef7f3 !important;
          color:#4f806f !important;
          border-color:#d9e9e1 !important;
        }

        .salesPage .badge.cancelled {
          background:#faf0f0 !important;
          color:#956262 !important;
          border-color:#eedada !important;
        }

        .salesPage .amounts {
          margin:0 18px 0 21px !important;
          gap:7px !important;
          padding:12px !important;
          border:1px solid #eceef2 !important;
          border-radius:15px !important;
          background:#fafbfc !important;
        }

        .salesPage .amounts > div {
          padding:8px 10px !important;
          border-radius:11px !important;
          background:#fff !important;
        }

        .salesPage .amounts span {
          color:#7b8190 !important;
          font-size:7px !important;
          font-weight:850 !important;
        }

        .salesPage .amounts strong {
          margin-top:4px !important;
          color:#273042 !important;
          font-size:13px !important;
        }

        .salesPage .amounts .refundAmount {
          background:#faf0f0 !important;
        }

        .salesPage .amounts .refundAmount strong,
        .salesPage .amounts .due strong {
          color:#956262 !important;
        }

        .salesPage .amounts .netSale {
          background:#eef7f3 !important;
        }

        .salesPage .amounts .netSale strong {
          color:#4f806f !important;
        }

        .salesPage .saleCard footer {
          padding:0 18px 15px !important;
        }

        .salesPage .saleCard footer button {
          min-height:39px !important;
          border:0 !important;
          border-radius:12px !important;
          padding:0 14px !important;
          background:linear-gradient(135deg,#4e426d,#476f7a) !important;
          color:#fff !important;
          box-shadow:none !important;
        }

        /* PAGINATION */
        .salesPage .salesPagination {
          margin-top:14px !important;
          border:1px solid #e5e8ed !important;
          border-radius:17px !important;
          background:#fff !important;
          box-shadow:none !important;
        }

        .salesPage .pageSummary {
          color:#747c8b !important;
        }

        .salesPage .pageButtons button {
          border-color:#e0e4ea !important;
          background:#f8f9fb !important;
          color:#4d5668 !important;
          box-shadow:none !important;
        }

        .salesPage .pageButtons button.active {
          border-color:#655492 !important;
          background:#655492 !important;
          color:#fff !important;
        }

        /* EMPTY / ERROR / TOAST */
        .salesPage .message {
          border:1px solid #e5e8ed !important;
          border-radius:20px !important;
          background:#fff !important;
          color:#6f7787 !important;
          box-shadow:none !important;
        }

        .salesPage .message h2 {
          color:#293247 !important;
        }

        .salesPage .toast {
          border:1px solid rgba(255,255,255,.12) !important;
          border-radius:14px !important;
          background:#453453 !important;
          box-shadow:0 14px 34px rgba(19,17,31,.20) !important;
        }

        /* ============================================================
           SALE DETAILS MODAL
           ============================================================ */
        .salesPage .overlay {
          background:rgba(18,15,31,.72) !important;
          backdrop-filter:blur(9px) !important;
        }

        .salesPage .modal {
          border:1px solid rgba(255,255,255,.14) !important;
          border-radius:24px !important;
          background:#fff !important;
          box-shadow:0 28px 80px rgba(12,11,21,.30) !important;
        }

        .salesPage .modal > header {
          background:
            linear-gradient(120deg,#2b1b49 0%,#493578 48%,#31516f 100%) !important;
          color:#fff !important;
        }

        .salesPage .modal > header span {
          color:#d8d1ea !important;
        }

        .salesPage .customerGrid > div {
          border:1px solid #e7e9ee !important;
          border-radius:14px !important;
          background:#f8f9fb !important;
        }

        .salesPage .customerGrid strong {
          color:#273042 !important;
        }

        .salesPage .items article {
          border-bottom-color:#eceef2 !important;
        }

        .salesPage .items b {
          color:#4f806f !important;
        }

        .salesPage .totals {
          border:1px solid #e7e9ee !important;
          border-radius:15px !important;
          background:#fafbfc !important;
        }

        .salesPage .totals .grand {
          border-top-color:#655492 !important;
          color:#655492 !important;
        }

        .salesPage .totals .refundLine {
          color:#956262 !important;
        }

        .salesPage .totals .netLine {
          color:#4f806f !important;
        }

        .salesPage .modalActions button {
          box-shadow:none !important;
        }

        .salesPage .modalActions .close {
          background:#eef0f3 !important;
          color:#4a5261 !important;
        }

        .salesPage .modalActions .editPaymentAction {
          background:#4f806f !important;
        }

        .salesPage .modalActions .returnAction {
          background:#8f7648 !important;
          color:#fff !important;
        }

        .salesPage .modalActions .printAction {
          background:#4e426d !important;
        }

        .salesPage .modalActions .whatsAppAction {
          background:#3f7b62 !important;
        }

        .salesPage .modalActions .deleteAction {
          background:#8b5555 !important;
        }

        /* PAYMENT CORRECTION */
        .salesPage .paymentEditOverlay,
        .salesPage .returnOverlay {
          background:rgba(18,15,31,.76) !important;
          backdrop-filter:blur(10px) !important;
        }

        .salesPage .paymentEditModal,
        .salesPage .returnModal {
          border:1px solid rgba(255,255,255,.13) !important;
          background:#fff !important;
          box-shadow:0 30px 90px rgba(12,11,21,.32) !important;
        }

        .salesPage .paymentEditModal > header,
        .salesPage .returnHeader {
          background:
            linear-gradient(120deg,#2b1b49 0%,#493578 48%,#31516f 100%) !important;
          color:#fff !important;
        }

        .salesPage .paymentEditModal > header span,
        .salesPage .returnHeader span {
          color:#d8d1ea !important;
        }

        .salesPage .paymentCompare > div,
        .salesPage .paymentCorrectionSummary {
          border:1px solid #e7e9ee !important;
          background:#f8f9fb !important;
        }

        .salesPage .paymentCompare strong,
        .salesPage .paymentCorrectionSummary strong {
          color:#273042 !important;
        }

        .salesPage .paymentEditBody select,
        .salesPage .paymentEditBody input,
        .salesPage .returnFormGrid input,
        .salesPage .returnFormGrid select,
        .salesPage .returnFormGrid textarea,
        .salesPage .exchangeSettlementMethod select {
          border-color:#dfe3e9 !important;
          color:#273042 !important;
          background:#fff !important;
        }

        .salesPage .paymentEditBody select:focus,
        .salesPage .paymentEditBody input:focus,
        .salesPage .returnFormGrid input:focus,
        .salesPage .returnFormGrid select:focus,
        .salesPage .returnFormGrid textarea:focus {
          border-color:#77679c !important;
          box-shadow:0 0 0 3px rgba(101,84,146,.08) !important;
        }

        .salesPage .balanceTreatmentGrid button {
          border-color:#e2e5ea !important;
          background:#fff !important;
          color:#273042 !important;
        }

        .salesPage .balanceTreatmentGrid button.active {
          border-color:#8f7648 !important;
          background:#faf6ed !important;
          box-shadow:0 0 0 3px rgba(143,118,72,.08) !important;
        }

        .salesPage .paymentSafetyNote {
          border-color:#eadfca !important;
          background:#faf7f0 !important;
          color:#6e614c !important;
        }

        .salesPage .paymentSave {
          background:linear-gradient(135deg,#4e426d,#476f7a) !important;
          color:#fff !important;
          box-shadow:none !important;
        }

        /* RETURNS / EXCHANGE */
        .salesPage .returnTypeCard {
          border-color:#e4e7ec !important;
          border-radius:15px !important;
          background:#fff !important;
          box-shadow:none !important;
        }

        .salesPage .returnTypeCard:hover {
          transform:translateY(-1px) !important;
          border-color:#8a7aae !important;
          box-shadow:0 8px 18px rgba(32,39,55,.05) !important;
        }

        .salesPage .returnTypeCard.active {
          border-color:#77679c !important;
          background:#f5f3f9 !important;
          box-shadow:none !important;
        }

        .salesPage .returnTypeCard > span {
          background:#f0eef6 !important;
          color:#655492 !important;
        }

        .salesPage .returnTypeCard.active > span {
          background:#655492 !important;
          color:#fff !important;
          animation:none !important;
        }

        .salesPage .returnTypeCard strong,
        .salesPage .returnSectionTitle h3,
        .salesPage .returnItemInfo h4,
        .salesPage .returnQtyControl span {
          color:#273042 !important;
        }

        .salesPage .returnSectionTitle span {
          color:#655492 !important;
        }

        .salesPage .returnSectionTitle > strong {
          color:#4f806f !important;
        }

        .salesPage .returnItem {
          border-color:#e5e8ed !important;
          background:#fff !important;
        }

        .salesPage .returnItem.selected {
          border-color:#b4a9cb !important;
          background:#f8f7fa !important;
          box-shadow:none !important;
        }

        .salesPage .returnItemInfo > strong,
        .salesPage .exchangeLineValue > strong,
        .salesPage .exchangeLineTotal {
          color:#4f806f !important;
        }

        .salesPage .returnQtyControl button {
          background:#f0eef6 !important;
          color:#655492 !important;
        }

        .salesPage .returnQtyControl button:hover:not(:disabled) {
          background:#655492 !important;
          color:#fff !important;
        }

        .salesPage .exchangeDesk {
          border-color:#e3dfeb !important;
          background:#f8f9fb !important;
        }

        .salesPage .exchangeSearchBox {
          border-color:#dfe3e9 !important;
          background:#fff !important;
        }

        .salesPage .exchangeSearchBox > span {
          color:#655492 !important;
        }

        .salesPage .exchangeSearchBox button {
          border:0 !important;
          background:#655492 !important;
          color:#fff !important;
        }

        .salesPage .exchangeProductCard,
        .salesPage .exchangeSelectedList article {
          border-color:#e4e7ec !important;
          background:#fff !important;
          box-shadow:none !important;
        }

        .salesPage .exchangeProductCard:hover {
          transform:translateY(-1px) !important;
          border-color:#8a7aae !important;
          box-shadow:0 7px 16px rgba(32,39,55,.05) !important;
        }

        .salesPage .exchangeProductCard b {
          color:#4f806f !important;
        }

        .salesPage .exchangeProductCard em {
          color:#8f7648 !important;
        }

        .salesPage .exchangeDifference,
        .salesPage .returnSummary .returnTotal {
          background:
            linear-gradient(135deg,#3b2e52,#4a4567 58%,#3e646c) !important;
        }

        .salesPage .exchangeDifference strong,
        .salesPage .returnSummary .returnTotal strong {
          color:#fff !important;
        }

        .salesPage .returnSummary {
          background:#f7f8fa !important;
        }

        .salesPage .returnSummary > div {
          border:1px solid #e5e8ed !important;
          background:#fff !important;
        }

        .salesPage .returnSummary strong {
          color:#273042 !important;
        }

        .salesPage .returnConfirm {
          background:linear-gradient(135deg,#4e426d,#476f7a) !important;
          color:#fff !important;
          box-shadow:none !important;
        }

        .salesPage .returnCancel {
          background:#eef0f3 !important;
          color:#4a5261 !important;
        }

        @media(max-width:700px){
          .salesPage {
            padding:10px !important;
          }

          .salesPage .hero {
            border-radius:21px !important;
            padding:18px 16px !important;
          }

          .salesPage .hero h1 {
            font-size:28px !important;
          }

          .salesPage .hero::after {
            font-size:72px;
            top:-6px;
            right:8px;
          }

          .salesPage .stats article {
            min-height:92px !important;
            border-radius:16px !important;
          }

          .salesPage .saleCard {
            border-radius:17px !important;
          }

          .salesPage .amounts {
            margin-left:16px !important;
            margin-right:16px !important;
          }
        }


        /* ============================================================
           NCS SALES HISTORY — INTERNATIONAL COLORFUL PREMIUM V2
           Match Products V2 visual language:
           richer hero, clearer KPI colors, entrance motion, stronger cards.
           ============================================================ */

        .salesPage {
          background:
            radial-gradient(circle at 4% 0%,rgba(111,78,190,.10),transparent 24%),
            radial-gradient(circle at 96% 5%,rgba(25,155,164,.10),transparent 24%),
            radial-gradient(circle at 55% 100%,rgba(231,166,83,.08),transparent 26%),
            linear-gradient(180deg,#f7f7fb 0%,#f1f4f8 50%,#f8f4ed 100%) !important;
        }

        /* HERO */
        .salesPage .hero {
          min-height:150px !important;
          padding:22px 24px !important;
          background:
            radial-gradient(circle at 82% -15%,rgba(255,215,115,.30),transparent 31%),
            radial-gradient(circle at 12% 115%,rgba(230,86,170,.28),transparent 34%),
            linear-gradient(118deg,#31184f 0%,#5c32a8 35%,#3c6f93 68%,#1f8a7e 100%) !important;
          box-shadow:0 22px 55px rgba(40,31,72,.20) !important;
          animation:ncs-sales-enter .55s cubic-bezier(.2,.8,.2,1) both !important;
        }

        .salesPage .hero::after {
          content:"HISTORY" !important;
          right:20px !important;
          top:50% !important;
          transform:translateY(-50%) !important;
          color:rgba(255,255,255,.05) !important;
          font-size:clamp(62px,7vw,116px) !important;
          letter-spacing:1px !important;
        }

        .salesPage .hero > div > span {
          color:#f4d979 !important;
        }

        .salesPage .hero h1 {
          font-size:38px !important;
          text-shadow:0 2px 12px rgba(0,0,0,.12) !important;
        }

        .salesPage .hero > button {
          border-color:rgba(255,255,255,.28) !important;
          background:rgba(255,255,255,.12) !important;
          box-shadow:0 8px 20px rgba(21,18,42,.12) !important;
        }

        /* KPI CARDS — stronger visible colors */
        .salesPage .stats {
          gap:12px !important;
          animation:ncs-sales-enter .65s .06s cubic-bezier(.2,.8,.2,1) both !important;
        }

        .salesPage .stats article {
          min-height:116px !important;
          border-radius:21px !important;
          border-width:1.5px !important;
          box-shadow:0 12px 28px rgba(39,44,61,.07) !important;
          transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease !important;
        }

        .salesPage .stats article:hover {
          transform:translateY(-4px) scale(1.012) !important;
          box-shadow:0 18px 34px rgba(39,44,61,.12) !important;
        }

        .salesPage .stats article:nth-child(1) {
          background:linear-gradient(135deg,#ede7ff 0%,#f9f7ff 65%,#e8f4ff 100%) !important;
          border-color:#c8baf4 !important;
          color:#6549ba !important;
        }

        .salesPage .stats article:nth-child(2) {
          background:linear-gradient(135deg,#dcf6ec 0%,#f7fffb 64%,#def8f2 100%) !important;
          border-color:#a6dec9 !important;
          color:#27866c !important;
        }

        .salesPage .stats article:nth-child(3) {
          background:linear-gradient(135deg,#dff4f8 0%,#f8fdff 64%,#e7efff 100%) !important;
          border-color:#acd9e1 !important;
          color:#3e7d89 !important;
        }

        .salesPage .stats article:nth-child(4) {
          background:linear-gradient(135deg,#ffe1e8 0%,#fff5f7 65%,#ffe4d8 100%) !important;
          border-color:#efacb9 !important;
          color:#b05269 !important;
        }

        .salesPage .stats article:nth-child(5) {
          background:linear-gradient(135deg,#fff0cd 0%,#fffaf1 65%,#ffe5d4 100%) !important;
          border-color:#efc880 !important;
          color:#b0762b !important;
        }

        .salesPage .stats article strong {
          font-size:27px !important;
          color:#20283a !important;
        }

        .salesPage .stats article span {
          font-size:8.5px !important;
        }

        /* FILTER BAR */
        .salesPage .filters {
          padding:12px !important;
          border-radius:20px !important;
          background:
            linear-gradient(135deg,#fbfbff 0%,#ffffff 48%,#f3fbfb 100%) !important;
          border-color:#dde2ea !important;
          box-shadow:0 10px 24px rgba(39,44,61,.055) !important;
          animation:ncs-sales-enter .72s .10s cubic-bezier(.2,.8,.2,1) both !important;
        }

        .salesPage .searchBox,
        .salesPage .filters select {
          background:#fff !important;
          box-shadow:0 4px 11px rgba(39,44,61,.025) !important;
        }

        .salesPage .searchBox:focus-within,
        .salesPage .filters select:focus {
          border-color:#755fc0 !important;
          box-shadow:0 0 0 4px rgba(117,95,192,.10),0 8px 20px rgba(39,44,61,.05) !important;
        }

        /* SALE CARDS */
        .salesPage .saleList {
          gap:12px !important;
        }

        .salesPage .saleCard {
          border-radius:22px !important;
          border-color:#dde2ea !important;
          box-shadow:0 10px 26px rgba(39,44,61,.06) !important;
          transition:transform .20s ease,box-shadow .20s ease,border-color .20s ease !important;
          animation:ncs-sales-enter .72s .12s cubic-bezier(.2,.8,.2,1) both !important;
        }

        .salesPage .saleCard:hover {
          transform:translateY(-2px) !important;
          box-shadow:0 16px 32px rgba(39,44,61,.095) !important;
          border-color:#cbcfe0 !important;
        }

        .salesPage .saleCard::before {
          width:5px !important;
          background:linear-gradient(180deg,#6748c8,#8a65e5) !important;
        }

        .salesPage .saleCard:nth-child(5n+2)::before {
          background:linear-gradient(180deg,#23876d,#43b691) !important;
        }
        .salesPage .saleCard:nth-child(5n+3)::before {
          background:linear-gradient(180deg,#3f7f8b,#60a5b0) !important;
        }
        .salesPage .saleCard:nth-child(5n+4)::before {
          background:linear-gradient(180deg,#a65984,#d17aa6) !important;
        }
        .salesPage .saleCard:nth-child(5n+5)::before {
          background:linear-gradient(180deg,#b0762b,#dcaa5a) !important;
        }

        .salesPage .invoice {
          background:linear-gradient(135deg,#eee9fb,#f6f3ff) !important;
          border:1px solid #d4c8ef !important;
          color:#6650ad !important;
          box-shadow:0 4px 10px rgba(92,69,160,.06) !important;
        }

        .salesPage .saleTop h2 {
          font-size:17px !important;
        }

        .salesPage .badge {
          border-width:1.5px !important;
        }

        .salesPage .badge.cash,
        .salesPage .badge.completed {
          background:#e8f7f0 !important;
          border-color:#bfe4d4 !important;
          color:#2c8067 !important;
        }

        .salesPage .badge.upi {
          background:#eee9fb !important;
          border-color:#d4c8ef !important;
          color:#6650ad !important;
        }

        .salesPage .badge.card,
        .salesPage .badge.bank_transfer {
          background:#e9f6f8 !important;
          border-color:#c6e4e9 !important;
          color:#3f7f8b !important;
        }

        .salesPage .badge.credit {
          background:#fff4dc !important;
          border-color:#efd49e !important;
          color:#a97429 !important;
        }

        .salesPage .badge.cancelled {
          background:#fff0f2 !important;
          border-color:#edc2c9 !important;
          color:#a74f60 !important;
        }

        /* Amount boxes stronger hierarchy */
        .salesPage .amounts {
          background:linear-gradient(180deg,#fbfcfe,#f7f9fb) !important;
          border-color:#e1e5eb !important;
        }

        .salesPage .amounts > div {
          box-shadow:0 4px 11px rgba(39,44,61,.025) !important;
        }

        .salesPage .amounts .netSale {
          background:#eaf7f1 !important;
          border:1px solid #cae7da !important;
        }

        .salesPage .amounts .refundAmount,
        .salesPage .amounts .due {
          background:#fff1f3 !important;
          border:1px solid #efccd2 !important;
        }

        .salesPage .saleCard footer button {
          background:linear-gradient(135deg,#5c4497,#427887) !important;
          box-shadow:0 7px 16px rgba(52,55,84,.11) !important;
          transition:transform .18s ease,box-shadow .18s ease !important;
        }

        .salesPage .saleCard footer button:hover {
          transform:translateY(-2px) !important;
          box-shadow:0 10px 20px rgba(52,55,84,.15) !important;
        }

        /* MODAL */
        .salesPage .modal,
        .salesPage .paymentEditModal,
        .salesPage .returnModal {
          border-radius:26px !important;
          box-shadow:0 34px 90px rgba(12,11,21,.34) !important;
        }

        .salesPage .modal > header,
        .salesPage .paymentEditModal > header,
        .salesPage .returnHeader {
          background:
            radial-gradient(circle at 90% -10%,rgba(255,215,115,.18),transparent 29%),
            linear-gradient(118deg,#31184f 0%,#5c32a8 45%,#3c6f93 100%) !important;
        }

        .salesPage .modalActions .editPaymentAction {
          background:linear-gradient(135deg,#23876d,#43b691) !important;
        }

        .salesPage .modalActions .returnAction {
          background:linear-gradient(135deg,#b0762b,#dcaa5a) !important;
        }

        .salesPage .modalActions .printAction {
          background:linear-gradient(135deg,#5c4497,#715ab0) !important;
        }

        .salesPage .modalActions .whatsAppAction {
          background:linear-gradient(135deg,#23876d,#3c9b7e) !important;
        }

        .salesPage .modalActions .deleteAction {
          background:linear-gradient(135deg,#a74f60,#cb6677) !important;
        }

        .salesPage .paymentSave,
        .salesPage .returnConfirm {
          background:linear-gradient(135deg,#5c4497,#427887) !important;
          box-shadow:0 8px 18px rgba(52,55,84,.12) !important;
        }

        /* Return / Exchange cards */
        .salesPage .returnTypeCard {
          transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease !important;
        }

        .salesPage .returnTypeCard:hover {
          transform:translateY(-3px) !important;
          box-shadow:0 10px 22px rgba(39,44,61,.07) !important;
        }

        .salesPage .returnTypeCard.active {
          background:linear-gradient(135deg,#eee9fb,#f6f3ff) !important;
          border-color:#c9baf0 !important;
        }

        .salesPage .returnTypeCard.active > span {
          background:linear-gradient(135deg,#6748c8,#8a65e5) !important;
        }

        .salesPage .exchangeSearchBox button {
          background:linear-gradient(135deg,#6748c8,#3f7f8b) !important;
        }

        .salesPage .exchangeDifference,
        .salesPage .returnSummary .returnTotal {
          background:
            radial-gradient(circle at 88% 0%,rgba(255,215,115,.11),transparent 28%),
            linear-gradient(118deg,#31184f,#5c32a8 50%,#3c6f93) !important;
        }

        /* Entrance motion */
        @keyframes ncs-sales-enter {
          from { opacity:0; transform:translateY(14px); }
          to { opacity:1; transform:translateY(0); }
        }

        @media(prefers-reduced-motion:reduce){
          .salesPage .hero,
          .salesPage .stats,
          .salesPage .filters,
          .salesPage .saleCard {
            animation:none !important;
          }
        }

        @media(max-width:700px){
          .salesPage .hero {
            min-height:auto !important;
          }

          .salesPage .hero h1 {
            font-size:30px !important;
          }

          .salesPage .stats article {
            min-height:100px !important;
          }
        }

      `}</style>
    </main>
  );
}
