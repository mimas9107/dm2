/* ==========================================================================
   共用提示元件 (Toast)
   --------------------------------------------------------------------------
   原本 index.html 與 controller.html 各有一份實作，僅外觀位置不同：
     · 首頁    → 置頂置中、琥珀色警示三角（showToastWarning）
     · 主控台  → 置右下、綠色成功圓勾（showToast）
   現統一於此模組，以 variant / position 參數保留兩種外觀。
   ========================================================================== */

import { refreshIcons } from './dom.js';

const ICONS = {
  info: 'alert-triangle',
  warning: 'alert-triangle',
  success: 'check-circle-2'
};

const ICON_COLORS = {
  info: 'toast__icon--warning',
  warning: 'toast__icon--warning',
  success: 'toast__icon--success'
};

const POSITIONS = {
  'top-center': 'toast--top-center',
  'bottom-right': 'toast--bottom-right'
};

/**
 * 顯示一個輕量提示訊息。
 *
 * @param {string} message 提示文字
 * @param {{ variant?: 'info'|'warning'|'success', position?: 'top-center'|'bottom-right', duration?: number }} [options]
 */
export function showToast(message, options = {}) {
  const {
    variant = 'info',
    position = 'top-center',
    duration = 2200
  } = options;

  const toast = document.createElement('div');
  toast.className = `toast ${POSITIONS[position] || POSITIONS['top-center']}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const icon = ICONS[variant] || ICONS.info;
  const color = ICON_COLORS[variant] || ICON_COLORS.info;

  const iconEl = document.createElement('i');
  iconEl.dataset.lucide = icon;
  iconEl.className = `icon icon--sm toast__icon ${color}`;

  const textEl = document.createElement('span');
  textEl.textContent = message;

  toast.appendChild(iconEl);
  toast.appendChild(textEl);
  document.body.appendChild(toast);

  refreshIcons();

  setTimeout(() => {
    toast.classList.add('is-leaving');
    if (position === 'bottom-right') {
      toast.classList.add('is-leaving--down');
    } else {
      toast.classList.add('is-leaving--up');
    }
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
