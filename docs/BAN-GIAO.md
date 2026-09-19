# Bàn giao dự án khoathongminhchinhhang.vn

> File này để bắt đầu một cuộc trò chuyện mới với Claude. Gửi kèm file này
> và `packages/database/prisma/schema.prisma` là đủ bối cảnh.

## Bối cảnh

Website bán khóa thông minh đa hãng cho công ty Huy Hoàng Group (khách lẻ + khách công trình),
kèm CMS vận hành. Người làm: Dennis (IT duy nhất của công ty), máy macOS.

Repo: https://github.com/dennisnguyen9722/smartlockreal (riêng tư)
Thư mục: `~/Projects/huyhoang/khoathongminh`

## Cách làm việc mong muốn

- Làm **từng bước nhỏ**, mỗi lượt một phần, chạy xong mới sang phần tiếp theo.
- Đưa **lệnh chạy được ngay** và **nội dung file đầy đủ**, không mô tả chung chung.
- Khi sửa file dài, gửi **nguyên file** thay vì chỉ ra từng dòng cần sửa.
- Kiểm tra phiên bản thư viện bằng `npm view` **trước khi** cài, vì nhiều thư viện đã
  thay đổi lớn so với kiến thức cũ.
- Giải thích **vì sao** chọn cách làm, nêu rủi ro, rồi mới viết code.
- Giao diện (màu, kiểu chữ, khoảng cách) để **Bước 12** làm một lượt bằng Claude Design.
  Bố cục và cách dùng thì sửa ngay khi làm.

## Công nghệ (đã kiểm chứng, 09/2026)

| Thành phần | Phiên bản | Lưu ý |
|---|---|---|
| Node.js | 24.21 (nvm) | |
| pnpm | 10.34.5 (corepack) | |
| Turborepo | 2.10 | |
| PostgreSQL | 18 (Docker, cổng **5433**) | Máy có sẵn Postgres.app ở 5432 |
| Redis | 7.4 (Docker, cổng **6380**) | |
| Prisma | **7.10** | KHÔNG nâng lên 8 (còn là bản thử nghiệm) |
| NestJS | 12 (ES Module) | API biên dịch ra **CommonJS**, nạp bằng `require(esm)` |
| Next.js | 16.3 | App Router, Turbopack |
| React | 19.3 | |
| Tailwind CSS | 4.3 | |
| shadcn/ui | CLI 4.21, style `base-nova` (Base UI) | |
| Socket.IO | **4.8.3 ghim cứng** | Trùng bản NestJS dùng |
| ioredis | 6 (RESP3) | Đã kiểm chứng với Redis adapter và BullMQ 6 |
| BullMQ | 6 | ioredis là phụ thuộc tùy chọn |
| TanStack Query | 5.103 | |
| exceljs | **4.4.0 ghim cứng** | Không còn bảo trì, chấp nhận vì chỉ nhân viên dùng |
| sharp | 0.35 | Xử lý ảnh |
| jose + @node-rs/argon2 | 6.2 / 2.2 | JWT và băm mật khẩu |

## Cấu trúc
apps/api NestJS :4000 (REST /api/v1, Socket.IO /realtime)
apps/worker BullMQ (job nền)
apps/web Next.js :3000 (storefront, CHƯA làm)
apps/admin Next.js :3001 (CMS)
packages/shared mã lỗi, hằng số, schema Zod, quyền, menu
packages/database Prisma schema + migration + seed
packages/ui Tailwind 4 + shadcn/ui dùng chung

## Quyết định nghiệp vụ đã chốt

| Chủ đề | Quyết định |
|---|---|
| Kho | **Không có kho tổng**. Hàng ở **3 showroom** (2 TP.HCM, 1 Hà Nội) |
| MISA | **Bỏ tích hợp**. Website là nơi quản lý kho và doanh thu |
| Khách hàng | **Không đăng nhập**. Đặt hàng bằng số điện thoại. Khách công trình do nhân viên quản lý |
| Nhân viên | 2 vai trò: `SUPER_ADMIN` (31 quyền), `SALE_STAFF` (21 quyền) |
| Bán tại showroom | Cả hai: mua mang về ngay, và **đặt cọc 10–30%** rồi giao hàng |
| Thanh toán | Tiền mặt, COD, chuyển khoản VietQR, VNPay |
| Giao hàng | Nội thành tự giao, tỉnh xa gửi đơn vị vận chuyển |
| VAT | **Giá chưa gồm VAT**, cộng khi khách lấy hóa đơn (công ty chọn, dù Điều 29 Luật Giá 2023 yêu cầu niêm yết đã gồm thuế — đã báo rủi ro) |
| Giá | Lấy **giá thấp nhất** giữa các lớp, không cộng dồn. Làm tròn **xuống** hàng nghìn |
| Khuyến mãi | Flash sale, voucher, quà tặng kèm |
| Báo giá công trình | Một báo giá → một đơn. Sửa sau khi gửi = tạo phiên bản mới. **Không mua nợ** |
| Bảo hành | Tính từ **ngày lắp đặt**; không lắp thì từ ngày giao. Không tự kích hoạt nếu chưa lắp |
| Đổi trả | **Chỉ đổi máy mới** nếu lỗi nhà sản xuất trong **7 ngày**. Máy mới giữ thời hạn còn lại |
| Kỹ thuật viên | Có đội riêng (HCM, HN), **chưa cần tài khoản** đăng nhập |
| Ảnh | Lưu **trên server** (`MEDIA_ROOT`), đường dẫn `<năm>/<tháng>/<hash>.webp` |
| Đánh giá | Chỉ khách đã mua, qua link có mã, nhân viên duyệt trước |

## Đã hoàn thành

**Bước 1–2: Phân tích và khung dự án** — monorepo, hạ tầng Docker, API NestJS
(lỗi chuẩn `{code,message,details,traceId}`, Helmet, CORS, health check), worker BullMQ,
realtime Socket.IO + Redis adapter (đã thử 2 instance), web và admin Next.js.

**Bước 3: Database** — 11 migration, ~80 bảng, 8 nhóm:
1. Danh mục sản phẩm (hãng, danh mục cây 3 cấp, thông số, sản phẩm, biến thể, combo)
2. Tồn kho (theo showroom, serial từng chiếc, giữ hàng, **sổ kho bất biến**)
3. Khách hàng và nhân viên
4. Giá nhiều lớp, flash sale (chống chồng thời gian), voucher, quà tặng
5. Đơn hàng, thanh toán, giao hàng (**trigger tự đếm số lượng đã giao**)
6. Báo giá công trình (phiên bản, duyệt chiết khấu)
7. Lắp đặt (**chống trùng lịch kỹ thuật viên**), bảo hành, gửi trả hãng
8. Nội dung, đánh giá, cấu hình, thông báo, outbox, nhật ký

Database **tự bảo vệ nghiệp vụ** bằng CHECK, EXCLUDE, trigger: chống bán vượt tồn kho,
tổng tiền luôn khớp, sổ kho và nhật ký không sửa được.

**Bước 4: Đăng nhập và phân quyền** — Argon2id, access token 15 phút (giữ trong bộ nhớ),
refresh token xoay vòng trong cookie HttpOnly, **phát hiện token bị đánh cắp**,
thu hồi phiên tức thì qua Redis, chặn dò mật khẩu theo IP và email, nhật ký thao tác.

**Bước 5 (đang làm): Module danh mục sản phẩm**
- API: hãng, danh mục, thông số (kế thừa từ danh mục cha), sản phẩm, biến thể, ảnh
- Ảnh: tải lên → WebP 3 kích thước, chống trùng bằng mã băm
- **Nhập hàng loạt từ Excel**: file mẫu có danh sách chọn, xem trước, ghi trong một transaction
- CMS: khung menu phân quyền, màn hình Hãng, Danh mục + thông số, danh sách sản phẩm,
  form thêm sản phẩm (thông số sinh động theo danh mục, điểm nổi bật theo nhóm,
  bảng biến thể tự tạo mọi tổ hợp)

## Việc tiếp theo

1. **Trang chi tiết sản phẩm**: sửa thông tin, quản lý biến thể, gắn ảnh, đổi trạng thái
2. **Thư viện ảnh** trong CMS
3. **Màn hình nhập Excel** (API đã xong, cần giao diện)
4. Nhập ảnh hàng loạt theo tên SKU

Sau đó: Bước 6 CMS tồn kho → 7 đơn hàng → 8 báo giá → 9 lắp đặt/bảo hành →
10 nội dung/cấu hình → 11 thông báo realtime → **12 storefront + thiết kế giao diện**.

Công ty muốn **làm xong toàn bộ CMS trước**, storefront để sau.

## Quy ước code

- Tiền: `BigInt` VND, không dùng float. Thời gian: lưu UTC, hiển thị `Asia/Ho_Chi_Minh`
- Bảng và cột PostgreSQL dùng snake_case (`@@map`, `@map`), khóa chính **UUID v7**
- Schema Zod đặt trong `packages/shared`, **dùng chung** giữa API và giao diện
- Lỗi API: `AppException(ErrorCode.X, HttpStatus.Y, details)`
- Cột JSON: dùng `toJsonSafe()` (xử lý BigInt và Date)
- Ghi nhật ký thao tác quan trọng bằng `AuditService.log()`
- Endpoint mặc định **yêu cầu đăng nhập**; công khai phải đánh dấu `@Public()`
- Nút dẫn sang trang khác: **bọc `Button` trong `Link`**, không dùng `asChild`
- Mỗi service mới phải có mặt ở **3 chỗ** trong module: import, `providers`, `exports`
- Migration đã commit thì **không sửa**, tạo migration mới

## Bẫy đã gặp (đừng lặp lại)

| Vấn đề | Cách xử lý |
|---|---|
| Sửa `packages/shared` mà không build | Luôn `pnpm build` rồi *Restart TS Server* |
| Prisma đòi xóa chỉ mục viết tay | Dùng chỉ mục **có điều kiện** (`WHERE`), Prisma sẽ bỏ qua |
| zsh nuốt `!`, `*`, và biến `path` | Đặt trong nháy đơn, tránh tên biến `path` |
| CLI shadcn không cài thư viện component cần | Sau `add` luôn chạy `pnpm --filter @ktm/ui typecheck` |
| `noUncheckedIndexedAccess` báo `possibly undefined` | Kiểm tra trước khi dùng, đây là lỗi thật |
| Menu CMS giật khi chuyển trang | Do trang chưa tồn tại → tạo `page.tsx` trước |
| `MEDIA_ROOT` tương đối | Dùng **đường dẫn tuyệt đối** |
| Cổng bị chiếm | `lsof -tiTCP:3001 -sTCP:LISTEN | xargs -r kill` |

## Khởi động

```bash
cd ~/Projects/huyhoang/khoathongminh
pnpm infra:up
pnpm dev
```

Tài khoản thử: `admin@ktm.vn` / `MatKhau@123` (quản trị), `sale@ktm.vn` (nhân viên KD).
Quản lý tài khoản: `pnpm --filter @ktm/api staff list|create|reset-password`

Xem thêm `README.md` ở thư mục gốc.
