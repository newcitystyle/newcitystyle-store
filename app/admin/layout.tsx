"use client";

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "badri.nsv@gmail.com";
const OFFLINE_POS_SESSION_KEY = "ncs_offline_pos_session_v1";

function isBrowserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function hasOfflinePosSession() {
  if (typeof window === "undefined") return false;

  try {
    const raw = window.sessionStorage.getItem(
      OFFLINE_POS_SESSION_KEY,
    );

    if (!raw) return false;

    const parsed = JSON.parse(raw) as {
      access?: string;
      unlockedAt?: string;
    };

    return parsed.access === "pos-only";
  } catch {
    return false;
  }
}

type AdminLayoutProps = {
  children: ReactNode;
};

type AdminMenuItem = {
  label: string;
  href: string;
  icon: string;
};

type AdminMenuGroup = {
  id: string;
  label: string;
  icon: string;
  items: AdminMenuItem[];
};

const menuGroups: AdminMenuGroup[] = [
  {
    id: "overview",
    label: "Overview",
    icon: "◈",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", icon: "🏠" },
      {
        label: "Owner Control Center",
        href: "/admin/owner-control",
        icon: "🎯",
      },
      {
        label: "Business Action Center",
        href: "/admin/business-action-center",
        icon: "🚦",
      },
    ],
  },
  {
    id: "sales",
    label: "Sales & Billing",
    icon: "▣",
    items: [
      { label: "Orders", href: "/admin/orders", icon: "📦" },
      { label: "Billing / POS", href: "/admin/pos", icon: "🧾" },
      {
        label: "Invoice Studio",
        href: "/admin/invoice-studio",
        icon: "🖨️",
      },
      {
        label: "POS Return History",
        href: "/admin/pos-returns",
        icon: "↩",
      },
      { label: "Returns", href: "/admin/returns", icon: "↩️" },
      {
        label: "Sales History",
        href: "/admin/sales-history",
        icon: "📊",
      },
      {
        label: "Billing Reports",
        href: "/admin/billing-reports",
        icon: "📈",
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: "▦",
    items: [
      { label: "Products", href: "/admin/products", icon: "🛍️" },
      {
        label: "Add Product",
        href: "/admin/add-product",
        icon: "➕",
      },
      {
        label: "Categories",
        href: "/admin/categories",
        icon: "🏷️",
      },
      {
        label: "Collections",
        href: "/admin/collections",
        icon: "✨",
      },
      {
        label: "Purchase Stock",
        href: "/admin/purchases",
        icon: "📥",
      },
      {
        label: "Purchase History",
        href: "/admin/purchase-history",
        icon: "📚",
      },
      {
        label: "Suppliers",
        href: "/admin/suppliers",
        icon: "🏭",
      },
      {
        label: "Barcodes & Stock",
        href: "/admin/barcodes",
        icon: "▥",
      },
      {
        label: "Stock Intelligence",
        href: "/admin/stock-intelligence",
        icon: "🧠",
      },
      {
        label: "Profit Intelligence",
        href: "/admin/profit-intelligence",
        icon: "💹",
      },
      {
        label: "Low Stock Report",
        href: "/admin/low-stock-report",
        icon: "⚠️",
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: "₹",
    items: [
      {
        label: "Daily Expenses",
        href: "/admin/expenses",
        icon: "💸",
      },
      {
        label: "Cash & Bank Book",
        href: "/admin/cash-bank-book",
        icon: "🏦",
      },
      {
        label: "Bank Cheques",
        href: "/admin/cheque-reminders",
        icon: "📝",
      },
      {
        label: "Party Ledgers",
        href: "/admin/party-ledgers",
        icon: "📒",
      },
      {
        label: "Reconciliation",
        href: "/admin/reconciliation",
        icon: "✅",
      },
      {
        label: "Customer Dues",
        href: "/admin/customer-dues",
        icon: "💰",
      },
      {
        label: "Payments",
        href: "/admin/payments",
        icon: "💳",
      },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    icon: "◎",
    items: [
      {
        label: "Customers",
        href: "/admin/customers",
        icon: "👥",
      },
      {
        label: "Customer Retention",
        href: "/admin/customer-retention",
        icon: "💎",
      },
      {
        label: "Customer Requests",
        href: "/admin/customer-requests",
        icon: "🔔",
      },
      { label: "Reviews", href: "/admin/reviews", icon: "⭐" },
      { label: "Coupons", href: "/admin/coupons", icon: "🎟️" },
    ],
  },
  {
    id: "growth",
    label: "Growth & Store",
    icon: "✦",
    items: [
      {
        label: "Marketing",
        href: "/admin/marketing",
        icon: "📣",
      },
      {
        label: "Digital Card Studio",
        href: "/admin/digital-card-studio",
        icon: "🪄",
      },
      {
        label: "Home Preview",
        href: "/admin/home-preview",
        icon: "🖥️",
      },
      {
        label: "Branding",
        href: "/admin/branding",
        icon: "🎨",
      },
      {
        label: "Shipping",
        href: "/admin/shipping",
        icon: "🚚",
      },
      { label: "SEO", href: "/admin/seo", icon: "🔍" },
      {
        label: "Analytics",
        href: "/admin/analytics",
        icon: "📊",
      },
      {
        label: "Store Details",
        href: "/admin/store-settings",
        icon: "⚙️",
      },
    ],
  },
];

const allMenuItems = menuGroups.flatMap((group) => group.items);





type TickerAlertItem = {
  id: string;
  type: "critical" | "warning" | "success" | "info" | "bank";
  label: string;
  message: string;
  href: string;
  isBankCheque: boolean;
};

const TICKER_DAY_MS = 86_400_000;

function startOfTickerDay(value: number) {
  const date = new Date(value);

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
}

function formatTickerMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatTickerDate(value: number) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getTickerWaitingDays(
  createdAt: string | null | undefined
) {
  if (!createdAt) return 0;

  const created = new Date(createdAt).getTime();

  if (!Number.isFinite(created)) return 0;

  return Math.max(
    0,
    Math.floor((Date.now() - created) / TICKER_DAY_MS)
  );
}

function BusinessAlertTicker() {
  const pathname = usePathname();

  const [requestRows, setRequestRows] = useState<
    Record<string, unknown>[]
  >([]);
  const [productRows, setProductRows] = useState<
    Record<string, unknown>[]
  >([]);
  const [businessAlertRows, setBusinessAlertRows] = useState<
    Record<string, unknown>[]
  >([]);
  const [chequeRows, setChequeRows] = useState<
    Record<string, unknown>[]
  >([]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState<
    "entering" | "holding" | "leaving"
  >("entering");

  async function loadTickerData() {
    const [
      requestsResult,
      productsResult,
      alertsResult,
      chequesResult,
    ] = await Promise.all([
      supabase
        .from("customer_product_requests")
        .select("*")
        .in("status", [
          "WAITING",
          "MATCH_FOUND",
          "CUSTOMER_CONTACTED",
          "RESERVED",
        ])
        .order("created_at", { ascending: true })
        .limit(30),

      supabase.from("products").select("*").limit(120),

      supabase
        .from("business_alerts")
        .select("*")
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(30),

      supabase
        .from("billing_cheques")
        .select("*")
        .eq("status", "UPCOMING")
        .eq("is_deleted", false)
        .order("due_date", { ascending: true })
        .limit(50),
    ]);

    if (!requestsResult.error) {
      setRequestRows(
        (requestsResult.data as Record<string, unknown>[]) || []
      );
    }

    if (!productsResult.error) {
      setProductRows(
        (productsResult.data as Record<string, unknown>[]) || []
      );
    }

    if (!alertsResult.error) {
      setBusinessAlertRows(
        (alertsResult.data as Record<string, unknown>[]) || []
      );
    }

    if (!chequesResult.error) {
      setChequeRows(
        (chequesResult.data as Record<string, unknown>[]) || []
      );
    }
  }

  useEffect(() => {
    if (pathname === "/admin/login") return;

    void loadTickerData();

    const channel = supabase
      .channel("ncs-all-business-alerts-ticker")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_product_requests",
        },
        () => void loadTickerData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        () => void loadTickerData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "business_alerts",
        },
        () => void loadTickerData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "billing_cheques",
        },
        () => void loadTickerData()
      )
      .subscribe();

    const refreshTimer = window.setInterval(
      () => void loadTickerData(),
      60_000
    );

    return () => {
      window.clearInterval(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [pathname]);

  const tickerItems = useMemo<TickerAlertItem[]>(() => {
    const items: TickerAlertItem[] = [];

    requestRows.forEach((row) => {
      const id = String(row.id || crypto.randomUUID());
      const status = String(row.status || "WAITING");
      const customerName = String(
        row.customer_name || "Customer"
      ).trim();
      const itemName = String(
        row.product_name ||
          row.item_name ||
          row.category ||
          "Requested item"
      ).trim();
      const size = String(row.size || "").trim();
      const colour = String(
        row.colour || row.color || ""
      ).trim();
      const waitingDays = getTickerWaitingDays(
        String(row.requested_at || row.created_at || "")
      );

      if (status === "MATCH_FOUND") {
        items.push({
          id: `request-match-${id}`,
          type: "success",
          label: "STOCK MATCH",
          message: `${itemName}${
            size ? ` • Size ${size}` : ""
          }${colour ? ` • ${colour}` : ""} • ${customerName} is waiting`,
          href: "/admin/customer-requests?status=MATCH_FOUND",
          isBankCheque: false,
        });
        return;
      }

      items.push({
        id: `request-${id}`,
        type:
          waitingDays >= 15
            ? "critical"
            : waitingDays >= 7
              ? "warning"
              : "info",
        label: "CUSTOMER REQUEST",
        message: `${customerName} • ${itemName}${
          size ? ` • Size ${size}` : ""
        } • waiting ${waitingDays} day${
          waitingDays === 1 ? "" : "s"
        }`,
        href: "/admin/customer-requests",
        isBankCheque: false,
      });
    });

    productRows.forEach((row) => {
      const stock = Number(
        row.stock ??
          row.quantity ??
          row.total_stock ??
          row.available_stock ??
          0
      );
      const lowStockLimit = Number(
        row.low_stock_limit ??
          row.lowStockLimit ??
          row.low_stock_alert ??
          5
      );
      const isActive =
        row.is_active === undefined ||
        row.is_active === null ||
        row.is_active === true;

      if (
        !isActive ||
        !Number.isFinite(stock) ||
        stock > lowStockLimit
      ) {
        return;
      }

      const id = String(row.id || crypto.randomUUID());
      const name = String(
        row.product_name ||
          row.name ||
          row.title ||
          "Product"
      ).trim();

      items.push({
        id: `stock-${id}`,
        type: stock <= 0 ? "critical" : "warning",
        label: stock <= 0 ? "OUT OF STOCK" : "LOW STOCK",
        message: `${name} • ${
          stock <= 0 ? "No stock left" : `${stock} left`
        } • alert at ${lowStockLimit}`,
        href: "/admin/low-stock-report",
        isBankCheque: false,
      });
    });

    businessAlertRows.forEach((row) => {
      const id = String(row.id || crypto.randomUUID());
      const priority = String(
        row.priority || "INFO"
      ).toUpperCase();

      items.push({
        id: `business-${id}`,
        type:
          priority === "CRITICAL"
            ? "critical"
            : priority === "WARNING"
              ? "warning"
              : priority === "SUCCESS"
                ? "success"
                : "info",
        label: String(
          row.title || row.alert_type || "BUSINESS ALERT"
        ).toUpperCase(),
        message: String(row.message || "").trim(),
        href: String(row.target_route || "/admin/dashboard"),
        isBankCheque: false,
      });
    });

    const today = startOfTickerDay(Date.now());

    chequeRows.forEach((row) => {
      const dueDate = startOfTickerDay(Number(row.due_date));
      const difference = Math.round(
        (dueDate - today) / TICKER_DAY_MS
      );

      if (!Number.isFinite(difference) || difference > 2) {
        return;
      }

      const label =
        difference < 0
          ? `CHEQUE OVERDUE ${Math.abs(difference)} DAY${
              Math.abs(difference) === 1 ? "" : "S"
            }`
          : difference === 0
            ? "CHEQUE DUE TODAY"
            : difference === 1
              ? "CHEQUE DUE TOMORROW"
              : "CHEQUE DUE IN 2 DAYS";

      items.push({
        id: `cheque-${String(row.id || crypto.randomUUID())}`,
        type: "bank",
        label,
        message: `${String(
          row.supplier_name || "Supplier"
        )} • ${formatTickerMoney(Number(row.amount || 0))} • ${String(
          row.bank_name || "Bank"
        )} / ${String(row.cheque_number || "")} • ${formatTickerDate(
          dueDate
        )}`,
        href: "/admin/cheque-reminders",
        isBankCheque: true,
      });
    });

    if (items.length === 0) {
      items.push({
        id: "all-clear",
        type: "success",
        label: "ALL SYSTEMS READY",
        message:
          "No urgent customer requests, stock alerts or cheque reminders.",
        href: "/admin/dashboard",
        isBankCheque: false,
      });
    }

    return items.slice(0, 60);
  }, [
    requestRows,
    productRows,
    businessAlertRows,
    chequeRows,
  ]);

  useEffect(() => {
    setActiveIndex((current) =>
      tickerItems.length === 0
        ? 0
        : current % tickerItems.length
    );
  }, [tickerItems.length]);

  const activeItem =
    tickerItems[activeIndex % tickerItems.length];

  useEffect(() => {
    if (!activeItem) return;

    setPhase("entering");

    const enterTime = 850;
    const holdTime = activeItem.isBankCheque ? 5_000 : 700;
    const leaveTime = 850;

    const holdTimer = window.setTimeout(() => {
      setPhase("holding");
    }, enterTime);

    const leaveTimer = window.setTimeout(() => {
      setPhase("leaving");
    }, enterTime + holdTime);

    const nextTimer = window.setTimeout(() => {
      setActiveIndex((current) =>
        tickerItems.length <= 1
          ? 0
          : (current + 1) % tickerItems.length
      );
      setPhase("entering");
    }, enterTime + holdTime + leaveTime);

    return () => {
      window.clearTimeout(holdTimer);
      window.clearTimeout(leaveTimer);
      window.clearTimeout(nextTimer);
    };
  }, [activeIndex, activeItem, tickerItems.length]);

  if (
    pathname === "/admin/login" ||
    tickerItems.length === 0 ||
    !activeItem
  ) {
    return null;
  }

  return (
    <section
      className={`ncsBusinessTicker ${
        activeItem.isBankCheque ? "ncsTickerBankActive" : ""
      }`}
      aria-label="Live business alerts"
    >
      <Link
        href={
          activeItem.isBankCheque
            ? "/admin/cheque-reminders"
            : "/admin/dashboard"
        }
        className="ncsTickerLiveBadge"
      >
        <span className="ncsTickerLiveDot" />
        LIVE BUSINESS ALERTS
      </Link>

      <div className="ncsTickerViewport">
        <Link
          key={`${activeItem.id}-${activeIndex}`}
          href={activeItem.href}
          className={`ncsChequeTickerCard ncsChequeTickerCard-${phase} ncsChequeTickerCard-${activeItem.type} ${
            activeItem.isBankCheque
              ? "ncsChequeTickerCard-bank-blink"
              : ""
          }`}
        >
          <span className="ncsChequeTickerLight" />

          <span className="ncsChequeTickerStatus">
            {activeItem.label}
          </span>

          <span className="ncsChequeTickerSupplier">
            {activeItem.message}
          </span>

          <span className="ncsTickerArrow">›</span>
        </Link>
      </div>
    </section>
  );
}

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const [openMenuGroup, setOpenMenuGroup] = useState("overview");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [favoriteHrefs, setFavoriteHrefs] = useState<string[]>([]);
  const [recentHrefs, setRecentHrefs] = useState<string[]>([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [offlinePosAccess, setOfflinePosAccess] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const isLoginPage = pathname === "/admin/login";

  const activeMenuGroup = useMemo(
    () =>
      menuGroups.find((group) =>
        group.items.some((item) => {
          if (item.href === "/admin/dashboard") {
            return pathname === "/admin" || pathname === "/admin/dashboard";
          }

          if (item.href === "/admin/products") {
            return pathname === "/admin/products";
          }

          return (
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`)
          );
        }),
      ) || menuGroups[0],
    [pathname],
  );

  const normalizedMenuSearch = menuSearch.trim().toLowerCase();

  const searchedMenuGroups = useMemo(() => {
    if (!normalizedMenuSearch) return menuGroups;

    return menuGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${item.label} ${group.label}`
            .toLowerCase()
            .includes(normalizedMenuSearch),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [normalizedMenuSearch]);

  useEffect(() => {
    if (!normalizedMenuSearch) {
      setOpenMenuGroup(activeMenuGroup.id);
    }
  }, [activeMenuGroup.id, normalizedMenuSearch]);

  useEffect(() => {
    try {
      const favoritesRaw = window.localStorage.getItem(
        "ncs_admin_favorite_hrefs_v1",
      );
      const recentsRaw = window.localStorage.getItem(
        "ncs_admin_recent_hrefs_v1",
      );

      if (favoritesRaw) {
        const parsed = JSON.parse(favoritesRaw);
        if (Array.isArray(parsed)) {
          setFavoriteHrefs(parsed.filter((value) => typeof value === "string"));
        }
      }

      if (recentsRaw) {
        const parsed = JSON.parse(recentsRaw);
        if (Array.isArray(parsed)) {
          setRecentHrefs(parsed.filter((value) => typeof value === "string"));
        }
      }
    } catch {
      setFavoriteHrefs([]);
      setRecentHrefs([]);
    }
  }, []);

  useEffect(() => {
    if (isLoginPage || offlinePosAccess) return;

    const currentItem = allMenuItems.find((item) => isActiveRoute(item.href));
    if (!currentItem) return;

    setRecentHrefs((current) => {
      const next = [
        currentItem.href,
        ...current.filter((href) => href !== currentItem.href),
      ].slice(0, 4);

      window.localStorage.setItem(
        "ncs_admin_recent_hrefs_v1",
        JSON.stringify(next),
      );

      return next;
    });
  }, [isLoginPage, offlinePosAccess, pathname]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCommandOpen(false);
        return;
      }

      const isCommandShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k";

      if (!isCommandShortcut) return;

      event.preventDefault();

      if (
        isLoginPage ||
        offlinePosAccess
      ) {
        return;
      }

      setCommandOpen(true);
      setCommandQuery("");
    };

    window.addEventListener("keydown", handleShortcut);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  }, [isLoginPage, offlinePosAccess]);

  useEffect(() => {
    if (isLoginPage) {
      setCheckingAccess(false);
      setHasAdminAccess(true);
      return;
    }

    let active = true;

    const allowOfflinePosIfPossible = () => {
      const offlineAllowed =
        pathname === "/admin/pos" && hasOfflinePosSession();

      if (offlineAllowed) {
        setOfflinePosAccess(true);
        setAdminEmail("Offline POS");
        setHasAdminAccess(true);
        setCheckingAccess(false);
        return true;
      }

      return false;
    };

    async function checkAccess() {
      setCheckingAccess(true);
      setIsOnline(isBrowserOnline());

      if (!isBrowserOnline() && allowOfflinePosIfPossible()) {
        return;
      }

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!active) return;

        if (error || !session?.user) {
          if (allowOfflinePosIfPossible()) {
            return;
          }

          setOfflinePosAccess(false);
          setHasAdminAccess(false);
          router.replace("/admin/login");
          return;
        }

        const email =
          session.user.email?.trim().toLowerCase() || "";

        if (email !== ADMIN_EMAIL) {
          await supabase.auth.signOut({ scope: "local" });

          if (!active) return;

          if (allowOfflinePosIfPossible()) {
            return;
          }

          setOfflinePosAccess(false);
          setHasAdminAccess(false);
          router.replace("/admin/login");
          return;
        }

        setOfflinePosAccess(false);
        setAdminEmail(email);
        setHasAdminAccess(true);
      } catch (error) {
        if (isBrowserOnline()) {
          console.error("Admin access check error:", error);
        }

        if (!active) return;

        if (allowOfflinePosIfPossible()) {
          return;
        }

        setOfflinePosAccess(false);
        setHasAdminAccess(false);
        router.replace("/admin/login");
      } finally {
        if (active) {
          setCheckingAccess(false);
        }
      }
    }

    const handleNetworkChange = () => {
      setIsOnline(isBrowserOnline());

      if (!isBrowserOnline()) {
        if (!allowOfflinePosIfPossible()) {
          router.replace("/admin/login");
        }
        return;
      }

      void checkAccess();
    };

    void checkAccess();

    window.addEventListener("online", handleNetworkChange);
    window.addEventListener("offline", handleNetworkChange);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      const email =
        session?.user?.email?.trim().toLowerCase() || "";

      if (session?.user && email === ADMIN_EMAIL) {
        setOfflinePosAccess(false);
        setAdminEmail(email);
        setHasAdminAccess(true);
        setCheckingAccess(false);
        return;
      }

      if (!session && !allowOfflinePosIfPossible()) {
        setAdminEmail("");
        setOfflinePosAccess(false);
        setHasAdminAccess(false);
        setCheckingAccess(false);
        router.replace("/admin/login");
      }
    });

    return () => {
      active = false;
      window.removeEventListener("online", handleNetworkChange);
      window.removeEventListener("offline", handleNetworkChange);
      subscription.unsubscribe();
    };
  }, [isLoginPage, pathname, router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  async function handleLogout() {
    try {
      window.sessionStorage.removeItem(OFFLINE_POS_SESSION_KEY);

      if (offlinePosAccess || !isBrowserOnline()) {
        setAdminEmail("");
        setOfflinePosAccess(false);
        setHasAdminAccess(false);
        setSidebarOpen(false);
        window.location.replace("/admin/login");
        return;
      }

      const { error } = await supabase.auth.signOut({
        scope: "local",
      });

      if (error) {
        throw error;
      }

      setAdminEmail("");
      setHasAdminAccess(false);
      setSidebarOpen(false);

      window.location.replace("/admin/login");
    } catch (error) {
      console.error("Admin logout error:", error);
      alert("Unable to logout. Please try again.");
    }
  }

  const favoriteItems = useMemo(
    () =>
      favoriteHrefs
        .map((href) => allMenuItems.find((item) => item.href === href))
        .filter((item): item is AdminMenuItem => Boolean(item))
        .slice(0, 5),
    [favoriteHrefs],
  );

  const recentItems = useMemo(
    () =>
      recentHrefs
        .map((href) => allMenuItems.find((item) => item.href === href))
        .filter((item): item is AdminMenuItem => Boolean(item))
        .slice(0, 4),
    [recentHrefs],
  );

  const commandItems = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();

    if (!query) {
      return allMenuItems.slice(0, 18);
    }

    return allMenuItems
      .filter((item) =>
        `${item.label} ${item.href}`.toLowerCase().includes(query),
      )
      .slice(0, 18);
  }, [commandQuery]);

  function toggleFavorite(href: string) {
    setFavoriteHrefs((current) => {
      const next = current.includes(href)
        ? current.filter((value) => value !== href)
        : [href, ...current].slice(0, 5);

      window.localStorage.setItem(
        "ncs_admin_favorite_hrefs_v1",
        JSON.stringify(next),
      );

      return next;
    });
  }

  function isActiveRoute(href: string) {
    if (href === "/admin/dashboard") {
      return pathname === "/admin" || pathname === "/admin/dashboard";
    }

    if (href === "/admin/products") {
      return pathname === "/admin/products";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (checkingAccess) {
    return (
      <main className="ncsCheckingPage">
        <div className="ncsCheckingLogo">NCS</div>
        <div className="ncsSpinner" />
        <h2>Opening Admin Studio...</h2>
        <p>Verifying your secure NEW CITY STYLE admin session.</p>

        <style jsx global>{`
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
          }

          .ncsCheckingPage {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background:
              radial-gradient(
                circle at 18% 18%,
                rgba(212, 175, 55, 0.18),
                transparent 28%
              ),
              linear-gradient(135deg, #03153f, #0a2e73, #164ca8);
            color: #ffffff;
            text-align: center;
            font-family: Poppins, Inter, Arial, sans-serif;
          }

          .ncsCheckingLogo {
            width: 88px;
            height: 88px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #d4af37;
            border-radius: 25px;
            background: rgba(212, 175, 55, 0.1);
            color: #d4af37;
            font-size: 25px;
            font-weight: 950;
            letter-spacing: 2px;
          }

          .ncsSpinner {
            width: 45px;
            height: 45px;
            margin-top: 25px;
            border: 4px solid rgba(255, 255, 255, 0.22);
            border-top-color: #d4af37;
            border-radius: 50%;
            animation: ncsSpin 0.8s linear infinite;
          }

          .ncsCheckingPage h2 {
            margin: 18px 0 0;
            font-size: 21px;
          }

          .ncsCheckingPage p {
            margin: 9px 0 0;
            color: rgba(255, 255, 255, 0.68);
            font-size: 13px;
          }

          @keyframes ncsSpin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  if (!hasAdminAccess) {
    return null;
  }

  return (
    <div
      className={
        sidebarCollapsed
          ? "ncsAdminShell ncsAdminShellCollapsed"
          : "ncsAdminShell"
      }
    >
      <button
        type="button"
        className="ncsMobileMenuButton"
        onClick={() => setSidebarOpen((current) => !current)}
        aria-label="Open admin menu"
      >
        ☰
      </button>

      {sidebarOpen && (
        <button
          type="button"
          className="ncsMobileOverlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close admin menu"
        />
      )}

      {commandOpen && !offlinePosAccess && (
        <div
          className="ncsCommandOverlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setCommandOpen(false);
            }
          }}
        >
          <section
            className="ncsCommandPalette"
            role="dialog"
            aria-modal="true"
            aria-label="Admin command palette"
          >
            <div className="ncsCommandHeader">
              <div>
                <span>NEW CITY STYLE</span>
                <strong>Command Palette</strong>
              </div>

              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                aria-label="Close command palette"
              >
                ×
              </button>
            </div>

            <div className="ncsCommandSearchWrap">
              <span>⌕</span>
              <input
                autoFocus
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Type page or action..."
              />
              <kbd>ESC</kbd>
            </div>

            <div className="ncsCommandResults">
              {commandItems.map((item) => (
                <Link
                  key={`command-${item.href}`}
                  href={item.href}
                  className="ncsCommandResult"
                  onClick={() => setCommandOpen(false)}
                >
                  <span className="ncsCommandResultIcon">{item.icon}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.href}</small>
                  </div>
                  <span className="ncsCommandResultArrow">↗</span>
                </Link>
              ))}

              {commandItems.length === 0 && (
                <div className="ncsCommandEmpty">
                  No matching page found.
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <aside
        className={`ncsSidebar ${
          sidebarOpen ? "ncsSidebarOpen" : ""
        } ${sidebarCollapsed ? "ncsSidebarCollapsed" : ""}`}
      >
        <button
          type="button"
          className="ncsSidebarCollapseButton"
          onClick={() =>
            setSidebarCollapsed((current) => !current)
          }
          aria-label={
            sidebarCollapsed
              ? "Expand admin sidebar"
              : "Collapse admin sidebar"
          }
          title={
            sidebarCollapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
        >
          {sidebarCollapsed ? "›" : "‹"}
        </button>
        <div className="ncsBrandArea">
          <div className="ncsBrandLogo">NCS</div>

          <div className="ncsBrandText">
            <strong>NEW CITY STYLE</strong>
            <span>Premium Admin Studio</span>
          </div>
        </div>

        <nav className="ncsMenu" aria-label="Admin navigation">
          {offlinePosAccess ? (
            <Link
              href="/admin/pos"
              className={
                isActiveRoute("/admin/pos")
                  ? "ncsMenuItem ncsActiveMenuItem"
                  : "ncsMenuItem"
              }
              title="Billing / POS"
            >
              <span className="ncsMenuIcon">🧾</span>
              <span className="ncsMenuLabel">Billing / POS</span>
            </Link>
          ) : sidebarCollapsed ? (
            <div className="ncsCollapsedGroupRail">
              {menuGroups.map((group) => {
                const groupActive = group.id === activeMenuGroup.id;

                return (
                  <button
                    key={group.id}
                    type="button"
                    className={
                      groupActive
                        ? "ncsCollapsedGroupButton ncsCollapsedGroupButtonActive"
                        : "ncsCollapsedGroupButton"
                    }
                    title={group.label}
                    aria-label={`Open ${group.label}`}
                    onClick={() => {
                      setSidebarCollapsed(false);
                      setOpenMenuGroup(group.id);
                    }}
                  >
                    <span>{group.icon}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="ncsMenuSearchWrap">
                <span className="ncsMenuSearchIcon">⌕</span>
                <input
                  value={menuSearch}
                  onChange={(event) => setMenuSearch(event.target.value)}
                  className="ncsMenuSearch"
                  placeholder="Search menu..."
                  aria-label="Search admin menu"
                />
                {menuSearch && (
                  <button
                    type="button"
                    className="ncsMenuSearchClear"
                    onClick={() => setMenuSearch("")}
                    aria-label="Clear menu search"
                  >
                    ×
                  </button>
                )}
              </div>

              <button
                type="button"
                className="ncsCommandTrigger"
                onClick={() => {
                  setCommandOpen(true);
                  setCommandQuery("");
                }}
              >
                <span>⌘</span>
                <strong>Command Palette</strong>
                <kbd>Ctrl K</kbd>
              </button>

              {(favoriteItems.length > 0 || recentItems.length > 0) &&
                !normalizedMenuSearch && (
                  <div className="ncsMenuSmartArea">
                    {favoriteItems.length > 0 && (
                      <div className="ncsSmartBlock">
                        <div className="ncsSmartBlockHeader">
                          <span>★ FAVORITES</span>
                          <small>{favoriteItems.length}</small>
                        </div>

                        <div className="ncsSmartLinks">
                          {favoriteItems.map((item) => (
                            <Link
                              key={`favorite-${item.href}`}
                              href={item.href}
                              className={
                                isActiveRoute(item.href)
                                  ? "ncsSmartLink ncsSmartLinkActive"
                                  : "ncsSmartLink"
                              }
                            >
                              <span>{item.icon}</span>
                              <strong>{item.label}</strong>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {recentItems.length > 0 && (
                      <div className="ncsSmartBlock">
                        <div className="ncsSmartBlockHeader">
                          <span>RECENT</span>
                          <small>{recentItems.length}</small>
                        </div>

                        <div className="ncsSmartLinks">
                          {recentItems.map((item) => (
                            <Link
                              key={`recent-${item.href}`}
                              href={item.href}
                              className="ncsSmartLink"
                            >
                              <span>{item.icon}</span>
                              <strong>{item.label}</strong>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              <div className="ncsMenuGroups">
                {searchedMenuGroups.map((group) => {
                  const groupHasActiveItem = group.items.some((item) =>
                    isActiveRoute(item.href),
                  );

                  const groupOpen =
                    normalizedMenuSearch.length > 0 ||
                    openMenuGroup === group.id;

                  return (
                    <div
                      key={group.id}
                      className={
                        groupHasActiveItem
                          ? "ncsMenuGroup ncsMenuGroupActive"
                          : "ncsMenuGroup"
                      }
                    >
                      <button
                        type="button"
                        className="ncsMenuGroupButton"
                        onClick={() =>
                          setOpenMenuGroup((current) =>
                            current === group.id ? "" : group.id,
                          )
                        }
                        aria-expanded={groupOpen}
                      >
                        <span className="ncsMenuGroupIcon">
                          {group.icon}
                        </span>

                        <span className="ncsMenuGroupLabel">
                          {group.label}
                        </span>

                        <span className="ncsMenuGroupCount">
                          {group.items.length}
                        </span>

                        <span
                          className={
                            groupOpen
                              ? "ncsMenuGroupChevron ncsMenuGroupChevronOpen"
                              : "ncsMenuGroupChevron"
                          }
                        >
                          ›
                        </span>
                      </button>

                      <div
                        className="ncsMenuGroupItems"
                        style={{
                          display: groupOpen ? "grid" : "none",
                        }}
                      >
                          {group.items.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              title={item.label}
                              className={
                                isActiveRoute(item.href)
                                  ? "ncsMenuItem ncsActiveMenuItem"
                                  : "ncsMenuItem"
                              }
                            >
                              <span className="ncsMenuIcon">
                                {item.icon}
                              </span>
                              <span className="ncsMenuLabel">
                                {item.label}
                              </span>
                              <button
                                type="button"
                                className={
                                  favoriteHrefs.includes(item.href)
                                    ? "ncsFavoriteButton ncsFavoriteButtonActive"
                                    : "ncsFavoriteButton"
                                }
                                aria-label={
                                  favoriteHrefs.includes(item.href)
                                    ? `Remove ${item.label} from favorites`
                                    : `Add ${item.label} to favorites`
                                }
                                title={
                                  favoriteHrefs.includes(item.href)
                                    ? "Remove favorite"
                                    : "Add favorite"
                                }
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  toggleFavorite(item.href);
                                }}
                              >
                                ★
                              </button>
                            </Link>
                          ))}
                        </div>
                    </div>
                  );
                })}

                {searchedMenuGroups.length === 0 && (
                  <div className="ncsMenuEmpty">
                    <strong>No menu found</strong>
                    <span>Try another keyword.</span>
                  </div>
                )}
              </div>
            </>
          )}
        </nav>

        <div className="ncsSidebarBottom">
          <div className="ncsAdminIdentity">
            <div className="ncsAdminAvatar">N</div>

            <div className="ncsAdminText">
              <strong>
                {offlinePosAccess ? "Offline POS Operator" : "Administrator"}
              </strong>
              <span>
                {offlinePosAccess
                  ? isOnline
                    ? "Internet restored — sync will start"
                    : "POS-only local access"
                  : adminEmail}
              </span>
            </div>
          </div>

          {!offlinePosAccess && (
            <Link href="/" className="ncsViewStoreButton">
              <span>🏪</span>
              View Store
            </Link>
          )}

          <button
            type="button"
            className="ncsLogoutButton"
            onClick={handleLogout}
          >
            <span>🚪</span>
            Logout
          </button>
        </div>
      </aside>

      <main className="ncsAdminContent">
        {!offlinePosAccess && <BusinessAlertTicker />}

        {offlinePosAccess && (
          <div className="ncsOfflinePosBanner">
            <span>● OFFLINE POS</span>
            <strong>Cached stock billing is active</strong>
            <small>
              Bills are saved safely on this computer and will sync
              automatically when internet returns.
            </small>
          </div>
        )}

        <div className="ncsAdminPageContent">{children}</div>
      </main>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          min-height: 100%;
        }

        body {
          background: #f8f4ec;
        }

        .ncsAdminShell {
          min-height: 100vh;
          background: #f8f4ec;
          font-family: Poppins, Inter, Arial, sans-serif;
        }


        .ncsAdminPageContent {
          min-width: 0;
        }


.ncsBusinessTicker {
  position: sticky;
  z-index: 80;
  top: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  min-height: 62px;
  overflow: hidden;
  border-top: 1px solid rgba(212, 175, 55, 0.75);
  border-bottom: 1px solid rgba(212, 175, 55, 0.82);
  background:
    radial-gradient(
      circle at 18% 20%,
      rgba(212, 175, 55, 0.22),
      transparent 24%
    ),
    linear-gradient(90deg, #fffdf7, #f8f4ec, #fff8df);
  box-shadow:
    0 10px 26px rgba(3, 21, 63, 0.18),
    inset 0 -1px 0 rgba(255, 255, 255, 0.9);
}

.ncsTickerLiveBadge {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-width: 190px;
  padding: 0 20px;
  border-right: 1px solid rgba(212, 175, 55, 0.78);
  background:
    radial-gradient(
      circle at 88% 18%,
      rgba(212, 175, 55, 0.22),
      transparent 34%
    ),
    linear-gradient(135deg, #020b24, #061d4a, #0a2e73);
  box-shadow: 9px 0 22px rgba(3, 21, 63, 0.2);
  color: #f3d66f !important;
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0.95px;
  text-decoration: none !important;
  white-space: nowrap;
}

.ncsTickerLiveDot {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #ffd75f;
  box-shadow:
    0 0 0 4px rgba(255, 215, 95, 0.16),
    0 0 15px rgba(255, 215, 95, 0.92);
  animation: ncsChequeBadgePulse 1.15s ease-in-out infinite;
}

.ncsTickerViewport {
  position: relative;
  min-width: 0;
  min-height: 62px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 18px;
}

.ncsChequeTickerCard {
  position: absolute;
  left: 50%;
  top: 50%;
  width: max-content;
  max-width: calc(100% - 32px);
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px 16px 8px 13px;
  border: 1px solid rgba(10, 46, 115, 0.17);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.98);
  color: #0a2e73 !important;
  box-shadow:
    0 7px 18px rgba(3, 21, 63, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.96);
  text-decoration: none !important;
  white-space: nowrap;
  will-change: transform, opacity, box-shadow;
}

.ncsChequeTickerCard-entering {
  animation: ncsChequeEnter 0.76s cubic-bezier(0.22, 1, 0.36, 1)
    both;
}

.ncsChequeTickerCard-holding {
  transform: translate(-50%, -50%);
  opacity: 1;
}

.ncsChequeTickerCard-leaving {
  animation: ncsChequeLeave 0.8s cubic-bezier(0.64, 0, 0.78, 0)
    both;
}

.ncsChequeTickerCard-holding.ncsChequeTickerCard-bank-blink
  .ncsChequeTickerLight {
  animation: ncsChequeLightBlink 0.58s ease-in-out infinite;
}

.ncsChequeTickerCard-holding.ncsChequeTickerCard-bank-blink {
  animation: ncsChequeCardBlink 0.72s ease-in-out infinite;
}

.ncsChequeTickerLight {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #d4af37;
  box-shadow:
    0 0 0 4px rgba(212, 175, 55, 0.15),
    0 0 13px rgba(212, 175, 55, 0.7);
}

.ncsChequeTickerCard-today .ncsChequeTickerLight,
.ncsChequeTickerCard-overdue .ncsChequeTickerLight {
  background: #e02929;
  box-shadow:
    0 0 0 4px rgba(224, 41, 41, 0.15),
    0 0 17px rgba(224, 41, 41, 0.88);
}

.ncsChequeTickerStatus {
  display: inline-flex;
  align-items: center;
  min-height: 25px;
  padding: 4px 9px;
  border: 1px solid rgba(180, 132, 0, 0.34);
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.13);
  color: #8a6400;
  font-size: 9px;
  font-weight: 950;
  letter-spacing: 0.55px;
}

.ncsChequeTickerCard-today .ncsChequeTickerStatus,
.ncsChequeTickerCard-overdue .ncsChequeTickerStatus {
  border-color: rgba(179, 38, 30, 0.38);
  background: rgba(179, 38, 30, 0.1);
  color: #a11f18;
}

.ncsChequeTickerCard-critical .ncsChequeTickerStatus {
  border-color: rgba(179, 38, 30, 0.38);
  background: rgba(179, 38, 30, 0.1);
  color: #a11f18;
}

.ncsChequeTickerCard-warning .ncsChequeTickerStatus,
.ncsChequeTickerCard-bank .ncsChequeTickerStatus {
  border-color: rgba(180, 132, 0, 0.38);
  background: rgba(212, 175, 55, 0.14);
  color: #8a6400;
}

.ncsChequeTickerCard-success .ncsChequeTickerStatus {
  border-color: rgba(22, 131, 74, 0.34);
  background: rgba(22, 131, 74, 0.1);
  color: #126b3e;
}

.ncsChequeTickerCard-info .ncsChequeTickerStatus {
  border-color: rgba(10, 46, 115, 0.24);
  background: rgba(10, 46, 115, 0.08);
  color: #0a2e73;
}

.ncsTickerBankActive {
  border-top-color: rgba(212, 175, 55, 0.95);
  border-bottom-color: rgba(212, 175, 55, 0.95);
}


.ncsChequeTickerSupplier,
.ncsChequeTickerAmount {
  overflow: hidden;
  color: #061d4a;
  font-size: 12px;
  font-weight: 900;
  text-overflow: ellipsis;
}

.ncsChequeTickerAmount {
  color: #9a7100;
}

.ncsChequeTickerBank,
.ncsChequeTickerDate {
  color: #42506d;
  font-size: 10px;
  font-weight: 800;
}

.ncsChequeTickerSeparator {
  color: rgba(10, 46, 115, 0.28);
  font-weight: 900;
}

.ncsTickerArrow {
  color: #b8890b;
  font-size: 20px;
  font-weight: 950;
  line-height: 1;
}

@keyframes ncsChequeEnter {
  from {
    transform: translate(90vw, -50%);
    opacity: 0.2;
  }
  to {
    transform: translate(-50%, -50%);
    opacity: 1;
  }
}

@keyframes ncsChequeLeave {
  from {
    transform: translate(-50%, -50%);
    opacity: 1;
  }
  to {
    transform: translate(-110vw, -50%);
    opacity: 0.15;
  }
}

@keyframes ncsChequeLightBlink {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.82);
  }
  50% {
    opacity: 1;
    transform: scale(1.22);
  }
}

@keyframes ncsChequeCardBlink {
  0%,
  100% {
    box-shadow:
      0 7px 18px rgba(3, 21, 63, 0.12),
      0 0 0 1px rgba(179, 38, 30, 0.05);
  }
  50% {
    box-shadow:
      0 11px 26px rgba(179, 38, 30, 0.24),
      0 0 0 3px rgba(224, 41, 41, 0.13);
  }
}

@keyframes ncsChequeBadgePulse {
  0%,
  100% {
    opacity: 0.48;
    transform: scale(0.86);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}
        .ncsOfflinePosBanner {
          position: sticky;
          z-index: 85;
          top: 0;
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px 18px;
          border-top: 1px solid #d4af37;
          border-bottom: 1px solid #d4af37;
          background:
            radial-gradient(
              circle at 12% 20%,
              rgba(212, 175, 55, 0.18),
              transparent 24%
            ),
            linear-gradient(90deg, #fff8df, #fffdf7);
          color: #0a2e73;
          box-shadow: 0 8px 22px rgba(3, 21, 63, 0.12);
          text-align: center;
        }

        .ncsOfflinePosBanner span {
          color: #b8890b;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.8px;
        }

        .ncsOfflinePosBanner strong {
          font-size: 11px;
        }

        .ncsOfflinePosBanner small {
          color: #667085;
          font-size: 9px;
        }

        .ncsSidebar {
          position: fixed;
          z-index: 100;
          top: 0;
          bottom: 0;
          left: 0;
          width: 292px;
          display: flex;
          flex-direction: column;
          padding: 22px 17px;
          overflow: visible;
          background:
            radial-gradient(
              circle at 25% 0%,
              rgba(212, 175, 55, 0.18),
              transparent 26%
            ),
            linear-gradient(180deg, #03153f 0%, #08265f 48%, #0a2e73 100%);
          color: #ffffff;
          box-shadow: 12px 0 35px rgba(3, 21, 63, 0.2);
          scrollbar-width: thin;
          scrollbar-color: rgba(212, 175, 55, 0.55) transparent;
        }

        .ncsSidebar::-webkit-scrollbar {
          width: 5px;
        }

        .ncsSidebar::-webkit-scrollbar-thumb {
          border-radius: 10px;
          background: rgba(212, 175, 55, 0.55);
        }

        .ncsBrandArea {
          display: flex;
          align-items: center;
          gap: 13px;
          min-height: 68px;
          padding: 3px 7px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.13);
        }

        .ncsBrandLogo {
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 2px solid #d4af37;
          border-radius: 18px;
          background: rgba(212, 175, 55, 0.08);
          color: #d4af37;
          font-size: 18px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .ncsBrandText {
          min-width: 0;
        }

        .ncsBrandText strong,
        .ncsBrandText span {
          display: block;
        }

        .ncsBrandText strong {
          color: #d4af37;
          font-size: 16px;
          font-weight: 900;
          line-height: 1.25;
          letter-spacing: 0.4px;
          white-space: nowrap;
        }

        .ncsBrandText span {
          margin-top: 4px;
          color: rgba(255, 255, 255, 0.68);
          font-size: 11px;
          font-weight: 600;
        }

        .ncsMenu {
          min-height: 0;
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 10px;
          margin-top: 14px;
        }

        .ncsMenuSearchWrap {
          position: relative;
          flex: 0 0 auto;
        }

        .ncsMenuSearch {
          width: 100%;
          height: 42px;
          padding: 0 38px 0 38px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          outline: none;
          border-radius: 12px;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.10),
              rgba(255, 255, 255, 0.055)
            );
          color: #ffffff;
          font: inherit;
          font-size: 11px;
          font-weight: 700;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
          transition:
            border-color 0.2s ease,
            background 0.2s ease,
            box-shadow 0.2s ease;
        }

        .ncsMenuSearch::placeholder {
          color: rgba(255, 255, 255, 0.48);
        }

        .ncsMenuSearch:focus {
          border-color: rgba(212, 175, 55, 0.72);
          background: rgba(255, 255, 255, 0.11);
          box-shadow:
            0 0 0 3px rgba(212, 175, 55, 0.09),
            inset 0 1px 0 rgba(255, 255, 255, 0.07);
        }

        .ncsMenuSearchIcon {
          position: absolute;
          z-index: 2;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #f1d26a;
          font-size: 18px;
          line-height: 1;
          pointer-events: none;
        }

        .ncsMenuSearchClear {
          position: absolute;
          z-index: 2;
          right: 8px;
          top: 50%;
          width: 28px;
          height: 28px;
          transform: translateY(-50%);
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: rgba(255, 255, 255, 0.68);
          font-size: 18px;
          cursor: pointer;
        }

        .ncsMenuSearchClear:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }

        .ncsMenuGroups {
          min-height: 0;
          max-height: calc(100vh - 365px);
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 7px;
          overflow-x: hidden;
          overflow-y: auto;
          padding: 1px 2px 4px 0;
          scrollbar-width: thin;
          scrollbar-color: rgba(212, 175, 55, 0.36) transparent;
        }

        .ncsMenuGroups::-webkit-scrollbar {
          width: 4px;
        }

        .ncsMenuGroups::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(212, 175, 55, 0.36);
        }

        .ncsMenuGroup {
          position: relative;
          display: block;
          flex: 0 0 auto;
          width: 100%;
          height: auto !important;
          min-height: 47px;
          overflow: hidden !important;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 13px;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.055),
              rgba(255, 255, 255, 0.025)
            );
          transition:
            border-color 0.2s ease,
            background 0.2s ease,
            box-shadow 0.2s ease;
        }

        .ncsMenuGroupActive {
          margin-bottom: 2px;
          border-color: rgba(212, 175, 55, 0.34);
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(212, 175, 55, 0.12),
              transparent 38%
            ),
            rgba(255, 255, 255, 0.045);
          box-shadow: inset 3px 0 0 rgba(212, 175, 55, 0.72);
        }

        .ncsMenuGroupButton {
          position: relative;
          z-index: 3;
          flex: 0 0 auto;
          width: 100%;
          min-height: 47px;
          display: grid;
          grid-template-columns: 30px minmax(0, 1fr) auto 18px;
          align-items: center;
          gap: 9px;
          padding: 0 11px;
          border: 0;
          background: transparent;
          color: #ffffff;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
        }

        .ncsMenuGroupButton:hover {
          background: rgba(255, 255, 255, 0.055);
        }

        .ncsMenuGroupIcon {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(212, 175, 55, 0.26);
          border-radius: 9px;
          background: rgba(212, 175, 55, 0.08);
          color: #f1d26a;
          font-size: 15px;
          font-weight: 950;
        }

        .ncsMenuGroupLabel {
          min-width: 0;
          overflow: hidden;
          font-size: 12px;
          font-weight: 850;
          letter-spacing: 0.05px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsMenuGroupCount {
          min-width: 22px;
          height: 20px;
          display: grid;
          place-items: center;
          padding: 0 6px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.055);
          color: rgba(255, 255, 255, 0.57);
          font-size: 8px;
          font-weight: 900;
        }

        .ncsMenuGroupChevron {
          color: rgba(255, 255, 255, 0.58);
          font-size: 20px;
          line-height: 1;
          transform: rotate(0deg);
          transition: transform 0.2s ease;
        }

        .ncsMenuGroupChevronOpen {
          transform: rotate(90deg);
          color: #f1d26a;
        }

        .ncsMenuGroupItems {
          position: relative !important;
          width: 100%;
          height: auto !important;
          min-height: 0;
          grid-auto-flow: row;
          grid-auto-rows: minmax(40px, auto);
          gap: 4px;
          padding: 0 7px 7px 7px;
          overflow: hidden !important;
          animation: ncsMenuGroupReveal 0.22s ease both;
        }

        .ncsMenuItem {
          position: relative;
          width: 100%;
          min-height: 40px;
          display: flex;
          flex: 0 0 auto;
          align-items: center;
          gap: 9px;
          padding: 0 10px;
          border: 1px solid transparent;
          border-radius: 9px;
          color: rgba(255, 255, 255, 0.76) !important;
          font-size: 11px;
          font-weight: 720;
          line-height: 1;
          text-decoration: none !important;
          white-space: nowrap;
          transition:
            transform 0.18s ease,
            background 0.18s ease,
            border-color 0.18s ease,
            color 0.18s ease;
        }

        .ncsMenuItem:hover {
          transform: translateX(2px);
          border-color: rgba(255, 255, 255, 0.09);
          background: rgba(255, 255, 255, 0.065);
          color: #ffffff !important;
        }

        .ncsActiveMenuItem {
          border-color: rgba(255, 255, 255, 0.38);
          background:
            linear-gradient(
              135deg,
              #d4af37,
              #f1d26a
            );
          color: #0a2e73 !important;
          box-shadow: 0 8px 20px rgba(212, 175, 55, 0.19);
        }

        .ncsMenuIcon {
          width: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 15px;
        }

        .ncsMenuLabel {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ncsMenuEmpty {
          display: grid;
          gap: 4px;
          padding: 18px 12px;
          border: 1px dashed rgba(255, 255, 255, 0.13);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.56);
          text-align: center;
        }

        .ncsMenuEmpty strong {
          color: #f1d26a;
          font-size: 11px;
        }

        .ncsMenuEmpty span {
          font-size: 9px;
        }

        .ncsCollapsedGroupRail {
          display: grid;
          gap: 7px;
        }

        .ncsCollapsedGroupButton {
          width: 100%;
          height: 48px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.045);
          color: #f1d26a;
          font-size: 17px;
          font-weight: 950;
          cursor: pointer;
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            background 0.18s ease;
        }

        .ncsCollapsedGroupButton:hover {
          transform: translateY(-1px);
          border-color: rgba(212, 175, 55, 0.48);
          background: rgba(212, 175, 55, 0.10);
        }

        .ncsCollapsedGroupButtonActive {
          border-color: rgba(212, 175, 55, 0.70);
          background:
            linear-gradient(
              145deg,
              rgba(212, 175, 55, 0.22),
              rgba(212, 175, 55, 0.08)
            );
          box-shadow: 0 7px 18px rgba(212, 175, 55, 0.14);
        }

        @keyframes ncsMenuGroupReveal {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .ncsCommandTrigger {
          width: 100%;
          min-height: 36px;
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          border: 1px solid rgba(212, 175, 55, 0.26);
          border-radius: 10px;
          background:
            linear-gradient(
              145deg,
              rgba(212, 175, 55, 0.10),
              rgba(255, 255, 255, 0.035)
            );
          color: #ffffff;
          cursor: pointer;
          text-align: left;
        }

        .ncsCommandTrigger > span {
          color: #f1d26a;
          font-size: 14px;
          font-weight: 950;
        }

        .ncsCommandTrigger strong {
          overflow: hidden;
          font-size: 10px;
          font-weight: 850;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsCommandTrigger kbd {
          padding: 3px 6px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.58);
          font-size: 7px;
          font-family: inherit;
          font-weight: 800;
        }

        .ncsMenuSmartArea {
          display: grid;
          gap: 6px;
        }

        .ncsSmartBlock {
          padding: 7px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.035);
        }

        .ncsSmartBlockHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 1px 3px 6px;
        }

        .ncsSmartBlockHeader span {
          color: #f1d26a;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.8px;
        }

        .ncsSmartBlockHeader small {
          color: rgba(255, 255, 255, 0.42);
          font-size: 7px;
        }

        .ncsSmartLinks {
          display: flex;
          gap: 5px;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .ncsSmartLinks::-webkit-scrollbar {
          display: none;
        }

        .ncsSmartLink {
          min-width: 0;
          max-width: 115px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 8px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.74) !important;
          font-size: 8px;
          text-decoration: none !important;
          white-space: nowrap;
        }

        .ncsSmartLink strong {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ncsSmartLinkActive {
          border-color: rgba(212, 175, 55, 0.44);
          background: rgba(212, 175, 55, 0.12);
          color: #f5dd87 !important;
        }

        .ncsFavoriteButton {
          width: 24px;
          height: 24px;
          margin-left: auto;
          flex: 0 0 auto;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: rgba(255, 255, 255, 0.18);
          font-size: 12px;
          cursor: pointer;
        }

        .ncsFavoriteButton:hover {
          background: rgba(212, 175, 55, 0.10);
          color: rgba(241, 210, 106, 0.70);
        }

        .ncsFavoriteButtonActive {
          color: #f1d26a;
          text-shadow: 0 0 10px rgba(212, 175, 55, 0.45);
        }

        .ncsCommandOverlay {
          position: fixed;
          z-index: 500;
          inset: 0;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 10vh 20px 20px;
          background: rgba(2, 11, 36, 0.54);
          backdrop-filter: blur(9px);
        }

        .ncsCommandPalette {
          width: min(680px, 100%);
          max-height: 72vh;
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.40);
          border-radius: 20px;
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(212, 175, 55, 0.15),
              transparent 30%
            ),
            linear-gradient(
              145deg,
              #03153f,
              #0a2e73
            );
          box-shadow: 0 35px 90px rgba(0, 0, 0, 0.38);
          color: #ffffff;
        }

        .ncsCommandHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 16px 18px 13px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.10);
        }

        .ncsCommandHeader > div {
          display: grid;
          gap: 3px;
        }

        .ncsCommandHeader span {
          color: #f1d26a;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .ncsCommandHeader strong {
          font-size: 17px;
        }

        .ncsCommandHeader button {
          width: 34px;
          height: 34px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
          font-size: 20px;
          cursor: pointer;
        }

        .ncsCommandSearchWrap {
          display: grid;
          grid-template-columns: 26px minmax(0, 1fr) auto;
          align-items: center;
          gap: 9px;
          margin: 14px;
          padding: 0 12px;
          border: 1px solid rgba(212, 175, 55, 0.30);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.08);
        }

        .ncsCommandSearchWrap > span {
          color: #f1d26a;
          font-size: 18px;
        }

        .ncsCommandSearchWrap input {
          width: 100%;
          height: 46px;
          border: 0;
          outline: 0;
          background: transparent;
          color: #ffffff;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
        }

        .ncsCommandSearchWrap input::placeholder {
          color: rgba(255, 255, 255, 0.44);
        }

        .ncsCommandSearchWrap kbd {
          padding: 4px 7px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.52);
          font-size: 7px;
          font-family: inherit;
          font-weight: 850;
        }

        .ncsCommandResults {
          max-height: 50vh;
          overflow-y: auto;
          display: grid;
          gap: 5px;
          padding: 0 14px 14px;
        }

        .ncsCommandResult {
          display: grid;
          grid-template-columns: 40px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          min-height: 54px;
          padding: 7px 10px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.045);
          color: #ffffff !important;
          text-decoration: none !important;
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            background 0.18s ease;
        }

        .ncsCommandResult:hover {
          transform: translateY(-1px);
          border-color: rgba(212, 175, 55, 0.36);
          background: rgba(212, 175, 55, 0.10);
        }

        .ncsCommandResultIcon {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(212, 175, 55, 0.24);
          border-radius: 10px;
          background: rgba(212, 175, 55, 0.08);
          font-size: 17px;
        }

        .ncsCommandResult > div {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .ncsCommandResult strong {
          overflow: hidden;
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsCommandResult small {
          overflow: hidden;
          color: rgba(255, 255, 255, 0.46);
          font-size: 7px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsCommandResultArrow {
          color: #f1d26a;
          font-size: 15px;
        }

        .ncsCommandEmpty {
          padding: 24px;
          color: rgba(255, 255, 255, 0.56);
          text-align: center;
          font-size: 11px;
        }

        .ncsSidebarBottom {
          display: grid;
          gap: 10px;
          margin-top: auto;
          padding-top: 22px;
        }

        .ncsAdminIdentity {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.07);
        }

        .ncsAdminAvatar {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, #d4af37, #f1d26a);
          color: #0a2e73;
          font-size: 15px;
          font-weight: 950;
        }

        .ncsAdminText {
          min-width: 0;
        }

        .ncsAdminText strong,
        .ncsAdminText span {
          display: block;
        }

        .ncsAdminText strong {
          color: #ffffff;
          font-size: 12px;
          font-weight: 850;
        }

        .ncsAdminText span {
          max-width: 182px;
          margin-top: 4px;
          overflow: hidden;
          color: rgba(255, 255, 255, 0.62);
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsViewStoreButton,
        .ncsLogoutButton {
          width: 100%;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 850;
          text-decoration: none !important;
          cursor: pointer;
        }

        .ncsViewStoreButton {
          border: 1px solid #d4af37;
          background: rgba(212, 175, 55, 0.12);
          color: #d4af37 !important;
        }

        .ncsLogoutButton {
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.07);
          color: #ffffff;
        }

        .ncsViewStoreButton:hover,
        .ncsLogoutButton:hover {
          transform: translateY(-1px);
          filter: brightness(1.08);
        }

        .ncsAdminContent {
          min-height: 100vh;
          margin-left: 292px;
        }

        .ncsSidebarCollapseButton {
          position: absolute;
          z-index: 5;
          top: 92px;
          right: -15px;
          width: 31px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #d4af37;
          border-radius: 0 11px 11px 0;
          background: linear-gradient(180deg, #d4af37, #f1d26a);
          color: #0a2e73;
          font-size: 25px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 5px 6px 16px rgba(3, 21, 63, 0.22);
          transition:
            transform 0.2s ease,
            filter 0.2s ease;
        }

        .ncsSidebarCollapseButton:hover {
          transform: translateX(2px);
          filter: brightness(1.04);
        }

        .ncsSidebar,
        .ncsAdminContent {
          transition:
            width 0.25s ease,
            margin-left 0.25s ease,
            padding 0.25s ease;
        }

        .ncsSidebarCollapsed {
          width: 86px;
          padding-left: 12px;
          padding-right: 12px;
          overflow: visible;
        }

        .ncsSidebarCollapsed .ncsBrandArea {
          justify-content: center;
          padding-left: 0;
          padding-right: 0;
        }

        .ncsSidebarCollapsed .ncsBrandLogo {
          width: 54px;
          height: 54px;
        }

        .ncsSidebarCollapsed .ncsBrandText,
        .ncsSidebarCollapsed .ncsMenuLabel,
        .ncsSidebarCollapsed .ncsAdminText,
        .ncsSidebarCollapsed .ncsViewStoreButton:not(:hover) {
          display: none;
        }

        .ncsSidebarCollapsed .ncsMenu {
          margin-top: 12px;
        }

        .ncsSidebarCollapsed .ncsMenuItem {
          min-height: 48px;
          justify-content: center;
          gap: 0;
          padding: 0;
        }

        .ncsSidebarCollapsed .ncsMenuIcon {
          width: 100%;
          font-size: 20px;
        }

        .ncsSidebarCollapsed .ncsSidebarBottom {
          gap: 8px;
        }

        .ncsSidebarCollapsed .ncsAdminIdentity {
          justify-content: center;
          padding: 8px;
        }

        .ncsSidebarCollapsed .ncsViewStoreButton,
        .ncsSidebarCollapsed .ncsLogoutButton {
          min-height: 44px;
          padding: 0;
          font-size: 0;
        }

        .ncsSidebarCollapsed .ncsViewStoreButton span,
        .ncsSidebarCollapsed .ncsLogoutButton span {
          font-size: 18px;
        }

        .ncsAdminShellCollapsed .ncsAdminContent {
          margin-left: 86px;
        }

        .ncsMobileMenuButton,
        .ncsMobileOverlay {
          display: none;
        }

        @media (max-width: 1100px) {
          .ncsSidebar {
            width: 270px;
          }

          .ncsAdminContent {
            margin-left: 270px;
          }

          .ncsMenuItem {
            font-size: 13px;
          }
        }

        @media (max-width: 900px) {
          .ncsOfflinePosBanner {
            position: fixed;
            right: 0;
            left: 0;
            top: 0;
            min-height: 82px;
            flex-direction: column;
            gap: 4px;
            padding: 10px 70px 10px 70px;
          }

          .ncsBusinessTicker {
            position: fixed;
            right: 0;
            left: 0;
            top: 0;
            grid-template-columns: 1fr;
            min-height: 84px;
          }

          .ncsTickerLiveBadge {
            min-width: 0;
            min-height: 30px;
            padding: 0 10px;
            border-right: 0;
            border-bottom: 1px solid rgba(212, 175, 55, 0.68);
            font-size: 8px;
          }

          .ncsTickerViewport {
            min-height: 54px;
            padding: 6px 8px;
          }

          .ncsChequeTickerCard {
            max-width: calc(100% - 14px);
            min-height: 39px;
            gap: 6px;
            padding: 6px 9px;
          }

          .ncsChequeTickerStatus {
            min-height: 22px;
            padding: 3px 7px;
            font-size: 7px;
          }

          .ncsChequeTickerSupplier,
          .ncsChequeTickerAmount {
            font-size: 9px;
          }

          .ncsChequeTickerBank,
          .ncsChequeTickerDate {
            font-size: 8px;
          }

          .ncsChequeTickerSeparator {
            display: none;
          }

          .ncsSidebarCollapseButton {
            display: none;
          }

          .ncsSidebar,
          .ncsSidebarCollapsed {
            width: min(86vw, 310px);
            transform: translateX(-105%);
            transition: transform 0.25s ease;
          }

          .ncsSidebarOpen {
            transform: translateX(0);
          }

          .ncsAdminContent,
          .ncsAdminShellCollapsed .ncsAdminContent {
            margin-left: 0;
            padding-top: 128px;
          }

          .ncsMobileMenuButton {
            position: fixed;
            z-index: 120;
            top: 12px;
            left: 12px;
            width: 47px;
            height: 47px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #d4af37;
            border-radius: 12px;
            background: #0a2e73;
            color: #d4af37;
            font-size: 23px;
            cursor: pointer;
            box-shadow: 0 8px 25px rgba(10, 46, 115, 0.3);
          }

          .ncsMobileOverlay {
            position: fixed;
            z-index: 90;
            inset: 0;
            display: block;
            border: 0;
            background: rgba(3, 21, 63, 0.62);
          }
        }
            `}</style>
    </div>
  );
}