export default function FAQPage() {
  const faqs = [
    {
      q: "How long does delivery take?",
      a: "Most orders are delivered within 3–7 business days depending on your location.",
    },
    {
      q: "Can I return a product?",
      a: "Yes. Eligible products can be returned according to our Returns Policy.",
    },
    {
      q: "Which payment methods are available?",
      a: "We support UPI, Cards, Net Banking and Cash on Delivery where available.",
    },
    {
      q: "How can I track my order?",
      a: "Go to My Orders to check your latest order status.",
    },
    {
      q: "How do I contact customer support?",
      a: "You can contact us by phone or email through our Contact page.",
    },
  ];

  return (
    <main
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "60px 20px",
      }}
    >
      <h1
        style={{
          color: "#0A2E73",
          fontSize: "42px",
          marginBottom: "30px",
        }}
      >
        Frequently Asked Questions
      </h1>

      {faqs.map((item, index) => (
        <div
          key={index}
          style={{
            marginBottom: "20px",
            padding: "20px",
            borderRadius: "12px",
            background: "#F8F4EC",
          }}
        >
          <h3 style={{ color: "#0A2E73" }}>{item.q}</h3>

          <p>{item.a}</p>
        </div>
      ))}
    </main>
  );
}