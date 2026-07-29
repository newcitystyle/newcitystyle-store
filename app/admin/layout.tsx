"use client";

import {
  type ReactNode,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "badri.nsv@gmail.com";

type AdminLayoutProps = {
  children: ReactNode;
};

const menuItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: "🏠" },
  { label: "Products", href: "/admin/products", icon: "🛍️" },
  { label: "Add Product", href: "/admin/add-product", icon: "➕" },
  { label: "Categories", href: "/admin/categories", icon: "🏷️" },
  { label: "Collections", href: "/admin/collections", icon: "✨" },
  { label: "Orders", href: "/admin/orders", icon: "📦" },
  { label: "Billing / POS", href: "/admin/pos", icon: "🧾" },
  { label: "Daily Expenses", href: "/admin/expenses", icon: "💸" },
  {
    label: "Cash & Bank Book",
    href: "/admin/cash-bank-book",
    icon: "🏦",
  },
  {
    label: "Party Ledgers",
    href: "/admin/party-ledgers",
    icon: "📒",
  },
  {
    label: "Reconciliation",
    href: "/admin/reconciliation",
    icon: "✅",
  },
  { label: "Purchase Stock", href: "/admin/purchases", icon: "📥" },
  {
    label: "Purchase History",
    href: "/admin/purchase-history",
    icon: "📚",
  },
  {
    label: "Barcodes & Stock",
    href: "/admin/barcodes",
    icon: "▥",
  },
  {
    label: "POS Return History",
    href: "/admin/pos-returns",
    icon: "↩",
  },
  { label: "Returns", href: "/admin/returns", icon: "↩️" },
  { label: "Customers", href: "/admin/customers", icon: "👥" },
  {
    label: "Customer Dues",
    href: "/admin/customer-dues",
    icon: "💰",
  },
  { label: "Reviews", href: "/admin/reviews", icon: "⭐" },
  { label: "Coupons", href: "/admin/coupons", icon: "🎟️" },
  { label: "Marketing", href: "/admin/marketing", icon: "📣" },
  { label: "Home Preview", href: "/admin/home-preview", icon: "🖥️" },
  { label: "Branding", href: "/admin/branding", icon: "🎨" },
  { label: "Payments", href: "/admin/payments", icon: "💳" },
  { label: "Shipping", href: "/admin/shipping", icon: "🚚" },
  { label: "SEO", href: "/admin/seo", icon: "🔍" },
  { label: "Analytics", href: "/admin/analytics", icon: "📊" },
  { label: "Sales History", href: "/admin/sales-history", icon: "📊" },
  {
    label: "Billing Reports",
    href: "/admin/billing-reports",
    icon: "📈",
  },
  {
    label: "Store Details",
    href: "/admin/store-settings",
    icon: "⚙️",
  },
];

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) {
      setCheckingAccess(false);
      setHasAdminAccess(true);
      return;
    }

    let active = true;

    async function checkAccess() {
      setCheckingAccess(true);

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!active) return;

        if (error || !session?.user) {
          setHasAdminAccess(false);
          router.replace("/admin/login");
          return;
        }

        const email =
          session.user.email?.trim().toLowerCase() || "";

        if (email !== ADMIN_EMAIL) {
          await supabase.auth.signOut({ scope: "local" });

          if (!active) return;

          setHasAdminAccess(false);
          router.replace("/admin/login");
          return;
        }

        setAdminEmail(email);
        setHasAdminAccess(true);
      } catch (error) {
        console.error("Admin access check error:", error);

        if (!active) return;

        setHasAdminAccess(false);
        router.replace("/admin/login");
      } finally {
        if (active) {
          setCheckingAccess(false);
        }
      }
    }

    checkAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      const email =
        session?.user?.email?.trim().toLowerCase() || "";

      if (session?.user && email === ADMIN_EMAIL) {
        setAdminEmail(email);
        setHasAdminAccess(true);
        setCheckingAccess(false);
        return;
      }

      if (!session) {
        setAdminEmail("");
        setHasAdminAccess(false);
        setCheckingAccess(false);
        router.replace("/admin/login");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [isLoginPage, router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  async function handleLogout() {
    try {
      const { error } = await supabase.auth.signOut({
        scope: "local",
      });

      if (error) {
        throw error;
      }

      setAdminEmail("");
      setHasAdminAccess(false);
      setSidebarOpen(false);

      window.location.replace("/admin/login");
    } catch (error) {
      console.error("Admin logout error:", error);
      alert("Unable to logout. Please try again.");
    }
  }

  function isActiveRoute(href: string) {
    if (href === "/admin/dashboard") {
      return pathname === "/admin" || pathname === "/admin/dashboard";
    }

    if (href === "/admin/products") {
      return pathname === "/admin/products";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (checkingAccess) {
    return (
      <main className="ncsCheckingPage">
        <div className="ncsCheckingLogo">NCS</div>
        <div className="ncsSpinner" />
        <h2>Opening Admin Studio...</h2>
        <p>Verifying your secure NEW CITY STYLE admin session.</p>

        <style jsx global>{`
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
          }

          .ncsCheckingPage {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background:
              radial-gradient(
                circle at 18% 18%,
                rgba(212, 175, 55, 0.18),
                transparent 28%
              ),
              linear-gradient(135deg, #03153f, #0a2e73, #164ca8);
            color: #ffffff;
            text-align: center;
            font-family: Poppins, Inter, Arial, sans-serif;
          }

          .ncsCheckingLogo {
            width: 88px;
            height: 88px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #d4af37;
            border-radius: 25px;
            background: rgba(212, 175, 55, 0.1);
            color: #d4af37;
            font-size: 25px;
            font-weight: 950;
            letter-spacing: 2px;
          }

          .ncsSpinner {
            width: 45px;
            height: 45px;
            margin-top: 25px;
            border: 4px solid rgba(255, 255, 255, 0.22);
            border-top-color: #d4af37;
            border-radius: 50%;
            animation: ncsSpin 0.8s linear infinite;
          }

          .ncsCheckingPage h2 {
            margin: 18px 0 0;
            font-size: 21px;
          }

          .ncsCheckingPage p {
            margin: 9px 0 0;
            color: rgba(255, 255, 255, 0.68);
            font-size: 13px;
          }

          @keyframes ncsSpin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  if (!hasAdminAccess) {
    return null;
  }

  return (
    <div
      className={
        sidebarCollapsed
          ? "ncsAdminShell ncsAdminShellCollapsed"
          : "ncsAdminShell"
      }
    >
      <button
        type="button"
        className="ncsMobileMenuButton"
        onClick={() => setSidebarOpen((current) => !current)}
        aria-label="Open admin menu"
      >
        ☰
      </button>

      {sidebarOpen && (
        <button
          type="button"
          className="ncsMobileOverlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close admin menu"
        />
      )}

      <aside
        className={`ncsSidebar ${
          sidebarOpen ? "ncsSidebarOpen" : ""
        } ${sidebarCollapsed ? "ncsSidebarCollapsed" : ""}`}
      >
        <button
          type="button"
          className="ncsSidebarCollapseButton"
          onClick={() =>
            setSidebarCollapsed((current) => !current)
          }
          aria-label={
            sidebarCollapsed
              ? "Expand admin sidebar"
              : "Collapse admin sidebar"
          }
          title={
            sidebarCollapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
        >
          {sidebarCollapsed ? "›" : "‹"}
        </button>
        <div className="ncsBrandArea">
          <div className="ncsBrandLogo">NCS</div>

          <div className="ncsBrandText">
            <strong>NEW CITY STYLE</strong>
            <span>Premium Admin Studio</span>
          </div>
        </div>

        <nav className="ncsMenu">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActiveRoute(item.href)
                  ? "ncsMenuItem ncsActiveMenuItem"
                  : "ncsMenuItem"
              }
            >
              <span className="ncsMenuIcon">{item.icon}</span>
              <span className="ncsMenuLabel">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="ncsSidebarBottom">
          <div className="ncsAdminIdentity">
            <div className="ncsAdminAvatar">N</div>

            <div className="ncsAdminText">
              <strong>Administrator</strong>
              <span>{adminEmail}</span>
            </div>
          </div>

          <Link href="/" className="ncsViewStoreButton">
            <span>🏪</span>
            View Store
          </Link>

          <button
            type="button"
            className="ncsLogoutButton"
            onClick={handleLogout}
          >
            <span>🚪</span>
            Logout
          </button>
        </div>
      </aside>

      <main className="ncsAdminContent">{children}</main>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          min-height: 100%;
        }

        body {
          background: #f8f4ec;
        }

        .ncsAdminShell {
          min-height: 100vh;
          background: #f8f4ec;
          font-family: Poppins, Inter, Arial, sans-serif;
        }

        .ncsSidebar {
          position: fixed;
          z-index: 100;
          top: 0;
          bottom: 0;
          left: 0;
          width: 292px;
          display: flex;
          flex-direction: column;
          padding: 22px 17px;
          overflow-x: hidden;
          overflow-y: auto;
          background:
            radial-gradient(
              circle at 25% 0%,
              rgba(212, 175, 55, 0.18),
              transparent 26%
            ),
            linear-gradient(180deg, #03153f 0%, #08265f 48%, #0a2e73 100%);
          color: #ffffff;
          box-shadow: 12px 0 35px rgba(3, 21, 63, 0.2);
          scrollbar-width: thin;
          scrollbar-color: rgba(212, 175, 55, 0.55) transparent;
        }

        .ncsSidebar::-webkit-scrollbar {
          width: 5px;
        }

        .ncsSidebar::-webkit-scrollbar-thumb {
          border-radius: 10px;
          background: rgba(212, 175, 55, 0.55);
        }

        .ncsBrandArea {
          display: flex;
          align-items: center;
          gap: 13px;
          min-height: 76px;
          padding: 5px 7px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.13);
        }

        .ncsBrandLogo {
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 2px solid #d4af37;
          border-radius: 18px;
          background: rgba(212, 175, 55, 0.08);
          color: #d4af37;
          font-size: 18px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .ncsBrandText {
          min-width: 0;
        }

        .ncsBrandText strong,
        .ncsBrandText span {
          display: block;
        }

        .ncsBrandText strong {
          color: #d4af37;
          font-size: 16px;
          font-weight: 900;
          line-height: 1.25;
          letter-spacing: 0.4px;
          white-space: nowrap;
        }

        .ncsBrandText span {
          margin-top: 4px;
          color: rgba(255, 255, 255, 0.68);
          font-size: 11px;
          font-weight: 600;
        }

        .ncsMenu {
          display: grid;
          gap: 6px;
          margin-top: 18px;
        }

        .ncsMenuItem {
          width: 100%;
          min-height: 47px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 14px;
          border: 1px solid transparent;
          border-radius: 11px;
          color: rgba(255, 255, 255, 0.84) !important;
          font-size: 14px;
          font-weight: 700;
          line-height: 1;
          text-decoration: none !important;
          white-space: nowrap;
          transition:
            transform 0.2s ease,
            background 0.2s ease,
            border-color 0.2s ease,
            color 0.2s ease;
        }

        .ncsMenuItem:hover {
          transform: translateX(3px);
          border-color: rgba(255, 255, 255, 0.11);
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff !important;
        }

        .ncsActiveMenuItem {
          border-color: rgba(255, 255, 255, 0.5);
          background: linear-gradient(135deg, #d4af37, #f1d26a);
          color: #0a2e73 !important;
          box-shadow: 0 10px 25px rgba(212, 175, 55, 0.23);
        }

        .ncsMenuIcon {
          width: 27px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 18px;
        }

        .ncsMenuLabel {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ncsSidebarBottom {
          display: grid;
          gap: 10px;
          margin-top: auto;
          padding-top: 22px;
        }

        .ncsAdminIdentity {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.07);
        }

        .ncsAdminAvatar {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, #d4af37, #f1d26a);
          color: #0a2e73;
          font-size: 15px;
          font-weight: 950;
        }

        .ncsAdminText {
          min-width: 0;
        }

        .ncsAdminText strong,
        .ncsAdminText span {
          display: block;
        }

        .ncsAdminText strong {
          color: #ffffff;
          font-size: 12px;
          font-weight: 850;
        }

        .ncsAdminText span {
          max-width: 182px;
          margin-top: 4px;
          overflow: hidden;
          color: rgba(255, 255, 255, 0.62);
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsViewStoreButton,
        .ncsLogoutButton {
          width: 100%;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 850;
          text-decoration: none !important;
          cursor: pointer;
        }

        .ncsViewStoreButton {
          border: 1px solid #d4af37;
          background: rgba(212, 175, 55, 0.12);
          color: #d4af37 !important;
        }

        .ncsLogoutButton {
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.07);
          color: #ffffff;
        }

        .ncsViewStoreButton:hover,
        .ncsLogoutButton:hover {
          transform: translateY(-1px);
          filter: brightness(1.08);
        }

        .ncsAdminContent {
          min-height: 100vh;
          margin-left: 292px;
        }

        .ncsSidebarCollapseButton {
          position: absolute;
          z-index: 5;
          top: 92px;
          right: -15px;
          width: 31px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #d4af37;
          border-radius: 0 11px 11px 0;
          background: linear-gradient(180deg, #d4af37, #f1d26a);
          color: #0a2e73;
          font-size: 25px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 5px 6px 16px rgba(3, 21, 63, 0.22);
          transition:
            transform 0.2s ease,
            filter 0.2s ease;
        }

        .ncsSidebarCollapseButton:hover {
          transform: translateX(2px);
          filter: brightness(1.04);
        }

        .ncsSidebar,
        .ncsAdminContent {
          transition:
            width 0.25s ease,
            margin-left 0.25s ease,
            padding 0.25s ease;
        }

        .ncsSidebarCollapsed {
          width: 86px;
          padding-left: 12px;
          padding-right: 12px;
          overflow: visible;
        }

        .ncsSidebarCollapsed .ncsBrandArea {
          justify-content: center;
          padding-left: 0;
          padding-right: 0;
        }

        .ncsSidebarCollapsed .ncsBrandLogo {
          width: 54px;
          height: 54px;
        }

        .ncsSidebarCollapsed .ncsBrandText,
        .ncsSidebarCollapsed .ncsMenuLabel,
        .ncsSidebarCollapsed .ncsAdminText,
        .ncsSidebarCollapsed .ncsViewStoreButton:not(:hover) {
          display: none;
        }

        .ncsSidebarCollapsed .ncsMenuItem {
          min-height: 48px;
          justify-content: center;
          gap: 0;
          padding: 0;
        }

        .ncsSidebarCollapsed .ncsMenuIcon {
          width: 100%;
          font-size: 20px;
        }

        .ncsSidebarCollapsed .ncsSidebarBottom {
          gap: 8px;
        }

        .ncsSidebarCollapsed .ncsAdminIdentity {
          justify-content: center;
          padding: 8px;
        }

        .ncsSidebarCollapsed .ncsViewStoreButton,
        .ncsSidebarCollapsed .ncsLogoutButton {
          min-height: 44px;
          padding: 0;
          font-size: 0;
        }

        .ncsSidebarCollapsed .ncsViewStoreButton span,
        .ncsSidebarCollapsed .ncsLogoutButton span {
          font-size: 18px;
        }

        .ncsAdminShellCollapsed .ncsAdminContent {
          margin-left: 86px;
        }

        .ncsMobileMenuButton,
        .ncsMobileOverlay {
          display: none;
        }

        @media (max-width: 1100px) {
          .ncsSidebar {
            width: 270px;
          }

          .ncsAdminContent {
            margin-left: 270px;
          }

          .ncsMenuItem {
            font-size: 13px;
          }
        }

        @media (max-width: 900px) {
          .ncsSidebarCollapseButton {
            display: none;
          }

          .ncsSidebar,
          .ncsSidebarCollapsed {
            width: min(86vw, 310px);
            transform: translateX(-105%);
            transition: transform 0.25s ease;
          }

          .ncsSidebarOpen {
            transform: translateX(0);
          }

          .ncsAdminContent,
          .ncsAdminShellCollapsed .ncsAdminContent {
            margin-left: 0;
            padding-top: 64px;
          }

          .ncsMobileMenuButton {
            position: fixed;
            z-index: 120;
            top: 12px;
            left: 12px;
            width: 47px;
            height: 47px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #d4af37;
            border-radius: 12px;
            background: #0a2e73;
            color: #d4af37;
            font-size: 23px;
            cursor: pointer;
            box-shadow: 0 8px 25px rgba(10, 46, 115, 0.3);
          }

          .ncsMobileOverlay {
            position: fixed;
            z-index: 90;
            inset: 0;
            display: block;
            border: 0;
            background: rgba(3, 21, 63, 0.62);
          }
        }
      `}</style>
    </div>
  );
}