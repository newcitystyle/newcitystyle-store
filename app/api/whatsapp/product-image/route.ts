import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_WIDTH = 1200;
const MAX_OUTPUT_HEIGHT = 1500;

function cleanBaseUrl(value?: string): string {
  return (value || "").trim().replace(/\/+$/, "");
}

function allowedHosts(): Set<string> {
  const hosts = new Set<string>();

  const candidates = [
    process.env.NCS_SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
    process.env.R2_PUBLIC_BASE_URL,
    process.env.R2_PUBLIC_URL,
  ];

  for (const candidate of candidates) {
    const clean = cleanBaseUrl(candidate);

    if (!clean) {
      continue;
    }

    try {
      hosts.add(
        new URL(clean).hostname.toLowerCase(),
      );
    } catch {
      // Ignore malformed optional environment values.
    }
  }

  hosts.add("www.newcitystyle.store");
  hosts.add("newcitystyle.store");

  return hosts;
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local")
  ) {
    return true;
  }

  if (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host)
  ) {
    return true;
  }

  const match172 =
    host.match(/^172\.(\d+)\./);

  if (match172) {
    const second =
      Number(match172[1]);

    if (
      second >= 16 &&
      second <= 31
    ) {
      return true;
    }
  }

  return false;
}

function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return false;
    }

    const host =
      url.hostname.toLowerCase();

    if (
      !host ||
      isPrivateOrLocalHost(host)
    ) {
      return false;
    }

    const configured =
      allowedHosts();

    if (configured.has(host)) {
      return true;
    }

    /*
     * Existing NEW CITY STYLE catalogue images are also served from
     * Supabase Storage and Cloudflare R2 public hosts.
     */
    return (
      host.endsWith(".supabase.co") ||
      host.endsWith(".r2.dev") ||
      host.endsWith(".r2.cloudflarestorage.com")
    );
  } catch {
    return false;
  }
}

async function readWithLimit(
  response: Response,
): Promise<Buffer> {
  const lengthHeader =
    Number(
      response.headers.get(
        "content-length",
      ) || 0,
    );

  if (
    Number.isFinite(lengthHeader) &&
    lengthHeader >
      MAX_SOURCE_BYTES
  ) {
    throw new Error(
      "Source image is too large.",
    );
  }

  const bytes =
    Buffer.from(
      await response.arrayBuffer(),
    );

  if (
    bytes.length >
    MAX_SOURCE_BYTES
  ) {
    throw new Error(
      "Source image is too large.",
    );
  }

  return bytes;
}

export async function GET(
  request: NextRequest,
) {
  const source =
    request.nextUrl.searchParams
      .get("src")
      ?.trim() ||
    "";

  if (
    !source ||
    !isAllowedImageUrl(source)
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Invalid or unapproved image URL.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        12_000,
      );

    let sourceResponse:
      Response;

    try {
      sourceResponse =
        await fetch(
          source,
          {
            method: "GET",
            redirect:
              "follow",
            headers: {
              Accept:
                "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,*/*;q=0.1",
              "User-Agent":
                "NEW-CITY-STYLE-WhatsApp-Image-Proxy/1.0",
            },
            cache:
              "no-store",
            signal:
              controller.signal,
          },
        );
    } finally {
      clearTimeout(
        timeout,
      );
    }

    if (
      !sourceResponse.ok
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Unable to download source image (HTTP ${sourceResponse.status}).`,
        },
        {
          status: 502,
        },
      );
    }

    const sourceType =
      sourceResponse.headers
        .get("content-type")
        ?.toLowerCase() ||
      "";

    if (
      sourceType &&
      !sourceType.startsWith(
        "image/",
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Source URL did not return an image.",
        },
        {
          status: 415,
        },
      );
    }

    const input =
      await readWithLimit(
        sourceResponse,
      );

    const output =
      await sharp(
        input,
        {
          failOn:
            "none",
          limitInputPixels:
            80_000_000,
        },
      )
        .rotate()
        .resize({
          width:
            MAX_OUTPUT_WIDTH,
          height:
            MAX_OUTPUT_HEIGHT,
          fit:
            "inside",
          withoutEnlargement:
            true,
        })
        .flatten({
          background:
            "#ffffff",
        })
        .jpeg({
          quality:
            88,
          mozjpeg:
            true,
        })
        .toBuffer();

    return new NextResponse(
      output,
      {
        status: 200,
        headers: {
          "Content-Type":
            "image/jpeg",
          "Content-Length":
            String(
              output.length,
            ),
          "Cache-Control":
            "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
          "Content-Disposition":
            'inline; filename="ncs-product.jpg"',
          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (error) {
    console.error(
      "WhatsApp product image conversion failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to convert product image.",
      },
      {
        status: 500,
      },
    );
  }
}
