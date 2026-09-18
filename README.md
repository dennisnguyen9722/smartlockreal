# khoathongminhchinhhang.vn

Website bán khóa thông minh đa hãng (khách lẻ + khách công trình) kèm hệ thống quản trị.

## Cấu trúc

| Thư mục | Vai trò | Cổng |
|---|---|---|
| `apps/api` | NestJS 12: REST `/api/v1`, Socket.IO `/realtime` | 4000 |
| `apps/worker` | BullMQ 6: xử lý job chạy nền | – |
| `apps/web` | Next.js 16: website bán hàng | 3000 |
| `apps/admin` | Next.js 16: trang quản trị | 3001 |
| `packages/shared` | Mã lỗi, hằng số, kiểu dữ liệu dùng chung | – |
| `packages/database` | Prisma 7: schema, migration, seed | – |
| `packages/ui` | Tailwind CSS 4 + shadcn/ui dùng chung | – |

Hạ tầng (Docker): PostgreSQL 18 ở cổng **5433**, Redis 7.4 ở cổng **6380**
(lệch cổng mặc định để không đụng Postgres.app đang chạy ở 5432).

## Yêu cầu

- macOS / Linux, Node.js 24 (qua nvm), pnpm 10.34.5 (qua corepack), Docker Desktop

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
```

## Chạy lần đầu

```bash
cp .env.example .env
# Điền 4 JWT secret KHÁC NHAU: for i in 1 2 3 4; do openssl rand -base64 48; done
pnpm install
pnpm infra:up
pnpm --filter @ktm/database db:migrate
pnpm build
pnpm --filter @ktm/database db:seed
pnpm dev
```

Kiểm tra: http://localhost:4000/api/v1/health · http://localhost:3000 · http://localhost:3001

## Lệnh thường dùng

| Lệnh | Tác dụng |
|---|---|
| `pnpm dev` | Chạy tất cả, tự build lại khi sửa code |
| `pnpm dev:api` | Chỉ chạy backend (shared, database, api) |
| `pnpm build` | Build toàn bộ |
| `pnpm infra:up` / `infra:down` | Bật / tắt PostgreSQL và Redis |
| `pnpm --filter @ktm/database db:migrate` | Tạo và chạy migration sau khi sửa `schema.prisma` |
| `pnpm --filter @ktm/database db:generate` | Sinh lại Prisma client |
| `pnpm --filter @ktm/database db:studio` | Xem dữ liệu bằng giao diện |

## Quy ước

- Tiền: số nguyên VND, không dùng float. Thời gian: lưu UTC, hiển thị `Asia/Ho_Chi_Minh`.
- Lỗi API luôn có dạng `{ code, message, details, traceId }`; ném lỗi bằng `AppException`.
- Bảng và cột trong PostgreSQL dùng snake_case (`@@map`, `@map`), khóa chính UUID v7.
- Commit theo Conventional Commits: `feat(api): ...`, `fix(ui): ...`, `chore: ...`.
- Migration đã commit thì KHÔNG sửa; muốn đổi bảng thì tạo migration mới.
- SQL viết tay phải tự cấp `id` và `updated_at = now()` (Prisma chỉ tự làm khi đi qua code).

## Thêm component shadcn/ui

```bash
cd apps/web            # luôn chạy trong thư mục app
pnpm dlx shadcn@4.21.0 add <tên-component>
cd ../..
pnpm --filter @ktm/ui typecheck
# CLI không tự cài thư viện component cần: nếu báo "Cannot find module 'x'"
pnpm add x --filter @ktm/ui
```

## Lưu ý phiên bản (đã kiểm chứng 09/2026)

- Prisma: dùng dòng **7.10.x**. Bỏ qua thông báo nâng cấp lên 8.0.0-rc (bản thử nghiệm).
- NestJS 12 chỉ còn ES Module; `apps/api` biên dịch ra CommonJS và nạp NestJS bằng `require(esm)` (Node ≥ 22.12).
- `socket.io` và `socket.io-client` ghim **4.8.3** (trùng bản NestJS dùng).
- ioredis 6 mặc định RESP3; đã kiểm chứng chạy được với Redis adapter và BullMQ 6.

## Sự cố thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| `has no exported member` từ `@ktm/shared` | Bản build cũ: `pnpm build`, rồi VS Code → *TypeScript: Restart TS Server* |
| `Biến môi trường không hợp lệ` | Thiếu hoặc sai biến trong `.env`, xem danh sách lỗi in ra |
| Web hiện `API: ❌` | API chưa chạy, hoặc `NEXT_PUBLIC_API_URL` thiếu; sửa `next.config.ts` phải khởi động lại |
| Đổi `NEXT_PUBLIC_*` không có hiệu lực | Biến được nhúng lúc build, phải build lại |
| `next build` lỗi `<Html> should not be imported` | Không đặt `NODE_ENV` trong `.env` |
| zsh `no matches found` hoặc chuỗi bị thay bằng lệnh cũ | Đặt `*` và `!!` trong dấu nháy đơn |
| API tắt không tự chạy lại khi dev | `node --watch` chỉ chạy lại khi file đổi: `touch apps/api/dist/main.js` |

## Lưu ý khi viết SQL tay trong migration

- Prisma **bỏ qua** CHECK, trigger, EXCLUDE và chỉ mục có `WHERE`.
- Prisma **đòi xóa** chỉ mục thường (không có `WHERE`) nếu không khai báo trong `schema.prisma`.
  Dùng chỉ mục có điều kiện thay thế.
- Sau mỗi `db:migrate`, nếu Prisma **hỏi tên migration mới**: nhấn `Ctrl + C`,
  chạy `db:migrate --name drift_check --create-only` để xem Prisma muốn đổi gì, rồi xóa file đó.
- Migration đã chạy thì không sửa; muốn sửa thì tạo migration mới.

## Tài khoản nhân viên

Chỉ nhân viên mới đăng nhập; khách hàng đặt hàng bằng số điện thoại, không có tài khoản.

```bash
pnpm --filter @ktm/api staff list
pnpm --filter @ktm/api staff create <email> "<Họ tên>" [SUPER_ADMIN|SALE_STAFF]
pnpm --filter @ktm/api staff reset-password <email>
```

Mật khẩu được nhập ẩn, không lưu vào lịch sử Terminal.

**Quy tắc mật khẩu** (`packages/shared/src/password-policy.ts`): tối thiểu 12 ký tự, có chữ hoa,
chữ thường và chữ số; không chứa các từ dễ đoán (`password`, `matkhau`, `123456`, `qwerty`,
`admin`, `khoathongminh`).

**Hai vai trò** (quyền định nghĩa trong `packages/shared/src/permissions.ts`):

| Vai trò | Quyền |
|---|---|
| `SUPER_ADMIN` | Toàn bộ 31 quyền |
| `SALE_STAFF` | 21 quyền: sản phẩm, nội dung, đơn hàng, khách hàng, báo giá, lắp đặt, bảo hành, nhập/chuyển kho |

10 quyền chỉ quản trị có: sửa giá, duyệt báo giá, điều chỉnh tồn kho, hủy đơn đã xác nhận,
hoàn tiền, xuất dữ liệu khách, báo cáo doanh thu, quản lý nhân viên, cấu hình, xem nhật ký.

## Cơ chế đăng nhập

| Thành phần | Chi tiết |
|---|---|
| Mật khẩu | Argon2id (19 MiB, 2 vòng, 1 luồng) theo khuyến nghị OWASP |
| Access token | JWT 15 phút, trả trong nội dung phản hồi; admin giữ **trong bộ nhớ**, không dùng `localStorage` |
| Refresh token | Chuỗi ngẫu nhiên 7 ngày, cookie `HttpOnly` path `/api/v1/auth`; database chỉ lưu mã băm SHA-256 |
| Xoay vòng | Mỗi lần làm mới, token cũ bị thu hồi. Dùng lại token cũ = thu hồi **cả chuỗi phiên** |
| Thu hồi tức thì | Đăng xuất / đổi mật khẩu ghi mã phiên vào Redis 15 phút, access token cũ mất hiệu lực ngay |
| Chống dò mật khẩu | Mỗi IP 10 lần/15 phút, mỗi email 5 lần/15 phút (Redis); khóa tài khoản 15 phút sau 5 lần sai |
| Realtime | Socket.IO nhận token qua `auth.token`, tự vào phòng `staff:<id>` và `role:<vai trò>` |

**Endpoint mặc định đều yêu cầu đăng nhập.** Muốn công khai phải đánh dấu `@Public()`.
Yêu cầu quyền bằng `@RequirePermissions(Permission.X)`.

## Quy ước viết API

- Kiểm tra dữ liệu vào bằng Zod ngay trong controller, lỗi trả `VALIDATION_FAILED` kèm `details`.
- Ghi nhật ký thao tác quan trọng bằng `AuditService.log()`; lỗi ghi nhật ký không làm hỏng nghiệp vụ.
- Cột JSON: dùng `toJsonSafe()` từ `@ktm/shared` (xử lý `BigInt` của tiền và `Date`).
- Không trả `passwordHash`, token hay stack trace ra client.

## Sự cố thường gặp (bổ sung)

| Hiện tượng | Cách xử lý |
|---|---|
| `EADDRINUSE: address already in use :::3001` | Tiến trình cũ còn chạy: `lsof -tiTCP:3001 -sTCP:LISTEN \| xargs -r kill` (đổi cổng cho 3000, 4000) |
| `pnpm dev` dừng cả cụm vì một app lỗi | Turbo dừng mọi tác vụ khi một tác vụ thất bại; sửa app lỗi rồi chạy lại |
| Đăng nhập trả `RATE_LIMITED` khi đang thử nghiệm | Xóa bộ đếm: `docker exec ktm-redis redis-cli --scan --pattern 'rl:*' \| xargs -r docker exec ktm-redis redis-cli del` |
| Tài khoản bị khóa do thử sai nhiều | `pnpm --filter @ktm/api staff reset-password <email>` |
| `Type 'Record<string, unknown>' is not assignable to ... InputJsonValue` | Dùng `toJsonSafe()` trước khi ghi vào cột JSON |
| Dừng dịch vụ | Luôn nhấn `Ctrl + C` trong tab đang chạy, không đóng thẳng cửa sổ Terminal |

## Ảnh và file tải lên

- Ảnh lưu trong `MEDIA_ROOT` (đặt **đường dẫn tuyệt đối**, vì đường dẫn tương đối tính theo
  thư mục chạy lệnh, mà mỗi app chạy ở thư mục khác nhau).
- Đường dẫn file: `<năm>/<tháng>/<mã băm SHA-256>.webp`, kèm bản `_md` (900px) và `_sm` (400px).
- Tên file là mã băm nội dung nên ảnh trùng chỉ lưu một lần, và cache được 1 năm.
- Ảnh tải lên luôn được chuyển sang WebP và **xóa dữ liệu ẩn** (GPS, thông tin máy chụp).
- Thư mục ảnh **không nằm trong Git**, cần sao lưu riêng khi triển khai.
