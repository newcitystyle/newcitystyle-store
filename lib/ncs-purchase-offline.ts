import {
  increaseCachedPosStockFromPurchase,
} from "@/lib/ncs-pos-offline";

export type OfflinePurchaseSyncStatus =
  | "PENDING"
  | "SYNCING"
  | "SYNCED"
  | "ERROR";

export type OfflineSupplierCacheRow = {
  id: number;
  supplierName: string;
  phone: string;
  gstNumber: string;
  state: string;
  stateCode: string;
  placeOfSupply: string;
  currentBalance: number;
  isActive: boolean;
  cachedAt: string;
};

export type OfflinePurchaseProductRow = {
  key: string;
  productId: number;
  variantId: number | null;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  size: string;
  color: string;
  sku: string;
  barcode: string;
  stock: number;
  purchasePrice: number;
  onlineSellingPrice: number;
  mrp: number;
  taxPercent: number;
  cessPercent: number;
  sellOnline: boolean;
  onlineQuantity: number;
  imageUrl: string;
  designCode: string;
  cachedAt: string;
};

export type OfflinePurchaseItem = {
  rowId: string;
  productId: number | null;
  variantId: number | null;
  productName: string;
  category: string;
  subcategory: string;
  brand: string;
  size: string;
  color: string;
  sku: string;
  barcode: string;
  barcodeMode: "bulk" | "variant" | "individual";
  quantity: number;
  purchasePrice: number;
  purchaseDiscount: number;
  mrp: number;
  taxPercent: number;
  cessPercent: number;
  sellOnline: boolean;
  onlineQuantity: number;
  onlineSellingPrice: number;
  currentStock: number;
  designCode: string;
};

export type OfflinePurchasePayment = {
  id: string;
  method:
    | "cash"
    | "upi"
    | "card"
    | "bank_transfer"
    | "other";
  amount: number;
  reference: string;
};

export type OfflinePendingPurchase = {
  id: string;
  clientTransactionId: string;
  offlinePurchaseNumber: string;

  selectedSupplierId: number | null;
  supplierName: string;
  supplierPhone: string;
  supplierGstin: string;
  supplierState: string;
  supplierStateCode: string;
  placeOfSupply: string;
  previousSupplierBalance: number;

  supplierInvoiceNumber: string;
  purchaseDate: string;
  dueDate: string;
  taxType:
    | "intra_state"
    | "inter_state"
    | "non_gst";

  items: OfflinePurchaseItem[];
  payments: OfflinePurchasePayment[];

  discountAmount: number;
  transportCharge: number;
  otherCharge: number;
  notes: string;

  subtotal: number;
  taxAmount: number;
  cessAmount: number;
  totalAmount: number;
  totalPaid: number;
  currentPurchaseDue: number;
  closingSupplierBalance: number;

  createdAt: string;
  updatedAt: string;
  syncStatus: OfflinePurchaseSyncStatus;
  syncAttempts: number;
  lastSyncError: string | null;
  cloudPurchaseId: string | null;
  cloudPurchaseNumber: string | null;
};

type OfflineMetaRow = {
  key: string;
  value: unknown;
};

const DB_NAME = "ncs_purchase_offline_db";
const DB_VERSION = 1;

const SUPPLIER_STORE = "suppliers";
const PRODUCT_STORE = "products";
const PURCHASE_STORE = "pending_purchases";
const META_STORE = "meta";

function hasIndexedDb() {
  return (
    typeof window !== "undefined" &&
    typeof window.indexedDB !== "undefined"
  );
}

function requestToPromise<T>(
  request: IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ||
          new Error("Offline database request failed."),
      );
  });
}

function transactionComplete(
  transaction: IDBTransaction,
): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ||
          new Error("Offline transaction failed."),
      );
    transaction.onabort = () =>
      reject(
        transaction.error ||
          new Error("Offline transaction was cancelled."),
      );
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(
        new Error(
          "Offline purchase storage is not supported in this browser.",
        ),
      );
      return;
    }

    const request = window.indexedDB.open(
      DB_NAME,
      DB_VERSION,
    );

    request.onupgradeneeded = () => {
      const database = request.result;

      if (
        !database.objectStoreNames.contains(
          SUPPLIER_STORE,
        )
      ) {
        const store = database.createObjectStore(
          SUPPLIER_STORE,
          {
            keyPath: "id",
          },
        );

        store.createIndex(
          "supplierName",
          "supplierName",
          {
            unique: false,
          },
        );

        store.createIndex(
          "phone",
          "phone",
          {
            unique: false,
          },
        );
      }

      if (
        !database.objectStoreNames.contains(
          PRODUCT_STORE,
        )
      ) {
        const store = database.createObjectStore(
          PRODUCT_STORE,
          {
            keyPath: "key",
          },
        );

        store.createIndex(
          "productId",
          "productId",
          {
            unique: false,
          },
        );

        store.createIndex(
          "barcode",
          "barcode",
          {
            unique: false,
          },
        );

        store.createIndex(
          "sku",
          "sku",
          {
            unique: false,
          },
        );
      }

      if (
        !database.objectStoreNames.contains(
          PURCHASE_STORE,
        )
      ) {
        const store = database.createObjectStore(
          PURCHASE_STORE,
          {
            keyPath: "id",
          },
        );

        store.createIndex(
          "clientTransactionId",
          "clientTransactionId",
          {
            unique: true,
          },
        );

        store.createIndex(
          "syncStatus",
          "syncStatus",
          {
            unique: false,
          },
        );

        store.createIndex(
          "createdAt",
          "createdAt",
          {
            unique: false,
          },
        );
      }

      if (
        !database.objectStoreNames.contains(
          META_STORE,
        )
      ) {
        database.createObjectStore(
          META_STORE,
          {
            keyPath: "key",
          },
        );
      }
    };

    request.onsuccess = () => {
      const database = request.result;

      database.onversionchange = () => {
        database.close();
      };

      resolve(database);
    };

    request.onerror = () =>
      reject(
        request.error ||
          new Error(
            "Unable to open offline purchase database.",
          ),
      );

    request.onblocked = () =>
      reject(
        new Error(
          "Offline purchase database is blocked. Close other tabs and try again.",
        ),
      );
  });
}

function createId(prefix: string) {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function createOfflinePurchaseClientTransactionId() {
  return createId("NCS-PUR-OFFLINE");
}

export function createOfflinePurchaseNumber() {
  const now = new Date();

  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const timePart = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  return `OFF-PUR-${datePart}-${timePart}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

export function isPurchaseBrowserOnline() {
  if (typeof navigator === "undefined") {
    return true;
  }

  return navigator.onLine;
}

export async function cachePurchaseSuppliers(
  suppliers: Omit<
    OfflineSupplierCacheRow,
    "cachedAt"
  >[],
) {
  const database = await openDatabase();
  const transaction = database.transaction(
    SUPPLIER_STORE,
    "readwrite",
  );
  const store =
    transaction.objectStore(SUPPLIER_STORE);

  store.clear();

  const cachedAt = new Date().toISOString();

  suppliers.forEach((supplier) => {
    store.put({
      ...supplier,
      cachedAt,
    } satisfies OfflineSupplierCacheRow);
  });

  await transactionComplete(transaction);
  database.close();

  await setPurchaseOfflineMeta(
    "suppliers_cached_at",
    cachedAt,
  );
  await setPurchaseOfflineMeta(
    "suppliers_cached_count",
    suppliers.length,
  );
}

export async function getCachedPurchaseSuppliers() {
  const database = await openDatabase();
  const transaction = database.transaction(
    SUPPLIER_STORE,
    "readonly",
  );
  const store =
    transaction.objectStore(SUPPLIER_STORE);

  const rows = await requestToPromise(
    store.getAll() as IDBRequest<
      OfflineSupplierCacheRow[]
    >,
  );

  await transactionComplete(transaction);
  database.close();

  return rows || [];
}

export async function cachePurchaseProducts(
  products: Omit<
    OfflinePurchaseProductRow,
    "cachedAt"
  >[],
) {
  const database = await openDatabase();
  const transaction = database.transaction(
    PRODUCT_STORE,
    "readwrite",
  );
  const store =
    transaction.objectStore(PRODUCT_STORE);

  store.clear();

  const cachedAt = new Date().toISOString();

  products.forEach((product) => {
    store.put({
      ...product,
      cachedAt,
    } satisfies OfflinePurchaseProductRow);
  });

  await transactionComplete(transaction);
  database.close();

  await setPurchaseOfflineMeta(
    "products_cached_at",
    cachedAt,
  );
  await setPurchaseOfflineMeta(
    "products_cached_count",
    products.length,
  );
}

export async function getCachedPurchaseProducts() {
  const database = await openDatabase();
  const transaction = database.transaction(
    PRODUCT_STORE,
    "readonly",
  );
  const store =
    transaction.objectStore(PRODUCT_STORE);

  const rows = await requestToPromise(
    store.getAll() as IDBRequest<
      OfflinePurchaseProductRow[]
    >,
  );

  await transactionComplete(transaction);
  database.close();

  return rows || [];
}

export async function saveOfflinePurchase(
  purchase: Omit<
    OfflinePendingPurchase,
    | "id"
    | "syncStatus"
    | "syncAttempts"
    | "lastSyncError"
    | "cloudPurchaseId"
    | "cloudPurchaseNumber"
  >,
) {
  const database = await openDatabase();
  const transaction = database.transaction(
    [PURCHASE_STORE, PRODUCT_STORE, SUPPLIER_STORE],
    "readwrite",
  );

  const purchaseStore =
    transaction.objectStore(PURCHASE_STORE);
  const productStore =
    transaction.objectStore(PRODUCT_STORE);
  const supplierStore =
    transaction.objectStore(SUPPLIER_STORE);

  const now = new Date().toISOString();

  const pendingPurchase: OfflinePendingPurchase = {
    ...purchase,
    id: createId("purchase"),
    updatedAt: now,
    syncStatus: "PENDING",
    syncAttempts: 0,
    lastSyncError: null,
    cloudPurchaseId: null,
    cloudPurchaseNumber: null,
  };

  for (const item of pendingPurchase.items) {
    if (!item.productId) {
      continue;
    }

    const productKey =
      item.variantId !== null
        ? `variant-${item.variantId}`
        : `product-${item.productId}`;

    const cachedProduct = await requestToPromise(
      productStore.get(productKey) as IDBRequest<
        OfflinePurchaseProductRow | undefined
      >,
    );

    if (!cachedProduct) {
      continue;
    }

    productStore.put({
      ...cachedProduct,
      stock:
        Number(cachedProduct.stock || 0) +
        Math.max(
          0,
          Math.trunc(item.quantity),
        ),
      purchasePrice: Math.max(
        0,
        item.purchasePrice -
          item.purchaseDiscount,
      ),
      mrp: Math.max(0, item.mrp),
      taxPercent: Math.max(
        0,
        item.taxPercent,
      ),
      cessPercent: Math.max(
        0,
        item.cessPercent,
      ),
      sellOnline: item.sellOnline,
      onlineQuantity: item.sellOnline
        ? Math.max(
            0,
            Math.trunc(item.onlineQuantity),
          )
        : 0,
      onlineSellingPrice: item.sellOnline
        ? Math.max(
            0,
            item.onlineSellingPrice,
          )
        : cachedProduct.onlineSellingPrice,
      cachedAt: now,
    });
  }

  if (pendingPurchase.selectedSupplierId) {
    const cachedSupplier =
      await requestToPromise(
        supplierStore.get(
          pendingPurchase.selectedSupplierId,
        ) as IDBRequest<
          OfflineSupplierCacheRow | undefined
        >,
      );

    if (cachedSupplier) {
      supplierStore.put({
        ...cachedSupplier,
        currentBalance:
          Math.max(
            0,
            cachedSupplier.currentBalance,
          ) +
          Math.max(
            0,
            pendingPurchase.currentPurchaseDue,
          ),
        cachedAt: now,
      });
    }
  }

  purchaseStore.add(pendingPurchase);

  await transactionComplete(transaction);
  database.close();

  await increaseCachedPosStockFromPurchase(
    pendingPurchase.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      purchasePrice: Math.max(
        0,
        item.purchasePrice -
          item.purchaseDiscount,
      ),
      mrp: item.mrp,
      taxPercent: item.taxPercent,
      name: item.productName,
      category: item.category,
      subcategory: item.subcategory,
      brand: item.brand,
      sku: item.sku,
      barcode: item.barcode,
      size: item.size,
      color: item.color,
    })),
  );

  return pendingPurchase;
}

export async function getPendingOfflinePurchases() {
  const database = await openDatabase();
  const transaction = database.transaction(
    PURCHASE_STORE,
    "readonly",
  );
  const store =
    transaction.objectStore(PURCHASE_STORE);

  const rows = await requestToPromise(
    store.getAll() as IDBRequest<
      OfflinePendingPurchase[]
    >,
  );

  await transactionComplete(transaction);
  database.close();

  return (rows || [])
    .filter((purchase) =>
      [
        "PENDING",
        "ERROR",
      ].includes(purchase.syncStatus),
    )
    .sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
}

export async function getAllOfflinePurchases() {
  const database = await openDatabase();
  const transaction = database.transaction(
    PURCHASE_STORE,
    "readonly",
  );
  const store =
    transaction.objectStore(PURCHASE_STORE);

  const rows = await requestToPromise(
    store.getAll() as IDBRequest<
      OfflinePendingPurchase[]
    >,
  );

  await transactionComplete(transaction);
  database.close();

  return (rows || []).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function updateOfflinePurchase(
  purchaseId: string,
  changes: Partial<OfflinePendingPurchase>,
) {
  const database = await openDatabase();
  const transaction = database.transaction(
    PURCHASE_STORE,
    "readwrite",
  );
  const store =
    transaction.objectStore(PURCHASE_STORE);

  const current = await requestToPromise(
    store.get(purchaseId) as IDBRequest<
      OfflinePendingPurchase | undefined
    >,
  );

  if (!current) {
    transaction.abort();
    database.close();

    throw new Error(
      "Offline purchase not found.",
    );
  }

  const updated: OfflinePendingPurchase = {
    ...current,
    ...changes,
    updatedAt: new Date().toISOString(),
  };

  store.put(updated);

  await transactionComplete(transaction);
  database.close();

  return updated;
}

export async function markOfflinePurchaseSyncing(
  purchaseId: string,
) {
  const database = await openDatabase();
  const transaction = database.transaction(
    PURCHASE_STORE,
    "readwrite",
  );
  const store =
    transaction.objectStore(PURCHASE_STORE);

  const current = await requestToPromise(
    store.get(purchaseId) as IDBRequest<
      OfflinePendingPurchase | undefined
    >,
  );

  if (!current) {
    transaction.abort();
    database.close();

    throw new Error(
      "Offline purchase not found.",
    );
  }

  const updated: OfflinePendingPurchase = {
    ...current,
    syncStatus: "SYNCING",
    syncAttempts: current.syncAttempts + 1,
    lastSyncError: null,
    updatedAt: new Date().toISOString(),
  };

  store.put(updated);

  await transactionComplete(transaction);
  database.close();

  return updated;
}

export async function markOfflinePurchaseSynced(
  purchaseId: string,
  cloudPurchaseId: string | null,
  cloudPurchaseNumber: string | null,
) {
  return updateOfflinePurchase(
    purchaseId,
    {
      syncStatus: "SYNCED",
      cloudPurchaseId,
      cloudPurchaseNumber,
      lastSyncError: null,
    },
  );
}

export async function markOfflinePurchaseError(
  purchaseId: string,
  errorMessage: string,
) {
  return updateOfflinePurchase(
    purchaseId,
    {
      syncStatus: "ERROR",
      lastSyncError:
        errorMessage.slice(0, 1000),
    },
  );
}

export async function countPendingOfflinePurchases() {
  const purchases =
    await getPendingOfflinePurchases();

  return purchases.length;
}

export async function removeOfflinePurchase(
  purchaseId: string,
) {
  const database = await openDatabase();
  const transaction = database.transaction(
    PURCHASE_STORE,
    "readwrite",
  );

  transaction
    .objectStore(PURCHASE_STORE)
    .delete(purchaseId);

  await transactionComplete(transaction);
  database.close();
}

export async function setPurchaseOfflineMeta(
  key: string,
  value: unknown,
) {
  const database = await openDatabase();
  const transaction = database.transaction(
    META_STORE,
    "readwrite",
  );

  transaction.objectStore(META_STORE).put({
    key,
    value,
  } satisfies OfflineMetaRow);

  await transactionComplete(transaction);
  database.close();
}

export async function getPurchaseOfflineMeta<T>(
  key: string,
  fallback: T,
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(
    META_STORE,
    "readonly",
  );

  const row = await requestToPromise(
    transaction
      .objectStore(META_STORE)
      .get(key) as IDBRequest<
        OfflineMetaRow | undefined
      >,
  );

  await transactionComplete(transaction);
  database.close();

  return (row?.value as T | undefined) ?? fallback;
}

export async function clearOfflinePurchaseDatabase() {
  const database = await openDatabase();
  const transaction = database.transaction(
    [
      SUPPLIER_STORE,
      PRODUCT_STORE,
      PURCHASE_STORE,
      META_STORE,
    ],
    "readwrite",
  );

  transaction.objectStore(SUPPLIER_STORE).clear();
  transaction.objectStore(PRODUCT_STORE).clear();
  transaction.objectStore(PURCHASE_STORE).clear();
  transaction.objectStore(META_STORE).clear();

  await transactionComplete(transaction);
  database.close();
}