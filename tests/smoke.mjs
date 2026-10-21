#!/usr/bin/env node
/* ==========================================================================
   來電送 CALL & DELIVER — 回歸測試
   --------------------------------------------------------------------------
   以 headless Chrome + CDP 驗證四個頁面的核心流程與跨分頁即時同步。

   特性：
     · 零 npm 依賴（僅使用 Node 內建 fetch / WebSocket / http / fs）
     · 內建靜態檔伺服器，不需另外啟動 python3
     · 會自動啟動並關閉 headless Chrome

   執行： node tests/smoke.mjs
   ========================================================================== */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ==========================================================================
   測試框架
   ========================================================================== */

const results = [];
let currentCase = null;

async function testCase(name, fn) {
  currentCase = { name, checks: [] };
  try {
    await fn();
  } catch (err) {
    currentCase.checks.push({ label: '案例執行', ok: false, detail: String(err?.message || err) });
  }
  results.push(currentCase);
  const failed = currentCase.checks.filter(c => !c.ok).length;
  const mark = failed === 0 ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`  ${mark}  ${name}${failed ? `  (${failed} 項未通過)` : ''}`);
  for (const c of currentCase.checks) {
    if (!c.ok) console.log(`        \x1b[31m✗\x1b[0m ${c.label}: ${c.detail}`);
  }
}

function assert(label, condition, detail = '') {
  currentCase.checks.push({ label, ok: !!condition, detail: String(detail) });
}

function assertEqual(label, actual, expected) {
  const ok = String(actual) === String(expected);
  currentCase.checks.push({ label, ok, detail: ok ? '' : `期望 ${JSON.stringify(expected)}，實際 ${JSON.stringify(actual)}` });
}

/* ==========================================================================
   靜態檔伺服器（內建，取代 python3 -m http.server）
   ========================================================================== */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let filePath = path.join(ROOT, urlPath === '/' ? '/index.html' : urlPath);
      if (!filePath.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
      if (!existsSync(filePath)) { res.writeHead(404).end('Not Found'); return; }
      const body = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(body);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/* ==========================================================================
   Headless Chrome + CDP
   ========================================================================== */

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium'
].filter(Boolean);

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate.includes('/') && existsSync(candidate)) return candidate;
    const dirs = (process.env.PATH || '').split(path.delimiter);
    const resolved = dirs.map(d => path.join(d, candidate)).find(p => existsSync(p));
    if (resolved) return resolved;
  }
  return null;
}

async function startChrome(port, profileDir) {
  const bin = findChrome();
  if (!bin) throw new Error('找不到 Chrome/Chromium，請安裝或設定 CHROME_BIN 環境變數');

  const child = spawn(bin, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${port}`,
    'about:blank'
  ], { stdio: 'ignore' });

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return { child, bin };
    } catch { /* 尚未就緒 */ }
    await sleep(200);
  }
  child.kill('SIGKILL');
  throw new Error('Chrome 啟動逾時');
}

/** 一個瀏覽器分頁 */
class Tab {
  constructor(ws, targetId) {
    this.ws = ws;
    this.targetId = targetId;
    this.id = 0;
    this.pending = new Map();
    this.errors = [];
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg.result);
        this.pending.delete(msg.id);
        return;
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params?.exceptionDetails;
        this.errors.push(d?.exception?.description || d?.text || 'exception');
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        const text = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
        if (!/favicon/.test(text)) this.errors.push(text);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve) => {
      const i = ++this.id;
      this.pending.set(i, resolve);
      this.ws.send(JSON.stringify({ id: i, method, params }));
    });
  }

  /** 在頁面中求值；回傳值經 JSON 序列化後取回 */
  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression: `(function(){ ${expression} })()`,
      returnByValue: true,
      awaitPromise: true
    });
    if (res?.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res?.result?.value;
  }

  /** 以字串比較取得文字內容 */
  async text(selector) {
    return this.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      return el ? el.textContent.trim() : null;
    `);
  }

  async count(selector) {
    return this.eval(`return document.querySelectorAll(${JSON.stringify(selector)}).length;`);
  }

  /** 點擊（走真實 click 事件，能觸發 document 層級的事件委派） */
  async click(selector) {
    const ok = await this.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.click();
      return true;
    `);
    if (!ok) throw new Error(`找不到元素：${selector}`);
    await sleep(180);
  }

  async exists(selector) {
    return this.eval(`return !!document.querySelector(${JSON.stringify(selector)});`);
  }

  /** 輪詢等待某個條件成立（避免依賴固定等待時間，CDN 冷啟動時尤其重要） */
  async waitUntil(expression, timeout = 20000, interval = 150) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try {
        if (await this.eval(`return !!(${expression});`)) return true;
      } catch { /* 頁面可能尚未就緒 */ }
      await sleep(interval);
    }
    return false;
  }

  close() {
    try { this.ws.close(); } catch { /* ignore */ }
  }
}

/** 各頁「已完成初始化」的判斷條件 */
const READY_PROBE = {
  'index.html': `document.querySelector('#carousel-title') && document.querySelector('#carousel-title').textContent.trim().length > 0`,
  'order_accept.html': `document.querySelector('#order-status-badge') && document.querySelector('#order-status-badge').textContent.trim().length > 0`,
  'user_order_track.html': `document.querySelector('#track-stage-badge') && document.querySelector('#track-stage-badge').textContent.trim().length > 0`,
  'controller.html': `document.querySelector('#stat-store-count') && document.querySelector('#stat-store-count').textContent.trim().length > 0`
};

async function openTab(cdpPort, url, readyExpr = null) {
  const res = await fetch(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('WebSocket 連線失敗'));
  });
  const tab = new Tab(ws, target.id);
  await tab.send('Runtime.enable');
  if (readyExpr) {
    await tab.waitUntil(readyExpr);
  } else {
    await tab.waitUntil(`document.readyState === 'complete'`);
  }
  await sleep(200);
  return tab;
}

/* ==========================================================================
   主流程
   ========================================================================== */

async function main() {
  console.log('\n\x1b[1m來電送 CALL & DELIVER — 回歸測試\x1b[0m');
  console.log('─'.repeat(64));

  const { server, port } = await startServer();
  const site = `http://127.0.0.1:${port}`;
  const cdpPort = 9500 + Math.floor(Math.random() * 400);
  const profileDir = mkdtempSync(path.join(tmpdir(), 'cdeliver-test-'));

  let chrome = null;
  const openTabs = [];

  try {
    chrome = await startChrome(cdpPort, profileDir);
    console.log(`  伺服器 : ${site}`);
    console.log(`  Chrome : ${chrome.bin}`);
    console.log('─'.repeat(64));

    const newTab = async (page) => {
      const tab = await openTab(cdpPort, `${site}/${page}`, READY_PROBE[page]);
      openTabs.push(tab);
      return tab;
    };

    /* ---------------------------------------------------------------- S1 */
    await testCase('S1 首頁載入、輪播標題與指示條正確', async () => {
      const idx = await newTab('index.html');
      assert('頁面標題正確', (await idx.eval('return document.title;')) === '來電送 — 首頁與店家介紹');
      assertEqual('輪播標題', await idx.text('#carousel-title'), '禾風堂手作便當');
      assertEqual('輪播指示條', await idx.text('#carousel-indicator'), '1 / 7');
      assertEqual('主體背景色套用 base.css', await idx.eval("return getComputedStyle(document.body).backgroundColor;"), 'rgb(248, 246, 244)');
      assertEqual('品牌色權杖生效（.app-brand）', await idx.eval(`
        const e = document.querySelector('.app-brand');
        return e ? getComputedStyle(e).color : '';
      `), 'rgb(200, 75, 49)');
      assert('Logo 圖片載入成功', await idx.eval(`
        const i = document.querySelector('img[alt="來電送 Logo"]');
        return !!i && i.complete && i.naturalWidth > 0;
      `));
      assert('首頁包含 7 家合作店家卡片', await idx.eval(`
        return document.querySelectorAll('.store-dir-card').length === 7;
      `));
      assert('頂部包含使用說明入口', await idx.eval(`
        return !!document.getElementById('nav-instructions');
      `));
      assert('無 console 錯誤', idx.errors.length === 0, idx.errors.join(' | '));
    });

    /* ---------------------------------------------------------------- S2 */
    await testCase('S2 輪播下一張 / 上一張 / 指示條點擊', async () => {
      const idx = await newTab('index.html');
      await idx.click('[data-action="next-slide"]');
      assertEqual('下一張後標題', await idx.text('#carousel-title'), '築地漁火日式定食');
      assertEqual('下一張後指示條', await idx.text('#carousel-indicator'), '2 / 7');

      await idx.click('[data-action="prev-slide"]');
      assertEqual('上一張後標題', await idx.text('#carousel-title'), '禾風堂手作便當');

      await idx.click('[data-action="go-slide"][data-index="2"]');
      assertEqual('指示條點擊第 3 張', await idx.text('#carousel-title'), '青嵐健康水煮餐');
      assertEqual('指示條數字', await idx.text('#carousel-indicator'), '3 / 7');
    });

    /* ---------------------------------------------------------------- S3 */
    await testCase('S3 進入店家詳情、加購、數量增減、購物車小計', async () => {
      const idx = await newTab('index.html');
      await idx.click('[data-action="go-slide"][data-index="0"]');
      await idx.click('[data-action="open-current-restaurant"]');

      assert('已切換到店家詳情', await idx.eval("return !document.getElementById('page-detail').classList.contains('hidden');"));
      assertEqual('詳情店名', await idx.text('#detail-name'), '禾風堂手作便當');
      assertEqual('菜單項目數', await idx.count('#detail-menu-list > div'), 3);

      // 秘傳酥炸排骨便當 = id 101，單價 120
      await idx.click('[data-action="change-qty"][data-item-id="101"][data-delta="1"]');
      assertEqual('加購 1 份後數量', await idx.text('#qty-val-101'), '1');
      assertEqual('購物車件數', await idx.text('#cart-count'), '1');
      assertEqual('購物車小計', await idx.text('#cart-price'), '120');

      await idx.click('[data-action="change-qty"][data-item-id="101"][data-delta="1"]');
      assertEqual('再加 1 份', await idx.text('#qty-val-101'), '2');
      assertEqual('小計更新', await idx.text('#cart-price'), '240');

      await idx.click('[data-action="change-qty"][data-item-id="101"][data-delta="-1"]');
      assertEqual('減 1 份', await idx.text('#qty-val-101'), '1');
      assertEqual('小計再次更新', await idx.text('#cart-price'), '120');
    });

    /* ---------------------------------------------------------------- S4 */
    await testCase('S4 起送門檻：未達門檻提示、達門檻可下單', async () => {
      const idx = await newTab('index.html');
      await idx.click('[data-action="go-slide"][data-index="0"]');
      await idx.click('[data-action="open-current-restaurant"]');

      // 禾風堂 minQty = 3
      await idx.click('[data-action="change-qty"][data-item-id="101"][data-delta="1"]');
      assertEqual('未達門檻按鈕文字', await idx.text('#btn-buy-text'), '還差 2 份起送');
      assertEqual('還差份數', await idx.text('#need-more-count'), '2');
      assert('門檻提示條可見', await idx.eval("return !document.getElementById('cart-warning').classList.contains('hidden');"));

      await idx.click('[data-action="change-qty"][data-item-id="101"][data-delta="1"]');
      await idx.click('[data-action="change-qty"][data-item-id="101"][data-delta="1"]');
      assertEqual('達門檻按鈕文字', await idx.text('#btn-buy-text'), '確認來電訂餐 (3 份)');
      assert('門檻提示條已隱藏', await idx.eval("return document.getElementById('cart-warning').classList.contains('hidden');"));
      assert('下單按鈕可用', await idx.eval("return !document.getElementById('btn-buy').disabled;"));
    });

    /* ---------------------------------------------------------------- S5 */
    await testCase('S5 送出訂單 → 跳追蹤頁 → 追蹤頁出現新單號', async () => {
      const idx = await newTab('index.html');
      await idx.click('[data-action="go-slide"][data-index="0"]');
      await idx.click('[data-action="open-current-restaurant"]');
      await idx.click('[data-action="change-qty"][data-item-id="101"][data-delta="1"]');
      await idx.click('[data-action="change-qty"][data-item-id="101"][data-delta="1"]');
      await idx.click('[data-action="change-qty"][data-item-id="101"][data-delta="1"]');
      await idx.click('[data-action="handle-buy"]');

      assert('撥號確認彈窗開啟', await idx.eval("return !document.getElementById('modal-call').classList.contains('hidden');"));
      assert('彈窗列出訂購明細', (await idx.text('#modal-desc')).includes('秘傳酥炸排骨便當'));

      await idx.click('[data-action="submit-order"]');
      await sleep(1200);

      const track = await newTab('user_order_track.html');
      const tabsText = await track.text('#user-order-tabs');
      assert('追蹤頁顯示新單號 #101', tabsText.includes('#101'), tabsText);
      assertEqual('追蹤頁目前訂單為 #101', await track.text('#track-order-id'), '單號 #101');
      assertEqual('追蹤頁待接單徽章', await track.text('#track-stage-badge'), '待店家接單確認');
    });

    /* ---------------------------------------------------------------- S6 */
    await testCase('S6 店家接單頁接受訂單 + 推進至已製作完成', async () => {
      const accept = await newTab('order_accept.html');
      assertEqual('接單頁初始狀態', await accept.text('#order-status-badge'), '🔔 待接單 (響鈴提醒中)');

      await accept.click('[data-action="accept-order"]');
      assertEqual('接單後狀態', await accept.text('#order-status-badge'), '已接單 • 備餐中');
      assert('訂單摘要彈窗開啟', await accept.eval("return !document.getElementById('modal-accepted').classList.contains('hidden');"));
      await accept.click('[data-action="close-accepted-modal"]');

      assert('已製作完成按鈕可見', await accept.eval("return !document.getElementById('store-stage-controls').classList.contains('hidden');"));
      await accept.click('[data-action="complete-making"]');
      assertEqual('推進到階段 2（已製作完成）', await accept.text('#order-status-badge'), '已製作完成 • 配送中');
      assert('按鈕已為完成禁用狀態', await accept.eval("return document.getElementById('btn-complete-making').disabled;"));
      assert('無 console 錯誤', accept.errors.length === 0, accept.errors.join(' | '));
    });

    /* ---------------------------------------------------------------- S7 */
    await testCase('S7 追蹤頁節點唯讀不可點擊，配送進度由訂單狀態驅動', async () => {
      const track = await newTab('user_order_track.html');

      // 驗證節點為唯讀，不存在可點擊之按鈕
      assert('追蹤頁節點不含可點擊按鈕', await track.eval(`
        return document.querySelectorAll('button[data-action="set-track-step"]').length === 0;
      `));

      // 切換至單號 #102（狀態為店家已製作完成 step: 1）
      await track.click('[data-action="switch-user-order"][data-index="1"]');
      assertEqual('階段 1 進度條寬度', await track.eval("return document.getElementById('stepper-progress-bar').style.width;"), '50%');
      assertEqual('階段 1 徽章', await track.text('#track-stage-badge'), '已製作完成');
      assert('階段 1 ETA 含配送中', (await track.text('#eta-time')).includes('外送員配送中'), await track.text('#eta-time'));

      // 切換至單號 #103（狀態為已送達 step: 2）
      await track.click('[data-action="switch-user-order"][data-index="2"]');
      assertEqual('階段 2 進度條寬度', await track.eval("return document.getElementById('stepper-progress-bar').style.width;"), '100%');
      assertEqual('階段 2 徽章', await track.text('#track-stage-badge'), '已送達');
      assert('階段 2 ETA 含準時送達', (await track.text('#eta-time')).includes('準時送達'), await track.text('#eta-time'));
    });

    /* ---------------------------------------------------------------- S8 */
    await testCase('S8 主控台停權店家 → 首頁即時阻擋下單', async () => {
      const ctl = await newTab('controller.html');
      const idx = await newTab('index.html');

      assertEqual('主控台店家數', await ctl.text('#stat-store-count'), '7');
      assertEqual('主控台停權數', await ctl.text('#sidebar-store-suspended'), '0');

      // 停權第 1 間店家
      await ctl.click('[data-action="toggle-store-active"][data-index="0"]');
      await sleep(900);

      assertEqual('主控台停權數更新', await ctl.text('#sidebar-store-suspended'), '1');
      assert('首頁已同步停權狀態', await idx.eval(`
        return document.getElementById('carousel-tag').textContent.includes('暫停接單');
      `), await idx.text('#carousel-tag'));

      // 進入該店家詳情確認按鈕被停用
      await idx.click('[data-action="go-slide"][data-index="0"]');
      await idx.click('[data-action="open-current-restaurant"]');
      assertEqual('停權後下單按鈕文字', await idx.text('#btn-buy-text'), '店家目前已暫停接單');
      assert('下單按鈕已 disabled', await idx.eval("return document.getElementById('btn-buy').disabled;"));

      // 還原
      await ctl.click('[data-action="toggle-store-active"][data-index="0"]');
      await sleep(600);
    });

    /* ---------------------------------------------------------------- S9 */
    await testCase('S9 主控台黑名單顧客 → 首頁阻擋下單', async () => {
      const ctl = await newTab('controller.html');
      const idx = await newTab('index.html');

      // 將第 1 位顧客王小明設為黑名單
      await ctl.click('[data-action="toggle-blacklist"][data-index="0"]');
      await sleep(900);
      assertEqual('主控台黑名單人數', await ctl.text('#stat-blacklist-count'), '2');

      await idx.click('[data-action="go-slide"][data-index="0"]');
      await idx.click('[data-action="open-current-restaurant"]');
      await idx.click('[data-action="change-qty"][data-item-id="101"][data-delta="1"]');
      await idx.click('[data-action="change-qty"][data-item-id="101"][data-delta="1"]');
      await idx.click('[data-action="change-qty"][data-item-id="101"][data-delta="1"]');
      await idx.click('[data-action="handle-buy"]');

      assert('撥號彈窗開啟', await idx.eval("return !document.getElementById('modal-call').classList.contains('hidden');"));
      assert('黑名單警語顯示', (await idx.text('#modal-blacklist-alert')).includes('黑名單'), await idx.text('#modal-blacklist-alert'));
      assert('撥號按鈕已 disabled', await idx.eval("return document.getElementById('modal-call-btn').disabled;"));

      // 還原
      await ctl.click('[data-action="toggle-blacklist"][data-index="0"]');
      await sleep(600);
    });

    /* ---------------------------------------------------------------- S10 */
    await testCase('S10 主控台編輯 CMS → 首頁彈窗顯示新內容', async () => {
      const ctl = await newTab('controller.html');
      const idx = await newTab('index.html');

      await ctl.click('[data-action="switch-tab"][data-tab="cms"]');
      await ctl.click('[data-action="switch-cms-doc"][data-index="0"]');
      await ctl.click('[data-action="cms-toggle-edit"]');
      assert('編輯模式 textarea 可見', await ctl.eval("return !document.getElementById('cms-edit-textarea').classList.contains('hidden');"));

      const marker = `【測試更新 ${Date.now()}】`;
      await ctl.eval(`
        const ta = document.getElementById('cms-edit-textarea');
        ta.value = ${JSON.stringify(marker)};
        return true;
      `);
      await ctl.click('[data-action="cms-toggle-edit"]');
      await sleep(900);

      assert('主控台檢視區顯示新內容', (await ctl.text('#cms-view-box')).includes(marker));
      assert('首頁條款彈窗同步新內容', await idx.eval(`
        document.querySelector('[data-action="open-cms"][data-key="terms"]').click();
        return true;
      `));
      await sleep(300);
      assert('首頁條款內容已更新', (await idx.text('#modal-cms-body')).includes(marker), await idx.text('#modal-cms-body'));
    });

    /* ---------------------------------------------------------------- S11 */
    await testCase('S11 主控台棄單計數 ≥ 2 → 自動列入黑名單', async () => {
      const ctl = await newTab('controller.html');
      await ctl.click('[data-action="switch-tab"][data-tab="customers"]');

      // 找出目前非黑名單的顧客索引
      const idxNormal = await ctl.eval(`
        const rows = [...document.querySelectorAll('#customer-table-body tr')];
        const i = rows.findIndex(r => r.textContent.includes('權限正常'));
        return i;
      `);

      const before = await ctl.eval(`
        const row = document.querySelectorAll('#customer-table-body tr')[${idxNormal}];
        const m = row.textContent.match(/棄單 (\\d+) 次/);
        return m ? parseInt(m[1], 10) : 0;
      `);

      await ctl.click(`[data-action="record-abandon"][data-index="${idxNormal}"]`);
      await ctl.click(`[data-action="record-abandon"][data-index="${idxNormal}"]`);
      await sleep(300);

      const after = await ctl.eval(`
        const row = document.querySelectorAll('#customer-table-body tr')[${idxNormal}];
        const m = row.textContent.match(/棄單 (\\d+) 次/);
        return m ? parseInt(m[1], 10) : 0;
      `);
      assert('棄單計數遞增', after === before + 2, `${before} → ${after}`);
      assert('達 2 次後自動列入黑名單', await ctl.eval(`
        const row = document.querySelectorAll('#customer-table-body tr')[${idxNormal}];
        return row.textContent.includes('已禁止訂餐');
      `), await ctl.eval(`
        const row = document.querySelectorAll('#customer-table-body tr')[${idxNormal}];
        return row.textContent.replace(/\\s+/g, ' ').slice(0, 80);
      `));
    });

    /* ---------------------------------------------------------------- S12 */
    await testCase('S12 loadState() 缺欄位時不清空訂單（資料遺失防護）', async () => {
      const idx = await newTab('index.html');
      const result = await idx.eval(`
        return (async () => {
          const { loadState, STORAGE_KEY } = await import('/js/core/store.js');
          const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
          const ordersBefore = raw.orders.length;

          // 刻意寫入一份「缺 cmsDocs」但保留訂單的狀態（重構前的 Bug 情境）
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 1,
            activeOrderId: raw.activeOrderId,
            stores: raw.stores,
            customers: raw.customers,
            orders: raw.orders
          }));

          const s = loadState();
          return JSON.stringify({
            ordersBefore,
            ordersAfter: s.orders.length,
            cmsFilled: Array.isArray(s.cmsDocs) && s.cmsDocs.length,
            version: s.version
          });
        })();
      `);
      const r = JSON.parse(result);
      assert('訂單筆數未被清空', r.ordersAfter === r.ordersBefore, `${r.ordersBefore} → ${r.ordersAfter}`);
      assert('缺少的 cmsDocs 已被補上', r.cmsFilled > 0, `cmsDocs = ${r.cmsFilled}`);
      assertEqual('版本已遷移至最新', r.version, 2);
    });

    /* ---------------------------------------------------------------- S13 */
    await testCase('S13 file:// 開啟守衛顯示明確指引（非無聲失敗）', async () => {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(`file://${ROOT}/index.html`)}`, { method: 'PUT' });
      const target = await res.json();
      const ws = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('WS 失敗')); });
      const tab = new Tab(ws, target.id);
      await tab.send('Runtime.enable');

      const shown = await tab.waitUntil(
        `document.body && document.body.innerText && document.body.innerText.includes('serve.sh')`,
        15000
      );
      const body = await tab.eval('return document.body ? document.body.innerText : "";');

      assert('顯示明確指引而非白畫面', shown, String(body).slice(0, 160));
      assert('未顯示半殘的頁面內容', !String(body).includes('禾風堂手作便當'));
      tab.close();
    });

    /* ---------------------------------------------------------------- S14 */
    await testCase('S14 四個頁面皆無 console 錯誤', async () => {
      for (const page of ['index.html', 'order_accept.html', 'user_order_track.html', 'controller.html']) {
        const tab = await newTab(page);
        assert(`${page} 無 console 錯誤`, tab.errors.length === 0, tab.errors.join(' | '));
      }
    });

  } finally {
    for (const tab of openTabs) tab.close();
    if (chrome) chrome.child.kill('SIGKILL');
    server.close();
    try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  console.log('─'.repeat(64));
  const total = results.reduce((n, r) => n + r.checks.length, 0);
  const failed = results.reduce((n, r) => n + r.checks.filter(c => !c.ok).length, 0);
  const failedCases = results.filter(r => r.checks.some(c => !c.ok)).length;

  if (failed === 0) {
    console.log(`\x1b[32m\x1b[1m全部通過\x1b[0m — ${results.length} 個案例 / ${total} 項檢查\n`);
    process.exit(0);
  } else {
    console.log(`\x1b[31m\x1b[1m有失敗項目\x1b[0m — ${failedCases}/${results.length} 個案例失敗，${failed}/${total} 項檢查未通過\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n\x1b[31m測試執行失敗：\x1b[0m', err);
  process.exit(2);
});
