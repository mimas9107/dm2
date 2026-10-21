#!/usr/bin/env bash
# 來電送 CALL & DELIVER — 本地開發伺服器
#
# 為什麼需要這個？本專案前端已拆分為原生 ES Modules，
# 而瀏覽器基於安全規範會以 CORS 阻擋 file:// 協定的模組載入，
# 因此「雙擊開啟 HTML」無法運作，必須透過 http:// 提供頁面。
#
# 用法： ./serve.sh [port]   (預設 8080)

set -euo pipefail

PORT="${1:-8080}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v python3 >/dev/null 2>&1; then
  echo "✗ 找不到 python3。請安裝 Python 3，或改用其他靜態伺服器，例如："
  echo "    npx serve ."
  echo "    php -S localhost:${PORT}"
  exit 1
fi

echo "──────────────────────────────────────────────"
echo "  來電送 CALL & DELIVER — 本地開發伺服器"
echo "──────────────────────────────────────────────"
echo "  根目錄 : ${ROOT_DIR}"
echo "  網址    : http://localhost:${PORT}/"
echo ""
echo "  頁面："
echo "    http://localhost:${PORT}/index.html               顧客首頁"
echo "    http://localhost:${PORT}/order_accept.html        店家接單"
echo "    http://localhost:${PORT}/user_order_track.html    顧客訂單追蹤"
echo "    http://localhost:${PORT}/controller.html           主控台"
echo ""
echo "  依 Ctrl+C 停止伺服器。"
echo "──────────────────────────────────────────────"

exec python3 -m http.server "${PORT}" --directory "${ROOT_DIR}" --bind 127.0.0.1
