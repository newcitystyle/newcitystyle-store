#!/usr/bin/env node

/**
 * NEW CITY STYLE
 * WhatsApp JPEG Preview Backfill
 *
 * PURPOSE
 * -------
 * Finds products updated in the last N days whose social_preview_url
 * is missing / not a JPG, converts the best available catalogue image
 * to WhatsApp-safe JPEG, uploads it through the existing website R2
 * upload API, and saves the permanent JPG URL into:
 *
 *   products.social_preview_url
 *
 * SAFE:
 * - Does NOT change stock.
 * - Does NOT change sales/invoices/customers.
 * - Does NOT delete original WEBP images.
 * - Only updates social_preview_url for successfully converted products.
 *
 * DEFAULT:
 *   Last 2 days only.
 *
 * RUN:
 *   node scripts/backfill-whatsapp-jpeg-previews.mjs
 *
 * OPTIONAL:
 *   node scripts/backfill-whatsapp-jpeg-previews.mjs --days=3
 *   node scripts/backfill-whatsapp-jpeg-previews.mjs --limit=10
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

// ============================================================
// OPTIONS
// ============================================================

const daysArg =
  process.argv.find((arg) =>
    arg.startsWith("--days="),
  );

const limitArg =
  process.argv.find((arg) =>
    arg.startsWith("--limit="),
  );

const DAYS = Math.max(
  1,
  Math.min(
    30,
    Number(
      daysArg?.split("=")[1] || 2,
    ) || 2,
  ),
);

const LIMIT = limitArg
  ? Math.max(
      1,
      Number(
        limitArg.split("=")[1],
      ) || 1,
    )
  : 1000;

// ============================================================
// ENV
// ============================================================

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content =
    fs.readFileSync(
      filePath,
      "utf8",
    );

  for (
    const rawLine of
    content.split(/\r?\n/)
  ) {
    const line =
      rawLine.trim();

    if (
      !line ||
      line.startsWith("#")
    ) {
      continue;
    }

    const match =
      line.match(
        /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
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
      process.env[key] =
        value;
    }
  }
}

loadEnvFile(
  path.resolve(
    process.cwd(),
    ".env.local",
  ),
);

loadEnvFile(
  path.resolve(
    process.cwd(),
    ".env",
  ),
);

function requireAny(
  ...names
) {
  for (
    const name of names
  ) {
    const value =
      process.env[name]
        ?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(
    `Missing environment variable. Expected one of: ${names.join(", ")}`,
  );
}

const SUPABASE_URL =
  requireAny(
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
  );

const SUPABASE_SERVICE_KEY =
  requireAny(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
  );

const SITE_URL =
  (
    process.env.NCS_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://www.newcitystyle.store"
  ).replace(/\/+$/, "");

const R2_UPLOAD_URL =
  `${SITE_URL}/api/r2/upload`;

// ============================================================
// SUPABASE
// ============================================================

const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

// ============================================================
// IMAGE HELPERS
// ============================================================

function firstImage(
  value,
) {
  if (!value) {
    return "";
  }

  if (
    typeof value ===
    "string"
  ) {
    const clean =
      value.trim();

    if (!clean) {
      return "";
    }

    try {
      return firstImage(
        JSON.parse(clean),
      );
    } catch {
      return clean;
    }
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item of value
    ) {
      const found =
        firstImage(item);

      if (found) {
        return found;
      }
    }

    return "";
  }

  if (
    typeof value ===
    "object"
  ) {
    return (
      firstImage(value.url) ||
      firstImage(
        value.image_url,
      ) ||
      firstImage(
        value.image,
      ) ||
      firstImage(
        value.src,
      )
    );
  }

  return "";
}

function bestSourceImage(
  product,
) {
  const candidates = [
    product.image_url,
    product.image,
    product.images,
    product.gallery_images,
    product.social_preview_url,
  ];

  for (
    const candidate of
    candidates
  ) {
    const found =
      firstImage(candidate);

    if (
      found &&
      /^https:\/\//i.test(
        found,
      )
    ) {
      return found;
    }
  }

  return "";
}

function alreadySafeJpeg(
  value,
) {
  const url =
    String(
      value || "",
    ).trim();

  if (!url) {
    return false;
  }

  try {
    const pathname =
      new URL(url)
        .pathname
        .toLowerCase();

    return (
      pathname.endsWith(".jpg") ||
      pathname.endsWith(".jpeg")
    );
  } catch {
    return false;
  }
}

async function downloadImage(
  url,
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      20_000,
    );

  try {
    const response =
      await fetch(
        url,
        {
          method: "GET",
          redirect: "follow",
          cache: "no-store",
          headers: {
            Accept:
              "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,*/*;q=0.1",
            "User-Agent":
              "NEW-CITY-STYLE-WhatsApp-JPEG-Backfill/1.0",
          },
          signal:
            controller.signal,
        },
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`,
      );
    }

    const bytes =
      Buffer.from(
        await response.arrayBuffer(),
      );

    if (
      bytes.length === 0
    ) {
      throw new Error(
        "Downloaded image is empty.",
      );
    }

    if (
      bytes.length >
      15 * 1024 * 1024
    ) {
      throw new Error(
        "Source image is larger than 15 MB.",
      );
    }

    return bytes;
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

async function makeWhatsAppJpeg(
  sourceBytes,
) {
  let output =
    await sharp(
      sourceBytes,
      {
        failOn: "none",
        limitInputPixels:
          80_000_000,
      },
    )
      .rotate()
      .resize({
        width: 1200,
        height: 1500,
        fit: "inside",
        withoutEnlargement:
          true,
      })
      .flatten({
        background:
          "#ffffff",
      })
      .jpeg({
        quality: 88,
        mozjpeg: true,
      })
      .toBuffer();

  /*
   * Keep plenty of room below WhatsApp/Meta image limits.
   */
  if (
    output.length >
    4.5 * 1024 * 1024
  ) {
    output =
      await sharp(
        sourceBytes,
        {
          failOn: "none",
          limitInputPixels:
            80_000_000,
        },
      )
        .rotate()
        .resize({
          width: 1000,
          height: 1250,
          fit: "inside",
          withoutEnlargement:
            true,
        })
        .flatten({
          background:
            "#ffffff",
        })
        .jpeg({
          quality: 76,
          mozjpeg: true,
        })
        .toBuffer();
  }

  return output;
}

async function uploadPreview(
  productId,
  jpegBytes,
) {
  const form =
    new FormData();

  form.append(
    "folder",
    `products/whatsapp-previews/${productId}`,
  );

  form.append(
    "file",
    new Blob(
      [jpegBytes],
      {
        type:
          "image/jpeg",
      },
    ),
    `whatsapp-product-${productId}.jpg`,
  );

  const response =
    await fetch(
      R2_UPLOAD_URL,
      {
        method: "POST",
        body: form,
        headers: {
          Accept:
            "application/json",
        },
      },
    );

  const raw =
    await response.text();

  let data = {};

  try {
    data =
      raw
        ? JSON.parse(raw)
        : {};
  } catch {
    throw new Error(
      `R2 upload returned invalid JSON: ${raw.slice(0, 300)}`,
    );
  }

  if (
    !response.ok ||
    !data.url
  ) {
    throw new Error(
      data.error ||
      data.message ||
      `R2 upload failed with HTTP ${response.status}`,
    );
  }

  return String(
    data.url,
  );
}

// ============================================================
// LOAD TARGET PRODUCTS
// ============================================================

const since =
  new Date(
    Date.now() -
      DAYS *
        24 *
        60 *
        60 *
        1000,
  ).toISOString();

console.log(
  "",
);
console.log(
  "NEW CITY STYLE • WhatsApp JPEG Preview Backfill",
);
console.log(
  `Updated since: ${since}`,
);
console.log(
  `Window: last ${DAYS} day(s)`,
);
console.log(
  `Upload API: ${R2_UPLOAD_URL}`,
);
console.log(
  "",
);

const {
  data: products,
  error: loadError,
} =
  await supabase
    .from("products")
    .select(
      [
        "id",
        "name",
        "image",
        "image_url",
        "images",
        "gallery_images",
        "social_preview_url",
        "updated_at",
      ].join(","),
    )
    .gte(
      "updated_at",
      since,
    )
    .order(
      "updated_at",
      {
        ascending:
          false,
      },
    )
    .limit(
      LIMIT,
    );

if (loadError) {
  throw new Error(
    `Unable to load products: ${loadError.message}`,
  );
}

const targets =
  (products || [])
    .filter(
      (product) =>
        !alreadySafeJpeg(
          product.social_preview_url,
        ),
    );

console.log(
  `Products updated in window: ${(products || []).length}`,
);
console.log(
  `Need WhatsApp JPG preview: ${targets.length}`,
);
console.log(
  "",
);

if (
  targets.length === 0
) {
  console.log(
    "✓ Nothing to convert. All target products already have JPG previews.",
  );

  process.exit(0);
}

// ============================================================
// BACKFILL
// ============================================================

let successCount = 0;
let failedCount = 0;
let noImageCount = 0;

for (
  let index = 0;
  index <
  targets.length;
  index += 1
) {
  const product =
    targets[index];

  const label =
    `[${index + 1}/${targets.length}] #${product.id} ${product.name || "Product"}`;

  const source =
    bestSourceImage(
      product,
    );

  if (!source) {
    noImageCount += 1;

    console.log(
      `${label} -> SKIP: no source image`,
    );

    continue;
  }

  try {
    console.log(
      `${label} -> downloading...`,
    );

    const sourceBytes =
      await downloadImage(
        source,
      );

    const jpegBytes =
      await makeWhatsAppJpeg(
        sourceBytes,
      );

    console.log(
      `${label} -> JPEG ${(jpegBytes.length / 1024).toFixed(0)} KB`,
    );

    const jpegUrl =
      await uploadPreview(
        product.id,
        jpegBytes,
      );

    const {
      error: updateError,
    } =
      await supabase
        .from("products")
        .update({
          social_preview_url:
            jpegUrl,
        })
        .eq(
          "id",
          product.id,
        );

    if (updateError) {
      throw new Error(
        `DB update failed: ${updateError.message}`,
      );
    }

    successCount += 1;

    console.log(
      `${label} -> ✓ ${jpegUrl}`,
    );
  } catch (error) {
    failedCount += 1;

    console.error(
      `${label} -> FAILED: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }
}

console.log(
  "",
);
console.log(
  "========================================",
);
console.log(
  "BACKFILL COMPLETE",
);
console.log(
  `✓ JPEG previews created: ${successCount}`,
);
console.log(
  `⚠ No source image: ${noImageCount}`,
);
console.log(
  `✗ Failed: ${failedCount}`,
);
console.log(
  "========================================",
);
console.log(
  "",
);

if (
  failedCount > 0
) {
  process.exitCode = 1;
}
