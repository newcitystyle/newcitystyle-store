#!/usr/bin/env node

/**
 * NEW CITY STYLE
 * Supabase Storage -> Cloudflare R2 Migration
 *
 * Uses Windows curl.exe -> existing website R2 upload API.
 *
 * SAFE DRY RUN:
 * node scripts/migrate-supabase-images-to-r2.mjs
 *
 * TEST:
 * node scripts/migrate-supabase-images-to-r2.mjs --apply --limit=5
 *
 * FULL:
 * node scripts/migrate-supabase-images-to-r2.mjs --apply
 *
 * IMPORTANT:
 * - Old Supabase images are NOT deleted.
 * - DB URL changes only after successful R2 upload.
 * - Already-R2 URLs are skipped.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const execFileAsync = promisify(execFile);

// ============================================================
// OPTIONS
// ============================================================

const APPLY = process.argv.includes("--apply");

const limitArg =
  process.argv.find((arg) => arg.startsWith("--limit="));

const LIMIT = limitArg
  ? Math.max(
      1,
      Number(limitArg.split("=")[1]) || 1
    )
  : Number.POSITIVE_INFINITY;

// ============================================================
// WEBSITE UPLOAD ROUTE
// ============================================================

const WEBSITE_R2_UPLOAD_URL =
  "https://www.newcitystyle.store/api/r2/upload";

// ============================================================
// LOAD ENV
// ============================================================

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const text =
    fs.readFileSync(filePath, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (
      !line ||
      line.startsWith("#")
    ) {
      continue;
    }

    const match =
      line.match(
        /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/
      );

    if (!match) {
      continue;
    }

    const key =
      match[1];

    let value =
      match[2].trim();

    if (
      (
        value.startsWith('"') &&
        value.endsWith('"')
      ) ||
      (
        value.startsWith("'") &&
        value.endsWith("'")
      )
    ) {
      value =
        value.slice(1, -1);
    }

    if (
      process.env[key] == null
    ) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(
  path.resolve(
    process.cwd(),
    ".env.local"
  )
);

loadEnvFile(
  path.resolve(
    process.cwd(),
    ".env"
  )
);

// ============================================================
// ENV
// ============================================================

function requireEnv(...names) {
  for (const name of names) {
    const value =
      process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(
    `Missing environment variable. Expected one of: ${names.join(", ")}`
  );
}

const supabaseUrl =
  requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL"
  );

const supabaseServiceKey =
  requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY"
  );

// ============================================================
// SUPABASE
// ============================================================

const supabase =
  createClient(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

// ============================================================
// SHARP
// ============================================================

let sharp = null;

try {
  const imported =
    await import("sharp");

  sharp =
    imported.default ||
    imported;

  console.log(
    "✓ sharp found: images will convert to WEBP."
  );
} catch {
  console.log(
    "ℹ sharp not available. Images will still migrate."
  );
}

// ============================================================
// HELPERS
// ============================================================

function isR2Url(value) {
  if (
    typeof value !== "string"
  ) {
    return false;
  }

  const url =
    value.trim();

  return (
    url.includes(".r2.dev/") ||
    url.includes(
      ".r2.cloudflarestorage.com/"
    )
  );
}

function isSupabaseStorageUrl(value) {
  if (
    typeof value !== "string"
  ) {
    return false;
  }

  const url =
    value.trim();

  return (
    /^https?:\/\//i.test(url) &&
    (
      url.includes(
        ".supabase.co/storage/v1/object/"
      ) ||
      url.includes(
        "/storage/v1/object/public/"
      ) ||
      url.includes(
        "/storage/v1/object/sign/"
      )
    )
  );
}

function cleanArray(value) {
  return Array.isArray(value)
    ? value.filter(
        (item) =>
          typeof item === "string" &&
          item.trim()
      )
    : [];
}

function extensionFromType(
  contentType,
  url
) {
  const type =
    String(
      contentType || ""
    ).toLowerCase();

  if (type.includes("webp")) {
    return "webp";
  }

  if (type.includes("png")) {
    return "png";
  }

  if (
    type.includes("jpeg") ||
    type.includes("jpg")
  ) {
    return "jpg";
  }

  try {
    const pathname =
      new URL(url).pathname.toLowerCase();

    const match =
      pathname.match(
        /\.(webp|png|jpg|jpeg)$/
      );

    if (match) {
      return match[1] === "jpeg"
        ? "jpg"
        : match[1];
    }
  } catch {}

  return "jpg";
}

function mimeForExtension(extension) {
  if (extension === "webp") {
    return "image/webp";
  }

  if (extension === "png") {
    return "image/png";
  }

  return "image/jpeg";
}

function safeId() {
  return crypto
    .randomBytes(8)
    .toString("hex");
}

// ============================================================
// OPTIMIZE
// ============================================================

async function optimizeImage(
  bytes,
  originalContentType,
  oldUrl
) {
  if (!sharp) {
    const extension =
      extensionFromType(
        originalContentType,
        oldUrl
      );

    return {
      bytes,
      extension,
      contentType:
        originalContentType ||
        mimeForExtension(extension),
    };
  }

  try {
    const optimized =
      await sharp(
        bytes,
        {
          failOn: "none",
          limitInputPixels:
            80_000_000,
        }
      )
        .rotate()
        .resize({
          width: 1200,
          height: 1500,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          quality: 89,
          effort: 4,
        })
        .toBuffer();

    return {
      bytes: optimized,
      extension: "webp",
      contentType: "image/webp",
    };

  } catch (error) {
    console.warn(
      `WEBP conversion failed: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );

    const extension =
      extensionFromType(
        originalContentType,
        oldUrl
      );

    return {
      bytes,
      extension,
      contentType:
        originalContentType ||
        mimeForExtension(extension),
    };
  }
}

// ============================================================
// CURL UPLOAD
// ============================================================

async function uploadUsingCurl({
  bytes,
  extension,
  contentType,
  folder,
}) {
  const tempDir =
    path.join(
      os.tmpdir(),
      "ncs-r2-migration"
    );

  fs.mkdirSync(
    tempDir,
    {
      recursive: true,
    }
  );

  const tempFile =
    path.join(
      tempDir,
      `migration-${Date.now()}-${safeId()}.${extension}`
    );

  fs.writeFileSync(
    tempFile,
    bytes
  );

  try {
    const args = [
      "--silent",
      "--show-error",
      "--fail-with-body",
      "--location",
      "--max-time",
      "120",

      "-X",
      "POST",

      "-H",
      "Accept: application/json",

      "-F",
      `folder=${folder}`,

      "-F",
      `file=@${tempFile};type=${contentType}`,

      WEBSITE_R2_UPLOAD_URL,
    ];

    const {
      stdout,
      stderr,
    } =
      await execFileAsync(
        "curl.exe",
        args,
        {
          windowsHide: true,
          maxBuffer:
            10 * 1024 * 1024,
        }
      );

    const responseText =
      String(
        stdout || ""
      ).trim();

    if (!responseText) {
      throw new Error(
        stderr ||
        "Website upload returned an empty response."
      );
    }

    let json;

    try {
      json =
        JSON.parse(
          responseText
        );
    } catch {
      throw new Error(
        `Invalid website response: ${responseText.slice(0, 500)}`
      );
    }

    if (
      json?.success === false
    ) {
      throw new Error(
        json?.error ||
        json?.message ||
        "Website R2 upload failed."
      );
    }

    const url =
      String(
        json?.url || ""
      ).trim();

    if (!url) {
      throw new Error(
        `Upload completed but URL missing. Response: ${responseText.slice(0, 500)}`
      );
    }

    return url;

  } catch (error) {
    const stdout =
      error?.stdout
        ? String(error.stdout).trim()
        : "";

    const stderr =
      error?.stderr
        ? String(error.stderr).trim()
        : "";

    let message =
      error instanceof Error
        ? error.message
        : String(error);

    if (stdout) {
      message += ` | ${stdout}`;
    }

    if (stderr) {
      message += ` | ${stderr}`;
    }

    throw new Error(message);

  } finally {
    try {
      fs.unlinkSync(tempFile);
    } catch {}
  }
}

// ============================================================
// CACHE
// ============================================================

const migratedCache =
  new Map();

// ============================================================
// MIGRATE ONE URL
// ============================================================

async function migrateOneUrl(
  oldUrl,
  folder
) {
  const normalized =
    String(
      oldUrl || ""
    ).trim();

  if (!normalized) {
    return {
      changed: false,
      url: normalized,
      reason: "empty",
    };
  }

  if (
    isR2Url(normalized)
  ) {
    return {
      changed: false,
      url: normalized,
      reason: "already-r2",
    };
  }

  if (
    !isSupabaseStorageUrl(
      normalized
    )
  ) {
    return {
      changed: false,
      url: normalized,
      reason: "not-supabase",
    };
  }

  if (
    migratedCache.has(
      normalized
    )
  ) {
    return {
      changed: true,
      url:
        migratedCache.get(
          normalized
        ),
      reason: "cached",
    };
  }

  if (!APPLY) {
    return {
      changed: true,
      url: normalized,
      reason: "dry-run",
    };
  }

  const response =
    await fetch(
      normalized,
      {
        redirect: "follow",
        cache: "no-store",
      }
    );

  if (!response.ok) {
    throw new Error(
      `Supabase download failed: HTTP ${response.status}`
    );
  }

  const originalContentType =
    response.headers.get(
      "content-type"
    ) || "";

  const originalBytes =
    Buffer.from(
      await response.arrayBuffer()
    );

  if (!originalBytes.length) {
    throw new Error(
      "Supabase image is empty."
    );
  }

  const optimized =
    await optimizeImage(
      originalBytes,
      originalContentType,
      normalized
    );

  const newUrl =
    await uploadUsingCurl({
      bytes:
        optimized.bytes,

      extension:
        optimized.extension,

      contentType:
        optimized.contentType,

      folder,
    });

  migratedCache.set(
    normalized,
    newUrl
  );

  return {
    changed: true,
    url: newUrl,
    reason: "migrated",

    oldBytes:
      originalBytes.length,

    newBytes:
      optimized.bytes.length,
  };
}

// ============================================================
// SINGLE FIELD
// ============================================================

async function migrateScalarField({
  table,
  rowId,
  field,
  oldUrl,
  folder,
}) {
  const result =
    await migrateOneUrl(
      oldUrl,
      folder
    );

  if (!result.changed) {
    return result;
  }

  if (!APPLY) {
    return result;
  }

  const {
    error,
  } =
    await supabase
      .from(table)
      .update({
        [field]:
          result.url,
      })
      .eq(
        "id",
        rowId
      );

  if (error) {
    throw error;
  }

  return result;
}

// ============================================================
// ARRAY FIELD
// ============================================================

async function migrateArrayField({
  table,
  rowId,
  field,
  values,
  folder,
}) {
  const original =
    cleanArray(values);

  if (!original.length) {
    return {
      changed: false,
      values: original,
    };
  }

  let changed = false;
  const migrated = [];

  for (
    let i = 0;
    i < original.length;
    i += 1
  ) {
    const result =
      await migrateOneUrl(
        original[i],
        `${folder}/${i + 1}`
      );

    migrated.push(
      result.url
    );

    if (
      result.changed
    ) {
      changed = true;
    }
  }

  if (!changed) {
    return {
      changed: false,
      values: original,
    };
  }

  if (APPLY) {
    const {
      error,
    } =
      await supabase
        .from(table)
        .update({
          [field]:
            migrated,
        })
        .eq(
          "id",
          rowId
        );

    if (error) {
      throw error;
    }
  }

  return {
    changed: true,
    values: migrated,
  };
}

// ============================================================
// FETCH ROWS
// ============================================================

async function fetchAllRows(
  table,
  columns
) {
  const rows = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const {
      data,
      error,
    } =
      await supabase
        .from(table)
        .select(columns)
        .range(
          from,
          from + pageSize - 1
        )
        .order(
          "id",
          {
            ascending: true,
          }
        );

    if (error) {
      throw error;
    }

    const page =
      data || [];

    rows.push(
      ...page
    );

    if (
      page.length <
      pageSize
    ) {
      break;
    }

    from +=
      pageSize;
  }

  return rows;
}

// ============================================================
// STATS
// ============================================================

const stats = {
  rows: 0,
  candidates: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
};

let processed = 0;

function canContinue() {
  return (
    processed <
    LIMIT
  );
}

function logResult(
  label,
  result
) {
  if (
    !result.changed
  ) {
    stats.skipped += 1;
    return;
  }

  stats.candidates += 1;
  processed += 1;

  if (!APPLY) {
    console.log(
      `DRY  ${label}`
    );

    return;
  }

  stats.updated += 1;

  const sizeText =
    result.oldBytes != null &&
    result.newBytes != null
      ? ` (${Math.round(
          result.oldBytes / 1024
        )} KB -> ${Math.round(
          result.newBytes / 1024
        )} KB)`
      : "";

  console.log(
    `OK   ${label}${sizeText}`
  );
}

// ============================================================
// MAIN
// ============================================================

async function run() {
  console.log("");
  console.log(
    "============================================"
  );

  console.log(
    "NEW CITY STYLE"
  );

  console.log(
    "SUPABASE -> R2 MIGRATION"
  );

  console.log(
    "UPLOAD METHOD: curl.exe -> WEBSITE API"
  );

  console.log(
    "============================================"
  );

  console.log("");

  console.log(
    `Mode: ${
      APPLY
        ? "APPLY"
        : "DRY RUN"
    }`
  );

  console.log(
    `Limit: ${
      Number.isFinite(LIMIT)
        ? LIMIT
        : "unlimited"
    }`
  );

  console.log(
    `Upload API: ${WEBSITE_R2_UPLOAD_URL}`
  );

  console.log(
    "Supabase delete: DISABLED"
  );

  console.log("");

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  const products =
    await fetchAllRows(
      "products",
      "id,image,image_url,images,gallery_images,lifestyle_images,social_preview_url"
    );

  const variants =
    await fetchAllRows(
      "product_variants",
      "id,main_image,gallery_images"
    );

  const designUnits =
    await fetchAllRows(
      "product_design_units",
      "id,image_url"
    );

  const posSaleItems =
    await fetchAllRows(
      "pos_sale_items",
      "id,product_image"
    );

  const categories =
    await fetchAllRows(
      "categories",
      "id,image_url"
    );

  const brandingSettings =
    await fetchAllRows(
      "branding_settings",
      "id,logo_url,favicon_url"
    );

  // ==========================================================
  // PRODUCTS
  // ==========================================================

  for (const row of products) {
    if (!canContinue()) {
      break;
    }

    stats.rows += 1;

    try {
      const main =
        await migrateScalarField({
          table:
            "products",

          rowId:
            row.id,

          field:
            "image",

          oldUrl:
            row.image,

          folder:
            `products/migrated/products/${row.id}/main`,
        });

      logResult(
        `products#${row.id}.image`,
        main
      );

      if (!canContinue()) {
        break;
      }

      const legacyImageUrl =
        await migrateScalarField({
          table:
            "products",

          rowId:
            row.id,

          field:
            "image_url",

          oldUrl:
            row.image_url,

          folder:
            `products/migrated/products/${row.id}/legacy-image-url`,
        });

      logResult(
        `products#${row.id}.image_url`,
        legacyImageUrl
      );

      if (!canContinue()) {
        break;
      }

      const social =
        await migrateScalarField({
          table:
            "products",

          rowId:
            row.id,

          field:
            "social_preview_url",

          oldUrl:
            row.social_preview_url,

          folder:
            `products/migrated/products/${row.id}/social`,
        });

      logResult(
        `products#${row.id}.social_preview_url`,
        social
      );

      if (!canContinue()) {
        break;
      }

      const legacyImages =
        await migrateArrayField({
          table:
            "products",

          rowId:
            row.id,

          field:
            "images",

          values:
            row.images,

          folder:
            `products/migrated/products/${row.id}/legacy-images`,
        });

      if (legacyImages.changed) {
        stats.candidates += 1;
        processed += 1;

        if (APPLY) {
          stats.updated += 1;
        }

        console.log(
          `${APPLY ? "OK  " : "DRY "} products#${row.id}.images`
        );
      }

      if (!canContinue()) {
        break;
      }

      const gallery =
        await migrateArrayField({
          table:
            "products",

          rowId:
            row.id,

          field:
            "gallery_images",

          values:
            row.gallery_images,

          folder:
            `products/migrated/products/${row.id}/gallery`,
        });

      if (gallery.changed) {
        stats.candidates += 1;
        processed += 1;

        if (APPLY) {
          stats.updated += 1;
        }

        console.log(
          `${APPLY ? "OK  " : "DRY "} products#${row.id}.gallery_images`
        );
      }

      if (!canContinue()) {
        break;
      }

      const lifestyle =
        await migrateArrayField({
          table:
            "products",

          rowId:
            row.id,

          field:
            "lifestyle_images",

          values:
            row.lifestyle_images,

          folder:
            `products/migrated/products/${row.id}/lifestyle`,
        });

      if (lifestyle.changed) {
        stats.candidates += 1;
        processed += 1;

        if (APPLY) {
          stats.updated += 1;
        }

        console.log(
          `${APPLY ? "OK  " : "DRY "} products#${row.id}.lifestyle_images`
        );
      }

    } catch (error) {
      stats.failed += 1;

      console.error(
        `FAIL products#${row.id}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }
  }

  // ==========================================================
  // VARIANTS
  // ==========================================================

  for (const row of variants) {
    if (!canContinue()) {
      break;
    }

    stats.rows += 1;

    try {
      const main =
        await migrateScalarField({
          table:
            "product_variants",

          rowId:
            row.id,

          field:
            "main_image",

          oldUrl:
            row.main_image,

          folder:
            `products/migrated/variants/${row.id}/main`,
        });

      logResult(
        `product_variants#${row.id}.main_image`,
        main
      );

      if (!canContinue()) {
        break;
      }

      const gallery =
        await migrateArrayField({
          table:
            "product_variants",

          rowId:
            row.id,

          field:
            "gallery_images",

          values:
            row.gallery_images,

          folder:
            `products/migrated/variants/${row.id}/gallery`,
        });

      if (gallery.changed) {
        stats.candidates += 1;
        processed += 1;

        if (APPLY) {
          stats.updated += 1;
        }

        console.log(
          `${APPLY ? "OK  " : "DRY "} product_variants#${row.id}.gallery_images`
        );
      }

    } catch (error) {
      stats.failed += 1;

      console.error(
        `FAIL product_variants#${row.id}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }
  }

  // ==========================================================
  // DESIGN UNITS
  // ==========================================================

  for (const row of designUnits) {
    if (!canContinue()) {
      break;
    }

    stats.rows += 1;

    try {
      const result =
        await migrateScalarField({
          table:
            "product_design_units",

          rowId:
            row.id,

          field:
            "image_url",

          oldUrl:
            row.image_url,

          folder:
            `products/migrated/design-units/${row.id}`,
        });

      logResult(
        `product_design_units#${row.id}.image_url`,
        result
      );

    } catch (error) {
      stats.failed += 1;

      console.error(
        `FAIL product_design_units#${row.id}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }
  }

  // ==========================================================
  // POS SALE ITEM IMAGES
  // ==========================================================

  for (const row of posSaleItems) {
    if (!canContinue()) {
      break;
    }

    stats.rows += 1;

    try {
      const result =
        await migrateScalarField({
          table:
            "pos_sale_items",

          rowId:
            row.id,

          field:
            "product_image",

          oldUrl:
            row.product_image,

          folder:
            `products/migrated/pos-sale-items/${row.id}`,
        });

      logResult(
        `pos_sale_items#${row.id}.product_image`,
        result
      );

    } catch (error) {
      stats.failed += 1;

      console.error(
        `FAIL pos_sale_items#${row.id}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }
  }

  // ==========================================================
  // CATEGORY IMAGES
  // ==========================================================

  for (const row of categories) {
    if (!canContinue()) {
      break;
    }

    stats.rows += 1;

    try {
      const result =
        await migrateScalarField({
          table:
            "categories",

          rowId:
            row.id,

          field:
            "image_url",

          oldUrl:
            row.image_url,

          folder:
            `categories/migrated/${row.id}`,
        });

      logResult(
        `categories#${row.id}.image_url`,
        result
      );

    } catch (error) {
      stats.failed += 1;

      console.error(
        `FAIL categories#${row.id}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }
  }

  // ==========================================================
  // BRANDING LOGO + FAVICON
  // ==========================================================

  for (const row of brandingSettings) {
    if (!canContinue()) {
      break;
    }

    stats.rows += 1;

    try {
      const logoResult =
        await migrateScalarField({
          table:
            "branding_settings",

          rowId:
            row.id,

          field:
            "logo_url",

          oldUrl:
            row.logo_url,

          folder:
            `branding/migrated/${row.id}/logo`,
        });

      logResult(
        `branding_settings#${row.id}.logo_url`,
        logoResult
      );

      if (!canContinue()) {
        break;
      }

      const faviconResult =
        await migrateScalarField({
          table:
            "branding_settings",

          rowId:
            row.id,

          field:
            "favicon_url",

          oldUrl:
            row.favicon_url,

          folder:
            `branding/migrated/${row.id}/favicon`,
        });

      logResult(
        `branding_settings#${row.id}.favicon_url`,
        faviconResult
      );

    } catch (error) {
      stats.failed += 1;

      console.error(
        `FAIL branding_settings#${row.id}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }
  }

  // ==========================================================
  // SUMMARY
  // ==========================================================

  console.log("");
  console.log(
    "================ SUMMARY ================"
  );

  console.log(
    `Rows scanned: ${stats.rows}`
  );

  console.log(
    `Migration candidates: ${stats.candidates}`
  );

  console.log(
    `Fields updated: ${
      APPLY
        ? stats.updated
        : 0
    }`
  );

  console.log(
    `Skipped: ${stats.skipped}`
  );

  console.log(
    `Failed: ${stats.failed}`
  );

  console.log(
    "========================================="
  );

  console.log("");

  if (!APPLY) {
    console.log(
      "DRY RUN completed. Nothing changed."
    );

    console.log("");

    console.log(
      "Test command:"
    );

    console.log(
      "node scripts/migrate-supabase-images-to-r2.mjs --apply --limit=5"
    );

  } else {
    console.log(
      "Migration finished."
    );

    console.log(
      "Old Supabase images were NOT deleted."
    );
  }
}

// ============================================================
// START
// ============================================================

run().catch(
  (error) => {
    console.error("");

    console.error(
      "Migration stopped:"
    );

    console.error(
      error instanceof Error
        ? error.stack ||
          error.message
        : error
    );

    process.exitCode = 1;
  }
);