"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number | string;
  user_id?: string | null;
  customer_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  total?: number | string | null;
  total_amount?: number | string | null;
  amount?: number | string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  status?: string | null;
  order_status?: string | null;
  created_at?: string | null;
  items?: unknown;
  products?: unknown;
};

const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | string | null>(
    null
  );
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(`Orders load కాలేదు: ${error.message}`);
      setOrders([]);
      setLoading(false);
      return;
    }

    setOrders((data as Order[]) || []);
    setLoading(false);
  }

  function getOrderStatus(order: Order) {
    return order.order_status || order.status || "Pending";
  }

  function getOrderTotal(order: Order) {
    const value =
      order.total_amount ?? order.total ?? order.amount ?? 0;

    const numberValue = Number(value);

    return Number.isNaN(numberValue) ? 0 : numberValue;
  }

  function getCustomerName(order: Order) {
    return order.customer_name || order.name || "Customer";
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

  function formatDate(value?: string | null) {
    if (!value) return "Date not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function getItemsText(order: Order) {
    const value = order.items ?? order.products;

    if (!value) {
      return "Products information not available";
    }

    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value)) {
      return value
        .map((item: any) => {
          const name =
            item?.name ||
            item?.product_name ||
            item?.title ||
            "Product";

          const quantity = item?.quantity || item?.qty || 1;

          return `${name} × ${quantity}`;
        })
        .join(", ");
    }

    try {
      return JSON.stringify(value);
    } catch {
      return "Products information not available";
    }
  }

  async function updateOrderStatus(
    order: Order,
    newStatus: string
  ) {
    setUpdatingId(order.id);

    let result = await supabase
      .from("orders")
      .update({
        order_status: newStatus,
      })
      .eq("id", order.id);

    if (
      result.error &&
      result.error.message
        .toLowerCase()
        .includes("order_status")
    ) {
      result = await supabase
        .from("orders")
        .update({
          status: newStatus,
        })
        .eq("id", order.id);
    }

    if (result.error) {
      alert(`Status update failed: ${result.error.message}`);
      setUpdatingId(null);
      return;
    }

    setOrders((currentOrders) =>
      currentOrders.map((item) =>
        item.id === order.id
          ? {
              ...item,
              order_status: newStatus,
              status: newStatus,
            }
          : item
      )
    );

    setUpdatingId(null);
    alert("Order Status Updated Successfully");
  }

  async function cancelOrder(order: Order) {
    const confirmed = window.confirm(
      `Order #${order.id} cancel చేయాలా?`
    );

    if (!confirmed) return;

    await updateOrderStatus(order, "Cancelled");
  }

  const filteredOrders = useMemo(() => {
    if (filter === "All") {
      return orders;
    }

    return orders.filter(
      (order) => getOrderStatus(order) === filter
    );
  }, [orders, filter]);

  const totalRevenue = useMemo(() => {
    return orders
      .filter(
        (order) => getOrderStatus(order) !== "Cancelled"
      )
      .reduce(
        (total, order) => total + getOrderTotal(order),
        0
      );
  }, [orders]);

  const pendingOrders = orders.filter(
    (order) => getOrderStatus(order) === "Pending"
  ).length;

  const deliveredOrders = orders.filter(
    (order) => getOrderStatus(order) === "Delivered"
  ).length;

  function getStatusColor(status: string) {
    switch (status) {
      case "Delivered":
        return {
          background: "#DCFCE7",
          color: "#166534",
        };

      case "Cancelled":
        return {
          background: "#FEE2E2",
          color: "#B91C1C",
        };

      case "Shipped":
      case "Out for Delivery":
        return {
          background: "#DBEAFE",
          color: "#1D4ED8",
        };

      case "Packed":
      case "Confirmed":
        return {
          background: "#FEF3C7",
          color: "#92400E",
        };

      default:
        return {
          background: "#F3F4F6",
          color: "#374151",
        };
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F8F4EC",
        padding: "30px 20px 70px",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        <section
          style={{
            background:
              "linear-gradient(135deg, #0A2E73 0%, #164CA8 100%)",
            borderRadius: "22px",
            padding: "30px",
            color: "#FFFFFF",
            marginBottom: "28px",
            boxShadow:
              "0 12px 35px rgba(10,46,115,0.25)",
          }}
        >
          <p
            style={{
              color: "#D4AF37",
              fontWeight: "bold",
              margin: "0 0 8px",
              letterSpacing: "1px",
            }}
          >
            NEW CITY STYLE
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: "36px",
            }}
          >
            Orders Management
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              opacity: 0.9,
            }}
          >
            Manage customer orders and delivery status.
            
          </p>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "18px",
            marginBottom: "28px",
          }}
        >
          <DashboardCard
            icon="🛒"
            title="Total Orders"
            value={loading ? "..." : orders.length}
          />

          <DashboardCard
            icon="⏳"
            title="Pending Orders"
            value={loading ? "..." : pendingOrders}
          />

          <DashboardCard
            icon="✅"
            title="Delivered Orders"
            value={loading ? "..." : deliveredOrders}
          />

          <DashboardCard
            icon="💰"
            title="Total Revenue"
            value={
              loading
                ? "..."
                : `₹${totalRevenue.toLocaleString("en-IN")}`
            }
          />
        </section>

        <section
          style={{
            background: "#FFFFFF",
            borderRadius: "18px",
            padding: "20px",
            marginBottom: "24px",
            boxShadow:
              "0 8px 25px rgba(0,0,0,0.07)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "15px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <strong style={{ color: "#0A2E73" }}>
              Filter:
            </strong>

            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value)
              }
              style={{
                padding: "11px 15px",
                border: "1px solid #D1D5DB",
                borderRadius: "9px",
                fontSize: "15px",
                background: "#FFFFFF",
              }}
            >
              <option value="All">All Orders</option>

              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={loadOrders}
              style={{
                background: "#D4AF37",
                color: "#FFFFFF",
                border: "none",
                padding: "12px 20px",
                borderRadius: "9px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              🔄 Refresh Orders
            </button>

            <Link
              href="/admin"
              style={{
                background: "#0A2E73",
                color: "#FFFFFF",
                textDecoration: "none",
                padding: "12px 20px",
                borderRadius: "9px",
                fontWeight: "bold",
              }}
            >
              ← Dashboard
            </Link>
          </div>
        </section>

        {loading ? (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "18px",
              padding: "60px 20px",
              textAlign: "center",
              color: "#0A2E73",
              fontSize: "20px",
              boxShadow:
                "0 8px 25px rgba(0,0,0,0.07)",
            }}
          >
            Loading Orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "18px",
              padding: "60px 20px",
              textAlign: "center",
              boxShadow:
                "0 8px 25px rgba(0,0,0,0.07)",
            }}
          >
            <div style={{ fontSize: "50px" }}>📭</div>

            <h2 style={{ color: "#0A2E73" }}>
              Orders లేవు
            </h2>

            <p style={{ color: "#666" }}>
              Selected statusలో orders కనిపించలేదు.
            </p>
          </div>
        ) : (
          <section
            style={{
              display: "grid",
              gap: "20px",
            }}
          >
            {filteredOrders.map((order) => {
              const status = getOrderStatus(order);
              const statusStyle = getStatusColor(status);
              const isUpdating = updatingId === order.id;

              return (
                <article
                  key={order.id}
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "18px",
                    padding: "24px",
                    boxShadow:
                      "0 8px 25px rgba(0,0,0,0.08)",
                    border:
                      "1px solid rgba(212,175,55,0.25)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "15px",
                      paddingBottom: "18px",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          color: "#666",
                          margin: "0 0 5px",
                        }}
                      >
                        Order ID
                      </p>

                      <h2
                        style={{
                          color: "#0A2E73",
                          margin: 0,
                        }}
                      >
                        #{order.id}
                      </h2>

                      <p
                        style={{
                          color: "#777",
                          margin: "7px 0 0",
                        }}
                      >
                        {formatDate(order.created_at)}
                      </p>
                    </div>

                    <div
                      style={{
                        ...statusStyle,
                        padding: "9px 15px",
                        borderRadius: "999px",
                        fontWeight: "bold",
                      }}
                    >
                      {status}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(230px, 1fr))",
                      gap: "20px",
                      marginTop: "20px",
                    }}
                  >
                    <InfoBox
                      title="Customer Details"
                      lines={[
                        `👤 ${getCustomerName(order)}`,
                        `📞 ${order.phone || "Phone not added"}`,
                        `✉️ ${order.email || "Email not added"}`,
                      ]}
                    />

                    <InfoBox
                      title="Delivery Address"
                      lines={[
                        getFullAddress(order) ||
                          "Address not available",
                      ]}
                    />

                    <InfoBox
                      title="Order Products"
                      lines={[getItemsText(order)]}
                    />

                    <InfoBox
                      title="Payment Details"
                      lines={[
                        `Method: ${
                          order.payment_method || "Not added"
                        }`,
                        `Status: ${
                          order.payment_status || "Pending"
                        }`,
                        `Total: ₹${getOrderTotal(
                          order
                        ).toLocaleString("en-IN")}`,
                      ]}
                    />
                  </div>

                  <div
                    style={{
                      background: "#F8FAFC",
                      borderRadius: "14px",
                      padding: "18px",
                      marginTop: "20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "10px",
                      }}
                    >
                      <strong
                        style={{
                          color: "#0A2E73",
                        }}
                      >
                        Update Status:
                      </strong>

                      <select
                        value={status}
                        disabled={isUpdating}
                        onChange={(event) =>
                          updateOrderStatus(
                            order,
                            event.target.value
                          )
                        }
                        style={{
                          padding: "11px 14px",
                          border: "1px solid #D1D5DB",
                          borderRadius: "9px",
                          fontSize: "15px",
                          background: "#FFFFFF",
                          cursor: isUpdating
                            ? "not-allowed"
                            : "pointer",
                        }}
                      >
                        {ORDER_STATUSES.map(
                          (statusOption) => (
                            <option
                              key={statusOption}
                              value={statusOption}
                            >
                              {statusOption}
                            </option>
                          )
                        )}
                      </select>

                      {isUpdating && (
                        <span
                          style={{
                            color: "#0A2E73",
                            fontWeight: "bold",
                          }}
                        >
                          Updating...
                        </span>
                      )}
                    </div>

                    {status !== "Cancelled" &&
                      status !== "Delivered" && (
                        <button
                          onClick={() => cancelOrder(order)}
                          disabled={isUpdating}
                          style={{
                            background: "#DC2626",
                            color: "#FFFFFF",
                            border: "none",
                            padding: "11px 18px",
                            borderRadius: "9px",
                            cursor: isUpdating
                              ? "not-allowed"
                              : "pointer",
                            fontWeight: "bold",
                            opacity: isUpdating ? 0.65 : 1,
                          }}
                        >
                          ❌ Cancel Order
                        </button>
                      )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function DashboardCard({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: number | string;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "18px",
        padding: "23px",
        boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
        border: "1px solid rgba(212,175,55,0.25)",
      }}
    >
      <div style={{ fontSize: "30px" }}>{icon}</div>

      <p
        style={{
          color: "#666",
          margin: "10px 0 7px",
        }}
      >
        {title}
      </p>

      <h2
        style={{
          color: "#0A2E73",
          margin: 0,
          fontSize: "30px",
        }}
      >
        {value}
      </h2>
    </div>
  );
}

function InfoBox({
  title,
  lines,
}: {
  title: string;
  lines: string[];
}) {
  return (
    <div
      style={{
        background: "#F8FAFC",
        borderRadius: "13px",
        padding: "17px",
        border: "1px solid #E5E7EB",
      }}
    >
      <h3
        style={{
          color: "#0A2E73",
          margin: "0 0 11px",
        }}
      >
        {title}
      </h3>

      {lines.map((line, index) => (
        <p
          key={`${title}-${index}`}
          style={{
            color: "#444",
            margin: index === lines.length - 1 ? 0 : "0 0 8px",
            lineHeight: "1.6",
            overflowWrap: "anywhere",
          }}
        >
          {line}
        </p>
      ))}
    </div>
  );
}