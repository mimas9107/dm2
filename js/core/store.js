/* ==========================================================================
   共用狀態庫 — 全站唯一真相來源
   --------------------------------------------------------------------------
   原本這份邏輯被複製在 4 個 HTML 中，且四份副本的驗證條件已經分歧：
     · index.html / controller.html  要求狀態必須含 cmsDocs，
       否則整份重置為預設值 → 會「靜默清空全站訂單與顧客資料」
     · order_accept.html / user_order_track.html  只要求 stores/customers/orders
   本模組統一改為「逐欄位補齊」策略：
     ✔ 任何欄位缺失只補該欄位的種子值
     ✔ 既有訂單 / 顧客 / 店家資料在任何情況下都不會被清空
     ✔ 另提供欄位級正規化，避免髒資料導致前端算錯

   使用原則：
     · 讀取  → getState()（記憶體快照）或 loadState()（強制重讀）
     · 修改  → updateState(fn)，fn 直接就地修改傳入的 state 物件
     · 訂閱  → subscribe(fn)，僅在「其他分頁」變更時觸發
   頁面檔一律不得自行操作 localStorage。
   ========================================================================== */

import { createDefaultState } from './seed-data.js';

export const STORAGE_KEY = 'laidiansong_shared_state_v1';
export const STATE_VERSION = 2;

/* --------------------------------------------------------------------------
   內部狀態
   -------------------------------------------------------------------------- */
let memoryState = null;
const subscribers = new Set();
let storageListenerBound = false;

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/* --------------------------------------------------------------------------
   欄位級正規化：確保每筆訂單 / 顧客 / 店家都有必要欄位與型別
   -------------------------------------------------------------------------- */
function normalizeOrder(order) {
  if (!isPlainObject(order)) return null;
  const o = { ...order };
  o.orderId = String(o.orderId ?? '');
  o.storeId = Number(o.storeId) || 0;
  o.storeName = String(o.storeName ?? '');
  o.deliverBy = String(o.deliverBy ?? '');
  o.address = String(o.address ?? '');
  o.customerName = String(o.customerName ?? '');
  o.customerPhone = String(o.customerPhone ?? '');
  o.accepted = o.accepted === true;
  o.step = Number.isFinite(Number(o.step)) ? Number(o.step) : 0;
  o.items = Array.isArray(o.items)
    ? o.items.map(item => ({
      name: String(item?.name ?? ''),
      qty: Number(item?.qty) || 0,
      price: Number(item?.price) || 0
    }))
    : [];
  return o.orderId ? o : null;
}

function normalizeCustomer(customer) {
  if (!isPlainObject(customer)) return null;
  const c = { ...customer };
  c.id = Number(c.id) || 0;
  c.name = String(c.name ?? '');
  c.tel = String(c.tel ?? '');
  c.orders = Array.isArray(c.orders) ? c.orders.map(String) : [];
  c.abandonedCount = Number(c.abandonedCount) || 0;
  c.blacklisted = c.blacklisted === true;
  return c;
}

function normalizeStore(store) {
  if (!isPlainObject(store)) return null;
  const s = { ...store };
  s.id = Number(s.id) || 0;
  s.name = String(s.name ?? '');
  s.soundAlert = String(s.soundAlert ?? '');
  s.soundEnabled = s.soundEnabled !== false;
  s.hours = String(s.hours ?? '');
  s.minOrder = String(s.minOrder ?? '');
  s.minQty = Number(s.minQty) || 0;
  s.active = s.active !== false;
  return s;
}

function normalizeCmsDoc(doc) {
  if (!isPlainObject(doc)) return null;
  const d = { ...doc };
  d.key = String(d.key ?? '');
  d.shortLabel = String(d.shortLabel ?? '');
  d.fullTitle = String(d.fullTitle ?? '');
  d.updatedAt = String(d.updatedAt ?? '');
  d.content = String(d.content ?? '');
  return d.key ? d : null;
}

/* --------------------------------------------------------------------------
   版本遷移 + 欄位補齊
   核心原則：只補「缺的那個欄位」，絕不因為單一欄位異常就丟棄整份資料。
   -------------------------------------------------------------------------- */
function migrate(raw) {
  const defaults = createDefaultState();

  const orders = Array.isArray(raw.orders)
    ? raw.orders.map(normalizeOrder).filter(Boolean)
    : defaults.orders;

  const customers = Array.isArray(raw.customers)
    ? raw.customers.map(normalizeCustomer).filter(Boolean)
    : defaults.customers;

  const stores = Array.isArray(raw.stores)
    ? raw.stores.map(normalizeStore).filter(Boolean)
    : defaults.stores;

  // 補齊可能新增的種子店家（保留既有店家設定）
  const existingStoreIds = new Set(stores.map(s => s.id));
  defaults.stores.forEach(s => {
    if (!existingStoreIds.has(s.id)) {
      stores.push(s);
    }
  });

  const rawCmsDocs = Array.isArray(raw.cmsDocs)
    ? raw.cmsDocs.map(normalizeCmsDoc).filter(Boolean)
    : defaults.cmsDocs;

  // 移除非法的 CMS 項目（如已不提供之客服說明）並補齊缺失項目
  const allowedCmsKeys = new Set(defaults.cmsDocs.map(d => d.key));
  const cmsDocs = rawCmsDocs.filter(d => allowedCmsKeys.has(d.key));
  const existingCmsKeys = new Set(cmsDocs.map(d => d.key));
  defaults.cmsDocs.forEach(d => {
    if (!existingCmsKeys.has(d.key)) {
      cmsDocs.push(d);
    }
  });

  // activeOrderId 必須指向一筆存在的訂單，否則退回第一筆
  let activeOrderId = String(raw.activeOrderId ?? '');
  if (!activeOrderId || !orders.some(o => o.orderId === activeOrderId)) {
    activeOrderId = orders.length ? orders[0].orderId : '';
  }

  return {
    version: STATE_VERSION,
    activeOrderId,
    stores,
    customers,
    orders,
    cmsDocs
  };
}

function persist(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // 隱私模式或配額已滿時忽略，頁面仍可進行（僅無法跨分頁同步）
  }
}

/* --------------------------------------------------------------------------
   公開 API
   -------------------------------------------------------------------------- */

/**
 * 讀取狀態（首次呼叫時自動載入，之後回傳記憶體快照）
 */
export function getState() {
  if (!memoryState) memoryState = loadState();
  return memoryState;
}

/**
 * 強制重新讀取 localStorage 並更新記憶體快照。
 * 跨分頁同步、頁面初始化時使用。
 */
export function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    raw = null;
  }

  if (!raw) {
    memoryState = createDefaultState();
    persist(memoryState);
    return memoryState;
  }

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    parsed = null;
  }

  if (!isPlainObject(parsed)) {
    // JSON 損毀：退回種子資料（此時本來就沒有可保留的資料）
    memoryState = createDefaultState();
    persist(memoryState);
    return memoryState;
  }

  memoryState = migrate(parsed);
  return memoryState;
}

/**
 * 寫入狀態。同步更新記憶體快照，但不觸發本地 re-render
 * （由呼叫端自行決定何時重繪，避免重複渲染）。
 */
export function saveState(state) {
  memoryState = state;
  persist(memoryState);
  return memoryState;
}

/**
 * 就地修改狀態並存檔。
 * @param {(state: object) => void} mutator
 */
export function updateState(mutator) {
  const state = getState();
  if (typeof mutator === 'function') mutator(state);
  return saveState(state);
}

/**
 * 重置為種子資料（主控台「重置測試資料」使用）。
 */
export function resetState() {
  memoryState = createDefaultState();
  persist(memoryState);
  return memoryState;
}

/**
 * 訂閱「其他分頁」的狀態變更。
 * 同一分頁內的變更不會觸發（由呼叫端自行重繪）。
 * @param {(state: object) => void} listener
 * @returns {() => void} 取消訂閱
 */
export function subscribe(listener) {
  if (typeof listener !== 'function') return () => {};

  subscribers.add(listener);

  if (!storageListenerBound) {
    storageListenerBound = true;
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const state = loadState();
      subscribers.forEach(fn => {
        try {
          fn(state);
        } catch (e) {
          console.error('[store] 訂閱者處理狀態變更時發生錯誤：', e);
        }
      });
    });
  }

  return () => subscribers.delete(listener);
}
