"use client";

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Coupon = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  minimum_order: number;
  maximum_discount: number | null;
  usage_limit: number;
  used_count: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
};

type CouponForm = {
  code: string;
  title: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  minimumOrder: string;
  maximumDiscount: string;
  usageLimit: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

const emptyForm: CouponForm = {
  code: "",
  title: "",
  description: "",
  discountType: "percentage",
  discountValue: "",
  minimumOrder: "0",
  maximumDiscount: "",
  usageLimit: "0",
  startDate: "",
  endDate: "",
  isActive: true,
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState<CouponForm>(emptyForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    loadCoupons();
  }, []);

  async function loadCoupons() {
    setLoading(true);

    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(`Unable to load coupons: ${error.message}`);
      setLoading(false);
      return;
    }

    setCoupons((data as Coupon[]) || []);
    setLoading(false);
  }

  function normalizeCode(value: string) {
    return value
      .toUpperCase()
      .trim()
      .replace(/[^A-Z0-9_-]/g, "");
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setSaving(false);
  }

  function startEditing(coupon: Coupon) {
    setEditingId(coupon.id);

    setForm({
      code: coupon.code,
      title: coupon.title,
      description: coupon.description || "",
      discountType: coupon.discount_type,
      discountValue: String(coupon.discount_value ?? ""),
      minimumOrder: String(coupon.minimum_order ?? 0),
      maximumDiscount:
        coupon.maximum_discount === null
          ? ""
          : String(coupon.maximum_discount),
      usageLimit: String(coupon.usage_limit ?? 0),
      startDate: coupon.start_date
        ? coupon.start_date.slice(0, 16)
        : "",
      endDate: coupon.end_date
        ? coupon.end_date.slice(0, 16)
        : "",
      isActive: coupon.is_active,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const code = normalizeCode(form.code);
    const title = form.title.trim();
    const discountValue = Number(form.discountValue);

    if (!code) {
      alert("Please enter a coupon code.");
      return;
    }

    if (!title) {
      alert("Please enter a coupon title.");
      return;
    }

    if (!discountValue || discountValue <= 0) {
      alert("Please enter a valid discount value.");
      return;
    }

    if (
      form.discountType === "percentage" &&
      discountValue > 100
    ) {
      alert("Percentage discount cannot be more than 100.");
      return;
    }

    if (
      form.startDate &&
      form.endDate &&
      new Date(form.endDate) <= new Date(form.startDate)
    ) {
      alert("End date must be later than start date.");
      return;
    }

    setSaving(true);

    const couponData = {
      code,
      title,
      description: form.description.trim() || null,
      discount_type: form.discountType,
      discount_value: discountValue,
      minimum_order: Number(form.minimumOrder || 0),
      maximum_discount:
        form.maximumDiscount.trim() === ""
          ? null
          : Number(form.maximumDiscount),
      usage_limit: Number(form.usageLimit || 0),
      start_date: form.startDate
        ? new Date(form.startDate).toISOString()
        : null,
      end_date: form.endDate
        ? new Date(form.endDate).toISOString()
        : null,
      is_active: form.isActive,
    };

    if (editingId !== null) {
      const { data, error } = await supabase
        .from("coupons")
        .update(couponData)
        .eq("id", editingId)
        .select()
        .single();

      if (error) {
        alert(`Unable to update coupon: ${error.message}`);
        setSaving(false);
        return;
      }

      setCoupons((current) =>
        current.map((coupon) =>
          coupon.id === editingId ? (data as Coupon) : coupon
        )
      );

      alert("Coupon updated successfully.");
    } else {
      const { data, error } = await supabase
        .from("coupons")
        .insert(couponData)
        .select()
        .single();

      if (error) {
        alert(`Unable to add coupon: ${error.message}`);
        setSaving(false);
        return;
      }

      setCoupons((current) => [data as Coupon, ...current]);

      alert("Coupon added successfully.");
    }

    resetForm();
  }

  async function toggleCoupon(coupon: Coupon) {
    const newStatus = !coupon.is_active;

    const { error } = await supabase
      .from("coupons")
      .update({
        is_active: newStatus,
      })
      .eq("id", coupon.id);

    if (error) {
      alert(`Unable to update coupon status: ${error.message}`);
      return;
    }

    setCoupons((current) =>
      current.map((item) =>
        item.id === coupon.id
          ? {
              ...item,
              is_active: newStatus,
            }
          : item
      )
    );
  }

  async function deleteCoupon(coupon: Coupon) {
    const confirmed = window.confirm(
      `Are you sure you want to delete coupon "${coupon.code}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("coupons")
      .delete()
      .eq("id", coupon.id);

    if (error) {
      alert(`Unable to delete coupon: ${error.message}`);
      return;
    }

    setCoupons((current) =>
      current.filter((item) => item.id !== coupon.id)
    );

    if (editingId === coupon.id) {
      resetForm();
    }

    alert("Coupon deleted successfully.");
  }

  function getCouponState(coupon: Coupon) {
    const now = new Date();

    if (!coupon.is_active) {
      return "Inactive";
    }

    if (
      coupon.start_date &&
      new Date(coupon.start_date) > now
    ) {
      return "Scheduled";
    }

    if (
      coupon.end_date &&
      new Date(coupon.end_date) < now
    ) {
      return "Expired";
    }

    if (
      coupon.usage_limit > 0 &&
      coupon.used_count >= coupon.usage_limit
    ) {
      return "Limit Reached";
    }

    return "Active";
  }

  const filteredCoupons = useMemo(() => {
    const query = search.trim().toLowerCase();

    return coupons.filter((coupon) => {
      const state = getCouponState(coupon);

      const matchesSearch =
        !query ||
        coupon.code.toLowerCase().includes(query) ||
        coupon.title.toLowerCase().includes(query) ||
        (coupon.description || "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "All" || state === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [coupons, search, statusFilter]);

  const activeCount = coupons.filter(
    (coupon) => getCouponState(coupon) === "Active"
  ).length;

  const scheduledCount = coupons.filter(
    (coupon) => getCouponState(coupon) === "Scheduled"
  ).length;

  const expiredCount = coupons.filter((coupon) =>
    ["Expired", "Limit Reached"].includes(
      getCouponState(coupon)
    )
  ).length;

  const totalUsage = coupons.reduce(
    (sum, coupon) => sum + Number(coupon.used_count || 0),
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
        className="coupons-page-shell"
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        <section
          className="coupons-hero"
          style={{
            background:
              "linear-gradient(135deg, #0A2E73 0%, #164CA8 100%)",
            borderRadius: "22px",
            padding: "30px",
            color: "#FFFFFF",
            marginBottom: "25px",
            boxShadow: "0 12px 35px rgba(10,46,115,0.25)",
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
            Coupons Management
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              opacity: 0.9,
            }}
          >
            Create and manage discount codes, festival offers and
            customer promotions.
          </p>
        </section>

        <section
          className="coupons-summary-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "16px",
            marginBottom: "25px",
          }}
        >
          <SummaryCard
            icon="🎟️"
            title="Total Coupons"
            value={coupons.length}
          />

          <SummaryCard
            icon="✅"
            title="Active Coupons"
            value={activeCount}
          />

          <SummaryCard
            icon="🗓️"
            title="Scheduled"
            value={scheduledCount}
          />

          <SummaryCard
            icon="⌛"
            title="Expired / Used"
            value={expiredCount}
          />

          <SummaryCard
            icon="🛍️"
            title="Total Usage"
            value={totalUsage}
          />
        </section>

        <div
          className="coupons-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "420px minmax(0, 1fr)",
            gap: "24px",
            alignItems: "start",
          }}
        >
          <section
            className="coupons-form-panel"
            style={{
              background: "#FFFFFF",
              borderRadius: "18px",
              padding: "24px",
              boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
              border: "1px solid rgba(212,175,55,0.22)",
            }}
          >
            <h2
              style={{
                color: "#0A2E73",
                margin: "0 0 22px",
              }}
            >
              {editingId === null ? "Add Coupon" : "Edit Coupon"}
            </h2>

            <form onSubmit={saveCoupon}>
              <FormField label="Coupon Code">
                <input
                  value={form.code}
                  placeholder="Example: NCS20"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      code: normalizeCode(event.target.value),
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Coupon Title">
                <input
                  value={form.title}
                  placeholder="Example: Festival Special Offer"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Description">
                <textarea
                  value={form.description}
                  placeholder="Write a short coupon description..."
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
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
                <FormField label="Discount Type">
                  <select
                    value={form.discountType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        discountType: event.target.value as
                          | "percentage"
                          | "fixed",
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="percentage">
                      Percentage
                    </option>
                    <option value="fixed">
                      Fixed Amount
                    </option>
                  </select>
                </FormField>

                <FormField label="Discount Value">
                  <input
                    type="number"
                    min="0"
                    value={form.discountValue}
                    placeholder={
                      form.discountType === "percentage"
                        ? "Example: 20"
                        : "Example: 200"
                    }
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        discountValue: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </FormField>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <FormField label="Minimum Order">
                  <input
                    type="number"
                    min="0"
                    value={form.minimumOrder}
                    placeholder="0"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        minimumOrder: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </FormField>

                <FormField label="Maximum Discount">
                  <input
                    type="number"
                    min="0"
                    value={form.maximumDiscount}
                    placeholder="Optional"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maximumDiscount: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </FormField>
              </div>

              <FormField label="Usage Limit">
                <input
                  type="number"
                  min="0"
                  value={form.usageLimit}
                  placeholder="0 means unlimited"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      usageLimit: event.target.value,
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
                <FormField label="Start Date">
                  <input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </FormField>

                <FormField label="End Date">
                  <input
                    type="datetime-local"
                    value={form.endDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        endDate: event.target.value,
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
                  color: "#0A2E73",
                  fontWeight: 700,
                  marginBottom: "22px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                />

                Coupon is active
              </label>

              <button
                className="coupons-primary-button"
                type="submit"
                disabled={saving}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #03153F, #0A2E73)",
                  color: "#FFFFFF",
                  border: "1px solid rgba(212,175,55,0.85)",
                  padding: "14px",
                  borderRadius: "10px",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontWeight: 800,
                  fontSize: "16px",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : editingId === null
                    ? "Add Coupon"
                    : "Update Coupon"}
              </button>

              {editingId !== null && (
                <button
                  className="coupons-secondary-button"
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
            className="coupons-list-panel"
            style={{
              background: "#FFFFFF",
              borderRadius: "18px",
              padding: "24px",
              boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
              border: "1px solid rgba(212,175,55,0.22)",
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
                  Store Coupons
                </h2>

                <p
                  style={{
                    color: "#666",
                    margin: 0,
                  }}
                >
                  {filteredCoupons.length} coupons found
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
                  placeholder="Search coupons..."
                  onChange={(event) => setSearch(event.target.value)}
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
                    width: "160px",
                  }}
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Expired">Expired</option>
                  <option value="Limit Reached">
                    Limit Reached
                  </option>
                </select>

                <button
                  className="coupons-refresh-button"
                  type="button"
                  onClick={loadCoupons}
                  style={{
                    background: "linear-gradient(135deg, #D4AF37, #F0D267)",
                    color: "#03153F",
                    border: "1px solid rgba(10,46,115,0.18)",
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
              <div style={messageStyle}>Loading Coupons...</div>
            ) : filteredCoupons.length === 0 ? (
              <div style={messageStyle}>
                No coupons were found.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(290px, 1fr))",
                  gap: "18px",
                }}
              >
                {filteredCoupons.map((coupon) => {
                  const state = getCouponState(coupon);

                  return (
                    <article
                      className="coupon-card"
                      key={coupon.id}
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: "16px",
                        overflow: "hidden",
                        background: "#FFFFFF",
                        boxShadow:
                          "0 5px 18px rgba(0,0,0,0.06)",
                      }}
                    >
                      <div
                        style={{
                          background:
                            "linear-gradient(135deg, #071A43, #0A2E73)",
                          padding: "22px",
                          color: "#FFFFFF",
                          position: "relative",
                        }}
                      >
                        <StatusBadge status={state} />

                        <p
                          style={{
                            color: "#D4AF37",
                            margin: "0 0 8px",
                            fontWeight: 800,
                            letterSpacing: "1px",
                          }}
                        >
                          NEW CITY STYLE
                        </p>

                        <h3
                          style={{
                            margin: 0,
                            fontSize: "28px",
                            letterSpacing: "2px",
                          }}
                        >
                          {coupon.code}
                        </h3>

                        <p
                          style={{
                            margin: "9px 0 0",
                            opacity: 0.85,
                          }}
                        >
                          {coupon.title}
                        </p>
                      </div>

                      <div
                        style={{
                          padding: "18px",
                        }}
                      >
                        <div
                          style={{
                            background: "#F8F4EC",
                            borderRadius: "12px",
                            padding: "16px",
                            textAlign: "center",
                            marginBottom: "15px",
                          }}
                        >
                          <p
                            style={{
                              color: "#666",
                              margin: "0 0 5px",
                            }}
                          >
                            Customer Discount
                          </p>

                          <strong
                            style={{
                              color: "#0A2E73",
                              fontSize: "30px",
                            }}
                          >
                            {coupon.discount_type === "percentage"
                              ? `${coupon.discount_value}% OFF`
                              : `₹${coupon.discount_value} OFF`}
                          </strong>
                        </div>

                        <p
                          style={{
                            color: "#555",
                            lineHeight: 1.6,
                            minHeight: "48px",
                            margin: "0 0 15px",
                          }}
                        >
                          {coupon.description ||
                            "No description added."}
                        </p>

                        <div style={detailsGridStyle}>
                          <DetailItem
                            label="Minimum Order"
                            value={`₹${coupon.minimum_order || 0}`}
                          />

                          <DetailItem
                            label="Maximum Discount"
                            value={
                              coupon.maximum_discount === null
                                ? "No Limit"
                                : `₹${coupon.maximum_discount}`
                            }
                          />

                          <DetailItem
                            label="Usage"
                            value={`${coupon.used_count || 0} / ${
                              coupon.usage_limit === 0
                                ? "Unlimited"
                                : coupon.usage_limit
                            }`}
                          />

                          <DetailItem
                            label="Valid Until"
                            value={
                              coupon.end_date
                                ? new Date(
                                    coupon.end_date
                                  ).toLocaleDateString()
                                : "No Expiry"
                            }
                          />
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "9px",
                            marginTop: "17px",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => startEditing(coupon)}
                            style={{
                              background: "#0A2E73",
                              color: "#FFFFFF",
                              border: "none",
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
                            onClick={() => toggleCoupon(coupon)}
                            style={{
                              background: coupon.is_active
                                ? "#F59E0B"
                                : "#16A34A",
                              color: "#FFFFFF",
                              border: "none",
                              padding: "10px",
                              borderRadius: "8px",
                              cursor: "pointer",
                              fontWeight: 700,
                            }}
                          >
                            {coupon.is_active
                              ? "Disable"
                              : "Enable"}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteCoupon(coupon)}
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
                          Delete Coupon
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
        .coupons-page-shell {
          animation: couponsPageRise 0.5s ease both;
        }

        .coupons-hero {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          animation: couponsPageRise 0.55s ease both;
        }

        .coupons-hero::after {
          content: "";
          position: absolute;
          top: -140%;
          left: -35%;
          width: 36%;
          height: 370%;
          transform: rotate(22deg);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent);
          animation: couponHeroShine 5.3s ease-in-out infinite;
          pointer-events: none;
        }

        .coupons-summary-grid > * {
          opacity: 0;
          animation: couponStatRise 0.45s ease forwards;
        }

        .coupons-summary-grid > *:nth-child(1) { animation-delay: .05s; }
        .coupons-summary-grid > *:nth-child(2) { animation-delay: .10s; }
        .coupons-summary-grid > *:nth-child(3) { animation-delay: .15s; }
        .coupons-summary-grid > *:nth-child(4) { animation-delay: .20s; }
        .coupons-summary-grid > *:nth-child(5) { animation-delay: .25s; }

        .coupon-summary-card {
          position: relative;
          isolation: isolate;
          min-height: 140px;
          overflow: hidden;
          padding: 20px;
          border: 1px solid rgba(212,175,55,.22);
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(10,46,115,.99), rgba(3,21,63,.98));
          box-shadow: 0 12px 28px rgba(3,21,63,.16), inset 0 1px 0 rgba(255,255,255,.06);
          transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
        }

        .coupon-summary-card:nth-child(2),
        .coupon-summary-card:nth-child(5) {
          background: linear-gradient(135deg, rgba(10,46,115,.99), rgba(22,46,102,.98), rgba(103,79,16,.9));
        }

        .coupon-summary-card:nth-child(3) {
          background: linear-gradient(135deg, rgba(5,25,74,.99), rgba(8,37,96,.98));
        }

        .coupon-summary-card:nth-child(4) {
          background: linear-gradient(135deg, rgba(18,35,82,.99), rgba(119,75,12,.92));
        }

        .coupon-summary-card::before {
          content: "";
          position: absolute;
          z-index: -1;
          top: -40%;
          right: -15%;
          width: 125px;
          height: 125px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(212,175,55,.34), rgba(212,175,55,0));
        }

        .coupon-summary-card::after {
          content: "";
          position: absolute;
          top: -145%;
          left: -36%;
          width: 42%;
          height: 370%;
          transform: rotate(22deg);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent);
          animation: couponStatShine 5.2s ease-in-out infinite;
          pointer-events: none;
        }

        .coupon-summary-card:hover {
          transform: translateY(-3px) scale(1.004);
          border-color: rgba(212,175,55,.42);
          box-shadow: 0 16px 32px rgba(3,21,63,.22), 0 0 0 1px rgba(212,175,55,.1);
        }

        .coupon-summary-icon {
          position: relative;
          z-index: 2;
          color: #D4AF37;
          font-size: 30px;
          filter: drop-shadow(0 4px 10px rgba(0,0,0,.18));
        }

        .coupon-summary-card p {
          position: relative;
          z-index: 2;
          margin: 10px 0 5px;
          color: rgba(212,175,55,.94);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .45px;
          text-transform: uppercase;
        }

        .coupon-summary-card h2 {
          position: relative;
          z-index: 2;
          margin: 0;
          color: #fff;
          font-size: 29px;
          font-weight: 950;
          letter-spacing: -.5px;
          text-shadow: 0 2px 10px rgba(0,0,0,.15);
        }

        .coupon-summary-card:nth-child(5) h2 {
          color: #F6D676;
        }

        .coupons-form-panel,
        .coupons-list-panel,
        .coupon-card {
          transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
        }

        .coupons-form-panel:hover,
        .coupons-list-panel:hover {
          transform: translateY(-2px);
          border-color: rgba(212,175,55,.38) !important;
          box-shadow: 0 14px 32px rgba(3,21,63,.10) !important;
        }

        .coupon-card {
          animation: couponCardRise .42s ease both;
        }

        .coupon-card:hover {
          transform: translateY(-3px);
          border-color: rgba(212,175,55,.48) !important;
          box-shadow: 0 16px 34px rgba(3,21,63,.13) !important;
        }

        .coupon-card > div:first-child {
          position: relative;
          overflow: hidden;
        }

        .coupon-card > div:first-child::after {
          content: "";
          position: absolute;
          top: -140%;
          left: -40%;
          width: 38%;
          height: 360%;
          transform: rotate(22deg);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.13), transparent);
          transition: left .7s ease;
          pointer-events: none;
        }

        .coupon-card:hover > div:first-child::after {
          left: 125%;
        }

        .coupons-primary-button,
        .coupons-secondary-button,
        .coupons-refresh-button,
        .coupon-card button {
          transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
        }

        .coupons-primary-button:hover:not(:disabled),
        .coupons-refresh-button:hover,
        .coupon-card button:hover {
          transform: translateY(-1px);
          filter: brightness(1.04);
        }

        input, textarea, select {
          transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
        }

        input:focus, textarea:focus, select:focus {
          border-color: #0A2E73 !important;
          box-shadow: 0 0 0 4px rgba(10,46,115,.10);
        }

        @keyframes couponsPageRise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes couponStatRise {
          from { opacity: 0; transform: translateY(14px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes couponCardRise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes couponStatShine {
          0%, 62% { left: -42%; opacity: 0; }
          68% { opacity: .7; }
          100% { left: 126%; opacity: 0; }
        }

        @keyframes couponHeroShine {
          0%, 62% { left: -40%; opacity: 0; }
          68% { opacity: .6; }
          100% { left: 125%; opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .01ms !important;
          }
        }

        @media (max-width: 1000px) {
          .coupons-layout {
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

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
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
    <div className="coupon-summary-card">
      <div className="coupon-summary-icon">{icon}</div>
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: "#F8FAFC",
        borderRadius: "9px",
        padding: "11px",
      }}
    >
      <p
        style={{
          color: "#777",
          fontSize: "12px",
          margin: "0 0 4px",
        }}
      >
        {label}
      </p>

      <strong
        style={{
          color: "#0A2E73",
          fontSize: "14px",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  let background = "#DCFCE7";
  let color = "#166534";

  if (status === "Inactive") {
    background = "#FEE2E2";
    color = "#B91C1C";
  }

  if (status === "Scheduled") {
    background = "#DBEAFE";
    color = "#1D4ED8";
  }

  if (
    status === "Expired" ||
    status === "Limit Reached"
  ) {
    background = "#FEF3C7";
    color = "#92400E";
  }

  return (
    <span
      style={{
        position: "absolute",
        top: "18px",
        right: "18px",
        background,
        color,
        padding: "7px 11px",
        borderRadius: "999px",
        fontWeight: 800,
        fontSize: "12px",
      }}
    >
      {status}
    </span>
  );
}