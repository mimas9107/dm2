/* ==========================================================================
   DOM / 格式化共用工具
   --------------------------------------------------------------------------
   跨頁重複使用的選取器糖、圖示重繪、字串格式化與 HTML 轉義。
   ========================================================================== */

/** 單一元素選取（等同 document.querySelector） */
export const $ = (selector, scope = document) => scope.querySelector(selector);

/** 多元素選取（回傳陣列） */
export const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/**
 * 重繪 Lucide 圖示。
 * Lucide 以 CDN 載入，若 CDN 尚未就緒則安全略過（不中斷頁面流程）。
 */
export function refreshIcons() {
  if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * 格式化配送時間：'12:15' → '12:15 前送到'
 * 已帶有「前送到」字樣時原樣輸出，避免重複疊字。
 */
export function formatDeliverBy(time) {
  const text = String(time ?? '');
  return text.includes('前送到') ? text : `${text} 前送到`;
}

/**
 * 格式化金額：1234 → 'NT$ 1,234'
 */
export function formatMoney(amount) {
  const n = Number(amount) || 0;
  return `NT$ ${n.toLocaleString('en-US')}`;
}

/**
 * HTML 轉義 —— 用於把動態資料插入 innerHTML 前消毒。
 * （CMS 內容、店名、顾客姓名等皆為可編輯資料）
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 以 data-action 為依據的事件委派。
 *
 * 設計目的：取代舊有的 inline onclick。動態產生的元素（template string）
 * 不需要重新綁定事件，只要帶有對應的 data-action 即可運作。
 *
 * @param {Record<string, (el: HTMLElement, event: Event) => void>} handlers
 * @param {EventTarget} [root]
 * @returns {() => void} 解除綁定
 */
export function delegateActions(handlers, root = document) {
  const listener = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const el = target.closest('[data-action]');
    if (!el || !root.contains(el)) return;

    const handler = handlers[el.dataset.action];
    if (typeof handler !== 'function') return;

    handler(el, event);
  };

  root.addEventListener('click', listener);
  return () => root.removeEventListener('click', listener);
}

/**
 * 格式化「YYYY/MM/DD HH:mm」時間戳（主控台編輯 CMS 時使用）。
 */
export function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
