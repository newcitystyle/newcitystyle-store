"use client";

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RequestStatus =
  | "WAITING"
  | "MATCH_FOUND"
  | "CUSTOMER_CONTACTED"
  | "RESERVED"
  | "SOLD"
  | "NOT_INTERESTED"
  | "CANCELLED";

type CustomerRequest = {
  id: string;
  customer_id: number | null;
  customer_name: string;
  phone: string;
  category: string;
  product_name: string;
  brand: string | null;
  size: string | null;
  colour: string | null;
  min_budget: number | null;
  max_budget: number | null;
  quantity: number;
  notes: string | null;
  requested_at: string;
  required_before: string | null;
  status: RequestStatus;
  matched_product_id: string | null;
  matched_at: string | null;
  contacted_at: string | null;
  completed_at: string | null;
  created_source: string;
  created_at: string;
  updated_at: string;
};

type RequestForm = {
  customerName: string;
  phone: string;
  category: string;
  productName: string;
  brand: string;
  size: string;
  colour: string;
  minBudget: string;
  maxBudget: string;
  quantity: string;
  notes: string;
  requiredBefore: string;
  status: RequestStatus;
};

const emptyForm: RequestForm = {
  customerName: "",
  phone: "",
  category: "Men",
  productName: "",
  brand: "",
  size: "",
  colour: "",
  minBudget: "",
  maxBudget: "",
  quantity: "1",
  notes: "",
  requiredBefore: "",
  status: "WAITING",
};

const statuses: RequestStatus[] = [
  "WAITING",
  "MATCH_FOUND",
  "CUSTOMER_CONTACTED",
  "RESERVED",
  "SOLD",
  "NOT_INTERESTED",
  "CANCELLED",
];

const categories = [
  "Men",
  "Women",
  "Kids",
  "Sarees",
  "Shirts",
  "Jeans",
  "T-Shirts",
  "Footwear",
  "Other",
];

function getWaitingDays(dateValue: string) {
  const date = new Date(dateValue).getTime();

  if (!Number.isFinite(date)) return 0;

  return Math.max(
    0,
    Math.floor((Date.now() - date) / 86_400_000)
  );
}

function formatStatus(status: RequestStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusStyle(status: RequestStatus): CSSProperties {
  switch (status) {
    case "MATCH_FOUND":
      return {
        background: "#DCFCE7",
        color: "#166534",
        border: "1px solid #86EFAC",
      };

    case "CUSTOMER_CONTACTED":
      return {
        background: "#DBEAFE",
        color: "#1D4ED8",
        border: "1px solid #93C5FD",
      };

    case "RESERVED":
      return {
        background: "#FEF3C7",
        color: "#92400E",
        border: "1px solid #FCD34D",
      };

    case "SOLD":
      return {
        background: "#D1FAE5",
        color: "#065F46",
        border: "1px solid #6EE7B7",
      };

    case "NOT_INTERESTED":
    case "CANCELLED":
      return {
        background: "#F3F4F6",
        color: "#4B5563",
        border: "1px solid #D1D5DB",
      };

    default:
      return {
        background: "#FFF7ED",
        color: "#C2410C",
        border: "1px solid #FDBA74",
      };
  }
}

export default function CustomerRequestsPage() {
  const searchParams = useSearchParams();

  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [form, setForm] = useState<RequestForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "ACTIVE"
  );
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [ageFilter, setAgeFilter] = useState("ALL");
  const [whatsAppSendingRequestId, setWhatsAppSendingRequestId] =
    useState<string | null>(null);

  useEffect(() => {
    void loadRequests();

    const channel = supabase
      .channel("ncs-customer-product-requests-page")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_product_requests",
        },
        () => void loadRequests()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function loadRequests() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customer_product_requests")
      .select("*")
      .order("requested_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(
        `Unable to load customer requests: ${error.message}`
      );
      setLoading(false);
      return;
    }

    setRequests((data as CustomerRequest[]) || []);
    setLoading(false);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setSaving(false);
  }

  function startEditing(request: CustomerRequest) {
    setEditingId(request.id);

    setForm({
      customerName: request.customer_name,
      phone: request.phone,
      category: request.category || "Other",
      productName: request.product_name,
      brand: request.brand || "",
      size: request.size || "",
      colour: request.colour || "",
      minBudget:
        request.min_budget === null
          ? ""
          : String(request.min_budget),
      maxBudget:
        request.max_budget === null
          ? ""
          : String(request.max_budget),
      quantity: String(request.quantity || 1),
      notes: request.notes || "",
      requiredBefore: request.required_before
        ? request.required_before.slice(0, 10)
        : "",
      status: request.status,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveRequest(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const customerName = form.customerName.trim();
    const phone = form.phone.replace(/\D/g, "");
    const productName = form.productName.trim();

    if (!customerName) {
      alert("Please enter the customer name.");
      return;
    }

    if (phone.length !== 10 && phone.length !== 12) {
      alert("Please enter a valid mobile number.");
      return;
    }

    if (!productName) {
      alert("Please enter the requested item.");
      return;
    }

    const minBudget = form.minBudget
      ? Number(form.minBudget)
      : null;
    const maxBudget = form.maxBudget
      ? Number(form.maxBudget)
      : null;

    if (
      minBudget !== null &&
      maxBudget !== null &&
      minBudget > maxBudget
    ) {
      alert(
        "Minimum budget cannot be greater than maximum budget."
      );
      return;
    }

    setSaving(true);

    const now = new Date().toISOString();

    const requestData = {
      customer_name: customerName,
      phone,
      category: form.category,
      product_name: productName,
      brand: form.brand.trim() || null,
      size: form.size.trim() || null,
      colour: form.colour.trim() || null,
      min_budget: minBudget,
      max_budget: maxBudget,
      quantity: Math.max(1, Number(form.quantity || 1)),
      notes: form.notes.trim() || null,
      required_before: form.requiredBefore || null,
      status: form.status,
      created_source: "WEBSITE_ADMIN",
      contacted_at:
        form.status === "CUSTOMER_CONTACTED" ? now : null,
      completed_at:
        form.status === "SOLD" ||
        form.status === "NOT_INTERESTED" ||
        form.status === "CANCELLED"
          ? now
          : null,
      updated_at: now,
    };

    if (editingId) {
      const existingRequest = requests.find(
        (request) => request.id === editingId
      );

      const { data, error } = await supabase
        .from("customer_product_requests")
        .update({
          ...requestData,
          requested_at:
            existingRequest?.requested_at || now,
        })
        .eq("id", editingId)
        .select()
        .single();

      if (error) {
        alert(`Unable to update request: ${error.message}`);
        setSaving(false);
        return;
      }

      setRequests((current) =>
        current.map((request) =>
          request.id === editingId
            ? (data as CustomerRequest)
            : request
        )
      );

      alert("Customer request updated successfully.");
    } else {
      const { data, error } = await supabase
        .from("customer_product_requests")
        .insert({
          ...requestData,
          requested_at: now,
        })
        .select()
        .single();

      if (error) {
        alert(`Unable to save request: ${error.message}`);
        setSaving(false);
        return;
      }

      setRequests((current) => [
        data as CustomerRequest,
        ...current,
      ]);

      alert("Customer request saved successfully.");
    }

    resetForm();
  }

  async function updateStatus(
    request: CustomerRequest,
    status: RequestStatus
  ) {
    const now = new Date().toISOString();

    const updates = {
      status,
      contacted_at:
        status === "CUSTOMER_CONTACTED"
          ? request.contacted_at || now
          : request.contacted_at,
      completed_at:
        status === "SOLD" ||
        status === "NOT_INTERESTED" ||
        status === "CANCELLED"
          ? now
          : null,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("customer_product_requests")
      .update(updates)
      .eq("id", request.id)
      .select()
      .single();

    if (error) {
      alert(`Unable to update status: ${error.message}`);
      return;
    }

    setRequests((current) =>
      current.map((item) =>
        item.id === request.id
          ? (data as CustomerRequest)
          : item
      )
    );
  }

  async function deleteRequest(request: CustomerRequest) {
    const confirmed = window.confirm(
      `Delete the request from "${request.customer_name}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("customer_product_requests")
      .delete()
      .eq("id", request.id);

    if (error) {
      alert(`Unable to delete request: ${error.message}`);
      return;
    }

    setRequests((current) =>
      current.filter((item) => item.id !== request.id)
    );

    if (editingId === request.id) {
      resetForm();
    }
  }

  async function sendWhatsAppRequestUpdate(
    request: CustomerRequest
  ) {
    if (whatsAppSendingRequestId !== null) return;

    const rawPhone = request.phone.replace(/\D/g, "");
    const phone =
      rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

    if (phone.length < 10 || phone.length > 15) {
      alert("This customer does not have a valid mobile number.");
      return;
    }

    const itemDescription = [
      request.product_name,
      request.brand ? `Brand ${request.brand}` : "",
      request.size ? `Size ${request.size}` : "",
      request.colour ? `Colour ${request.colour}` : "",
    ]
      .filter(Boolean)
      .join(" • ");

    const offerMessage = [
      `You requested ${itemDescription} at NEW CITY STYLE.`,
      request.status === "MATCH_FOUND"
        ? "Good news! The requested item is now available."
        : "We are following up regarding your requested item.",
      "Please reply or visit the store for availability.",
    ].join(" ");

    setWhatsAppSendingRequestId(request.id);

    try {
      const response = await fetch("/api/whatsapp/offer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: phone,
          customerName: request.customer_name,
          offerMessage,
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
            result.error ||
            "WhatsApp request update could not be sent."
          }${stageText}${detailText}`
        );
      }

      await updateStatus(request, "CUSTOMER_CONTACTED");
      alert(
        `WhatsApp request update sent directly to ${request.customer_name}.`
      );
    } catch (error) {
      console.error(
        "Unable to send customer request WhatsApp update:",
        error
      );
      alert(
        error instanceof Error
          ? error.message
          : "Unable to send WhatsApp request update."
      );
    } finally {
      setWhatsAppSendingRequestId(null);
    }
  }

  function callCustomer(request: CustomerRequest) {
    window.location.href = `tel:${request.phone}`;
  }

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const waitingDays = getWaitingDays(
        request.requested_at || request.created_at
      );

      const matchesSearch =
        !query ||
        request.customer_name.toLowerCase().includes(query) ||
        request.phone.includes(query) ||
        request.product_name.toLowerCase().includes(query) ||
        request.category.toLowerCase().includes(query) ||
        (request.brand || "").toLowerCase().includes(query) ||
        (request.size || "").toLowerCase().includes(query) ||
        (request.colour || "").toLowerCase().includes(query);

      const activeStatuses: RequestStatus[] = [
        "WAITING",
        "MATCH_FOUND",
        "CUSTOMER_CONTACTED",
        "RESERVED",
      ];

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" &&
          activeStatuses.includes(request.status)) ||
        request.status === statusFilter;

      const matchesCategory =
        categoryFilter === "ALL" ||
        request.category === categoryFilter;

      const matchesAge =
        ageFilter === "ALL" ||
        (ageFilter === "7_PLUS" && waitingDays >= 7) ||
        (ageFilter === "15_PLUS" && waitingDays >= 15) ||
        (ageFilter === "TODAY" && waitingDays === 0);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesAge
      );
    });
  }, [
    requests,
    search,
    statusFilter,
    categoryFilter,
    ageFilter,
  ]);

  const activeRequests = requests.filter((request) =>
    [
      "WAITING",
      "MATCH_FOUND",
      "CUSTOMER_CONTACTED",
      "RESERVED",
    ].includes(request.status)
  );

  const waitingCount = requests.filter(
    (request) => request.status === "WAITING"
  ).length;

  const matchFoundCount = requests.filter(
    (request) => request.status === "MATCH_FOUND"
  ).length;

  const contactPendingCount = requests.filter(
    (request) =>
      request.status === "MATCH_FOUND" ||
      request.status === "WAITING"
  ).length;

  const olderThanSeven = activeRequests.filter(
    (request) =>
      getWaitingDays(
        request.requested_at || request.created_at
      ) >= 7
  ).length;

  const olderThanFifteen = activeRequests.filter(
    (request) =>
      getWaitingDays(
        request.requested_at || request.created_at
      ) >= 15
  ).length;

  return (
    <main className="request-page">
      <div className="request-container">
        <section className="request-hero">
          <div>
            <p>NEW CITY STYLE • DEMAND INTELLIGENCE</p>
            <h1>Customer Requests</h1>
            <span>
              Save requested items, track waiting days and contact
              customers as soon as matching stock arrives.
            </span>
          </div>

          <button
            type="button"
            onClick={() => void loadRequests()}
          >
            ↻ Refresh Live Data
          </button>
        </section>

        <section className="request-summary-grid">
          <SummaryCard
            icon="🕒"
            title="Waiting"
            value={waitingCount}
            tone="blue"
          />
          <SummaryCard
            icon="✨"
            title="Stock Match Found"
            value={matchFoundCount}
            tone="green"
          />
          <SummaryCard
            icon="📞"
            title="Contact Pending"
            value={contactPendingCount}
            tone="gold"
          />
          <SummaryCard
            icon="⚠️"
            title="Waiting 7+ Days"
            value={olderThanSeven}
            tone="orange"
          />
          <SummaryCard
            icon="🚨"
            title="Waiting 15+ Days"
            value={olderThanFifteen}
            tone="red"
          />
          <SummaryCard
            icon="📋"
            title="Total Active"
            value={activeRequests.length}
            tone="navy"
          />
        </section>

        <div className="request-main-grid">
          <section className="request-form-card">
            <div className="request-card-heading">
              <p>QUICK ENTRY</p>
              <h2>
                {editingId
                  ? "Edit Customer Request"
                  : "Add Customer Request"}
              </h2>
            </div>

            <form onSubmit={saveRequest}>
              <FormField label="Customer Name *">
                <input
                  value={form.customerName}
                  placeholder="Customer full name"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      customerName: event.target.value,
                    }))
                  }
                />
              </FormField>

              <FormField label="Mobile Number *">
                <input
                  inputMode="numeric"
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
                />
              </FormField>

              <div className="request-two-column">
                <FormField label="Category *">
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                  >
                    {categories.map((category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Quantity">
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        quantity: event.target.value,
                      }))
                    }
                  />
                </FormField>
              </div>

              <FormField label="Requested Item *">
                <input
                  value={form.productName}
                  placeholder="Example: Blue check shirt"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      productName: event.target.value,
                    }))
                  }
                />
              </FormField>

              <div className="request-two-column">
                <FormField label="Brand">
                  <input
                    value={form.brand}
                    placeholder="Optional"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        brand: event.target.value,
                      }))
                    }
                  />
                </FormField>

                <FormField label="Size">
                  <input
                    value={form.size}
                    placeholder="M, L, XL, 34..."
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        size: event.target.value,
                      }))
                    }
                  />
                </FormField>
              </div>

              <FormField label="Colour">
                <input
                  value={form.colour}
                  placeholder="Blue, Black, Gold..."
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      colour: event.target.value,
                    }))
                  }
                />
              </FormField>

              <div className="request-two-column">
                <FormField label="Minimum Budget">
                  <input
                    type="number"
                    min="0"
                    value={form.minBudget}
                    placeholder="₹"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        minBudget: event.target.value,
                      }))
                    }
                  />
                </FormField>

                <FormField label="Maximum Budget">
                  <input
                    type="number"
                    min="0"
                    value={form.maxBudget}
                    placeholder="₹"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maxBudget: event.target.value,
                      }))
                    }
                  />
                </FormField>
              </div>

              <FormField label="Required Before">
                <div className="request-date-wrapper">
                  <input
                    type="date"
                    value={form.requiredBefore}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        requiredBefore: event.target.value,
                      }))
                    }
                  />
                </div>
              </FormField>

              {editingId && (
                <FormField label="Status">
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target
                          .value as RequestStatus,
                      }))
                    }
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}

              <FormField label="Notes">
                <textarea
                  value={form.notes}
                  placeholder="Customer preference, occasion or other details"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </FormField>

              <button
                type="submit"
                className="request-save-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Request"
                    : "Save Customer Request"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="request-cancel-button"
                  onClick={resetForm}
                >
                  Cancel Editing
                </button>
              )}
            </form>
          </section>

          <section className="request-list-card">
            <div className="request-list-header">
              <div>
                <p>LIVE REQUEST QUEUE</p>
                <h2>Requested Items</h2>
                <span>
                  {filteredRequests.length} request
                  {filteredRequests.length === 1 ? "" : "s"} found
                </span>
              </div>

              <div className="request-filters">
                <input
                  value={search}
                  placeholder="Search name, phone, item..."
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                >
                  <option value="ACTIVE">Active Requests</option>
                  <option value="ALL">All Statuses</option>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>

                <select
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(event.target.value)
                  }
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  ))}
                </select>

                <select
                  value={ageFilter}
                  onChange={(event) =>
                    setAgeFilter(event.target.value)
                  }
                >
                  <option value="ALL">Any Waiting Time</option>
                  <option value="TODAY">Requested Today</option>
                  <option value="7_PLUS">Waiting 7+ Days</option>
                  <option value="15_PLUS">
                    Waiting 15+ Days
                  </option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="request-empty">
                Loading customer requests...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="request-empty">
                No requests match the selected filters.
              </div>
            ) : (
              <div className="request-list">
                {filteredRequests.map((request) => {
                  const waitingDays = getWaitingDays(
                    request.requested_at ||
                      request.created_at
                  );

                  return (
                    <article
                      key={request.id}
                      className={`request-item ${
                        waitingDays >= 15
                          ? "request-item-critical"
                          : waitingDays >= 7
                            ? "request-item-warning"
                            : ""
                      }`}
                    >
                      <div className="request-item-top">
                        <div className="request-customer">
                          <div className="request-avatar">
                            {request.customer_name
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <h3>{request.customer_name}</h3>
                            <span>{request.phone}</span>
                          </div>
                        </div>

                        <span
                          className="request-status"
                          style={getStatusStyle(
                            request.status
                          )}
                        >
                          {formatStatus(request.status)}
                        </span>
                      </div>

                      <div className="request-product-box">
                        <p>{request.category}</p>
                        <h3>{request.product_name}</h3>

                        <div className="request-tags">
                          {request.brand && (
                            <span>Brand: {request.brand}</span>
                          )}
                          {request.size && (
                            <span>Size: {request.size}</span>
                          )}
                          {request.colour && (
                            <span>
                              Colour: {request.colour}
                            </span>
                          )}
                          <span>
                            Quantity: {request.quantity}
                          </span>
                        </div>
                      </div>

                      <div className="request-meta-grid">
                        <div>
                          <span>WAITING TIME</span>
                          <strong>
                            {waitingDays === 0
                              ? "Requested today"
                              : `${waitingDays} day${
                                  waitingDays === 1 ? "" : "s"
                                }`}
                          </strong>
                        </div>

                        <div>
                          <span>BUDGET</span>
                          <strong>
                            {request.min_budget !== null ||
                            request.max_budget !== null
                              ? `₹${
                                  request.min_budget ?? 0
                                } – ₹${
                                  request.max_budget ?? "Any"
                                }`
                              : "Not specified"}
                          </strong>
                        </div>

                        <div>
                          <span>REQUIRED BEFORE</span>
                          <strong>
                            {request.required_before
                              ? new Date(
                                  request.required_before
                                ).toLocaleDateString("en-IN")
                              : "No deadline"}
                          </strong>
                        </div>
                      </div>

                      {request.notes && (
                        <p className="request-notes">
                          {request.notes}
                        </p>
                      )}

                      <div className="request-actions">
                        <button
                          type="button"
                          className="request-action-call"
                          onClick={() =>
                            callCustomer(request)
                          }
                        >
                          📞 Call
                        </button>

                        <button
                          type="button"
                          className="request-action-whatsapp"
                          onClick={() =>
                            void sendWhatsAppRequestUpdate(request)
                          }
                          disabled={
                            whatsAppSendingRequestId !== null
                          }
                        >
                          {whatsAppSendingRequestId === request.id
                            ? "Sending..."
                            : "💬 WhatsApp"}
                        </button>

                        <select
                          value={request.status}
                          onChange={(event) =>
                            void updateStatus(
                              request,
                              event.target
                                .value as RequestStatus
                            )
                          }
                        >
                          {statuses.map((status) => (
                            <option
                              key={status}
                              value={status}
                            >
                              {formatStatus(status)}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className="request-action-edit"
                          onClick={() =>
                            startEditing(request)
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="request-action-delete"
                          onClick={() =>
                            void deleteRequest(request)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <style jsx global>{`
        .request-page {
          min-height: 100vh;
          padding: 30px 20px 70px;
          background:
            radial-gradient(
              circle at 85% 0%,
              rgba(212, 175, 55, 0.1),
              transparent 24%
            ),
            #f8f4ec;
          color: #1f2937;
        }

        .request-container {
          max-width: 1480px;
          margin: 0 auto;
        }

        .request-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 22px;
          padding: 28px 30px;
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.62);
          border-radius: 24px;
          background:
            radial-gradient(
              circle at 85% 18%,
              rgba(212, 175, 55, 0.28),
              transparent 24%
            ),
            linear-gradient(
              135deg,
              #020b24,
              #061d4a 45%,
              #0a2e73
            );
          box-shadow: 0 18px 38px rgba(3, 21, 63, 0.22);
          color: #ffffff;
        }

        .request-hero p,
        .request-card-heading p,
        .request-list-header p {
          margin: 0 0 7px;
          color: #d4af37;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .request-hero h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 42px);
          font-weight: 950;
        }

        .request-hero span {
          display: block;
          max-width: 760px;
          margin-top: 9px;
          color: rgba(255, 255, 255, 0.76);
          font-size: 13px;
          line-height: 1.65;
        }

        .request-hero button {
          min-height: 46px;
          flex-shrink: 0;
          padding: 0 17px;
          border: 1px solid #d4af37;
          border-radius: 12px;
          background: rgba(212, 175, 55, 0.14);
          color: #f3d66f;
          font-weight: 900;
          cursor: pointer;
        }

        .request-summary-grid {
          display: grid;
          grid-template-columns:
            repeat(auto-fit, minmax(175px, 1fr));
          gap: 13px;
          margin-bottom: 22px;
        }

        .request-summary-card {
          min-height: 126px;
          padding: 18px;
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.22);
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 10px 24px rgba(3, 21, 63, 0.08);
        }

        .request-summary-icon {
          font-size: 25px;
        }

        .request-summary-card p {
          margin: 10px 0 4px;
          color: #6b7280;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.45px;
          text-transform: uppercase;
        }

        .request-summary-card h2 {
          margin: 0;
          color: #0a2e73;
          font-size: 30px;
          font-weight: 950;
        }

        .request-summary-card-green {
          background: linear-gradient(145deg, #ecfdf5, #ffffff);
        }

        .request-summary-card-gold {
          background: linear-gradient(145deg, #fff8df, #ffffff);
        }

        .request-summary-card-orange {
          background: linear-gradient(145deg, #fff7ed, #ffffff);
        }

        .request-summary-card-red {
          background: linear-gradient(145deg, #fff1f2, #ffffff);
        }

        .request-summary-card-navy {
          background: linear-gradient(145deg, #061d4a, #0a2e73);
        }

        .request-summary-card-navy p {
          color: #d4af37;
        }

        .request-summary-card-navy h2 {
          color: #ffffff;
        }

        .request-main-grid {
          display: grid;
          grid-template-columns: 390px minmax(0, 1fr);
          gap: 22px;
          align-items: start;
        }

        .request-form-card,
        .request-list-card {
          border: 1px solid rgba(212, 175, 55, 0.24);
          border-radius: 22px;
          background: #ffffff;
          box-shadow: 0 12px 32px rgba(3, 21, 63, 0.09);
        }

        .request-form-card {
          position: sticky;
          top: 70px;
          padding: 23px;
        }

        .request-list-card {
          min-width: 0;
          padding: 23px;
        }

        .request-card-heading,
        .request-list-header {
          margin-bottom: 20px;
        }

        .request-card-heading h2,
        .request-list-header h2 {
          margin: 0;
          color: #0a2e73;
          font-size: 23px;
          font-weight: 950;
        }

        .request-list-header > div:first-child > span {
          display: block;
          margin-top: 5px;
          color: #6b7280;
          font-size: 12px;
        }

        .request-form-card label {
          display: block;
          margin-bottom: 7px;
          color: #0a2e73;
          font-size: 12px;
          font-weight: 850;
        }

        .request-form-card input,
        .request-form-card select,
        .request-form-card textarea,
        .request-filters input,
        .request-filters select,
        .request-actions select {
          width: 100%;
          min-height: 44px;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          background: #ffffff;
          color: #111827;
          font: inherit;
          font-size: 13px;
          outline: none;
        }

        .request-form-card input,
        .request-form-card select,
        .request-form-card textarea,
        .request-filters input,
        .request-filters select {
          padding: 10px 12px;
        }

        .request-form-card input:focus,
        .request-form-card select:focus,
        .request-form-card textarea:focus,
        .request-filters input:focus,
        .request-filters select:focus {
          border-color: #0a2e73;
          box-shadow: 0 0 0 3px rgba(10, 46, 115, 0.1);
        }

        .request-form-card textarea {
          min-height: 95px;
          resize: vertical;
        }

        .request-date-wrapper {
          width: 100%;
          min-width: 0;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          background: #ffffff;
        }

        .request-date-wrapper input {
          display: block;
          width: 100%;
          min-width: 0;
          min-height: auto;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
        }

        .request-two-column {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 11px;
        }

        .request-form-field {
          margin-bottom: 15px;
        }

        .request-save-button,
        .request-cancel-button {
          width: 100%;
          min-height: 46px;
          border-radius: 11px;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
        }

        .request-save-button {
          border: 1px solid #d4af37;
          background: linear-gradient(135deg, #03153f, #0a2e73);
          color: #ffffff;
        }

        .request-save-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .request-cancel-button {
          margin-top: 9px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #6b7280;
        }

        .request-list-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .request-filters {
          width: min(100%, 700px);
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1fr;
          gap: 9px;
        }

        .request-list {
          display: grid;
          gap: 14px;
        }

        .request-item {
          padding: 18px;
          border: 1px solid rgba(212, 175, 55, 0.25);
          border-left: 5px solid #0a2e73;
          border-radius: 18px;
          background: linear-gradient(145deg, #ffffff, #fafcff);
          box-shadow: 0 8px 22px rgba(3, 21, 63, 0.07);
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease;
        }

        .request-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 28px rgba(3, 21, 63, 0.11);
        }

        .request-item-warning {
          border-left-color: #f59e0b;
        }

        .request-item-critical {
          border-left-color: #dc2626;
          background: linear-gradient(145deg, #fff7f7, #ffffff);
        }

        .request-item-top,
        .request-customer {
          display: flex;
          align-items: center;
        }

        .request-item-top {
          justify-content: space-between;
          gap: 13px;
        }

        .request-customer {
          min-width: 0;
          gap: 11px;
        }

        .request-avatar {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 14px;
          background: linear-gradient(135deg, #03153f, #0a2e73);
          color: #d4af37;
          font-size: 17px;
          font-weight: 950;
        }

        .request-customer h3 {
          margin: 0 0 3px;
          color: #0a2e73;
          font-size: 16px;
        }

        .request-customer span {
          color: #6b7280;
          font-size: 11px;
        }

        .request-status {
          flex-shrink: 0;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .request-product-box {
          margin-top: 14px;
          padding: 14px;
          border-radius: 13px;
          background: #f8f4ec;
        }

        .request-product-box p {
          margin: 0 0 4px;
          color: #b48b13;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.7px;
          text-transform: uppercase;
        }

        .request-product-box h3 {
          margin: 0;
          color: #1f2937;
          font-size: 18px;
        }

        .request-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 9px;
        }

        .request-tags span {
          padding: 5px 8px;
          border-radius: 999px;
          background: #ffffff;
          color: #0a2e73;
          font-size: 9px;
          font-weight: 800;
        }

        .request-meta-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 9px;
          margin-top: 12px;
        }

        .request-meta-grid div {
          padding: 10px;
          border: 1px solid #e5e7eb;
          border-radius: 11px;
          background: #ffffff;
        }

        .request-meta-grid span,
        .request-meta-grid strong {
          display: block;
        }

        .request-meta-grid span {
          color: #9ca3af;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.55px;
        }

        .request-meta-grid strong {
          margin-top: 4px;
          color: #0a2e73;
          font-size: 11px;
        }

        .request-notes {
          margin: 11px 0 0;
          padding: 10px 12px;
          border-left: 3px solid #d4af37;
          background: #fffaf0;
          color: #4b5563;
          font-size: 11px;
          line-height: 1.55;
        }

        .request-actions {
          display: grid;
          grid-template-columns:
            auto auto minmax(145px, 1fr) auto auto;
          gap: 7px;
          margin-top: 13px;
        }

        .request-actions button,
        .request-actions select {
          min-height: 38px;
          padding: 7px 9px;
          border-radius: 9px;
          font-size: 10px;
          font-weight: 850;
          cursor: pointer;
        }

        .request-action-call {
          border: 1px solid #93c5fd;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .request-action-whatsapp {
          border: 1px solid #86efac;
          background: #f0fdf4;
          color: #166534;
        }

        .request-action-whatsapp:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .request-action-edit {
          border: 1px solid #d4af37;
          background: #0a2e73;
          color: #ffffff;
        }

        .request-action-delete {
          border: 1px solid #fca5a5;
          background: #ffffff;
          color: #dc2626;
        }

        .request-empty {
          padding: 65px 20px;
          border: 1px dashed rgba(10, 46, 115, 0.22);
          border-radius: 16px;
          background: #f8fafc;
          color: #0a2e73;
          font-weight: 850;
          text-align: center;
        }

        button {
          transition:
            transform 0.18s ease,
            filter 0.18s ease,
            box-shadow 0.18s ease;
        }

        button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.04);
        }

        @media (max-width: 1200px) {
          .request-main-grid {
            grid-template-columns: 350px minmax(0, 1fr);
          }

          .request-list-header {
            display: block;
          }

          .request-filters {
            width: 100%;
            margin-top: 15px;
            grid-template-columns: 1fr 1fr;
          }

          .request-actions {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 900px) {
          .request-page {
            padding: 18px 12px 55px;
          }

          .request-hero {
            display: block;
            padding: 22px 18px;
          }

          .request-hero button {
            width: 100%;
            margin-top: 16px;
          }

          .request-main-grid {
            grid-template-columns: 1fr;
          }

          .request-form-card {
            position: static;
          }
        }

        @media (max-width: 600px) {
          .request-summary-grid {
            grid-template-columns: 1fr 1fr;
          }

          .request-form-card,
          .request-list-card {
            padding: 17px;
          }

          .request-two-column,
          .request-filters,
          .request-meta-grid,
          .request-actions {
            grid-template-columns: 1fr;
          }

          .request-item-top {
            align-items: flex-start;
          }

          .request-status {
            max-width: 125px;
            text-align: center;
          }
        }
      `}</style>
    </main>
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
    <div className="request-form-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  value,
  tone,
}: {
  icon: string;
  title: string;
  value: number;
  tone:
    | "blue"
    | "green"
    | "gold"
    | "orange"
    | "red"
    | "navy";
}) {
  return (
    <div
      className={`request-summary-card request-summary-card-${tone}`}
    >
      <div className="request-summary-icon">{icon}</div>
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  );
}