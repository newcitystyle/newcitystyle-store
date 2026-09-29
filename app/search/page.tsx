"use client";



import { Suspense, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";



type Product = {

  id: string | number;

  name?: string | null;

  description?: string | null;

  category?: string | null;

  subcategory?: string | null;

  brand?: string | null;

  price?: number | string | null;

  mrp?: number | string | null;

  stock?: number | string | null;

  online_stock_limit?: number | string | null;

  sell_online?: boolean | null;

  is_active?: boolean | null;

  image?: string | null;

  image_url?: string | null;

  images?: string[] | string | null;

  size?: string | null;

  sizes?: string[] | string | null;

  color?: string | null;

  colors?: string[] | string | null;

  tags?: string[] | string | null;

  material?: string | null;

  gender?: string | null;

  is_new_arrival?: boolean | null;

  is_featured?: boolean | null;

  is_on_sale?: boolean | null;

  discount_percent?: number | string | null;

  created_at?: string | null;



  // Storefront-only fields for individual uploaded designs.

  listing_key?: string | null;

  design_unit_id?: number | null;

  design_name?: string | null;

  parent_name?: string | null;

  is_design_card?: boolean | null;

};



type ProductDesignUnit = {

  id: number;

  product_id: number;

  design_name?: string | null;

  image_url?: string | null;

  status?: string | null;

  sort_order?: number | null;

};



type ProductDesignLink = {

  id: number;

  product_id: number;

  design_unit_id: number;

  variant_id: number;

  status?: string | null;

};



type SortOption =

  | "relevance"

  | "newest"

  | "price-low"

  | "price-high"

  | "name-asc"

  | "name-desc"

  | "stock-high"

  | "discount-high";



type ToastState = {

  type: "success" | "error";

  message: string;

} | null;



function getProductImage(product: Product) {

  if (product.image_url) return product.image_url;

  if (product.image) return product.image;



  if (Array.isArray(product.images) && product.images.length > 0) {

    return product.images[0];

  }



  if (typeof product.images === "string" && product.images.trim()) {

    try {

      const parsed = JSON.parse(product.images);



      if (Array.isArray(parsed) && parsed.length > 0) {

        return parsed[0];

      }



      return product.images;

    } catch {

      return product.images;

    }

  }



  return "";

}



function getStringArray(value?: string[] | string | null) {

  if (!value) return [];



  if (Array.isArray(value)) {

    return value.map(String).map((item) => item.trim()).filter(Boolean);

  }



  try {

    const parsed = JSON.parse(value);



    if (Array.isArray(parsed)) {

      return parsed.map(String).map((item) => item.trim()).filter(Boolean);

    }

  } catch {

    // Continue with comma-separated fallback.

  }



  return value

    .split(",")

    .map((item) => item.trim())

    .filter(Boolean);

}



function getProductName(product: Product) {

  return product.name || "Untitled Product";

}



function getProductCardKey(product: Product) {

  return product.listing_key || String(product.id);

}



function getProductHref(product: Product) {

  return product.design_unit_id

    ? `/product/${product.id}?design=${product.design_unit_id}`

    : `/product/${product.id}`;

}



function getPrice(product: Product) {

  const value = Number(product.price ?? 0);

  return Number.isFinite(value) ? value : 0;

}



function getMrp(product: Product) {

  const value = Number(product.mrp ?? product.price ?? 0);

  return Number.isFinite(value) ? value : 0;

}



function getStock(product: Product) {

  const physicalStock = Number(product.stock ?? 0);

  const onlineStock = Number(product.online_stock_limit ?? 0);



  const safePhysicalStock =

    Number.isFinite(physicalStock) ? Math.max(0, physicalStock) : 0;



  const safeOnlineStock =

    Number.isFinite(onlineStock) ? Math.max(0, onlineStock) : 0;



  return Math.min(safePhysicalStock, safeOnlineStock);

}



function getDiscount(product: Product) {

  const savedDiscount = Number(product.discount_percent ?? 0);



  if (Number.isFinite(savedDiscount) && savedDiscount > 0) {

    return Math.round(savedDiscount);

  }



  const price = getPrice(product);

  const mrp = getMrp(product);



  if (mrp <= price || mrp <= 0) return 0;



  return Math.round(((mrp - price) / mrp) * 100);

}



function formatCurrency(value: number) {

  return new Intl.NumberFormat("en-IN", {

    style: "currency",

    currency: "INR",

    maximumFractionDigits: 0,

  }).format(value);

}



function SearchPageContent() {

  const router = useRouter();

  const searchParams = useSearchParams();

  const query = searchParams.get("q")?.trim() || "";



  const [products, setProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");



  const [categoryFilter, setCategoryFilter] = useState("all");

  const [brandFilter, setBrandFilter] = useState("all");

  const [stockFilter, setStockFilter] = useState("all");

  const [sizeFilter, setSizeFilter] = useState("all");

  const [colorFilter, setColorFilter] = useState("all");

  const [materialFilter, setMaterialFilter] = useState("all");

  const [genderFilter, setGenderFilter] = useState("all");

  const [tagFilter, setTagFilter] = useState("all");

  const [newArrivalOnly, setNewArrivalOnly] = useState(false);

  const [featuredOnly, setFeaturedOnly] = useState(false);

  const [onSaleOnly, setOnSaleOnly] = useState(false);

  const [discountFilter, setDiscountFilter] = useState("all");

  const [sortOption, setSortOption] = useState<SortOption>("relevance");

  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);



  const [maxPrice, setMaxPrice] = useState(5000);

  const [priceLimit, setPriceLimit] = useState(5000);

  const [visibleCount, setVisibleCount] = useState(12);



  const [busyProductId, setBusyProductId] = useState<

    string | number | null

  >(null);



  const [toast, setToast] = useState<ToastState>(null);



  useEffect(() => {

    loadProducts();

  }, [query]);



  useEffect(() => {

    if (!toast) return;



    const timer = window.setTimeout(() => {

      setToast(null);

    }, 3000);



    return () => window.clearTimeout(timer);

  }, [toast]);



  async function loadProducts() {

    setLoading(true);

    setErrorMessage("");

    setVisibleCount(12);



    try {

      const { data, error } = await supabase

        .from("products")

        .select("*")

        .eq("sell_online", true)

        .eq("is_active", true)

        .gt("stock", 0)

        .gt("online_stock_limit", 0)

        .order("id", { ascending: false });



      if (error) throw error;



      const parentProducts = ((data as Product[]) || []).filter((product) =>

        product.sell_online === true &&

        product.is_active === true &&

        Number(product.stock ?? 0) > 0 &&

        Number(product.online_stock_limit ?? 0) > 0

      );



      const productIds = parentProducts

        .map((product) => Number(product.id))

        .filter((id) => Number.isFinite(id) && id > 0);



      let designUnits: ProductDesignUnit[] = [];

      let designLinks: ProductDesignLink[] = [];



      if (productIds.length > 0) {

        const [designResponse, linkResponse] = await Promise.all([

          supabase

            .from("product_design_units")

            .select("id,product_id,design_name,image_url,status,sort_order")

            .in("product_id", productIds)

            .neq("status", "hidden")

            .order("sort_order", { ascending: true })

            .order("id", { ascending: true }),



          supabase

            .from("product_design_unit_variants")

            .select("id,product_id,design_unit_id,variant_id,status")

            .in("product_id", productIds)

            .neq("status", "hidden"),

        ]);



        if (designResponse.error) {

          console.info("Search design units error:", designResponse.error.message);

        } else {

          designUnits = (designResponse.data || []) as ProductDesignUnit[];

        }



        if (linkResponse.error) {

          console.info("Search design links error:", linkResponse.error.message);

        } else {

          designLinks = (linkResponse.data || []) as ProductDesignLink[];

        }

      }



      const expandedProducts: Product[] = [];



      for (const parent of parentProducts) {

        const parentId = Number(parent.id);

        const parentName = getProductName(parent);



        const availableDesigns = designUnits

          .filter((design) =>

            Number(design.product_id) === parentId &&

            design.status !== "hidden" &&

            design.status !== "sold_out" &&

            Boolean(design.image_url?.trim()) &&

            designLinks.some((link) =>

              Number(link.design_unit_id) === Number(design.id) &&

              link.status === "available"

            )

          )

          .sort((a, b) => {

            const orderDiff = Number(a.sort_order || 0) - Number(b.sort_order || 0);

            return orderDiff !== 0 ? orderDiff : Number(a.id) - Number(b.id);

          });



        if (availableDesigns.length > 0) {

          availableDesigns.forEach((design, index) => {

            expandedProducts.push({

              ...parent,

              name: design.design_name?.trim() || `${parentName} Design ${index + 1}`,

              parent_name: parentName,

              image_url: design.image_url?.trim() || getProductImage(parent),

              image: design.image_url?.trim() || getProductImage(parent),

              stock: 1,

              online_stock_limit: 1,

              listing_key: `product-${parentId}-design-${design.id}`,

              design_unit_id: Number(design.id),

              design_name: design.design_name?.trim() || `Design ${index + 1}`,

              is_design_card: true,

            });

          });

          continue;

        }



        expandedProducts.push({

          ...parent,

          listing_key: `product-${parentId}`,

          design_unit_id: null,

          design_name: null,

          parent_name: null,

          is_design_card: false,

        });

      }



      const normalizedQuery = query.toLowerCase();



      const allProducts = expandedProducts.filter((product) => {

        if (!query) return true;



        return [

          product.name,

          product.parent_name,

          product.design_name,

          product.description,

          product.category,

          product.subcategory,

          product.brand,

          product.color,

          product.size,

          product.material,

          product.gender,

          ...getStringArray(product.tags),

        ]

          .filter(Boolean)

          .join(" ")

          .toLowerCase()

          .includes(normalizedQuery);

      });



      const highestPrice = Math.max(

        1000,

        ...allProducts.map((product) => getPrice(product))

      );



      setMaxPrice(Math.ceil(highestPrice / 500) * 500);

      setPriceLimit(Math.ceil(highestPrice / 500) * 500);

      setProducts(allProducts);

    } catch (error) {

      console.error("Search page error:", error);



      setErrorMessage(

        error instanceof Error

          ? error.message

          : "Unable to search products."

      );

    } finally {

      setLoading(false);

    }

  }



  async function addToWishlist(product: Product) {

    setBusyProductId(getProductCardKey(product));



    try {

      const {

        data: { user },

      } = await supabase.auth.getUser();



      if (!user) {

        setToast({

          type: "error",

          message: "Please login first.",

        });



        router.push("/login");

        return;

      }



      const { data: existing, error: existingError } = await supabase

        .from("wishlist")

        .select("id")

        .eq("user_id", user.id)

        .eq("product_id", product.id)

        .eq("image", getProductImage(product))

        .limit(1)

        .maybeSingle();



      if (existingError) throw existingError;



      if (existing) {

        setToast({

          type: "success",

          message: "Product is already in your wishlist.",

        });

        return;

      }



      const { error } = await supabase.from("wishlist").insert({

        user_id: user.id,

        product_id: product.id,

        name: getProductName(product),

        image: getProductImage(product),

        price: getPrice(product),

      });



      if (error) throw error;



      setToast({

        type: "success",

        message: "Added to wishlist.",

      });

    } catch (error) {

      console.error("Wishlist error:", error);



      setToast({

        type: "error",

        message:

          error instanceof Error

            ? error.message

            : "Unable to add to wishlist.",

      });

    } finally {

      setBusyProductId(null);

    }

  }



  async function addToCart(product: Product) {

    if (product.design_unit_id) {

      router.push(getProductHref(product));

      return;

    }



    setBusyProductId(getProductCardKey(product));



    try {

      const {

        data: { user },

      } = await supabase.auth.getUser();



      if (!user) {

        setToast({

          type: "error",

          message: "Please login first.",

        });



        router.push("/login");

        return;

      }



      const { data: existing, error: existingError } = await supabase

        .from("cart")

        .select("*")

        .eq("user_id", user.id)

        .eq("product_id", product.id)

        .maybeSingle();



      if (existingError) throw existingError;



      if (existing) {

        const { error: updateError } = await supabase

          .from("cart")

          .update({

            quantity: Number(existing.quantity || 0) + 1,

          })

          .eq("id", existing.id);



        if (updateError) throw updateError;

      } else {

        const productSizes = getStringArray(product.sizes);

        const productColors = getStringArray(product.colors);



        const { error: insertError } = await supabase.from("cart").insert({

          user_id: user.id,

          product_id: product.id,

          name: getProductName(product),

          image: getProductImage(product),

          price: getPrice(product),

          quantity: 1,

          size: product.size || productSizes[0] || "M",

          color: product.color || productColors[0] || "Blue",

        });



        if (insertError) throw insertError;

      }



      setToast({

        type: "success",

        message: "Product added to cart.",

      });

    } catch (error) {

      console.error("Cart error:", error);



      setToast({

        type: "error",

        message:

          error instanceof Error

            ? error.message

            : "Unable to add product to cart.",

      });

    } finally {

      setBusyProductId(null);

    }

  }



  const categories = useMemo(() => {

    return Array.from(

      new Set(

        products

          .flatMap((product) => [

            product.category || "",

            product.subcategory || "",

          ])

          .map((value) => String(value).trim())

          .filter(Boolean)

      )

    ).sort((a, b) => a.localeCompare(b));

  }, [products]);



  const brands = useMemo(() => {

    return Array.from(

      new Set(

        products

          .map((product) => String(product.brand || "").trim())

          .filter(Boolean)

      )

    ).sort((a, b) => a.localeCompare(b));

  }, [products]);



  const sizes = useMemo(() => {

    return Array.from(

      new Set(

        products.flatMap((product) => [

          ...(product.size ? [product.size] : []),

          ...getStringArray(product.sizes),

        ])

      )

    ).sort((a, b) => a.localeCompare(b));

  }, [products]);



  const colors = useMemo(() => {

    return Array.from(

      new Set(

        products.flatMap((product) => [

          ...(product.color ? [product.color] : []),

          ...getStringArray(product.colors),

        ])

      )

    ).sort((a, b) => a.localeCompare(b));

  }, [products]);



  const materials = useMemo(() => {

    return Array.from(

      new Set(

        products

          .map((product) => String(product.material || "").trim())

          .filter(Boolean)

      )

    ).sort((a, b) => a.localeCompare(b));

  }, [products]);



  const genders = useMemo(() => {

    return Array.from(

      new Set(

        products

          .map((product) => String(product.gender || "").trim())

          .filter(Boolean)

      )

    ).sort((a, b) => a.localeCompare(b));

  }, [products]);



  const tags = useMemo(() => {

    return Array.from(

      new Set(products.flatMap((product) => getStringArray(product.tags)))

    ).sort((a, b) => a.localeCompare(b));

  }, [products]);



  const visibleProducts = useMemo(() => {

    const filtered = products.filter((product) => {

      const category = String(product.category || "").toLowerCase();

      const subcategory = String(product.subcategory || "").toLowerCase();

      const brand = String(product.brand || "").toLowerCase();

      const material = String(product.material || "").toLowerCase();

      const gender = String(product.gender || "").toLowerCase();

      const productTags = getStringArray(product.tags).map((item) =>

        item.toLowerCase()

      );

      const stock = getStock(product);

      const price = getPrice(product);

      const discount = getDiscount(product);



      const productSizes = [

        ...(product.size ? [product.size] : []),

        ...getStringArray(product.sizes),

      ].map((item) => item.toLowerCase());



      const productColors = [

        ...(product.color ? [product.color] : []),

        ...getStringArray(product.colors),

      ].map((item) => item.toLowerCase());



      const matchesCategory =

        categoryFilter === "all" ||

        category === categoryFilter.toLowerCase() ||

        subcategory === categoryFilter.toLowerCase();



      const matchesBrand =

        brandFilter === "all" ||

        brand === brandFilter.toLowerCase();



      const matchesSize =

        sizeFilter === "all" ||

        productSizes.includes(sizeFilter.toLowerCase());



      const matchesColor =

        colorFilter === "all" ||

        productColors.includes(colorFilter.toLowerCase());



      const matchesMaterial =

        materialFilter === "all" ||

        material === materialFilter.toLowerCase();



      const matchesGender =

        genderFilter === "all" ||

        gender === genderFilter.toLowerCase();



      const matchesTag =

        tagFilter === "all" ||

        productTags.includes(tagFilter.toLowerCase());



      const matchesNewArrival =

        !newArrivalOnly || product.is_new_arrival === true;



      const matchesFeatured =

        !featuredOnly || product.is_featured === true;



      const matchesOnSale =

        !onSaleOnly || product.is_on_sale === true || discount > 0;



      const matchesPrice = price <= priceLimit;



      let matchesStock = true;



      if (stockFilter === "in-stock") {

        matchesStock = stock > 0;

      } else if (stockFilter === "out-of-stock") {

        matchesStock = stock <= 0;

      } else if (stockFilter === "low-stock") {

        matchesStock = stock > 0 && stock <= 5;

      }



      let matchesDiscount = true;



      if (discountFilter === "10") {

        matchesDiscount = discount >= 10;

      } else if (discountFilter === "20") {

        matchesDiscount = discount >= 20;

      } else if (discountFilter === "30") {

        matchesDiscount = discount >= 30;

      } else if (discountFilter === "40") {

        matchesDiscount = discount >= 40;

      } else if (discountFilter === "50") {

        matchesDiscount = discount >= 50;

      }



      return (

        matchesCategory &&

        matchesBrand &&

        matchesSize &&

        matchesColor &&

        matchesMaterial &&

        matchesGender &&

        matchesTag &&

        matchesNewArrival &&

        matchesFeatured &&

        matchesOnSale &&

        matchesPrice &&

        matchesStock &&

        matchesDiscount

      );

    });



    return [...filtered].sort((a, b) => {

      const priceA = getPrice(a);

      const priceB = getPrice(b);

      const nameA = getProductName(a).toLowerCase();

      const nameB = getProductName(b).toLowerCase();

      const stockA = getStock(a);

      const stockB = getStock(b);

      const discountA = getDiscount(a);

      const discountB = getDiscount(b);



      switch (sortOption) {

        case "newest":

          return (

            new Date(b.created_at || 0).getTime() -

            new Date(a.created_at || 0).getTime()

          );



        case "price-low":

          return priceA - priceB;



        case "price-high":

          return priceB - priceA;



        case "name-asc":

          return nameA.localeCompare(nameB);



        case "name-desc":

          return nameB.localeCompare(nameA);



        case "stock-high":

          return stockB - stockA;



        case "discount-high":

          return discountB - discountA;



        case "relevance":

        default:

          return 0;

      }

    });

  }, [

    products,

    categoryFilter,

    brandFilter,

    stockFilter,

    sizeFilter,

    colorFilter,

    materialFilter,

    genderFilter,

    tagFilter,

    newArrivalOnly,

    featuredOnly,

    onSaleOnly,

    discountFilter,

    priceLimit,

    sortOption,

  ]);



  const displayedProducts = visibleProducts.slice(0, visibleCount);



  function clearFilters() {

    setCategoryFilter("all");

    setBrandFilter("all");

    setStockFilter("all");

    setSizeFilter("all");

    setColorFilter("all");

    setMaterialFilter("all");

    setGenderFilter("all");

    setTagFilter("all");

    setNewArrivalOnly(false);

    setFeaturedOnly(false);

    setOnSaleOnly(false);

    setDiscountFilter("all");

    setSortOption("relevance");

    setPriceLimit(maxPrice);

    setVisibleCount(12);

  }



  const activeFilterCount = [

    categoryFilter !== "all",

    brandFilter !== "all",

    sizeFilter !== "all",

    colorFilter !== "all",

    materialFilter !== "all",

    genderFilter !== "all",

    tagFilter !== "all",

    stockFilter !== "all",

    discountFilter !== "all",

    newArrivalOnly,

    featuredOnly,

    onSaleOnly,

    priceLimit < maxPrice,

  ].filter(Boolean).length;



  const filterControls = (

    <>

      <FilterSelect

        label="Category"

        value={categoryFilter}

        onChange={setCategoryFilter}

        options={categories}

        defaultLabel="All Categories"

      />



      <FilterSelect

        label="Brand"

        value={brandFilter}

        onChange={setBrandFilter}

        options={brands}

        defaultLabel="All Brands"

      />



      <FilterSelect

        label="Size"

        value={sizeFilter}

        onChange={setSizeFilter}

        options={sizes}

        defaultLabel="All Sizes"

      />



      <FilterSelect

        label="Color"

        value={colorFilter}

        onChange={setColorFilter}

        options={colors}

        defaultLabel="All Colors"

      />



      <FilterSelect

        label="Material"

        value={materialFilter}

        onChange={setMaterialFilter}

        options={materials}

        defaultLabel="All Materials"

      />



      <FilterSelect

        label="Gender"

        value={genderFilter}

        onChange={setGenderFilter}

        options={genders}

        defaultLabel="All Genders"

      />



      <FilterSelect

        label="Tags"

        value={tagFilter}

        onChange={setTagFilter}

        options={tags}

        defaultLabel="All Tags"

      />



      <div className="filterBlock">

        <label>Stock Status</label>

        <select

          value={stockFilter}

          onChange={(event) => setStockFilter(event.target.value)}

        >

          <option value="all">All Stock</option>

          <option value="in-stock">In Stock</option>

          <option value="low-stock">Low Stock</option>

          <option value="out-of-stock">Out of Stock</option>

        </select>

      </div>



      <div className="filterBlock">

        <label>Minimum Discount</label>

        <select

          value={discountFilter}

          onChange={(event) => setDiscountFilter(event.target.value)}

        >

          <option value="all">All Discounts</option>

          <option value="10">10% and above</option>

          <option value="20">20% and above</option>

          <option value="30">30% and above</option>

          <option value="40">40% and above</option>

          <option value="50">50% and above</option>

        </select>

      </div>



      <div className="premiumToggleGroup">

        <span className="toggleGroupTitle">Premium Collections</span>



        <label className="toggleRow">

          <input

            type="checkbox"

            checked={newArrivalOnly}

            onChange={(event) => setNewArrivalOnly(event.target.checked)}

          />

          <span>New Arrivals</span>

        </label>



        <label className="toggleRow">

          <input

            type="checkbox"

            checked={featuredOnly}

            onChange={(event) => setFeaturedOnly(event.target.checked)}

          />

          <span>Featured Products</span>

        </label>



        <label className="toggleRow">

          <input

            type="checkbox"

            checked={onSaleOnly}

            onChange={(event) => setOnSaleOnly(event.target.checked)}

          />

          <span>On Sale</span>

        </label>

      </div>



      <div className="priceBlock">

        <div className="priceHeader">

          <label>Maximum Price</label>

          <strong>{formatCurrency(priceLimit)}</strong>

        </div>



        <input

          type="range"

          min="0"

          max={maxPrice}

          step="100"

          value={priceLimit}

          onChange={(event) => setPriceLimit(Number(event.target.value))}

        />



        <div className="priceScale">

          <span>₹0</span>

          <span>{formatCurrency(maxPrice)}</span>

        </div>

      </div>

    </>

  );



  if (loading) {
    return (
      <main className="statePage">
        <div className="loaderShell">
          <div className="loader" />
          <span>NEW CITY STYLE</span>
          <h2>Building Your Shopping Results</h2>
          <p>Loading live products, designs and availability…</p>
        </div>

        <style jsx>{`
          .statePage {
            min-height: 72vh;
            display: grid;
            place-items: center;
            padding: 30px;
            background:
              radial-gradient(circle at 80% 20%, rgba(212,175,55,.12), transparent 25%),
              #f7f9fc;
            color: #0a2e73;
            text-align: center;
          }

          .loaderShell {
            width: min(520px, 100%);
            padding: 34px;
            border: 1px solid rgba(10,46,115,.08);
            border-radius: 22px;
            background: #fff;
            box-shadow: 0 18px 50px rgba(16,24,40,.08);
          }

          .loader {
            width: 48px;
            height: 48px;
            margin: 0 auto 18px;
            border: 4px solid #e7eaf0;
            border-top-color: #d4af37;
            border-radius: 50%;
            animation: spin .8s linear infinite;
          }

          .loaderShell > span {
            color: #d4af37;
            font-size: 9px;
            font-weight: 950;
            letter-spacing: 1.8px;
          }

          h2 {
            margin: 9px 0 0;
            font-size: 27px;
          }

          p {
            margin: 9px 0 0;
            color: #667085;
            font-size: 12px;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="page">
      {toast && (
        <div className={`toast ${toast.type}`}>
          <strong>{toast.type === "success" ? "✓" : "!"}</strong>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="ambientGrid" />
      <div className="ambientGlow glowOne" />
      <div className="ambientGlow glowTwo" />

      <div className="container">
        <section className="searchHero">
          <div className="heroCopy">
            <span className="eyebrow">NEW CITY STYLE • PRODUCT DISCOVERY</span>

            <h1>
              Find Your
              <strong>Next Style</strong>
            </h1>

            <p>
              Search live online products, individual designs, categories,
              brands, colours, sizes and more.
            </p>

            <form
              className="heroSearch"
              onSubmit={(event) => {
                event.preventDefault();

                const form = new FormData(event.currentTarget);
                const value = String(form.get("q") || "").trim();

                if (value) {
                  try {
                    localStorage.setItem("ncs_ai_last_query", value);
                  } catch {}

                  router.push(`/search?q=${encodeURIComponent(value)}`);
                } else {
                  router.push("/search");
                }
              }}
            >
              <span>⌕</span>

              <input
                name="q"
                defaultValue={query}
                placeholder="Try: black shirt under ₹1200, size L"
                aria-label="Search NEW CITY STYLE"
              />

              <button type="submit">Search</button>
            </form>

            <div className="quickQueries">
              {["Men", "Women", "Kids", "Shirts", "New Arrivals"].map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() =>
                    router.push(`/search?q=${encodeURIComponent(item)}`)
                  }
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="heroStats">
            <div>
              <span>{visibleProducts.length}</span>
              <small>Matching</small>
            </div>

            <div>
              <span>{products.length}</span>
              <small>Loaded</small>
            </div>

            <div>
              <span>{activeFilterCount}</span>
              <small>Filters</small>
            </div>

            <p>
              {query ? (
                <>
                  Results for <strong>“{query}”</strong>
                </>
              ) : (
                <>
                  Browsing <strong>all live products</strong>
                </>
              )}
            </p>
          </div>
        </section>

        <section className="discoveryRail">
          <div>
            <span className="liveDot" />
            <p>
              <b>LIVE CATALOGUE</b>
              <small>Only active online products</small>
            </p>
          </div>

          <div>
            <span>◫</span>
            <p>
              <b>DESIGN AWARE</b>
              <small>Uploaded designs appear separately</small>
            </p>
          </div>

          <div>
            <span>⇅</span>
            <p>
              <b>SMART FILTERING</b>
              <small>Category, size, colour, price and more</small>
            </p>
          </div>
        </section>

        {errorMessage && (
          <div className="alert">
            <strong>!</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        <section className="layout">
          <aside className="sidebar">
            <div className="sidebarHeader">
              <div>
                <span>DISCOVERY FILTERS</span>
                <h2>Refine Results</h2>
              </div>

              <button type="button" onClick={clearFilters}>
                Reset
              </button>
            </div>

            <div className="filterSummary">
              <strong>{activeFilterCount}</strong>
              <span>active filters</span>
            </div>

            {filterControls}

            <button
              type="button"
              className="clearFiltersButton"
              onClick={clearFilters}
            >
              Clear All Filters
            </button>
          </aside>

          <div
            className={`mobileDrawerOverlay ${
              isFilterDrawerOpen ? "open" : ""
            }`}
            onClick={() => setIsFilterDrawerOpen(false)}
            aria-hidden={!isFilterDrawerOpen}
          />

          <aside
            className={`mobileFilterDrawer ${
              isFilterDrawerOpen ? "open" : ""
            }`}
            aria-hidden={!isFilterDrawerOpen}
          >
            <div className="mobileDrawerHeader">
              <div>
                <span>NEW CITY STYLE</span>
                <h2>Product Filters</h2>
              </div>

              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                aria-label="Close filters"
              >
                ×
              </button>
            </div>

            <div className="mobileDrawerBody">{filterControls}</div>

            <div className="mobileDrawerFooter">
              <button
                type="button"
                className="drawerReset"
                onClick={clearFilters}
              >
                Reset
              </button>

              <button
                type="button"
                className="drawerApply"
                onClick={() => setIsFilterDrawerOpen(false)}
              >
                Show {visibleProducts.length} Products
              </button>
            </div>
          </aside>

          <section className="resultsArea">
            <div className="toolbar">
              <div className="resultSummary">
                <span className="summaryEyebrow">SHOPPING RESULTS</span>
                <div>
                  <strong>{visibleProducts.length}</strong>
                  <span> matching products</span>
                </div>
              </div>

              <button
                type="button"
                className="mobileFilterButton"
                onClick={() => setIsFilterDrawerOpen(true)}
              >
                <span>Filters</span>
                {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
              </button>

              <label>
                <span>Sort</span>

                <select
                  value={sortOption}
                  onChange={(event) =>
                    setSortOption(event.target.value as SortOption)
                  }
                >
                  <option value="relevance">Relevance</option>
                  <option value="newest">Newest First</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="discount-high">Highest Discount</option>
                  <option value="name-asc">Name: A to Z</option>
                  <option value="name-desc">Name: Z to A</option>
                  <option value="stock-high">Stock: High to Low</option>
                </select>
              </label>
            </div>

            {visibleProducts.length === 0 ? (
              <section className="emptyState">
                <div className="emptyIcon">⌕</div>
                <span>NO MATCH FOUND</span>
                <h2>Try A Different Search</h2>

                <p>
                  Change the search term or remove some filters to discover more
                  NEW CITY STYLE products.
                </p>

                <div className="emptyActions">
                  <button type="button" onClick={clearFilters}>
                    Clear Filters
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push("/search")}
                  >
                    Browse All
                  </button>
                </div>
              </section>
            ) : (
              <>
                <section className="productGrid">
                  {displayedProducts.map((product, index) => {
                    const image = getProductImage(product);
                    const name = getProductName(product);
                    const price = getPrice(product);
                    const mrp = getMrp(product);
                    const stock = getStock(product);
                    const savings = Math.max(mrp - price, 0);
                    const discount = getDiscount(product);
                    const isBusy =
                      busyProductId === getProductCardKey(product);

                    const productSizes = Array.from(
                      new Set([
                        ...(product.size ? [String(product.size)] : []),
                        ...getStringArray(product.sizes),
                      ])
                    ).filter(Boolean);

                    return (
                      <article
                        key={getProductCardKey(product)}
                        className="productCard"
                      >
                        <div className="imageWrap">
                          <Link href={getProductHref(product)}>
                            {image ? (
                              <img
                                src={image}
                                alt={name}
                                loading={index < 4 ? "eager" : "lazy"}
                              />
                            ) : (
                              <div className="imageFallback">
                                <span>NCS</span>
                                <small>NEW CITY STYLE</small>
                              </div>
                            )}
                          </Link>

                          <span className="cardNumber">
                            {String(index + 1).padStart(2, "0")}
                          </span>

                          {product.is_new_arrival && (
                            <span className="newBadge">NEW</span>
                          )}

                          {product.is_featured && (
                            <span className="featuredBadge">FEATURED</span>
                          )}

                          {product.is_design_card && (
                            <span className="designBadge">DESIGN</span>
                          )}

                          {discount > 0 && (
                            <span className="discountBadge">
                              {discount}% OFF
                            </span>
                          )}

                          <button
                            type="button"
                            className="wishlistButton"
                            disabled={isBusy}
                            onClick={() => addToWishlist(product)}
                            aria-label={`Add ${name} to wishlist`}
                          >
                            ♥
                          </button>

                          <Link
                            href={getProductHref(product)}
                            className="quickView"
                          >
                            Quick View
                          </Link>
                        </div>

                        <div className="productBody">
                          <div className="productMeta">
                            <span className="category">
                              {product.category ||
                                product.subcategory ||
                                "Fashion"}
                            </span>

                            <span className="availability">
                              <i />
                              {stock > 0 ? "Online" : "Unavailable"}
                            </span>
                          </div>

                          <Link
                            href={getProductHref(product)}
                            className="productName"
                          >
                            {name}
                          </Link>

                          {product.parent_name && (
                            <span className="parentName">
                              {product.parent_name}
                            </span>
                          )}

                          {productSizes.length > 0 && (
                            <div className="sizeChips">
                              {productSizes.slice(0, 5).map((size) => (
                                <span key={size}>{size}</span>
                              ))}
                            </div>
                          )}

                          <div className="priceRow">
                            <strong>{formatCurrency(price)}</strong>

                            {mrp > price && (
                              <del>{formatCurrency(mrp)}</del>
                            )}
                          </div>

                          {savings > 0 && (
                            <p className="saveText">
                              Save {formatCurrency(savings)}
                            </p>
                          )}

                          <p className="description">
                            {product.description ||
                              "Premium fashion selected for comfort and style."}
                          </p>

                          <div className="cardActions">
                            <button
                              type="button"
                              disabled={isBusy || stock <= 0}
                              onClick={() => addToCart(product)}
                            >
                              {isBusy
                                ? "Please Wait..."
                                : stock <= 0
                                  ? "Unavailable"
                                  : product.design_unit_id
                                    ? "Choose Options"
                                    : "Add to Cart"}
                            </button>

                            <Link href={getProductHref(product)}>
                              View →
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </section>

                {visibleCount < visibleProducts.length && (
                  <div className="loadMoreWrap">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleCount((count) => count + 12)
                      }
                    >
                      <span>Load More Products</span>
                      <b>
                        {displayedProducts.length} / {visibleProducts.length}
                      </b>
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </section>
      </div>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          background: #f7f9fc;
          color: #172033;
          font-family: Inter, Poppins, Arial, sans-serif;
        }

        button,
        input,
        select {
          font: inherit;
        }

        .page {
          position: relative;
          overflow: hidden;
          min-height: 100vh;
          padding: 40px 20px 86px;
          background:
            radial-gradient(circle at 93% 4%, rgba(212,175,55,.11), transparent 24%),
            radial-gradient(circle at 2% 85%, rgba(10,46,115,.07), transparent 24%),
            #f7f9fc;
        }

        .container {
          position: relative;
          z-index: 3;
          width: min(1500px, 100%);
          margin: 0 auto;
        }

        .ambientGrid {
          position: absolute;
          inset: 0;
          opacity: .035;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(10,46,115,.18) 1px, transparent 1px),
            linear-gradient(90deg, rgba(10,46,115,.18) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: linear-gradient(180deg, rgba(0,0,0,.8), transparent 88%);
        }

        .ambientGlow {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
        }

        .glowOne {
          top: -90px;
          right: -110px;
          width: 340px;
          height: 340px;
          background: rgba(212,175,55,.1);
        }

        .glowTwo {
          left: -150px;
          bottom: 20px;
          width: 380px;
          height: 380px;
          background: rgba(10,46,115,.06);
        }

        .toast {
          position: fixed;
          top: 92px;
          right: 20px;
          z-index: 5000;
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: 390px;
          padding: 13px 16px;
          border-radius: 12px;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          box-shadow: 0 18px 40px rgba(16,24,40,.22);
        }

        .toast.success {
          background: #067647;
        }

        .toast.error {
          background: #b42318;
        }

        .searchHero {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(280px, .55fr);
          gap: 26px;
          overflow: hidden;
          padding: 32px;
          border: 1px solid rgba(212,175,55,.25);
          border-radius: 25px;
          background:
            radial-gradient(circle at 88% 18%, rgba(212,175,55,.18), transparent 28%),
            linear-gradient(135deg, #071a3f, #0a2e73 60%, #164b9d);
          color: #fff;
          box-shadow: 0 24px 60px rgba(10,46,115,.15);
        }

        .heroCopy {
          min-width: 0;
        }

        .eyebrow {
          color: #e7cb68;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 1.8px;
        }

        .searchHero h1 {
          margin: 8px 0 0;
          font-size: clamp(42px, 5.5vw, 70px);
          line-height: .98;
          letter-spacing: -2.4px;
        }

        .searchHero h1 strong {
          display: block;
          color: #d4af37;
        }

        .heroCopy > p {
          max-width: 720px;
          margin: 16px 0 0;
          color: rgba(255,255,255,.65);
          font-size: 13px;
          line-height: 1.7;
        }

        .heroSearch {
          max-width: 760px;
          min-height: 52px;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          margin-top: 23px;
          padding: 5px 5px 5px 10px;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 14px;
          background: rgba(255,255,255,.1);
          backdrop-filter: blur(12px);
        }

        .heroSearch > span {
          color: #e7cb68;
          font-size: 17px;
          text-align: center;
        }

        .heroSearch input {
          min-width: 0;
          height: 40px;
          border: 0;
          outline: 0;
          background: transparent;
          color: #fff;
          font-size: 12px;
        }

        .heroSearch input::placeholder {
          color: rgba(255,255,255,.44);
        }

        .heroSearch button {
          min-height: 40px;
          padding: 0 16px;
          border: 0;
          border-radius: 10px;
          background: linear-gradient(135deg, #d4af37, #efd879);
          color: #0a2e73;
          font-size: 9px;
          font-weight: 950;
          cursor: pointer;
        }

        .quickQueries {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
        }

        .quickQueries button {
          min-height: 29px;
          padding: 0 10px;
          border: 1px solid rgba(255,255,255,.13);
          border-radius: 999px;
          background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.72);
          font-size: 8px;
          font-weight: 800;
          cursor: pointer;
        }

        .heroStats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          align-self: stretch;
          padding: 18px;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 18px;
          background: rgba(255,255,255,.06);
          backdrop-filter: blur(10px);
        }

        .heroStats > div {
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 12px 7px;
          border-radius: 12px;
          background: rgba(255,255,255,.05);
          text-align: center;
        }

        .heroStats span {
          color: #e7cb68;
          font-size: 27px;
          font-weight: 950;
        }

        .heroStats small {
          margin-top: 3px;
          color: rgba(255,255,255,.48);
          font-size: 7px;
          text-transform: uppercase;
          letter-spacing: .7px;
        }

        .heroStats > p {
          grid-column: 1 / -1;
          margin: 2px 0 0;
          color: rgba(255,255,255,.55);
          font-size: 9px;
          line-height: 1.5;
          text-align: center;
        }

        .heroStats > p strong {
          color: #fff;
        }

        .discoveryRail {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .discoveryRail > div {
          min-height: 60px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border: 1px solid rgba(10,46,115,.08);
          border-radius: 14px;
          background: rgba(255,255,255,.8);
        }

        .discoveryRail > div > span {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          flex: 0 0 30px;
          border-radius: 9px;
          background: #f8f3df;
          color: #0a2e73;
          font-size: 12px;
          font-weight: 950;
        }

        .discoveryRail .liveDot {
          position: relative;
          background: #effaf4;
        }

        .discoveryRail .liveDot::after {
          width: 8px;
          height: 8px;
          content: "";
          border-radius: 50%;
          background: #17b26a;
          box-shadow: 0 0 0 5px rgba(23,178,106,.1);
        }

        .discoveryRail p {
          margin: 0;
        }

        .discoveryRail b,
        .discoveryRail small {
          display: block;
        }

        .discoveryRail b {
          color: #0a2e73;
          font-size: 9px;
          letter-spacing: .7px;
        }

        .discoveryRail small {
          margin-top: 3px;
          color: #667085;
          font-size: 8px;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
          padding: 13px 15px;
          border: 1px solid #fecdca;
          border-radius: 12px;
          background: #fef3f2;
          color: #b42318;
          font-size: 11px;
          font-weight: 700;
        }

        .layout {
          display: grid;
          grid-template-columns: 282px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
          margin-top: 20px;
        }

        .sidebar {
          position: sticky;
          top: 96px;
          max-height: calc(100vh - 112px);
          overflow-y: auto;
          padding: 18px;
          border: 1px solid rgba(10,46,115,.08);
          border-radius: 18px;
          background: rgba(255,255,255,.92);
          box-shadow: 0 10px 28px rgba(16,24,40,.05);
          scrollbar-width: thin;
        }

        .sidebarHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .sidebarHeader span {
          color: #b18b15;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1.2px;
        }

        .sidebarHeader h2 {
          margin: 4px 0 0;
          color: #0a2e73;
          font-size: 20px;
        }

        .sidebarHeader button {
          border: 0;
          background: transparent;
          color: #0a2e73;
          font-size: 9px;
          font-weight: 850;
          cursor: pointer;
        }

        .filterSummary {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 7px;
          padding: 9px 10px;
          border-radius: 10px;
          background: #f7f9fc;
        }

        .filterSummary strong {
          color: #b18b15;
          font-size: 16px;
        }

        .filterSummary span {
          color: #667085;
          font-size: 8px;
        }

        .clearFiltersButton {
          width: 100%;
          min-height: 42px;
          margin-top: 12px;
          border: 1px solid #d4af37;
          border-radius: 10px;
          background: #fffaf0;
          color: #0a2e73;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .resultsArea {
          min-width: 0;
        }

        .toolbar {
          position: sticky;
          top: 88px;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 14px;
          padding: 12px 14px;
          border: 1px solid rgba(10,46,115,.08);
          border-radius: 14px;
          background: rgba(255,255,255,.93);
          box-shadow: 0 8px 22px rgba(16,24,40,.05);
          backdrop-filter: blur(12px);
        }

        .resultSummary {
          min-width: 0;
        }

        .summaryEyebrow {
          display: block;
          color: #b18b15;
          font-size: 7px !important;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .resultSummary > div {
          margin-top: 2px;
        }

        .resultSummary strong {
          color: #0a2e73;
          font-size: 18px;
        }

        .resultSummary span {
          color: #667085;
          font-size: 9px;
        }

        .toolbar label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #475467;
          font-size: 9px;
          font-weight: 800;
        }

        .toolbar select {
          min-width: 180px;
          height: 38px;
          padding: 0 9px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: #fff;
          color: #344054;
          outline: none;
          font-size: 9px;
        }

        .mobileFilterButton {
          display: none;
        }

        .productGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
        }

        .productCard {
          overflow: hidden;
          min-width: 0;
          border: 1px solid rgba(10,46,115,.08);
          border-radius: 17px;
          background: #fff;
          box-shadow: 0 10px 25px rgba(16,24,40,.06);
          transition:
            transform .25s ease,
            box-shadow .25s ease,
            border-color .25s ease;
        }

        .productCard:hover {
          transform: translateY(-5px);
          border-color: rgba(212,175,55,.48);
          box-shadow: 0 18px 38px rgba(16,24,40,.11);
        }

        .imageWrap {
          position: relative;
          overflow: hidden;
          aspect-ratio: 4 / 5;
          background: #eef2f7;
        }

        .imageWrap :global(a) {
          display: block;
          width: 100%;
          height: 100%;
        }

        .imageWrap img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform .45s ease;
        }

        .productCard:hover .imageWrap img {
          transform: scale(1.04);
        }

        .imageFallback {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          align-content: center;
          background: linear-gradient(135deg, #0a2e73, #164b9d);
          color: #d4af37;
          text-align: center;
        }

        .imageFallback span {
          font-size: 22px;
          font-weight: 950;
        }

        .imageFallback small {
          margin-top: 5px;
          font-size: 7px;
          letter-spacing: 1px;
        }

        .cardNumber,
        .newBadge,
        .featuredBadge,
        .designBadge,
        .discountBadge {
          position: absolute;
          z-index: 2;
          padding: 6px 8px;
          border-radius: 999px;
          font-size: 7px;
          font-weight: 950;
          backdrop-filter: blur(8px);
        }

        .cardNumber {
          top: 9px;
          left: 9px;
          min-width: 31px;
          border: 1px solid rgba(255,255,255,.2);
          border-radius: 8px;
          background: rgba(3,22,54,.58);
          color: #fff;
          text-align: center;
        }

        .discountBadge {
          top: 9px;
          right: 9px;
          background: #d4af37;
          color: #0a2e73;
        }

        .newBadge {
          left: 9px;
          bottom: 9px;
          background: #fff;
          color: #0a2e73;
        }

        .featuredBadge {
          left: 9px;
          bottom: 9px;
          background: #0a2e73;
          color: #fff;
        }

        .designBadge {
          right: 9px;
          bottom: 9px;
          background: rgba(3,22,54,.8);
          color: #fff;
        }

        .wishlistButton {
          position: absolute;
          top: 43px;
          right: 9px;
          z-index: 3;
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.35);
          border-radius: 50%;
          background: rgba(255,255,255,.9);
          color: #0a2e73;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(16,24,40,.12);
        }

        .quickView {
          position: absolute;
          z-index: 3;
          right: 10px;
          bottom: 10px;
          left: 10px;
          min-height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: translateY(8px);
          border: 1px solid rgba(255,255,255,.2);
          border-radius: 10px;
          background: rgba(3,22,54,.84);
          color: #fff;
          font-size: 8px;
          font-weight: 900;
          text-decoration: none;
          backdrop-filter: blur(8px);
          transition: .2s ease;
        }

        .productCard:hover .quickView {
          opacity: 1;
          transform: translateY(0);
        }

        .productBody {
          padding: 13px;
        }

        .productMeta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .category {
          overflow: hidden;
          color: #b18b15;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: .8px;
          text-transform: uppercase;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .availability {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #067647;
          font-size: 7px;
          font-weight: 850;
        }

        .availability i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #17b26a;
        }

        .productName {
          min-height: 38px;
          display: -webkit-box;
          overflow: hidden;
          margin-top: 6px;
          color: #0a2e73;
          font-size: 14px;
          font-weight: 900;
          line-height: 1.35;
          text-decoration: none;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .parentName {
          display: block;
          margin-top: 4px;
          overflow: hidden;
          color: #667085;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sizeChips {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 9px;
        }

        .sizeChips span {
          min-width: 25px;
          min-height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 6px;
          border: 1px solid rgba(10,46,115,.1);
          border-radius: 7px;
          background: #f7f9fc;
          color: #0a2e73;
          font-size: 7px;
          font-weight: 850;
        }

        .priceRow {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 11px;
        }

        .priceRow strong {
          color: #b18b15;
          font-size: 19px;
          font-weight: 950;
        }

        .priceRow del {
          color: #98a2b3;
          font-size: 9px;
        }

        .saveText {
          margin: 3px 0 0;
          color: #067647;
          font-size: 7px;
          font-weight: 850;
        }

        .description {
          min-height: 31px;
          display: -webkit-box;
          overflow: hidden;
          margin: 8px 0 0;
          color: #667085;
          font-size: 8px;
          line-height: 1.45;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .cardActions {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 7px;
          margin-top: 12px;
        }

        .cardActions button,
        .cardActions :global(a) {
          min-height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          font-size: 8px;
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
        }

        .cardActions button {
          border: 0;
          background: linear-gradient(135deg, #0a2e73, #164b9d);
          color: #fff;
        }

        .cardActions button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .cardActions :global(a) {
          padding: 0 10px;
          border: 1px solid #d4af37;
          color: #0a2e73;
          background: #fffaf0;
        }

        .emptyState {
          min-height: 430px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 35px;
          border: 1px solid rgba(10,46,115,.08);
          border-radius: 20px;
          background: #fff;
          text-align: center;
        }

        .emptyIcon {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          border-radius: 17px;
          background: #f8f3df;
          color: #0a2e73;
          font-size: 25px;
        }

        .emptyState > span {
          margin-top: 15px;
          color: #b18b15;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 1.2px;
        }

        .emptyState h2 {
          margin: 7px 0 0;
          color: #0a2e73;
          font-size: 28px;
        }

        .emptyState p {
          max-width: 480px;
          margin: 9px 0 0;
          color: #667085;
          font-size: 11px;
          line-height: 1.6;
        }

        .emptyActions {
          display: flex;
          gap: 8px;
          margin-top: 18px;
        }

        .emptyActions button {
          min-height: 40px;
          padding: 0 14px;
          border-radius: 10px;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .emptyActions button:first-child {
          border: 0;
          background: #0a2e73;
          color: #fff;
        }

        .emptyActions button:last-child {
          border: 1px solid #d4af37;
          background: #fffaf0;
          color: #0a2e73;
        }

        .loadMoreWrap {
          display: flex;
          justify-content: center;
          margin-top: 24px;
        }

        .loadMoreWrap button {
          min-width: 230px;
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 0 18px;
          border: 1px solid #d4af37;
          border-radius: 12px;
          background: #0a2e73;
          color: #fff;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .loadMoreWrap b {
          color: #d4af37;
          font-size: 8px;
        }

        .mobileDrawerOverlay,
        .mobileFilterDrawer {
          display: none;
        }

        @media (max-width: 1280px) {
          .productGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 1050px) {
          .searchHero {
            grid-template-columns: 1fr;
          }

          .heroStats {
            max-width: 520px;
          }

          .discoveryRail {
            grid-template-columns: 1fr;
          }

          .layout {
            grid-template-columns: 1fr;
          }

          .sidebar {
            display: none;
          }

          .mobileFilterButton {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            min-height: 38px;
            padding: 0 11px;
            border: 1px solid #d4af37;
            border-radius: 9px;
            background: #fffaf0;
            color: #0a2e73;
            font-size: 9px;
            font-weight: 900;
            cursor: pointer;
          }

          .mobileFilterButton b {
            min-width: 18px;
            height: 18px;
            display: inline-grid;
            place-items: center;
            border-radius: 999px;
            background: #0a2e73;
            color: #fff;
            font-size: 7px;
          }

          .mobileDrawerOverlay {
            position: fixed;
            inset: 0;
            z-index: 6000;
            display: block;
            visibility: hidden;
            opacity: 0;
            background: rgba(2,12,28,.48);
            transition: .22s ease;
          }

          .mobileDrawerOverlay.open {
            visibility: visible;
            opacity: 1;
          }

          .mobileFilterDrawer {
            position: fixed;
            z-index: 6100;
            top: 0;
            right: 0;
            bottom: 0;
            width: min(390px, 92vw);
            display: flex;
            flex-direction: column;
            transform: translateX(105%);
            background: #fff;
            box-shadow: -20px 0 45px rgba(16,24,40,.2);
            transition: transform .25s ease;
          }

          .mobileFilterDrawer.open {
            transform: translateX(0);
          }

          .mobileDrawerHeader {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 18px;
            border-bottom: 1px solid #eaecf0;
          }

          .mobileDrawerHeader span {
            color: #b18b15;
            font-size: 8px;
            font-weight: 950;
            letter-spacing: 1px;
          }

          .mobileDrawerHeader h2 {
            margin: 4px 0 0;
            color: #0a2e73;
            font-size: 20px;
          }

          .mobileDrawerHeader button {
            width: 36px;
            height: 36px;
            border: 1px solid #d0d5dd;
            border-radius: 10px;
            background: #fff;
            color: #0a2e73;
            font-size: 20px;
            cursor: pointer;
          }

          .mobileDrawerBody {
            flex: 1;
            overflow-y: auto;
            padding: 15px 18px 20px;
          }

          .mobileDrawerFooter {
            display: grid;
            grid-template-columns: .8fr 1.4fr;
            gap: 8px;
            padding: 12px;
            border-top: 1px solid #eaecf0;
            background: #fff;
          }

          .mobileDrawerFooter button {
            min-height: 43px;
            border-radius: 10px;
            font-size: 9px;
            font-weight: 900;
            cursor: pointer;
          }

          .drawerReset {
            border: 1px solid #d0d5dd;
            background: #fff;
            color: #0a2e73;
          }

          .drawerApply {
            border: 0;
            background: #0a2e73;
            color: #fff;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px 9px 78px;
          }

          .searchHero {
            padding: 20px;
            border-radius: 19px;
          }

          .searchHero h1 {
            font-size: 40px;
          }

          .heroCopy > p {
            font-size: 11px;
          }

          .heroSearch {
            grid-template-columns: 28px minmax(0, 1fr);
            padding: 7px;
          }

          .heroSearch button {
            grid-column: 1 / -1;
            width: 100%;
          }

          .quickQueries {
            flex-wrap: nowrap;
            overflow-x: auto;
            margin-right: -20px;
            padding-right: 20px;
            scrollbar-width: none;
          }

          .quickQueries::-webkit-scrollbar {
            display: none;
          }

          .quickQueries button {
            flex: 0 0 auto;
          }

          .heroStats {
            grid-template-columns: repeat(3, 1fr);
            padding: 12px;
          }

          .heroStats span {
            font-size: 23px;
          }

          .discoveryRail {
            display: flex;
            overflow-x: auto;
            gap: 8px;
            margin-right: -9px;
            padding-right: 9px;
            scrollbar-width: none;
          }

          .discoveryRail::-webkit-scrollbar {
            display: none;
          }

          .discoveryRail > div {
            min-width: 230px;
            flex: 0 0 230px;
          }

          .toolbar {
            top: 72px;
            flex-wrap: wrap;
            gap: 8px;
          }

          .resultSummary {
            flex: 1 1 auto;
          }

          .toolbar label {
            width: 100%;
            justify-content: space-between;
          }

          .toolbar select {
            flex: 1;
            min-width: 0;
          }

          .productGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .productCard {
            border-radius: 13px;
          }

          .productBody {
            padding: 10px;
          }

          .cardNumber {
            display: none;
          }

          .wishlistButton {
            top: 8px;
            width: 30px;
            height: 30px;
          }

          .quickView {
            display: none;
          }

          .category {
            font-size: 6px;
          }

          .availability {
            font-size: 6px;
          }

          .productName {
            min-height: 34px;
            font-size: 11px;
          }

          .parentName {
            font-size: 7px;
          }

          .sizeChips {
            gap: 4px;
          }

          .sizeChips span {
            min-width: 22px;
            min-height: 20px;
            font-size: 6px;
          }

          .priceRow strong {
            font-size: 16px;
          }

          .priceRow del {
            font-size: 8px;
          }

          .description {
            display: none;
          }

          .cardActions {
            grid-template-columns: 1fr;
          }

          .cardActions button,
          .cardActions :global(a) {
            min-height: 34px;
            font-size: 7px;
          }

          .cardActions :global(a) {
            display: none;
          }

          .newBadge,
          .featuredBadge,
          .designBadge,
          .discountBadge {
            padding: 5px 6px;
            font-size: 6px;
          }

          .loadMoreWrap button {
            width: 100%;
          }

          .toast {
            top: 80px;
            right: 10px;
            left: 10px;
            max-width: none;
          }
        }

        @media (max-width: 390px) {
          .searchHero h1 {
            font-size: 36px;
          }

          .productGrid {
            gap: 6px;
          }

          .productBody {
            padding: 9px;
          }

          .priceRow strong {
            font-size: 15px;
          }
        }
      `}</style>
    </main>
  );
}


function FilterSelect({

  label,

  value,

  onChange,

  options,

  defaultLabel,

}: {

  label: string;

  value: string;

  onChange: (value: string) => void;

  options: string[];

  defaultLabel: string;

}) {

  return (

    <div className="filterBlock">

      <label>{label}</label>



      <select

        value={value}

        onChange={(event) => onChange(event.target.value)}

      >

        <option value="all">{defaultLabel}</option>



        {options.map((option) => (

          <option key={option} value={option}>

            {option}

          </option>

        ))}

      </select>



      <style jsx>{`

        .filterBlock {

          padding: 15px 0;

          border-top: 1px solid #eaecf0;

        }



        label {

          display: block;

          margin-bottom: 8px;

          color: #475467;

          font-size: 12px;

          font-weight: 800;

        }



        select {

          width: 100%;

          height: 42px;

          padding: 0 10px;

          border: 1px solid #d0d5dd;

          border-radius: 9px;

          background: white;

          color: #344054;

          outline: none;

        }



        @media (max-width: 1050px) {

          .filterBlock {

            padding: 0;

            border-top: 0;

          }

        }

      `}</style>

    </div>

  );

}

export default function SearchPage() {

  return (

    <Suspense

      fallback={

        <main

          style={{

            minHeight: "70vh",

            display: "flex",

            alignItems: "center",

            justifyContent: "center",

            background: "#F8F4EC",

            color: "#0A2E73",

            fontFamily: "Inter, Poppins, Arial, sans-serif",

          }}

        >

          <h2>Loading Search...</h2>

        </main>

      }

    >

      <SearchPageContent />

    </Suspense>

  );

}