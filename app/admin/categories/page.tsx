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

type Category = {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
};

type CategoryForm = {
  name: string;
  slug: string;
  imageUrl: string;
  isActive: boolean;
};

const emptyForm: CategoryForm = {
  name: "",
  slug: "",
  imageUrl: "",
  isActive: true,
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryForm>(emptyForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [uploadMessage, setUploadMessage] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);

    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(`Unable to load categories: ${error.message}`);
      setLoading(false);
      return;
    }

    setCategories((data as Category[]) || []);
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
    setUploadMessage("");
  }

  function startEditing(category: Category) {
    setEditingId(category.id);

    setForm({
      name: category.name || "",
      slug: category.slug || "",
      imageUrl: category.image_url || "",
      isActive: Boolean(category.is_active),
    });

    setUploadMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function validateImage(file: File) {
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
      alert("Category image must be smaller than 8 MB.");
      return false;
    }

    return true;
  }

  async function uploadCategoryImage(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!validateImage(file)) {
      event.target.value = "";
      return;
    }

    setUploadingImage(true);
    setUploadMessage("");

    try {
      const extension =
        file.name.split(".").pop()?.toLowerCase() || "jpg";

      const safeName = file.name
        .replace(/\.[^/.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const filePath = `categories/${safeName}-${Date.now()}.${extension}`;

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
        throw new Error("Unable to create category image URL.");
      }

      setForm((current) => ({
        ...current,
        imageUrl: data.publicUrl,
      }));

      setUploadMessage(
        "Category image uploaded successfully."
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to upload category image.";

      alert(`Category image upload failed: ${message}`);
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  function removeCategoryImage() {
    const confirmed = window.confirm(
      "Remove the selected category image?"
    );

    if (!confirmed) return;

    setForm((current) => ({
      ...current,
      imageUrl: "",
    }));

    setUploadMessage(
      "Category image removed from the form."
    );
  }

  function validateForm() {
    const name = form.name.trim();
    const slug = createSlug(form.slug || form.name);

    if (!name) {
      alert("Please enter a category name.");
      return false;
    }

    if (!slug) {
      alert("Please enter a valid category URL slug.");
      return false;
    }

    return true;
  }

  async function saveCategory(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!validateForm()) return;

    setSaving(true);

    const categoryData = {
      name: form.name.trim(),
      slug: createSlug(form.slug || form.name),
      image_url: form.imageUrl.trim() || null,
      is_active: form.isActive,
    };

    if (editingId !== null) {
      const { data, error } = await supabase
        .from("categories")
        .update(categoryData)
        .eq("id", editingId)
        .select()
        .single();

      if (error) {
        console.error(error);
        alert(`Unable to update category: ${error.message}`);
        setSaving(false);
        return;
      }

      setCategories((current) =>
        current.map((category) =>
          category.id === editingId
            ? (data as Category)
            : category
        )
      );

      alert("Category updated successfully.");
    } else {
      const { data, error } = await supabase
        .from("categories")
        .insert(categoryData)
        .select()
        .single();

      if (error) {
        console.error(error);
        alert(`Unable to add category: ${error.message}`);
        setSaving(false);
        return;
      }

      setCategories((current) => [
        data as Category,
        ...current,
      ]);

      alert("Category added successfully.");
    }

    resetForm();
  }

  async function toggleCategory(category: Category) {
    const newStatus = !category.is_active;

    const confirmed = window.confirm(
      newStatus
        ? `Enable "${category.name}"?`
        : `Disable "${category.name}"?`
    );

    if (!confirmed) return;

    const { data, error } = await supabase
      .from("categories")
      .update({
        is_active: newStatus,
      })
      .eq("id", category.id)
      .select()
      .single();

    if (error) {
      console.error(error);

      alert(
        `Unable to update category status: ${error.message}`
      );

      return;
    }

    setCategories((current) =>
      current.map((item) =>
        item.id === category.id
          ? (data as Category)
          : item
      )
    );
  }

  async function deleteCategory(category: Category) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${category.name}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", category.id);

    if (error) {
      console.error(error);
      alert(`Unable to delete category: ${error.message}`);
      return;
    }

    setCategories((current) =>
      current.filter((item) => item.id !== category.id)
    );

    if (editingId === category.id) {
      resetForm();
    }

    alert("Category deleted successfully.");
  }

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();

    return categories.filter((category) => {
      const matchesSearch =
        !query ||
        category.name.toLowerCase().includes(query) ||
        category.slug.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active" && category.is_active) ||
        (statusFilter === "Inactive" && !category.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  const activeCategories = categories.filter(
    (category) => category.is_active
  ).length;

  const inactiveCategories =
    categories.length - activeCategories;

  const categoriesWithImages = categories.filter(
    (category) => category.image_url
  ).length;

  if (loading) {
    return (
      <main style={loadingPageStyle}>
        <div style={{ textAlign: "center" }}>
          <div className="categories-loading-spinner" />

          <h2
            style={{
              color: "#0A2E73",
              margin: 0,
            }}
          >
            Loading Categories...
          </h2>
        </div>

        <style jsx global>{`
          .categories-loading-spinner {
            width: 58px;
            height: 58px;
            margin: 0 auto 18px;
            border-radius: 50%;
            border: 6px solid #e5e7eb;
            border-top-color: #0a2e73;
            animation: categories-spin 0.8s linear infinite;
          }

          @keyframes categories-spin {
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
            Categories Management
          </h1>

          <p style={heroDescriptionStyle}>
            Add, edit, delete and manage store categories with
            direct image uploads.
          </p>
        </section>

        <section className="categories-summary-grid">
          <SummaryCard
            icon="📁"
            title="Total Categories"
            value={categories.length}
          />

          <SummaryCard
            icon="✅"
            title="Active Categories"
            value={activeCategories}
            positive
          />

          <SummaryCard
            icon="⏸️"
            title="Inactive Categories"
            value={inactiveCategories}
          />

          <SummaryCard
            icon="🖼️"
            title="Categories with Images"
            value={categoriesWithImages}
          />
        </section>

        <div className="categories-page-layout">
          <form
            onSubmit={saveCategory}
            style={{
              display: "grid",
              gap: "22px",
            }}
          >
            <Panel
              title={
                editingId === null
                  ? "Add Category"
                  : "Edit Category"
              }
              subtitle="Enter the category name, slug and upload its image."
            >
              <Field label="Category Name">
                <input
                  value={form.name}
                  placeholder="Example: Men's Fashion"
                  onChange={(event) =>
                    handleNameChange(event.target.value)
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="URL Slug">
                <input
                  value={form.slug}
                  placeholder="mens-fashion"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      slug: createSlug(event.target.value),
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
            </Panel>

            <Panel
              title="Category Image"
              subtitle="Upload the image displayed on the category card."
            >
              <label style={uploadAreaStyle}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={uploadCategoryImage}
                  disabled={uploadingImage}
                  style={{
                    display: "none",
                  }}
                />

                <div style={{ fontSize: "38px" }}>🖼️</div>

                <strong style={uploadTitleStyle}>
                  {uploadingImage
                    ? "Uploading Category Image..."
                    : "Click to Select Category Image"}
                </strong>

                <span style={uploadSubtitleStyle}>
                  JPG, PNG or WEBP — Maximum 8 MB
                </span>
              </label>

              {uploadMessage && (
                <div style={successMessageStyle}>
                  ✅ {uploadMessage}
                </div>
              )}

              {form.imageUrl && (
                <div style={uploadedImageBoxStyle}>
                  <img
                    src={form.imageUrl}
                    alt="Uploaded category"
                    style={uploadedImageStyle}
                  />

                  <div style={uploadedImageFooterStyle}>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <strong
                        style={{
                          color: "#0A2E73",
                        }}
                      >
                        Category image uploaded
                      </strong>

                      <p style={uploadedUrlStyle}>
                        {form.imageUrl}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={removeCategoryImage}
                      style={removeImageButtonStyle}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              <Field label="Category Image URL">
                <input
                  value={form.imageUrl}
                  placeholder="Uploaded image URL appears automatically"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      imageUrl: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
            </Panel>

            <Panel
              title="Category Status"
              subtitle="Choose whether customers can see this category."
            >
              <CategoryStatusToggle
                enabled={form.isActive}
                onChange={(enabled) =>
                  setForm((current) => ({
                    ...current,
                    isActive: enabled,
                  }))
                }
              />
            </Panel>

            <section style={savePanelStyle}>
              <button
                type="button"
                onClick={resetForm}
                style={secondaryButtonStyle}
              >
                {editingId === null
                  ? "Clear Form"
                  : "Cancel Editing"}
              </button>

              <button
                type="submit"
                disabled={saving || uploadingImage}
                style={{
                  ...primaryButtonStyle,
                  opacity:
                    saving || uploadingImage ? 0.7 : 1,
                  cursor:
                    saving || uploadingImage
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {saving
                  ? "Saving Category..."
                  : editingId === null
                    ? "Add Category"
                    : "Update Category"}
              </button>
            </section>
          </form>

          <section style={categoriesPanelStyle}>
            <div className="categories-list-header">
              <div>
                <h2 style={listTitleStyle}>
                  Store Categories
                </h2>

                <p style={listSubtitleStyle}>
                  {filteredCategories.length} categories found
                </p>
              </div>

              <div className="categories-toolbar">
                <input
                  value={search}
                  placeholder="Search categories..."
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
                    width: "145px",
                  }}
                >
                  <option value="All">All Categories</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>

                <button
                  type="button"
                  onClick={loadCategories}
                  style={refreshButtonStyle}
                >
                  Refresh
                </button>
              </div>
            </div>

            {filteredCategories.length === 0 ? (
              <div style={emptyStateStyle}>
                No categories were found.
              </div>
            ) : (
              <div className="categories-card-grid">
                {filteredCategories.map((category) => (
                  <article
                    key={category.id}
                    style={categoryCardStyle}
                  >
                    <div style={categoryImageContainerStyle}>
                      {category.image_url ? (
                        <img
                          src={category.image_url}
                          alt={category.name}
                          style={categoryCardImageStyle}
                        />
                      ) : (
                        <div style={categoryPlaceholderStyle}>
                          📁
                        </div>
                      )}

                      <span
                        style={{
                          ...statusBadgeStyle,
                          background: category.is_active
                            ? "#DCFCE7"
                            : "#FEE2E2",
                          color: category.is_active
                            ? "#166534"
                            : "#B91C1C",
                        }}
                      >
                        {category.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </div>

                    <div style={categoryCardBodyStyle}>
                      <h3 style={categoryNameStyle}>
                        {category.name}
                      </h3>

                      <p style={categorySlugStyle}>
                        /{category.slug}
                      </p>

                      <p style={categoryCreatedStyle}>
                        Created on{" "}
                        {new Date(
                          category.created_at
                        ).toLocaleDateString("en-IN")}
                      </p>

                      <div style={categoryActionsStyle}>
                        <button
                          type="button"
                          onClick={() =>
                            startEditing(category)
                          }
                          style={editButtonStyle}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleCategory(category)
                          }
                          style={{
                            ...toggleButtonStyle,
                            background: category.is_active
                              ? "#D4AF37"
                              : "#16A34A",
                          }}
                        >
                          {category.is_active
                            ? "Disable"
                            : "Enable"}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          deleteCategory(category)
                        }
                        style={deleteButtonStyle}
                      >
                        Delete Category
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
        .categories-summary-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(210px, 1fr)
          );
          gap: 16px;
          margin-bottom: 25px;
        }

        .categories-page-layout {
          display: grid;
          grid-template-columns: 420px minmax(0, 1fr);
          gap: 24px;
          align-items: start;
        }

        .categories-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          flex-wrap: wrap;
          margin-bottom: 22px;
        }

        .categories-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .categories-card-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(270px, 1fr)
          );
          gap: 18px;
        }

        @media (max-width: 1100px) {
          .categories-page-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .categories-toolbar {
            width: 100%;
          }

          .categories-toolbar input,
          .categories-toolbar select,
          .categories-toolbar button {
            width: 100% !important;
          }

          .categories-card-grid {
            grid-template-columns: 1fr;
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

function CategoryStatusToggle({
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
          Category is {enabled ? "active" : "inactive"}
        </h3>

        <p
          style={{
            color: "#777",
            margin: 0,
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          Active categories can be displayed on the customer
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

const uploadedImageStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "4 / 3",
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

const categoriesPanelStyle: CSSProperties = {
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

const categoryCardStyle: CSSProperties = {
  border: "1px solid #E5E7EB",
  borderRadius: "17px",
  overflow: "hidden",
  background: "#FFFFFF",
  boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
};

const categoryImageContainerStyle: CSSProperties = {
  position: "relative",
  minHeight: "190px",
  background: "#EEF2FF",
};

const categoryCardImageStyle: CSSProperties = {
  width: "100%",
  height: "210px",
  objectFit: "cover",
  display: "block",
};

const categoryPlaceholderStyle: CSSProperties = {
  width: "100%",
  height: "210px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: "55px",
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

const categoryCardBodyStyle: CSSProperties = {
  padding: "19px",
};

const categoryNameStyle: CSSProperties = {
  color: "#0A2E73",
  margin: "0 0 5px",
  fontSize: "22px",
};

const categorySlugStyle: CSSProperties = {
  color: "#777",
  margin: 0,
  fontSize: "13px",
};

const categoryCreatedStyle: CSSProperties = {
  color: "#999",
  fontSize: "12px",
  margin: "14px 0 0",
};

const categoryActionsStyle: CSSProperties = {
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