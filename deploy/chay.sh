#!/usr/bin/env bash
#
# ============================================================================
#  BỘ KHỞI ĐỘNG CHO PM2
#  Dùng:  bash deploy/chay.sh api|worker|web|admin
# ============================================================================
#
#  TẠI SAO PHẢI CÓ FILE NÀY thay vì cho PM2 gọi thẳng node?
#
#  1. PM2 trên VPS đang chạy bằng Node 20 (8 app khác dùng nó). Dự án cần
#     Node 24. File này tự đặt PATH trỏ vào /opt/node24 nên 4 app của mình
#     chạy Node 24, còn 8 app kia không bị ảnh hưởng gì.
#
#  2. PM2 không có cơ chế nạp file .env. File này tự "source" .env, nên dù
#     NestJS hay Next.js nạp biến môi trường theo cách nào thì biến cũng đã
#     nằm sẵn trong môi trường tiến trình.
#
#  3. Dùng "exec": bash bị THAY THẾ bởi node, giữ nguyên PID. Nhờ vậy PM2
#     đo đúng RAM của node (max_memory_restart) và tín hiệu dừng
#     (SIGINT/SIGTERM) đến thẳng node, không bị bash ăn mất.
# ============================================================================

set -euo pipefail

GOC="/var/www/khoathongminhchinhhang.vn"
UNG_DUNG="$GOC/app"

export PATH="/opt/node24/bin:$PATH"

if [[ ! -f "$UNG_DUNG/.env" ]]; then
    echo "Không thấy $UNG_DUNG/.env — chạy deploy/01-chuan-bi-vps.sh trước" >&2
    exit 1
fi

# set -a: mọi biến gán sau đây tự động được export ra môi trường con
set -a
# shellcheck disable=SC1091
. "$UNG_DUNG/.env"
set +a

# ---------------------------------------------------------------------------
# Giới hạn heap của V8.
#
# GHI ĐÈ hẳn NODE_OPTIONS chứ không nối thêm: PM2 chạy với --update-env sẽ
# truyền NODE_OPTIONS=--max-old-space-size=2048 của lúc build sang, nối thêm
# vào là thành hai cờ chồng nhau, khó lần.
#
# Đặt ngưỡng heap THẤP HƠN max_memory_restart trong ecosystem.config.cjs
# (420 < 500, 320 < 400, 560 < 650). Mục đích: khi gần đầy thì V8 dọn rác,
# chứ không để PM2 giết rồi bật lại app — người đang xem sẽ bị đứt giữa trang.
# ---------------------------------------------------------------------------
dat_heap() { export NODE_OPTIONS="--max-old-space-size=$1"; }

# ---------------------------------------------------------------------------
# Tìm file khởi động đã biên dịch.
# Mỗi khung (NestJS, tsc, tsup...) đặt file ra chỗ khác nhau, nên thử lần lượt
# thay vì đoán cứng một đường dẫn rồi chết lúc deploy.
# ---------------------------------------------------------------------------
chay_node() {
    local thu_muc="$1"; shift
    cd "$thu_muc"
    for ung_vien in "$@"; do
        if [[ -f $ung_vien ]]; then
            exec node "$ung_vien"
        fi
    done
    {
        echo "Không tìm thấy file khởi động trong $thu_muc"
        echo "Đã thử: $*"
        echo "Kiểm tra lại bước build (pnpm --filter ... build)"
    } >&2
    exit 1
}

# Next.js: ưu tiên bin trong chính package, sau đó bin ở gốc monorepo
chay_next() {
    local thu_muc="$1" cong="$2"
    cd "$thu_muc"
    for ung_vien in ./node_modules/.bin/next "$UNG_DUNG/node_modules/.bin/next"; do
        if [[ -x $ung_vien ]]; then
            # -H 127.0.0.1: chỉ nghe nội bộ, chỉ nginx gọi được, không hở ra internet
            exec "$ung_vien" start -p "$cong" -H 127.0.0.1
        fi
    done
    echo "Không thấy lệnh next trong $thu_muc — chạy pnpm install lại" >&2
    exit 1
}

case "${1:-}" in
    api)
        dat_heap 420
        chay_node "$UNG_DUNG/apps/api" \
            dist/main.js dist/src/main.js dist/apps/api/src/main.js dist/apps/api/main.js
        ;;
    worker)
        dat_heap 320
        chay_node "$UNG_DUNG/apps/worker" \
            dist/main.js dist/index.js dist/src/main.js dist/src/index.js
        ;;
    web)
        dat_heap 560
        chay_next "$UNG_DUNG/apps/web" "${WEB_PORT:-3100}"
        ;;
    admin)
        dat_heap 560
        chay_next "$UNG_DUNG/apps/admin" "${ADMIN_PORT:-3101}"
        ;;
    *)
        echo "Dùng: bash deploy/chay.sh api|worker|web|admin" >&2
        exit 1
        ;;
esac
