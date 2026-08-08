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

type PurchaseListRow = {
  id: string;
  normalized_key: string;
  source_product_id: number | null;
  brand: string;
  product_name: string;
  size: string | null;
  colour: string | null;
  required_qty: number;
  current_stock: number | null;
  note: string | null;
  source: string;
  status: "ACTIVE" | "PURCHASED";
  added_by: string | null;
};

type BuyingDecision = "BUY_NOW" | "REORDER_SOON" | "HOLD" | "DONT_BUY";

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

function normalizeKeyPart(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function purchaseListKey(row: VariantRow) {
  return [
    normalizeKeyPart(row.brand || "NEW CITY STYLE"),
    normalizeKeyPart(row.product_name),
    normalizeKeyPart(row.size),
    normalizeKeyPart(row.color),
  ].join("|");
}

function buyingDecision(row: VariantRow): BuyingDecision {
  const status = String(row.final_stock_status || "").toUpperCase();
  const action = String(row.final_recommended_action || "").toUpperCase();
  const reorderQty = Math.max(0, Number(row.final_reorder_quantity || 0));

  if (
    reorderQty > 0 &&
    (
      status.includes("OUT_OF_STOCK") ||
      status.includes("URGENT") ||
      action.includes("BUY NOW")
    )
  ) {
    return "BUY_NOW";
  }

  if (
    reorderQty > 0 &&
    (
      status.includes("REORDER") ||
      action.includes("REORDER")
    )
  ) {
    return "REORDER_SOON";
  }

  if (
    status.includes("CRITICAL_DEAD") ||
    status.includes("DEAD_STOCK") ||
    action.includes("DON'T BUY") ||
    action.includes("DONT BUY") ||
    action.includes("DO NOT BUY")
  ) {
    return "DONT_BUY";
  }

  return "HOLD";
}

function decisionLabel(value: BuyingDecision) {
  if (value === "BUY_NOW") return "BUY NOW";
  if (value === "REORDER_SOON") return "REORDER SOON";
  if (value === "DONT_BUY") return "DON'T BUY";
  return "HOLD";
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
  const [currentPage, setCurrentPage] = useState(1);
  const [smartFilter, setSmartFilter] = useState<"ALL" | BuyingDecision>("ALL");
  const [purchaseList, setPurchaseList] = useState<PurchaseListRow[]>([]);
  const [purchaseSyncing, setPurchaseSyncing] = useState(false);
  const [purchaseSyncMessage, setPurchaseSyncMessage] = useState("");
  const [autoSyncDone, setAutoSyncDone] = useState(false);
  const rowsPerPage = 15;

  async function loadData(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorText("");

    try {
      const [
        summaryResult,
        variantsResult,
        sizeResult,
        colourResult,
        brandResult,
        purchaseListResult,
      ] = await Promise.all([
          supabase.from("ncs_owner_summary_v2").select("*").maybeSingle(),
          supabase
            .from("ncs_variant_intelligence_v2")
            .select("*")
            .order("fast_moving_score", { ascending: false })
            .limit(500),
          supabase
            .from("ncs_size_demand")
            .select("*")
            .order("demand_share_percent", { ascending: false })
            .limit(30),
          supabase
            .from("ncs_colour_demand")
            .select("*")
            .order("demand_share_percent", { ascending: false })
            .limit(30),
          supabase
            .from("ncs_brand_performance")
            .select("*")
            .order("revenue_30d", { ascending: false })
            .limit(30),
          supabase
            .from("ncs_purchase_list")
            .select("*")
            .eq("status", "ACTIVE")
            .order("created_at", { ascending: false }),
        ]);

      const firstError =
        summaryResult.error ||
        variantsResult.error ||
        sizeResult.error ||
        colourResult.error ||
        brandResult.error ||
        purchaseListResult.error;

      if (firstError) throw firstError;

      setSummary((summaryResult.data as SummaryRow | null) || null);
      setVariants((variantsResult.data as VariantRow[]) || []);
      setSizes((sizeResult.data as DemandRow[]) || []);
      setColours((colourResult.data as DemandRow[]) || []);
      setBrands((brandResult.data as BrandRow[]) || []);
      setPurchaseList((purchaseListResult.data as PurchaseListRow[]) || []);
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

  const smartGroups = useMemo(() => {
    const groups: Record<BuyingDecision, VariantRow[]> = {
      BUY_NOW: [],
      REORDER_SOON: [],
      HOLD: [],
      DONT_BUY: [],
    };

    variants.forEach((row) => {
      groups[buyingDecision(row)].push(row);
    });

    return groups;
  }, [variants]);

  async function syncSmartPurchaseList(showMessage = true) {
    if (purchaseSyncing || variants.length === 0) return;

    const candidates = variants.filter((row) => {
      const decision = buyingDecision(row);
      return (
        (decision === "BUY_NOW" || decision === "REORDER_SOON") &&
        Number(row.final_reorder_quantity || 0) > 0
      );
    });

    if (candidates.length === 0) {
      if (showMessage) {
        setPurchaseSyncMessage("No BUY NOW / REORDER SOON items need adding.");
      }
      return;
    }

    setPurchaseSyncing(true);
    if (showMessage) setPurchaseSyncMessage("");

    try {
      const { data: activeRows, error: listError } = await supabase
        .from("ncs_purchase_list")
        .select("*")
        .eq("status", "ACTIVE");

      if (listError) throw listError;

      const existing = (activeRows as PurchaseListRow[]) || [];
      const existingByKey = new Map(existing.map((row) => [row.normalized_key, row]));

      const inserts: Array<Record<string, unknown>> = [];
      const updates: Array<PromiseLike<unknown>> = [];

      candidates.forEach((row) => {
        const key = purchaseListKey(row);
        const requiredQty = Math.max(1, Math.round(Number(row.final_reorder_quantity || 1)));
        const current = existingByKey.get(key);
        const decision = buyingDecision(row);

        if (!current) {
          inserts.push({
            normalized_key: key,
            source_product_id: row.product_id,
            brand: String(row.brand || "NEW CITY STYLE").trim() || "NEW CITY STYLE",
            product_name: String(row.product_name || "Unnamed Product").trim(),
            size: row.size || null,
            colour: row.color || null,
            required_qty: requiredQty,
            current_stock: Math.max(0, Math.round(Number(row.current_stock || 0))),
            note: `${decisionLabel(decision)} • Stock Intelligence auto-sync`,
            source: "STOCK_INTELLIGENCE",
            status: "ACTIVE",
            added_by: "WEB_STOCK_INTELLIGENCE",
          });
        } else if (
          current.source === "STOCK_INTELLIGENCE" &&
          (
            Number(current.required_qty || 0) !== requiredQty ||
            Number(current.current_stock || 0) !== Math.max(0, Math.round(Number(row.current_stock || 0)))
          )
        ) {
          updates.push(
            supabase
              .from("ncs_purchase_list")
              .update({
                required_qty: requiredQty,
                current_stock: Math.max(0, Math.round(Number(row.current_stock || 0))),
                note: `${decisionLabel(decision)} • Stock Intelligence auto-sync`,
              })
              .eq("id", current.id)
              .then(() => undefined),
          );
        }
      });

      if (inserts.length > 0) {
        const { error: insertError } = await supabase
          .from("ncs_purchase_list")
          .insert(inserts);

        if (insertError) throw insertError;
      }

      if (updates.length > 0) {
        await Promise.all(updates);
      }

      const { data: refreshed, error: refreshError } = await supabase
        .from("ncs_purchase_list")
        .select("*")
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false });

      if (refreshError) throw refreshError;
      setPurchaseList((refreshed as PurchaseListRow[]) || []);

      if (showMessage) {
        setPurchaseSyncMessage(
          `${inserts.length} added • ${updates.length} updated • ${candidates.length} smart-buy items covered`,
        );
      }
    } catch (error) {
      console.error("Smart purchase-list sync error:", error);
      if (showMessage) {
        setPurchaseSyncMessage(
          error instanceof Error
            ? error.message
            : "Unable to sync smart purchase list.",
        );
      }
    } finally {
      setPurchaseSyncing(false);
    }
  }

  useEffect(() => {
    if (!loading && variants.length > 0 && !autoSyncDone) {
      setAutoSyncDone(true);
      void syncSmartPurchaseList(false);
    }
  }, [loading, variants, autoSyncDone]);


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

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, categoryFilter, smartFilter]);

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

      const matchesStatus =
        statusFilter === "ALL" ||
        status === statusFilter ||
        (statusFilter === "REORDER_GROUP" &&
          ["REORDER_URGENT", "REORDER_SOON", "OUT_OF_STOCK"].includes(status)) ||
        (statusFilter === "SLOW_DEAD_GROUP" &&
          [
            "SLOW_MOVING",
            "DEAD_STOCK_RISK",
            "CRITICAL_DEAD_STOCK",
          ].includes(status)) ||
        (statusFilter === "REORDER_UNITS_GROUP" &&
          Number(row.final_reorder_quantity || 0) > 0);

      const matchesSmart =
        smartFilter === "ALL" ||
        buyingDecision(row) === smartFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSmart &&
        (categoryFilter === "ALL" || category === categoryFilter)
      );
    });
  }, [variants, search, statusFilter, categoryFilter, smartFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredVariants.length / rowsPerPage),
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedVariants = useMemo(() => {
    const start = (safeCurrentPage - 1) * rowsPerPage;
    return filteredVariants.slice(start, start + rowsPerPage);
  }, [filteredVariants, safeCurrentPage]);

  const visibleStart =
    filteredVariants.length === 0
      ? 0
      : (safeCurrentPage - 1) * rowsPerPage + 1;

  const visibleEnd = Math.min(
    safeCurrentPage * rowsPerPage,
    filteredVariants.length,
  );

  const activePurchaseKeys = useMemo(
    () => new Set(purchaseList.map((row) => row.normalized_key)),
    [purchaseList],
  );

  const smartPurchaseCovered = useMemo(
    () =>
      variants.filter((row) => {
        const decision = buyingDecision(row);
        return (
          (decision === "BUY_NOW" || decision === "REORDER_SOON") &&
          activePurchaseKeys.has(purchaseListKey(row))
        );
      }).length,
    [variants, activePurchaseKeys],
  );

  const smartPurchaseTotal =
    smartGroups.BUY_NOW.length + smartGroups.REORDER_SOON.length;

  const summaryCards = [
    {
      label: "New Stock",
      value: summary?.new_stock_variants,
      icon: "✨",
      tone: "blue",
      filter: "NEW_STOCK",
    },
    {
      label: "Emerging Demand",
      value: summary?.emerging_demand_variants,
      icon: "🚀",
      tone: "gold",
      filter: "EMERGING_DEMAND",
    },
    {
      label: "Fast Moving",
      value: summary?.fast_moving_variants,
      icon: "⚡",
      tone: "green",
      filter: "FAST_MOVING",
    },
    {
      label: "Reorder Alerts",
      value:
        Number(summary?.urgent_reorders || 0) +
        Number(summary?.reorder_soon || 0),
      icon: "📥",
      tone: "orange",
      filter: "REORDER",
    },
    {
      label: "Slow / Dead Risk",
      value:
        Number(summary?.slow_moving_variants || 0) +
        Number(summary?.dead_stock_risk_variants || 0) +
        Number(summary?.critical_dead_stock_variants || 0),
      icon: "⏳",
      tone: "red",
      filter: "SLOW_DEAD",
    },
    {
      label: "Suggested Units",
      value: summary?.suggested_reorder_units,
      icon: "📦",
      tone: "violet",
      filter: "REORDER_UNITS",
    },
  ];

  function applyCardFilter(filter: string) {
    setSearch("");
    setCategoryFilter("ALL");

    if (filter === "REORDER") {
      setStatusFilter("REORDER_GROUP");
    } else if (filter === "SLOW_DEAD") {
      setStatusFilter("SLOW_DEAD_GROUP");
    } else if (filter === "REORDER_UNITS") {
      setStatusFilter("REORDER_UNITS_GROUP");
    } else {
      setStatusFilter(filter);
    }

    window.setTimeout(() => {
      document
        .getElementById("stock-intelligence-action-centre")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

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
        <div className="siHeroGlow siHeroGlowOne" />
        <div className="siHeroGlow siHeroGlowTwo" />
        <div className="siHeroOrbit siHeroOrbitOne" />
        <div className="siHeroOrbit siHeroOrbitTwo" />
        <div className="siHeroContent">
          <span className="siEyebrow">NEW CITY STYLE • OWNER INTELLIGENCE</span>
          <h1>Stock Intelligence</h1>
          <p>
            Know what is moving, what needs attention, where money is blocked,
            and what to reorder next.
          </p>
        </div>
        <div className="siHeroCrown" aria-hidden="true">
          <span>◆</span>
          <strong>NCS</strong>
          <small>SMART STOCK</small>
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

      <section className="siRoyalStrip" aria-label="Stock intelligence highlights">
        <div className="siRoyalTrack">
          <span>✦ LIVE SALES VELOCITY</span>
          <span>✦ SMART REORDER GUIDANCE</span>
          <span>✦ DEAD STOCK PROTECTION</span>
          <span>✦ SIZE & COLOUR DEMAND</span>
          <span>✦ PROFIT CONTRIBUTION</span>
          <span>✦ LIVE SALES VELOCITY</span>
          <span>✦ SMART REORDER GUIDANCE</span>
          <span>✦ DEAD STOCK PROTECTION</span>
          <span>✦ SIZE & COLOUR DEMAND</span>
          <span>✦ PROFIT CONTRIBUTION</span>
        </div>
      </section>

      {errorText && (
        <section className="siError">
          <strong>Unable to load intelligence</strong>
          <span>{errorText}</span>
        </section>
      )}

      <section className="siMetricGrid">
        {summaryCards.map((card) => (
          <button
            key={card.label}
            type="button"
            className={`siMetric siMetric-${card.tone}`}
            onClick={() => applyCardFilter(card.filter)}
            title={`Show ${card.label}`}
          >
            <span className="siMetricShine" />
            <div className="siMetricIcon">{card.icon}</div>
            <div>
              <span>{card.label}</span>
              <strong>{number(card.value)}</strong>
              <small>Click to view</small>
            </div>
          </button>
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

      <section className="siSmartPanel">
        <div className="siSmartHead">
          <div>
            <span className="siSectionTag">SMART BUYING GUIDE</span>
            <h2>Search → Decide → Purchase List</h2>
            <p>BUY NOW and REORDER SOON items are auto-synced to the shared purchase list.</p>
          </div>

          <div className="siSmartActions">
            <button
              type="button"
              className="siSyncPurchase"
              onClick={() => void syncSmartPurchaseList(true)}
              disabled={purchaseSyncing}
            >
              {purchaseSyncing ? "SYNCING..." : "↻ SYNC PURCHASE LIST"}
            </button>

            <a className="siOpenPurchaseList" href="/admin/purchases">
              OPEN PURCHASES →
            </a>
          </div>
        </div>

        <div className="siDecisionGrid">
          {([
            ["BUY_NOW", "BUY NOW", smartGroups.BUY_NOW.length, "danger"],
            ["REORDER_SOON", "REORDER SOON", smartGroups.REORDER_SOON.length, "warning"],
            ["HOLD", "HOLD", smartGroups.HOLD.length, "success"],
            ["DONT_BUY", "DON'T BUY", smartGroups.DONT_BUY.length, "neutral"],
          ] as const).map(([value, label, count, tone]) => (
            <button
              key={value}
              type="button"
              className={`siDecisionCard siDecision-${tone} ${smartFilter === value ? "active" : ""}`}
              onClick={() => {
                setSmartFilter((current) => current === value ? "ALL" : value);
                window.setTimeout(() => {
                  document
                    .getElementById("stock-intelligence-action-centre")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 50);
              }}
            >
              <span>{label}</span>
              <strong>{count}</strong>
              <small>{smartFilter === value ? "FILTER ACTIVE" : "TAP TO FILTER"}</small>
            </button>
          ))}
        </div>

        <div className="siPurchasePulse">
          <div>
            <span>SHARED PURCHASE LIST</span>
            <strong>{purchaseList.length} active items</strong>
          </div>
          <div>
            <span>SMART ITEMS COVERED</span>
            <strong>{smartPurchaseCovered} / {smartPurchaseTotal}</strong>
          </div>
          <div>
            <span>AUTO SYNC</span>
            <strong>{purchaseSyncing ? "WORKING" : "ON"}</strong>
          </div>
        </div>

        {purchaseSyncMessage && (
          <div className="siPurchaseMessage">{purchaseSyncMessage}</div>
        )}
      </section>

      <section className="siPanel" id="stock-intelligence-action-centre">
        <div className="siPanelHead">
          <div>
            <span className="siSectionTag">ACTION CENTRE</span>
            <h2>Product & Variant Intelligence</h2>
          </div>
          <div className="siHeadActions">
            <span className="siCount">{filteredVariants.length} variants</span>
            <button
              type="button"
              className="siClearFilter"
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setCategoryFilter("ALL");
                setSmartFilter("ALL");
              }}
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="siFilters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, barcode, brand, size or colour..."
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="REORDER_GROUP">All reorder alerts</option>
            <option value="SLOW_DEAD_GROUP">All slow / dead risk</option>
            <option value="REORDER_UNITS_GROUP">Suggested reorder units</option>
            {Array.from(
              new Set(
                variants
                  .map((row) => String(row.final_stock_status || ""))
                  .filter(Boolean),
              ),
            )
              .sort()
              .map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="ALL">All categories</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>

        <div className="siQuickSearch">
          <button type="button" onClick={() => setSearch("")}>ALL</button>
          <button type="button" onClick={() => setSmartFilter("BUY_NOW")}>BUY NOW</button>
          <button type="button" onClick={() => setSmartFilter("REORDER_SOON")}>REORDER SOON</button>
          <button type="button" onClick={() => setStatusFilter("REORDER_UNITS_GROUP")}>SUGGESTED UNITS</button>
          <button type="button" onClick={() => setStatusFilter("SLOW_DEAD_GROUP")}>SLOW / DEAD</button>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("ALL");
              setCategoryFilter("ALL");
              setSmartFilter("ALL");
            }}
          >
            RESET
          </button>
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
              {paginatedVariants.map((row) => (
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

                    <span className={`siDecisionMini siDecisionMini-${buyingDecision(row).toLowerCase()}`}>
                      {decisionLabel(buyingDecision(row))}
                    </span>

                    {(buyingDecision(row) === "BUY_NOW" || buyingDecision(row) === "REORDER_SOON") &&
                      Number(row.final_reorder_quantity || 0) > 0 && (
                        <div className="siPurchaseRowActions">
                          <span className={activePurchaseKeys.has(purchaseListKey(row)) ? "siListOn" : "siListPending"}>
                            {activePurchaseKeys.has(purchaseListKey(row))
                              ? "✓ IN PURCHASE LIST"
                              : "AUTO-SYNC PENDING"}
                          </span>

                          <a
                            className="siReorderAction"
                            href={`/admin/purchases?source=stock-intelligence&productId=${row.product_id}&variantId=${row.variant_id}&quantity=${Math.max(
                              1,
                              Number(row.final_reorder_quantity || 1),
                            )}`}
                          >
                            <span>📥</span>
                            OPEN PURCHASE
                          </a>
                        </div>
                      )}
                  </td>
                </tr>
              ))}
              {filteredVariants.length === 0 && (
                <tr><td colSpan={9} className="siEmpty">No matching stock intelligence found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="siPagination">
          <div className="siPaginationInfo">
            Showing <strong>{visibleStart}</strong>–<strong>{visibleEnd}</strong>{" "}
            of <strong>{filteredVariants.length}</strong> variants
          </div>

          <div className="siPaginationControls">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
            >
              « First
            </button>

            <button
              type="button"
              onClick={() =>
                setCurrentPage((current) => Math.max(1, current - 1))
              }
              disabled={safeCurrentPage === 1}
            >
              ‹ Previous
            </button>

            <span>
              Page <strong>{safeCurrentPage}</strong> of{" "}
              <strong>{totalPages}</strong>
            </span>

            <button
              type="button"
              onClick={() =>
                setCurrentPage((current) =>
                  Math.min(totalPages, current + 1),
                )
              }
              disabled={safeCurrentPage === totalPages}
            >
              Next ›
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
            >
              Last »
            </button>
          </div>
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
        .siPage{min-height:100vh;padding:28px;background:radial-gradient(circle at 10% 0%,rgba(212,175,55,.12),transparent 22%),radial-gradient(circle at 92% 8%,rgba(10,46,115,.11),transparent 26%),linear-gradient(180deg,#fffaf0 0%,#f8f4ec 38%,#f3f7ff 100%);color:#14213d;font-family:Poppins,Inter,Arial,sans-serif;overflow:hidden}
        .siHero{position:relative;isolation:isolate;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:22px;padding:32px 30px;overflow:hidden;border:1px solid rgba(212,175,55,.78);border-radius:26px;background:linear-gradient(135deg,#020b24 0%,#061d4a 34%,#0a2e73 67%,#184fa4 100%);box-shadow:0 24px 55px rgba(3,21,63,.24),inset 0 1px 0 rgba(255,255,255,.12);color:#fff}
        .siHeroContent{position:relative;z-index:3}.siEyebrow,.siSectionTag{color:#f1d56e;font-size:10px;font-weight:950;letter-spacing:1.2px;text-shadow:0 0 18px rgba(212,175,55,.28)}
        .siHero h1{margin:7px 0 5px;font-size:34px;line-height:1.05;letter-spacing:-.6px;text-shadow:0 4px 20px rgba(0,0,0,.22)}
        .siHero p{max-width:720px;margin:0;color:rgba(255,255,255,.72);font-size:13px}
        .siRefresh{position:relative;z-index:4;min-height:48px;padding:0 20px;overflow:hidden;border:1px solid #f6df84;border-radius:14px;background:linear-gradient(135deg,#b8890b,#d4af37 45%,#f5dc79);color:#041944;font-weight:950;cursor:pointer;white-space:nowrap;box-shadow:0 12px 30px rgba(212,175,55,.32),inset 0 1px 0 rgba(255,255,255,.6);transition:transform .2s ease,box-shadow .2s ease}.siRefresh:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(212,175,55,.42)}
        .siRefresh:disabled{opacity:.65;cursor:wait}
        .siError{display:grid;gap:4px;margin-top:18px;padding:15px 17px;border:1px solid #f1b5b5;border-radius:14px;background:#fff1f1;color:#9f1d1d}.siError span{font-size:12px}
        .siMetricGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;margin-top:18px}
        .siMetric{position:relative;display:flex;align-items:center;gap:12px;min-height:108px;padding:16px;overflow:hidden;border:1px solid rgba(10,46,115,.12);border-radius:19px;background:linear-gradient(155deg,#fff 0%,#fbfcff 72%,#fff8df 100%);box-shadow:0 12px 30px rgba(3,21,63,.08),inset 0 1px 0 rgba(255,255,255,.9);text-align:left;font:inherit;cursor:pointer;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}.siMetric::after{content:'';position:absolute;inset:auto -18% -42% auto;width:96px;height:96px;border-radius:50%;background:radial-gradient(circle,rgba(212,175,55,.18),transparent 70%);transition:transform .35s ease}.siMetric:hover{transform:translateY(-4px) scale(1.015);border-color:rgba(212,175,55,.8);box-shadow:0 19px 40px rgba(3,21,63,.15),0 0 0 1px rgba(212,175,55,.1)}.siMetric:hover::after{transform:scale(1.25)}.siMetricShine{position:absolute;top:-120%;left:-38%;width:34%;height:340%;transform:rotate(24deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);animation:siCardShine 5.8s ease-in-out infinite}.siMetric small{display:block;margin-top:3px;color:#9aa3b2;font-size:8px;font-weight:800}
        .siMetricIcon{position:relative;z-index:2;width:46px;height:46px;display:grid;place-items:center;border:1px solid rgba(212,175,55,.22);border-radius:14px;font-size:21px;background:linear-gradient(145deg,#f2f6ff,#e7efff);box-shadow:0 8px 18px rgba(10,46,115,.12)}
        .siMetric span,.siMoneyGrid span{display:block;color:#667085;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.45px}
        .siMetric strong{display:block;margin-top:4px;color:#0a2e73;font-size:24px}
        .siMetric-gold .siMetricIcon{background:#fff4cf}.siMetric-green .siMetricIcon{background:#e8f8ef}.siMetric-orange .siMetricIcon{background:#fff0df}.siMetric-red .siMetricIcon{background:#ffe8e8}.siMetric-violet .siMetricIcon{background:#f1eaff}
        .siMoneyGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:14px}
        .siMoneyGrid article{position:relative;padding:20px;overflow:hidden;border:1px solid rgba(10,46,115,.13);border-radius:19px;background:linear-gradient(145deg,#ffffff 0%,#f8fbff 70%,#fff9e8 100%);box-shadow:0 12px 30px rgba(3,21,63,.07)}.siMoneyGrid article::before{content:'';position:absolute;top:0;left:0;width:100%;height:3px;background:linear-gradient(90deg,#0a2e73,#d4af37,#0a2e73);background-size:200% 100%;animation:siGoldLine 4s linear infinite}
        .siMoneyGrid strong{display:block;margin-top:7px;color:#0a2e73;font-size:23px}.siMoneyGrid small{display:block;margin-top:4px;color:#8a94a6;font-size:10px}
        .siPanel{position:relative;margin-top:18px;padding:20px;overflow:hidden;border:1px solid rgba(10,46,115,.12);border-radius:23px;background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(251,252,255,.96));box-shadow:0 16px 40px rgba(3,21,63,.09),inset 0 1px 0 rgba(255,255,255,.95)}.siPanel::before{content:'';position:absolute;top:0;left:0;width:100%;height:2px;background:linear-gradient(90deg,transparent,#d4af37 18%,#f5dc79 50%,#d4af37 82%,transparent);opacity:.8}
        .siPanelHead{display:flex;align-items:center;justify-content:space-between;gap:14px}.siHeadActions{display:flex;align-items:center;gap:8px}.siClearFilter{min-height:31px;padding:0 10px;border:1px solid #dce3ed;border-radius:999px;background:#fff;color:#0a2e73;font-size:9px;font-weight:900;cursor:pointer}.siClearFilter:hover{border-color:#d4af37;background:#fffaf0}.siPanelHead h2{margin:3px 0 0;color:#0a2e73;font-size:19px}.siCount{padding:7px 11px;border-radius:999px;background:#eef4ff;color:#0a2e73;font-size:10px;font-weight:900}
        .siFilters{display:grid;grid-template-columns:minmax(260px,1fr) 220px 220px;gap:10px;margin-top:16px}
        .siFilters input,.siFilters select{width:100%;min-height:44px;padding:0 13px;border:1px solid #dce2eb;border-radius:12px;background:#fff;color:#1f2a44;font:inherit;font-size:12px;outline:none}.siFilters input:focus,.siFilters select:focus{border-color:#d4af37;box-shadow:0 0 0 3px rgba(212,175,55,.13)}
        .siTableWrap{margin-top:15px;overflow-x:auto;border:1px solid #e6eaf0;border-radius:16px}
        table{width:100%;min-width:1350px;border-collapse:collapse}th{padding:12px;background:#071f52;color:#f2d56f;font-size:9px;text-align:left;text-transform:uppercase;letter-spacing:.6px}td{padding:12px;border-bottom:1px solid #edf0f5;vertical-align:top;font-size:11px}tbody tr:hover{background:#fffdf5}td strong,td span,td small{display:block}td strong{color:#17223c;font-size:12px}td span,td small{margin-top:3px;color:#768196;font-size:9px}td p{max-width:260px;margin:6px 0 0;color:#45526d;font-size:9px;line-height:1.4}
        .siBadge{display:inline-flex!important;width:max-content;align-items:center;min-height:24px;padding:4px 8px;border-radius:999px;font-size:8px!important;font-weight:950!important;letter-spacing:.35px}.siBadge-success{background:#e7f8ee;color:#11673b!important}.siBadge-warning{background:#fff4d8;color:#8a6100!important}.siBadge-danger{background:#ffe7e7;color:#a11f1f!important}.siBadge-info{background:#eaf2ff;color:#0a2e73!important}.siBadge-neutral{background:#f0f2f5;color:#59657a!important}
        .siEmpty{text-align:center!important;padding:34px!important;color:#7d8798!important}
        .siInsightGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.siInsightGrid .siPanel{min-width:0}
        .siRankList{display:grid;gap:8px;margin-top:14px}.siRankList>div{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px;border:1px solid #e9edf3;border-radius:12px;background:#fbfcff}.siRank{width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:#0a2e73;color:#d4af37;font-size:10px;font-weight:950}.siRankList strong,.siRankList small{display:block}.siRankList strong{color:#1a2743;font-size:11px}.siRankList small{margin-top:2px;color:#7c8799;font-size:8px}.siRankList b{color:#0a2e73;font-size:11px}

        .siHeroGlow{position:absolute;z-index:0;border-radius:50%;filter:blur(2px);pointer-events:none}
        .siHeroGlowOne{width:260px;height:260px;right:8%;top:-145px;background:radial-gradient(circle,rgba(212,175,55,.28),rgba(212,175,55,.05) 54%,transparent 70%);animation:siFloatGlow 7s ease-in-out infinite}
        .siHeroGlowTwo{width:210px;height:210px;left:34%;bottom:-145px;background:radial-gradient(circle,rgba(99,168,255,.24),rgba(99,168,255,.04) 58%,transparent 72%);animation:siFloatGlow 9s ease-in-out infinite reverse}
        .siHeroOrbit{position:absolute;z-index:1;border:1px solid rgba(212,175,55,.24);border-radius:50%;pointer-events:none}
        .siHeroOrbitOne{width:116px;height:116px;right:20%;top:18px;animation:siOrbit 12s linear infinite}
        .siHeroOrbitTwo{width:66px;height:66px;right:15%;bottom:14px;animation:siOrbit 8s linear infinite reverse}
        .siHeroOrbit::after{content:'◆';position:absolute;top:-8px;left:50%;color:#f1d56e;font-size:11px;text-shadow:0 0 12px rgba(212,175,55,.8)}
        .siHeroCrown{position:relative;z-index:3;width:112px;height:112px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid rgba(212,175,55,.65);border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.12),rgba(255,255,255,.03));box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 14px 30px rgba(0,0,0,.18);backdrop-filter:blur(9px);animation:siCrownFloat 4s ease-in-out infinite}
        .siHeroCrown span{color:#f1d56e;font-size:19px;line-height:1}.siHeroCrown strong{margin-top:7px;color:#f1d56e;font-size:17px;letter-spacing:1px}.siHeroCrown small{margin-top:4px;color:rgba(255,255,255,.64);font-size:7px;font-weight:900;letter-spacing:.7px}
        .siRoyalStrip{margin-top:14px;overflow:hidden;border:1px solid rgba(212,175,55,.48);border-radius:999px;background:linear-gradient(90deg,#061d4a,#0a2e73,#061d4a);box-shadow:0 9px 24px rgba(3,21,63,.14)}
        .siRoyalTrack{display:flex;width:max-content;gap:38px;padding:9px 22px;color:#f3d66f;font-size:9px;font-weight:950;letter-spacing:.75px;white-space:nowrap;animation:siTicker 26s linear infinite}
.siReorderAction{display:inline-flex!important;width:max-content;align-items:center;gap:6px;min-height:31px;margin-top:8px!important;padding:6px 10px;border:1px solid rgba(212,175,55,.78);border-radius:9px;background:linear-gradient(135deg,#0a2e73,#174fa8);color:#f3d66f!important;font-size:9px!important;font-weight:950!important;text-decoration:none!important;box-shadow:0 7px 16px rgba(3,21,63,.14);transition:transform .18s ease,box-shadow .18s ease}.siReorderAction:hover{transform:translateY(-2px);box-shadow:0 11px 22px rgba(3,21,63,.22)}.siReorderAction span{display:inline!important;margin:0!important;color:inherit!important;font-size:11px!important}
                .siRankList>div{transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}.siRankList>div:hover{transform:translateX(4px);border-color:rgba(212,175,55,.55);box-shadow:0 10px 24px rgba(3,21,63,.08)}
        tbody tr{transition:background .18s ease,transform .18s ease}tbody tr:hover{background:#fffaf0;box-shadow:inset 3px 0 0 #d4af37}
        @keyframes siCardShine{0%,68%{left:-42%;opacity:0}76%{opacity:1}88%,100%{left:125%;opacity:0}}
        @keyframes siGoldLine{to{background-position:200% 0}}
        @keyframes siFloatGlow{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(0,14px,0) scale(1.08)}}
        @keyframes siOrbit{to{transform:rotate(360deg)}}
        @keyframes siCrownFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes siTicker{to{transform:translateX(-50%)}}

        .siTableWrap{max-height:none}
        thead{position:sticky;top:0;z-index:8}
        .siPagination{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:14px;padding:12px 14px;border:1px solid rgba(10,46,115,.12);border-radius:14px;background:linear-gradient(180deg,#fff,#f8fbff)}
        .siPaginationInfo{color:#667085;font-size:10px;font-weight:750}
        .siPaginationInfo strong{color:#0a2e73}
        .siPaginationControls{display:flex;align-items:center;gap:7px}
        .siPaginationControls button{min-height:34px;padding:0 11px;border:1px solid rgba(10,46,115,.18);border-radius:9px;background:#fff;color:#0a2e73;font-size:9px;font-weight:900;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}
        .siPaginationControls button:hover:not(:disabled){transform:translateY(-1px);border-color:#d4af37;background:#fffaf0}
        .siPaginationControls button:disabled{opacity:.42;cursor:not-allowed}
        .siPaginationControls span{padding:0 5px;color:#667085;font-size:9px;white-space:nowrap}
        .siSmartPanel{margin-top:18px;padding:20px;border:1px solid rgba(10,46,115,.14);border-radius:23px;background:linear-gradient(135deg,#061d4a 0%,#0a2e73 58%,#174fa8 100%);box-shadow:0 18px 42px rgba(3,21,63,.18);color:#fff}
        .siSmartHead{display:flex;align-items:center;justify-content:space-between;gap:16px}.siSmartHead h2{margin:4px 0 2px;font-size:20px}.siSmartHead p{margin:0;color:rgba(255,255,255,.68);font-size:10px}.siSmartActions{display:flex;gap:8px;align-items:center}
        .siSyncPurchase,.siOpenPurchaseList{min-height:38px;display:inline-flex;align-items:center;justify-content:center;padding:0 13px;border-radius:11px;font-size:9px;font-weight:950;text-decoration:none;white-space:nowrap}.siSyncPurchase{border:1px solid #f1d56e;background:linear-gradient(135deg,#d4af37,#f2d879);color:#061d4a;cursor:pointer}.siSyncPurchase:disabled{opacity:.65;cursor:wait}.siOpenPurchaseList{border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff}
        .siDecisionGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:15px}.siDecisionCard{padding:14px;border:1px solid rgba(255,255,255,.18);border-radius:15px;background:rgba(255,255,255,.08);color:#fff;text-align:left;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}.siDecisionCard:hover,.siDecisionCard.active{transform:translateY(-2px);border-color:#f1d56e;background:rgba(255,255,255,.14)}.siDecisionCard span,.siDecisionCard strong,.siDecisionCard small{display:block}.siDecisionCard span{font-size:8px;font-weight:900;letter-spacing:.5px}.siDecisionCard strong{margin-top:3px;font-size:24px}.siDecisionCard small{margin-top:2px;color:rgba(255,255,255,.58);font-size:7px}.siDecision-danger strong{color:#ffb6b6}.siDecision-warning strong{color:#ffd877}.siDecision-success strong{color:#9fe0b8}.siDecision-neutral strong{color:#d9dfeb}
        .siPurchasePulse{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:12px}.siPurchasePulse>div{padding:11px 12px;border:1px solid rgba(255,255,255,.13);border-radius:12px;background:rgba(255,255,255,.06)}.siPurchasePulse span,.siPurchasePulse strong{display:block}.siPurchasePulse span{color:rgba(255,255,255,.55);font-size:7px;font-weight:900}.siPurchasePulse strong{margin-top:3px;color:#f1d56e;font-size:12px}.siPurchaseMessage{margin-top:10px;padding:9px 11px;border-radius:10px;background:rgba(255,255,255,.08);color:#e9f1ff;font-size:9px}
        .siQuickSearch{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.siQuickSearch button{min-height:31px;padding:0 10px;border:1px solid rgba(10,46,115,.16);border-radius:999px;background:#fff;color:#0a2e73;font-size:8px;font-weight:900;cursor:pointer}.siQuickSearch button:hover{border-color:#d4af37;background:#fffaf0}
        .siDecisionMini{display:inline-flex!important;width:max-content;margin-top:7px!important;padding:4px 7px;border-radius:999px;font-size:7px!important;font-weight:950!important}.siDecisionMini-buy_now{background:#ffe4e4;color:#9d1d1d!important}.siDecisionMini-reorder_soon{background:#fff0cf;color:#8b6200!important}.siDecisionMini-hold{background:#e5f7ec;color:#12643b!important}.siDecisionMini-dont_buy{background:#edf0f4;color:#59657a!important}
        .siPurchaseRowActions{display:grid;gap:5px;margin-top:6px}.siListOn,.siListPending{font-size:7px!important;font-weight:900!important}.siListOn{color:#16834a!important}.siListPending{color:#a36a00!important}
        @media(max-width:1350px){.siMetricGrid{grid-template-columns:repeat(3,minmax(0,1fr))}.siMoneyGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:900px){.siPagination{align-items:stretch;flex-direction:column}.siPaginationControls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.siPaginationControls span{grid-column:1/-1;text-align:center;order:-1}.siPaginationControls button{width:100%}.siPage{padding:104px 12px 20px}.siHero{grid-template-columns:1fr;align-items:flex-start;padding:22px}.siHeroCrown{display:none}.siHeroOrbitOne{right:8%}.siRoyalStrip{border-radius:14px}.siHero h1{font-size:27px}.siRefresh{width:100%}.siMetricGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.siMoneyGrid,.siInsightGrid{grid-template-columns:1fr}.siFilters{grid-template-columns:1fr}.siPanel{padding:14px;border-radius:17px}.siSmartHead{align-items:stretch;flex-direction:column}.siSmartActions{display:grid;grid-template-columns:1fr 1fr}.siDecisionGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.siPurchasePulse{grid-template-columns:1fr}}
        @media(max-width:520px){.siMetricGrid{grid-template-columns:1fr}.siMetric{min-height:82px}.siMoneyGrid strong{font-size:20px}.siHero h1{font-size:24px}}
      `}</style>
    </main>
  );
}
