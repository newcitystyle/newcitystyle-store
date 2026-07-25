export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: "1000px",
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
        Privacy Policy
      </h1>

      <p>
        At <strong>NEW CITY STYLE</strong>, we respect your privacy and are
        committed to protecting your personal information.
      </p>

      <h2 style={{ color: "#0A2E73", marginTop: "35px" }}>
        Information We Collect
      </h2>

      <ul>
        <li>Name</li>
        <li>Email Address</li>
        <li>Mobile Number</li>
        <li>Shipping Address</li>
        <li>Order Details</li>
      </ul>

      <h2 style={{ color: "#0A2E73", marginTop: "35px" }}>
        How We Use Your Information
      </h2>

      <ul>
        <li>Process your orders</li>
        <li>Provide customer support</li>
        <li>Improve our services</li>
        <li>Send order updates</li>
      </ul>

      <h2 style={{ color: "#0A2E73", marginTop: "35px" }}>
        Data Security
      </h2>

      <p>
        We use secure systems and industry-standard practices to protect your
        personal information.
      </p>

      <h2 style={{ color: "#0A2E73", marginTop: "35px" }}>
        Contact
      </h2>

      <p>
        For any privacy-related questions, please contact NEW CITY STYLE
        customer support.
      </p>

      <div
        style={{
          marginTop: "45px",
          background: "#0A2E73",
          color: "#fff",
          padding: "25px",
          borderRadius: "15px",
          textAlign: "center",
        }}
      >
        <strong>NEW CITY STYLE</strong>
        <br />
        Style for Every Family
      </div>
    </main>
  );
}