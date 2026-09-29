import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";



export const runtime = "nodejs";

export const dynamic = "force-dynamic";



type WhatsAppStatusError = {

  code?: number;

  title?: string;

  message?: string;

  error_data?: {

    details?: string;

  };

};



type WhatsAppStatus = {

  id?: string;

  status?: "sent" | "delivered" | "read" | "failed" | string;

  timestamp?: string;

  recipient_id?: string;

  conversation?: {

    id?: string;

    expiration_timestamp?: string;

    origin?: {

      type?: string;

    };

  };

  pricing?: {

    billable?: boolean;

    pricing_model?: string;

    category?: string;

    type?: string;

  };

  errors?: WhatsAppStatusError[];

};



type WhatsAppIncomingMessage = {

  from?: string;

  id?: string;

  timestamp?: string;

  type?: string;

  text?: {

    body?: string;

  };

  interactive?: {

    type?: string;

    button_reply?: {

      id?: string;

      title?: string;

    };

    list_reply?: {

      id?: string;

      title?: string;

      description?: string;

    };

  };

};



type WhatsAppWebhookValue = {

  messaging_product?: string;

  metadata?: {

    display_phone_number?: string;

    phone_number_id?: string;

  };

  contacts?: Array<{

    profile?: {

      name?: string;

    };

    wa_id?: string;

  }>;

  messages?: WhatsAppIncomingMessage[];

  statuses?: WhatsAppStatus[];

  errors?: WhatsAppStatusError[];

};



type WhatsAppWebhookPayload = {

  object?: string;

  entry?: Array<{

    id?: string;

    changes?: Array<{

      field?: string;

      value?: WhatsAppWebhookValue;

    }>;

  }>;

};



type ProductRow = {

  id: number;

  name?: string | null;

  slug?: string | null;

  brand?: string | null;

  category?: string | null;

  subcategory?: string | null;

  gender?: string | null;

  age_group?: string | null;

  sizes?: unknown;

  tags?: unknown;

  material?: string | null;

  fabric?: string | null;

  pattern?: string | null;

  occasion?: string | null;

  price?: number | string | null;

  mrp?: number | string | null;

  online_mrp?: number | string | null;

  stock?: number | string | null;

  sku?: string | null;

  barcode?: string | null;

  sell_online?: boolean | null;

  online_stock_limit?: number | string | null;

  low_stock_limit?: number | string | null;

  is_active?: boolean | null;

  status?: string | null;

  image?: string | null;

  image_url?: string | null;

  social_preview_url?: string | null;

  images?: unknown;

  gallery_images?: unknown;

  is_featured?: boolean | null;

  is_new_arrival?: boolean | null;

  is_bestseller?: boolean | null;

  is_trending?: boolean | null;

  updated_at?: string | null;

};



type InventoryVariantRow = {

  id: number;

  product_id: number;

  size?: string | null;

  color?: string | null;

  sku?: string | null;

  barcode?: string | null;

  variant_name?: string | null;

  stock?: number | string | null;

  reserved_stock?: number | string | null;

  selling_price?: number | string | null;

  mrp?: number | string | null;

  online_mrp?: number | string | null;

  online_price?: number | string | null;

  main_image?: string | null;

  gallery_images?: unknown;

  sell_online?: boolean | null;

  online_stock_limit?: number | string | null;

  is_active?: boolean | null;

};



type UnifiedInventoryResult = {

  product: ProductRow;

  variants: InventoryVariantRow[];

  score: number;

  isOnline: boolean;

  availableStock: number;

  availableSizes: string[];

  availableColors: string[];

  sellingPriceMin: number;

  sellingPriceMax: number;

  mrpMin: number;

  mrpMax: number;

  stockLabel: "Available" | "Few Left";

  bestImageUrl: string | null;

};



type UnifiedInventorySearch = {

  meaningful: boolean;

  normalizedQuery: string;

  matches: UnifiedInventoryResult[];

};



type SalesConversationRow = {
  phone: string;
  last_query?: string | null;
  last_result_product_ids?: number[] | null;
  last_selected_product_id?: number | string | null;
  last_selected_variant_id?: number | string | null;
  last_product_name?: string | null;
  last_brand?: string | null;
  last_category?: string | null;
  last_size?: string | null;
  last_color?: string | null;
  last_price?: number | string | null;
  context_expires_at?: string | null;
  updated_at?: string | null;
};

type ReservationRpcResult = {
  reserved?: boolean;
  released?: boolean;
  reason?: string;
  existing?: boolean;
  reservation_code?: string | null;
  product_id?: number | string | null;
  variant_id?: number | string | null;
  product_name?: string | null;
  brand?: string | null;
  size?: string | null;
  color?: string | null;
  quantity?: number | string | null;
  price?: number | string | null;
  expires_at?: string | null;
};

type ReservationChoice = {
  result: UnifiedInventoryResult;
  variant: InventoryVariantRow | null;
  requestedSize: string | null;
  requestedColor: string | null;
  ambiguousSizes: string[];
  ambiguousColors: string[];
};

type AutoReplyClaim = {

  claimed?: boolean;

  reason?: string;

  previous_product_ids?: number[] | null;

  retry_after_seconds?: number | null;

};



type MetaMessageResponse = {

  contacts?: Array<{

    input?: string;

    wa_id?: string;

  }>;

  messages?: Array<{

    id?: string;

    message_status?: string;

  }>;

  error?: {

    message?: string;

    type?: string;

    code?: number;

    error_subcode?: number;

    error_data?: {

      details?: string;

    };

    fbtrace_id?: string;

  };

};



const NCS_SITE_URL =

  (

    process.env.NCS_SITE_URL?.trim() ||

    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||

    "https://www.newcitystyle.store"

  ).replace(/\/+$/, "");



const PRODUCT_COUNT = 3;

const PRODUCT_POOL_SIZE = 120;

const DEFAULT_COOLDOWN_MINUTES = 360;

const UNIFIED_INVENTORY_PRODUCT_LIMIT = 500;

const UNIFIED_INVENTORY_CANDIDATE_LIMIT = 80;

const DEFAULT_RESERVATION_MINUTES = 120;

const SALES_CONTEXT_HOURS = 24;



const SEARCH_STOP_WORDS = new Set([

  "hi",

  "hello",

  "hey",

  "hii",

  "hai",

  "ok",

  "okay",

  "thanks",

  "thank",

  "you",

  "good",

  "morning",

  "afternoon",

  "evening",

  "bro",

  "anna",

  "sir",

  "madam",

  "please",

  "pls",

  "price",

  "cost",

  "want",

  "need",

  "show",

  "send",

  "product",

  "products",

  "kavali",

  "unnaya",

  "undha",

  "undi",

]);

type SmartProductIntent = {
  normalized: string;
  terms: string[];
  minPrice: number | null;
  maxPrice: number | null;
  sizes: string[];
  wantsOffers: boolean;
  wantsNewArrivals: boolean;
  wantsBestSellers: boolean;
  wantsTrending: boolean;
  wantsFeatured: boolean;
  audience: "men" | "women" | "kids" | null;
  categoryHints: string[];
  colorHints: string[];
  fabricHints: string[];
  hasStructuredIntent: boolean;
};

const SMART_CATEGORY_ALIASES: Array<{
  triggers: string[];
  hints: string[];
}> = [
  {
    triggers: ["t shirt", "tshirt", "tee", "tees", "tshirts"],
    hints: ["t shirt", "tshirt", "tee"],
  },
  {
    triggers: ["shirt", "shirts"],
    hints: ["shirt"],
  },
  {
    triggers: ["jean", "jeans", "denim"],
    hints: ["jean", "jeans", "denim"],
  },
  {
    triggers: ["saree", "sarees", "sari", "saris", "చీర"],
    hints: ["saree", "sari", "చీర"],
  },
  {
    triggers: ["kurti", "kurtis", "kurta", "kurtas"],
    hints: ["kurti", "kurta"],
  },
  {
    triggers: ["frock", "frocks"],
    hints: ["frock"],
  },
  {
    triggers: ["dress", "dresses"],
    hints: ["dress"],
  },
  {
    triggers: ["top", "tops"],
    hints: ["top"],
  },
  {
    triggers: ["pant", "pants", "trouser", "trousers"],
    hints: ["pant", "trouser"],
  },
  {
    triggers: ["short", "shorts"],
    hints: ["short", "shorts"],
  },
  {
    triggers: ["legging", "leggings"],
    hints: ["legging"],
  },
  {
    triggers: ["track pant", "trackpants", "track pant"],
    hints: ["track pant", "trackpants"],
  },
  {
    triggers: [
      "chunni",
      "chuni",
      "chunny",
      "dupatta",
      "duppatta",
      "stole",
      "scarf",
      "shawl",
      "చున్నీ",
      "దుపట్టా",
    ],
    hints: [
      "chunni",
      "dupatta",
      "stole",
      "scarf",
      "shawl",
      "చున్నీ",
      "దుపట్టా",
    ],
  },
  {
    triggers: [
      "nighty",
      "nighties",
      "night dress",
      "nightwear",
    ],
    hints: [
      "nighty",
      "night dress",
      "nightwear",
    ],
  },
  {
    triggers: [
      "innerwear",
      "vest",
      "banian",
      "baniyan",
      "brief",
      "briefs",
    ],
    hints: [
      "innerwear",
      "vest",
      "banian",
      "brief",
    ],
  },
  {
    triggers: [
      "sportswear",
      "sports wear",
      "activewear",
      "active wear",
    ],
    hints: [
      "sportswear",
      "sports wear",
      "activewear",
    ],
  },
];

const SMART_COLOR_TERMS = [
  "black",
  "white",
  "blue",
  "navy",
  "grey",
  "gray",
  "green",
  "olive",
  "red",
  "maroon",
  "pink",
  "purple",
  "yellow",
  "orange",
  "brown",
  "beige",
  "cream",
  "khaki",
  "peach",
  "teal",
  "mustard",
  "gold",
  "silver",
];

const SMART_FABRIC_TERMS = [
  "cotton",
  "linen",
  "denim",
  "silk",
  "rayon",
  "polyester",
  "viscose",
  "lycra",
  "stretch",
  "knit",
  "georgette",
  "chiffon",
];





/* ============================================================

   PHONE PRIVACY

============================================================ */



function maskPhone(

  value?: string,

): string | null {

  if (!value) {

    return null;

  }



  const digits =

    value.replace(/\D/g, "");



  if (digits.length <= 4) {

    return digits;

  }



  return `${"*".repeat(

    Math.max(

      0,

      digits.length - 4,

    ),

  )}${digits.slice(-4)}`;

}



function recipientLast4(

  value?: string,

): string | null {

  if (!value) {

    return null;

  }



  const digits =

    value.replace(/\D/g, "");



  if (!digits) {

    return null;

  }



  return digits.slice(-4);

}



function whatsappIncomingMessageText(
  message: WhatsAppIncomingMessage,
): string {
  const textBody =
    message.text?.body?.trim() ||
    "";

  if (textBody) {
    return textBody;
  }

  const buttonId =
    message.interactive
      ?.button_reply
      ?.id
      ?.trim() ||
    "";

  const buttonTitle =
    message.interactive
      ?.button_reply
      ?.title
      ?.trim() ||
    "";

  const listId =
    message.interactive
      ?.list_reply
      ?.id
      ?.trim() ||
    "";

  const listTitle =
    message.interactive
      ?.list_reply
      ?.title
      ?.trim() ||
    "";

  const actionId =
    (buttonId || listId)
      .toUpperCase();

  if (
    actionId ===
    "NCS_BOOK_CURRENT"
  ) {
    return "BOOK";
  }

  if (
    actionId ===
    "NCS_BOOKING_STATUS"
  ) {
    return "BOOKING STATUS";
  }

  if (
    actionId ===
    "NCS_CANCEL_BOOKING"
  ) {
    return "CANCEL BOOKING";
  }

  const optionMatch =
    actionId.match(
      /^NCS_OPTION_([123])$/,
    );

  if (optionMatch) {
    return optionMatch[1];
  }

  if (
    actionId.startsWith(
      "NCS_SIZE_",
    ) &&
    listTitle
  ) {
    return `size ${listTitle}`;
  }

  if (
    actionId.startsWith(
      "NCS_COLOR_",
    ) &&
    listTitle
  ) {
    return `colour ${listTitle}`;
  }

  return (
    buttonTitle ||
    listTitle ||
    buttonId ||
    listId ||
    ""
  ).trim();
}


function whatsappInteractiveProductId(
  message: WhatsAppIncomingMessage,
): number | null {
  const rawId =
    message.interactive?.button_reply?.id?.trim() ||
    message.interactive?.list_reply?.id?.trim() ||
    "";

  const match = rawId.toUpperCase().match(
    /^NCS_PRODUCT_(\d+)$/,
  );

  if (!match) {
    return null;
  }

  const productId = Number(match[1]);
  return Number.isFinite(productId) && productId > 0
    ? productId
    : null;
}


type NcsInteractiveVariantChoice = {
  kind: "size" | "color";
  value: string;
};

function whatsappInteractiveVariantChoice(
  message: WhatsAppIncomingMessage,
): NcsInteractiveVariantChoice | null {
  const listId =
    message.interactive
      ?.list_reply
      ?.id
      ?.trim() ||
    "";

  const listTitle =
    message.interactive
      ?.list_reply
      ?.title
      ?.trim() ||
    "";

  if (!listId || !listTitle) {
    return null;
  }

  const actionId =
    listId.toUpperCase();

  if (
    actionId.startsWith(
      "NCS_SIZE_",
    )
  ) {
    return {
      kind: "size",
      value: listTitle,
    };
  }

  if (
    actionId.startsWith(
      "NCS_COLOR_",
    )
  ) {
    return {
      kind: "color",
      value: listTitle,
    };
  }

  return null;
}

function normalizePhone(

  value?: string,

): string {

  return (value || "")

    .replace(/\D/g, "");

}



/* ============================================================

   META TIMESTAMP

============================================================ */



function metaTimestamp(

  value?: string,

): string | null {

  if (!value) {

    return null;

  }



  const seconds =

    Number(value);



  if (

    !Number.isFinite(seconds) ||

    seconds <= 0

  ) {

    return null;

  }



  return new Date(

    seconds * 1000,

  ).toISOString();

}



/* ============================================================

   SUPABASE SERVER CLIENT

============================================================ */



function createWebhookSupabaseAdmin() {

  const url =

    process.env

      .NEXT_PUBLIC_SUPABASE_URL

      ?.trim() ||

    process.env

      .SUPABASE_URL

      ?.trim();



  const key =

    process.env

      .SUPABASE_SERVICE_ROLE_KEY

      ?.trim() ||

    process.env

      .SUPABASE_SERVICE_KEY

      ?.trim();



  if (

    !url ||

    !key

  ) {

    return null;

  }



  return createClient(

    url,

    key,

    {

      auth: {

        persistSession: false,

        autoRefreshToken: false,

      },

    },

  );

}



/* ============================================================

   AUTO PRODUCT REPLY HELPERS

============================================================ */



function safeNumber(

  value:

    | number

    | string

    | null

    | undefined,

): number {

  const parsed =

    Number(value);



  return Number.isFinite(parsed)

    ? parsed

    : 0;

}



function money(

  value: number,

): string {

  return new Intl.NumberFormat(

    "en-IN",

    {

      style: "currency",

      currency: "INR",

      maximumFractionDigits: 0,

    },

  ).format(

    Math.max(0, value),

  );

}



function normalizeSearchText(

  value?: string | null,

): string {

  return (value || "")

    .trim()

    .toLowerCase()

    .replace(

      /[^a-z0-9\u0C00-\u0C7F]+/g,

      " ",

    )

    .replace(/\s+/g, " ")

    .trim();

}



function parseImageArray(

  value: unknown,

): string[] {

  if (!Array.isArray(value)) {

    return [];

  }



  return value

    .filter(

      (item): item is string =>

        typeof item === "string",

    )

    .map(

      (item) => item.trim(),

    )

    .filter(Boolean);

}



function productImage(

  product: ProductRow,

): string | null {

  const candidates = [

    product.image_url,

    product.image,

    product.social_preview_url,

    ...parseImageArray(

      product.images,

    ),

    ...parseImageArray(

      product.gallery_images,

    ),

  ];



  for (

    const candidate of

    candidates

  ) {

    const value =

      candidate?.trim();



    if (!value) {

      continue;

    }



    if (

      /^https?:\/\//i.test(

        value,

      )

    ) {

      return value;

    }



    if (

      value.startsWith("/")

    ) {

      return `${NCS_SITE_URL}${value}`;

    }

  }



  return null;

}




function productImageCandidates(
  product: ProductRow,
): string[] {
  const rawCandidates = [
    // Prefer a permanent WhatsApp-safe JPEG/PNG preview when available.
    product.social_preview_url,
    product.image_url,
    product.image,
    ...parseImageArray(
      product.images,
    ),
    ...parseImageArray(
      product.gallery_images,
    ),
  ];

  const normalized = rawCandidates
    .map(
      (candidate) =>
        candidate?.trim() || "",
    )
    .filter(Boolean)
    .map(
      (candidate) =>
        candidate.startsWith("/")
          ? `${NCS_SITE_URL}${candidate}`
          : candidate,
    )
    .filter(
      (candidate) =>
        /^https?:\/\//i.test(
          candidate,
        ),
    );

  return Array.from(
    new Set(normalized),
  );
}


function imageExtension(
  value: string,
): string {
  try {
    const pathname =
      new URL(value).pathname
        .toLowerCase();

    const match =
      pathname.match(
        /\.([a-z0-9]+)$/,
      );

    return match?.[1] || "";
  } catch {
    return "";
  }
}


function isMetaSupportedImageMime(
  value?: string | null,
): boolean {
  const mime =
    (value || "")
      .split(";")[0]
      .trim()
      .toLowerCase();

  return (
    mime === "image/jpeg" ||
    mime === "image/jpg" ||
    mime === "image/png"
  );
}


function isKnownUnsupportedImageUrl(
  value: string,
): boolean {
  const extension =
    imageExtension(value);

  return [
    "webp",
    "avif",
    "gif",
    "svg",
    "heic",
    "heif",
  ].includes(extension);
}


async function probeMetaCompatibleImageUrl(
  imageUrl: string,
): Promise<boolean> {
  if (
    isKnownUnsupportedImageUrl(
      imageUrl,
    )
  ) {
    return false;
  }

  const extension =
    imageExtension(imageUrl);

  const fallbackByExtension =
    [
      "jpg",
      "jpeg",
      "png",
    ].includes(extension);

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      5000,
    );

  try {
    const response =
      await fetch(
        imageUrl,
        {
          method: "HEAD",
          redirect: "follow",
          headers: {
            Accept:
              "image/jpeg,image/png;q=0.9,*/*;q=0.1",
          },
          cache: "no-store",
          signal:
            controller.signal,
        },
      );

    if (!response.ok) {
      return fallbackByExtension;
    }

    const contentType =
      response.headers.get(
        "content-type",
      );

    if (
      isMetaSupportedImageMime(
        contentType,
      )
    ) {
      return true;
    }

    if (
      contentType
        ?.toLowerCase()
        .includes("webp") ||
      contentType
        ?.toLowerCase()
        .includes("avif") ||
      contentType
        ?.toLowerCase()
        .includes("gif") ||
      contentType
        ?.toLowerCase()
        .includes("svg")
    ) {
      return false;
    }

    return fallbackByExtension;
  } catch {
    return fallbackByExtension;
  } finally {
    clearTimeout(timeout);
  }
}


async function resolveMetaCompatibleImageUrl(
  product: ProductRow,
): Promise<string | null> {
  const candidates =
    productImageCandidates(
      product,
    );

  const ordered = [
    ...candidates.filter(
      (candidate) => {
        const extension =
          imageExtension(
            candidate,
          );

        return [
          "jpg",
          "jpeg",
          "png",
        ].includes(
          extension,
        );
      },
    ),
    ...candidates.filter(
      (candidate) => {
        const extension =
          imageExtension(
            candidate,
          );

        return ![
          "jpg",
          "jpeg",
          "png",
        ].includes(
          extension,
        );
      },
    ),
  ];

  for (
    const candidate of
    ordered
  ) {
    if (
      await probeMetaCompatibleImageUrl(
        candidate,
      )
    ) {
      return candidate;
    }
  }

  return null;
}


function productImageProxyUrl(
  product: ProductRow,
): string | null {
  const source =
    productImageCandidates(
      product,
    )[0];

  if (!source) {
    return null;
  }

  return (
    `${NCS_SITE_URL}/api/whatsapp/product-image?src=` +
    encodeURIComponent(source)
  );
}


function productUrl(

  product: ProductRow,

): string {

  /*
   * The current NEW CITY STYLE product page loads by numeric products.id:
   * /product/[id] -> supabase.from("products").eq("id", params.id)
   *
   * Do not use the SEO slug here unless the product page itself is upgraded
   * to resolve both slug and id. Numeric id keeps WhatsApp links reliable.
   */
  return (

    `${NCS_SITE_URL}/product/` +

    encodeURIComponent(
      String(product.id),
    )

  );

}



function queryTerms(
  messageText: string,
): string[] {
  const normalized =
    normalizeSearchText(
      messageText,
    );

  if (!normalized) {
    return [];
  }

  return Array.from(
    new Set(
      normalized
        .split(" ")
        .map(
          (item) =>
            item.trim(),
        )
        .filter(
          (item) =>
            item.length >= 3 &&
            !SEARCH_STOP_WORDS.has(
              item,
            ) &&
            !/^\d+$/.test(
              item,
            ),
        ),
    ),
  ).slice(0, 12);
}

function parseSmartPriceIntent(
  messageText: string,
): {
  minPrice: number | null;
  maxPrice: number | null;
} {
  const text =
    messageText
      .toLowerCase()
      .replace(/,/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const amount = (
    value?: string,
  ): number | null => {
    const parsed =
      Number(value);

    if (
      !Number.isFinite(parsed) ||
      parsed < 100 ||
      parsed > 500000
    ) {
      return null;
    }

    return Math.round(parsed);
  };

  const rangeMatch =
    text.match(
      /(?:between\s+)?(?:₹|rs\.?\s*)?(\d{3,6})\s*(?:to|-|–|—|and|nundi|నుండి)\s*(?:₹|rs\.?\s*)?(\d{3,6})/i,
    );

  if (rangeMatch) {
    const first =
      amount(rangeMatch[1]);
    const second =
      amount(rangeMatch[2]);

    if (
      first != null &&
      second != null
    ) {
      return {
        minPrice:
          Math.min(
            first,
            second,
          ),
        maxPrice:
          Math.max(
            first,
            second,
          ),
      };
    }
  }

  const maxBeforeNumber =
    text.match(
      /(?:under|below|upto|up to|within|less than|max(?:imum)?|budget(?: of)?|లోపు|కంటే తక్కువ)\s*(?:₹|rs\.?\s*)?(\d{3,6})/i,
    );

  const maxAfterNumber =
    text.match(
      /(?:₹|rs\.?\s*)?(\d{3,6})\s*(?:lopu|kinda|below|within|budget|లోపు|కింద)/i,
    );

  const maxBudgetPhrase =
    text.match(
      /(?:budget|price)\s*(?:₹|rs\.?\s*)?(\d{3,6})/i,
    );

  const maxValue =
    amount(
      maxBeforeNumber?.[1] ||
      maxAfterNumber?.[1] ||
      maxBudgetPhrase?.[1],
    );

  const minBeforeNumber =
    text.match(
      /(?:above|over|more than|minimum|min|starting from|from|paina|పైన|కంటే ఎక్కువ)\s*(?:₹|rs\.?\s*)?(\d{3,6})/i,
    );

  const minAfterNumber =
    text.match(
      /(?:₹|rs\.?\s*)?(\d{3,6})\s*(?:above|over|paina|పైన)/i,
    );

  const minValue =
    amount(
      minBeforeNumber?.[1] ||
      minAfterNumber?.[1],
    );

  if (
    maxValue != null ||
    minValue != null
  ) {
    return {
      minPrice:
        minValue,
      maxPrice:
        maxValue,
    };
  }

  const rupeeAmount =
    text.match(
      /(?:₹|rs\.?\s*)(\d{3,6})/i,
    );

  if (
    rupeeAmount &&
    /\b(?:lo|lopu|budget|within|under|below)\b/i.test(
      text,
    )
  ) {
    return {
      minPrice: null,
      maxPrice:
        amount(
          rupeeAmount[1],
        ),
    };
  }

  return {
    minPrice: null,
    maxPrice: null,
  };
}

function parseSmartSizes(
  messageText: string,
): string[] {
  const normalized =
    normalizeSearchText(
      messageText,
    );

  const found =
    new Set<string>();

  const aliases: Array<{
    pattern: RegExp;
    value: string;
  }> = [
    {
      pattern: /\bfree size\b/i,
      value: "free size",
    },
    {
      pattern: /\b6xl\b/i,
      value: "6xl",
    },
    {
      pattern: /\b5xl\b/i,
      value: "5xl",
    },
    {
      pattern: /\b4xl\b/i,
      value: "4xl",
    },
    {
      pattern: /\b3xl\b/i,
      value: "3xl",
    },
    {
      pattern: /\b(?:2xl|xxl)\b/i,
      value: "xxl",
    },
    {
      pattern: /\bxl\b/i,
      value: "xl",
    },
    {
      pattern: /\bxs\b/i,
      value: "xs",
    },
    {
      pattern: /\bxxs\b/i,
      value: "xxs",
    },
    {
      pattern: /\bsize\s+s\b|\bs\s+size\b/i,
      value: "s",
    },
    {
      pattern: /\bsize\s+m\b|\bm\s+size\b/i,
      value: "m",
    },
    {
      pattern: /\bsize\s+l\b|\bl\s+size\b/i,
      value: "l",
    },
  ];

  for (
    const alias of
    aliases
  ) {
    if (
      alias.pattern.test(
        normalized,
      )
    ) {
      found.add(
        alias.value,
      );
    }
  }

  const numericSize =
    normalized.match(
      /\b(?:size\s*)?(28|30|32|34|36|38|40|42|44|46|48|50)(?:\s*size)?\b/i,
    );

  if (
    numericSize &&
    (
      normalized.includes(
        "size",
      ) ||
      normalized.includes(
        "సైజ్",
      )
    )
  ) {
    found.add(
      numericSize[1],
    );
  }

  return Array.from(
    found,
  );
}

function includesAny(
  haystack: string,
  needles: string[],
): boolean {
  return needles.some(
    (needle) =>
      haystack.includes(
        needle,
      ),
  );
}

function parseSmartProductIntent(
  messageText: string,
): SmartProductIntent {
  const normalized =
    normalizeSearchText(
      messageText,
    );

  const price =
    parseSmartPriceIntent(
      messageText,
    );

  const sizes =
    parseSmartSizes(
      messageText,
    );

  const explicitTShirtIntent =
    includesAny(
      normalized,
      [
        "t shirt",
        "t shirts",
        "tshirt",
        "tshirts",
        "tee",
        "tees",
      ],
    );

  let categoryHints =
    Array.from(
      new Set(
        SMART_CATEGORY_ALIASES
          .filter(
            (group) =>
              includesAny(
                normalized,
                group.triggers,
              ),
          )
          .flatMap(
            (group) =>
              group.hints,
          ),
      ),
    );

  /*
   * STAGE 11.2 • EXACT CATEGORY LOCK
   * "T-Shirts" contains the word "shirt", so the older broad matcher could
   * also pull normal Shirts. When T-Shirt intent is explicit, remove the
   * broad Shirt hint and keep only T-Shirt / Tee signals.
   */
  if (explicitTShirtIntent) {
    categoryHints =
      categoryHints.filter(
        (hint) =>
          ![
            "shirt",
            "shirts",
          ].includes(hint),
      );
  }

  const colorHints =
    SMART_COLOR_TERMS.filter(
      (term) =>
        normalized.includes(
          term,
        ),
    );

  const fabricHints =
    SMART_FABRIC_TERMS.filter(
      (term) =>
        normalized.includes(
          term,
        ),
    );

  const wantsOffers =
    includesAny(
      normalized,
      [
        "offer",
        "offers",
        "sale",
        "discount",
        "discounts",
        "deal",
        "deals",
        "ఆఫర్",
      ],
    );

  const wantsNewArrivals =
    includesAny(
      normalized,
      [
        "new arrival",
        "new arrivals",
        "new collection",
        "latest",
        "కొత్త",
      ],
    );

  const wantsBestSellers =
    includesAny(
      normalized,
      [
        "best seller",
        "bestseller",
        "best selling",
        "popular",
      ],
    );

  const wantsTrending =
    includesAny(
      normalized,
      [
        "trending",
        "trend",
        "trendy",
      ],
    );

  const wantsFeatured =
    includesAny(
      normalized,
      [
        "featured",
        "premium picks",
      ],
    );

  const audience: SmartProductIntent["audience"] =
    includesAny(
      normalized,
      [
        "kids",
        "kid",
        "child",
        "children",
        "boys",
        "girls",
        "boy",
        "girl",
        "కిడ్స్",
      ],
    )
      ? "kids"
      : includesAny(
            normalized,
            [
              "women",
              "woman",
              "womens",
              "ladies",
              "lady",
              "female",
            ],
          )
        ? "women"
        : includesAny(
              normalized,
              [
                "men",
                "man",
                "mens",
                "gents",
                "gent",
                "male",
              ],
            )
          ? "men"
          : null;

  const baseTerms =
    queryTerms(
      messageText,
    );

  const exactBaseTerms =
    explicitTShirtIntent
      ? baseTerms.filter(
          (term) =>
            ![
              "shirt",
              "shirts",
            ].includes(term),
        )
      : baseTerms;

  const terms =
    Array.from(
      new Set([
        ...exactBaseTerms,
        ...categoryHints,
        ...colorHints,
        ...fabricHints,
      ]),
    ).slice(
      0,
      18,
    );

  const hasStructuredIntent =
    price.minPrice != null ||
    price.maxPrice != null ||
    sizes.length > 0 ||
    wantsOffers ||
    wantsNewArrivals ||
    wantsBestSellers ||
    wantsTrending ||
    wantsFeatured ||
    audience != null ||
    categoryHints.length > 0 ||
    colorHints.length > 0 ||
    fabricHints.length > 0;

  return {
    normalized,
    terms,
    minPrice:
      price.minPrice,
    maxPrice:
      price.maxPrice,
    sizes,
    wantsOffers,
    wantsNewArrivals,
    wantsBestSellers,
    wantsTrending,
    wantsFeatured,
    audience,
    categoryHints,
    colorHints,
    fabricHints,
    hasStructuredIntent,
  };
}


const CUSTOMER_SMALL_TALK_WORDS =
  new Set([
    "hi",
    "hello",
    "hey",
    "hii",
    "hai",
    "ok",
    "okay",
    "thanks",
    "thank",
    "you",
    "good",
    "morning",
    "afternoon",
    "evening",
    "bro",
    "anna",
    "sir",
    "madam",
    "please",
    "pls",
    "yes",
    "yeah",
    "yup",
    "no",
    "bye",
    "namaste",
  ]);

function isOnlyCustomerSmallTalk(
  messageText: string,
): boolean {
  const normalized =
    normalizeSearchText(
      messageText,
    );

  if (!normalized) {
    return true;
  }

  const words =
    normalized
      .split(" ")
      .map(
        (word) => word.trim(),
      )
      .filter(Boolean);

  return (
    words.length > 0 &&
    words.every(
      (word) =>
        CUSTOMER_SMALL_TALK_WORDS.has(
          word,
        ),
    )
  );
}

/*
 * CUSTOMER-INITIATED SHOPPING RULE
 *
 * The 6-hour cooldown is for repeated generic/welcome promotion only.
 * A customer who actively asks for product information must be able to
 * search the catalogue whenever they want.
 *
 * Examples that bypass cooldown:
 *   "black shirt"
 *   "shirts under 500"
 *   "XL"
 *   "price"
 *   "offers"
 *   "new arrivals"
 *   "cotton"
 *   "technosport"
 *
 * Generic small-talk such as "hi", "ok", "thanks", "good morning"
 * keeps the normal 6-hour protection after the first welcome reply.
 */
function shouldBypassCooldownForCustomerQuery(
  messageText: string,
): boolean {
  const normalized =
    normalizeSearchText(
      messageText,
    );

  if (!normalized) {
    return false;
  }

  const intent =
    parseSmartProductIntent(
      messageText,
    );

  if (
    intent.hasStructuredIntent ||
    intent.terms.length > 0
  ) {
    return true;
  }

  return !isOnlyCustomerSmallTalk(
    messageText,
  );
}

function productSearchText(
  product: ProductRow,
): string {
  const sizes =
    parseImageArray(
      product.sizes,
    );

  const tags =
    parseImageArray(
      product.tags,
    );

  return normalizeSearchText(
    [
      product.name,
      product.brand,
      product.category,
      product.subcategory,
      product.gender,
      product.age_group,
      product.material,
      product.fabric,
      product.pattern,
      product.occasion,
      ...sizes,
      ...tags,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function productDiscountPercent(
  product: ProductRow,
): number {
  const sellingPrice =
    safeNumber(
      product.price,
    );

  const mrp =
    safeNumber(
      product.online_mrp,
    ) ||
    safeNumber(
      product.mrp,
    ) ||
    sellingPrice;

  if (
    sellingPrice <= 0 ||
    mrp <= sellingPrice
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      (
        (
          mrp -
          sellingPrice
        ) /
        mrp
      ) *
        100,
    ),
  );
}

function productMatchesHardIntent(
  product: ProductRow,
  intent: SmartProductIntent,
): boolean {
  const sellingPrice =
    safeNumber(
      product.price,
    );

  if (
    intent.minPrice != null &&
    (
      sellingPrice <= 0 ||
      sellingPrice <
        intent.minPrice
    )
  ) {
    return false;
  }

  if (
    intent.maxPrice != null &&
    (
      sellingPrice <= 0 ||
      sellingPrice >
        intent.maxPrice
    )
  ) {
    return false;
  }

  if (
    intent.wantsOffers &&
    productDiscountPercent(
      product,
    ) <= 0
  ) {
    return false;
  }

  if (
    intent.wantsNewArrivals &&
    !product.is_new_arrival
  ) {
    return false;
  }

  if (
    intent.wantsBestSellers &&
    !product.is_bestseller
  ) {
    return false;
  }

  if (
    intent.wantsTrending &&
    !product.is_trending
  ) {
    return false;
  }

  if (
    intent.wantsFeatured &&
    !product.is_featured
  ) {
    return false;
  }

  return true;
}

function scoreProduct(
  product: ProductRow,
  intent: SmartProductIntent,
): number {
  const name =
    normalizeSearchText(
      product.name,
    );
  const brand =
    normalizeSearchText(
      product.brand,
    );
  const category =
    normalizeSearchText(
      product.category,
    );
  const subcategory =
    normalizeSearchText(
      product.subcategory,
    );
  const gender =
    normalizeSearchText(
      product.gender,
    );
  const searchText =
    productSearchText(
      product,
    );

  let score = 0;

  for (
    const term of
    intent.terms
  ) {
    if (
      name.includes(term)
    ) {
      score += 16;
    }

    if (
      subcategory.includes(
        term,
      )
    ) {
      score += 12;
    }

    if (
      category.includes(
        term,
      )
    ) {
      score += 10;
    }

    if (
      brand.includes(term)
    ) {
      score += 7;
    }

    if (
      gender.includes(term)
    ) {
      score += 6;
    }

    if (
      searchText.includes(
        term,
      )
    ) {
      score += 5;
    }
  }

  if (
    intent.categoryHints.length &&
    includesAny(
      searchText,
      intent.categoryHints,
    )
  ) {
    score += 20;
  }

  if (
    intent.colorHints.length &&
    includesAny(
      searchText,
      intent.colorHints,
    )
  ) {
    score += 16;
  }

  if (
    intent.fabricHints.length &&
    includesAny(
      searchText,
      intent.fabricHints,
    )
  ) {
    score += 12;
  }

  if (
    intent.sizes.length
  ) {
    const sizesText =
      normalizeSearchText(
        parseImageArray(
          product.sizes,
        ).join(" "),
      );

    if (
      includesAny(
        sizesText,
        intent.sizes,
      )
    ) {
      score += 18;
    }
  }

  if (
    intent.audience
  ) {
    const audienceMatches =
      intent.audience ===
        "kids"
        ? includesAny(
            searchText,
            [
              "kids",
              "kid",
              "boys",
              "boy",
              "girls",
              "girl",
              "children",
              "child",
            ],
          )
        : intent.audience ===
            "women"
          ? includesAny(
              searchText,
              [
                "women",
                "woman",
                "womens",
                "ladies",
                "lady",
                "female",
              ],
            )
          : includesAny(
              searchText,
              [
                "men",
                "man",
                "mens",
                "gents",
                "gent",
                "male",
              ],
            );

    if (
      audienceMatches
    ) {
      score += 18;
    }
  }

  if (
    intent.wantsOffers
  ) {
    score += Math.min(
      20,
      productDiscountPercent(
        product,
      ),
    );
  }

  if (
    intent.wantsNewArrivals &&
    product.is_new_arrival
  ) {
    score += 16;
  }

  if (
    intent.wantsBestSellers &&
    product.is_bestseller
  ) {
    score += 16;
  }

  if (
    intent.wantsTrending &&
    product.is_trending
  ) {
    score += 14;
  }

  if (
    intent.wantsFeatured &&
    product.is_featured
  ) {
    score += 12;
  }

  if (
    product.is_featured
  ) {
    score += 4;
  }

  if (
    product.is_new_arrival
  ) {
    score += 3;
  }

  if (
    product.is_bestseller
  ) {
    score += 3;
  }

  if (
    product.is_trending
  ) {
    score += 2;
  }

  return score;
}

function stableOffset(
  value: string,
  max: number,
): number {
  if (max <= 1) {
    return 0;
  }

  let hash = 0;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash =
      (
        hash * 31 +
        value.charCodeAt(index)
      ) >>> 0;
  }

  return hash % max;
}

function chooseProducts(
  pool: ProductRow[],
  messageText: string,
  previousProductIds: number[],
  messageId: string,
): ProductRow[] {
  const previous =
    new Set(
      previousProductIds,
    );

  const intent =
    parseSmartProductIntent(
      messageText,
    );

  const baseEligible =
    pool.filter(
      (product) =>
        safeNumber(
          product.stock,
        ) > 0 &&
        Boolean(
          productImage(
            product,
          ),
        ),
    );

  const strictEligible =
    intent.hasStructuredIntent
      ? baseEligible.filter(
          (product) =>
            productMatchesHardIntent(
              product,
              intent,
            ),
        )
      : baseEligible;

  /*
   * Safety / continuity rule:
   * If a customer asks for a very narrow constraint and there is no exact
   * catalogue match, keep the eligible catalogue pool available for a
   * genuine shopping request. Stage 11 prevents unrelated messages from
   * reaching this fallback path.
   */
  const candidatePool =
    strictEligible.length > 0
      ? strictEligible
      : baseEligible;

  const ranked =
    candidatePool
      .map(
        (product) => ({
          product,
          score:
            scoreProduct(
              product,
              intent,
            ),
          repeated:
            previous.has(
              Number(
                product.id,
              ),
            ),
          updatedAt:
            Date.parse(
              product.updated_at ||
                "",
            ) || 0,
        }),
      )
      .sort(
        (left, right) => {
          if (
            left.repeated !==
            right.repeated
          ) {
            return left.repeated
              ? 1
              : -1;
          }

          if (
            right.score !==
            left.score
          ) {
            return (
              right.score -
              left.score
            );
          }

          return (
            right.updatedAt -
            left.updatedAt
          );
        },
      );

  if (
    ranked.length <=
    PRODUCT_COUNT
  ) {
    return ranked.map(
      (item) =>
        item.product,
    );
  }

  const meaningfulMatch =
    (
      intent.terms.length > 0 ||
      intent.hasStructuredIntent
    ) &&
    ranked.some(
      (item) =>
        item.score >= 8,
    );

  if (
    meaningfulMatch
  ) {
    return ranked
      .slice(
        0,
        PRODUCT_COUNT,
      )
      .map(
        (item) =>
          item.product,
      );
  }

  const rotationPool =
    ranked.slice(
      0,
      Math.min(
        18,
        ranked.length,
      ),
    );

  const offset =
    stableOffset(
      messageId,
      rotationPool.length,
    );

  return Array.from(
    {
      length:
        Math.min(
          PRODUCT_COUNT,
          rotationPool.length,
        ),
    },
    (_, index) =>
      rotationPool[
        (
          offset +
          index
        ) %
          rotationPool.length
      ].product,
  );
}



/* ============================================================
   NCS UNIFIED INVENTORY BRAIN • 2036

   Online catalogue + Billing/POS physical stock are searched as
   one customer-facing inventory. Generic "Hi" behaviour remains
   on the existing online catalogue flow; this layer is used only
   when the customer is actively asking about a product/brand/
   category/size/colour/budget.
============================================================ */

const INVENTORY_QUERY_STOP_WORDS =
  new Set([
    ...Array.from(
      SEARCH_STOP_WORDS,
    ),
    "available",
    "availability",
    "stock",
    "store",
    "shop",
    "shoplo",
    "shopulo",
    "vunda",
    "vundi",
    "unda",
    "unada",
    "unnadi",
    "unnai",
    "unnayi",
    "untunda",
    "dorukutunda",
    "dorukuthunda",
    "cheppu",
    "cheppandi",
    "tell",
    "me",
    "have",
    "has",
    "there",
    "is",
    "are",
    "do",
    "does",
    "can",
    "get",
    "give",
    "some",
    "any",
    "one",
    "please",
    "new",
    "arrival",
    "arrivals",
    "latest",
    "offer",
    "offers",
    "sale",
    "discount",
    "discounts",
    "deal",
    "deals",
    "trending",
    "trend",
    "trendy",
    "best",
    "seller",
    "sellers",
    "bestseller",
    "bestsellers",
    "popular",
    "featured",
    "premium",
    "cheap",
    "cheaper",
    "costly",
    "quality",
    "same",
    "model",
    "another",
    "other",
    "similar",
    "option",
    "best",
    "picks",
    "address",
    "location",
    "where",
    "hours",
    "timing",
    "timings",
    "contact",
    "phone",
    "number",
    "under",
    "below",
    "upto",
    "up",
    "to",
    "within",
    "less",
    "than",
    "budget",
    "of",
    "max",
    "maximum",
    "above",
    "over",
    "more",
    "minimum",
    "min",
    "starting",
    "from",
    "between",
    "and",
    "lo",
    "lopu",
    "kinda",
    "paina",
    "nundi",
    "లోపు",
    "కింద",
    "పైన",
    "నుండి",
  ]);

function inventoryQueryTerms(
  messageText: string,
): string[] {
  const normalized =
    normalizeSearchText(
      messageText,
    );

  if (!normalized) {
    return [];
  }

  const asksTShirt =
    /(?:^|\s)(?:t\s*shirts?|tshirts?|tee|tees)(?:$|\s)/.test(
      normalized,
    );

  const rawTerms =
    normalized
      .split(" ")
      .map(
        (item) =>
          item.trim(),
      )
      .filter(
        (item) =>
          item.length >= 2 &&
          !INVENTORY_QUERY_STOP_WORDS.has(
            item,
          ) &&
          !/^\d+$/.test(
            item,
          ),
      );

  const exactTerms =
    asksTShirt
      ? [
          "t shirt",
          ...rawTerms.filter(
            (term) =>
              ![
                "shirt",
                "shirts",
                "tshirt",
                "tshirts",
              ].includes(term),
          ),
        ]
      : rawTerms;

  return Array.from(
    new Set(
      exactTerms,
    ),
  ).slice(
    0,
    12,
  );
}

function compactSearchText(
  value?: string | null,
): string {
  return normalizeSearchText(
    value,
  ).replace(
    /\s+/g,
    "",
  );
}

function levenshteinDistance(
  left: string,
  right: string,
): number {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const previous =
    Array.from(
      {
        length:
          right.length + 1,
      },
      (_, index) =>
        index,
    );

  for (
    let leftIndex = 1;
    leftIndex <= left.length;
    leftIndex += 1
  ) {
    let diagonal =
      previous[0];

    previous[0] =
      leftIndex;

    for (
      let rightIndex = 1;
      rightIndex <= right.length;
      rightIndex += 1
    ) {
      const upper =
        previous[
          rightIndex
        ];

      const substitutionCost =
        left[
          leftIndex - 1
        ] ===
        right[
          rightIndex - 1
        ]
          ? 0
          : 1;

      previous[
        rightIndex
      ] =
        Math.min(
          previous[
            rightIndex
          ] + 1,
          previous[
            rightIndex - 1
          ] + 1,
          diagonal +
            substitutionCost,
        );

      diagonal = upper;
    }
  }

  return previous[
    right.length
  ];
}

function fuzzySimilarity(
  left?: string | null,
  right?: string | null,
): number {
  const a =
    compactSearchText(
      left,
    );

  const b =
    compactSearchText(
      right,
    );

  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  if (
    a.includes(b) ||
    b.includes(a)
  ) {
    const shorter =
      Math.min(
        a.length,
        b.length,
      );

    const longer =
      Math.max(
        a.length,
        b.length,
      );

    return Math.max(
      0.86,
      shorter / longer,
    );
  }

  const maxLength =
    Math.max(
      a.length,
      b.length,
    );

  if (maxLength === 0) {
    return 1;
  }

  return Math.max(
    0,
    1 -
      levenshteinDistance(
        a,
        b,
      ) /
        maxLength,
  );
}

function fuzzyTermFieldScore(
  term: string,
  field?: string | null,
  exactScore = 50,
  fuzzyScore = 34,
): number {
  const normalizedTerm =
    normalizeSearchText(
      term,
    );

  const normalizedField =
    normalizeSearchText(
      field,
    );

  if (
    !normalizedTerm ||
    !normalizedField
  ) {
    return 0;
  }

  if (
    normalizedField ===
      normalizedTerm ||
    compactSearchText(
      normalizedField,
    ) ===
      compactSearchText(
        normalizedTerm,
      )
  ) {
    return exactScore;
  }

  if (
    normalizedField.includes(
      normalizedTerm,
    )
  ) {
    return Math.max(
      fuzzyScore + 8,
      exactScore - 8,
    );
  }

  const fieldTokens =
    normalizedField
      .split(" ")
      .filter(Boolean);

  if (
    fieldTokens.some(
      (token) =>
        token ===
        normalizedTerm,
    )
  ) {
    return Math.max(
      fuzzyScore + 6,
      exactScore - 10,
    );
  }

  if (
    normalizedTerm.length < 4
  ) {
    return 0;
  }

  let similarity =
    fuzzySimilarity(
      normalizedTerm,
      normalizedField,
    );

  for (
    const token of
    fieldTokens
  ) {
    if (
      token.length >= 4
    ) {
      similarity =
        Math.max(
          similarity,
          fuzzySimilarity(
            normalizedTerm,
            token,
          ),
        );
    }
  }

  if (
    similarity >= 0.9
  ) {
    return fuzzyScore + 10;
  }

  if (
    similarity >= 0.82
  ) {
    return fuzzyScore;
  }

  return 0;
}

function variantAvailableStock(
  variant: InventoryVariantRow,
): number {
  return Math.max(
    0,
    safeNumber(
      variant.stock,
    ) -
      safeNumber(
        variant.reserved_stock,
      ),
  );
}

function variantStorePrice(
  variant: InventoryVariantRow,
): number {
  return (
    safeNumber(
      variant.selling_price,
    ) ||
    safeNumber(
      variant.online_price,
    ) ||
    0
  );
}

function uniqueCleanValues(
  values: Array<
    string | null | undefined
  >,
): string[] {
  return Array.from(
    new Set(
      values
        .map(
          (value) =>
            value?.trim() ||
            "",
        )
        .filter(Boolean),
    ),
  );
}

function inventoryProductSearchText(
  product: ProductRow,
  variants: InventoryVariantRow[],
): string {
  return normalizeSearchText(
    [
      product.name,
      product.brand,
      product.category,
      product.subcategory,
      product.gender,
      product.age_group,
      product.material,
      product.fabric,
      product.pattern,
      product.occasion,
      product.sku,
      product.barcode,
      ...parseImageArray(
        product.sizes,
      ),
      ...parseImageArray(
        product.tags,
      ),
      ...variants.flatMap(
        (variant) => [
          variant.size,
          variant.color,
          variant.sku,
          variant.barcode,
          variant.variant_name,
        ],
      ),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function matchesRequestedSize(
  requestedSizes: string[],
  product: ProductRow,
  variants: InventoryVariantRow[],
): boolean {
  if (
    requestedSizes.length ===
    0
  ) {
    return true;
  }

  const availableVariantSizes =
    uniqueCleanValues(
      variants
        .filter(
          (variant) =>
            variantAvailableStock(
              variant,
            ) > 0,
        )
        .map(
          (variant) =>
            variant.size,
        ),
    ).map(
      (size) =>
        normalizeSearchText(
          size,
        ),
    );

  const productSizes =
    parseImageArray(
      product.sizes,
    ).map(
      (size) =>
        normalizeSearchText(
          size,
        ),
    );

  const available =
    new Set(
      availableVariantSizes
        .length > 0
        ? availableVariantSizes
        : productSizes,
    );

  return requestedSizes.some(
    (size) =>
      available.has(
        normalizeSearchText(
          size,
        ),
      ),
  );
}

function matchesRequestedColor(
  requestedColors: string[],
  product: ProductRow,
  variants: InventoryVariantRow[],
): boolean {
  if (
    requestedColors.length ===
    0
  ) {
    return true;
  }

  const variantColors =
    uniqueCleanValues(
      variants
        .filter(
          (variant) =>
            variantAvailableStock(
              variant,
            ) > 0,
        )
        .map(
          (variant) =>
            variant.color,
        ),
    );

  if (
    variantColors.length > 0
  ) {
    const variantColorText =
      normalizeSearchText(
        variantColors.join(
          " ",
        ),
      );

    return requestedColors.some(
      (color) =>
        variantColorText.includes(
          normalizeSearchText(
            color,
          ),
        ),
    );
  }

  const searchable =
    normalizeSearchText(
      [
        product.name,
        product.category,
        product.subcategory,
        ...parseImageArray(
          product.tags,
        ),
      ]
        .filter(Boolean)
        .join(" "),
    );

  return requestedColors.some(
    (color) =>
      searchable.includes(
        normalizeSearchText(
          color,
        ),
      ),
  );
}

function inventoryDisplayPrices(
  product: ProductRow,
  variants: InventoryVariantRow[],
): {
  sellingPriceMin: number;
  sellingPriceMax: number;
  mrpMin: number;
  mrpMax: number;
} {
  const variantSellingPrices =
    variants
      .filter(
        (variant) =>
          variantAvailableStock(
            variant,
          ) > 0,
      )
      .map(
        variantStorePrice,
      )
      .filter(
        (value) =>
          value > 0,
      );

  const fallbackSellingPrice =
    safeNumber(
      product.price,
    );

  const sellingPrices =
    variantSellingPrices.length
      ? variantSellingPrices
      : fallbackSellingPrice > 0
        ? [
            fallbackSellingPrice,
          ]
        : [];

  const variantMrps =
    variants
      .filter(
        (variant) =>
          variantAvailableStock(
            variant,
          ) > 0,
      )
      .map(
        (variant) =>
          safeNumber(
            variant.mrp,
          ),
      )
      .filter(
        (value) =>
          value > 0,
      );

  const fallbackMrp =
    safeNumber(
      product.mrp,
    ) ||
    safeNumber(
      product.online_mrp,
    );

  const mrps =
    variantMrps.length
      ? variantMrps
      : fallbackMrp > 0
        ? [
            fallbackMrp,
          ]
        : [];

  return {
    sellingPriceMin:
      sellingPrices.length
        ? Math.min(
            ...sellingPrices,
          )
        : 0,
    sellingPriceMax:
      sellingPrices.length
        ? Math.max(
            ...sellingPrices,
          )
        : 0,
    mrpMin:
      mrps.length
        ? Math.min(
            ...mrps,
          )
        : 0,
    mrpMax:
      mrps.length
        ? Math.max(
            ...mrps,
          )
        : 0,
  };
}

function inventoryBestImage(
  product: ProductRow,
  variants: InventoryVariantRow[],
  intent: SmartProductIntent,
): string | null {
  const matchingVariants =
    variants.filter(
      (variant) => {
        if (
          variantAvailableStock(
            variant,
          ) <= 0
        ) {
          return false;
        }

        if (
          intent.sizes.length >
            0 &&
          !intent.sizes.includes(
            normalizeSearchText(
              variant.size,
            ),
          )
        ) {
          return false;
        }

        if (
          intent.colorHints.length >
            0 &&
          !intent.colorHints.some(
            (color) =>
              normalizeSearchText(
                variant.color,
              ).includes(
                normalizeSearchText(
                  color,
                ),
              ),
          )
        ) {
          return false;
        }

        return true;
      },
    );

  const variantImages =
    [
      ...matchingVariants,
      ...variants,
    ]
      .flatMap(
        (variant) => [
          variant.main_image,
          ...parseImageArray(
            variant.gallery_images,
          ),
        ],
      )
      .map(
        (value) =>
          value?.trim() || "",
      )
      .filter(Boolean);

  const candidates = [
    product.social_preview_url,
    ...variantImages,
    product.image_url,
    product.image,
    ...parseImageArray(
      product.images,
    ),
    ...parseImageArray(
      product.gallery_images,
    ),
  ]
    .map(
      (value) =>
        value?.trim() || "",
    )
    .filter(Boolean);

  const direct =
    candidates.find(
      isDirectWhatsAppImageUrl,
    );

  return (
    direct ||
    candidates[0] ||
    null
  );
}

function inventoryIsOnline(
  product: ProductRow,
  variants: InventoryVariantRow[],
): boolean {
  if (
    product.sell_online ===
    true
  ) {
    return true;
  }

  return variants.some(
    (variant) =>
      variant.sell_online ===
        true &&
      variantAvailableStock(
        variant,
      ) > 0 &&
      (
        safeNumber(
          variant.online_stock_limit,
        ) > 0 ||
        safeNumber(
          product.online_stock_limit,
        ) > 0
      ),
  );
}

function inventoryAvailabilityLabel(
  availableStock: number,
  product: ProductRow,
): "Available" | "Few Left" {
  const configuredLimit =
    safeNumber(
      product.low_stock_limit,
    );

  const threshold =
    Math.max(
      2,
      Math.min(
        4,
        configuredLimit > 0
          ? configuredLimit
          : 3,
      ),
    );

  return availableStock <=
    threshold
    ? "Few Left"
    : "Available";
}

function hasInventoryAvailabilityLanguage(
  normalized: string,
): boolean {
  return includesAny(
    normalized,
    [
      "available",
      "availability",
      "stock",
      "unda",
      "vunda",
      "unnaya",
      "unnayi",
      "untunda",
      "dorukutunda",
      "dorukuthunda",
      "ఉందా",
      "ఉన్నాయా",
      "స్టాక్",
    ],
  );
}

function shouldUseUnifiedInventorySearch(
  messageText: string,
): boolean {
  const intent =
    parseSmartProductIntent(
      messageText,
    );

  const terms =
    inventoryQueryTerms(
      messageText,
    );

  const physicalStructuredIntent =
    intent.minPrice != null ||
    intent.maxPrice != null ||
    intent.sizes.length > 0 ||
    intent.audience != null ||
    intent.categoryHints.length > 0 ||
    intent.colorHints.length > 0 ||
    intent.fabricHints.length > 0;

  if (
    physicalStructuredIntent
  ) {
    return true;
  }

  if (
    terms.length === 0
  ) {
    return false;
  }

  if (
    hasInventoryAvailabilityLanguage(
      intent.normalized,
    )
  ) {
    return true;
  }

  /*
   * A single unknown-looking word is commonly a brand name:
   * "Poomex", "Alafa", "Technosport", etc.
   */
  return (
    terms.length <= 3 &&
    terms.some(
      (term) =>
        term.length >= 4,
    )
  );
}

function scoreUnifiedInventoryResult(
  product: ProductRow,
  variants: InventoryVariantRow[],
  intent: SmartProductIntent,
  queryTerms: string[],
  previousProductIds: Set<number>,
): number {
  const searchText =
    inventoryProductSearchText(
      product,
      variants,
    );

  let score = 0;

  for (
    const term of
    queryTerms
  ) {
    score +=
      fuzzyTermFieldScore(
        term,
        product.brand,
        92,
        66,
      );

    score +=
      fuzzyTermFieldScore(
        term,
        product.name,
        68,
        42,
      );

    score +=
      fuzzyTermFieldScore(
        term,
        product.subcategory,
        55,
        34,
      );

    score +=
      fuzzyTermFieldScore(
        term,
        product.category,
        50,
        32,
      );

    if (
      searchText.includes(
        normalizeSearchText(
          term,
        ),
      )
    ) {
      score += 18;
    }
  }

  if (
    intent.categoryHints.length >
      0 &&
    includesAny(
      searchText,
      intent.categoryHints,
    )
  ) {
    score += 48;
  }

  if (
    intent.fabricHints.length >
      0 &&
    includesAny(
      searchText,
      intent.fabricHints,
    )
  ) {
    score += 30;
  }

  if (
    intent.colorHints.length >
      0 &&
    matchesRequestedColor(
      intent.colorHints,
      product,
      variants,
    )
  ) {
    score += 44;
  }

  if (
    intent.sizes.length >
      0 &&
    matchesRequestedSize(
      intent.sizes,
      product,
      variants,
    )
  ) {
    score += 58;
  }

  if (
    intent.audience
  ) {
    const audienceMatch =
      intent.audience ===
        "kids"
        ? includesAny(
            searchText,
            [
              "kids",
              "kid",
              "boy",
              "boys",
              "girl",
              "girls",
              "child",
              "children",
            ],
          )
        : intent.audience ===
            "women"
          ? includesAny(
              searchText,
              [
                "women",
                "woman",
                "womens",
                "ladies",
                "lady",
                "female",
              ],
            )
          : includesAny(
              searchText,
              [
                "men",
                "man",
                "mens",
                "gents",
                "gent",
                "male",
              ],
            );

    if (
      audienceMatch
    ) {
      score += 34;
    }
  }

  const prices =
    inventoryDisplayPrices(
      product,
      variants,
    );

  if (
    intent.minPrice != null ||
    intent.maxPrice != null
  ) {
    const price =
      prices.sellingPriceMin;

    if (price > 0) {
      score += 18;
    }
  }

  const hasOnlyRefinementIntent =
    queryTerms.length === 0 &&
    (
      intent.sizes.length > 0 ||
      intent.colorHints.length >
        0 ||
      intent.minPrice != null ||
      intent.maxPrice != null
    );

  if (
    hasOnlyRefinementIntent &&
    previousProductIds.has(
      Number(
        product.id,
      ),
    )
  ) {
    score += 70;
  }

  if (
    inventoryIsOnline(
      product,
      variants,
    )
  ) {
    score += 4;
  }

  return score;
}

function matchesStrictGarmentCategoryIntent(
  product: ProductRow,
  variants: InventoryVariantRow[],
  intent: SmartProductIntent,
): boolean {
  const normalized = normalizeSearchText(intent.normalized);

  const asksTShirt =
    /(?:^|\s)(?:t\s*shirts?|tshirts?|tee|tees)(?:$|\s)/.test(normalized);

  const asksPlainShirt =
    !asksTShirt &&
    /(?:^|\s)shirts?(?:$|\s)/.test(normalized);

  const productText =
    inventoryProductSearchText(
      product,
      variants,
    );

  /*
   * STAGE 11.2.1 • HARD T-SHIRT LOCK
   * An explicit T-Shirt request must match an actual T-Shirt / Tee signal.
   * A normal Shirt is rejected even though both contain the word "shirt".
   */
  if (asksTShirt) {
    const isTShirt =
      /(?:^|\s)(?:t\s*shirts?|tshirts?|tee|tees|round\s*neck|crew\s*neck)(?:$|\s)/.test(
        productText,
      );

    return isTShirt;
  }

  if (!asksPlainShirt) {
    return true;
  }

  const clearlyNotShirt =
    /(?:^|\s)(?:t\s*shirts?|tshirts?|tee|tees|round\s*neck|crew\s*neck|baniyan|banian|vest|innerwear|brief|briefs)(?:$|\s)/.test(
      productText,
    );

  if (clearlyNotShirt) {
    return false;
  }

  return /(?:^|\s)shirts?(?:$|\s)/.test(productText);
}

function resultMatchesInventoryHardIntent(
  product: ProductRow,
  variants: InventoryVariantRow[],
  intent: SmartProductIntent,
): boolean {
  if (
    !matchesStrictGarmentCategoryIntent(
      product,
      variants,
      intent,
    )
  ) {
    return false;
  }

  if (
    !matchesRequestedSize(
      intent.sizes,
      product,
      variants,
    )
  ) {
    return false;
  }

  if (
    !matchesRequestedColor(
      intent.colorHints,
      product,
      variants,
    )
  ) {
    return false;
  }

  const prices =
    inventoryDisplayPrices(
      product,
      variants,
    );

  if (
    intent.minPrice != null &&
    (
      prices.sellingPriceMax <=
        0 ||
      prices.sellingPriceMax <
        intent.minPrice
    )
  ) {
    return false;
  }

  if (
    intent.maxPrice != null &&
    (
      prices.sellingPriceMin <=
        0 ||
      prices.sellingPriceMin >
        intent.maxPrice
    )
  ) {
    return false;
  }

  return true;
}


/* ============================================================
   NCS CONVERSATIONAL SALES BRAIN • STAGE 3 CONTEXT FLOW • 2036

   Additive layer over the confirmed Unified Inventory Brain.
   - keeps current greeting / 3-product / photo / link behaviour
   - remembers recent product context for 24 hours
   - understands short follow-ups such as XL, black, price, more
   - supports 1 / 2 / 3 option selection
   - supports BOOK / RESERVE / HOLD with atomic stock protection
   - supports CANCEL and BOOKING STATUS
   - Stage 3: ordinal + size/colour refinement in one message
   - Stage 3: colour-only contextual follow-up across recent results
   - Stage 3: preserves the visible 1/2/3 result set after selection
   - Stage 4: multiple active booking status + numbered cancellation
   - Stage 4: clearer duplicate / expired / released booking feedback
   - Stage 5: combined brand/category/size/colour/price conversion queries
   - Stage 5: cheap / premium / best-option relevance-aware ranking
   - Stage 5: same-model other-colour + similar-products contextual refinement
   - Stage 6: matching-category cross-sell + same-brand discovery
   - Stage 6: multi-piece budget plans + selected-item full-set completion
   - Stage 7: automatic natural-language sales replies + context rewrites
   - Stage 7: last-viewed / my-size / same-budget / generic-discovery handling
   - Stage 8: returning-customer shopping memory + contextual welcome / preference reuse
   - Stage 9: follow-up opt-out / resume controls + scheduled re-engagement compatibility
   - never exposes exact internal stock quantities
============================================================ */

function reservationHoldMinutes(): number {
  const raw = Number(
    process.env.NCS_WHATSAPP_RESERVATION_MINUTES ||
      DEFAULT_RESERVATION_MINUTES,
  );

  if (!Number.isFinite(raw)) {
    return DEFAULT_RESERVATION_MINUTES;
  }

  return Math.min(
    720,
    Math.max(30, Math.trunc(raw)),
  );
}

function containsAnyPhrase(
  normalized: string,
  phrases: string[],
): boolean {
  return phrases.some(
    (phrase) =>
      normalized.includes(
        normalizeSearchText(phrase),
      ),
  );
}

function isReservationIntent(
  messageText: string,
): boolean {
  const normalized =
    normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "book",
      "book cheyyu",
      "book chey",
      "book pettu",
      "book pettandi",
      "book cheyyandi",
      "reserve",
      "reserve cheyyu",
      "reserve chey",
      "hold",
      "hold cheyyu",
      "hold cheyyandi",
      "keep aside",
      "keep it aside",
      "pakkana pettu",
      "pakkan pettu",
      "na kosam pettu",
      "naa kosam pettu",
      "naaku pettu",
      "naku pettu",
      "naaku pettandi",
      "naku pettandi",
      "idi naaku pettu",
      "idi naku pettu",
      "idi naaku pettandi",
      "idi naku pettandi",
      "okati pettu",
      "okati pettandi",
      "keep this for me",
      "save this for me",
      "this one book",
      "book this one",
      "reserve this one",
      "hold this one",
      "నా కోసం పెట్టు",
      "నాకు పెట్టు",
      "నాకు పెట్టండి",
      "ఇది నాకు పెట్టు",
      "ఇది నాకు పెట్టండి",
      "ఒకటి పెట్టు",
      "ఒకటి పెట్టండి",
      "పక్కన పెట్టు",
      "రిజర్వ్",
      "బుక్",
    ],
  );
}

function parseReservationQuantity(
  messageText: string,
): number {
  const normalized =
    normalizeSearchText(messageText);

  // OPTION 1 / OPTION 2 / OPTION 3 means product selection, not quantity.
  const withoutOption = normalized.replace(
    /\boption\s*[123]\b/g,
    " ",
  );

  const numeric = withoutOption.match(
    /\b([1-5])\s*(?:piece|pieces|pc|pcs|qty|quantity|items?|nos?)\b/,
  );

  if (numeric) {
    return Number(numeric[1]);
  }

  const reverseNumeric = withoutOption.match(
    /\b(?:piece|pieces|pc|pcs|qty|quantity|items?|nos?)\s*([1-5])\b/,
  );

  if (reverseNumeric) {
    return Number(reverseNumeric[1]);
  }

  const wordPatterns: Array<[RegExp, number]> = [
    [/\b(?:five|aidu)\s*(?:piece|pieces|pc|pcs)?\b|ఐదు\s*(?:పీస్|పీసులు)?/, 5],
    [/\b(?:four|nalugu)\s*(?:piece|pieces|pc|pcs)?\b|నాలుగు\s*(?:పీస్|పీసులు)?/, 4],
    [/\b(?:three|moodu|mudu)\s*(?:piece|pieces|pc|pcs)?\b|మూడు\s*(?:పీస్|పీసులు)?/, 3],
    [/\b(?:two|rendu)\s*(?:piece|pieces|pc|pcs)?\b|రెండు\s*(?:పీస్|పీసులు)?/, 2],
    [/\b(?:one|okati)\s*(?:piece|pieces|pc|pcs)?\b|ఒకటి\s*(?:పీస్|పీసులు)?/, 1],
  ];

  for (const [pattern, quantity] of wordPatterns) {
    if (pattern.test(withoutOption)) {
      return quantity;
    }
  }

  return 1;
}

function isReservationCancelIntent(
  messageText: string,
): boolean {
  const normalized =
    normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "cancel booking",
      "cancel book",
      "cancel reservation",
      "release booking",
      "release reservation",
      "booking cancel",
      "reservation cancel",
      "book vaddu",
      "booking vaddu",
      "reserve vaddu",
      "వద్దు",
      "క్యాన్సిల్",
    ],
  );
}

function isReservationStatusIntent(
  messageText: string,
): boolean {
  const normalized =
    normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "booking status",
      "reservation status",
      "my booking",
      "my reservation",
      "last booking",
      "latest booking",
      "booking enti",
      "booking emiti",
      "book status",
      "reserve status",
      "నా బుకింగ్",
      "రిజర్వేషన్ స్టేటస్",
    ],
  );
}

function parseReservationCode(
  messageText: string,
): string | null {
  const match = messageText
    .toUpperCase()
    .match(/\bNCS-[A-Z0-9]{6,12}\b/);

  return match?.[0] || null;
}


type ReservationCancelTarget = {
  mode: "latest" | "ordinal" | "code";
  ordinal?: number;
  code?: string;
};

function parseReservationCancelTarget(
  messageText: string,
): ReservationCancelTarget {
  const code = parseReservationCode(messageText);

  if (code) {
    return { mode: "code", code };
  }

  const normalized = normalizeSearchText(messageText);

  const ordinalMatch = normalized.match(
    /\b(?:cancel|release)\s*(?:my\s*)?(?:booking|reservation)?\s*(?:number\s*|no\s*)?(1|2|3|4|5)(?:st|nd|rd|th)?\b|\b(1|2|3|4|5)(?:st|nd|rd|th)?\s*(?:booking|reservation)\s*(?:cancel|release)\b/,
  );

  if (ordinalMatch) {
    return {
      mode: "ordinal",
      ordinal: Number(ordinalMatch[1] || ordinalMatch[2]),
    };
  }

  const wordOrdinal: Array<[RegExp, number]> = [
    [/\b(?:first|1st)\s*(?:booking|reservation)?\b/, 1],
    [/\b(?:second|2nd)\s*(?:booking|reservation)?\b/, 2],
    [/\b(?:third|3rd)\s*(?:booking|reservation)?\b/, 3],
    [/\b(?:fourth|4th)\s*(?:booking|reservation)?\b/, 4],
    [/\b(?:fifth|5th)\s*(?:booking|reservation)?\b/, 5],
  ];

  for (const [pattern, ordinal] of wordOrdinal) {
    if (pattern.test(normalized)) {
      return { mode: "ordinal", ordinal };
    }
  }

  return { mode: "latest" };
}

function parseOrdinalSelection(
  messageText: string,
): number | null {
  const normalized =
    normalizeSearchText(messageText);

  const direct = normalized.match(
    /^(?:option\s*)?(1|2|3)(?:st|nd|rd)?(?:\s*(?:one|two|three))?$/,
  );

  if (direct) {
    return Number(direct[1]);
  }

  if (/\b(?:first|1st|option 1)\b/.test(normalized)) {
    return 1;
  }

  if (/\b(?:second|2nd|option 2)\b/.test(normalized)) {
    return 2;
  }

  if (/\b(?:third|3rd|option 3)\b/.test(normalized)) {
    return 3;
  }

  const withAction = normalized.match(
    /\b(?:book|reserve|hold)\s*(?:option\s*)?(1|2|3)\b|\b(?:option\s*)?(1|2|3)\s*(?:book|reserve|hold)\b/,
  );

  if (withAction) {
    return Number(
      withAction[1] ||
      withAction[2],
    );
  }

  return null;
}

function isMoreProductsIntent(
  messageText: string,
): boolean {
  const normalized =
    normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "more",
      "more products",
      "show more",
      "inka",
      "inka chupinchu",
      "inkoti",
      "inkonni",
      "మరిన్ని",
      "ఇంకా",
    ],
  );
}

function isCheaperIntent(
  messageText: string,
): boolean {
  const normalized =
    normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "cheaper",
      "cheap",
      "less price",
      "low price",
      "takkuva",
      "takkuva price",
      "inka takkuva",
      "తక్కువ",
      "చీప్",
    ],
  );
}

function isPremiumIntent(
  messageText: string,
): boolean {
  const normalized =
    normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "premium",
      "higher range",
      "costly",
      "better quality",
      "high range",
      "inka premium",
      "ప్రీమియం",
    ],
  );
}

function isBestOptionIntent(
  messageText: string,
): boolean {
  const normalized =
    normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "best option",
      "best one",
      "best match",
      "which is best",
      "edi best",
      "edhi best",
      "ఏది బెస్ట్",
      "బెస్ట్ ఆప్షన్",
    ],
  );
}

function isSameModelOtherColourIntent(
  messageText: string,
): boolean {
  const normalized =
    normalizeSearchText(messageText);

  const sameModel =
    containsAnyPhrase(
      normalized,
      [
        "same model",
        "same product",
        "ide model",
        "idhe model",
        "ఇదే మోడల్",
        "అదే మోడల్",
      ],
    );

  const otherColour =
    containsAnyPhrase(
      normalized,
      [
        "another colour",
        "another color",
        "other colour",
        "other color",
        "different colour",
        "different color",
        "inko colour",
        "inko color",
        "inkoka colour",
        "inkoka color",
        "ఇంకో కలర్",
        "వేరే కలర్",
      ],
    );

  return sameModel && otherColour;
}

function isSimilarProductsIntent(
  messageText: string,
): boolean {
  const normalized =
    normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "similar",
      "similar product",
      "similar products",
      "like this",
      "same type",
      "ilantivi",
      "ilantivi chupinchu",
      "ఇలాంటివి",
      "ఇలాంటివి చూపించు",
    ],
  );
}

function hasPriceQuestion(
  messageText: string,
): boolean {
  const normalized =
    normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "price",
      "cost",
      "rate",
      "enta",
      "entha",
      "how much",
      "ధర",
      "ఎంత",
    ],
  );
}

function stripReservationActionWords(
  messageText: string,
): string {
  return normalizeSearchText(
    messageText,
  )
    .replace(
      /\b(?:book|booking|reserve|reservation|hold|keep|aside|cheyyu|chey|cheyyandi|pettu|pettandi|please|pls|option|naaku|naku|idi|okati|piece|pieces|pc|pcs|qty|quantity)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function contextIsFresh(
  state: SalesConversationRow | null,
): boolean {
  if (!state) {
    return false;
  }

  const expires = Date.parse(
    state.context_expires_at || "",
  );

  return (
    Number.isFinite(expires) &&
    expires > Date.now()
  );
}

async function loadSalesConversation(
  admin: any,
  phone: string,
): Promise<SalesConversationRow | null> {
  try {
    const { data, error } =
      await admin
        .from(
          "whatsapp_sales_conversations",
        )
        .select("*")
        .eq("phone", phone)
        .maybeSingle();

    if (error) {
      throw error;
    }

    const state =
      (data || null) as
        SalesConversationRow | null;

    return contextIsFresh(state)
      ? state
      : null;
  } catch (error) {
    console.warn(
      "NCS SALES CONVERSATION LOAD FAILED; USING STATELESS SEARCH:",
      error instanceof Error
        ? error.message
        : String(error),
    );

    return null;
  }
}

const STAGE8_RETURNING_MEMORY_DAYS = 180;

function stage8ReturningMemoryIsRecent(
  state: SalesConversationRow | null,
): boolean {
  if (!state) {
    return false;
  }

  const updated = Date.parse(
    state.updated_at || "",
  );

  if (!Number.isFinite(updated)) {
    return false;
  }

  return (
    Date.now() - updated <=
    STAGE8_RETURNING_MEMORY_DAYS *
      24 * 60 * 60 * 1000
  );
}


type NcsWhatsappLeadCapture = {
  available: boolean;
  isFirstContact: boolean | null;
  leadId: string | null;
  score: number;
  temperature: "HOT" | "WARM" | "COLD";
  intent: string;
  category: string | null;
};

function ncsWhatsappLeadCategory(
  messageText: string,
): string | null {
  const text =
    normalizeSearchText(
      messageText,
    );

  const groups: Array<{
    category: string;
    words: string[];
  }> = [
    {
      category: "T-SHIRTS",
      words: [
        "t shirt",
        "t shirts",
        "tshirt",
        "tshirts",
        "tee",
        "tees",
      ],
    },
    {
      category: "SHIRTS",
      words: [
        "shirt",
        "shirts",
      ],
    },
    {
      category: "JEANS",
      words: [
        "jean",
        "jeans",
        "denim",
      ],
    },
    {
      category: "PANTS",
      words: [
        "pant",
        "pants",
        "trouser",
        "trousers",
      ],
    },
    {
      category: "SHORTS",
      words: [
        "short",
        "shorts",
      ],
    },
    {
      category: "SAREES",
      words: [
        "saree",
        "sarees",
        "sari",
      ],
    },
    {
      category: "KURTIS",
      words: [
        "kurti",
        "kurtis",
        "kurtha",
        "kurta",
      ],
    },
    {
      category: "TOPS",
      words: [
        "top",
        "tops",
      ],
    },
    {
      category: "DRESSES",
      words: [
        "dress",
        "dresses",
        "gown",
        "gowns",
      ],
    },
    {
      category: "NIGHTIES",
      words: [
        "nighty",
        "nighties",
        "nightwear",
      ],
    },
    {
      category: "LEGGINGS",
      words: [
        "legging",
        "leggings",
      ],
    },
    {
      category: "KIDS",
      words: [
        "kids",
        "kid",
        "boys",
        "girls",
        "frock",
        "frocks",
      ],
    },
    {
      category: "INNERWEAR",
      words: [
        "innerwear",
        "brief",
        "briefs",
        "vest",
        "baniyan",
        "banian",
      ],
    },
    {
      category: "SPORTSWEAR",
      words: [
        "sportswear",
        "track",
        "tracks",
        "jogger",
        "joggers",
      ],
    },
  ];

  for (const group of groups) {
    if (
      group.words.some(
        (word) =>
          text.includes(word),
      )
    ) {
      return group.category;
    }
  }

  return null;
}

function ncsWhatsappLeadSignals(
  messageText: string,
  flags: {
    greeting: boolean;
    businessIntent: boolean;
    interactiveBusinessAction: boolean;
    guidedAudience: NcsGuidedAudience | null;
  },
): {
  delta: number;
  intent: string;
  needsHumanFollowup: boolean;
  followupReason: string | null;
  booking: number;
  price: number;
  size: number;
  stock: number;
} {
  const text =
    normalizeSearchText(
      messageText,
    );

  const hasAny = (
    words: string[],
  ) =>
    words.some(
      (word) =>
        text.includes(word),
    );

  const booking =
    hasAny([
      "book",
      "booking",
      "reserve",
      "reservation",
      "hold",
      "confirm",
    ])
      ? 1
      : 0;

  const price =
    hasAny([
      "price",
      "rate",
      "cost",
      "mrp",
      "offer",
      "discount",
      "under",
      "budget",
    ])
      ? 1
      : 0;

  const size =
    hasAny([
      "size",
      " xs ",
      " s ",
      " m ",
      " l ",
      " xl",
      "xxl",
      "xxxl",
      "28",
      "30",
      "32",
      "34",
      "36",
      "38",
      "40",
      "42",
      "44",
    ])
      ? 1
      : 0;

  const stock =
    hasAny([
      "stock",
      "available",
      "availability",
      "undha",
      "unda",
      "vunda",
      "ledha",
      "leda",
    ])
      ? 1
      : 0;

  const human =
    hasAny([
      "owner",
      "call me",
      "call cheyy",
      "human",
      "person",
      "staff",
      "manager",
      "badri",
      "matladali",
      "maatladali",
    ]);

  let delta = 0;
  let intent = "PERSONAL_OR_GENERAL";

  if (flags.greeting) {
    delta += 1;
    intent = "GREETING";
  }

  if (flags.guidedAudience) {
    delta += 6;
    intent =
      `AUDIENCE_${flags.guidedAudience.toUpperCase()}`;
  }

  if (flags.businessIntent) {
    delta += 8;
    intent = "SHOPPING";
  }

  if (price) {
    delta += 10;
    intent = "PRICE_QUERY";
  }

  if (size) {
    delta += 10;
    intent = "SIZE_QUERY";
  }

  if (stock) {
    delta += 12;
    intent = "STOCK_QUERY";
  }

  if (
    flags.interactiveBusinessAction
  ) {
    delta += 12;
    intent = "INTERACTIVE_ACTION";
  }

  if (booking) {
    delta += 28;
    intent = "BOOKING_INTENT";
  }

  if (human) {
    delta += 18;
    intent = "HUMAN_HANDOFF";
  }

  return {
    delta,
    intent,
    needsHumanFollowup: human,
    followupReason:
      human
        ? "Customer requested owner/store-team contact"
        : null,
    booking,
    price,
    size,
    stock,
  };
}

async function captureNcsWhatsappLeadSafe(
  admin: any,
  input: {
    phone: string;
    customerName: string;
    messageText: string;
    greeting: boolean;
    businessIntent: boolean;
    interactiveBusinessAction: boolean;
    guidedAudience: NcsGuidedAudience | null;
  },
): Promise<NcsWhatsappLeadCapture> {
  const category =
    ncsWhatsappLeadCategory(
      input.messageText,
    );

  const signals =
    ncsWhatsappLeadSignals(
      input.messageText,
      {
        greeting:
          input.greeting,
        businessIntent:
          input.businessIntent,
        interactiveBusinessAction:
          input.interactiveBusinessAction,
        guidedAudience:
          input.guidedAudience,
      },
    );

  try {
    const { data: existing, error: loadError } =
      await admin
        .from(
          "ncs_whatsapp_leads",
        )
        .select(
          "id,lead_score,total_messages,business_message_count,booking_intent_count,price_intent_count,size_intent_count,stock_intent_count,primary_interest,interested_category,customer_name,needs_human_followup,followup_reason",
        )
        .eq(
          "phone",
          input.phone,
        )
        .maybeSingle();

    if (loadError) {
      throw loadError;
    }

    const isFirstContact =
      !existing?.id;

    const currentScore =
      Number(
        existing?.lead_score || 0,
      );

    const nextScore =
      Math.max(
        0,
        Math.min(
          100,
          currentScore +
            signals.delta,
        ),
      );

    const temperature:
      "HOT" | "WARM" | "COLD" =
      nextScore >= 70
        ? "HOT"
        : nextScore >= 35
          ? "WARM"
          : "COLD";

    const now =
      new Date().toISOString();

    const leadPayload = {
      phone:
        input.phone,
      customer_name:
        input.customerName ||
        existing?.customer_name ||
        null,
      lead_score:
        nextScore,
      lead_temperature:
        temperature,
      primary_interest:
        category ||
        existing?.primary_interest ||
        null,
      interested_category:
        category ||
        existing?.interested_category ||
        null,
      last_intent:
        signals.intent,
      last_message_text:
        input.messageText
          .trim()
          .slice(
            0,
            1500,
          ) || null,
      last_message_at:
        now,
      last_seen_at:
        now,
      total_messages:
        Number(
          existing?.total_messages || 0,
        ) + 1,
      business_message_count:
        Number(
          existing?.business_message_count || 0,
        ) +
        (
          input.businessIntent
            ? 1
            : 0
        ),
      booking_intent_count:
        Number(
          existing?.booking_intent_count || 0,
        ) +
        signals.booking,
      price_intent_count:
        Number(
          existing?.price_intent_count || 0,
        ) +
        signals.price,
      size_intent_count:
        Number(
          existing?.size_intent_count || 0,
        ) +
        signals.size,
      stock_intent_count:
        Number(
          existing?.stock_intent_count || 0,
        ) +
        signals.stock,
      needs_human_followup:
        Boolean(
          existing?.needs_human_followup,
        ) ||
        signals.needsHumanFollowup,
      followup_reason:
        signals.followupReason ||
        existing?.followup_reason ||
        null,
      source:
        "WHATSAPP",
    };

    const { data: saved, error: saveError } =
      await admin
        .from(
          "ncs_whatsapp_leads",
        )
        .upsert(
          leadPayload,
          {
            onConflict:
              "phone",
          },
        )
        .select(
          "id",
        )
        .single();

    if (saveError) {
      throw saveError;
    }

    const leadId =
      String(
        saved?.id || "",
      ) ||
      null;

    try {
      await admin
        .from(
          "ncs_whatsapp_lead_events",
        )
        .insert({
          lead_id:
            leadId,
          phone:
            input.phone,
          customer_name:
            input.customerName ||
            null,
          event_type:
            signals.intent,
          intent:
            signals.intent,
          category,
          score_delta:
            signals.delta,
          message_text:
            input.messageText
              .trim()
              .slice(
                0,
                1500,
              ) || null,
          metadata: {
            first_contact:
              isFirstContact,
            business_intent:
              input.businessIntent,
            greeting:
              input.greeting,
            audience:
              input.guidedAudience,
          },
        });
    } catch (eventError) {
      console.warn(
        "NCS WHATSAPP LEAD EVENT SAVE FAILED:",
        eventError instanceof Error
          ? eventError.message
          : String(eventError),
      );
    }

    return {
      available: true,
      isFirstContact,
      leadId,
      score:
        nextScore,
      temperature,
      intent:
        signals.intent,
      category,
    };
  } catch (error) {
    console.warn(
      "NCS WHATSAPP LEAD CAPTURE FAILED; COMMERCE FLOW CONTINUES:",
      error instanceof Error
        ? error.message
        : String(error),
    );

    return {
      available: false,
      isFirstContact: null,
      leadId: null,
      score: 0,
      temperature: "COLD",
      intent:
        signals.intent,
      category,
    };
  }
}

async function hasNcsCustomerHistory(
  admin: any,
  phone: string,
): Promise<boolean> {
  try {
    const { data, error } =
      await admin
        .from("whatsapp_sales_conversations")
        .select("phone")
        .eq("phone", phone)
        .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data?.phone);
  } catch (error) {
    console.warn(
      "NCS CUSTOMER HISTORY CHECK FAILED:",
      error instanceof Error
        ? error.message
        : String(error),
    );

    /*
     * STAGE 12.3
     * ncs_whatsapp_leads is the primary first-contact authority.
     * This legacy lookup is only a fallback and must never make every
     * incoming message look like a brand-new customer.
     */
    return true;
  }
}

async function loadReturningShoppingMemory(
  admin: any,
  phone: string,
): Promise<SalesConversationRow | null> {
  try {
    const { data, error } =
      await admin
        .from("whatsapp_sales_conversations")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();

    if (error) {
      throw error;
    }

    const state =
      (data || null) as SalesConversationRow | null;

    return stage8ReturningMemoryIsRecent(state)
      ? state
      : null;
  } catch (error) {
    console.warn(
      "NCS RETURNING SHOPPING MEMORY LOAD FAILED; CORE FLOW PRESERVED:",
      error instanceof Error
        ? error.message
        : String(error),
    );

    return null;
  }
}

async function saveSalesConversation(
  admin: any,
  phone: string,
  payload: Partial<SalesConversationRow>,
): Promise<void> {
  try {
    const now = new Date();
    const expires = new Date(
      now.getTime() +
        SALES_CONTEXT_HOURS *
          60 *
          60 *
          1000,
    );

    const { error } =
      await admin
        .from(
          "whatsapp_sales_conversations",
        )
        .upsert(
          {
            phone,
            ...payload,
            context_expires_at:
              expires.toISOString(),
            updated_at:
              now.toISOString(),
          },
          {
            onConflict: "phone",
          },
        );

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn(
      "NCS SALES CONVERSATION SAVE FAILED; CORE REPLY PRESERVED:",
      error instanceof Error
        ? error.message
        : String(error),
    );
  }
}

async function cleanupExpiredReservationsSafe(
  admin: any,
): Promise<void> {
  try {
    const { error } =
      await admin.rpc(
        "ncs_cleanup_expired_whatsapp_reservations_v1",
      );

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn(
      "NCS RESERVATION CLEANUP RPC UNAVAILABLE; CONTINUING CORE FLOW:",
      error instanceof Error
        ? error.message
        : String(error),
    );
  }
}

async function recordShoppingMemorySafe(
  admin: any,
  phone: string,
  {
    brand,
    category,
    size,
    color,
    query,
    reserved,
  }: {
    brand?: string | null;
    category?: string | null;
    size?: string | null;
    color?: string | null;
    query?: string | null;
    reserved?: boolean;
  },
): Promise<void> {
  try {
    const { error } =
      await admin.rpc(
        "ncs_whatsapp_record_shopping_memory_v1",
        {
          p_phone: phone,
          p_brand:
            brand || null,
          p_category:
            category || null,
          p_size:
            size || null,
          p_color:
            color || null,
          p_query:
            query || null,
          p_reserved:
            reserved === true,
        },
      );

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn(
      "NCS SHOPPING MEMORY UPDATE FAILED; CORE REPLY PRESERVED:",
      error instanceof Error
        ? error.message
        : String(error),
    );
  }
}


/* ============================================================
   NCS WHATSAPP • STAGE 9 FOLLOW-UP CONSENT CONTROL

   Persistent opt-out state lives in whatsapp_sales_followups.
   Core sales replies keep working even if this optional table is not installed.
============================================================ */

function isStage9FollowupOptOutIntent(
  messageText: string,
): boolean {
  const normalized =
    normalizeSearchText(messageText);

  return [
    "stop",
    "stop messages",
    "no msg",
    "no message",
    "dont message",
    "do not message",
    "unsubscribe",
    "offers vaddu",
    "messages vaddu",
    "msg vaddu",
  ].some((phrase) =>
    normalized === normalizeSearchText(phrase),
  );
}

function isStage9FollowupOptInIntent(
  messageText: string,
): boolean {
  const normalized =
    normalizeSearchText(messageText);

  return [
    "start",
    "resume",
    "start messages",
    "offers ok",
    "messages ok",
    "msg ok",
  ].some((phrase) =>
    normalized === normalizeSearchText(phrase),
  );
}

async function setStage9FollowupOptOutSafe(
  admin: any,
  phone: string,
  optedOut: boolean,
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const { error } = await admin
      .from("whatsapp_sales_followups")
      .upsert(
        {
          phone,
          opted_out: optedOut,
          updated_at: now,
        },
        {
          onConflict: "phone",
        },
      );

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn(
      "NCS STAGE9 FOLLOW-UP CONSENT SAVE FAILED; CORE SALES FLOW PRESERVED:",
      error instanceof Error
        ? error.message
        : String(error),
    );
  }
}


/* ============================================================
   NCS WHATSAPP • STAGE 6 SMART RECOMMENDATION + CROSS-SELL BRAIN

   This layer is intentionally additive. It never changes reservation stock
   ownership, option mapping, or the Stage 5 inventory ranking contract.
============================================================ */

type Stage6RecommendationPlan = {
  kind:
    | "cross_sell"
    | "same_brand"
    | "budget_multi"
    | "full_set";
  query: string;
  heading: string;
  requestedCount: number;
  totalBudget: number | null;
  targetCategory: string | null;
};

function stage6TargetCategory(
  messageText: string,
): string | null {
  const normalized =
    normalizeSearchText(messageText);

  const explicitTargets: Array<{
    pattern: RegExp;
    value: string;
  }> = [
    { pattern: /\b(?:track\s*pant|trackpants?)\b/, value: "track pant" },
    { pattern: /\b(?:jeans?|denim)\b/, value: "jeans" },
    { pattern: /\b(?:pants?|trousers?)\b/, value: "pant" },
    { pattern: /\b(?:t\s*shirt|tshirt|tee)\b/, value: "t shirt" },
    { pattern: /\bshirts?\b/, value: "shirt" },
    { pattern: /\b(?:chunni|chuni|dupatta|stole|scarf)\b/, value: "chunni" },
    { pattern: /\b(?:kurti|kurta)\b/, value: "kurti" },
    { pattern: /\b(?:tops?)\b/, value: "top" },
    { pattern: /\b(?:leggings?)\b/, value: "legging" },
    { pattern: /\b(?:shorts?)\b/, value: "shorts" },
  ];

  for (const target of explicitTargets) {
    if (target.pattern.test(normalized)) {
      return target.value;
    }
  }

  return null;
}

function stage6DefaultCrossSellCategory(
  state: SalesConversationRow | null,
): string | null {
  const source = normalizeSearchText(
    [
      state?.last_category,
      state?.last_product_name,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (/\b(?:shirt|t\s*shirt|tshirt|tee|top|kurti|kurta)\b/.test(source)) {
    return /\b(?:kurti|kurta)\b/.test(source)
      ? "chunni"
      : "pant";
  }

  if (/\b(?:pant|trouser|jean|denim|track\s*pant|legging|shorts?)\b/.test(source)) {
    return "shirt";
  }

  if (/\b(?:chunni|dupatta|stole|scarf)\b/.test(source)) {
    return "kurti";
  }

  return null;
}

function isStage6MatchingIntent(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);

  return containsAnyPhrase(normalized, [
    "matching",
    "match cheyyi",
    "match cheyu",
    "match ayye",
    "match అయ్యే",
    "matching product",
    "matching products",
    "దీనికి మ్యాచ్",
    "దీనికి మ్యాచింగ్",
    "ee shirt ki",
    "ee product ki",
    "this shirt with",
    "goes with this",
  ]);
}


function isStage6MatchingColourAdviceIntent(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);

  const asksColour = containsAnyPhrase(normalized, [
    "matching colour",
    "matching color",
    "match colour",
    "match color",
    "which colour",
    "which color",
    "colour enti",
    "color enti",
    "ఏ కలర్",
    "మ్యాచింగ్ కలర్",
  ]);

  return asksColour;
}

function stage6ColourPairSuggestions(
  color: string,
): string[] {
  const normalized = normalizeSearchText(color);

  if (includesAny(normalized, ["black"])) {
    return ["White", "Grey", "Beige", "Khaki"];
  }

  if (includesAny(normalized, ["white", "cream"])) {
    return ["Black", "Navy", "Grey", "Beige"];
  }

  if (includesAny(normalized, ["blue", "navy", "teal"])) {
    return ["White", "Beige", "Khaki", "Grey"];
  }

  if (includesAny(normalized, ["red", "maroon", "pink", "purple"])) {
    return ["Black", "White", "Beige", "Grey"];
  }

  if (includesAny(normalized, ["green", "olive"])) {
    return ["Black", "Cream", "Beige", "Khaki"];
  }

  if (includesAny(normalized, ["brown", "beige", "khaki"])) {
    return ["Black", "Navy", "White", "Cream"];
  }

  if (includesAny(normalized, ["yellow", "orange", "mustard", "gold"])) {
    return ["Navy", "Black", "White", "Grey"];
  }

  return ["Black", "White", "Navy", "Beige"];
}

function isStage6SameBrandIntent(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);

  const sameBrand = containsAnyPhrase(normalized, [
    "same brand",
    "same brand lo",
    "ide brand",
    "idhe brand",
    "ఈ బ్రాండ్",
    "అదే బ్రాండ్",
  ]);

  const more = containsAnyPhrase(normalized, [
    "more",
    "inkem",
    "inka em",
    "inka",
    "other",
    "others",
    "vere",
    "వేరే",
    "ఇంకేం",
  ]);

  return sameBrand && more;
}

function parseStage6RequestedCount(
  messageText: string,
): number {
  const normalized = normalizeSearchText(messageText);

  const numeric = normalized.match(
    /\b([2-3])\s*(?:pieces?|pcs?|items?|shirts?|t\s*shirts?|tshirts?|pants?|jeans?|products?)\b/,
  );

  if (numeric) {
    return Math.max(2, Math.min(3, Number(numeric[1])));
  }

  if (/\b(?:two|rendu|2)\b/.test(normalized)) {
    return 2;
  }

  if (/\b(?:three|moodu|3)\b/.test(normalized)) {
    return 3;
  }

  return 1;
}

function isStage6FullSetIntent(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);

  return containsAnyPhrase(normalized, [
    "full set",
    "complete set",
    "matching set",
    "full dress",
    "set under",
    "set budget",
    "ఫుల్ సెట్",
    "పూర్తి సెట్",
  ]);
}

function buildStage6RecommendationPlan(
  state: SalesConversationRow | null,
  messageText: string,
): Stage6RecommendationPlan | null {
  const priceIntent = parseSmartPriceIntent(messageText);
  const totalBudget =
    priceIntent.maxPrice != null
      ? priceIntent.maxPrice
      : null;

  const explicitTarget =
    stage6TargetCategory(messageText);

  if (isStage6SameBrandIntent(messageText)) {
    const brand = state?.last_brand?.trim() || "";

    if (!brand) {
      return null;
    }

    return {
      kind: "same_brand",
      query: [
        brand,
        explicitTarget || "",
        totalBudget != null ? `under ${totalBudget}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      heading: explicitTarget
        ? `Same brand • ${explicitTarget}`
        : "More from the same brand",
      requestedCount: PRODUCT_COUNT,
      totalBudget,
      targetCategory: explicitTarget,
    };
  }

  if (isStage6FullSetIntent(messageText)) {
    const target =
      explicitTarget ||
      stage6DefaultCrossSellCategory(state);

    if (!state?.last_selected_product_id || !target) {
      return {
        kind: "full_set",
        query: "",
        heading: "Build a full set",
        requestedCount: 1,
        totalBudget,
        targetCategory: target,
      };
    }

    const selectedPrice = safeNumber(state.last_price);
    const remaining =
      totalBudget != null && selectedPrice > 0
        ? Math.max(0, Math.floor(totalBudget - selectedPrice))
        : totalBudget;

    return {
      kind: "full_set",
      query: [
        target,
        remaining != null && remaining > 0
          ? `under ${remaining}`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      heading:
        remaining != null && remaining > 0
          ? `Complete the set • remaining budget ${money(remaining)}`
          : "Complete the set",
      requestedCount: 2,
      totalBudget,
      targetCategory: target,
    };
  }

  const requestedCount =
    parseStage6RequestedCount(messageText);

  if (
    requestedCount > 1 &&
    totalBudget != null
  ) {
    const target =
      explicitTarget ||
      state?.last_category?.trim() ||
      null;

    if (!target) {
      return null;
    }

    const perItemBudget = Math.max(
      1,
      Math.floor(totalBudget / requestedCount),
    );

    return {
      kind: "budget_multi",
      query: `${target} under ${perItemBudget}`,
      heading: `${requestedCount}-piece budget plan • total ${money(totalBudget)}`,
      requestedCount,
      totalBudget,
      targetCategory: target,
    };
  }

  if (isStage6MatchingIntent(messageText)) {
    const target =
      explicitTarget ||
      stage6DefaultCrossSellCategory(state);

    if (!target) {
      return null;
    }

    return {
      kind: "cross_sell",
      query: [
        target,
        totalBudget != null ? `under ${totalBudget}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      heading: `Matching ${target} options`,
      requestedCount: PRODUCT_COUNT,
      totalBudget,
      targetCategory: target,
    };
  }

  return null;
}


/* ============================================================
   NCS RETURNING CUSTOMER MEMORY + PROACTIVE SALES BRAIN
   STAGE 8 • 2036

   Privacy / correctness contract:
   - reuses only existing shopping-context fields already stored for sales
   - no name/profile inference, sensitive data, tracking pixel or external AI
   - memory is ignored after 180 days without shopping activity
   - persistent memory never overrides an explicit new customer request
   - live stock / price / size / colour are always re-checked before reply
============================================================ */

type Stage8ReturningPlan =
  | {
      kind: "text";
      mode: string;
      text: string;
    }
  | {
      kind: "search";
      mode: string;
      query: string;
    };

function stage8MemoryBase(
  memory: SalesConversationRow | null,
): string {
  if (!stage8ReturningMemoryIsRecent(memory)) {
    return "";
  }

  return [
    memory?.last_brand,
    memory?.last_category,
  ]
    .map((value) => value?.trim() || "")
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function stage8IsSameAsLastTimeIntent(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);

  return containsAnyPhrase(normalized, [
    "same as last time",
    "same like last time",
    "last time same",
    "last time laga",
    "last time la",
    "mundu laga",
    "mundu la",
    "ade laga",
    "same kavali",
    "గతసారి లాగే",
    "ముందులాగే",
  ]);
}

function stage8IsForMeIntent(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);

  return containsAnyPhrase(normalized, [
    "for me",
    "suitable for me",
    "what suits me",
    "naaku set ayyevi",
    "naku set ayyevi",
    "naaku suitable",
    "naku suitable",
    "naaku chupinchu",
    "naku chupinchu",
    "నా కోసం",
    "నాకు సెట్ అయ్యేవి",
  ]);
}

function stage8ExplicitProductRequest(
  messageText: string,
): boolean {
  const intent = parseSmartProductIntent(messageText);
  const normalized = normalizeSearchText(messageText);

  if (
    intent.categoryHints.length > 0 ||
    intent.sizes.length > 0 ||
    intent.colorHints.length > 0 ||
    intent.minPrice != null ||
    intent.maxPrice != null
  ) {
    return true;
  }

  const ignored = new Set([
    "hi", "hello", "hai", "hii", "hey",
    "same", "last", "time", "mundu", "laga", "la",
    "naaku", "naku", "naa", "na", "for", "me",
    "show", "chupinchu", "choopinchu", "please", "pls",
    "set", "ayyevi", "suitable", "what", "is", "available",
  ]);

  return queryTerms(normalized).some(
    (term) => term.length >= 3 && !ignored.has(term),
  );
}

function buildStage8ReturningPlan(
  freshState: SalesConversationRow | null,
  memory: SalesConversationRow | null,
  messageText: string,
): Stage8ReturningPlan | null {
  if (!memory || !stage8ReturningMemoryIsRecent(memory)) {
    return null;
  }

  const brand = memory.last_brand?.trim() || "";
  const category = memory.last_category?.trim() || "";
  const size = memory.last_size?.trim() || "";
  const color = memory.last_color?.trim() || "";
  const price = safeNumber(memory.last_price);
  const base = stage8MemoryBase(memory);

  if (stage7IsGreeting(messageText)) {
    const remembered = [
      size ? `size ${size}` : "",
      brand,
      category,
    ]
      .filter(Boolean)
      .join(" • ");

    return {
      kind: "text",
      mode: "stage8_returning_greeting",
      text: [
        "✨ NEW CITY STYLE",
        "",
        "Hi 👋 Welcome back.",
        remembered
          ? `Your recent shopping preference: ${remembered}.`
          : "Tell me what you need and I’ll check live stock.",
        price > 0
          ? `Recent price range was around ${money(price)}.`
          : "",
        "You can say: same as last time • na size lo chupinchu • same budget lo inkoti.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (stage8IsSameAsLastTimeIntent(messageText)) {
    if (!base && !size) {
      return null;
    }

    return {
      kind: "search",
      mode: "stage8_same_as_last_time",
      query: [
        base,
        size ? `size ${size}` : "",
        color,
        price > 0 ? `under ${Math.ceil(price)}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  if (stage7IsLastViewedIntent(messageText) && !freshState) {
    const productBase = [
      memory.last_product_name,
      brand,
    ]
      .map((value) => value?.trim() || "")
      .filter(Boolean)
      .slice(0, 2)
      .join(" ");

    if (productBase) {
      return {
        kind: "search",
        mode: "stage8_last_viewed_memory",
        query: [
          productBase,
          size ? `size ${size}` : "",
          color,
        ]
          .filter(Boolean)
          .join(" "),
      };
    }
  }

  if (stage7IsMySizeIntent(messageText) && !freshState?.last_size && size) {
    const explicit = normalizeSearchText(messageText)
      .replace(/\b(?:my|na|naa|naku|naaku)\s+size(?:\s+lo)?\b/g, " ")
      .replace(/\b(?:show|chupinchu|choopinchu|please|pls)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      kind: "search",
      mode: "stage8_remembered_size",
      query: [
        explicit || base || category,
        `size ${size}`,
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  if (stage7IsSameBudgetIntent(messageText) && !freshState && price > 0) {
    return {
      kind: "search",
      mode: "stage8_same_budget_memory",
      query: [
        category || base,
        `under ${Math.ceil(price)}`,
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  if (stage8IsForMeIntent(messageText) && !stage8ExplicitProductRequest(messageText)) {
    if (base || size) {
      return {
        kind: "search",
        mode: "stage8_personal_sales_memory",
        query: [
          base || category,
          size ? `size ${size}` : "",
          price > 0 ? `under ${Math.ceil(price)}` : "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    }
  }

  return null;
}

/* ============================================================
   NCS AUTO SALES REPLY BRAIN • STAGE 7 • 2036

   Purpose:
   - understand casual customer language without requiring exact commands
   - reuse only fresh sales context already stored by the existing engine
   - turn natural references into deterministic live-inventory queries
   - never invent stock, price, size, colour or booking facts
   - no new table / RPC / external AI dependency
============================================================ */

type Stage7AutoSalesPlan =
  | {
      kind: "text";
      mode: string;
      text: string;
    }
  | {
      kind: "search";
      mode: string;
      query: string;
    };

function stage7ContextBase(
  state: SalesConversationRow | null,
): string {
  if (!state || !contextIsFresh(state)) {
    return "";
  }

  return [
    state.last_product_name,
    state.last_brand,
    state.last_category,
  ]
    .map((value) => value?.trim() || "")
    .filter(Boolean)
    .slice(0, 2)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function stage7IsGreeting(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "hi",
      "hello",
      "hai",
      "hii",
      "hey",
      "namaste",
      "good morning",
      "good afternoon",
      "good evening",
    ],
  ) && isOnlyCustomerSmallTalk(messageText);
}

function stage7IsHelpIntent(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "help",
      "how to order",
      "how to buy",
      "how to book",
      "ela order",
      "ela book",
      "em adagali",
      "emi adagali",
      "ఎలా ఆర్డర్",
      "ఎలా బుక్",
    ],
  );
}

function stage7IsLastViewedIntent(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "last viewed",
      "last product",
      "last item",
      "last time chusina",
      "last time choosina",
      "mundu chusina",
      "mundu choosina",
      "nenu chusina",
      "nenu choosina",
      "గతసారి చూసిన",
      "ముందు చూసిన",
    ],
  );
}

function stage7IsMySizeIntent(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "my size",
      "na size",
      "naa size",
      "naku size",
      "na size lo",
      "naa size lo",
      "నా సైజ్",
      "నా సైజులో",
    ],
  );
}

function stage7IsSameBudgetIntent(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "same budget",
      "same price",
      "same range",
      "ide budget",
      "idhe budget",
      "ade budget",
      "same rate",
      "ఇదే బడ్జెట్",
      "అదే బడ్జెట్",
    ],
  );
}

function stage7IsGenericDiscoveryIntent(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "what do you have",
      "what is available",
      "whats available",
      "show me something",
      "show something",
      "anything available",
      "em unnayi",
      "emi unnayi",
      "em vunnayi",
      "edaina chupinchu",
      "edaina choopinchu",
      "manchi vi chupinchu",
      "manchivi chupinchu",
      "ఏమున్నాయి",
      "ఏదైనా చూపించు",
    ],
  );
}

function stage7IsContextAvailabilityIntent(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);
  const intent = parseSmartProductIntent(messageText);

  if (
    intent.categoryHints.length > 0 ||
    intent.terms.some((term) =>
      ![
        "available",
        "availability",
        "stock",
        "unda",
        "undha",
        "unnaya",
        "unnayi",
        "is",
        "it",
        "this",
        "idi",
        "adhi",
        "aa",
        "ah",
      ].includes(term),
    )
  ) {
    return false;
  }

  return containsAnyPhrase(
    normalized,
    [
      "is this available",
      "is it available",
      "this available",
      "stock unda",
      "stock undha",
      "idi unda",
      "idi undha",
      "available aa",
      "available ah",
      "ఇది ఉందా",
      "స్టాక్ ఉందా",
    ],
  );
}

function buildStage7AutoSalesPlan(
  state: SalesConversationRow | null,
  messageText: string,
): Stage7AutoSalesPlan | null {
  const freshState =
    state && contextIsFresh(state)
      ? state
      : null;

  if (stage7IsGreeting(messageText)) {
    const contextHint = freshState?.last_category?.trim()
      ? `Last time we were looking at ${freshState.last_category}. You can continue from there too.`
      : "";

    return {
      kind: "text",
      mode: "stage7_greeting",
      text: [
        "✨ NEW CITY STYLE",
        "",
        "Hi 👋 Tell me what you need in your own words — no special command is required.",
        contextHint,
        "Example: L size shirt under 1000 • blue POOMEX • matching pant • book this one.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (stage7IsHelpIntent(messageText)) {
    return {
      kind: "text",
      mode: "stage7_help",
      text: [
        "✨ NEW CITY STYLE",
        "",
        "Just message normally. I can check live products, sizes, colours, price range, matching items and bookings automatically.",
        "Try: shirt kavali • L size blue • 1000 lopu • matching pant • idi book cheyyu • booking status.",
      ].join("\n"),
    };
  }

  if (stage7IsLastViewedIntent(messageText)) {
    const base = stage7ContextBase(freshState);

    if (base) {
      return {
        kind: "search",
        mode: "stage7_last_viewed",
        query: [
          base,
          freshState?.last_size
            ? `size ${freshState.last_size}`
            : "",
          freshState?.last_color || "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    }

    return {
      kind: "text",
      mode: "stage7_last_viewed_missing",
      text: [
        "✨ NEW CITY STYLE",
        "",
        "I don’t have a recent product in this conversation yet.",
        "Tell me a product, brand, size or budget and I’ll start from live stock.",
      ].join("\n"),
    };
  }

  if (stage7IsMySizeIntent(messageText)) {
    const rememberedSize = freshState?.last_size?.trim() || "";
    const explicit = parseSmartProductIntent(messageText);
    const category =
      explicit.categoryHints[0] ||
      freshState?.last_category?.trim() ||
      "";
    const brand = freshState?.last_brand?.trim() || "";
    const explicitRequest =
      normalizeSearchText(messageText)
        .replace(/\b(?:my|na|naa|naku)\s+size(?:\s+lo)?\b/g, " ")
        .replace(/\b(?:show|chupinchu|choopinchu|please|pls)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (rememberedSize) {
      const queryBase =
        explicitRequest ||
        [brand, category]
          .filter(Boolean)
          .join(" ");

      if (queryBase) {
        return {
          kind: "search",
          mode: "stage7_my_size",
          query: `${queryBase} size ${rememberedSize}`.trim(),
        };
      }
    }

    if (!rememberedSize) {
      return {
        kind: "text",
        mode: "stage7_my_size_missing",
        text: [
          "✨ NEW CITY STYLE",
          "",
          "Tell me your size once (for example M, L, XL or 32/34).",
          "Then you can simply ask ‘na size lo shirts’ and I’ll continue from that size in this conversation.",
        ].join("\n"),
      };
    }
  }

  if (stage7IsSameBudgetIntent(messageText)) {
    const lastPrice = safeNumber(freshState?.last_price);
    const category = freshState?.last_category?.trim() || "";

    if (lastPrice > 0 && category) {
      const ceiling = Math.max(100, Math.ceil(lastPrice));
      return {
        kind: "search",
        mode: "stage7_same_budget",
        query: `${category} under ${ceiling}`,
      };
    }
  }

  if (stage7IsContextAvailabilityIntent(messageText)) {
    const base = stage7ContextBase(freshState);

    if (base) {
      return {
        kind: "search",
        mode: "stage7_context_availability",
        query: [
          base,
          freshState?.last_size
            ? `size ${freshState.last_size}`
            : "",
          freshState?.last_color || "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    }
  }

  if (stage7IsGenericDiscoveryIntent(messageText)) {
    if (freshState?.last_category?.trim()) {
      return {
        kind: "search",
        mode: "stage7_context_discovery",
        query: [
          freshState.last_category,
          freshState.last_size
            ? `size ${freshState.last_size}`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    }

    return {
      kind: "search",
      mode: "stage7_discovery",
      query: "featured trending",
    };
  }

  return null;
}

function stage6EstimatedTotal(
  matches: UnifiedInventoryResult[],
): number {
  return matches.reduce(
    (sum, result) =>
      sum + Math.max(0, safeNumber(result.sellingPriceMin)),
    0,
  );
}

function contextualInventoryQuery(
  state: SalesConversationRow | null,
  messageText: string,
): string {
  if (
    !state ||
    !contextIsFresh(state)
  ) {
    return messageText;
  }

  const normalized =
    normalizeSearchText(messageText);

  const intent =
    parseSmartProductIntent(
      messageText,
    );

  const genericRefinementWords =
    new Set([
      "price",
      "cost",
      "rate",
      "enta",
      "entha",
      "more",
      "inka",
      "show",
      "cheap",
      "cheaper",
      "takkuva",
      "premium",
      "best",
      "option",
      "same",
      "model",
      "another",
      "other",
      "different",
      "similar",
      "like",
      "this",
      "size",
      "colour",
      "color",
      "available",
      "unda",
      "undha",
      "unnaya",
    ]);

  const lexicalTerms =
    queryTerms(messageText)
      .filter(
        (term) =>
          !genericRefinementWords.has(
            term,
          ) &&
          !SMART_COLOR_TERMS.includes(
            term,
          ) &&
          !SMART_FABRIC_TERMS.includes(
            term,
          ) &&
          !intent.categoryHints.includes(
            term,
          ),
      );

  /*
   * Stage 5 conversion refinements must stay on the current conversation
   * instead of being misread as fresh catalogue keywords.
   */
  if (
    isSameModelOtherColourIntent(
      messageText,
    )
  ) {
    const sameModelParts = [
      state.last_product_name,
      state.last_brand,
    ]
      .map((value) => value?.trim() || "")
      .filter(Boolean);

    if (intent.sizes.length > 0) {
      sameModelParts.push(
        `size ${intent.sizes[0]}`,
      );
    } else if (state.last_size) {
      sameModelParts.push(
        `size ${state.last_size}`,
      );
    }

    if (intent.colorHints.length > 0) {
      sameModelParts.push(
        intent.colorHints[0],
      );
    }

    if (sameModelParts.length > 0) {
      return sameModelParts
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  if (
    isSimilarProductsIntent(
      messageText,
    )
  ) {
    const similarParts = [
      state.last_category,
    ]
      .map((value) => value?.trim() || "")
      .filter(Boolean);

    if (intent.sizes.length > 0) {
      similarParts.push(
        `size ${intent.sizes[0]}`,
      );
    } else if (state.last_size) {
      similarParts.push(
        `size ${state.last_size}`,
      );
    }

    if (intent.colorHints.length > 0) {
      similarParts.push(
        intent.colorHints[0],
      );
    }

    if (similarParts.length > 0) {
      return similarParts
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  /*
   * A new explicit brand/name term starts a fresh search.
   * Short refinements keep the previous product context.
   */
  if (
    lexicalTerms.length > 0 &&
    !isMoreProductsIntent(
      messageText,
    ) &&
    !isBestOptionIntent(
      messageText,
    )
  ) {
    return messageText;
  }

  const base =
    [
      state.last_product_name,
      state.last_brand,
      state.last_category,
    ]
      .map(
        (value) =>
          value?.trim() || "",
      )
      .filter(Boolean)
      .slice(0, 2)
      .join(" ");

  if (!base) {
    return messageText;
  }

  const parts = [base];

  if (
    intent.sizes.length === 0 &&
    state.last_size &&
    !isMoreProductsIntent(
      messageText,
    )
  ) {
    parts.push(
      `size ${state.last_size}`,
    );
  }

  if (
    intent.colorHints.length === 0 &&
    state.last_color &&
    !isMoreProductsIntent(
      messageText,
    )
  ) {
    parts.push(
      state.last_color,
    );
  }

  const lastPrice =
    safeNumber(
      state.last_price,
    );

  if (
    isCheaperIntent(messageText) &&
    lastPrice > 100
  ) {
    parts.push(
      `under ${Math.max(
        100,
        Math.floor(lastPrice - 1),
      )}`,
    );
  } else if (
    isPremiumIntent(messageText) &&
    lastPrice > 0
  ) {
    parts.push(
      `above ${Math.ceil(
        lastPrice + 1,
      )}`,
    );
  } else if (
    !isBestOptionIntent(
      messageText,
    ) &&
    (
      !hasPriceQuestion(
        messageText,
      ) ||
      parseSmartPriceIntent(
        messageText,
      ).minPrice != null ||
      parseSmartPriceIntent(
        messageText,
      ).maxPrice != null
    )
  ) {
    parts.push(
      normalized,
    );
  }

  return parts
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function relaxedAlternativeQuery(
  state: SalesConversationRow | null,
  contextualQuery: string,
  messageText: string,
): string | null {
  const intent =
    parseSmartProductIntent(
      messageText,
    );

  if (
    intent.sizes.length === 0 &&
    intent.colorHints.length === 0
  ) {
    return null;
  }

  let relaxed =
    normalizeSearchText(
      contextualQuery,
    );

  for (const size of intent.sizes) {
    relaxed = relaxed
      .replace(
        new RegExp(
          `\\b(?:size\\s*)?${size.replace(/[^a-z0-9]/gi, "")}\\b`,
          "gi",
        ),
        " ",
      );
  }

  for (
    const color of
    intent.colorHints
  ) {
    relaxed = relaxed
      .replace(
        new RegExp(
          `\\b${color.replace(/[^a-z0-9]/gi, "")}\\b`,
          "gi",
        ),
        " ",
      );
  }

  relaxed = relaxed
    .replace(/\bsize\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    relaxed.length >= 3
  ) {
    return relaxed;
  }

  const fallback =
    [
      state?.last_product_name,
      state?.last_brand,
      state?.last_category,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

  return fallback || null;
}

function variantsMatchingReservationIntent(
  result: UnifiedInventoryResult,
  messageText: string,
  state: SalesConversationRow | null,
): ReservationChoice {
  const intent =
    parseSmartProductIntent(
      messageText,
    );

  const sameProductContext =
    Number(
      state?.last_selected_product_id ||
      0,
    ) ===
      Number(
        result.product.id,
      );

  const requestedSize =
    intent.sizes[0] ||
    (
      sameProductContext
        ? state?.last_size || null
        : null
    );

  const requestedColor =
    intent.colorHints[0] ||
    (
      sameProductContext
        ? state?.last_color || null
        : null
    );

  const available =
    result.variants.filter(
      (variant) =>
        variantAvailableStock(
          variant,
        ) > 0,
    );

  if (
    available.length === 0
  ) {
    return {
      result,
      variant: null,
      requestedSize,
      requestedColor,
      ambiguousSizes: [],
      ambiguousColors: [],
    };
  }

  if (
    sameProductContext &&
    !intent.sizes.length &&
    !intent.colorHints.length &&
    state?.last_selected_variant_id
  ) {
    const selected =
      available.find(
        (variant) =>
          Number(variant.id) ===
          Number(
            state.last_selected_variant_id,
          ),
      );

    if (selected) {
      return {
        result,
        variant: selected,
        requestedSize:
          selected.size ||
          requestedSize,
        requestedColor:
          selected.color ||
          requestedColor,
        ambiguousSizes: [],
        ambiguousColors: [],
      };
    }
  }

  let filtered = available;

  if (requestedSize) {
    const normalizedSize =
      normalizeSearchText(
        requestedSize,
      );

    filtered = filtered.filter(
      (variant) =>
        normalizeSearchText(
          variant.size,
        ) === normalizedSize,
    );
  }

  if (requestedColor) {
    const normalizedColor =
      normalizeSearchText(
        requestedColor,
      );

    filtered = filtered.filter(
      (variant) =>
        normalizeSearchText(
          variant.color,
        ).includes(
          normalizedColor,
        ),
    );
  }

  if (
    filtered.length === 1
  ) {
    return {
      result,
      variant:
        filtered[0],
      requestedSize:
        filtered[0].size ||
        requestedSize,
      requestedColor:
        filtered[0].color ||
        requestedColor,
      ambiguousSizes: [],
      ambiguousColors: [],
    };
  }

  if (
    filtered.length > 1
  ) {
    const uniqueSizes =
      uniqueCleanValues(
        filtered.map(
          (variant) =>
            variant.size,
        ),
      );

    const uniqueColors =
      uniqueCleanValues(
        filtered.map(
          (variant) =>
            variant.color,
        ),
      );

    /*
     * STAGE 9.1 • SINGLE-ITEM BOOKING FIX
     *
     * When the customer has explicitly selected an exact size, colour is
     * optional unless the customer explicitly asked for a colour. Some POS
     * products have more than one internal variant row for the same size.
     * The old flow treated those rows as another required customer choice and
     * blocked BOOK with "one more option".
     *
     * For a size-only request we choose the in-stock row with the highest
     * available quantity. The customer may still send a colour before BOOK;
     * an explicit colour request continues to be matched strictly above.
     */
    if (
      requestedSize &&
      !requestedColor &&
      intent.colorHints.length === 0
    ) {
      const selectedVariant =
        [...filtered].sort(
          (left, right) =>
            variantAvailableStock(right) -
            variantAvailableStock(left),
        )[0];

      return {
        result,
        variant: selectedVariant,
        requestedSize:
          selectedVariant.size ||
          requestedSize,
        requestedColor: null,
        ambiguousSizes: [],
        ambiguousColors: [],
      };
    }

    if (
      uniqueSizes.length <= 1 &&
      uniqueColors.length <= 1
    ) {
      return {
        result,
        variant:
          filtered[0],
        requestedSize:
          filtered[0].size ||
          requestedSize,
        requestedColor:
          filtered[0].color ||
          requestedColor,
        ambiguousSizes: [],
        ambiguousColors: [],
      };
    }

    return {
      result,
      variant: null,
      requestedSize,
      requestedColor,
      ambiguousSizes:
        uniqueSizes,
      ambiguousColors:
        uniqueColors,
    };
  }

  return {
    result,
    variant: null,
    requestedSize,
    requestedColor,
    ambiguousSizes:
      requestedSize
        ? []
        : result.availableSizes,
    ambiguousColors:
      requestedColor
        ? []
        : result.availableColors,
  };
}

async function loadUnifiedInventoryResultByProductId(
  admin: any,
  productId: number,
): Promise<UnifiedInventoryResult | null> {
  const [
    productResponse,
    variantResponse,
  ] = await Promise.all([
    admin
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("is_active", true)
      .maybeSingle(),
    admin
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .eq("is_active", true)
      .gt("stock", 0),
  ]);

  if (
    productResponse.error ||
    !productResponse.data
  ) {
    return null;
  }

  const product =
    productResponse.data as
      ProductRow;

  const variants =
    (
      variantResponse.data ||
      []
    ) as InventoryVariantRow[];

  const availableVariants =
    variants.filter(
      (variant) =>
        variantAvailableStock(
          variant,
        ) > 0,
    );

  const availableStock =
    availableVariants.length > 0
      ? availableVariants.reduce(
          (sum, variant) =>
            sum +
            variantAvailableStock(
              variant,
            ),
          0,
        )
      : Math.max(
          0,
          safeNumber(
            product.stock,
          ),
        );

  if (
    availableStock <= 0
  ) {
    return null;
  }

  const prices =
    inventoryDisplayPrices(
      product,
      availableVariants,
    );

  const intent =
    parseSmartProductIntent(
      [
        product.name,
        product.brand,
      ]
        .filter(Boolean)
        .join(" "),
    );

  return {
    product,
    variants:
      availableVariants,
    score: 999,
    isOnline:
      inventoryIsOnline(
        product,
        availableVariants,
      ),
    availableStock,
    availableSizes:
      availableVariants.length > 0
        ? uniqueCleanValues(
            availableVariants.map(
              (variant) =>
                variant.size,
            ),
          )
        : uniqueCleanValues(
            parseImageArray(
              product.sizes,
            ),
          ),
    availableColors:
      uniqueCleanValues(
        availableVariants.map(
          (variant) =>
            variant.color,
        ),
      ),
    sellingPriceMin:
      prices.sellingPriceMin,
    sellingPriceMax:
      prices.sellingPriceMax,
    mrpMin:
      prices.mrpMin,
    mrpMax:
      prices.mrpMax,
    stockLabel:
      inventoryAvailabilityLabel(
        availableStock,
        product,
      ),
    bestImageUrl:
      inventoryBestImage(
        product,
        availableVariants,
        intent,
      ),
  };
}

function isContextualSizeQuestion(
  messageText: string,
  state: SalesConversationRow | null,
): boolean {
  if (!state || !contextIsFresh(state)) {
    return false;
  }

  const intent =
    parseSmartProductIntent(messageText);

  if (intent.sizes.length === 0) {
    return false;
  }

  const normalized =
    normalizeSearchText(messageText);

  const stripped = normalized
    .replace(/\b(?:size|available|availability|unda|undha|unnaya|unnai|vunda|vundha|is|there|do|you|have|kavali|kaavali|please|pls)\b/g, " ")
    .replace(/ఉందా|ఉన్నాయా|ఉన్నాయి|సైజ్|కావాలి/g, " ")
    .replace(/\b(?:xs|s|m|l|xl|xxl|xxxl|free\s*size|28|30|32|34|36|38|40|42|44|46|48|50)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return stripped.length === 0;
}

async function loadContextualSizeMatches(
  admin: any,
  state: SalesConversationRow,
  messageText: string,
): Promise<UnifiedInventoryResult[]> {
  const requestedSize =
    parseSmartProductIntent(messageText).sizes[0];

  if (!requestedSize) {
    return [];
  }

  const ids = Array.isArray(
    state.last_result_product_ids,
  )
    ? state.last_result_product_ids
        .map(Number)
        .filter((id) => id > 0)
        .slice(0, 6)
    : [];

  if (
    ids.length === 0 &&
    Number(state.last_selected_product_id || 0) > 0
  ) {
    ids.push(
      Number(state.last_selected_product_id),
    );
  }

  const loaded = await Promise.all(
    ids.map((id) =>
      loadUnifiedInventoryResultByProductId(
        admin,
        id,
      ),
    ),
  );

  const normalizedSize =
    normalizeSearchText(requestedSize);

  return loaded
    .filter(
      (result): result is UnifiedInventoryResult =>
        Boolean(result),
    )
    .filter((result) =>
      result.variants.some(
        (variant) =>
          variantAvailableStock(variant) > 0 &&
          normalizeSearchText(variant.size) ===
            normalizedSize,
      ),
    )
    .slice(0, PRODUCT_COUNT);
}


function isContextualColorQuestion(
  messageText: string,
  state: SalesConversationRow | null,
): boolean {
  if (!state || !contextIsFresh(state)) {
    return false;
  }

  const intent =
    parseSmartProductIntent(messageText);

  if (intent.colorHints.length === 0) {
    return false;
  }

  const normalized =
    normalizeSearchText(messageText);

  const stripped = normalized
    .replace(/\b(?:colour|color|available|availability|unda|undha|unnaya|unnai|vunda|vundha|is|there|do|you|have|kavali|kaavali|please|pls)\b/g, " ")
    .replace(/ఉందా|ఉన్నాయా|ఉన్నాయి|కలర్|రంగు|కావాలి/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((term) => !SMART_COLOR_TERMS.includes(term))
    .join(" ")
    .trim();

  return stripped.length === 0;
}

async function loadContextualColorMatches(
  admin: any,
  state: SalesConversationRow,
  messageText: string,
): Promise<UnifiedInventoryResult[]> {
  const requestedColor =
    parseSmartProductIntent(messageText).colorHints[0];

  if (!requestedColor) {
    return [];
  }

  const ids = Array.isArray(
    state.last_result_product_ids,
  )
    ? state.last_result_product_ids
        .map(Number)
        .filter((id) => id > 0)
        .slice(0, 6)
    : [];

  if (
    ids.length === 0 &&
    Number(state.last_selected_product_id || 0) > 0
  ) {
    ids.push(
      Number(state.last_selected_product_id),
    );
  }

  const loaded = await Promise.all(
    ids.map((id) =>
      loadUnifiedInventoryResultByProductId(
        admin,
        id,
      ),
    ),
  );

  const normalizedColor =
    normalizeSearchText(requestedColor);

  return loaded
    .filter(
      (result): result is UnifiedInventoryResult =>
        Boolean(result),
    )
    .filter((result) =>
      result.variants.some(
        (variant) =>
          variantAvailableStock(variant) > 0 &&
          normalizeSearchText(variant.color).includes(
            normalizedColor,
          ),
      ),
    )
    .slice(0, PRODUCT_COUNT);
}

async function resolveConversationSelection(
  admin: any,
  state: SalesConversationRow | null,
  messageText: string,
): Promise<UnifiedInventoryResult | null> {
  if (!state) {
    return null;
  }

  const ordinal =
    parseOrdinalSelection(
      messageText,
    );

  if (
    ordinal != null &&
    Array.isArray(
      state.last_result_product_ids,
    )
  ) {
    const productId = Number(
      state.last_result_product_ids[
        ordinal - 1
      ] || 0,
    );

    if (productId > 0) {
      return loadUnifiedInventoryResultByProductId(
        admin,
        productId,
      );
    }
  }

  const selectedProductId =
    Number(
      state.last_selected_product_id ||
      0,
    );

  if (
    selectedProductId > 0
  ) {
    return loadUnifiedInventoryResultByProductId(
      admin,
      selectedProductId,
    );
  }

  return null;
}

async function saveConversationFromInventoryMatches(
  admin: any,
  phone: string,
  messageText: string,
  matches: UnifiedInventoryResult[],
): Promise<void> {
  const top = matches[0];

  if (!top) {
    return;
  }

  const intent =
    parseSmartProductIntent(
      messageText,
    );

  const choice =
    variantsMatchingReservationIntent(
      top,
      messageText,
      null,
    );

  const selectedVariant =
    choice.variant;

  const selectedSize =
    intent.sizes[0] ||
    selectedVariant?.size ||
    (
      top.availableSizes.length === 1
        ? top.availableSizes[0]
        : null
    );

  const selectedColor =
    intent.colorHints[0] ||
    selectedVariant?.color ||
    (
      top.availableColors.length === 1
        ? top.availableColors[0]
        : null
    );

  await saveSalesConversation(
    admin,
    phone,
    {
      last_query:
        messageText,
      last_result_product_ids:
        matches.map(
          (result) =>
            Number(
              result.product.id,
            ),
        ),
      last_selected_product_id:
        Number(
          top.product.id,
        ),
      last_selected_variant_id:
        selectedVariant
          ? Number(
              selectedVariant.id,
            )
          : null,
      last_product_name:
        top.product.name || null,
      last_brand:
        top.product.brand || null,
      last_category:
        top.product.category ||
        top.product.subcategory ||
        null,
      last_size:
        selectedSize,
      last_color:
        selectedColor,
      last_price:
        top.sellingPriceMin > 0
          ? top.sellingPriceMin
          : null,
    },
  );

  await recordShoppingMemorySafe(
    admin,
    phone,
    {
      brand:
        top.product.brand,
      category:
        top.product.category ||
        top.product.subcategory,
      size:
        selectedSize,
      color:
        selectedColor,
      query:
        messageText,
      reserved: false,
    },
  );
}

function buildSelectionCaption(
  result: UnifiedInventoryResult,
  option: number,
): string {
  return [
    "✨ NEW CITY STYLE",
    "",
    `✅ Option ${option} selected`,
    `*${result.product.name?.trim() || "Product"}*`,
    result.product.brand?.trim() || "",
    result.availableSizes.length > 0
      ? `Sizes: ${result.availableSizes.slice(0, 10).join(", ")}`
      : "",
    result.availableColors.length > 0
      ? `Colours: ${result.availableColors.slice(0, 8).join(", ")}`
      : "",
    formatInventoryPrice(
      result.sellingPriceMin,
      result.sellingPriceMax,
    )
      ? `Price: ${formatInventoryPrice(
          result.sellingPriceMin,
          result.sellingPriceMax,
        )}`
      : "",
    "",
    "Reply with size / colour if needed, then send BOOK to reserve it.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildReservationNeedChoiceText(
  choice: ReservationChoice,
): string {
  const lines = [
    "✨ NEW CITY STYLE",
    "",
    `*${choice.result.product.name?.trim() || "Product"}*`,
    "I can reserve it for you, but I need the exact option first.",
  ];

  if (
    choice.ambiguousSizes.length > 1
  ) {
    lines.push(
      `Choose size: ${choice.ambiguousSizes.slice(0, 12).join(", ")}`,
    );
  }

  if (
    choice.ambiguousColors.length > 1
  ) {
    lines.push(
      `Choose colour: ${choice.ambiguousColors.slice(0, 10).join(", ")}`,
    );
  }

  lines.push("");
  lines.push(
    "Example: XL black • then BOOK",
  );

  return lines.join("\n");
}

function formatReservationExpiry(
  value?: string | null,
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      timeZone:
        "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    },
  ).format(date);
}

function buildReservationConfirmationText(
  reservation: ReservationRpcResult,
  requestedQuantity = 1,
): string {
  const expiry =
    formatReservationExpiry(
      reservation.expires_at,
    );

  const lines = [
    "✨ NEW CITY STYLE",
    "",
    reservation.existing
      ? "✅ ALREADY RESERVED — no duplicate booking created"
      : "✅ RESERVED FOR YOU",
    `*${reservation.product_name || "Selected Product"}*`,
  ];

  if (
    reservation.brand
  ) {
    lines.push(
      reservation.brand,
    );
  }

  if (
    reservation.size
  ) {
    lines.push(
      `Size: ${reservation.size}`,
    );
  }

  if (
    reservation.color
  ) {
    lines.push(
      `Colour: ${reservation.color}`,
    );
  }

  const quantity = Math.max(
    1,
    Math.min(
      5,
      Math.trunc(
        safeNumber(
          reservation.quantity,
        ) || requestedQuantity,
      ),
    ),
  );

  if (quantity > 1) {
    lines.push(
      `Quantity: ${quantity} pieces`,
    );
  }

  const price =
    safeNumber(
      reservation.price,
    );

  if (price > 0) {
    lines.push(
      `Price: ${money(price)}`,
    );
  }

  if (
    reservation.reservation_code
  ) {
    lines.push(
      `Booking ID: ${reservation.reservation_code}`,
    );
  }

  if (expiry) {
    lines.push(
      `Hold until: ${expiry}`,
    );
  }

  lines.push("");
  lines.push(
    "📍 NEW CITY STYLE READY MADE",
  );
  lines.push(
    "Send CANCEL BOOKING if you no longer need it.",
  );

  return lines.join("\n");
}

async function reserveInventoryChoice(
  admin: any,
  phone: string,
  messageId: string,
  choice: ReservationChoice,
  messageText: string,
  quantity = 1,
): Promise<ReservationRpcResult> {
  const { data, error } =
    await admin.rpc(
      "ncs_whatsapp_reserve_item_v1",
      {
        p_phone: phone,
        p_product_id:
          Number(
            choice.result.product.id,
          ),
        p_variant_id:
          choice.variant
            ? Number(
                choice.variant.id,
              )
            : null,
        p_quantity: Math.max(
          1,
          Math.min(
            5,
            Math.trunc(quantity),
          ),
        ),
        p_hold_minutes:
          reservationHoldMinutes(),
        p_message_id:
          messageId,
        p_query_snapshot:
          messageText || null,
      },
    );

  if (error) {
    throw new Error(
      `Reservation failed: ${error.message}`,
    );
  }

  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
  ) {
    return data as
      ReservationRpcResult;
  }

  return {
    reserved: false,
    reason:
      "invalid_reservation_response",
  };
}

async function releaseLatestReservation(
  admin: any,
  phone: string,
  reservationCode?: string | null,
): Promise<ReservationRpcResult> {
  const { data, error } =
    await admin.rpc(
      "ncs_whatsapp_release_reservation_v1",
      {
        p_phone: phone,
        p_reservation_code:
          reservationCode || null,
      },
    );

  if (error) {
    throw new Error(
      `Reservation release failed: ${error.message}`,
    );
  }

  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
  ) {
    return data as
      ReservationRpcResult;
  }

  return {
    released: false,
    reason:
      "invalid_release_response",
  };
}

async function releaseReservationTarget(
  admin: any,
  phone: string,
  messageText: string,
): Promise<ReservationRpcResult> {
  const target = parseReservationCancelTarget(messageText);

  if (target.mode === "code") {
    return releaseLatestReservation(
      admin,
      phone,
      target.code || null,
    );
  }

  if (target.mode === "ordinal") {
    const ordinal = Math.max(1, Math.min(5, target.ordinal || 1));
    const reservations = await activeReservations(
      admin,
      phone,
      5,
    );
    const selected = reservations[ordinal - 1];
    const code = selected?.reservation_code
      ? String(selected.reservation_code)
      : null;

    if (!code) {
      return {
        released: false,
        reason: "reservation_ordinal_not_found",
      };
    }

    return releaseLatestReservation(
      admin,
      phone,
      code,
    );
  }

  return releaseLatestReservation(
    admin,
    phone,
    null,
  );
}

async function activeReservations(
  admin: any,
  phone: string,
  limit = 5,
): Promise<Array<Record<string, unknown>>> {
  const { data, error } =
    await admin
      .from(
        "whatsapp_stock_reservations",
      )
      .select("*")
      .eq("phone", phone)
      .eq("status", "active")
      .gt(
        "expires_at",
        new Date().toISOString(),
      )
      .order(
        "created_at",
        { ascending: false },
      )
      .limit(
        Math.max(1, Math.min(5, limit)),
      );

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? (data as Array<Record<string, unknown>>)
    : [];
}

async function latestActiveReservation(
  admin: any,
  phone: string,
): Promise<Record<string, unknown> | null> {
  const reservations = await activeReservations(
    admin,
    phone,
    1,
  );

  return reservations[0] || null;
}

async function latestReservationHistory(
  admin: any,
  phone: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } =
    await admin
      .from(
        "whatsapp_stock_reservations",
      )
      .select("*")
      .eq("phone", phone)
      .order(
        "created_at",
        { ascending: false },
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return (data || null) as Record<string, unknown> | null;
}

function reservationStatusLine(
  reservation: Record<string, unknown>,
  index: number,
): string {
  const expiry = formatReservationExpiry(
    String(reservation.expires_at || ""),
  );
  const price = safeNumber(
    reservation.price as number | string | null,
  );
  const quantity = Math.max(
    1,
    Math.trunc(
      safeNumber(
        reservation.quantity as number | string | null,
      ) || 1,
    ),
  );

  return [
    `*${index}. ${String(reservation.product_name || "Product")}*`,
    reservation.brand ? String(reservation.brand) : "",
    reservation.variant_size
      ? `Size: ${String(reservation.variant_size)}`
      : "",
    reservation.variant_color
      ? `Colour: ${String(reservation.variant_color)}`
      : "",
    quantity > 1 ? `Quantity: ${quantity}` : "",
    price > 0 ? `Price: ${money(price)}` : "",
    reservation.reservation_code
      ? `Booking ID: ${String(reservation.reservation_code)}`
      : "",
    expiry ? `Hold until: ${expiry}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildReservationStatusListText(
  reservations: Array<Record<string, unknown>>,
  history: Record<string, unknown> | null,
): string {
  if (reservations.length === 0) {
    const historyStatus = normalizeSearchText(
      String(history?.status || ""),
    );

    const previousLine =
      historyStatus === "expired"
        ? "Your most recent booking has expired."
        : historyStatus === "released" || historyStatus === "cancelled"
          ? "Your most recent booking was cancelled/released."
          : "You don't have an active WhatsApp reservation right now.";

    return [
      "✨ NEW CITY STYLE",
      "",
      previousLine,
      "Search any product and send BOOK whenever you want to reserve it.",
    ].join("\n");
  }

  return [
    "✨ NEW CITY STYLE",
    "",
    reservations.length === 1
      ? "✅ ACTIVE RESERVATION"
      : `✅ ${reservations.length} ACTIVE RESERVATIONS`,
    "",
    ...reservations
      .map((reservation, index) =>
        reservationStatusLine(reservation, index + 1),
      )
      .flatMap((line, index, all) =>
        index < all.length - 1 ? [line, ""] : [line],
      ),
    "",
    reservations.length > 1
      ? "To cancel one, send: CANCEL 2ND BOOKING (or use its Booking ID)."
      : "Send CANCEL BOOKING if you no longer need it.",
  ].join("\n");
}

function buildReservationStatusText(
  reservation: Record<string, unknown> | null,
): string {
  return buildReservationStatusListText(
    reservation ? [reservation] : [],
    null,
  );
}

async function loadUnifiedInventorySearch(
  admin: any,
  messageText: string,
  previousProductIds: number[],
): Promise<UnifiedInventorySearch> {
  const intent =
    parseSmartProductIntent(
      messageText,
    );

  const terms =
    inventoryQueryTerms(
      messageText,
    );

  if (
    !shouldUseUnifiedInventorySearch(
      messageText,
    )
  ) {
    return {
      meaningful: false,
      normalizedQuery:
        intent.normalized,
      matches: [],
    };
  }

  const [
    productResponse,
    variantResponse,
  ] = await Promise.all([
    admin
      .from("products")
      .select("*")
      .eq(
        "is_active",
        true,
      )
      .order(
        "updated_at",
        {
          ascending: false,
          nullsFirst: false,
        },
      )
      .limit(
        UNIFIED_INVENTORY_PRODUCT_LIMIT,
      ),
    admin
      .from(
        "product_variants",
      )
      .select("*")
      .gt(
        "stock",
        0,
      )
      .limit(1500),
  ]);

  if (
    productResponse.error
  ) {
    throw new Error(
      `Unable to load store inventory: ${productResponse.error.message}`,
    );
  }

  if (
    variantResponse.error
  ) {
    console.warn(
      "UNIFIED INVENTORY VARIANT LOAD FAILED; USING PRODUCT STOCK:",
      variantResponse.error
        .message,
    );
  }

  const products =
    (
      productResponse.data ||
      []
    ) as ProductRow[];

  const allVariants =
    (
      variantResponse.data ||
      []
    ) as InventoryVariantRow[];

  const variantsByProduct =
    new Map<
      number,
      InventoryVariantRow[]
    >();

  for (
    const variant of
    allVariants
  ) {
    if (
      variant.is_active ===
      false
    ) {
      continue;
    }

    const productId =
      Number(
        variant.product_id,
      );

    if (!productId) {
      continue;
    }

    const existing =
      variantsByProduct.get(
        productId,
      ) || [];

    existing.push(
      variant,
    );

    variantsByProduct.set(
      productId,
      existing,
    );
  }

  const previousSet =
    new Set(
      previousProductIds.map(
        Number,
      ),
    );

  const ranked:
    UnifiedInventoryResult[] =
    [];

  for (
    const product of
    products
  ) {
    if (
      product.is_active ===
        false ||
      normalizeSearchText(
        product.status,
      ) === "inactive"
    ) {
      continue;
    }

    const variants =
      (
        variantsByProduct.get(
          Number(
            product.id,
          ),
        ) || []
      ).filter(
        (variant) =>
          variantAvailableStock(
            variant,
          ) > 0,
      );

    const availableStock =
      variants.length > 0
        ? variants.reduce(
            (
              total,
              variant,
            ) =>
              total +
              variantAvailableStock(
                variant,
              ),
            0,
          )
        : Math.max(
            0,
            safeNumber(
              product.stock,
            ),
          );

    if (
      availableStock <= 0
    ) {
      continue;
    }

    if (
      !resultMatchesInventoryHardIntent(
        product,
        variants,
        intent,
      )
    ) {
      continue;
    }

    const score =
      scoreUnifiedInventoryResult(
        product,
        variants,
        intent,
        terms,
        previousSet,
      );

    if (
      score <= 0
    ) {
      continue;
    }

    const prices =
      inventoryDisplayPrices(
        product,
        variants,
      );

    const availableSizes =
      variants.length > 0
        ? uniqueCleanValues(
            variants.map(
              (variant) =>
                variant.size,
            ),
          )
        : uniqueCleanValues(
            parseImageArray(
              product.sizes,
            ),
          );

    const availableColors =
      uniqueCleanValues(
        variants.map(
          (variant) =>
            variant.color,
        ),
      );

    ranked.push({
      product,
      variants,
      score,
      isOnline:
        inventoryIsOnline(
          product,
          variants,
        ),
      availableStock,
      availableSizes,
      availableColors,
      sellingPriceMin:
        prices.sellingPriceMin,
      sellingPriceMax:
        prices.sellingPriceMax,
      mrpMin:
        prices.mrpMin,
      mrpMax:
        prices.mrpMax,
      stockLabel:
        inventoryAvailabilityLabel(
          availableStock,
          product,
        ),
      bestImageUrl:
        inventoryBestImage(
          product,
          variants,
          intent,
        ),
    });
  }

  const rankCheapest =
    isCheaperIntent(
      intent.normalized,
    );

  const rankPremium =
    isPremiumIntent(
      intent.normalized,
    );

  const rankBest =
    isBestOptionIntent(
      intent.normalized,
    );

  ranked.sort(
    (left, right) => {
      /*
       * Stage 5 keeps relevance as the safety boundary, then applies the
       * customer's conversion preference inside similarly-relevant results.
       */
      const scoreGap =
        Math.abs(
          right.score -
          left.score,
        );

      if (scoreGap > 20) {
        return (
          right.score -
          left.score
        );
      }

      if (rankCheapest) {
        const leftPrice =
          left.sellingPriceMin > 0
            ? left.sellingPriceMin
            : Number.MAX_SAFE_INTEGER;
        const rightPrice =
          right.sellingPriceMin > 0
            ? right.sellingPriceMin
            : Number.MAX_SAFE_INTEGER;

        if (leftPrice !== rightPrice) {
          return leftPrice - rightPrice;
        }
      }

      if (rankPremium) {
        const leftPrice =
          left.sellingPriceMax ||
          left.sellingPriceMin;
        const rightPrice =
          right.sellingPriceMax ||
          right.sellingPriceMin;

        if (leftPrice !== rightPrice) {
          return rightPrice - leftPrice;
        }
      }

      if (rankBest) {
        if (
          right.availableStock !==
          left.availableStock
        ) {
          return (
            right.availableStock -
            left.availableStock
          );
        }

        if (
          left.isOnline !==
          right.isOnline
        ) {
          return left.isOnline
            ? -1
            : 1;
        }
      }

      if (
        right.score !==
        left.score
      ) {
        return (
          right.score -
          left.score
        );
      }

      if (
        left.isOnline !==
        right.isOnline
      ) {
        return left.isOnline
          ? -1
          : 1;
      }

      return (
        (
          Date.parse(
            right.product
              .updated_at || "",
          ) || 0
        ) -
        (
          Date.parse(
            left.product
              .updated_at || "",
          ) || 0
        )
      );
    },
  );

  const physicalStructuredIntent =
    intent.minPrice != null ||
    intent.maxPrice != null ||
    intent.sizes.length > 0 ||
    intent.audience != null ||
    intent.categoryHints.length > 0 ||
    intent.colorHints.length > 0 ||
    intent.fabricHints.length > 0;

  const strongLexicalMatch =
    ranked.some(
      (result) =>
        result.score >= 28,
    );

  const meaningful =
    physicalStructuredIntent ||
    hasInventoryAvailabilityLanguage(
      intent.normalized,
    ) ||
    strongLexicalMatch;

  return {
    meaningful,
    normalizedQuery:
      intent.normalized,
    matches:
      meaningful
        ? ranked.slice(
            0,
            PRODUCT_COUNT,
          )
        : [],
  };
}

function formatInventoryPrice(
  minimum: number,
  maximum: number,
): string | null {
  if (
    minimum <= 0 &&
    maximum <= 0
  ) {
    return null;
  }

  if (
    maximum > minimum &&
    minimum > 0
  ) {
    return `${money(
      minimum,
    )} – ${money(
      maximum,
    )}`;
  }

  return money(
    Math.max(
      minimum,
      maximum,
    ),
  );
}

function buildUnifiedInventoryCaption(
  result: UnifiedInventoryResult,
  index: number,
  total: number,
  customerName?: string,
): string {
  const {
    product,
  } = result;

  const lines = [
    index === 0
      ? `✨ NEW CITY STYLE${
          customerName
            ? ` • ${customerName}`
            : ""
        }`
      : "✨ NEW CITY STYLE",
    "",
    `*${product.name?.trim() || "Product"}*`,
    `Option ${index + 1} of ${total}`,
  ];

  if (
    product.brand?.trim()
  ) {
    lines.push(
      product.brand.trim(),
    );
  }

  lines.push(
    result.isOnline
      ? "✅ Available Online + In Store"
      : "✅ Available in Store",
  );

  if (
    result.availableSizes
      .length > 0
  ) {
    lines.push(
      `Sizes: ${result.availableSizes
        .slice(0, 10)
        .join(", ")}`,
    );
  }

  if (
    result.availableColors
      .length > 0
  ) {
    lines.push(
      `Colours: ${result.availableColors
        .slice(0, 8)
        .join(", ")}`,
    );
  }

  const priceText =
    formatInventoryPrice(
      result.sellingPriceMin,
      result.sellingPriceMax,
    );

  if (priceText) {
    lines.push(
      `Price: ${priceText}`,
    );
  }

  lines.push(
    `Stock: ${result.stockLabel}`,
  );

  if (
    result.isOnline
  ) {
    lines.push("");
    lines.push(
      `🛍️ View Product: ${productUrl(
        product,
      )}`,
    );
  } else {
    lines.push("");
    lines.push(
      "📍 Available at NEW CITY STYLE READY MADE",
    );
  }

  if (
    index ===
    total - 1
  ) {
    lines.push("");
    lines.push(
      "Use the buttons below to select a product and reserve it.",
    );
    lines.push(
      "You can also ask for another brand, size, colour or budget anytime.",
    );
  }

  return lines.join(
    "\n",
  );
}

function unifiedReplyProduct(
  result: UnifiedInventoryResult,
): ProductRow {
  const product =
    result.product;

  const directPreview =
    product.social_preview_url
      ?.trim() ||
    "";

  const bestImage =
    result.bestImageUrl ||
    product.image_url ||
    product.image ||
    null;

  return {
    ...product,
    price:
      result.sellingPriceMin >
      0
        ? result.sellingPriceMin
        : product.price,
    mrp:
      result.mrpMax > 0
        ? result.mrpMax
        : product.mrp,
    image_url:
      bestImage,
    image:
      bestImage,
    social_preview_url:
      directPreview ||
      (
        bestImage &&
        isDirectWhatsAppImageUrl(
          bestImage,
        )
          ? bestImage
          : product.social_preview_url
      ) ||
      null,
  };
}

async function sendWhatsAppTextToCustomer(
  to: string,
  text: string,
): Promise<string | null> {
  const accessToken =
    process.env
      .WHATSAPP_ACCESS_TOKEN
      ?.trim();

  const phoneNumberId =
    process.env
      .WHATSAPP_PHONE_NUMBER_ID
      ?.trim();

  const apiVersion =
    process.env
      .WHATSAPP_API_VERSION
      ?.trim() ||
    "v25.0";

  if (
    !accessToken ||
    !phoneNumberId
  ) {
    throw new Error(
      "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID.",
    );
  }

  return sendProductText({
    to,
    text,
    accessToken,
    phoneNumberId,
    apiVersion,
  });
}

type WhatsAppQuickReplyButton = {
  id: string;
  title: string;
};

async function sendWhatsAppQuickReplyButtons(
  to: string,
  bodyText: string,
  buttons: WhatsAppQuickReplyButton[],
): Promise<string | null> {
  const accessToken =
    process.env
      .WHATSAPP_ACCESS_TOKEN
      ?.trim();

  const phoneNumberId =
    process.env
      .WHATSAPP_PHONE_NUMBER_ID
      ?.trim();

  const apiVersion =
    process.env
      .WHATSAPP_API_VERSION
      ?.trim() ||
    "v25.0";

  if (
    !accessToken ||
    !phoneNumberId
  ) {
    throw new Error(
      "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID.",
    );
  }

  const safeButtons =
    buttons
      .slice(0, 3)
      .map(
        (button) => ({
          type: "reply",
          reply: {
            id:
              button.id.slice(
                0,
                256,
              ),
            title:
              button.title.slice(
                0,
                20,
              ),
          },
        }),
      );

  if (safeButtons.length === 0) {
    return null;
  }

  const response =
    await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          messaging_product:
            "whatsapp",
          recipient_type:
            "individual",
          to,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text:
                bodyText.slice(
                  0,
                  1024,
                ),
            },
            action: {
              buttons:
                safeButtons,
            },
          },
        }),
        cache: "no-store",
      },
    );

  const data =
    (await response.json()) as
      MetaMessageResponse;

  if (
    !response.ok ||
    !Array.isArray(
      data.messages,
    ) ||
    data.messages.length === 0
  ) {
    throw new Error(
      data.error?.message ||
        data.error
          ?.error_data
          ?.details ||
        `WhatsApp interactive button send failed with HTTP ${response.status}.`,
    );
  }

  return (
    data.messages[0]?.id ||
    null
  );
}


type NcsGuidedAudience = "men" | "women" | "kids";

type NcsMenuRow = {
  id: string;
  title: string;
  description?: string;
};

function ncsInteractiveActionId(
  message: WhatsAppIncomingMessage,
): string {
  return (
    message.interactive?.button_reply?.id?.trim() ||
    message.interactive?.list_reply?.id?.trim() ||
    ""
  ).toUpperCase();
}

function ncsGuidedAudienceSelection(
  message: WhatsAppIncomingMessage,
): NcsGuidedAudience | null {
  const actionId = ncsInteractiveActionId(message);

  if (actionId === "NCS_AUDIENCE_MEN") {
    return "men";
  }

  if (actionId === "NCS_AUDIENCE_WOMEN") {
    return "women";
  }

  if (actionId === "NCS_AUDIENCE_KIDS") {
    return "kids";
  }

  const normalized = normalizeSearchText(
    whatsappIncomingMessageText(message),
  );

  if (
    [
      "men",
      "mens",
      "man",
      "gents",
      "gent",
      "male",
    ].includes(normalized)
  ) {
    return "men";
  }

  if (
    [
      "women",
      "womens",
      "woman",
      "ladies",
      "lady",
      "female",
    ].includes(normalized)
  ) {
    return "women";
  }

  if (
    [
      "kids",
      "kid",
      "children",
      "child",
      "boys girls",
    ].includes(normalized)
  ) {
    return "kids";
  }

  return null;
}

function isNcsPoliteCloseIntent(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "thanks",
      "thank you",
      "thankyou",
      "tq",
      "thank u",
      "bye",
      "good bye",
      "goodbye",
      "ధన్యవాదాలు",
      "థాంక్స్",
    ],
  );
}

function hasNcsExplicitShoppingIntent(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);

  if (!normalized) {
    return false;
  }

  const intent = parseSmartProductIntent(messageText);

  if (intent.hasStructuredIntent) {
    return true;
  }

  if (
    containsAnyPhrase(
      normalized,
      [
        "product",
        "products",
        "catalog",
        "catalogue",
        "shop",
        "shopping",
        "price",
        "cost",
        "offer",
        "offers",
        "discount",
        "size",
        "colour",
        "color",
        "stock",
        "available",
        "availability",
        "brand",
        "model",
        "book",
        "booking",
        "reserve",
        "reservation",
        "hold",
        "add to cart",
        "buy",
        "purchase",
        "order",
        "kavali",
        "కావాలి",
        "ధర",
        "సైజ్",
        "కలర్",
        "స్టాక్",
        "ఆఫర్",
      ],
    )
  ) {
    return true;
  }

  const inventoryTerms = inventoryQueryTerms(messageText);

  if (
    inventoryTerms.length > 0 &&
    containsAnyPhrase(
      normalized,
      [
        "show",
        "send",
        "want",
        "need",
        "undha",
        "unda",
        "unnaya",
        "unnayi",
        "చూపించు",
        "ఉందా",
        "ఉన్నాయా",
      ],
    )
  ) {
    return true;
  }

  /*
   * Stage 11.1 deliberately does NOT treat every unknown one/two-word
   * personal message as a brand search. Product/category/audience terms are
   * already detected by parseSmartProductIntent above. A brand-only request
   * can still be made naturally as "Poomex brand", "Poomex products" etc.
   */
  return false;
}

function hasNcsInteractiveBusinessAction(
  message: WhatsAppIncomingMessage,
): boolean {
  return ncsInteractiveActionId(message).startsWith("NCS_");
}

function hasNcsBusinessServiceIntent(
  messageText: string,
): boolean {
  const normalized = normalizeSearchText(messageText);

  return containsAnyPhrase(
    normalized,
    [
      "menu",
      "help",
      "how to order",
      "how to buy",
      "how to book",
      "store",
      "shop",
      "address",
      "location",
      "timing",
      "timings",
      "open time",
      "closing time",
      "contact",
      "business",
      "new city style",
      "ఎలా ఆర్డర్",
      "ఎలా బుక్",
      "అడ్రస్",
      "లొకేషన్",
      "టైమింగ్",
    ],
  );
}

async function sendWhatsAppMenuList(
  to: string,
  bodyText: string,
  buttonText: string,
  sectionTitle: string,
  rows: NcsMenuRow[],
): Promise<string | null> {
  const accessToken =
    process.env
      .WHATSAPP_ACCESS_TOKEN
      ?.trim();

  const phoneNumberId =
    process.env
      .WHATSAPP_PHONE_NUMBER_ID
      ?.trim();

  const apiVersion =
    process.env
      .WHATSAPP_API_VERSION
      ?.trim() ||
    "v25.0";

  if (
    !accessToken ||
    !phoneNumberId
  ) {
    throw new Error(
      "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID.",
    );
  }

  const safeRows =
    rows
      .filter(
        (row) =>
          row.id.trim() &&
          row.title.trim(),
      )
      .slice(0, 10)
      .map((row) => ({
        id: row.id.slice(0, 200),
        title: row.title.slice(0, 24),
        ...(row.description?.trim()
          ? {
              description:
                row.description
                  .trim()
                  .slice(0, 72),
            }
          : {}),
      }));

  if (safeRows.length === 0) {
    return null;
  }

  const response =
    await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          messaging_product:
            "whatsapp",
          recipient_type:
            "individual",
          to,
          type: "interactive",
          interactive: {
            type: "list",
            body: {
              text:
                bodyText.slice(
                  0,
                  1024,
                ),
            },
            footer: {
              text:
                "NEW CITY STYLE",
            },
            action: {
              button:
                buttonText.slice(
                  0,
                  20,
                ),
              sections: [
                {
                  title:
                    sectionTitle.slice(
                      0,
                      24,
                    ),
                  rows: safeRows,
                },
              ],
            },
          },
        }),
        cache: "no-store",
      },
    );

  const data =
    (await response.json()) as
      MetaMessageResponse;

  if (
    !response.ok ||
    !Array.isArray(
      data.messages,
    ) ||
    data.messages.length === 0
  ) {
    throw new Error(
      data.error?.message ||
        data.error
          ?.error_data
          ?.details ||
        `WhatsApp guided menu send failed with HTTP ${response.status}.`,
    );
  }

  return (
    data.messages[0]?.id ||
    null
  );
}

async function sendNcsWelcomeMenuSafe(
  to: string,
  customerName?: string,
  memory?: SalesConversationRow | null,
): Promise<string[]> {
  const firstName =
    (customerName || "")
      .trim()
      .split(/\s+/)[0]
      ?.slice(0, 24) ||
    "";

  const rememberedCategory =
    memory &&
    contextIsFresh(memory) &&
    memory.last_category?.trim()
      ? memory.last_category.trim()
      : "";

  const body = [
    "✨ NEW CITY STYLE కి హృదయపూర్వక స్వాగతం!",
    firstName
      ? `నమస్తే ${firstName} గారు 👋`
      : "నమస్తే 👋",
    "",
    "మీ కుటుంబానికి నచ్చే fashion ఇప్పుడు ఒక్క message దూరంలోనే 🛍️",
    "",
    "👔 Shirts • T-Shirts • Jeans • Pants",
    "👗 Sarees • Kurtis • Dresses • Ladies Wear",
    "🧒 Kids Wear • New Arrivals • Offers",
    "",
    "📏 Size & Colour Availability",
    "🔥 Trending Styles",
    "🏷️ Special Offers",
    "📦 Easy Booking",
    rememberedCategory
      ? `💫 గతసారి మీరు ${rememberedCategory} చూశారు — కావాలంటే అక్కడి నుంచే continue చేయవచ్చు.`
      : "",
    "",
    "ఎవరికి shopping చేస్తున్నారో ఎంచుకోండి 👇",
    "లేదా నేరుగా ఇలా టైప్ చేయండి: XL black shirt under 1000",
  ]
    .filter(Boolean)
    .join("\n");

  const messageIds: string[] = [];

  const menuId =
    await sendWhatsAppQuickReplyButtons(
      to,
      body,
      [
        {
          id: "NCS_AUDIENCE_MEN",
          title: "MEN",
        },
        {
          id: "NCS_AUDIENCE_WOMEN",
          title: "WOMEN",
        },
        {
          id: "NCS_AUDIENCE_KIDS",
          title: "KIDS",
        },
      ],
    ).catch(async (error) => {
      console.warn(
        "NCS GUIDED WELCOME BUTTONS FAILED; USING TEXT FALLBACK:",
        error instanceof Error
          ? error.message
          : String(error),
      );

      return sendWhatsAppTextToCustomer(
        to,
        [
          body,
          "",
          "MEN / WOMEN / KIDS అని reply చేయండి.",
        ].join("\n"),
      );
    });

  if (menuId) {
    messageIds.push(menuId);
  }

  return messageIds;
}


async function loadNcsWelcomeHeroCandidates(
  admin: any,
  excludeProductIds: number[] = [],
): Promise<ProductRow[]> {
  /*
   * FINAL WHATSAPP GREETING IMAGE FIX
   *
   * Older greeting logic depended on products.stock > 0.
   * In the live NCS inventory, real availability can live in product_variants
   * while the parent product stock is 0. That made the greeting text send
   * correctly but left the hero pool empty.
   *
   * This loader treats parent stock + live variant stock as one availability
   * source, exactly like the unified inventory brain.
   */
  const [
    productResponse,
    variantResponse,
  ] = await Promise.all([
    admin
      .from("products")
      .select(
        [
          "id",
          "name",
          "slug",
          "brand",
          "category",
          "subcategory",
          "gender",
          "age_group",
          "sizes",
          "tags",
          "material",
          "fabric",
          "pattern",
          "occasion",
          "price",
          "mrp",
          "online_mrp",
          "stock",
          "sku",
          "barcode",
          "sell_online",
          "online_stock_limit",
          "low_stock_limit",
          "is_active",
          "status",
          "image",
          "image_url",
          "social_preview_url",
          "images",
          "gallery_images",
          "is_featured",
          "is_new_arrival",
          "is_bestseller",
          "is_trending",
          "updated_at",
        ].join(","),
      )
      .eq(
        "is_active",
        true,
      )
      .order(
        "is_featured",
        {
          ascending: false,
        },
      )
      .order(
        "is_new_arrival",
        {
          ascending: false,
        },
      )
      .order(
        "is_bestseller",
        {
          ascending: false,
        },
      )
      .order(
        "is_trending",
        {
          ascending: false,
        },
      )
      .order(
        "updated_at",
        {
          ascending: false,
          nullsFirst: false,
        },
      )
      .limit(160),
    admin
      .from("product_variants")
      .select(
        "product_id,stock,reserved_stock,is_active,sell_online",
      )
      .eq(
        "is_active",
        true,
      )
      .gt(
        "stock",
        0,
      )
      .limit(2000),
  ]);

  if (
    productResponse.error
  ) {
    throw new Error(
      `Unable to load welcome products: ${productResponse.error.message}`,
    );
  }

  const products =
    (
      productResponse.data ||
      []
    ) as ProductRow[];

  const variants =
    variantResponse.error
      ? []
      : (
          variantResponse.data ||
          []
        ) as InventoryVariantRow[];

  if (
    variantResponse.error
  ) {
    console.warn(
      "NCS WELCOME VARIANT STOCK LOAD FAILED; USING PRODUCT STOCK FALLBACK:",
      variantResponse.error.message,
    );
  }

  const liveVariantProductIds =
    new Set<number>();

  for (
    const variant of variants
  ) {
    if (
      variant.is_active ===
      false
    ) {
      continue;
    }

    if (
      variantAvailableStock(
        variant,
      ) <= 0
    ) {
      continue;
    }

    const productId =
      Number(
        variant.product_id,
      );

    if (productId > 0) {
      liveVariantProductIds.add(
        productId,
      );
    }
  }

  const excluded =
    new Set(
      excludeProductIds
        .map(Number)
        .filter(
          (value) =>
            Number.isFinite(value) &&
            value > 0,
        ),
    );

  const eligible =
    products.filter(
      (product) => {
        const status =
          normalizeSearchText(
            product.status,
          );

        if (
          status === "inactive"
        ) {
          return false;
        }

        const productId =
          Number(
            product.id,
          );

        const available =
          safeNumber(
            product.stock,
          ) > 0 ||
          liveVariantProductIds.has(
            productId,
          );

        if (!available) {
          return false;
        }

        return Boolean(
          productImageCandidates(
            product,
          ).length,
        );
      },
    );

  const preferredOnline =
    eligible.filter(
      (product) =>
        product.sell_online !==
        false,
    );

  const pool =
    preferredOnline.length > 0
      ? preferredOnline
      : eligible;

  return [
    ...pool.filter(
      (product) =>
        !excluded.has(
          Number(
            product.id,
          ),
        ),
    ),
    ...pool.filter(
      (product) =>
        excluded.has(
          Number(
            product.id,
          ),
        ),
    ),
  ].slice(
    0,
    12,
  );
}


function greetingHeroSeed(input: string) {
  let hash = 2166136261;

  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function orderGreetingHeroCandidates(
  candidates: ProductRow[],
  customerPhone: string,
) {
  if (candidates.length <= 1) {
    return candidates;
  }

  /*
   * Keep the greeting stable for the same customer on the same day,
   * but rotate the hero product across customers so everyone does not
   * receive the exact same T-shirt image.
   */
  const dayKey = new Date()
    .toISOString()
    .slice(0, 10);

  const phoneKey =
    normalizePhoneNumber(customerPhone) || customerPhone || "guest";

  const seed = greetingHeroSeed(
    `${phoneKey}|${dayKey}`,
  );

  const decorated = candidates.map(
    (product, index) => ({
      product,
      index,
      score: greetingHeroSeed(
        `${seed}|${safeNumber(product.id)}|${index}`,
      ),
    }),
  );

  decorated.sort(
    (a, b) =>
      a.score - b.score ||
      a.index - b.index,
  );

  return decorated.map(
    (entry) =>
      entry.product,
  );
}

async function sendNcsWelcomeHeroProductSafe(
  admin: any,
  to: string,
  excludeProductIds: number[] = [],
): Promise<{
  messageId: string | null;
  productId: number | null;
}> {
  try {
    const candidates =
      await loadNcsWelcomeHeroCandidates(
        admin,
        excludeProductIds,
      );

    if (
      candidates.length === 0
    ) {
      console.warn(
        "NCS WELCOME HERO: no in-stock image candidate found.",
      );

      return {
        messageId: null,
        productId: null,
      };
    }

    /*
     * Use the SAME proven media sender as normal product results.
     * That path already supports:
     *   1) direct JPEG/PNG
     *   2) server-side conversion + Meta media upload
     *   3) safe fallback without breaking the webhook
     *
     * Try several live products so one bad image can never kill the greeting.
     */
    const orderedCandidates =
      orderGreetingHeroCandidates(
        candidates,
        to,
      );

    for (
      const hero of
      orderedCandidates.slice(0, 8)
    ) {
      const sellingPrice =
        safeNumber(
          hero.price,
        );

      const mrp =
        safeNumber(
          hero.online_mrp,
        ) ||
        safeNumber(
          hero.mrp,
        ) ||
        sellingPrice;

      const discountPercent =
        mrp > sellingPrice &&
        sellingPrice > 0
          ? Math.max(
              0,
              Math.round(
                (
                  (
                    mrp -
                    sellingPrice
                  ) /
                  mrp
                ) *
                  100,
              ),
            )
          : 0;

      const caption = [
        "✨ TODAY'S STYLE HIGHLIGHT",
        "",
        `*${hero.name || "NEW CITY STYLE Pick"}*`,
        hero.brand
          ? `🏷️ ${hero.brand}`
          : "",
        sellingPrice > 0
          ? `💰 ${money(sellingPrice)}`
          : "",
        discountPercent > 0
          ? `🔥 ${discountPercent}% OFF`
          : "",
        "",
        `🔗 ${productUrl(
          hero,
        )}`,
        "",
        "MEN / WOMEN / KIDS ఎంచుకుని మరిన్ని styles చూడండి 👇",
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const messageId =
          await sendProductImage({
            to,
            product:
              hero,
            caption,
          });

        if (messageId) {
          console.log(
            "NCS WELCOME HERO SENT:",
            JSON.stringify(
              {
                productId:
                  hero.id,
                messageId,
              },
              null,
              2,
            ),
          );

          return {
            messageId,
            productId:
              Number(
                hero.id,
              ) || null,
          };
        }
      } catch (error) {
        console.warn(
          "NCS WELCOME HERO CANDIDATE FAILED; TRYING NEXT PRODUCT:",
          JSON.stringify(
            {
              productId:
                hero.id,
              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            },
            null,
            2,
          ),
        );
      }
    }

    /*
     * If every image candidate unexpectedly fails, send a compact product
     * fallback so the greeting never looks incomplete. This is only a final
     * safety net; the eight-candidate media retry above is the normal path.
     */
    const fallback =
      candidates[0];

    if (fallback) {
      const fallbackId =
        await sendWhatsAppTextToCustomer(
          to,
          [
            "✨ TODAY'S STYLE HIGHLIGHT",
            "",
            `*${fallback.name || "NEW CITY STYLE Pick"}*`,
            safeNumber(
              fallback.price,
            ) > 0
              ? `💰 ${money(
                  safeNumber(
                    fallback.price,
                  ),
                )}`
              : "",
            "",
            `🔗 ${productUrl(
              fallback,
            )}`,
          ]
            .filter(Boolean)
            .join("\n"),
        ).catch(
          () => null,
        );

      return {
        messageId:
          fallbackId,
        productId:
          Number(
            fallback.id,
          ) || null,
      };
    }

    return {
      messageId: null,
      productId: null,
    };
  } catch (error) {
    console.warn(
      "NCS WELCOME HERO FAILED; GREETING FLOW PRESERVED:",
      error instanceof Error
        ? error.message
        : String(error),
    );

    return {
      messageId: null,
      productId: null,
    };
  }
}

async function sendNcsAudienceCategoryMenuSafe(
  to: string,
  audience: NcsGuidedAudience,
): Promise<string[]> {
  const configs: Record<
    NcsGuidedAudience,
    {
      heading: string;
      rows: NcsMenuRow[];
    }
  > = {
    men: {
      heading:
        "👔 MEN'S COLLECTION\nమీకు కావాల్సిన category ఎంచుకోండి 👇",
      rows: [
        {
          id: "NCS_MENU_MEN_SHIRTS",
          title: "Shirts",
          description: "Casual & formal shirts",
        },
        {
          id: "NCS_MENU_MEN_TSHIRTS",
          title: "T-Shirts",
          description: "T-shirts & tees",
        },
        {
          id: "NCS_MENU_MEN_JEANS",
          title: "Jeans",
          description: "Jeans & denim",
        },
        {
          id: "NCS_MENU_MEN_PANTS",
          title: "Pants",
          description: "Pants & trousers",
        },
        {
          id: "NCS_MENU_MEN_INNER",
          title: "Innerwear",
          description: "Vests, briefs & innerwear",
        },
        {
          id: "NCS_MENU_MEN_SPORTS",
          title: "Sportswear",
          description: "Active & sports wear",
        },
        {
          id: "NCS_MENU_MEN_OFFERS",
          title: "Offers",
          description: "Current discounted picks",
        },
      ],
    },
    women: {
      heading:
        "👗 WOMEN'S COLLECTION\nమీకు కావాల్సిన category ఎంచుకోండి 👇",
      rows: [
        {
          id: "NCS_MENU_WOMEN_SAREES",
          title: "Sarees",
          description: "Sarees & sari styles",
        },
        {
          id: "NCS_MENU_WOMEN_KURTIS",
          title: "Kurtis",
          description: "Kurtis & kurtas",
        },
        {
          id: "NCS_MENU_WOMEN_TOPS",
          title: "Tops",
          description: "Tops & casual wear",
        },
        {
          id: "NCS_MENU_WOMEN_DRESSES",
          title: "Dresses",
          description: "Dresses & frocks",
        },
        {
          id: "NCS_MENU_WOMEN_NIGHTIES",
          title: "Nighties",
          description: "Nightwear",
        },
        {
          id: "NCS_MENU_WOMEN_LEGGINGS",
          title: "Leggings",
          description: "Leggings & bottom wear",
        },
        {
          id: "NCS_MENU_WOMEN_OFFERS",
          title: "Offers",
          description: "Current discounted picks",
        },
      ],
    },
    kids: {
      heading:
        "🧒 KIDS COLLECTION\nమీకు కావాల్సిన category ఎంచుకోండి 👇",
      rows: [
        {
          id: "NCS_MENU_KIDS_BOYS",
          title: "Boys",
          description: "Boys collection",
        },
        {
          id: "NCS_MENU_KIDS_GIRLS",
          title: "Girls",
          description: "Girls collection",
        },
        {
          id: "NCS_MENU_KIDS_FROCKS",
          title: "Frocks",
          description: "Girls frocks & dresses",
        },
        {
          id: "NCS_MENU_KIDS_TSHIRTS",
          title: "T-Shirts",
          description: "Kids t-shirts",
        },
        {
          id: "NCS_MENU_KIDS_SHORTS",
          title: "Shorts",
          description: "Kids shorts",
        },
        {
          id: "NCS_MENU_KIDS_WEAR",
          title: "Kids Wear",
          description: "All kids live-stock picks",
        },
        {
          id: "NCS_MENU_KIDS_OFFERS",
          title: "Offers",
          description: "Current discounted picks",
        },
      ],
    },
  };

  const config = configs[audience];

  const messageIds: string[] = [];

  const menuId =
    await sendWhatsAppMenuList(
      to,
      config.heading,
      "CHOOSE CATEGORY",
      "Live Categories",
      config.rows,
    ).catch(async (error) => {
      console.warn(
        "NCS GUIDED CATEGORY MENU FAILED; USING TEXT FALLBACK:",
        error instanceof Error
          ? error.message
          : String(error),
      );

      return sendWhatsAppTextToCustomer(
        to,
        [
          config.heading,
          "",
          config.rows
            .map(
              (row, index) =>
                `${index + 1}. ${row.title}`,
            )
            .join("\n"),
          "",
          "Category పేరు type చేసి పంపండి.",
        ].join("\n"),
      );
    });

  if (menuId) {
    messageIds.push(menuId);
  }

  return messageIds;
}

async function sendWhatsAppChoiceList(
  to: string,
  bodyText: string,
  buttonText: string,
  rowPrefix: "NCS_SIZE" | "NCS_COLOR",
  values: string[],
): Promise<string | null> {
  const accessToken =
    process.env
      .WHATSAPP_ACCESS_TOKEN
      ?.trim();

  const phoneNumberId =
    process.env
      .WHATSAPP_PHONE_NUMBER_ID
      ?.trim();

  const apiVersion =
    process.env
      .WHATSAPP_API_VERSION
      ?.trim() ||
    "v25.0";

  if (
    !accessToken ||
    !phoneNumberId
  ) {
    throw new Error(
      "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID.",
    );
  }

  const cleanValues =
    Array.from(
      new Set(
        values
          .map(
            (value) =>
              value.trim(),
          )
          .filter(Boolean),
      ),
    ).slice(0, 10);

  if (cleanValues.length === 0) {
    return null;
  }

  const rows =
    cleanValues.map(
      (value, index) => ({
        id:
          `${rowPrefix}_${index + 1}`,
        title:
          value.slice(
            0,
            24,
          ),
      }),
    );

  const response =
    await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          messaging_product:
            "whatsapp",
          recipient_type:
            "individual",
          to,
          type: "interactive",
          interactive: {
            type: "list",
            body: {
              text:
                bodyText.slice(
                  0,
                  1024,
                ),
            },
            footer: {
              text:
                "NEW CITY STYLE",
            },
            action: {
              button:
                buttonText.slice(
                  0,
                  20,
                ),
              sections: [
                {
                  title:
                    rowPrefix ===
                    "NCS_SIZE"
                      ? "Available Sizes"
                      : "Available Colours",
                  rows,
                },
              ],
            },
          },
        }),
        cache: "no-store",
      },
    );

  const data =
    (await response.json()) as
      MetaMessageResponse;

  if (
    !response.ok ||
    !Array.isArray(
      data.messages,
    ) ||
    data.messages.length === 0
  ) {
    throw new Error(
      data.error?.message ||
        data.error
          ?.error_data
          ?.details ||
        `WhatsApp interactive list send failed with HTTP ${response.status}.`,
    );
  }

  return (
    data.messages[0]?.id ||
    null
  );
}



async function ncsAllSettledSequential<T>(
  tasks: Array<() => Promise<T>>,
): Promise<Array<PromiseSettledResult<T>>> {
  const results: Array<PromiseSettledResult<T>> = [];

  for (const task of tasks) {
    try {
      const value = await task();
      results.push({
        status: "fulfilled",
        value,
      });
    } catch (reason) {
      results.push({
        status: "rejected",
        reason,
      });
    }
  }

  return results;
}

async function sendProductSelectionButtonsSafe(
  to: string,
  productIds: number[],
): Promise<string | null> {
  try {
    const buttons = productIds
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0)
      .slice(0, 3)
      .map((productId, index) => ({
        // Bind the visible option directly to the exact product that was sent.
        // This prevents stale conversation state from making OPTION 1 select
        // an older product from a previous search.
        id: `NCS_PRODUCT_${productId}`,
        title: `OPTION ${index + 1}`,
      }));

    return await sendWhatsAppQuickReplyButtons(
      to,
      "Choose the product you want to continue with:",
      buttons,
    );
  } catch (error) {
    console.warn(
      "NCS PRODUCT SELECTION BUTTONS FAILED; TEXT FLOW PRESERVED:",
      error instanceof Error
        ? error.message
        : String(error),
    );
    return null;
  }
}

function buildProductSelectionSummaryText(
  results: UnifiedInventoryResult[],
): string {
  const lines: string[] = [
    "Matching products:",
  ];

  results
    .slice(0, 3)
    .forEach(
      (
        result,
        index,
      ) => {
        const priceText =
          formatInventoryPrice(
            result.sellingPriceMin,
            result.sellingPriceMax,
          );

        lines.push("");
        lines.push(
          `OPTION ${index + 1}`,
        );
        lines.push(
          `*${result.product.name?.trim() || "Product"}*`,
        );

        if (
          result.product.brand?.trim()
        ) {
          lines.push(
            result.product.brand.trim(),
          );
        }

        if (priceText) {
          lines.push(
            `Price: ${priceText}`,
          );
        }

        if (
          result.availableSizes
            .length > 0
        ) {
          lines.push(
            `Sizes: ${result.availableSizes
              .slice(0, 6)
              .join(", ")}`,
          );
        }

        if (
          result.availableColors
            .length > 0
        ) {
          lines.push(
            `Colours: ${result.availableColors
              .slice(0, 4)
              .join(", ")}`,
          );
        }

        lines.push(
          result.isOnline
            ? `View: ${productUrl(
                result.product,
              )}`
            : "Available in store at NEW CITY STYLE READY MADE",
        );
      },
    );

  lines.push("");
  lines.push(
    "Choose OPTION 1 / OPTION 2 / OPTION 3 below.",
  );

  return lines.join(
    "\n",
  );
}

async function sendProductSelectionSummarySafe(
  to: string,
  results: UnifiedInventoryResult[],
): Promise<string | null> {
  try {
    return await sendWhatsAppTextToCustomer(
      to,
      buildProductSelectionSummaryText(
        results,
      ),
    );
  } catch (error) {
    console.warn(
      "NCS PRODUCT SELECTION SUMMARY FAILED; BUTTON FLOW PRESERVED:",
      error instanceof Error
        ? error.message
        : String(error),
    );
    return null;
  }
}

async function sendSalesActionButtonsSafe(
  to: string,
): Promise<string | null> {
  try {
    return await sendWhatsAppQuickReplyButtons(
      to,
      "Selected product actions:",
      [
        {
          id:
            "NCS_BOOK_CURRENT",
          title:
            "BOOK ITEM",
        },
        {
          id:
            "NCS_BOOKING_STATUS",
          title:
            "BOOKING STATUS",
        },
        {
          id:
            "NCS_CANCEL_BOOKING",
          title:
            "CANCEL BOOKING",
        },
      ],
    );
  } catch (error) {
    console.warn(
      "NCS SALES ACTION BUTTONS FAILED; TEXT FLOW PRESERVED:",
      error instanceof Error
        ? error.message
        : String(error),
    );
    return null;
  }
}

async function sendReservationChoiceControlsSafe(
  to: string,
  choice: ReservationChoice,
): Promise<string | null> {
  try {
    if (
      choice.ambiguousSizes.length > 1
    ) {
      return await sendWhatsAppChoiceList(
        to,
        "Choose the exact size you want to reserve:",
        "CHOOSE SIZE",
        "NCS_SIZE",
        choice.ambiguousSizes,
      );
    }

    if (
      choice.ambiguousColors.length > 1
    ) {
      return await sendWhatsAppChoiceList(
        to,
        "Choose the exact colour you want to reserve:",
        "CHOOSE COLOUR",
        "NCS_COLOR",
        choice.ambiguousColors,
      );
    }

    return await sendSalesActionButtonsSafe(
      to,
    );
  } catch (error) {
    console.warn(
      "NCS RESERVATION CHOICE CONTROLS FAILED; TEXT FLOW PRESERVED:",
      error instanceof Error
        ? error.message
        : String(error),
    );
    return null;
  }
}


async function sendUnifiedInventoryResult(
  to: string,
  result: UnifiedInventoryResult,
  caption: string,
): Promise<string | null> {
  const replyProduct =
    unifiedReplyProduct(
      result,
    );

  /*
   * STAGE 15.4 HARD RELIABILITY RULE
   *
   * Try the full product image flow first.
   * If image delivery still fails for any reason, ALWAYS send the full
   * product details as plain WhatsApp text so customers never see only
   * OPTION 1 / OPTION 2 / OPTION 3 with no useful context.
   */
  try {
    const imageMessageId =
      await sendProductImage({
        to,
        product:
          replyProduct,
        caption,
      });

    if (imageMessageId) {
      return imageMessageId;
    }
  } catch (error) {
    console.warn(
      "NCS INVENTORY IMAGE SEND FAILED; USING GUARANTEED TEXT FALLBACK:",
      JSON.stringify(
        {
          productId:
            replyProduct.id,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        null,
        2,
      ),
    );
  }

  return await sendWhatsAppTextToCustomer(
    to,
    caption,
  );
}

function buildInventoryNoMatchText(
  messageText: string,
): string {
  const clean =
    messageText
      .replace(
        /[\r\n\t]+/g,
        " ",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim()
      .slice(
        0,
        80,
      );

  return [
    "✨ NEW CITY STYLE",
    "",
    clean
      ? `I couldn't find an in-stock match for “${clean}” in the live store inventory right now.`
      : "I couldn't find that item in the live store inventory right now.",
    "",
    "Here are some currently available picks:",
  ].join(
    "\n",
  );
}



function buildProductCaption(

  product: ProductRow,

  index: number,

  total: number,

  customerName?: string,

): string {

  const sellingPrice =

    safeNumber(

      product.price,

    );



  const mrp =

    safeNumber(

      product.online_mrp,

    ) ||

    safeNumber(

      product.mrp,

    ) ||

    sellingPrice;



  const discountPercent =

    mrp > sellingPrice &&

    mrp > 0

      ? Math.max(

          0,

          Math.round(

            (

              (

                mrp -

                sellingPrice

              ) /

              mrp

            ) *

              100,

          ),

        )

      : 0;



  const lines = [

    index === 0

      ? `✨ NEW CITY STYLE${

          customerName

            ? ` • ${customerName}`

            : ""

        }`

      : "✨ NEW CITY STYLE",

    "",

    `*${product.name?.trim() || "New Arrival"}*`,

  ];



  if (

    product.brand?.trim()

  ) {

    lines.push(

      product.brand.trim(),

    );

  }



  if (

    sellingPrice > 0

  ) {

    lines.push(

      discountPercent > 0

        ? `${money(

            sellingPrice,

          )}  •  MRP ${money(

            mrp,

          )}  •  ${discountPercent}% OFF`

        : money(

            sellingPrice,

          ),

    );

  }



  lines.push("");

  lines.push(

    `🛍️ View Product: ${productUrl(

      product,

    )}`,

  );



  if (

    index ===

    total - 1

  ) {

    lines.push("");

    lines.push(

      "Reply anytime for more NEW CITY STYLE picks.",

    );

  }



  return lines.join("\n");

}



function autoReplyCooldownMinutes(): number {

  const raw =

    Number(

      process.env

        .NCS_WHATSAPP_PRODUCT_COOLDOWN_MINUTES ||

        DEFAULT_COOLDOWN_MINUTES,

    );



  if (

    !Number.isFinite(raw)

  ) {

    return DEFAULT_COOLDOWN_MINUTES;

  }



  return Math.min(

    1440,

    Math.max(

      5,

      Math.trunc(raw),

    ),

  );

}



async function claimAutoReply(

  admin: any,

  phone: string,

  messageId: string,

  messageText: string,

  cooldownMinutes: number,

): Promise<AutoReplyClaim> {

  const {

    data,

    error,

  } =

    await admin.rpc(

      "ncs_claim_whatsapp_product_autoreply_v1",

      {

        p_phone: phone,

        p_message_id:

          messageId,

        p_message_text:

          messageText ||

          null,

        p_cooldown_minutes:

          cooldownMinutes,

      },

    );



  if (error) {

    throw new Error(

      `WhatsApp product auto-reply claim failed: ${error.message}`,

    );

  }



  if (

    data &&

    typeof data ===

      "object" &&

    !Array.isArray(data)

  ) {

    return data as

      AutoReplyClaim;

  }



  return {

    claimed: false,

    reason:

      "invalid_claim_response",

  };

}



async function completeAutoReply(

  admin: any,

  {

    phone,

    messageId,

    productIds,

    status,

    errorMessage,

  }: {

    phone: string;

    messageId: string;

    productIds: number[];

    status:

      | "sent"

      | "failed";

    errorMessage?: string;

  },

) {

  const payload =

    status === "sent"

      ? {

          last_product_ids:

            productIds,

          last_reply_status:

            "sent",

          last_reply_error:

            null,

          updated_at:

            new Date()

              .toISOString(),

        }

      : {

          last_reply_at:

            null,

          last_reply_status:

            "failed",

          last_reply_error:

            (

              errorMessage ||

              "Unknown send failure"

            ).slice(

              0,

              1000,

            ),

          updated_at:

            new Date()

              .toISOString(),

        };



  const {

    error,

  } =

    await admin

      .from(

        "whatsapp_product_auto_reply_sessions",

      )

      .update(

        payload,

      )

      .eq(

        "phone",

        phone,

      )

      .eq(

        "last_incoming_message_id",

        messageId,

      );



  if (error) {

    console.error(

      "Unable to finalize WhatsApp product auto-reply session:",

      error.message,

    );

  }

}



async function loadProductPool(

  admin: any,

): Promise<ProductRow[]> {

  const {

    data,

    error,

  } =

    await admin

      .from("products")

      .select(

        [

          "id",

          "name",

          "slug",

          "brand",

          "category",

          "subcategory",

          "gender",

          "age_group",

          "sizes",

          "tags",

          "material",

          "fabric",

          "pattern",

          "occasion",

          "price",

          "mrp",

          "online_mrp",

          "stock",

          "image",

          "image_url",

          "social_preview_url",

          "images",

          "gallery_images",

          "is_featured",

          "is_new_arrival",

          "is_bestseller",

          "is_trending",

          "updated_at",

        ].join(","),

      )

      .eq(

        "is_active",

        true,

      )

      .eq(

        "status",

        "active",

      )

      .eq(

        "sell_online",

        true,

      )

      .gt(

        "stock",

        0,

      )

      .order(

        "is_featured",

        {

          ascending:

            false,

        },

      )

      .order(

        "is_new_arrival",

        {

          ascending:

            false,

        },

      )

      .order(

        "is_bestseller",

        {

          ascending:

            false,

        },

      )

      .order(

        "is_trending",

        {

          ascending:

            false,

        },

      )

      .order(

        "updated_at",

        {

          ascending:

            false,

          nullsFirst:

            false,

        },

      )

      .limit(

        PRODUCT_POOL_SIZE,

      );



  if (error) {

    throw new Error(

      `Unable to load online products: ${error.message}`,

    );

  }



  return (

    data || []

  ) as ProductRow[];

}



async function sendProductText(
  {
    to,
    text,
    accessToken,
    phoneNumberId,
    apiVersion,
  }: {
    to: string;
    text: string;
    accessToken: string;
    phoneNumberId: string;
    apiVersion: string;
  },
): Promise<string | null> {
  const response =
    await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          {
            messaging_product:
              "whatsapp",
            recipient_type:
              "individual",
            to,
            type:
              "text",
            text: {
              preview_url: true,
              body: text,
            },
          },
        ),
        cache:
          "no-store",
      },
    );

  const data =
    (await response.json()) as
      MetaMessageResponse;

  if (
    !response.ok ||
    !Array.isArray(
      data.messages,
    ) ||
    data.messages.length ===
      0
  ) {
    throw new Error(
      data.error?.message ||
        data.error
          ?.error_data
          ?.details ||
        `WhatsApp text send failed with HTTP ${response.status}.`,
    );
  }

  return (
    data.messages[0]?.id ||
    null
  );
}


async function downloadProductImageAsJpeg(
  product: ProductRow,
): Promise<Buffer | null> {
  /*
   * Runtime-safe sharp loading:
   * Never load the native sharp module at route/module startup.
   * If Vercel cannot load sharp for any reason, the webhook itself
   * must stay alive and the caller will fall back to a text reply.
   */
  let sharpRuntime:
    typeof import("sharp").default;

  try {
    const sharpModule =
      await import("sharp");

    sharpRuntime =
      sharpModule.default;
  } catch (error) {
    console.warn(
      "WHATSAPP SHARP RUNTIME LOAD FAILED; USING TEXT FALLBACK:",
      error instanceof Error
        ? error.message
        : String(error),
    );

    return null;
  }

  const candidates =
    productImageCandidates(
      product,
    );

  for (const source of candidates) {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        12_000,
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
                "NEW-CITY-STYLE-WhatsApp-Media/2.0",
            },
            cache: "no-store",
            signal:
              controller.signal,
          },
        );

      if (!response.ok) {
        continue;
      }

      const sourceBytes =
        Buffer.from(
          await response.arrayBuffer(),
        );

      if (
        sourceBytes.length === 0 ||
        sourceBytes.length >
          12 * 1024 * 1024
      ) {
        continue;
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
            background: "#ffffff",
          })
          .jpeg({
            quality: 88,
            mozjpeg: true,
          })
          .toBuffer();

      /*
       * WhatsApp Cloud API image uploads are limited to 5 MB.
       * Keep a healthy margin so multipart overhead never matters.
       */
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
              width: 1000,
              height: 1250,
              fit: "inside",
              withoutEnlargement:
                true,
            })
            .flatten({
              background: "#ffffff",
            })
            .jpeg({
              quality: 76,
              mozjpeg: true,
            })
            .toBuffer();
      }

      if (
        jpeg.length > 0 &&
        jpeg.length <=
          4.5 * 1024 * 1024
      ) {
        return jpeg;
      }
    } catch (error) {
      console.warn(
        "WHATSAPP PRODUCT IMAGE CONVERT CANDIDATE FAILED:",
        JSON.stringify(
          {
            productId:
              product.id,
            source,
            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
          null,
          2,
        ),
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}


async function uploadWhatsAppProductImage(
  {
    product,
    accessToken,
    phoneNumberId,
    apiVersion,
  }: {
    product: ProductRow;
    accessToken: string;
    phoneNumberId: string;
    apiVersion: string;
  },
): Promise<string | null> {
  const jpeg =
    await downloadProductImageAsJpeg(
      product,
    );

  if (!jpeg) {
    return null;
  }

  const form =
    new FormData();

  form.append(
    "messaging_product",
    "whatsapp",
  );

  form.append(
    "type",
    "image/jpeg",
  );

  // Node Buffer uses ArrayBufferLike, while the DOM Blob constructor
  // expects an ArrayBuffer-backed BlobPart under strict TypeScript libs.
  // Copy the JPEG bytes into a plain ArrayBuffer so Next.js/TypeScript
  // accepts the multipart media payload without changing the bytes.
  const jpegArrayBuffer =
    new ArrayBuffer(jpeg.byteLength);

  new Uint8Array(
    jpegArrayBuffer,
  ).set(jpeg);

  form.append(
    "file",
    new Blob(
      [jpegArrayBuffer],
      {
        type: "image/jpeg",
      },
    ),
    `ncs-product-${product.id}.jpg`,
  );

  const response =
    await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
        body: form,
        cache: "no-store",
      },
    );

  const data =
    (await response.json()) as {
      id?: string;
      error?: {
        message?: string;
        code?: number;
        error_data?: {
          details?: string;
        };
      };
    };

  if (
    !response.ok ||
    !data.id
  ) {
    console.warn(
      "WHATSAPP PRODUCT MEDIA UPLOAD FAILED:",
      JSON.stringify(
        {
          productId:
            product.id,
          status:
            response.status,
          errorCode:
            data.error?.code ||
            null,
          errorMessage:
            data.error?.message ||
            null,
          errorDetails:
            data.error
              ?.error_data
              ?.details ||
            null,
        },
        null,
        2,
      ),
    );

    return null;
  }

  console.log(
    "WHATSAPP PRODUCT MEDIA UPLOAD OK:",
    JSON.stringify(
      {
        productId:
          product.id,
        mediaId:
          data.id,
        bytes:
          jpeg.length,
      },
      null,
      2,
    ),
  );

  return data.id;
}


function isDirectWhatsAppImageUrl(
  value: string,
): boolean {
  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "https:") {
      return false;
    }

    const path =
      parsed.pathname.toLowerCase();

    return (
      path.endsWith(".jpg") ||
      path.endsWith(".jpeg") ||
      path.endsWith(".png")
    );
  } catch {
    return false;
  }
}


async function sendProductImageByLink(
  {
    to,
    imageUrl,
    caption,
    accessToken,
    phoneNumberId,
    apiVersion,
  }: {
    to: string;
    imageUrl: string;
    caption: string;
    accessToken: string;
    phoneNumberId: string;
    apiVersion: string;
  },
): Promise<string | null> {
  const response =
    await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          {
            messaging_product:
              "whatsapp",
            recipient_type:
              "individual",
            to,
            type:
              "image",
            image: {
              link:
                imageUrl,
              caption,
            },
          },
        ),
        cache:
          "no-store",
      },
    );

  const data =
    (await response.json()) as
      MetaMessageResponse;

  if (
    !response.ok ||
    !Array.isArray(
      data.messages,
    ) ||
    data.messages.length === 0
  ) {
    console.warn(
      "WHATSAPP DIRECT JPEG/PNG IMAGE SEND FAILED:",
      JSON.stringify(
        {
          status:
            response.status,
          imageUrl,
          errorCode:
            data.error?.code ||
            null,
          errorMessage:
            data.error?.message ||
            null,
          errorDetails:
            data.error
              ?.error_data
              ?.details ||
            null,
        },
        null,
        2,
      ),
    );

    return null;
  }

  console.log(
    "WHATSAPP DIRECT JPEG/PNG IMAGE SEND OK:",
    JSON.stringify(
      {
        imageUrl,
        messageId:
          data.messages[0]?.id ||
          null,
      },
      null,
      2,
    ),
  );

  return (
    data.messages[0]?.id ||
    null
  );
}



async function uploadWhatsAppImageFromPublicJpegUrl(
  {
    imageUrl,
    productId,
    accessToken,
    phoneNumberId,
    apiVersion,
  }: {
    imageUrl: string;
    productId: number;
    accessToken: string;
    phoneNumberId: string;
    apiVersion: string;
  },
): Promise<string | null> {
  /*
   * STAGE 15.7 • SERVER-FETCH -> META MEDIA UPLOAD
   *
   * Do NOT ask Meta to fetch our proxy URL directly.
   * Our own Vercel server first fetches the guaranteed JPEG route,
   * then uploads those JPEG bytes to Meta /media.
   *
   * This path is used by BOTH:
   *   - greeting hero image
   *   - normal product result images (3 product replies)
   */
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      20_000,
    );

  try {
    const imageResponse =
      await fetch(
        imageUrl,
        {
          method: "GET",
          redirect: "follow",
          cache: "no-store",
          headers: {
            Accept:
              "image/jpeg,image/*;q=0.9,*/*;q=0.1",
            "User-Agent":
              "NEW-CITY-STYLE-WhatsApp-Server-Media/15.7",
          },
          signal:
            controller.signal,
        },
      );

    if (!imageResponse.ok) {
      console.warn(
        "NCS SERVER JPEG FETCH FAILED:",
        JSON.stringify(
          {
            productId,
            status:
              imageResponse.status,
            imageUrl,
          },
          null,
          2,
        ),
      );

      return null;
    }

    const contentType =
      imageResponse.headers
        .get("content-type")
        ?.toLowerCase() ||
      "";

    const bytes =
      new Uint8Array(
        await imageResponse.arrayBuffer(),
      );

    if (
      bytes.byteLength === 0 ||
      bytes.byteLength >
        5 * 1024 * 1024
    ) {
      console.warn(
        "NCS SERVER JPEG INVALID SIZE:",
        JSON.stringify(
          {
            productId,
            bytes:
              bytes.byteLength,
          },
          null,
          2,
        ),
      );

      return null;
    }

    if (
      !contentType.includes(
        "image/jpeg",
      ) &&
      !contentType.includes(
        "image/jpg",
      )
    ) {
      console.warn(
        "NCS SERVER JPEG INVALID CONTENT TYPE:",
        JSON.stringify(
          {
            productId,
            contentType,
          },
          null,
          2,
        ),
      );

      return null;
    }

    const bodyBuffer =
      new ArrayBuffer(
        bytes.byteLength,
      );

    new Uint8Array(
      bodyBuffer,
    ).set(bytes);

    const form =
      new FormData();

    form.append(
      "messaging_product",
      "whatsapp",
    );

    form.append(
      "type",
      "image/jpeg",
    );

    form.append(
      "file",
      new Blob(
        [bodyBuffer],
        {
          type:
            "image/jpeg",
        },
      ),
      `ncs-product-${productId}.jpg`,
    );

    const uploadResponse =
      await fetch(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
          body: form,
          cache: "no-store",
        },
      );

    const uploadData =
      (await uploadResponse.json()) as {
        id?: string;
        error?: {
          message?: string;
          code?: number;
          error_data?: {
            details?: string;
          };
        };
      };

    if (
      !uploadResponse.ok ||
      !uploadData.id
    ) {
      console.warn(
        "NCS SERVER JPEG META UPLOAD FAILED:",
        JSON.stringify(
          {
            productId,
            status:
              uploadResponse.status,
            errorCode:
              uploadData.error?.code ||
              null,
            errorMessage:
              uploadData.error
                ?.message ||
              null,
            errorDetails:
              uploadData.error
                ?.error_data
                ?.details ||
              null,
          },
          null,
          2,
        ),
      );

      return null;
    }

    console.log(
      "NCS SERVER JPEG META UPLOAD OK:",
      JSON.stringify(
        {
          productId,
          mediaId:
            uploadData.id,
          bytes:
            bytes.byteLength,
        },
        null,
        2,
      ),
    );

    return uploadData.id;
  } catch (error) {
    console.warn(
      "NCS SERVER JPEG PIPELINE FAILED:",
      JSON.stringify(
        {
          productId,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        null,
        2,
      ),
    );

    return null;
  } finally {
    clearTimeout(timeout);
  }
}


async function sendWhatsAppImageByMediaId(
  {
    to,
    mediaId,
    caption,
    accessToken,
    phoneNumberId,
    apiVersion,
  }: {
    to: string;
    mediaId: string;
    caption: string;
    accessToken: string;
    phoneNumberId: string;
    apiVersion: string;
  },
): Promise<string | null> {
  const response =
    await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          {
            messaging_product:
              "whatsapp",
            recipient_type:
              "individual",
            to,
            type:
              "image",
            image: {
              id: mediaId,
              caption,
            },
          },
        ),
        cache: "no-store",
      },
    );

  const data =
    (await response.json()) as
      MetaMessageResponse;

  if (
    !response.ok ||
    !Array.isArray(
      data.messages,
    ) ||
    data.messages.length ===
      0
  ) {
    console.warn(
      "NCS MEDIA-ID IMAGE MESSAGE FAILED:",
      JSON.stringify(
        {
          status:
            response.status,
          errorCode:
            data.error?.code ||
            null,
          errorMessage:
            data.error?.message ||
            null,
          errorDetails:
            data.error
              ?.error_data
              ?.details ||
            null,
        },
        null,
        2,
      ),
    );

    return null;
  }

  return (
    data.messages[0]?.id ||
    null
  );
}


async function sendProductImage(
  {
    to,
    product,
    caption,
  }: {
    to: string;
    product: ProductRow;
    caption: string;
  },
): Promise<string | null> {
  const accessToken =
    process.env
      .WHATSAPP_ACCESS_TOKEN
      ?.trim();

  const phoneNumberId =
    process.env
      .WHATSAPP_PHONE_NUMBER_ID
      ?.trim();

  const apiVersion =
    process.env
      .WHATSAPP_API_VERSION
      ?.trim() ||
    "v25.0";

  if (
    !accessToken ||
    !phoneNumberId
  ) {
    throw new Error(
      "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID.",
    );
  }

  /*
   * STAGE 15.7 • PRIMARY IMAGE PATH
   *
   * Product source -> NCS JPEG proxy -> our server fetches JPEG
   * -> Meta /media upload -> WhatsApp image message.
   *
   * This avoids Meta needing to download our URL itself and restores the
   * old customer experience: greeting + one image, product search + up to
   * three image/detail replies.
   */
  const proxyImageUrl =
    productImageProxyUrl(
      product,
    );

  if (proxyImageUrl) {
    try {
      const mediaId =
        await uploadWhatsAppImageFromPublicJpegUrl(
          {
            imageUrl:
              proxyImageUrl,
            productId:
              Number(
                product.id,
              ),
            accessToken,
            phoneNumberId,
            apiVersion,
          },
        );

      if (mediaId) {
        const proxyMessageId =
          await sendWhatsAppImageByMediaId(
            {
              to,
              mediaId,
              caption,
              accessToken,
              phoneNumberId,
              apiVersion,
            },
          );

        if (proxyMessageId) {
          return proxyMessageId;
        }
      }
    } catch (error) {
      console.warn(
        "NCS PRIMARY SERVER JPEG PATH FAILED; TRYING FALLBACK MEDIA PATHS:",
        JSON.stringify(
          {
            productId:
              product.id,
            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
          null,
          2,
        ),
      );
    }
  }


  /*
   * Stage 2036.3 preferred path:
   * Send a permanent JPEG/PNG preview URL directly to WhatsApp.
   * This avoids Vercel native image conversion completely whenever
   * products.social_preview_url contains a JPEG/PNG preview.
   */
  const directImageUrl =
    productImageCandidates(
      product,
    ).find(
      isDirectWhatsAppImageUrl,
    ) || null;

  if (directImageUrl) {
    try {
      const directMessageId =
        await sendProductImageByLink(
          {
            to,
            imageUrl:
              directImageUrl,
            caption,
            accessToken,
            phoneNumberId,
            apiVersion,
          },
        );

      if (directMessageId) {
        return directMessageId;
      }
    } catch (error) {
      console.warn(
        "WHATSAPP DIRECT JPEG/PNG IMAGE PATH FAILED; TRYING MEDIA UPLOAD:",
        JSON.stringify(
          {
            productId:
              product.id,
            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
          null,
          2,
        ),
      );
    }
  }

  /*
   * Stage 2036.2 reliability rule:
   * Never ask Meta to fetch our WebP URL directly.
   *
   * 1. Download the catalogue image on the server.
   * 2. Convert it to JPEG with sharp.
   * 3. Upload the JPEG bytes to Meta's /media endpoint.
   * 4. Send the image using the returned Meta media ID.
   *
   * Meta officially accepts JPEG/PNG image uploads. This also avoids
   * redirects, public proxy fetch failures and the earlier 131053 WebP
   * media-upload error.
   */
  let mediaId:
    string | null = null;

  try {
    mediaId =
      await uploadWhatsAppProductImage(
        {
          product,
          accessToken,
          phoneNumberId,
          apiVersion,
        },
      );
  } catch (error) {
    console.warn(
      "WHATSAPP PRODUCT MEDIA PREP FAILED; USING TEXT FALLBACK:",
      JSON.stringify(
        {
          productId:
            product.id,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        null,
        2,
      ),
    );
  }

  if (!mediaId) {
    return sendProductText(
      {
        to,
        text: caption,
        accessToken,
        phoneNumberId,
        apiVersion,
      },
    );
  }

  const response =
    await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          {
            messaging_product:
              "whatsapp",
            recipient_type:
              "individual",
            to,
            type: "image",
            image: {
              id: mediaId,
              caption,
            },
          },
        ),
        cache: "no-store",
      },
    );

  const data =
    (await response.json()) as
      MetaMessageResponse;

  if (
    !response.ok ||
    !Array.isArray(
      data.messages,
    ) ||
    data.messages.length ===
      0
  ) {
    console.warn(
      "WHATSAPP PRODUCT IMAGE MESSAGE FAILED; USING TEXT FALLBACK:",
      JSON.stringify(
        {
          productId:
            product.id,
          status:
            response.status,
          errorCode:
            data.error?.code ||
            null,
          errorMessage:
            data.error?.message ||
            null,
          errorDetails:
            data.error
              ?.error_data
              ?.details ||
            null,
        },
        null,
        2,
      ),
    );

    return sendProductText(
      {
        to,
        text: caption,
        accessToken,
        phoneNumberId,
        apiVersion,
      },
    );
  }

  return (
    data.messages[0]?.id ||
    null
  );
}


/* ============================================================
   STAGE 14.2 • PAYMENT CONFIRM + BOT LOOP GUARD + MEDIA FIRST CONTACT
============================================================ */

function ncsPaymentPaidAction(
  message: WhatsAppIncomingMessage,
): {
  matched: boolean;
  reference: string;
} {
  const rawId =
    message.interactive
      ?.button_reply
      ?.id
      ?.trim() || "";

  const prefix =
    "PAYMENT_PAID::";

  if (
    !rawId ||
    !rawId
      .toUpperCase()
      .startsWith(prefix)
  ) {
    return {
      matched: false,
      reference: "",
    };
  }

  return {
    matched: true,
    reference:
      rawId
        .slice(prefix.length)
        .trim()
        .slice(0, 120),
  };
}


async function ncsHandlePaymentPaidSafe(
  admin: any,
  phone: string,
  reference: string,
): Promise<Record<string, unknown>> {
  try {
    let payment: any = null;

    if (reference) {
      const exact =
        await admin
          .from(
            "ncs_whatsapp_payment_requests",
          )
          .select(
            "id,order_reference,amount,status,verification_status",
          )
          .eq(
            "phone",
            phone,
          )
          .eq(
            "order_reference",
            reference,
          )
          .in(
            "status",
            [
              "PENDING",
              "SENT",
            ],
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          )
          .limit(1)
          .maybeSingle();

      if (!exact.error) {
        payment =
          exact.data || null;
      }
    }

    if (!payment) {
      const latest =
        await admin
          .from(
            "ncs_whatsapp_payment_requests",
          )
          .select(
            "id,order_reference,amount,status,verification_status",
          )
          .eq(
            "phone",
            phone,
          )
          .in(
            "status",
            [
              "PENDING",
              "SENT",
            ],
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          )
          .limit(1)
          .maybeSingle();

      if (latest.error) {
        throw latest.error;
      }

      payment =
        latest.data || null;
    }

    if (payment?.id) {
      const now =
        new Date()
          .toISOString();

      const { error: updateError } =
        await admin
          .from(
            "ncs_whatsapp_payment_requests",
          )
          .update({
            verification_status:
              "SUBMITTED",
            proof_submitted_at:
              now,
            verification_note:
              "Customer tapped I HAVE PAID in WhatsApp. Manual bank/UPI verification required.",
          })
          .eq(
            "id",
            payment.id,
          );

      if (updateError) {
        throw updateError;
      }
    }

    const ack = [
      "✅ Payment confirmation received.",
      "",
      payment?.order_reference
        ? `Reference: ${payment.order_reference}`
        : reference
          ? `Reference: ${reference}`
          : "",
      "NEW CITY STYLE will verify the payment and update the status.",
      "",
      "Thank you 🙏",
    ]
      .filter(Boolean)
      .join("\n");

    const sentId =
      await sendWhatsAppTextToCustomer(
        phone,
        ack,
      );

    return {
      sent: true,
      mode:
        "stage14_2_payment_claimed",
      paymentRequestId:
        payment?.id || null,
      reference:
        payment?.order_reference ||
        reference ||
        null,
      messageIds:
        sentId ? [sentId] : [],
    };
  } catch (error) {
    console.warn(
      "NCS PAYMENT CLAIM HANDLE FAILED:",
      error instanceof Error
        ? error.message
        : String(error),
    );

    const fallbackId =
      await sendWhatsAppTextToCustomer(
        phone,
        [
          "✅ Payment confirmation received.",
          "",
          "NEW CITY STYLE will verify it shortly.",
          "Thank you 🙏",
        ].join("\n"),
      ).catch(() => null);

    return {
      sent:
        Boolean(fallbackId),
      mode:
        "stage14_2_payment_claim_fallback",
      error:
        error instanceof Error
          ? error.message
          : String(error),
      messageIds:
        fallbackId
          ? [fallbackId]
          : [],
    };
  }
}


async function ncsRapidInboundLoopRisk(
  admin: any,
  phone: string,
): Promise<boolean> {
  try {
    const since =
      new Date(
        Date.now() -
          60 * 1000,
      )
        .toISOString();

    const { count, error } =
      await admin
        .from(
          "ncs_whatsapp_lead_events",
        )
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        )
        .eq(
          "phone",
          phone,
        )
        .gte(
          "created_at",
          since,
        );

    if (error) {
      throw error;
    }

    /*
     * Six incoming events in one minute is far above a normal guided
     * shopping flow and is a strong sign of bot-to-bot ping-pong.
     * Stay SILENT once the threshold is reached; never answer the bot again.
     */
    return (
      Number(count || 0) >= 6
    );
  } catch (error) {
    console.warn(
      "NCS RAPID LOOP GUARD CHECK FAILED; NORMAL FLOW PRESERVED:",
      error instanceof Error
        ? error.message
        : String(error),
    );

    return false;
  }
}


async function sendWelcomeHeroImageStrict(
  to: string,
  product: ProductRow,
  caption: string,
): Promise<string | null> {
  const accessToken =
    process.env
      .WHATSAPP_ACCESS_TOKEN
      ?.trim();

  const phoneNumberId =
    process.env
      .WHATSAPP_PHONE_NUMBER_ID
      ?.trim();

  const apiVersion =
    process.env
      .WHATSAPP_API_VERSION
      ?.trim() ||
    "v25.0";

  if (
    !accessToken ||
    !phoneNumberId
  ) {
    return null;
  }

  const directImageUrl =
    productImageCandidates(
      product,
    ).find(
      isDirectWhatsAppImageUrl,
    ) || null;

  if (directImageUrl) {
    const directId =
      await sendProductImageByLink({
        to,
        imageUrl:
          directImageUrl,
        caption,
        accessToken,
        phoneNumberId,
        apiVersion,
      }).catch(
        () => null,
      );

    if (directId) {
      return directId;
    }
  }

  const proxyUrl =
    productImageProxyUrl(
      product,
    );

  if (proxyUrl) {
    const proxyId =
      await sendProductImageByLink({
        to,
        imageUrl:
          proxyUrl,
        caption,
        accessToken,
        phoneNumberId,
        apiVersion,
      }).catch(
        () => null,
      );

    if (proxyId) {
      return proxyId;
    }
  }

  const mediaId =
    await uploadWhatsAppProductImage({
      product,
      accessToken,
      phoneNumberId,
      apiVersion,
    }).catch(
      () => null,
    );

  if (!mediaId) {
    return null;
  }

  const response =
    await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          messaging_product:
            "whatsapp",
          recipient_type:
            "individual",
          to,
          type: "image",
          image: {
            id: mediaId,
            caption,
          },
        }),
        cache:
          "no-store",
      },
    );

  const data =
    (await response.json()) as
      MetaMessageResponse;

  if (
    !response.ok ||
    !Array.isArray(
      data.messages,
    ) ||
    data.messages.length === 0
  ) {
    return null;
  }

  return (
    data.messages[0]?.id ||
    null
  );
}



/* ============================================================
   STAGE 15.1 • AI SALES BRAIN CORE
   - Sales objection understanding
   - Decision-delay understanding
   - Confusion / frustration handoff
   - No fake discounts, no fake urgency, no automatic booking
============================================================ */

type NcsSalesBrainIntent =
  | "PRICE_OBJECTION"
  | "DECISION_DELAY"
  | "CONFUSED_OR_FRUSTRATED"
  | "NONE";

function ncsSalesBrainIntent(
  messageText: string,
): NcsSalesBrainIntent {
  const text =
    normalizeSearchText(
      messageText,
    );

  if (!text) {
    return "NONE";
  }

  const contains =
    (
      phrases: string[],
    ) =>
      phrases.some(
        (phrase) =>
          text.includes(
            normalizeSearchText(
              phrase,
            ),
          ),
      );

  if (
    contains([
      "wrong",
      "not this",
      "this is not",
      "idi kadu",
      "idi kaadu",
      "adi kadu",
      "ardham kale",
      "ardham kaledu",
      "understand kaledu",
      "same mistake",
      "malli ade",
      "not matching",
      "confused",
      "human help",
      "owner help",
      "staff help",
    ])
  ) {
    return "CONFUSED_OR_FRUSTRATED";
  }

  if (
    contains([
      "price ekkuva",
      "rate ekkuva",
      "cost ekkuva",
      "costly",
      "expensive",
      "too expensive",
      "too much",
      "budget takkuva",
      "budget low",
      "cheaper",
      "less price",
      "low price",
      "discount kavali",
      "inka takkuva",
    ])
  ) {
    return "PRICE_OBJECTION";
  }

  if (
    contains([
      "later",
      "tarvata",
      "taruvata",
      "next time",
      "think chesi",
      "alochinchi",
      "wife ni adigi",
      "husband ni adigi",
      "family ni adigi",
      "intlo adigi",
      "cheppi chepta",
      "chusi chepta",
      "decide chesi",
    ])
  ) {
    return "DECISION_DELAY";
  }

  return "NONE";
}


async function ncsMarkHumanAttentionSafe(
  admin: any,
  phone: string,
  reason: string,
): Promise<void> {
  try {
    await admin
      .from(
        "ncs_whatsapp_leads",
      )
      .update({
        needs_human_followup:
          true,
        followup_reason:
          reason.slice(
            0,
            240,
          ),
      })
      .eq(
        "phone",
        phone,
      );
  } catch (error) {
    console.warn(
      "NCS HUMAN ATTENTION MARK FAILED; CORE CHAT PRESERVED:",
      error instanceof Error
        ? error.message
        : String(error),
    );
  }
}


async function ncsHandleSalesBrainIntent(
  admin: any,
  phone: string,
  messageId: string,
  salesIntent: NcsSalesBrainIntent,
  memory: SalesConversationRow | null,
  previousIds: number[],
): Promise<Record<string, unknown> | null> {
  if (
    salesIntent === "NONE"
  ) {
    return null;
  }

  const productName =
    memory?.last_product_name
      ?.trim() ||
    "";

  if (
    salesIntent ===
    "PRICE_OBJECTION"
  ) {
    const text = [
      "👍 అర్థమైంది.",
      productName
        ? `${productName} price మీ budgetకి ఎక్కువగా అనిపిస్తోంది.`
        : "Price మీ budgetకి ఎక్కువగా అనిపిస్తోంది.",
      "",
      "మీకు comfortable budget ఎంత వరకు ఉందో చెప్పండి.",
      "అదే categoryలో available ఉన్న lower-price options ఉంటే వాటినే చూపిస్తాను.",
      "",
      "❗ లేని discount లేదా stock urgency నేను చెప్పను.",
    ]
      .filter(Boolean)
      .join("\n");

    const sentId =
      await sendWhatsAppTextToCustomer(
        phone,
        text,
      );

    await completeAutoReply(
      admin,
      {
        phone,
        messageId,
        productIds:
          previousIds,
        status:
          "sent",
      },
    );

    return {
      sent: true,
      mode:
        "stage15_1_price_objection",
      messageIds:
        sentId
          ? [sentId]
          : [],
    };
  }

  if (
    salesIntent ===
    "DECISION_DELAY"
  ) {
    const text = [
      "సరే 👍",
      productName
        ? `${productName} గురించి మీరు decide చేసుకుని చెప్పండి.`
        : "మీరు decide చేసుకుని చెప్పండి.",
      "",
      "మీకు convenient అయినప్పుడు ఇక్కడే message చేయండి — అదే context నుంచి continue చేస్తాను.",
    ]
      .filter(Boolean)
      .join("\n");

    const sentId =
      await sendWhatsAppTextToCustomer(
        phone,
        text,
      );

    await completeAutoReply(
      admin,
      {
        phone,
        messageId,
        productIds:
          previousIds,
        status:
          "sent",
      },
    );

    return {
      sent: true,
      mode:
        "stage15_1_decision_delay",
      messageIds:
        sentId
          ? [sentId]
          : [],
    };
  }

  if (
    salesIntent ===
    "CONFUSED_OR_FRUSTRATED"
  ) {
    await ncsMarkHumanAttentionSafe(
      admin,
      phone,
      "Stage 15.1: customer appears confused/frustrated; owner attention recommended",
    );

    const text = [
      "సరే — ఈ conversationని ఇక automatic product repliesతో clutter చేయను.",
      "",
      "NEW CITY STYLE owner / team attentionకి mark చేశాను.",
      "మీరు కావాలంటే ఒక్క lineలో ఏది కావాలో చెప్పండి; మనిషి చూసి continue చేయవచ్చు.",
    ].join("\n");

    const sentId =
      await sendWhatsAppTextToCustomer(
        phone,
        text,
      );

    await completeAutoReply(
      admin,
      {
        phone,
        messageId,
        productIds:
          previousIds,
        status:
          "sent",
      },
    );

    return {
      sent: true,
      mode:
        "stage15_1_human_handoff",
      humanAttention:
        true,
      messageIds:
        sentId
          ? [sentId]
          : [],
    };
  }

  return null;
}


async function autoReplyProducts(

  message:

    WhatsAppIncomingMessage,

  value:

    WhatsAppWebhookValue,

): Promise<

  Record<

    string,

    unknown

  >

> {

  const phone =

    normalizePhone(

      message.from,

    );



  const messageId =

    message.id?.trim() ||

    "";



  if (

    phone.length < 10 ||

    phone.length > 15 ||

    !messageId

  ) {

    return {

      sent: false,

      skipped: true,

      reason:

        "invalid_customer_or_message_id",

    };

  }



  const admin =

    createWebhookSupabaseAdmin();



  if (!admin) {

    return {

      sent: false,

      skipped: true,

      reason:

        "supabase_service_credentials_missing",

    };

  }



  const rawMessageText =

    whatsappIncomingMessageText(

      message,

    );

  /*
   * A first-time customer may send a document/photo/video/audio instead of
   * typing text. Keep business-intent detection on the real text, but give the
   * duplicate-claim/lead timeline a stable media marker so the welcome still
   * runs reliably for that first inbound message.
   */
  const messageText =
    rawMessageText ||
    `[${String(
      message.type ||
      "message",
    ).toUpperCase()}]`;

  const paymentPaidAction =
    ncsPaymentPaidAction(
      message,
    );

  if (
    paymentPaidAction.matched
  ) {
    return ncsHandlePaymentPaidSafe(
      admin,
      phone,
      paymentPaidAction.reference,
    );
  }


  if (isStage9FollowupOptOutIntent(messageText)) {
    await setStage9FollowupOptOutSafe(
      admin,
      phone,
      true,
    );

    const sentId =
      await sendWhatsAppTextToCustomer(
        phone,
        [
          "✅ NEW CITY STYLE",
          "",
          "Promotional follow-up messages are stopped for this number.",
          "You can still message us anytime for products, sizes, prices or bookings.",
          "Send START anytime to enable follow-up messages again.",
        ].join("\n"),
      );

    return {
      sent: true,
      mode: "stage9_followup_opt_out",
      messageIds: sentId ? [sentId] : [],
    };
  }

  if (isStage9FollowupOptInIntent(messageText)) {
    await setStage9FollowupOptOutSafe(
      admin,
      phone,
      false,
    );

    const sentId =
      await sendWhatsAppTextToCustomer(
        phone,
        [
          "✅ NEW CITY STYLE",
          "",
          "Follow-up messages are enabled again.",
          "You can ask normally for any product, size, colour, budget or booking.",
        ].join("\n"),
      );

    return {
      sent: true,
      mode: "stage9_followup_opt_in",
      messageIds: sentId ? [sentId] : [],
    };
  }



  const customerProductQuery =
    hasNcsExplicitShoppingIntent(
      rawMessageText,
    );

  const greetingMessage =
    stage7IsGreeting(
      rawMessageText,
    );

  const guidedAudience =
    ncsGuidedAudienceSelection(
      message,
    );

  const interactiveBusinessAction =
    hasNcsInteractiveBusinessAction(
      message,
    );

  const businessServiceIntent =
    hasNcsBusinessServiceIntent(
      rawMessageText,
    );

  /*
   * STAGE 15.1.1 FIX
   * Sales-friction replies such as "wife ni adigi chepta" are not ordinary
   * shopping keywords, so they must be recognized BEFORE the returning-personal
   * silence gate.
   */
  const earlySalesBrainIntent =
    ncsSalesBrainIntent(
      rawMessageText,
    );

  const customerHasHistory =
    await hasNcsCustomerHistory(
      admin,
      phone,
    );

  const businessIntent =
    customerProductQuery ||
    Boolean(guidedAudience) ||
    interactiveBusinessAction ||
    businessServiceIntent ||
    earlySalesBrainIntent !==
      "NONE";

  const leadCustomerName =
    value.contacts
      ?.find(
        (contact) =>
          normalizePhone(
            contact.wa_id,
          ) === phone,
      )
      ?.profile
      ?.name
      ?.trim() ||
    value.contacts?.[0]
      ?.profile
      ?.name
      ?.trim() ||
    "";

  /*
   * STAGE 12.1.1 • BUILD FIX + AUTHORITATIVE FIRST CONTACT
   *
   * ncs_whatsapp_leads is now the durable first-contact marker.
   * Before this stage, whatsapp_sales_conversations could already contain a
   * row due to older commerce-memory activity, which made a truly new chat
   * look "old" and prevented the welcome on a random first message.
   *
   * Now:
   *   no lead row = first inbound message => ALWAYS welcome
   *   lead row    = returning contact
   *
   * Lead capture also records demand / intent / score for the new Admin page.
   */
  const leadCapture =
    await captureNcsWhatsappLeadSafe(
      admin,
      {
        phone,
        customerName:
          leadCustomerName,
        messageText,
        greeting:
          greetingMessage,
        businessIntent,
        interactiveBusinessAction,
        guidedAudience,
      },
    );

  const trueFirstContact =
    leadCapture.isFirstContact ??
    !customerHasHistory;

  /*
   * BOT-TO-BOT CIRCUIT BREAKER
   * Example: another automated business account (LIC/bank/etc.) can reply to
   * our automatic reply, causing both bots to keep answering each other.
   * After six inbound events inside one minute, NCS goes silent for that burst.
   * Interactive customer actions and the very first contact are never blocked.
   */
  if (
    !trueFirstContact &&
    !interactiveBusinessAction &&
    !greetingMessage &&
    earlySalesBrainIntent ===
      "NONE" &&
    await ncsRapidInboundLoopRisk(
      admin,
      phone,
    )
  ) {
    console.warn(
      "NCS BOT LOOP GUARD: rapid inbound burst muted",
      {
        customer:
          maskPhone(phone),
      },
    );

    return {
      sent: false,
      skipped: true,
      reason:
        "rapid_inbound_bot_loop_guard",
      leadScore:
        leadCapture.score,
      leadTemperature:
        leadCapture.temperature,
    };
  }

  /*
   * STAGE 11.1+ • ZERO COOLDOWN
   * Greeting and every genuine business action may respond immediately.
   * The claim RPC is retained only for duplicate webhook/message-id safety.
   */
  const effectiveCooldownMinutes = 0;

  /*
   * Returning contacts can talk personally with the owner without the sales
   * bot interrupting. But the very first message ALWAYS gets the NCS welcome,
   * even when it is not Hi/Hello and contains no shopping keyword.
   */
  if (
    !trueFirstContact &&
    !greetingMessage &&
    !businessIntent
  ) {
    return {
      sent: false,
      skipped: true,
      reason:
        "personal_conversation_no_business_reply",
      customerProductQuery,
      cooldownMinutes: 0,
      leadScore:
        leadCapture.score,
      leadTemperature:
        leadCapture.temperature,
    };
  }

  const claim =

    await claimAutoReply(

      admin,

      phone,

      messageId,

      messageText,

      effectiveCooldownMinutes,

    );



  if (

    !claim.claimed

  ) {

    return {

      sent: false,

      skipped: true,

      reason:

        claim.reason ||

        "cooldown_or_duplicate",

      retryAfterSeconds:

        claim.retry_after_seconds ??

        null,

      customerProductQuery,

      cooldownMinutes:

        effectiveCooldownMinutes,

    };

  }



  const previousIds =

    Array.isArray(

      claim.previous_product_ids,

    )

      ? claim.previous_product_ids.map(

          Number,

        )

      : [];



  await cleanupExpiredReservationsSafe(
    admin,
  );

  const salesConversation =
    await loadSalesConversation(
      admin,
      phone,
    );

  const returningShoppingMemory =
    salesConversation ||
    await loadReturningShoppingMemory(
      admin,
      phone,
    );



  /* ------------------------------------------------------------
     STAGE 12.3 • ONE-TIME FIRST GREETING + ROTATING HERO

     1) Every NEW customer gets the premium NCS greeting first, regardless
        of what their first message says.
     2) Hi / Hello / Namaste gets the greeting again — no cooldown.
     3) Each greeting tries to show a DIFFERENT hero product from the previous
        greeting, instead of repeating the same image every time.
     4) A first message that is already shopping-related gets the greeting
        first, then continues into the existing business flow in the same turn.
     5) After first contact, normal personal messages do NOT receive the
        greeting or any automatic business reply.
  ------------------------------------------------------------ */

  const shouldSendWelcomeNow =
    trueFirstContact ||
    greetingMessage;

  if (shouldSendWelcomeNow) {
    const welcomeMessageIds =
      await sendNcsWelcomeMenuSafe(
        phone,
        leadCustomerName,
        returningShoppingMemory,
      );

    /*
     * STAGE 11.2.1 • VISUAL GREETING
     * Every premium greeting gets one live hero product after it:
     * - first contact -> greeting + hero
     * - Hi / Hello / Namaste again -> greeting + hero again
     * There is no cooldown, exactly as requested.
     */
    const hero =
      await sendNcsWelcomeHeroProductSafe(
        admin,
        phone,
        previousIds,
      );

    const welcomeProductIds =
      hero.productId
        ? [hero.productId]
        : previousIds;

    if (hero.messageId) {
      welcomeMessageIds.push(
        hero.messageId,
      );
    }

    /*
     * Persist only a neutral welcome marker. It establishes that this number
     * has already been greeted without inventing a product/category history.
     */
    await saveSalesConversation(
      admin,
      phone,
      {
        last_query:
          greetingMessage
            ? "NCS_GREETING"
            : "NCS_FIRST_CONTACT",
      },
    );

    if (
      greetingMessage ||
      !businessIntent
    ) {
      await completeAutoReply(
        admin,
        {
          phone,
          messageId,
          productIds:
            welcomeProductIds,
          status: "sent",
        },
      );

      return {
        sent: true,
        mode:
          greetingMessage
            ? "stage12_1_greeting_no_cooldown"
            : "stage12_1_true_first_contact_welcome",
        messageIds:
          welcomeMessageIds,
      };
    }

    /*
     * New customer + business request: welcome was sent first. Do not return;
     * continue below so the requested product/booking/service is handled now.
     */
  }


  /*
   * STAGE 15.1 • AI SALES BRAIN
   * Handle sales friction before falling through into another catalogue dump.
   * This keeps replies natural and prevents a frustrated customer from seeing
   * more automatic product cards.
   */
  const salesBrainIntent =
    earlySalesBrainIntent;

  const salesBrainResult =
    await ncsHandleSalesBrainIntent(
      admin,
      phone,
      messageId,
      salesBrainIntent,
      salesConversation,
      previousIds,
    );

  if (salesBrainResult) {
    return salesBrainResult;
  }


  /* ------------------------------------------------------------
     Conversation actions are handled before a normal catalogue search.
     Every action still passes through the existing duplicate-message claim.
  ------------------------------------------------------------ */

  if (
    isReservationCancelIntent(
      messageText,
    )
  ) {
    try {
      const released =
        await releaseReservationTarget(
          admin,
          phone,
          messageText,
        );

      const text =
        released.released
          ? [
              "✨ NEW CITY STYLE",
              "",
              "✅ Reservation cancelled and the item is released back to stock.",
              released.reservation_code
                ? `Booking ID: ${released.reservation_code}`
                : "",
            ]
              .filter(Boolean)
              .join("\n")
          : [
              "✨ NEW CITY STYLE",
              "",
              released.reason === "reservation_ordinal_not_found"
                ? "That booking number is not active. Send BOOKING STATUS to see your current numbered bookings."
                : "I couldn't find an active reservation to cancel.",
            ].join("\n");

      const sentId =
        await sendWhatsAppTextToCustomer(
          phone,
          text,
        );

      await completeAutoReply(
        admin,
        {
          phone,
          messageId,
          productIds:
            previousIds,
          status: "sent",
        },
      );

      return {
        sent: true,
        mode:
          "reservation_cancel",
        reservationCode:
          released.reservation_code ||
          null,
        messageIds:
          sentId ? [sentId] : [],
      };
    } catch (error) {
      console.warn(
        "NCS RESERVATION CANCEL FAILED; CONTINUING CORE SEARCH:",
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  if (
    isReservationStatusIntent(
      messageText,
    )
  ) {
    try {
      const reservations =
        await activeReservations(
          admin,
          phone,
          5,
        );
      const history =
        reservations.length === 0
          ? await latestReservationHistory(
              admin,
              phone,
            )
          : null;

      const sentId =
        await sendWhatsAppTextToCustomer(
          phone,
          buildReservationStatusListText(
            reservations,
            history,
          ),
        );

      const statusActionId =
        reservations.length > 0
          ? await sendWhatsAppQuickReplyButtons(
              phone,
              "Manage your reservation:",
              [
                {
                  id: "NCS_CANCEL_BOOKING",
                  title: "CANCEL BOOKING",
                },
              ],
            ).catch(
              (error) => {
                console.warn(
                  "NCS STATUS ACTION BUTTON FAILED; TEXT FLOW PRESERVED:",
                  error instanceof Error
                    ? error.message
                    : String(error),
                );
                return null;
              },
            )
          : null;

      await completeAutoReply(
        admin,
        {
          phone,
          messageId,
          productIds:
            previousIds,
          status: "sent",
        },
      );

      return {
        sent: true,
        mode:
          "reservation_status",
        messageIds:
          [
            sentId,
            statusActionId,
          ].filter(
            (id): id is string =>
              Boolean(id),
          ),
      };
    } catch (error) {
      console.warn(
        "NCS RESERVATION STATUS FAILED; CONTINUING CORE SEARCH:",
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  const interactiveVariantChoice =
    whatsappInteractiveVariantChoice(
      message,
    );

  if (
    interactiveVariantChoice &&
    salesConversation?.last_selected_product_id
  ) {
    try {
      const selectedProduct =
        await loadUnifiedInventoryResultByProductId(
          admin,
          Number(
            salesConversation.last_selected_product_id,
          ),
        );

      if (selectedProduct) {
        const selectionText =
          interactiveVariantChoice.kind === "size"
            ? `size ${interactiveVariantChoice.value}`
            : `colour ${interactiveVariantChoice.value}`;

        const choice =
          variantsMatchingReservationIntent(
            selectedProduct,
            selectionText,
            salesConversation,
          );

        const selectedSize =
          interactiveVariantChoice.kind === "size"
            ? interactiveVariantChoice.value
            : choice.requestedSize ||
              choice.variant?.size ||
              salesConversation.last_size ||
              null;

        const selectedColor =
          interactiveVariantChoice.kind === "color"
            ? interactiveVariantChoice.value
            : choice.requestedColor ||
              choice.variant?.color ||
              salesConversation.last_color ||
              null;

        await saveSalesConversation(
          admin,
          phone,
          {
            last_query: selectionText,
            last_result_product_ids: [
              Number(
                selectedProduct.product.id,
              ),
            ],
            last_selected_product_id:
              Number(
                selectedProduct.product.id,
              ),
            last_selected_variant_id:
              choice.variant
                ? Number(
                    choice.variant.id,
                  )
                : null,
            last_product_name:
              selectedProduct.product.name ||
              null,
            last_brand:
              selectedProduct.product.brand ||
              null,
            last_category:
              selectedProduct.product.category ||
              selectedProduct.product.subcategory ||
              null,
            last_size: selectedSize,
            last_color: selectedColor,
            last_price:
              selectedProduct.sellingPriceMin > 0
                ? selectedProduct.sellingPriceMin
                : null,
          },
        );

        const selectionMessageId =
          await sendWhatsAppTextToCustomer(
            phone,
            [
              "✨ NEW CITY STYLE",
              "",
              `✅ ${interactiveVariantChoice.kind === "size" ? "Size" : "Colour"} ${interactiveVariantChoice.value} selected`,
              `*${selectedProduct.product.name?.trim() || "Product"}*`,
              selectedProduct.product.brand?.trim() ||
                "",
              choice.variant
                ? "This option is ready to book now."
                : "Selection saved. Choose the remaining required option before booking.",
            ]
              .filter(Boolean)
              .join("\n"),
          );

        let controlId: string | null =
          null;

        if (choice.variant) {
          controlId =
            await sendSalesActionButtonsSafe(
              phone,
            );
        } else if (
          choice.ambiguousColors.length > 1
        ) {
          controlId =
            await sendWhatsAppChoiceList(
              phone,
              "Choose the exact colour you want:",
              "CHOOSE COLOUR",
              "NCS_COLOR",
              choice.ambiguousColors,
            );
        } else if (
          choice.ambiguousSizes.length > 1
        ) {
          controlId =
            await sendWhatsAppChoiceList(
              phone,
              "Choose the exact size you want:",
              "CHOOSE SIZE",
              "NCS_SIZE",
              choice.ambiguousSizes,
            );
        } else {
          controlId =
            await sendSalesActionButtonsSafe(
              phone,
            );
        }

        await completeAutoReply(
          admin,
          {
            phone,
            messageId,
            productIds: [
              Number(
                selectedProduct.product.id,
              ),
            ],
            status: "sent",
          },
        );

        return {
          sent: true,
          mode:
            interactiveVariantChoice.kind === "size"
              ? "interactive_size_selected"
              : "interactive_color_selected",
          productIds: [
            Number(
              selectedProduct.product.id,
            ),
          ],
          selectedVariantId:
            choice.variant
              ? Number(
                  choice.variant.id,
                )
              : null,
          selectedSize,
          selectedColor,
          messageIds: [
            selectionMessageId,
            controlId,
          ].filter(
            (id): id is string =>
              Boolean(id),
          ),
        };
      }
    } catch (error) {
      console.warn(
        "NCS INTERACTIVE VARIANT SELECTION FAILED; CONTINUING EXISTING FLOW:",
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  if (
    isContextualSizeQuestion(
      messageText,
      salesConversation,
    ) &&
    salesConversation
  ) {
    try {
      const sizeMatches =
        await loadContextualSizeMatches(
          admin,
          salesConversation,
          messageText,
        );

      if (sizeMatches.length > 0) {
        const requestedSize =
          parseSmartProductIntent(
            messageText,
          ).sizes[0];

        const introId =
          await sendWhatsAppTextToCustomer(
            phone,
            [
              "✨ NEW CITY STYLE",
              "",
              `✅ ${requestedSize} size available. Matching products ఇవి:`,
            ].join("\n"),
          );

        const sent =
          await ncsAllSettledSequential(
            sizeMatches.map(
              (result, index) => () =>
                sendUnifiedInventoryResult(
                  phone,
                  result,
                  buildUnifiedInventoryCaption(
                    result,
                    index,
                    sizeMatches.length,
                    "",
                  ),
                ),
            ),
          );

        const messageIds: string[] =
          introId ? [introId] : [];
        const productIds: number[] = [];

        sent.forEach((item, index) => {
          if (item.status === "fulfilled") {
            productIds.push(
              Number(
                sizeMatches[index].product.id,
              ),
            );
            if (item.value) {
              messageIds.push(item.value);
            }
          }
        });

        if (productIds.length > 0) {
          await saveConversationFromInventoryMatches(
            admin,
            phone,
            messageText,
            sizeMatches,
          );

          const selectionSummaryId =
            sizeMatches.length > 1
              ? await sendProductSelectionSummarySafe(
                  phone,
                  sizeMatches,
                )
              : null;

          if (selectionSummaryId) {
            messageIds.push(selectionSummaryId);
          }

          const controlId =
            sizeMatches.length > 1
              ? await sendProductSelectionButtonsSafe(
                  phone,
                  sizeMatches.map((result) => Number(result.product.id)),
                )
              : await sendSalesActionButtonsSafe(
                  phone,
                );

          if (controlId) {
            messageIds.push(controlId);
          }

          await completeAutoReply(
            admin,
            {
              phone,
              messageId,
              productIds,
              status: "sent",
            },
          );

          return {
            sent: true,
            mode: "contextual_size_results",
            productIds,
            messageIds,
          };
        }
      }
    } catch (error) {
      console.warn(
        "NCS CONTEXTUAL SIZE FLOW FAILED; CONTINUING NORMAL INVENTORY SEARCH:",
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  if (
    isContextualColorQuestion(
      messageText,
      salesConversation,
    ) &&
    salesConversation
  ) {
    try {
      const colorMatches =
        await loadContextualColorMatches(
          admin,
          salesConversation,
          messageText,
        );

      if (colorMatches.length > 0) {
        const requestedColor =
          parseSmartProductIntent(
            messageText,
          ).colorHints[0];

        const introId =
          await sendWhatsAppTextToCustomer(
            phone,
            [
              "✨ NEW CITY STYLE",
              "",
              `✅ ${requestedColor} colour available. Matching products ఇవి:`,
            ].join("\n"),
          );

        const sent =
          await ncsAllSettledSequential(
            colorMatches.map(
              (result, index) => () =>
                sendUnifiedInventoryResult(
                  phone,
                  result,
                  buildUnifiedInventoryCaption(
                    result,
                    index,
                    colorMatches.length,
                    "",
                  ),
                ),
            ),
          );

        const messageIds: string[] =
          introId ? [introId] : [];
        const productIds: number[] = [];

        sent.forEach((item, index) => {
          if (item.status === "fulfilled") {
            productIds.push(
              Number(
                colorMatches[index].product.id,
              ),
            );
            if (item.value) {
              messageIds.push(item.value);
            }
          }
        });

        if (productIds.length > 0) {
          await saveConversationFromInventoryMatches(
            admin,
            phone,
            messageText,
            colorMatches,
          );

          const selectionSummaryId =
            colorMatches.length > 1
              ? await sendProductSelectionSummarySafe(
                  phone,
                  colorMatches,
                )
              : null;

          if (selectionSummaryId) {
            messageIds.push(selectionSummaryId);
          }

          const controlId =
            colorMatches.length > 1
              ? await sendProductSelectionButtonsSafe(
                  phone,
                  colorMatches.map((result) => Number(result.product.id)),
                )
              : await sendSalesActionButtonsSafe(
                  phone,
                );

          if (controlId) {
            messageIds.push(controlId);
          }

          await completeAutoReply(
            admin,
            {
              phone,
              messageId,
              productIds,
              status: "sent",
            },
          );

          return {
            sent: true,
            mode: "contextual_color_results",
            productIds,
            messageIds,
          };
        }
      }
    } catch (error) {
      console.warn(
        "NCS CONTEXTUAL COLOUR FLOW FAILED; CONTINUING NORMAL INVENTORY SEARCH:",
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  const ordinalSelection =
    parseOrdinalSelection(
      messageText,
    );

  const interactiveProductId =
    whatsappInteractiveProductId(message);

  if (
    (interactiveProductId != null || ordinalSelection != null) &&
    !isReservationIntent(
      messageText,
    )
  ) {
    try {
      const selected = interactiveProductId != null
        ? await loadUnifiedInventoryResultByProductId(
            admin,
            interactiveProductId,
          )
        : await resolveConversationSelection(
            admin,
            salesConversation,
            messageText,
          );

      if (selected) {
        /*
         * Stage 3: apply size / colour words that arrive together with
         * an ordinal selection ("2nd L", "option 3 blue") to the
         * selected product instead of losing that refinement.
         */
        const choice =
          variantsMatchingReservationIntent(
            selected,
            messageText,
            salesConversation,
          );

        const refined =
          parseSmartProductIntent(messageText);
        const hasVariantRefinement =
          refined.sizes.length > 0 ||
          refined.colorHints.length > 0;

        const sentId =
          await sendUnifiedInventoryResult(
            phone,
            selected,
            hasVariantRefinement
              ? [
                  "✨ NEW CITY STYLE",
                  "",
                  `✅ Option ${ordinalSelection || 1} selected`,
                  `*${selected.product.name?.trim() || "Product"}*`,
                  selected.product.brand?.trim() || "",
                  choice.requestedSize
                    ? `Size: ${choice.requestedSize}`
                    : "",
                  choice.requestedColor
                    ? `Colour: ${choice.requestedColor}`
                    : "",
                  choice.variant
                    ? "This exact option is available now."
                    : "Selection saved. Choose any remaining size / colour below.",
                ]
                  .filter(Boolean)
                  .join("\n")
              : buildSelectionCaption(
                  selected,
                  ordinalSelection || 1,
                ),
          );

        const preservedOptionIds =
          Array.isArray(
            salesConversation?.last_result_product_ids,
          ) &&
          salesConversation!.last_result_product_ids!.length > 1
            ? salesConversation!.last_result_product_ids!
                .map(Number)
                .filter((id) => id > 0)
                .slice(0, PRODUCT_COUNT)
            : [Number(selected.product.id)];

        await saveSalesConversation(
          admin,
          phone,
          {
            last_query:
              messageText,
            // Keep the displayed 1/2/3 option set alive after opening one item.
            // This lets later natural replies still refer to the same visible set.
            last_result_product_ids:
              preservedOptionIds,
            last_selected_product_id:
              Number(
                selected.product.id,
              ),
            last_selected_variant_id:
              choice.variant
                ? Number(choice.variant.id)
                : null,
            last_product_name:
              selected.product.name ||
              null,
            last_brand:
              selected.product.brand ||
              null,
            last_category:
              selected.product.category ||
              selected.product.subcategory ||
              null,
            last_size:
              choice.requestedSize ||
              choice.variant?.size ||
              null,
            last_color:
              choice.requestedColor ||
              choice.variant?.color ||
              null,
            last_price:
              selected.sellingPriceMin > 0
                ? selected.sellingPriceMin
                : null,
          },
        );

        let actionMessageId: string | null = null;

        if (
          choice.variant ||
          selected.variants.length === 0
        ) {
          actionMessageId =
            await sendSalesActionButtonsSafe(
              phone,
            );
        } else {
          actionMessageId =
            await sendReservationChoiceControlsSafe(
              phone,
              choice,
            );
        }

        await completeAutoReply(
          admin,
          {
            phone,
            messageId,
            productIds:
              [
                Number(
                  selected.product.id,
                ),
              ],
            status: "sent",
          },
        );

        return {
          sent: true,
          mode:
            hasVariantRefinement
              ? "conversation_selection_refined"
              : "conversation_selection",
          selectedOption:
            ordinalSelection || null,
          selectedProductId:
            Number(selected.product.id),
          selectedVariantId:
            choice.variant
              ? Number(choice.variant.id)
              : null,
          selectedSize:
            choice.requestedSize || null,
          selectedColor:
            choice.requestedColor || null,
          productIds:
            [
              Number(
                selected.product.id,
              ),
            ],
          messageIds:
            [
              sentId,
              actionMessageId,
            ].filter(
              (id): id is string =>
                Boolean(id),
            ),
        };
      }
    } catch (error) {
      console.warn(
        "NCS OPTION SELECTION FAILED; CONTINUING SEARCH:",
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  if (
    isReservationIntent(
      messageText,
    )
  ) {
    try {
      let reservationResult:
        UnifiedInventoryResult | null =
        null;

      const ordinal =
        parseOrdinalSelection(
          messageText,
        );

      if (
        ordinal != null
      ) {
        reservationResult =
          await resolveConversationSelection(
            admin,
            salesConversation,
            messageText,
          );
      }

      const actionStripped =
        stripReservationActionWords(
          messageText,
        );

      if (
        !reservationResult &&
        actionStripped.length >= 2 &&
        actionStripped !==
          normalizeSearchText(
            messageText,
          )
      ) {
        const bookingSearchText =
          contextualInventoryQuery(
            salesConversation,
            actionStripped,
          );

        const bookingSearch =
          await loadUnifiedInventorySearch(
            admin,
            bookingSearchText,
            previousIds,
          );

        reservationResult =
          bookingSearch.matches[0] ||
          null;
      }

      if (!reservationResult) {
        reservationResult =
          await resolveConversationSelection(
            admin,
            salesConversation,
            messageText,
          );
      }

      if (!reservationResult) {
        const sentId =
          await sendWhatsAppTextToCustomer(
            phone,
            [
              "✨ NEW CITY STYLE",
              "",
              "Please select a product before booking.",
              "Search a brand/item or reply 1, 2 or 3 to the last options, then send BOOK.",
            ].join("\n"),
          );

        await completeAutoReply(
          admin,
          {
            phone,
            messageId,
            productIds:
              previousIds,
            status: "sent",
          },
        );

        return {
          sent: true,
          mode:
            "reservation_needs_product",
          messageIds:
            sentId ? [sentId] : [],
        };
      }

      const choice =
        variantsMatchingReservationIntent(
          reservationResult,
          messageText,
          salesConversation,
        );

      if (
        choice.result.variants.length > 0 &&
        !choice.variant
      ) {
        const sentId =
          await sendWhatsAppTextToCustomer(
            phone,
            buildReservationNeedChoiceText(
              choice,
            ),
          );

        const choiceControlId =
          await sendReservationChoiceControlsSafe(
            phone,
            choice,
          );

        await saveSalesConversation(
          admin,
          phone,
          {
            last_query:
              messageText,
            last_result_product_ids:
              [
                Number(
                  reservationResult.product.id,
                ),
              ],
            last_selected_product_id:
              Number(
                reservationResult.product.id,
              ),
            last_selected_variant_id:
              null,
            last_product_name:
              reservationResult.product.name ||
              null,
            last_brand:
              reservationResult.product.brand ||
              null,
            last_category:
              reservationResult.product.category ||
              reservationResult.product.subcategory ||
              null,
            last_size:
              choice.requestedSize,
            last_color:
              choice.requestedColor,
            last_price:
              reservationResult.sellingPriceMin > 0
                ? reservationResult.sellingPriceMin
                : null,
          },
        );

        await completeAutoReply(
          admin,
          {
            phone,
            messageId,
            productIds:
              [
                Number(
                  reservationResult.product.id,
                ),
              ],
            status: "sent",
          },
        );

        return {
          sent: true,
          mode:
            "reservation_needs_variant",
          productIds:
            [
              Number(
                reservationResult.product.id,
              ),
            ],
          messageIds:
            [
              sentId,
              choiceControlId,
            ].filter(
              (id): id is string =>
                Boolean(id),
            ),
        };
      }

      const requestedQuantity =
        parseReservationQuantity(
          messageText,
        );

      if (
        choice.variant &&
        variantAvailableStock(
          choice.variant,
        ) < requestedQuantity
      ) {
        const availableNow =
          variantAvailableStock(
            choice.variant,
          );

        const sentId =
          await sendWhatsAppTextToCustomer(
            phone,
            [
              "✨ NEW CITY STYLE",
              "",
              `You asked for ${requestedQuantity} pieces.`,
              availableNow > 0
                ? `Only ${availableNow} piece${availableNow === 1 ? "" : "s"} are available in this exact size / colour right now.`
                : "That exact size / colour is not available right now.",
              "Please choose a smaller quantity or another size / colour.",
            ].join("\n"),
          );

        await completeAutoReply(
          admin,
          {
            phone,
            messageId,
            productIds: [
              Number(
                reservationResult.product.id,
              ),
            ],
            status: "sent",
          },
        );

        return {
          sent: true,
          mode: "reservation_quantity_unavailable",
          requestedQuantity,
          availableQuantity: availableNow,
          productIds: [
            Number(
              reservationResult.product.id,
            ),
          ],
          messageIds: sentId ? [sentId] : [],
        };
      }

      if (
        !choice.variant &&
        reservationResult.variants.length === 0 &&
        reservationResult.availableStock < requestedQuantity
      ) {
        const sentId =
          await sendWhatsAppTextToCustomer(
            phone,
            [
              "✨ NEW CITY STYLE",
              "",
              `You asked for ${requestedQuantity} pieces.`,
              `Only ${reservationResult.availableStock} piece${reservationResult.availableStock === 1 ? "" : "s"} are available right now.`,
              "Please choose a smaller quantity.",
            ].join("\n"),
          );

        await completeAutoReply(
          admin,
          {
            phone,
            messageId,
            productIds: [
              Number(
                reservationResult.product.id,
              ),
            ],
            status: "sent",
          },
        );

        return {
          sent: true,
          mode: "reservation_quantity_unavailable",
          requestedQuantity,
          availableQuantity:
            reservationResult.availableStock,
          productIds: [
            Number(
              reservationResult.product.id,
            ),
          ],
          messageIds: sentId ? [sentId] : [],
        };
      }

      const reservation =
        await reserveInventoryChoice(
          admin,
          phone,
          messageId,
          choice,
          messageText,
          requestedQuantity,
        );

      if (
        reservation.reserved
      ) {
        const sentId =
          await sendWhatsAppTextToCustomer(
            phone,
            buildReservationConfirmationText(
              reservation,
              requestedQuantity,
            ),
          );

        const reservationActionId =
          await sendWhatsAppQuickReplyButtons(
            phone,
            "Reservation actions:",
            [
              {
                id: "NCS_BOOKING_STATUS",
                title: "BOOKING STATUS",
              },
              {
                id: "NCS_CANCEL_BOOKING",
                title: "CANCEL BOOKING",
              },
            ],
          ).catch(
            (error) => {
              console.warn(
                "NCS RESERVATION ACTION BUTTONS FAILED; TEXT FLOW PRESERVED:",
                error instanceof Error
                  ? error.message
                  : String(error),
              );
              return null;
            },
          );

        await saveSalesConversation(
          admin,
          phone,
          {
            last_query:
              messageText,
            last_result_product_ids:
              [
                Number(
                  reservationResult.product.id,
                ),
              ],
            last_selected_product_id:
              Number(
                reservationResult.product.id,
              ),
            last_selected_variant_id:
              choice.variant
                ? Number(
                    choice.variant.id,
                  )
                : null,
            last_product_name:
              reservationResult.product.name ||
              null,
            last_brand:
              reservationResult.product.brand ||
              null,
            last_category:
              reservationResult.product.category ||
              reservationResult.product.subcategory ||
              null,
            last_size:
              reservation.size ||
              choice.variant?.size ||
              choice.requestedSize,
            last_color:
              reservation.color ||
              choice.variant?.color ||
              choice.requestedColor,
            last_price:
              safeNumber(
                reservation.price,
              ) ||
              reservationResult.sellingPriceMin ||
              null,
          },
        );

        await recordShoppingMemorySafe(
          admin,
          phone,
          {
            brand:
              reservationResult.product.brand,
            category:
              reservationResult.product.category ||
              reservationResult.product.subcategory,
            size:
              reservation.size ||
              choice.variant?.size,
            color:
              reservation.color ||
              choice.variant?.color,
            query:
              messageText,
            reserved: true,
          },
        );

        await completeAutoReply(
          admin,
          {
            phone,
            messageId,
            productIds:
              [
                Number(
                  reservationResult.product.id,
                ),
              ],
            status: "sent",
          },
        );

        return {
          sent: true,
          mode:
            "reservation_created",
          reservationCode:
            reservation.reservation_code ||
            null,
          productIds:
            [
              Number(
                reservationResult.product.id,
              ),
            ],
          messageIds:
            [
              sentId,
              reservationActionId,
            ].filter(
              (id): id is string =>
                Boolean(id),
            ),
        };
      }

      const sentId =
        await sendWhatsAppTextToCustomer(
          phone,
          [
            "✨ NEW CITY STYLE",
            "",
            reservation.reason === "out_of_stock" && requestedQuantity > 1
              ? `The requested ${requestedQuantity} pieces are not available now.`
              : "That exact item could not be reserved right now.",
            "It may have just been sold or reserved. Ask for another quantity / size / colour and I'll check live stock and show the closest available options.",
          ].join("\n"),
        );

      await completeAutoReply(
        admin,
        {
          phone,
          messageId,
          productIds:
            previousIds,
          status: "sent",
        },
      );

      return {
        sent: true,
        mode:
          "reservation_unavailable",
        reason:
          reservation.reason ||
          "not_available",
        messageIds:
          sentId ? [sentId] : [],
      };
    } catch (error) {
      console.warn(
        "NCS RESERVATION FLOW FAILED; CONTINUING EXISTING SEARCH FLOW:",
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }



  /* ------------------------------------------------------------
     STAGE 11.1 GUIDED COMMERCE BRAIN • 2036
     - greeting => Telugu welcome + MEN / WOMEN / KIDS
     - audience => category menu
     - thanks / bye => polite close, never product spam
     - direct product requests still continue into the existing live
       inventory, size, colour, booking and recommendation engines
     ------------------------------------------------------------ */

  if (guidedAudience) {
    const messageIds =
      await sendNcsAudienceCategoryMenuSafe(
        phone,
        guidedAudience,
      );

    await completeAutoReply(
      admin,
      {
        phone,
        messageId,
        productIds: previousIds,
        status: "sent",
      },
    );

    return {
      sent: true,
      mode:
        `stage11_guided_${guidedAudience}_menu`,
      messageIds,
    };
  }

  /* Greeting is handled earlier by Stage 11.1 so it can bypass cooldown
     and can be sent before a new customer's first business response. */

  if (
    isNcsPoliteCloseIntent(
      messageText,
    )
  ) {
    const sentId =
      await sendWhatsAppTextToCustomer(
        phone,
        [
          "🙏 ధన్యవాదాలు!",
          "NEW CITY STYLEని సంప్రదించినందుకు సంతోషం.",
          "",
          "మళ్లీ shopping చేయాలంటే MEN / WOMEN / KIDS లేదా product పేరు పంపండి.",
        ].join("\n"),
      );

    await completeAutoReply(
      admin,
      {
        phone,
        messageId,
        productIds: previousIds,
        status: "sent",
      },
    );

    return {
      sent: true,
      mode:
        "stage11_polite_close",
      messageIds:
        sentId ? [sentId] : [],
    };
  }

  /* ------------------------------------------------------------
     STAGE 8 RETURNING CUSTOMER MEMORY + PROACTIVE SALES BRAIN
     Persistent shopping memory is consulted only for explicit returning-
     customer intents or a greeting. It never overrides a fresh product ask.
     ------------------------------------------------------------ */

  const stage8ReturningPlan =
    buildStage8ReturningPlan(
      salesConversation,
      returningShoppingMemory,
      messageText,
    );

  if (
    stage8ReturningPlan?.kind === "text"
  ) {
    const sentId =
      await sendWhatsAppTextToCustomer(
        phone,
        stage8ReturningPlan.text,
      );

    await completeAutoReply(
      admin,
      {
        phone,
        messageId,
        productIds: previousIds,
        status: "sent",
      },
    );

    return {
      sent: true,
      mode: stage8ReturningPlan.mode,
      messageIds: sentId ? [sentId] : [],
    };
  }

  const stage8InventoryQuery =
    stage8ReturningPlan?.kind === "search"
      ? stage8ReturningPlan.query
      : null;

  /* ------------------------------------------------------------
     STAGE 7 AUTO SALES REPLY BRAIN
     Natural-language answers / deterministic context rewrites run after
     reservation actions and before recommendation/catalogue search.
     ------------------------------------------------------------ */

  const stage7AutoPlan =
    buildStage7AutoSalesPlan(
      salesConversation,
      messageText,
    );

  if (
    stage7AutoPlan?.kind === "text"
  ) {
    const sentId =
      await sendWhatsAppTextToCustomer(
        phone,
        stage7AutoPlan.text,
      );

    await completeAutoReply(
      admin,
      {
        phone,
        messageId,
        productIds: previousIds,
        status: "sent",
      },
    );

    return {
      sent: true,
      mode: stage7AutoPlan.mode,
      messageIds: sentId ? [sentId] : [],
    };
  }

  const stage7InventoryQuery =
    stage7AutoPlan?.kind === "search"
      ? stage7AutoPlan.query
      : null;

  /* ------------------------------------------------------------
     STAGE 6 RECOMMENDATION / CROSS-SELL FAST PATH
     ------------------------------------------------------------ */

  if (
    isStage6MatchingColourAdviceIntent(
      messageText,
    )
  ) {
    const selectedColour =
      salesConversation?.last_color?.trim() || "";

    const sentId =
      await sendWhatsAppTextToCustomer(
        phone,
        selectedColour
          ? [
              "✨ NEW CITY STYLE",
              "",
              `Selected colour: ${selectedColour}`,
              `Easy matching colours: ${stage6ColourPairSuggestions(selectedColour).join(", ")}.`,
              "Send MATCHING PANT (or another category) and I’ll show only live in-stock options.",
            ].join("\n")
          : [
              "✨ NEW CITY STYLE",
              "",
              "Select the exact product colour first.",
              "Then ask MATCHING COLOUR or MATCHING PANT and I’ll continue from that item.",
            ].join("\n"),
      );

    await completeAutoReply(
      admin,
      {
        phone,
        messageId,
        productIds: previousIds,
        status: "sent",
      },
    );

    return {
      sent: true,
      mode: "stage6_matching_colour_advice",
      messageIds: sentId ? [sentId] : [],
    };
  }

  const stage6Plan =
    buildStage6RecommendationPlan(
      salesConversation,
      messageText,
    );

  if (stage6Plan) {
    try {
      if (
        stage6Plan.kind === "full_set" &&
        !stage6Plan.query
      ) {
        const sentId =
          await sendWhatsAppTextToCustomer(
            phone,
            [
              "✨ NEW CITY STYLE",
              "",
              "Select one top / shirt first, then send FULL SET with your budget.",
              "Example: FULL SET under 1500",
              "I’ll use the selected item price and show only in-stock matching pieces inside the remaining budget.",
            ].join("\n"),
          );

        await completeAutoReply(
          admin,
          {
            phone,
            messageId,
            productIds: previousIds,
            status: "sent",
          },
        );

        return {
          sent: true,
          mode: "stage6_full_set_needs_base",
          messageIds: sentId ? [sentId] : [],
        };
      }

      const recommendationSearch =
        await loadUnifiedInventorySearch(
          admin,
          stage6Plan.query,
          [],
        );

      const selectedId = Number(
        salesConversation?.last_selected_product_id || 0,
      );

      let recommendationMatches =
        recommendationSearch.matches.filter(
          (result) =>
            Number(result.product.id) !== selectedId,
        );

      if (
        stage6Plan.kind === "budget_multi"
      ) {
        recommendationMatches =
          recommendationMatches.slice(
            0,
            stage6Plan.requestedCount,
          );
      } else {
        recommendationMatches =
          recommendationMatches.slice(
            0,
            PRODUCT_COUNT,
          );
      }

      if (recommendationMatches.length > 0) {
        const estimatedTotal =
          stage6EstimatedTotal(
            recommendationMatches,
          );

        const introLines = [
          "✨ NEW CITY STYLE",
          "",
          stage6Plan.heading,
        ];

        if (
          stage6Plan.kind === "budget_multi" &&
          stage6Plan.totalBudget != null
        ) {
          introLines.push(
            estimatedTotal > 0
              ? `Current ${recommendationMatches.length}-item estimate: ${money(estimatedTotal)}.`
              : `Budget checked: ${money(stage6Plan.totalBudget)}.`,
          );
        } else if (
          stage6Plan.kind === "full_set" &&
          stage6Plan.totalBudget != null
        ) {
          introLines.push(
            `Set budget: ${money(stage6Plan.totalBudget)}.`,
          );
        }

        introLines.push(
          "Only currently available inventory is shown.",
        );

        const introId =
          await sendWhatsAppTextToCustomer(
            phone,
            introLines.join("\n"),
          );

        const sentResults =
          await ncsAllSettledSequential(
            recommendationMatches.map(
              (result, index) => () =>
                sendUnifiedInventoryResult(
                  phone,
                  result,
                  buildUnifiedInventoryCaption(
                    result,
                    index,
                    recommendationMatches.length,
                    "",
                  ),
                ),
            ),
          );

        const sentIds: number[] = [];
        const messageIds: string[] =
          introId ? [introId] : [];

        sentResults.forEach(
          (result, index) => {
            if (result.status === "fulfilled") {
              sentIds.push(
                Number(
                  recommendationMatches[index].product.id,
                ),
              );

              if (result.value) {
                messageIds.push(result.value);
              }
            }
          },
        );

        if (sentIds.length > 0) {
          await saveConversationFromInventoryMatches(
            admin,
            phone,
            stage6Plan.query,
            recommendationMatches,
          );

          const selectionSummaryId =
            recommendationMatches.length > 1
              ? await sendProductSelectionSummarySafe(
                  phone,
                  recommendationMatches,
                )
              : null;

          if (selectionSummaryId) {
            messageIds.push(selectionSummaryId);
          }

          const controls =
            recommendationMatches.length > 1
              ? await sendProductSelectionButtonsSafe(
                  phone,
                  recommendationMatches.map(
                    (result) => Number(result.product.id),
                  ),
                )
              : await sendSalesActionButtonsSafe(phone);

          if (controls) {
            messageIds.push(controls);
          }

          await completeAutoReply(
            admin,
            {
              phone,
              messageId,
              productIds: sentIds,
              status: "sent",
            },
          );

          return {
            sent: true,
            mode: `stage6_${stage6Plan.kind}`,
            productIds: sentIds,
            messageIds,
            estimatedTotal:
              estimatedTotal > 0
                ? estimatedTotal
                : null,
            budget: stage6Plan.totalBudget,
          };
        }
      }

      const noMatchId =
        await sendWhatsAppTextToCustomer(
          phone,
          [
            "✨ NEW CITY STYLE",
            "",
            "I couldn’t find a suitable in-stock match for that request right now.",
            stage6Plan.totalBudget != null
              ? `Budget checked: ${money(stage6Plan.totalBudget)}.`
              : "Try another category, colour or budget and I’ll check live stock again.",
          ].join("\n"),
        );

      await completeAutoReply(
        admin,
        {
          phone,
          messageId,
          productIds: previousIds,
          status: "sent",
        },
      );

      return {
        sent: true,
        mode: `stage6_${stage6Plan.kind}_no_match`,
        messageIds: noMatchId ? [noMatchId] : [],
      };
    } catch (error) {
      console.warn(
        "NCS STAGE 6 RECOMMENDATION FLOW FAILED; CONTINUING STAGE 5 SEARCH:",
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  let unifiedInventorySearch:
    UnifiedInventorySearch | null =
    null;

  const inventorySearchText =
    stage8InventoryQuery ||
    stage7InventoryQuery ||
    contextualInventoryQuery(
      salesConversation,
      messageText,
    );

  if (
    customerProductQuery ||
    Boolean(stage8InventoryQuery) ||
    Boolean(stage7InventoryQuery)
  ) {
    try {
      unifiedInventorySearch =
        await loadUnifiedInventorySearch(
          admin,
          inventorySearchText,
          previousIds,
        );
    } catch (error) {
      console.warn(
        "NCS UNIFIED INVENTORY SEARCH FAILED; KEEPING EXISTING ONLINE FLOW:",
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }



  if (
    unifiedInventorySearch
      ?.meaningful &&
    unifiedInventorySearch
      .matches.length > 0
  ) {
    const inventoryCustomerName =

      value.contacts

        ?.find(

          (contact) =>

            normalizePhone(

              contact.wa_id,

            ) === phone,

        )

        ?.profile

        ?.name

        ?.trim() ||

      value.contacts?.[0]

        ?.profile

        ?.name

        ?.trim() ||

      "";



    const inventoryMatches =
      unifiedInventorySearch
        .matches;



    const inventoryResults =
      await ncsAllSettledSequential(

        inventoryMatches.map(

          (
            result,
            index,
          ) => () =>
            sendUnifiedInventoryResult(
              phone,
              result,
              buildUnifiedInventoryCaption(
                result,
                index,
                inventoryMatches.length,
                index === 0
                  ? inventoryCustomerName
                  : "",
              ),
            ),

        ),

      );



    const inventorySentProductIds:
      number[] = [];

    const inventoryMessageIds:
      string[] = [];

    const inventoryFailures:
      string[] = [];



    inventoryResults.forEach(
      (
        result,
        index,
      ) => {
        if (
          result.status ===
          "fulfilled"
        ) {
          inventorySentProductIds.push(
            Number(
              inventoryMatches[
                index
              ].product.id,
            ),
          );

          if (
            result.value
          ) {
            inventoryMessageIds.push(
              result.value,
            );
          }
        } else {
          inventoryFailures.push(
            result.reason
              instanceof Error
              ? result.reason
                  .message
              : String(
                  result.reason,
                ),
          );
        }
      },
    );



    if (
      inventorySentProductIds
        .length > 0
    ) {
      await saveConversationFromInventoryMatches(
        admin,
        phone,
        inventorySearchText,
        inventoryMatches,
      );

      const inventorySelectionSummaryId =
        inventoryMatches.length > 1
          ? await sendProductSelectionSummarySafe(
              phone,
              inventoryMatches,
            )
          : null;

      if (inventorySelectionSummaryId) {
        inventoryMessageIds.push(
          inventorySelectionSummaryId,
        );
      }

      const inventoryControlId =
        inventoryMatches.length > 1
          ? await sendProductSelectionButtonsSafe(
              phone,
              inventoryMatches.map((result) => Number(result.product.id)),
            )
          : await sendSalesActionButtonsSafe(
              phone,
            );

      if (inventoryControlId) {
        inventoryMessageIds.push(
          inventoryControlId,
        );
      }

      await completeAutoReply(
        admin,
        {
          phone,
          messageId,
          productIds:
            inventorySentProductIds,
          status: "sent",
        },
      );

      return {
        sent: true,
        mode:
          "unified_inventory",
        customerProductQuery:
          true,
        cooldownMinutes: 0,
        productIds:
          inventorySentProductIds,
        messageIds:
          inventoryMessageIds,
        storeOnlyProducts:
          inventoryMatches.filter(
            (result) =>
              !result.isOnline,
          ).length,
        onlineProducts:
          inventoryMatches.filter(
            (result) =>
              result.isOnline,
          ).length,
        failures:
          inventoryFailures,
      };
    }



    await completeAutoReply(
      admin,
      {
        phone,
        messageId,
        productIds: [],
        status: "failed",
        errorMessage:
          inventoryFailures.join(
            " | ",
          ) ||
          "Unified inventory reply failed.",
      },
    );

    return {
      sent: false,
      mode:
        "unified_inventory",
      error:
        inventoryFailures.join(
          " | ",
        ) ||
        "Unable to send inventory reply.",
    };
  }



  if (
    unifiedInventorySearch
      ?.meaningful &&
    unifiedInventorySearch
      .matches.length === 0
  ) {
    let alternativeSearch:
      UnifiedInventorySearch | null =
      null;

    const relaxedQuery =
      relaxedAlternativeQuery(
        salesConversation,
        inventorySearchText,
        messageText,
      );

    if (
      relaxedQuery &&
      normalizeSearchText(
        relaxedQuery,
      ) !==
        normalizeSearchText(
          inventorySearchText,
        )
    ) {
      try {
        alternativeSearch =
          await loadUnifiedInventorySearch(
            admin,
            relaxedQuery,
            previousIds,
          );
      } catch (error) {
        console.warn(
          "NCS ALTERNATIVE INVENTORY SEARCH FAILED:",
          error instanceof Error
            ? error.message
            : String(error),
        );
      }
    }

    if (
      alternativeSearch
        ?.meaningful &&
      alternativeSearch.matches
        .length > 0
    ) {
      try {
        await sendWhatsAppTextToCustomer(
          phone,
          [
            "✨ NEW CITY STYLE",
            "",
            "That exact size / colour is not available right now.",
            "Here are the closest in-stock options:",
          ].join("\n"),
        );

        const alternatives =
          alternativeSearch.matches;

        const alternativeResults =
          await ncsAllSettledSequential(
            alternatives.map(
              (result, index) => () =>
                sendUnifiedInventoryResult(
                  phone,
                  result,
                  buildUnifiedInventoryCaption(
                    result,
                    index,
                    alternatives.length,
                    "",
                  ),
                ),
            ),
          );

        const sentAlternativeIds:
          number[] = [];
        const sentAlternativeMessages:
          string[] = [];

        alternativeResults.forEach(
          (result, index) => {
            if (
              result.status ===
              "fulfilled"
            ) {
              sentAlternativeIds.push(
                Number(
                  alternatives[index]
                    .product.id,
                ),
              );

              if (result.value) {
                sentAlternativeMessages.push(
                  result.value,
                );
              }
            }
          },
        );

        if (
          sentAlternativeIds.length >
          0
        ) {
          await saveConversationFromInventoryMatches(
            admin,
            phone,
            relaxedQuery ||
              inventorySearchText,
            alternatives,
          );

          const alternativeSelectionSummaryId =
            alternatives.length > 1
              ? await sendProductSelectionSummarySafe(
                  phone,
                  alternatives,
                )
              : null;

          if (alternativeSelectionSummaryId) {
            sentAlternativeMessages.push(
              alternativeSelectionSummaryId,
            );
          }

          const alternativeControlId =
            alternatives.length > 1
              ? await sendProductSelectionButtonsSafe(
                  phone,
                  alternatives.map((result) => Number(result.product.id)),
                )
              : await sendSalesActionButtonsSafe(
                  phone,
                );

          if (alternativeControlId) {
            sentAlternativeMessages.push(
              alternativeControlId,
            );
          }

          await completeAutoReply(
            admin,
            {
              phone,
              messageId,
              productIds:
                sentAlternativeIds,
              status: "sent",
            },
          );

          return {
            sent: true,
            mode:
              "inventory_alternatives",
            productIds:
              sentAlternativeIds,
            messageIds:
              sentAlternativeMessages,
          };
        }
      } catch (error) {
        console.warn(
          "NCS ALTERNATIVE SEND FAILED; CONTINUING STANDARD FALLBACK:",
          error instanceof Error
            ? error.message
            : String(error),
        );
      }
    }

    try {
      await sendWhatsAppTextToCustomer(
        phone,
        buildInventoryNoMatchText(
          messageText,
        ),
      );
    } catch (error) {
      console.warn(
        "UNIFIED INVENTORY NO-MATCH NOTICE FAILED; CONTINUING WITH ONLINE PICKS:",
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }



  /*
   * STAGE 11 SAFETY GATE
   *
   * The old fallback intentionally kept "any message -> product reply".
   * That caused greetings and unrelated messages to receive random products.
   * From Stage 11.1 onward, products are sent only after a real shopping
   * intent, a guided category choice, or an existing Stage 7/8 search plan.
   * Personal conversation is filtered earlier and never reaches this block.
   */
  const shouldSendProductFallback =
    customerProductQuery ||
    Boolean(stage8InventoryQuery) ||
    Boolean(stage7InventoryQuery);

  if (!shouldSendProductFallback) {
    const customerName =
      value.contacts
        ?.find(
          (contact) =>
            normalizePhone(
              contact.wa_id,
            ) === phone,
        )
        ?.profile
        ?.name
        ?.trim() ||
      value.contacts?.[0]
        ?.profile
        ?.name
        ?.trim() ||
      "";

    const messageIds =
      await sendNcsWelcomeMenuSafe(
        phone,
        customerName,
        returningShoppingMemory,
      );

    await completeAutoReply(
      admin,
      {
        phone,
        messageId,
        productIds: previousIds,
        status: "sent",
      },
    );

    return {
      sent: true,
      mode:
        "stage11_guided_non_product_message",
      messageIds,
    };
  }


  const productPool =

    await loadProductPool(

      admin,

    );



  const products =

    chooseProducts(

      productPool,

      messageText,

      previousIds,

      messageId,

    );



  if (

    products.length === 0

  ) {

    const reason =

      "No active in-stock online products with a public photo were found.";



    await completeAutoReply(

      admin,

      {

        phone,

        messageId,

        productIds: [],

        status:

          "failed",

        errorMessage:

          reason,

      },

    );



    return {

      sent: false,

      skipped: true,

      reason:

        "no_eligible_products",

    };

  }



  const customerName =

    value.contacts

      ?.find(

        (contact) =>

          normalizePhone(

            contact.wa_id,

          ) === phone,

      )

      ?.profile

      ?.name

      ?.trim() ||

    value.contacts?.[0]

      ?.profile

      ?.name

      ?.trim() ||

    "";



  const results =

    await ncsAllSettledSequential(

      products.map(

        (

          product,

          index,

        ) => () =>

          sendProductImage(

            {

              to: phone,

              product,

              caption:

                buildProductCaption(

                  product,

                  index,

                  products.length,

                  index === 0

                    ? customerName

                    : "",

                ),

            },

          ),

      ),

    );



  const sentProductIds:

    number[] = [];



  const sentMessageIds:

    string[] = [];



  const failures:

    string[] = [];



  results.forEach(

    (

      result,

      index,

    ) => {

      if (

        result.status ===

        "fulfilled"

      ) {

        sentProductIds.push(

          Number(

            products[index]

              .id,

          ),

        );



        if (

          result.value

        ) {

          sentMessageIds.push(

            result.value,

          );

        }

      } else {

        failures.push(

          result.reason

            instanceof Error

            ? result.reason

                .message

            : String(

                result.reason,

              ),

        );

      }

    },

  );



  if (

    sentProductIds.length ===

    0

  ) {

    const reason =

      failures.join(

        " | ",

      ) ||

      "All product image sends failed.";



    await completeAutoReply(

      admin,

      {

        phone,

        messageId,

        productIds: [],

        status:

          "failed",

        errorMessage:

          reason,

      },

    );



    throw new Error(

      reason,

    );

  }



  const firstFallbackProduct =
    products[0] || null;

  if (firstFallbackProduct) {
    await saveSalesConversation(
      admin,
      phone,
      {
        last_query:
          messageText,
        last_result_product_ids:
          products.map(
            (product) =>
              Number(product.id),
          ),
        last_selected_product_id:
          Number(
            firstFallbackProduct.id,
          ),
        last_selected_variant_id:
          null,
        last_product_name:
          firstFallbackProduct.name ||
          null,
        last_brand:
          firstFallbackProduct.brand ||
          null,
        last_category:
          firstFallbackProduct.category ||
          firstFallbackProduct.subcategory ||
          null,
        last_size:
          null,
        last_color:
          null,
        last_price:
          safeNumber(
            firstFallbackProduct.price,
          ) || null,
      },
    );
  }

  await completeAutoReply(

    admin,

    {

      phone,

      messageId,

      productIds:

        sentProductIds,

      status:

        "sent",

    },

  );



  return {

    sent: true,

    sentCount:

      sentProductIds.length,

    productIds:

      sentProductIds,

    whatsappMessageIds:

      sentMessageIds,

    failedCount:

      failures.length,

  };

}



/* ============================================================

   META WEBHOOK VERIFICATION

============================================================ */



export async function GET(

  request: NextRequest,

) {

  const mode =

    request.nextUrl

      .searchParams

      .get("hub.mode");



  const token =

    request.nextUrl

      .searchParams

      .get(

        "hub.verify_token",

      );



  const challenge =

    request.nextUrl

      .searchParams

      .get("hub.challenge");



  const verifyToken =

    process.env

      .WHATSAPP_VERIFY_TOKEN

      ?.trim();



  if (!verifyToken) {

    console.error(

      "WHATSAPP_VERIFY_TOKEN is missing from environment variables.",

    );



    return new NextResponse(

      "Webhook verify token is not configured.",

      {

        status: 500,

      },

    );

  }



  if (

    mode === "subscribe" &&

    token === verifyToken &&

    challenge

  ) {

    console.log(

      "WhatsApp webhook verification successful.",

    );



    return new NextResponse(

      challenge,

      {

        status: 200,

        headers: {

          "Content-Type":

            "text/plain",

        },

      },

    );

  }



  console.warn(

    "WhatsApp webhook verification failed.",

    {

      mode,

      hasToken:

        Boolean(token),

      hasChallenge:

        Boolean(

          challenge,

        ),

    },

  );



  return new NextResponse(

    "Forbidden",

    {

      status: 403,

    },

  );

}



/* ============================================================

   WHATSAPP DELIVERY + INCOMING MESSAGE WEBHOOK



   PRESERVED FROM CURRENT WORKING FILE:

   - sent / delivered / read / failed

   - customer replies

   - public.whatsapp_message_logs delivery persistence

   - LIVA delivery-status source



   ADDED:

   - automatic 3 product photo + direct link reply

   - 6-hour default cooldown

   - duplicate webhook protection

   - active + sell_online + in-stock product filtering

============================================================ */



export async function POST(

  request: NextRequest,

) {

  try {

    const payload =

      (await request.json()) as

        WhatsAppWebhookPayload;



    if (

      payload.object !==

      "whatsapp_business_account"

    ) {

      console.info(

        "Ignored non-WhatsApp webhook payload.",

        {

          object:

            payload.object ||

            null,

        },

      );



      return NextResponse.json(

        {

          success: true,

          ignored: true,

        },

        {

          status: 200,

        },

      );

    }



    const deliveryEvents:

      Array<

        Record<

          string,

          unknown

        >

      > = [];



    const incomingMessages:

      Array<

        Record<

          string,

          unknown

        >

      > = [];



    const deliveryRows:

      Array<

        Record<

          string,

          unknown

        >

      > = [];



    const autoReplyJobs:

      Array<

        Promise<

          Record<

            string,

            unknown

          >

        >

      > = [];



    for (

      const entry of

      payload.entry || []

    ) {

      for (

        const change of

        entry.changes || []

      ) {

        const value =

          change.value;



        /* ====================================================

           DELIVERY STATUS

        ==================================================== */



        for (

          const status of

          value?.statuses || []

        ) {

          const firstError =

            status.errors?.[0];



          const event = {

            whatsappBusinessAccountId:

              entry.id || null,



            phoneNumberId:

              value?.metadata

                ?.phone_number_id ||

              null,



            displayPhoneNumber:

              value?.metadata

                ?.display_phone_number ||

              null,



            messageId:

              status.id || null,



            status:

              status.status ||

              "unknown",



            recipient:

              maskPhone(

                status.recipient_id,

              ),



            timestamp:

              status.timestamp ||

              null,



            conversationId:

              status.conversation

                ?.id || null,



            conversationCategory:

              status.conversation

                ?.origin

                ?.type || null,



            billable:

              status.pricing

                ?.billable ??

              null,



            pricingCategory:

              status.pricing

                ?.category ||

              status.pricing

                ?.type ||

              null,



            errorCode:

              firstError?.code ??

              null,



            errorTitle:

              firstError?.title ||

              null,



            errorMessage:

              firstError?.message ||

              null,



            errorDetails:

              firstError

                ?.error_data

                ?.details ||

              null,

          };



          deliveryEvents.push(

            event,

          );



          /*

           * Preserve current behavior:

           * store delivery status only when Meta supplied

           * a real WhatsApp message id.

           */

          if (status.id) {

            deliveryRows.push(

              {

                message_id:

                  status.id,



                status:

                  status.status ||

                  "unknown",



                recipient_last4:

                  recipientLast4(

                    status.recipient_id,

                  ),



                conversation_id:

                  status

                    .conversation

                    ?.id ||

                  null,



                conversation_category:

                  status

                    .conversation

                    ?.origin

                    ?.type ||

                  null,



                error_code:

                  firstError?.code ??

                  null,



                error_title:

                  firstError?.title ||

                  null,



                error_message:

                  firstError

                    ?.message ||

                  null,



                error_details:

                  firstError

                    ?.error_data

                    ?.details ||

                  null,



                meta_timestamp:

                  metaTimestamp(

                    status.timestamp,

                  ),



                updated_at:

                  new Date()

                    .toISOString(),

              },

            );

          }



          if (

            status.status ===

            "failed"

          ) {

            console.error(

              "WHATSAPP MESSAGE FAILED:",

              JSON.stringify(

                event,

                null,

                2,

              ),

            );

          } else {

            console.log(

              "WHATSAPP MESSAGE STATUS:",

              JSON.stringify(

                event,

                null,

                2,

              ),

            );

          }

        }



        /* ====================================================

           CUSTOMER INCOMING MESSAGE

        ==================================================== */



        for (

          const message of

          value?.messages || []

        ) {

          const incoming = {

            whatsappBusinessAccountId:

              entry.id || null,



            phoneNumberId:

              value?.metadata

                ?.phone_number_id ||

              null,



            messageId:

              message.id || null,



            from:

              maskPhone(

                message.from,

              ),



            timestamp:

              message.timestamp ||

              null,



            type:

              message.type ||

              null,



            text:

              whatsappIncomingMessageText(

                message,

              ) ||

              null,

          };



          incomingMessages.push(

            incoming,

          );



          console.log(

            "WHATSAPP INCOMING MESSAGE:",

            JSON.stringify(

              incoming,

              null,

              2,

            ),

          );



          /*

           * NEW CITY STYLE AUTO PRODUCT REPLY

           *

           * Every true first customer message — text, document, photo, video or audio — gets the premium NCS welcome.

           * Hi / Hello / Namaste and genuine business intents use zero cooldown.

           * Returning personal conversation remains silent for owner handoff.

           * Conversation memory + interactive SELECT / BOOK / STATUS / CANCEL controls are additive sales actions.

           * Duplicate webhook retries are still blocked by the Supabase claim RPC.

           */

          autoReplyJobs.push(

            autoReplyProducts(

              message,

              value || {},

            )

              .then(

                (result) => {

                  console.log(

                    "WHATSAPP PRODUCT AUTO REPLY:",

                    JSON.stringify(

                      {

                        customer:

                          maskPhone(

                            message.from,

                          ),

                        ...result,

                      },

                      null,

                      2,

                    ),

                  );



                  return result;

                },

              )

              .catch(

                (error) => {

                  const messageText =

                    error

                      instanceof Error

                      ? error.message

                      : String(

                          error,

                        );



                  console.error(

                    "WHATSAPP PRODUCT AUTO REPLY FAILED:",

                    messageText,

                  );



                  return {

                    sent: false,

                    error:

                      messageText,

                  };

                },

              ),

          );

        }



        /* ====================================================

           WEBHOOK LEVEL ERRORS

        ==================================================== */



        for (

          const error of

          value?.errors || []

        ) {

          console.error(

            "WHATSAPP WEBHOOK ERROR:",

            JSON.stringify(

              {

                code:

                  error.code ??

                  null,



                title:

                  error.title ||

                  null,



                message:

                  error.message ||

                  null,



                details:

                  error.error_data

                    ?.details ||

                  null,

              },

              null,

              2,

            ),

          );

        }

      }

    }



    /* ========================================================

       SAVE REAL DELIVERY STATE TO SUPABASE

       PRESERVED FOR LIVA / MESSAGE STATUS

    ======================================================== */



    if (

      deliveryRows.length >

      0

    ) {

      const admin =

        createWebhookSupabaseAdmin();



      if (!admin) {

        console.warn(

          "WhatsApp delivery DB logging skipped: Supabase service credentials are not configured.",

        );

      } else {

        const {

          error: logError,

        } =

          await admin

            .from(

              "whatsapp_message_logs",

            )

            .upsert(

              deliveryRows,

              {

                onConflict:

                  "message_id",

              },

            );



        if (logError) {

          console.error(

            "Unable to persist WhatsApp delivery status:",

            logError.message,

          );

        } else {

          console.log(

            `WhatsApp delivery status saved: ${deliveryRows.length} event(s).`,

          );

        }

      }

    }



    /*

     * Complete only the incoming-message auto reply jobs.

     * Each job sends up to three image messages concurrently.

     * Failure here is isolated and does not convert a valid Meta

     * delivery webhook into an HTTP error.

     */

    const autoReplyResults =

      await Promise.all(

        autoReplyJobs,

      );



    const autoProductRepliesSent =

      autoReplyResults.filter(

        (result) =>

          result.sent ===

          true,

      ).length;



    /*

     * Preserve HTTP 200 for processed Meta events.

     * A WhatsApp delivery failure or an auto-product reply

     * failure does NOT make the webhook request itself fail.

     */

    return NextResponse.json(

      {

        success: true,

        received: true,



        deliveryEventCount:

          deliveryEvents.length,



        incomingMessageCount:

          incomingMessages.length,



        deliveryRowsSaved:

          deliveryRows.length,



        autoProductReplyJobs:

          autoReplyResults.length,



        autoProductRepliesSent,

      },

      {

        status: 200,

      },

    );

  } catch (error) {

    console.error(

      "WhatsApp webhook processing error:",

      error,

    );



    return NextResponse.json(

      {

        success: false,



        error:

          error instanceof Error

            ? error.message

            : "Invalid WhatsApp webhook payload.",

      },

      {

        status: 400,

      },

    );

  }

}
