"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type WebsiteVisit = {
  id: string | number;
  visitor_id?: string | null;
  session_id?: string | null;
  page_path?: string | null;
  page_title?: string | null;
  referrer?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  fbclid?: string | null;
  device_type?: string | null;
  browser?: string | null;
  event_type?: string | null;
  event_value?: number | string | null;
  metadata?: Record<string, unknown> | null;
  visited_at?: string | null;
};

type RangeKey = "today" | "7d" | "30d" | "all";

type SourceMetric = {
  key: string;
  label: string;
  visitors: number;
  sessions: number;
  productViews: number;
  addToCarts: number;
  checkouts: number;
  purchases: number;
  revenue: number;
  conversionRate: number;
};

type DeviceMetric = {
  key: string;
  label: string;
  visitors: number;
  percent: number;
};

type CampaignMetric = {
  name: string;
  visitors: number;
  productViews: number;
  addToCarts: number;
  purchases: number;
  revenue: number;
};

type PageMetric = {
  path: string;
  views: number;
};

type AnalyticsSummary = {
  visitors: number;
  sessions: number;
  pageViews: number;
  productViews: number;
  addToCarts: number;
  checkouts: number;
  checkoutContinues: number;
  purchases: number;
  revenue: number;
  conversionRate: number;
  sourceMetrics: SourceMetric[];
  deviceMetrics: DeviceMetric[];
  campaigns: CampaignMetric[];
  pages: PageMetric[];
};

const SOURCE_ORDER = [
  "facebook",
  "instagram",
  "google",
  "x",
  "direct",
  "other",
  "untracked",
];

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function startOfLocalDay(date = new Date()) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0
  );
}

function rangeStart(range: RangeKey) {
  const today = startOfLocalDay();

  if (range === "today") {
    return today;
  }

  if (range === "7d") {
    const date = new Date(today);
    date.setDate(date.getDate() - 6);
    return date;
  }

  if (range === "30d") {
    const date = new Date(today);
    date.setDate(date.getDate() - 29);
    return date;
  }

  return null;
}

function isPageViewEvent(visit: WebsiteVisit) {
  const eventType = String(visit.event_type || "")
    .trim()
    .toLowerCase();

  return !eventType || eventType === "page_view";
}

function normalizeSource(value?: string | null) {
  const source = String(value || "")
    .trim()
    .toLowerCase();

  if (!source) return "untracked";

  if (
    source === "facebook" ||
    source === "fb" ||
    source.includes("facebook.com") ||
    source.includes("fb.com")
  ) {
    return "facebook";
  }

  if (
    source === "instagram" ||
    source === "ig" ||
    source.includes("instagram.com")
  ) {
    return "instagram";
  }

  if (
    source === "google" ||
    source.includes("google.")
  ) {
    return "google";
  }

  if (
    source === "x" ||
    source === "twitter" ||
    source.includes("x.com") ||
    source.includes("twitter.com") ||
    source.includes("t.co")
  ) {
    return "x";
  }

  if (
    source === "direct" ||
    source === "(direct)"
  ) {
    return "direct";
  }

  return "other";
}

function sourceLabel(source: string) {
  switch (source) {
    case "facebook":
      return "Facebook";
    case "instagram":
      return "Instagram";
    case "google":
      return "Google";
    case "x":
      return "X / Twitter";
    case "direct":
      return "Direct";
    case "other":
      return "Other";
    default:
      return "Untracked";
  }
}

function normalizeDevice(value?: string | null) {
  const device = String(value || "")
    .trim()
    .toLowerCase();

  if (device === "mobile") return "mobile";
  if (device === "desktop") return "desktop";
  if (device === "tablet") return "tablet";
  return "unknown";
}

function deviceLabel(device: string) {
  switch (device) {
    case "mobile":
      return "Mobile";
    case "desktop":
      return "Desktop";
    case "tablet":
      return "Tablet";
    default:
      return "Unknown";
  }
}

function uniqueVisitorCount(rows: WebsiteVisit[]) {
  return new Set(
    rows
      .map((row) => String(row.visitor_id || "").trim())
      .filter(Boolean)
  ).size;
}

function uniqueSessionCount(rows: WebsiteVisit[]) {
  return new Set(
    rows
      .map((row) => String(row.session_id || "").trim())
      .filter(Boolean)
  ).size;
}

export default function VisitorsAnalyticsPage() {
  const [visits, setVisits] = useState<WebsiteVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [range, setRange] = useState<RangeKey>("today");

  async function loadAnalytics(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");

    try {
      let query = supabase
        .from("website_visits")
        .select(
          "id,visitor_id,session_id,page_path,page_title,referrer,source,medium,campaign,utm_content,utm_term,fbclid,device_type,browser,event_type,event_value,metadata,visited_at"
        )
        .order("visited_at", { ascending: false })
        .limit(20000);

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setVisits((data || []) as WebsiteVisit[]);
    } catch (error) {
      console.error("Visitors analytics load error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load website analytics."
      );

      setVisits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
  }, []);

  const filteredVisits = useMemo(() => {
    const start = rangeStart(range);

    if (!start) {
      return visits;
    }

    return visits.filter((visit) => {
      if (!visit.visited_at) return false;

      const date = new Date(visit.visited_at);

      return (
        !Number.isNaN(date.getTime()) &&
        date >= start
      );
    });
  }, [range, visits]);

  const analytics = useMemo<AnalyticsSummary>(() => {
    const pageViews = filteredVisits.filter(isPageViewEvent);
    const productViews = filteredVisits.filter(
      (visit) => visit.event_type === "product_view"
    );
    const addToCarts = filteredVisits.filter(
      (visit) => visit.event_type === "add_to_cart"
    );
    const checkouts = filteredVisits.filter(
      (visit) => visit.event_type === "checkout"
    );
    const checkoutContinues = filteredVisits.filter(
      (visit) => visit.event_type === "checkout_continue"
    );
    const purchases = filteredVisits.filter(
      (visit) => visit.event_type === "purchase"
    );

    const visitors = uniqueVisitorCount(pageViews);
    const sessions = uniqueSessionCount(pageViews);
    const revenue = purchases.reduce(
      (sum, visit) =>
        sum + Math.max(0, toNumber(visit.event_value)),
      0
    );

    const sourceMetrics = SOURCE_ORDER.map((sourceKey) => {
      const sourceRows = (rows: WebsiteVisit[]) =>
        rows.filter(
          (row) =>
            normalizeSource(row.source) === sourceKey
        );

      const sourcePageViews = sourceRows(pageViews);
      const sourceProductViews = sourceRows(productViews);
      const sourceAddToCarts = sourceRows(addToCarts);
      const sourceCheckouts = sourceRows(checkouts);
      const sourcePurchases = sourceRows(purchases);

      const sourceVisitors =
        uniqueVisitorCount(sourcePageViews);

      const sourceSessions =
        uniqueSessionCount(sourcePageViews);

      const sourceRevenue = sourcePurchases.reduce(
        (sum, visit) =>
          sum + Math.max(0, toNumber(visit.event_value)),
        0
      );

      return {
        key: sourceKey,
        label: sourceLabel(sourceKey),
        visitors: sourceVisitors,
        sessions: sourceSessions,
        productViews: sourceProductViews.length,
        addToCarts: sourceAddToCarts.length,
        checkouts: sourceCheckouts.length,
        purchases: sourcePurchases.length,
        revenue: sourceRevenue,
        conversionRate:
          sourceVisitors > 0
            ? (sourcePurchases.length /
                sourceVisitors) *
              100
            : 0,
      };
    }).filter(
      (metric) =>
        metric.visitors > 0 ||
        metric.productViews > 0 ||
        metric.addToCarts > 0 ||
        metric.checkouts > 0 ||
        metric.purchases > 0
    );

    const deviceKeys = [
      "mobile",
      "desktop",
      "tablet",
      "unknown",
    ];

    const deviceMetrics = deviceKeys
      .map((deviceKey) => {
        const deviceRows = pageViews.filter(
          (row) =>
            normalizeDevice(row.device_type) ===
            deviceKey
        );

        const count =
          uniqueVisitorCount(deviceRows);

        return {
          key: deviceKey,
          label: deviceLabel(deviceKey),
          visitors: count,
          percent:
            visitors > 0
              ? (count / visitors) * 100
              : 0,
        };
      })
      .filter((metric) => metric.visitors > 0);

    const campaignMap = new Map<
      string,
      {
        visitorIds: Set<string>;
        productViews: number;
        addToCarts: number;
        purchases: number;
        revenue: number;
      }
    >();

    filteredVisits.forEach((visit) => {
      const campaign = String(
        visit.campaign || ""
      ).trim();

      if (!campaign) return;

      const current =
        campaignMap.get(campaign) || {
          visitorIds: new Set<string>(),
          productViews: 0,
          addToCarts: 0,
          purchases: 0,
          revenue: 0,
        };

      if (isPageViewEvent(visit)) {
        const visitorId = String(
          visit.visitor_id || ""
        ).trim();

        if (visitorId) {
          current.visitorIds.add(visitorId);
        }
      }

      if (visit.event_type === "product_view") {
        current.productViews += 1;
      }

      if (visit.event_type === "add_to_cart") {
        current.addToCarts += 1;
      }

      if (visit.event_type === "purchase") {
        current.purchases += 1;
        current.revenue += Math.max(
          0,
          toNumber(visit.event_value)
        );
      }

      campaignMap.set(campaign, current);
    });

    const campaigns = Array.from(
      campaignMap.entries()
    )
      .map(([name, value]) => ({
        name,
        visitors: value.visitorIds.size,
        productViews: value.productViews,
        addToCarts: value.addToCarts,
        purchases: value.purchases,
        revenue: value.revenue,
      }))
      .sort((first, second) => {
        if (second.revenue !== first.revenue) {
          return second.revenue - first.revenue;
        }

        return second.visitors - first.visitors;
      })
      .slice(0, 10);

    const pageMap = new Map<string, number>();

    pageViews.forEach((visit) => {
      const path =
        String(visit.page_path || "/").trim() ||
        "/";

      pageMap.set(
        path,
        (pageMap.get(path) || 0) + 1
      );
    });

    const pages = Array.from(pageMap.entries())
      .map(([path, views]) => ({
        path,
        views,
      }))
      .sort(
        (first, second) =>
          second.views - first.views
      )
      .slice(0, 10);

    return {
      visitors,
      sessions,
      pageViews: pageViews.length,
      productViews: productViews.length,
      addToCarts: addToCarts.length,
      checkouts: checkouts.length,
      checkoutContinues:
        checkoutContinues.length,
      purchases: purchases.length,
      revenue,
      conversionRate:
        visitors > 0
          ? (purchases.length / visitors) * 100
          : 0,
      sourceMetrics,
      deviceMetrics,
      campaigns,
      pages,
    };
  }, [filteredVisits]);

  if (loading) {
    return (
      <main className="loadingPage">
        <div className="loadingMark">NCS</div>
        <div className="loader" />
        <h1>Opening Visitor Intelligence...</h1>
        <p>Reading website traffic, devices, campaigns and conversions.</p>

        <style jsx>{`
          .loadingPage {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background:
              radial-gradient(
                circle at 15% 12%,
                rgba(109, 77, 255, 0.18),
                transparent 32%
              ),
              #f7f5fb;
            color: #2b3150;
            font-family: Poppins, Inter, Arial, sans-serif;
            text-align: center;
          }

          .loadingMark {
            width: 82px;
            height: 82px;
            display: grid;
            place-items: center;
            border-radius: 24px;
            background: linear-gradient(
              145deg,
              #6d4dff,
              #24114a
            );
            color: white;
            font-size: 22px;
            font-weight: 950;
            box-shadow: 0 18px 45px
              rgba(73, 51, 158, 0.25);
          }

          .loader {
            width: 44px;
            height: 44px;
            margin-top: 24px;
            border: 4px solid #ddd8ec;
            border-top-color: #6d4dff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          h1 {
            margin: 18px 0 0;
            font-size: 24px;
          }

          p {
            margin: 8px 0 0;
            color: #7a8190;
            font-size: 13px;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="shell">
        <section className="hero">
          <div className="heroGlow heroGlowOne" />
          <div className="heroGlow heroGlowTwo" />

          <div className="heroCopy">
            <span>NEW CITY STYLE • VISITOR INTELLIGENCE</span>
            <h1>Website Traffic Analytics</h1>
            <p>
              See who visited, where they came from, which device they used,
              and how far they moved from visit to purchase.
            </p>
          </div>

          <div className="heroActions">
            <button
              type="button"
              className="refreshButton"
              onClick={() =>
                void loadAnalytics(true)
              }
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>

            <Link
              href="/admin/dashboard"
              className="backButton"
            >
              ← Dashboard
            </Link>
          </div>
        </section>

        <section className="rangeBar">
          <div>
            <span>ANALYTICS RANGE</span>
            <strong>
              {range === "today"
                ? "Today"
                : range === "7d"
                  ? "Last 7 Days"
                  : range === "30d"
                    ? "Last 30 Days"
                    : "All Time"}
            </strong>
          </div>

          <div className="rangeButtons">
            {[
              ["today", "Today"],
              ["7d", "7 Days"],
              ["30d", "30 Days"],
              ["all", "All Time"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={
                  range === value
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setRange(value as RangeKey)
                }
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {errorMessage && (
          <div className="errorMessage">
            {errorMessage}
          </div>
        )}

        <section className="kpiGrid">
          <KpiCard
            label="REAL VISITORS"
            value={analytics.visitors}
            note={`${analytics.sessions} session(s)`}
            tone="purple"
          />
          <KpiCard
            label="PAGE VIEWS"
            value={analytics.pageViews}
            note={`${analytics.productViews} product view(s)`}
            tone="blue"
          />
          <KpiCard
            label="ADD TO CART"
            value={analytics.addToCarts}
            note="Buying intent"
            tone="orange"
          />
          <KpiCard
            label="CHECKOUT"
            value={analytics.checkouts}
            note={`${analytics.checkoutContinues} continued to payment`}
            tone="pink"
          />
          <KpiCard
            label="PURCHASES"
            value={analytics.purchases}
            note={formatCurrency(
              analytics.revenue
            )}
            tone="green"
          />
          <KpiCard
            label="CONVERSION"
            value={`${analytics.conversionRate.toFixed(
              1
            )}%`}
            note="Purchases ÷ visitors"
            tone="gold"
          />
        </section>

        <section className="contentGrid">
          <article className="panel sourcePanel">
            <PanelHeading
              eyebrow="TRAFFIC SOURCES"
              title="Where customers came from"
              subtitle="Use this to decide which platform deserves more posts and ad budget."
            />

            <div className="sourceList">
              {analytics.sourceMetrics.length === 0 ? (
                <EmptyState text="No source traffic in this range yet." />
              ) : (
                analytics.sourceMetrics.map(
                  (source) => (
                    <div
                      className={`sourceRow source-${source.key}`}
                      key={source.key}
                    >
                      <div className="sourceName">
                        <span className="sourceDot" />
                        <div>
                          <strong>
                            {source.label}
                          </strong>
                          <small>
                            {source.visitors} visitor
                            {source.visitors === 1
                              ? ""
                              : "s"}{" "}
                            • {source.sessions} session
                            {source.sessions === 1
                              ? ""
                              : "s"}
                          </small>
                        </div>
                      </div>

                      <MiniMetric
                        label="Product Views"
                        value={source.productViews}
                      />
                      <MiniMetric
                        label="Cart"
                        value={source.addToCarts}
                      />
                      <MiniMetric
                        label="Checkout"
                        value={source.checkouts}
                      />
                      <MiniMetric
                        label="Orders"
                        value={source.purchases}
                      />
                      <MiniMetric
                        label="Revenue"
                        value={formatCurrency(
                          source.revenue
                        )}
                      />

                      <div className="conversionMetric">
                        <strong>
                          {source.conversionRate.toFixed(
                            1
                          )}
                          %
                        </strong>
                        <span>conversion</span>
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </article>

          <article className="panel devicePanel">
            <PanelHeading
              eyebrow="DEVICE MIX"
              title="Mobile vs Desktop"
              subtitle="Understand how customers are viewing your store."
            />

            <div className="deviceList">
              {analytics.deviceMetrics.length === 0 ? (
                <EmptyState text="No device data in this range yet." />
              ) : (
                analytics.deviceMetrics.map(
                  (device) => (
                    <div
                      className={`deviceRow device-${device.key}`}
                      key={device.key}
                    >
                      <div className="deviceTop">
                        <strong>
                          {device.label}
                        </strong>
                        <span>
                          {device.visitors} •{" "}
                          {device.percent.toFixed(0)}
                          %
                        </span>
                      </div>

                      <div className="deviceBar">
                        <span
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                device.percent,
                                4
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </article>
        </section>

        <section className="contentGrid lowerGrid">
          <article className="panel">
            <PanelHeading
              eyebrow="CONVERSION FUNNEL"
              title="Customer journey"
              subtitle="See where customers stop before buying."
            />

            <div className="funnel">
              {[
                {
                  label: "Visitors",
                  value: analytics.visitors,
                  className: "visitor",
                },
                {
                  label: "Product Views",
                  value: analytics.productViews,
                  className: "product",
                },
                {
                  label: "Add to Cart",
                  value: analytics.addToCarts,
                  className: "cart",
                },
                {
                  label: "Checkout",
                  value: analytics.checkouts,
                  className: "checkout",
                },
                {
                  label: "Purchase",
                  value: analytics.purchases,
                  className: "purchase",
                },
              ].map((step) => {
                const percent =
                  analytics.visitors > 0
                    ? Math.min(
                        100,
                        (step.value /
                          analytics.visitors) *
                          100
                      )
                    : 0;

                return (
                  <div
                    className={`funnelStep ${step.className}`}
                    key={step.label}
                  >
                    <div className="funnelTop">
                      <span>{step.label}</span>
                      <strong>
                        {step.value}
                      </strong>
                    </div>

                    <div className="funnelBar">
                      <span
                        style={{
                          width: `${Math.max(
                            step.value > 0 ? 4 : 0,
                            percent
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="panel">
            <PanelHeading
              eyebrow="TOP CAMPAIGNS"
              title="Ads & posts producing traffic"
              subtitle="Campaigns appear when your links contain UTM tags."
            />

            <div className="campaignList">
              {analytics.campaigns.length === 0 ? (
                <EmptyState text="No campaign-tagged traffic in this range yet." />
              ) : (
                analytics.campaigns.map(
                  (campaign, index) => (
                    <div
                      className="campaignRow"
                      key={campaign.name}
                    >
                      <b>{index + 1}</b>

                      <div className="campaignInfo">
                        <strong>
                          {campaign.name}
                        </strong>
                        <span>
                          {campaign.visitors} visitor
                          {campaign.visitors === 1
                            ? ""
                            : "s"}{" "}
                          • {campaign.productViews} views •{" "}
                          {campaign.addToCarts} cart •{" "}
                          {campaign.purchases} order
                          {campaign.purchases === 1
                            ? ""
                            : "s"}
                        </span>
                      </div>

                      <strong className="campaignRevenue">
                        {formatCurrency(
                          campaign.revenue
                        )}
                      </strong>
                    </div>
                  )
                )
              )}
            </div>
          </article>

          <article className="panel">
            <PanelHeading
              eyebrow="POPULAR PAGES"
              title="Most viewed pages"
              subtitle="Use this to understand which products and sections attract attention."
            />

            <div className="pageList">
              {analytics.pages.length === 0 ? (
                <EmptyState text="No page views in this range yet." />
              ) : (
                analytics.pages.map(
                  (page, index) => (
                    <div
                      className="pageRow"
                      key={`${page.path}-${index}`}
                    >
                      <b>{index + 1}</b>
                      <span>{page.path}</span>
                      <strong>
                        {page.views}
                      </strong>
                    </div>
                  )
                )
              )}
            </div>
          </article>
        </section>
      </div>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          background: #f5f3f8;
          color: #2f3547;
          font-family: Poppins, Inter, Arial,
            sans-serif;
        }

        button,
        a {
          font: inherit;
        }

        .page {
          min-height: 100vh;
          padding: 22px;
          background:
            radial-gradient(
              circle at 8% 4%,
              rgba(109, 77, 255, 0.12),
              transparent 28%
            ),
            radial-gradient(
              circle at 92% 8%,
              rgba(212, 175, 55, 0.08),
              transparent 22%
            ),
            #f5f3f8;
        }

        .shell {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
        }

        .hero {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
          padding: 28px;
          border-radius: 22px;
          background: linear-gradient(
            135deg,
            #261449,
            #5c3fd4 58%,
            #816cf1
          );
          color: white;
          box-shadow: 0 18px 48px
            rgba(55, 37, 116, 0.24);
        }

        .heroGlow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .heroGlowOne {
          width: 220px;
          height: 220px;
          right: -60px;
          top: -90px;
          background: rgba(
            255,
            255,
            255,
            0.12
          );
        }

        .heroGlowTwo {
          width: 150px;
          height: 150px;
          left: 45%;
          bottom: -100px;
          background: rgba(
            212,
            175,
            55,
            0.15
          );
        }

        .heroCopy,
        .heroActions {
          position: relative;
          z-index: 1;
        }

        .heroCopy > span {
          color: #eadb8a;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.1px;
        }

        .heroCopy h1 {
          margin: 6px 0 0;
          font-size: clamp(30px, 4vw, 48px);
          line-height: 1.05;
        }

        .heroCopy p {
          max-width: 760px;
          margin: 12px 0 0;
          color: rgba(
            255,
            255,
            255,
            0.82
          );
          font-size: 13px;
          line-height: 1.65;
        }

        .heroActions {
          display: flex;
          gap: 10px;
          flex-shrink: 0;
        }

        .heroActions button,
        .heroActions a {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 16px;
          border-radius: 11px;
          font-size: 12px;
          font-weight: 850;
          text-decoration: none;
          cursor: pointer;
        }

        .refreshButton {
          border: 1px solid rgba(
            255,
            255,
            255,
            0.25
          );
          background: rgba(
            255,
            255,
            255,
            0.12
          );
          color: white;
        }

        .refreshButton:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .backButton {
          border: 1px solid #d9bf62;
          background: linear-gradient(
            135deg,
            #d4af37,
            #efd15f
          );
          color: #24114a;
        }

        .rangeBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 14px;
          padding: 14px 16px;
          border: 1px solid #e5e1ef;
          border-radius: 14px;
          background: rgba(
            255,
            255,
            255,
            0.9
          );
          box-shadow: 0 8px 24px
            rgba(40, 34, 68, 0.05);
        }

        .rangeBar span,
        .rangeBar strong {
          display: block;
        }

        .rangeBar span {
          color: #807695;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.7px;
        }

        .rangeBar strong {
          margin-top: 2px;
          color: #354052;
          font-size: 13px;
        }

        .rangeButtons {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .rangeButtons button {
          padding: 8px 12px;
          border: 1px solid #ded9ea;
          border-radius: 9px;
          background: #faf9fc;
          color: #625b73;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .rangeButtons button.active {
          border-color: #6d4dff;
          background: #6d4dff;
          color: white;
          box-shadow: 0 7px 18px
            rgba(109, 77, 255, 0.2);
        }

        .errorMessage {
          margin-top: 14px;
          padding: 12px 14px;
          border: 1px solid #f2c5c5;
          border-radius: 11px;
          background: #fff4f4;
          color: #a33b3b;
          font-size: 11px;
        }

        .kpiGrid {
          display: grid;
          grid-template-columns:
            repeat(6, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .contentGrid {
          display: grid;
          grid-template-columns:
            minmax(0, 1.55fr)
            minmax(300px, 0.45fr);
          gap: 12px;
          margin-top: 12px;
        }

        .lowerGrid {
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
        }

        .panel {
          min-width: 0;
          padding: 18px;
          border: 1px solid #e5e1ed;
          border-radius: 16px;
          background: rgba(
            255,
            255,
            255,
            0.94
          );
          box-shadow: 0 12px 32px
            rgba(46, 38, 76, 0.055);
        }

        .sourceList,
        .deviceList,
        .campaignList,
        .pageList,
        .funnel {
          display: grid;
          gap: 8px;
          margin-top: 14px;
        }

        .sourceRow {
          display: grid;
          grid-template-columns:
            minmax(150px, 1.4fr)
            repeat(5, minmax(64px, 0.55fr))
            minmax(76px, 0.6fr);
          align-items: center;
          gap: 8px;
          padding: 10px;
          border: 1px solid #ece8f1;
          border-radius: 11px;
          background: #fcfbfd;
        }

        .sourceName {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }

        .sourceDot {
          width: 10px;
          height: 10px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #7c67ef;
          box-shadow: 0 0 0 4px
            rgba(124, 103, 239, 0.1);
        }

        .source-facebook .sourceDot {
          background: #5076b8;
        }

        .source-instagram .sourceDot {
          background: #b76591;
        }

        .source-google .sourceDot {
          background: #5c8d72;
        }

        .source-x .sourceDot {
          background: #4f5664;
        }

        .source-direct .sourceDot {
          background: #a27a4e;
        }

        .sourceName strong,
        .sourceName small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sourceName strong {
          color: #333a4b;
          font-size: 10px;
        }

        .sourceName small {
          margin-top: 2px;
          color: #8a90a0;
          font-size: 7px;
        }

        .conversionMetric {
          text-align: right;
        }

        .conversionMetric strong,
        .conversionMetric span {
          display: block;
        }

        .conversionMetric strong {
          color: #6d4dff;
          font-size: 11px;
        }

        .conversionMetric span {
          margin-top: 2px;
          color: #8a90a0;
          font-size: 6px;
        }

        .deviceRow {
          padding: 11px;
          border: 1px solid #ece8f1;
          border-radius: 11px;
          background: #fcfbfd;
        }

        .deviceTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .deviceTop strong {
          color: #354052;
          font-size: 10px;
        }

        .deviceTop span {
          color: #7f8594;
          font-size: 8px;
        }

        .deviceBar {
          height: 8px;
          margin-top: 7px;
          overflow: hidden;
          border-radius: 999px;
          background: #ede9f4;
        }

        .deviceBar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            #6d4dff,
            #9b8af5
          );
        }

        .device-desktop .deviceBar span {
          background: linear-gradient(
            90deg,
            #5c8d72,
            #8dbda7
          );
        }

        .device-tablet .deviceBar span {
          background: linear-gradient(
            90deg,
            #b77c4f,
            #d7aa83
          );
        }

        .funnelStep {
          padding: 9px 0;
        }

        .funnelTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .funnelTop span {
          color: #72798a;
          font-size: 9px;
        }

        .funnelTop strong {
          color: #32394b;
          font-size: 10px;
        }

        .funnelBar {
          height: 8px;
          margin-top: 6px;
          overflow: hidden;
          border-radius: 999px;
          background: #edeaf2;
        }

        .funnelBar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #7964ee;
        }

        .funnelStep.product .funnelBar span {
          background: #66899c;
        }

        .funnelStep.cart .funnelBar span {
          background: #b58a57;
        }

        .funnelStep.checkout .funnelBar span {
          background: #9e668b;
        }

        .funnelStep.purchase .funnelBar span {
          background: #568372;
        }

        .campaignRow,
        .pageRow {
          display: grid;
          align-items: center;
          gap: 9px;
          padding: 10px;
          border: 1px solid #ece8f1;
          border-radius: 10px;
          background: #fcfbfd;
        }

        .campaignRow {
          grid-template-columns:
            26px minmax(0, 1fr) auto;
        }

        .pageRow {
          grid-template-columns:
            26px minmax(0, 1fr) auto;
        }

        .campaignRow > b,
        .pageRow > b {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border-radius: 7px;
          background: #f0edff;
          color: #6d4dff;
          font-size: 8px;
        }

        .campaignInfo {
          min-width: 0;
        }

        .campaignInfo strong,
        .campaignInfo span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .campaignInfo strong {
          color: #364052;
          font-size: 9px;
        }

        .campaignInfo span {
          margin-top: 3px;
          color: #858b99;
          font-size: 7px;
        }

        .campaignRevenue {
          color: #4f806f;
          font-size: 9px;
        }

        .pageRow span {
          overflow: hidden;
          color: #5c6373;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pageRow strong {
          color: #394154;
          font-size: 9px;
        }

        @media (max-width: 1180px) {
          .kpiGrid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .contentGrid,
          .lowerGrid {
            grid-template-columns: 1fr;
          }

          .sourceRow {
            grid-template-columns:
              minmax(140px, 1.4fr)
              repeat(3, minmax(58px, 0.55fr))
              minmax(70px, 0.6fr);
          }

          .sourceRow > :nth-child(5),
          .sourceRow > :nth-child(6) {
            display: none;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 12px;
          }

          .hero {
            align-items: stretch;
            flex-direction: column;
            padding: 20px;
          }

          .heroActions {
            width: 100%;
          }

          .heroActions button,
          .heroActions a {
            flex: 1;
          }

          .rangeBar {
            align-items: stretch;
            flex-direction: column;
          }

          .rangeButtons {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .kpiGrid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .sourceRow {
            grid-template-columns:
              minmax(0, 1fr)
              repeat(2, auto);
          }

          .sourceRow > :nth-child(4),
          .sourceRow > :nth-child(5),
          .sourceRow > :nth-child(6),
          .sourceRow > :nth-child(7) {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}

function KpiCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string | number;
  note: string;
  tone:
    | "purple"
    | "blue"
    | "orange"
    | "pink"
    | "green"
    | "gold";
}) {
  return (
    <article className={`kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>

      <style jsx>{`
        .kpi {
          position: relative;
          min-width: 0;
          overflow: hidden;
          padding: 16px;
          border: 1px solid #e7e2ee;
          border-radius: 15px;
          background: white;
          box-shadow: 0 10px 28px
            rgba(45, 36, 74, 0.055);
        }

        .kpi::after {
          position: absolute;
          right: -18px;
          bottom: -24px;
          width: 70px;
          height: 70px;
          border-radius: 50%;
          background: rgba(
            109,
            77,
            255,
            0.08
          );
          content: "";
        }

        .kpi > span,
        .kpi > strong,
        .kpi > small {
          position: relative;
          z-index: 1;
          display: block;
        }

        .kpi > span {
          color: #746b88;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.6px;
        }

        .kpi > strong {
          margin-top: 6px;
          color: #2f3749;
          font-size: 25px;
          line-height: 1;
        }

        .kpi > small {
          margin-top: 6px;
          color: #858b99;
          font-size: 7px;
          line-height: 1.4;
        }

        .kpi.blue {
          background: linear-gradient(
            145deg,
            #eef7ff,
            #ffffff
          );
        }

        .kpi.orange {
          background: linear-gradient(
            145deg,
            #fff7ec,
            #ffffff
          );
        }

        .kpi.pink {
          background: linear-gradient(
            145deg,
            #fff1f7,
            #ffffff
          );
        }

        .kpi.green {
          background: linear-gradient(
            145deg,
            #eefbf5,
            #ffffff
          );
        }

        .kpi.gold {
          background: linear-gradient(
            145deg,
            #fff9e9,
            #ffffff
          );
        }
      `}</style>
    </article>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="miniMetric">
      <span>{label}</span>
      <strong>{value}</strong>

      <style jsx>{`
        .miniMetric {
          text-align: center;
        }

        .miniMetric span,
        .miniMetric strong {
          display: block;
        }

        .miniMetric span {
          color: #8a90a0;
          font-size: 6.5px;
        }

        .miniMetric strong {
          margin-top: 2px;
          color: #394153;
          font-size: 9px;
        }
      `}</style>
    </div>
  );
}

function PanelHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="heading">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{subtitle}</p>

      <style jsx>{`
        .heading span {
          color: #756991;
          font-size: 7.5px;
          font-weight: 900;
          letter-spacing: 0.7px;
        }

        .heading h2 {
          margin: 4px 0 0;
          color: #30384b;
          font-size: 17px;
        }

        .heading p {
          max-width: 760px;
          margin: 5px 0 0;
          color: #858b99;
          font-size: 8px;
          line-height: 1.55;
        }
      `}</style>
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="emptyState">
      {text}

      <style jsx>{`
        .emptyState {
          padding: 18px;
          border: 1px dashed #dcd7e7;
          border-radius: 10px;
          background: #faf9fc;
          color: #858b99;
          font-size: 8px;
          line-height: 1.5;
          text-align: center;
        }
      `}</style>
    </div>
  );
}