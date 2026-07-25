export default function Brands() {
  

  const brands = [
    "Men's Fashion",
    "Women's Fashion",
    "Kids Wear",
    "Premium Sarees",
    "Jeans Collection",
    "Festival Wear",
  ];


  return (
    <section
      style={{
        background: "#ffffff",
        padding: "80px 20px",
        textAlign: "center",
      }}
    >
      <h2
        style={{
          color: "#0A2E73",
          fontSize: "42px",
          marginBottom: "40px",
        }}
      >
        Our Collections
      </h2>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        {brands.map((brand) => (
  <div
    key={brand}
    style={{
      width: "220px",
      background: "#ffffff",
      borderRadius: "16px",
      padding: "30px",
      boxShadow: "0 8px 25px rgba(0,0,0,0.12)",
      fontSize: "22px",
      fontWeight: "bold",
      color: "#0A2E73",
    }}
  >
    {brand}
  </div>
))}
       
      </div>
    </section>
  );
}