import { NextRequest, NextResponse } from "next/server";
import {
  buildMetaCatalog2036,
  csv2036,
  writeSyncLog2036,
} from "../../../../../lib/metaCatalog2036";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function configuredKey(): string {
  return (process.env.META_CATALOG_FEED_KEY || "").trim();
}

function authorized(request: NextRequest): boolean {
  const expected = configuredKey();
  if (!expected) return true;

  const queryKey = request.nextUrl.searchParams.get("key") || "";
  const headerKey = request.headers.get("x-meta-feed-key") || "";
  return queryKey === expected || headerKey === expected;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Invalid Meta catalog feed key." },
      { status: 401 },
    );
  }

  try {
    const build = await buildMetaCatalog2036();
    const format = (request.nextUrl.searchParams.get("format") || "csv").toLowerCase();

    await writeSyncLog2036({
      runId: build.runId,
      mode: "feed",
      status: "success",
      totalItems: build.items.length,
      inStock: build.inStockCount,
      outOfStock: build.outOfStockCount,
      skipped: build.skippedCount,
    });

    if (format === "json") {
      return NextResponse.json({
        ok: true,
        runId: build.runId,
        productCount: build.productCount,
        variantCount: build.variantCount,
        itemCount: build.items.length,
        inStockCount: build.inStockCount,
        outOfStockCount: build.outOfStockCount,
        skippedCount: build.skippedCount,
        items: build.items.slice(0, 100),
        truncated: build.items.length > 100,
      });
    }

    const csv = csv2036(build);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'inline; filename="new-city-style-meta-catalog.csv"',
        "Cache-Control": "no-store, max-age=0",
        "X-NCS-Catalog-Items": String(build.items.length),
        "X-NCS-Catalog-Run": build.runId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to build Meta catalog feed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
