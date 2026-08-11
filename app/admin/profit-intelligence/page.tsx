"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type VariantRow = {
  variant_id: number;
  product_id: number;
  product_name: string | null;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  size: string | null;
  color: string | null;
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
  adjusted_dead_stock_risk_score: number | null;
  final_stock_status: string | null;
};

type VariantIdentityRow = {
  id: number;
  product_id: number;
  variant_name?: string | null;
  sku?: string | null;
  purchase_price?: number | string | null;
  selling_price?: number | string | null;
};

type ProductIdentityRow = {
  id: number;
  sku?: string | null;
};

type BrandRow = {
  brand: string | null;
  current_stock: number | null;
  sold_30d: number | null;
  sold_90d: number | null;
  revenue_30d: number | null;
  gross_profit_30d: number | null;
  money_blocked: number | null;
};

type GroupRow = {
  name: string;
  revenue: number;
  profit: number;
  sold: number;
  stock: number;
  blocked: number;
  investment: number;
  margin: number;
};

const ROYAL_BLUE = "#0A2E73";
const DEEP_BLUE = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";
const PRODUCTS_PER_PAGE = 15;

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function num(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(value);
}

function percent(value: number) {
  return `${num(value)}%`;
}

function marginFrom(revenue: number, profit: number) {
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}

function actualSoldPrice(row: VariantRow) {
  const sold = n(row.sold_30d);
  return sold > 0 ? n(row.revenue_30d) / sold : 0;
}

function actualCostTotal(row: VariantRow) {
  return n(row.weighted_purchase_cost) * n(row.sold_30d);
}

function actualProfit(row: VariantRow) {
  return n(row.revenue_30d) - actualCostTotal(row);
}

function variantMargin(row: VariantRow) {
  const revenue = n(row.revenue_30d);
  return revenue > 0 ? (actualProfit(row) / revenue) * 100 : 0;
}


function groupVariants(
  rows: VariantRow[],
  selector: (row: VariantRow) => string,
): GroupRow[] {
  const map = new Map<string, GroupRow>();

  rows.forEach((row) => {
    const name = selector(row).trim() || "Unassigned";
    const current = map.get(name) || {
      name,
      revenue: 0,
      profit: 0,
      sold: 0,
      stock: 0,
      blocked: 0,
      investment: 0,
      margin: 0,
    };

    current.revenue += n(row.revenue_30d);
    current.profit += actualProfit(row);
    current.sold += n(row.sold_30d);
    current.stock += n(row.current_stock);
    current.blocked += n(row.money_blocked);
    current.investment += n(row.current_stock) * n(row.weighted_purchase_cost);

    map.set(name, current);
  });

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      margin: marginFrom(row.revenue, row.profit),
    }))
    .sort((a, b) => b.profit - a.profit);
}

export default function ProfitIntelligencePage() {
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [variantIdentities, setVariantIdentities] = useState<VariantIdentityRow[]>([]);
  const [productIdentities, setProductIdentities] = useState<ProductIdentityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [profitFilter, setProfitFilter] = useState<
    "ALL" | "HIGH_MARGIN" | "LOW_MARGIN" | "LOSS" | "BLOCKED"
  >("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setErrorText("");

    try {
      const [
        variantResult,
        brandResult,
        variantIdentityResult,
        productIdentityResult,
      ] = await Promise.all([
        supabase
          .from("ncs_variant_intelligence_v2")
          .select("*")
          .order("revenue_30d", { ascending: false })
          .limit(1000),

        supabase
          .from("ncs_brand_performance")
          .select("*")
          .order("revenue_30d", { ascending: false })
          .limit(100),

        supabase
          .from("product_variants")
          .select("id,product_id,variant_name,sku,purchase_price,selling_price")
          .limit(5000),

        supabase
          .from("products")
          .select("id,sku")
          .limit(5000),
      ]);

      if (variantResult.error) throw variantResult.error;
      if (variantIdentityResult.error) throw variantIdentityResult.error;
      if (productIdentityResult.error) throw productIdentityResult.error;

      setVariants((variantResult.data || []) as VariantRow[]);
      setBrands(
        brandResult.error ? [] : ((brandResult.data || []) as BrandRow[]),
      );
      setVariantIdentities(
        (variantIdentityResult.data || []) as VariantIdentityRow[],
      );
      setProductIdentities(
        (productIdentityResult.data || []) as ProductIdentityRow[],
      );
    } catch (error) {
      console.error("Profit intelligence load error:", error);
      setErrorText(
        error instanceof Error
          ? error.message
          : "Unable to load Profit Intelligence data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const quickVariantIds = useMemo(() => {
    return new Set(
      variantIdentities
        .filter((row) => {
          const variantName = String(row.variant_name || "").trim().toLowerCase();
          const sku = String(row.sku || "").trim().toUpperCase();
          return variantName === "quick item" || sku.startsWith("QUICK-");
        })
        .map((row) => Number(row.id)),
    );
  }, [variantIdentities]);

  const quickProductIds = useMemo(() => {
    const ids = new Set<number>();

    variantIdentities.forEach((row) => {
      const variantName = String(row.variant_name || "").trim().toLowerCase();
      const sku = String(row.sku || "").trim().toUpperCase();
      if (variantName === "quick item" || sku.startsWith("QUICK-")) {
        ids.add(Number(row.product_id));
      }
    });

    productIdentities.forEach((row) => {
      const sku = String(row.sku || "").trim().toUpperCase();
      if (sku.startsWith("QUICK-")) ids.add(Number(row.id));
    });

    return ids;
  }, [productIdentities, variantIdentities]);

  const profitVariants = useMemo(
    () =>
      variants.filter(
        (row) =>
          !quickVariantIds.has(Number(row.variant_id)) &&
          !quickProductIds.has(Number(row.product_id)) &&
          n(row.weighted_purchase_cost) > 0,
      ),
    [quickProductIds, quickVariantIds, variants],
  );

  const totals = useMemo(() => {
    return profitVariants.reduce(
      (summary, row) => {
        summary.revenue += n(row.revenue_30d);
        summary.profit += n(row.gross_profit_30d);
        summary.units += n(row.sold_30d);
        summary.stock += n(row.current_stock);
        summary.blocked += n(row.money_blocked);
        summary.investment +=
          n(row.current_stock) * n(row.weighted_purchase_cost);
        return summary;
      },
      {
        revenue: 0,
        profit: 0,
        units: 0,
        stock: 0,
        blocked: 0,
        investment: 0,
      },
    );
  }, [profitVariants]);

  const overallMargin = marginFrom(totals.revenue, totals.profit);

  const categoryRows = useMemo(
    () =>
      groupVariants(
        profitVariants,
        (row) => row.category || "Unassigned Category",
      ),
    [profitVariants],
  );

  const brandRows = useMemo<GroupRow[]>(
    () =>
      groupVariants(
        profitVariants,
        (row) => row.brand || "Unassigned Brand",
      ),
    [profitVariants],
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          profitVariants
            .map((row) => row.category?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [profitVariants],
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return [...profitVariants]
      .filter((row) => {
        if (
          categoryFilter !== "ALL" &&
          (row.category || "Unassigned") !== categoryFilter
        ) {
          return false;
        }

        if (q) {
          const haystack = [
            row.product_name,
            row.brand,
            row.category,
            row.subcategory,
            row.size,
            row.color,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          if (!haystack.includes(q)) return false;
        }

        const margin = variantMargin(row);
        const profit = actualProfit(row);
        const blocked = n(row.money_blocked);

        if (profitFilter === "HIGH_MARGIN") return margin >= 40;
        if (profitFilter === "LOW_MARGIN")
          return margin > 0 && margin < 20;
        if (profitFilter === "LOSS") return profit < 0;
        if (profitFilter === "BLOCKED") return blocked > 0;

        return true;
      })
      .sort((a, b) => actualProfit(b) - actualProfit(a));
  }, [categoryFilter, profitFilter, search, profitVariants]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE),
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    const start = (safeCurrentPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(start, start + PRODUCTS_PER_PAGE);
  }, [filteredProducts, safeCurrentPage]);

  const visiblePageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, safeCurrentPage - 2);
    const end = Math.min(totalPages, safeCurrentPage + 2);

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }, [safeCurrentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, profitFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const topProducts = useMemo(
    () =>
      [...profitVariants]
        .filter((row) => actualProfit(row) > 0)
        .sort(
          (a, b) =>
            actualProfit(b) - actualProfit(a),
        )
        .slice(0, 5),
    [profitVariants],
  );

  const lowMarginProducts = useMemo(
    () =>
      [...profitVariants]
        .filter(
          (row) =>
            n(row.revenue_30d) > 0 &&
            variantMargin(row) < 20,
        )
        .sort(
          (a, b) => variantMargin(a) - variantMargin(b),
        )
        .slice(0, 8),
    [profitVariants],
  );

  const blockedProducts = useMemo(
    () =>
      [...profitVariants]
        .filter((row) => n(row.money_blocked) > 0)
        .sort((a, b) => n(b.money_blocked) - n(a.money_blocked))
        .slice(0, 8),
    [profitVariants],
  );

  if (loading) {
    return (
      <main className="piLoading">
        <div className="piLogo">₹</div>
        <div className="piSpinner" />
        <h2>Opening Profit Intelligence...</h2>
        <p>Analysing product cost, revenue, margin and blocked stock.</p>

        <style jsx>{`
          .piLoading {
            min-height: 70vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: Poppins, Inter, Arial, sans-serif;
            color: ${ROYAL_BLUE};
            text-align: center;
          }
          .piLogo {
            width: 78px;
            height: 78px;
            display: grid;
            place-items: center;
            border: 2px solid ${GOLD};
            border-radius: 22px;
            background: ${ROYAL_BLUE};
            color: ${GOLD};
            font-size: 30px;
            font-weight: 950;
          }
          .piSpinner {
            width: 44px;
            height: 44px;
            margin-top: 20px;
            border: 4px solid #e5e7eb;
            border-top-color: ${GOLD};
            border-radius: 50%;
            animation: piSpin 0.8s linear infinite;
          }
          h2 {
            margin: 16px 0 0;
          }
          p {
            color: #667085;
          }
          @keyframes piSpin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="piPage">
      <section className="piHero">
        <div>
          <span>NEW CITY STYLE • OWNER PROFIT CONTROL</span>
          <h1>Product & Category Profit Intelligence</h1>
          <p>
            Profit is calculated only from registered stock: actual sold value minus purchase cost. Quick Items are excluded completely.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "↻ Refresh Profit"}
        </button>
      </section>

      {errorText && <div className="piError">{errorText}</div>}
      <div className="piRuleNote">
        <strong>Profit Rule:</strong> Purchase Cost → Actual Sold Price → Profit.
        MRP is not used. POS Quick Items are excluded from all profit totals.
      </div>

      <section className="piMetricGrid">
        <ProfitMetric
          label="Revenue • 30 Days"
          value={money(totals.revenue)}
          note="Registered-stock sales only • Quick Items excluded"
          tone="blue"
        />
        <ProfitMetric
          label="Gross Profit • 30 Days"
          value={money(totals.profit)}
          note="Actual sold value minus purchase cost"
          tone="gold"
        />
        <ProfitMetric
          label="Gross Margin"
          value={percent(overallMargin)}
          note="Overall profit efficiency"
          tone="green"
        />
        <ProfitMetric
          label="Stock Investment"
          value={money(totals.investment)}
          note={`${num(totals.stock)} units in stock`}
          tone="blue"
        />
        <ProfitMetric
          label="Money Blocked"
          value={money(totals.blocked)}
          note="Slow / dead stock capital"
          tone="red"
        />
        <ProfitMetric
          label="Units Sold • 30 Days"
          value={num(totals.units)}
          note="All tracked variants"
          tone="gold"
        />
      </section>

      <section className="piGridTwo">
        <ProfitPanel
          eyebrow="CATEGORY PERFORMANCE"
          title="Profit by Category"
        >
          <GroupTable rows={categoryRows.slice(0, 12)} />
        </ProfitPanel>

        <ProfitPanel
          eyebrow="BRAND PERFORMANCE"
          title="Profit by Brand"
        >
          <GroupTable rows={brandRows.slice(0, 12)} />
        </ProfitPanel>
      </section>

      <section className="piGridThree">
        <InsightPanel
          eyebrow="TOP MONEY MAKERS"
          title="Best Profit Products"
          tone="green"
          rows={topProducts}
          value={(row) => money(actualProfit(row))}
          note={(row) =>
            `${percent(variantMargin(row))} margin • ${num(
              n(row.sold_30d),
            )} sold`
          }
        />

        <InsightPanel
          eyebrow="MARGIN WATCH"
          title="Low Margin Products"
          tone="gold"
          rows={lowMarginProducts}
          value={(row) => percent(variantMargin(row))}
          note={(row) =>
            `${money(actualProfit(row))} profit • ${money(
              n(row.revenue_30d),
            )} revenue`
          }
        />

        <InsightPanel
          eyebrow="CASH BLOCK WATCH"
          title="Money Blocked in Stock"
          tone="red"
          rows={blockedProducts}
          value={(row) => money(n(row.money_blocked))}
          note={(row) =>
            `${num(n(row.current_stock))} units • ${num(
              n(row.stock_age_days),
            )} days old`
          }
        />
      </section>

      <section className="piProductPanel">
        <div className="piPanelHeader">
          <div>
            <span>PRODUCT PROFIT CONTROL</span>
            <h2>Actual Purchase vs Sold Profit Table</h2>
          </div>

          <div className="piFilters">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product, brand, category, size..."
            />

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="ALL">All Categories</option>
              {categories.map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={profitFilter}
              onChange={(event) =>
                setProfitFilter(
                  event.target.value as
                    | "ALL"
                    | "HIGH_MARGIN"
                    | "LOW_MARGIN"
                    | "LOSS"
                    | "BLOCKED",
                )
              }
            >
              <option value="ALL">All Profit Status</option>
              <option value="HIGH_MARGIN">High Margin 40%+</option>
              <option value="LOW_MARGIN">Low Margin Below 20%</option>
              <option value="LOSS">Loss Making</option>
              <option value="BLOCKED">Money Blocked</option>
            </select>
          </div>
        </div>

        <div className="piTableWrap">
          <table className="piTable">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category / Brand</th>
                <th>Size / Colour</th>
                <th>Cost</th>
                <th>Avg Sold Price</th>
                <th>Sold 30d</th>
                <th>Revenue 30d</th>
                <th>Profit 30d</th>
                <th>Margin</th>
                <th>Blocked</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="piEmpty">
                    No products match this filter.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((row) => {
                  const margin = variantMargin(row);
                  const profit = actualProfit(row);

                  return (
                    <tr key={`${row.variant_id}-${row.product_id}`}>
                      <td>
                        <strong>
                          {row.product_name || "Unnamed Product"}
                        </strong>
                      </td>
                      <td>
                        {row.category || "Unassigned"}
                        <small>{row.brand || "No brand"}</small>
                      </td>
                      <td>
                        {row.size || "—"}
                        <small>{row.color || "—"}</small>
                      </td>
                      <td>{money(n(row.weighted_purchase_cost))}</td>
                      <td>{money(actualSoldPrice(row))}</td>
                      <td>{num(n(row.sold_30d))}</td>
                      <td>{money(n(row.revenue_30d))}</td>
                      <td
                        className={
                          profit < 0 ? "piNegative" : "piPositive"
                        }
                      >
                        {money(profit)}
                      </td>
                      <td>
                        <span
                          className={`piMargin ${
                            margin >= 40
                              ? "high"
                              : margin < 20
                                ? "low"
                                : "normal"
                          }`}
                        >
                          {percent(margin)}
                        </span>
                      </td>
                      <td>{money(n(row.money_blocked))}</td>
                      <td>
                        <span className="piStatus">
                          {row.final_stock_status || "OBSERVE"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="piPaginationBar">
          <div className="piPaginationInfo">
            Showing{" "}
            <strong>
              {filteredProducts.length === 0
                ? 0
                : (safeCurrentPage - 1) * PRODUCTS_PER_PAGE + 1}
              -
              {Math.min(
                safeCurrentPage * PRODUCTS_PER_PAGE,
                filteredProducts.length,
              )}
            </strong>{" "}
            of <strong>{filteredProducts.length}</strong> products
          </div>

          <div className="piPaginationControls">
            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              disabled={safeCurrentPage <= 1}
            >
              ← Previous
            </button>

            {visiblePageNumbers[0] > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                >
                  1
                </button>
                {visiblePageNumbers[0] > 2 && (
                  <span className="piPageDots">…</span>
                )}
              </>
            )}

            {visiblePageNumbers.map((page) => (
              <button
                type="button"
                key={page}
                className={
                  page === safeCurrentPage ? "active" : undefined
                }
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}

            {visiblePageNumbers[visiblePageNumbers.length - 1] <
              totalPages && (
              <>
                {visiblePageNumbers[visiblePageNumbers.length - 1] <
                  totalPages - 1 && (
                  <span className="piPageDots">…</span>
                )}
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(totalPages, page + 1),
                )
              }
              disabled={safeCurrentPage >= totalPages}
            >
              Next →
            </button>
          </div>
        </div>
      </section>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .piPage {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(
              circle at 5% 0%,
              rgba(212, 175, 55, 0.15),
              transparent 25%
            ),
            linear-gradient(180deg, ${IVORY}, #ffffff);
          color: #243044;
          font-family: Poppins, Inter, Arial, sans-serif;
        }

        .piHero {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          padding: 26px;
          border: 1px solid rgba(212, 175, 55, 0.42);
          border-radius: 23px;
          background:
            radial-gradient(
              circle at 92% 0%,
              rgba(212, 175, 55, 0.3),
              transparent 34%
            ),
            linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE} 62%, #174da4);
          color: #ffffff;
          box-shadow: 0 20px 48px rgba(3, 21, 63, 0.2);
        }

        .piHero span,
        .piPanelHeader span {
          color: #f1d26a;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .piHero h1 {
          margin: 7px 0 6px;
          font-size: clamp(28px, 4vw, 48px);
          line-height: 1.04;
        }

        .piHero p {
          max-width: 790px;
          margin: 0;
          color: rgba(255, 255, 255, 0.75);
          font-size: 13px;
          line-height: 1.6;
        }

        .piHero button {
          min-width: 135px;
          min-height: 42px;
          border: 1px solid ${GOLD};
          border-radius: 11px;
          background: rgba(212, 175, 55, 0.12);
          color: #f8dc79;
          font-weight: 900;
          cursor: pointer;
        }

        .piHero button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .piRuleNote {
          margin-top: 15px;
          padding: 13px 15px;
          border: 1px solid rgba(212, 175, 55, 0.34);
          border-radius: 12px;
          background: rgba(212, 175, 55, 0.08);
          color: #5f4a10;
          font-size: 11px;
          line-height: 1.55;
        }

        .piRuleNote strong {
          color: #0A2E73;
        }

        .piError {
          margin-top: 15px;
          padding: 13px 15px;
          border: 1px solid #fca5a5;
          border-radius: 12px;
          background: #fff7f7;
          color: #b91c1c;
          font-size: 12px;
          font-weight: 800;
        }

        .piMetricGrid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 11px;
          margin-top: 16px;
        }

        .piGridTwo {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-top: 16px;
        }

        .piGridThree {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 16px;
        }

        .piPanel,
        .piProductPanel,
        .piInsightPanel {
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.12);
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 12px 30px rgba(3, 21, 63, 0.07);
        }

        .piProductPanel {
          margin-top: 16px;
        }

        .piPanelHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          padding: 18px 20px;
          border-bottom: 1px solid #edf0f5;
        }

        .piPanelHeader span {
          color: #b8890b;
        }

        .piPanelHeader h2 {
          margin: 5px 0 0;
          color: ${ROYAL_BLUE};
          font-size: 20px;
        }

        .piFilters {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .piFilters input,
        .piFilters select {
          min-height: 38px;
          padding: 0 11px;
          border: 1px solid #d9dfea;
          border-radius: 9px;
          background: #ffffff;
          color: #243044;
          font-size: 11px;
          outline: none;
        }

        .piFilters input {
          min-width: 240px;
        }

        .piPaginationBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 15px 16px 17px;
          border-top: 1px solid #edf0f5;
          background: linear-gradient(180deg, #ffffff, #fbfcff);
        }

        .piPaginationInfo {
          color: #667085;
          font-size: 10px;
          font-weight: 750;
        }

        .piPaginationInfo strong {
          color: ${ROYAL_BLUE};
          font-weight: 950;
        }

        .piPaginationControls {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 6px;
        }

        .piPaginationControls button {
          min-width: 34px;
          height: 34px;
          padding: 0 10px;
          border: 1px solid #d9dee8;
          border-radius: 9px;
          background: #ffffff;
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
          transition:
            transform 0.16s ease,
            border-color 0.16s ease,
            background 0.16s ease,
            box-shadow 0.16s ease;
        }

        .piPaginationControls button:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(212, 175, 55, 0.72);
          box-shadow: 0 6px 16px rgba(10, 46, 115, 0.09);
        }

        .piPaginationControls button.active {
          border-color: ${GOLD};
          background: linear-gradient(135deg, ${ROYAL_BLUE}, #174da4);
          color: #ffffff;
          box-shadow: 0 7px 18px rgba(10, 46, 115, 0.18);
        }

        .piPaginationControls button:disabled {
          opacity: 0.38;
          cursor: not-allowed;
        }

        .piPageDots {
          padding: 0 2px;
          color: #98a2b3;
          font-size: 12px;
          font-weight: 900;
        }

        .piTableWrap {
          width: 100%;
          overflow-x: auto;
        }

        .piTable {
          width: 100%;
          min-width: 1180px;
          border-collapse: collapse;
        }

        .piTable th {
          padding: 11px 13px;
          border-bottom: 1px solid #e7ebf2;
          background: #f8fafc;
          color: #657086;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.4px;
          text-align: left;
          text-transform: uppercase;
        }

        .piTable td {
          padding: 12px 13px;
          border-bottom: 1px solid #eef1f5;
          color: #37445a;
          font-size: 10px;
          font-weight: 750;
          vertical-align: middle;
        }

        .piTable td strong,
        .piTable td small {
          display: block;
        }

        .piTable td strong {
          color: ${ROYAL_BLUE};
          font-size: 11px;
          font-weight: 950;
        }

        .piTable td small {
          margin-top: 3px;
          color: #8992a2;
          font-size: 9px;
          font-weight: 700;
        }

        .piPositive {
          color: #14804a !important;
          font-weight: 950 !important;
        }

        .piNegative {
          color: #b42318 !important;
          font-weight: 950 !important;
        }

        .piMargin,
        .piStatus {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 25px;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 950;
          white-space: nowrap;
        }

        .piMargin.high {
          background: #ecfdf3;
          color: #027a48;
        }

        .piMargin.normal {
          background: #eff6ff;
          color: ${ROYAL_BLUE};
        }

        .piMargin.low {
          background: #fff7ed;
          color: #c2410c;
        }

        .piStatus {
          max-width: 150px;
          overflow: hidden;
          background: #f2f4f7;
          color: #475467;
          text-overflow: ellipsis;
        }

        .piEmpty {
          padding: 34px !important;
          color: #7a8497 !important;
          text-align: center;
        }

        @media (max-width: 1280px) {
          .piMetricGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .piGridThree {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .piPage {
            padding: 100px 12px 18px;
          }

          .piHero {
            align-items: stretch;
            flex-direction: column;
          }

          .piGridTwo,
          .piMetricGrid {
            grid-template-columns: 1fr;
          }

          .piPanelHeader {
            flex-direction: column;
          }

          .piFilters {
            width: 100%;
            justify-content: stretch;
          }

          .piFilters input,
          .piFilters select {
            width: 100%;
            min-width: 0;
          }
        }
      `}</style>
    </main>
  );
}

function ProfitMetric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "blue" | "gold" | "green" | "red";
}) {
  const accent =
    tone === "green"
      ? "#5ee6a7"
      : tone === "red"
        ? "#ff8a80"
        : tone === "gold"
          ? "#f1d26a"
          : "#a9c9ff";

  return (
    <article
      style={{
        minHeight: 118,
        padding: 15,
        border: "1px solid rgba(212,175,55,0.28)",
        borderRadius: 15,
        background:
          "linear-gradient(145deg, #03153F, #0A2E73 70%, #124592)",
        color: "#ffffff",
        boxShadow: "0 10px 25px rgba(3,21,63,0.14)",
      }}
    >
      <span
        style={{
          display: "block",
          color: accent,
          fontSize: 9,
          fontWeight: 950,
          letterSpacing: 0.55,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          display: "block",
          marginTop: 10,
          fontSize: 22,
          lineHeight: 1.1,
        }}
      >
        {value}
      </strong>

      <small
        style={{
          display: "block",
          marginTop: 9,
          color: "rgba(255,255,255,0.64)",
          fontSize: 9,
          lineHeight: 1.4,
        }}
      >
        {note}
      </small>
    </article>
  );
}

function ProfitPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="piPanel">
      <div className="piPanelHeader">
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </article>
  );
}

function GroupTable({ rows }: { rows: GroupRow[] }) {
  if (rows.length === 0) {
    return <div className="piEmpty">No performance data available.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="piTable" style={{ minWidth: 700 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Revenue</th>
            <th>Profit</th>
            <th>Margin</th>
            <th>Sold</th>
            <th>Blocked</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>
                <strong>{row.name}</strong>
              </td>
              <td>{money(row.revenue)}</td>
              <td className={row.profit < 0 ? "piNegative" : "piPositive"}>
                {money(row.profit)}
              </td>
              <td>{percent(row.margin)}</td>
              <td>{num(row.sold)}</td>
              <td>{money(row.blocked)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InsightPanel({
  eyebrow,
  title,
  tone,
  rows,
  value,
  note,
}: {
  eyebrow: string;
  title: string;
  tone: "green" | "gold" | "red";
  rows: VariantRow[];
  value: (row: VariantRow) => string;
  note: (row: VariantRow) => string;
}) {
  const accent =
    tone === "green" ? "#14804a" : tone === "red" ? "#b42318" : "#9a7100";

  return (
    <article className="piInsightPanel">
      <div className="piPanelHeader">
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </div>

      <div>
        {rows.length === 0 ? (
          <div className="piEmpty">No items in this watch list.</div>
        ) : (
          rows.map((row) => (
            <div
              key={`${row.variant_id}-${row.product_id}`}
              style={{
                minHeight: 72,
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) auto",
                gap: 12,
                alignItems: "center",
                padding: "12px 17px",
                borderBottom: "1px solid #eef1f5",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong
                  style={{
                    display: "block",
                    overflow: "hidden",
                    color: ROYAL_BLUE,
                    fontSize: 11,
                    fontWeight: 950,
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.product_name || "Unnamed Product"}
                </strong>
                <span
                  style={{
                    display: "block",
                    marginTop: 4,
                    color: "#7a8497",
                    fontSize: 9,
                  }}
                >
                  {row.brand || "No brand"} • {row.category || "Unassigned"}
                </span>
              </div>

              <div style={{ textAlign: "right" }}>
                <strong
                  style={{
                    display: "block",
                    color: accent,
                    fontSize: 12,
                    fontWeight: 950,
                  }}
                >
                  {value(row)}
                </strong>
                <small
                  style={{
                    display: "block",
                    marginTop: 4,
                    color: "#7a8497",
                    fontSize: 8,
                  }}
                >
                  {note(row)}
                </small>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}