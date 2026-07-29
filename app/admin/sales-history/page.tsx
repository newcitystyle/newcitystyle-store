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
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState("all");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [selected, setSelected] = useState<SaleDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [notice, setNotice] = useState("");

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

    const { data, error } = await supabase
      .from("pos_sales")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setErrorText(error.message || "Unable to load sales.");
      setSales([]);
    } else {
      setSales((data || []) as unknown as Sale[]);
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

  const stats = useMemo(() => {
    return filtered.reduce(
      (a, sale) => {
        if (norm(sale.sale_status) !== "cancelled") {
          a.value += num(sale.total_amount);
          a.paid += num(sale.paid_amount);
          a.due += num(sale.due_amount);
        }
        if (today(sale.created_at)) a.today += 1;
        return a;
      },
      { bills: filtered.length, value: 0, paid: 0, due: 0, today: 0 }
    );
  }, [filtered]);

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

    if (!query) return availableItems.slice(0, 20);

    return availableItems
      .filter((item) =>
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
      )
      .slice(0, 20);
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
            } ${money(result.difference_amount || 0)}.`
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
              ? "returned"
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
          <div class="line grand"><span>Total</span><b>${money(sale.total_amount)}</b></div>
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
        <section className="saleList">
          {filtered.map((sale) => {
            const due = num(sale.due_amount);
            const cancelled = norm(sale.sale_status) === "cancelled";

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
                  <div><span>Total</span><strong>{money(sale.total_amount)}</strong></div>
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
              <p className="grand"><span>Total</span><strong>{money(selected.total_amount)}</strong></p>
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
            </div>
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
                    placeholder="Search barcode, product, SKU, size or colour..."
                  />
                  <button
                    type="button"
                    onClick={loadExchangeInventory}
                    disabled={exchangeInventoryLoading}
                  >
                    {exchangeInventoryLoading ? "…" : "↻"}
                  </button>
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

                        <label>
                          <span>Exchange Price</span>
                          <input
                            type="number"
                            min="0"
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

                        <strong className="exchangeLineTotal">
                          {money(item.exchangePrice * item.quantity)}
                        </strong>

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
                        ? "Collect From Customer"
                        : exchangeDirection === "refund"
                          ? "Refund Customer"
                          : "Equal Exchange"}
                    </span>
                    <strong>{money(Math.abs(exchangeDifference))}</strong>
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
                <span>Return Value</span>
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
        .modalActions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px;padding:0 18px 18px}.modalActions button{min-height:46px;border:0;border-radius:12px;padding:12px 17px;background:${BLUE};color:#fff;font-weight:900;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease,filter .2s ease}.modalActions button:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 28px rgba(10,46,115,.18);filter:brightness(1.05)}.modalActions button:disabled{opacity:.45;cursor:not-allowed}.modalActions .close{background:#e9edf4;color:#2C2C2C}.modalActions .returnAction{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,${GOLD},#f3d66f);color:${DEEP};box-shadow:0 10px 24px rgba(212,175,55,.22)}.returnActionIcon{font-size:18px;animation:returnPulse 1.8s ease-in-out infinite}.modalActions .printAction{background:linear-gradient(135deg,${DEEP},${BLUE})}
        
        .returnOverlay{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,21,63,.78);backdrop-filter:blur(11px)}
        .returnModal{width:min(940px,100%);max-height:94vh;overflow:auto;border:1px solid rgba(212,175,55,.32);border-radius:26px;background:#fff;box-shadow:0 35px 100px rgba(0,0,0,.38);animation:returnModalEnter .26s ease-out}
        .returnHeader{display:flex;justify-content:space-between;gap:18px;padding:24px 26px;background:radial-gradient(circle at 86% 0%,rgba(212,175,55,.22),transparent 32%),linear-gradient(135deg,${DEEP},${BLUE});color:#fff}
        .returnHeader span{color:${GOLD};font-size:10px;font-weight:950;letter-spacing:1.5px}.returnHeader h2{margin:6px 0 4px;font-size:30px}.returnHeader p{margin:0;color:rgba(255,255,255,.68);font-size:11px}.returnHeader button{width:42px;height:42px;border:1px solid rgba(255,255,255,.22);border-radius:12px;background:rgba(255,255,255,.08);color:#fff;font-size:24px;cursor:pointer}
        .returnTypeGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:18px 20px 4px}.returnTypeCard{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:15px;border:1px solid #e5e9f0;border-radius:16px;background:#fff;color:#5f6878;text-align:left;cursor:pointer;transition:.22s ease}.returnTypeCard:hover{transform:translateY(-3px);border-color:${GOLD};box-shadow:0 14px 30px rgba(10,46,115,.09)}.returnTypeCard.active{border-color:${BLUE};background:linear-gradient(145deg,#f9fbff,#eef3fb);box-shadow:0 12px 30px rgba(10,46,115,.12)}.returnTypeCard>span{width:38px;height:38px;display:flex;align-items:center;justify-content:center;margin-bottom:4px;border-radius:12px;background:#eef2f8;color:${BLUE};font-size:20px;font-weight:950}.returnTypeCard.active>span{background:${GOLD};color:${DEEP};animation:returnGlow 1.8s ease-in-out infinite}.returnTypeCard strong{color:${DEEP};font-size:13px}.returnTypeCard small{font-size:9px}
        .returnItems{padding:18px 20px}.returnSectionTitle{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:10px}.returnSectionTitle span{color:${GOLD};font-size:9px;font-weight:950;letter-spacing:1px}.returnSectionTitle h3{margin:3px 0 0;color:${DEEP};font-size:17px}.returnSectionTitle>strong{color:${BLUE};font-size:21px}
        .returnItem{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:14px;align-items:center;margin-bottom:9px;padding:14px;border:1px solid #e8ebf1;border-radius:16px;background:#fff;transition:.2s ease}.returnItem.selected{border-color:rgba(10,46,115,.35);background:linear-gradient(135deg,#fff,#f6f9ff);box-shadow:0 10px 26px rgba(10,46,115,.08)}.returnItemBadge{display:inline-flex;padding:5px 8px;border-radius:20px;background:#edf7f1;color:#167842;font-size:8px;font-weight:900}.returnItemInfo h4{margin:6px 0 2px;color:${DEEP};font-size:13px}.returnItemInfo p{margin:0;color:#89909c;font-size:9px}.returnItemInfo>strong{display:block;margin-top:5px;color:${BLUE};font-size:13px}.returnActualPaidLabel{display:block;margin-top:2px;color:#8a91a0;font-size:7px;font-weight:750;text-transform:uppercase}
        .returnQtyControl{display:flex;align-items:center;gap:9px}.returnQtyControl button{width:34px;height:34px;border:0;border-radius:10px;background:#eef2f8;color:${BLUE};font-size:20px;font-weight:900;cursor:pointer;transition:.18s ease}.returnQtyControl button:hover:not(:disabled){transform:scale(1.08);background:${BLUE};color:#fff}.returnQtyControl button:disabled{opacity:.35;cursor:not-allowed}.returnQtyControl span{min-width:26px;text-align:center;color:${DEEP};font-weight:950}
        .restockToggle{display:flex;align-items:center;gap:7px;color:#5f6878;font-size:9px;font-weight:850}.restockToggle input{display:none}.restockToggle>span{position:relative;width:36px;height:20px;border-radius:30px;background:#d9dee8;transition:.2s ease}.restockToggle>span:after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2);transition:.2s ease}.restockToggle input:checked+span{background:#1f9d55}.restockToggle input:checked+span:after{transform:translateX(16px)}
        .exchangeDesk{margin:0 20px 18px;padding:16px;border:1px solid rgba(212,175,55,.26);border-radius:18px;background:linear-gradient(180deg,#fbfcff,#f5f8fd)}
        .exchangeSearchBox{display:flex;align-items:center;gap:9px;padding:0 11px;border:1px solid #dfe4ed;border-radius:12px;background:#fff}.exchangeSearchBox>span{color:${BLUE};font-size:21px}.exchangeSearchBox input{width:100%;height:44px;border:0;outline:0;font:inherit;font-size:11px}.exchangeSearchBox button{width:34px;height:34px;border:1px solid rgba(212,175,55,.5);border-radius:9px;background:${GOLD};color:${DEEP};font-weight:950;cursor:pointer}
        .exchangeProductGrid{max-height:235px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px;overflow:auto}.exchangeProductCard{display:flex;flex-direction:column;align-items:flex-start;min-width:0;padding:12px;border:1px solid #e3e8f0;border-radius:13px;background:#fff;text-align:left;cursor:pointer;transition:.18s ease}.exchangeProductCard:hover{transform:translateY(-2px);border-color:${GOLD};box-shadow:0 10px 22px rgba(3,21,63,.09)}.exchangeProductCard>span{padding:4px 7px;border-radius:20px;background:#eaf7ef;color:#167842;font-size:7px;font-weight:900}.exchangeProductCard strong{max-width:100%;margin-top:7px;overflow:hidden;color:${DEEP};font-size:11px;text-overflow:ellipsis;white-space:nowrap}.exchangeProductCard small{max-width:100%;margin-top:3px;overflow:hidden;color:#858d9b;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.exchangeProductCard b{margin-top:7px;color:${BLUE};font-size:12px}.exchangeProductCard em{margin-top:5px;color:${GOLD};font-size:8px;font-style:normal;font-weight:900}
        .exchangeEmpty{margin-top:10px;padding:20px;border:1px dashed #cfd6e2;border-radius:13px;color:#7f8795;font-size:10px;text-align:center}.exchangeSelectedList{display:grid;gap:8px;margin-top:11px}.exchangeSelectedList article{display:grid;grid-template-columns:minmax(0,1fr) 78px 130px auto 34px;gap:9px;align-items:end;padding:11px;border:1px solid #e3e8f0;border-radius:13px;background:#fff}.exchangeSelectedInfo{min-width:0}.exchangeSelectedInfo strong,.exchangeSelectedInfo small,.exchangeSelectedInfo span{display:block}.exchangeSelectedInfo strong{overflow:hidden;color:${DEEP};font-size:11px;text-overflow:ellipsis;white-space:nowrap}.exchangeSelectedInfo small{margin-top:3px;color:#818997;font-size:8px}.exchangeSelectedInfo span{margin-top:4px;color:#167842;font-size:7px;font-weight:850}.exchangeSelectedList label>span{display:block;margin-bottom:4px;color:#7c8492;font-size:7px;font-weight:850;text-transform:uppercase}.exchangeSelectedList input{width:100%;height:36px;border:1px solid #dfe4ed;border-radius:9px;padding:0 8px;font:inherit;font-size:10px}.exchangeLineTotal{align-self:center;color:${BLUE};font-size:11px;white-space:nowrap}.exchangeRemove{width:32px;height:32px;border:0;border-radius:9px;background:#ffe9e9;color:#b43232;font-size:18px;font-weight:900;cursor:pointer}
        .exchangeSettlement{display:grid;grid-template-columns:1fr 1fr 1.25fr;gap:8px;margin-top:12px}.exchangeSettlement>div{padding:11px;border-radius:12px;background:#fff}.exchangeSettlement span{display:block;color:#8a91a0;font-size:7px;font-weight:850;text-transform:uppercase}.exchangeSettlement strong{display:block;margin-top:4px;color:${DEEP};font-size:12px}.exchangeDifference{background:linear-gradient(135deg,${DEEP},${BLUE})!important}.exchangeDifference span{color:rgba(255,255,255,.65)}.exchangeDifference strong{color:${GOLD};font-size:17px}.exchangeDifference.refund strong{color:#8ff0b4}.exchangeSettlementMethod{display:block;margin-top:11px}.exchangeSettlementMethod>span{display:block;margin-bottom:5px;color:#707887;font-size:8px;font-weight:850;text-transform:uppercase}.exchangeSettlementMethod select{width:100%;height:42px;border:1px solid #dfe4ed;border-radius:11px;background:#fff;padding:0 11px;font:inherit;font-size:10px}
        .returnFormGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 20px 18px}.returnFormGrid label{display:block}.returnFormGrid label>span{display:block;margin-bottom:6px;color:#707887;font-size:9px;font-weight:850;text-transform:uppercase}.returnFormGrid input,.returnFormGrid select,.returnFormGrid textarea{width:100%;border:1px solid #dfe4ed;border-radius:12px;background:#fff;padding:12px;font:inherit;font-size:11px;outline:none}.returnFormGrid input:focus,.returnFormGrid select:focus,.returnFormGrid textarea:focus{border-color:${BLUE};box-shadow:0 0 0 3px rgba(10,46,115,.08)}.returnFormGrid .fullWidth{grid-column:1/-1}
        .returnSummary{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:10px;margin:0 20px 18px;padding:14px;border-radius:16px;background:#f6f8fc}.returnSummary>div{padding:10px;border-radius:12px;background:#fff}.returnSummary span{display:block;color:#8a91a0;font-size:8px;font-weight:850;text-transform:uppercase}.returnSummary strong{display:block;margin-top:4px;color:${DEEP};font-size:13px}.returnSummary .returnTotal{background:linear-gradient(135deg,${DEEP},${BLUE})}.returnSummary .returnTotal span{color:rgba(255,255,255,.66)}.returnSummary .returnTotal strong{color:${GOLD};font-size:19px}
        .returnFooter{display:flex;justify-content:flex-end;gap:10px;padding:0 20px 20px}.returnFooter button{min-height:48px;border:0;border-radius:13px;padding:0 18px;font:inherit;font-size:11px;font-weight:900;cursor:pointer;transition:.2s ease}.returnFooter button:hover:not(:disabled){transform:translateY(-2px)}.returnFooter button:disabled{opacity:.5;cursor:not-allowed}.returnCancel{background:#e9edf4;color:#3e4653}.returnConfirm{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:190px;background:linear-gradient(135deg,${GOLD},#f0cf62);color:${DEEP};box-shadow:0 12px 28px rgba(212,175,55,.26)}.returnConfirm>span{font-size:17px}
        @keyframes returnModalEnter{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes returnPulse{0%,100%{transform:translateX(0)}50%{transform:translateX(-3px)}}@keyframes returnGlow{0%,100%{box-shadow:0 0 0 0 rgba(212,175,55,.25)}50%{box-shadow:0 0 0 8px rgba(212,175,55,0)}}@keyframes salesStatRise{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes salesStatShine{0%,62%{left:-42%;opacity:0}68%{opacity:.7}100%{left:126%;opacity:0}}
@media(max-width:1100px){.stats{grid-template-columns:repeat(3,1fr)}.filters{grid-template-columns:1fr 1fr}.searchBox{grid-column:1/-1}}
        @media(max-width:700px){.salesPage{padding:12px}.hero{align-items:flex-start}.hero h1{font-size:29px}.stats{grid-template-columns:1fr 1fr}.filters{grid-template-columns:1fr}.searchBox{grid-column:auto}.saleTop{display:block}.badges{margin-top:12px}.amounts{grid-template-columns:1fr 1fr}.customerGrid{grid-template-columns:1fr}.items article{grid-template-columns:1fr auto}.items b{grid-column:2}.returnOverlay{padding:8px}.returnModal{max-height:97vh;border-radius:20px}.returnTypeGrid{grid-template-columns:1fr}.returnItem{grid-template-columns:1fr}.returnQtyControl{justify-content:flex-start}.returnFormGrid{grid-template-columns:1fr}.returnFormGrid .fullWidth{grid-column:auto}.returnSummary{grid-template-columns:1fr}.exchangeProductGrid{grid-template-columns:1fr}.exchangeSelectedList article{grid-template-columns:1fr 1fr}.exchangeSelectedInfo{grid-column:1/-1}.exchangeLineTotal{align-self:center}.exchangeSettlement{grid-template-columns:1fr}.returnFooter{display:grid;grid-template-columns:1fr}.returnFooter button{width:100%}}
      `}</style>
    </main>
  );
}