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
  whatsapp_opt_in: boolean;
  marketing_tags: string[] | null;
  last_marketing_message_at: string | null;
  marketing_consent_at: string | null;
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
  whatsappOptIn: boolean;
  marketingTags: string;
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
  whatsappOptIn: false,
  marketingTags: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<CustomerForm>(emptyForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] =
    useState<number[]>([]);
  const [marketingFilter, setMarketingFilter] =
    useState("All");
  const [offerMessage, setOfferMessage] = useState(
    "NEW CITY STYLE special offer is now available. Visit our store for the latest family fashion collection."
  );
  const [sendingCustomerId, setSendingCustomerId] =
    useState<number | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [customersPerPage, setCustomersPerPage] = useState(20);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

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
      whatsappOptIn: customer.whatsapp_opt_in === true,
      marketingTags: (customer.marketing_tags || []).join(", "),
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
      whatsapp_opt_in: form.whatsappOptIn,
      marketing_tags: form.marketingTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      marketing_consent_at: form.whatsappOptIn
        ? new Date().toISOString()
        : null,
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

      const matchesMarketing =
        marketingFilter === "All" ||
        (marketingFilter === "Opted In" &&
          customer.whatsapp_opt_in === true) ||
        (marketingFilter === "Not Opted In" &&
          customer.whatsapp_opt_in !== true) ||
        (marketingFilter === "Has Phone" &&
          Boolean(customer.phone));

      return matchesSearch && matchesStatus && matchesMarketing;
    });
  }, [customers, search, statusFilter, marketingFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / customersPerPage)
  );

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * customersPerPage;
    return filteredCustomers.slice(
      startIndex,
      startIndex + customersPerPage
    );
  }, [filteredCustomers, currentPage, customersPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, marketingFilter, customersPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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

  const optedInCustomers = customers.filter(
    (customer) =>
      customer.whatsapp_opt_in === true &&
      Boolean(customer.phone) &&
      !customer.is_blocked
  ).length;

  const selectedCustomers = filteredCustomers.filter(
    (customer) =>
      selectedCustomerIds.includes(customer.id)
  );

  function toggleCustomerSelection(customerId: number) {
    setSelectedCustomerIds((current) =>
      current.includes(customerId)
        ? current.filter((id) => id !== customerId)
        : [...current, customerId]
    );
  }

  function selectAllVisibleOptedIn() {
    setSelectedCustomerIds(
      filteredCustomers
        .filter(
          (customer) =>
            customer.whatsapp_opt_in === true &&
            Boolean(customer.phone) &&
            !customer.is_blocked
        )
        .map((customer) => customer.id)
    );
  }

  function clearMarketingSelection() {
    setSelectedCustomerIds([]);
  }

  async function sendOfferForCustomer(customer: Customer) {
    if (sendingCustomerId !== null || bulkSending) return false;

    if (!customer.whatsapp_opt_in) {
      alert("This customer has not agreed to receive WhatsApp offers.");
      return false;
    }

    if (customer.is_blocked) {
      alert("This customer is blocked.");
      return false;
    }

    const digits = (customer.phone || "").replace(/\D/g, "");
    const phone = digits.length === 10 ? `91${digits}` : digits;

    if (phone.length < 10 || phone.length > 15) {
      alert("This customer does not have a valid mobile number.");
      return false;
    }

    const cleanOfferMessage = offerMessage.trim();

    if (!cleanOfferMessage) {
      alert("Write the WhatsApp offer message first.");
      return false;
    }

    setSendingCustomerId(customer.id);

    try {
      const response = await fetch("/api/whatsapp/offer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: phone,
          customerName: customer.full_name,
          offerMessage: cleanOfferMessage,
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        stage?: string;
        errorDetails?: string | null;
      };

      if (!response.ok || result.success !== true) {
        const stageText = result.stage ? ` (${result.stage})` : "";
        const detailText = result.errorDetails
          ? ` - ${result.errorDetails}`
          : "";

        throw new Error(
          `${
            result.error || "WhatsApp offer could not be sent."
          }${stageText}${detailText}`
        );
      }

      const sentAt = new Date().toISOString();

      const { error } = await supabase
        .from("customers")
        .update({
          last_marketing_message_at: sentAt,
        })
        .eq("id", customer.id);

      if (!error) {
        setCustomers((current) =>
          current.map((item) =>
            item.id === customer.id
              ? {
                  ...item,
                  last_marketing_message_at: sentAt,
                }
              : item
          )
        );
      }

      alert(`WhatsApp offer sent directly to ${customer.full_name}.`);
      return true;
    } catch (error) {
      console.error("Unable to send WhatsApp offer:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Unable to send WhatsApp offer."
      );
      return false;
    } finally {
      setSendingCustomerId(null);
    }
  }

  async function sendSelectedOffers() {
    if (bulkSending || sendingCustomerId !== null) return;

    const eligibleCustomers = selectedCustomers.filter(
      (customer) =>
        customer.whatsapp_opt_in === true &&
        Boolean(customer.phone) &&
        !customer.is_blocked
    );

    if (eligibleCustomers.length === 0) {
      alert("Select at least one opted-in customer with a mobile number.");
      return;
    }

    const cleanOfferMessage = offerMessage.trim();

    if (!cleanOfferMessage) {
      alert("Write the WhatsApp offer message first.");
      return;
    }

    const confirmed = window.confirm(
      `Send this offer directly to ${eligibleCustomers.length} selected customer(s)?`
    );

    if (!confirmed) return;

    setBulkSending(true);

    let sentCount = 0;
    let failedCount = 0;
    const successfulIds: number[] = [];

    try {
      for (let index = 0; index < eligibleCustomers.length; index += 1) {
        const customer = eligibleCustomers[index];
        setBulkProgress(
          `Sending ${index + 1} of ${eligibleCustomers.length}: ${customer.full_name}`
        );

        const digits = (customer.phone || "").replace(/\D/g, "");
        const phone = digits.length === 10 ? `91${digits}` : digits;

        try {
          const response = await fetch("/api/whatsapp/offer", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: phone,
              customerName: customer.full_name,
              offerMessage: cleanOfferMessage,
            }),
          });

          const result = (await response.json()) as {
            success?: boolean;
            error?: string;
          };

          if (!response.ok || result.success !== true) {
            throw new Error(
              result.error || "WhatsApp offer could not be sent."
            );
          }

          const sentAt = new Date().toISOString();

          await supabase
            .from("customers")
            .update({
              last_marketing_message_at: sentAt,
            })
            .eq("id", customer.id);

          setCustomers((current) =>
            current.map((item) =>
              item.id === customer.id
                ? {
                    ...item,
                    last_marketing_message_at: sentAt,
                  }
                : item
            )
          );

          successfulIds.push(customer.id);
          sentCount += 1;
        } catch (error) {
          console.error(
            `Unable to send offer to ${customer.full_name}:`,
            error
          );
          failedCount += 1;
        }
      }

      setSelectedCustomerIds((current) =>
        current.filter((id) => !successfulIds.includes(id))
      );

      alert(
        `WhatsApp offers completed. Sent: ${sentCount}. Failed: ${failedCount}.`
      );
    } finally {
      setBulkSending(false);
      setBulkProgress("");
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

          <SummaryCard
            icon="💬"
            title="WhatsApp Opt-ins"
            value={optedInCustomers}
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

              <FormField label="Marketing Tags">
                <input
                  value={form.marketingTags}
                  placeholder="VIP, Men, Women, Kids, Sarees"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      marketingTags: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  color: "#166534",
                  fontWeight: 700,
                  marginBottom: "16px",
                  cursor: "pointer",
                  padding: "12px",
                  border: "1px solid #BBF7D0",
                  borderRadius: "10px",
                  background: "#F0FDF4",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.whatsappOptIn}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      whatsappOptIn: event.target.checked,
                    }))
                  }
                />
                <span>
                  Customer agreed to receive WhatsApp offers
                  <small
                    style={{
                      display: "block",
                      marginTop: "4px",
                      color: "#4B5563",
                      fontWeight: 500,
                    }}
                  >
                    Enable only after asking the customer.
                  </small>
                </span>
              </label>

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
              className="customer-marketing-panel"
              style={{
                marginBottom: "22px",
                padding: "18px",
                border: "1px solid rgba(212,175,55,0.38)",
                borderRadius: "15px",
                background:
                  "linear-gradient(135deg,#FFF9E8,#FFFFFF)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "14px",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div>
                  <p
                    style={{
                      margin: "0 0 5px",
                      color: "#B28A10",
                      fontWeight: 900,
                      fontSize: "12px",
                    }}
                  >
                    CUSTOMER MARKETING
                  </p>
                  <h3 style={{ margin: 0, color: "#0A2E73" }}>
                    WhatsApp Offer List
                  </h3>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={selectAllVisibleOptedIn}
                    className="marketing-secondary-button"
                  >
                    Select Eligible
                  </button>
                  <button
                    type="button"
                    onClick={clearMarketingSelection}
                    className="marketing-secondary-button"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendSelectedOffers()}
                    className="marketing-primary-button"
                    disabled={bulkSending || sendingCustomerId !== null}
                  >
                    {bulkSending
                      ? "Sending..."
                      : `Send Selected (${selectedCustomerIds.length})`}
                  </button>
                </div>
              </div>

              <textarea
                value={offerMessage}
                onChange={(event) =>
                  setOfferMessage(event.target.value)
                }
                placeholder="Write the offer message..."
                style={{
                  ...inputStyle,
                  minHeight: "95px",
                  marginTop: "14px",
                  resize: "vertical",
                }}
              />

              <p
                style={{
                  margin: "9px 0 0",
                  color: "#6B7280",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                Offers are sent directly through WhatsApp Cloud API.
                Only customers with recorded consent should be selected.
              </p>

              {bulkProgress && (
                <p
                  style={{
                    margin: "9px 0 0",
                    color: "#0A2E73",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  {bulkProgress}
                </p>
              )}
            </div>

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

                <select
                  value={marketingFilter}
                  onChange={(event) =>
                    setMarketingFilter(event.target.value)
                  }
                  style={{
                    ...inputStyle,
                    width: "170px",
                  }}
                >
                  <option value="All">All Consent</option>
                  <option value="Opted In">WhatsApp Opted In</option>
                  <option value="Not Opted In">Not Opted In</option>
                  <option value="Has Phone">Has Mobile</option>
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
              <>
                <div
                  className="customer-table-wrap"
                  style={{
                    width: "100%",
                    overflowX: "auto",
                    border: "1px solid #E5E7EB",
                    borderRadius: "14px",
                    background: "#FFFFFF",
                  }}
                >
                  <table
                    className="customer-table"
                    style={{
                      width: "100%",
                      minWidth: "1080px",
                      borderCollapse: "collapse",
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={tableHeadStyle}>Select</th>
                        <th style={tableHeadStyle}>Customer</th>
                        <th style={tableHeadStyle}>Mobile</th>
                        <th style={tableHeadStyle}>Orders</th>
                        <th style={tableHeadStyle}>Total Spent</th>
                        <th style={tableHeadStyle}>WhatsApp</th>
                        <th style={tableHeadStyle}>Status</th>
                        <th
                          style={{
                            ...tableHeadStyle,
                            textAlign: "right",
                          }}
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedCustomers.map((customer) => {
                        const isEligible =
                          customer.whatsapp_opt_in === true &&
                          Boolean(customer.phone) &&
                          !customer.is_blocked;

                        return (
                          <tr
                            key={customer.id}
                            className="customer-row"
                            style={{
                              background: customer.is_blocked
                                ? "#FFF8F8"
                                : "#FFFFFF",
                            }}
                          >
                            <td style={tableCellStyle}>
                              <input
                                type="checkbox"
                                checked={selectedCustomerIds.includes(
                                  customer.id
                                )}
                                disabled={!isEligible}
                                onChange={() =>
                                  toggleCustomerSelection(customer.id)
                                }
                                aria-label={`Select ${customer.full_name}`}
                              />
                            </td>

                            <td style={tableCellStyle}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  minWidth: 0,
                                }}
                              >
                                <div
                                  style={{
                                    width: "36px",
                                    height: "36px",
                                    flexShrink: 0,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background:
                                      "linear-gradient(135deg, #0A2E73, #164CA8)",
                                    color: "#FFFFFF",
                                    fontWeight: 900,
                                  }}
                                >
                                  {customer.full_name
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <strong
                                    title={customer.full_name}
                                    style={{
                                      display: "block",
                                      color: "#0A2E73",
                                      fontSize: "14px",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      maxWidth: "210px",
                                    }}
                                  >
                                    {customer.full_name}
                                  </strong>
                                  <span
                                    style={{
                                      color: "#6B7280",
                                      fontSize: "11px",
                                    }}
                                  >
                                    Customer #{customer.id}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td style={tableCellStyle}>
                              <span
                                style={{
                                  color: "#374151",
                                  fontWeight: 700,
                                }}
                              >
                                {customer.phone || "Not added"}
                              </span>
                            </td>

                            <td style={tableCellStyle}>
                              <strong style={{ color: "#0A2E73" }}>
                                {customer.total_orders || 0}
                              </strong>
                            </td>

                            <td style={tableCellStyle}>
                              <strong style={{ color: "#0A2E73" }}>
                                ₹
                                {Number(
                                  customer.total_spent || 0
                                ).toLocaleString("en-IN")}
                              </strong>
                              {Number(customer.total_spent || 0) >=
                                10000 && (
                                <span
                                  style={{
                                    display: "block",
                                    marginTop: "2px",
                                    color: "#92400E",
                                    fontSize: "10px",
                                    fontWeight: 800,
                                  }}
                                >
                                  👑 High Value
                                </span>
                              )}
                            </td>

                            <td style={tableCellStyle}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  padding: "5px 8px",
                                  borderRadius: "999px",
                                  background: customer.whatsapp_opt_in
                                    ? "#DCFCE7"
                                    : "#F3F4F6",
                                  color: customer.whatsapp_opt_in
                                    ? "#166534"
                                    : "#6B7280",
                                  fontSize: "11px",
                                  fontWeight: 800,
                                }}
                              >
                                {customer.whatsapp_opt_in
                                  ? "Allowed"
                                  : "Not allowed"}
                              </span>
                            </td>

                            <td style={tableCellStyle}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  padding: "5px 9px",
                                  borderRadius: "999px",
                                  background: customer.is_blocked
                                    ? "#FEE2E2"
                                    : "#DCFCE7",
                                  color: customer.is_blocked
                                    ? "#B91C1C"
                                    : "#166534",
                                  fontSize: "11px",
                                  fontWeight: 800,
                                }}
                              >
                                {customer.is_blocked
                                  ? "Blocked"
                                  : "Active"}
                              </span>
                            </td>

                            <td
                              style={{
                                ...tableCellStyle,
                                textAlign: "right",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "flex-end",
                                  gap: "6px",
                                  flexWrap: "nowrap",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setViewingCustomer(customer)
                                  }
                                  className="compact-action-button view"
                                >
                                  View
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    startEditing(customer)
                                  }
                                  className="compact-action-button edit"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void sendOfferForCustomer(customer)
                                  }
                                  disabled={
                                    !isEligible ||
                                    sendingCustomerId !== null ||
                                    bulkSending
                                  }
                                  className="compact-action-button whatsapp"
                                >
                                  {sendingCustomerId === customer.id
                                    ? "Sending..."
                                    : "WhatsApp"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleBlocked(customer)
                                  }
                                  className="compact-action-button block"
                                >
                                  {customer.is_blocked
                                    ? "Unblock"
                                    : "Block"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteCustomer(customer)
                                  }
                                  className="compact-action-button delete"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div
                  className="customer-pagination"
                  style={{
                    marginTop: "18px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "14px",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "9px",
                      color: "#4B5563",
                      fontSize: "13px",
                      fontWeight: 700,
                    }}
                  >
                    <span>Customers per page</span>
                    <select
                      value={customersPerPage}
                      onChange={(event) =>
                        setCustomersPerPage(
                          Number(event.target.value)
                        )
                      }
                      style={{
                        ...inputStyle,
                        width: "78px",
                        padding: "8px 9px",
                      }}
                    >
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  <div
                    style={{
                      color: "#6B7280",
                      fontSize: "13px",
                      fontWeight: 700,
                    }}
                  >
                    Showing{" "}
                    {(currentPage - 1) * customersPerPage + 1}–
                    {Math.min(
                      currentPage * customersPerPage,
                      filteredCustomers.length
                    )}{" "}
                    of {filteredCustomers.length}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                    }}
                  >
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() =>
                        setCurrentPage((page) =>
                          Math.max(1, page - 1)
                        )
                      }
                      className="pagination-button"
                    >
                      Previous
                    </button>

                    {Array.from(
                      { length: totalPages },
                      (_, index) => index + 1
                    )
                      .filter(
                        (page) =>
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                      )
                      .map((page, index, visiblePages) => {
                        const previousPage =
                          visiblePages[index - 1];

                        return (
                          <span
                            key={page}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "7px",
                            }}
                          >
                            {previousPage &&
                              page - previousPage > 1 && (
                                <span
                                  style={{
                                    color: "#9CA3AF",
                                    fontWeight: 800,
                                  }}
                                >
                                  …
                                </span>
                              )}
                            <button
                              type="button"
                              onClick={() =>
                                setCurrentPage(page)
                              }
                              className={`pagination-button ${
                                currentPage === page
                                  ? "active"
                                  : ""
                              }`}
                            >
                              {page}
                            </button>
                          </span>
                        );
                      })}

                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() =>
                        setCurrentPage((page) =>
                          Math.min(totalPages, page + 1)
                        )
                      }
                      className="pagination-button"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {viewingCustomer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Customer details"
          className="customer-modal-backdrop"
          onClick={() => setViewingCustomer(null)}
        >
          <div
            className="customer-detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                marginBottom: "18px",
              }}
            >
              <div>
                <p
                  style={{
                    margin: "0 0 5px",
                    color: "#D4AF37",
                    fontSize: "12px",
                    fontWeight: 900,
                    letterSpacing: "0.7px",
                  }}
                >
                  CUSTOMER DETAILS
                </p>
                <h2
                  style={{
                    margin: 0,
                    color: "#0A2E73",
                  }}
                >
                  {viewingCustomer.full_name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                className="modal-close-button"
                aria-label="Close customer details"
              >
                ×
              </button>
            </div>

            <div className="customer-detail-grid">
              <CustomerDetailBox
                label="Customer ID"
                value={`#${viewingCustomer.id}`}
              />
              <CustomerDetailBox
                label="Mobile"
                value={viewingCustomer.phone || "Not added"}
              />
              <CustomerDetailBox
                label="Email"
                value={viewingCustomer.email || "Not added"}
              />
              <CustomerDetailBox
                label="Total Orders"
                value={String(viewingCustomer.total_orders || 0)}
              />
              <CustomerDetailBox
                label="Total Spent"
                value={`₹${Number(
                  viewingCustomer.total_spent || 0
                ).toLocaleString("en-IN")}`}
              />
              <CustomerDetailBox
                label="Status"
                value={
                  viewingCustomer.is_blocked
                    ? "Blocked"
                    : "Active"
                }
              />
              <CustomerDetailBox
                label="WhatsApp Consent"
                value={
                  viewingCustomer.whatsapp_opt_in
                    ? "Allowed"
                    : "Not allowed"
                }
              />
              <CustomerDetailBox
                label="Joined"
                value={new Date(
                  viewingCustomer.created_at
                ).toLocaleDateString("en-IN")}
              />
            </div>

            <div
              style={{
                marginTop: "14px",
                padding: "14px",
                borderRadius: "11px",
                background: "#F8FAFC",
              }}
            >
              <strong
                style={{
                  display: "block",
                  marginBottom: "5px",
                  color: "#0A2E73",
                }}
              >
                Address
              </strong>
              <span
                style={{
                  color: "#4B5563",
                  lineHeight: 1.6,
                }}
              >
                {[
                  viewingCustomer.address,
                  viewingCustomer.city,
                  viewingCustomer.state,
                  viewingCustomer.pincode,
                ]
                  .filter(Boolean)
                  .join(", ") || "Address not added"}
              </span>
            </div>

            {(viewingCustomer.marketing_tags || []).length >
              0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "7px",
                  marginTop: "14px",
                }}
              >
                {(viewingCustomer.marketing_tags || []).map(
                  (tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: "6px 9px",
                        borderRadius: "999px",
                        background: "#EEF2FF",
                        color: "#3730A3",
                        fontSize: "11px",
                        fontWeight: 800,
                      }}
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "9px",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  startEditing(viewingCustomer);
                  setViewingCustomer(null);
                }}
                className="modal-edit-button"
              >
                Edit Customer
              </button>
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                className="modal-done-button"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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

        .marketing-primary-button,
        .marketing-secondary-button {
          min-height: 40px;
          padding: 0 13px;
          border-radius: 9px;
          font-weight: 800;
          cursor: pointer;
        }

        .marketing-primary-button {
          border: 1px solid #D4AF37;
          background: #0A2E73;
          color: #FFFFFF;
        }

        .marketing-secondary-button {
          border: 1px solid #D1D5DB;
          background: #FFFFFF;
          color: #0A2E73;
        }

        .marketing-primary-button:disabled,
        .marketing-secondary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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

        .customer-table th,
        .customer-table td {
          white-space: nowrap;
        }

        .customer-row {
          border-bottom: 1px solid #EEF2F7;
          transition:
            background 0.18s ease,
            box-shadow 0.18s ease;
        }

        .customer-row:hover {
          background: #F8FAFC !important;
          box-shadow: inset 4px 0 0 #D4AF37;
        }

        .compact-action-button {
          min-height: 32px;
          padding: 0 9px;
          border-radius: 7px;
          border: 1px solid transparent;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .compact-action-button.view {
          background: #F8F4EC;
          color: #7C5C00;
          border-color: #E8D492;
        }

        .compact-action-button.edit {
          background: #0A2E73;
          color: #FFFFFF;
          border-color: #D4AF37;
        }

        .compact-action-button.whatsapp {
          background: #16A34A;
          color: #FFFFFF;
        }

        .compact-action-button.block {
          background: #F59E0B;
          color: #FFFFFF;
        }

        .compact-action-button.delete {
          background: #FFFFFF;
          color: #DC2626;
          border-color: #FCA5A5;
        }

        .compact-action-button:disabled {
          background: #E5E7EB;
          color: #9CA3AF;
          cursor: not-allowed;
        }

        .pagination-button {
          min-width: 36px;
          min-height: 36px;
          padding: 0 11px;
          border: 1px solid #D1D5DB;
          border-radius: 8px;
          background: #FFFFFF;
          color: #0A2E73;
          font-weight: 800;
          cursor: pointer;
        }

        .pagination-button.active {
          background: #0A2E73;
          color: #FFFFFF;
          border-color: #D4AF37;
        }

        .pagination-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .customer-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(3, 21, 63, 0.62);
          backdrop-filter: blur(4px);
        }

        .customer-detail-modal {
          width: min(680px, 100%);
          max-height: 88vh;
          overflow-y: auto;
          padding: 24px;
          border: 1px solid rgba(212, 175, 55, 0.55);
          border-radius: 18px;
          background: #FFFFFF;
          box-shadow: 0 24px 70px rgba(3, 21, 63, 0.3);
        }

        .customer-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 11px;
        }

        .modal-close-button {
          width: 36px;
          height: 36px;
          border: 1px solid #E5E7EB;
          border-radius: 50%;
          background: #FFFFFF;
          color: #0A2E73;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
        }

        .modal-edit-button,
        .modal-done-button {
          min-height: 40px;
          padding: 0 15px;
          border-radius: 9px;
          font-weight: 800;
          cursor: pointer;
        }

        .modal-edit-button {
          border: 1px solid #D4AF37;
          background: #0A2E73;
          color: #FFFFFF;
        }

        .modal-done-button {
          border: 1px solid #D1D5DB;
          background: #FFFFFF;
          color: #0A2E73;
        }

        @media (max-width: 1000px) {
          .customers-layout {
            grid-template-columns: 1fr !important;
          }

          .customer-detail-grid {
            grid-template-columns: 1fr;
          }

          .customer-pagination {
            justify-content: center !important;
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

const tableHeadStyle: CSSProperties = {
  padding: "12px 10px",
  background: "#F8F4EC",
  color: "#0A2E73",
  borderBottom: "1px solid #E5E7EB",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.35px",
  textTransform: "uppercase",
};

const tableCellStyle: CSSProperties = {
  padding: "10px",
  borderBottom: "1px solid #EEF2F7",
  color: "#374151",
  fontSize: "13px",
  verticalAlign: "middle",
};

function CustomerDetailBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "12px",
        border: "1px solid #E5E7EB",
        borderRadius: "10px",
        background: "#FFFFFF",
      }}
    >
      <span
        style={{
          display: "block",
          marginBottom: "4px",
          color: "#6B7280",
          fontSize: "11px",
          fontWeight: 800,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <strong
        style={{
          color: "#0A2E73",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

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
