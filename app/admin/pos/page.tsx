"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import {
  cachePosProducts,
  countPendingOfflineSales,
  createOfflineClientTransactionId,
  createOfflineInvoiceNumber,
  getCachedPosProducts,
  getAllOfflineSales,
  isBrowserOnline,
  saveOfflineSale,
} from "@/lib/ncs-pos-offline";
import {
  installOfflineAutoSync,
  syncPendingOfflineSales,
} from "@/lib/ncs-pos-offline-sync";

type ProductRow = {
  id: number;
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  price?: number | string | null;
  mrp?: number | string | null;
  stock?: number | string | null;
  sku?: string | null;
  barcode?: string | null;
  image?: string | null;
  image_url?: string | null;
  images?: unknown;
  colors?: unknown;
  sizes?: unknown;
  tax_percent?: number | string | null;
  is_active?: boolean | null;
  status?: string | null;
};

type ProductVariantRow = {
  id: number;
  product_id: number;
  variant_name?: string | null;
  size?: string | null;
  color?: string | null;
  sku?: string | null;
  barcode?: string | null;
  purchase_price?: number | string | null;
  selling_price?: number | string | null;
  mrp?: number | string | null;
  stock?: number | string | null;
  reserved_stock?: number | string | null;
  low_stock_limit?: number | string | null;
  is_active?: boolean | null;
};

type PosProduct = {
  key: string;
  productId: number;
  variantId: number | null;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  price: number;
  mrp: number;
  stock: number;
  sku: string;
  barcode: string;
  imageUrl: string;
  size: string;
  color: string;
  taxPercent: number;
  purchasePrice?: number;
  purchasePriceKnown?: boolean;
  isQuickItem?: boolean;
  quickPurchasePrice?: number;
  quickSaveAsProduct?: boolean;
  quickRemainingStock?: number;
};

type CartItem = PosProduct & {
  quantity: number;
  discountPercent?: number;
};

type PosOwnerCostInfo = {
  itemKey: string;
  productName: string;
  size: string;
  color: string;
  purchasePrice: number;
  supplierName: string;
  supplierPhone: string;
  purchaseDate: string;
  purchaseNumber: string;
  supplierInvoiceNumber: string;
  source: string;
  quickItem: boolean;
};

type PosProductGroup = {
  groupKey: string;
  productId: number;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  imageUrl: string;
  totalStock: number;
  minPrice: number;
  maxPrice: number;
  variants: PosProduct[];
};

type ProductViewMode = "smart" | "brands" | "all";

type QuickItemForm = {
  name: string;
  category: string;
  quantity: number;
  mrp: number;
  purchasePrice: number;
  taxPercent: number;
  saveAsProduct: boolean;
  remainingStock: number;
};

const EMPTY_QUICK_ITEM_FORM: QuickItemForm = {
  name: "",
  category: "Others",
  quantity: 0,
  mrp: 0,
  purchasePrice: 0,
  taxPercent: 0,
  saveAsProduct: false,
  remainingStock: 0,
};

type PaymentMethod = "cash" | "upi" | "card" | "credit";

type HeldBill = {
  id: string;
  holdNumber: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  billDiscountPercent?: number;
  billDiscount?: number;
  roundOffAmount?: number;
  paymentMethod: PaymentMethod;
  creditPaidNow?: number;
  creditDueDate?: string;
  createdAt: string;
};

type CompleteSaleResult = {
  success?: boolean;
  duplicate?: boolean;
  sale_id?: string;
  invoice_number?: string;
  subtotal?: number;
  tax_amount?: number;
  bill_discount?: number;
  round_off?: number;
  total_amount?: number;
  paid_amount?: number;
  due_amount?: number;
  payment_method?: string;
  message?: string;
};

type CustomerRewardLookup = {
  customer_id: number;
  full_name?: string | null;
  phone?: string | null;
  reward_points?: number | string | null;
  total_reward_points_earned?: number | string | null;
  total_reward_points_redeemed?: number | string | null;
  total_orders?: number | string | null;
  total_spent?: number | string | null;
  whatsapp_opt_in?: boolean | null;
};

type RewardApplyResult = {
  success?: boolean;
  duplicate?: boolean;
  opening_balance?: number;
  points_used?: number;
  reward_discount?: number;
  points_earned?: number;
  closing_balance?: number;
};

type PosOverview = {
  todaySales: number;
  todayBills: number;
  todayCash: number;
  todayDigital: number;
  customerCredit: number;
  creditCustomers: number;
};

type PosExchangeSettlementOverview = {
  difference_amount?: number | string | null;
  settlement_direction?: string | null;
  settlement_method?: string | null;
  settlement_status?: string | null;
  created_at?: string | null;
};

type CompletedSale = {
  saleId: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  billDiscount: number;
  roundOff: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  rewardPointsUsed: number;
  rewardDiscount: number;
  rewardPointsEarned: number;
  rewardClosingBalance: number;
  completedAt: string;
};


type PosInvoiceStudioSettings = {
  active_tab: "thermal" | "a4" | "whatsapp";
  theme: "signature" | "minimal" | "counter";
  thermal_width: 58 | 80;
  copies: number;
  bold_text: boolean;
  auto_cut: boolean;
  cash_drawer: boolean;
  show_logo: boolean;
  show_address: boolean;
  show_phone: boolean;
  show_email: boolean;
  show_gstin: boolean;
  show_bank: boolean;
  show_upi_qr: boolean;
  show_signature: boolean;
  show_terms: boolean;
  footer_message: string;
  terms_text: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  upi_id: string;
};

const POS_INVOICE_STUDIO_FALLBACK: PosInvoiceStudioSettings = {
  active_tab: "thermal",
  theme: "signature",
  thermal_width: 80,
  copies: 1,
  bold_text: true,
  auto_cut: false,
  cash_drawer: false,
  show_logo: true,
  show_address: true,
  show_phone: true,
  show_email: true,
  show_gstin: false,
  show_bank: false,
  show_upi_qr: false,
  show_signature: false,
  show_terms: true,
  footer_message: "Thank you for shopping with NEW CITY STYLE.",
  terms_text: "Exchange subject to store policy. Please retain your bill.",
  bank_name: "",
  account_number: "",
  ifsc_code: "",
  upi_id: "",
};


const ROYAL_BLUE = "#0A2E73";
const DEEP_BLUE = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";
const CHARCOAL = "#2C2C2C";

const HELD_BILLS_STORAGE_KEY = "ncs_pos_held_bills_v1";
const POS_RECENT_PRODUCTS_KEY = "ncs_pos_recent_products_v1";
const POS_POPULAR_PRODUCTS_KEY = "ncs_pos_popular_products_v1";
const POS_OVERVIEW_CACHE_KEY = "ncs_pos_overview_cache_v1";

function toNumber(
  value: number | string | null | undefined,
  fallback = 0
) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : fallback;
}

function getProductName(product: ProductRow) {
  return (
    product.name?.trim() ||
    "NEW CITY STYLE Product"
  );
}

function getImageFromUnknown(value: unknown): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return "";
    }

    try {
      const parsedValue = JSON.parse(trimmedValue);

      return getImageFromUnknown(parsedValue);
    } catch {
      return trimmedValue;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const image = getImageFromUnknown(item);

      if (image) {
        return image;
      }
    }

    return "";
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    return (
      getImageFromUnknown(record.url) ||
      getImageFromUnknown(record.image_url) ||
      getImageFromUnknown(record.image) ||
      getImageFromUnknown(record.src)
    );
  }

  return "";
}

function getProductImage(product: ProductRow) {
  return (
    getImageFromUnknown(product.image_url) ||
    getImageFromUnknown(product.image) ||
    getImageFromUnknown(product.images)
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}
type PosAiIntent =
  | "add"
  | "show"
  | "remove"
  | "increase"
  | "decrease"
  | "undo";

type PosAiMatch = {
  product: PosProduct;
  score: number;
};

type PosAiCommand = {
  raw: string;
  normalized: string;
  intent: PosAiIntent;
  quantity: number;
  searchText: string;
  tokens: string[];
};

const POS_AI_ACTION_WORDS = new Set([
  "add",
  "put",
  "cart",
  "bill",
  "please",
  "pls",
  "qty",
  "quantity",
  "piece",
  "pieces",
  "pc",
  "pcs",
  "show",
  "find",
  "search",
  "remove",
  "delete",
  "minus",
  "increase",
  "decrease",
  "undo",
  "again",
  "item",
  "items",
  "size",
  "sizes",
  "colour",
  "colours",
  "color",
  "colors",
  "brand",
  "variant",
  "model",
  "discount",
  "percent",
  "percentage",
  "off",
  "stock",
  "available",
  "availability",
  "last",
  "customer",
  "payment",
  "cash",
  "upi",
  "card",
  "credit",
  "hold",
  "complete",
  "total",
  "how",
  "much",
  "entha",
  "ki",
  "set",
  "make",
  "change",
  "do",
  "సైజ్",
  "కలర్",
  "రంగు",
  "డిస్కౌంట్",
  "స్టాక్",
  "ఎంత",
  "కి",
  "చేయి",
  "సెట్",
  "కస్టమర్",
  "పేమెంట్",
  "బిల్",
  "మొత్తం",
  "పెట్టు",
  "వేయి",
  "యాడ్",
  "చూపు",
  "చూపించు",
  "వెతుకు",
  "తీసేయి",
  "తొలగించు",
  "తగ్గించు",
  "పెంచు",
  "మళ్ళీ",
  "మళ్లీ",
  "ఏవి",
]);

const POS_AI_QUANTITY_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  okati: 1,
  rendu: 2,
  moodu: 3,
  nalugu: 4,
  aidu: 5,
  aaru: 6,
  edu: 7,
  enimidi: 8,
  tommidi: 9,
  padi: 10,
  ఒకటి: 1,
  రెండు: 2,
  మూడు: 3,
  నాలుగు: 4,
  ఐదు: 5,
  ఆరు: 6,
  ఏడు: 7,
  ఎనిమిది: 8,
  తొమ్మిది: 9,
  పది: 10,
};

function normalizePosAiText(value: string) {
  return value
    .toLocaleLowerCase("en-IN")
    .replace(/[.,!?;:()[\]{}"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPosAiIntent(normalized: string): PosAiIntent {
  if (
    /\bundo\b/.test(normalized) ||
    normalized.includes("మళ్ళీ వెనక్కి") ||
    normalized.includes("మళ్లీ వెనక్కి")
  ) {
    return "undo";
  }

  if (
    /\b(remove|delete)\b/.test(normalized) ||
    normalized.includes("తీసేయి") ||
    normalized.includes("తొలగించు")
  ) {
    return "remove";
  }

  if (
    /\b(increase|plus)\b/.test(normalized) ||
    normalized.includes("పెంచు")
  ) {
    return "increase";
  }

  if (
    /\b(decrease|minus)\b/.test(normalized) ||
    normalized.includes("తగ్గించు")
  ) {
    return "decrease";
  }

  if (
    /\b(show|find|search)\b/.test(normalized) ||
    normalized.includes("చూపు") ||
    normalized.includes("చూపించు") ||
    normalized.includes("వెతుకు") ||
    normalized.includes("ఏవి")
  ) {
    return "show";
  }

  return "add";
}

function getPosAiQuantity(normalized: string) {
  const tokens = normalized.split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    const wordQuantity = POS_AI_QUANTITY_WORDS[token];
    if (wordQuantity) {
      return wordQuantity;
    }
  }

  const explicitQuantityMatch =
    normalized.match(/\b(\d{1,2})\s*(?:pcs?|pieces?|qty|quantity)\b/) ||
    normalized.match(/\b(?:qty|quantity)\s*(\d{1,2})\b/);

  if (explicitQuantityMatch) {
    return Math.max(
      1,
      Math.min(99, Number(explicitQuantityMatch[1]))
    );
  }

  const leadingQuantityMatch = normalized.match(
    /^(\d{1,2})\s+(?=[a-z\u0C00-\u0C7F])/
  );

  if (leadingQuantityMatch) {
    return Math.max(
      1,
      Math.min(99, Number(leadingQuantityMatch[1]))
    );
  }

  return 1;
}

function buildPosAiCommand(rawCommand: string): PosAiCommand {
  const normalized = normalizePosAiText(rawCommand);
  const intent = getPosAiIntent(normalized);
  const quantity = getPosAiQuantity(normalized);

  const rawTokens = normalized
    .split(/\s+/)
    .filter(Boolean);

  const tokens = rawTokens.filter((token, index) => {
    if (POS_AI_ACTION_WORDS.has(token)) {
      return false;
    }

    if (POS_AI_QUANTITY_WORDS[token]) {
      return false;
    }

    if (
      /^\d{1,2}$/.test(token) &&
      index === 0 &&
      Number(token) === quantity
    ) {
      return false;
    }

    if (
      /^\d{1,2}$/.test(token) &&
      ["pc", "pcs", "piece", "pieces", "qty", "quantity"].includes(
        rawTokens[index + 1] || ""
      )
    ) {
      return false;
    }

    return true;
  });

  return {
    raw: rawCommand,
    normalized,
    intent,
    quantity,
    searchText: tokens.join(" "),
    tokens,
  };
}

function posAiLevenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from(
    { length: b.length + 1 },
    (_, index) => index
  );

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] +
          (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }

    for (let j = 0; j < current.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function getPosAiTokenScore(
  queryToken: string,
  candidateToken: string
) {
  if (!queryToken || !candidateToken) {
    return 0;
  }

  if (queryToken === candidateToken) {
    return 12;
  }

  // Variant sizes such as S / M / L must never behave like fuzzy prefixes.
  // A one- or two-character command token only matches the exact same token.
  if (queryToken.length <= 2 || candidateToken.length <= 2) {
    return 0;
  }

  if (
    candidateToken.startsWith(queryToken) ||
    queryToken.startsWith(candidateToken)
  ) {
    return 9;
  }

  if (
    candidateToken.includes(queryToken) ||
    queryToken.includes(candidateToken)
  ) {
    return 7;
  }

  if (
    queryToken.length >= 4 &&
    candidateToken.length >= 4
  ) {
    const distance = posAiLevenshtein(
      queryToken,
      candidateToken
    );

    if (distance === 1) {
      return 6;
    }

    if (
      distance === 2 &&
      Math.max(queryToken.length, candidateToken.length) >= 6
    ) {
      return 3;
    }
  }

  return 0;
}

function normalizePosAiVariantValue(value: string | null | undefined) {
  return normalizePosAiText(value || "")
    .replace(/\s+/g, "")
    .trim();
}

function getPosAiExplicitSize(command: PosAiCommand) {
  const normalized = command.normalized;

  const labelledMatch =
    normalized.match(/\bsize\s+([a-z0-9]+)\b/) ||
    normalized.match(/\b([a-z0-9]+)\s+size\b/) ||
    normalized.match(/సైజ్\s+([a-z0-9]+)/) ||
    normalized.match(/([a-z0-9]+)\s+సైజ్/);

  if (labelledMatch?.[1]) {
    return normalizePosAiVariantValue(labelledMatch[1]);
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const standardSize = tokens.find((token) =>
    /^(?:xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|4xl|5xl|6xl)$/i.test(token)
  );

  if (standardSize) {
    return normalizePosAiVariantValue(standardSize);
  }

  // Numeric apparel/innerwear sizes are treated as strict size constraints
  // when a variant actually has a size value.
  const numericSize = tokens.find((token) => {
    if (!/^\d{2,3}$/.test(token)) return false;
    const numericValue = Number(token);
    return numericValue >= 24 && numericValue <= 120;
  });

  return numericSize
    ? normalizePosAiVariantValue(numericSize)
    : "";
}

function getPosAiExplicitColor(
  product: PosProduct,
  command: PosAiCommand
) {
  const productColor = normalizePosAiVariantValue(product.color);

  if (!productColor) {
    return "";
  }

  const colorTokens = normalizePosAiText(product.color)
    .split(/\s+/)
    .filter(Boolean);

  const commandTokens = command.normalized
    .split(/\s+/)
    .filter(Boolean);

  const exactColorMentioned = colorTokens.every((colorToken) =>
    commandTokens.includes(colorToken)
  );

  return exactColorMentioned ? productColor : "";
}

function productMatchesPosAiVariantConstraints(
  product: PosProduct,
  command: PosAiCommand
) {
  const explicitSize = getPosAiExplicitSize(command);
  const productSize = normalizePosAiVariantValue(product.size);

  if (explicitSize && productSize && productSize !== explicitSize) {
    return false;
  }

  if (explicitSize && !productSize) {
    return false;
  }

  // If the command explicitly contains this product's colour wording,
  // require that exact colour. This stays dynamic for all current/future colours.
  const explicitColor = getPosAiExplicitColor(product, command);

  if (explicitColor) {
    const productColor = normalizePosAiVariantValue(product.color);

    if (productColor !== explicitColor) {
      return false;
    }
  }

  return true;
}

function getPosAiProductScore(
  product: PosProduct,
  command: PosAiCommand
) {
  if (getAvailableStock(product) <= 0) {
    return -1;
  }

  if (!productMatchesPosAiVariantConstraints(product, command)) {
    return 0;
  }

  const fullQuery = command.searchText;

  const barcode = normalizeText(product.barcode);
  const sku = normalizeText(product.sku);
  const shortCode = normalizeText(getPosShortCode(product));
  const parentCode = normalizeText(
    getParentShortCode(product.productId)
  );

  if (
    fullQuery &&
    [barcode, sku, shortCode, parentCode].includes(fullQuery)
  ) {
    return 1000;
  }

  const fields = [
    { value: product.brand, weight: 28 },
    { value: product.name, weight: 32 },
    { value: product.size, weight: 34 },
    { value: product.color, weight: 24 },
    { value: product.category, weight: 12 },
    { value: product.subcategory, weight: 12 },
    { value: product.sku, weight: 36 },
    { value: product.barcode, weight: 40 },
    { value: getPosShortCode(product), weight: 40 },
    { value: getParentShortCode(product.productId), weight: 30 },
  ];

  let score = 0;
  let matchedTokens = 0;

  const explicitSize = getPosAiExplicitSize(command);

  for (const queryToken of command.tokens) {
    if (
      explicitSize &&
      normalizePosAiVariantValue(queryToken) === explicitSize
    ) {
      // Size has already been validated exactly above.
      score += 70;
      matchedTokens += 1;
      continue;
    }

    let bestTokenScore = 0;
    let bestWeight = 0;

    for (const field of fields) {
      const fieldTokens = normalizePosAiText(field.value || "")
        .split(/\s+/)
        .filter(Boolean);

      for (const candidateToken of fieldTokens) {
        const tokenScore = getPosAiTokenScore(
          queryToken,
          candidateToken
        );

        if (tokenScore > bestTokenScore) {
          bestTokenScore = tokenScore;
          bestWeight = field.weight;
        }
      }
    }

    if (bestTokenScore > 0) {
      matchedTokens += 1;
      score += bestTokenScore + bestWeight;
    }
  }

  if (command.tokens.length === 0) {
    return 0;
  }

  // Every meaningful command token must match the same product.
  // This prevents a size such as "75" from flooding AI results with
  // unrelated products when the brand/name token did not match.
  if (matchedTokens !== command.tokens.length) {
    return 0;
  }

  if (
    fullQuery &&
    normalizePosAiText(
      [
        product.brand,
        product.name,
        product.size,
        product.color,
      ].join(" ")
    ).includes(fullQuery)
  ) {
    score += 35;
  }

  return score;
}

function findPosAiMatches(
  products: PosProduct[],
  command: PosAiCommand
): PosAiMatch[] {
  const normalizedCommand = ` ${command.normalized} `;

  const mentionedColors = Array.from(
    new Set(
      products
        .map((product) => normalizePosAiText(product.color || ""))
        .filter(Boolean)
        .filter((color) => {
          const colorPhrase = ` ${color} `;
          if (normalizedCommand.includes(colorPhrase)) return true;

          const colorTokens = color.split(/\s+/).filter(Boolean);
          return colorTokens.length > 0 &&
            colorTokens.every((token) =>
              command.tokens.includes(token)
            );
        })
    )
  );

  return products
    .filter((product) => {
      if (mentionedColors.length === 0) return true;
      const productColor = normalizePosAiText(product.color || "");
      return mentionedColors.includes(productColor);
    })
    .map((product) => ({
      product,
      score: getPosAiProductScore(product, command),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (
        getAvailableStock(b.product) -
        getAvailableStock(a.product)
      );
    });
}


function splitPosAiMultiCommands(rawCommand: string) {
  const parts = rawCommand
    .split(/\s*(?:,|;|\n|\bthen\b|తర్వాత)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    return parts;
  }

  const andParts = rawCommand
    .split(/\s+(?:and|మరియు)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (
    andParts.length > 1 &&
    andParts.every((part) =>
      /\b(add|put|remove|delete|increase|decrease)\b|పెట్టు|వేయి|యాడ్|తీసేయి|తొలగించు|పెంచు|తగ్గించు/i.test(part)
    )
  ) {
    return andParts;
  }

  return [rawCommand.trim()].filter(Boolean);
}

function getPosAiPercentage(rawCommand: string) {
  const normalized = normalizePosAiText(rawCommand);
  const match =
    normalized.match(/(\d{1,3}(?:\.\d+)?)\s*%/) ||
    normalized.match(/(\d{1,3}(?:\.\d+)?)\s*(?:percent|percentage)/) ||
    normalized.match(/(?:discount|డిస్కౌంట్)\s*(\d{1,3}(?:\.\d+)?)/);

  if (!match) return null;

  return Math.min(100, Math.max(0, Number(match[1])));
}

function getPosAiAssignedQuantity(rawCommand: string) {
  const normalized = normalizePosAiText(rawCommand);
  const match =
    normalized.match(/\b(?:qty|quantity)\s*(\d{1,2})\b/) ||
    normalized.match(/\b(\d{1,2})\s*(?:qty|quantity)\b/);

  if (!match) return null;

  return Math.max(0, Math.min(99, Number(match[1])));
}

function stripPosAiModifierWords(rawCommand: string) {
  return rawCommand
    .replace(/\b\d{1,3}(?:\.\d+)?\s*%/gi, " ")
    .replace(/\b(?:discount|percent|percentage|off|stock|available|availability|qty|quantity|set|make|change|do|last|item|customer|payment|hold|complete|total|how|much|entha|ki)\b/gi, " ")
    .replace(/డిస్కౌంట్|స్టాక్|ఎంత|కి|చేయి|సెట్|కస్టమర్|పేమెంట్|బిల్|మొత్తం/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDisplayText(
  value: string | null | undefined,
  fallback: string
) {
  const cleaned = (value || "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || fallback;
}

function normalizeBrandKey(value: string | null | undefined) {
  return cleanDisplayText(value, "NEW CITY STYLE").toLocaleLowerCase("en-IN");
}

function formatBrandName(value: string | null | undefined) {
  const cleaned = cleanDisplayText(value, "NEW CITY STYLE");

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const upperWord = word.toUpperCase();

      if (
        upperWord === "NCS" ||
        upperWord === "NEW" ||
        upperWord === "CITY" ||
        upperWord === "STYLE"
      ) {
        return upperWord;
      }

      return upperWord;
    })
    .join(" ");
}

function getPosShortCode(product: PosProduct) {
  if (product.variantId) {
    return `V${product.variantId}`;
  }

  return `P${product.productId}`;
}

function getParentShortCode(productId: number) {
  return `P${productId}`;
}

function getAvailableStock(product: PosProduct) {
  if (product.isQuickItem) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.max(0, product.stock);
}

function getDefaultCreditDueDate() {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  return dueDate.toISOString().slice(0, 10);
}

function createHoldNumber() {
  const now = new Date();

  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const timePart = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  return `HOLD-${datePart}-${timePart}`;
}

function GroupedProductCard({
  group,
  expanded,
  onToggle,
  onAddVariant,
}: {
  group: PosProductGroup;
  expanded: boolean;
  onToggle: () => void;
  onAddVariant: (product: PosProduct) => void;
}) {
  const priceLabel =
    group.minPrice === group.maxPrice
      ? formatCurrency(group.minPrice)
      : `${formatCurrency(group.minPrice)} – ${formatCurrency(group.maxPrice)}`;

  return (
    <article className={`ncsPosGroupedCard ${expanded ? "open" : ""}`}>
      <button
        type="button"
        className="ncsPosGroupedCardMain"
        onClick={onToggle}
      >
        <div className="ncsPosGroupedImage">
          {group.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.imageUrl} alt={group.name} />
          ) : (
            <span>NCS</span>
          )}

          <em>{group.totalStock} stock</em>
        </div>

        <div className="ncsPosGroupedInfo">
          <small>{group.category}</small>
          <h3>{group.name}</h3>
          <p>{group.brand}</p>

          <div>
            <strong>{priceLabel}</strong>
            <span>{group.variants.length} option(s)</span>
          </div>

          <code>{getParentShortCode(group.productId)}</code>
        </div>

        <b className="ncsPosGroupedToggle">
          {expanded ? "−" : "+"}
        </b>
      </button>

      {expanded && (
        <div className="ncsPosVariantPanel">
          <header>
            <div>
              <span>SELECT SIZE / COLOUR</span>
              <strong>{group.name}</strong>
            </div>
            <small>{group.totalStock} available</small>
          </header>

          <div className="ncsPosVariantList">
            {group.variants.map((variant) => {
              const outOfStock = getAvailableStock(variant) <= 0;

              return (
                <button
                  key={variant.key}
                  type="button"
                  className={outOfStock ? "out" : ""}
                  disabled={outOfStock}
                  onClick={() => onAddVariant(variant)}
                >
                  <div>
                    <strong>
                      {[variant.size, variant.color]
                        .filter(Boolean)
                        .join(" • ") || "Standard"}
                    </strong>
                    <small>
                      {variant.barcode || variant.sku || getPosShortCode(variant)}
                    </small>
                  </div>
                  <span>
                    <b>{formatCurrency(variant.price)}</b>
                    <small>
                      {outOfStock ? "Out" : `${variant.stock} stock`}
                    </small>
                  </span>
                  <em>{outOfStock ? "×" : "+"}</em>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

export default function PosPage() {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const quickItemNameInputRef = useRef<HTMLInputElement | null>(null);
  const saleSubmissionLockRef = useRef(false);

  const [products, setProducts] = useState<PosProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [posOverview, setPosOverview] = useState<PosOverview>({
    todaySales: 0,
    todayBills: 0,
    todayCash: 0,
    todayDigital: 0,
    customerCredit: 0,
    creditCustomers: 0,
  });
  const [loadingOverview, setLoadingOverview] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
const [selectedCategory, setSelectedCategory] =
  useState("All");

const [posAiCommand, setPosAiCommand] = useState("");
const [posAiMatches, setPosAiMatches] = useState<PosAiMatch[]>([]);
const [posAiExpanded, setPosAiExpanded] = useState(false);
const [posAiLastProductKey, setPosAiLastProductKey] =
  useState<string | null>(null);
const [posAiLastAction, setPosAiLastAction] = useState<{
  productKey: string;
  previousQuantity: number;
} | null>(null);

  const [productViewMode, setProductViewMode] =
    useState<ProductViewMode>("brands");
  const [expandedBrand, setExpandedBrand] =
    useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] =
    useState<number | null>(null);
  const [recentProductKeys, setRecentProductKeys] =
    useState<string[]>([]);
  const [popularProductCounts, setPopularProductCounts] =
    useState<Record<string, number>>({});

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [billDiscountPercent, setBillDiscountPercent] = useState(0);

  const [roundOffAmount, setRoundOffAmount] = useState(0);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerWhatsAppOptIn, setCustomerWhatsAppOptIn] =
    useState(false);

  const [rewardCustomerId, setRewardCustomerId] =
    useState<number | null>(null);
  const [availableRewardPoints, setAvailableRewardPoints] =
    useState(0);
  const [rewardPointsToUse, setRewardPointsToUse] =
    useState(0);
  const [rewardLookupLoading, setRewardLookupLoading] =
    useState(false);
  const [rewardCustomerFound, setRewardCustomerFound] =
    useState(false);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");

  const [creditPaidNow, setCreditPaidNow] = useState(0);
  const [creditDueDate, setCreditDueDate] = useState(
    getDefaultCreditDueDate()
  );

  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [showHeldBills, setShowHeldBills] = useState(false);

  const [ownerCostInfo, setOwnerCostInfo] =
    useState<PosOwnerCostInfo | null>(null);
  const [loadingOwnerCostKey, setLoadingOwnerCostKey] =
    useState<string | null>(null);

  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<
    "success" | "error" | "info"
  >("info");

  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [isCompletingSale, setIsCompletingSale] = useState(false);
  const [completedSale, setCompletedSale] =
    useState<CompletedSale | null>(null);

  const [invoiceStudioSettings, setInvoiceStudioSettings] =
    useState<PosInvoiceStudioSettings>(
      POS_INVOICE_STUDIO_FALLBACK
    );
  const [invoiceStudioLoaded, setInvoiceStudioLoaded] =
    useState(false);

  const [isOnline, setIsOnline] = useState(true);
  const [pendingOfflineBills, setPendingOfflineBills] = useState(0);
  const [syncingOfflineBills, setSyncingOfflineBills] = useState(false);

  const [showQuickItem, setShowQuickItem] = useState(false);
  const [quickItemForm, setQuickItemForm] =
    useState<QuickItemForm>(EMPTY_QUICK_ITEM_FORM);

  useEffect(() => {
    let mounted = true;

    async function loadInvoiceStudioSettings() {
      try {
        const { data, error } = await supabase
          .from("ncs_invoice_settings")
          .select("*")
          .eq("id", "default")
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.info(
            "Invoice Studio settings unavailable; using POS defaults:",
            error
          );
          setInvoiceStudioLoaded(true);
          return;
        }

        if (data) {
          setInvoiceStudioSettings({
            ...POS_INVOICE_STUDIO_FALLBACK,
            ...(data as Partial<PosInvoiceStudioSettings>),
            thermal_width:
              Number(data.thermal_width) === 58 ? 58 : 80,
            copies: Math.min(
              3,
              Math.max(1, Number(data.copies || 1))
            ),
          });
        }

        setInvoiceStudioLoaded(true);
      } catch (error) {
        console.info(
          "Unable to load Invoice Studio settings:",
          error
        );

        if (mounted) {
          setInvoiceStudioLoaded(true);
        }
      }
    }

    void loadInvoiceStudioSettings();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!expandedBrand) return;

    const handleBrandModalKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpandedProductId(null);
        setExpandedBrand(null);
      }
    };

    window.addEventListener("keydown", handleBrandModalKeyDown);

    return () => {
      window.removeEventListener("keydown", handleBrandModalKeyDown);
    };
  }, [expandedBrand]);

  const showNotice = useCallback(
    (
      message: string,
      type: "success" | "error" | "info" = "info"
    ) => {
      setNotice(message);
      setNoticeType(type);

      window.setTimeout(() => {
        setNotice("");
      }, 3200);
    },
    []
  );

  useEffect(() => {
    const refreshPendingCount = async () => {
      try {
        setPendingOfflineBills(
          await countPendingOfflineSales(),
        );
      } catch (error) {
        console.info(
          "Unable to read pending offline bills:",
          error,
        );
      }
    };

    const updateNetworkState = () => {
      setIsOnline(isBrowserOnline());
      void refreshPendingCount();
    };

    updateNetworkState();

    window.addEventListener("online", updateNetworkState);
    window.addEventListener("offline", updateNetworkState);

    const uninstallAutoSync = installOfflineAutoSync({
      onStart: (pendingCount) => {
        if (pendingCount > 0) {
          setSyncingOfflineBills(true);
        }
      },
      onComplete: (summary) => {
        setSyncingOfflineBills(false);
        void refreshPendingCount();

        if (summary.synced > 0) {
          showNotice(
            `${summary.synced} offline bill(s) synced successfully.`,
            summary.failed > 0 ? "info" : "success",
          );
          void loadProducts();
          void loadPosOverview();
        }
      },
    });

    return () => {
      window.removeEventListener("online", updateNetworkState);
      window.removeEventListener("offline", updateNetworkState);
      uninstallAutoSync();
    };
  }, [showNotice]);

  async function syncOfflineBillsNow() {
    if (!isBrowserOnline()) {
      showNotice(
        "Internet is not available. Bills remain safely stored offline.",
        "info",
      );
      return;
    }

    setSyncingOfflineBills(true);

    try {
      const summary = await syncPendingOfflineSales();
      setPendingOfflineBills(
        await countPendingOfflineSales(),
      );

      if (summary.total === 0) {
        showNotice("No pending offline bills.", "info");
      } else if (summary.failed > 0) {
        showNotice(
          `${summary.synced} synced, ${summary.failed} failed. They will retry automatically.`,
          "info",
        );
      } else {
        showNotice(
          `${summary.synced} offline bill(s) synced successfully.`,
          "success",
        );
      }

      await Promise.all([loadProducts(), loadPosOverview()]);
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Unable to sync offline bills.",
        "error",
      );
    } finally {
      setSyncingOfflineBills(false);
    }
  }

  const loadPosOverview = useCallback(async () => {
    setLoadingOverview(true);

    const readCachedOverview = (): PosOverview => {
      try {
        const raw = window.localStorage.getItem(
          POS_OVERVIEW_CACHE_KEY,
        );

        if (!raw) {
          return {
            todaySales: 0,
            todayBills: 0,
            todayCash: 0,
            todayDigital: 0,
            customerCredit: 0,
            creditCustomers: 0,
          };
        }

        const parsed = JSON.parse(raw) as Partial<PosOverview>;

        return {
          todaySales: Math.max(0, toNumber(parsed.todaySales)),
          todayBills: Math.max(0, Math.trunc(toNumber(parsed.todayBills))),
          todayCash: Math.max(0, toNumber(parsed.todayCash)),
          todayDigital: Math.max(0, toNumber(parsed.todayDigital)),
          customerCredit: Math.max(0, toNumber(parsed.customerCredit)),
          creditCustomers: Math.max(
            0,
            Math.trunc(toNumber(parsed.creditCustomers)),
          ),
        };
      } catch {
        return {
          todaySales: 0,
          todayBills: 0,
          todayCash: 0,
          todayDigital: 0,
          customerCredit: 0,
          creditCustomers: 0,
        };
      }
    };

    const writeCachedOverview = (overview: PosOverview) => {
      try {
        window.localStorage.setItem(
          POS_OVERVIEW_CACHE_KEY,
          JSON.stringify(overview),
        );
      } catch (error) {
        console.info("Unable to cache POS overview:", error);
      }
    };

    try {
      const now = new Date();
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0,
      );
      const endOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        0,
      );

      const cached = readCachedOverview();

      let baseOverview: PosOverview = {
        ...cached,
      };

      let salesLoadedFromCloud = false;
      let creditLoadedFromCloud = false;
      const cloudCreditPhones = new Set<string>();

      if (isBrowserOnline()) {
        const [
          salesResponse,
          creditResponse,
          exchangeResponse,
        ] = await Promise.all([
          supabase
            .from("pos_sales")
            .select(
              "total_amount,paid_amount,due_amount,payment_method,sale_status,is_deleted,created_at",
            )
            .eq("is_deleted", false)
            .gte("created_at", startOfDay.toISOString())
            .lt("created_at", endOfDay.toISOString()),

          supabase
            .from("customer_credit_accounts")
            .select("current_balance,is_active,customer_phone")
            .eq("is_active", true),

          supabase
            .from("pos_exchange_settlements")
            .select(
              "difference_amount,settlement_direction,settlement_method,settlement_status,created_at",
            )
            .gte("created_at", startOfDay.toISOString())
            .lt("created_at", endOfDay.toISOString()),
        ]);

        if (!salesResponse.error) {
          let todaySales = 0;
          let todayBills = 0;
          let todayCash = 0;
          let todayDigital = 0;

          const saleRows = (salesResponse.data || []) as Array<{
            total_amount?: number | string | null;
            paid_amount?: number | string | null;
            due_amount?: number | string | null;
            payment_method?: string | null;
            sale_status?: string | null;
            is_deleted?: boolean | null;
          }>;

          const completedSaleRows = saleRows.filter((sale) => {
            if (sale.is_deleted === true) {
              return false;
            }

            const status = normalizeText(
              sale.sale_status || "completed",
            );

            return ![
              "cancelled",
              "void",
              "refunded",
              "deleted",
            ].includes(status);
          });

          todayBills = completedSaleRows.length;

          completedSaleRows.forEach((sale) => {
            const total = Math.max(
              0,
              toNumber(sale.total_amount),
            );
            const paid = Math.max(
              0,
              toNumber(sale.paid_amount, total),
            );
            const method = normalizeText(
              sale.payment_method,
            );

            todaySales += total;

            if (method === "cash") {
              todayCash += paid;
            } else if (
              method === "upi" ||
              method === "card" ||
              method === "bank" ||
              method === "bank_transfer"
            ) {
              todayDigital += paid;
            }
          });

          if (!exchangeResponse.error) {
            const exchangeRows =
              (exchangeResponse.data || []) as
                PosExchangeSettlementOverview[];

            exchangeRows.forEach((row) => {
              const status = normalizeText(
                row.settlement_status || "completed",
              );

              if (
                ["cancelled", "void", "deleted"].includes(
                  status,
                )
              ) {
                return;
              }

              const difference = Math.max(
                0,
                toNumber(row.difference_amount),
              );

              const direction = normalizeText(
                row.settlement_direction,
              );

              const method = normalizeText(
                row.settlement_method,
              );

              if (direction === "collect") {
                todaySales += difference;
                todayBills += 1;

                if (method === "cash") {
                  todayCash += difference;
                } else if (
                  method === "upi" ||
                  method === "card" ||
                  method === "bank" ||
                  method === "bank_transfer"
                ) {
                  todayDigital += difference;
                }
              } else if (direction === "refund") {
                todaySales = Math.max(
                  0,
                  todaySales - difference,
                );
                todayBills += 1;

                if (method === "cash") {
                  todayCash = Math.max(
                    0,
                    todayCash - difference,
                  );
                } else if (
                  method === "upi" ||
                  method === "card" ||
                  method === "bank" ||
                  method === "bank_transfer"
                ) {
                  todayDigital = Math.max(
                    0,
                    todayDigital - difference,
                  );
                }
              } else if (direction === "even") {
                todayBills += 1;
              }
            });
          } else {
            console.info(
              "Exchange overview unavailable:",
              exchangeResponse.error.message,
            );
          }

          baseOverview = {
            ...baseOverview,
            todaySales,
            todayBills,
            todayCash,
            todayDigital,
          };
          salesLoadedFromCloud = true;
        } else {
          console.info(
            "Today sales overview is using the last saved value:",
            salesResponse.error.message,
          );
        }

        if (!creditResponse.error) {
          let customerCredit = 0;
          let creditCustomers = 0;

          const creditRows = (creditResponse.data || []) as Array<{
            current_balance?: number | string | null;
            is_active?: boolean | null;
            customer_phone?: string | null;
          }>;

          creditRows.forEach((account) => {
            const balance = Math.max(
              0,
              toNumber(account.current_balance),
            );

            if (balance > 0) {
              customerCredit += balance;
              creditCustomers += 1;

              const phone = (account.customer_phone || "")
                .replace(/\D/g, "")
                .slice(-10);

              if (phone) {
                cloudCreditPhones.add(phone);
              }
            }
          });

          baseOverview = {
            ...baseOverview,
            customerCredit,
            creditCustomers,
          };
          creditLoadedFromCloud = true;
        } else {
          console.info(
            "Customer credit overview is using the last saved value:",
            creditResponse.error.message,
          );
        }

        if (salesLoadedFromCloud || creditLoadedFromCloud) {
          writeCachedOverview(baseOverview);
        }

        if (salesLoadedFromCloud) {
          try {
            window.localStorage.setItem(
              POS_OVERVIEW_CACHE_KEY,
              JSON.stringify(baseOverview),
            );
          } catch (error) {
            console.info(
              "Unable to refresh the POS overview cache:",
              error,
            );
          }
        }
      }

      let finalOverview: PosOverview = {
        ...baseOverview,
      };

      const offlineSales = await getAllOfflineSales();
      const offlineCreditPhones = new Set<string>();

      offlineSales
        .filter((sale) => {
          if (
            !["PENDING", "ERROR", "SYNCING"].includes(
              sale.syncStatus,
            )
          ) {
            return false;
          }

          const createdAt = new Date(sale.createdAt);

          return (
            createdAt >= startOfDay &&
            createdAt < endOfDay
          );
        })
        .forEach((sale) => {
          const total = Math.max(
            0,
            toNumber(sale.finalPayable),
          );
          const paid = Math.max(
            0,
            toNumber(sale.paidAmount),
          );

          finalOverview.todaySales += total;
          finalOverview.todayBills += 1;

          if (sale.paymentMethod === "cash") {
            finalOverview.todayCash += paid;
          } else if (
            sale.paymentMethod === "upi" ||
            sale.paymentMethod === "card"
          ) {
            finalOverview.todayDigital += paid;
          }

          if (
            sale.paymentMethod === "credit" &&
            sale.dueAmount > 0
          ) {
            finalOverview.customerCredit += Math.max(
              0,
              toNumber(sale.dueAmount),
            );

            const phone = sale.customerPhone
              .replace(/\D/g, "")
              .slice(-10);

            if (phone) {
              offlineCreditPhones.add(phone);
            }
          }
        });

      offlineCreditPhones.forEach((phone) => {
        if (!cloudCreditPhones.has(phone)) {
          finalOverview.creditCustomers += 1;
        }
      });

      setPosOverview(finalOverview);
    } catch (error) {
      console.info(
        "POS overview is using saved offline values:",
        error,
      );

      setPosOverview(readCachedOverview());
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    void loadPosOverview();
  }, [loadPosOverview]);

  const loadHeldBills = useCallback(() => {
    try {
      const savedValue = window.localStorage.getItem(
        HELD_BILLS_STORAGE_KEY
      );

      if (!savedValue) {
        setHeldBills([]);
        return;
      }

      const parsedValue = JSON.parse(savedValue) as HeldBill[];

      setHeldBills(
        Array.isArray(parsedValue)
          ? parsedValue
          : []
      );
    } catch (error) {
      console.error("Unable to load held bills:", error);
      setHeldBills([]);
    }
  }, []);

  useEffect(() => {
    loadHeldBills();
  }, [loadHeldBills]);

  useEffect(() => {
    try {
      const recentValue = window.localStorage.getItem(
        POS_RECENT_PRODUCTS_KEY
      );
      const popularValue = window.localStorage.getItem(
        POS_POPULAR_PRODUCTS_KEY
      );

      setRecentProductKeys(
        recentValue
          ? (JSON.parse(recentValue) as string[])
          : []
      );
      setPopularProductCounts(
        popularValue
          ? (JSON.parse(popularValue) as Record<string, number>)
          : {}
      );
    } catch (error) {
      console.info("Unable to load POS product history:", error);
      setRecentProductKeys([]);
      setPopularProductCounts({});
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setLoadError("");

    /*
     * IMPORTANT:
     * When the browser is offline, do not wait for Supabase to fail.
     * Load the saved IndexedDB product catalogue immediately.
     */
    if (!isBrowserOnline()) {
      setIsOnline(false);

      try {
        const cachedProducts = await getCachedPosProducts();

        if (cachedProducts.length > 0) {
          setProducts(
            cachedProducts.map(
              ({ cachedAt: _cachedAt, ...item }) => item,
            ),
          );
          setLoadError("");
          showNotice(
            `OFFLINE MODE: ${cachedProducts.length} cached product variant(s) loaded.`,
            "info",
          );
        } else {
          setProducts([]);
          setLoadError(
            "Offline product cache is empty. Connect to the internet, open POS once, and press Refresh Stock.",
          );
        }
      } catch (cacheError) {
        console.error(
          "Unable to load offline product cache:",
          cacheError,
        );
        setProducts([]);
        setLoadError(
          "Unable to open the saved offline product catalogue.",
        );
      } finally {
        setLoadingProducts(false);
      }

      return;
    }

    try {
      const { data: productRows, error: productsError } =
        await supabase
          .from("products")
          .select(
            [
              "id",
              "name",
              "category",
              "subcategory",
              "brand",
              "price",
              "mrp",
              "stock",
              "sku",
              "barcode",
              "image",
              "image_url",
              "images",
              "colors",
              "sizes",
              "tax_percent",
              "is_active",
              "status",
            ].join(",")
          )
          .order("created_at", {
            ascending: false,
          });

      if (productsError) {
        throw productsError;
      }

      const safeProductRows =
  (productRows || []) as unknown as ProductRow[];

      let variantRows: ProductVariantRow[] = [];

const { data: variantsData, error: variantsError } =
  await supabase
    .from("product_variants")
    .select(
      [
        "id",
        "product_id",
        "variant_name",
        "size",
        "color",
        "sku",
        "barcode",
        "purchase_price",
        "selling_price",
        "mrp",
        "stock",
        "reserved_stock",
        "low_stock_limit",
        "is_active",
      ].join(",")
    )
    .eq("is_active", true);

if (!variantsError) {
  variantRows =
    (variantsData || []) as unknown as ProductVariantRow[];
} else {
  console.info(
    "Product variants are not available yet:",
    variantsError.message
  );
}

      const variantsByProductId = new Map<
        number,
        ProductVariantRow[]
      >();

      variantRows.forEach((variant) => {
        const existingVariants =
          variantsByProductId.get(variant.product_id) || [];

        existingVariants.push(variant);
        variantsByProductId.set(
          variant.product_id,
          existingVariants
        );
      });

      const mappedProducts: PosProduct[] = [];

      safeProductRows.forEach((product) => {
        const productIsInactive =
          product.is_active === false ||
          normalizeText(product.status) === "inactive";

        if (productIsInactive) {
          return;
        }

        const productId = Number(product.id);
        const productVariants =
          variantsByProductId.get(productId) || [];

        const commonData = {
          productId,
          name: cleanDisplayText(
            getProductName(product),
            "NEW CITY STYLE Product"
          ),
          category: cleanDisplayText(
            product.category,
            "Others"
          ),
          subcategory: cleanDisplayText(
            product.subcategory,
            ""
          ),
          brand: formatBrandName(product.brand),
          imageUrl: getProductImage(product),
          taxPercent: Math.max(
            0,
            toNumber(product.tax_percent)
          ),
        };

        if (productVariants.length > 0) {
          productVariants.forEach((variant) => {
            const sellingPrice =
              toNumber(variant.selling_price) ||
              toNumber(product.price);

            const localMrp =
              toNumber(variant.mrp) ||
              toNumber(product.mrp) ||
              sellingPrice;

            const variantStock = Math.max(
              0,
              toNumber(variant.stock) -
                toNumber(variant.reserved_stock)
            );

            mappedProducts.push({
              ...commonData,
              key: `variant-${variant.id}`,
              variantId: variant.id,
              // Local POS always starts from MRP. The cashier applies
              // the customer discount at billing time.
              price: localMrp,
              mrp: localMrp,
              stock: variantStock,
              sku:
                variant.sku?.trim() ||
                product.sku?.trim() ||
                "",
              barcode:
                variant.barcode?.trim() ||
                product.barcode?.trim() ||
                "",
              size: variant.size?.trim() || "",
              color: variant.color?.trim() || "",
              purchasePrice: Math.max(
                0,
                toNumber(variant.purchase_price)
              ),
              purchasePriceKnown:
                toNumber(variant.purchase_price) > 0,
            });
          });

          return;
        }

        const productPrice = toNumber(product.price);
        const localMrp =
          toNumber(product.mrp) || productPrice;

        mappedProducts.push({
          ...commonData,
          key: `product-${productId}`,
          variantId: null,
          // Local POS always starts from MRP.
          price: localMrp,
          mrp: localMrp,
          stock: Math.max(
            0,
            toNumber(product.stock)
          ),
          sku: product.sku?.trim() || "",
          barcode: product.barcode?.trim() || "",
          size: "",
          color: "",
          purchasePrice: 0,
          purchasePriceKnown: false,
        });
      });

      setProducts(mappedProducts);
      setIsOnline(true);

      try {
        await cachePosProducts(
          mappedProducts
            .filter((item) => !item.isQuickItem)
            .map((item) => ({
              key: item.key,
              productId: item.productId,
              variantId: item.variantId,
              name: item.name,
              category: item.category,
              subcategory: item.subcategory,
              brand: item.brand,
              price: item.price,
              mrp: item.mrp,
              stock: item.stock,
              sku: item.sku,
              barcode: item.barcode,
              imageUrl: item.imageUrl,
              size: item.size,
              color: item.color,
              taxPercent: item.taxPercent,
            })),
        );
      } catch (cacheError) {
        console.info(
          "Products loaded online, but offline cache update failed:",
          cacheError,
        );
      }

      const validProductIds = new Set(
        mappedProducts.map((item) => String(item.productId))
      );

      setRecentProductKeys((current) => {
        const next = current.filter((key) => validProductIds.has(key));

        if (next.length !== current.length) {
          window.localStorage.setItem(
            POS_RECENT_PRODUCTS_KEY,
            JSON.stringify(next)
          );
        }

        return next;
      });

      setPopularProductCounts((current) => {
        const next = Object.fromEntries(
          Object.entries(current).filter(([key]) =>
            validProductIds.has(key)
          )
        );

        if (Object.keys(next).length !== Object.keys(current).length) {
          window.localStorage.setItem(
            POS_POPULAR_PRODUCTS_KEY,
            JSON.stringify(next)
          );
        }

        return next;
      });
    } catch (error) {
      if (isBrowserOnline()) {
        console.error("Unable to load POS products:", error);
      } else {
        console.info("Internet unavailable. Loading cached POS products.");
      }
      setIsOnline(isBrowserOnline());

      try {
        const cachedProducts = await getCachedPosProducts();

        if (cachedProducts.length > 0) {
          setProducts(
            cachedProducts.map(({ cachedAt: _cachedAt, ...item }) => item),
          );
          setLoadError("");
          showNotice(
            "OFFLINE MODE: Cached products loaded. Billing is available.",
            "info",
          );
        } else {
          setLoadError(
            "No internet and no offline product cache is available. Connect once to download stock.",
          );
        }
      } catch (cacheError) {
        console.error(
          "Unable to load offline product cache:",
          cacheError,
        );
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load products.",
        );
      }
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    let refreshTimer: number | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        void loadProducts();
        refreshTimer = null;
      }, 250);
    };

    const channel = supabase
      .channel("ncs-pos-products-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_variants",
        },
        scheduleRefresh
      )
      .subscribe();

    const handleFocus = () => {
      void loadProducts();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadProducts();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      window.removeEventListener("focus", handleFocus);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      void supabase.removeChannel(channel);
    };
  }, [loadProducts]);

  const lookupCustomerRewards = useCallback(
    async (rawPhone: string) => {
      const digits = rawPhone.replace(/\D/g, "");
      const phone = digits.length > 10 ? digits.slice(-10) : digits;

      if (phone.length !== 10) {
        setRewardCustomerId(null);
        setAvailableRewardPoints(0);
        setRewardPointsToUse(0);
        setRewardCustomerFound(false);
        return;
      }

      /*
       * Reward lookup requires Supabase. In offline mode, skip the
       * network request completely so billing continues without a
       * Next.js console issue. Rewards will be checked again after
       * the connection returns.
       */
      if (!isBrowserOnline()) {
        setRewardCustomerId(null);
        setAvailableRewardPoints(0);
        setRewardPointsToUse(0);
        setRewardCustomerFound(false);
        setRewardLookupLoading(false);
        return;
      }

      setRewardLookupLoading(true);

      try {
        const { data, error } = await supabase.rpc(
          "ncs_get_customer_by_phone",
          {
            p_phone: phone,
          },
        );

        if (error) throw error;

        const rows = (Array.isArray(data) ? data : []) as CustomerRewardLookup[];
        const customer = rows[0];

        if (!customer) {
          setRewardCustomerId(null);
          setAvailableRewardPoints(0);
          setRewardPointsToUse(0);
          setRewardCustomerFound(false);
          return;
        }

        setRewardCustomerId(Number(customer.customer_id));
        setAvailableRewardPoints(
          Math.max(0, toNumber(customer.reward_points)),
        );
        setRewardPointsToUse(0);
        setRewardCustomerFound(true);
        setCustomerWhatsAppOptIn(
          customer.whatsapp_opt_in === true
        );

        if (customer.full_name?.trim()) {
          setCustomerName(customer.full_name.trim());
        }
      } catch (error) {
        console.info("Customer rewards are temporarily unavailable:", error);
        setRewardCustomerId(null);
        setAvailableRewardPoints(0);
        setRewardPointsToUse(0);
        setRewardCustomerFound(false);
      } finally {
        setRewardLookupLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const digits = customerPhone.replace(/\D/g, "");

    if (digits.length !== 10) {
      setRewardCustomerId(null);
      setAvailableRewardPoints(0);
      setRewardPointsToUse(0);
      setRewardCustomerFound(false);
      return;
    }

    const timer = window.setTimeout(() => {
      void lookupCustomerRewards(digits);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [customerPhone, lookupCustomerRewards]);

  const categories = useMemo(() => {
    const categorySet = new Set<string>();

    products.forEach((product) => {
      if (product.category) {
        categorySet.add(product.category);
      }
    });

    return [
      "All",
      ...Array.from(categorySet).sort((a, b) =>
        a.localeCompare(b)
      ),
    ];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const queryTokens = normalizeText(searchQuery)
      .split(/\s+/)
      .filter(Boolean);

    return products.filter((product) => {
      // Keep zero-stock records in Supabase for history and reports,
      // but do not show them in the active POS product finder.
      if (getAvailableStock(product) <= 0) {
        return false;
      }

      const matchesCategory =
        selectedCategory === "All" ||
        product.category === selectedCategory;

      if (!matchesCategory) {
        return false;
      }

      if (queryTokens.length === 0) {
        return true;
      }

      const searchableText = normalizeText(
        [
          product.name,
          product.category,
          product.subcategory,
          product.brand,
          product.sku,
          product.barcode,
          product.size,
          product.color,
          getPosShortCode(product),
          getParentShortCode(product.productId),
        ].join(" ")
      );

      return queryTokens.every((token) =>
        searchableText.includes(token)
      );
    });
  }, [products, searchQuery, selectedCategory]);

  const groupedProducts = useMemo<PosProductGroup[]>(() => {
    const groupMap = new Map<number, PosProductGroup>();

    filteredProducts.forEach((product) => {
      const existing = groupMap.get(product.productId);

      if (existing) {
        existing.variants.push(product);
        existing.totalStock += product.stock;
        existing.minPrice = Math.min(
          existing.minPrice,
          product.price
        );
        existing.maxPrice = Math.max(
          existing.maxPrice,
          product.price
        );
        return;
      }

      groupMap.set(product.productId, {
        groupKey: `group-${product.productId}`,
        productId: product.productId,
        name: product.name,
        category: product.category,
        subcategory: product.subcategory,
        brand: product.brand || "NEW CITY STYLE",
        imageUrl: product.imageUrl,
        totalStock: product.stock,
        minPrice: product.price,
        maxPrice: product.price,
        variants: [product],
      });
    });

    return Array.from(groupMap.values()).sort((a, b) => {
      const brandCompare = a.brand.localeCompare(b.brand);
      return brandCompare !== 0
        ? brandCompare
        : a.name.localeCompare(b.name);
    });
  }, [filteredProducts]);

  const brandGroups = useMemo(() => {
    const brandMap = new Map<
      string,
      {
        brand: string;
        groups: PosProductGroup[];
      }
    >();

    groupedProducts.forEach((group) => {
      const brand = formatBrandName(group.brand);
      const brandKey = normalizeBrandKey(brand);
      const existing = brandMap.get(brandKey);

      if (existing) {
        existing.groups.push({
          ...group,
          brand,
        });
        return;
      }

      brandMap.set(brandKey, {
        brand,
        groups: [
          {
            ...group,
            brand,
          },
        ],
      });
    });

    return Array.from(brandMap.values())
      .map(({ brand, groups }) => ({
        brand,
        groups: groups.sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
        totalStock: groups.reduce(
          (sum, group) => sum + group.totalStock,
          0
        ),
        totalVariants: groups.reduce(
          (sum, group) => sum + group.variants.length,
          0
        ),
      }))
      .sort((a, b) => a.brand.localeCompare(b.brand));
  }, [groupedProducts]);

  const recentProductGroups = useMemo(() => {
    const byKey = new Map(
      groupedProducts.map((group) => [
        String(group.productId),
        group,
      ])
    );

    return recentProductKeys
      .map((key) => byKey.get(key))
      .filter((group): group is PosProductGroup => Boolean(group))
      .slice(0, 6);
  }, [groupedProducts, recentProductKeys]);

  const popularProductGroups = useMemo(() => {
    return [...groupedProducts]
      .sort(
        (a, b) =>
          (popularProductCounts[String(b.productId)] || 0) -
          (popularProductCounts[String(a.productId)] || 0)
      )
      .filter(
        (group) =>
          (popularProductCounts[String(group.productId)] || 0) > 0
      )
      .slice(0, 6);
  }, [groupedProducts, popularProductCounts]);

  const itemMrpSubtotal = useMemo(
    () =>
      cartItems.reduce(
        (total, item) => total + item.mrp * item.quantity,
        0
      ),
    [cartItems]
  );

  const itemDiscountAmount = useMemo(
    () =>
      cartItems.reduce(
        (total, item) =>
          total + Math.max(0, item.mrp - item.price) * item.quantity,
        0
      ),
    [cartItems]
  );

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      ),
    [cartItems]
  );

  // MRP / negotiated selling price is GST inclusive.
  // This derives the included GST only for records/invoice display.
  // GST is never added again on top of the selling price.
  const itemTax = useMemo(
    () =>
      cartItems.reduce((total, item) => {
        const inclusiveValue = item.price * item.quantity;
        const rate = Math.max(0, item.taxPercent);

        if (rate <= 0) {
          return total;
        }

        return total + (inclusiveValue * rate) / (100 + rate);
      }, 0),
    [cartItems]
  );

  const billBaseTotal = subtotal;

  const safeBillDiscountPercent = Math.min(
    100,
    Math.max(0, billDiscountPercent)
  );

  const billDiscountAmount =
    (billBaseTotal * safeBillDiscountPercent) / 100;

  const grandTotalBeforeRewards = Math.max(
    0,
    billBaseTotal - billDiscountAmount
  );

  const safeRewardPointsToUse = Math.floor(
    Math.min(
      availableRewardPoints,
      grandTotalBeforeRewards,
      Math.max(0, rewardPointsToUse),
    ),
  );

  const rewardDiscountAmount = safeRewardPointsToUse;

  const grandTotal = Math.max(
    0,
    grandTotalBeforeRewards - rewardDiscountAmount
  );

  const safeRoundOffAmount = Math.min(
    grandTotal,
    Math.max(0, roundOffAmount)
  );

  const finalPayable = Math.max(
    0,
    grandTotal - safeRoundOffAmount
  );

  const safeCreditPaidNow =
    paymentMethod === "credit"
      ? Math.min(
          finalPayable,
          Math.max(0, creditPaidNow)
        )
      : finalPayable;

  const creditDueAmount =
    paymentMethod === "credit"
      ? Math.max(0, finalPayable - safeCreditPaidNow)
      : 0;

  const totalQuantity = useMemo(
    () =>
      cartItems.reduce(
        (total, item) => total + item.quantity,
        0
      ),
    [cartItems]
  );

  function resetQuickItemForm() {
    setQuickItemForm(EMPTY_QUICK_ITEM_FORM);
  }

  function openQuickItem() {
    setQuickItemForm((current) => ({
      ...EMPTY_QUICK_ITEM_FORM,
      category:
        selectedCategory !== "All"
          ? selectedCategory
          : current.category || "Others",
    }));
    setShowQuickItem(true);
  }

  function addQuickItemToCart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = quickItemForm.name.trim();
    const category = quickItemForm.category.trim() || "Others";
    const quantity = Math.max(
      0,
      Math.floor(toNumber(quickItemForm.quantity, 0)),
    );
    const mrp = Math.max(
      0,
      toNumber(quickItemForm.mrp),
    );
    const purchasePrice = Math.max(
      0,
      toNumber(quickItemForm.purchasePrice),
    );
    const remainingStock = Math.max(
      0,
      Math.floor(toNumber(quickItemForm.remainingStock)),
    );
    const taxPercent = Math.max(
      0,
      toNumber(quickItemForm.taxPercent),
    );

    if (!name) {
      showNotice("Enter the quick item name.", "error");
      return;
    }

    if (quantity <= 0) {
      showNotice("Enter a valid quantity.", "error");
      return;
    }

    if (mrp <= 0) {
      showNotice("Enter a valid MRP.", "error");
      return;
    }

    const quickKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `quick-${crypto.randomUUID()}`
        : `quick-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const quickItem: CartItem = {
      key: quickKey,
      productId: 0,
      variantId: null,
      name,
      category,
      subcategory: "",
      brand: "NEW CITY STYLE",
      // Local POS starts the quick item from MRP.
      // The cashier can apply the customer discount in the bill.
      price: mrp,
      mrp,
      stock: Number.MAX_SAFE_INTEGER,
      sku: "",
      barcode: "",
      imageUrl: "",
      size: "",
      color: "",
      taxPercent,
      purchasePrice,
      purchasePriceKnown: purchasePrice > 0,
      quantity,
      isQuickItem: true,
      quickPurchasePrice: purchasePrice,
      quickSaveAsProduct: quickItemForm.saveAsProduct,
      quickRemainingStock: remainingStock,
    };

    setCartItems((current) => [...current, quickItem]);

    // Multi-add Quick Item workflow:
    // Keep the modal open so the cashier can enter the next unregistered item.
    // Preserve the selected category to speed up repeated entry.
    setQuickItemForm({
      ...EMPTY_QUICK_ITEM_FORM,
      category,
    });

    window.requestAnimationFrame(() => {
      quickItemNameInputRef.current?.focus();
      quickItemNameInputRef.current?.select();
    });

    showNotice(
      `${name} added to the bill. Enter the next quick item or close when finished.`,
      "success",
    );
  }

  async function createQuickProductForSale(item: CartItem) {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    const quickSku = `QUICK-${timestamp}-${randomPart}`;
    const totalStock =
      Math.max(1, item.quantity) +
      Math.max(0, Math.floor(toNumber(item.quickRemainingStock)));

    const { data: productData, error: productError } = await supabase
      .from("products")
      .insert({
        name: item.name,
        category: item.category || "Others",
        subcategory: null,
        brand: "NEW CITY STYLE",
        price: Math.round(item.price),
        mrp: Math.round(Math.max(item.mrp, item.price)),
        stock: totalStock,
        sku: quickSku,
        barcode: null,
        tax_percent: Number(
          Math.max(0, item.taxPercent).toFixed(2),
        ),
        is_active: item.quickSaveAsProduct === true,
        status:
          item.quickSaveAsProduct === true
            ? "active"
            : "inactive",
      })
      .select("id")
      .single();

    if (productError) {
      throw new Error(
        `Unable to prepare quick item "${item.name}": ${productError.message}`,
      );
    }

    const productId = Number(productData.id);
    let variantId: number | null = null;

    const { data: variantData, error: variantError } = await supabase
      .from("product_variants")
      .insert({
        product_id: productId,
        variant_name: "Quick Item",
        size: null,
        color: null,
        sku: quickSku,
        barcode: null,
        purchase_price: Math.round(
          Math.max(
            0,
            toNumber(item.quickPurchasePrice),
          ),
        ),
        selling_price: Math.round(item.price),
        mrp: Math.round(Math.max(item.mrp, item.price)),
        stock: totalStock,
        reserved_stock: 0,
        low_stock_limit: 0,
        is_active: true,
      })
      .select("id")
      .single();

    if (!variantError && variantData?.id) {
      variantId = Number(variantData.id);
    } else if (variantError) {
      console.info(
        `Quick item variant was not created for ${item.name}; product stock will be used:`,
        variantError.message,
      );
    }

    return {
      productId,
      variantId,
    };
  }

  function rememberSelectedProduct(product: PosProduct) {
    const productKey = String(product.productId);

    setRecentProductKeys((current) => {
      const next = [
        productKey,
        ...current.filter((key) => key !== productKey),
      ].slice(0, 12);

      window.localStorage.setItem(
        POS_RECENT_PRODUCTS_KEY,
        JSON.stringify(next)
      );

      return next;
    });

    setPopularProductCounts((current) => {
      const next = {
        ...current,
        [productKey]: (current[productKey] || 0) + 1,
      };

      window.localStorage.setItem(
        POS_POPULAR_PRODUCTS_KEY,
        JSON.stringify(next)
      );

      return next;
    });
  }

  function addProductToCart(product: PosProduct) {
    if (getAvailableStock(product) <= 0) {
      showNotice(
        `${product.name} is out of stock.`,
        "error"
      );
      return;
    }

    setCartItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.key === product.key
      );

      if (existingItem) {
        if (
          existingItem.quantity >=
          getAvailableStock(product)
        ) {
          showNotice(
            `Only ${product.stock} item(s) available.`,
            "error"
          );

          return currentItems;
        }

        return currentItems.map((item) =>
          item.key === product.key
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...currentItems,
        {
          ...product,
          quantity: 1,
          discountPercent: 0,
        },
      ];
    });

    rememberSelectedProduct(product);

    showNotice(
      `${product.name} added to bill.`,
      "success"
    );

    setSearchQuery("");
    searchInputRef.current?.focus();
  }

  function getTopPosAiMatches(command: PosAiCommand) {
    const matches = findPosAiMatches(products, command);
    const bestScore = matches[0]?.score ?? 0;

    const topMatches = matches
      .filter((match) =>
        bestScore >= 1000
          ? match.score >= 1000
          : match.score >= Math.max(1, bestScore - 8)
      )
      .slice(0, 5);

    const topMatch = matches[0];
    const secondMatch = matches[1];

    const confident =
      matches.length === 1 ||
      (topMatch?.score ?? 0) >= 1000 ||
      (
        (topMatch?.score ?? 0) >= 60 &&
        (
          !secondMatch ||
          (topMatch?.score ?? 0) - secondMatch.score >= 12
        )
      );

    return { matches, topMatches, confident };
  }

  function resolvePosAiProduct(
    rawProductCommand: string,
    allowCartFallback = false
  ) {
    const cleanCommand = stripPosAiModifierWords(rawProductCommand);
    const command = buildPosAiCommand(cleanCommand || rawProductCommand);
    const resolution = getTopPosAiMatches(command);

    if (resolution.confident && resolution.matches[0]) {
      return {
        product: resolution.matches[0].product,
        command,
        resolution,
      };
    }

    if (allowCartFallback) {
      const normalizedSearch = normalizePosAiText(
        command.searchText || cleanCommand
      );

      const cartMatch = cartItems.find((item) => {
        const haystack = normalizePosAiText(
          [
            item.brand,
            item.name,
            item.size,
            item.color,
            item.sku,
            item.barcode,
            getPosShortCode(item),
          ].join(" ")
        );

        return command.tokens.every((token) =>
          haystack.split(/\s+/).some((candidate) =>
            getPosAiTokenScore(token, candidate) > 0
          )
        ) || (normalizedSearch && haystack.includes(normalizedSearch));
      });

      if (cartMatch) {
        return {
          product: cartMatch,
          command,
          resolution,
        };
      }
    }

    return {
      product: null,
      command,
      resolution,
    };
  }

  function showPosAiAmbiguity(
    command: PosAiCommand,
    topMatches: PosAiMatch[]
  ) {
    setPosAiMatches(topMatches);
    setSearchQuery(command.searchText);
    setProductViewMode("brands");

    showNotice(
      `${topMatches.length} possible matches found. Select the correct variant.`,
      "info"
    );
  }

  function handlePosAiSubmit(
    event?: FormEvent<HTMLFormElement>
  ) {
    event?.preventDefault();

    const rawCommand = posAiCommand.trim();

    if (!rawCommand) {
      showNotice("Tell NCS AI what to do.", "info");
      return;
    }

    const normalized = normalizePosAiText(rawCommand);

    if (/^(?:undo|మళ్ళీ వెనక్కి|మళ్లీ వెనక్కి)$/.test(normalized)) {
      if (!posAiLastAction) {
        showNotice("Nothing to undo yet.", "info");
        return;
      }

      const product = products.find(
        (item) => item.key === posAiLastAction.productKey
      );

      if (!product) {
        showNotice("Previous product is no longer available.", "error");
        return;
      }

      setCartItems((currentItems) => {
        const withoutProduct = currentItems.filter(
          (item) => item.key !== product.key
        );

        if (posAiLastAction.previousQuantity <= 0) {
          return withoutProduct;
        }

        return [
          ...withoutProduct,
          {
            ...product,
            quantity: Math.min(
              posAiLastAction.previousQuantity,
              getAvailableStock(product)
            ),
            discountPercent: 0,
          },
        ];
      });

      setPosAiLastProductKey(product.key);
      setPosAiLastAction(null);
      setPosAiMatches([]);
      setPosAiCommand("");
      showNotice("Last AI cart action undone.", "success");
      return;
    }

    const billDiscountMatch =
      normalized.match(/\bbill\s+discount\s+(\d{1,3}(?:\.\d+)?)\s*%?/) ||
      normalized.match(/\b(\d{1,3}(?:\.\d+)?)\s*%?\s+bill\s+discount\b/);

    if (billDiscountMatch) {
      const discount = Math.min(100, Math.max(0, Number(billDiscountMatch[1])));
      setBillDiscountPercent(discount);
      setPosAiMatches([]);
      setPosAiCommand("");
      showNotice(`Bill discount set to ${discount}%.`, "success");
      return;
    }

    const paymentMatch = normalized.match(
      /^(?:payment\s+)?(cash|upi|card|credit)(?:\s+payment)?$/
    );

    if (paymentMatch) {
      const method = paymentMatch[1] as PaymentMethod;
      setPaymentMethod(method);
      setPosAiMatches([]);
      setPosAiCommand("");
      showNotice(`Payment method set to ${method.toUpperCase()}.`, "success");
      return;
    }

    const customerPhoneMatch = rawCommand.match(/(\d{10})/);
    if (
      customerPhoneMatch &&
      /^(?:customer|కస్టమర్)\b/i.test(normalized)
    ) {
      const phone = customerPhoneMatch[1];
      const name = rawCommand
        .replace(/^(?:customer|కస్టమర్)\s*/i, "")
        .replace(phone, "")
        .trim();

      setCustomerPhone(phone);
      if (name) setCustomerName(name);
      setPosAiMatches([]);
      setPosAiCommand("");
      showNotice(
        name
          ? `Customer ${name} (${phone}) added to bill.`
          : `Customer phone ${phone} added to bill.`,
        "success"
      );
      return;
    }

    if (/^(?:hold\s+bill|bill\s+hold|బిల్\s+హోల్డ్)$/.test(normalized)) {
      holdCurrentBill();
      setPosAiMatches([]);
      setPosAiCommand("");
      return;
    }

    if (
      /^(?:complete\s+(?:bill|sale)|finish\s+(?:bill|sale)|బిల్\s+కంప్లీట్)$/.test(normalized)
    ) {
      if (cartItems.length === 0) {
        showNotice("Current bill is empty.", "info");
        return;
      }

      const confirmed = window.confirm(
        `Complete this bill for ${formatCurrency(finalPayable)}?`
      );

      if (confirmed) {
        setPosAiMatches([]);
        setPosAiCommand("");
        void handleCompleteSale();
      }
      return;
    }

    if (
      /^(?:bill\s+total|total|total\s+entha|bill\s+total\s+entha|బిల్\s+మొత్తం|మొత్తం\s+ఎంత)$/.test(normalized)
    ) {
      showNotice(
        `${totalQuantity} item(s) • Total payable ${formatCurrency(finalPayable)}.`,
        "info"
      );
      return;
    }

    const lastItem =
      cartItems.length > 0
        ? cartItems[cartItems.length - 1]
        : null;

    if (/^last\s+item\b/.test(normalized)) {
      if (!lastItem) {
        showNotice("Current bill is empty.", "info");
        return;
      }

      const discount = getPosAiPercentage(rawCommand);
      const assignedQuantity = getPosAiAssignedQuantity(rawCommand);

      if (/\b(remove|delete)\b/.test(normalized)) {
        setPosAiLastAction({
          productKey: lastItem.key,
          previousQuantity: lastItem.quantity,
        });
        removeCartItem(lastItem.key);
        setPosAiLastProductKey(lastItem.key);
        setPosAiCommand("");
        showNotice(`${lastItem.name} removed from bill.`, "success");
        return;
      }

      if (discount !== null) {
        updateItemDiscount(lastItem.key, discount);
        setPosAiLastProductKey(lastItem.key);
        setPosAiCommand("");
        showNotice(
          `${lastItem.name} discount set to ${discount}%.`,
          "success"
        );
        return;
      }

      if (assignedQuantity !== null) {
        updateItemQuantity(lastItem.key, assignedQuantity);
        setPosAiLastProductKey(lastItem.key);
        setPosAiCommand("");
        showNotice(
          `${lastItem.name} quantity set to ${assignedQuantity}.`,
          "success"
        );
        return;
      }
    }

    const multiCommands = splitPosAiMultiCommands(rawCommand);

    if (
      multiCommands.length > 1 &&
      multiCommands.every((part) =>
        getPosAiIntent(normalizePosAiText(part)) === "add"
      )
    ) {
      const resolved = multiCommands.map((part) => {
        const command = buildPosAiCommand(part);
        const resolution = getTopPosAiMatches(command);
        return { part, command, resolution };
      });

      const failed = resolved.find(
        (entry) =>
          !entry.resolution.confident ||
          !entry.resolution.matches[0]
      );

      if (failed) {
        if (failed.resolution.matches.length === 0) {
          setPosAiMatches([]);
          showNotice(
            `No product matched "${failed.command.searchText || failed.part}".`,
            "error"
          );
        } else {
          setPosAiCommand(failed.part);
          showPosAiAmbiguity(
            failed.command,
            failed.resolution.topMatches
          );
        }
        return;
      }

      const additions = resolved.map((entry) => ({
        product: entry.resolution.matches[0].product,
        quantity: Math.max(1, entry.command.quantity),
      }));

      const finalAddition = additions[additions.length - 1] || null;
      const finalProduct = finalAddition?.product || null;
      const finalPreviousQuantity = finalProduct
        ? cartItems.find((item) => item.key === finalProduct.key)?.quantity || 0
        : 0;
      let limitedByStock = false;

      setCartItems((currentItems) => {
        let nextItems = [...currentItems];

        for (const addition of additions) {
          const { product, quantity } = addition;
          const availableStock = getAvailableStock(product);
          const existing = nextItems.find(
            (item) => item.key === product.key
          );
          const previousQuantity = existing?.quantity || 0;
          const nextQuantity = Math.min(
            previousQuantity + quantity,
            availableStock
          );

          if (nextQuantity < previousQuantity + quantity) {
            limitedByStock = true;
          }

          if (existing) {
            nextItems = nextItems.map((item) =>
              item.key === product.key
                ? { ...item, quantity: nextQuantity }
                : item
            );
          } else if (nextQuantity > 0) {
            nextItems.push({
              ...product,
              quantity: nextQuantity,
              discountPercent: 0,
            });
          }

        }

        return nextItems;
      });

      additions.forEach(({ product }) =>
        rememberSelectedProduct(product)
      );

      if (finalProduct) {
        setPosAiLastProductKey(finalProduct.key);
        setPosAiLastAction({
          productKey: finalProduct.key,
          previousQuantity: finalPreviousQuantity,
        });
      }

      setPosAiMatches([]);
      setPosAiCommand("");

      const totalAdded = additions.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      showNotice(
        limitedByStock
          ? `${additions.length} product(s) processed; one or more quantities were limited to available stock.`
          : `${additions.length} product(s), ${totalAdded} item(s) added by NCS AI.`,
        limitedByStock ? "info" : "success"
      );
      return;
    }

    const requestedDiscount =
      /\bdiscount\b|డిస్కౌంట్/i.test(rawCommand)
        ? getPosAiPercentage(rawCommand)
        : null;

    const assignedQuantity =
      /\b(?:qty|quantity)\b/i.test(rawCommand)
        ? getPosAiAssignedQuantity(rawCommand)
        : null;

    const isStockQuery =
      /\bstock\b|స్టాక్/i.test(rawCommand) &&
      (
        /\b(show|find|available|how|much|entha)\b/i.test(normalized) ||
        /చూపు|చూపించు|ఎంత/.test(normalized)
      );

    if (
      requestedDiscount !== null ||
      assignedQuantity !== null ||
      isStockQuery
    ) {
      const resolution = resolvePosAiProduct(rawCommand, true);

      if (!resolution.product) {
        if (resolution.resolution.matches.length === 0) {
          showNotice("No matching product found.", "error");
        } else {
          showPosAiAmbiguity(
            resolution.command,
            resolution.resolution.topMatches
          );
        }
        return;
      }

      const product = resolution.product;
      const existingItem = cartItems.find(
        (item) => item.key === product.key
      );

      if (isStockQuery) {
        showNotice(
          `${product.brand} ${product.name} ${product.size || ""} ${product.color || ""}: ${getAvailableStock(product)} in stock.`,
          "info"
        );
        setPosAiMatches([]);
        return;
      }

      if (!existingItem) {
        showNotice(`${product.name} is not in the current bill.`, "info");
        return;
      }

      if (requestedDiscount !== null) {
        updateItemDiscount(product.key, requestedDiscount);
        setPosAiLastProductKey(product.key);
        setPosAiCommand("");
        setPosAiMatches([]);
        showNotice(
          `${product.name} discount set to ${requestedDiscount}%.`,
          "success"
        );
        return;
      }

      if (assignedQuantity !== null) {
        setPosAiLastAction({
          productKey: product.key,
          previousQuantity: existingItem.quantity,
        });
        updateItemQuantity(product.key, assignedQuantity);
        setPosAiLastProductKey(product.key);
        setPosAiCommand("");
        setPosAiMatches([]);
        showNotice(
          `${product.name} quantity set to ${assignedQuantity}.`,
          "success"
        );
        return;
      }
    }

    const command = buildPosAiCommand(rawCommand);
    const { matches, topMatches, confident } =
      getTopPosAiMatches(command);

    if (matches.length === 0) {
      setPosAiMatches([]);
      showNotice(
        `No product matched "${command.searchText || rawCommand}".`,
        "error"
      );
      return;
    }

    if (command.intent === "show") {
      setPosAiMatches(topMatches);
      setSearchQuery(command.searchText);
      setProductViewMode("brands");

      showNotice(
        `${topMatches.length} AI match${
          topMatches.length === 1 ? "" : "es"
        } found.`,
        "info"
      );
      return;
    }

    if (!confident) {
      showPosAiAmbiguity(command, topMatches);
      return;
    }

    const product = matches[0].product;

    if (command.intent === "remove") {
      const existingItem = cartItems.find(
        (item) => item.key === product.key
      );

      if (!existingItem) {
        showNotice(`${product.name} is not in the current bill.`, "info");
        return;
      }

      setPosAiLastAction({
        productKey: product.key,
        previousQuantity: existingItem.quantity,
      });

      removeCartItem(product.key);
      setPosAiLastProductKey(product.key);
      setPosAiMatches([]);
      setPosAiCommand("");
      showNotice(`${product.name} removed from bill.`, "success");
      return;
    }

    if (
      command.intent === "increase" ||
      command.intent === "decrease"
    ) {
      const existingItem = cartItems.find(
        (item) => item.key === product.key
      );

      if (!existingItem) {
        showNotice(`${product.name} is not in the current bill.`, "info");
        return;
      }

      const changeBy = Math.max(1, command.quantity);
      const nextQuantity =
        command.intent === "increase"
          ? Math.min(
              existingItem.quantity + changeBy,
              getAvailableStock(product)
            )
          : Math.max(0, existingItem.quantity - changeBy);

      setPosAiLastAction({
        productKey: product.key,
        previousQuantity: existingItem.quantity,
      });

      updateItemQuantity(product.key, nextQuantity);
      setPosAiLastProductKey(product.key);
      setPosAiMatches([]);
      setPosAiCommand("");

      showNotice(
        nextQuantity > 0
          ? `${product.name} quantity changed to ${nextQuantity}.`
          : `${product.name} removed from bill.`,
        "success"
      );
      return;
    }

    const existingQuantity =
      cartItems.find(
        (item) => item.key === product.key
      )?.quantity || 0;

    const requestedQuantity = Math.max(1, command.quantity);
    const availableStock = getAvailableStock(product);

    if (existingQuantity >= availableStock) {
      showNotice(`Only ${availableStock} item(s) available.`, "error");
      return;
    }

    setPosAiLastAction({
      productKey: product.key,
      previousQuantity: existingQuantity,
    });

    addProductToCart(product);

    if (requestedQuantity > 1) {
      setCartItems((currentItems) =>
        currentItems.map((item) =>
          item.key === product.key
            ? {
                ...item,
                quantity: Math.min(
                  existingQuantity + requestedQuantity,
                  availableStock
                ),
              }
            : item
        )
      );
    }

    setPosAiLastProductKey(product.key);
    setPosAiMatches([]);
    setPosAiCommand("");

    showNotice(
      existingQuantity + requestedQuantity > availableStock
        ? `${product.name}: quantity limited to ${availableStock} available stock.`
        : `${product.name} × ${requestedQuantity} added by NCS AI.`,
      existingQuantity + requestedQuantity > availableStock
        ? "info"
        : "success"
    );
  }
  function updateItemDiscount(
    itemKey: string,
    rawDiscountPercent: number
  ) {
    const discountPercent = Math.min(
      100,
      Math.max(0, toNumber(rawDiscountPercent))
    );

    setCartItems((currentItems) =>
      currentItems.map((item) => {
        if (item.key !== itemKey) {
          return item;
        }

        const sellingPrice = Math.max(
          0,
          item.mrp - (item.mrp * discountPercent) / 100
        );

        return {
          ...item,
          discountPercent,
          price: Number(sellingPrice.toFixed(2)),
        };
      })
    );
  }

  function updateItemSellingPrice(
    itemKey: string,
    rawSellingPrice: number
  ) {
    setCartItems((currentItems) =>
      currentItems.map((item) => {
        if (item.key !== itemKey) {
          return item;
        }

        const sellingPrice = Math.min(
          Math.max(0, toNumber(rawSellingPrice)),
          Math.max(0, item.mrp)
        );
        const discountPercent =
          item.mrp > 0
            ? ((item.mrp - sellingPrice) / item.mrp) * 100
            : 0;

        return {
          ...item,
          price: Number(sellingPrice.toFixed(2)),
          discountPercent: Number(
            Math.max(0, discountPercent).toFixed(2)
          ),
        };
      })
    );
  }

  function updateItemQuantity(
    itemKey: string,
    rawQuantity: number
  ) {
    setCartItems((currentItems) =>
      currentItems
        .map((item) => {
          if (item.key !== itemKey) {
            return item;
          }

          const maxQuantity = item.isQuickItem
            ? Number.MAX_SAFE_INTEGER
            : Math.max(1, Math.floor(item.stock));
          const quantity = Math.min(
            maxQuantity,
            Math.max(0, Math.floor(toNumber(rawQuantity)))
          );

          return { ...item, quantity };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function increaseQuantity(itemKey: string) {
    setCartItems((currentItems) =>
      currentItems.map((item) => {
        if (item.key !== itemKey) {
          return item;
        }

        if (!item.isQuickItem && item.quantity >= item.stock) {
          showNotice(
            `Only ${item.stock} item(s) available.`,
            "error"
          );

          return item;
        }

        return {
          ...item,
          quantity: item.quantity + 1,
        };
      })
    );
  }

  function decreaseQuantity(itemKey: string) {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.key === itemKey
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeCartItem(itemKey: string) {
    setCartItems((currentItems) =>
      currentItems.filter(
        (item) => item.key !== itemKey
      )
    );
  }

  async function openOwnerCostInfo(item: CartItem) {
    setLoadingOwnerCostKey(item.key);

    try {
      if (item.isQuickItem) {
        setOwnerCostInfo({
          itemKey: item.key,
          productName: item.name,
          size: item.size,
          color: item.color,
          purchasePrice: Math.max(
            0,
            toNumber(
              item.quickPurchasePrice ??
                item.purchasePrice
            )
          ),
          supplierName: "Quick Item",
          supplierPhone: "",
          purchaseDate: "",
          purchaseNumber: "",
          supplierInvoiceNumber: "",
          source:
            "Quick item • profit excluded until registered stock has a known cost",
          quickItem: true,
        });
        return;
      }

      let purchaseQuery = supabase
        .from("purchase_items")
        .select(
          "purchase_id,purchase_price,created_at"
        )
        .eq("product_id", item.productId)
        .order("created_at", {
          ascending: false,
        })
        .limit(1);

      if (item.variantId !== null) {
        purchaseQuery =
          purchaseQuery.eq(
            "variant_id",
            item.variantId
          );
      }

      const {
        data: purchaseItems,
        error: purchaseItemError,
      } = await purchaseQuery;

      if (purchaseItemError) {
        throw purchaseItemError;
      }

      const latestPurchaseItem =
        (purchaseItems || [])[0] as
          | {
              purchase_id?: string | null;
              purchase_price?: number | string | null;
              created_at?: string | null;
            }
          | undefined;

      let supplierName = "";
      let supplierPhone = "";
      let purchaseDate = "";
      let purchaseNumber = "";
      let supplierInvoiceNumber = "";

      if (latestPurchaseItem?.purchase_id) {
        const {
          data: purchaseRows,
          error: purchaseError,
        } = await supabase
          .from("purchases")
          .select(
            "purchase_number,supplier_name,supplier_phone,supplier_invoice_number,purchase_date"
          )
          .eq(
            "id",
            latestPurchaseItem.purchase_id
          )
          .limit(1);

        if (!purchaseError) {
          const purchase =
            (purchaseRows || [])[0] as
              | {
                  purchase_number?: string | null;
                  supplier_name?: string | null;
                  supplier_phone?: string | null;
                  supplier_invoice_number?: string | null;
                  purchase_date?: string | null;
                }
              | undefined;

          supplierName =
            purchase?.supplier_name?.trim() || "";
          supplierPhone =
            purchase?.supplier_phone?.trim() || "";
          purchaseDate =
            purchase?.purchase_date || "";
          purchaseNumber =
            purchase?.purchase_number?.trim() || "";
          supplierInvoiceNumber =
            purchase?.supplier_invoice_number?.trim() || "";
        }
      }

      const purchasePrice =
        Math.max(
          0,
          toNumber(
            latestPurchaseItem?.purchase_price
          )
        ) ||
        Math.max(
          0,
          toNumber(item.purchasePrice)
        );

      setOwnerCostInfo({
        itemKey: item.key,
        productName: item.name,
        size: item.size,
        color: item.color,
        purchasePrice,
        supplierName:
          supplierName || "Supplier details not available",
        supplierPhone,
        purchaseDate,
        purchaseNumber,
        supplierInvoiceNumber,
        source:
          latestPurchaseItem
            ? "Latest purchase history"
            : item.purchasePriceKnown
              ? "Product variant purchase cost"
              : "Purchase cost not available",
        quickItem: false,
      });
    } catch (error) {
      console.error(
        "Unable to load owner cost details:",
        error
      );

      setOwnerCostInfo({
        itemKey: item.key,
        productName: item.name,
        size: item.size,
        color: item.color,
        purchasePrice: Math.max(
          0,
          toNumber(item.purchasePrice)
        ),
        supplierName:
          "Supplier details unavailable",
        supplierPhone: "",
        purchaseDate: "",
        purchaseNumber: "",
        supplierInvoiceNumber: "",
        source:
          item.purchasePriceKnown
            ? "Product variant purchase cost"
            : "Purchase history unavailable",
        quickItem: false,
      });
    } finally {
      setLoadingOwnerCostKey(null);
    }
  }

  function clearCurrentBill() {
    if (cartItems.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      "Clear all items from the current bill?"
    );

    if (!confirmed) {
      return;
    }

    setCartItems([]);
    setBillDiscountPercent(0);
    setRoundOffAmount(0);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerWhatsAppOptIn(false);
    setRewardCustomerId(null);
    setAvailableRewardPoints(0);
    setRewardPointsToUse(0);
    setRewardCustomerFound(false);
    setPaymentMethod("cash");
    setCreditPaidNow(0);
    setCreditDueDate(getDefaultCreditDueDate());

    showNotice("Current bill cleared.", "info");
  }

  function saveHeldBills(nextHeldBills: HeldBill[]) {
    setHeldBills(nextHeldBills);

    window.localStorage.setItem(
      HELD_BILLS_STORAGE_KEY,
      JSON.stringify(nextHeldBills)
    );
  }

  function holdCurrentBill() {
    if (cartItems.length === 0) {
      showNotice(
        "Add at least one product before holding the bill.",
        "error"
      );
      return;
    }

    const heldBill: HeldBill = {
      id: crypto.randomUUID(),
      holdNumber: createHoldNumber(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      items: cartItems,
      billDiscountPercent: safeBillDiscountPercent,
      roundOffAmount: safeRoundOffAmount,
      paymentMethod,
      creditPaidNow:
        paymentMethod === "credit"
          ? safeCreditPaidNow
          : 0,
      creditDueDate:
        paymentMethod === "credit"
          ? creditDueDate
          : undefined,
      createdAt: new Date().toISOString(),
    };

    saveHeldBills([heldBill, ...heldBills]);

    setCartItems([]);
    setBillDiscountPercent(0);
    setRoundOffAmount(0);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerWhatsAppOptIn(false);
    setRewardCustomerId(null);
    setAvailableRewardPoints(0);
    setRewardPointsToUse(0);
    setRewardCustomerFound(false);
    setPaymentMethod("cash");
    setCreditPaidNow(0);
    setCreditDueDate(getDefaultCreditDueDate());

    showNotice(
      `${heldBill.holdNumber} saved successfully.`,
      "success"
    );
  }

  function startNextCustomerBill() {
    if (cartItems.length === 0) {
      showNotice(
        "Current bill is empty. Start adding the next customer items.",
        "info"
      );
      return;
    }

    holdCurrentBill();
    setMobileCartOpen(true);

    window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 80);
  }

  function resumeHeldBill(heldBill: HeldBill) {
    if (cartItems.length > 0) {
      const confirmed = window.confirm(
        "Replace the current bill with this held bill?"
      );

      if (!confirmed) {
        return;
      }
    }

    setCartItems(heldBill.items);
    const heldBaseTotal = heldBill.items.reduce(
      (total, item) =>
        total +
        item.price * item.quantity,
      0
    );

    const restoredDiscountPercent =
      typeof heldBill.billDiscountPercent === "number"
        ? heldBill.billDiscountPercent
        : heldBaseTotal > 0
          ? (toNumber(heldBill.billDiscount) /
              heldBaseTotal) *
            100
          : 0;

    setBillDiscountPercent(
      Math.min(100, Math.max(0, restoredDiscountPercent))
    );
    setRoundOffAmount(
      Math.max(0, toNumber(heldBill.roundOffAmount))
    );
    setCustomerName(heldBill.customerName);
    setCustomerPhone(heldBill.customerPhone);
    setRewardCustomerId(null);
    setAvailableRewardPoints(0);
    setRewardPointsToUse(0);
    setRewardCustomerFound(false);
    setPaymentMethod(heldBill.paymentMethod);
    setCreditPaidNow(
      heldBill.paymentMethod === "credit"
        ? Math.max(0, toNumber(heldBill.creditPaidNow))
        : 0
    );
    setCreditDueDate(
      heldBill.creditDueDate ||
        getDefaultCreditDueDate()
    );

    saveHeldBills(
      heldBills.filter(
        (item) => item.id !== heldBill.id
      )
    );

    setShowHeldBills(false);
    setMobileCartOpen(true);

    showNotice(
      `${heldBill.holdNumber} resumed.`,
      "success"
    );
  }

  function deleteHeldBill(heldBillId: string) {
    const confirmed = window.confirm(
      "Delete this held bill?"
    );

    if (!confirmed) {
      return;
    }

    saveHeldBills(
      heldBills.filter(
        (item) => item.id !== heldBillId
      )
    );
  }

  function handleSearchSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const query = searchQuery.trim();

    if (!query) {
      return;
    }

    const normalizedQuery = query.toLowerCase();

    const exactProduct = products.find(
      (product) =>
        normalizeText(product.barcode) ===
          normalizedQuery ||
        normalizeText(product.sku) ===
          normalizedQuery ||
        normalizeText(getPosShortCode(product)) ===
          normalizedQuery
    );

    if (exactProduct) {
      addProductToCart(exactProduct);
      return;
    }

    if (filteredProducts.length === 1) {
      addProductToCart(filteredProducts[0]);
      return;
    }

    if (filteredProducts.length > 1) {
      setProductViewMode("brands");
      setExpandedProductId(null);
    }

    showNotice(
      filteredProducts.length > 1
        ? `${filteredProducts.length} matching variant(s) found. Open the brand, then choose the product and exact size / colour.`
        : "No matching product found.",
      filteredProducts.length > 0
        ? "info"
        : "error"
    );
  }

  function handleSearchKeyDown(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Escape") {
      setSearchQuery("");
      setProductViewMode("brands");
      setExpandedProductId(null);
    }
  }

  async function saveCustomerProfile(
    saleAmount: number
  ): Promise<number | null> {
    const name = customerName.trim();
    const phone = customerPhone.trim();

    if (!name && !phone) {
      return null;
    }

    const now = new Date().toISOString();

    let customerQuery = supabase
      .from("customers")
      .select("id,total_orders,total_spent")
      .limit(1);

    customerQuery = phone
      ? customerQuery.eq("phone", phone)
      : customerQuery.eq("full_name", name);

    const { data: existingCustomer, error: loadError } =
      await customerQuery.maybeSingle();

    if (loadError) {
      throw loadError;
    }

    if (existingCustomer?.id) {
      const { data: updatedCustomer, error: updateError } =
        await supabase
          .from("customers")
          .update({
            full_name: name || "Customer",
            phone: phone || null,
            total_orders:
              toNumber(existingCustomer.total_orders) + 1,
            total_spent:
              toNumber(existingCustomer.total_spent) + saleAmount,
            is_blocked: false,
            whatsapp_opt_in: customerWhatsAppOptIn,
            marketing_consent_at:
              customerWhatsAppOptIn ? now : null,
            updated_at: now,
          })
          .eq("id", existingCustomer.id)
          .select("id")
          .single();

      if (updateError) {
        throw updateError;
      }

      return Number(updatedCustomer.id);
    }

    const { data: newCustomer, error: insertError } =
      await supabase
        .from("customers")
        .insert({
          full_name: name || "Customer",
          email: null,
          phone: phone || null,
          address: null,
          city: null,
          state: null,
          pincode: null,
          total_orders: 1,
          total_spent: saleAmount,
          is_blocked: false,
          whatsapp_opt_in: customerWhatsAppOptIn,
          marketing_consent_at:
            customerWhatsAppOptIn ? now : null,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();

    if (insertError) {
      throw insertError;
    }

    return Number(newCustomer.id);
  }

  async function saveCustomerCredit(
    saleId: string | number | null | undefined,
    invoiceNumber: string,
    syncedCustomerId: number | null
  ) {
    if (
      paymentMethod !== "credit" ||
      creditDueAmount <= 0
    ) {
      return;
    }

    const phone = customerPhone.trim();
    const name = customerName.trim();
    const now = new Date().toISOString();

    const { data: existingAccount, error: accountLoadError } =
      await supabase
        .from("customer_credit_accounts")
        .select("*")
        .eq("customer_phone", phone)
        .maybeSingle();

    if (accountLoadError) {
      throw accountLoadError;
    }

    const previousBalance = toNumber(
      existingAccount?.current_balance
    );
    const previousGiven = toNumber(
      existingAccount?.total_credit_given
    );
    const previousPaid = toNumber(
      existingAccount?.total_credit_paid
    );

    let creditAccountId: string | number;
    let customerId: string | number | null =
      syncedCustomerId ||
      existingAccount?.customer_id ||
      null;

    if (existingAccount?.id) {
      const { data: updatedAccount, error: updateError } =
        await supabase
          .from("customer_credit_accounts")
          .update({
            customer_id: customerId,
            customer_name: name,
            customer_phone: phone,
            total_credit_given:
              previousGiven + finalPayable,
            total_credit_paid:
              previousPaid + safeCreditPaidNow,
            current_balance:
              previousBalance + creditDueAmount,
            last_credit_date: now,
            last_payment_date:
              safeCreditPaidNow > 0
                ? now
                : existingAccount.last_payment_date,
            next_due_date: creditDueDate,
            is_active: true,
            updated_at: now,
          })
          .eq("id", existingAccount.id)
          .select("id,customer_id")
          .single();

      if (updateError) {
        throw updateError;
      }

      creditAccountId = updatedAccount.id;
      customerId =
        updatedAccount.customer_id || customerId;
    } else {
      const { data: newAccount, error: insertError } =
        await supabase
          .from("customer_credit_accounts")
          .insert({
            customer_id: customerId,
            customer_name: name,
            customer_phone: phone,
            customer_email: null,
            customer_address: null,
            credit_limit: 0,
            total_credit_given: finalPayable,
            total_credit_paid: safeCreditPaidNow,
            current_balance: creditDueAmount,
            last_credit_date: now,
            last_payment_date:
              safeCreditPaidNow > 0 ? now : null,
            next_due_date: creditDueDate,
            is_blocked: false,
            is_active: true,
            notes: null,
            created_at: now,
            updated_at: now,
          })
          .select("id,customer_id")
          .single();

      if (insertError) {
        throw insertError;
      }

      creditAccountId = newAccount.id;
      customerId = newAccount.customer_id || null;
    }

    const creditTransaction = {
      credit_account_id: creditAccountId,
      customer_id: customerId,
      customer_phone: phone,
      sale_id: saleId || null,
      transaction_type: "credit_sale",
      amount_change: finalPayable,
      balance_before: previousBalance,
      balance_after:
        previousBalance + finalPayable,
      payment_method: "credit",
      reference_number: invoiceNumber,
      due_date: creditDueDate,
      description: `POS credit sale ${invoiceNumber}`,
      notes:
        safeCreditPaidNow > 0
          ? `Paid now ${formatCurrency(
              safeCreditPaidNow
            )}; due ${formatCurrency(
              creditDueAmount
            )}`
          : null,
      received_by: null,
      created_at: now,
    };

    const transactions = [creditTransaction];

    if (safeCreditPaidNow > 0) {
      transactions.push({
        ...creditTransaction,
        transaction_type: "payment",
        amount_change: -safeCreditPaidNow,
        balance_before:
          previousBalance + finalPayable,
        balance_after:
          previousBalance + creditDueAmount,
        payment_method: "cash",
        description: `Advance payment received for ${invoiceNumber}`,
        notes: null,
      });
    }

    const { error: transactionError } =
      await supabase
        .from("customer_credit_transactions")
        .insert(transactions);

    if (transactionError) {
      throw transactionError;
    }

    if (saleId) {
      const { error: saleAmountError } =
        await supabase
          .from("sales")
          .update({
            paid_amount: safeCreditPaidNow,
            due_amount: creditDueAmount,
          })
          .eq("id", saleId);

      if (saleAmountError) {
        console.info(
          "Sale paid/due columns were not updated:",
          saleAmountError.message
        );
      }

      const { error: saleDueDateError } =
        await supabase
          .from("sales")
          .update({
            due_date: creditDueDate,
          })
          .eq("id", saleId);

      if (saleDueDateError) {
        console.info(
          "Sale due date column is not available:",
          saleDueDateError.message
        );
      }
    }
  }

  function safePdfFileName(value: string) {
    return (
      value
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "NEW-CITY-STYLE-INVOICE"
    );
  }

  function generateCustomerInvoicePdf(sale: CompletedSale) {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const left = 14;
    const right = pageWidth - 14;
    const contentWidth = right - left;

    const royalBlue: [number, number, number] = [10, 46, 115];
    const deepBlue: [number, number, number] = [3, 21, 63];
    const gold: [number, number, number] = [212, 175, 55];
    const charcoal: [number, number, number] = [44, 44, 44];
    const softGray: [number, number, number] = [112, 120, 130];

    function money(value: number) {
      return `Rs. ${toNumber(value).toFixed(2)}`;
    }

    function addPageHeader() {
      pdf.setFillColor(...deepBlue);
      pdf.roundedRect(left, 12, contentWidth, 42, 4, 4, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.text("NEW CITY STYLE", left + 7, 23);

      pdf.setTextColor(...gold);
      pdf.setFontSize(11);
      pdf.text("Style for Every Family", left + 7, 30);

      pdf.setTextColor(245, 245, 245);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.text(
        [
          "Main Road, Sarubujjili",
          "Srikakulam, Andhra Pradesh - 532458",
          "Mobile: 9010014001",
          "Email: badri.nsv@gmail.com",
        ],
        left + 7,
        36,
        { lineHeightFactor: 1.35 },
      );

      pdf.setDrawColor(...gold);
      pdf.setFillColor(...royalBlue);
      pdf.roundedRect(right - 58, 17, 51, 30, 3, 3, "FD");

      pdf.setTextColor(...gold);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.text("CUSTOMER INVOICE", right - 54, 23);

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      const invoiceLines = pdf.splitTextToSize(
        sale.invoiceNumber,
        43,
      );
      pdf.text(invoiceLines, right - 54, 29);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.text(
        new Date(sale.completedAt).toLocaleString("en-IN"),
        right - 54,
        43,
      );
    }

    addPageHeader();

    let y = 62;

    pdf.setFillColor(248, 249, 251);
    pdf.setDrawColor(222, 227, 234);
    pdf.roundedRect(left, y, contentWidth / 2 - 3, 22, 3, 3, "FD");
    pdf.roundedRect(
      left + contentWidth / 2 + 3,
      y,
      contentWidth / 2 - 3,
      22,
      3,
      3,
      "FD",
    );

    pdf.setTextColor(...softGray);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.text("CUSTOMER", left + 5, y + 6);
    pdf.text("PAYMENT", left + contentWidth / 2 + 8, y + 6);

    pdf.setTextColor(...royalBlue);
    pdf.setFontSize(10);
    pdf.text(
      sale.customerName || "Walk-in Customer",
      left + 5,
      y + 13,
    );
    pdf.text(
      sale.paymentMethod.toUpperCase(),
      left + contentWidth / 2 + 8,
      y + 13,
    );

    pdf.setTextColor(...charcoal);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(
      sale.customerPhone || "Mobile not provided",
      left + 5,
      y + 18,
    );
    pdf.text(
      sale.dueAmount > 0 ? "Credit / Due Bill" : "Paid Bill",
      left + contentWidth / 2 + 8,
      y + 18,
    );

    y += 30;

    const columns = {
      no: left,
      product: left + 9,
      qty: right - 58,
      rate: right - 39,
      amount: right,
    };

    pdf.setFillColor(...royalBlue);
    pdf.rect(left, y, contentWidth, 9, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("#", columns.no + 2, y + 6);
    pdf.text("PRODUCT / VARIANT", columns.product, y + 6);
    pdf.text("QTY", columns.qty, y + 6, { align: "right" });
    pdf.text("RATE", columns.rate, y + 6, { align: "right" });
    pdf.text("AMOUNT", columns.amount - 2, y + 6, { align: "right" });

    y += 9;

    sale.items.forEach((item, index) => {
      const variant =
        [item.size, item.color].filter(Boolean).join(" / ") ||
        item.barcode ||
        item.sku ||
        "Standard Product";

      const productLines = pdf.splitTextToSize(item.name, 78);
      const variantLines = pdf.splitTextToSize(variant, 78);
      const rowHeight = Math.max(
        13,
        productLines.length * 4.2 + variantLines.length * 3.4 + 3,
      );

      if (y + rowHeight > pageHeight - 58) {
        pdf.addPage();
        addPageHeader();
        y = 62;

        pdf.setFillColor(...royalBlue);
        pdf.rect(left, y, contentWidth, 9, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text("#", columns.no + 2, y + 6);
        pdf.text("PRODUCT / VARIANT", columns.product, y + 6);
        pdf.text("QTY", columns.qty, y + 6, { align: "right" });
        pdf.text("RATE", columns.rate, y + 6, { align: "right" });
        pdf.text("AMOUNT", columns.amount - 2, y + 6, { align: "right" });
        y += 9;
      }

      if (index % 2 === 0) {
        pdf.setFillColor(250, 251, 253);
        pdf.rect(left, y, contentWidth, rowHeight, "F");
      }

      pdf.setDrawColor(228, 232, 238);
      pdf.line(left, y + rowHeight, right, y + rowHeight);

      pdf.setTextColor(...charcoal);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.text(String(index + 1), columns.no + 2, y + 6);
      pdf.text(productLines, columns.product, y + 5.5);

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...softGray);
      pdf.setFontSize(7);
      pdf.text(
        variantLines,
        columns.product,
        y + 5.5 + productLines.length * 4.2,
      );

      pdf.setTextColor(...charcoal);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(String(item.quantity), columns.qty, y + 7, {
        align: "right",
      });
      pdf.text(money(item.price), columns.rate, y + 7, {
        align: "right",
      });
      pdf.text(
        money(item.price * item.quantity),
        columns.amount - 2,
        y + 7,
        { align: "right" },
      );

      y += rowHeight;
    });

    y += 8;

    if (y > pageHeight - 82) {
      pdf.addPage();
      addPageHeader();
      y = 64;
    }

    const totalsX = right - 78;
    const totalsWidth = 78;

    pdf.setFillColor(248, 249, 251);
    pdf.setDrawColor(222, 227, 234);
    pdf.roundedRect(totalsX, y, totalsWidth, 56, 3, 3, "FD");

    const totalRows = [
      ["Subtotal", sale.subtotal],
      ["Tax", sale.taxAmount],
      ["Discount", -sale.billDiscount],
      ["Round Off", -sale.roundOff],
      ["Paid", sale.paidAmount],
      ["Due", sale.dueAmount],
    ] as const;

    let totalY = y + 7;

    totalRows.forEach(([label, value]) => {
      pdf.setTextColor(...softGray);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(label, totalsX + 5, totalY);

      pdf.setTextColor(
        label === "Due" && Number(value) > 0 ? 180 : charcoal[0],
        label === "Due" && Number(value) > 0 ? 35 : charcoal[1],
        label === "Due" && Number(value) > 0 ? 24 : charcoal[2],
      );
      pdf.setFont("helvetica", "bold");
      pdf.text(money(Number(value)), right - 5, totalY, {
        align: "right",
      });

      totalY += 7;
    });

    pdf.setFillColor(...royalBlue);
    pdf.roundedRect(totalsX, y + 58, totalsWidth, 14, 3, 3, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("TOTAL", totalsX + 5, y + 67);
    pdf.text(money(sale.totalAmount), right - 5, y + 67, {
      align: "right",
    });

    const footerY = pageHeight - 24;
    pdf.setDrawColor(...gold);
    pdf.setLineWidth(0.7);
    pdf.line(left, footerY, right, footerY);

    pdf.setTextColor(...royalBlue);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(
      "Thank you for shopping with NEW CITY STYLE.",
      pageWidth / 2,
      footerY + 7,
      { align: "center" },
    );

    pdf.setTextColor(...softGray);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text(
      "We look forward to serving your family again.",
      pageWidth / 2,
      footerY + 12,
      { align: "center" },
    );
    pdf.text(
      "NEW CITY STYLE - Style for Every Family",
      pageWidth / 2,
      footerY + 17,
      { align: "center" },
    );

    return pdf;
  }

  async function buildCanonicalInvoicePayload(
    sale: CompletedSale,
    sendWhatsApp: boolean,
  ) {
    const digits = sale.customerPhone.replace(/\D/g, "");
    const recipientPhone =
      digits.length === 10 ? `91${digits}` : digits;

    let freshInvoiceStudioSettings =
      invoiceStudioSettings;

    try {
      const { data, error } = await supabase
        .from("ncs_invoice_settings")
        .select("*")
        .eq("id", "default")
        .maybeSingle();

      if (!error && data) {
        freshInvoiceStudioSettings = {
          ...POS_INVOICE_STUDIO_FALLBACK,
          ...invoiceStudioSettings,
          ...(data as Partial<PosInvoiceStudioSettings>),
          thermal_width:
            Number(data.thermal_width) === 58 ? 58 : 80,
          copies: Math.min(
            3,
            Math.max(1, Number(data.copies || 1)),
          ),
        };

        setInvoiceStudioSettings(
          freshInvoiceStudioSettings,
        );
      }
    } catch (error) {
      console.info(
        "Using already loaded Invoice Studio settings:",
        error,
      );
    }

    return {
      to: recipientPhone,
      sendWhatsApp,
      customerName:
        sale.customerName.trim() || "Customer",
      customerPhone: sale.customerPhone,
      billNumber: sale.invoiceNumber,
      billDate: sale.completedAt,
      paymentMethod:
        sale.paymentMethod.toUpperCase(),
      subtotal: sale.subtotal,
      discountAmount:
        sale.billDiscount + sale.rewardDiscount,
      taxAmount: sale.taxAmount,
      roundOff: sale.roundOff,
      billAmount: sale.totalAmount,
      paidAmount: sale.paidAmount,
      dueAmount: sale.dueAmount,
      whatsappLanguage: "telugu",
      items: sale.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        mrp: item.mrp,
        price: item.price,
        total: item.price * item.quantity,
        size: item.size || "",
        color: item.color || "",
      })),
      invoiceStudio: freshInvoiceStudioSettings,
    };
  }

  async function downloadCustomerInvoicePdf(
    sale: CompletedSale,
  ) {
    try {
      showNotice(
        "Preparing Invoice Studio PDF...",
        "info",
      );

      const response = await fetch(
        "/api/whatsapp/invoice-pdf",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            await buildCanonicalInvoicePayload(
              sale,
              false,
            ),
          ),
        },
      );

      if (!response.ok) {
        let message =
          "Unable to generate the Invoice Studio PDF.";

        try {
          const result = (await response.json()) as {
            error?: string;
          };
          if (result.error) {
            message = result.error;
          }
        } catch {
          // Keep the safe fallback message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileName =
        `${safePdfFileName(sale.invoiceNumber)}.pdf`;

      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1500);

      showNotice(
        `${fileName} downloaded successfully.`,
        "success",
      );
    } catch (error) {
      console.info(
        "Unable to download canonical invoice PDF:",
        error,
      );
      showNotice(
        error instanceof Error
          ? error.message
          : "Unable to download invoice PDF.",
        "error",
      );
    }
  }

  function hasValidWhatsAppCustomerPhone(sale: CompletedSale) {
    const digits = sale.customerPhone.replace(/\D/g, "");
    const normalizedDigits =
      digits.length === 10
        ? `91${digits}`
        : digits;

    return (
      normalizedDigits.length >= 10 &&
      normalizedDigits.length <= 15
    );
  }

  async function shareCustomerInvoicePdf(sale: CompletedSale) {
    if (!hasValidWhatsAppCustomerPhone(sale)) {
      showNotice(
        "Customer mobile number is required to send the invoice on WhatsApp.",
        "info",
      );
      return;
    }

    try {
      showNotice("Sending PDF invoice directly to WhatsApp...", "info");
      await sendInvoiceMessageViaWhatsApp(sale);
      showNotice("PDF invoice sent directly on WhatsApp.", "success");
    } catch (error) {
      console.info("WhatsApp PDF invoice was not sent:", error);
      showNotice(
        error instanceof Error
          ? error.message
          : "Unable to send the PDF invoice on WhatsApp.",
        "error",
      );
    }
  }

  function buildWhatsAppInvoiceMessage(sale: CompletedSale) {
    const itemLines = sale.items
      .map((item, index) => {
        const variant =
          [item.size, item.color].filter(Boolean).join(" / ") ||
          item.barcode ||
          item.sku ||
          "";

        return [
          `${index + 1}. ${item.name}`,
          variant ? `   ${variant}` : "",
          `   ${item.quantity} × ${formatCurrency(item.price)} = ${formatCurrency(
            item.price * item.quantity
          )}`,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n");

    return [
      "🛍️ *NEW CITY STYLE*",
      "_Style for Every Family_",
      "",
      `🧾 *Invoice:* ${sale.invoiceNumber}`,
      `📅 *Date:* ${new Date(sale.completedAt).toLocaleString("en-IN")}`,
      `👤 *Customer:* ${sale.customerName || "Walk-in Customer"}`,
      sale.customerPhone ? `📱 *Mobile:* ${sale.customerPhone}` : "",
      "",
      "*Items*",
      itemLines,
      "",
      `Subtotal: ${formatCurrency(sale.subtotal)}`,
      `Tax: ${formatCurrency(sale.taxAmount)}`,
      `Discount: -${formatCurrency(sale.billDiscount)}`,
      `Reward Points Used: ${sale.rewardPointsUsed}`,
      `Reward Discount: -${formatCurrency(sale.rewardDiscount)}`,
      `Round Off: -${formatCurrency(sale.roundOff)}`,
      `*Total: ${formatCurrency(sale.totalAmount)}*`,
      `Paid: ${formatCurrency(sale.paidAmount)}`,
      `Due: ${formatCurrency(sale.dueAmount)}`,
      `Payment: ${sale.paymentMethod.toUpperCase()}`,
      `Points Earned: ${sale.rewardPointsEarned}`,
      `Reward Balance: ${sale.rewardClosingBalance}`,
      "",
      "Thank you for shopping with NEW CITY STYLE.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function sendInvoiceMessageViaWhatsApp(
    sale: CompletedSale
  ) {
    const digits = sale.customerPhone.replace(/\D/g, "");
    const recipientPhone =
      digits.length === 10
        ? `91${digits}`
        : digits;

    if (
      recipientPhone.length < 10 ||
      recipientPhone.length > 15
    ) {
      throw new Error(
        "A valid customer mobile number is required for WhatsApp bill message."
      );
    }

    const response = await fetch(
      "/api/whatsapp/invoice-pdf",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          await buildCanonicalInvoicePayload(
            sale,
            true,
          ),
        ),
      },
    );

    const result = (await response.json()) as {
      success?: boolean;
      message?: string;
      error?: string;
      stage?: string;
      whatsappMessageId?: string | null;
      metaErrorCode?: number | null;
      errorDetails?: string | null;
    };

    if (
      !response.ok ||
      result.success !== true
    ) {
      const stageMessage = result.stage
        ? ` (${result.stage})`
        : "";

      const detailMessage = result.errorDetails
        ? ` - ${result.errorDetails}`
        : "";

      throw new Error(
        `${result.error || "WhatsApp bill message could not be sent."}${stageMessage}${detailMessage}`,
      );
    }

    return result;
  }

  async function shareCompletedSaleOnWhatsApp(sale: CompletedSale) {
    if (!hasValidWhatsAppCustomerPhone(sale)) {
      showNotice(
        "Customer mobile number is required to send the bill on WhatsApp.",
        "info",
      );
      return;
    }

    try {
      showNotice("Sending bill message to WhatsApp...", "info");
      await sendInvoiceMessageViaWhatsApp(sale);
      showNotice("Bill message sent on WhatsApp.", "success");
    } catch (error) {
      console.info("WhatsApp text invoice was not sent:", error);
      showNotice(
        error instanceof Error
          ? error.message
          : "Unable to send the invoice on WhatsApp.",
        "error",
      );
    }
  }

  function buildCustomerInvoiceRows(
    sale: CompletedSale,
    compact = false
  ) {
    return sale.items
      .map((item, index) => {
        const variant =
          [item.size, item.color].filter(Boolean).join(" / ") ||
          item.barcode ||
          item.sku ||
          "—";

        if (compact) {
          return `
            <div class="receiptItem">
              <div class="receiptItemName">
                <span>${index + 1}. ${item.name}</span>
                <small>${variant}</small>
              </div>
              <div class="receiptItemLine">
                <span>${item.quantity} × ${formatCurrency(item.price)}</span>
                <strong>${formatCurrency(
                  item.price * item.quantity
                )}</strong>
              </div>
            </div>
          `;
        }

        return `
          <tr>
            <td>${index + 1}</td>
            <td>
              <strong>${item.name}</strong>
              <small>${variant}</small>
            </td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${formatCurrency(item.price * item.quantity)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function getInvoiceThemeColors() {
    if (invoiceStudioSettings.theme === "minimal") {
      return {
        primary: "#202733",
        accent: "#6B7280",
        soft: "#F5F7FA",
      };
    }

    if (invoiceStudioSettings.theme === "counter") {
      return {
        primary: "#0A2E73",
        accent: "#D4AF37",
        soft: "#FFF9E8",
      };
    }

    return {
      primary: "#0A2E73",
      accent: "#D4AF37",
      soft: "#F8F4EC",
    };
  }

  function printCustomerInvoiceA4(sale: CompletedSale) {
    const rows = buildCustomerInvoiceRows(sale);
    const popup = window.open("", "_blank", "width=1000,height=900");

    if (!popup) {
      showNotice(
        "Please allow popups to print the A4 invoice.",
        "error"
      );
      return;
    }

    const colors = getInvoiceThemeColors();
    const footerMessage =
      invoiceStudioSettings.footer_message.trim() ||
      "Thank you for shopping with NEW CITY STYLE.";

    const contactLines = [
      invoiceStudioSettings.show_address
        ? "Main Road, Sarubujjili • Srikakulam, Andhra Pradesh - 532458"
        : "",
      invoiceStudioSettings.show_phone
        ? "Mobile: 9010014001"
        : "",
      invoiceStudioSettings.show_email
        ? "Email: badri.nsv@gmail.com"
        : "",
    ].filter(Boolean);

    const bankBlock =
      invoiceStudioSettings.show_bank
        ? `
          <section class="payPanel">
            <strong>Bank Details</strong>
            <span>${invoiceStudioSettings.bank_name || "Bank name not configured"}</span>
            ${
              invoiceStudioSettings.account_number
                ? `<span>A/C: ${invoiceStudioSettings.account_number}</span>`
                : ""
            }
            ${
              invoiceStudioSettings.ifsc_code
                ? `<span>IFSC: ${invoiceStudioSettings.ifsc_code}</span>`
                : ""
            }
          </section>
        `
        : "";

    const upiBlock =
      invoiceStudioSettings.show_upi_qr
        ? `
          <section class="payPanel">
            <strong>UPI Payment</strong>
            <span>${invoiceStudioSettings.upi_id || "UPI ID not configured"}</span>
          </section>
        `
        : "";

    popup.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${sale.invoiceNumber}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #202020;
            font-family: Arial, sans-serif;
            background: #fff;
          }
          .invoice {
            min-height: 270mm;
            display: flex;
            flex-direction: column;
          }
          .brandHeader {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 24px;
            padding: 22px 24px;
            border: 1px solid ${colors.accent};
            border-radius: ${
              invoiceStudioSettings.theme === "minimal"
                ? "8px"
                : "16px"
            };
            background: ${
              invoiceStudioSettings.theme === "minimal"
                ? "#fff"
                : `linear-gradient(135deg, #03153F, ${colors.primary})`
            };
            color: ${
              invoiceStudioSettings.theme === "minimal"
                ? colors.primary
                : "#fff"
            };
          }
          .storeName {
            margin: 0;
            color: inherit;
            font-size: 34px;
            font-weight: 900;
            letter-spacing: 1.2px;
          }
          .tagline {
            margin: 4px 0 12px;
            color: ${colors.accent};
            font-size: 15px;
            font-weight: 800;
          }
          .storeDetails {
            margin: 0;
            color: ${
              invoiceStudioSettings.theme === "minimal"
                ? "#5f6670"
                : "rgba(255,255,255,.88)"
            };
            font-size: 12px;
            line-height: 1.65;
          }
          .invoiceBadge {
            min-width: 220px;
            padding: 16px;
            border: 1px solid ${colors.accent};
            border-radius: 12px;
            background: ${
              invoiceStudioSettings.theme === "minimal"
                ? colors.soft
                : "rgba(255,255,255,.08)"
            };
          }
          .invoiceBadge span,
          .invoiceBadge strong {
            display: block;
          }
          .invoiceBadge span {
            color: ${colors.accent};
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .invoiceBadge strong {
            margin-top: 5px;
            font-size: 16px;
          }
          .invoiceBadge p {
            margin: 8px 0 0;
            font-size: 11px;
            line-height: 1.5;
          }
          .infoGrid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 16px;
          }
          .infoBox {
            padding: 14px;
            border: 1px solid #dfe4eb;
            border-radius: 11px;
            background: #fafbfc;
          }
          .infoBox span {
            display: block;
            color: #7b8491;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .infoBox strong {
            display: block;
            margin-top: 5px;
            color: ${colors.primary};
            font-size: 13px;
          }
          .infoBox p {
            margin: 5px 0 0;
            font-size: 11px;
            line-height: 1.5;
          }
          table {
            width: 100%;
            margin-top: 16px;
            border-collapse: collapse;
          }
          th, td {
            padding: 10px 9px;
            border: 1px solid #dfe4eb;
            text-align: left;
            vertical-align: top;
            font-size: 11px;
          }
          th {
            background: ${colors.primary};
            color: #fff;
            font-size: 10px;
            text-transform: uppercase;
          }
          td small {
            display: block;
            margin-top: 3px;
            color: #7b8491;
          }
          .totalsWrap {
            width: 360px;
            margin: 18px 0 0 auto;
            padding: 14px;
            border: 1px solid #dfe4eb;
            border-radius: 12px;
            background: #fafbfc;
          }
          .totalLine {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding: 7px 0;
            border-bottom: 1px solid #e9edf2;
            font-size: 11px;
          }
          .grandTotal {
            margin-top: 6px;
            padding: 12px;
            border-radius: 9px;
            background: ${colors.primary};
            color: #fff;
            font-size: 17px;
            font-weight: 900;
          }
          .dueLine {
            color: #B42318;
            font-weight: 900;
          }
          .paymentGrid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-top: 16px;
          }
          .payPanel {
            padding: 12px;
            border: 1px solid #dfe4eb;
            border-radius: 10px;
            background: ${colors.soft};
            font-size: 10px;
          }
          .payPanel strong,
          .payPanel span {
            display: block;
          }
          .payPanel strong {
            color: ${colors.primary};
            margin-bottom: 5px;
          }
          .payPanel span {
            color: #59616d;
            margin-top: 3px;
          }
          .terms {
            margin-top: 16px;
            padding: 11px 13px;
            border-radius: 10px;
            background: #f7f8fa;
            color: #667085;
            font-size: 10px;
            line-height: 1.5;
          }
          .footer {
            margin-top: auto;
            padding-top: 22px;
            text-align: center;
          }
          .footerMessage {
            padding: 14px;
            border-top: 2px solid ${colors.accent};
            color: ${colors.primary};
            font-size: 13px;
            font-weight: 800;
          }
          .footer small {
            display: block;
            margin-top: 6px;
            color: #6f7782;
            font-size: 10px;
          }
          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice">
          <header class="brandHeader">
            <div>
              ${
                invoiceStudioSettings.show_logo
                  ? `<div style="display:inline-grid;place-items:center;width:50px;height:50px;margin-bottom:8px;border:1px solid ${colors.accent};border-radius:14px;font-weight:900;color:${colors.accent};">NCS</div>`
                  : ""
              }
              <h1 class="storeName">NEW CITY STYLE</h1>
              <p class="tagline">Style for Every Family</p>
              ${
                contactLines.length > 0
                  ? `<p class="storeDetails">${contactLines.join("<br/>")}</p>`
                  : ""
              }
            </div>

            <div class="invoiceBadge">
              <span>Tax Invoice / Customer Bill</span>
              <strong>${sale.invoiceNumber}</strong>
              <p>${new Date(sale.completedAt).toLocaleString("en-IN")}</p>
            </div>
          </header>

          <section class="infoGrid">
            <div class="infoBox">
              <span>Customer</span>
              <strong>${sale.customerName || "Walk-in Customer"}</strong>
              <p>${sale.customerPhone || "Mobile not provided"}</p>
            </div>

            <div class="infoBox">
              <span>Payment</span>
              <strong>${sale.paymentMethod.toUpperCase()}</strong>
              <p>${sale.dueAmount > 0 ? "Credit / Due Bill" : "Paid Bill"}</p>
            </div>
          </section>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product / Variant</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <section class="totalsWrap">
            <div class="totalLine"><span>Subtotal</span><strong>${formatCurrency(sale.subtotal)}</strong></div>
            <div class="totalLine"><span>GST Included</span><strong>${formatCurrency(sale.taxAmount)}</strong></div>
            <div class="totalLine"><span>Discount</span><strong>-${formatCurrency(sale.billDiscount)}</strong></div>
            <div class="totalLine"><span>Reward Points Used</span><strong>${sale.rewardPointsUsed}</strong></div>
            <div class="totalLine"><span>Reward Discount</span><strong>-${formatCurrency(sale.rewardDiscount)}</strong></div>
            <div class="totalLine"><span>Round Off</span><strong>-${formatCurrency(sale.roundOff)}</strong></div>
            <div class="totalLine grandTotal"><span>Total</span><strong>${formatCurrency(sale.totalAmount)}</strong></div>
            <div class="totalLine"><span>Paid</span><strong>${formatCurrency(sale.paidAmount)}</strong></div>
            <div class="totalLine dueLine"><span>Due</span><strong>${formatCurrency(sale.dueAmount)}</strong></div>
            <div class="totalLine"><span>Points Earned</span><strong>${sale.rewardPointsEarned}</strong></div>
            <div class="totalLine"><span>Reward Balance</span><strong>${sale.rewardClosingBalance}</strong></div>
          </section>

          ${
            bankBlock || upiBlock
              ? `<div class="paymentGrid">${upiBlock}${bankBlock}</div>`
              : ""
          }

          ${
            invoiceStudioSettings.show_terms &&
            invoiceStudioSettings.terms_text.trim()
              ? `<section class="terms">${invoiceStudioSettings.terms_text}</section>`
              : ""
          }

          <footer class="footer">
            <div class="footerMessage">${footerMessage}</div>
            <small>NEW CITY STYLE — Style for Every Family</small>
          </footer>
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
      </html>
    `);

    popup.document.close();
  }

  function printCustomerInvoiceT82(sale: CompletedSale) {
    const rows = buildCustomerInvoiceRows(sale, true);
    const thermalWidth =
      invoiceStudioSettings.thermal_width === 58 ? 58 : 80;

    const contentWidth =
      thermalWidth === 58 ? 48 : 66;

    const marginLeft =
      thermalWidth === 58 ? 4 : 4;

    const marginRight =
      thermalWidth === 58 ? 4 : 5;

    const itemCount = Math.max(1, sale.items.length);
    const receiptHeightMm = Math.min(
      280,
      Math.max(160, 145 + itemCount * 12),
    );

    const popup = window.open(
      "",
      "_blank",
      thermalWidth === 58
        ? "width=360,height=900"
        : "width=430,height=900"
    );

    if (!popup) {
      showNotice(
        `Please allow popups to print the ${thermalWidth}mm receipt.`,
        "error"
      );
      return;
    }

    const colors = getInvoiceThemeColors();
    const footerMessage =
      invoiceStudioSettings.footer_message.trim() ||
      "Thank you for shopping with NEW CITY STYLE.";

    const addressLines = [
      invoiceStudioSettings.show_address
        ? "Main Road, Sarubujjili"
        : "",
      invoiceStudioSettings.show_address
        ? "Srikakulam, Andhra Pradesh - 532458"
        : "",
      invoiceStudioSettings.show_phone
        ? "Mob: 9010014001"
        : "",
      invoiceStudioSettings.show_email
        ? "badri.nsv@gmail.com"
        : "",
    ].filter(Boolean);

    const paymentBlocks = [
      invoiceStudioSettings.show_upi_qr
        ? invoiceStudioSettings.upi_id
          ? `UPI: ${invoiceStudioSettings.upi_id}`
          : "UPI ID: configure in Invoice Studio"
        : "",
      invoiceStudioSettings.show_bank
        ? [
            invoiceStudioSettings.bank_name,
            invoiceStudioSettings.account_number
              ? `A/C ${invoiceStudioSettings.account_number}`
              : "",
            invoiceStudioSettings.ifsc_code
              ? `IFSC ${invoiceStudioSettings.ifsc_code}`
              : "",
          ]
            .filter(Boolean)
            .join(" • ")
        : "",
    ].filter(Boolean);

    const pageMargin = `2mm ${marginRight}mm 2mm ${marginLeft}mm`;

    popup.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${sale.invoiceNumber}</title>
        <style>
          @page {
            size: ${thermalWidth}mm ${receiptHeightMm}mm;
            margin: ${pageMargin};
          }
          * { box-sizing: border-box; }
          html, body {
            width: ${contentWidth}mm;
            max-width: ${contentWidth}mm;
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: #fff;
            color: #000;
            font-family: Arial, Helvetica, sans-serif;
            font-weight: ${invoiceStudioSettings.bold_text ? "800" : "600"};
          }
          .receipt {
            width: ${contentWidth}mm;
            max-width: ${contentWidth}mm;
            height: auto;
            min-height: 0;
            padding: 1mm 0 0;
            overflow: hidden;
          }
          .center { text-align: center; }
          .logo {
            width: 13mm;
            height: 13mm;
            display: grid;
            place-items: center;
            margin: 0 auto 2mm;
            border: 1px solid ${colors.accent};
            border-radius: 3mm;
            color: ${colors.primary};
            font-size: 10px;
            font-weight: 1000;
          }
          .storeName {
            margin: 0;
            font-size: ${thermalWidth === 58 ? "17px" : "22px"};
            font-weight: 1000;
            letter-spacing: .6px;
            line-height: 1.05;
          }
          .tagline {
            margin: 2px 0 4px;
            font-size: ${thermalWidth === 58 ? "9px" : "12px"};
            font-weight: 900;
            color: ${
              invoiceStudioSettings.theme === "minimal"
                ? "#000"
                : colors.primary
            };
          }
          .address {
            margin: 0;
            font-size: ${thermalWidth === 58 ? "8px" : "9.5px"};
            font-weight: 700;
            line-height: 1.35;
          }
          .divider {
            margin: 4px 0;
            border-top: ${
              invoiceStudioSettings.theme === "counter"
                ? `2px solid ${colors.primary}`
                : "1px dashed #000"
            };
          }
          .meta {
            width: 100%;
            font-size: ${thermalWidth === 58 ? "8.5px" : "9.5px"};
            font-weight: 800;
            line-height: 1.4;
          }
          .metaRow,
          .receiptItemLine,
          .totalRow {
            width: 100%;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: start;
            gap: 5px;
          }
          .metaRow span,
          .receiptItemLine span,
          .totalRow span {
            min-width: 0;
            overflow-wrap: anywhere;
          }
          .metaRow strong,
          .receiptItemLine strong,
          .totalRow strong {
            max-width: ${thermalWidth === 58 ? "27mm" : "36mm"};
            text-align: right;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .receiptItem {
            padding: 3px 0;
            border-bottom: 1px dotted #000;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .receiptItemName span {
            display: block;
            max-width: 100%;
            font-size: ${thermalWidth === 58 ? "10px" : "12px"};
            font-weight: 1000;
            overflow-wrap: anywhere;
          }
          .receiptItemName small {
            display: block;
            max-width: 100%;
            margin-top: 2px;
            font-size: ${thermalWidth === 58 ? "7.5px" : "9px"};
            font-weight: 800;
            overflow-wrap: anywhere;
          }
          .receiptItemLine {
            margin-top: 3px;
            font-size: ${thermalWidth === 58 ? "8.5px" : "10px"};
            font-weight: 900;
          }
          .totals {
            width: 100%;
            margin-top: 4px;
            font-size: ${thermalWidth === 58 ? "8.5px" : "9.8px"};
            font-weight: 900;
            line-height: 1.45;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .grand {
            padding: 5px 0;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            font-size: ${thermalWidth === 58 ? "12px" : "14px"};
            font-weight: 1000;
          }
          .due {
            font-weight: 1000;
          }
          .paymentInfo,
          .terms,
          .thanks {
            margin-top: 6px;
            font-size: ${thermalWidth === 58 ? "8px" : "9px"};
            font-weight: 800;
            line-height: 1.4;
            text-align: center;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .terms {
            padding: 4px 0;
            border-top: 1px dashed #000;
          }
          .footer {
            margin-top: 4px;
            font-size: ${thermalWidth === 58 ? "7px" : "8.5px"};
            font-weight: 900;
            line-height: 1.3;
            text-align: center;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          @media print {
            html, body, .receipt {
              width: ${contentWidth}mm !important;
              max-width: ${contentWidth}mm !important;
              min-height: 0 !important;
            }
            html, body {
              height: auto !important;
              overflow: hidden !important;
            }
            .receipt {
              break-after: avoid-page !important;
              page-break-after: avoid !important;
            }
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="center">
            ${
              invoiceStudioSettings.show_logo
                ? `<div class="logo">NCS</div>`
                : ""
            }
            <h1 class="storeName">NEW CITY STYLE</h1>
            <p class="tagline">Style for Every Family</p>
            ${
              addressLines.length > 0
                ? `<p class="address">${addressLines.join("<br/>")}</p>`
                : ""
            }
          </div>

          <div class="divider"></div>

          <div class="meta">
            <div class="metaRow"><span>Invoice</span><strong>${sale.invoiceNumber}</strong></div>
            <div class="metaRow"><span>Date</span><strong>${new Date(sale.completedAt).toLocaleString("en-IN")}</strong></div>
            <div class="metaRow"><span>Customer</span><strong>${sale.customerName || "Walk-in"}</strong></div>
            ${
              sale.customerPhone
                ? `<div class="metaRow"><span>Mobile</span><strong>${sale.customerPhone}</strong></div>`
                : ""
            }
            <div class="metaRow"><span>Payment</span><strong>${sale.paymentMethod.toUpperCase()}</strong></div>
          </div>

          <div class="divider"></div>

          ${rows}

          <div class="totals">
            <div class="totalRow"><span>Subtotal</span><strong>${formatCurrency(sale.subtotal)}</strong></div>
            <div class="totalRow"><span>GST Included</span><strong>${formatCurrency(sale.taxAmount)}</strong></div>
            <div class="totalRow"><span>Discount</span><strong>-${formatCurrency(sale.billDiscount)}</strong></div>
            <div class="totalRow"><span>Reward Used</span><strong>${sale.rewardPointsUsed}</strong></div>
            <div class="totalRow"><span>Reward Disc.</span><strong>-${formatCurrency(sale.rewardDiscount)}</strong></div>
            <div class="totalRow"><span>Round Off</span><strong>-${formatCurrency(sale.roundOff)}</strong></div>
            <div class="totalRow grand"><span>TOTAL</span><strong>${formatCurrency(sale.totalAmount)}</strong></div>
            <div class="totalRow"><span>Paid</span><strong>${formatCurrency(sale.paidAmount)}</strong></div>
            <div class="totalRow due"><span>Due</span><strong>${formatCurrency(sale.dueAmount)}</strong></div>
            <div class="totalRow"><span>Points Earned</span><strong>${sale.rewardPointsEarned}</strong></div>
            <div class="totalRow"><span>Reward Balance</span><strong>${sale.rewardClosingBalance}</strong></div>
          </div>

          ${
            paymentBlocks.length > 0
              ? `<div class="paymentInfo">${paymentBlocks.join("<br/>")}</div>`
              : ""
          }

          ${
            invoiceStudioSettings.show_terms &&
            invoiceStudioSettings.terms_text.trim()
              ? `<div class="terms">${invoiceStudioSettings.terms_text}</div>`
              : ""
          }

          <div class="divider"></div>

          <div class="thanks">
            ${footerMessage}
          </div>

          <div class="footer">
            NEW CITY STYLE — Style for Every Family
            ${
              invoiceStudioSettings.copies > 1
                ? `<br/>Studio copies setting: ${invoiceStudioSettings.copies}`
                : ""
            }
          </div>
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
      </html>
    `);

    popup.document.close();
  }

  function openInvoiceStudioFromPos() {
    window.open(
      "/admin/invoice-studio",
      "_blank",
      "noopener,noreferrer"
    );
  }

  function startNewBill() {
    setCompletedSale(null);
    window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }

  async function handleCompleteSale() {
    if (saleSubmissionLockRef.current || isCompletingSale) {
      return;
    }

    if (cartItems.length === 0) {
      showNotice(
        "Add products before completing the sale.",
        "error"
      );
      return;
    }

    if (
      paymentMethod === "credit" &&
      !customerName.trim()
    ) {
      showNotice(
        "Customer name is required for a credit bill.",
        "error"
      );
      return;
    }

    if (
      paymentMethod === "credit" &&
      !customerPhone.trim()
    ) {
      showNotice(
        "Customer mobile number is required for a credit bill.",
        "error"
      );
      return;
    }

    if (
      paymentMethod === "credit" &&
      !creditDueDate
    ) {
      showNotice(
        "Select a due date for the credit bill.",
        "error"
      );
      return;
    }

    if (
      paymentMethod === "credit" &&
      creditDueAmount <= 0
    ) {
      showNotice(
        "Due amount must be greater than zero for a credit bill.",
        "error"
      );
      return;
    }

    const invalidStockItem = cartItems.find(
      (item) =>
        item.quantity <= 0 ||
        (!item.isQuickItem && item.quantity > item.stock)
    );

    if (invalidStockItem) {
      showNotice(
        `Available stock changed for ${invalidStockItem.name}. Refresh stock and try again.`,
        "error"
      );
      return;
    }

    saleSubmissionLockRef.current = true;
    setIsCompletingSale(true);

    try {
      const clientTransactionId =
        isBrowserOnline()
          ? typeof crypto !== "undefined" &&
              "randomUUID" in crypto
            ? crypto.randomUUID()
            : `POS-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 10)}`
          : createOfflineClientTransactionId();

      if (!isBrowserOnline()) {
        const offlineInvoiceNumber =
          createOfflineInvoiceNumber();
        const completedAt = new Date().toISOString();

        const pendingSale = await saveOfflineSale({
          clientTransactionId,
          offlineInvoiceNumber,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerWhatsAppOptIn,
          items: cartItems.map((item) => ({ ...item })),
          subtotal,
          taxAmount: itemTax,
          billDiscountPercent: safeBillDiscountPercent,
          billDiscountAmount,
          rewardPointsUsed: safeRewardPointsToUse,
          rewardDiscountAmount,
          roundOffAmount: safeRoundOffAmount,
          finalPayable,
          paidAmount: safeCreditPaidNow,
          dueAmount: creditDueAmount,
          paymentMethod,
          creditDueDate:
            paymentMethod === "credit"
              ? creditDueDate
              : undefined,
          createdAt: completedAt,
          updatedAt: completedAt,
          whatsappStatus: customerPhone.trim()
            ? "PENDING"
            : "NOT_REQUIRED",
          whatsappError: null,
        });

        const offlineSaleSnapshot: CompletedSale = {
          saleId: pendingSale.id,
          invoiceNumber: offlineInvoiceNumber,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          items: cartItems.map((item) => ({ ...item })),
          subtotal,
          taxAmount: itemTax,
          billDiscount: billDiscountAmount,
          rewardPointsUsed: safeRewardPointsToUse,
          rewardDiscount: rewardDiscountAmount,
          rewardPointsEarned: 0,
          rewardClosingBalance: Math.max(
            0,
            availableRewardPoints - safeRewardPointsToUse,
          ),
          roundOff: safeRoundOffAmount,
          totalAmount: finalPayable,
          paidAmount: safeCreditPaidNow,
          dueAmount: creditDueAmount,
          paymentMethod,
          completedAt,
        };

        setCompletedSale(offlineSaleSnapshot);
        setProducts((current) =>
          current.map((product) => {
            const soldItem = cartItems.find(
              (item) =>
                !item.isQuickItem && item.key === product.key,
            );

            return soldItem
              ? {
                  ...product,
                  stock: Math.max(
                    0,
                    product.stock - soldItem.quantity,
                  ),
                }
              : product;
          }),
        );

        setCartItems([]);
        setBillDiscountPercent(0);
        setRoundOffAmount(0);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerWhatsAppOptIn(false);
        setRewardCustomerId(null);
        setAvailableRewardPoints(0);
        setRewardPointsToUse(0);
        setRewardCustomerFound(false);
        setPaymentMethod("cash");
        setCreditPaidNow(0);
        setCreditDueDate(getDefaultCreditDueDate());
        setMobileCartOpen(false);
        setSearchQuery("");
        setPendingOfflineBills(
          await countPendingOfflineSales(),
        );
        await loadPosOverview();

        showNotice(
          `${offlineInvoiceNumber} saved safely offline. It will sync and send WhatsApp after internet returns.`,
          "success",
        );

        window.setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
        return;
      }

      const rpcItems: Array<{
        product_id: number;
        variant_id: number | null;
        quantity: number;
        unit_price: number;
        mrp: number;
        tax_percent: number;
        is_quick_item: boolean;
      }> = [];

      for (const item of cartItems) {
        if (!item.isQuickItem) {
          rpcItems.push({
            product_id: item.productId,
            variant_id: item.variantId,
            quantity: item.quantity,
            unit_price: Number(item.price.toFixed(2)),
            mrp: Number(item.mrp.toFixed(2)),
            tax_percent: Number(
              Math.max(0, item.taxPercent).toFixed(2),
            ),
            is_quick_item: false,
          });
          continue;
        }

        const quickProduct = await createQuickProductForSale(item);
        rpcItems.push({
          product_id: quickProduct.productId,
          variant_id: quickProduct.variantId,
          quantity: item.quantity,
          unit_price: Number(item.price.toFixed(2)),
          mrp: Number(item.mrp.toFixed(2)),
          tax_percent: Number(
            Math.max(0, item.taxPercent).toFixed(2),
          ),
          is_quick_item: true,
        });
      }

      const { data, error } = await supabase.rpc(
        "complete_pos_sale",
        {
          p_items: rpcItems,
          p_customer_name:
            customerName.trim() || null,
          p_customer_phone:
            customerPhone.trim() || null,
          p_customer_email: null,
          p_payment_method: paymentMethod,
          p_bill_discount:
            billDiscountAmount + rewardDiscountAmount,
          p_round_off: safeRoundOffAmount,
          p_notes:
            cartItems.some((item) => item.isQuickItem)
              ? `${cartItems.filter((item) => item.isQuickItem).length} quick item(s) included`
              : null,
          p_client_transaction_id:
            clientTransactionId,
          p_device_id: "web-admin-pos",
          p_is_offline: false,
        }
      );

      if (error) {
        throw error;
      }

      const result =
        (data || {}) as unknown as CompleteSaleResult;

      if (result.success === false) {
        throw new Error(
          result.message ||
            "Unable to complete the sale."
        );
      }

      const invoiceNumber =
        result.invoice_number || "Invoice created";

      let syncedCustomerId: number | null = null;
      let customerSyncWarning = "";

      if (customerName.trim() || customerPhone.trim()) {
        try {
          syncedCustomerId = await saveCustomerProfile(
            finalPayable
          );
        } catch (customerError) {
          console.error(
            "Sale completed, but customer profile sync failed:",
            customerError
          );
          customerSyncWarning =
            customerError instanceof Error
              ? customerError.message
              : typeof customerError === "object" &&
                  customerError !== null &&
                  "message" in customerError
                ? String(
                    (customerError as { message?: unknown }).message ||
                      "Customer profile sync failed."
                  )
                : "Customer profile sync failed.";
        }
      }

      let rewardResult: RewardApplyResult = {
        points_used: 0,
        reward_discount: 0,
        points_earned: 0,
        closing_balance: availableRewardPoints,
      };
      let rewardSyncWarning = "";

      if (customerPhone.trim()) {
        try {
          const rewardEligibleAmount =
            paymentMethod === "credit"
              ? safeCreditPaidNow
              : finalPayable;

          const { data: rewardData, error: rewardError } =
            await supabase.rpc(
              "ncs_apply_sale_rewards_by_phone",
              {
                p_customer_phone: customerPhone.trim(),
                p_sale_id: result.sale_id
                  ? String(result.sale_id)
                  : null,
                p_invoice_number: invoiceNumber,
                p_redeem_points: safeRewardPointsToUse,
                p_eligible_amount: rewardEligibleAmount,
              },
            );

          if (rewardError) throw rewardError;

          rewardResult =
            (rewardData || {}) as RewardApplyResult;
        } catch (rewardError) {
          const rewardErrorRecord =
            typeof rewardError === "object" &&
            rewardError !== null
              ? (rewardError as {
                  message?: unknown;
                  details?: unknown;
                  hint?: unknown;
                  code?: unknown;
                })
              : null;

          const rewardErrorMessage = [
            rewardError instanceof Error
              ? rewardError.message
              : rewardErrorRecord?.message,
            rewardErrorRecord?.details,
            rewardErrorRecord?.hint,
            rewardErrorRecord?.code,
          ]
            .filter(Boolean)
            .map(String)
            .join(" • ");

          console.error(
            "Sale completed, but reward sync failed:",
            rewardErrorRecord || rewardError,
          );

          rewardSyncWarning =
            rewardErrorMessage ||
            "Reward points sync failed. Check Supabase RPC.";
        }
      }

      /*
       * complete_pos_sale currently creates credit sales with paid_amount=0
       * and due_amount=the full bill. Apply the cashier's "Paid Now" amount
       * immediately after the RPC without adding the credit sale twice.
       */
      if (
        paymentMethod === "credit" &&
        result.sale_id
      ) {
        const saleId = String(result.sale_id);
        const now = new Date().toISOString();

        const { error: posSaleAmountsError } =
          await supabase
            .from("pos_sales")
            .update({
              paid_amount: safeCreditPaidNow,
              due_amount: creditDueAmount,
              updated_at: now,
            })
            .eq("id", saleId);

        if (posSaleAmountsError) {
          throw new Error(
            `Credit paid/due could not be saved: ${posSaleAmountsError.message}`,
          );
        }

        /*
         * Keep the legacy sales mirror aligned when the row exists.
         * A missing mirror row must not block POS billing.
         */
        const { error: legacySaleAmountsError } =
          await supabase
            .from("sales")
            .update({
              paid_amount: safeCreditPaidNow,
              due_amount: creditDueAmount,
            })
            .eq("id", saleId);

        if (legacySaleAmountsError) {
          console.info(
            "Legacy sales paid/due mirror was not updated:",
            legacySaleAmountsError.message,
          );
        }

        if (
          safeCreditPaidNow > 0 &&
          customerPhone.trim()
        ) {
          const { data: creditAccount, error: creditLoadError } =
            await supabase
              .from("customer_credit_accounts")
              .select(
                "id,customer_id,current_balance,total_credit_paid",
              )
              .eq("customer_phone", customerPhone.trim())
              .maybeSingle();

          if (creditLoadError) {
            throw new Error(
              `Customer credit account could not be loaded: ${creditLoadError.message}`,
            );
          }

          if (creditAccount?.id) {
            const balanceBefore = Math.max(
              0,
              toNumber(creditAccount.current_balance),
            );
            const balanceAfter = Math.max(
              0,
              balanceBefore - safeCreditPaidNow,
            );

            const { error: creditUpdateError } =
              await supabase
                .from("customer_credit_accounts")
                .update({
                  total_credit_paid:
                    Math.max(
                      0,
                      toNumber(creditAccount.total_credit_paid),
                    ) + safeCreditPaidNow,
                  current_balance: balanceAfter,
                  last_payment_date: now,
                  updated_at: now,
                })
                .eq("id", creditAccount.id);

            if (creditUpdateError) {
              throw new Error(
                `Customer credit balance could not be corrected: ${creditUpdateError.message}`,
              );
            }

            const { error: paymentTransactionError } =
              await supabase
                .from("customer_credit_transactions")
                .insert({
                  credit_account_id: creditAccount.id,
                  customer_id:
                    creditAccount.customer_id || null,
                  customer_phone: customerPhone.trim(),
                  sale_id: saleId,
                  transaction_type: "payment",
                  amount_change: -safeCreditPaidNow,
                  balance_before: balanceBefore,
                  balance_after: balanceAfter,
                  payment_method: "cash",
                  reference_number: invoiceNumber,
                  due_date: creditDueDate,
                  description:
                    `Advance payment received for ${invoiceNumber}`,
                  notes:
                    `Paid now ${formatCurrency(safeCreditPaidNow)}; due ${formatCurrency(creditDueAmount)}`,
                  received_by: null,
                  created_at: now,
                });

            if (paymentTransactionError) {
              throw new Error(
                `Credit payment transaction could not be saved: ${paymentTransactionError.message}`,
              );
            }
          }
        }

        result.paid_amount = safeCreditPaidNow;
        result.due_amount = creditDueAmount;
      }

      const saleSnapshot: CompletedSale = {
        saleId: result.sale_id || "",
        invoiceNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items: cartItems.map((item) => ({ ...item })),
        subtotal,
        taxAmount: itemTax,
        billDiscount: billDiscountAmount,
        rewardPointsUsed: toNumber(
          rewardResult.points_used,
          safeRewardPointsToUse,
        ),
        rewardDiscount: toNumber(
          rewardResult.reward_discount,
          rewardDiscountAmount,
        ),
        rewardPointsEarned: toNumber(
          rewardResult.points_earned,
          paymentMethod === "credit"
            ? Math.floor(safeCreditPaidNow / 100)
            : Math.floor(finalPayable / 100),
        ),
        rewardClosingBalance: toNumber(
          rewardResult.closing_balance,
          Math.max(
            0,
            availableRewardPoints -
              safeRewardPointsToUse +
              (paymentMethod === "credit"
                ? Math.floor(safeCreditPaidNow / 100)
                : Math.floor(finalPayable / 100)),
          ),
        ),
        roundOff: safeRoundOffAmount,
        totalAmount: finalPayable,
        paidAmount:
          paymentMethod === "credit"
            ? safeCreditPaidNow
            : finalPayable,
        dueAmount:
          paymentMethod === "credit"
            ? creditDueAmount
            : 0,
        paymentMethod,
        completedAt: new Date().toISOString(),
      };

      setCompletedSale(saleSnapshot);

      let whatsappSyncWarning = "";

      if (saleSnapshot.customerPhone.trim()) {
        try {
          await sendInvoiceMessageViaWhatsApp(
            saleSnapshot
          );
        } catch (whatsappError) {
          console.error(
            "Sale completed, but automatic WhatsApp PDF invoice failed:",
            whatsappError
          );

          whatsappSyncWarning =
            whatsappError instanceof Error
              ? whatsappError.message
              : "Automatic WhatsApp PDF invoice failed.";
        }
      }

      setCartItems([]);
      setBillDiscountPercent(0);
      setRoundOffAmount(0);
      setCustomerName("");
      setCustomerPhone("");
      setRewardCustomerId(null);
      setAvailableRewardPoints(0);
      setRewardPointsToUse(0);
      setRewardCustomerFound(false);
      setPaymentMethod("cash");
      setCreditPaidNow(0);
      setCreditDueDate(getDefaultCreditDueDate());
      setMobileCartOpen(false);
      setSearchQuery("");

      await Promise.all([
        loadProducts(),
        loadPosOverview(),
      ]);

      const completionWarnings = [
        customerSyncWarning
          ? `Customer warning: ${customerSyncWarning}`
          : "",
        rewardSyncWarning
          ? `Reward warning: ${rewardSyncWarning}`
          : "",
        whatsappSyncWarning
          ? `WhatsApp warning: ${whatsappSyncWarning}`
          : "",
      ].filter(Boolean);

      showNotice(
        completionWarnings.length > 0
          ? `${invoiceNumber} completed. ${completionWarnings.join(" ")}`
          : saleSnapshot.customerPhone.trim()
            ? `${invoiceNumber} completed and WhatsApp bill message sent.`
            : `${invoiceNumber} completed successfully.`,
        completionWarnings.length > 0
          ? "info"
          : "success"
      );

      window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error("Unable to complete POS sale:", error);

      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" &&
              error !== null &&
              "message" in error
            ? String(
                (error as { message?: unknown }).message ||
                  "Unable to complete the sale."
              )
            : "Unable to complete the sale.";

      showNotice(message, "error");

      await loadProducts();
    } finally {
      saleSubmissionLockRef.current = false;
      setIsCompletingSale(false);
    }
  }

  return (
    <main className={`ncsPosPage ${cartItems.length > 0 ? "ncsPosBillingFocus" : ""}`}>
      {notice && (
        <div
          className={`ncsPosNotice ncsPosNotice-${noticeType}`}
          role="status"
        >
          <span>
            {noticeType === "success"
              ? "✓"
              : noticeType === "error"
                ? "!"
                : "i"}
          </span>

          <p>{notice}</p>
        </div>
      )}

      <section
        className={`ncsOfflineStatusBar ${
          isOnline ? "online" : "offline"
        }`}
      >
        <div>
          <span className="ncsOfflineStatusDot" />
          <strong>
            {isOnline ? "ONLINE" : "OFFLINE MODE"}
          </strong>
          <small>
            {isOnline
              ? pendingOfflineBills > 0
                ? `${pendingOfflineBills} bill(s) waiting to sync`
                : "Cloud connection available"
              : "Billing works locally. Data will sync automatically."}
          </small>
        </div>

        {pendingOfflineBills > 0 && (
          <button
            type="button"
            onClick={() => void syncOfflineBillsNow()}
            disabled={!isOnline || syncingOfflineBills}
          >
            {syncingOfflineBills
              ? "Syncing..."
              : `Sync ${pendingOfflineBills} Bill(s)`}
          </button>
        )}
      </section>

      <section className="ncsPosHeader">
        <div>
          <span className="ncsPosEyebrow">
            NEW CITY STYLE • PREMIUM POS
          </span>

          <h1>Billing Counter</h1>

          <p>
            Fast barcode billing, live stock and customer
            rewards.
          </p>
        </div>

        <div
          className="ncsPosCustomerQueue"
          aria-hidden="true"
        >
          <video
            className="ncsRealFamilyVideo ncsRealFamilyVideoBg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          >
            <source
              src="/animations/ncs-family-shopping.mp4"
              type="video/mp4"
            />
          </video>

          <video
            className="ncsRealFamilyVideo ncsRealFamilyVideoMain"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          >
            <source
              src="/animations/ncs-family-shopping.mp4"
              type="video/mp4"
            />
          </video>
        </div>

        <div className="ncsPosHeaderActions">
          <button
            type="button"
            className="ncsPosNextCustomerButton"
            onClick={startNextCustomerBill}
            disabled={cartItems.length === 0}
            title="Keep this customer bill safely and open a fresh bill"
          >
            <span>＋</span>
            Next Customer
          </button>

          <button
            type="button"
            className="ncsPosSecondaryButton"
            onClick={() =>
              setShowHeldBills(true)
            }
          >
            <span>👥</span>
            Customer Queue
            {heldBills.length > 0 && (
              <b>{heldBills.length}</b>
            )}
          </button>

          <button
            type="button"
            className="ncsPosRefreshButton"
            onClick={() => {
              void loadProducts();
              void loadPosOverview();
            }}
            disabled={loadingProducts || loadingOverview}
          >
            <span
              className={
                loadingProducts
                  ? "ncsPosRotating"
                  : ""
              }
            >
              ↻
            </span>
            Refresh Stock
          </button>
        </div>
      </section>

      <section className="ncsPosQuickStats" aria-label="POS live summary">
        <article className="ncsPosQuickCard ncsPosSalesCard">
          <div className="ncsPosQuickGlow" />

          <div
            className="ncsPosMoneyMotion ncsPosMoneyMotionSales"
            aria-hidden="true"
          >
            <span>₹</span>
            <span>₹</span>
            <span>₹</span>
            <span>₹</span>
            <span>₹</span>
          </div>

          <div className="ncsPosCoinStack" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="ncsPosQuickIcon">₹</div>

          <div className="ncsPosQuickContent">
            <span>TODAY&apos;S SALES</span>
            <strong>
              {loadingOverview
                ? "Loading..."
                : formatCurrency(posOverview.todaySales)}
            </strong>
            <p>
              {posOverview.todayBills} bill
              {posOverview.todayBills === 1 ? "" : "s"} today
            </p>
          </div>

          <div className="ncsPosQuickMini">
            <span>
              Cash
              <b>{formatCurrency(posOverview.todayCash)}</b>
            </span>
            <span>
              UPI / Card
              <b>{formatCurrency(posOverview.todayDigital)}</b>
            </span>
          </div>
        </article>

        <article className="ncsPosQuickCard ncsPosCreditCard">
          <div className="ncsPosQuickGlow" />

          <div
            className="ncsPosMoneyMotion ncsPosMoneyMotionCredit"
            aria-hidden="true"
          >
            <span>₹</span>
            <span>₹</span>
            <span>₹</span>
          </div>

          <div className="ncsPosCreditPulse" aria-hidden="true">
            <i />
            <i />
          </div>
          <div className="ncsPosQuickIcon">◷</div>

          <div className="ncsPosQuickContent">
            <span>CUSTOMER CREDIT</span>
            <strong>
              {loadingOverview
                ? "Loading..."
                : formatCurrency(posOverview.customerCredit)}
            </strong>
            <p>
              {posOverview.creditCustomers} customer
              {posOverview.creditCustomers === 1 ? "" : "s"} pending
            </p>
          </div>

          <div className="ncsPosQuickCreditBadge">
            Live Dues
            <b>{posOverview.creditCustomers}</b>
          </div>
        </article>
      </section>

      <section className="ncsPosWorkspace">
        <div className="ncsPosCatalogue">
          <form
            className="ncsPosSearchPanel"
            onSubmit={handleSearchSubmit}
          >
            <div className="ncsPosSearchIcon">⌕</div>

            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setProductViewMode("brands");
                setExpandedProductId(null);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Scan barcode or search product, SKU, size, colour..."
              autoComplete="off"
              autoFocus
            />

            {searchQuery && (
              <button
                type="button"
                className="ncsPosClearSearch"
                onClick={() => {
                  setSearchQuery("");
                  setProductViewMode("brands");
                  setExpandedProductId(null);
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}

            <button
              type="submit"
              className="ncsPosSearchButton"
            >
              Search
            </button>

            <button
              type="button"
              className="ncsPosQuickItemButton ncsPosSearchQuickItemButton"
              onClick={openQuickItem}
            >
              <span>＋</span>
              Quick Item
            </button>
      </form>

      <section
        className={`ncsPosAiPanel ${posAiExpanded ? "expanded" : "collapsed"}`}
      >
        <button
          type="button"
          className="ncsPosAiCompactToggle"
          onClick={() => setPosAiExpanded((current) => !current)}
          aria-expanded={posAiExpanded}
        >
          <div className="ncsPosAiHeading">
            <div className="ncsPosAiBadge">✦</div>

            <div>
              <strong>NCS AI Billing Assistant</strong>
              <small>
                {posAiExpanded
                  ? "Add, edit, discount, stock, customer and payment commands."
                  : "Tap to open smart billing commands"}
              </small>
            </div>
          </div>

          <div className="ncsPosAiCompactRight">
            <span className="ncsPosAiLiveDot" />
            <b>{posAiExpanded ? "Close" : "Open AI"}</b>
            <em>{posAiExpanded ? "⌃" : "⌄"}</em>
          </div>
        </button>

        {posAiExpanded && (
          <div className="ncsPosAiExpandableBody">
        <form
          className="ncsPosAiCommandRow"
          onSubmit={handlePosAiSubmit}
        >
          <div className="ncsPosAiInputShell">
            <span className="ncsPosAiSpark">✦</span>
            <input
              value={posAiCommand}
              onChange={(event) =>
                setPosAiCommand(event.target.value)
              }
              placeholder="Try: Poomex 80 two add, Dixcy 85 black add • bill discount 5 • cash"
              autoComplete="off"
            />

            {posAiCommand && (
              <button
                type="button"
                className="ncsPosAiClearButton"
                onClick={() => {
                  setPosAiCommand("");
                  setPosAiMatches([]);
                }}
                aria-label="Clear AI command"
              >
                ×
              </button>
            )}
          </div>

          <button
            type="submit"
            className="ncsPosAiAddButton"
          >
            <span>✦</span>
            Add with AI
          </button>
        </form>
        <div className="ncsPosAiHintRow">
          <span>English</span>
          <span>తెలుగు</span>
          <span>Mixed commands</span>
          <small>Multi-item • Qty • Discount • Stock • Customer • Payment • Hold • Total • Voice-ready</small>
        </div>


        {posAiMatches.length > 0 && (
          <div className="ncsPosAiResults">
            <div className="ncsPosAiResultsHeader">
              <div>
                <strong>Choose the exact variant</strong>
                <small>
                  More than one strong match was found, so AI will not guess.
                </small>
              </div>

              <span>
                {posAiMatches.length} match
                {posAiMatches.length === 1 ? "" : "es"}
              </span>
            </div>

            <div className="ncsPosAiResultGrid">
              {posAiMatches.map(({ product }) => (
                <button
                  key={`ai-${product.key}`}
                  type="button"
                  className="ncsPosAiResultCard"
                  onClick={() => {
                    const command = buildPosAiCommand(posAiCommand);
                    const requestedQuantity = Math.max(1, command.quantity);
                    const existingQuantity =
                      cartItems.find((item) => item.key === product.key)
                        ?.quantity || 0;
                    const availableStock = getAvailableStock(product);

                    setPosAiLastAction({
                      productKey: product.key,
                      previousQuantity: existingQuantity,
                    });

                    addProductToCart(product);

                    if (requestedQuantity > 1) {
                      setCartItems((currentItems) =>
                        currentItems.map((item) =>
                          item.key === product.key
                            ? {
                                ...item,
                                quantity: Math.min(
                                  existingQuantity + requestedQuantity,
                                  availableStock
                                ),
                              }
                            : item
                        )
                      );
                    }

                    setPosAiLastProductKey(product.key);
                    setPosAiMatches([]);
                    setPosAiCommand("");
                  }}
                >
                  <div className="ncsPosAiResultMain">
                    <span className="ncsPosAiResultIcon">NCS</span>
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.brand}</span>
                      <small>
                        {[product.size, product.color]
                          .filter(Boolean)
                          .join(" • ") || "Standard"}
                      </small>
                    </div>
                  </div>

                  <div className="ncsPosAiResultMeta">
                    <b>{formatCurrency(product.price)}</b>
                    <small>{product.stock} in stock</small>
                    <em>Add →</em>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

          </div>
        )}
      </section>

      <div className="ncsPosCategoryRow">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={
                  selectedCategory === category
                    ? "ncsPosCategoryButton ncsPosCategoryActive"
                    : "ncsPosCategoryButton"
                }
                onClick={() => {
                  setSelectedCategory(category);
                  setProductViewMode("brands");
                  setExpandedBrand(null);
                  setExpandedProductId(null);
                }}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="ncsPosCatalogueTop">
            <div>
              <h2>Smart Product Finder</h2>

              <p>
                {loadingProducts
                  ? "Loading products..."
                  : `${groupedProducts.length} style(s) • ${filteredProducts.length} variant(s)`}
              </p>
            </div>

            <div className="ncsPosStatusBadge">
              <span />
              Live Supabase Stock
            </div>
          </div>

          <div className="ncsPosFinderToolbar">
            <button
              type="button"
              className={productViewMode === "smart" ? "active" : ""}
              onClick={() => setProductViewMode("smart")}
            >
              ✨ Quick View
            </button>
            <button
              type="button"
              className={productViewMode === "brands" ? "active" : ""}
              onClick={() => setProductViewMode("brands")}
            >
              🏷 Brands First
            </button>
            <button
              type="button"
              className={productViewMode === "all" ? "active" : ""}
              onClick={() => setProductViewMode("all")}
            >
              ▦ All Items
            </button>
            <span>
              Search example: <strong>royal xxl black</strong> or short code <strong>V1045</strong>
            </span>
          </div>

          {loadError && (
            <div className="ncsPosErrorCard">
              <div>!</div>

              <section>
                <strong>
                  Unable to load products
                </strong>
                <p>{loadError}</p>

                <button
                  type="button"
                  onClick={loadProducts}
                >
                  Try Again
                </button>
              </section>
            </div>
          )}

          {loadingProducts ? (
            <div className="ncsPosProductGrid">
              {Array.from({ length: 8 }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="ncsPosSkeletonCard"
                  >
                    <div />
                    <span />
                    <span />
                    <span />
                  </div>
                )
              )}
            </div>
          ) : !loadError && groupedProducts.length === 0 ? (
            <div className="ncsPosEmptyState">
              <div>⌕</div>
              <h3>No products found</h3>
              <p>
                Try brand, product, size, colour, barcode, SKU or short code.
              </p>
            </div>
          ) : (
            <>
              {productViewMode === "smart" && (
                <div className="ncsPosSmartFinder">
                  {recentProductGroups.length > 0 && (
                    <section className="ncsPosSmartSection">
                      <header>
                        <div>
                          <span>FAST COUNTER</span>
                          <h3>Recently Used</h3>
                        </div>
                        <small>{recentProductGroups.length} styles</small>
                      </header>

                      <div className="ncsPosCompactRail">
                        {recentProductGroups.map((group) => (
                          <button
                            key={`recent-${group.groupKey}`}
                            type="button"
                            className="ncsPosCompactProduct"
                            onClick={() =>
                              setExpandedProductId(
                                expandedProductId === group.productId
                                  ? null
                                  : group.productId
                              )
                            }
                          >
                            <strong>{group.name}</strong>
                            <span>{group.brand}</span>
                            <small>
                              {group.variants.length} option(s) • {group.totalStock} stock
                            </small>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {popularProductGroups.length > 0 && (
                    <section className="ncsPosSmartSection">
                      <header>
                        <div>
                          <span>POPULAR</span>
                          <h3>Frequently Sold</h3>
                        </div>
                        <small>Auto-ranked</small>
                      </header>

                      <div className="ncsPosCompactRail">
                        {popularProductGroups.map((group) => (
                          <button
                            key={`popular-${group.groupKey}`}
                            type="button"
                            className="ncsPosCompactProduct ncsPosPopularProduct"
                            onClick={() =>
                              setExpandedProductId(
                                expandedProductId === group.productId
                                  ? null
                                  : group.productId
                              )
                            }
                          >
                            <strong>{group.name}</strong>
                            <span>{group.brand}</span>
                            <small>
                              Used {popularProductCounts[String(group.productId)] || 0} time(s)
                            </small>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="ncsPosSmartSection">
                    <header>
                      <div>
                        <span>CATALOGUE</span>
                        <h3>Products by Brand</h3>
                      </div>
                      <small>{brandGroups.length} brands</small>
                    </header>

                    <div className="ncsPosBrandGrid">
                      {brandGroups.map((brandGroup) => (
                        <button
                          key={brandGroup.brand}
                          type="button"
                          className="ncsPosBrandSummary"
                          onClick={() => {
                            setExpandedProductId(null);
                            setProductViewMode("brands");
                            setExpandedBrand(brandGroup.brand);
                          }}
                        >
                          <span className="ncsPosBrandMark">
                            {brandGroup.brand.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <strong>{brandGroup.brand}</strong>
                            <small>
                              {brandGroup.groups.length} styles • {brandGroup.totalVariants} variants
                            </small>
                          </div>
                          <b>›</b>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {productViewMode === "brands" && (
                <>
                  <div className="ncsPosBrandCompactGrid">
                    {brandGroups.map((brandGroup) => (
                      <button
                        key={brandGroup.brand}
                        type="button"
                        className="ncsPosBrandCompactCard"
                        onClick={() => {
                          setExpandedProductId(null);
                          setExpandedBrand(brandGroup.brand);
                        }}
                      >
                        <span className="ncsPosBrandCompactMark">
                          {brandGroup.brand.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <strong>{brandGroup.brand}</strong>
                          <small>
                            {brandGroup.groups.length} styles • {brandGroup.totalVariants} variants
                          </small>
                        </div>
                        <b>›</b>
                      </button>
                    ))}
                  </div>

                  {expandedBrand &&
                    typeof document !== "undefined" &&
                    (() => {
                      const selectedBrandGroup = brandGroups.find(
                        (brandGroup) => brandGroup.brand === expandedBrand
                      );

                      if (!selectedBrandGroup) {
                        return null;
                      }

                      return createPortal(
                        <div
                          className="ncsPosBrandModalBackdrop"
                          role="presentation"
                          onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                              setExpandedProductId(null);
                              setExpandedBrand(null);
                            }
                          }}
                        >
                          <section
                            className={`ncsPosBrandModal ${selectedBrandGroup.groups.length > 8 ? "ncsPosBrandModalDense" : ""}`}
                            role="dialog"
                            aria-modal="true"
                            aria-label={`${selectedBrandGroup.brand} products`}
                          >
                            <header className="ncsPosBrandModalHeader">
                              <div className="ncsPosBrandModalTitle">
                                <span className="ncsPosBrandCompactMark">
                                  {selectedBrandGroup.brand.slice(0, 2).toUpperCase()}
                                </span>
                                <div>
                                  <small>SELECT PRODUCT / SIZE / COLOUR</small>
                                  <h3>{selectedBrandGroup.brand}</h3>
                                  <p>
                                    {selectedBrandGroup.groups.length} styles • {selectedBrandGroup.totalVariants} variants • {selectedBrandGroup.totalStock} stock
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                className="ncsPosBrandModalClose"
                                onClick={() => {
                                  setExpandedProductId(null);
                                  setExpandedBrand(null);
                                }}
                                aria-label="Close brand window"
                              >
                                ×
                              </button>
                            </header>

                            <div className="ncsPosBrandModalBody">
                              {selectedBrandGroup.groups.map((group) => (
                                <GroupedProductCard
                                  key={group.groupKey}
                                  group={group}
                                  expanded={expandedProductId === group.productId}
                                  onToggle={() =>
                                    setExpandedProductId(
                                      expandedProductId === group.productId
                                        ? null
                                        : group.productId
                                    )
                                  }
                                  onAddVariant={(product) => {
                                    addProductToCart(product);
                                    setExpandedProductId(null);
                                    setExpandedBrand(null);
                                  }}
                                />
                              ))}
                            </div>

                            <footer className="ncsPosBrandModalFooter">
                              <span>
                                Select product → exact size/colour → Add. It goes straight to the active bill.
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedProductId(null);
                                  setExpandedBrand(null);
                                }}
                              >
                                Back to Brands
                              </button>
                            </footer>
                          </section>
                        </div>,
                        document.body,
                      );
                    })()}
                </>
              )}

              {productViewMode === "all" && (
                <div className="ncsPosGroupedProductGrid">
                  {groupedProducts.map((group) => (
                    <GroupedProductCard
                      key={group.groupKey}
                      group={group}
                      expanded={expandedProductId === group.productId}
                      onToggle={() =>
                        setExpandedProductId(
                          expandedProductId === group.productId
                            ? null
                            : group.productId
                        )
                      }
                      onAddVariant={addProductToCart}
                    />
                  ))}
                </div>
              )}

              {expandedProductId !== null && productViewMode === "smart" && (() => {
                const selectedGroup = groupedProducts.find(
                  (group) => group.productId === expandedProductId
                );

                return selectedGroup ? (
                  <div className="ncsPosSmartExpandedProduct">
                    <GroupedProductCard
                      group={selectedGroup}
                      expanded
                      onToggle={() => setExpandedProductId(null)}
                      onAddVariant={addProductToCart}
                    />
                  </div>
                ) : null;
              })()}
            </>
          )}
        </div>

        <aside
          className={`ncsPosBillPanel ${
            mobileCartOpen
              ? "ncsPosBillPanelOpen"
              : ""
          }`}
        >
          <div className="ncsPosBillHeader">
            <div>
              <span>Current Bill</span>
              <h2>
                {totalQuantity} Item
                {totalQuantity === 1 ? "" : "s"}
              </h2>
            </div>

            <div className="ncsPosBillHeaderActions">
              <button
                type="button"
                className="ncsPosBillNextCustomer"
                onClick={startNextCustomerBill}
                disabled={cartItems.length === 0}
                title="Save current customer and start next bill"
              >
                ＋
              </button>

              <button
                type="button"
                onClick={() => setShowHeldBills(true)}
                title="Customer queue"
              >
                👥
              </button>

              <button
                type="button"
                onClick={clearCurrentBill}
                title="Clear bill"
              >
                ⌫
              </button>

              <button
                type="button"
                className="ncsPosCloseMobileCart"
                onClick={() =>
                  setMobileCartOpen(false)
                }
                aria-label="Close bill"
              >
                ×
              </button>
            </div>
          </div>

          <div className="ncsPosCustomerCard">
            <div className="ncsPosCustomerTitle">
              <span>👤</span>

              <div>
                <strong>Customer</strong>
                <small>
                  Optional for cash sales
                </small>
              </div>
            </div>

            <div className="ncsPosCustomerFields">
              <input
                value={customerName}
                onChange={(event) =>
                  setCustomerName(
                    event.target.value
                  )
                }
                placeholder="Customer name"
              />

              <input
                value={customerPhone}
                onChange={(event) =>
                  setCustomerPhone(
                    event.target.value.replace(
                      /[^0-9+]/g,
                      ""
                    )
                  )
                }
                placeholder="Mobile number"
                inputMode="tel"
              />
            </div>

            <div className="ncsPosRewardLookup">
              {rewardLookupLoading ? (
                <span>Checking customer rewards...</span>
              ) : rewardCustomerFound ? (
                <>
                  <div>
                    <span>Returning Customer</span>
                    <strong>
                      Available Rewards: {availableRewardPoints} points
                    </strong>
                    <small>
                      ₹100 purchase = 1 point • 1 point = ₹1
                    </small>
                  </div>

                  <label>
                    <span>Use Points</span>
                    <input
                      type="number"
                      min="0"
                      max={Math.min(
                        availableRewardPoints,
                        grandTotalBeforeRewards,
                      )}
                      step="1"
                      value={
                        rewardPointsToUse === 0
                          ? ""
                          : rewardPointsToUse
                      }
                      onChange={(event) =>
                        setRewardPointsToUse(
                          Math.floor(
                            Math.min(
                              availableRewardPoints,
                              grandTotalBeforeRewards,
                              Math.max(
                                0,
                                toNumber(event.target.value),
                              ),
                            ),
                          ),
                        )
                      }
                      placeholder="0"
                    />
                  </label>
                </>
              ) : customerPhone.replace(/\D/g, "").length === 10 ? (
                <span>
                  New customer — rewards start after this bill.
                </span>
              ) : (
                <span>
                  Enter 10-digit mobile number to load customer name and
                  reward points.
                </span>
              )}
            </div>

            <label className="ncsPosMarketingConsent">
              <input
                type="checkbox"
                checked={customerWhatsAppOptIn}
                onChange={(event) =>
                  setCustomerWhatsAppOptIn(
                    event.target.checked
                  )
                }
              />

              <span className="ncsPosMarketingConsentCopy">
                <strong>Customer agreed to receive WhatsApp offers</strong>
                <small>
                  Existing opted-in customers are selected automatically.
                </small>
              </span>

              <span className="ncsPosOfferTicker" aria-label="Current store offers">
                <span className="ncsPosOfferTickerTrack">
                  <b>🎁 Shop ₹3,000 • Get an umbrella free</b>
                  <b>🪙 Every purchase earns reward coins</b>
                  <b>✨ Members receive exclusive offers</b>
                  <b>🎁 Shop ₹3,000 • Get an umbrella free</b>
                </span>
              </span>
            </label>
          </div>

          <div className="ncsPosCartTableHeader" aria-hidden="true">
            <span>Item</span>
            <span>MRP</span>
            <span>Sell</span>
            <span>Qty</span>
            <span>Disc %</span>
            <span>Total</span>
            <span />
          </div>

          <div className="ncsPosCartItems">
            {cartItems.length === 0 ? (
              <div className="ncsPosEmptyCart">
                <div>🛍️</div>
                <h3>Bill is empty</h3>
                <p>Scan a barcode or select a product.</p>
              </div>
            ) : (
              cartItems.map((item, itemIndex) => (
                <article
                  key={item.key}
                  className="ncsPosCartItem ncsPosCartItemTableRow"
                >
                  <div className="ncsPosCartProductCell">
                    <div className="ncsPosCartThumbnail">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt={item.name} />
                      ) : (
                        <span>NCS</span>
                      )}
                    </div>

                    <div className="ncsPosCartProductInfo">
                      <small className="ncsPosItemSerial">
                        {String(itemIndex + 1).padStart(2, "0")}
                      </small>
                      <h3 title={item.name}>
                        {item.name}
                        {item.isQuickItem && (
                          <span className="ncsPosQuickItemBadge">QUICK</span>
                        )}
                      </h3>

                      {!item.isQuickItem && item.brand && (
                        <span className="ncsPosCartBrandName">
                          {item.brand}
                        </span>
                      )}

                      <p>
                        {[item.size, item.color]
                          .filter(Boolean)
                          .join(" • ") || item.category}
                        {!item.isQuickItem && (
                          <em>Stock {item.stock}</em>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="ncsPosTableMoneyCell">
                    <span className="ncsPosMobileCellLabel">MRP</span>
                    <strong>{formatCurrency(item.mrp)}</strong>
                  </div>

                  <label className="ncsPosInlineMoneyInput">
                    <span className="ncsPosMobileCellLabel">Sell</span>
                    <div>
                      <b>₹</b>
                      <input
                        type="number"
                        min="0"
                        max={item.mrp}
                        step="0.01"
                        value={item.price}
                        onChange={(event) =>
                          updateItemSellingPrice(
                            item.key,
                            toNumber(event.target.value)
                          )
                        }
                        inputMode="decimal"
                        aria-label={`${item.name} selling price`}
                      />
                    </div>
                  </label>

                  <div className="ncsPosQuantityControl ncsPosQuantityTableCell">
                    <span className="ncsPosMobileCellLabel">Qty</span>
                    <div>
                      <button
                        type="button"
                        onClick={() => decreaseQuantity(item.key)}
                        aria-label={`Decrease ${item.name} quantity`}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.isQuickItem ? undefined : item.stock}
                        value={item.quantity}
                        onChange={(event) =>
                          updateItemQuantity(
                            item.key,
                            toNumber(event.target.value)
                          )
                        }
                        inputMode="numeric"
                        aria-label={`${item.name} quantity`}
                      />
                      <button
                        type="button"
                        onClick={() => increaseQuantity(item.key)}
                        aria-label={`Increase ${item.name} quantity`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <label className="ncsPosItemDiscountField">
                    <span className="ncsPosMobileCellLabel">Discount</span>
                    <div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={
                          item.discountPercent === 0 ||
                          item.discountPercent == null
                            ? ""
                            : item.discountPercent
                        }
                        onChange={(event) =>
                          updateItemDiscount(
                            item.key,
                            toNumber(event.target.value)
                          )
                        }
                        placeholder="0"
                        inputMode="decimal"
                        aria-label={`${item.name} discount percentage`}
                      />
                      <b>%</b>
                    </div>
                  </label>

                  <div className="ncsPosItemLineTotal">
                    <span className="ncsPosMobileCellLabel">Total</span>
                    <strong>
                      {formatCurrency(item.price * item.quantity)}
                    </strong>
                    {item.mrp > item.price && (
                      <small>
                        Saved {formatCurrency(
                          (item.mrp - item.price) * item.quantity
                        )}
                      </small>
                    )}
                  </div>

                  <button
                    type="button"
                    className="ncsPosOwnerCostButton"
                    onClick={() =>
                      void openOwnerCostInfo(item)
                    }
                    disabled={
                      loadingOwnerCostKey === item.key
                    }
                    aria-label={`Cost details for ${item.name}`}
                    title="Owner cost & supplier details"
                  >
                    {loadingOwnerCostKey === item.key
                      ? "…"
                      : "ⓘ"}
                  </button>

                  <button
                    type="button"
                    className="ncsPosRemoveItem"
                    onClick={() => removeCartItem(item.key)}
                    aria-label={`Remove ${item.name}`}
                    title="Remove item"
                  >
                    ×
                  </button>
                </article>
              ))
            )}
          </div>

          <div className="ncsPosSummary">
            <label className="ncsPosDiscountField">
              <span>Bill Discount (%)</span>

              <div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={
                    billDiscountPercent === 0
                      ? ""
                      : billDiscountPercent
                  }
                  onChange={(event) =>
                    setBillDiscountPercent(
                      Math.min(
                        100,
                        Math.max(
                          0,
                          toNumber(event.target.value)
                        )
                      )
                    )
                  }
                  placeholder="0"
                  inputMode="decimal"
                />

                <span>%</span>
              </div>
            </label>

            <div className="ncsPosSummaryLine">
              <span>MRP Total</span>
              <strong>{formatCurrency(itemMrpSubtotal)}</strong>
            </div>

            <div className="ncsPosSummaryLine ncsPosDiscountLine">
              <span>Item Discounts</span>
              <strong>− {formatCurrency(itemDiscountAmount)}</strong>
            </div>

            <div className="ncsPosSummaryLine">
              <span>Subtotal</span>
              <strong>
                {formatCurrency(subtotal)}
              </strong>
            </div>

            <div className="ncsPosSummaryLine">
              <span>Tax</span>
              <strong>
                {formatCurrency(itemTax)}
              </strong>
            </div>

            <div className="ncsPosSummaryLine ncsPosDiscountLine">
              <span>
                Discount ({safeBillDiscountPercent.toFixed(2)}%)
              </span>
              <strong>
                − {formatCurrency(billDiscountAmount)}
              </strong>
            </div>

            <div className="ncsPosSummaryLine ncsPosRewardDiscountLine">
              <span>
                Reward Discount ({safeRewardPointsToUse} points)
              </span>
              <strong>
                − {formatCurrency(rewardDiscountAmount)}
              </strong>
            </div>

            <label className="ncsPosRoundOffField">
              <span>Round Off Amount</span>

              <div>
                <span>₹</span>
                <input
                  type="number"
                  min="0"
                  max={finalPayable}
                  step="0.01"
                  value={
                    roundOffAmount === 0
                      ? ""
                      : roundOffAmount
                  }
                  onChange={(event) =>
                    setRoundOffAmount(
                      Math.min(
                        grandTotal,
                        Math.max(
                          0,
                          toNumber(event.target.value)
                        )
                      )
                    )
                  }
                  placeholder="0"
                  inputMode="decimal"
                />
              </div>
            </label>

            {safeRoundOffAmount > 0 && (
              <div className="ncsPosSummaryLine ncsPosRoundOffLine">
                <span>Round Off</span>
                <strong>
                  − {formatCurrency(safeRoundOffAmount)}
                </strong>
              </div>
            )}

            <div className="ncsPosTotalLine">
              <div>
                <span>Total Payable</span>
                <small>
                  MRP / selling price already includes GST
                </small>
              </div>

              <strong>
                {formatCurrency(finalPayable)}
              </strong>
            </div>
          </div>

          <div className="ncsPosPaymentSection">
            <span className="ncsPosPaymentLabel">
              Payment Method
            </span>

            <div className="ncsPosPaymentGrid">
              {(
                [
                  {
                    value: "cash",
                    label: "Cash",
                    icon: "₹",
                  },
                  {
                    value: "upi",
                    label: "UPI",
                    icon: "▣",
                  },
                  {
                    value: "card",
                    label: "Card",
                    icon: "▤",
                  },
                  {
                    value: "credit",
                    label: "Credit",
                    icon: "◷",
                  },
                ] as const
              ).map((method) => (
                <button
                  key={method.value}
                  type="button"
                  className={
                    paymentMethod === method.value
                      ? "ncsPosPaymentButton ncsPosPaymentActive"
                      : "ncsPosPaymentButton"
                  }
                  onClick={() => {
                    setPaymentMethod(method.value);

                    if (method.value === "credit") {
                      setCreditPaidNow(0);
                      setCreditDueDate(
                        getDefaultCreditDueDate()
                      );
                    } else {
                      setCreditPaidNow(0);
                    }
                  }}
                >
                  <span>{method.icon}</span>
                  {method.label}
                </button>
              ))}
            </div>

            {paymentMethod === "credit" && (
              <div className="ncsPosCreditPanel">
                <div className="ncsPosCreditTitle">
                  <div>
                    <span>◷</span>
                    <section>
                      <strong>Credit Sale Details</strong>
                      <small>
                        Customer name and mobile are required
                      </small>
                    </section>
                  </div>

                  <b>
                    Due {formatCurrency(creditDueAmount)}
                  </b>
                </div>

                <div className="ncsPosCreditFields">
                  <label>
                    <span>Paid Now</span>
                    <input
                      type="number"
                      min="0"
                      max={finalPayable}
                      step="0.01"
                      value={
                        creditPaidNow === 0
                          ? ""
                          : creditPaidNow
                      }
                      onChange={(event) =>
                        setCreditPaidNow(
                          Math.min(
                            finalPayable,
                            Math.max(
                              0,
                              toNumber(event.target.value)
                            )
                          )
                        )
                      }
                      placeholder="0"
                      inputMode="decimal"
                    />
                  </label>

                  <label>
                    <span>Due Date</span>
                    <input
                      type="date"
                      value={creditDueDate}
                      min={new Date()
                        .toISOString()
                        .slice(0, 10)}
                      onChange={(event) =>
                        setCreditDueDate(
                          event.target.value
                        )
                      }
                    />
                  </label>
                </div>

                <div className="ncsPosCreditSummary">
                  <p>
                    <span>Total Bill</span>
                    <strong>
                      {formatCurrency(finalPayable)}
                    </strong>
                  </p>

                  <p>
                    <span>Paid Now</span>
                    <strong>
                      {formatCurrency(safeCreditPaidNow)}
                    </strong>
                  </p>

                  <p className="ncsPosCreditDueRow">
                    <span>Remaining Due</span>
                    <strong>
                      {formatCurrency(creditDueAmount)}
                    </strong>
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              className="ncsPosCompleteButton"
              onClick={handleCompleteSale}
              disabled={
                cartItems.length === 0 ||
                isCompletingSale
              }
            >
              <span>
                {isCompletingSale ? "…" : "✓"}
              </span>

              <div>
                <strong>
                  {isCompletingSale
                    ? "Saving Sale..."
                    : "Complete Sale"}
                </strong>
                <small>
                  {paymentMethod === "credit"
                    ? `Due ${formatCurrency(
                        creditDueAmount
                      )}`
                    : formatCurrency(finalPayable)}
                </small>
              </div>

              <b>
                {isCompletingSale ? "⌛" : "→"}
              </b>
            </button>
          </div>
        </aside>
      </section>

      <button
        type="button"
        className="ncsPosMobileCartButton"
        onClick={() =>
          setMobileCartOpen(true)
        }
      >
        <span>
          🛒
          {totalQuantity > 0 && (
            <b>{totalQuantity}</b>
          )}
        </span>

        <div>
          <small>Current Bill</small>
          <strong>
            {formatCurrency(finalPayable)}
          </strong>
        </div>

        <i>View →</i>
      </button>

      {mobileCartOpen && (
        <button
          type="button"
          className="ncsPosMobileOverlay"
          onClick={() =>
            setMobileCartOpen(false)
          }
          aria-label="Close bill panel"
        />
      )}

      {showQuickItem &&
        typeof document !== "undefined" &&
        createPortal(
        <div
          className="ncsPosModalOverlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setShowQuickItem(false);
            }
          }}
        >
          <section
            className="ncsPosQuickItemModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ncs-quick-item-title"
          >
            <header>
              <div>
                <span>FAST MIGRATION BILLING</span>
                <h2 id="ncs-quick-item-title">Add Quick Item</h2>
                <p>
                  Add unregistered products one by one. Each Add to Bill keeps
                  this window open; close it only after all quick items are entered.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowQuickItem(false)}
                aria-label="Close quick item"
              >
                ×
              </button>
            </header>

            <form onSubmit={addQuickItemToCart}>
              <div className="ncsPosQuickItemGrid">
                <label className="ncsPosQuickWide">
                  <span>Item Name *</span>
                  <input
                    ref={quickItemNameInputRef}
                    autoFocus
                    value={quickItemForm.name}
                    placeholder="Example: Men Shirt"
                    onChange={(event) =>
                      setQuickItemForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Category *</span>
                  <select
                    value={quickItemForm.category}
                    onChange={(event) =>
                      setQuickItemForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                  >
                    {Array.from(
                      new Set([
                        "Men",
                        "Women",
                        "Kids",
                        "Sarees",
                        "Shirts",
                        "Jeans",
                        "Kurtis",
                        "Innerwear",
                        "Others",
                        ...categories.filter((item) => item !== "All"),
                      ]),
                    ).map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Quantity *</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={
                      quickItemForm.quantity > 0
                        ? quickItemForm.quantity
                        : ""
                    }
                    placeholder="Enter quantity"
                    onChange={(event) => {
                      const rawValue = event.target.value;

                      setQuickItemForm((current) => ({
                        ...current,
                        quantity:
                          rawValue === ""
                            ? 0
                            : Math.max(
                                1,
                                Math.floor(Number(rawValue) || 1),
                              ),
                      }));
                    }}
                  />
                </label>

                <label>
                  <span>MRP *</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={quickItemForm.mrp || ""}
                    placeholder="Product MRP"
                    onChange={(event) =>
                      setQuickItemForm((current) => ({
                        ...current,
                        mrp: Math.max(
                          0,
                          Number(event.target.value) || 0,
                        ),
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Purchase Price (Optional)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quickItemForm.purchasePrice || ""}
                    placeholder="For profit reports"
                    onChange={(event) =>
                      setQuickItemForm((current) => ({
                        ...current,
                        purchasePrice: Math.max(
                          0,
                          Number(event.target.value) || 0,
                        ),
                      }))
                    }
                  />
                </label>

                <label>
                  <span>GST % (Optional)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={quickItemForm.taxPercent || ""}
                    placeholder="0"
                    onChange={(event) =>
                      setQuickItemForm((current) => ({
                        ...current,
                        taxPercent: Math.max(
                          0,
                          Number(event.target.value) || 0,
                        ),
                      }))
                    }
                  />
                </label>
              </div>

              <label className="ncsPosQuickSaveToggle">
                <input
                  type="checkbox"
                  checked={quickItemForm.saveAsProduct}
                  onChange={(event) =>
                    setQuickItemForm((current) => ({
                      ...current,
                      saveAsProduct: event.target.checked,
                    }))
                  }
                />
                <span>
                  <strong>Keep this item in Product Catalogue</strong>
                  <small>
                    Turn this on when the same item may be sold again.
                  </small>
                </span>
              </label>

              {quickItemForm.saveAsProduct && (
                <label className="ncsPosQuickRemaining">
                  <span>Remaining Stock After This Bill</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={quickItemForm.remainingStock}
                    onChange={(event) =>
                      setQuickItemForm((current) => ({
                        ...current,
                        remainingStock: Math.max(
                          0,
                          Math.floor(Number(event.target.value) || 0),
                        ),
                      }))
                    }
                  />
                  <small>
                    Example: customer buys 1 and 5 are still in the shop, enter 5.
                  </small>
                </label>
              )}

              <div className="ncsPosQuickInfo">
                <b>Bill Only:</b> sale total, payment, rewards, customer credit
                and reports will be recorded. Stock tracking starts only when
                “Keep this item” is enabled.
              </div>

              <footer>
                <button
                  type="button"
                  className="ncsPosQuickCancel"
                  onClick={() => setShowQuickItem(false)}
                >
                  Done / Close
                </button>

                <button
                  type="submit"
                  className="ncsPosQuickAdd"
                >
                  <span>＋</span>
                  Add to Bill
                </button>
              </footer>
            </form>
          </section>
        </div>,
          document.body,
        )}

      {ownerCostInfo && (
        <div className="ncsPosModalOverlay">
          <section className="ncsOwnerCostModal">
            <header>
              <div>
                <span>OWNER / FAMILY VIEW</span>
                <h2>Cost & Supplier</h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setOwnerCostInfo(null)
                }
                aria-label="Close cost details"
              >
                ×
              </button>
            </header>

            <div className="ncsOwnerCostProduct">
              <strong>
                {ownerCostInfo.productName}
              </strong>
              <span>
                {[
                  ownerCostInfo.size,
                  ownerCostInfo.color,
                ]
                  .filter(Boolean)
                  .join(" • ") || "Standard"}
              </span>
            </div>

            <div className="ncsOwnerCostGrid">
              <article>
                <span>Purchase Cost</span>
                <strong>
                  {ownerCostInfo.purchasePrice > 0
                    ? formatCurrency(
                        ownerCostInfo.purchasePrice
                      )
                    : "Not available"}
                </strong>
              </article>

              <article>
                <span>Supplier</span>
                <strong>
                  {ownerCostInfo.supplierName}
                </strong>
              </article>

              <article>
                <span>Purchase Date</span>
                <strong>
                  {ownerCostInfo.purchaseDate
                    ? new Date(
                        `${ownerCostInfo.purchaseDate}T00:00:00`
                      ).toLocaleDateString("en-IN")
                    : "Not available"}
                </strong>
              </article>

              <article>
                <span>Purchase Ref</span>
                <strong>
                  {ownerCostInfo.purchaseNumber ||
                    ownerCostInfo.supplierInvoiceNumber ||
                    "Not available"}
                </strong>
              </article>
            </div>

            {ownerCostInfo.supplierPhone && (
              <div className="ncsOwnerSupplierPhone">
                Supplier phone:{" "}
                {ownerCostInfo.supplierPhone}
              </div>
            )}

            <p className="ncsOwnerCostNote">
              {ownerCostInfo.quickItem
                ? "Quick Item profit is not counted until a reliable purchase cost exists."
                : `${ownerCostInfo.source}. Use this as an internal bargaining reference.`}
            </p>

            <button
              type="button"
              className="ncsOwnerCostClose"
              onClick={() =>
                setOwnerCostInfo(null)
              }
            >
              Done
            </button>
          </section>
        </div>
      )}

      {showHeldBills && (
        <div className="ncsPosModalOverlay">
          <section className="ncsPosHeldModal">
            <header>
              <div>
                <span>Saved Locally</span>
                <h2>Customer Queue</h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowHeldBills(false)
                }
                aria-label="Close held bills"
              >
                ×
              </button>
            </header>

            <div className="ncsPosHeldList">
              {heldBills.length === 0 ? (
                <div className="ncsPosHeldEmpty">
                  <div>⏸</div>
                  <h3>No waiting customers</h3>
                  <p>
                    Paused customer bills will appear here.
                  </p>
                </div>
              ) : (
                heldBills.map((heldBill) => {
                  const heldBaseTotal =
                    heldBill.items.reduce(
                      (total, item) =>
                        total +
                        item.price *
                          item.quantity,
                      0
                    );

                  const heldDiscountPercent =
                    typeof heldBill.billDiscountPercent ===
                    "number"
                      ? heldBill.billDiscountPercent
                      : heldBaseTotal > 0
                        ? (toNumber(
                            heldBill.billDiscount
                          ) /
                            heldBaseTotal) *
                          100
                        : 0;

                  const heldTotal =
                    heldBaseTotal *
                    (1 -
                      Math.min(
                        100,
                        Math.max(
                          0,
                          heldDiscountPercent
                        )
                      ) /
                        100);

                  const heldQuantity =
                    heldBill.items.reduce(
                      (total, item) =>
                        total + item.quantity,
                      0
                    );

                  return (
                    <article
                      key={heldBill.id}
                      className="ncsPosHeldCard"
                    >
                      <div className="ncsPosHeldCardTop">
                        <div>
                          <strong>
                            {heldBill.holdNumber}
                          </strong>

                          <span>
                            {new Date(
                              heldBill.createdAt
                            ).toLocaleString(
                              "en-IN"
                            )}
                          </span>
                        </div>

                        <b>
                          {formatCurrency(
                            Math.max(0, heldTotal)
                          )}
                        </b>
                      </div>

                      <div className="ncsPosHeldMeta">
                        <span>
                          {heldQuantity} item
                          {heldQuantity === 1
                            ? ""
                            : "s"}
                        </span>

                        <span>
                          {heldBill.customerName ||
                            "Walk-in customer"}
                        </span>

                        <span>
                          {heldBill.paymentMethod.toUpperCase()}
                        </span>
                      </div>

                      <div className="ncsPosHeldActions">
                        <button
                          type="button"
                          onClick={() =>
                            deleteHeldBill(
                              heldBill.id
                            )
                          }
                        >
                          Delete
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            resumeHeldBill(heldBill)
                          }
                        >
                          Resume Bill
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {completedSale && (
        <div className="ncsPosSuccessOverlay">
          <section className="ncsPosSuccessModal">
            <div className="ncsPosSuccessIcon">✓</div>

            <span className="ncsPosSuccessEyebrow">
              SALE COMPLETED
            </span>

            <h2>{completedSale.invoiceNumber}</h2>

            <p className="ncsPosSuccessCustomer">
              {completedSale.customerName || "Walk-in Customer"}
              {completedSale.customerPhone
                ? ` • ${completedSale.customerPhone}`
                : ""}
            </p>

            <div className="ncsPosSuccessAmount">
              <small>Total Paid</small>
              <strong>
                {formatCurrency(completedSale.paidAmount)}
              </strong>

              {completedSale.dueAmount > 0 && (
                <span>
                  Due {formatCurrency(completedSale.dueAmount)}
                </span>
              )}
            </div>

            <div className="ncsPosSuccessSummary">
              <p>
                <span>Items</span>
                <strong>
                  {completedSale.items.reduce(
                    (total, item) =>
                      total + item.quantity,
                    0
                  )}
                </strong>
              </p>
              <p>
                <span>Payment</span>
                <strong>
                  {completedSale.paymentMethod.toUpperCase()}
                </strong>
              </p>
              <p>
                <span>Discount</span>
                <strong>
                  {formatCurrency(completedSale.billDiscount)}
                </strong>
              </p>
              <p>
                <span>Round Off</span>
                <strong>
                  {formatCurrency(completedSale.roundOff)}
                </strong>
              </p>
              <p>
                <span>Rewards Used</span>
                <strong>
                  {completedSale.rewardPointsUsed}
                </strong>
              </p>
              <p>
                <span>Points Earned</span>
                <strong>
                  {completedSale.rewardPointsEarned}
                </strong>
              </p>
              <p>
                <span>Reward Balance</span>
                <strong>
                  {completedSale.rewardClosingBalance}
                </strong>
              </p>
            </div>

            <div className="ncsPosSuccessActions">
              <button
                type="button"
                className="ncsPosSuccessWhatsApp"
                disabled={!hasValidWhatsAppCustomerPhone(completedSale)}
                title={
                  hasValidWhatsAppCustomerPhone(completedSale)
                    ? "Send invoice on WhatsApp"
                    : "Add customer mobile number before completing the bill to enable WhatsApp"
                }
                onClick={() =>
                  shareCustomerInvoicePdf(completedSale)
                }
              >
                <span>◉</span>
                Share PDF Invoice
              </button>

              <button
                type="button"
                className="ncsPosSuccessPdf"
                onClick={() =>
                  downloadCustomerInvoicePdf(completedSale)
                }
              >
                Download PDF Invoice
              </button>

              <button
                type="button"
                className="ncsPosSuccessTextWhatsApp"
                disabled={!hasValidWhatsAppCustomerPhone(completedSale)}
                title={
                  hasValidWhatsAppCustomerPhone(completedSale)
                    ? "Send bill message on WhatsApp"
                    : "Add customer mobile number before completing the bill to enable WhatsApp"
                }
                onClick={() =>
                  shareCompletedSaleOnWhatsApp(completedSale)
                }
              >
                WhatsApp Text Invoice
              </button>

              <button
                type="button"
                className="ncsPosSuccessPrint"
                onClick={() =>
                  printCustomerInvoiceT82(completedSale)
                }
              >
                THERMAL • {invoiceStudioSettings.thermal_width}MM
              </button>

              <button
                type="button"
                className="ncsPosSuccessPrintA4"
                onClick={() =>
                  printCustomerInvoiceA4(completedSale)
                }
              >
                A4 • {invoiceStudioSettings.theme.toUpperCase()}
              </button>

              <button
                type="button"
                className="ncsPosSuccessStudio"
                onClick={openInvoiceStudioFromPos}
              >
                INVOICE STUDIO
              </button>

              <button
                type="button"
                className="ncsPosSuccessNewBill"
                onClick={startNewBill}
              >
                New Bill
              </button>
            </div>

            <small className="ncsPosSuccessHint">
              {invoiceStudioLoaded
                ? `Invoice Studio synced • ${invoiceStudioSettings.thermal_width}mm • ${invoiceStudioSettings.theme}`
                : "Loading Invoice Studio settings..."}
              <br />
              Mobileలో “Share PDF Invoice” నొక్కితే PDFను WhatsAppకు
              directగా share చేయవచ్చు. Desktopలో PDF download అయ్యి,
              WhatsApp chat open అవుతుంది; downloaded PDFను attach చేయండి.
            </small>
          </section>
        </div>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .ncsPosPage {
          width: 100%;
          max-width: 100%;
          min-height: 100vh;
          padding: 18px 20px 20px;
          overflow-x: hidden;
          background:
            radial-gradient(
              circle at 10% 0%,
              rgba(212, 175, 55, 0.12),
              transparent 26%
            ),
            ${IVORY};
          color: ${CHARCOAL};
          font-family:
            Poppins, Inter, Arial, sans-serif;
        }

        .ncsOfflineStatusBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin: 0 0 14px;
          padding: 12px 16px;
          border: 1px solid rgba(10, 46, 115, 0.16);
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 8px 22px rgba(3, 21, 63, 0.08);
        }

        .ncsOfflineStatusBar > div {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }

        .ncsOfflineStatusDot {
          width: 10px;
          height: 10px;
          flex: 0 0 auto;
          border-radius: 50%;
        }

        .ncsOfflineStatusBar.online .ncsOfflineStatusDot {
          background: #16834a;
          box-shadow: 0 0 0 5px rgba(22, 131, 74, 0.12);
        }

        .ncsOfflineStatusBar.offline {
          border-color: rgba(180, 35, 24, 0.26);
          background: #fff5f3;
        }

        .ncsOfflineStatusBar.offline .ncsOfflineStatusDot {
          background: #b42318;
          box-shadow: 0 0 0 5px rgba(180, 35, 24, 0.12);
        }

        .ncsOfflineStatusBar strong {
          color: #0a2e73;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.5px;
        }

        .ncsOfflineStatusBar small {
          overflow: hidden;
          color: #667085;
          font-size: 11px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsOfflineStatusBar button {
          min-height: 38px;
          padding: 0 14px;
          border: 0;
          border-radius: 10px;
          background: #0a2e73;
          color: #ffffff;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsOfflineStatusBar button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .ncsPosHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
          padding: 22px 24px;
          overflow: hidden;
          border: 1px solid
            rgba(212, 175, 55, 0.32);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 86% 0%,
              rgba(212, 175, 55, 0.25),
              transparent 32%
            ),
            linear-gradient(
              135deg,
              ${DEEP_BLUE},
              ${ROYAL_BLUE}
            );
          color: #ffffff;
          box-shadow: 0 18px 45px
            rgba(3, 21, 63, 0.18);
        }

        .ncsPosEyebrow {
          display: block;
          margin-bottom: 7px;
          color: ${GOLD};
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.7px;
        }

        .ncsPosHeader h1 {
          margin: 0;
          color: #ffffff;
          font-size: clamp(27px, 3vw, 40px);
          font-weight: 950;
          letter-spacing: -1px;
        }

        .ncsPosHeader p {
          margin: 7px 0 0;
          color: rgba(255, 255, 255, 0.68);
          font-size: 13px;
          font-weight: 550;
        }

        .ncsPosHeader {
          position: relative;
        }

        .ncsPosHeader > div:first-child,
        .ncsPosHeaderActions {
          position: relative;
          z-index: 3;
        }

        .ncsPosCustomerQueue {
          position: absolute;
          z-index: 2;
          right: 258px;
          bottom: 0;
          width: 500px;
          height: 156px;
          overflow: hidden;
          pointer-events: none;
          isolation: isolate;
          background: transparent;

          -webkit-mask-image: linear-gradient(
            90deg,
            transparent 0%,
            rgba(0, 0, 0, 0.18) 5%,
            #000 18%,
            #000 82%,
            rgba(0, 0, 0, 0.18) 95%,
            transparent 100%
          );
          mask-image: linear-gradient(
            90deg,
            transparent 0%,
            rgba(0, 0, 0, 0.18) 5%,
            #000 18%,
            #000 82%,
            rgba(0, 0, 0, 0.18) 95%,
            transparent 100%
          );
        }

        .ncsPosCustomerQueue::before {
          content: "";
          position: absolute;
          z-index: 4;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              180deg,
              rgba(10, 46, 115, 0.92) 0%,
              rgba(10, 46, 115, 0.22) 9%,
              rgba(10, 46, 115, 0) 20%
            );
        }

        .ncsRealFamilyVideo {
          position: absolute;
          left: 50%;
          bottom: 0;
          display: block;
          pointer-events: none;
          transform: translateX(-50%);
          transform-origin: center bottom;
        }

        .ncsRealFamilyVideoBg {
          z-index: 1;
          width: 116%;
          height: 118%;
          object-fit: cover;
          object-position: center center;
          opacity: 0.62;
          filter:
            blur(15px)
            saturate(1.18)
            brightness(0.72);
          transform: translateX(-50%) scale(1.12);
        }

        .ncsRealFamilyVideoMain {
          z-index: 2;
          width: 92%;
          height: 100%;
          object-fit: contain;
          object-position: center bottom;
          opacity: 1;
          filter:
            saturate(1.05)
            contrast(1.04)
            brightness(1)
            drop-shadow(0 12px 16px rgba(2, 11, 36, 0.34));
          transform: translateX(-50%) scale(0.98);
        }

        .ncsPosCounterDesk {
          display: none;
          position: absolute;
          right: 2px;
          bottom: 0;
          width: 78px;
          height: 54px;
          border: 1px solid rgba(212, 175, 55, 0.68);
          border-radius: 14px 14px 6px 6px;
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.17),
              rgba(2, 11, 36, 0.72)
            );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            0 9px 18px rgba(2, 11, 36, 0.25);
        }

        .ncsPosCounterScreen {
          position: absolute;
          top: -17px;
          left: 14px;
          width: 37px;
          height: 28px;
          display: grid;
          place-items: center;
          border: 2px solid ${GOLD};
          border-radius: 8px;
          background: ${DEEP_BLUE};
          color: ${GOLD};
          font-size: 14px;
          font-weight: 950;
        }

        .ncsPosCounterScanner {
          position: absolute;
          right: 10px;
          top: 12px;
          width: 18px;
          height: 11px;
          border: 2px solid rgba(255, 255, 255, 0.75);
          border-radius: 4px;
          transform: rotate(-12deg);
        }

        .ncsPosCounterTick {
          position: absolute;
          right: 8px;
          top: -17px;
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #35c978;
          color: #ffffff;
          font-size: 13px;
          opacity: 0;
          transform: scale(0.45);
          animation: ncsPosCounterSuccess 2.8s ease-in-out infinite;
        }

        .ncsPosHeaderActions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 10px;
          flex-shrink: 0;
        }

        .ncsPosSecondaryButton,
        .ncsPosRefreshButton {
          min-height: 45px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 0 15px;
          border-radius: 12px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 850;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            filter 0.2s ease;
        }

        .ncsPosSecondaryButton {
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.09);
          color: #ffffff;
        }

        .ncsPosSecondaryButton b {
          min-width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 20px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-size: 10px;
        }

        .ncsPosRefreshButton {
          border: 1px solid ${GOLD};
          background: ${GOLD};
          color: ${ROYAL_BLUE};
        }

        .ncsPosSecondaryButton:hover,
        .ncsPosRefreshButton:hover {
          transform: translateY(-2px);
          filter: brightness(1.06);
        }

        .ncsPosRefreshButton:disabled {
          cursor: wait;
          opacity: 0.7;
        }

        .ncsPosRotating {
          display: inline-block;
          animation: ncsPosSpin 0.8s linear
            infinite;
        }

        .ncsPosQuickStats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin: -8px 0 18px;
        }

        .ncsPosQuickCard {
          position: relative;
          min-width: 0;
          min-height: 108px;
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr) auto;
          align-items: center;
          gap: 13px;
          overflow: hidden;
          padding: 17px 18px;
          border: 1px solid rgba(212, 175, 55, 0.34);
          border-radius: 18px;
          color: #ffffff;
          box-shadow: 0 14px 34px rgba(3, 21, 63, 0.16);
          isolation: isolate;
          animation: ncsPosQuickCardEnter 0.6s ease both;
        }

        .ncsPosCreditCard {
          animation-delay: 0.09s;
        }

        .ncsPosSalesCard {
          background:
            radial-gradient(
              circle at 92% 0%,
              rgba(212, 175, 55, 0.31),
              transparent 34%
            ),
            linear-gradient(135deg, #03153f, #0a2e73 62%, #174da4);
        }

        .ncsPosCreditCard {
          background:
            radial-gradient(
              circle at 88% 12%,
              rgba(255, 255, 255, 0.15),
              transparent 30%
            ),
            linear-gradient(135deg, #0a2e73, #133f8d 60%, #8b6812);
        }

        .ncsPosQuickGlow {
          position: absolute;
          z-index: -1;
          width: 150px;
          height: 150px;
          top: -95px;
          right: -25px;
          border-radius: 50%;
          background: rgba(212, 175, 55, 0.22);
          filter: blur(2px);
          animation: ncsPosQuickGlow 3.4s ease-in-out infinite;
        }

        .ncsPosMoneyMotion {
          position: absolute;
          z-index: -1;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .ncsPosMoneyMotion span {
          position: absolute;
          bottom: -28px;
          color: rgba(212, 175, 55, 0.22);
          font-size: 30px;
          font-weight: 950;
          animation: ncsPosMoneyRise 6.8s linear infinite;
        }

        .ncsPosMoneyMotion span:nth-child(1) {
          left: 8%;
          animation-delay: -0.8s;
        }

        .ncsPosMoneyMotion span:nth-child(2) {
          left: 31%;
          animation-delay: -2.6s;
          font-size: 22px;
        }

        .ncsPosMoneyMotion span:nth-child(3) {
          left: 57%;
          animation-delay: -4.4s;
          font-size: 36px;
        }

        .ncsPosMoneyMotion span:nth-child(4) {
          left: 76%;
          animation-delay: -1.9s;
          font-size: 25px;
        }

        .ncsPosMoneyMotion span:nth-child(5) {
          left: 90%;
          animation-delay: -5.6s;
          font-size: 20px;
        }

        .ncsPosMoneyMotionCredit span {
          color: rgba(255, 255, 255, 0.16);
          animation-duration: 7.8s;
        }

        .ncsPosCoinStack {
          position: absolute;
          z-index: 0;
          right: 112px;
          bottom: 15px;
          width: 44px;
          height: 40px;
          opacity: 0.62;
        }

        .ncsPosCoinStack i {
          position: absolute;
          left: 3px;
          width: 37px;
          height: 10px;
          border: 1px solid rgba(255, 255, 255, 0.35);
          border-radius: 50%;
          background: linear-gradient(180deg, #ffe58c, ${GOLD});
          box-shadow: 0 4px 8px rgba(3, 21, 63, 0.18);
          animation: ncsPosCoinLift 2.3s ease-in-out infinite;
        }

        .ncsPosCoinStack i:nth-child(1) {
          bottom: 0;
        }

        .ncsPosCoinStack i:nth-child(2) {
          bottom: 9px;
          animation-delay: 0.18s;
        }

        .ncsPosCoinStack i:nth-child(3) {
          bottom: 18px;
          animation-delay: 0.36s;
        }

        .ncsPosCreditPulse {
          position: absolute;
          z-index: 0;
          right: 100px;
          top: 50%;
          width: 64px;
          height: 64px;
          transform: translateY(-50%);
          pointer-events: none;
        }

        .ncsPosCreditPulse i {
          position: absolute;
          inset: 12px;
          border: 2px solid rgba(212, 175, 55, 0.46);
          border-radius: 50%;
          animation: ncsPosCreditRing 2.4s ease-out infinite;
        }

        .ncsPosCreditPulse i:nth-child(2) {
          animation-delay: 1.2s;
        }

        .ncsPosQuickIcon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(212, 175, 55, 0.68);
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.1);
          color: ${GOLD};
          font-size: 22px;
          font-weight: 950;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .ncsPosQuickContent {
          min-width: 0;
        }

        .ncsPosQuickContent > span {
          display: block;
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .ncsPosQuickContent > strong {
          display: block;
          margin-top: 5px;
          overflow: hidden;
          color: #ffffff;
          font-size: clamp(20px, 2.2vw, 29px);
          font-weight: 950;
          letter-spacing: -0.7px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsPosQuickContent > p {
          margin: 4px 0 0;
          color: rgba(255, 255, 255, 0.67);
          font-size: 9px;
          font-weight: 700;
        }

        .ncsPosQuickMini {
          min-width: 130px;
          display: grid;
          gap: 7px;
        }

        .ncsPosQuickMini span {
          padding: 7px 9px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.62);
          font-size: 7px;
          font-weight: 800;
        }

        .ncsPosQuickMini b {
          display: block;
          margin-top: 2px;
          color: #ffffff;
          font-size: 9px;
        }

        .ncsPosQuickCreditBadge {
          min-width: 86px;
          padding: 9px;
          border: 1px solid rgba(212, 175, 55, 0.55);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.09);
          color: rgba(255, 255, 255, 0.7);
          font-size: 8px;
          font-weight: 850;
          text-align: center;
        }

        .ncsPosQuickCreditBadge b {
          display: block;
          margin-top: 4px;
          color: ${GOLD};
          font-size: 18px;
          font-weight: 950;
        }

        .ncsPosWorkspace {
          width: 100%;
          min-width: 0;
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(520px, 610px);
          gap: 18px;
          align-items: start;
        }

        .ncsPosCatalogue {
          min-width: 0;
        }

        .ncsPosSearchPanel {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 62px;
          padding: 7px;
          border: 1px solid
            rgba(10, 46, 115, 0.11);
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 14px 35px
            rgba(10, 46, 115, 0.08);
        }

        .ncsPosSearchIcon {
          width: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${ROYAL_BLUE};
          font-size: 26px;
          font-weight: 900;
        }

        .ncsPosSearchPanel input {
          min-width: 0;
          flex: 1;
          height: 48px;
          border: 0;
          outline: none;
          background: transparent;
          color: ${CHARCOAL};
          font-family: inherit;
          font-size: 14px;
          font-weight: 650;
        }

        .ncsPosSearchPanel input::placeholder {
          color: #9298a4;
          font-weight: 550;
        }

        .ncsPosClearSearch {
          width: 35px;
          height: 35px;
          border: 0;
          border-radius: 50%;
          background: #eef1f7;
          color: #626b79;
          font-size: 20px;
          cursor: pointer;
        }

        .ncsPosSearchButton {
          min-width: 95px;
          height: 48px;
          border: 0;
          border-radius: 13px;
          background: linear-gradient(
            135deg,
            ${ROYAL_BLUE},
            #174da4
          );
          color: #ffffff;
          font-family: inherit;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsPosAiCompactToggle {
          width: 100%;
          min-height: 62px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 9px 11px;
          border: 0;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .ncsPosAiPanel.collapsed {
          padding: 4px 7px;
          border-radius: 16px;
          box-shadow: 0 7px 18px rgba(3, 21, 63, 0.07);
        }

        .ncsPosAiPanel.collapsed::before {
          opacity: .52;
        }

        .ncsPosAiPanel.collapsed .ncsPosAiHeading small {
          margin-top: 2px;
          font-size: 9px;
        }

        .ncsPosAiCompactRight {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          flex: 0 0 auto;
          padding: 7px 10px;
          border: 1px solid rgba(10, 46, 115, 0.10);
          border-radius: 999px;
          background: rgba(255,255,255,.78);
          color: #0a2e73;
          box-shadow: 0 4px 12px rgba(3,21,63,.05);
        }

        .ncsPosAiCompactRight b {
          font-size: 9px;
          font-weight: 950;
          letter-spacing: .3px;
        }

        .ncsPosAiCompactRight em {
          color: #b8890b;
          font-size: 12px;
          font-style: normal;
          font-weight: 950;
        }

        .ncsPosAiLiveDot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #16a36a;
          box-shadow: 0 0 0 4px rgba(22,163,106,.12);
        }

        .ncsPosAiExpandableBody {
          padding: 0 8px 8px;
          animation: ncsAiExpandIn .2s ease both;
        }

        @keyframes ncsAiExpandIn {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .ncsPosAiPanel {
          position: relative;
          margin-top: 12px;
          padding: 16px;
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.42);
          border-radius: 20px;
          background:
            radial-gradient(circle at 92% 0%, rgba(212, 175, 55, 0.18), transparent 32%),
            linear-gradient(135deg, #ffffff 0%, #fbfcff 60%, #f8f4ec 100%);
          box-shadow: 0 16px 38px rgba(3, 21, 63, 0.10);
        }

        .ncsPosAiPanel::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 4px;
          background: linear-gradient(180deg, ${GOLD}, ${ROYAL_BLUE});
        }

        .ncsPosAiTopRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 8px;
        }

        .ncsPosAiHeading {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
        }

        .ncsPosAiBadge {
          width: 39px;
          height: 39px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border: 1px solid rgba(212, 175, 55, 0.66);
          border-radius: 12px;
          background: linear-gradient(145deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: ${GOLD};
          box-shadow: 0 8px 18px rgba(3, 21, 63, 0.18);
          font-size: 19px;
          font-weight: 950;
        }

        .ncsPosAiHeading strong {
          display: block;
          color: ${DEEP_BLUE};
          font-size: 14px;
          font-weight: 950;
          letter-spacing: 0.01em;
        }

        .ncsPosAiHeading small {
          display: block;
          margin-top: 2px;
          color: #70798a;
          font-size: 10px;
          font-weight: 650;
        }

        .ncsPosAiLivePill {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 10px;
          border: 1px solid rgba(10, 46, 115, 0.10);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.86);
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.08em;
        }

        .ncsPosAiLivePill span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #20a464;
          box-shadow: 0 0 0 4px rgba(32, 164, 100, 0.12);
        }

        .ncsPosAiCommandRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 9px;
          align-items: center;
        }

        .ncsPosAiInputShell {
          position: relative;
          min-width: 0;
          height: 50px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 8px 0 13px;
          border: 1px solid rgba(10, 46, 115, 0.15);
          border-radius: 14px;
          background: #ffffff;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
        }

        .ncsPosAiInputShell:focus-within {
          border-color: rgba(212, 175, 55, 0.88);
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.12);
        }

        .ncsPosAiSpark {
          color: ${GOLD};
          font-size: 16px;
          font-weight: 950;
        }

        .ncsPosAiCommandRow input {
          min-width: 0;
          width: 100%;
          height: 46px;
          border: 0;
          outline: 0;
          background: transparent;
          color: ${CHARCOAL};
          font-family: inherit;
          font-size: 13px;
          font-weight: 720;
        }

        .ncsPosAiCommandRow input::placeholder {
          color: #9299a7;
          font-weight: 580;
        }

        .ncsPosAiClearButton {
          width: 31px;
          height: 31px;
          flex: 0 0 auto;
          border: 0;
          border-radius: 50%;
          background: #f0f3f8;
          color: #6e7581;
          font-size: 18px;
          font-weight: 800;
          cursor: pointer;
        }

        .ncsPosAiAddButton {
          min-width: 132px;
          height: 50px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid rgba(212, 175, 55, 0.72);
          border-radius: 14px;
          background: linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: #ffffff;
          box-shadow: 0 10px 22px rgba(3, 21, 63, 0.18);
          font-family: inherit;
          font-size: 11px;
          font-weight: 950;
          cursor: pointer;
          transition: transform 160ms ease, box-shadow 160ms ease;
        }

        .ncsPosAiAddButton span {
          color: ${GOLD};
          font-size: 15px;
        }

        .ncsPosAiAddButton:hover {
          transform: translateY(-1px);
          box-shadow: 0 13px 28px rgba(3, 21, 63, 0.22);
        }

        .ncsPosAiHintRow {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 9px;
        }

        .ncsPosAiHintRow > span {
          padding: 4px 7px;
          border-radius: 999px;
          background: rgba(10, 46, 115, 0.055);
          color: ${ROYAL_BLUE};
          font-size: 8px;
          font-weight: 850;
        }

        .ncsPosAiHintRow small {
          margin-left: auto;
          color: #8a909b;
          font-size: 8px;
          font-weight: 620;
        }

        .ncsPosAiResults {
          margin-top: 13px;
          padding-top: 12px;
          border-top: 1px solid rgba(10, 46, 115, 0.09);
        }

        .ncsPosAiResultsHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 9px;
        }

        .ncsPosAiResultsHeader strong {
          display: block;
          color: ${DEEP_BLUE};
          font-size: 11px;
          font-weight: 950;
        }

        .ncsPosAiResultsHeader small {
          display: block;
          margin-top: 2px;
          color: #7b8391;
          font-size: 8px;
          font-weight: 620;
        }

        .ncsPosAiResultsHeader > span {
          flex: 0 0 auto;
          padding: 5px 8px;
          border-radius: 999px;
          background: ${IVORY};
          color: #80651a;
          font-size: 8px;
          font-weight: 900;
        }

        .ncsPosAiResultGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .ncsPosAiResultCard {
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px;
          border: 1px solid rgba(10, 46, 115, 0.10);
          border-radius: 14px;
          background: #ffffff;
          color: ${CHARCOAL};
          text-align: left;
          box-shadow: 0 7px 18px rgba(3, 21, 63, 0.06);
          cursor: pointer;
          transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
        }

        .ncsPosAiResultCard:hover {
          transform: translateY(-1px);
          border-color: rgba(212, 175, 55, 0.70);
          box-shadow: 0 10px 24px rgba(3, 21, 63, 0.10);
        }

        .ncsPosAiResultMain {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .ncsPosAiResultIcon {
          width: 34px;
          height: 34px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: linear-gradient(145deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
        }

        .ncsPosAiResultMain > div {
          min-width: 0;
        }

        .ncsPosAiResultMain strong,
        .ncsPosAiResultMain span,
        .ncsPosAiResultMain small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsPosAiResultMain strong {
          max-width: 210px;
          color: ${DEEP_BLUE};
          font-size: 10px;
          font-weight: 950;
        }

        .ncsPosAiResultMain span {
          margin-top: 1px;
          color: ${ROYAL_BLUE};
          font-size: 8px;
          font-weight: 850;
        }

        .ncsPosAiResultMain small {
          margin-top: 2px;
          color: #7b8390;
          font-size: 8px;
          font-weight: 650;
        }

        .ncsPosAiResultMeta {
          flex: 0 0 auto;
          text-align: right;
        }

        .ncsPosAiResultMeta b,
        .ncsPosAiResultMeta small,
        .ncsPosAiResultMeta em {
          display: block;
        }

        .ncsPosAiResultMeta b {
          color: ${DEEP_BLUE};
          font-size: 10px;
          font-weight: 950;
        }

        .ncsPosAiResultMeta small {
          margin-top: 2px;
          color: #27835b;
          font-size: 8px;
          font-weight: 850;
        }

        .ncsPosAiResultMeta em {
          margin-top: 4px;
          color: #9a7720;
          font-size: 8px;
          font-style: normal;
          font-weight: 900;
        }

        /*
         * NCS INDEPENDENT BILLING LAYER
         *
         * Empty bill:
         *   Current Bill stays in its normal embedded POS position.
         *
         * Active bill:
         *   ONLY Current Bill detaches from document flow and becomes a
         *   fixed independent work surface over the right side.
         *   The POS/dashboard/catalogue underneath keeps its own normal
         *   document scroll. Scrolling over the bill scrolls the bill only.
         *   Completing/clearing the sale removes ncsPosBillingFocus and
         *   returns the bill to the original embedded position automatically.
         */
        .ncsPosBillingFocus .ncsPosBillPanel {
          position: fixed !important;
          z-index: 8000;
          top: 8px !important;
          right: 8px;
          bottom: 8px;
          left: auto;
          width: min(
            970px,
            calc(100vw - 665px)
          );
          min-width: 700px;
          max-width: calc(100vw - 130px);
          min-height: 0 !important;
          max-height: none !important;
          height: auto;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
          overflow-y: auto !important;
          overscroll-behavior: contain;
          scrollbar-width: thin;
          scrollbar-color: rgba(10, 46, 115, .35) transparent;
          border: 1px solid rgba(212, 175, 55, .72);
          border-radius: 20px;
          background: #ffffff;
          box-shadow:
            -28px 34px 90px rgba(3, 21, 63, .28),
            0 18px 48px rgba(10, 46, 115, .20),
            0 0 0 1px rgba(255,255,255,.72) inset;
          transform-origin: top right;
          animation: ncsBillLayerOpen .34s cubic-bezier(.2,.82,.22,1);
          isolation: isolate;
        }

        @keyframes ncsBillLayerOpen {
          from {
            opacity: .82;
            transform:
              perspective(1400px)
              translate3d(22px, 32px, -50px)
              rotateY(-1.4deg)
              scale(.972);
          }
          to {
            opacity: 1;
            transform:
              perspective(1400px)
              translate3d(0, 0, 0)
              rotateY(0)
              scale(1);
          }
        }

        .ncsPosBillingFocus .ncsPosBillPanel::before {
          content: "";
          position: sticky;
          top: 0;
          z-index: 0;
          display: block;
          height: 0;
          pointer-events: none;
        }

        .ncsPosBillingFocus .ncsPosBillHeader {
          position: sticky;
          top: 0;
          z-index: 40;
          flex: 0 0 auto;
          border-bottom: 1px solid rgba(212, 175, 55, .24);
          box-shadow: 0 12px 30px rgba(3, 21, 63, .14);
        }

        /*
         * In active billing mode the whole bill surface owns its scrolling.
         * Avoid nested cart scrolling, so wheel/touch behavior is natural.
         */
        .ncsPosBillingFocus .ncsPosCartItems {
          min-height: 220px;
          max-height: none !important;
          overflow: visible !important;
          flex: 0 0 auto;
          padding-top: 10px;
        }

        .ncsPosBillingFocus .ncsPosCartTableHeader {
          position: relative;
          top: auto;
          z-index: 2;
          flex: 0 0 auto;
          margin: 0;
          box-shadow: none;
        }

        .ncsPosBillingFocus .ncsPosBillPanel > * {
          position: relative;
        }

        /*
         * A subtle depth edge makes the active bill read as a separate
         * physical work surface without blocking the catalogue underneath.
         */
        .ncsPosBillingFocus .ncsPosBillPanel::after {
          content: "";
          position: fixed;
          z-index: -1;
          top: 18px;
          right: 18px;
          bottom: 18px;
          width: min(
            940px,
            calc(100vw - 690px)
          );
          min-width: 670px;
          border-radius: 28px;
          background: rgba(3, 21, 63, .08);
          filter: blur(18px);
          pointer-events: none;
        }

        @media (max-width: 1380px) {
          .ncsPosBillingFocus .ncsPosBillPanel {
            width: min(820px, calc(100vw - 525px));
            min-width: 620px;
          }

          .ncsPosBillingFocus .ncsPosBillPanel::after {
            width: min(790px, calc(100vw - 550px));
            min-width: 590px;
          }
        }

        @media (max-width: 1100px) {
          .ncsPosBillingFocus .ncsPosBillPanel {
            top: 8px !important;
            right: 8px;
            bottom: 12px;
            width: calc(100vw - 210px);
            min-width: 0;
            max-width: none;
          }

          .ncsPosBillingFocus .ncsPosBillPanel::after {
            display: none;
          }
        }

        @media (max-width: 760px) {
          .ncsPosBillingFocus .ncsPosBillPanel {
            inset: 8px 8px 8px 8px;
            width: auto;
            border-radius: 18px;
          }

          .ncsPosBillingFocus .ncsPosCartTableHeader {
            position: relative;
            top: auto;
          }
        }

        /* Dense brand window for brands with many styles */
        .ncsPosBrandModalDense {
          width: min(1240px, 96vw);
          max-height: 92vh;
        }

        .ncsPosBrandModalDense .ncsPosBrandModalBody {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          padding: 10px;
        }

        .ncsPosBrandModalDense .ncsPosGroupedCardMain {
          grid-template-columns: 76px minmax(0, 1fr) 34px;
          gap: 9px;
          min-height: 112px;
          padding: 9px;
        }

        .ncsPosBrandModalDense .ncsPosGroupedImage {
          height: 86px;
        }

        .ncsPosBrandModalDense .ncsPosGroupedInfo h3 {
          font-size: 13px;
          line-height: 1.14;
        }

        .ncsPosBrandModalDense .ncsPosGroupedInfo p,
        .ncsPosBrandModalDense .ncsPosGroupedInfo small {
          font-size: 8px;
        }

        .ncsPosBrandModalDense .ncsPosGroupedCard.open {
          grid-column: 1 / -1;
          height: auto;
          min-height: max-content;
          overflow: visible;
          align-self: start;
        }

        @media (max-width: 1180px) {
          .ncsPosBrandModalDense .ncsPosBrandModalBody {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .ncsPosBrandModalDense .ncsPosBrandModalBody {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .ncsPosAiTopRow {
            align-items: flex-start;
          }

          .ncsPosAiLivePill {
            display: none;
          }

          .ncsPosAiCommandRow {
            grid-template-columns: 1fr;
          }

          .ncsPosAiAddButton {
            width: 100%;
          }

          .ncsPosAiHintRow small {
            width: 100%;
            margin-left: 0;
          }

          .ncsPosAiResultGrid {
            grid-template-columns: 1fr;
          }
        }

        .ncsPosCategoryRow {
          display: flex;
          gap: 9px;
          margin-top: 14px;
          padding: 2px 1px 8px;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .ncsPosCategoryRow::-webkit-scrollbar {
          display: none;
        }

        .ncsPosCategoryButton {
          min-height: 39px;
          flex-shrink: 0;
          padding: 0 15px;
          border: 1px solid
            rgba(10, 46, 115, 0.12);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.84);
          color: #596274;
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .ncsPosCategoryButton:hover {
          border-color: ${GOLD};
          color: ${ROYAL_BLUE};
        }

        .ncsPosCategoryActive {
          border-color: ${ROYAL_BLUE};
          background: ${ROYAL_BLUE};
          color: #ffffff !important;
          box-shadow: 0 8px 20px
            rgba(10, 46, 115, 0.2);
        }

        .ncsPosCatalogueTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin: 16px 0 12px;
        }

        .ncsPosCatalogueTop h2 {
          margin: 0;
          color: ${DEEP_BLUE};
          font-size: 21px;
          font-weight: 950;
        }

        .ncsPosCatalogueTop p {
          margin: 3px 0 0;
          color: #77808f;
          font-size: 11px;
          font-weight: 650;
        }

        .ncsPosStatusBadge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 11px;
          border: 1px solid
            rgba(31, 150, 89, 0.18);
          border-radius: 30px;
          background: rgba(31, 150, 89, 0.08);
          color: #147943;
          font-size: 10px;
          font-weight: 850;
        }

        .ncsPosStatusBadge span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #25a760;
          box-shadow: 0 0 0 4px
            rgba(37, 167, 96, 0.12);
        }

        .ncsPosProductGrid {
          display: grid;
          grid-template-columns: repeat(
            auto-fill,
            minmax(142px, 1fr)
          );
          gap: 10px;
        }

        .ncsPosProductCard {
          position: relative;
          min-width: 0;
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.11);
          border-radius: 15px;
          background:
            linear-gradient(180deg, #ffffff, #fffdf8);
          box-shadow:
            0 8px 20px rgba(10, 46, 115, 0.07),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            border-color 0.2s ease;
        }

        .ncsPosProductCard::after {
          content: "";
          position: absolute;
          inset: auto 10px 0;
          height: 2px;
          border-radius: 3px 3px 0 0;
          background: linear-gradient(90deg, transparent, ${GOLD}, transparent);
          opacity: 0.7;
        }

        .ncsPosProductCard:hover {
          transform: translateY(-3px);
          border-color: rgba(212, 175, 55, 0.78);
          box-shadow: 0 14px 28px rgba(10, 46, 115, 0.14);
        }

        .ncsPosProductCardButton {
          width: 100%;
          display: block;
          padding: 0;
          border: 0;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .ncsPosProductCardButton:disabled {
          cursor: not-allowed;
        }

        .ncsPosProductImage {
          position: relative;
          height: 108px;
          overflow: hidden;
          background:
            linear-gradient(145deg, #f4f0e6, #ffffff);
        }

        .ncsPosProductImage img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform 0.35s ease;
        }

        .ncsPosProductCard:hover
          .ncsPosProductImage
          img {
          transform: scale(1.045);
        }

        .ncsPosImageFallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(
              circle at 30% 20%,
              rgba(212, 175, 55, 0.28),
              transparent 34%
            ),
            linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: ${GOLD};
          font-size: 20px;
          font-weight: 950;
          letter-spacing: 1.8px;
        }

        .ncsPosStockBadge {
          position: absolute;
          top: 7px;
          right: 7px;
          padding: 4px 7px;
          border-radius: 30px;
          background: rgba(13, 119, 67, 0.92);
          color: #ffffff;
          font-size: 7px;
          font-weight: 900;
          backdrop-filter: blur(8px);
        }

        .ncsPosStockLow {
          background: rgba(214, 137, 17, 0.94);
        }

        .ncsPosStockEmpty {
          background: rgba(185, 48, 48, 0.94);
        }

        .ncsPosProductOutOfStock {
          opacity: 0.67;
          filter: grayscale(0.25);
        }

        .ncsPosProductInfo {
          padding: 10px 10px 11px;
        }

        .ncsPosProductCategory {
          display: block;
          color: ${GOLD};
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.65px;
          text-transform: uppercase;
        }

        .ncsPosProductInfo h3 {
          min-height: 30px;
          display: -webkit-box;
          margin: 4px 0 2px;
          overflow: hidden;
          color: ${DEEP_BLUE};
          font-size: 11px;
          font-weight: 950;
          line-height: 1.35;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .ncsPosBrandLine {
          min-height: 18px;
          margin: 0 0 8px;
          overflow: hidden;
          color: #5c677d;
          font-size: 9px;
          font-weight: 850;
          line-height: 1.4;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsPosVariantChips {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          min-height: 31px;
          margin-bottom: 8px;
        }

        .ncsPosVariantChips span {
          min-height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 950;
          line-height: 1;
          letter-spacing: 0.2px;
        }

        .ncsPosVariantChips .ncsPosSizeChip {
          border: 1px solid rgba(212, 175, 55, 0.72);
          background: linear-gradient(135deg, #fff8dc, #f8e9a8);
          color: ${ROYAL_BLUE};
          box-shadow: 0 4px 10px rgba(212, 175, 55, 0.16);
        }

        .ncsPosVariantChips .ncsPosColorChip {
          border: 1px solid rgba(10, 46, 115, 0.18);
          background: #eef2f9;
          color: #3f4b63;
        }

        .ncsPosProductBottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .ncsPosProductBottom > div {
          min-width: 0;
        }

        .ncsPosProductBottom strong {
          display: block;
          color: ${ROYAL_BLUE};
          font-size: 12px;
          font-weight: 950;
        }

        .ncsPosProductBottom del {
          display: block;
          margin-top: 1px;
          color: #9b9fac;
          font-size: 7px;
          font-weight: 650;
        }

        .ncsPosAddIcon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 9px;
          background: linear-gradient(135deg, ${GOLD}, #f0d36d);
          color: ${ROYAL_BLUE};
          font-size: 16px;
          font-weight: 950;
          box-shadow: 0 6px 14px rgba(212, 175, 55, 0.24);
        }

        .ncsPosProductInfo small {
          display: block;
          margin-top: 6px;
          overflow: hidden;
          color: #9a9faa;
          font-size: 6.5px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsPosBillPanel {
          width: 100%;
          min-width: 0;
          position: sticky;
          top: 18px;
          max-height: calc(100vh - 36px);
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #c8ced8 transparent;
          border: 1px solid
            rgba(10, 46, 115, 0.12);
          border-radius: 22px;
          background: #ffffff;
          box-shadow: 0 18px 48px
            rgba(3, 21, 63, 0.14);
        }

        .ncsPosBillHeader {
          min-height: 79px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 17px 18px;
          background:
            radial-gradient(
              circle at 85% 0%,
              rgba(212, 175, 55, 0.2),
              transparent 30%
            ),
            linear-gradient(
              135deg,
              ${DEEP_BLUE},
              ${ROYAL_BLUE}
            );
          color: #ffffff;
        }

        .ncsPosBillHeader span {
          display: block;
          color: ${GOLD};
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .ncsPosBillHeader h2 {
          margin: 4px 0 0;
          color: #ffffff;
          font-size: 20px;
          font-weight: 950;
        }

        .ncsPosBillHeaderActions {
          display: flex;
          gap: 7px;
        }

        .ncsPosBillHeaderActions button {
          width: 38px;
          height: 38px;
          border: 1px solid
            rgba(255, 255, 255, 0.18);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.09);
          color: #ffffff;
          font-size: 17px;
          cursor: pointer;
        }

        .ncsPosCloseMobileCart {
          display: none;
        }

        .ncsPosMarketingConsent {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 10px 0 0;
          padding: 10px;
          border: 1px solid #BBF7D0;
          border-radius: 10px;
          background: #F0FDF4;
          color: #166534;
          font-size: 9px;
          font-weight: 800;
          line-height: 1.45;
          cursor: pointer;
        }

        .ncsPosMarketingConsent small {
          display: block;
          margin-top: 2px;
          color: #667085;
          font-size: 7px;
          font-weight: 650;
        }

        .ncsPosMarketingConsent input {
          margin-top: 1px;
          accent-color: #16A34A;
        }

        .ncsPosCustomerCard {
          padding: 14px 16px;
          border-bottom: 1px solid #edf0f5;
          background: #fbfcff;
        }

        .ncsPosCustomerTitle {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 10px;
        }

        .ncsPosCustomerTitle > span {
          width: 31px;
          height: 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: rgba(212, 175, 55, 0.15);
          font-size: 15px;
        }

        .ncsPosCustomerTitle strong,
        .ncsPosCustomerTitle small {
          display: block;
        }

        .ncsPosCustomerTitle strong {
          color: ${DEEP_BLUE};
          font-size: 11px;
          font-weight: 900;
        }

        .ncsPosCustomerTitle small {
          margin-top: 2px;
          color: #9298a4;
          font-size: 8px;
          font-weight: 650;
        }

        .ncsPosCustomerFields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .ncsPosCustomerFields input {
          width: 100%;
          min-width: 0;
          height: 39px;
          padding: 0 10px;
          border: 1px solid #e4e8ef;
          border-radius: 10px;
          outline: none;
          background: #ffffff;
          color: ${CHARCOAL};
          font-family: inherit;
          font-size: 10px;
          font-weight: 650;
        }

        .ncsPosCustomerFields input:focus {
          border-color: ${GOLD};
          box-shadow: 0 0 0 3px
            rgba(212, 175, 55, 0.12);
        }

        .ncsPosRewardLookup {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 10px;
          padding: 10px;
          border: 1px solid rgba(212, 175, 55, 0.45);
          border-radius: 12px;
          background: #fffaf0;
        }

        .ncsPosRewardLookup > span {
          color: #667085;
          font-size: 9px;
          font-weight: 750;
          line-height: 1.45;
        }

        .ncsPosRewardLookup div span,
        .ncsPosRewardLookup div strong,
        .ncsPosRewardLookup div small {
          display: block;
        }

        .ncsPosRewardLookup div span {
          color: ${GOLD};
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .ncsPosRewardLookup div strong {
          margin-top: 3px;
          color: ${ROYAL_BLUE};
          font-size: 11px;
        }

        .ncsPosRewardLookup div small {
          margin-top: 3px;
          color: #667085;
          font-size: 8px;
        }

        .ncsPosRewardLookup label {
          min-width: 92px;
        }

        .ncsPosRewardLookup label span {
          display: block;
          margin-bottom: 4px;
          color: #667085;
          font-size: 8px;
          font-weight: 850;
        }

        .ncsPosRewardLookup input {
          width: 100%;
          min-height: 38px;
          padding: 0 9px;
          border: 1px solid #d6b64d;
          border-radius: 9px;
          outline: none;
          background: #fff;
          color: ${ROYAL_BLUE};
          font-family: inherit;
          font-size: 11px;
          font-weight: 900;
        }

        .ncsPosRewardDiscountLine {
          color: #7A5A00;
        }

        .ncsPosCartItems {
          min-height: 170px;
          flex: 1;
          padding: 12px 14px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #c8ced8 transparent;
        }

        .ncsPosCartItem {
          padding: 11px;
          border: 1px solid #e8ebf0;
          border-radius: 14px;
          background: #ffffff;
        }

        .ncsPosCartItem + .ncsPosCartItem {
          margin-top: 9px;
        }

        .ncsPosCartItemTop {
          display: grid;
          grid-template-columns:
            46px
            minmax(105px, 1fr)
            96px
            104px
            94px
            27px;
          align-items: center;
          gap: 7px;
          width: 100%;
          min-width: 0;
        }

        .ncsPosCartThumbnail {
          width: 48px;
          height: 55px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
          border-radius: 10px;
          background: ${ROYAL_BLUE};
          color: ${GOLD};
          font-size: 9px;
          font-weight: 950;
        }

        .ncsPosCartThumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ncsPosCartProductInfo {
          min-width: 0;
          flex: 1;
        }

        .ncsPosCartProductInfo h3 {
          display: block;
          margin: 0;
          overflow: hidden;
          color: ${DEEP_BLUE};
          font-size: 11px;
          font-weight: 900;
          line-height: 1.3;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsPosCartProductInfo p {
          margin: 4px 0;
          color: #8b919d;
          font-size: 8px;
          font-weight: 650;
        }

        .ncsPosCartProductInfo strong {
          color: ${ROYAL_BLUE};
          font-size: 10px;
          font-weight: 900;
        }

        .ncsPosItemPriceLine {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 7px;
        }

        .ncsPosItemPriceLine span,
        .ncsPosItemPriceLine del {
          color: #7b8493;
          font-size: 9px;
          font-weight: 750;
        }

        .ncsPosItemPriceLine strong {
          color: ${ROYAL_BLUE};
          font-size: 11px;
          font-weight: 950;
        }

        .ncsPosRemoveItem {
          width: 25px;
          height: 25px;
          flex-shrink: 0;
          border: 0;
          border-radius: 8px;
          background: #fff0f0;
          color: #be4141;
          font-size: 16px;
          cursor: pointer;
        }

        .ncsPosItemDiscountField,
        .ncsPosItemLineTotal {
          display: grid;
          gap: 4px;
          min-width: 0;
          align-self: center;
        }

        .ncsPosItemDiscountField {
          width: 104px;
        }

        .ncsPosItemLineTotal {
          width: 94px;
        }

        .ncsPosItemDiscountField > span,
        .ncsPosItemLineTotal > span {
          color: #727b8a;
          font-size: 8px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .ncsPosItemDiscountField > div {
          min-height: 34px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 28px;
          align-items: center;
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.2);
          border-radius: 10px;
          background: #fffdf6;
        }

        .ncsPosItemDiscountField input {
          width: 100%;
          min-width: 0;
          height: 32px;
          border: 0;
          outline: 0;
          background: transparent;
          color: ${DEEP_BLUE};
          font-size: 12px;
          font-weight: 900;
          text-align: center;
        }

        .ncsPosItemDiscountField b {
          color: ${ROYAL_BLUE};
          font-size: 11px;
          font-weight: 950;
          text-align: center;
        }

        .ncsPosItemLineTotal {
          text-align: right;
          white-space: nowrap;
        }

        .ncsPosItemLineTotal strong {
          color: ${DEEP_BLUE};
          font-size: 15px;
          font-weight: 950;
        }

        .ncsPosQuantityControl {
          width: 96px;
          display: grid;
          grid-template-columns: 30px minmax(34px, 1fr) 30px;
          align-items: center;
          overflow: hidden;
          border: 1px solid #dfe4eb;
          border-radius: 9px;
          white-space: nowrap;
        }

        .ncsPosQuantityControl button {
          width: 30px;
          height: 32px;
          border: 0;
          background: #f2f5fa;
          color: ${ROYAL_BLUE};
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsPosQuantityControl span {
          min-width: 34px;
          color: ${DEEP_BLUE};
          font-size: 11px;
          font-weight: 900;
          text-align: center;
        }

        .ncsPosEmptyCart {
          min-height: 195px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .ncsPosEmptyCart > div {
          width: 55px;
          height: 55px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          background: #f0f3f8;
          font-size: 24px;
        }

        .ncsPosEmptyCart h3 {
          margin: 11px 0 3px;
          color: ${DEEP_BLUE};
          font-size: 13px;
          font-weight: 900;
        }

        .ncsPosEmptyCart p {
          margin: 0;
          color: #969ca7;
          font-size: 9px;
          font-weight: 650;
        }

        .ncsPosSummary {
          padding: 13px 16px;
          border-top: 1px solid #edf0f5;
          background: #fbfcff;
        }

        .ncsPosDiscountField {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 11px;
        }

        .ncsPosDiscountField > span {
          color: #626b78;
          font-size: 10px;
          font-weight: 750;
        }

        .ncsPosDiscountField > div {
          width: 95px;
          height: 35px;
          display: flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid #dfe4eb;
          border-radius: 9px;
          background: #ffffff;
        }

        .ncsPosDiscountField > div > span {
          padding-right: 10px;
          color: ${ROYAL_BLUE};
          font-size: 11px;
          font-weight: 900;
        }

        .ncsPosDiscountField input {
          width: 100%;
          min-width: 0;
          height: 100%;
          padding: 0 4px 0 8px;
          border: 0;
          outline: none;
          background: transparent;
          color: ${DEEP_BLUE};
          font-family: inherit;
          font-size: 11px;
          font-weight: 850;
          text-align: right;
        }

        .ncsPosRoundOffField {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 8px 0 6px;
        }

        .ncsPosRoundOffField > span {
          color: #626b78;
          font-size: 10px;
          font-weight: 750;
        }

        .ncsPosRoundOffField > div {
          width: 105px;
          height: 35px;
          display: flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid #dfe4eb;
          border-radius: 9px;
          background: #ffffff;
        }

        .ncsPosRoundOffField > div > span {
          padding-left: 9px;
          color: ${ROYAL_BLUE};
          font-size: 11px;
          font-weight: 900;
        }

        .ncsPosRoundOffField input {
          width: 100%;
          min-width: 0;
          height: 100%;
          padding: 0 8px 0 4px;
          border: 0;
          outline: none;
          background: transparent;
          color: ${DEEP_BLUE};
          font-family: inherit;
          font-size: 11px;
          font-weight: 850;
          text-align: right;
        }

        .ncsPosRoundOffLine strong {
          color: #b54708;
        }

        .ncsPosSummaryLine {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 0;
          color: #717886;
          font-size: 9px;
          font-weight: 650;
        }

        .ncsPosSummaryLine strong {
          color: ${CHARCOAL};
          font-size: 10px;
          font-weight: 850;
        }

        .ncsPosDiscountLine strong {
          color: #179353;
        }

        .ncsPosTotalLine {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-top: 9px;
          padding-top: 11px;
          border-top: 1px dashed #dce1e8;
        }

        .ncsPosTotalLine span,
        .ncsPosTotalLine small {
          display: block;
        }

        .ncsPosTotalLine span {
          color: ${DEEP_BLUE};
          font-size: 12px;
          font-weight: 950;
        }

        .ncsPosTotalLine small {
          margin-top: 2px;
          color: #9a9faa;
          font-size: 7px;
          font-weight: 650;
        }

        .ncsPosTotalLine > strong {
          color: ${ROYAL_BLUE};
          font-size: 20px;
          font-weight: 950;
          letter-spacing: -0.5px;
        }

        .ncsPosPaymentSection {
          position: sticky;
          z-index: 5;
          bottom: 0;
          flex-shrink: 0;
          padding: 13px 16px 16px;
          border-top: 1px solid #edf0f5;
          background: #ffffff;
          box-shadow: 0 -10px 24px rgba(3, 21, 63, 0.06);
        }

        .ncsPosPaymentLabel {
          display: block;
          margin-bottom: 8px;
          color: ${DEEP_BLUE};
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .ncsPosPaymentGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 7px;
        }

        .ncsPosPaymentButton {
          min-width: 0;
          min-height: 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 6px 3px;
          border: 1px solid #e0e5ec;
          border-radius: 10px;
          background: #ffffff;
          color: #68717f;
          font-family: inherit;
          font-size: 8px;
          font-weight: 800;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .ncsPosPaymentButton span {
          color: ${ROYAL_BLUE};
          font-size: 14px;
          font-weight: 950;
        }

        .ncsPosPaymentActive {
          border-color: ${GOLD};
          background: rgba(212, 175, 55, 0.12);
          color: ${ROYAL_BLUE};
          box-shadow: 0 0 0 2px
            rgba(212, 175, 55, 0.1);
        }

        .ncsPosCreditPanel {
          margin-top: 11px;
          padding: 12px;
          border: 1px solid rgba(212, 175, 55, 0.45);
          border-radius: 13px;
          background:
            linear-gradient(
              135deg,
              rgba(212, 175, 55, 0.12),
              rgba(10, 46, 115, 0.04)
            );
        }

        .ncsPosCreditTitle,
        .ncsPosCreditTitle > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 9px;
        }

        .ncsPosCreditTitle > div > span {
          width: 31px;
          height: 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 10px;
          background: ${ROYAL_BLUE};
          color: ${GOLD};
          font-size: 15px;
          font-weight: 950;
        }

        .ncsPosCreditTitle section strong,
        .ncsPosCreditTitle section small {
          display: block;
        }

        .ncsPosCreditTitle section strong {
          color: ${DEEP_BLUE};
          font-size: 10px;
          font-weight: 950;
        }

        .ncsPosCreditTitle section small {
          margin-top: 2px;
          color: #8a93a0;
          font-size: 7px;
          font-weight: 650;
        }

        .ncsPosCreditTitle > b {
          color: #b42318;
          font-size: 10px;
          white-space: nowrap;
        }

        .ncsPosCreditFields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 10px;
        }

        .ncsPosCreditFields label > span {
          display: block;
          margin-bottom: 5px;
          color: #626b78;
          font-size: 8px;
          font-weight: 850;
        }

        .ncsPosCreditFields input {
          width: 100%;
          min-width: 0;
          height: 38px;
          padding: 0 9px;
          border: 1px solid #dfe4eb;
          border-radius: 9px;
          outline: none;
          background: #ffffff;
          color: ${DEEP_BLUE};
          font-family: inherit;
          font-size: 9px;
          font-weight: 800;
        }

        .ncsPosCreditFields input:focus {
          border-color: ${GOLD};
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.12);
        }

        .ncsPosCreditSummary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          margin-top: 9px;
        }

        .ncsPosCreditSummary p {
          margin: 0;
          padding: 8px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.8);
        }

        .ncsPosCreditSummary span,
        .ncsPosCreditSummary strong {
          display: block;
        }

        .ncsPosCreditSummary span {
          color: #8a93a0;
          font-size: 7px;
          font-weight: 750;
        }

        .ncsPosCreditSummary strong {
          margin-top: 3px;
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 950;
        }

        .ncsPosCreditDueRow strong {
          color: #b42318;
        }

        .ncsPosCompleteButton {
          width: 100%;
          min-height: 59px;
          display: flex;
          align-items: center;
          gap: 11px;
          margin-top: 11px;
          padding: 8px 14px;
          border: 1px solid ${GOLD};
          border-radius: 14px;
          background:
            linear-gradient(
              135deg,
              ${ROYAL_BLUE},
              #174da4
            );
          color: #ffffff;
          font-family: inherit;
          cursor: pointer;
          box-shadow: 0 12px 28px
            rgba(10, 46, 115, 0.22);
          transition:
            transform 0.2s ease,
            filter 0.2s ease;
        }

        .ncsPosCompleteButton:hover {
          transform: translateY(-2px);
          filter: brightness(1.06);
        }

        .ncsPosCompleteButton:disabled {
          cursor: not-allowed;
          opacity: 0.52;
          transform: none;
        }

        .ncsPosCompleteButton > span {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-size: 16px;
          font-weight: 950;
        }

        .ncsPosCompleteButton > div {
          min-width: 0;
          flex: 1;
          text-align: left;
        }

        .ncsPosCompleteButton strong,
        .ncsPosCompleteButton small {
          display: block;
        }

        .ncsPosCompleteButton strong {
          font-size: 12px;
          font-weight: 950;
        }

        .ncsPosCompleteButton small {
          margin-top: 3px;
          color: ${GOLD};
          font-size: 10px;
          font-weight: 850;
        }

        .ncsPosCompleteButton > b {
          font-size: 19px;
        }

        .ncsPosNotice {
          position: fixed;
          z-index: 500;
          top: 20px;
          right: 20px;
          max-width: min(380px, calc(100vw - 40px));
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 13px 15px;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 18px 48px
            rgba(3, 21, 63, 0.2);
          animation: ncsPosNoticeIn 0.28s ease;
        }

        .ncsPosNotice > span {
          width: 31px;
          height: 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 950;
        }

        .ncsPosNotice p {
          margin: 0;
          color: ${CHARCOAL};
          font-size: 11px;
          font-weight: 750;
          line-height: 1.45;
        }

        .ncsPosNotice-success {
          border: 1px solid
            rgba(28, 153, 85, 0.25);
        }

        .ncsPosNotice-success > span {
          background: rgba(28, 153, 85, 0.12);
          color: #16864a;
        }

        .ncsPosNotice-error {
          border: 1px solid
            rgba(196, 61, 61, 0.25);
        }

        .ncsPosNotice-error > span {
          background: rgba(196, 61, 61, 0.12);
          color: #b53333;
        }

        .ncsPosNotice-info {
          border: 1px solid
            rgba(10, 46, 115, 0.2);
        }

        .ncsPosNotice-info > span {
          background: rgba(10, 46, 115, 0.1);
          color: ${ROYAL_BLUE};
        }

        .ncsPosErrorCard {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          margin-bottom: 14px;
          padding: 15px;
          border: 1px solid
            rgba(190, 62, 62, 0.2);
          border-radius: 15px;
          background: #fff5f5;
        }

        .ncsPosErrorCard > div {
          width: 37px;
          height: 37px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: #bc3d3d;
          color: #ffffff;
          font-weight: 950;
        }

        .ncsPosErrorCard strong {
          color: #8e2d2d;
          font-size: 12px;
          font-weight: 900;
        }

        .ncsPosErrorCard p {
          margin: 4px 0 8px;
          color: #8f6060;
          font-size: 9px;
          font-weight: 650;
        }

        .ncsPosErrorCard button {
          min-height: 32px;
          padding: 0 12px;
          border: 0;
          border-radius: 8px;
          background: #a93636;
          color: #ffffff;
          font-family: inherit;
          font-size: 9px;
          font-weight: 850;
          cursor: pointer;
        }

        .ncsPosEmptyState {
          min-height: 350px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px dashed
            rgba(10, 46, 115, 0.18);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.62);
          text-align: center;
        }

        .ncsPosEmptyState > div {
          width: 65px;
          height: 65px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 21px;
          background: ${ROYAL_BLUE};
          color: ${GOLD};
          font-size: 30px;
        }

        .ncsPosEmptyState h3 {
          margin: 14px 0 4px;
          color: ${DEEP_BLUE};
          font-size: 16px;
          font-weight: 950;
        }

        .ncsPosEmptyState p {
          margin: 0;
          color: #8e95a0;
          font-size: 10px;
          font-weight: 650;
        }

        .ncsPosSkeletonCard {
          overflow: hidden;
          border-radius: 18px;
          background: #ffffff;
        }

        .ncsPosSkeletonCard div {
          height: 165px;
          background: #eceff4;
        }

        .ncsPosSkeletonCard span {
          height: 10px;
          display: block;
          margin: 13px 14px 0;
          border-radius: 10px;
          background: #eceff4;
        }

        .ncsPosSkeletonCard span:nth-child(3) {
          width: 70%;
        }

        .ncsPosSkeletonCard span:nth-child(4) {
          width: 42%;
          margin-bottom: 15px;
        }

        .ncsPosSkeletonCard div,
        .ncsPosSkeletonCard span {
          background-image: linear-gradient(
            90deg,
            #edf0f4 0%,
            #f8f9fb 50%,
            #edf0f4 100%
          );
          background-size: 200% 100%;
          animation: ncsPosShimmer 1.3s
            infinite;
        }

        .ncsPosModalOverlay {
          position: fixed;
          z-index: 20000;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(3, 21, 63, 0.7);
          backdrop-filter: blur(7px);
        }

        .ncsPosHeldModal {
          width: min(620px, 100%);
          max-height: min(720px, 90vh);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid
            rgba(212, 175, 55, 0.45);
          border-radius: 23px;
          background: ${IVORY};
          box-shadow: 0 28px 80px
            rgba(0, 0, 0, 0.3);
          animation: ncsPosModalIn 0.25s ease;
        }

        .ncsPosHeldModal > header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 20px 22px;
          background: linear-gradient(
            135deg,
            ${DEEP_BLUE},
            ${ROYAL_BLUE}
          );
          color: #ffffff;
        }

        .ncsPosHeldModal header span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .ncsPosHeldModal header h2 {
          margin: 4px 0 0;
          font-size: 23px;
          font-weight: 950;
        }

        .ncsPosHeldModal header button {
          width: 41px;
          height: 41px;
          border: 1px solid
            rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.09);
          color: #ffffff;
          font-size: 21px;
          cursor: pointer;
        }

        .ncsPosHeldList {
          padding: 16px;
          overflow-y: auto;
        }

        .ncsPosHeldCard {
          padding: 15px;
          border: 1px solid
            rgba(10, 46, 115, 0.11);
          border-radius: 15px;
          background: #ffffff;
          box-shadow: 0 8px 22px
            rgba(10, 46, 115, 0.06);
        }

        .ncsPosHeldCard + .ncsPosHeldCard {
          margin-top: 10px;
        }

        .ncsPosHeldCardTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .ncsPosHeldCardTop strong,
        .ncsPosHeldCardTop span {
          display: block;
        }

        .ncsPosHeldCardTop strong {
          color: ${DEEP_BLUE};
          font-size: 12px;
          font-weight: 950;
        }

        .ncsPosHeldCardTop span {
          margin-top: 3px;
          color: #9298a4;
          font-size: 8px;
          font-weight: 650;
        }

        .ncsPosHeldCardTop > b {
          color: ${ROYAL_BLUE};
          font-size: 16px;
          font-weight: 950;
        }

        .ncsPosHeldMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 11px;
        }

        .ncsPosHeldMeta span {
          padding: 6px 9px;
          border-radius: 20px;
          background: #eef2f8;
          color: #687280;
          font-size: 8px;
          font-weight: 750;
        }

        .ncsPosHeldActions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 13px;
          padding-top: 11px;
          border-top: 1px dashed #e0e4ea;
        }

        .ncsPosHeldActions button {
          min-height: 35px;
          padding: 0 13px;
          border-radius: 9px;
          font-family: inherit;
          font-size: 9px;
          font-weight: 850;
          cursor: pointer;
        }

        .ncsPosHeldActions button:first-child {
          border: 1px solid #e5bcbc;
          background: #fff4f4;
          color: #a53c3c;
        }

        .ncsPosHeldActions button:last-child {
          border: 1px solid ${GOLD};
          background: ${ROYAL_BLUE};
          color: #ffffff;
        }

        .ncsPosHeldEmpty {
          min-height: 280px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .ncsPosHeldEmpty > div {
          width: 62px;
          height: 62px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 20px;
          background: rgba(212, 175, 55, 0.16);
          font-size: 26px;
        }

        .ncsPosHeldEmpty h3 {
          margin: 13px 0 3px;
          color: ${DEEP_BLUE};
          font-size: 15px;
          font-weight: 950;
        }

        .ncsPosHeldEmpty p {
          margin: 0;
          color: #9298a4;
          font-size: 10px;
          font-weight: 650;
        }

        .ncsPosMobileCartButton,
        .ncsPosMobileOverlay {
          display: none;
        }

        @keyframes ncsPosQuickCardEnter {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes ncsPosQuickGlow {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.12);
            opacity: 1;
          }
        }

        @keyframes ncsPosBagPickup {
          0%,
          48% {
            opacity: 0;
            transform:
              translate(11px, 8px)
              rotate(-14deg)
              scale(0.45);
          }

          54% {
            opacity: 0.25;
            transform:
              translate(7px, 4px)
              rotate(-10deg)
              scale(0.72);
          }

          60% {
            opacity: 1;
            transform:
              translate(0, 0)
              rotate(-5deg)
              scale(1);
          }

          82% {
            opacity: 1;
            transform:
              translate(-1px, -1px)
              rotate(4deg)
              scale(1);
          }

          100% {
            opacity: 0;
            transform:
              translate(-8px, -3px)
              rotate(11deg)
              scale(0.88);
          }
        }

        @keyframes ncsPosBagSwing {
          0%,
          100% {
            margin-top: 0;
          }

          50% {
            margin-top: -2px;
          }
        }

        @keyframes ncsPosFamilyWalkAcross {
          0% {
            transform: translateX(-28px);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          42% {
            transform: translateX(54px);
            opacity: 1;
          }
          58% {
            transform: translateX(68px);
            opacity: 1;
          }
          88% {
            transform: translateX(132px);
            opacity: 1;
          }
          100% {
            transform: translateX(164px);
            opacity: 0;
          }
        }

        @keyframes ncsPosHumanBodyWalk {
          from {
            transform: translateY(0) rotate(-1deg);
          }
          to {
            transform: translateY(-3px) rotate(1.4deg);
          }
        }

        @keyframes ncsPosArmSwingLeft {
          from {
            transform: rotate(18deg);
          }
          to {
            transform: rotate(-17deg);
          }
        }

        @keyframes ncsPosArmSwingRight {
          from {
            transform: rotate(-17deg);
          }
          to {
            transform: rotate(18deg);
          }
        }

        @keyframes ncsPosLegWalkLeft {
          from {
            transform: rotate(14deg);
          }
          to {
            transform: rotate(-13deg);
          }
        }

        @keyframes ncsPosLegWalkRight {
          from {
            transform: rotate(-13deg);
          }
          to {
            transform: rotate(14deg);
          }
        }

        @keyframes ncsPosFamilyBagSwing {
          from {
            transform: rotate(-9deg) translateY(0);
          }
          to {
            transform: rotate(9deg) translateY(-2px);
          }
        }

        @keyframes ncsPosFamilyGlowPulse {
          0%,
          100% {
            transform: scale(0.72);
            opacity: 0.35;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
        }

        @keyframes ncsPosCustomerQueueWalk {
          0% {
            left: 230px;
            opacity: 0;
            transform: translateY(2px) scale(0.9);
          }

          8% {
            opacity: 1;
          }

          55% {
            left: 76px;
            opacity: 1;
            transform: translateY(0) scale(1);
          }

          68% {
            left: 58px;
            opacity: 1;
            transform: translateY(0) scale(1);
          }

          83% {
            left: 32px;
            opacity: 0.95;
            transform: translateY(-2px) scale(0.98);
          }

          100% {
            left: -36px;
            opacity: 0;
            transform: translateY(-3px) scale(0.9);
          }
        }

        @keyframes ncsPosCounterSuccess {
          0%,
          44%,
          100% {
            opacity: 0;
            transform: scale(0.45);
          }

          52%,
          68% {
            opacity: 1;
            transform: scale(1);
          }

          74% {
            opacity: 0;
            transform: scale(1.25);
          }
        }

        @keyframes ncsPosMoneyRise {
          0% {
            transform: translateY(0) rotate(-8deg);
            opacity: 0;
          }

          14% {
            opacity: 1;
          }

          72% {
            opacity: 0.45;
          }

          100% {
            transform: translateY(-155px) rotate(16deg);
            opacity: 0;
          }
        }

        @keyframes ncsPosCoinLift {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-4px);
          }
        }

        @keyframes ncsPosCreditRing {
          0% {
            opacity: 0.55;
            transform: scale(0.45);
          }

          100% {
            opacity: 0;
            transform: scale(1.65);
          }
        }

        @keyframes ncsPosSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes ncsPosNoticeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes ncsPosModalIn {
          from {
            opacity: 0;
            transform: translateY(12px)
              scale(0.97);
          }

          to {
            opacity: 1;
            transform: translateY(0)
              scale(1);
          }
        }

        @keyframes ncsPosShimmer {
          from {
            background-position: 200% 0;
          }

          to {
            background-position: -200% 0;
          }
        }

        @media (min-width: 1081px) and (max-height: 850px) {
          .ncsPosBillHeader {
            min-height: 66px;
            padding: 12px 16px;
          }

          .ncsPosCustomerCard {
            padding: 10px 14px;
          }

          .ncsPosCustomerTitle {
            margin-bottom: 7px;
          }

          .ncsPosCartItems {
            min-height: 105px;
            max-height: 205px;
            flex: 0 1 205px;
            padding: 9px 12px;
          }

          .ncsPosSummary {
            padding: 10px 14px;
          }

          .ncsPosPaymentSection {
            padding: 10px 14px 12px;
          }

          .ncsPosPaymentButton {
            min-height: 42px;
          }

          .ncsPosCompleteButton {
            min-height: 52px;
            margin-top: 8px;
          }
        }

        @media (max-width: 1280px) {
          .ncsPosWorkspace {
            grid-template-columns:
              minmax(0, 1fr)
              minmax(430px, 500px);
          }

          .ncsPosProductGrid {
            grid-template-columns: repeat(
              auto-fill,
              minmax(175px, 1fr)
            );
          }
        }


        .ncsPosSuccessOverlay {
          position: fixed;
          z-index: 10000;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(3, 21, 63, 0.74);
          backdrop-filter: blur(9px);
        }

        .ncsPosSuccessModal {
          width: min(470px, 100%);
          max-height: calc(100vh - 24px);
          padding: 27px;
          padding-bottom: 92px;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-width: thin;
          border: 1px solid rgba(212, 175, 55, 0.45);
          border-radius: 24px;
          background:
            radial-gradient(
              circle at 85% 0%,
              rgba(212, 175, 55, 0.16),
              transparent 30%
            ),
            #ffffff;
          text-align: center;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.32);
          animation: ncsPosSuccessEnter 0.25s ease-out;
          position: relative;
        }

        .ncsPosSuccessModal::-webkit-scrollbar {
          width: 6px;
        }

        .ncsPosSuccessModal::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(10, 46, 115, 0.20);
        }

        .ncsPosSuccessIcon {
          width: 68px;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 13px;
          border-radius: 50%;
          background: linear-gradient(135deg, #16894b, #27b56a);
          color: #ffffff;
          font-size: 34px;
          font-weight: 950;
          box-shadow: 0 14px 30px rgba(31, 157, 85, 0.25);
        }

        .ncsPosSuccessEyebrow {
          color: ${GOLD};
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 1.5px;
        }

        .ncsPosSuccessModal h2 {
          margin: 6px 0 5px;
          color: ${DEEP_BLUE};
          font-size: 26px;
          font-weight: 950;
        }

        .ncsPosSuccessCustomer {
          margin: 0;
          color: #737b89;
          font-size: 11px;
          font-weight: 650;
        }

        .ncsPosSuccessAmount {
          margin: 18px 0 13px;
          padding: 18px;
          border-radius: 17px;
          background: linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: #ffffff;
        }

        .ncsPosSuccessAmount small,
        .ncsPosSuccessAmount strong,
        .ncsPosSuccessAmount span {
          display: block;
        }

        .ncsPosSuccessAmount small {
          color: rgba(255, 255, 255, 0.65);
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .ncsPosSuccessAmount strong {
          margin-top: 4px;
          color: ${GOLD};
          font-size: 30px;
          font-weight: 950;
        }

        .ncsPosSuccessAmount span {
          margin-top: 5px;
          color: #ffd3d3;
          font-size: 11px;
          font-weight: 850;
        }

        .ncsPosSuccessSummary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 15px;
        }

        .ncsPosSuccessSummary p {
          margin: 0;
          padding: 11px;
          border-radius: 12px;
          background: #f5f7fb;
          text-align: left;
        }

        .ncsPosSuccessSummary span,
        .ncsPosSuccessSummary strong {
          display: block;
        }

        .ncsPosSuccessSummary span {
          color: #89909d;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .ncsPosSuccessSummary strong {
          margin-top: 3px;
          color: ${DEEP_BLUE};
          font-size: 12px;
          font-weight: 900;
        }

        .ncsPosSuccessActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
        }

        .ncsPosSuccessActions button {
          min-height: 46px;
          border: 0;
          border-radius: 12px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsPosSuccessActions button:disabled {
          cursor: not-allowed;
          opacity: .46;
          filter: grayscale(.25);
          box-shadow: none !important;
          transform: none !important;
        }

        .ncsPosSuccessWhatsApp {
          grid-column: 1 / -1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #1f9d55;
          color: #ffffff;
        }

        .ncsPosSuccessWhatsApp span {
          font-size: 17px;
        }

        .ncsPosSuccessPdf,
        .ncsPosSuccessTextWhatsApp,
        .ncsPosSuccessPrint,
        .ncsPosSuccessPrintA4 {
          background: ${ROYAL_BLUE};
          color: #ffffff;
        }

        .ncsPosSuccessStudio {
          min-height: 44px;
          border: 1px solid rgba(212, 175, 55, 0.64);
          border-radius: 13px;
          background:
            linear-gradient(
              135deg,
              rgba(3, 21, 63, 0.98),
              rgba(10, 46, 115, 0.96)
            );
          color: #f4d85b;
          font-weight: 900;
          letter-spacing: 0.04em;
          cursor: pointer;
          box-shadow:
            0 10px 24px rgba(3, 21, 63, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.10);
        }

        .ncsPosSuccessStudio:hover {
          transform: translateY(-1px);
          box-shadow:
            0 14px 30px rgba(3, 21, 63, 0.22),
            0 0 0 2px rgba(212, 175, 55, 0.08);
        }


        .ncsPosSuccessPdf {
          background: ${GOLD};
          color: ${DEEP_BLUE};
        }

        .ncsPosSuccessTextWhatsApp {
          background: #ffffff;
          color: ${ROYAL_BLUE};
          border: 1px solid rgba(10, 46, 115, 0.22);
        }

        .ncsPosSuccessPrintA4 {
          background: ${GOLD};
          color: ${DEEP_BLUE};
        }

        .ncsPosSuccessNewBill {
          grid-column: 1 / -1;
          min-height: 52px !important;
          border: 1px solid rgba(212, 175, 55, 0.72) !important;
          background:
            linear-gradient(
              135deg,
              ${DEEP_BLUE},
              ${ROYAL_BLUE}
            );
          color: #ffffff;
          font-size: 12px !important;
          letter-spacing: 0.04em;
          box-shadow:
            0 14px 30px rgba(3, 21, 63, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.10);
          position: sticky;
          bottom: -74px;
          z-index: 5;
        }

        .ncsPosSuccessNewBill::before {
          content: "＋";
          margin-right: 7px;
          color: ${GOLD};
          font-size: 16px;
          font-weight: 950;
        }

        .ncsPosSuccessNewBill:hover {
          transform: translateY(-1px);
          box-shadow:
            0 18px 34px rgba(3, 21, 63, 0.24),
            0 0 0 2px rgba(212, 175, 55, 0.08);
        }

        .ncsPosSuccessHint {
          display: block;
          margin-top: 12px;
          color: #9298a4;
          font-size: 8px;
          line-height: 1.55;
        }

        @media (max-height: 820px) {
          .ncsPosSuccessOverlay {
            align-items: flex-start;
            padding: 8px 14px;
          }

          .ncsPosSuccessModal {
            max-height: calc(100vh - 16px);
            padding: 18px 20px 82px;
            border-radius: 20px;
          }

          .ncsPosSuccessIcon {
            width: 48px;
            height: 48px;
            margin-bottom: 8px;
            font-size: 24px;
          }

          .ncsPosSuccessModal h2 {
            font-size: 21px;
          }

          .ncsPosSuccessAmount {
            margin: 12px 0 10px;
            padding: 13px;
          }

          .ncsPosSuccessAmount strong {
            font-size: 25px;
          }

          .ncsPosSuccessSummary {
            gap: 6px;
            margin-bottom: 10px;
          }

          .ncsPosSuccessSummary p {
            padding: 8px 9px;
          }

          .ncsPosSuccessActions {
            gap: 7px;
          }

          .ncsPosSuccessActions button {
            min-height: 42px;
          }

          .ncsPosSuccessHint {
            margin-top: 8px;
          }
        }

        @keyframes ncsPosSuccessEnter {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 760px) {
          .ncsPosCartItemTop {
            grid-template-columns: 44px minmax(0, 1fr) 27px;
            align-items: start;
          }

          .ncsPosCartThumbnail {
            width: 44px;
            height: 50px;
          }

          .ncsPosQuantityControl,
          .ncsPosItemDiscountField,
          .ncsPosItemLineTotal {
            margin-top: 4px;
          }

          .ncsPosQuantityControl {
            grid-column: 1 / 2;
          }

          .ncsPosItemDiscountField {
            grid-column: 2 / 3;
          }

          .ncsPosItemLineTotal {
            grid-column: 2 / 4;
            text-align: right;
          }

          .ncsPosRemoveItem {
            grid-column: 3 / 4;
            grid-row: 1;
          }
        }

        @media (max-width: 1080px) {
          .ncsPosPage {
            padding: 20px;
          }

          .ncsPosWorkspace {
            grid-template-columns: 1fr;
          }

          .ncsPosBillPanel {
            position: fixed;
            z-index: 430;
            top: 0;
            right: 0;
            bottom: 0;
            width: min(430px, 94vw);
            max-height: none;
            border-radius: 22px 0 0 22px;
            transform: translateX(105%);
            transition: transform 0.25s ease;
          }

          .ncsPosBillPanelOpen {
            transform: translateX(0);
          }

          .ncsPosCloseMobileCart {
            display: block !important;
          }

          .ncsPosMobileCartButton {
            position: fixed;
            z-index: 300;
            right: 18px;
            bottom: 18px;
            left: calc(270px + 18px);
            min-height: 65px;
            display: flex;
            align-items: center;
            gap: 13px;
            padding: 8px 15px;
            border: 1px solid ${GOLD};
            border-radius: 17px;
            background: linear-gradient(
              135deg,
              ${DEEP_BLUE},
              ${ROYAL_BLUE}
            );
            color: #ffffff;
            font-family: inherit;
            cursor: pointer;
            box-shadow: 0 18px 44px
              rgba(3, 21, 63, 0.32);
          }

          .ncsPosMobileCartButton > span {
            position: relative;
            width: 41px;
            height: 41px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            background: ${GOLD};
            font-size: 19px;
          }

          .ncsPosMobileCartButton > span b {
            position: absolute;
            top: -6px;
            right: -6px;
            min-width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid ${ROYAL_BLUE};
            border-radius: 20px;
            background: #ffffff;
            color: ${ROYAL_BLUE};
            font-size: 8px;
          }

          .ncsPosMobileCartButton > div {
            min-width: 0;
            flex: 1;
            text-align: left;
          }

          .ncsPosMobileCartButton small,
          .ncsPosMobileCartButton strong {
            display: block;
          }

          .ncsPosMobileCartButton small {
            color: rgba(255, 255, 255, 0.65);
            font-size: 8px;
            font-weight: 700;
          }

          .ncsPosMobileCartButton strong {
            margin-top: 2px;
            color: ${GOLD};
            font-size: 15px;
            font-weight: 950;
          }

          .ncsPosMobileCartButton i {
            font-size: 10px;
            font-style: normal;
            font-weight: 850;
          }

          .ncsPosMobileOverlay {
            position: fixed;
            z-index: 420;
            inset: 0;
            display: block;
            border: 0;
            background: rgba(3, 21, 63, 0.65);
          }
        }

        @media (max-width: 980px) {
          .ncsPosQuickStats {
            grid-template-columns: 1fr;
          }

          .ncsPosQuickCard {
            min-height: 100px;
          }
        }

        @media (max-width: 620px) {
          .ncsPosQuickCard {
            grid-template-columns: 44px minmax(0, 1fr);
            padding: 14px;
          }

          .ncsPosQuickIcon {
            width: 42px;
            height: 42px;
          }

          .ncsPosQuickMini,
          .ncsPosQuickCreditBadge {
            grid-column: 1 / -1;
            min-width: 0;
          }

          .ncsPosQuickMini {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ncsPosProductGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .ncsPosProductImage {
            height: 102px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ncsPosFamilyGroup,
          .ncsPosHuman,
          .ncsPosHumanArm,
          .ncsPosHumanLeg,
          .ncsPosFamilyBag,
          .ncsPosFamilyGlow {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
          }

          .ncsPosFamilyGroup {
            transform: translateX(70px);
            opacity: 1;
          }
        }

        @media (max-width: 1250px) {
          .ncsPosCustomerQueue {
            right: 245px;
            width: 420px;
            height: 142px;
          }
        }

        @media (max-width: 1080px) {
          .ncsPosCustomerQueue {
            right: 220px;
            width: 340px;
            height: 130px;
          }
        }

        @media (max-width: 900px) {
          .ncsPosCustomerQueue {
            display: none;
          }

          .ncsPosMobileCartButton {
            left: 18px;
          }

          .ncsPosPage {
            padding: 16px;
            padding-bottom: 100px;
          }

          .ncsPosHeader {
            align-items: flex-start;
            padding: 20px;
          }
        }

        @media (max-width: 700px) {
          .ncsPosHeader {
            display: block;
          }

          .ncsPosHeaderActions {
            margin-top: 15px;
          }

          .ncsPosSecondaryButton,
          .ncsPosRefreshButton {
            flex: 1;
          }

          .ncsPosSearchPanel {
            min-height: 56px;
          }

          .ncsPosSearchIcon {
            width: 39px;
          }

          .ncsPosSearchPanel input {
            height: 42px;
            font-size: 12px;
          }

          .ncsPosSearchButton {
            min-width: 72px;
            height: 42px;
          }

          .ncsPosProductGrid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
            gap: 10px;
          }

          .ncsPosProductImage {
            height: 145px;
          }

          .ncsPosProductInfo {
            padding: 11px;
          }

          .ncsPosProductInfo h3 {
            font-size: 12px;
          }

          .ncsPosBrandLine {
            font-size: 10px;
          }

          .ncsPosVariantChips span {
            min-height: 30px;
            padding: 7px 11px;
            font-size: 11px;
          }

          .ncsPosVariantChips .ncsPosSizeChip {
            font-size: 12px;
          }

          .ncsPosCatalogueTop {
            align-items: flex-end;
          }

          .ncsPosStatusBadge {
            font-size: 8px;
          }
        }

        @media (max-width: 440px) {
          .ncsPosPage {
            padding: 12px;
            padding-bottom: 94px;
          }

          .ncsPosHeader {
            border-radius: 17px;
          }

          .ncsPosHeaderActions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .ncsPosSearchButton {
            display: none;
          }

          .ncsPosProductImage {
            height: 128px;
          }

          .ncsPosStockBadge {
            top: 7px;
            right: 7px;
            padding: 5px 7px;
            font-size: 7px;
          }

          .ncsPosProductBottom strong {
            font-size: 13px;
          }

          .ncsPosAddIcon {
            width: 30px;
            height: 30px;
          }

          .ncsPosCustomerFields {
            grid-template-columns: 1fr;
          }

          .ncsPosPaymentGrid {
            gap: 5px;
          }
        }
        @media (max-width: 520px) {
          .ncsPosCreditFields,
          .ncsPosCreditSummary {
            grid-template-columns: 1fr;
          }
        }

        .ncsPosSearchQuickItemButton {
          min-width: 132px;
          flex-shrink: 0;
          margin-left: 2px;
        }

        .ncsPosQuickItemButton {
          position: relative;
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          overflow: hidden;
          padding: 0 18px;
          border: 1px solid #f0d46f;
          border-radius: 13px;
          background: linear-gradient(135deg, #d4af37, #b68d19);
          color: #03153f;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 11px 25px rgba(212, 175, 55, 0.27);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .ncsPosQuickItemButton::after {
          content: "";
          position: absolute;
          top: -150%;
          left: -38%;
          width: 32%;
          height: 420%;
          transform: rotate(22deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.58),
            transparent
          );
          animation: ncsQuickButtonShine 4s ease-in-out infinite;
        }

        .ncsPosQuickItemButton:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 32px rgba(212, 175, 55, 0.36);
        }

        .ncsPosCartBrandName {
          display: block;
          max-width: 100%;
          margin-top: 2px;
          overflow: hidden;
          color: #b8890b;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .55px;
          line-height: 1.15;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .ncsPosQuickItemBadge {
          display: inline-flex;
          align-items: center;
          margin-left: 7px;
          padding: 3px 7px;
          border: 1px solid rgba(212, 175, 55, 0.65);
          border-radius: 999px;
          background: #fff8df;
          color: #8a6500;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.5px;
          vertical-align: middle;
        }

        .ncsPosModalOverlay:has(.ncsPosQuickItemModal) {
          background:
            radial-gradient(
              circle at 50% 18%,
              rgba(212, 175, 55, .16),
              transparent 30%
            ),
            rgba(3, 21, 63, .76);
          backdrop-filter: blur(11px) saturate(1.08);
        }

        .ncsPosQuickItemModal {
          isolation: isolate;
        }

        .ncsPosQuickItemModal {
          width: min(650px, calc(100vw - 28px));
          max-height: min(760px, calc(100vh - 24px));
          overflow-y: auto;
          border: 1px solid rgba(212, 175, 55, 0.48);
          border-radius: 24px;
          background: #ffffff;
          box-shadow: 0 32px 90px rgba(3, 21, 63, 0.34);
          animation: ncsQuickModalIn 0.24s ease both;
        }

        .ncsPosQuickItemModal > header {
          position: relative;
          display: flex;
          justify-content: space-between;
          gap: 18px;
          overflow: hidden;
          padding: 18px 20px;
          border-bottom: 1px solid rgba(212, 175, 55, 0.3);
          background:
            radial-gradient(
              circle at 92% 0%,
              rgba(212, 175, 55, 0.28),
              transparent 34%
            ),
            linear-gradient(135deg, #03153f, #0a2e73);
          color: #ffffff;
        }

        .ncsPosQuickItemModal > header::after {
          content: "QUICK";
          position: absolute;
          right: 62px;
          bottom: -16px;
          color: rgba(212, 175, 55, 0.09);
          font-size: 70px;
          font-weight: 950;
          letter-spacing: 4px;
          pointer-events: none;
        }

        .ncsPosQuickItemModal > header span {
          color: #d4af37;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 1.3px;
        }

        .ncsPosQuickItemModal > header h2 {
          position: relative;
          z-index: 1;
          margin: 5px 0 0;
          font-size: 23px;
        }

        .ncsPosQuickItemModal > header p {
          position: relative;
          z-index: 1;
          max-width: 490px;
          margin: 7px 0 0;
          color: rgba(255, 255, 255, 0.72);
          font-size: 12px;
          line-height: 1.55;
        }

        .ncsPosQuickItemModal > header > button {
          position: relative;
          z-index: 2;
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.09);
          color: #ffffff;
          font-size: 24px;
          cursor: pointer;
        }

        .ncsPosQuickItemModal form {
          padding: 22px;
        }

        .ncsPosQuickItemGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .ncsPosQuickItemGrid label,
        .ncsPosQuickRemaining {
          display: grid;
          gap: 7px;
        }

        .ncsPosQuickItemGrid label > span,
        .ncsPosQuickRemaining > span {
          color: #0a2e73;
          font-size: 12px;
          font-weight: 850;
        }

        .ncsPosQuickItemGrid input,
        .ncsPosQuickItemGrid select,
        .ncsPosQuickRemaining input {
          width: 100%;
          min-height: 45px;
          padding: 0 13px;
          border: 1px solid #d6dbe5;
          border-radius: 11px;
          outline: none;
          background: #ffffff;
          color: #172033;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            transform 0.2s ease;
        }

        .ncsPosQuickItemGrid input:focus,
        .ncsPosQuickItemGrid select:focus,
        .ncsPosQuickRemaining input:focus {
          border-color: #d4af37;
          box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.14);
          transform: translateY(-1px);
        }

        .ncsPosQuickWide {
          grid-column: 1 / -1;
        }

        .ncsPosQuickSaveToggle {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-top: 18px;
          padding: 15px;
          border: 1px solid rgba(212, 175, 55, 0.35);
          border-radius: 13px;
          background: #fffdf6;
          cursor: pointer;
        }

        .ncsPosQuickSaveToggle input {
          width: 19px;
          height: 19px;
          margin-top: 2px;
          accent-color: #0a2e73;
        }

        .ncsPosQuickSaveToggle span {
          display: grid;
          gap: 4px;
        }

        .ncsPosQuickSaveToggle strong {
          color: #0a2e73;
          font-size: 13px;
        }

        .ncsPosQuickSaveToggle small,
        .ncsPosQuickRemaining small {
          color: #737b89;
          font-size: 10px;
          line-height: 1.45;
        }

        .ncsPosQuickRemaining {
          margin-top: 14px;
          padding: 15px;
          border: 1px solid #dce3ef;
          border-radius: 13px;
          background: #f8fafc;
        }

        .ncsPosQuickInfo {
          margin-top: 16px;
          padding: 13px 14px;
          border-left: 4px solid #d4af37;
          border-radius: 10px;
          background: #f4f7ff;
          color: #4d586b;
          font-size: 11px;
          line-height: 1.55;
        }

        .ncsPosQuickInfo b {
          color: #0a2e73;
        }

        .ncsPosQuickItemModal footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }

        .ncsPosQuickCancel,
        .ncsPosQuickAdd {
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 20px;
          border-radius: 11px;
          font-weight: 850;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .ncsPosQuickCancel {
          border: 1px solid #d6dbe5;
          background: #ffffff;
          color: #586174;
        }

        .ncsPosQuickAdd {
          border: 1px solid rgba(212, 175, 55, 0.48);
          background: linear-gradient(135deg, #0a2e73, #03153f);
          color: #ffffff;
          box-shadow: 0 10px 22px rgba(3, 21, 63, 0.2);
        }

        .ncsPosQuickCancel:hover,
        .ncsPosQuickAdd:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(3, 21, 63, 0.16);
        }

        @keyframes ncsQuickButtonShine {
          0%,
          66% {
            left: -38%;
            opacity: 0;
          }
          75% {
            opacity: 0.9;
          }
          100% {
            left: 125%;
            opacity: 0;
          }
        }

        @keyframes ncsQuickModalIn {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* PREMIUM BILL VISIBILITY + LIVE OFFER STRIP */
        .ncsPosBillPanel {
          max-height: none;
          overflow: visible;
        }

        .ncsPosCartItems {
          flex: 0 1 auto;
          min-height: 92px;
          max-height: 270px;
          overflow-y: auto;
        }

        .ncsPosSummary {
          max-height: none;
          overflow: visible;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px 10px;
          padding: 14px;
          background:
            radial-gradient(circle at 92% 0%, rgba(212,175,55,.13), transparent 34%),
            linear-gradient(180deg, #ffffff, #f8faff);
        }

        .ncsPosSummaryLine {
          min-height: 48px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          gap: 4px;
          padding: 8px 10px;
          border: 1px solid rgba(10,46,115,.10);
          border-radius: 11px;
          background: #ffffff;
          box-shadow: 0 5px 14px rgba(3,21,63,.035);
        }

        .ncsPosSummaryLine span {
          color: #69758a;
          font-size: 8px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .ncsPosSummaryLine strong {
          color: #03153f;
          font-size: 12px;
          font-weight: 950;
        }

        .ncsPosDiscountField,
        .ncsPosRoundOffField {
          grid-column: span 2;
          min-height: 48px;
          margin: 0;
          padding: 7px 10px;
          border: 1px solid rgba(10,46,115,.10);
          border-radius: 11px;
          background: #fff;
        }

        .ncsPosTotalLine {
          grid-column: 1 / -1;
          min-height: 76px;
          margin: 2px 0 0;
          padding: 12px 16px;
          border: 1px solid rgba(212,175,55,.65);
          border-radius: 15px;
          background:
            radial-gradient(circle at 90% 10%, rgba(255,255,255,.18), transparent 30%),
            linear-gradient(135deg, #061b4f, #0a2e73 68%, #234f91);
          box-shadow: 0 12px 28px rgba(3,21,63,.17);
        }

        .ncsPosTotalLine span {
          color: #f4d65c;
          font-size: 13px;
        }

        .ncsPosTotalLine small {
          color: rgba(255,255,255,.70);
          font-size: 8px;
        }

        .ncsPosTotalLine > strong {
          color: #ffffff;
          font-size: 27px;
          text-shadow: 0 2px 12px rgba(0,0,0,.18);
        }

        .ncsPosQuantityTableCell > div {
          grid-template-columns: 38px minmax(42px, 1fr) 38px;
          height: 38px;
          border-color: rgba(10,46,115,.20);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.7);
        }

        .ncsPosQuantityTableCell button {
          width: 38px;
          height: 38px;
          font-size: 20px;
          line-height: 1;
        }

        .ncsPosQuantityTableCell button:first-child {
          background: linear-gradient(180deg, #eef3fb, #dfe8f7);
          color: #0a2e73;
          border-right: 1px solid rgba(10,46,115,.12);
        }

        .ncsPosQuantityTableCell button:last-child {
          background: linear-gradient(180deg, #f7d95c, #d4af37);
          color: #03153f;
          border-left: 1px solid rgba(10,46,115,.12);
        }

        .ncsPosQuantityTableCell input {
          height: 38px;
          font-size: 13px;
          background: #fff;
        }

        .ncsPosMarketingConsent {
          position: relative;
          display: grid;
          grid-template-columns: 22px minmax(205px, .85fr) minmax(280px, 1.4fr);
          align-items: center;
          gap: 10px;
          overflow: hidden;
          padding: 10px 12px;
          border-color: rgba(212,175,55,.48);
          background:
            linear-gradient(100deg, #f3fff7 0%, #ffffff 42%, #fff8dc 100%);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.8);
        }

        .ncsPosMarketingConsent input {
          width: 17px;
          height: 17px;
          margin: 0;
        }

        .ncsPosMarketingConsentCopy strong,
        .ncsPosMarketingConsentCopy small {
          display: block;
        }

        .ncsPosMarketingConsentCopy strong {
          color: #12683b;
          font-size: 9px;
          font-weight: 950;
        }

        .ncsPosOfferTicker {
          min-width: 0;
          overflow: hidden;
          border-left: 1px solid rgba(212,175,55,.35);
          border-radius: 9px;
          background: rgba(255,255,255,.72);
        }

        .ncsPosOfferTickerTrack {
          width: max-content;
          display: flex;
          align-items: center;
          gap: 22px;
          padding: 8px 0;
          animation: ncsPosOfferTickerMove 19s linear infinite;
        }

        .ncsPosOfferTickerTrack b {
          color: #7a5a00;
          font-size: 9px;
          font-weight: 950;
          white-space: nowrap;
        }

        .ncsPosMarketingConsent:hover .ncsPosOfferTickerTrack {
          animation-play-state: paused;
        }

        @keyframes ncsPosOfferTickerMove {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        @media (max-width: 1450px) {
          .ncsPosSummary {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .ncsPosDiscountField,
          .ncsPosRoundOffField {
            grid-column: span 1;
          }

          .ncsPosMarketingConsent {
            grid-template-columns: 22px minmax(190px, .8fr) minmax(220px, 1.2fr);
          }
        }

        .ncsPosNextCustomerButton {
          min-height: 48px;
          border: 1px solid rgba(212, 175, 55, 0.66);
          border-radius: 14px;
          padding: 0 16px;
          background:
            linear-gradient(135deg, #03153f, #0a2e73 58%, #1c5ab4);
          color: #fff;
          font-weight: 900;
          box-shadow:
            0 12px 30px rgba(3, 21, 63, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.11);
          cursor: pointer;
        }

        .ncsPosNextCustomerButton span {
          color: #f4d85b;
          margin-right: 6px;
          font-weight: 950;
        }

        .ncsPosNextCustomerButton:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }

        .ncsPosBillNextCustomer {
          border-color: rgba(212, 175, 55, 0.78) !important;
          background:
            linear-gradient(
              145deg,
              rgba(212, 175, 55, 0.10),
              rgba(10, 46, 115, 0.18)
            ) !important;
          color: #f4d85b !important;
        }

        .ncsPosOwnerCostButton {
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          border: 1px solid rgba(212, 175, 55, 0.62);
          border-radius: 10px;
          background:
            linear-gradient(
              145deg,
              rgba(10, 46, 115, 0.08),
              rgba(212, 175, 55, 0.16)
            );
          color: #0a2e73;
          font-size: 14px;
          font-weight: 950;
          cursor: pointer;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .ncsPosOwnerCostButton:hover {
          background:
            linear-gradient(145deg, #03153f, #0a2e73);
          color: #f4d85b;
          box-shadow:
            0 8px 20px rgba(10, 46, 115, 0.20);
        }

        .ncsOwnerCostModal {
          width: min(520px, calc(100vw - 30px));
          border: 1px solid rgba(212, 175, 55, 0.58);
          border-radius: 24px;
          background:
            linear-gradient(180deg, #ffffff, #fbf8f1);
          box-shadow:
            0 30px 90px rgba(3, 21, 63, 0.34);
          overflow: hidden;
        }

        .ncsOwnerCostModal > header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          background:
            linear-gradient(135deg, #03153f, #0a2e73, #1c5ab4);
          color: #fff;
        }

        .ncsOwnerCostModal > header span {
          display: block;
          color: #f4d85b;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .ncsOwnerCostModal > header h2 {
          margin: 3px 0 0;
          font-size: 22px;
        }

        .ncsOwnerCostModal > header button {
          width: 36px;
          height: 36px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          font-size: 24px;
          cursor: pointer;
        }

        .ncsOwnerCostProduct {
          padding: 17px 20px 10px;
        }

        .ncsOwnerCostProduct strong {
          display: block;
          color: #0a2e73;
          font-size: 17px;
        }

        .ncsOwnerCostProduct span {
          display: block;
          margin-top: 4px;
          color: #6f7782;
          font-size: 12px;
        }

        .ncsOwnerCostGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          padding: 8px 20px 14px;
        }

        .ncsOwnerCostGrid article {
          min-height: 82px;
          padding: 13px;
          border: 1px solid rgba(10, 46, 115, 0.10);
          border-radius: 16px;
          background: #fff;
        }

        .ncsOwnerCostGrid span {
          display: block;
          color: #7a808a;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .ncsOwnerCostGrid strong {
          display: block;
          margin-top: 7px;
          color: #172033;
          font-size: 14px;
          line-height: 1.35;
          word-break: break-word;
        }

        .ncsOwnerSupplierPhone,
        .ncsOwnerCostNote {
          margin: 0 20px 12px;
          padding: 11px 13px;
          border-radius: 13px;
          background: rgba(10, 46, 115, 0.055);
          color: #495260;
          font-size: 11px;
          line-height: 1.45;
        }

        .ncsOwnerCostNote {
          background: rgba(212, 175, 55, 0.11);
          color: #5a4b16;
        }

        .ncsOwnerCostClose {
          width: calc(100% - 40px);
          min-height: 44px;
          margin: 0 20px 20px;
          border: 0;
          border-radius: 14px;
          background:
            linear-gradient(135deg, #03153f, #0a2e73);
          color: #fff;
          font-weight: 900;
          cursor: pointer;
        }

        @media (max-width: 820px) {
          .ncsPosSearchPanel {
            flex-wrap: wrap;
            padding: 8px;
          }

          .ncsPosSearchPanel input {
            min-width: 0;
            flex: 1 1 220px;
          }

          .ncsPosSearchQuickItemButton {
            min-width: 118px;
          }
        }

        @media (max-width: 560px) {
          .ncsPosSearchQuickItemButton {
            width: 100%;
            min-width: 0;
            margin: 2px 0 0;
          }
        }

        @media (max-width: 700px) {
          .ncsPosQuickItemGrid {
            grid-template-columns: 1fr;
          }

          .ncsPosQuickWide {
            grid-column: auto;
          }

          .ncsPosQuickItemModal form {
            padding: 17px;
          }
        }

        @media (max-width: 520px) {
          .ncsPosQuickItemModal > header {
            padding: 19px;
          }

          .ncsPosQuickItemModal > header::after {
            font-size: 48px;
          }

          .ncsPosQuickItemModal footer {
            display: grid;
            grid-template-columns: 1fr;
          }

          .ncsPosQuickCancel,
          .ncsPosQuickAdd {
            width: 100%;
          }
        }

        .ncsPosFinderToolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin: 0 0 16px;
          padding: 10px;
          border: 1px solid rgba(10, 46, 115, 0.12);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.84);
          box-shadow: 0 10px 26px rgba(3, 21, 63, 0.06);
        }

        .ncsPosFinderToolbar button {
          min-height: 38px;
          padding: 0 14px;
          border: 1px solid rgba(10, 46, 115, 0.14);
          border-radius: 13px;
          background: #fff;
          color: #0a2e73;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsPosFinderToolbar button.active {
          border-color: #d4af37;
          background: linear-gradient(135deg, #03153f, #0a2e73);
          color: #fff;
          box-shadow: 0 8px 18px rgba(10, 46, 115, 0.22);
        }

        .ncsPosFinderToolbar > span {
          margin-left: auto;
          color: #707887;
          font-size: 11px;
        }

        .ncsPosFinderToolbar > span strong {
          color: #0a2e73;
        }

        .ncsPosSmartFinder,
        .ncsPosBrandAccordionList {
          display: grid;
          gap: 14px;
        }

        .ncsPosSmartSection {
          padding: 14px;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.78);
          box-shadow: 0 12px 28px rgba(3, 21, 63, 0.06);
        }

        .ncsPosSmartSection > header {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .ncsPosSmartSection > header span {
          color: #d4af37;
          font-size: 9px;
          font-weight: 1000;
          letter-spacing: 1px;
        }

        .ncsPosSmartSection > header h3 {
          margin: 2px 0 0;
          color: #03153f;
          font-size: 18px;
        }

        .ncsPosSmartSection > header small {
          color: #707887;
          font-weight: 800;
        }

        .ncsPosCompactRail {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: minmax(190px, 0.75fr);
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: thin;
        }

        .ncsPosCompactProduct {
          min-height: 98px;
          padding: 14px;
          border: 1px solid rgba(212, 175, 55, 0.45);
          border-radius: 17px;
          background: linear-gradient(135deg, #03153f, #0a2e73);
          color: #fff;
          text-align: left;
          cursor: pointer;
          box-shadow: 0 9px 20px rgba(3, 21, 63, 0.18);
        }

        .ncsPosCompactProduct strong,
        .ncsPosCompactProduct span,
        .ncsPosCompactProduct small {
          display: block;
        }

        .ncsPosCompactProduct span {
          margin-top: 5px;
          color: #f2d675;
          font-size: 10px;
          font-weight: 900;
        }

        .ncsPosCompactProduct small {
          margin-top: 12px;
          color: rgba(255,255,255,.72);
        }

        .ncsPosPopularProduct {
          background: linear-gradient(135deg, #6f4d00, #d4af37);
          color: #03153f;
        }

        .ncsPosPopularProduct span,
        .ncsPosPopularProduct small {
          color: rgba(3,21,63,.78);
        }

        .ncsPosBrandGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 10px;
        }

        .ncsPosBrandSummary,
        .ncsPosBrandAccordionHeader {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px;
          border: 1px solid rgba(10, 46, 115, 0.12);
          border-radius: 17px;
          background: linear-gradient(135deg, #fff, #f8f4ec);
          color: #03153f;
          text-align: left;
          cursor: pointer;
        }

        .ncsPosBrandMark {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 14px;
          background: linear-gradient(135deg, #03153f, #0a2e73);
          color: #d4af37;
          font-weight: 1000;
        }

        .ncsPosBrandSummary > div,
        .ncsPosBrandAccordionHeader > div {
          flex: 1;
          min-width: 0;
        }

        .ncsPosBrandSummary strong,
        .ncsPosBrandSummary small,
        .ncsPosBrandAccordionHeader strong,
        .ncsPosBrandAccordionHeader small {
          display: block;
        }

        .ncsPosBrandSummary small,
        .ncsPosBrandAccordionHeader small {
          margin-top: 3px;
          color: #737b89;
          font-size: 10px;
        }

        .ncsPosBrandSummary b,
        .ncsPosBrandAccordionHeader b {
          color: #d4af37;
          font-size: 25px;
        }

        .ncsPosBrandCompactGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 8px;
        }

        .ncsPosBrandCompactCard {
          min-height: 70px;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) auto;
          align-items: center;
          gap: 9px;
          padding: 9px 10px;
          border: 1px solid rgba(10, 46, 115, 0.12);
          border-radius: 14px;
          background: linear-gradient(145deg, #ffffff, #f8f4ec);
          color: #03153f;
          text-align: left;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(3, 21, 63, 0.05);
          transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
        }

        .ncsPosBrandCompactCard:hover {
          transform: translateY(-1px);
          border-color: rgba(212, 175, 55, 0.72);
          box-shadow: 0 9px 20px rgba(3, 21, 63, 0.1);
        }

        .ncsPosBrandCompactMark {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: linear-gradient(135deg, #03153f, #0a2e73);
          color: #d4af37;
          font-size: 10px;
          font-weight: 1000;
          letter-spacing: .4px;
        }

        .ncsPosBrandCompactCard > div {
          min-width: 0;
        }

        .ncsPosBrandCompactCard strong,
        .ncsPosBrandCompactCard small {
          display: block;
        }

        .ncsPosBrandCompactCard strong {
          overflow: hidden;
          color: #0a2e73;
          font-size: 12px;
          font-weight: 950;
          line-height: 1.15;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsPosBrandCompactCard small {
          margin-top: 4px;
          overflow: hidden;
          color: #717988;
          font-size: 8.5px;
          font-weight: 750;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsPosBrandCompactCard b {
          color: #d4af37;
          font-size: 18px;
        }

        body:has(.ncsPosBrandModalBackdrop),
        body:has(.ncsPosModalOverlay) {
          overflow: hidden;
        }

        .ncsPosBrandModalBackdrop {
          position: fixed;
          inset: 0;
          z-index: 18000;
          display: grid;
          place-items: center;
          padding: 22px;
          background: rgba(2, 12, 35, 0.58);
          backdrop-filter: blur(8px);
        }

        .ncsPosBrandModal {
          width: min(980px, 94vw);
          max-height: min(760px, 88vh);
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.58);
          border-radius: 24px;
          background: #f8f4ec;
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.34);
        }

        .ncsPosBrandModalHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(212, 175, 55, 0.28);
          background: linear-gradient(135deg, #03153f, #0a2e73);
          color: #fff;
        }

        .ncsPosBrandModalTitle {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .ncsPosBrandModalTitle .ncsPosBrandCompactMark {
          width: 42px;
          height: 42px;
          flex: 0 0 auto;
          border: 1px solid rgba(212, 175, 55, .55);
          background: rgba(255,255,255,.08);
          font-size: 12px;
        }

        .ncsPosBrandModalTitle small {
          display: block;
          color: #f0d56d;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .ncsPosBrandModalTitle h3 {
          margin: 2px 0 0;
          font-size: 20px;
          line-height: 1.1;
        }

        .ncsPosBrandModalTitle p {
          margin: 3px 0 0;
          color: rgba(255,255,255,.68);
          font-size: 9px;
          font-weight: 750;
        }

        .ncsPosBrandModalClose {
          width: 40px;
          height: 40px;
          flex: 0 0 auto;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 12px;
          background: rgba(255,255,255,.08);
          color: #fff;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
        }

        .ncsPosBrandModalBody {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          align-content: start;
          align-items: start;
          grid-auto-rows: max-content;
          gap: 10px;
          overflow-y: auto;
          padding: 12px;
          scrollbar-width: thin;
        }

        .ncsPosBrandModalBody .ncsPosGroupedCard.open {
          grid-column: 1 / -1;
          align-self: start;
          height: auto;
          min-height: max-content;
          overflow: visible;
          position: relative;
          z-index: 3;
        }

        .ncsPosBrandModalBody .ncsPosGroupedCard.open .ncsPosVariantPanel {
          display: block;
          height: auto;
          min-height: 92px;
          overflow: visible;
        }

        .ncsPosBrandModalBody .ncsPosGroupedCard.open .ncsPosVariantList {
          display: grid !important;
          min-height: 54px;
          height: auto !important;
          overflow: visible !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        .ncsPosBrandModalFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          border-top: 1px solid rgba(10, 46, 115, 0.1);
          background: #fff;
        }

        .ncsPosBrandModalFooter span {
          color: #6b7280;
          font-size: 9px;
          font-weight: 700;
        }

        .ncsPosBrandModalFooter button {
          min-height: 36px;
          padding: 0 14px;
          border: 0;
          border-radius: 10px;
          background: linear-gradient(135deg, #0a2e73, #164ca8);
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsPosBrandAccordion {
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.12);
          border-radius: 20px;
          background: rgba(255,255,255,.82);
          box-shadow: 0 10px 28px rgba(3, 21, 63, 0.07);
        }

        .ncsPosBrandAccordion.open {
          border-color: rgba(212, 175, 55, 0.62);
        }

        .ncsPosBrandAccordionHeader {
          border: 0;
          border-radius: 0;
          padding: 16px;
          background: linear-gradient(135deg, #03153f, #0a2e73);
          color: #fff;
        }

        .ncsPosBrandAccordionHeader small {
          color: rgba(255,255,255,.7);
        }

        @media (max-width: 760px) {
          .ncsPosBrandModalDense .ncsPosBrandModalBody {
            grid-template-columns: 1fr;
          }

          .ncsPosBrandCompactGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ncsPosBrandModalBackdrop {
            align-items: end;
            padding: 0;
          }

          .ncsPosBrandModal {
            width: 100%;
            max-height: 90vh;
            border-radius: 22px 22px 0 0;
          }

          .ncsPosBrandModalBody {
            grid-template-columns: 1fr;
            padding: 10px;
          }

          .ncsPosBrandModalFooter span {
            display: none;
          }

          .ncsPosBrandModalFooter button {
            width: 100%;
          }
        }

        .ncsPosGroupedProductGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 12px;
          padding: 14px;
        }

        .ncsPosGroupedCard {
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.13);
          border-radius: 19px;
          background: #fff;
          box-shadow: 0 10px 24px rgba(3, 21, 63, 0.07);
        }

        .ncsPosGroupedCard.open {
          grid-column: 1 / -1;
          border-color: rgba(212, 175, 55, 0.72);
        }

        .ncsPosGroupedCardMain {
          width: 100%;
          display: grid;
          grid-template-columns: 88px minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 11px;
          border: 0;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .ncsPosGroupedImage {
          position: relative;
          height: 92px;
          overflow: hidden;
          border-radius: 14px;
          background: linear-gradient(135deg, #03153f, #0a2e73);
        }

        .ncsPosGroupedImage img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ncsPosGroupedImage > span {
          height: 100%;
          display: grid;
          place-items: center;
          color: #d4af37;
          font-weight: 1000;
          letter-spacing: 1px;
        }

        .ncsPosGroupedImage em {
          position: absolute;
          right: 5px;
          top: 5px;
          padding: 4px 6px;
          border-radius: 8px;
          background: #d4af37;
          color: #03153f;
          font-size: 8px;
          font-style: normal;
          font-weight: 1000;
        }

        .ncsPosGroupedInfo > small {
          color: #d4af37;
          font-size: 8px;
          font-weight: 1000;
          text-transform: uppercase;
        }

        .ncsPosGroupedInfo h3 {
          margin: 3px 0;
          color: #03153f;
          font-size: 15px;
        }

        .ncsPosGroupedInfo p {
          margin: 0;
          color: #707887;
          font-size: 10px;
          font-weight: 800;
        }

        .ncsPosGroupedInfo > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 10px;
        }

        .ncsPosGroupedInfo > div strong {
          color: #0a2e73;
          font-size: 12px;
        }

        .ncsPosGroupedInfo > div span {
          color: #707887;
          font-size: 9px;
        }

        .ncsPosGroupedInfo code {
          display: inline-block;
          margin-top: 7px;
          padding: 3px 6px;
          border-radius: 7px;
          background: rgba(10,46,115,.08);
          color: #0a2e73;
          font-size: 8px;
          font-weight: 900;
        }

        .ncsPosGroupedToggle {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: #d4af37;
          color: #03153f;
          font-size: 20px;
        }

        .ncsPosVariantPanel {
          padding: 14px;
          border-top: 1px solid rgba(10, 46, 115, 0.1);
          background: #f8f4ec;
        }

        .ncsPosVariantPanel > header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .ncsPosVariantPanel > header span,
        .ncsPosVariantPanel > header strong {
          display: block;
        }

        .ncsPosVariantPanel > header span {
          color: #d4af37;
          font-size: 8px;
          font-weight: 1000;
        }

        .ncsPosVariantPanel > header strong {
          margin-top: 2px;
          color: #03153f;
        }

        .ncsPosVariantPanel > header small {
          color: #16834a;
          font-weight: 900;
        }

        .ncsPosVariantList {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 8px;
        }

        .ncsPosVariantList button {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto 34px;
          gap: 9px;
          align-items: center;
          padding: 10px;
          border: 1px solid rgba(10,46,115,.13);
          border-radius: 13px;
          background: #fff;
          color: #03153f;
          text-align: left;
          cursor: pointer;
        }

        .ncsPosVariantList button:hover {
          border-color: #d4af37;
          transform: translateY(-1px);
        }

        .ncsPosVariantList button.out {
          opacity: .48;
          cursor: not-allowed;
        }

        .ncsPosVariantList button > div strong,
        .ncsPosVariantList button > div small,
        .ncsPosVariantList button > span b,
        .ncsPosVariantList button > span small {
          display: block;
        }

        .ncsPosVariantList button > div small {
          margin-top: 3px;
          color: #707887;
          font-size: 8px;
        }

        .ncsPosVariantList button > span {
          text-align: right;
        }

        .ncsPosVariantList button > span b {
          color: #0a2e73;
          font-size: 10px;
        }

        .ncsPosVariantList button > span small {
          margin-top: 3px;
          color: #16834a;
          font-size: 8px;
        }

        .ncsPosVariantList button > em {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #d4af37;
          color: #03153f;
          font-style: normal;
          font-weight: 1000;
        }

        .ncsPosSmartExpandedProduct {
          margin-top: 14px;
        }

        @media (max-width: 720px) {
          .ncsPosFinderToolbar > span {
            width: 100%;
            margin-left: 0;
          }

          .ncsPosGroupedProductGrid,
          .ncsPosBrandGrid {
            grid-template-columns: 1fr;
          }

          .ncsPosGroupedCardMain {
            grid-template-columns: 76px minmax(0, 1fr) auto;
          }

          .ncsPosGroupedImage {
            height: 82px;
          }

          .ncsPosVariantList {
            grid-template-columns: 1fr;
          }
        }


        /* 2026 INTERNATIONAL HIGH-SPEED POS BILLING LAYOUT */
        .ncsPosWorkspace {
          grid-template-columns: minmax(360px, 0.78fr) minmax(720px, 1.42fr);
          gap: 16px;
        }

        .ncsPosBillPanel {
          position: sticky;
          top: 12px;
          max-height: calc(100vh - 24px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 22px;
          box-shadow: 0 24px 60px rgba(3, 21, 63, 0.18);
        }

        .ncsPosCustomerSection,
        .ncsPosBillHeader {
          flex: 0 0 auto;
        }

        .ncsPosCartTableHeader {
          display: grid;
          grid-template-columns: minmax(230px, 1.8fr) 92px 104px 132px 100px 120px 34px;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
          padding: 9px 14px;
          border-top: 1px solid rgba(10, 46, 115, 0.08);
          border-bottom: 1px solid rgba(10, 46, 115, 0.12);
          background: linear-gradient(180deg, #f8faff, #eef3fb);
          color: #65718a;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .ncsPosCartItems {
          min-height: 220px;
          max-height: min(42vh, 430px);
          padding: 8px 10px 12px;
          background: #f7f9fc;
          overscroll-behavior: contain;
        }

        .ncsPosCartItemTableRow {
          display: grid;
          grid-template-columns: minmax(230px, 1.8fr) 92px 104px 132px 100px 120px 34px;
          align-items: center;
          gap: 8px;
          padding: 8px 6px;
          border: 1px solid rgba(10, 46, 115, 0.09);
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 5px 14px rgba(10, 46, 115, 0.045);
        }

        .ncsPosCartItemTableRow:hover {
          border-color: rgba(212, 175, 55, 0.72);
          box-shadow: 0 8px 18px rgba(10, 46, 115, 0.08);
        }

        .ncsPosCartProductCell {
          min-width: 0;
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr);
          align-items: center;
          gap: 9px;
        }

        .ncsPosCartThumbnail {
          width: 42px;
          height: 48px;
          border-radius: 9px;
        }

        .ncsPosItemSerial {
          display: inline-block;
          margin-bottom: 2px;
          color: #a58a2c;
          font-size: 7px;
          font-weight: 950;
        }

        .ncsPosCartProductInfo h3 {
          font-size: 10px;
          line-height: 1.2;
        }

        .ncsPosCartProductInfo p {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          margin: 3px 0 0;
          font-size: 8px;
        }

        .ncsPosCartProductInfo p em {
          padding: 2px 5px;
          border-radius: 999px;
          background: #edf7f1;
          color: #16834a;
          font-size: 7px;
          font-style: normal;
          font-weight: 900;
        }

        .ncsPosTableMoneyCell,
        .ncsPosItemLineTotal {
          min-width: 0;
        }

        .ncsPosTableMoneyCell strong,
        .ncsPosItemLineTotal strong {
          display: block;
          color: #0a2e73;
          font-size: 10px;
          font-weight: 950;
          white-space: nowrap;
        }

        .ncsPosItemLineTotal small {
          display: block;
          margin-top: 2px;
          color: #16834a;
          font-size: 7px;
          font-weight: 850;
          white-space: nowrap;
        }

        .ncsPosInlineMoneyInput,
        .ncsPosItemDiscountField {
          width: 100%;
          min-width: 0;
        }

        .ncsPosInlineMoneyInput > div,
        .ncsPosItemDiscountField > div {
          height: 34px;
          display: flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid #dce2ec;
          border-radius: 9px;
          background: #fff;
        }

        .ncsPosInlineMoneyInput b,
        .ncsPosItemDiscountField b {
          padding: 0 7px;
          color: #927611;
          font-size: 9px;
        }

        .ncsPosInlineMoneyInput input,
        .ncsPosItemDiscountField input {
          width: 100%;
          min-width: 0;
          height: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #03153f;
          font-family: inherit;
          font-size: 10px;
          font-weight: 900;
          text-align: right;
        }

        .ncsPosQuantityTableCell {
          display: block;
          width: 100%;
        }

        .ncsPosQuantityTableCell > div {
          display: grid;
          grid-template-columns: 32px minmax(38px, 1fr) 32px;
          align-items: center;
          height: 34px;
          overflow: hidden;
          border: 1px solid #dce2ec;
          border-radius: 9px;
          background: #fff;
        }

        .ncsPosQuantityTableCell button {
          width: 32px;
          height: 32px;
          border: 0;
          background: #edf2fb;
          color: #0a2e73;
          font-weight: 950;
          cursor: pointer;
        }

        .ncsPosQuantityTableCell input {
          width: 100%;
          height: 32px;
          border: 0;
          outline: 0;
          color: #03153f;
          font-family: inherit;
          font-size: 10px;
          font-weight: 950;
          text-align: center;
        }

        .ncsPosRemoveItem {
          width: 30px;
          height: 30px;
          border-radius: 9px;
        }

        .ncsPosMobileCellLabel {
          display: none;
        }

        .ncsPosSummary {
          flex: 0 0 auto;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          column-gap: 16px;
          max-height: 210px;
          overflow-y: auto;
          padding: 12px 14px;
          border-top: 1px solid rgba(10, 46, 115, 0.1);
          background: #fff;
        }

        .ncsPosDiscountField,
        .ncsPosRoundOffField,
        .ncsPosTotalLine {
          grid-column: 1 / -1;
        }

        .ncsPosPaymentSection {
          flex: 0 0 auto;
          padding: 11px 14px 14px;
          border-top: 1px solid rgba(10, 46, 115, 0.1);
          background: linear-gradient(180deg, #ffffff, #f7f9fd);
        }

        .ncsPosPaymentGrid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .ncsPosCompleteButton {
          min-height: 58px;
          margin-top: 10px;
        }

        @media (max-width: 1450px) {
          .ncsPosWorkspace {
            grid-template-columns: minmax(330px, 0.7fr) minmax(650px, 1.3fr);
          }

          .ncsPosCartTableHeader,
          .ncsPosCartItemTableRow {
            grid-template-columns: minmax(205px, 1.65fr) 78px 92px 118px 88px 104px 30px;
            gap: 6px;
          }
        }

        @media (max-width: 1180px) {
          .ncsPosWorkspace {
            grid-template-columns: 1fr;
          }

          .ncsPosBillPanel {
            position: relative;
            top: auto;
            max-height: none;
          }
        }

        @media (max-width: 820px) {
          .ncsPosCartTableHeader {
            display: none;
          }

          .ncsPosCartItems {
            max-height: none;
          }

          .ncsPosCartItemTableRow {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
            padding: 11px;
          }

          .ncsPosCartProductCell {
            grid-column: 1 / -1;
          }

          .ncsPosMobileCellLabel {
            display: block;
            margin-bottom: 4px;
            color: #7d8798;
            font-size: 7px;
            font-weight: 950;
            letter-spacing: .05em;
            text-transform: uppercase;
          }

          .ncsPosRemoveItem {
            grid-column: 2;
            justify-self: end;
          }

          .ncsPosSummary {
            grid-template-columns: 1fr;
            max-height: none;
          }

          .ncsPosDiscountField,
          .ncsPosRoundOffField,
          .ncsPosTotalLine {
            grid-column: auto;
          }
        }

        @media (max-width: 820px) {
          .ncsPosSummary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ncsPosDiscountField,
          .ncsPosRoundOffField {
            grid-column: span 1;
          }

          .ncsPosMarketingConsent {
            grid-template-columns: 22px minmax(0, 1fr);
          }

          .ncsPosOfferTicker {
            grid-column: 1 / -1;
            border-left: 0;
            border-top: 1px solid rgba(212,175,55,.3);
          }

          .ncsPosCartItems {
            max-height: none;
          }
        }

        /* FINAL FULL BILL VIEW: no internal bill/summary scroll */
        @media (min-width: 1081px) {
          .ncsPosBillPanel {
            position: static !important;
            top: auto !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
          }

          .ncsPosCustomerCard,
          .ncsPosCartTableHeader,
          .ncsPosSummary,
          .ncsPosPaymentSection {
            flex-shrink: 0 !important;
          }

          .ncsPosCartItems {
            flex: none !important;
            min-height: 110px !important;
            max-height: none !important;
            height: auto !important;
            overflow-x: auto !important;
            overflow-y: visible !important;
          }

          .ncsPosSummary {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            padding: 16px !important;
            gap: 10px !important;
          }

          .ncsPosDiscountField,
          .ncsPosRoundOffField {
            grid-column: span 2 !important;
            min-height: 56px !important;
          }

          .ncsPosSummaryLine {
            min-height: 56px !important;
            padding: 10px 12px !important;
          }

          .ncsPosRoundOffLine,
          .ncsPosRewardDiscountLine,
          .ncsPosDiscountLine {
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
          }

          .ncsPosTotalLine {
            grid-column: 1 / -1 !important;
            min-height: 88px !important;
            margin-top: 4px !important;
          }

          .ncsPosPaymentSection {
            position: static !important;
            overflow: visible !important;
            padding: 14px 16px 18px !important;
          }

          .ncsPosWorkspace {
            align-items: start !important;
          }
        }

        @media (min-width: 1081px) and (max-height: 850px) {
          .ncsPosBillPanel,
          .ncsPosCartItems,
          .ncsPosSummary,
          .ncsPosPaymentSection {
            max-height: none !important;
            overflow-y: visible !important;
          }

          .ncsPosCartItems {
            flex: none !important;
            min-height: 110px !important;
            height: auto !important;
          }
        }
      `}
</style>
    </main>
  );
}



