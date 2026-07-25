"use client";

import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Collection = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  banner_url: string | null;
  is_active: boolean;
  created_at: string;
};

type CollectionForm = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  bannerUrl: string;
  isActive: boolean;
};

const emptyForm: CollectionForm = {
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  bannerUrl: "",
  isActive: true,
};

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [form, setForm] = useState<CollectionForm>(emptyForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [uploadingCollectionImage, setUploadingCollectionImage] =
    useState(false);

  const [uploadingBannerImage, setUploadingBannerImage] =
    useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [collectionUploadMessage, setCollectionUploadMessage] =
    useState("");

  const [bannerUploadMessage, setBannerUploadMessage] =
    useState("");

  useEffect(() => {
    loadCollections();
  }, []);

  async function loadCollections() {
    setLoading(true);

    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);

      alert(`Unable to load collections: ${error.message}`);

      setLoading(false);
      return;
    }

    setCollections((data as Collection[]) || []);
    setLoading(false);
  }

  function createSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function updateField(
    field: keyof CollectionForm,
    value: string | boolean
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleNameChange(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      slug:
        editingId === null || !current.slug.trim()
          ? createSlug(value)
          : current.slug,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setSaving(false);
    setCollectionUploadMessage("");
    setBannerUploadMessage("");
  }

  function startEditing(collection: Collection) {
    setEditingId(collection.id);

    setForm({
      name: collection.name || "",
      slug: collection.slug || "",
      description: collection.description || "",
      imageUrl: collection.image_url || "",
      bannerUrl: collection.banner_url || "",
      isActive: Boolean(collection.is_active),
    });

    setCollectionUploadMessage("");
    setBannerUploadMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function validateImageFile(file: File) {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Please select a JPG, PNG or WEBP image.");
      return false;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert("Image must be smaller than 8 MB.");
      return false;
    }

    return true;
  }

  async function uploadImageToStorage(
    file: File,
    folder: string
  ) {
    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const safeFileName = file.name
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const filePath = `${folder}/${safeFileName}-${Date.now()}.${extension}`;

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
      throw new Error("Unable to generate the uploaded image URL.");
    }

    return data.publicUrl;
  }

  async function uploadCollectionImage(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!validateImageFile(file)) {
      event.target.value = "";
      return;
    }

    setUploadingCollectionImage(true);
    setCollectionUploadMessage("");

    try {
      const publicUrl = await uploadImageToStorage(
        file,
        "collections/images"
      );

      setForm((current) => ({
        ...current,
        imageUrl: publicUrl,
      }));

      setCollectionUploadMessage(
        "Collection image uploaded successfully."
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to upload collection image.";

      alert(`Collection image upload failed: ${message}`);
    } finally {
      setUploadingCollectionImage(false);
      event.target.value = "";
    }
  }

  async function uploadBannerImage(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!validateImageFile(file)) {
      event.target.value = "";
      return;
    }

    setUploadingBannerImage(true);
    setBannerUploadMessage("");

    try {
      const publicUrl = await uploadImageToStorage(
        file,
        "collections/banners"
      );

      setForm((current) => ({
        ...current,
        bannerUrl: publicUrl,
      }));

      setBannerUploadMessage(
        "Banner image uploaded successfully."
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to upload banner image.";

      alert(`Banner image upload failed: ${message}`);
    } finally {
      setUploadingBannerImage(false);
      event.target.value = "";
    }
  }

  function removeCollectionImage() {
    const confirmed = window.confirm(
      "Remove the selected collection image?"
    );

    if (!confirmed) return;

    setForm((current) => ({
      ...current,
      imageUrl: "",
    }));

    setCollectionUploadMessage(
      "Collection image removed from the form."
    );
  }

  function removeBannerImage() {
    const confirmed = window.confirm(
      "Remove the selected banner image?"
    );

    if (!confirmed) return;

    setForm((current) => ({
      ...current,
      bannerUrl: "",
    }));

    setBannerUploadMessage(
      "Banner image removed from the form."
    );
  }

  function validateForm() {
    const name = form.name.trim();
    const slug = createSlug(form.slug || form.name);

    if (!name) {
      alert("Please enter a collection name.");
      return false;
    }

    if (!slug) {
      alert("Please enter a valid collection slug.");
      return false;
    }

    return true;
  }

  async function saveCollection(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!validateForm()) return;

    setSaving(true);

    const collectionData = {
      name: form.name.trim(),
      slug: createSlug(form.slug || form.name),
      description: form.description.trim() || null,
      image_url: form.imageUrl.trim() || null,
      banner_url: form.bannerUrl.trim() || null,
      is_active: form.isActive,
    };

    if (editingId !== null) {
      const { data, error } = await supabase
        .from("collections")
        .update(collectionData)
        .eq("id", editingId)
        .select()
        .single();

      if (error) {
        console.error(error);

        alert(`Unable to update collection: ${error.message}`);

        setSaving(false);
        return;
      }

      setCollections((current) =>
        current.map((collection) =>
          collection.id === editingId
            ? (data as Collection)
            : collection
        )
      );

      alert("Collection updated successfully.");
    } else {
      const { data, error } = await supabase
        .from("collections")
        .insert(collectionData)
        .select()
        .single();

      if (error) {
        console.error(error);

        alert(`Unable to add collection: ${error.message}`);

        setSaving(false);
        return;
      }

      setCollections((current) => [
        data as Collection,
        ...current,
      ]);

      alert("Collection added successfully.");
    }

    resetForm();
  }

  async function toggleCollection(collection: Collection) {
    const newStatus = !collection.is_active;

    const confirmed = window.confirm(
      newStatus
        ? `Enable "${collection.name}"?`
        : `Disable "${collection.name}"?`
    );

    if (!confirmed) return;

    const { data, error } = await supabase
      .from("collections")
      .update({
        is_active: newStatus,
      })
      .eq("id", collection.id)
      .select()
      .single();

    if (error) {
      console.error(error);

      alert(
        `Unable to update collection status: ${error.message}`
      );

      return;
    }

    setCollections((current) =>
      current.map((item) =>
        item.id === collection.id
          ? (data as Collection)
          : item
      )
    );
  }

  async function deleteCollection(collection: Collection) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${collection.name}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("collections")
      .delete()
      .eq("id", collection.id);

    if (error) {
      console.error(error);

      alert(`Unable to delete collection: ${error.message}`);

      return;
    }

    setCollections((current) =>
      current.filter((item) => item.id !== collection.id)
    );

    if (editingId === collection.id) {
      resetForm();
    }

    alert("Collection deleted successfully.");
  }

  const filteredCollections = useMemo(() => {
    const query = search.trim().toLowerCase();

    return collections.filter((collection) => {
      const matchesSearch =
        !query ||
        collection.name.toLowerCase().includes(query) ||
        collection.slug.toLowerCase().includes(query) ||
        (collection.description || "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active" &&
          collection.is_active) ||
        (statusFilter === "Inactive" &&
          !collection.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [collections, search, statusFilter]);

  const activeCollections = collections.filter(
    (collection) => collection.is_active
  ).length;

  const inactiveCollections =
    collections.length - activeCollections;

  if (loading) {
    return (
      <main style={loadingPageStyle}>
        <div style={{ textAlign: "center" }}>
          <div className="collections-loading-spinner" />

          <h2
            style={{
              color: "#0A2E73",
              margin: 0,
            }}
          >
            Loading Collections...
          </h2>
        </div>

        <style jsx global>{`
          .collections-loading-spinner {
            width: 58px;
            height: 58px;
            margin: 0 auto 18px;
            border-radius: 50%;
            border: 6px solid #e5e7eb;
            border-top-color: #0a2e73;
            animation: collections-spin 0.8s linear infinite;
          }

          @keyframes collections-spin {
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
        <section style={heroStyle}>
          <p style={heroLabelStyle}>NEW CITY STYLE</p>

          <h1 style={heroTitleStyle}>
            Collections Management
          </h1>

          <p style={heroDescriptionStyle}>
            Create and manage seasonal, festive and featured
            collections with direct image uploads.
          </p>
        </section>

        <section className="collections-summary-grid">
          <SummaryCard
            icon="🗂️"
            title="Total Collections"
            value={collections.length}
          />

          <SummaryCard
            icon="✅"
            title="Active Collections"
            value={activeCollections}
            positive
          />

          <SummaryCard
            icon="⏸️"
            title="Inactive Collections"
            value={inactiveCollections}
          />

          <SummaryCard
            icon="🖼️"
            title="Collections with Images"
            value={
              collections.filter(
                (collection) => collection.image_url
              ).length
            }
          />
        </section>

        <div className="collections-page-layout">
          <form
            onSubmit={saveCollection}
            style={{
              display: "grid",
              gap: "22px",
            }}
          >
            <SettingsPanel
              title={
                editingId === null
                  ? "Add Collection"
                  : "Edit Collection"
              }
              subtitle="Enter the collection information and upload its images."
            >
              <FormField label="Collection Name">
                <input
                  value={form.name}
                  placeholder="Example: Festive Collection"
                  onChange={(event) =>
                    handleNameChange(event.target.value)
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="URL Slug">
                <input
                  value={form.slug}
                  placeholder="festive-collection"
                  onChange={(event) =>
                    updateField(
                      "slug",
                      createSlug(event.target.value)
                    )
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Description">
                <textarea
                  value={form.description}
                  placeholder="Write a short collection description..."
                  onChange={(event) =>
                    updateField(
                      "description",
                      event.target.value
                    )
                  }
                  style={{
                    ...inputStyle,
                    minHeight: "120px",
                    resize: "vertical",
                    lineHeight: 1.6,
                  }}
                />
              </FormField>
            </SettingsPanel>

            <SettingsPanel
              title="Collection Image"
              subtitle="Upload the main image displayed on the collection card."
            >
              <label style={uploadAreaStyle}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={uploadCollectionImage}
                  disabled={uploadingCollectionImage}
                  style={{
                    display: "none",
                  }}
                />

                <div style={{ fontSize: "36px" }}>🖼️</div>

                <strong style={uploadTitleStyle}>
                  {uploadingCollectionImage
                    ? "Uploading Collection Image..."
                    : "Click to Select Collection Image"}
                </strong>

                <span style={uploadSubtitleStyle}>
                  JPG, PNG or WEBP — Maximum 8 MB
                </span>
              </label>

              {collectionUploadMessage && (
                <div style={successMessageStyle}>
                  ✅ {collectionUploadMessage}
                </div>
              )}

              {form.imageUrl && (
                <UploadedImagePreview
                  imageUrl={form.imageUrl}
                  title="Collection image uploaded"
                  onRemove={removeCollectionImage}
                  aspectRatio="4 / 3"
                />
              )}

              <FormField label="Collection Image URL">
                <input
                  value={form.imageUrl}
                  placeholder="Uploaded image URL appears automatically"
                  onChange={(event) =>
                    updateField(
                      "imageUrl",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                />
              </FormField>
            </SettingsPanel>

            <SettingsPanel
              title="Banner Image"
              subtitle="Upload the wide banner displayed on the collection page."
            >
              <label style={uploadAreaStyle}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={uploadBannerImage}
                  disabled={uploadingBannerImage}
                  style={{
                    display: "none",
                  }}
                />

                <div style={{ fontSize: "36px" }}>🌄</div>

                <strong style={uploadTitleStyle}>
                  {uploadingBannerImage
                    ? "Uploading Banner Image..."
                    : "Click to Select Banner Image"}
                </strong>

                <span style={uploadSubtitleStyle}>
                  Recommended wide image — JPG, PNG or WEBP
                </span>
              </label>

              {bannerUploadMessage && (
                <div style={successMessageStyle}>
                  ✅ {bannerUploadMessage}
                </div>
              )}

              {form.bannerUrl && (
                <UploadedImagePreview
                  imageUrl={form.bannerUrl}
                  title="Banner image uploaded"
                  onRemove={removeBannerImage}
                  aspectRatio="16 / 6"
                />
              )}

              <FormField label="Banner Image URL">
                <input
                  value={form.bannerUrl}
                  placeholder="Uploaded banner URL appears automatically"
                  onChange={(event) =>
                    updateField(
                      "bannerUrl",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                />
              </FormField>
            </SettingsPanel>

            <SettingsPanel
              title="Collection Status"
              subtitle="Choose whether this collection is visible to customers."
            >
              <StatusToggle
                enabled={form.isActive}
                onChange={(enabled) =>
                  updateField("isActive", enabled)
                }
              />
            </SettingsPanel>

            <section style={savePanelStyle}>
              {editingId !== null ? (
                <button
                  type="button"
                  onClick={resetForm}
                  style={secondaryButtonStyle}
                >
                  Cancel Editing
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resetForm}
                  style={secondaryButtonStyle}
                >
                  Clear Form
                </button>
              )}

              <button
                type="submit"
                disabled={
                  saving ||
                  uploadingCollectionImage ||
                  uploadingBannerImage
                }
                style={{
                  ...primaryButtonStyle,
                  opacity:
                    saving ||
                    uploadingCollectionImage ||
                    uploadingBannerImage
                      ? 0.7
                      : 1,
                  cursor:
                    saving ||
                    uploadingCollectionImage ||
                    uploadingBannerImage
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {saving
                  ? "Saving Collection..."
                  : editingId === null
                    ? "Add Collection"
                    : "Update Collection"}
              </button>
            </section>
          </form>

          <section style={collectionsListPanelStyle}>
            <div className="collections-list-header">
              <div>
                <h2 style={listTitleStyle}>
                  Store Collections
                </h2>

                <p style={listSubtitleStyle}>
                  {filteredCollections.length} collections found
                </p>
              </div>

              <div className="collections-toolbar">
                <input
                  value={search}
                  placeholder="Search collections..."
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  style={{
                    ...inputStyle,
                    width: "220px",
                  }}
                />

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                  style={{
                    ...inputStyle,
                    width: "150px",
                  }}
                >
                  <option value="All">All Collections</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>

                <button
                  type="button"
                  onClick={loadCollections}
                  style={refreshButtonStyle}
                >
                  Refresh
                </button>
              </div>
            </div>

            {filteredCollections.length === 0 ? (
              <div style={emptyStateStyle}>
                No collections were found.
              </div>
            ) : (
              <div className="collections-card-grid">
                {filteredCollections.map((collection) => (
                  <article
                    key={collection.id}
                    style={collectionCardStyle}
                  >
                    <div style={collectionBannerStyle}>
                      {collection.banner_url ||
                      collection.image_url ? (
                        <img
                          src={
                            collection.banner_url ||
                            collection.image_url ||
                            ""
                          }
                          alt={collection.name}
                          style={collectionBannerImageStyle}
                        />
                      ) : (
                        <div style={imagePlaceholderStyle}>
                          🗂️
                        </div>
                      )}

                      <span
                        style={{
                          ...statusBadgeStyle,
                          background: collection.is_active
                            ? "#DCFCE7"
                            : "#FEE2E2",
                          color: collection.is_active
                            ? "#166534"
                            : "#B91C1C",
                        }}
                      >
                        {collection.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </div>

                    <div style={collectionCardBodyStyle}>
                      <div
                        style={{
                          display: "flex",
                          gap: "14px",
                          alignItems: "flex-start",
                        }}
                      >
                        {collection.image_url ? (
                          <img
                            src={collection.image_url}
                            alt={`${collection.name} thumbnail`}
                            style={collectionThumbnailStyle}
                          />
                        ) : (
                          <div
                            style={{
                              ...collectionThumbnailStyle,
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              background: "#EEF2FF",
                              fontSize: "24px",
                            }}
                          >
                            📁
                          </div>
                        )}

                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <h3 style={collectionNameStyle}>
                            {collection.name}
                          </h3>

                          <p style={collectionSlugStyle}>
                            /{collection.slug}
                          </p>
                        </div>
                      </div>

                      <p style={collectionDescriptionStyle}>
                        {collection.description ||
                          "No collection description added."}
                      </p>

                      <p style={collectionDateStyle}>
                        Created on{" "}
                        {new Date(
                          collection.created_at
                        ).toLocaleDateString("en-IN")}
                      </p>

                      <div style={cardActionsGridStyle}>
                        <button
                          type="button"
                          onClick={() =>
                            startEditing(collection)
                          }
                          style={editButtonStyle}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleCollection(collection)
                          }
                          style={{
                            ...toggleButtonStyle,
                            background: collection.is_active
                              ? "#D4AF37"
                              : "#16A34A",
                          }}
                        >
                          {collection.is_active
                            ? "Disable"
                            : "Enable"}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          deleteCollection(collection)
                        }
                        style={deleteButtonStyle}
                      >
                        Delete Collection
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <style jsx global>{`
        .collections-summary-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(210px, 1fr)
          );
          gap: 16px;
          margin-bottom: 25px;
        }

        .collections-page-layout {
          display: grid;
          grid-template-columns: 430px minmax(0, 1fr);
          gap: 24px;
          align-items: start;
        }

        .collections-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          flex-wrap: wrap;
          margin-bottom: 22px;
        }

        .collections-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .collections-card-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(320px, 1fr)
          );
          gap: 18px;
        }

        @media (max-width: 1100px) {
          .collections-page-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .collections-toolbar {
            width: 100%;
          }

          .collections-toolbar input,
          .collections-toolbar select,
          .collections-toolbar button {
            width: 100% !important;
          }

          .collections-card-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function SettingsPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section style={settingsPanelStyle}>
      <div
        style={{
          marginBottom: "21px",
        }}
      >
        <h2 style={settingsTitleStyle}>{title}</h2>

        <p style={settingsSubtitleStyle}>{subtitle}</p>
      </div>

      {children}
    </section>
  );
}

function FormField({
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
      <div
        style={{
          fontSize: "29px",
        }}
      >
        {icon}
      </div>

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

function UploadedImagePreview({
  imageUrl,
  title,
  onRemove,
  aspectRatio,
}: {
  imageUrl: string;
  title: string;
  onRemove: () => void;
  aspectRatio: string;
}) {
  return (
    <div style={uploadedImageBoxStyle}>
      <img
        src={imageUrl}
        alt={title}
        style={{
          width: "100%",
          aspectRatio,
          objectFit: "cover",
          borderRadius: "11px",
          background: "#F3F4F6",
        }}
      />

      <div style={uploadedImageFooterStyle}>
        <div
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <strong
            style={{
              color: "#0A2E73",
            }}
          >
            {title}
          </strong>

          <p style={uploadedUrlStyle}>{imageUrl}</p>
        </div>

        <button
          type="button"
          onClick={onRemove}
          style={removeImageButtonStyle}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function StatusToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "18px",
        padding: "18px",
        borderRadius: "13px",
        border: enabled
          ? "1px solid #86EFAC"
          : "1px solid #E5E7EB",
        background: enabled ? "#F0FDF4" : "#FFFFFF",
      }}
    >
      <div>
        <h3
          style={{
            color: "#0A2E73",
            margin: "0 0 5px",
          }}
        >
          Collection is {enabled ? "active" : "inactive"}
        </h3>

        <p
          style={{
            color: "#777",
            margin: 0,
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          Active collections can be displayed on the customer
          website.
        </p>
      </div>

      <button
        type="button"
        onClick={() => onChange(!enabled)}
        style={{
          position: "relative",
          width: "56px",
          height: "31px",
          border: "none",
          borderRadius: "999px",
          background: enabled ? "#16A34A" : "#D1D5DB",
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            width: "25px",
            height: "25px",
            borderRadius: "50%",
            background: "#FFFFFF",
            top: "3px",
            left: enabled ? "28px" : "3px",
            boxShadow: "0 2px 7px rgba(0,0,0,0.2)",
            transition: "0.25s",
          }}
        />
      </button>
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

const heroStyle: CSSProperties = {
  background:
    "linear-gradient(135deg, #071A43 0%, #0A2E73 55%, #164CA8 100%)",
  borderRadius: "24px",
  padding: "32px",
  color: "#FFFFFF",
  marginBottom: "25px",
  boxShadow: "0 15px 40px rgba(10,46,115,0.25)",
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

const settingsPanelStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "18px",
  padding: "24px",
  boxShadow: "0 8px 25px rgba(0,0,0,0.07)",
  border: "1px solid rgba(212,175,55,0.22)",
};

const settingsTitleStyle: CSSProperties = {
  color: "#0A2E73",
  margin: "0 0 5px",
  fontSize: "22px",
};

const settingsSubtitleStyle: CSSProperties = {
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

const uploadAreaStyle: CSSProperties = {
  minHeight: "145px",
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
  boxShadow: "0 7px 22px rgba(0,0,0,0.07)",
  border: "1px solid rgba(212,175,55,0.22)",
};

const summaryTitleStyle: CSSProperties = {
  color: "#666",
  margin: "9px 0 5px",
};

const summaryValueStyle: CSSProperties = {
  margin: 0,
  fontSize: "28px",
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

const collectionsListPanelStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "19px",
  padding: "24px",
  boxShadow: "0 8px 25px rgba(0,0,0,0.07)",
  border: "1px solid rgba(212,175,55,0.22)",
};

const listTitleStyle: CSSProperties = {
  color: "#0A2E73",
  margin: "0 0 5px",
  fontSize: "24px",
};

const listSubtitleStyle: CSSProperties = {
  color: "#777",
  margin: 0,
};

const refreshButtonStyle: CSSProperties = {
  border: "none",
  background: "#D4AF37",
  color: "#FFFFFF",
  borderRadius: "9px",
  padding: "12px 17px",
  fontWeight: 800,
  cursor: "pointer",
};

const emptyStateStyle: CSSProperties = {
  padding: "60px 20px",
  borderRadius: "13px",
  background: "#F8FAFC",
  color: "#777",
  textAlign: "center",
  fontWeight: 700,
};

const collectionCardStyle: CSSProperties = {
  border: "1px solid #E5E7EB",
  borderRadius: "17px",
  overflow: "hidden",
  background: "#FFFFFF",
  boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
};

const collectionBannerStyle: CSSProperties = {
  position: "relative",
  minHeight: "175px",
  background: "#EEF2FF",
};

const collectionBannerImageStyle: CSSProperties = {
  width: "100%",
  height: "190px",
  objectFit: "cover",
  display: "block",
};

const imagePlaceholderStyle: CSSProperties = {
  height: "190px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: "48px",
};

const statusBadgeStyle: CSSProperties = {
  position: "absolute",
  top: "13px",
  right: "13px",
  borderRadius: "999px",
  padding: "7px 10px",
  fontSize: "12px",
  fontWeight: 800,
};

const collectionCardBodyStyle: CSSProperties = {
  padding: "19px",
};

const collectionThumbnailStyle: CSSProperties = {
  width: "64px",
  height: "64px",
  objectFit: "cover",
  borderRadius: "12px",
  border: "1px solid #E5E7EB",
  flexShrink: 0,
};

const collectionNameStyle: CSSProperties = {
  color: "#0A2E73",
  margin: "4px 0 4px",
  fontSize: "21px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const collectionSlugStyle: CSSProperties = {
  color: "#777",
  margin: 0,
  fontSize: "13px",
};

const collectionDescriptionStyle: CSSProperties = {
  color: "#555",
  margin: "16px 0 0",
  lineHeight: 1.6,
  minHeight: "48px",
};

const collectionDateStyle: CSSProperties = {
  color: "#999",
  fontSize: "12px",
  margin: "13px 0 0",
};

const cardActionsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "9px",
  marginTop: "17px",
};

const editButtonStyle: CSSProperties = {
  border: "none",
  background: "#0A2E73",
  color: "#FFFFFF",
  borderRadius: "9px",
  padding: "11px",
  cursor: "pointer",
  fontWeight: 800,
};

const toggleButtonStyle: CSSProperties = {
  border: "none",
  color: "#FFFFFF",
  borderRadius: "9px",
  padding: "11px",
  cursor: "pointer",
  fontWeight: 800,
};

const deleteButtonStyle: CSSProperties = {
  width: "100%",
  marginTop: "9px",
  background: "#FFFFFF",
  color: "#DC2626",
  border: "1px solid #FCA5A5",
  borderRadius: "9px",
  padding: "11px",
  cursor: "pointer",
  fontWeight: 800,
};