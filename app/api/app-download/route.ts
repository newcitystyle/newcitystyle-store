import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APK_FILE_NAME = "NEW_CITY_STYLE.apk";

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "";
  }

  return cfIp || realIp || "";
}

function createVisitorHash(ip: string, userAgent: string) {
  const value = `${ip}|${userAgent}`;

  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

async function trackDownload(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn("NCS download tracking skipped: Supabase env missing.");
      return;
    }

    const userAgent = request.headers.get("user-agent") || "unknown";
    const ip = getClientIp(request);

    const visitorHash = createVisitorHash(ip, userAgent);

    const url = new URL(request.url);
    const source =
      url.searchParams.get("source")?.trim() ||
      request.headers.get("referer") ||
      "direct";

    const response = await fetch(
      `${supabaseUrl}/rest/v1/app_download_events`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          source,
          app_version: "2.0.0",
          user_agent: userAgent,
          visitor_hash: visitorHash,
          download_success: true,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "NCS download tracking failed:",
        response.status,
        errorText,
      );
    }
  } catch (error) {
    console.error("NCS download tracking exception:", error);
  }
}

export async function GET(request: Request) {
  try {
    const apkPath = path.join(
      process.cwd(),
      "public",
      "downloads",
      "new-city-style.apk",
    );

    const apk = await fs.readFile(apkPath);

    await trackDownload(request);

    return new Response(apk, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="${APK_FILE_NAME}"`,
        "Content-Length": String(apk.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch (error) {
    console.error("NCS APK download failed", error);

    return Response.json(
      {
        ok: false,
        error: "NEW CITY STYLE app file is temporarily unavailable.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}