import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "store-assets";
const FOLDER = "marketing/creatives";

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  /*
   * IMPORTANT:
   * Keep the Service Role key only in Vercel/server.
   * Never put it inside Android or public frontend code.
   *
   * If SERVICE_ROLE is not configured yet,
   * this route can try the anon key, but Storage RLS
   * may reject uploads.
   */
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured"
    );
  }

  if (!supabaseKey) {
    throw new Error(
      "Supabase server key is not configured"
    );
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    supabaseKey,
  };
}

function safePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function extensionFromType(contentType: string) {
  const normalized =
    contentType.toLowerCase();

  if (normalized.includes("png")) {
    return "png";
  }

  if (normalized.includes("webp")) {
    return "webp";
  }

  return "jpg";
}

export async function GET() {
  return NextResponse.json({
    success: true,
    service:
      "NEW CITY STYLE Marketing Creative Upload",
    bucket: BUCKET,
  });
}

export async function POST(
  request: NextRequest
) {
  try {
    const formData =
      await request.formData();

    const image =
      formData.get("image");

    const titleValue =
      formData.get("title");

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Creative image is required",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !image.type.startsWith("image/")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Uploaded file must be an image",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Keep creative uploads reasonably small.
     * 12 MB is more than enough for our
     * 1080 x 1350 generated JPG.
     */
    const maxBytes =
      12 * 1024 * 1024;

    if (image.size > maxBytes) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Creative image is too large",
        },
        {
          status: 413,
        }
      );
    }

    const {
      supabaseUrl,
      supabaseKey,
    } = getSupabaseConfig();

    const title =
      typeof titleValue === "string"
        ? safePart(titleValue)
        : "";

    const extension =
      extensionFromType(
        image.type || "image/jpeg"
      );

    const timestamp =
      Date.now();

    const random =
      crypto.randomUUID()
        .replace(/-/g, "")
        .slice(0, 10);

    const filename =
      title
        ? `${title}-${timestamp}-${random}.${extension}`
        : `new-city-style-${timestamp}-${random}.${extension}`;

    const storagePath =
      `${FOLDER}/${filename}`;

    const bytes =
      await image.arrayBuffer();

    /*
     * Supabase Storage REST upload.
     *
     * We use upsert=false because every
     * creative has a unique filename.
     */
    const uploadResponse =
      await fetch(
        `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`,
        {
          method: "POST",

          headers: {
            apikey: supabaseKey,

            Authorization:
              `Bearer ${supabaseKey}`,

            "Content-Type":
              image.type ||
              "image/jpeg",

            "x-upsert":
              "false",
          },

          body: bytes,

          cache: "no-store",
        }
      );

    if (!uploadResponse.ok) {
      const errorText =
        await uploadResponse.text();

      console.error(
        "Creative storage upload failed:",
        uploadResponse.status,
        errorText
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to upload creative image",
          details:
            errorText.slice(
              0,
              500
            ),
        },
        {
          status:
            uploadResponse.status,
        }
      );
    }

    const publicUrl =
      `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;

    return NextResponse.json({
      success: true,

      message:
        "Creative uploaded successfully",

      bucket: BUCKET,

      path:
        storagePath,

      imageUrl:
        publicUrl,
    });
  } catch (error) {
    console.error(
      "Marketing creative upload error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to upload creative",
      },
      {
        status: 500,
      }
    );
  }
}