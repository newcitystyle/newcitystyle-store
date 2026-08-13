"use client";

import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CollectionOption = {
  id: number;
  name: string;
};

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

type AiStatus = {
  type: "idle" | "success" | "error";
  message: string;
};

type ExistingStockProduct = {
  id: number;
  name: string;
  barcode: string;
  sku: string;
  stock: number;
  onlineStockLimit: number;
  sellOnline: boolean;
  image: string;
  variantId: number | null;
  variantBarcode: string;
  variantSku: string;
  size: string;
  color: string;
};

type PhotoStudioPreset = {
  id: string;
  shortLabel: string;
  name: string;
  description: string;
  recommendedFor: string;
  backgroundStyle: string;
};

type ProductForm = {
  name: string;
  slug: string;
  tagline: string;
  category: string;
  subcategory: string;
  collectionId: string;
  brand: string;
  gender: string;
  ageGroup: string;

  shortDescription: string;
  description: string;

  mrp: string;
  price: string;
  discountPercent: string;
  taxPercent: string;

  sku: string;
  barcode: string;
  stock: string;
  lowStockLimit: string;
  sellOnline: boolean;
  onlineStockLimit: string;

  mainImage: string;
  galleryImages: string[];
  lifestyleImages: string[];

  tags: string[];
  sizes: string[];

  material: string;
  fabric: string;
  pattern: string;
  sleeveType: string;
  fitType: string;
  occasion: string;
  lifestyleTitle: string;
  lifestyleSubtitle: string;

  keyFeatures: string[];
  specifications: Specification[];
  whatsInBox: string[];
  faqs: Faq[];

  weight: string;
  packageLength: string;
  packageWidth: string;
  packageHeight: string;

  shippingPolicy: string;
  returnPolicy: string;

  seoTitle: string;
  metaDescription: string;
  seoKeywords: string;
  socialPreviewUrl: string;

  isFeatured: boolean;
  isNewArrival: boolean;
  isOnSale: boolean;
  isBestseller: boolean;
  isTrending: boolean;
  isActive: boolean;
};

const initialForm: ProductForm = {
  name: "",
  slug: "",
  tagline: "",
  category: "",
  subcategory: "",
  collectionId: "",
  brand: "NEW CITY STYLE",
  gender: "",
  ageGroup: "",

  shortDescription: "",
  description: "",

  mrp: "",
  price: "",
  discountPercent: "0",
  taxPercent: "",

  sku: "",
  barcode: "",
  stock: "",
  lowStockLimit: "",
  sellOnline: false,
  onlineStockLimit: "0",

  mainImage: "",
  galleryImages: [],
  lifestyleImages: [],

  tags: [],
  sizes: [],

  material: "",
  fabric: "",
  pattern: "",
  sleeveType: "",
  fitType: "",
  occasion: "",
  lifestyleTitle: "",
  lifestyleSubtitle: "",

  keyFeatures: ["", "", "", ""],
  specifications: [
    { label: "", value: "" },
    { label: "", value: "" },
    { label: "", value: "" },
  ],
  whatsInBox: [""],
  faqs: [
    { question: "", answer: "" },
    { question: "", answer: "" },
  ],

  weight: "",
  packageLength: "",
  packageWidth: "",
  packageHeight: "",

  shippingPolicy:
    "Orders are processed within 1-2 business days. Delivery time may vary according to the customer location.",
  returnPolicy:
    "Returns and exchanges are accepted according to the NEW CITY STYLE return policy.",

  seoTitle: "",
  metaDescription: "",
  seoKeywords: "",
  socialPreviewUrl: "",

  isFeatured: false,
  isNewArrival: true,
  isOnSale: false,
  isBestseller: false,
  isTrending: false,
  isActive: true,
};

const commonTags = [
  "New Arrival",
  "Featured",
  "Best Seller",
  "Trending",
  "Premium",
  "Casual",
  "Formal",
  "Party Wear",
  "Festive",
  "Daily Wear",
  "Summer",
  "Winter",
  "Cotton",
  "Budget Pick",
  "Limited Stock",
];

const commonSizes = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "4XL",
  "Free Size",
];

const ncsPhotoStudioPresets: PhotoStudioPreset[] = [
  {
    id: "0",
    shortLabel: "MAIN",
    name: "NCS World-Class Catalog",
    description: "Premium warm-ivory luxury cyclorama with soft editorial daylight, subtle champagne depth and a natural grounded finish designed for the primary e-commerce image.",
    recommendedFor: "Main product image, website cards, search results, premium catalogue",
    backgroundStyle: "high-end warm ivory seamless cyclorama studio, subtle limestone texture, soft editorial daylight from the upper left, restrained champagne depth, natural floor-to-wall sweep, realistic soft grounding shadow, no frames, no shelves, no props, no decorative distractions",
  },
  {
    id: "1",
    shortLabel: "1",
    name: "Royal Boutique Wall",
    description: "Luxury royal blue boutique wall with elegant gold trims and soft premium showroom lighting.",
    recommendedFor: "Men wear, shirts, jeans, casual collections",
    backgroundStyle: "royal blue boutique interior, subtle gold trim, clean light floor, premium retail mood",
  },
  {
    id: "2",
    shortLabel: "2",
    name: "Luxury Marble Studio",
    description: "Ivory marble studio with luxury editorial lighting and clean premium presentation.",
    recommendedFor: "Premium products, featured products, formal wear",
    backgroundStyle: "ivory marble studio, soft editorial light, subtle luxury floor reflection",
  },
  {
    id: "3",
    shortLabel: "3",
    name: "Premium Shelf Store",
    description: "Premium store background with soft boutique shelves and balanced e-commerce depth.",
    recommendedFor: "General e-commerce uploads, daily products",
    backgroundStyle: "premium boutique shelves, softly blurred background, warm retail lighting",
  },
  {
    id: "4",
    shortLabel: "4",
    name: "Soft Neutral Studio",
    description: "Minimal cream-beige fashion studio that keeps the product clean and premium.",
    recommendedFor: "Women wear, kids wear, colourful products",
    backgroundStyle: "soft neutral cream studio, clean floor, gentle shadow, modern fashion catalog look",
  },
  {
    id: "5",
    shortLabel: "5",
    name: "Ethnic Festive",
    description: "Warm festive Indian fashion backdrop with elegant premium details.",
    recommendedFor: "Sarees, kurtis, festive collections",
    backgroundStyle: "warm festive ethnic backdrop, subtle golden glow, elegant Indian fashion mood",
  },
  {
    id: "6",
    shortLabel: "6",
    name: "Kids Fashion Studio",
    description: "Soft pastel premium kids studio with playful but clean fashion presentation.",
    recommendedFor: "Kids wear, frocks, boys and girls collections",
    backgroundStyle: "pastel premium kids studio, clean floor, cheerful yet elegant boutique look",
  },
  {
    id: "7",
    shortLabel: "7",
    name: "Dark Luxury Spotlight",
    description: "Dark luxury scene with spotlight focus for premium hero products.",
    recommendedFor: "Featured items, luxury promotions, social creatives",
    backgroundStyle: "deep navy luxury backdrop, controlled spotlight, premium dramatic fashion mood",
  },
  {
    id: "8",
    shortLabel: "8",
    name: "Window Light Boutique",
    description: "Natural boutique corner with premium daylight and elegant interior softness.",
    recommendedFor: "Elegant daily wear, women tops, lifestyle-rich product shots",
    backgroundStyle: "soft daylight boutique corner, premium window light, clean refined retail mood",
  },
];

let ncsBackgroundRemovalPipelinePromise: Promise<any> | null = null;
let ncsBen2BackgroundRemovalPipelinePromise: Promise<any> | null = null;

async function getNcsBackgroundRemovalPipeline() {
  if (ncsBackgroundRemovalPipelinePromise) {
    return ncsBackgroundRemovalPipelinePromise;
  }

  ncsBackgroundRemovalPipelinePromise = (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const hasWebGpu =
      typeof navigator !== "undefined" &&
      "gpu" in (navigator as Navigator & { gpu?: unknown });

    if (hasWebGpu) {
      try {
        return await pipeline(
          "background-removal",
          "Xenova/modnet",
          {
            device: "webgpu",
            dtype: "fp32",
          }
        );
      } catch (error) {
        console.warn(
          "NCS Photo Studio MODNet WebGPU startup failed; falling back to browser CPU/WASM.",
          error
        );
      }
    }

    return pipeline(
      "background-removal",
      "Xenova/modnet",
      {
        dtype: "q8",
      }
    );
  })().catch((error) => {
    ncsBackgroundRemovalPipelinePromise = null;
    throw error;
  });

  return ncsBackgroundRemovalPipelinePromise;
}

async function getNcsBen2BackgroundRemovalPipeline() {
  if (ncsBen2BackgroundRemovalPipelinePromise) {
    return ncsBen2BackgroundRemovalPipelinePromise;
  }

  ncsBen2BackgroundRemovalPipelinePromise = (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const hasWebGpu =
      typeof navigator !== "undefined" &&
      "gpu" in (navigator as Navigator & { gpu?: unknown });

    if (hasWebGpu) {
      try {
        return await pipeline(
          "background-removal",
          "onnx-community/BEN2-ONNX",
          {
            device: "webgpu",
          }
        );
      } catch (error) {
        console.warn(
          "NCS Photo Studio BEN2 WebGPU startup failed; falling back to browser CPU/WASM.",
          error
        );
      }
    }

    return pipeline(
      "background-removal",
      "onnx-community/BEN2-ONNX"
    );
  })().catch((error) => {
    ncsBen2BackgroundRemovalPipelinePromise = null;
    throw error;
  });

  return ncsBen2BackgroundRemovalPipelinePromise;
}

function getFirstBackgroundRemovalResult(output: any) {
  if (Array.isArray(output)) {
    return output[0] ?? null;
  }

  if (
    output &&
    typeof output === "object" &&
    0 in (output as Record<number, unknown>)
  ) {
    return (output as Record<number, unknown>)[0] ?? null;
  }

  return output ?? null;
}

async function rawImageLikeToCanvas(rawImage: any) {
  if (!rawImage) {
    throw new Error("The local engine returned an empty mask.");
  }

  if (typeof rawImage.toCanvas === "function") {
    const canvas = await Promise.resolve(rawImage.toCanvas());
    if (canvas instanceof HTMLCanvasElement) {
      return canvas;
    }
  }

  const width = Number(rawImage.width || rawImage.size?.[0] || 0);
  const height = Number(rawImage.height || rawImage.size?.[1] || 0);
  const channels = Number(rawImage.channels || 0);
  const data = rawImage.data as
    | Uint8Array
    | Uint8ClampedArray
    | undefined;

  if (!width || !height || !data?.length) {
    throw new Error("The local engine returned an unsupported mask format.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("This browser could not prepare the local mask canvas.");
  }

  const imageData = ctx.createImageData(width, height);

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const sourceIndex = pixelIndex * Math.max(channels, 1);
    const targetIndex = pixelIndex * 4;

    if (channels === 4) {
      imageData.data[targetIndex] = data[sourceIndex] ?? 0;
      imageData.data[targetIndex + 1] = data[sourceIndex + 1] ?? 0;
      imageData.data[targetIndex + 2] = data[sourceIndex + 2] ?? 0;
      imageData.data[targetIndex + 3] = data[sourceIndex + 3] ?? 255;
    } else if (channels === 3) {
      imageData.data[targetIndex] = data[sourceIndex] ?? 0;
      imageData.data[targetIndex + 1] = data[sourceIndex + 1] ?? 0;
      imageData.data[targetIndex + 2] = data[sourceIndex + 2] ?? 0;
      imageData.data[targetIndex + 3] = 255;
    } else {
      const value = data[sourceIndex] ?? 0;
      imageData.data[targetIndex] = value;
      imageData.data[targetIndex + 1] = value;
      imageData.data[targetIndex + 2] = value;
      imageData.data[targetIndex + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function normalizeMaskCanvas(
  sourceMaskCanvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
) {
  const scaledCanvas = document.createElement("canvas");
  scaledCanvas.width = targetWidth;
  scaledCanvas.height = targetHeight;

  const ctx = scaledCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!ctx) {
    throw new Error("This browser could not normalize the product mask.");
  }

  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(sourceMaskCanvas, 0, 0, targetWidth, targetHeight);

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const pixels = imageData.data;

  let alphaHasVariation = false;
  let firstAlpha = pixels[3] ?? 255;

  for (let index = 3; index < pixels.length; index += 64) {
    if (Math.abs((pixels[index] ?? 255) - firstAlpha) > 4) {
      alphaHasVariation = true;
      break;
    }
  }

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const alpha = pixels[index + 3] ?? 255;

    const luminance = Math.round(
      red * 0.299 + green * 0.587 + blue * 0.114
    );

    const maskValue = alphaHasVariation ? alpha : luminance;

    pixels[index] = 255;
    pixels[index + 1] = 255;
    pixels[index + 2] = 255;
    pixels[index + 3] = maskValue;
  }

  ctx.putImageData(imageData, 0, 0);
  return scaledCanvas;
}

async function createCutoutCanvasFromLocalOutput(
  sourceImage: HTMLImageElement,
  output: any
) {
  const result = getFirstBackgroundRemovalResult(output);
  const maskLike =
    result &&
    typeof result === "object" &&
    "mask" in result &&
    (result as { mask?: unknown }).mask
      ? (result as { mask: unknown }).mask
      : result;

  const rawMaskCanvas = await rawImageLikeToCanvas(maskLike);

  const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
  const sourceHeight = sourceImage.naturalHeight || sourceImage.height;

  const maskCanvas = normalizeMaskCanvas(
    rawMaskCanvas,
    sourceWidth,
    sourceHeight
  );

  const cutoutCanvas = document.createElement("canvas");
  cutoutCanvas.width = sourceWidth;
  cutoutCanvas.height = sourceHeight;

  const cutoutCtx = cutoutCanvas.getContext("2d");
  if (!cutoutCtx) {
    throw new Error("This browser could not start the product photo canvas.");
  }

  cutoutCtx.drawImage(
    sourceImage,
    0,
    0,
    cutoutCanvas.width,
    cutoutCanvas.height
  );
  cutoutCtx.globalCompositeOperation = "destination-in";
  cutoutCtx.drawImage(
    maskCanvas,
    0,
    0,
    cutoutCanvas.width,
    cutoutCanvas.height
  );
  cutoutCtx.globalCompositeOperation = "source-over";

  const bounds = findAlphaBounds(cutoutCanvas);
  const foregroundAreaRatio =
    (bounds.width * bounds.height) /
    Math.max(1, cutoutCanvas.width * cutoutCanvas.height);

  if (
    bounds.width < 24 ||
    bounds.height < 24 ||
    foregroundAreaRatio < 0.002
  ) {
    throw new Error("The local engine returned an unusable foreground mask.");
  }

  return cutoutCanvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/webp",
  quality = 0.94
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Unable to create the premium product image."));
      },
      type,
      quality
    );
  });
}

async function loadCanvasImage(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to load the selected product photo.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () =>
        reject(new Error("Unable to decode the selected product photo."));
      element.src = objectUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function drawNcsPremiumBackground(
  ctx: CanvasRenderingContext2D,
  presetId: string,
  width: number,
  height: number
) {
  const floorY = Math.round(height * 0.72);

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  if (presetId === "0") {
    // Primary e-commerce image: quiet, premium and product-first.
    // No frames, shelves or decorative elements that compete with the garment.
    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, "#FEFDFB");
    base.addColorStop(0.56, "#FAF7F1");
    base.addColorStop(1, "#F2ECE2");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const centerGlow = ctx.createRadialGradient(
      width * 0.5,
      height * 0.39,
      width * 0.05,
      width * 0.5,
      height * 0.44,
      width * 0.67
    );
    centerGlow.addColorStop(0, "rgba(255,255,255,0.94)");
    centerGlow.addColorStop(0.58, "rgba(255,255,255,0.35)");
    centerGlow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = centerGlow;
    ctx.fillRect(0, 0, width, height);

    const floor = ctx.createLinearGradient(0, height * 0.75, 0, height);
    floor.addColorStop(0, "rgba(231,222,208,0)");
    floor.addColorStop(1, "rgba(222,210,193,0.28)");
    ctx.fillStyle = floor;
    ctx.fillRect(0, height * 0.72, width, height * 0.28);
  } else if (presetId === "1") {
    const wall = ctx.createLinearGradient(0, 0, width, height);
    wall.addColorStop(0, "#071A43");
    wall.addColorStop(0.55, "#0A2E73");
    wall.addColorStop(1, "#174FA7");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, width, floorY);

    ctx.strokeStyle = "rgba(212,175,55,0.82)";
    ctx.lineWidth = 7;
    roundedRectPath(ctx, 90, 90, width - 180, floorY - 180, 28);
    ctx.stroke();

    ctx.strokeStyle = "rgba(212,175,55,0.30)";
    ctx.lineWidth = 2;
    roundedRectPath(ctx, 125, 125, width - 250, floorY - 250, 22);
    ctx.stroke();

    const floor = ctx.createLinearGradient(0, floorY, 0, height);
    floor.addColorStop(0, "#FAF8F2");
    floor.addColorStop(1, "#E7E0D2");
    ctx.fillStyle = floor;
    ctx.fillRect(0, floorY, width, height - floorY);
  } else if (presetId === "2") {
    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, "#FFFDF9");
    base.addColorStop(0.55, "#F5EFE4");
    base.addColorStop(1, "#E7DED0");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(170,155,132,0.20)";
    ctx.lineWidth = 4;
    for (let i = -height; i < width + height; i += 170) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.bezierCurveTo(
        i + 120,
        height * 0.32,
        i - 80,
        height * 0.62,
        i + 160,
        height
      );
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.40)";
    ctx.fillRect(0, floorY, width, height - floorY);
  } else if (presetId === "3") {
    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, "#F4EEE3");
    base.addColorStop(1, "#D9CDBB");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(10,46,115,0.94)";
    ctx.fillRect(0, 0, 155, floorY);
    ctx.fillRect(width - 155, 0, 155, floorY);

    ctx.fillStyle = "rgba(212,175,55,0.72)";
    for (const x of [65, width - 135]) {
      for (let y = 175; y < floorY - 80; y += 170) {
        ctx.fillRect(x, y, 70, 5);
      }
    }

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(0, floorY, width, height - floorY);
  } else if (presetId === "4") {
    const base = ctx.createRadialGradient(
      width * 0.5,
      height * 0.34,
      70,
      width * 0.5,
      height * 0.42,
      width * 0.78
    );
    base.addColorStop(0, "#FFFFFF");
    base.addColorStop(0.58, "#F4EFE7");
    base.addColorStop(1, "#DFD7CB");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);
  } else if (presetId === "5") {
    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, "#5C1732");
    base.addColorStop(0.58, "#8B2E46");
    base.addColorStop(1, "#D0A658");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(244,210,132,0.62)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(width / 2, floorY * 0.62, 360, Math.PI, 0);
    ctx.lineTo(width / 2 + 360, floorY);
    ctx.stroke();

    ctx.fillStyle = "rgba(250,235,202,0.28)";
    ctx.fillRect(0, floorY, width, height - floorY);
  } else if (presetId === "6") {
    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, "#F7F4FF");
    base.addColorStop(0.5, "#E8F4FF");
    base.addColorStop(1, "#FFF4E9");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const circles = [
      [155, 210, 72, "rgba(100,149,237,0.12)"],
      [1005, 265, 98, "rgba(255,184,193,0.16)"],
      [190, 1010, 90, "rgba(212,175,55,0.12)"],
    ] as const;
    circles.forEach(([x, y, r, color]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  } else if (presetId === "7") {
    const base = ctx.createRadialGradient(
      width * 0.5,
      height * 0.34,
      40,
      width * 0.5,
      height * 0.45,
      width * 0.8
    );
    base.addColorStop(0, "#304B78");
    base.addColorStop(0.5, "#13294F");
    base.addColorStop(1, "#07111F");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const spotlight = ctx.createLinearGradient(0, 0, 0, floorY);
    spotlight.addColorStop(0, "rgba(255,244,210,0.26)");
    spotlight.addColorStop(1, "rgba(255,244,210,0.01)");
    ctx.fillStyle = spotlight;
    ctx.beginPath();
    ctx.moveTo(width * 0.42, 0);
    ctx.lineTo(width * 0.18, floorY);
    ctx.lineTo(width * 0.82, floorY);
    ctx.lineTo(width * 0.58, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, "#F7F4EC");
    base.addColorStop(0.62, "#ECE3D4");
    base.addColorStop(1, "#D4C5AE");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.fillRect(0, 0, width * 0.31, floorY);
    ctx.strokeStyle = "rgba(10,46,115,0.18)";
    ctx.lineWidth = 8;
    ctx.strokeRect(55, 70, width * 0.24, floorY - 140);

    const light = ctx.createLinearGradient(0, 0, width * 0.65, 0);
    light.addColorStop(0, "rgba(255,255,255,0.64)");
    light.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width * 0.72, height);
  }

  const topLight = ctx.createRadialGradient(
    width * 0.5,
    height * 0.13,
    20,
    width * 0.5,
    height * 0.25,
    width * 0.65
  );
  topLight.addColorStop(0, "rgba(255,255,255,0.28)");
  topLight.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = topLight;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}

function refineProductCutoutEdges(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Tighten weak semi-transparent mask pixels that commonly create white/grey halos.
  // RGB product pixels are left untouched; only alpha is refined.
  for (let index = 3; index < data.length; index += 4) {
    const alpha = data[index];

    if (alpha <= 22) {
      data[index] = 0;
    } else if (alpha < 92) {
      data[index] = Math.round(((alpha - 22) / 70) * 72);
    } else if (alpha < 176) {
      data[index] = Math.min(255, Math.round(alpha * 1.08));
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function findAlphaBounds(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
    };
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];
      if (alpha > 18) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
    };
  }

  const paddingX = Math.round((maxX - minX) * 0.025);
  const paddingY = Math.round((maxY - minY) * 0.025);
  const x = Math.max(0, minX - paddingX);
  const y = Math.max(0, minY - paddingY);
  const right = Math.min(canvas.width, maxX + paddingX);
  const bottom = Math.min(canvas.height, maxY + paddingY);

  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}


export default function AddProductPage() {
  const router = useRouter();

  const [form, setForm] = useState<ProductForm>(initialForm);
  const [collections, setCollections] = useState<CollectionOption[]>([]);

  const [saving, setSaving] = useState(false);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingLifestyle, setUploadingLifestyle] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus>({
    type: "idle",
    message: "",
  });

  const [customTag, setCustomTag] = useState("");
  const [customSize, setCustomSize] = useState("");

  const [stockSearch, setStockSearch] = useState("");
  const [stockSearchResults, setStockSearchResults] = useState<
    ExistingStockProduct[]
  >([]);
  const [searchingStock, setSearchingStock] = useState(false);
  const [linkedStockProduct, setLinkedStockProduct] =
    useState<ExistingStockProduct | null>(null);

  const [photoStudioOriginalImages, setPhotoStudioOriginalImages] =
    useState<string[]>([]);
  const [selectedStudioSourceIndex, setSelectedStudioSourceIndex] =
    useState(0);
  const [selectedPhotoStudioPresetId, setSelectedPhotoStudioPresetId] =
    useState("0");
  const [photoStudioEnhancedImage, setPhotoStudioEnhancedImage] =
    useState("");
  const [uploadingStudioSource, setUploadingStudioSource] =
    useState(false);
  const [uploadingStudioEnhanced, setUploadingStudioEnhanced] =
    useState(false);
  const [generatingPremiumPhoto, setGeneratingPremiumPhoto] =
    useState(false);
  const [photoStudioStatus, setPhotoStudioStatus] = useState<AiStatus>({
    type: "idle",
    message: "",
  });

  const photoStudioSourceImages = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...photoStudioOriginalImages,
            form.mainImage,
          ].filter(Boolean)
        )
      ),
    [photoStudioOriginalImages, form.mainImage]
  );

  const selectedPhotoStudioSourceImage =
    photoStudioSourceImages[selectedStudioSourceIndex] ||
    photoStudioSourceImages[0] ||
    "";

  const selectedPhotoStudioPreset =
    ncsPhotoStudioPresets.find(
      (preset) => preset.id === selectedPhotoStudioPresetId
    ) || ncsPhotoStudioPresets[0];

  const photoStudioPrompt = useMemo(() => {
    const productIdentity = [
      linkedStockProduct?.name || form.name.trim(),
      linkedStockProduct?.size || form.sizes[0] || "",
      linkedStockProduct?.color || "",
      form.brand.trim(),
      form.category.trim(),
    ]
      .filter(Boolean)
      .join(" • ");

    return [
      "Use the uploaded product image as the exact product reference.",
      "Preserve the garment exactly: original colour, print, check pattern, fabric appearance, collar shape, sleeves, buttons, stitching, silhouette and design details must remain unchanged.",
      "Remove the existing background and distracting environment completely.",
      "Do not invent tags, accessories, extra props, hands, hangers or packaging.",
      `Create a premium e-commerce image using the NCS studio preset "${selectedPhotoStudioPreset.name}".`,
      `Background style: ${selectedPhotoStudioPreset.backgroundStyle}.`,
      `Recommended use: ${selectedPhotoStudioPreset.recommendedFor}.`,
      "Center the product neatly, keep proportions natural, add a subtle realistic grounding shadow, and make the result clean, premium and catalog-ready.",
      "This image is for NEW CITY STYLE. Keep the final result elegant, premium, realistic and suitable for website upload.",
      productIdentity
        ? `Known product context: ${productIdentity}. Use this only as supporting identity context; do not print this text inside the image.`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, [
    form.brand,
    form.category,
    form.name,
    form.sizes,
    linkedStockProduct?.color,
    linkedStockProduct?.name,
    linkedStockProduct?.size,
    selectedPhotoStudioPreset,
  ]);

  useEffect(() => {
    loadCollections();
  }, []);

  useEffect(() => {
    const mrp = Number(form.mrp || 0);
    const price = Number(form.price || 0);

    if (mrp > 0 && price >= 0 && price <= mrp) {
      const discount = Math.round(((mrp - price) / mrp) * 100);

      setForm((current) => ({
        ...current,
        discountPercent: String(discount),
      }));
    }
  }, [form.mrp, form.price]);

  useEffect(() => {
    if (!photoStudioSourceImages.length) {
      if (selectedStudioSourceIndex !== 0) {
        setSelectedStudioSourceIndex(0);
      }
      return;
    }

    if (selectedStudioSourceIndex >= photoStudioSourceImages.length) {
      setSelectedStudioSourceIndex(photoStudioSourceImages.length - 1);
    }
  }, [photoStudioSourceImages.length, selectedStudioSourceIndex]);

  async function loadCollections() {
    const { data, error } = await supabase
      .from("collections")
      .select("id,name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setCollections((data as CollectionOption[]) || []);
  }

  function asString(value: unknown) {
    return typeof value === "string" ? value : "";
  }

  function asNumber(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function asStringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string =>
          typeof item === "string"
        )
      : [];
  }

  function asSpecifications(value: unknown): Specification[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => {
        const record = item as Record<string, unknown>;
        return {
          label: asString(record.label),
          value: asString(record.value),
        };
      })
      .filter((item) => item.label || item.value);
  }

  function asFaqs(value: unknown): Faq[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => {
        const record = item as Record<string, unknown>;
        return {
          question: asString(record.question),
          answer: asString(record.answer),
        };
      })
      .filter((item) => item.question || item.answer);
  }

  async function searchExistingStockProduct() {
    const query = stockSearch.trim();

    if (!query) {
      alert("Scan a barcode or enter product name, SKU or barcode.");
      return;
    }

    setSearchingStock(true);
    setStockSearchResults([]);

    try {
      const safeQuery = query.replace(/[,%()]/g, " ").trim();
      const pattern = `%${safeQuery}%`;

      const [productsResponse, variantsResponse] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id,name,barcode,sku,stock,online_stock_limit,sell_online,image"
          )
          .or(
            `name.ilike.${pattern},barcode.ilike.${pattern},sku.ilike.${pattern}`
          )
          .limit(12),
        supabase
          .from("product_variants")
          .select(
            "id,product_id,barcode,sku,size,color,stock,reserved_stock,online_stock_limit,sell_online"
          )
          .or(`barcode.ilike.${pattern},sku.ilike.${pattern}`)
          .limit(12),
      ]);

      if (productsResponse.error) throw productsResponse.error;
      if (variantsResponse.error) throw variantsResponse.error;

      const productRows =
        (productsResponse.data || []) as Record<string, unknown>[];
      const variantRows =
        (variantsResponse.data || []) as Record<string, unknown>[];

      const variantProductIds = Array.from(
        new Set(
          variantRows
            .map((row) => asNumber(row.product_id))
            .filter((id) => id > 0)
        )
      );

      let variantParents: Record<string, unknown>[] = [];

      if (variantProductIds.length) {
        const { data, error } = await supabase
          .from("products")
          .select(
            "id,name,barcode,sku,stock,online_stock_limit,sell_online,image"
          )
          .in("id", variantProductIds);

        if (error) throw error;
        variantParents =
          (data || []) as Record<string, unknown>[];
      }

      const parentMap = new Map(
        [...productRows, ...variantParents].map((row) => [
          asNumber(row.id),
          row,
        ])
      );

      const directResults: ExistingStockProduct[] = productRows.map(
        (row) => ({
          id: asNumber(row.id),
          name: asString(row.name) || "Unnamed Product",
          barcode: asString(row.barcode),
          sku: asString(row.sku),
          stock: asNumber(row.stock),
          onlineStockLimit: asNumber(row.online_stock_limit),
          sellOnline: row.sell_online === true,
          image: asString(row.image),
          variantId: null,
          variantBarcode: "",
          variantSku: "",
          size: "",
          color: "",
        })
      );

      const variantResults = variantRows
        .map<ExistingStockProduct | null>((row) => {
          const productId = asNumber(row.product_id);
          const parent = parentMap.get(productId);

          if (!parent) {
            return null;
          }

          const variant: ExistingStockProduct = {
            id: productId,
            name: asString(parent.name) || "Unnamed Product",
            barcode: asString(parent.barcode),
            sku: asString(parent.sku),
            stock: Math.max(
              0,
              asNumber(row.stock) - asNumber(row.reserved_stock)
            ),
            onlineStockLimit: asNumber(row.online_stock_limit),
            sellOnline: row.sell_online === true,
            image: asString(parent.image),
            variantId: asNumber(row.id),
            variantBarcode: asString(row.barcode),
            variantSku: asString(row.sku),
            size: asString(row.size),
            color: asString(row.color),
          };

          return variant;
        })
        .filter(
          (item): item is ExistingStockProduct => item !== null
        );

      const unique = new Map<string, ExistingStockProduct>();
      [...variantResults, ...directResults].forEach((item) => {
        unique.set(`${item.id}-${item.variantId || 0}`, item);
      });

      const results = Array.from(unique.values());
      setStockSearchResults(results);

      if (!results.length) {
        alert("No existing stock product found for this search.");
      }
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? `Stock search failed: ${error.message}`
          : "Stock search failed."
      );
    } finally {
      setSearchingStock(false);
    }
  }

  async function linkExistingStockProduct(
    selected: ExistingStockProduct
  ) {
    setSearchingStock(true);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", selected.id)
        .single();

      if (error) throw error;

      const row = data as Record<string, unknown>;
      const existingSpecs = asSpecifications(
        row.technical_specifications
      );
      const existingFaqs = asFaqs(row.faqs);

      setLinkedStockProduct(selected);
      setStockSearchResults([]);
      setStockSearch(
        selected.variantBarcode || selected.barcode || selected.name
      );

      setForm((current) => ({
        ...current,
        name: asString(row.name),
        slug: asString(row.slug) || createSlug(asString(row.name)),
        tagline: asString(row.tagline),
        category: asString(row.category),
        subcategory: asString(row.subcategory),
        collectionId: row.collection_id
          ? String(row.collection_id)
          : "",
        brand: asString(row.brand) || "NEW CITY STYLE",
        gender: asString(row.gender),
        ageGroup: asString(row.age_group),
        shortDescription: asString(row.short_description),
        description: asString(row.description),
        mrp: String(asNumber(row.mrp) || ""),
        price: String(asNumber(row.price) || ""),
        discountPercent: String(asNumber(row.discount_percent)),
        taxPercent: String(asNumber(row.tax_percent) || ""),
        sku: selected.variantSku || selected.sku,
        barcode: selected.variantBarcode || selected.barcode,
        stock: String(selected.stock),
        lowStockLimit: String(asNumber(row.low_stock_limit) || 5),
        sellOnline: selected.sellOnline,
        onlineStockLimit: String(selected.onlineStockLimit),
        mainImage: asString(row.image),
        galleryImages: asStringArray(row.gallery_images),
        lifestyleImages: asStringArray(row.lifestyle_images),
        tags: asStringArray(row.tags),
        sizes: asStringArray(row.sizes),
        material: asString(row.material),
        fabric: asString(row.fabric),
        pattern: asString(row.pattern),
        sleeveType: asString(row.sleeve_type),
        fitType: asString(row.fit_type),
        occasion: asString(row.occasion),
        lifestyleTitle: asString(row.lifestyle_title),
        lifestyleSubtitle: asString(row.lifestyle_subtitle),
        keyFeatures: asStringArray(row.key_features).length
          ? asStringArray(row.key_features)
          : current.keyFeatures,
        specifications: existingSpecs.length
          ? existingSpecs
          : current.specifications,
        whatsInBox: asStringArray(row.whats_in_box).length
          ? asStringArray(row.whats_in_box)
          : current.whatsInBox,
        faqs: existingFaqs.length ? existingFaqs : current.faqs,
        weight: String(asNumber(row.weight) || ""),
        packageLength: String(asNumber(row.package_length) || ""),
        packageWidth: String(asNumber(row.package_width) || ""),
        packageHeight: String(asNumber(row.package_height) || ""),
        shippingPolicy:
          asString(row.shipping_policy) || current.shippingPolicy,
        returnPolicy:
          asString(row.return_policy) || current.returnPolicy,
        seoTitle: asString(row.seo_title),
        metaDescription: asString(row.meta_description),
        seoKeywords: asString(row.seo_keywords),
        socialPreviewUrl: asString(row.social_preview_url),
        isFeatured: row.is_featured === true,
        isNewArrival: row.is_new_arrival !== false,
        isOnSale: row.is_on_sale === true,
        isBestseller: row.is_bestseller === true,
        isTrending: row.is_trending === true,
        isActive: row.is_active !== false,
      }));

      setPhotoStudioOriginalImages(
        asString(row.image)
          ? [asString(row.image)]
          : []
      );
      setSelectedStudioSourceIndex(0);
      setPhotoStudioEnhancedImage("");
      setPhotoStudioStatus({
        type: "success",
        message:
          "Existing product linked. You can now capture or upload product photos, copy the free AI studio prompt and import the best result.",
      });

      setAiStatus({
        type: "success",
        message:
          "Existing stock product linked. Upload photos and use AI. Barcode and physical stock will be preserved.",
      });
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? `Unable to link product: ${error.message}`
          : "Unable to link product."
      );
    } finally {
      setSearchingStock(false);
    }
  }

  function unlinkExistingStockProduct() {
    setLinkedStockProduct(null);
    setStockSearch("");
    setStockSearchResults([]);
    setForm(initialForm);
    setAiStatus({ type: "idle", message: "" });
    setPhotoStudioOriginalImages([]);
    setSelectedStudioSourceIndex(0);
    setPhotoStudioEnhancedImage("");
    setPhotoStudioStatus({ type: "idle", message: "" });
  }

  function createSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildProductContextPayload() {
    return {
      name: form.name.trim() || linkedStockProduct?.name || "",
      brand: form.brand.trim(),
      category: form.category.trim(),
      subcategory: form.subcategory.trim(),
      gender: form.gender.trim(),
      size:
        linkedStockProduct?.size ||
        form.sizes.join(", ") ||
        "",
      colour:
        linkedStockProduct?.color ||
        "",
      material: form.material.trim(),
      fabric: form.fabric.trim(),
      pattern: form.pattern.trim(),
      sleeveType: form.sleeveType.trim(),
      fit: form.fitType.trim(),
      occasion: form.occasion.trim(),
    };
  }

  function setField<K extends keyof ProductForm>(
    field: K,
    value: ProductForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleProductName(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      slug: createSlug(value),
      seoTitle:
        current.seoTitle ||
        `${value} Online | NEW CITY STYLE`,
    }));
  }

  function validateImage(file: File) {
    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowed.includes(file.type)) {
      alert("Please select JPG, PNG or WEBP images.");
      return false;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert("Each image must be smaller than 8 MB.");
      return false;
    }

    return true;
  }

  async function uploadFile(file: File, folder: string) {
    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const safeName = file.name
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const filePath = `products/${folder}/${safeName}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}.${extension}`;

    const { error } = await supabase.storage
      .from("store-assets")
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage
      .from("store-assets")
      .getPublicUrl(filePath);

    if (!data.publicUrl) {
      throw new Error("Unable to generate image URL.");
    }

    return data.publicUrl;
  }

  async function uploadMainImage(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!validateImage(file)) {
      event.target.value = "";
      return;
    }

    setUploadingMain(true);

    try {
      const url = await uploadFile(file, "main");

      setField("mainImage", url);
      setPhotoStudioOriginalImages((current) =>
        current.includes(url) ? current : [url, ...current]
      );
      setSelectedStudioSourceIndex(0);

      if (!form.socialPreviewUrl) {
        setField("socialPreviewUrl", url);
      }

      alert("Main product image uploaded successfully.");
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? `Image upload failed: ${error.message}`
          : "Image upload failed."
      );
    } finally {
      setUploadingMain(false);
      event.target.value = "";
    }
  }

  async function uploadGalleryImages(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    if (form.galleryImages.length + files.length > 10) {
      alert("Maximum 10 gallery images are allowed.");
      event.target.value = "";
      return;
    }

    const validFiles: File[] = files.filter((file) => validateImage(file));

    if (!validFiles.length) {
      event.target.value = "";
      return;
    }

    setUploadingGallery(true);

    try {
      const urls = await Promise.all(
        validFiles.map((file) => uploadFile(file, "gallery"))
      );

      setForm((current) => ({
        ...current,
        galleryImages: [...current.galleryImages, ...urls],
      }));

      alert("Gallery images uploaded successfully.");
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? `Gallery upload failed: ${error.message}`
          : "Gallery upload failed."
      );
    } finally {
      setUploadingGallery(false);
      event.target.value = "";
    }
  }

  async function uploadLifestyleImages(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    if (form.lifestyleImages.length + files.length > 6) {
      alert("Maximum 6 lifestyle images are allowed.");
      event.target.value = "";
      return;
    }

    const validFiles: File[] = files.filter((file) => validateImage(file));

    if (!validFiles.length) {
      event.target.value = "";
      return;
    }

    setUploadingLifestyle(true);

    try {
      const urls = await Promise.all(
        validFiles.map((file) =>
          uploadFile(file, "lifestyle")
        )
      );

      setForm((current) => ({
        ...current,
        lifestyleImages: [
          ...current.lifestyleImages,
          ...urls,
        ],
      }));

      alert("Lifestyle images uploaded successfully.");
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? `Lifestyle upload failed: ${error.message}`
          : "Lifestyle upload failed."
      );
    } finally {
      setUploadingLifestyle(false);
      event.target.value = "";
    }
  }

  async function uploadPhotoStudioSourceImages(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    const validFiles: File[] = files.filter((file) => validateImage(file));

    if (!validFiles.length) {
      event.target.value = "";
      return;
    }

    setUploadingStudioSource(true);

    try {
      const urls = await Promise.all(
        validFiles.map((file) =>
          uploadFile(file, "studio-source")
        )
      );

      setPhotoStudioOriginalImages((current) =>
        Array.from(new Set([...current, ...urls]))
      );
      setSelectedStudioSourceIndex(0);
      setPhotoStudioStatus({
        type: "success",
        message:
          "Studio source image uploaded. Choose a preset, copy the prompt into any free AI image app, then import the premium result here.",
      });
    } catch (error) {
      console.error(error);
      setPhotoStudioStatus({
        type: "error",
        message:
          error instanceof Error
            ? `Studio source upload failed: ${error.message}`
            : "Studio source upload failed.",
      });
    } finally {
      setUploadingStudioSource(false);
      event.target.value = "";
    }
  }

  async function saveCloudEnhancedImageToStorage(imageUrl: string) {
    if (!imageUrl) {
      throw new Error("Cloud AI returned no enhanced image.");
    }

    let response: Response;

    try {
      response = await fetch(imageUrl, { cache: "no-store" });
    } catch {
      throw new Error("Cloud AI image could not be prepared for storage.");
    }

    if (!response.ok) {
      throw new Error("Cloud AI image could not be downloaded.");
    }

    const blob = await response.blob();
    const mimeType = blob.type || "image/png";
    const extension =
      mimeType.includes("webp")
        ? "webp"
        : mimeType.includes("jpeg") || mimeType.includes("jpg")
          ? "jpg"
          : "png";

    const generatedFile = new File(
      [blob],
      `ncs-cloud-premium-${Date.now()}.${extension}`,
      { type: mimeType }
    );

    return uploadFile(generatedFile, "studio-cloud-generated");
  }

  async function compareCloudImageWithSource(
    sourceUrl: string,
    candidateUrl: string
  ) {
    try {
      const [sourceImage, candidateImage] = await Promise.all([
        loadCanvasImage(sourceUrl),
        loadCanvasImage(candidateUrl),
      ]);

      const sampleSize = 64;
      const sourceCanvas = document.createElement("canvas");
      const candidateCanvas = document.createElement("canvas");
      sourceCanvas.width = sampleSize;
      sourceCanvas.height = sampleSize;
      candidateCanvas.width = sampleSize;
      candidateCanvas.height = sampleSize;

      const sourceCtx = sourceCanvas.getContext("2d", {
        willReadFrequently: true,
      });
      const candidateCtx = candidateCanvas.getContext("2d", {
        willReadFrequently: true,
      });

      if (!sourceCtx || !candidateCtx) {
        return null;
      }

      sourceCtx.drawImage(sourceImage, 0, 0, sampleSize, sampleSize);
      candidateCtx.drawImage(candidateImage, 0, 0, sampleSize, sampleSize);

      const sourcePixels = sourceCtx.getImageData(
        0,
        0,
        sampleSize,
        sampleSize
      ).data;
      const candidatePixels = candidateCtx.getImageData(
        0,
        0,
        sampleSize,
        sampleSize
      ).data;

      let absoluteDifference = 0;
      let changedPixels = 0;
      const pixelCount = sampleSize * sampleSize;

      for (let index = 0; index < sourcePixels.length; index += 4) {
        const redDifference = Math.abs(
          (sourcePixels[index] ?? 0) - (candidatePixels[index] ?? 0)
        );
        const greenDifference = Math.abs(
          (sourcePixels[index + 1] ?? 0) -
            (candidatePixels[index + 1] ?? 0)
        );
        const blueDifference = Math.abs(
          (sourcePixels[index + 2] ?? 0) -
            (candidatePixels[index + 2] ?? 0)
        );

        const pixelDifference =
          (redDifference + greenDifference + blueDifference) / 3;

        absoluteDifference += pixelDifference;

        if (pixelDifference >= 12) {
          changedPixels += 1;
        }
      }

      return {
        meanDifference: absoluteDifference / Math.max(pixelCount, 1),
        changedRatio: changedPixels / Math.max(pixelCount, 1),
      };
    } catch (error) {
      console.warn(
        "NCS cloud output similarity check could not run; keeping provider result eligible:",
        error
      );
      return null;
    }
  }

  async function createValidationProductCutout(imageUrl: string) {
    const sourceImage = await loadCanvasImage(imageUrl);

    try {
      const modnetSegmenter = await getNcsBackgroundRemovalPipeline();
      const modnetOutput = await modnetSegmenter(imageUrl);
      const cutout = await createCutoutCanvasFromLocalOutput(
        sourceImage,
        modnetOutput
      );
      refineProductCutoutEdges(cutout);
      return cutout;
    } catch (modnetError) {
      console.warn(
        "NCS fidelity validation MODNet failed; trying BEN2:",
        modnetError
      );
    }

    const ben2Segmenter = await getNcsBen2BackgroundRemovalPipeline();
    const ben2Output = await ben2Segmenter([imageUrl]);
    const cutout = await createCutoutCanvasFromLocalOutput(
      sourceImage,
      ben2Output
    );
    refineProductCutoutEdges(cutout);
    return cutout;
  }

  function normalizeCutoutForFidelity(
    cutout: HTMLCanvasElement,
    width = 96,
    height = 120
  ) {
    const bounds = findAlphaBounds(cutout);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx) {
      throw new Error("Unable to prepare NCS product-fidelity canvas.");
    }

    ctx.clearRect(0, 0, width, height);
    const scale = Math.min(
      (width * 0.9) / Math.max(bounds.width, 1),
      (height * 0.9) / Math.max(bounds.height, 1)
    );
    const drawWidth = Math.max(1, Math.round(bounds.width * scale));
    const drawHeight = Math.max(1, Math.round(bounds.height * scale));
    const drawX = Math.round((width - drawWidth) / 2);
    const drawY = Math.round((height - drawHeight) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      cutout,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );

    return {
      canvas,
      bounds,
      aspectRatio: bounds.width / Math.max(bounds.height, 1),
    };
  }

  async function compareCloudProductFidelity(
    sourceUrl: string,
    candidateUrl: string
  ) {
    try {
      const [sourceCutout, candidateCutout] = await Promise.all([
        createValidationProductCutout(sourceUrl),
        createValidationProductCutout(candidateUrl),
      ]);

      const source = normalizeCutoutForFidelity(sourceCutout);
      const candidate = normalizeCutoutForFidelity(candidateCutout);
      const sourceCtx = source.canvas.getContext("2d", {
        willReadFrequently: true,
      });
      const candidateCtx = candidate.canvas.getContext("2d", {
        willReadFrequently: true,
      });

      if (!sourceCtx || !candidateCtx) return null;

      const sourcePixels = sourceCtx.getImageData(
        0,
        0,
        source.canvas.width,
        source.canvas.height
      ).data;
      const candidatePixels = candidateCtx.getImageData(
        0,
        0,
        candidate.canvas.width,
        candidate.canvas.height
      ).data;

      let intersection = 0;
      let union = 0;
      let productDifference = 0;
      let productComparedPixels = 0;
      let stronglyChangedProductPixels = 0;

      for (let index = 0; index < sourcePixels.length; index += 4) {
        const sourceAlpha = sourcePixels[index + 3] ?? 0;
        const candidateAlpha = candidatePixels[index + 3] ?? 0;
        const sourceOn = sourceAlpha >= 64;
        const candidateOn = candidateAlpha >= 64;

        if (sourceOn && candidateOn) intersection += 1;
        if (sourceOn || candidateOn) union += 1;

        if (sourceOn && candidateOn) {
          const difference =
            (Math.abs((sourcePixels[index] ?? 0) - (candidatePixels[index] ?? 0)) +
              Math.abs(
                (sourcePixels[index + 1] ?? 0) -
                  (candidatePixels[index + 1] ?? 0)
              ) +
              Math.abs(
                (sourcePixels[index + 2] ?? 0) -
                  (candidatePixels[index + 2] ?? 0)
              )) /
            3;

          productDifference += difference;
          productComparedPixels += 1;
          if (difference >= 70) stronglyChangedProductPixels += 1;
        }
      }

      return {
        silhouetteIou: intersection / Math.max(union, 1),
        aspectRatioDelta:
          Math.abs(source.aspectRatio - candidate.aspectRatio) /
          Math.max(source.aspectRatio, 0.01),
        productMeanDifference:
          productDifference / Math.max(productComparedPixels, 1),
        productStrongChangeRatio:
          stronglyChangedProductPixels / Math.max(productComparedPixels, 1),
      };
    } catch (error) {
      console.warn(
        "NCS strict product-fidelity validation could not complete:",
        error
      );
      return null;
    }
  }

  function isMeaningfullyEnhancedCloudImage(
    comparison: {
      meanDifference: number;
      changedRatio: number;
    } | null
  ) {
    if (!comparison) return true;

    return (
      comparison.meanDifference >= 8 ||
      comparison.changedRatio >= 0.2
    );
  }

  function passesStrictProductFidelity(
    fidelity: {
      silhouetteIou: number;
      aspectRatioDelta: number;
      productMeanDifference: number;
      productStrongChangeRatio: number;
    } | null
  ) {
    // If browser-side segmentation cannot validate, do not silently reject a
    // provider result. The strict prompt still applies and the user must review it.
    if (!fidelity) return true;

    return (
      fidelity.silhouetteIou >= 0.74 &&
      fidelity.aspectRatioDelta <= 0.22 &&
      fidelity.productMeanDifference <= 62 &&
      fidelity.productStrongChangeRatio <= 0.5
    );
  }

  async function generatePremiumPhotoWithCloudAi() {
    const skippedProviders: string[] = [];
    const rejectedProviderNotes: string[] = [];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      setPhotoStudioStatus({
        type: "idle",
        message:
          attempt === 0
            ? "NCS Cloud AI is creating the premium e-commerce image first. Hugging Face is the primary provider; unchanged results will be rejected automatically..."
            : "The previous cloud result was too similar to the source photo. Trying the next AI provider automatically...",
      });

      const response = await fetch("/api/generate-premium-product-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: selectedPhotoStudioSourceImage,
          preset: {
            id: Number(selectedPhotoStudioPreset.id || 1),
            name: selectedPhotoStudioPreset.name,
            description: selectedPhotoStudioPreset.description,
            backgroundStyle: selectedPhotoStudioPreset.backgroundStyle,
            bestFor: selectedPhotoStudioPreset.recommendedFor,
          },
          productContext: buildProductContextPayload(),
          skipProviders: skippedProviders,
        }),
      });

      const result = (await response.json()) as {
        enhancedImageUrl?: string;
        provider?: string;
        model?: string;
        message?: string;
        error?: string;
        providerErrors?: string[];
      };

      if (!response.ok || !result.enhancedImageUrl) {
        const providerDetails = Array.isArray(result.providerErrors)
          ? result.providerErrors.filter(Boolean).join(" | ")
          : "";

        throw new Error(
          [
            result.error || "Cloud AI could not generate the premium image.",
            providerDetails,
            rejectedProviderNotes.join(" | "),
          ]
            .filter(Boolean)
            .join(" ")
        );
      }

      const normalizedProvider = (result.provider || "")
        .trim()
        .toLowerCase();

      const comparison = await compareCloudImageWithSource(
        selectedPhotoStudioSourceImage,
        result.enhancedImageUrl
      );

      if (!isMeaningfullyEnhancedCloudImage(comparison)) {
        if (
          normalizedProvider &&
          !skippedProviders.includes(normalizedProvider)
        ) {
          skippedProviders.push(normalizedProvider);
        }

        rejectedProviderNotes.push(
          `${(result.provider || "Cloud AI").toUpperCase()} returned an image that was too similar to the original and was rejected.`
        );

        if (attempt < 3) {
          continue;
        }

        throw new Error(
          "Cloud providers returned unchanged or near-unchanged images. Switching to the local catalog backup."
        );
      }

      setPhotoStudioStatus({
        type: "idle",
        message:
          `${(result.provider || "AI").toUpperCase()} changed the presentation. NCS is now checking that the exact garment silhouette, colour and print remain faithful...`,
      });

      const fidelity = await compareCloudProductFidelity(
        selectedPhotoStudioSourceImage,
        result.enhancedImageUrl
      );

      if (!passesStrictProductFidelity(fidelity)) {
        if (
          normalizedProvider &&
          !skippedProviders.includes(normalizedProvider)
        ) {
          skippedProviders.push(normalizedProvider);
        }

        const fidelityNote = fidelity
          ? `silhouette ${(fidelity.silhouetteIou * 100).toFixed(0)}%, aspect delta ${(fidelity.aspectRatioDelta * 100).toFixed(0)}%, product change ${(fidelity.productMeanDifference).toFixed(1)}`
          : "fidelity validation unavailable";

        rejectedProviderNotes.push(
          `${(result.provider || "Cloud AI").toUpperCase()} redesigned the garment too much and was rejected by NCS Strict Product Fidelity (${fidelityNote}).`
        );

        if (attempt < 3) {
          setPhotoStudioStatus({
            type: "idle",
            message:
              "That AI result looked premium but changed the actual product. NCS rejected it automatically and is trying the next provider...",
          });
          continue;
        }

        throw new Error(
          "Cloud AI changed the garment structure too much. Switching to the exact-product local catalog backup."
        );
      }

      setPhotoStudioStatus({
        type: "idle",
        message:
          `Cloud AI generated a meaningfully changed image with ${(result.provider || "AI").toUpperCase()}. Saving it safely to NEW CITY STYLE storage...`,
      });

      const storedUrl = await saveCloudEnhancedImageToStorage(
        result.enhancedImageUrl
      );

      setPhotoStudioEnhancedImage(storedUrl);
      setPhotoStudioStatus({
        type: "success",
        message:
          result.message ||
          `Premium photo generated successfully with ${(result.provider || "cloud AI").toUpperCase()}. The result passed NCS meaningful-change and strict product-fidelity checks. Review Original vs Enhanced before using it as the main image.`,
      });
      return;
    }

    throw new Error(
      "No cloud provider returned a meaningfully enhanced premium image."
    );
  }

  async function generatePremiumPhotoDirect() {
    if (!selectedPhotoStudioSourceImage) {
      setPhotoStudioStatus({
        type: "error",
        message:
          "Take or upload a product photo first, then select the source image.",
      });
      return;
    }

    setGeneratingPremiumPhoto(true);
    let cloudFailureMessage = "";

    try {
      try {
        await generatePremiumPhotoWithCloudAi();
        return;
      } catch (cloudError) {
        cloudFailureMessage =
          cloudError instanceof Error
            ? cloudError.message
            : "Cloud AI was unavailable.";

        console.warn(
          "NCS cloud-first premium image generation failed; using local backup:",
          cloudError
        );

        setPhotoStudioStatus({
          type: "idle",
          message:
            "Cloud AI could not complete this image. Using the on-device MODNet/BEN2 catalog engine as the automatic backup...",
        });
      }

      const sourceImage = await loadCanvasImage(
        selectedPhotoStudioSourceImage
      );

      let cutoutCanvas: HTMLCanvasElement | null = null;
      let localEngineUsed = "";
      const localEngineErrors: string[] = [];

      try {
        setPhotoStudioStatus({
          type: "idle",
          message:
            "Local Engine 1 (MODNet): removing the background on this device...",
        });

        const modnetSegmenter =
          await getNcsBackgroundRemovalPipeline();
        const modnetOutput = await modnetSegmenter(
          selectedPhotoStudioSourceImage
        );

        cutoutCanvas = await createCutoutCanvasFromLocalOutput(
          sourceImage,
          modnetOutput
        );
        localEngineUsed = "MODNet";
      } catch (modnetError) {
        const message =
          modnetError instanceof Error
            ? modnetError.message
            : "MODNet failed.";

        localEngineErrors.push(`MODNet: ${message}`);
        console.warn("NCS MODNet local engine failed:", modnetError);

        setPhotoStudioStatus({
          type: "idle",
          message:
            "Local Engine 1 could not isolate this product. Trying Local Engine 2 (BEN2) automatically. The first BEN2 download can take longer, then the browser will cache it...",
        });

        try {
          const ben2Segmenter =
            await getNcsBen2BackgroundRemovalPipeline();
          const ben2Output = await ben2Segmenter([
            selectedPhotoStudioSourceImage,
          ]);

          cutoutCanvas = await createCutoutCanvasFromLocalOutput(
            sourceImage,
            ben2Output
          );
          localEngineUsed = "BEN2";
        } catch (ben2Error) {
          const ben2Message =
            ben2Error instanceof Error
              ? ben2Error.message
              : "BEN2 failed.";

          localEngineErrors.push(`BEN2: ${ben2Message}`);
          console.warn("NCS BEN2 local engine failed:", ben2Error);
        }
      }

      if (!cutoutCanvas) {
        throw new Error(
          localEngineErrors.length
            ? localEngineErrors.join(" | ")
            : "Both local background-removal engines failed."
        );
      }

      setPhotoStudioStatus({
        type: "idle",
        message:
          `${localEngineUsed} removed the background locally. Preparing the selected NCS premium studio background...`,
      });

      // Refine only transparency so the original garment colour/print remains untouched.
      refineProductCutoutEdges(cutoutCanvas);

      const bounds = findAlphaBounds(cutoutCanvas);
      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = 1200;
      outputCanvas.height = 1500;

      const ctx = outputCanvas.getContext("2d");
      if (!ctx) {
        throw new Error("This browser could not create the premium photo canvas.");
      }

      drawNcsPremiumBackground(
        ctx,
        selectedPhotoStudioPresetId,
        outputCanvas.width,
        outputCanvas.height
      );

      const isMainCatalogPreset = selectedPhotoStudioPresetId === "0";
      const maxProductWidth = isMainCatalogPreset ? 850 : 910;
      const maxProductHeight = isMainCatalogPreset ? 1110 : 1125;
      const scale = Math.min(
        maxProductWidth / bounds.width,
        maxProductHeight / bounds.height
      );
      const targetWidth = Math.max(1, Math.round(bounds.width * scale));
      const targetHeight = Math.max(1, Math.round(bounds.height * scale));
      const targetX = Math.round((outputCanvas.width - targetWidth) / 2);

      const safeTop = isMainCatalogPreset ? 135 : 120;
      const safeBottom = isMainCatalogPreset ? 175 : 135;
      const availableHeight = outputCanvas.height - safeTop - safeBottom;
      const targetY = Math.round(
        safeTop + Math.max(0, (availableHeight - targetHeight) * 0.44)
      );

      // Premium contact shadow: deliberately subtle so it reads like studio photography, not a poster mockup.
      ctx.save();
      ctx.fillStyle = isMainCatalogPreset
        ? "rgba(41,37,36,0.075)"
        : "rgba(17,24,39,0.11)";
      ctx.filter = isMainCatalogPreset ? "blur(24px)" : "blur(18px)";
      ctx.beginPath();
      ctx.ellipse(
        outputCanvas.width / 2,
        Math.min(outputCanvas.height - safeBottom + 8, targetY + targetHeight + 18),
        Math.max(112, targetWidth * (isMainCatalogPreset ? 0.27 : 0.32)),
        Math.max(12, targetHeight * (isMainCatalogPreset ? 0.014 : 0.022)),
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();

      ctx.save();
      // Keep garment pixels faithful. Shadow is minimal and only supplies natural separation from the studio.
      ctx.shadowColor = isMainCatalogPreset
        ? "rgba(41,37,36,0.10)"
        : "rgba(15,23,42,0.18)";
      ctx.shadowBlur = isMainCatalogPreset ? 16 : 26;
      ctx.shadowOffsetY = isMainCatalogPreset ? 8 : 16;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        cutoutCanvas,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        targetX,
        targetY,
        targetWidth,
        targetHeight
      );
      ctx.restore();

      const finalBlob = await canvasToBlob(outputCanvas, "image/webp", 0.94);
      const generatedFile = new File(
        [finalBlob],
        `ncs-premium-${Date.now()}.webp`,
        { type: "image/webp" }
      );
      const url = await uploadFile(generatedFile, "studio-generated");

      setPhotoStudioEnhancedImage(url);
      setPhotoStudioStatus({
        type: "success",
        message:
          `Cloud AI was unavailable, so the local backup generated this image with ${localEngineUsed} using ${selectedPhotoStudioPreset.shortLabel} – ${selectedPhotoStudioPreset.name}. ${selectedPhotoStudioPresetId === "0" ? "Clean catalog composition applied: ivory studio, refined edge, controlled scale and subtle contact shadow." : "This creative preset is best suited to gallery/lifestyle presentation."} Review Original vs Enhanced before using it.`,
      });
    } catch (localError) {
      console.error(
        "NCS dual local premium photo generation failed:",
        localError
      );

      const localErrorMessage =
        localError instanceof Error
          ? localError.message
          : "Both local premium photo engines failed.";

      setPhotoStudioStatus({
        type: "error",
        message:
          `Premium photo generation failed. Cloud AI: ${cloudFailureMessage || "Unavailable."} Local backup: ${localErrorMessage}. Please try another photo or preset.`,
      });
    } finally {
      setGeneratingPremiumPhoto(false);
    }
  }

  async function importPhotoStudioEnhancedResult(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!validateImage(file)) {
      event.target.value = "";
      return;
    }

    setUploadingStudioEnhanced(true);

    try {
      const url = await uploadFile(file, "studio-enhanced");
      setPhotoStudioEnhancedImage(url);
      setPhotoStudioStatus({
        type: "success",
        message:
          "Enhanced photo imported successfully. You can now set it as the main image or add it to gallery/lifestyle.",
      });
    } catch (error) {
      console.error(error);
      setPhotoStudioStatus({
        type: "error",
        message:
          error instanceof Error
            ? `Enhanced image import failed: ${error.message}`
            : "Enhanced image import failed.",
      });
    } finally {
      setUploadingStudioEnhanced(false);
      event.target.value = "";
    }
  }

  function useCurrentMainImageAsStudioSource() {
    if (!form.mainImage) {
      setPhotoStudioStatus({
        type: "error",
        message:
          "Upload the main product image first or capture a studio source photo.",
      });
      return;
    }

    setPhotoStudioOriginalImages((current) =>
      current.includes(form.mainImage)
        ? current
        : [form.mainImage, ...current]
    );
    setSelectedStudioSourceIndex(0);
    setPhotoStudioStatus({
      type: "success",
      message:
        "Current main image added to Photo Studio sources.",
    });
  }

  function removePhotoStudioSourceImage(image: string) {
    setPhotoStudioOriginalImages((current) =>
      current.filter((item) => item !== image)
    );
    setPhotoStudioStatus({
      type: "idle",
      message: "",
    });
  }

  async function copyPhotoStudioPrompt() {
    try {
      await navigator.clipboard.writeText(photoStudioPrompt);
      setPhotoStudioStatus({
        type: "success",
        message:
          "Studio prompt copied. Open any free AI image app, generate the premium image and import the best result below.",
      });
    } catch (error) {
      console.error(error);
      setPhotoStudioStatus({
        type: "error",
        message:
          "Could not copy the prompt automatically. You can still copy it manually from the text area.",
      });
    }
  }

  function setEnhancedAsMainImage() {
    if (!photoStudioEnhancedImage) {
      setPhotoStudioStatus({
        type: "error",
        message:
          "Import an enhanced result first.",
      });
      return;
    }

    setForm((current) => ({
      ...current,
      mainImage: photoStudioEnhancedImage,
      socialPreviewUrl:
        current.socialPreviewUrl || photoStudioEnhancedImage,
    }));
    setPhotoStudioStatus({
      type: "success",
      message:
        "Enhanced image set as the main product image.",
    });
  }

  function addEnhancedToGalleryImages() {
    if (!photoStudioEnhancedImage) {
      setPhotoStudioStatus({
        type: "error",
        message:
          "Import an enhanced result first.",
      });
      return;
    }

    if (form.galleryImages.length >= 10) {
      setPhotoStudioStatus({
        type: "error",
        message:
          "Gallery already has the maximum 10 images.",
      });
      return;
    }

    setForm((current) => ({
      ...current,
      galleryImages: current.galleryImages.includes(
        photoStudioEnhancedImage
      )
        ? current.galleryImages
        : [...current.galleryImages, photoStudioEnhancedImage],
    }));
    setPhotoStudioStatus({
      type: "success",
      message:
        "Enhanced image added to the product gallery.",
    });
  }

  function addEnhancedToLifestyleImages() {
    if (!photoStudioEnhancedImage) {
      setPhotoStudioStatus({
        type: "error",
        message:
          "Import an enhanced result first.",
      });
      return;
    }

    if (form.lifestyleImages.length >= 6) {
      setPhotoStudioStatus({
        type: "error",
        message:
          "Lifestyle gallery already has the maximum 6 images.",
      });
      return;
    }

    setForm((current) => ({
      ...current,
      lifestyleImages: current.lifestyleImages.includes(
        photoStudioEnhancedImage
      )
        ? current.lifestyleImages
        : [
            ...current.lifestyleImages,
            photoStudioEnhancedImage,
          ],
    }));
    setPhotoStudioStatus({
      type: "success",
      message:
        "Enhanced image added to the lifestyle gallery.",
    });
  }

  function clearPhotoStudioEnhancedResult() {
    setPhotoStudioEnhancedImage("");
    setPhotoStudioStatus({
      type: "idle",
      message: "",
    });
  }

  async function generateProductDetailsWithAi() {
    const aiImageUrl =
      photoStudioEnhancedImage || form.mainImage;

    if (!aiImageUrl) {
      setAiStatus({
        type: "error",
        message:
          "Please upload or import a product image first.",
      });
      return;
    }

    setGeneratingAi(true);
    setAiStatus({
      type: "idle",
      message: "AI is analysing the product image...",
    });

    try {
      const response = await fetch("/api/generate-product-details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: aiImageUrl,
          productContext: buildProductContextPayload(),
        }),
      });

      const result = (await response.json()) as {
        details?: AiProductDetails;
        error?: string;
        message?: string;
        provider?: string;
        usedFallback?: boolean;
      };

      if (!response.ok || !result.details) {
        throw new Error(
          result.error || "AI could not generate product details."
        );
      }

      const details = result.details;
      const cleanFeatures = details.keyFeatures
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 4);
      const cleanSpecifications = details.technicalSpecifications
        .map((item) => ({
          label: item.label.trim(),
          value: item.value.trim(),
        }))
        .filter((item) => item.label && item.value)
        .slice(0, 3);
      const cleanFaqs = details.faqs
        .map((item) => ({
          question: item.question.trim(),
          answer: item.answer.trim(),
        }))
        .filter((item) => item.question && item.answer)
        .slice(0, 2);
      const cleanBoxItems = details.whatsInTheBox
        .map((item) => item.trim())
        .filter(Boolean);
      const generatedTags = [
        ...details.productTags,
        details.occasion,
      ]
        .map((item) => item.trim())
        .filter(Boolean);

      setForm((current) => ({
        ...current,
        name: details.productName.trim() || current.name,
        slug:
          createSlug(details.slug || details.productName) ||
          current.slug,
        tagline: details.tagline.trim() || current.tagline,
        category: details.category.trim() || current.category,
        subcategory:
          details.subcategory.trim() || current.subcategory,
        shortDescription:
          details.metaDescription.trim() ||
          current.shortDescription,
        description:
          details.description.trim() || current.description,
        gender: details.gender.trim() || current.gender,
        pattern: details.pattern.trim() || current.pattern,
        sleeveType:
          details.sleeveType.trim() || current.sleeveType,
        fitType: details.fit.trim() || current.fitType,
        occasion: details.occasion.trim() || current.occasion,
        lifestyleTitle:
          details.lifestyleTitle.trim() || current.lifestyleTitle,
        lifestyleSubtitle:
          details.lifestyleSubtitle.trim() ||
          current.lifestyleSubtitle,
        keyFeatures: cleanFeatures.length
          ? [
              ...cleanFeatures,
              ...Array(Math.max(4 - cleanFeatures.length, 0)).fill(""),
            ]
          : current.keyFeatures,
        specifications: cleanSpecifications.length
          ? [
              ...cleanSpecifications,
              ...Array(
                Math.max(3 - cleanSpecifications.length, 0)
              ).fill(null).map(() => ({ label: "", value: "" })),
            ]
          : current.specifications,
        whatsInBox: cleanBoxItems.length
          ? cleanBoxItems
          : current.whatsInBox,
        faqs: cleanFaqs.length
          ? [
              ...cleanFaqs,
              ...Array(Math.max(2 - cleanFaqs.length, 0))
                .fill(null)
                .map(() => ({ question: "", answer: "" })),
            ]
          : current.faqs,
        seoTitle: details.seoTitle.trim() || current.seoTitle,
        metaDescription:
          details.metaDescription.trim() ||
          current.metaDescription,
        seoKeywords: details.seoKeywords.length
          ? details.seoKeywords.join(", ")
          : current.seoKeywords,
        tags: Array.from(new Set([...current.tags, ...generatedTags])),
      }));

      const providerLabel = result.provider
        ? result.provider.toUpperCase()
        : "AI";

      setAiStatus({
        type: "success",
        message:
          result.message ||
          `Product draft generated successfully with ${providerLabel}. Review and edit every field before saving.`,
      });
    } catch (error) {
      console.error(error);
      setAiStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "AI generation failed. You can continue entering details manually.",
      });
    } finally {
      setGeneratingAi(false);
    }
  }

  function removeImage(
    type: "galleryImages" | "lifestyleImages",
    index: number
  ) {
    setForm((current) => ({
      ...current,
      [type]: current[type].filter(
        (_, imageIndex) => imageIndex !== index
      ),
    }));
  }
  function toggleTag(tag: string) {
    setForm((current) => ({
      ...current,
      tags: current.tags.includes(tag)
        ? current.tags.filter((item) => item !== tag)
        : [...current.tags, tag],
    }));
  }

  function addCustomTag() {
    const value = customTag.trim();

    if (!value) return;

    if (!form.tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      setField("tags", [...form.tags, value]);
    }

    setCustomTag("");
  }

  function toggleSize(size: string) {
    setForm((current) => ({
      ...current,
      sizes: current.sizes.includes(size)
        ? current.sizes.filter((item) => item !== size)
        : [...current.sizes, size],
    }));
  }


  function addCustomSize() {
    const value = customSize.trim();

    if (!value) return;

    if (!form.sizes.includes(value)) {
      setField("sizes", [...form.sizes, value]);
    }

    setCustomSize("");
  }


  function updateFeature(index: number, value: string) {
    setForm((current) => ({
      ...current,
      keyFeatures: current.keyFeatures.map((feature, featureIndex) =>
        featureIndex === index ? value : feature
      ),
    }));
  }

  function addFeature() {
    setField("keyFeatures", [...form.keyFeatures, ""]);
  }

  function removeFeature(index: number) {
    setField(
      "keyFeatures",
      form.keyFeatures.filter(
        (_, featureIndex) => featureIndex !== index
      )
    );
  }

  function updateSpecification(
    index: number,
    field: keyof Specification,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      specifications: current.specifications.map(
        (specification, specificationIndex) =>
          specificationIndex === index
            ? {
                ...specification,
                [field]: value,
              }
            : specification
      ),
    }));
  }

  function addSpecification() {
    setField("specifications", [
      ...form.specifications,
      { label: "", value: "" },
    ]);
  }

  function removeSpecification(index: number) {
    setField(
      "specifications",
      form.specifications.filter(
        (_, specificationIndex) =>
          specificationIndex !== index
      )
    );
  }

  function updateBoxItem(index: number, value: string) {
    setForm((current) => ({
      ...current,
      whatsInBox: current.whatsInBox.map((item, itemIndex) =>
        itemIndex === index ? value : item
      ),
    }));
  }

  function addBoxItem() {
    setField("whatsInBox", [...form.whatsInBox, ""]);
  }

  function removeBoxItem(index: number) {
    setField(
      "whatsInBox",
      form.whatsInBox.filter(
        (_, itemIndex) => itemIndex !== index
      )
    );
  }

  function updateFaq(
    index: number,
    field: keyof Faq,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      faqs: current.faqs.map((faq, faqIndex) =>
        faqIndex === index
          ? {
              ...faq,
              [field]: value,
            }
          : faq
      ),
    }));
  }

  function addFaq() {
    setField("faqs", [
      ...form.faqs,
      { question: "", answer: "" },
    ]);
  }

  function removeFaq(index: number) {
    setField(
      "faqs",
      form.faqs.filter((_, faqIndex) => faqIndex !== index)
    );
  }

  function getOptionalNumber(value: string, fallback: number) {
    const normalizedValue = value.trim();

    if (!normalizedValue) return fallback;

    const parsedValue = Number(normalizedValue);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  function getCleanFaqs() {
    return form.faqs
      .map((faq) => ({
        question: faq.question.trim(),
        answer: faq.answer.trim(),
      }))
      .filter((faq) => faq.question && faq.answer);
  }

  function validateForm() {
    if (!form.name.trim()) {
      alert("Please enter the product name.");
      return false;
    }

    if (!form.slug.trim()) {
      alert("Please enter the product URL slug.");
      return false;
    }

    if (!form.category.trim()) {
      alert("Please select or enter a category.");
      return false;
    }

    if (!form.description.trim()) {
      alert("Please enter the product description.");
      return false;
    }

    if (Number(form.price) <= 0) {
      alert("Please enter a valid selling price.");
      return false;
    }

    if (
      Number(form.mrp) > 0 &&
      Number(form.price) > Number(form.mrp)
    ) {
      alert("Selling price cannot be greater than MRP.");
      return false;
    }

    if (Number(form.stock) < 0 || !form.stock.trim()) {
      alert("Please enter valid product stock.");
      return false;
    }

    if (
      form.sellOnline &&
      (Number(form.onlineStockLimit) < 0 ||
        Number(form.onlineStockLimit) > Number(form.stock))
    ) {
      alert("Online quantity must be between 0 and total stock.");
      return false;
    }

    if (!form.mainImage) {
      alert("Please upload the main product image.");
      return false;
    }

    return true;
  }

  async function saveProduct(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!validateForm()) return;

    setSaving(true);

    const productData = {
      name: form.name.trim(),
      slug: createSlug(form.slug || form.name),
      tagline: form.tagline.trim() || null,
      short_description:
        form.shortDescription.trim() || null,
      description: form.description.trim(),

      category: form.category.trim(),
      subcategory: form.subcategory.trim() || null,
      collection_id: form.collectionId
        ? Number(form.collectionId)
        : null,
      brand: form.brand.trim() || null,
      gender: form.gender || null,
      age_group: form.ageGroup || null,

      mrp: Number(form.mrp || form.price),
      price: Number(form.price),
      discount_percent: Number(form.discountPercent || 0),
      tax_percent: getOptionalNumber(form.taxPercent, 0),

      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      stock: Number(form.stock),
      low_stock_limit: getOptionalNumber(form.lowStockLimit, 5),
      sell_online: form.sellOnline,
      available_in_pos: true,
      online_stock_limit: form.sellOnline
        ? Math.min(
            Number(form.onlineStockLimit || 0),
            Number(form.stock || 0)
          )
        : 0,

      image: form.mainImage,
      gallery_images: form.galleryImages,
      lifestyle_images: form.lifestyleImages,

      tags: Array.from(
        new Set(
          [
            ...form.tags,
            form.occasion.trim(),
          ].filter(Boolean)
        )
      ),
      sizes: form.sizes,
      colors: [],

      material: form.material.trim() || null,
      fabric: form.fabric.trim() || null,
      pattern: form.pattern.trim() || null,
      sleeve_type: form.sleeveType.trim() || null,
      fit_type: form.fitType.trim() || null,

      key_features: form.keyFeatures
        .map((feature) => feature.trim())
        .filter(Boolean),

      technical_specifications: form.specifications
        .map((specification) => ({
          label: specification.label.trim(),
          value: specification.value.trim(),
        }))
        .filter(
          (specification) =>
            specification.label && specification.value
        ),

      whats_in_box: form.whatsInBox
        .map((item) => item.trim())
        .filter(Boolean),

      // Supabase JSON/JSONB value: [{ question, answer }, ...]
      // Only complete FAQ pairs are saved so storefront rendering stays safe.
      faqs: getCleanFaqs(),

      weight: Number(form.weight || 0),
      package_length: Number(form.packageLength || 0),
      package_width: Number(form.packageWidth || 0),
      package_height: Number(form.packageHeight || 0),

      shipping_policy: form.shippingPolicy.trim() || null,
      return_policy: form.returnPolicy.trim() || null,

      seo_title:
        form.seoTitle.trim() ||
        `${form.name.trim()} | NEW CITY STYLE`,
      meta_description:
        form.metaDescription.trim() ||
        form.shortDescription.trim() ||
        form.description.trim().slice(0, 155),
      seo_keywords: form.seoKeywords.trim() || null,
      social_preview_url:
        form.socialPreviewUrl.trim() ||
        form.mainImage ||
        null,

      is_featured: form.isFeatured,
      is_new_arrival: form.isNewArrival,
      is_on_sale: form.isOnSale,
      is_bestseller: form.isBestseller,
      is_trending: form.isTrending,
      is_active: form.isActive,

      updated_at: new Date().toISOString(),
    };

    if (linkedStockProduct) {
      const {
        sku: _sku,
        barcode: _barcode,
        stock: _stock,
        online_stock_limit: _onlineStockLimit,
        ...detailsOnly
      } = productData;

      const { error } = await supabase
        .from("products")
        .update(detailsOnly)
        .eq("id", linkedStockProduct.id);

      if (error) {
        console.error(error);
        alert(`Unable to update product: ${error.message}`);
        setSaving(false);
        return;
      }

      const { error: onlineStockError } = await supabase.rpc(
        "set_product_online_stock",
        {
          p_product_id: linkedStockProduct.id,
          p_variant_id: linkedStockProduct.variantId,
          p_online_quantity: form.sellOnline
            ? Math.min(
                Number(form.onlineStockLimit || 0),
                linkedStockProduct.stock
              )
            : 0,
          p_sell_online: form.sellOnline,
        }
      );

      if (onlineStockError) {
        console.error(onlineStockError);
        alert(
          `Product details were updated, but online stock failed: ${onlineStockError.message}`
        );
        setSaving(false);
        return;
      }

      alert(
        "Existing stock product updated successfully. Barcode and physical stock were preserved."
      );
    } else {
      const { error } = await supabase
        .from("products")
        .insert(productData);

      if (error) {
        console.error(error);
        alert(`Unable to save product: ${error.message}`);
        setSaving(false);
        return;
      }

      alert("Premium product added successfully.");
    }

    setForm(initialForm);
    setLinkedStockProduct(null);
    setPhotoStudioOriginalImages([]);
    setSelectedStudioSourceIndex(0);
    setPhotoStudioEnhancedImage("");
    setPhotoStudioStatus({ type: "idle", message: "" });
    setSaving(false);

    router.push(`/admin/products`);
    router.refresh();
  }

  const discountAmount = useMemo(() => {
    const mrp = Number(form.mrp || 0);
    const price = Number(form.price || 0);

    return Math.max(mrp - price, 0);
  }, [form.mrp, form.price]);

  const uploading =
    uploadingMain ||
    uploadingGallery ||
    uploadingLifestyle ||
    uploadingStudioSource ||
    uploadingStudioEnhanced ||
    generatingPremiumPhoto;

  return (
    <main style={mainStyle}>
      <div style={containerStyle}>
        <section style={heroStyle}>
          <p style={heroLabelStyle}>NEW CITY STYLE</p>

          <h1 style={heroTitleStyle}>
            Add or Link Premium Product
          </h1>

          <p style={heroDescriptionStyle}>
            Create a new product or link an existing barcode stock item, then add images, AI details, SEO and online visibility.
          </p>
        </section>

        <form onSubmit={saveProduct}>
          <div className="mobile-sticky-save">
            <button
              type="submit"
              aria-label="Save Product"
              title="Save Product"
              disabled={saving || uploading}
              className="mobile-sticky-save-button"
            >
              <span aria-hidden="true">💾</span>
              <span className="mobile-sticky-save-text">
                {saving
                  ? "Saving..."
                  : uploading
                    ? "Uploading..."
                    : linkedStockProduct
                      ? "Update Linked Product"
                      : "Save Product"}
              </span>
            </button>
          </div>

          <div className="product-admin-layout">
            <div
              style={{
                display: "grid",
                gap: "22px",
              }}
            >
              <Panel
                title="Link to Existing Stock Product"
                subtitle="Scan the barcode or search by product name/SKU. Linking preserves the existing barcode and physical stock."
              >
                <div className="existing-stock-search-row">
                  <input
                    value={stockSearch}
                    onChange={(event) =>
                      setStockSearch(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        searchExistingStockProduct();
                      }
                    }}
                    placeholder="Scan barcode or enter product name / SKU"
                    style={inputStyle}
                  />

                  <button
                    type="button"
                    onClick={searchExistingStockProduct}
                    disabled={searchingStock}
                    className="existing-stock-search-button"
                  >
                    {searchingStock ? "Searching..." : "Search Stock"}
                  </button>
                </div>

                {linkedStockProduct && (
                  <div className="linked-stock-card">
                    <div>
                      <span>LINKED STOCK PRODUCT</span>
                      <strong>{linkedStockProduct.name}</strong>
                      <p>
                        Product ID: {linkedStockProduct.id}
                        {linkedStockProduct.variantId
                          ? ` • Variant ID: ${linkedStockProduct.variantId}`
                          : ""}
                      </p>
                      <p>
                        Barcode: {linkedStockProduct.variantBarcode || linkedStockProduct.barcode || "Auto barcode"}
                        {linkedStockProduct.size
                          ? ` • Size: ${linkedStockProduct.size}`
                          : ""}
                        {linkedStockProduct.color
                          ? ` • Colour: ${linkedStockProduct.color}`
                          : ""}
                      </p>
                      <p>
                        Physical Stock: {linkedStockProduct.stock} • Online Quantity: {form.onlineStockLimit || 0}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={unlinkExistingStockProduct}
                    >
                      Unlink
                    </button>
                  </div>
                )}

                {!linkedStockProduct && stockSearchResults.length > 0 && (
                  <div className="existing-stock-results">
                    {stockSearchResults.map((product) => (
                      <button
                        type="button"
                        key={`${product.id}-${product.variantId || 0}`}
                        onClick={() =>
                          linkExistingStockProduct(product)
                        }
                      >
                        <div className="existing-stock-result-image">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                            />
                          ) : (
                            <span>📦</span>
                          )}
                        </div>

                        <div>
                          <strong>{product.name}</strong>
                          <span>
                            {product.variantBarcode || product.barcode || "No barcode"}
                          </span>
                          <small>
                            Stock {product.stock}
                            {product.size ? ` • ${product.size}` : ""}
                            {product.color ? ` • ${product.color}` : ""}
                          </small>
                        </div>

                        <b>Link</b>
                      </button>
                    ))}
                  </div>
                )}

                <div className="existing-stock-note">
                  {linkedStockProduct
                    ? "Now upload the shirt photo and use AI. Saving updates this same product; it does not create a duplicate."
                    : "Leave this empty only when you want to create a completely new product."}
                </div>
              </Panel>

              <Panel
                title="Basic Information"
                subtitle="Add the main product identity and description."
              >
                <FormGrid>
                  <Field label="Product Name" required>
                    <input
                      value={form.name}
                      onChange={(event) =>
                        handleProductName(event.target.value)
                      }
                      placeholder="Premium Men's Cotton Shirt"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="URL Slug" required>
                    <input
                      value={form.slug}
                      onChange={(event) =>
                        setField(
                          "slug",
                          createSlug(event.target.value)
                        )
                      }
                      placeholder="premium-mens-cotton-shirt"
                      style={inputStyle}
                    />
                  </Field>
                </FormGrid>

                <Field label="Tagline">
                  <input
                    value={form.tagline}
                    onChange={(event) =>
                      setField("tagline", event.target.value)
                    }
                    placeholder="Premium comfort with timeless style"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Short Description">
                  <textarea
                    value={form.shortDescription}
                    onChange={(event) =>
                      setField(
                        "shortDescription",
                        event.target.value
                      )
                    }
                    placeholder="Write a short product summary..."
                    style={shortTextareaStyle}
                  />
                </Field>

                <Field label="Full Description" required>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setField(
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="Write the complete product description..."
                    style={largeTextareaStyle}
                  />
                </Field>
              </Panel>

              <Panel
                title="Category and Product Classification"
                subtitle="Configure category, collection and customer filters."
              >
                <FormGrid>
                  <Field label="Category" required>
                    <input
                      value={form.category}
                      onChange={(event) =>
                        setField("category", event.target.value)
                      }
                      placeholder="Example: Men"
                      list="product-categories"
                      style={inputStyle}
                    />

                    <datalist id="product-categories">
                      <option value="Men" />
                      <option value="Women" />
                      <option value="Kids" />
                      <option value="Sarees" />
                      <option value="Shirts" />
                      <option value="T-Shirts" />
                      <option value="Jeans" />
                      <option value="Ethnic Wear" />
                      <option value="Sports Wear" />
                    </datalist>
                  </Field>

                  <Field label="Subcategory">
                    <input
                      value={form.subcategory}
                      onChange={(event) =>
                        setField(
                          "subcategory",
                          event.target.value
                        )
                      }
                      placeholder="Example: Casual Shirts"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Collection">
                    <select
                      value={form.collectionId}
                      onChange={(event) =>
                        setField(
                          "collectionId",
                          event.target.value
                        )
                      }
                      style={inputStyle}
                    >
                      <option value="">
                        No Collection
                      </option>

                      {collections.map((collection) => (
                        <option
                          key={collection.id}
                          value={collection.id}
                        >
                          {collection.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Brand">
                    <input
                      value={form.brand}
                      onChange={(event) =>
                        setField("brand", event.target.value)
                      }
                      placeholder="NEW CITY STYLE"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Gender">
                    <select
                      value={form.gender}
                      onChange={(event) =>
                        setField("gender", event.target.value)
                      }
                      style={inputStyle}
                    >
                      <option value="">Select Gender</option>
                      <option value="Men">Men</option>
                      <option value="Women">Women</option>
                      <option value="Boys">Boys</option>
                      <option value="Girls">Girls</option>
                      <option value="Unisex">Unisex</option>
                    </select>
                  </Field>

                  <Field label="Age Group">
                    <select
                      value={form.ageGroup}
                      onChange={(event) =>
                        setField("ageGroup", event.target.value)
                      }
                      style={inputStyle}
                    >
                      <option value="">Select Age Group</option>
                      <option value="Kids">Kids</option>
                      <option value="Teen">Teen</option>
                      <option value="Adults">Adults</option>
                      <option value="All Ages">All Ages</option>
                    </select>
                  </Field>
                </FormGrid>
              </Panel>

              <Panel
                title="Pricing"
                subtitle="Configure MRP, selling price, discount and GST."
              >
                <FormGrid>
                  <Field label="MRP">
                    <MoneyInput
                      value={form.mrp}
                      onChange={(value) =>
                        setField("mrp", value)
                      }
                      placeholder="1499"
                    />
                  </Field>

                  <Field label="Selling Price" required>
                    <MoneyInput
                      value={form.price}
                      onChange={(value) =>
                        setField("price", value)
                      }
                      placeholder="999"
                    />
                  </Field>

                  <Field label="Discount Percentage">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.discountPercent}
                      readOnly
                      style={{
                        ...inputStyle,
                        background: "#F3F4F6",
                      }}
                    />
                  </Field>

                  <Field label="GST Percentage (Optional)">
                    <input
                      type="number"
                      min="0"
                      value={form.taxPercent}
                      onChange={(event) =>
                        setField(
                          "taxPercent",
                          event.target.value
                        )
                      }
                      placeholder="Blank saves as 0"
                      style={inputStyle}
                    />
                  </Field>
                </FormGrid>

                <div style={pricingSummaryStyle}>
                  <span>
                    Customer saves:{" "}
                    <strong>
                      ₹{discountAmount.toLocaleString("en-IN")}
                    </strong>
                  </span>

                  <span>
                    Discount:{" "}
                    <strong>
                      {form.discountPercent || 0}% OFF
                    </strong>
                  </span>
                </div>
              </Panel>

              <Panel
                title="Inventory"
                subtitle="Configure SKU, barcode and product stock."
              >
                <FormGrid>
                  <Field label="SKU">
                    <input
                      value={form.sku}
                      readOnly={Boolean(linkedStockProduct)}
                      onChange={(event) =>
                        setField(
                          "sku",
                          event.target.value.toUpperCase()
                        )
                      }
                      placeholder="NCS-SHIRT-001"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Barcode">
                    <input
                      value={form.barcode}
                      readOnly={Boolean(linkedStockProduct)}
                      onChange={(event) =>
                        setField("barcode", event.target.value)
                      }
                      placeholder="Barcode number"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Total Stock" required>
                    <input
                      type="number"
                      min="0"
                      value={form.stock}
                      readOnly={Boolean(linkedStockProduct)}
                      onChange={(event) =>
                        setField("stock", event.target.value)
                      }
                      placeholder="50"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Low Stock Alert (Optional)">
                    <input
                      type="number"
                      min="0"
                      value={form.lowStockLimit}
                      onChange={(event) =>
                        setField(
                          "lowStockLimit",
                          event.target.value
                        )
                      }
                      placeholder="Blank saves as 5"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Online Quantity">
                    <input
                      type="number"
                      min="0"
                      max={Number(form.stock || 0)}
                      value={form.sellOnline ? form.onlineStockLimit : "0"}
                      disabled={!form.sellOnline}
                      onChange={(event) =>
                        setField(
                          "onlineStockLimit",
                          String(
                            Math.min(
                              Number(form.stock || 0),
                              Math.max(0, Number(event.target.value || 0))
                            )
                          )
                        )
                      }
                      placeholder="Quantity for website/app"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Online Visibility">
                    <div className="inventory-online-toggle">
                      <input
                        type="checkbox"
                        checked={form.sellOnline}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setForm((current) => ({
                            ...current,
                            sellOnline: checked,
                            onlineStockLimit: checked
                              ? current.onlineStockLimit || current.stock || "0"
                              : "0",
                          }));
                        }}
                      />
                      <div>
                        <strong>Sell Online</strong>
                        <span>Website and Android app visibility</span>
                      </div>
                    </div>
                  </Field>
                </FormGrid>

                {linkedStockProduct && (
                  <div className="inventory-lock-note">
                    🔒 Barcode, SKU and physical stock are locked because this page is linked to an existing purchase stock item.
                  </div>
                )}
              </Panel>

              <Panel
                title="Main Product Image"
                subtitle="Upload the primary image shown on product cards."
              >
                <UploadBox
                  uploading={uploadingMain}
                  label="Upload Main Product Image"
                  description="JPG, PNG or WEBP — Maximum 8 MB"
                  multiple={false}
                  onChange={uploadMainImage}
                />

                {form.mainImage && (
                  <ImagePreview
                    image={form.mainImage}
                    onRemove={() =>
                      setField("mainImage", "")
                    }
                    large
                  />
                )}
              </Panel>

              <Panel
                title="NCS Smart Product Studio"
                subtitle="Take or upload a product photo and generate a premium e-commerce image with NCS Cloud AI first. If Cloud AI is unavailable, the on-device MODNet/BEN2 catalog engine runs automatically as backup. Existing stock, barcode, offline pricing and online stock rules stay untouched."
              >
                <div style={photoStudioHeaderActionsStyle}>
                  <button
                    type="button"
                    onClick={useCurrentMainImageAsStudioSource}
                    style={photoStudioSecondaryButtonStyle}
                  >
                    Use Current Main Image as Source
                  </button>
                </div>

                <div style={photoStudioUploadGridStyle}>
                  <UploadBox
                    uploading={uploadingStudioSource}
                    label="📷 Take Product Photo"
                    description="Open camera and upload a raw shop/product photo"
                    multiple
                    capture="environment"
                    onChange={uploadPhotoStudioSourceImages}
                  />

                  <UploadBox
                    uploading={uploadingStudioSource}
                    label="🖼 Upload from Gallery"
                    description="Choose product images from phone or computer gallery"
                    multiple
                    onChange={uploadPhotoStudioSourceImages}
                  />
                </div>

                {photoStudioSourceImages.length > 0 && (
                  <>
                    <div style={photoStudioSectionLabelStyle}>
                      Source Product Photos
                    </div>

                    <div style={photoStudioSourceGridStyle}>
                      {photoStudioSourceImages.map((image, index) => (
                        <div
                          key={`${image}-${index}`}
                          style={{
                            ...photoStudioSourceCardStyle,
                            border:
                              image === selectedPhotoStudioSourceImage
                                ? "2px solid #0A2E73"
                                : "1px solid #E5E7EB",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedStudioSourceIndex(index)
                            }
                            style={photoStudioSourceSelectButtonStyle}
                          >
                            <img
                              src={image}
                              alt={`Studio source ${index + 1}`}
                              style={photoStudioSourceImageStyle}
                            />
                          </button>

                          <div style={photoStudioSourceMetaStyle}>
                            <span>
                              {image === form.mainImage
                                ? "Main Image"
                                : `Source ${index + 1}`}
                            </span>

                            {image !== form.mainImage && (
                              <button
                                type="button"
                                onClick={() =>
                                  removePhotoStudioSourceImage(image)
                                }
                                style={photoStudioMiniDangerButtonStyle}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div style={photoStudioSectionLabelStyle}>
                  Choose NCS Premium Background Preset
                </div>

                <div style={photoStudioPresetGridStyle}>
                  {ncsPhotoStudioPresets.map((preset) => (
                    <button
                      type="button"
                      key={preset.id}
                      onClick={() =>
                        setSelectedPhotoStudioPresetId(preset.id)
                      }
                      style={{
                        ...photoStudioPresetCardStyle,
                        border:
                          selectedPhotoStudioPresetId === preset.id
                            ? "2px solid #0A2E73"
                            : "1px solid #D1D5DB",
                        background:
                          selectedPhotoStudioPresetId === preset.id
                            ? "#EFF6FF"
                            : "#FFFFFF",
                      }}
                    >
                      <div style={photoStudioPresetNumberStyle}>
                        {preset.shortLabel}
                      </div>
                      <strong style={photoStudioPresetTitleStyle}>
                        {preset.name}
                      </strong>
                      <p style={photoStudioPresetTextStyle}>
                        {preset.description}
                      </p>
                      <small style={photoStudioPresetSmallTextStyle}>
                        Best for: {preset.recommendedFor}
                      </small>
                    </button>
                  ))}
                </div>

                <div style={photoStudioDirectCardStyle}>
                  <div>
                    <strong style={photoStudioDirectTitleStyle}>
                      ✨ Generate Premium Photo Directly
                    </strong>
                    <p style={photoStudioDirectTextStyle}>
                      One-click premium product generation. NCS Cloud AI is tried first for a true boutique-style e-commerce result; if cloud generation is unavailable, the on-device MODNet/BEN2 engine creates a safe catalog fallback while preserving the original garment pixels.
                    </p>
                    <small style={photoStudioDirectSmallStyle}>
                      MAIN – NCS World-Class Catalog uses a light luxury boutique scene with soft top light, blurred clothing displays and a clean premium retail depth. No manual prompt or import step is required.
                    </small>
                  </div>

                  <button
                    type="button"
                    onClick={generatePremiumPhotoDirect}
                    disabled={
                      generatingPremiumPhoto ||
                      uploadingStudioSource ||
                      !selectedPhotoStudioSourceImage
                    }
                    style={{
                      ...photoStudioGenerateDirectButtonStyle,
                      opacity:
                        generatingPremiumPhoto ||
                        uploadingStudioSource ||
                        !selectedPhotoStudioSourceImage
                          ? 0.65
                          : 1,
                      cursor:
                        generatingPremiumPhoto ||
                        uploadingStudioSource ||
                        !selectedPhotoStudioSourceImage
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {generatingPremiumPhoto
                      ? "Generating Premium Photo..."
                      : `✨ Generate with Preset ${selectedPhotoStudioPreset.shortLabel}`}
                  </button>
                </div>

                {(selectedPhotoStudioSourceImage || photoStudioEnhancedImage) && (
                  <div style={photoStudioCompareGridStyle}>
                    <div style={photoStudioCompareCardStyle}>
                      <div style={photoStudioCompareLabelStyle}>Original / Source</div>
                      {selectedPhotoStudioSourceImage ? (
                        <img
                          src={selectedPhotoStudioSourceImage}
                          alt="Original product source"
                          style={photoStudioCompareImageStyle}
                        />
                      ) : (
                        <div style={photoStudioEmptyPreviewStyle}>No source selected</div>
                      )}
                    </div>

                    <div style={photoStudioCompareCardStyle}>
                      <div style={photoStudioCompareLabelStyle}>Enhanced Result</div>
                      {photoStudioEnhancedImage ? (
                        <img
                          src={photoStudioEnhancedImage}
                          alt="Enhanced product result"
                          style={photoStudioCompareImageStyle}
                        />
                      ) : (
                        <div style={photoStudioEmptyPreviewStyle}>Premium result will appear here</div>
                      )}
                    </div>
                  </div>
                )}

                <div style={photoStudioResultActionsStyle}>
                  <button
                    type="button"
                    onClick={setEnhancedAsMainImage}
                    style={photoStudioPrimaryButtonStyle}
                    disabled={!photoStudioEnhancedImage}
                  >
                    Set Enhanced as Main Image
                  </button>

                  <button
                    type="button"
                    onClick={addEnhancedToGalleryImages}
                    style={photoStudioSecondaryButtonStyle}
                    disabled={!photoStudioEnhancedImage}
                  >
                    Add Enhanced to Gallery
                  </button>

                  <button
                    type="button"
                    onClick={addEnhancedToLifestyleImages}
                    style={photoStudioSecondaryButtonStyle}
                    disabled={!photoStudioEnhancedImage}
                  >
                    Add Enhanced to Lifestyle
                  </button>

                  <button
                    type="button"
                    onClick={clearPhotoStudioEnhancedResult}
                    style={photoStudioDangerButtonStyle}
                    disabled={!photoStudioEnhancedImage}
                  >
                    Clear Enhanced Result
                  </button>
                </div>

                {photoStudioStatus.message && (
                  <div
                    role={photoStudioStatus.type === "error" ? "alert" : "status"}
                    style={{
                      ...aiStatusStyle,
                      borderColor:
                        photoStudioStatus.type === "error"
                          ? "#DC2626"
                          : photoStudioStatus.type === "success"
                            ? "#15803D"
                            : "#D4AF37",
                      background:
                        photoStudioStatus.type === "error"
                          ? "#FEF2F2"
                          : photoStudioStatus.type === "success"
                            ? "#F0FDF4"
                            : "#FFFBEA",
                      color:
                        photoStudioStatus.type === "error"
                          ? "#991B1B"
                          : photoStudioStatus.type === "success"
                            ? "#166534"
                            : "#7C5B00",
                    }}
                  >
                    {photoStudioStatus.message}
                  </div>
                )}
              </Panel>

              <Panel
                title="AI Product Detail Generator"
                subtitle="AI analyses the enhanced image when available, otherwise the current main image. Price, MRP, stock, SKU, sizes, tax and low-stock values are never changed."
              >
                <div style={aiGeneratorCardStyle}>
                  <div>
                    <strong style={aiGeneratorTitleStyle}>
                      Generate Product Details with AI
                    </strong>
                    <p style={aiGeneratorTextStyle}>
                      Upload the main product image first, then generate.
                      Always verify category, pattern and all written
                      details before saving.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={generateProductDetailsWithAi}
                    disabled={
                      generatingAi ||
                      uploadingMain ||
                      uploadingStudioEnhanced ||
                      generatingPremiumPhoto ||
                      !(photoStudioEnhancedImage || form.mainImage)
                    }
                    style={{
                      ...aiGenerateButtonStyle,
                      opacity:
                        generatingAi ||
                        uploadingMain ||
                        uploadingStudioEnhanced ||
                        generatingPremiumPhoto ||
                        !(photoStudioEnhancedImage || form.mainImage)
                          ? 0.65
                          : 1,
                      cursor:
                        generatingAi ||
                        uploadingMain ||
                        uploadingStudioEnhanced ||
                        generatingPremiumPhoto ||
                        !(photoStudioEnhancedImage || form.mainImage)
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {generatingAi
                      ? "Generating with Gemini..."
                      : "✨ Generate Product Details with AI"}
                  </button>
                </div>

                {aiStatus.message && (
                  <div
                    role={aiStatus.type === "error" ? "alert" : "status"}
                    style={{
                      ...aiStatusStyle,
                      borderColor:
                        aiStatus.type === "error"
                          ? "#DC2626"
                          : aiStatus.type === "success"
                            ? "#15803D"
                            : "#D4AF37",
                      background:
                        aiStatus.type === "error"
                          ? "#FEF2F2"
                          : aiStatus.type === "success"
                            ? "#F0FDF4"
                            : "#FFFBEA",
                      color:
                        aiStatus.type === "error"
                          ? "#991B1B"
                          : aiStatus.type === "success"
                            ? "#166534"
                            : "#7C5B00",
                    }}
                  >
                    {aiStatus.message}
                  </div>
                )}
              </Panel>

              <Panel
                title="Product Gallery"
                subtitle="Upload up to 10 additional product images."
              >
                <UploadBox
                  uploading={uploadingGallery}
                  label="Upload Gallery Images"
                  description={`${form.galleryImages.length}/10 images uploaded`}
                  multiple
                  onChange={uploadGalleryImages}
                />

                <ImageGrid
                  images={form.galleryImages}
                  onRemove={(index) =>
                    removeImage("galleryImages", index)
                  }
                />
              </Panel>

              <Panel
                title="Lifestyle Gallery"
                subtitle="Upload model, showroom and lifestyle photographs."
              >
                <FormGrid>
                  <Field label="Lifestyle Gallery Title">
                    <input
                      value={form.lifestyleTitle}
                      onChange={(event) =>
                        setField("lifestyleTitle", event.target.value)
                      }
                      placeholder="Styled for Every Moment"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Lifestyle Gallery Subtitle">
                    <input
                      value={form.lifestyleSubtitle}
                      onChange={(event) =>
                        setField("lifestyleSubtitle", event.target.value)
                      }
                      placeholder="Premium fashion for everyday confidence"
                      style={inputStyle}
                    />
                  </Field>
                </FormGrid>

                <UploadBox
                  uploading={uploadingLifestyle}
                  label="Upload Lifestyle Images"
                  description={`${form.lifestyleImages.length}/6 images uploaded`}
                  multiple
                  onChange={uploadLifestyleImages}
                />

                <ImageGrid
                  images={form.lifestyleImages}
                  onRemove={(index) =>
                    removeImage("lifestyleImages", index)
                  }
                />
              </Panel>

              <Panel
                title="Product Tags"
                subtitle="Add searchable tags customers can use to discover and filter this product."
              >
                <div style={chipGridStyle}>
                  {commonTags.map((tag) => (
                    <ChipButton
                      key={tag}
                      label={tag}
                      selected={form.tags.includes(tag)}
                      onClick={() => toggleTag(tag)}
                    />
                  ))}
                </div>

                <InlineAdd
                  value={customTag}
                  placeholder="Custom tag"
                  buttonLabel="Add Tag"
                  onChange={setCustomTag}
                  onAdd={addCustomTag}
                />

                <SelectedValues
                  values={form.tags}
                  onRemove={toggleTag}
                />
              </Panel>

              <Panel
                title="Sizes"
                subtitle="Select all available product sizes."
              >
                <div style={chipGridStyle}>
                  {commonSizes.map((size) => (
                    <ChipButton
                      key={size}
                      label={size}
                      selected={form.sizes.includes(size)}
                      onClick={() => toggleSize(size)}
                    />
                  ))}
                </div>

                <InlineAdd
                  value={customSize}
                  placeholder="Custom size"
                  buttonLabel="Add Size"
                  onChange={setCustomSize}
                  onAdd={addCustomSize}
                />

                <SelectedValues
                  values={form.sizes}
                  onRemove={toggleSize}
                />
              </Panel>

              <Panel
                title="Product Attributes"
                subtitle="Add material, fabric, pattern, sleeves and fit information."
              >
                <FormGrid>
                  <Field label="Material">
                    <input
                      value={form.material}
                      onChange={(event) =>
                        setField("material", event.target.value)
                      }
                      placeholder="Example: Cotton, Polyester, Silk"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Fabric">
                    <input
                      value={form.fabric}
                      onChange={(event) =>
                        setField("fabric", event.target.value)
                      }
                      placeholder="Example: 100% Cotton"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Pattern">
                    <input
                      value={form.pattern}
                      onChange={(event) =>
                        setField("pattern", event.target.value)
                      }
                      placeholder="Example: Solid"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Sleeve Type">
                    <input
                      value={form.sleeveType}
                      onChange={(event) =>
                        setField(
                          "sleeveType",
                          event.target.value
                        )
                      }
                      placeholder="Example: Full Sleeve"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Fit Type">
                    <input
                      value={form.fitType}
                      onChange={(event) =>
                        setField("fitType", event.target.value)
                      }
                      placeholder="Example: Regular Fit"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Occasion">
                    <input
                      value={form.occasion}
                      onChange={(event) =>
                        setField("occasion", event.target.value)
                      }
                      placeholder="Example: Casual, Festive, Party Wear"
                      style={inputStyle}
                    />
                  </Field>
                </FormGrid>
              </Panel>

              <Panel
                title="Key Features"
                subtitle="Add the most important product benefits."
              >
                {form.keyFeatures.map((feature, index) => (
                  <DynamicRow key={index}>
                    <input
                      value={feature}
                      onChange={(event) =>
                        updateFeature(
                          index,
                          event.target.value
                        )
                      }
                      placeholder={`Key feature ${index + 1}`}
                      style={inputStyle}
                    />

                    <RemoveButton
                      onClick={() => removeFeature(index)}
                    />
                  </DynamicRow>
                ))}

                <AddButton
                  label="Add Key Feature"
                  onClick={addFeature}
                />
              </Panel>

              <Panel
                title="Technical Specifications"
                subtitle="Three specification fields are recommended."
              >
                {form.specifications.map(
                  (specification, index) => (
                    <DynamicRow key={index}>
                      <input
                        value={specification.label}
                        onChange={(event) =>
                          updateSpecification(
                            index,
                            "label",
                            event.target.value
                          )
                        }
                        placeholder="Specification name"
                        style={inputStyle}
                      />

                      <input
                        value={specification.value}
                        onChange={(event) =>
                          updateSpecification(
                            index,
                            "value",
                            event.target.value
                          )
                        }
                        placeholder="Specification value"
                        style={inputStyle}
                      />

                      <RemoveButton
                        onClick={() =>
                          removeSpecification(index)
                        }
                      />
                    </DynamicRow>
                  )
                )}

                <AddButton
                  label="Add Specification"
                  onClick={addSpecification}
                />
              </Panel>

              <Panel
                title="What's in the Box"
                subtitle="List all items supplied with this product."
              >
                {form.whatsInBox.map((item, index) => (
                  <DynamicRow key={index}>
                    <input
                      value={item}
                      onChange={(event) =>
                        updateBoxItem(
                          index,
                          event.target.value
                        )
                      }
                      placeholder="Example: 1 x Shirt"
                      style={inputStyle}
                    />

                    <RemoveButton
                      onClick={() => removeBoxItem(index)}
                    />
                  </DynamicRow>
                ))}

                <AddButton
                  label="Add Box Item"
                  onClick={addBoxItem}
                />
              </Panel>

              <Panel
                title="Frequently Asked Questions"
                subtitle="Two FAQs are included by default."
              >
                {form.faqs.map((faq, index) => (
                  <div key={index} style={faqCardStyle}>
                    <div style={faqHeaderStyle}>
                      <strong style={{ color: "#0A2E73" }}>
                        FAQ {index + 1}
                      </strong>

                      <RemoveButton
                        onClick={() => removeFaq(index)}
                      />
                    </div>

                    <input
                      value={faq.question}
                      onChange={(event) =>
                        updateFaq(
                          index,
                          "question",
                          event.target.value
                        )
                      }
                      placeholder="Customer question"
                      style={inputStyle}
                    />

                    <textarea
                      value={faq.answer}
                      onChange={(event) =>
                        updateFaq(
                          index,
                          "answer",
                          event.target.value
                        )
                      }
                      placeholder="Answer"
                      style={{
                        ...shortTextareaStyle,
                        marginTop: "10px",
                      }}
                    />
                  </div>
                ))}

                <AddButton
                  label="Add FAQ"
                  onClick={addFaq}
                />
              </Panel>

              <Panel
                title="Shipping Details"
                subtitle="Add product weight, dimensions and policies."
              >
                <FormGrid>
                  <Field label="Weight (kg)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.weight}
                      onChange={(event) =>
                        setField("weight", event.target.value)
                      }
                      placeholder="0.5"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Package Length (cm)">
                    <input
                      type="number"
                      min="0"
                      value={form.packageLength}
                      onChange={(event) =>
                        setField(
                          "packageLength",
                          event.target.value
                        )
                      }
                      placeholder="30"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Package Width (cm)">
                    <input
                      type="number"
                      min="0"
                      value={form.packageWidth}
                      onChange={(event) =>
                        setField(
                          "packageWidth",
                          event.target.value
                        )
                      }
                      placeholder="25"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Package Height (cm)">
                    <input
                      type="number"
                      min="0"
                      value={form.packageHeight}
                      onChange={(event) =>
                        setField(
                          "packageHeight",
                          event.target.value
                        )
                      }
                      placeholder="5"
                      style={inputStyle}
                    />
                  </Field>
                </FormGrid>

                <Field label="Shipping Policy">
                  <textarea
                    value={form.shippingPolicy}
                    onChange={(event) =>
                      setField(
                        "shippingPolicy",
                        event.target.value
                      )
                    }
                    style={shortTextareaStyle}
                  />
                </Field>

                <Field label="Return / Refund Policy">
                  <textarea
                    value={form.returnPolicy}
                    onChange={(event) =>
                      setField(
                        "returnPolicy",
                        event.target.value
                      )
                    }
                    style={shortTextareaStyle}
                  />
                </Field>
              </Panel>

              <Panel
                title="SEO"
                subtitle="Improve product visibility in Google and social media."
              >
                <Field label="SEO Title">
                  <input
                    value={form.seoTitle}
                    maxLength={70}
                    onChange={(event) =>
                      setField("seoTitle", event.target.value)
                    }
                    placeholder="Premium Product | NEW CITY STYLE"
                    style={inputStyle}
                  />

                  <CharacterCount
                    value={form.seoTitle.length}
                    maximum={70}
                  />
                </Field>

                <Field label="Meta Description">
                  <textarea
                    value={form.metaDescription}
                    maxLength={160}
                    onChange={(event) =>
                      setField(
                        "metaDescription",
                        event.target.value
                      )
                    }
                    placeholder="Write a Google-friendly product description..."
                    style={shortTextareaStyle}
                  />

                  <CharacterCount
                    value={form.metaDescription.length}
                    maximum={160}
                  />
                </Field>

                <Field label="SEO Keywords">
                  <input
                    value={form.seoKeywords}
                    onChange={(event) =>
                      setField(
                        "seoKeywords",
                        event.target.value
                      )
                    }
                    placeholder="shirt, mens shirt, cotton shirt"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Social Preview Image URL">
                  <input
                    value={form.socialPreviewUrl}
                    onChange={(event) =>
                      setField(
                        "socialPreviewUrl",
                        event.target.value
                      )
                    }
                    placeholder="Normally the main product image is used"
                    style={inputStyle}
                  />
                </Field>
              </Panel>

              <Panel
                title="Product Status"
                subtitle="Control product visibility and marketing badges."
              >
                <div className="status-toggle-grid">
                  <Toggle
                    label="Active Product"
                    description="Visible to customers"
                    value={form.isActive}
                    onChange={(value) =>
                      setField("isActive", value)
                    }
                  />

                  <Toggle
                    label="Featured Product"
                    description="Display in featured section"
                    value={form.isFeatured}
                    onChange={(value) =>
                      setField("isFeatured", value)
                    }
                  />

                  <Toggle
                    label="New Arrival"
                    description="Display new arrival badge"
                    value={form.isNewArrival}
                    onChange={(value) =>
                      setField("isNewArrival", value)
                    }
                  />

                  <Toggle
                    label="On Sale"
                    description="Include in sale and discount filters"
                    value={form.isOnSale}
                    onChange={(value) =>
                      setField("isOnSale", value)
                    }
                  />

                  <Toggle
                    label="Bestseller"
                    description="Display bestseller badge"
                    value={form.isBestseller}
                    onChange={(value) =>
                      setField("isBestseller", value)
                    }
                  />

                  <Toggle
                    label="Trending"
                    description="Display trending badge"
                    value={form.isTrending}
                    onChange={(value) =>
                      setField("isTrending", value)
                    }
                  />
                </div>
              </Panel>
            </div>

            <aside className="product-preview-sidebar">
              <section style={previewPanelStyle}>
                <p style={previewLabelStyle}>
                  LIVE PRODUCT PREVIEW
                </p>

                <div style={previewImageBoxStyle}>
                  {form.mainImage ? (
                    <img
                      src={form.mainImage}
                      alt={form.name || "Product preview"}
                      style={previewImageStyle}
                    />
                  ) : (
                    <div style={previewPlaceholderStyle}>
                      📦
                    </div>
                  )}

                  <div style={previewBadgeContainerStyle}>
                    {form.isNewArrival && (
                      <Badge label="NEW" />
                    )}

                    {form.isOnSale && (
                      <Badge label="SALE" />
                    )}

                    {form.isBestseller && (
                      <Badge label="BESTSELLER" />
                    )}

                    {form.isTrending && (
                      <Badge label="TRENDING" />
                    )}
                  </div>
                </div>

                <p style={previewCategoryStyle}>
                  {form.category || "Product Category"}
                </p>

                <h2 style={previewNameStyle}>
                  {form.name || "Product Name"}
                </h2>

                <p style={previewTaglineStyle}>
                  {form.tagline ||
                    "Product tagline will appear here."}
                </p>

                <div style={previewPriceRowStyle}>
                  <strong style={previewSellingPriceStyle}>
                    ₹
                    {Number(form.price || 0).toLocaleString(
                      "en-IN"
                    )}
                  </strong>

                  {Number(form.mrp || 0) >
                    Number(form.price || 0) && (
                    <>
                      <span style={previewMrpStyle}>
                        ₹
                        {Number(form.mrp).toLocaleString(
                          "en-IN"
                        )}
                      </span>

                      <span style={previewDiscountStyle}>
                        {form.discountPercent}% OFF
                      </span>
                    </>
                  )}
                </div>

                <PreviewInfo
                  label="Stock"
                  value={`${form.stock || 0} units`}
                />

                <PreviewInfo
                  label="Online Quantity"
                  value={
                    form.sellOnline
                      ? `${form.onlineStockLimit || 0} units`
                      : "Shop / POS only"
                  }
                />

                <PreviewInfo
                  label="Sizes"
                  value={
                    form.sizes.join(", ") || "Not selected"
                  }
                />

                <PreviewInfo
                  label="Brand"
                  value={form.brand || "Not added"}
                />
              </section>

              <section style={previewPanelStyle}>
                <h3 style={sideTitleStyle}>
                  Product Completion
                </h3>

                <CompletionRow
                  label="Basic Information"
                  complete={Boolean(
                    form.name &&
                      form.description &&
                      form.category
                  )}
                />

                <CompletionRow
                  label="Pricing"
                  complete={Number(form.price) > 0}
                />

                <CompletionRow
                  label="Inventory"
                  complete={Boolean(form.stock)}
                />

                <CompletionRow
                  label="Main Image"
                  complete={Boolean(form.mainImage)}
                />

                <CompletionRow
                  label="Variants"
                  complete={Boolean(form.sizes.length)}
                />

                <CompletionRow
                  label="SEO"
                  complete={Boolean(
                    form.seoTitle &&
                      form.metaDescription
                  )}
                />

                <CompletionRow
                  label="FAQs"
                  complete={form.faqs.some(
                    (faq) => faq.question && faq.answer
                  )}
                />
              </section>

              <button
                type="submit"
                disabled={saving || uploading}
                style={{
                  ...saveProductButtonStyle,
                  opacity:
                    saving || uploading ? 0.7 : 1,
                  cursor:
                    saving || uploading
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {saving
                  ? "Saving Product..."
                  : uploading
                    ? "Uploading Images..."
                    : linkedStockProduct
                      ? "Update Linked Stock Product"
                      : "Save Premium Product"}
              </button>
            </aside>
          </div>
        </form>
      </div>

      <style jsx global>{`
        .product-admin-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 390px;
          gap: 24px;
          align-items: start;
        }

        .product-preview-sidebar {
          position: sticky;
          top: 94px;
          display: grid;
          gap: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .status-toggle-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .mobile-sticky-save {
          position: sticky;
          top: 10px;
          z-index: 60;
          display: flex;
          justify-content: flex-end;
          pointer-events: none;
          margin: 0 0 14px;
        }

        .mobile-sticky-save-button {
          pointer-events: auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 44px;
          border: 1px solid #d4af37;
          border-radius: 999px;
          background: linear-gradient(135deg, #0a2e73, #164ca8);
          color: #ffffff;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 900;
          box-shadow: 0 10px 28px rgba(10, 46, 115, 0.3);
          cursor: pointer;
        }

        .mobile-sticky-save-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .existing-stock-search-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
        }

        .existing-stock-search-button {
          min-height: 46px;
          border: 1px solid #d4af37;
          border-radius: 10px;
          background: #0a2e73;
          color: #ffffff;
          padding: 0 18px;
          font-weight: 900;
          cursor: pointer;
        }

        .existing-stock-results {
          display: grid;
          gap: 9px;
          margin-top: 14px;
        }

        .existing-stock-results > button {
          display: grid;
          grid-template-columns: 58px minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #ffffff;
          padding: 10px;
          text-align: left;
          cursor: pointer;
        }

        .existing-stock-results > button:hover {
          border-color: #d4af37;
          background: #fffdf5;
        }

        .existing-stock-result-image {
          width: 58px;
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 10px;
          background: #f1f5f9;
          font-size: 24px;
        }

        .existing-stock-result-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .existing-stock-results strong,
        .existing-stock-results span,
        .existing-stock-results small {
          display: block;
        }

        .existing-stock-results strong {
          color: #0a2e73;
          font-size: 14px;
        }

        .existing-stock-results span {
          margin-top: 3px;
          color: #334155;
          font-size: 12px;
          font-weight: 800;
        }

        .existing-stock-results small {
          margin-top: 3px;
          color: #64748b;
        }

        .existing-stock-results b {
          color: #0a2e73;
        }

        .linked-stock-card {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-top: 14px;
          padding: 16px;
          border: 1px solid #86efac;
          border-radius: 14px;
          background: #f0fdf4;
        }

        .linked-stock-card span,
        .linked-stock-card strong,
        .linked-stock-card p {
          display: block;
        }

        .linked-stock-card span {
          color: #15803d;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.8px;
        }

        .linked-stock-card strong {
          margin-top: 4px;
          color: #0a2e73;
          font-size: 17px;
        }

        .linked-stock-card p {
          margin: 4px 0 0;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }

        .linked-stock-card button {
          border: 1px solid #fca5a5;
          border-radius: 9px;
          background: #ffffff;
          color: #dc2626;
          padding: 9px 13px;
          font-weight: 850;
          cursor: pointer;
        }

        .existing-stock-note,
        .inventory-lock-note {
          margin-top: 13px;
          padding: 11px 13px;
          border-radius: 10px;
          background: #fffbea;
          color: #7c5b00;
          font-size: 12px;
          font-weight: 700;
        }

        .inventory-online-toggle {
          min-height: 46px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #ffffff;
        }

        .inventory-online-toggle input {
          width: 20px;
          height: 20px;
          accent-color: #0a2e73;
        }

        .inventory-online-toggle strong,
        .inventory-online-toggle span {
          display: block;
        }

        .inventory-online-toggle strong {
          color: #0a2e73;
          font-size: 13px;
        }

        .inventory-online-toggle span {
          margin-top: 2px;
          color: #64748b;
          font-size: 10px;
        }

        @media (max-width: 1100px) {
          .product-admin-layout {
            grid-template-columns: 1fr;
          }

          .product-preview-sidebar {
            position: static;
          }
        }

        @media (max-width: 650px) {
          .form-grid,
          .status-toggle-grid {
            grid-template-columns: 1fr;
          }

          .existing-stock-search-row {
            grid-template-columns: 1fr;
          }

          .linked-stock-card {
            flex-direction: column;
          }

          .existing-stock-results > button {
            grid-template-columns: 52px minmax(0, 1fr);
          }

          .existing-stock-results > button > b {
            display: none;
          }

          .mobile-sticky-save {
            top: 8px;
            margin-bottom: 12px;
          }

          .mobile-sticky-save-button {
            min-width: 48px;
            min-height: 48px;
            padding: 10px 14px;
          }
        }
      `}</style>
    </main>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section style={panelStyle}>
      <div style={{ marginBottom: "21px" }}>
        <h2 style={panelTitleStyle}>{title}</h2>
        <p style={panelSubtitleStyle}>{subtitle}</p>
      </div>

      {children}
    </section>
  );
}
function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: "17px" }}>
      <label style={fieldLabelStyle}>
        {label}
        {required && (
          <span style={{ color: "#DC2626" }}> *</span>
        )}
      </label>

      {children}
    </div>
  );
}

function FormGrid({ children }: { children: ReactNode }) {
  return <div className="form-grid">{children}</div>;
}

function MoneyInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <span style={moneySymbolStyle}>₹</span>

      <input
        type="number"
        min="0"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{
          ...inputStyle,
          paddingLeft: "34px",
        }}
      />
    </div>
  );
}

function UploadBox({
  uploading,
  label,
  description,
  multiple,
  onChange,
  capture,
}: {
  uploading: boolean;
  label: string;
  description: string;
  multiple: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  capture?: "user" | "environment";
}) {
  return (
    <label style={uploadBoxStyle}>
      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        multiple={multiple}
        onChange={onChange}
        disabled={uploading}
        capture={capture}
        style={{ display: "none" }}
      />

      <span style={{ fontSize: "37px" }}>☁️</span>

      <strong style={{ color: "#0A2E73" }}>
        {uploading ? "Uploading..." : label}
      </strong>

      <span style={{ color: "#777", fontSize: "13px" }}>
        {description}
      </span>
    </label>
  );
}

function ImagePreview({
  image,
  onRemove,
  large = false,
}: {
  image: string;
  onRemove: () => void;
  large?: boolean;
}) {
  return (
    <div style={singleImagePreviewStyle}>
      <img
        src={image}
        alt="Product upload preview"
        style={{
          width: "100%",
          maxHeight: large ? "480px" : "250px",
          objectFit: "contain",
          borderRadius: "13px",
          background: "#F8FAFC",
        }}
      />

      <button
        type="button"
        onClick={onRemove}
        style={removeImageStyle}
      >
        Remove Image
      </button>
    </div>
  );
}

function ImageGrid({
  images,
  onRemove,
}: {
  images: string[];
  onRemove: (index: number) => void;
}) {
  if (!images.length) return null;

  return (
    <div style={imageGridStyle}>
      {images.map((image, index) => (
        <div key={`${image}-${index}`} style={imageTileStyle}>
          <img
            src={image}
            alt={`Product image ${index + 1}`}
            style={imageTileImageStyle}
          />

          <button
            type="button"
            onClick={() => onRemove(index)}
            style={imageRemoveIconStyle}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function ChipButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: selected ? "#0A2E73" : "#FFFFFF",
        color: selected ? "#FFFFFF" : "#0A2E73",
        border: selected
          ? "1px solid #0A2E73"
          : "1px solid #D1D5DB",
        borderRadius: "999px",
        padding: "10px 15px",
        cursor: "pointer",
        fontWeight: 700,
      }}
    >
      {label}
    </button>
  );
}

function InlineAdd({
  value,
  placeholder,
  buttonLabel,
  onChange,
  onAdd,
}: {
  value: string;
  placeholder: string;
  buttonLabel: string;
  onChange: (value: string) => void;
  onAdd: () => void;
}) {
  return (
    <div style={inlineAddStyle}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle}
      />

      <button
        type="button"
        onClick={onAdd}
        style={smallPrimaryButtonStyle}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function SelectedValues({
  values,
  onRemove,
}: {
  values: string[];
  onRemove: (value: string) => void;
}) {
  if (!values.length) return null;

  return (
    <div style={selectedValuesStyle}>
      {values.map((value) => (
        <span key={value} style={selectedValueStyle}>
          {value}

          <button
            type="button"
            onClick={() => onRemove(value)}
            style={selectedValueRemoveStyle}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

function DynamicRow({ children }: { children: ReactNode }) {
  return <div style={dynamicRowStyle}>{children}</div>;
}

function AddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={addButtonStyle}
    >
      + {label}
    </button>
  );
}

function RemoveButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={removeButtonStyle}
    >
      ×
    </button>
  );
}

function CharacterCount({
  value,
  maximum,
}: {
  value: number;
  maximum: number;
}) {
  return (
    <p style={characterCountStyle}>
      {value}/{maximum} characters
    </p>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      style={{
        ...toggleCardStyle,
        background: value ? "#F0FDF4" : "#FFFFFF",
        border: value
          ? "1px solid #86EFAC"
          : "1px solid #E5E7EB",
      }}
    >
      <div>
        <strong style={{ color: "#0A2E73" }}>
          {label}
        </strong>

        <p style={toggleDescriptionStyle}>
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          ...toggleSwitchStyle,
          background: value ? "#16A34A" : "#D1D5DB",
        }}
      >
        <span
          style={{
            ...toggleCircleStyle,
            left: value ? "28px" : "3px",
          }}
        />
      </button>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return <span style={badgeStyle}>{label}</span>;
}

function PreviewInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={previewInfoStyle}>
      <span style={{ color: "#777" }}>{label}</span>
      <strong
        style={{
          color: "#0A2E73",
          textAlign: "right",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function CompletionRow({
  label,
  complete,
}: {
  label: string;
  complete: boolean;
}) {
  return (
    <div style={completionRowStyle}>
      <span style={{ color: "#555", fontWeight: 700 }}>
        {label}
      </span>

      <span
        style={{
          ...completionBadgeStyle,
          background: complete ? "#DCFCE7" : "#FEE2E2",
          color: complete ? "#166534" : "#B91C1C",
        }}
      >
        {complete ? "Complete" : "Incomplete"}
      </span>
    </div>
  );
}

const mainStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#F8F4EC",
  padding: "30px 20px 90px",
};

const containerStyle: CSSProperties = {
  maxWidth: "1550px",
  margin: "0 auto",
};

const heroStyle: CSSProperties = {
  background:
    "linear-gradient(135deg, #071A43 0%, #0A2E73 55%, #164CA8 100%)",
  borderRadius: "24px",
  padding: "32px",
  color: "#FFFFFF",
  marginBottom: "25px",
  boxShadow: "0 15px 40px rgba(10,46,115,0.25)",
};

const heroLabelStyle: CSSProperties = {
  color: "#D4AF37",
  fontWeight: 800,
  letterSpacing: "1.4px",
  margin: "0 0 8px",
};

const heroTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "38px",
};

const heroDescriptionStyle: CSSProperties = {
  margin: "11px 0 0",
  opacity: 0.9,
  lineHeight: 1.6,
};

const panelStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "19px",
  padding: "24px",
  boxShadow: "0 8px 25px rgba(0,0,0,0.07)",
  border: "1px solid rgba(212,175,55,0.22)",
};

const panelTitleStyle: CSSProperties = {
  color: "#0A2E73",
  margin: "0 0 5px",
  fontSize: "23px",
};

const panelSubtitleStyle: CSSProperties = {
  color: "#777",
  margin: 0,
  fontSize: "13px",
};

const fieldLabelStyle: CSSProperties = {
  display: "block",
  color: "#0A2E73",
  fontWeight: 700,
  marginBottom: "7px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  border: "1px solid #D1D5DB",
  borderRadius: "9px",
  background: "#FFFFFF",
  color: "#111827",
  fontSize: "15px",
  outline: "none",
};

const shortTextareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: "105px",
  resize: "vertical",
  lineHeight: 1.6,
};

const largeTextareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: "175px",
  resize: "vertical",
  lineHeight: 1.7,
};

const moneySymbolStyle: CSSProperties = {
  position: "absolute",
  left: "14px",
  top: "50%",
  transform: "translateY(-50%)",
  color: "#0A2E73",
  fontWeight: 800,
};

const pricingSummaryStyle: CSSProperties = {
  background: "#F0FDF4",
  color: "#166534",
  border: "1px solid #BBF7D0",
  borderRadius: "11px",
  padding: "14px",
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const uploadBoxStyle: CSSProperties = {
  minHeight: "145px",
  border: "2px dashed #D4AF37",
  borderRadius: "14px",
  background: "#FFFDF5",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: "8px",
  padding: "20px",
  cursor: "pointer",
  textAlign: "center",
};

const singleImagePreviewStyle: CSSProperties = {
  marginTop: "17px",
  border: "1px solid #E5E7EB",
  borderRadius: "14px",
  padding: "12px",
  background: "#F8FAFC",
};

const removeImageStyle: CSSProperties = {
  width: "100%",
  marginTop: "10px",
  border: "1px solid #FCA5A5",
  background: "#FFFFFF",
  color: "#DC2626",
  borderRadius: "9px",
  padding: "10px",
  cursor: "pointer",
  fontWeight: 700,
};

const imageGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fill, minmax(130px, 1fr))",
  gap: "12px",
  marginTop: "17px",
};

const imageTileStyle: CSSProperties = {
  position: "relative",
  borderRadius: "12px",
  overflow: "hidden",
  border: "1px solid #E5E7EB",
  aspectRatio: "1 / 1",
  background: "#F3F4F6",
};

const imageTileImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const imageRemoveIconStyle: CSSProperties = {
  position: "absolute",
  top: "7px",
  right: "7px",
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  border: "none",
  background: "rgba(220,38,38,0.9)",
  color: "#FFFFFF",
  cursor: "pointer",
  fontSize: "18px",
};

const chipGridStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "9px",
  marginBottom: "16px",
};

const inlineAddStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "10px",
};

const smallPrimaryButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: "9px",
  background: "#0A2E73",
  color: "#FFFFFF",
  padding: "0 17px",
  cursor: "pointer",
  fontWeight: 800,
};

const selectedValuesStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "14px",
};

const selectedValueStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "7px",
  background: "#EEF2FF",
  color: "#0A2E73",
  borderRadius: "999px",
  padding: "7px 10px",
  fontWeight: 700,
};

const selectedValueRemoveStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#DC2626",
  cursor: "pointer",
  fontSize: "17px",
  padding: 0,
};

const dynamicRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr)) auto",
  gap: "10px",
  marginBottom: "11px",
};

const addButtonStyle: CSSProperties = {
  width: "100%",
  border: "1px dashed #0A2E73",
  background: "#EEF2FF",
  color: "#0A2E73",
  padding: "12px",
  borderRadius: "9px",
  cursor: "pointer",
  fontWeight: 800,
};

const removeButtonStyle: CSSProperties = {
  width: "43px",
  height: "43px",
  borderRadius: "9px",
  border: "1px solid #FCA5A5",
  background: "#FFFFFF",
  color: "#DC2626",
  cursor: "pointer",
  fontSize: "22px",
};

const faqCardStyle: CSSProperties = {
  background: "#F8FAFC",
  border: "1px solid #E5E7EB",
  borderRadius: "12px",
  padding: "15px",
  marginBottom: "13px",
};

const faqHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "11px",
};

const characterCountStyle: CSSProperties = {
  color: "#999",
  fontSize: "11px",
  textAlign: "right",
  margin: "5px 0 0",
};

const toggleCardStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "15px",
  borderRadius: "12px",
};

const toggleDescriptionStyle: CSSProperties = {
  color: "#777",
  margin: "4px 0 0",
  fontSize: "12px",
};

const toggleSwitchStyle: CSSProperties = {
  position: "relative",
  width: "56px",
  height: "31px",
  flexShrink: 0,
  border: "none",
  borderRadius: "999px",
  cursor: "pointer",
  padding: 0,
};

const toggleCircleStyle: CSSProperties = {
  position: "absolute",
  width: "25px",
  height: "25px",
  borderRadius: "50%",
  background: "#FFFFFF",
  top: "3px",
  boxShadow: "0 2px 7px rgba(0,0,0,0.2)",
  transition: "0.25s",
};

const previewPanelStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "19px",
  padding: "20px",
  boxShadow: "0 8px 25px rgba(0,0,0,0.07)",
  border: "1px solid rgba(212,175,55,0.22)",
};

const previewLabelStyle: CSSProperties = {
  color: "#D4AF37",
  fontWeight: 800,
  letterSpacing: "1px",
  margin: "0 0 13px",
};

const previewImageBoxStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: "4 / 5",
  background: "#F8FAFC",
  borderRadius: "14px",
  overflow: "hidden",
  marginBottom: "17px",
};

const previewImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const previewPlaceholderStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: "60px",
};

const previewBadgeContainerStyle: CSSProperties = {
  position: "absolute",
  left: "10px",
  top: "10px",
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
};

const badgeStyle: CSSProperties = {
  background: "#D4AF37",
  color: "#FFFFFF",
  borderRadius: "999px",
  padding: "6px 9px",
  fontSize: "10px",
  fontWeight: 900,
};

const previewCategoryStyle: CSSProperties = {
  color: "#D4AF37",
  fontWeight: 800,
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "1px",
  margin: "0 0 5px",
};

const previewNameStyle: CSSProperties = {
  color: "#0A2E73",
  margin: 0,
  fontSize: "24px",
};

const previewTaglineStyle: CSSProperties = {
  color: "#777",
  margin: "7px 0 14px",
  lineHeight: 1.5,
};

const previewPriceRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const previewSellingPriceStyle: CSSProperties = {
  color: "#0A2E73",
  fontSize: "25px",
};

const previewMrpStyle: CSSProperties = {
  color: "#999",
  textDecoration: "line-through",
};

const previewDiscountStyle: CSSProperties = {
  color: "#16A34A",
  fontWeight: 800,
};

const previewInfoStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  padding: "11px 0",
  borderBottom: "1px solid #E5E7EB",
};

const sideTitleStyle: CSSProperties = {
  color: "#0A2E73",
  margin: "0 0 14px",
};

const completionRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "11px 0",
  borderBottom: "1px solid #E5E7EB",
};

const completionBadgeStyle: CSSProperties = {
  padding: "5px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 800,
};

const aiGeneratorCardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "18px",
  flexWrap: "wrap",
  padding: "18px",
  border: "1px solid rgba(212, 175, 55, 0.55)",
  borderRadius: "18px",
  background:
    "linear-gradient(135deg, rgba(10, 46, 115, 0.06), rgba(248, 244, 236, 0.95))",
};

const aiGeneratorTitleStyle: CSSProperties = {
  display: "block",
  color: "#0A2E73",
  fontSize: "17px",
  lineHeight: 1.3,
};

const aiGeneratorTextStyle: CSSProperties = {
  margin: "7px 0 0",
  maxWidth: "680px",
  color: "#4B5563",
  fontSize: "14px",
  lineHeight: 1.6,
};

const aiGenerateButtonStyle: CSSProperties = {
  minHeight: "48px",
  padding: "12px 18px",
  border: "1px solid #D4AF37",
  borderRadius: "14px",
  background: "#0A2E73",
  color: "#FFFFFF",
  fontWeight: 800,
  fontSize: "14px",
  boxShadow: "0 10px 24px rgba(10, 46, 115, 0.18)",
};

const aiStatusStyle: CSSProperties = {
  marginTop: "14px",
  padding: "12px 14px",
  border: "1px solid",
  borderRadius: "12px",
  fontSize: "14px",
  lineHeight: 1.5,
  fontWeight: 650,
};

const photoStudioHeaderActionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: "14px",
};

const photoStudioUploadGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "14px",
};

const photoStudioSectionLabelStyle: CSSProperties = {
  marginTop: "18px",
  marginBottom: "10px",
  color: "#0A2E73",
  fontSize: "14px",
  fontWeight: 900,
  letterSpacing: "0.2px",
};

const photoStudioSourceGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
  gap: "12px",
};

const photoStudioSourceCardStyle: CSSProperties = {
  borderRadius: "14px",
  overflow: "hidden",
  background: "#FFFFFF",
  boxShadow: "0 4px 14px rgba(15,23,42,0.08)",
};

const photoStudioSourceSelectButtonStyle: CSSProperties = {
  display: "block",
  width: "100%",
  border: "none",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
};

const photoStudioSourceImageStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "1 / 1",
  objectFit: "cover",
  display: "block",
  background: "#F8FAFC",
};

const photoStudioSourceMetaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  padding: "10px",
  color: "#0A2E73",
  fontWeight: 800,
  fontSize: "12px",
};

const photoStudioPresetGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const photoStudioPresetCardStyle: CSSProperties = {
  textAlign: "left",
  borderRadius: "16px",
  padding: "14px",
  cursor: "pointer",
};

const photoStudioPresetNumberStyle: CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "999px",
  background: "#0A2E73",
  color: "#FFFFFF",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  marginBottom: "8px",
};

const photoStudioPresetTitleStyle: CSSProperties = {
  display: "block",
  color: "#0A2E73",
  fontSize: "15px",
  lineHeight: 1.3,
  marginBottom: "6px",
};

const photoStudioPresetTextStyle: CSSProperties = {
  color: "#4B5563",
  fontSize: "13px",
  lineHeight: 1.5,
  margin: "0 0 7px",
};

const photoStudioPresetSmallTextStyle: CSSProperties = {
  color: "#64748B",
  fontSize: "11px",
  lineHeight: 1.45,
};

const photoStudioDirectCardStyle: CSSProperties = {
  marginTop: "18px",
  padding: "18px",
  borderRadius: "18px",
  border: "1px solid rgba(10,46,115,0.24)",
  background:
    "linear-gradient(135deg, rgba(10,46,115,0.08), rgba(212,175,55,0.10), #FFFFFF)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "18px",
  flexWrap: "wrap",
};

const photoStudioDirectTitleStyle: CSSProperties = {
  display: "block",
  color: "#0A2E73",
  fontSize: "18px",
  lineHeight: 1.35,
};

const photoStudioDirectTextStyle: CSSProperties = {
  margin: "7px 0 0",
  maxWidth: "720px",
  color: "#334155",
  fontSize: "13px",
  lineHeight: 1.65,
};

const photoStudioDirectSmallStyle: CSSProperties = {
  display: "block",
  marginTop: "7px",
  maxWidth: "720px",
  color: "#64748B",
  fontSize: "11px",
  lineHeight: 1.55,
};

const photoStudioGenerateDirectButtonStyle: CSSProperties = {
  minHeight: "54px",
  border: "1px solid #D4AF37",
  borderRadius: "14px",
  background:
    "linear-gradient(135deg, #0A2E73 0%, #164CA8 72%, #0A2E73 100%)",
  color: "#FFFFFF",
  padding: "13px 20px",
  fontSize: "14px",
  fontWeight: 900,
  boxShadow: "0 10px 24px rgba(10,46,115,0.20)",
};

const photoStudioBackupLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  marginTop: "20px",
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#FFF7D6",
  color: "#7C5B00",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.3px",
};

const photoStudioPromptCardStyle: CSSProperties = {
  marginTop: "18px",
  border: "1px solid rgba(212,175,55,0.4)",
  borderRadius: "16px",
  background: "#FFFCF4",
  padding: "16px",
};

const photoStudioPromptHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "14px",
  flexWrap: "wrap",
  marginBottom: "12px",
};

const photoStudioPromptTitleStyle: CSSProperties = {
  display: "block",
  color: "#0A2E73",
  fontSize: "16px",
};

const photoStudioPromptTextStyle: CSSProperties = {
  color: "#475569",
  fontSize: "13px",
  lineHeight: 1.6,
  margin: "6px 0 0",
};

const photoStudioPromptTextareaStyle: CSSProperties = {
  ...largeTextareaStyle,
  minHeight: "210px",
  background: "#FFFFFF",
  fontSize: "13px",
};

const photoStudioImportBoxStyle: CSSProperties = {
  marginTop: "18px",
};

const photoStudioCompareGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "14px",
  marginTop: "18px",
};

const photoStudioCompareCardStyle: CSSProperties = {
  border: "1px solid #E5E7EB",
  borderRadius: "16px",
  background: "#FFFFFF",
  overflow: "hidden",
};

const photoStudioCompareLabelStyle: CSSProperties = {
  padding: "12px 14px",
  color: "#0A2E73",
  fontWeight: 900,
  background: "#F8FAFC",
  borderBottom: "1px solid #E5E7EB",
};

const photoStudioCompareImageStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "4 / 5",
  objectFit: "contain",
  background: "#FFFFFF",
  display: "block",
};

const photoStudioEmptyPreviewStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "4 / 5",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#94A3B8",
  background: "#F8FAFC",
  fontWeight: 700,
  textAlign: "center",
  padding: "20px",
};

const photoStudioResultActionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "18px",
};

const photoStudioPrimaryButtonStyle: CSSProperties = {
  border: "1px solid #D4AF37",
  borderRadius: "12px",
  background: "#0A2E73",
  color: "#FFFFFF",
  padding: "11px 16px",
  fontWeight: 900,
  cursor: "pointer",
};

const photoStudioSecondaryButtonStyle: CSSProperties = {
  border: "1px solid #0A2E73",
  borderRadius: "12px",
  background: "#FFFFFF",
  color: "#0A2E73",
  padding: "11px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const photoStudioDangerButtonStyle: CSSProperties = {
  border: "1px solid #FCA5A5",
  borderRadius: "12px",
  background: "#FFFFFF",
  color: "#DC2626",
  padding: "11px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const photoStudioMiniDangerButtonStyle: CSSProperties = {
  border: "1px solid #FCA5A5",
  borderRadius: "999px",
  background: "#FFFFFF",
  color: "#DC2626",
  padding: "4px 9px",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: "11px",
};

const saveProductButtonStyle: CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: "12px",
  background:
    "linear-gradient(135deg, #0A2E73, #164CA8)",
  color: "#FFFFFF",
  padding: "16px",
  fontSize: "16px",
  fontWeight: 900,
  boxShadow: "0 10px 25px rgba(10,46,115,0.25)",
};