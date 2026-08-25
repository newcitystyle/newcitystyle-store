import type { Metadata } from "next";
import type { ReactNode } from "react";

type ProductMeta = {
  id?: string | number;
  name?: string | null;
  description?: string | null;
  brand?: string | null;
  category?: string | null;
  price?: number | string | null;
  mrp?: number | string | null;
  image?: string | null;
  image_url?: string | null;
  images?: string[] | string | null;
};

const SITE_URL = "https://www.newcitystyle.store";

const PRODUCT_SELECT =
  "id,name,description,brand,category,price,mrp,image,image_url,images";

function productName(product: ProductMeta) {
  return (
    product.name?.trim() ||
    "NEW CITY STYLE Product"
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function firstProductImage(
  product: ProductMeta
) {
  if (product.image_url?.trim()) {
    return product.image_url.trim();
  }

  if (product.image?.trim()) {
    return product.image.trim();
  }

  if (Array.isArray(product.images)) {
    return String(
      product.images.find(Boolean) || ""
    ).trim();
  }

  if (
    typeof product.images === "string" &&
    product.images.trim()
  ) {
    const value = product.images.trim();

    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return String(
          parsed.find(Boolean) || ""
        ).trim();
      }
    } catch {
      return value;
    }
  }

  return "";
}

function absoluteUrl(value: string) {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return "";
  }

  if (
    cleanValue.startsWith("https://") ||
    cleanValue.startsWith("http://")
  ) {
    return cleanValue;
  }

  if (cleanValue.startsWith("//")) {
    return `https:${cleanValue}`;
  }

  if (cleanValue.startsWith("/")) {
    return `${SITE_URL}${cleanValue}`;
  }

  return `${SITE_URL}/${cleanValue}`;
}

function formatPrice(value: unknown) {
  const amount = Number(value || 0);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return "";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function cleanIdentifier(value: string) {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

async function fetchProducts(
  query: string
): Promise<ProductMeta[] | null> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    console.error(
      "Product metadata: Supabase environment variables missing"
    );

    return null;
  }

  const url =
    `${supabaseUrl}/rest/v1/products?` +
    query;

  try {
    const response = await fetch(url, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization:
          `Bearer ${supabaseAnonKey}`,
      },

      next: {
        revalidate: 300,
      },
    });

    if (!response.ok) {
      console.error(
        "Product metadata fetch failed:",
        response.status,
        await response.text()
      );

      return null;
    }

    return (
      (await response.json()) as ProductMeta[]
    );
  } catch (error) {
    console.error(
      "Product metadata fetch error:",
      error
    );

    return null;
  }
}

async function loadProductMeta(
  rawIdentifier: string
): Promise<ProductMeta | null> {
  const identifier =
    cleanIdentifier(rawIdentifier);

  if (!identifier) {
    return null;
  }

  /*
   * STEP 1
   * If URL contains a numeric product ID,
   * load directly by products.id.
   */
  if (/^\d+$/.test(identifier)) {
    const rows = await fetchProducts(
      `id=eq.${encodeURIComponent(identifier)}` +
        `&select=${PRODUCT_SELECT}` +
        `&limit=1`
    );

    if (rows?.[0]) {
      return rows[0];
    }
  }

  /*
   * STEP 2
   * Product URLs on NEW CITY STYLE can use
   * human-readable slugs.
   *
   * Try products.slug first.
   */
  const slugRows = await fetchProducts(
    `slug=eq.${encodeURIComponent(identifier)}` +
      `&select=${PRODUCT_SELECT}` +
      `&limit=1`
  );

  if (slugRows?.[0]) {
    return slugRows[0];
  }

  /*
   * STEP 3
   * Safe fallback.
   *
   * If the products table does not contain a
   * slug column, or an older product URL was
   * generated from the product name, load
   * visible product information and compare
   * against a generated slug.
   */
  const fallbackRows =
    await fetchProducts(
      `select=${PRODUCT_SELECT}` +
        `&limit=1000`
    );

  if (!fallbackRows?.length) {
    return null;
  }

  const normalisedIdentifier =
    slugify(identifier);

  return (
    fallbackRows.find((product) => {
      const name =
        product.name?.trim() || "";

      if (!name) {
        return false;
      }

      return (
        slugify(name) ===
        normalisedIdentifier
      );
    }) || null
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}): Promise<Metadata> {
  const { id } = await params;

  const identifier =
    cleanIdentifier(id);

  const product =
    await loadProductMeta(identifier);

  const productUrl =
    `${SITE_URL}/product/` +
    encodeURIComponent(identifier);

  if (!product) {
    return {
      metadataBase:
        new URL(SITE_URL),

      title:
        "NEW CITY STYLE | Style for Every Family",

      description:
        "Premium fashion for Men, Women and Kids from NEW CITY STYLE.",

      alternates: {
        canonical: productUrl,
      },

      openGraph: {
        type: "website",
        siteName:
          "NEW CITY STYLE",
        locale:
          "en_IN",

        title:
          "NEW CITY STYLE | Style for Every Family",

        description:
          "Premium fashion for Men, Women and Kids from NEW CITY STYLE.",

        url:
          productUrl,
      },

      twitter: {
        card:
          "summary_large_image",

        title:
          "NEW CITY STYLE | Style for Every Family",

        description:
          "Premium fashion for Men, Women and Kids from NEW CITY STYLE.",
      },
    };
  }

  const name =
    productName(product);

  const rawImage =
    firstProductImage(product);

  const image =
    absoluteUrl(rawImage);

  const price =
    formatPrice(product.price);

  const mrp =
    formatPrice(product.mrp);

  const brand =
    product.brand?.trim() ||
    "NEW CITY STYLE";

  const category =
    product.category?.trim() ||
    "Fashion";

  const rawDescription =
    product.description
      ?.trim()
      .replace(/\s+/g, " ");

  const baseDescription =
    rawDescription?.slice(0, 150) ||
    `Premium ${category} from ${brand}. Style for Every Family.`;

  const description =
    price
      ? `${baseDescription} Price ${price}. Shop online at NEW CITY STYLE.`
      : `${baseDescription} Shop online at NEW CITY STYLE.`;

  const socialTitle =
    price
      ? `${name} – ${price} | NEW CITY STYLE`
      : `${name} | NEW CITY STYLE`;

  return {
    metadataBase:
      new URL(SITE_URL),

    title:
      socialTitle,

    description,

    alternates: {
      canonical:
        productUrl,
    },

    openGraph: {
      type:
        "website",

      siteName:
        "NEW CITY STYLE",

      locale:
        "en_IN",

      title:
        socialTitle,

      description,

      url:
        productUrl,

      images:
        image
          ? [
              {
                url: image,
                width: 1200,
                height: 1200,
                alt: name,
              },
            ]
          : [],
    },

    twitter: {
      card:
        "summary_large_image",

      title:
        socialTitle,

      description,

      images:
        image
          ? [image]
          : [],
    },

    other: {
      "product:brand":
        brand,

      "product:category":
        category,

      "product:price:amount":
        String(
          Number(
            product.price || 0
          )
        ),

      "product:price:currency":
        "INR",

      ...(image
        ? {
            "og:image:secure_url":
              image,
          }
        : {}),

      ...(mrp
        ? {
            "product:original_price":
              mrp,
          }
        : {}),
    },
  };
}

export default function ProductLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}