"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setEmail(user.email || "");

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setFullName(data.full_name || "");
        setMobile(data.mobile || "");
        setAddress(data.address || "");
        setCity(data.city || "");
        setState(data.state || "");
        setPincode(data.pincode || "");
      }
    }

    setLoading(false);
  }

  if (loading) {
    return <h2 style={{ padding: 40 }}>Loading...</h2>;
  }

  return (
    <div
      style={{
        background: "#F8F4EC",
        minHeight: "100vh",
        padding: "40px",
      }}
    >
      <div
        style={{
          maxWidth: "650px",
          margin: "auto",
          background: "#fff",
          padding: "35px",
          borderRadius: "20px",
          boxShadow: "0 10px 25px rgba(0,0,0,.12)",
        }}
      >
        <h1
          style={{
            color: "#0A2E73",
            textAlign: "center",
            marginBottom: "30px",
          }}
        >
          My Profile
        </h1>
        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={inputStyle}
        />

        <input
          type="email"
          value={email}
          disabled
          style={inputStyle}
        />

        <input
          type="text"
          placeholder="Mobile Number"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          style={inputStyle}
        />

        <textarea
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={{
            ...inputStyle,
            height: "100px",
            resize: "none",
          }}
        />

        <input
          type="text"
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          style={inputStyle}
        />

        <input
          type="text"
          placeholder="State"
          value={state}
          onChange={(e) => setState(e.target.value)}
          style={inputStyle}
        />

        <input
          type="text"
          placeholder="Pincode"
          value={pincode}
          onChange={(e) => setPincode(e.target.value)}
          style={inputStyle}
        />
        <button
          onClick={saveProfile}
          style={{
            width: "100%",
            background: "#0A2E73",
            color: "#fff",
            border: "none",
            padding: "14px",
            borderRadius: "10px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: "pointer",
            marginTop: "20px",
          }}
        >
          Save Profile
        </button>
      </div>
    </div>
  );

  async function saveProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please login first");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        full_name: fullName,
        email: email,
        mobile: mobile,
        address: address,
        city: city,
        state: state,
        pincode: pincode,
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Profile Updated Successfully");
  }
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "15px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "15px",
};