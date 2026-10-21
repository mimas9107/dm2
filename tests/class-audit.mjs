/**
 * class 屬性稽核工具 (tests/class-audit.mjs)
 * ---------------------------------------------------------------------------
 * 目的：分析 4 個頁面的 class 使用情況，找出「靜默失效」的類別。
 *
 * 用法：
 *   node tests/class-audit.mjs            # 完整報告
 *   node tests/class-audit.mjs --no-browser  # 只做靜態分析（不啟動 Chrome）
 *
 * 零外部相依：僅使用 Node 內建 fetch / WebSocket / http。
 *
 * 運作原理：
 *   1) 靜態擷取：解析 HTML 的 class 屬性、JS template 字串內的 class 屬性、
 *      以及 JS 中 `const xxxClass = '...'` 形式的 class 字串常數。
 *   2) 瀏覽器分類：以 Tailwind Play CDN 實際產生的樣式表為準，把每個 token
 *      分為「Tailwind 產出 / 本地自訂 CSS / 查無對應」。
 *   3) 失效驗證：對「查無對應」的 class，實際移除頁面中該 class 後比對計算樣式，
 *      確認它是否真的毫無作用（silent no-op）。
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NO_BROWSER = process.argv.includes('--no-browser');

/** 頁面 ↔ 頁面 JS 模組對應 */
const PAGES = {
  'index.html': 'js/pages/index.js',
  'order_accept.html': 'js/pages/order-accept.js',
  'user_order_track.html': 'js/pages/user-order-track.js',
  'controller.html': 'js/pages/controller.js'
};

/** 各頁「已完成初始化」的判斷條件 */
const READY_PROBE = {
  'index.html': "document.querySelector('#carousel-title')?.textContent.trim().length > 0",
  'order_accept.html': "document.querySelector('#order-status-badge')?.textContent.trim().length > 0",
  'user_order_track.html': "document.querySelector('#track-stage-badge')?.textContent.trim().length > 0",
  'controller.html': "document.querySelector('#stat-store-count')?.textContent.trim().length > 0"
};

/** 受測屬性（移除 class 前後逐一比對） */
const PROPS = [
  'boxShadow', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'left', 'right', 'top', 'bottom', 'width', 'height', 'maxWidth', 'minHeight',
  'backdropFilter', 'filter', 'opacity', 'backgroundColor', 'color', 'borderColor',
  'borderWidth', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight', 'textAlign',
  'display', 'flexDirection', 'gridTemplateColumns', 'gap', 'transform', 'zIndex',
  'position', 'overflow', 'textDecorationLine', 'whiteSpace', 'borderRadius'
];

// ===========================================================================
// 第一段：靜態擷取
// ===========================================================================

/**
 * 把 class 屬性值切成 ('static' | 'expr', 片段) 序列。
 * 需要處理 template literal 內的巢狀 ${...}，因為 ${} 中可能出現字串常數。
 */
function splitInterpolation(value) {
  const parts = [];
  let i = 0;
  let segStart = 0;
  while (i < value.length) {
    if (value[i] === '$' && value[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      while (j < value.length && depth > 0) {
        if (value[j] === '{') depth++;
        else if (value[j] === '}') depth--;
        j++;
      }
      parts.push(['static', value.slice(segStart, i)]);
      parts.push(['expr', value.slice(i, j)]);
      i = segStart = j;
      continue;
    }
    i++;
  }
  parts.push(['static', value.slice(segStart)]);
  return parts;
}

/** Tailwind 類名的合法字元集（排除中文、空格、引號） */
const CLASS_TOKEN = /^[a-z0-9:/\[\]().,%_-]+$/;

/** 取出字串常數（單/雙引號） */
function stringLiterals(text) {
  const out = [];
  const re = /'([^'\\\n]*)'|"([^"\\\n]*)"/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

/** 從 class 屬性值取出所有字面 class 名（靜態片段 + ${} 內的字串常數） */
function tokensFromValue(value) {
  const out = [];
  for (const [kind, seg] of splitInterpolation(value)) {
    if (kind === 'static') {
      for (const t of seg.split(/\s+/)) if (t && CLASS_TOKEN.test(t)) out.push(t);
    } else {
      for (const lit of stringLiterals(seg)) {
        for (const t of lit.split(/\s+/)) if (t && CLASS_TOKEN.test(t)) out.push(t);
      }
    }
  }
  return out;
}

/** 掃描 class="..." 屬性，支援 ${} 內含引號的情況 */
function extractClassAttrs(text) {
  const results = [];
  let i = 0;
  while (true) {
    const idx = text.indexOf('class="', i);
    if (idx === -1) break;
    let j = idx + 'class="'.length;
    let depth = 0;
    let buf = '';
    while (j < text.length) {
      const ch = text[j];
      if (ch === '$' && text[j + 1] === '{') {
        depth++;
        buf += '${';
        j += 2;
        continue;
      }
      if (depth > 0) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        buf += ch;
        j++;
        continue;
      }
      if (ch === '"') break;
      buf += ch;
      j++;
    }
    results.push(buf);
    i = j + 1;
  }
  return results;
}

/** classList.add/remove/toggle('...') */
function extractClassList(text) {
  const out = [];
  const re = /classList\.(?:add|remove|toggle)\(\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(text))) {
    for (const t of m[1].split(/\s+/)) if (t && CLASS_TOKEN.test(t)) out.push(t);
  }
  return out;
}

/** `const xxxClass = '...'` / `const xxxCls = '...'` 形式的 class 字串常數 */
function extractClassConstants(text) {
  const out = [];
  const re = /(?:const|let|var)\s+(\w+)\s*=\s*/g;
  let m;
  while ((m = re.exec(text))) {
    const name = m[1].toLowerCase();
    if (!/(class|classes|cls)$/.test(name)) continue;
    // 掃到 statement 結尾（跳過字串常數內的 ';'）
    let i = m.index + m[0].length;
    let depth = 0;
    let quote = null;
    while (i < text.length) {
      const ch = text[i];
      if (quote) {
        if (ch === '\\') { i += 2; continue; }
        if (ch === quote) quote = null;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; i++; continue; }
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      else if ((ch === ';' || ch === '\n') && depth === 0) break;
      i++;
    }
    for (const lit of stringLiterals(text.slice(m.index + m[0].length, i))) {
      for (const t of lit.split(/\s+/)) if (t && CLASS_TOKEN.test(t)) out.push(t);
    }
  }
  return out;
}

/** 擷取單一頁面的所有 class token */
function extractPageClasses(htmlText, jsText) {
  const htmlTokens = [];
  for (const v of extractClassAttrs(htmlText)) htmlTokens.push(...tokensFromValue(v));

  const jsTokens = [];
  for (const v of extractClassAttrs(jsText)) jsTokens.push(...tokensFromValue(v));
  jsTokens.push(...extractClassList(jsText));
  jsTokens.push(...extractClassConstants(jsText));

  return {
    html: [...new Set(htmlTokens)].sort(),
    js: [...new Set(jsTokens)].sort(),
    all: [...new Set([...htmlTokens, ...jsTokens])].sort()
  };
}

// ===========================================================================
// 第二段：瀏覽器分類
// ===========================================================================

const MIME = {
  '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml',
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8'
};

function serve(dir) {
  const server = createServer(async (req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(dir, p === '/' ? '/index.html' : p);
    if (!f.startsWith(dir) || !existsSync(f)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(await readFile(f));
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

async function startChrome(port, profileDir) {
  const child = spawn('/usr/bin/google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--no-first-run', '--hide-scrollbars', `--window-size=1400,1200`,
    `--user-data-dir=${profileDir}`, `--remote-debugging-port=${port}`, 'about:blank'
  ], { stdio: 'ignore' });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return child; } catch { /* retry */ }
    await sleep(200);
  }
  child.kill('SIGKILL');
  throw new Error('Chrome 啟動逾時');
}

/** 開一個 CDP 連線 */
async function connect(cdpPort) {
  const res = await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: 'PUT' });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise(r => {
    const n = ++id;
    pending.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  return { ws, send };
}

/**
 * 解析樣式表選取器，抽出 class 名。
 * Tailwind 會跳脫特殊字元（如 .md\:grid-cols-12），必須在跳脫前切出本體。
 */
const COLLECT_SCRIPT = `function classesFromSelector(sel) {
  const out = [];
  let i = 0;
  while (i < sel.length) {
    if (sel[i] === '.') {
      i++;
      let name = '';
      while (i < sel.length) {
        const c = sel[i];
        if (c === '\\\\') { name += sel[i + 1] || ''; i += 2; continue; }
        if (': ,>+~[]{}()'.includes(c)) break;
        name += c; i++;
      }
      if (name) out.push(name);
      continue;
    }
    i++;
  }
  return out;
}
(function () {
  const generated = new Set();
  const custom = new Set();
  function walk(rules, isLocal) {
    for (const rule of Array.from(rules || [])) {
      const sel = rule.selectorText;
      if (sel) {
        for (const name of classesFromSelector(sel)) (isLocal ? custom : generated).add(name);
        continue;
      }
      if (rule.cssRules) walk(rule.cssRules, isLocal);
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;
    const isLocal = !!(sheet.href && sheet.href.includes('/css/'));
    walk(rules, isLocal);
  }
  return JSON.stringify({ generated: Array.from(generated), custom: Array.from(custom) });
})()`;

/** 對頁面中實際使用該 class 的元素，移除 class 前後比對計算樣式 */
function measureScript(cls) {
  return `(function () {
    const props = ${JSON.stringify(PROPS)};
    const els = Array.from(document.querySelectorAll('.' + CSS.escape(${JSON.stringify(cls)})));
    if (!els.length) return JSON.stringify({ found: 0 });
    const el = els[0];
    const snap = () => {
      const cs = getComputedStyle(el);
      const o = {};
      for (const p of props) o[p] = cs[p];
      return o;
    };
    const before = snap();
    const had = el.className;
    el.className = had.split(/\\s+/).filter(c => c !== ${JSON.stringify(cls)}).join(' ');
    void el.offsetHeight;
    const after = snap();
    el.className = had;
    const diff = {};
    for (const p of props) if (before[p] !== after[p]) diff[p] = before[p] + '  →  ' + after[p];
    return JSON.stringify({ found: els.length, tag: el.tagName.toLowerCase(), id: el.id || '', diff: diff });
  })()`;
}

/** 依 class 選擇適合的視窗寬度（響應式變體必須在對應斷點下量測） */
function widthFor(cls) {
  if (cls.startsWith('sm:')) return 700;
  if (cls.startsWith('md:')) return 900;
  if (cls.startsWith('lg:')) return 1100;
  return 1280;
}

async function auditBrowser(candidates) {
  const srv = await serve(ROOT);
  const profileDir = mkdtempSync(path.join(tmpdir(), 'class-audit-'));
  const CDP = 9800 + Math.floor(Math.random() * 100);
  const chrome = await startChrome(CDP, profileDir);
  const result = {};

  try {
    for (const [page, cand] of Object.entries(candidates)) {
      const { ws, send } = await connect(CDP);
      await send('Page.navigate', { url: `http://127.0.0.1:${srv.port}/${page}` });

      // 就緒輪詢（Runtime.evaluate 只接受運算式，必須包在 IIFE 內）
      for (let i = 0; i < 100; i++) {
        const r = await send('Runtime.evaluate', {
          expression: `(function(){ return !!(document.readyState === 'complete' && (${READY_PROBE[page]})); })()`,
          returnByValue: true
        });
        if (r?.result?.value) break;
        await sleep(300);
      }
      await sleep(800);

      // 注入所有候選 class，觸發 Tailwind Play CDN 重新掃描並產出規則
      await send('Runtime.evaluate', {
        expression: `(function(){
          let host = document.getElementById('__class_probe__');
          if (!host) { host = document.createElement('div'); host.id = '__class_probe__'; document.body.appendChild(host); }
          host.innerHTML = ${JSON.stringify(cand.all)}.map(c => '<span class="' + c + '"></span>').join('');
          return true;
        })()`,
        returnByValue: true
      });
      await sleep(2500);

      const collect = await send('Runtime.evaluate', { expression: COLLECT_SCRIPT, returnByValue: true });
      const got = JSON.parse(collect.result.value);
      const generated = new Set(got.generated);
      const custom = new Set(got.custom);

      const tailwind = [];
      const customClasses = [];
      const unresolved = [];
      for (const c of cand.all) {
        if (custom.has(c)) customClasses.push(c);
        else if (generated.has(c)) tailwind.push(c);
        else unresolved.push(c);
      }

      // 對「查無對應」的 class 驗證是否真的毫無作用
      const noop = [];
      for (const cls of unresolved) {
        await send('Emulation.setDeviceMetricsOverride', { width: widthFor(cls), height: 1000, deviceScaleFactor: 1, mobile: false });
        await sleep(350);
        const m = await send('Runtime.evaluate', { expression: measureScript(cls), returnByValue: true });
        if (!m?.result?.value) { noop.push({ cls, status: '量測失敗' }); continue; }
        const out = JSON.parse(m.result.value);
        if (!out.found) { noop.push({ cls, status: 'DOM 中無元素使用' }); continue; }
        const keys = Object.keys(out.diff || {});
        noop.push({
          cls,
          status: keys.length ? '有效' : '靜默失效',
          count: out.found,
          target: out.tag + (out.id ? '#' + out.id : ''),
          diff: keys.slice(0, 4).map(k => `${k}: ${out.diff[k]}`)
        });
      }

      result[page] = { tailwind, custom: customClasses, unresolved, noop };
      ws.close();
    }
  } finally {
    chrome.kill('SIGKILL');
    srv.server.close();
    rmSync(profileDir, { recursive: true, force: true });
  }
  return result;
}

// ===========================================================================
// 第三段：輸出報告
// ===========================================================================

function printReport(candidates, browser) {
  const sets = Object.fromEntries(Object.entries(candidates).map(([p, c]) => [p, new Set(c.all)]));
  const union = new Set(Object.values(sets).flatMap(s => [...s]));
  const pagesOf = tok => Object.keys(sets).filter(p => sets[p].has(tok)).map(p => p.replace('.html', ''));

  console.log('='.repeat(96));
  console.log('一、class token 總量');
  console.log('='.repeat(96));
  console.log(
    '頁面'.padEnd(24) + 'HTML 唯一'.padStart(10) + 'JS 唯一'.padStart(10) +
    '合計'.padStart(8) + '跨頁共用'.padStart(10) + '本頁專屬'.padStart(10)
  );
  console.log('-'.repeat(96));
  for (const [page, c] of Object.entries(candidates)) {
    const shared = [...sets[page]].filter(t => pagesOf(t).length >= 2).length;
    console.log(
      page.padEnd(24) + String(c.html.length).padStart(10) + String(c.js.length).padStart(10) +
      String(c.all.length).padStart(8) + String(shared).padStart(10) + String(c.all.length - shared).padStart(10)
    );
  }
  console.log('-'.repeat(96));
  console.log('全站合計'.padEnd(24) + ''.padStart(10) + ''.padStart(10) + String(union.size).padStart(8));

  if (browser) {
    console.log();
    console.log('='.repeat(96));
    console.log('二、樣式來源分類（以瀏覽器實際產生的樣式表為準）');
    console.log('='.repeat(96));
    console.log('頁面'.padEnd(24) + 'Tailwind'.padStart(10) + '自訂 CSS'.padStart(11) + '查無對應'.padStart(11));
    console.log('-'.repeat(96));
    for (const [page, b] of Object.entries(browser)) {
      console.log(
        page.padEnd(24) + String(b.tailwind.length).padStart(10) +
        String(b.custom.length).padStart(11) + String(b.unresolved.length).padStart(11)
      );
    }
    console.log();
    console.log('自訂 CSS 類別（定義於 css/base.css 或 css/pages/*.css）：');
    for (const [page, b] of Object.entries(browser)) {
      if (b.custom.length) console.log(`  ${page.padEnd(24)} ${b.custom.join(', ')}`);
    }

    console.log();
    console.log('='.repeat(96));
    console.log('三、失效驗證（移除 class 後計算樣式是否改變）');
    console.log('='.repeat(96));
    let issues = 0;
    for (const [page, b] of Object.entries(browser)) {
      console.log(`\n${page}`);
      for (const n of b.noop) {
        const mark = n.status === '靜默失效' ? '❌' : n.status === '有效' ? '✅' : '⚠ ';
        console.log(`  ${mark} ${n.cls.padEnd(20)} ${n.status}${n.target ? `  <${n.target}>` : ''}`);
        for (const d of n.diff || []) console.log(`       ${d}`);
        if (n.status === '靜默失效') issues++;
      }
    }
    console.log(`\n  靜默失效合計：${issues} 項`);
  }

  console.log();
  console.log('='.repeat(96));
  console.log('四、4 頁皆使用的共用 class');
  console.log('='.repeat(96));
  const shared4 = [...union].filter(t => pagesOf(t).length === 4).sort();
  console.log(`  共 ${shared4.length} 個`);
  console.log('  ' + shared4.join('  '));
}

// ===========================================================================
// 主流程
// ===========================================================================

const candidates = {};
for (const [page, jsRel] of Object.entries(PAGES)) {
  const htmlText = readFileSync(path.join(ROOT, page), 'utf-8');
  const jsText = readFileSync(path.join(ROOT, jsRel), 'utf-8');
  candidates[page] = extractPageClasses(htmlText, jsText);
}

let browser = null;
if (!NO_BROWSER) {
  try {
    browser = await auditBrowser(candidates);
  } catch (e) {
    console.error('瀏覽器分析失敗：', e.message);
    console.error('（可改用 --no-browser 僅執行靜態分析）');
  }
}

printReport(candidates, browser);

if (process.argv.includes('--json')) {
  console.log('\n---JSON---');
  console.log(JSON.stringify({ candidates, browser }, null, 1));
}
process.exit(0);
