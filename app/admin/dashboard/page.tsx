"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  session_id?: string | null;
  page_path?: string | null;
  page_title?: string | null;
  referrer?: string | null;
  device_type?: string | null;
  browser?: string | null;
  visited_at?: string | null;
};

type DashboardStats = {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  pendingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  lowStockProducts: number;
};

type VisitorStats = {
  todayVisitors: number;
  sevenDayVisitors: number;
  thirtyDayVisitors: number;
  totalUniqueVisitors: number;
  totalPageViews: number;
};

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

function getOrderTotal(order: Order) {
  const value = Number(order.total_amount || 0);
  return Number.isFinite(value) ? value : 0;
}

function getStock(product: Product) {
  const value = Number(product.stock || 0);
  return Number.isFinite(value) ? value : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function parseOrderItems(order: Order): OrderItem[] {
  if (!order.items) return [];

  if (Array.isArray(order.items)) {
    return order.items;
  }

  if (typeof order.items === "string") {
    try {
      const parsed = JSON.parse(order.items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function getStartOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDateDaysAgo(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

function getUniqueVisitorCount(
  visits: WebsiteVisit[],
  startDate?: Date
) {
  const visitorIds = visits
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
      (visitorId): visitorId is string =>
        typeof visitorId === "string" &&
        visitorId.trim().length > 0
    );

  return new Set(visitorIds).size;
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [visits, setVisits] = useState<WebsiteVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [visitorError, setVisitorError] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

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
        ordersResult,
        visitsResult,
      ] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("website_visits")
          .select("*")
          .order("visited_at", { ascending: false })
          .limit(10000),
      ]);

      if (productsResult.error) {
        throw productsResult.error;
      }

      if (ordersResult.error) {
        throw ordersResult.error;
      }

      setProducts((productsResult.data as Product[]) || []);
      setOrders((ordersResult.data as Order[]) || []);

      if (visitsResult.error) {
        console.error(
          "Website visitors load error:",
          visitsResult.error
        );

        setVisitorError(
          "Visitor information could not be loaded. Check website_visits table policies."
        );

        setVisits([]);
      } else {
        setVisits(
          (visitsResult.data as WebsiteVisit[]) || []
        );
      }
    } catch (error) {
      console.error("Admin dashboard load error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut({
        scope: "local",
      });

      localStorage.clear();
      sessionStorage.clear();

      window.location.replace("/admin/login");
    } catch (error) {
      console.error("Admin logout error:", error);
      alert("Unable to logout. Please try again.");
    }
  }

  const stats = useMemo<DashboardStats>(() => {
    const activeRevenue = orders
      .filter(
        (order) =>
          getOrderStatus(order).toLowerCase() !==
          "cancelled"
      )
      .reduce(
        (sum, order) => sum + getOrderTotal(order),
        0
      );

    const uniqueCustomers = new Set(
      orders
        .map(
          (order) =>
            order.email ||
            order.phone ||
            order.customer_name
        )
        .filter(Boolean)
        .map(String)
    );

    return {
      totalProducts: products.length,
      totalOrders: orders.length,
      totalCustomers: uniqueCustomers.size,
      totalRevenue: activeRevenue,
      pendingOrders: orders.filter(
        (order) =>
          getOrderStatus(order).toLowerCase() ===
          "pending"
      ).length,
      deliveredOrders: orders.filter(
        (order) =>
          getOrderStatus(order).toLowerCase() ===
          "delivered"
      ).length,
      cancelledOrders: orders.filter(
        (order) =>
          getOrderStatus(order).toLowerCase() ===
          "cancelled"
      ).length,
      lowStockProducts: products.filter((product) => {
        const stock = getStock(product);
        return stock >= 0 && stock <= 5;
      }).length,
    };
  }, [orders, products]);

  const visitorStats = useMemo<VisitorStats>(() => {
    const todayStart = getStartOfToday();
    const sevenDaysStart = getDateDaysAgo(6);
    const thirtyDaysStart = getDateDaysAgo(29);

    return {
      todayVisitors: getUniqueVisitorCount(
        visits,
        todayStart
      ),
      sevenDayVisitors: getUniqueVisitorCount(
        visits,
        sevenDaysStart
      ),
      thirtyDayVisitors: getUniqueVisitorCount(
        visits,
        thirtyDaysStart
      ),
      totalUniqueVisitors:
        getUniqueVisitorCount(visits),
      totalPageViews: visits.length,
    };
  }, [visits]);

  const recentOrders = useMemo(() => {
    return orders.slice(0, 6);
  }, [orders]);

  const lowStockProducts = useMemo(() => {
    return products
      .filter((product) => {
        const stock = getStock(product);
        return stock >= 0 && stock <= 5;
      })
      .sort(
        (firstProduct, secondProduct) =>
          getStock(firstProduct) -
          getStock(secondProduct)
      )
      .slice(0, 6);
  }, [products]);

  const popularPages = useMemo(() => {
    const pageCounts = new Map<string, number>();

    visits.forEach((visit) => {
      const pagePath =
        visit.page_path?.trim() || "/";

      pageCounts.set(
        pagePath,
        (pageCounts.get(pagePath) || 0) + 1
      );
    });

    return Array.from(pageCounts.entries())
      .map(([pagePath, count]) => ({
        pagePath,
        count,
      }))
      .sort(
        (firstPage, secondPage) =>
          secondPage.count - firstPage.count
      )
      .slice(0, 5);
  }, [visits]);

  if (loading) {
    return (
      <main className="loadingPage">
        <div className="loadingLogo">NCS</div>
        <div className="loader" />
        <h2>Loading Admin Dashboard...</h2>
        <p>
          Loading orders, products and website visitors.
        </p>

        <style jsx>{`
          .loadingPage {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #f8f4ec;
            color: #0a2e73;
            font-family: Inter, Poppins, Arial, sans-serif;
            text-align: center;
          }

          .loadingLogo {
            width: 76px;
            height: 76px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #d4af37;
            border-radius: 22px;
            background: #0a2e73;
            color: #d4af37;
            font-size: 22px;
            font-weight: 950;
          }

          .loader {
            width: 45px;
            height: 45px;
            margin-top: 24px;
            border: 4px solid #e4e7ec;
            border-top-color: #0a2e73;
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
        `}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <section className="topbar">
          <div>
            <p className="eyebrow">NEW CITY STYLE</p>
            <h1>Admin Dashboard</h1>
            <p className="welcomeText">
              Welcome back
              {adminEmail ? `, ${adminEmail}` : ""}.
            </p>
          </div>

          <div className="topActions">
            <button
              type="button"
              className="refreshButton"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>

            <Link href="/" className="storeButton">
              View Store
            </Link>

            <button
              type="button"
              className="logoutButton"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </section>

        {errorMessage && (
          <div className="errorBox">
            <strong>!</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        {visitorError && (
          <div className="warningBox">
            <strong>!</strong>
            <span>{visitorError}</span>
          </div>
        )}

        <section className="visitorSection">
          <div className="sectionHeading">
            <div>
              <p>WEBSITE ANALYTICS</p>
              <h2>Customer Visitors</h2>
            </div>

            <span className="liveBadge">
              ● Live Tracking
            </span>
          </div>

          <div className="visitorGrid">
            <VisitorCard
              icon="☀️"
              label="Today Visitors"
              value={visitorStats.todayVisitors}
              note="Unique visitors today"
            />

            <VisitorCard
              icon="📅"
              label="Last 7 Days"
              value={visitorStats.sevenDayVisitors}
              note="Unique visitors in 7 days"
            />

            <VisitorCard
              icon="🗓️"
              label="Last 30 Days"
              value={visitorStats.thirtyDayVisitors}
              note="Unique visitors in 30 days"
            />

            <VisitorCard
              icon="👤"
              label="Total Visitors"
              value={visitorStats.totalUniqueVisitors}
              note="All unique visitors"
            />

            <VisitorCard
              icon="👁️"
              label="Page Views"
              value={visitorStats.totalPageViews}
              note="Total pages opened"
            />
          </div>
        </section>

        <section className="statsGrid">
          <StatCard
            icon="🛍️"
            label="Total Products"
            value={stats.totalProducts}
            note="Products in catalogue"
          />

          <StatCard
            icon="📦"
            label="Total Orders"
            value={stats.totalOrders}
            note={`${stats.pendingOrders} pending orders`}
          />

          <StatCard
            icon="👥"
            label="Customers"
            value={stats.totalCustomers}
            note="Unique customer records"
          />

          <StatCard
            icon="💰"
            label="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            note="Excluding cancelled orders"
          />

          <StatCard
            icon="✅"
            label="Delivered"
            value={stats.deliveredOrders}
            note="Completed deliveries"
          />

          <StatCard
            icon="❌"
            label="Cancelled"
            value={stats.cancelledOrders}
            note="Cancelled orders"
          />

          <StatCard
            icon="⚠️"
            label="Low Stock"
            value={stats.lowStockProducts}
            note="Products with 5 or fewer"
          />

          <StatCard
            icon="⏳"
            label="Pending"
            value={stats.pendingOrders}
            note="Orders awaiting action"
          />
        </section>

        <section className="quickActions">
          <div className="sectionHeading">
            <div>
              <p>ADMIN SHORTCUTS</p>
              <h2>Quick Actions</h2>
            </div>
          </div>

          <div className="actionGrid">
            <QuickAction
              href="/admin/add-product"
              icon="＋"
              title="Add Product"
              description="Create a new product listing"
            />

            <QuickAction
              href="/admin/products"
              icon="🛍️"
              title="Manage Products"
              description="Edit products, prices and stock"
            />

            <QuickAction
              href="/admin/orders"
              icon="📦"
              title="Manage Orders"
              description="Update order and delivery status"
            />

            <QuickAction
              href="/admin/categories"
              icon="🏷️"
              title="Categories"
              description="Manage shopping categories"
            />

            <QuickAction
              href="/admin/seo"
              icon="🔍"
              title="SEO Settings"
              description="Manage search engine information"
            />

            <QuickAction
              href="/admin/analytics"
              icon="📊"
              title="Analytics"
              description="Manage tracking integrations"
            />
          </div>
        </section>

        <section className="contentGrid">
          <div className="panel">
            <div className="panelHeader">
              <div>
                <p>ORDER ACTIVITY</p>
                <h2>Recent Orders</h2>
              </div>

              <Link href="/admin/orders">View All</Link>
            </div>

            {recentOrders.length === 0 ? (
              <EmptyState
                icon="📦"
                title="No Orders Yet"
                text="New customer orders will appear here."
              />
            ) : (
              <div className="orderList">
                {recentOrders.map((order) => {
                  const status = getOrderStatus(order);
                  const items = parseOrderItems(order);

                  return (
                    <article
                      className="orderRow"
                      key={String(order.id)}
                    >
                      <div className="orderIdentity">
                        <div className="orderIcon">#</div>

                        <div>
                          <strong>
                            Order #{order.id}
                          </strong>
                          <span>
                            {formatDate(order.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="customerInfo">
                        <strong>
                          {order.customer_name ||
                            "Customer"}
                        </strong>

                        <span>
                          {items.length} item
                          {items.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="orderTotal">
                        {formatCurrency(
                          getOrderTotal(order)
                        )}
                      </div>

                      <span
                        className={`statusBadge ${status
                          .toLowerCase()
                          .replaceAll(" ", "-")}`}
                      >
                        {status}
                      </span>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panelHeader">
              <div>
                <p>INVENTORY ALERTS</p>
                <h2>Low Stock Products</h2>
              </div>

              <Link href="/admin/products">
                Manage
              </Link>
            </div>

            {lowStockProducts.length === 0 ? (
              <EmptyState
                icon="✅"
                title="Stock Looks Good"
                text="No low-stock products found."
              />
            ) : (
              <div className="stockList">
                {lowStockProducts.map((product) => {
                  const stock = getStock(product);

                  return (
                    <article
                      className="stockRow"
                      key={String(product.id)}
                    >
                      <div className="stockIcon">🛍️</div>

                      <div className="stockInfo">
                        <strong>
                          {getProductName(product)}
                        </strong>

                        <span>
                          {product.category ||
                            "Fashion Product"}
                        </span>
                      </div>

                      <div
                        className={
                          stock === 0
                            ? "stockCount out"
                            : "stockCount low"
                        }
                      >
                        {stock === 0
                          ? "Out"
                          : `${stock} left`}
                      </div>

                      <Link
                        href={`/admin/products/edit/${product.id}`}
                      >
                        Edit
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="panel popularPanel">
            <div className="panelHeader">
              <div>
                <p>VISITOR ACTIVITY</p>
                <h2>Popular Pages</h2>
              </div>

              <span>
                {visitorStats.totalPageViews} views
              </span>
            </div>

            {popularPages.length === 0 ? (
              <EmptyState
                icon="👁️"
                title="No Visitor Data Yet"
                text="Open the customer website to start tracking visits."
              />
            ) : (
              <div className="popularList">
                {popularPages.map((page, index) => (
                  <article
                    className="popularRow"
                    key={page.pagePath}
                  >
                    <div className="popularNumber">
                      {index + 1}
                    </div>

                    <div className="popularInfo">
                      <strong>{page.pagePath}</strong>
                      <span>
                        Customer website page
                      </span>
                    </div>

                    <div className="popularCount">
                      {page.count} views
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          background: #f8f4ec;
          color: #172033;
          font-family: Inter, Poppins, Arial, sans-serif;
        }

        button {
          font: inherit;
        }

        .page {
          min-height: 100vh;
          padding: 34px 20px 70px;
          background:
            radial-gradient(
              circle at top right,
              rgba(212, 175, 55, 0.12),
              transparent 28%
            ),
            linear-gradient(180deg, #f8f4ec, #ffffff);
        }

        .container {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 28px;
          border-radius: 22px;
          background: linear-gradient(135deg, #0a2e73, #164ca8);
          color: #ffffff;
          box-shadow: 0 18px 45px rgba(10, 46, 115, 0.22);
        }

        .eyebrow {
          margin: 0 0 7px;
          color: #d4af37;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .topbar h1 {
          margin: 0;
          font-size: clamp(32px, 4vw, 48px);
          line-height: 1.05;
        }

        .welcomeText {
          margin: 10px 0 0;
          color: rgba(255, 255, 255, 0.74);
          font-size: 13px;
        }

        .topActions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .topActions button,
        .topActions :global(a) {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 16px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 850;
          text-decoration: none;
          cursor: pointer;
        }

        .refreshButton {
          border: 1px solid rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }

        .refreshButton:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .storeButton {
          border: 1px solid #d4af37;
          background: #d4af37;
          color: #0a2e73;
        }

        .logoutButton {
          border: 1px solid rgba(255, 255, 255, 0.35);
          background: transparent;
          color: #ffffff;
        }

        .errorBox,
        .warningBox {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 750;
        }

        .errorBox {
          border: 1px solid #fecdca;
          background: #fef3f2;
          color: #b42318;
        }

        .warningBox {
          border: 1px solid #fedf89;
          background: #fffaeb;
          color: #93370d;
        }

        .errorBox strong,
        .warningBox strong {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 50%;
          color: #ffffff;
        }

        .errorBox strong {
          background: #b42318;
        }

        .warningBox strong {
          background: #f79009;
        }

        .visitorSection,
        .quickActions,
        .panel {
          margin-top: 24px;
          border: 1px solid #e4e7ec;
          border-radius: 20px;
          background: #ffffff;
          box-shadow: 0 10px 30px rgba(16, 24, 40, 0.07);
        }

        .visitorSection,
        .quickActions {
          padding: 24px;
        }

        .sectionHeading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .sectionHeading p,
        .panelHeader p {
          margin: 0 0 5px;
          color: #d4af37;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.3px;
        }

        .sectionHeading h2,
        .panelHeader h2 {
          margin: 0;
          color: #0a2e73;
          font-size: 24px;
        }

        .liveBadge {
          padding: 8px 12px;
          border: 1px solid #abefc6;
          border-radius: 999px;
          background: #ecfdf3;
          color: #067647;
          font-size: 11px;
          font-weight: 850;
        }

        .visitorGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-top: 20px;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
          margin-top: 24px;
        }

        .actionGrid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-top: 20px;
        }

        .contentGrid {
          display: grid;
          grid-template-columns:
            minmax(0, 1.35fr)
            minmax(0, 1fr);
          gap: 24px;
        }

        .panel {
          overflow: hidden;
        }

        .popularPanel {
          grid-column: 1 / -1;
        }

        .panelHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 21px 22px;
          border-bottom: 1px solid #eaecf0;
        }

        .panelHeader :global(a),
        .panelHeader > span {
          color: #0a2e73;
          font-size: 12px;
          font-weight: 850;
          text-decoration: none;
        }

        .orderList,
        .stockList,
        .popularList {
          padding: 5px 22px;
        }

        .orderRow {
          display: grid;
          grid-template-columns:
            minmax(170px, 1.4fr)
            minmax(130px, 1fr)
            auto
            auto;
          align-items: center;
          gap: 15px;
          min-height: 82px;
          padding: 14px 0;
          border-bottom: 1px solid #f0f1f3;
        }

        .orderRow:last-child,
        .stockRow:last-child,
        .popularRow:last-child {
          border-bottom: 0;
        }

        .orderIdentity {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .orderIcon,
        .stockIcon,
        .popularNumber {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 12px;
          background: #eef4ff;
          color: #0a2e73;
          font-weight: 950;
        }

        .orderIdentity strong,
        .orderIdentity span,
        .customerInfo strong,
        .customerInfo span,
        .stockInfo strong,
        .stockInfo span,
        .popularInfo strong,
        .popularInfo span {
          display: block;
        }

        .orderIdentity strong,
        .customerInfo strong,
        .stockInfo strong,
        .popularInfo strong {
          overflow: hidden;
          color: #172033;
          font-size: 13px;
          font-weight: 850;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .orderIdentity span,
        .customerInfo span,
        .stockInfo span,
        .popularInfo span {
          margin-top: 5px;
          color: #667085;
          font-size: 11px;
        }

        .orderTotal {
          color: #0a2e73;
          font-size: 13px;
          font-weight: 900;
          white-space: nowrap;
        }

        .statusBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 82px;
          padding: 7px 10px;
          border-radius: 999px;
          background: #fffaeb;
          color: #b54708;
          font-size: 10px;
          font-weight: 850;
          text-transform: capitalize;
        }

        .statusBadge.delivered,
        .statusBadge.completed {
          background: #ecfdf3;
          color: #067647;
        }

        .statusBadge.cancelled {
          background: #fef3f2;
          color: #b42318;
        }

        .statusBadge.shipped,
        .statusBadge.confirmed,
        .statusBadge.paid {
          background: #eff8ff;
          color: #175cd3;
        }

        .stockRow,
        .popularRow {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 72px;
          padding: 13px 0;
          border-bottom: 1px solid #f0f1f3;
        }

        .stockInfo,
        .popularInfo {
          min-width: 0;
          flex: 1;
        }

        .stockCount,
        .popularCount {
          flex-shrink: 0;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 850;
          white-space: nowrap;
        }

        .stockCount.low {
          background: #fffaeb;
          color: #b54708;
        }

        .stockCount.out {
          background: #fef3f2;
          color: #b42318;
        }

        .popularCount {
          background: #eef4ff;
          color: #0a2e73;
        }

        .stockRow :global(a) {
          flex-shrink: 0;
          color: #0a2e73;
          font-size: 11px;
          font-weight: 850;
          text-decoration: none;
        }

        @keyframes dashboardStatRise {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes dashboardStatShine {
          0%,
          62% {
            left: -42%;
            opacity: 0;
          }
          68% {
            opacity: 0.7;
          }
          100% {
            left: 126%;
            opacity: 0;
          }
        }

        @media (max-width: 1250px) {
          .visitorGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .actionGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 1050px) {
          .statsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .contentGrid {
            grid-template-columns: 1fr;
          }

          .popularPanel {
            grid-column: auto;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 20px 12px 50px;
          }

          .topbar {
            align-items: flex-start;
            flex-direction: column;
            padding: 22px;
          }

          .topActions {
            width: 100%;
          }

          .topActions button,
          .topActions :global(a) {
            flex: 1;
          }

          .visitorGrid,
          .statsGrid,
          .actionGrid {
            grid-template-columns: 1fr;
          }

          .visitorSection,
          .quickActions {
            padding: 18px;
          }

          .sectionHeading {
            align-items: flex-start;
            flex-direction: column;
          }

          .orderRow {
            grid-template-columns: 1fr auto;
          }

          .customerInfo {
            display: none;
          }

          .orderTotal {
            grid-column: 1;
            padding-left: 54px;
          }

          .statusBadge {
            grid-column: 2;
            grid-row: 1 / span 2;
          }
        }

        @media (max-width: 430px) {
          .topActions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .orderList,
          .stockList,
          .popularList {
            padding: 5px 15px;
          }

          .stockRow {
            flex-wrap: wrap;
          }

          .stockInfo {
            flex-basis: calc(100% - 56px);
          }
        }
      `}</style>
    </main>
  );
}

type StatCardProps = {
  icon: string;
  label: string;
  value: number | string;
  note: string;
};

function StatCard({
  icon,
  label,
  value,
  note,
}: StatCardProps) {
  return (
    <article className="statCard">
      <div className="statTop">
        <div className="statIcon">{icon}</div>
        <span>Overview</span>
      </div>

      <p>{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>

      <style jsx>{`
        .statCard {
          position: relative;
          isolation: isolate;
          min-height: 168px;
          overflow: hidden;
          padding: 20px;
          border: 1px solid rgba(212, 175, 55, 0.22);
          border-radius: 18px;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.99),
            rgba(3, 21, 63, 0.98)
          );
          box-shadow:
            0 12px 28px rgba(3, 21, 63, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          transition:
            transform 0.22s ease,
            box-shadow 0.22s ease,
            border-color 0.22s ease;
          animation: dashboardStatRise 0.45s ease both;
        }

        .statCard::before {
          content: "";
          position: absolute;
          z-index: -1;
          top: -40%;
          right: -15%;
          width: 130px;
          height: 130px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(212, 175, 55, 0.34),
            rgba(212, 175, 55, 0)
          );
        }

        .statCard::after {
          content: "";
          position: absolute;
          top: -145%;
          left: -36%;
          width: 42%;
          height: 370%;
          transform: rotate(22deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.14),
            transparent
          );
          animation: dashboardStatShine 5.2s ease-in-out infinite;
          pointer-events: none;
        }

        .statCard:hover {
          transform: translateY(-2px) scale(1.004);
          border-color: rgba(212, 175, 55, 0.42);
          box-shadow:
            0 16px 32px rgba(3, 21, 63, 0.22),
            0 0 0 1px rgba(212, 175, 55, 0.1);
        }

        .statTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .statIcon {
          width: 43px;
          height: 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          border: 1px solid rgba(212, 175, 55, 0.3);
          background: rgba(255, 255, 255, 0.1);
          color: #d4af37;
          font-size: 20px;
        }

        .statTop span {
          color: rgba(212, 175, 55, 0.9);
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }

        p {
          margin: 17px 0 5px;
          color: rgba(212, 175, 55, 0.94);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }

        strong {
          display: block;
          overflow: hidden;
          color: #ffffff;
          font-size: clamp(24px, 3vw, 32px);
          font-weight: 950;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        small {
          display: block;
          margin-top: 8px;
          color: rgba(255, 255, 255, 0.66);
          font-size: 10px;
        }
      `}</style>
    </article>
  );
}

type VisitorCardProps = {
  icon: string;
  label: string;
  value: number;
  note: string;
};

function VisitorCard({
  icon,
  label,
  value,
  note,
}: VisitorCardProps) {
  return (
    <article className="visitorCard">
      <div className="visitorIcon">{icon}</div>

      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>

      <style jsx>{`
        .visitorCard {
          position: relative;
          overflow: hidden;
          min-height: 135px;
          display: flex;
          align-items: flex-start;
          gap: 13px;
          padding: 18px;
          border: 1px solid rgba(212, 175, 55, 0.18);
          border-radius: 16px;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.98),
            rgba(3, 21, 63, 0.96)
          );
          box-shadow: 0 10px 24px rgba(3, 21, 63, 0.12);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            border-color 0.2s ease;
        }

        .visitorCard:hover {
          transform: translateY(-2px);
          border-color: rgba(212, 175, 55, 0.4);
          box-shadow: 0 14px 28px rgba(3, 21, 63, 0.18);
        }

        .visitorIcon {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 13px;
          border: 1px solid rgba(212, 175, 55, 0.3);
          background: rgba(255, 255, 255, 0.08);
          color: #d4af37;
          font-size: 19px;
        }

        p {
          margin: 1px 0 4px;
          color: rgba(212, 175, 55, 0.94);
          font-size: 11px;
          font-weight: 800;
        }

        strong {
          display: block;
          color: #ffffff;
          font-size: 29px;
          font-weight: 950;
          line-height: 1.15;
        }

        span {
          display: block;
          margin-top: 7px;
          color: rgba(255, 255, 255, 0.66);
          font-size: 9px;
          line-height: 1.4;
        }
      `}</style>
    </article>
  );
}

type QuickActionProps = {
  href: string;
  icon: string;
  title: string;
  description: string;
};

function QuickAction({
  href,
  icon,
  title,
  description,
}: QuickActionProps) {
  return (
    <Link href={href} className="actionCard">
      <div className="actionIcon">{icon}</div>
      <strong>{title}</strong>
      <span>{description}</span>

      <style jsx>{`
        :global(.actionCard) {
          min-height: 145px;
          display: flex;
          flex-direction: column;
          padding: 18px;
          border: 1px solid rgba(212, 175, 55, 0.18);
          border-radius: 15px;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.98),
            rgba(3, 21, 63, 0.96)
          );
          color: inherit;
          text-decoration: none;
          box-shadow: 0 10px 24px rgba(3, 21, 63, 0.11);
          transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        :global(.actionCard:hover) {
          transform: translateY(-3px);
          border-color: rgba(212, 175, 55, 0.52);
          box-shadow: 0 16px 32px rgba(3, 21, 63, 0.2);
        }

        .actionIcon {
          width: 41px;
          height: 41px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          border: 1px solid rgba(212, 175, 55, 0.28);\n          background: rgba(255, 255, 255, 0.08);
          color: #d4af37;
          font-size: 18px;
          font-weight: 950;
        }

        strong {
          margin-top: 15px;
          color: #ffffff;
          font-size: 13px;
          font-weight: 900;
        }

        span {
          margin-top: 7px;
          color: rgba(255, 255, 255, 0.66);
          font-size: 10px;
          line-height: 1.5;
        }
      `}</style>
    </Link>
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
          min-height: 230px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          text-align: center;
        }

        .emptyState div {
          width: 58px;
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 17px;
          background: #eef4ff;
          font-size: 25px;
        }

        strong {
          margin-top: 15px;
          color: #0a2e73;
          font-size: 16px;
        }

        p {
          max-width: 280px;
          margin: 8px 0 0;
          color: #667085;
          font-size: 12px;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}