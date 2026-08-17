"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string | number;
  name?: string | null;
  product_name?: string | null;
  title?: string | null;
  price?: number | string | null;
  stock?: number | string | null;
  category?: string | null;
  created_at?: string | null;
};

type ProductVariant = {
  id: number;
  product_id: number;
  stock?: number | string | null;
  reserved_stock?: number | string | null;
  is_active?: boolean | null;
};

type OrderItem = {
  name?: string;
  quantity?: number | string;
  price?: number | string;
  item_total?: number | string;
};

type Order = {
  id: string | number;
  created_at?: string | null;
  customer_name?: string | null;
  email?: string | null;
  phone?: string | null;
  total_amount?: number | string | null;
  order_status?: string | null;
  status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  items?: OrderItem[] | string | null;
};

type WebsiteVisit = {
  id: string | number;
  visitor_id?: string | null;
  page_path?: string | null;
  visited_at?: string | null;
};

type PosSale = {
  id: string;
  invoice_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  sale_status?: string | null;
  payment_method?: string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  is_deleted?: boolean | null;
  created_at?: string | null;
};

type Expense = {
  id: string;
  expense_date: string;
  category_name?: string | null;
  amount?: number | string | null;
  payment_method?: string | null;
  is_deleted?: boolean | null;
};

type CreditAccount = {
  id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  current_balance?: number | string | null;
  next_due_date?: string | null;
  is_active?: boolean | null;
};

type Supplier = {
  id: number;
  supplier_name?: string | null;
  phone?: string | null;
  current_balance?: number | string | null;
  is_active?: boolean | null;
};

type Purchase = {
  id: string;
  purchase_number?: string | null;
  supplier_name?: string | null;
  purchase_date?: string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  purchase_status?: string | null;
  deleted_at?: string | null;
};

type CashBankTransaction = {
  id: string;
  transaction_date: string;
  account_type?: string | null;
  direction?: "in" | "out" | null;
  amount?: number | string | null;
  is_deleted?: boolean | null;
};

type ExchangeSettlement = {
  id: string;
  sale_id?: string | null;
  returned_value?: number | string | null;
  exchange_value?: number | string | null;
  difference_amount?: number | string | null;
  settlement_direction?: "collect" | "refund" | "even" | string | null;
  settlement_method?: string | null;
  settlement_status?: string | null;
  created_at?: string | null;
};

type PosRefund = {
  id: number | string;
  sale_id?: string | null;
  refund_method?: string | null;
  amount?: number | string | null;
  refund_status?: string | null;
  refunded_at?: string | null;
  created_at?: string | null;
};

type DashboardStats = {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  websiteRevenue: number;
  pendingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  lowStockProducts: number;
};

type GoogleBusinessStatus = {
  connected: boolean;
  googleApiReady: boolean;
  loading: boolean;
  refreshing: boolean;
  status?: number | null;
  error?: string | null;
  accountCount?: number;
  rating?: number | null;
  totalReviews?: number | null;
};


type ProfitVariantSummaryRow = {
  variant_id: number;
  product_id: number;
  current_stock: number | null;
  weighted_purchase_cost: number | null;
  sold_30d: number | null;
  revenue_30d: number | null;
  money_blocked: number | null;
};

type ProfitVariantIdentityRow = {
  id: number;
  product_id: number;
  variant_name?: string | null;
  sku?: string | null;
};

type ProfitProductIdentityRow = {
  id: number;
  sku?: string | null;
};

type TodayOwnerProfitAlertRow = {
  id: number;
  alert_type: "LOW_PROFIT" | "LOSS_SALE" | "BILL_PROFIT_SUMMARY" | string;
  invoice_number?: string | null;
  registered_revenue?: number | string | null;
  registered_purchase_cost?: number | string | null;
  bill_profit?: number | string | null;
  profit_per_unit?: number | string | null;
  margin_percent?: number | string | null;
  final_bill_amount?: number | string | null;
  created_at?: string | null;
};

type VisitorStats = {
  todayVisitors: number;
  sevenDayVisitors: number;
  thirtyDayVisitors: number;
  totalUniqueVisitors: number;
  totalPageViews: number;
};

type SalesPoint = {
  key: string;
  label: string;
  amount: number;
};

const ROYAL_BLUE = "#6D4DFF";
const DEEP_BLUE = "#24114A";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number, digits = 0) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: digits,
  }).format(value);
}

function getProductName(product: Product) {
  return (
    product.name ||
    product.product_name ||
    product.title ||
    "Untitled Product"
  );
}

function getOrderStatus(order: Order) {
  return order.order_status || order.status || "Pending";
}

function parseOrderItems(order: Order): OrderItem[] {
  if (!order.items) return [];
  if (Array.isArray(order.items)) return order.items;

  try {
    const parsed = JSON.parse(order.items);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(value?: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function startOfLocalDay(date = new Date()) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

function startOfMonth(date = new Date()) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
    0,
    0,
    0,
    0,
  );
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function isSuccessfulSale(sale: PosSale) {
  if (sale.is_deleted === true) {
    return false;
  }

  const status = (sale.sale_status || "completed")
    .trim()
    .toLowerCase();

  return ![
    "cancelled",
    "void",
    "refunded",
    "deleted",
  ].includes(status);
}

function salePaidAmount(sale: PosSale) {
  const total = Math.max(0, toNumber(sale.total_amount));
  const paid = toNumber(sale.paid_amount);
  return Math.max(0, paid || total);
}

function getUniqueVisitorCount(
  visits: WebsiteVisit[],
  startDate?: Date,
) {
  const ids = visits
    .filter((visit) => {
      if (!startDate) return true;
      if (!visit.visited_at) return false;
      const visitDate = new Date(visit.visited_at);
      return (
        !Number.isNaN(visitDate.getTime()) &&
        visitDate >= startDate
      );
    })
    .map((visit) => visit.visitor_id)
    .filter(
      (id): id is string =>
        typeof id === "string" &&
        id.trim().length > 0,
    );

  return new Set(ids).size;
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [visits, setVisits] = useState<WebsiteVisit[]>([]);
  const [posSales, setPosSales] = useState<PosSale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [creditAccounts, setCreditAccounts] = useState<CreditAccount[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [cashTransactions, setCashTransactions] =
    useState<CashBankTransaction[]>([]);
  const [exchangeSettlements, setExchangeSettlements] =
    useState<ExchangeSettlement[]>([]);
  const [posRefunds, setPosRefunds] = useState<PosRefund[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [visitorError, setVisitorError] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [salesRange, setSalesRange] = useState<7 | 14 | 30>(7);
  const [googleBusiness, setGoogleBusiness] =
    useState<GoogleBusinessStatus>({
      connected: false,
      googleApiReady: false,
      loading: true,
      refreshing: false,
      status: null,
      error: null,
      accountCount: 0,
      rating: null,
      totalReviews: null,
    });

  const [profitVariantRows, setProfitVariantRows] = useState<ProfitVariantSummaryRow[]>([]);
  const [profitVariantIdentityRows, setProfitVariantIdentityRows] = useState<ProfitVariantIdentityRow[]>([]);
  const [profitProductIdentityRows, setProfitProductIdentityRows] = useState<ProfitProductIdentityRow[]>([]);
  const [profitSummaryLoading, setProfitSummaryLoading] = useState(true);
  const [todayOwnerProfitRows, setTodayOwnerProfitRows] =
    useState<TodayOwnerProfitAlertRow[]>([]);
  const [todayOwnerProfitLoading, setTodayOwnerProfitLoading] =
    useState(true);


  const loadGoogleBusinessStatus = useCallback(
    async (showRefresh = false) => {
      setGoogleBusiness((current) => ({
        ...current,
        loading: showRefresh ? current.loading : true,
        refreshing: showRefresh,
      }));

      try {
        const response = await fetch("/api/google-business/status", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        setGoogleBusiness((current) => ({
          ...current,
          connected: Boolean(data?.connected),
          googleApiReady: Boolean(data?.googleApiReady),
          loading: false,
          refreshing: false,
          status: Number.isFinite(Number(data?.status))
            ? Number(data.status)
            : response.status,
          error: typeof data?.error === "string" ? data.error : null,
          accountCount:
            typeof data?.accountCount === "number" ? data.accountCount : 0,
          rating: typeof data?.rating === "number" ? data.rating : null,
          totalReviews:
            typeof data?.totalReviews === "number"
              ? data.totalReviews
              : null,
        }));
      } catch (error) {
        console.error("Unable to load Google Business status:", error);

        setGoogleBusiness((current) => ({
          ...current,
          loading: false,
          refreshing: false,
          error: "Unable to check Google Business connection.",
        }));
      }
    },
    [],
  );

  const loadProfitSummary = useCallback(async () => {
    setProfitSummaryLoading(true);

    try {
      const [intelligenceResult, variantIdentityResult, productIdentityResult] =
        await Promise.all([
          supabase
            .from("ncs_variant_intelligence_v2")
            .select(
              "variant_id,product_id,current_stock,weighted_purchase_cost,sold_30d,revenue_30d,money_blocked",
            )
            .limit(1000),
          supabase
            .from("product_variants")
            .select("id,product_id,variant_name,sku")
            .limit(5000),
          supabase
            .from("products")
            .select("id,sku")
            .limit(5000),
        ]);

      if (intelligenceResult.error) throw intelligenceResult.error;
      if (variantIdentityResult.error) throw variantIdentityResult.error;
      if (productIdentityResult.error) throw productIdentityResult.error;

      setProfitVariantRows(
        (intelligenceResult.data || []) as ProfitVariantSummaryRow[],
      );
      setProfitVariantIdentityRows(
        (variantIdentityResult.data || []) as ProfitVariantIdentityRow[],
      );
      setProfitProductIdentityRows(
        (productIdentityResult.data || []) as ProfitProductIdentityRow[],
      );
    } catch (error) {
      console.info("Unable to load Profit Intelligence summary:", error);
      setProfitVariantRows([]);
      setProfitVariantIdentityRows([]);
      setProfitProductIdentityRows([]);
    } finally {
      setProfitSummaryLoading(false);
    }
  }, []);


  const loadTodayOwnerProfit = useCallback(async () => {
    setTodayOwnerProfitLoading(true);

    try {
      const todayIso = startOfLocalDay().toISOString();

      const { data, error } = await supabase
        .from("owner_profit_alerts")
        .select(
          "id,alert_type,invoice_number,registered_revenue,registered_purchase_cost,bill_profit,profit_per_unit,margin_percent,final_bill_amount,created_at",
        )
        .gte("created_at", todayIso)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;

      setTodayOwnerProfitRows(
        (data || []) as TodayOwnerProfitAlertRow[],
      );
    } catch (error) {
      console.info(
        "Unable to load today's owner profit snapshot:",
        error,
      );
      setTodayOwnerProfitRows([]);
    } finally {
      setTodayOwnerProfitLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      setErrorMessage("");
      setVisitorError("");

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

        setAdminEmail(user.email || "");

        const [
          productsResult,
          variantsResult,
          ordersResult,
          visitsResult,
          posSalesResult,
          expensesResult,
          creditResult,
          suppliersResult,
          purchasesResult,
          cashTransactionsResult,
          exchangeSettlementsResult,
          posRefundsResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select("*")
            .order("created_at", { ascending: false }),

          supabase
            .from("product_variants")
            .select(
              "id,product_id,stock,reserved_stock,is_active",
            )
            .eq("is_active", true),

          supabase
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false }),

          supabase
            .from("website_visits")
            .select("id,visitor_id,page_path,visited_at")
            .order("visited_at", { ascending: false })
            .limit(10000),

          supabase
            .from("pos_sales")
            .select(
              "id,invoice_number,customer_name,customer_phone,sale_status,payment_method,total_amount,paid_amount,due_amount,is_deleted,created_at",
            )
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .limit(5000),

          supabase
            .from("expenses")
            .select(
              "id,expense_date,category_name,amount,payment_method,is_deleted",
            )
            .eq("is_deleted", false)
            .order("expense_date", { ascending: false })
            .limit(5000),

          supabase
            .from("customer_credit_accounts")
            .select(
              "id,customer_name,customer_phone,current_balance,next_due_date,is_active",
            )
            .eq("is_active", true)
            .order("current_balance", { ascending: false }),

          supabase
            .from("suppliers")
            .select(
              "id,supplier_name,phone,current_balance,is_active",
            )
            .eq("is_active", true)
            .order("current_balance", { ascending: false }),

          supabase
            .from("purchases")
            .select(
              "id,purchase_number,supplier_name,purchase_date,total_amount,paid_amount,due_amount,purchase_status,deleted_at",
            )
            .is("deleted_at", null)
            .order("purchase_date", { ascending: false })
            .limit(5000),

          supabase
            .from("cash_bank_transactions")
            .select(
              "id,transaction_date,account_type,direction,amount,is_deleted",
            )
            .eq("is_deleted", false)
            .order("transaction_date", { ascending: false })
            .limit(5000),

          supabase
            .from("pos_exchange_settlements")
            .select(
              "id,sale_id,returned_value,exchange_value,difference_amount,settlement_direction,settlement_method,settlement_status,created_at",
            )
            .order("created_at", { ascending: false })
            .limit(5000),

          supabase
            .from("pos_refunds")
            .select(
              "id,sale_id,refund_method,amount,refund_status,refunded_at,created_at",
            )
            .order("created_at", { ascending: false })
            .limit(5000),
        ]);

        if (productsResult.error) throw productsResult.error;
        if (ordersResult.error) throw ordersResult.error;
        if (posSalesResult.error) throw posSalesResult.error;
        if (expensesResult.error) throw expensesResult.error;
        if (creditResult.error) throw creditResult.error;
        if (suppliersResult.error) throw suppliersResult.error;
        if (purchasesResult.error) throw purchasesResult.error;
        if (cashTransactionsResult.error) {
          console.info(
            "Cash book manual entries are unavailable:",
            cashTransactionsResult.error.message,
          );
        }
        if (exchangeSettlementsResult.error) {
          console.info(
            "Exchange settlements are unavailable:",
            exchangeSettlementsResult.error.message,
          );
        }
        if (posRefundsResult.error) {
          console.info(
            "POS refunds are unavailable:",
            posRefundsResult.error.message,
          );
        }

        setProducts((productsResult.data || []) as Product[]);
        setVariants(
          variantsResult.error
            ? []
            : ((variantsResult.data || []) as ProductVariant[]),
        );
        setOrders((ordersResult.data || []) as Order[]);
        setPosSales((posSalesResult.data || []) as PosSale[]);
        setExpenses((expensesResult.data || []) as Expense[]);
        setCreditAccounts(
          (creditResult.data || []) as CreditAccount[],
        );
        setSuppliers((suppliersResult.data || []) as Supplier[]);
        setPurchases((purchasesResult.data || []) as Purchase[]);
        setCashTransactions(
          cashTransactionsResult.error
            ? []
            : ((cashTransactionsResult.data ||
                []) as CashBankTransaction[]),
        );
        setExchangeSettlements(
          exchangeSettlementsResult.error
            ? []
            : ((exchangeSettlementsResult.data ||
                []) as ExchangeSettlement[]),
        );
        setPosRefunds(
          posRefundsResult.error
            ? []
            : ((posRefundsResult.data || []) as PosRefund[]),
        );

        if (visitsResult.error) {
          console.error(
            "Website visitors load error:",
            visitsResult.error,
          );
          setVisitorError(
            "Visitor information could not be loaded. Check website_visits table policies.",
          );
          setVisits([]);
        } else {
          setVisits(
            (visitsResult.data || []) as WebsiteVisit[],
          );
        }
      } catch (error) {
        console.error("Admin dashboard load error:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load dashboard data.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadDashboard();
    void loadGoogleBusinessStatus();
    void loadProfitSummary();
    void loadTodayOwnerProfit();
  }, [
    loadDashboard,
    loadGoogleBusinessStatus,
    loadProfitSummary,
    loadTodayOwnerProfit,
  ]);

  const todayStart = startOfLocalDay();
  const monthStart = startOfMonth();
  const sevenDaysStart = new Date(todayStart);
  sevenDaysStart.setDate(sevenDaysStart.getDate() - 6);
  const thirtyDaysStart = new Date(todayStart);
  thirtyDaysStart.setDate(thirtyDaysStart.getDate() - 29);

  const successfulPosSales = useMemo(
    () => posSales.filter(isSuccessfulSale),
    [posSales],
  );

  const business = useMemo(() => {
    const todaySalesRows = successfulPosSales.filter((sale) => {
      if (!sale.created_at) return false;
      const date = new Date(sale.created_at);
      return !Number.isNaN(date.getTime()) && date >= todayStart;
    });

    const monthSalesRows = successfulPosSales.filter((sale) => {
      if (!sale.created_at) return false;
      const date = new Date(sale.created_at);
      return !Number.isNaN(date.getTime()) && date >= monthStart;
    });

    const activeRefunds = posRefunds.filter(
      (row) =>
        (row.refund_status || "completed").trim().toLowerCase() ===
        "completed",
    );

    const todayRefundRows = activeRefunds.filter((row) => {
      const sourceDate = row.refunded_at || row.created_at;
      if (!sourceDate) return false;
      const date = new Date(sourceDate);
      return (
        !Number.isNaN(date.getTime()) &&
        dateKey(date) === dateKey(todayStart)
      );
    });

    const monthRefundRows = activeRefunds.filter((row) => {
      const sourceDate = row.refunded_at || row.created_at;
      if (!sourceDate) return false;
      const date = new Date(sourceDate);
      return !Number.isNaN(date.getTime()) && date >= monthStart;
    });

    const refundTotal = (rows: PosRefund[]) =>
      rows.reduce(
        (sum, row) => sum + Math.max(0, toNumber(row.amount)),
        0,
      );

    const refundByMethod = (rows: PosRefund[], methods: string[]) =>
      rows.reduce((sum, row) => {
        const method = (row.refund_method || "").trim().toLowerCase();
        return methods.includes(method)
          ? sum + Math.max(0, toNumber(row.amount))
          : sum;
      }, 0);

    const activeExchangeSettlements = exchangeSettlements.filter(
      (row) =>
        (row.settlement_status || "completed")
          .trim()
          .toLowerCase() !== "cancelled",
    );

    const todayExchangeRows = activeExchangeSettlements.filter((row) => {
      if (!row.created_at) return false;
      const date = new Date(row.created_at);
      return !Number.isNaN(date.getTime()) && date >= todayStart;
    });

    const monthExchangeRows = activeExchangeSettlements.filter((row) => {
      if (!row.created_at) return false;
      const date = new Date(row.created_at);
      return !Number.isNaN(date.getTime()) && date >= monthStart;
    });

    const exchangeNet = (rows: ExchangeSettlement[]) =>
      rows.reduce((sum, row) => {
        const amount = Math.max(0, toNumber(row.difference_amount));
        const direction = (row.settlement_direction || "")
          .trim()
          .toLowerCase();

        if (direction === "collect") return sum + amount;
        if (direction === "refund") return sum - amount;
        return sum;
      }, 0);

    const exchangeMoneyByMethod = (
      rows: ExchangeSettlement[],
      methods: string[],
    ) =>
      rows.reduce((sum, row) => {
        const method = (row.settlement_method || "")
          .trim()
          .toLowerCase();

        if (!methods.includes(method)) return sum;

        const amount = Math.max(0, toNumber(row.difference_amount));
        const direction = (row.settlement_direction || "")
          .trim()
          .toLowerCase();

        if (direction === "collect") return sum + amount;
        if (direction === "refund") return sum - amount;
        return sum;
      }, 0);

    const todayExpenseRows = expenses.filter((expense) => {
      return expense.expense_date === dateKey(todayStart);
    });

    const monthExpenseRows = expenses.filter((expense) => {
      const date = new Date(`${expense.expense_date}T00:00:00`);
      return !Number.isNaN(date.getTime()) && date >= monthStart;
    });

    const monthPurchaseRows = purchases.filter((purchase) => {
      if (!purchase.purchase_date) return false;
      const date = new Date(`${purchase.purchase_date}T00:00:00`);
      const status = (
        purchase.purchase_status || "completed"
      ).toLowerCase();

      return (
        !Number.isNaN(date.getTime()) &&
        date >= monthStart &&
        !["cancelled", "void"].includes(status)
      );
    });

    const totalReceivable = creditAccounts.reduce(
      (sum, account) =>
        sum + Math.max(0, toNumber(account.current_balance)),
      0,
    );

    const totalPayable = suppliers.reduce(
      (sum, supplier) =>
        sum + Math.max(0, toNumber(supplier.current_balance)),
      0,
    );

    const baseCashSales = monthSalesRows
      .filter(
        (sale) =>
          (sale.payment_method || "").toLowerCase() === "cash",
      )
      .reduce((sum, sale) => sum + salePaidAmount(sale), 0);

    const baseDigitalSales = monthSalesRows
      .filter((sale) =>
        ["upi", "card", "bank", "bank_transfer"].includes(
          (sale.payment_method || "").toLowerCase(),
        ),
      )
      .reduce((sum, sale) => sum + salePaidAmount(sale), 0);

    const cashExchangeMovement = exchangeMoneyByMethod(
      monthExchangeRows,
      ["cash"],
    );

    const digitalExchangeMovement = exchangeMoneyByMethod(
      monthExchangeRows,
      ["upi", "card", "bank", "bank_transfer"],
    );

    const monthCashRefunds = refundByMethod(monthRefundRows, ["cash"]);
    const monthDigitalRefunds = refundByMethod(monthRefundRows, [
      "upi",
      "card",
      "bank",
      "bank_transfer",
    ]);

    const cashSales =
      baseCashSales - monthCashRefunds + cashExchangeMovement;
    const digitalSales =
      baseDigitalSales - monthDigitalRefunds + digitalExchangeMovement;

    const cashExpenses = monthExpenseRows
      .filter(
        (expense) =>
          (expense.payment_method || "").toLowerCase() ===
          "cash",
      )
      .reduce(
        (sum, expense) => sum + toNumber(expense.amount),
        0,
      );

    const digitalExpenses = monthExpenseRows
      .filter((expense) =>
        ["upi", "card", "bank_transfer"].includes(
          (expense.payment_method || "").toLowerCase(),
        ),
      )
      .reduce(
        (sum, expense) => sum + toNumber(expense.amount),
        0,
      );

    const manualCash = cashTransactions
      .filter((transaction) => {
        const date = new Date(
          `${transaction.transaction_date}T00:00:00`,
        );

        return (
          !Number.isNaN(date.getTime()) &&
          date >= monthStart &&
          transaction.account_type === "cash"
        );
      })
      .reduce(
        (sum, transaction) =>
          sum +
          (transaction.direction === "in" ? 1 : -1) *
            toNumber(transaction.amount),
        0,
      );

    const manualDigital = cashTransactions
      .filter((transaction) => {
        const date = new Date(
          `${transaction.transaction_date}T00:00:00`,
        );

        return (
          !Number.isNaN(date.getTime()) &&
          date >= monthStart &&
          ["upi", "card", "bank"].includes(
            transaction.account_type || "",
          )
        );
      })
      .reduce(
        (sum, transaction) =>
          sum +
          (transaction.direction === "in" ? 1 : -1) *
            toNumber(transaction.amount),
        0,
      );

    const normalMonthSales = monthSalesRows.reduce(
      (sum, sale) => sum + toNumber(sale.total_amount),
      0,
    );

    const monthExchangeNet = exchangeNet(monthExchangeRows);
    const todayExchangeNet = exchangeNet(todayExchangeRows);
    const monthRefundTotal = refundTotal(monthRefundRows);
    const todayRefundTotal = refundTotal(todayRefundRows);

    const monthSales =
      normalMonthSales - monthRefundTotal + monthExchangeNet;

    const monthExpenses = monthExpenseRows.reduce(
      (sum, expense) => sum + toNumber(expense.amount),
      0,
    );

    const monthPurchases = monthPurchaseRows.reduce(
      (sum, purchase) =>
        sum + toNumber(purchase.total_amount),
      0,
    );

    return {
      todaySales:
        todaySalesRows.reduce(
          (sum, sale) => sum + toNumber(sale.total_amount),
          0,
        ) -
        todayRefundTotal +
        todayExchangeNet,
      todayBills:
        todaySalesRows.length + todayExchangeRows.length,
      todayExchangeCount: todayExchangeRows.length,
      todayExchangeNet,
      monthSales,
      monthBills:
        monthSalesRows.length + monthExchangeRows.length,
      monthExchangeCount: monthExchangeRows.length,
      monthExchangeNet,
      todayExpenses: todayExpenseRows.reduce(
        (sum, expense) => sum + toNumber(expense.amount),
        0,
      ),
      monthExpenses,
      monthPurchases,
      totalReceivable,
      totalPayable,
      cashBalance:
        cashSales + manualCash - cashExpenses,
      digitalBalance:
        digitalSales + manualDigital - digitalExpenses,
      estimatedOperatingProfit:
        monthSales - monthPurchases - monthExpenses,
    };
  }, [
    cashTransactions,
    creditAccounts,
    exchangeSettlements,
    expenses,
    monthStart,
    purchases,
    posRefunds,
    successfulPosSales,
    suppliers,
    todayStart,
  ]);

  const dashboardStats = useMemo<DashboardStats>(() => {
    const activeRevenue = orders
      .filter(
        (order) =>
          getOrderStatus(order).toLowerCase() !== "cancelled",
      )
      .reduce(
        (sum, order) => sum + toNumber(order.total_amount),
        0,
      );

    const uniqueCustomers = new Set(
      orders
        .map(
          (order) =>
            order.email ||
            order.phone ||
            order.customer_name,
        )
        .filter(Boolean)
        .map(String),
    );

    const stockByProduct = new Map<number, number>();
    variants.forEach((variant) => {
      const available = Math.max(
        0,
        toNumber(variant.stock) -
          toNumber(variant.reserved_stock),
      );
      stockByProduct.set(
        variant.product_id,
        (stockByProduct.get(variant.product_id) || 0) +
          available,
      );
    });

    const lowStock = products.filter((product) => {
      const productId = Number(product.id);
      const stock = stockByProduct.has(productId)
        ? stockByProduct.get(productId) || 0
        : toNumber(product.stock);
      return stock >= 0 && stock <= 5;
    }).length;

    return {
      totalProducts: products.length,
      totalOrders: orders.length,
      totalCustomers: uniqueCustomers.size,
      websiteRevenue: activeRevenue,
      pendingOrders: orders.filter(
        (order) =>
          getOrderStatus(order).toLowerCase() === "pending",
      ).length,
      deliveredOrders: orders.filter(
        (order) =>
          getOrderStatus(order).toLowerCase() === "delivered",
      ).length,
      cancelledOrders: orders.filter(
        (order) =>
          getOrderStatus(order).toLowerCase() ===
          "cancelled",
      ).length,
      lowStockProducts: lowStock,
    };
  }, [orders, products, variants]);

  const visitorStats = useMemo<VisitorStats>(
    () => ({
      todayVisitors: getUniqueVisitorCount(
        visits,
        todayStart,
      ),
      sevenDayVisitors: getUniqueVisitorCount(
        visits,
        sevenDaysStart,
      ),
      thirtyDayVisitors: getUniqueVisitorCount(
        visits,
        thirtyDaysStart,
      ),
      totalUniqueVisitors: getUniqueVisitorCount(visits),
      totalPageViews: visits.length,
    }),
    [thirtyDaysStart, todayStart, sevenDaysStart, visits],
  );

  const salesTrend = useMemo<SalesPoint[]>(() => {
    const points: SalesPoint[] = [];

    const activeExchangeSettlements = exchangeSettlements.filter(
      (row) =>
        (row.settlement_status || "completed")
          .trim()
          .toLowerCase() !== "cancelled",
    );

    for (let index = salesRange - 1; index >= 0; index -= 1) {
      const day = new Date(todayStart);
      day.setDate(day.getDate() - index);
      const key = dateKey(day);

      const normalAmount = successfulPosSales
        .filter((sale) => {
          if (!sale.created_at) return false;
          const date = new Date(sale.created_at);
          return (
            !Number.isNaN(date.getTime()) &&
            dateKey(date) === key
          );
        })
        .reduce(
          (sum, sale) => sum + toNumber(sale.total_amount),
          0,
        );

      const refundAmount = posRefunds
        .filter(
          (row) =>
            (row.refund_status || "completed").trim().toLowerCase() ===
            "completed",
        )
        .filter((row) => {
          const sourceDate = row.refunded_at || row.created_at;
          if (!sourceDate) return false;
          const date = new Date(sourceDate);
          return (
            !Number.isNaN(date.getTime()) &&
            dateKey(date) === key
          );
        })
        .reduce(
          (sum, row) => sum + Math.max(0, toNumber(row.amount)),
          0,
        );

      const exchangeAmount = activeExchangeSettlements
        .filter((row) => {
          if (!row.created_at) return false;
          const date = new Date(row.created_at);
          return (
            !Number.isNaN(date.getTime()) &&
            dateKey(date) === key
          );
        })
        .reduce((sum, row) => {
          const amount = Math.max(
            0,
            toNumber(row.difference_amount),
          );
          const direction = (
            row.settlement_direction || ""
          )
            .trim()
            .toLowerCase();

          if (direction === "collect") return sum + amount;
          if (direction === "refund") return sum - amount;
          return sum;
        }, 0);

      points.push({
        key,
        label: day.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
        }),
        amount: normalAmount - refundAmount + exchangeAmount,
      });
    }

    return points;
  }, [
    exchangeSettlements,
    posRefunds,
    salesRange,
    successfulPosSales,
    todayStart,
  ]);

  const trendMax = Math.max(
    1,
    ...salesTrend.map((point) => point.amount),
  );

  const recentOrders = orders.slice(0, 5);

  const stockByProduct = useMemo(() => {
    const map = new Map<number, number>();
    variants.forEach((variant) => {
      const available = Math.max(
        0,
        toNumber(variant.stock) -
          toNumber(variant.reserved_stock),
      );
      map.set(
        variant.product_id,
        (map.get(variant.product_id) || 0) + available,
      );
    });
    return map;
  }, [variants]);

  const lowStockProducts = useMemo(
    () =>
      products
        .map((product) => ({
          ...product,
          computedStock: stockByProduct.has(Number(product.id))
            ? stockByProduct.get(Number(product.id)) || 0
            : toNumber(product.stock),
        }))
        .filter(
          (product) =>
            product.computedStock >= 0 &&
            product.computedStock <= 5,
        )
        .sort(
          (first, second) =>
            first.computedStock - second.computedStock,
        )
        .slice(0, 6),
    [products, stockByProduct],
  );

  const dueCustomers = creditAccounts
    .filter((account) => toNumber(account.current_balance) > 0)
    .slice(0, 5);

  const dueSuppliers = suppliers
    .filter((supplier) => toNumber(supplier.current_balance) > 0)
    .slice(0, 5);

  const popularPages = useMemo(() => {
    const counts = new Map<string, number>();
    visits.forEach((visit) => {
      const path = visit.page_path?.trim() || "/";
      counts.set(path, (counts.get(path) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([pagePath, count]) => ({ pagePath, count }))
      .sort((first, second) => second.count - first.count)
      .slice(0, 5);
  }, [visits]);

  const dashboardProfitSummary = useMemo(() => {
    const quickVariantIds = new Set(
      profitVariantIdentityRows
        .filter((row) => {
          const name = String(row.variant_name || "").trim().toLowerCase();
          const sku = String(row.sku || "").trim().toUpperCase();
          return name === "quick item" || sku.startsWith("QUICK-");
        })
        .map((row) => Number(row.id)),
    );

    const quickProductIds = new Set<number>();

    profitVariantIdentityRows.forEach((row) => {
      const name = String(row.variant_name || "").trim().toLowerCase();
      const sku = String(row.sku || "").trim().toUpperCase();

      if (name === "quick item" || sku.startsWith("QUICK-")) {
        quickProductIds.add(Number(row.product_id));
      }
    });

    profitProductIdentityRows.forEach((row) => {
      const sku = String(row.sku || "").trim().toUpperCase();
      if (sku.startsWith("QUICK-")) quickProductIds.add(Number(row.id));
    });

    return profitVariantRows
      .filter(
        (row) =>
          !quickVariantIds.has(Number(row.variant_id)) &&
          !quickProductIds.has(Number(row.product_id)) &&
          toNumber(row.weighted_purchase_cost) > 0,
      )
      .reduce(
        (summary, row) => {
          const sold = Math.max(0, toNumber(row.sold_30d));
          const revenue = Math.max(0, toNumber(row.revenue_30d));
          const purchaseCost =
            Math.max(0, toNumber(row.weighted_purchase_cost)) * sold;

          summary.revenue += revenue;
          summary.profit += revenue - purchaseCost;
          summary.blocked += Math.max(0, toNumber(row.money_blocked));
          summary.stockInvestment +=
            Math.max(0, toNumber(row.current_stock)) *
            Math.max(0, toNumber(row.weighted_purchase_cost));

          return summary;
        },
        {
          revenue: 0,
          profit: 0,
          blocked: 0,
          stockInvestment: 0,
        },
      );
  }, [
    profitProductIdentityRows,
    profitVariantIdentityRows,
    profitVariantRows,
  ]);

  const profitRevenue30d = dashboardProfitSummary.revenue;
  const grossProfit30d = dashboardProfitSummary.profit;
  const profitMargin30d =
    profitRevenue30d > 0 ? (grossProfit30d / profitRevenue30d) * 100 : 0;
  const blockedMoney = dashboardProfitSummary.blocked;
  const stockInvestment = dashboardProfitSummary.stockInvestment;

  const todayOwnerProfit = useMemo(() => {
    const billRows = todayOwnerProfitRows.filter(
      (row) => row.alert_type === "BILL_PROFIT_SUMMARY",
    );

    const registeredRevenue = billRows.reduce(
      (sum, row) =>
        sum + Math.max(0, toNumber(row.registered_revenue)),
      0,
    );

    const purchaseCost = billRows.reduce(
      (sum, row) =>
        sum + Math.max(0, toNumber(row.registered_purchase_cost)),
      0,
    );

    const actualProfit = billRows.reduce(
      (sum, row) =>
        sum +
        toNumber(
          row.bill_profit != null
            ? row.bill_profit
            : row.profit_per_unit,
        ),
      0,
    );

    const trackedBillValue = billRows.reduce(
      (sum, row) =>
        sum + Math.max(0, toNumber(row.final_bill_amount)),
      0,
    );

    const lowProfitAlerts = todayOwnerProfitRows.filter(
      (row) => row.alert_type === "LOW_PROFIT",
    ).length;

    const lossAlerts = todayOwnerProfitRows.filter(
      (row) => row.alert_type === "LOSS_SALE",
    ).length;

    return {
      trackedBills: billRows.length,
      trackedBillValue,
      registeredRevenue,
      purchaseCost,
      actualProfit,
      margin:
        registeredRevenue > 0
          ? (actualProfit / registeredRevenue) * 100
          : 0,
      lowProfitAlerts,
      lossAlerts,
    };
  }, [todayOwnerProfitRows]);

  async function handleLogout() {
    try {
      await supabase.auth.signOut({ scope: "local" });
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace("/admin/login");
    } catch (error) {
      console.error("Admin logout error:", error);
      alert("Unable to logout. Please try again.");
    }
  }

  if (loading) {
    return (
      <main className="loadingPage">
        <div className="loadingLogo">NCS</div>
        <div className="loader" />
        <h2>Opening Business Command Centre...</h2>
        <p>
          Loading POS, accounts, inventory, orders and website
          analytics.
        </p>

        <style jsx>{`
          .loadingPage {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background:
              radial-gradient(
                circle at 20% 10%,
                rgba(212, 175, 55, 0.18),
                transparent 28%
              ),
              ${IVORY};
            color: ${ROYAL_BLUE};
            font-family: Poppins, Inter, Arial, sans-serif;
            text-align: center;
          }

          .loadingLogo {
            width: 80px;
            height: 80px;
            display: grid;
            place-items: center;
            border: 2px solid ${GOLD};
            border-radius: 24px;
            background: ${ROYAL_BLUE};
            color: ${GOLD};
            font-size: 22px;
            font-weight: 950;
          }

          .loader {
            width: 46px;
            height: 46px;
            margin-top: 24px;
            border: 4px solid #e4e7ec;
            border-top-color: ${ROYAL_BLUE};
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          h2 {
            margin: 18px 0 0;
          }

          p {
            margin: 8px 0 0;
            color: #667085;
            font-size: 13px;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
  
        @media (max-width: 1200px) {
          .todayProfitGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .todayProfitHeader {
            align-items: stretch;
            flex-direction: column;
          }

          .todayProfitOpenButton {
            width: 100%;
            box-sizing: border-box;
          }

          .todayProfitGrid {
            grid-template-columns: 1fr 1fr;
          }

          .profitDashboardGrid {
            grid-template-columns: 1fr;
          }

          .profitHeader {
            align-items: stretch !important;
            flex-direction: column;
          }

          .profitOpenButton {
            width: 100%;
          }
        }

      `}</style>
      </main>
    );
  }

  return (
    <main className="dashboardPage">
      <section className="hero">
        <div className="heroMotion" aria-hidden="true">
          <span className="heroSweep" />
          <span className="heroOrb heroOrbOne" />
          <span className="heroOrb heroOrbTwo" />
          <span className="heroRupee">₹</span>

          <div className="heroShopExit">
            <div className="heroShopDoor">
              <span>NCS</span>
              <i />
            </div>

            <div className="heroShopCustomer customerA">
              <span className="heroCustomerHead" />
              <span className="heroCustomerBody" />
              <b className="heroCustomerBag bagBlue">NCS</b>
            </div>

            <div className="heroShopCustomer customerB">
              <span className="heroCustomerHead" />
              <span className="heroCustomerBody" />
              <b className="heroCustomerBag bagGold">NCS</b>
            </div>

            <div className="heroShopCustomer customerC">
              <span className="heroCustomerHead" />
              <span className="heroCustomerBody" />
              <b className="heroCustomerBag bagBlue">NCS</b>
            </div>
          </div>
        </div>

        <div>
          <span>NEW CITY STYLE • BUSINESS COMMAND CENTRE</span>
          <h1>Premium Business Dashboard</h1>
          <p>
            Live retail sales, cash flow, receivables, payables,
            inventory, online orders and customer activity.
          </p>
          <small>
            Signed in as {adminEmail || "Administrator"}
          </small>
        </div>

        <div className="heroActions">
          <button
            type="button"
            className={refreshing ? "refreshButton refreshing" : "refreshButton"}
            onClick={() => {
              void loadDashboard(true);
              void loadGoogleBusinessStatus(true);
              void loadProfitSummary();
              void loadTodayOwnerProfit();
            }}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
          <Link href="/admin/pos" className="newBillButton">
            ＋ New Bill
          </Link>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </section>

      <section className="executivePulseStrip">
        <div className="executivePulseLead">
          <span>OWNER EXECUTIVE PULSE</span>
          <strong>
            {todayOwnerProfit.lossAlerts > 0
              ? "Immediate margin attention"
              : todayOwnerProfit.lowProfitAlerts > 0 ||
                  dashboardStats.lowStockProducts > 0 ||
                  dashboardStats.pendingOrders > 0
                ? "Business needs follow-up"
                : "Business is under control"}
          </strong>
          <small>
            Live command summary from POS, profit, inventory and online operations.
          </small>
        </div>

        <div className="executivePulseMetric">
          <span>TODAY SALES</span>
          <strong>{formatCurrency(business.todaySales)}</strong>
          <small>{business.todayBills} transaction(s)</small>
        </div>

        <div className="executivePulseMetric profit">
          <span>ACTUAL PROFIT</span>
          <strong>{formatCurrency(todayOwnerProfit.actualProfit)}</strong>
          <small>{todayOwnerProfit.margin.toFixed(1)}% tracked margin</small>
        </div>

        <div className="executivePulseMetric money">
          <span>MONEY POSITION</span>
          <strong>
            {formatCurrency(
              business.cashBalance + business.digitalBalance,
            )}
          </strong>
          <small>Cash + digital estimate</small>
        </div>

        <div
          className={`executivePulseMetric attention ${
            todayOwnerProfit.lossAlerts > 0 ||
            todayOwnerProfit.lowProfitAlerts > 0 ||
            dashboardStats.lowStockProducts > 0 ||
            dashboardStats.pendingOrders > 0
              ? "active"
              : ""
          }`}
        >
          <span>ACTION LOAD</span>
          <strong>
            {todayOwnerProfit.lossAlerts +
              todayOwnerProfit.lowProfitAlerts +
              dashboardStats.lowStockProducts +
              dashboardStats.pendingOrders}
          </strong>
          <small>Profit + stock + order alerts</small>
        </div>
      </section>

      {errorMessage && (
        <div className="message errorMessage">
          {errorMessage}
        </div>
      )}

      {visitorError && (
        <div className="message warningMessage">
          {visitorError}
        </div>
      )}

      <section className="primaryKpis">
        <BusinessKpi
          icon="₹"
          label="Today Sales"
          value={formatCurrency(business.todaySales)}
          note={`${business.todayBills} transaction${
            business.todayBills === 1 ? "" : "s"
          } today${
            business.todayExchangeCount > 0
              ? ` • ${business.todayExchangeCount} exchange`
              : ""
          }`}
          tone="blue"
        />
        <BusinessKpi
          icon="↗"
          label="This Month Sales"
          value={formatCurrency(business.monthSales)}
          note={`${business.monthBills} transactions${
            business.monthExchangeCount > 0
              ? ` • ${business.monthExchangeCount} exchange`
              : ""
          }`}
          tone="gold"
        />
        <BusinessKpi
          icon="↓"
          label="Total Receivable"
          value={formatCurrency(business.totalReceivable)}
          note={`${
            creditAccounts.filter(
              (account) =>
                toNumber(account.current_balance) > 0,
            ).length
          } customers pending`}
          tone="green"
        />
        <BusinessKpi
          icon="↑"
          label="Total Payable"
          value={formatCurrency(business.totalPayable)}
          note={`${
            suppliers.filter(
              (supplier) =>
                toNumber(supplier.current_balance) > 0,
            ).length
          } suppliers pending`}
          tone="red"
        />
      </section>

      <section className="todayOwnerProfitPanel">
        <div className="todayProfitGlow" aria-hidden="true" />

        <div className="todayProfitHeader">
          <div>
            <span>TODAY • OWNER PROFIT SNAPSHOT</span>
            <h2>Today&apos;s Actual Profit</h2>
            <p>
              Private registered-stock profit from completed bills.
              MRP is never used and Quick Items are excluded.
            </p>
          </div>

          <Link
            href="/admin/owner-control"
            className="todayProfitOpenButton"
          >
            Open Owner Control Center →
          </Link>
        </div>

        {todayOwnerProfitLoading ? (
          <div className="todayProfitLoading">
            Reading today&apos;s completed bill profit...
          </div>
        ) : (
          <div className="todayProfitGrid">
            <div className="todayProfitMetric heroMetric">
              <span>ACTUAL PROFIT</span>
              <strong
                className={
                  todayOwnerProfit.actualProfit < 0
                    ? "negative"
                    : "positive"
                }
              >
                {formatCurrency(todayOwnerProfit.actualProfit)}
              </strong>
              <small>
                Registered revenue − registered purchase cost
              </small>
            </div>

            <div className="todayProfitMetric">
              <span>PROFIT MARGIN</span>
              <strong>{todayOwnerProfit.margin.toFixed(1)}%</strong>
              <small>Today&apos;s tracked registered-stock margin</small>
            </div>

            <div className="todayProfitMetric">
              <span>TRACKED BILLS</span>
              <strong>{todayOwnerProfit.trackedBills}</strong>
              <small>
                {formatCurrency(todayOwnerProfit.trackedBillValue)} bill value
              </small>
            </div>

            <div className="todayProfitMetric">
              <span>REGISTERED REVENUE</span>
              <strong>
                {formatCurrency(todayOwnerProfit.registeredRevenue)}
              </strong>
              <small>
                Purchase cost {formatCurrency(todayOwnerProfit.purchaseCost)}
              </small>
            </div>

            <div className="todayProfitMetric warning">
              <span>LOW PROFIT ALERTS</span>
              <strong>{todayOwnerProfit.lowProfitAlerts}</strong>
              <small>Pre-bill margin warnings today</small>
            </div>

            <div className="todayProfitMetric danger">
              <span>LOSS ALERTS</span>
              <strong>{todayOwnerProfit.lossAlerts}</strong>
              <small>Below purchase-cost warnings today</small>
            </div>
          </div>
        )}
      </section>

      <section className="secondaryKpis">
        <MiniKpi
          label="Cash Balance"
          motion="cash"
          value={formatCurrency(business.cashBalance)}
          note="Current month estimate"
        />
        <MiniKpi
          label="Digital Balance"
          motion="digital"
          value={formatCurrency(business.digitalBalance)}
          note="UPI / Card / Bank"
        />
        <MiniKpi
          label="Today Expenses"
          motion="expense"
          value={formatCurrency(business.todayExpenses)}
          note="Daily expense book"
        />
        <MiniKpi
          label="Month Expenses"
          motion="expense"
          value={formatCurrency(business.monthExpenses)}
          note="All expense categories"
        />
        <MiniKpi
          label="Month Purchases"
          motion="purchase"
          value={formatCurrency(business.monthPurchases)}
          note="Supplier stock purchases"
        />
        <MiniKpi
          label="Est. Operating Profit"
          motion={business.estimatedOperatingProfit >= 0 ? "profit" : "loss"}
          value={formatCurrency(
            business.estimatedOperatingProfit,
          )}
          note="Sales − purchases − expenses"
        />
      </section>

      <section className="profitIntelligencePanel">
        <div className="profitGlow" aria-hidden="true" />
        <div className="sectionHeader profitHeader">
          <div>
            <span>PROFIT INTELLIGENCE</span>
            <h2>Know What Is Actually Making Money</h2>
            <p className="profitSubtitle">
              Profit uses only registered stock: actual sold value minus purchase cost. MRP and Quick Items are excluded.
            </p>
          </div>

          <Link
            href="/admin/profit-intelligence"
            className="profitOpenButton"
          >
            Open Profit Intelligence →
          </Link>
        </div>

        {profitSummaryLoading ? (
          <div className="profitLoading">
            Reading live profit intelligence...
          </div>
        ) : (
          <div className="profitDashboardGrid">
            <div className="profitMetricCard">
              <span>30 DAY REVENUE</span>
              <strong>{formatCurrency(profitRevenue30d)}</strong>
              <small>Actual registered-stock sales • Quick Items excluded</small>
            </div>

            <div className="profitMetricCard highlight">
              <span>GROSS PROFIT</span>
              <strong>{formatCurrency(grossProfit30d)}</strong>
              <small>Actual sold value minus purchase cost</small>
            </div>

            <div className="profitMetricCard">
              <span>GROSS MARGIN</span>
              <strong>{profitMargin30d.toFixed(1)}%</strong>
              <small>Profit efficiency across tracked sales</small>
            </div>

            <div className="profitMetricCard warning">
              <span>MONEY BLOCKED</span>
              <strong>{formatCurrency(blockedMoney)}</strong>
              <small>Capital sitting in slow / dead stock</small>
            </div>

            <div className="profitMetricCard">
              <span>STOCK INVESTMENT</span>
              <strong>{formatCurrency(stockInvestment)}</strong>
              <small>Total inventory investment currently tracked</small>
            </div>
          </div>
        )}
      </section>

      <section className="googleBusinessPanel">
        <div className="sectionHeader">
          <div>
            <span>GOOGLE BUSINESS</span>
            <h2>Google Business Profile</h2>
            <p className="googleBusinessSubtitle">
              Official Google profile connection, API access and review readiness.
            </p>
          </div>

          {googleBusiness.connected ? (
            <button
              type="button"
              className="googleRefreshButton"
              onClick={() => void loadGoogleBusinessStatus(true)}
              disabled={googleBusiness.refreshing}
            >
              {googleBusiness.refreshing ? "Refreshing..." : "↻ Refresh Google"}
            </button>
          ) : (
            <a
              href="/api/google-business/connect"
              className="googleConnectButton"
            >
              Connect Google
            </a>
          )}
        </div>

        {googleBusiness.loading ? (
          <div className="googleBusinessLoading">
            Checking Google Business connection...
          </div>
        ) : (
          <>
            <div className="googleBusinessGrid">
              <GoogleBusinessMetric
                label="Connection"
                value={googleBusiness.connected ? "Connected" : "Not Connected"}
                tone={googleBusiness.connected ? "success" : "danger"}
                icon={googleBusiness.connected ? "✅" : "🔌"}
              />

              <GoogleBusinessMetric
                label="API Access"
                value={
                  googleBusiness.googleApiReady
                    ? "Ready"
                    : googleBusiness.connected &&
                        (googleBusiness.status === 429 ||
                          googleBusiness.status === 403)
                      ? "Pending Approval"
                      : googleBusiness.connected
                        ? "Waiting"
                        : "Not Connected"
                }
                tone={
                  googleBusiness.googleApiReady
                    ? "success"
                    : googleBusiness.connected
                      ? "warning"
                      : "danger"
                }
                icon={googleBusiness.googleApiReady ? "🟢" : "🟡"}
              />

              <GoogleBusinessMetric
                label="Google Rating"
                value={
                  googleBusiness.rating != null
                    ? `${googleBusiness.rating.toFixed(1)} ★`
                    : "Waiting for API"
                }
                tone={googleBusiness.rating != null ? "gold" : "neutral"}
                icon="⭐"
              />

              <GoogleBusinessMetric
                label="Google Reviews"
                value={
                  googleBusiness.totalReviews != null
                    ? googleBusiness.totalReviews
                    : "Waiting for API"
                }
                tone={
                  googleBusiness.totalReviews != null ? "gold" : "neutral"
                }
                icon="💬"
              />

              {googleBusiness.googleApiReady &&
                googleBusiness.accountCount !== undefined && (
                  <GoogleBusinessMetric
                    label="Google Accounts"
                    value={googleBusiness.accountCount}
                    tone="neutral"
                    icon="🏪"
                  />
                )}
            </div>

            {googleBusiness.error && (
              <div
                className={
                  googleBusiness.connected &&
                  (googleBusiness.status === 429 ||
                    googleBusiness.status === 403)
                    ? "googleBusinessMessage warning"
                    : "googleBusinessMessage error"
                }
              >
                {googleBusiness.connected &&
                (googleBusiness.status === 429 ||
                  googleBusiness.status === 403)
                  ? "Google connection is complete. Business Profile API access is waiting for Google approval. Live rating and reviews will appear here after access becomes available."
                  : googleBusiness.error}
              </div>
            )}
          </>
        )}
      </section>

      <section className="quickActionsPanel">
        <div className="sectionHeader">
          <div>
            <span>FAST OPERATIONS</span>
            <h2>Retail Quick Actions</h2>
          </div>
        </div>

        <div className="quickActionGrid">
          <QuickAction
            href="/admin/pos"
            icon="🧾"
            title="New Bill"
            text="Open the premium billing counter"
          />
          <QuickAction
            href="/admin/purchases"
            icon="📥"
            title="Add Purchase"
            text="Receive supplier stock"
          />
          <QuickAction
            href="/admin/expenses"
            icon="💸"
            title="Add Expense"
            text="Record a daily business expense"
          />
          <QuickAction
            href="/admin/party-ledgers"
            icon="📒"
            title="Receive Customer Due"
            text="Open customer receivable ledger"
          />
          <QuickAction
            href="/admin/party-ledgers"
            icon="🚚"
            title="Pay Supplier"
            text="Open supplier payable ledger"
          />
          <QuickAction
            href="/admin/cash-bank-book"
            icon="🏦"
            title="Cash & Bank"
            text="Review daily money movement"
          />
          <QuickAction
            href="/admin/business-action-center"
            icon="🚦"
            title="Action Center"
            text="See the owner priority queue"
          />
        </div>
      </section>

      <section className="analyticsGrid">
        <article className="panel salesTrendPanel">
          <div className="sectionHeader">
            <div>
              <span>POS PERFORMANCE</span>
              <h2>Sales Trend</h2>
            </div>

            <select
              value={salesRange}
              onChange={(event) =>
                setSalesRange(
                  Number(event.target.value) as 7 | 14 | 30,
                )
              }
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>

          <div className="trendChart">
            {salesTrend.map((point) => {
              const height = Math.max(
                3,
                (point.amount / trendMax) * 100,
              );

              return (
                <div className="trendColumn" key={point.key}>
                  <div className="trendValue">
                    {point.amount > 0
                      ? formatCurrency(point.amount)
                      : "₹0"}
                  </div>
                  <div className="trendTrack">
                    <div
                      className="trendBar"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span>{point.label}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel alertPanel">
          <div className="sectionHeader">
            <div>
              <span>ATTENTION REQUIRED</span>
              <h2>Business Alerts</h2>
            </div>
          </div>

          <div className="alertList">
            <AlertRow
              icon="⚠️"
              title="Low Stock Products"
              value={dashboardStats.lowStockProducts}
              href="/admin/barcodes"
              tone="amber"
            />
            <AlertRow
              icon="💰"
              title="Customers with Dues"
              value={
                creditAccounts.filter(
                  (account) =>
                    toNumber(account.current_balance) > 0,
                ).length
              }
              href="/admin/party-ledgers"
              tone="red"
            />
            <AlertRow
              icon="🚚"
              title="Suppliers Payable"
              value={
                suppliers.filter(
                  (supplier) =>
                    toNumber(supplier.current_balance) > 0,
                ).length
              }
              href="/admin/party-ledgers"
              tone="blue"
            />
            <AlertRow
              icon="📦"
              title="Pending Online Orders"
              value={dashboardStats.pendingOrders}
              href="/admin/orders"
              tone="green"
            />
          </div>
        </article>
      </section>

      <section className="detailGrid">
        <article className="panel">
          <div className="sectionHeader">
            <div>
              <span>RECEIVABLE WATCH</span>
              <h2>Customer Dues</h2>
            </div>
            <Link href="/admin/party-ledgers">View All</Link>
          </div>

          <div className="compactList">
            {dueCustomers.length === 0 ? (
              <EmptyState
                icon="✅"
                title="No Customer Dues"
                text="All customer balances are clear."
              />
            ) : (
              dueCustomers.map((account) => (
                <div className="compactRow" key={account.id}>
                  <div className="rowIcon">👤</div>
                  <div className="rowMain">
                    <strong>
                      {account.customer_name || "Customer"}
                    </strong>
                    <span>
                      {account.customer_phone || "No mobile"}
                    </span>
                  </div>
                  <div className="rowAmount danger">
                    {formatCurrency(
                      toNumber(account.current_balance),
                    )}
                    <small>
                      Due {account.next_due_date || "not set"}
                    </small>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="sectionHeader">
            <div>
              <span>PAYABLE WATCH</span>
              <h2>Supplier Balances</h2>
            </div>
            <Link href="/admin/party-ledgers">View All</Link>
          </div>

          <div className="compactList">
            {dueSuppliers.length === 0 ? (
              <EmptyState
                icon="✅"
                title="No Supplier Payables"
                text="All supplier balances are clear."
              />
            ) : (
              dueSuppliers.map((supplier) => (
                <div className="compactRow" key={supplier.id}>
                  <div className="rowIcon">🚚</div>
                  <div className="rowMain">
                    <strong>
                      {supplier.supplier_name || "Supplier"}
                    </strong>
                    <span>{supplier.phone || "No mobile"}</span>
                  </div>
                  <div className="rowAmount warning">
                    {formatCurrency(
                      toNumber(supplier.current_balance),
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="sectionHeader">
            <div>
              <span>INVENTORY WATCH</span>
              <h2>Low Stock Products</h2>
            </div>
            <Link href="/admin/barcodes">Manage</Link>
          </div>

          <div className="compactList">
            {lowStockProducts.length === 0 ? (
              <EmptyState
                icon="✅"
                title="Stock Looks Good"
                text="No low-stock products found."
              />
            ) : (
              lowStockProducts.map((product) => (
                <div
                  className="compactRow"
                  key={String(product.id)}
                >
                  <div className="rowIcon">🛍️</div>
                  <div className="rowMain">
                    <strong>{getProductName(product)}</strong>
                    <span>
                      {product.category || "Fashion Product"}
                    </span>
                  </div>
                  <div
                    className={
                      product.computedStock === 0
                        ? "stockPill out"
                        : "stockPill low"
                    }
                  >
                    {product.computedStock === 0
                      ? "Out"
                      : `${product.computedStock} left`}
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="commerceGrid">
        <article
          className={`panel recentOrdersPanel ${
            recentOrders.length === 0 ? "emptyCompact" : ""
          }`}
        >
          <div className="sectionHeader">
            <div>
              <span>ONLINE STORE</span>
              <h2>Recent Orders</h2>
            </div>
            <Link href="/admin/orders">View All</Link>
          </div>

          <div className="compactList">
            {recentOrders.length === 0 ? (
              <EmptyState
                icon="📦"
                title="No Orders Yet"
                text="New online orders will appear here."
              />
            ) : (
              recentOrders.map((order) => {
                const status = getOrderStatus(order);
                const items = parseOrderItems(order);

                return (
                  <div
                    className="compactRow"
                    key={String(order.id)}
                  >
                    <div className="rowIcon">#</div>
                    <div className="rowMain">
                      <strong>Order #{order.id}</strong>
                      <span>
                        {order.customer_name || "Customer"} •{" "}
                        {items.length} item
                        {items.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="rowAmount">
                      {formatCurrency(
                        toNumber(order.total_amount),
                      )}
                      <small>{status}</small>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="panel">
          <div className="sectionHeader">
            <div>
              <span>WEBSITE ANALYTICS</span>
              <h2>Customer Visitors</h2>
            </div>
            <span className="liveBadge">● Live</span>
          </div>

          <div className="visitorMetrics">
            <VisitorMetric
              label="Today"
              value={visitorStats.todayVisitors}
            />
            <VisitorMetric
              label="7 Days"
              value={visitorStats.sevenDayVisitors}
            />
            <VisitorMetric
              label="30 Days"
              value={visitorStats.thirtyDayVisitors}
            />
            <VisitorMetric
              label="Total"
              value={visitorStats.totalUniqueVisitors}
            />
            <VisitorMetric
              label="Page Views"
              value={visitorStats.totalPageViews}
            />
          </div>

          <div className="popularPages">
            {popularPages.map((page, index) => (
              <div key={page.pagePath}>
                <b>{index + 1}</b>
                <span>{page.pagePath}</span>
                <strong>{page.count}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="executiveSectionLabel">
        <div>
          <span>STORE • FINANCE • ONLINE</span>
          <h2>Executive Business Summary</h2>
        </div>
        <small>High-level operating position at a glance</small>
      </section>

      <section className="catalogueKpis">
        <MiniKpi
          label="Total Products"
          value={String(dashboardStats.totalProducts)}
          note="Website catalogue"
        />
        <MiniKpi
          label="Online Orders"
          value={String(dashboardStats.totalOrders)}
          note={`${dashboardStats.pendingOrders} pending`}
        />
        <MiniKpi
          label="Online Customers"
          value={String(dashboardStats.totalCustomers)}
          note="Unique customer records"
        />
        <MiniKpi
          label="Online Revenue"
          value={formatCurrency(
            dashboardStats.websiteRevenue,
          )}
          note="Excluding cancelled orders"
        />
        <MiniKpi
          label="Delivered"
          value={String(dashboardStats.deliveredOrders)}
          note="Completed deliveries"
        />
        <MiniKpi
          label="Cancelled"
          value={String(dashboardStats.cancelledOrders)}
          note="Cancelled online orders"
        />
      </section>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        :global(.ncsSidebarLink.active),
        :global(.ncsSidebarItem.active),
        :global(.ncsAdminNavLink.active),
        :global(.ncsSidebarLink[aria-current="page"]),
        :global(.ncsSidebarItem[aria-current="page"]),
        :global(.ncsAdminNavLink[aria-current="page"]) {
          position: relative;
          overflow: hidden;
          isolation: isolate;
        }

        :global(.ncsSidebarLink.active)::after,
        :global(.ncsSidebarItem.active)::after,
        :global(.ncsAdminNavLink.active)::after,
        :global(.ncsSidebarLink[aria-current="page"])::after,
        :global(.ncsSidebarItem[aria-current="page"])::after,
        :global(.ncsAdminNavLink[aria-current="page"])::after {
          content: "";
          position: absolute;
          z-index: -1;
          top: -25%;
          left: -55%;
          width: 34%;
          height: 150%;
          background:
            linear-gradient(
              90deg,
              transparent,
              rgba(255, 255, 255, 0.56),
              rgba(255, 245, 184, 0.72),
              transparent
            );
          transform: rotate(16deg);
          animation: selectedMenuGoldShine 3.2s ease-in-out infinite;
        }

        :global(.ncsSidebarLink.active),
        :global(.ncsSidebarItem.active),
        :global(.ncsAdminNavLink.active),
        :global(.ncsSidebarLink[aria-current="page"]),
        :global(.ncsSidebarItem[aria-current="page"]),
        :global(.ncsAdminNavLink[aria-current="page"]) {
          animation: selectedMenuGoldGlow 2.4s ease-in-out infinite;
        }

        .dashboardPage {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(
              circle at 5% 0%,
              rgba(212, 175, 55, 0.14),
              transparent 25%
            ),
            linear-gradient(180deg, ${IVORY}, #ffffff);
          color: #243044;
          font-family: Poppins, Inter, Arial, sans-serif;
        }

        .hero {
          position: relative;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          padding: 25px 26px;
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.38);
          border-radius: 23px;
          background:
            radial-gradient(
              circle at 92% 0%,
              rgba(212, 175, 55, 0.28),
              transparent 33%
            ),
            linear-gradient(
              135deg,
              ${DEEP_BLUE},
              ${ROYAL_BLUE} 60%,
              #174da4
            );
          color: #ffffff;
          box-shadow: 0 20px 48px rgba(3, 21, 63, 0.2);
        }

        .hero > div:not(.heroMotion) {
          position: relative;
          z-index: 2;
        }

        .heroMotion {
          position: absolute;
          z-index: 1;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .heroSweep {
          position: absolute;
          top: -35%;
          left: -35%;
          width: 28%;
          height: 170%;
          background:
            linear-gradient(
              90deg,
              transparent,
              rgba(255, 255, 255, 0.22),
              rgba(212, 175, 55, 0.25),
              transparent
            );
          transform: rotate(17deg);
          animation: heroSweep 7.5s ease-in-out infinite;
        }

        .heroOrb {
          position: absolute;
          border-radius: 50%;
          background:
            radial-gradient(
              circle,
              rgba(212, 175, 55, 0.3),
              rgba(212, 175, 55, 0.05) 55%,
              transparent 72%
            );
          filter: blur(2px);
          animation: heroOrbFloat 6.8s ease-in-out infinite;
        }

        .heroOrbOne {
          width: 190px;
          height: 190px;
          right: 12%;
          top: -90px;
        }

        .heroOrbTwo {
          width: 120px;
          height: 120px;
          right: 35%;
          bottom: -70px;
          animation-delay: -2.8s;
        }

        .heroRupee {
          position: absolute;
          right: 30%;
          top: 20px;
          color: rgba(212, 175, 55, 0.16);
          font-size: 88px;
          font-weight: 950;
          animation: heroRupeeFloat 5.8s ease-in-out infinite;
        }

        .heroShopExit {
          position: absolute;
          right: 255px;
          bottom: 10px;
          width: 310px;
          height: 108px;
          overflow: hidden;
          pointer-events: none;
        }

        .heroShopDoor {
          position: absolute;
          right: 4px;
          bottom: 0;
          width: 76px;
          height: 92px;
          border: 1px solid rgba(212, 175, 55, 0.74);
          border-radius: 16px 16px 5px 5px;
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.15),
              rgba(2, 11, 36, 0.8)
            );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.18),
            0 12px 24px rgba(2, 11, 36, 0.24);
        }

        .heroShopDoor span {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          color: ${GOLD};
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .heroShopDoor i {
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 10px;
          height: 58px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 7px 7px 2px 2px;
          background:
            linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.09),
              rgba(212, 175, 55, 0.11)
            );
        }

        .heroShopCustomer {
          position: absolute;
          z-index: 3;
          right: 28px;
          bottom: 6px;
          width: 34px;
          height: 67px;
          opacity: 0;
          filter: drop-shadow(0 8px 9px rgba(2, 11, 36, 0.32));
          animation: heroCustomerExit 12s linear infinite;
        }

        .heroShopCustomer.customerB {
          animation-delay: -4s;
        }

        .heroShopCustomer.customerC {
          animation-delay: -8s;
        }

        .heroCustomerHead {
          position: absolute;
          top: 0;
          left: 10px;
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255, 255, 255, 0.88);
          border-radius: 50%;
          background: #f0c07d;
        }

        .heroCustomerBody {
          position: absolute;
          left: 6px;
          bottom: 0;
          width: 23px;
          height: 45px;
          border: 2px solid rgba(255, 255, 255, 0.82);
          border-radius: 12px 12px 7px 7px;
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.93),
              rgba(212, 175, 55, 0.75)
            );
        }

        .customerB .heroCustomerHead {
          background: #86d7ff;
        }

        .customerC .heroCustomerHead {
          background: #85dda7;
        }

        .heroCustomerBag {
          position: absolute;
          right: -13px;
          bottom: 4px;
          width: 24px;
          height: 28px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.76);
          border-radius: 4px 4px 7px 7px;
          font-size: 5px;
          font-weight: 950;
          letter-spacing: 0.4px;
          box-shadow: 0 7px 12px rgba(2, 11, 36, 0.28);
          animation: heroBagSwing 1.2s ease-in-out infinite;
        }

        .heroCustomerBag::before {
          content: "";
          position: absolute;
          left: 5px;
          top: -7px;
          width: 11px;
          height: 8px;
          border: 2px solid currentColor;
          border-bottom: 0;
          border-radius: 7px 7px 0 0;
        }

        .heroCustomerBag.bagBlue {
          background: linear-gradient(145deg, #7c4dff, #5a39d6, #38206f);
          color: #f3d66f;
        }

        .heroCustomerBag.bagGold {
          background: linear-gradient(145deg, #f6df86, #d4af37, #b8890b);
          color: #38206f;
        }

        .hero span,
        .sectionHeader > div > span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .hero h1 {
          margin: 5px 0 0;
          font-size: clamp(29px, 4vw, 43px);
          line-height: 1.08;
        }

        .hero p {
          max-width: 740px;
          margin: 7px 0 0;
          color: rgba(255, 255, 255, 0.75);
          font-size: 10px;
          line-height: 1.6;
        }

        .hero small {
          display: block;
          margin-top: 9px;
          color: rgba(255, 255, 255, 0.53);
          font-size: 8px;
        }

        .heroActions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .heroActions button,
        .heroActions a {
          min-height: 41px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 14px;
          border-radius: 10px;
          font: inherit;
          font-size: 9px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        .refreshButton.refreshing {
          animation: refreshPulse 1s ease-in-out infinite;
        }

        .refreshButton.refreshing::first-letter {
          display: inline-block;
          animation: refreshSpin 0.8s linear infinite;
        }

        :global(.newBillButton) {
          position: relative;
          overflow: hidden;
          animation: newBillGlow 2.4s ease-in-out infinite;
        }

        :global(.newBillButton)::after {
          content: "";
          position: absolute;
          top: -20%;
          left: -55%;
          width: 32%;
          height: 140%;
          background: rgba(255, 255, 255, 0.48);
          transform: rotate(18deg);
          animation: newBillShine 3.5s ease-in-out infinite;
        }

        .heroActions button {
          border: 1px solid rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.09);
          color: #ffffff;
        }

        .heroActions a {
          border: 1px solid ${GOLD};
          background: ${GOLD};
          color: ${ROYAL_BLUE};
        }

        .message {
          margin-top: 12px;
          padding: 11px 13px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 800;
        }

        .errorMessage {
          background: #fef3f2;
          color: #b42318;
        }

        .warningMessage {
          background: #fffaeb;
          color: #93370d;
        }

        .primaryKpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 15px;
        }

        .secondaryKpis,
        .catalogueKpis {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 9px;
          margin-top: 10px;
        }

        .quickActionsPanel,
        .panel {
          margin-top: 14px;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 19px;
          background: #ffffff;
          box-shadow: 0 12px 30px rgba(10, 46, 115, 0.07);
        }


        .todayOwnerProfitPanel {
          position: relative;
          overflow: hidden;
          margin-top: 14px;
          padding: 18px;
          border: 1px solid rgba(212, 175, 55, 0.52);
          border-radius: 20px;
          background:
            radial-gradient(
              circle at 90% -10%,
              rgba(212, 175, 55, 0.22),
              transparent 30%
            ),
            linear-gradient(135deg, #ffffff, #fbfcff);
          box-shadow: 0 14px 34px rgba(3, 21, 63, 0.08);
        }

        .todayProfitGlow {
          position: absolute;
          width: 190px;
          height: 190px;
          right: -70px;
          top: -110px;
          border-radius: 50%;
          background: rgba(212, 175, 55, 0.12);
          pointer-events: none;
          animation: profitPulse 4s ease-in-out infinite;
        }

        .todayProfitHeader {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding-bottom: 13px;
          border-bottom: 1px solid rgba(10, 46, 115, 0.08);
        }

        .todayProfitHeader span {
          color: ${GOLD};
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.85px;
        }

        .todayProfitHeader h2 {
          margin: 3px 0 2px;
          color: ${ROYAL_BLUE};
          font-size: 18px;
        }

        .todayProfitHeader p {
          max-width: 720px;
          margin: 0;
          color: #667085;
          font-size: 9px;
          line-height: 1.55;
        }

        .todayProfitOpenButton {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          padding: 0 13px;
          border: 1px solid rgba(212, 175, 55, 0.72);
          border-radius: 10px;
          background: ${ROYAL_BLUE};
          color: #fff;
          text-decoration: none;
          font-size: 9px;
          font-weight: 900;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .todayProfitOpenButton:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(10, 46, 115, 0.16);
        }

        .todayProfitLoading {
          padding: 24px 2px 6px;
          color: #667085;
          font-size: 10px;
          font-weight: 750;
        }

        .todayProfitGrid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 9px;
          margin-top: 13px;
        }

        .todayProfitMetric {
          min-width: 0;
          min-height: 104px;
          padding: 13px;
          border: 1px solid rgba(10, 46, 115, 0.09);
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 7px 18px rgba(3, 21, 63, 0.04);
        }

        .todayProfitMetric.heroMetric {
          background: linear-gradient(135deg, #24114a, #5a39d6);
          border-color: rgba(212, 175, 55, 0.48);
        }

        .todayProfitMetric span {
          display: block;
          color: #667085;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.55px;
        }

        .todayProfitMetric strong {
          display: block;
          margin-top: 9px;
          color: ${ROYAL_BLUE};
          font-size: 18px;
          line-height: 1.25;
        }

        .todayProfitMetric strong.positive {
          color: #80f2bd;
        }

        .todayProfitMetric strong.negative {
          color: #ffb4ad;
        }

        .todayProfitMetric small {
          display: block;
          margin-top: 7px;
          color: #98a2b3;
          font-size: 7px;
          line-height: 1.45;
        }

        .todayProfitMetric.heroMetric span {
          color: ${GOLD};
        }

        .todayProfitMetric.heroMetric small {
          color: rgba(255, 255, 255, 0.66);
        }

        .todayProfitMetric.warning {
          background: #fffaeb;
        }

        .todayProfitMetric.warning strong {
          color: #b54708;
        }

        .todayProfitMetric.danger {
          background: #fef3f2;
        }

        .todayProfitMetric.danger strong {
          color: #b42318;
        }

        .profitIntelligencePanel {
          position: relative;
          overflow: hidden;
          margin-top: 18px;
          border: 1px solid rgba(212, 175, 55, 0.48);
          border-radius: 22px;
          background:
            radial-gradient(circle at 92% 0%, rgba(212, 175, 55, 0.22), transparent 28%),
            linear-gradient(135deg, #24114a, #5a39d6 68%, #174da4);
          box-shadow: 0 18px 42px rgba(3, 21, 63, 0.18);
          color: #fff;
        }

        .profitGlow {
          position: absolute;
          width: 240px;
          height: 240px;
          right: -90px;
          top: -130px;
          border-radius: 50%;
          background: rgba(244, 216, 91, 0.18);
          filter: blur(3px);
          pointer-events: none;
          animation: profitPulse 4s ease-in-out infinite;
        }

        .profitHeader {
          position: relative;
          z-index: 1;
          border-bottom-color: rgba(255, 255, 255, 0.12) !important;
        }

        .profitHeader span {
          color: #f4d85b !important;
        }

        .profitHeader h2 {
          color: #fff !important;
        }

        .profitSubtitle {
          max-width: 760px;
          margin: 6px 0 0;
          color: rgba(255, 255, 255, 0.68);
          font-size: 11px;
          line-height: 1.55;
        }

        .profitOpenButton {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 15px;
          border: 1px solid rgba(212, 175, 55, 0.72);
          border-radius: 11px;
          background: linear-gradient(
            135deg,
            rgba(212, 175, 55, 0.16),
            rgba(255, 255, 255, 0.06)
          );
          color: #f7dc79 !important;
          font-size: 10px;
          font-weight: 950;
          text-decoration: none !important;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }

        .profitOpenButton:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
        }

        .profitDashboardGrid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          padding: 16px;
        }

        .profitMetricCard {
          min-height: 116px;
          padding: 15px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.07);
          backdrop-filter: blur(8px);
          transition: transform 0.18s ease, border-color 0.18s ease;
        }

        .profitMetricCard:hover {
          transform: translateY(-3px);
          border-color: rgba(244, 216, 91, 0.52);
        }

        .profitMetricCard.highlight {
          border-color: rgba(212, 175, 55, 0.46);
          background: linear-gradient(
            145deg,
            rgba(212, 175, 55, 0.17),
            rgba(255, 255, 255, 0.07)
          );
        }

        .profitMetricCard.warning {
          border-color: rgba(255, 165, 112, 0.36);
        }

        .profitMetricCard span,
        .profitMetricCard strong,
        .profitMetricCard small {
          display: block;
        }

        .profitMetricCard span {
          color: #f1d26a;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.55px;
        }

        .profitMetricCard strong {
          margin-top: 10px;
          color: #fff;
          font-size: 20px;
          line-height: 1;
        }

        .profitMetricCard small {
          margin-top: 9px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 8px;
          line-height: 1.45;
        }

        .profitLoading {
          position: relative;
          z-index: 1;
          padding: 25px 18px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 11px;
          font-weight: 800;
        }

        @keyframes profitPulse {
          0%, 100% { transform: scale(1); opacity: 0.65; }
          50% { transform: scale(1.12); opacity: 1; }
        }

        .googleBusinessPanel {
          margin-top: 18px;
          margin-bottom: 18px;
          padding: 22px;
          border: 1px solid rgba(212, 175, 55, 0.36);
          border-radius: 20px;
          background: #ffffff;
          box-shadow: 0 14px 34px rgba(3, 21, 63, 0.08);
        }

        .googleBusinessSubtitle {
          margin: 5px 0 0;
          color: #667085;
          font-size: 12px;
          line-height: 1.5;
        }

        .googleBusinessGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 12px;
          margin-top: 18px;
        }

        .googleBusinessLoading {
          padding: 28px 10px;
          color: #667085;
          font-size: 13px;
          font-weight: 800;
          text-align: center;
        }

        .googleConnectButton,
        .googleRefreshButton {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 14px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        .googleConnectButton {
          border: 1px solid #5a39d6;
          background: #5a39d6;
          color: #ffffff !important;
        }

        .googleRefreshButton {
          border: 1px solid #d4af37;
          background: #fffdf5;
          color: #5a39d6;
        }

        .googleRefreshButton:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .googleBusinessMessage {
          margin-top: 14px;
          padding: 12px 13px;
          border-radius: 11px;
          font-size: 12px;
          font-weight: 750;
          line-height: 1.55;
        }

        .googleBusinessMessage.warning {
          border: 1px solid #fde68a;
          background: #fffbeb;
          color: #92400e;
        }

        .googleBusinessMessage.error {
          border: 1px solid #fca5a5;
          background: #fff7f7;
          color: #b91c1c;
        }

        .quickActionsPanel {
          padding: 17px;
        }

        .sectionHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 17px 18px;
          border-bottom: 1px solid #edf0f4;
        }

        .quickActionsPanel .sectionHeader {
          padding: 0 0 13px;
        }

        .sectionHeader h2 {
          margin: 4px 0 0;
          color: ${ROYAL_BLUE};
          font-size: 18px;
        }

        .sectionHeader a,
        .sectionHeader > span {
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 900;
          text-decoration: none;
        }

        .sectionHeader select {
          min-height: 34px;
          padding: 0 9px;
          border: 1px solid #dce2eb;
          border-radius: 9px;
          background: #ffffff;
          color: ${ROYAL_BLUE};
          font: inherit;
          font-size: 8px;
          font-weight: 850;
        }

        .quickActionGrid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 9px;
        }

        .analyticsGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.65fr) minmax(270px, 0.75fr);
          gap: 14px;
        }

        .detailGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .commerceGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
          gap: 14px;
        }

        .panel {
          overflow: hidden;
        }

        .trendChart {
          height: 285px;
          display: flex;
          align-items: stretch;
          gap: 7px;
          padding: 20px 17px 15px;
          overflow-x: auto;
          background:
            linear-gradient(
              to bottom,
              rgba(10, 46, 115, 0.05) 1px,
              transparent 1px
            );
          background-size: 100% 25%;
        }

        .trendColumn {
          min-width: 35px;
          flex: 1;
          display: grid;
          grid-template-rows: 28px minmax(0, 1fr) 20px;
          align-items: end;
          gap: 5px;
          text-align: center;
        }

        .trendValue {
          overflow: hidden;
          color: ${ROYAL_BLUE};
          font-size: 6.5px;
          font-weight: 850;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .trendTrack {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: flex-end;
          overflow: hidden;
          border-radius: 8px 8px 3px 3px;
          background: rgba(10, 46, 115, 0.05);
        }

        .trendBar {
          width: 100%;
          min-height: 3px;
          border-radius: 8px 8px 3px 3px;
          background: linear-gradient(
            180deg,
            #f0d36d,
            ${GOLD} 40%,
            ${ROYAL_BLUE}
          );
          animation: chartRise 0.7s ease both;
        }

        .trendColumn > span {
          color: #7b8491;
          font-size: 6.5px;
          font-weight: 750;
          white-space: nowrap;
        }

        .alertList,
        .compactList {
          display: grid;
          gap: 7px;
          padding: 11px;
          background: #f8fafc;
        }

        .compactList {
          max-height: 390px;
          overflow: auto;
        }

        .compactRow {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 62px;
          padding: 10px;
          border: 1px solid #e4e7ec;
          border-radius: 11px;
          background: #ffffff;
        }

        .rowIcon {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: #eef4ff;
          color: ${ROYAL_BLUE};
          font-size: 16px;
          font-weight: 950;
        }

        .rowMain {
          min-width: 0;
          flex: 1;
        }

        .rowMain strong,
        .rowMain span,
        .rowAmount,
        .rowAmount small {
          display: block;
        }

        .rowMain strong {
          overflow: hidden;
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 900;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rowMain span {
          margin-top: 3px;
          overflow: hidden;
          color: #7b8491;
          font-size: 7px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rowAmount {
          flex-shrink: 0;
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 950;
          text-align: right;
        }

        .rowAmount.danger {
          color: #b42318;
        }

        .rowAmount.warning {
          color: #b54708;
        }

        .rowAmount small {
          margin-top: 3px;
          color: #98a2b3;
          font-size: 6.5px;
          font-weight: 700;
        }

        .stockPill {
          flex-shrink: 0;
          padding: 6px 8px;
          border-radius: 999px;
          font-size: 7px;
          font-weight: 900;
        }

        .stockPill.low {
          background: #fffaeb;
          color: #b54708;
        }

        .stockPill.out {
          background: #fef3f2;
          color: #b42318;
        }

        .liveBadge {
          padding: 6px 9px;
          border-radius: 999px;
          background: #ecfdf3;
          color: #067647 !important;
        }

        .visitorMetrics {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 7px;
          padding: 11px;
        }

        .popularPages {
          display: grid;
          gap: 6px;
          padding: 0 11px 11px;
        }

        .popularPages > div {
          display: grid;
          grid-template-columns: 26px minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          padding: 8px;
          border: 1px solid #e4e7ec;
          border-radius: 9px;
        }

        .popularPages b {
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 7px;
          background: ${ROYAL_BLUE};
          color: ${GOLD};
          font-size: 7px;
        }

        .popularPages span {
          overflow: hidden;
          color: #667085;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .popularPages strong {
          color: ${ROYAL_BLUE};
          font-size: 9px;
        }

        @keyframes chartRise {
          from {
            height: 0;
            opacity: 0.2;
          }
        }

        @keyframes heroCustomerExit {
          0% {
            right: 26px;
            opacity: 0;
            transform: translateY(2px) scale(0.88);
          }

          8% {
            opacity: 1;
          }

          24% {
            right: 72px;
            opacity: 1;
            transform: translateY(0) scale(1);
          }

          45% {
            right: 142px;
            opacity: 1;
          }

          72% {
            right: 230px;
            opacity: 1;
            transform: translateY(-2px) scale(0.98);
          }

          100% {
            right: 324px;
            opacity: 0;
            transform: translateY(-4px) scale(0.9);
          }
        }

        @keyframes heroBagSwing {
          0%,
          100% {
            transform: rotate(-5deg) translateY(0);
          }

          50% {
            transform: rotate(6deg) translateY(-2px);
          }
        }

        @keyframes selectedMenuGoldShine {
          0%,
          58% {
            left: -55%;
          }

          82%,
          100% {
            left: 135%;
          }
        }

        @keyframes selectedMenuGoldGlow {
          0%,
          100% {
            box-shadow:
              inset 0 0 0 1px rgba(212, 175, 55, 0.18),
              0 7px 18px rgba(212, 175, 55, 0.12);
          }

          50% {
            box-shadow:
              inset 0 0 0 1px rgba(255, 239, 159, 0.44),
              0 10px 26px rgba(212, 175, 55, 0.26);
          }
        }

        @keyframes heroSweep {
          0%,
          18% {
            left: -38%;
            opacity: 0;
          }

          36% {
            opacity: 1;
          }

          64%,
          100% {
            left: 125%;
            opacity: 0;
          }
        }

        @keyframes heroOrbFloat {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }

          50% {
            transform: translateY(12px) scale(1.06);
          }
        }

        @keyframes heroRupeeFloat {
          0%,
          100% {
            transform: translateY(0) rotate(-7deg);
          }

          50% {
            transform: translateY(12px) rotate(4deg);
          }
        }

        @keyframes refreshPulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
          }

          50% {
            box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12);
          }
        }

        @keyframes newBillGlow {
          0%,
          100% {
            box-shadow: 0 7px 18px rgba(212, 175, 55, 0.18);
          }

          50% {
            box-shadow: 0 10px 28px rgba(212, 175, 55, 0.34);
          }
        }

        @keyframes newBillShine {
          0%,
          58% {
            left: -55%;
          }

          82%,
          100% {
            left: 135%;
          }
        }

        @keyframes kpiMoneyRise {
          0% {
            transform: translateY(0) rotate(-7deg);
            opacity: 0;
          }

          16% {
            opacity: 1;
          }

          100% {
            transform: translateY(-150px) rotate(14deg);
            opacity: 0;
          }
        }

        @keyframes kpiPulseRing {
          0% {
            opacity: 0.38;
            transform: scale(0.55);
          }

          100% {
            opacity: 0;
            transform: scale(1.75);
          }
        }

        @keyframes miniCoinStack {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-4px);
          }
        }

        @keyframes miniDigitalWave {
          0% {
            opacity: 0.46;
            transform: scale(0.45);
          }

          100% {
            opacity: 0;
            transform: scale(1.7);
          }
        }

        @keyframes miniSymbolFloat {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(5px);
          }
        }

        @keyframes lossGlow {
          0%,
          100% {
            box-shadow: 0 0 0 rgba(244, 67, 54, 0);
          }

          50% {
            box-shadow: 0 0 18px rgba(244, 67, 54, 0.2);
          }
        }

        @keyframes profitGlow {
          0%,
          100% {
            box-shadow: 0 0 0 rgba(18, 183, 106, 0);
          }

          50% {
            box-shadow: 0 0 18px rgba(18, 183, 106, 0.2);
          }
        }

        @keyframes alertSoftPulse {
          0%,
          100% {
            transform: translateX(0);
            box-shadow: 0 0 0 rgba(10, 46, 115, 0);
          }

          50% {
            transform: translateX(2px);
            box-shadow: 0 7px 16px rgba(10, 46, 115, 0.08);
          }
        }

        @keyframes quickIconFloat {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }

          50% {
            transform: translateY(-3px) scale(1.06);
          }
        }

        @keyframes quickIconGlow {
          0%,
          100% {
            opacity: 0.45;
            transform: scale(0.82);
          }

          50% {
            opacity: 1;
            transform: scale(1.16);
          }
        }

        @keyframes quickIconRing {
          0% {
            opacity: 0.48;
            transform: scale(0.72);
          }

          100% {
            opacity: 0;
            transform: scale(1.38);
          }
        }

        @keyframes quickIconPop {
          0% {
            transform: scale(1);
          }

          45% {
            transform: scale(1.24) rotate(-6deg);
          }

          100% {
            transform: scale(1.08);
          }
        }

        @media (max-width: 1250px) {
          .primaryKpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .secondaryKpis,
          .catalogueKpis,
          .quickActionGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .detailGrid {
            grid-template-columns: 1fr 1fr;
          }

          .detailGrid .panel:last-child {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 950px) {
          .hero {
            align-items: stretch;
            flex-direction: column;
          }

          .analyticsGrid,
          .commerceGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .heroSweep,
          .heroOrb,
          .heroRupee,
          .businessKpiMotion span,
          .businessKpiPulse,
          .miniMotion i,
          .miniSymbol,
          :global(.newBillButton),
          :global(.alertRow.activeAlert),
          .quickActionIcon b,
          .quickActionIconGlow,
          .quickActionIconRing {
            animation: none !important;
          }
        }


        /* =========================================================
           PREMIUM DASHBOARD V2 — OWNER EXECUTIVE VIEW
           Pure presentation upgrade. Existing data/routes stay intact.
           ========================================================= */

        .dashboardPage {
          position: relative;
          background:
            radial-gradient(
              circle at 0% 0%,
              rgba(212, 175, 55, 0.18),
              transparent 25%
            ),
            radial-gradient(
              circle at 100% 18%,
              rgba(10, 46, 115, 0.10),
              transparent 24%
            ),
            linear-gradient(
              180deg,
              #f7f2e7 0%,
              #fbfaf6 42%,
              #ffffff 100%
            );
        }

        .dashboardPage::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.28;
          background-image:
            linear-gradient(
              rgba(10, 46, 115, 0.028) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(10, 46, 115, 0.028) 1px,
              transparent 1px
            );
          background-size: 32px 32px;
          mask-image:
            linear-gradient(
              to bottom,
              rgba(0, 0, 0, 0.55),
              transparent 72%
            );
        }

        .hero {
          min-height: 190px;
          padding: 30px 32px;
          border-radius: 28px;
          border: 1px solid rgba(244, 220, 129, 0.48);
          box-shadow:
            0 28px 70px rgba(3, 21, 63, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.10);
        }

        .hero::after {
          content: "";
          position: absolute;
          inset: 1px;
          pointer-events: none;
          border-radius: 27px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .hero > div:not(.heroMotion) {
          position: relative;
          z-index: 3;
        }

        .hero h1 {
          max-width: 780px;
          font-size: clamp(30px, 4vw, 48px);
          line-height: 1.04;
          letter-spacing: -1.6px;
        }

        .hero p {
          max-width: 780px;
          color: rgba(255, 255, 255, 0.76);
          font-size: 12px;
        }

        .heroActions {
          align-self: center;
          padding: 7px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.055);
          backdrop-filter: blur(16px);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .heroActions button,
        :global(.newBillButton) {
          min-height: 42px;
          border-radius: 11px !important;
        }

        .executivePulseStrip {
          position: relative;
          z-index: 4;
          display: grid;
          grid-template-columns:
            minmax(260px, 1.65fr)
            repeat(4, minmax(150px, 1fr));
          gap: 10px;
          margin: -20px 18px 24px;
          padding: 10px;
          border: 1px solid rgba(212, 175, 55, 0.34);
          border-radius: 20px;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.94),
              rgba(255, 251, 239, 0.92)
            );
          backdrop-filter: blur(18px);
          box-shadow:
            0 20px 45px rgba(3, 21, 63, 0.14),
            inset 0 1px 0 #ffffff;
        }

        .executivePulseLead,
        .executivePulseMetric {
          position: relative;
          min-width: 0;
          min-height: 93px;
          overflow: hidden;
          padding: 14px 15px;
          border-radius: 14px;
        }

        .executivePulseLead {
          display: flex;
          flex-direction: column;
          justify-content: center;
          border: 1px solid rgba(212, 175, 55, 0.30);
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(212, 175, 55, 0.22),
              transparent 42%
            ),
            linear-gradient(
              135deg,
              #24114a,
              #5a39d6
            );
          color: #ffffff;
        }

        .executivePulseLead span,
        .executivePulseMetric span {
          color: #d4af37;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .executivePulseLead strong {
          margin-top: 6px;
          font-size: 15px;
          line-height: 1.25;
        }

        .executivePulseLead small {
          margin-top: 6px;
          color: rgba(255, 255, 255, 0.60);
          font-size: 7px;
          line-height: 1.45;
        }

        .executivePulseMetric {
          display: flex;
          flex-direction: column;
          justify-content: center;
          border: 1px solid rgba(10, 46, 115, 0.08);
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.98),
              rgba(248, 250, 255, 0.96)
            );
          box-shadow:
            inset 0 1px 0 #ffffff,
            0 8px 20px rgba(10, 46, 115, 0.055);
        }

        .executivePulseMetric::after {
          content: "";
          position: absolute;
          right: -26px;
          bottom: -36px;
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: rgba(10, 46, 115, 0.045);
        }

        .executivePulseMetric.profit::after {
          background: rgba(18, 183, 106, 0.10);
        }

        .executivePulseMetric.money::after {
          background: rgba(212, 175, 55, 0.13);
        }

        .executivePulseMetric.attention::after {
          background: rgba(247, 144, 9, 0.10);
        }

        .executivePulseMetric.attention.active {
          border-color: rgba(240, 68, 56, 0.22);
          background:
            linear-gradient(
              145deg,
              #fffdf9,
              #fff7f4
            );
        }

        .executivePulseMetric strong {
          position: relative;
          z-index: 2;
          margin-top: 7px;
          overflow: hidden;
          color: #5a39d6;
          font-size: 18px;
          font-weight: 950;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .executivePulseMetric small {
          position: relative;
          z-index: 2;
          margin-top: 5px;
          color: #7b8494;
          font-size: 6.5px;
        }

        .primaryKpis {
          gap: 12px;
          margin-bottom: 18px;
        }

        :global(.businessKpi) {
          min-height: 136px !important;
          border-radius: 20px !important;
          box-shadow:
            0 16px 34px rgba(3, 21, 63, 0.16) !important;
          transition:
            transform 0.24s ease,
            box-shadow 0.24s ease,
            border-color 0.24s ease;
        }

        :global(.businessKpi:hover) {
          transform: translateY(-3px);
          border-color: rgba(255, 229, 140, 0.60) !important;
          box-shadow:
            0 22px 44px rgba(3, 21, 63, 0.22) !important;
        }

        .todayOwnerProfitPanel {
          padding: 22px;
          border: 1px solid rgba(212, 175, 55, 0.42);
          border-radius: 24px;
          background:
            radial-gradient(
              circle at 0% 0%,
              rgba(212, 175, 55, 0.16),
              transparent 29%
            ),
            linear-gradient(
              135deg,
              #ffffff 0%,
              #fbf8ee 60%,
              #f7f9fe 100%
            );
          box-shadow:
            0 18px 46px rgba(3, 21, 63, 0.10);
        }

        .todayProfitHeader {
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(10, 46, 115, 0.08);
        }

        .todayProfitHeader h2 {
          font-size: clamp(24px, 3vw, 34px);
          letter-spacing: -0.8px;
        }

        .todayProfitGrid {
          gap: 10px;
          margin-top: 16px;
        }

        .todayProfitMetric {
          min-height: 112px;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(10, 46, 115, 0.08);
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.96),
              rgba(247, 249, 253, 0.96)
            );
          box-shadow: 0 9px 24px rgba(10, 46, 115, 0.055);
        }

        .todayProfitMetric.heroMetric {
          color: #ffffff;
          border-color: rgba(212, 175, 55, 0.52);
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(212, 175, 55, 0.22),
              transparent 44%
            ),
            linear-gradient(
              135deg,
              #24114a,
              #5a39d6
            );
          box-shadow: 0 18px 38px rgba(3, 21, 63, 0.20);
        }

        .secondaryKpis {
          gap: 10px;
        }

        :global(.miniKpi) {
          min-height: 96px !important;
          border-radius: 16px !important;
          border-color: rgba(212, 175, 55, 0.30) !important;
          box-shadow: 0 10px 26px rgba(3, 21, 63, 0.11);
          transition:
            transform 0.22s ease,
            box-shadow 0.22s ease;
        }

        :global(.miniKpi:hover) {
          transform: translateY(-2px);
          box-shadow: 0 15px 32px rgba(3, 21, 63, 0.17);
        }

        .googleBusinessPanel,
        .quickActionsPanel,
        .panel {
          border: 1px solid rgba(10, 46, 115, 0.075);
          border-radius: 22px;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.98),
              rgba(252, 250, 244, 0.98)
            );
          box-shadow:
            0 14px 36px rgba(3, 21, 63, 0.075);
        }

        /* Keep Profit Intelligence as a dark executive panel.
           The previous V2 override made the background white while
           the original text remained white, which hid the content. */
        .profitIntelligencePanel {
          border: 1px solid rgba(212, 175, 55, 0.48);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 92% 0%,
              rgba(212, 175, 55, 0.22),
              transparent 28%
            ),
            linear-gradient(
              135deg,
              #24114a,
              #5a39d6 68%,
              #174da4
            );
          box-shadow:
            0 18px 42px rgba(3, 21, 63, 0.18);
          color: #ffffff;
        }

        .profitIntelligencePanel .sectionHeader h2,
        .profitIntelligencePanel .profitHeader h2 {
          color: #ffffff !important;
        }

        .profitIntelligencePanel .profitSubtitle {
          color: rgba(255, 255, 255, 0.70) !important;
        }

        .profitIntelligencePanel .profitMetricCard {
          border-color: rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.075);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .profitIntelligencePanel .profitMetricCard.highlight {
          border-color: rgba(212, 175, 55, 0.56);
          background:
            linear-gradient(
              145deg,
              rgba(212, 175, 55, 0.18),
              rgba(255, 255, 255, 0.07)
            );
        }

        .profitIntelligencePanel .profitMetricCard span {
          color: #f1d26a !important;
        }

        .profitIntelligencePanel .profitMetricCard strong {
          color: #ffffff !important;
        }

        .profitIntelligencePanel .profitMetricCard small {
          color: rgba(255, 255, 255, 0.64) !important;
        }

        .googleBusinessPanel {
          color: #5a39d6;
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(212, 175, 55, 0.07),
              transparent 31%
            ),
            linear-gradient(
              145deg,
              #ffffff,
              #fbfcff
            );
        }

        .googleBusinessPanel .sectionHeader h2 {
          color: #5a39d6 !important;
        }

        .googleBusinessPanel .googleBusinessSubtitle {
          color: #667085 !important;
        }

        .sectionHeader {
          align-items: center;
          margin-bottom: 16px;
        }

        .sectionHeader > div > span {
          letter-spacing: 1.1px;
        }

        .sectionHeader h2 {
          margin-top: 4px;
          color: #5a39d6;
          font-size: 20px;
          letter-spacing: -0.35px;
        }

        .quickActionsPanel {
          position: relative;
          overflow: hidden;
          padding: 18px;
          border-color: rgba(212, 175, 55, 0.30);
        }

        .quickActionsPanel::before {
          content: "";
          position: absolute;
          right: -80px;
          top: -110px;
          width: 240px;
          height: 240px;
          border-radius: 50%;
          background:
            radial-gradient(
              circle,
              rgba(212, 175, 55, 0.12),
              transparent 66%
            );
          pointer-events: none;
        }

        .quickActionGrid {
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 8px;
        }

        :global(.quickAction) {
          min-height: 118px !important;
          border-radius: 16px !important;
          border-color: rgba(212, 175, 55, 0.30) !important;
          box-shadow:
            0 10px 25px rgba(3, 21, 63, 0.13);
          transition:
            transform 0.22s ease,
            box-shadow 0.22s ease,
            border-color 0.22s ease !important;
        }

        :global(.quickAction:hover) {
          transform: translateY(-4px) scale(1.01);
          border-color: rgba(255, 229, 140, 0.72) !important;
          box-shadow:
            0 18px 34px rgba(3, 21, 63, 0.20);
        }

        .analyticsGrid {
          grid-template-columns:
            minmax(0, 1.8fr)
            minmax(300px, 0.8fr);
          gap: 18px;
        }

        .salesTrendPanel {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 0% 0%,
              rgba(212, 175, 55, 0.09),
              transparent 32%
            ),
            linear-gradient(
              145deg,
              #ffffff,
              #fafbff
            );
        }

        .salesTrendPanel::after {
          content: "";
          position: absolute;
          left: 22px;
          right: 22px;
          bottom: 28px;
          height: 1px;
          background:
            linear-gradient(
              90deg,
              transparent,
              rgba(10, 46, 115, 0.12),
              transparent
            );
          pointer-events: none;
        }

        .trendChart {
          height: 300px;
          gap: 8px;
          padding: 18px 12px 2px;
          border-radius: 16px;
          background:
            linear-gradient(
              180deg,
              rgba(10, 46, 115, 0.025),
              rgba(255, 255, 255, 0)
            );
        }

        .trendColumn {
          min-width: 0;
          transition: transform 0.2s ease;
        }

        .trendColumn:hover {
          transform: translateY(-3px);
        }

        .trendColumn:hover .trendValue {
          color: #5a39d6;
          transform: scale(1.04);
        }

        .trendTrack {
          border: 1px solid rgba(10, 46, 115, 0.055);
          background:
            linear-gradient(
              180deg,
              rgba(10, 46, 115, 0.035),
              rgba(10, 46, 115, 0.01)
            );
        }

        .trendBar {
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(
              180deg,
              #f5dc82 0%,
              #d4af37 36%,
              #5a39d6 100%
            );
          box-shadow:
            0 8px 18px rgba(10, 46, 115, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.45);
        }

        .trendBar::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(
              110deg,
              transparent 25%,
              rgba(255, 255, 255, 0.52) 45%,
              transparent 65%
            );
          transform: translateX(-130%);
          animation: premiumBarShine 3.8s ease-in-out infinite;
        }

        .alertPanel {
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(240, 68, 56, 0.07),
              transparent 30%
            ),
            linear-gradient(
              145deg,
              #ffffff,
              #fffaf8
            );
        }

        .alertList {
          gap: 9px;
        }

        :global(.alertRow) {
          border-radius: 14px !important;
          box-shadow: 0 7px 18px rgba(3, 21, 63, 0.045);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease !important;
        }

        :global(.alertRow:hover) {
          transform: translateX(3px);
          box-shadow: 0 10px 22px rgba(3, 21, 63, 0.08);
        }

        .detailGrid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          align-items: stretch;
          gap: 14px;
        }

        .detailGrid > .panel {
          height: 100%;
          min-height: 310px;
        }

        .compactList {
          height: 100%;
          align-content: start;
        }

        .compactRow {
          min-height: 61px;
          border-radius: 13px;
          border: 1px solid rgba(10, 46, 115, 0.075);
          background:
            linear-gradient(
              145deg,
              #ffffff,
              #fbfcff
            );
          box-shadow: 0 5px 14px rgba(3, 21, 63, 0.035);
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            box-shadow 0.18s ease;
        }

        .compactRow:hover {
          transform: translateY(-1px);
          border-color: rgba(212, 175, 55, 0.32);
          box-shadow: 0 9px 20px rgba(3, 21, 63, 0.065);
        }

        .commerceGrid {
          grid-template-columns:
            minmax(0, 0.82fr)
            minmax(0, 1.18fr);
          align-items: stretch;
          gap: 16px;
        }

        .recentOrdersPanel.emptyCompact {
          min-height: 0;
        }

        .recentOrdersPanel.emptyCompact :global(.emptyState) {
          min-height: 132px !important;
          padding: 18px !important;
        }

        .commerceGrid > .panel:last-child {
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(212, 175, 55, 0.09),
              transparent 31%
            ),
            linear-gradient(
              145deg,
              #ffffff,
              #fafcff
            );
        }

        .visitorMetrics {
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 7px;
        }

        :global(.visitorMetric) {
          min-height: 76px;
          display: flex !important;
          flex-direction: column;
          justify-content: center;
          border: 1px solid rgba(212, 175, 55, 0.28);
          border-radius: 14px !important;
          box-shadow: 0 9px 22px rgba(3, 21, 63, 0.10);
        }

        .popularPages > div {
          border-radius: 11px;
          transition:
            background 0.18s ease,
            transform 0.18s ease;
        }

        .popularPages > div:hover {
          background: rgba(212, 175, 55, 0.07);
          transform: translateX(2px);
        }

        .executiveSectionLabel {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin: 26px 2px 11px;
          padding: 0 3px;
        }

        .executiveSectionLabel span {
          color: #d4af37;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 1.3px;
        }

        .executiveSectionLabel h2 {
          margin: 3px 0 0;
          color: #5a39d6;
          font-size: 18px;
          letter-spacing: -0.35px;
        }

        .executiveSectionLabel small {
          color: #7b8494;
          font-size: 8px;
        }

        .catalogueKpis {
          gap: 9px;
          padding: 10px;
          border: 1px solid rgba(212, 175, 55, 0.20);
          border-radius: 20px;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.82),
              rgba(255, 251, 239, 0.78)
            );
          box-shadow: 0 13px 32px rgba(3, 21, 63, 0.055);
        }

        @keyframes premiumBarShine {
          0%,
          58% {
            transform: translateX(-130%);
          }

          78%,
          100% {
            transform: translateX(130%);
          }
        }

        @media (max-width: 1350px) {
          .executivePulseStrip {
            grid-template-columns:
              minmax(240px, 1.6fr)
              repeat(2, minmax(150px, 1fr));
          }

          .executivePulseLead {
            grid-row: span 2;
          }

          .quickActionGrid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 980px) {
          .executivePulseStrip {
            margin: 14px 0 22px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .executivePulseLead {
            grid-column: 1 / -1;
            grid-row: auto;
          }

          .quickActionGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .detailGrid {
            grid-template-columns: 1fr;
          }

          .detailGrid > .panel {
            min-height: 0;
          }

          .commerceGrid {
            grid-template-columns: 1fr;
          }

          .visitorMetrics {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .dashboardPage {
            padding: 12px 8px 30px;
          }

          .hero {
            min-height: auto;
            padding: 20px;
            border-radius: 22px;
          }

          .hero h1 {
            font-size: 30px;
            letter-spacing: -1px;
          }

          .executivePulseStrip {
            grid-template-columns: 1fr;
            margin: 12px 0 20px;
            padding: 8px;
            border-radius: 16px;
          }

          .executivePulseLead {
            grid-column: auto;
          }

          .executivePulseLead,
          .executivePulseMetric {
            min-height: 82px;
          }

          .executiveSectionLabel {
            align-items: flex-start;
            flex-direction: column;
            gap: 5px;
          }

          .heroOrbTwo,
          .heroRupee,
          .heroShopExit {
            display: none;
          }

          .businessKpiMotion span:nth-child(n + 2) {
            display: none;
          }

          .heroActions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .primaryKpis,
          .secondaryKpis,
          .catalogueKpis,
          .quickActionGrid,
          .detailGrid {
            grid-template-columns: 1fr;
          }

          .detailGrid .panel:last-child {
            grid-column: auto;
          }

          .visitorMetrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .trendChart {
            height: 250px;
          }
        }
      `}</style>
    </main>
  );
}

type BusinessKpiProps = {
  icon: string;
  label: string;
  value: string;
  note: string;
  tone: "blue" | "gold" | "green" | "red";
};

function GoogleBusinessMetric({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  icon: string;
  tone?: "success" | "warning" | "danger" | "gold" | "neutral";
}) {
  const toneStyles = {
    success: {
      background: "#F0FDF4",
      border: "#BBF7D0",
      color: "#166534",
    },
    warning: {
      background: "#FFFBEB",
      border: "#FDE68A",
      color: "#92400E",
    },
    danger: {
      background: "#FFF7F7",
      border: "#FCA5A5",
      color: "#B91C1C",
    },
    gold: {
      background: "#FFFDF5",
      border: "rgba(212,175,55,0.55)",
      color: "#8A6A00",
    },
    neutral: {
      background: "#F8FAFC",
      border: "#E5E7EB",
      color: "#5A39D6",
    },
  } as const;

  const selectedTone = toneStyles[tone];

  return (
    <div
      style={{
        minHeight: "104px",
        padding: "15px",
        border: `1px solid ${selectedTone.border}`,
        borderRadius: "14px",
        background: selectedTone.background,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "11px",
          color: "#667085",
          fontSize: "11px",
          fontWeight: 850,
        }}
      >
        <span style={{ fontSize: "17px" }}>{icon}</span>
        <span>{label}</span>
      </div>

      <strong
        style={{
          display: "block",
          color: selectedTone.color,
          fontSize: "18px",
          lineHeight: 1.3,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function BusinessKpi({
  icon,
  label,
  value,
  note,
  tone,
}: BusinessKpiProps) {
  return (
    <article className={`businessKpi ${tone}`}>
      <div className="businessKpiMotion" aria-hidden="true">
        <span>₹</span>
        <span>₹</span>
        <span>₹</span>
      </div>

      <div className="businessKpiPulse" aria-hidden="true" />

      <div className="businessKpiIcon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>

      <style jsx>{`
        .businessKpi {
          position: relative;
          min-width: 0;
          min-height: 124px;
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr);
          align-items: center;
          gap: 12px;
          overflow: hidden;
          padding: 17px;
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 18px;
          color: #ffffff;
          box-shadow: 0 12px 28px rgba(3, 21, 63, 0.14);
          animation: cardEnter 0.55s ease both;
        }

        .businessKpi.blue {
          background:
            radial-gradient(circle at 88% 5%, rgba(255,255,255,.22), transparent 28%),
            linear-gradient(135deg, #6D4DFF 0%, #8B5CF6 52%, #16B8D4 100%);
        }

        .businessKpi.gold {
          background:
            radial-gradient(circle at 88% 5%, rgba(255,255,255,.22), transparent 28%),
            linear-gradient(135deg, #F29B30 0%, #F6B85D 48%, #E950A5 100%);
        }

        .businessKpi.green {
          background:
            radial-gradient(circle at 88% 5%, rgba(255,255,255,.22), transparent 28%),
            linear-gradient(135deg, #00A67A 0%, #24BE91 52%, #16B8D4 100%);
        }

        .businessKpi.red {
          background:
            radial-gradient(circle at 88% 5%, rgba(255,255,255,.22), transparent 28%),
            linear-gradient(135deg, #E950A5 0%, #FF6B6B 52%, #F29B30 100%);
        }

        .businessKpiMotion {
          position: absolute;
          z-index: 0;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .businessKpiMotion span {
          position: absolute;
          bottom: -28px;
          color: rgba(212, 175, 55, 0.13);
          font-size: 30px;
          font-weight: 950;
          animation: kpiMoneyRise 7s linear infinite;
        }

        .businessKpiMotion span:nth-child(1) {
          left: 9%;
          animation-delay: -1.2s;
        }

        .businessKpiMotion span:nth-child(2) {
          left: 58%;
          animation-delay: -3.8s;
          font-size: 22px;
        }

        .businessKpiMotion span:nth-child(3) {
          left: 84%;
          animation-delay: -5.6s;
          font-size: 38px;
        }

        .businessKpiPulse {
          position: absolute;
          right: 22px;
          bottom: 18px;
          width: 44px;
          height: 44px;
          border: 2px solid rgba(212, 175, 55, 0.35);
          border-radius: 50%;
          animation: kpiPulseRing 2.8s ease-out infinite;
        }

        .businessKpi > div:not(.businessKpiMotion):not(.businessKpiPulse) {
          position: relative;
          z-index: 2;
        }

        .businessKpi::after {
          content: "";
          position: absolute;
          width: 130px;
          height: 130px;
          top: -80px;
          right: -35px;
          border-radius: 50%;
          background: rgba(212, 175, 55, 0.2);
        }

        .businessKpiIcon {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(212, 175, 55, 0.55);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.09);
          color: ${GOLD};
          font-size: 19px;
          font-weight: 950;
        }

        span,
        strong,
        small {
          display: block;
        }

        span {
          width: fit-content;
          padding: 4px 8px;
          border: 1px solid rgba(255,255,255,.35);
          border-radius: 999px;
          background: rgba(255,255,255,.16);
          color: #ffffff;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          text-shadow: 0 1px 4px rgba(0,0,0,.14);
        }

        strong {
          margin-top: 6px;
          overflow: hidden;
          color: #ffffff;
          font-size: clamp(21px, 2.2vw, 27px);
          font-weight: 950;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        small {
          margin-top: 5px;
          color: rgba(255, 255, 255, 0.64);
          font-size: 7px;
        }

        @keyframes cardEnter {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
        }
      `}</style>
    </article>
  );
}

type MiniKpiProps = {
  label: string;
  value: string;
  note: string;
  motion?: "cash" | "digital" | "expense" | "purchase" | "profit" | "loss";
};

function MiniKpi({
  label,
  value,
  note,
  motion,
}: MiniKpiProps) {
  return (
    <article className={`miniKpi ${motion || ""}`}>
      <div className="miniMotion" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <div className="miniSymbol" aria-hidden="true">
        {motion === "cash"
          ? "₹"
          : motion === "digital"
            ? "◈"
            : motion === "expense"
              ? "↓"
              : motion === "purchase"
                ? "▣"
                : motion === "profit"
                  ? "↗"
                  : motion === "loss"
                    ? "↘"
                    : ""}
      </div>

      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>

      <style jsx>{`
        .miniKpi {
          position: relative;
          min-width: 0;
          overflow: hidden;
          min-height: 91px;
          padding: 13px;
          border: 1px solid rgba(212, 175, 55, 0.23);
          border-radius: 14px;
          background: linear-gradient(
            135deg,
            #FFFFFF,
            #F6F3FF
          );
          color: #ffffff;
        }

        .miniKpi > span,
        .miniKpi > strong,
        .miniKpi > small {
          position: relative;
          z-index: 2;
        }

        .miniMotion {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .miniMotion i {
          position: absolute;
          right: 18px;
          bottom: 13px;
          width: 30px;
          height: 8px;
          border: 1px solid rgba(255, 255, 255, 0.28);
          border-radius: 50%;
          background: linear-gradient(180deg, #ffe58c, ${GOLD});
          opacity: 0;
        }

        .miniKpi.cash .miniMotion i {
          opacity: 0.5;
          animation: miniCoinStack 2.5s ease-in-out infinite;
        }

        .miniKpi.cash .miniMotion i:nth-child(2) {
          bottom: 20px;
          animation-delay: 0.18s;
        }

        .miniKpi.cash .miniMotion i:nth-child(3) {
          bottom: 27px;
          animation-delay: 0.36s;
        }

        .miniKpi.digital .miniMotion i {
          right: 24px;
          bottom: 20px;
          width: 18px;
          height: 18px;
          border: 2px solid rgba(212, 175, 55, 0.4);
          border-radius: 50%;
          background: transparent;
          opacity: 1;
          animation: miniDigitalWave 2.4s ease-out infinite;
        }

        .miniKpi.digital .miniMotion i:nth-child(2) {
          animation-delay: 0.8s;
        }

        .miniKpi.digital .miniMotion i:nth-child(3) {
          animation-delay: 1.6s;
        }

        .miniKpi.loss {
          animation: lossGlow 2.6s ease-in-out infinite;
        }

        .miniKpi.profit {
          animation: profitGlow 2.6s ease-in-out infinite;
        }

        .miniSymbol {
          position: absolute;
          z-index: 1;
          right: 12px;
          top: 12px;
          color: rgba(101, 84, 146, 0.16);
          font-size: 28px;
          font-weight: 950;
          animation: miniSymbolFloat 3.6s ease-in-out infinite;
        }

        span,
        strong,
        small {
          display: block;
        }

        span {
          color: #665A89;
          font-size: 7px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.35px;
        }

        strong {
          margin-top: 6px;
          overflow: hidden;
          color: #273042;
          font-size: 15px;
          font-weight: 950;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        small {
          margin-top: 5px;
          color: #7A8190;
          font-size: 6.5px;
        }
      `}</style>
    </article>
  );
}

type QuickActionProps = {
  href: string;
  icon: string;
  title: string;
  text: string;
};

function QuickAction({
  href,
  icon,
  title,
  text,
}: QuickActionProps) {
  return (
    <Link href={href} className="quickAction">
      <div className="quickActionIcon">
        <span className="quickActionIconGlow" aria-hidden="true" />
        <span className="quickActionIconRing" aria-hidden="true" />
        <b>{icon}</b>
      </div>
      <strong>{title}</strong>
      <span>{text}</span>

      <style jsx>{`
        :global(.quickAction) {
          position: relative;
          min-height: 112px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 13px;
          border: 1px solid rgba(212, 175, 55, 0.22);
          border-radius: 13px;
          background: linear-gradient(
            135deg,
            ${ROYAL_BLUE},
            ${DEEP_BLUE}
          );
          text-decoration: none;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        :global(.quickAction)::after {
          content: "";
          position: absolute;
          top: -30%;
          left: -60%;
          width: 34%;
          height: 170%;
          background:
            linear-gradient(
              90deg,
              transparent,
              rgba(255, 255, 255, 0.2),
              transparent
            );
          transform: rotate(18deg);
          transition: left 0.55s ease;
        }

        :global(.quickAction:hover)::after {
          left: 130%;
        }

        :global(.quickAction:hover) .quickActionIcon {
          transform: translateY(-4px) rotate(-3deg) scale(1.05);
          border-color: rgba(212, 175, 55, 0.82);
          box-shadow:
            0 10px 22px rgba(212, 175, 55, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.18);
        }

        :global(.quickAction:hover) .quickActionIcon b {
          animation: quickIconPop 0.55s ease both;
        }

        :global(.quickAction:hover) {
          transform: translateY(-3px);
          box-shadow: 0 13px 25px rgba(3, 21, 63, 0.18);
        }

        .quickActionIcon {
          position: relative;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.48);
          border-radius: 12px;
          background:
            radial-gradient(
              circle at 30% 25%,
              rgba(255, 255, 255, 0.18),
              transparent 48%
            ),
            rgba(255, 255, 255, 0.08);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            0 7px 16px rgba(2, 11, 36, 0.18);
          transition:
            transform 0.22s ease,
            box-shadow 0.22s ease,
            border-color 0.22s ease;
        }

        .quickActionIcon b {
          position: relative;
          z-index: 3;
          font-size: 16px;
          line-height: 1;
          animation: quickIconFloat 2.8s ease-in-out infinite;
        }

        .quickActionIconGlow {
          position: absolute;
          z-index: 1;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background:
            radial-gradient(
              circle,
              rgba(212, 175, 55, 0.42),
              rgba(212, 175, 55, 0.08) 58%,
              transparent 72%
            );
          animation: quickIconGlow 2.2s ease-in-out infinite;
        }

        .quickActionIconRing {
          position: absolute;
          z-index: 2;
          inset: 5px;
          border: 1px solid rgba(212, 175, 55, 0.42);
          border-radius: 50%;
          animation: quickIconRing 2.6s ease-out infinite;
        }

        :global(.quickAction:nth-child(2)) .quickActionIcon b {
          animation-delay: -0.35s;
        }

        :global(.quickAction:nth-child(3)) .quickActionIcon b {
          animation-delay: -0.7s;
        }

        :global(.quickAction:nth-child(4)) .quickActionIcon b {
          animation-delay: -1.05s;
        }

        :global(.quickAction:nth-child(5)) .quickActionIcon b {
          animation-delay: -1.4s;
        }

        :global(.quickAction:nth-child(6)) .quickActionIcon b {
          animation-delay: -1.75s;
        }

        strong {
          margin-top: 10px;
          color: #ffffff;
          font-size: 9px;
          font-weight: 900;
        }

        span {
          margin-top: 4px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 7px;
          line-height: 1.4;
        }
      `}</style>
    </Link>
  );
}

type AlertRowProps = {
  icon: string;
  title: string;
  value: number;
  href: string;
  tone: "amber" | "red" | "blue" | "green";
};

function AlertRow({
  icon,
  title,
  value,
  href,
  tone,
}: AlertRowProps) {
  return (
    <Link
      href={href}
      className={`alertRow ${tone} ${value > 0 ? "activeAlert" : ""}`}
    >
      <div>{icon}</div>
      <span>{title}</span>
      <strong>{value}</strong>

      <style jsx>{`
        :global(.alertRow) {
          min-height: 58px;
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr) auto;
          align-items: center;
          gap: 9px;
          padding: 9px;
          border: 1px solid #e4e7ec;
          border-left-width: 4px;
          border-radius: 11px;
          background: #ffffff;
          text-decoration: none;
        }

        :global(.alertRow.amber) {
          border-left-color: #f79009;
        }

        :global(.alertRow.red) {
          border-left-color: #f04438;
        }

        :global(.alertRow.blue) {
          border-left-color: #2e90fa;
        }

        :global(.alertRow.green) {
          border-left-color: #12b76a;
        }

        :global(.alertRow.activeAlert) {
          animation: alertSoftPulse 2.8s ease-in-out infinite;
        }

        div {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #eef4ff;
          font-size: 15px;
        }

        span {
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 850;
        }

        strong {
          min-width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: ${ROYAL_BLUE};
          color: ${GOLD};
          font-size: 10px;
        }
      `}</style>
    </Link>
  );
}

type VisitorMetricProps = {
  label: string;
  value: number;
};

function VisitorMetric({
  label,
  value,
}: VisitorMetricProps) {
  return (
    <div className="visitorMetric">
      <span>{label}</span>
      <strong>{value}</strong>

      <style jsx>{`
        .visitorMetric {
          min-width: 0;
          padding: 10px;
          border-radius: 11px;
          background: linear-gradient(
            135deg,
            ${ROYAL_BLUE},
            ${DEEP_BLUE}
          );
          color: #ffffff;
          text-align: center;
        }

        span,
        strong {
          display: block;
        }

        span {
          color: ${GOLD};
          font-size: 6.5px;
          font-weight: 900;
        }

        strong {
          margin-top: 5px;
          font-size: 17px;
          font-weight: 950;
        }
      `}</style>
    </div>
  );
}

type EmptyStateProps = {
  icon: string;
  title: string;
  text: string;
};

function EmptyState({
  icon,
  title,
  text,
}: EmptyStateProps) {
  return (
    <div className="emptyState">
      <div>{icon}</div>
      <strong>{title}</strong>
      <p>{text}</p>

      <style jsx>{`
        .emptyState {
          min-height: 190px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          text-align: center;
        }

        div {
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          background: #eef4ff;
          font-size: 22px;
        }

        strong {
          margin-top: 12px;
          color: ${ROYAL_BLUE};
          font-size: 13px;
        }

        p {
          margin: 6px 0 0;
          color: #667085;
          font-size: 9px;
        }

        /* ============================================================
           NCS ADMIN DASHBOARD — INTERNATIONAL COLORFUL FINAL PASS
           VISUAL-ONLY OVERRIDES. DATA / ROUTES / LOGIC UNCHANGED.
           ============================================================ */
        .dashboardPage{background:radial-gradient(circle at 0% 0%,rgba(109,77,255,.12),transparent 25%),radial-gradient(circle at 100% 12%,rgba(22,184,212,.11),transparent 25%),radial-gradient(circle at 50% 100%,rgba(242,155,48,.09),transparent 28%),linear-gradient(180deg,#f8f9fd 0%,#f2f5fa 46%,#eef2f7 100%)!important;color:#172033!important}
        .hero{border:1px solid rgba(255,255,255,.20)!important;border-radius:28px!important;background:radial-gradient(circle at 90% -10%,rgba(255,255,255,.18),transparent 32%),radial-gradient(circle at 15% 120%,rgba(233,80,165,.26),transparent 33%),linear-gradient(125deg,#24114a 0%,#5a39d6 36%,#0a75ad 70%,#00a67a 100%)!important;box-shadow:0 26px 62px rgba(40,31,93,.24)!important}
        .hero::after{content:"NCS";position:absolute;right:28px;top:-25px;z-index:0;color:rgba(255,255,255,.055);font-size:130px;line-height:1;font-weight:1000;letter-spacing:-9px;pointer-events:none}.hero>div:not(.heroMotion){position:relative;z-index:2}.hero>div>span{color:#ffe58c!important}.hero h1{font-size:34px!important;letter-spacing:-1.3px!important}.hero p{color:rgba(255,255,255,.76)!important;max-width:720px}.hero small{color:rgba(255,255,255,.58)!important}
        .refreshButton{border:1px solid rgba(255,255,255,.26)!important;background:rgba(255,255,255,.12)!important;color:#fff!important;backdrop-filter:blur(10px)}:global(.newBillButton){border:0!important;background:linear-gradient(135deg,#ffe58c,#f29b30)!important;color:#24114a!important;box-shadow:0 10px 22px rgba(242,155,48,.28)!important}.heroActions>button:last-child{border-color:rgba(255,107,107,.42)!important;background:rgba(255,107,107,.14)!important;color:#fff!important}
        .executivePulseStrip{border:1px solid rgba(109,77,255,.13)!important;border-radius:24px!important;background:rgba(255,255,255,.94)!important;box-shadow:0 20px 48px rgba(35,43,73,.12)!important}.executivePulseLead,.executivePulseMetric{border-radius:18px!important;border:1px solid rgba(23,32,51,.07)!important;box-shadow:0 8px 18px rgba(23,32,51,.05)}.executivePulseLead{background:radial-gradient(circle at 90% 0%,rgba(255,255,255,.16),transparent 30%),linear-gradient(135deg,#5a39d6,#6d4dff 52%,#8b5cf6)!important;color:#fff!important}.executivePulseLead span,.executivePulseLead strong,.executivePulseLead small{color:#fff!important}.executivePulseMetric{background:#fff!important}
        .executivePulseMetric:nth-child(2){background:linear-gradient(135deg,#f1efff,#fff)!important;border-color:rgba(109,77,255,.18)!important}.executivePulseMetric.profit{background:linear-gradient(135deg,#eafaf5,#fff)!important;border-color:rgba(0,166,122,.18)!important}.executivePulseMetric.money{background:linear-gradient(135deg,#eafaff,#fff)!important;border-color:rgba(22,184,212,.18)!important}.executivePulseMetric.attention{background:linear-gradient(135deg,#fff7ea,#fff)!important;border-color:rgba(242,155,48,.18)!important}.executivePulseMetric.attention.active{background:linear-gradient(135deg,#fff0f0,#fff7f7)!important;border-color:rgba(255,107,107,.25)!important}
        .executivePulseMetric:nth-child(2) span,.executivePulseMetric:nth-child(2) strong{color:#6d4dff!important}.executivePulseMetric.profit span,.executivePulseMetric.profit strong{color:#00a67a!important}.executivePulseMetric.money span,.executivePulseMetric.money strong{color:#16b8d4!important}.executivePulseMetric.attention span,.executivePulseMetric.attention strong{color:#f29b30!important}.executivePulseMetric.attention.active span,.executivePulseMetric.attention.active strong{color:#e55050!important}
        .primaryKpis{gap:14px!important}.businessKpi{min-height:130px!important;border-radius:22px!important;border:1px solid rgba(255,255,255,.36)!important;box-shadow:0 17px 38px rgba(23,32,51,.14)!important}.businessKpi.blue{background:radial-gradient(circle at 95% 0%,rgba(255,255,255,.18),transparent 34%),linear-gradient(135deg,#5a39d6,#6d4dff 52%,#16b8d4)!important}.businessKpi.gold{background:radial-gradient(circle at 95% 0%,rgba(255,255,255,.18),transparent 34%),linear-gradient(135deg,#f29b30,#d97706 55%,#e950a5)!important}.businessKpi.green{background:radial-gradient(circle at 95% 0%,rgba(255,255,255,.18),transparent 34%),linear-gradient(135deg,#00a67a,#18b88c 52%,#16b8d4)!important}.businessKpi.red{background:radial-gradient(circle at 95% 0%,rgba(255,255,255,.18),transparent 34%),linear-gradient(135deg,#e950a5,#ff6b6b 55%,#f29b30)!important}.businessKpiIcon{border-color:rgba(255,255,255,.34)!important;background:rgba(255,255,255,.15)!important}
        .todayOwnerProfitPanel{border:1px solid rgba(109,77,255,.15)!important;border-radius:24px!important;background:radial-gradient(circle at 90% -10%,rgba(109,77,255,.13),transparent 28%),radial-gradient(circle at 5% 110%,rgba(22,184,212,.08),transparent 30%),linear-gradient(135deg,#fff,#faf9ff 58%,#f3fbfd)!important;box-shadow:0 16px 38px rgba(54,45,108,.09)!important}.todayProfitHeader span{color:#6d4dff!important}.todayProfitOpenButton{border:0!important;background:linear-gradient(135deg,#6d4dff,#16b8d4)!important;color:#fff!important;box-shadow:0 8px 19px rgba(109,77,255,.20)!important}
        .todayProfitMetric{border-radius:18px!important;background:#fff!important;box-shadow:0 8px 20px rgba(23,32,51,.05)}.todayProfitMetric:nth-child(6n+1){background:linear-gradient(135deg,#f1efff,#fff)!important;border-color:rgba(109,77,255,.18)!important}.todayProfitMetric:nth-child(6n+2){background:linear-gradient(135deg,#eafaf5,#fff)!important;border-color:rgba(0,166,122,.18)!important}.todayProfitMetric:nth-child(6n+3){background:linear-gradient(135deg,#eafaff,#fff)!important;border-color:rgba(22,184,212,.18)!important}.todayProfitMetric:nth-child(6n+4){background:linear-gradient(135deg,#fff7ea,#fff)!important;border-color:rgba(242,155,48,.18)!important}.todayProfitMetric:nth-child(6n+5){background:linear-gradient(135deg,#fff0f7,#fff)!important;border-color:rgba(233,80,165,.18)!important}.todayProfitMetric:nth-child(6n+6){background:linear-gradient(135deg,#f1f2ff,#fff)!important;border-color:rgba(92,107,192,.18)!important}
        .profitIntelligencePanel{border:1px solid rgba(255,255,255,.18)!important;border-radius:26px!important;background:radial-gradient(circle at 92% 0%,rgba(255,255,255,.15),transparent 29%),radial-gradient(circle at 0% 110%,rgba(233,80,165,.22),transparent 32%),linear-gradient(135deg,#24114a,#5a39d6 45%,#0a75ad 76%,#00a67a)!important;box-shadow:0 22px 52px rgba(40,31,93,.22)!important}.profitMetricCard{border-radius:18px!important;border-color:rgba(255,255,255,.18)!important;background:rgba(255,255,255,.10)!important;backdrop-filter:blur(10px)}.profitMetricCard.highlight{background:rgba(0,166,122,.17)!important;border-color:rgba(82,235,184,.26)!important}.profitMetricCard.warning{background:rgba(242,155,48,.17)!important;border-color:rgba(255,211,120,.28)!important}.profitOpenButton{border:1px solid rgba(255,255,255,.24)!important;background:rgba(255,255,255,.12)!important;color:#fff!important}
        :global(.miniKpi){border-radius:18px!important;border:1px solid rgba(23,32,51,.08)!important;background:#fff!important;box-shadow:0 9px 22px rgba(23,32,51,.055)!important}.secondaryKpis :global(.miniKpi:nth-child(6n+1)),.catalogueKpis :global(.miniKpi:nth-child(6n+1)){background:linear-gradient(135deg,#f1efff,#fff)!important;border-color:rgba(109,77,255,.18)!important}.secondaryKpis :global(.miniKpi:nth-child(6n+2)),.catalogueKpis :global(.miniKpi:nth-child(6n+2)){background:linear-gradient(135deg,#eafaf5,#fff)!important;border-color:rgba(0,166,122,.18)!important}.secondaryKpis :global(.miniKpi:nth-child(6n+3)),.catalogueKpis :global(.miniKpi:nth-child(6n+3)){background:linear-gradient(135deg,#fff0f7,#fff)!important;border-color:rgba(233,80,165,.18)!important}.secondaryKpis :global(.miniKpi:nth-child(6n+4)),.catalogueKpis :global(.miniKpi:nth-child(6n+4)){background:linear-gradient(135deg,#fff7ea,#fff)!important;border-color:rgba(242,155,48,.18)!important}.secondaryKpis :global(.miniKpi:nth-child(6n+5)),.catalogueKpis :global(.miniKpi:nth-child(6n+5)){background:linear-gradient(135deg,#eafaff,#fff)!important;border-color:rgba(22,184,212,.18)!important}.secondaryKpis :global(.miniKpi:nth-child(6n+6)),.catalogueKpis :global(.miniKpi:nth-child(6n+6)){background:linear-gradient(135deg,#f1f2ff,#fff)!important;border-color:rgba(92,107,192,.18)!important}
        .quickActionsPanel,.panel,.googleBusinessPanel{border:1px solid rgba(23,32,51,.075)!important;border-radius:23px!important;background:rgba(255,255,255,.97)!important;box-shadow:0 14px 34px rgba(23,32,51,.07)!important}.quickActionsPanel{background:radial-gradient(circle at 0% 0%,rgba(109,77,255,.09),transparent 28%),linear-gradient(135deg,#fff,#f8f7ff)!important}.sectionHeader{background:linear-gradient(90deg,#fff,#fafbfe)!important;border-bottom-color:rgba(23,32,51,.07)!important}.sectionHeader span{color:#6d4dff!important}.sectionHeader h2{color:#172033!important}
        .quickAction{border:1px solid rgba(23,32,51,.08)!important;border-radius:18px!important;background:#fff!important;box-shadow:0 8px 18px rgba(23,32,51,.045)!important}.quickAction:nth-child(8n+1){background:linear-gradient(135deg,#f1efff,#fff)!important;border-color:rgba(109,77,255,.18)!important}.quickAction:nth-child(8n+2){background:linear-gradient(135deg,#eafaf5,#fff)!important;border-color:rgba(0,166,122,.18)!important}.quickAction:nth-child(8n+3){background:linear-gradient(135deg,#fff0f7,#fff)!important;border-color:rgba(233,80,165,.18)!important}.quickAction:nth-child(8n+4){background:linear-gradient(135deg,#fff7ea,#fff)!important;border-color:rgba(242,155,48,.18)!important}.quickAction:nth-child(8n+5){background:linear-gradient(135deg,#eafaff,#fff)!important;border-color:rgba(22,184,212,.18)!important}.quickAction:nth-child(8n+6){background:linear-gradient(135deg,#f1f2ff,#fff)!important;border-color:rgba(92,107,192,.18)!important}.quickAction:nth-child(8n+7){background:linear-gradient(135deg,#fff2f2,#fff)!important;border-color:rgba(255,107,107,.18)!important}.quickAction:nth-child(8n+8){background:linear-gradient(135deg,#effaf7,#fff)!important;border-color:rgba(0,166,122,.18)!important}
        .quickAction:nth-child(8n+1) .quickActionIcon{background:linear-gradient(135deg,#6d4dff,#8b5cf6)!important}.quickAction:nth-child(8n+2) .quickActionIcon{background:linear-gradient(135deg,#00a67a,#26bf92)!important}.quickAction:nth-child(8n+3) .quickActionIcon{background:linear-gradient(135deg,#e950a5,#f47fc2)!important}.quickAction:nth-child(8n+4) .quickActionIcon{background:linear-gradient(135deg,#f29b30,#f6b85d)!important}.quickAction:nth-child(8n+5) .quickActionIcon{background:linear-gradient(135deg,#16b8d4,#36c7df)!important}.quickAction:nth-child(8n+6) .quickActionIcon{background:linear-gradient(135deg,#5c6bc0,#7987dc)!important}.quickAction:nth-child(8n+7) .quickActionIcon{background:linear-gradient(135deg,#ff6b6b,#f59898)!important}.quickAction:nth-child(8n+8) .quickActionIcon{background:linear-gradient(135deg,#00a67a,#16b8d4)!important}.quickActionIcon{color:#fff!important;border-color:rgba(255,255,255,.34)!important;box-shadow:0 8px 18px rgba(23,32,51,.10)}
        .salesTrendPanel{background:radial-gradient(circle at 100% 0%,rgba(22,184,212,.08),transparent 28%),#fff!important}.trendChart{border-radius:16px;background:linear-gradient(to bottom,rgba(109,77,255,.055) 1px,transparent 1px),linear-gradient(180deg,#fbfaff,#f5fbfd)!important;background-size:100% 25%,100% 100%!important}.trendTrack{background:#edf1f7!important}.trendBar{background:linear-gradient(180deg,#6d4dff,#16b8d4 62%,#00a67a)!important;box-shadow:0 5px 14px rgba(109,77,255,.18)}.trendValue{color:#6d4dff!important}
        .compactRow{border-radius:15px!important;border-color:rgba(23,32,51,.075)!important;background:#fff!important}.compactList .compactRow:nth-child(6n+1){background:linear-gradient(90deg,#f3efff,#fff)!important}.compactList .compactRow:nth-child(6n+2){background:linear-gradient(90deg,#eafaf5,#fff)!important}.compactList .compactRow:nth-child(6n+3){background:linear-gradient(90deg,#fff0f7,#fff)!important}.compactList .compactRow:nth-child(6n+4){background:linear-gradient(90deg,#fff7ea,#fff)!important}.compactList .compactRow:nth-child(6n+5){background:linear-gradient(90deg,#eafaff,#fff)!important}.compactList .compactRow:nth-child(6n+6){background:linear-gradient(90deg,#f1f2ff,#fff)!important}.compactList .compactRow:nth-child(6n+1) .rowIcon{background:#6d4dff!important;color:#fff!important}.compactList .compactRow:nth-child(6n+2) .rowIcon{background:#00a67a!important;color:#fff!important}.compactList .compactRow:nth-child(6n+3) .rowIcon{background:#e950a5!important;color:#fff!important}.compactList .compactRow:nth-child(6n+4) .rowIcon{background:#f29b30!important;color:#fff!important}.compactList .compactRow:nth-child(6n+5) .rowIcon{background:#16b8d4!important;color:#fff!important}.compactList .compactRow:nth-child(6n+6) .rowIcon{background:#5c6bc0!important;color:#fff!important}.rowMain strong{color:#172033!important}
        .visitorMetric{border-radius:15px!important;box-shadow:0 8px 18px rgba(23,32,51,.08)}.visitorMetrics .visitorMetric:nth-child(5n+1){background:linear-gradient(135deg,#6d4dff,#8b5cf6)!important}.visitorMetrics .visitorMetric:nth-child(5n+2){background:linear-gradient(135deg,#00a67a,#26bf92)!important}.visitorMetrics .visitorMetric:nth-child(5n+3){background:linear-gradient(135deg,#e950a5,#f47fc2)!important}.visitorMetrics .visitorMetric:nth-child(5n+4){background:linear-gradient(135deg,#f29b30,#f6b85d)!important}.visitorMetrics .visitorMetric:nth-child(5n+5){background:linear-gradient(135deg,#16b8d4,#36c7df)!important}.visitorMetric span,.visitorMetric strong{color:#fff!important}
        .googleBusinessPanel{background:radial-gradient(circle at 100% 0%,rgba(66,133,244,.08),transparent 30%),linear-gradient(135deg,#fff,#f8fbff)!important;border-color:rgba(66,133,244,.13)!important}.googleConnectButton{background:linear-gradient(135deg,#4285f4,#34a853)!important;color:#fff!important;border:0!important}.googleRefreshButton{background:#f1efff!important;color:#6d4dff!important;border-color:rgba(109,77,255,.20)!important}
        .message{border-radius:16px!important;box-shadow:0 10px 26px rgba(23,32,51,.08)!important}.errorMessage{background:linear-gradient(135deg,#fff0f0,#fff8f8)!important;border-color:rgba(255,107,107,.22)!important}.warningMessage{background:linear-gradient(135deg,#fff7ea,#fffdf7)!important;border-color:rgba(242,155,48,.22)!important}
        @media(max-width:760px){.dashboardPage{padding:10px!important}.hero{border-radius:22px!important;padding:18px 16px!important}.hero::after{font-size:70px;top:-5px;right:8px}.hero h1{font-size:27px!important}.executivePulseStrip{margin:-10px 7px 16px!important;border-radius:20px!important}.businessKpi{border-radius:18px!important}.todayOwnerProfitPanel,.profitIntelligencePanel,.quickActionsPanel,.panel,.googleBusinessPanel{border-radius:20px!important}}


        /* ============================================================
           DASHBOARD FINAL V2 — STRONG VISIBLE COLOR PASS
           ============================================================ */

        .dashboardPage .hero {
          background:
            radial-gradient(circle at 92% 0%,rgba(255,255,255,.20),transparent 32%),
            radial-gradient(circle at 10% 120%,rgba(233,80,165,.32),transparent 35%),
            linear-gradient(120deg,#301269 0%,#6d4dff 35%,#168eb8 69%,#00a67a 100%) !important;
        }

        .dashboardPage .executivePulseStrip {
          background:
            radial-gradient(circle at 0% 0%,rgba(109,77,255,.10),transparent 24%),
            radial-gradient(circle at 100% 100%,rgba(242,155,48,.10),transparent 25%),
            rgba(255,255,255,.96) !important;
        }

        .dashboardPage .executivePulseLead {
          background:linear-gradient(135deg,#5a39d6,#8b5cf6)!important;
        }

        .dashboardPage .executivePulseMetric:nth-child(2) {
          background:linear-gradient(135deg,#eadfff,#f7f1ff)!important;
        }

        .dashboardPage .executivePulseMetric.profit {
          background:linear-gradient(135deg,#d9f8eb,#f2fff9)!important;
        }

        .dashboardPage .executivePulseMetric.money {
          background:linear-gradient(135deg,#d9f6fc,#f2fdff)!important;
        }

        .dashboardPage .executivePulseMetric.attention {
          background:linear-gradient(135deg,#fff0cf,#fff9eb)!important;
        }

        .dashboardPage .executivePulseMetric.attention.active {
          background:linear-gradient(135deg,#ffe0e7,#fff2f5)!important;
        }

        .dashboardPage .businessKpi.blue {
          background:linear-gradient(135deg,#5031d2,#6d4dff 50%,#16b8d4)!important;
        }

        .dashboardPage .businessKpi.gold {
          background:linear-gradient(135deg,#d87908,#f29b30 52%,#e950a5)!important;
        }

        .dashboardPage .businessKpi.green {
          background:linear-gradient(135deg,#008864,#00a67a 50%,#16b8d4)!important;
        }

        .dashboardPage .businessKpi.red {
          background:linear-gradient(135deg,#ba357f,#e950a5 48%,#ff6b6b)!important;
        }

        .dashboardPage .businessKpi {
          border-color:rgba(255,255,255,.55)!important;
          box-shadow:0 18px 38px rgba(29,29,70,.18)!important;
        }

        .dashboardPage .businessKpiIcon {
          width:50px!important;
          height:50px!important;
          border:1px solid rgba(255,255,255,.50)!important;
          background:rgba(255,255,255,.17)!important;
          color:#fff7c7!important;
        }

        .dashboardPage .businessKpi > div > span,
        .dashboardPage .businessKpi > div > strong,
        .dashboardPage .businessKpi > div > small {
          color:#fff!important;
        }

        .dashboardPage .todayOwnerProfitPanel {
          background:
            radial-gradient(circle at 92% -5%,rgba(233,80,165,.14),transparent 27%),
            radial-gradient(circle at 0% 110%,rgba(22,184,212,.13),transparent 30%),
            linear-gradient(135deg,#f8f3ff 0%,#fff 42%,#edfbff 100%)!important;
          border-color:rgba(109,77,255,.22)!important;
        }

        .dashboardPage .todayProfitMetric:nth-child(6n+1) {
          background:linear-gradient(135deg,#eadfff,#faf7ff)!important;
        }
        .dashboardPage .todayProfitMetric:nth-child(6n+2) {
          background:linear-gradient(135deg,#d8f8eb,#f4fff9)!important;
        }
        .dashboardPage .todayProfitMetric:nth-child(6n+3) {
          background:linear-gradient(135deg,#d9f6fc,#f2fdff)!important;
        }
        .dashboardPage .todayProfitMetric:nth-child(6n+4) {
          background:linear-gradient(135deg,#ffedc8,#fff8eb)!important;
        }
        .dashboardPage .todayProfitMetric:nth-child(6n+5) {
          background:linear-gradient(135deg,#ffddeb,#fff4f8)!important;
        }
        .dashboardPage .todayProfitMetric:nth-child(6n+6) {
          background:linear-gradient(135deg,#e4e8ff,#f7f8ff)!important;
        }

        .dashboardPage .todayProfitMetric:nth-child(6n+1) span,
        .dashboardPage .todayProfitMetric:nth-child(6n+1) strong {color:#6d4dff!important}
        .dashboardPage .todayProfitMetric:nth-child(6n+2) span,
        .dashboardPage .todayProfitMetric:nth-child(6n+2) strong {color:#00a67a!important}
        .dashboardPage .todayProfitMetric:nth-child(6n+3) span,
        .dashboardPage .todayProfitMetric:nth-child(6n+3) strong {color:#16a9c2!important}
        .dashboardPage .todayProfitMetric:nth-child(6n+4) span,
        .dashboardPage .todayProfitMetric:nth-child(6n+4) strong {color:#d97c0c!important}
        .dashboardPage .todayProfitMetric:nth-child(6n+5) span,
        .dashboardPage .todayProfitMetric:nth-child(6n+5) strong {color:#d63f91!important}
        .dashboardPage .todayProfitMetric:nth-child(6n+6) span,
        .dashboardPage .todayProfitMetric:nth-child(6n+6) strong {color:#5c6bc0!important}

        .dashboardPage .profitIntelligencePanel {
          background:
            radial-gradient(circle at 95% 0%,rgba(255,255,255,.19),transparent 28%),
            radial-gradient(circle at 0% 110%,rgba(255,105,180,.28),transparent 32%),
            linear-gradient(125deg,#321269,#6d4dff 37%,#117da9 70%,#00a67a)!important;
        }

        .dashboardPage .quickActionsPanel {
          background:
            radial-gradient(circle at 0% 0%,rgba(109,77,255,.13),transparent 26%),
            radial-gradient(circle at 100% 100%,rgba(22,184,212,.11),transparent 27%),
            #fff!important;
        }

        .dashboardPage .quickAction {
          border-width:1.5px!important;
        }

        .dashboardPage .quickAction:nth-child(8n+1){background:#eee9ff!important;border-color:#b9a9ff!important}
        .dashboardPage .quickAction:nth-child(8n+2){background:#e2f8ef!important;border-color:#8cddc2!important}
        .dashboardPage .quickAction:nth-child(8n+3){background:#ffe6f1!important;border-color:#f3a2ca!important}
        .dashboardPage .quickAction:nth-child(8n+4){background:#fff0d5!important;border-color:#f4c06e!important}
        .dashboardPage .quickAction:nth-child(8n+5){background:#e2f8fd!important;border-color:#91dcea!important}
        .dashboardPage .quickAction:nth-child(8n+6){background:#e8ebff!important;border-color:#aeb7ef!important}
        .dashboardPage .quickAction:nth-child(8n+7){background:#ffe4e4!important;border-color:#f4a4a4!important}
        .dashboardPage .quickAction:nth-child(8n+8){background:#e1f7ee!important;border-color:#8bd8bd!important}

        .dashboardPage .trendBar {
          background:linear-gradient(180deg,#8b5cf6 0%,#6d4dff 35%,#16b8d4 70%,#00a67a 100%)!important;
        }

        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+1){background:linear-gradient(135deg,#5031d2,#8b5cf6)!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+2){background:linear-gradient(135deg,#008864,#00bd8a)!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+3){background:linear-gradient(135deg,#c63b87,#ef65af)!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+4){background:linear-gradient(135deg,#d67b0d,#ffae45)!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+5){background:linear-gradient(135deg,#079db9,#29c8e1)!important}

        .dashboardPage .panel {
          border-color:rgba(109,77,255,.12)!important;
        }

        .dashboardPage .compactList .compactRow:nth-child(6n+1){box-shadow:inset 4px 0 #6d4dff!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+2){box-shadow:inset 4px 0 #00a67a!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+3){box-shadow:inset 4px 0 #e950a5!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+4){box-shadow:inset 4px 0 #f29b30!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+5){box-shadow:inset 4px 0 #16b8d4!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+6){box-shadow:inset 4px 0 #5c6bc0!important}


        /* ============================================================
           DASHBOARD FINAL V3 — ACTUAL CHILD COMPONENT COLOR FIX
           Styled-JSX child components require :global selectors.
           ============================================================ */

        /* HERO — visibly multicolor, not navy-only */
        .dashboardPage .hero {
          background:
            radial-gradient(circle at 84% -8%, rgba(255,229,140,.32), transparent 26%),
            radial-gradient(circle at 8% 108%, rgba(233,80,165,.42), transparent 34%),
            linear-gradient(118deg,#321269 0%,#6d4dff 32%,#a244b1 49%,#168fb7 72%,#00a67a 100%) !important;
          border-color:rgba(255,255,255,.42) !important;
        }

        .dashboardPage .heroMotion span:nth-child(1) {
          background:#ffe58c !important;
        }
        .dashboardPage .heroMotion span:nth-child(2) {
          background:#ff80c5 !important;
        }
        .dashboardPage .heroMotion span:nth-child(3) {
          background:#5ee7ff !important;
        }

        /* PRIMARY KPI CARDS are BusinessKpi child components.
           Use GLOBAL so the page-level redesign actually reaches them. */
        .dashboardPage :global(.businessKpi) {
          min-height:142px !important;
          border-radius:24px !important;
          border:1px solid rgba(255,255,255,.55) !important;
          box-shadow:0 20px 42px rgba(29,29,70,.20) !important;
          overflow:hidden !important;
        }

        .dashboardPage :global(.businessKpi.blue) {
          background:
            radial-gradient(circle at 88% 5%,rgba(255,255,255,.24),transparent 27%),
            linear-gradient(135deg,#5834dc 0%,#6d4dff 50%,#16b8d4 100%) !important;
        }

        .dashboardPage :global(.businessKpi.gold) {
          background:
            radial-gradient(circle at 88% 5%,rgba(255,255,255,.24),transparent 27%),
            linear-gradient(135deg,#d77408 0%,#f29b30 48%,#e950a5 100%) !important;
        }

        .dashboardPage :global(.businessKpi.green) {
          background:
            radial-gradient(circle at 88% 5%,rgba(255,255,255,.22),transparent 27%),
            linear-gradient(135deg,#00845f 0%,#00a67a 50%,#16b8d4 100%) !important;
        }

        .dashboardPage :global(.businessKpi.red) {
          background:
            radial-gradient(circle at 88% 5%,rgba(255,255,255,.22),transparent 27%),
            linear-gradient(135deg,#b9327c 0%,#e950a5 50%,#ff6b6b 100%) !important;
        }

        .dashboardPage :global(.businessKpi::after) {
          background:
            radial-gradient(circle at 80% 15%,rgba(255,255,255,.16),transparent 32%) !important;
          opacity:1 !important;
        }

        .dashboardPage :global(.businessKpiMotion span) {
          opacity:.20 !important;
          background:#fff !important;
        }

        .dashboardPage :global(.businessKpiPulse) {
          border-color:rgba(255,255,255,.22) !important;
          opacity:.48 !important;
        }

        .dashboardPage :global(.businessKpiIcon) {
          width:52px !important;
          height:52px !important;
          border:1px solid rgba(255,255,255,.58) !important;
          background:rgba(255,255,255,.18) !important;
          color:#fff3b1 !important;
          box-shadow:0 8px 18px rgba(0,0,0,.12) !important;
        }

        .dashboardPage :global(.businessKpi span),
        .dashboardPage :global(.businessKpi strong),
        .dashboardPage :global(.businessKpi small) {
          color:#fff !important;
        }

        /* EXECUTIVE PULSE — stronger fills */
        .dashboardPage .executivePulseStrip {
          border:1px solid rgba(109,77,255,.20) !important;
          background:
            radial-gradient(circle at 0% 0%,rgba(109,77,255,.14),transparent 25%),
            radial-gradient(circle at 100% 100%,rgba(242,155,48,.13),transparent 25%),
            #fff !important;
        }

        .dashboardPage .executivePulseLead {
          background:linear-gradient(135deg,#4e2ad0,#8b5cf6 66%,#e950a5) !important;
        }

        .dashboardPage .executivePulseMetric:nth-child(2) {
          background:linear-gradient(135deg,#dfd4ff,#f4efff) !important;
        }
        .dashboardPage .executivePulseMetric.profit {
          background:linear-gradient(135deg,#cef4e3,#effcf6) !important;
        }
        .dashboardPage .executivePulseMetric.money {
          background:linear-gradient(135deg,#ccf2fa,#eefcff) !important;
        }
        .dashboardPage .executivePulseMetric.attention {
          background:linear-gradient(135deg,#ffe8bb,#fff5df) !important;
        }
        .dashboardPage .executivePulseMetric.attention.active {
          background:linear-gradient(135deg,#ffd8df,#fff0f3) !important;
        }

        /* TODAY PROFIT — visibly different cards */
        .dashboardPage .todayOwnerProfitPanel {
          background:
            radial-gradient(circle at 96% 0%,rgba(233,80,165,.18),transparent 28%),
            radial-gradient(circle at 0% 100%,rgba(22,184,212,.16),transparent 31%),
            linear-gradient(135deg,#f4edff,#fff 48%,#eafaff) !important;
        }

        .dashboardPage .todayProfitMetric {
          border-width:1.5px !important;
          box-shadow:0 10px 22px rgba(23,32,51,.07) !important;
        }

        .dashboardPage .todayProfitMetric.heroMetric {
          background:linear-gradient(135deg,#e2d5ff,#f5f0ff) !important;
          border-color:#b9a7ff !important;
        }

        .dashboardPage .todayProfitMetric:nth-child(2) {
          background:linear-gradient(135deg,#cdf4e2,#f1fcf7) !important;
          border-color:#86d7b8 !important;
        }

        .dashboardPage .todayProfitMetric:nth-child(3) {
          background:linear-gradient(135deg,#cdeff7,#effbfe) !important;
          border-color:#87d6e7 !important;
        }

        .dashboardPage .todayProfitMetric:nth-child(4) {
          background:linear-gradient(135deg,#ffe6b5,#fff6e3) !important;
          border-color:#f0bd68 !important;
        }

        .dashboardPage .todayProfitMetric.warning {
          background:linear-gradient(135deg,#ffddeb,#fff1f7) !important;
          border-color:#efa0c7 !important;
        }

        .dashboardPage .todayProfitMetric.danger {
          background:linear-gradient(135deg,#ffd7d7,#fff0f0) !important;
          border-color:#ef9a9a !important;
        }

        /* QUICK ACTIONS are child QuickAction components — GLOBAL fix */
        .dashboardPage :global(.quickAction) {
          border-width:1.5px !important;
          border-radius:20px !important;
          min-height:118px !important;
          box-shadow:0 10px 24px rgba(23,32,51,.08) !important;
          overflow:hidden !important;
        }

        .dashboardPage :global(.quickAction:nth-child(8n+1)) {
          background:linear-gradient(135deg,#e4dcff,#f7f4ff) !important;
          border-color:#aa98f8 !important;
        }
        .dashboardPage :global(.quickAction:nth-child(8n+2)) {
          background:linear-gradient(135deg,#d4f5e7,#f2fcf7) !important;
          border-color:#78d2b2 !important;
        }
        .dashboardPage :global(.quickAction:nth-child(8n+3)) {
          background:linear-gradient(135deg,#ffdceb,#fff1f7) !important;
          border-color:#eb92bd !important;
        }
        .dashboardPage :global(.quickAction:nth-child(8n+4)) {
          background:linear-gradient(135deg,#ffe7b9,#fff5df) !important;
          border-color:#efb756 !important;
        }
        .dashboardPage :global(.quickAction:nth-child(8n+5)) {
          background:linear-gradient(135deg,#d4f2fa,#effbfe) !important;
          border-color:#7ccfe0 !important;
        }
        .dashboardPage :global(.quickAction:nth-child(8n+6)) {
          background:linear-gradient(135deg,#dde2ff,#f3f5ff) !important;
          border-color:#9ba8e9 !important;
        }
        .dashboardPage :global(.quickAction:nth-child(8n+7)) {
          background:linear-gradient(135deg,#ffd9d9,#fff0f0) !important;
          border-color:#ec9393 !important;
        }
        .dashboardPage :global(.quickAction:nth-child(8n+8)) {
          background:linear-gradient(135deg,#d4f3e7,#effcf6) !important;
          border-color:#75cfad !important;
        }

        .dashboardPage :global(.quickAction::after) {
          opacity:.05 !important;
        }

        .dashboardPage :global(.quickActionIcon) {
          width:48px !important;
          height:48px !important;
          border-radius:15px !important;
          color:#fff !important;
          box-shadow:0 9px 20px rgba(23,32,51,.14) !important;
        }

        .dashboardPage :global(.quickAction:nth-child(8n+1) .quickActionIcon) { background:linear-gradient(135deg,#6d4dff,#8b5cf6)!important; }
        .dashboardPage :global(.quickAction:nth-child(8n+2) .quickActionIcon) { background:linear-gradient(135deg,#00a67a,#29bf94)!important; }
        .dashboardPage :global(.quickAction:nth-child(8n+3) .quickActionIcon) { background:linear-gradient(135deg,#e950a5,#f47fc2)!important; }
        .dashboardPage :global(.quickAction:nth-child(8n+4) .quickActionIcon) { background:linear-gradient(135deg,#f29b30,#f6b85d)!important; }
        .dashboardPage :global(.quickAction:nth-child(8n+5) .quickActionIcon) { background:linear-gradient(135deg,#16b8d4,#38cce2)!important; }
        .dashboardPage :global(.quickAction:nth-child(8n+6) .quickActionIcon) { background:linear-gradient(135deg,#5c6bc0,#7d8be0)!important; }
        .dashboardPage :global(.quickAction:nth-child(8n+7) .quickActionIcon) { background:linear-gradient(135deg,#ff6b6b,#f69b9b)!important; }
        .dashboardPage :global(.quickAction:nth-child(8n+8) .quickActionIcon) { background:linear-gradient(135deg,#00a67a,#16b8d4)!important; }

        .dashboardPage :global(.quickActionIcon b) {
          color:#fff !important;
        }

        /* MINI KPI child components — stronger pastel color blocks */
        .dashboardPage .secondaryKpis :global(.miniKpi),
        .dashboardPage .catalogueKpis :global(.miniKpi) {
          border-width:1.5px !important;
          box-shadow:0 10px 22px rgba(23,32,51,.07) !important;
        }

        .dashboardPage .secondaryKpis :global(.miniKpi:nth-child(6n+1)),
        .dashboardPage .catalogueKpis :global(.miniKpi:nth-child(6n+1)) {
          background:#e6dfff !important;
          border-color:#ad9cf3 !important;
        }
        .dashboardPage .secondaryKpis :global(.miniKpi:nth-child(6n+2)),
        .dashboardPage .catalogueKpis :global(.miniKpi:nth-child(6n+2)) {
          background:#d9f5e9 !important;
          border-color:#82d4b5 !important;
        }
        .dashboardPage .secondaryKpis :global(.miniKpi:nth-child(6n+3)),
        .dashboardPage .catalogueKpis :global(.miniKpi:nth-child(6n+3)) {
          background:#ffe1ee !important;
          border-color:#eb9ec4 !important;
        }
        .dashboardPage .secondaryKpis :global(.miniKpi:nth-child(6n+4)),
        .dashboardPage .catalogueKpis :global(.miniKpi:nth-child(6n+4)) {
          background:#ffebc8 !important;
          border-color:#edbb65 !important;
        }
        .dashboardPage .secondaryKpis :global(.miniKpi:nth-child(6n+5)),
        .dashboardPage .catalogueKpis :global(.miniKpi:nth-child(6n+5)) {
          background:#d9f3fa !important;
          border-color:#82d0df !important;
        }
        .dashboardPage .secondaryKpis :global(.miniKpi:nth-child(6n+6)),
        .dashboardPage .catalogueKpis :global(.miniKpi:nth-child(6n+6)) {
          background:#e1e5ff !important;
          border-color:#9ea9e8 !important;
        }

        /* Lists / alerts — stronger colored rails */
        .dashboardPage .compactList .compactRow {
          border-width:1px !important;
          box-shadow:0 7px 17px rgba(23,32,51,.045) !important;
        }

        .dashboardPage .compactList .compactRow:nth-child(6n+1){background:#f0ecff!important;box-shadow:inset 5px 0 #6d4dff!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+2){background:#e9f9f2!important;box-shadow:inset 5px 0 #00a67a!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+3){background:#fff0f7!important;box-shadow:inset 5px 0 #e950a5!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+4){background:#fff6e6!important;box-shadow:inset 5px 0 #f29b30!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+5){background:#eaf9fd!important;box-shadow:inset 5px 0 #16b8d4!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+6){background:#eff1ff!important;box-shadow:inset 5px 0 #5c6bc0!important}

        /* Chart visibly colorful */
        .dashboardPage .trendChart {
          background:
            linear-gradient(to bottom,rgba(109,77,255,.07) 1px,transparent 1px),
            linear-gradient(180deg,#f5f0ff,#f2fbfd) !important;
          background-size:100% 25%,100% 100% !important;
        }

        .dashboardPage .trendBar {
          background:linear-gradient(180deg,#e950a5 0%,#8b5cf6 28%,#6d4dff 50%,#16b8d4 74%,#00a67a 100%) !important;
          box-shadow:0 6px 15px rgba(109,77,255,.24) !important;
        }

        /* Google panel */
        .dashboardPage .googleBusinessPanel {
          border:1.5px solid rgba(66,133,244,.18) !important;
          background:
            radial-gradient(circle at 100% 0%,rgba(66,133,244,.13),transparent 28%),
            linear-gradient(135deg,#f5f9ff,#fff 45%,#f2fff8) !important;
        }

        @media(max-width:760px){
          .dashboardPage :global(.businessKpi){min-height:122px!important}
          .dashboardPage :global(.quickAction){min-height:104px!important}
        }


        /* ============================================================
           NCS DASHBOARD — HARD BLUE REMOVED FINAL
           ============================================================ */

        .dashboardPage {
          background:
            radial-gradient(circle at 0% 0%,rgba(109,77,255,.14),transparent 24%),
            radial-gradient(circle at 100% 10%,rgba(22,184,212,.13),transparent 25%),
            radial-gradient(circle at 52% 100%,rgba(242,155,48,.10),transparent 29%),
            linear-gradient(180deg,#F8F7FF 0%,#F3F7FB 48%,#FFF8EC 100%) !important;
        }

        .dashboardPage .hero {
          background:
            radial-gradient(circle at 90% -5%,rgba(255,229,140,.30),transparent 27%),
            radial-gradient(circle at 8% 112%,rgba(233,80,165,.38),transparent 34%),
            linear-gradient(118deg,#3B1E7A 0%,#6D4DFF 32%,#A244B1 50%,#16B8D4 75%,#00A67A 100%) !important;
        }

        .dashboardPage .profitIntelligencePanel {
          background:
            radial-gradient(circle at 95% 0%,rgba(255,255,255,.17),transparent 28%),
            radial-gradient(circle at 0% 110%,rgba(233,80,165,.28),transparent 32%),
            linear-gradient(125deg,#3B1E7A,#6D4DFF 38%,#16B8D4 73%,#00A67A) !important;
        }

        .dashboardPage .executivePulseLead {
          background:linear-gradient(135deg,#6D4DFF,#8B5CF6 62%,#E950A5) !important;
        }

        .dashboardPage .todayProfitOpenButton,
        .dashboardPage .profitOpenButton {
          background:linear-gradient(135deg,#6D4DFF,#16B8D4) !important;
          color:#fff !important;
        }

        .dashboardPage .todayOwnerProfitPanel {
          background:
            radial-gradient(circle at 100% 0%,rgba(233,80,165,.16),transparent 26%),
            radial-gradient(circle at 0% 100%,rgba(22,184,212,.16),transparent 29%),
            linear-gradient(135deg,#F3ECFF,#FFFFFF 46%,#EAFBFF) !important;
        }

        .dashboardPage .sectionHeader span {
          color:#6D4DFF !important;
        }

        .dashboardPage .sectionHeader h2,
        .dashboardPage h2,
        .dashboardPage h3 {
          color:#2B2450 !important;
        }

        /* Directly target common legacy blue text/backgrounds at page level */
        .dashboardPage a:not(.quickAction):not(.todayProfitOpenButton):not(.profitOpenButton),
        .dashboardPage button {
          accent-color:#6D4DFF;
        }

        /* Stronger light cards so dark navy no longer dominates */
        .dashboardPage .panel,
        .dashboardPage .quickActionsPanel,
        .dashboardPage .googleBusinessPanel,
        .dashboardPage .todayOwnerProfitPanel {
          background-color:#fff !important;
        }

        /* Actual child KPI direct global selectors */
        .dashboardPage :global(.businessKpi.blue) {
          background:linear-gradient(135deg,#6D4DFF,#8B5CF6 52%,#16B8D4) !important;
        }
        .dashboardPage :global(.businessKpi.gold) {
          background:linear-gradient(135deg,#F29B30,#F6B85D 50%,#E950A5) !important;
        }
        .dashboardPage :global(.businessKpi.green) {
          background:linear-gradient(135deg,#00A67A,#24BE91 52%,#16B8D4) !important;
        }
        .dashboardPage :global(.businessKpi.red) {
          background:linear-gradient(135deg,#E950A5,#FF6B6B 52%,#F29B30) !important;
        }

        /* Quick Action cards forced light/colorful */
        .dashboardPage :global(.quickAction) {
          color:#172033 !important;
        }
        .dashboardPage :global(.quickAction strong) {
          color:#172033 !important;
        }
        .dashboardPage :global(.quickAction > span) {
          color:#667085 !important;
        }


        /* ============================================================
           DASHBOARD FINAL — NAMES / LABELS HIGHLIGHT
           ============================================================ */

        /* Executive pulse names */
        .dashboardPage .executivePulseMetric > span {
          display:inline-flex !important;
          width:max-content !important;
          padding:5px 9px !important;
          border-radius:999px !important;
          font-size:9px !important;
          font-weight:950 !important;
          letter-spacing:.65px !important;
          line-height:1 !important;
        }

        .dashboardPage .executivePulseMetric:nth-child(2) > span {
          background:#6d4dff !important;
          color:#fff !important;
        }
        .dashboardPage .executivePulseMetric.profit > span {
          background:#00a67a !important;
          color:#fff !important;
        }
        .dashboardPage .executivePulseMetric.money > span {
          background:#16b8d4 !important;
          color:#fff !important;
        }
        .dashboardPage .executivePulseMetric.attention > span {
          background:#f29b30 !important;
          color:#fff !important;
        }
        .dashboardPage .executivePulseMetric.attention.active > span {
          background:#e950a5 !important;
          color:#fff !important;
        }

        /* Main KPI names become white pills on colorful cards */
        .dashboardPage :global(.businessKpi > div:not(.businessKpiMotion):not(.businessKpiPulse) > span) {
          display:inline-flex !important;
          width:max-content !important;
          max-width:100% !important;
          padding:5px 9px !important;
          border:1px solid rgba(255,255,255,.42) !important;
          border-radius:999px !important;
          background:rgba(255,255,255,.18) !important;
          color:#fff !important;
          font-size:9px !important;
          font-weight:950 !important;
          letter-spacing:.75px !important;
          text-shadow:0 1px 4px rgba(0,0,0,.14) !important;
        }

        .dashboardPage :global(.businessKpi strong) {
          margin-top:8px !important;
          color:#fff !important;
          text-shadow:0 2px 6px rgba(0,0,0,.13) !important;
        }

        .dashboardPage :global(.businessKpi small) {
          margin-top:5px !important;
          color:rgba(255,255,255,.82) !important;
          font-weight:700 !important;
        }

        /* Today Profit metric names */
        .dashboardPage .todayProfitMetric > span {
          display:inline-flex !important;
          width:max-content !important;
          padding:4px 8px !important;
          border-radius:999px !important;
          font-size:8px !important;
          font-weight:950 !important;
        }

        .dashboardPage .todayProfitMetric:nth-child(6n+1) > span {background:#6d4dff!important;color:#fff!important}
        .dashboardPage .todayProfitMetric:nth-child(6n+2) > span {background:#00a67a!important;color:#fff!important}
        .dashboardPage .todayProfitMetric:nth-child(6n+3) > span {background:#16b8d4!important;color:#fff!important}
        .dashboardPage .todayProfitMetric:nth-child(6n+4) > span {background:#f29b30!important;color:#fff!important}
        .dashboardPage .todayProfitMetric:nth-child(6n+5) > span {background:#e950a5!important;color:#fff!important}
        .dashboardPage .todayProfitMetric:nth-child(6n+6) > span {background:#5c6bc0!important;color:#fff!important}

        /* Quick action names */
        .dashboardPage :global(.quickAction strong) {
          color:#20283a !important;
          font-size:12px !important;
          font-weight:950 !important;
          line-height:1.15 !important;
        }

        .dashboardPage :global(.quickAction > span) {
          color:#667085 !important;
          font-size:8px !important;
          font-weight:650 !important;
        }

        /* Panel headings / names */
        .dashboardPage .sectionHeader h2 {
          color:#2b2450 !important;
          font-size:17px !important;
          font-weight:950 !important;
        }

        .dashboardPage .sectionHeader span {
          display:inline-flex !important;
          padding:4px 8px !important;
          border-radius:999px !important;
          background:#eee9ff !important;
          color:#6d4dff !important;
          font-weight:950 !important;
        }

        .dashboardPage .todayProfitHeader > div > span {
          display:inline-flex !important;
          padding:5px 9px !important;
          border-radius:999px !important;
          background:linear-gradient(135deg,#6d4dff,#e950a5) !important;
          color:#fff !important;
          font-weight:950 !important;
        }

        .dashboardPage .todayProfitHeader h2 {
          color:#4f35bd !important;
          font-weight:950 !important;
        }


        /* ============================================================
           NCS DASHBOARD — PREMIUM MUTED INTERNATIONAL FINAL
           Softer saturation, stronger readability, luxury balance.
           ============================================================ */

        .dashboardPage {
          background:
            radial-gradient(circle at 0% 0%,rgba(130,112,207,.05),transparent 24%),
            radial-gradient(circle at 100% 8%,rgba(87,156,168,.05),transparent 24%),
            linear-gradient(180deg,#f7f7f8 0%,#f3f4f6 52%,#f8f5ee 100%) !important;
        }

        .dashboardPage .hero {
          background:
            radial-gradient(circle at 90% -5%,rgba(242,213,110,.18),transparent 28%),
            radial-gradient(circle at 10% 110%,rgba(187,109,153,.18),transparent 32%),
            linear-gradient(120deg,#3a2a54 0%,#62529a 40%,#557f93 72%,#4f8c7d 100%) !important;
          border-color:rgba(255,255,255,.18) !important;
          box-shadow:0 18px 44px rgba(39,35,66,.18) !important;
        }

        .dashboardPage .hero h1 {
          color:#fff !important;
          text-shadow:none !important;
        }

        .dashboardPage .hero p,
        .dashboardPage .hero small {
          color:rgba(255,255,255,.72) !important;
        }

        .dashboardPage .executivePulseStrip {
          background:#fff !important;
          border-color:#e7e8ec !important;
          box-shadow:0 10px 26px rgba(32,39,55,.07) !important;
        }

        .dashboardPage .executivePulseLead {
          background:linear-gradient(135deg,#514373,#7162a4) !important;
        }

        .dashboardPage .executivePulseMetric:nth-child(2) {
          background:#f4f1fb !important;
        }
        .dashboardPage .executivePulseMetric.profit {
          background:#edf7f2 !important;
        }
        .dashboardPage .executivePulseMetric.money {
          background:#edf6f8 !important;
        }
        .dashboardPage .executivePulseMetric.attention {
          background:#fbf5e9 !important;
        }
        .dashboardPage .executivePulseMetric.attention.active {
          background:#faf0f2 !important;
        }

        .dashboardPage .executivePulseMetric > span {
          padding:0 !important;
          background:transparent !important;
          border:0 !important;
          color:#70778a !important;
          font-size:8px !important;
          letter-spacing:.7px !important;
        }

        .dashboardPage .executivePulseMetric:nth-child(2) > span {color:#6f5ca8!important}
        .dashboardPage .executivePulseMetric.profit > span {color:#4f9077!important}
        .dashboardPage .executivePulseMetric.money > span {color:#4d8994!important}
        .dashboardPage .executivePulseMetric.attention > span {color:#ad7d3f!important}
        .dashboardPage .executivePulseMetric.attention.active > span {color:#a76373!important}

        .dashboardPage :global(.businessKpi) {
          min-height:132px !important;
          border:1px solid rgba(255,255,255,.28) !important;
          box-shadow:0 11px 28px rgba(32,39,55,.10) !important;
        }

        .dashboardPage :global(.businessKpi.blue) {
          background:linear-gradient(135deg,#6e5bc2,#6f7fb8 54%,#5d9fb0) !important;
        }
        .dashboardPage :global(.businessKpi.gold) {
          background:linear-gradient(135deg,#b98949,#c5965b 54%,#b56f8e) !important;
        }
        .dashboardPage :global(.businessKpi.green) {
          background:linear-gradient(135deg,#4f927a,#55a088 54%,#5a99a2) !important;
        }
        .dashboardPage :global(.businessKpi.red) {
          background:linear-gradient(135deg,#a96686,#b9687f 54%,#bd795e) !important;
        }

        .dashboardPage :global(.businessKpi > div:not(.businessKpiMotion):not(.businessKpiPulse) > span) {
          padding:0 !important;
          border:0 !important;
          background:transparent !important;
          color:rgba(255,255,255,.78) !important;
          font-size:8px !important;
          letter-spacing:.8px !important;
          text-shadow:none !important;
        }

        .dashboardPage :global(.businessKpi strong) {
          color:#fff !important;
          font-size:28px !important;
          text-shadow:none !important;
        }

        .dashboardPage :global(.businessKpi small) {
          color:rgba(255,255,255,.74) !important;
          font-weight:600 !important;
        }

        .dashboardPage :global(.businessKpiIcon) {
          background:rgba(255,255,255,.10) !important;
          border-color:rgba(255,255,255,.28) !important;
          color:#f1dda0 !important;
          box-shadow:none !important;
        }

        .dashboardPage .todayOwnerProfitPanel {
          background:#fffdf9 !important;
          border-color:#e8e1d4 !important;
          box-shadow:0 10px 28px rgba(32,39,55,.06) !important;
        }

        .dashboardPage .todayProfitHeader h2 {
          color:#5f4b8b !important;
        }

        .dashboardPage .todayProfitHeader > div > span,
        .dashboardPage .todayProfitMetric > span {
          padding:0 !important;
          border:0 !important;
          background:transparent !important;
          color:#777d8c !important;
          font-size:8px !important;
        }

        .dashboardPage .todayProfitMetric {
          background:#fff !important;
          border-color:#e6e8ed !important;
          box-shadow:0 7px 18px rgba(32,39,55,.045) !important;
        }

        .dashboardPage .todayProfitMetric.heroMetric {background:#f4f1fb!important}
        .dashboardPage .todayProfitMetric:nth-child(2) {background:#eef7f2!important}
        .dashboardPage .todayProfitMetric:nth-child(3) {background:#eef6f8!important}
        .dashboardPage .todayProfitMetric:nth-child(4) {background:#fbf6ec!important}
        .dashboardPage .todayProfitMetric.warning {background:#faf0f4!important}
        .dashboardPage .todayProfitMetric.danger {background:#faf0f0!important}

        .dashboardPage .profitIntelligencePanel {
          background:
            linear-gradient(125deg,#3b2b54,#62529a 42%,#557f93 72%,#4f8c7d) !important;
          box-shadow:0 15px 38px rgba(39,35,66,.16) !important;
        }

        .dashboardPage .quickActionsPanel,
        .dashboardPage .panel,
        .dashboardPage .googleBusinessPanel {
          background:#fff !important;
          border-color:#e6e8ed !important;
          box-shadow:0 9px 24px rgba(32,39,55,.055) !important;
        }

        .dashboardPage :global(.quickAction) {
          min-height:108px !important;
          background:#fff !important;
          border-color:#e4e7ec !important;
          box-shadow:0 6px 16px rgba(32,39,55,.045) !important;
        }

        .dashboardPage :global(.quickAction:nth-child(8n+1)){background:#f5f3fb!important}
        .dashboardPage :global(.quickAction:nth-child(8n+2)){background:#f0f7f4!important}
        .dashboardPage :global(.quickAction:nth-child(8n+3)){background:#faf2f6!important}
        .dashboardPage :global(.quickAction:nth-child(8n+4)){background:#fbf6ed!important}
        .dashboardPage :global(.quickAction:nth-child(8n+5)){background:#f0f7f8!important}
        .dashboardPage :global(.quickAction:nth-child(8n+6)){background:#f2f3f9!important}
        .dashboardPage :global(.quickAction:nth-child(8n+7)){background:#faf2f2!important}
        .dashboardPage :global(.quickAction:nth-child(8n+8)){background:#f0f7f4!important}

        .dashboardPage :global(.quickActionIcon) {
          width:44px !important;
          height:44px !important;
          box-shadow:none !important;
        }

        .dashboardPage :global(.quickAction:nth-child(8n+1) .quickActionIcon){background:#7664b8!important}
        .dashboardPage :global(.quickAction:nth-child(8n+2) .quickActionIcon){background:#5b9a82!important}
        .dashboardPage :global(.quickAction:nth-child(8n+3) .quickActionIcon){background:#b46f98!important}
        .dashboardPage :global(.quickAction:nth-child(8n+4) .quickActionIcon){background:#b98949!important}
        .dashboardPage :global(.quickAction:nth-child(8n+5) .quickActionIcon){background:#5b929e!important}
        .dashboardPage :global(.quickAction:nth-child(8n+6) .quickActionIcon){background:#6f78a9!important}
        .dashboardPage :global(.quickAction:nth-child(8n+7) .quickActionIcon){background:#a96868!important}
        .dashboardPage :global(.quickAction:nth-child(8n+8) .quickActionIcon){background:#578f7c!important}

        .dashboardPage :global(.quickAction strong) {
          color:#273042 !important;
          font-size:11px !important;
        }

        .dashboardPage :global(.quickAction > span) {
          color:#7a8190 !important;
          font-size:8px !important;
        }

        .dashboardPage .sectionHeader span {
          padding:0 !important;
          background:transparent !important;
          color:#7766a8 !important;
          font-size:8px !important;
        }

        .dashboardPage .sectionHeader h2 {
          color:#293247 !important;
          font-size:16px !important;
        }

        .dashboardPage .compactList .compactRow {
          background:#fff !important;
          border-color:#e8eaee !important;
          box-shadow:none !important;
        }

        .dashboardPage .compactList .compactRow:nth-child(6n+1){box-shadow:inset 3px 0 #7c6ab8!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+2){box-shadow:inset 3px 0 #5f9c84!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+3){box-shadow:inset 3px 0 #b36f97!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+4){box-shadow:inset 3px 0 #b98c4d!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+5){box-shadow:inset 3px 0 #5d97a2!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+6){box-shadow:inset 3px 0 #707aaa!important}

        .dashboardPage .trendChart {
          background:
            linear-gradient(to bottom,rgba(87,156,168,.05) 1px,transparent 1px),
            #fafbfc !important;
          background-size:100% 25%,100% 100% !important;
        }

        .dashboardPage .trendBar {
          background:linear-gradient(180deg,#7766b0,#64859a 58%,#5f9984) !important;
          box-shadow:none !important;
        }

        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+1){background:#7564af!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+2){background:#5d9780!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+3){background:#ad6f91!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+4){background:#b58a4d!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+5){background:#5b929e!important}

        .dashboardPage .todayProfitOpenButton,
        .dashboardPage .profitOpenButton {
          background:linear-gradient(135deg,#6a58a4,#5e8f9b) !important;
          box-shadow:none !important;
        }


        /* ============================================================
           NCS DASHBOARD — PREMIUM BALANCED FINAL
           Soft color, high readability, luxury retail software feel.
           ============================================================ */

        .dashboardPage .hero {
          background:
            radial-gradient(circle at 88% -6%,rgba(233,211,135,.16),transparent 28%),
            radial-gradient(circle at 10% 110%,rgba(171,107,143,.13),transparent 31%),
            linear-gradient(120deg,#3a2f4b 0%,#5f5485 42%,#577b89 72%,#4f7f73 100%) !important;
          box-shadow:0 16px 38px rgba(35,33,54,.15) !important;
        }

        .dashboardPage .hero::after {
          color:rgba(255,255,255,.035) !important;
        }

        .dashboardPage .executivePulseLead {
          background:linear-gradient(135deg,#51466b,#6d6187) !important;
        }

        .dashboardPage .executivePulseStrip {
          box-shadow:0 8px 22px rgba(32,39,55,.055) !important;
        }

        /* Main KPI cards: retain color, lower saturation */
        .dashboardPage :global(.businessKpi.blue) {
          background:linear-gradient(135deg,#7668ad,#6f88a8 56%,#6799a1) !important;
        }

        .dashboardPage :global(.businessKpi.gold) {
          background:linear-gradient(135deg,#b58d5a,#c29a66 55%,#aa768e) !important;
        }

        .dashboardPage :global(.businessKpi.green) {
          background:linear-gradient(135deg,#5f8f7c,#639b87 55%,#65959a) !important;
        }

        .dashboardPage :global(.businessKpi.red) {
          background:linear-gradient(135deg,#a36f84,#b37582 55%,#b8876e) !important;
        }

        .dashboardPage :global(.businessKpi) {
          box-shadow:0 9px 24px rgba(32,39,55,.085) !important;
        }

        .dashboardPage :global(.businessKpiMotion span),
        .dashboardPage :global(.businessKpiPulse) {
          opacity:.16 !important;
        }

        /* Quick Actions: remove dark-purple blocks entirely */
        .dashboardPage :global(.quickAction) {
          min-height:104px !important;
          border-radius:18px !important;
          border:1px solid #e4e7ec !important;
          background:#fff !important;
          box-shadow:0 6px 16px rgba(32,39,55,.045) !important;
          padding:16px !important;
        }

        .dashboardPage :global(.quickAction:nth-child(8n+1)) {background:#f7f5fb!important}
        .dashboardPage :global(.quickAction:nth-child(8n+2)) {background:#f2f8f5!important}
        .dashboardPage :global(.quickAction:nth-child(8n+3)) {background:#faf4f7!important}
        .dashboardPage :global(.quickAction:nth-child(8n+4)) {background:#faf7f0!important}
        .dashboardPage :global(.quickAction:nth-child(8n+5)) {background:#f2f8f9!important}
        .dashboardPage :global(.quickAction:nth-child(8n+6)) {background:#f4f5f9!important}
        .dashboardPage :global(.quickAction:nth-child(8n+7)) {background:#faf4f4!important}
        .dashboardPage :global(.quickAction:nth-child(8n+8)) {background:#f2f8f5!important}

        .dashboardPage :global(.quickActionIcon) {
          width:42px !important;
          height:42px !important;
          border-radius:13px !important;
          box-shadow:none !important;
        }

        .dashboardPage :global(.quickAction:nth-child(8n+1) .quickActionIcon){background:#7664a3!important}
        .dashboardPage :global(.quickAction:nth-child(8n+2) .quickActionIcon){background:#5e927d!important}
        .dashboardPage :global(.quickAction:nth-child(8n+3) .quickActionIcon){background:#a86f8e!important}
        .dashboardPage :global(.quickAction:nth-child(8n+4) .quickActionIcon){background:#af8954!important}
        .dashboardPage :global(.quickAction:nth-child(8n+5) .quickActionIcon){background:#5e8f99!important}
        .dashboardPage :global(.quickAction:nth-child(8n+6) .quickActionIcon){background:#6e769e!important}
        .dashboardPage :global(.quickAction:nth-child(8n+7) .quickActionIcon){background:#a86e6e!important}
        .dashboardPage :global(.quickAction:nth-child(8n+8) .quickActionIcon){background:#5a8e7b!important}

        .dashboardPage :global(.quickAction strong) {
          color:#263044 !important;
          font-size:11px !important;
          font-weight:900 !important;
        }

        .dashboardPage :global(.quickAction > span) {
          color:#767e8d !important;
          font-size:8px !important;
        }

        /* Profit Intelligence: lighter, less purple-heavy */
        .dashboardPage .profitIntelligencePanel {
          background:
            radial-gradient(circle at 92% 0%,rgba(255,255,255,.08),transparent 28%),
            linear-gradient(125deg,#3e334e 0%,#5c5375 46%,#526f7b 74%,#4f766c 100%) !important;
          box-shadow:0 12px 30px rgba(35,33,54,.13) !important;
        }

        .dashboardPage .profitMetricCard {
          background:rgba(255,255,255,.075) !important;
          border-color:rgba(255,255,255,.12) !important;
        }

        .dashboardPage .profitMetricCard.highlight {
          background:rgba(92,153,126,.12) !important;
          border-color:rgba(119,183,153,.18) !important;
        }

        .dashboardPage .profitMetricCard.warning {
          background:rgba(181,139,78,.11) !important;
          border-color:rgba(205,163,98,.17) !important;
        }

        /* Visitors: remove dark-purple repetition */
        .dashboardPage .visitorMetrics .visitorMetric {
          background:#f7f8fa !important;
          border:1px solid #e5e8ed !important;
          color:#273042 !important;
          box-shadow:none !important;
        }

        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+1){border-top:3px solid #7664a3!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+2){border-top:3px solid #5e927d!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+3){border-top:3px solid #a86f8e!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+4){border-top:3px solid #af8954!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+5){border-top:3px solid #5e8f99!important}

        .dashboardPage .visitorMetric span {
          color:#7a8190 !important;
        }

        .dashboardPage .visitorMetric strong {
          color:#273042 !important;
        }

        /* Sales chart - elegant gold/teal rather than purple/yellow */
        .dashboardPage .trendBar {
          background:linear-gradient(180deg,#7b6c9d 0%,#6f8394 52%,#5f917d 100%) !important;
        }

        .dashboardPage .trendValue {
          color:#625680 !important;
        }

        /* Today's profit / panels */
        .dashboardPage .todayProfitHeader h2,
        .dashboardPage .sectionHeader h2 {
          color:#293247 !important;
        }

        .dashboardPage .todayProfitOpenButton,
        .dashboardPage .profitOpenButton {
          background:linear-gradient(135deg,#665a8e,#5c8993) !important;
        }

        .dashboardPage .googleConnectButton {
          background:linear-gradient(135deg,#5f789d,#5f8e78) !important;
        }

        .dashboardPage .googleRefreshButton {
          background:#f4f2f8 !important;
          color:#675a89 !important;
          border-color:#ddd8e7 !important;
        }

        /* soften gold micro-labels */
        .dashboardPage .sectionHeader > div > span,
        .dashboardPage .todayProfitHeader > div > span,
        .dashboardPage .hero > div > span {
          letter-spacing:.7px !important;
        }


        /* ============================================================
           NCS WEB DASHBOARD — MATCH MOBILE COMMAND DECK
           Deep premium accents + clean light cards.
           ============================================================ */

        .dashboardPage {
          background:
            radial-gradient(circle at 0% 0%,rgba(91,72,145,.04),transparent 22%),
            radial-gradient(circle at 100% 4%,rgba(65,115,132,.04),transparent 22%),
            linear-gradient(180deg,#f7f7f8 0%,#f3f4f6 52%,#f7f4ee 100%) !important;
          color:#20283a !important;
        }

        .dashboardPage .hero {
          border:1px solid rgba(255,255,255,.14) !important;
          border-radius:28px !important;
          background:
            radial-gradient(circle at 88% -10%,rgba(241,211,109,.12),transparent 28%),
            radial-gradient(circle at 8% 112%,rgba(171,88,141,.12),transparent 32%),
            linear-gradient(120deg,#2b1b49 0%,#493578 40%,#31516f 72%,#245d60 100%) !important;
          box-shadow:0 18px 42px rgba(28,25,46,.16) !important;
        }

        .dashboardPage .hero::after {
          color:rgba(255,255,255,.025) !important;
        }

        .dashboardPage .hero h1 {
          color:#fff !important;
          text-shadow:none !important;
        }

        .dashboardPage .hero p,
        .dashboardPage .hero small {
          color:rgba(255,255,255,.72) !important;
        }

        .dashboardPage .hero > div > span {
          color:#e7c96b !important;
        }

        .dashboardPage .refreshButton {
          background:rgba(255,255,255,.085) !important;
          border-color:rgba(255,255,255,.15) !important;
          color:#fff !important;
          box-shadow:none !important;
        }

        .dashboardPage :global(.newBillButton) {
          background:linear-gradient(135deg,#f2d56d,#e3bb53) !important;
          color:#2b1b49 !important;
          box-shadow:none !important;
        }

        .dashboardPage .executivePulseStrip {
          border:1px solid #e6e8ed !important;
          border-radius:24px !important;
          background:#fff !important;
          box-shadow:0 8px 22px rgba(32,39,55,.055) !important;
        }

        .dashboardPage .executivePulseLead {
          background:linear-gradient(135deg,#40325e,#5b4a7c) !important;
        }

        .dashboardPage .executivePulseMetric {
          background:#fafbfc !important;
          border-color:#e7e9ee !important;
          box-shadow:none !important;
        }

        .dashboardPage .executivePulseMetric:nth-child(2){background:#f6f4fa!important}
        .dashboardPage .executivePulseMetric.profit{background:#f2f7f4!important}
        .dashboardPage .executivePulseMetric.money{background:#f1f6f7!important}
        .dashboardPage .executivePulseMetric.attention{background:#faf6ed!important}
        .dashboardPage .executivePulseMetric.attention.active{background:#faf1f3!important}

        .dashboardPage .executivePulseMetric > span {
          background:transparent !important;
          border:0 !important;
          padding:0 !important;
          color:#7b8190 !important;
          font-size:8px !important;
        }

        /* MAIN KPI — premium dark cards with restrained edge tones */
        .dashboardPage :global(.businessKpi) {
          min-height:132px !important;
          border-radius:22px !important;
          border:1px solid rgba(255,255,255,.16) !important;
          box-shadow:0 11px 26px rgba(28,34,47,.10) !important;
          overflow:hidden !important;
        }

        .dashboardPage :global(.businessKpi.blue) {
          background:
            radial-gradient(circle at 90% 0%,rgba(255,255,255,.08),transparent 30%),
            linear-gradient(135deg,#342653,#4a3f73 55%,#405f78) !important;
        }

        .dashboardPage :global(.businessKpi.gold) {
          background:
            radial-gradient(circle at 90% 0%,rgba(255,255,255,.08),transparent 30%),
            linear-gradient(135deg,#5d4830,#745b3a 55%,#705066) !important;
        }

        .dashboardPage :global(.businessKpi.green) {
          background:
            radial-gradient(circle at 90% 0%,rgba(255,255,255,.08),transparent 30%),
            linear-gradient(135deg,#294d43,#356558 55%,#3f626b) !important;
        }

        .dashboardPage :global(.businessKpi.red) {
          background:
            radial-gradient(circle at 90% 0%,rgba(255,255,255,.08),transparent 30%),
            linear-gradient(135deg,#5b3449,#6c4152 55%,#70503e) !important;
        }

        .dashboardPage :global(.businessKpiMotion span),
        .dashboardPage :global(.businessKpiPulse) {
          opacity:.11 !important;
        }

        .dashboardPage :global(.businessKpiIcon) {
          width:48px !important;
          height:48px !important;
          border-radius:14px !important;
          border:1px solid rgba(255,255,255,.15) !important;
          background:rgba(255,255,255,.075) !important;
          color:#e6c969 !important;
          box-shadow:none !important;
        }

        .dashboardPage :global(.businessKpi > div:not(.businessKpiMotion):not(.businessKpiPulse) > span) {
          padding:0 !important;
          border:0 !important;
          background:transparent !important;
          color:rgba(255,255,255,.70) !important;
          font-size:8px !important;
          letter-spacing:.75px !important;
        }

        .dashboardPage :global(.businessKpi strong) {
          color:#fff !important;
          font-size:28px !important;
          text-shadow:none !important;
        }

        .dashboardPage :global(.businessKpi small) {
          color:rgba(255,255,255,.68) !important;
        }

        /* PROFIT SNAPSHOT — ivory light premium */
        .dashboardPage .todayOwnerProfitPanel {
          background:#fffdf8 !important;
          border:1px solid #e8e1d5 !important;
          box-shadow:0 8px 22px rgba(32,39,55,.05) !important;
        }

        .dashboardPage .todayProfitHeader h2 {
          color:#3f355b !important;
        }

        .dashboardPage .todayProfitHeader > div > span,
        .dashboardPage .todayProfitMetric > span {
          background:transparent !important;
          border:0 !important;
          padding:0 !important;
          color:#817b78 !important;
          font-size:8px !important;
        }

        .dashboardPage .todayProfitMetric {
          background:#fff !important;
          border:1px solid #e6e8ed !important;
          box-shadow:none !important;
        }

        .dashboardPage .todayProfitMetric.heroMetric {background:#f5f2fa!important}
        .dashboardPage .todayProfitMetric:nth-child(2) {background:#f3f7f4!important}
        .dashboardPage .todayProfitMetric:nth-child(3) {background:#f2f6f7!important}
        .dashboardPage .todayProfitMetric:nth-child(4) {background:#faf7ef!important}
        .dashboardPage .todayProfitMetric.warning {background:#faf2f5!important}
        .dashboardPage .todayProfitMetric.danger {background:#faf2f2!important}

        .dashboardPage .todayProfitOpenButton,
        .dashboardPage .profitOpenButton {
          background:linear-gradient(135deg,#4e426d,#476f7a) !important;
          color:#fff !important;
          box-shadow:none !important;
        }

        /* PROFIT INTELLIGENCE — deep deck, not purple flood */
        .dashboardPage .profitIntelligencePanel {
          background:
            radial-gradient(circle at 94% 0%,rgba(255,255,255,.06),transparent 28%),
            linear-gradient(125deg,#2c203e 0%,#41365a 46%,#344e60 74%,#2e5b55 100%) !important;
          box-shadow:0 12px 30px rgba(28,25,46,.13) !important;
        }

        .dashboardPage .profitMetricCard {
          background:rgba(255,255,255,.055) !important;
          border-color:rgba(255,255,255,.10) !important;
        }

        .dashboardPage .profitMetricCard.highlight {
          background:rgba(72,123,102,.11) !important;
          border-color:rgba(108,160,136,.16) !important;
        }

        .dashboardPage .profitMetricCard.warning {
          background:rgba(147,113,67,.10) !important;
          border-color:rgba(184,146,89,.15) !important;
        }

        /* QUICK ACTIONS — match mobile clarity: light cards + small colored icon */
        .dashboardPage .quickActionsPanel,
        .dashboardPage .panel,
        .dashboardPage .googleBusinessPanel {
          background:#fff !important;
          border:1px solid #e6e8ed !important;
          box-shadow:0 8px 22px rgba(32,39,55,.045) !important;
        }

        .dashboardPage :global(.quickAction) {
          min-height:106px !important;
          padding:15px !important;
          border-radius:18px !important;
          border:1px solid #e4e7ec !important;
          background:#fff !important;
          box-shadow:none !important;
        }

        .dashboardPage :global(.quickAction:nth-child(8n+1)){background:#f7f5fa!important}
        .dashboardPage :global(.quickAction:nth-child(8n+2)){background:#f3f7f5!important}
        .dashboardPage :global(.quickAction:nth-child(8n+3)){background:#faf5f7!important}
        .dashboardPage :global(.quickAction:nth-child(8n+4)){background:#faf7f1!important}
        .dashboardPage :global(.quickAction:nth-child(8n+5)){background:#f3f7f8!important}
        .dashboardPage :global(.quickAction:nth-child(8n+6)){background:#f4f5f8!important}
        .dashboardPage :global(.quickAction:nth-child(8n+7)){background:#faf4f4!important}
        .dashboardPage :global(.quickAction:nth-child(8n+8)){background:#f3f7f5!important}

        .dashboardPage :global(.quickActionIcon) {
          width:42px !important;
          height:42px !important;
          border-radius:13px !important;
          box-shadow:none !important;
        }

        .dashboardPage :global(.quickAction:nth-child(8n+1) .quickActionIcon){background:#655492!important}
        .dashboardPage :global(.quickAction:nth-child(8n+2) .quickActionIcon){background:#4f8472!important}
        .dashboardPage :global(.quickAction:nth-child(8n+3) .quickActionIcon){background:#94617e!important}
        .dashboardPage :global(.quickAction:nth-child(8n+4) .quickActionIcon){background:#9a774a!important}
        .dashboardPage :global(.quickAction:nth-child(8n+5) .quickActionIcon){background:#4d7d89!important}
        .dashboardPage :global(.quickAction:nth-child(8n+6) .quickActionIcon){background:#626a92!important}
        .dashboardPage :global(.quickAction:nth-child(8n+7) .quickActionIcon){background:#956262!important}
        .dashboardPage :global(.quickAction:nth-child(8n+8) .quickActionIcon){background:#4f806f!important}

        .dashboardPage :global(.quickAction strong) {
          color:#273042 !important;
          font-size:11px !important;
          font-weight:900 !important;
        }

        .dashboardPage :global(.quickAction > span) {
          color:#7a8190 !important;
          font-size:8px !important;
        }

        /* SALES TREND — clean blue/teal chart */
        .dashboardPage .trendChart {
          background:
            linear-gradient(to bottom,rgba(78,103,128,.05) 1px,transparent 1px),
            #fafbfc !important;
          background-size:100% 25%,100% 100% !important;
        }

        .dashboardPage .trendBar {
          background:linear-gradient(180deg,#655492 0%,#527383 52%,#4f806f 100%) !important;
          box-shadow:none !important;
        }

        .dashboardPage .trendValue {
          color:#55486f !important;
        }

        /* ALERT/LIST cards */
        .dashboardPage .compactList .compactRow {
          background:#fff !important;
          border-color:#e8eaee !important;
          box-shadow:none !important;
        }

        .dashboardPage .compactList .compactRow:nth-child(6n+1){box-shadow:inset 3px 0 #655492!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+2){box-shadow:inset 3px 0 #4f8472!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+3){box-shadow:inset 3px 0 #94617e!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+4){box-shadow:inset 3px 0 #9a774a!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+5){box-shadow:inset 3px 0 #4d7d89!important}
        .dashboardPage .compactList .compactRow:nth-child(6n+6){box-shadow:inset 3px 0 #626a92!important}

        /* VISITORS — light, not purple blocks */
        .dashboardPage .visitorMetrics .visitorMetric {
          background:#f7f8fa !important;
          border:1px solid #e5e8ed !important;
          color:#273042 !important;
          box-shadow:none !important;
        }

        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+1){border-top:3px solid #655492!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+2){border-top:3px solid #4f8472!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+3){border-top:3px solid #94617e!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+4){border-top:3px solid #9a774a!important}
        .dashboardPage .visitorMetrics .visitorMetric:nth-child(5n+5){border-top:3px solid #4d7d89!important}

        .dashboardPage .visitorMetric span { color:#7a8190 !important; }
        .dashboardPage .visitorMetric strong { color:#273042 !important; }

        .dashboardPage .sectionHeader span {
          background:transparent !important;
          padding:0 !important;
          color:#76655e !important;
          font-size:8px !important;
        }

        .dashboardPage .sectionHeader h2 {
          color:#293247 !important;
        }

        .dashboardPage .googleConnectButton {
          background:linear-gradient(135deg,#566b91,#527b68) !important;
          color:#fff !important;
        }

        .dashboardPage .googleRefreshButton {
          background:#f4f2f7 !important;
          color:#625779 !important;
          border-color:#ddd9e5 !important;
        }


        /* ============================================================
           NCS DASHBOARD — NO GOLD LABELS / READABILITY FINAL
           Gold remains only as a small brand accent, not as dashboard text.
           ============================================================ */

        /* Hero eyebrow: soft ivory/lavender instead of gold */
        .dashboardPage .hero > div > span {
          color:#D8D1EA !important;
        }

        /* Executive pulse tiny headings */
        .dashboardPage .executivePulseLead > span {
          color:#CFC5E8 !important;
        }

        .dashboardPage .executivePulseMetric > span {
          color:#687084 !important;
        }

        .dashboardPage .executivePulseMetric:nth-child(2) > span {color:#665A89!important}
        .dashboardPage .executivePulseMetric.profit > span {color:#4F806F!important}
        .dashboardPage .executivePulseMetric.money > span {color:#4D7D89!important}
        .dashboardPage .executivePulseMetric.attention > span {color:#9A774A!important}
        .dashboardPage .executivePulseMetric.attention.active > span {color:#94617E!important}

        /* Main KPI names: soft white, never gold */
        .dashboardPage :global(.businessKpi > div:not(.businessKpiMotion):not(.businessKpiPulse) > span) {
          color:rgba(255,255,255,.82) !important;
          font-size:8px !important;
          font-weight:900 !important;
        }

        /* Today's profit section */
        .dashboardPage .todayProfitHeader > div > span {
          color:#665A89 !important;
        }

        .dashboardPage .todayProfitMetric > span {
          color:#687084 !important;
        }

        .dashboardPage .todayProfitMetric.heroMetric > span {color:#665A89!important}
        .dashboardPage .todayProfitMetric:nth-child(2) > span {color:#4F806F!important}
        .dashboardPage .todayProfitMetric:nth-child(3) > span {color:#4D7D89!important}
        .dashboardPage .todayProfitMetric:nth-child(4) > span {color:#9A774A!important}
        .dashboardPage .todayProfitMetric.warning > span {color:#94617E!important}
        .dashboardPage .todayProfitMetric.danger > span {color:#956262!important}

        /* Fix all MiniKpi values/names which were nearly invisible */
        .dashboardPage .secondaryKpis :global(.miniKpi > span),
        .dashboardPage .catalogueKpis :global(.miniKpi > span) {
          color:#665A89 !important;
          font-size:7.5px !important;
          font-weight:950 !important;
          letter-spacing:.35px !important;
        }

        .dashboardPage .secondaryKpis :global(.miniKpi > strong),
        .dashboardPage .catalogueKpis :global(.miniKpi > strong) {
          color:#273042 !important;
          font-size:16px !important;
          font-weight:950 !important;
          opacity:1 !important;
        }

        .dashboardPage .secondaryKpis :global(.miniKpi > small),
        .dashboardPage .catalogueKpis :global(.miniKpi > small) {
          color:#7A8190 !important;
          opacity:1 !important;
        }

        .dashboardPage .secondaryKpis :global(.miniKpi:nth-child(6n+1) > span),
        .dashboardPage .catalogueKpis :global(.miniKpi:nth-child(6n+1) > span) {color:#665A89!important}
        .dashboardPage .secondaryKpis :global(.miniKpi:nth-child(6n+2) > span),
        .dashboardPage .catalogueKpis :global(.miniKpi:nth-child(6n+2) > span) {color:#4F806F!important}
        .dashboardPage .secondaryKpis :global(.miniKpi:nth-child(6n+3) > span),
        .dashboardPage .catalogueKpis :global(.miniKpi:nth-child(6n+3) > span) {color:#94617E!important}
        .dashboardPage .secondaryKpis :global(.miniKpi:nth-child(6n+4) > span),
        .dashboardPage .catalogueKpis :global(.miniKpi:nth-child(6n+4) > span) {color:#9A774A!important}
        .dashboardPage .secondaryKpis :global(.miniKpi:nth-child(6n+5) > span),
        .dashboardPage .catalogueKpis :global(.miniKpi:nth-child(6n+5) > span) {color:#4D7D89!important}
        .dashboardPage .secondaryKpis :global(.miniKpi:nth-child(6n+6) > span),
        .dashboardPage .catalogueKpis :global(.miniKpi:nth-child(6n+6) > span) {color:#626A92!important}

        /* Profit intelligence labels: lavender/teal on dark deck */
        .dashboardPage .profitIntelligencePanel > div > span,
        .dashboardPage .profitMetricCard span {
          color:#D4CCE8 !important;
        }

        .dashboardPage .profitMetricCard.highlight span {
          color:#A9D4C2 !important;
        }

        .dashboardPage .profitMetricCard.warning span {
          color:#D6B98A !important;
        }

        /* All ordinary panel section-eyebrows become muted violet/slate */
        .dashboardPage .sectionHeader span {
          color:#665A89 !important;
        }

        /* Alert / visitor / order labels should be dark and readable */
        .dashboardPage .compactRow span,
        .dashboardPage .popularPages span,
        .dashboardPage .googleBusinessPanel span {
          color:#687084;
        }

        /* Keep gold only in actual brand/action accents, not information labels */
        .dashboardPage .todayProfitHeader h2,
        .dashboardPage .sectionHeader h2 {
          color:#293247 !important;
        }

      `}</style>
    </div>
  );
}