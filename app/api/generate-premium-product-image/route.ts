import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
) {
  const source =
    request.nextUrl
      .searchParams
      .get("src")
      ?.trim() || "";

  if (
    !source ||
    !isSafeHttpUrl(source)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "A valid src URL is required.",
      },
      {
        status: 400,
      },
    );
  }

  let sharpRuntime:
    typeof import("sharp").default;

  try {
    const sharpModule =
      await import("sharp");

    sharpRuntime =
      sharpModule.default;
  } catch (error) {
    console.error(
      "NCS PRODUCT IMAGE PROXY: sharp unavailable",
      error instanceof Error
        ? error.message
        : String(error),
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Image converter unavailable.",
      },
      {
        status: 500,
      },
    );
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      15000,
    );

  try {
    const response =
      await fetch(
        source,
        {
          method: "GET",
          redirect: "follow",
          headers: {
            Accept:
              "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,*/*;q=0.1",
            "User-Agent":
              "NEW-CITY-STYLE-WhatsApp-Image-Proxy/15.3",
          },
          cache: "no-store",
          signal:
            controller.signal,
        },
      );

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Source image returned HTTP ${response.status}.`,
        },
        {
          status: 502,
        },
      );
    }

    const sourceBytes =
      Buffer.from(
        await response.arrayBuffer(),
      );

    if (
      sourceBytes.length === 0 ||
      sourceBytes.length >
        15 * 1024 * 1024
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Source image is empty or too large.",
        },
        {
          status: 413,
        },
      );
    }

    let jpeg =
      await sharpRuntime(
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
          quality: 86,
          mozjpeg: true,
        })
        .toBuffer();

    if (
      jpeg.length >
      4.5 * 1024 * 1024
    ) {
      jpeg =
        await sharpRuntime(
          sourceBytes,
          {
            failOn: "none",
            limitInputPixels:
              80_000_000,
          },
        )
          .rotate()
          .resize({
            width: 900,
            height: 1200,
            fit: "inside",
            withoutEnlargement:
              true,
          })
          .flatten({
            background:
              "#ffffff",
          })
          .jpeg({
            quality: 72,
            mozjpeg: true,
          })
          .toBuffer();
    }

    if (
      jpeg.length === 0 ||
      jpeg.length >
        5 * 1024 * 1024
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Converted image is invalid.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * Content-Disposition is intentionally inline.
     * Meta needs a plain, publicly retrievable image/jpeg response.
     */
    return new NextResponse(
      new Uint8Array(jpeg),
      {
        status: 200,
        headers: {
          "Content-Type":
            "image/jpeg",
          "Content-Length":
            String(
              jpeg.length,
            ),
          "Content-Disposition":
            'inline; filename="ncs-product.jpg"',
          "Cache-Control":
            "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (error) {
    console.error(
      "NCS PRODUCT IMAGE PROXY FAILED:",
      error instanceof Error
        ? error.message
        : String(error),
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Unable to prepare product image.",
      },
      {
        status: 502,
      },
    );
  } finally {
    clearTimeout(
      timeout,
    );
  }
}
