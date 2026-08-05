export type OfflineSyncStatus = "PENDING" | "SYNCING" | "SYNCED" | "ERROR";

export type OfflineProductCacheRow = {
  key: string;
  productId: number;
  variantId: number | null;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  price: number;
  mrp: number;
  stock: number;
  sku: string;
  barcode: string;
  imageUrl: string;
  size: string;
  color: string;
  taxPercent: number;
  cachedAt: string;
};

export type OfflineSaleItem = Omit<OfflineProductCacheRow, "cachedAt"> & {
  quantity: number;
  discountPercent?: number;
  isQuickItem?: boolean;
  quickPurchasePrice?: number;
  quickSaveAsProduct?: boolean;
  quickRemainingStock?: number;
};

export type OfflinePendingSale = {
  id: string;
  clientTransactionId: string;
  offlineInvoiceNumber: string;
  customerName: string;
  customerPhone: string;
  customerWhatsAppOptIn: boolean;
  items: OfflineSaleItem[];
  subtotal: number;
  taxAmount: number;
  billDiscountPercent: number;
  billDiscountAmount: number;
  rewardPointsUsed: number;
  rewardDiscountAmount: number;
  roundOffAmount: number;
  finalPayable: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: "cash" | "upi" | "card" | "credit";
  creditDueDate?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: OfflineSyncStatus;
  syncAttempts: number;
  lastSyncError?: string | null;
  cloudSaleId?: string | null;
  cloudInvoiceNumber?: string | null;
  whatsappStatus: "NOT_REQUIRED" | "PENDING" | "SENT" | "ERROR";
  whatsappError?: string | null;
};

const DB_NAME = "ncs_pos_offline_db";
const DB_VERSION = 1;
const PRODUCT_STORE = "products";
const SALE_STORE = "pending_sales";
const META_STORE = "meta";

type MetaRow = { key: string; value: unknown };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("Offline storage is not supported in this browser."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(PRODUCT_STORE)) {
        const store = db.createObjectStore(PRODUCT_STORE, { keyPath: "key" });
        store.createIndex("productId", "productId", { unique: false });
        store.createIndex("barcode", "barcode", { unique: false });
        store.createIndex("sku", "sku", { unique: false });
      }

      if (!db.objectStoreNames.contains(SALE_STORE)) {
        const store = db.createObjectStore(SALE_STORE, { keyPath: "id" });
        store.createIndex("clientTransactionId", "clientTransactionId", { unique: true });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open offline database."));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Offline database request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Offline transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Offline transaction was cancelled."));
  });
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createOfflineClientTransactionId() {
  return createId("NCS-OFFLINE");
}

export function createOfflineInvoiceNumber() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const timePart = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `OFF-${datePart}-${timePart}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function isBrowserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export async function cachePosProducts(products: Omit<OfflineProductCacheRow, "cachedAt">[]) {
  const db = await openDatabase();
  const transaction = db.transaction(PRODUCT_STORE, "readwrite");
  const store = transaction.objectStore(PRODUCT_STORE);
  store.clear();
  const cachedAt = new Date().toISOString();
  products.forEach((product) => store.put({ ...product, cachedAt } satisfies OfflineProductCacheRow));
  await transactionComplete(transaction);
  db.close();
  await setOfflineMeta("products_cached_at", cachedAt);
  await setOfflineMeta("products_cached_count", products.length);
}

export async function getCachedPosProducts() {
  const db = await openDatabase();
  const transaction = db.transaction(PRODUCT_STORE, "readonly");
  const rows = await requestToPromise(transaction.objectStore(PRODUCT_STORE).getAll() as IDBRequest<OfflineProductCacheRow[]>);
  await transactionComplete(transaction);
  db.close();
  return rows || [];
}

export type PosStockIncreaseItem = {
  productId: number | null;
  variantId: number | null;
  quantity: number;
  purchasePrice?: number;
  mrp?: number;
  taxPercent?: number;
  name?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  sku?: string;
  barcode?: string;
  imageUrl?: string;
  size?: string;
  color?: string;
};

export async function increaseCachedPosStockFromPurchase(
  items: PosStockIncreaseItem[],
) {
  const db = await openDatabase();
  const transaction = db.transaction(
    PRODUCT_STORE,
    "readwrite",
  );
  const store =
    transaction.objectStore(PRODUCT_STORE);
  const now = new Date().toISOString();

  for (const item of items) {
    if (!item.productId) {
      continue;
    }

    const key =
      item.variantId !== null
        ? `variant-${item.variantId}`
        : `product-${item.productId}`;

    const cachedProduct =
      await requestToPromise(
        store.get(key) as IDBRequest<
          OfflineProductCacheRow | undefined
        >,
      );

    if (!cachedProduct) {
      continue;
    }

    store.put({
      ...cachedProduct,
      stock:
        Math.max(0, Number(cachedProduct.stock || 0)) +
        Math.max(0, Math.trunc(item.quantity)),
      price:
        item.purchasePrice !== undefined
          ? Math.max(
              0,
              Number(item.purchasePrice || 0),
            )
          : cachedProduct.price,
      mrp:
        item.mrp !== undefined
          ? Math.max(0, Number(item.mrp || 0))
          : cachedProduct.mrp,
      taxPercent:
        item.taxPercent !== undefined
          ? Math.max(
              0,
              Number(item.taxPercent || 0),
            )
          : cachedProduct.taxPercent,
      cachedAt: now,
    });
  }

  await transactionComplete(transaction);
  db.close();

  await setOfflineMeta(
    "products_locally_updated_at",
    now,
  );
}

export async function saveOfflineSale(
  sale: Omit<OfflinePendingSale, "id" | "syncStatus" | "syncAttempts" | "lastSyncError" | "cloudSaleId" | "cloudInvoiceNumber">
) {
  const db = await openDatabase();
  const transaction = db.transaction([SALE_STORE, PRODUCT_STORE], "readwrite");
  const saleStore = transaction.objectStore(SALE_STORE);
  const productStore = transaction.objectStore(PRODUCT_STORE);
  const now = new Date().toISOString();

  const pendingSale: OfflinePendingSale = {
    ...sale,
    id: createId("sale"),
    updatedAt: now,
    syncStatus: "PENDING",
    syncAttempts: 0,
    lastSyncError: null,
    cloudSaleId: null,
    cloudInvoiceNumber: null,
  };

  for (const item of pendingSale.items) {
    if (item.isQuickItem) continue;

    const cachedProduct = await requestToPromise(
      productStore.get(item.key) as IDBRequest<OfflineProductCacheRow | undefined>
    );

    if (!cachedProduct) {
      transaction.abort();
      db.close();
      throw new Error(`${item.name} is not available in offline stock.`);
    }

    if (cachedProduct.stock < item.quantity) {
      transaction.abort();
      db.close();
      throw new Error(`Only ${cachedProduct.stock} item(s) available for ${item.name}.`);
    }

    productStore.put({
      ...cachedProduct,
      stock: Math.max(0, cachedProduct.stock - item.quantity),
      cachedAt: now,
    });
  }

  saleStore.add(pendingSale);
  await transactionComplete(transaction);
  db.close();
  return pendingSale;
}

export async function getPendingOfflineSales() {
  const db = await openDatabase();
  const transaction = db.transaction(SALE_STORE, "readonly");
  const rows = await requestToPromise(transaction.objectStore(SALE_STORE).getAll() as IDBRequest<OfflinePendingSale[]>);
  await transactionComplete(transaction);
  db.close();
  return (rows || [])
    .filter((sale) => ["PENDING", "ERROR"].includes(sale.syncStatus))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getAllOfflineSales() {
  const db = await openDatabase();
  const transaction = db.transaction(SALE_STORE, "readonly");
  const rows = await requestToPromise(transaction.objectStore(SALE_STORE).getAll() as IDBRequest<OfflinePendingSale[]>);
  await transactionComplete(transaction);
  db.close();
  return (rows || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateOfflineSale(saleId: string, changes: Partial<OfflinePendingSale>) {
  const db = await openDatabase();
  const transaction = db.transaction(SALE_STORE, "readwrite");
  const store = transaction.objectStore(SALE_STORE);
  const current = await requestToPromise(store.get(saleId) as IDBRequest<OfflinePendingSale | undefined>);

  if (!current) {
    transaction.abort();
    db.close();
    throw new Error("Offline sale not found.");
  }

  const updated: OfflinePendingSale = {
    ...current,
    ...changes,
    updatedAt: new Date().toISOString(),
  };

  store.put(updated);
  await transactionComplete(transaction);
  db.close();
  return updated;
}

export async function markOfflineSaleSyncing(saleId: string) {
  const sales = await getAllOfflineSales();
  const current = sales.find((sale) => sale.id === saleId);
  if (!current) throw new Error("Offline sale not found.");
  return updateOfflineSale(saleId, {
    syncStatus: "SYNCING",
    syncAttempts: current.syncAttempts + 1,
    lastSyncError: null,
  });
}

export async function markOfflineSaleSynced(
  saleId: string,
  cloudSaleId: string | null,
  cloudInvoiceNumber: string | null,
) {
  return updateOfflineSale(saleId, {
    syncStatus: "SYNCED",
    cloudSaleId,
    cloudInvoiceNumber,
    lastSyncError: null,
  });
}

export async function markOfflineSaleError(saleId: string, errorMessage: string) {
  return updateOfflineSale(saleId, {
    syncStatus: "ERROR",
    lastSyncError: errorMessage.slice(0, 1000),
  });
}

export async function markOfflineWhatsAppSent(saleId: string) {
  return updateOfflineSale(saleId, {
    whatsappStatus: "SENT",
    whatsappError: null,
  });
}

export async function markOfflineWhatsAppError(saleId: string, errorMessage: string) {
  return updateOfflineSale(saleId, {
    whatsappStatus: "ERROR",
    whatsappError: errorMessage.slice(0, 1000),
  });
}

export async function countPendingOfflineSales() {
  return (await getPendingOfflineSales()).length;
}

export async function setOfflineMeta(key: string, value: unknown) {
  const db = await openDatabase();
  const transaction = db.transaction(META_STORE, "readwrite");
  transaction.objectStore(META_STORE).put({ key, value } satisfies MetaRow);
  await transactionComplete(transaction);
  db.close();
}

export async function getOfflineMeta<T>(key: string, fallback: T): Promise<T> {
  const db = await openDatabase();
  const transaction = db.transaction(META_STORE, "readonly");
  const row = await requestToPromise(
    transaction.objectStore(META_STORE).get(key) as IDBRequest<MetaRow | undefined>
  );
  await transactionComplete(transaction);
  db.close();
  return (row?.value as T | undefined) ?? fallback;
}