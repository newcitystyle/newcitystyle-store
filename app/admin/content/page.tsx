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

type SiteContent = {
  id: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_button_text: string | null;
  hero_button_link: string | null;
  hero_image_url: string | null;
  about_title: string | null;
  about_description: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_address: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  whatsapp_url: string | null;
  footer_text: string | null;
  updated_at: string | null;
};

type ContentForm = {
  heroTitle: string;
  heroSubtitle: string;
  heroButtonText: string;
  heroButtonLink: string;
  heroImageUrl: string;
  aboutTitle: string;
  aboutDescription: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  whatsappUrl: string;
  footerText: string;
};

const defaultForm: ContentForm = {
  heroTitle: "Style for Every Family",
  heroSubtitle:
    "Discover premium fashion for men, women and children at NEW CITY STYLE.",
  heroButtonText: "Shop Now",
  heroButtonLink: "/products",
  heroImageUrl: "",
  aboutTitle: "Welcome to NEW CITY STYLE",
  aboutDescription:
    "NEW CITY STYLE is your trusted family fashion destination offering premium ready-made clothing, latest trends and dependable quality at affordable prices.",
  contactPhone: "+91 9010014001",
  contactEmail: "customercare@newcitystyle.in",
  contactAddress:
    "Sarubujjili, Srikakulam District, Andhra Pradesh",
  facebookUrl: "",
  instagramUrl: "",
  youtubeUrl: "",
  whatsappUrl: "https://wa.me/919010014001",
  footerText:
    "© NEW CITY STYLE. All rights reserved.",
};

export default function SiteContentPage() {
  const [contentId, setContentId] = useState<string | null>(
    null
  );

  const [form, setForm] =
    useState<ContentForm>(defaultForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [uploadingHero, setUploadingHero] =
    useState(false);

  const [uploadMessage, setUploadMessage] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState<string | null>(null);

  useEffect(() => {
    loadSiteContent();
  }, []);

  async function loadSiteContent() {
    setLoading(true);

    const { data, error } = await supabase
      .from("site_content")
      .select("*")
      .order("updated_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);

      alert(
        `Unable to load site content: ${error.message}`
      );

      setLoading(false);
      return;
    }

    if (!data) {
      const { data: created, error: insertError } =
        await supabase
          .from("site_content")
          .insert({
            hero_title: defaultForm.heroTitle,
            hero_subtitle:
              defaultForm.heroSubtitle,
            hero_button_text:
              defaultForm.heroButtonText,
            hero_button_link:
              defaultForm.heroButtonLink,
            hero_image_url: null,
            about_title:
              defaultForm.aboutTitle,
            about_description:
              defaultForm.aboutDescription,
            contact_phone:
              defaultForm.contactPhone,
            contact_email:
              defaultForm.contactEmail,
            contact_address:
              defaultForm.contactAddress,
            facebook_url: null,
            instagram_url: null,
            youtube_url: null,
            whatsapp_url:
              defaultForm.whatsappUrl,
            footer_text:
              defaultForm.footerText,
            updated_at:
              new Date().toISOString(),
          })
          .select()
          .single();

      if (insertError) {
        console.error(insertError);

        alert(
          `Unable to create site content: ${insertError.message}`
        );

        setLoading(false);
        return;
      }

      applyContent(created as SiteContent);
      setLoading(false);
      return;
    }

    applyContent(data as SiteContent);
    setLoading(false);
  }

  function applyContent(content: SiteContent) {
    setContentId(content.id);

    setForm({
      heroTitle:
        content.hero_title ||
        defaultForm.heroTitle,

      heroSubtitle:
        content.hero_subtitle ||
        defaultForm.heroSubtitle,

      heroButtonText:
        content.hero_button_text ||
        defaultForm.heroButtonText,

      heroButtonLink:
        content.hero_button_link ||
        defaultForm.heroButtonLink,

      heroImageUrl:
        content.hero_image_url || "",

      aboutTitle:
        content.about_title ||
        defaultForm.aboutTitle,

      aboutDescription:
        content.about_description ||
        defaultForm.aboutDescription,

      contactPhone:
        content.contact_phone ||
        defaultForm.contactPhone,

      contactEmail:
        content.contact_email ||
        defaultForm.contactEmail,

      contactAddress:
        content.contact_address ||
        defaultForm.contactAddress,

      facebookUrl:
        content.facebook_url || "",

      instagramUrl:
        content.instagram_url || "",

      youtubeUrl:
        content.youtube_url || "",

      whatsappUrl:
        content.whatsapp_url ||
        defaultForm.whatsappUrl,

      footerText:
        content.footer_text ||
        defaultForm.footerText,
    });

    setLastUpdated(content.updated_at || null);
  }

  function setField<K extends keyof ContentForm>(
    field: K,
    value: ContentForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function validateUrl(
    value: string,
    allowRelative = false
  ) {
    const clean = value.trim();

    if (!clean) return true;

    if (allowRelative && clean.startsWith("/")) {
      return true;
    }

    return /^https?:\/\/.+/i.test(clean);
  }

  function validateForm() {
    if (!form.heroTitle.trim()) {
      alert("Please enter the hero title.");
      return false;
    }

    if (!form.heroSubtitle.trim()) {
      alert("Please enter the hero subtitle.");
      return false;
    }

    if (!form.heroButtonText.trim()) {
      alert("Please enter the hero button text.");
      return false;
    }

    if (
      !validateUrl(
        form.heroButtonLink,
        true
      )
    ) {
      alert(
        "Hero button link must start with /, http:// or https://"
      );

      return false;
    }

    if (
      form.contactEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.contactEmail.trim()
      )
    ) {
      alert(
        "Please enter a valid contact email address."
      );

      return false;
    }

    const urlFields = [
      ["Hero image URL", form.heroImageUrl],
      ["Facebook URL", form.facebookUrl],
      ["Instagram URL", form.instagramUrl],
      ["YouTube URL", form.youtubeUrl],
      ["WhatsApp URL", form.whatsappUrl],
    ];

    for (const [label, value] of urlFields) {
      if (!validateUrl(value)) {
        alert(
          `${label} must start with http:// or https://`
        );

        return false;
      }
    }

    return true;
  }

  function validateImage(file: File) {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert(
        "Please select a JPG, PNG or WEBP image."
      );

      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert(
        "Hero image must be smaller than 10 MB."
      );

      return false;
    }

    return true;
  }

  async function uploadHeroImage(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!validateImage(file)) {
      event.target.value = "";
      return;
    }

    setUploadingHero(true);
    setUploadMessage("");

    try {
      const extension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase() || "jpg";

      const safeName = file.name
        .replace(/\.[^/.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const filePath = `site-content/hero/${safeName}-${Date.now()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
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
          "Unable to generate hero image URL."
        );
      }

      setField(
        "heroImageUrl",
        data.publicUrl
      );

      setUploadMessage(
        "Hero image uploaded successfully. Click Save Site Content."
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to upload hero image.";

      alert(
        `Hero image upload failed: ${message}`
      );
    } finally {
      setUploadingHero(false);
      event.target.value = "";
    }
  }

  function removeHeroImage() {
    const confirmed = window.confirm(
      "Remove the current hero image?"
    );

    if (!confirmed) return;

    setField("heroImageUrl", "");

    setUploadMessage(
      "Hero image removed from the form. Click Save Site Content."
    );
  }

  async function saveSiteContent(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!validateForm()) return;

    setSaving(true);

    const contentData = {
      hero_title:
        form.heroTitle.trim(),

      hero_subtitle:
        form.heroSubtitle.trim() || null,

      hero_button_text:
        form.heroButtonText.trim() || null,

      hero_button_link:
        form.heroButtonLink.trim() || null,

      hero_image_url:
        form.heroImageUrl.trim() || null,

      about_title:
        form.aboutTitle.trim() || null,

      about_description:
        form.aboutDescription.trim() ||
        null,

      contact_phone:
        form.contactPhone.trim() || null,

      contact_email:
        form.contactEmail
          .trim()
          .toLowerCase() || null,

      contact_address:
        form.contactAddress.trim() || null,

      facebook_url:
        form.facebookUrl.trim() || null,

      instagram_url:
        form.instagramUrl.trim() || null,

      youtube_url:
        form.youtubeUrl.trim() || null,

      whatsapp_url:
        form.whatsappUrl.trim() || null,

      footer_text:
        form.footerText.trim() || null,

      updated_at:
        new Date().toISOString(),
    };

    if (contentId === null) {
      const { data, error } =
        await supabase
          .from("site_content")
          .insert(contentData)
          .select()
          .single();

      if (error) {
        console.error(error);

        alert(
          `Unable to save site content: ${error.message}`
        );

        setSaving(false);
        return;
      }

      applyContent(data as SiteContent);
    } else {
      const { data, error } =
        await supabase
          .from("site_content")
          .update(contentData)
          .eq("id", contentId)
          .select()
          .single();

      if (error) {
        console.error(error);

        alert(
          `Unable to update site content: ${error.message}`
        );

        setSaving(false);
        return;
      }

      applyContent(data as SiteContent);
    }

    setUploadMessage("");

    alert(
      "Site content saved successfully."
    );

    setSaving(false);
  }

  function resetForm() {
    const confirmed = window.confirm(
      "Reset the form to recommended NEW CITY STYLE content?"
    );

    if (!confirmed) return;

    setForm(defaultForm);
    setUploadMessage("");
  }

  if (loading) {
    return (
      <main style={loadingPageStyle}>
        <div
          style={{
            textAlign: "center",
          }}
        >
          <div className="site-content-spinner" />

          <h2
            style={{
              color: "#0A2E73",
              margin: 0,
            }}
          >
            Loading Site Content...
          </h2>
        </div>

        <style jsx global>{`
          .site-content-spinner {
            width: 58px;
            height: 58px;
            margin: 0 auto 18px;
            border-radius: 50%;
            border: 6px solid #e5e7eb;
            border-top-color: #0a2e73;
            animation: site-content-spin
              0.8s linear infinite;
          }

          @keyframes site-content-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main style={mainStyle}>
      <div style={containerStyle}>
        <section style={heroPanelStyle}>
          <p style={heroLabelStyle}>
            NEW CITY STYLE
          </p>

          <h1 style={heroTitleStyle}>
            Site Content Management
          </h1>

          <p style={heroDescriptionStyle}>
            Manage homepage hero content, about
            information, contact details, social
            media and footer text.
          </p>

          {lastUpdated && (
            <p style={lastUpdatedStyle}>
              Last updated:{" "}
              {new Date(
                lastUpdated
              ).toLocaleString("en-IN")}
            </p>
          )}
        </section>

        <section className="content-summary-grid">
          <SummaryCard
            icon="🖼️"
            title="Hero Image"
            value={
              form.heroImageUrl
                ? "Uploaded"
                : "Not Uploaded"
            }
            positive={Boolean(
              form.heroImageUrl
            )}
          />

          <SummaryCard
            icon="📞"
            title="Contact Phone"
            value={
              form.contactPhone ||
              "Not Added"
            }
          />

          <SummaryCard
            icon="✉️"
            title="Contact Email"
            value={
              form.contactEmail ||
              "Not Added"
            }
          />

          <SummaryCard
            icon="📱"
            title="Social Links"
            value={
              [
                form.facebookUrl,
                form.instagramUrl,
                form.youtubeUrl,
                form.whatsappUrl,
              ].filter(Boolean).length
            }
          />
        </section>

        <div className="site-content-layout">
          <form
            onSubmit={saveSiteContent}
            style={{
              display: "grid",
              gap: "22px",
            }}
          >
            <Panel
              title="Homepage Hero"
              subtitle="Configure the primary homepage banner content."
            >
              <Field label="Hero Title">
                <input
                  value={form.heroTitle}
                  placeholder="Style for Every Family"
                  onChange={(event) =>
                    setField(
                      "heroTitle",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="Hero Subtitle">
                <textarea
                  value={
                    form.heroSubtitle
                  }
                  placeholder="Write the homepage hero subtitle..."
                  onChange={(event) =>
                    setField(
                      "heroSubtitle",
                      event.target.value
                    )
                  }
                  style={shortTextareaStyle}
                />
              </Field>

              <div className="two-column-fields">
                <Field label="Button Text">
                  <input
                    value={
                      form.heroButtonText
                    }
                    placeholder="Shop Now"
                    onChange={(event) =>
                      setField(
                        "heroButtonText",
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Button Link">
                  <input
                    value={
                      form.heroButtonLink
                    }
                    placeholder="/products"
                    onChange={(event) =>
                      setField(
                        "heroButtonLink",
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>
              </div>
            </Panel>

            <Panel
              title="Hero Image"
              subtitle="Upload the homepage hero banner image."
            >
              <label style={uploadAreaStyle}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={uploadHeroImage}
                  disabled={uploadingHero}
                  style={{
                    display: "none",
                  }}
                />

                <div
                  style={{
                    fontSize: "38px",
                  }}
                >
                  🌄
                </div>

                <strong
                  style={uploadTitleStyle}
                >
                  {uploadingHero
                    ? "Uploading Hero Image..."
                    : "Click to Select Hero Image"}
                </strong>

                <span
                  style={
                    uploadSubtitleStyle
                  }
                >
                  Recommended wide banner — Maximum
                  10 MB
                </span>
              </label>

              {uploadMessage && (
                <div
                  style={successMessageStyle}
                >
                  ✅ {uploadMessage}
                </div>
              )}

              {form.heroImageUrl && (
                <div
                  style={
                    uploadedImageBoxStyle
                  }
                >
                  <img
                    src={
                      form.heroImageUrl
                    }
                    alt="Homepage hero preview"
                    style={
                      uploadedHeroImageStyle
                    }
                  />

                  <div
                    style={
                      uploadedImageFooterStyle
                    }
                  >
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <strong
                        style={{
                          color:
                            "#0A2E73",
                        }}
                      >
                        Hero image uploaded
                      </strong>

                      <p
                        style={
                          uploadedUrlStyle
                        }
                      >
                        {
                          form.heroImageUrl
                        }
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        removeHeroImage
                      }
                      style={
                        removeImageButtonStyle
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              <Field label="Hero Image URL">
                <input
                  value={
                    form.heroImageUrl
                  }
                  placeholder="Uploaded image URL appears automatically"
                  onChange={(event) =>
                    setField(
                      "heroImageUrl",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                />
              </Field>
            </Panel>

            <Panel
              title="About Section"
              subtitle="Manage the introduction shown on the website."
            >
              <Field label="About Title">
                <input
                  value={form.aboutTitle}
                  placeholder="Welcome to NEW CITY STYLE"
                  onChange={(event) =>
                    setField(
                      "aboutTitle",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="About Description">
                <textarea
                  value={
                    form.aboutDescription
                  }
                  placeholder="Write about NEW CITY STYLE..."
                  onChange={(event) =>
                    setField(
                      "aboutDescription",
                      event.target.value
                    )
                  }
                  style={largeTextareaStyle}
                />
              </Field>
            </Panel>

            <Panel
              title="Contact Information"
              subtitle="Configure public customer contact details."
            >
              <div className="two-column-fields">
                <Field label="Contact Phone">
                  <input
                    value={
                      form.contactPhone
                    }
                    placeholder="+91 9010014001"
                    onChange={(event) =>
                      setField(
                        "contactPhone",
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Contact Email">
                  <input
                    type="email"
                    value={
                      form.contactEmail
                    }
                    placeholder="customercare@newcitystyle.in"
                    onChange={(event) =>
                      setField(
                        "contactEmail",
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Contact Address">
                <textarea
                  value={
                    form.contactAddress
                  }
                  placeholder="Full store address"
                  onChange={(event) =>
                    setField(
                      "contactAddress",
                      event.target.value
                    )
                  }
                  style={shortTextareaStyle}
                />
              </Field>
            </Panel>

            <Panel
              title="Social Media"
              subtitle="Connect official NEW CITY STYLE social profiles."
            >
              <Field label="Facebook URL">
                <input
                  value={
                    form.facebookUrl
                  }
                  placeholder="https://facebook.com/newcitystyle"
                  onChange={(event) =>
                    setField(
                      "facebookUrl",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="Instagram URL">
                <input
                  value={
                    form.instagramUrl
                  }
                  placeholder="https://instagram.com/newcitystyle"
                  onChange={(event) =>
                    setField(
                      "instagramUrl",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="YouTube URL">
                <input
                  value={form.youtubeUrl}
                  placeholder="https://youtube.com/@newcitystyle"
                  onChange={(event) =>
                    setField(
                      "youtubeUrl",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="WhatsApp URL">
                <input
                  value={
                    form.whatsappUrl
                  }
                  placeholder="https://wa.me/919010014001"
                  onChange={(event) =>
                    setField(
                      "whatsappUrl",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                />
              </Field>
            </Panel>

            <Panel
              title="Footer Content"
              subtitle="Configure the website footer copyright text."
            >
              <Field label="Footer Text">
                <textarea
                  value={form.footerText}
                  placeholder="© NEW CITY STYLE. All rights reserved."
                  onChange={(event) =>
                    setField(
                      "footerText",
                      event.target.value
                    )
                  }
                  style={shortTextareaStyle}
                />
              </Field>
            </Panel>

            <section style={savePanelStyle}>
              <button
                type="button"
                onClick={resetForm}
                style={secondaryButtonStyle}
              >
                Reset Form
              </button>

              <button
                type="submit"
                disabled={
                  saving || uploadingHero
                }
                style={{
                  ...primaryButtonStyle,
                  opacity:
                    saving ||
                    uploadingHero
                      ? 0.7
                      : 1,

                  cursor:
                    saving ||
                    uploadingHero
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {saving
                  ? "Saving Content..."
                  : uploadingHero
                    ? "Uploading Image..."
                    : "Save Site Content"}
              </button>
            </section>
          </form>

          <aside className="content-preview-sidebar">
            <section style={previewPanelStyle}>
              <div style={heroPreviewStyle}>
                {form.heroImageUrl && (
                  <img
                    src={
                      form.heroImageUrl
                    }
                    alt="Hero background"
                    style={
                      heroPreviewImageStyle
                    }
                  />
                )}

                <div
                  style={
                    heroOverlayStyle
                  }
                />

                <div
                  style={
                    heroPreviewContentStyle
                  }
                >
                  <p
                    style={
                      previewBrandStyle
                    }
                  >
                    NEW CITY STYLE
                  </p>

                  <h2
                    style={
                      previewHeroTitleStyle
                    }
                  >
                    {form.heroTitle ||
                      "Hero Title"}
                  </h2>

                  <p
                    style={
                      previewHeroSubtitleStyle
                    }
                  >
                    {form.heroSubtitle ||
                      "Hero subtitle"}
                  </p>

                  <span
                    style={
                      previewHeroButtonStyle
                    }
                  >
                    {form.heroButtonText ||
                      "Shop Now"}
                  </span>
                </div>
              </div>
            </section>

            <section style={previewPanelStyle}>
              <h3 style={sideTitleStyle}>
                About Preview
              </h3>

              <h4
                style={{
                  color: "#0A2E73",
                  fontSize: "20px",
                  margin:
                    "0 0 10px",
                }}
              >
                {form.aboutTitle ||
                  "About Title"}
              </h4>

              <p style={previewTextStyle}>
                {form.aboutDescription ||
                  "About description has not been added."}
              </p>
            </section>

            <section style={previewPanelStyle}>
              <h3 style={sideTitleStyle}>
                Contact Preview
              </h3>

              <PreviewRow
                icon="📞"
                label="Phone"
                value={
                  form.contactPhone ||
                  "Not Added"
                }
              />

              <PreviewRow
                icon="✉️"
                label="Email"
                value={
                  form.contactEmail ||
                  "Not Added"
                }
              />

              <PreviewRow
                icon="📍"
                label="Address"
                value={
                  form.contactAddress ||
                  "Not Added"
                }
              />
            </section>

            <section style={previewPanelStyle}>
              <h3 style={sideTitleStyle}>
                Configuration Status
              </h3>

              <ConfigurationRow
                label="Hero Content"
                configured={Boolean(
                  form.heroTitle &&
                    form.heroSubtitle
                )}
              />

              <ConfigurationRow
                label="Hero Image"
                configured={Boolean(
                  form.heroImageUrl
                )}
              />

              <ConfigurationRow
                label="About Section"
                configured={Boolean(
                  form.aboutTitle &&
                    form.aboutDescription
                )}
              />

              <ConfigurationRow
                label="Contact Details"
                configured={Boolean(
                  form.contactPhone ||
                    form.contactEmail
                )}
              />

              <ConfigurationRow
                label="Social Media"
                configured={Boolean(
                  form.facebookUrl ||
                    form.instagramUrl ||
                    form.youtubeUrl ||
                    form.whatsappUrl
                )}
              />

              <ConfigurationRow
                label="Footer"
                configured={Boolean(
                  form.footerText
                )}
              />
            </section>
          </aside>
        </div>
      </div>

      <style jsx global>{`
        .content-summary-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(210px, 1fr)
          );
          gap: 16px;
          margin-bottom: 25px;
        }

        .site-content-layout {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr) 420px;
          gap: 24px;
          align-items: start;
        }

        .content-preview-sidebar {
          position: sticky;
          top: 95px;
          display: grid;
          gap: 20px;
        }

        .two-column-fields {
          display: grid;
          grid-template-columns:
            1fr 1fr;
          gap: 14px;
        }

        @media (max-width: 1050px) {
          .site-content-layout {
            grid-template-columns: 1fr;
          }

          .content-preview-sidebar {
            position: static;
          }
        }

        @media (max-width: 650px) {
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
      <div
        style={{
          marginBottom: "21px",
        }}
      >
        <h2 style={panelTitleStyle}>
          {title}
        </h2>

        <p style={panelSubtitleStyle}>
          {subtitle}
        </p>
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
    <div
      style={{
        marginBottom: "17px",
      }}
    >
      <label style={fieldLabelStyle}>
        {label}
      </label>

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
      <div
        style={{
          fontSize: "29px",
        }}
      >
        {icon}
      </div>

      <p style={summaryTitleStyle}>
        {title}
      </p>

      <h2
        style={{
          ...summaryValueStyle,

          color: positive
            ? "#16A34A"
            : "#0A2E73",
        }}
      >
        {value}
      </h2>
    </div>
  );
}

function PreviewRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div style={previewRowStyle}>
      <div style={previewLabelRowStyle}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>

      <strong
        style={previewValueStyle}
      >
        {value}
      </strong>
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
          background: configured
            ? "#DCFCE7"
            : "#FEE2E2",

          color: configured
            ? "#166534"
            : "#B91C1C",

          padding: "6px 9px",
          borderRadius: "999px",
          fontSize: "12px",
          fontWeight: 800,
        }}
      >
        {configured
          ? "Configured"
          : "Not Configured"}
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
  maxWidth: "1500px",
  margin: "0 auto",
};

const heroPanelStyle: CSSProperties = {
  background:
    "linear-gradient(135deg, #071A43 0%, #0A2E73 55%, #164CA8 100%)",

  borderRadius: "24px",
  padding: "32px",
  color: "#FFFFFF",
  marginBottom: "25px",

  boxShadow:
    "0 15px 40px rgba(10,46,115,0.25)",
};

const heroLabelStyle: CSSProperties = {
  color: "#D4AF37",
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

  boxShadow:
    "0 8px 25px rgba(0,0,0,0.07)",

  border:
    "1px solid rgba(212,175,55,0.22)",
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

const shortTextareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: "105px",
  resize: "vertical",
  lineHeight: 1.6,
};

const largeTextareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: "165px",
  resize: "vertical",
  lineHeight: 1.7,
};

const uploadAreaStyle: CSSProperties = {
  minHeight: "155px",
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

const uploadedImageBoxStyle: CSSProperties = {
  border: "1px solid #D1D5DB",
  borderRadius: "13px",
  padding: "12px",
  marginBottom: "17px",
  background: "#F8FAFC",
};

const uploadedHeroImageStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 7",
  objectFit: "cover",
  borderRadius: "11px",
  background: "#F3F4F6",
};

const uploadedImageFooterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginTop: "11px",
};

const uploadedUrlStyle: CSSProperties = {
  color: "#777",
  fontSize: "11px",
  margin: "5px 0 0",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const removeImageButtonStyle: CSSProperties = {
  background: "#FFFFFF",
  color: "#DC2626",
  border: "1px solid #FCA5A5",
  borderRadius: "9px",
  padding: "9px 12px",
  cursor: "pointer",
  fontWeight: 700,
};

const summaryCardStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "16px",
  padding: "20px",

  boxShadow:
    "0 7px 22px rgba(0,0,0,0.07)",

  border:
    "1px solid rgba(212,175,55,0.22)",
};

const summaryTitleStyle: CSSProperties = {
  color: "#666",
  margin: "9px 0 5px",
};

const summaryValueStyle: CSSProperties = {
  margin: 0,
  fontSize: "22px",
  overflowWrap: "anywhere",
};

const savePanelStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "18px",
  padding: "22px",

  boxShadow:
    "0 8px 25px rgba(0,0,0,0.07)",

  border:
    "1px solid rgba(212,175,55,0.22)",

  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "13px",
  flexWrap: "wrap",
};

const primaryButtonStyle: CSSProperties = {
  background: "#0A2E73",
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

const previewPanelStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "19px",
  padding: "21px",

  boxShadow:
    "0 8px 25px rgba(0,0,0,0.07)",

  border:
    "1px solid rgba(212,175,55,0.22)",
};

const heroPreviewStyle: CSSProperties = {
  position: "relative",
  minHeight: "390px",
  borderRadius: "16px",
  overflow: "hidden",
  background:
    "linear-gradient(135deg, #071A43, #0A2E73)",
};

const heroPreviewImageStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const heroOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,

  background:
    "linear-gradient(90deg, rgba(3,15,45,0.88), rgba(10,46,115,0.35))",
};

const heroPreviewContentStyle: CSSProperties = {
  position: "relative",
  zIndex: 2,
  minHeight: "390px",

  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",

  padding: "28px",
  color: "#FFFFFF",
};

const previewBrandStyle: CSSProperties = {
  color: "#D4AF37",
  fontWeight: 900,
  letterSpacing: "1px",
  margin: "0 0 8px",
};

const previewHeroTitleStyle: CSSProperties = {
  fontSize: "35px",
  margin: 0,
  lineHeight: 1.1,
};

const previewHeroSubtitleStyle: CSSProperties = {
  margin: "13px 0 20px",
  lineHeight: 1.6,
  opacity: 0.9,
};

const previewHeroButtonStyle: CSSProperties = {
  display: "inline-block",
  background: "#D4AF37",
  color: "#FFFFFF",
  padding: "11px 18px",
  borderRadius: "9px",
  fontWeight: 800,
};

const sideTitleStyle: CSSProperties = {
  color: "#0A2E73",
  margin: "0 0 15px",
};

const previewTextStyle: CSSProperties = {
  color: "#555",
  lineHeight: 1.7,
  margin: 0,
  whiteSpace: "pre-wrap",
};

const previewRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "14px",
  padding: "13px 0",
  borderBottom: "1px solid #E5E7EB",
};

const previewLabelRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  color: "#666",
  fontWeight: 700,
  flexShrink: 0,
};

const previewValueStyle: CSSProperties = {
  color: "#0A2E73",
  textAlign: "right",
  overflowWrap: "anywhere",
};

const configurationRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "12px 0",
  borderBottom: "1px solid #E5E7EB",
};