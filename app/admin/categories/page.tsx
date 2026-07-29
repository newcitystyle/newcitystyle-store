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
        :root {
          --ncs-blue: #0a2e73;
          --ncs-deep: #03153f;
          --ncs-blue-2: #164ca8;
          --ncs-gold: #d4af37;
          --ncs-gold-soft: #f3dc83;
          --ncs-ivory: #f8f4ec;
          --ncs-charcoal: #2c2c2c;
        }

        * {
          box-sizing: border-box;
        }

        .categories-premium-page {
          position: relative;
          overflow-x: hidden;
          isolation: isolate;
        }

        .categories-premium-page::before,
        .categories-premium-page::after {
          content: "";
          position: fixed;
          z-index: -1;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(4px);
        }

        .categories-premium-page::before {
          width: 420px;
          height: 420px;
          top: -130px;
          right: -120px;
          background: radial-gradient(
            circle,
            rgba(212, 175, 55, 0.18),
            rgba(212, 175, 55, 0)
          );
          animation: categories-float-orb 10s ease-in-out infinite;
        }

        .categories-premium-page::after {
          width: 360px;
          height: 360px;
          left: -130px;
          bottom: -120px;
          background: radial-gradient(
            circle,
            rgba(10, 46, 115, 0.14),
            rgba(10, 46, 115, 0)
          );
          animation: categories-float-orb 12s ease-in-out infinite reverse;
        }

        .categories-premium-container {
          position: relative;
          z-index: 1;
        }

        .categories-premium-hero {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.42);
          animation: categories-rise-in 0.7s ease both;
        }

        .categories-premium-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(
              circle at 86% 10%,
              rgba(212, 175, 55, 0.28),
              transparent 28%
            ),
            linear-gradient(
              120deg,
              transparent 0%,
              rgba(255, 255, 255, 0.07) 45%,
              transparent 62%
            );
          transform: translateX(-120%);
          animation: categories-hero-shine 6s ease-in-out infinite;
          pointer-events: none;
        }

        .categories-premium-hero::after {
          content: "NCS";
          position: absolute;
          right: 30px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(212, 175, 55, 0.09);
          font-size: clamp(70px, 10vw, 150px);
          font-weight: 950;
          letter-spacing: 7px;
          pointer-events: none;
        }

        .categories-summary-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(210px, 1fr)
          );
          gap: 16px;
          margin-bottom: 25px;
        }

        .categories-premium-summary-card {
          position: relative;
          overflow: hidden;
          min-height: 150px;
          border: 1px solid rgba(212, 175, 55, 0.34) !important;
          background:
            radial-gradient(
              circle at 85% 10%,
              rgba(212, 175, 55, 0.22),
              transparent 32%
            ),
            linear-gradient(
              135deg,
              rgba(10, 46, 115, 0.99),
              rgba(3, 21, 63, 0.98)
            ) !important;
          box-shadow:
            0 15px 35px rgba(3, 21, 63, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
          animation: categories-card-enter 0.55s ease both;
          transition:
            transform 0.24s ease,
            border-color 0.24s ease,
            box-shadow 0.24s ease;
        }

        .categories-premium-summary-card:nth-child(2) {
          animation-delay: 0.08s;
        }

        .categories-premium-summary-card:nth-child(3) {
          animation-delay: 0.16s;
        }

        .categories-premium-summary-card:nth-child(4) {
          animation-delay: 0.24s;
        }

        .categories-premium-summary-card::after {
          content: "";
          position: absolute;
          top: -170%;
          left: -35%;
          width: 40%;
          height: 440%;
          transform: rotate(23deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.13),
            transparent
          );
          animation: categories-card-shine 5.5s ease-in-out infinite;
          pointer-events: none;
        }

        .categories-premium-summary-card:hover {
          transform: translateY(-5px) scale(1.01);
          border-color: rgba(212, 175, 55, 0.62) !important;
          box-shadow:
            0 22px 42px rgba(3, 21, 63, 0.26),
            0 0 0 1px rgba(212, 175, 55, 0.1) !important;
        }

        .categories-premium-summary-card p {
          color: rgba(212, 175, 55, 0.95) !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }

        .categories-premium-summary-card h2 {
          color: #ffffff !important;
          font-size: 32px !important;
        }

        .categories-page-layout {
          display: grid;
          grid-template-columns: 430px minmax(0, 1fr);
          gap: 24px;
          align-items: start;
        }

        .categories-premium-panel,
        .categories-premium-list-panel,
        .categories-save-panel {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.26) !important;
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.98),
              rgba(255, 253, 248, 0.98)
            ) !important;
          box-shadow:
            0 14px 35px rgba(3, 21, 63, 0.09),
            inset 0 1px 0 rgba(255, 255, 255, 0.9) !important;
          animation: categories-rise-in 0.65s ease both;
        }

        .categories-premium-panel::before,
        .categories-premium-list-panel::before,
        .categories-save-panel::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 3px;
          background: linear-gradient(
            90deg,
            var(--ncs-blue),
            var(--ncs-gold),
            var(--ncs-blue)
          );
          background-size: 200% 100%;
          animation: categories-gold-flow 4s linear infinite;
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

        .categories-toolbar input,
        .categories-toolbar select,
        form input {
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            transform 0.2s ease;
        }

        .categories-toolbar input:focus,
        .categories-toolbar select:focus,
        form input:focus {
          border-color: var(--ncs-gold) !important;
          box-shadow:
            0 0 0 4px rgba(212, 175, 55, 0.13),
            0 8px 20px rgba(10, 46, 115, 0.08);
          transform: translateY(-1px);
        }

        .categories-card-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(270px, 1fr)
          );
          gap: 18px;
        }

        .categories-premium-category-card {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.24) !important;
          box-shadow: 0 10px 26px rgba(3, 21, 63, 0.1) !important;
          transition:
            transform 0.24s ease,
            box-shadow 0.24s ease,
            border-color 0.24s ease;
          animation: categories-card-enter 0.52s ease both;
        }

        .categories-premium-category-card:hover {
          transform: translateY(-7px);
          border-color: rgba(212, 175, 55, 0.58) !important;
          box-shadow:
            0 20px 38px rgba(3, 21, 63, 0.19),
            0 0 0 1px rgba(212, 175, 55, 0.1) !important;
        }

        .categories-premium-category-card img {
          transition: transform 0.45s ease;
        }

        .categories-premium-category-card:hover img {
          transform: scale(1.045);
        }

        .categories-premium-upload-area {
          position: relative;
          overflow: hidden;
          border-color: rgba(212, 175, 55, 0.85) !important;
          background:
            radial-gradient(
              circle at 50% 0%,
              rgba(212, 175, 55, 0.13),
              transparent 45%
            ),
            linear-gradient(180deg, #fffdf8, #fffaf0) !important;
          transition:
            transform 0.22s ease,
            box-shadow 0.22s ease,
            border-color 0.22s ease;
        }

        .categories-premium-upload-area::after {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          border: 1px solid transparent;
          background: linear-gradient(
              120deg,
              transparent,
              rgba(212, 175, 55, 0.55),
              transparent
            )
            border-box;
          mask:
            linear-gradient(#000 0 0) padding-box,
            linear-gradient(#000 0 0);
          mask-composite: exclude;
          animation: categories-upload-glow 3.8s linear infinite;
          pointer-events: none;
        }

        .categories-premium-upload-area:hover {
          transform: translateY(-3px);
          border-color: var(--ncs-gold) !important;
          box-shadow: 0 14px 30px rgba(212, 175, 55, 0.16);
        }

        .categories-edit-banner {
          position: sticky;
          top: 12px;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 20px;
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.6);
          border-radius: 16px;
          background:
            radial-gradient(
              circle at 92% 0%,
              rgba(212, 175, 55, 0.28),
              transparent 38%
            ),
            linear-gradient(135deg, #03153f 0%, #0a2e73 100%);
          box-shadow: 0 15px 35px rgba(10, 46, 115, 0.28);
          animation: categories-pulse-banner 2.8s ease-in-out infinite;
        }

        .categories-form-action-button,
        .categories-top-update-button,
        .categories-premium-refresh-button,
        .categories-premium-edit-button,
        .categories-premium-toggle-button,
        .categories-premium-delete-button {
          min-width: 150px;
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            filter 0.2s ease;
        }

        .categories-form-action-button:hover,
        .categories-top-update-button:hover,
        .categories-premium-refresh-button:hover,
        .categories-premium-edit-button:hover,
        .categories-premium-toggle-button:hover,
        .categories-premium-delete-button:hover {
          transform: translateY(-2px);
          filter: brightness(1.04);
          box-shadow: 0 10px 22px rgba(3, 21, 63, 0.16);
        }

        .categories-primary-action-button {
          flex: 1 1 190px;
          position: relative;
          overflow: hidden;
          background: linear-gradient(
            135deg,
            var(--ncs-blue),
            var(--ncs-deep)
          ) !important;
          border: 1px solid rgba(212, 175, 55, 0.42) !important;
        }

        .categories-primary-action-button::after {
          content: "";
          position: absolute;
          top: -120%;
          left: -30%;
          width: 28%;
          height: 340%;
          transform: rotate(22deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.32),
            transparent
          );
          animation: categories-button-shine 4s ease-in-out infinite;
        }

        .categories-premium-refresh-button {
          background: linear-gradient(
            135deg,
            var(--ncs-gold),
            #b99525
          ) !important;
          color: var(--ncs-deep) !important;
          box-shadow: 0 8px 18px rgba(212, 175, 55, 0.24);
        }

        @keyframes categories-rise-in {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes categories-card-enter {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes categories-card-shine {
          0%,
          62% {
            left: -40%;
            opacity: 0;
          }
          70% {
            opacity: 0.8;
          }
          100% {
            left: 128%;
            opacity: 0;
          }
        }

        @keyframes categories-hero-shine {
          0%,
          64% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(120%);
          }
        }

        @keyframes categories-gold-flow {
          to {
            background-position: 200% 0;
          }
        }

        @keyframes categories-upload-glow {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes categories-button-shine {
          0%,
          68% {
            left: -35%;
            opacity: 0;
          }
          76% {
            opacity: 0.7;
          }
          100% {
            left: 120%;
            opacity: 0;
          }
        }

        @keyframes categories-pulse-banner {
          0%,
          100% {
            box-shadow: 0 15px 35px rgba(10, 46, 115, 0.28);
          }
          50% {
            box-shadow:
              0 18px 42px rgba(10, 46, 115, 0.34),
              0 0 0 1px rgba(212, 175, 55, 0.2);
          }
        }

        @keyframes categories-float-orb {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, 18px, 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .categories-premium-page *,
          .categories-premium-page::before,
          .categories-premium-page::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
          }
        }

        @media (max-width: 1100px) {
          .categories-page-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .categories-edit-banner {
            position: sticky;
            top: 8px;
            flex-direction: column;
            align-items: stretch;
            padding: 16px;
          }

          .categories-top-update-button,
          .categories-form-action-button {
            width: 100% !important;
            min-width: 0;
          }

          .categories-save-panel {
            display: grid !important;
            grid-template-columns: 1fr;
            width: 100%;
          }

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

          .categories-premium-hero::after {
            right: 10px;
            font-size: 70px;
          }
        }
      `}</style>
      </main>
    );
  }

  return (
    <main className="categories-premium-page" style={mainStyle}>
      <div className="categories-premium-container" style={containerStyle}>
        <section className="categories-premium-hero" style={heroStyle}>
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
            id="category-form"
            onSubmit={saveCategory}
            style={{
              display: "grid",
              gap: "22px",
              minWidth: 0,
            }}
          >
            {editingId !== null && (
              <section className="categories-edit-banner">
                <div style={{ minWidth: 0 }}>
                  <p style={editBannerLabelStyle}>EDIT MODE</p>
                  <h2 style={editBannerTitleStyle}>
                    Updating {form.name || "Category"}
                  </h2>
                  <p style={editBannerTextStyle}>
                    Make your changes below, then select Update Category.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="categories-top-update-button"
                  style={{
                    ...topUpdateButtonStyle,
                    opacity: saving || uploadingImage ? 0.7 : 1,
                    cursor:
                      saving || uploadingImage
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {saving ? "Saving..." : "Update Category"}
                </button>
              </section>
            )}
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
              <label className="categories-premium-upload-area" style={uploadAreaStyle}>
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

            <section
              className="categories-save-panel"
              style={savePanelStyle}
            >
              <button
                type="button"
                onClick={resetForm}
                className="categories-form-action-button"
                style={secondaryButtonStyle}
              >
                {editingId === null
                  ? "Clear Form"
                  : "Cancel Editing"}
              </button>

              <button
                type="submit"
                disabled={saving || uploadingImage}
                className="categories-form-action-button categories-primary-action-button"
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

          <section className="categories-premium-list-panel" style={categoriesPanelStyle}>
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
                  className="categories-premium-refresh-button"
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
                    className="categories-premium-category-card"
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
                          className="categories-premium-edit-button"
                          onClick={() =>
                            startEditing(category)
                          }
                          style={editButtonStyle}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="categories-premium-toggle-button"
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
                        className="categories-premium-delete-button"
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

        .categories-edit-banner {
          position: sticky;
          top: 12px;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 20px;
          border: 1px solid rgba(212, 175, 55, 0.55);
          border-radius: 16px;
          background: linear-gradient(135deg, #0a2e73 0%, #123f8f 100%);
          box-shadow: 0 12px 30px rgba(10, 46, 115, 0.24);
        }

        .categories-form-action-button {
          min-width: 150px;
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        }

        .categories-primary-action-button {
          flex: 1 1 190px;
        }

        @media (max-width: 1100px) {
          .categories-page-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .categories-edit-banner {
            position: sticky;
            top: 8px;
            flex-direction: column;
            align-items: stretch;
            padding: 16px;
          }

          .categories-top-update-button,
          .categories-form-action-button {
            width: 100% !important;
            min-width: 0;
          }

          .categories-save-panel {
            display: grid !important;
            grid-template-columns: 1fr;
            width: 100%;
          }

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
    <section className="categories-premium-panel" style={panelStyle}>
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
    <div className="categories-premium-summary-card" style={summaryCardStyle}>
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
  background:
    "radial-gradient(circle at 8% 0%, rgba(212,175,55,0.14), transparent 28%), linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)",
  padding: "30px 20px 80px",
};

const containerStyle: CSSProperties = {
  maxWidth: "1500px",
  margin: "0 auto",
};

const heroStyle: CSSProperties = {
  background:
    "linear-gradient(135deg, #03153F 0%, #0A2E73 58%, #164CA8 100%)",
  borderRadius: "24px",
  padding: "34px",
  color: "#FFFFFF",
  marginBottom: "25px",
  boxShadow: "0 20px 48px rgba(3,21,63,0.24)",
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
  background: "#0A2E73",
  borderRadius: "18px",
  padding: "20px",
  boxShadow: "0 12px 28px rgba(3,21,63,0.16)",
  border: "1px solid rgba(212,175,55,0.28)",
};

const summaryTitleStyle: CSSProperties = {
  color: "#666",
  margin: "9px 0 5px",
};

const summaryValueStyle: CSSProperties = {
  margin: 0,
  fontSize: "28px",
};

const editBannerLabelStyle: CSSProperties = {
  margin: "0 0 4px",
  color: "#D4AF37",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "1.2px",
};

const editBannerTitleStyle: CSSProperties = {
  margin: 0,
  color: "#FFFFFF",
  fontSize: "20px",
  overflowWrap: "anywhere",
};

const editBannerTextStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "rgba(255,255,255,0.82)",
  fontSize: "13px",
  lineHeight: 1.5,
};

const topUpdateButtonStyle: CSSProperties = {
  flexShrink: 0,
  minHeight: "46px",
  padding: "12px 20px",
  border: "1px solid #E4C65B",
  borderRadius: "10px",
  background: "#D4AF37",
  color: "#0A2E73",
  fontSize: "15px",
  fontWeight: 900,
  boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
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
  border: "1px solid rgba(212,175,55,0.24)",
  borderRadius: "18px",
  overflow: "hidden",
  background: "#FFFFFF",
  boxShadow: "0 10px 26px rgba(3,21,63,0.10)",
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