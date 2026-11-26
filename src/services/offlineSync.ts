import { Customer, CustomerPayment, Expense, Lorry, Order, Product } from '../types';

const CACHE_PREFIX = 'sb_offline_cache_';
const QUEUE_KEY = 'sb_offline_sync_queue_v1';

export type OfflineQueueItemType =
  | 'LORRY_BILL'
  | 'ORDER_CREATE'
  | 'CUSTOMER_PAYMENT'
  | 'EXPENSE_CREATE';

export interface OfflineQueueItem {
  id: string;
  type: OfflineQueueItemType;
  createdAt: string;
  lorryId?: string;
  customerId?: string;
  payload: any;
  label?: string;
}

export const OfflineCache = {
  save<T>(key: string, data: T): void {
    try {
      localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(data));
    } catch {
      // Ignore storage quota errors gracefully
    }
  },
  load<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }
};

export function isNetworkError(err: any): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (!err) return false;
  if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') return true;
  if (!err.response && (err.request || err.message === 'Network Error')) return true;
  return false;
}

/**
 * Generates a globally unique, collision-free Bill ID on the device so that
 * offline printed receipts and synced server bills share the exact same ID.
 * Example: ORD-20261126-L1-7K4M
 */
export function generateUniqueOrderNumber(deviceTag?: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const cleanTag = (deviceTag || 'REP')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(-4) || 'REP';
  const timePart = (now.getTime() % 1679616).toString(36).toUpperCase().padStart(4, '0').slice(-2);
  const randPart = Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0');
  return `ORD-${y}${m}${d}-${cleanTag}-${timePart}${randPart}`;
}

export function generateUniqueReceiptNumber(prefix = 'RCP', deviceTag?: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const cleanTag = (deviceTag || 'REP')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(-4) || 'REP';
  const rand = Math.floor(Math.random() * 46656).toString(36).toUpperCase().padStart(3, '0');
  return `${prefix}-${y}${m}${d}-${cleanTag}-${rand}`;
}

export const OfflineQueue = {
  getAll(): OfflineQueueItem[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  saveAll(items: OfflineQueueItem[]): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:offline-queue-changed', { detail: { count: items.length } }));
      }
    } catch {
      // Ignore storage quota errors
    }
  },

  count(): number {
    return this.getAll().length;
  },

  enqueue(item: Omit<OfflineQueueItem, 'id' | 'createdAt'>): OfflineQueueItem {
    const newItem: OfflineQueueItem = {
      ...item,
      id: `oq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString()
    };
    const current = this.getAll();
    current.push(newItem);
    this.saveAll(current);
    return newItem;
  },

  async syncAll(executors: {
    sendLorryBill: (lorryId: string, payload: any) => Promise<any>;
    sendOrder: (payload: any) => Promise<any>;
    sendPayment: (customerId: string, payload: any) => Promise<any>;
    sendExpense: (payload: any) => Promise<any>;
  }): Promise<{ syncedCount: number; remainingCount: number; lastError?: string }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { syncedCount: 0, remainingCount: this.count() };
    }

    const queue = this.getAll();
    if (queue.length === 0) {
      return { syncedCount: 0, remainingCount: 0 };
    }

    let syncedCount = 0;
    const remaining: OfflineQueueItem[] = [];
    let lastError: string | undefined;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      try {
        if (item.type === 'LORRY_BILL' && item.lorryId) {
          await executors.sendLorryBill(item.lorryId, item.payload);
        } else if (item.type === 'ORDER_CREATE') {
          await executors.sendOrder(item.payload);
        } else if (item.type === 'CUSTOMER_PAYMENT' && item.customerId) {
          await executors.sendPayment(item.customerId, item.payload);
        } else if (item.type === 'EXPENSE_CREATE') {
          await executors.sendExpense(item.payload);
        }
        syncedCount++;
      } catch (err: any) {
        if (isNetworkError(err)) {
          // Network dropped mid-sync: keep this and all subsequent items in FIFO order
          remaining.push(...queue.slice(i));
          lastError = 'Network connection lost during sync.';
          break;
        }
        // Server validation error (4xx) — keep item or skip? Keep so data isn't silently lost,
        // unless it's a duplicate that already exists.
        lastError = err?.response?.data?.error || err?.message || 'Sync error';
        remaining.push(item);
      }
    }

    this.saveAll(remaining);
    return { syncedCount, remainingCount: remaining.length, lastError };
  }
};

export function buildOptimisticOrder(params: {
  orderNumber: string;
  customer: Customer;
  lorry?: Lorry | null;
  products: Product[];
  payload: {
    paymentMethod: 'CASH' | 'PARTIAL' | 'CREDIT' | 'CHEQUE';
    cashReceived?: number;
    discountAmount?: number;
    notes?: string;
    chequeNumber?: string;
    bankName?: string;
    chequeDate?: string;
    items: { productId: string; quantity: number; freeQuantity?: number; unitPrice?: number }[];
    returnItems?: { productId: string; quantity: number; unitPrice?: number; returnType: 'DAMAGE' | 'RESALE'; reason?: string }[];
  };
}): Order {
  const { orderNumber, customer, lorry, products, payload } = params;
  const now = new Date().toISOString();

  let subtotal = 0;
  const items = (payload.items || []).map((it, idx) => {
    const prod = products.find(p => p.id === it.productId);
    const unitPrice = it.unitPrice !== undefined ? it.unitPrice : (prod?.unitPrice || 0);
    const lineTotal = unitPrice * (it.quantity || 0);
    subtotal += lineTotal;
    return {
      id: `off_item_${idx}_${Date.now()}`,
      orderId: orderNumber,
      productId: it.productId,
      product: prod as Product,
      quantity: it.quantity || 0,
      freeQuantity: it.freeQuantity || 0,
      unitPrice,
      lineTotal
    };
  });

  let returnAmount = 0;
  const returns = (payload.returnItems || []).map((ret, idx) => {
    const prod = products.find(p => p.id === ret.productId);
    const unitPrice = ret.unitPrice !== undefined ? ret.unitPrice : (prod?.unitPrice || 0);
    const total = unitPrice * (ret.quantity || 0);
    returnAmount += total;
    return {
      id: `off_ret_${idx}_${Date.now()}`,
      orderId: orderNumber,
      productId: ret.productId,
      product: prod,
      quantity: ret.quantity || 0,
      unitPrice,
      total,
      returnType: ret.returnType,
      reason: ret.reason || ''
    };
  });

  const discountAmount = payload.discountAmount || 0;
  const netTotal = Math.max(0, subtotal - discountAmount - returnAmount);
  const isCheque = payload.paymentMethod === 'CHEQUE';
  const rawPaid = payload.cashReceived !== undefined
    ? payload.cashReceived
    : (payload.paymentMethod === 'CASH' ? netTotal : 0);
  const paidAmount = isCheque ? netTotal : Math.min(netTotal, Math.max(0, rawPaid));
  const paymentStatus = paidAmount >= netTotal ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'UNPAID');
  const balanceAmount = Math.max(0, netTotal - paidAmount);

  return {
    id: `offline_${orderNumber}`,
    orderNumber,
    paperBillNumber: null,
    customerId: customer.id,
    customer,
    lorryId: lorry?.id || null,
    lorry: lorry || null,
    routeId: lorry?.routeId || customer.routeId || null,
    status: 'DELIVERED',
    paymentStatus,
    paymentMethod: payload.paymentMethod,
    chequeNumber: isCheque ? (payload.chequeNumber || null) : null,
    bankName: isCheque ? (payload.bankName || null) : null,
    chequeDate: isCheque ? (payload.chequeDate || now) : null,
    subtotal,
    discountAmount,
    taxAmount: 0,
    returnAmount,
    netTotal,
    cashReceived: isCheque ? 0 : paidAmount,
    paidAmount,
    balanceAmount,
    notes: payload.notes ? `[OFFLINE] ${payload.notes}` : '[OFFLINE] Pending Sync',
    dispatchedAt: now,
    deliveredAt: now,
    createdAt: now,
    updatedAt: now,
    items,
    returns
  };
}

export function buildOptimisticPayment(params: {
  receiptNumber: string;
  customer: Customer;
  lorryId?: string;
  amount: number;
  paymentMethod?: 'CASH' | 'CHEQUE' | 'BANK_TRANSFER';
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: string;
  collectedBy?: string;
  notes?: string;
}): CustomerPayment {
  const now = new Date().toISOString();
  return {
    id: `offline_${params.receiptNumber}`,
    receiptNumber: params.receiptNumber,
    customerId: params.customer.id,
    customer: params.customer,
    lorryId: params.lorryId || null,
    amount: params.amount,
    paymentMethod: params.paymentMethod || 'CASH',
    chequeNumber: params.chequeNumber || null,
    bankName: params.bankName || null,
    chequeDate: params.chequeDate || null,
    collectedBy: params.collectedBy || null,
    notes: params.notes || '[OFFLINE] Pending Sync',
    createdAt: now,
    updatedAt: now
  };
}

export function buildOptimisticExpense(params: {
  expenseNumber: string;
  category: string;
  description: string;
  amount: number;
  lorryId?: string;
  recordedBy?: string;
}): Expense {
  const now = new Date().toISOString();
  return {
    id: `offline_${params.expenseNumber}`,
    expenseNumber: params.expenseNumber,
    category: params.category as any,
    title: params.description,
    amount: params.amount,
    paymentMethod: 'CASH',
    date: now,
    lorryId: params.lorryId || null,
    notes: '[OFFLINE] Pending Sync',
    createdAt: now,
    updatedAt: now
  };
}
