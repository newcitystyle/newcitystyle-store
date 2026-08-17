"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type PurchaseRow = {
  id: string;
  purchase_number?: string | null;
  supplier_id?: number | null;
  supplier_name?: string | null;
  supplier_phone?: string | null;
  supplier_invoice_number?: string | null;
  purchase_date?: string | null;
  subtotal?: number | string | null;
  discount_amount?: number | string | null;
  tax_amount?: number | string | null;
  transport_charge?: number | string | null;
  other_charge?: number | string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  purchase_status?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  supplier_gstin?: string | null;
  supplier_state?: string | null;
  supplier_state_code?: string | null;
  place_of_supply?: string | null;
  tax_type?: string | null;
  taxable_amount?: number | string | null;
  cgst_amount?: number | string | null;
  sgst_amount?: number | string | null;
  igst_amount?: number | string | null;
  cess_amount?: number | string | null;
  due_date?: string | null;
  payment_reference?: string | null;
  payment_breakdown?: unknown;
  previous_supplier_balance?: number | string | null;
  closing_supplier_balance?: number | string | null;
  returned_amount?: number | string | null;
  return_status?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  deleted_at?: string | null;
};

type PurchaseItemRow = {
  id: number;
  purchase_id: string;
  product_id?: number | null;
  variant_id?: number | null;
  product_name?: string | null;
  brand?: string | null;
  size?: string | null;
  color?: string | null;
  sku?: string | null;
  barcode?: string | null;
  quantity?: number | string | null;
  purchase_price?: number | string | null;
  selling_price?: number | string | null;
  mrp?: number | string | null;
  tax_percent?: number | string | null;
  tax_amount?: number | string | null;
  line_total?: number | string | null;
  stock_before?: number | string | null;
  stock_after?: number | string | null;
  created_at?: string | null;
  hsn_code?: string | null;
  taxable_value?: number | string | null;
  cgst_percent?: number | string | null;
  cgst_amount?: number | string | null;
  sgst_percent?: number | string | null;
  sgst_amount?: number | string | null;
  igst_percent?: number | string | null;
  igst_amount?: number | string | null;
  cess_percent?: number | string | null;
  cess_amount?: number | string | null;
  online_quantity?: number | string | null;
  returned_quantity?: number | string | null;
  item_status?: string | null;
};

type PurchaseItemEditForm = {
  productName: string;
  brand: string;
  size: string;
  color: string;
  sku: string;
  barcode: string;
  quantity: string;
  purchasePrice: string;
  purchaseDiscount: string;
  sellingPrice: string;
  mrp: string;
  taxPercent: string;
  cessPercent: string;
  hsnCode: string;
  onlineQuantity: string;
};

type StatusFilter = "all" | "paid" | "partial" | "unpaid" | "due";
type DateFilter = "all" | "today" | "7days" | "30days";

type PurchaseEditForm = {
  supplierName: string;
  supplierPhone: string;
  supplierInvoiceNumber: string;
  purchaseDate: string;
  dueDate: string;
  supplierGstin: string;
  supplierState: string;
  supplierStateCode: string;
  placeOfSupply: string;
  taxType: string;
  paymentMethod: string;
  paymentReference: string;
  notes: string;
};

const ROYAL_BLUE = "#0A2E73";
const DEEP_BLUE = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";

function toNumber(value: number | string | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function getPaymentStatus(purchase: PurchaseRow) {
  const due = toNumber(purchase.due_amount);
  const total = toNumber(purchase.total_amount);
  const paid = toNumber(purchase.paid_amount);
  const stored = normalize(purchase.payment_status);

  if (stored === "partially_paid" || stored === "partially paid") {
    return "partial";
  }

  if (stored === "credit" || stored === "due") {
    return "unpaid";
  }

  if (stored === "cancelled") {
    return "cancelled";
  }

  if (stored) return stored;
  if (due <= 0 && total > 0) return "paid";
  if (paid > 0 && due > 0) return "partial";
  return "unpaid";
}

export default function PurchaseHistoryPage() {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [itemsByPurchase, setItemsByPurchase] = useState<
    Record<string, PurchaseItemRow[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const [selectedPurchase, setSelectedPurchase] =
    useState<PurchaseRow | null>(null);
  const [detailsItemSearch, setDetailsItemSearch] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPurchase, setEditingPurchase] =
    useState<PurchaseRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showItemEditModal, setShowItemEditModal] =
    useState(false);
  const [editingItem, setEditingItem] =
    useState<PurchaseItemRow | null>(null);
  const [savingItemEdit, setSavingItemEdit] =
    useState(false);
  const [itemEditError, setItemEditError] = useState("");

  const [showAddItemModal, setShowAddItemModal] =
    useState(false);
  const [addingItemPurchase, setAddingItemPurchase] =
    useState<PurchaseRow | null>(null);
  const [savingAddItem, setSavingAddItem] =
    useState(false);
  const [showDeleteModal, setShowDeleteModal] =
    useState(false);
  const [deletingPurchase, setDeletingPurchase] =
    useState(false);
  const [deleteConfirmation, setDeleteConfirmation] =
    useState("");
  const [deletionReason, setDeletionReason] =
    useState("");
  const [itemEditForm, setItemEditForm] =
    useState<PurchaseItemEditForm>({
      productName: "",
      brand: "",
      size: "",
      color: "",
      sku: "",
      barcode: "",
      quantity: "1",
      purchasePrice: "0",
      purchaseDiscount: "0",
      sellingPrice: "0",
      mrp: "0",
      taxPercent: "0",
      cessPercent: "0",
      hsnCode: "",
      onlineQuantity: "0",
    });
  const [editForm, setEditForm] = useState<PurchaseEditForm>({
    supplierName: "",
    supplierPhone: "",
    supplierInvoiceNumber: "",
    purchaseDate: "",
    dueDate: "",
    supplierGstin: "",
    supplierState: "",
    supplierStateCode: "",
    placeOfSupply: "",
    taxType: "intra_state",
    paymentMethod: "credit",
    paymentReference: "",
    notes: "",
  });

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");

    try {
      const { data: purchaseData, error: purchaseError } = await supabase
        .from("purchases")
        .select("*")
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (purchaseError) throw purchaseError;

      const { data: itemData, error: itemError } = await supabase
        .from("purchase_items")
        .select("*")
        .order("created_at", { ascending: true });

      if (itemError) throw itemError;

      const purchaseRows = (
        (purchaseData || []) as unknown as PurchaseRow[]
      ).filter((purchase) => !purchase.deleted_at);
      const itemRows = (itemData || []) as unknown as PurchaseItemRow[];

      const grouped: Record<string, PurchaseItemRow[]> = {};

      itemRows.forEach((item) => {
        if (!grouped[item.purchase_id]) {
          grouped[item.purchase_id] = [];
        }

        grouped[item.purchase_id].push(item);
      });

      setPurchases(purchaseRows);
      setItemsByPurchase(grouped);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load purchase history.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPurchases = useMemo(() => {
    const query = normalize(searchQuery);
    const now = new Date();

    return purchases.filter((purchase) => {
      const purchaseItems = itemsByPurchase[purchase.id] || [];
      const status = getPaymentStatus(purchase);
      const due = toNumber(purchase.due_amount);

      const matchesSearch =
        !query ||
        [
          purchase.purchase_number,
          purchase.supplier_name,
          purchase.supplier_phone,
          purchase.supplier_invoice_number,
          purchase.supplier_gstin,
          purchase.payment_method,
          ...purchaseItems.flatMap((item) => [
            item.product_name,
            item.brand,
            item.barcode,
            item.sku,
          ]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "due" && due > 0) ||
        status === statusFilter;

      let matchesDate = true;

      if (dateFilter !== "all") {
        const dateValue = new Date(purchase.purchase_date || purchase.created_at || "");
        const diffMs = now.getTime() - dateValue.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (dateFilter === "today") {
          matchesDate =
            dateValue.toDateString() === now.toDateString();
        } else if (dateFilter === "7days") {
          matchesDate = diffDays >= 0 && diffDays <= 7;
        } else if (dateFilter === "30days") {
          matchesDate = diffDays >= 0 && diffDays <= 30;
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [dateFilter, itemsByPurchase, purchases, searchQuery, statusFilter]);

  const statistics = useMemo(() => {
    const totalPurchase = purchases.reduce(
      (sum, purchase) => sum + toNumber(purchase.total_amount),
      0,
    );

    const totalPaid = purchases.reduce(
      (sum, purchase) => sum + toNumber(purchase.paid_amount),
      0,
    );

    const totalDue = purchases.reduce(
      (sum, purchase) => sum + toNumber(purchase.due_amount),
      0,
    );

    const dueSuppliers = new Set(
      purchases
        .filter((purchase) => toNumber(purchase.due_amount) > 0)
        .map((purchase) => purchase.supplier_name || purchase.supplier_id)
        .filter(Boolean),
    ).size;

    return {
      count: purchases.length,
      totalPurchase,
      totalPaid,
      totalDue,
      dueSuppliers,
    };
  }, [purchases]);

  async function recordDuePayment() {
    if (!selectedPurchase || !selectedPurchase.supplier_id) return;

    const currentDue = toNumber(selectedPurchase.due_amount);
    const amount = Math.max(0, Math.min(paymentAmount, currentDue));

    if (amount <= 0) {
      setNotice("Enter a valid payment amount.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    setSavingPayment(true);

    try {
      const { data, error } = await supabase.rpc(
        "ncs_record_supplier_payment_v2",
        {
          p_supplier_id: selectedPurchase.supplier_id,
          p_amount: amount,
          p_payment_method: paymentMethod,
          p_payment_reference: paymentReference.trim() || null,
          p_payment_date: paymentDate,
          p_notes: paymentNotes.trim() || null,
          p_purchase_id: selectedPurchase.id,
        },
      );

      if (error) throw error;

      const result = (data || {}) as {
        message?: string;
      };

      setShowPaymentModal(false);
      setSelectedPurchase(null);
      setPaymentAmount(0);
      setPaymentMethod("cash");
      setPaymentReference("");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentNotes("");
      setNotice(
        result.message || "Supplier due payment updated successfully.",
      );
      window.setTimeout(() => setNotice(""), 3500);
      await loadData(true);
    } catch (error) {
      console.error(error);
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update supplier payment.",
      );
      window.setTimeout(() => setNotice(""), 3500);
    } finally {
      setSavingPayment(false);
    }
  }

  function openPurchaseDetails(purchase: PurchaseRow) {
    setDetailsItemSearch("");
    setSelectedPurchase(purchase);
  }

  function closePurchaseDetails() {
    setDetailsItemSearch("");
    setSelectedPurchase(null);
  }

  function openPaymentModal(purchase: PurchaseRow) {
    setSelectedPurchase(purchase);
    setPaymentAmount(toNumber(purchase.due_amount));
    setPaymentMethod("cash");
    setPaymentReference("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentNotes("");
    setShowPaymentModal(true);
  }

  function openDeletePurchaseModal() {
    setDeleteConfirmation("");
    setDeletionReason("");
    setShowDeleteModal(true);
  }

  async function deletePurchaseSafely(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedPurchase || deletingPurchase) return;

    if (deleteConfirmation.trim().toUpperCase() !== "DELETE") {
      setNotice("Type DELETE exactly to confirm.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    if (deletionReason.trim().length < 3) {
      setNotice("Please enter a deletion reason.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    setDeletingPurchase(true);

    try {
      const { error } = await supabase.rpc(
        "ncs_delete_purchase_v2",
        {
          p_purchase_id: selectedPurchase.id,
          p_deletion_reason: deletionReason.trim(),
        },
      );

      if (error) throw error;

      setShowDeleteModal(false);
      setSelectedPurchase(null);
      setDeleteConfirmation("");
      setDeletionReason("");
      setNotice(
        "Purchase deleted and stock reversed successfully.",
      );
      window.setTimeout(() => setNotice(""), 4000);
      await loadData(true);
    } catch (error) {
      console.error("Purchase delete error:", error);
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to delete purchase.",
      );
      window.setTimeout(() => setNotice(""), 6000);
    } finally {
      setDeletingPurchase(false);
    }
  }

  function createBlankPurchaseItemForm(): PurchaseItemEditForm {
    return {
      productName: "",
      brand: "NEW CITY STYLE",
      size: "",
      color: "",
      sku: "",
      barcode: "",
      quantity: "",
      purchasePrice: "",
      purchaseDiscount: "0",
      sellingPrice: "0",
      mrp: "",
      taxPercent: "0",
      cessPercent: "0",
      hsnCode: "",
      onlineQuantity: "0",
    };
  }

  function openAddItemModal(purchase: PurchaseRow) {
    window.location.href =
      `/admin/purchase-history/add-items?purchaseId=${encodeURIComponent(
        purchase.id,
      )}`;
  }

  async function saveAddedPurchaseItem(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!addingItemPurchase || savingAddItem) return;

    const quantity = Math.max(
      0,
      Math.trunc(toNumber(itemEditForm.quantity)),
    );
    const onlineQuantity = Math.max(
      0,
      Math.trunc(toNumber(itemEditForm.onlineQuantity)),
    );
    const purchasePrice = Math.max(
      0,
      toNumber(itemEditForm.purchasePrice),
    );
    const purchaseDiscount = Math.max(
      0,
      toNumber(itemEditForm.purchaseDiscount),
    );
    const mrp = Math.max(0, toNumber(itemEditForm.mrp));

    if (!itemEditForm.productName.trim()) {
      setNotice("Product name is required.");
      return;
    }

    if (!itemEditForm.brand.trim()) {
      setNotice("Brand is required.");
      return;
    }

    if (quantity <= 0) {
      setNotice("Enter the missed item quantity.");
      return;
    }

    if (purchaseDiscount > purchasePrice) {
      setNotice(
        "Discount per piece cannot be greater than purchase price.",
      );
      return;
    }

    if (mrp <= 0) {
      setNotice("Enter a valid MRP.");
      return;
    }

    if (onlineQuantity > quantity) {
      setNotice(
        "Online quantity cannot be greater than total quantity.",
      );
      return;
    }

    setSavingAddItem(true);

    try {
      const { data, error } = await supabase.rpc(
        "ncs_add_purchase_item_v1",
        {
          p_purchase_id: addingItemPurchase.id,
          p_product_name: itemEditForm.productName.trim(),
          p_brand: itemEditForm.brand.trim(),
          p_size: itemEditForm.size.trim() || null,
          p_color: itemEditForm.color.trim() || null,
          p_sku: itemEditForm.sku.trim() || null,
          p_barcode: itemEditForm.barcode.trim() || null,
          p_quantity: quantity,
          p_purchase_price: purchasePrice,
          p_purchase_discount: purchaseDiscount,
          p_selling_price: Math.max(
            0,
            toNumber(itemEditForm.sellingPrice),
          ),
          p_mrp: mrp,
          p_tax_percent: Math.max(
            0,
            toNumber(itemEditForm.taxPercent),
          ),
          p_cess_percent: Math.max(
            0,
            toNumber(itemEditForm.cessPercent),
          ),
          p_hsn_code: itemEditForm.hsnCode.trim() || null,
          p_online_quantity: onlineQuantity,
        },
      );

      if (error) throw error;

      const result = (data || {}) as {
        success?: boolean;
        message?: string;
      };

      if (result.success === false) {
        throw new Error(
          result.message || "Unable to add missed item.",
        );
      }

      setShowAddItemModal(false);
      setAddingItemPurchase(null);
      setNotice(
        result.message ||
          `Item added to ${addingItemPurchase.purchase_number || "purchase"} successfully.`,
      );
      window.setTimeout(() => setNotice(""), 4000);
      await loadData(true);
    } catch (error) {
      console.error("Add missed purchase item error:", error);
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to add missed item.",
      );
      window.setTimeout(() => setNotice(""), 5500);
    } finally {
      setSavingAddItem(false);
    }
  }

  function openItemEditModal(item: PurchaseItemRow) {
    setEditingItem(item);
    setItemEditError("");
    setItemEditForm({
      productName: item.product_name || "",
      brand: item.brand?.trim() || "NEW CITY STYLE",
      size: item.size || "",
      color: item.color || "",
      sku: item.sku || "",
      barcode: item.barcode || "",
      quantity: String(toNumber(item.quantity) || 1),
      purchasePrice: String(toNumber(item.purchase_price)),
      purchaseDiscount: "0",
      sellingPrice: String(toNumber(item.selling_price)),
      mrp: String(toNumber(item.mrp)),
      taxPercent: String(toNumber(item.tax_percent)),
      cessPercent: String(toNumber(item.cess_percent)),
      hsnCode: item.hsn_code || "",
      onlineQuantity: String(toNumber(item.online_quantity)),
    });
    setShowItemEditModal(true);
  }

  function updateItemEditField<
    K extends keyof PurchaseItemEditForm,
  >(field: K, value: PurchaseItemEditForm[K]) {
    setItemEditError("");
    setItemEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function savePurchaseItemEdit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !selectedPurchase ||
      !editingItem ||
      savingItemEdit
    ) {
      return;
    }

    const quantity = Math.max(
      0,
      Math.trunc(toNumber(itemEditForm.quantity)),
    );
    const onlineQuantity = Math.max(
      0,
      Math.trunc(toNumber(itemEditForm.onlineQuantity)),
    );

    setItemEditError("");

    if (!itemEditForm.productName.trim()) {
      setItemEditError("Product name is required.");
      return;
    }

    const safeBrand =
      itemEditForm.brand.trim() ||
      editingItem.brand?.trim() ||
      "NEW CITY STYLE";

    if (quantity <= 0) {
      setItemEditError("Quantity must be greater than zero.");
      return;
    }

    if (onlineQuantity > quantity) {
      setItemEditError(
        "Online quantity cannot be greater than total quantity.",
      );
      return;
    }

    setSavingItemEdit(true);

    try {
      const oldBrand = normalize(
        editingItem.brand || "NEW CITY STYLE",
      );
      const newBrand = normalize(safeBrand);

      if (oldBrand !== newBrand) {
        const { error: brandMoveError } = await supabase.rpc(
          "ncs_move_purchase_item_brand_v1",
          {
            p_item_id: editingItem.id,
            p_new_brand: safeBrand,
          },
        );

        if (brandMoveError) throw brandMoveError;
      }

      const { error } = await supabase.rpc(
        "ncs_edit_purchase_item_v2",
        {
          p_purchase_id: selectedPurchase.id,
          p_item_id: editingItem.id,
          p_product_name:
            itemEditForm.productName.trim(),
          p_size: itemEditForm.size.trim() || null,
          p_color: itemEditForm.color.trim() || null,
          p_sku: itemEditForm.sku.trim() || null,
          p_barcode:
            itemEditForm.barcode.trim() || null,
          p_quantity: quantity,
          p_purchase_price: Math.max(
            0,
            toNumber(itemEditForm.purchasePrice),
          ),
          p_selling_price: Math.max(
            0,
            toNumber(itemEditForm.sellingPrice),
          ),
          p_mrp: Math.max(
            0,
            toNumber(itemEditForm.mrp),
          ),
          p_tax_percent: Math.max(
            0,
            toNumber(itemEditForm.taxPercent),
          ),
          p_cess_percent: Math.max(
            0,
            toNumber(itemEditForm.cessPercent),
          ),
          p_hsn_code:
            itemEditForm.hsnCode.trim() || null,
          p_online_quantity: onlineQuantity,
        },
      );

      if (error) throw error;

      await loadData(true);

      setShowItemEditModal(false);
      setEditingItem(null);
     setItemEditError("");

setNotice(
  `Item updated successfully. New MRP: ${formatCurrency(
    Math.max(0, toNumber(itemEditForm.mrp)),
  )}`,
);

window.setTimeout(() => setNotice(""), 4500);
    } catch (error) {
      console.error("Purchase item edit error:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update purchase item.";
      setItemEditError(message);
      setNotice(message);
      window.setTimeout(() => setNotice(""), 4500);
    } finally {
      setSavingItemEdit(false);
    }
  }

  function openEditModal(purchase: PurchaseRow) {
    setEditingPurchase(purchase);
    setEditForm({
      supplierName: purchase.supplier_name || "",
      supplierPhone: purchase.supplier_phone || "",
      supplierInvoiceNumber:
        purchase.supplier_invoice_number || "",
      purchaseDate:
        purchase.purchase_date?.slice(0, 10) ||
        purchase.created_at?.slice(0, 10) ||
        new Date().toISOString().slice(0, 10),
      dueDate: purchase.due_date?.slice(0, 10) || "",
      supplierGstin: purchase.supplier_gstin || "",
      supplierState:
        purchase.supplier_state || "Andhra Pradesh",
      supplierStateCode:
        purchase.supplier_state_code || "37",
      placeOfSupply:
        purchase.place_of_supply ||
        purchase.supplier_state ||
        "Andhra Pradesh",
      taxType: purchase.tax_type || "intra_state",
      paymentMethod: purchase.payment_method || "credit",
      paymentReference:
        purchase.payment_reference || "",
      notes: purchase.notes || "",
    });
    setShowEditModal(true);
  }

  function closeEditModal() {
    if (savingEdit) return;
    setShowEditModal(false);
    setEditingPurchase(null);
  }

  function updateEditField<K extends keyof PurchaseEditForm>(
    field: K,
    value: PurchaseEditForm[K],
  ) {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function savePurchaseEdit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!editingPurchase || savingEdit) return;

    if (!editForm.supplierName.trim()) {
      setNotice("Supplier name is required.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    if (!editForm.purchaseDate) {
      setNotice("Purchase date is required.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    setSavingEdit(true);

    try {
      const { error } = await supabase
        .from("purchases")
        .update({
          supplier_name: editForm.supplierName.trim(),
          supplier_phone:
            editForm.supplierPhone.trim() || null,
          supplier_invoice_number:
            editForm.supplierInvoiceNumber.trim() || null,
          purchase_date: editForm.purchaseDate,
          due_date: editForm.dueDate || null,
          supplier_gstin:
            editForm.supplierGstin.trim() || null,
          supplier_state:
            editForm.supplierState.trim() || null,
          supplier_state_code:
            editForm.supplierStateCode.trim() || null,
          place_of_supply:
            editForm.placeOfSupply.trim() || null,
          tax_type: editForm.taxType,
          payment_method: editForm.paymentMethod,
          payment_reference:
            editForm.paymentReference.trim() || null,
          notes: editForm.notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingPurchase.id);

      if (error) throw error;

      setShowEditModal(false);
      setEditingPurchase(null);
      setSelectedPurchase(null);
      setNotice("Purchase details updated successfully.");
      window.setTimeout(() => setNotice(""), 3500);
      await loadData(true);
    } catch (error) {
      console.error("Purchase edit error:", error);
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update purchase details.",
      );
      window.setTimeout(() => setNotice(""), 3500);
    } finally {
      setSavingEdit(false);
    }
  }

  function printPurchase(purchase: PurchaseRow) {
    const purchaseItems = itemsByPurchase[purchase.id] || [];

    const itemRows = purchaseItems
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>
              <strong>${item.product_name || "Product"}</strong>
              <small>Brand: ${item.brand || "—"}</small>
              <small>
                ${[item.size, item.color].filter(Boolean).join(" • ") || "Standard Product"}
              </small>
              <small>
                Barcode: ${item.barcode || "—"} • SKU: ${item.sku || "—"}
              </small>
            </td>
            <td>${toNumber(item.quantity)}</td>
            <td>${formatCurrency(toNumber(item.purchase_price))}</td>
            <td>${toNumber(item.tax_percent)}%</td>
            <td>${formatCurrency(toNumber(item.tax_amount))}</td>
            <td>${formatCurrency(toNumber(item.line_total))}</td>
          </tr>
        `,
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=1000,height=900");

    if (!printWindow) {
      setNotice("Allow browser pop-ups to print purchase bills.");
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${purchase.purchase_number || "Purchase Bill"}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #202020;
              font-family: Arial, sans-serif;
              background: #fff;
            }
            .invoice {
              min-height: 270mm;
              display: flex;
              flex-direction: column;
            }
            .brandHeader {
              display: grid;
              grid-template-columns: 1fr auto;
              gap: 24px;
              padding: 22px 24px;
              border-radius: 16px;
              background: linear-gradient(135deg, #03153F, #0A2E73);
              color: #fff;
            }
            .storeName {
              margin: 0;
              color: #fff;
              font-size: 34px;
              font-weight: 900;
              letter-spacing: 1.2px;
            }
            .tagline {
              margin: 4px 0 12px;
              color: #D4AF37;
              font-size: 15px;
              font-weight: 800;
            }
            .storeDetails {
              margin: 0;
              color: rgba(255,255,255,.88);
              font-size: 12px;
              line-height: 1.65;
            }
            .billBadge {
              min-width: 230px;
              padding: 16px;
              border: 1px solid rgba(212,175,55,.75);
              border-radius: 12px;
              background: rgba(255,255,255,.08);
            }
            .billBadge span,
            .billBadge strong {
              display: block;
            }
            .billBadge span {
              color: #D4AF37;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
            }
            .billBadge strong {
              margin-top: 5px;
              font-size: 16px;
            }
            .billBadge p {
              margin: 8px 0 0;
              font-size: 11px;
            }
            .details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-top: 16px;
            }
            .box {
              padding: 14px;
              border: 1px solid #dfe4eb;
              border-radius: 11px;
              background: #fafbfc;
            }
            .box h3 {
              margin: 0 0 8px;
              color: #0A2E73;
              font-size: 12px;
              text-transform: uppercase;
            }
            .box p {
              margin: 4px 0;
              font-size: 11px;
              line-height: 1.45;
            }
            table {
              width: 100%;
              margin-top: 16px;
              border-collapse: collapse;
            }
            th, td {
              padding: 9px 8px;
              border: 1px solid #dfe4eb;
              text-align: left;
              vertical-align: top;
              font-size: 10px;
            }
            th {
              background: #0A2E73;
              color: #fff;
              font-size: 9px;
              text-transform: uppercase;
            }
            td small {
              display: block;
              margin-top: 3px;
              color: #7b8491;
            }
            .taxSummary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-top: 14px;
            }
            .taxSummary div {
              padding: 10px;
              border: 1px solid #dfe4eb;
              border-radius: 9px;
              background: #fafbfc;
            }
            .taxSummary span,
            .taxSummary strong {
              display: block;
            }
            .taxSummary span {
              color: #7b8491;
              font-size: 8px;
              font-weight: 800;
              text-transform: uppercase;
            }
            .taxSummary strong {
              margin-top: 4px;
              color: #0A2E73;
              font-size: 11px;
            }
            .totals {
              width: 370px;
              margin: 18px 0 0 auto;
              padding: 14px;
              border: 1px solid #dfe4eb;
              border-radius: 12px;
              background: #fafbfc;
            }
            .totals p {
              display: flex;
              justify-content: space-between;
              gap: 18px;
              margin: 0;
              padding: 7px 0;
              border-bottom: 1px solid #e9edf2;
              font-size: 11px;
            }
            .grand {
              margin-top: 6px !important;
              padding: 12px !important;
              border-radius: 9px;
              background: #0A2E73;
              color: #fff;
              font-size: 16px !important;
              font-weight: 900;
            }
            .due {
              color: #B42318;
              font-weight: 900;
            }
            .notes {
              margin-top: 14px;
              padding: 12px;
              border: 1px solid #dfe4eb;
              border-radius: 10px;
              background: #fafbfc;
              font-size: 10px;
              line-height: 1.5;
            }
            .footer {
              margin-top: auto;
              padding-top: 22px;
              text-align: center;
            }
            .footerMessage {
              padding: 14px;
              border-top: 2px solid #D4AF37;
              color: #0A2E73;
              font-size: 13px;
              font-weight: 800;
            }
            .footer small {
              display: block;
              margin-top: 6px;
              color: #6f7782;
              font-size: 10px;
            }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="invoice">
            <header class="brandHeader">
              <div>
                <h1 class="storeName">NEW CITY STYLE</h1>
                <p class="tagline">Style for Every Family</p>
                <p class="storeDetails">
                  Main Road, Sarubujjili<br/>
                  Srikakulam, Andhra Pradesh - 532458<br/>
                  Mobile: 9010014001<br/>
                  Email: badri.nsv@gmail.com
                </p>
              </div>

              <div class="billBadge">
                <span>Purchase Bill</span>
                <strong>${purchase.purchase_number || "—"}</strong>
                <p>${formatDate(purchase.purchase_date)}</p>
              </div>
            </header>

            <section class="details">
              <div class="box">
                <h3>Supplier Details</h3>
                <p><strong>${purchase.supplier_name || "Not provided"}</strong></p>
                <p>Mobile: ${purchase.supplier_phone || "—"}</p>
                <p>GSTIN: ${purchase.supplier_gstin || "—"}</p>
                <p>State: ${purchase.supplier_state || "—"}</p>
              </div>

              <div class="box">
                <h3>Purchase Details</h3>
                <p>Supplier Invoice: ${purchase.supplier_invoice_number || "—"}</p>
                <p>Payment Method: ${purchase.payment_method || "—"}</p>
                <p>Payment Status: ${getPaymentStatus(purchase)}</p>
                <p>Tax Type: ${purchase.tax_type || "—"}</p>
                <p>Credit Due Date: ${formatDate(purchase.due_date)}</p>
              </div>
            </section>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product / Variant</th>
                  <th>Qty</th>
                  <th>Purchase Price</th>
                  <th>GST</th>
                  <th>Tax</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>

            <section class="taxSummary">
              <div><span>CGST</span><strong>${formatCurrency(toNumber(purchase.cgst_amount))}</strong></div>
              <div><span>SGST</span><strong>${formatCurrency(toNumber(purchase.sgst_amount))}</strong></div>
              <div><span>IGST</span><strong>${formatCurrency(toNumber(purchase.igst_amount))}</strong></div>
              <div><span>Cess</span><strong>${formatCurrency(toNumber(purchase.cess_amount))}</strong></div>
            </section>

            <section class="totals">
              <p><span>Subtotal</span><strong>${formatCurrency(toNumber(purchase.subtotal))}</strong></p>
              <p><span>Tax</span><strong>${formatCurrency(toNumber(purchase.tax_amount))}</strong></p>
              <p><span>Discount</span><strong>-${formatCurrency(toNumber(purchase.discount_amount))}</strong></p>
              <p><span>Transport</span><strong>${formatCurrency(toNumber(purchase.transport_charge))}</strong></p>
              <p><span>Other Charge</span><strong>${formatCurrency(toNumber(purchase.other_charge))}</strong></p>
              <p class="grand"><span>Total</span><strong>${formatCurrency(toNumber(purchase.total_amount))}</strong></p>
              <p><span>Paid</span><strong>${formatCurrency(toNumber(purchase.paid_amount))}</strong></p>
              <p class="due"><span>Due</span><strong>${formatCurrency(toNumber(purchase.due_amount))}</strong></p>
            </section>

            ${
              purchase.notes
                ? `<div class="notes"><strong>Notes:</strong><br/>${purchase.notes}</div>`
                : ""
            }

            <footer class="footer">
              <div class="footerMessage">
                Thank you for your continued support and partnership.
                Together, we grow with trust and quality.
              </div>
              <small>NEW CITY STYLE — Style for Every Family</small>
            </footer>
          </div>

          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  return (
    <main className="purchaseHistoryPage">
      <section className="pageHeader">
        <div>
          <span>NEW CITY STYLE • ACCOUNTS</span>
          <h1>Purchase History & Supplier Due</h1>
          <p>
            Review every stock purchase, supplier payment and pending balance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "↻ Refresh"}
        </button>
      </section>

      {notice && <div className="notice">{notice}</div>}
      {errorMessage && <div className="error">{errorMessage}</div>}

      <section className="statsGrid">
        <article>
          <span>Total Purchases</span>
          <strong>{statistics.count}</strong>
        </article>

        <article>
          <span>Purchase Value</span>
          <strong>{formatCurrency(statistics.totalPurchase)}</strong>
        </article>

        <article>
          <span>Total Paid</span>
          <strong>{formatCurrency(statistics.totalPaid)}</strong>
        </article>

        <article>
          <span>Total Supplier Due</span>
          <strong>{formatCurrency(statistics.totalDue)}</strong>
        </article>

        <article>
          <span>Suppliers With Due</span>
          <strong>{statistics.dueSuppliers}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="toolbar">
          <div className="searchBox">
            <span>⌕</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search purchase no, supplier, brand, product or barcode..."
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="partial">Partially Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="due">Has Due</option>
          </select>

          <select
            value={dateFilter}
            onChange={(event) =>
              setDateFilter(event.target.value as DateFilter)
            }
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
        </div>

        {loading ? (
          <div className="loadingState">
            <div className="spinner" />
            <h2>Loading purchase history...</h2>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="emptyState">
            <h2>No matching purchases</h2>
            <p>Try changing the search or filters.</p>
          </div>
        ) : (
          <div className="purchaseList">
            {filteredPurchases.map((purchase) => {
              const purchaseItems = itemsByPurchase[purchase.id] || [];
              const status = getPaymentStatus(purchase);
              const due = toNumber(purchase.due_amount);

              return (
                <article className="purchaseCard" key={purchase.id}>
                  <header>
                    <div>
                      <span>{purchase.purchase_number || "PURCHASE"}</span>
                      <h2>{purchase.supplier_name || "Unknown Supplier"}</h2>
                      <p>
                        {formatDate(purchase.purchase_date)} •{" "}
                        {purchase.supplier_phone || "No phone"}
                      </p>
                    </div>

                    <span className={`statusBadge status-${status}`}>
                      {status === "partial"
                        ? "Partially Paid"
                        : status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </header>

                  <div className="purchaseMeta">
                    <div>
                      <span>Invoice</span>
                      <strong>
                        {purchase.supplier_invoice_number || "—"}
                      </strong>
                    </div>

                    <div>
                      <span>Items</span>
                      <strong>{purchaseItems.length}</strong>
                    </div>

                    <div>
                      <span>Total</span>
                      <strong>
                        {formatCurrency(toNumber(purchase.total_amount))}
                      </strong>
                    </div>

                    <div>
                      <span>Paid</span>
                      <strong>
                        {formatCurrency(toNumber(purchase.paid_amount))}
                      </strong>
                    </div>

                    <div>
                      <span>Due</span>
                      <strong className={due > 0 ? "dueText" : ""}>
                        {formatCurrency(due)}
                      </strong>
                    </div>

                    <div>
                      <span>Payment</span>
                      <strong>{purchase.payment_method || "—"}</strong>
                    </div>
                  </div>

                  <div className="itemPreview">
                    {purchaseItems.slice(0, 4).map((item) => (
                      <div key={item.id}>
                        <strong>{item.product_name || "Product"}</strong>
                        <span className="itemBrand">
                          Brand: {item.brand || "—"}
                        </span>
                        <span>
                          Qty {toNumber(item.quantity)}
                          {item.size ? ` • ${item.size}` : ""}
                          {item.barcode ? ` • ${item.barcode}` : ""}
                        </span>
                      </div>
                    ))}

                    {purchaseItems.length > 4 && (
                      <div>
                        <strong>+{purchaseItems.length - 4} more items</strong>
                      </div>
                    )}
                  </div>

                  <footer>
                    <button
                      type="button"
                      className="editButton"
                      onClick={() => openEditModal(purchase)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="addMissedItemButton"
                      onClick={() => openAddItemModal(purchase)}
                    >
                      + Add Missed Items
                    </button>

                    <button
                      type="button"
                      onClick={() => openPurchaseDetails(purchase)}
                    >
                      View Details
                    </button>

                    <button
                      type="button"
                      onClick={() => printPurchase(purchase)}
                    >
                      Print Bill
                    </button>

                    {due > 0 && (
                      <button
                        type="button"
                        className="payButton"
                        onClick={() => openPaymentModal(purchase)}
                      >
                        Record Due Payment
                      </button>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedPurchase && !showPaymentModal && (
        <div
          className="modalOverlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePurchaseDetails();
            }
          }}
        >
          <section className="detailsModal">
            <div className="detailsQuickToolbar">
              <div className="detailsQuickSearch">
                <span>⌕</span>
                <input
                  value={detailsItemSearch}
                  onChange={(event) =>
                    setDetailsItemSearch(event.target.value)
                  }
                  placeholder="Find item, brand, size, colour, barcode or SKU..."
                  autoFocus
                />
                {detailsItemSearch && (
                  <button
                    type="button"
                    className="detailsClearSearch"
                    onClick={() => setDetailsItemSearch("")}
                    aria-label="Clear item search"
                  >
                    CLEAR
                  </button>
                )}
              </div>

              <button
                type="button"
                className="detailsCloseSticky"
                onClick={closePurchaseDetails}
                aria-label="Close purchase details"
              >
                ✕ CLOSE
              </button>
            </div>

            <span>PURCHASE DETAILS</span>
            <h2>{selectedPurchase.purchase_number}</h2>
            <p className="modalSubtitle">
              Complete supplier invoice, payment, GST and stock details.
            </p>

            <div className="detailsGrid detailsGridWide">
              <p>
                <span>Supplier</span>
                <strong>{selectedPurchase.supplier_name || "—"}</strong>
              </p>
              <p>
                <span>Mobile</span>
                <strong>{selectedPurchase.supplier_phone || "—"}</strong>
              </p>
              <p>
                <span>GSTIN</span>
                <strong>{selectedPurchase.supplier_gstin || "—"}</strong>
              </p>
              <p>
                <span>Supplier Invoice</span>
                <strong>
                  {selectedPurchase.supplier_invoice_number || "—"}
                </strong>
              </p>
              <p>
                <span>Purchase Date</span>
                <strong>{formatDate(selectedPurchase.purchase_date)}</strong>
              </p>
              <p>
                <span>Credit Due Date</span>
                <strong>{formatDate(selectedPurchase.due_date)}</strong>
              </p>
              <p>
                <span>State / Supply</span>
                <strong>
                  {[
                    selectedPurchase.supplier_state,
                    selectedPurchase.place_of_supply,
                  ]
                    .filter(Boolean)
                    .join(" • ") || "—"}
                </strong>
              </p>
              <p>
                <span>Tax Type</span>
                <strong>{selectedPurchase.tax_type || "—"}</strong>
              </p>
              <p>
                <span>Payment Method</span>
                <strong>{selectedPurchase.payment_method || "—"}</strong>
              </p>
              <p>
                <span>Payment Reference</span>
                <strong>{selectedPurchase.payment_reference || "—"}</strong>
              </p>
              <p>
                <span>Payment Status</span>
                <strong>{getPaymentStatus(selectedPurchase)}</strong>
              </p>
              <p>
                <span>Return Status</span>
                <strong>{selectedPurchase.return_status || "none"}</strong>
              </p>
            </div>

            <div className="detailsItems">
              {(itemsByPurchase[selectedPurchase.id] || [])
                .filter((item) => {
                  const query = normalize(detailsItemSearch);
                  if (!query) return true;

                  return [
                    item.product_name,
                    item.brand,
                    item.size,
                    item.color,
                    item.barcode,
                    item.sku,
                  ]
                    .join(" ")
                    .toLowerCase()
                    .includes(query);
                })
                .map((item) => (
                <article key={item.id} className="detailsItemFull">
                  <div className="detailsItemName">
                    <strong>{item.product_name || "Product"}</strong>
                    <span className="brandLine">
                      Brand: {item.brand || "—"}
                    </span>
                    <span>
                      {[item.size, item.color].filter(Boolean).join(" • ") ||
                        "Standard Product"}
                    </span>
                    <span>
                      Barcode: {item.barcode || "—"} • SKU: {item.sku || "—"}
                    </span>
                    <span>
                      Status: {item.item_status || "active"} • Returned:{" "}
                      {toNumber(item.returned_quantity)}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="editItemButton"
                    onClick={() => openItemEditModal(item)}
                  >
                    Edit Item
                  </button>

                  <div className="detailsItemNumbers">
                    <p>
                      <span>Qty</span>
                      <strong>{toNumber(item.quantity)}</strong>
                    </p>
                    <p>
                      <span>Purchase</span>
                      <strong>
                        {formatCurrency(toNumber(item.purchase_price))}
                      </strong>
                    </p>
                    <p>
                      <span>MRP</span>
                      <strong>{formatCurrency(toNumber(item.mrp))}</strong>
                    </p>
                    <p>
                      <span>GST</span>
                      <strong>{toNumber(item.tax_percent)}%</strong>
                    </p>
                    <p>
                      <span>Online Qty</span>
                      <strong>{toNumber(item.online_quantity)}</strong>
                    </p>
                    <p>
                      <span>Line Total</span>
                      <strong>{formatCurrency(toNumber(item.line_total))}</strong>
                    </p>
                  </div>
                </article>
              ))}

              {(itemsByPurchase[selectedPurchase.id] || []).filter((item) => {
                const query = normalize(detailsItemSearch);
                if (!query) return true;

                return [
                  item.product_name,
                  item.brand,
                  item.size,
                  item.color,
                  item.barcode,
                  item.sku,
                ]
                  .join(" ")
                  .toLowerCase()
                  .includes(query);
              }).length === 0 && (
                <div className="detailsNoResults">
                  No purchase items match “{detailsItemSearch}”.
                </div>
              )}
            </div>

            <div className="purchaseTotalsDetailed">
              <p>
                <span>Subtotal</span>
                <strong>
                  {formatCurrency(toNumber(selectedPurchase.subtotal))}
                </strong>
              </p>
              <p>
                <span>CGST</span>
                <strong>
                  {formatCurrency(toNumber(selectedPurchase.cgst_amount))}
                </strong>
              </p>
              <p>
                <span>SGST</span>
                <strong>
                  {formatCurrency(toNumber(selectedPurchase.sgst_amount))}
                </strong>
              </p>
              <p>
                <span>IGST</span>
                <strong>
                  {formatCurrency(toNumber(selectedPurchase.igst_amount))}
                </strong>
              </p>
              <p>
                <span>Cess</span>
                <strong>
                  {formatCurrency(toNumber(selectedPurchase.cess_amount))}
                </strong>
              </p>
              <p>
                <span>Discount</span>
                <strong>
                  − {formatCurrency(toNumber(selectedPurchase.discount_amount))}
                </strong>
              </p>
              <p>
                <span>Transport + Other</span>
                <strong>
                  {formatCurrency(
                    toNumber(selectedPurchase.transport_charge) +
                      toNumber(selectedPurchase.other_charge),
                  )}
                </strong>
              </p>
              <p className="detailGrand">
                <span>Total</span>
                <strong>
                  {formatCurrency(toNumber(selectedPurchase.total_amount))}
                </strong>
              </p>
              <p>
                <span>Paid</span>
                <strong>
                  {formatCurrency(toNumber(selectedPurchase.paid_amount))}
                </strong>
              </p>
              <p>
                <span>Current Due</span>
                <strong>
                  {formatCurrency(toNumber(selectedPurchase.due_amount))}
                </strong>
              </p>
              <p>
                <span>Previous Supplier Due</span>
                <strong>
                  {formatCurrency(
                    toNumber(selectedPurchase.previous_supplier_balance),
                  )}
                </strong>
              </p>
              <p className="detailOutstanding">
                <span>Total Outstanding</span>
                <strong>
                  {formatCurrency(
                    toNumber(selectedPurchase.closing_supplier_balance),
                  )}
                </strong>
              </p>
            </div>

            {selectedPurchase.notes && (
              <div className="purchaseNotesFull">
                <span>Notes</span>
                <p>{selectedPurchase.notes}</p>
              </div>
            )}

            <div className="modalActions">
              <button
                type="button"
                className="editButton"
                onClick={() => openEditModal(selectedPurchase)}
              >
                Edit Purchase Details
              </button>

              <button
                type="button"
                className="addMissedItemButton"
                onClick={() => openAddItemModal(selectedPurchase)}
              >
                + Add Missed Items
              </button>

              <button
                type="button"
                onClick={() => printPurchase(selectedPurchase)}
              >
                Print Purchase Bill
              </button>

              {toNumber(selectedPurchase.due_amount) > 0 &&
                selectedPurchase.supplier_id && (
                  <button
                    type="button"
                    onClick={() => openPaymentModal(selectedPurchase)}
                  >
                    Record Due Payment
                  </button>
                )}

              <button
                type="button"
                className="deletePurchaseButton"
                onClick={openDeletePurchaseModal}
              >
                Delete Purchase
              </button>

              <button
                type="button"
                className="closeTextButton"
                onClick={() => setSelectedPurchase(null)}
              >
                ✕ Close
              </button>
            </div>
          </section>
        </div>
      )}

      {showDeleteModal && selectedPurchase && (
        <div className="modalOverlay">
          <form
            className="deletePurchaseModal"
            onSubmit={deletePurchaseSafely}
          >
            <button
              type="button"
              className="closeButton"
              onClick={() => {
                if (!deletingPurchase) {
                  setShowDeleteModal(false);
                }
              }}
              aria-label="Close delete purchase dialog"
            >
              ✕
            </button>

            <span>DELETE PURCHASE</span>
            <h2>{selectedPurchase.purchase_number}</h2>

            <div className="deleteWarningBox">
              <strong>
                This action reverses stock and supplier balance.
              </strong>
              <p>
                Deletion is blocked when supplier payments,
                returns, or insufficient current stock are
                detected.
              </p>
            </div>

            <label className="deleteField">
              <span>Deletion Reason *</span>
              <textarea
                value={deletionReason}
                onChange={(event) =>
                  setDeletionReason(event.target.value)
                }
                placeholder="Example: Test purchase entered by mistake"
              />
            </label>

            <label className="deleteField">
              <span>Type DELETE to confirm *</span>
              <input
                value={deleteConfirmation}
                onChange={(event) =>
                  setDeleteConfirmation(event.target.value)
                }
                placeholder="DELETE"
                autoComplete="off"
              />
            </label>

            <div className="editModalActions">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingPurchase}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="confirmDeleteButton"
                disabled={
                  deletingPurchase ||
                  deleteConfirmation.trim().toUpperCase() !==
                    "DELETE" ||
                  deletionReason.trim().length < 3
                }
              >
                {deletingPurchase
                  ? "Deleting..."
                  : "Delete & Reverse Stock"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showAddItemModal && addingItemPurchase && (
        <div className="modalOverlay">
          <form
            className="itemEditModal addMissedItemModal"
            onSubmit={saveAddedPurchaseItem}
          >
            <button
              type="button"
              className="closeButton"
              onClick={() => {
                if (!savingAddItem) {
                  setShowAddItemModal(false);
                  setAddingItemPurchase(null);
                }
              }}
              aria-label="Close add missed item form"
            >
              ✕
            </button>

            <span>ADD MISSED ITEM</span>
            <h2>
              {addingItemPurchase.purchase_number || "Purchase"}
            </h2>

            <p className="editSafetyNote">
              This item will be saved under the same purchase number.
              Stock, GST, purchase total, supplier due and outstanding
              will be recalculated together.
            </p>

            <div className="addItemPurchaseSummary">
              <div>
                <span>Supplier</span>
                <strong>
                  {addingItemPurchase.supplier_name || "—"}
                </strong>
              </div>
              <div>
                <span>Current Total</span>
                <strong>
                  {formatCurrency(
                    toNumber(addingItemPurchase.total_amount),
                  )}
                </strong>
              </div>
              <div>
                <span>Current Due</span>
                <strong>
                  {formatCurrency(
                    toNumber(addingItemPurchase.due_amount),
                  )}
                </strong>
              </div>
            </div>

            <div className="editPurchaseGrid">
              {[
                ["Product Name *", "productName", "text"],
                ["Brand *", "brand", "text"],
                ["Size", "size", "text"],
                ["Colour", "color", "text"],
                ["SKU / Model No.", "sku", "text"],
                ["Barcode", "barcode", "text"],
                ["Quantity *", "quantity", "number"],
                ["Purchase Price / Pc *", "purchasePrice", "number"],
                ["Discount / Pc", "purchaseDiscount", "number"],
                ["Selling Price", "sellingPrice", "number"],
                ["MRP *", "mrp", "number"],
                ["GST %", "taxPercent", "number"],
                ["Cess %", "cessPercent", "number"],
                ["HSN Code", "hsnCode", "text"],
                ["Online Quantity", "onlineQuantity", "number"],
              ].map(([label, field, type]) => (
                <label key={field}>
                  <span>{label}</span>
                  <input
                    type={type}
                    min={type === "number" ? "0" : undefined}
                    step={
                      [
                        "purchasePrice",
                        "purchaseDiscount",
                        "sellingPrice",
                        "mrp",
                        "taxPercent",
                        "cessPercent",
                      ].includes(field)
                        ? "0.01"
                        : type === "number"
                          ? "1"
                          : undefined
                    }
                    value={
                      itemEditForm[
                        field as keyof PurchaseItemEditForm
                      ]
                    }
                    placeholder={
                      field === "quantity"
                        ? "Enter quantity"
                        : field === "barcode"
                          ? "Leave blank for auto"
                          : field === "sku"
                            ? "Optional model number"
                            : undefined
                    }
                    onChange={(event) =>
                      updateItemEditField(
                        field as keyof PurchaseItemEditForm,
                        event.target.value,
                      )
                    }
                  />
                </label>
              ))}
            </div>

            {(() => {
              const grossPurchase = Math.max(
                0,
                toNumber(itemEditForm.purchasePrice),
              );
              const discountPerPiece = Math.max(
                0,
                toNumber(itemEditForm.purchaseDiscount),
              );
              const netPurchase = Math.max(
                0,
                grossPurchase - discountPerPiece,
              );
              const gstPercent = Math.max(
                0,
                toNumber(itemEditForm.taxPercent),
              );
              const cessPercent = Math.max(
                0,
                toNumber(itemEditForm.cessPercent),
              );
              const gstAmount =
                Math.round(
                  ((netPurchase * gstPercent) / 100) * 100,
                ) / 100;
              const cessAmount =
                Math.round(
                  ((netPurchase * cessPercent) / 100) * 100,
                ) / 100;
              const landedCost =
                Math.round(
                  (netPurchase + gstAmount + cessAmount) * 100,
                ) / 100;

              return (
                <div className="addItemCostPreview">
                  <div>
                    <span>Net Purchase / Pc</span>
                    <strong>{formatCurrency(netPurchase)}</strong>
                    <small>Purchase Price − Discount</small>
                  </div>

                  <div>
                    <span>GST Amount / Pc</span>
                    <strong>{formatCurrency(gstAmount)}</strong>
                    <small>{gstPercent}% on net purchase</small>
                  </div>

                  <div>
                    <span>Cess Amount / Pc</span>
                    <strong>{formatCurrency(cessAmount)}</strong>
                    <small>{cessPercent}% on net purchase</small>
                  </div>

                  <div className="landedCostHighlight">
                    <span>Landed Cost / Pc</span>
                    <strong>{formatCurrency(landedCost)}</strong>
                    <small>Net Purchase + GST + Cess</small>
                  </div>
                </div>
              );
            })()}

            <div className="addMissedItemNote">
              Same Brand + Product + Size + Colour matches existing
              stock. A new size or colour creates a new variant.
              Leave Barcode blank for automatic generation.
            </div>

            <div className="editModalActions">
              <button
                type="button"
                onClick={() => {
                  if (!savingAddItem) {
                    setShowAddItemModal(false);
                    setAddingItemPurchase(null);
                  }
                }}
                disabled={savingAddItem}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="saveEditButton"
                disabled={savingAddItem}
              >
                {savingAddItem
                  ? "Adding Item..."
                  : "Add Item to Same Purchase"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showItemEditModal &&
        editingItem &&
        selectedPurchase && (
          <div className="modalOverlay">
            <form
              className="itemEditModal"
              onSubmit={savePurchaseItemEdit}
            >
              <button
                type="button"
                className="closeButton"
                onClick={() => {
                  if (!savingItemEdit) {
                    setShowItemEditModal(false);
                    setEditingItem(null);
                    setItemEditError("");
                  }
                }}
                aria-label="Close item edit form"
              >
                ✕
              </button>

              <span>EDIT PURCHASE ITEM</span>
              <h2>{editingItem.product_name || "Product"}</h2>

              <p className="editSafetyNote">
                Brand changes move this purchase quantity to a separate
                brand-safe product and variant. Quantity changes update only
                the stock difference. Purchase totals, tax, supplier due and
                ledger balance are recalculated automatically.
              </p>

              {itemEditError && (
                <div className="itemEditInlineError">
                  <strong>Unable to update</strong>
                  <span>{itemEditError}</span>
                </div>
              )}

              <div className="editPurchaseGrid">
                {[
                  ["Product Name", "productName", "text"],
                  ["Brand", "brand", "text"],
                  ["Size", "size", "text"],
                  ["Colour", "color", "text"],
                  ["SKU", "sku", "text"],
                  ["Barcode", "barcode", "text"],
                  ["Quantity", "quantity", "number"],
                  ["Purchase Price", "purchasePrice", "number"],
                  ["Selling Price", "sellingPrice", "number"],
                  ["MRP", "mrp", "number"],
                  ["GST %", "taxPercent", "number"],
                  ["Cess %", "cessPercent", "number"],
                  ["HSN Code", "hsnCode", "text"],
                  ["Online Quantity", "onlineQuantity", "number"],
                ].map(([label, field, type]) => (
                  <label key={field}>
                    <span>{label}</span>
                    <input
                      type={type}
                      min={type === "number" ? "0" : undefined}
                      step={
                        [
                          "purchasePrice",
                          "sellingPrice",
                          "mrp",
                          "taxPercent",
                          "cessPercent",
                        ].includes(field)
                          ? "0.01"
                          : type === "number"
                            ? "1"
                            : undefined
                      }
                      value={
                        itemEditForm[
                          field as keyof PurchaseItemEditForm
                        ]
                      }
                      onChange={(event) =>
                        updateItemEditField(
                          field as keyof PurchaseItemEditForm,
                          event.target.value,
                        )
                      }
                    />
                  </label>
                ))}
              </div>

              <div className="editModalActions">
                <button
                  type="button"
                  onClick={() => {
                    if (!savingItemEdit) {
                      setShowItemEditModal(false);
                      setEditingItem(null);
                    }
                  }}
                  disabled={savingItemEdit}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="saveEditButton"
                  disabled={savingItemEdit}
                >
                  {savingItemEdit
                    ? "Updating Item..."
                    : "Update Item & Stock"}
                </button>
              </div>
            </form>
          </div>
        )}

      {showEditModal && editingPurchase && (
        <div className="modalOverlay">
          <form
            className="editPurchaseModal"
            onSubmit={savePurchaseEdit}
          >
            <button
              type="button"
              className="closeButton"
              onClick={closeEditModal}
              aria-label="Close purchase edit form"
            >
              ✕
            </button>

            <span>EDIT PURCHASE</span>
            <h2>
              {editingPurchase.purchase_number ||
                "Purchase Details"}
            </h2>

            <p className="editSafetyNote">
              Supplier, invoice, date, GST, payment reference
              and notes can be corrected here. Product quantity,
              stock and financial totals are protected to avoid
              stock mismatch.
            </p>

            <div className="editPurchaseGrid">
              <label>
                <span>Supplier Name *</span>
                <input
                  value={editForm.supplierName}
                  onChange={(event) =>
                    updateEditField(
                      "supplierName",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>Supplier Mobile</span>
                <input
                  value={editForm.supplierPhone}
                  onChange={(event) =>
                    updateEditField(
                      "supplierPhone",
                      event.target.value.replace(
                        /[^0-9+]/g,
                        "",
                      ),
                    )
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                <span>Supplier Invoice No.</span>
                <input
                  value={editForm.supplierInvoiceNumber}
                  onChange={(event) =>
                    updateEditField(
                      "supplierInvoiceNumber",
                      event.target.value,
                    )
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                <span>Purchase Date *</span>
                <input
                  type="date"
                  value={editForm.purchaseDate}
                  onChange={(event) =>
                    updateEditField(
                      "purchaseDate",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>Credit Due Date</span>
                <input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(event) =>
                    updateEditField(
                      "dueDate",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>GSTIN</span>
                <input
                  value={editForm.supplierGstin}
                  onChange={(event) =>
                    updateEditField(
                      "supplierGstin",
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 15),
                    )
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                <span>Supplier State</span>
                <input
                  value={editForm.supplierState}
                  onChange={(event) =>
                    updateEditField(
                      "supplierState",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>State Code</span>
                <input
                  value={editForm.supplierStateCode}
                  onChange={(event) =>
                    updateEditField(
                      "supplierStateCode",
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 2),
                    )
                  }
                />
              </label>

              <label>
                <span>Place of Supply</span>
                <input
                  value={editForm.placeOfSupply}
                  onChange={(event) =>
                    updateEditField(
                      "placeOfSupply",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>Tax Type</span>
                <select
                  value={editForm.taxType}
                  onChange={(event) =>
                    updateEditField(
                      "taxType",
                      event.target.value,
                    )
                  }
                >
                  <option value="intra_state">
                    Intra-state (CGST + SGST)
                  </option>
                  <option value="inter_state">
                    Inter-state (IGST)
                  </option>
                  <option value="non_gst">Non-GST</option>
                </select>
              </label>

              <label>
                <span>Payment Method</span>
                <select
                  value={editForm.paymentMethod}
                  onChange={(event) =>
                    updateEditField(
                      "paymentMethod",
                      event.target.value,
                    )
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">
                    Bank Transfer
                  </option>
                  <option value="credit">Credit</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                <span>Payment Reference</span>
                <input
                  value={editForm.paymentReference}
                  onChange={(event) =>
                    updateEditField(
                      "paymentReference",
                      event.target.value,
                    )
                  }
                  placeholder="UPI / bank reference"
                />
              </label>
            </div>

            <label className="editNotesField">
              <span>Notes</span>
              <textarea
                value={editForm.notes}
                onChange={(event) =>
                  updateEditField(
                    "notes",
                    event.target.value,
                  )
                }
                placeholder="Purchase notes"
              />
            </label>

            <div className="editModalActions">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={savingEdit}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="saveEditButton"
                disabled={savingEdit}
              >
                {savingEdit
                  ? "Updating..."
                  : "Update Purchase"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showPaymentModal && selectedPurchase && (
        <div className="modalOverlay">
          <section className="paymentModal">
            <button
              type="button"
              className="closeButton"
              onClick={() => {
                setShowPaymentModal(false);
                setSelectedPurchase(null);
              }}
            >
              ×
            </button>

            <span>SUPPLIER PAYMENT</span>
            <h2>{selectedPurchase.supplier_name || "Supplier"}</h2>
            <p>
              Current due:{" "}
              <strong>
                {formatCurrency(toNumber(selectedPurchase.due_amount))}
              </strong>
            </p>

            <div className="paymentFormGrid">
              <label>
                <span>Payment Amount</span>
                <input
                  type="number"
                  min="0"
                  max={toNumber(selectedPurchase.due_amount)}
                  step="0.01"
                  value={paymentAmount || ""}
                  onChange={(event) =>
                    setPaymentAmount(
                      Math.max(0, toNumber(event.target.value)),
                    )
                  }
                />
              </label>

              <label>
                <span>Payment Method</span>
                <select
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value)
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                <span>Payment Date</span>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(event) =>
                    setPaymentDate(event.target.value)
                  }
                />
              </label>

              <label>
                <span>Reference</span>
                <input
                  value={paymentReference}
                  onChange={(event) =>
                    setPaymentReference(event.target.value)
                  }
                  placeholder="UPI / bank reference"
                />
              </label>
            </div>

            <label>
              <span>Payment Notes</span>
              <textarea
                value={paymentNotes}
                onChange={(event) =>
                  setPaymentNotes(event.target.value)
                }
                placeholder="Optional"
              />
            </label>

            <button
              type="button"
              onClick={recordDuePayment}
              disabled={savingPayment}
            >
              {savingPayment ? "Updating..." : "Save Payment"}
            </button>
          </section>
        </div>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .purchaseHistoryPage {
          min-height: 100vh;
          padding: 26px;
          background:
            radial-gradient(
              circle at 10% 0%,
              rgba(212, 175, 55, 0.12),
              transparent 26%
            ),
            ${IVORY};
          color: #2c2c2c;
          font-family: Poppins, Inter, Arial, sans-serif;
        }

        .pageHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
          padding: 22px 24px;
          border: 1px solid rgba(212, 175, 55, 0.35);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 88% 0%,
              rgba(212, 175, 55, 0.23),
              transparent 32%
            ),
            linear-gradient(135deg, ${DEEP_BLUE}, ${ROYAL_BLUE});
          color: #ffffff;
          box-shadow: 0 18px 45px rgba(3, 21, 63, 0.18);
        }

        .pageHeader > div > span {
          color: ${GOLD};
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .pageHeader h1 {
          margin: 5px 0 0;
          font-size: 32px;
          font-weight: 950;
        }

        .pageHeader p {
          margin: 6px 0 0;
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
        }

        .pageHeader button {
          min-height: 44px;
          padding: 0 15px;
          border: 1px solid ${GOLD};
          border-radius: 12px;
          background: ${GOLD};
          color: ${ROYAL_BLUE};
          font-weight: 900;
          cursor: pointer;
        }

        .notice,
        .error {
          margin-bottom: 14px;
          padding: 13px 15px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 750;
        }

        .notice {
          border: 1px solid #a6f4c5;
          background: #ecfdf3;
          color: #067647;
        }

        .error {
          border: 1px solid #fecdca;
          background: #fef3f2;
          color: #b42318;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .statsGrid article {
          position: relative;
          isolation: isolate;
          min-height: 108px;
          overflow: hidden;
          padding: 18px;
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 18px;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.99),
            rgba(3, 21, 63, 0.98)
          );
          box-shadow:
            0 12px 28px rgba(3, 21, 63, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          transition:
            transform 0.22s ease,
            box-shadow 0.22s ease,
            border-color 0.22s ease;
          animation: purchaseStatRise 0.45s ease both;
        }

        .statsGrid article:nth-child(1) {
          animation-delay: 0.04s;
        }

        .statsGrid article:nth-child(2) {
          animation-delay: 0.09s;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.99),
            rgba(18, 44, 101, 0.98),
            rgba(103, 79, 16, 0.9)
          );
        }

        .statsGrid article:nth-child(3) {
          animation-delay: 0.14s;
        }

        .statsGrid article:nth-child(4) {
          animation-delay: 0.19s;
          background: linear-gradient(
            135deg,
            rgba(8, 37, 98, 0.99),
            rgba(3, 21, 63, 0.98),
            rgba(95, 72, 13, 0.9)
          );
        }

        .statsGrid article:nth-child(5) {
          animation-delay: 0.24s;
        }

        .statsGrid article::before {
          content: "";
          position: absolute;
          z-index: -1;
          top: -42%;
          right: -18%;
          width: 126px;
          height: 126px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(212, 175, 55, 0.34),
            rgba(212, 175, 55, 0)
          );
          transition: transform 0.28s ease;
        }

        .statsGrid article::after {
          content: "";
          position: absolute;
          top: -145%;
          left: -36%;
          width: 42%;
          height: 370%;
          transform: rotate(22deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.14),
            transparent
          );
          animation: purchaseStatShine 5.2s ease-in-out infinite;
          pointer-events: none;
        }

        .statsGrid article:nth-child(2)::after {
          animation-delay: 0.7s;
        }

        .statsGrid article:nth-child(3)::after {
          animation-delay: 1.4s;
        }

        .statsGrid article:nth-child(4)::after {
          animation-delay: 2.1s;
        }

        .statsGrid article:nth-child(5)::after {
          animation-delay: 2.8s;
        }

        .statsGrid article:hover {
          transform: translateY(-2px) scale(1.004);
          border-color: rgba(212, 175, 55, 0.42);
          box-shadow:
            0 16px 32px rgba(3, 21, 63, 0.22),
            0 0 0 1px rgba(212, 175, 55, 0.1);
        }

        .statsGrid article:hover::before {
          transform: scale(1.08);
        }

        .statsGrid span {
          position: relative;
          z-index: 2;
          display: block;
          color: rgba(212, 175, 55, 0.94);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.55px;
          text-transform: uppercase;
        }

        .statsGrid strong {
          position: relative;
          z-index: 2;
          display: block;
          margin-top: 9px;
          color: #ffffff;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -0.45px;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
        }

        .statsGrid article:nth-child(2) strong,
        .statsGrid article:nth-child(4) strong {
          color: #f6d676;
        }

        .panel {
          overflow: hidden;
          border: 1px solid rgba(10, 46, 115, 0.1);
          border-radius: 20px;
          background: white;
          box-shadow: 0 12px 32px rgba(10, 46, 115, 0.07);
        }

        .toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 190px 190px;
          gap: 10px;
          padding: 16px;
          border-bottom: 1px solid #edf0f4;
        }

        .searchBox {
          display: flex;
          align-items: center;
          min-height: 46px;
          padding: 0 12px;
          border: 1px solid #dfe4eb;
          border-radius: 11px;
          background: #fbfcfe;
        }

        .searchBox span {
          margin-right: 8px;
          color: ${ROYAL_BLUE};
          font-size: 21px;
        }

        .searchBox input,
        .toolbar select,
        .paymentModal input {
          width: 100%;
          min-height: 43px;
          padding: 0 10px;
          border: 1px solid #dfe4eb;
          border-radius: 10px;
          outline: none;
          background: white;
          font: inherit;
          font-size: 11px;
          font-weight: 700;
        }

        .searchBox input {
          min-height: auto;
          padding: 0;
          border: 0;
          background: transparent;
        }

        .purchaseList {
          display: grid;
          gap: 13px;
          padding: 15px;
          background: #f8fafc;
        }

        .purchaseCard {
          padding: 16px;
          border: 1px solid #e4e7ec;
          border-radius: 16px;
          background: white;
          box-shadow: 0 6px 18px rgba(16, 24, 40, 0.05);
        }

        .purchaseCard header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .purchaseCard header > div > span {
          color: ${GOLD};
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .itemBrand,
        .brandLine {
          color: #0a2e73 !important;
          font-weight: 900 !important;
        }

        .purchaseCard h2 {
          margin: 4px 0 0;
          color: ${DEEP_BLUE};
          font-size: 17px;
        }

        .purchaseCard header p {
          margin: 5px 0 0;
          color: #8a93a0;
          font-size: 10px;
        }

        .statusBadge {
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 850;
        }

        .status-paid {
          background: #ecfdf3;
          color: #067647;
        }

        .status-partial {
          background: #fff4e8;
          color: #b54708;
        }

        .status-unpaid {
          background: #fef3f2;
          color: #b42318;
        }

        .purchaseMeta {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 9px;
          margin-top: 14px;
        }

        .purchaseMeta > div {
          padding: 10px;
          border-radius: 10px;
          background: #f8fafc;
        }

        .purchaseMeta span,
        .purchaseMeta strong {
          display: block;
        }

        .purchaseMeta span {
          color: #98a2b3;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .purchaseMeta strong {
          margin-top: 4px;
          color: #344054;
          font-size: 10px;
        }

        .dueText {
          color: #b42318 !important;
        }

        .itemPreview {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-top: 12px;
        }

        .itemPreview > div {
          min-width: 0;
          padding: 10px;
          border: 1px solid #e4e7ec;
          border-radius: 10px;
        }

        .itemPreview strong,
        .itemPreview span {
          display: block;
        }

        .itemPreview strong {
          overflow: hidden;
          color: ${ROYAL_BLUE};
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .itemPreview span {
          margin-top: 4px;
          color: #8a93a0;
          font-size: 8px;
        }

        .purchaseCard footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 13px;
        }

        .purchaseCard footer button,
        .modalActions button,
        .paymentModal > button:last-child {
          min-height: 38px;
          padding: 0 12px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: white;
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 850;
          cursor: pointer;
        }

        .purchaseCard footer .payButton {
          border-color: ${GOLD};
          background: ${ROYAL_BLUE};
          color: white;
        }

        .purchaseCard footer .editButton,
        .modalActions .editButton {
          border-color: ${GOLD};
          background: #fffaf0;
          color: ${ROYAL_BLUE};
        }

        .loadingState,
        .emptyState {
          min-height: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          text-align: center;
        }

        .spinner {
          width: 43px;
          height: 43px;
          border: 4px solid #e6eaf0;
          border-top-color: ${ROYAL_BLUE};
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loadingState h2,
        .emptyState h2 {
          margin: 14px 0 0;
          color: ${ROYAL_BLUE};
          font-size: 19px;
        }

        .modalOverlay {
          position: fixed;
          z-index: 1000;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(3, 21, 63, 0.68);
        }

        .detailsModal,
        .paymentModal,
        .editPurchaseModal,
        .itemEditModal,
        .deletePurchaseModal {
          position: relative;
          width: min(760px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          padding: 24px;
          border: 1px solid rgba(212, 175, 55, 0.4);
          border-radius: 20px;
          background: white;
          box-shadow: 0 28px 70px rgba(3, 21, 63, 0.28);
        }

        .detailsModal {
          width: min(1120px, 96vw);
          height: min(880px, 92vh);
          max-height: 92vh;
          padding: 0 18px 22px;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
        }

        .detailsQuickToolbar {
          position: sticky;
          z-index: 20;
          top: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          margin: 0 -18px 16px;
          padding: 12px 18px;
          border-bottom: 1px solid rgba(10, 46, 115, 0.12);
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 8px 18px rgba(3, 21, 63, 0.08);
          backdrop-filter: blur(10px);
        }

        .detailsQuickSearch {
          min-width: 0;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
          min-height: 44px;
          padding: 0 12px;
          border: 1px solid rgba(10, 46, 115, 0.18);
          border-radius: 13px;
          background: #f8fafc;
        }

        .detailsQuickSearch > span {
          color: ${GOLD};
          font-size: 20px;
          font-weight: 950;
        }

        .detailsQuickSearch input {
          min-width: 0;
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #1f2937;
          font-size: 13px;
          font-weight: 700;
        }

        .detailsQuickSearch input::placeholder {
          color: #98a2b3;
          font-weight: 600;
        }

        .detailsClearSearch,
        .detailsCloseSticky {
          min-height: 38px;
          border-radius: 11px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 950;
        }

        .detailsClearSearch {
          padding: 0 10px;
          border: 1px solid rgba(10, 46, 115, 0.14);
          background: #ffffff;
          color: ${ROYAL_BLUE};
        }

        .detailsCloseSticky {
          min-width: 104px;
          padding: 0 14px;
          border: 1px solid ${GOLD};
          background: ${ROYAL_BLUE};
          color: #ffffff;
          box-shadow: 0 8px 18px rgba(3, 21, 63, 0.16);
        }

        .paymentModal {
          width: min(440px, 100%);
        }

        .editPurchaseModal,
        .itemEditModal {
          width: min(880px, 100%);
        }

        .deletePurchaseModal {
          width: min(520px, 100%);
        }

        .detailsModal > span,
        .paymentModal > span,
        .editPurchaseModal > span,
        .itemEditModal > span,
        .deletePurchaseModal > span {
          color: ${GOLD};
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .detailsModal h2,
        .paymentModal h2,
        .editPurchaseModal h2,
        .itemEditModal h2,
        .deletePurchaseModal h2 {
          margin: 7px 0 0;
          color: ${ROYAL_BLUE};
        }

        .closeButton {
          position: absolute;
          z-index: 2;
          top: 12px;
          right: 12px;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          padding: 0;
          border: 1px solid ${GOLD};
          border-radius: 50%;
          background: ${ROYAL_BLUE};
          color: #ffffff;
          font-size: 17px;
          font-weight: 950;
          line-height: 1;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(3, 21, 63, 0.22);
        }

        .modalSubtitle {
          margin: 5px 0 0;
          color: #667085;
          font-size: 10px;
        }

        .detailsGridWide {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        }

        .detailsItemFull {
          display: grid !important;
          grid-template-columns:
            minmax(250px, 1.35fr)
            minmax(430px, 2fr)
            112px;
          grid-template-areas: "name numbers edit";
          gap: 10px;
          align-items: center;
          padding: 9px 10px !important;
          border-radius: 12px !important;
        }

        .detailsItemName {
          grid-area: name;
          min-width: 0;
        }

        .detailsItemName > strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 11px !important;
        }

        .detailsItemName > span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-top: 2px !important;
          font-size: 7px !important;
        }

        .editItemButton {
          grid-area: edit;
          width: 100%;
          min-height: 38px;
          align-self: center;
        }

        .detailsItemNumbers {
          grid-area: numbers;
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 5px;
        }

        .detailsItemNumbers p {
          margin: 0;
          min-width: 0;
          padding: 6px;
          border-radius: 8px;
          background: #f8fafc;
        }

        .detailsItemNumbers p span,
        .detailsItemNumbers p strong {
          display: block;
        }

        .detailsItemNumbers p span {
          color: #98a2b3;
          font-size: 7px;
          font-weight: 800;
        }

        .detailsItemNumbers p strong {
          margin-top: 3px;
          color: ${ROYAL_BLUE};
          font-size: 9px;
        }

        .editItemButton {
          align-self: center;
          min-height: 36px;
          padding: 0 12px;
          border: 1px solid ${GOLD};
          border-radius: 9px;
          background: #fffaf0;
          color: ${ROYAL_BLUE};
          font-size: 8px;
          font-weight: 950;
          cursor: pointer;
          white-space: nowrap;
        }

        .editItemButton:hover {
          transform: translateY(-1px);
          background: ${ROYAL_BLUE};
          color: #ffffff;
        }

        .purchaseTotalsDetailed {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-top: 16px;
        }

        .purchaseTotalsDetailed p {
          margin: 0;
          padding: 10px;
          border-radius: 10px;
          background: #f8fafc;
        }

        .purchaseTotalsDetailed span,
        .purchaseTotalsDetailed strong {
          display: block;
        }

        .purchaseTotalsDetailed span {
          color: #98a2b3;
          font-size: 8px;
          font-weight: 800;
        }

        .purchaseTotalsDetailed strong {
          margin-top: 4px;
          color: #344054;
          font-size: 10px;
        }

        .purchaseTotalsDetailed .detailGrand {
          background: ${ROYAL_BLUE};
        }

        .purchaseTotalsDetailed .detailGrand span,
        .purchaseTotalsDetailed .detailGrand strong {
          color: #ffffff;
        }

        .purchaseTotalsDetailed .detailOutstanding {
          border: 1px solid ${GOLD};
          background: #fffaf0;
        }

        .purchaseTotalsDetailed .detailOutstanding strong {
          color: #b42318;
        }

        .purchaseNotesFull {
          margin-top: 14px;
          padding: 12px;
          border: 1px solid #e4e7ec;
          border-radius: 10px;
          background: #fbfcfe;
        }

        .purchaseNotesFull span {
          color: ${GOLD};
          font-size: 8px;
          font-weight: 900;
        }

        .purchaseNotesFull p {
          margin: 5px 0 0;
          color: #475467;
          font-size: 10px;
          white-space: pre-wrap;
        }

        .modalActions .closeTextButton {
          border-color: #f3b7b2;
          background: #fff6f5;
          color: #b42318;
        }

        .modalActions .deletePurchaseButton {
          border-color: #f04438;
          background: #fff1f0;
          color: #b42318;
        }

        .modalActions .deletePurchaseButton:hover {
          background: #b42318;
          color: #ffffff;
        }

        .deleteWarningBox {
          margin-top: 12px;
          padding: 13px;
          border: 1px solid #fda29b;
          border-radius: 12px;
          background: #fff1f0;
          color: #912018;
        }

        .deleteWarningBox strong {
          display: block;
          font-size: 11px;
          font-weight: 950;
        }

        .deleteWarningBox p {
          margin: 6px 0 0;
          font-size: 9px;
          line-height: 1.55;
        }

        .deleteField {
          display: grid;
          gap: 6px;
          margin-top: 13px;
        }

        .deleteField > span {
          color: #667085;
          font-size: 9px;
          font-weight: 850;
        }

        .deleteField input,
        .deleteField textarea {
          width: 100%;
          min-height: 44px;
          padding: 10px;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          outline: none;
          background: #ffffff;
          color: #344054;
          font: inherit;
          font-size: 10px;
          font-weight: 700;
        }

        .deleteField textarea {
          min-height: 86px;
          resize: vertical;
        }

        .deleteField input:focus,
        .deleteField textarea:focus {
          border-color: #f04438;
          box-shadow: 0 0 0 3px rgba(240, 68, 56, 0.12);
        }

        .editModalActions .confirmDeleteButton {
          border-color: #b42318;
          background: #b42318;
          color: #ffffff;
        }

        .editSafetyNote {
          margin: 7px 0 0;
          padding: 11px 12px;
          border: 1px solid #fedf89;
          border-radius: 10px;
          background: #fffaeb;
          color: #8a5b00;
          font-size: 9px;
          line-height: 1.55;
        }

        .editPurchaseGrid {
          display: grid;
          grid-template-columns: repeat(
            3,
            minmax(0, 1fr)
          );
          gap: 10px;
          margin-top: 16px;
        }

        .addMissedItemButton {
          border-color: rgba(212, 175, 55, 0.75) !important;
          background: linear-gradient(
            135deg,
            #fff8dc,
            #f4d768
          ) !important;
          color: ${ROYAL_BLUE} !important;
          font-weight: 900 !important;
        }

        .addMissedItemModal {
          max-height: min(88vh, 850px);
          overflow-y: auto;
        }

        .addItemPurchaseSummary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
          margin: 12px 0 16px;
        }

        .addItemPurchaseSummary div {
          padding: 11px 12px;
          border: 1px solid #e2e7ef;
          border-radius: 11px;
          background: #f7f9fc;
        }

        .addItemPurchaseSummary span,
        .addItemPurchaseSummary strong {
          display: block;
        }

        .addItemPurchaseSummary span {
          color: #788396;
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .addItemPurchaseSummary strong {
          margin-top: 5px;
          color: ${ROYAL_BLUE};
          font-size: 11px;
        }

        .addItemCostPreview {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 9px;
          margin-top: 13px;
        }

        .addItemCostPreview > div {
          padding: 11px 12px;
          border: 1px solid rgba(212, 175, 55, 0.48);
          border-radius: 11px;
          background: #fff9e7;
        }

        .addItemCostPreview span,
        .addItemCostPreview strong,
        .addItemCostPreview small {
          display: block;
        }

        .addItemCostPreview span {
          color: #6f5b18;
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .addItemCostPreview strong {
          margin-top: 5px;
          color: ${ROYAL_BLUE};
          font-size: 15px;
          font-weight: 950;
        }

        .addItemCostPreview small {
          margin-top: 4px;
          color: #7a6a35;
          font-size: 8px;
          font-weight: 750;
          line-height: 1.35;
        }

        .addItemCostPreview .landedCostHighlight {
          border-color: #55b779;
          background: #ecfdf3;
        }

        .addItemCostPreview .landedCostHighlight span,
        .addItemCostPreview .landedCostHighlight strong {
          color: #067647;
        }

        .addMissedItemNote {
          margin-top: 13px;
          padding: 11px 12px;
          border: 1px solid #b9d7ff;
          border-radius: 11px;
          background: #eff7ff;
          color: #184b8f;
          font-size: 9px;
          font-weight: 750;
          line-height: 1.5;
        }

        .editPurchaseModal label,
        .itemEditModal label {
          display: grid;
          gap: 6px;
        }

        .editPurchaseModal label > span,
        .itemEditModal label > span {
          color: #667085;
          font-size: 9px;
          font-weight: 850;
        }

        .editPurchaseModal input,
        .editPurchaseModal select,
        .editPurchaseModal textarea,
        .itemEditModal input {
          width: 100%;
          min-height: 43px;
          padding: 0 10px;
          border: 1px solid #dfe4eb;
          border-radius: 10px;
          outline: none;
          background: #ffffff;
          color: #344054;
          font: inherit;
          font-size: 10px;
          font-weight: 700;
        }

        .editPurchaseModal input:focus,
        .editPurchaseModal select:focus,
        .editPurchaseModal textarea:focus,
        .itemEditModal input:focus {
          border-color: ${GOLD};
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.12);
        }

        .editNotesField {
          margin-top: 12px;
        }

        .editPurchaseModal textarea {
          min-height: 88px;
          padding: 10px;
          resize: vertical;
        }

        .itemEditInlineError {
          display: grid;
          gap: 3px;
          margin: 12px 0;
          padding: 11px 13px;
          border: 1px solid #fecdca;
          border-radius: 10px;
          background: #fef3f2;
          color: #b42318;
          font-size: 10px;
        }

        .itemEditInlineError strong {
          font-size: 11px;
          font-weight: 900;
        }

        .editModalActions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 15px;
        }

        .editModalActions button {
          min-height: 42px;
          padding: 0 15px;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          background: #ffffff;
          color: ${ROYAL_BLUE};
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .editModalActions .saveEditButton {
          border-color: ${GOLD};
          background: ${ROYAL_BLUE};
          color: #ffffff;
        }

        .editModalActions button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .paymentFormGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
          margin-top: 14px;
        }

        .paymentModal textarea {
          width: 100%;
          min-height: 70px;
          margin-top: 5px;
          padding: 10px;
          border: 1px solid #dfe4eb;
          border-radius: 10px;
          resize: vertical;
          font: inherit;
          font-size: 10px;
        }

        .detailsGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 9px;
          margin-top: 16px;
        }

        .detailsGrid p {
          margin: 0;
          padding: 10px;
          border-radius: 10px;
          background: #f8fafc;
        }

        .detailsGrid span,
        .detailsGrid strong {
          display: block;
        }

        .detailsGrid span {
          color: #98a2b3;
          font-size: 8px;
          font-weight: 800;
        }

        .detailsGrid strong {
          margin-top: 4px;
          color: #344054;
          font-size: 10px;
        }

        .detailsItems {
          display: grid;
          gap: 8px;
          margin-top: 15px;
        }

        .detailsItems article {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 11px;
          border: 1px solid #e4e7ec;
          border-radius: 10px;
        }

        .detailsItems strong,
        .detailsItems span {
          display: block;
        }

        .detailsItems strong {
          color: ${ROYAL_BLUE};
          font-size: 10px;
        }

        .detailsItems span {
          margin-top: 3px;
          color: #8a93a0;
          font-size: 8px;
        }

        .detailsNoResults {
          padding: 28px 16px;
          border: 1px dashed rgba(10, 46, 115, 0.22);
          border-radius: 14px;
          background: #f8fafc;
          color: #667085;
          text-align: center;
          font-size: 12px;
          font-weight: 800;
        }

        .modalActions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 16px;
        }

        .paymentModal p {
          color: #667085;
          font-size: 12px;
        }

        .paymentModal label {
          display: grid;
          gap: 6px;
          margin-top: 15px;
        }

        .paymentModal label span {
          color: #667085;
          font-size: 10px;
          font-weight: 800;
        }

        .paymentModal > button:last-child {
          width: 100%;
          margin-top: 14px;
          border-color: ${GOLD};
          background: ${ROYAL_BLUE};
          color: white;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes purchaseStatRise {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes purchaseStatShine {
          0%,
          62% {
            left: -42%;
            opacity: 0;
          }
          68% {
            opacity: 0.7;
          }
          100% {
            left: 126%;
            opacity: 0;
          }
        }

        @media (max-width: 1100px) {
          .statsGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .purchaseMeta {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .itemPreview {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .purchaseHistoryPage {
            padding: 16px 10px 40px;
          }

          .pageHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .pageHeader button {
            width: 100%;
          }

          .statsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .toolbar {
            grid-template-columns: 1fr;
          }

          .purchaseMeta {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .detailsGrid,
          .detailsGridWide,
          .purchaseTotalsDetailed {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .editPurchaseGrid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .detailsItemFull {
            grid-template-columns: minmax(0, 1fr) 110px;
            grid-template-areas:
              "name edit"
              "numbers numbers";
          }

          .detailsItemNumbers {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .detailsModal {
            width: 100%;
            height: 94vh;
            max-height: 94vh;
            padding-left: 12px;
            padding-right: 12px;
          }

          .detailsQuickToolbar {
            grid-template-columns: 1fr;
            margin-left: -12px;
            margin-right: -12px;
            padding-left: 12px;
            padding-right: 12px;
          }

          .detailsCloseSticky {
            width: 100%;
          }

          .detailsItemFull {
            grid-template-columns: 1fr;
            grid-template-areas:
              "name"
              "numbers"
              "edit";
          }

          .purchaseCard footer,
          .modalActions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .purchaseMeta,
          .itemPreview,
          .detailsGrid,
          .detailsGridWide,
          .purchaseTotalsDetailed,
          .paymentFormGrid,
          .editPurchaseGrid {
            grid-template-columns: 1fr !important;
          }

          .editModalActions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .detailsItemNumbers {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 760px) {
          .addItemPurchaseSummary,
          .addItemCostPreview {
            grid-template-columns: 1fr;
          }
        }

        /* ============================================================
           NCS PURCHASE HISTORY — INTERNATIONAL COLORFUL PREMIUM V2
           Same design family as Products V2 / Sales History V2.
           Visual-only layer: purchase, supplier due, edit, item edit,
           add missed items, print and safe-delete logic remain untouched.
           ============================================================ */

        .purchaseHistoryPage {
          min-height:100vh !important;
          padding:18px !important;
          background:
            radial-gradient(circle at 4% 0%,rgba(111,78,190,.10),transparent 24%),
            radial-gradient(circle at 96% 5%,rgba(25,155,164,.10),transparent 24%),
            radial-gradient(circle at 55% 100%,rgba(231,166,83,.08),transparent 26%),
            linear-gradient(180deg,#f7f7fb 0%,#f1f4f8 50%,#f8f4ed 100%) !important;
          color:#20283a !important;
        }

        /* HERO */
        .pageHeader {
          position:relative !important;
          overflow:hidden !important;
          min-height:150px !important;
          padding:22px 24px !important;
          border:1px solid rgba(255,255,255,.18) !important;
          border-radius:26px !important;
          background:
            radial-gradient(circle at 82% -15%,rgba(255,215,115,.30),transparent 31%),
            radial-gradient(circle at 12% 115%,rgba(230,86,170,.28),transparent 34%),
            linear-gradient(118deg,#31184f 0%,#5c32a8 35%,#3c6f93 68%,#1f8a7e 100%) !important;
          color:#fff !important;
          box-shadow:0 22px 55px rgba(40,31,72,.20) !important;
          animation:ncs-purchase-enter .55s cubic-bezier(.2,.8,.2,1) both !important;
        }

        .pageHeader::after {
          content:"PURCHASES";
          position:absolute;
          right:20px;
          top:50%;
          transform:translateY(-50%);
          color:rgba(255,255,255,.05);
          font-size:clamp(58px,7vw,112px);
          font-weight:1000;
          letter-spacing:1px;
          pointer-events:none;
        }

        .pageHeader > div,
        .pageHeader > button {
          position:relative;
          z-index:2;
        }

        .pageHeader > div > span {
          color:#f4d979 !important;
          font-size:9px !important;
          font-weight:900 !important;
          letter-spacing:1.1px !important;
        }

        .pageHeader h1 {
          margin:5px 0 5px !important;
          color:#fff !important;
          font-size:38px !important;
          letter-spacing:-1px !important;
          text-shadow:0 2px 12px rgba(0,0,0,.12) !important;
        }

        .pageHeader p {
          margin:0 !important;
          color:rgba(255,255,255,.72) !important;
          font-size:11px !important;
        }

        .pageHeader > button {
          min-height:44px !important;
          border:1px solid rgba(255,255,255,.28) !important;
          border-radius:13px !important;
          padding:0 16px !important;
          background:rgba(255,255,255,.12) !important;
          color:#fff !important;
          box-shadow:0 8px 20px rgba(21,18,42,.12) !important;
          backdrop-filter:blur(10px);
        }

        /* NOTICES */
        .notice,
        .error {
          margin-top:12px !important;
          border-radius:14px !important;
          box-shadow:none !important;
        }

        .notice {
          border:1px solid #bfe4d4 !important;
          background:#e8f7f0 !important;
          color:#2c8067 !important;
        }

        .error {
          border:1px solid #edc2c9 !important;
          background:#fff0f2 !important;
          color:#a74f60 !important;
        }

        /* KPI STATS */
        .statsGrid {
          gap:12px !important;
          margin-top:14px !important;
          animation:ncs-purchase-enter .65s .06s cubic-bezier(.2,.8,.2,1) both !important;
        }

        .statsGrid article {
          position:relative !important;
          overflow:hidden !important;
          min-height:116px !important;
          padding:15px !important;
          border:1.5px solid #e4e7ec !important;
          border-radius:21px !important;
          background:#fff !important;
          box-shadow:0 12px 28px rgba(39,44,61,.07) !important;
          transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease !important;
        }

        .statsGrid article::after {
          content:"";
          position:absolute;
          right:-24px;
          bottom:-30px;
          width:88px;
          height:88px;
          border-radius:50%;
          background:currentColor;
          opacity:.055;
          pointer-events:none;
        }

        .statsGrid article:hover {
          transform:translateY(-4px) scale(1.012) !important;
          box-shadow:0 18px 34px rgba(39,44,61,.12) !important;
        }

        .statsGrid article:nth-child(1) {
          background:linear-gradient(135deg,#ede7ff 0%,#f9f7ff 65%,#e8f4ff 100%) !important;
          border-color:#c8baf4 !important;
          color:#6549ba !important;
        }

        .statsGrid article:nth-child(2) {
          background:linear-gradient(135deg,#fff0cd 0%,#fffaf1 65%,#ffe5d4 100%) !important;
          border-color:#efc880 !important;
          color:#b0762b !important;
        }

        .statsGrid article:nth-child(3) {
          background:linear-gradient(135deg,#dcf6ec 0%,#f7fffb 64%,#def8f2 100%) !important;
          border-color:#a6dec9 !important;
          color:#27866c !important;
        }

        .statsGrid article:nth-child(4) {
          background:linear-gradient(135deg,#ffe1e8 0%,#fff5f7 65%,#ffe4d8 100%) !important;
          border-color:#efacb9 !important;
          color:#b05269 !important;
        }

        .statsGrid article:nth-child(5) {
          background:linear-gradient(135deg,#dff4f8 0%,#f8fdff 64%,#e7efff 100%) !important;
          border-color:#acd9e1 !important;
          color:#3e7d89 !important;
        }

        .statsGrid article span {
          color:currentColor !important;
          font-size:8.5px !important;
          font-weight:900 !important;
          letter-spacing:.62px !important;
          text-transform:uppercase !important;
        }

        .statsGrid article strong {
          display:block !important;
          margin-top:8px !important;
          color:#20283a !important;
          font-size:27px !important;
          font-weight:950 !important;
        }

        /* MAIN PANEL / FILTERS */
        .panel {
          margin-top:14px !important;
          border:1px solid #dde2ea !important;
          border-radius:24px !important;
          background:#fff !important;
          box-shadow:0 14px 36px rgba(39,44,61,.075) !important;
          overflow:hidden !important;
          animation:ncs-purchase-enter .72s .10s cubic-bezier(.2,.8,.2,1) both !important;
        }

        .toolbar {
          gap:10px !important;
          padding:14px !important;
          border-bottom:1px solid #e5e8ed !important;
          background:
            linear-gradient(135deg,#fbfbff 0%,#ffffff 48%,#f3fbfb 100%) !important;
        }

        .searchBox {
          border:1px solid #d9dee8 !important;
          border-radius:13px !important;
          background:#fff !important;
          box-shadow:0 5px 14px rgba(39,44,61,.035) !important;
        }

        .searchBox > span {
          color:#6c53b4 !important;
        }

        .searchBox input,
        .toolbar select {
          color:#273042 !important;
          background:#fff !important;
          font-weight:700 !important;
        }

        .toolbar select {
          height:44px !important;
          border:1px solid #dde2ea !important;
          border-radius:12px !important;
          box-shadow:0 4px 11px rgba(39,44,61,.025) !important;
        }

        .searchBox:focus-within,
        .toolbar select:focus {
          border-color:#755fc0 !important;
          box-shadow:0 0 0 4px rgba(117,95,192,.10),0 8px 20px rgba(39,44,61,.05) !important;
        }

        /* PURCHASE CARDS */
        .purchaseList {
          gap:12px !important;
          padding:14px !important;
        }

        .purchaseCard {
          position:relative !important;
          overflow:hidden !important;
          border:1px solid #dde2ea !important;
          border-radius:22px !important;
          background:#fff !important;
          box-shadow:0 10px 26px rgba(39,44,61,.06) !important;
          transition:transform .20s ease,box-shadow .20s ease,border-color .20s ease !important;
        }

        .purchaseCard::before {
          content:"";
          position:absolute;
          inset:0 auto 0 0;
          width:5px;
          background:linear-gradient(180deg,#6748c8,#8a65e5);
        }

        .purchaseCard:nth-child(5n+2)::before {
          background:linear-gradient(180deg,#23876d,#43b691);
        }

        .purchaseCard:nth-child(5n+3)::before {
          background:linear-gradient(180deg,#3f7f8b,#60a5b0);
        }

        .purchaseCard:nth-child(5n+4)::before {
          background:linear-gradient(180deg,#a65984,#d17aa6);
        }

        .purchaseCard:nth-child(5n+5)::before {
          background:linear-gradient(180deg,#b0762b,#dcaa5a);
        }

        .purchaseCard:hover {
          transform:translateY(-2px) !important;
          border-color:#c9cedb !important;
          box-shadow:0 16px 32px rgba(39,44,61,.095) !important;
        }

        .purchaseCard > header {
          padding:17px 18px 11px 21px !important;
        }

        .purchaseCard > header > div > span {
          display:inline-flex !important;
          width:max-content !important;
          padding:4px 8px !important;
          border:1px solid #d4c8ef !important;
          border-radius:999px !important;
          background:linear-gradient(135deg,#eee9fb,#f6f3ff) !important;
          color:#6650ad !important;
          font-size:8px !important;
          font-weight:950 !important;
          letter-spacing:.45px !important;
        }

        .purchaseCard h2 {
          margin:7px 0 3px !important;
          color:#273042 !important;
          font-size:17px !important;
          font-weight:950 !important;
        }

        .purchaseCard header p {
          color:#7a8190 !important;
          font-size:9px !important;
        }

        .statusBadge {
          border:1.5px solid transparent !important;
          border-radius:999px !important;
          padding:5px 9px !important;
          font-size:8px !important;
          font-weight:900 !important;
          box-shadow:none !important;
        }

        .status-paid {
          border-color:#bfe4d4 !important;
          background:#e8f7f0 !important;
          color:#2c8067 !important;
        }

        .status-partial {
          border-color:#efd49e !important;
          background:#fff4dc !important;
          color:#a97429 !important;
        }

        .status-unpaid,
        .status-due {
          border-color:#edc2c9 !important;
          background:#fff0f2 !important;
          color:#a74f60 !important;
        }

        /* META GRID */
        .purchaseMeta {
          margin:0 18px 0 21px !important;
          gap:7px !important;
          padding:12px !important;
          border:1px solid #e1e5eb !important;
          border-radius:15px !important;
          background:linear-gradient(180deg,#fbfcfe,#f7f9fb) !important;
        }

        .purchaseMeta > div {
          padding:9px 10px !important;
          border-radius:11px !important;
          background:#fff !important;
          box-shadow:0 4px 11px rgba(39,44,61,.025) !important;
        }

        .purchaseMeta span {
          color:#7b8190 !important;
          font-size:7px !important;
          font-weight:850 !important;
        }

        .purchaseMeta strong {
          margin-top:4px !important;
          color:#273042 !important;
          font-size:13px !important;
        }

        .dueText {
          color:#a74f60 !important;
        }

        /* ITEM PREVIEW */
        .itemPreview {
          gap:8px !important;
          padding:12px 18px 12px 21px !important;
        }

        .itemPreview > div {
          border:1px solid #e5e8ed !important;
          border-radius:13px !important;
          background:#fafbfc !important;
          box-shadow:none !important;
        }

        .itemPreview > div:nth-child(4n+1) {
          background:#f7f5fb !important;
          border-color:#e3dff0 !important;
        }

        .itemPreview > div:nth-child(4n+2) {
          background:#f2f8f5 !important;
          border-color:#dfece5 !important;
        }

        .itemPreview > div:nth-child(4n+3) {
          background:#f2f7f8 !important;
          border-color:#dce9ec !important;
        }

        .itemPreview > div:nth-child(4n+4) {
          background:#faf7f0 !important;
          border-color:#eee5d4 !important;
        }

        .itemPreview strong {
          color:#273042 !important;
        }

        .itemPreview span,
        .itemBrand {
          color:#7a8190 !important;
        }

        /* FOOTER ACTIONS */
        .purchaseCard footer {
          gap:7px !important;
          padding:0 18px 16px 21px !important;
        }

        .purchaseCard footer button {
          min-height:39px !important;
          border-radius:11px !important;
          border:1px solid transparent !important;
          box-shadow:none !important;
          transition:transform .18s ease,box-shadow .18s ease !important;
        }

        .purchaseCard footer button:hover {
          transform:translateY(-2px) !important;
          box-shadow:0 7px 14px rgba(39,44,61,.08) !important;
        }

        .editButton {
          border-color:#c6e4e9 !important;
          background:#e9f6f8 !important;
          color:#3f7f8b !important;
        }

        .addMissedItemButton {
          border-color:#d4c8ef !important;
          background:#eee9fb !important;
          color:#6650ad !important;
        }

        .purchaseCard footer button:not(.editButton):not(.addMissedItemButton):not(.payButton) {
          border-color:#ded9e9 !important;
          background:#f5f3f9 !important;
          color:#655492 !important;
        }

        .payButton {
          border-color:#bfe4d4 !important;
          background:linear-gradient(135deg,#23876d,#43b691) !important;
          color:#fff !important;
        }

        /* LOADING / EMPTY */
        .loadingState,
        .emptyState {
          min-height:330px !important;
          color:#737b8a !important;
          background:#fff !important;
        }

        .loadingState h2,
        .emptyState h2 {
          color:#293247 !important;
        }

        .spinner {
          border-color:#e5e7eb !important;
          border-top-color:#655492 !important;
        }

        /* ============================================================
           MODALS — PURCHASE DETAILS / PAYMENT / EDIT / ITEM EDIT
           ============================================================ */
        .modalOverlay {
          background:rgba(18,15,31,.74) !important;
          backdrop-filter:blur(10px) !important;
        }

        .detailsModal,
        .paymentModal,
        .editPurchaseModal,
        .itemEditModal,
        .deletePurchaseModal {
          border:1px solid rgba(255,255,255,.15) !important;
          border-radius:26px !important;
          background:#fff !important;
          box-shadow:0 34px 90px rgba(12,11,21,.34) !important;
        }

        .detailsQuickToolbar {
          border-bottom:1px solid #e8eaee !important;
          background:#f8f9fb !important;
        }

        .detailsQuickSearch {
          border:1px solid #d9dee8 !important;
          border-radius:12px !important;
          background:#fff !important;
        }

        .detailsQuickSearch > span {
          color:#655492 !important;
        }

        .detailsQuickSearch input {
          color:#273042 !important;
        }

        .detailsClearSearch {
          color:#655492 !important;
          background:#f3f1f8 !important;
        }

        .detailsCloseSticky {
          border:1px solid #edc2c9 !important;
          background:#fff0f2 !important;
          color:#a74f60 !important;
        }

        .detailsModal > span,
        .paymentModal > span,
        .editPurchaseModal > span,
        .itemEditModal > span {
          color:#655492 !important;
        }

        .detailsModal > h2,
        .paymentModal > h2,
        .editPurchaseModal > h2,
        .itemEditModal > h2 {
          color:#293247 !important;
        }

        .modalSubtitle {
          color:#7a8190 !important;
        }

        .detailsGrid > p {
          border:1px solid #e5e8ed !important;
          border-radius:13px !important;
          background:#fafbfc !important;
        }

        .detailsGrid span {
          color:#7a8190 !important;
        }

        .detailsGrid strong {
          color:#273042 !important;
        }

        .detailsItemFull {
          border:1px solid #e4e7ec !important;
          border-radius:15px !important;
          background:#fff !important;
          box-shadow:0 5px 14px rgba(39,44,61,.035) !important;
        }

        .detailsItemFull:nth-child(4n+1) {
          box-shadow:inset 4px 0 #6748c8 !important;
        }

        .detailsItemFull:nth-child(4n+2) {
          box-shadow:inset 4px 0 #23876d !important;
        }

        .detailsItemFull:nth-child(4n+3) {
          box-shadow:inset 4px 0 #3f7f8b !important;
        }

        .detailsItemFull:nth-child(4n+4) {
          box-shadow:inset 4px 0 #b0762b !important;
        }

        .detailsItemName strong,
        .detailsItemNumbers strong {
          color:#273042 !important;
        }

        .detailsItemName span,
        .detailsItemNumbers span {
          color:#7a8190 !important;
        }

        .editItemButton {
          border:1px solid #c6e4e9 !important;
          border-radius:10px !important;
          background:#e9f6f8 !important;
          color:#3f7f8b !important;
        }

        .purchaseTotalsDetailed,
        .addItemPurchaseSummary,
        .addItemCostPreview {
          border:1px solid #e4e7ec !important;
          border-radius:15px !important;
          background:#fafbfc !important;
        }

        .detailGrand,
        .landedCostHighlight {
          background:
            radial-gradient(circle at 88% 0%,rgba(255,215,115,.11),transparent 28%),
            linear-gradient(118deg,#31184f,#5c32a8 50%,#3c6f93) !important;
          color:#fff !important;
        }

        .detailOutstanding {
          background:#fff0f2 !important;
          border-color:#edc2c9 !important;
          color:#a74f60 !important;
        }

        /* FORM FIELDS */
        .paymentFormGrid input,
        .paymentFormGrid select,
        .paymentFormGrid textarea,
        .editPurchaseGrid input,
        .editPurchaseGrid select,
        .editPurchaseGrid textarea,
        .deleteField input,
        .deleteField textarea,
        .itemEditModal input,
        .itemEditModal select,
        .itemEditModal textarea {
          border-color:#dfe3e9 !important;
          border-radius:11px !important;
          background:#fff !important;
          color:#273042 !important;
          box-shadow:none !important;
        }

        .paymentFormGrid input:focus,
        .paymentFormGrid select:focus,
        .paymentFormGrid textarea:focus,
        .editPurchaseGrid input:focus,
        .editPurchaseGrid select:focus,
        .editPurchaseGrid textarea:focus,
        .deleteField input:focus,
        .deleteField textarea:focus,
        .itemEditModal input:focus,
        .itemEditModal select:focus,
        .itemEditModal textarea:focus {
          border-color:#755fc0 !important;
          box-shadow:0 0 0 3px rgba(117,95,192,.09) !important;
        }

        .editSafetyNote,
        .addMissedItemNote {
          border-color:#efd49e !important;
          background:#fff7e8 !important;
          color:#7d6338 !important;
        }

        .itemEditInlineError,
        .deleteWarningBox {
          border-color:#edc2c9 !important;
          background:#fff0f2 !important;
          color:#a74f60 !important;
        }

        /* MODAL ACTIONS */
        .modalActions button,
        .editModalActions button {
          border-radius:11px !important;
          box-shadow:none !important;
        }

        .saveEditButton {
          background:linear-gradient(135deg,#5c4497,#427887) !important;
          color:#fff !important;
        }

        .closeButton,
        .closeTextButton {
          background:#eef0f3 !important;
          color:#4a5261 !important;
        }

        .deletePurchaseButton,
        .confirmDeleteButton {
          background:linear-gradient(135deg,#a74f60,#cb6677) !important;
          color:#fff !important;
        }

        /* PRINT remains isolated in printPurchase() */
        @keyframes ncs-purchase-enter {
          from { opacity:0; transform:translateY(14px); }
          to { opacity:1; transform:translateY(0); }
        }

        @media(prefers-reduced-motion:reduce){
          .pageHeader,
          .statsGrid,
          .panel {
            animation:none !important;
          }
        }

        @media(max-width:760px){
          .purchaseHistoryPage {
            padding:10px !important;
          }

          .pageHeader {
            min-height:auto !important;
            border-radius:21px !important;
            padding:18px 16px !important;
          }

          .pageHeader h1 {
            font-size:30px !important;
          }

          .pageHeader::after {
            font-size:68px !important;
            right:7px !important;
          }

          .statsGrid article {
            min-height:100px !important;
            border-radius:17px !important;
          }

          .panel {
            border-radius:18px !important;
          }

          .purchaseCard {
            border-radius:18px !important;
          }

          .purchaseMeta {
            margin-left:16px !important;
            margin-right:16px !important;
          }
        }

      `}</style>
    </main>
  );
}
