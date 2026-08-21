import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

const SITE_URL =
  "https://www.newcitystyle.store";

type SearchParams = {
  image?: string | string[];
  title?: string | string[];
  description?: string | string[];
  link?: string | string[];
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

function firstValue(
  value: string | string[] | undefined
) {
  if (Array.isArray(value)) {
    return value[0]?.trim() || "";
  }

  return value?.trim() || "";
}

function safeHttpUrl(
  value: string,
  fallback = ""
) {
  if (!value) return fallback;

  try {
    const parsed = new URL(value);

    if (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:"
    ) {
      return parsed.toString();
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function cleanTitle(value: string) {
  return (
    value
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) ||
    "NEW CITY STYLE Special Offer"
  );
}

function cleanDescription(
  value: string
) {
  return (
    value
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220) ||
    "Discover premium fashion, offers and new arrivals from NEW CITY STYLE. Style for Every Family."
  );
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const params =
    await searchParams;

  const title =
    cleanTitle(
      firstValue(params.title)
    );

  const description =
    cleanDescription(
      firstValue(
        params.description
      )
    );

  const image =
    safeHttpUrl(
      firstValue(params.image)
    );

  const targetLink =
    safeHttpUrl(
      firstValue(params.link),
      SITE_URL
    );

  return {
    metadataBase:
      new URL(SITE_URL),

    title:
      `${title} | NEW CITY STYLE`,

    description,

    robots: {
      index: true,
      follow: true,
    },

    openGraph: {
      type: "website",

      siteName:
        "NEW CITY STYLE",

      locale:
        "en_IN",

      title,

      description,

      url:
        targetLink,

      images:
        image
          ? [
              {
                url: image,
                alt: title,
              },
            ]
          : [],
    },

    twitter: {
      card:
        "summary_large_image",

      title,

      description,

      images:
        image ? [image] : [],
    },
  };
}

export default async function MarketingSharePage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const title =
    cleanTitle(
      firstValue(params.title)
    );

  const description =
    cleanDescription(
      firstValue(
        params.description
      )
    );

  const image =
    safeHttpUrl(
      firstValue(params.image)
    );

  const targetLink =
    safeHttpUrl(
      firstValue(params.link),
      SITE_URL
    );

  return (
    <main className="page">
      <section className="card">
        <div className="brand">
          <span>NEW CITY STYLE</span>
          <small>
            Style for Every Family
          </small>
        </div>

        {image ? (
          <div className="imageFrame">
            <img
              src={image}
              alt={title}
            />
          </div>
        ) : (
          <div className="imageFallback">
            NEW CITY STYLE
          </div>
        )}

        <div className="content">
          <span className="eyebrow">
            NEW CITY STYLE
          </span>

          <h1>{title}</h1>

          <p>{description}</p>

          <Link
            href={targetLink}
            className="shopButton"
          >
            Shop Now
          </Link>

          <p className="secure">
            Premium Fashion • Secure Shopping
          </p>
        </div>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f8f4ec;
          font-family:
            Inter,
            Poppins,
            Arial,
            sans-serif;
        }

        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          background:
            radial-gradient(
              circle at top right,
              rgba(212, 175, 55, 0.18),
              transparent 32%
            ),
            linear-gradient(
              160deg,
              #f8f4ec 0%,
              #eef3ff 100%
            );
        }

        .card {
          width: 100%;
          max-width: 760px;
          overflow: hidden;
          border-radius: 28px;
          background: #ffffff;
          border:
            1px solid
            rgba(10, 46, 115, 0.08);
          box-shadow:
            0 24px 70px
            rgba(10, 46, 115, 0.14);
        }

        .brand {
          display: flex;
          align-items: center;
          justify-content:
            space-between;
          gap: 12px;
          padding:
            18px 24px;
          background:
            linear-gradient(
              100deg,
              #061b47,
              #0a2e73
            );
        }

        .brand span {
          color: #d4af37;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .brand small {
          color:
            rgba(
              255,
              255,
              255,
              0.86
            );
          font-size: 12px;
        }

        .imageFrame {
          width: 100%;
          background: #eef1f6;
        }

        .imageFrame img {
          width: 100%;
          display: block;
          height: auto;
          max-height: 820px;
          object-fit: contain;
        }

        .imageFallback {
          min-height: 360px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            linear-gradient(
              145deg,
              #061b47,
              #0a2e73
            );
          color: #d4af37;
          font-size: 28px;
          font-weight: 900;
        }

        .content {
          padding:
            28px 28px 32px;
        }

        .eyebrow {
          display: inline-block;
          margin-bottom: 8px;
          color: #d4af37;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 1.1px;
        }

        h1 {
          margin:
            0 0 12px;
          color: #0a2e73;
          font-size:
            clamp(
              24px,
              5vw,
              38px
            );
          line-height: 1.15;
        }

        p {
          margin:
            0 0 22px;
          color: #555f73;
          font-size: 15px;
          line-height: 1.7;
        }

        .shopButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 170px;
          min-height: 50px;
          padding:
            12px 24px;
          border-radius: 14px;
          text-decoration: none;
          background:
            linear-gradient(
              100deg,
              #0a2e73,
              #164ca8
            );
          color: #ffffff;
          font-size: 14px;
          font-weight: 900;
          box-shadow:
            0 10px 25px
            rgba(
              10,
              46,
              115,
              0.22
            );
        }

        .secure {
          margin:
            18px 0 0;
          color: #7d8492;
          font-size: 11px;
        }

        @media (
          max-width: 600px
        ) {
          .page {
            padding: 15px 10px;
          }

          .card {
            border-radius: 20px;
          }

          .brand {
            padding:
              15px 17px;
          }

          .brand span {
            font-size: 12px;
          }

          .brand small {
            font-size: 9px;
          }

          .content {
            padding:
              22px 18px 26px;
          }

          .shopButton {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}