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
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  font_heading: string | null;
  font_body: string | null;
  updated_at: string | null;
};

type BrandingForm = {
  brandName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  fontHeading: string;
  fontBody: string;
};

const defaultForm: BrandingForm = {
  brandName: "NEW CITY STYLE",
  tagline: "Style for Every Family",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#0A2E73",
  secondaryColor: "#D4AF37",
  fontHeading: "Playfair Display",
  fontBody: "Poppins",
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

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] =
    useState(false);

  const [logoMessage, setLogoMessage] = useState("");
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
            favicon_url: null,
            primary_color: defaultForm.primaryColor,
            secondary_color: defaultForm.secondaryColor,
            font_heading: defaultForm.fontHeading,
            font_body: defaultForm.fontBody,
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

    const brandingData = {
      brand_name: form.brandName.trim(),
      tagline: form.tagline.trim(),
      logo_url: form.logoUrl.trim() || null,
      favicon_url: form.faviconUrl.trim() || null,
      primary_color: form.primaryColor.trim(),
      secondary_color: form.secondaryColor.trim(),
      font_heading: form.fontHeading.trim(),
      font_body: form.fontBody.trim(),
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

        alert(
          `Unable to save branding settings: ${error.message}`
        );

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

        alert(
          `Unable to update branding settings: ${error.message}`
        );

        setSaving(false);
        return;
      }

      applySettings(data as BrandingSettings);
    }

    setLogoMessage("");
    setFaviconMessage("");

    alert("Branding settings saved successfully.");

    setSaving(false);
  }

  function resetBranding() {
    const confirmed = window.confirm(
      "Reset branding to the recommended NEW CITY STYLE colours and fonts?"
    );

    if (!confirmed) return;

    setForm(defaultForm);
    setLogoMessage("");
    setFaviconMessage("");
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

  const uploading = uploadingLogo || uploadingFavicon;

  return (
    <main style={mainStyle}>
      <div style={containerStyle}>
        <section
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
            onSubmit={saveBrandingSettings}
            style={{
              display: "grid",
              gap: "22px",
            }}
          >
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

            <section style={savePanelStyle}>
              <button
                type="button"
                onClick={resetBranding}
                style={secondaryButtonStyle}
              >
                Reset Branding
              </button>

              <button
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
                  ? "Saving Branding..."
                  : uploading
                    ? "Uploading Images..."
                    : "Save Branding Settings"}
              </button>
            </section>
          </form>

          <aside className="branding-preview-sidebar">
            <section style={previewPanelStyle}>
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

            <section style={previewPanelStyle}>
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

            <section style={previewPanelStyle}>
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

            <section style={previewPanelStyle}>
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

      <style jsx global>{`
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
        }
      `}</style>
    </main>
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
    <section style={panelStyle}>
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
    <div style={summaryCardStyle}>
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
    <div style={uploadedAssetStyle}>
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
  padding: "30px 20px 80px",
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