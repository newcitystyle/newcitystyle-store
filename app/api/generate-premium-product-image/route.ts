import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_IMAGE_MODEL =
  process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";

const CLOUDFLARE_IMAGE_MODELS = [
  "@cf/runwayml/stable-diffusion-v1-5-img2img",
  "@cf/stabilityai/stable-diffusion-xl-base-1.0",
] as const;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

type ProductContext = {
  productId?: number | null;
  variantId?: number | null;
  name?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  gender?: string;
  ageGroup?: string;
  size?: string;
  colour?: string;
  material?: string;
  fabric?: string;
  pattern?: string;
  sleeveType?: string;
  fitType?: string;
  occasion?: string;
  sku?: string;
  barcode?: string;
};

type StudioPreset = {
  id: number;
  name: string;
  description: string;
  backgroundStyle: string;
  bestFor: string;
};

type OpenAiImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

type CloudflareJsonResponse = {
  success?: boolean;
  errors?: Array<
    | string
    | {
        message?: string;
        code?: number | string;
      }
  >;
  messages?: Array<
    | string
    | {
        message?: string;
      }
  >;
  result?:
    | string
    | {
        image?: string;
        output?: string | string[];
      };
};

type ProviderResult = {
  imageUrl: string;
  revisedPrompt?: string;
  model: string;
  provider: "cloudflare" | "openai";
};

class PremiumImageError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "PremiumImageError";
    this.status = status;
  }
}

function cleanText(value: unknown, maxLength = 2000) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function cleanId(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function cleanProductContext(value: unknown): ProductContext {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    productId: cleanId(source.productId),
    variantId: cleanId(source.variantId),
    name: cleanText(source.name, 140),
    brand: cleanText(source.brand, 100),
    category: cleanText(source.category, 80),
    subcategory: cleanText(source.subcategory, 100),
    gender: cleanText(source.gender, 40),
    ageGroup: cleanText(source.ageGroup, 40),
    size: cleanText(source.size, 60),
    colour: cleanText(source.colour ?? source.color, 80),
    material: cleanText(source.material, 120),
    fabric: cleanText(source.fabric, 120),
    pattern: cleanText(source.pattern, 80),
    sleeveType: cleanText(source.sleeveType, 80),
    fitType: cleanText(source.fitType, 80),
    occasion: cleanText(source.occasion, 120),
    sku: cleanText(source.sku, 120),
    barcode: cleanText(source.barcode, 120),
  };
}

function cleanPreset(value: unknown): StudioPreset {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    id: cleanId(source.id) || 1,
    name: cleanText(source.name, 100) || "Royal Boutique Wall",
    description:
      cleanText(source.description, 220) ||
      "Premium boutique product presentation.",
    backgroundStyle:
      cleanText(source.backgroundStyle, 300) ||
      "royal blue boutique wall, soft premium lighting, elegant clean product presentation",
    bestFor:
      cleanText(source.bestFor, 160) ||
      "general fashion e-commerce products",
  };
}

function isSafeImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function buildPremiumPrompt(
  context: ProductContext,
  preset: StudioPreset
) {
  const trustedEntries = Object.entries({
    "Product name": context.name,
    Brand: context.brand,
    Category: context.category,
    Subcategory: context.subcategory,
    Gender: context.gender,
    "Age group": context.ageGroup,
    Size: context.size,
    Colour: context.colour,
    Material: context.material,
    Fabric: context.fabric,
    Pattern: context.pattern,
    "Sleeve type": context.sleeveType,
    "Fit type": context.fitType,
    Occasion: context.occasion,
  }).filter(([, value]) => Boolean(value));

  const trustedRecord = trustedEntries.length
    ? trustedEntries
        .map(([label, value]) => `- ${label}: ${value}`)
        .join("\n")
    : "- No structured product record was supplied.";

  return `
You are the premium e-commerce product-image assistant for NEW CITY STYLE.

TASK:
Transform the supplied source product photo into one premium e-commerce product-only image.

STRICT PRODUCT PRESERVATION RULES:
1. Preserve the exact product identity and overall silhouette.
2. Preserve the original colour, print, checks, embroidery, fabric appearance, collar, sleeves, borders, buttons, stitching and proportions.
3. Do not add or remove garment parts.
4. Do not add a model, mannequin, hands, jewellery, text, logo overlay, price, watermark or promotional badge.
5. Remove only the existing background, floor clutter, unwanted surroundings, visible watermark/tag distractions and poor presentation.
6. Keep the complete product visible and centered.
7. Use realistic clean lighting and a subtle grounding shadow.
8. Make it premium, realistic and suitable for an e-commerce product page.
9. Do not invent packaging, branding or accessories.
10. Keep changes to the garment itself minimal; change the presentation/background, not the product.

BACKGROUND PRESET:
Preset Name: ${preset.name}
Preset Description: ${preset.description}
Preset Background Style: ${preset.backgroundStyle}
Best For: ${preset.bestFor}

TRUSTED PRODUCT RECORD:
${trustedRecord}

FINAL RESULT:
A polished, premium, product-only fashion e-commerce image with the original garment faithfully preserved and the selected background style applied.
`.trim();
}

function buildNegativePrompt() {
  return [
    "changed garment",
    "different colour",
    "different pattern",
    "different print",
    "extra buttons",
    "missing buttons",
    "different collar",
    "different sleeves",
    "different embroidery",
    "extra garment parts",
    "cropped product",
    "model",
    "mannequin",
    "hands",
    "jewellery",
    "text",
    "watermark",
    "logo overlay",
    "price tag",
    "poster",
    "duplicate product",
    "distorted clothing",
  ].join(", ");
}

async function downloadImage(imageUrl: string) {
  let imageResponse: Response;

  try {
    imageResponse = await fetch(imageUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new PremiumImageError(
      "The uploaded source image could not be downloaded.",
      400
    );
  }

  if (!imageResponse.ok) {
    throw new PremiumImageError(
      "The uploaded source image could not be downloaded.",
      400
    );
  }

  const contentLength = Number(
    imageResponse.headers.get("content-length") || 0
  );

  if (contentLength && contentLength > MAX_IMAGE_BYTES) {
    throw new PremiumImageError(
      "The source image must be smaller than 8 MB.",
      413
    );
  }

  const mimeType = (imageResponse.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new PremiumImageError(
      "Only JPG, PNG and WEBP images are supported.",
      415
    );
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  if (!imageBuffer.length) {
    throw new PremiumImageError(
      "The uploaded source image is empty.",
      400
    );
  }

  if (imageBuffer.length > MAX_IMAGE_BYTES) {
    throw new PremiumImageError(
      "The source image must be smaller than 8 MB.",
      413
    );
  }

  return {
    imageBuffer,
    mimeType,
  };
}

function getCloudflareErrorMessage(
  payload: CloudflareJsonResponse | null,
  fallback = "Cloudflare could not generate the premium product image."
) {
  if (!payload) return fallback;

  const errorMessages = Array.isArray(payload.errors)
    ? payload.errors
        .map((item) =>
          typeof item === "string"
            ? item
            : cleanText(item?.message, 800)
        )
        .filter(Boolean)
    : [];

  if (errorMessages.length) {
    return errorMessages.join(" | ");
  }

  const messageTexts = Array.isArray(payload.messages)
    ? payload.messages
        .map((item) =>
          typeof item === "string"
            ? item
            : cleanText(item?.message, 800)
        )
        .filter(Boolean)
    : [];

  if (messageTexts.length) {
    return messageTexts.join(" | ");
  }

  return fallback;
}

function ensureImageDataUrl(value: string) {
  const cleaned = cleanText(value, 20_000_000);

  if (!cleaned) return "";

  if (cleaned.startsWith("data:image/")) {
    return cleaned;
  }

  return `data:image/png;base64,${cleaned}`;
}

async function generateWithCloudflareModel(
  model: string,
  imageBuffer: Buffer,
  prompt: string
): Promise<ProviderResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken =
    process.env.CLOUDFLARE_API_TOKEN?.trim() ||
    process.env.CLOUDFLARE_AUTH_TOKEN?.trim();

  if (!accountId || !apiToken) {
    throw new PremiumImageError(
      "Cloudflare credentials are not configured.",
      500
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
        accountId
      )}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          negative_prompt: buildNegativePrompt(),
          image_b64: imageBuffer.toString("base64"),
          num_steps: 20,
          strength: 0.3,
          guidance: 7.5,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Cloudflare image request failed.";

    throw new PremiumImageError(
      message.toLowerCase().includes("timeout")
        ? `${model} request timed out.`
        : `${model} is temporarily unavailable.`,
      504
    );
  }

  const contentType = (
    response.headers.get("content-type") || ""
  ).toLowerCase();

  if (response.ok && contentType.startsWith("image/")) {
    const outputBuffer = Buffer.from(await response.arrayBuffer());

    if (!outputBuffer.length) {
      throw new PremiumImageError(
        `${model} returned an empty image.`,
        502
      );
    }

    return {
      imageUrl: `data:${contentType};base64,${outputBuffer.toString("base64")}`,
      model,
      provider: "cloudflare",
    };
  }

  let payload: CloudflareJsonResponse | null = null;

  try {
    payload = (await response.json()) as CloudflareJsonResponse;
  } catch {
    throw new PremiumImageError(
      response.ok
        ? `${model} returned an unexpected response.`
        : `${model} returned an unreadable error response.`,
      response.status || 502
    );
  }

  if (!response.ok || payload.success === false) {
    throw new PremiumImageError(
      getCloudflareErrorMessage(
        payload,
        `${model} could not generate the image.`
      ),
      response.status || 502
    );
  }

  let encodedImage = "";

  if (typeof payload.result === "string") {
    encodedImage = payload.result;
  } else if (payload.result && typeof payload.result === "object") {
    encodedImage =
      cleanText(payload.result.image, 20_000_000) ||
      (Array.isArray(payload.result.output)
        ? cleanText(payload.result.output[0], 20_000_000)
        : cleanText(payload.result.output, 20_000_000));
  }

  const resultUrl = ensureImageDataUrl(encodedImage);

  if (!resultUrl) {
    throw new PremiumImageError(
      `${model} returned no generated image.`,
      502
    );
  }

  return {
    imageUrl: resultUrl,
    model,
    provider: "cloudflare",
  };
}

async function generateWithOpenAI(
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string
): Promise<ProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new PremiumImageError(
      "OPENAI_API_KEY is not configured.",
      500
    );
  }

  const formData = new FormData();
  formData.append("model", OPENAI_IMAGE_MODEL);
  formData.append("prompt", prompt);
  formData.append("size", "1024x1536");

  const imageBytes = Uint8Array.from(imageBuffer);

  formData.append(
    "image",
    new Blob([imageBytes], { type: mimeType }),
    `source.${mimeType.split("/")[1] || "png"}`
  );

  let response: Response;

  try {
    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "OpenAI image request failed.";

    throw new PremiumImageError(
      message.toLowerCase().includes("timeout")
        ? "OpenAI premium image request timed out."
        : "OpenAI premium image service is temporarily unavailable.",
      504
    );
  }

  let data: OpenAiImageResponse;

  try {
    data = (await response.json()) as OpenAiImageResponse;
  } catch {
    throw new PremiumImageError(
      "OpenAI returned an unreadable image response.",
      response.status || 502
    );
  }

  if (!response.ok) {
    throw new PremiumImageError(
      cleanText(data.error?.message, 1000) ||
        "OpenAI could not generate the premium product image.",
      response.status || 502
    );
  }

  const result = data.data?.[0];

  if (!result) {
    throw new PremiumImageError(
      "OpenAI returned no generated image.",
      502
    );
  }

  if (result.b64_json) {
    return {
      imageUrl: `data:image/png;base64,${result.b64_json}`,
      revisedPrompt: cleanText(result.revised_prompt, 2000),
      model: OPENAI_IMAGE_MODEL,
      provider: "openai",
    };
  }

  if (result.url) {
    return {
      imageUrl: result.url,
      revisedPrompt: cleanText(result.revised_prompt, 2000),
      model: OPENAI_IMAGE_MODEL,
      provider: "openai",
    };
  }

  throw new PremiumImageError(
    "OpenAI returned an empty generated image result.",
    502
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      imageUrl?: unknown;
      preset?: unknown;
      productContext?: unknown;
    };

    const imageUrl = cleanText(body.imageUrl, 2000);
    const preset = cleanPreset(body.preset);
    const productContext = cleanProductContext(body.productContext);
    const premiumPrompt = buildPremiumPrompt(productContext, preset);

    if (!imageUrl || !isSafeImageUrl(imageUrl)) {
      return NextResponse.json(
        {
          error: "A valid uploaded product image URL is required.",
        },
        { status: 400 }
      );
    }

    const { imageBuffer, mimeType } = await downloadImage(imageUrl);

    const providerErrors: string[] = [];

    for (const model of CLOUDFLARE_IMAGE_MODELS) {
      try {
        const result = await generateWithCloudflareModel(
          model,
          imageBuffer,
          premiumPrompt
        );

        return NextResponse.json({
          enhancedImageUrl: result.imageUrl,
          provider: result.provider,
          model: result.model,
          usedFallback: model !== CLOUDFLARE_IMAGE_MODELS[0],
          presetUsed: preset,
          manualPrompt: premiumPrompt,
          providerErrors,
          contextUsed: Boolean(
            productContext.name ||
              productContext.brand ||
              productContext.category ||
              productContext.size ||
              productContext.colour
          ),
          message:
            model === CLOUDFLARE_IMAGE_MODELS[0]
              ? "Premium product image generated successfully with Cloudflare."
              : "First Cloudflare image model was unavailable, so the premium image was generated with the free Cloudflare backup model.",
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown Cloudflare error.";

        providerErrors.push(`Cloudflare ${model}: ${cleanText(message, 1200)}`);
      }
    }

    try {
      const openAiResult = await generateWithOpenAI(
        imageBuffer,
        mimeType,
        premiumPrompt
      );

      return NextResponse.json({
        enhancedImageUrl: openAiResult.imageUrl,
        provider: openAiResult.provider,
        model: openAiResult.model,
        usedFallback: true,
        presetUsed: preset,
        revisedPrompt: openAiResult.revisedPrompt || "",
        manualPrompt: premiumPrompt,
        providerErrors,
        contextUsed: Boolean(
          productContext.name ||
            productContext.brand ||
            productContext.category ||
            productContext.size ||
            productContext.colour
        ),
        message:
          "Cloudflare image models were unavailable, so the premium image was generated with the optional OpenAI fallback.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown OpenAI error.";

      providerErrors.push(`OpenAI: ${cleanText(message, 1200)}`);
    }

    return NextResponse.json(
      {
        error:
          "All premium image providers failed. Use Copy Prompt + Import Enhanced Result as backup.",
        provider: "none",
        usedFallback: true,
        presetUsed: preset,
        manualPrompt: premiumPrompt,
        providerErrors,
        contextUsed: Boolean(
          productContext.name ||
            productContext.brand ||
            productContext.category ||
            productContext.size ||
            productContext.colour
        ),
        message:
          "Automatic premium image generation failed. You can still use the manual backup workflow.",
      },
      { status: 502 }
    );
  } catch (error) {
    console.error(
      "Generate premium product image route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Premium image generation failed. You can still use Copy Prompt + Import Enhanced Result as backup.",
      },
      { status: 500 }
    );
  }
}