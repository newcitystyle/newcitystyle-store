import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "badri.nsv@gmail.com";
const NEW_PRODUCTS_TOPIC = "ncs_new_products";

type RequestBody = {
  productId?: number | string;
};

type ProductRow = {
  id: number;
  name?: string | null;
  slug?: string | null;
  price?: number | string | null;
  mrp?: number | string | null;
  image?: string | null;
  image_url?: string | null;
  social_preview_url?: string | null;
  category?: string | null;
  is_active?: boolean | null;
  sell_online?: boolean | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: unknown) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function createServerSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Supabase server credentials are missing.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getFirebaseMessaging() {
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() || "";

  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is missing."
    );
  }

  let serviceAccount: {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON."
    );
  }

  const projectId = clean(serviceAccount.project_id);
  const clientEmail = clean(serviceAccount.client_email);
  const privateKey = clean(serviceAccount.private_key).replace(
    /\\n/g,
    "\n"
  );

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase service account JSON is incomplete."
    );
  }

  if (projectId !== "new-city-style") {
    throw new Error(
      `Firebase project mismatch. Expected new-city-style, received ${projectId}.`
    );
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return getMessaging();
}

async function requireAdmin(
  request: NextRequest,
  supabase: ReturnType<typeof createServerSupabase>
) {
  const authorization =
    request.headers.get("authorization")?.trim() || "";

  const token = authorization
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          error: "Missing admin authorization.",
        },
        { status: 401 }
      ),
    };
  }

  const { data, error } = await supabase.auth.getUser(token);

  const email =
    data.user?.email?.trim().toLowerCase() || "";

  if (
    error ||
    !data.user ||
    email !== ADMIN_EMAIL
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          error: "Unauthorized admin request.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true as const,
    userId: data.user.id,
    email,
  };
}

function notificationBody(product: ProductRow) {
  const name = clean(product.name) || "New arrival";
  const price = money(product.price);

  return price
    ? `${name} • ${price} • Tap to explore`
    : `${name} is now available • Tap to explore`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabase();

    const admin = await requireAdmin(request, supabase);

    if (!admin.ok) {
      return admin.response;
    }

    const body = (await request.json()) as RequestBody;
    const productId = Number(body.productId);

    if (!Number.isFinite(productId) || productId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid productId is required.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("products")
      .select(
        "id,name,slug,price,mrp,image,image_url,social_preview_url,category,is_active,sell_online"
      )
      .eq("id", productId)
      .single<ProductRow>();

    if (error || !data) {
      return NextResponse.json(
        {
          success: false,
          error:
            error?.message ||
            `Product #${productId} was not found.`,
        },
        { status: 404 }
      );
    }

    /*
     * Do not announce drafts/inactive items as a new arrival.
     * If sell_online is explicitly false, keep the product save
     * successful but skip the customer notification.
     */
    if (data.is_active === false) {
      return NextResponse.json({
        success: true,
        sent: false,
        skipped: true,
        reason: "Product is inactive.",
        productId: data.id,
      });
    }

    if (data.sell_online === false) {
      return NextResponse.json({
        success: true,
        sent: false,
        skipped: true,
        reason: "Product is not enabled for online sale.",
        productId: data.id,
      });
    }

    const messaging = getFirebaseMessaging();

    const productName =
      clean(data.name) || "New arrival";

    const productUrl = clean(data.slug)
      ? `https://newcitystyle.store/product/${encodeURIComponent(
          clean(data.slug)
        )}`
      : `https://newcitystyle.store/product/${data.id}`;

    const messageId = await messaging.send({
      topic: NEW_PRODUCTS_TOPIC,
      notification: {
        title: "NEW CITY STYLE • NEW ARRIVAL",
        body: notificationBody(data),
      },
      data: {
        title: "NEW CITY STYLE • NEW ARRIVAL",
        body: notificationBody(data),
        productId: String(data.id),
        productName,
        productUrl,
        category: clean(data.category),
        price: clean(data.price),
        imageUrl:
          clean(data.social_preview_url) ||
          clean(data.image_url) ||
          clean(data.image),
        source: "NCS_WEB_NEW_PRODUCT",
      },
      android: {
        priority: "high",
        notification: {
          channelId: "ncs_new_arrivals",
          sound: "default",
        },
      },
    });

    return NextResponse.json({
      success: true,
      sent: true,
      topic: NEW_PRODUCTS_TOPIC,
      productId: data.id,
      productName,
      firebaseMessageId: messageId,
    });
  } catch (error) {
    console.error("NCS new-product native push error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected native push error.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "NCS Native New Product Push",
    configured: {
      firebaseServiceAccount: Boolean(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
      ),
      supabaseServer: Boolean(
        (
          process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
          process.env.SUPABASE_URL?.trim()
        ) &&
          (
            process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
            process.env.SUPABASE_SERVICE_KEY?.trim()
          )
      ),
    },
    firebaseProject: "new-city-style",
    topic: NEW_PRODUCTS_TOPIC,
  });
}
