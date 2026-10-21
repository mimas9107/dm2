/* ==========================================================================
   顧客訂單追蹤頁 (user-order-track.js)
   --------------------------------------------------------------------------
   對應 user_order_track.html。負責：
     1. 多筆訂單單號切換
     2. 目前訂單的配送進度條、三階段節點與 ETA
     3. 訂單摘要摺疊

   階段定義對應手繪稿：店家接單 → 已製作完成 → 已送達
   ========================================================================== */

import { getState, loadState, updateState, subscribe } from '../core/store.js';
import { $, delegateActions, escapeHtml, refreshIcons } from '../core/dom.js';

/* --------------------------------------------------------------------------
   三階段狀態定義
   -------------------------------------------------------------------------- */
const trackStages = [
  {
    label: '店家接單',
    etaTitle: '預計送達時間',
    getEtaText: (time) => `${String(time).replace(' 前送到', '')} 前送達`,
    getDesc: (accepted) => (accepted
      ? '店家已確認接受您的訂單，正用心準備餐點中'
      : '訂單已送出，正在等待店家點擊接受訂單...')
  },
  {
    label: '已製作完成',
    etaTitle: '預計送達時間',
    getEtaText: (time) => `${String(time).replace(' 前送到', '')} 前送達（外送員配送中）`,
    getDesc: () => '餐點已製作完成並由專人出發配送，請留意來電'
  },
  {
    label: '已送達',
    etaTitle: '實際送達狀態',
    getEtaText: (time) => `已於 ${String(time).replace(' 前送到', '')} 準時送達`,
    getDesc: () => '餐點已送達指定地址，祝您用餐愉快！'
  }
];

/* --------------------------------------------------------------------------
   頁面狀態
   -------------------------------------------------------------------------- */
let userOrdersData = [];
let currentOrderIdx = 0;
let summaryExpanded = false;

/* --------------------------------------------------------------------------
   狀態同步
   -------------------------------------------------------------------------- */
function syncOrdersFromStorage() {
  const state = loadState();
  userOrdersData = state.orders;

  const targetIdx = userOrdersData.findIndex(o => o.orderId === state.activeOrderId);
  if (targetIdx !== -1) {
    currentOrderIdx = targetIdx;
  } else if (currentOrderIdx >= userOrdersData.length) {
    currentOrderIdx = 0;
  }
}

/* --------------------------------------------------------------------------
   渲染
   -------------------------------------------------------------------------- */
function renderOrderTabs() {
  const container = $('#user-order-tabs');
  if (!container) return;

  container.innerHTML = userOrdersData.map((order, idx) => {
    const isActive = idx === currentOrderIdx;
    const btnClass = isActive ? 'order-tab is-active' : 'order-tab';
    return `<button type="button" data-action="switch-user-order" data-index="${idx}" class="${btnClass}" aria-selected="${isActive}">${escapeHtml(order.orderId)}</button>`;
  }).join('');
}

function switchUserOrder(idx) {
  const target = Number(idx);
  if (!Number.isInteger(target) || target < 0 || target >= userOrdersData.length) return;

  currentOrderIdx = target;
  const order = userOrdersData[target];
  if (order) {
    updateState(s => { s.activeOrderId = order.orderId; });
  }
  renderOrderTabs();
  renderActiveOrder();
}

function renderActiveOrder() {
  const activeOrder = userOrdersData[currentOrderIdx];
  if (!activeOrder) return;

  $('#active-order-store').innerText = activeOrder.storeName;
  $('#track-order-id').innerText = `單號 ${activeOrder.orderId}`;
  $('#summary-store-brief').innerText = activeOrder.storeName;
  $('#summary-store-name').innerText = activeOrder.storeName;
  $('#summary-address').innerText = activeOrder.address;
  $('#summary-customer').innerText = `${activeOrder.customerName} / ${activeOrder.customerPhone}`;

  let total = 0;
  const itemsHtml = activeOrder.items.map(item => {
    const subtotal = item.qty * item.price;
    total += subtotal;
    return `
      <div class="summary-item">
        <span>${escapeHtml(item.name)} × ${item.qty}</span>
        <span class="summary-item__price">NT$ ${subtotal}</span>
      </div>
    `;
  }).join('');

  $('#summary-items-list').innerHTML = itemsHtml;
  $('#summary-total').innerText = `NT$ ${total}`;

  applyTrackStepUI(typeof activeOrder.step === 'number' ? activeOrder.step : 0);
}

/* --------------------------------------------------------------------------
   配送階段
   -------------------------------------------------------------------------- */
function setTrackStep(stepIdx) {
  const step = Number(stepIdx);
  if (!Number.isInteger(step) || step < 0 || step > 2) return;
  if (!userOrdersData[currentOrderIdx]) return;

  updateState(s => {
    const target = s.orders[currentOrderIdx];
    if (!target) return;
    target.step = step;
    if (step > 0) {
      target.accepted = true;
    }
  });

  applyTrackStepUI(step);
}

function applyTrackStepUI(stepIdx) {
  const activeOrder = userOrdersData[currentOrderIdx];
  if (!activeOrder) return;

  const stage = trackStages[stepIdx] || trackStages[0];

  // 右上角階段標籤
  const badge = $('#track-stage-badge');
  if (stepIdx === 0 && !activeOrder.accepted) {
    badge.innerText = '待店家接單確認';
    badge.className = 'tag tag--warning';
  } else if (stepIdx === 2) {
    badge.innerText = stage.label;
    badge.className = 'tag tag--success';
  } else {
    badge.innerText = stage.label;
    badge.className = 'tag tag--brand';
  }

  // 進度條填色寬度 (0% -> 50% -> 100%)
  const progressBar = $('#stepper-progress-bar');
  if (progressBar) {
    if (stepIdx === 0) {
      progressBar.style.width = '0%';
    } else if (stepIdx === 1) {
      progressBar.style.width = '50%';
    } else {
      progressBar.style.width = '100%';
    }
  }

  // 3 個圓圈節點與文字樣式
  for (let i = 0; i < 3; i++) {
    const circle = document.getElementById(`step-circle-${i}`);
    const label = document.getElementById(`step-label-${i}`);
    if (!circle || !label) continue;

    const node = circle.closest('.step-node');
    if (node) {
      node.classList.toggle('is-done', i < stepIdx);
      node.classList.toggle('is-current', i === stepIdx);
      node.setAttribute('aria-current', i === stepIdx ? 'step' : 'false');
    }
  }

  // 預計送達時間區塊
  $('#eta-title').innerText = stage.etaTitle;
  $('#eta-time').innerText = stage.getEtaText(activeOrder.deliverBy || '12:15');
  $('#eta-desc').innerText = stage.getDesc(activeOrder.accepted);

  refreshIcons();
}

/* --------------------------------------------------------------------------
   訂單摘要摺疊
   -------------------------------------------------------------------------- */
function toggleOrderSummary() {
  summaryExpanded = !summaryExpanded;
  const panel = $('#order-summary-panel');
  const chevron = $('#summary-chevron');
  const toggle = $('.summary-toggle');
  if (!panel || !chevron) return;

  if (summaryExpanded) {
    panel.classList.remove('hidden');
    chevron.classList.add('is-open');
  } else {
    panel.classList.add('hidden');
    chevron.classList.remove('is-open');
  }
  if (toggle) {
    toggle.setAttribute('aria-expanded', summaryExpanded ? 'true' : 'false');
  }
}

/* --------------------------------------------------------------------------
   事件
   -------------------------------------------------------------------------- */
function bindActions() {
  delegateActions({
    'switch-user-order': (el) => switchUserOrder(el.dataset.index),
    'set-track-step': (el) => setTrackStep(el.dataset.step),
    'toggle-summary': () => toggleOrderSummary()
  });
}

/* --------------------------------------------------------------------------
   初始化
   -------------------------------------------------------------------------- */
function initTrackPage() {
  syncOrdersFromStorage();
  bindActions();
  renderOrderTabs();
  renderActiveOrder();

  // 跨分頁即時監聽：店家在 order_accept.html 接單或推進配送階段時，顧客端自動更新
  subscribe(() => {
    syncOrdersFromStorage();
    renderOrderTabs();
    renderActiveOrder();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTrackPage);
} else {
  initTrackPage();
}
