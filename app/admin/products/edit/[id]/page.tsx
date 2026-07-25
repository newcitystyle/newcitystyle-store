"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ImageItem = {
  file: File;
  preview: string;
};

type ExistingImageItem = {
  url: string;
};

type KeyValueItem = {
  id: number;
  label: string;
  value: string;
};

type FAQItem = {
  id: number;
  question: string;
  answer: string;
};

const MAX_IMAGES = 8;

function makeId() {
  return Date.now() + Math.floor(Math.random() * 100000);
}

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const productId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [productName, setProductName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [tagline, setTagline] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [brand, setBrand] = useState("NEW CITY STYLE");
  const [description, setDescription] = useState("");

  const [mrp, setMrp] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [sku, setSku] = useState("");
  const [status, setStatus] = useState("active");
  const [featured, setFeatured] = useState(false);

  const [images, setImages] = useState<ImageItem[]>([]);
  const [existingImages, setExistingImages] = useState<ExistingImageItem[]>([]);

  const [features, setFeatures] = useState([
    { id: makeId(), value: "" },
    { id: makeId(), value: "" },
    { id: makeId(), value: "" },
  ]);

  const [lifestyleTitle, setLifestyleTitle] = useState("");
  const [lifestyleSubtitle, setLifestyleSubtitle] = useState("");

  const [specifications, setSpecifications] = useState<KeyValueItem[]>([
    { id: makeId(), label: "", value: "" },
    { id: makeId(), label: "", value: "" },
    { id: makeId(), label: "", value: "" },
  ]);

  const [boxContents, setBoxContents] = useState("");

  const [faqs, setFaqs] = useState<FAQItem[]>([
    { id: makeId(), question: "", answer: "" },
    { id: makeId(), question: "", answer: "" },
  ]);

  const [shippingReturns, setShippingReturns] = useState(
    "Fast and secure delivery across India. Easy returns are available according to the NEW CITY STYLE return policy."
  );

  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [socialPreviewUrl, setSocialPreviewUrl] = useState("");

  const [packWeight, setPackWeight] = useState("");
  const [variations, setVariations] = useState<KeyValueItem[]>([
    { id: makeId(), label: "Size", value: "" },
  ]);


  useEffect(() => {
    async function loadProduct() {
      if (!productId) return;

      setLoading(true);
      setErrorMessage("");

      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .single();

        if (error) throw error;

        setProductName(data.name || data.product_name || "");
        setSlug(data.slug || "");
        setSlugTouched(true);
        setTagline(data.tagline || "");
        setCategory(data.category || "");
        setSubcategory(data.subcategory || "");
        setBrand(data.brand || "NEW CITY STYLE");
        setDescription(data.description || "");

        setMrp(data.mrp != null ? String(data.mrp) : "");
        setPrice(data.price != null ? String(data.price) : "");
        setStock(data.stock != null ? String(data.stock) : "");
        setSku(data.sku || "");
        setStatus(data.status || (data.is_active === false ? "inactive" : "active"));
        setFeatured(Boolean(data.is_featured ?? data.featured ?? false));

        const currentImages: string[] = Array.isArray(data.images)
          ? data.images
          : typeof data.images === "string"
            ? (() => {
                try {
                  const parsed = JSON.parse(data.images);
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return data.images ? [data.images] : [];
                }
              })()
            : data.image_url
              ? [data.image_url]
              : [];

        setExistingImages(
          currentImages.filter(Boolean).map((url: string) => ({ url }))
        );

        const loadedFeatures = Array.isArray(data.key_features)
          ? data.key_features
          : [];

        setFeatures(
          loadedFeatures.length > 0
            ? loadedFeatures.map((value: string) => ({ id: makeId(), value }))
            : [{ id: makeId(), value: "" }]
        );

        setLifestyleTitle(data.lifestyle_title || "");
        setLifestyleSubtitle(data.lifestyle_subtitle || "");

        const loadedSpecs = Array.isArray(data.technical_specifications)
          ? data.technical_specifications
          : [];

        setSpecifications(
          loadedSpecs.length > 0
            ? loadedSpecs.map((item: { label?: string; value?: string }) => ({
                id: makeId(),
                label: item.label || "",
                value: item.value || "",
              }))
            : [{ id: makeId(), label: "", value: "" }]
        );

        setBoxContents(data.box_contents || "");

        const loadedFaqs = Array.isArray(data.faqs) ? data.faqs : [];

        setFaqs(
          loadedFaqs.length > 0
            ? loadedFaqs.map((item: { question?: string; answer?: string }) => ({
                id: makeId(),
                question: item.question || "",
                answer: item.answer || "",
              }))
            : [{ id: makeId(), question: "", answer: "" }]
        );

        setShippingReturns(data.shipping_returns || "");
        setSeoTitle(data.seo_title || "");
        setMetaDescription(data.meta_description || "");

        setKeywords(
          Array.isArray(data.keywords)
            ? data.keywords.join(", ")
            : data.keywords || ""
        );

        setSocialPreviewUrl(data.social_preview_url || "");
        setPackWeight(data.pack_weight || "");

        const loadedVariations = Array.isArray(data.variations)
          ? data.variations
          : [];

        setVariations(
          loadedVariations.length > 0
            ? loadedVariations.map(
                (item: { name?: string; values?: string[] | string }) => ({
                  id: makeId(),
                  label: item.name || "",
                  value: Array.isArray(item.values)
                    ? item.values.join(", ")
                    : item.values || "",
                })
              )
            : [{ id: makeId(), label: "Size", value: "" }]
        );
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load the product."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [productId]);

  const discount = useMemo(() => {
    const a = Number(mrp);
    const b = Number(price);

    if (!a || !b || b >= a) return 0;
    return Math.round(((a - b) / a) * 100);
  }, [mrp, price]);

  function handleNameChange(value: string) {
    setProductName(value);

    if (!slugTouched) {
      setSlug(makeSlug(value));
    }

    if (!seoTitle) {
      setSeoTitle(value ? `${value} | NEW CITY STYLE` : "");
    }
  }

  function handleImages(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";

    const slots = MAX_IMAGES - existingImages.length - images.length;

    if (slots <= 0) {
      setErrorMessage(`Maximum ${MAX_IMAGES} images allowed.`);
      return;
    }

    const valid = selected
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, slots)
      .map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));

    setImages((current) => [...current, ...valid]);
  }

  function removeImage(index: number) {
    setImages((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((_, i) => i !== index);
    });
  }

  function moveImage(index: number, direction: "left" | "right") {
    setImages((current) => {
      const next = [...current];
      const target = direction === "left" ? index - 1 : index + 1;

      if (target < 0 || target >= next.length) return current;

      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }


  function removeExistingImage(index: number) {
    setExistingImages((current) =>
      current.filter((_, imageIndex) => imageIndex !== index)
    );
  }

  function moveExistingImage(index: number, direction: "left" | "right") {
    setExistingImages((current) => {
      const next = [...current];
      const target = direction === "left" ? index - 1 : index + 1;

      if (target < 0 || target >= next.length) return current;

      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function uploadImages(finalSlug: string) {
    const urls: string[] = [];

    for (let index = 0; index < images.length; index += 1) {
      const item = images[index];
      const extension = item.file.name.split(".").pop() || "jpg";
      const path = `products/${finalSlug}/${Date.now()}-${index}.${extension}`;

      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, item.file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);

      urls.push(data.publicUrl);
    }

    return urls;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");

    if (!productName.trim()) {
      setErrorMessage("Product name is required.");
      return;
    }

    if (!category.trim()) {
      setErrorMessage("Category is required.");
      return;
    }

    if (!description.trim()) {
      setErrorMessage("Description is required.");
      return;
    }

    if (!price || Number(price) < 0) {
      setErrorMessage("Enter a valid selling price.");
      return;
    }

    if (!stock || Number(stock) < 0) {
      setErrorMessage("Enter a valid stock quantity.");
      return;
    }

    const finalSlug = makeSlug(slug || productName);

    setSaving(true);

    try {
      const { data: duplicate, error: duplicateError } = await supabase
        .from("products")
        .select("id")
        .eq("slug", finalSlug)
        .neq("id", productId)
        .maybeSingle();

      if (duplicateError) throw duplicateError;

      if (duplicate) {
        throw new Error("This URL slug is already in use.");
      }

      const uploadedUrls = await uploadImages(finalSlug);
      const finalImageUrls = [
        ...existingImages.map((item) => item.url),
        ...uploadedUrls,
      ];

      const payload = {
        name: productName.trim(),
        slug: finalSlug,
        tagline: tagline.trim() || null,
        category: category.trim(),
        subcategory: subcategory.trim() || null,
        brand: brand.trim() || null,
        description: description.trim(),

        mrp: mrp ? Number(mrp) : Number(price),
        price: Number(price),
        stock: Number(stock),
        sku: sku.trim() || null,
        status,
        is_active: status === "active",
        is_featured: featured,

        image_url: finalImageUrls[0] || null,
        images: finalImageUrls,

        key_features: features
          .map((item) => item.value.trim())
          .filter(Boolean),

        lifestyle_title: lifestyleTitle.trim() || null,
        lifestyle_subtitle: lifestyleSubtitle.trim() || null,

        technical_specifications: specifications
          .filter((item) => item.label.trim() || item.value.trim())
          .map((item) => ({
            label: item.label.trim(),
            value: item.value.trim(),
          })),

        box_contents: boxContents.trim() || null,

        faqs: faqs
          .filter((item) => item.question.trim() || item.answer.trim())
          .map((item) => ({
            question: item.question.trim(),
            answer: item.answer.trim(),
          })),

        shipping_returns: shippingReturns.trim() || null,

        seo_title:
          seoTitle.trim() || `${productName.trim()} | NEW CITY STYLE`,
        meta_description: metaDescription.trim() || null,
        keywords: keywords
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        social_preview_url: socialPreviewUrl.trim() || null,

        pack_weight: packWeight.trim() || null,

        variations: variations
          .filter((item) => item.label.trim() || item.value.trim())
          .map((item) => ({
            name: item.label.trim(),
            values: item.value
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          })),
      };

      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", productId);

      if (error) throw error;

      setMessage("Product updated successfully.");

      setTimeout(() => {
        router.push("/admin/products");
        router.refresh();
      }, 900);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the product."
      );
    } finally {
      setSaving(false);
    }
  }

  function updateFeature(id: number, value: string) {
    setFeatures((current) =>
      current.map((item) => (item.id === id ? { ...item, value } : item))
    );
  }

  function updateKeyValue(
    setter: React.Dispatch<React.SetStateAction<KeyValueItem[]>>,
    id: number,
    field: "label" | "value",
    value: string
  ) {
    setter((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }

  function updateFaq(
    id: number,
    field: "question" | "answer",
    value: string
  ) {
    setFaqs((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }

  if (loading) {
    return (
      <main className="page">
        <div className="container">
          <div className="loadingCard">
            <div className="loader" />
            <h2>Loading product...</h2>
            <p>Please wait while the product details are loaded.</p>
          </div>
        </div>

        <style jsx>{`
          :global(body) {
            margin: 0;
            background: #f4f6fb;
            font-family: Inter, Poppins, Arial, sans-serif;
          }

          .page {
            min-height: 100vh;
            padding: 30px 20px;
            background: #f4f6fb;
          }

          .container {
            max-width: 1250px;
            margin: auto;
          }

          .loadingCard {
            min-height: 420px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border: 1px solid #e4e7ec;
            border-radius: 18px;
            background: white;
            text-align: center;
          }

          .loader {
            width: 48px;
            height: 48px;
            margin-bottom: 18px;
            border: 4px solid #e7ebf3;
            border-top-color: #0a2e73;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          h2 {
            margin: 0;
            color: #0a2e73;
          }

          p {
            color: #667085;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <header className="header">
          <div>
            <button
              type="button"
              className="back"
              onClick={() => router.push("/admin/products")}
            >
              ← Back to Products
            </button>

            <p className="eyebrow">NEW CITY STYLE ADMIN</p>
            <h1>Edit Product</h1>
            <p className="subtitle">
              Update this product and save the latest information.
            </p>
          </div>

          <div className="headerActions">
            <button
              type="button"
              className="secondary"
              onClick={() => router.push("/admin/products")}
            >
              Cancel
            </button>

            <button
              type="submit"
              form="product-form"
              className="primary"
              disabled={saving}
            >
              {saving ? "Updating Product..." : "Update Product"}
            </button>
          </div>
        </header>

        {message && <div className="alert success">✓ {message}</div>}
        {errorMessage && <div className="alert error">! {errorMessage}</div>}

        <form id="product-form" onSubmit={handleSubmit}>
          <Section number="1" title="Basic Information">
            <div className="grid two">
              <Field label="Product Name" required full>
                <input
                  value={productName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Premium Men's Slim Fit Shirt"
                />
              </Field>

              <Field label="URL Slug" required full>
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(makeSlug(e.target.value));
                  }}
                  placeholder="premium-mens-slim-fit-shirt"
                />
              </Field>

              <Field label="Tagline" full>
                <input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Premium comfort with timeless style"
                />
              </Field>

              <Field label="Category" required>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Select category</option>
                  <option value="Men">Men</option>
                  <option value="Women">Women</option>
                  <option value="Kids">Kids</option>
                  <option value="Sarees">Sarees</option>
                  <option value="Ethnic Wear">Ethnic Wear</option>
                  <option value="Sports Wear">Sports Wear</option>
                  <option value="Accessories">Accessories</option>
                </select>
              </Field>

              <Field label="Subcategory">
                <input
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  placeholder="Shirts, Jeans, Frocks"
                />
              </Field>

              <Field label="Brand">
                <input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                />
              </Field>

              <Field label="SKU">
                <input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="NCS-SHIRT-001"
                />
              </Field>

              <Field label="Description" required full>
                <textarea
                  rows={7}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Write a detailed product description..."
                />
              </Field>
            </div>
          </Section>

          <Section number="2" title="Pricing, Stock & Status">
            <div className="grid four">
              <Field label="MRP">
                <input
                  type="number"
                  min="0"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  placeholder="1499"
                />
              </Field>

              <Field label="Selling Price" required>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="999"
                />
              </Field>

              <Field label="Stock Quantity" required>
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="25"
                />
              </Field>

              <Field label="Status">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            </div>

            <div className="summary">
              <div>
                <span>Customer Price</span>
                <strong>₹{Number(price || 0).toLocaleString("en-IN")}</strong>
              </div>

              <div>
                <span>Discount</span>
                <strong>{discount}% OFF</strong>
              </div>

              <label className="check">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                />
                Featured Product
              </label>
            </div>
          </Section>

          <Section number="3" title="Product Images">
            <label className="upload">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImages}
              />
              <strong>Click to upload product images</strong>
              <span>
                PNG, JPG, JPEG or WEBP — {existingImages.length + images.length}/{MAX_IMAGES}
              </span>
            </label>

            {existingImages.length > 0 && (
              <div className="imageGrid">
                {existingImages.map((item, index) => (
                  <article className="imageCard" key={`${item.url}-${index}`}>
                    <div className="preview">
                      <img src={item.url} alt={`Existing product ${index + 1}`} />
                      {index === 0 && <span>Main Image</span>}
                    </div>

                    <div className="imageActions">
                      <button
                        type="button"
                        onClick={() => moveExistingImage(index, "left")}
                        disabled={index === 0}
                      >
                        ←
                      </button>

                      <button
                        type="button"
                        onClick={() => moveExistingImage(index, "right")}
                        disabled={index === existingImages.length - 1}
                      >
                        →
                      </button>

                      <button
                        type="button"
                        onClick={() => removeExistingImage(index)}
                      >
                        ×
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {images.length > 0 && (
              <div className="imageGrid">
                {images.map((item, index) => (
                  <article className="imageCard" key={item.preview}>
                    <div className="preview">
                      <img src={item.preview} alt={`Product ${index + 1}`} />
                      {index === 0 && <span>Main Image</span>}
                    </div>

                    <div className="imageActions">
                      <button
                        type="button"
                        onClick={() => moveImage(index, "left")}
                        disabled={index === 0}
                      >
                        ←
                      </button>

                      <button
                        type="button"
                        onClick={() => moveImage(index, "right")}
                        disabled={index === images.length - 1}
                      >
                        →
                      </button>

                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                      >
                        ×
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <p className="note">
              Supabase Storage bucket name must be <code>product-images</code>.
            </p>
          </Section>

          <Section number="4" title="Key Features">
            <div className="repeat">
              {features.map((item, index) => (
                <div className="row featureRow" key={item.id}>
                  <span>{index + 1}</span>

                  <input
                    value={item.value}
                    onChange={(e) => updateFeature(item.id, e.target.value)}
                    placeholder="Premium breathable fabric"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setFeatures((current) =>
                        current.length === 1
                          ? current
                          : current.filter((x) => x.id !== item.id)
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <AddButton
              onClick={() =>
                setFeatures((current) => [
                  ...current,
                  { id: makeId(), value: "" },
                ])
              }
              label="Add Feature"
            />
          </Section>

          <Section number="5" title="Lifestyle Gallery">
            <div className="grid two">
              <Field label="Lifestyle Title">
                <input
                  value={lifestyleTitle}
                  onChange={(e) => setLifestyleTitle(e.target.value)}
                  placeholder="Designed for Every Occasion"
                />
              </Field>

              <Field label="Lifestyle Subtitle">
                <input
                  value={lifestyleSubtitle}
                  onChange={(e) => setLifestyleSubtitle(e.target.value)}
                  placeholder="Premium style, comfort and confidence"
                />
              </Field>
            </div>
          </Section>

          <Section number="6" title="Technical Specifications">
            <div className="repeat">
              {specifications.map((item, index) => (
                <div className="row keyValueRow" key={item.id}>
                  <span>{index + 1}</span>

                  <input
                    value={item.label}
                    onChange={(e) =>
                      updateKeyValue(
                        setSpecifications,
                        item.id,
                        "label",
                        e.target.value
                      )
                    }
                    placeholder="Specification name"
                  />

                  <input
                    value={item.value}
                    onChange={(e) =>
                      updateKeyValue(
                        setSpecifications,
                        item.id,
                        "value",
                        e.target.value
                      )
                    }
                    placeholder="Specification value"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setSpecifications((current) =>
                        current.length === 1
                          ? current
                          : current.filter((x) => x.id !== item.id)
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <AddButton
              onClick={() =>
                setSpecifications((current) => [
                  ...current,
                  { id: makeId(), label: "", value: "" },
                ])
              }
              label="Add Specification"
            />
          </Section>

          <Section number="7" title="What's In The Box">
            <Field label="Package Contents">
              <textarea
                rows={4}
                value={boxContents}
                onChange={(e) => setBoxContents(e.target.value)}
                placeholder="1 × Shirt, 1 × Brand packaging cover"
              />
            </Field>
          </Section>

          <Section number="8" title="Frequently Asked Questions">
            <div className="faqList">
              {faqs.map((item, index) => (
                <article className="faqCard" key={item.id}>
                  <div className="faqHead">
                    <strong>FAQ {index + 1}</strong>
                    <button
                      type="button"
                      onClick={() =>
                        setFaqs((current) =>
                          current.length === 1
                            ? current
                            : current.filter((x) => x.id !== item.id)
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>

                  <Field label="Question">
                    <input
                      value={item.question}
                      onChange={(e) =>
                        updateFaq(item.id, "question", e.target.value)
                      }
                      placeholder="Is this product true to size?"
                    />
                  </Field>

                  <Field label="Answer">
                    <textarea
                      rows={3}
                      value={item.answer}
                      onChange={(e) =>
                        updateFaq(item.id, "answer", e.target.value)
                      }
                      placeholder="Write a helpful answer..."
                    />
                  </Field>
                </article>
              ))}
            </div>

            <AddButton
              onClick={() =>
                setFaqs((current) => [
                  ...current,
                  { id: makeId(), question: "", answer: "" },
                ])
              }
              label="Add FAQ"
            />
          </Section>

          <Section number="9" title="Shipping & Returns">
            <Field label="Shipping and Returns Policy">
              <textarea
                rows={5}
                value={shippingReturns}
                onChange={(e) => setShippingReturns(e.target.value)}
              />
            </Field>
          </Section>

          <Section number="10" title="SEO Settings">
            <div className="grid two">
              <Field label="SEO Title" full>
                <input
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  maxLength={70}
                />
              </Field>

              <Field label="Meta Description" full>
                <textarea
                  rows={4}
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  maxLength={170}
                />
              </Field>

              <Field label="Keywords" full>
                <input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="shirt, mens fashion, premium clothing"
                />
              </Field>

              <Field label="Social Preview Image URL" full>
                <input
                  type="url"
                  value={socialPreviewUrl}
                  onChange={(e) => setSocialPreviewUrl(e.target.value)}
                  placeholder="Leave blank to use the first product image"
                />
              </Field>
            </div>

            <div className="seoPreview">
              <span>newcitystyle.in/product/{slug || "product-url"}</span>
              <strong>{seoTitle || productName || "Product SEO Title"}</strong>
              <p>
                {metaDescription ||
                  description.slice(0, 160) ||
                  "Product meta description preview."}
              </p>
            </div>
          </Section>

          <Section number="11" title="Pack, Weight & Variations">
            <Field label="Pack / Weight">
              <input
                value={packWeight}
                onChange={(e) => setPackWeight(e.target.value)}
                placeholder="1 Piece / 450 g"
              />
            </Field>

            <div className="repeat variationList">
              {variations.map((item, index) => (
                <div className="row keyValueRow" key={item.id}>
                  <span>{index + 1}</span>

                  <input
                    value={item.label}
                    onChange={(e) =>
                      updateKeyValue(
                        setVariations,
                        item.id,
                        "label",
                        e.target.value
                      )
                    }
                    placeholder="Variation name"
                  />

                  <input
                    value={item.value}
                    onChange={(e) =>
                      updateKeyValue(
                        setVariations,
                        item.id,
                        "value",
                        e.target.value
                      )
                    }
                    placeholder="S, M, L, XL"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setVariations((current) =>
                        current.length === 1
                          ? current
                          : current.filter((x) => x.id !== item.id)
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <AddButton
              onClick={() =>
                setVariations((current) => [
                  ...current,
                  { id: makeId(), label: "", value: "" },
                ])
              }
              label="Add Variation"
            />
          </Section>

          <div className="bottomBar">
            <div>
              <strong>Ready to update this product?</strong>
              <p>Review all changes before updating.</p>
            </div>

            <div>
              <button
                type="button"
                className="secondary"
                onClick={() => router.push("/admin/products")}
              >
                Cancel
              </button>

              <button type="submit" className="primary" disabled={saving}>
                {saving ? "Updating Product..." : "Update Product"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          background: #f4f6fb;
          color: #172033;
          font-family: Inter, Poppins, Arial, sans-serif;
        }

        input,
        textarea,
        select,
        button {
          font: inherit;
        }

        .page {
          min-height: 100vh;
          padding: 28px 20px 60px;
          background:
            radial-gradient(
              circle at top right,
              rgba(212, 175, 55, 0.1),
              transparent 30%
            ),
            #f4f6fb;
        }

        .container {
          max-width: 1250px;
          margin: auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 24px;
          margin-bottom: 22px;
        }

        .back {
          padding: 0;
          margin-bottom: 14px;
          border: 0;
          background: transparent;
          color: #0a2e73;
          font-weight: 700;
          cursor: pointer;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #d4af37;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        h1 {
          margin: 0;
          color: #0a2e73;
          font-size: clamp(30px, 5vw, 44px);
        }

        .subtitle {
          margin: 9px 0 0;
          color: #667085;
        }

        .headerActions,
        .bottomBar > div:last-child {
          display: flex;
          gap: 10px;
        }

        .primary,
        .secondary {
          min-height: 46px;
          padding: 0 20px;
          border-radius: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .primary {
          border: 1px solid #0a2e73;
          background: linear-gradient(135deg, #0a2e73, #16499d);
          color: white;
        }

        .secondary {
          border: 1px solid #d0d5dd;
          background: white;
          color: #344054;
        }

        .primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .alert {
          margin-bottom: 18px;
          padding: 14px 16px;
          border-radius: 11px;
          font-weight: 700;
        }

        .success {
          border: 1px solid #a6f4c5;
          background: #ecfdf3;
          color: #067647;
        }

        .error {
          border: 1px solid #fecdca;
          background: #fef3f2;
          color: #b42318;
        }

        .card {
          margin-bottom: 18px;
          padding: 24px;
          border: 1px solid #e4e7ec;
          border-radius: 17px;
          background: white;
          box-shadow: 0 10px 28px rgba(16, 24, 40, 0.05);
        }

        .cardHead {
          display: flex;
          gap: 13px;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #eaecf0;
        }

        .cardHead > span {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: #0a2e73;
          color: #d4af37;
          font-weight: 900;
        }

        .cardHead h2 {
          margin: 0;
          color: #0a2e73;
          font-size: 20px;
        }

        .grid {
          display: grid;
          gap: 16px;
        }

        .two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .four {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .full {
          grid-column: 1 / -1;
        }

        .field {
          display: block;
        }

        .field > span {
          display: block;
          margin-bottom: 7px;
          color: #344054;
          font-size: 13px;
          font-weight: 750;
        }

        .field b {
          color: #d92d20;
        }

        .field input,
        .field textarea,
        .field select,
        .row input {
          width: 100%;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          background: white;
          outline: none;
        }

        .field input,
        .field select,
        .row input {
          height: 46px;
          padding: 0 13px;
        }

        .field textarea {
          padding: 12px 13px;
          resize: vertical;
        }

        .field input:focus,
        .field textarea:focus,
        .field select:focus,
        .row input:focus {
          border-color: #0a2e73;
          box-shadow: 0 0 0 4px rgba(10, 46, 115, 0.09);
        }

        .summary {
          display: grid;
          grid-template-columns: 180px 150px 1fr;
          gap: 15px;
          margin-top: 18px;
          padding: 15px;
          border-radius: 12px;
          background: #f8fafc;
        }

        .summary span {
          display: block;
          margin-bottom: 5px;
          color: #667085;
          font-size: 11px;
          text-transform: uppercase;
        }

        .summary strong {
          color: #0a2e73;
          font-size: 18px;
        }

        .check {
          display: flex;
          align-items: center;
          gap: 9px;
          font-weight: 700;
        }

        .check input {
          width: 18px;
          height: 18px;
          accent-color: #0a2e73;
        }

        .upload {
          min-height: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 2px dashed #b8c3d9;
          border-radius: 14px;
          background: #f9fbff;
          cursor: pointer;
        }

        .upload input {
          display: none;
        }

        .upload strong {
          color: #0a2e73;
        }

        .upload span {
          margin-top: 6px;
          color: #667085;
          font-size: 12px;
        }

        .imageGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 17px;
        }

        .imageCard {
          overflow: hidden;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
        }

        .preview {
          position: relative;
          aspect-ratio: 4 / 5;
          background: #f8fafc;
        }

        .preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .preview span {
          position: absolute;
          top: 8px;
          left: 8px;
          padding: 5px 8px;
          border-radius: 999px;
          background: #0a2e73;
          color: white;
          font-size: 10px;
          font-weight: 800;
        }

        .imageActions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 5px;
          padding: 7px;
        }

        .imageActions button,
        .row button,
        .faqHead button {
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          background: white;
          cursor: pointer;
        }

        .imageActions button {
          height: 34px;
        }

        .note {
          margin: 14px 0 0;
          padding: 11px 13px;
          border-radius: 9px;
          background: #f3f6ff;
          color: #475467;
          font-size: 12px;
        }

        .repeat {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .row {
          display: grid;
          align-items: center;
          gap: 10px;
        }

        .featureRow {
          grid-template-columns: 34px 1fr 40px;
        }

        .keyValueRow {
          grid-template-columns: 34px 1fr 1fr 40px;
        }

        .row > span {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #eef3ff;
          color: #0a2e73;
          font-weight: 800;
        }

        .row > button {
          height: 40px;
          color: #d92d20;
          font-size: 20px;
        }

        .addButton {
          margin-top: 13px;
          min-height: 40px;
          padding: 0 14px;
          border: 1px solid #b9c8eb;
          border-radius: 9px;
          background: #eef3ff;
          color: #0a2e73;
          font-weight: 800;
          cursor: pointer;
        }

        .faqList {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .faqCard {
          padding: 15px;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
          background: #f8fafc;
        }

        .faqCard .field + .field {
          margin-top: 12px;
        }

        .faqHead {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .faqHead button {
          padding: 5px 9px;
          color: #d92d20;
        }

        .seoPreview {
          margin-top: 18px;
          padding: 16px;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
        }

        .seoPreview span {
          color: #067647;
          font-size: 12px;
        }

        .seoPreview strong {
          display: block;
          margin-top: 6px;
          color: #1a0dab;
          font-size: 18px;
        }

        .seoPreview p {
          margin: 6px 0 0;
          color: #4d5156;
          line-height: 1.5;
        }

        .variationList {
          margin-top: 16px;
        }

        .bottomBar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 20px;
          border-radius: 16px;
          background: #0a2e73;
          color: white;
        }

        .bottomBar strong {
          font-size: 17px;
        }

        .bottomBar p {
          margin: 5px 0 0;
          color: #d8e2f8;
          font-size: 13px;
        }

        @media (max-width: 900px) {
          .header {
            align-items: flex-start;
            flex-direction: column;
          }

          .headerActions {
            width: 100%;
          }

          .headerActions button {
            flex: 1;
          }

          .four,
          .two {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .imageGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .faqList {
            grid-template-columns: 1fr;
          }

          .summary {
            grid-template-columns: repeat(2, 1fr);
          }

          .check {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 620px) {
          .page {
            padding: 16px 10px 40px;
          }

          .card {
            padding: 16px;
          }

          .four,
          .two {
            grid-template-columns: 1fr;
          }

          .imageGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .keyValueRow {
            grid-template-columns: 34px 1fr 40px;
          }

          .keyValueRow input:nth-of-type(2) {
            grid-column: 2 / 3;
          }

          .keyValueRow button {
            grid-column: 3 / 4;
            grid-row: 1 / 3;
          }

          .summary {
            grid-template-columns: 1fr;
          }

          .check {
            grid-column: auto;
          }

          .bottomBar {
            align-items: stretch;
            flex-direction: column;
          }

          .bottomBar > div:last-child {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="cardHead">
        <span>{number}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  required = false,
  full = false,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`field ${full ? "full" : ""}`}>
      <span>
        {label} {required && <b>*</b>}
      </span>
      {children}
    </label>
  );
}

function AddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="addButton" onClick={onClick}>
      ＋ {label}
    </button>
  );
}
