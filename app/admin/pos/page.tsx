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

type PosPurchaseCostRow = {
  product_id?: number | string | null;
  variant_id?: number | string | null;
  purchase_price?: number | string | null;
  created_at?: string | null;
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
  designUnitId?: number | null;
  designName?: string;
  designImageUrl?: string;
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

type PosDesignChoice = {
  mappingId: number;
  productId: number;
  variantId: number;
  designUnitId: number;
  designName: string;
  imageUrl: string;
  status: string;
  sortOrder: number;
  purchaseId: string;
  purchaseNumber: string;
  purchaseDate: string;
  mrp: number;
};

type PosDesignUnitRow = {
  id: number;
  product_id: number;
  design_name?: string | null;
  image_url?: string | null;
  status?: string | null;
  sort_order?: number | string | null;
  purchase_id?: string | null;
};

type PosDesignVariantRow = {
  id: number;
  product_id: number;
  design_unit_id: number;
  variant_id: number;
  status?: string | null;
  mrp?: number | string | null;
};

type PosDesignPurchaseRow = {
  id: string;
  purchase_number?: string | null;
  purchase_date?: string | null;
};

type PosDesignBatchGroup = {
  key: string;
  title: string;
  subtitle: string;
  purchaseDate: string;
  choices: PosDesignChoice[];
};

function groupPosDesignChoicesByPurchase(
  choices: PosDesignChoice[],
): PosDesignBatchGroup[] {
  const grouped = new Map<string, PosDesignChoice[]>();

  choices.forEach((choice) => {
    const key = choice.purchaseId || "__unbatched__";
    grouped.set(key, [...(grouped.get(key) || []), choice]);
  });

  const batches = Array.from(grouped.entries()).map(
    ([key, batchChoices]) => {
      const first = batchChoices[0];
      const purchaseDate = first?.purchaseDate || "";
      const purchaseNumber = first?.purchaseNumber || "";

      return {
        key,
        title:
          key === "__unbatched__"
            ? "Older Stock"
            : purchaseNumber || "Purchase Batch",
        subtitle:
          key === "__unbatched__"
            ? "Old photos saved before purchase-batch tracking"
            : purchaseDate
              ? new Date(`${purchaseDate}T00:00:00`).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "Purchase batch",
        purchaseDate,
        choices: [...batchChoices].sort(
          (a, b) =>
            a.sortOrder - b.sortOrder ||
            b.designUnitId - a.designUnitId,
        ),
      };
    },
  );

  return batches.sort((a, b) => {
    if (a.key === "__unbatched__") return 1;
    if (b.key === "__unbatched__") return -1;

    const dateCompare =
      (b.purchaseDate || "").localeCompare(a.purchaseDate || "");

    if (dateCompare !== 0) return dateCompare;

    return (
      Math.max(...b.choices.map((choice) => choice.designUnitId)) -
      Math.max(...a.choices.map((choice) => choice.designUnitId))
    );
  });
}

const POS_DESIGN_CACHE_KEY = "ncs_pos_design_choices_v2";

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

type PosRefundOverview = {
  amount?: number | string | null;
  refund_method?: string | null;
  refund_status?: string | null;
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
const HELD_BILLS_BACKUP_STORAGE_KEY = "ncs_pos_held_bills_backup_v1";
const POS_ACTIVE_BILL_STORAGE_KEY = "ncs_pos_active_bill_v1";
const POS_RECENT_PRODUCTS_KEY = "ncs_pos_recent_products_v1";
const POS_POPULAR_PRODUCTS_KEY = "ncs_pos_popular_products_v1";
const POS_OVERVIEW_CACHE_KEY = "ncs_pos_overview_cache_v1";
const OWNER_MIN_PROFIT_MARGIN_PERCENT = 15;
const OWNER_PROFIT_ALERT_TABLE = "owner_profit_alerts";

type OwnerProfitAlertLevel = "LOW_PROFIT" | "LOSS_SALE" | "BILL_PROFIT_SUMMARY";

type OwnerProfitAlertDraft = {
  fingerprint: string;
  level: OwnerProfitAlertLevel;
  productId: number;
  variantId: number | null;
  productName: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  purchasePrice: number;
  actualSellingPrice: number;
  profitPerUnit: number;
  marginPercent: number;
};


type OwnerBusinessSettings = {
  minimum_profit_margin_percent: number;
  low_profit_alert_enabled: boolean;
  loss_sale_alert_enabled: boolean;
  bill_profit_summary_enabled: boolean;
};

const DEFAULT_OWNER_BUSINESS_SETTINGS: OwnerBusinessSettings = {
  minimum_profit_margin_percent: OWNER_MIN_PROFIT_MARGIN_PERCENT,
  low_profit_alert_enabled: true,
  loss_sale_alert_enabled: true,
  bill_profit_summary_enabled: true,
};



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

type PosFestivalOffer = {
  id: string;
  discount: number;
  title: string;
  subtitle: string;
  className: string;
};

const POS_FESTIVAL_OFFERS: PosFestivalOffer[] = [
  { id: "offer20", discount: 20, title: "STYLE STARTER", subtitle: "Festival fashion special", className: "coral" },
  { id: "offer30", discount: 30, title: "FAMILY FEST", subtitle: "Selected styles celebration", className: "violet" },
  { id: "offer40", discount: 40, title: "FESTIVE FLASH", subtitle: "Limited-time fashion drop", className: "emerald" },
  { id: "offer50", discount: 50, title: "HALF PRICE FEST", subtitle: "Selected collection special", className: "sunset" },
  { id: "offer60", discount: 60, title: "MEGA FESTIVAL", subtitle: "Big savings on selected styles", className: "aqua" },
  { id: "offer70", discount: 70, title: "FINAL FESTIVAL DROP", subtitle: "Selected clearance styles", className: "berry" },
];

const POS_OFFER_CORNERS = ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const;
type PosOfferCorner = (typeof POS_OFFER_CORNERS)[number];

export default function PosPage() {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const quickItemNameInputRef = useRef<HTMLInputElement | null>(null);
  const customerNameInputRef = useRef<HTMLInputElement | null>(null);
  const customerPhoneInputRef = useRef<HTMLInputElement | null>(null);
  const saleSubmissionLockRef = useRef(false);
  const activeBillRecoveryLoadedRef = useRef(false);

  const [products, setProducts] = useState<PosProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [designChoicesByVariant, setDesignChoicesByVariant] =
    useState<Record<string, PosDesignChoice[]>>({});
  const [designPickerProduct, setDesignPickerProduct] =
    useState<PosProduct | null>(null);

  const [posOverview, setPosOverview] = useState<PosOverview>({
    todaySales: 0,
    todayBills: 0,
    todayCash: 0,
    todayDigital: 0,
    customerCredit: 0,
    creditCustomers: 0,
  });
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [showOwnerSummary, setShowOwnerSummary] = useState(false);

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
const ownerProfitAlertFingerprintsRef = useRef<Set<string>>(new Set());
const ownerProfitAlertTimerRef = useRef<number | null>(null);
const [ownerBusinessSettings, setOwnerBusinessSettings] =
  useState<OwnerBusinessSettings>(DEFAULT_OWNER_BUSINESS_SETTINGS);

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
  const [activeHeldBillId, setActiveHeldBillId] = useState<string | null>(null);
  const [lastAddedItemKey, setLastAddedItemKey] = useState<string | null>(null);
  const [currentCustomerDue, setCurrentCustomerDue] = useState(0);
  const [customerDueLoading, setCustomerDueLoading] = useState(false);

  const [ownerCostInfo, setOwnerCostInfo] =
    useState<PosOwnerCostInfo | null>(null);
  const [loadingOwnerCostKey, setLoadingOwnerCostKey] =
    useState<string | null>(null);

  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<
    "success" | "error" | "info"
  >("info");

  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [billFocusCollapsed, setBillFocusCollapsed] = useState(false);
  const [festivalOffer, setFestivalOffer] = useState<PosFestivalOffer | null>(null);
  const [festivalOfferCorner, setFestivalOfferCorner] = useState<PosOfferCorner>("bottomRight");
  const festivalOfferHideTimerRef = useRef<number | null>(null);

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
  const [quickDraftItems, setQuickDraftItems] = useState<CartItem[]>([]);


  useEffect(() => {
    let lastOfferId = "";

    const showRandomFestivalOffer = () => {
      const availableOffers = POS_FESTIVAL_OFFERS.filter(
        (offer) => offer.id !== lastOfferId,
      );
      const pool = availableOffers.length > 0 ? availableOffers : POS_FESTIVAL_OFFERS;
      const nextOffer = pool[Math.floor(Math.random() * pool.length)];
      const nextCorner = POS_OFFER_CORNERS[
        Math.floor(Math.random() * POS_OFFER_CORNERS.length)
      ];

      lastOfferId = nextOffer.id;
      setFestivalOffer(nextOffer);
      setFestivalOfferCorner(nextCorner);

      if (festivalOfferHideTimerRef.current !== null) {
        window.clearTimeout(festivalOfferHideTimerRef.current);
      }

      festivalOfferHideTimerRef.current = window.setTimeout(() => {
        setFestivalOffer(null);
        festivalOfferHideTimerRef.current = null;
      }, 5000);
    };

    // Show one card shortly after opening POS so the design can be seen/tested,
    // then continue at the requested two-minute interval.
    const firstOfferTimer = window.setTimeout(showRandomFestivalOffer, 12000);
    const offerInterval = window.setInterval(showRandomFestivalOffer, 2 * 60 * 1000);

    return () => {
      window.clearTimeout(firstOfferTimer);
      window.clearInterval(offerInterval);
      if (festivalOfferHideTimerRef.current !== null) {
        window.clearTimeout(festivalOfferHideTimerRef.current);
      }
    };
  }, []);

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
          refundResponse,
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

          supabase
            .from("pos_refunds")
            .select(
              "amount,refund_method,refund_status,created_at",
            )
            .eq("refund_status", "completed"),
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

          if (!refundResponse.error) {
            const refundRows =
              (refundResponse.data || []) as PosRefundOverview[];

            refundRows.forEach((refund) => {
              const status = normalizeText(
                refund.refund_status || "completed",
              );

              if (
                ["cancelled", "void", "failed", "deleted"].includes(
                  status,
                )
              ) {
                return;
              }

              const refundCreatedAt = refund.created_at
                ? new Date(refund.created_at)
                : null;

              if (
                !refundCreatedAt ||
                Number.isNaN(refundCreatedAt.getTime()) ||
                refundCreatedAt < startOfDay ||
                refundCreatedAt >= endOfDay
              ) {
                return;
              }

              const amount = Math.max(
                0,
                toNumber(refund.amount),
              );

              const method = normalizeText(
                refund.refund_method,
              );

              todaySales = Math.max(
                0,
                todaySales - amount,
              );

              if (method === "cash") {
                todayCash = Math.max(
                  0,
                  todayCash - amount,
                );
              } else if (
                method === "upi" ||
                method === "card" ||
                method === "bank" ||
                method === "bank_transfer"
              ) {
                todayDigital = Math.max(
                  0,
                  todayDigital - amount,
                );
              }
            });
          } else {
            console.info(
              "Refund overview unavailable:",
              refundResponse.error.message,
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

  const readHeldBillsSnapshot = useCallback((): HeldBill[] => {
    const readKey = (key: string): HeldBill[] => {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as HeldBill[];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const primary = readKey(HELD_BILLS_STORAGE_KEY);
    const backup = readKey(HELD_BILLS_BACKUP_STORAGE_KEY);
    const merged = [...primary, ...backup];
    const seen = new Set<string>();

    return merged.filter((bill) => {
      if (!bill?.id || seen.has(bill.id)) return false;
      seen.add(bill.id);
      return true;
    });
  }, []);

  const loadHeldBills = useCallback(() => {
    const savedBills = readHeldBillsSnapshot();
    setHeldBills(savedBills);

    if (savedBills.length > 0) {
      window.localStorage.setItem(
        HELD_BILLS_STORAGE_KEY,
        JSON.stringify(savedBills)
      );
      window.localStorage.setItem(
        HELD_BILLS_BACKUP_STORAGE_KEY,
        JSON.stringify(savedBills)
      );
    }
  }, [readHeldBillsSnapshot]);

  useEffect(() => {
    loadHeldBills();
  }, [loadHeldBills]);

  // Recover an unfinished counter bill after refresh / browser crash / accidental close.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(POS_ACTIVE_BILL_STORAGE_KEY);
      if (!raw) return;

      const draft = JSON.parse(raw) as Partial<HeldBill> & {
        customerWhatsAppOptIn?: boolean;
      };

      if (Array.isArray(draft.items) && draft.items.length > 0) {
        setCartItems(draft.items);
        setCustomerName(draft.customerName || "");
        setCustomerPhone(draft.customerPhone || "");
        setCustomerWhatsAppOptIn(draft.customerWhatsAppOptIn === true);
        setBillDiscountPercent(
          Math.min(100, Math.max(0, toNumber(draft.billDiscountPercent)))
        );
        setRoundOffAmount(Math.max(0, toNumber(draft.roundOffAmount)));
        setPaymentMethod(
          draft.paymentMethod === "upi" ||
          draft.paymentMethod === "card" ||
          draft.paymentMethod === "credit"
            ? draft.paymentMethod
            : "cash"
        );
        setCreditPaidNow(Math.max(0, toNumber(draft.creditPaidNow)));
        setCreditDueDate(
          draft.creditDueDate || getDefaultCreditDueDate()
        );
        showNotice("Recovered the unfinished counter bill.", "success");
      }
    } catch (error) {
      console.info("Active bill recovery was skipped:", error);
    } finally {
      activeBillRecoveryLoadedRef.current = true;
    }
  }, [showNotice]);

  useEffect(() => {
    if (!activeBillRecoveryLoadedRef.current) return;

    const hasDraft =
      cartItems.length > 0 ||
      Boolean(customerName.trim()) ||
      Boolean(customerPhone.trim());

    if (!hasDraft) {
      window.localStorage.removeItem(POS_ACTIVE_BILL_STORAGE_KEY);
      return;
    }

    const draft = {
      id: "ACTIVE",
      holdNumber: "ACTIVE",
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerWhatsAppOptIn,
      items: cartItems,
      billDiscountPercent: Math.min(
        100,
        Math.max(0, billDiscountPercent)
      ),
      roundOffAmount: Math.max(0, roundOffAmount),
      paymentMethod,
      creditPaidNow:
        paymentMethod === "credit"
          ? Math.max(0, creditPaidNow)
          : 0,
      creditDueDate:
        paymentMethod === "credit" ? creditDueDate : undefined,
      createdAt: new Date().toISOString(),
    };

    window.localStorage.setItem(
      POS_ACTIVE_BILL_STORAGE_KEY,
      JSON.stringify(draft)
    );
  }, [
    cartItems,
    customerName,
    customerPhone,
    customerWhatsAppOptIn,
    billDiscountPercent,
    roundOffAmount,
    paymentMethod,
    creditPaidNow,
    creditDueDate,
  ]);

  // Customer due intelligence: show an immediate warning when a known credit
  // customer is entered. This is read-only and never blocks normal billing.
  useEffect(() => {
    const phone = customerPhone.replace(/\D/g, "").slice(-10);

    if (phone.length !== 10 || !isBrowserOnline()) {
      setCurrentCustomerDue(0);
      setCustomerDueLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        setCustomerDueLoading(true);

        const { data, error } = await supabase
          .from("customer_credit_accounts")
          .select("current_balance,customer_phone")
          .in("customer_phone", [phone, `91${phone}`, `+91${phone}`])
          .limit(5);

        if (!active) return;

        if (error) {
          console.info("Customer due lookup skipped:", error.message);
          setCurrentCustomerDue(0);
        } else {
          setCurrentCustomerDue(
            Math.max(
              0,
              ...(data || []).map((row) =>
                toNumber(row.current_balance)
              )
            )
          );
        }

        setCustomerDueLoading(false);
      })();
    }, 320);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [customerPhone]);

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

  const loadDesignChoices = useCallback(async () => {
    const readCachedChoices = () => {
      try {
        const raw = window.localStorage.getItem(POS_DESIGN_CACHE_KEY);
        if (!raw) return {} as Record<string, PosDesignChoice[]>;
        const parsed = JSON.parse(raw) as Record<string, PosDesignChoice[]>;
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {} as Record<string, PosDesignChoice[]>;
      }
    };

    if (!isBrowserOnline()) {
      setDesignChoicesByVariant(readCachedChoices());
      return;
    }

    try {
      const [designResponse, mappingResponse] = await Promise.all([
        supabase
          .from("product_design_units")
          .select(
            "id,product_id,design_name,image_url,status,sort_order,purchase_id",
          )
          .neq("status", "hidden")
          .order("sort_order", { ascending: true }),
        supabase
          .from("product_design_unit_variants")
          .select("id,product_id,design_unit_id,variant_id,status,mrp")
          .eq("status", "available"),
      ]);

      if (designResponse.error) throw designResponse.error;
      if (mappingResponse.error) throw mappingResponse.error;

      const units = (designResponse.data || []) as unknown as PosDesignUnitRow[];
      const mappings =
        (mappingResponse.data || []) as unknown as PosDesignVariantRow[];

      const purchaseIds = Array.from(
        new Set(
          units
            .map((unit) => unit.purchase_id?.trim() || "")
            .filter(Boolean),
        ),
      );

      const purchaseMap = new Map<string, PosDesignPurchaseRow>();

      if (purchaseIds.length > 0) {
        const purchaseResponse = await supabase
          .from("purchases")
          .select("id,purchase_number,purchase_date")
          .in("id", purchaseIds);

        if (purchaseResponse.error) throw purchaseResponse.error;

        (
          (purchaseResponse.data || []) as unknown as PosDesignPurchaseRow[]
        ).forEach((purchase) => {
          purchaseMap.set(String(purchase.id), purchase);
        });
      }

      const unitMap = new Map<number, PosDesignUnitRow>();
      units.forEach((unit) => unitMap.set(Number(unit.id), unit));

      const next: Record<string, PosDesignChoice[]> = {};
      mappings.forEach((mapping) => {
        const variantId = Number(mapping.variant_id);
        const designUnitId = Number(mapping.design_unit_id);
        const unit = unitMap.get(designUnitId);
        if (!variantId || !designUnitId || !unit) return;

        const purchaseId = unit.purchase_id?.trim() || "";
        const purchase = purchaseId
          ? purchaseMap.get(purchaseId)
          : undefined;

        const key = String(variantId);
        const choice: PosDesignChoice = {
          mappingId: Number(mapping.id),
          productId: Number(mapping.product_id || unit.product_id),
          variantId,
          designUnitId,
          designName:
            unit.design_name?.trim() || `Design ${designUnitId}`,
          imageUrl: unit.image_url?.trim() || "",
          status: mapping.status?.trim() || "available",
          sortOrder: Math.max(0, toNumber(unit.sort_order)),
          purchaseId,
          purchaseNumber:
            purchase?.purchase_number?.trim() || "",
          purchaseDate:
            purchase?.purchase_date?.trim() || "",
          mrp: Math.max(0, toNumber(mapping.mrp)),
        };
        next[key] = [...(next[key] || []), choice];
      });

      Object.keys(next).forEach((key) => {
        next[key] = next[key].sort(
          (a, b) =>
            (b.purchaseDate || "").localeCompare(a.purchaseDate || "") ||
            b.designUnitId - a.designUnitId,
        );
      });

      setDesignChoicesByVariant(next);
      try {
        window.localStorage.setItem(POS_DESIGN_CACHE_KEY, JSON.stringify(next));
      } catch (cacheError) {
        console.info("Unable to cache POS design choices:", cacheError);
      }
    } catch (error) {
      console.info("POS design choices unavailable; using last saved design cache:", error);
      setDesignChoicesByVariant(readCachedChoices());
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

      // Profit safety: use the latest real purchase history as the primary
      // cost source. This also covers registered products that do not have
      // a product_variants row, which previously appeared in Sales but were
      // silently excluded from Bill Profit.
      const latestPurchaseCostByProductId = new Map<number, number>();
      const latestPurchaseCostByVariantId = new Map<number, number>();

      const productIdsForCostLookup = safeProductRows
        .map((product) => Number(product.id))
        .filter((productId) => Number.isFinite(productId) && productId > 0);

      if (productIdsForCostLookup.length > 0) {
        const { data: purchaseCostData, error: purchaseCostError } =
          await supabase
            .from("purchase_items")
            .select("product_id,variant_id,purchase_price,created_at")
            .in("product_id", productIdsForCostLookup)
            .order("created_at", { ascending: false });

        if (!purchaseCostError) {
          const purchaseCostRows =
            (purchaseCostData || []) as unknown as PosPurchaseCostRow[];

          purchaseCostRows.forEach((row) => {
            const productId = Number(row.product_id);
            const variantId = Number(row.variant_id);
            const purchasePrice = Math.max(0, toNumber(row.purchase_price));

            if (purchasePrice <= 0) {
              return;
            }

            // Rows are newest-first, so the first valid cost wins.
            if (
              Number.isFinite(variantId) &&
              variantId > 0 &&
              !latestPurchaseCostByVariantId.has(variantId)
            ) {
              latestPurchaseCostByVariantId.set(variantId, purchasePrice);
            }

            if (
              Number.isFinite(productId) &&
              productId > 0 &&
              !latestPurchaseCostByProductId.has(productId)
            ) {
              latestPurchaseCostByProductId.set(productId, purchasePrice);
            }
          });
        } else {
          console.info(
            "Latest purchase cost lookup unavailable; using variant cost fallback:",
            purchaseCostError.message
          );
        }
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
              purchasePrice:
                latestPurchaseCostByVariantId.get(Number(variant.id)) ||
                latestPurchaseCostByProductId.get(productId) ||
                Math.max(0, toNumber(variant.purchase_price)),
              purchasePriceKnown:
                (latestPurchaseCostByVariantId.get(Number(variant.id)) ||
                  latestPurchaseCostByProductId.get(productId) ||
                  Math.max(0, toNumber(variant.purchase_price))) > 0,
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
          purchasePrice:
            latestPurchaseCostByProductId.get(productId) || 0,
          purchasePriceKnown:
            (latestPurchaseCostByProductId.get(productId) || 0) > 0,
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
    void loadDesignChoices();
  }, [loadProducts, loadDesignChoices]);

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_design_units" },
        () => void loadDesignChoices()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_design_unit_variants" },
        () => void loadDesignChoices()
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
  }, [loadProducts, loadDesignChoices]);

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


  useEffect(() => {
    let active = true;

    void (async () => {
      const { data, error } = await supabase
        .from("owner_business_settings")
        .select(
          "minimum_profit_margin_percent,low_profit_alert_enabled,loss_sale_alert_enabled,bill_profit_summary_enabled",
        )
        .eq("id", 1)
        .maybeSingle();

      if (!active || error || !data) {
        if (error) {
          console.info("Owner Guard settings fallback:", error.message);
        }
        return;
      }

      setOwnerBusinessSettings({
        minimum_profit_margin_percent: Math.max(
          0,
          Math.min(
            100,
            toNumber(
              data.minimum_profit_margin_percent,
              OWNER_MIN_PROFIT_MARGIN_PERCENT,
            ),
          ),
        ),
        low_profit_alert_enabled:
          data.low_profit_alert_enabled !== false,
        loss_sale_alert_enabled:
          data.loss_sale_alert_enabled !== false,
        bill_profit_summary_enabled:
          data.bill_profit_summary_enabled !== false,
      });
    })();

    return () => {
      active = false;
    };
  }, []);

  const ownerProfitAlerts = useMemo<OwnerProfitAlertDraft[]>(() => {
    if (cartItems.length === 0 || subtotal <= 0) {
      return [];
    }

    // finalPayable already includes item-level negotiated prices,
    // bill discount, reward discount and round-off. Distribute that
    // final realised value proportionally across registered items.
    const realisedRevenueFactor = Math.max(
      0,
      Math.min(1, finalPayable / subtotal),
    );

    return cartItems
      .filter(
        (item) =>
          !item.isQuickItem &&
          item.purchasePriceKnown === true &&
          toNumber(item.purchasePrice) > 0 &&
          item.quantity > 0,
      )
      .map((item) => {
        const purchasePrice = Math.max(0, toNumber(item.purchasePrice));
        const actualSellingPrice = Math.max(
          0,
          item.price * realisedRevenueFactor,
        );
        const profitPerUnit = actualSellingPrice - purchasePrice;
        const marginPercent =
          actualSellingPrice > 0
            ? (profitPerUnit / actualSellingPrice) * 100
            : -100;

        const level: OwnerProfitAlertLevel =
          profitPerUnit < 0 ? "LOSS_SALE" : "LOW_PROFIT";

        return {
          fingerprint: [
            item.key,
            level,
            item.quantity,
            actualSellingPrice.toFixed(2),
            purchasePrice.toFixed(2),
            safeBillDiscountPercent.toFixed(2),
            safeRewardPointsToUse,
            safeRoundOffAmount.toFixed(2),
          ].join("|"),
          level,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.name,
          sku: item.sku,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          purchasePrice,
          actualSellingPrice,
          profitPerUnit,
          marginPercent,
        };
      })
      .filter((alert) => {
        if (alert.level === "LOSS_SALE") {
          return ownerBusinessSettings.loss_sale_alert_enabled;
        }

        return (
          ownerBusinessSettings.low_profit_alert_enabled &&
          alert.marginPercent <
            ownerBusinessSettings.minimum_profit_margin_percent
        );
      });
  }, [
    cartItems,
    finalPayable,
    safeBillDiscountPercent,
    safeRewardPointsToUse,
    safeRoundOffAmount,
    subtotal,
    ownerBusinessSettings.low_profit_alert_enabled,
    ownerBusinessSettings.loss_sale_alert_enabled,
    ownerBusinessSettings.minimum_profit_margin_percent,
  ]);

  useEffect(() => {
    if (ownerProfitAlertTimerRef.current !== null) {
      window.clearTimeout(ownerProfitAlertTimerRef.current);
      ownerProfitAlertTimerRef.current = null;
    }

    if (ownerProfitAlerts.length === 0 || !isBrowserOnline()) {
      return;
    }

    ownerProfitAlertTimerRef.current = window.setTimeout(() => {
      void (async () => {
        const newAlerts = ownerProfitAlerts.filter(
          (alert) =>
            !ownerProfitAlertFingerprintsRef.current.has(alert.fingerprint),
        );

        if (newAlerts.length === 0) {
          return;
        }

        const rows = newAlerts.map((alert) => ({
          alert_type: alert.level,
          source: "WEB_POS_PRE_BILL",
          product_id: alert.productId,
          variant_id: alert.variantId,
          product_name: alert.productName,
          sku: alert.sku || null,
          size: alert.size || null,
          color: alert.color || null,
          quantity: alert.quantity,
          purchase_price: Number(alert.purchasePrice.toFixed(2)),
          actual_selling_price: Number(alert.actualSellingPrice.toFixed(2)),
          profit_per_unit: Number(alert.profitPerUnit.toFixed(2)),
          margin_percent: Number(alert.marginPercent.toFixed(2)),
          target_margin_percent: ownerBusinessSettings.minimum_profit_margin_percent,
          bill_discount_percent: Number(safeBillDiscountPercent.toFixed(2)),
          final_bill_amount: Number(finalPayable.toFixed(2)),
          status: "NEW",
          created_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from(OWNER_PROFIT_ALERT_TABLE)
          .insert(rows);

        if (error) {
          // Keep POS billing uninterrupted. The table is installed separately
          // and the alert will be retried on the next relevant price change.
          console.info(
            "Owner Profit Alert sync is not ready:",
            error.message,
          );
          return;
        }

        newAlerts.forEach((alert) => {
          ownerProfitAlertFingerprintsRef.current.add(alert.fingerprint);
        });
      })();
    }, 650);

    return () => {
      if (ownerProfitAlertTimerRef.current !== null) {
        window.clearTimeout(ownerProfitAlertTimerRef.current);
        ownerProfitAlertTimerRef.current = null;
      }
    };
  }, [
    finalPayable,
    ownerProfitAlerts,
    safeBillDiscountPercent,
  ]);

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
    setQuickDraftItems([]);
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

    setQuickDraftItems((current) => [...current, quickItem]);

    // Batch quick-entry workflow: stage each row first.
    // The cashier adds all staged rows to the actual bill in one final action.
    setQuickItemForm({
      ...EMPTY_QUICK_ITEM_FORM,
      category,
    });

    window.requestAnimationFrame(() => {
      quickItemNameInputRef.current?.focus();
      quickItemNameInputRef.current?.select();
    });

    showNotice(
      `${name} added to Quick Items. Enter the next item.`,
      "success",
    );
  }

  function removeQuickDraftItem(itemKey: string) {
    setQuickDraftItems((current) =>
      current.filter((item) => item.key !== itemKey),
    );
  }

  function commitQuickItemsToBill() {
    if (quickDraftItems.length === 0) {
      showNotice("Add at least one Quick Item row first.", "info");
      return;
    }

    setCartItems((current) => [...current, ...quickDraftItems]);
    setBillFocusCollapsed(false);
    const addedCount = quickDraftItems.length;
    setQuickDraftItems([]);
    setQuickItemForm(EMPTY_QUICK_ITEM_FORM);
    setShowQuickItem(false);
    showNotice(
      `${addedCount} quick item${addedCount === 1 ? "" : "s"} added to the bill.`,
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

  function addProductDirectlyToCart(product: PosProduct) {
    if (getAvailableStock(product) <= 0) {
      showNotice(`${product.name} is out of stock.`, "error");
      return;
    }

    setCartItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.key === product.key);
      if (existingItem) {
        if (product.designUnitId) {
          showNotice(`${product.designName || product.name} is already in this bill.`, "info");
          return currentItems;
        }
        if (existingItem.quantity >= getAvailableStock(product)) {
          showNotice(`Only ${product.stock} item(s) available.`, "error");
          return currentItems;
        }
        return currentItems.map((item) => item.key === product.key ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...currentItems, { ...product, quantity: 1, discountPercent: 0 }];
    });

    rememberSelectedProduct(product);
    setBillFocusCollapsed(false);
    setLastAddedItemKey(product.key);
    window.setTimeout(() => {
      setLastAddedItemKey((current) =>
        current === product.key ? null : current
      );
    }, 1600);
    showNotice(product.designUnitId ? `${product.designName || "Selected design"} added to bill.` : `${product.name} added to bill.`, "success");
    setSearchQuery("");
    searchInputRef.current?.focus();
  }

  function addProductToCart(product: PosProduct) {
    if (getAvailableStock(product) <= 0) {
      showNotice(`${product.name} is out of stock.`, "error");
      return;
    }
    if (!product.variantId || product.isQuickItem) {
      addProductDirectlyToCart(product);
      return;
    }

    const choices =
      designChoicesByVariant[String(product.variantId)] || [];

    if (choices.length === 0) {
      addProductDirectlyToCart(product);
      return;
    }

    /*
     * A common barcode may represent physical stock that is NOT one of the
     * photographed / online-listed design units. Therefore, whenever this
     * variant has online design choices, always open the picker — even if
     * only one photographed design remains.
     *
     * The picker now also contains "OTHER / OFFLINE PIECE". Choosing that
     * option adds the normal product + variant to the bill WITHOUT a
     * designUnitId. complete_pos_sale will still reduce physical stock, while
     * ncs_mark_pos_designs_sold_v1 will ignore it, so no online design card is
     * hidden by mistake.
     */
    setDesignPickerProduct(product);
  }

  function selectPosDesign(choice: PosDesignChoice) {
    const product = designPickerProduct;
    if (!product) return;

    // Exact photographed piece: use its own OFFLINE / TAG MRP.
    // Online MRP / online price must never affect the local POS bill.
    const designOfflineMrp =
      Math.max(0, toNumber(choice.mrp)) || Math.max(0, toNumber(product.mrp));

    setDesignPickerProduct(null);
    addProductDirectlyToCart({
      ...product,
      key: `${product.key}-design-${choice.designUnitId}`,
      imageUrl: choice.imageUrl || product.imageUrl,
      price: designOfflineMrp,
      mrp: designOfflineMrp,
      designUnitId: choice.designUnitId,
      designName: choice.designName,
      designImageUrl: choice.imageUrl,
    });
  }

  function selectPosOfflinePiece() {
    const product = designPickerProduct;
    if (!product) return;

    const currentVariantQuantity = cartItems.reduce(
      (sum, item) =>
        item.productId === product.productId &&
        item.variantId === product.variantId
          ? sum + item.quantity
          : sum,
      0,
    );

    if (currentVariantQuantity >= getAvailableStock(product)) {
      showNotice(
        `Only ${product.stock} item(s) available for this size / variant.`,
        "error",
      );
      return;
    }

    // OTHER / OFFLINE PIECE has no photographed design row, and pieces under
    // one common barcode can have different tag MRPs. Ask the cashier for the
    // exact MRP printed on the physical piece instead of guessing from online data.
    const enteredMrp = window.prompt(
      "Enter the MRP printed on this OFFLINE / OTHER piece",
      product.mrp > 0 ? String(product.mrp) : "",
    );

    if (enteredMrp === null) return;

    const offlineMrp = Math.max(0, toNumber(enteredMrp));
    if (offlineMrp <= 0) {
      showNotice("Please enter a valid offline/tag MRP.", "error");
      return;
    }

    setDesignPickerProduct(null);

    addProductDirectlyToCart({
      ...product,
      key: product.key,
      price: offlineMrp,
      mrp: offlineMrp,
      designUnitId: null,
      designName: undefined,
      designImageUrl: undefined,
    });

    showNotice(
      `Offline / other piece added at MRP ₹${offlineMrp}. Physical stock will reduce; online photos will stay visible.`,
      "success",
    );
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
    const seen = new Set<string>();
    const safeBills = nextHeldBills.filter((bill) => {
      if (!bill?.id || seen.has(bill.id)) return false;
      seen.add(bill.id);
      return true;
    });

    setHeldBills(safeBills);

    // Primary + backup copy. A completed bill must never accidentally wipe
    // another customer's waiting bill.
    window.localStorage.setItem(
      HELD_BILLS_STORAGE_KEY,
      JSON.stringify(safeBills)
    );
    window.localStorage.setItem(
      HELD_BILLS_BACKUP_STORAGE_KEY,
      JSON.stringify(safeBills)
    );
  }

  function removeHeldBillById(heldBillId: string) {
    const latest = readHeldBillsSnapshot();
    saveHeldBills(
      latest.filter((bill) => bill.id !== heldBillId)
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

    const latestBills = readHeldBillsSnapshot();
    const existingActive = activeHeldBillId
      ? latestBills.find((bill) => bill.id === activeHeldBillId) || null
      : null;

    const heldBill: HeldBill = {
      id: activeHeldBillId || crypto.randomUUID(),
      holdNumber:
        existingActive?.holdNumber || createHoldNumber(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      items: cartItems.map((item) => ({ ...item })),
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
      createdAt:
        existingActive?.createdAt || new Date().toISOString(),
    };

    saveHeldBills([
      heldBill,
      ...latestBills.filter((bill) => bill.id !== heldBill.id),
    ]);
    setActiveHeldBillId(null);

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
      existingActive
        ? `${heldBill.holdNumber} updated safely in Customer Queue.`
        : `${heldBill.holdNumber} saved safely in Customer Queue.`,
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

    // Keep the queue copy until this resumed bill is actually completed.
    // If the cashier switches customers again, Hold updates this same queue row.
    setActiveHeldBillId(heldBill.id);

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

    removeHeldBillById(heldBillId);
    if (activeHeldBillId === heldBillId) {
      setActiveHeldBillId(null);
    }
  }

  useEffect(() => {
    const handleCounterShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === "F2") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === "F4") {
        event.preventDefault();
        openQuickItem();
        return;
      }

      if (event.key === "F6") {
        event.preventDefault();
        customerNameInputRef.current?.focus();
        customerNameInputRef.current?.select();
        return;
      }

      if (event.key === "F7") {
        event.preventDefault();
        customerPhoneInputRef.current?.focus();
        customerPhoneInputRef.current?.select();
        return;
      }

      if (event.key === "F8") {
        event.preventDefault();
        setShowHeldBills(true);
        return;
      }

      if (event.key === "F9") {
        event.preventDefault();
        if (cartItems.length > 0) {
          holdCurrentBill();
        } else {
          showNotice("Current bill is empty.", "info");
        }
        return;
      }

      if (event.key === "F10") {
        event.preventDefault();
        if (cartItems.length > 0 && !isCompletingSale) {
          void handleCompleteSale();
        }
      }
    };

    window.addEventListener("keydown", handleCounterShortcut);
    return () =>
      window.removeEventListener("keydown", handleCounterShortcut);
  }, [
    cartItems.length,
    isCompletingSale,
    customerName,
    customerPhone,
    paymentMethod,
    billDiscountPercent,
    roundOffAmount,
    activeHeldBillId,
  ]);

  function addPhysicalPieceWithTagMrp(product: PosProduct) {
    if (getAvailableStock(product) <= 0) {
      showNotice(`${product.name} is out of stock.`, "error");
      return false;
    }

    // Preserve the existing photographed-design flow exactly as-is.
    // If this exact variant has online design/photo choices, open the existing
    // picker so the cashier can choose that exact photographed piece or use
    // OTHER / OFFLINE PIECE. Nothing in that advanced flow is replaced.
    if (product.variantId && !product.isQuickItem) {
      const choices =
        designChoicesByVariant[String(product.variantId)] || [];

      if (choices.length > 0) {
        setDesignPickerProduct(product);
        return true;
      }
    }

    // Quick Items keep their existing behaviour and are not treated as
    // physical tagged catalogue pieces.
    if (product.isQuickItem) {
      addProductDirectlyToCart(product);
      return true;
    }

    // Stock must be checked across all MRP rows belonging to the same exact
    // product/variant because one barcode/size can contain pieces with
    // different printed tag MRPs.
    const currentVariantQuantity = cartItems.reduce(
      (sum, item) =>
        item.productId === product.productId &&
        item.variantId === product.variantId
          ? sum + item.quantity
          : sum,
      0,
    );

    if (currentVariantQuantity >= getAvailableStock(product)) {
      showNotice(
        `Only ${product.stock} item(s) available for this product / variant.`,
        "error",
      );
      return false;
    }

    // Always show the current stored MRP as the default, but let the cashier
    // type the exact MRP printed on the physical piece.
    const enteredMrp = window.prompt(
      "Enter the MRP printed on this item",
      product.mrp > 0 ? String(product.mrp) : "",
    );

    if (enteredMrp === null) {
      window.setTimeout(() => searchInputRef.current?.focus(), 50);
      return false;
    }

    const tagMrp = Math.max(0, toNumber(enteredMrp));

    if (tagMrp <= 0) {
      showNotice("Please enter a valid tag MRP.", "error");
      window.setTimeout(() => searchInputRef.current?.focus(), 50);
      return false;
    }

    // Keep different physical tag MRPs as separate bill rows even when the
    // product, barcode, size and colour are the same.
    const mrpKey = `${product.key}-tag-mrp-${tagMrp}`;

    addProductDirectlyToCart({
      ...product,
      key: mrpKey,
      price: tagMrp,
      mrp: tagMrp,
      designUnitId: null,
      designName: undefined,
      designImageUrl: undefined,
    });

    return true;
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
      addPhysicalPieceWithTagMrp(exactProduct);
      return;
    }

    if (filteredProducts.length === 1) {
      addPhysicalPieceWithTagMrp(filteredProducts[0]);
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
      saleId: sale.saleId,
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
      rewardPointsUsed: sale.rewardPointsUsed,
      rewardDiscount: sale.rewardDiscount,
      rewardPointsEarned: sale.rewardPointsEarned,
      rewardClosingBalance: sale.rewardClosingBalance,
      whatsappLanguage: "telugu",
      items: sale.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        mrp: item.mrp,
        price: item.price,
        total: item.price * item.quantity,
        size: item.size || "",
        color: item.color || "",
        barcode: item.barcode || "",
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

  async function printCanonicalInvoice(
    sale: CompletedSale,
    mode: "a4" | "thermal",
  ) {
    try {
      showNotice(
        mode === "thermal"
          ? `Preparing ${invoiceStudioSettings.thermal_width}mm thermal receipt...`
          : "Preparing A4 premium invoice...",
        "info",
      );

      const payload = await buildCanonicalInvoicePayload(
        sale,
        false,
      );

      const response = await fetch(
        "/api/whatsapp/invoice-pdf",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...payload,
            invoiceStudio: {
              ...(payload.invoiceStudio || {}),
              active_tab: mode,
              thermal_width:
                invoiceStudioSettings.thermal_width === 58
                  ? 58
                  : 80,
              bold_text: true,
              show_upi_qr:
                Boolean(
                  invoiceStudioSettings.show_upi_qr &&
                    invoiceStudioSettings.upi_id.trim(),
                ),
            },
          }),
        },
      );

      if (!response.ok) {
        let message =
          mode === "thermal"
            ? "Unable to generate thermal receipt."
            : "Unable to generate A4 invoice.";

        try {
          const result = (await response.json()) as {
            error?: string;
          };
          if (result.error) message = result.error;
        } catch {
          // Keep fallback.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const frame = document.createElement("iframe");

      frame.style.position = "fixed";
      frame.style.right = "0";
      frame.style.bottom = "0";
      frame.style.width = "1px";
      frame.style.height = "1px";
      frame.style.border = "0";
      frame.style.opacity = "0";
      frame.src = objectUrl;

      frame.onload = () => {
        window.setTimeout(() => {
          try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
          } finally {
            window.setTimeout(() => {
              frame.remove();
              URL.revokeObjectURL(objectUrl);
            }, 4000);
          }
        }, 700);
      };

      document.body.appendChild(frame);

      showNotice(
        mode === "thermal"
          ? `${invoiceStudioSettings.thermal_width}mm receipt ready.`
          : "A4 premium invoice ready.",
        "success",
      );
    } catch (error) {
      console.info(
        "Unable to print canonical invoice:",
        error,
      );

      showNotice(
        error instanceof Error
          ? error.message
          : "Unable to print invoice.",
        "error",
      );
    }
  }

  function printCustomerInvoiceA4(
    sale: CompletedSale,
  ) {
    void printCanonicalInvoice(sale, "a4");
  }

  function printCustomerInvoiceT82(
    sale: CompletedSale,
  ) {
    void printCanonicalInvoice(sale, "thermal");
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

  async function saveCompletedBillProfitSummary(
    sale: CompletedSale,
  ) {
    if (
      !ownerBusinessSettings.bill_profit_summary_enabled ||
      !isBrowserOnline()
    ) {
      return;
    }

    const saleSubtotal = Math.max(0, sale.subtotal);

    if (saleSubtotal <= 0) {
      return;
    }

    const realisedRevenueFactor = Math.max(
      0,
      Math.min(1, sale.totalAmount / saleSubtotal),
    );

    const registeredItems = sale.items.filter(
      (item) =>
        !item.isQuickItem &&
        item.purchasePriceKnown === true &&
        toNumber(item.purchasePrice) > 0 &&
        item.quantity > 0,
    );

    if (registeredItems.length === 0) {
      return;
    }

    const summary = registeredItems.reduce(
      (current, item) => {
        const quantity = Math.max(0, item.quantity);
        const purchasePrice = Math.max(
          0,
          toNumber(item.purchasePrice),
        );
        const actualSellingPrice = Math.max(
          0,
          item.price * realisedRevenueFactor,
        );

        current.registeredUnits += quantity;
        current.registeredRevenue +=
          actualSellingPrice * quantity;
        current.purchaseCost +=
          purchasePrice * quantity;

        return current;
      },
      {
        registeredUnits: 0,
        registeredRevenue: 0,
        purchaseCost: 0,
      },
    );

    const actualProfit =
      summary.registeredRevenue - summary.purchaseCost;

    const marginPercent =
      summary.registeredRevenue > 0
        ? (actualProfit / summary.registeredRevenue) * 100
        : 0;

    const { error } = await supabase
      .from(OWNER_PROFIT_ALERT_TABLE)
      .insert({
        alert_type: "BILL_PROFIT_SUMMARY",
        source: "WEB_POS_COMPLETED_BILL",
        sale_id: sale.saleId || null,
        invoice_number: sale.invoiceNumber,
        product_id: null,
        variant_id: null,
        product_name: "Completed Bill Profit",
        sku: null,
        size: null,
        color: null,
        quantity: summary.registeredUnits,
        purchase_price: Number(summary.purchaseCost.toFixed(2)),
        actual_selling_price: Number(
          summary.registeredRevenue.toFixed(2),
        ),
        profit_per_unit: Number(actualProfit.toFixed(2)),
        margin_percent: Number(marginPercent.toFixed(2)),
        target_margin_percent:
          ownerBusinessSettings.minimum_profit_margin_percent,
        bill_discount_percent:
          saleSubtotal > 0
            ? Number(
                (
                  ((saleSubtotal - sale.totalAmount) /
                    saleSubtotal) *
                  100
                ).toFixed(2),
              )
            : 0,
        final_bill_amount: Number(
          sale.totalAmount.toFixed(2),
        ),
        registered_revenue: Number(
          summary.registeredRevenue.toFixed(2),
        ),
        registered_purchase_cost: Number(
          summary.purchaseCost.toFixed(2),
        ),
        bill_profit: Number(actualProfit.toFixed(2)),
        status: "NEW",
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.info(
        "Completed Bill Profit alert could not be saved:",
        error.message,
      );
    }
  }

  async function sendPreBillOwnerProfitPreview(
    previewReference: string,
  ) {
    if (!isBrowserOnline() || cartItems.length === 0 || subtotal <= 0) {
      return;
    }

    // Strict owner rule:
    // Actual Profit = actual registered sold value - registered purchase cost.
    // MRP is NEVER used. Quick Items are excluded completely.
    const realisedRevenueFactor = Math.max(
      0,
      Math.min(1, finalPayable / subtotal),
    );

    const registeredItems = cartItems.filter(
      (item) =>
        !item.isQuickItem &&
        item.purchasePriceKnown === true &&
        toNumber(item.purchasePrice) > 0 &&
        item.quantity > 0,
    );

    if (registeredItems.length === 0) {
      return;
    }

    const summary = registeredItems.reduce(
      (current, item) => {
        const quantity = Math.max(0, item.quantity);
        const purchasePrice = Math.max(
          0,
          toNumber(item.purchasePrice),
        );
        const actualSellingPrice = Math.max(
          0,
          item.price * realisedRevenueFactor,
        );

        current.registeredUnits += quantity;
        current.registeredRevenue +=
          actualSellingPrice * quantity;
        current.purchaseCost +=
          purchasePrice * quantity;

        return current;
      },
      {
        registeredUnits: 0,
        registeredRevenue: 0,
        purchaseCost: 0,
      },
    );

    const actualProfit =
      summary.registeredRevenue - summary.purchaseCost;

    const marginPercent =
      summary.registeredRevenue > 0
        ? (actualProfit / summary.registeredRevenue) * 100
        : 0;

    const { error } = await supabase.rpc(
      "ncs_create_pre_bill_profit_alert",
      {
        p_invoice_number: previewReference,
        p_registered_revenue: Number(
          summary.registeredRevenue.toFixed(2),
        ),
        p_registered_purchase_cost: Number(
          summary.purchaseCost.toFixed(2),
        ),
        p_bill_profit: Number(actualProfit.toFixed(2)),
        p_margin_percent: Number(marginPercent.toFixed(2)),
        p_final_bill_amount: Number(finalPayable.toFixed(2)),
        p_registered_item_count: summary.registeredUnits,
      },
    );

    if (error) {
      throw error;
    }
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

    const lossSaleAlerts = ownerProfitAlerts.filter(
      (alert) => alert.level === "LOSS_SALE"
    );

    if (lossSaleAlerts.length > 0) {
      const confirmed = window.confirm(
        `${lossSaleAlerts.length} item(s) are below purchase cost after discounts / rewards / round-off.\n\nContinue this sale anyway?`
      );

      if (!confirmed) {
        showNotice(
          "Sale paused by Owner Guard. Review selling price / discount.",
          "info"
        );
        return;
      }
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

      // OWNER PRE-BILL PUSH:
      // Send the owner a profit/loss preview BEFORE complete_pos_sale.
      // This is informational only. It never asks for approval and never
      // blocks billing if the push/RPC has a temporary problem.
      if (isBrowserOnline()) {
        try {
          await sendPreBillOwnerProfitPreview(
            `PRE-${clientTransactionId}`,
          );
        } catch (preBillAlertError) {
          console.info(
            "Pre-bill owner profit preview could not be sent. Billing will continue:",
            preBillAlertError,
          );
        }
      }

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

        if (activeHeldBillId) {
          removeHeldBillById(activeHeldBillId);
          setActiveHeldBillId(null);
        }

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

      let designSyncWarning = "";
      const soldDesignItems = cartItems
        .filter((item) => !item.isQuickItem && Boolean(item.designUnitId) && Boolean(item.variantId))
        .map((item) => ({
          sale_id: result.sale_id ? String(result.sale_id) : null,
          product_id: item.productId,
          variant_id: item.variantId,
          design_unit_id: item.designUnitId,
          quantity: item.quantity,
        }));

      if (soldDesignItems.length > 0) {
        try {
          const { data: designData, error: designError } = await supabase.rpc(
            "ncs_mark_pos_designs_sold_v1",
            { p_items: soldDesignItems },
          );
          if (designError) throw designError;
          const designResult = (designData || {}) as { success?: boolean; message?: string };
          if (designResult.success === false) {
            throw new Error(designResult.message || "Design stock could not be updated.");
          }
          await loadDesignChoices();
        } catch (designError) {
          console.error("Sale completed, but exact design online status update failed:", designError);
          designSyncWarning = designError instanceof Error ? designError.message : "Exact design online status update failed.";
        }
      }

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

        /*
         * IMPORTANT:
         * pos_sales is protected by RLS. A browser-side UPDATE can be silently
         * filtered to zero rows even when Supabase returns no SQL error.
         * Use the tiny SECURITY DEFINER helper below so ONLY paid/due/status
         * for this already-created sale are corrected. Stock, items, rewards,
         * customer credit creation, WhatsApp, printing and all other POS
         * behaviour remain untouched.
         */
        const { data: creditAmountResult, error: creditAmountError } =
          await supabase.rpc(
            "ncs_set_pos_sale_credit_amounts_v1",
            {
              p_sale_id: saleId,
              p_paid_amount: safeCreditPaidNow,
              p_due_amount: creditDueAmount,
            },
          );

        if (creditAmountError) {
          throw new Error(
            `Credit paid/due could not be saved: ${creditAmountError.message}`,
          );
        }

        const creditAmountPayload =
          (creditAmountResult || {}) as {
            success?: boolean;
            message?: string;
          };

        if (creditAmountPayload.success === false) {
          throw new Error(
            creditAmountPayload.message ||
              "Credit paid/due could not be saved.",
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

      if (activeHeldBillId) {
        removeHeldBillById(activeHeldBillId);
        setActiveHeldBillId(null);
      }

      // Owner-only post-bill profit summary.
      // MRP is never used and Quick Items are excluded.
      await saveCompletedBillProfitSummary(saleSnapshot);

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
        designSyncWarning ? `Design warning: ${designSyncWarning}` : "",
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
    <main
      className={`ncsPosPage ${
        cartItems.length > 0 && !billFocusCollapsed
          ? "ncsPosBillingFocus"
          : ""
      }`}
    >
      {designPickerProduct && typeof document !== "undefined" && createPortal(
        <div className="ncsPosDesignPickerBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDesignPickerProduct(null); }}>
          <section className="ncsPosDesignPicker" role="dialog" aria-modal="true" aria-label="Select sold design">
            <header>
              <div>
                <span>COMMON BARCODE • ONE TAP</span>
                <h2>Select the item you are selling</h2>
                <p>{designPickerProduct.name}{designPickerProduct.size ? ` • Size ${designPickerProduct.size}` : ""}{designPickerProduct.barcode ? ` • ${designPickerProduct.barcode}` : ""}</p>
              </div>
              <button type="button" onClick={() => setDesignPickerProduct(null)} aria-label="Close design picker">×</button>
            </header>
            <div className="ncsPosDesignPickerBatches">
              {groupPosDesignChoicesByPurchase(
                (
                  designChoicesByVariant[
                    String(designPickerProduct.variantId || "")
                  ] || []
                ).filter(
                  (choice) =>
                    !cartItems.some(
                      (item) =>
                        item.variantId === designPickerProduct.variantId &&
                        item.designUnitId === choice.designUnitId,
                    ),
                ),
              ).map((batch, batchIndex) => (
                <section
                  key={batch.key}
                  className={`ncsPosDesignBatch ${
                    batchIndex === 0 ? "isLatest" : ""
                  }`}
                >
                  <div className="ncsPosDesignBatchHeader">
                    <div>
                      <span>
                        {batchIndex === 0 && batch.key !== "__unbatched__"
                          ? "LATEST PURCHASE"
                          : batch.key === "__unbatched__"
                            ? "OLDER / UNLINKED"
                            : "PREVIOUS PURCHASE"}
                      </span>
                      <strong>{batch.title}</strong>
                      <small>{batch.subtitle}</small>
                    </div>
                    <b>{batch.choices.length} photos</b>
                  </div>

                  <div className="ncsPosDesignPickerGrid">
                    {batch.choices.map((choice, index) => (
                      <button
                        key={`${choice.mappingId}-${choice.designUnitId}`}
                        type="button"
                        className="ncsPosDesignChoice"
                        onClick={() => selectPosDesign(choice)}
                      >
                        <div className="ncsPosDesignChoiceImage">
                          {choice.imageUrl ? (
                            <img
                              src={choice.imageUrl}
                              alt={choice.designName}
                            />
                          ) : (
                            <span>NCS</span>
                          )}
                          <b>{index + 1}</b>
                        </div>
                        <strong>{choice.designName}</strong>
                        <small>
                          {choice.mrp > 0
                            ? `Offline MRP ₹${choice.mrp.toLocaleString("en-IN")}`
                            : "Offline MRP uses base variant MRP"}
                        </small>
                        <small>
                          Tap this photo if this is the item at the counter
                        </small>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div
              style={{
                margin: "14px 16px 4px",
                padding: "14px",
                borderRadius: "16px",
                border: "1px solid rgba(10,46,115,0.16)",
                background:
                  "linear-gradient(135deg, rgba(248,244,236,0.98), rgba(255,255,255,0.98))",
              }}
            >
              <button
                type="button"
                onClick={selectPosOfflinePiece}
                style={{
                  width: "100%",
                  border: "1px solid rgba(212,175,55,0.78)",
                  borderRadius: "14px",
                  padding: "14px 16px",
                  cursor: "pointer",
                  background:
                    "linear-gradient(135deg, #03153F 0%, #0A2E73 68%, #164CA8 100%)",
                  color: "#FFFFFF",
                  textAlign: "left",
                  boxShadow: "0 8px 20px rgba(10,46,115,0.18)",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    color: "#D4AF37",
                    fontSize: "14px",
                    fontWeight: 900,
                    letterSpacing: "0.4px",
                  }}
                >
                  OTHER / OFFLINE PIECE
                </strong>
                <small
                  style={{
                    display: "block",
                    marginTop: "5px",
                    color: "rgba(255,255,255,0.82)",
                    fontSize: "11px",
                    lineHeight: 1.45,
                  }}
                >
                  Customer bought a different physical piece. Reduce normal
                  stock only — do not hide any online photo.
                </small>
              </button>
            </div>

            <footer>
              <span>
                Tap a photo only when that exact photographed design is being
                sold. Otherwise use OTHER / OFFLINE PIECE.
              </span>
            </footer>
          </section>
        </div>,
        document.body,
      )}

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

      <section className="ncsPosHeader">
        <div>
          <span className="ncsPosEyebrow">
            <i
              className={`ncsPosCloudDot ${
                isOnline
                  ? pendingOfflineBills > 0
                    ? "pending"
                    : "online"
                  : "offline"
              }`}
              title={
                isOnline
                  ? pendingOfflineBills > 0
                    ? `${pendingOfflineBills} bill(s) waiting to sync`
                    : "Online"
                  : "Offline mode"
              }
              onClick={
                isOnline && pendingOfflineBills > 0 && !syncingOfflineBills
                  ? () => void syncOfflineBillsNow()
                  : undefined
              }
            />
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
            className={`ncsPosOwnerSummaryButton ${showOwnerSummary ? "active" : ""}`}
            onClick={() => setShowOwnerSummary((current) => !current)}
            aria-expanded={showOwnerSummary}
            title="Show owner-only sales and credit summary"
          >
            <span>◉</span>
            Owner Summary
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

        {showOwnerSummary &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="ncsPosOwnerSummaryLayer"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setShowOwnerSummary(false);
                }
              }}
            >
              <div
                className="ncsPosOwnerSummaryPopover"
                role="dialog"
                aria-modal="true"
                aria-label="Owner sales and credit summary"
              >
                <button
                  type="button"
                  className="ncsPosOwnerSummaryClose"
                  onClick={() => setShowOwnerSummary(false)}
                  aria-label="Close owner summary"
                >
                  ×
                </button>

                <div className="ncsPosOwnerSummaryTitle">
                  <span>OWNER VIEW</span>
                  <strong>Business Summary</strong>
                  <small>Tap Owner Summary again or × to hide these figures.</small>
                </div>

                <div className="ncsPosOwnerSummaryGrid">
                  <article className="ncsPosOwnerMetric">
                    <span>TODAY&apos;S SALES</span>
                    <strong>{loadingOverview ? "Loading..." : formatCurrency(posOverview.todaySales)}</strong>
                    <small>{posOverview.todayBills} bill{posOverview.todayBills === 1 ? "" : "s"} today</small>
                    <div>
                      <em>Cash <b>{formatCurrency(posOverview.todayCash)}</b></em>
                      <em>UPI / Card <b>{formatCurrency(posOverview.todayDigital)}</b></em>
                    </div>
                  </article>

                  <article className="ncsPosOwnerMetric ncsPosOwnerMetricCredit">
                    <span>CUSTOMER CREDIT</span>
                    <strong>{loadingOverview ? "Loading..." : formatCurrency(posOverview.customerCredit)}</strong>
                    <small>{posOverview.creditCustomers} customer{posOverview.creditCustomers === 1 ? "" : "s"} pending</small>
                    <div>
                      <em>Live dues <b>{posOverview.creditCustomers}</b></em>
                    </div>
                  </article>
                </div>
              </div>
            </div>,
            document.body
          )}
      </section>

      <section className="ncsPosQuickStats ncsPosQuickStatsLegacy" aria-label="POS live summary">
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
          className="ncsPosAiMascotRunner ncsPosAiRealCoupleLauncher"
          onClick={() => setPosAiExpanded((current) => !current)}
          aria-label={posAiExpanded ? "Close NCS AI Billing Assistant" : "Open NCS AI Billing Assistant"}
          aria-expanded={posAiExpanded}
        >
          <span className="ncsPosPremiumAiButton" aria-hidden="true">
            <span className="ncsPosPremiumAiSpark">✦</span>
            <span className="ncsPosPremiumAiCopy">
              <b>Ask NCS AI</b>
              <small>Billing Assistant</small>
            </span>
            <span className="ncsPosPremiumAiArrow">›</span>
          </span>
        </button>

        {posAiExpanded && (
          <button
            type="button"
            className="ncsPosAiCompactToggle"
            onClick={() => setPosAiExpanded(false)}
            aria-expanded={posAiExpanded}
          >
            <div className="ncsPosAiHeading">
              <div className="ncsPosAiBadge">✦</div>

              <div>
                <strong>NCS AI Billing Assistant</strong>
                <small>
                  Add, edit, discount, stock, customer and payment commands.
                </small>
              </div>
            </div>

            <div className="ncsPosAiCompactRight">
              <span className="ncsPosAiLiveDot" />
              <b>Close</b>
              <em>⌃</em>
            </div>
          </button>
        )}

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
                                    const accepted =
                                      addPhysicalPieceWithTagMrp(product);

                                    if (accepted) {
                                      setExpandedProductId(null);
                                      setExpandedBrand(null);
                                    }
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
                      onAddVariant={addPhysicalPieceWithTagMrp}
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
                      onAddVariant={addPhysicalPieceWithTagMrp}
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
              {cartItems.length > 0 && (
                <>
                  <button
                    type="button"
                    className="ncsPosBillAddNextItem"
                    onClick={() => {
                      setBillFocusCollapsed(true);
                      window.setTimeout(() => {
                        searchInputRef.current?.focus();
                        searchInputRef.current?.select();
                      }, 120);
                    }}
                    title="Return to products and add the next item"
                  >
                    ＋ Products
                  </button>

                  <button
                    type="button"
                    className="ncsPosBillQuickItem"
                    onClick={openQuickItem}
                    title="Add an unregistered quick item without leaving the bill"
                  >
                    ⚡ Quick Item
                  </button>

                  {billFocusCollapsed && (
                    <button
                      type="button"
                      className="ncsPosBillExpandButton"
                      onClick={() => setBillFocusCollapsed(false)}
                      title="Expand the current bill"
                    >
                      ⛶ Expand Bill
                    </button>
                  )}
                </>
              )}

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
                className="ncsPosBillQueueButton"
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

          <div className="ncsPosCustomerCard ncsPosCustomerCardCompact">
            <div className="ncsPosCustomerCompactRow">
              <div className="ncsPosCustomerMiniLabel" title="Customer details">
                <span>👤</span>
                <strong>Customer</strong>
              </div>

              <input
                ref={customerNameInputRef}
                className="ncsPosCustomerCompactName"
                value={customerName}
                onChange={(event) =>
                  setCustomerName(event.target.value)
                }
                placeholder="Customer name"
              />

              <input
                ref={customerPhoneInputRef}
                className="ncsPosCustomerCompactPhone"
                value={customerPhone}
                onChange={(event) =>
                  setCustomerPhone(
                    event.target.value.replace(/[^0-9+]/g, "")
                  )
                }
                placeholder="Mobile number"
                inputMode="tel"
              />

              <label className="ncsPosWhatsAppInline">
                <input
                  type="checkbox"
                  checked={customerWhatsAppOptIn}
                  onChange={(event) =>
                    setCustomerWhatsAppOptIn(event.target.checked)
                  }
                />
                <span>WhatsApp Offers</span>
              </label>
            </div>

            {(customerDueLoading || currentCustomerDue > 0) && (
              <div
                className={`ncsPosCustomerDueAlert ${
                  currentCustomerDue > 0 ? "due" : "checking"
                }`}
              >
                <span>{customerDueLoading ? "…" : "₹"}</span>
                <div>
                  <strong>
                    {customerDueLoading
                      ? "Checking customer due..."
                      : `Existing Due ${formatCurrency(currentCustomerDue)}`}
                  </strong>
                  {!customerDueLoading && currentCustomerDue > 0 && (
                    <small>
                      Previous balance is still pending. New billing can continue.
                    </small>
                  )}
                </div>
              </div>
            )}

            {(rewardLookupLoading || rewardCustomerFound) && (
              <div className="ncsPosRewardLookup ncsPosRewardLookupCompact">
                {rewardLookupLoading ? (
                  <span>Checking rewards...</span>
                ) : (
                  <>
                    <div>
                      <span>Rewards</span>
                      <strong>{availableRewardPoints} points available</strong>
                    </div>

                    <label>
                      <span>Use</span>
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
                                Math.max(0, toNumber(event.target.value)),
                              ),
                            ),
                          )
                        }
                        placeholder="0"
                      />
                    </label>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="ncsPosCartTableHeader" aria-hidden="true">
            <span>Item</span>
            <span>MRP</span>
            <span>Size</span>
            <span>Colour</span>
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
                  className={`ncsPosCartItem ncsPosCartItemTableRow ${
                    lastAddedItemKey === item.key ? "ncsPosLastAddedItem" : ""
                  }`}
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

                      {item.designUnitId && (
                        <span className="ncsPosCartDesignName">
                          ◉ {item.designName || `Design ${item.designUnitId}`}
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

                      {!item.isQuickItem &&
                        Math.max(0, item.stock - item.quantity) <= 2 && (
                          <span className="ncsPosLowStockBadge">
                            {Math.max(0, item.stock - item.quantity) === 0
                              ? "LAST PIECE IN BILL"
                              : `${Math.max(0, item.stock - item.quantity)} LEFT AFTER BILL`}
                          </span>
                        )}
                    </div>
                  </div>

                  <div className="ncsPosTableMoneyCell">
                    <span className="ncsPosMobileCellLabel">MRP</span>
                    <strong>{formatCurrency(item.mrp)}</strong>
                  </div>

                  <div className="ncsPosVariantMiniCell">
                    <span className="ncsPosMobileCellLabel">Size</span>
                    <strong>{item.size || "—"}</strong>
                  </div>

                  <div className="ncsPosVariantMiniCell">
                    <span className="ncsPosMobileCellLabel">Colour</span>
                    <strong>{item.color || "—"}</strong>
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

                  <div className="ncsPosRowActions">
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
                  </div>
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

          </div>

          <div className="ncsPosCounterIntelligence">
            <div className="ncsPosShortcutStrip">
              <span><b>F2</b> Search</span>
              <span><b>F4</b> Quick Item</span>
              <span><b>F6</b> Customer</span>
              <span><b>F7</b> Phone</span>
              <span><b>F8</b> Queue</span>
              <span><b>F9</b> Hold</span>
              <span><b>F10</b> Complete</span>
            </div>

            {ownerProfitAlerts.length > 0 && (
              <div
                className={`ncsPosOwnerGuardStrip ${
                  ownerProfitAlerts.some((alert) => alert.level === "LOSS_SALE")
                    ? "danger"
                    : "warning"
                }`}
              >
                <span>🛡</span>
                <div>
                  <strong>
                    Owner Guard • {ownerProfitAlerts.length} price alert
                    {ownerProfitAlerts.length === 1 ? "" : "s"}
                  </strong>
                  <small>
                    {ownerProfitAlerts.some((alert) => alert.level === "LOSS_SALE")
                      ? "At least one item is below purchase cost after all discounts."
                      : `Margin below ${ownerBusinessSettings.minimum_profit_margin_percent}% target.`}
                  </small>
                </div>
              </div>
            )}

            {activeHeldBillId && (
              <div className="ncsPosActiveQueueNotice">
                <span>👥</span>
                <div>
                  <strong>Resumed Queue Customer</strong>
                  <small>
                    This customer remains protected in Queue until the sale completes.
                  </small>
                </div>
              </div>
            )}
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

              <button
                type="button"
                className="ncsPosCompleteButton ncsPosCompleteButtonInline"
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
                <b>{isCompletingSale ? "⌛" : "→"}</b>
              </button>
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
              <div className="ncsPosQuickItemGrid ncsPosQuickSingleLine">
                <label className="ncsPosQuickNameField">
                  <span>Item Name *</span>
                  <input
                    ref={quickItemNameInputRef}
                    autoFocus
                    value={quickItemForm.name}
                    placeholder="Item name"
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
                        "Men", "Women", "Kids", "Sarees", "Shirts", "Jeans",
                        "Kurtis", "Innerwear", "Others",
                        ...categories.filter((item) => item !== "All"),
                      ]),
                    ).map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Qty *</span>
                  <input
                    type="number" min="1" step="1"
                    value={quickItemForm.quantity > 0 ? quickItemForm.quantity : ""}
                    placeholder="Qty"
                    onChange={(event) => {
                      const rawValue = event.target.value;
                      setQuickItemForm((current) => ({
                        ...current,
                        quantity: rawValue === "" ? 0 : Math.max(1, Math.floor(Number(rawValue) || 1)),
                      }));
                    }}
                  />
                </label>

                <label>
                  <span>MRP *</span>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={quickItemForm.mrp || ""}
                    placeholder="MRP"
                    onChange={(event) => setQuickItemForm((current) => ({
                      ...current, mrp: Math.max(0, Number(event.target.value) || 0),
                    }))}
                  />
                </label>

                <label>
                  <span>Purchase</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={quickItemForm.purchasePrice || ""}
                    placeholder="Cost"
                    onChange={(event) => setQuickItemForm((current) => ({
                      ...current, purchasePrice: Math.max(0, Number(event.target.value) || 0),
                    }))}
                  />
                </label>

                <label>
                  <span>GST %</span>
                  <input
                    type="number" min="0" max="100" step="0.01"
                    value={quickItemForm.taxPercent || ""}
                    placeholder="0"
                    onChange={(event) => setQuickItemForm((current) => ({
                      ...current, taxPercent: Math.max(0, Number(event.target.value) || 0),
                    }))}
                  />
                </label>

                <label className="ncsPosQuickKeepInline">
                  <span>Keep</span>
                  <input
                    type="checkbox"
                    checked={quickItemForm.saveAsProduct}
                    onChange={(event) => setQuickItemForm((current) => ({
                      ...current, saveAsProduct: event.target.checked,
                    }))}
                    title="Keep this item in Product Catalogue"
                  />
                </label>

                <button type="submit" className="ncsPosQuickStageButton">
                  ＋ Add Row
                </button>
              </div>

              {quickItemForm.saveAsProduct && (
                <label className="ncsPosQuickRemaining ncsPosQuickRemainingInline">
                  <span>Remaining Stock After Bill</span>
                  <input
                    type="number" min="0" step="1"
                    value={quickItemForm.remainingStock}
                    onChange={(event) => setQuickItemForm((current) => ({
                      ...current, remainingStock: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                    }))}
                  />
                </label>
              )}

              <div className="ncsPosQuickDraftArea">
                <div className="ncsPosQuickDraftHeader">
                  <strong>Quick Items</strong>
                  <span>{quickDraftItems.length} ready</span>
                </div>
                {quickDraftItems.length === 0 ? (
                  <div className="ncsPosQuickDraftEmpty">Enter an item above and press + Add Row.</div>
                ) : (
                  <div className="ncsPosQuickDraftRows">
                    {quickDraftItems.map((item, index) => (
                      <div className="ncsPosQuickDraftRow" key={item.key}>
                        <b>{String(index + 1).padStart(2, "0")}</b>
                        <strong title={item.name}>{item.name}</strong>
                        <span>{item.category}</span>
                        <span>Qty {item.quantity}</span>
                        <span>MRP {formatCurrency(item.mrp)}</span>
                        <span>{item.quickPurchasePrice ? `Cost ${formatCurrency(item.quickPurchasePrice)}` : "Cost —"}</span>
                        <span>GST {item.taxPercent || 0}%</span>
                        <span>{item.quickSaveAsProduct ? "Keep ✓" : "Bill only"}</span>
                        <button
                          type="button"
                          onClick={() => removeQuickDraftItem(item.key)}
                          aria-label={`Remove ${item.name} from Quick Items`}
                          title="Remove row"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <footer>
                <button
                  type="button"
                  className="ncsPosQuickCancel"
                  onClick={() => { setQuickDraftItems([]); setShowQuickItem(false); }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="ncsPosQuickAdd"
                  onClick={commitQuickItemsToBill}
                  disabled={quickDraftItems.length === 0}
                >
                  <span>✓</span>
                  Add {quickDraftItems.length || ""} to Bill
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

                        {heldBill.customerPhone && (
                          <span>📱 {heldBill.customerPhone}</span>
                        )}

                        <span>
                          {heldBill.paymentMethod.toUpperCase()}
                        </span>

                        {activeHeldBillId === heldBill.id && (
                          <span className="ncsPosHeldActiveBadge">
                            ACTIVE • PROTECTED
                          </span>
                        )}
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


      {festivalOffer && (
        <aside
          className={`ncsPosFestivalOffer ${festivalOffer.className} ${festivalOfferCorner}`}
          role="status"
          aria-live="polite"
        >
          <button
            type="button"
            className="ncsPosFestivalOfferClose"
            onClick={() => setFestivalOffer(null)}
            aria-label="Close festival offer"
            title="Close offer"
          >
            ×
          </button>

          <div className="ncsPosFestivalOfferTopline">
            <span>NEW CITY STYLE</span>
            <i>FESTIVAL OFFER</i>
          </div>

          <div className="ncsPosFestivalOfferBody">
            <strong>{festivalOffer.discount}%</strong>
            <section>
              <b>OFF</b>
              <h3>{festivalOffer.title}</h3>
              <p>{festivalOffer.subtitle}</p>
            </section>
          </div>

          <footer>
            <span>Selected styles only</span>
            <b>5 SEC</b>
          </footer>
        </aside>
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
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 7px;
          color: ${GOLD};
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.7px;
        }

        .ncsPosCloudDot {
          width: 9px;
          height: 9px;
          flex: 0 0 9px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12), 0 0 12px rgba(34, 197, 94, 0.65);
        }

        .ncsPosCloudDot.pending {
          background: #f4b400;
          box-shadow: 0 0 0 4px rgba(244, 180, 0, 0.12), 0 0 12px rgba(244, 180, 0, 0.6);
          cursor: pointer;
        }

        .ncsPosCloudDot.offline {
          background: #ef4444;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.12), 0 0 12px rgba(239, 68, 68, 0.55);
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

        /* NCS AI now floats in the corner so it does not consume POS page space. */
        .ncsPosAiPanel {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 2500;
          width: min(480px, calc(100vw - 32px));
          max-height: min(72vh, 680px);
          margin: 0;
          overflow: auto;
          box-shadow:
            0 22px 60px rgba(3, 21, 63, 0.22),
            0 4px 16px rgba(3, 21, 63, 0.10);
        }

        .ncsPosAiPanel.collapsed {
          left: 0;
          right: auto;
          bottom: 12px;
          width: 210px;
          max-width: none;
          max-height: none;
          padding: 0;
          overflow: visible;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          animation: ncsAiMascotWalkAcross 20s linear infinite;
          will-change: transform;
        }

        .ncsPosAiPanel.collapsed::before {
          display: none;
        }

        .ncsPosAiPanel.collapsed:hover,
        .ncsPosAiPanel.collapsed:focus-within {
          animation-play-state: paused;
        }

        .ncsPosAiMascotRunner {
          width: 210px;
          min-height: 68px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 5px 8px;
          border: 0;
          background: transparent;
          cursor: pointer;
          font-family: inherit;
          filter: drop-shadow(0 8px 12px rgba(3, 21, 63, 0.18));
        }

        .ncsPosAiMascotCharacter {
          display: flex;
          align-items: flex-end;
          gap: 0;
          transform-origin: 50% 100%;
          animation: ncsAiMascotStep .62s ease-in-out infinite alternate;
        }

        .ncsPosAiMascotPerson {
          display: block;
          font-size: 37px;
          line-height: 1;
          transform: translateX(5px);
        }

        .ncsPosAiMascotCart {
          display: block;
          font-size: 34px;
          line-height: 1;
          transform: translateY(3px);
        }

        .ncsPosAiMascotBubble {
          min-width: 66px;
          padding: 7px 10px;
          border: 1px solid rgba(212, 175, 55, 0.72);
          border-radius: 14px 14px 14px 4px;
          background: linear-gradient(145deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: #ffffff;
          text-align: left;
          box-shadow: 0 8px 20px rgba(3, 21, 63, 0.18);
        }

        .ncsPosAiMascotBubble b {
          display: block;
          color: ${GOLD};
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .05em;
        }

        .ncsPosAiMascotBubble small {
          display: block;
          margin-top: 1px;
          color: #ffffff;
          font-size: 8px;
          font-weight: 800;
        }

        .ncsPosAiPanel.expanded {
          border-radius: 20px;
        }

        @keyframes ncsAiMascotWalkAcross {
          0% {
            transform: translateX(calc(100vw + 30px));
          }
          100% {
            transform: translateX(-235px);
          }
        }

        @keyframes ncsAiMascotStep {
          from {
            transform: translateY(0) rotate(-1deg);
          }
          to {
            transform: translateY(-4px) rotate(1deg);
          }
        }

        /* COMPACT OWNER-ONLY BUSINESS SUMMARY: keeps billing workspace open */
        .ncsPosQuickStatsLegacy {
          display: none !important;
        }

        .ncsPosOwnerSummaryButton {
          min-height: 45px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 14px;
          border: 1px solid rgba(212, 175, 55, 0.58);
          border-radius: 12px;
          background: rgba(3, 21, 63, 0.5);
          color: #ffffff;
          font-family: inherit;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
        }

        .ncsPosOwnerSummaryButton:hover,
        .ncsPosOwnerSummaryButton.active {
          transform: translateY(-1px);
          border-color: ${GOLD};
          background: rgba(212, 175, 55, 0.16);
          color: #ffffff;
        }

        .ncsPosOwnerSummaryButton > span {
          color: ${GOLD};
          font-size: 12px;
        }

        .ncsPosOwnerSummaryLayer {
          position: fixed;
          inset: 0;
          z-index: 12000;
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
          padding: 92px 24px 24px;
          background: rgba(3, 21, 63, 0.12);
          backdrop-filter: blur(2px);
        }

        .ncsPosOwnerSummaryPopover {
          position: relative;
          z-index: 1;
          width: min(560px, calc(100vw - 48px));
          padding: 15px;
          border: 1px solid rgba(212, 175, 55, 0.55);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.995);
          color: ${DEEP_BLUE};
          box-shadow: 0 24px 70px rgba(3, 21, 63, 0.34);
          animation: ncsPosOwnerSummaryIn 0.18s ease-out both;
        }

        .ncsPosOwnerSummaryClose {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 9px;
          background: #eef3fb;
          color: ${ROYAL_BLUE};
          font-size: 20px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsPosOwnerSummaryTitle {
          padding: 2px 40px 11px 2px;
        }

        .ncsPosOwnerSummaryTitle span,
        .ncsPosOwnerSummaryTitle strong,
        .ncsPosOwnerSummaryTitle small {
          display: block;
        }

        .ncsPosOwnerSummaryTitle span {
          color: #9a7414;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .ncsPosOwnerSummaryTitle strong {
          margin-top: 3px;
          color: ${DEEP_BLUE};
          font-size: 16px;
          font-weight: 950;
        }

        .ncsPosOwnerSummaryTitle small {
          margin-top: 3px;
          color: #74809a;
          font-size: 9px;
          font-weight: 700;
        }

        .ncsPosOwnerSummaryGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .ncsPosOwnerMetric {
          min-width: 0;
          padding: 13px 14px;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 14px;
          background: linear-gradient(145deg, #f8faff, #ffffff);
          box-shadow: 0 8px 20px rgba(10, 46, 115, 0.06);
        }

        .ncsPosOwnerMetricCredit {
          background: linear-gradient(145deg, #fffaf0, #ffffff);
        }

        .ncsPosOwnerMetric > span {
          display: block;
          color: #9a7414;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.08em;
        }

        .ncsPosOwnerMetric > strong {
          display: block;
          margin-top: 4px;
          color: ${ROYAL_BLUE};
          font-size: 20px;
          font-weight: 1000;
          letter-spacing: -0.4px;
        }

        .ncsPosOwnerMetric > small {
          display: block;
          margin-top: 2px;
          color: #7a8498;
          font-size: 9px;
          font-weight: 750;
        }

        .ncsPosOwnerMetric > div {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
        }

        .ncsPosOwnerMetric em {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 7px;
          border-radius: 8px;
          background: #eef3fb;
          color: #667085;
          font-size: 8px;
          font-style: normal;
          font-weight: 800;
        }

        .ncsPosOwnerMetric em b {
          color: ${DEEP_BLUE};
          font-size: 9px;
          font-weight: 950;
        }

        @keyframes ncsPosOwnerSummaryIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (max-width: 900px) {
          .ncsPosOwnerSummaryLayer {
            padding: 78px 14px 14px;
          }

          .ncsPosOwnerSummaryPopover {
            width: min(520px, calc(100vw - 28px));
          }
        }

        @media (max-width: 620px) {
          .ncsPosOwnerSummaryButton {
            flex: 1;
          }

          .ncsPosOwnerSummaryGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ncsPosAiPanel.collapsed {
            right: 18px;
            left: auto;
            animation: none;
            transform: none;
          }

          .ncsPosAiMascotCharacter {
            animation: none;
          }
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

        .ncsPosBillAddNextItem,
        .ncsPosBillQuickItem,
        .ncsPosBillExpandButton {
          min-height: 38px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid rgba(212, 175, 55, .72);
          font-size: 12px;
          font-weight: 950;
          white-space: nowrap;
          cursor: pointer;
          transition: transform .16s ease, box-shadow .16s ease, background .16s ease;
        }

        .ncsPosBillAddNextItem {
          background: #ffffff;
          color: ${DEEP_BLUE};
          box-shadow: 0 8px 20px rgba(3, 21, 63, .10);
        }

        .ncsPosBillQuickItem {
          background: linear-gradient(135deg, #f8df78, ${GOLD});
          color: ${DEEP_BLUE};
          box-shadow: 0 9px 22px rgba(212, 175, 55, .24);
        }

        .ncsPosBillExpandButton {
          background: rgba(255, 255, 255, .10);
          color: #ffffff;
        }

        .ncsPosBillAddNextItem:hover,
        .ncsPosBillQuickItem:hover,
        .ncsPosBillExpandButton:hover {
          transform: translateY(-1px);
        }

        .ncsPosBillingFocus .ncsPosBillHeader {
          position: sticky;
          top: 0;
          z-index: 30;
        }

        .ncsPosBillingFocus .ncsPosBillHeaderActions {
          flex-wrap: nowrap;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          max-width: 100%;
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
          left: 104px;
          width: auto;
          min-width: 0;
          max-width: none;
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
          left: 114px;
          width: auto;
          min-width: 0;
          border-radius: 28px;
          background: rgba(3, 21, 63, .08);
          filter: blur(18px);
          pointer-events: none;
        }

        @media (max-width: 1380px) {
          .ncsPosBillingFocus .ncsPosBillPanel {
            left: 96px;
            right: 8px;
            width: auto;
            min-width: 0;
          }

          .ncsPosBillingFocus .ncsPosBillPanel::after {
            left: 106px;
            right: 18px;
            width: auto;
            min-width: 0;
          }
        }

        @media (max-width: 1100px) {
          .ncsPosBillingFocus .ncsPosBillPanel {
            top: 8px !important;
            right: 8px;
            bottom: 8px;
            left: 88px;
            width: auto;
            min-width: 0;
            max-width: none;
          }

          .ncsPosBillingFocus .ncsPosBillPanel::after {
            display: none;
          }
        }

        @media (max-width: 760px) {
          .ncsPosAiPanel {
            right: 12px;
            bottom: 82px;
            width: calc(100vw - 24px);
            max-height: 66vh;
          }

          .ncsPosAiPanel.collapsed {
            width: auto;
            max-width: 178px;
          }

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

        /* Billing focus primary actions: keep text buttons readable and separate. */
        .ncsPosBillHeaderActions .ncsPosBillAddNextItem,
        .ncsPosBillHeaderActions .ncsPosBillQuickItem,
        .ncsPosBillHeaderActions .ncsPosBillExpandButton {
          width: auto !important;
          min-width: 118px;
          height: 40px !important;
          flex: 0 0 auto;
          padding: 0 16px !important;
          border-radius: 12px !important;
          font-size: 12px !important;
          line-height: 1 !important;
          font-weight: 950 !important;
          letter-spacing: .15px;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .ncsPosBillHeaderActions .ncsPosBillAddNextItem {
          border: 1px solid rgba(255,255,255,.34) !important;
          background: linear-gradient(135deg, #164ca8, #0a2e73) !important;
          color: #ffffff !important;
          box-shadow: 0 8px 20px rgba(3,21,63,.22);
        }

        .ncsPosBillHeaderActions .ncsPosBillQuickItem {
          border: 1px solid rgba(255,226,111,.9) !important;
          background: linear-gradient(135deg, #f6d960, #d4af37) !important;
          color: #03153f !important;
          box-shadow: 0 8px 20px rgba(212,175,55,.24);
        }

        .ncsPosBillHeaderActions .ncsPosBillExpandButton {
          min-width: 110px;
          border: 1px solid rgba(212,175,55,.7) !important;
          background: rgba(255,255,255,.10) !important;
          color: #ffffff !important;
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


        /* NCS 2026 COUNTER-COMPACT ITEM ROW + FESTIVAL CARD FINISH */
        .ncsPosCartTableHeader,
        .ncsPosCartItemTableRow {
          grid-template-columns: 300px 82px 112px 128px 102px minmax(118px, 1fr) 78px !important;
          gap: 7px !important;
        }

        .ncsPosCartTableHeader {
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        .ncsPosCartItemTableRow {
          min-height: 62px;
          padding: 7px 6px !important;
          overflow: visible !important;
        }

        .ncsPosCartProductCell {
          grid-template-columns: 38px minmax(0, 1fr) !important;
          gap: 7px !important;
        }

        .ncsPosCartThumbnail {
          width: 38px !important;
          height: 44px !important;
        }

        .ncsPosCartProductInfo {
          min-width: 0;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          column-gap: 6px;
          row-gap: 1px;
        }

        .ncsPosCartProductInfo .ncsPosItemSerial {
          grid-row: 1 / span 2;
          align-self: start;
          margin-top: 1px;
        }

        .ncsPosCartProductInfo h3 {
          grid-column: 2;
          margin: 0 !important;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10px !important;
        }

        .ncsPosCartBrandName,
        .ncsPosCartProductInfo p {
          grid-column: 2;
          margin: 0 !important;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsPosCartProductInfo p {
          display: inline-flex !important;
          flex-wrap: nowrap !important;
          gap: 5px !important;
          font-size: 7px !important;
        }

        .ncsPosQuickItemBadge {
          margin-left: 5px !important;
          padding: 1px 4px !important;
          font-size: 6px !important;
          vertical-align: 1px;
        }

        .ncsPosQuantityTableCell > div {
          grid-template-columns: 34px minmax(40px, 1fr) 34px !important;
          height: 36px !important;
          border: 1px solid rgba(10,46,115,.22) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 4px 10px rgba(10,46,115,.06);
        }

        .ncsPosQuantityTableCell button {
          width: 34px !important;
          height: 34px !important;
          font-size: 18px !important;
          line-height: 1 !important;
          font-weight: 950 !important;
        }

        .ncsPosQuantityTableCell button:first-child {
          background: linear-gradient(180deg, #eaf1ff, #d7e4fb) !important;
          color: #0a2e73 !important;
          border-right: 1px solid rgba(10,46,115,.12) !important;
        }

        .ncsPosQuantityTableCell button:last-child {
          background: linear-gradient(180deg, #f8df68, #d4af37) !important;
          color: #03153f !important;
          border-left: 1px solid rgba(146,118,17,.18) !important;
        }

        .ncsPosQuantityTableCell button:hover {
          filter: brightness(1.04);
          transform: translateY(-1px);
        }

        .ncsPosItemLineTotal {
          text-align: right;
          padding-right: 4px;
        }

        .ncsPosRowActions {
          width: 74px !important;
          min-width: 74px !important;
          display: grid !important;
          grid-template-columns: 30px 38px;
          justify-content: end !important;
          gap: 5px !important;
          cursor: default !important;
        }

        .ncsPosRemoveItem {
          width: 38px !important;
          height: 32px !important;
          display: inline-grid !important;
          place-items: center;
          border: 1px solid #8d1515 !important;
          border-radius: 10px !important;
          background: linear-gradient(145deg, #e14141, #9f1616) !important;
          color: #fff !important;
          font-size: 18px !important;
          font-weight: 950 !important;
          box-shadow: 0 7px 15px rgba(159,22,22,.22) !important;
        }

        .ncsPosRemoveItem:hover {
          background: linear-gradient(145deg, #f04b4b, #7c0d0d) !important;
          transform: translateY(-1px);
        }

        .ncsPosBillQueueButton {
          border-color: rgba(212,175,55,.92) !important;
          background: linear-gradient(145deg, #f6dc66, #d4af37) !important;
          color: #03153f !important;
          box-shadow: 0 8px 18px rgba(212,175,55,.20), inset 0 1px 0 rgba(255,255,255,.55) !important;
        }

        .ncsPosBillQueueButton:hover {
          filter: brightness(1.05);
          transform: translateY(-1px);
        }

        .ncsPosFestivalOffer {
          position: fixed;
          z-index: 10050;
          width: min(360px, calc(100vw - 30px));
          aspect-ratio: 1.586 / 1;
          max-height: 228px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.64);
          border-radius: 22px;
          color: #fff;
          box-shadow: 0 24px 70px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.40);
          animation: ncsFestivalCardIn .38s cubic-bezier(.2,.9,.25,1.1), ncsFestivalCardGlow 1.6s ease-in-out infinite alternate;
          backdrop-filter: blur(16px);
        }

        .ncsPosFestivalOffer.topLeft { top: 18px; left: 18px; }
        .ncsPosFestivalOffer.topRight { top: 18px; right: 18px; }
        .ncsPosFestivalOffer.bottomLeft { bottom: 18px; left: 18px; }
        .ncsPosFestivalOffer.bottomRight { bottom: 18px; right: 18px; }

        .ncsPosFestivalOffer.coral { background: radial-gradient(circle at 86% 14%, rgba(255,231,122,.92), transparent 28%), linear-gradient(135deg,#ff6a3d,#f02f68 52%,#8c1b73); }
        .ncsPosFestivalOffer.violet { background: radial-gradient(circle at 18% 15%, rgba(105,239,255,.72), transparent 30%), linear-gradient(135deg,#5c2dc5,#9837d8 48%,#ff4f98); }
        .ncsPosFestivalOffer.emerald { background: radial-gradient(circle at 83% 18%, rgba(255,234,113,.85), transparent 28%), linear-gradient(135deg,#0c9c73,#0e786c 52%,#124d67); }
        .ncsPosFestivalOffer.sunset { background: radial-gradient(circle at 20% 12%, rgba(255,244,171,.9), transparent 27%), linear-gradient(135deg,#ff9f1c,#ff5b35 48%,#de2b64); }
        .ncsPosFestivalOffer.aqua { background: radial-gradient(circle at 80% 18%, rgba(233,255,137,.82), transparent 28%), linear-gradient(135deg,#00a8cc,#087ca7 50%,#3f4bbb); }
        .ncsPosFestivalOffer.berry { background: radial-gradient(circle at 18% 12%, rgba(255,205,232,.75), transparent 27%), linear-gradient(135deg,#c52973,#812b82 52%,#451e68); }

        .ncsPosFestivalOffer::before,
        .ncsPosFestivalOffer::after {
          content: "";
          position: absolute;
          border-radius: 999px;
          background: rgba(255,255,255,.13);
          pointer-events: none;
        }

        .ncsPosFestivalOffer::before { width: 150px; height: 150px; right: -42px; bottom: -62px; }
        .ncsPosFestivalOffer::after { width: 86px; height: 86px; right: 28px; top: 40px; border: 1px solid rgba(255,255,255,.18); background: transparent; }

        .ncsPosFestivalOfferClose {
          position: absolute;
          z-index: 3;
          top: 10px;
          right: 10px;
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.55);
          border-radius: 50%;
          background: rgba(20,20,28,.25);
          color: #fff;
          font-size: 18px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsPosFestivalOfferTopline {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 16px 48px 8px 18px;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .12em;
        }

        .ncsPosFestivalOfferTopline i {
          padding: 5px 8px;
          border: 1px solid rgba(255,255,255,.42);
          border-radius: 999px;
          background: rgba(255,255,255,.14);
          font-style: normal;
          letter-spacing: .08em;
        }

        .ncsPosFestivalOfferBody {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 14px;
          padding: 4px 18px 10px;
        }

        .ncsPosFestivalOfferBody > strong {
          font-size: clamp(54px, 5vw, 72px);
          line-height: .9;
          letter-spacing: -.06em;
          text-shadow: 0 5px 20px rgba(0,0,0,.17);
        }

        .ncsPosFestivalOfferBody section > b {
          display: inline-block;
          margin-bottom: 3px;
          font-size: 18px;
          letter-spacing: .14em;
        }

        .ncsPosFestivalOfferBody h3 {
          margin: 0;
          font-size: 18px;
          line-height: 1.05;
        }

        .ncsPosFestivalOfferBody p {
          margin: 5px 0 0;
          color: rgba(255,255,255,.88);
          font-size: 10px;
          font-weight: 700;
        }

        .ncsPosFestivalOffer footer {
          position: absolute;
          z-index: 1;
          left: 18px;
          right: 18px;
          bottom: 13px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 8px;
          border-top: 1px solid rgba(255,255,255,.25);
          font-size: 8px;
          font-weight: 850;
        }

        .ncsPosFestivalOffer footer b {
          padding: 3px 6px;
          border-radius: 6px;
          background: rgba(255,255,255,.16);
          letter-spacing: .08em;
        }

        @keyframes ncsFestivalCardIn {
          from { opacity: 0; transform: translateY(18px) scale(.94) rotate(-1deg); }
          to { opacity: 1; transform: translateY(0) scale(1) rotate(0); }
        }

        @keyframes ncsFestivalCardGlow {
          from { box-shadow: 0 20px 55px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.36); }
          to { box-shadow: 0 26px 78px rgba(0,0,0,.36), inset 0 1px 0 rgba(255,255,255,.50); }
        }

        @media (max-width: 1220px) {
          .ncsPosCartTableHeader,
          .ncsPosCartItemTableRow {
            grid-template-columns: minmax(210px, 1fr) 76px 96px 118px 92px 106px 74px !important;
          }
        }

        @media (max-width: 820px) {
          .ncsPosCartItemTableRow {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .ncsPosCartProductInfo {
            display: block;
          }
          .ncsPosCartProductInfo .ncsPosItemSerial,
          .ncsPosCartProductInfo h3,
          .ncsPosCartBrandName,
          .ncsPosCartProductInfo p {
            display: block;
            grid-column: auto;
          }
          .ncsPosRowActions {
            grid-column: 1 / -1;
            justify-self: end;
          }
          .ncsPosFestivalOffer {
            width: min(330px, calc(100vw - 24px));
          }
          .ncsPosFestivalOffer.topLeft,
          .ncsPosFestivalOffer.topRight { top: 12px; left: 12px; right: auto; }
          .ncsPosFestivalOffer.bottomLeft,
          .ncsPosFestivalOffer.bottomRight { bottom: 12px; left: 12px; right: auto; }
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
          padding: 18px 24px;
          background: rgba(3, 21, 63, 0.74);
          backdrop-filter: blur(9px);
        }

        .ncsPosSuccessModal {
          width: min(760px, calc(100vw - 48px));
          max-height: calc(100vh - 36px);
          padding: 20px 24px 22px;
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
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 7px;
          border-radius: 50%;
          background: linear-gradient(135deg, #16894b, #27b56a);
          color: #ffffff;
          font-size: 26px;
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
          margin: 4px 0 3px;
          color: ${DEEP_BLUE};
          font-size: 23px;
          font-weight: 950;
        }

        .ncsPosSuccessCustomer {
          margin: 0;
          color: #737b89;
          font-size: 11px;
          font-weight: 650;
        }

        .ncsPosSuccessAmount {
          margin: 11px 0 9px;
          padding: 13px 16px;
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
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        .ncsPosSuccessSummary p {
          margin: 0;
          padding: 9px 10px;
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
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .ncsPosSuccessActions button {
          min-height: 42px;
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
            align-items: center;
            padding: 8px 14px;
          }

          .ncsPosSuccessModal {
            width: min(720px, calc(100vw - 28px));
            max-height: calc(100vh - 16px);
            padding: 14px 18px 18px;
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

        @media (max-width: 900px) {
          .ncsPosSuccessModal {
            width: min(680px, calc(100vw - 28px));
          }

          .ncsPosSuccessSummary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ncsPosSuccessActions {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 560px) {
          .ncsPosSuccessOverlay {
            padding: 8px;
          }

          .ncsPosSuccessModal {
            width: 100%;
            max-height: calc(100vh - 16px);
            padding: 16px 14px 18px;
          }

          .ncsPosSuccessSummary {
            grid-template-columns: 1fr 1fr;
          }

          .ncsPosSuccessActions {
            grid-template-columns: 1fr;
          }

          .ncsPosSuccessWhatsApp {
            grid-column: 1;
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

        /* Compact customer strip: keeps billing area open while preserving customer, WhatsApp and rewards. */
        .ncsPosCustomerCardCompact {
          padding: 8px 12px;
        }

        .ncsPosCustomerCompactRow {
          display: grid;
          grid-template-columns: auto minmax(180px, 1.1fr) minmax(150px, .8fr) auto;
          align-items: center;
          gap: 8px;
        }

        .ncsPosCustomerMiniLabel {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: ${DEEP_BLUE};
          white-space: nowrap;
        }

        .ncsPosCustomerMiniLabel > span {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: rgba(212, 175, 55, 0.15);
          font-size: 13px;
        }

        .ncsPosCustomerMiniLabel strong {
          font-size: 10px;
          font-weight: 950;
        }

        .ncsPosCustomerCompactRow > input {
          width: 100%;
          min-width: 0;
          height: 34px;
          padding: 0 10px;
          border: 1px solid #e1e6ee;
          border-radius: 9px;
          outline: none;
          background: #fff;
          color: ${CHARCOAL};
          font-family: inherit;
          font-size: 10px;
          font-weight: 700;
        }

        .ncsPosCustomerCompactRow > input:focus {
          border-color: ${GOLD};
          box-shadow: 0 0 0 3px rgba(212,175,55,.12);
        }

        .ncsPosWhatsAppInline {
          height: 34px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0 11px;
          border: 1px solid rgba(31, 157, 85, .28);
          border-radius: 9px;
          background: #f4fff8;
          color: #12683b;
          font-size: 9px;
          font-weight: 900;
          white-space: nowrap;
          cursor: pointer;
        }

        .ncsPosWhatsAppInline input {
          width: 16px;
          height: 16px;
          margin: 0;
          accent-color: #1f9d55;
        }

        .ncsPosRewardLookupCompact {
          margin-top: 6px;
          min-height: 34px;
          padding: 5px 8px;
          border-radius: 9px;
        }

        .ncsPosRewardLookupCompact div {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ncsPosRewardLookupCompact div span,
        .ncsPosRewardLookupCompact div strong {
          margin: 0;
          display: inline;
        }

        .ncsPosRewardLookupCompact div strong {
          font-size: 10px;
        }

        .ncsPosRewardLookupCompact label {
          min-width: 110px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ncsPosRewardLookupCompact label span {
          margin: 0;
          white-space: nowrap;
        }

        .ncsPosRewardLookupCompact input {
          width: 72px;
          min-height: 30px;
          height: 30px;
        }

        @media (max-width: 900px) {
          .ncsPosCustomerCompactRow {
            grid-template-columns: 1fr 1fr;
          }

          .ncsPosCustomerMiniLabel {
            grid-column: 1 / -1;
          }

          .ncsPosWhatsAppInline {
            grid-column: 1 / -1;
            justify-content: center;
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
          grid-template-columns: minmax(230px, 1.8fr) 92px 104px 132px 100px 120px 76px;
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
            grid-template-columns: minmax(205px, 1.65fr) 78px 92px 118px 88px 104px 72px;
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

        /* NCS COMPACT BILL ACTIONS + PREMIUM PAYMENT FINISH */
        .ncsPosRowActions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          min-width: 70px;
        }

        .ncsPosRowActions .ncsPosRemoveItem {
          width: 32px;
          height: 32px;
          flex: 0 0 32px;
          border: 1px solid #8f1d1d;
          border-radius: 9px;
          background: linear-gradient(145deg, #c82929 0%, #8f1515 100%);
          color: #fff;
          box-shadow: 0 5px 12px rgba(143, 21, 21, 0.22);
          font-size: 15px;
          font-weight: 950;
        }

        .ncsPosRowActions .ncsPosRemoveItem:hover {
          transform: translateY(-1px);
          box-shadow: 0 7px 16px rgba(143, 21, 21, 0.3);
        }

        .ncsPosTotalLine {
          border: 1px solid rgba(212, 175, 55, 0.9) !important;
          background:
            radial-gradient(circle at 88% 18%, rgba(255,255,255,.22), transparent 18%),
            linear-gradient(112deg, #03153f 0%, #0a2e73 48%, #164ca8 78%, #d4af37 150%) !important;
          box-shadow: 0 10px 24px rgba(10, 46, 115, 0.2), inset 0 1px 0 rgba(255,255,255,.13) !important;
        }

        .ncsPosTotalLine span,
        .ncsPosTotalLine small,
        .ncsPosTotalLine strong {
          color: #fff !important;
        }

        .ncsPosTotalLine > div > span {
          color: #f5d96a !important;
          font-weight: 950 !important;
          letter-spacing: .02em;
        }

        .ncsPosPaymentButton {
          position: relative;
          overflow: hidden;
          min-height: 56px;
          border: 1px solid rgba(212,175,55,.55) !important;
          border-radius: 13px !important;
          background:
            linear-gradient(180deg, rgba(255,255,255,.13), rgba(255,255,255,0) 42%),
            linear-gradient(135deg, #0a2e73 0%, #123f91 55%, #08245f 100%) !important;
          color: #fff !important;
          box-shadow: 0 8px 18px rgba(10,46,115,.16), inset 0 1px 0 rgba(255,255,255,.18);
          font-weight: 900 !important;
          transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
        }

        .ncsPosPaymentButton::after {
          content: "";
          position: absolute;
          inset: 0 auto 0 -45%;
          width: 36%;
          transform: skewX(-18deg);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent);
          transition: left .35s ease;
          pointer-events: none;
        }

        .ncsPosPaymentButton:hover {
          transform: translateY(-2px);
          border-color: #f0cd54 !important;
          box-shadow: 0 11px 24px rgba(10,46,115,.24), 0 0 0 1px rgba(212,175,55,.12);
        }

        .ncsPosPaymentButton:hover::after {
          left: 120%;
        }

        .ncsPosPaymentButton span {
          color: #f4d15d !important;
          font-size: 15px !important;
        }

        .ncsPosPaymentButton.ncsPosPaymentActive {
          border-color: #b78c10 !important;
          background:
            linear-gradient(180deg, rgba(255,255,255,.38), rgba(255,255,255,0) 42%),
            linear-gradient(135deg, #f5d85c 0%, #d4af37 52%, #b9870e 100%) !important;
          color: #03153f !important;
          box-shadow: 0 10px 22px rgba(212,175,55,.34), inset 0 1px 0 rgba(255,255,255,.55);
        }

        .ncsPosPaymentButton.ncsPosPaymentActive span {
          color: #03153f !important;
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
            grid-template-columns: repeat(8, minmax(0, 1fr)) !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            padding: 10px 12px !important;
            gap: 7px !important;
          }

          .ncsPosDiscountField,
          .ncsPosRoundOffField {
            grid-column: span 1 !important;
            min-height: 48px !important;
            padding: 7px 8px !important;
          }

          .ncsPosSummaryLine {
            min-height: 48px !important;
            padding: 7px 8px !important;
          }

          .ncsPosSummaryLine span,
          .ncsPosDiscountField > span,
          .ncsPosRoundOffField > span {
            font-size: 7px !important;
            line-height: 1.15 !important;
          }

          .ncsPosSummaryLine strong {
            font-size: 11px !important;
          }

          .ncsPosDiscountField > div,
          .ncsPosRoundOffField > div {
            min-height: 31px !important;
            height: 31px !important;
          }

          .ncsPosRoundOffLine {
            display: none !important;
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
            min-height: 68px !important;
            margin-top: 2px !important;
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


        /* QUICK ITEM — wide, low-height counter layout */
        .ncsPosQuickItemModal {
          width: min(980px, calc(100vw - 36px)) !important;
          max-height: min(640px, calc(100vh - 34px)) !important;
          border-radius: 22px !important;
          overflow-y: auto !important;
        }

        .ncsPosQuickItemModal > header {
          padding: 13px 18px !important;
          align-items: center !important;
        }

        .ncsPosQuickItemModal > header h2 {
          margin-top: 2px !important;
          font-size: 21px !important;
        }

        .ncsPosQuickItemModal > header p {
          margin-top: 4px !important;
          max-width: 760px !important;
          font-size: 11px !important;
          line-height: 1.35 !important;
        }

        .ncsPosQuickItemModal > header::after {
          right: 76px !important;
          bottom: -24px !important;
          font-size: 58px !important;
        }

        .ncsPosQuickItemModal > header > button {
          width: 34px !important;
          height: 34px !important;
          font-size: 21px !important;
        }

        .ncsPosQuickItemModal form {
          padding: 16px 18px 14px !important;
        }

        .ncsPosQuickItemGrid {
          grid-template-columns: 2fr 1.15fr .8fr 1fr !important;
          gap: 11px 12px !important;
          align-items: end !important;
        }

        .ncsPosQuickWide {
          grid-column: span 2 !important;
        }

        .ncsPosQuickItemGrid label,
        .ncsPosQuickRemaining {
          gap: 5px !important;
        }

        .ncsPosQuickItemGrid label > span,
        .ncsPosQuickRemaining > span {
          font-size: 11px !important;
        }

        .ncsPosQuickItemGrid input,
        .ncsPosQuickItemGrid select,
        .ncsPosQuickRemaining input {
          min-height: 42px !important;
          padding: 0 12px !important;
          border-radius: 10px !important;
          font-size: 13px !important;
        }

        .ncsPosQuickSaveToggle {
          margin-top: 12px !important;
          padding: 10px 12px !important;
          align-items: center !important;
        }

        .ncsPosQuickSaveToggle input {
          width: 18px !important;
          height: 18px !important;
          margin-top: 0 !important;
        }

        .ncsPosQuickSaveToggle span {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          flex-wrap: wrap !important;
        }

        .ncsPosQuickSaveToggle strong {
          font-size: 12px !important;
        }

        .ncsPosQuickSaveToggle small {
          font-size: 9px !important;
        }

        .ncsPosQuickRemaining {
          margin-top: 10px !important;
          padding: 10px 12px !important;
          grid-template-columns: 230px 180px 1fr !important;
          align-items: center !important;
        }

        .ncsPosQuickInfo {
          margin-top: 10px !important;
          padding: 9px 12px !important;
          font-size: 10px !important;
          line-height: 1.35 !important;
        }

        .ncsPosQuickItemModal footer {
          position: sticky !important;
          bottom: -14px !important;
          z-index: 4 !important;
          display: flex !important;
          justify-content: flex-end !important;
          align-items: center !important;
          gap: 10px !important;
          margin: 12px -18px -14px !important;
          padding: 11px 18px !important;
          border-top: 1px solid rgba(10, 46, 115, .10) !important;
          background: rgba(255,255,255,.96) !important;
          backdrop-filter: blur(10px) !important;
        }

        .ncsPosQuickCancel,
        .ncsPosQuickAdd {
          min-width: 150px !important;
          min-height: 42px !important;
          padding: 0 18px !important;
          border-radius: 10px !important;
          font-size: 13px !important;
        }

        .ncsPosQuickCancel {
          border-color: rgba(10,46,115,.20) !important;
          color: #0a2e73 !important;
        }

        .ncsPosQuickAdd {
          background: linear-gradient(135deg, #d4af37, #f0cf5d) !important;
          border-color: #d4af37 !important;
          color: #03153f !important;
          box-shadow: 0 10px 22px rgba(212,175,55,.24) !important;
        }

        @media (max-width: 900px) {
          .ncsPosQuickItemModal {
            width: min(760px, calc(100vw - 24px)) !important;
            max-height: calc(100vh - 20px) !important;
          }

          .ncsPosQuickItemGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .ncsPosQuickWide {
            grid-column: 1 / -1 !important;
          }

          .ncsPosQuickRemaining {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 560px) {
          .ncsPosQuickItemGrid {
            grid-template-columns: 1fr !important;
          }

          .ncsPosQuickWide {
            grid-column: auto !important;
          }

          .ncsPosQuickItemModal footer {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
          }

          .ncsPosQuickCancel,
          .ncsPosQuickAdd {
            min-width: 0 !important;
            width: 100% !important;
          }
        }



        /* NCS 2026 QUICK BATCH + COMPACT BILL ROW + STATIC 3D AI */
        .ncsPosQuickItemModal {
          width: min(1380px, calc(100vw - 32px)) !important;
          max-height: min(720px, calc(100vh - 28px)) !important;
        }

        .ncsPosQuickItemModal > header p {
          max-width: 980px !important;
        }

        .ncsPosQuickSingleLine {
          display: grid !important;
          grid-template-columns: minmax(260px, 2.2fr) minmax(120px, .95fr) 80px 105px 115px 88px 64px 112px !important;
          gap: 9px !important;
          align-items: end !important;
        }

        .ncsPosQuickSingleLine label { min-width: 0 !important; }
        .ncsPosQuickNameField { grid-column: auto !important; }
        .ncsPosQuickSingleLine input,
        .ncsPosQuickSingleLine select {
          width: 100% !important;
          min-width: 0 !important;
          min-height: 40px !important;
        }

        .ncsPosQuickKeepInline {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 5px !important;
        }
        .ncsPosQuickKeepInline input {
          width: 22px !important;
          height: 22px !important;
          min-height: 22px !important;
          accent-color: #d4af37;
        }

        .ncsPosQuickStageButton {
          min-height: 40px;
          border: 1px solid #d4af37;
          border-radius: 10px;
          background: linear-gradient(135deg, #0a2e73, #164ca8);
          color: #fff;
          font: inherit;
          font-size: 11px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(10,46,115,.18);
        }

        .ncsPosQuickRemainingInline {
          margin-top: 9px !important;
          display: grid !important;
          grid-template-columns: 220px 150px !important;
          justify-content: start !important;
          gap: 10px !important;
        }

        .ncsPosQuickDraftArea {
          margin-top: 12px;
          border: 1px solid rgba(10,46,115,.12);
          border-radius: 13px;
          overflow: hidden;
          background: #f7f9fd;
        }
        .ncsPosQuickDraftHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 11px;
          background: linear-gradient(90deg, #03153f, #0a2e73);
          color: #fff;
          font-size: 10px;
        }
        .ncsPosQuickDraftHeader span { color: #f2d45b; font-weight: 900; }
        .ncsPosQuickDraftEmpty { padding: 14px; color: #778195; font-size: 10px; text-align: center; }
        .ncsPosQuickDraftRows { max-height: 230px; overflow: auto; }
        .ncsPosQuickDraftRow {
          display: grid;
          grid-template-columns: 34px minmax(180px,1.65fr) 110px 72px 115px 118px 82px 92px 38px;
          gap: 7px;
          align-items: center;
          min-height: 42px;
          padding: 6px 9px;
          border-top: 1px solid rgba(10,46,115,.08);
          background: #fff;
          color: #39465b;
          font-size: 9px;
        }
        .ncsPosQuickDraftRow > b { color: #a68416; }
        .ncsPosQuickDraftRow > strong { color: #03153f; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ncsPosQuickDraftRow > button {
          width: 30px; height: 30px; border: 0; border-radius: 8px;
          background: linear-gradient(145deg,#cf3030,#8f1515); color: #fff;
          font-size: 16px; font-weight: 950; cursor: pointer;
        }
        .ncsPosQuickAdd:disabled { opacity: .45; cursor: not-allowed; box-shadow: none !important; }

        /* Product column is deliberately compact; price/qty/actions get cleaner room. */
        .ncsPosCartTableHeader,
        .ncsPosCartItemTableRow {
          grid-template-columns: minmax(250px, 320px) 84px 112px 138px 108px 122px 82px !important;
          justify-content: space-between;
          column-gap: 10px !important;
        }
        .ncsPosCartProductInfo h3 {
          max-width: 215px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ncsPosQuantityTableCell > div {
          grid-template-columns: 38px minmax(44px,1fr) 38px !important;
          height: 36px !important;
        }
        .ncsPosQuantityTableCell button {
          width: 38px !important; height: 36px !important;
          background: #0a2e73 !important; color: #fff !important;
          font-size: 16px !important;
        }
        .ncsPosQuantityTableCell button:last-child {
          background: linear-gradient(135deg,#f1d15c,#d4af37) !important;
          color: #03153f !important;
        }
        .ncsPosRowActions {
          display: grid !important;
          grid-template-columns: 34px 38px !important;
          gap: 6px !important;
          min-width: 78px !important;
          justify-content: end !important;
        }
        .ncsPosOwnerCostButton {
          width: 34px !important; height: 32px !important; min-width: 34px !important;
          position: static !important; transform: none !important; margin: 0 !important;
        }
        .ncsPosRowActions .ncsPosRemoveItem {
          width: 38px !important; height: 32px !important; flex-basis: 38px !important;
          position: static !important; transform: none !important; margin: 0 !important;
        }

        /* Static 3D NCS AI mascot in the right corner; only the eyes/bubble animate. */
        .ncsPosAiPanel.collapsed {
          left: auto !important;
          right: 18px !important;
          bottom: 18px !important;
          width: 150px !important;
          animation: none !important;
          transform: none !important;
        }
        .ncsPosAiPanel.collapsed:hover,
        .ncsPosAiPanel.collapsed:focus-within { animation: none !important; }
        .ncsPosAiMascotRunner { width: 150px !important; min-height: 104px !important; gap: 4px !important; align-items: flex-end !important; }
        .ncsPosAi3dMascot {
          position: relative; width: 68px; height: 96px; display: block;
          filter: drop-shadow(0 12px 13px rgba(3,21,63,.28));
        }
        .ncsPosAi3dHead {
          position: absolute; left: 12px; top: 2px; width: 44px; height: 42px;
          border-radius: 47% 47% 44% 44%;
          background: radial-gradient(circle at 35% 24%, #fff5df 0 8%, #e7b78d 34%, #a55f3f 100%);
          box-shadow: inset -6px -7px 10px rgba(80,32,18,.24), inset 4px 4px 9px rgba(255,255,255,.5);
          z-index: 3;
        }
        .ncsPosAi3dHead::before {
          content:""; position:absolute; left:3px; right:3px; top:-4px; height:15px;
          border-radius:50% 50% 38% 38%; background:linear-gradient(135deg,#1b2232,#06080d);
        }
        .ncsPosAiEye {
          position:absolute; top:19px; width:5px; height:6px; border-radius:50%; background:#111827;
          animation:ncsAiBlink 4.2s infinite; transform-origin:center;
        }
        .ncsPosAiEye.left { left:12px; } .ncsPosAiEye.right { right:12px; }
        .ncsPosAiSmile {
          position:absolute; left:17px; top:29px; width:11px; height:5px;
          border-bottom:2px solid #7c352c; border-radius:0 0 12px 12px;
        }
        .ncsPosAi3dBody {
          position:absolute; left:7px; top:37px; width:54px; height:48px;
          border-radius:18px 18px 10px 10px;
          background:linear-gradient(145deg,#1d58b8 0%,#0a2e73 48%,#03153f 100%);
          box-shadow:inset 6px 5px 11px rgba(255,255,255,.14), inset -8px -8px 12px rgba(0,0,0,.25);
        }
        .ncsPosAi3dBody::before, .ncsPosAi3dBody::after {
          content:""; position:absolute; top:7px; width:9px; height:34px; border-radius:9px; background:#d4af37;
        }
        .ncsPosAi3dBody::before { left:-5px; transform:rotate(13deg); }
        .ncsPosAi3dBody::after { right:-5px; transform:rotate(-13deg); }
        .ncsPosAiTie {
          position:absolute; left:24px; top:7px; width:7px; height:24px;
          clip-path:polygon(50% 0,100% 22%,70% 100%,30% 100%,0 22%); background:#d4af37;
        }
        .ncsPosAi3dBase {
          position:absolute; left:11px; bottom:0; width:46px; height:19px; display:flex; align-items:center; justify-content:center;
          border-radius:8px 8px 12px 12px; background:linear-gradient(145deg,#f0d062,#b98e14);
          color:#03153f; font-size:9px; font-weight:1000; letter-spacing:.08em; box-shadow:0 5px 10px rgba(3,21,63,.2);
        }
        .ncsPosAiMascotBubble {
          position:absolute !important; right:64px !important; top:4px !important; min-width:72px;
          padding:7px 9px !important; border-radius:12px 12px 3px 12px !important;
          background:#fff !important; border:1px solid rgba(212,175,55,.7) !important;
          box-shadow:0 8px 18px rgba(3,21,63,.16) !important;
          animation:ncsAiAskBubble 7s ease-in-out infinite !important;
        }
        .ncsPosAiMascotBubble b { color:#0a2e73 !important; font-size:10px !important; }
        .ncsPosAiMascotBubble small { color:#a17c13 !important; font-size:7px !important; }
        @keyframes ncsAiBlink { 0%,45%,49%,100%{transform:scaleY(1)} 46%,48%{transform:scaleY(.08)} }
        @keyframes ncsAiAskBubble { 0%,12%,48%,100%{opacity:0;transform:translateY(4px) scale(.94)} 18%,40%{opacity:1;transform:translateY(0) scale(1)} }

        @media (max-width: 1100px) {
          .ncsPosQuickSingleLine { grid-template-columns: repeat(4,minmax(0,1fr)) !important; }
          .ncsPosQuickNameField { grid-column: span 2 !important; }
          .ncsPosQuickDraftRow { grid-template-columns: 30px minmax(140px,1fr) 80px 60px 90px 34px; }
          .ncsPosQuickDraftRow > span:nth-of-type(n+5) { display:none; }
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


        /* NCS POS final polish */
        .ncsPosQuickDraftRow { min-height:48px !important; font-size:11px !important; font-weight:800 !important; letter-spacing:.01em; }
        .ncsPosQuickDraftRow > b { font-size:10px !important; font-weight:1000 !important; }
        .ncsPosQuickDraftRow > strong { font-size:12px !important; font-weight:1000 !important; color:#03153f !important; }
        .ncsPosQuickDraftRow > span { font-size:10px !important; font-weight:850 !important; color:#334155 !important; }
        .ncsPosQuickDraftRow > button { width:34px !important; height:32px !important; font-size:18px !important; font-weight:1000 !important; }

        .ncsPosCartTableHeader,
        .ncsPosCartItemTableRow { grid-template-columns:minmax(230px,300px) 84px 112px 138px 108px minmax(104px,1fr) 100px !important; }
        .ncsPosRowActions { position:relative !important; inset:auto !important; display:flex !important; align-items:center !important; justify-content:flex-end !important; gap:10px !important; width:100px !important; min-width:100px !important; overflow:visible !important; }
        .ncsPosRowActions .ncsPosOwnerCostButton,
        .ncsPosRowActions .ncsPosRemoveItem { position:relative !important; inset:auto !important; left:auto !important; right:auto !important; top:auto !important; bottom:auto !important; transform:none !important; margin:0 !important; flex:0 0 auto !important; z-index:2 !important; }
        .ncsPosRowActions .ncsPosOwnerCostButton { width:38px !important; min-width:38px !important; height:34px !important; border:1px solid rgba(212,175,55,.78) !important; border-radius:10px !important; background:#fffaf0 !important; color:#0a2e73 !important; font-size:16px !important; }
        .ncsPosRowActions .ncsPosRemoveItem { width:44px !important; min-width:44px !important; height:34px !important; border:1px solid #8d1111 !important; border-radius:10px !important; background:linear-gradient(145deg,#d92f2f,#a91414) !important; color:#fff !important; font-size:19px !important; box-shadow:0 5px 12px rgba(185,28,28,.20) !important; }

        .ncsPosAiPanel.collapsed { position:fixed !important; left:auto !important; right:18px !important; bottom:18px !important; width:220px !important; height:142px !important; z-index:17050 !important; animation:none !important; transform:none !important; pointer-events:auto !important; }
        .ncsPosAiMascotRunner { position:relative !important; width:220px !important; min-height:142px !important; display:block !important; overflow:visible !important; border:0 !important; background:transparent !important; box-shadow:none !important; cursor:pointer !important; }
        .ncsPosAi3dMascot,.ncsPosAi3dHead,.ncsPosAi3dBody,.ncsPosAi3dBase { display:none !important; }
        .ncsPosAiCoupleMascot { position:absolute; right:4px; bottom:0; width:132px; height:138px; filter:drop-shadow(0 10px 12px rgba(3,21,63,.24)); }
        .ncsPosAiManFigure,.ncsPosAiWomanFigure { position:absolute; bottom:14px; width:58px; height:122px; }
        .ncsPosAiManFigure { left:3px; } .ncsPosAiWomanFigure { right:3px; }
        .ncsPosAiPersonHead { position:absolute; top:0; left:13px; width:34px; height:36px; display:block; border-radius:47% 47% 45% 45%; background:radial-gradient(circle at 34% 24%,#fff0d6 0 9%,#d99b6d 38%,#975239 100%); box-shadow:inset -5px -5px 9px rgba(70,30,18,.20),inset 3px 3px 6px rgba(255,255,255,.42); z-index:5; }
        .ncsPosAiPersonHead::before { content:""; position:absolute; left:2px; right:2px; top:-4px; height:14px; border-radius:55% 55% 38% 38%; background:linear-gradient(145deg,#161616,#050505); }
        .ncsPosAiPersonHead.woman::before { left:-1px; right:-1px; height:20px; border-radius:60% 60% 48% 48%; box-shadow:0 8px 0 -5px #080808; }
        .ncsPosAiPersonHead.woman::after { content:""; position:absolute; left:16px; top:6px; width:3px; height:3px; border-radius:50%; background:#b91c1c; z-index:7; }
        .ncsPosAiPersonHead .ncsPosAiEye { top:17px !important; width:4px !important; height:5px !important; background:#111827 !important; animation:ncsAiBlink 4.2s infinite !important; }
        .ncsPosAiPersonHead .ncsPosAiEye.left { left:9px !important; } .ncsPosAiPersonHead .ncsPosAiEye.right { right:9px !important; }
        .ncsPosAiPersonHead .ncsPosAiSmile { left:12px !important; top:26px !important; width:10px !important; height:4px !important; border-bottom:2px solid #7c352c !important; }
        .ncsPosAiManShirt { position:absolute; left:7px; top:32px; width:46px; height:48px; border-radius:13px 13px 7px 7px; background:linear-gradient(145deg,#fff 0%,#f6f2e9 58%,#d8d3c8 100%); box-shadow:inset -5px -5px 8px rgba(3,21,63,.10),inset 4px 4px 8px rgba(255,255,255,.8); z-index:3; }
        .ncsPosAiManShirt::before,.ncsPosAiManShirt::after { content:""; position:absolute; top:5px; width:10px; height:38px; border-radius:8px; background:linear-gradient(#d99b6d,#b8714e); z-index:-1; }
        .ncsPosAiManShirt::before { left:-6px; transform:rotate(8deg); } .ncsPosAiManShirt::after { right:-6px; transform:rotate(-8deg); }
        .ncsPosAiManPancha { position:absolute; left:8px; bottom:4px; width:44px; height:48px; border-radius:3px 3px 8px 8px; background:linear-gradient(90deg,#fffdf7 0 45%,#e2bd3e 45% 51%,#fffdf7 51% 100%); border-bottom:5px solid #d4af37; box-shadow:inset -5px 0 8px rgba(3,21,63,.07); }
        .ncsPosAiWomanBlouse { position:absolute; left:10px; top:34px; width:40px; height:34px; border-radius:12px 12px 5px 5px; background:linear-gradient(145deg,#a4143d,#6f0b2b); box-shadow:inset 4px 4px 7px rgba(255,255,255,.12); z-index:3; }
        .ncsPosAiWomanSaree { position:absolute; left:4px; bottom:3px; width:52px; height:69px; clip-path:polygon(25% 0,78% 0,100% 100%,0 100%); background:linear-gradient(135deg,#153f9d 0 58%,#0a2e73 58% 72%,#d4af37 72% 78%,#1550ae 78% 100%); border-bottom:5px solid #d4af37; box-shadow:inset -8px -7px 10px rgba(3,21,63,.18); z-index:2; }
        .ncsPosAiWomanSaree::before { content:""; position:absolute; left:3px; top:6px; width:35px; height:14px; border-radius:8px; background:linear-gradient(135deg,#1d58b8,#d4af37); transform:rotate(-18deg); }
        .ncsPosAiCoupleBase { position:absolute; left:25px; bottom:0; width:82px; height:20px; display:grid; place-items:center; border-radius:8px 8px 12px 12px; background:linear-gradient(145deg,#f3d35e,#b98e14); color:#03153f; font-size:9px; font-weight:1000; letter-spacing:.14em; box-shadow:0 5px 10px rgba(3,21,63,.18); z-index:8; }
        .ncsPosAiMascotBubble.alwaysVisible { position:absolute !important; right:118px !important; top:28px !important; min-width:96px !important; display:block !important; opacity:1 !important; visibility:visible !important; transform:none !important; animation:none !important; padding:9px 10px !important; border:1px solid rgba(212,175,55,.88) !important; border-radius:14px 14px 4px 14px !important; background:linear-gradient(145deg,#fff,#fff9e8) !important; box-shadow:0 8px 18px rgba(3,21,63,.15) !important; text-align:left !important; }
        .ncsPosAiMascotBubble.alwaysVisible b { display:block; color:#0a2e73 !important; font-size:11px !important; font-weight:1000 !important; }
        .ncsPosAiMascotBubble.alwaysVisible small { display:block; margin-top:2px; color:#9b7a12 !important; font-size:8px !important; font-weight:850 !important; }

        /* NCS POS 2026 final counter polish: realistic persistent AI couple + spacious actions */
        .ncsPosAiPanel .ncsPosAiRealCoupleLauncher {
          position: fixed !important;
          right: 14px !important;
          bottom: 14px !important;
          left: auto !important;
          top: auto !important;
          width: 170px !important;
          height: 220px !important;
          min-height: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          border-radius: 22px !important;
          background: transparent !important;
          box-shadow: none !important;
          overflow: visible !important;
          z-index: 19050 !important;
          cursor: pointer !important;
          transform: none !important;
          animation: none !important;
        }
        .ncsPosAiRealCoupleImage {
          position:absolute; right:0; bottom:0; width:154px; height:auto; display:block;
          border-radius:22px 22px 18px 18px;
          filter:drop-shadow(0 16px 24px rgba(3,21,63,.28));
          pointer-events:none; user-select:none;
        }
        .ncsPosAiRealCouplePulse {
          position:absolute; right:9px; bottom:9px; width:12px; height:12px; border-radius:999px;
          background:#22c55e; border:3px solid #fff; box-shadow:0 0 0 0 rgba(34,197,94,.45);
          animation:ncsRealAiPulse 2.2s ease-out infinite;
        }
        @keyframes ncsRealAiPulse { 0%{box-shadow:0 0 0 0 rgba(34,197,94,.46)} 70%{box-shadow:0 0 0 11px rgba(34,197,94,0)} 100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} }
        .ncsPosAiPanel.expanded .ncsPosAiRealCoupleLauncher { display:block !important; opacity:1 !important; visibility:visible !important; pointer-events:auto !important; }

        .ncsPosBillHeader h2 {
          display:inline-flex !important; align-items:center; justify-content:center; min-width:92px;
          margin-top:4px !important; padding:6px 12px !important; border-radius:12px !important;
          background:linear-gradient(135deg,#f7d75b,#d4af37) !important; color:#03153f !important;
          border:1px solid rgba(255,255,255,.45); box-shadow:0 6px 16px rgba(212,175,55,.20);
          font-size:16px !important; font-weight:1000 !important; line-height:1 !important;
        }

        .ncsPosCartTableHeader,
        .ncsPosCartItemTableRow {
          grid-template-columns:minmax(230px,280px) 78px 112px 138px 108px minmax(104px,1fr) 126px !important;
        }
        .ncsPosRowActions { width:126px !important; min-width:126px !important; gap:12px !important; padding-right:4px !important; }
        .ncsPosRowActions .ncsPosOwnerCostButton { width:42px !important; min-width:42px !important; height:36px !important; }
        .ncsPosRowActions .ncsPosRemoveItem { width:50px !important; min-width:50px !important; height:36px !important; }

        .ncsPosQuickDraftRow { min-height:50px !important; }
        .ncsPosQuickDraftRow > b { font-size:12px !important; font-weight:1000 !important; }
        .ncsPosQuickDraftRow > strong { font-size:14px !important; font-weight:1000 !important; color:#03153f !important; }
        .ncsPosQuickDraftRow > span { font-size:12px !important; font-weight:950 !important; color:#1e293b !important; }

        /* ATM-card-like colourful rotating festival creatives */
        .ncsPosFestivalOffer {
          width:min(338px,calc(100vw - 28px)) !important; max-height:none !important; border-radius:18px !important;
          border:2px solid rgba(255,255,255,.72) !important; transform:rotate(-2deg);
          box-shadow:0 22px 55px rgba(3,21,63,.34),0 0 0 4px rgba(255,255,255,.13) inset !important;
          overflow:hidden !important; isolation:isolate;
        }
        .ncsPosFestivalOffer::before {
          content:"✦  ◆  ●  ✦  ▲  ◆  ✦" !important; position:absolute !important; inset:0 !important; width:auto !important; height:auto !important;
          padding:18px !important; border-radius:0 !important; background:repeating-linear-gradient(120deg,transparent 0 32px,rgba(255,255,255,.08) 32px 35px) !important;
          color:rgba(255,255,255,.42) !important; font-size:16px; letter-spacing:22px; transform:rotate(7deg) scale(1.15); z-index:0;
        }
        .ncsPosFestivalOffer::after {
          content:"" !important; position:absolute !important; right:-40px !important; top:-55px !important; width:180px !important; height:180px !important;
          border:20px solid rgba(255,255,255,.13) !important; border-radius:50% !important; background:transparent !important; z-index:0;
        }
        .ncsPosFestivalOfferTopline,.ncsPosFestivalOfferBody,.ncsPosFestivalOffer footer { position:relative !important; z-index:2 !important; }
        .ncsPosFestivalOfferBody > strong { color:#fff36a !important; -webkit-text-stroke:1px rgba(3,21,63,.18); text-shadow:0 5px 18px rgba(0,0,0,.24) !important; }
        .ncsPosFestivalOfferBody h3 { font-size:20px !important; font-weight:1000 !important; text-transform:uppercase; }
        .ncsPosFestivalOfferClose { z-index:5 !important; background:#111827 !important; border:2px solid #fff !important; box-shadow:0 5px 12px rgba(0,0,0,.24) !important; }



        /* NCS POS 2026 animated South Indian AI couple + variant columns */
        .ncsPosCartTableHeader,
        .ncsPosCartItemTableRow {
          grid-template-columns:
            minmax(220px,1.6fr) 76px 70px 90px 112px 138px 108px minmax(116px,.9fr) 126px !important;
          column-gap:10px !important;
        }
        .ncsPosVariantMiniCell {
          min-width:0; height:36px; display:flex; align-items:center; justify-content:center;
          padding:0 8px; border:1px solid #d9e2ef; border-radius:10px;
          background:linear-gradient(180deg,#ffffff,#f7f9fc); color:#0a2e73;
        }
        .ncsPosVariantMiniCell strong {
          display:block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
          font-size:11px; font-weight:950; text-align:center;
        }
        .ncsPosItemLineTotal strong {
          display:inline-flex !important; align-items:center; justify-content:center;
          min-width:84px; min-height:34px; padding:6px 10px !important;
          border-radius:10px !important; color:#fff !important;
          background:linear-gradient(145deg,#1f9d55,#0f7a3a) !important;
          border:1px solid rgba(255,255,255,.55) !important;
          box-shadow:0 6px 14px rgba(15,122,58,.20) !important;
          font-size:12px !important; font-weight:1000 !important;
        }
        .ncsPosItemLineTotal small { margin-top:4px !important; color:#15803d !important; font-weight:900 !important; }

        .ncsPosAiRealCoupleImage { display:none !important; }
        .ncsPosAiPanel .ncsPosAiRealCoupleLauncher {
          width:210px !important; height:210px !important; right:14px !important; bottom:12px !important;
          overflow:visible !important; background:transparent !important;
        }
        .ncsPosAiAnimatedCouple {
          position:absolute; right:0; bottom:0; width:172px; height:198px;
          filter:drop-shadow(0 14px 20px rgba(3,21,63,.24));
          animation:ncsCoupleFloat 3.8s ease-in-out infinite;
          transform-origin:50% 100%; pointer-events:none;
        }
        @keyframes ncsCoupleFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        .ncsPosAiAnimatedMan,.ncsPosAiAnimatedWoman {
          position:absolute; bottom:24px; width:74px; height:154px;
          animation:ncsPersonBreathe 3.2s ease-in-out infinite; transform-origin:50% 100%;
        }
        .ncsPosAiAnimatedMan { left:9px; }
        .ncsPosAiAnimatedWoman { right:8px; animation-delay:.35s; }
        @keyframes ncsPersonBreathe { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(1.018)} }
        .ncsPosAiAnimatedHead {
          position:absolute; left:20px; top:0; width:38px; height:43px; z-index:7;
          border-radius:48% 48% 44% 44%;
          background:radial-gradient(circle at 34% 24%,#ffe8cd 0 12%,#d99a6c 44%,#98543c 100%);
          box-shadow:inset -5px -5px 8px rgba(70,30,18,.18),inset 4px 4px 7px rgba(255,255,255,.35);
        }
        .ncsPosAiAnimatedHead::before {
          content:""; position:absolute; left:0; right:0; top:-5px; height:17px;
          border-radius:58% 58% 38% 38%; background:linear-gradient(145deg,#171717,#020202);
        }
        .ncsPosAiAnimatedHead.woman::before { height:22px; left:-3px; right:-3px; border-radius:60% 60% 50% 50%; }
        .ncsPosAiAnimatedHead .eye {
          position:absolute; top:20px; width:4px; height:5px; border-radius:50%; background:#111827;
          animation:ncsAiBlink 4.1s infinite; transform-origin:center;
        }
        .ncsPosAiAnimatedHead .eye.left { left:10px; } .ncsPosAiAnimatedHead .eye.right { right:10px; }
        .ncsPosAiAnimatedHead .smile {
          position:absolute; left:14px; top:30px; width:11px; height:5px; border-bottom:2px solid #7c352c; border-radius:50%;
        }
        .ncsPosAiAnimatedHead .bindi {
          position:absolute; left:18px; top:13px; width:3px; height:3px; border-radius:50%; background:#b91c1c; z-index:8;
        }
        .ncsPosAiAnimatedShirt {
          position:absolute; left:12px; top:39px; width:56px; height:58px; z-index:4; border-radius:16px 16px 8px 8px;
          background:linear-gradient(145deg,#fff 0%,#f5f1e8 64%,#d4cec2 100%);
          box-shadow:inset -6px -6px 9px rgba(3,21,63,.08),inset 5px 5px 9px rgba(255,255,255,.8);
        }
        .ncsPosAiAnimatedPancha {
          position:absolute; left:14px; bottom:0; width:52px; height:66px; z-index:2; border-radius:4px 4px 9px 9px;
          background:linear-gradient(90deg,#fffdf7 0 44%,#d4af37 44% 50%,#fffdf7 50% 100%);
          border-bottom:6px solid #d4af37;
        }
        .ncsPosAiAnimatedBlouse {
          position:absolute; left:14px; top:42px; width:52px; height:43px; z-index:4; border-radius:15px 15px 6px 6px;
          background:linear-gradient(145deg,#8b143a,#5c0827);
        }
        .ncsPosAiAnimatedSaree {
          position:absolute; left:6px; bottom:0; width:67px; height:96px; z-index:3;
          clip-path:polygon(25% 0,78% 0,100% 100%,0 100%);
          background:linear-gradient(135deg,#1f58ba 0 48%,#0a2e73 48% 66%,#d4af37 66% 72%,#1b4fa5 72% 100%);
          border-bottom:6px solid #d4af37;
        }
        .ncsPosAiAnimatedSaree::before {
          content:""; position:absolute; left:7px; top:8px; width:45px; height:17px; border-radius:10px;
          background:linear-gradient(135deg,#2b6bd0,#d4af37); transform:rotate(-18deg);
        }
        .ncsPosAiAnimatedArm {
          position:absolute; top:50px; width:12px; height:50px; border-radius:10px;
          background:linear-gradient(#d99a6c,#b56e4e); z-index:1; transform-origin:50% 10%;
        }
        .ncsPosAiAnimatedMan .armLeft { left:7px; transform:rotate(8deg); }
        .ncsPosAiAnimatedMan .armRight { right:7px; animation:ncsAiWave 2.8s ease-in-out infinite; }
        .ncsPosAiAnimatedWoman .armLeft { left:6px; transform:rotate(8deg); }
        .ncsPosAiAnimatedWoman .armRight { right:6px; transform:rotate(-8deg); }
        @keyframes ncsAiWave { 0%,55%,100%{transform:rotate(-7deg)} 65%{transform:rotate(-28deg)} 75%{transform:rotate(-4deg)} 84%{transform:rotate(-24deg)} }
        .ncsPosAiAnimatedBase {
          position:absolute; left:19px; bottom:0; width:134px; height:27px; display:grid; place-items:center; z-index:12;
          border-radius:10px 10px 14px 14px; background:linear-gradient(145deg,#f5d65b,#b88b10);
          color:#03153f; font-size:10px; font-weight:1000; letter-spacing:.12em; box-shadow:0 6px 14px rgba(3,21,63,.18);
        }
        .ncsPosAiPanel .ncsPosAiMascotBubble.alwaysVisible {
          right:126px !important; top:48px !important; min-width:108px !important; z-index:20 !important;
          animation:ncsAiAskBubble 5.2s ease-in-out infinite !important;
        }
        .ncsPosAiRealCouplePulse { right:10px !important; bottom:12px !important; z-index:25 !important; }

        @media (max-width: 1200px) {
          .ncsPosCartTableHeader, .ncsPosCartItemTableRow {
            grid-template-columns:minmax(210px,1.45fr) 72px 62px 78px 106px 128px 100px minmax(110px,.85fr) 118px !important;
            column-gap:8px !important;
          }
        }

        @media (max-width: 900px) {
          .ncsPosAiPanel .ncsPosAiRealCoupleLauncher { width:124px !important; height:168px !important; right:8px !important; bottom:8px !important; }
          .ncsPosAiRealCoupleImage { width:116px !important; }
        }


        /* NCS POS 2026 usability pass: compact total action + persistent funny AI couple */
        .ncsPosTotalLine {
          display:grid !important;
          grid-template-columns:minmax(220px,1fr) auto minmax(240px,320px) !important;
          align-items:center !important;
          gap:14px !important;
          padding:10px 12px !important;
        }
        .ncsPosTotalLine > strong {
          min-width:150px !important;
          padding:8px 14px !important;
          border-radius:12px !important;
          background:linear-gradient(145deg,#ef4444,#b91c1c) !important;
          color:#fff !important;
          box-shadow:0 8px 18px rgba(185,28,28,.22) !important;
          text-align:center !important;
        }
        .ncsPosCompleteButtonInline {
          width:100% !important;
          min-height:48px !important;
          margin:0 !important;
          padding:6px 10px !important;
          border-radius:12px !important;
          box-shadow:0 9px 20px rgba(10,46,115,.18) !important;
        }
        .ncsPosCompleteButtonInline > span { width:30px !important; height:30px !important; border-radius:9px !important; }
        .ncsPosCompleteButtonInline strong { font-size:11px !important; }
        .ncsPosCompleteButtonInline small { margin-top:1px !important; font-size:9px !important; }
        .ncsPosPaymentSection > .ncsPosCompleteButton:not(.ncsPosCompleteButtonInline) { display:none !important; }
        .ncsPosPaymentSection { padding-bottom:10px !important; }

        /* Keep Ask NCS visible at all times without covering Products / Quick Item / bill actions. */
        .ncsPosAiPanel.collapsed,
        .ncsPosAiPanel.expanded {
          pointer-events:none !important;
        }
        .ncsPosAiPanel.collapsed {
          position:fixed !important;
          left:auto !important;
          right:12px !important;
          bottom:10px !important;
          width:152px !important;
          height:164px !important;
          z-index:18000 !important;
          overflow:visible !important;
          animation:none !important;
          transform:none !important;
        }
        .ncsPosAiPanel.expanded {
          position:fixed !important;
          right:166px !important;
          bottom:14px !important;
          width:min(560px,calc(100vw - 200px)) !important;
          max-height:min(42vh,390px) !important;
          z-index:17950 !important;
          overflow:auto !important;
          pointer-events:auto !important;
        }
        .ncsPosAiPanel .ncsPosAiRealCoupleLauncher {
          position:fixed !important;
          right:10px !important;
          bottom:10px !important;
          width:148px !important;
          height:162px !important;
          min-height:0 !important;
          z-index:18050 !important;
          pointer-events:auto !important;
        }
        .ncsPosAiAnimatedCouple {
          right:0 !important;
          bottom:0 !important;
          width:132px !important;
          height:154px !important;
          animation:ncsFunnyCoupleBob 3.1s ease-in-out infinite !important;
        }
        @keyframes ncsFunnyCoupleBob {
          0%,100%{transform:translateY(0) rotate(-.3deg)}
          50%{transform:translateY(-4px) rotate(.7deg)}
        }
        .ncsPosAiAnimatedMan,.ncsPosAiAnimatedWoman {
          bottom:22px !important;
          width:59px !important;
          height:118px !important;
        }
        .ncsPosAiAnimatedMan { left:4px !important; }
        .ncsPosAiAnimatedWoman { right:4px !important; }
        .ncsPosAiAnimatedHead {
          left:13px !important;
          width:36px !important;
          height:39px !important;
          border-radius:46% 46% 48% 48% !important;
          animation:ncsFunnyHeadTilt 4.2s ease-in-out infinite !important;
        }
        .ncsPosAiAnimatedWoman .ncsPosAiAnimatedHead { animation-delay:.5s !important; }
        @keyframes ncsFunnyHeadTilt {
          0%,82%,100%{transform:rotate(0)}
          88%{transform:rotate(-4deg)}
          94%{transform:rotate(3deg)}
        }
        .ncsPosAiAnimatedMan .ncsPosAiAnimatedHead::before {
          left:-1px !important; right:-3px !important; top:-7px !important; height:17px !important;
          border-radius:68% 36% 54% 32% !important;
          transform:rotate(-6deg) !important;
          background:linear-gradient(145deg,#161616,#020202 72%) !important;
          box-shadow:7px -2px 0 -4px #020202,12px 0 0 -7px #020202 !important;
        }
        .ncsPosAiAnimatedMan .ncsPosAiAnimatedHead::after {
          content:""; position:absolute; left:12px; top:27px; width:13px; height:5px;
          border-radius:50% 50% 65% 65%; background:#2a1712;
          box-shadow:-5px 1px 0 -2px #2a1712,5px 1px 0 -2px #2a1712;
          transform:rotate(-2deg); z-index:9;
        }
        .ncsPosAiAnimatedWoman .ncsPosAiAnimatedHead::before {
          left:-4px !important; right:-4px !important; top:-6px !important; height:23px !important;
          border-radius:58% 58% 44% 44% !important;
          background:linear-gradient(145deg,#151515,#020202) !important;
          box-shadow:18px 9px 0 -7px #050505,22px 15px 0 -8px #050505,25px 21px 0 -9px #050505 !important;
        }
        .ncsPosAiAnimatedWoman .ncsPosAiAnimatedHead::after {
          content:"✿"; position:absolute; right:-8px; top:8px; color:#fff7d6;
          font-size:10px; line-height:1; text-shadow:0 1px 2px rgba(0,0,0,.25); z-index:10;
        }
        .ncsPosAiAnimatedHead .funCheek {
          position:absolute; top:25px; width:5px; height:3px; border-radius:50%; background:rgba(244,114,105,.36);
        }
        .ncsPosAiAnimatedHead .funCheek.left { left:5px; }
        .ncsPosAiAnimatedHead .funCheek.right { right:5px; }
        .ncsPosAiAnimatedHead .eye { top:18px !important; width:4px !important; height:5px !important; }
        .ncsPosAiAnimatedHead .smile { top:29px !important; }
        .ncsPosAiAnimatedShirt { left:8px !important; top:36px !important; width:46px !important; height:45px !important; }
        .ncsPosAiAnimatedPancha { left:10px !important; width:42px !important; height:49px !important; }
        .ncsPosAiAnimatedBlouse { left:10px !important; top:38px !important; width:43px !important; height:37px !important; }
        .ncsPosAiAnimatedSaree { left:4px !important; width:54px !important; height:73px !important; }
        .ncsPosAiAnimatedArm { top:44px !important; width:10px !important; height:39px !important; }
        .ncsPosAiAnimatedBase {
          left:12px !important; bottom:0 !important; width:108px !important; height:23px !important;
          border-radius:9px 9px 12px 12px !important; font-size:9px !important;
        }
        .ncsPosAiPanel .ncsPosAiMascotBubble.alwaysVisible {
          right:88px !important; top:35px !important; min-width:82px !important; padding:7px 8px !important;
          border-radius:12px 12px 4px 12px !important; z-index:18100 !important;
          animation:ncsAskBubblePop 5.6s ease-in-out infinite !important;
        }
        @keyframes ncsAskBubblePop {
          0%,18%,78%,100%{opacity:1;transform:translateY(0) scale(1)}
          84%{opacity:.82;transform:translateY(-3px) scale(.97)}
        }
        .ncsPosAiPanel .ncsPosAiMascotBubble.alwaysVisible b { font-size:10px !important; }
        .ncsPosAiPanel .ncsPosAiMascotBubble.alwaysVisible small { font-size:7px !important; }
        .ncsPosAiRealCouplePulse { right:4px !important; bottom:4px !important; width:10px !important; height:10px !important; }

        @media (max-width: 900px) {
          .ncsPosTotalLine { grid-template-columns:1fr auto !important; }
          .ncsPosCompleteButtonInline { grid-column:1 / -1 !important; }
          .ncsPosAiPanel.expanded { right:10px !important; width:calc(100vw - 20px) !important; bottom:180px !important; }
        }


        /* NCS 2026 compact animated sun mascot + payment-first total layout */
        .ncsPosAiAnimatedCouple{display:none !important;}
        .ncsPosAiSunMascot{position:absolute;right:2px;bottom:0;width:132px;height:150px;display:block;filter:drop-shadow(0 12px 14px rgba(3,21,63,.24));animation:ncsSunFloat 3.6s ease-in-out infinite;}
        @keyframes ncsSunFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        .ncsPosAiSunRays{position:absolute;left:33px;top:0;width:66px;height:66px;z-index:1;animation:ncsSunSpin 18s linear infinite;}
        @keyframes ncsSunSpin{to{transform:rotate(360deg)}}
        .ncsPosAiSunRays i{--ray:0;position:absolute;left:29px;top:-8px;width:9px;height:18px;border-radius:70% 70% 30% 30%;background:linear-gradient(180deg,#ffd84f,#ef9b20);transform-origin:4.5px 41px;transform:rotate(calc(var(--ray) * 30deg));box-shadow:inset 0 1px 2px rgba(255,255,255,.55);}
        .ncsPosAiSunFace{position:absolute;left:35px;top:13px;width:62px;height:62px;border-radius:50%;background:radial-gradient(circle at 35% 25%,#fff7d4 0 12%,#ffc95b 45%,#ed8f25 100%);border:4px solid #fff3bd;box-shadow:inset -6px -7px 10px rgba(172,80,14,.18),inset 5px 5px 7px rgba(255,255,255,.48);z-index:3;}
        .ncsPosAiSunFace .eye{position:absolute;top:24px;width:8px;height:12px;border-radius:50%;background:#24130d;animation:ncsSunBlink 4.5s infinite;}
        .ncsPosAiSunFace .eye.left{left:15px}.ncsPosAiSunFace .eye.right{right:15px}
        @keyframes ncsSunBlink{0%,44%,48%,100%{transform:scaleY(1)}46%{transform:scaleY(.08)}}
        .ncsPosAiSunFace .brow{position:absolute;top:15px;width:13px;height:5px;border-top:3px solid #3a2118;border-radius:50%;}.ncsPosAiSunFace .brow.left{left:11px;transform:rotate(-7deg)}.ncsPosAiSunFace .brow.right{right:11px;transform:rotate(7deg)}
        .ncsPosAiSunFace .nose{position:absolute;left:29px;top:33px;width:4px;height:7px;border-radius:50%;background:rgba(147,73,22,.38)}
        .ncsPosAiSunFace .smile{position:absolute;left:18px;top:41px;width:26px;height:13px;border-bottom:5px solid #7c2d12;border-radius:0 0 50% 50%;}
        .ncsPosAiSunBody{position:absolute;left:39px;top:72px;width:54px;height:49px;border-radius:18px 18px 12px 12px;background:linear-gradient(145deg,#fff6e6,#f5e2b8);border:2px solid #e4b84b;z-index:2;display:grid;place-items:center;color:#0a2e73;line-height:1;}
        .ncsPosAiSunBody b{font-size:17px;font-weight:1000}.ncsPosAiSunBody small{font-size:9px;font-weight:1000;color:#d29d19;margin-top:-12px}
        .ncsPosAiSunScarf{position:absolute;left:79px;top:75px;width:43px;height:12px;border-radius:0 10px 10px 0;background:linear-gradient(90deg,#ff7a1a 0 33%,#fff 33% 66%,#19a35a 66%);transform:rotate(10deg);z-index:1;animation:ncsScarfWave 2.2s ease-in-out infinite;}
        @keyframes ncsScarfWave{0%,100%{transform:rotate(8deg) translateX(0)}50%{transform:rotate(14deg) translateX(2px)}}
        .ncsPosAiSunArm{position:absolute;top:78px;width:12px;height:45px;border-radius:10px;background:linear-gradient(#e7a464,#b96936);z-index:1}.ncsPosAiSunArm.wave{left:24px;transform-origin:50% 85%;animation:ncsSunWave 1.8s ease-in-out infinite}.ncsPosAiSunArm.side{right:25px;transform:rotate(-8deg)}
        @keyframes ncsSunWave{0%,100%{transform:rotate(25deg)}50%{transform:rotate(58deg)}}
        .ncsPosAiSunLeg{position:absolute;bottom:8px;width:18px;height:35px;border-radius:5px 5px 10px 10px;background:linear-gradient(#d84435,#a91f24);z-index:1}.ncsPosAiSunLeg.left{left:43px}.ncsPosAiSunLeg.right{right:43px}.ncsPosAiSunLeg::after{content:"";position:absolute;bottom:-5px;left:-3px;width:24px;height:9px;border-radius:9px;background:#6b341f}
        .ncsPosAiPanel .ncsPosAiMascotBubble.alwaysVisible{right:96px !important;top:43px !important;min-width:86px !important;z-index:18100 !important;}
        .ncsPosPaymentSection{display:flex !important;flex-direction:column !important;}
        .ncsPosPaymentGrid{order:1 !important;}
        .ncsPosTotalLine{order:2 !important;margin-top:10px !important;}
        .ncsPosCreditPanel{order:3 !important;}


        /* NCS 2026 premium Ask NCS AI launcher — mascot removed */
        .ncsPosAiPanel .ncsPosAiMascotRunner.ncsPosAiRealCoupleLauncher {
          position: fixed !important;
          right: 22px !important;
          bottom: 22px !important;
          width: auto !important;
          height: auto !important;
          min-width: 178px !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 18px !important;
          background: transparent !important;
          box-shadow: none !important;
          overflow: visible !important;
          z-index: 18050 !important;
          transform: none !important;
          animation: none !important;
        }
        .ncsPosAiSunMascot,
        .ncsPosAiAnimatedCouple,
        .ncsPosAiRealCouplePulse,
        .ncsPosAiMascotBubble { display:none !important; }
        .ncsPosPremiumAiButton {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 178px;
          min-height: 58px;
          padding: 9px 12px 9px 10px;
          border: 1px solid rgba(212,175,55,.96);
          border-radius: 18px;
          background:
            linear-gradient(115deg, rgba(255,255,255,.12), transparent 32%),
            linear-gradient(135deg, #03153f 0%, #0a2e73 55%, #164ca8 100%);
          box-shadow: 0 14px 34px rgba(3,21,63,.26), inset 0 1px 0 rgba(255,255,255,.16);
          color: #fff;
          overflow: hidden;
          isolation: isolate;
        }
        .ncsPosPremiumAiButton::before {
          content: "";
          position: absolute;
          top: -45%;
          left: -35%;
          width: 38%;
          height: 190%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.34), transparent);
          transform: rotate(18deg);
          animation: ncsPremiumAiShine 4.2s ease-in-out infinite;
          z-index: -1;
        }
        .ncsPosPremiumAiSpark {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          color: #03153f;
          font-size: 20px;
          font-weight: 1000;
          background: linear-gradient(145deg,#ffe885,#d4af37 62%,#b88a0d);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.72), 0 5px 12px rgba(0,0,0,.15);
        }
        .ncsPosPremiumAiCopy {
          display:flex;
          flex-direction:column;
          align-items:flex-start;
          line-height:1.05;
          white-space:nowrap;
        }
        .ncsPosPremiumAiCopy b { font-size:14px; font-weight:1000; letter-spacing:.2px; }
        .ncsPosPremiumAiCopy small { margin-top:4px; font-size:9px; font-weight:800; color:#f8df8a; letter-spacing:.45px; text-transform:uppercase; }
        .ncsPosPremiumAiArrow {
          margin-left:auto;
          font-size:24px;
          font-weight:700;
          color:#f6d75f;
          transition:transform .18s ease;
        }
        .ncsPosAiMascotRunner:hover .ncsPosPremiumAiButton {
          transform: translateY(-2px);
          box-shadow: 0 17px 38px rgba(3,21,63,.32), inset 0 1px 0 rgba(255,255,255,.2);
        }
        .ncsPosAiMascotRunner:hover .ncsPosPremiumAiArrow { transform:translateX(3px); }
        .ncsPosAiMascotRunner:focus-visible .ncsPosPremiumAiButton {
          outline: 3px solid rgba(212,175,55,.35);
          outline-offset: 3px;
        }
        @keyframes ncsPremiumAiShine {
          0%, 66% { left:-40%; opacity:0; }
          72% { opacity:1; }
          92%,100% { left:125%; opacity:0; }
        }
        @media (max-width: 760px) {
          .ncsPosAiPanel .ncsPosAiMascotRunner.ncsPosAiRealCoupleLauncher { right:12px !important; bottom:12px !important; min-width:154px !important; }
          .ncsPosPremiumAiButton { min-width:154px; min-height:52px; padding:7px 10px 7px 8px; }
          .ncsPosPremiumAiSpark { width:34px; height:34px; }
          .ncsPosPremiumAiCopy b { font-size:12px; }
          .ncsPosPremiumAiCopy small { font-size:8px; }
        }

        .ncsPosDesignPickerBackdrop{position:fixed;inset:0;z-index:25000;display:grid;place-items:center;padding:18px;background:rgba(3,21,63,.62);backdrop-filter:blur(7px)}
        .ncsPosDesignPicker{width:min(920px,calc(100vw - 28px));max-height:min(88vh,760px);overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(212,175,55,.72);border-radius:24px;background:#fff;box-shadow:0 30px 90px rgba(3,21,63,.38)}
        .ncsPosDesignPicker>header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px 16px;background:linear-gradient(135deg,#03153f,#0a2e73);color:#fff}
        .ncsPosDesignPicker>header span{color:#d4af37;font-size:9px;font-weight:1000;letter-spacing:1.2px}.ncsPosDesignPicker>header h2{margin:4px 0 2px;font-size:22px;font-weight:1000}.ncsPosDesignPicker>header p{margin:0;color:rgba(255,255,255,.76);font-size:11px;font-weight:750}
        .ncsPosDesignPicker>header>button{width:38px;height:38px;flex:0 0 auto;border:1px solid rgba(255,255,255,.36);border-radius:12px;background:rgba(255,255,255,.10);color:#fff;font-size:24px;cursor:pointer}
        .ncsPosDesignPickerGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,220px));justify-content:start;gap:12px;max-height:560px;overflow:auto;padding:16px;background:linear-gradient(180deg,#fff,#f8f4ec)}
        .ncsPosDesignPickerBatches{display:grid;gap:14px;padding:14px;overflow:auto;flex:1 1 auto;min-height:0;background:linear-gradient(180deg,#fbfcff,#f4f8fc)}.ncsPosDesignBatch{border:1px solid #dbe3ee;border-radius:18px;background:#fff;overflow:hidden;box-shadow:0 8px 24px rgba(3,21,63,.06)}.ncsPosDesignBatch.isLatest{border:2px solid #d4af37;box-shadow:0 12px 30px rgba(212,175,55,.18)}.ncsPosDesignBatchHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;background:linear-gradient(135deg,#03153f,#0a2e73);color:#fff}.ncsPosDesignBatchHeader>div{min-width:0;display:grid;gap:2px}.ncsPosDesignBatchHeader span{font-size:8px;font-weight:1000;letter-spacing:.12em;color:#d4af37}.ncsPosDesignBatchHeader strong{font-size:12px;font-weight:1000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ncsPosDesignBatchHeader small{font-size:9px;font-weight:750;color:#e7edf8}.ncsPosDesignBatchHeader>b{flex:0 0 auto;padding:5px 8px;border-radius:999px;background:#fff;color:#0a2e73;font-size:9px;font-weight:1000}.ncsPosDesignBatch .ncsPosDesignPickerGrid{padding:10px;background:#fff}.ncsPosDesignChoice{min-width:0;padding:8px;border:1px solid #dbe3ee;border-radius:16px;background:#fff;text-align:left;cursor:pointer;box-shadow:0 8px 20px rgba(3,21,63,.08);transition:.14s ease}.ncsPosDesignChoice:hover{transform:translateY(-2px);border-color:#d4af37;box-shadow:0 12px 28px rgba(3,21,63,.14)}
        .ncsPosDesignChoiceImage{position:relative;width:100%;aspect-ratio:4/5;overflow:hidden;border-radius:12px;background:#eef2f7}.ncsPosDesignChoiceImage img{width:100%;height:100%;object-fit:cover;display:block}.ncsPosDesignChoiceImage>span{width:100%;height:100%;display:grid;place-items:center;color:#0a2e73;font-weight:1000}.ncsPosDesignChoiceImage b{position:absolute;right:7px;top:7px;min-width:26px;height:26px;display:grid;place-items:center;padding:0 7px;border-radius:999px;background:#d4af37;color:#03153f;font-size:11px;font-weight:1000}
        .ncsPosDesignChoice>strong{display:block;margin:8px 2px 2px;color:#03153f;font-size:11px;font-weight:1000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ncsPosDesignChoice>small{display:block;margin:0 2px 2px;color:#64748b;font-size:8px;font-weight:750;line-height:1.35}.ncsPosDesignPicker>footer{padding:10px 16px 12px;border-top:1px solid #edf1f5;color:#0a2e73;font-size:9px;font-weight:850;text-align:center}
        .ncsPosCartDesignName{display:inline-flex;align-items:center;width:max-content;max-width:100%;margin-top:3px;padding:2px 7px;border:1px solid rgba(212,175,55,.55);border-radius:999px;background:#fff8df;color:#7a5a00;font-size:8px;font-weight:950;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        @media(max-width:760px){.ncsPosDesignPickerBackdrop{padding:8px}.ncsPosDesignPicker{width:calc(100vw - 16px);border-radius:18px}.ncsPosDesignPicker>header{padding:14px}.ncsPosDesignPicker>header h2{font-size:18px}.ncsPosDesignPickerGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:10px;max-height:64vh}}


        /* NCS POS INTERNATIONAL COLORFUL FINAL — VISUAL ONLY */
        :root{--p:#6d4dff;--pk:#e950a5;--c:#16b8d4;--g:#00a67a;--o:#f29b30;--co:#ff6b6b;--i:#5c6bc0;--ink:#172033;--muted:#6f788a}
        .ncsPosPage{background:radial-gradient(circle at 5% 0%,rgba(109,77,255,.12),transparent 24%),radial-gradient(circle at 96% 9%,rgba(22,184,212,.12),transparent 26%),radial-gradient(circle at 50% 100%,rgba(242,155,48,.10),transparent 28%),linear-gradient(180deg,#f8f9fd,#f2f5fa 48%,#eef2f7);color:var(--ink)}
        .ncsPosHeader{border:1px solid rgba(255,255,255,.22);background:radial-gradient(circle at 80% 0%,rgba(255,255,255,.16),transparent 30%),radial-gradient(circle at 15% 110%,rgba(233,80,165,.28),transparent 32%),linear-gradient(125deg,#24114a 0%,#5a39d6 37%,#0a75ad 70%,#00a67a 100%);box-shadow:0 22px 52px rgba(40,31,93,.24)}
        .ncsPosHeader::after{content:"NCS";position:absolute;right:24px;top:-18px;z-index:0;color:rgba(255,255,255,.055);font-size:112px;font-weight:1000;letter-spacing:-8px;pointer-events:none}.ncsPosEyebrow{color:#ffe58c}.ncsPosHeaderActions .ncsPosSecondaryButton{border-color:rgba(255,255,255,.30);background:rgba(255,255,255,.11);backdrop-filter:blur(8px)}.ncsPosHeaderActions .ncsPosSecondaryButton:nth-child(1) b{background:var(--pk);color:#fff}.ncsPosHeaderActions .ncsPosSecondaryButton:nth-child(2) b{background:var(--c);color:#fff}.ncsPosHeaderActions .ncsPosSecondaryButton:nth-child(3) b{background:var(--g);color:#fff}.ncsPosRefreshButton{border:0;background:linear-gradient(135deg,#ffe58c,var(--o));color:#24114a;box-shadow:0 8px 20px rgba(242,155,48,.25)}
        .ncsOfflineStatusBar{border-color:rgba(92,107,192,.16);border-radius:18px;background:rgba(255,255,255,.9);box-shadow:0 10px 28px rgba(23,32,51,.07);backdrop-filter:blur(10px)}.ncsOfflineStatusBar button{border-radius:12px;background:linear-gradient(135deg,var(--i),var(--p));box-shadow:0 7px 18px rgba(109,77,255,.20)}
        .ncsPosQuickCard{border:1px solid rgba(255,255,255,.35);border-radius:22px;box-shadow:0 16px 38px rgba(23,32,51,.14)}.ncsPosSalesCard{background:radial-gradient(circle at 92% 5%,rgba(255,229,140,.28),transparent 34%),linear-gradient(135deg,#5a39d6 0%,#6d4dff 48%,#16b8d4 100%)}.ncsPosCreditCard{background:radial-gradient(circle at 92% 5%,rgba(255,255,255,.20),transparent 33%),linear-gradient(135deg,#e950a5 0%,#b948b8 48%,#f29b30 100%)}.ncsPosQuickIcon{border-color:rgba(255,255,255,.42);background:rgba(255,255,255,.15);color:#fff7cf}.ncsPosQuickContent>span{color:#fff2ad}.ncsPosQuickCreditBadge{border-color:rgba(255,255,255,.38);background:rgba(255,255,255,.12)}.ncsPosQuickCreditBadge b{color:#fff}
        .ncsPosSearchPanel{border:1px solid rgba(109,77,255,.15);border-radius:20px;background:rgba(255,255,255,.96);box-shadow:0 13px 32px rgba(54,45,108,.08)}.ncsPosSearchIcon{color:var(--p)}.ncsPosSearchButton{background:linear-gradient(135deg,var(--p),var(--c));box-shadow:0 8px 20px rgba(109,77,255,.20)}.ncsPosClearSearch{background:#f0edff;color:var(--p)}.ncsPosSearchQuickItemButton{border-color:rgba(242,155,48,.30)!important;background:#fff8ea!important;color:#b36b0b!important}
        .ncsPosAiPanel{border:1px solid rgba(109,77,255,.16)!important;background:radial-gradient(circle at 98% 0%,rgba(22,184,212,.13),transparent 28%),linear-gradient(135deg,#fff,#f7f4ff 55%,#effaff)!important;box-shadow:0 14px 32px rgba(54,45,108,.08)!important}.ncsPosAiPanel::before{background:linear-gradient(180deg,var(--p),var(--c),var(--g))!important}.ncsPosAiBadge,.ncsPosAiAddButton{background:linear-gradient(135deg,var(--p),var(--c))!important;color:#fff!important}.ncsPosAiLivePill{background:#eafaf5!important;color:#08795b!important;border-color:rgba(0,166,122,.22)!important}.ncsPosAiResultCard{border-color:rgba(22,184,212,.16)!important;background:linear-gradient(135deg,#fff,#f4fbfd)!important}
        .ncsPosCategoryButton{border-color:rgba(92,107,192,.14)!important;background:#fff!important;color:#596276!important;box-shadow:0 6px 14px rgba(23,32,51,.035)}.ncsPosCategoryButton:nth-child(6n+1){--cat:#6d4dff}.ncsPosCategoryButton:nth-child(6n+2){--cat:#00a67a}.ncsPosCategoryButton:nth-child(6n+3){--cat:#e950a5}.ncsPosCategoryButton:nth-child(6n+4){--cat:#f29b30}.ncsPosCategoryButton:nth-child(6n+5){--cat:#16b8d4}.ncsPosCategoryButton:nth-child(6n+6){--cat:#5c6bc0}.ncsPosCategoryButton:hover,.ncsPosCategoryButton.ncsPosCategoryActive{border-color:var(--cat)!important;background:color-mix(in srgb,var(--cat) 11%,white)!important;color:var(--cat)!important;transform:translateY(-1px)}
        .ncsPosGroupedCard,.ncsPosProductCard,.ncsPosCompactProduct,.ncsPosPopularProduct{border-color:rgba(23,32,51,.08)!important;background:#fff!important;border-radius:20px!important;box-shadow:0 10px 26px rgba(23,32,51,.065)!important}.ncsPosGroupedCard:nth-child(6n+1),.ncsPosProductCard:nth-child(6n+1){border-top:3px solid var(--p)!important}.ncsPosGroupedCard:nth-child(6n+2),.ncsPosProductCard:nth-child(6n+2){border-top:3px solid var(--g)!important}.ncsPosGroupedCard:nth-child(6n+3),.ncsPosProductCard:nth-child(6n+3){border-top:3px solid var(--pk)!important}.ncsPosGroupedCard:nth-child(6n+4),.ncsPosProductCard:nth-child(6n+4){border-top:3px solid var(--o)!important}.ncsPosGroupedCard:nth-child(6n+5),.ncsPosProductCard:nth-child(6n+5){border-top:3px solid var(--c)!important}.ncsPosGroupedCard:nth-child(6n+6),.ncsPosProductCard:nth-child(6n+6){border-top:3px solid var(--i)!important}.ncsPosGroupedToggle,.ncsPosProductBottom button{background:linear-gradient(135deg,var(--p),var(--c))!important;color:#fff!important;border-color:transparent!important}.ncsPosVariantPanel{background:linear-gradient(180deg,#fbfcff,#f4f8fc)!important}.ncsPosVariantPanel header{background:linear-gradient(135deg,#f2efff,#eefcff)!important}.ncsPosVariantList button{border-color:rgba(22,184,212,.16)!important;border-radius:14px!important}.ncsPosVariantList button:hover{border-color:var(--c)!important;background:#effbfe!important}
        .ncsPosBillPanel{border:1px solid rgba(109,77,255,.13)!important;border-radius:24px!important;background:rgba(255,255,255,.97)!important;box-shadow:0 18px 45px rgba(35,43,73,.11)!important}.ncsPosBillHeader{border-radius:22px 22px 0 0!important;background:radial-gradient(circle at 92% 0%,rgba(255,255,255,.15),transparent 30%),linear-gradient(125deg,#24114a,#5a39d6 52%,#0a75ad)!important;color:#fff!important}.ncsPosBillHeader span,.ncsPosBillHeader small{color:rgba(255,255,255,.72)!important}.ncsPosBillHeader strong,.ncsPosBillHeader h2{color:#fff!important}.ncsPosBillHeaderActions button,.ncsPosBillQueueButton,.ncsPosBillQuickItem,.ncsPosBillAddNextItem{border-color:rgba(255,255,255,.22)!important;background:rgba(255,255,255,.11)!important;color:#fff!important}
        .ncsPosCartTableHeader{background:linear-gradient(90deg,#f2efff,#eefbff)!important;color:#4e5770!important}.ncsPosCartItemTableRow,.ncsPosCartItem{border-color:rgba(23,32,51,.075)!important;background:#fff!important}.ncsPosCartItemTableRow:nth-child(6n+1),.ncsPosCartItem:nth-child(6n+1){box-shadow:inset 4px 0 var(--p)}.ncsPosCartItemTableRow:nth-child(6n+2),.ncsPosCartItem:nth-child(6n+2){box-shadow:inset 4px 0 var(--g)}.ncsPosCartItemTableRow:nth-child(6n+3),.ncsPosCartItem:nth-child(6n+3){box-shadow:inset 4px 0 var(--pk)}.ncsPosCartItemTableRow:nth-child(6n+4),.ncsPosCartItem:nth-child(6n+4){box-shadow:inset 4px 0 var(--o)}.ncsPosCartItemTableRow:nth-child(6n+5),.ncsPosCartItem:nth-child(6n+5){box-shadow:inset 4px 0 var(--c)}.ncsPosCartItemTableRow:nth-child(6n+6),.ncsPosCartItem:nth-child(6n+6){box-shadow:inset 4px 0 var(--i)}.ncsPosCartBrandName{color:var(--p)!important}.ncsPosItemDiscountField input,.ncsPosDiscountField input{border-color:rgba(233,80,165,.18)!important;background:#fff7fb!important}.ncsPosItemLineTotal{color:var(--g)!important}
        .ncsPosCustomerCard,.ncsPosCustomerCardCompact,.ncsPosCustomerSection{border-color:rgba(233,80,165,.16)!important;background:linear-gradient(135deg,#fff,#fff5fa)!important;border-radius:20px!important}.ncsPosCustomerTitle,.ncsPosCustomerMiniLabel{color:var(--pk)!important}.ncsPosPaymentSection{border-color:rgba(22,184,212,.16)!important;background:linear-gradient(135deg,#fff,#f2fbfd)!important;border-radius:20px!important}.ncsPosPaymentLabel{color:var(--c)!important}.ncsPosPaymentButton{border:1px solid rgba(23,32,51,.09)!important;background:#fff!important;color:#596276!important;border-radius:14px!important}.ncsPosPaymentButton:nth-child(1){--pay:#00a67a}.ncsPosPaymentButton:nth-child(2){--pay:#6d4dff}.ncsPosPaymentButton:nth-child(3){--pay:#16b8d4}.ncsPosPaymentButton:nth-child(4){--pay:#f29b30}.ncsPosPaymentButton:hover,.ncsPosPaymentButton.ncsPosPaymentActive{border-color:var(--pay)!important;background:color-mix(in srgb,var(--pay) 12%,white)!important;color:var(--pay)!important;box-shadow:0 7px 17px color-mix(in srgb,var(--pay) 18%,transparent)!important}.ncsPosCreditPanel,.ncsPosCreditSummary{border-color:rgba(242,155,48,.18)!important;background:#fff9ee!important}
        .ncsPosSummary{border-radius:20px!important;border-color:rgba(109,77,255,.14)!important;background:linear-gradient(145deg,#fbfaff,#f2fbfd)!important}.ncsPosDiscountLine strong{color:var(--pk)!important}.ncsPosTotalLine{margin-top:8px!important;padding:13px 12px!important;border:0!important;border-radius:16px!important;background:linear-gradient(135deg,#5a39d6,#6d4dff 48%,#16b8d4)!important;color:#fff!important}.ncsPosTotalLine span,.ncsPosTotalLine strong{color:#fff!important}.ncsPosCompleteButton,.ncsPosCompleteButtonInline{border:0!important;border-radius:17px!important;background:linear-gradient(135deg,#00a67a,#16b8d4)!important;color:#fff!important;box-shadow:0 12px 26px rgba(0,166,122,.22)!important}.ncsPosCompleteButton:hover,.ncsPosCompleteButtonInline:hover{transform:translateY(-2px);filter:brightness(1.04)}
        .ncsPosNotice{border-radius:16px!important;box-shadow:0 14px 32px rgba(23,32,51,.13)!important}.ncsPosNotice-success{background:linear-gradient(135deg,#eafaf5,#f3fffa)!important;border-color:rgba(0,166,122,.22)!important;color:#08795b!important}.ncsPosNotice-info{background:linear-gradient(135deg,#f1efff,#effbff)!important;border-color:rgba(109,77,255,.20)!important;color:#5037bd!important}.ncsPosNotice-error{background:linear-gradient(135deg,#fff1f1,#fff8f8)!important;border-color:rgba(255,107,107,.25)!important;color:#b63c3c!important}
        .ncsPosModalOverlay,.ncsPosSuccessOverlay,.ncsPosDesignPickerBackdrop{backdrop-filter:blur(10px) saturate(1.08)}.ncsPosHeldModal,.ncsOwnerCostModal,.ncsPosQuickItemModal,.ncsPosDesignPicker{border-color:rgba(109,77,255,.22)!important;border-radius:26px!important;box-shadow:0 30px 90px rgba(35,43,73,.25)!important}.ncsPosHeldModal>header,.ncsOwnerCostModal>header,.ncsPosQuickItemModal>header,.ncsPosDesignPicker>header{background:linear-gradient(125deg,#24114a,#5a39d6 52%,#0a75ad)!important;color:#fff!important}.ncsPosHeldCard{border-color:rgba(109,77,255,.13)!important;border-radius:18px!important;box-shadow:0 9px 22px rgba(35,43,73,.06)!important}.ncsPosHeldCardTop b{color:var(--g)!important}.ncsPosHeldActions button:last-child{background:linear-gradient(135deg,var(--p),var(--c))!important;color:#fff!important}
        .ncsPosSuccessOverlay{background:rgba(14,20,44,.55)!important}.ncsPosSuccessModal{border:1px solid rgba(109,77,255,.20)!important;border-radius:28px!important;background:radial-gradient(circle at 50% 0%,rgba(109,77,255,.11),transparent 30%),#fff!important;box-shadow:0 34px 100px rgba(23,32,51,.30)!important}.ncsPosSuccessIcon{background:linear-gradient(135deg,var(--g),var(--c))!important;color:#fff!important;box-shadow:0 10px 24px rgba(0,166,122,.22)!important}.ncsPosSuccessEyebrow{color:var(--p)!important}.ncsPosSuccessAmount{border:0!important;background:linear-gradient(135deg,#5a39d6,#6d4dff 46%,#16b8d4)!important;color:#fff!important}.ncsPosSuccessAmount small,.ncsPosSuccessAmount strong,.ncsPosSuccessAmount span{color:#fff!important}.ncsPosSuccessSummary p:nth-child(7n+1){background:#f4f1ff!important;border-color:rgba(109,77,255,.15)!important}.ncsPosSuccessSummary p:nth-child(7n+2){background:#eefaf6!important;border-color:rgba(0,166,122,.15)!important}.ncsPosSuccessSummary p:nth-child(7n+3){background:#fff2f8!important;border-color:rgba(233,80,165,.15)!important}.ncsPosSuccessSummary p:nth-child(7n+4){background:#fff8eb!important;border-color:rgba(242,155,48,.15)!important}.ncsPosSuccessSummary p:nth-child(7n+5){background:#effbfe!important;border-color:rgba(22,184,212,.15)!important}.ncsPosSuccessSummary p:nth-child(7n+6){background:#f2f3ff!important;border-color:rgba(92,107,192,.15)!important}.ncsPosSuccessSummary p:nth-child(7n+7){background:#f1fbf7!important;border-color:rgba(0,166,122,.15)!important}.ncsPosSuccessActions button{border:0!important;border-radius:14px!important;color:#fff!important;box-shadow:0 7px 18px rgba(23,32,51,.10)!important}.ncsPosSuccessWhatsApp{background:linear-gradient(135deg,#00a67a,#22c55e)!important}.ncsPosSuccessPdf{background:linear-gradient(135deg,#6d4dff,#8b5cf6)!important}.ncsPosSuccessTextWhatsApp{background:linear-gradient(135deg,#16b8d4,#00a67a)!important}.ncsPosSuccessPrint{background:linear-gradient(135deg,#f29b30,#d97706)!important}.ncsPosSuccessPrintA4{background:linear-gradient(135deg,#5c6bc0,#6d4dff)!important}.ncsPosSuccessStudio{background:linear-gradient(135deg,#e950a5,#8b5cf6)!important}.ncsPosSuccessNewBill{background:linear-gradient(135deg,#03153f,#0a2e73)!important}
        .ncsPosDesignPickerGrid{background:linear-gradient(180deg,#fbfcff,#f4f8fc)!important}.ncsPosDesignChoice:nth-child(6n+1){border-top:3px solid var(--p)!important}.ncsPosDesignChoice:nth-child(6n+2){border-top:3px solid var(--g)!important}.ncsPosDesignChoice:nth-child(6n+3){border-top:3px solid var(--pk)!important}.ncsPosDesignChoice:nth-child(6n+4){border-top:3px solid var(--o)!important}.ncsPosDesignChoice:nth-child(6n+5){border-top:3px solid var(--c)!important}.ncsPosDesignChoice:nth-child(6n+6){border-top:3px solid var(--i)!important}
        @media(max-width:760px){.ncsPosPage{padding:10px 9px 100px}.ncsPosHeader{padding:16px 14px;border-radius:20px;background:linear-gradient(145deg,#24114a,#5a39d6 52%,#0a75ad 82%,#00a67a)!important}.ncsPosHeader::after{font-size:68px;top:-8px}.ncsPosQuickStats{grid-template-columns:1fr;gap:9px}.ncsPosQuickCard{min-height:96px;border-radius:18px;padding:13px}.ncsPosSearchPanel,.ncsPosAiPanel,.ncsPosBillPanel{border-radius:18px!important}.ncsPosPaymentGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.ncsPosSuccessModal{border-radius:22px!important}}


        /* ============================================================
           NCS POS FINAL V2 — STRONGER COLOR + FLOATING AI BOX FIX
           ============================================================ */

        /* FIX: when AI is collapsed, remove the empty translucent panel. */
        .ncsPosAiPanel.collapsed {
          width: 210px !important;
          min-height: 0 !important;
          max-height: none !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          overflow: visible !important;
        }

        .ncsPosAiPanel.collapsed::before,
        .ncsPosAiPanel.collapsed::after {
          display: none !important;
        }

        .ncsPosAiPanel.collapsed .ncsPosAiMascotRunner {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        .ncsPosPremiumAiButton {
          border: 1px solid rgba(255, 213, 74, 0.85) !important;
          background:
            radial-gradient(circle at 10% 0%, rgba(255,255,255,.17), transparent 35%),
            linear-gradient(135deg, #0b245f, #5a39d6 58%, #0a75ad) !important;
          box-shadow: 0 13px 30px rgba(35,43,73,.25) !important;
        }

        /* Stronger POS canvas */
        .ncsPosWorkspace {
          gap: 16px !important;
        }

        .ncsPosCatalogue {
          padding: 0 2px 16px !important;
          border-radius: 24px !important;
          background:
            radial-gradient(circle at 5% 0%, rgba(109,77,255,.09), transparent 22%),
            radial-gradient(circle at 98% 16%, rgba(22,184,212,.08), transparent 25%),
            linear-gradient(180deg, rgba(255,255,255,.80), rgba(247,249,255,.96)) !important;
        }

        .ncsPosCatalogueTop h2 {
          color: #24114a !important;
          font-size: 23px !important;
          letter-spacing: -.45px !important;
        }

        .ncsPosStatusBadge {
          border-color: rgba(0,166,122,.26) !important;
          background: linear-gradient(135deg,#eafaf5,#effff9) !important;
          color: #08795b !important;
          box-shadow: 0 6px 15px rgba(0,166,122,.09) !important;
        }

        .ncsPosFinderToolbar {
          border: 1px solid rgba(109,77,255,.15) !important;
          border-radius: 20px !important;
          background:
            linear-gradient(135deg,#f6f2ff 0%,#fff 48%,#effbff 100%) !important;
          box-shadow: 0 10px 24px rgba(54,45,108,.07) !important;
        }

        .ncsPosFinderToolbar button {
          border-radius: 14px !important;
          border-color: rgba(109,77,255,.14) !important;
          background: #fff !important;
          color: #556075 !important;
        }

        .ncsPosFinderToolbar button:nth-child(1) { --finder:#e950a5; }
        .ncsPosFinderToolbar button:nth-child(2) { --finder:#6d4dff; }
        .ncsPosFinderToolbar button:nth-child(3) { --finder:#16b8d4; }

        .ncsPosFinderToolbar button:hover,
        .ncsPosFinderToolbar button.active {
          border-color: var(--finder) !important;
          background: var(--finder) !important;
          color: #fff !important;
          box-shadow: 0 8px 18px color-mix(in srgb,var(--finder) 22%,transparent) !important;
        }

        /* Brand cards — visible international colorful treatment */
        .ncsPosBrandCompactGrid,
        .ncsPosBrandGrid {
          gap: 11px !important;
        }

        .ncsPosBrandCompactCard,
        .ncsPosBrandSummary {
          border-radius: 18px !important;
          border: 1px solid rgba(23,32,51,.08) !important;
          background: #fff !important;
          box-shadow: 0 9px 22px rgba(23,32,51,.06) !important;
          overflow: hidden !important;
        }

        .ncsPosBrandCompactCard:nth-child(6n+1),
        .ncsPosBrandSummary:nth-child(6n+1) {
          background: linear-gradient(135deg,#f3efff,#fff) !important;
          border-color: rgba(109,77,255,.24) !important;
        }
        .ncsPosBrandCompactCard:nth-child(6n+2),
        .ncsPosBrandSummary:nth-child(6n+2) {
          background: linear-gradient(135deg,#ebfaf5,#fff) !important;
          border-color: rgba(0,166,122,.22) !important;
        }
        .ncsPosBrandCompactCard:nth-child(6n+3),
        .ncsPosBrandSummary:nth-child(6n+3) {
          background: linear-gradient(135deg,#fff0f7,#fff) !important;
          border-color: rgba(233,80,165,.22) !important;
        }
        .ncsPosBrandCompactCard:nth-child(6n+4),
        .ncsPosBrandSummary:nth-child(6n+4) {
          background: linear-gradient(135deg,#fff6e8,#fff) !important;
          border-color: rgba(242,155,48,.24) !important;
        }
        .ncsPosBrandCompactCard:nth-child(6n+5),
        .ncsPosBrandSummary:nth-child(6n+5) {
          background: linear-gradient(135deg,#eafaff,#fff) !important;
          border-color: rgba(22,184,212,.23) !important;
        }
        .ncsPosBrandCompactCard:nth-child(6n+6),
        .ncsPosBrandSummary:nth-child(6n+6) {
          background: linear-gradient(135deg,#f0f2ff,#fff) !important;
          border-color: rgba(92,107,192,.23) !important;
        }

        .ncsPosBrandCompactMark,
        .ncsPosBrandMark {
          color: #fff !important;
          border: 0 !important;
          box-shadow: 0 7px 15px rgba(23,32,51,.12) !important;
        }

        .ncsPosBrandCompactCard:nth-child(6n+1) .ncsPosBrandCompactMark,
        .ncsPosBrandSummary:nth-child(6n+1) .ncsPosBrandMark { background:linear-gradient(135deg,#6d4dff,#8b5cf6)!important; }
        .ncsPosBrandCompactCard:nth-child(6n+2) .ncsPosBrandCompactMark,
        .ncsPosBrandSummary:nth-child(6n+2) .ncsPosBrandMark { background:linear-gradient(135deg,#00a67a,#25bf91)!important; }
        .ncsPosBrandCompactCard:nth-child(6n+3) .ncsPosBrandCompactMark,
        .ncsPosBrandSummary:nth-child(6n+3) .ncsPosBrandMark { background:linear-gradient(135deg,#e950a5,#f47fc2)!important; }
        .ncsPosBrandCompactCard:nth-child(6n+4) .ncsPosBrandCompactMark,
        .ncsPosBrandSummary:nth-child(6n+4) .ncsPosBrandMark { background:linear-gradient(135deg,#f29b30,#f6b85d)!important; }
        .ncsPosBrandCompactCard:nth-child(6n+5) .ncsPosBrandCompactMark,
        .ncsPosBrandSummary:nth-child(6n+5) .ncsPosBrandMark { background:linear-gradient(135deg,#16b8d4,#36c7df)!important; }
        .ncsPosBrandCompactCard:nth-child(6n+6) .ncsPosBrandCompactMark,
        .ncsPosBrandSummary:nth-child(6n+6) .ncsPosBrandMark { background:linear-gradient(135deg,#5c6bc0,#7987dc)!important; }

        /* Category pills become clearly colorful */
        .ncsPosCategoryButton {
          font-weight: 900 !important;
          border-width: 1.5px !important;
        }

        .ncsPosCategoryButton.ncsPosCategoryActive {
          background: var(--cat) !important;
          border-color: var(--cat) !important;
          color: #fff !important;
          box-shadow: 0 8px 18px color-mix(in srgb,var(--cat) 24%,transparent) !important;
        }

        /* Current bill side – clearer hierarchy */
        .ncsPosBillPanel {
          background:
            radial-gradient(circle at 95% 0%, rgba(22,184,212,.08), transparent 26%),
            #fff !important;
        }

        .ncsPosCustomerCard,
        .ncsPosCustomerCardCompact,
        .ncsPosCustomerSection {
          background:
            radial-gradient(circle at 0% 0%,rgba(233,80,165,.11),transparent 30%),
            linear-gradient(135deg,#fff,#fff6fa) !important;
        }

        .ncsPosCartTableHeader {
          border-top: 1px solid rgba(109,77,255,.08) !important;
          border-bottom: 1px solid rgba(22,184,212,.10) !important;
          background:
            linear-gradient(90deg,#eeeaff 0%,#f8f7ff 35%,#eafaff 100%) !important;
        }

        .ncsPosEmptyCart {
          border: 1px dashed rgba(109,77,255,.18) !important;
          border-radius: 20px !important;
          background:
            radial-gradient(circle at 50% 10%,rgba(109,77,255,.08),transparent 30%),
            linear-gradient(180deg,#fff,#f6f9ff) !important;
        }

        .ncsPosEmptyCart > div,
        .ncsPosEmptyCart span {
          background: linear-gradient(135deg,#f0edff,#eafaff) !important;
          color: #6d4dff !important;
        }

        /* Totals footer more colorful even before bill items exist */
        .ncsPosSummaryLine:nth-child(7n+1) strong { color:#6d4dff !important; }
        .ncsPosSummaryLine:nth-child(7n+2) strong { color:#e950a5 !important; }
        .ncsPosSummaryLine:nth-child(7n+3) strong { color:#00a67a !important; }
        .ncsPosSummaryLine:nth-child(7n+4) strong { color:#f29b30 !important; }
        .ncsPosSummaryLine:nth-child(7n+5) strong { color:#16b8d4 !important; }
        .ncsPosSummaryLine:nth-child(7n+6) strong { color:#5c6bc0 !important; }

        /* Make payment section obvious once scrolled into view */
        .ncsPosPaymentSection {
          box-shadow: inset 4px 0 #16b8d4, 0 8px 20px rgba(22,184,212,.06) !important;
        }

        /* Keep festival cards truly colorful. */
        .ncsPosFestivalOffer {
          background-color: #6d4dff !important;
          color: #fff !important;
          opacity: 1 !important;
        }
        .ncsPosFestivalOffer * {
          color: inherit;
        }

        @media(max-width:760px){
          .ncsPosBrandCompactGrid,
          .ncsPosBrandGrid { gap:8px !important; }
          .ncsPosCatalogue { border-radius:18px !important; }
        }

        /* =========================================================
           NCS COUNTER SAFETY + SPEED FINISH
           ========================================================= */
        .ncsPosCustomerDueAlert {
          display:flex;
          align-items:center;
          gap:9px;
          margin-top:8px;
          padding:8px 11px;
          border:1px solid rgba(223,141,32,.2);
          border-radius:12px;
          background:linear-gradient(135deg,#fffaf0,#fff4dc);
          color:#855812;
        }
        .ncsPosCustomerDueAlert > span {
          width:28px;height:28px;display:grid;place-items:center;
          border-radius:9px;background:#fff;color:#b77712;
          font-weight:1000;box-shadow:0 4px 10px rgba(145,96,20,.1);
        }
        .ncsPosCustomerDueAlert strong,
        .ncsPosCustomerDueAlert small { display:block; }
        .ncsPosCustomerDueAlert strong { font-size:10px;font-weight:950; }
        .ncsPosCustomerDueAlert small { margin-top:2px;font-size:8px;font-weight:700;opacity:.8; }

        .ncsPosLowStockBadge {
          display:inline-flex;
          width:max-content;
          margin-top:5px;
          padding:4px 7px;
          border:1px solid rgba(230,147,32,.24);
          border-radius:999px;
          background:#fff6e6;
          color:#a9650e;
          font-size:7px;
          font-weight:950;
          letter-spacing:.04em;
        }

        .ncsPosLastAddedItem {
          position:relative;
          animation:ncsLastAddedFlash 1.55s ease-out both;
        }
        .ncsPosLastAddedItem::after {
          content:"JUST ADDED";
          position:absolute;
          top:5px;
          right:7px;
          padding:3px 7px;
          border-radius:999px;
          background:linear-gradient(135deg,#00a67a,#16b8d4);
          color:#fff;
          font-size:6px;
          font-weight:1000;
          letter-spacing:.08em;
          box-shadow:0 5px 13px rgba(0,166,122,.18);
          pointer-events:none;
        }
        @keyframes ncsLastAddedFlash {
          0% { box-shadow:0 0 0 3px rgba(0,166,122,.35),0 10px 25px rgba(0,166,122,.16); background:#edfff9; }
          100% { box-shadow:none; }
        }

        .ncsPosCounterIntelligence {
          display:grid;
          gap:7px;
          margin-top:7px;
        }
        .ncsPosShortcutStrip {
          display:flex;
          flex-wrap:wrap;
          gap:5px;
          padding:6px 8px;
          border:1px solid rgba(10,46,115,.08);
          border-radius:12px;
          background:linear-gradient(135deg,#fbfdff,#f5f9ff);
        }
        .ncsPosShortcutStrip span {
          display:inline-flex;align-items:center;gap:4px;
          color:#657083;font-size:7px;font-weight:800;
        }
        .ncsPosShortcutStrip b {
          padding:2px 5px;border-radius:5px;
          background:#0a2e73;color:#fff;font-size:6px;font-weight:1000;
        }

        .ncsPosOwnerGuardStrip,
        .ncsPosActiveQueueNotice {
          display:flex;
          align-items:center;
          gap:9px;
          padding:8px 10px;
          border-radius:12px;
        }
        .ncsPosOwnerGuardStrip > span,
        .ncsPosActiveQueueNotice > span {
          width:29px;height:29px;display:grid;place-items:center;
          border-radius:9px;background:#fff;font-size:15px;
        }
        .ncsPosOwnerGuardStrip strong,
        .ncsPosOwnerGuardStrip small,
        .ncsPosActiveQueueNotice strong,
        .ncsPosActiveQueueNotice small { display:block; }
        .ncsPosOwnerGuardStrip strong,
        .ncsPosActiveQueueNotice strong { font-size:9px;font-weight:950; }
        .ncsPosOwnerGuardStrip small,
        .ncsPosActiveQueueNotice small { margin-top:2px;font-size:7px;font-weight:700;opacity:.82; }

        .ncsPosOwnerGuardStrip.warning {
          border:1px solid rgba(218,157,39,.22);
          background:linear-gradient(135deg,#fffaf0,#fff4d8);
          color:#8d6618;
        }
        .ncsPosOwnerGuardStrip.danger {
          border:1px solid rgba(220,68,68,.2);
          background:linear-gradient(135deg,#fff5f5,#ffecec);
          color:#a23434;
        }
        .ncsPosActiveQueueNotice {
          border:1px solid rgba(70,83,210,.18);
          background:linear-gradient(135deg,#f7f6ff,#eef7ff);
          color:#433aa3;
        }

        .ncsPosHeldActiveBadge {
          border:1px solid rgba(0,166,122,.22) !important;
          background:#eafff7 !important;
          color:#087b5e !important;
          font-weight:1000 !important;
        }

        /* Keep total + Complete Sale visible while the bill panel scrolls. */
        .ncsPosTotalLine {
          position:sticky !important;
          bottom:0 !important;
          z-index:65 !important;
          border:1px solid rgba(10,46,115,.10) !important;
          box-shadow:0 -8px 24px rgba(20,42,85,.10),0 10px 25px rgba(20,42,85,.08) !important;
          backdrop-filter:blur(10px);
        }

        @media(max-width:760px) {
          .ncsPosShortcutStrip { display:none; }
          .ncsPosCounterIntelligence { margin-top:5px; }
          .ncsPosLastAddedItem::after { display:none; }
        }

      `}

</style>
    </main>
  );
}



