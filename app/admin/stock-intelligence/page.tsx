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

type SmartInsight = {
  score: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  decision: BuyingDecision;
  suggestedQty: number;
  coverDays: number | null;
  trendPercent: number | null;
  marginPercent: number | null;
  reason: string;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function smartInsight(row: VariantRow): SmartInsight {
  const stock = Math.max(0, Number(row.current_stock || 0));
  const sold7 = Math.max(0, Number(row.sold_7d || 0));
  const sold30 = Math.max(0, Number(row.sold_30d || 0));
  const sold90 = Math.max(0, Number(row.sold_90d || 0));
  const age = Math.max(0, Number(row.stock_age_days || 0));
  const deadRisk = clamp(Number(row.adjusted_dead_stock_risk_score || 0), 0, 100);
  const fastScore = clamp(Number(row.fast_moving_score || 0), 0, 100);
  const purchaseCost = Math.max(0, Number(row.weighted_purchase_cost || 0));
  const mrp = Math.max(0, Number(row.current_mrp || 0));

  const daily7 = sold7 / 7;
  const daily30 = sold30 / 30;
  const daily90 = sold90 / 90;
  const baselineDaily = daily90 > 0 ? daily90 : daily30;
  const recentDaily = daily7 > 0 ? daily7 : daily30;
  const calculatedCover =
    recentDaily > 0 ? stock / recentDaily : null;
  const coverDays =
    row.stock_cover_days == null
      ? calculatedCover
      : Math.max(0, Number(row.stock_cover_days));

  const trendPercent =
    baselineDaily > 0
      ? ((recentDaily - baselineDaily) / baselineDaily) * 100
      : recentDaily > 0
        ? 100
        : null;

  const marginPercent =
    mrp > 0 && purchaseCost > 0
      ? ((mrp - purchaseCost) / mrp) * 100
      : null;

  let score = 20;

  if (stock === 0) score += 38;
  else if (coverDays != null && coverDays <= 7) score += 30;
  else if (coverDays != null && coverDays <= 14) score += 24;
  else if (coverDays != null && coverDays <= 30) score += 14;
  else if (coverDays != null && coverDays >= 90) score -= 12;

  score += Math.min(18, sold30 * 2.2);
  score += Math.min(10, sold7 * 2.5);
  score += Math.min(10, fastScore / 10);

  if (trendPercent != null) {
    if (trendPercent >= 50) score += 12;
    else if (trendPercent >= 20) score += 8;
    else if (trendPercent <= -50) score -= 10;
    else if (trendPercent <= -20) score -= 5;
  }

  if (marginPercent != null) {
    if (marginPercent >= 45) score += 8;
    else if (marginPercent >= 30) score += 5;
    else if (marginPercent < 15) score -= 5;
  }

  score -= Math.min(30, deadRisk * 0.3);

  if (age >= 180 && sold30 === 0) score -= 24;
  else if (age >= 120 && sold30 === 0) score -= 16;
  else if (age <= 30 && sold7 > 0) score += 5;

  const status = String(row.final_stock_status || "").toUpperCase();
  const action = String(row.final_recommended_action || "").toUpperCase();

  if (status.includes("OUT_OF_STOCK") || status.includes("URGENT")) score += 12;
  if (status.includes("REORDER") || action.includes("REORDER")) score += 8;
  if (
    status.includes("CRITICAL_DEAD") ||
    status.includes("DEAD_STOCK") ||
    action.includes("DON'T BUY") ||
    action.includes("DONT BUY") ||
    action.includes("DO NOT BUY")
  ) {
    score -= 28;
  }

  score = Math.round(clamp(score, 0, 100));

  const targetDays =
    score >= 78 ? 35 :
    score >= 62 ? 28 :
    21;

  const demandDaily = Math.max(daily7, daily30, daily90);
  const calculatedQty =
    demandDaily > 0
      ? Math.ceil(demandDaily * targetDays - stock)
      : 0;
  const databaseQty = Math.max(0, Number(row.final_reorder_quantity || 0));
  const suggestedQty = Math.max(
    0,
    Math.round(Math.max(databaseQty, calculatedQty)),
  );

  let decision: BuyingDecision = "HOLD";

  const strongDeadSignal =
    deadRisk >= 70 ||
    (age >= 150 && sold30 === 0) ||
    status.includes("CRITICAL_DEAD") ||
    status.includes("DEAD_STOCK");

  if (strongDeadSignal && stock > 0) {
    decision = "DONT_BUY";
  } else if (
    suggestedQty > 0 &&
    (score >= 72 || stock === 0 || (coverDays != null && coverDays <= 7))
  ) {
    decision = "BUY_NOW";
  } else if (
    suggestedQty > 0 &&
    (score >= 52 || (coverDays != null && coverDays <= 21))
  ) {
    decision = "REORDER_SOON";
  }

  const evidenceCount = [
    sold7 > 0,
    sold30 > 0,
    sold90 > 0,
    row.stock_cover_days != null,
    row.fast_moving_score != null,
    row.adjusted_dead_stock_risk_score != null,
    purchaseCost > 0,
  ].filter(Boolean).length;

  const confidence: SmartInsight["confidence"] =
    evidenceCount >= 6 ? "HIGH" :
    evidenceCount >= 3 ? "MEDIUM" :
    "LOW";

  const reasons: string[] = [];
  if (stock === 0) reasons.push("out of stock");
  else if (coverDays != null && coverDays <= 7) reasons.push(`${Math.round(coverDays)}d cover`);
  else if (coverDays != null && coverDays <= 21) reasons.push("low stock cover");

  if (trendPercent != null && trendPercent >= 20) reasons.push("sales rising");
  if (sold30 > 0) reasons.push(`${number(sold30)} sold/30d`);
  if (marginPercent != null && marginPercent >= 30) reasons.push("healthy margin");
  if (deadRisk >= 60) reasons.push(`dead-risk ${Math.round(deadRisk)}%`);
  if (age >= 120 && sold30 === 0) reasons.push("old stock, no recent sales");
  if (reasons.length === 0) reasons.push("insufficient urgency");

  return {
    score,
    confidence,
    decision,
    suggestedQty,
    coverDays,
    trendPercent,
    marginPercent,
    reason: reasons.slice(0, 3).join(" • "),
  };
}

function buyingDecision(row: VariantRow): BuyingDecision {
  return smartInsight(row).decision;
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
  const [purchasedList, setPurchasedList] = useState<PurchaseListRow[]>([]);
  const [purchaseSyncing, setPurchaseSyncing] = useState(false);
  const [purchaseSyncMessage, setPurchaseSyncMessage] = useState("");
  const [autoSyncDone, setAutoSyncDone] = useState(false);
  const [purchaseMode, setPurchaseMode] = useState<"LIST" | "BUYING">("BUYING");
  const [purchaseTab, setPurchaseTab] = useState<"ACTIVE" | "PURCHASED">("ACTIVE");
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [showManualPurchase, setShowManualPurchase] = useState(false);
  const [manualBrand, setManualBrand] = useState("NEW CITY STYLE");
  const [manualProduct, setManualProduct] = useState("");
  const [manualSize, setManualSize] = useState("");
  const [manualColour, setManualColour] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [manualStock, setManualStock] = useState("");
  const [selectedLowStockBrand, setSelectedLowStockBrand] = useState("ALL");
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
        purchasedListResult,
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
          supabase
            .from("ncs_purchase_list")
            .select("*")
            .eq("status", "PURCHASED")
            .order("updated_at", { ascending: false })
            .limit(100),
        ]);

      const firstError =
        summaryResult.error ||
        variantsResult.error ||
        sizeResult.error ||
        colourResult.error ||
        brandResult.error ||
        purchaseListResult.error ||
        purchasedListResult.error;

      if (firstError) throw firstError;

      setSummary((summaryResult.data as SummaryRow | null) || null);
      setVariants((variantsResult.data as VariantRow[]) || []);
      setSizes((sizeResult.data as DemandRow[]) || []);
      setColours((colourResult.data as DemandRow[]) || []);
      setBrands((brandResult.data as BrandRow[]) || []);
      setPurchaseList((purchaseListResult.data as PurchaseListRow[]) || []);
      setPurchasedList((purchasedListResult.data as PurchaseListRow[]) || []);
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

  async function addVariantToPurchaseList(
    row: VariantRow,
    quantityOverride?: number,
  ) {
    if (purchaseSyncing) return;

    const requiredQty = Math.max(
      1,
      Math.round(
        Number(
          quantityOverride ??
            row.final_reorder_quantity ??
            1,
        ),
      ),
    );

    const normalizedKey = purchaseListKey(row);
    const existing = purchaseList.find(
      (item) => item.normalized_key === normalizedKey,
    );

    if (existing) {
      setPurchaseSyncMessage(
        `${row.product_name || "Item"} is already in the Purchase List.`,
      );
      return;
    }

    setPurchaseSyncing(true);
    setPurchaseSyncMessage("");

    try {
      const decision = buyingDecision(row);

      const { error } = await supabase
        .from("ncs_purchase_list")
        .insert({
          normalized_key: normalizedKey,
          source_product_id: row.product_id,
          brand:
            String(row.brand || "NEW CITY STYLE").trim() ||
            "NEW CITY STYLE",
          product_name:
            String(row.product_name || "Unnamed Product").trim(),
          size: row.size || null,
          colour: row.color || null,
          required_qty: requiredQty,
          current_stock: Math.max(
            0,
            Math.round(Number(row.current_stock || 0)),
          ),
          note:
            decision === "BUY_NOW" ||
            decision === "REORDER_SOON"
              ? `${decisionLabel(decision)} • Added from Web Stock Intelligence`
              : "Added manually from Web Stock Intelligence",
          source: "STOCK_INTELLIGENCE",
          status: "ACTIVE",
          added_by: "WEB_STOCK_INTELLIGENCE",
        });

      if (error) throw error;

      await refreshPurchaseLists();

      setPurchaseSyncMessage(
        `${row.product_name || "Item"} added to Purchase List • Qty ${requiredQty}`,
      );
    } catch (error) {
      console.error(
        "Purchase-list single add error:",
        error,
      );

      setPurchaseSyncMessage(
        error instanceof Error
          ? error.message
          : "Unable to add item to Purchase List.",
      );
    } finally {
      setPurchaseSyncing(false);
    }
  }

  function purchasePriceFor(item: PurchaseListRow) {
    const byId =
      item.source_product_id == null
        ? undefined
        : variants.find(
            (row) => row.product_id === item.source_product_id,
          );

    const byVariant =
      variants.find(
        (row) =>
          purchaseListKey(row) === item.normalized_key,
      );

    const price =
      Number(
        (byId || byVariant)?.weighted_purchase_cost || 0,
      );

    return price > 0 ? price : null;
  }

  async function refreshPurchaseLists() {
    const [activeResult, purchasedResult] =
      await Promise.all([
        supabase
          .from("ncs_purchase_list")
          .select("*")
          .eq("status", "ACTIVE")
          .order("created_at", { ascending: false }),
        supabase
          .from("ncs_purchase_list")
          .select("*")
          .eq("status", "PURCHASED")
          .order("updated_at", { ascending: false })
          .limit(100),
      ]);

    if (activeResult.error) throw activeResult.error;
    if (purchasedResult.error) throw purchasedResult.error;

    setPurchaseList(
      (activeResult.data as PurchaseListRow[]) || [],
    );
    setPurchasedList(
      (purchasedResult.data as PurchaseListRow[]) || [],
    );
  }

  async function markPurchaseItemPurchased(
    item: PurchaseListRow,
  ) {
    setPurchaseSyncing(true);
    setPurchaseSyncMessage("");

    try {
      const { error } = await supabase
        .from("ncs_purchase_list")
        .update({ status: "PURCHASED" })
        .eq("id", item.id);

      if (error) throw error;

      await refreshPurchaseLists();
      setPurchaseSyncMessage(
        `${item.product_name} marked purchased.`,
      );
    } catch (error) {
      setPurchaseSyncMessage(
        error instanceof Error
          ? error.message
          : "Unable to mark item purchased.",
      );
    } finally {
      setPurchaseSyncing(false);
    }
  }

  async function reactivatePurchaseItem(
    item: PurchaseListRow,
  ) {
    setPurchaseSyncing(true);
    setPurchaseSyncMessage("");

    try {
      const { error } = await supabase
        .from("ncs_purchase_list")
        .update({ status: "ACTIVE" })
        .eq("id", item.id);

      if (error) throw error;

      await refreshPurchaseLists();
      setPurchaseSyncMessage(
        `${item.product_name} moved back to Active.`,
      );
    } catch (error) {
      setPurchaseSyncMessage(
        error instanceof Error
          ? error.message
          : "Unable to reactivate item.",
      );
    } finally {
      setPurchaseSyncing(false);
    }
  }

  async function markGroupPurchased(
    items: PurchaseListRow[],
  ) {
    if (items.length === 0) return;

    setPurchaseSyncing(true);
    setPurchaseSyncMessage("");

    try {
      const ids = items.map((item) => item.id);
      const { error } = await supabase
        .from("ncs_purchase_list")
        .update({ status: "PURCHASED" })
        .in("id", ids);

      if (error) throw error;

      await refreshPurchaseLists();
      setPurchaseSyncMessage(
        `${items.length} item(s) marked purchased.`,
      );
    } catch (error) {
      setPurchaseSyncMessage(
        error instanceof Error
          ? error.message
          : "Unable to mark group purchased.",
      );
    } finally {
      setPurchaseSyncing(false);
    }
  }

  async function sharePurchaseText(
    title: string,
    shareText: string,
  ) {
    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        await navigator.share({
          title,
          text: shareText,
        });
        return;
      }

      await navigator.clipboard.writeText(shareText);
      setPurchaseSyncMessage(
        "Purchase list copied to clipboard.",
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        return;
      }

      setPurchaseSyncMessage(
        "Unable to share. Try again.",
      );
    }
  }

  async function shareActivePurchaseList() {
    const totalUnits = purchaseList.reduce(
      (sum, item) => sum + Number(item.required_qty || 0),
      0,
    );

    const estimatedValue = purchaseList.reduce(
      (sum, item) =>
        sum +
        Number(purchasePriceFor(item) || 0) *
          Number(item.required_qty || 0),
      0,
    );

    const lines = [
      "NEW CITY STYLE",
      "ACTIVE PURCHASE LIST",
      "",
      ...purchaseList.map((item, index) => {
        const lineValue =
          Number(purchasePriceFor(item) || 0) *
          Number(item.required_qty || 0);

        const detail = [
          item.brand,
          item.product_name,
          item.size ? `Size ${item.size}` : "",
          item.colour || "",
        ]
          .filter(Boolean)
          .join(" • ");

        return `${index + 1}. ${detail} × ${item.required_qty}${
          lineValue > 0 ? ` • ${money(lineValue)}` : ""
        }`;
      }),
      "",
      `Total items: ${purchaseList.length}`,
      `Total units: ${totalUnits}`,
      estimatedValue > 0
        ? `Known estimated buy value: ${money(estimatedValue)}`
        : "Known estimated buy value: PRICE N/A",
    ];

    await sharePurchaseText(
      "NEW CITY STYLE Purchase List",
      lines.join("\n"),
    );
  }

  async function sharePurchaseGroup(
    brand: string,
    items: PurchaseListRow[],
  ) {
    const totalUnits = items.reduce(
      (sum, item) => sum + Number(item.required_qty || 0),
      0,
    );

    const estimatedValue = items.reduce(
      (sum, item) =>
        sum +
        Number(purchasePriceFor(item) || 0) *
          Number(item.required_qty || 0),
      0,
    );

    const lines = [
      "NEW CITY STYLE",
      `${brand.toUpperCase()} BUYING LIST`,
      "",
      ...items.map((item, index) => {
        const lineValue =
          Number(purchasePriceFor(item) || 0) *
          Number(item.required_qty || 0);

        const detail = [
          item.product_name,
          item.size ? `Size ${item.size}` : "",
          item.colour || "",
          item.current_stock != null
            ? `Stock ${item.current_stock}`
            : "",
        ]
          .filter(Boolean)
          .join(" • ");

        return `${index + 1}. ${detail} × ${item.required_qty}${
          lineValue > 0 ? ` • ${money(lineValue)}` : ""
        }`;
      }),
      "",
      `Items: ${items.length}`,
      `Units: ${totalUnits}`,
      estimatedValue > 0
        ? `Known estimated value: ${money(estimatedValue)}`
        : "Known estimated value: PRICE N/A",
    ];

    await sharePurchaseText(
      `${brand} Buying List`,
      lines.join("\n"),
    );
  }

  async function addManualPurchaseItem() {
    const product = manualProduct.trim();
    const brand =
      manualBrand.trim() || "NEW CITY STYLE";
    const qty = Math.max(
      1,
      Math.round(Number(manualQty || 1)),
    );

    if (!product) {
      setPurchaseSyncMessage(
        "Enter a product name for the manual item.",
      );
      return;
    }

    const normalizedKey = [
      normalizeKeyPart(brand),
      normalizeKeyPart(product),
      normalizeKeyPart(manualSize),
      normalizeKeyPart(manualColour),
    ].join("|");

    if (
      purchaseList.some(
        (item) => item.normalized_key === normalizedKey,
      )
    ) {
      setPurchaseSyncMessage(
        `${product} is already in the active Purchase List.`,
      );
      return;
    }

    setPurchaseSyncing(true);
    setPurchaseSyncMessage("");

    try {
      const { error } = await supabase
        .from("ncs_purchase_list")
        .insert({
          normalized_key: normalizedKey,
          source_product_id: null,
          brand,
          product_name: product,
          size: manualSize.trim() || null,
          colour: manualColour.trim() || null,
          required_qty: qty,
          current_stock:
            manualStock.trim() === ""
              ? null
              : Math.max(
                  0,
                  Math.round(Number(manualStock || 0)),
                ),
          note: "Manual item from Web Stock Intelligence",
          source: "MANUAL",
          status: "ACTIVE",
          added_by: "WEB_STOCK_INTELLIGENCE",
        });

      if (error) throw error;

      await refreshPurchaseLists();
      setManualProduct("");
      setManualSize("");
      setManualColour("");
      setManualQty("1");
      setManualStock("");
      setShowManualPurchase(false);
      setPurchaseSyncMessage(
        `${product} added manually.`,
      );
    } catch (error) {
      setPurchaseSyncMessage(
        error instanceof Error
          ? error.message
          : "Unable to add manual purchase item.",
      );
    } finally {
      setPurchaseSyncing(false);
    }
  }

  async function syncSmartPurchaseList(showMessage = true) {
    if (purchaseSyncing || variants.length === 0) return;

    const candidates = variants.filter((row) => {
      const decision = buyingDecision(row);
      const insight = smartInsight(row);
      return (
        (decision === "BUY_NOW" || decision === "REORDER_SOON") &&
        insight.suggestedQty > 0
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
        const insight = smartInsight(row);
        const requiredQty = Math.max(1, insight.suggestedQty);
        const current = existingByKey.get(key);
        const decision = insight.decision;

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
            note: `${decisionLabel(decision)} • Smart Score ${insight.score}/100 • ${insight.confidence} confidence`,
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

      await refreshPurchaseLists();

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

  const purchaseBuyingGroups = useMemo(() => {
    return Array.from(
      purchaseList.reduce((map, item) => {
        const brand =
          item.brand.trim() || "NEW CITY STYLE";

        const group = map.get(brand) || [];
        group.push(item);
        map.set(brand, group);
        return map;
      }, new Map<string, PurchaseListRow[]>()),
    )
      .map(([brand, items]) => {
        const units = items.reduce(
          (sum, item) =>
            sum + Number(item.required_qty || 0),
          0,
        );
        const estimatedValue = items.reduce(
          (sum, item) =>
            sum +
            Number(purchasePriceFor(item) || 0) *
              Number(item.required_qty || 0),
          0,
        );
        const pricedUnits = items.reduce(
          (sum, item) =>
            sum +
            (Number(purchasePriceFor(item) || 0) > 0
              ? Number(item.required_qty || 0)
              : 0),
          0,
        );
        const aiCount = items.filter(
          (item) => item.source === "STOCK_INTELLIGENCE",
        ).length;
        const manualCount = items.filter(
          (item) => item.source === "MANUAL",
        ).length;

        return {
          brand,
          items,
          units,
          estimatedValue,
          pricedUnits,
          aiCount,
          manualCount,
        };
      })
      .sort((a, b) => {
        if (
          (a.aiCount > 0) !== (b.aiCount > 0)
        ) {
          return a.aiCount > 0 ? -1 : 1;
        }

        if (a.units !== b.units) {
          return b.units - a.units;
        }

        return a.brand.localeCompare(b.brand);
      });
  }, [purchaseList, variants]);

  const activePurchaseUnits = useMemo(
    () =>
      purchaseList.reduce(
        (sum, item) =>
          sum + Number(item.required_qty || 0),
        0,
      ),
    [purchaseList],
  );

  const activePurchaseEstimate = useMemo(
    () =>
      purchaseList.reduce(
        (sum, item) =>
          sum +
          Number(purchasePriceFor(item) || 0) *
            Number(item.required_qty || 0),
        0,
      ),
    [purchaseList, variants],
  );

  const activePurchasePricedUnits = useMemo(
    () =>
      purchaseList.reduce(
        (sum, item) =>
          sum +
          (Number(purchasePriceFor(item) || 0) > 0
            ? Number(item.required_qty || 0)
            : 0),
        0,
      ),
    [purchaseList, variants],
  );

  const purchaseVisibleRows = useMemo(() => {
    const source =
      purchaseTab === "ACTIVE"
        ? purchaseList
        : purchasedList;

    const q = purchaseSearch.trim().toLowerCase();

    if (!q) return source;

    return source.filter((item) =>
      [
        item.brand,
        item.product_name,
        item.size,
        item.colour,
        item.source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [
    purchaseTab,
    purchaseList,
    purchasedList,
    purchaseSearch,
  ]);

  const lowStockBrandGroups = useMemo(() => {
    const lowRows = variants.filter((row) => Number(row.current_stock || 0) <= 5);
    const grouped = lowRows.reduce((map, row) => {
      const brand = String(row.brand || "NEW CITY STYLE").trim() || "NEW CITY STYLE";
      const items = map.get(brand) || [];
      items.push(row);
      map.set(brand, items);
      return map;
    }, new Map<string, VariantRow[]>());

    return Array.from(grouped.entries())
      .map(([brand, items]) => ({
        brand,
        items: items.sort((a, b) => {
          const stockDiff = Number(a.current_stock || 0) - Number(b.current_stock || 0);
          if (stockDiff !== 0) return stockDiff;
          return Number(b.final_reorder_quantity || 0) - Number(a.final_reorder_quantity || 0);
        }),
        outOfStock: items.filter((row) => Number(row.current_stock || 0) <= 0).length,
        critical: items.filter((row) => Number(row.current_stock || 0) <= 2).length,
        suggestedUnits: items.reduce(
          (sum, row) => sum + Math.max(1, Math.round(Number(row.final_reorder_quantity || Math.max(1, 8 - Number(row.current_stock || 0))))),
          0,
        ),
      }))
      .sort((a, b) => {
        if (a.outOfStock !== b.outOfStock) return b.outOfStock - a.outOfStock;
        if (a.critical !== b.critical) return b.critical - a.critical;
        if (a.items.length !== b.items.length) return b.items.length - a.items.length;
        return a.brand.localeCompare(b.brand);
      });
  }, [variants]);

  const visibleLowStockRows = useMemo(() => {
    if (selectedLowStockBrand === "ALL") {
      return lowStockBrandGroups.flatMap((group) => group.items);
    }
    return lowStockBrandGroups.find((group) => group.brand === selectedLowStockBrand)?.items || [];
  }, [lowStockBrandGroups, selectedLowStockBrand]);

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
            <span className="siSectionTag">FREE ADVANCED SMART ENGINE</span>
            <h2>Score → Explain → Decide → Purchase List</h2>
            <p>
              No paid AI API. Uses sales velocity, stock cover, trend, margin, age and dead-stock risk to score every variant.
            </p>
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
            <span>HIGH PRIORITY</span>
            <strong>{variants.filter((row) => smartInsight(row).score >= 72).length}</strong>
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

      <section className="siBrandLowStock">
        <div className="siBrandLowStockHead">
          <div>
            <span className="siSectionTag">BRAND-WISE LOW STOCK</span>
            <h2>Low Stock → Add → Mobile Sync</h2>
            <p>Stock 5 or below is grouped by brand. Every add writes to the shared Supabase purchase list used by mobile.</p>
          </div>
          <div className="siBrandLowStockActions">
            <button
              type="button"
              className="gold"
              onClick={() => {
                setShowManualPurchase(true);
                setPurchaseMode("LIST");
                window.setTimeout(() =>
                  document.getElementById("purchase-command-centre")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                50);
              }}
            >
              + MANUAL ITEM
            </button>
            <button
              type="button"
              onClick={() => {
                setPurchaseMode("LIST");
                window.setTimeout(() =>
                  document.getElementById("purchase-command-centre")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                50);
              }}
            >
              OPEN PURCHASE LIST ↓
            </button>
          </div>
        </div>

        <div className="siLowBrandCards">
          <button
            type="button"
            className={selectedLowStockBrand === "ALL" ? "active" : ""}
            onClick={() => setSelectedLowStockBrand("ALL")}
          >
            <span>ALL BRANDS</span>
            <strong>{lowStockBrandGroups.reduce((sum, group) => sum + group.items.length, 0)}</strong>
            <small>low-stock variants</small>
          </button>
          {lowStockBrandGroups.map((group) => (
            <button
              type="button"
              key={group.brand}
              className={selectedLowStockBrand === group.brand ? "active" : ""}
              onClick={() => setSelectedLowStockBrand(group.brand)}
            >
              <span>{group.brand.toUpperCase()}</span>
              <strong>{group.items.length}</strong>
              <small>{group.outOfStock} out • {group.critical} critical • {group.suggestedUnits} suggested</small>
            </button>
          ))}
        </div>

        <div className="siLowStockRows">
          {visibleLowStockRows.length === 0 ? (
            <div className="siEmptyPurchase">No low-stock items for this brand.</div>
          ) : (
            visibleLowStockRows.map((row) => {
              const key = purchaseListKey(row);
              const alreadyAdded = activePurchaseKeys.has(key);
              const suggestedQty = Math.max(
                1,
                Math.round(Number(row.final_reorder_quantity || Math.max(1, 8 - Number(row.current_stock || 0)))),
              );
              return (
                <div className="siLowStockRow" key={`low-${row.variant_id}`}>
                  <div className="siLowStockMain">
                    <strong>{row.product_name || "Unnamed Product"}</strong>
                    <span>
                      {[
                        row.brand || "NEW CITY STYLE",
                        row.size ? `Size ${row.size}` : "",
                        row.color || "",
                        row.barcode || "",
                      ].filter(Boolean).join(" • ")}
                    </span>
                  </div>
                  <div className={`siLowStockBadge ${Number(row.current_stock || 0) <= 0 ? "out" : Number(row.current_stock || 0) <= 2 ? "critical" : "low"}`}>
                    Stock {number(row.current_stock)}
                  </div>
                  <div className="siLowStockSuggest">
                    <span>SUGGEST</span>
                    <strong>+{suggestedQty}</strong>
                  </div>
                  <button
                    type="button"
                    className={alreadyAdded ? "added" : "gold"}
                    disabled={alreadyAdded || purchaseSyncing}
                    onClick={() => void addVariantToPurchaseList(row, suggestedQty)}
                  >
                    {alreadyAdded ? "ADDED ✓" : "+ ADD TO PURCHASE LIST"}
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="siMobileSyncNote">☁ SHARED CLOUD LIST → Android mobile reads the same ncs_purchase_list data.</div>
      </section>

      <section className="siPurchaseWorkbench" id="purchase-command-centre">
        <div className="siPurchaseWorkbenchHead">
          <div>
            <span className="siSectionTag">SHARED PURCHASE LIST</span>
            <h2>Purchase Command Centre</h2>
            <p>
              LIST mode + brand-wise BUYING MODE with known purchase-cost estimates.
            </p>
          </div>

          <div className="siPurchaseWorkbenchTools">
            <button
              type="button"
              onClick={() => void refreshPurchaseLists()}
              disabled={purchaseSyncing}
            >
              ↻ REFRESH
            </button>
            <button
              type="button"
              className="gold"
              onClick={() =>
                setShowManualPurchase((value) => !value)
              }
            >
              + MANUAL ITEM
            </button>
            <button
              type="button"
              onClick={() => void shareActivePurchaseList()}
              disabled={purchaseList.length === 0}
            >
              SHARE ACTIVE
            </button>
          </div>
        </div>

        <div className="siPurchaseModeSwitch">
          <button
            type="button"
            className={purchaseMode === "LIST" ? "active" : ""}
            onClick={() => setPurchaseMode("LIST")}
          >
            LIST
          </button>
          <button
            type="button"
            className={purchaseMode === "BUYING" ? "active" : ""}
            onClick={() => {
              setPurchaseMode("BUYING");
              setPurchaseTab("ACTIVE");
            }}
          >
            BUYING MODE
          </button>
        </div>

        {showManualPurchase && (
          <div className="siManualPurchaseBox">
            <div className="siManualGrid">
              <input
                value={manualBrand}
                onChange={(event) =>
                  setManualBrand(event.target.value)
                }
                placeholder="Brand"
              />
              <input
                value={manualProduct}
                onChange={(event) =>
                  setManualProduct(event.target.value)
                }
                placeholder="Product *"
              />
              <input
                value={manualSize}
                onChange={(event) =>
                  setManualSize(event.target.value)
                }
                placeholder="Size"
              />
              <input
                value={manualColour}
                onChange={(event) =>
                  setManualColour(event.target.value)
                }
                placeholder="Colour"
              />
              <input
                value={manualQty}
                onChange={(event) =>
                  setManualQty(event.target.value)
                }
                inputMode="numeric"
                placeholder="Qty"
              />
              <input
                value={manualStock}
                onChange={(event) =>
                  setManualStock(event.target.value)
                }
                inputMode="numeric"
                placeholder="Current stock"
              />
            </div>
            <div className="siManualActions">
              <button
                type="button"
                onClick={() => setShowManualPurchase(false)}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="gold"
                onClick={() => void addManualPurchaseItem()}
                disabled={purchaseSyncing}
              >
                ADD TO PURCHASE LIST
              </button>
            </div>
          </div>
        )}

        {purchaseMode === "LIST" ? (
          <>
            <div className="siPurchaseListControls">
              <div className="siPurchaseTabs">
                <button
                  type="button"
                  className={purchaseTab === "ACTIVE" ? "active" : ""}
                  onClick={() => setPurchaseTab("ACTIVE")}
                >
                  ACTIVE {purchaseList.length}
                </button>
                <button
                  type="button"
                  className={purchaseTab === "PURCHASED" ? "active" : ""}
                  onClick={() => setPurchaseTab("PURCHASED")}
                >
                  PURCHASED {purchasedList.length}
                </button>
              </div>

              <input
                value={purchaseSearch}
                onChange={(event) =>
                  setPurchaseSearch(event.target.value)
                }
                placeholder="Search purchase item, brand, size..."
              />
            </div>

            <div className="siPurchaseListRows">
              {purchaseVisibleRows.length === 0 ? (
                <div className="siEmptyPurchase">
                  No purchase items found.
                </div>
              ) : (
                purchaseVisibleRows.map((item) => {
                  const unitPrice = purchasePriceFor(item);
                  const lineValue =
                    Number(unitPrice || 0) *
                    Number(item.required_qty || 0);

                  return (
                    <div className="siPurchaseListRow" key={item.id}>
                      <div className="siPurchaseListMain">
                        <strong>{item.product_name}</strong>
                        <span>
                          {[
                            item.brand,
                            item.size ? `Size ${item.size}` : "",
                            item.colour || "",
                            item.current_stock != null
                              ? `Stock ${item.current_stock}`
                              : "",
                            item.source === "STOCK_INTELLIGENCE"
                              ? "AI"
                              : "MANUAL",
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </span>
                      </div>

                      <div className="siPurchaseListQty">
                        × {item.required_qty}
                      </div>

                      <div className="siPurchaseListValue">
                        {lineValue > 0
                          ? money(lineValue)
                          : "PRICE N/A"}
                      </div>

                      {purchaseTab === "ACTIVE" ? (
                        <button
                          type="button"
                          className="purchased"
                          onClick={() =>
                            void markPurchaseItemPurchased(item)
                          }
                          disabled={purchaseSyncing}
                        >
                          PURCHASED ✓
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            void reactivatePurchaseItem(item)
                          }
                          disabled={purchaseSyncing}
                        >
                          REOPEN
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            <div className="siBuyingSummary">
              <div>
                <span>ACTIVE ITEMS</span>
                <strong>{purchaseList.length}</strong>
              </div>
              <div>
                <span>TOTAL UNITS</span>
                <strong>{activePurchaseUnits}</strong>
              </div>
              <div>
                <span>KNOWN EST. BUY VALUE</span>
                <strong>
                  {activePurchaseEstimate > 0
                    ? money(activePurchaseEstimate)
                    : "PRICE N/A"}
                </strong>
              </div>
              <div>
                <span>PRICED UNITS</span>
                <strong>
                  {activePurchasePricedUnits} / {activePurchaseUnits}
                </strong>
              </div>
              <div>
                <span>AI PICKS</span>
                <strong>
                  {
                    purchaseList.filter(
                      (item) =>
                        item.source === "STOCK_INTELLIGENCE",
                    ).length
                  }
                </strong>
              </div>
            </div>

            <div className="siBuyingNote">
              Supplier field is not stored in the current shared purchase-list schema,
              so this mirrors the mobile app and groups by Brand as the buying/supplier bucket.
            </div>

            <div className="siBuyingGroups">
              {purchaseBuyingGroups.length === 0 ? (
                <div className="siEmptyPurchase">
                  No active items in the Purchase List.
                </div>
              ) : (
                purchaseBuyingGroups.map((group, index) => (
                  <div className="siBuyingGroupCard" key={group.brand}>
                    <div className="siBuyingGroupHead">
                      <div className="siBuyingRank">
                        {index + 1}
                      </div>

                      <div className="siBuyingGroupTitle">
                        <strong>{group.brand.toUpperCase()}</strong>
                        <span>
                          {group.items.length} item(s) • {group.units} unit(s)
                        </span>
                      </div>

                      <div className="siBuyingGroupValue">
                        <strong>
                          {group.estimatedValue > 0
                            ? money(group.estimatedValue)
                            : "PRICE N/A"}
                        </strong>
                        {group.aiCount > 0 && (
                          <span>{group.aiCount} AI PRIORITY</span>
                        )}
                      </div>
                    </div>

                    {(group.aiCount > 0 ||
                      group.manualCount > 0) && (
                      <div className="siBuyingSourceChips">
                        {group.aiCount > 0 && (
                          <span className="ai">
                            AI {group.aiCount}
                          </span>
                        )}
                        {group.manualCount > 0 && (
                          <span>
                            MANUAL {group.manualCount}
                          </span>
                        )}
                        <span>
                          PRICED {group.pricedUnits}/{group.units}
                        </span>
                      </div>
                    )}

                    <div className="siBuyingItems">
                      {group.items.map((item) => {
                        const unitPrice = purchasePriceFor(item);
                        const lineValue =
                          Number(unitPrice || 0) *
                          Number(item.required_qty || 0);

                        return (
                          <div className="siBuyingItem" key={item.id}>
                            <div>
                              <strong>{item.product_name}</strong>
                              <span>
                                {[
                                  item.size
                                    ? `Size ${item.size}`
                                    : "",
                                  item.colour || "",
                                  item.current_stock != null
                                    ? `Stock ${item.current_stock}`
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" • ") || "Purchase item"}
                              </span>
                            </div>

                            <b>× {item.required_qty}</b>

                            <em>
                              {lineValue > 0
                                ? money(lineValue)
                                : "PRICE N/A"}
                            </em>
                          </div>
                        );
                      })}
                    </div>

                    <div className="siBuyingGroupActions">
                      <button
                        type="button"
                        onClick={() =>
                          void sharePurchaseGroup(
                            group.brand,
                            group.items,
                          )
                        }
                      >
                        SHARE GROUP
                      </button>
                      <button
                        type="button"
                        className="purchased"
                        onClick={() =>
                          void markGroupPurchased(group.items)
                        }
                        disabled={purchaseSyncing}
                      >
                        ALL PURCHASED ✓
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {purchaseSyncMessage && (
          <div className="siPurchaseWorkbenchMessage">
            {purchaseSyncMessage}
          </div>
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

                    {(() => {
                      const insight = smartInsight(row);
                      return (
                        <div className="siSmartInsight">
                          <div className="siSmartScoreLine">
                            <span className={`siDecisionMini siDecisionMini-${insight.decision.toLowerCase()}`}>
                              {decisionLabel(insight.decision)}
                            </span>
                            <strong className="siSmartScore">{insight.score}/100</strong>
                            <span className={`siConfidence siConfidence-${insight.confidence.toLowerCase()}`}>
                              {insight.confidence}
                            </span>
                          </div>
                          <small>{insight.reason}</small>
                          <small>
                            Smart qty: <strong>{number(insight.suggestedQty)}</strong>
                            {insight.trendPercent == null
                              ? ""
                              : ` • Trend ${insight.trendPercent >= 0 ? "+" : ""}${Math.round(insight.trendPercent)}%`}
                          </small>
                        </div>
                      );
                    })()}

                    <div className="siPurchaseRowActions">
                      {activePurchaseKeys.has(purchaseListKey(row)) ? (
                        <span className="siListOn">
                          ✓ IN PURCHASE LIST
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="siAddToList"
                          onClick={() =>
                            void addVariantToPurchaseList(
                              row,
                              smartInsight(row).suggestedQty > 0
                                ? smartInsight(row).suggestedQty
                                : 1,
                            )
                          }
                          disabled={purchaseSyncing}
                        >
                          + ADD TO PURCHASE LIST
                        </button>
                      )}

                      {(buyingDecision(row) === "BUY_NOW" ||
                        buyingDecision(row) === "REORDER_SOON") &&
                        smartInsight(row).suggestedQty > 0 && (
                          <a
                            className="siReorderAction"
                            href={`/admin/purchases?source=stock-intelligence&productId=${row.product_id}&variantId=${row.variant_id}&quantity=${Math.max(
                              1,
                              smartInsight(row).suggestedQty || 1,
                            )}`}
                          >
                            <span>📥</span>
                            OPEN PURCHASE
                          </a>
                        )}
                    </div>
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
        .siSmartInsight{display:grid;gap:4px;margin-top:7px;max-width:260px}.siSmartScoreLine{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.siSmartScore{font-size:10px;color:#082b68}.siConfidence{padding:3px 6px;border-radius:999px;font-size:7px;font-weight:950;letter-spacing:.4px}.siConfidence-high{background:#ddf7e8;color:#12643b}.siConfidence-medium{background:#fff1c9;color:#805a00}.siConfidence-low{background:#eef1f5;color:#647084}.siSmartInsight small{font-size:8px!important;line-height:1.4;color:#5f6d85!important}
        .siPurchaseRowActions{display:grid;gap:5px;margin-top:6px}.siListOn,.siListPending{font-size:7px!important;font-weight:900!important}.siListOn{color:#16834a!important}.siListPending{color:#a36a00!important}.siAddToList{display:inline-flex;align-items:center;justify-content:center;width:max-content;min-height:31px;padding:6px 10px;border:1px solid rgba(212,175,55,.8);border-radius:9px;background:linear-gradient(135deg,#d4af37,#f4dc7b);color:#061d4a;font-size:8px;font-weight:950;cursor:pointer;box-shadow:0 7px 16px rgba(3,21,63,.12);transition:transform .18s ease,box-shadow .18s ease}.siAddToList:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 11px 22px rgba(3,21,63,.18)}.siAddToList:disabled{opacity:.55;cursor:wait}
        .siBrandLowStock{margin-top:18px;padding:18px;border:1px solid rgba(10,46,115,.14);border-radius:23px;background:linear-gradient(180deg,#fff 0%,#f8fbff 100%);box-shadow:0 16px 38px rgba(3,21,63,.10)}
        .siBrandLowStockHead{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.siBrandLowStockHead h2{margin:4px 0 2px;color:#061d4a;font-size:19px}.siBrandLowStockHead p{margin:0;color:#667085;font-size:9px}.siBrandLowStockActions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.siBrandLowStockActions button{min-height:35px;padding:0 11px;border:1px solid rgba(10,46,115,.18);border-radius:10px;background:#fff;color:#0a2e73;font-size:8px;font-weight:950;cursor:pointer}.siBrandLowStockActions button.gold{border-color:#d4af37;background:linear-gradient(135deg,#d4af37,#f4dc7b);color:#061d4a}
        .siLowBrandCards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px}.siLowBrandCards button{padding:11px;text-align:left;border:1px solid rgba(10,46,115,.13);border-radius:13px;background:#fff;color:#0a2e73;cursor:pointer;transition:.18s}.siLowBrandCards button:hover,.siLowBrandCards button.active{transform:translateY(-1px);border-color:#d4af37;box-shadow:0 8px 18px rgba(3,21,63,.08)}.siLowBrandCards span,.siLowBrandCards strong,.siLowBrandCards small{display:block}.siLowBrandCards span{font-size:7px;font-weight:950}.siLowBrandCards strong{margin-top:3px;font-size:18px}.siLowBrandCards small{margin-top:2px;color:#667085;font-size:7px;line-height:1.35}
        .siLowStockRows{display:grid;gap:8px;margin-top:12px}.siLowStockRow{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:10px;padding:11px;border:1px solid rgba(10,46,115,.10);border-radius:13px;background:#fff}.siLowStockMain strong,.siLowStockMain span{display:block}.siLowStockMain strong{color:#061d4a;font-size:10px}.siLowStockMain span{margin-top:3px;color:#667085;font-size:7px}.siLowStockBadge{min-width:72px;padding:6px 8px;border-radius:999px;text-align:center;font-size:7px;font-weight:950}.siLowStockBadge.out{background:#fde4e2;color:#b3261e}.siLowStockBadge.critical{background:#fff0cf;color:#8b6200}.siLowStockBadge.low{background:#eef3fb;color:#0a2e73}.siLowStockSuggest{text-align:center}.siLowStockSuggest span,.siLowStockSuggest strong{display:block}.siLowStockSuggest span{color:#667085;font-size:6px;font-weight:950}.siLowStockSuggest strong{color:#0a2e73;font-size:11px}.siLowStockRow button{min-height:33px;padding:0 10px;border:1px solid rgba(10,46,115,.18);border-radius:9px;background:#fff;color:#0a2e73;font-size:7px;font-weight:950;cursor:pointer}.siLowStockRow button.gold{border-color:#d4af37;background:linear-gradient(135deg,#d4af37,#f4dc7b);color:#061d4a}.siLowStockRow button.added{border-color:#16834a;background:#e5f7ec;color:#12643b}.siLowStockRow button:disabled{cursor:default;opacity:.8}.siMobileSyncNote{margin-top:10px;padding:9px 11px;border-radius:10px;background:#eaf7ef;color:#12643b;font-size:8px;font-weight:850}
        .siPurchaseWorkbench{margin-top:18px;padding:18px;border:1px solid rgba(10,46,115,.14);border-radius:23px;background:#fff;box-shadow:0 16px 38px rgba(3,21,63,.10)}
        .siPurchaseWorkbenchHead{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.siPurchaseWorkbenchHead h2{margin:4px 0 2px;color:#061d4a;font-size:19px}.siPurchaseWorkbenchHead p{margin:0;color:#667085;font-size:9px}.siPurchaseWorkbenchTools{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.siPurchaseWorkbenchTools button,.siManualActions button{min-height:35px;padding:0 11px;border:1px solid rgba(10,46,115,.18);border-radius:10px;background:#fff;color:#0a2e73;font-size:8px;font-weight:950;cursor:pointer}.siPurchaseWorkbenchTools button.gold,.siManualActions button.gold{border-color:#d4af37;background:linear-gradient(135deg,#d4af37,#f4dc7b);color:#061d4a}
        .siPurchaseModeSwitch{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.siPurchaseModeSwitch button{min-height:38px;border:1px solid rgba(10,46,115,.18);border-radius:11px;background:#f7f9fc;color:#0a2e73;font-size:9px;font-weight:950;cursor:pointer}.siPurchaseModeSwitch button.active{border-color:#d4af37;background:#0a2e73;color:#fff;box-shadow:inset 0 -3px 0 #d4af37}
        .siManualPurchaseBox{margin-top:12px;padding:13px;border:1px solid #e8d28a;border-radius:14px;background:#fffaf0}.siManualGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.siManualGrid input,.siPurchaseListControls input{min-height:37px;padding:0 10px;border:1px solid #d9deea;border-radius:10px;background:#fff;color:#1d2939;font-size:9px;outline:none}.siManualGrid input:focus,.siPurchaseListControls input:focus{border-color:#d4af37;box-shadow:0 0 0 3px rgba(212,175,55,.12)}.siManualActions{display:flex;justify-content:flex-end;gap:8px;margin-top:9px}
        .siPurchaseListControls{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:13px}.siPurchaseTabs{display:flex;gap:7px}.siPurchaseTabs button{min-height:33px;padding:0 11px;border:1px solid rgba(10,46,115,.17);border-radius:999px;background:#fff;color:#0a2e73;font-size:8px;font-weight:950;cursor:pointer}.siPurchaseTabs button.active{background:#0a2e73;color:#fff;border-color:#0a2e73}.siPurchaseListControls input{width:min(360px,100%)}
        .siPurchaseListRows{display:grid;gap:8px;margin-top:11px}.siPurchaseListRow{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:10px;padding:11px;border:1px solid rgba(10,46,115,.10);border-radius:13px;background:#fbfcff}.siPurchaseListMain strong,.siPurchaseListMain span{display:block}.siPurchaseListMain strong{color:#061d4a;font-size:10px}.siPurchaseListMain span{margin-top:2px;color:#667085;font-size:7px}.siPurchaseListQty{color:#0a2e73;font-size:9px;font-weight:950}.siPurchaseListValue{min-width:74px;text-align:right;color:#16834a;font-size:9px;font-weight:950}.siPurchaseListRow button,.siBuyingGroupActions button{min-height:31px;padding:0 9px;border:1px solid rgba(10,46,115,.18);border-radius:9px;background:#fff;color:#0a2e73;font-size:7px;font-weight:950;cursor:pointer}.siPurchaseListRow button.purchased,.siBuyingGroupActions button.purchased{border-color:#16834a;background:#16834a;color:#fff}
        .siBuyingSummary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:13px}.siBuyingSummary>div{padding:11px;border-radius:12px;background:#061d4a;color:#fff}.siBuyingSummary span,.siBuyingSummary strong{display:block}.siBuyingSummary span{color:rgba(255,255,255,.58);font-size:7px;font-weight:900}.siBuyingSummary strong{margin-top:3px;color:#f2d675;font-size:12px}.siBuyingNote{margin-top:9px;padding:9px 11px;border-radius:10px;background:#fff8e4;color:#775b08;font-size:8px;line-height:1.45}
        .siBuyingGroups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:12px}.siBuyingGroupCard{padding:13px;border:1px solid rgba(10,46,115,.12);border-radius:16px;background:#fff;box-shadow:0 8px 20px rgba(3,21,63,.07)}.siBuyingGroupHead{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px}.siBuyingRank{width:31px;height:31px;display:grid;place-items:center;border-radius:999px;background:#d4af37;color:#061d4a;font-size:9px;font-weight:950}.siBuyingGroupTitle strong,.siBuyingGroupTitle span,.siBuyingGroupValue strong,.siBuyingGroupValue span{display:block}.siBuyingGroupTitle strong{color:#061d4a;font-size:10px}.siBuyingGroupTitle span{margin-top:2px;color:#667085;font-size:7px}.siBuyingGroupValue{text-align:right}.siBuyingGroupValue strong{color:#0a2e73;font-size:9px}.siBuyingGroupValue span{margin-top:2px;color:#b3261e;font-size:6px;font-weight:950}.siBuyingSourceChips{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.siBuyingSourceChips span{padding:4px 7px;border-radius:999px;background:#eef3fb;color:#0a2e73;font-size:6px;font-weight:950}.siBuyingSourceChips span.ai{background:#fde7e5;color:#b3261e}.siBuyingItems{display:grid;gap:6px;margin-top:9px}.siBuyingItem{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:7px 0;border-top:1px dashed rgba(10,46,115,.10)}.siBuyingItem strong,.siBuyingItem span{display:block}.siBuyingItem strong{color:#061d4a;font-size:8px}.siBuyingItem span{margin-top:2px;color:#667085;font-size:6px}.siBuyingItem b{color:#0a2e73;font-size:8px}.siBuyingItem em{min-width:68px;text-align:right;color:#16834a;font-size:7px;font-weight:950;font-style:normal}.siBuyingGroupActions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.siEmptyPurchase{padding:18px;border:1px dashed #d0d5dd;border-radius:13px;text-align:center;color:#667085;font-size:9px}.siPurchaseWorkbenchMessage{margin-top:10px;padding:9px 11px;border-radius:10px;background:#eff6ff;color:#0a2e73;font-size:8px;font-weight:800}
        @media(max-width:1350px){.siLowBrandCards{grid-template-columns:repeat(3,minmax(0,1fr))}.siMetricGrid{grid-template-columns:repeat(3,minmax(0,1fr))}.siMoneyGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:900px){.siBrandLowStockHead{flex-direction:column}.siBrandLowStockActions{width:100%;display:grid;grid-template-columns:1fr 1fr}.siLowBrandCards{grid-template-columns:repeat(2,minmax(0,1fr))}.siLowStockRow{grid-template-columns:minmax(0,1fr) auto}.siLowStockRow>button{grid-column:1/-1}.siPagination{align-items:stretch;flex-direction:column}.siPaginationControls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.siPaginationControls span{grid-column:1/-1;text-align:center;order:-1}.siPaginationControls button{width:100%}.siPage{padding:104px 12px 20px}.siHero{grid-template-columns:1fr;align-items:flex-start;padding:22px}.siHeroCrown{display:none}.siHeroOrbitOne{right:8%}.siRoyalStrip{border-radius:14px}.siHero h1{font-size:27px}.siRefresh{width:100%}.siMetricGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.siMoneyGrid,.siInsightGrid{grid-template-columns:1fr}.siFilters{grid-template-columns:1fr}.siPanel{padding:14px;border-radius:17px}.siSmartHead{align-items:stretch;flex-direction:column}.siSmartActions{display:grid;grid-template-columns:1fr 1fr}.siDecisionGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.siPurchasePulse{grid-template-columns:1fr}.siPurchaseWorkbenchHead{flex-direction:column}.siPurchaseWorkbenchTools{width:100%;display:grid;grid-template-columns:repeat(3,1fr)}.siManualGrid{grid-template-columns:1fr 1fr}.siPurchaseListControls{align-items:stretch;flex-direction:column}.siPurchaseListControls input{width:100%}.siBuyingSummary{grid-template-columns:1fr 1fr}.siBuyingGroups{grid-template-columns:1fr}.siPurchaseListRow{grid-template-columns:minmax(0,1fr) auto}.siPurchaseListValue{text-align:left}.siPurchaseListRow button{grid-column:1/-1}.siBuyingGroupActions{grid-template-columns:1fr 1fr}}
        @media(max-width:520px){.siBrandLowStockActions{grid-template-columns:1fr}.siLowBrandCards{grid-template-columns:1fr}.siLowStockRow{grid-template-columns:1fr}.siLowStockBadge,.siLowStockSuggest{text-align:left;width:max-content}.siMetricGrid{grid-template-columns:1fr}.siPurchaseWorkbenchTools{grid-template-columns:1fr}.siManualGrid{grid-template-columns:1fr}.siBuyingSummary{grid-template-columns:1fr 1fr}.siBuyingGroupHead{grid-template-columns:auto minmax(0,1fr)}.siBuyingGroupValue{grid-column:2;text-align:left}.siBuyingItem{grid-template-columns:minmax(0,1fr) auto}.siBuyingItem em{grid-column:1/-1;text-align:left}.siBuyingGroupActions{grid-template-columns:1fr}.siMetric{min-height:82px}.siMoneyGrid strong{font-size:20px}.siHero h1{font-size:24px}}
      `}</style>
    </main>
  );
}