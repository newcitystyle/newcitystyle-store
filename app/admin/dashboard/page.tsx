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

const ROYAL_BLUE = "#0A2E73";
const DEEP_BLUE = "#03153F";
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

    const cashSales = baseCashSales + cashExchangeMovement;
    const digitalSales = baseDigitalSales + digitalExchangeMovement;

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

    const monthSales = normalMonthSales + monthExchangeNet;

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
        ) + todayExchangeNet,
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
        amount: normalAmount + exchangeAmount,
      });
    }

    return points;
  }, [
    exchangeSettlements,
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
        <article className="panel">
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
          background: linear-gradient(145deg, #174f9e, #0a2e73, #061d4a);
          color: #f3d66f;
        }

        .heroCustomerBag.bagGold {
          background: linear-gradient(145deg, #f6df86, #d4af37, #b8890b);
          color: #061d4a;
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
          background: linear-gradient(135deg, #03153f, #0a2e73);
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
            linear-gradient(135deg, #03153f, #0a2e73 68%, #174da4);
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
          border: 1px solid #0a2e73;
          background: #0a2e73;
          color: #ffffff !important;
        }

        .googleRefreshButton {
          border: 1px solid #d4af37;
          background: #fffdf5;
          color: #0a2e73;
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

        @media (max-width: 720px) {
          .dashboardPage {
            padding: 12px 8px 30px;
          }

          .hero {
            padding: 20px;
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
      color: "#0A2E73",
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
          background: linear-gradient(135deg, #03153f, #0a2e73);
        }

        .businessKpi.gold {
          background: linear-gradient(135deg, #0a2e73, #765b12);
        }

        .businessKpi.green {
          background: linear-gradient(135deg, #063f42, #0a2e73);
        }

        .businessKpi.red {
          background: linear-gradient(135deg, #4c2131, #0a2e73);
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
          color: ${GOLD};
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.7px;
          text-transform: uppercase;
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
            ${ROYAL_BLUE},
            ${DEEP_BLUE}
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
          color: rgba(212, 175, 55, 0.18);
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
          color: ${GOLD};
          font-size: 7px;
          font-weight: 950;
          text-transform: uppercase;
        }

        strong {
          margin-top: 6px;
          overflow: hidden;
          font-size: 15px;
          font-weight: 950;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        small {
          margin-top: 5px;
          color: rgba(255, 255, 255, 0.62);
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
      `}</style>
    </div>
  );
}