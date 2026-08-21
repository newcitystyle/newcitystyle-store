import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_GRAPH_VERSION = "v26.0";

type FacebookApiError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

function getFacebookConfig() {
  const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
  const pageAccessToken =
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();

  const graphVersion =
    process.env.FACEBOOK_GRAPH_VERSION?.trim() ||
    DEFAULT_GRAPH_VERSION;

  if (!pageId) {
    throw new Error(
      "FACEBOOK_PAGE_ID is not configured"
    );
  }

  if (!pageAccessToken) {
    throw new Error(
      "FACEBOOK_PAGE_ACCESS_TOKEN is not configured"
    );
  }

  return {
    pageId,
    pageAccessToken,
    graphVersion,
  };
}

function graphUrl(
  graphVersion: string,
  path: string
) {
  return `https://graph.facebook.com/${graphVersion}/${path}`;
}

async function parseFacebookResponse(
  response: Response
) {
  const text = await response.text();

  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      raw: text,
    };
  }

  if (!response.ok) {
    const fbError =
      (data as FacebookApiError)?.error;

    throw new Error(
      fbError?.message ||
        `Facebook API request failed with HTTP ${response.status}`
    );
  }

  return data;
}

async function publishTextPost({
  pageId,
  pageAccessToken,
  graphVersion,
  message,
}: {
  pageId: string;
  pageAccessToken: string;
  graphVersion: string;
  message: string;
}) {
  const body = new URLSearchParams();

  body.set("message", message);
  body.set("access_token", pageAccessToken);

  const response = await fetch(
    graphUrl(
      graphVersion,
      `${pageId}/feed`
    ),
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    }
  );

  return parseFacebookResponse(response);
}

async function publishPhotoByUrl({
  pageId,
  pageAccessToken,
  graphVersion,
  imageUrl,
  message,
}: {
  pageId: string;
  pageAccessToken: string;
  graphVersion: string;
  imageUrl: string;
  message: string;
}) {
  const body = new URLSearchParams();

  body.set("url", imageUrl);

  if (message.trim()) {
    body.set("caption", message);
  }

  body.set(
    "access_token",
    pageAccessToken
  );

  const response = await fetch(
    graphUrl(
      graphVersion,
      `${pageId}/photos`
    ),
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    }
  );

  return parseFacebookResponse(response);
}

async function publishPhotoFile({
  pageId,
  pageAccessToken,
  graphVersion,
  file,
  message,
}: {
  pageId: string;
  pageAccessToken: string;
  graphVersion: string;
  file: File;
  message: string;
}) {
  const formData =
    new FormData();

  formData.append(
    "source",
    file,
    file.name || "creative.jpg"
  );

  if (message.trim()) {
    formData.append(
      "caption",
      message
    );
  }

  formData.append(
    "access_token",
    pageAccessToken
  );

  const response = await fetch(
    graphUrl(
      graphVersion,
      `${pageId}/photos`
    ),
    {
      method: "POST",
      body: formData,
      cache: "no-store",
    }
  );

  return parseFacebookResponse(response);
}

export async function POST(
  request: NextRequest
) {
  try {
    const {
      pageId,
      pageAccessToken,
      graphVersion,
    } = getFacebookConfig();

    const contentType =
      request.headers
        .get("content-type")
        ?.toLowerCase() || "";

    /*
     * -------------------------------------------------
     * MULTIPART MODE
     * -------------------------------------------------
     *
     * Used by Android Creative Studio.
     *
     * Expected:
     * image   -> generated JPG/PNG creative
     * message -> Facebook caption
     *
     */
    if (
      contentType.includes(
        "multipart/form-data"
      )
    ) {
      const formData =
        await request.formData();

      const image =
        formData.get("image");

      const message =
        String(
          formData.get("message") || ""
        ).trim();

      if (
        image instanceof File &&
        image.size > 0
      ) {
        const result =
          await publishPhotoFile({
            pageId,
            pageAccessToken,
            graphVersion,
            file: image,
            message,
          });

        return NextResponse.json(
          {
            success: true,
            type: "photo",
            message:
              "Facebook Page photo posted successfully",
            facebook: result,
          },
          {
            status: 200,
          }
        );
      }

      /*
       * If multipart request has no image,
       * allow text-only post.
       */
      if (!message) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Image or message is required",
          },
          {
            status: 400,
          }
        );
      }

      const result =
        await publishTextPost({
          pageId,
          pageAccessToken,
          graphVersion,
          message,
        });

      return NextResponse.json(
        {
          success: true,
          type: "text",
          message:
            "Facebook Page post published successfully",
          facebook: result,
        },
        {
          status: 200,
        }
      );
    }

    /*
     * -------------------------------------------------
     * JSON MODE
     * -------------------------------------------------
     *
     * Useful for website/admin testing.
     *
     * Example:
     *
     * {
     *   "message": "Special Offer",
     *   "imageUrl": "https://..."
     * }
     *
     */
    const body =
      await request.json().catch(
        () => ({})
      );

    const message =
      typeof body?.message ===
      "string"
        ? body.message.trim()
        : "";

    const imageUrl =
      typeof body?.imageUrl ===
      "string"
        ? body.imageUrl.trim()
        : "";

    if (
      imageUrl &&
      !/^https?:\/\//i.test(
        imageUrl
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "imageUrl must be a public http/https URL",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Public image URL + caption
     */
    if (imageUrl) {
      const result =
        await publishPhotoByUrl({
          pageId,
          pageAccessToken,
          graphVersion,
          imageUrl,
          message,
        });

      return NextResponse.json(
        {
          success: true,
          type: "photo_url",
          message:
            "Facebook Page photo posted successfully",
          facebook: result,
        },
        {
          status: 200,
        }
      );
    }

    /*
     * Text-only post
     */
    if (message) {
      const result =
        await publishTextPost({
          pageId,
          pageAccessToken,
          graphVersion,
          message,
        });

      return NextResponse.json(
        {
          success: true,
          type: "text",
          message:
            "Facebook Page post published successfully",
          facebook: result,
        },
        {
          status: 200,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Provide message, imageUrl, or multipart image",
      },
      {
        status: 400,
      }
    );
  } catch (error) {
    console.error(
      "Facebook Page Post Error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to publish Facebook Page post",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * Simple health check.
 *
 * Does NOT expose Page ID or token.
 */
export async function GET() {
  const configured =
    Boolean(
      process.env
        .FACEBOOK_PAGE_ID
    ) &&
    Boolean(
      process.env
        .FACEBOOK_PAGE_ACCESS_TOKEN
    );

  return NextResponse.json({
    success: true,
    service:
      "NEW CITY STYLE Facebook Page Posting",
    configured,
  });
}