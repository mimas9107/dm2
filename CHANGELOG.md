---
name: "CHANGELOG.md"
description: "來電送 CALL & DELIVER — 變更紀錄（版本單一事實來源）"
created_date: "2026/10/21"
modified_date: "2026/10/22"
project_version: "2.1.0"
document_version: "2.1.0"
agent_sign: ['human/justin', 'claude/claude-sonnet-4-6']
---

# 變更紀錄 (CHANGELOG)

本檔為專案**版本號的單一事實來源 (Source of Truth)**。
`README.md`、`PLAN.md`、`TASK.md`、`CLASS-AUDIT.md` 的 `project_version` 必須與本檔一致。

版本格式：`MAJOR.MINOR.PATCH`
- **MAJOR**：不相容的 API 變更
- **MINOR**：向下相容的新功能
- **PATCH**：向下相容的錯誤修正

---

## [2.1.0] — 2026/10/22

### 新增
- **首頁「探索所有合作店家」區塊**：在首頁輪播下方新增店家卡片網格（`.store-directory` / `.store-dir-card`），展示所有合作店家卡片，並支援點擊直接進入該店菜單選購。
- **頂部導覽列「使用說明」快捷入口**：首頁 Header 右側新增「使用說明」按鈕（`#nav-instructions`），方便顧客進站後一鍵查閱操作流程。
- **店家端單一行動按鈕【已製作完成】**：接單後底部控制列改為顯著的單一行動按鈕（`.btn-complete-making`），點擊後推進訂單階段至「已製作完成」並轉為鎖定狀態。

### 變更
- **店家訂單號按鈕（`.order-tab`）加大**：觸控高度提升至 40px~44px，內距與字級加大，符合無障礙觸控點選規範。
- **合作店家陣容擴增至 7 間**：
  - 新增：4. 炙焰炭烤燒肉丼、5. 越味南洋料理坊、6. 慢燉老火煲仔飯、7. 蔬心綠田植化素餐盒。
  - 首頁輪播指示條改為依店家總數動態生成（1/7 ~ 7/7）。
- **共用狀態庫欄位容錯優化**：[`js/core/store.js`](file:///home/frontend-b/dm2/js/core/store.js) 遷移邏輯增強，自動補齊新增的種子店家與過濾已廢棄之 CMS 條目。

### 移除
- **移除【來電送客服中心】/ 客服說明**：因營運團隊不提供此服務，自種子資料（`seed-data.js`）、前台頁尾連結、前台 CMS 彈窗及後台主控台編輯區中完全移除。
- **店家接單頁底部移除「同步顧客端進度」字樣與 3 階段切換按鈕**。

### 驗證
- `tests/smoke.mjs`：14 個案例 / 73 項檢查，**全部通過**（包含新增之店家數與卡片斷言）。
- `tests/class-audit.mjs --no-browser`：全站 362 個 class 靜態掃描正常無異常。

---

## [2.0.0] — 2026/10/22

> **破壞性變更**：全站移除 Tailwind CSS，所有 class 名稱改為語意化命名。
> 任何依賴舊 class 名稱（`text-brick`、`flex`、`bg-stone-100` …）的外部樣式或腳本皆需同步更新。

### 移除
- **完全移除 Tailwind CSS Play CDN**（`cdn.tailwindcss.com`）
- 刪除 `js/core/tailwind-config.js`（主題設定改為 `css/base.css` 的 CSS 自訂屬性）
- 移除 4 頁 HTML 的 Tailwind CDN `<script>` 與 `tailwind-config.js` 引用

### 新增
- `css/base.css` 全面重寫為 6 段式結構（共 1300+ 行），零 Tailwind 相依：
  1. **設計權杖**：品牌色（brick）、中性色（stone）、語意色（emerald / amber / red）、
     表面與遮罩色、字體與級距、字重、行高、字距、間距刻度、圓角、陰影、
     緩動與時長、容器寬度、z-index —— 全部以 CSS 自訂屬性定義
  2. **重置（reset）**：取代 Tailwind Preflight
  3. **基礎元素**：`h1`–`h4`、`p`、`a`、`button`、`input`、`select`、`textarea`、`table`
  4. **版面外殼**：`.page` / `.app-shell` / `.app-header` / `.app-main` / `.app-footer`
  5. **共用元件**：`.card` / `.btn` / `.badge` / `.chip` / `.field` / `.tab` / `.table` /
     `.modal` / `.toast` / `.empty` / `.icon` / `.icon-btn` / `.tag` / `.alert` / `.link-row`
  6. **單一用途工具類**：僅保留 `.u-*` 前綴的最小集合
- 四頁 `css/pages/*.css` 全數改寫為頁面專屬的語意化 BEM-ish class
  （`.carousel__media`、`.btn--primary`、`.step-node.is-current` …）

### 修正（原 Tailwind 版本即存在的**靜默失效**）
- **12 項 class 靜默失效全數改為實際生效**：專案原本使用 Tailwind Play CDN **v3.4.17**，
  卻使用了 **v4 才有的**類名（`shadow-xs` × 12、`shadow-2xs` × 2、`backdrop-blur-xs` × 6）
  與不存在的間距刻度（`md:py-4.5`、`sm:left-13`、`sm:right-13`），
  這些 class **不產生任何 CSS 且無錯誤訊息**；
  改寫後皆對應到真實權杖數值 —— 陰影與毛玻璃效果**首次真正渲染**
- **3 處鍵盤 focus 圈被遮蔽修復**：`user_order_track.html` 的 3 個進度節點按鈕原本帶有
  `focus:outline-none`，會把 focus 圈轉為透明；現統一由 `base.css` 的
  `:focus-visible { outline: 2px solid brick; outline-offset: 2px }` 提供可見焦點
- **首頁 `hidden` 屬性／class 不一致修復**：`#page-detail`、`#modal-call`、`#modal-cms-info`、
  `#range-mask`、`#detail-cart-badge`、`#cart-warning` 原本使用 `hidden` **屬性**
  （`display:none !important`），但 JS 以 `classList.add/remove('hidden')` 切換 ——
  兩者不一致導致詳情頁**無法顯示**；現統一為 `hidden` **class**，
  並在 `base.css` 同時定義 `[hidden]` 與 `.hidden` 兩種掛鉤
- 首頁 `.btn--full` 元素的 `display` 在 flex 容器內被 blockify 為 `flex`（正常行為），
  已於測試中以 `getComputedStyle` 實測確認版面幾何正確

### 變更
- 4 頁 HTML 全面改寫為純 HTML5 語意標記：
  `<header>` / `<nav>` / `<main>` / `<article>` / `<section>` / `<ul>` / `<li>` / `<footer>`，
  彈窗改為 `role="dialog" aria-modal="true"`
- `<meta name="viewport">` 移除 `maximum-scale` / `user-scalable`（改善無障礙縮放）
- 4 頁新增 `<meta name="description">`
- 頁面標題的連接號由 `-` 改為 `—`（全形破折號），語意更清楚
- 圖示改以 `.icon` + `.icon--xs/--sm/--md/--xl/--lg` + 色彩修飾子處理，
  取代原本的 `w-4 h-4 text-brick` 組合
- 輪播指示條改以 `.indicator-bar.is-active` 修飾子切換，不再逐次拼接 class 字串
- 按鈕狀態改以修飾子切換（`.btn--primary` / `.btn--warning` / `.btn--disabled`），
  不再由 JS 拼出完整 Tailwind 字串

### 保留（不受本次變更影響）
- Google Fonts CDN（`Noto Sans TC` 400 / 500 / 700 / 900）與 Lucide Icons CDN
- 原生 ES Modules（`js/core/` + `js/pages/`）架構
- `data-action` 事件委派機制（**全部對應關係維持不變**）
- 全站元素 `id`（視覺回歸與 smoke 測試以此為基準）
- 跨分頁 `storage` 事件即時同步
- `js/core/store.js` 的 `STATE_VERSION = 2` 資料遺失防護

### 驗證
- `tests/smoke.mjs`：14 個案例 / 70 項檢查，**全部通過**
  - S1 的「Tailwind brick 主題色生效」改為「品牌色權杖生效（`.app-brand`）」
  - S1 的頁目標題斷言同步更新為 `—`
- `node --check`：`js/core/*.js` 與 `js/pages/*.js` 共 9 個檔案全數通過語法檢查
- 瀏覽器幾何驗證（headless Chrome + CDP，零外部相依）：
  - 詳情頁展開後 `.store-card` 390px / `.menu-column` 562px / 菜單卡 116px 高
  - `.detail-grid` 桌機 `row`、手機 `column`；`.stepper__track` 斷點值正確
  - 範圍遮罩、接單彈窗、訂單摘要、CMS 編輯模式之顯示／隱藏切換全部正確
- 孤兒 class 掃描（HTML/JS 使用 vs CSS 定義）：**0 個孤兒**
  （CSS 定義 399 個 class，HTML/JS 使用 335 個，差額為元件修飾子與未用的預留類別）

---

## [1.1.0] — 2026/10/22

### 新增
- `CLASS-AUDIT.md`：各頁面 class 屬性分析總整理
  （總量統計、樣式來源分類、變體與類別分布、設計尺度一致性、元件化候選）
- `tests/class-audit.mjs`：class 稽核工具（零外部相依，Node 內建 `fetch` / `WebSocket`）
  - 靜態擷取：HTML `class` 屬性、JS template 字串內的 `class` 屬性、
    `const xxxClass = '...'` 形式的 class 字串常數
  - 瀏覽器分類：以 Tailwind Play CDN **實際產生的樣式表**為準，
    將每個 class 分為「Tailwind 產出 / 本地自訂 CSS / 查無對應」
  - 失效驗證：對「查無對應」的 class，在真實頁面上移除該 class 後
    比對 38 項計算樣式，確認是否為**靜默失效 (silent no-op)**
  - 支援 `--no-browser`（僅靜態分析）與 `--json`（機器可讀輸出）

### 稽核發現（**尚未修正，待決**）
- **12 項 class 靜默失效**：專案使用 Tailwind Play CDN **v3.4.17**，
  但使用了 **v4 才有的**類名（`shadow-xs` × 12、`shadow-2xs` × 2、
  `backdrop-blur-xs` × 6），以及**間距刻度不存在的數值**
  （`md:py-4.5`、`sm:left-13`、`sm:right-13`）—— 皆不產生任何 CSS 且無錯誤訊息
- **3 處鍵盤 focus 圈被遮蔽**：`user_order_track.html` 的進度按鈕帶有
  `focus:outline-none`，實測會把 `css/base.css` 的磚紅色 focus 圈轉為透明
- 3 個 `group` class 全站無任何 `group-*` 變體配套，屬無作用標記

### 驗證
- `tests/class-audit.mjs`：4 頁合計 452 個不重複 class token，
  906 個由 Tailwind 產出、2 個由本地 CSS 定義、12 項靜默失效（已全數實測確認）
- 6 個建議替代 class 皆已實測確認會在目前的 CDN 版本下產出 CSS

---

## [1.0.0] — 2026/10/21

### 結構重構
- 將 4 個 Monolithic HTML（合計 3130 行）拆分為 `html / css / js` 三層職責分離結構
- 新增 `css/base.css`（全站共用樣式）與 `css/pages/*.css`（各頁專屬樣式）
- 新增 `js/core/`（跨頁共用模組）與 `js/pages/`（各頁專屬邏輯）
- Tailwind 主題設定由 4 份 inline script 外移為 `js/core/tailwind-config.js`
- Logo 移至 `assets/` 目錄

### 修正
- **修正共用狀態庫 4 份重複副本分歧造成的資料遺失風險**：
  `index.html` 與 `controller.html` 的 `loadSharedState()` 原本要求狀態必須含
  `cmsDocs`，否則會**整份重置為預設值並清空全部訂單與顧客資料**；
  現統一由 `js/core/store.js` 處理，改為逐欄位補齊，**任何情況下都不清除既有訂單**
- 修正主控台 `resetSharedPrototypeData()` 與 `loadSharedState()` 之間的資料流不一致

### 新增
- `serve.sh`：一鍵啟動本地開發伺服器（原生 ES Module 需 http:// 協定）
- `js/core/file-protocol-guard.js`：以 `file://` 開啟時給出明確指引，避免無聲失敗
- `tests/smoke.mjs`：headless Chrome 回歸測試，覆蓋 4 頁核心流程與跨頁即時同步
- `PLAN.md` / `TASK.md`：重構設計依據與執行任務表

### 開發流程
- 48 個 inline `onclick` 全數改為 `data-action` + `document` 層級事件委派，
  動態產生的元素不再需要重新綁定事件
- 共用狀態庫 API 統一為 `loadState / saveState / getState / updateState / resetState / subscribe`

### 驗證
- `tests/smoke.mjs`：14 個案例 / 70 項檢查，**全部通過**
  （涵蓋輪播、加購與起送門檻、下單跳轉、三階段推進、跨分頁即時同步、
  黑名單阻擋、CMS 編輯傳播、棄單自動封鎖、`loadState()` 資料遺失防護、
  `file://` 守衛、四頁 console 零錯誤）
- 舊版（git `HEAD`）與新版逐元素比對：4 頁共 117 個帶 id 元素的
  位置、尺寸、文字內容與計算樣式**完全一致**，視覺無回歸
