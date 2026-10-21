---
name: "README.md"
description: "來電送 CALL & DELIVER — 午間專送平台前端"
created_date: "2026/10/21"
modified_date: "2026/10/22"
project_version: "2.1.0"
document_version: "2.1.0"
agent_sign: ['human/justin', 'claude/claude-sonnet-4-6']
---

# 來電送 CALL & DELIVER

午間專送外送平台 — 前端 B 組（純前端原型，零後端、零建置工具、**零 CSS 框架**）。

顧客下單 → 店家接單 → 三階段配送追蹤，並由主控台管理店家權限、顧客黑名單與平台條款。
四個頁面透過 `localStorage` + `storage` 事件達成**跨分頁即時同步**。

---

## 快速開始

> ⚠️ **請勿直接雙擊開啟 HTML 檔案。**
> 本專案前端已拆分為原生 ES Modules，而瀏覽器基於安全規範會以 CORS 阻擋
> `file://` 協定的模組載入，雙擊開啟會導致頁面無法運作。
> 請改用下方指令啟動本地伺服器。

```bash
./serve.sh          # 預設 http://localhost:8080/
./serve.sh 3000     # 指定 port
```

需要 `python3`（macOS / Linux 通常已內建；Windows 可用 `py -3 -m http.server 8080`）。

啟動後開啟：

| 網址 | 角色 |
|---|---|
| `/index.html` | **顧客首頁** — 輪播瀏覽店家、選購餐點、撥號確認下單、平台條款 |
| `/order_accept.html` | **店家接單頁** — 叮咚響鈴提醒、接受訂單、推進配送階段 |
| `/user_order_track.html` | **顧客訂單追蹤** — 三階段進度（店家接單 → 已製作完成 → 已送達） |
| `/controller.html` | **主控台** — 店家權限/音效、顧客黑名單、條款與 FAQ 編輯 |

> 想看跨頁即時同步？同時開兩個分頁：
> 一個開 `/controller.html`、一個開 `/index.html`，
> 在主控台把店家設為停權，會即時看到首頁的下單按鈕變成停用狀態。

---

## 專案結構

```
dm/
├── index.html                  顧客首頁
├── order_accept.html           店家接單頁
├── user_order_track.html       顧客訂單追蹤頁
├── controller.html             主控台
│
├── assets/                     靜態資源
│   └── CoDeliver-logo-1020x1020px-20261021.svg
│
├── css/
│   ├── base.css                全站共用樣式（設計權杖 + 重置 + 共用元件 + 工具類）
│   └── pages/                  各頁專屬樣式
│       ├── index.css
│       ├── order-accept.css
│       ├── user-order-track.css
│       └── controller.css
│
├── js/
│   ├── core/                   跨頁共用模組
│   │   ├── file-protocol-guard.js  file:// 開啟守衛（classic script）
│   │   ├── seed-data.js        種子資料單一真相來源
│   │   ├── store.js            共用狀態庫單一真相來源
│   │   ├── dom.js              DOM / 格式化工具
│   │   └── toast.js            共用提示元件
│   └── pages/                  各頁專屬邏輯
│       ├── index.js
│       ├── order-accept.js
│       ├── user-order-track.js
│       └── controller.js
│
├── tests/
│   └── smoke.mjs                headless Chrome 回歸測試
│
├── serve.sh                    一鍵啟動本地伺服器
├── PLAN.md                     重構設計依據
├── TASK.md                     重構執行任務表
├── CLASS-AUDIT.md              Tailwind 時代的 class 稽核歷史紀錄（v1.1.0）
└── CHANGELOG.md                變更紀錄（版本單一事實來源）
```

### 樣式架構

**沒有任何 CSS 框架**。樣式僅兩層，全部手寫：

| 檔案 | 職責 |
|---|---|
| `css/base.css` | 設計權杖（CSS 自訂屬性）、重置、基礎元素、版面外殼、共用元件、`.u-*` 工具類 |
| `css/pages/<page>.css` | 僅該頁使用的區塊樣式 |

**命名約定**

- 區塊用語意名（`.carousel`、`.menu-item`、`.order-card`）
- 修飾子與子元素用 `--` / `__`（`.btn--primary`、`.carousel__media`）
- 狀態用 `.is-*`（`.is-active`、`.is-done`、`.is-current`、`.is-disabled`）
- 通用工具類一律加 `.u-` 前綴（`.u-mono`、`.u-truncate`、`.u-text-muted`）
- **元件規則內不得出現硬編色碼**，一律引用 `base.css` 的權杖

**加入新樣式的流程**

1. 該樣式只有一頁用到 → 寫進 `css/pages/<page>.css`
2. 兩頁以上會用到 → 寫進 `css/base.css` 的「共用元件」段
3. 需要新顏色／間距／圓角 → 先在 `base.css` 的「1. 設計權杖」定義變數，再引用

---

## 開發約定

### HTML
- 不得含 inline `<style>` 與 inline `<script>`（`file-protocol-guard.js` 除外）
- 不得使用 `onclick=` 等 inline 事件屬性
- 使用語意標籤（`<header>` / `<nav>` / `<main>` / `<article>` / `<section>` / `<footer>`）
- 顯示／隱藏統一使用 `hidden` **class**（JS 以 `classList.add/remove('hidden')` 切換）
- 事件統一走 `data-action` + `document` 層級事件委派：

```html
<button type="button" data-action="change-qty" data-item-id="101" data-delta="-1">
```

### JS
- 跨頁共用的邏輯放 `js/core/`，頁面專屬邏輯放 `js/pages/`
- 共用狀態一律透過 `js/core/store.js` 的 `loadState / saveState / updateState / subscribe`，
  **禁止在頁面檔自行操作 `localStorage`**
- 種子資料一律放 `js/core/seed-data.js`，**禁止在頁面檔複製預設資料**
- 動態產生元素時**只切換 `.is-*` 修飾子或增減 class**，
  不要在 JS 內拼接整串樣式 class

### CSS
- 全站共用樣式放 `css/base.css`，頁面專屬樣式放 `css/pages/<頁面>.css`
- `<link>` 載入順序：`base.css` → `pages/<page>.css`（後者優先）

---

## 測試

```bash
node tests/smoke.mjs          # 4 頁核心流程回歸測試（含跨分頁即時同步）
```

以 headless Chrome 執行 4 頁核心流程回歸測試（含跨分頁即時同步），
零外部 npm 依賴（僅用 Node 內建 `fetch` 與 `WebSocket`）。
目前為 14 個案例 / 70 項檢查，全數通過。

> `CLASS-AUDIT.md` 與 `tests/class-audit.mjs` 為 v1.1.0（Tailwind 時代）的稽核產物，
> 其分析對象是已移除的 Tailwind class，於 v2.0.0 之後僅具歷史參考價值，
> 不再納入常規測試流程。

---

## 版本

| 檔案 | 說明 |
|---|---|
| `CHANGELOG.md` | 版本號的**單一事實來源** |
| `README.md` / `PLAN.md` / `TASK.md` | `project_version` 必須與 CHANGELOG 一致 |

目前版本：**2.1.0**
