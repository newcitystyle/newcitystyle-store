"use client";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Product = {
  id: number;
  name?: string | null;
  price?: number | null;
  stock?: number | null;
  image?: string | null;
  created_at?: string | null;
};

type Order = {
  id: number;
  name?: string | null;
  image?: string | null;
  price?: number | null;
  quantity?: number | null;
  total?: number | null;
  status?: string | null;
  payment_method?: string | null;
  customer_name?: string | null;
  created_at?: string | null;
};

type Customer = {
  id: number;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  total_orders?: number | null;
  total_spent?: number | null;
  is_blocked?: boolean | null;
  created_at?: string | null;
};

type Review = {
  id: number;
  customer_name?: string | null;
  product_name?: string | null;
  rating?: number | null;
  is_approved?: boolean | null;
  created_at?: string | null;
};

type ReturnRequest = {
  id: number;
  product_name?: string | null;
  customer_name?: string | null;
  refund_amount?: number | null;
  status?: string | null;
  created_at?: string | null;
};

type Coupon = {
  id: number;
  code?: string | null;
  title?: string | null;
  is_active?: boolean | null;
  used_count?: number | null;
  end_date?: string | null;
};

type MonthlySale = {
  key: string;
  label: string;
  revenue: number;
  orders: number;
};

type DashboardData = {
  products: Product[];
  orders: Order[];
  customers: Customer[];
  reviews: Review[];
  returns: ReturnRequest[];
  coupons: Coupon[];
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

const emptyDashboardData: DashboardData = {
  products: [],
  orders: [],
  customers: [],
  reviews: [],
  returns: [],
  coupons: [],
};

export default function AdminPage() {
  const [dashboardData, setDashboardData] =
    useState<DashboardData>(emptyDashboardData);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [googleBusiness, setGoogleBusiness] = useState<GoogleBusinessStatus>({
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

  useEffect(() => {
    void loadDashboard();
    void loadGoogleBusinessStatus();
  }, []);

  async function loadGoogleBusinessStatus(showRefreshing = false) {
    setGoogleBusiness((current) => ({
      ...current,
      loading: showRefreshing ? current.loading : true,
      refreshing: showRefreshing,
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
        error:
          typeof data?.error === "string" ? data.error : null,
        accountCount:
          typeof data?.accountCount === "number"
            ? data.accountCount
            : 0,
        rating:
          typeof data?.rating === "number" ? data.rating : null,
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
  }

  async function loadDashboard(showRefreshing = false) {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [
        productsResult,
        ordersResult,
        customersResult,
        reviewsResult,
        returnsResult,
        couponsResult,
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
          .from("customers")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("reviews")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("returns")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("coupons")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      const errors = [
        productsResult.error,
        ordersResult.error,
        customersResult.error,
        reviewsResult.error,
        returnsResult.error,
        couponsResult.error,
      ].filter(Boolean);

      if (errors.length > 0) {
        console.error("Dashboard loading errors:", errors);
      }

      setDashboardData({
        products: (productsResult.data as Product[]) || [],
        orders: (ordersResult.data as Order[]) || [],
        customers: (customersResult.data as Customer[]) || [],
        reviews: (reviewsResult.data as Review[]) || [],
        returns: (returnsResult.data as ReturnRequest[]) || [],
        coupons: (couponsResult.data as Coupon[]) || [],
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Unable to load dashboard:", error);
      alert("Unable to load dashboard information.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function getOrderValue(order: Order) {
    const savedTotal = Number(order.total || 0);

    if (savedTotal > 0) {
      return savedTotal;
    }

    return (
      Number(order.price || 0) *
      Math.max(Number(order.quantity || 1), 1)
    );
  }

  function normalizeStatus(status?: string | null) {
    return (status || "Pending").trim().toLowerCase();
  }

  const totalRevenue = useMemo(() => {
    return dashboardData.orders
      .filter(
        (order) =>
          normalizeStatus(order.status) !== "cancelled"
      )
      .reduce(
        (sum, order) => sum + getOrderValue(order),
        0
      );
  }, [dashboardData.orders]);

  const deliveredRevenue = useMemo(() => {
    return dashboardData.orders
      .filter(
        (order) =>
          normalizeStatus(order.status) === "delivered"
      )
      .reduce(
        (sum, order) => sum + getOrderValue(order),
        0
      );
  }, [dashboardData.orders]);

  const pendingOrders = dashboardData.orders.filter(
    (order) =>
      normalizeStatus(order.status) === "pending"
  ).length;

  const processingOrders = dashboardData.orders.filter(
    (order) =>
      normalizeStatus(order.status) === "processing"
  ).length;

  const shippedOrders = dashboardData.orders.filter(
    (order) =>
      normalizeStatus(order.status) === "shipped"
  ).length;

  const deliveredOrders = dashboardData.orders.filter(
    (order) =>
      normalizeStatus(order.status) === "delivered"
  ).length;

  const cancelledOrders = dashboardData.orders.filter(
    (order) =>
      normalizeStatus(order.status) === "cancelled"
  ).length;

  const lowStockProducts = dashboardData.products.filter(
    (product) =>
      Number(product.stock || 0) > 0 &&
      Number(product.stock || 0) <= 5
  );

  const outOfStockProducts = dashboardData.products.filter(
    (product) => Number(product.stock || 0) <= 0
  );

  const totalInventory = dashboardData.products.reduce(
    (sum, product) =>
      sum + Math.max(Number(product.stock || 0), 0),
    0
  );

  const approvedReviews = dashboardData.reviews.filter(
    (review) => review.is_approved
  ).length;

  const pendingReviews =
    dashboardData.reviews.length - approvedReviews;

  const averageRating =
    dashboardData.reviews.length === 0
      ? 0
      : dashboardData.reviews.reduce(
          (sum, review) =>
            sum + Number(review.rating || 0),
          0
        ) / dashboardData.reviews.length;

  const pendingReturns = dashboardData.returns.filter(
    (item) =>
      normalizeStatus(item.status) === "requested"
  ).length;

  const completedReturns = dashboardData.returns.filter(
    (item) =>
      normalizeStatus(item.status) ===
      "refund completed"
  ).length;

  const totalRefundAmount =
    dashboardData.returns.reduce(
      (sum, item) =>
        sum + Number(item.refund_amount || 0),
      0
    );

  const activeCoupons = dashboardData.coupons.filter(
    (coupon) => {
      if (!coupon.is_active) return false;

      if (
        coupon.end_date &&
        new Date(coupon.end_date) < new Date()
      ) {
        return false;
      }

      return true;
    }
  ).length;

  const blockedCustomers = dashboardData.customers.filter(
    (customer) => customer.is_blocked
  ).length;

  const highValueCustomers =
    dashboardData.customers.filter(
      (customer) =>
        Number(customer.total_spent || 0) >= 10000
    ).length;

  const averageOrderValue =
    dashboardData.orders.length === 0
      ? 0
      : totalRevenue / dashboardData.orders.length;

  const monthlySales = useMemo<MonthlySale[]>(() => {
    const months: MonthlySale[] = [];
    const now = new Date();

    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - index,
        1
      );

      const key = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      months.push({
        key,
        label: date.toLocaleDateString("en-IN", {
          month: "short",
        }),
        revenue: 0,
        orders: 0,
      });
    }

    dashboardData.orders.forEach((order) => {
      if (!order.created_at) return;

      const orderDate = new Date(order.created_at);

      if (Number.isNaN(orderDate.getTime())) return;

      const key = `${orderDate.getFullYear()}-${String(
        orderDate.getMonth() + 1
      ).padStart(2, "0")}`;

      const month = months.find(
        (item) => item.key === key
      );

      if (!month) return;

      if (
        normalizeStatus(order.status) !== "cancelled"
      ) {
        month.revenue += getOrderValue(order);
      }

      month.orders += 1;
    });

    return months;
  }, [dashboardData.orders]);

  const maximumMonthlyRevenue = Math.max(
    ...monthlySales.map((month) => month.revenue),
    1
  );

  const productSales = useMemo(() => {
    const salesMap = new Map<
      string,
      {
        name: string;
        image: string;
        quantity: number;
        revenue: number;
      }
    >();

    dashboardData.orders.forEach((order) => {
      const name = order.name?.trim() || "Unknown Product";
      const current = salesMap.get(name);

      const quantity = Math.max(
        Number(order.quantity || 1),
        1
      );

      const revenue = getOrderValue(order);

      if (current) {
        current.quantity += quantity;
        current.revenue += revenue;
      } else {
        salesMap.set(name, {
          name,
          image: order.image || "",
          quantity,
          revenue,
        });
      }
    });

    return Array.from(salesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [dashboardData.orders]);

  const recentOrders = dashboardData.orders.slice(0, 6);

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#F8F4EC",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "30px",
        }}
      >
        <div
          style={{
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "58px",
              height: "58px",
              margin: "0 auto 18px",
              borderRadius: "50%",
              border: "6px solid #E5E7EB",
              borderTopColor: "#0A2E73",
              animation: "dashboard-spin 0.8s linear infinite",
            }}
          />

          <h2
            style={{
              color: "#0A2E73",
              margin: 0,
            }}
          >
            Loading Dashboard...
          </h2>
        </div>

        <style jsx global>{`
          @keyframes dashboard-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F8F4EC",
        padding: "30px 20px 80px",
      }}
    >
      <div
        style={{
          maxWidth: "1500px",
          margin: "0 auto",
        }}
      >
        <section
          style={{
            background:
              "linear-gradient(135deg, #071A43 0%, #0A2E73 55%, #164CA8 100%)",
            borderRadius: "24px",
            padding: "32px",
            color: "#FFFFFF",
            marginBottom: "25px",
            boxShadow:
              "0 15px 40px rgba(10,46,115,0.25)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: "260px",
              height: "260px",
              borderRadius: "50%",
              background:
                "rgba(212,175,55,0.12)",
              right: "-60px",
              top: "-100px",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "20px",
            }}
          >
            <div>
              <p
                style={{
                  color: "#D4AF37",
                  fontWeight: 800,
                  letterSpacing: "1.4px",
                  margin: "0 0 8px",
                }}
              >
                NEW CITY STYLE
              </p>

              <h1
                style={{
                  margin: 0,
                  fontSize: "38px",
                }}
              >
                Live Analytics Dashboard
              </h1>

              <p
                style={{
                  margin: "11px 0 0",
                  opacity: 0.9,
                  lineHeight: 1.6,
                }}
              >
                Monitor sales, customers, inventory and store
                performance.
              </p>

              {lastUpdated && (
                <p
                  style={{
                    margin: "8px 0 0",
                    color: "rgba(255,255,255,0.68)",
                    fontSize: "13px",
                  }}
                >
                  Last updated:{" "}
                  {lastUpdated.toLocaleTimeString(
                    "en-IN"
                  )}
                </p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "11px",
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/"
                style={{
                  textDecoration: "none",
                  background: "#FFFFFF",
                  color: "#0A2E73",
                  padding: "12px 18px",
                  borderRadius: "10px",
                  fontWeight: 800,
                }}
              >
                View Store
              </Link>

              <button
                type="button"
                onClick={() => {
                  void loadDashboard(true);
                  void loadGoogleBusinessStatus(true);
                }}
                disabled={refreshing}
                style={{
                  background: "#D4AF37",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "12px 19px",
                  borderRadius: "10px",
                  fontWeight: 800,
                  cursor: refreshing
                    ? "not-allowed"
                    : "pointer",
                  opacity: refreshing ? 0.7 : 1,
                }}
              >
                {refreshing
                  ? "Refreshing..."
                  : "Refresh Dashboard"}
              </button>
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(205px, 1fr))",
            gap: "16px",
            marginBottom: "25px",
          }}
        >
          <MetricCard
            icon="💰"
            title="Total Revenue"
            value={`₹${totalRevenue.toLocaleString(
              "en-IN"
            )}`}
            subtitle={`Delivered revenue ₹${deliveredRevenue.toLocaleString(
              "en-IN"
            )}`}
          />

          <MetricCard
            icon="🛒"
            title="Total Orders"
            value={dashboardData.orders.length}
            subtitle={`${pendingOrders} pending orders`}
          />

          <MetricCard
            icon="📦"
            title="Total Products"
            value={dashboardData.products.length}
            subtitle={`${totalInventory} total stock units`}
          />

          <MetricCard
            icon="👥"
            title="Total Customers"
            value={dashboardData.customers.length}
            subtitle={`${highValueCustomers} high value customers`}
          />

          <MetricCard
            icon="⭐"
            title="Average Rating"
            value={averageRating.toFixed(1)}
            subtitle={`${approvedReviews} approved reviews`}
          />

          <MetricCard
            icon="🎟️"
            title="Active Coupons"
            value={activeCoupons}
            subtitle={`${dashboardData.coupons.length} total coupons`}
          />
        </section>

        <section
          className="google-business-section"
          style={{
            marginBottom: "25px",
          }}
        >
          <DashboardPanel
            title="Google Business Profile"
            subtitle="Official Google profile connection, API access and review readiness"
            action={
              googleBusiness.connected ? (
                <button
                  type="button"
                  onClick={() => void loadGoogleBusinessStatus(true)}
                  disabled={googleBusiness.refreshing}
                  style={{
                    border: "1px solid #D4AF37",
                    background: "#FFFDF5",
                    color: "#0A2E73",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    fontWeight: 800,
                    cursor: googleBusiness.refreshing
                      ? "not-allowed"
                      : "pointer",
                    opacity: googleBusiness.refreshing ? 0.65 : 1,
                  }}
                >
                  {googleBusiness.refreshing
                    ? "Refreshing..."
                    : "Refresh Google"}
                </button>
              ) : (
                <a
                  href="/api/google-business/connect"
                  style={{
                    textDecoration: "none",
                    background: "#0A2E73",
                    color: "#FFFFFF",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    fontWeight: 800,
                  }}
                >
                  Connect Google
                </a>
              )
            }
          >
            {googleBusiness.loading ? (
              <div
                style={{
                  padding: "26px 12px",
                  textAlign: "center",
                  color: "#777",
                  fontWeight: 700,
                }}
              >
                Checking Google Business connection...
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: "14px",
                }}
              >
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
                    googleBusiness.totalReviews != null
                      ? "gold"
                      : "neutral"
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

                {googleBusiness.error && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      borderRadius: "12px",
                      padding: "13px 14px",
                      background:
                        googleBusiness.connected &&
                        (googleBusiness.status === 429 ||
                          googleBusiness.status === 403)
                          ? "#FFFBEB"
                          : "#FFF7F7",
                      border:
                        googleBusiness.connected &&
                        (googleBusiness.status === 429 ||
                          googleBusiness.status === 403)
                          ? "1px solid #FDE68A"
                          : "1px solid #FCA5A5",
                      color:
                        googleBusiness.connected &&
                        (googleBusiness.status === 429 ||
                          googleBusiness.status === 403)
                          ? "#92400E"
                          : "#B91C1C",
                      fontSize: "13px",
                      fontWeight: 700,
                      lineHeight: 1.5,
                    }}
                  >
                    {googleBusiness.connected &&
                    (googleBusiness.status === 429 ||
                      googleBusiness.status === 403)
                      ? "Google connection is complete. Business Profile API access is waiting for Google approval. Live rating and reviews will appear here after access becomes available."
                      : googleBusiness.error}
                  </div>
                )}
              </div>
            )}
          </DashboardPanel>
        </section>

        <section
          className="analytics-main-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.7fr) minmax(320px, 1fr)",
            gap: "22px",
            marginBottom: "25px",
          }}
        >
          <DashboardPanel
            title="Revenue Overview"
            subtitle="Sales performance during the last six months"
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: "12px",
                minHeight: "280px",
                paddingTop: "25px",
              }}
            >
              {monthlySales.map((month) => {
                const height = Math.max(
                  (month.revenue /
                    maximumMonthlyRevenue) *
                    190,
                  month.revenue > 0 ? 22 : 5
                );

                return (
                  <div
                    key={month.key}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        color: "#0A2E73",
                        fontSize: "12px",
                        fontWeight: 800,
                        margin: "0 0 8px",
                        overflow: "hidden",
                      }}
                    >
                      ₹
                      {month.revenue >= 1000
                        ? `${(
                            month.revenue / 1000
                          ).toFixed(1)}K`
                        : month.revenue}
                    </p>

                    <div
                      title={`${month.orders} orders`}
                      style={{
                        height: `${height}px`,
                        borderRadius: "10px 10px 4px 4px",
                        background:
                          "linear-gradient(180deg, #D4AF37 0%, #0A2E73 100%)",
                        boxShadow:
                          "0 8px 18px rgba(10,46,115,0.18)",
                        transition: "height 0.4s ease",
                      }}
                    />

                    <p
                      style={{
                        color: "#555",
                        margin: "9px 0 2px",
                        fontWeight: 700,
                      }}
                    >
                      {month.label}
                    </p>

                    <p
                      style={{
                        color: "#999",
                        fontSize: "11px",
                        margin: 0,
                      }}
                    >
                      {month.orders} orders
                    </p>
                  </div>
                );
              })}
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="Order Status"
            subtitle="Live order processing summary"
          >
            <StatusRow
              label="Pending"
              value={pendingOrders}
              total={dashboardData.orders.length}
              icon="⏳"
              background="#FEF3C7"
              color="#92400E"
            />

            <StatusRow
              label="Processing"
              value={processingOrders}
              total={dashboardData.orders.length}
              icon="⚙️"
              background="#E0E7FF"
              color="#3730A3"
            />

            <StatusRow
              label="Shipped"
              value={shippedOrders}
              total={dashboardData.orders.length}
              icon="🚚"
              background="#DBEAFE"
              color="#1D4ED8"
            />

            <StatusRow
              label="Delivered"
              value={deliveredOrders}
              total={dashboardData.orders.length}
              icon="✅"
              background="#DCFCE7"
              color="#166534"
            />

            <StatusRow
              label="Cancelled"
              value={cancelledOrders}
              total={dashboardData.orders.length}
              icon="❌"
              background="#FEE2E2"
              color="#B91C1C"
            />
          </DashboardPanel>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(230px, 1fr))",
            gap: "16px",
            marginBottom: "25px",
          }}
        >
          <MiniMetric
            icon="📊"
            title="Average Order Value"
            value={`₹${Math.round(
              averageOrderValue
            ).toLocaleString("en-IN")}`}
          />

          <MiniMetric
            icon="⚠️"
            title="Low Stock Products"
            value={lowStockProducts.length}
            danger={lowStockProducts.length > 0}
          />

          <MiniMetric
            icon="🚫"
            title="Out of Stock"
            value={outOfStockProducts.length}
            danger={outOfStockProducts.length > 0}
          />

          <MiniMetric
            icon="↩️"
            title="Pending Returns"
            value={pendingReturns}
            danger={pendingReturns > 0}
          />

          <MiniMetric
            icon="💸"
            title="Refund Amount"
            value={`₹${totalRefundAmount.toLocaleString(
              "en-IN"
            )}`}
          />

          <MiniMetric
            icon="🔒"
            title="Blocked Customers"
            value={blockedCustomers}
            danger={blockedCustomers > 0}
          />

          <MiniMetric
            icon="⏳"
            title="Pending Reviews"
            value={pendingReviews}
            danger={pendingReviews > 0}
          />

          <MiniMetric
            icon="✅"
            title="Completed Returns"
            value={completedReturns}
          />
        </section>

        <section
          className="dashboard-tables-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.5fr) minmax(320px, 1fr)",
            gap: "22px",
            marginBottom: "25px",
          }}
        >
          <DashboardPanel
            title="Recent Orders"
            subtitle="Latest customer orders"
            action={
              <Link
                href="/admin/orders"
                style={panelLinkStyle}
              >
                View All Orders
              </Link>
            }
          >
            {recentOrders.length === 0 ? (
              <EmptyState message="No orders were found." />
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "11px",
                }}
              >
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "52px minmax(0, 1fr) auto",
                      gap: "13px",
                      alignItems: "center",
                      padding: "12px",
                      borderRadius: "12px",
                      border: "1px solid #E5E7EB",
                      background: "#FFFFFF",
                    }}
                  >
                    {order.image ? (
                      <img
                        src={order.image}
                        alt={order.name || "Order product"}
                        style={{
                          width: "52px",
                          height: "52px",
                          objectFit: "cover",
                          borderRadius: "9px",
                          border: "1px solid #E5E7EB",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "52px",
                          height: "52px",
                          borderRadius: "9px",
                          background: "#EEF2FF",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          fontSize: "24px",
                        }}
                      >
                        📦
                      </div>
                    )}

                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <h4
                        style={{
                          color: "#0A2E73",
                          margin: "0 0 4px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {order.name || "Order Product"}
                      </h4>

                      <p
                        style={{
                          color: "#777",
                          fontSize: "12px",
                          margin: 0,
                        }}
                      >
                        Order #{order.id} • Qty{" "}
                        {order.quantity || 1}
                      </p>
                    </div>

                    <div
                      style={{
                        textAlign: "right",
                      }}
                    >
                      <strong
                        style={{
                          color: "#0A2E73",
                        }}
                      >
                        ₹
                        {getOrderValue(
                          order
                        ).toLocaleString("en-IN")}
                      </strong>

                      <div
                        style={{
                          marginTop: "5px",
                        }}
                      >
                        <OrderStatusBadge
                          status={
                            order.status || "Pending"
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel
            title="Top Selling Products"
            subtitle="Products with the highest sales"
          >
            {productSales.length === 0 ? (
              <EmptyState message="Sales information is not available." />
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "12px",
                }}
              >
                {productSales.map((product, index) => (
                  <div
                    key={`${product.name}-${index}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      paddingBottom: "12px",
                      borderBottom:
                        index === productSales.length - 1
                          ? "none"
                          : "1px solid #E5E7EB",
                    }}
                  >
                    <div
                      style={{
                        width: "31px",
                        height: "31px",
                        borderRadius: "50%",
                        flexShrink: 0,
                        background:
                          index === 0
                            ? "#D4AF37"
                            : "#E5E7EB",
                        color:
                          index === 0
                            ? "#FFFFFF"
                            : "#0A2E73",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        fontWeight: 800,
                      }}
                    >
                      {index + 1}
                    </div>

                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        style={{
                          width: "48px",
                          height: "48px",
                          objectFit: "cover",
                          borderRadius: "9px",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "9px",
                          background: "#EEF2FF",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        👕
                      </div>
                    )}

                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <h4
                        style={{
                          color: "#0A2E73",
                          margin: "0 0 4px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {product.name}
                      </h4>

                      <p
                        style={{
                          color: "#777",
                          fontSize: "12px",
                          margin: 0,
                        }}
                      >
                        {product.quantity} units sold
                      </p>
                    </div>

                    <strong
                      style={{
                        color: "#D4AF37",
                      }}
                    >
                      ₹
                      {product.revenue.toLocaleString(
                        "en-IN"
                      )}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </DashboardPanel>
        </section>

        <section
          className="dashboard-alerts-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(310px, 1fr))",
            gap: "22px",
            marginBottom: "25px",
          }}
        >
          <DashboardPanel
            title="Low Stock Alert"
            subtitle="Products with five or fewer units"
            action={
              <Link
                href="/admin/products"
                style={panelLinkStyle}
              >
                Manage Products
              </Link>
            }
          >
            {lowStockProducts.length === 0 ? (
              <SuccessState message="All products have sufficient stock." />
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "10px",
                }}
              >
                {lowStockProducts
                  .slice(0, 6)
                  .map((product) => (
                    <StockItem
                      key={product.id}
                      product={product}
                    />
                  ))}
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel
            title="Out of Stock"
            subtitle="Products requiring immediate restocking"
          >
            {outOfStockProducts.length === 0 ? (
              <SuccessState message="No products are out of stock." />
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "10px",
                }}
              >
                {outOfStockProducts
                  .slice(0, 6)
                  .map((product) => (
                    <StockItem
                      key={product.id}
                      product={product}
                      outOfStock
                    />
                  ))}
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel
            title="Store Health"
            subtitle="Important operational information"
          >
            <HealthRow
              label="Approved Reviews"
              value={approvedReviews}
              icon="⭐"
            />

            <HealthRow
              label="Pending Returns"
              value={pendingReturns}
              icon="↩️"
            />

            <HealthRow
              label="Active Coupons"
              value={activeCoupons}
              icon="🎟️"
            />

            <HealthRow
              label="Blocked Customers"
              value={blockedCustomers}
              icon="🔒"
            />

            <HealthRow
              label="Inventory Units"
              value={totalInventory}
              icon="📦"
            />
          </DashboardPanel>
        </section>

        <section
          style={{
            background: "#FFFFFF",
            borderRadius: "20px",
            padding: "25px",
            boxShadow:
              "0 8px 25px rgba(0,0,0,0.07)",
            border:
              "1px solid rgba(212,175,55,0.22)",
          }}
        >
          <div
            style={{
              marginBottom: "20px",
            }}
          >
            <h2
              style={{
                color: "#0A2E73",
                margin: "0 0 5px",
              }}
            >
              Quick Actions
            </h2>

            <p
              style={{
                color: "#777",
                margin: 0,
              }}
            >
              Access important admin functions.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "13px",
            }}
          >
            <QuickAction
              href="/admin/products/add"
              icon="➕"
              label="Add Product"
            />

            <QuickAction
              href="/admin/products"
              icon="📦"
              label="Manage Products"
            />

            <QuickAction
              href="/admin/orders"
              icon="🛒"
              label="Manage Orders"
            />

            <QuickAction
              href="/admin/customers"
              icon="👥"
              label="Customers"
            />

            <QuickAction
              href="/admin/categories"
              icon="📁"
              label="Categories"
            />

            <QuickAction
              href="/admin/collections"
              icon="🗂️"
              label="Collections"
            />

            <QuickAction
              href="/admin/coupons"
              icon="🎟️"
              label="Coupons"
            />

            <QuickAction
              href="/admin/reviews"
              icon="⭐"
              label="Reviews"
            />

            <QuickAction
              href="/admin/returns"
              icon="↩️"
              label="Returns"
            />

            <QuickAction
              href="/"
              icon="🌐"
              label="View Website"
            />
          </div>
        </section>
      </div>

      <style jsx global>{`
        @media (max-width: 1050px) {
          .analytics-main-grid,
          .dashboard-tables-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 600px) {
          .analytics-main-grid,
          .dashboard-tables-grid,
          .dashboard-alerts-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

function MetricCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: string;
  title: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <div style={metricCardStyle}>
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "13px",
          background: "#EEF2FF",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "25px",
          marginBottom: "14px",
        }}
      >
        {icon}
      </div>

      <p
        style={{
          color: "#666",
          margin: "0 0 6px",
        }}
      >
        {title}
      </p>

      <h2
        style={{
          color: "#0A2E73",
          margin: 0,
          fontSize: "29px",
        }}
      >
        {value}
      </h2>

      <p
        style={{
          color: "#999",
          fontSize: "12px",
          margin: "7px 0 0",
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

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
  const toneStyles: Record<
    "success" | "warning" | "danger" | "gold" | "neutral",
    { background: string; border: string; color: string }
  > = {
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
  };

  const selectedTone = toneStyles[tone];

  return (
    <div
      style={{
        borderRadius: "14px",
        padding: "16px",
        background: selectedTone.background,
        border: `1px solid ${selectedTone.border}`,
        minHeight: "112px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "#666",
          fontSize: "12px",
          fontWeight: 800,
          marginBottom: "12px",
        }}
      >
        <span style={{ fontSize: "18px" }}>{icon}</span>
        <span>{label}</span>
      </div>

      <strong
        style={{
          display: "block",
          color: selectedTone.color,
          fontSize: "20px",
          lineHeight: 1.25,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function MiniMetric({
  icon,
  title,
  value,
  danger = false,
}: {
  icon: string;
  title: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "15px",
        padding: "18px",
        border: danger
          ? "1px solid #FCA5A5"
          : "1px solid #E5E7EB",
        boxShadow:
          "0 5px 16px rgba(0,0,0,0.05)",
        display: "flex",
        alignItems: "center",
        gap: "13px",
      }}
    >
      <div
        style={{
          width: "46px",
          height: "46px",
          borderRadius: "12px",
          background: danger
            ? "#FEE2E2"
            : "#EEF2FF",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "23px",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      <div>
        <p
          style={{
            color: "#777",
            fontSize: "13px",
            margin: "0 0 4px",
          }}
        >
          {title}
        </p>

        <strong
          style={{
            color: danger
              ? "#B91C1C"
              : "#0A2E73",
            fontSize: "21px",
          }}
        >
          {value}
        </strong>
      </div>
    </div>
  );
}

function DashboardPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div>
          <h2
            style={{
              color: "#0A2E73",
              margin: "0 0 5px",
              fontSize: "22px",
            }}
          >
            {title}
          </h2>

          <p
            style={{
              color: "#777",
              fontSize: "13px",
              margin: 0,
            }}
          >
            {subtitle}
          </p>
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

function StatusRow({
  label,
  value,
  total,
  icon,
  background,
  color,
}: {
  label: string;
  value: number;
  total: number;
  icon: string;
  background: string;
  color: string;
}) {
  const percentage =
    total === 0
      ? 0
      : Math.round((value / total) * 100);

  return (
    <div
      style={{
        marginBottom: "18px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "7px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>{icon}</span>

          <span
            style={{
              color: "#444",
              fontWeight: 700,
            }}
          >
            {label}
          </span>
        </div>

        <strong
          style={{
            color,
          }}
        >
          {value}
        </strong>
      </div>

      <div
        style={{
          height: "9px",
          borderRadius: "999px",
          background: "#F3F4F6",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background,
            borderRadius: "999px",
          }}
        />
      </div>
    </div>
  );
}

function OrderStatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized = status.toLowerCase();

  let background = "#FEF3C7";
  let color = "#92400E";

  if (normalized === "processing") {
    background = "#E0E7FF";
    color = "#3730A3";
  }

  if (normalized === "shipped") {
    background = "#DBEAFE";
    color = "#1D4ED8";
  }

  if (normalized === "delivered") {
    background = "#DCFCE7";
    color = "#166534";
  }

  if (normalized === "cancelled") {
    background = "#FEE2E2";
    color = "#B91C1C";
  }

  return (
    <span
      style={{
        display: "inline-block",
        background,
        color,
        padding: "5px 8px",
        borderRadius: "999px",
        fontSize: "10px",
        fontWeight: 800,
      }}
    >
      {status}
    </span>
  );
}

function StockItem({
  product,
  outOfStock = false,
}: {
  product: Product;
  outOfStock?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "11px",
        borderRadius: "11px",
        background: outOfStock
          ? "#FFF7F7"
          : "#FFFBEB",
        border: outOfStock
          ? "1px solid #FCA5A5"
          : "1px solid #FDE68A",
      }}
    >
      {product.image ? (
        <img
          src={product.image}
          alt={product.name || "Product"}
          style={{
            width: "46px",
            height: "46px",
            objectFit: "cover",
            borderRadius: "8px",
          }}
        />
      ) : (
        <div
          style={{
            width: "46px",
            height: "46px",
            borderRadius: "8px",
            background: "#FFFFFF",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          📦
        </div>
      )}

      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <h4
          style={{
            color: "#0A2E73",
            margin: "0 0 4px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {product.name || "Unnamed Product"}
        </h4>

        <p
          style={{
            color: outOfStock
              ? "#B91C1C"
              : "#92400E",
            fontSize: "12px",
            margin: 0,
            fontWeight: 700,
          }}
        >
          {outOfStock
            ? "Out of stock"
            : `${product.stock || 0} units remaining`}
        </p>
      </div>
    </div>
  );
}

function HealthRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "13px 0",
        borderBottom: "1px solid #E5E7EB",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          color: "#555",
          fontWeight: 700,
        }}
      >
        <span>{icon}</span>
        <span>{label}</span>
      </div>

      <strong
        style={{
          color: "#0A2E73",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function EmptyState({
  message,
}: {
  message: string;
}) {
  return (
    <div
      style={{
        padding: "45px 20px",
        borderRadius: "12px",
        background: "#F8FAFC",
        color: "#777",
        textAlign: "center",
        fontWeight: 700,
      }}
    >
      {message}
    </div>
  );
}

function SuccessState({
  message,
}: {
  message: string;
}) {
  return (
    <div
      style={{
        padding: "35px 20px",
        borderRadius: "12px",
        background: "#F0FDF4",
        color: "#166534",
        textAlign: "center",
        fontWeight: 800,
      }}
    >
      ✅ {message}
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "#0A2E73",
        border: "1px solid #E5E7EB",
        background: "#FFFFFF",
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        alignItems: "center",
        gap: "11px",
        fontWeight: 800,
        boxShadow:
          "0 4px 14px rgba(0,0,0,0.04)",
      }}
    >
      <span
        style={{
          fontSize: "21px",
        }}
      >
        {icon}
      </span>

      <span>{label}</span>
    </Link>
  );
}

const metricCardStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "17px",
  padding: "21px",
  boxShadow: "0 7px 22px rgba(0,0,0,0.07)",
  border: "1px solid rgba(212,175,55,0.22)",
};

const panelStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "19px",
  padding: "23px",
  boxShadow: "0 8px 25px rgba(0,0,0,0.07)",
  border: "1px solid rgba(212,175,55,0.2)",
};

const panelLinkStyle: CSSProperties = {
  color: "#0A2E73",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: "13px",
  background: "#EEF2FF",
  padding: "9px 12px",
  borderRadius: "8px",
};