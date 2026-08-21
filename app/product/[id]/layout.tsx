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

function productName(product: ProductMeta) {
  return product.name?.trim() || "NEW CITY STYLE Product";
}

function firstProductImage(product: ProductMeta) {
  if (product.image_url?.trim()) {
    return product.image_url.trim();
  }

  if (product.image?.trim()) {
    return product.image.trim();
  }

  if (Array.isArray(product.images)) {
    return String(product.images.find(Boolean) || "").trim();
  }

  if (
    typeof product.images === "string" &&
    product.images.trim()
  ) {
    const value = product.images.trim();

    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return String(parsed.find(Boolean) || "").trim();
      }
    } catch {
      return value;
    }
  }

  return "";
}

function absoluteUrl(value: string) {
  if (!value) return "";

  if (
    value.startsWith("https://") ||
    value.startsWith("http://")
  ) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${SITE_URL}${value}`;
  }

  return `${SITE_URL}/${value}`;
}

function formatPrice(value: unknown) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

async function loadProductMeta(
  id: string
): Promise<ProductMeta | null> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Product metadata: Supabase environment variables missing"
    );
    return null;
  }

  const url =
    `${supabaseUrl}/rest/v1/products` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&select=id,name,description,brand,category,price,mrp,image,image_url,images` +
    `&limit=1`;

  try {
    const response = await fetch(url, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
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

    const rows =
      (await response.json()) as ProductMeta[];

    return rows[0] || null;
  } catch (error) {
    console.error(
      "Product metadata fetch error:",
      error
    );

    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const product =
    await loadProductMeta(id);

  const productUrl =
    `${SITE_URL}/product/${encodeURIComponent(id)}`;

  if (!product) {
    return {
      title:
        "NEW CITY STYLE | Style for Every Family",

      description:
        "Premium fashion from NEW CITY STYLE.",

      alternates: {
        canonical: productUrl,
      },

      openGraph: {
        type: "website",
        siteName: "NEW CITY STYLE",
        title:
          "NEW CITY STYLE | Style for Every Family",
        description:
          "Premium fashion from NEW CITY STYLE.",
        url: productUrl,
      },

      twitter: {
        card: "summary_large_image",
        title: "NEW CITY STYLE",
        description:
          "Premium fashion from NEW CITY STYLE.",
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

  const baseDescription =
    product.description
      ?.trim()
      .replace(/\s+/g, " ")
      .slice(0, 150) ||
    `Premium ${category} from ${brand}. Style for Every Family.`;

  const description =
    price
      ? `${baseDescription} Price ${price}. Shop online at NEW CITY STYLE.`
      : baseDescription;

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
      type: "website",

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
        image ? [image] : [],
    },

    other: {
      "product:brand":
        brand,

      "product:category":
        category,

      "product:price:amount":
        String(Number(product.price || 0)),

      "product:price:currency":
        "INR",

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