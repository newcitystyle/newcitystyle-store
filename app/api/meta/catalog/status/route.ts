import { NextRequest, NextResponse } from "next/server";
import {
  buildMetaCatalog2036,
  createServerSupabase2036,
} from "../../../../../lib/metaCatalog2036";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function feedUrl(request: NextRequest): string {
  const base = (process.env.NCS_SITE_URL || request.nextUrl.origin || "https://www.newcitystyle.store")
    .trim()
    .replace(/\/+$/, "");
  const key = (process.env.META_CATALOG_FEED_KEY || "").trim();
  const suffix = key ? `?key=${encodeURIComponent(key)}` : "";
  return `${base}/api/meta/catalog/feed${suffix}`;
}

export async function GET(request: NextRequest) {
  try {
    const build = await buildMetaCatalog2036();
    let latestLogs: unknown[] = [];
    let stateCount = 0;

    try {
      const supabase = createServerSupabase2036();
      const [{ data: logs }, { count }] = await Promise.all([
        supabase
          .from("meta_catalog_sync_log")
          .select("id,run_id,mode,status,total_items,in_stock_items,out_of_stock_items,changed_items,deleted_items,error_message,created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("meta_catalog_item_state")
          .select("retailer_id", { count: "exact", head: true })
          .is("deleted_at", null),
      ]);
      latestLogs = logs || [];
      stateCount = count || 0;
    } catch {
      // SQL is optional until Stage 10 setup is run.
    }

    return NextResponse.json({
      ok: true,
      stage: "NCS META CATALOG MASTER SYNC • STAGE 10 • 2036",
      feedUrl: feedUrl(request),
      catalog: {
        productsRead: build.productCount,
        variantsRead: build.variantCount,
        generatedItems: build.items.length,
        inStockItems: build.inStockCount,
        outOfStockItems: build.outOfStockCount,
        skippedItems: build.skippedCount,
        trackedStateItems: stateCount,
      },
      configuration: {
        feedKeyConfigured: Boolean((process.env.META_CATALOG_FEED_KEY || "").trim()),
        syncSecretConfigured: Boolean((process.env.META_CATALOG_SYNC_SECRET || "").trim()),
        catalogIdConfigured: Boolean((process.env.META_CATALOG_ID || "").trim()),
        accessTokenConfigured: Boolean((process.env.META_CATALOG_ACCESS_TOKEN || "").trim()),
        directSyncEnabled: ["1", "true", "yes", "on"].includes(
          (process.env.META_CATALOG_DIRECT_SYNC_ENABLED || "").trim().toLowerCase(),
        ),
        graphVersion: (process.env.META_GRAPH_VERSION || "v26.0").trim(),
      },
      latestLogs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to inspect Meta catalog.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
