# Đưa khoathongminhchinhhang.vn lên VPS Vietnix (14.225.222.242)

> Đọc hết mục **0** trước khi gõ lệnh đầu tiên.

**Đường dẫn dự án ở máy Mac** (KHÔNG phải `~/khoathongminh`):

```bash
DUAN="/Users/dennis/Projects/huyhoang/khoathongminh"
```

Mở Terminal mới là phải gán lại biến này, vì mọi lệnh phía dưới đều dùng `$DUAN`.
Thư mục ảnh ở máy Mac là `$DUAN/var/media` (theo `MEDIA_ROOT` trong `.env`),
**không** phải `apps/api/var/media`.

---

## 0. VPS này KHÔNG trống — và kế hoạch đã đổi theo

Khảo sát cho thấy máy đang chạy **8 app PM2** và **8 site nginx** của các
website khác (angiahouse, huyhoanglighting, lightshop, duhallight, my-cms...).
Vì vậy toàn bộ cách làm là **chỉ thêm, không sửa, không xoá**:

| Việc | Cách làm thường thấy | Cách làm ở đây | Lý do |
|---|---|---|---|
| Node 24 | `apt install nodejs 24` hoặc nvm dùng chung | tải riêng vào `/opt/node24` | node toàn cục là v20.20.2, **8 app kia đang chạy bằng nó** |
| Database | `docker compose up` cụm Postgres mới | dùng **cụm PG18 có sẵn ở cổng 5433** | khỏi cài Docker, khỏi thêm 1 cụm ăn RAM; cụm 5432 là PG14 của website khác, không chạm |
| Cổng app | 4000 / 3000 / 3001 | **4100 / 3100 / 3101** | 4000 đang là `hhvn-api`, 3001 đang là app khác — đụng cổng là app không bật được |
| nginx | `certbot --nginx` tự sửa cấu hình | `certbot certonly --webroot`, mình tự viết **1 file site mới** | certbot `--nginx` có quyền ghi vào file cấu hình; không để nó tự ý sửa trên máy có 8 site |
| PM2 | `pm2 kill && pm2 resurrect` | `pm2 startOrReload` **chỉ 4 app `ktm-*`** | `pm2 kill` hạ cả 8 app kia |
| RAM | build luôn | **thêm 4 GB swap trước**, build lần lượt | máy 7,8 GB đã dùng 2,2 GB, **không có swap**; `next build` ngốn 1,5–2,5 GB → OOM-killer sẽ bắn chết `mysqld` hoặc website khác |

**Rủi ro lớn nhất của cả lần deploy này là OOM lúc build.** Đó là lý do swap
nằm ở bước đầu tiên của script 01, chứ không phải chuyện phụ.

Hai thứ **chắc chắn có thay đổi hệ thống dùng chung**, nói rõ để bạn biết:

1. **Cài gói `redis-server`** (VPS chưa có). Gói mới, mặc định chỉ nghe
   `127.0.0.1`, không ảnh hưởng app đang chạy.
2. **`/etc/fstab` thêm 1 dòng swap** và **thêm file mới**
   `/etc/sysctl.d/99-ktm-swap.conf` (`vm.swappiness=10`). Đặt swappiness thấp
   chính là để **giảm** khả năng RAM của 8 app kia bị đẩy ra đĩa.

Không sửa: `nginx.conf`, bất kỳ file nào trong `sites-available` đang có,
`pg_hba.conf`, `postgresql.conf`, `my.cnf`, danh sách app PM2 hiện hữu.

---

## 1. DNS ở Vietnix (làm trước, vì phải đợi phân giải)

Thêm **4 bản ghi A**, giữ nguyên 3 bản ghi NS đang có:

| Loại | Tên | Giá trị | TTL |
|---|---|---|---|
| A | `@` (hoặc để trống) | `14.225.222.242` | 300 |
| A | `www` | `14.225.222.242` | 300 |
| A | `admin` | `14.225.222.242` | 300 |
| A | `api` | `14.225.222.242` | 300 |

TTL 300 để nếu có sai còn sửa nhanh; xong việc nâng lên 3600 cũng được.

Kiểm tra (chạy ở máy Mac, đợi tới khi cả 4 dòng đều ra đúng IP):

```bash
for t in khoathongminhchinhhang.vn www.khoathongminhchinhhang.vn \
         admin.khoathongminhchinhhang.vn api.khoathongminhchinhhang.vn; do
    printf '%-40s %s\n' "$t" "$(dig +short "$t" @8.8.8.8 | tail -1)"
done
```

Chưa ra đúng IP thì **đừng chạy certbot** — Let's Encrypt giới hạn 5 lần thất
bại / 1 giờ cho cùng bộ tên miền, hết lượt là phải đợi.

---

## 2. Đưa mã nguồn lên VPS

Chọn **một** trong hai cách.

### Cách A — qua Git (nên dùng: lần sau cập nhật chỉ một lệnh)

Ở máy Mac, commit 6 file deploy rồi push. Trên VPS:

Ở máy Mac, đưa thư mục `deploy/` lên GitHub trước:

```bash
cd "$DUAN"
git add deploy
git commit -m "them bo script deploy len VPS"
git push
```

Trên VPS, nếu repo **public**:

```bash
mkdir -p /var/www/khoathongminhchinhhang.vn
git clone https://github.com/dennisnguyen9722/smartlockreal.git \
          /var/www/khoathongminhchinhhang.vn/app
```

Nếu repo **private** (git clone sẽ hỏi mật khẩu rồi báo lỗi), tạo deploy key —
cách này tốt hơn dùng token: khoá chỉ đọc được đúng repo đó, và không bao giờ
hiện ra trong lệnh hay trong log:

```bash
ssh-keygen -t ed25519 -C "vps-ktm" -f /root/.ssh/id_ed25519_ktm -N ""
cat /root/.ssh/id_ed25519_ktm.pub
# Dán nội dung trên vào GitHub:
#   repo smartlockreal -> Settings -> Deploy keys -> Add deploy key
#   (ĐỪNG tích "Allow write access" — VPS chỉ cần đọc)
printf 'Host github.com\n  IdentityFile /root/.ssh/id_ed25519_ktm\n  IdentitiesOnly yes\n' \
    >> /root/.ssh/config
ssh -T git@github.com    # mong đợi: "Hi dennisnguyen9722/smartlockreal! You've successfully authenticated"

mkdir -p /var/www/khoathongminhchinhhang.vn
git clone git@github.com:dennisnguyen9722/smartlockreal.git \
          /var/www/khoathongminhchinhhang.vn/app
```

### Cách B — rsync từ máy Mac (không cần Git)

```bash
ssh root@14.225.222.242 "mkdir -p /var/www/khoathongminhchinhhang.vn/app"

rsync -az --delete \
  --exclude node_modules --exclude .next --exclude dist \
  --exclude .turbo --exclude .git --exclude .env --exclude var/media \
  "$DUAN/" \
  root@14.225.222.242:/var/www/khoathongminhchinhhang.vn/app/
```

`--exclude .env` để lần rsync sau **không xoá mất** file `.env` production trên
VPS. Dùng cách B thì mỗi lần triển khai nhớ chạy
`sudo KHONG_PULL=1 bash deploy/02-trien-khai.sh`.

---

## 3. Chuẩn bị VPS

```bash
cd /var/www/khoathongminhchinhhang.vn/app
sudo bash deploy/01-chuan-bi-vps.sh
```

Script dừng ngay nếu cổng bị chiếm hoặc cụm Postgres 5433 không phải PG18 —
dừng là tốt, nghĩa là có gì khác khảo sát, cần xem lại chứ đừng làm tiếp.

Xong, **sao lưu ngay** file secret:

```bash
cat /var/www/khoathongminhchinhhang.vn/app/.env
```

Lưu nội dung đó vào chỗ an toàn (1Password, Bitwarden...). Mất file này là
phải đổi mật khẩu database và mọi nhân viên phải đăng nhập lại admin.

---

## 4. nginx + chứng chỉ SSL

```bash
cd /var/www/khoathongminhchinhhang.vn/app

# 4.1 Cấu hình tạm, chỉ để lấy chứng chỉ
cp deploy/nginx-buoc1-http.conf /etc/nginx/sites-available/khoathongminhchinhhang.vn
ln -sfn /etc/nginx/sites-available/khoathongminhchinhhang.vn \
        /etc/nginx/sites-enabled/khoathongminhchinhhang.vn

nginx -t && systemctl reload nginx
```

`nginx -t` **luôn chạy trước** `reload`. Cấu hình sai thì `nginx -t` báo lỗi và
bạn chưa reload — 8 website kia không hề bị gián đoạn một giây nào.

Nếu `nginx -t` báo `could not build server_names_hash, you should increase
server_names_hash_bucket_size` thì **thêm một file mới** (không sửa
`nginx.conf`, vì file đó của chung 8 site kia):

```bash
echo 'server_names_hash_bucket_size 128;' > /etc/nginx/conf.d/ktm-hash.conf
nginx -t && systemctl reload nginx
```

```bash
# 4.2 Lấy chứng chỉ cho cả 4 tên miền trong MỘT chứng chỉ
certbot certonly --webroot \
  -w /var/www/khoathongminhchinhhang.vn/acme \
  --cert-name khoathongminhchinhhang.vn \
  -d khoathongminhchinhhang.vn \
  -d www.khoathongminhchinhhang.vn \
  -d admin.khoathongminhchinhhang.vn \
  -d api.khoathongminhchinhhang.vn \
  --agree-tos -m mronlinehuyhoang@gmail.com --no-eff-email \
  --deploy-hook "systemctl reload nginx"
```

`--cert-name` là bắt buộc: nó cố định đường dẫn
`/etc/letsencrypt/live/khoathongminhchinhhang.vn/`, đúng như file nginx bước 2
đang trỏ tới. Thiếu nó, certbot có thể đặt tên khác và nginx sẽ không tìm thấy
chứng chỉ.

```bash
# 4.3 Cấu hình chính thức
cp deploy/nginx-buoc2-https.conf /etc/nginx/sites-available/khoathongminhchinhhang.vn
nginx -t && systemctl reload nginx

# 4.4 Kiểm tra gia hạn tự động
systemctl list-timers | grep -i certbot
certbot renew --dry-run
```

Lúc này 3 tên miền đã có HTTPS nhưng còn báo **502** — đúng, vì app chưa chạy.

---

## 5. Chuyển dữ liệu và ảnh từ máy Mac lên

> Làm **trước** bước 6. Lý do: bản dump mang theo cả schema và bảng
> `_prisma_migrations`, nên sau khi phục hồi, `prisma migrate deploy` ở bước 6
> sẽ thấy các migration đã chạy rồi và không làm gì thêm. Làm ngược thứ tự thì
> phải xử lý xung đột bảng, mệt hơn nhiều.

**5.1 Xuất database ở máy Mac — dùng `pg_dump` TRONG Docker**

Dùng `pg_dump` của chính container, **không** dùng `pg_dump` cài trên macOS:
máy chủ là PostgreSQL 18, mà `pg_dump` phiên bản cũ hơn sẽ từ chối làm việc
với máy chủ mới hơn. Trong container thì hai bên luôn cùng phiên bản.

```bash
cd "$DUAN"

# Xem tên service của Postgres trong docker-compose (thường là "postgres")
docker compose -f docker/docker-compose.yml ps

docker compose -f docker/docker-compose.yml exec -T postgres \
    pg_dump --no-owner --no-privileges --format=custom \
            -U ktm -d khoathongminh > /tmp/ktm.dump

ls -lh /tmp/ktm.dump     # phải vài trăm KB trở lên, 0 byte là lỗi
```

`-T` là bắt buộc: không có nó, Docker cấp TTY và sẽ làm **hỏng file nhị phân**
(thêm ký tự xuống dòng kiểu Windows vào giữa dữ liệu).

Muốn dùng `pg_dump` ở máy Mac (chỉ khi đúng bản 18) thì lưu ý `.env` của bạn
bọc giá trị trong **dấu ngoặc kép**, phải bỏ đi trước khi dùng:

```bash
cd "$DUAN"
URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2-)"
URL="${URL//\"/}"          # bỏ dấu ngoặc kép
URL="${URL%%\?*}"          # bỏ ?schema=public — pg_dump không hiểu tham số này
echo "$URL"                # kiểm tra mắt: phải bắt đầu bằng postgresql:// , không có dấu "

pg_dump --no-owner --no-privileges --format=custom --file=/tmp/ktm.dump "$URL"
```

**5.2 Đẩy lên và phục hồi**

```bash
scp /tmp/ktm.dump root@14.225.222.242:/root/ktm.dump
```

Trên VPS:

```bash
cd /var/www/khoathongminhchinhhang.vn/app
set -a; . ./.env; set +a

pg_restore --no-owner --no-privileges --clean --if-exists \
           -d "${DATABASE_URL%%\?*}" /root/ktm.dump
```

`--clean --if-exists` để chạy lại được nhiều lần. Cảnh báo kiểu
`role "..." does not exist` là bình thường, bỏ qua.

Kiểm tra:

```bash
psql "${DATABASE_URL%%\?*}" -c "\dt" | head -20
psql "${DATABASE_URL%%\?*}" -XAtc "SELECT count(*) FROM products"
```

**5.3 Đẩy ảnh lên**

Thư mục ảnh ở máy Mac là **`$DUAN/var/media`** (lấy từ `MEDIA_ROOT` trong
`.env`), kiểm tra lại cho chắc:

```bash
grep MEDIA_ROOT "$DUAN/.env"
find "$DUAN/var/media" -type f | wc -l     # mong đợi khoảng 829+
```

Đẩy lên — **để ý dấu `/` cuối** ở cả hai đường dẫn, thiếu là ảnh bị lồng
thêm một cấp thư mục và cả website mất ảnh:

```bash
rsync -avz --progress \
  "$DUAN/var/media/" \
  root@14.225.222.242:/var/www/khoathongminhchinhhang.vn/media/
```

Trên VPS, kiểm tra nginx đọc được ảnh:

```bash
ls /var/www/khoathongminhchinhhang.vn/media | head
find /var/www/khoathongminhchinhhang.vn/media -type f | wc -l   # mong đợi khoảng 829+
chmod -R a+rX /var/www/khoathongminhchinhhang.vn/media
```

---

## 6. Build và lên sóng

```bash
cd /var/www/khoathongminhchinhhang.vn/app
sudo bash deploy/02-trien-khai.sh
```

Khoảng 5–12 phút. Script tự làm theo thứ tự:
thư viện → `prisma generate` → `@ktm/shared` → `@ktm/ui` → api → worker →
`migrate deploy` → **bật api** → đợi api trả lời → build web → build admin →
bật web + admin → `pm2 save`.

Thứ tự này có chủ ý: trang sản phẩm / bài viết / chính sách gọi API ngay **lúc
build** (`generateStaticParams`). API chưa chạy thì build ra trang rỗng hoặc
lỗi `fetch failed` — chính lỗi đã gặp lúc chạy ở máy nhà.

---

## 7. Kiểm tra sau khi lên sóng

```bash
curl -sI https://khoathongminhchinhhang.vn       | head -1   # mong đợi 200
curl -sI https://www.khoathongminhchinhhang.vn   | head -1   # mong đợi 301
curl -sI https://admin.khoathongminhchinhhang.vn | head -1   # mong đợi 200
curl -s  https://api.khoathongminhchinhhang.vn/api/v1/public/policies | head -c 300

# Ảnh phải do nginx trả, không qua Node:
curl -sI "https://khoathongminhchinhhang.vn/media/$(ls /var/www/khoathongminhchinhhang.vn/media | head -1)" | head -3

pm2 list                      # phải thấy đủ 12 app online (8 cũ + 4 ktm-*)
free -h                       # xem RAM và swap còn bao nhiêu
```

Mở bằng điện thoại, kiểm tra đúng những chỗ đã sửa trong lúc làm:
menu dưới, chọn biến thể, chọn ảnh, trang chính sách, thanh lưu ở admin.

---

## 8. Khi có chuyện

```bash
# Log
pm2 logs ktm-api --lines 100
tail -n 100 /var/www/khoathongminhchinhhang.vn/logs/web.loi.log
tail -n 50 /var/log/nginx/error.log

# 502: app chưa nghe cổng?
ss -tlnp | grep -E ':(4100|3100|3101)'

# Bật/tắt riêng 4 app của mình (KHÔNG ảnh hưởng 8 app kia)
pm2 restart ktm-web
pm2 stop ktm-api ktm-worker ktm-web ktm-admin
```

**Gỡ hẳn, trả máy về như trước** (8 website kia vẫn chạy nguyên):

```bash
pm2 delete ktm-api ktm-worker ktm-web ktm-admin
pm2 save
rm -f /etc/nginx/sites-enabled/khoathongminhchinhhang.vn
nginx -t && systemctl reload nginx
```

⛔ **Tuyệt đối không gõ**: `pm2 kill`, `pm2 delete all`, `pm2 resurrect`,
`systemctl restart postgresql`, hay bất kỳ `rm -rf` nào trong `/var/www` —
mỗi lệnh đó đều hạ website của khách hàng khác.

---

## 9. Lần cập nhật sau

```bash
cd /var/www/khoathongminhchinhhang.vn/app
sudo bash deploy/02-trien-khai.sh          # cách A, có Git
# hoặc, nếu đưa code lên bằng rsync:
sudo KHONG_PULL=1 bash deploy/02-trien-khai.sh
```

Nhớ: sửa `NEXT_PUBLIC_*` trong `.env` thì **phải build lại** mới có hiệu lực,
vì Next.js nhúng các biến đó vào mã JavaScript ngay lúc build.
