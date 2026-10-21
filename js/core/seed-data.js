/* ==========================================================================
   種子資料 — 全站唯一資料來源
   --------------------------------------------------------------------------
   原本這份資料被複製在 4 個 HTML 的 inline script 中（共約 480 行），
   且已產生分歧（各頁的 loadSharedState() 驗證條件不同，會導致資料遺失）。
   現集中於本檔，任何資料異動只需修改這裡一次。

   注意：本檔僅提供「初始值」。執行期的資料一律存於 localStorage，
         由 js/core/store.js 負責讀寫。
   ========================================================================== */

/* --------------------------------------------------------------------------
   店家目錄（首頁輪播與店家詳情使用）
   id 與後台 stores[].id 一致，後台設定會覆蓋本目錄的同名欄位。
   -------------------------------------------------------------------------- */
export const restaurants = [
  {
    id: 1,
    name: "禾風堂手作便當",
    tag: "人氣招牌",
    address: "台北市信義區忠孝東路五段 68 號 B2",
    heroImg: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1000&q=80",
    phone: "02-2398-1122",
    hours: "10:30 - 13:30",
    rating: "4.9",
    deliverTime: "20-30 分",
    minQty: 3,
    minQtyText: "滿 3 份送",
    active: true,
    soundEnabled: true,
    desc: "現炸酥脆厚切黑豬排，搭配當季三色蔬菜。",
    dish: "秘傳酥炸排骨便當",
    price: "NT$ 120 起",
    menu: [
      { id: 101, name: "秘傳酥炸排骨便當", price: 120, desc: "溫體黑豬厚切排骨，獨家漢方醃漬。", img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80" },
      { id: 102, name: "蜜汁香烤大雞腿飯", price: 135, desc: "慢火烘烤蜜汁封頂，外酥肉嫩。", img: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=400&q=80" },
      { id: 103, name: "古法滷香厚切爌肉飯", price: 115, desc: "肥瘦適中三層肉，慢燉入味。", img: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=400&q=80" }
    ]
  },
  {
    id: 2,
    name: "築地漁火日式定食",
    tag: "主廚特製",
    address: "台北市大安區敦化南路一段 161 巷 12 號",
    heroImg: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1000&q=80",
    phone: "02-2771-3344",
    hours: "11:00 - 14:00",
    rating: "4.8",
    deliverTime: "25-35 分",
    minQty: 2,
    minQtyText: "滿 2 份送",
    active: true,
    soundEnabled: true,
    desc: "炙燒生食級鮭魚腹，搭配手作玉子燒。",
    dish: "極上炙燒鮭魚丼",
    price: "NT$ 180 起",
    menu: [
      { id: 201, name: "極上炙燒鮭魚腹丼", price: 180, desc: "微炙挪威鮭魚，佐特調和風醬油。", img: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=400&q=80" },
      { id: 202, name: "和風醬烤鯖魚定食", price: 160, desc: "油脂豐富肉質細嫩，附味噌湯。", img: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?auto=format&fit=crop&w=400&q=80" },
      { id: 203, name: "日式親子丼定食", price: 140, desc: "鮮嫩雞腿肉配半熟蛋液，香甜暖胃。", img: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80" }
    ]
  },
  {
    id: 3,
    name: "青嵐健康水煮餐",
    tag: "輕盈低卡",
    address: "台北市松山區民生東路三段 130 巷 8 號",
    heroImg: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1000&q=80",
    phone: "02-8765-4321",
    hours: "10:30 - 13:00",
    rating: "4.7",
    deliverTime: "15-25 分",
    minQty: 2,
    minQtyText: "滿 2 份送",
    active: true,
    soundEnabled: false,
    desc: "低溫舒肥黑椒嫩雞胸，佐紫米藜麥時蔬。",
    dish: "香草舒肥雞胸餐",
    price: "NT$ 130 起",
    menu: [
      { id: 301, name: "義式香草舒肥雞胸餐", price: 130, desc: "低溫舒肥嫩雞胸，配紫米藜麥。", img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80" },
      { id: 302, name: "水煮嫩煎板腱牛便當", price: 165, desc: "天然海鹽提味，豐富優質蛋白質。", img: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80" },
      { id: 303, name: "雙倍時蔬高纖水煮餐", price: 110, desc: "無肉蔬食首選，五彩時蔬搭烤地瓜。", img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80" }
    ]
  },
  {
    id: 4,
    name: "炙焰炭烤燒肉丼",
    tag: "炭香濃郁",
    address: "台北市中山區南京東路二段 88 號",
    heroImg: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1000&q=80",
    phone: "02-2541-6677",
    hours: "11:00 - 14:00",
    rating: "4.8",
    deliverTime: "20-30 分",
    minQty: 2,
    minQtyText: "滿 2 份送",
    active: true,
    soundEnabled: true,
    desc: "特選安格斯牛五花搭配直火炙烤醬汁，焦香四溢。",
    dish: "炭香特選牛五花丼",
    price: "NT$ 160 起",
    menu: [
      { id: 401, name: "炭香特選牛五花丼", price: 160, desc: "精選牛五花直火逼出油脂，香氣四溢。", img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=400&q=80" },
      { id: 402, name: "醬烤松阪豬肉定食", price: 175, desc: "黃金六兩松阪豬，爽脆多汁不膩口。", img: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80" },
      { id: 403, name: "炭火蒲燒鰻魚便當", price: 220, desc: "經典關東蒲燒工法，醬香濃郁厚實。", img: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=400&q=80" }
    ]
  },
  {
    id: 5,
    name: "越味南洋料理坊",
    tag: "清爽開胃",
    address: "台北市內湖區瑞光路 258 號 1 樓",
    heroImg: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=1000&q=80",
    phone: "02-8797-1234",
    hours: "11:00 - 13:30",
    rating: "4.7",
    deliverTime: "25-35 分",
    minQty: 3,
    minQtyText: "滿 3 份送",
    active: true,
    soundEnabled: true,
    desc: "慢燉牛骨高湯搭配新鮮九層塔與香檸，清爽無負擔。",
    dish: "越式鮮牛肉河粉套餐",
    price: "NT$ 140 起",
    menu: [
      { id: 501, name: "越式鮮牛肉河粉套餐", price: 150, desc: "生牛肉澆淋滾燙高湯，附新鮮檸檬角。", img: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=400&q=80" },
      { id: 502, name: "香茅嫩煎雞腿飯", price: 135, desc: "南洋香茅醃漬入味，皮脆多汁。", img: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=400&q=80" },
      { id: 503, name: "鮮蝦生春捲特餐", price: 140, desc: "薄透米紙包裹鮮蝦鮮蔬，佐酸甜魚露。", img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80" }
    ]
  },
  {
    id: 6,
    name: "慢燉老火煲仔飯",
    tag: "經典港式",
    address: "台北市中正區重慶南路一段 45 號",
    heroImg: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1000&q=80",
    phone: "02-2388-5566",
    hours: "10:30 - 13:30",
    rating: "4.9",
    deliverTime: "20-30 分",
    minQty: 2,
    minQtyText: "滿 2 份送",
    active: true,
    soundEnabled: true,
    desc: "傳承古法砂鍋慢燉，焦脆鍋巴淋上特調甜豉油。",
    dish: "正宗廣式臘味煲仔飯",
    price: "NT$ 150 起",
    menu: [
      { id: 601, name: "正宗廣式臘味煲仔飯", price: 150, desc: "特級臘腸肝腸香氣四溢，焦香鍋巴。", img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80" },
      { id: 602, name: "豆豉排骨滑雞煲仔飯", price: 155, desc: "排骨嫩滑豉汁回甘，米粒吸飽精華。", img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80" },
      { id: 603, name: "蜜汁叉燒雙拼便當", price: 135, desc: "厚切焦糖蜜汁叉燒，經典港式風味。", img: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=400&q=80" }
    ]
  },
  {
    id: 7,
    name: "蔬心綠田植化素餐盒",
    tag: "全植蔬食",
    address: "台北市信義區仁愛路四段 502 號",
    heroImg: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1000&q=80",
    phone: "02-2720-9988",
    hours: "11:00 - 14:00",
    rating: "4.8",
    deliverTime: "15-25 分",
    minQty: 2,
    minQtyText: "滿 2 份送",
    active: true,
    soundEnabled: false,
    desc: "產地直送有機時蔬搭配非基改鹽滷豆腐與紅藜麥飯。",
    dish: "彩虹植化素元氣餐盒",
    price: "NT$ 135 起",
    menu: [
      { id: 701, name: "彩虹植化素元氣餐盒", price: 135, desc: "五色當令時蔬，低溫烘烤鎖住原味。", img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80" },
      { id: 702, name: "鹽滷豆腐照燒鮮菇飯", price: 125, desc: "非基改手工鹽滷豆腐，甘甜照燒醬汁。", img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80" },
      { id: 703, name: "香煎未來植物肉排便當", price: 160, desc: "高蛋白質植物蛋白排，肉感紮實。", img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80" }
    ]
  }
];

/* --------------------------------------------------------------------------
   後台店家設定（主控台可調整：接單權限、音效、營業時間、起送門檻）
   -------------------------------------------------------------------------- */
export const stores = [
  { id: 1, name: "禾風堂手作便當", soundAlert: "叮咚和弦", soundEnabled: true, hours: "10:30 - 13:30", minOrder: "滿 3 份送", minQty: 3, active: true },
  { id: 2, name: "築地漁火日式定食", soundAlert: "叮咚和弦", soundEnabled: true, hours: "11:00 - 14:00", minOrder: "滿 2 份送", minQty: 2, active: true },
  { id: 3, name: "青嵐健康水煮餐", soundAlert: "靜音提示", soundEnabled: false, hours: "10:30 - 13:00", minOrder: "滿 2 份送", minQty: 2, active: true },
  { id: 4, name: "炙焰炭烤燒肉丼", soundAlert: "叮咚和弦", soundEnabled: true, hours: "11:00 - 14:00", minOrder: "滿 2 份送", minQty: 2, active: true },
  { id: 5, name: "越味南洋料理坊", soundAlert: "叮咚和弦", soundEnabled: true, hours: "11:00 - 13:30", minOrder: "滿 3 份送", minQty: 3, active: true },
  { id: 6, name: "慢燉老火煲仔飯", soundAlert: "叮咚和弦", soundEnabled: true, hours: "10:30 - 13:30", minOrder: "滿 2 份送", minQty: 2, active: true },
  { id: 7, name: "蔬心綠田植化素餐盒", soundAlert: "靜音提示", soundEnabled: false, hours: "11:00 - 14:00", minOrder: "滿 2 份送", minQty: 2, active: true }
];

/* --------------------------------------------------------------------------
   顧客
   -------------------------------------------------------------------------- */
export const customers = [
  { id: 1, name: "王小明", tel: "0912-345-678", orders: ["#101", "#102", "#103"], abandonedCount: 0, blacklisted: false },
  { id: 2, name: "林雅婷", tel: "0928-666-888", orders: ["#102"], abandonedCount: 0, blacklisted: false },
  { id: 3, name: "陳建宏", tel: "0933-111-222", orders: ["#103"], abandonedCount: 1, blacklisted: false },
  { id: 4, name: "張志豪", tel: "0955-999-000", orders: ["#089", "#094"], abandonedCount: 3, blacklisted: true }
];

/* --------------------------------------------------------------------------
   訂單
   step: 0 = 待店家接單 / 1 = 已製作完成 / 2 = 已送達
   -------------------------------------------------------------------------- */
export const orders = [
  {
    orderId: "#101",
    storeId: 1,
    storeName: "禾風堂手作便當",
    deliverBy: "12:15",
    address: "台北市信義區松高路 11 號 5 樓",
    customerName: "王小明",
    customerPhone: "0912-345-678",
    accepted: false,
    step: 0,
    items: [
      { name: "秘傳酥炸排骨便當", qty: 2, price: 120 },
      { name: "蜜汁香烤大雞腿飯", qty: 1, price: 135 }
    ]
  },
  {
    orderId: "#102",
    storeId: 2,
    storeName: "築地漁火日式定食",
    deliverBy: "12:30",
    address: "台北市大安區敦化南路一段 188 號 10 樓",
    customerName: "林雅婷",
    customerPhone: "0928-666-888",
    accepted: true,
    step: 1,
    items: [
      { name: "極上炙燒鮭魚腹丼", qty: 2, price: 180 },
      { name: "和風醬烤鯖魚定食", qty: 2, price: 160 }
    ]
  },
  {
    orderId: "#103",
    storeId: 3,
    storeName: "青嵐健康水煮餐",
    deliverBy: "12:00",
    address: "台北市松山區民生東路三段 128 號 3 樓",
    customerName: "陳建宏",
    customerPhone: "0933-111-222",
    accepted: true,
    step: 2,
    items: [
      { name: "義式香草舒肥雞胸餐", qty: 3, price: 130 },
      { name: "水煮嫩煎板腱牛便當", qty: 1, price: 165 }
    ]
  }
];

/* --------------------------------------------------------------------------
   後台編輯內容（平台條款 / 使用介紹 / 常用問答）
   -------------------------------------------------------------------------- */
export const cmsDocs = [
  {
    key: "terms",
    shortLabel: "條款",
    fullTitle: "服務條款",
    updatedAt: "2026/10/21 16:30",
    content: "1. 訂單確認規範：顧客透過「來電送」送出訂單並經電話確認後，店家即刻開始備餐，恕不接受臨時改單或無故棄單。\n2. 棄單黑名單機制：若顧客累計無故棄單或拒收達 2 次（含）以上，系統管理員有權將該電話號碼列為黑名單並取消其訂餐權限。\n3. 準時專送承諾：合作店家均享免外送費門檻優惠，並於指定午餐時段準時送達。"
  },
  {
    key: "intro",
    shortLabel: "使用介紹",
    fullTitle: "使用介紹",
    updatedAt: "2026/10/21 16:40",
    content: "歡迎使用「來電送 CALL & DELIVER」午間專送平台：\n步驟 1：於首頁輪播瀏覽今日熱門便當與定食推薦。\n步驟 2：進入店家菜單頁選購餐點（達最低外送份數即享免外送費）。\n步驟 3：點擊「確認來電訂餐」完成撥號確認。\n步驟 4：於「訂單即時配送進度」頁面隨時查看【店家接單 → 已製作完成 → 已送達】三階段狀態。"
  },
  {
    key: "faq",
    shortLabel: "常用問答",
    fullTitle: "常用問答 (FAQ)",
    updatedAt: "2026/10/21 16:45",
    content: "Q1：請問外送需要運費嗎？\nA1：只要湊滿該店家指定的最低外送份數（例如滿 2 份或 3 份），全面享免外送費！\n\nQ2：為什麼我的帳號無法下單？\nA2：若曾有多次未接電話或棄單紀錄，帳號將被系統列入黑名單停權；如需申訴復權請向管理員反映。\n\nQ3：可以同時訂購不同店家的餐點嗎？\nA3：可以！您可以在訂單追蹤頁面透過上方單號（如 #101、#102）切換查看每張訂單的獨立配送進度。"
  }
];

/* --------------------------------------------------------------------------
   產生一份全新的預設狀態（深拷貝，避免呼叫端互相污染種子資料）
   -------------------------------------------------------------------------- */
function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function createDefaultState() {
  return {
    version: 2,
    activeOrderId: "#101",
    stores: clone(stores),
    customers: clone(customers),
    orders: clone(orders),
    cmsDocs: clone(cmsDocs)
  };
}
