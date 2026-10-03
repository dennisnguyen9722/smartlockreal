#!/usr/bin/env bash
#
# ============================================================================
#  BƯỚC 1 — CHUẨN BỊ VPS CHO khoathongminhchinhhang.vn
# ============================================================================
#
#  NGUYÊN TẮC CỦA CẢ FILE NÀY: CHỈ THÊM, KHÔNG SỬA, KHÔNG XOÁ.
#
#  VPS này đang chạy 8 ứng dụng PM2 và 8 site nginx của các website khác.
#  Vì vậy script tuyệt đối KHÔNG:
#    - nâng cấp Node 20 toàn cục  (8 app kia đang chạy bằng nó)
#    - cài Docker                 (đã có PostgreSQL 18 sẵn, không cần)
#    - sửa /etc/nginx/nginx.conf hay bất kỳ file nào trong sites-available
#    - gọi pm2 kill / pm2 resurrect / pm2 delete
#    - khởi động lại mysql, postgresql, nginx (chỉ reload nginx ở bước 3)
#
#  Script chạy lại nhiều lần được (idempotent): cái nào đã có thì bỏ qua.
#
#  Cách chạy:   sudo bash deploy/01-chuan-bi-vps.sh
# ============================================================================

set -euo pipefail

GOC="/var/www/khoathongminhchinhhang.vn"
UNG_DUNG="$GOC/app"
FILE_ENV="$UNG_DUNG/.env"

CONG_PG=5433          # cụm PostgreSQL 18 có sẵn
TEN_DB="khoathongminh"
TEN_ROLE="ktm"

CONG_API=4100         # 4000 đã bị hhvn-api chiếm
CONG_WEB=3100
CONG_ADMIN=3101       # 3001 đã bị app khác chiếm

TEN_MIEN="khoathongminhchinhhang.vn"

# ---------------------------------------------------------------------------
# Hàm in cho dễ đọc
# ---------------------------------------------------------------------------
buoc()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
xong()  { printf '    \033[32m✓\033[0m %s\n' "$*"; }
bo()    { printf '    \033[33m•\033[0m %s\n' "$*"; }
loi()   { printf '    \033[31m✗ %s\033[0m\n' "$*" >&2; }

if [[ $EUID -ne 0 ]]; then
    loi "Phải chạy bằng root (sudo bash deploy/01-chuan-bi-vps.sh)"
    exit 1
fi

# ---------------------------------------------------------------------------
# 1. SWAP
#
#  Máy có 7,8 GB RAM, đã dùng 2,2 GB cho 8 app đang chạy, và KHÔNG CÓ SWAP.
#  "next build" của Next.js 16 ngốn 1,5–2,5 GB mỗi app. Không có swap thì khi
#  build, kernel OOM-killer sẽ bắn chết tiến trình nào đang ăn RAM nhiều nhất
#  — rất có thể là mysqld hoặc một next-server của website khác đang chạy.
#  Đó là rủi ro lớn nhất của cả lần deploy này, nên xử lý trước tiên.
#
#  swappiness=10: giảm xu hướng đẩy RAM của các app ĐANG CHẠY ra swap.
#  Swap chỉ để làm phao cứu sinh lúc build, không phải để dùng thường xuyên.
#  Đặt trong file RIÊNG ở /etc/sysctl.d/ nên không sửa file sysctl.conf chung.
# ---------------------------------------------------------------------------
buoc "1/7  Swap (chống OOM khi build)"

if [[ -n "$(swapon --show --noheadings 2>/dev/null)" ]]; then
    bo "Đã có swap rồi, bỏ qua:"
    swapon --show | sed 's/^/      /'
else
    if [[ ! -f /swapfile ]]; then
        if ! fallocate -l 4G /swapfile 2>/dev/null; then
            dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
        fi
        chmod 600 /swapfile
        mkswap /swapfile >/dev/null
    fi
    swapon /swapfile
    if ! grep -qE '^\s*/swapfile\s' /etc/fstab; then
        printf '/swapfile none swap sw 0 0\n' >>/etc/fstab
    fi
    xong "Đã bật 4 GB swap (/swapfile), đã ghi vào /etc/fstab"
fi

if [[ ! -f /etc/sysctl.d/99-ktm-swap.conf ]]; then
    printf '# Chỉ dùng swap khi thật cần, tránh đẩy RAM của app đang chạy ra đĩa\nvm.swappiness=10\n' \
        >/etc/sysctl.d/99-ktm-swap.conf
    sysctl -q -p /etc/sysctl.d/99-ktm-swap.conf
    xong "vm.swappiness=10"
else
    bo "vm.swappiness đã đặt"
fi

# ---------------------------------------------------------------------------
# 2. NODE 24 — CÀI RIÊNG VÀO /opt/node24
#
#  Dự án khai engines.node >= 24, nhưng node toàn cục của VPS là v20.20.2 và
#  8 app PM2 kia đang chạy bằng nó. Nâng node toàn cục = có thể làm chết cả 8.
#
#  Nên tải bản nhị phân chính thức vào /opt/node24. Đường dẫn CỐ ĐỊNH (không
#  có số phiên bản trong path như nvm) nên file cấu hình PM2 không phải sửa
#  lại mỗi lần nâng Node.
# ---------------------------------------------------------------------------
buoc "2/7  Node 24 riêng cho dự án (/opt/node24)"

can_cai_node=1
if [[ -x /opt/node24/bin/node ]]; then
    dang_co="$(/opt/node24/bin/node -v)"
    if [[ $dang_co == v24.* ]]; then
        bo "Đã có $dang_co ở /opt/node24, bỏ qua"
        can_cai_node=0
    else
        bo "/opt/node24 đang là $dang_co — cài lại bản 24"
    fi
fi

if [[ $can_cai_node -eq 1 ]]; then
    case "$(uname -m)" in
        x86_64)  kien_truc=linux-x64 ;;
        aarch64) kien_truc=linux-arm64 ;;
        *)       loi "Không hỗ trợ kiến trúc $(uname -m)"; exit 1 ;;
    esac

    # Cho phép ghim tay:  PHIEN_BAN_NODE=v24.9.0 sudo -E bash deploy/01-...
    PHIEN_BAN_NODE="${PHIEN_BAN_NODE:-}"
    if [[ -z $PHIEN_BAN_NODE ]]; then
        PHIEN_BAN_NODE="$(curl -fsSL --max-time 30 https://nodejs.org/dist/index.json \
            | grep -o '"version":"v24\.[0-9][0-9.]*"' | head -1 | cut -d'"' -f4 || true)"
    fi
    if [[ -z $PHIEN_BAN_NODE ]]; then
        loi "Không lấy được danh sách phiên bản Node từ nodejs.org."
        loi "Chạy lại và ghim tay, ví dụ:  PHIEN_BAN_NODE=v24.9.0 sudo -E bash deploy/01-chuan-bi-vps.sh"
        exit 1
    fi

    dia_chi="https://nodejs.org/dist/${PHIEN_BAN_NODE}/node-${PHIEN_BAN_NODE}-${kien_truc}.tar.xz"
    tam="$(mktemp -d)"
    bo "Tải $PHIEN_BAN_NODE ..."
    curl -fsSL --max-time 300 "$dia_chi" -o "$tam/node.tar.xz"

    # Giải nén ra thư mục tạm rồi mới ĐỔI CHỖ. Cố ý không "rm -rf /opt/node24":
    # bản cũ được DỜI sang /opt/node24.cu.* để nếu bản mới có vấn đề thì còn
    # đường quay lại, và để script không bao giờ xoá thẳng một thư mục có sẵn.
    mkdir -p "$tam/giai-nen"
    tar -xJf "$tam/node.tar.xz" -C "$tam/giai-nen" --strip-components=1
    if [[ -d /opt/node24 ]]; then
        cu="/opt/node24.cu.$(date +%Y%m%d%H%M%S)"
        mv /opt/node24 "$cu"
        bo "Bản cũ đã dời sang $cu (tự xoá tay khi đã chắc chắn bản mới chạy ổn)"
    fi
    mv "$tam/giai-nen" /opt/node24
    rm -rf "$tam"
    xong "Node $(/opt/node24/bin/node -v) đã vào /opt/node24 (node toàn cục vẫn là $(node -v 2>/dev/null || echo 'không rõ'))"
fi

# ---------------------------------------------------------------------------
# 3. pnpm 10.34.5 — cài VÀO /opt/node24, không đụng pnpm toàn cục
# ---------------------------------------------------------------------------
buoc "3/7  pnpm 10.34.5 trong /opt/node24"

if [[ -x /opt/node24/bin/pnpm ]] && [[ "$(/opt/node24/bin/pnpm -v 2>/dev/null)" == 10.34.5 ]]; then
    bo "Đã có pnpm 10.34.5"
else
    /opt/node24/bin/npm install -g --silent pnpm@10.34.5
    xong "pnpm $(/opt/node24/bin/pnpm -v)"
fi

# ---------------------------------------------------------------------------
# 4. REDIS
#
#  VPS chưa có Redis. Cổng 6379 còn trống. Gói redis-server của Ubuntu mặc
#  định đã chỉ lắng nghe 127.0.0.1 nên không hở ra ngoài internet.
#
#  CỐ Ý KHÔNG đặt maxmemory-policy allkeys-lru: worker dùng Redis để xếp hàng
#  công việc (BullMQ). Bật eviction là Redis sẽ tự xoá job khi gần hết bộ nhớ,
#  mất việc mà không báo gì. Giữ nguyên noeviction mặc định.
# ---------------------------------------------------------------------------
buoc "4/7  Redis"

if command -v redis-server >/dev/null 2>&1; then
    bo "Đã có $(redis-server --version | cut -d' ' -f1-3)"
else
    bo "Cài redis-server ..."
    # || true: một vài repo phụ lỗi index thì vẫn cài được từ cache, không cần dừng
    apt-get update -qq || bo "apt-get update có cảnh báo, vẫn tiếp tục"
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq redis-server
    xong "Đã cài $(redis-server --version | cut -d' ' -f1-3)"
fi

systemctl enable --now redis-server >/dev/null 2>&1 || systemctl enable --now redis >/dev/null 2>&1 || true

if redis-cli -h 127.0.0.1 -p 6379 ping 2>/dev/null | grep -q PONG; then
    xong "Redis trả lời PONG ở 127.0.0.1:6379"
else
    loi "Redis chưa trả lời ở 127.0.0.1:6379 — kiểm tra: systemctl status redis-server"
    exit 1
fi

# ---------------------------------------------------------------------------
# 5. THƯ MỤC + FILE .env
#
#  Sinh .env TRƯỚC khi tạo role database, vì mật khẩu database lấy từ chính
#  file này — chạy script lần hai sẽ đọc lại mật khẩu cũ chứ không đổi.
#
#  Secret sinh bằng "openssl rand -hex": chỉ có chữ và số, không có ký tự
#  đặc biệt. Lý do: file .env này được "source" trong shell và nhúng vào
#  DATABASE_URL, ký tự như $ ' " @ sẽ làm sai cả hai chỗ.
# ---------------------------------------------------------------------------
buoc "5/7  Thư mục và file .env"

mkdir -p "$GOC"/{media,logs,acme}
chmod 755 "$GOC" "$GOC/media" "$GOC/acme"
xong "$GOC/{app,media,logs,acme}"

if [[ ! -d $UNG_DUNG/.git && ! -f $UNG_DUNG/package.json ]]; then
    loi "Chưa có mã nguồn ở $UNG_DUNG"
    loi "Chạy bước clone/rsync trước (xem deploy/DOC-TRUOC-KHI-DEPLOY.md), rồi chạy lại script này."
    exit 1
fi

if [[ -f $FILE_ENV ]]; then
    bo "Đã có $FILE_ENV — giữ nguyên, không ghi đè"
    MK_DB="$(sed -n 's#^DATABASE_URL=postgres\(ql\)\?://'"$TEN_ROLE"':\([^@]*\)@.*#\2#p' "$FILE_ENV" | head -1)"
    if [[ -z $MK_DB ]]; then
        loi "Không đọc được mật khẩu database từ DATABASE_URL trong $FILE_ENV"
        loi "Sửa tay cho đúng dạng: DATABASE_URL=postgresql://$TEN_ROLE:MAT_KHAU@127.0.0.1:$CONG_PG/$TEN_DB?schema=public"
        exit 1
    fi
else
    MK_DB="$(openssl rand -hex 24)"
    umask 077
    cat >"$FILE_ENV" <<ENV
# ===========================================================================
#  Biến môi trường PRODUCTION — sinh tự động bởi deploy/01-chuan-bi-vps.sh
#  KHÔNG commit file này. KHÔNG dùng lại secret này cho máy khác.
# ===========================================================================
NODE_ENV=production

# --- Dữ liệu -------------------------------------------------------------
# Dùng CỤM PostgreSQL 18 có sẵn ở cổng $CONG_PG (cụm 5432 là PG14 của website khác)
DATABASE_URL=postgresql://$TEN_ROLE:$MK_DB@127.0.0.1:$CONG_PG/$TEN_DB?schema=public
REDIS_URL=redis://127.0.0.1:6379/0

# --- Cổng ----------------------------------------------------------------
# 4000 và 3001 ĐÃ BỊ CHIẾM bởi app khác trên VPS này, nên dời sang 4100/3100/3101
API_PORT=$CONG_API
WEB_PORT=$CONG_WEB
ADMIN_PORT=$CONG_ADMIN

# --- Tên miền ------------------------------------------------------------
CORS_ORIGINS=https://$TEN_MIEN,https://www.$TEN_MIEN,https://admin.$TEN_MIEN
# Dấu chấm đầu: để cookie đăng nhập dùng được chung giữa admin.* và api.*
COOKIE_DOMAIN=.$TEN_MIEN

# --- Khoá JWT ------------------------------------------------------------
JWT_STAFF_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_STAFF_REFRESH_SECRET=$(openssl rand -hex 32)

# --- Ảnh / file ----------------------------------------------------------
MEDIA_ROOT=$GOC/media
# Để TƯƠNG ĐỐI. nginx đọc thẳng file từ đĩa cho cả 3 tên miền.
MEDIA_PUBLIC_URL=/media
MEDIA_MAX_SIZE_MB=20

# --- Next.js (đọc lúc BUILD, nên sửa là phải build lại) ------------------
NEXT_PUBLIC_API_URL=https://api.$TEN_MIEN/api/v1
NEXT_PUBLIC_SITE_URL=https://$TEN_MIEN
ENV
    umask 022
    chmod 600 "$FILE_ENV"
    xong "Đã sinh $FILE_ENV (chmod 600)"
fi

# ---------------------------------------------------------------------------
# 6. POSTGRESQL — role + database MỚI trên cụm 18 có sẵn
#
#  Không cài Docker, không dựng cụm mới: cụm PG18 ở cổng $CONG_PG đã chạy sẵn
#  bằng systemd (postgresql@18-main). Chỉ thêm 1 role và 1 database.
#  Hai database đang có (angiahouse, my_cms_new_db) nằm ở cụm 14 cổng 5432,
#  script này không chạm tới cổng đó.
# ---------------------------------------------------------------------------
buoc "6/7  PostgreSQL: role '$TEN_ROLE' + database '$TEN_DB' (cổng $CONG_PG)"

pg() { sudo -u postgres psql -p "$CONG_PG" -v ON_ERROR_STOP=1 -XAtq "$@"; }

ban_pg="$(pg -c 'SHOW server_version' 2>/dev/null || true)"
if [[ -z $ban_pg ]]; then
    loi "Không kết nối được cụm PostgreSQL ở cổng $CONG_PG"
    loi "Kiểm tra: systemctl status postgresql@18-main"
    exit 1
fi
bo "Cụm cổng $CONG_PG là PostgreSQL $ban_pg"
if [[ $ban_pg != 18* ]]; then
    loi "Cổng $CONG_PG KHÔNG phải PostgreSQL 18 như khảo sát. Dừng lại để bạn kiểm tra,"
    loi "vì có thể đang trỏ vào cụm chứa database của website khác."
    exit 1
fi

if [[ "$(pg -c "SELECT 1 FROM pg_roles WHERE rolname='$TEN_ROLE'")" == 1 ]]; then
    pg -c "ALTER ROLE $TEN_ROLE LOGIN PASSWORD '$MK_DB'" >/dev/null
    bo "Role '$TEN_ROLE' đã có — đồng bộ lại mật khẩu theo .env"
else
    pg -c "CREATE ROLE $TEN_ROLE LOGIN PASSWORD '$MK_DB'" >/dev/null
    xong "Đã tạo role '$TEN_ROLE'"
fi

if [[ "$(pg -c "SELECT 1 FROM pg_database WHERE datname='$TEN_DB'")" == 1 ]]; then
    bo "Database '$TEN_DB' đã có"
else
    # CREATE DATABASE không chạy trong transaction nên không dùng ON_ERROR_STOP ở trên
    sudo -u postgres psql -p "$CONG_PG" -XAtq \
        -c "CREATE DATABASE $TEN_DB OWNER $TEN_ROLE ENCODING 'UTF8' TEMPLATE template0" >/dev/null
    xong "Đã tạo database '$TEN_DB' (chủ: $TEN_ROLE)"
fi

# Từ PostgreSQL 15, schema public không còn cho người dùng thường tạo bảng.
# Chuyển chủ schema sang $TEN_ROLE để "prisma migrate deploy" tạo bảng được.
sudo -u postgres psql -p "$CONG_PG" -d "$TEN_DB" -XAtq \
    -c "ALTER SCHEMA public OWNER TO $TEN_ROLE" >/dev/null
xong "schema public thuộc '$TEN_ROLE'"

# Extension hay dùng cho tìm kiếm tiếng Việt. Phải do superuser tạo.
# Không có cũng không sao — chỉ in cảnh báo, migration sẽ báo nếu thực sự cần.
for ext in pg_trgm unaccent; do
    if sudo -u postgres psql -p "$CONG_PG" -d "$TEN_DB" -XAtq \
        -c "CREATE EXTENSION IF NOT EXISTS $ext" >/dev/null 2>&1; then
        xong "extension $ext"
    else
        bo "không tạo được extension $ext (bỏ qua)"
    fi
done

# Thử kết nối đúng như app sẽ kết nối: TCP + mật khẩu
if PGPASSWORD="$MK_DB" psql -h 127.0.0.1 -p "$CONG_PG" -U "$TEN_ROLE" -d "$TEN_DB" \
    -XAtqc 'SELECT 1' >/dev/null 2>&1; then
    xong "Kết nối TCP bằng role '$TEN_ROLE' OK — DATABASE_URL dùng được"
else
    loi "Role '$TEN_ROLE' không kết nối được qua TCP 127.0.0.1:$CONG_PG"
    loi "Xem /etc/postgresql/18/main/pg_hba.conf, cần dòng: host all all 127.0.0.1/32 scram-sha-256"
    exit 1
fi

# ---------------------------------------------------------------------------
# 7. KIỂM TRA CỔNG CÒN TRỐNG
#
#  Khảo sát cho thấy 3001/4000/4001/4002/4020/3010/3011/3020 đã bị chiếm.
#  Kiểm tra lại ngay lúc chạy, vì từ lúc khảo sát tới giờ có thể đã khác.
# ---------------------------------------------------------------------------
buoc "7/7  Kiểm tra cổng $CONG_API / $CONG_WEB / $CONG_ADMIN còn trống"

co_cong_dung=0
for c in "$CONG_API" "$CONG_WEB" "$CONG_ADMIN"; do
    if ss -tlnH "sport = :$c" | grep -q .; then
        loi "Cổng $c ĐANG BỊ CHIẾM:"
        ss -tlnpH "sport = :$c" | sed 's/^/      /' >&2
        co_cong_dung=1
    else
        xong "Cổng $c trống"
    fi
done
if [[ $co_cong_dung -eq 1 ]]; then
    loi "Sửa lại API_PORT/WEB_PORT/ADMIN_PORT trong $FILE_ENV và deploy/nginx-*.conf rồi chạy lại."
    exit 1
fi

printf '\n\033[1;32m===== BƯỚC 1 XONG =====\033[0m\n'
cat <<HD

Tiếp theo (xem deploy/DOC-TRUOC-KHI-DEPLOY.md cho đầy đủ):

  Bước 2  Trỏ DNS 4 bản ghi A về 14.225.222.242, đợi phân giải xong
  Bước 3  Bật nginx tạm (HTTP) + lấy chứng chỉ SSL
  Bước 4  sudo bash deploy/02-trien-khai.sh

Nhắc: mọi secret nằm trong $FILE_ENV (chmod 600). Sao lưu file đó chỗ an toàn —
mất là phải đổi mật khẩu database và mọi người dùng admin phải đăng nhập lại.
HD
