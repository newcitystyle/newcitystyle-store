import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_MODEL = "gemini-3.6-flash";
const OPENROUTER_MODEL = "openrouter/free";
const CLOUDFLARE_MODEL =
  "@cf/meta/llama-3.2-11b-vision-instruct";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

type Specification = {
  label: string;
  value: string;
};

type Faq = {
  question: string;
  answer: string;
};

type AiProductDetails = {
  productName: string;
  slug: string;
  tagline: string;
  category: string;
  subcategory: string;
  description: string;
  keyFeatures: string[];
  lifestyleTitle: string;
  lifestyleSubtitle: string;
  colour: string;
  pattern: string;
  sleeveType: string;
  fit: string;
  gender: string;
  occasion: string;
  technicalSpecifications: Specification[];
  whatsInTheBox: string[];
  faqs: Faq[];
  seoTitle: string;
  metaDescription: string;
  seoKeywords: string[];
  productTags: string[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    message?: string;
    status?: string;
    code?: number;
  };
};

type OpenRouterResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      role?: string;
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
    finish_reason?: string;
  }>;
  error?: {
    message?: string;
    code?: number | string;
    metadata?: unknown;
  };
};

type CloudflareResponse = {
  success?: boolean;
  result?:
    | string
    | {
        response?: string;
        description?: string;
      };
  errors?: Array<{
    code?: number;
    message?: string;
  }>;
  messages?: Array<{
    code?: number;
    message?: string;
  }>;
};

type ProviderName =
  | "gemini"
  | "openrouter"
  | "cloudflare";

class AiProviderError extends Error {
  status: number;
  provider: ProviderName;
  allowFallback: boolean;

  constructor(
    message: string,
    status: number,
    provider: ProviderName,
    allowFallback: boolean
  ) {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
    this.provider = provider;
    this.allowFallback = allowFallback;
  }
}

const geminiResponseSchema = {
  type: "OBJECT",
  properties: {
    productName: { type: "STRING" },
    slug: { type: "STRING" },
    tagline: { type: "STRING" },
    category: { type: "STRING" },
    subcategory: { type: "STRING" },
    description: { type: "STRING" },
    keyFeatures: {
      type: "ARRAY",
      items: { type: "STRING" },
      minItems: 4,
      maxItems: 4,
    },
    lifestyleTitle: { type: "STRING" },
    lifestyleSubtitle: { type: "STRING" },
    colour: { type: "STRING" },
    pattern: { type: "STRING" },
    sleeveType: { type: "STRING" },
    fit: { type: "STRING" },
    gender: { type: "STRING" },
    occasion: { type: "STRING" },
    technicalSpecifications: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          value: { type: "STRING" },
        },
        required: ["label", "value"],
      },
      minItems: 3,
      maxItems: 3,
    },
    whatsInTheBox: {
      type: "ARRAY",
      items: { type: "STRING" },
      minItems: 1,
      maxItems: 3,
    },
    faqs: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          answer: { type: "STRING" },
        },
        required: ["question", "answer"],
      },
      minItems: 2,
      maxItems: 2,
    },
    seoTitle: { type: "STRING" },
    metaDescription: { type: "STRING" },
    seoKeywords: {
      type: "ARRAY",
      items: { type: "STRING" },
      minItems: 5,
      maxItems: 12,
    },
    productTags: {
      type: "ARRAY",
      items: { type: "STRING" },
      minItems: 4,
      maxItems: 10,
    },
  },
  required: [
    "productName",
    "slug",
    "tagline",
    "category",
    "subcategory",
    "description",
    "keyFeatures",
    "lifestyleTitle",
    "lifestyleSubtitle",
    "colour",
    "pattern",
    "sleeveType",
    "fit",
    "gender",
    "occasion",
    "technicalSpecifications",
    "whatsInTheBox",
    "faqs",
    "seoTitle",
    "metaDescription",
    "seoKeywords",
    "productTags",
  ],
};

const productPrompt = `
You are the product-content assistant for NEW CITY STYLE,
an Indian family fashion e-commerce store.

Analyse only what is reasonably visible in the supplied product image.

Create a polished, customer-friendly English product draft.

STRICT SAFETY RULES:

1. Do not generate, estimate, change or mention:
   - Selling Price
   - MRP
   - Stock Quantity
   - SKU
   - Barcode
   - Tax Percent
   - Low Stock Limit
   - Exact available sizes

2. Do not claim an exact fabric composition, GSM, weave,
   brand, authenticity, country of origin or certification
   unless it is clearly readable or visible in the image.

3. When fabric is uncertain, use safe wording such as:
   "smooth woven fabric appearance"
   or
   "soft-textured fabric appearance".

4. Do not invent accessories, packaging or extra products.

5. For whatsInTheBox, include only the visible main product,
   for example:
   ["1 x Shirt"]

6. Use one primary colour name.

7. If pattern, sleeve type, fit or another field is not
   applicable, return "Not applicable".

8. Category should preferably be one of:
   Men, Women, Kids, Sarees.

9. Subcategory should be specific, such as:
   Casual Shirts,
   Formal Shirts,
   T-Shirts,
   Jeans,
   Trousers,
   Kurtis,
   Tops,
   Frocks,
   Sarees,
   Nightwear,
   Sportswear,
   Innerwear.

10. Gender should preferably be one of:
    Men, Women, Boys, Girls, Unisex.

11. Produce exactly:
    - 4 key features
    - 3 technical specifications
    - 2 FAQs

12. Keep product name under 90 characters.

13. Keep SEO title under 60 characters.

14. Keep meta description between approximately
    140 and 155 characters.

15. Slug must contain lowercase English words separated
    with hyphens.

16. Do not return markdown, headings, code fences,
    explanations or confidence scores.

Return only a valid JSON object using exactly this structure:

{
  "productName": "string",
  "slug": "string",
  "tagline": "string",
  "category": "string",
  "subcategory": "string",
  "description": "string",
  "keyFeatures": [
    "string",
    "string",
    "string",
    "string"
  ],
  "lifestyleTitle": "string",
  "lifestyleSubtitle": "string",
  "colour": "string",
  "pattern": "string",
  "sleeveType": "string",
  "fit": "string",
  "gender": "string",
  "occasion": "string",
  "technicalSpecifications": [
    {
      "label": "string",
      "value": "string"
    },
    {
      "label": "string",
      "value": "string"
    },
    {
      "label": "string",
      "value": "string"
    }
  ],
  "whatsInTheBox": [
    "string"
  ],
  "faqs": [
    {
      "question": "string",
      "answer": "string"
    },
    {
      "question": "string",
      "answer": "string"
    }
  ],
  "seoTitle": "string",
  "metaDescription": "string",
  "seoKeywords": [
    "string"
  ],
  "productTags": [
    "string"
  ]
}
`;

function cleanText(
  value: unknown,
  maxLength = 2000
) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function cleanStringArray(
  value: unknown,
  maximum: number,
  fallback: string[] = []
) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((item) => cleanText(item, 220))
    .filter(Boolean)
    .slice(0, maximum);
}

function cleanSlug(
  value: unknown,
  fallbackName: string
) {
  const source =
    cleanText(value, 160) || fallbackName;

  return source
    .toLowerCase()
    .replace(/[’'"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function normalizeDetails(
  value: unknown
): AiProductDetails {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const productName = cleanText(
    source.productName,
    140
  );

  const specifications = Array.isArray(
    source.technicalSpecifications
  )
    ? source.technicalSpecifications
        .map((item) => {
          const row =
            item && typeof item === "object"
              ? (item as Record<
                  string,
                  unknown
                >)
              : {};

          return {
            label: cleanText(row.label, 80),
            value: cleanText(row.value, 180),
          };
        })
        .filter(
          (item) => item.label && item.value
        )
        .slice(0, 3)
    : [];

  const faqs = Array.isArray(source.faqs)
    ? source.faqs
        .map((item) => {
          const row =
            item && typeof item === "object"
              ? (item as Record<
                  string,
                  unknown
                >)
              : {};

          return {
            question: cleanText(
              row.question,
              220
            ),
            answer: cleanText(
              row.answer,
              700
            ),
          };
        })
        .filter(
          (item) =>
            item.question && item.answer
        )
        .slice(0, 2)
    : [];

  return {
    productName,
    slug: cleanSlug(
      source.slug,
      productName
    ),
    tagline: cleanText(
      source.tagline,
      180
    ),
    category: cleanText(
      source.category,
      80
    ),
    subcategory: cleanText(
      source.subcategory,
      100
    ),
    description: cleanText(
      source.description,
      2200
    ),
    keyFeatures: cleanStringArray(
      source.keyFeatures,
      4
    ),
    lifestyleTitle: cleanText(
      source.lifestyleTitle,
      140
    ),
    lifestyleSubtitle: cleanText(
      source.lifestyleSubtitle,
      220
    ),
    colour: cleanText(
      source.colour,
      80
    ),
    pattern: cleanText(
      source.pattern,
      80
    ),
    sleeveType: cleanText(
      source.sleeveType,
      80
    ),
    fit: cleanText(source.fit, 80),
    gender: cleanText(
      source.gender,
      40
    ),
    occasion: cleanText(
      source.occasion,
      120
    ),
    technicalSpecifications:
      specifications,
    whatsInTheBox: cleanStringArray(
      source.whatsInTheBox,
      3
    ),
    faqs,
    seoTitle: cleanText(
      source.seoTitle,
      160
    ),
    metaDescription: cleanText(
      source.metaDescription,
      180
    ),
    seoKeywords: cleanStringArray(
      source.seoKeywords,
      12
    ),
    productTags: cleanStringArray(
      source.productTags,
      10
    ),
  };
}

function validateGeneratedDetails(
  details: AiProductDetails
) {
  return Boolean(
    details.productName &&
      details.slug &&
      details.category &&
      details.description &&
      details.keyFeatures.length > 0
  );
}

function isSafeImageUrl(value: string) {
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

function extractJsonObject(
  rawText: string
) {
  let value = rawText.trim();

  value = value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(value) as unknown;
  } catch {
    const firstBrace = value.indexOf("{");
    const lastBrace =
      value.lastIndexOf("}");

    if (
      firstBrace === -1 ||
      lastBrace === -1 ||
      lastBrace <= firstBrace
    ) {
      throw new Error(
        "AI response did not contain JSON."
      );
    }

    return JSON.parse(
      value.slice(
        firstBrace,
        lastBrace + 1
      )
    ) as unknown;
  }
}

function getOpenRouterText(
  response: OpenRouterResponse
) {
  const content =
    response.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) =>
        typeof item?.text === "string"
          ? item.text
          : ""
      )
      .join("")
      .trim();
  }

  return "";
}

function getCloudflareText(
  response: CloudflareResponse
) {
  if (typeof response.result === "string") {
    return response.result.trim();
  }

  if (
    response.result &&
    typeof response.result === "object"
  ) {
    return (
      cleanText(
        response.result.response,
        20000
      ) ||
      cleanText(
        response.result.description,
        20000
      )
    );
  }

  return "";
}

function shouldFallbackFromGemini(
  status: number,
  message: string
) {
  const normalized =
    message.toLowerCase();

  if (
    status === 402 ||
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status >= 500
  ) {
    return true;
  }

  return (
    normalized.includes("quota") ||
    normalized.includes("rate limit") ||
    normalized.includes(
      "resource_exhausted"
    ) ||
    normalized.includes("prepayment") ||
    normalized.includes("credits") ||
    normalized.includes("billing") ||
    normalized.includes(
      "no longer available"
    ) ||
    normalized.includes(
      "model is not available"
    ) ||
    normalized.includes(
      "model not found"
    ) ||
    normalized.includes(
      "temporarily unavailable"
    ) ||
    normalized.includes(
      "service unavailable"
    ) ||
    normalized.includes("timeout") ||
    normalized.includes("timed out")
  );
}

async function generateWithGemini(
  imageBuffer: Buffer,
  mimeType: string
): Promise<AiProductDetails> {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new AiProviderError(
      "GEMINI_API_KEY is not configured.",
      500,
      "gemini",
      true
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: productPrompt,
                },
                {
                  inlineData: {
                    mimeType,
                    data: imageBuffer.toString(
                      "base64"
                    ),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 4096,
            responseMimeType:
              "application/json",
            responseSchema:
              geminiResponseSchema,
          },
        }),
        cache: "no-store",
        signal:
          AbortSignal.timeout(18_000),
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gemini request failed.";

    throw new AiProviderError(
      message
        .toLowerCase()
        .includes("timeout")
        ? "Gemini request timed out."
        : "Gemini is temporarily unavailable.",
      504,
      "gemini",
      true
    );
  }

  let data: GeminiResponse;

  try {
    data =
      (await response.json()) as GeminiResponse;
  } catch {
    throw new AiProviderError(
      "Gemini returned an unreadable response.",
      response.status || 502,
      "gemini",
      true
    );
  }

  if (!response.ok) {
    const message =
      cleanText(
        data.error?.message,
        1000
      ) ||
      "Gemini could not generate product details.";

    throw new AiProviderError(
      message,
      response.status || 502,
      "gemini",
      shouldFallbackFromGemini(
        response.status,
        message
      )
    );
  }

  if (
    data.promptFeedback?.blockReason
  ) {
    throw new AiProviderError(
      `Gemini blocked this image: ${data.promptFeedback.blockReason}.`,
      422,
      "gemini",
      false
    );
  }

  const generatedText =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || "";

  if (!generatedText) {
    throw new AiProviderError(
      "Gemini returned no product details.",
      502,
      "gemini",
      true
    );
  }

  let parsed: unknown;

  try {
    parsed =
      extractJsonObject(generatedText);
  } catch {
    throw new AiProviderError(
      "Gemini returned invalid product data.",
      502,
      "gemini",
      true
    );
  }

  const details =
    normalizeDetails(parsed);

  if (
    !validateGeneratedDetails(details)
  ) {
    throw new AiProviderError(
      "Gemini could not identify enough product information.",
      422,
      "gemini",
      true
    );
  }

  return details;
}

async function generateWithOpenRouter(
  imageBuffer: Buffer,
  mimeType: string
): Promise<{
  details: AiProductDetails;
  model: string;
}> {
  const apiKey =
    process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    throw new AiProviderError(
      "OPENROUTER_API_KEY is not configured.",
      500,
      "openrouter",
      true
    );
  }

  const imageDataUrl =
    `data:${mimeType};base64,` +
    imageBuffer.toString("base64");

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  let response: Response;

  try {
    response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type":
            "application/json",
          "HTTP-Referer": siteUrl,
          "X-OpenRouter-Title":
            "NEW CITY STYLE",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: productPrompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageDataUrl,
                  },
                },
              ],
            },
          ],
          response_format: {
            type: "json_object",
          },
          max_tokens: 4096,
        }),
        cache: "no-store",
        signal:
          AbortSignal.timeout(16_000),
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "OpenRouter request failed.";

    throw new AiProviderError(
      message
        .toLowerCase()
        .includes("timeout")
        ? "Backup AI request timed out."
        : "Backup AI is temporarily unavailable.",
      504,
      "openrouter",
      true
    );
  }

  let data: OpenRouterResponse;

  try {
    data =
      (await response.json()) as OpenRouterResponse;
  } catch {
    throw new AiProviderError(
      "Backup AI returned an unreadable response.",
      response.status || 502,
      "openrouter",
      true
    );
  }

  if (!response.ok) {
    const message =
      cleanText(
        data.error?.message,
        1000
      ) ||
      "Backup AI could not generate product details.";

    throw new AiProviderError(
      message,
      response.status || 502,
      "openrouter",
      true
    );
  }

  const generatedText =
    getOpenRouterText(data);

  if (!generatedText) {
    throw new AiProviderError(
      "Backup AI returned no product details.",
      502,
      "openrouter",
      true
    );
  }

  let parsed: unknown;

  try {
    parsed =
      extractJsonObject(generatedText);
  } catch {
    console.error(
      "OpenRouter returned invalid JSON:",
      generatedText
    );

    throw new AiProviderError(
      "Backup AI returned invalid product data.",
      502,
      "openrouter",
      true
    );
  }

  const details =
    normalizeDetails(parsed);

  if (
    !validateGeneratedDetails(details)
  ) {
    throw new AiProviderError(
      "Backup AI could not identify enough product information.",
      422,
      "openrouter",
      true
    );
  }

  return {
    details,
    model:
      cleanText(data.model, 150) ||
      OPENROUTER_MODEL,
  };
}

async function callCloudflare(
  accountId: string,
  apiToken: string,
  body: Record<string, unknown>,
  timeoutMs: number
) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
      accountId
    )}/ai/run/${CLOUDFLARE_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${apiToken}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal:
        AbortSignal.timeout(timeoutMs),
    }
  );

  let data: CloudflareResponse;

  try {
    data =
      (await response.json()) as CloudflareResponse;
  } catch {
    throw new AiProviderError(
      "Cloudflare AI returned an unreadable response.",
      response.status || 502,
      "cloudflare",
      false
    );
  }

  return { response, data };
}

function getCloudflareErrorMessage(
  data: CloudflareResponse
) {
  return (
    cleanText(
      data.errors?.[0]?.message,
      1000
    ) ||
    cleanText(
      data.messages?.[0]?.message,
      1000
    ) ||
    "Cloudflare AI could not generate product details."
  );
}

function isCloudflareLicenseError(
  message: string
) {
  const normalized =
    message.toLowerCase();

  return (
    normalized.includes("license") ||
    normalized.includes("acceptable use") ||
    normalized.includes("agree")
  );
}

async function generateWithCloudflare(
  imageBuffer: Buffer,
  mimeType: string
): Promise<{
  details: AiProductDetails;
  model: string;
}> {
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim();

  const apiToken =
    process.env.CLOUDFLARE_API_TOKEN?.trim() ||
    process.env.CLOUDFLARE_AUTH_TOKEN?.trim();

  if (!accountId) {
    throw new AiProviderError(
      "CLOUDFLARE_ACCOUNT_ID is not configured.",
      500,
      "cloudflare",
      false
    );
  }

  if (!apiToken) {
    throw new AiProviderError(
      "CLOUDFLARE_API_TOKEN is not configured.",
      500,
      "cloudflare",
      false
    );
  }

  const imageDataUrl =
    `data:${mimeType};base64,` +
    imageBuffer.toString("base64");

  const requestBody = {
    messages: [
      {
        role: "user",
        content: productPrompt,
      },
    ],
    image: imageDataUrl,
    max_tokens: 4096,
    temperature: 0.2,
  };

  let response: Response;
  let data: CloudflareResponse;

  try {
    const firstAttempt =
      await callCloudflare(
        accountId,
        apiToken,
        requestBody,
        14_000
      );

    response = firstAttempt.response;
    data = firstAttempt.data;
  } catch (error) {
    if (
      error instanceof AiProviderError
    ) {
      throw error;
    }

    const message =
      error instanceof Error
        ? error.message
        : "Cloudflare AI request failed.";

    throw new AiProviderError(
      message
        .toLowerCase()
        .includes("timeout")
        ? "Cloudflare AI request timed out."
        : "Cloudflare AI is temporarily unavailable.",
      504,
      "cloudflare",
      false
    );
  }

  if (!response.ok || data.success === false) {
    const firstMessage =
      getCloudflareErrorMessage(data);

    if (
      isCloudflareLicenseError(
        firstMessage
      )
    ) {
      try {
        const agreement =
          await callCloudflare(
            accountId,
            apiToken,
            { prompt: "agree" },
            5_000
          );

        if (
          !agreement.response.ok ||
          agreement.data.success === false
        ) {
          throw new AiProviderError(
            getCloudflareErrorMessage(
              agreement.data
            ),
            agreement.response.status ||
              502,
            "cloudflare",
            false
          );
        }

        const retry =
          await callCloudflare(
            accountId,
            apiToken,
            requestBody,
            12_000
          );

        response = retry.response;
        data = retry.data;
      } catch (error) {
        if (
          error instanceof AiProviderError
        ) {
          throw error;
        }

        throw new AiProviderError(
          "Cloudflare AI model licence could not be activated.",
          502,
          "cloudflare",
          false
        );
      }
    }
  }

  if (!response.ok || data.success === false) {
    throw new AiProviderError(
      getCloudflareErrorMessage(data),
      response.status || 502,
      "cloudflare",
      false
    );
  }

  const generatedText =
    getCloudflareText(data);

  if (!generatedText) {
    throw new AiProviderError(
      "Cloudflare AI returned no product details.",
      502,
      "cloudflare",
      false
    );
  }

  let parsed: unknown;

  try {
    parsed =
      extractJsonObject(generatedText);
  } catch {
    console.error(
      "Cloudflare returned invalid JSON:",
      generatedText
    );

    throw new AiProviderError(
      "Cloudflare AI returned invalid product data.",
      502,
      "cloudflare",
      false
    );
  }

  const details =
    normalizeDetails(parsed);

  if (
    !validateGeneratedDetails(details)
  ) {
    throw new AiProviderError(
      "Cloudflare AI could not identify enough product information.",
      422,
      "cloudflare",
      false
    );
  }

  return {
    details,
    model: CLOUDFLARE_MODEL,
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as {
        imageUrl?: unknown;
      };

    const imageUrl = cleanText(
      body.imageUrl,
      2000
    );

    if (
      !imageUrl ||
      !isSafeImageUrl(imageUrl)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid uploaded product image URL is required.",
        },
        { status: 400 }
      );
    }

    let imageResponse: Response;

    try {
      imageResponse = await fetch(
        imageUrl,
        {
          cache: "no-store",
          signal:
            AbortSignal.timeout(8_000),
        }
      );
    } catch {
      return NextResponse.json(
        {
          error:
            "The uploaded product image could not be downloaded.",
        },
        { status: 400 }
      );
    }

    if (!imageResponse.ok) {
      return NextResponse.json(
        {
          error:
            "The uploaded product image could not be downloaded.",
        },
        { status: 400 }
      );
    }

    const contentLength = Number(
      imageResponse.headers.get(
        "content-length"
      ) || 0
    );

    if (
      contentLength &&
      contentLength > MAX_IMAGE_BYTES
    ) {
      return NextResponse.json(
        {
          error:
            "The product image must be smaller than 8 MB.",
        },
        { status: 413 }
      );
    }

    const mimeType = (
      imageResponse.headers.get(
        "content-type"
      ) || ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (
      !ALLOWED_IMAGE_TYPES.has(
        mimeType
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Only JPG, PNG and WEBP product images are supported.",
        },
        { status: 415 }
      );
    }

    const imageBuffer = Buffer.from(
      await imageResponse.arrayBuffer()
    );

    if (!imageBuffer.length) {
      return NextResponse.json(
        {
          error:
            "The uploaded product image is empty.",
        },
        { status: 400 }
      );
    }

    if (
      imageBuffer.length >
      MAX_IMAGE_BYTES
    ) {
      return NextResponse.json(
        {
          error:
            "The product image must be smaller than 8 MB.",
        },
        { status: 413 }
      );
    }

    let geminiErrorMessage = "";
    let openRouterErrorMessage = "";

    try {
      const details =
        await generateWithGemini(
          imageBuffer,
          mimeType
        );

      return NextResponse.json({
        details,
        provider: "gemini",
        model: GEMINI_MODEL,
        usedFallback: false,
        fallbackLevel: 0,
        message:
          "Product details generated successfully with Gemini.",
      });
    } catch (error) {
      if (
        !(
          error instanceof
          AiProviderError
        )
      ) {
        console.error(
          "Unexpected Gemini error:",
          error
        );

        geminiErrorMessage =
          "Gemini failed unexpectedly.";
      } else {
        console.error(
          "Gemini generation error:",
          error.message
        );

        geminiErrorMessage =
          error.message;

        if (!error.allowFallback) {
          return NextResponse.json(
            {
              error: error.message,
              provider: "gemini",
              usedFallback: false,
            },
            {
              status: error.status,
            }
          );
        }
      }
    }

    try {
      const backupResult =
        await generateWithOpenRouter(
          imageBuffer,
          mimeType
        );

      return NextResponse.json({
        details:
          backupResult.details,
        provider: "openrouter",
        model: backupResult.model,
        usedFallback: true,
        fallbackLevel: 1,
        message:
          "Gemini was unavailable, so product details were generated with OpenRouter Backup AI.",
      });
    } catch (error) {
      if (
        error instanceof
        AiProviderError
      ) {
        console.error(
          "OpenRouter generation error:",
          error.message
        );

        openRouterErrorMessage =
          error.message;
      } else {
        console.error(
          "Unexpected OpenRouter error:",
          error
        );

        openRouterErrorMessage =
          "OpenRouter failed unexpectedly.";
      }
    }

    try {
      const cloudflareResult =
        await generateWithCloudflare(
          imageBuffer,
          mimeType
        );

      return NextResponse.json({
        details:
          cloudflareResult.details,
        provider: "cloudflare",
        model: cloudflareResult.model,
        usedFallback: true,
        fallbackLevel: 2,
        message:
          "Gemini and OpenRouter were unavailable, so product details were generated with Cloudflare Workers AI.",
      });
    } catch (error) {
      console.error(
        "Cloudflare generation error:",
        error
      );

      const cloudflareMessage =
        error instanceof AiProviderError
          ? error.message
          : "Cloudflare AI failed unexpectedly.";

      return NextResponse.json(
        {
          error:
            `Gemini failed: ${geminiErrorMessage} ` +
            `OpenRouter failed: ${openRouterErrorMessage} ` +
            `Cloudflare AI failed: ${cloudflareMessage} ` +
            "You can still enter all product details manually.",
          provider: "none",
          usedFallback: true,
          fallbackLevel: 3,
        },
        {
          status:
            error instanceof
            AiProviderError
              ? error.status
              : 500,
        }
      );
    }
  } catch (error) {
    console.error(
      "Generate product details route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "AI generation failed. The manual Add Product form is still available.",
      },
      { status: 500 }
    );
  }
}
