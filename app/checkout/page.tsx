"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CartItem = {
  id: number | string;
  product_id: number | string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  size?: string | null;
  color?: string | null;
};

type CheckoutDetails = {
  fullName: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

export default function CheckoutPage() {
  const router = useRouter();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [continuing, setContinuing] = useState(false);

  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Andhra Pradesh");

  useEffect(() => {
    loadCart();
    loadSavedAddress();
  }, []);

  async function loadCart() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = supabase
      .from("cart")
      .select("*")
      .order("id", { ascending: false });

    if (user) {
      query = query.eq("user_id", user.id);
      setEmail(user.email || "");
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      alert(`Cart load కాలేదు: ${error.message}`);
      setLoading(false);
      return;
    }

    setCartItems((data as CartItem[]) || []);
    setLoading(false);
  }

  function loadSavedAddress() {
    try {
      const savedData = localStorage.getItem(
        "new-city-style-checkout"
      );

      if (!savedData) return;

      const details = JSON.parse(
        savedData
      ) as Partial<CheckoutDetails>;

      setFullName(details.fullName || "");
      setMobile(details.mobile || "");
      setEmail(details.email || "");
      setAddress(details.address || "");
      setCity(details.city || "");
      setState(details.state || "Andhra Pradesh");
      setPincode(details.pincode || "");
    } catch (error) {
      console.error("Saved checkout data error:", error);
    }
  }

  const subtotal = useMemo(() => {
    return cartItems.reduce(
      (sum, item) =>
        sum + Number(item.price) * Number(item.quantity),
      0
    );
  }, [cartItems]);

  const shipping = subtotal >= 999 ? 0 : 99;
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + shipping + tax;

  function validateCheckout() {
    if (!fullName.trim()) {
      alert("Full Name enter చేయండి");
      return false;
    }

    const cleanedMobile = mobile.replace(/\D/g, "");

    if (cleanedMobile.length !== 10) {
      alert("Correct 10-digit mobile number enter చేయండి");
      return false;
    }

    if (!address.trim()) {
      alert("Full Address enter చేయండి");
      return false;
    }

    if (!city.trim()) {
      alert("City enter చేయండి");
      return false;
    }

    if (!state.trim()) {
      alert("State enter చేయండి");
      return false;
    }

    if (!/^\d{6}$/.test(pincode.trim())) {
      alert("Correct 6-digit pincode enter చేయండి");
      return false;
    }

    if (cartItems.length === 0) {
      alert("Cart is empty");
      return false;
    }

    return true;
  }

  function continueToPayment() {
    if (!validateCheckout()) return;

    setContinuing(true);

    const checkoutDetails: CheckoutDetails = {
      fullName: fullName.trim(),
      mobile: mobile.replace(/\D/g, ""),
      email: email.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
    };

    const orderSummary = {
      subtotal,
      shipping,
      tax,
      total,
      items: cartItems,
    };

    localStorage.setItem(
      "new-city-style-checkout",
      JSON.stringify(checkoutDetails)
    );

    localStorage.setItem(
      "new-city-style-order-summary",
      JSON.stringify(orderSummary)
    );

    router.push("/payment");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px",
    border: "1px solid #D1D5DB",
    borderRadius: "10px",
    fontSize: "16px",
    outline: "none",
    boxSizing: "border-box",
    background: "#FFFFFF",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    color: "#0A2E73",
    fontWeight: 700,
    marginBottom: "7px",
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#F8F4EC",
          color: "#0A2E73",
          fontSize: "22px",
          fontWeight: 700,
        }}
      >
        Loading Checkout...
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F8F4EC",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
            padding: "45px",
            borderRadius: "18px",
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontSize: "55px" }}>🛒</div>

          <h1 style={{ color: "#0A2E73" }}>
            Your Cart is Empty
          </h1>

          <button
            onClick={() => router.push("/")}
            style={{
              background: "#D4AF37",
              color: "#FFFFFF",
              border: "none",
              padding: "14px 24px",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F8F4EC",
        padding: "35px 20px 70px",
      }}
    >
      <div
        style={{
          maxWidth: "1300px",
          margin: "0 auto",
        }}
      >
        <section
          style={{
            background:
              "linear-gradient(135deg, #0A2E73 0%, #164CA8 100%)",
            color: "#FFFFFF",
            borderRadius: "20px",
            padding: "28px",
            marginBottom: "28px",
            boxShadow: "0 12px 35px rgba(10,46,115,0.25)",
          }}
        >
          <p
            style={{
              margin: "0 0 7px",
              color: "#D4AF37",
              fontWeight: 700,
              letterSpacing: "1px",
            }}
          >
            NEW CITY STYLE
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: "34px",
            }}
          >
            Secure Checkout
          </h1>

          <p
            style={{
              margin: "9px 0 0",
              opacity: 0.9,
            }}
          >
            మీ delivery details enter చేసి paymentకి continue
            చేయండి.
          </p>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "28px",
            alignItems: "start",
          }}
        >
          <section
            style={{
              background: "#FFFFFF",
              padding: "28px",
              borderRadius: "18px",
              boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
            }}
          >
            <h2
              style={{
                color: "#0A2E73",
                marginTop: 0,
                marginBottom: "24px",
              }}
            >
              Shipping Address
            </h2>

            <div style={{ marginBottom: "17px" }}>
              <label style={labelStyle}>Full Name *</label>
              <input
                placeholder="Enter your full name"
                value={fullName}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
                style={inputStyle}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "15px",
                marginBottom: "17px",
              }}
            >
              <div>
                <label style={labelStyle}>
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={mobile}
                  onChange={(event) =>
                    setMobile(
                      event.target.value.replace(/\D/g, "")
                    )
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginBottom: "17px" }}>
              <label style={labelStyle}>
                Full Address *
              </label>
              <textarea
                placeholder="House number, street, area, landmark"
                value={address}
                onChange={(event) =>
                  setAddress(event.target.value)
                }
                style={{
                  ...inputStyle,
                  minHeight: "120px",
                  resize: "vertical",
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "15px",
              }}
            >
              <div>
                <label style={labelStyle}>City *</label>
                <input
                  placeholder="City"
                  value={city}
                  onChange={(event) =>
                    setCity(event.target.value)
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>State *</label>
                <input
                  placeholder="State"
                  value={state}
                  onChange={(event) =>
                    setState(event.target.value)
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Pincode *</label>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit pincode"
                  value={pincode}
                  onChange={(event) =>
                    setPincode(
                      event.target.value.replace(/\D/g, "")
                    )
                  }
                  style={inputStyle}
                />
              </div>
            </div>
          </section>

          <section
            style={{
              background: "#FFFFFF",
              padding: "26px",
              borderRadius: "18px",
              boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
            }}
          >
            <h2
              style={{
                color: "#0A2E73",
                marginTop: 0,
                marginBottom: "22px",
              }}
            >
              Order Summary
            </h2>

            {cartItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  gap: "13px",
                  marginBottom: "17px",
                  paddingBottom: "17px",
                  borderBottom: "1px solid #E5E7EB",
                }}
              >
                <img
                  src={item.image}
                  alt={item.name}
                  style={{
                    width: "75px",
                    height: "90px",
                    objectFit: "cover",
                    borderRadius: "9px",
                    background: "#F3F4F6",
                  }}
                />

                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      color: "#0A2E73",
                      margin: "0 0 7px",
                      fontSize: "17px",
                    }}
                  >
                    {item.name}
                  </h3>

                  <p
                    style={{
                      color: "#666",
                      margin: "0 0 5px",
                    }}
                  >
                    Quantity: {item.quantity}
                  </p>

                  {(item.size || item.color) && (
                    <p
                      style={{
                        color: "#666",
                        margin: "0 0 5px",
                        fontSize: "14px",
                      }}
                    >
                      {item.size ? `Size: ${item.size}` : ""}
                      {item.size && item.color ? " | " : ""}
                      {item.color
                        ? `Color: ${item.color}`
                        : ""}
                    </p>
                  )}

                  <strong
                    style={{
                      color: "#D4AF37",
                      fontSize: "18px",
                    }}
                  >
                    ₹
                    {(
                      Number(item.price) *
                      Number(item.quantity)
                    ).toLocaleString("en-IN")}
                  </strong>
                </div>
              </div>
            ))}

            <div
              style={{
                display: "grid",
                gap: "11px",
                marginTop: "20px",
              }}
            >
              <SummaryRow
                title="Subtotal"
                value={`₹${subtotal.toLocaleString("en-IN")}`}
              />

              <SummaryRow
                title="Shipping"
                value={
                  shipping === 0 ? "FREE" : `₹${shipping}`
                }
              />

              <SummaryRow
                title="Tax (5%)"
                value={`₹${tax.toLocaleString("en-IN")}`}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "2px solid #E5E7EB",
                marginTop: "20px",
                paddingTop: "20px",
              }}
            >
              <span
                style={{
                  color: "#0A2E73",
                  fontSize: "21px",
                  fontWeight: 700,
                }}
              >
                Total
              </span>

              <span
                style={{
                  color: "#D4AF37",
                  fontSize: "27px",
                  fontWeight: 800,
                }}
              >
                ₹{total.toLocaleString("en-IN")}
              </span>
            </div>

            <button
              onClick={continueToPayment}
              disabled={continuing}
              style={{
                width: "100%",
                marginTop: "25px",
                background: "#D4AF37",
                color: "#FFFFFF",
                border: "none",
                padding: "16px",
                borderRadius: "11px",
                cursor: continuing
                  ? "not-allowed"
                  : "pointer",
                fontSize: "17px",
                fontWeight: 700,
                opacity: continuing ? 0.7 : 1,
              }}
            >
              {continuing
                ? "Please Wait..."
                : "Continue to Payment"}
            </button>

            <p
              style={{
                color: "#666",
                textAlign: "center",
                fontSize: "13px",
                lineHeight: 1.6,
                marginBottom: 0,
              }}
            >
              🔒 Your checkout information is protected.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function SummaryRow({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "15px",
      }}
    >
      <span style={{ color: "#555" }}>{title}</span>

      <strong style={{ color: "#0A2E73" }}>
        {value}
      </strong>
    </div>
  );
}