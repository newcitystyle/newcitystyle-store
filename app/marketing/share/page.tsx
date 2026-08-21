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
  v?: string | string[];
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
    const parsed =
      new URL(value);

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

function cleanTitle(
  value: string
) {
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
    "Discover premium fashion, special offers and new arrivals from NEW CITY STYLE. Style for Every Family."
  );
}

function buildShareUrl(
  params: SearchParams
) {
  const url =
    new URL(
      "/marketing/share",
      SITE_URL
    );

  const image =
    firstValue(params.image);

  const title =
    firstValue(params.title);

  const description =
    firstValue(
      params.description
    );

  const link =
    firstValue(params.link);

  const version =
    firstValue(params.v);

  if (image) {
    url.searchParams.set(
      "image",
      image
    );
  }

  if (title) {
    url.searchParams.set(
      "title",
      title
    );
  }

  if (description) {
    url.searchParams.set(
      "description",
      description
    );
  }

  if (link) {
    url.searchParams.set(
      "link",
      link
    );
  }

  if (version) {
    url.searchParams.set(
      "v",
      version
    );
  }

  return url.toString();
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

  /*
   * IMPORTANT:
   * Facebook must see og:url as the SAME
   * creative-share URL it is scraping.
   *
   * Do NOT point og:url to the final
   * Shop Now destination.
   */
  const shareUrl =
    buildShareUrl(params);

  return {
    metadataBase:
      new URL(SITE_URL),

    title:
      `${title} | NEW CITY STYLE`,

    description,

    alternates: {
      canonical:
        shareUrl,
    },

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
        shareUrl,

      images:
        image
          ? [
              {
                url: image,

                width: 1080,

                height: 1350,

                alt:
                  `${title} - NEW CITY STYLE`,

                type:
                  "image/jpeg",
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
        image
          ? [image]
          : [],
    },

    other: {
      "og:image:width":
        "1080",

      "og:image:height":
        "1350",
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

  /*
   * This is the destination when
   * customer taps Shop Now.
   */
  const targetLink =
    safeHttpUrl(
      firstValue(params.link),
      SITE_URL
    );

  return (
    <main className="page">
      <section className="card">
        <div className="brand">
          <div>
            <strong>
              NEW CITY STYLE
            </strong>

            <span>
              Style for Every Family
            </span>
          </div>
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
            <strong>
              NEW CITY STYLE
            </strong>

            <span>
              Style for Every Family
            </span>
          </div>
        )}

        <div className="content">
          <span className="eyebrow">
            NEW CITY STYLE
          </span>

          <h1>
            {title}
          </h1>

          <p className="description">
            {description}
          </p>

          <Link
            href={targetLink}
            className="shopButton"
          >
            Shop Now
          </Link>

          <div className="trust">
            <span>
              ✓ Premium Fashion
            </span>

            <span>
              ✓ Secure Shopping
            </span>

            <span>
              ✓ NEW CITY STYLE
            </span>
          </div>
        </div>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
        }

        body {
          background: #f8f4ec;
          color: #172033;
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
            radial-gradient(
              circle at bottom left,
              rgba(10, 46, 115, 0.12),
              transparent 35%
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

          padding:
            18px 24px;

          background:
            linear-gradient(
              100deg,
              #061b47,
              #0a2e73
            );
        }

        .brand div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .brand strong {
          color: #d4af37;

          font-size: 16px;

          font-weight: 900;

          letter-spacing: 1.2px;
        }

        .brand span {
          color:
            rgba(
              255,
              255,
              255,
              0.88
            );

          font-size: 11px;
        }

        .imageFrame {
          width: 100%;

          background:
            #eef1f6;
        }

        .imageFrame img {
          display: block;

          width: 100%;

          height: auto;

          max-height: 850px;

          object-fit: contain;
        }

        .imageFallback {
          min-height: 420px;

          display: flex;

          flex-direction: column;

          align-items: center;

          justify-content: center;

          gap: 8px;

          background:
            linear-gradient(
              145deg,
              #061b47,
              #0a2e73
            );
        }

        .imageFallback strong {
          color: #d4af37;

          font-size: 30px;

          font-weight: 900;
        }

        .imageFallback span {
          color: #ffffff;

          font-size: 14px;
        }

        .content {
          padding:
            28px 28px 32px;
        }

        .eyebrow {
          display: inline-block;

          margin-bottom: 8px;

          color: #d4af37;

          font-size: 11px;

          font-weight: 900;

          letter-spacing: 1.2px;
        }

        h1 {
          margin:
            0 0 13px;

          color: #0a2e73;

          font-size:
            clamp(
              26px,
              5vw,
              40px
            );

          line-height: 1.15;
        }

        .description {
          margin:
            0 0 24px;

          color: #555f73;

          font-size: 15px;

          line-height: 1.7;
        }

        .shopButton {
          display: inline-flex;

          align-items: center;

          justify-content: center;

          min-width: 180px;

          min-height: 52px;

          padding:
            12px 26px;

          border-radius: 15px;

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
              0.23
            );
        }

        .trust {
          display: flex;

          flex-wrap: wrap;

          gap: 8px 16px;

          margin-top: 20px;

          color: #737b8c;

          font-size: 10px;

          font-weight: 700;
        }

        @media (
          max-width: 600px
        ) {
          .page {
            padding:
              14px 9px;
          }

          .card {
            border-radius: 20px;
          }

          .brand {
            padding:
              15px 17px;
          }

          .brand strong {
            font-size: 13px;
          }

          .brand span {
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