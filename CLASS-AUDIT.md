---
name: "CLASS-AUDIT.md"
description: "來電送 CALL & DELIVER — 各頁面 class 屬性分析總整理（Tailwind 時代歷史紀錄）"
created_date: "2026/10/22"
modified_date: "2026/10/22"
project_version: "2.1.2"
document_version: "1.0.0"
agent_sign: ['human/justin', 'claude/claude-sonnet-4-6']
---

# 各頁面 class 屬性分析總整理 (CLASS-AUDIT.md)

> ⚠️ **歷史紀錄（v1.1.0）**
>
> 本報告的稽核對象是**已於 v2.0.0 移除的 Tailwind CSS**。
> 報告中所有 class 名稱、Tailwind 產出統計與靜默失效分析，
> **皆不再反映目前程式碼的狀態**。
>
> - 報告中記載的 **12 項靜默失效** 與 **3 處 focus 圈遮蔽**，
>   已於 v2.0.0 的 T21 全數修正（見 [TASK.md](./TASK.md) §T21、[CHANGELOG.md](./CHANGELOG.md) `[2.0.0]`）
> - `tests/class-audit.mjs` 依賴 Tailwind Play CDN 產生樣式表，
>   在目前版本下**無法重現本報告**，已不納入常規測試流程
> - 現行樣式架構請見 [README.md](./README.md) 的「樣式架構」章節
>
> 保留本文件是為了留下「為什麼要移除 Tailwind」的實證依據。

## 原始說明

> 本文件是**class 使用情形的稽核報告**：有哪些 class、從哪來、跨頁共用了多少、
> 哪些其實根本沒生效。
>
> - 重構設計依據：[PLAN.md](./PLAN.md)
> - 執行步驟與進度：[TASK.md](./TASK.md)
> - 變更紀錄：[CHANGELOG.md](./CHANGELOG.md)
> - ~~重跑本報告：`node tests/class-audit.mjs`~~（v2.0.0 起無法重現）

---

## 0. 結論摘要

| 項目 | 結果 |
|------|------|
| 全站不重複 class token | **452** 個 |
| 由 Tailwind 產生樣式 | **906** 個（跨頁重複計） |
| 由本地 CSS 定義 | **2** 個（`out-of-range-mask`、`incoming-order-banner`） |
| 4 頁皆使用的共用 class | **99** 個 |
| **查無對應樣式（靜默失效）** | **12** 項 ← **需處理** |
| **鍵盤 focus 圈被遮蔽** | **3 處**（`user_order_track.html` 進度按鈕）← **需處理** |

**最重要的發現**：專案使用 Tailwind **Play CDN v3.4.17**，但有 3 個 class 名
是 **Tailwind v4 才有的**（`shadow-xs`、`shadow-2xs`、`backdrop-blur-xs`），
另有 4 個 class 使用了 **Tailwind 間距刻度不存在的數值**（`md:py-4.5`、
`sm:left-13`、`sm:right-13`）。這 7 個 class **不會產生任何 CSS，也沒有任何錯誤訊息**。

次要發現：`user_order_track.html` 的 3 個進度按鈕帶有 `focus:outline-none`，
實測會把 `css/base.css` 定義的磚紅色 focus 圈變成透明，造成**鍵盤操作無可見 focus 指示**。

---

## 1. 分析方法

本報告的數據不是靜態字串比對，而是**以瀏覽器實際產生的樣式表為準**：

| 階段 | 做法 | 工具 |
|------|------|------|
| ① 靜態擷取 | 解析 HTML 的 `class` 屬性、JS template 字串內的 `class` 屬性、JS 中 `const xxxClass = '...'` 形式的 class 字串常數 | `tests/class-audit.mjs` |
| ② 樣式來源分類 | 載入頁面 → 注入所有候選 class 觸發 Tailwind 重新產檔 → 走訪 `document.styleSheets`（含 `@media` 遞迴）比對每個 class 是否有對應規則 | 同上 |
| ③ 失效驗證 | 對「查無對應」的 class，**在真實頁面上移除該 class**，比對 38 項計算樣式是否改變 | 同上 |

> 為何不用 Tailwind CLI 建置後比對？本專案是**零建置工具**的純靜態網站，
> Tailwind 以 Play CDN 動態產檔，沒有可供比對的本機 CSS 產物。
> 因此改以「瀏覽器實際產出的樣式表」作為唯一事實來源。

**解析注意事項**：Tailwind 產出的選取器會跳脫特殊字元（`.md\:grid-cols-12`、
`.bg-red-200\/60`、`.scale-\[0\.98\]`）。稽核工具在跳脫前先切出 class 名本體，
否則會把 `md:grid-cols-12` 誤判成 `md`。

---

## 2. class token 總量

| 頁面 | HTML 唯一 | JS 唯一 | 合計 | 跨頁共用 | 本頁專屬 |
|------|-----------:|--------:|-----:|---------:|---------:|
| `index.html` | 294 | 65 | 309 | 200 | 109 |
| `order_accept.html` | 215 | 26 | 219 | 188 | 31 |
| `user_order_track.html` | 187 | 7 | 188 | 148 | 40 |
| `controller.html` | 190 | 46 | 204 | 153 | 51 |
| **全站合計** | — | — | **452** | — | — |

> **JS 唯一欄位**代表只出現在 `js/pages/*.js` 的 template 字串中的 class。
> 這些 class 在靜態 HTML 中不存在，Tailwind Play CDN 必須等頁面 runtime 渲染
> 後才會產出對應樣式 —— **首次繪製有 FOUC 風險**（詳見 §6.3）。

### 2.1 樣式來源分類

| 頁面 | Tailwind 產出 | 本地自訂 CSS | 查無對應 |
|------|---------------:|-------------:|---------:|
| `index.html` | 304 | 1 | 4 |
| `order_accept.html` | 215 | 1 | 3 |
| `user_order_track.html` | 184 | 0 | 4 |
| `controller.html` | 203 | 0 | 1 |

本地自訂 CSS 僅 2 個類別，佔比不到 1%，樣式體系高度集中在 Tailwind：

| 類別 | 定義位置 | 用途 |
|------|----------|------|
| `out-of-range-mask` | `css/pages/index.css` | 首頁輪播超出範圍區的漸層遮罩 |
| `incoming-order-banner` | `css/pages/order-accept.css` | 接單頁「有新訂單」橫幅的進場動畫 |

另有 1 個**純 JS hook**（`indicator-bar`），只有 class 名、沒有任何 CSS 規則，
供 `js/pages/index.js` 用 `querySelectorAll('.indicator-bar')` 選取輪播指示點。
這是**刻意設計**，不是錯誤。

---

## 3. 靜默失效清單（需處理）

以下 12 項經瀏覽器實測確認：**把 class 從真實元素上移除，38 項計算樣式完全沒有變化**，
代表這些 class 從來沒有生效過。

### 3.1 Tailwind v4 類名誤用在 v3 CDN（7 處影響 4 頁）

專案載入的是 `https://cdn.tailwindcss.com` → **Tailwind v3.4.17**。
下列 class 屬於 **Tailwind v4** 的陰影 / 背景模糊刻度，v3 沒有對應 utility：

| class | 影響範圍 | 原始碼位置 | 實際效果 |
|-------|---------|-----------|---------|
| `shadow-xs` | **4 頁 × 12 處** | `index.html:31,182,235`、`order_accept.html:31,46,91,121,202`、`controller.html:31,126,189,252,287`、`user_order_track.html:31`，以及 5 個 JS 檔 | 陰影完全沒套用 |
| `shadow-2xs` | `index.html:45,49` | 導覽列按鈕 | 陰影完全沒套用 |
| `backdrop-blur-xs` | `index.html:83,86,323,363`、`order_accept.html:75,200` | 輪播箭頭、遮罩層 | 背景模糊完全沒套用 |

> **成因**：Tailwind v4 把陰影刻度從 `shadow-sm / shadow / shadow-md…`
> 改為 `shadow-2xs / shadow-xs / shadow-sm / shadow-md…`（多出 `2xs`、`xs` 兩級）。
> v3 沒有這兩級 → class 被忽略，**Tailwind 不會報錯**。

### 3.2 間距刻度使用不存在的數值（3 處影響 2 頁）

Tailwind v3 預設間距刻度為 `0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16…`
（**沒有 `4.5`、沒有 `13`**）：

| class | 原始碼位置 | 原始碼上下文 | 實際效果 |
|-------|-----------|------------|---------|
| `md:py-4.5` | `order_accept.html:156` | `py-4 md:py-4.5 px-6` | md 以上仍用 `py-4`（1rem），原意 1.125rem 未生效 |
| `sm:left-13` | `user_order_track.html:85` | `left-9 right-9 sm:left-13 sm:right-13 md:left-14 md:right-14` | sm 區間退回 `left-9/right-9` |
| `sm:right-13` | `user_order_track.html:85` | 同上 | sm 區間退回 `right-9` |

> **影響範圍**：`sm:` 為 640–767px、`md:` 為 768px 以上。
> `user_order_track.html` 的進度條在 **640–767px 視窗寬度**下，
> 內縮會比設計稿少一階（36px vs 52px）。

### 3.3 建議替代 class（已實測驗證會產出 CSS）

| 現行（無效） | 建議替代 | 驗證 |
|-------------|---------|------|
| `shadow-xs` | `shadow-sm` | ✅ 已產出規則 |
| `shadow-2xs` | `shadow-[0_1px_1px_0_rgb(0_0_0_/_0.03)]` | ✅ 已產出規則 |
| `backdrop-blur-xs` | `backdrop-blur-sm` | ✅ 已產出規則 |
| `md:py-4.5` | `md:py-[1.125rem]` | ✅ 已產出規則 |
| `sm:left-13` | `sm:left-[3.25rem]` | ✅ 已產出規則 |
| `sm:right-13` | `sm:right-[3.25rem]` | ✅ 已產出規則 |

> `shadow-sm` / `backdrop-blur-sm` 是 v3 的對應級距；
> 需精確數值者使用 Tailwind 任意值語法 `[]`。
> **注意**：套用後會改變實際外觀（恢復原本設計意圖），與重構前的 `git HEAD` 版本
> 不再像素一致 —— 這是「修正」而非「退化」。

---

## 4. 變體（variant）使用統計

| 變體 | index | order_acc | user_track | controller | 全站 |
|------|------:|----------:|-----------:|-----------:|-----:|
| (無變體，基礎類別) | 227 | 172 | 144 | 170 | **713** |
| `md:` | 57 | 36 | 29 | 19 | **141** |
| `hover:` | 8 | 5 | 4 | 7 | **24** |
| `sm:` | 6 | 3 | 8 | 3 | **20** |
| `active:` | 5 | 2 | 1 | 1 | **9** |
| `lg:` | 4 | 1 | 1 | 1 | **7** |
| `focus:` | 2 | 0 | 1 | 3 | **6** |

**觀察**：

1. 響應式以 `md:`（768px）為主斷點，`lg:` 僅 7 個、`sm:` 僅 20 個 ——
   設計上是「手機單欄 / 桌機多欄」兩段式，中間斷點刻意留白。
2. `focus:` 只有 6 個，且**全部集中在 `focus:outline-none`（6 處）**。
   這代表鍵盤操作時**沒有可見的 focus 圈**，與 `css/base.css` 裡
   `:focus-visible { outline: 2px solid #C84B31 }` 的設計意圖抵觸 ——
   `outline-none` 會把它蓋掉。**這是 a11y 問題**（見 §6.1）。
3. `focus:border-brick`（index.html）與 `focus:ring-brick/30`（controller.html）
   是唯二有實際 focus 樣式的類別。

### 4.1 `focus:outline-none` 遮蔽 focus 圈（實測確認）

以真實鍵盤 `Tab` 觸發 `:focus-visible` 後量測計算樣式：

| 元素 | 計算樣式 | 結果 |
|------|---------|------|
| 一般可聚焦元素（無 `focus:outline-none`） | `rgb(200, 75, 49) solid 2px` | ✅ 磚紅色 focus 圈可見 |
| 帶 `focus:outline-none` 的按鈕 | `rgba(0, 0, 0, 0) solid 2px` | ❌ outline 透明，**focus 圈看不見** |
| 同上，但移除 `focus:outline-none` | `rgb(200, 75, 49) solid 2px` | ✅ 圈又回來了 |

6 處受影響位置：

| 位置 | 元素 | 元素本身已有替代指示 |
|------|------|---------------------|
| `index.html:334` | `<select id="order-customer-select">` | ✅ `focus:border-brick`（邊框變磚紅） |
| `index.html:339` | `<input id="order-address-input">` | ✅ `focus:border-brick`（邊框變磚紅） |
| `controller.html:299` | `<textarea id="cms-edit-textarea">` | ✅ `focus:ring-2 focus:ring-brick/30`（外框光暈） |
| `user_order_track.html:90` | 進度步驟按鈕 `data-step="0"` | ❌ **無任何替代指示** |
| `user_order_track.html:100` | 進度步驟按鈕 `data-step="1"` | ❌ **無任何替代指示** |
| `user_order_track.html:110` | 進度步驟按鈕 `data-step="2"` | ❌ **無任何替代指示** |

> **結論**：前 3 處雖然移除了 outline 圈，但仍留有可見的 focus 指示（邊框 / ring），
> a11y 影響輕微；但 **`user_order_track.html` 的 3 個進度按鈕完全沒有可見的鍵盤 focus 指示**，
> 屬實際障礙，應優先修正（移除 `focus:outline-none` 即可）。

---

## 5. 功能類別分布

| 類別 | index | order_acc | user_track | controller | 全站 |
|------|------:|----------:|-----------:|-----------:|-----:|
| 版面 / 間距 | 104 | 68 | 64 | 54 | **290** |
| 尺寸 / flex / grid | 69 | 51 | 40 | 41 | **201** |
| 其他 / 未分類 | 32 | 29 | 25 | 24 | **110** |
| 文字 / 字型 | 32 | 26 | 21 | 29 | **108** |
| 色彩 | 39 | 22 | 16 | 30 | **107** |
| 邊框 / 圓角 | 22 | 18 | 14 | 23 | **77** |
| 互動 / 動畫 | 10 | 4 | 8 | 3 | **25** |
| 效果（blur / drop-shadow） | 1 | 1 | 0 | 0 | **2** |

---

## 6. 各頁面專屬 class 分析

### 6.1 `index.html` — 專屬 109 個（全站最多）

首頁是版面最複雜的頁面，專屬 class 也是最多。依用途分組：

| 用途 | 類別（節錄） | 數量 |
|------|-------------|-----:|
| 輪播（carousel） | `bg-gradient-to-t` `from-black/70` `from-black/75` `via-black/20` `via-transparent` `to-black/25` `to-transparent` `pointer-events-auto` `pointer-events-none` `inset-x-0` `inset-x-3` `duration-700` `transition-opacity` `indicator-bar` `out-of-range-mask` | 20 |
| 輪播指示點 | `h-1.5` `w-8` `w-3` `rounded-full` | — |
| 商品 / 店家卡片 | `line-clamp-1` `md:line-clamp-3` `object-cover` `max-h-64` `max-w-full` `bg-stone-100` `w-16` `w-20` `md:w-20` `md:h-20` `md:h-52` `md:h-96` `lg:h-60` `lg:h-[420px]` | — |
| 訂單抽屜 / 購物車 | `bg-amber-50` `border-amber-100` `text-amber-500` `text-amber-600` `text-amber-700` `fill-amber-500` `bg-red-100` `hover:bg-red-100/80` `pb-24` `md:pb-28` `max-w-md` `md:max-w-sm` | — |
| 導覽列 | `shadow-2xs` `hover:bg-black` `hover:bg-black/60` `hover:bg-red-100/80` `hover:scale-105` | — |
| 徽章 / 數字 | `-top-1` `-right-1` `bg-brick` `text-white` `w-5` `h-5` `rounded-full` | — |
| 響應式 | `sm:flex-1` `sm:flex-row` `sm:gap-2` `sm:h-56` `sm:h-72` `sm:items-center` + `md:` 30 個 + `lg:` 3 個 | 39 |

**專屬性高的原因**：首頁承擔輪播、商品瀏覽、購物車、訂單提交、CMS 資訊彈窗
五種截然不同的版面，與其他三頁（接單 / 追蹤 / 主控台）沒有可共用的元件。

### 6.2 `order_accept.html` — 專屬 31 個（全站最少）

| 用途 | 類別 | 數量 |
|------|------|-----:|
| 進場橫幅 | `incoming-order-banner` `bg-emerald-50` `border-emerald-200` `text-emerald-600` `bg-black/20` `bg-white/20` `inline-flex` `items-stretch` `self-center` `order-1` `order-2` `order-last` `my-4` `py-7` `shadow-red-950/20` `border-red-900/10` | 16 |
| 響應式重排 | `md:justify-between` `md:order-1` `md:order-2` `md:order-none` `md:self-auto` `md:px-3.5` `md:px-8` `md:py-1.5` `md:py-4.5` `md:py-6` `md:text-left` | 11 |

> `md:order-none` 用來在桌機取消 `order-last` 的手機置底效果 ——
> 這是本專案少數用到「重設值」的 class 型態。

### 6.3 `user_order_track.html` — 專屬 40 個

| 用途 | 類別 | 數量 |
|------|------|-----:|
| 進度條 | `left-9` `right-9` `sm:left-13` `sm:right-13` `md:left-14` `md:right-14` `top-7` `md:top-8` `w-2` `h-2` `z-0` `rotate-180` `transition-transform` `duration-500` | 13 |
| 步驟按鈕 | `group` `relative` `z-10` `flex-col` `items-center` `gap-2.5` `focus:outline-none` `transition-colors` `bg-stone-50/70` `hover:bg-stone-100/80` | 11 |
| 訂單分頁 | `sm:w-64` `md:w-16` `md:col-span-6` `md:flex` `md:gap-9` `md:h-16` `md:hidden` `max-w-2xl` | — |

**⚠ 注意**：本頁的 class 幾乎全在 **JS 動態產生**（JS 唯一僅 7 個），
代表表格、訂單卡、分頁按鈕的樣式全部由 `js/pages/user-order-track.js`
在 runtime 注入 DOM。Tailwind Play CDN 需等這些節點渲染後才補產 CSS ——
**首次載入會有一瞬間的未套用樣式**。

**⚠ `group` 為無效標記**：全站搜尋確認**沒有任何 `group-hover:` / `group-focus:`
變體**，因此 `group` 這 3 個 class 完全沒有作用，可直接移除。

### 6.4 `controller.html` — 專屬 51 個

| 用途 | 類別 | 數量 |
|------|------|-----:|
| 資料表格 | `border-collapse` `divide-y` `divide-stone-100` `divide-stone-200/80` `md:divide-x` `md:divide-y-0` `align-top` `border-b-2` `border-stone-300/80` `overflow-x-auto` `min-w-[320px]` `max-h-72` `shadow-inner` `shadow-sm` `shadow-stone-200/60` `line-through` | 17 |
| 狀態色（黑名單） | `bg-red-50/50` `text-red-600` `text-red-700` `text-emerald-700` `hover:bg-stone-300` `hover:bg-white/60` `hover:text-stone-900` | 7 |
| CMS 編輯器 | `resize-none` `min-h-[260px]` `min-h-[340px]` `focus:ring-2` `focus:ring-brick/30` `leading-tight` `leading-snug` `space-y-2` | 9 |
| 響應式 | `md:w-48` `md:w-auto` `md:flex-initial` | 3 |

> `focus:ring-2 focus:ring-brick/30` 是全站**唯一**使用 ring 樣式的 focus 指示，
> 效果與 `css/base.css` 的 `:focus-visible` outline 重疊（會同時出現）。

---

## 7. 設計尺度一致性

### 7.1 色彩槽位

| 前綴 | 色票數 | 說明 |
|------|-------:|------|
| `bg-*` | 32 | 以 `stone-*`（11 種）為主，另有 `brick-*`（4 種）、`white`（4 種）、`black`（3 種） |
| `text-*` | 16 | 以 `stone-300…900`（7 階）為主 |
| `border-*` | 15 | 以 `stone-100/200/300`（6 種）為主 |

**透明度梯度分歧**（同一底色被切成多種不透明度）：

| 底色 | 使用的透明度 | 問題 |
|------|------------|------|
| `black` | 20, 25, 40, 60, 70, 75 | **6 種不透明度**，其中 70 / 75 幾乎無差異（漸層用） |
| `white` | 20, 50, 60, 95 | 50 與 60 僅差 10% |
| `brick-light` | 70, 80 | 兩種透明度並存於不同頁面 |
| `stone-50` | 40, 50, 70, 90 | **4 種**，全部集中在 controller |

**建議**：為「遮罩 / 浮層 / 淡底」各定義單一數值（例如遮罩一律 `bg-black/40`、
浮層一律 `bg-white/95`），消除近似值並存。

### 7.2 尺度階梯

| 類別 | 級數 | 清單 |
|------|-----:|------|
| 陰影 | 12 | `2xs` `xs` `sm` `md` `lg` `xl` `2xl` `inner` + 4 個帶色陰影 |
| 圓角 | 6 | `md` `lg` `xl` `2xl` `3xl` `full` |
| 間距 `gap-*` | 16 | `1` `1.5` `2` `2.5` `3` `3.5` `4` `5` `6` `7` `9` + `gap-x/y` |
| 內距 `p-*` | 11 | `1.5` `2` `2.5` `3` `3.5` `4` `5` `6` `7` `8` `10` |
| 內距 `py-*` | 14 | 多出 `py-4.5`（**無效值**）與 `py-0.5` |
| 文字 `text-*` | 22 | `xs` `base` `xl` + 色彩 + 對齊 |

**陰影刻度問題**：實際生效的只有 `sm` `md` `lg` `xl` `2xl` `inner` 與帶色陰影；
`2xs` / `xs` 是 v4 名稱（在 v3 無效，見 §3.1）。
套用修正後陰影刻度會變成 8 級。

**間距刻度不一致**：`gap-*` 有 `gap-1.5` `gap-2.5` `gap-3.5`（半階），
但 `p-*` 也有半階、`py-*` 多了 `py-0.5`；`m-*` 則幾乎不用。
`gap-7` / `gap-9` 出現但 `p-*` 沒有對應的 `p-7`/`p-9` 組合習慣。

### 7.3 brick 主題色使用

`js/core/tailwind-config.js` 定義的自訂色票：

```
brick: { DEFAULT: '#C84B31', dark: '#A53B24', light: '#FDF4F2' }
```

| 頁面 | 使用數 | 類別 |
|------|-------:|------|
| `index.html` | 10 | `bg-brick` `bg-brick-light` `bg-brick-light/80` `border-brick` `focus:border-brick` `hover:bg-brick-dark` `hover:text-brick` `active:bg-brick-dark` `text-brick` `selection:text-brick` |
| `order_accept.html` | 8 | `bg-brick` `bg-brick-light` `bg-brick-light/70` `hover:bg-brick-dark` `hover:border-brick` `hover:text-brick` `selection:text-brick` `text-brick` |
| `user_order_track.html` | 7 | `bg-brick` `bg-brick-light` `bg-brick-light/70` `hover:bg-brick-dark` `hover:text-brick` `selection:text-brick` `text-brick` |
| `controller.html` | 8 | `bg-brick` `bg-brick-light` `border-brick` `focus:ring-brick/30` `hover:bg-brick-dark` `hover:text-brick` `selection:text-brick` `text-brick` |

**觀察**：主題色使用非常一致（每頁都有 `bg-brick` / `bg-brick-light` / `text-brick` /
`hover:bg-brick-dark` / `selection:text-brick`），但 **`bg-brick-light` 有 `/70` 與 `/80`
兩種透明度並存**（order_accept 與 user_track 用 `/70`，index 用 `/80`）。
建議統一為 `bg-brick-light` 或單一透明度值。

---

## 8. 重複的多 class 組合（元件化候選）

長度 ≥ 60 字元且重複出現 ≥ 2 次的 class 組合，共 **35 組**。前 10 名：

| 次數 | 出現頁 | 組合 |
|-----:|-------|------|
| 4 | 全部 4 頁 | `text-stone-800 antialiased min-h-screen flex flex-col justify-between selection:bg-red-100 selection:text-brick` |
| 4 | 全部 4 頁 | `w-full bg-white/95 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-30 shadow-xs` |
| 4 | 全部 4 頁 | `flex items-center gap-2.5 cursor-pointer select-none shrink-0` |
| 4 | 全部 4 頁 | `w-11 h-11 md:w-12 md:h-12 rounded-2xl object-contain shrink-0` |
| 4 | 全部 4 頁 | `text-xl font-black tracking-tight text-brick leading-none block` |
| 4 | 全部 4 頁 | `text-xs text-stone-500 font-bold tracking-wider block mt-0.5` |
| 4 | 全部 4 頁 | `flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1` |
| 3 | index / order_accept / user_track | `flex-1 max-w-xl md:max-w-4xl lg:max-w-5xl w-full mx-auto px-4 md:px-6 py-5 md:py-8 flex flex-col justify-center` |
| 3 | index / order_accept | `fixed inset-0 bg-stone-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 hidden` |
| 3 | controller / order_accept / user_track | `max-w-xl md:max-w-4xl lg:max-w-5xl mx-auto px-4 md:px-6 min-h-16 md:min-h-20 py-2.5 md:py-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-2` |

### 8.1 建議抽出為元件類別

**四頁完全相同**的 class 序列（7 組）構成明確的元件：

| 建議元件名 | 來源組合 | 建議放置 |
|-----------|---------|---------|
| `.app-shell` | `text-stone-800 antialiased min-h-screen flex flex-col justify-between` | `css/base.css` |
| `.app-header` | `w-full bg-white/95 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-30` | `css/base.css` |
| `.app-navlink` | `flex items-center gap-2.5 cursor-pointer select-none shrink-0` | `css/base.css` |
| `.app-brand` | `text-xl font-black tracking-tight text-brick leading-none` | `css/base.css` |
| `.app-subtitle` | `text-xs text-stone-500 font-bold tracking-wider` | `css/base.css` |
| `.app-icon` | `w-11 h-11 md:w-12 md:h-12 rounded-2xl object-contain shrink-0` | `css/base.css` |
| `.app-chiprow` | `flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1` | `css/base.css` |

**三頁共有**的 class 前綴（2 組）也可抽出：

| 建議元件名 | 來源組合 | 建議放置 |
|-----------|---------|---------|
| `.app-container` | `max-w-xl md:max-w-4xl lg:max-w-5xl mx-auto px-4 md:px-6` | `css/base.css` |
| `.app-modal` | `fixed inset-0 bg-stone-950/60 z-50 flex items-center justify-center p-4` | `css/base.css` |

> **⚠ 兩點前提**：
> 1. **必須先修正 §3 的失效 class** —— `.app-header` 原本的組合含 `shadow-xs`（無效），
>    `.app-modal` 含 `backdrop-blur-xs`（無效）。若不先修正，會把「無效樣式」固化進元件。
> 2. **Play CDN 不支援 `@apply`**（`@apply` 是 Tailwind CLI 建置期功能），
>    這些元件類別必須寫成**原生 CSS 屬性**，或維持 Tailwind 工具類別不抽出。
>    例如 `.app-header` 若要原生化，需手寫 `position: sticky; top: 0; z-index: 30; …`。

### 8.2 最長 class 屬性值

| 頁面 | 長度 | 內容（節錄） |
|------|-----:|------------|
| `index.html` | 215 | `flex-1 md:max-w-sm bg-brick hover:bg-brick-dark text-white font-bold py-3.5 px-4 rounded-2xl …` |
| `order_accept.html` | 213 | `w-full bg-brick hover:bg-brick-dark active:scale-[0.98] text-white font-black py-4 md:py-4.5 px-6 rounded-full …` |
| `user_order_track.html` | 197 | `w-full sm:w-64 bg-brick hover:bg-brick-dark active:scale-[0.98] text-white font-black py-3.5 px-6 rounded-2xl …` |
| `controller.html` | 184 | `flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center ga…` |

> 最長已達 **215 字元**，超出多數 linter 的預設單行上限。
> 這是「抽出元件類別」最直接的可讀性收益。

---

## 9. 維護建議（依優先序）

| 優先 | 事項 | 影響 | 狀態 |
|------|------|------|------|
| **P1** | 修正 7 個無效 class（`shadow-xs` × 12、`shadow-2xs` × 2、`backdrop-blur-xs` × 6、`md:py-4.5`、`sm:left-13`、`sm:right-13`） | 恢復原本設計的陰影 / 模糊 / 間距 | **待決** |
| **P1** | 移除 3 個無作用的 `group` class | 減少無效碼 | **待決** |
| **P1** | 移除 `user_order_track.html` 3 個進度按鈕的 `focus:outline-none` | a11y：鍵盤操作恢復可見 focus 圈 | **待決** |
| **P2** | 統一 `bg-brick-light/70` 與 `/80`、`bg-white/50` 與 `/60` 等近似透明度 | 視覺一致性 | **待決** |
| **P3** | 把 4 頁完全相同的 7 組 class 抽出為 `css/base.css` 元件類別 | 降低 class 長度、簡化維護 | **待決** |
| **P3** | 評估改用 Tailwind CLI 建置（取代 Play CDN） | 消除 runtime 產檔的 FOUC 與無效 class 靜默失效 | 需另行評估 |

> P1–P3 皆屬**功能性變更**，會改變實際外觀，未經確認不擅自套用。
> 套用後應重跑 `node tests/class-audit.mjs` 與 `node tests/smoke.mjs` 驗證。
>
> **P1 修正後的預期效果**：`shadow-xs → shadow-sm` 等 6 處替代已實測確認會產出 CSS；
> 視覺上會多出設計稿本來就有的陰影與模糊，**與重構前的 `git HEAD` 版本不再像素一致** ——
> 這是「修正原本就沒生效的樣式」，不是退化。

---

## 10. 附錄：重跑稽核

```bash
# 完整稽核（需本機有 Google Chrome）
node tests/class-audit.mjs

# 僅靜態分析（不啟動瀏覽器，秒回）
node tests/class-audit.mjs --no-browser

# 輸出 JSON（供其他工具使用）
node tests/class-audit.mjs --json
```

**環境需求**：`/usr/bin/google-chrome`、Node.js 18+（需 `fetch` 與 `WebSocket` 全域）。
稽核工具零外部相依，與 `tests/smoke.mjs` 一致。

---

## 11. 交叉引用

| 主題 | 文件 |
|------|------|
| 重構設計、驗收標準 A1–A13 | [PLAN.md](./PLAN.md) |
| 執行任務 T0–T12 | [TASK.md](./TASK.md) |
| 樣式分層（base / pages） | [PLAN.md §4](./PLAN.md) |
| 主題色定義 | `js/core/tailwind-config.js` |
| 共用樣式 | `css/base.css` |
| 頁面專屬樣式 | `css/pages/*.css` |
