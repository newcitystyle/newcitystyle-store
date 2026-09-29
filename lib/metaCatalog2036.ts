import { createHash, randomUUID } from "node:crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type AnyRow = Record<string, unknown>;

export type MetaCatalogItem2036 = {
  retailerId: string;
  groupId: string;
  productId: number | string;
  variantId: number | string | null;
  title: string;
  description: string;
  brand: string;
  category: string;
  size: string;
  color: string;
  imageUrl: string;
  productUrl: string;
  availability: "in stock" | "out of stock";
  inventory: number;
  price: number;
  mrp: number;
  currency: "INR";
  payloadHash: string;
};

export type CatalogBuild2036 = {
  runId: string;
  items: MetaCatalogItem2036[];
  productCount: number;
  variantCount: number;
  skippedCount: number;
  inStockCount: number;
  outOfStockCount: number;
};

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function bool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "active"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "inactive"].includes(normalized)) return false;
  }
  return null;
}

function numberValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function cleanUrl(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function firstImageFromUnknown(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = cleanUrl(item);
      if (url) return url;
      if (item && typeof item === "object") {
        const obj = item as AnyRow;
        const nested = cleanUrl(obj.url) || cleanUrl(obj.src) || cleanUrl(obj.image_url);
        if (nested) return nested;
      }
    }
  }

  if (typeof value === "string") {
    const direct = cleanUrl(value);
    if (direct) return direct;

    try {
      return firstImageFromUnknown(JSON.parse(value));
    } catch {
      return "";
    }
  }

  return "";
}

function productImage(product: AnyRow): string {
  return (
    cleanUrl(product.image_url) ||
    cleanUrl(product.image) ||
    firstImageFromUnknown(product.images) ||
    firstImageFromUnknown(product.gallery_images) ||
    ""
  );
}

function siteUrl(): string {
  const configured =
    text(process.env.NCS_SITE_URL) ||
    text(process.env.NEXT_PUBLIC_SITE_URL) ||
    "https://www.newcitystyle.store";
  return configured.replace(/\/+$/, "");
}

function productLink(product: AnyRow): string {
  const id = text(product.id);
  return `${siteUrl()}/product/${encodeURIComponent(id)}`;
}

function statusIsActive(row: AnyRow): boolean {
  const active = bool(row.is_active);
  if (active === false) return false;

  const status = text(row.status).toLowerCase();
  if (["inactive", "deleted", "disabled", "draft", "archived"].includes(status)) return false;

  return true;
}

function onlineAllowed(row: AnyRow): boolean {
  const online = bool(row.sell_online);
  // Older rows may not have sell_online populated. Only an explicit false excludes it.
  return online !== false;
}

function availableStock(product: AnyRow, variant?: AnyRow): number {
  const source = variant ?? product;
  const stock = Math.max(0, numberValue(source.stock));
  const reserved = Math.max(0, numberValue(source.reserved_stock));
  const onlineLimit = Math.max(0, numberValue(source.online_stock_limit));
  let available = Math.max(0, stock - reserved);

  // If online_stock_limit is used as a cap, respect it. Zero means "no cap".
  if (onlineLimit > 0) available = Math.min(available, onlineLimit);
  return Math.floor(available);
}

function priceFor(product: AnyRow, variant?: AnyRow): number {
  const source = variant ?? product;
  return Math.max(
    0,
    numberValue(source.selling_price) ||
      numberValue(source.price) ||
      numberValue(product.price),
  );
}

function mrpFor(product: AnyRow, variant?: AnyRow): number {
  const source = variant ?? product;
  const price = priceFor(product, variant);
  return Math.max(
    price,
    numberValue(source.mrp) || numberValue(product.mrp) || price,
  );
}

function catalogTitle(product: AnyRow, variant?: AnyRow): string {
  const name = text(product.name) || "NEW CITY STYLE Product";
  const size = text(variant?.size);
  const color = text(variant?.color);
  const suffix = [size, color].filter(Boolean).join(" • ");
  return suffix ? `${name} • ${suffix}` : name;
}

function catalogDescription(product: AnyRow): string {
  return (
    text(product.description) ||
    text(product.tagline) ||
    `${text(product.brand) || "NEW CITY STYLE"} ${text(product.category) || "fashion"} product from NEW CITY STYLE.`
  ).slice(0, 9000);
}

function groupId(product: AnyRow): string {
  return `NCS-P${text(product.id)}`;
}

function retailerId(product: AnyRow, variant?: AnyRow): string {
  if (variant && text(variant.id)) return `${groupId(product)}-V${text(variant.id)}`;
  return groupId(product);
}

function hashItem(item: Omit<MetaCatalogItem2036, "payloadHash">): string {
  return createHash("sha256").update(JSON.stringify(item)).digest("hex");
}

function buildItem(product: AnyRow, variant?: AnyRow): MetaCatalogItem2036 | null {
  const price = priceFor(product, variant);
  if (price <= 0) return null;

  const imageUrl = productImage(product);
  if (!imageUrl) return null;

  const inventory = availableStock(product, variant);
  const active = statusIsActive(product) && (!variant || statusIsActive(variant));
  const online = onlineAllowed(product) && (!variant || onlineAllowed(variant));
  const availability: "in stock" | "out of stock" =
    active && online && inventory > 0 ? "in stock" : "out of stock";

  const base = {
    retailerId: retailerId(product, variant),
    groupId: groupId(product),
    productId: (product.id as number | string) ?? "",
    variantId: variant ? ((variant.id as number | string) ?? null) : null,
    title: catalogTitle(product, variant).slice(0, 200),
    description: catalogDescription(product),
    brand: text(product.brand) || "NEW CITY STYLE",
    category: text(product.subcategory) || text(product.category) || "Fashion",
    size: text(variant?.size) || text(product.size),
    color: text(variant?.color) || text(product.color),
    imageUrl,
    productUrl: productLink(product),
    availability,
    inventory,
    price,
    mrp: mrpFor(product, variant),
    currency: "INR" as const,
  };

  return { ...base, payloadHash: hashItem(base) };
}

export function createServerSupabase2036(): SupabaseClient {
  const url =
    text(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    text(process.env.SUPABASE_URL);
  const key =
    text(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    text(process.env.SUPABASE_SERVICE_KEY);

  if (!url || !key) {
    throw new Error(
      "Supabase server env missing. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function buildMetaCatalog2036(): Promise<CatalogBuild2036> {
  const supabase = createServerSupabase2036();
  const [{ data: products, error: productError }, { data: variants, error: variantError }] =
    await Promise.all([
      supabase.from("products").select("*").order("id", { ascending: true }),
      supabase.from("product_variants").select("*").order("id", { ascending: true }),
    ]);

  if (productError) throw new Error(`Products load failed: ${productError.message}`);

  // product_variants may not exist in older installations. Treat that as no variants.
  const productRows = (products ?? []) as AnyRow[];
  const variantRows = variantError ? [] : ((variants ?? []) as AnyRow[]);
  const variantsByProduct = new Map<string, AnyRow[]>();

  for (const variant of variantRows) {
    const pid = text(variant.product_id);
    if (!pid) continue;
    const list = variantsByProduct.get(pid) ?? [];
    list.push(variant);
    variantsByProduct.set(pid, list);
  }

  const items: MetaCatalogItem2036[] = [];
  let skippedCount = 0;

  for (const product of productRows) {
    if (!statusIsActive(product)) continue;
    const pid = text(product.id);
    const productVariants = variantsByProduct.get(pid) ?? [];

    if (productVariants.length > 0) {
      for (const variant of productVariants) {
        if (!statusIsActive(variant)) continue;
        const item = buildItem(product, variant);
        if (item) items.push(item);
        else skippedCount += 1;
      }
    } else {
      const item = buildItem(product);
      if (item) items.push(item);
      else skippedCount += 1;
    }
  }

  return {
    runId: randomUUID(),
    items,
    productCount: productRows.length,
    variantCount: variantRows.length,
    skippedCount,
    inStockCount: items.filter((x) => x.availability === "in stock").length,
    outOfStockCount: items.filter((x) => x.availability === "out of stock").length,
  };
}

export function csv2036(build: CatalogBuild2036): string {
  const columns = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "sale_price",
    "link",
    "image_link",
    "brand",
    "item_group_id",
    "color",
    "size",
    "inventory",
    "product_type",
  ];

  const q = (value: unknown) => {
    const raw = String(value ?? "");
    return `"${raw.replace(/"/g, '""')}"`;
  };

  const rows = build.items.map((item) => {
    const hasSale = item.mrp > item.price;
    const regular = hasSale ? item.mrp : item.price;
    const sale = hasSale ? `${item.price.toFixed(2)} ${item.currency}` : "";
    return [
      item.retailerId,
      item.title,
      item.description,
      item.availability,
      "new",
      `${regular.toFixed(2)} ${item.currency}`,
      sale,
      item.productUrl,
      item.imageUrl,
      item.brand,
      item.groupId,
      item.color,
      item.size,
      item.inventory,
      item.category,
    ]
      .map(q)
      .join(",");
  });

  return [columns.join(","), ...rows].join("\n");
}

export function graphData2036(item: MetaCatalogItem2036): Record<string, unknown> {
  const data: Record<string, unknown> = {
    name: item.title,
    description: item.description,
    availability: item.availability,
    condition: "new",
    brand: item.brand,
    category: item.category,
    image_url: item.imageUrl,
    url: item.productUrl,
    inventory: item.inventory,
    price: Math.round(item.price * 100),
    currency: item.currency,
    retailer_product_group_id: item.groupId,
  };

  if (item.size) data.size = item.size;
  if (item.color) data.color = item.color;
  if (item.mrp > item.price) data.sale_price = Math.round(item.price * 100);
  return data;
}

export async function writeSyncLog2036(input: {
  runId: string;
  mode: string;
  status: string;
  totalItems: number;
  inStock: number;
  outOfStock: number;
  skipped: number;
  changed?: number;
  deleted?: number;
  metaResponse?: unknown;
  errorMessage?: string;
}): Promise<void> {
  try {
    const supabase = createServerSupabase2036();
    await supabase.from("meta_catalog_sync_log").insert({
      run_id: input.runId,
      mode: input.mode,
      status: input.status,
      total_items: input.totalItems,
      in_stock_items: input.inStock,
      out_of_stock_items: input.outOfStock,
      skipped_items: input.skipped,
      changed_items: input.changed ?? 0,
      deleted_items: input.deleted ?? 0,
      meta_response: input.metaResponse ?? null,
      error_message: input.errorMessage ?? null,
    });
  } catch {
    // Stage 10 should keep serving the feed even before the optional SQL is installed.
  }
}
