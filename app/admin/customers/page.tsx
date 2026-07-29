"use client";

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Customer = {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  total_orders: number;
  total_spent: number;
  is_blocked: boolean;
  created_at: string;
};

type CustomerForm = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  totalOrders: string;
  totalSpent: string;
  isBlocked: boolean;
};

const emptyForm: CustomerForm = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "Andhra Pradesh",
  pincode: "",
  totalOrders: "0",
  totalSpent: "0",
  isBlocked: false,
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<CustomerForm>(emptyForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(`Unable to load customers: ${error.message}`);
      setLoading(false);
      return;
    }

    setCustomers((data as Customer[]) || []);
    setLoading(false);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setSaving(false);
  }

  function startEditing(customer: Customer) {
    setEditingId(customer.id);

    setForm({
      fullName: customer.full_name,
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      city: customer.city || "",
      state: customer.state || "Andhra Pradesh",
      pincode: customer.pincode || "",
      totalOrders: String(customer.total_orders || 0),
      totalSpent: String(customer.total_spent || 0),
      isBlocked: customer.is_blocked,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();

    if (!fullName) {
      alert("Please enter the customer name.");
      return;
    }

    if (phone && phone.length < 10) {
      alert("Please enter a valid mobile number.");
      return;
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      alert("Please enter a valid email address.");
      return;
    }

    setSaving(true);

    const customerData = {
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      pincode: form.pincode.trim() || null,
      total_orders: Number(form.totalOrders || 0),
      total_spent: Number(form.totalSpent || 0),
      is_blocked: form.isBlocked,
    };

    if (editingId !== null) {
      const { data, error } = await supabase
        .from("customers")
        .update(customerData)
        .eq("id", editingId)
        .select()
        .single();

      if (error) {
        alert(`Unable to update customer: ${error.message}`);
        setSaving(false);
        return;
      }

      setCustomers((current) =>
        current.map((customer) =>
          customer.id === editingId
            ? (data as Customer)
            : customer
        )
      );

      alert("Customer updated successfully.");
    } else {
      const { data, error } = await supabase
        .from("customers")
        .insert(customerData)
        .select()
        .single();

      if (error) {
        alert(`Unable to add customer: ${error.message}`);
        setSaving(false);
        return;
      }

      setCustomers((current) => [
        data as Customer,
        ...current,
      ]);

      alert("Customer added successfully.");
    }

    resetForm();
  }

  async function toggleBlocked(customer: Customer) {
    const newStatus = !customer.is_blocked;

    const confirmed = window.confirm(
      newStatus
        ? `Block "${customer.full_name}"?`
        : `Unblock "${customer.full_name}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("customers")
      .update({
        is_blocked: newStatus,
      })
      .eq("id", customer.id);

    if (error) {
      alert(`Unable to update customer status: ${error.message}`);
      return;
    }

    setCustomers((current) =>
      current.map((item) =>
        item.id === customer.id
          ? {
              ...item,
              is_blocked: newStatus,
            }
          : item
      )
    );
  }

  async function deleteCustomer(customer: Customer) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${customer.full_name}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customer.id);

    if (error) {
      alert(`Unable to delete customer: ${error.message}`);
      return;
    }

    setCustomers((current) =>
      current.filter((item) => item.id !== customer.id)
    );

    if (editingId === customer.id) {
      resetForm();
    }

    alert("Customer deleted successfully.");
  }

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        !query ||
        customer.full_name.toLowerCase().includes(query) ||
        (customer.email || "").toLowerCase().includes(query) ||
        (customer.phone || "").includes(query) ||
        (customer.city || "").toLowerCase().includes(query) ||
        (customer.pincode || "").includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active" && !customer.is_blocked) ||
        (statusFilter === "Blocked" && customer.is_blocked) ||
        (statusFilter === "High Value" &&
          Number(customer.total_spent || 0) >= 10000);

      return matchesSearch && matchesStatus;
    });
  }, [customers, search, statusFilter]);

  const activeCustomers = customers.filter(
    (customer) => !customer.is_blocked
  ).length;

  const blockedCustomers =
    customers.length - activeCustomers;

  const totalOrders = customers.reduce(
    (sum, customer) =>
      sum + Number(customer.total_orders || 0),
    0
  );

  const totalRevenue = customers.reduce(
    (sum, customer) =>
      sum + Number(customer.total_spent || 0),
    0
  );

  const highValueCustomers = customers.filter(
    (customer) =>
      Number(customer.total_spent || 0) >= 10000
  ).length;

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
          maxWidth: "1450px",
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
            Customers Management
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              opacity: 0.9,
            }}
          >
            Manage customer profiles, spending, orders and account
            status.
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
            icon="👥"
            title="Total Customers"
            value={customers.length}
          />

          <SummaryCard
            icon="✅"
            title="Active Customers"
            value={activeCustomers}
          />

          <SummaryCard
            icon="🚫"
            title="Blocked Customers"
            value={blockedCustomers}
          />

          <SummaryCard
            icon="🛒"
            title="Customer Orders"
            value={totalOrders}
          />

          <SummaryCard
            icon="💰"
            title="Customer Revenue"
            value={`₹${totalRevenue.toLocaleString("en-IN")}`}
          />

          <SummaryCard
            icon="👑"
            title="High Value Customers"
            value={highValueCustomers}
          />
        </section>

        <div
          className="customers-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "410px minmax(0, 1fr)",
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
              {editingId === null
                ? "Add Customer"
                : "Edit Customer"}
            </h2>

            <form onSubmit={saveCustomer}>
              <FormField label="Full Name">
                <input
                  value={form.fullName}
                  placeholder="Customer full name"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Email Address">
                <input
                  type="email"
                  value={form.email}
                  placeholder="customer@example.com"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Mobile Number">
                <input
                  value={form.phone}
                  placeholder="10-digit mobile number"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value.replace(
                        /[^0-9+]/g,
                        ""
                      ),
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Full Address">
                <textarea
                  value={form.address}
                  placeholder="House number, street, area and landmark"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      address: event.target.value,
                    }))
                  }
                  style={{
                    ...inputStyle,
                    minHeight: "95px",
                    resize: "vertical",
                  }}
                />
              </FormField>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <FormField label="City">
                  <input
                    value={form.city}
                    placeholder="City"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        city: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </FormField>

                <FormField label="State">
                  <input
                    value={form.state}
                    placeholder="State"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        state: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </FormField>
              </div>

              <FormField label="Pincode">
                <input
                  value={form.pincode}
                  maxLength={6}
                  placeholder="6-digit pincode"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pincode: event.target.value.replace(
                        /\D/g,
                        ""
                      ),
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <FormField label="Total Orders">
                  <input
                    type="number"
                    min="0"
                    value={form.totalOrders}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        totalOrders: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </FormField>

                <FormField label="Total Spent">
                  <input
                    type="number"
                    min="0"
                    value={form.totalSpent}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        totalSpent: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </FormField>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  color: "#B91C1C",
                  fontWeight: 700,
                  marginBottom: "22px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.isBlocked}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isBlocked: event.target.checked,
                    }))
                  }
                />

                Block this customer
              </label>

              <button
                type="submit"
                disabled={saving}
                style={{
                  width: "100%",
                  background:
                    "linear-gradient(135deg, #03153F, #0A2E73)",
                  color: "#FFFFFF",
                  border: "1px solid rgba(212,175,55,0.85)",
                  padding: "14px",
                  borderRadius: "10px",
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                  fontWeight: 800,
                  fontSize: "16px",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : editingId === null
                    ? "Add Customer"
                    : "Update Customer"}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    width: "100%",
                    marginTop: "10px",
                    background: "#FFFFFF",
                    color: "#6B7280",
                    border: "1px solid #D1D5DB",
                    padding: "13px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Cancel Editing
                </button>
              )}
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
                  Store Customers
                </h2>

                <p
                  style={{
                    color: "#666",
                    margin: 0,
                  }}
                >
                  {filteredCustomers.length} customers found
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
                  placeholder="Search customers..."
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
                    width: "165px",
                  }}
                >
                  <option value="All">All Customers</option>
                  <option value="Active">Active</option>
                  <option value="Blocked">Blocked</option>
                  <option value="High Value">
                    High Value
                  </option>
                </select>

                <button
                  type="button"
                  onClick={loadCustomers}
                  style={{
                    background:
                      "linear-gradient(135deg, #D4AF37, #F0D267)",
                    color: "#03153F",
                    border:
                      "1px solid rgba(10,46,115,0.18)",
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
                Loading Customers...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div style={messageStyle}>
                No customers were found.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: "18px",
                }}
              >
                {filteredCustomers.map((customer) => (
                  <article
                    key={customer.id}
                    className="customer-card"
                    style={{
                      border: customer.is_blocked
                        ? "1px solid rgba(239,68,68,0.38)"
                        : "1px solid rgba(212,175,55,0.22)",
                      borderRadius: "18px",
                      padding: "20px",
                      background: customer.is_blocked
                        ? "linear-gradient(180deg,#FFF7F7,#FFFFFF)"
                        : "linear-gradient(180deg,#FFFFFF,#F8FAFD)",
                      boxShadow:
                        "0 8px 24px rgba(3,21,63,0.07)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems: "flex-start",
                        gap: "14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "13px",
                          alignItems: "center",
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: "52px",
                            height: "52px",
                            flexShrink: 0,
                            borderRadius: "50%",
                            background:
                              "linear-gradient(135deg, #0A2E73, #164CA8)",
                            color: "#FFFFFF",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontSize: "21px",
                            fontWeight: 800,
                          }}
                        >
                          {customer.full_name
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div
                          style={{
                            minWidth: 0,
                          }}
                        >
                          <h3
                            style={{
                              color: "#0A2E73",
                              margin: "0 0 4px",
                              fontSize: "20px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {customer.full_name}
                          </h3>

                          <p
                            style={{
                              color: "#777",
                              fontSize: "13px",
                              margin: 0,
                            }}
                          >
                            Customer #{customer.id}
                          </p>
                        </div>
                      </div>

                      <span
                        style={{
                          background: customer.is_blocked
                            ? "#FEE2E2"
                            : "#DCFCE7",
                          color: customer.is_blocked
                            ? "#B91C1C"
                            : "#166534",
                          padding: "7px 10px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 800,
                        }}
                      >
                        {customer.is_blocked
                          ? "Blocked"
                          : "Active"}
                      </span>
                    </div>

                    <div
                      style={{
                        background: "#F8FAFC",
                        borderRadius: "11px",
                        padding: "14px",
                        marginTop: "16px",
                        display: "grid",
                        gap: "8px",
                      }}
                    >
                      <CustomerDetail
                        icon="✉️"
                        value={
                          customer.email ||
                          "Email not added"
                        }
                      />

                      <CustomerDetail
                        icon="📞"
                        value={
                          customer.phone ||
                          "Phone not added"
                        }
                      />

                      <CustomerDetail
                        icon="📍"
                        value={
                          [
                            customer.city,
                            customer.state,
                            customer.pincode,
                          ]
                            .filter(Boolean)
                            .join(", ") ||
                          "Address not added"
                        }
                      />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px",
                        marginTop: "15px",
                      }}
                    >
                      <div style={statBoxStyle}>
                        <p style={statLabelStyle}>
                          Total Orders
                        </p>

                        <strong style={statValueStyle}>
                          {customer.total_orders || 0}
                        </strong>
                      </div>

                      <div style={statBoxStyle}>
                        <p style={statLabelStyle}>
                          Total Spent
                        </p>

                        <strong style={statValueStyle}>
                          ₹
                          {Number(
                            customer.total_spent || 0
                          ).toLocaleString("en-IN")}
                        </strong>
                      </div>
                    </div>

                    {Number(customer.total_spent || 0) >=
                      10000 && (
                      <div
                        style={{
                          marginTop: "12px",
                          background: "#FEF3C7",
                          color: "#92400E",
                          padding: "9px 12px",
                          borderRadius: "9px",
                          fontWeight: 800,
                          fontSize: "13px",
                          textAlign: "center",
                        }}
                      >
                        👑 High Value Customer
                      </div>
                    )}

                    <p
                      style={{
                        color: "#888",
                        fontSize: "12px",
                        margin: "13px 0 0",
                      }}
                    >
                      Joined on{" "}
                      {new Date(
                        customer.created_at
                      ).toLocaleDateString()}
                    </p>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "9px",
                        marginTop: "16px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          startEditing(customer)
                        }
                        style={{
                          background:
                            "linear-gradient(135deg, #03153F, #0A2E73)",
                          color: "#FFFFFF",
                          border:
                            "1px solid rgba(212,175,55,0.75)",
                          padding: "10px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleBlocked(customer)
                        }
                        style={{
                          background: customer.is_blocked
                            ? "#16A34A"
                            : "#F59E0B",
                          color: "#FFFFFF",
                          border: "none",
                          padding: "10px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        {customer.is_blocked
                          ? "Unblock"
                          : "Block"}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        deleteCustomer(customer)
                      }
                      style={{
                        width: "100%",
                        marginTop: "9px",
                        background: "#FFFFFF",
                        color: "#DC2626",
                        border: "1px solid #FCA5A5",
                        padding: "10px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      Delete Customer
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <style jsx global>{`
        .customer-summary-card {
          position: relative;
          isolation: isolate;
          min-height: 140px;
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
          animation: customerStatRise 0.45s ease both;
        }

        .customer-summary-card:nth-child(2),
        .customer-summary-card:nth-child(5) {
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.99),
            rgba(22, 46, 102, 0.98),
            rgba(103, 79, 16, 0.9)
          );
        }

        .customer-summary-card:nth-child(3),
        .customer-summary-card:nth-child(6) {
          background: linear-gradient(
            135deg,
            rgba(5, 25, 74, 0.99),
            rgba(8, 37, 96, 0.98)
          );
        }

        .customer-summary-card::before {
          content: "";
          position: absolute;
          z-index: -1;
          top: -40%;
          right: -15%;
          width: 125px;
          height: 125px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(212, 175, 55, 0.34),
            rgba(212, 175, 55, 0)
          );
        }

        .customer-summary-card::after {
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
          animation: customerStatShine 5.2s ease-in-out infinite;
          pointer-events: none;
        }

        .customer-summary-card:hover {
          transform: translateY(-2px) scale(1.004);
          border-color: rgba(212, 175, 55, 0.42);
          box-shadow:
            0 16px 32px rgba(3, 21, 63, 0.22),
            0 0 0 1px rgba(212, 175, 55, 0.1);
        }

        .customer-summary-icon {
          position: relative;
          z-index: 2;
          color: #D4AF37;
          font-size: 30px;
          filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.18));
        }

        .customer-summary-card p {
          position: relative;
          z-index: 2;
          margin: 10px 0 5px;
          color: rgba(212, 175, 55, 0.94);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.45px;
          text-transform: uppercase;
        }

        .customer-summary-card h2 {
          position: relative;
          z-index: 2;
          margin: 0;
          color: #FFFFFF;
          font-size: 29px;
          font-weight: 950;
          letter-spacing: -0.5px;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
        }

        .customer-summary-card:nth-child(5) h2 {
          color: #F6D676;
        }

        .customer-card {
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            border-color 0.2s ease;
        }

        .customer-card:hover {
          transform: translateY(-2px);
          border-color: rgba(212, 175, 55, 0.42) !important;
          box-shadow: 0 14px 32px rgba(3, 21, 63, 0.11) !important;
        }

        button {
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            filter 0.18s ease;
        }

        button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.04);
        }

        @keyframes customerStatRise {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes customerStatShine {
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

        @media (max-width: 1000px) {
          .customers-layout {
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

const statBoxStyle: CSSProperties = {
  background: "#F8F4EC",
  borderRadius: "10px",
  padding: "13px",
  textAlign: "center",
};

const statLabelStyle: CSSProperties = {
  color: "#777",
  fontSize: "12px",
  margin: "0 0 5px",
};

const statValueStyle: CSSProperties = {
  color: "#0A2E73",
  fontSize: "19px",
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
    <div className="customer-summary-card">
      <div className="customer-summary-icon">{icon}</div>

      <p>{title}</p>

      <h2>{value}</h2>
    </div>
  );
}

function CustomerDetail({
  icon,
  value,
}: {
  icon: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        alignItems: "flex-start",
        color: "#555",
        fontSize: "14px",
        lineHeight: 1.5,
        overflowWrap: "anywhere",
      }}
    >
      <span>{icon}</span>
      <span>{value}</span>
    </div>
  );
}