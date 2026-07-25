"use client";

import Link from "next/link";

const currentYear = 2026;

export default function Footer() {
  return (
    <footer className="footer">
      <div className="topGlow" />

      <div className="footerShell">
        <section className="trustStrip">
          <article>
            <span>🚚</span>
            <div>
              <strong>Free Shipping</strong>
              <small>On eligible orders</small>
            </div>
          </article>

          <article>
            <span>↺</span>
            <div>
              <strong>Easy Returns</strong>
              <small>Customer-friendly policy</small>
            </div>
          </article>

          <article>
            <span>🔒</span>
            <div>
              <strong>Secure Payments</strong>
              <small>Trusted checkout experience</small>
            </div>
          </article>

          <article>
            <span>✓</span>
            <div>
              <strong>Quality Assured</strong>
              <small>Carefully selected products</small>
            </div>
          </article>
        </section>

        <section className="footerGrid">
          <div className="brandColumn">
            <Link href="/" className="brand">
              <span className="brandMark">NCS</span>

              <span>
                <strong>NEW CITY STYLE</strong>
                <small>Style for Every Family</small>
              </span>
            </Link>

            <p className="brandDescription">
              Premium fashion for men, women and kids with trusted quality,
              honest value and a smooth shopping experience.
            </p>

            <div className="contactList">
              <a
                href="https://maps.google.com/?q=Sarubujjili,Srikakulam,Andhra+Pradesh"
                target="_blank"
                rel="noreferrer"
              >
                <span>📍</span>
                <div>
                  <strong>Store Location</strong>
                  <small>Sarubujjili, Srikakulam, Andhra Pradesh</small>
                </div>
              </a>

              <a href="tel:+919010014001">
                <span>📞</span>
                <div>
                  <strong>Customer Care</strong>
                  <small>+91 9010014001</small>
                </div>
              </a>

              <a href="mailto:customercare@newcitystyle.in">
                <span>✉</span>
                <div>
                  <strong>Email Support</strong>
                  <small>customercare@newcitystyle.in</small>
                </div>
              </a>
            </div>
          </div>

          <div className="linkColumn">
            <h3>Shop</h3>

            <Link href="/search?q=Men">Men&apos;s Fashion</Link>
<Link href="/search?q=Women">Women&apos;s Fashion</Link>
<Link href="/search?q=Kids">Kids&apos; Fashion</Link>
<Link href="/search?q=Sarees">Premium Sarees</Link>
<Link href="/collections">All Collections</Link>
          </div>

          <div className="linkColumn">
            <h3>Customer Service</h3>

            <Link href="/orders">My Orders</Link>
            <Link href="/cart">Shopping Cart</Link>
            <Link href="/wishlist">Wishlist</Link>
            <Link href="/shipping">Shipping Information</Link>
            <Link href="/returns">Returns & Refunds</Link>
          </div>

          <div className="linkColumn">
            <h3>Company</h3>

            <Link href="/about">About NEW CITY STYLE</Link>
            <Link href="/contact">Contact Us</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms & Conditions</Link>
            <Link href="/faq">Frequently Asked Questions</Link>
          </div>

          <div className="newsletterColumn">
            <h3>Stay Updated</h3>

            <p>
              Get new arrivals, festive collections and exclusive offers from
              NEW CITY STYLE.
            </p>

            <form
              className="newsletter"
              onSubmit={(event) => event.preventDefault()}
            >
              <input
                type="email"
                placeholder="Enter your email"
                aria-label="Email address"
              />

              <button type="submit">Subscribe</button>
            </form>

            <div className="socialLinks">
              <a href="#" aria-label="Facebook">
                f
              </a>

              <a href="#" aria-label="Instagram">
                ◎
              </a>

              <a href="https://wa.me/919010014001" aria-label="WhatsApp">
                ☏
              </a>

              <a href="#" aria-label="YouTube">
                ▶
              </a>
            </div>
          </div>
        </section>

        <section className="paymentRow">
          <div>
            <span>Secure Payments</span>
            <strong>UPI</strong>
            <strong>Visa</strong>
            <strong>Mastercard</strong>
            <strong>RuPay</strong>
            <strong>Net Banking</strong>
          </div>

          <p>100% secure shopping with trusted payment methods.</p>
        </section>

        <section className="bottomBar">
          <p>
            © {currentYear} <strong>NEW CITY STYLE</strong>. All Rights
            Reserved.
          </p>

          <div className="credit">
            <span>Designed by</span>
            <strong>LV CREATION</strong>
          </div>
        </section>
      </div>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        .footer {
          position: relative;
          overflow: hidden;
          margin-top: 80px;
          background:
            radial-gradient(
              circle at 85% 18%,
              rgba(212, 175, 55, 0.13),
              transparent 24%
            ),
            linear-gradient(180deg, #071d49 0%, #04132f 100%);
          color: white;
        }

        .topGlow {
          height: 3px;
          background: linear-gradient(
            90deg,
            transparent,
            #d4af37,
            #f1d26a,
            #d4af37,
            transparent
          );
          box-shadow: 0 0 24px rgba(212, 175, 55, 0.55);
        }

        .footerShell {
          width: min(1500px, calc(100% - 40px));
          margin: 0 auto;
          padding: 0 0 24px;
        }

        .trustStrip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1px;
          overflow: hidden;
          margin-top: 32px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.08);
        }

        .trustStrip article {
          min-height: 96px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 18px;
          background: rgba(255, 255, 255, 0.04);
          transition:
            background 0.2s ease,
            transform 0.2s ease;
        }

        .trustStrip article:hover {
          background: rgba(212, 175, 55, 0.1);
          transform: translateY(-2px);
        }

        .trustStrip article > span {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 13px;
          background: rgba(212, 175, 55, 0.13);
          color: #d4af37;
          font-size: 21px;
        }

        .trustStrip strong,
        .trustStrip small {
          display: block;
        }

        .trustStrip strong {
          color: white;
          font-size: 13px;
        }

        .trustStrip small {
          margin-top: 4px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 10px;
        }

        .footerGrid {
          display: grid;
          grid-template-columns: 1.5fr 0.8fr 0.95fr 0.95fr 1.2fr;
          gap: 38px;
          padding: 55px 0 44px;
        }

        .brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          color: white;
          text-decoration: none;
        }

        .brandMark {
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #d4af37;
          border-radius: 14px;
          background: rgba(212, 175, 55, 0.1);
          color: #d4af37;
          font-size: 13px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .brand strong,
        .brand small {
          display: block;
        }

        .brand strong {
          color: #d4af37;
          font-size: 24px;
          letter-spacing: 0.7px;
        }

        .brand small {
          margin-top: 5px;
          color: rgba(255, 255, 255, 0.66);
          font-size: 10px;
          letter-spacing: 1.2px;
        }

        .brandDescription {
          max-width: 380px;
          margin: 21px 0 0;
          color: rgba(255, 255, 255, 0.68);
          font-size: 13px;
          line-height: 1.75;
        }

        .contactList {
          display: grid;
          gap: 10px;
          margin-top: 24px;
        }

        .contactList a {
          display: flex;
          align-items: center;
          gap: 11px;
          color: white;
          text-decoration: none;
        }

        .contactList a > span {
          width: 35px;
          height: 35px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.06);
        }

        .contactList strong,
        .contactList small {
          display: block;
        }

        .contactList strong {
          color: rgba(255, 255, 255, 0.92);
          font-size: 11px;
        }

        .contactList small {
          margin-top: 3px;
          color: rgba(255, 255, 255, 0.55);
          font-size: 10px;
        }

        .linkColumn,
        .newsletterColumn {
          min-width: 0;
        }

        .linkColumn h3,
        .newsletterColumn h3 {
          position: relative;
          margin: 0 0 20px;
          padding-bottom: 10px;
          color: #d4af37;
          font-size: 16px;
        }

        .linkColumn h3::after,
        .newsletterColumn h3::after {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 34px;
          height: 2px;
          content: "";
          background: #d4af37;
        }

        .linkColumn {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .linkColumn :global(a) {
          margin-bottom: 12px;
          color: rgba(255, 255, 255, 0.68);
          font-size: 12px;
          text-decoration: none;
          transition:
            color 0.2s ease,
            transform 0.2s ease;
        }

        .linkColumn :global(a:hover) {
          color: #f1d26a;
          transform: translateX(4px);
        }

        .newsletterColumn > p {
          margin: 0;
          color: rgba(255, 255, 255, 0.68);
          font-size: 12px;
          line-height: 1.7;
        }

        .newsletter {
          display: flex;
          overflow: hidden;
          margin-top: 18px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.06);
        }

        .newsletter input {
          width: 100%;
          min-width: 0;
          height: 44px;
          padding: 0 12px;
          border: 0;
          outline: none;
          background: transparent;
          color: white;
          font: inherit;
          font-size: 12px;
        }

        .newsletter input::placeholder {
          color: rgba(255, 255, 255, 0.45);
        }

        .newsletter button {
          min-width: 88px;
          border: 0;
          background: linear-gradient(135deg, #d4af37, #f1d26a);
          color: #0a2e73;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .socialLinks {
          display: flex;
          gap: 9px;
          margin-top: 18px;
        }

        .socialLinks a {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          color: #d4af37;
          font-weight: 900;
          text-decoration: none;
          transition:
            transform 0.2s ease,
            background 0.2s ease,
            border-color 0.2s ease;
        }

        .socialLinks a:hover {
          transform: translateY(-3px);
          border-color: #d4af37;
          background: rgba(212, 175, 55, 0.12);
        }

        .paymentRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
          padding: 18px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.11);
          border-bottom: 1px solid rgba(255, 255, 255, 0.11);
        }

        .paymentRow > div {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .paymentRow span {
          color: rgba(255, 255, 255, 0.68);
          font-size: 11px;
        }

        .paymentRow strong {
          padding: 6px 9px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.05);
          color: white;
          font-size: 10px;
        }

        .paymentRow p {
          margin: 0;
          color: rgba(255, 255, 255, 0.56);
          font-size: 10px;
        }

        .bottomBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding-top: 22px;
        }

        .bottomBar p {
          margin: 0;
          color: rgba(255, 255, 255, 0.58);
          font-size: 11px;
        }

        .bottomBar p strong {
          color: #d4af37;
        }

        .credit {
          display: flex;
          align-items: center;
          gap: 7px;
          color: rgba(255, 255, 255, 0.58);
          font-size: 11px;
        }

        .credit strong {
          color: #d4af37;
          letter-spacing: 0.6px;
        }

        @media (max-width: 1180px) {
          .footerGrid {
            grid-template-columns: 1.5fr repeat(2, 1fr);
          }

          .newsletterColumn {
            grid-column: span 2;
          }
        }

        @media (max-width: 850px) {
          .trustStrip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .footerGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .brandColumn {
            grid-column: 1 / -1;
          }

          .newsletterColumn {
            grid-column: 1 / -1;
          }

          .paymentRow,
          .bottomBar {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media (max-width: 560px) {
          .footerShell {
            width: calc(100% - 22px);
          }

          .trustStrip,
          .footerGrid {
            grid-template-columns: 1fr;
          }

          .newsletterColumn {
            grid-column: auto;
          }

          .footerGrid {
            gap: 28px;
            padding: 40px 5px 34px;
          }

          .brand strong {
            font-size: 20px;
          }

          .newsletter {
            flex-direction: column;
            border: 0;
            background: transparent;
          }

          .newsletter input {
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.06);
          }

          .newsletter button {
            min-height: 42px;
            margin-top: 8px;
            border-radius: 10px;
          }
        }
      `}</style>
    </footer>
  );
}
