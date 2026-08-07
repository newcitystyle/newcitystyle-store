"use client";

import {
  ChangeEvent,
  CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type CardFormat = "square" | "portrait" | "status";
type TemplateId =
  | "color-pop"
  | "festival-burst"
  | "fashion-editorial"
  | "product-spotlight"
  | "flash-sticker"
  | "category-collage";

type CardDraft = {
  id: string;
  name: string;
  templateId: TemplateId;
  format: CardFormat;
  headline: string;
  subheadline: string;
  offerText: string;
  couponCode: string;
  validUntil: string;
  customMessage: string;
  phone: string;
  website: string;
  productImage: string;
  logoImage: string;
  createdAt: string;
  updatedAt: string;
};

type TemplateDefinition = {
  id: TemplateId;
  name: string;
  category: string;
  description: string;
  preview: string;
};

const STORAGE_KEY = "ncs_digital_card_studio_svg_v1";

const FORMATS: Record<
  CardFormat,
  { label: string; width: number; height: number; ratio: string }
> = {
  square: {
    label: "WhatsApp Post",
    width: 1080,
    height: 1080,
    ratio: "1 / 1",
  },
  portrait: {
    label: "Instagram Portrait",
    width: 1080,
    height: 1350,
    ratio: "4 / 5",
  },
  status: {
    label: "WhatsApp Status",
    width: 1080,
    height: 1920,
    ratio: "9 / 16",
  },
};

const TEMPLATES: TemplateDefinition[] = [
  {
    id: "color-pop",
    name: "Color Pop Sale",
    category: "High Impact",
    description: "Bold split layout with huge offer and bright commercial colours.",
    preview: "linear-gradient(135deg,#ff6b2c,#ff3d81 48%,#7f35db)",
  },
  {
    id: "festival-burst",
    name: "Festival Burst",
    category: "Celebration",
    description: "Circular product focus, starbursts and energetic festival graphics.",
    preview: "linear-gradient(135deg,#ff9d00,#ff3f65 50%,#7a2fd2)",
  },
  {
    id: "fashion-editorial",
    name: "Fashion Editorial",
    category: "Premium",
    description: "Magazine-style composition with elegant typography and clean spacing.",
    preview: "linear-gradient(135deg,#fff2d8,#ffb78b 55%,#ff7192)",
  },
  {
    id: "product-spotlight",
    name: "Product Spotlight",
    category: "Product First",
    description: "Large clear product display with a separate headline and offer zone.",
    preview: "linear-gradient(135deg,#00a48f,#2bc58b 52%,#b7e654)",
  },
  {
    id: "flash-sticker",
    name: "Flash Sticker",
    category: "Youth",
    description: "Neon sticker shapes, angled typography and high-energy sale feel.",
    preview: "linear-gradient(135deg,#11173d,#5d2ac4 48%,#ff2e91)",
  },
  {
    id: "category-collage",
    name: "Category Collage",
    category: "Fashion Mix",
    description: "Multi-frame product collage for men, women, kids and family campaigns.",
    preview: "linear-gradient(135deg,#00a9ff,#7350ef 48%,#ff55b7)",
  },
];

const INITIAL_DRAFT: CardDraft = {
  id: "current",
  name: "Weekend Fashion Offer",
  templateId: "color-pop",
  format: "square",
  headline: "Weekend Fashion Festival",
  subheadline: "Premium styles for men, women and kids",
  offerText: "UP TO 40% OFF",
  couponCode: "NCS40",
  validUntil: "This Sunday",
  customMessage:
    "Visit NEW CITY STYLE and discover premium fashion for the whole family.",
  phone: "9010014001",
  website: "newcitystyle.store",
  productImage: "",
  logoImage: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ncs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read selected image."));
    reader.readAsDataURL(file);
  });
}

function splitText(text: string, maxChars: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (test.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });

  if (line) lines.push(line);

  if (lines.length > maxLines) {
    const trimmed = lines.slice(0, maxLines);
    trimmed[maxLines - 1] = `${trimmed[maxLines - 1].replace(/[.]+$/, "")}…`;
    return trimmed;
  }

  return lines;
}

function svgTextLines(
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  className: string,
  anchor: "start" | "middle" | "end" = "start",
) {
  return (
    <text x={x} y={y} className={className} textAnchor={anchor}>
      {lines.map((line, index) => (
        <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function BrandLogo({
  x,
  y,
  size,
  draft,
  dark = false,
}: {
  x: number;
  y: number;
  size: number;
  draft: CardDraft;
  dark?: boolean;
}) {
  return draft.logoImage ? (
    <image
      href={draft.logoImage}
      x={x}
      y={y}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
    />
  ) : (
    <>
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={size * 0.24}
        fill={dark ? "#17204f" : "rgba(255,255,255,.16)"}
        stroke={dark ? "#17204f" : "rgba(255,255,255,.62)"}
        strokeWidth="2"
      />
      <text
        x={x + size / 2}
        y={y + size * 0.59}
        textAnchor="middle"
        fontSize={size * 0.28}
        fontWeight="900"
        fill={dark ? "#ffffff" : "#ffffff"}
      >
        NCS
      </text>
    </>
  );
}

function ProductImage({
  href,
  x,
  y,
  width,
  height,
  rx = 38,
  clipId,
  background = "#ffffff",
}: {
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  clipId: string;
  background?: string;
}) {
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={width} height={height} rx={rx} />
        </clipPath>
      </defs>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={rx}
        fill={background}
        stroke="rgba(255,255,255,.66)"
        strokeWidth="6"
      />
      {href ? (
        <image
          href={href}
          x={x + 14}
          y={y + 14}
          width={width - 28}
          height={height - 28}
          preserveAspectRatio="xMidYMid meet"
          clipPath={`url(#${clipId})`}
        />
      ) : (
        <>
          <circle
            cx={x + width / 2}
            cy={y + height / 2}
            r={Math.min(width, height) * 0.22}
            fill="#eef0f8"
          />
          <text
            x={x + width / 2}
            y={y + height / 2 + 18}
            textAnchor="middle"
            fontSize={Math.min(width, height) * 0.16}
            fontWeight="900"
            fill="#17204f"
          >
            NCS
          </text>
        </>
      )}
    </>
  );
}

function SvgCard({
  draft,
  format,
}: {
  draft: CardDraft;
  format: CardFormat;
}) {
  const { width: W, height: H } = FORMATS[format];
  const isSquare = format === "square";
  const isStatus = format === "status";
  const headlineLines = splitText(
    draft.headline || "Your campaign headline",
    isSquare ? 18 : isStatus ? 17 : 20,
    isSquare ? 3 : 4,
  );
  const subtitleLines = splitText(
    draft.subheadline || "Add a premium message for your customers.",
    isSquare ? 34 : 32,
    2,
  );

  const commonStyle = (
    <style>{`
      .brandSmall { font: 800 ${isStatus ? 25 : 21}px Arial, sans-serif; letter-spacing: 2px; }
      .brandName { font: 900 ${isStatus ? 36 : 30}px Arial, sans-serif; }
      .headline { font-family: Georgia, 'Times New Roman', serif; font-weight: 900; }
      .headlineSans { font-family: Arial, sans-serif; font-weight: 950; }
      .subtitle { font: 600 ${isStatus ? 28 : 23}px Arial, sans-serif; }
      .eyebrow { font: 900 ${isStatus ? 21 : 17}px Arial, sans-serif; letter-spacing: 1.6px; }
      .offer { font: 950 ${isStatus ? 62 : 54}px Arial, sans-serif; }
      .meta { font: 900 ${isStatus ? 20 : 17}px Arial, sans-serif; letter-spacing: .7px; }
      .footer { font: 800 ${isStatus ? 20 : 17}px Arial, sans-serif; }
    `}</style>
  );

  if (draft.templateId === "color-pop") {
    const pad = isStatus ? 76 : 58;
    const imgX = isSquare ? 610 : 150;
    const imgY = isSquare ? 220 : isStatus ? 650 : 440;
    const imgW = isSquare ? 390 : 780;
    const imgH = isSquare ? 540 : isStatus ? 700 : 560;
    const offerY = isSquare ? 820 : isStatus ? 1490 : 1080;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        {commonStyle}
        <defs>
          <linearGradient id="cpBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff7a22" />
            <stop offset=".48" stopColor="#ff3d7d" />
            <stop offset="1" stopColor="#7836df" />
          </linearGradient>
          <radialGradient id="cpGlow">
            <stop offset="0" stopColor="#fff47a" stopOpacity=".75" />
            <stop offset="1" stopColor="#fff47a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} rx="54" fill="url(#cpBg)" />
        <circle cx={W * 0.88} cy={H * 0.12} r={W * 0.28} fill="url(#cpGlow)" />
        <circle cx={W * 0.08} cy={H * 0.82} r={W * 0.22} fill="#6ef0d2" opacity=".18" />
        <path d={`M0 ${H * 0.28} Q ${W * 0.42} ${H * 0.10} ${W} ${H * 0.32}`} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="3" />
        <text x={pad} y={pad + 20} className="brandSmall" fill="#fff5b0">PREMIUM FASHION SALE</text>
        <text x={pad} y={pad + 64} className="brandName" fill="#ffffff">NEW CITY STYLE</text>
        <BrandLogo x={W - pad - 92} y={pad - 8} size={92} draft={draft} />

        {isSquare ? (
          <>
            <rect x={pad} y="180" width="490" height="54" rx="27" fill="rgba(255,255,255,.18)" />
            <text x={pad + 245} y="216" textAnchor="middle" className="eyebrow" fill="#ffffff">
              COLOR POP SALE
            </text>
            {svgTextLines(headlineLines, pad, 320, 86, "headline", "start")}
            <g fill="#ffffff">
              {svgTextLines(subtitleLines, pad, 610, 34, "subtitle", "start")}
            </g>
          </>
        ) : (
          <>
            <rect x={pad} y="170" width={W - pad * 2} height="58" rx="29" fill="rgba(255,255,255,.18)" />
            <text x={W / 2} y="208" textAnchor="middle" className="eyebrow" fill="#ffffff">
              COLOR POP SALE
            </text>
            <g fill="#ffffff">
              {svgTextLines(headlineLines, W / 2, 330, isStatus ? 92 : 82, "headline", "middle")}
              {svgTextLines(subtitleLines, W / 2, isStatus ? 540 : 600, 38, "subtitle", "middle")}
            </g>
          </>
        )}

        <ProductImage
          href={draft.productImage}
          x={imgX}
          y={imgY}
          width={imgW}
          height={imgH}
          rx={isSquare ? 52 : 60}
          clipId={`cp-${format}`}
        />

        <rect
          x={pad}
          y={offerY}
          width={W - pad * 2}
          height={isStatus ? 260 : 180}
          rx="38"
          fill="#fff36b"
        />
        <text x={W / 2} y={offerY + (isStatus ? 78 : 58)} textAnchor="middle" className="eyebrow" fill="#442067">
          LIMITED TIME
        </text>
        <text x={W / 2} y={offerY + (isStatus ? 155 : 125)} textAnchor="middle" className="offer" fill="#17204f">
          {draft.offerText || "SPECIAL OFFER"}
        </text>
        <text x={W / 2} y={offerY + (isStatus ? 210 : 162)} textAnchor="middle" className="meta" fill="#17204f">
          {draft.couponCode ? `CODE: ${draft.couponCode}` : ""} {draft.validUntil ? `   •   ${draft.validUntil}` : ""}
        </text>
        <text x={pad} y={H - 44} className="footer" fill="#ffffff">
          {draft.phone ? `WhatsApp ${draft.phone}` : "Visit us"}
        </text>
        <text x={W - pad} y={H - 44} textAnchor="end" className="footer" fill="#ffffff">
          {draft.website || "newcitystyle.store"}
        </text>
      </svg>
    );
  }

  if (draft.templateId === "festival-burst") {
    const pad = isStatus ? 70 : 54;
    const centerY = isStatus ? 820 : isSquare ? 510 : 620;
    const radius = isStatus ? 300 : isSquare ? 260 : 270;
    const offerY = isStatus ? 1270 : isSquare ? 770 : 980;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        {commonStyle}
        <defs>
          <linearGradient id="fbBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff9d00" />
            <stop offset=".5" stopColor="#ff3f6d" />
            <stop offset="1" stopColor="#792ed5" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} rx="54" fill="url(#fbBg)" />
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (Math.PI * 2 * i) / 16;
          const x2 = W / 2 + Math.cos(angle) * W;
          const y2 = centerY + Math.sin(angle) * W;
          return (
            <line
              key={i}
              x1={W / 2}
              y1={centerY}
              x2={x2}
              y2={y2}
              stroke="rgba(255,244,111,.18)"
              strokeWidth="28"
            />
          );
        })}
        <text x={pad} y={pad + 18} className="brandSmall" fill="#fff6a2">FESTIVAL CELEBRATION</text>
        <text x={pad} y={pad + 62} className="brandName" fill="#ffffff">NEW CITY STYLE</text>
        <BrandLogo x={W - pad - 92} y={pad - 8} size={92} draft={draft} />

        <circle cx={W / 2} cy={centerY} r={radius + 28} fill="rgba(255,255,255,.20)" />
        <ProductImage
          href={draft.productImage}
          x={W / 2 - radius}
          y={centerY - radius}
          width={radius * 2}
          height={radius * 2}
          rx={radius}
          clipId={`fb-${format}`}
        />

        <circle cx={W * 0.79} cy={centerY - radius * 0.78} r={isStatus ? 165 : 132} fill="#fff36b" />
        <text x={W * 0.79} y={centerY - radius * 0.92} textAnchor="middle" className="eyebrow" fill="#63206f">
          FESTIVAL DEAL
        </text>
        {svgTextLines(
          splitText(draft.offerText || "SPECIAL OFFER", 10, 3),
          W * 0.79,
          centerY - radius * 0.68,
          isStatus ? 66 : 54,
          "offer",
          "middle",
        )}

        <rect x={pad} y={offerY} width={W - pad * 2} height={isStatus ? 360 : 240} rx="42" fill="rgba(255,255,255,.94)" />
        <text x={W / 2} y={offerY + 56} textAnchor="middle" className="eyebrow" fill="#70205f">FESTIVAL BLAST</text>
        <g fill="#5a1c67">
          {svgTextLines(headlineLines, W / 2, offerY + 125, isStatus ? 78 : 66, "headline", "middle")}
        </g>
        <g fill="#5a1c67">
          {svgTextLines(subtitleLines, W / 2, offerY + (isStatus ? 285 : 205), 34, "subtitle", "middle")}
        </g>

        <rect x={pad} y={H - 120} width={W - pad * 2} height="66" rx="33" fill="rgba(255,255,255,.16)" />
        <text x={W / 2} y={H - 78} textAnchor="middle" className="meta" fill="#ffffff">
          {draft.couponCode ? `USE ${draft.couponCode}` : ""} {draft.validUntil ? `   •   ${draft.validUntil}` : ""}
        </text>
      </svg>
    );
  }

  if (draft.templateId === "fashion-editorial") {
    const pad = isStatus ? 74 : 58;
    const imgX = isSquare ? 590 : 130;
    const imgY = isSquare ? 190 : isStatus ? 690 : 500;
    const imgW = isSquare ? 420 : 820;
    const imgH = isSquare ? 700 : isStatus ? 760 : 650;
    const copyY = isSquare ? 290 : 280;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        {commonStyle}
        <defs>
          <linearGradient id="feBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff6e4" />
            <stop offset=".54" stopColor="#ffc8a6" />
            <stop offset="1" stopColor="#ff7d9a" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} rx="54" fill="url(#feBg)" />
        <rect x="34" y="34" width={W - 68} height={H - 68} rx="34" fill="none" stroke="#17204f" strokeWidth="3" />
        <text x={pad} y={pad + 10} className="eyebrow" fill="#17204f">STYLE EDIT / 2026</text>
        <text x={W / 2} y={pad + 16} textAnchor="middle" fontFamily="Georgia" fontSize={isStatus ? 38 : 32} fontWeight="900" fill="#17204f">
          NEW CITY STYLE
        </text>
        <BrandLogo x={W - pad - 86} y={pad - 18} size={86} draft={draft} dark />

        {isSquare ? (
          <>
            <rect x={pad} y="210" width="450" height="58" fill="#ff5f66" />
            <text x={pad + 225} y="248" textAnchor="middle" className="eyebrow" fill="#ffffff">FASHION EDITORIAL</text>
            <g fill="#17204f">
              {svgTextLines(headlineLines, pad, copyY + 90, 82, "headline", "start")}
              {svgTextLines(subtitleLines, pad, copyY + 350, 34, "subtitle", "start")}
            </g>
            <rect x={pad} y="760" width="450" height="160" fill="rgba(255,255,255,.62)" />
            <text x={pad + 28} y="810" className="eyebrow" fill="#17204f">NOW LIVE</text>
            <text x={pad + 28} y="875" className="offer" fill="#17204f">{draft.offerText || "SPECIAL OFFER"}</text>
          </>
        ) : (
          <>
            <rect x={pad} y="170" width={W - pad * 2} height="58" fill="#ff5f66" />
            <text x={W / 2} y="208" textAnchor="middle" className="eyebrow" fill="#ffffff">FASHION EDITORIAL</text>
            <g fill="#17204f">
              {svgTextLines(headlineLines, W / 2, 350, isStatus ? 90 : 78, "headline", "middle")}
              {svgTextLines(subtitleLines, W / 2, isStatus ? 610 : 650, 36, "subtitle", "middle")}
            </g>
          </>
        )}

        <ProductImage
          href={draft.productImage}
          x={imgX}
          y={imgY}
          width={imgW}
          height={imgH}
          rx={isSquare ? 12 : 70}
          clipId={`fe-${format}`}
        />

        {!isSquare && (
          <rect x={pad} y={H - 360} width={W - pad * 2} height="210" rx="18" fill="rgba(255,255,255,.68)" />
        )}
        {!isSquare && (
          <>
            <text x={W / 2} y={H - 295} textAnchor="middle" className="eyebrow" fill="#17204f">NOW LIVE</text>
            <text x={W / 2} y={H - 225} textAnchor="middle" className="offer" fill="#17204f">{draft.offerText || "SPECIAL OFFER"}</text>
            <text x={W / 2} y={H - 175} textAnchor="middle" className="meta" fill="#17204f">
              {draft.couponCode ? `CODE ${draft.couponCode}` : ""} {draft.validUntil ? `   •   ${draft.validUntil}` : ""}
            </text>
          </>
        )}
        <text x={pad} y={H - 58} className="footer" fill="#17204f">{draft.phone}</text>
        <text x={W - pad} y={H - 58} textAnchor="end" className="footer" fill="#17204f">{draft.website}</text>
      </svg>
    );
  }

  if (draft.templateId === "product-spotlight") {
    const pad = isStatus ? 72 : 56;
    const imgX = isSquare ? 500 : 150;
    const imgY = isSquare ? 190 : isStatus ? 500 : 420;
    const imgW = isSquare ? 500 : 780;
    const imgH = isSquare ? 660 : isStatus ? 900 : 700;
    const offerY = isSquare ? 820 : isStatus ? 1490 : 1130;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        {commonStyle}
        <defs>
          <linearGradient id="psBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#007c6d" />
            <stop offset=".52" stopColor="#14b890" />
            <stop offset="1" stopColor="#a9e25c" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} rx="54" fill="url(#psBg)" />
        <circle cx={W * 0.83} cy={H * 0.14} r={W * 0.25} fill="#fff16c" opacity=".32" />
        <text x={pad} y={pad + 20} className="brandSmall" fill="#dffff3">FRESH COLLECTION</text>
        <text x={pad} y={pad + 64} className="brandName" fill="#ffffff">NEW CITY STYLE</text>
        <BrandLogo x={W - pad - 92} y={pad - 8} size={92} draft={draft} />

        {isSquare ? (
          <>
            <rect x={pad} y="190" width="360" height="54" rx="27" fill="#fff16c" />
            <text x={pad + 180} y="226" textAnchor="middle" className="eyebrow" fill="#174d46">PRODUCT SPOTLIGHT</text>
            <g fill="#ffffff">
              {svgTextLines(headlineLines, pad, 330, 82, "headline", "start")}
              {svgTextLines(subtitleLines, pad, 610, 34, "subtitle", "start")}
            </g>
          </>
        ) : (
          <>
            <rect x={pad} y="170" width={W - pad * 2} height="54" rx="27" fill="#fff16c" />
            <text x={W / 2} y="206" textAnchor="middle" className="eyebrow" fill="#174d46">PRODUCT SPOTLIGHT</text>
            <g fill="#ffffff">
              {svgTextLines(headlineLines, W / 2, 330, isStatus ? 88 : 78, "headline", "middle")}
            </g>
          </>
        )}

        <ProductImage
          href={draft.productImage}
          x={imgX}
          y={imgY}
          width={imgW}
          height={imgH}
          rx={70}
          clipId={`ps-${format}`}
        />

        <rect x={pad} y={offerY} width={W - pad * 2} height={isStatus ? 250 : 170} rx="36" fill="#17204f" />
        <text x={W / 2} y={offerY + (isStatus ? 92 : 68)} textAnchor="middle" className="offer" fill="#ffffff">
          {draft.offerText || "SPECIAL OFFER"}
        </text>
        <text x={W / 2} y={offerY + (isStatus ? 158 : 124)} textAnchor="middle" className="meta" fill="#fff16c">
          {draft.couponCode ? `CODE ${draft.couponCode}` : ""} {draft.validUntil ? `   •   ${draft.validUntil}` : ""}
        </text>
        <text x={pad} y={H - 52} className="footer" fill="#ffffff">{draft.phone}</text>
        <text x={W - pad} y={H - 52} textAnchor="end" className="footer" fill="#ffffff">{draft.website}</text>
      </svg>
    );
  }

  if (draft.templateId === "flash-sticker") {
    const pad = isStatus ? 70 : 54;
    const imgX = isSquare ? 615 : 160;
    const imgY = isSquare ? 330 : isStatus ? 890 : 610;
    const imgW = isSquare ? 360 : 760;
    const imgH = isSquare ? 580 : isStatus ? 680 : 560;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        {commonStyle}
        <defs>
          <linearGradient id="fsBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#10163f" />
            <stop offset=".5" stopColor="#5b2ac0" />
            <stop offset="1" stopColor="#ff2e91" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} rx="54" fill="url(#fsBg)" />
        <g opacity=".22">
          {Array.from({ length: 18 }).map((_, i) => (
            <circle key={i} cx={(i * 137) % W} cy={(i * 211) % H} r="5" fill="#7dffda" />
          ))}
        </g>
        <text x={pad} y={pad + 18} className="brandSmall" fill="#7dffda">TRENDING NOW</text>
        <text x={pad} y={pad + 62} className="brandName" fill="#ffffff">NEW CITY STYLE</text>
        <rect x={W - pad - 150} y={pad - 8} width="150" height="70" rx="18" fill="#7dffda" transform={`rotate(3 ${W - pad - 75} ${pad + 27})`} />
        <text x={W - pad - 75} y={pad + 37} textAnchor="middle" className="eyebrow" fill="#17204f">{draft.couponCode || "NCS40"}</text>

        <rect x={pad} y="190" width={isSquare ? 470 : W - pad * 2} height="58" rx="29" fill="rgba(255,255,255,.16)" />
        <text x={isSquare ? pad + 235 : W / 2} y="228" textAnchor="middle" className="eyebrow" fill="#ffffff">FLASH STICKER SALE</text>

        <g fill="#ffffff">
          {svgTextLines(headlineLines, isSquare ? pad : W / 2, 360, isStatus ? 92 : 80, "headline", isSquare ? "start" : "middle")}
        </g>
        <g fill="#ffffff">
          {svgTextLines(subtitleLines, isSquare ? pad : W / 2, isSquare ? 650 : isStatus ? 650 : 670, 36, "subtitle", isSquare ? "start" : "middle")}
        </g>

        <rect
          x={isSquare ? 500 : pad}
          y={isSquare ? 690 : isStatus ? 1180 : 980}
          width={isSquare ? 500 : W - pad * 2}
          height={isStatus ? 260 : 210}
          rx="24"
          fill="#7dffda"
          transform={isSquare ? "rotate(-3 750 795)" : undefined}
        />
        <text
          x={isSquare ? 750 : W / 2}
          y={isSquare ? 755 : isStatus ? 1265 : 1055}
          textAnchor="middle"
          className="eyebrow"
          fill="#17204f"
        >
          FLASH DEAL
        </text>
        <text
          x={isSquare ? 750 : W / 2}
          y={isSquare ? 835 : isStatus ? 1360 : 1140}
          textAnchor="middle"
          className="offer"
          fill="#17204f"
        >
          {draft.offerText || "SPECIAL OFFER"}
        </text>

        <ProductImage
          href={draft.productImage}
          x={imgX}
          y={imgY}
          width={imgW}
          height={imgH}
          rx={isSquare ? 120 : 56}
          clipId={`fs-${format}`}
        />

        <rect x={pad} y={H - 120} width={W - pad * 2} height="64" rx="32" fill="rgba(255,255,255,.16)" />
        <text x={W / 2} y={H - 78} textAnchor="middle" className="meta" fill="#ffffff">
          {draft.validUntil || "Limited time"}   •   {draft.website || "newcitystyle.store"}   •   {draft.phone}
        </text>
      </svg>
    );
  }

  const pad = isStatus ? 70 : 54;
  const collageY = isStatus ? 650 : isSquare ? 270 : 460;
  const largeW = isSquare ? 470 : 620;
  const largeH = isSquare ? 560 : isStatus ? 720 : 600;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
      {commonStyle}
      <defs>
        <linearGradient id="ccBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00a9ff" />
          <stop offset=".48" stopColor="#7350ef" />
          <stop offset="1" stopColor="#ff55b7" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} rx="54" fill="url(#ccBg)" />
      <text x={pad} y={pad + 18} className="brandSmall" fill="#dff9ff">FASHION FOR EVERY FAMILY</text>
      <text x={pad} y={pad + 62} className="brandName" fill="#ffffff">NEW CITY STYLE</text>
      <BrandLogo x={W - pad - 92} y={pad - 8} size={92} draft={draft} />

      <rect x={pad} y="170" width={W - pad * 2} height="58" rx="29" fill="#fff36b" />
      <text x={W / 2} y="208" textAnchor="middle" className="eyebrow" fill="#17204f">CATEGORY COLLAGE</text>

      <g fill="#ffffff">
        {svgTextLines(headlineLines, W / 2, 330, isStatus ? 90 : 78, "headline", "middle")}
        {svgTextLines(subtitleLines, W / 2, isStatus ? 560 : 600, 36, "subtitle", "middle")}
      </g>

      <ProductImage
        href={draft.productImage}
        x={W / 2 - largeW / 2}
        y={collageY}
        width={largeW}
        height={largeH}
        rx={54}
        clipId={`cc-main-${format}`}
      />
      <ProductImage
        href={draft.productImage}
        x={pad}
        y={collageY + largeH * 0.18}
        width={isSquare ? 240 : 210}
        height={isSquare ? 300 : 270}
        rx={34}
        clipId={`cc-left-${format}`}
      />
      <ProductImage
        href={draft.productImage}
        x={W - pad - (isSquare ? 240 : 210)}
        y={collageY + largeH * 0.42}
        width={isSquare ? 240 : 210}
        height={isSquare ? 300 : 270}
        rx={34}
        clipId={`cc-right-${format}`}
      />

      <rect x={pad} y={H - (isStatus ? 330 : 260)} width={W - pad * 2} height={isStatus ? 210 : 170} rx="36" fill="#17204f" />
      <text x={W / 2} y={H - (isStatus ? 250 : 195)} textAnchor="middle" className="offer" fill="#ffffff">
        {draft.offerText || "SPECIAL OFFER"}
      </text>
      <text x={W / 2} y={H - (isStatus ? 185 : 145)} textAnchor="middle" className="meta" fill="#fff36b">
        {draft.couponCode ? `CODE ${draft.couponCode}` : ""} {draft.validUntil ? `   •   ${draft.validUntil}` : ""}
      </text>
      <text x={pad} y={H - 54} className="footer" fill="#ffffff">{draft.phone}</text>
      <text x={W - pad} y={H - 54} textAnchor="end" className="footer" fill="#ffffff">{draft.website}</text>
    </svg>
  );
}

export default function DigitalCardStudioPage() {
  const productInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const svgWrapRef = useRef<HTMLDivElement | null>(null);

  const [draft, setDraft] = useState<CardDraft>(INITIAL_DRAFT);
  const [savedDrafts, setSavedDrafts] = useState<CardDraft[]>([]);
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"editor" | "preview">("editor");

  const activeFormat = FORMATS[draft.format];

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CardDraft[];
      if (Array.isArray(parsed)) setSavedDrafts(parsed);
    } catch (error) {
      console.info("Unable to load saved cards:", error);
    }
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function updateDraft<K extends keyof CardDraft>(key: K, value: CardDraft[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
      updatedAt: new Date().toISOString(),
    }));
  }

  async function handleImageUpload(
    event: ChangeEvent<HTMLInputElement>,
    key: "productImage" | "logoImage",
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setNotice("Please select a valid image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setNotice("Image must be smaller than 10 MB.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateDraft(key, dataUrl);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to upload image.");
    } finally {
      event.target.value = "";
    }
  }

  function persistDrafts(next: CardDraft[]) {
    setSavedDrafts(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function saveCurrentDesign() {
    const now = new Date().toISOString();
    const nextDraft: CardDraft = {
      ...draft,
      id: draft.id === "current" ? createId() : draft.id,
      name: draft.name.trim() || draft.headline.trim() || "Untitled Card",
      createdAt: draft.id === "current" ? now : draft.createdAt,
      updatedAt: now,
    };

    const exists = savedDrafts.some((item) => item.id === nextDraft.id);
    const next = exists
      ? savedDrafts.map((item) => (item.id === nextDraft.id ? nextDraft : item))
      : [nextDraft, ...savedDrafts];

    persistDrafts(next);
    setDraft(nextDraft);
    setNotice("Design saved.");
  }

  function duplicateDesign() {
    const now = new Date().toISOString();
    setDraft((current) => ({
      ...current,
      id: createId(),
      name: `${current.name || current.headline} Copy`,
      createdAt: now,
      updatedAt: now,
    }));
    setNotice("Duplicate ready.");
  }

  function resetDesign() {
    setDraft({
      ...INITIAL_DRAFT,
      id: "current",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setNotice("New design ready.");
  }

  function loadSavedDesign(saved: CardDraft) {
    setDraft(saved);
    setMobilePanel("editor");
    setNotice("Saved design opened.");
  }

  function deleteSavedDesign(id: string) {
    const next = savedDrafts.filter((item) => item.id !== id);
    persistDrafts(next);
    if (draft.id === id) resetDesign();
    setNotice("Design deleted.");
  }

  function getSvgMarkup() {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) throw new Error("Card preview is not ready.");

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(activeFormat.width));
    clone.setAttribute("height", String(activeFormat.height));

    return new XMLSerializer().serializeToString(clone);
  }

  async function renderPngBlob() {
    const svgMarkup = getSvgMarkup();
    const svgBlob = new Blob([svgMarkup], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
      const image = new Image();
      image.decoding = "async";

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Unable to render card image."));
        image.src = svgUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = activeFormat.width;
      canvas.height = activeFormat.height;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not supported.");

      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Unable to export PNG."))),
          "image/png",
          1,
        );
      });
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  async function downloadCard() {
    setExporting(true);
    try {
      const blob = await renderPngBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeName = (draft.name || draft.headline || "ncs-card")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();

      anchor.href = url;
      anchor.download = `${safeName}-${draft.format}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice("PNG downloaded.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to download card.");
    } finally {
      setExporting(false);
    }
  }

  async function shareOnWhatsApp() {
    setExporting(true);
    try {
      const blob = await renderPngBlob();
      const file = new File([blob], "new-city-style-offer.png", {
        type: "image/png",
      });
      const text = [
        draft.headline,
        draft.offerText,
        draft.validUntil ? `Valid: ${draft.validUntil}` : "",
        draft.couponCode ? `Code: ${draft.couponCode}` : "",
        draft.customMessage,
        draft.website,
      ]
        .filter(Boolean)
        .join("\n");

      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: draft.headline,
          text,
          files: [file],
        });
        setNotice("Share panel opened.");
        return;
      }

      await downloadCard();
      window.open(
        `https://wa.me/?text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener,noreferrer",
      );
      setNotice("Card downloaded and WhatsApp opened.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setNotice("Share cancelled.");
      } else {
        setNotice(error instanceof Error ? error.message : "Unable to share card.");
      }
    } finally {
      setExporting(false);
    }
  }

  const previewStyle: CSSProperties = {
    aspectRatio: activeFormat.ratio,
  };

  return (
    <main className="ncsSvgStudioPage">
      <header className="ncsSvgHeader">
        <div>
          <span>NEW CITY STYLE CREATIVE SUITE</span>
          <h1>Digital Promotion Card Studio</h1>
          <p>
            Six completely different promotional layouts with exact SVG preview
            and PNG export.
          </p>
        </div>

        <div className="ncsSvgHeaderActions">
          <button type="button" onClick={resetDesign}>New Design</button>
          <button type="button" onClick={duplicateDesign}>Duplicate</button>
          <button type="button" className="primary" onClick={saveCurrentDesign}>
            Save Design
          </button>
        </div>
      </header>

      <div className="ncsSvgMobileTabs">
        <button
          type="button"
          className={mobilePanel === "editor" ? "active" : ""}
          onClick={() => setMobilePanel("editor")}
        >
          Editor
        </button>
        <button
          type="button"
          className={mobilePanel === "preview" ? "active" : ""}
          onClick={() => setMobilePanel("preview")}
        >
          Preview
        </button>
      </div>

      <section className="ncsSvgWorkspace">
        <aside className={`ncsSvgEditor ${mobilePanel === "editor" ? "mobileActive" : ""}`}>
          <section className="ncsSvgPanel">
            <h2>Format</h2>
            <div className="ncsSvgFormatGrid">
              {(Object.keys(FORMATS) as CardFormat[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={draft.format === key ? "selected" : ""}
                  onClick={() => updateDraft("format", key)}
                >
                  <strong>{FORMATS[key].label}</strong>
                  <small>{FORMATS[key].width} × {FORMATS[key].height}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="ncsSvgPanel">
            <div className="ncsSvgPanelHeading">
              <h2>Choose a true layout</h2>
              <span>{TEMPLATES.length} models</span>
            </div>

            <div className="ncsSvgTemplateGrid">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={draft.templateId === template.id ? "selected" : ""}
                  onClick={() => updateDraft("templateId", template.id)}
                >
                  <span style={{ background: template.preview }} />
                  <small>{template.category}</small>
                  <strong>{template.name}</strong>
                  <p>{template.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="ncsSvgPanel">
            <h2>Campaign content</h2>
            <div className="ncsSvgFormGrid">
              <label className="full">
                <span>Design name</span>
                <input
                  value={draft.name}
                  onChange={(event) => updateDraft("name", event.target.value)}
                />
              </label>
              <label className="full">
                <span>Main headline</span>
                <input
                  value={draft.headline}
                  onChange={(event) => updateDraft("headline", event.target.value)}
                />
              </label>
              <label className="full">
                <span>Subheadline</span>
                <input
                  value={draft.subheadline}
                  onChange={(event) => updateDraft("subheadline", event.target.value)}
                />
              </label>
              <label>
                <span>Offer text</span>
                <input
                  value={draft.offerText}
                  onChange={(event) => updateDraft("offerText", event.target.value)}
                />
              </label>
              <label>
                <span>Valid until</span>
                <input
                  value={draft.validUntil}
                  onChange={(event) => updateDraft("validUntil", event.target.value)}
                />
              </label>
              <label>
                <span>Coupon code</span>
                <input
                  value={draft.couponCode}
                  onChange={(event) =>
                    updateDraft("couponCode", event.target.value.toUpperCase())
                  }
                />
              </label>
              <label>
                <span>WhatsApp number</span>
                <input
                  value={draft.phone}
                  onChange={(event) =>
                    updateDraft("phone", event.target.value.replace(/[^\d+]/g, ""))
                  }
                />
              </label>
              <label className="full">
                <span>Website</span>
                <input
                  value={draft.website}
                  onChange={(event) => updateDraft("website", event.target.value)}
                />
              </label>
              <label className="full">
                <span>WhatsApp message</span>
                <textarea
                  rows={4}
                  value={draft.customMessage}
                  onChange={(event) =>
                    updateDraft("customMessage", event.target.value)
                  }
                />
              </label>
            </div>
          </section>

          <section className="ncsSvgPanel">
            <h2>Product and logo</h2>
            <div className="ncsSvgUploadGrid">
              <button type="button" onClick={() => productInputRef.current?.click()}>
                {draft.productImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.productImage} alt="Selected product" />
                ) : (
                  <b>＋</b>
                )}
                <strong>Product image</strong>
                <small>JPG, PNG or WEBP</small>
              </button>

              <button type="button" onClick={() => logoInputRef.current?.click()}>
                {draft.logoImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.logoImage} alt="Selected logo" />
                ) : (
                  <b>NCS</b>
                )}
                <strong>Store logo</strong>
                <small>Optional</small>
              </button>
            </div>

            <input
              ref={productInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => void handleImageUpload(event, "productImage")}
            />
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => void handleImageUpload(event, "logoImage")}
            />

            <div className="ncsSvgRemoveRow">
              {draft.productImage && (
                <button type="button" onClick={() => updateDraft("productImage", "")}>
                  Remove product image
                </button>
              )}
              {draft.logoImage && (
                <button type="button" onClick={() => updateDraft("logoImage", "")}>
                  Remove logo
                </button>
              )}
            </div>
          </section>

          {savedDrafts.length > 0 && (
            <section className="ncsSvgPanel">
              <div className="ncsSvgPanelHeading">
                <h2>Saved designs</h2>
                <span>{savedDrafts.length}</span>
              </div>
              <div className="ncsSvgSavedList">
                {savedDrafts.map((saved) => (
                  <article key={saved.id}>
                    <button type="button" onClick={() => loadSavedDesign(saved)}>
                      <strong>{saved.name || saved.headline}</strong>
                      <small>
                        {FORMATS[saved.format].label} •{" "}
                        {TEMPLATES.find((item) => item.id === saved.templateId)?.name}
                      </small>
                    </button>
                    <button
                      type="button"
                      className="delete"
                      onClick={() => deleteSavedDesign(saved.id)}
                    >
                      ×
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}
        </aside>

        <section
          className={`ncsSvgPreviewPanel ${
            mobilePanel === "preview" ? "mobileActive" : ""
          }`}
        >
          <div className="ncsSvgPreviewToolbar">
            <div>
              <span>LIVE SVG PREVIEW</span>
              <strong>
                {TEMPLATES.find((item) => item.id === draft.templateId)?.name}
              </strong>
            </div>
            <div>
              <button
                type="button"
                onClick={() => void downloadCard()}
                disabled={exporting}
              >
                {exporting ? "Preparing..." : "Download PNG"}
              </button>
              <button
                type="button"
                className="whatsapp"
                onClick={() => void shareOnWhatsApp()}
                disabled={exporting}
              >
                Share on WhatsApp
              </button>
            </div>
          </div>

          <div className="ncsSvgPreviewStage">
            <div
              ref={svgWrapRef}
              className={`ncsSvgCardWrap ncsSvgCardWrap-${draft.format}`}
              style={previewStyle}
            >
              <SvgCard draft={draft} format={draft.format} />
            </div>
          </div>

          <div className="ncsSvgPreviewInfo">
            <span>{activeFormat.width} × {activeFormat.height} PNG</span>
            <span>Exact SVG → PNG export</span>
            <span>No overlap layout engine</span>
          </div>
        </section>
      </section>

      {notice && <div className="ncsSvgNotice">{notice}</div>}

      <style jsx global>{`
        .ncsSvgStudioPage {
          min-height: 100vh;
          padding: 28px;
          background:
            radial-gradient(circle at 5% 5%, rgba(255, 94, 159, 0.12), transparent 22%),
            linear-gradient(145deg, #f8f4ec, #ffffff 50%, #eef3ff);
          color: #0a2e73;
        }

        .ncsSvgHeader {
          max-width: 1680px;
          margin: 0 auto 24px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 22px;
          padding: 26px 28px;
          border-radius: 24px;
          background:
            radial-gradient(circle at 88% 12%, rgba(255, 87, 166, 0.35), transparent 26%),
            linear-gradient(135deg, #091542, #4f2db8 52%, #ff3d8b);
          color: #ffffff;
          box-shadow: 0 18px 48px rgba(3,21,63,.18);
        }

        .ncsSvgHeader > div:first-child > span {
          color: #fff36b;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 1.2px;
        }

        .ncsSvgHeader h1 {
          margin: 8px 0 0;
          font-family: "Playfair Display", Georgia, serif;
          font-size: clamp(29px, 3vw, 46px);
          line-height: 1.05;
        }

        .ncsSvgHeader p {
          max-width: 760px;
          margin: 11px 0 0;
          color: rgba(255,255,255,.76);
          font-size: 13px;
          line-height: 1.6;
        }

        .ncsSvgHeaderActions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 9px;
        }

        .ncsSvgHeaderActions button,
        .ncsSvgPreviewToolbar button {
          min-height: 44px;
          padding: 0 17px;
          border: 1px solid rgba(255,255,255,.28);
          border-radius: 12px;
          background: rgba(255,255,255,.10);
          color: #ffffff;
          font: inherit;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .ncsSvgHeaderActions button.primary {
          border-color: #fff36b;
          background: #fff36b;
          color: #17204f;
        }

        .ncsSvgWorkspace {
          max-width: 1680px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(430px, .88fr) minmax(560px, 1.12fr);
          gap: 24px;
          align-items: start;
        }

        .ncsSvgEditor {
          display: grid;
          gap: 18px;
        }

        .ncsSvgPanel {
          padding: 22px;
          border: 1px solid rgba(10,46,115,.10);
          border-radius: 20px;
          background: rgba(255,255,255,.94);
          box-shadow: 0 14px 34px rgba(3,21,63,.08);
        }

        .ncsSvgPanel h2 {
          margin: 0 0 16px;
          color: #061d4a;
          font-size: 15px;
          font-weight: 950;
        }

        .ncsSvgPanelHeading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 16px;
        }

        .ncsSvgPanelHeading h2 {
          margin: 0;
        }

        .ncsSvgPanelHeading span {
          color: #7e8799;
          font-size: 9px;
          font-weight: 850;
        }

        .ncsSvgFormatGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 9px;
        }

        .ncsSvgFormatGrid button {
          min-height: 82px;
          padding: 10px;
          border: 1px solid rgba(10,46,115,.14);
          border-radius: 13px;
          background: #ffffff;
          color: #0a2e73;
          font: inherit;
          cursor: pointer;
        }

        .ncsSvgFormatGrid button.selected {
          border-color: #ff4f9a;
          background: linear-gradient(145deg, rgba(255,79,154,.12), rgba(114,72,230,.08));
          box-shadow: 0 8px 20px rgba(255,79,154,.13);
        }

        .ncsSvgFormatGrid strong,
        .ncsSvgFormatGrid small {
          display: block;
        }

        .ncsSvgFormatGrid strong {
          font-size: 10px;
        }

        .ncsSvgFormatGrid small {
          margin-top: 5px;
          color: #7e8799;
          font-size: 8px;
        }

        .ncsSvgTemplateGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          gap: 12px;
        }

        .ncsSvgTemplateGrid button {
          overflow: hidden;
          min-height: 190px;
          padding: 0 0 15px;
          border: 2px solid transparent;
          border-radius: 17px;
          background: #ffffff;
          color: #0a2e73;
          text-align: left;
          font: inherit;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(3,21,63,.10);
        }

        .ncsSvgTemplateGrid button.selected {
          border-color: #ff4f9a;
          box-shadow:
            0 0 0 3px rgba(255,79,154,.13),
            0 14px 28px rgba(3,21,63,.14);
        }

        .ncsSvgTemplateGrid button > span {
          display: block;
          height: 82px;
          margin-bottom: 13px;
        }

        .ncsSvgTemplateGrid small,
        .ncsSvgTemplateGrid strong,
        .ncsSvgTemplateGrid p {
          display: block;
          margin-right: 14px;
          margin-left: 14px;
        }

        .ncsSvgTemplateGrid small {
          color: #ff3f89;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .6px;
          text-transform: uppercase;
        }

        .ncsSvgTemplateGrid strong {
          margin-top: 5px;
          color: #061d4a;
          font-size: 14px;
        }

        .ncsSvgTemplateGrid p {
          margin-top: 7px;
          margin-bottom: 0;
          color: #6f788c;
          font-size: 9px;
          line-height: 1.45;
        }

        .ncsSvgFormGrid {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 13px;
        }

        .ncsSvgFormGrid label {
          display: grid;
          gap: 7px;
        }

        .ncsSvgFormGrid label.full {
          grid-column: 1 / -1;
        }

        .ncsSvgFormGrid label > span {
          color: #4d5872;
          font-size: 10px;
          font-weight: 850;
        }

        .ncsSvgFormGrid input,
        .ncsSvgFormGrid textarea {
          width: 100%;
          border: 1px solid rgba(10,46,115,.14);
          border-radius: 12px;
          outline: 0;
          background: #fffdf9;
          color: #061d4a;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          caret-color: #0a2e73;
        }

        .ncsSvgFormGrid input {
          min-height: 45px;
          padding: 0 13px;
        }

        .ncsSvgFormGrid textarea {
          padding: 12px 13px;
          resize: vertical;
        }

        .ncsSvgFormGrid input:focus,
        .ncsSvgFormGrid textarea:focus {
          border-color: #ff4f9a;
          box-shadow: 0 0 0 3px rgba(255,79,154,.12);
        }

        .ncsSvgUploadGrid {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 12px;
        }

        .ncsSvgUploadGrid button {
          min-height: 150px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 14px;
          border: 1px dashed rgba(10,46,115,.28);
          border-radius: 15px;
          background: linear-gradient(145deg,#fff,#f8f4ec);
          color: #0a2e73;
          font: inherit;
          cursor: pointer;
        }

        .ncsSvgUploadGrid img,
        .ncsSvgUploadGrid b {
          width: 68px;
          height: 68px;
          display: grid;
          place-items: center;
          object-fit: cover;
          border-radius: 13px;
          background: #0a2e73;
          color: #fff36b;
          font-size: 18px;
        }

        .ncsSvgUploadGrid strong {
          font-size: 11px;
        }

        .ncsSvgUploadGrid small {
          color: #7e8799;
          font-size: 8px;
        }

        .ncsSvgRemoveRow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 11px;
        }

        .ncsSvgRemoveRow button {
          min-height: 34px;
          padding: 0 11px;
          border: 1px solid rgba(179,38,30,.18);
          border-radius: 9px;
          background: rgba(179,38,30,.06);
          color: #a11f18;
          font: inherit;
          font-size: 9px;
          font-weight: 850;
          cursor: pointer;
        }

        .ncsSvgSavedList {
          display: grid;
          gap: 8px;
        }

        .ncsSvgSavedList article {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px;
          border: 1px solid rgba(10,46,115,.10);
          border-radius: 12px;
          background: #fffdf9;
        }

        .ncsSvgSavedList article > button:first-child {
          min-width: 0;
          flex: 1;
          padding: 7px;
          border: 0;
          background: transparent;
          color: inherit;
          text-align: left;
          font: inherit;
          cursor: pointer;
        }

        .ncsSvgSavedList strong,
        .ncsSvgSavedList small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsSvgSavedList strong {
          font-size: 10px;
        }

        .ncsSvgSavedList small {
          margin-top: 4px;
          color: #7e8799;
          font-size: 8px;
        }

        .ncsSvgSavedList button.delete {
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 9px;
          background: rgba(179,38,30,.07);
          color: #a11f18;
          font-size: 17px;
          cursor: pointer;
        }

        .ncsSvgPreviewPanel {
          position: sticky;
          top: 84px;
          overflow: hidden;
          border-radius: 23px;
          background: linear-gradient(145deg,#07163e,#0b2d6d);
          box-shadow: 0 24px 55px rgba(3,21,63,.22);
        }

        .ncsSvgPreviewToolbar {
          min-height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 18px;
          border-bottom: 1px solid rgba(255,255,255,.10);
        }

        .ncsSvgPreviewToolbar > div:first-child span,
        .ncsSvgPreviewToolbar > div:first-child strong {
          display: block;
        }

        .ncsSvgPreviewToolbar > div:first-child span {
          color: #fff36b;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .ncsSvgPreviewToolbar > div:first-child strong {
          margin-top: 4px;
          color: #ffffff;
          font-size: 12px;
        }

        .ncsSvgPreviewToolbar > div:last-child {
          display: flex;
          gap: 9px;
        }

        .ncsSvgPreviewToolbar button.whatsapp {
          border-color: #43d17a;
          background: linear-gradient(135deg,#128c47,#25d366);
        }

        .ncsSvgPreviewStage {
          min-height: 760px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px;
          background:
            linear-gradient(45deg,rgba(255,255,255,.025) 25%,transparent 25%),
            linear-gradient(-45deg,rgba(255,255,255,.025) 25%,transparent 25%);
          background-size: 24px 24px;
        }

        .ncsSvgCardWrap {
          width: min(100%,620px);
          overflow: hidden;
          border-radius: 24px;
          box-shadow: 0 28px 58px rgba(0,0,0,.38);
        }

        .ncsSvgCardWrap-portrait {
          width: min(100%,500px);
        }

        .ncsSvgCardWrap-status {
          width: min(100%,390px);
        }

        .ncsSvgCardWrap svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .ncsSvgPreviewInfo {
          display: grid;
          grid-template-columns: repeat(3,1fr);
          gap: 1px;
          border-top: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.08);
        }

        .ncsSvgPreviewInfo span {
          padding: 14px;
          background: rgba(3,21,63,.72);
          color: #ffffff;
          text-align: center;
          font-size: 9px;
          font-weight: 800;
        }

        .ncsSvgNotice {
          position: fixed;
          z-index: 300;
          right: 24px;
          bottom: 24px;
          max-width: min(90vw,420px);
          padding: 13px 17px;
          border: 1px solid #ff4f9a;
          border-radius: 13px;
          background: #07163e;
          color: #ffffff;
          font-size: 11px;
          font-weight: 800;
          box-shadow: 0 16px 40px rgba(3,21,63,.32);
        }

        .ncsSvgMobileTabs {
          display: none;
        }

        @media (max-width: 980px) {
          .ncsSvgStudioPage {
            padding: 100px 14px 22px;
          }

          .ncsSvgHeader {
            flex-direction: column;
          }

          .ncsSvgMobileTabs {
            position: sticky;
            z-index: 20;
            top: 88px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            margin-bottom: 14px;
            padding: 4px;
            border-radius: 13px;
            background: rgba(255,255,255,.95);
          }

          .ncsSvgMobileTabs button {
            min-height: 40px;
            border: 0;
            border-radius: 9px;
            background: transparent;
            color: #0a2e73;
            font: inherit;
            font-size: 11px;
            font-weight: 900;
          }

          .ncsSvgMobileTabs button.active {
            background: linear-gradient(135deg,#4f2db8,#ff3d8b);
            color: #ffffff;
          }

          .ncsSvgWorkspace {
            display: block;
          }

          .ncsSvgEditor,
          .ncsSvgPreviewPanel {
            display: none;
          }

          .ncsSvgEditor.mobileActive {
            display: grid;
          }

          .ncsSvgPreviewPanel.mobileActive {
            display: block;
            position: static;
          }
        }

        @media (max-width: 620px) {
          .ncsSvgStudioPage {
            padding-right: 10px;
            padding-left: 10px;
          }

          .ncsSvgHeaderActions {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(2,1fr);
          }

          .ncsSvgHeaderActions button.primary {
            grid-column: 1 / -1;
          }

          .ncsSvgTemplateGrid,
          .ncsSvgFormGrid,
          .ncsSvgUploadGrid {
            grid-template-columns: 1fr;
          }

          .ncsSvgFormGrid label.full {
            grid-column: auto;
          }

          .ncsSvgPreviewToolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .ncsSvgPreviewToolbar > div:last-child {
            display: grid;
          }

          .ncsSvgPreviewStage {
            min-height: 520px;
            padding: 12px;
          }

          .ncsSvgPreviewInfo {
            grid-template-columns: 1fr;
          }

          .ncsSvgNotice {
            right: 12px;
            bottom: 12px;
            left: 12px;
            max-width: none;
          }
        }
      `}</style>
    </main>
  );
}