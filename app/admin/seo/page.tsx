"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SeoSettings = {
  id: number;
  site_title: string;
  site_description: string;
  keywords: string;
  canonical_url: string;
  social_title: string;
  social_description: string;
  social_image_url: string;
  google_verification_code: string;
  robots_index: boolean;
  robots_follow: boolean;
  sitemap_enabled: boolean;
  updated_at?: string;
};

const defaultSeoSettings: SeoSettings = {
  id: 1,
  site_title: "NEW CITY STYLE | Style for Every Family",
  site_description:
    "Shop premium fashion for men, women and kids at NEW CITY STYLE. Discover quality clothing, stylish collections and trusted service for every family.",
  keywords:
    "NEW CITY STYLE, family fashion, men's clothing, women's clothing, kids clothing, sarees, shirts, jeans, fashion store",
  canonical_url: "",
  social_title: "NEW CITY STYLE | Style for Every Family",
  social_description:
    "Discover premium fashion collections for men, women and kids at NEW CITY STYLE.",
  social_image_url: "",
  google_verification_code: "",
  robots_index: true,
  robots_follow: true,
  sitemap_enabled: true,
};

export default function AdminSeoPage() {
  const router = useRouter();

  const [settings, setSettings] =
    useState<SeoSettings>(defaultSeoSettings);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadSeoSettings();
  }, []);

  async function loadSeoSettings() {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("seo_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        setSettings({
          id: data.id ?? 1,
          site_title:
            data.site_title ??
            defaultSeoSettings.site_title,
          site_description:
            data.site_description ??
            defaultSeoSettings.site_description,
          keywords:
            data.keywords ??
            defaultSeoSettings.keywords,
          canonical_url:
            data.canonical_url ?? "",
          social_title:
            data.social_title ??
            defaultSeoSettings.social_title,
          social_description:
            data.social_description ??
            defaultSeoSettings.social_description,
          social_image_url:
            data.social_image_url ?? "",
          google_verification_code:
            data.google_verification_code ?? "",
          robots_index:
            data.robots_index ?? true,
          robots_follow:
            data.robots_follow ?? true,
          sitemap_enabled:
            data.sitemap_enabled ?? true,
          updated_at: data.updated_at,
        });
      }
    } catch (error) {
      console.error("SEO settings load error:", error);

      setErrorMessage(
        "SEO settings could not be loaded. Check whether the seo_settings table exists in Supabase."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleTextChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement
    >
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
      const payload: SeoSettings = {
        id: 1,
        site_title: settings.site_title.trim(),
        site_description:
          settings.site_description.trim(),
        keywords: settings.keywords.trim(),
        canonical_url:
          settings.canonical_url.trim(),
        social_title:
          settings.social_title.trim(),
        social_description:
          settings.social_description.trim(),
        social_image_url:
          settings.social_image_url.trim(),
        google_verification_code:
          settings.google_verification_code.trim(),
        robots_index: settings.robots_index,
        robots_follow: settings.robots_follow,
        sitemap_enabled: settings.sitemap_enabled,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("seo_settings")
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
          site_title:
            data.site_title ?? payload.site_title,
          site_description:
            data.site_description ??
            payload.site_description,
          keywords:
            data.keywords ?? payload.keywords,
          canonical_url:
            data.canonical_url ??
            payload.canonical_url,
          social_title:
            data.social_title ??
            payload.social_title,
          social_description:
            data.social_description ??
            payload.social_description,
          social_image_url:
            data.social_image_url ??
            payload.social_image_url,
          google_verification_code:
            data.google_verification_code ??
            payload.google_verification_code,
          robots_index:
            data.robots_index ??
            payload.robots_index,
          robots_follow:
            data.robots_follow ??
            payload.robots_follow,
          sitemap_enabled:
            data.sitemap_enabled ??
            payload.sitemap_enabled,
          updated_at:
            data.updated_at ??
            payload.updated_at,
        });
      }

      setSuccessMessage(
        "SEO settings saved successfully."
      );
    } catch (error) {
      console.error("SEO settings save error:", error);

      setErrorMessage(
        "SEO settings could not be saved. Check the Supabase table and policies."
      );
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    const confirmed = window.confirm(
      "Reset all SEO fields to the default NEW CITY STYLE values?"
    );

    if (!confirmed) {
      return;
    }

    setSettings(defaultSeoSettings);
    setSuccessMessage(
      "Default values restored. Click Save SEO Settings to store them."
    );
    setErrorMessage("");
  }

  const titleLength = settings.site_title.length;
  const descriptionLength =
    settings.site_description.length;

  const titleStatus = useMemo(() => {
    if (titleLength === 0) {
      return "Title is required";
    }

    if (titleLength < 30) {
      return "Title is a little short";
    }

    if (titleLength > 60) {
      return "Title is too long";
    }

    return "Good title length";
  }, [titleLength]);

  const descriptionStatus = useMemo(() => {
    if (descriptionLength === 0) {
      return "Description is required";
    }

    if (descriptionLength < 120) {
      return "Description is a little short";
    }

    if (descriptionLength > 160) {
      return "Description is too long";
    }

    return "Good description length";
  }, [descriptionLength]);

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

    textarea: {
      width: "100%",
      boxSizing: "border-box" as const,
      padding: "13px 14px",
      border: "1px solid #d8dee9",
      borderRadius: "10px",
      outline: "none",
      fontSize: "15px",
      color: "#1d2939",
      background: "#ffffff",
      resize: "vertical" as const,
      minHeight: "115px",
      lineHeight: 1.6,
    },

    helper: {
      display: "flex",
      justifyContent: "space-between",
      gap: "12px",
      marginTop: "7px",
      color: "#7a8497",
      fontSize: "12px",
      lineHeight: 1.4,
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
      background: "#0A2E73",
      color: "#ffffff",
      fontSize: "15px",
      fontWeight: 800,
      cursor: "pointer",
    },

    goldButton: {
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

    preview: {
      border: "1px solid #e7eaf0",
      borderRadius: "14px",
      padding: "20px",
      background: "#ffffff",
    },

    previewUrl: {
      margin: "0 0 7px",
      color: "#138a4b",
      fontSize: "14px",
      wordBreak: "break-all" as const,
    },

    previewTitle: {
      margin: "0 0 8px",
      color: "#1a0dab",
      fontSize: "21px",
      fontWeight: 500,
      lineHeight: 1.3,
    },

    previewDescription: {
      margin: 0,
      color: "#4d5156",
      fontSize: "14px",
      lineHeight: 1.6,
    },
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.title}>SEO Settings</h1>

            <p style={styles.subtitle}>
              Loading SEO settings...
            </p>
          </div>
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
              SEO Settings
            </h1>

            <p style={styles.subtitle}>
              Manage website search engine details,
              social sharing information and indexing
              preferences.
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
              General SEO
            </h2>

            <p style={styles.sectionText}>
              These details will be used as the default
              search engine information for the website.
            </p>

            <div style={styles.grid}>
              <div style={styles.fullWidth}>
                <label
                  htmlFor="site_title"
                  style={styles.label}
                >
                  Site Title
                </label>

                <input
                  id="site_title"
                  name="site_title"
                  type="text"
                  value={settings.site_title}
                  onChange={handleTextChange}
                  style={styles.input}
                  maxLength={100}
                  required
                  placeholder="NEW CITY STYLE | Style for Every Family"
                />

                <div style={styles.helper}>
                  <span>{titleStatus}</span>
                  <span>{titleLength}/60 recommended</span>
                </div>
              </div>

              <div style={styles.fullWidth}>
                <label
                  htmlFor="site_description"
                  style={styles.label}
                >
                  Meta Description
                </label>

                <textarea
                  id="site_description"
                  name="site_description"
                  value={settings.site_description}
                  onChange={handleTextChange}
                  style={styles.textarea}
                  maxLength={300}
                  required
                  placeholder="Describe the NEW CITY STYLE website."
                />

                <div style={styles.helper}>
                  <span>{descriptionStatus}</span>
                  <span>
                    {descriptionLength}/160 recommended
                  </span>
                </div>
              </div>

              <div style={styles.fullWidth}>
                <label
                  htmlFor="keywords"
                  style={styles.label}
                >
                  SEO Keywords
                </label>

                <textarea
                  id="keywords"
                  name="keywords"
                  value={settings.keywords}
                  onChange={handleTextChange}
                  style={{
                    ...styles.textarea,
                    minHeight: "95px",
                  }}
                  placeholder="fashion store, sarees, shirts, jeans"
                />

                <div style={styles.helper}>
                  <span>
                    Separate each keyword with a comma.
                  </span>
                </div>
              </div>

              <div style={styles.fullWidth}>
                <label
                  htmlFor="canonical_url"
                  style={styles.label}
                >
                  Canonical Website URL
                </label>

                <input
                  id="canonical_url"
                  name="canonical_url"
                  type="url"
                  value={settings.canonical_url}
                  onChange={handleTextChange}
                  style={styles.input}
                  placeholder="https://yourwebsite.com"
                />

                <div style={styles.helper}>
                  <span>
                    Leave blank until the final domain is
                    connected.
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>
              Social Sharing
            </h2>

            <p style={styles.sectionText}>
              These details appear when the website is
              shared on WhatsApp, Facebook and other
              platforms.
            </p>

            <div style={styles.grid}>
              <div style={styles.fullWidth}>
                <label
                  htmlFor="social_title"
                  style={styles.label}
                >
                  Social Preview Title
                </label>

                <input
                  id="social_title"
                  name="social_title"
                  type="text"
                  value={settings.social_title}
                  onChange={handleTextChange}
                  style={styles.input}
                  maxLength={100}
                  placeholder="NEW CITY STYLE"
                />
              </div>

              <div style={styles.fullWidth}>
                <label
                  htmlFor="social_description"
                  style={styles.label}
                >
                  Social Preview Description
                </label>

                <textarea
                  id="social_description"
                  name="social_description"
                  value={settings.social_description}
                  onChange={handleTextChange}
                  style={styles.textarea}
                  maxLength={250}
                  placeholder="Description shown when the website is shared."
                />
              </div>

              <div style={styles.fullWidth}>
                <label
                  htmlFor="social_image_url"
                  style={styles.label}
                >
                  Social Preview Image URL
                </label>

                <input
                  id="social_image_url"
                  name="social_image_url"
                  type="url"
                  value={settings.social_image_url}
                  onChange={handleTextChange}
                  style={styles.input}
                  placeholder="https://yourwebsite.com/social-preview.jpg"
                />

                <div style={styles.helper}>
                  <span>
                    This field can remain blank until a
                    dedicated social preview image is ready.
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>
              Search Engine Verification
            </h2>

            <p style={styles.sectionText}>
              Add the Google Search Console verification
              value when it becomes available.
            </p>

            <div>
              <label
                htmlFor="google_verification_code"
                style={styles.label}
              >
                Google Verification Code
              </label>

              <input
                id="google_verification_code"
                name="google_verification_code"
                type="text"
                value={settings.google_verification_code}
                onChange={handleTextChange}
                style={styles.input}
                placeholder="Example: abc123verificationcode"
              />

              <div style={styles.helper}>
                <span>
                  Paste only the verification content value,
                  not the complete HTML tag.
                </span>
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>
              Indexing Controls
            </h2>

            <p style={styles.sectionText}>
              Control how search engines discover and
              follow the website.
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
                    Allow Search Engine Indexing
                  </p>

                  <p style={styles.toggleDescription}>
                    Allows search engines to include the
                    website in search results.
                  </p>
                </div>

                <input
                  type="checkbox"
                  name="robots_index"
                  checked={settings.robots_index}
                  onChange={handleBooleanChange}
                  style={styles.checkbox}
                />
              </div>

              <div style={styles.toggleRow}>
                <div>
                  <p style={styles.toggleLabel}>
                    Allow Search Engines to Follow Links
                  </p>

                  <p style={styles.toggleDescription}>
                    Allows crawlers to follow product and
                    category links.
                  </p>
                </div>

                <input
                  type="checkbox"
                  name="robots_follow"
                  checked={settings.robots_follow}
                  onChange={handleBooleanChange}
                  style={styles.checkbox}
                />
              </div>

              <div style={styles.toggleRow}>
                <div>
                  <p style={styles.toggleLabel}>
                    Enable Sitemap
                  </p>

                  <p style={styles.toggleDescription}>
                    Keeps the sitemap feature enabled for
                    website pages and products.
                  </p>
                </div>

                <input
                  type="checkbox"
                  name="sitemap_enabled"
                  checked={settings.sitemap_enabled}
                  onChange={handleBooleanChange}
                  style={styles.checkbox}
                />
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>
              Google Search Preview
            </h2>

            <p style={styles.sectionText}>
              This is an approximate preview of how the
              homepage may appear in Google search.
            </p>

            <div style={styles.preview}>
              <p style={styles.previewUrl}>
                {settings.canonical_url ||
                  "https://yourwebsite.com"}
              </p>

              <h3 style={styles.previewTitle}>
                {settings.site_title ||
                  "NEW CITY STYLE"}
              </h3>

              <p style={styles.previewDescription}>
                {settings.site_description ||
                  "Website description will appear here."}
              </p>
            </div>

            <div style={styles.buttonRow}>
              <button
                type="button"
                onClick={resetToDefaults}
                style={styles.secondaryButton}
                disabled={saving}
              >
                Reset Defaults
              </button>

              <button
                type="submit"
                style={{
                  ...styles.goldButton,
                  opacity: saving ? 0.65 : 1,
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                }}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : "Save SEO Settings"}
              </button>
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}