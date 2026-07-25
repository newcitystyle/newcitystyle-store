"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type OrderItem = {
  product_id?: number | string;
  name?: string;
  image?: string;
  price?: number | string;
  quantity?: number | string;
  size?: string | null;
  color?: string | null;
  item_total?: number | string;
};

type Order = {
  id: number | string;
  created_at?: string | null;

  customer_name?: string | null;
  phone?: string | null;
  email?: string | null;

  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;

  items?: OrderItem[] | string | null;
  total_amount?: number | string | null;

  payment_method?: string | null;
  payment_status?: string | null;

  order_status?: string | null;
  status?: string | null;

  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

const PAYMENT_STATUSES = [
  "Pending",
  "Paid",
  "Failed",
  "Refunded",
];

function normalizeStatus(value?: string | null) {
  const status = String(value || "Pending").trim();
  return status || "Pending";
}

function parseItems(order: Order): OrderItem[] {
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

function getOrderTotal(order: Order) {
  const value = Number(order.total_amount || 0);
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
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getFullAddress(order: Order) {
  return [
    order.address,
    order.city,
    order.state,
    order.pincode,
  ]
    .filter(Boolean)
    .join(", ");
}

function getOrderStatus(order: Order) {
  return normalizeStatus(order.order_status || order.status);
}

function getPaymentStatus(order: Order) {
  return normalizeStatus(order.payment_status);
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("All");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("All");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("All");

  const [expandedOrderId, setExpandedOrderId] = useState<
    number | string | null
  >(null);

  const [updatingOrderId, setUpdatingOrderId] = useState<
    number | string | null
  >(null);

  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadOrders(refresh = false) {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setOrders((data as Order[]) || []);
    } catch (error) {
      console.error("Admin orders load error:", error);

      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load orders.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function updateOrderStatus(
    order: Order,
    newStatus: string
  ) {
    setUpdatingOrderId(order.id);

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          order_status: newStatus,
          status: newStatus,
        })
        .eq("id", order.id);

      if (error) throw error;

      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? {
                ...item,
                order_status: newStatus,
                status: newStatus,
              }
            : item
        )
      );

      setToast({
        type: "success",
        message: `Order #${order.id} status updated to ${newStatus}.`,
      });
    } catch (error) {
      console.error("Order status update error:", error);

      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to update order status.",
      });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function updatePaymentStatus(
    order: Order,
    newStatus: string
  ) {
    setUpdatingOrderId(order.id);

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: newStatus,
        })
        .eq("id", order.id);

      if (error) throw error;

      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? {
                ...item,
                payment_status: newStatus,
              }
            : item
        )
      );

      setToast({
        type: "success",
        message: `Order #${order.id} payment status updated.`,
      });
    } catch (error) {
      console.error("Payment status update error:", error);

      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to update payment status.",
      });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function cancelOrder(order: Order) {
    const confirmed = window.confirm(
      `Cancel Order #${order.id}?`
    );

    if (!confirmed) return;

    await updateOrderStatus(order, "Cancelled");
  }

  const paymentMethods = useMemo(() => {
    return Array.from(
      new Set(
        orders
          .map((order) => order.payment_method || "")
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const orderStatus = getOrderStatus(order);
      const paymentStatus = getPaymentStatus(order);
      const paymentMethod = String(
        order.payment_method || ""
      ).trim();

      const searchableText = [
        order.id,
        order.customer_name,
        order.phone,
        order.email,
        order.address,
        order.city,
        order.state,
        order.pincode,
        order.razorpay_order_id,
        order.razorpay_payment_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchableText.includes(query);

      const matchesOrderStatus =
        orderStatusFilter === "All" ||
        orderStatus === orderStatusFilter;

      const matchesPaymentStatus =
        paymentStatusFilter === "All" ||
        paymentStatus === paymentStatusFilter;

      const matchesPaymentMethod =
        paymentMethodFilter === "All" ||
        paymentMethod === paymentMethodFilter;

      return (
        matchesSearch &&
        matchesOrderStatus &&
        matchesPaymentStatus &&
        matchesPaymentMethod
      );
    });
  }, [
    orders,
    search,
    orderStatusFilter,
    paymentStatusFilter,
    paymentMethodFilter,
  ]);

  const stats = useMemo(() => {
    const totalRevenue = orders
      .filter(
        (order) =>
          getOrderStatus(order) !== "Cancelled" &&
          getPaymentStatus(order) === "Paid"
      )
      .reduce(
        (sum, order) => sum + getOrderTotal(order),
        0
      );

    return {
      total: orders.length,
      pending: orders.filter(
        (order) => getOrderStatus(order) === "Pending"
      ).length,
      shipped: orders.filter((order) =>
        ["Shipped", "Out for Delivery"].includes(
          getOrderStatus(order)
        )
      ).length,
      delivered: orders.filter(
        (order) => getOrderStatus(order) === "Delivered"
      ).length,
      paid: orders.filter(
        (order) => getPaymentStatus(order) === "Paid"
      ).length,
      revenue: totalRevenue,
    };
  }, [orders]);

  if (loading) {
    return (
      <main className="loadingPage">
        <div className="loader" />
        <h2>Loading Admin Orders...</h2>

        <style jsx>{`
          .loadingPage {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #f8f4ec;
            color: #0a2e73;
          }

          .loader {
            width: 50px;
            height: 50px;
            margin-bottom: 18px;
            border: 4px solid #e4e7ec;
            border-top-color: #d4af37;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
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
      {toast && (
        <div className={`toast ${toast.type}`}>
          <strong>{toast.type === "success" ? "✓" : "!"}</strong>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="container">
        <header className="hero">
          <div>
            <p className="eyebrow">NEW CITY STYLE ADMIN</p>
            <h1>Orders Management</h1>
            <p>
              Manage customer orders, payments and delivery status.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadOrders(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh Orders"}
          </button>
        </header>

        <section className="statsGrid">
          <StatCard
            label="Total Orders"
            value={stats.total}
            icon="▦"
          />

          <StatCard
            label="Pending"
            value={stats.pending}
            icon="◷"
          />

          <StatCard
            label="In Delivery"
            value={stats.shipped}
            icon="🚚"
          />

          <StatCard
            label="Delivered"
            value={stats.delivered}
            icon="✓"
          />

          <StatCard
            label="Paid Orders"
            value={stats.paid}
            icon="₹"
          />

          <StatCard
            label="Paid Revenue"
            value={formatCurrency(stats.revenue)}
            icon="◆"
          />
        </section>

        <section className="filters">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Order ID, customer, phone, email, city..."
          />

          <div className="filterGrid">
            <select
              value={orderStatusFilter}
              onChange={(event) =>
                setOrderStatusFilter(event.target.value)
              }
            >
              <option value="All">All Order Status</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={paymentStatusFilter}
              onChange={(event) =>
                setPaymentStatusFilter(event.target.value)
              }
            >
              <option value="All">All Payment Status</option>
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={paymentMethodFilter}
              onChange={(event) =>
                setPaymentMethodFilter(event.target.value)
              }
            >
              <option value="All">All Payment Methods</option>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setOrderStatusFilter("All");
                setPaymentStatusFilter("All");
                setPaymentMethodFilter("All");
              }}
            >
              Clear Filters
            </button>
          </div>

          <p>
            Showing <strong>{filteredOrders.length}</strong> of{" "}
            <strong>{orders.length}</strong> orders
          </p>
        </section>

        {filteredOrders.length === 0 ? (
          <section className="emptyState">
            <div>📦</div>
            <h2>No Orders Found</h2>
            <p>
              No orders match the selected search and filters.
            </p>
          </section>
        ) : (
          <section className="ordersList">
            {filteredOrders.map((order) => {
              const items = parseItems(order);
              const orderStatus = getOrderStatus(order);
              const paymentStatus = getPaymentStatus(order);
              const isExpanded = expandedOrderId === order.id;
              const isUpdating = updatingOrderId === order.id;

              return (
                <article className="orderCard" key={order.id}>
                  <div className="orderHeader">
                    <div>
                      <span className="label">Order ID</span>
                      <h2>#{order.id}</h2>
                      <small>{formatDate(order.created_at)}</small>
                    </div>

                    <div className="headerBadges">
                      <StatusBadge
                        status={orderStatus}
                        type="order"
                      />

                      <StatusBadge
                        status={paymentStatus}
                        type="payment"
                      />
                    </div>
                  </div>

                  <div className="orderSummaryGrid">
                    <div>
                      <span className="label">Customer</span>
                      <strong>
                        {order.customer_name || "Unknown Customer"}
                      </strong>
                      <small>{order.phone || "No phone"}</small>
                      <small>{order.email || "No email"}</small>
                    </div>

                    <div>
                      <span className="label">Payment Method</span>
                      <strong>
                        {order.payment_method || "Not available"}
                      </strong>
                      {order.razorpay_payment_id && (
                        <small>
                          Payment ID: {order.razorpay_payment_id}
                        </small>
                      )}
                    </div>

                    <div>
                      <span className="label">Items</span>
                      <strong>{items.length}</strong>
                      <small>
                        {items.reduce(
                          (sum, item) =>
                            sum + Number(item.quantity || 1),
                          0
                        )}{" "}
                        total quantity
                      </small>
                    </div>

                    <div>
                      <span className="label">Order Total</span>
                      <strong className="total">
                        {formatCurrency(getOrderTotal(order))}
                      </strong>
                    </div>
                  </div>

                  <div className="controls">
                    <label>
                      Order Status
                      <select
                        value={orderStatus}
                        disabled={isUpdating}
                        onChange={(event) =>
                          updateOrderStatus(
                            order,
                            event.target.value
                          )
                        }
                      >
                        {ORDER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Payment Status
                      <select
                        value={paymentStatus}
                        disabled={isUpdating}
                        onChange={(event) =>
                          updatePaymentStatus(
                            order,
                            event.target.value
                          )
                        }
                      >
                        {PAYMENT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      className="detailsButton"
                      onClick={() =>
                        setExpandedOrderId(
                          isExpanded ? null : order.id
                        )
                      }
                    >
                      {isExpanded ? "Hide Details" : "View Details"}
                    </button>

                    {orderStatus !== "Cancelled" &&
                      orderStatus !== "Delivered" && (
                        <button
                          type="button"
                          className="cancelButton"
                          disabled={isUpdating}
                          onClick={() => cancelOrder(order)}
                        >
                          Cancel Order
                        </button>
                      )}
                  </div>

                  {isExpanded && (
                    <div className="expandedArea">
                      <div className="addressCard">
                        <span className="label">
                          Delivery Address
                        </span>

                        <strong>
                          {order.customer_name ||
                            "Unknown Customer"}
                        </strong>

                        <p>
                          {getFullAddress(order) ||
                            "Address not available"}
                        </p>

                        <p>
                          Phone: {order.phone || "Not available"}
                        </p>
                      </div>

                      <div className="itemsArea">
                        <h3>Ordered Products</h3>

                        {items.length === 0 ? (
                          <p className="noItems">
                            Product details are unavailable.
                          </p>
                        ) : (
                          <div className="itemsGrid">
                            {items.map((item, index) => {
                              const quantity = Number(
                                item.quantity || 1
                              );
                              const price = Number(item.price || 0);
                              const itemTotal =
                                Number(item.item_total) ||
                                price * quantity;

                              return (
                                <article
                                  className="itemCard"
                                  key={`${order.id}-${index}`}
                                >
                                  <div className="itemImage">
                                    {item.image ? (
                                      <img
                                        src={item.image}
                                        alt={item.name || "Product"}
                                      />
                                    ) : (
                                      <span>NCS</span>
                                    )}
                                  </div>

                                  <div className="itemInfo">
                                    <strong>
                                      {item.name || "Product"}
                                    </strong>

                                    <small>
                                      Quantity: {quantity}
                                    </small>

                                    {(item.size || item.color) && (
                                      <small>
                                        {item.size
                                          ? `Size: ${item.size}`
                                          : ""}
                                        {item.size && item.color
                                          ? " • "
                                          : ""}
                                        {item.color
                                          ? `Color: ${item.color}`
                                          : ""}
                                      </small>
                                    )}

                                    <small>
                                      Unit Price:{" "}
                                      {formatCurrency(price)}
                                    </small>
                                  </div>

                                  <strong className="itemTotal">
                                    {formatCurrency(itemTotal)}
                                  </strong>
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
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

        button,
        input,
        select {
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
            #f8f4ec;
        }

        .container {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
        }

        .toast {
          position: fixed;
          top: 95px;
          right: 22px;
          z-index: 4000;
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: 380px;
          padding: 14px 17px;
          border-radius: 12px;
          color: white;
          font-size: 13px;
          font-weight: 800;
          box-shadow: 0 18px 40px rgba(16, 24, 40, 0.24);
        }

        .toast.success {
          background: #067647;
        }

        .toast.error {
          background: #b42318;
        }

        .hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 25px;
          margin-bottom: 24px;
          padding: 30px;
          border-radius: 22px;
          background: linear-gradient(135deg, #0a2e73, #164ca8);
          color: white;
          box-shadow: 0 18px 42px rgba(10, 46, 115, 0.2);
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #d4af37;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(34px, 5vw, 49px);
        }

        .hero > div > p:last-child {
          margin: 10px 0 0;
          color: rgba(255, 255, 255, 0.78);
        }

        .hero button {
          min-height: 46px;
          padding: 0 18px;
          border: 1px solid #d4af37;
          border-radius: 11px;
          background: linear-gradient(135deg, #d4af37, #f1d26a);
          color: #0a2e73;
          font-weight: 900;
          cursor: pointer;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 22px;
        }

        .statCard {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 95px;
          padding: 16px;
          border: 1px solid #e4e7ec;
          border-radius: 15px;
          background: white;
          box-shadow: 0 8px 22px rgba(16, 24, 40, 0.05);
        }

        .statIcon {
          width: 43px;
          height: 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 12px;
          background: #eef3ff;
          color: #0a2e73;
          font-size: 18px;
          font-weight: 900;
        }

        .statCard span,
        .statCard strong {
          display: block;
        }

        .statCard span {
          color: #667085;
          font-size: 11px;
        }

        .statCard strong {
          margin-top: 5px;
          color: #172033;
          font-size: 21px;
        }

        .filters {
          margin-bottom: 23px;
          padding: 18px;
          border: 1px solid #e4e7ec;
          border-radius: 17px;
          background: white;
          box-shadow: 0 8px 24px rgba(16, 24, 40, 0.05);
        }

        .filters > input {
          width: 100%;
          height: 48px;
          padding: 0 14px;
          border: 1px solid #d0d5dd;
          border-radius: 11px;
          outline: none;
        }

        .filters > input:focus,
        .filters select:focus {
          border-color: #0a2e73;
          box-shadow: 0 0 0 4px rgba(10, 46, 115, 0.08);
        }

        .filterGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
          gap: 11px;
          margin-top: 12px;
        }

        .filterGrid select {
          height: 43px;
          padding: 0 11px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: white;
          outline: none;
        }

        .filterGrid button {
          min-height: 43px;
          padding: 0 15px;
          border: 1px solid #b9c8eb;
          border-radius: 9px;
          background: #eef3ff;
          color: #0a2e73;
          font-weight: 800;
          cursor: pointer;
        }

        .filters > p {
          margin: 13px 0 0;
          color: #667085;
          font-size: 12px;
        }

        .ordersList {
          display: grid;
          gap: 20px;
        }

        .orderCard {
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.28);
          border-radius: 18px;
          background: white;
          box-shadow: 0 10px 28px rgba(16, 24, 40, 0.07);
        }

        .orderHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 19px 21px;
          border-bottom: 1px solid #e4e7ec;
          background: #f8fafc;
        }

        .label {
          display: block;
          margin-bottom: 5px;
          color: #98a2b3;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.7px;
          text-transform: uppercase;
        }

        .orderHeader h2 {
          margin: 0;
          color: #0a2e73;
          font-size: 23px;
        }

        .orderHeader small {
          display: block;
          margin-top: 5px;
          color: #667085;
        }

        .headerBadges {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .orderSummaryGrid {
          display: grid;
          grid-template-columns: 1.4fr 1.2fr 0.7fr 0.8fr;
          gap: 18px;
          padding: 21px;
        }

        .orderSummaryGrid strong,
        .orderSummaryGrid small {
          display: block;
        }

        .orderSummaryGrid strong {
          color: #344054;
        }

        .orderSummaryGrid small {
          margin-top: 5px;
          color: #667085;
          font-size: 11px;
          word-break: break-word;
        }

        .orderSummaryGrid .total {
          color: #d4af37;
          font-size: 23px;
        }

        .controls {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr)) auto auto;
          gap: 11px;
          align-items: end;
          padding: 17px 21px;
          border-top: 1px solid #eaecf0;
          background: #fbfcff;
        }

        .controls label {
          color: #475467;
          font-size: 11px;
          font-weight: 800;
        }

        .controls select {
          width: 100%;
          height: 42px;
          margin-top: 6px;
          padding: 0 10px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: white;
        }

        .controls button {
          min-height: 42px;
          padding: 0 14px;
          border-radius: 9px;
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
        }

        .detailsButton {
          border: 1px solid #b9c8eb;
          background: #eef3ff;
          color: #0a2e73;
        }

        .cancelButton {
          border: 1px solid #fecdca;
          background: #fef3f2;
          color: #b42318;
        }

        .expandedArea {
          display: grid;
          grid-template-columns: minmax(250px, 0.35fr) 1fr;
          gap: 18px;
          padding: 21px;
          border-top: 1px solid #eaecf0;
          background: #fffdf8;
        }

        .addressCard {
          padding: 17px;
          border: 1px solid #e4e7ec;
          border-radius: 13px;
          background: white;
        }

        .addressCard strong {
          display: block;
          color: #0a2e73;
        }

        .addressCard p {
          margin: 9px 0 0;
          color: #667085;
          font-size: 12px;
          line-height: 1.65;
        }

        .itemsArea h3 {
          margin: 0 0 13px;
          color: #0a2e73;
        }

        .itemsGrid {
          display: grid;
          gap: 10px;
        }

        .itemCard {
          display: grid;
          grid-template-columns: 70px minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
          background: white;
        }

        .itemImage {
          width: 70px;
          height: 82px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #0a2e73;
          color: #d4af37;
          font-size: 10px;
          font-weight: 900;
        }

        .itemImage img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .itemInfo strong,
        .itemInfo small {
          display: block;
        }

        .itemInfo strong {
          color: #0a2e73;
        }

        .itemInfo small {
          margin-top: 4px;
          color: #667085;
          font-size: 11px;
        }

        .itemTotal {
          color: #d4af37;
          white-space: nowrap;
        }

        .emptyState {
          min-height: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          border: 1px solid #e4e7ec;
          border-radius: 18px;
          background: white;
          text-align: center;
        }

        .emptyState > div {
          font-size: 50px;
        }

        .emptyState h2 {
          margin: 15px 0 5px;
          color: #0a2e73;
        }

        .emptyState p {
          color: #667085;
        }

        .noItems {
          color: #667085;
        }

        @media (max-width: 1200px) {
          .statsGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .hero {
            align-items: flex-start;
            flex-direction: column;
          }

          .orderSummaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .controls {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .expandedArea {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .page {
            padding: 20px 10px 50px;
          }

          .hero {
            padding: 20px;
          }

          .statsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .filterGrid {
            grid-template-columns: 1fr;
          }

          .orderHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .orderSummaryGrid,
          .controls {
            grid-template-columns: 1fr;
          }

          .itemCard {
            grid-template-columns: 62px minmax(0, 1fr);
          }

          .itemImage {
            width: 62px;
            height: 74px;
          }

          .itemTotal {
            grid-column: 2 / 3;
          }

          .toast {
            top: 80px;
            right: 10px;
            left: 10px;
            max-width: none;
          }
        }
      `}</style>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: string;
}) {
  return (
    <article className="statCard">
      <div className="statIcon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function StatusBadge({
  status,
  type,
}: {
  status: string;
  type: "order" | "payment";
}) {
  const normalized = status.toLowerCase();

  let background = "#f3f4f6";
  let color = "#374151";
  let border = "#d1d5db";

  if (
    normalized === "delivered" ||
    normalized === "paid"
  ) {
    background = "#dcfce7";
    color = "#166534";
    border = "#86efac";
  } else if (
    normalized === "cancelled" ||
    normalized === "failed"
  ) {
    background = "#fee2e2";
    color = "#b91c1c";
    border = "#fca5a5";
  } else if (
    normalized === "shipped" ||
    normalized === "out for delivery"
  ) {
    background = "#dbeafe";
    color = "#1d4ed8";
    border = "#93c5fd";
  } else if (
    normalized === "confirmed" ||
    normalized === "packed"
  ) {
    background = "#fef3c7";
    color = "#92400e";
    border = "#fcd34d";
  }

  return (
    <span className="badge">
      {type === "payment" ? "Payment: " : ""}
      {status}

      <style jsx>{`
        .badge {
          display: inline-flex;
          padding: 8px 11px;
          border: 1px solid ${border};
          border-radius: 999px;
          background: ${background};
          color: ${color};
          font-size: 10px;
          font-weight: 850;
          white-space: nowrap;
        }
      `}</style>
    </span>
  );
}
