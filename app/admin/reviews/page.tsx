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
        className="reviews-page-shell"
        style={{
          maxWidth: "1350px",
          margin: "0 auto",
        }}
      >
        <section
          className="reviews-hero"
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
          className="reviews-summary-grid"
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
            className="reviews-form-panel"
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
                className="reviews-primary-button"
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
                    ? "Add Review"
                    : "Update Review"}
              </button>

              {editingId !== null && (
                <button
                  className="reviews-secondary-button"
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
            className="reviews-list-panel"
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
                  className="reviews-refresh-button"
                  type="button"
                  onClick={loadReviews}
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
                    className="review-card"
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
                          background: "linear-gradient(135deg, #03153F, #0A2E73)",
                          color: "#FFFFFF",
                          border: "1px solid rgba(212,175,55,0.75)",
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
        .reviews-page-shell {
          animation: reviewsPageRise 0.5s ease both;
        }

        .reviews-hero {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          animation: reviewsPageRise 0.55s ease both;
        }

        .reviews-hero::after {
          content: "";
          position: absolute;
          top: -140%;
          left: -35%;
          width: 36%;
          height: 370%;
          transform: rotate(22deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,.14),
            transparent
          );
          animation: reviewHeroShine 5.3s ease-in-out infinite;
          pointer-events: none;
        }

        .reviews-summary-grid > * {
          opacity: 0;
          animation: reviewStatRise 0.45s ease forwards;
        }

        .reviews-summary-grid > *:nth-child(1) { animation-delay: .05s; }
        .reviews-summary-grid > *:nth-child(2) { animation-delay: .10s; }
        .reviews-summary-grid > *:nth-child(3) { animation-delay: .15s; }
        .reviews-summary-grid > *:nth-child(4) { animation-delay: .20s; }

        .review-summary-card {
          position: relative;
          isolation: isolate;
          min-height: 140px;
          overflow: hidden;
          padding: 20px;
          border: 1px solid rgba(212,175,55,.22);
          border-radius: 18px;
          background: linear-gradient(
            135deg,
            rgba(10,46,115,.99),
            rgba(3,21,63,.98)
          );
          box-shadow:
            0 12px 28px rgba(3,21,63,.16),
            inset 0 1px 0 rgba(255,255,255,.06);
          transition:
            transform .22s ease,
            box-shadow .22s ease,
            border-color .22s ease;
        }

        .review-summary-card:nth-child(2) {
          background: linear-gradient(
            135deg,
            rgba(10,46,115,.99),
            rgba(22,46,102,.98),
            rgba(103,79,16,.90)
          );
        }

        .review-summary-card:nth-child(3) {
          background: linear-gradient(
            135deg,
            rgba(5,25,74,.99),
            rgba(8,37,96,.98)
          );
        }

        .review-summary-card:nth-child(4) {
          background: linear-gradient(
            135deg,
            rgba(18,35,82,.99),
            rgba(119,75,12,.92)
          );
        }

        .review-summary-card::before {
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
            rgba(212,175,55,.34),
            rgba(212,175,55,0)
          );
        }

        .review-summary-card::after {
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
            rgba(255,255,255,.14),
            transparent
          );
          animation: reviewStatShine 5.2s ease-in-out infinite;
          pointer-events: none;
        }

        .review-summary-card:hover {
          transform: translateY(-3px) scale(1.004);
          border-color: rgba(212,175,55,.42);
          box-shadow:
            0 16px 32px rgba(3,21,63,.22),
            0 0 0 1px rgba(212,175,55,.10);
        }

        .review-summary-icon {
          position: relative;
          z-index: 2;
          color: #D4AF37;
          font-size: 30px;
          filter: drop-shadow(0 4px 10px rgba(0,0,0,.18));
        }

        .review-summary-card p {
          position: relative;
          z-index: 2;
          margin: 10px 0 5px;
          color: rgba(212,175,55,.94);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .45px;
          text-transform: uppercase;
        }

        .review-summary-card h2 {
          position: relative;
          z-index: 2;
          margin: 0;
          color: #FFFFFF;
          font-size: 29px;
          font-weight: 950;
          letter-spacing: -.5px;
          text-shadow: 0 2px 10px rgba(0,0,0,.15);
        }

        .review-summary-card:nth-child(4) h2 {
          color: #F6D676;
        }

        .reviews-form-panel,
        .reviews-list-panel,
        .review-card {
          transition:
            transform .22s ease,
            box-shadow .22s ease,
            border-color .22s ease;
        }

        .reviews-form-panel:hover,
        .reviews-list-panel:hover {
          transform: translateY(-2px);
          border-color: rgba(212,175,55,.38) !important;
          box-shadow: 0 14px 32px rgba(3,21,63,.10) !important;
        }

        .review-card {
          animation: reviewCardRise .42s ease both;
        }

        .review-card:hover {
          transform: translateY(-3px);
          border-color: rgba(212,175,55,.48) !important;
          box-shadow: 0 16px 34px rgba(3,21,63,.13) !important;
        }

        .review-card div[style*="color: #F59E0B"] {
          animation: reviewStarGlow 2.8s ease-in-out infinite;
        }

        .reviews-primary-button,
        .reviews-secondary-button,
        .reviews-refresh-button,
        .review-card button {
          transition:
            transform .18s ease,
            box-shadow .18s ease,
            filter .18s ease;
        }

        .reviews-primary-button:hover:not(:disabled),
        .reviews-refresh-button:hover,
        .review-card button:hover {
          transform: translateY(-1px);
          filter: brightness(1.04);
        }

        input,
        textarea,
        select {
          transition:
            border-color .18s ease,
            box-shadow .18s ease,
            transform .18s ease;
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: #0A2E73 !important;
          box-shadow: 0 0 0 4px rgba(10,46,115,.10);
        }

        @keyframes reviewsPageRise {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes reviewStatRise {
          from {
            opacity: 0;
            transform: translateY(14px) scale(.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes reviewCardRise {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes reviewStatShine {
          0%, 62% {
            left: -42%;
            opacity: 0;
          }
          68% {
            opacity: .7;
          }
          100% {
            left: 126%;
            opacity: 0;
          }
        }

        @keyframes reviewHeroShine {
          0%, 62% {
            left: -40%;
            opacity: 0;
          }
          68% {
            opacity: .6;
          }
          100% {
            left: 125%;
            opacity: 0;
          }
        }

        @keyframes reviewStarGlow {
          0%, 100% {
            filter: drop-shadow(0 0 0 rgba(245,158,11,0));
          }
          50% {
            filter: drop-shadow(0 0 8px rgba(245,158,11,.35));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .01ms !important;
          }
        }

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
    <div className="review-summary-card">
      <div className="review-summary-icon">{icon}</div>
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  );
}