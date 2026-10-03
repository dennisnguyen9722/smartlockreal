#!/usr/bin/env bash
#
# ============================================================================
#  BƯỚC 4 — CÀI THƯ VIỆN, BUILD, CHẠY MIGRATION, BẬT 4 APP
# ============================================================================
#
#  Chạy được NHIỀU LẦN: lần đầu để lên sóng, các lần sau để cập nhật code mới.
#
#  Cách chạy:
#     cd /var/www/khoathongminhchinhhang.vn/app
#     sudo bash deploy/02-trien-khai.sh
#
#  Bỏ qua git pull (khi đưa code lên bằng rsync):
#     sudo KHONG_PULL=1 bash deploy/02-trien-khai.sh
#
#  THỨ TỰ CÓ CHỦ Ý, đừng đổi:
#     build api  ->  migration  ->  BẬT api  ->  build web/admin  ->  bật web/admin
#
#  Lý do: trang sản phẩm / bài viết / chính sách dùng generateStaticParams và
#  fetch sang API ngay LÚC BUILD. API chưa chạy thì build web sẽ lỗi hoặc ra
#  trang rỗng. Đây đúng là lỗi "fetch failed / ECONNREFUSED" đã gặp lúc chạy máy nhà.
#
#  Build hai app Next.js LẦN LƯỢT, không song song: mỗi lần build ngốn
#  1,5–2,5 GB RAM, mà máy còn 8 app khác đang chạy.
# ============================================================================

set -euo pipefail

GOC="/var/www/khoathongminhchinhhang.vn"
UNG_DUNG="$GOC/app"
FILE_ENV="$UNG_DUNG/.env"

buoc() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
xong() { printf '    \033[32m✓\033[0m %s\n' "$*"; }
bo()   { printf '    \033[33m•\033[0m %s\n' "$*"; }
loi()  { printf '    \033[31m✗ %s\033[0m\n' "$*" >&2; }

if [[ $EUID -ne 0 ]]; then
    loi "Phải chạy bằng root"
    exit 1
fi
if [[ ! -f $FILE_ENV ]]; then
    loi "Chưa có $FILE_ENV — chạy deploy/01-chuan-bi-vps.sh trước"
    exit 1
fi

# ---------------------------------------------------------------------------
# PM2 phải gọi bằng NODE CŨ (v20) — chính là Node đang chạy daemon pm2 với
# 8 app kia. Nếu gọi pm2 bằng Node 24 thì CLI và daemon lệch phiên bản, dễ
# sinh lỗi khó hiểu. Nên giữ lại PATH gốc TRƯỚC khi thêm /opt/node24.
# ---------------------------------------------------------------------------
PATH_GOC="$PATH"
pm2x() { ( PATH="$PATH_GOC"; pm2 "$@" ); }

if ! ( PATH="$PATH_GOC"; command -v pm2 >/dev/null ); then
    loi "Không tìm thấy pm2"
    exit 1
fi

export PATH="/opt/node24/bin:$PATH"
cd "$UNG_DUNG"

buoc "Môi trường"
xong "node  $(node -v)      (node toàn cục của VPS: $( (PATH="$PATH_GOC"; node -v) 2>/dev/null || echo '?' ))"
xong "pnpm  $(pnpm -v)"
xong "pm2   $(pm2x -v 2>/dev/null | tail -1)"

# ---------------------------------------------------------------------------
# 1. LẤY CODE MỚI
# ---------------------------------------------------------------------------
buoc "1/8  Mã nguồn"

if [[ ${KHONG_PULL:-0} == 1 ]]; then
    bo "KHONG_PULL=1 — dùng nguyên mã nguồn đang có trong thư mục"
elif [[ -d .git ]] && git remote get-url origin >/dev/null 2>&1; then
    # "git reset --hard" sẽ XOÁ mọi sửa đổi đang có trong thư mục. Nếu có ai
    # vá tay trực tiếp trên VPS thì dừng lại hỏi, chứ không âm thầm xoá công
    # sức của họ. Muốn bỏ qua: chạy với BO_QUA_SUA_TAY=1
    if [[ -n "$(git status --porcelain)" && ${BO_QUA_SUA_TAY:-0} != 1 ]]; then
        loi "Thư mục có sửa đổi chưa commit — git reset --hard sẽ xoá mất:"
        git status --short | sed 's/^/      /' >&2
        loi "Lưu lại (git stash / git diff > ban-va.patch) rồi chạy lại,"
        loi "hoặc chạy:  sudo BO_QUA_SUA_TAY=1 bash deploy/02-trien-khai.sh"
        exit 1
    fi
    git fetch --prune origin
    nhanh="$(git rev-parse --abbrev-ref HEAD)"
    git reset --hard "origin/$nhanh"
    xong "Đã lấy $nhanh @ $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"
else
    bo "Không có remote git — dùng nguyên mã nguồn đang có"
fi

# Nhắc nếu .env thiếu biến mà code có dùng. Không chặn, chỉ cảnh báo:
# nhiều biến là tuỳ chọn, chặn cứng sẽ làm deploy đứng oan.
buoc "2/8  Soát biến môi trường"
thieu=""
for ten in $(grep -rhoE 'process\.env\.[A-Z0-9_]+' apps packages \
                --include='*.ts' --include='*.tsx' --include='*.mjs' 2>/dev/null \
             | sed 's/process\.env\.//' | sort -u); do
    case "$ten" in
        NODE_ENV|PATH|PORT|HOME|CI|TZ|npm_*|TURBO_*|VERCEL*|ANALYZE|DEV_ORIGINS) continue ;;
    esac
    if ! grep -qE "^${ten}=" "$FILE_ENV"; then
        thieu="$thieu $ten"
    fi
done
if [[ -n $thieu ]]; then
    bo "Code có dùng, mà .env chưa khai (phần lớn là tuỳ chọn, kiểm tra cho chắc):"
    for t in $thieu; do printf '      - %s\n' "$t"; done
else
    xong "Không thiếu biến nào"
fi

# ---------------------------------------------------------------------------
# 3. THƯ VIỆN
#
#  --prod=false là BẮT BUỘC: .env có NODE_ENV=production, mà pnpm thấy biến đó
#  sẽ bỏ qua devDependencies — nghĩa là không có typescript, không có next,
#  không build được gì. Đây là cái bẫy kinh điển khi deploy.
# ---------------------------------------------------------------------------
buoc "3/8  pnpm install"
NODE_ENV=development pnpm install --frozen-lockfile --prod=false
xong "Xong"

# ---------------------------------------------------------------------------
# 4. BUILD THEO ĐÚNG THỨ TỰ PHỤ THUỘC
#
#  @ktm/shared xuất bản dist/ (main: ./dist/index.js). Quên build nó là API
#  biên dịch lỗi hoặc chạy bằng kiểu cũ — đã mất thời gian vì chuyện này rồi.
# ---------------------------------------------------------------------------
buoc "4/8  Build thư viện dùng chung"
export NODE_OPTIONS="--max-old-space-size=2048"

pnpm --filter @ktm/database exec prisma generate
xong "prisma generate"

pnpm --filter @ktm/shared run build
xong "@ktm/shared"

pnpm --filter @ktm/ui run --if-present build
xong "@ktm/ui"

buoc "5/8  Build API và worker"
pnpm --filter @ktm/api run build
xong "@ktm/api"
pnpm --filter @ktm/worker run --if-present build
xong "@ktm/worker"

# ---------------------------------------------------------------------------
# 6. MIGRATION
#
#  "migrate deploy" chỉ áp các migration CHƯA chạy, không bao giờ xoá dữ liệu,
#  không bao giờ tự reset database. Khác hẳn "migrate dev" (tuyệt đối không
#  dùng trên máy thật).
# ---------------------------------------------------------------------------
buoc "6/8  Migration database"

if ls packages/database/prisma/migrations/*/migration.sql >/dev/null 2>&1; then
    can_ext="$(grep -rhoiE 'create +extension[^;]*' packages/database/prisma/migrations \
               2>/dev/null | sort -u || true)"
    if [[ -n $can_ext ]]; then
        bo "Migration có tạo extension (cần quyền superuser, 01-chuan-bi đã tạo sẵn pg_trgm/unaccent):"
        printf '      %s\n' "$can_ext"
    fi
fi

# shellcheck disable=SC1090
set -a; . "$FILE_ENV"; set +a
pnpm --filter @ktm/database exec prisma migrate deploy
xong "Database đã ở phiên bản mới nhất"

# ---------------------------------------------------------------------------
# 7. BẬT API + WORKER, ĐỢI API SỐNG, RỒI MỚI BUILD WEB/ADMIN
# ---------------------------------------------------------------------------
buoc "7/8  Bật API + worker"
pm2x startOrReload deploy/ecosystem.config.cjs --only ktm-api,ktm-worker --update-env

bo "Đợi API trả lời ở 127.0.0.1:${API_PORT}..."
song=0
for i in $(seq 1 40); do
    ma="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 \
          "http://127.0.0.1:${API_PORT}/api/v1/public/policies" || true)"
    # Bất kỳ mã HTTP nào (kể cả 404) cũng nghĩa là API đã lắng nghe
    if [[ -n $ma && $ma != 000 ]]; then
        song=1
        xong "API trả lời sau ${i}s (HTTP $ma)"
        break
    fi
    sleep 1
done
if [[ $song -eq 0 ]]; then
    loi "API không lên sau 40s. Xem log:"
    loi "   tail -n 80 $GOC/logs/api.loi.log"
    exit 1
fi

buoc "8/8  Build và bật web + admin (lần lượt, cho đỡ tốn RAM)"
pnpm --filter @ktm/web run build
xong "@ktm/web"
pnpm --filter @ktm/admin run build
xong "@ktm/admin"

pm2x startOrReload deploy/ecosystem.config.cjs --update-env

# pm2 save ghi lại TOÀN BỘ danh sách app đang chạy (4 app mình + 8 app kia)
# để sau khi VPS khởi động lại, pm2-root.service bật đủ cả 12. An toàn.
pm2x save

printf '\n\033[1;32m===== ĐÃ LÊN SÓNG =====\033[0m\n'
pm2x list
cat <<HD

Kiểm tra nhanh:
  curl -sI https://khoathongminhchinhhang.vn        | head -1
  curl -sI https://admin.khoathongminhchinhhang.vn  | head -1
  curl -s  https://api.khoathongminhchinhhang.vn/api/v1/public/policies | head -c 200

Xem log:
  pm2 logs ktm-api --lines 50
  tail -f $GOC/logs/web.loi.log

Cập nhật code lần sau: chỉ cần chạy lại đúng script này.
HD
