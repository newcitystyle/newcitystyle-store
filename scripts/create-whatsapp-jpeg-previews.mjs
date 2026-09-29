#!/usr/bin/env node

/**
 * NEW CITY STYLE
 * Permanent WhatsApp JPEG Preview Generator • 2036
 *
 * Existing product WebP images remain untouched.
 * This script creates one JPEG preview for WhatsApp and updates ONLY:
 *   products.social_preview_url
 *
 * DRY RUN:
 *   node scripts/create-whatsapp-jpeg-previews.mjs
 *
 * APPLY:
 *   node scripts/create-whatsapp-jpeg-previews.mjs --apply
 *
 * OPTIONAL LIMIT:
 *   node scripts/create-whatsapp-jpeg-previews.mjs --apply --limit=10
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const APPLY = process.argv.includes("--apply");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = limitArg
  ? Math.max(1, Number(limitArg.split("=")[1]) || 1)
  : Number.POSITIVE_INFINITY;

const WEBSITE_R2_UPLOAD_URL =
  process.env.NCS_R2_UPLOAD_URL?.trim() ||
  "https://www.newcitystyle.store/api/r2/upload";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const text = fs.readFileSync(filePath, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

function requireEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }

  throw new Error(
    `Missing environment variable. Expected one of: ${names.join(", ")}`
  );
}

const supabaseUrl = requireEnv(
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL"
);

const supabaseServiceKey = requireEnv(
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY"
);

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

function cleanStrings(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function imageCandidates(product) {
  return Array.from(
    new Set(
      [
        product.image_url,
        product.image,
        ...cleanStrings(product.images),
        ...cleanStrings(product.gallery_images),
      ]
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => /^https?:\/\//i.test(value))
    )
  );
}

function isPermanentSafePreview(value) {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const url = new URL(value.trim());
    const pathname = url.pathname.toLowerCase();

    return (
      url.protocol === "https:" &&
      (
        pathname.endsWith(".jpg") ||
        pathname.endsWith(".jpeg") ||
        pathname.endsWith(".png")
      )
    );
  } catch {
    return false;
  }
}

async function fetchSourceImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept:
          "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,*/*;q=0.1",
        "User-Agent":
          "NEW-CITY-STYLE-WhatsApp-Preview-Generator/2036",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Image download HTTP ${response.status}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());

    if (!bytes.length) {
      throw new Error("Downloaded image is empty.");
    }

    if (bytes.length > 15 * 1024 * 1024) {
      throw new Error("Downloaded image exceeds 15 MB.");
    }

    return bytes;
  } finally {
    clearTimeout(timer);
  }
}

async function makeJpeg(bytes) {
  let output = await sharp(bytes, {
    failOn: "none",
    limitInputPixels: 80_000_000,
  })
    .rotate()
    .resize({
      width: 1200,
      height: 1500,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({
      background: "#ffffff",
    })
    .jpeg({
      quality: 88,
      mozjpeg: true,
    })
    .toBuffer();

  if (output.length > 4_500_000) {
    output = await sharp(bytes, {
      failOn: "none",
      limitInputPixels: 80_000_000,
    })
      .rotate()
      .resize({
        width: 1000,
        height: 1250,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({
        background: "#ffffff",
      })
      .jpeg({
        quality: 78,
        mozjpeg: true,
      })
      .toBuffer();
  }

  if (output.length > 4_500_000) {
    throw new Error("JPEG preview is still too large.");
  }

  return output;
}

async function uploadJpeg(productId, jpegBytes) {
  const form = new FormData();

  form.append(
    "file",
    new Blob([jpegBytes], { type: "image/jpeg" }),
    `whatsapp-product-${productId}.jpg`
  );

  form.append(
    "folder",
    `products/whatsapp-previews/${productId}`
  );

  const response = await fetch(WEBSITE_R2_UPLOAD_URL, {
    method: "POST",
    body: form,
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result?.url) {
    throw new Error(
      result?.error ||
      `R2 upload HTTP ${response.status}`
    );
  }

  return String(result.url);
}

async function main() {
  console.log("");
  console.log("NEW CITY STYLE - WhatsApp JPEG Preview Generator");
  console.log("=================================================");
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log("");

  const { data, error } = await supabase
    .from("products")
    .select(
      "id,name,image,image_url,images,gallery_images,social_preview_url,is_active,sell_online"
    )
    .eq("is_active", true)
    .eq("sell_online", true)
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Unable to load products: ${error.message}`);
  }

  const products = Array.isArray(data) ? data : [];

  let inspected = 0;
  let alreadySafe = 0;
  let converted = 0;
  let skippedNoImage = 0;
  let failed = 0;

  for (const product of products) {
    if (inspected >= LIMIT) break;
    inspected += 1;

    const label =
      `[${product.id}] ${product.name || "Unnamed product"}`;

    if (isPermanentSafePreview(product.social_preview_url)) {
      alreadySafe += 1;
      console.log(`SKIP SAFE  ${label}`);
      continue;
    }

    const source = imageCandidates(product)[0];

    if (!source) {
      skippedNoImage += 1;
      console.log(`NO IMAGE   ${label}`);
      continue;
    }

    if (!APPLY) {
      console.log(`WOULD MAKE ${label}`);
      console.log(`           ${source}`);
      continue;
    }

    try {
      console.log(`CREATE     ${label}`);

      const sourceBytes = await fetchSourceImage(source);
      const jpegBytes = await makeJpeg(sourceBytes);
      const jpegUrl = await uploadJpeg(product.id, jpegBytes);

      const { error: updateError } = await supabase
        .from("products")
        .update({
          social_preview_url: jpegUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (updateError) {
        throw new Error(
          `DB update failed: ${updateError.message}`
        );
      }

      converted += 1;
      console.log(`OK JPEG    ${jpegUrl}`);

      await new Promise((resolve) => setTimeout(resolve, 120));
    } catch (error) {
      failed += 1;
      console.error(
        `FAILED     ${label}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  console.log("");
  console.log("SUMMARY");
  console.log("-------");
  console.log(`Inspected:    ${inspected}`);
  console.log(`Already safe: ${alreadySafe}`);
  console.log(`Converted:    ${converted}`);
  console.log(`No image:     ${skippedNoImage}`);
  console.log(`Failed:       ${failed}`);

  if (!APPLY) {
    console.log("");
    console.log("DRY RUN ONLY - nothing was changed.");
    console.log(
      "Run with --apply when ready to create permanent JPEG previews."
    );
  }
}

main().catch((error) => {
  console.error("");
  console.error(
    error instanceof Error
      ? error.stack || error.message
      : String(error)
  );
  process.exitCode = 1;
});
