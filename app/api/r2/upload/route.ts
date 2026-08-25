import { NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function safeSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .slice(0, 220);
}

function safeFileBase(value: string) {
  return value
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "image";
}

function extensionFor(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp"].includes(ext)) return ext;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function encodeObjectKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const requestedFolder = String(form.get("folder") || "products/misc");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file received." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only JPG, PNG and WEBP images are allowed." },
        { status: 400 },
      );
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Each image must be smaller than 8 MB." },
        { status: 400 },
      );
    }

    const accountId = requireEnv("R2_ACCOUNT_ID");
    const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
    const bucket = requireEnv("R2_BUCKET_NAME");
    const publicBaseUrl = requireEnv("R2_PUBLIC_BASE_URL").replace(/\/$/, "");

    const folder = safeSegment(requestedFolder) || "products/misc";
    const key = `${folder}/${safeFileBase(file.name)}-${Date.now()}-${crypto
      .randomUUID()
      .slice(0, 8)}.${extensionFor(file)}`;

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const bytes = Buffer.from(await file.arrayBuffer());

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    return NextResponse.json({
      url: `${publicBaseUrl}/${encodeObjectKey(key)}`,
      key,
    });
  } catch (error) {
    console.error("R2 upload failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to upload image to R2.",
      },
      { status: 500 },
    );
  }
}