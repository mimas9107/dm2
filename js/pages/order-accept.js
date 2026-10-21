/* ==========================================================================
   店家接單頁 (order-accept.js)
   --------------------------------------------------------------------------
   對應 order_accept.html。負責：
     1. 訂單列表切換與訂單卡片渲染
     2. 接受訂單與訂單摘要彈窗
     3. 推進配送階段（1. 店家接單 → 2. 已製作完成 → 3. 已送達）
     4. Web Audio「叮咚」提醒與迴圈響鈴
     5. 瀏覽器音訊解鎖（首次使用者手勢後 resume）

   音效僅在「該訂單所屬店家」於主控台開啟通知音效時播放。
   ========================================================================== */

import { getState, loadState, updateState, subscribe } from '../core/store.js';
import { $, $$, delegateActions, escapeHtml, formatDeliverBy, refreshIcons } from '../core/dom.js';

/* --------------------------------------------------------------------------
   頁面狀態
   -------------------------------------------------------------------------- */
let mockOrdersData = [];
let currentOrderIdx = 0;
let audioCtx = null;
let ringTimer = null;

/* --------------------------------------------------------------------------
   音效
   -------------------------------------------------------------------------- */
function isStoreSoundEnabledForOrder(order) {
  if (!order) return false;
  const state = getState();
  const stores = Array.isArray(state.stores) ? state.stores : [];
  const store = stores.find(s => s.id === order.storeId || s.name === order.storeName);
  return store ? store.soundEnabled !== false : true;
}

/** 排程振盪器發出「叮咚」雙連和弦音列（E5 / G5 / C6 × 2，含 triangle 泛音） */
function scheduleChimeNotes(ctx) {
  const now = ctx.currentTime;
  const notes = [
    { freq: 659.25, start: 0.0, duration: 0.16 },  // E5
    { freq: 783.99, start: 0.14, duration: 0.16 }, // G5
    { freq: 1046.50, start: 0.28, duration: 0.42 }, // C6
    { freq: 659.25, start: 0.80, duration: 0.16 },  // E5
    { freq: 783.99, start: 0.94, duration: 0.16 }, // G5
    { freq: 1046.50, start: 1.08, duration: 0.55 }  // C6
  ];

  notes.forEach(note => {
    const osc = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(note.freq, now + note.start);

    harmonic.type = 'triangle';
    harmonic.frequency.setValueAtTime(note.freq * 2, now + note.start);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.15, now + note.start);

    gain.gain.setValueAtTime(0.001, now + note.start);
    gain.gain.exponentialRampToValueAtTime(0.35, now + note.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + note.start + note.duration);

    osc.connect(gain);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + note.start);
    harmonic.start(now + note.start);
    osc.stop(now + note.start + note.duration + 0.02);
    harmonic.stop(now + note.start + note.duration + 0.02);
  });
}

function playIncomingOrderChime() {
  const currentOrder = mockOrdersData[currentOrderIdx];
  if (!currentOrder || currentOrder.accepted) return;
  if (!isStoreSoundEnabledForOrder(currentOrder)) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        const order = mockOrdersData[currentOrderIdx];
        if (audioCtx.state === 'running' && order && !order.accepted && isStoreSoundEnabledForOrder(order)) {
          scheduleChimeNotes(audioCtx);
        }
      }).catch(() => { /* 忽略 */ });
      return;
    }
    scheduleChimeNotes(audioCtx);
  } catch (err) { /* 忽略 */ }
}

function syncOrderAlertSound() {
  stopOrderAlertSound();
  const order = mockOrdersData[currentOrderIdx];
  if (order && !order.accepted && isStoreSoundEnabledForOrder(order)) {
    playIncomingOrderChime();
    ringTimer = setInterval(() => {
      const current = mockOrdersData[currentOrderIdx];
      if (current && !current.accepted && isStoreSoundEnabledForOrder(current)) {
        playIncomingOrderChime();
      } else {
        stopOrderAlertSound();
      }
    }, 4500);
  }
}

function stopOrderAlertSound() {
  if (ringTimer) {
    clearInterval(ringTimer);
    ringTimer = null;
  }
}

/* --------------------------------------------------------------------------
   狀態同步
   -------------------------------------------------------------------------- */
function syncFromStorage() {
  const state = loadState();
  mockOrdersData = state.orders;

  const targetIdx = mockOrdersData.findIndex(o => o.orderId === state.activeOrderId);
  if (targetIdx !== -1) {
    currentOrderIdx = targetIdx;
  } else if (currentOrderIdx >= mockOrdersData.length) {
    currentOrderIdx = 0;
  }
}

/* --------------------------------------------------------------------------
   渲染
   -------------------------------------------------------------------------- */
function switchMockOrder(idx) {
  const target = Number(idx);
  if (!Number.isInteger(target) || target < 0 || target >= mockOrdersData.length) return;

  currentOrderIdx = target;
  const order = mockOrdersData[target];
  if (order) {
    updateState(s => { s.activeOrderId = order.orderId; });
  }
  renderOrder();
  syncOrderAlertSound();
}

function renderOrder() {
  const order = mockOrdersData[currentOrderIdx];
  if (!order) return;

  mockOrdersData.forEach((o, idx) => {
    const btn = document.getElementById(`mock-btn-${idx}`);
    if (btn) {
      btn.innerText = o.orderId;
      btn.classList.toggle('is-active', idx === currentOrderIdx);
      btn.setAttribute('aria-selected', idx === currentOrderIdx ? 'true' : 'false');
    }
  });

  $('#order-store-name').innerText = order.storeName;
  $('#order-id').innerText = `單號 ${order.orderId}`;
  $('#order-deliver-by').innerText = formatDeliverBy(order.deliverBy);
  $('#order-address').innerText = order.address;
  $('#order-customer').innerText = `${order.customerName} / ${order.customerPhone}`;
  $('#order-customer-call').href = `tel:${String(order.customerPhone).replace(/-/g, '')}`;

  let totalQty = 0;
  let totalPrice = 0;
  const itemsHtml = order.items.map(item => {
    totalQty += item.qty;
    const subtotal = item.qty * item.price;
    totalPrice += subtotal;
    return `
      <div class="order-item">
        <span class="order-item__name">${escapeHtml(item.name)}</span>
        <div class="order-item__meta">
          <span class="order-item__qty">x ${item.qty}</span>
          <span class="order-item__subtotal">NT$ ${subtotal}</span>
        </div>
      </div>
    `;
  }).join('');

  $('#order-items-list').innerHTML = itemsHtml;
  $('#order-total-qty').innerText = `共 ${totalQty} 份`;
  $('#order-total-price').innerText = `NT$ ${totalPrice}`;

  const badge = $('#order-status-badge');
  const btnAccept = $('#btn-accept-order');
  const btnAcceptText = $('#btn-accept-text');
  const stageControls = $('#store-stage-controls');
  const soundOn = isStoreSoundEnabledForOrder(order);

  if (order.accepted) {
    const stageNames = ['已接單 • 備餐中', '已製作完成 • 配送中', '已送達完成'];
    const curStep = typeof order.step === 'number' ? order.step : 0;
    badge.innerText = stageNames[curStep] || '已接單 • 備餐中';
    badge.className = 'tag tag--success';
    btnAccept.classList.add('is-accepted');
    btnAcceptText.innerText = '已接受訂單（查看詳情）';
    stageControls.classList.remove('hidden');

    const btnComplete = $('#btn-complete-making');
    const btnCompleteText = $('#btn-complete-making-text');
    if (btnComplete) {
      if (curStep >= 1) {
        btnComplete.classList.add('is-completed');
        btnComplete.disabled = true;
        if (btnCompleteText) btnCompleteText.innerText = '已製作完成（外送員配送中）';
      } else {
        btnComplete.classList.remove('is-completed');
        btnComplete.disabled = false;
        if (btnCompleteText) btnCompleteText.innerText = '已製作完成';
      }
    }
  } else {
    badge.innerText = soundOn ? '🔔 待接單 (響鈴提醒中)' : '🔕 待接單 (後台已設靜音)';
    badge.className = 'tag tag--brand';
    btnAccept.classList.remove('is-accepted');
    btnAcceptText.innerText = '接受訂單！';
    stageControls.classList.add('hidden');
  }

  refreshIcons();
}

/* --------------------------------------------------------------------------
   動作
   -------------------------------------------------------------------------- */
function acceptOrder() {
  const order = mockOrdersData[currentOrderIdx];
  if (!order) return;

  updateState(s => {
    const target = s.orders[currentOrderIdx];
    if (!target) return;
    target.accepted = true;
    if (typeof target.step !== 'number') target.step = 0;
    s.activeOrderId = target.orderId;
  });

  stopOrderAlertSound();
  renderOrder();

  let totalQty = 0;
  let totalPrice = 0;
  const itemsText = order.items.map(i => {
    totalQty += i.qty;
    totalPrice += i.qty * i.price;
    return `${i.name} × ${i.qty}`;
  }).join('、');

  const deliverText = formatDeliverBy(order.deliverBy);

  $('#modal-accepted-summary').innerHTML = `
    <div><span class="summary-line__label">訂單編號：</span><b class="summary-line__value">${escapeHtml(order.orderId)} (${escapeHtml(order.storeName)})</b></div>
    <div><span class="summary-line__label">送達時間：</span><b class="summary-line__value summary-line__value--brand">${escapeHtml(deliverText)}</b></div>
    <div><span class="summary-line__label">收件地址：</span><span class="summary-line__value">${escapeHtml(order.address)}</span></div>
    <div><span class="summary-line__label">顧客資訊：</span><span class="summary-line__value">${escapeHtml(order.customerName)} (${escapeHtml(order.customerPhone)})</span></div>
    <div><span class="summary-line__label">餐點明細：</span><span class="summary-line__value">${escapeHtml(itemsText)}</span></div>
    <div class="summary-line__total">應收金額：NT$ ${totalPrice} (共 ${totalQty} 份)</div>
  `;

  $('#modal-accepted').classList.remove('hidden');
  refreshIcons();
}

/** 店家端直接推進配送階段並同步至顧客追蹤頁 */
function updateOrderStepFromStore(stepIdx) {
  const step = Number(stepIdx);
  if (!Number.isInteger(step) || step < 0 || step > 2) return;
  if (!mockOrdersData[currentOrderIdx]) return;

  updateState(s => {
    const target = s.orders[currentOrderIdx];
    if (!target) return;
    target.accepted = true;
    target.step = step;
    s.activeOrderId = target.orderId;
  });

  renderOrder();
}

function closeAcceptedModal() {
  $('#modal-accepted').classList.add('hidden');
}

/* --------------------------------------------------------------------------
   事件
   -------------------------------------------------------------------------- */
function bindActions() {
  delegateActions({
    'switch-order': (el) => switchMockOrder(el.dataset.index),
    'accept-order': () => acceptOrder(),
    'complete-making': () => updateOrderStepFromStore(1),
    'set-step': (el) => updateOrderStepFromStore(el.dataset.step),
    'close-accepted-modal': () => closeAcceptedModal()
  });

  const modal = $('#modal-accepted');
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeAcceptedModal();
    });
  }
}

/** 瀏覽器自動播放限制：需在使用者手勢後 resume AudioContext */
function bindAudioUnlock() {
  const unlockEvents = ['pointerdown', 'touchstart', 'mousedown', 'keydown'];

  const removeUnlockListeners = () => {
    unlockEvents.forEach(evt => document.removeEventListener(evt, unlockAudio));
  };

  const unlockAudio = (event) => {
    if (event && event.target && event.target.closest && event.target.closest('#btn-accept-order')) {
      removeUnlockListeners();
      return;
    }
    const currentOrder = mockOrdersData[currentOrderIdx];
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        if (currentOrder && !currentOrder.accepted) {
          syncOrderAlertSound();
        }
      }).catch(() => { /* 忽略 */ });
    } else if (currentOrder && !currentOrder.accepted) {
      syncOrderAlertSound();
    }
    removeUnlockListeners();
  };

  unlockEvents.forEach(evt => document.addEventListener(evt, unlockAudio, { passive: true }));
}

/* --------------------------------------------------------------------------
   初始化
   -------------------------------------------------------------------------- */
function initOrderPage() {
  syncFromStorage();
  bindActions();
  renderOrder();

  const initialOrder = mockOrdersData[currentOrderIdx];
  if (initialOrder && !initialOrder.accepted) {
    syncOrderAlertSound();
  } else {
    stopOrderAlertSound();
  }

  bindAudioUnlock();

  // 跨分頁即時監聽：顧客新下單或主控台切換店家靜音時，自動更新畫面與鈴聲
  subscribe(() => {
    syncFromStorage();
    renderOrder();
    syncOrderAlertSound();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOrderPage);
} else {
  initOrderPage();
}
