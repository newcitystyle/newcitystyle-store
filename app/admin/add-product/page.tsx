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
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CollectionOption = {
  id: number;
  name: string;
};

type Specification = {
  label: string;
  value: string;
};

type Faq = {
  question: string;
  answer: string;
};

type AiProductDetails = {
  productName: string;
  slug: string;
  tagline: string;
  category: string;
  subcategory: string;
  description: string;
  keyFeatures: string[];
  lifestyleTitle: string;
  lifestyleSubtitle: string;
  pattern: string;
  sleeveType: string;
  fit: string;
  gender: string;
  occasion: string;
  technicalSpecifications: Specification[];
  whatsInTheBox: string[];
  faqs: Faq[];
  seoTitle: string;
  metaDescription: string;
  seoKeywords: string[];
  productTags: string[];
};

type AiStatus = {
  type: "idle" | "success" | "error";
  message: string;
};

type ExistingStockProduct = {
  id: number;
  name: string;
  barcode: string;
  sku: string;
  stock: number;
  onlineStockLimit: number;
  sellOnline: boolean;
  image: string;
  variantId: number | null;
  variantBarcode: string;
  variantSku: string;
  size: string;
  color: string;
};

type ProductForm = {
  name: string;
  slug: string;
  tagline: string;
  category: string;
  subcategory: string;
  collectionId: string;
  brand: string;
  gender: string;
  ageGroup: string;

  shortDescription: string;
  description: string;

  mrp: string;
  price: string;
  discountPercent: string;
  taxPercent: string;

  sku: string;
  barcode: string;
  stock: string;
  lowStockLimit: string;
  sellOnline: boolean;
  onlineStockLimit: string;

  mainImage: string;
  galleryImages: string[];
  lifestyleImages: string[];

  tags: string[];
  sizes: string[];

  material: string;
  fabric: string;
  pattern: string;
  sleeveType: string;
  fitType: string;
  occasion: string;
  lifestyleTitle: string;
  lifestyleSubtitle: string;

  keyFeatures: string[];
  specifications: Specification[];
  whatsInBox: string[];
  faqs: Faq[];

  weight: string;
  packageLength: string;
  packageWidth: string;
  packageHeight: string;

  shippingPolicy: string;
  returnPolicy: string;

  seoTitle: string;
  metaDescription: string;
  seoKeywords: string;
  socialPreviewUrl: string;

  isFeatured: boolean;
  isNewArrival: boolean;
  isOnSale: boolean;
  isBestseller: boolean;
  isTrending: boolean;
  isActive: boolean;
};

const initialForm: ProductForm = {
  name: "",
  slug: "",
  tagline: "",
  category: "",
  subcategory: "",
  collectionId: "",
  brand: "NEW CITY STYLE",
  gender: "",
  ageGroup: "",

  shortDescription: "",
  description: "",

  mrp: "",
  price: "",
  discountPercent: "0",
  taxPercent: "",

  sku: "",
  barcode: "",
  stock: "",
  lowStockLimit: "",
  sellOnline: false,
  onlineStockLimit: "0",

  mainImage: "",
  galleryImages: [],
  lifestyleImages: [],

  tags: [],
  sizes: [],

  material: "",
  fabric: "",
  pattern: "",
  sleeveType: "",
  fitType: "",
  occasion: "",
  lifestyleTitle: "",
  lifestyleSubtitle: "",

  keyFeatures: ["", "", "", ""],
  specifications: [
    { label: "", value: "" },
    { label: "", value: "" },
    { label: "", value: "" },
  ],
  whatsInBox: [""],
  faqs: [
    { question: "", answer: "" },
    { question: "", answer: "" },
  ],

  weight: "",
  packageLength: "",
  packageWidth: "",
  packageHeight: "",

  shippingPolicy:
    "Orders are processed within 1-2 business days. Delivery time may vary according to the customer location.",
  returnPolicy:
    "Returns and exchanges are accepted according to the NEW CITY STYLE return policy.",

  seoTitle: "",
  metaDescription: "",
  seoKeywords: "",
  socialPreviewUrl: "",

  isFeatured: false,
  isNewArrival: true,
  isOnSale: false,
  isBestseller: false,
  isTrending: false,
  isActive: true,
};

const commonTags = [
  "New Arrival",
  "Featured",
  "Best Seller",
  "Trending",
  "Premium",
  "Casual",
  "Formal",
  "Party Wear",
  "Festive",
  "Daily Wear",
  "Summer",
  "Winter",
  "Cotton",
  "Budget Pick",
  "Limited Stock",
];

const commonSizes = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "4XL",
  "Free Size",
];


export default function AddProductPage() {
  const router = useRouter();

  const [form, setForm] = useState<ProductForm>(initialForm);
  const [collections, setCollections] = useState<CollectionOption[]>([]);

  const [saving, setSaving] = useState(false);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingLifestyle, setUploadingLifestyle] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus>({
    type: "idle",
    message: "",
  });

  const [customTag, setCustomTag] = useState("");
  const [customSize, setCustomSize] = useState("");

  const [stockSearch, setStockSearch] = useState("");
  const [stockSearchResults, setStockSearchResults] = useState<
    ExistingStockProduct[]
  >([]);
  const [searchingStock, setSearchingStock] = useState(false);
  const [linkedStockProduct, setLinkedStockProduct] =
    useState<ExistingStockProduct | null>(null);

  useEffect(() => {
    loadCollections();
  }, []);

  useEffect(() => {
    const mrp = Number(form.mrp || 0);
    const price = Number(form.price || 0);

    if (mrp > 0 && price >= 0 && price <= mrp) {
      const discount = Math.round(((mrp - price) / mrp) * 100);

      setForm((current) => ({
        ...current,
        discountPercent: String(discount),
      }));
    }
  }, [form.mrp, form.price]);

  async function loadCollections() {
    const { data, error } = await supabase
      .from("collections")
      .select("id,name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setCollections((data as CollectionOption[]) || []);
  }

  function asString(value: unknown) {
    return typeof value === "string" ? value : "";
  }

  function asNumber(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function asStringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string =>
          typeof item === "string"
        )
      : [];
  }

  function asSpecifications(value: unknown): Specification[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => {
        const record = item as Record<string, unknown>;
        return {
          label: asString(record.label),
          value: asString(record.value),
        };
      })
      .filter((item) => item.label || item.value);
  }

  function asFaqs(value: unknown): Faq[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => {
        const record = item as Record<string, unknown>;
        return {
          question: asString(record.question),
          answer: asString(record.answer),
        };
      })
      .filter((item) => item.question || item.answer);
  }

  async function searchExistingStockProduct() {
    const query = stockSearch.trim();

    if (!query) {
      alert("Scan a barcode or enter product name, SKU or barcode.");
      return;
    }

    setSearchingStock(true);
    setStockSearchResults([]);

    try {
      const safeQuery = query.replace(/[,%()]/g, " ").trim();
      const pattern = `%${safeQuery}%`;

      const [productsResponse, variantsResponse] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id,name,barcode,sku,stock,online_stock_limit,sell_online,image"
          )
          .or(
            `name.ilike.${pattern},barcode.ilike.${pattern},sku.ilike.${pattern}`
          )
          .limit(12),
        supabase
          .from("product_variants")
          .select(
            "id,product_id,barcode,sku,size,color,stock,reserved_stock,online_stock_limit,sell_online"
          )
          .or(`barcode.ilike.${pattern},sku.ilike.${pattern}`)
          .limit(12),
      ]);

      if (productsResponse.error) throw productsResponse.error;
      if (variantsResponse.error) throw variantsResponse.error;

      const productRows =
        (productsResponse.data || []) as Record<string, unknown>[];
      const variantRows =
        (variantsResponse.data || []) as Record<string, unknown>[];

      const variantProductIds = Array.from(
        new Set(
          variantRows
            .map((row) => asNumber(row.product_id))
            .filter((id) => id > 0)
        )
      );

      let variantParents: Record<string, unknown>[] = [];

      if (variantProductIds.length) {
        const { data, error } = await supabase
          .from("products")
          .select(
            "id,name,barcode,sku,stock,online_stock_limit,sell_online,image"
          )
          .in("id", variantProductIds);

        if (error) throw error;
        variantParents =
          (data || []) as Record<string, unknown>[];
      }

      const parentMap = new Map(
        [...productRows, ...variantParents].map((row) => [
          asNumber(row.id),
          row,
        ])
      );

      const directResults: ExistingStockProduct[] = productRows.map(
        (row) => ({
          id: asNumber(row.id),
          name: asString(row.name) || "Unnamed Product",
          barcode: asString(row.barcode),
          sku: asString(row.sku),
          stock: asNumber(row.stock),
          onlineStockLimit: asNumber(row.online_stock_limit),
          sellOnline: row.sell_online === true,
          image: asString(row.image),
          variantId: null,
          variantBarcode: "",
          variantSku: "",
          size: "",
          color: "",
        })
      );

      const variantResults = variantRows
        .map<ExistingStockProduct | null>((row) => {
          const productId = asNumber(row.product_id);
          const parent = parentMap.get(productId);

          if (!parent) {
            return null;
          }

          const variant: ExistingStockProduct = {
            id: productId,
            name: asString(parent.name) || "Unnamed Product",
            barcode: asString(parent.barcode),
            sku: asString(parent.sku),
            stock: Math.max(
              0,
              asNumber(row.stock) - asNumber(row.reserved_stock)
            ),
            onlineStockLimit: asNumber(row.online_stock_limit),
            sellOnline: row.sell_online === true,
            image: asString(parent.image),
            variantId: asNumber(row.id),
            variantBarcode: asString(row.barcode),
            variantSku: asString(row.sku),
            size: asString(row.size),
            color: asString(row.color),
          };

          return variant;
        })
        .filter(
          (item): item is ExistingStockProduct => item !== null
        );

      const unique = new Map<string, ExistingStockProduct>();
      [...variantResults, ...directResults].forEach((item) => {
        unique.set(`${item.id}-${item.variantId || 0}`, item);
      });

      const results = Array.from(unique.values());
      setStockSearchResults(results);

      if (!results.length) {
        alert("No existing stock product found for this search.");
      }
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? `Stock search failed: ${error.message}`
          : "Stock search failed."
      );
    } finally {
      setSearchingStock(false);
    }
  }

  async function linkExistingStockProduct(
    selected: ExistingStockProduct
  ) {
    setSearchingStock(true);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", selected.id)
        .single();

      if (error) throw error;

      const row = data as Record<string, unknown>;
      const existingSpecs = asSpecifications(
        row.technical_specifications
      );
      const existingFaqs = asFaqs(row.faqs);

      setLinkedStockProduct(selected);
      setStockSearchResults([]);
      setStockSearch(
        selected.variantBarcode || selected.barcode || selected.name
      );

      setForm((current) => ({
        ...current,
        name: asString(row.name),
        slug: asString(row.slug) || createSlug(asString(row.name)),
        tagline: asString(row.tagline),
        category: asString(row.category),
        subcategory: asString(row.subcategory),
        collectionId: row.collection_id
          ? String(row.collection_id)
          : "",
        brand: asString(row.brand) || "NEW CITY STYLE",
        gender: asString(row.gender),
        ageGroup: asString(row.age_group),
        shortDescription: asString(row.short_description),
        description: asString(row.description),
        mrp: String(asNumber(row.mrp) || ""),
        price: String(asNumber(row.price) || ""),
        discountPercent: String(asNumber(row.discount_percent)),
        taxPercent: String(asNumber(row.tax_percent) || ""),
        sku: selected.variantSku || selected.sku,
        barcode: selected.variantBarcode || selected.barcode,
        stock: String(selected.stock),
        lowStockLimit: String(asNumber(row.low_stock_limit) || 5),
        sellOnline: selected.sellOnline,
        onlineStockLimit: String(selected.onlineStockLimit),
        mainImage: asString(row.image),
        galleryImages: asStringArray(row.gallery_images),
        lifestyleImages: asStringArray(row.lifestyle_images),
        tags: asStringArray(row.tags),
        sizes: asStringArray(row.sizes),
        material: asString(row.material),
        fabric: asString(row.fabric),
        pattern: asString(row.pattern),
        sleeveType: asString(row.sleeve_type),
        fitType: asString(row.fit_type),
        occasion: asString(row.occasion),
        lifestyleTitle: asString(row.lifestyle_title),
        lifestyleSubtitle: asString(row.lifestyle_subtitle),
        keyFeatures: asStringArray(row.key_features).length
          ? asStringArray(row.key_features)
          : current.keyFeatures,
        specifications: existingSpecs.length
          ? existingSpecs
          : current.specifications,
        whatsInBox: asStringArray(row.whats_in_box).length
          ? asStringArray(row.whats_in_box)
          : current.whatsInBox,
        faqs: existingFaqs.length ? existingFaqs : current.faqs,
        weight: String(asNumber(row.weight) || ""),
        packageLength: String(asNumber(row.package_length) || ""),
        packageWidth: String(asNumber(row.package_width) || ""),
        packageHeight: String(asNumber(row.package_height) || ""),
        shippingPolicy:
          asString(row.shipping_policy) || current.shippingPolicy,
        returnPolicy:
          asString(row.return_policy) || current.returnPolicy,
        seoTitle: asString(row.seo_title),
        metaDescription: asString(row.meta_description),
        seoKeywords: asString(row.seo_keywords),
        socialPreviewUrl: asString(row.social_preview_url),
        isFeatured: row.is_featured === true,
        isNewArrival: row.is_new_arrival !== false,
        isOnSale: row.is_on_sale === true,
        isBestseller: row.is_bestseller === true,
        isTrending: row.is_trending === true,
        isActive: row.is_active !== false,
      }));

      setAiStatus({
        type: "success",
        message:
          "Existing stock product linked. Upload photos and use AI. Barcode and physical stock will be preserved.",
      });
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? `Unable to link product: ${error.message}`
          : "Unable to link product."
      );
    } finally {
      setSearchingStock(false);
    }
  }

  function unlinkExistingStockProduct() {
    setLinkedStockProduct(null);
    setStockSearch("");
    setStockSearchResults([]);
    setForm(initialForm);
    setAiStatus({ type: "idle", message: "" });
  }

  function createSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function setField<K extends keyof ProductForm>(
    field: K,
    value: ProductForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleProductName(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      slug: createSlug(value),
      seoTitle:
        current.seoTitle ||
        `${value} Online | NEW CITY STYLE`,
    }));
  }

  function validateImage(file: File) {
    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowed.includes(file.type)) {
      alert("Please select JPG, PNG or WEBP images.");
      return false;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert("Each image must be smaller than 8 MB.");
      return false;
    }

    return true;
  }

  async function uploadFile(file: File, folder: string) {
    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const safeName = file.name
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const filePath = `products/${folder}/${safeName}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}.${extension}`;

    const { error } = await supabase.storage
      .from("store-assets")
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage
      .from("store-assets")
      .getPublicUrl(filePath);

    if (!data.publicUrl) {
      throw new Error("Unable to generate image URL.");
    }

    return data.publicUrl;
  }

  async function uploadMainImage(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!validateImage(file)) {
      event.target.value = "";
      return;
    }

    setUploadingMain(true);

    try {
      const url = await uploadFile(file, "main");

      setField("mainImage", url);

      if (!form.socialPreviewUrl) {
        setField("socialPreviewUrl", url);
      }

      alert("Main product image uploaded successfully.");
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? `Image upload failed: ${error.message}`
          : "Image upload failed."
      );
    } finally {
      setUploadingMain(false);
      event.target.value = "";
    }
  }

  async function uploadGalleryImages(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    if (form.galleryImages.length + files.length > 10) {
      alert("Maximum 10 gallery images are allowed.");
      event.target.value = "";
      return;
    }

    const validFiles = files.filter(validateImage);

    if (!validFiles.length) {
      event.target.value = "";
      return;
    }

    setUploadingGallery(true);

    try {
      const urls = await Promise.all(
        validFiles.map((file) => uploadFile(file, "gallery"))
      );

      setForm((current) => ({
        ...current,
        galleryImages: [...current.galleryImages, ...urls],
      }));

      alert("Gallery images uploaded successfully.");
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? `Gallery upload failed: ${error.message}`
          : "Gallery upload failed."
      );
    } finally {
      setUploadingGallery(false);
      event.target.value = "";
    }
  }

  async function uploadLifestyleImages(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    if (form.lifestyleImages.length + files.length > 6) {
      alert("Maximum 6 lifestyle images are allowed.");
      event.target.value = "";
      return;
    }

    const validFiles = files.filter(validateImage);

    if (!validFiles.length) {
      event.target.value = "";
      return;
    }

    setUploadingLifestyle(true);

    try {
      const urls = await Promise.all(
        validFiles.map((file) =>
          uploadFile(file, "lifestyle")
        )
      );

      setForm((current) => ({
        ...current,
        lifestyleImages: [
          ...current.lifestyleImages,
          ...urls,
        ],
      }));

      alert("Lifestyle images uploaded successfully.");
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? `Lifestyle upload failed: ${error.message}`
          : "Lifestyle upload failed."
      );
    } finally {
      setUploadingLifestyle(false);
      event.target.value = "";
    }
  }

  async function generateProductDetailsWithAi() {
    if (!form.mainImage) {
      setAiStatus({
        type: "error",
        message: "Please upload the main product image first.",
      });
      return;
    }

    setGeneratingAi(true);
    setAiStatus({
      type: "idle",
      message: "Gemini is analysing the product image...",
    });

    try {
      const response = await fetch("/api/generate-product-details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: form.mainImage,
        }),
      });

      const result = (await response.json()) as {
        details?: AiProductDetails;
        error?: string;
      };

      if (!response.ok || !result.details) {
        throw new Error(
          result.error || "AI could not generate product details."
        );
      }

      const details = result.details;
      const cleanFeatures = details.keyFeatures
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 4);
      const cleanSpecifications = details.technicalSpecifications
        .map((item) => ({
          label: item.label.trim(),
          value: item.value.trim(),
        }))
        .filter((item) => item.label && item.value)
        .slice(0, 3);
      const cleanFaqs = details.faqs
        .map((item) => ({
          question: item.question.trim(),
          answer: item.answer.trim(),
        }))
        .filter((item) => item.question && item.answer)
        .slice(0, 2);
      const cleanBoxItems = details.whatsInTheBox
        .map((item) => item.trim())
        .filter(Boolean);
      const generatedTags = [
        ...details.productTags,
        details.occasion,
      ]
        .map((item) => item.trim())
        .filter(Boolean);

      setForm((current) => ({
        ...current,
        name: details.productName.trim() || current.name,
        slug:
          createSlug(details.slug || details.productName) ||
          current.slug,
        tagline: details.tagline.trim() || current.tagline,
        category: details.category.trim() || current.category,
        subcategory:
          details.subcategory.trim() || current.subcategory,
        shortDescription:
          details.metaDescription.trim() ||
          current.shortDescription,
        description:
          details.description.trim() || current.description,
        gender: details.gender.trim() || current.gender,
        pattern: details.pattern.trim() || current.pattern,
        sleeveType:
          details.sleeveType.trim() || current.sleeveType,
        fitType: details.fit.trim() || current.fitType,
        occasion: details.occasion.trim() || current.occasion,
        lifestyleTitle:
          details.lifestyleTitle.trim() || current.lifestyleTitle,
        lifestyleSubtitle:
          details.lifestyleSubtitle.trim() ||
          current.lifestyleSubtitle,
        keyFeatures: cleanFeatures.length
          ? [
              ...cleanFeatures,
              ...Array(Math.max(4 - cleanFeatures.length, 0)).fill(""),
            ]
          : current.keyFeatures,
        specifications: cleanSpecifications.length
          ? [
              ...cleanSpecifications,
              ...Array(
                Math.max(3 - cleanSpecifications.length, 0)
              ).fill(null).map(() => ({ label: "", value: "" })),
            ]
          : current.specifications,
        whatsInBox: cleanBoxItems.length
          ? cleanBoxItems
          : current.whatsInBox,
        faqs: cleanFaqs.length
          ? [
              ...cleanFaqs,
              ...Array(Math.max(2 - cleanFaqs.length, 0))
                .fill(null)
                .map(() => ({ question: "", answer: "" })),
            ]
          : current.faqs,
        seoTitle: details.seoTitle.trim() || current.seoTitle,
        metaDescription:
          details.metaDescription.trim() ||
          current.metaDescription,
        seoKeywords: details.seoKeywords.length
          ? details.seoKeywords.join(", ")
          : current.seoKeywords,
        tags: Array.from(new Set([...current.tags, ...generatedTags])),
      }));

      setAiStatus({
        type: "success",
        message:
          "AI draft generated successfully. Review and edit every field before saving.",
      });
    } catch (error) {
      console.error(error);
      setAiStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "AI generation failed. You can continue entering details manually.",
      });
    } finally {
      setGeneratingAi(false);
    }
  }

  function removeImage(
    type: "galleryImages" | "lifestyleImages",
    index: number
  ) {
    setForm((current) => ({
      ...current,
      [type]: current[type].filter(
        (_, imageIndex) => imageIndex !== index
      ),
    }));
  }
  function toggleTag(tag: string) {
    setForm((current) => ({
      ...current,
      tags: current.tags.includes(tag)
        ? current.tags.filter((item) => item !== tag)
        : [...current.tags, tag],
    }));
  }

  function addCustomTag() {
    const value = customTag.trim();

    if (!value) return;

    if (!form.tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      setField("tags", [...form.tags, value]);
    }

    setCustomTag("");
  }

  function toggleSize(size: string) {
    setForm((current) => ({
      ...current,
      sizes: current.sizes.includes(size)
        ? current.sizes.filter((item) => item !== size)
        : [...current.sizes, size],
    }));
  }


  function addCustomSize() {
    const value = customSize.trim();

    if (!value) return;

    if (!form.sizes.includes(value)) {
      setField("sizes", [...form.sizes, value]);
    }

    setCustomSize("");
  }


  function updateFeature(index: number, value: string) {
    setForm((current) => ({
      ...current,
      keyFeatures: current.keyFeatures.map((feature, featureIndex) =>
        featureIndex === index ? value : feature
      ),
    }));
  }

  function addFeature() {
    setField("keyFeatures", [...form.keyFeatures, ""]);
  }

  function removeFeature(index: number) {
    setField(
      "keyFeatures",
      form.keyFeatures.filter(
        (_, featureIndex) => featureIndex !== index
      )
    );
  }

  function updateSpecification(
    index: number,
    field: keyof Specification,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      specifications: current.specifications.map(
        (specification, specificationIndex) =>
          specificationIndex === index
            ? {
                ...specification,
                [field]: value,
              }
            : specification
      ),
    }));
  }

  function addSpecification() {
    setField("specifications", [
      ...form.specifications,
      { label: "", value: "" },
    ]);
  }

  function removeSpecification(index: number) {
    setField(
      "specifications",
      form.specifications.filter(
        (_, specificationIndex) =>
          specificationIndex !== index
      )
    );
  }

  function updateBoxItem(index: number, value: string) {
    setForm((current) => ({
      ...current,
      whatsInBox: current.whatsInBox.map((item, itemIndex) =>
        itemIndex === index ? value : item
      ),
    }));
  }

  function addBoxItem() {
    setField("whatsInBox", [...form.whatsInBox, ""]);
  }

  function removeBoxItem(index: number) {
    setField(
      "whatsInBox",
      form.whatsInBox.filter(
        (_, itemIndex) => itemIndex !== index
      )
    );
  }

  function updateFaq(
    index: number,
    field: keyof Faq,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      faqs: current.faqs.map((faq, faqIndex) =>
        faqIndex === index
          ? {
              ...faq,
              [field]: value,
            }
          : faq
      ),
    }));
  }

  function addFaq() {
    setField("faqs", [
      ...form.faqs,
      { question: "", answer: "" },
    ]);
  }

  function removeFaq(index: number) {
    setField(
      "faqs",
      form.faqs.filter((_, faqIndex) => faqIndex !== index)
    );
  }

  function getOptionalNumber(value: string, fallback: number) {
    const normalizedValue = value.trim();

    if (!normalizedValue) return fallback;

    const parsedValue = Number(normalizedValue);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  function getCleanFaqs() {
    return form.faqs
      .map((faq) => ({
        question: faq.question.trim(),
        answer: faq.answer.trim(),
      }))
      .filter((faq) => faq.question && faq.answer);
  }

  function validateForm() {
    if (!form.name.trim()) {
      alert("Please enter the product name.");
      return false;
    }

    if (!form.slug.trim()) {
      alert("Please enter the product URL slug.");
      return false;
    }

    if (!form.category.trim()) {
      alert("Please select or enter a category.");
      return false;
    }

    if (!form.description.trim()) {
      alert("Please enter the product description.");
      return false;
    }

    if (Number(form.price) <= 0) {
      alert("Please enter a valid selling price.");
      return false;
    }

    if (
      Number(form.mrp) > 0 &&
      Number(form.price) > Number(form.mrp)
    ) {
      alert("Selling price cannot be greater than MRP.");
      return false;
    }

    if (Number(form.stock) < 0 || !form.stock.trim()) {
      alert("Please enter valid product stock.");
      return false;
    }

    if (
      form.sellOnline &&
      (Number(form.onlineStockLimit) < 0 ||
        Number(form.onlineStockLimit) > Number(form.stock))
    ) {
      alert("Online quantity must be between 0 and total stock.");
      return false;
    }

    if (!form.mainImage) {
      alert("Please upload the main product image.");
      return false;
    }

    return true;
  }

  async function saveProduct(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!validateForm()) return;

    setSaving(true);

    const productData = {
      name: form.name.trim(),
      slug: createSlug(form.slug || form.name),
      tagline: form.tagline.trim() || null,
      short_description:
        form.shortDescription.trim() || null,
      description: form.description.trim(),

      category: form.category.trim(),
      subcategory: form.subcategory.trim() || null,
      collection_id: form.collectionId
        ? Number(form.collectionId)
        : null,
      brand: form.brand.trim() || null,
      gender: form.gender || null,
      age_group: form.ageGroup || null,

      mrp: Number(form.mrp || form.price),
      price: Number(form.price),
      discount_percent: Number(form.discountPercent || 0),
      tax_percent: getOptionalNumber(form.taxPercent, 0),

      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      stock: Number(form.stock),
      low_stock_limit: getOptionalNumber(form.lowStockLimit, 5),
      sell_online: form.sellOnline,
      available_in_pos: true,
      online_stock_limit: form.sellOnline
        ? Math.min(
            Number(form.onlineStockLimit || 0),
            Number(form.stock || 0)
          )
        : 0,

      image: form.mainImage,
      gallery_images: form.galleryImages,
      lifestyle_images: form.lifestyleImages,

      tags: Array.from(
        new Set(
          [
            ...form.tags,
            form.occasion.trim(),
          ].filter(Boolean)
        )
      ),
      sizes: form.sizes,
      colors: [],

      material: form.material.trim() || null,
      fabric: form.fabric.trim() || null,
      pattern: form.pattern.trim() || null,
      sleeve_type: form.sleeveType.trim() || null,
      fit_type: form.fitType.trim() || null,

      key_features: form.keyFeatures
        .map((feature) => feature.trim())
        .filter(Boolean),

      technical_specifications: form.specifications
        .map((specification) => ({
          label: specification.label.trim(),
          value: specification.value.trim(),
        }))
        .filter(
          (specification) =>
            specification.label && specification.value
        ),

      whats_in_box: form.whatsInBox
        .map((item) => item.trim())
        .filter(Boolean),

      // Supabase JSON/JSONB value: [{ question, answer }, ...]
      // Only complete FAQ pairs are saved so storefront rendering stays safe.
      faqs: getCleanFaqs(),

      weight: Number(form.weight || 0),
      package_length: Number(form.packageLength || 0),
      package_width: Number(form.packageWidth || 0),
      package_height: Number(form.packageHeight || 0),

      shipping_policy: form.shippingPolicy.trim() || null,
      return_policy: form.returnPolicy.trim() || null,

      seo_title:
        form.seoTitle.trim() ||
        `${form.name.trim()} | NEW CITY STYLE`,
      meta_description:
        form.metaDescription.trim() ||
        form.shortDescription.trim() ||
        form.description.trim().slice(0, 155),
      seo_keywords: form.seoKeywords.trim() || null,
      social_preview_url:
        form.socialPreviewUrl.trim() ||
        form.mainImage ||
        null,

      is_featured: form.isFeatured,
      is_new_arrival: form.isNewArrival,
      is_on_sale: form.isOnSale,
      is_bestseller: form.isBestseller,
      is_trending: form.isTrending,
      is_active: form.isActive,

      updated_at: new Date().toISOString(),
    };

    if (linkedStockProduct) {
      const {
        sku: _sku,
        barcode: _barcode,
        stock: _stock,
        online_stock_limit: _onlineStockLimit,
        ...detailsOnly
      } = productData;

      const { error } = await supabase
        .from("products")
        .update(detailsOnly)
        .eq("id", linkedStockProduct.id);

      if (error) {
        console.error(error);
        alert(`Unable to update product: ${error.message}`);
        setSaving(false);
        return;
      }

      const { error: onlineStockError } = await supabase.rpc(
        "set_product_online_stock",
        {
          p_product_id: linkedStockProduct.id,
          p_variant_id: linkedStockProduct.variantId,
          p_online_quantity: form.sellOnline
            ? Math.min(
                Number(form.onlineStockLimit || 0),
                linkedStockProduct.stock
              )
            : 0,
          p_sell_online: form.sellOnline,
        }
      );

      if (onlineStockError) {
        console.error(onlineStockError);
        alert(
          `Product details were updated, but online stock failed: ${onlineStockError.message}`
        );
        setSaving(false);
        return;
      }

      alert(
        "Existing stock product updated successfully. Barcode and physical stock were preserved."
      );
    } else {
      const { error } = await supabase
        .from("products")
        .insert(productData);

      if (error) {
        console.error(error);
        alert(`Unable to save product: ${error.message}`);
        setSaving(false);
        return;
      }

      alert("Premium product added successfully.");
    }

    setForm(initialForm);
    setLinkedStockProduct(null);
    setSaving(false);

    router.push(`/admin/products`);
    router.refresh();
  }

  const discountAmount = useMemo(() => {
    const mrp = Number(form.mrp || 0);
    const price = Number(form.price || 0);

    return Math.max(mrp - price, 0);
  }, [form.mrp, form.price]);

  const uploading =
    uploadingMain ||
    uploadingGallery ||
    uploadingLifestyle;

  return (
    <main style={mainStyle}>
      <div style={containerStyle}>
        <section style={heroStyle}>
          <p style={heroLabelStyle}>NEW CITY STYLE</p>

          <h1 style={heroTitleStyle}>
            Add or Link Premium Product
          </h1>

          <p style={heroDescriptionStyle}>
            Create a new product or link an existing barcode stock item, then add images, AI details, SEO and online visibility.
          </p>
        </section>

        <form onSubmit={saveProduct}>
          <div className="mobile-sticky-save">
            <button
              type="submit"
              aria-label="Save Product"
              title="Save Product"
              disabled={saving || uploading}
              className="mobile-sticky-save-button"
            >
              <span aria-hidden="true">💾</span>
              <span className="mobile-sticky-save-text">
                {saving
                  ? "Saving..."
                  : uploading
                    ? "Uploading..."
                    : linkedStockProduct
                      ? "Update Linked Product"
                      : "Save Product"}
              </span>
            </button>
          </div>

          <div className="product-admin-layout">
            <div
              style={{
                display: "grid",
                gap: "22px",
              }}
            >
              <Panel
                title="Link to Existing Stock Product"
                subtitle="Scan the barcode or search by product name/SKU. Linking preserves the existing barcode and physical stock."
              >
                <div className="existing-stock-search-row">
                  <input
                    value={stockSearch}
                    onChange={(event) =>
                      setStockSearch(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        searchExistingStockProduct();
                      }
                    }}
                    placeholder="Scan barcode or enter product name / SKU"
                    style={inputStyle}
                  />

                  <button
                    type="button"
                    onClick={searchExistingStockProduct}
                    disabled={searchingStock}
                    className="existing-stock-search-button"
                  >
                    {searchingStock ? "Searching..." : "Search Stock"}
                  </button>
                </div>

                {linkedStockProduct && (
                  <div className="linked-stock-card">
                    <div>
                      <span>LINKED STOCK PRODUCT</span>
                      <strong>{linkedStockProduct.name}</strong>
                      <p>
                        Product ID: {linkedStockProduct.id}
                        {linkedStockProduct.variantId
                          ? ` • Variant ID: ${linkedStockProduct.variantId}`
                          : ""}
                      </p>
                      <p>
                        Barcode: {linkedStockProduct.variantBarcode || linkedStockProduct.barcode || "Auto barcode"}
                        {linkedStockProduct.size
                          ? ` • Size: ${linkedStockProduct.size}`
                          : ""}
                        {linkedStockProduct.color
                          ? ` • Colour: ${linkedStockProduct.color}`
                          : ""}
                      </p>
                      <p>
                        Physical Stock: {linkedStockProduct.stock} • Online Quantity: {form.onlineStockLimit || 0}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={unlinkExistingStockProduct}
                    >
                      Unlink
                    </button>
                  </div>
                )}

                {!linkedStockProduct && stockSearchResults.length > 0 && (
                  <div className="existing-stock-results">
                    {stockSearchResults.map((product) => (
                      <button
                        type="button"
                        key={`${product.id}-${product.variantId || 0}`}
                        onClick={() =>
                          linkExistingStockProduct(product)
                        }
                      >
                        <div className="existing-stock-result-image">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                            />
                          ) : (
                            <span>📦</span>
                          )}
                        </div>

                        <div>
                          <strong>{product.name}</strong>
                          <span>
                            {product.variantBarcode || product.barcode || "No barcode"}
                          </span>
                          <small>
                            Stock {product.stock}
                            {product.size ? ` • ${product.size}` : ""}
                            {product.color ? ` • ${product.color}` : ""}
                          </small>
                        </div>

                        <b>Link</b>
                      </button>
                    ))}
                  </div>
                )}

                <div className="existing-stock-note">
                  {linkedStockProduct
                    ? "Now upload the shirt photo and use AI. Saving updates this same product; it does not create a duplicate."
                    : "Leave this empty only when you want to create a completely new product."}
                </div>
              </Panel>

              <Panel
                title="Basic Information"
                subtitle="Add the main product identity and description."
              >
                <FormGrid>
                  <Field label="Product Name" required>
                    <input
                      value={form.name}
                      onChange={(event) =>
                        handleProductName(event.target.value)
                      }
                      placeholder="Premium Men's Cotton Shirt"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="URL Slug" required>
                    <input
                      value={form.slug}
                      onChange={(event) =>
                        setField(
                          "slug",
                          createSlug(event.target.value)
                        )
                      }
                      placeholder="premium-mens-cotton-shirt"
                      style={inputStyle}
                    />
                  </Field>
                </FormGrid>

                <Field label="Tagline">
                  <input
                    value={form.tagline}
                    onChange={(event) =>
                      setField("tagline", event.target.value)
                    }
                    placeholder="Premium comfort with timeless style"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Short Description">
                  <textarea
                    value={form.shortDescription}
                    onChange={(event) =>
                      setField(
                        "shortDescription",
                        event.target.value
                      )
                    }
                    placeholder="Write a short product summary..."
                    style={shortTextareaStyle}
                  />
                </Field>

                <Field label="Full Description" required>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setField(
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="Write the complete product description..."
                    style={largeTextareaStyle}
                  />
                </Field>
              </Panel>

              <Panel
                title="Category and Product Classification"
                subtitle="Configure category, collection and customer filters."
              >
                <FormGrid>
                  <Field label="Category" required>
                    <input
                      value={form.category}
                      onChange={(event) =>
                        setField("category", event.target.value)
                      }
                      placeholder="Example: Men"
                      list="product-categories"
                      style={inputStyle}
                    />

                    <datalist id="product-categories">
                      <option value="Men" />
                      <option value="Women" />
                      <option value="Kids" />
                      <option value="Sarees" />
                      <option value="Shirts" />
                      <option value="T-Shirts" />
                      <option value="Jeans" />
                      <option value="Ethnic Wear" />
                      <option value="Sports Wear" />
                    </datalist>
                  </Field>

                  <Field label="Subcategory">
                    <input
                      value={form.subcategory}
                      onChange={(event) =>
                        setField(
                          "subcategory",
                          event.target.value
                        )
                      }
                      placeholder="Example: Casual Shirts"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Collection">
                    <select
                      value={form.collectionId}
                      onChange={(event) =>
                        setField(
                          "collectionId",
                          event.target.value
                        )
                      }
                      style={inputStyle}
                    >
                      <option value="">
                        No Collection
                      </option>

                      {collections.map((collection) => (
                        <option
                          key={collection.id}
                          value={collection.id}
                        >
                          {collection.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Brand">
                    <input
                      value={form.brand}
                      onChange={(event) =>
                        setField("brand", event.target.value)
                      }
                      placeholder="NEW CITY STYLE"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Gender">
                    <select
                      value={form.gender}
                      onChange={(event) =>
                        setField("gender", event.target.value)
                      }
                      style={inputStyle}
                    >
                      <option value="">Select Gender</option>
                      <option value="Men">Men</option>
                      <option value="Women">Women</option>
                      <option value="Boys">Boys</option>
                      <option value="Girls">Girls</option>
                      <option value="Unisex">Unisex</option>
                    </select>
                  </Field>

                  <Field label="Age Group">
                    <select
                      value={form.ageGroup}
                      onChange={(event) =>
                        setField("ageGroup", event.target.value)
                      }
                      style={inputStyle}
                    >
                      <option value="">Select Age Group</option>
                      <option value="Kids">Kids</option>
                      <option value="Teen">Teen</option>
                      <option value="Adults">Adults</option>
                      <option value="All Ages">All Ages</option>
                    </select>
                  </Field>
                </FormGrid>
              </Panel>

              <Panel
                title="Pricing"
                subtitle="Configure MRP, selling price, discount and GST."
              >
                <FormGrid>
                  <Field label="MRP">
                    <MoneyInput
                      value={form.mrp}
                      onChange={(value) =>
                        setField("mrp", value)
                      }
                      placeholder="1499"
                    />
                  </Field>

                  <Field label="Selling Price" required>
                    <MoneyInput
                      value={form.price}
                      onChange={(value) =>
                        setField("price", value)
                      }
                      placeholder="999"
                    />
                  </Field>

                  <Field label="Discount Percentage">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.discountPercent}
                      readOnly
                      style={{
                        ...inputStyle,
                        background: "#F3F4F6",
                      }}
                    />
                  </Field>

                  <Field label="GST Percentage (Optional)">
                    <input
                      type="number"
                      min="0"
                      value={form.taxPercent}
                      onChange={(event) =>
                        setField(
                          "taxPercent",
                          event.target.value
                        )
                      }
                      placeholder="Blank saves as 0"
                      style={inputStyle}
                    />
                  </Field>
                </FormGrid>

                <div style={pricingSummaryStyle}>
                  <span>
                    Customer saves:{" "}
                    <strong>
                      ₹{discountAmount.toLocaleString("en-IN")}
                    </strong>
                  </span>

                  <span>
                    Discount:{" "}
                    <strong>
                      {form.discountPercent || 0}% OFF
                    </strong>
                  </span>
                </div>
              </Panel>

              <Panel
                title="Inventory"
                subtitle="Configure SKU, barcode and product stock."
              >
                <FormGrid>
                  <Field label="SKU">
                    <input
                      value={form.sku}
                      readOnly={Boolean(linkedStockProduct)}
                      onChange={(event) =>
                        setField(
                          "sku",
                          event.target.value.toUpperCase()
                        )
                      }
                      placeholder="NCS-SHIRT-001"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Barcode">
                    <input
                      value={form.barcode}
                      readOnly={Boolean(linkedStockProduct)}
                      onChange={(event) =>
                        setField("barcode", event.target.value)
                      }
                      placeholder="Barcode number"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Total Stock" required>
                    <input
                      type="number"
                      min="0"
                      value={form.stock}
                      readOnly={Boolean(linkedStockProduct)}
                      onChange={(event) =>
                        setField("stock", event.target.value)
                      }
                      placeholder="50"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Low Stock Alert (Optional)">
                    <input
                      type="number"
                      min="0"
                      value={form.lowStockLimit}
                      onChange={(event) =>
                        setField(
                          "lowStockLimit",
                          event.target.value
                        )
                      }
                      placeholder="Blank saves as 5"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Online Quantity">
                    <input
                      type="number"
                      min="0"
                      max={Number(form.stock || 0)}
                      value={form.sellOnline ? form.onlineStockLimit : "0"}
                      disabled={!form.sellOnline}
                      onChange={(event) =>
                        setField(
                          "onlineStockLimit",
                          String(
                            Math.min(
                              Number(form.stock || 0),
                              Math.max(0, Number(event.target.value || 0))
                            )
                          )
                        )
                      }
                      placeholder="Quantity for website/app"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Online Visibility">
                    <div className="inventory-online-toggle">
                      <input
                        type="checkbox"
                        checked={form.sellOnline}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setForm((current) => ({
                            ...current,
                            sellOnline: checked,
                            onlineStockLimit: checked
                              ? current.onlineStockLimit || current.stock || "0"
                              : "0",
                          }));
                        }}
                      />
                      <div>
                        <strong>Sell Online</strong>
                        <span>Website and Android app visibility</span>
                      </div>
                    </div>
                  </Field>
                </FormGrid>

                {linkedStockProduct && (
                  <div className="inventory-lock-note">
                    🔒 Barcode, SKU and physical stock are locked because this page is linked to an existing purchase stock item.
                  </div>
                )}
              </Panel>

              <Panel
                title="Main Product Image"
                subtitle="Upload the primary image shown on product cards."
              >
                <UploadBox
                  uploading={uploadingMain}
                  label="Upload Main Product Image"
                  description="JPG, PNG or WEBP — Maximum 8 MB"
                  multiple={false}
                  onChange={uploadMainImage}
                />

                {form.mainImage && (
                  <ImagePreview
                    image={form.mainImage}
                    onRemove={() =>
                      setField("mainImage", "")
                    }
                    large
                  />
                )}
              </Panel>

              <Panel
                title="AI Product Detail Generator"
                subtitle="Gemini analyses the main image and fills an editable draft. Price, MRP, stock, SKU, sizes, tax and low-stock values are never changed."
              >
                <div style={aiGeneratorCardStyle}>
                  <div>
                    <strong style={aiGeneratorTitleStyle}>
                      Generate Product Details with AI
                    </strong>
                    <p style={aiGeneratorTextStyle}>
                      Upload the main product image first, then generate.
                      Always verify category, pattern and all written
                      details before saving.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={generateProductDetailsWithAi}
                    disabled={generatingAi || uploadingMain || !form.mainImage}
                    style={{
                      ...aiGenerateButtonStyle,
                      opacity:
                        generatingAi || uploadingMain || !form.mainImage
                          ? 0.65
                          : 1,
                      cursor:
                        generatingAi || uploadingMain || !form.mainImage
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {generatingAi
                      ? "Generating with Gemini..."
                      : "✨ Generate Product Details with AI"}
                  </button>
                </div>

                {aiStatus.message && (
                  <div
                    role={aiStatus.type === "error" ? "alert" : "status"}
                    style={{
                      ...aiStatusStyle,
                      borderColor:
                        aiStatus.type === "error"
                          ? "#DC2626"
                          : aiStatus.type === "success"
                            ? "#15803D"
                            : "#D4AF37",
                      background:
                        aiStatus.type === "error"
                          ? "#FEF2F2"
                          : aiStatus.type === "success"
                            ? "#F0FDF4"
                            : "#FFFBEA",
                      color:
                        aiStatus.type === "error"
                          ? "#991B1B"
                          : aiStatus.type === "success"
                            ? "#166534"
                            : "#7C5B00",
                    }}
                  >
                    {aiStatus.message}
                  </div>
                )}
              </Panel>

              <Panel
                title="Product Gallery"
                subtitle="Upload up to 10 additional product images."
              >
                <UploadBox
                  uploading={uploadingGallery}
                  label="Upload Gallery Images"
                  description={`${form.galleryImages.length}/10 images uploaded`}
                  multiple
                  onChange={uploadGalleryImages}
                />

                <ImageGrid
                  images={form.galleryImages}
                  onRemove={(index) =>
                    removeImage("galleryImages", index)
                  }
                />
              </Panel>

              <Panel
                title="Lifestyle Gallery"
                subtitle="Upload model, showroom and lifestyle photographs."
              >
                <FormGrid>
                  <Field label="Lifestyle Gallery Title">
                    <input
                      value={form.lifestyleTitle}
                      onChange={(event) =>
                        setField("lifestyleTitle", event.target.value)
                      }
                      placeholder="Styled for Every Moment"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Lifestyle Gallery Subtitle">
                    <input
                      value={form.lifestyleSubtitle}
                      onChange={(event) =>
                        setField("lifestyleSubtitle", event.target.value)
                      }
                      placeholder="Premium fashion for everyday confidence"
                      style={inputStyle}
                    />
                  </Field>
                </FormGrid>

                <UploadBox
                  uploading={uploadingLifestyle}
                  label="Upload Lifestyle Images"
                  description={`${form.lifestyleImages.length}/6 images uploaded`}
                  multiple
                  onChange={uploadLifestyleImages}
                />

                <ImageGrid
                  images={form.lifestyleImages}
                  onRemove={(index) =>
                    removeImage("lifestyleImages", index)
                  }
                />
              </Panel>

              <Panel
                title="Product Tags"
                subtitle="Add searchable tags customers can use to discover and filter this product."
              >
                <div style={chipGridStyle}>
                  {commonTags.map((tag) => (
                    <ChipButton
                      key={tag}
                      label={tag}
                      selected={form.tags.includes(tag)}
                      onClick={() => toggleTag(tag)}
                    />
                  ))}
                </div>

                <InlineAdd
                  value={customTag}
                  placeholder="Custom tag"
                  buttonLabel="Add Tag"
                  onChange={setCustomTag}
                  onAdd={addCustomTag}
                />

                <SelectedValues
                  values={form.tags}
                  onRemove={toggleTag}
                />
              </Panel>

              <Panel
                title="Sizes"
                subtitle="Select all available product sizes."
              >
                <div style={chipGridStyle}>
                  {commonSizes.map((size) => (
                    <ChipButton
                      key={size}
                      label={size}
                      selected={form.sizes.includes(size)}
                      onClick={() => toggleSize(size)}
                    />
                  ))}
                </div>

                <InlineAdd
                  value={customSize}
                  placeholder="Custom size"
                  buttonLabel="Add Size"
                  onChange={setCustomSize}
                  onAdd={addCustomSize}
                />

                <SelectedValues
                  values={form.sizes}
                  onRemove={toggleSize}
                />
              </Panel>

              <Panel
                title="Product Attributes"
                subtitle="Add material, fabric, pattern, sleeves and fit information."
              >
                <FormGrid>
                  <Field label="Material">
                    <input
                      value={form.material}
                      onChange={(event) =>
                        setField("material", event.target.value)
                      }
                      placeholder="Example: Cotton, Polyester, Silk"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Fabric">
                    <input
                      value={form.fabric}
                      onChange={(event) =>
                        setField("fabric", event.target.value)
                      }
                      placeholder="Example: 100% Cotton"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Pattern">
                    <input
                      value={form.pattern}
                      onChange={(event) =>
                        setField("pattern", event.target.value)
                      }
                      placeholder="Example: Solid"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Sleeve Type">
                    <input
                      value={form.sleeveType}
                      onChange={(event) =>
                        setField(
                          "sleeveType",
                          event.target.value
                        )
                      }
                      placeholder="Example: Full Sleeve"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Fit Type">
                    <input
                      value={form.fitType}
                      onChange={(event) =>
                        setField("fitType", event.target.value)
                      }
                      placeholder="Example: Regular Fit"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Occasion">
                    <input
                      value={form.occasion}
                      onChange={(event) =>
                        setField("occasion", event.target.value)
                      }
                      placeholder="Example: Casual, Festive, Party Wear"
                      style={inputStyle}
                    />
                  </Field>
                </FormGrid>
              </Panel>

              <Panel
                title="Key Features"
                subtitle="Add the most important product benefits."
              >
                {form.keyFeatures.map((feature, index) => (
                  <DynamicRow key={index}>
                    <input
                      value={feature}
                      onChange={(event) =>
                        updateFeature(
                          index,
                          event.target.value
                        )
                      }
                      placeholder={`Key feature ${index + 1}`}
                      style={inputStyle}
                    />

                    <RemoveButton
                      onClick={() => removeFeature(index)}
                    />
                  </DynamicRow>
                ))}

                <AddButton
                  label="Add Key Feature"
                  onClick={addFeature}
                />
              </Panel>

              <Panel
                title="Technical Specifications"
                subtitle="Three specification fields are recommended."
              >
                {form.specifications.map(
                  (specification, index) => (
                    <DynamicRow key={index}>
                      <input
                        value={specification.label}
                        onChange={(event) =>
                          updateSpecification(
                            index,
                            "label",
                            event.target.value
                          )
                        }
                        placeholder="Specification name"
                        style={inputStyle}
                      />

                      <input
                        value={specification.value}
                        onChange={(event) =>
                          updateSpecification(
                            index,
                            "value",
                            event.target.value
                          )
                        }
                        placeholder="Specification value"
                        style={inputStyle}
                      />

                      <RemoveButton
                        onClick={() =>
                          removeSpecification(index)
                        }
                      />
                    </DynamicRow>
                  )
                )}

                <AddButton
                  label="Add Specification"
                  onClick={addSpecification}
                />
              </Panel>

              <Panel
                title="What's in the Box"
                subtitle="List all items supplied with this product."
              >
                {form.whatsInBox.map((item, index) => (
                  <DynamicRow key={index}>
                    <input
                      value={item}
                      onChange={(event) =>
                        updateBoxItem(
                          index,
                          event.target.value
                        )
                      }
                      placeholder="Example: 1 x Shirt"
                      style={inputStyle}
                    />

                    <RemoveButton
                      onClick={() => removeBoxItem(index)}
                    />
                  </DynamicRow>
                ))}

                <AddButton
                  label="Add Box Item"
                  onClick={addBoxItem}
                />
              </Panel>

              <Panel
                title="Frequently Asked Questions"
                subtitle="Two FAQs are included by default."
              >
                {form.faqs.map((faq, index) => (
                  <div key={index} style={faqCardStyle}>
                    <div style={faqHeaderStyle}>
                      <strong style={{ color: "#0A2E73" }}>
                        FAQ {index + 1}
                      </strong>

                      <RemoveButton
                        onClick={() => removeFaq(index)}
                      />
                    </div>

                    <input
                      value={faq.question}
                      onChange={(event) =>
                        updateFaq(
                          index,
                          "question",
                          event.target.value
                        )
                      }
                      placeholder="Customer question"
                      style={inputStyle}
                    />

                    <textarea
                      value={faq.answer}
                      onChange={(event) =>
                        updateFaq(
                          index,
                          "answer",
                          event.target.value
                        )
                      }
                      placeholder="Answer"
                      style={{
                        ...shortTextareaStyle,
                        marginTop: "10px",
                      }}
                    />
                  </div>
                ))}

                <AddButton
                  label="Add FAQ"
                  onClick={addFaq}
                />
              </Panel>

              <Panel
                title="Shipping Details"
                subtitle="Add product weight, dimensions and policies."
              >
                <FormGrid>
                  <Field label="Weight (kg)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.weight}
                      onChange={(event) =>
                        setField("weight", event.target.value)
                      }
                      placeholder="0.5"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Package Length (cm)">
                    <input
                      type="number"
                      min="0"
                      value={form.packageLength}
                      onChange={(event) =>
                        setField(
                          "packageLength",
                          event.target.value
                        )
                      }
                      placeholder="30"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Package Width (cm)">
                    <input
                      type="number"
                      min="0"
                      value={form.packageWidth}
                      onChange={(event) =>
                        setField(
                          "packageWidth",
                          event.target.value
                        )
                      }
                      placeholder="25"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Package Height (cm)">
                    <input
                      type="number"
                      min="0"
                      value={form.packageHeight}
                      onChange={(event) =>
                        setField(
                          "packageHeight",
                          event.target.value
                        )
                      }
                      placeholder="5"
                      style={inputStyle}
                    />
                  </Field>
                </FormGrid>

                <Field label="Shipping Policy">
                  <textarea
                    value={form.shippingPolicy}
                    onChange={(event) =>
                      setField(
                        "shippingPolicy",
                        event.target.value
                      )
                    }
                    style={shortTextareaStyle}
                  />
                </Field>

                <Field label="Return / Refund Policy">
                  <textarea
                    value={form.returnPolicy}
                    onChange={(event) =>
                      setField(
                        "returnPolicy",
                        event.target.value
                      )
                    }
                    style={shortTextareaStyle}
                  />
                </Field>
              </Panel>

              <Panel
                title="SEO"
                subtitle="Improve product visibility in Google and social media."
              >
                <Field label="SEO Title">
                  <input
                    value={form.seoTitle}
                    maxLength={70}
                    onChange={(event) =>
                      setField("seoTitle", event.target.value)
                    }
                    placeholder="Premium Product | NEW CITY STYLE"
                    style={inputStyle}
                  />

                  <CharacterCount
                    value={form.seoTitle.length}
                    maximum={70}
                  />
                </Field>

                <Field label="Meta Description">
                  <textarea
                    value={form.metaDescription}
                    maxLength={160}
                    onChange={(event) =>
                      setField(
                        "metaDescription",
                        event.target.value
                      )
                    }
                    placeholder="Write a Google-friendly product description..."
                    style={shortTextareaStyle}
                  />

                  <CharacterCount
                    value={form.metaDescription.length}
                    maximum={160}
                  />
                </Field>

                <Field label="SEO Keywords">
                  <input
                    value={form.seoKeywords}
                    onChange={(event) =>
                      setField(
                        "seoKeywords",
                        event.target.value
                      )
                    }
                    placeholder="shirt, mens shirt, cotton shirt"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Social Preview Image URL">
                  <input
                    value={form.socialPreviewUrl}
                    onChange={(event) =>
                      setField(
                        "socialPreviewUrl",
                        event.target.value
                      )
                    }
                    placeholder="Normally the main product image is used"
                    style={inputStyle}
                  />
                </Field>
              </Panel>

              <Panel
                title="Product Status"
                subtitle="Control product visibility and marketing badges."
              >
                <div className="status-toggle-grid">
                  <Toggle
                    label="Active Product"
                    description="Visible to customers"
                    value={form.isActive}
                    onChange={(value) =>
                      setField("isActive", value)
                    }
                  />

                  <Toggle
                    label="Featured Product"
                    description="Display in featured section"
                    value={form.isFeatured}
                    onChange={(value) =>
                      setField("isFeatured", value)
                    }
                  />

                  <Toggle
                    label="New Arrival"
                    description="Display new arrival badge"
                    value={form.isNewArrival}
                    onChange={(value) =>
                      setField("isNewArrival", value)
                    }
                  />

                  <Toggle
                    label="On Sale"
                    description="Include in sale and discount filters"
                    value={form.isOnSale}
                    onChange={(value) =>
                      setField("isOnSale", value)
                    }
                  />

                  <Toggle
                    label="Bestseller"
                    description="Display bestseller badge"
                    value={form.isBestseller}
                    onChange={(value) =>
                      setField("isBestseller", value)
                    }
                  />

                  <Toggle
                    label="Trending"
                    description="Display trending badge"
                    value={form.isTrending}
                    onChange={(value) =>
                      setField("isTrending", value)
                    }
                  />
                </div>
              </Panel>
            </div>

            <aside className="product-preview-sidebar">
              <section style={previewPanelStyle}>
                <p style={previewLabelStyle}>
                  LIVE PRODUCT PREVIEW
                </p>

                <div style={previewImageBoxStyle}>
                  {form.mainImage ? (
                    <img
                      src={form.mainImage}
                      alt={form.name || "Product preview"}
                      style={previewImageStyle}
                    />
                  ) : (
                    <div style={previewPlaceholderStyle}>
                      📦
                    </div>
                  )}

                  <div style={previewBadgeContainerStyle}>
                    {form.isNewArrival && (
                      <Badge label="NEW" />
                    )}

                    {form.isOnSale && (
                      <Badge label="SALE" />
                    )}

                    {form.isBestseller && (
                      <Badge label="BESTSELLER" />
                    )}

                    {form.isTrending && (
                      <Badge label="TRENDING" />
                    )}
                  </div>
                </div>

                <p style={previewCategoryStyle}>
                  {form.category || "Product Category"}
                </p>

                <h2 style={previewNameStyle}>
                  {form.name || "Product Name"}
                </h2>

                <p style={previewTaglineStyle}>
                  {form.tagline ||
                    "Product tagline will appear here."}
                </p>

                <div style={previewPriceRowStyle}>
                  <strong style={previewSellingPriceStyle}>
                    ₹
                    {Number(form.price || 0).toLocaleString(
                      "en-IN"
                    )}
                  </strong>

                  {Number(form.mrp || 0) >
                    Number(form.price || 0) && (
                    <>
                      <span style={previewMrpStyle}>
                        ₹
                        {Number(form.mrp).toLocaleString(
                          "en-IN"
                        )}
                      </span>

                      <span style={previewDiscountStyle}>
                        {form.discountPercent}% OFF
                      </span>
                    </>
                  )}
                </div>

                <PreviewInfo
                  label="Stock"
                  value={`${form.stock || 0} units`}
                />

                <PreviewInfo
                  label="Online Quantity"
                  value={
                    form.sellOnline
                      ? `${form.onlineStockLimit || 0} units`
                      : "Shop / POS only"
                  }
                />

                <PreviewInfo
                  label="Sizes"
                  value={
                    form.sizes.join(", ") || "Not selected"
                  }
                />

                <PreviewInfo
                  label="Brand"
                  value={form.brand || "Not added"}
                />
              </section>

              <section style={previewPanelStyle}>
                <h3 style={sideTitleStyle}>
                  Product Completion
                </h3>

                <CompletionRow
                  label="Basic Information"
                  complete={Boolean(
                    form.name &&
                      form.description &&
                      form.category
                  )}
                />

                <CompletionRow
                  label="Pricing"
                  complete={Number(form.price) > 0}
                />

                <CompletionRow
                  label="Inventory"
                  complete={Boolean(form.stock)}
                />

                <CompletionRow
                  label="Main Image"
                  complete={Boolean(form.mainImage)}
                />

                <CompletionRow
                  label="Variants"
                  complete={Boolean(form.sizes.length)}
                />

                <CompletionRow
                  label="SEO"
                  complete={Boolean(
                    form.seoTitle &&
                      form.metaDescription
                  )}
                />

                <CompletionRow
                  label="FAQs"
                  complete={form.faqs.some(
                    (faq) => faq.question && faq.answer
                  )}
                />
              </section>

              <button
                type="submit"
                disabled={saving || uploading}
                style={{
                  ...saveProductButtonStyle,
                  opacity:
                    saving || uploading ? 0.7 : 1,
                  cursor:
                    saving || uploading
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {saving
                  ? "Saving Product..."
                  : uploading
                    ? "Uploading Images..."
                    : linkedStockProduct
                      ? "Update Linked Stock Product"
                      : "Save Premium Product"}
              </button>
            </aside>
          </div>
        </form>
      </div>

      <style jsx global>{`
        .product-admin-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 390px;
          gap: 24px;
          align-items: start;
        }

        .product-preview-sidebar {
          position: sticky;
          top: 94px;
          display: grid;
          gap: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .status-toggle-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .mobile-sticky-save {
          position: sticky;
          top: 10px;
          z-index: 60;
          display: flex;
          justify-content: flex-end;
          pointer-events: none;
          margin: 0 0 14px;
        }

        .mobile-sticky-save-button {
          pointer-events: auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 44px;
          border: 1px solid #d4af37;
          border-radius: 999px;
          background: linear-gradient(135deg, #0a2e73, #164ca8);
          color: #ffffff;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 900;
          box-shadow: 0 10px 28px rgba(10, 46, 115, 0.3);
          cursor: pointer;
        }

        .mobile-sticky-save-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .existing-stock-search-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
        }

        .existing-stock-search-button {
          min-height: 46px;
          border: 1px solid #d4af37;
          border-radius: 10px;
          background: #0a2e73;
          color: #ffffff;
          padding: 0 18px;
          font-weight: 900;
          cursor: pointer;
        }

        .existing-stock-results {
          display: grid;
          gap: 9px;
          margin-top: 14px;
        }

        .existing-stock-results > button {
          display: grid;
          grid-template-columns: 58px minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #ffffff;
          padding: 10px;
          text-align: left;
          cursor: pointer;
        }

        .existing-stock-results > button:hover {
          border-color: #d4af37;
          background: #fffdf5;
        }

        .existing-stock-result-image {
          width: 58px;
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 10px;
          background: #f1f5f9;
          font-size: 24px;
        }

        .existing-stock-result-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .existing-stock-results strong,
        .existing-stock-results span,
        .existing-stock-results small {
          display: block;
        }

        .existing-stock-results strong {
          color: #0a2e73;
          font-size: 14px;
        }

        .existing-stock-results span {
          margin-top: 3px;
          color: #334155;
          font-size: 12px;
          font-weight: 800;
        }

        .existing-stock-results small {
          margin-top: 3px;
          color: #64748b;
        }

        .existing-stock-results b {
          color: #0a2e73;
        }

        .linked-stock-card {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-top: 14px;
          padding: 16px;
          border: 1px solid #86efac;
          border-radius: 14px;
          background: #f0fdf4;
        }

        .linked-stock-card span,
        .linked-stock-card strong,
        .linked-stock-card p {
          display: block;
        }

        .linked-stock-card span {
          color: #15803d;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.8px;
        }

        .linked-stock-card strong {
          margin-top: 4px;
          color: #0a2e73;
          font-size: 17px;
        }

        .linked-stock-card p {
          margin: 4px 0 0;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }

        .linked-stock-card button {
          border: 1px solid #fca5a5;
          border-radius: 9px;
          background: #ffffff;
          color: #dc2626;
          padding: 9px 13px;
          font-weight: 850;
          cursor: pointer;
        }

        .existing-stock-note,
        .inventory-lock-note {
          margin-top: 13px;
          padding: 11px 13px;
          border-radius: 10px;
          background: #fffbea;
          color: #7c5b00;
          font-size: 12px;
          font-weight: 700;
        }

        .inventory-online-toggle {
          min-height: 46px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #ffffff;
        }

        .inventory-online-toggle input {
          width: 20px;
          height: 20px;
          accent-color: #0a2e73;
        }

        .inventory-online-toggle strong,
        .inventory-online-toggle span {
          display: block;
        }

        .inventory-online-toggle strong {
          color: #0a2e73;
          font-size: 13px;
        }

        .inventory-online-toggle span {
          margin-top: 2px;
          color: #64748b;
          font-size: 10px;
        }

        @media (max-width: 1100px) {
          .product-admin-layout {
            grid-template-columns: 1fr;
          }

          .product-preview-sidebar {
            position: static;
          }
        }

        @media (max-width: 650px) {
          .form-grid,
          .status-toggle-grid {
            grid-template-columns: 1fr;
          }

          .existing-stock-search-row {
            grid-template-columns: 1fr;
          }

          .linked-stock-card {
            flex-direction: column;
          }

          .existing-stock-results > button {
            grid-template-columns: 52px minmax(0, 1fr);
          }

          .existing-stock-results > button > b {
            display: none;
          }

          .mobile-sticky-save {
            top: 8px;
            margin-bottom: 12px;
          }

          .mobile-sticky-save-button {
            min-width: 48px;
            min-height: 48px;
            padding: 10px 14px;
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
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: "17px" }}>
      <label style={fieldLabelStyle}>
        {label}
        {required && (
          <span style={{ color: "#DC2626" }}> *</span>
        )}
      </label>

      {children}
    </div>
  );
}

function FormGrid({ children }: { children: ReactNode }) {
  return <div className="form-grid">{children}</div>;
}

function MoneyInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <span style={moneySymbolStyle}>₹</span>

      <input
        type="number"
        min="0"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{
          ...inputStyle,
          paddingLeft: "34px",
        }}
      />
    </div>
  );
}

function UploadBox({
  uploading,
  label,
  description,
  multiple,
  onChange,
}: {
  uploading: boolean;
  label: string;
  description: string;
  multiple: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label style={uploadBoxStyle}>
      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        multiple={multiple}
        onChange={onChange}
        disabled={uploading}
        style={{ display: "none" }}
      />

      <span style={{ fontSize: "37px" }}>☁️</span>

      <strong style={{ color: "#0A2E73" }}>
        {uploading ? "Uploading..." : label}
      </strong>

      <span style={{ color: "#777", fontSize: "13px" }}>
        {description}
      </span>
    </label>
  );
}

function ImagePreview({
  image,
  onRemove,
  large = false,
}: {
  image: string;
  onRemove: () => void;
  large?: boolean;
}) {
  return (
    <div style={singleImagePreviewStyle}>
      <img
        src={image}
        alt="Product upload preview"
        style={{
          width: "100%",
          maxHeight: large ? "480px" : "250px",
          objectFit: "contain",
          borderRadius: "13px",
          background: "#F8FAFC",
        }}
      />

      <button
        type="button"
        onClick={onRemove}
        style={removeImageStyle}
      >
        Remove Image
      </button>
    </div>
  );
}

function ImageGrid({
  images,
  onRemove,
}: {
  images: string[];
  onRemove: (index: number) => void;
}) {
  if (!images.length) return null;

  return (
    <div style={imageGridStyle}>
      {images.map((image, index) => (
        <div key={`${image}-${index}`} style={imageTileStyle}>
          <img
            src={image}
            alt={`Product image ${index + 1}`}
            style={imageTileImageStyle}
          />

          <button
            type="button"
            onClick={() => onRemove(index)}
            style={imageRemoveIconStyle}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function ChipButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: selected ? "#0A2E73" : "#FFFFFF",
        color: selected ? "#FFFFFF" : "#0A2E73",
        border: selected
          ? "1px solid #0A2E73"
          : "1px solid #D1D5DB",
        borderRadius: "999px",
        padding: "10px 15px",
        cursor: "pointer",
        fontWeight: 700,
      }}
    >
      {label}
    </button>
  );
}

function InlineAdd({
  value,
  placeholder,
  buttonLabel,
  onChange,
  onAdd,
}: {
  value: string;
  placeholder: string;
  buttonLabel: string;
  onChange: (value: string) => void;
  onAdd: () => void;
}) {
  return (
    <div style={inlineAddStyle}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle}
      />

      <button
        type="button"
        onClick={onAdd}
        style={smallPrimaryButtonStyle}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function SelectedValues({
  values,
  onRemove,
}: {
  values: string[];
  onRemove: (value: string) => void;
}) {
  if (!values.length) return null;

  return (
    <div style={selectedValuesStyle}>
      {values.map((value) => (
        <span key={value} style={selectedValueStyle}>
          {value}

          <button
            type="button"
            onClick={() => onRemove(value)}
            style={selectedValueRemoveStyle}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

function DynamicRow({ children }: { children: ReactNode }) {
  return <div style={dynamicRowStyle}>{children}</div>;
}

function AddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={addButtonStyle}
    >
      + {label}
    </button>
  );
}

function RemoveButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={removeButtonStyle}
    >
      ×
    </button>
  );
}

function CharacterCount({
  value,
  maximum,
}: {
  value: number;
  maximum: number;
}) {
  return (
    <p style={characterCountStyle}>
      {value}/{maximum} characters
    </p>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      style={{
        ...toggleCardStyle,
        background: value ? "#F0FDF4" : "#FFFFFF",
        border: value
          ? "1px solid #86EFAC"
          : "1px solid #E5E7EB",
      }}
    >
      <div>
        <strong style={{ color: "#0A2E73" }}>
          {label}
        </strong>

        <p style={toggleDescriptionStyle}>
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          ...toggleSwitchStyle,
          background: value ? "#16A34A" : "#D1D5DB",
        }}
      >
        <span
          style={{
            ...toggleCircleStyle,
            left: value ? "28px" : "3px",
          }}
        />
      </button>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return <span style={badgeStyle}>{label}</span>;
}

function PreviewInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={previewInfoStyle}>
      <span style={{ color: "#777" }}>{label}</span>
      <strong
        style={{
          color: "#0A2E73",
          textAlign: "right",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function CompletionRow({
  label,
  complete,
}: {
  label: string;
  complete: boolean;
}) {
  return (
    <div style={completionRowStyle}>
      <span style={{ color: "#555", fontWeight: 700 }}>
        {label}
      </span>

      <span
        style={{
          ...completionBadgeStyle,
          background: complete ? "#DCFCE7" : "#FEE2E2",
          color: complete ? "#166534" : "#B91C1C",
        }}
      >
        {complete ? "Complete" : "Incomplete"}
      </span>
    </div>
  );
}

const mainStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#F8F4EC",
  padding: "30px 20px 90px",
};

const containerStyle: CSSProperties = {
  maxWidth: "1550px",
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
  borderRadius: "19px",
  padding: "24px",
  boxShadow: "0 8px 25px rgba(0,0,0,0.07)",
  border: "1px solid rgba(212,175,55,0.22)",
};

const panelTitleStyle: CSSProperties = {
  color: "#0A2E73",
  margin: "0 0 5px",
  fontSize: "23px",
};

const panelSubtitleStyle: CSSProperties = {
  color: "#777",
  margin: 0,
  fontSize: "13px",
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
  minHeight: "175px",
  resize: "vertical",
  lineHeight: 1.7,
};

const moneySymbolStyle: CSSProperties = {
  position: "absolute",
  left: "14px",
  top: "50%",
  transform: "translateY(-50%)",
  color: "#0A2E73",
  fontWeight: 800,
};

const pricingSummaryStyle: CSSProperties = {
  background: "#F0FDF4",
  color: "#166534",
  border: "1px solid #BBF7D0",
  borderRadius: "11px",
  padding: "14px",
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const uploadBoxStyle: CSSProperties = {
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
};

const singleImagePreviewStyle: CSSProperties = {
  marginTop: "17px",
  border: "1px solid #E5E7EB",
  borderRadius: "14px",
  padding: "12px",
  background: "#F8FAFC",
};

const removeImageStyle: CSSProperties = {
  width: "100%",
  marginTop: "10px",
  border: "1px solid #FCA5A5",
  background: "#FFFFFF",
  color: "#DC2626",
  borderRadius: "9px",
  padding: "10px",
  cursor: "pointer",
  fontWeight: 700,
};

const imageGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fill, minmax(130px, 1fr))",
  gap: "12px",
  marginTop: "17px",
};

const imageTileStyle: CSSProperties = {
  position: "relative",
  borderRadius: "12px",
  overflow: "hidden",
  border: "1px solid #E5E7EB",
  aspectRatio: "1 / 1",
  background: "#F3F4F6",
};

const imageTileImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const imageRemoveIconStyle: CSSProperties = {
  position: "absolute",
  top: "7px",
  right: "7px",
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  border: "none",
  background: "rgba(220,38,38,0.9)",
  color: "#FFFFFF",
  cursor: "pointer",
  fontSize: "18px",
};

const chipGridStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "9px",
  marginBottom: "16px",
};

const inlineAddStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "10px",
};

const smallPrimaryButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: "9px",
  background: "#0A2E73",
  color: "#FFFFFF",
  padding: "0 17px",
  cursor: "pointer",
  fontWeight: 800,
};

const selectedValuesStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "14px",
};

const selectedValueStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "7px",
  background: "#EEF2FF",
  color: "#0A2E73",
  borderRadius: "999px",
  padding: "7px 10px",
  fontWeight: 700,
};

const selectedValueRemoveStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#DC2626",
  cursor: "pointer",
  fontSize: "17px",
  padding: 0,
};

const dynamicRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr)) auto",
  gap: "10px",
  marginBottom: "11px",
};

const addButtonStyle: CSSProperties = {
  width: "100%",
  border: "1px dashed #0A2E73",
  background: "#EEF2FF",
  color: "#0A2E73",
  padding: "12px",
  borderRadius: "9px",
  cursor: "pointer",
  fontWeight: 800,
};

const removeButtonStyle: CSSProperties = {
  width: "43px",
  height: "43px",
  borderRadius: "9px",
  border: "1px solid #FCA5A5",
  background: "#FFFFFF",
  color: "#DC2626",
  cursor: "pointer",
  fontSize: "22px",
};

const faqCardStyle: CSSProperties = {
  background: "#F8FAFC",
  border: "1px solid #E5E7EB",
  borderRadius: "12px",
  padding: "15px",
  marginBottom: "13px",
};

const faqHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "11px",
};

const characterCountStyle: CSSProperties = {
  color: "#999",
  fontSize: "11px",
  textAlign: "right",
  margin: "5px 0 0",
};

const toggleCardStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "15px",
  borderRadius: "12px",
};

const toggleDescriptionStyle: CSSProperties = {
  color: "#777",
  margin: "4px 0 0",
  fontSize: "12px",
};

const toggleSwitchStyle: CSSProperties = {
  position: "relative",
  width: "56px",
  height: "31px",
  flexShrink: 0,
  border: "none",
  borderRadius: "999px",
  cursor: "pointer",
  padding: 0,
};

const toggleCircleStyle: CSSProperties = {
  position: "absolute",
  width: "25px",
  height: "25px",
  borderRadius: "50%",
  background: "#FFFFFF",
  top: "3px",
  boxShadow: "0 2px 7px rgba(0,0,0,0.2)",
  transition: "0.25s",
};

const previewPanelStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "19px",
  padding: "20px",
  boxShadow: "0 8px 25px rgba(0,0,0,0.07)",
  border: "1px solid rgba(212,175,55,0.22)",
};

const previewLabelStyle: CSSProperties = {
  color: "#D4AF37",
  fontWeight: 800,
  letterSpacing: "1px",
  margin: "0 0 13px",
};

const previewImageBoxStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: "4 / 5",
  background: "#F8FAFC",
  borderRadius: "14px",
  overflow: "hidden",
  marginBottom: "17px",
};

const previewImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const previewPlaceholderStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: "60px",
};

const previewBadgeContainerStyle: CSSProperties = {
  position: "absolute",
  left: "10px",
  top: "10px",
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
};

const badgeStyle: CSSProperties = {
  background: "#D4AF37",
  color: "#FFFFFF",
  borderRadius: "999px",
  padding: "6px 9px",
  fontSize: "10px",
  fontWeight: 900,
};

const previewCategoryStyle: CSSProperties = {
  color: "#D4AF37",
  fontWeight: 800,
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "1px",
  margin: "0 0 5px",
};

const previewNameStyle: CSSProperties = {
  color: "#0A2E73",
  margin: 0,
  fontSize: "24px",
};

const previewTaglineStyle: CSSProperties = {
  color: "#777",
  margin: "7px 0 14px",
  lineHeight: 1.5,
};

const previewPriceRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const previewSellingPriceStyle: CSSProperties = {
  color: "#0A2E73",
  fontSize: "25px",
};

const previewMrpStyle: CSSProperties = {
  color: "#999",
  textDecoration: "line-through",
};

const previewDiscountStyle: CSSProperties = {
  color: "#16A34A",
  fontWeight: 800,
};

const previewInfoStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  padding: "11px 0",
  borderBottom: "1px solid #E5E7EB",
};

const sideTitleStyle: CSSProperties = {
  color: "#0A2E73",
  margin: "0 0 14px",
};

const completionRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "11px 0",
  borderBottom: "1px solid #E5E7EB",
};

const completionBadgeStyle: CSSProperties = {
  padding: "5px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 800,
};

const aiGeneratorCardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "18px",
  flexWrap: "wrap",
  padding: "18px",
  border: "1px solid rgba(212, 175, 55, 0.55)",
  borderRadius: "18px",
  background:
    "linear-gradient(135deg, rgba(10, 46, 115, 0.06), rgba(248, 244, 236, 0.95))",
};

const aiGeneratorTitleStyle: CSSProperties = {
  display: "block",
  color: "#0A2E73",
  fontSize: "17px",
  lineHeight: 1.3,
};

const aiGeneratorTextStyle: CSSProperties = {
  margin: "7px 0 0",
  maxWidth: "680px",
  color: "#4B5563",
  fontSize: "14px",
  lineHeight: 1.6,
};

const aiGenerateButtonStyle: CSSProperties = {
  minHeight: "48px",
  padding: "12px 18px",
  border: "1px solid #D4AF37",
  borderRadius: "14px",
  background: "#0A2E73",
  color: "#FFFFFF",
  fontWeight: 800,
  fontSize: "14px",
  boxShadow: "0 10px 24px rgba(10, 46, 115, 0.18)",
};

const aiStatusStyle: CSSProperties = {
  marginTop: "14px",
  padding: "12px 14px",
  border: "1px solid",
  borderRadius: "12px",
  fontSize: "14px",
  lineHeight: 1.5,
  fontWeight: 650,
};

const saveProductButtonStyle: CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: "12px",
  background:
    "linear-gradient(135deg, #0A2E73, #164CA8)",
  color: "#FFFFFF",
  padding: "16px",
  fontSize: "16px",
  fontWeight: 900,
  boxShadow: "0 10px 25px rgba(10,46,115,0.25)",
};