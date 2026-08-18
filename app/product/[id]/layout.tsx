import type { Metadata } from "next";
import type { ReactNode } from "react";

type ProductMeta = {
  id?: string | number;
  name?: string | null;
  product_name?: string | null;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  image_url?: string | null;
  images?: string[] | string | null;
};

function productName(product: ProductMeta) {
  return (
    product.name ||
    product.product_name ||
    product.title ||
    "NEW CITY STYLE Product"
  );
}

function firstProductImage(product: ProductMeta) {
  if (product.image_url?.trim()) return product.image_url.trim();
  if (product.image?.trim()) return product.image.trim();

  if (Array.isArray(product.images)) {
    return product.images.find(Boolean) || "";
  }

  if (typeof product.images === "string" && product.images.trim()) {
    const value = product.images.trim();

    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return String(parsed.find(Boolean) || "");
      }
    } catch {
      return value;
    }
  }

  return "";
}

async function loadProductMeta(id: string): Promise<ProductMeta | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  const url =
    `${supabaseUrl}/rest/v1/products` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&select=id,name,product_name,title,description,image,image_url,images` +
    `&limit=1`;

  try {
    const response = await fetch(url, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) return null;

    const rows = (await response.json()) as ProductMeta[];
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProductMeta(id);

  if (!product) {
    return {
      title: "NEW CITY STYLE | Style for Every Family",
      description: "Premium fashion from NEW CITY STYLE.",
    };
  }

  const name = productName(product);
  const image = firstProductImage(product);
  const description =
    product.description?.trim().slice(0, 160) ||
    "Premium fashion from NEW CITY STYLE. Style for Every Family.";

  return {
    title: `${name} | NEW CITY STYLE`,
    description,
    openGraph: {
      title: name,
      description,
      type: "website",
      siteName: "NEW CITY STYLE",
      images: image
        ? [
            {
              url: image,
              alt: name,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
      images: image ? [image] : [],
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