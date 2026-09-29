"use client";



import Link from "next/link";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";



const currentYear = new Date().getFullYear();



type FooterBranding = {

  facebookUrl: string;

  instagramUrl: string;

  youtubeUrl: string;

  twitterUrl: string;

  whatsappNumber: string;

  showFacebookIcon: boolean;

  showInstagramIcon: boolean;

  showYoutubeIcon: boolean;

  showTwitterIcon: boolean;

  showWhatsappButton: boolean;

};



const DEFAULT_FOOTER_BRANDING: FooterBranding = {

  facebookUrl: "",

  instagramUrl: "",

  youtubeUrl: "",

  twitterUrl: "",

  whatsappNumber: "919010014001",

  showFacebookIcon: true,

  showInstagramIcon: true,

  showYoutubeIcon: true,

  showTwitterIcon: true,

  showWhatsappButton: true,

};



function normalizeWhatsappNumber(value: string) {

  const digits = value.replace(/\D/g, "");

  return digits.length === 10 ? `91${digits}` : digits;

}



export default function Footer() {

  const [branding, setBranding] = useState<FooterBranding>(

    DEFAULT_FOOTER_BRANDING

  );



  useEffect(() => {

    loadFooterBranding();

  }, []);



  async function loadFooterBranding() {

    try {

      const { data, error } = await supabase

        .from("branding_settings")

        .select(

          "facebook_url, instagram_url, youtube_url, twitter_url, whatsapp_number, show_facebook_icon, show_instagram_icon, show_youtube_icon, show_twitter_icon, show_whatsapp_button"

        )

        .order("id", { ascending: true })

        .limit(1)

        .maybeSingle();



      if (error) throw error;

      if (!data) return;



      setBranding({

        facebookUrl: String(data.facebook_url || "").trim(),

        instagramUrl: String(data.instagram_url || "").trim(),

        youtubeUrl: String(data.youtube_url || "").trim(),

        twitterUrl: String(data.twitter_url || "").trim(),

        whatsappNumber:

          normalizeWhatsappNumber(String(data.whatsapp_number || "")) ||

          DEFAULT_FOOTER_BRANDING.whatsappNumber,

        showFacebookIcon: data.show_facebook_icon ?? true,

        showInstagramIcon: data.show_instagram_icon ?? true,

        showYoutubeIcon: data.show_youtube_icon ?? true,

        showTwitterIcon: data.show_twitter_icon ?? true,

        showWhatsappButton: data.show_whatsapp_button ?? true,

      });

    } catch (error) {

      console.error("Footer branding load error:", error);

    }

  }



  const safeWhatsappNumber =

    branding.whatsappNumber || DEFAULT_FOOTER_BRANDING.whatsappNumber;



  return (
    <footer className="footer">
      <div className="topGlow" />
      <div className="ambientGrid" />
      <div className="ambientGlow glowOne" />
      <div className="ambientGlow glowTwo" />

      <div className="footerShell">
        <section className="commerceRail">
          <article>
            <span className="railIcon">◉</span>
            <div>
              <strong>Live Online Catalogue</strong>
              <small>Active products and collections</small>
            </div>
          </article>

          <article>
            <span className="railIcon">▣</span>
            <div>
              <strong>Secure Checkout</strong>
              <small>Trusted payment flow</small>
            </div>
          </article>

          <article>
            <span className="railIcon">☏</span>
            <div>
              <strong>WhatsApp Support</strong>
              <small>Talk directly with NEW CITY STYLE</small>
            </div>
          </article>

          <article>
            <span className="railIcon">✦</span>
            <div>
              <strong>Family Fashion</strong>
              <small>Men • Women • Kids</small>
            </div>
          </article>
        </section>

        <section className="mainFooter">
          <div className="brandPanel">
            <Link href="/" className="brand">
              <span className="brandMark">
                <span>NCS</span>
              </span>

              <span className="brandText">
                <strong>NEW CITY STYLE</strong>
                <small>STYLE FOR EVERY FAMILY</small>
              </span>
            </Link>

            <p className="brandDescription">
              A modern family-fashion destination built around live online
              shopping, curated collections and direct customer support.
            </p>

            <div className="storeIdentity">
              <span className="identityLabel">NEW CITY STYLE • STORE</span>

              <div className="identityStats">
                <div>
                  <strong>MEN</strong>
                  <small>Shirts • Jeans • More</small>
                </div>

                <div>
                  <strong>WOMEN</strong>
                  <small>Sarees • Fashion • More</small>
                </div>

                <div>
                  <strong>KIDS</strong>
                  <small>Family-ready styles</small>
                </div>
              </div>
            </div>

            <div className="contactList">
              <a
                href="https://maps.google.com/?q=Sarubujjili,Srikakulam,Andhra+Pradesh"
                target="_blank"
                rel="noreferrer"
              >
                <span>⌖</span>
                <div>
                  <strong>Store Location</strong>
                  <small>Sarubujjili, Srikakulam, Andhra Pradesh</small>
                </div>
              </a>

              <a href="tel:+919010014001">
                <span>☎</span>
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

          <div className="linksPanel">
            <div className="linkColumn">
              <span className="columnLabel">01</span>
              <h3>Shop</h3>

              <Link href="/search?q=Men">Men&apos;s Fashion</Link>
              <Link href="/search?q=Women">Women&apos;s Fashion</Link>
              <Link href="/search?q=Kids">Kids&apos; Fashion</Link>
              <Link href="/search?q=Sarees">Premium Sarees</Link>
              <Link href="/collections">All Collections</Link>
            </div>

            <div className="linkColumn">
              <span className="columnLabel">02</span>
              <h3>My Shopping</h3>

              <Link href="/orders">My Orders</Link>
              <Link href="/cart">Shopping Cart</Link>
              <Link href="/wishlist">Wishlist</Link>
              <Link href="/shipping">Shipping Information</Link>
              <Link href="/returns">Returns & Refunds</Link>
            </div>

            <div className="linkColumn">
              <span className="columnLabel">03</span>
              <h3>Company</h3>

              <Link href="/about">About NEW CITY STYLE</Link>
              <Link href="/contact">Contact Us</Link>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms & Conditions</Link>
              <Link href="/faq">Frequently Asked Questions</Link>
            </div>
          </div>

          <div className="connectPanel">
            <span className="panelEyebrow">DIRECT SHOPPING HELP</span>

            <h3>Need help finding the right style?</h3>

            <p>
              Use WhatsApp for quick shopping support, or continue browsing the
              live online catalogue.
            </p>

            <div className="connectActions">
              {branding.showWhatsappButton && safeWhatsappNumber && (
                <a
                  href={`https://wa.me/${safeWhatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="whatsappButton"
                >
                  <span>WhatsApp NEW CITY STYLE</span>
                  <b>→</b>
                </a>
              )}

              <Link href="/search" className="catalogueButton">
                Browse Catalogue →
              </Link>
            </div>

            <div className="socialBlock">
              <span>Follow NEW CITY STYLE</span>

              <div className="socialLinks">
                {branding.showFacebookIcon && branding.facebookUrl && (
                  <a
                    href={branding.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Facebook"
                  >
                    f
                  </a>
                )}

                {branding.showInstagramIcon && branding.instagramUrl && (
                  <a
                    href={branding.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                  >
                    ◎
                  </a>
                )}

                {branding.showWhatsappButton && safeWhatsappNumber && (
                  <a
                    href={`https://wa.me/${safeWhatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                  >
                    ☏
                  </a>
                )}

                {branding.showYoutubeIcon && branding.youtubeUrl && (
                  <a
                    href={branding.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="YouTube"
                  >
                    ▶
                  </a>
                )}

                {branding.showTwitterIcon && branding.twitterUrl && (
                  <a
                    href={branding.twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="X / Twitter"
                  >
                    𝕏
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="paymentRow">
          <div className="paymentLead">
            <span className="paymentIcon">▣</span>
            <div>
              <strong>Secure Payment Options</strong>
              <small>Choose your preferred supported payment method</small>
            </div>
          </div>

          <div className="paymentMethods">
            <strong>UPI</strong>
            <strong>Visa</strong>
            <strong>Mastercard</strong>
            <strong>RuPay</strong>
            <strong>Net Banking</strong>
          </div>

          <span className="paymentNote">
            Payment availability may depend on checkout configuration.
          </span>
        </section>

        <section className="bottomBar">
          <p>
            © {currentYear} <strong>NEW CITY STYLE</strong>. All Rights Reserved.
          </p>

          <div className="bottomLinks">
            <Link href="/privacy">Privacy</Link>
            <span>•</span>
            <Link href="/terms">Terms</Link>
            <span>•</span>
            <Link href="/contact">Support</Link>
          </div>

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
          margin-top: 84px;
          background:
            radial-gradient(
              circle at 88% 10%,
              rgba(var(--ncs-secondary-rgb, 212,175,55), .13),
              transparent 24%
            ),
            radial-gradient(
              circle at 5% 90%,
              rgba(48, 91, 176, .15),
              transparent 28%
            ),
            linear-gradient(
              180deg,
              color-mix(
                in srgb,
                var(--ncs-primary, #0A2E73) 90%,
                black 10%
              ) 0%,
              color-mix(
                in srgb,
                var(--ncs-primary, #0A2E73) 76%,
                black 24%
              ) 100%
            );
          color: #fff;
        }

        .topGlow {
          height: 3px;
          background:
            linear-gradient(
              90deg,
              transparent,
              var(--ncs-secondary, #D4AF37),
              #f1dc87,
              var(--ncs-secondary, #D4AF37),
              transparent
            );
          box-shadow:
            0 0 24px
            rgba(var(--ncs-secondary-rgb, 212,175,55), .45);
        }

        .ambientGrid {
          position: absolute;
          inset: 3px 0 0;
          opacity: .045;
          pointer-events: none;
          background-image:
            linear-gradient(
              rgba(255,255,255,.13) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(255,255,255,.13) 1px,
              transparent 1px
            );
          background-size: 66px 66px;
          mask-image:
            linear-gradient(
              180deg,
              rgba(0,0,0,.9),
              transparent 88%
            );
        }

        .ambientGlow {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
        }

        .glowOne {
          top: 80px;
          right: -160px;
          width: 420px;
          height: 420px;
          background:
            rgba(var(--ncs-secondary-rgb, 212,175,55), .08);
        }

        .glowTwo {
          left: -150px;
          bottom: -70px;
          width: 380px;
          height: 380px;
          background: rgba(58, 105, 199, .11);
        }

        .footerShell {
          position: relative;
          z-index: 3;
          width: min(1480px, calc(100% - 40px));
          margin: 0 auto;
          padding-bottom: 24px;
        }

        .commerceRail {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          overflow: hidden;
          margin-top: 30px;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 18px;
          background: rgba(255,255,255,.045);
          backdrop-filter: blur(10px);
        }

        .commerceRail article {
          min-height: 88px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 17px;
          border-right: 1px solid rgba(255,255,255,.08);
        }

        .commerceRail article:last-child {
          border-right: 0;
        }

        .railIcon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex: 0 0 42px;
          border: 1px solid rgba(212,175,55,.22);
          border-radius: 12px;
          background: rgba(212,175,55,.08);
          color: var(--ncs-secondary, #D4AF37);
          font-size: 17px;
          font-weight: 900;
        }

        .commerceRail strong,
        .commerceRail small {
          display: block;
        }

        .commerceRail strong {
          font-size: 11px;
        }

        .commerceRail small {
          margin-top: 4px;
          color: rgba(255,255,255,.5);
          font-size: 8px;
        }

        .mainFooter {
          display: grid;
          grid-template-columns:
            minmax(320px, 1.2fr)
            minmax(460px, 1.45fr)
            minmax(280px, .9fr);
          gap: 42px;
          padding: 58px 0 44px;
        }

        .brand {
          display: inline-flex;
          align-items: center;
          gap: 13px;
          color: #fff;
          text-decoration: none;
        }

        .brandMark {
          position: relative;
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          flex: 0 0 54px;
          border: 1px solid var(--ncs-secondary, #D4AF37);
          border-radius: 16px;
          background: rgba(212,175,55,.07);
          box-shadow:
            inset 0 0 30px rgba(212,175,55,.04);
        }

        .brandMark::after {
          position: absolute;
          inset: 5px;
          content: "";
          border: 1px solid rgba(212,175,55,.16);
          border-radius: 11px;
        }

        .brandMark span {
          position: relative;
          z-index: 2;
          color: var(--ncs-secondary, #D4AF37);
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .brandText strong,
        .brandText small {
          display: block;
        }

        .brandText strong {
          color: var(--ncs-secondary, #D4AF37);
          font-size: 25px;
          letter-spacing: .5px;
        }

        .brandText small {
          margin-top: 5px;
          color: rgba(255,255,255,.55);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1.6px;
        }

        .brandDescription {
          max-width: 420px;
          margin: 21px 0 0;
          color: rgba(255,255,255,.62);
          font-size: 12px;
          line-height: 1.75;
        }

        .storeIdentity {
          margin-top: 24px;
          padding: 14px;
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 14px;
          background: rgba(255,255,255,.04);
        }

        .identityLabel {
          color: #e7cb68;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 1.2px;
        }

        .identityStats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 7px;
          margin-top: 10px;
        }

        .identityStats > div {
          min-width: 0;
          padding: 9px;
          border-radius: 10px;
          background: rgba(255,255,255,.04);
        }

        .identityStats strong,
        .identityStats small {
          display: block;
        }

        .identityStats strong {
          color: #fff;
          font-size: 8px;
        }

        .identityStats small {
          margin-top: 3px;
          overflow: hidden;
          color: rgba(255,255,255,.4);
          font-size: 6px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .contactList {
          display: grid;
          gap: 9px;
          margin-top: 20px;
        }

        .contactList a {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #fff;
          text-decoration: none;
        }

        .contactList a > span {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          flex: 0 0 32px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 9px;
          background: rgba(255,255,255,.04);
          color: #e7cb68;
          font-size: 11px;
        }

        .contactList strong,
        .contactList small {
          display: block;
        }

        .contactList strong {
          font-size: 9px;
        }

        .contactList small {
          margin-top: 2px;
          color: rgba(255,255,255,.46);
          font-size: 8px;
        }

        .linksPanel {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 24px;
        }

        .linkColumn {
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .columnLabel {
          color: rgba(212,175,55,.5);
          font-size: 8px;
          font-weight: 900;
        }

        .linkColumn h3 {
          position: relative;
          margin: 7px 0 18px;
          padding-bottom: 10px;
          color: var(--ncs-secondary, #D4AF37);
          font-size: 14px;
        }

        .linkColumn h3::after {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 28px;
          height: 2px;
          content: "";
          background: var(--ncs-secondary, #D4AF37);
        }

        .linkColumn :global(a) {
          margin-bottom: 11px;
          color: rgba(255,255,255,.61);
          font-size: 10px;
          line-height: 1.45;
          text-decoration: none;
          transition:
            color .2s ease,
            transform .2s ease;
        }

        .linkColumn :global(a:hover) {
          color: #f0d875;
          transform: translateX(3px);
        }

        .connectPanel {
          padding: 20px;
          border: 1px solid rgba(212,175,55,.18);
          border-radius: 18px;
          background:
            linear-gradient(
              145deg,
              rgba(255,255,255,.07),
              rgba(255,255,255,.025)
            );
        }

        .panelEyebrow {
          color: #e7cb68;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 1.2px;
        }

        .connectPanel h3 {
          margin: 9px 0 0;
          color: #fff;
          font-size: 21px;
          line-height: 1.15;
        }

        .connectPanel > p {
          margin: 11px 0 0;
          color: rgba(255,255,255,.55);
          font-size: 10px;
          line-height: 1.65;
        }

        .connectActions {
          display: grid;
          gap: 8px;
          margin-top: 18px;
        }

        :global(.whatsappButton),
        :global(.catalogueButton) {
          min-height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border-radius: 10px;
          font-size: 9px;
          font-weight: 900;
          text-decoration: none;
        }

        :global(.whatsappButton) {
          background: #1f9f59;
          color: #fff;
        }

        :global(.whatsappButton b) {
          color: #fff;
          font-size: 15px;
        }

        :global(.catalogueButton) {
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.05);
          color: #fff;
        }

        .socialBlock {
          margin-top: 20px;
          padding-top: 17px;
          border-top: 1px solid rgba(255,255,255,.08);
        }

        .socialBlock > span {
          color: rgba(255,255,255,.45);
          font-size: 8px;
        }

        .socialLinks {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }

        .socialLinks a {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 9px;
          background: rgba(255,255,255,.04);
          color: var(--ncs-secondary, #D4AF37);
          font-size: 11px;
          font-weight: 900;
          text-decoration: none;
          transition: .2s ease;
        }

        .socialLinks a:hover {
          transform: translateY(-2px);
          border-color: rgba(212,175,55,.45);
          background: rgba(212,175,55,.08);
        }

        .paymentRow {
          display: grid;
          grid-template-columns:
            minmax(240px, .8fr)
            minmax(360px, 1.2fr)
            minmax(250px, .8fr);
          align-items: center;
          gap: 22px;
          padding: 18px 0;
          border-top: 1px solid rgba(255,255,255,.09);
          border-bottom: 1px solid rgba(255,255,255,.09);
        }

        .paymentLead {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .paymentIcon {
          width: 35px;
          height: 35px;
          display: grid;
          place-items: center;
          flex: 0 0 35px;
          border-radius: 9px;
          background: rgba(212,175,55,.08);
          color: #e7cb68;
        }

        .paymentLead strong,
        .paymentLead small {
          display: block;
        }

        .paymentLead strong {
          font-size: 9px;
        }

        .paymentLead small {
          margin-top: 2px;
          color: rgba(255,255,255,.4);
          font-size: 7px;
        }

        .paymentMethods {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 7px;
        }

        .paymentMethods strong {
          padding: 6px 9px;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 7px;
          background: rgba(255,255,255,.04);
          color: #fff;
          font-size: 8px;
        }

        .paymentNote {
          color: rgba(255,255,255,.4);
          font-size: 7px;
          line-height: 1.5;
          text-align: right;
        }

        .bottomBar {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 20px;
          padding-top: 22px;
        }

        .bottomBar p {
          margin: 0;
          color: rgba(255,255,255,.48);
          font-size: 9px;
        }

        .bottomBar p strong {
          color: var(--ncs-secondary, #D4AF37);
        }

        .bottomLinks {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,.25);
        }

        .bottomLinks :global(a) {
          color: rgba(255,255,255,.46);
          font-size: 8px;
          text-decoration: none;
        }

        .credit {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 7px;
          color: rgba(255,255,255,.42);
          font-size: 8px;
        }

        .credit strong {
          color: var(--ncs-secondary, #D4AF37);
          letter-spacing: .5px;
        }

        @media (max-width: 1180px) {
          .mainFooter {
            grid-template-columns: 1fr 1.3fr;
          }

          .connectPanel {
            grid-column: 1 / -1;
          }

          .paymentRow {
            grid-template-columns: 1fr;
          }

          .paymentMethods {
            justify-content: flex-start;
          }

          .paymentNote {
            text-align: left;
          }
        }

        @media (max-width: 850px) {
          .commerceRail {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .commerceRail article:nth-child(2) {
            border-right: 0;
          }

          .commerceRail article:nth-child(-n + 2) {
            border-bottom: 1px solid rgba(255,255,255,.08);
          }

          .mainFooter {
            grid-template-columns: 1fr;
          }

          .linksPanel {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .bottomBar {
            grid-template-columns: 1fr;
            align-items: flex-start;
          }

          .credit {
            justify-content: flex-start;
          }
        }

        @media (max-width: 580px) {
          .footerShell {
            width: calc(100% - 20px);
          }

          .commerceRail {
            display: flex;
            overflow-x: auto;
            border-radius: 14px;
            scrollbar-width: none;
          }

          .commerceRail::-webkit-scrollbar {
            display: none;
          }

          .commerceRail article {
            min-width: 235px;
            flex: 0 0 235px;
            border-right: 1px solid rgba(255,255,255,.08);
            border-bottom: 0 !important;
          }

          .mainFooter {
            gap: 32px;
            padding: 42px 2px 34px;
          }

          .brandText strong {
            font-size: 20px;
          }

          .brandDescription {
            font-size: 11px;
          }

          .identityStats {
            grid-template-columns: 1fr;
          }

          .linksPanel {
            grid-template-columns: 1fr 1fr;
            gap: 24px 18px;
          }

          .linkColumn:last-child {
            grid-column: 1 / -1;
          }

          .connectPanel {
            padding: 17px;
          }

          .paymentMethods {
            gap: 6px;
          }

          .bottomLinks {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </footer>
  );
}
