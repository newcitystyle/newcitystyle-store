"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type SummaryRow = {
  new_stock_variants: number | null;
  observation_variants: number | null;
  emerging_demand_variants: number | null;
  fast_moving_variants: number | null;
  consistent_sellers: number | null;
  urgent_reorders: number | null;
  reorder_soon: number | null;
  slow_moving_variants: number | null;
  dead_stock_risk_variants: number | null;
  critical_dead_stock_variants: number | null;
  out_of_stock_variants: number | null;
  total_stock_investment: number | null;
  money_blocked_slow_dead: number | null;
  revenue_30d: number | null;
  gross_profit_30d: number | null;
  suggested_reorder_units: number | null;
  calculated_at: string | null;
};

type VariantRow = {
  variant_id: number;
  product_id: number;
  product_name: string | null;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  size: string | null;
  color: string | null;
  barcode: string | null;
  current_stock: number | null;
  current_mrp: number | null;
  weighted_purchase_cost: number | null;
  sold_7d: number | null;
  sold_30d: number | null;
  sold_90d: number | null;
  revenue_30d: number | null;
  gross_profit_30d: number | null;
  money_blocked: number | null;
  stock_age_days: number | null;
  stock_cover_days: number | null;
  fast_moving_score: number | null;
  adjusted_dead_stock_risk_score: number | null;
  age_stage: string | null;
  demand_status: string | null;
  final_stock_status: string | null;
  final_confidence_level: string | null;
  final_reorder_quantity: number | null;
  final_recommended_action: string | null;
};

type DemandRow = {
  category: string | null;
  size?: string | null;
  color?: string | null;
  sold_30d: number | null;
  sold_90d: number | null;
  demand_share_percent: number | null;
};

type BrandRow = {
  brand: string | null;
  current_stock: number | null;
  sold_30d: number | null;
  sold_90d: number | null;
  revenue_30d: number | null;
  gross_profit_30d: number | null;
  money_blocked: number | null;
  average_fast_score: number | null;
  average_dead_stock_risk: number | null;
  suggested_reorder_quantity: number | null;
};

const money = (value: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const number = (value: unknown) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(
    Number(value || 0),
  );

function statusClass(status: string | null | undefined) {
  const value = String(status || "").toUpperCase();
  if (value.includes("URGENT") || value.includes("CRITICAL") || value.includes("OUT_OF_STOCK")) return "danger";
  if (value.includes("REORDER") || value.includes("SLOW") || value.includes("RISK")) return "warning";
  if (value.includes("FAST") || value.includes("CONSISTENT")) return "success";
  if (value.includes("EMERGING") || value.includes("NEW") || value.includes("OBSERVATION")) return "info";
  return "neutral";
}

export default function StockIntelligencePage() {
  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [sizes, setSizes] = useState<DemandRow[]>([]);
  const [colours, setColours] = useState<DemandRow[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [refreshing, setRefreshing] = useState(false);

  async function loadData(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorText("");

    try {
      const schema = supabase.schema("ncs_intelligence");

      const [summaryResult, variantsResult, sizeResult, colourResult, brandResult] =
        await Promise.all([
          schema.from("owner_summary_v2").select("*").maybeSingle(),
          schema
            .from("variant_intelligence_v2")
            .select("*")
            .order("fast_moving_score", { ascending: false })
            .limit(500),
          schema
            .from("size_demand")
            .select("*")
            .order("demand_share_percent", { ascending: false })
            .limit(30),
          schema
            .from("colour_demand")
            .select("*")
            .order("demand_share_percent", { ascending: false })
            .limit(30),
          schema
            .from("brand_performance")
            .select("*")
            .order("revenue_30d", { ascending: false })
            .limit(30),
        ]);

      const firstError =
        summaryResult.error ||
        variantsResult.error ||
        sizeResult.error ||
        colourResult.error ||
        brandResult.error;

      if (firstError) throw firstError;

      setSummary((summaryResult.data as SummaryRow | null) || null);
      setVariants((variantsResult.data as VariantRow[]) || []);
      setSizes((sizeResult.data as DemandRow[]) || []);
      setColours((colourResult.data as DemandRow[]) || []);
      setBrands((brandResult.data as BrandRow[]) || []);
    } catch (error) {
      console.error("Stock intelligence load error:", error);
      setErrorText(
        error instanceof Error
          ? error.message
          : "Unable to load Stock Intelligence data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          variants
            .map((row) => String(row.category || "").trim())
            .filter(Boolean),
        ),
      ).sort(),
    [variants],
  );

  const filteredVariants = useMemo(() => {
    const query = search.trim().toLowerCase();

    return variants.filter((row) => {
      const status = String(row.final_stock_status || "");
      const category = String(row.category || "");
      const matchesSearch =
        !query ||
        [
          row.product_name,
          row.brand,
          row.category,
          row.size,
          row.color,
          row.barcode,
        ]
          .map((value) => String(value || "").toLowerCase())
          .some((value) => value.includes(query));

      return (
        matchesSearch &&
        (statusFilter === "ALL" || status === statusFilter) &&
        (categoryFilter === "ALL" || category === categoryFilter)
      );
    });
  }, [variants, search, statusFilter, categoryFilter]);

  const summaryCards = [
    { label: "New Stock", value: summary?.new_stock_variants, icon: "✨", tone: "blue" },
    { label: "Emerging Demand", value: summary?.emerging_demand_variants, icon: "🚀", tone: "gold" },
    { label: "Fast Moving", value: summary?.fast_moving_variants, icon: "⚡", tone: "green" },
    { label: "Reorder Alerts", value: Number(summary?.urgent_reorders || 0) + Number(summary?.reorder_soon || 0), icon: "📥", tone: "orange" },
    { label: "Slow / Dead Risk", value: Number(summary?.slow_moving_variants || 0) + Number(summary?.dead_stock_risk_variants || 0) + Number(summary?.critical_dead_stock_variants || 0), icon: "⏳", tone: "red" },
    { label: "Suggested Units", value: summary?.suggested_reorder_units, icon: "📦", tone: "violet" },
  ];

  if (loading) {
    return (
      <main className="siLoading">
        <div className="siLoader" />
        <h2>Opening Stock Intelligence...</h2>
        <p>Analysing sales, purchases, stock age and demand.</p>
        <style jsx>{`
          .siLoading{min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#0a2e73;text-align:center;font-family:Poppins,Arial,sans-serif}
          .siLoader{width:48px;height:48px;border:4px solid #d9e2f3;border-top-color:#d4af37;border-radius:50%;animation:spin .8s linear infinite}
          h2{margin:18px 0 4px} p{margin:0;color:#667085;font-size:13px}
          @keyframes spin{to{transform:rotate(360deg)}}
        `}</style>
      </main>
    );
  }

  return (
    <main className="siPage">
      <section className="siHero">
        <div>
          <span className="siEyebrow">NEW CITY STYLE • OWNER INTELLIGENCE</span>
          <h1>Stock Intelligence</h1>
          <p>
            Know what is moving, what needs attention, where money is blocked,
            and what to reorder next.
          </p>
        </div>
        <button
          type="button"
          className="siRefresh"
          onClick={() => void loadData(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "↻ Refresh Intelligence"}
        </button>
      </section>

      {errorText && (
        <section className="siError">
          <strong>Unable to load intelligence</strong>
          <span>{errorText}</span>
        </section>
      )}

      <section className="siMetricGrid">
        {summaryCards.map((card) => (
          <article key={card.label} className={`siMetric siMetric-${card.tone}`}>
            <div className="siMetricIcon">{card.icon}</div>
            <div>
              <span>{card.label}</span>
              <strong>{number(card.value)}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="siMoneyGrid">
        <article>
          <span>Total Stock Investment</span>
          <strong>{money(summary?.total_stock_investment)}</strong>
          <small>Current stock at weighted purchase cost</small>
        </article>
        <article>
          <span>Money Blocked in Slow / Dead</span>
          <strong>{money(summary?.money_blocked_slow_dead || 0)}</strong>
          <small>Actionable inventory risk</small>
        </article>
        <article>
          <span>Revenue — Last 30 Days</span>
          <strong>{money(summary?.revenue_30d)}</strong>
          <small>Return-adjusted sales</small>
        </article>
        <article>
          <span>Gross Profit — Last 30 Days</span>
          <strong>{money(summary?.gross_profit_30d)}</strong>
          <small>Based on stored item cost</small>
        </article>
      </section>

      <section className="siPanel">
        <div className="siPanelHead">
          <div>
            <span className="siSectionTag">ACTION CENTRE</span>
            <h2>Product & Variant Intelligence</h2>
          </div>
          <span className="siCount">{filteredVariants.length} variants</span>
        </div>

        <div className="siFilters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, barcode, brand, size or colour..."
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All statuses</option>
            {Array.from(new Set(variants.map((row) => String(row.final_stock_status || "")).filter(Boolean))).sort().map((value) => (
              <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
            ))}
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="ALL">All categories</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>

        <div className="siTableWrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>Stock</th>
                <th>7D / 30D / 90D</th>
                <th>Demand</th>
                <th>Age</th>
                <th>Blocked</th>
                <th>Reorder</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredVariants.map((row) => (
                <tr key={row.variant_id}>
                  <td>
                    <strong>{row.product_name || "Unnamed Product"}</strong>
                    <span>{row.brand || "NEW CITY STYLE"} • {row.category || "Others"}</span>
                  </td>
                  <td>
                    <strong>{row.size || "Standard"}</strong>
                    <span>{row.color || "No colour"}{row.barcode ? ` • ${row.barcode}` : ""}</span>
                  </td>
                  <td>
                    <strong>{number(row.current_stock)}</strong>
                    <span>{money(row.current_mrp)} MRP</span>
                  </td>
                  <td>
                    <strong>{number(row.sold_7d)} / {number(row.sold_30d)} / {number(row.sold_90d)}</strong>
                    <span>{row.stock_cover_days == null ? "No cover data" : `${number(row.stock_cover_days)} days cover`}</span>
                  </td>
                  <td>
                    <span className={`siBadge siBadge-${statusClass(row.demand_status)}`}>
                      {String(row.demand_status || "INSUFFICIENT_DATA").replaceAll("_", " ")}
                    </span>
                    <small>{row.final_confidence_level || "LOW"} confidence</small>
                  </td>
                  <td>
                    <strong>{number(row.stock_age_days)} days</strong>
                    <span>{String(row.age_stage || "").replaceAll("_", " ")}</span>
                  </td>
                  <td>
                    <strong>{money(row.money_blocked)}</strong>
                    <span>Risk {number(row.adjusted_dead_stock_risk_score)}%</span>
                  </td>
                  <td>
                    <strong>{number(row.final_reorder_quantity)}</strong>
                    <span>units</span>
                  </td>
                  <td>
                    <span className={`siBadge siBadge-${statusClass(row.final_stock_status)}`}>
                      {String(row.final_stock_status || "HEALTHY").replaceAll("_", " ")}
                    </span>
                    <p>{row.final_recommended_action || "Maintain current stock policy"}</p>
                  </td>
                </tr>
              ))}
              {filteredVariants.length === 0 && (
                <tr><td colSpan={9} className="siEmpty">No matching stock intelligence found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="siInsightGrid">
        <article className="siPanel">
          <div className="siPanelHead"><div><span className="siSectionTag">DEMAND</span><h2>Top Sizes</h2></div></div>
          <div className="siRankList">
            {sizes.slice(0, 10).map((row, index) => (
              <div key={`${row.category}-${row.size}-${index}`}>
                <span className="siRank">{index + 1}</span>
                <div><strong>{row.size || "Standard"}</strong><small>{row.category || "Others"}</small></div>
                <b>{number(row.demand_share_percent)}%</b>
              </div>
            ))}
          </div>
        </article>

        <article className="siPanel">
          <div className="siPanelHead"><div><span className="siSectionTag">DEMAND</span><h2>Top Colours</h2></div></div>
          <div className="siRankList">
            {colours.slice(0, 10).map((row, index) => (
              <div key={`${row.category}-${row.color}-${index}`}>
                <span className="siRank">{index + 1}</span>
                <div><strong>{row.color || "Not Specified"}</strong><small>{row.category || "Others"}</small></div>
                <b>{number(row.demand_share_percent)}%</b>
              </div>
            ))}
          </div>
        </article>

        <article className="siPanel">
          <div className="siPanelHead"><div><span className="siSectionTag">PERFORMANCE</span><h2>Top Brands</h2></div></div>
          <div className="siRankList">
            {brands.slice(0, 10).map((row, index) => (
              <div key={`${row.brand}-${index}`}>
                <span className="siRank">{index + 1}</span>
                <div><strong>{row.brand || "NEW CITY STYLE"}</strong><small>{number(row.sold_30d)} sold • {number(row.current_stock)} stock</small></div>
                <b>{money(row.revenue_30d)}</b>
              </div>
            ))}
          </div>
        </article>
      </section>

      <style jsx>{`
        .siPage{min-height:100vh;padding:28px;background:linear-gradient(180deg,#f8f4ec 0%,#f4f7fc 100%);color:#14213d;font-family:Poppins,Inter,Arial,sans-serif}
        .siHero{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:28px 30px;border:1px solid rgba(212,175,55,.55);border-radius:24px;background:radial-gradient(circle at 85% 0%,rgba(212,175,55,.23),transparent 28%),linear-gradient(135deg,#03153f,#0a2e73 62%,#174fa8);box-shadow:0 20px 45px rgba(3,21,63,.18);color:#fff}
        .siEyebrow,.siSectionTag{color:#d4af37;font-size:10px;font-weight:950;letter-spacing:1.2px}
        .siHero h1{margin:6px 0 4px;font-size:32px;line-height:1.1}
        .siHero p{max-width:720px;margin:0;color:rgba(255,255,255,.72);font-size:13px}
        .siRefresh{min-height:46px;padding:0 18px;border:1px solid #f0d36e;border-radius:13px;background:linear-gradient(135deg,#d4af37,#f1d56e);color:#06205a;font-weight:900;cursor:pointer;white-space:nowrap;box-shadow:0 9px 25px rgba(212,175,55,.25)}
        .siRefresh:disabled{opacity:.65;cursor:wait}
        .siError{display:grid;gap:4px;margin-top:18px;padding:15px 17px;border:1px solid #f1b5b5;border-radius:14px;background:#fff1f1;color:#9f1d1d}.siError span{font-size:12px}
        .siMetricGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;margin-top:18px}
        .siMetric{display:flex;align-items:center;gap:12px;min-height:104px;padding:16px;border:1px solid #e6eaf1;border-radius:18px;background:#fff;box-shadow:0 10px 28px rgba(3,21,63,.07)}
        .siMetricIcon{width:44px;height:44px;display:grid;place-items:center;border-radius:13px;font-size:21px;background:#eef4ff}
        .siMetric span,.siMoneyGrid span{display:block;color:#667085;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.45px}
        .siMetric strong{display:block;margin-top:4px;color:#0a2e73;font-size:24px}
        .siMetric-gold .siMetricIcon{background:#fff4cf}.siMetric-green .siMetricIcon{background:#e8f8ef}.siMetric-orange .siMetricIcon{background:#fff0df}.siMetric-red .siMetricIcon{background:#ffe8e8}.siMetric-violet .siMetricIcon{background:#f1eaff}
        .siMoneyGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:14px}
        .siMoneyGrid article{padding:19px;border:1px solid rgba(10,46,115,.12);border-radius:18px;background:linear-gradient(180deg,#fff,#fbfcff);box-shadow:0 10px 28px rgba(3,21,63,.06)}
        .siMoneyGrid strong{display:block;margin-top:7px;color:#0a2e73;font-size:23px}.siMoneyGrid small{display:block;margin-top:4px;color:#8a94a6;font-size:10px}
        .siPanel{margin-top:18px;padding:20px;border:1px solid #e4e8ef;border-radius:22px;background:rgba(255,255,255,.96);box-shadow:0 14px 36px rgba(3,21,63,.08)}
        .siPanelHead{display:flex;align-items:center;justify-content:space-between;gap:14px}.siPanelHead h2{margin:3px 0 0;color:#0a2e73;font-size:19px}.siCount{padding:7px 11px;border-radius:999px;background:#eef4ff;color:#0a2e73;font-size:10px;font-weight:900}
        .siFilters{display:grid;grid-template-columns:minmax(260px,1fr) 220px 220px;gap:10px;margin-top:16px}
        .siFilters input,.siFilters select{width:100%;min-height:44px;padding:0 13px;border:1px solid #dce2eb;border-radius:12px;background:#fff;color:#1f2a44;font:inherit;font-size:12px;outline:none}.siFilters input:focus,.siFilters select:focus{border-color:#d4af37;box-shadow:0 0 0 3px rgba(212,175,55,.13)}
        .siTableWrap{margin-top:15px;overflow-x:auto;border:1px solid #e6eaf0;border-radius:16px}
        table{width:100%;min-width:1350px;border-collapse:collapse}th{padding:12px;background:#071f52;color:#f2d56f;font-size:9px;text-align:left;text-transform:uppercase;letter-spacing:.6px}td{padding:12px;border-bottom:1px solid #edf0f5;vertical-align:top;font-size:11px}tbody tr:hover{background:#fffdf5}td strong,td span,td small{display:block}td strong{color:#17223c;font-size:12px}td span,td small{margin-top:3px;color:#768196;font-size:9px}td p{max-width:260px;margin:6px 0 0;color:#45526d;font-size:9px;line-height:1.4}
        .siBadge{display:inline-flex!important;width:max-content;align-items:center;min-height:24px;padding:4px 8px;border-radius:999px;font-size:8px!important;font-weight:950!important;letter-spacing:.35px}.siBadge-success{background:#e7f8ee;color:#11673b!important}.siBadge-warning{background:#fff4d8;color:#8a6100!important}.siBadge-danger{background:#ffe7e7;color:#a11f1f!important}.siBadge-info{background:#eaf2ff;color:#0a2e73!important}.siBadge-neutral{background:#f0f2f5;color:#59657a!important}
        .siEmpty{text-align:center!important;padding:34px!important;color:#7d8798!important}
        .siInsightGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.siInsightGrid .siPanel{min-width:0}
        .siRankList{display:grid;gap:8px;margin-top:14px}.siRankList>div{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px;border:1px solid #e9edf3;border-radius:12px;background:#fbfcff}.siRank{width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:#0a2e73;color:#d4af37;font-size:10px;font-weight:950}.siRankList strong,.siRankList small{display:block}.siRankList strong{color:#1a2743;font-size:11px}.siRankList small{margin-top:2px;color:#7c8799;font-size:8px}.siRankList b{color:#0a2e73;font-size:11px}
        @media(max-width:1350px){.siMetricGrid{grid-template-columns:repeat(3,minmax(0,1fr))}.siMoneyGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:900px){.siPage{padding:104px 12px 20px}.siHero{align-items:flex-start;flex-direction:column;padding:22px}.siHero h1{font-size:27px}.siRefresh{width:100%}.siMetricGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.siMoneyGrid,.siInsightGrid{grid-template-columns:1fr}.siFilters{grid-template-columns:1fr}.siPanel{padding:14px;border-radius:17px}}
        @media(max-width:520px){.siMetricGrid{grid-template-columns:1fr}.siMetric{min-height:82px}.siMoneyGrid strong{font-size:20px}.siHero h1{font-size:24px}}
      `}</style>
    </main>
  );
}