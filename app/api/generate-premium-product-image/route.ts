import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_IMAGE_MODEL =
  process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";

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

type ProviderResult = {
  enhancedImageUrl: string;
  provider: string;
  model: string;
  revisedPrompt?: string;
};

class PremiumImageError extends Error {
  status: number;
  allowManualFallback: boolean;

  constructor(
    message: string,
    status = 500,
    allowManualFallback = true
  ) {
    super(message);
    this.name = "PremiumImageError";
    this.status = status;
    this.allowManualFallback = allowManualFallback;
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
Transform the supplied source product photo into one premium e-commerce image.

MAIN GOAL:
Keep the ORIGINAL product exactly recognizable while improving only the presentation.

STRICT PRODUCT PRESERVATION RULES:
1. Preserve the exact product identity.
2. Do not change the product design.
3. Do not change the colour, print, check pattern, embroidery, texture, shape, silhouette, sleeves, collar, borders, stitching or proportions.
4. Do not add or remove product parts.
5. Do not add model hands, mannequins, jewelry, props, branding, text, labels or extra accessories.
6. Remove only unwanted background distractions, clutter, floor noise, rough surroundings, watermarks, tags and shadows that reduce quality.
7. Keep the product centered and neatly composed.
8. Use a realistic soft grounding shadow.
9. Create a clean premium catalog result suitable for website upload.
10. This must remain a PRODUCT-ONLY image, not a lifestyle model shot.
11. Output style should look like a premium fashion e-commerce listing image.
12. Final composition should feel elegant, realistic, polished and sales-ready.
13. No text, no watermark, no logo overlay, no frame.
14. Final composition should be vertical and product-focused.

BACKGROUND PRESET:
Preset Name: ${preset.name}
Preset Description: ${preset.description}
Preset Background Style: ${preset.backgroundStyle}
Best For: ${preset.bestFor}

TRUSTED PRODUCT RECORD:
${trustedRecord}

IMPORTANT:
- If the source photo is imperfect, improve the presentation without changing the product.
- Preserve natural product edges.
- Keep the product fully visible.
- Use premium clean lighting.
- Keep the result believable and professional.
- Do not invent brand packaging.
- Do not show price tags or promotional text.
`.trim();
}

async function downloadImage(imageUrl: string) {
  let imageResponse: Response;

  try {
    imageResponse = await fetch(imageUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
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

function bufferToDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function generateWithCloudflare(
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string
): Promise<ProviderResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    throw new PremiumImageError(
      "Cloudflare credentials are not configured.",
      500
    );
  }

  const imageDataUrl = bufferToDataUrl(imageBuffer, mimeType);

  const requestBody = {
    prompt,
    image: imageDataUrl,
    num_steps: 20,
    guidance: 7.5,
    strength: 0.8,
  };

  let response: Response;

  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/runwayml/stable-diffusion-v1-5-img2img`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        cache: "no-store",
        signal: AbortSignal.timeout(45000),
      }
    );
  } catch {
    throw new PremiumImageError(
      "Cloudflare premium image service is temporarily unavailable.",
      504
    );
  }

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    let errorMessage = "Cloudflare could not generate the premium image.";

    try {
      const errorJson = (await response.json()) as {
        errors?: Array<{ message?: string }>;
      };

      if (Array.isArray(errorJson.errors) && errorJson.errors.length) {
        errorMessage =
          cleanText(errorJson.errors[0]?.message, 500) ||
          errorMessage;
      }
    } catch {
      // ignore
    }

    throw new PremiumImageError(errorMessage, response.status || 502);
  }

  if (contentType.startsWith("image/")) {
    const outputBuffer = Buffer.from(await response.arrayBuffer());
    return {
      enhancedImageUrl: bufferToDataUrl(outputBuffer, contentType),
      provider: "cloudflare",
      model: "@cf/runwayml/stable-diffusion-v1-5-img2img",
    };
  }

  const json = (await response.json()) as {
    result?: {
      image?: string;
      output?: string | string[];
    };
  };

  const possibleImage =
    cleanText(json.result?.image, 10_000_000) ||
    (Array.isArray(json.result?.output)
      ? cleanText(json.result?.output[0], 10_000_000)
      : cleanText(json.result?.output, 10_000_000));

  if (!possibleImage) {
    throw new PremiumImageError(
      "Cloudflare returned no generated image.",
      502
    );
  }

  return {
    enhancedImageUrl: possibleImage.startsWith("data:")
      ? possibleImage
      : `data:image/png;base64,${possibleImage}`,
    provider: "cloudflare",
    model: "@cf/runwayml/stable-diffusion-v1-5-img2img",
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
      signal: AbortSignal.timeout(45000),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OpenAI image request failed.";

    throw new PremiumImageError(
      message.toLowerCase().includes("timeout")
        ? "OpenAI premium image request timed out."
        : "OpenAI premium image service is temporarily unavailable.",
      504
    );
  }

  const data = (await response.json()) as {
    data?: Array<{
      b64_json?: string;
      url?: string;
      revised_prompt?: string;
    }>;
    error?: {
      message?: string;
    };
  };

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
      enhancedImageUrl: `data:image/png;base64,${result.b64_json}`,
      revisedPrompt: cleanText(result.revised_prompt, 2000),
      provider: "openai",
      model: OPENAI_IMAGE_MODEL,
    };
  }

  if (result.url) {
    return {
      enhancedImageUrl: result.url,
      revisedPrompt: cleanText(result.revised_prompt, 2000),
      provider: "openai",
      model: OPENAI_IMAGE_MODEL,
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

    try {
      const cloudflareResult = await generateWithCloudflare(
        imageBuffer,
        mimeType,
        premiumPrompt
      );

      return NextResponse.json({
        enhancedImageUrl: cloudflareResult.enhancedImageUrl,
        provider: cloudflareResult.provider,
        model: cloudflareResult.model,
        usedFallback: false,
        presetUsed: preset,
        revisedPrompt: cloudflareResult.revisedPrompt || "",
        manualPrompt: premiumPrompt,
        contextUsed: Boolean(
          productContext.name ||
            productContext.brand ||
            productContext.category ||
            productContext.size ||
            productContext.colour
        ),
        message:
          "Premium product image generated successfully using Cloudflare.",
      });
    } catch (error) {
      if (error instanceof PremiumImageError) {
        providerErrors.push(`Cloudflare: ${error.message}`);
      } else {
        providerErrors.push("Cloudflare: Unknown error.");
      }
    }

    try {
      const openAiResult = await generateWithOpenAI(
        imageBuffer,
        mimeType,
        premiumPrompt
      );

      return NextResponse.json({
        enhancedImageUrl: openAiResult.enhancedImageUrl,
        provider: openAiResult.provider,
        model: openAiResult.model,
        usedFallback: true,
        presetUsed: preset,
        revisedPrompt: openAiResult.revisedPrompt || "",
        manualPrompt: premiumPrompt,
        contextUsed: Boolean(
          productContext.name ||
            productContext.brand ||
            productContext.category ||
            productContext.size ||
            productContext.colour
        ),
        providerErrors,
        message:
          "Premium product image generated successfully using fallback provider.",
      });
    } catch (error) {
      if (error instanceof PremiumImageError) {
        providerErrors.push(`OpenAI: ${error.message}`);
      } else {
        providerErrors.push("OpenAI: Unknown error.");
      }
    }

    return NextResponse.json(
      {
        error:
          "All premium image providers failed. Use Copy Prompt + Import Enhanced Result as backup.",
        provider: "none",
        model: "",
        usedFallback: true,
        presetUsed: preset,
        manualPrompt: premiumPrompt,
        contextUsed: Boolean(
          productContext.name ||
            productContext.brand ||
            productContext.category ||
            productContext.size ||
            productContext.colour
        ),
        providerErrors,
        message:
          "Cloud premium generation failed. Use manual backup prompt and import the enhanced result.",
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