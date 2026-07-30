"use client";

import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type BrandingSettings = {
  id: number;
  brand_name: string | null;
  tagline: string | null;
  logo_url: string | null;
  mobile_logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  font_heading: string | null;
  font_body: string | null;
  store_phone: string | null;
  whatsapp_number: string | null;
  whatsapp_default_message: string | null;
  store_email: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  twitter_url: string | null;
  show_whatsapp_button: boolean | null;
  show_instagram_icon: boolean | null;
  show_facebook_icon: boolean | null;
  show_youtube_icon: boolean | null;
  show_twitter_icon: boolean | null;
  updated_at: string | null;
};

type BrandingForm = {
  brandName: string;
  tagline: string;
  logoUrl: string;
  mobileLogoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  fontHeading: string;
  fontBody: string;
  storePhone: string;
  whatsappNumber: string;
  whatsappDefaultMessage: string;
  storeEmail: string;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  twitterUrl: string;
  showWhatsappButton: boolean;
  showInstagramIcon: boolean;
  showFacebookIcon: boolean;
  showYoutubeIcon: boolean;
  showTwitterIcon: boolean;
};

const defaultForm: BrandingForm = {
  brandName: "NEW CITY STYLE",
  tagline: "Style for Every Family",
  logoUrl: "",
  mobileLogoUrl: "",
  faviconUrl: "",
  primaryColor: "#0A2E73",
  secondaryColor: "#D4AF37",
  fontHeading: "Playfair Display",
  fontBody: "Poppins",
  storePhone: "",
  whatsappNumber: "",
  whatsappDefaultMessage: "Hello NEW CITY STYLE, I need help with my order.",
  storeEmail: "",
  instagramUrl: "",
  facebookUrl: "",
  youtubeUrl: "",
  twitterUrl: "",
  showWhatsappButton: true,
  showInstagramIcon: true,
  showFacebookIcon: true,
  showYoutubeIcon: true,
  showTwitterIcon: true,
};

const headingFonts = [
  "Playfair Display",
  "Poppins",
  "Montserrat",
  "Inter",
  "Roboto",
  "Georgia",
  "Arial",
];

const bodyFonts = [
  "Poppins",
  "Inter",
  "Roboto",
  "Montserrat",
  "Arial",
  "Helvetica",
  "Verdana",
];

export default function BrandingPage() {
  const [settingsId, setSettingsId] = useState<number | null>(
    null
  );

  const [form, setForm] = useState<BrandingForm>(defaultForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingMobileLogo, setUploadingMobileLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] =
    useState(false);

  const [logoMessage, setLogoMessage] = useState("");
  const [mobileLogoMessage, setMobileLogoMessage] = useState("");
  const [faviconMessage, setFaviconMessage] = useState("");

  const [lastUpdated, setLastUpdated] = useState<
    string | null
  >(null);

  useEffect(() => {
    loadBrandingSettings();
  }, []);

  async function loadBrandingSettings() {
    setLoading(true);

    const { data, error } = await supabase
      .from("branding_settings")
      .select("*")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);

      alert(
        `Unable to load branding settings: ${error.message}`
      );

      setLoading(false);
      return;
    }

    if (!data) {
      const { data: created, error: insertError } =
        await supabase
          .from("branding_settings")
          .insert({
            brand_name: defaultForm.brandName,
            tagline: defaultForm.tagline,
            logo_url: null,
            mobile_logo_url: null,
            favicon_url: null,
            primary_color: defaultForm.primaryColor,
            secondary_color: defaultForm.secondaryColor,
            font_heading: defaultForm.fontHeading,
            font_body: defaultForm.fontBody,
            store_phone: null,
            whatsapp_number: null,
            whatsapp_default_message: defaultForm.whatsappDefaultMessage,
            store_email: null,
            instagram_url: null,
            facebook_url: null,
            youtube_url: null,
            twitter_url: null,
            show_whatsapp_button: true,
            show_instagram_icon: true,
            show_facebook_icon: true,
            show_youtube_icon: true,
            show_twitter_icon: true,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

      if (insertError) {
        console.error(insertError);

        alert(
          `Unable to create branding settings: ${insertError.message}`
        );

        setLoading(false);
        return;
      }

      applySettings(created as BrandingSettings);
      setLoading(false);
      return;
    }

    applySettings(data as BrandingSettings);
    setLoading(false);
  }

  function applySettings(settings: BrandingSettings) {
    setSettingsId(settings.id);

    setForm({
      brandName:
        settings.brand_name || defaultForm.brandName,

      tagline:
        settings.tagline || defaultForm.tagline,

      logoUrl: settings.logo_url || "",

      mobileLogoUrl: settings.mobile_logo_url || "",

      faviconUrl: settings.favicon_url || "",

      primaryColor:
        settings.primary_color || defaultForm.primaryColor,

      secondaryColor:
        settings.secondary_color ||
        defaultForm.secondaryColor,

      fontHeading:
        settings.font_heading || defaultForm.fontHeading,

      fontBody:
        settings.font_body || defaultForm.fontBody,

      storePhone: settings.store_phone || "",
      whatsappNumber: settings.whatsapp_number || "",
      whatsappDefaultMessage:
        settings.whatsapp_default_message || defaultForm.whatsappDefaultMessage,
      storeEmail: settings.store_email || "",
      instagramUrl: settings.instagram_url || "",
      facebookUrl: settings.facebook_url || "",
      youtubeUrl: settings.youtube_url || "",
      twitterUrl: settings.twitter_url || "",
      showWhatsappButton: settings.show_whatsapp_button ?? true,
      showInstagramIcon: settings.show_instagram_icon ?? true,
      showFacebookIcon: settings.show_facebook_icon ?? true,
      showYoutubeIcon: settings.show_youtube_icon ?? true,
      showTwitterIcon: settings.show_twitter_icon ?? true,
    });

    setLastUpdated(settings.updated_at || null);
  }

  function setField<K extends keyof BrandingForm>(
    field: K,
    value: BrandingForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function validateHexColor(value: string) {
    return /^#[0-9A-Fa-f]{6}$/.test(value.trim());
  }

  function validatePhone(value: string, required = false) {
    const phone = value.trim();
    if (!phone) return !required;
    return /^\+?[1-9]\d{7,14}$/.test(phone.replace(/[\s()-]/g, ""));
  }

  function validateEmail(value: string) {
    const email = value.trim();
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validateUrl(value: string, allowedHosts: string[]) {
    const input = value.trim();
    if (!input) return true;
    try {
      const parsed = new URL(input);
      if (!["http:", "https:"].includes(parsed.protocol)) return false;
      const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
      return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    } catch {
      return false;
    }
  }

  function validateForm() {
    if (!form.brandName.trim()) {
      alert("Please enter the brand name.");
      return false;
    }

    if (!form.tagline.trim()) {
      alert("Please enter the brand tagline.");
      return false;
    }

    if (!validateHexColor(form.primaryColor)) {
      alert(
        "Please enter a valid primary colour such as #0A2E73."
      );
      return false;
    }

    if (!validateHexColor(form.secondaryColor)) {
      alert(
        "Please enter a valid secondary colour such as #D4AF37."
      );
      return false;
    }

    if (!form.fontHeading.trim()) {
      alert("Please select a heading font.");
      return false;
    }

    if (!form.fontBody.trim()) {
      alert("Please select a body font.");
      return false;
    }

    if (!validatePhone(form.storePhone)) {
      alert("Please enter a valid store phone number.");
      return false;
    }

    if (!validatePhone(form.whatsappNumber, form.showWhatsappButton)) {
      alert("Please enter a valid WhatsApp number with country code, for example +919876543210.");
      return false;
    }

    if (!validateEmail(form.storeEmail)) {
      alert("Please enter a valid store email address.");
      return false;
    }

    if (!validateUrl(form.instagramUrl, ["instagram.com"])) {
      alert("Please enter a valid Instagram URL.");
      return false;
    }
    if (!validateUrl(form.facebookUrl, ["facebook.com", "fb.com"])) {
      alert("Please enter a valid Facebook URL.");
      return false;
    }
    if (!validateUrl(form.youtubeUrl, ["youtube.com", "youtu.be"])) {
      alert("Please enter a valid YouTube URL.");
      return false;
    }
    if (!validateUrl(form.twitterUrl, ["x.com", "twitter.com"])) {
      alert("Please enter a valid X / Twitter URL.");
      return false;
    }

    return true;
  }

  function validateImage(
    file: File,
    type: "logo" | "favicon"
  ) {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert(
        "Please select a JPG, PNG, WEBP or ICO image."
      );
      return false;
    }

    const maximumSize =
      type === "favicon"
        ? 2 * 1024 * 1024
        : 5 * 1024 * 1024;

    if (file.size > maximumSize) {
      alert(
        type === "favicon"
          ? "Favicon must be smaller than 2 MB."
          : "Logo must be smaller than 5 MB."
      );
      return false;
    }

    return true;
  }

  async function uploadBrandAsset(
    file: File,
    folder: string
  ) {
    const extension =
      file.name.split(".").pop()?.toLowerCase() || "png";

    const safeName = file.name
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const filePath = `branding/${folder}/${safeName}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("store-assets")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("store-assets")
      .getPublicUrl(filePath);

    if (!data.publicUrl) {
      throw new Error(
        "Unable to generate the uploaded image URL."
      );
    }

    return data.publicUrl;
  }

  async function uploadLogo(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!validateImage(file, "logo")) {
      event.target.value = "";
      return;
    }

    setUploadingLogo(true);
    setLogoMessage("");

    try {
      const publicUrl = await uploadBrandAsset(
        file,
        "logos"
      );

      setField("logoUrl", publicUrl);

      setLogoMessage(
        "Logo uploaded successfully. Click Save Branding Settings."
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to upload logo.";

      alert(`Logo upload failed: ${message}`);
    } finally {
      setUploadingLogo(false);
      event.target.value = "";
    }
  }

  async function uploadMobileLogo(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!validateImage(file, "logo")) {
      event.target.value = "";
      return;
    }
    setUploadingMobileLogo(true);
    setMobileLogoMessage("");
    try {
      const publicUrl = await uploadBrandAsset(file, "mobile-logos");
      setField("mobileLogoUrl", publicUrl);
      setMobileLogoMessage(
        "Mobile logo uploaded successfully. Click Save Branding Settings."
      );
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Unable to upload mobile logo.";
      alert(`Mobile logo upload failed: ${message}`);
    } finally {
      setUploadingMobileLogo(false);
      event.target.value = "";
    }
  }

  async function uploadFavicon(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!validateImage(file, "favicon")) {
      event.target.value = "";
      return;
    }

    setUploadingFavicon(true);
    setFaviconMessage("");

    try {
      const publicUrl = await uploadBrandAsset(
        file,
        "favicons"
      );

      setField("faviconUrl", publicUrl);

      setFaviconMessage(
        "Favicon uploaded successfully. Click Save Branding Settings."
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to upload favicon.";

      alert(`Favicon upload failed: ${message}`);
    } finally {
      setUploadingFavicon(false);
      event.target.value = "";
    }
  }

  function removeLogo() {
    const confirmed = window.confirm(
      "Remove the current logo from Branding Settings?"
    );

    if (!confirmed) return;

    setField("logoUrl", "");

    setLogoMessage(
      "Logo removed from the form. Click Save Branding Settings."
    );
  }

  function removeMobileLogo() {
    const confirmed = window.confirm(
      "Remove the current mobile logo from Branding Settings?"
    );
    if (!confirmed) return;
    setField("mobileLogoUrl", "");
    setMobileLogoMessage(
      "Mobile logo removed from the form. Click Save Branding Settings."
    );
  }

  function removeFavicon() {
    const confirmed = window.confirm(
      "Remove the current favicon from Branding Settings?"
    );

    if (!confirmed) return;

    setField("faviconUrl", "");

    setFaviconMessage(
      "Favicon removed from the form. Click Save Branding Settings."
    );
  }

  async function saveBrandingSettings(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!validateForm()) return;

    setSaving(true);
    setSaveStatus({
      type: "info",
      message: settingsId === null
        ? "Saving your branding settings..."
        : "Updating your branding settings...",
    });

    const brandingData = {
      brand_name: form.brandName.trim(),
      tagline: form.tagline.trim(),
      logo_url: form.logoUrl.trim() || null,
      mobile_logo_url: form.mobileLogoUrl.trim() || null,
      favicon_url: form.faviconUrl.trim() || null,
      primary_color: form.primaryColor.trim(),
      secondary_color: form.secondaryColor.trim(),
      font_heading: form.fontHeading.trim(),
      font_body: form.fontBody.trim(),
      store_phone: form.storePhone.trim() || null,
      whatsapp_number: form.whatsappNumber.replace(/[\s()-]/g, "").trim() || null,
      whatsapp_default_message: form.whatsappDefaultMessage.trim() || null,
      store_email: form.storeEmail.trim().toLowerCase() || null,
      instagram_url: form.instagramUrl.trim() || null,
      facebook_url: form.facebookUrl.trim() || null,
      youtube_url: form.youtubeUrl.trim() || null,
      twitter_url: form.twitterUrl.trim() || null,
      show_whatsapp_button: form.showWhatsappButton,
      show_instagram_icon: form.showInstagramIcon,
      show_facebook_icon: form.showFacebookIcon,
      show_youtube_icon: form.showYoutubeIcon,
      show_twitter_icon: form.showTwitterIcon,
      updated_at: new Date().toISOString(),
    };

    if (settingsId === null) {
      const { data, error } = await supabase
        .from("branding_settings")
        .insert(brandingData)
        .select()
        .single();

      if (error) {
        console.error(error);

        const errorMessage = `Unable to save branding settings: ${error.message}`;
        setSaveStatus({ type: "error", message: errorMessage });
        alert(errorMessage);

        setSaving(false);
        return;
      }

      applySettings(data as BrandingSettings);
    } else {
      const { data, error } = await supabase
        .from("branding_settings")
        .update(brandingData)
        .eq("id", settingsId)
        .select()
        .single();

      if (error) {
        console.error(error);

        const errorMessage = `Unable to update branding settings: ${error.message}`;
        setSaveStatus({ type: "error", message: errorMessage });
        alert(errorMessage);

        setSaving(false);
        return;
      }

      applySettings(data as BrandingSettings);
    }

    setLogoMessage("");
    setMobileLogoMessage("");
    setFaviconMessage("");

    setSaveStatus({
      type: "success",
      message: settingsId === null
        ? "Branding settings saved successfully."
        : "Branding settings updated successfully.",
    });

    setSaving(false);
  }

  function resetBranding() {
    const confirmed = window.confirm(
      "Reset branding to the recommended NEW CITY STYLE colours and fonts?"
    );

    if (!confirmed) return;

    setForm(defaultForm);
    setLogoMessage("");
    setMobileLogoMessage("");
    setFaviconMessage("");
    setSaveStatus({
      type: "info",
      message: "Recommended NEW CITY STYLE branding values restored in the form. Click Save Branding to apply them.",
    });
  }

  if (loading) {
    return (
      <main style={loadingPageStyle}>
        <div style={{ textAlign: "center" }}>
          <div className="branding-loading-spinner" />

          <h2
            style={{
              color: "#0A2E73",
              margin: 0,
            }}
          >
            Loading Branding Settings...
          </h2>
        </div>

        <style jsx global>{`
          .branding-loading-spinner {
            width: 58px;
            height: 58px;
            margin: 0 auto 18px;
            border-radius: 50%;
            border: 6px solid #e5e7eb;
            border-top-color: #0a2e73;
            animation: branding-spin 0.8s linear infinite;
          }

          @keyframes branding-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  const uploading = uploadingLogo || uploadingMobileLogo || uploadingFavicon;

  return (
    <main className="branding-page-root" style={mainStyle}>
      <div className="branding-page-shell" style={containerStyle}>
        <section
          className="branding-hero"
          style={{
            ...heroStyle,
            background: `linear-gradient(135deg, ${form.primaryColor} 0%, #164CA8 100%)`,
          }}
        >
          <p
            style={{
              ...heroLabelStyle,
              color: form.secondaryColor,
            }}
          >
            NEW CITY STYLE
          </p>

          <h1 style={heroTitleStyle}>
            Branding Management
          </h1>

          <p style={heroDescriptionStyle}>
            Manage the official logo, favicon, brand colours and
            typography used across NEW CITY STYLE.
          </p>

          {lastUpdated && (
            <p style={lastUpdatedStyle}>
              Last updated:{" "}
              {new Date(lastUpdated).toLocaleString(
                "en-IN"
              )}
            </p>
          )}
        </section>

        <section className="branding-summary-grid">
          <SummaryCard
            icon="🏷️"
            title="Brand Name"
            value={form.brandName}
          />

          <SummaryCard
            icon="🖼️"
            title="Official Logo"
            value={
              form.logoUrl ? "Uploaded" : "Not Uploaded"
            }
            positive={Boolean(form.logoUrl)}
          />

          <SummaryCard
            icon="📱"
            title="Mobile Logo"
            value={form.mobileLogoUrl ? "Uploaded" : "Not Uploaded"}
            positive={Boolean(form.mobileLogoUrl)}
          />

          <SummaryCard
            icon="🌐"
            title="Favicon"
            value={
              form.faviconUrl ? "Uploaded" : "Not Uploaded"
            }
            positive={Boolean(form.faviconUrl)}
          />

          <SummaryCard
            icon="🎨"
            title="Primary Colour"
            value={form.primaryColor}
          />

          <SummaryCard
            icon="✨"
            title="Secondary Colour"
            value={form.secondaryColor}
          />
        </section>

        <div className="branding-layout">
          <form
            id="branding-settings-form"
            onSubmit={saveBrandingSettings}
            style={{
              display: "grid",
              gap: "22px",
            }}
          >
            <section className="branding-top-save-bar">
              <div className="branding-top-save-copy">
                <strong>Branding Settings</strong>
                <span>Save your logo, colours, contact details and social links.</span>
              </div>

              <button
                type="submit"
                disabled={saving || uploading}
                className="branding-sticky-save-button"
                style={{
                  background: form.primaryColor,
                  opacity: saving || uploading ? 0.7 : 1,
                  cursor: saving || uploading ? "not-allowed" : "pointer",
                }}
              >
                <span aria-hidden="true">{saving ? "↻" : "✓"}</span>
                {saving
                  ? "Saving..."
                  : uploading
                    ? "Uploading..."
                    : settingsId === null
                      ? "Save Branding"
                      : "Update Branding"}
              </button>
            </section>

            {saveStatus && (
              <div
                role={saveStatus.type === "error" ? "alert" : "status"}
                className={`branding-save-message branding-save-message-${saveStatus.type}`}
              >
                <span aria-hidden="true">
                  {saveStatus.type === "success"
                    ? "✓"
                    : saveStatus.type === "error"
                      ? "!"
                      : "i"}
                </span>
                <span>{saveStatus.message}</span>
              </div>
            )}
            <Panel
              title="Brand Identity"
              subtitle="Configure the public brand name and tagline."
            >
              <Field label="Brand Name">
                <input
                  value={form.brandName}
                  placeholder="NEW CITY STYLE"
                  onChange={(event) =>
                    setField(
                      "brandName",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="Brand Tagline">
                <input
                  value={form.tagline}
                  placeholder="Style for Every Family"
                  onChange={(event) =>
                    setField(
                      "tagline",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                />
              </Field>
            </Panel>

            <Panel
              title="Official Logo"
              subtitle="Upload the main NEW CITY STYLE logo used on the website."
            >
              <label style={uploadAreaStyle}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={uploadLogo}
                  disabled={uploadingLogo}
                  style={{
                    display: "none",
                  }}
                />

                <div style={{ fontSize: "38px" }}>🖼️</div>

                <strong style={uploadTitleStyle}>
                  {uploadingLogo
                    ? "Uploading Logo..."
                    : "Click to Select Official Logo"}
                </strong>

                <span style={uploadSubtitleStyle}>
                  JPG, PNG or WEBP — Maximum 5 MB
                </span>
              </label>

              {logoMessage && (
                <div style={successMessageStyle}>
                  ✅ {logoMessage}
                </div>
              )}

              {form.logoUrl && (
                <UploadedAsset
                  title="Official logo uploaded"
                  imageUrl={form.logoUrl}
                  onRemove={removeLogo}
                  size="large"
                />
              )}

              <Field label="Logo URL">
                <input
                  value={form.logoUrl}
                  placeholder="Uploaded logo URL appears automatically"
                  onChange={(event) =>
                    setField(
                      "logoUrl",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                />
              </Field>
            </Panel>

            <Panel
              title="Mobile Logo"
              subtitle="Upload a compact logo for mobile navigation and small screens."
            >
              <label style={uploadAreaStyle}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={uploadMobileLogo}
                  disabled={uploadingMobileLogo}
                  style={{ display: "none" }}
                />
                <div style={{ fontSize: "38px" }}>📱</div>
                <strong style={uploadTitleStyle}>
                  {uploadingMobileLogo ? "Uploading Mobile Logo..." : "Click to Select Mobile Logo"}
                </strong>
                <span style={uploadSubtitleStyle}>JPG, PNG or WEBP — Maximum 5 MB</span>
              </label>

              {mobileLogoMessage && (
                <div style={successMessageStyle}>✅ {mobileLogoMessage}</div>
              )}

              {form.mobileLogoUrl && (
                <UploadedAsset
                  title="Mobile logo uploaded"
                  imageUrl={form.mobileLogoUrl}
                  onRemove={removeMobileLogo}
                  size="large"
                />
              )}

              <Field label="Mobile Logo URL">
                <input
                  value={form.mobileLogoUrl}
                  placeholder="Uploaded mobile logo URL appears automatically"
                  onChange={(event) => setField("mobileLogoUrl", event.target.value)}
                  style={inputStyle}
                />
              </Field>
            </Panel>

            <Panel
              title="Website Favicon"
              subtitle="Upload the small icon displayed in the browser tab."
            >
              <label style={uploadAreaStyle}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/x-icon,.ico"
                  onChange={uploadFavicon}
                  disabled={uploadingFavicon}
                  style={{
                    display: "none",
                  }}
                />

                <div style={{ fontSize: "38px" }}>🌐</div>

                <strong style={uploadTitleStyle}>
                  {uploadingFavicon
                    ? "Uploading Favicon..."
                    : "Click to Select Favicon"}
                </strong>

                <span style={uploadSubtitleStyle}>
                  Recommended 32×32 or 64×64 — Maximum 2 MB
                </span>
              </label>

              {faviconMessage && (
                <div style={successMessageStyle}>
                  ✅ {faviconMessage}
                </div>
              )}

              {form.faviconUrl && (
                <UploadedAsset
                  title="Favicon uploaded"
                  imageUrl={form.faviconUrl}
                  onRemove={removeFavicon}
                  size="small"
                />
              )}

              <Field label="Favicon URL">
                <input
                  value={form.faviconUrl}
                  placeholder="Uploaded favicon URL appears automatically"
                  onChange={(event) =>
                    setField(
                      "faviconUrl",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                />
              </Field>
            </Panel>

            <Panel
              title="Brand Colours"
              subtitle="Configure the official website colour palette."
            >
              <div className="two-column-fields">
                <Field label="Primary Colour">
                  <ColorInput
                    value={form.primaryColor}
                    onChange={(value) =>
                      setField("primaryColor", value)
                    }
                  />
                </Field>

                <Field label="Secondary Colour">
                  <ColorInput
                    value={form.secondaryColor}
                    onChange={(value) =>
                      setField("secondaryColor", value)
                    }
                  />
                </Field>
              </div>

              <div style={palettePreviewStyle}>
                <div
                  style={{
                    ...paletteBlockStyle,
                    background: form.primaryColor,
                  }}
                >
                  <span>Primary</span>
                  <strong>{form.primaryColor}</strong>
                </div>

                <div
                  style={{
                    ...paletteBlockStyle,
                    background: form.secondaryColor,
                  }}
                >
                  <span>Secondary</span>
                  <strong>{form.secondaryColor}</strong>
                </div>

                <div
                  style={{
                    ...paletteBlockStyle,
                    background: "#FFFFFF",
                    color: "#0A2E73",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <span>White</span>
                  <strong>#FFFFFF</strong>
                </div>

                <div
                  style={{
                    ...paletteBlockStyle,
                    background: "#F8F4EC",
                    color: "#0A2E73",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <span>Ivory</span>
                  <strong>#F8F4EC</strong>
                </div>
              </div>
            </Panel>

            <Panel
              title="Typography"
              subtitle="Choose fonts for headings and regular website text."
            >
              <div className="two-column-fields">
                <Field label="Heading Font">
                  <select
                    value={form.fontHeading}
                    onChange={(event) =>
                      setField(
                        "fontHeading",
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  >
                    {headingFonts.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Body Font">
                  <select
                    value={form.fontBody}
                    onChange={(event) =>
                      setField(
                        "fontBody",
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  >
                    {bodyFonts.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div style={fontPreviewBoxStyle}>
                <h2
                  style={{
                    color: form.primaryColor,
                    fontFamily: form.fontHeading,
                    margin: "0 0 10px",
                    fontSize: "30px",
                  }}
                >
                  Premium Fashion for Every Family
                </h2>

                <p
                  style={{
                    color: "#555",
                    fontFamily: form.fontBody,
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  Discover premium fashion, dependable quality and
                  modern style at NEW CITY STYLE.
                </p>
              </div>
            </Panel>

            <Panel
              title="Contact Details"
              subtitle="Manage the store contact details used across the website."
            >
              <div className="two-column-fields">
                <Field label="Store Phone Number">
                  <input value={form.storePhone} placeholder="+919876543210" onChange={(e) => setField("storePhone", e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Store Email Address">
                  <input type="email" value={form.storeEmail} placeholder="support@yourstore.com" onChange={(e) => setField("storeEmail", e.target.value)} style={inputStyle} />
                </Field>
                <Field label="WhatsApp Number with Country Code">
                  <input value={form.whatsappNumber} placeholder="+919876543210" onChange={(e) => setField("whatsappNumber", e.target.value)} style={inputStyle} />
                </Field>
                <Field label="WhatsApp Default Message">
                  <textarea value={form.whatsappDefaultMessage} maxLength={500} rows={4} onChange={(e) => setField("whatsappDefaultMessage", e.target.value)} style={{...inputStyle, resize: "vertical"}} />
                </Field>
              </div>
            </Panel>

            <Panel
              title="Social Media"
              subtitle="Add the official NEW CITY STYLE social profile URLs."
            >
              <div className="two-column-fields">
                <Field label="Instagram URL"><input value={form.instagramUrl} placeholder="https://instagram.com/yourprofile" onChange={(e) => setField("instagramUrl", e.target.value)} style={inputStyle} /></Field>
                <Field label="Facebook URL"><input value={form.facebookUrl} placeholder="https://facebook.com/yourpage" onChange={(e) => setField("facebookUrl", e.target.value)} style={inputStyle} /></Field>
                <Field label="YouTube URL"><input value={form.youtubeUrl} placeholder="https://youtube.com/@yourchannel" onChange={(e) => setField("youtubeUrl", e.target.value)} style={inputStyle} /></Field>
                <Field label="X / Twitter URL"><input value={form.twitterUrl} placeholder="https://x.com/yourprofile" onChange={(e) => setField("twitterUrl", e.target.value)} style={inputStyle} /></Field>
              </div>
            </Panel>

            <Panel
              title="Visibility Controls"
              subtitle="Show or hide WhatsApp and social icons on the public website."
            >
              <div style={{ display: "grid", gap: "12px" }}>
                <ToggleRow label="Show WhatsApp floating button" checked={form.showWhatsappButton} onChange={(v) => setField("showWhatsappButton", v)} />
                <ToggleRow label="Show Instagram icon" checked={form.showInstagramIcon} onChange={(v) => setField("showInstagramIcon", v)} />
                <ToggleRow label="Show Facebook icon" checked={form.showFacebookIcon} onChange={(v) => setField("showFacebookIcon", v)} />
                <ToggleRow label="Show YouTube icon" checked={form.showYoutubeIcon} onChange={(v) => setField("showYoutubeIcon", v)} />
                <ToggleRow label="Show X / Twitter icon" checked={form.showTwitterIcon} onChange={(v) => setField("showTwitterIcon", v)} />
              </div>
            </Panel>

            <section style={savePanelStyle}>
              <button
                className="branding-secondary-button"
                type="button"
                onClick={resetBranding}
                style={secondaryButtonStyle}
              >
                Reset Branding
              </button>

              <button
                className="branding-primary-button"
                type="submit"
                disabled={saving || uploading}
                style={{
                  ...primaryButtonStyle,
                  background: form.primaryColor,
                  opacity:
                    saving || uploading ? 0.7 : 1,
                  cursor:
                    saving || uploading
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {saving
                  ? "Saving..."
                  : uploading
                    ? "Uploading Images..."
                    : settingsId === null
                      ? "Save Branding"
                      : "Update Branding"}
              </button>
            </section>
          </form>

          <aside className="branding-preview-sidebar">
            <section className="branding-preview-panel" style={previewPanelStyle}>
              <div
                style={{
                  ...brandPreviewHeaderStyle,
                  background: `linear-gradient(135deg, ${form.primaryColor}, #164CA8)`,
                }}
              >
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt={form.brandName}
                    style={previewLogoStyle}
                  />
                ) : (
                  <div
                    style={{
                      ...fallbackLogoStyle,
                      color: form.primaryColor,
                    }}
                  >
                    NCS
                  </div>
                )}

                <p
                  style={{
                    color: form.secondaryColor,
                    margin: "0 0 7px",
                    fontWeight: 900,
                    letterSpacing: "1px",
                    fontFamily: form.fontBody,
                  }}
                >
                  PREMIUM FASHION STORE
                </p>

                <h2
                  style={{
                    color: "#FFFFFF",
                    margin: 0,
                    fontSize: "29px",
                    fontFamily: form.fontHeading,
                  }}
                >
                  {form.brandName || "Brand Name"}
                </h2>

                <p
                  style={{
                    color: "rgba(255,255,255,0.82)",
                    margin: "8px 0 0",
                    fontFamily: form.fontBody,
                  }}
                >
                  {form.tagline || "Brand tagline"}
                </p>
              </div>

              <div style={storefrontPreviewBodyStyle}>
                <p
                  style={{
                    color: form.secondaryColor,
                    fontWeight: 900,
                    letterSpacing: "1px",
                    fontFamily: form.fontBody,
                    margin: "0 0 7px",
                  }}
                >
                  NEW ARRIVALS
                </p>

                <h3
                  style={{
                    color: form.primaryColor,
                    fontFamily: form.fontHeading,
                    fontSize: "26px",
                    margin: "0 0 8px",
                  }}
                >
                  Style for Every Family
                </h3>

                <p
                  style={{
                    color: "#666",
                    fontFamily: form.fontBody,
                    lineHeight: 1.6,
                    margin: "0 0 17px",
                  }}
                >
                  Premium clothing collections for men, women and
                  children.
                </p>

                <button
                  type="button"
                  style={{
                    background: form.primaryColor,
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "9px",
                    padding: "11px 18px",
                    fontFamily: form.fontBody,
                    fontWeight: 800,
                  }}
                >
                  Shop Now
                </button>
              </div>
            </section>

            <section className="branding-preview-panel" style={previewPanelStyle}>
              <h3 style={sideTitleStyle}>
                Browser Preview
              </h3>

              <div style={browserPreviewStyle}>
                <div style={browserTopStyle}>
                  <div style={browserDotsStyle}>
                    <span style={browserDotStyle} />
                    <span style={browserDotStyle} />
                    <span style={browserDotStyle} />
                  </div>

                  <div style={browserAddressStyle}>
                    {form.faviconUrl ? (
                      <img
                        src={form.faviconUrl}
                        alt="Favicon"
                        style={{
                          width: "18px",
                          height: "18px",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <span>🌐</span>
                    )}

                    <span>newcitystyle.in</span>
                  </div>
                </div>

                <div
                  style={{
                    padding: "18px",
                    background: "#FFFFFF",
                  }}
                >
                  <strong
                    style={{
                      color: form.primaryColor,
                      fontFamily: form.fontHeading,
                    }}
                  >
                    {form.brandName}
                  </strong>

                  <p
                    style={{
                      color: "#777",
                      fontSize: "12px",
                      margin: "4px 0 0",
                      fontFamily: form.fontBody,
                    }}
                  >
                    {form.tagline}
                  </p>
                </div>
              </div>
            </section>

            <section className="branding-preview-panel" style={previewPanelStyle}>
              <h3 style={sideTitleStyle}>
                Branding Status
              </h3>

              <ConfigurationRow
                label="Brand Identity"
                configured={Boolean(
                  form.brandName.trim() &&
                    form.tagline.trim()
                )}
              />

              <ConfigurationRow
                label="Official Logo"
                configured={Boolean(form.logoUrl.trim())}
              />

              <ConfigurationRow
                label="Favicon"
                configured={Boolean(
                  form.faviconUrl.trim()
                )}
              />

              <ConfigurationRow
                label="Brand Colours"
                configured={Boolean(
                  validateHexColor(form.primaryColor) &&
                    validateHexColor(form.secondaryColor)
                )}
              />

              <ConfigurationRow
                label="Typography"
                configured={Boolean(
                  form.fontHeading.trim() &&
                    form.fontBody.trim()
                )}
              />
            </section>

            <section className="branding-preview-panel" style={previewPanelStyle}>
              <h3 style={sideTitleStyle}>
                Current Brand Palette
              </h3>

              <PaletteRow
                label="Primary"
                color={form.primaryColor}
              />

              <PaletteRow
                label="Secondary"
                color={form.secondaryColor}
              />

              <PaletteRow
                label="White"
                color="#FFFFFF"
              />

              <PaletteRow
                label="Ivory"
                color="#F8F4EC"
              />
            </section>
          </aside>
        </div>
      </div>

      <div className="branding-mobile-save-bar">
        <div className="branding-mobile-save-copy">
          <strong>{saving ? "Saving changes..." : "Branding changes"}</strong>
          <span>{saveStatus?.type === "success" ? "Saved successfully" : "Tap to save all settings"}</span>
        </div>

        <button
          type="submit"
          form="branding-settings-form"
          disabled={saving || uploading}
          className="branding-mobile-save-button"
          style={{
            background: form.primaryColor,
            opacity: saving || uploading ? 0.7 : 1,
            cursor: saving || uploading ? "not-allowed" : "pointer",
          }}
        >
          {saving
            ? "Saving..."
            : uploading
              ? "Uploading..."
              : settingsId === null
                ? "Save"
                : "Update"}
        </button>
      </div>

      <style jsx global>{`
        @keyframes branding-fade-up {
          from {
            opacity: 0;
            transform: translate3d(0, 24px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes branding-float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-7px);
          }
        }

        @keyframes branding-shimmer {
          0% {
            transform: translateX(-140%) skewX(-18deg);
          }
          55%, 100% {
            transform: translateX(240%) skewX(-18deg);
          }
        }

        @keyframes branding-pulse-ring {
          0% {
            box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.22);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(22, 163, 74, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
          }
        }

        .branding-page-shell {
          animation: branding-fade-up .65s ease both;
        }

        .branding-hero {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          animation: branding-fade-up .72s ease both;
        }

        .branding-hero::after {
          content: "";
          position: absolute;
          inset: -45% auto -45% -35%;
          width: 32%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,.18),
            transparent
          );
          transform: translateX(-140%) skewX(-18deg);
          animation: branding-shimmer 5.8s ease-in-out infinite;
          pointer-events: none;
          z-index: -1;
        }

        .branding-summary-grid > * {
          opacity: 0;
          animation: branding-fade-up .55s ease forwards;
        }

        .branding-summary-grid > *:nth-child(1) { animation-delay: .06s; }
        .branding-summary-grid > *:nth-child(2) { animation-delay: .12s; }
        .branding-summary-grid > *:nth-child(3) { animation-delay: .18s; }
        .branding-summary-grid > *:nth-child(4) { animation-delay: .24s; }
        .branding-summary-grid > *:nth-child(5) { animation-delay: .30s; }
        .branding-summary-grid > *:nth-child(6) { animation-delay: .36s; }

        .branding-summary-card,
        .branding-panel,
        .branding-preview-panel,
        .branding-uploaded-asset,
        .branding-toggle-row {
          transition:
            transform .28s ease,
            box-shadow .28s ease,
            border-color .28s ease,
            background-color .28s ease;
        }

        .branding-summary-card:hover {
          transform: translateY(-7px);
          box-shadow: 0 18px 38px rgba(10,46,115,.14) !important;
          border-color: rgba(212,175,55,.55) !important;
        }

        .branding-summary-card > div:first-child {
          display: inline-block;
          animation: branding-float 3.2s ease-in-out infinite;
        }

        .branding-panel,
        .branding-preview-panel {
          animation: branding-fade-up .6s ease both;
        }

        .branding-panel:hover,
        .branding-preview-panel:hover {
          transform: translateY(-3px);
          box-shadow: 0 18px 42px rgba(10,46,115,.11) !important;
          border-color: rgba(212,175,55,.48) !important;
        }

        .branding-uploaded-asset:hover {
          transform: translateX(4px);
          border-color: rgba(10,46,115,.35) !important;
          box-shadow: 0 10px 24px rgba(10,46,115,.08);
        }

        .branding-toggle-row:hover {
          transform: translateX(4px);
          border-color: rgba(10,46,115,.28) !important;
        }

        .branding-toggle-row.is-enabled input {
          animation: branding-pulse-ring 2.5s ease-out infinite;
        }

        .branding-top-save-bar,
        .branding-sticky-save-button,
        .branding-mobile-save-button,
        .branding-primary-button,
        .branding-secondary-button,
        .branding-remove-button {
          transition:
            transform .2s ease,
            box-shadow .2s ease,
            filter .2s ease;
        }

        .branding-sticky-save-button:hover:not(:disabled),
        .branding-mobile-save-button:hover:not(:disabled),
        .branding-primary-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(10,46,115,.28);
          filter: brightness(1.05);
        }

        .branding-secondary-button:hover,
        .branding-remove-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 9px 20px rgba(0,0,0,.09);
        }

        .branding-sticky-save-button:active:not(:disabled),
        .branding-mobile-save-button:active:not(:disabled),
        .branding-primary-button:active:not(:disabled),
        .branding-secondary-button:active,
        .branding-remove-button:active {
          transform: translateY(0) scale(.98);
        }

        input,
        textarea,
        select,
        button {
          transition:
            border-color .2s ease,
            box-shadow .2s ease,
            transform .2s ease,
            background-color .2s ease;
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: #0A2E73 !important;
          box-shadow: 0 0 0 4px rgba(10,46,115,.10);
        }

        label[style*="2px dashed"] {
          transition:
            transform .25s ease,
            box-shadow .25s ease,
            border-color .25s ease,
            background-color .25s ease;
        }

        label[style*="2px dashed"]:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 30px rgba(10,46,115,.10);
          border-color: #0A2E73 !important;
          background: #FFFFFF !important;
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }

        .branding-top-save-bar {
          position: sticky;
          top: 12px;
          z-index: 40;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 14px 16px;
          border: 1px solid rgba(212, 175, 55, 0.55);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 12px 32px rgba(10, 46, 115, 0.18);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .branding-top-save-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .branding-top-save-copy strong {
          color: #0a2e73;
          font-size: 16px;
        }

        .branding-top-save-copy span {
          color: #6b7280;
          font-size: 12px;
          line-height: 1.4;
        }

        .branding-sticky-save-button {
          flex: 0 0 auto;
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
          border-radius: 11px;
          padding: 11px 18px;
          color: #ffffff;
          font-size: 14px;
          font-weight: 900;
          box-shadow: 0 8px 20px rgba(10, 46, 115, 0.24);
        }

        .branding-save-message {
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 12px;
          padding: 13px 15px;
          font-size: 14px;
          font-weight: 800;
          line-height: 1.5;
        }

        .branding-save-message > span:first-child {
          width: 24px;
          height: 24px;
          flex: 0 0 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 900;
        }

        .branding-save-message-success {
          color: #166534;
          background: #f0fdf4;
          border: 1px solid #86efac;
        }

        .branding-save-message-success > span:first-child {
          color: #ffffff;
          background: #16a34a;
        }

        .branding-save-message-error {
          color: #991b1b;
          background: #fef2f2;
          border: 1px solid #fca5a5;
        }

        .branding-save-message-error > span:first-child {
          color: #ffffff;
          background: #dc2626;
        }

        .branding-save-message-info {
          color: #0a2e73;
          background: #eff6ff;
          border: 1px solid #93c5fd;
        }

        .branding-save-message-info > span:first-child {
          color: #ffffff;
          background: #0a2e73;
        }

        .branding-mobile-save-bar {
          display: none;
        }

        .branding-summary-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(210px, 1fr)
          );
          gap: 16px;
          margin-bottom: 25px;
        }

        .branding-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 430px;
          gap: 24px;
          align-items: start;
        }

        .branding-preview-sidebar {
          position: sticky;
          top: 95px;
          display: grid;
          gap: 20px;
        }

        .two-column-fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        @media (max-width: 1050px) {
          .branding-layout {
            grid-template-columns: 1fr;
          }

          .branding-preview-sidebar {
            position: static;
          }
        }

        @media (max-width: 620px) {
          .two-column-fields {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .branding-top-save-bar {
            top: 8px;
            padding: 11px 12px;
            border-radius: 14px;
          }

          .branding-top-save-copy span {
            display: none;
          }

          .branding-sticky-save-button {
            min-height: 42px;
            padding: 10px 13px;
            font-size: 13px;
          }

          .branding-mobile-save-bar {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 10px max(14px, env(safe-area-inset-left)) calc(10px + env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-right));
            background: rgba(255, 255, 255, 0.98);
            border-top: 1px solid rgba(212, 175, 55, 0.55);
            box-shadow: 0 -10px 28px rgba(10, 46, 115, 0.18);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
          }

          .branding-mobile-save-copy {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .branding-mobile-save-copy strong {
            color: #0a2e73;
            font-size: 13px;
          }

          .branding-mobile-save-copy span {
            color: #6b7280;
            font-size: 11px;
          }

          .branding-mobile-save-button {
            min-width: 105px;
            min-height: 44px;
            border: none;
            border-radius: 11px;
            padding: 10px 16px;
            color: #ffffff;
            font-size: 14px;
            font-weight: 900;
            box-shadow: 0 7px 18px rgba(10, 46, 115, 0.24);
          }
        }
      `}</style>
    </main>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`branding-toggle-row ${checked ? "is-enabled" : ""}`} style={toggleRowStyle}>
      <span style={{ color: "#0A2E73", fontWeight: 800 }}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ width: 22, height: 22, accentColor: "#0A2E73", cursor: "pointer" }}
      />
    </label>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="branding-panel" style={panelStyle}>
      <div style={{ marginBottom: "21px" }}>
        <h2 style={panelTitleStyle}>{title}</h2>

        <p style={panelSubtitleStyle}>{subtitle}</p>
      </div>

      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: "17px" }}>
      <label style={fieldLabelStyle}>{label}</label>

      {children}
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  value,
  positive = false,
}: {
  icon: string;
  title: string;
  value: string | number;
  positive?: boolean;
}) {
  return (
    <div className="branding-summary-card" style={summaryCardStyle}>
      <div style={{ fontSize: "29px" }}>{icon}</div>

      <p style={summaryTitleStyle}>{title}</p>

      <h2
        style={{
          ...summaryValueStyle,
          color: positive ? "#16A34A" : "#0A2E73",
        }}
      >
        {value}
      </h2>
    </div>
  );
}

function UploadedAsset({
  title,
  imageUrl,
  onRemove,
  size,
}: {
  title: string;
  imageUrl: string;
  onRemove: () => void;
  size: "large" | "small";
}) {
  return (
    <div className="branding-uploaded-asset" style={uploadedAssetStyle}>
      <img
        src={imageUrl}
        alt={title}
        style={{
          width: size === "large" ? "105px" : "70px",
          height: size === "large" ? "105px" : "70px",
          objectFit: "contain",
          borderRadius: "12px",
          border: "1px solid #E5E7EB",
          background: "#FFFFFF",
          padding: "7px",
          flexShrink: 0,
        }}
      />

      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <strong style={{ color: "#0A2E73" }}>
          {title}
        </strong>

        <p style={uploadedUrlStyle}>{imageUrl}</p>
      </div>

      <button
        className="branding-remove-button"
        type="button"
        onClick={onRemove}
        style={removeButtonStyle}
      >
        Remove
      </button>
    </div>
  );
}

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={colorInputRowStyle}>
      <input
        type="color"
        value={value}
        onChange={(event) =>
          onChange(event.target.value.toUpperCase())
        }
        style={colorPickerStyle}
      />

      <input
        value={value}
        maxLength={7}
        onChange={(event) =>
          onChange(event.target.value.toUpperCase())
        }
        placeholder="#0A2E73"
        style={inputStyle}
      />
    </div>
  );
}

function ConfigurationRow({
  label,
  configured,
}: {
  label: string;
  configured: boolean;
}) {
  return (
    <div style={configurationRowStyle}>
      <span
        style={{
          color: "#555",
          fontWeight: 700,
        }}
      >
        {label}
      </span>

      <span
        style={{
          background: configured ? "#DCFCE7" : "#FEE2E2",
          color: configured ? "#166534" : "#B91C1C",
          padding: "6px 9px",
          borderRadius: "999px",
          fontSize: "12px",
          fontWeight: 800,
        }}
      >
        {configured ? "Configured" : "Not Configured"}
      </span>
    </div>
  );
}

function PaletteRow({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <div style={paletteRowStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "8px",
            background: color,
            border: "1px solid #D1D5DB",
            display: "inline-block",
          }}
        />

        <strong style={{ color: "#555" }}>
          {label}
        </strong>
      </div>

      <span
        style={{
          color: "#0A2E73",
          fontWeight: 800,
        }}
      >
        {color}
      </span>
    </div>
  );
}

const toggleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "14px 16px",
  border: "1px solid #E5E7EB",
  borderRadius: "12px",
  background: "#F8F4EC",
};

const loadingPageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#F8F4EC",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "30px",
};

const mainStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#F8F4EC",
  padding: "30px 20px 125px",
};

const containerStyle: CSSProperties = {
  maxWidth: "1450px",
  margin: "0 auto",
};

const heroStyle: CSSProperties = {
  borderRadius: "24px",
  padding: "32px",
  color: "#FFFFFF",
  marginBottom: "25px",
  boxShadow: "0 15px 40px rgba(10,46,115,0.25)",
};

const heroLabelStyle: CSSProperties = {
  fontWeight: 800,
  letterSpacing: "1.4px",
  margin: "0 0 8px",
};

const heroTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "38px",
};

const heroDescriptionStyle: CSSProperties = {
  margin: "11px 0 0",
  opacity: 0.9,
  lineHeight: 1.6,
};

const lastUpdatedStyle: CSSProperties = {
  margin: "9px 0 0",
  color: "rgba(255,255,255,0.68)",
  fontSize: "13px",
};

const panelStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "18px",
  padding: "24px",
  boxShadow: "0 8px 25px rgba(0,0,0,0.07)",
  border: "1px solid rgba(212,175,55,0.22)",
};

const panelTitleStyle: CSSProperties = {
  color: "#0A2E73",
  margin: "0 0 5px",
  fontSize: "22px",
};

const panelSubtitleStyle: CSSProperties = {
  color: "#777",
  fontSize: "13px",
  margin: 0,
};

const fieldLabelStyle: CSSProperties = {
  display: "block",
  color: "#0A2E73",
  fontWeight: 700,
  marginBottom: "7px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  border: "1px solid #D1D5DB",
  borderRadius: "9px",
  background: "#FFFFFF",
  color: "#111827",
  fontSize: "15px",
  outline: "none",
};

const uploadAreaStyle: CSSProperties = {
  minHeight: "150px",
  border: "2px dashed #D4AF37",
  borderRadius: "14px",
  background: "#FFFDF5",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: "8px",
  padding: "20px",
  cursor: "pointer",
  textAlign: "center",
  marginBottom: "17px",
};

const uploadTitleStyle: CSSProperties = {
  color: "#0A2E73",
  fontSize: "17px",
};

const uploadSubtitleStyle: CSSProperties = {
  color: "#777",
  fontSize: "13px",
};

const successMessageStyle: CSSProperties = {
  background: "#F0FDF4",
  color: "#166534",
  border: "1px solid #BBF7D0",
  borderRadius: "10px",
  padding: "12px 14px",
  marginBottom: "17px",
  fontWeight: 700,
};

const uploadedAssetStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  border: "1px solid #D1D5DB",
  borderRadius: "13px",
  padding: "13px",
  marginBottom: "17px",
  background: "#F8FAFC",
};

const uploadedUrlStyle: CSSProperties = {
  color: "#777",
  fontSize: "11px",
  margin: "5px 0 0",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const removeButtonStyle: CSSProperties = {
  background: "#FFFFFF",
  color: "#DC2626",
  border: "1px solid #FCA5A5",
  borderRadius: "9px",
  padding: "9px 12px",
  cursor: "pointer",
  fontWeight: 700,
};

const palettePreviewStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "12px",
};

const paletteBlockStyle: CSSProperties = {
  minHeight: "100px",
  borderRadius: "12px",
  padding: "15px",
  color: "#FFFFFF",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  fontWeight: 800,
};

const fontPreviewBoxStyle: CSSProperties = {
  background: "#F8FAFC",
  border: "1px solid #E5E7EB",
  borderRadius: "13px",
  padding: "20px",
};

const colorInputRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "56px minmax(0, 1fr)",
  gap: "10px",
};

const colorPickerStyle: CSSProperties = {
  width: "56px",
  height: "45px",
  border: "1px solid #D1D5DB",
  borderRadius: "9px",
  padding: "3px",
  background: "#FFFFFF",
  cursor: "pointer",
};

const savePanelStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "18px",
  padding: "22px",
  boxShadow: "0 8px 25px rgba(0,0,0,0.07)",
  border: "1px solid rgba(212,175,55,0.22)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "13px",
  flexWrap: "wrap",
};

const primaryButtonStyle: CSSProperties = {
  color: "#FFFFFF",
  border: "none",
  padding: "14px 25px",
  borderRadius: "10px",
  fontSize: "16px",
  fontWeight: 800,
};

const secondaryButtonStyle: CSSProperties = {
  background: "#FFFFFF",
  color: "#6B7280",
  border: "1px solid #D1D5DB",
  padding: "13px 20px",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: 800,
};

const summaryCardStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "16px",
  padding: "20px",
  boxShadow: "0 7px 22px rgba(0,0,0,0.07)",
  border: "1px solid rgba(212,175,55,0.22)",
};

const summaryTitleStyle: CSSProperties = {
  color: "#666",
  margin: "9px 0 5px",
};

const summaryValueStyle: CSSProperties = {
  margin: 0,
  fontSize: "21px",
  overflowWrap: "anywhere",
};

const previewPanelStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "19px",
  padding: "21px",
  boxShadow: "0 8px 25px rgba(0,0,0,0.07)",
  border: "1px solid rgba(212,175,55,0.22)",
};

const brandPreviewHeaderStyle: CSSProperties = {
  borderRadius: "15px",
  padding: "25px",
  textAlign: "center",
  color: "#FFFFFF",
};

const previewLogoStyle: CSSProperties = {
  width: "110px",
  height: "110px",
  objectFit: "contain",
  borderRadius: "18px",
  background: "#FFFFFF",
  padding: "9px",
  marginBottom: "15px",
};

const fallbackLogoStyle: CSSProperties = {
  width: "110px",
  height: "110px",
  borderRadius: "18px",
  background: "#FFFFFF",
  margin: "0 auto 15px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: "31px",
  fontWeight: 900,
};

const storefrontPreviewBodyStyle: CSSProperties = {
  padding: "23px 5px 5px",
};

const sideTitleStyle: CSSProperties = {
  color: "#0A2E73",
  margin: "0 0 15px",
};

const browserPreviewStyle: CSSProperties = {
  border: "1px solid #D1D5DB",
  borderRadius: "12px",
  overflow: "hidden",
  background: "#F3F4F6",
};

const browserTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "10px",
  background: "#E5E7EB",
};

const browserDotsStyle: CSSProperties = {
  display: "flex",
  gap: "4px",
};

const browserDotStyle: CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: "#9CA3AF",
};

const browserAddressStyle: CSSProperties = {
  flex: 1,
  background: "#FFFFFF",
  borderRadius: "7px",
  padding: "6px 10px",
  display: "flex",
  alignItems: "center",
  gap: "7px",
  color: "#666",
  fontSize: "12px",
};

const configurationRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "12px 0",
  borderBottom: "1px solid #E5E7EB",
};

const paletteRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "10px 0",
  borderBottom: "1px solid #E5E7EB",
};