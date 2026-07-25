"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AnalyticsSettings = {
  id: number;
  google_analytics_id: string;
  google_tag_manager_id: string;
  meta_pixel_id: string;
  google_ads_id: string;
  tracking_enabled: boolean;
  analytics_enabled: boolean;
  meta_pixel_enabled: boolean;
  tag_manager_enabled: boolean;
  updated_at?: string;
};

const defaultSettings: AnalyticsSettings = {
  id: 1,
  google_analytics_id: "",
  google_tag_manager_id: "",
  meta_pixel_id: "",
  google_ads_id: "",
  tracking_enabled: true,
  analytics_enabled: false,
  meta_pixel_enabled: false,
  tag_manager_enabled: false,
};

export default function AdminAnalyticsPage() {
  const router = useRouter();

  const [settings, setSettings] =
    useState<AnalyticsSettings>(defaultSettings);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [successMessage, setSuccessMessage] =
    useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    loadAnalyticsSettings();
  }, []);

  async function loadAnalyticsSettings() {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("analytics_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        setSettings({
          id: data.id ?? 1,
          google_analytics_id:
            data.google_analytics_id ?? "",
          google_tag_manager_id:
            data.google_tag_manager_id ?? "",
          meta_pixel_id:
            data.meta_pixel_id ?? "",
          google_ads_id:
            data.google_ads_id ?? "",
          tracking_enabled:
            data.tracking_enabled ?? true,
          analytics_enabled:
            data.analytics_enabled ?? false,
          meta_pixel_enabled:
            data.meta_pixel_enabled ?? false,
          tag_manager_enabled:
            data.tag_manager_enabled ?? false,
          updated_at: data.updated_at,
        });
      }
    } catch (error) {
      console.error(
        "Analytics settings load error:",
        error
      );

      setErrorMessage(
        "Analytics settings could not be loaded. Check whether the analytics_settings table exists in Supabase."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleTextChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const { name, value } = event.target;

    setSettings((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleBooleanChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const { name, checked } = event.target;

    setSettings((previous) => ({
      ...previous,
      [name]: checked,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const payload: AnalyticsSettings = {
        id: 1,
        google_analytics_id:
          settings.google_analytics_id.trim(),
        google_tag_manager_id:
          settings.google_tag_manager_id.trim(),
        meta_pixel_id:
          settings.meta_pixel_id.trim(),
        google_ads_id:
          settings.google_ads_id.trim(),
        tracking_enabled:
          settings.tracking_enabled,
        analytics_enabled:
          settings.analytics_enabled,
        meta_pixel_enabled:
          settings.meta_pixel_enabled,
        tag_manager_enabled:
          settings.tag_manager_enabled,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("analytics_settings")
        .upsert(payload, {
          onConflict: "id",
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setSettings({
          id: data.id ?? 1,
          google_analytics_id:
            data.google_analytics_id ??
            payload.google_analytics_id,
          google_tag_manager_id:
            data.google_tag_manager_id ??
            payload.google_tag_manager_id,
          meta_pixel_id:
            data.meta_pixel_id ??
            payload.meta_pixel_id,
          google_ads_id:
            data.google_ads_id ??
            payload.google_ads_id,
          tracking_enabled:
            data.tracking_enabled ??
            payload.tracking_enabled,
          analytics_enabled:
            data.analytics_enabled ??
            payload.analytics_enabled,
          meta_pixel_enabled:
            data.meta_pixel_enabled ??
            payload.meta_pixel_enabled,
          tag_manager_enabled:
            data.tag_manager_enabled ??
            payload.tag_manager_enabled,
          updated_at:
            data.updated_at ??
            payload.updated_at,
        });
      }

      setSuccessMessage(
        "Analytics settings saved successfully."
      );
    } catch (error) {
      console.error(
        "Analytics settings save error:",
        error
      );

      setErrorMessage(
        "Analytics settings could not be saved. Check the Supabase table and policies."
      );
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    const confirmed = window.confirm(
      "Reset all analytics fields?"
    );

    if (!confirmed) {
      return;
    }

    setSettings(defaultSettings);
    setSuccessMessage(
      "Default values restored. Click Save Analytics Settings."
    );
    setErrorMessage("");
  }

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#f5f7fb",
      padding: "24px",
      fontFamily:
        "Arial, Helvetica, sans-serif",
    },

    container: {
      width: "100%",
      maxWidth: "1180px",
      margin: "0 auto",
    },

    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "16px",
      flexWrap: "wrap" as const,
      marginBottom: "24px",
    },

    title: {
      margin: 0,
      color: "#0A2E73",
      fontSize: "32px",
      fontWeight: 800,
    },

    subtitle: {
      margin: "8px 0 0",
      color: "#667085",
      lineHeight: 1.6,
    },

    card: {
      background: "#ffffff",
      border: "1px solid #e7eaf0",
      borderRadius: "18px",
      padding: "26px",
      boxShadow:
        "0 12px 35px rgba(10, 46, 115, 0.07)",
      marginBottom: "22px",
    },

    sectionTitle: {
      margin: "0 0 8px",
      color: "#0A2E73",
      fontSize: "21px",
      fontWeight: 800,
    },

    sectionText: {
      margin: "0 0 22px",
      color: "#667085",
      lineHeight: 1.6,
    },

    grid: {
      display: "grid",
      gridTemplateColumns:
        "repeat(auto-fit, minmax(280px, 1fr))",
      gap: "20px",
    },

    fullWidth: {
      gridColumn: "1 / -1",
    },

    label: {
      display: "block",
      color: "#25324b",
      fontWeight: 700,
      fontSize: "14px",
      marginBottom: "8px",
    },

    input: {
      width: "100%",
      boxSizing: "border-box" as const,
      padding: "13px 14px",
      border: "1px solid #d8dee9",
      borderRadius: "10px",
      outline: "none",
      fontSize: "15px",
      color: "#1d2939",
      background: "#ffffff",
    },

    helper: {
      marginTop: "7px",
      color: "#7a8497",
      fontSize: "12px",
      lineHeight: 1.5,
    },

    toggleRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "20px",
      padding: "16px",
      border: "1px solid #e7eaf0",
      borderRadius: "12px",
      background: "#fafbfe",
    },

    toggleLabel: {
      margin: 0,
      color: "#25324b",
      fontWeight: 800,
      fontSize: "15px",
    },

    toggleDescription: {
      margin: "5px 0 0",
      color: "#667085",
      fontSize: "13px",
      lineHeight: 1.5,
    },

    checkbox: {
      width: "21px",
      height: "21px",
      cursor: "pointer",
      accentColor: "#0A2E73",
      flexShrink: 0,
    },

    messageSuccess: {
      padding: "14px 16px",
      borderRadius: "10px",
      background: "#edf9f0",
      border: "1px solid #a6dcb1",
      color: "#166534",
      marginBottom: "20px",
      fontWeight: 700,
    },

    messageError: {
      padding: "14px 16px",
      borderRadius: "10px",
      background: "#fff1f1",
      border: "1px solid #f3b6b6",
      color: "#b42318",
      marginBottom: "20px",
      fontWeight: 700,
    },

    buttonRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: "12px",
      flexWrap: "wrap" as const,
      marginTop: "24px",
    },

    primaryButton: {
      border: "none",
      borderRadius: "10px",
      padding: "13px 24px",
      background: "#D4AF37",
      color: "#0A2E73",
      fontSize: "15px",
      fontWeight: 800,
      cursor: "pointer",
    },

    secondaryButton: {
      border: "1px solid #d8dee9",
      borderRadius: "10px",
      padding: "12px 20px",
      background: "#ffffff",
      color: "#25324b",
      fontSize: "15px",
      fontWeight: 700,
      cursor: "pointer",
    },

    noteBox: {
      background: "#f8f4ec",
      border: "1px solid #D4AF37",
      borderRadius: "12px",
      padding: "16px",
      color: "#0A2E73",
      lineHeight: 1.6,
    },
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.card}>
            <h1 style={styles.title}>
              Analytics Settings
            </h1>

            <p style={styles.subtitle}>
              Loading analytics settings...
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>
              Analytics Settings
            </h1>

            <p style={styles.subtitle}>
              Manage Google Analytics, Google Tag
              Manager, Meta Pixel and advertising
              tracking settings.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            style={styles.secondaryButton}
          >
            ← Back
          </button>
        </div>

        {successMessage && (
          <div style={styles.messageSuccess}>
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div style={styles.messageError}>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>
              Google Tracking
            </h2>

            <p style={styles.sectionText}>
              Add your Google tracking IDs. Leave fields
              blank until the IDs are available.
            </p>

            <div style={styles.grid}>
              <div>
                <label
                  htmlFor="google_analytics_id"
                  style={styles.label}
                >
                  Google Analytics Measurement ID
                </label>

                <input
                  id="google_analytics_id"
                  name="google_analytics_id"
                  type="text"
                  value={settings.google_analytics_id}
                  onChange={handleTextChange}
                  style={styles.input}
                  placeholder="G-XXXXXXXXXX"
                />

                <p style={styles.helper}>
                  Example: G-ABC123XYZ
                </p>
              </div>

              <div>
                <label
                  htmlFor="google_tag_manager_id"
                  style={styles.label}
                >
                  Google Tag Manager ID
                </label>

                <input
                  id="google_tag_manager_id"
                  name="google_tag_manager_id"
                  type="text"
                  value={
                    settings.google_tag_manager_id
                  }
                  onChange={handleTextChange}
                  style={styles.input}
                  placeholder="GTM-XXXXXXX"
                />

                <p style={styles.helper}>
                  Example: GTM-ABC1234
                </p>
              </div>

              <div>
                <label
                  htmlFor="google_ads_id"
                  style={styles.label}
                >
                  Google Ads ID
                </label>

                <input
                  id="google_ads_id"
                  name="google_ads_id"
                  type="text"
                  value={settings.google_ads_id}
                  onChange={handleTextChange}
                  style={styles.input}
                  placeholder="AW-XXXXXXXXX"
                />

                <p style={styles.helper}>
                  Optional Google Ads conversion ID.
                </p>
              </div>

              <div>
                <label
                  htmlFor="meta_pixel_id"
                  style={styles.label}
                >
                  Meta Pixel ID
                </label>

                <input
                  id="meta_pixel_id"
                  name="meta_pixel_id"
                  type="text"
                  value={settings.meta_pixel_id}
                  onChange={handleTextChange}
                  style={styles.input}
                  placeholder="123456789012345"
                />

                <p style={styles.helper}>
                  Enter only the numeric Meta Pixel ID.
                </p>
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>
              Tracking Controls
            </h2>

            <p style={styles.sectionText}>
              Enable or disable website tracking
              services.
            </p>

            <div
              style={{
                display: "grid",
                gap: "14px",
              }}
            >
              <div style={styles.toggleRow}>
                <div>
                  <p style={styles.toggleLabel}>
                    Master Tracking Switch
                  </p>

                  <p style={styles.toggleDescription}>
                    Turns all website tracking services
                    on or off.
                  </p>
                </div>

                <input
                  type="checkbox"
                  name="tracking_enabled"
                  checked={settings.tracking_enabled}
                  onChange={handleBooleanChange}
                  style={styles.checkbox}
                />
              </div>

              <div style={styles.toggleRow}>
                <div>
                  <p style={styles.toggleLabel}>
                    Enable Google Analytics
                  </p>

                  <p style={styles.toggleDescription}>
                    Enables website visitor and traffic
                    measurement.
                  </p>
                </div>

                <input
                  type="checkbox"
                  name="analytics_enabled"
                  checked={settings.analytics_enabled}
                  onChange={handleBooleanChange}
                  style={styles.checkbox}
                />
              </div>

              <div style={styles.toggleRow}>
                <div>
                  <p style={styles.toggleLabel}>
                    Enable Google Tag Manager
                  </p>

                  <p style={styles.toggleDescription}>
                    Enables Google Tag Manager tracking.
                  </p>
                </div>

                <input
                  type="checkbox"
                  name="tag_manager_enabled"
                  checked={
                    settings.tag_manager_enabled
                  }
                  onChange={handleBooleanChange}
                  style={styles.checkbox}
                />
              </div>

              <div style={styles.toggleRow}>
                <div>
                  <p style={styles.toggleLabel}>
                    Enable Meta Pixel
                  </p>

                  <p style={styles.toggleDescription}>
                    Enables Facebook and Instagram
                    advertising tracking.
                  </p>
                </div>

                <input
                  type="checkbox"
                  name="meta_pixel_enabled"
                  checked={
                    settings.meta_pixel_enabled
                  }
                  onChange={handleBooleanChange}
                  style={styles.checkbox}
                />
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>
              Important Note
            </h2>

            <div style={styles.noteBox}>
              Saving IDs here stores them in Supabase.
              In the next step, we will connect these
              saved values to the main website layout so
              tracking scripts load automatically.
            </div>

            <div style={styles.buttonRow}>
              <button
                type="button"
                onClick={resetForm}
                style={styles.secondaryButton}
                disabled={saving}
              >
                Reset
              </button>

              <button
                type="submit"
                style={{
                  ...styles.primaryButton,
                  opacity: saving ? 0.65 : 1,
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                }}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : "Save Analytics Settings"}
              </button>
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}