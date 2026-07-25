"use client";

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type ReturnRequest = {
  id: number;
  order_id: number | null;
  customer_name: string;
  product_name: string;
  reason: string;
  refund_amount: number;
  status: string;
  created_at: string;
};

type ReturnForm = {
  orderId: string;
  customerName: string;
  productName: string;
  reason: string;
  refundAmount: string;
};

const emptyForm: ReturnForm = {
  orderId: "",
  customerName: "",
  productName: "",
  reason: "",
  refundAmount: "",
};

const statusOptions = [
  "Requested",
  "Approved",
  "Rejected",
  "Product Received",
  "Refund Completed",
];

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [form, setForm] = useState<ReturnForm>(emptyForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    loadReturns();
  }, []);

  async function loadReturns() {
    setLoading(true);

    const { data, error } = await supabase
      .from("returns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(`Unable to load return requests: ${error.message}`);
      setLoading(false);
      return;
    }

    setReturns((data as ReturnRequest[]) || []);
    setLoading(false);
  }

  function resetForm() {
    setForm(emptyForm);
    setSaving(false);
  }

  async function addReturnRequest(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!form.customerName.trim()) {
      alert("Please enter the customer name.");
      return;
    }

    if (!form.productName.trim()) {
      alert("Please enter the product name.");
      return;
    }

    if (!form.reason.trim()) {
      alert("Please enter the return reason.");
      return;
    }

    setSaving(true);

    const returnData = {
      order_id: form.orderId
        ? Number(form.orderId)
        : null,
      customer_name: form.customerName.trim(),
      product_name: form.productName.trim(),
      reason: form.reason.trim(),
      refund_amount: Number(form.refundAmount || 0),
      status: "Requested",
    };

    const { data, error } = await supabase
      .from("returns")
      .insert(returnData)
      .select()
      .single();

    if (error) {
      alert(`Unable to add return request: ${error.message}`);
      setSaving(false);
      return;
    }

    setReturns((current) => [
      data as ReturnRequest,
      ...current,
    ]);

    alert("Return request added successfully.");
    resetForm();
  }

  async function updateStatus(
    returnRequest: ReturnRequest,
    newStatus: string
  ) {
    const { error } = await supabase
      .from("returns")
      .update({
        status: newStatus,
      })
      .eq("id", returnRequest.id);

    if (error) {
      alert(`Unable to update return status: ${error.message}`);
      return;
    }

    setReturns((current) =>
      current.map((item) =>
        item.id === returnRequest.id
          ? {
              ...item,
              status: newStatus,
            }
          : item
      )
    );
  }

  async function deleteReturnRequest(
    returnRequest: ReturnRequest
  ) {
    const confirmed = window.confirm(
      `Delete return request for "${returnRequest.product_name}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("returns")
      .delete()
      .eq("id", returnRequest.id);

    if (error) {
      alert(`Unable to delete return request: ${error.message}`);
      return;
    }

    setReturns((current) =>
      current.filter((item) => item.id !== returnRequest.id)
    );

    alert("Return request deleted successfully.");
  }

  const filteredReturns = useMemo(() => {
    const query = search.trim().toLowerCase();

    return returns.filter((item) => {
      const matchesSearch =
        !query ||
        item.customer_name.toLowerCase().includes(query) ||
        item.product_name.toLowerCase().includes(query) ||
        item.reason.toLowerCase().includes(query) ||
        String(item.order_id || "").includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [returns, search, statusFilter]);

  const requestedCount = returns.filter(
    (item) => item.status === "Requested"
  ).length;

  const approvedCount = returns.filter(
    (item) =>
      item.status === "Approved" ||
      item.status === "Product Received"
  ).length;

  const completedCount = returns.filter(
    (item) => item.status === "Refund Completed"
  ).length;

  const totalRefunds = returns
    .filter((item) => item.status === "Refund Completed")
    .reduce(
      (sum, item) => sum + Number(item.refund_amount || 0),
      0
    );

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
          maxWidth: "1350px",
          margin: "0 auto",
        }}
      >
        <section
          style={{
            background:
              "linear-gradient(135deg, #0A2E73 0%, #164CA8 100%)",
            color: "#FFFFFF",
            borderRadius: "22px",
            padding: "30px",
            marginBottom: "25px",
            boxShadow:
              "0 12px 35px rgba(10,46,115,0.25)",
          }}
        >
          <p
            style={{
              color: "#D4AF37",
              fontWeight: 800,
              letterSpacing: "1px",
              margin: "0 0 8px",
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
            Returns Management
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              opacity: 0.9,
            }}
          >
            Manage product returns, approvals and customer refunds.
          </p>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "16px",
            marginBottom: "25px",
          }}
        >
          <SummaryCard
            icon="↩️"
            title="Total Returns"
            value={returns.length}
          />

          <SummaryCard
            icon="⏳"
            title="Requested"
            value={requestedCount}
          />

          <SummaryCard
            icon="✅"
            title="Approved"
            value={approvedCount}
          />

          <SummaryCard
            icon="💰"
            title="Refunded"
            value={`₹${totalRefunds}`}
          />
        </section>

        <div
          className="returns-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "380px minmax(0, 1fr)",
            gap: "24px",
            alignItems: "start",
          }}
        >
          <section
            style={{
              background: "#FFFFFF",
              borderRadius: "18px",
              padding: "24px",
              boxShadow:
                "0 8px 25px rgba(0,0,0,0.08)",
              border:
                "1px solid rgba(212,175,55,0.22)",
            }}
          >
            <h2
              style={{
                color: "#0A2E73",
                margin: "0 0 22px",
              }}
            >
              Add Return Request
            </h2>

            <form onSubmit={addReturnRequest}>
              <FormField label="Order ID">
                <input
                  type="number"
                  value={form.orderId}
                  placeholder="Example: 7"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      orderId: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Customer Name">
                <input
                  value={form.customerName}
                  placeholder="Customer full name"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      customerName: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Product Name">
                <input
                  value={form.productName}
                  placeholder="Returned product name"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      productName: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Return Reason">
                <textarea
                  value={form.reason}
                  placeholder="Why is the customer returning this product?"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  style={{
                    ...inputStyle,
                    minHeight: "110px",
                    resize: "vertical",
                  }}
                />
              </FormField>

              <FormField label="Refund Amount">
                <input
                  type="number"
                  min="0"
                  value={form.refundAmount}
                  placeholder="0"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      refundAmount: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <button
                type="submit"
                disabled={saving}
                style={{
                  width: "100%",
                  background: "#0A2E73",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "14px",
                  borderRadius: "10px",
                  fontWeight: 800,
                  fontSize: "16px",
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : "Add Return Request"}
              </button>
            </form>
          </section>

          <section
            style={{
              background: "#FFFFFF",
              borderRadius: "18px",
              padding: "24px",
              boxShadow:
                "0 8px 25px rgba(0,0,0,0.08)",
              border:
                "1px solid rgba(212,175,55,0.22)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "14px",
                marginBottom: "22px",
              }}
            >
              <div>
                <h2
                  style={{
                    color: "#0A2E73",
                    margin: "0 0 5px",
                  }}
                >
                  Return Requests
                </h2>

                <p
                  style={{
                    color: "#666",
                    margin: 0,
                  }}
                >
                  {filteredReturns.length} requests found
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <input
                  value={search}
                  placeholder="Search returns..."
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  style={{
                    ...inputStyle,
                    width: "220px",
                  }}
                />

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                  style={{
                    ...inputStyle,
                    width: "170px",
                  }}
                >
                  <option value="All">All Statuses</option>

                  {statusOptions.map((status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={loadReturns}
                  style={{
                    background: "#D4AF37",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "11px 17px",
                    borderRadius: "9px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div style={messageStyle}>
                Loading Return Requests...
              </div>
            ) : filteredReturns.length === 0 ? (
              <div style={messageStyle}>
                No return requests were found.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "16px",
                }}
              >
                {filteredReturns.map((item) => (
                  <article
                    key={item.id}
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: "15px",
                      padding: "20px",
                      boxShadow:
                        "0 5px 18px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: "15px",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            color: "#777",
                            margin: "0 0 5px",
                            fontSize: "13px",
                          }}
                        >
                          Return ID #{item.id}
                          {item.order_id
                            ? ` • Order #${item.order_id}`
                            : ""}
                        </p>

                        <h3
                          style={{
                            color: "#0A2E73",
                            margin: "0 0 7px",
                            fontSize: "21px",
                          }}
                        >
                          {item.product_name}
                        </h3>

                        <p
                          style={{
                            color: "#444",
                            margin: 0,
                          }}
                        >
                          Customer:{" "}
                          <strong>
                            {item.customer_name}
                          </strong>
                        </p>
                      </div>

                      <StatusBadge
                        status={item.status}
                      />
                    </div>

                    <div
                      style={{
                        background: "#F8FAFC",
                        borderRadius: "10px",
                        padding: "14px",
                        marginTop: "15px",
                      }}
                    >
                      <strong
                        style={{
                          color: "#0A2E73",
                        }}
                      >
                        Return Reason
                      </strong>

                      <p
                        style={{
                          color: "#555",
                          margin: "7px 0 0",
                          lineHeight: 1.6,
                        }}
                      >
                        {item.reason}
                      </p>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "12px",
                        marginTop: "16px",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            color: "#777",
                            margin: "0 0 4px",
                            fontSize: "13px",
                          }}
                        >
                          Refund Amount
                        </p>

                        <strong
                          style={{
                            color: "#D4AF37",
                            fontSize: "20px",
                          }}
                        >
                          ₹{Number(
                            item.refund_amount || 0
                          )}
                        </strong>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "9px",
                        }}
                      >
                        <select
                          value={item.status}
                          onChange={(event) =>
                            updateStatus(
                              item,
                              event.target.value
                            )
                          }
                          style={{
                            ...inputStyle,
                            width: "185px",
                          }}
                        >
                          {statusOptions.map(
                            (status) => (
                              <option
                                key={status}
                                value={status}
                              >
                                {status}
                              </option>
                            )
                          )}
                        </select>

                        <button
                          type="button"
                          onClick={() =>
                            deleteReturnRequest(item)
                          }
                          style={{
                            background: "#FFFFFF",
                            color: "#DC2626",
                            border:
                              "1px solid #FCA5A5",
                            padding: "11px 16px",
                            borderRadius: "9px",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 980px) {
          .returns-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  border: "1px solid #D1D5DB",
  borderRadius: "9px",
  background: "#FFFFFF",
  color: "#111827",
  fontSize: "15px",
  outline: "none",
};

const messageStyle: CSSProperties = {
  padding: "55px 20px",
  borderRadius: "13px",
  background: "#F8FAFC",
  color: "#0A2E73",
  fontWeight: 700,
  textAlign: "center",
};

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginBottom: "17px",
      }}
    >
      <label
        style={{
          display: "block",
          color: "#0A2E73",
          fontWeight: 700,
          marginBottom: "7px",
        }}
      >
        {label}
      </label>

      {children}
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "16px",
        padding: "20px",
        boxShadow:
          "0 7px 22px rgba(0,0,0,0.07)",
        border:
          "1px solid rgba(212,175,55,0.22)",
      }}
    >
      <div style={{ fontSize: "29px" }}>
        {icon}
      </div>

      <p
        style={{
          color: "#666",
          margin: "9px 0 5px",
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
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  let background = "#FEF3C7";
  let color = "#92400E";

  if (
    status === "Approved" ||
    status === "Product Received"
  ) {
    background = "#DBEAFE";
    color = "#1D4ED8";
  }

  if (status === "Rejected") {
    background = "#FEE2E2";
    color = "#B91C1C";
  }

  if (status === "Refund Completed") {
    background = "#DCFCE7";
    color = "#166534";
  }

  return (
    <span
      style={{
        background,
        color,
        padding: "8px 13px",
        borderRadius: "999px",
        fontWeight: 800,
        fontSize: "13px",
      }}
    >
      {status}
    </span>
  );
}