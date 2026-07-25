"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProductReviewsProps = {
  productId: string | number;
  productName: string;
};

type Review = {
  id: number;
  product_id?: number | null;
  product_name?: string | null;
  customer_name?: string | null;
  rating?: number | null;
  review?: string | null;
  is_approved?: boolean | null;
  created_at?: string | null;
};

export default function ProductReviews({
  productId,
  productName,
}: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [selectedRating, setSelectedRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");

  useEffect(() => {
    loadReviews();
  }, [productId]);

  async function loadReviews() {
    setLoading(true);

    try {
      const numericProductId = Number(productId);

      if (!Number.isFinite(numericProductId)) {
        throw new Error("Invalid product ID.");
      }

      const { data, error } = await supabase
        .from("reviews")
        .select(
          `
            id,
            product_id,
            product_name,
            customer_name,
            rating,
            review,
            is_approved,
            created_at
          `
        )
        .eq("product_id", numericProductId)
        .eq("is_approved", true)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setReviews((data as Review[]) || []);
    } catch (error) {
      console.error("Reviews loading error:", error);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }

  const averageRating = useMemo(() => {
    if (reviews.length === 0) {
      return 0;
    }

    const total = reviews.reduce(
      (sum, item) => sum + Number(item.rating || 0),
      0
    );

    return total / reviews.length;
  }, [reviews]);

  const ratingPercentages = useMemo(() => {
    const totalReviews = reviews.length;

    return [5, 4, 3, 2, 1].map((star) => {
      const count = reviews.filter(
        (item) => Number(item.rating || 0) === star
      ).length;

      return {
        star,
        count,
        percentage:
          totalReviews === 0
            ? 0
            : Math.round((count / totalReviews) * 100),
      };
    });
  }, [reviews]);

  function showMessage(
    text: string,
    type: "success" | "error"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = customerName.trim();
    const cleanReview = reviewText.trim();
    const numericProductId = Number(productId);

    if (!cleanName) {
      showMessage("Please enter your name.", "error");
      return;
    }

    if (cleanName.length < 2) {
      showMessage(
        "Customer name must contain at least 2 characters.",
        "error"
      );
      return;
    }

    if (!cleanReview) {
      showMessage("Please write your review.", "error");
      return;
    }

    if (cleanReview.length < 10) {
      showMessage(
        "Please write at least 10 characters in your review.",
        "error"
      );
      return;
    }

    if (
      !Number.isInteger(selectedRating) ||
      selectedRating < 1 ||
      selectedRating > 5
    ) {
      showMessage("Please select a rating from 1 to 5.", "error");
      return;
    }

    if (!Number.isFinite(numericProductId)) {
      showMessage("Invalid product ID.", "error");
      return;
    }

    setSubmitting(true);
    setMessage("");
    setMessageType("");

    try {
      const { error } = await supabase.from("reviews").insert({
        product_id: numericProductId,
        product_name: productName,
        customer_name: cleanName,
        rating: selectedRating,
        review: cleanReview,
        is_approved: false,
      });

      if (error) {
        throw error;
      }

      setCustomerName("");
      setReviewText("");
      setSelectedRating(5);
      setHoverRating(0);

      showMessage(
        "Thank you! Your review was submitted and will appear after admin approval.",
        "success"
      );
    } catch (error: any) {
      console.error("Review submission error:", error);

      showMessage(
        error?.message ||
          "Review could not be submitted. Please try again.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  }

  function formatReviewDate(value?: string | null) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function renderStars(rating: number, className = "") {
    return (
      <div
        className={`displayStars ${className}`}
        aria-label={`${rating} out of 5 stars`}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={star <= Math.round(rating) ? "filled" : ""}
          >
            ★
          </span>
        ))}
      </div>
    );
  }

  return (
    <section className="reviewsSection">
      <div className="sectionHeading">
        <p>NEW CITY STYLE</p>
        <h2>Ratings &amp; Customer Reviews</h2>
        <span>
          Genuine customer feedback helps every family shop with
          confidence.
        </span>
      </div>

      <div className="reviewSummary">
        <div className="averageBox">
          <strong>
            {reviews.length > 0 ? averageRating.toFixed(1) : "0.0"}
          </strong>

          {renderStars(averageRating, "largeStars")}

          <p>
            Based on {reviews.length}{" "}
            {reviews.length === 1 ? "review" : "reviews"}
          </p>
        </div>

        <div className="ratingBars">
          {ratingPercentages.map((item) => (
            <div className="ratingRow" key={item.star}>
              <span>{item.star} ★</span>

              <div className="barTrack">
                <div
                  className="barFill"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>

              <small>{item.count}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="reviewsLayout">
        <div className="reviewsList">
          <div className="listHeading">
            <div>
              <h3>Customer Reviews</h3>
              <p>Approved feedback from our customers.</p>
            </div>

            <span>{reviews.length}</span>
          </div>

          {loading ? (
            <div className="loadingState">
              <div className="spinner" />
              <p>Loading customer reviews...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="emptyReviews">
              <div>⭐</div>
              <h4>No approved reviews yet</h4>
              <p>
                Be the first customer to share your experience with this
                product.
              </p>
            </div>
          ) : (
            <div className="reviewCards">
              {reviews.map((item) => {
                const reviewerName =
                  item.customer_name?.trim() || "NCS Customer";

                const firstLetter =
                  reviewerName.charAt(0).toUpperCase() || "N";

                return (
                  <article className="reviewCard" key={item.id}>
                    <div className="reviewTop">
                      <div className="reviewer">
                        <div className="avatar">{firstLetter}</div>

                        <div>
                          <h4>{reviewerName}</h4>
                          <p>Verified Customer</p>
                        </div>
                      </div>

                      <span className="approvedBadge">
                        ✓ Approved
                      </span>
                    </div>

                    <div className="reviewRating">
                      {renderStars(Number(item.rating || 0))}

                      <small>
                        {formatReviewDate(item.created_at)}
                      </small>
                    </div>

                    <p className="reviewBody">
                      {item.review?.trim() ||
                        "Customer rated this product."}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <form className="reviewForm" onSubmit={submitReview}>
          <div className="formHeading">
            <span>WRITE A REVIEW</span>
            <h3>Share Your Experience</h3>
            <p>
              Your review will be visible after approval by NEW CITY
              STYLE.
            </p>
          </div>

          <label htmlFor="review-customer-name">
            Customer Name
          </label>

          <input
            id="review-customer-name"
            type="text"
            value={customerName}
            onChange={(event) =>
              setCustomerName(event.target.value)
            }
            placeholder="Enter your name"
            maxLength={80}
            disabled={submitting}
          />

          <label>Your Rating</label>

          <div
            className="starSelector"
            onMouseLeave={() => setHoverRating(0)}
          >
            {[1, 2, 3, 4, 5].map((star) => {
              const activeRating = hoverRating || selectedRating;

              return (
                <button
                  type="button"
                  key={star}
                  className={
                    star <= activeRating ? "selectedStar" : ""
                  }
                  onMouseEnter={() => setHoverRating(star)}
                  onFocus={() => setHoverRating(star)}
                  onBlur={() => setHoverRating(0)}
                  onClick={() => setSelectedRating(star)}
                  aria-label={`Select ${star} star rating`}
                  disabled={submitting}
                >
                  ★
                </button>
              );
            })}

            <span>{selectedRating} / 5</span>
          </div>

          <label htmlFor="review-message">
            Your Review
          </label>

          <textarea
            id="review-message"
            value={reviewText}
            onChange={(event) => setReviewText(event.target.value)}
            placeholder="Tell us about the product quality, fitting and your shopping experience..."
            rows={6}
            maxLength={1000}
            disabled={submitting}
          />

          <div className="characterCount">
            {reviewText.length} / 1000
          </div>

          {message && (
            <div
              className={`formMessage ${
                messageType === "success"
                  ? "successMessage"
                  : "errorMessage"
              }`}
            >
              {message}
            </div>
          )}

          <button
            className="submitButton"
            type="submit"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="buttonSpinner" />
                Submitting Review...
              </>
            ) : (
              <>
                Submit Review
                <span>→</span>
              </>
            )}
          </button>

          <p className="approvalNote">
            🛡️ Reviews are checked before they are published.
          </p>
        </form>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .reviewsSection {
          width: min(1400px, calc(100% - 32px));
          margin: 50px auto;
          padding: 50px;
          border: 1px solid rgba(10, 46, 115, 0.08);
          border-radius: 30px;
          background:
            radial-gradient(
              circle at 95% 5%,
              rgba(212, 175, 55, 0.12),
              transparent 22%
            ),
            linear-gradient(145deg, #ffffff, #f8f4ec);
          box-shadow: 0 24px 70px rgba(10, 46, 115, 0.1);
        }

        .sectionHeading {
          max-width: 760px;
          margin: 0 auto;
          text-align: center;
        }

        .sectionHeading > p {
          margin: 0;
          color: #d4af37;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2.2px;
        }

        .sectionHeading h2 {
          margin: 10px 0 0;
          color: #0a2e73;
          font-size: clamp(32px, 4vw, 48px);
          line-height: 1.1;
          letter-spacing: -1.3px;
        }

        .sectionHeading > span {
          display: block;
          margin-top: 14px;
          color: #687386;
          font-size: 15px;
          line-height: 1.7;
        }

        .reviewSummary {
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
          gap: 38px;
          align-items: center;
          max-width: 900px;
          margin: 38px auto 0;
          padding: 28px;
          border: 1px solid rgba(10, 46, 115, 0.09);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.76);
        }

        .averageBox {
          text-align: center;
        }

        .averageBox > strong {
          display: block;
          color: #0a2e73;
          font-size: 58px;
          font-weight: 950;
          line-height: 1;
        }

        .averageBox > p {
          margin: 9px 0 0;
          color: #758094;
          font-size: 12px;
        }

        .displayStars {
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .displayStars span {
          color: #d8dce5;
          font-size: 16px;
        }

        .displayStars .filled {
          color: #d4af37;
        }

        .largeStars {
          justify-content: center;
          margin-top: 10px;
        }

        .largeStars span {
          font-size: 23px;
        }

        .ratingBars {
          display: grid;
          gap: 9px;
        }

        .ratingRow {
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr) 34px;
          gap: 10px;
          align-items: center;
        }

        .ratingRow > span {
          color: #0a2e73;
          font-size: 12px;
          font-weight: 800;
        }

        .ratingRow small {
          color: #7b8495;
          font-size: 11px;
          text-align: right;
        }

        .barTrack {
          overflow: hidden;
          height: 9px;
          border-radius: 999px;
          background: #e5e9f1;
        }

        .barFill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #d4af37, #f1d26a);
          transition: width 0.4s ease;
        }

        .reviewsLayout {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(350px, 0.75fr);
          gap: 28px;
          align-items: start;
          margin-top: 40px;
        }

        .reviewsList,
        .reviewForm {
          border: 1px solid rgba(10, 46, 115, 0.09);
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 15px 38px rgba(10, 46, 115, 0.07);
        }

        .reviewsList {
          padding: 28px;
        }

        .listHeading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 21px;
          border-bottom: 1px solid #e8ebf1;
        }

        .listHeading h3 {
          margin: 0;
          color: #0a2e73;
          font-size: 25px;
        }

        .listHeading p {
          margin: 6px 0 0;
          color: #7b8495;
          font-size: 12px;
        }

        .listHeading > span {
          min-width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: linear-gradient(135deg, #d4af37, #f1d26a);
          color: #0a2e73;
          font-size: 14px;
          font-weight: 950;
        }

        .reviewCards {
          display: grid;
          gap: 14px;
          margin-top: 20px;
        }

        .reviewCard {
          padding: 19px;
          border: 1px solid #e8ebf1;
          border-radius: 17px;
          background: #ffffff;
        }

        .reviewTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .reviewer {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .avatar {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 13px;
          background: linear-gradient(145deg, #0a2e73, #174ba9);
          color: #d4af37;
          font-size: 16px;
          font-weight: 950;
        }

        .reviewer h4 {
          margin: 0;
          color: #0a2e73;
          font-size: 14px;
        }

        .reviewer p {
          margin: 3px 0 0;
          color: #8590a3;
          font-size: 10px;
        }

        .approvedBadge {
          padding: 6px 9px;
          border-radius: 999px;
          background: #eaf9f0;
          color: #168446;
          font-size: 9px;
          font-weight: 850;
        }

        .reviewRating {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-top: 15px;
        }

        .reviewRating small {
          color: #9099aa;
          font-size: 10px;
        }

        .reviewBody {
          margin: 13px 0 0;
          color: #525d70;
          font-size: 13px;
          line-height: 1.7;
          white-space: pre-line;
        }

        .loadingState,
        .emptyReviews {
          min-height: 250px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          text-align: center;
        }

        .loadingState p,
        .emptyReviews p {
          max-width: 390px;
          margin: 12px 0 0;
          color: #7c8798;
          font-size: 12px;
          line-height: 1.6;
        }

        .emptyReviews > div {
          font-size: 42px;
        }

        .emptyReviews h4 {
          margin: 15px 0 0;
          color: #0a2e73;
          font-size: 20px;
        }

        .spinner,
        .buttonSpinner {
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .spinner {
          width: 34px;
          height: 34px;
          border: 4px solid #e3e7ef;
          border-top-color: #d4af37;
        }

        .reviewForm {
          position: sticky;
          top: 22px;
          padding: 28px;
        }

        .formHeading > span {
          color: #d4af37;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 1.5px;
        }

        .formHeading h3 {
          margin: 8px 0 0;
          color: #0a2e73;
          font-size: 26px;
          line-height: 1.15;
        }

        .formHeading p {
          margin: 10px 0 0;
          color: #788396;
          font-size: 11px;
          line-height: 1.6;
        }

        .reviewForm label {
          display: block;
          margin-top: 20px;
          color: #0a2e73;
          font-size: 12px;
          font-weight: 850;
        }

        .reviewForm input,
        .reviewForm textarea {
          width: 100%;
          margin-top: 8px;
          border: 1px solid #d9deea;
          border-radius: 12px;
          outline: none;
          background: #fbfcff;
          color: #162544;
          font-family: inherit;
          font-size: 13px;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .reviewForm input {
          height: 48px;
          padding: 0 14px;
        }

        .reviewForm textarea {
          min-height: 135px;
          resize: vertical;
          padding: 13px 14px;
          line-height: 1.6;
        }

        .reviewForm input:focus,
        .reviewForm textarea:focus {
          border-color: #d4af37;
          box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.12);
        }

        .reviewForm input:disabled,
        .reviewForm textarea:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .starSelector {
          display: flex;
          align-items: center;
          gap: 3px;
          margin-top: 9px;
        }

        .starSelector button {
          padding: 0;
          border: 0;
          background: transparent;
          color: #d8dce5;
          font-size: 32px;
          line-height: 1;
          cursor: pointer;
          transition:
            color 0.15s ease,
            transform 0.15s ease;
        }

        .starSelector button:hover,
        .starSelector .selectedStar {
          color: #d4af37;
          transform: scale(1.08);
        }

        .starSelector > span {
          margin-left: 9px;
          color: #0a2e73;
          font-size: 11px;
          font-weight: 850;
        }

        .characterCount {
          margin-top: 5px;
          color: #939bab;
          font-size: 9px;
          text-align: right;
        }

        .formMessage {
          margin-top: 16px;
          padding: 11px 12px;
          border-radius: 10px;
          font-size: 10px;
          line-height: 1.5;
        }

        .successMessage {
          border: 1px solid #b9e9ca;
          background: #ebfaf1;
          color: #14733c;
        }

        .errorMessage {
          border: 1px solid #ffc6c6;
          background: #fff0f0;
          color: #b42318;
        }

        .submitButton {
          width: 100%;
          min-height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 18px;
          border: 0;
          border-radius: 13px;
          background: linear-gradient(100deg, #0a2e73, #174ba9);
          color: #ffffff;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 12px 26px rgba(10, 46, 115, 0.22);
        }

        .submitButton:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .submitButton > span {
          font-size: 18px;
        }

        .buttonSpinner {
          width: 18px;
          height: 18px;
          border: 3px solid rgba(255, 255, 255, 0.35);
          border-top-color: #ffffff;
        }

        .approvalNote {
          margin: 13px 0 0;
          color: #8992a3;
          font-size: 9px;
          text-align: center;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 950px) {
          .reviewsLayout {
            grid-template-columns: 1fr;
          }

          .reviewForm {
            position: static;
          }
        }

        @media (max-width: 700px) {
          .reviewsSection {
            width: calc(100% - 20px);
            margin: 28px auto;
            padding: 25px 13px;
            border-radius: 21px;
          }

          .sectionHeading > p {
            font-size: 9px;
          }

          .sectionHeading h2 {
            font-size: 29px;
          }

          .sectionHeading > span {
            margin-top: 10px;
            font-size: 11px;
            line-height: 1.55;
          }

          .reviewSummary {
            grid-template-columns: 1fr;
            gap: 22px;
            margin-top: 25px;
            padding: 20px 15px;
          }

          .averageBox > strong {
            font-size: 50px;
          }

          .reviewsLayout {
            gap: 16px;
            margin-top: 22px;
          }

          .reviewsList,
          .reviewForm {
            padding: 17px;
            border-radius: 17px;
          }

          .listHeading h3,
          .formHeading h3 {
            font-size: 21px;
          }

          .reviewCard {
            padding: 14px;
          }

          .approvedBadge {
            padding: 5px 7px;
            font-size: 8px;
          }

          .reviewBody {
            font-size: 11px;
          }

          .starSelector button {
            font-size: 29px;
          }
        }
      `}</style>
    </section>
  );
}