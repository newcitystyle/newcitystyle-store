export default function ContactPage() {
  return (
    <main
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "60px 20px",
        lineHeight: 1.8,
      }}
    >
      <h1
        style={{
          color: "#0A2E73",
          fontSize: "42px",
          marginBottom: "20px",
        }}
      >
        Contact Us
      </h1>

      <p>
        We'd love to hear from you. If you have any questions about products,
        orders or support, please contact us.
      </p>

      <div
        style={{
          marginTop: "35px",
          background: "#F8F4EC",
          padding: "30px",
          borderRadius: "15px",
        }}
      >
        <h2 style={{ color: "#0A2E73" }}>Store Information</h2>

        <p>
          <strong>Store:</strong> NEW CITY STYLE
        </p>

        <p>
          <strong>Tagline:</strong> Style for Every Family
        </p>

        <p>
          <strong>Phone:</strong> +91 9010014001
        </p>

        <p>
          <strong>Email:</strong> customercare@newcitystyle.in
        </p>

        <p>
          <strong>Address:</strong> Sarubujjili, Srikakulam, Andhra Pradesh,
          India
        </p>
      </div>

      <div
        style={{
          marginTop: "40px",
          background: "#0A2E73",
          color: "white",
          padding: "25px",
          borderRadius: "15px",
          textAlign: "center",
        }}
      >
        <h2>Customer Support</h2>

        <p>
          Our support team is happy to help you with orders, returns, payments
          and product enquiries.
        </p>
      </div>
    </main>
  );
}