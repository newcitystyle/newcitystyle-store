import { NextRequest, NextResponse } from "next/server";
import {
  buildMetaCatalog2036,
  createServerSupabase2036,
  graphData2036,
  writeSyncLog2036,
} from "../../../../../lib/metaCatalog2036";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StateRow = {
  retailer_id: string;
  payload_hash: string | null;
};

type SyncMode = "dry_run" | "push";

function secretOk(request: NextRequest, supplied?: string | null): boolean {
  const expected = (process.env.META_CATALOG_SYNC_SECRET || "").trim();
  if (!expected) return false;

  const header = request.headers.get("x-meta-sync-secret") || "";
  const query = request.nextUrl.searchParams.get("secret") || "";

  return supplied === expected || header === expected || query === expected;
}

function directSyncEnabled(): boolean {
  return ["1", "true", "yes", "on"].includes(
    (process.env.META_CATALOG_DIRECT_SYNC_ENABLED || "").trim().toLowerCase(),
  );
}

function graphVersion(): string {
  return (process.env.META_GRAPH_VERSION || "v26.0").trim();
}

async function readMetaJson(response: Response): Promise<unknown> {
  const raw = await response.text();

  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function compactMetaError(data: any) {
  const error = data?.error;

  if (!error) return data;

  return {
    message: error.message ?? null,
    type: error.type ?? null,
    code: error.code ?? null,
    error_subcode: error.error_subcode ?? null,
    fbtrace_id: error.fbtrace_id ?? null,
  };
}

/*
 * Stage 10.1 diagnostic:
 * GET /api/meta/catalog/sync?secret=<META_CATALOG_SYNC_SECRET>
 *
 * This does NOT push or change anything.
 * It verifies whether the configured META_CATALOG_ACCESS_TOKEN can read the
 * configured META_CATALOG_ID through Graph API.
 */
export async function GET(request: NextRequest) {
  if (!secretOk(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid or missing META_CATALOG_SYNC_SECRET.",
      },
      { status: 401 },
    );
  }

  const catalogId = (process.env.META_CATALOG_ID || "").trim();
  const accessToken = (process.env.META_CATALOG_ACCESS_TOKEN || "").trim();
  const version = graphVersion();

  const config = {
    graphVersion: version,
    catalogIdConfigured: Boolean(catalogId),
    accessTokenConfigured: Boolean(accessToken),
    directSyncEnabled: directSyncEnabled(),
  };

  if (!catalogId || !accessToken) {
    return NextResponse.json(
      {
        ok: false,
        step: "config",
        ...config,
        error: "META_CATALOG_ID or META_CATALOG_ACCESS_TOKEN is missing.",
      },
      { status: 409 },
    );
  }

  try {
    const catalogUrl =
      `https://graph.facebook.com/${version}/${encodeURIComponent(catalogId)}` +
      `?fields=id,name,product_count&access_token=${encodeURIComponent(accessToken)}`;

    const catalogResponse = await fetch(catalogUrl, {
      method: "GET",
      cache: "no-store",
    });

    const catalogData = await readMetaJson(catalogResponse);

    if (!catalogResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          step: "catalog_read",
          ...config,
          httpStatus: catalogResponse.status,
          catalogReadable: false,
          meta: compactMetaError(catalogData),
          diagnosis:
            "The configured system-user token cannot read this catalog object. " +
            "Confirm that NCS Automation has Full access to catalog 892857736317145, " +
            "the token was generated AFTER assigning that catalog, and the token includes business_management.",
        },
        { status: catalogResponse.status },
      );
    }

    const itemsUrl =
      `https://graph.facebook.com/${version}/${encodeURIComponent(catalogId)}/products` +
      `?fields=id,retailer_id,name&limit=3&access_token=${encodeURIComponent(accessToken)}`;

    const itemsResponse = await fetch(itemsUrl, {
      method: "GET",
      cache: "no-store",
    });

    const itemsData = await readMetaJson(itemsResponse);

    return NextResponse.json({
      ok: true,
      step: "catalog_read",
      ...config,
      catalogReadable: true,
      catalog: catalogData,
      sampleProductsReadable: itemsResponse.ok,
      sampleProductsHttpStatus: itemsResponse.status,
      sampleProducts: itemsResponse.ok ? itemsData : undefined,
      sampleProductsError: itemsResponse.ok ? undefined : compactMetaError(itemsData),
      message:
        "Catalog object is readable with the configured token. " +
        "If push still fails, the next check is the items_batch request payload/edge.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        step: "network",
        ...config,
        error:
          error instanceof Error
            ? error.message
            : "Meta catalog diagnostic request failed.",
      },
      { status: 500 },
    );
  }
}

async function postGraphBatch(
  catalogId: string,
  accessToken: string,
  requests: Array<Record<string, unknown>>,
): Promise<{ endpoint: string; data: unknown }> {
  const params = new URLSearchParams();
  params.set("access_token", accessToken);
  params.set("item_type", "PRODUCT_ITEM");
  params.set("allow_upsert", "true");
  params.set("requests", JSON.stringify(requests));

  // Stage 10.1: current Catalog Items Batch endpoint only.
  const endpoints = ["items_batch"];
  let lastError = "Meta catalog batch request failed.";

  for (const edge of endpoints) {
    const endpoint = `https://graph.facebook.com/${graphVersion()}/${catalogId}/${edge}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      cache: "no-store",
    });

    const raw = await response.text();
    let data: unknown = raw;

    try {
      data = JSON.parse(raw);
    } catch {
      // keep raw response
    }

    if (response.ok) {
      return { endpoint, data };
    }

    lastError =
      `Meta ${edge} failed (${response.status}): ` +
      raw.slice(0, 1200);
  }

  throw new Error(lastError);
}

async function readPreviousState(): Promise<StateRow[]> {
  try {
    const supabase = createServerSupabase2036();
    const { data, error } = await supabase
      .from("meta_catalog_item_state")
      .select("retailer_id,payload_hash")
      .is("deleted_at", null);

    if (error) return [];

    return (data || []) as StateRow[];
  } catch {
    return [];
  }
}

async function persistState(
  items: Awaited<ReturnType<typeof buildMetaCatalog2036>>["items"],
  removedIds: string[],
  runId: string,
): Promise<void> {
  try {
    const supabase = createServerSupabase2036();
    const now = new Date().toISOString();

    if (items.length) {
      const rows = items.map((item) => ({
        retailer_id: item.retailerId,
        product_id: String(item.productId),
        variant_id:
          item.variantId == null
            ? null
            : String(item.variantId),
        payload_hash: item.payloadHash,
        last_seen_at: now,
        last_pushed_at: now,
        last_status: "submitted",
        last_run_id: runId,
        last_error: null,
        deleted_at: null,
      }));

      for (let i = 0; i < rows.length; i += 500) {
        await supabase
          .from("meta_catalog_item_state")
          .upsert(rows.slice(i, i + 500), {
            onConflict: "retailer_id",
          });
      }
    }

    if (removedIds.length) {
      for (let i = 0; i < removedIds.length; i += 500) {
        await supabase
          .from("meta_catalog_item_state")
          .update({
            deleted_at: now,
            last_status: "delete_submitted",
            last_pushed_at: now,
            last_run_id: runId,
          })
          .in(
            "retailer_id",
            removedIds.slice(i, i + 500),
          );
      }
    }
  } catch {
    // Meta request already succeeded. State logging is best-effort.
  }
}

export async function POST(request: NextRequest) {
  let body: {
    mode?: SyncMode;
    secret?: string;
    force?: boolean;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  if (!secretOk(request, body.secret)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid or missing META_CATALOG_SYNC_SECRET.",
      },
      { status: 401 },
    );
  }

  const mode: SyncMode =
    body.mode === "push"
      ? "push"
      : "dry_run";

  try {
    const build = await buildMetaCatalog2036();
    const previous = await readPreviousState();

    const previousMap = new Map(
      previous.map((x) => [
        x.retailer_id,
        x.payload_hash || "",
      ]),
    );

    const currentIds = new Set(
      build.items.map((x) => x.retailerId),
    );

    const changed = build.items.filter(
      (item) =>
        body.force === true ||
        previousMap.get(item.retailerId) !==
          item.payloadHash,
    );

    const removedIds = previous
      .map((x) => x.retailer_id)
      .filter((id) => !currentIds.has(id));

    const summary = {
      ok: true,
      mode,
      runId: build.runId,
      totalItems: build.items.length,
      changedItems: changed.length,
      deleteItems: removedIds.length,
      unchangedItems: Math.max(
        0,
        build.items.length - changed.length,
      ),
      inStockItems: build.inStockCount,
      outOfStockItems: build.outOfStockCount,
      skippedItems: build.skippedCount,
      directSyncEnabled: directSyncEnabled(),
      metaConfigured: Boolean(
        (process.env.META_CATALOG_ID || "").trim() &&
          (
            process.env
              .META_CATALOG_ACCESS_TOKEN || ""
          ).trim(),
      ),
    };

    if (mode === "dry_run") {
      await writeSyncLog2036({
        runId: build.runId,
        mode,
        status: "dry_run",
        totalItems: build.items.length,
        inStock: build.inStockCount,
        outOfStock: build.outOfStockCount,
        skipped: build.skippedCount,
        changed: changed.length,
        deleted: removedIds.length,
      });

      return NextResponse.json({
        ...summary,
        sampleChanged: changed
          .slice(0, 20)
          .map((x) => ({
            id: x.retailerId,
            title: x.title,
            stock: x.inventory,
            availability: x.availability,
            price: x.price,
            size: x.size,
            color: x.color,
          })),
        sampleDeleted: removedIds.slice(0, 20),
      });
    }

    if (!directSyncEnabled()) {
      return NextResponse.json(
        {
          ...summary,
          ok: false,
          error:
            "Direct Meta push is safety-locked. Set META_CATALOG_DIRECT_SYNC_ENABLED=true only after the feed is verified in Commerce Manager.",
        },
        { status: 409 },
      );
    }

    const catalogId =
      (process.env.META_CATALOG_ID || "").trim();

    const accessToken =
      (
        process.env
          .META_CATALOG_ACCESS_TOKEN || ""
      ).trim();

    if (!catalogId || !accessToken) {
      return NextResponse.json(
        {
          ...summary,
          ok: false,
          error:
            "META_CATALOG_ID or META_CATALOG_ACCESS_TOKEN is missing.",
        },
        { status: 409 },
      );
    }

    const mutations: Array<Record<string, unknown>> = [
      ...changed.map((item) => ({
        method: "UPDATE",
        retailer_id: item.retailerId,
        data: graphData2036(item),
      })),
      ...removedIds.map((id) => ({
        method: "DELETE",
        retailer_id: id,
      })),
    ];

    if (mutations.length === 0) {
      await writeSyncLog2036({
        runId: build.runId,
        mode,
        status: "no_changes",
        totalItems: build.items.length,
        inStock: build.inStockCount,
        outOfStock: build.outOfStockCount,
        skipped: build.skippedCount,
      });

      return NextResponse.json({
        ...summary,
        message:
          "Catalog already matches local snapshot.",
      });
    }

    const responses: unknown[] = [];

    for (
      let i = 0;
      i < mutations.length;
      i += 500
    ) {
      const chunk =
        mutations.slice(i, i + 500);

      responses.push(
        await postGraphBatch(
          catalogId,
          accessToken,
          chunk,
        ),
      );
    }

    await persistState(
      build.items,
      removedIds,
      build.runId,
    );

    await writeSyncLog2036({
      runId: build.runId,
      mode,
      status: "submitted",
      totalItems: build.items.length,
      inStock: build.inStockCount,
      outOfStock: build.outOfStockCount,
      skipped: build.skippedCount,
      changed: changed.length,
      deleted: removedIds.length,
      metaResponse: responses,
    });

    return NextResponse.json({
      ...summary,
      submittedMutations: mutations.length,
      batches: responses.length,
      metaResponse: responses,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Meta catalog sync failed.";

    return NextResponse.json(
      {
        ok: false,
        mode,
        error: message,
      },
      { status: 500 },
    );
  }
}
