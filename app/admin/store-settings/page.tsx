"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type StoreSettings = {
  id?: string;
  store_name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

const initialSettings: StoreSettings = {
  store_name: "NEW CITY STYLE",
  tagline: "Style for Every Family",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "Andhra Pradesh",
  pincode: "",
};

export default function StoreSettingsPage() {
  const router = useRouter();

  const [settings, setSettings] =
    useState<StoreSettings>(initialSettings);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadStoreSettings();
  }, []);

  async function loadStoreSettings() {
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Store settings load error:", error);

        setMessage(
          "Store settings page opened successfully. The store_settings table may not exist yet."
        );

        setLoading(false);
        return;
      }

      if (data) {
        setSettings({
          id: data.id,
          store_name: data.store_name ?? "NEW CITY STYLE",
          tagline: data.tagline ?? "Style for Every Family",
          phone: data.phone ?? "",
          email: data.email ?? "",
          address: data.address ?? "",
          city: data.city ?? "",
          state: data.state ?? "Andhra Pradesh",
          pincode: data.pincode ?? "",
        });
      }
    } catch (error) {
      console.error(error);
      setMessage("Unable to load store settings.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(
    field: keyof StoreSettings,
    value: string
  ) {
    setSettings((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      const payload = {
        store_name: settings.store_name.trim(),
        tagline: settings.tagline.trim(),
        phone: settings.phone.trim(),
        email: settings.email.trim(),
        address: settings.address.trim(),
        city: settings.city.trim(),
        state: settings.state.trim(),
        pincode: settings.pincode.trim(),
        updated_at: new Date().toISOString(),
      };

      if (settings.id) {
        const { error } = await supabase
          .from("store_settings")
          .update(payload)
          .eq("id", settings.id);

        if (error) {
          throw error;
        }
      } else {
        const { data, error } = await supabase
          .from("store_settings")
          .insert(payload)
          .select()
          .single();

        if (error) {
          throw error;
        }

        setSettings((previous) => ({
          ...previous,
          id: data.id,
        }));
      }

      setMessage("Store details saved successfully.");
    } catch (error) {
      console.error("Store settings save error:", error);

      setMessage(
        "Page route is working, but store details could not be saved. Check whether the store_settings table exists in Supabase."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #d9d9d9",
    borderRadius: "8px",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    display: "block",
    marginBottom: "7px",
    color: "#0A2E73",
    fontWeight: 700,
  };

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f8f4ec",
        }}
      >
        <p>Loading store settings...</p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8f4ec",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            border: "none",
            background: "#0A2E73",
            color: "#ffffff",
            padding: "10px 18px",
            borderRadius: "8px",
            cursor: "pointer",
            marginBottom: "24px",
          }}
        >
          ← Back
        </button>

        <section
          style={{
            background: "#ffffff",
            padding: "30px",
            borderRadius: "16px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          }}
        >
          <h1
            style={{
              margin: 0,
              color: "#0A2E73",
              fontSize: "32px",
            }}
          >
            Store Details
          </h1>

          <p
            style={{
              color: "#666666",
              marginTop: "10px",
              marginBottom: "28px",
            }}
          >
            Manage NEW CITY STYLE store information.
          </p>

          {message && (
            <div
              style={{
                background: "#f8f4ec",
                border: "1px solid #D4AF37",
                color: "#0A2E73",
                padding: "12px 14px",
                borderRadius: "8px",
                marginBottom: "22px",
              }}
            >
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "20px",
              }}
            >
              <div>
                <label style={labelStyle}>Store Name</label>
                <input
                  value={settings.store_name}
                  onChange={(event) =>
                    handleChange("store_name", event.target.value)
                  }
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Tagline</label>
                <input
                  value={settings.tagline}
                  onChange={(event) =>
                    handleChange("tagline", event.target.value)
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Phone Number</label>
                <input
                  value={settings.phone}
                  onChange={(event) =>
                    handleChange("phone", event.target.value)
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Email Address</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(event) =>
                    handleChange("email", event.target.value)
                  }
                  style={inputStyle}
                />
              </div>

              <div
                style={{
                  gridColumn: "1 / -1",
                }}
              >
                <label style={labelStyle}>Store Address</label>
                <textarea
                  value={settings.address}
                  onChange={(event) =>
                    handleChange("address", event.target.value)
                  }
                  style={{
                    ...inputStyle,
                    minHeight: "110px",
                    resize: "vertical",
                  }}
                />
              </div>

              <div>
                <label style={labelStyle}>City</label>
                <input
                  value={settings.city}
                  onChange={(event) =>
                    handleChange("city", event.target.value)
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>State</label>
                <input
                  value={settings.state}
                  onChange={(event) =>
                    handleChange("state", event.target.value)
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Pincode</label>
                <input
                  value={settings.pincode}
                  onChange={(event) =>
                    handleChange("pincode", event.target.value)
                  }
                  style={inputStyle}
                  inputMode="numeric"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: "28px",
                border: "none",
                background: saving ? "#999999" : "#D4AF37",
                color: "#0A2E73",
                padding: "13px 26px",
                borderRadius: "8px",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "16px",
                fontWeight: 800,
              }}
            >
              {saving ? "Saving..." : "Save Store Details"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}