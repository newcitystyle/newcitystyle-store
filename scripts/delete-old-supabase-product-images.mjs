#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// LOAD ENV
// ============================================================

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const text = fs.readFileSync(filePath, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const match =
      line.match(
        /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/
      );

    if (!match) {
      continue;
    }

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
// CONFIG
// ============================================================

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error(
    "Missing Supabase URL or service-role key."
  );
}

const supabase =
  createClient(
    supabaseUrl,
    serviceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

const BUCKET =
  "store-assets";

const PREFIXES = [
  "collections",
  "homepage",
  "logos",
  "marketing",
  "site-content",
];

// ============================================================
// LIST FILES RECURSIVELY
// ============================================================

async function listFilesRecursively(
  bucket,
  prefix
) {
  const files = [];

  let offset = 0;
  const limit = 100;

  while (true) {
    const {
      data,
      error,
    } =
      await supabase.storage
        .from(bucket)
        .list(
          prefix,
          {
            limit,
            offset,
            sortBy: {
              column: "name",
              order: "asc",
            },
          }
        );

    if (error) {
      throw new Error(
        `${bucket}/${prefix}: ${error.message}`
      );
    }

    const items =
      data || [];

    for (const item of items) {
      const fullPath =
        prefix
          ? `${prefix}/${item.name}`
          : item.name;

      if (item.id) {
        files.push(fullPath);
      } else {
        const nested =
          await listFilesRecursively(
            bucket,
            fullPath
          );

        files.push(
          ...nested
        );
      }
    }

    if (items.length < limit) {
      break;
    }

    offset += limit;
  }

  return files;
}

// ============================================================
// DELETE BATCH
// ============================================================

async function deleteFiles(
  bucket,
  files
) {
  if (!files.length) {
    return 0;
  }

  const batchSize = 100;
  let deleted = 0;

  for (
    let i = 0;
    i < files.length;
    i += batchSize
  ) {
    const batch =
      files.slice(
        i,
        i + batchSize
      );

    const {
      error,
    } =
      await supabase.storage
        .from(bucket)
        .remove(batch);

    if (error) {
      throw new Error(
        `${bucket}: ${error.message}`
      );
    }

    deleted += batch.length;

    console.log(
      `Deleted ${deleted}/${files.length}`
    );
  }

  return deleted;
}

// ============================================================
// CLEAN PREFIX
// ============================================================

async function cleanPrefix(
  prefix
) {
  console.log("");
  console.log(
    `Checking ${BUCKET}/${prefix}/`
  );

  const files =
    await listFilesRecursively(
      BUCKET,
      prefix
    );

  console.log(
    `Files found: ${files.length}`
  );

  if (!files.length) {
    console.log(
      `✓ ${prefix}: already empty`
    );

    return 0;
  }

  const deleted =
    await deleteFiles(
      BUCKET,
      files
    );

  console.log(
    `✓ ${prefix}: ${deleted} files deleted`
  );

  return deleted;
}

// ============================================================
// RUN
// ============================================================

async function run() {
  console.log("");
  console.log(
    "=============================================="
  );

  console.log(
    "NEW CITY STYLE"
  );

  console.log(
    "FINAL SUPABASE STORAGE CLEANUP"
  );

  console.log(
    "=============================================="
  );

  let totalDeleted = 0;

  for (const prefix of PREFIXES) {
    totalDeleted +=
      await cleanPrefix(prefix);
  }

  console.log("");
  console.log(
    "=============================================="
  );

  console.log(
    "FINAL CLEANUP COMPLETE"
  );

  console.log(
    `TOTAL FILES DELETED: ${totalDeleted}`
  );

  console.log(
    "=============================================="
  );

  console.log("");

  console.log(
    "Supabase database/auth/business data were NOT touched."
  );
}

run().catch(
  (error) => {
    console.error("");
    console.error(
      "CLEANUP FAILED:"
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