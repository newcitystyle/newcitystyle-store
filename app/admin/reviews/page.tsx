"use client";

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Review = {
  id: number;
  customer_name: string;
  product_name: string;
  rating: number;
  review: string;
  is_approved: boolean;
  created_at: string;
};

type ReviewForm = {
  customerName: string;
  productName: string;
  rating: number;
  review: string;
  isApproved: boolean;
};

const emptyForm: ReviewForm = {
  customerName: "",
  productName: "",
  rating: 5,
  review: "",
  isApproved: false,
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [form, setForm] = useState<ReviewForm>(emptyForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    loadReviews();
  }, []);

  async function loadReviews() {
    setLoading(true);

    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(`Unable to load reviews: ${error.message}`);
      setLoading(false);
      return;
    }

    setReviews((data as Review[]) || []);
    setLoading(false);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setSaving(false);
  }

  function startEditing(review: Review) {
    setEditingId(review.id);

    setForm({
      customerName: review.customer_name,
      productName: review.product_name,
      rating: review.rating,
      review: review.review,
      isApproved: review.is_approved,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.customerName.trim()) {
      alert("Please enter the customer name.");
      return;
    }

    if (!form.productName.trim()) {
      alert("Please enter the product name.");
      return;
    }

    if (!form.review.trim()) {
      alert("Please enter the review message.");
      return;
    }

    setSaving(true);

    const reviewData = {
      customer_name: form.customerName.trim(),
      product_name: form.productName.trim(),
      rating: form.rating,
      review: form.review.trim(),
      is_approved: form.isApproved,
    };

    if (editingId !== null) {
      const { data, error } = await supabase
        .from("reviews")
        .update(reviewData)
        .eq("id", editingId)
        .select()
        .single();

      if (error) {
        alert(`Unable to update review: ${error.message}`);
        setSaving(false);
        return;
      }

      setReviews((current) =>
        current.map((review) =>
          review.id === editingId ? (data as Review) : review
        )
      );

      alert("Review updated successfully.");
    } else {
      const { data, error } = await supabase
        .from("reviews")
        .insert(reviewData)
        .select()
        .single();

      if (error) {
        alert(`Unable to add review: ${error.message}`);
        setSaving(false);
        return;
      }

      setReviews((current) => [data as Review, ...current]);
      alert("Review added successfully.");
    }

    resetForm();
  }

  async function toggleApproval(review: Review) {
    const newStatus = !review.is_approved;

    const { error } = await supabase
      .from("reviews")
      .update({
        is_approved: newStatus,
      })
      .eq("id", review.id);

    if (error) {
      alert(`Unable to update review status: ${error.message}`);
      return;
    }

    setReviews((current) =>
      current.map((item) =>
        item.id === review.id
          ? {
              ...item,
              is_approved: newStatus,
            }
          : item
      )
    );
  }

  async function deleteReview(review: Review) {
    const confirmed = window.confirm(
      `Are you sure you want to delete the review from "${review.customer_name}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", review.id);

    if (error) {
      alert(`Unable to delete review: ${error.message}`);
      return;
    }

    setReviews((current) =>
      current.filter((item) => item.id !== review.id)
    );

    if (editingId === review.id) {
      resetForm();
    }

    alert("Review deleted successfully.");
  }

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase();

    return reviews.filter((review) => {
      const matchesSearch =
        !query ||
        review.customer_name.toLowerCase().includes(query) ||
        review.product_name.toLowerCase().includes(query) ||
        review.review.toLowerCase().includes(query);

      const matchesFilter =
        filter === "All" ||
        (filter === "Approved" && review.is_approved) ||
        (filter === "Pending" && !review.is_approved) ||
        (filter === "5 Stars" && review.rating === 5) ||
        (filter === "4 Stars" && review.rating === 4) ||
        (filter === "3 Stars" && review.rating === 3) ||
        (filter === "2 Stars" && review.rating === 2) ||
        (filter === "1 Star" && review.rating === 1);

      return matchesSearch && matchesFilter;
    });
  }, [reviews, search, filter]);

  const approvedCount = reviews.filter(
    (review) => review.is_approved
  ).length;

  const pendingCount = reviews.length - approvedCount;

  const averageRating =
    reviews.length === 0
      ? 0
      : reviews.reduce(
          (sum, review) => sum + Number(review.rating || 0),
          0
        ) / reviews.length;

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
            Reviews Management
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              opacity: 0.9,
            }}
          >
            Add, approve, edit and manage customer product reviews.
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
            icon="⭐"
            title="Total Reviews"
            value={reviews.length}
          />

          <SummaryCard
            icon="✅"
            title="Approved Reviews"
            value={approvedCount}
          />

          <SummaryCard
            icon="⏳"
            title="Pending Reviews"
            value={pendingCount}
          />

          <SummaryCard
            icon="📊"
            title="Average Rating"
            value={
              reviews.length === 0
                ? "0.0"
                : averageRating.toFixed(1)
            }
          />
        </section>

        <div
          className="reviews-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "390px minmax(0, 1fr)",
            gap: "24px",
            alignItems: "start",
          }}
        >
          <section
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
              {editingId === null ? "Add Review" : "Edit Review"}
            </h2>

            <form onSubmit={saveReview}>
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
                  placeholder="Reviewed product name"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      productName: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Rating">
                <select
                  value={form.rating}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      rating: Number(event.target.value),
                    }))
                  }
                  style={inputStyle}
                >
                  <option value={5}>5 Stars - Excellent</option>
                  <option value={4}>4 Stars - Very Good</option>
                  <option value={3}>3 Stars - Good</option>
                  <option value={2}>2 Stars - Average</option>
                  <option value={1}>1 Star - Poor</option>
                </select>
              </FormField>

              <FormField label="Review Message">
                <textarea
                  value={form.review}
                  placeholder="Write the customer review..."
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      review: event.target.value,
                    }))
                  }
                  style={{
                    ...inputStyle,
                    minHeight: "125px",
                    resize: "vertical",
                  }}
                />
              </FormField>

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
                  checked={form.isApproved}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isApproved: event.target.checked,
                    }))
                  }
                />

                Approve this review
              </label>

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
                  cursor: saving ? "not-allowed" : "pointer",
                  fontWeight: 800,
                  fontSize: "16px",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : editingId === null
                    ? "Add Review"
                    : "Update Review"}
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
                  Customer Reviews
                </h2>

                <p
                  style={{
                    color: "#666",
                    margin: 0,
                  }}
                >
                  {filteredReviews.length} reviews found
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <input
                  value={search}
                  placeholder="Search reviews..."
                  onChange={(event) => setSearch(event.target.value)}
                  style={{
                    ...inputStyle,
                    width: "220px",
                  }}
                />

                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  style={{
                    ...inputStyle,
                    width: "160px",
                  }}
                >
                  <option value="All">All Reviews</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="5 Stars">5 Stars</option>
                  <option value="4 Stars">4 Stars</option>
                  <option value="3 Stars">3 Stars</option>
                  <option value="2 Stars">2 Stars</option>
                  <option value="1 Star">1 Star</option>
                </select>

                <button
                  type="button"
                  onClick={loadReviews}
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
              <div style={messageStyle}>Loading Reviews...</div>
            ) : filteredReviews.length === 0 ? (
              <div style={messageStyle}>No reviews were found.</div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "16px",
                }}
              >
                {filteredReviews.map((review) => (
                  <article
                    key={review.id}
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: "15px",
                      padding: "20px",
                      background: "#FFFFFF",
                      boxShadow: "0 5px 18px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: "15px",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            color: "#777",
                            fontSize: "13px",
                            margin: "0 0 5px",
                          }}
                        >
                          Review ID #{review.id}
                        </p>

                        <h3
                          style={{
                            color: "#0A2E73",
                            margin: "0 0 6px",
                            fontSize: "21px",
                          }}
                        >
                          {review.customer_name}
                        </h3>

                        <p
                          style={{
                            color: "#555",
                            margin: 0,
                          }}
                        >
                          Product:{" "}
                          <strong>{review.product_name}</strong>
                        </p>
                      </div>

                      <span
                        style={{
                          background: review.is_approved
                            ? "#DCFCE7"
                            : "#FEF3C7",
                          color: review.is_approved
                            ? "#166534"
                            : "#92400E",
                          padding: "7px 12px",
                          borderRadius: "999px",
                          fontWeight: 800,
                          fontSize: "13px",
                        }}
                      >
                        {review.is_approved ? "Approved" : "Pending"}
                      </span>
                    </div>

                    <div
                      style={{
                        color: "#F59E0B",
                        fontSize: "23px",
                        letterSpacing: "2px",
                        marginTop: "14px",
                      }}
                    >
                      {"★".repeat(review.rating)}
                      <span
                        style={{
                          color: "#D1D5DB",
                        }}
                      >
                        {"★".repeat(5 - review.rating)}
                      </span>
                    </div>

                    <div
                      style={{
                        background: "#F8FAFC",
                        borderRadius: "10px",
                        padding: "14px",
                        marginTop: "14px",
                      }}
                    >
                      <p
                        style={{
                          color: "#555",
                          margin: 0,
                          lineHeight: 1.7,
                        }}
                      >
                        {review.review}
                      </p>
                    </div>

                    <p
                      style={{
                        color: "#888",
                        fontSize: "13px",
                        margin: "13px 0 0",
                      }}
                    >
                      Added on{" "}
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>

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
                        onClick={() => startEditing(review)}
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
                        onClick={() => toggleApproval(review)}
                        style={{
                          background: review.is_approved
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
                        {review.is_approved
                          ? "Move to Pending"
                          : "Approve Review"}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteReview(review)}
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
                      Delete Review
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 980px) {
          .reviews-layout {
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
        boxShadow: "0 7px 22px rgba(0,0,0,0.07)",
        border: "1px solid rgba(212,175,55,0.22)",
      }}
    >
      <div style={{ fontSize: "29px" }}>{icon}</div>

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