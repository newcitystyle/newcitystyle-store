import Link from "next/link";

const collections = [
  {
    title: "Men's Collection",
    description: "Premium shirts, jeans, T-shirts and everyday fashion.",
    icon: "👔",
    href: "/search?q=Men",
  },
  {
    title: "Women's Collection",
    description: "Elegant sarees, tops, ethnic wear and modern styles.",
    icon: "👗",
    href: "/search?q=Women",
  },
  {
    title: "Kids Collection",
    description: "Comfortable and stylish fashion for boys and girls.",
    icon: "🧒",
    href: "/search?q=Kids",
  },
  {
    title: "Premium Sarees",
    description: "Beautiful sarees for celebrations and everyday wear.",
    icon: "🥻",
    href: "/search?q=Sarees",
  },
];

export default function CollectionsPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "70px 20px",
        background: "linear-gradient(180deg, #F8F4EC, #FFFFFF)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1250px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            maxWidth: "760px",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#D4AF37",
              fontWeight: 900,
              letterSpacing: "2px",
            }}
          >
            NEW CITY STYLE
          </p>

          <h1
            style={{
              margin: "12px 0 0",
              color: "#0A2E73",
              fontSize: "46px",
            }}
          >
            Our Collections
          </h1>

          <p
            style={{
              margin: "16px 0 0",
              color: "#667085",
              lineHeight: 1.7,
            }}
          >
            Explore premium fashion collections created for every member of
            the family.
          </p>
        </div>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
            marginTop: "45px",
          }}
        >
          {collections.map((collection) => (
            <article
              key={collection.title}
              style={{
                padding: "28px",
                border: "1px solid rgba(10,46,115,0.10)",
                borderRadius: "20px",
                background: "#FFFFFF",
                boxShadow: "0 12px 30px rgba(16,24,40,0.08)",
              }}
            >
              <div
                style={{
                  width: "65px",
                  height: "65px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "18px",
                  background: "#FFF8E4",
                  fontSize: "34px",
                }}
              >
                {collection.icon}
              </div>

              <h2
                style={{
                  margin: "22px 0 0",
                  color: "#0A2E73",
                  fontSize: "24px",
                }}
              >
                {collection.title}
              </h2>

              <p
                style={{
                  minHeight: "52px",
                  margin: "12px 0 0",
                  color: "#667085",
                  lineHeight: 1.6,
                }}
              >
                {collection.description}
              </p>

              <Link
                href={collection.href}
                style={{
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: "22px",
                  borderRadius: "11px",
                  background: "linear-gradient(135deg, #D4AF37, #F1D26A)",
                  color: "#0A2E73",
                  fontWeight: 900,
                  textDecoration: "none",
                }}
              >
                Explore Collection →
              </Link>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}