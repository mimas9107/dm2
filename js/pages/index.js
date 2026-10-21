/* ==========================================================================
   顧客首頁 (index.js)
   --------------------------------------------------------------------------
   對應 index.html。負責：
     1. 首頁輪播（自動播放 / 上下一張 / 指示條）
     2. 店家詳情 view 切換
     3. 菜單渲染、購物車與起送門檻
     4. 外送範圍模擬
     5. 訂餐顧客身分選擇與黑名單阻擋
     6. 送出訂單並跳轉追蹤頁
     7. 平台條款 / 客服 / 介紹 / FAQ 彈窗

   事件處理一律走 data-action + document 層級事件委派，
   動態產生的元素不需重新綁定事件。
   ========================================================================== */

import { restaurants } from '../core/seed-data.js';
import { getState, loadState, updateState, subscribe } from '../core/store.js';
import { $, $$, delegateActions, escapeHtml, refreshIcons } from '../core/dom.js';
import { showToast } from '../core/toast.js';

/* --------------------------------------------------------------------------
   頁面狀態
   -------------------------------------------------------------------------- */
let restaurantsData = [];
let currentSlide = 0;
let carouselTimer = null;
let currentRestaurant = null;
let cart = {};          // { itemId: quantity }
let isOutOfRange = false;
let selectedCustomerId = 1;

const DEFAULT_ADDRESS = '台北市信義區松高路 11 號 5 樓';

/* --------------------------------------------------------------------------
   店家目錄：以前景目錄為基礎，疊加主控台的可變設定
   -------------------------------------------------------------------------- */
function syncRestaurantsWithSharedState() {
  const state = loadState();
  const adminStores = Array.isArray(state.stores) ? state.stores : [];

  restaurantsData = restaurants.map(base => {
    const admin = adminStores.find(s => s.id === base.id || s.name === base.name);
    if (!admin) return { ...base };
    return {
      ...base,
      hours: admin.hours || base.hours,
      minQtyText: admin.minOrder || base.minQtyText,
      minQty: admin.minQty || base.minQty,
      active: typeof admin.active === 'boolean' ? admin.active : base.active,
      soundEnabled: typeof admin.soundEnabled === 'boolean' ? admin.soundEnabled : base.soundEnabled
    };
  });

  if (currentRestaurant) {
    currentRestaurant = restaurantsData.find(r => r.id === currentRestaurant.id) || restaurantsData[0];
  } else {
    currentRestaurant = restaurantsData[0];
  }
}

/* --------------------------------------------------------------------------
   輪播
   -------------------------------------------------------------------------- */
function renderCarouselDots() {
  const container = $('.carousel__dots');
  if (!container) return;
  if (container.children.length !== restaurantsData.length) {
    container.innerHTML = restaurantsData.map((_, idx) => `
      <button type="button" data-action="go-slide" data-index="${idx}" class="indicator-bar" aria-label="第 ${idx + 1} 張"></button>
    `).join('');
  }
}

function updateCarousel() {
  const item = restaurantsData[currentSlide];
  if (!item) return;

  renderCarouselDots();

  $('#carousel-img').src = item.heroImg;
  $('#carousel-tag').innerText = item.active ? item.tag : `${item.tag} (暫停接單)`;
  $('#carousel-title').innerText = item.name;
  $('#carousel-dish').innerText = item.dish;
  $('#carousel-desc').innerText = item.desc;
  $('#carousel-price').innerText = item.price;
  $('#carousel-rating').innerText = item.rating;
  $('#carousel-time').innerHTML = `<i data-lucide="clock" class="icon icon--xs"></i> ${escapeHtml(item.deliverTime)}`;
  $('#carousel-min').innerText = item.minQtyText;
  $('#carousel-indicator').innerText = `${currentSlide + 1} / ${restaurantsData.length}`;

  $$('.indicator-bar').forEach((bar, idx) => {
    bar.classList.toggle('is-active', idx === currentSlide);
    bar.setAttribute('aria-current', idx === currentSlide ? 'true' : 'false');
  });

  refreshIcons();
}

function startCarousel() {
  if (carouselTimer) clearInterval(carouselTimer);
  carouselTimer = setInterval(nextSlide, 5000);
}

function nextSlide() {
  currentSlide = (currentSlide + 1) % restaurantsData.length;
  updateCarousel();
  startCarousel();
}

function prevSlide() {
  currentSlide = (currentSlide - 1 + restaurantsData.length) % restaurantsData.length;
  updateCarousel();
  startCarousel();
}

function goToSlide(idx) {
  const target = Number(idx);
  if (!Number.isInteger(target) || target < 0 || target >= restaurantsData.length) return;
  currentSlide = target;
  updateCarousel();
  startCarousel();
}

/* --------------------------------------------------------------------------
   頁面 view 切換
   -------------------------------------------------------------------------- */
function openRestaurant(restId) {
  syncRestaurantsWithSharedState();
  currentRestaurant = restaurantsData.find(r => r.id === restId) || restaurantsData[0];
  cart = {};
  isOutOfRange = false;

  refreshDetailView();

  $('#page-home').classList.add('hidden');
  $('#page-detail').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  refreshIcons();
}

function refreshDetailView() {
  if (!currentRestaurant) return;

  $('#detail-hero-img').src = currentRestaurant.heroImg;
  $('#detail-tag').innerText = currentRestaurant.active ? currentRestaurant.tag : '後台已暫停接單';
  $('#detail-name').innerText = currentRestaurant.name;
  $('#detail-address').innerText = currentRestaurant.address;
  $('#detail-rating').innerText = currentRestaurant.rating;
  $('#detail-hours').innerText = currentRestaurant.hours;
  $('#detail-phone').innerText = currentRestaurant.phone;
  $('#detail-min-text').innerText = currentRestaurant.minQtyText;

  const statusTag = $('#detail-store-status-tag');
  if (currentRestaurant.active) {
    statusTag.innerText = '免外送費';
    statusTag.className = 'tag tag--outline';
  } else {
    statusTag.innerText = '已停權暫停接單';
    statusTag.className = 'tag tag--danger';
  }

  const state = getState();
  const customers = Array.isArray(state.customers) ? state.customers : [];
  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];
  const custHint = $('#customer-identity-hint');
  if (custHint && activeCustomer) {
    custHint.innerText = activeCustomer.blacklisted
      ? `訂餐人：${activeCustomer.name} (🚫黑名單)`
      : `訂餐人：${activeCustomer.name}`;
    custHint.className = activeCustomer.blacklisted
      ? 'section-note u-text-danger'
      : 'section-note';
  }

  renderDetailMenu();
  updateCartUI();
  updateRangeStateUI();
}

function openCurrentRestaurant() {
  openRestaurant(restaurantsData[currentSlide].id);
}

function goToHome() {
  $('#page-detail').classList.add('hidden');
  $('#page-home').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* --------------------------------------------------------------------------
   菜單 / 購物車
   -------------------------------------------------------------------------- */
function renderDetailMenu() {
  const container = $('#detail-menu-list');
  if (!container || !currentRestaurant) return;

  container.innerHTML = currentRestaurant.menu.map(item => {
    const qty = cart[item.id] || 0;
    return `
      <div class="menu-item ${currentRestaurant.active ? '' : 'is-disabled'}">
        <div class="menu-item__thumb">
          <img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.name)}" class="menu-item__img">
        </div>
        <div class="menu-item__body">
          <h4 class="menu-item__name">${escapeHtml(item.name)}</h4>
          <p class="menu-item__desc">${escapeHtml(item.desc)}</p>
          <div class="menu-item__foot">
            <span class="menu-item__price">NT$ ${item.price}</span>
            <div class="menu-item__qty">
              <button type="button" data-action="change-qty" data-item-id="${item.id}" data-delta="-1" class="qty-btn qty-btn--minus" aria-label="減少 ${escapeHtml(item.name)} 數量">
                −
              </button>
              <span id="qty-val-${item.id}" class="qty-value">${qty}</span>
              <button type="button" data-action="change-qty" data-item-id="${item.id}" data-delta="1" class="qty-btn qty-btn--plus" aria-label="增加 ${escapeHtml(item.name)} 數量">
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  refreshIcons();
}

function changeQty(itemId, delta) {
  if (!currentRestaurant) return;

  if (!currentRestaurant.active) {
    showToast('此店家目前已由後台主控台暫停接單權限！', { variant: 'warning' });
    return;
  }
  if (isOutOfRange) {
    showRangeWarning();
    return;
  }

  const id = Number(itemId);
  const step = Number(delta);
  const current = cart[id] || 0;
  const next = Math.max(0, current + step);

  if (next === 0) {
    delete cart[id];
  } else {
    cart[id] = next;
  }

  const el = document.getElementById(`qty-val-${id}`);
  if (el) el.innerText = next;

  updateCartUI();
}

function updateCartUI() {
  if (!currentRestaurant) return;

  let count = 0;
  let total = 0;
  currentRestaurant.menu.forEach(item => {
    const q = cart[item.id] || 0;
    count += q;
    total += q * item.price;
  });

  $('#cart-count').innerText = count;
  $('#cart-price').innerText = total;

  const badge = $('#detail-cart-badge');
  if (count > 0) {
    badge.innerText = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  const warning = $('#cart-warning');
  const btnBuy = $('#btn-buy');
  const btnBuyText = $('#btn-buy-text');

  // 按鈕狀態以修飾子切換，不再逐次拼字串
  const setBuyState = (state) => {
    btnBuy.classList.remove('btn--primary', 'btn--warning', 'btn--disabled');
    btnBuy.classList.add(state);
  };

  if (!currentRestaurant.active) {
    btnBuy.disabled = true;
    setBuyState('btn--disabled');
    btnBuyText.innerText = '店家目前已暫停接單';
    warning.classList.add('hidden');
    return;
  }

  if (isOutOfRange) {
    btnBuy.disabled = true;
    setBuyState('btn--disabled');
    btnBuyText.innerText = '超出外送範圍無法下單';
    warning.classList.add('hidden');
    return;
  }

  if (count === 0) {
    btnBuy.disabled = false;
    setBuyState('btn--primary');
    btnBuyText.innerText = `選購餐點 (${currentRestaurant.minQtyText})`;
    warning.classList.add('hidden');
  } else if (count < currentRestaurant.minQty) {
    const diff = currentRestaurant.minQty - count;
    btnBuy.disabled = false;
    setBuyState('btn--warning');
    btnBuyText.innerText = `還差 ${diff} 份起送`;
    $('#need-more-count').innerText = diff;
    warning.classList.remove('hidden');
  } else {
    btnBuy.disabled = false;
    setBuyState('btn--primary');
    btnBuyText.innerText = `確認來電訂餐 (${count} 份)`;
    warning.classList.add('hidden');
  }
}

/* --------------------------------------------------------------------------
   外送範圍模擬
   -------------------------------------------------------------------------- */
function toggleRangeSimulation() {
  isOutOfRange = !isOutOfRange;
  updateRangeStateUI();
  updateCartUI();
}

function updateRangeStateUI() {
  const mask = $('#range-mask');
  if (!mask) return;
  if (isOutOfRange) {
    mask.classList.remove('hidden');
  } else {
    mask.classList.add('hidden');
  }
  refreshIcons();
}

function showRangeWarning() {
  showToast('超出店家外送範圍，無法點餐！', { variant: 'warning' });
}

/* --------------------------------------------------------------------------
   訂餐顧客身分
   -------------------------------------------------------------------------- */
function populateCustomerSelect() {
  const state = loadState();
  const select = $('#order-customer-select');
  if (!select) return;

  const customers = Array.isArray(state.customers) ? state.customers : [];
  select.innerHTML = customers.map(c => {
    const tag = c.blacklisted ? ' [🚫黑名單停權]' : '';
    const selected = c.id === selectedCustomerId ? 'selected' : '';
    return `<option value="${c.id}" ${selected}>${escapeHtml(c.name)} (${escapeHtml(c.tel)})${tag}</option>`;
  }).join('');
}

function onCustomerSelectChange() {
  const state = loadState();
  const select = $('#order-customer-select');
  if (select) {
    selectedCustomerId = parseInt(select.value, 10) || 1;
  }

  const customers = Array.isArray(state.customers) ? state.customers : [];
  const customer = customers.find(c => c.id === selectedCustomerId) || customers[0];

  const alertBox = $('#modal-blacklist-alert');
  const callBtn = $('#modal-call-btn');

  if (customer && customer.blacklisted) {
    alertBox.className = 'alert alert--danger';
    alertBox.innerText = `🚫 顧客「${customer.name}」因多次棄單紀錄（累計 ${customer.abandonedCount} 次），已被後台列入黑名單禁止訂餐！`;
    callBtn.disabled = true;
    callBtn.className = 'btn btn--disabled btn--sm-flex';
  } else {
    alertBox.className = 'alert alert--warning alert--warning-lg';
    alertBox.innerText = '📌 提醒：送出即不可改單/棄單。';
    callBtn.disabled = false;
    callBtn.className = 'btn btn--primary btn--sm-flex';
  }

  refreshDetailView();
}

/* --------------------------------------------------------------------------
   下單
   -------------------------------------------------------------------------- */
function handleBuyClick() {
  syncRestaurantsWithSharedState();
  if (!currentRestaurant) return;

  if (!currentRestaurant.active) {
    showToast('此店家目前已由後台主控台暫停接單權限！', { variant: 'warning' });
    return;
  }
  if (isOutOfRange) {
    showRangeWarning();
    return;
  }

  let count = 0;
  let total = 0;
  const itemNames = [];
  currentRestaurant.menu.forEach(item => {
    const q = cart[item.id] || 0;
    if (q > 0) {
      count += q;
      total += q * item.price;
      itemNames.push(`${item.name} × ${q}`);
    }
  });

  if (count === 0) {
    showToast('請先從菜單點選想吃的餐點！', { variant: 'warning' });
    return;
  }
  if (count < currentRestaurant.minQty) {
    showToast(`未滿起送門檻！本店至少需滿 ${currentRestaurant.minQty} 份才可外送喔！`, { variant: 'warning' });
    return;
  }

  $('#modal-desc').innerHTML = `
    <div class="order-summary">
      <div><span class="order-summary__label">店家：</span><b class="order-summary__value u-strong">${escapeHtml(currentRestaurant.name)}</b></div>
      <div><span class="order-summary__label">門市地址：</span><span class="order-summary__value">${escapeHtml(currentRestaurant.address)}</span></div>
      <div><span class="order-summary__label">訂購品項：</span><span class="order-summary__value">${escapeHtml(itemNames.join('、'))}</span></div>
      <div class="order-summary__total">總計金額：NT$ ${total} (免外送費)</div>
    </div>
  `;

  populateCustomerSelect();
  onCustomerSelectChange();
  $('#modal-call').classList.remove('hidden');
  refreshIcons();
}

function submitOrderAndGoTrack() {
  const state = loadState();
  const customers = Array.isArray(state.customers) ? state.customers : [];
  const customer = customers.find(c => c.id === selectedCustomerId) || customers[0];

  if (customer && customer.blacklisted) {
    showToast('此顧客已被列入黑名單，無法送出訂單！', { variant: 'warning' });
    return;
  }
  if (!currentRestaurant) return;

  const orderItems = [];
  currentRestaurant.menu.forEach(item => {
    const q = cart[item.id] || 0;
    if (q > 0) {
      orderItems.push({ name: item.name, qty: q, price: item.price });
    }
  });

  const addrInput = $('#order-address-input');
  const deliveryAddr = (addrInput && addrInput.value.trim()) ? addrInput.value.trim() : DEFAULT_ADDRESS;

  const targetOrderId = `#${100 + currentRestaurant.id}`;
  const newOrder = {
    orderId: targetOrderId,
    storeId: currentRestaurant.id,
    storeName: currentRestaurant.name,
    deliverBy: '12:15',
    address: deliveryAddr,
    customerName: customer ? customer.name : '王小明',
    customerPhone: customer ? customer.tel : '0912-345-678',
    accepted: false, // 新下單預設為「待店家接單」，讓 order_accept.html 響起叮咚音效
    step: 0,
    items: orderItems
  };

  updateState(s => {
    if (!Array.isArray(s.orders)) s.orders = [];
    const existingIdx = s.orders.findIndex(o => o.orderId === targetOrderId);
    if (existingIdx !== -1) {
      s.orders[existingIdx] = newOrder;
    } else {
      s.orders.unshift(newOrder);
    }

    if (customer && !customer.orders.includes(targetOrderId)) {
      customer.orders.push(targetOrderId);
    }

    s.activeOrderId = targetOrderId;
  });

  // 同時保留舊 key 相容性
  try {
    localStorage.setItem('laidiansong_latest_order', JSON.stringify(newOrder));
  } catch (e) { /* 忽略 */ }

  window.location.href = 'user_order_track.html';
}

/* --------------------------------------------------------------------------
   彈窗
   -------------------------------------------------------------------------- */
function closeModal() {
  $('#modal-call').classList.add('hidden');
}

function openCmsInfoModal(docKey) {
  const state = loadState();
  const docs = Array.isArray(state.cmsDocs) ? state.cmsDocs : [];
  const doc = docs.find(d => d.key === docKey) || docs[0];
  if (!doc) return;

  $('#modal-cms-title').innerText = doc.fullTitle;
  $('#modal-cms-updated').innerText = `更新：${doc.updatedAt}`;
  $('#modal-cms-body').innerText = doc.content;

  $('#modal-cms-tabs').innerHTML = docs.map(d => {
    const active = d.key === doc.key;
    const cls = active ? 'cms-tab is-active' : 'cms-tab';
    return `<button type="button" data-action="open-cms" data-key="${escapeHtml(d.key)}" class="${cls}">${escapeHtml(d.shortLabel)}</button>`;
  }).join('');

  $('#modal-cms-info').classList.remove('hidden');
  refreshIcons();
}

function closeCmsInfoModal() {
  $('#modal-cms-info').classList.add('hidden');
}

function focusCartBottom() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

/* --------------------------------------------------------------------------
   所有店家卡片目錄
   -------------------------------------------------------------------------- */
function renderStoreDirectory() {
  const grid = $('#store-directory-grid');
  const countBadge = $('#store-directory-count');
  if (!grid) return;
  if (countBadge) {
    countBadge.innerText = `共 ${restaurantsData.length} 家`;
  }

  grid.innerHTML = restaurantsData.map(item => {
    const statusTag = item.active
      ? `<span class="tag tag--brand">${escapeHtml(item.tag)}</span>`
      : `<span class="tag tag--suspended">暫停接單</span>`;

    return `
      <article class="store-dir-card ${item.active ? '' : 'store-dir-card--inactive'}" data-action="open-store-by-id" data-store-id="${item.id}" role="button" tabindex="0" aria-label="${escapeHtml(item.name)} 菜單介紹">
        <div class="store-dir-card__media">
          <img src="${escapeHtml(item.heroImg)}" alt="${escapeHtml(item.name)}" class="store-dir-card__img" loading="lazy">
          <div class="store-dir-card__tags">
            ${statusTag}
          </div>
          <span class="store-dir-card__dish">${escapeHtml(item.dish)}</span>
        </div>
        <div class="store-dir-card__body">
          <div class="store-dir-card__title-row">
            <h3 class="store-dir-card__title">${escapeHtml(item.name)}</h3>
            <span class="store-dir-card__price">${escapeHtml(item.price)}</span>
          </div>
          <p class="store-dir-card__desc">${escapeHtml(item.desc)}</p>
          <div class="store-dir-card__meta">
            <span class="store-dir-card__rating">
              <i data-lucide="star" class="icon icon--xs icon--star"></i>
              <span>${escapeHtml(item.rating)}</span>
            </span>
            <span class="store-dir-card__time">
              <i data-lucide="clock" class="icon icon--xs"></i>
              <span>${escapeHtml(item.deliverTime)}</span>
            </span>
            <span class="store-dir-card__min">${escapeHtml(item.minQtyText)}</span>
          </div>
        </div>
      </article>
    `;
  }).join('');

  refreshIcons();
}

/* --------------------------------------------------------------------------
   事件委派
   -------------------------------------------------------------------------- */
function bindActions() {
  delegateActions({
    'go-home': () => goToHome(),
    'open-current-restaurant': () => openCurrentRestaurant(),
    'open-store-by-id': (el) => {
      const id = Number(el.dataset.storeId);
      if (id) openRestaurant(id);
    },
    'prev-slide': () => prevSlide(),
    'next-slide': () => nextSlide(),
    'go-slide': (el) => goToSlide(el.dataset.index),
    'open-cms': (el) => openCmsInfoModal(el.dataset.key),
    'close-cms-modal': () => closeCmsInfoModal(),
    'focus-cart-bottom': () => focusCartBottom(),
    'toggle-range': () => toggleRangeSimulation(),
    'handle-buy': () => handleBuyClick(),
    'submit-order': () => submitOrderAndGoTrack(),
    'close-call-modal': () => closeModal(),
    'change-qty': (el) => changeQty(el.dataset.itemId, el.dataset.delta)
  });

  // select 的 change 事件不走 click 委派，需另外綁定
  const select = $('#order-customer-select');
  if (select) {
    select.addEventListener('change', onCustomerSelectChange);
  }

  // 點擊遮罩空白處關閉彈窗
  const callModal = $('#modal-call');
  if (callModal) {
    callModal.addEventListener('click', (event) => {
      if (event.target === callModal) closeModal();
    });
  }

  const cmsModal = $('#modal-cms-info');
  if (cmsModal) {
    cmsModal.addEventListener('click', (event) => {
      if (event.target === cmsModal) closeCmsInfoModal();
    });
  }
}

/* --------------------------------------------------------------------------
   初始化
   -------------------------------------------------------------------------- */
function initApp() {
  syncRestaurantsWithSharedState();
  refreshIcons();
  updateCarousel();
  renderStoreDirectory();
  startCarousel();
  bindActions();

  // 支援網址參數 ?store=1 直接打開指定店家
  const params = new URLSearchParams(window.location.search);
  const storeParam = parseInt(params.get('store'), 10);
  if (storeParam) {
    openRestaurant(storeParam);
  }

  // 跨分頁即時同步：主控台修改店家權限、黑名單或條款時，前台自動更新
  subscribe(() => {
    syncRestaurantsWithSharedState();
    updateCarousel();
    renderStoreDirectory();
    if (!$('#page-detail').classList.contains('hidden')) {
      refreshDetailView();
    }
    if (!$('#modal-call').classList.contains('hidden')) {
      populateCustomerSelect();
      onCustomerSelectChange();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
