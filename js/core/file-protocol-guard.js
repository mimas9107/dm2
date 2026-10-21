/* ==========================================================================
   來電送 CALL & DELIVER — file:// 開啟守衛
   --------------------------------------------------------------------------
   ⚠️ 必須以「傳統 script」載入，不可改成 type="module"。
      module 會被 defer 到 DOM 解析完畢後才執行，屆時頁面已開始以
      無樣式/半殘狀態渲染，會造成畫面閃爍。使用傳統 script 可在
      解析早期就判斷協定並提前攔截。

   背景：本專案前端拆分為原生 ES Modules，而瀏覽器基於安全規範會以
   CORS 阻擋 file:// 協定的模組載入。若使用者直接雙擊開啟 HTML，
   模組不會執行，畫面會呈現無功能的半成品且沒有任何錯誤訊息。
   本守衛的目標是讓這個情況「明確失敗」而不是「無聲失敗」。
   ========================================================================== */

(function () {
  'use strict';

  // 僅在 file:// 協定下啟用；http:// 與其他協定完全不動作
  if (window.location.protocol !== 'file:') return;

  function showGuidance() {
    var body = document.body;
    if (!body) return;

    body.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.setAttribute('style', [
      'min-height:100vh',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:24px',
      'background:#F8F6F4',
      'color:#1C1917',
      "font-family:'Noto Sans TC',system-ui,sans-serif"
    ].join(';'));

    var card = document.createElement('div');
    card.setAttribute('style', [
      'max-width:560px',
      'width:100%',
      'background:#fff',
      'border:1px solid #E7E5E4',
      'border-radius:20px',
      'padding:28px',
      'box-shadow:0 10px 30px rgba(0,0,0,.06)'
    ].join(';'));

    var icon = document.createElement('div');
    icon.setAttribute('style', 'font-size:40px;line-height:1;margin-bottom:12px');
    icon.textContent = '⚠️';

    var title = document.createElement('h1');
    title.setAttribute('style', 'margin:0 0 10px;font-size:20px;font-weight:900');
    title.textContent = '請勿直接雙擊開啟 HTML';

    var desc = document.createElement('p');
    desc.setAttribute('style', 'margin:0 0 18px;font-size:14px;line-height:1.8;color:#57534E');
    desc.textContent = '本專案前端已拆分為原生 ES Modules，瀏覽器基於安全規範會以 CORS 阻擋 file:// 協定的模組載入，' +
      '因此直接開啟檔案會無法運作。請改用本地伺服器啟動。';

    var cmd = document.createElement('pre');
    cmd.setAttribute('style', [
      'margin:0 0 18px',
      'padding:14px 16px',
      'background:#1C1917',
      'color:#FAFAF9',
      'border-radius:12px',
      'font-size:13px',
      "font-family:ui-monospace,SFMono-Regular,Menlo,monospace",
      'overflow-x:auto'
    ].join(';'));
    cmd.textContent = 'cd ' + '專案目錄' + '\n./serve.sh';

    var note = document.createElement('p');
    note.setAttribute('style', 'margin:0;font-size:12px;line-height:1.7;color:#A8A29E');
    note.textContent = '若環境沒有 python3，可改用：npx serve . 或 php -S localhost:8080';

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(cmd);
    card.appendChild(note);
    wrap.appendChild(card);
    body.appendChild(wrap);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showGuidance);
  } else {
    showGuidance();
  }
})();
