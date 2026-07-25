"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CartPage() {
  const router = useRouter();

  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCart();
  }, []);

  async function getCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  }

  async function loadCart() {
    const user = await getCurrentUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("cart")
      .select("*")
      .eq("user_id", user.id)
      .order("id", { ascending: false });

    if (error) {
      console.log(error);
      setLoading(false);
      return;
    }

    setCart(data || []);
    setLoading(false);
  }

  async function updateQuantity(
    id: number,
    quantity: number
  ) {
    if (quantity < 1) return;

    const { error } = await supabase
      .from("cart")
      .update({ quantity })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadCart();
  }

  async function removeItem(id: number) {
    const { error } = await supabase
      .from("cart")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadCart();
  }

  const total = cart.reduce(
    (sum, item) =>
      sum + item.price * item.quantity,
    0
  );

  if (loading) {
    return (
      <h2 style={{ padding: 40 }}>
        Loading...
      </h2>
    );
  }

  return (
    <div
      style={{
        padding: "40px",
        background: "#F8F4EC",
        minHeight: "100vh",
      }}
    >
      <h1
        style={{
          color: "#0A2E73",
          marginBottom: "30px",
        }}
      >
        Shopping Cart
      </h1>

      {cart.length === 0 ? (
        <div
          style={{
            background: "#fff",
            padding: "50px",
            borderRadius: "15px",
            textAlign: "center",
            boxShadow:
              "0 5px 20px rgba(0,0,0,.08)",
          }}
        >
          <h2>Your Cart is Empty</h2>

          <button
            onClick={() => router.push("/")}
            style={{
              marginTop: "20px",
              background: "#0A2E73",
              color: "#fff",
              border: "none",
              padding: "14px 30px",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Continue Shopping
          </button>
        </div>
      ) : (
        <>
          {cart.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                background: "#fff",
                padding: "20px",
                borderRadius: "12px",
                marginBottom: "20px",
                boxShadow:
                  "0 4px 10px rgba(0,0,0,.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "20px",
                }}
              >
                <img
                  src={item.image}
                  alt={item.name}
                  style={{
                    width: "120px",
                    height: "120px",
                    objectFit: "cover",
                    borderRadius: "10px",
                  }}
                />

                <div>
                  <h2>{item.name}</h2>

                  <p
                    style={{
                      color: "#0A2E73",
                      fontWeight: "bold",
                    }}
                  >
                    ₹{item.price}
                  </p>

                  <p>Size: {item.size}</p>

                  <p>Color: {item.color}</p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginTop: "15px",
                    }}
                  >
                    <button
                      onClick={() =>
                        updateQuantity(
                          item.id,
                          item.quantity - 1
                        )
                      }
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        background: "#fff",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "18px",
                      }}
                    >
                      -
                    </button>

                    <span
                      style={{
                        minWidth: "30px",
                        textAlign: "center",
                        fontSize: "18px",
                        fontWeight: "bold",
                      }}
                    >
                      {item.quantity}
                    </span>

                    <button
                      onClick={() =>
                        updateQuantity(
                          item.id,
                          item.quantity + 1
                        )
                      }
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        background: "#fff",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "18px",
                      }}
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() =>
                      removeItem(item.id)
                    }
                    style={{
                      marginTop: "18px",
                      background: "#dc2626",
                      color: "#fff",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Remove Item
                  </button>
                </div>
              </div>

              <div
                style={{
                  textAlign: "right",
                }}
              >
                <h2
                  style={{
                    color: "#0A2E73",
                    marginBottom: "10px",
                  }}
                >
                  ₹{item.price * item.quantity}
                </h2>
              </div>
            </div>
          ))}
          <div
            style={{
              background: "#fff",
              padding: "25px",
              borderRadius: "12px",
              boxShadow: "0 4px 10px rgba(0,0,0,.08)",
              marginTop: "30px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2>Total Amount</h2>

              <h2
                style={{
                  color: "#0A2E73",
                  fontSize: "30px",
                }}
              >
                ₹{total}
              </h2>
            </div>

            <button
              onClick={() =>
                router.push("/checkout")
              }
              style={{
                width: "100%",
                background: "#0A2E73",
                color: "#fff",
                border: "none",
                padding: "16px",
                borderRadius: "10px",
                fontSize: "18px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Proceed to Checkout
            </button>
          </div>
        </>
      )}
    </div>
    );
}