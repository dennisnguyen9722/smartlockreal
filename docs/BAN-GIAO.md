# Bàn giao dự án khoathongminhchinhhang.vn

> File này để bắt đầu một cuộc trò chuyện mới với Claude. Gửi kèm file này,
> `packages/database/prisma/schema.prisma` và file `ktm-context.txt` tạo bằng lệnh ở mục
> **"Gom code cho cuộc trò chuyện mới"** (cuối file).

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
- **Giao diện CMS theo thói quen cũ của công ty** (xem hình mẫu Dennis gửi): form kiểu
  "Tên biến thể / Giá trị", thẻ gập mở, nút "Thêm ..." ở góc phải. Đừng bắt người dùng nghĩ
  theo mô hình dữ liệu; phần kỹ thuật chạy ngầm phía sau.
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
| sharp | 0.35 | Xử lý ảnh; server chỉ nhận **JPEG, PNG, WebP** |
| jose + @node-rs/argon2 | 6.2 / 2.2 | JWT và băm mật khẩu |

## Cấu trúc

```
apps/api       NestJS :4000 (REST /api/v1, Socket.IO /realtime)
apps/worker    BullMQ (job nền)
apps/web       Next.js :3000 (storefront, CHƯA làm)
apps/admin     Next.js :3001 (CMS)
packages/shared    mã lỗi, hằng số, schema Zod, quyền, menu
packages/database  Prisma schema + migration + seed
packages/ui        Tailwind 4 + shadcn/ui dùng chung
```

## Quyết định nghiệp vụ đã chốt

> **Mô hình kinh doanh (chốt ở Bước 6):** công ty **KHÔNG giữ kho**. Khách đặt trên web hoặc nhắn Zalo →
> CMS nhận thông báo realtime → nhân viên gọi tư vấn, hỏi hãng còn hàng → đặt hàng với hãng →
> hãng giao về công ty → nhân viên đi giao cùng **kỹ thuật của hãng** → thu tiền → hoàn tất.
> Bảo hành do hãng làm: công ty chỉ tra cứu đơn/serial rồi báo hãng.

| Chủ đề | Quyết định |
|---|---|
| Kho | **Không quản lý kho.** Không nhập hàng, chuyển kho, kiểm kê. Các bảng kho trong database để nguyên, không dùng, không làm giao diện |
| Showroom | Có showroom để khách xem hàng trưng bày, **không theo dõi hàng**. Thông tin showroom (bảng `locations`) dùng cho SEO địa phương và cho đơn nhận tại showroom |
| MISA | **Bỏ tích hợp**. Website là nơi quản lý đơn hàng và doanh thu |
| Giá vốn, lợi nhuận | **Không theo dõi** |
| Khách hàng | **Không đăng nhập**. Đặt hàng bằng số điện thoại. Khách công trình do nhân viên quản lý |
| Nhân viên | 2 vai trò: `SUPER_ADMIN` (31 quyền), `SALE_STAFF` (21 quyền) |
| Quyền sửa giá | Nhân viên KD sửa được **giá niêm yết** biến thể (có nhật ký `variant.price_change`). Bảng giá nhóm, flash sale, voucher chỉ quản trị (`pricing.manage`) |
| Đặt hàng trên web | Khách chỉ gửi **tên, số điện thoại, địa chỉ gõ tự do**. Địa chỉ chuẩn (tỉnh, phường) do nhân viên điền khi xác nhận |
| Trạng thái đơn | **Chờ xác nhận → Đã xác nhận → Đã đặt hãng → Hàng về → Đang giao lắp → Hoàn tất**; Hủy được trước Hoàn tất. `PENDING_PAYMENT` không dùng |
| Thanh toán | **Không thanh toán online** (phải hỏi hãng còn hàng trước). Tiền mặt, chuyển khoản, COD do nhân viên ghi nhận. Có thể thu cọc. Bỏ VNPay |
| Giao hàng | Nhân viên đi giao cùng kỹ thuật hãng. Không dùng bảng `shipments` |
| SKU và serial | Dòng đơn luôn lưu SKU. Serial máy ghi lúc giao (không bắt buộc) để báo hãng khi bảo hành |
| VAT | **Giá chưa gồm VAT**, cộng khi khách lấy hóa đơn (công ty chọn, dù Điều 29 Luật Giá 2023 yêu cầu niêm yết đã gồm thuế — đã báo rủi ro) |
| Giá | Lấy **giá thấp nhất** giữa các lớp, không cộng dồn. Làm tròn **xuống** hàng nghìn |
| Giá gạch ngang | `compareAtPrice` = giá cũ gạch đi cho khách thấy đang giảm. **Không phải giá KM**; KM có thời hạn làm bằng Flash sale |
| Khuyến mãi | Flash sale, voucher, quà tặng kèm |
| Báo giá công trình | Một báo giá → một đơn. Sửa sau khi gửi = tạo phiên bản mới. **Không mua nợ** |
| Bảo hành, đổi trả | **Do hãng xử lý.** Công ty chỉ cần **tra cứu** theo số điện thoại hoặc serial (máy nào, ngày giao) để báo hãng |
| Lắp đặt | Do **kỹ thuật của hãng**. Không có lịch kỹ thuật viên; đơn chỉ lưu ngày hẹn và ghi chú kỹ thuật hãng |
| Ảnh | Lưu **trên server** (`MEDIA_ROOT`), đường dẫn `<năm>/<tháng>/<hash>.webp` |
| Đánh giá | Chỉ khách đã mua, qua link có mã, nhân viên duyệt trước |

### Sản phẩm và biến thể (chốt ở Bước 5)

| Chủ đề | Quyết định |
|---|---|
| Biến thể | Người dùng nhập **"Tên biến thể: Màu sắc / Giá trị: Đen"** + **thuộc tính kết hợp** (App: TTLock). Bên dưới là `product_options` (tối đa **3**) và `product_option_values`. Mỗi biến thể có giá, SKU, ảnh riêng |
| Thêm thuộc tính cho sản phẩm đã có biến thể | Hỏi "biến thể đang có thuộc giá trị nào"; biến thể cũ giữ SKU, giá, tồn kho, lịch sử. **Không hỗ trợ bớt thuộc tính** (gây trùng tổ hợp) — tắt biến thể thay thế |
| Mã tùy chọn/giá trị | Sinh từ nhãn, **không bao giờ đổi** (ghép thành `optionKey`). Sửa nhãn thì chỉ đổi phần hiển thị. "ttlock" tự khớp "TTLock" đã có |
| Tồn kho | **Không nhập ở biến thể**. Đi qua phiếu nhập/chuyển kho theo showroom (Bước 6) |
| Khóa SKU và serial | Khi biến thể đã có chứng từ hoặc dòng tồn kho |
| Xóa biến thể | Chỉ khi chưa có giao dịch/khuyến mãi/combo. Còn lại chỉ **tắt**. Không tắt/xóa được biến thể cuối cùng đang bán của sản phẩm đang bán |
| Trạng thái | Nháp → Đang bán (phải đủ checklist: biến thể bật có giá, có ảnh, đủ thông số bắt buộc, hãng/danh mục đang bật, combo có thành phần). Đang bán ↔ Nháp. Nháp/Đang bán → Lưu trữ (tắt mọi biến thể; chặn nếu nằm trong combo đang bán). **Lưu trữ → chỉ về Nháp** |
| Đổi slug | Sau khi từng đăng bán thì **tự tạo redirect 301** (`url_redirects`), rút gọn chuỗi, chống vòng lặp. Đường dẫn trang sản phẩm: `productPath()` trong `shared` (`/san-pham/<slug>`) — storefront PHẢI dùng hàm này |
| Hai người cùng sửa | Client gửi `expectedUpdatedAt`; lệch thì API trả **409 `EDIT_CONFLICT`** |
| Ảnh sản phẩm | Ảnh đầu tiên là ảnh đại diện. Ảnh gắn biến thể hiện khi khách chọn biến thể. Tối đa 20 ảnh/sản phẩm |
| Xóa sản phẩm | Chỉ xóa hẳn khi **chưa từng có giao dịch**, không đang bán, không nằm trong voucher (`voucher_targets` là Cascade — xóa sẽ làm voucher mất điều kiện). Còn lại **lưu trữ**. Xóa nhiều: mỗi sản phẩm một transaction, trả về danh sách bỏ qua kèm lý do |
| Danh sách sản phẩm | Tab trạng thái có số đếm, mặc định **Tất cả** (gồm lưu trữ, dòng làm mờ). Số sản phẩm ở trang Hãng/Danh mục **tính cả lưu trữ** |

## Đã hoàn thành

**Bước 1–2: Phân tích và khung dự án** — monorepo, hạ tầng Docker, API NestJS
(lỗi chuẩn `{code,message,details,traceId}`, Helmet, CORS, health check), worker BullMQ,
realtime Socket.IO + Redis adapter (đã thử 2 instance), web và admin Next.js.

**Bước 3: Database** — 11 migration, ~80 bảng, 8 nhóm. Database **tự bảo vệ nghiệp vụ** bằng
CHECK, EXCLUDE, trigger: chống bán vượt tồn kho, tổng tiền luôn khớp, sổ kho và nhật ký không sửa được.

**Bước 4: Đăng nhập và phân quyền** — Argon2id, access token 15 phút (giữ trong bộ nhớ),
refresh token xoay vòng trong cookie HttpOnly, **phát hiện token bị đánh cắp**,
thu hồi phiên tức thì qua Redis, chặn dò mật khẩu theo IP và email, nhật ký thao tác.

**Bước 5: Module danh mục sản phẩm** ✅
- Hãng, danh mục cây + thông số kế thừa, danh sách sản phẩm có bộ lọc
- **Trang chi tiết** `/san-pham/[id]`: tab Thông tin / Biến thể / Ảnh (tab lưu trên URL `?tab=`),
  thẻ Trạng thái với checklist đăng bán, form dùng chung với trang tạo mới (`ProductInfoForm`),
  chỉ gửi trường đã đổi, cảnh báo thay đổi chưa lưu
- **Biến thể** dạng thẻ gập mở, hộp thoại Thêm biến thể (tự tạo thuộc tính/giá trị, một transaction),
  ảnh riêng từng biến thể, sửa nhãn/xóa giá trị, tạo nhanh tổ hợp còn thiếu (khi ≥ 2 thuộc tính)
- **Tab Ảnh**: tải lên, sắp xếp, chọn ảnh đại diện, gỡ ảnh
- **Thư viện ảnh** `/thu-vien-anh`: xem, tải lên, sao chép link, xóa (chặn nếu ảnh đang dùng)
- **Nhập Excel** `/san-pham/nhap-excel`: tải mẫu theo danh mục → xem trước → xác nhận

### API danh mục sản phẩm (`/api/v1/catalog/products`)

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/` , `/:id` | Danh sách; chi tiết kèm `readiness` và `usage` từng biến thể |
| POST / PATCH | `/` , `/:id` | Tạo; sửa thông tin (không gồm trạng thái) |
| POST | `/:id/status` | Đổi trạng thái có kiểm tra |
| POST | `/:id/variants/quick` | Thêm biến thể theo nhãn (giao diện dùng cái này) |
| POST | `/:id/variants` , `/:id/variants/batch` | Thêm theo mã tùy chọn; nhiều cái một transaction |
| PATCH / DELETE | `/variants/:variantId` | Sửa / xóa biến thể |
| POST | `/:id/options` | Thêm thuộc tính mới |
| POST / PATCH / DELETE | `/:id/options/:optionId/values` , `/options/values/:valueId` | Giá trị thuộc tính |
| POST / PATCH / DELETE | `/:id/media` , `/:id/media/order` , `/media/:mediaId` | Ảnh sản phẩm |

## Việc tiếp theo (lộ trình mới từ Bước 6)

| Bước | Nội dung |
|---|---|
| **6. Đơn hàng** (đang làm) | Migration `orders_brand_sourcing` ✅ → danh sách đơn có tab trạng thái → chi tiết đơn (đổi trạng thái theo quy trình, ghi thanh toán/cọc, hẹn giao lắp, serial) → tạo đơn từ Zalo/tại showroom → **thông báo realtime khi có đơn web** |
| **7. Khách hàng + Báo giá công trình** | Khách tự tạo theo số điện thoại khi đặt; báo giá có phiên bản, chuyển thành đơn |
| **8. Nội dung + Cấu hình** | Showroom (SEO), bài viết, banner, đánh giá, thông tin công ty, **tra cứu bảo hành** |
| **9. Storefront + thiết kế giao diện** | Website bán hàng, form đặt hàng ngắn gọn |

Công ty muốn **làm xong toàn bộ CMS trước**, storefront để sau.

**Migration `orders_brand_sourcing`** (Bước 6): thêm trạng thái `ORDERED_FROM_BRAND`, `GOODS_ARRIVED`;
cột `ship_address_raw`, `brand_order_ref`, `brand_ordered_at`, `goods_arrived_at`, `scheduled_at`,
`brand_technician_note`, `assigned_staff_id` ở `orders`; `serial_numbers` ở `order_lines`.
CHECK địa chỉ đầy đủ chỉ áp dụng từ khi đơn đã xác nhận. Quy tắc thời gian của 2 trạng thái mới do API kiểm tra
(PostgreSQL không cho dùng giá trị enum mới trong cùng migration).

### Việc tồn (làm khi có thời gian hoặc khi cần)

- Nhập ảnh hàng loạt theo tên file = SKU
- Đổi tên thuộc tính (vd: "Màu" → "Màu sắc")
- Màn hình khai báo thành phần combo (checklist combo đang chặn đăng bán)
- Ô "Nhóm lắp đặt" trong form sản phẩm (làm cùng Bước 9)
- Sửa alt text ảnh; gán lại ảnh sang biến thể khác
- Migration thêm `product_media.media_asset_id` (FK Restrict) thay cho việc đối chiếu theo `url`
- `lib/hooks.ts` `useApiQuery`: `...options` đang ghi đè điều kiện "đã đăng nhập" của `enabled`
- Cảnh báo rời trang khi còn thay đổi chưa lưu chỉ chạy lúc đóng tab/tải lại, chưa chặn khi bấm menu
- Trang Hãng/Danh mục hiển thị tách "N sản phẩm · M lưu trữ"
- Có thể viết thêm migration CHECK thời gian cho `ORDERED_FROM_BRAND`/`GOODS_ARRIVED` (sau khi enum đã có)

## Quy ước code

- Tiền: `BigInt` VND, không dùng float. Thời gian: lưu UTC, hiển thị `Asia/Ho_Chi_Minh`
- Bảng và cột PostgreSQL dùng snake_case (`@@map`, `@map`), khóa chính **UUID v7**
- Schema Zod đặt trong `packages/shared`, **dùng chung** giữa API và giao diện
- Lỗi API: `AppException(ErrorCode.X, HttpStatus.Y, details)`. Lỗi từng ô: `details` là mảng `{ field, message }`
- Cột JSON: dùng `toJsonSafe()` (xử lý BigInt và Date)
- Ghi nhật ký thao tác quan trọng bằng `AuditService.log()`
- Endpoint mặc định **yêu cầu đăng nhập**; công khai phải đánh dấu `@Public()`
- Nút dẫn sang trang khác: **bọc `Button` trong `Link`**, không dùng `asChild`
- Mỗi service mới phải có mặt ở **3 chỗ** trong module: import, `providers`, `exports`
  (catalog dùng chung mảng `services` cho providers và exports)
- Migration đã commit thì **không sửa**, tạo migration mới
- Logic ghi nhiều bảng: viết hàm lõi `xxxInTx(tx, ...)` chạy trong transaction của nơi gọi,
  để nhiều thao tác ghép được thành một transaction (xem `VariantService.createInTx`)
- Trong `catch`: `AppException` ném lại nguyên vẹn, lỗi Prisma mới qua `mapPrismaError`
- **Thêm bảng mới có khóa ngoại `Restrict` tới `product_variants`** (phiếu kho, đơn, báo giá...)
  thì PHẢI thêm vào `VARIANT_USAGE_COUNT` trong `apps/api/src/catalog/variant-usage.ts`,
  nếu không API sẽ cho xóa biến thể rồi database mới chặn
- Form admin: chỉ gửi trường đã đổi (`buildUpdatePayload`), "có thay đổi chưa lưu" tính từ chính hàm đó
- Tiền trên giao diện: dùng `PriceInput` (hiển thị `4.990.000`, giá trị là chuỗi chữ số)
- Gửi file lên API: `authFetch(path, { method: 'POST', body: formData })` — `api.ts` tự bỏ header JSON
- API danh sách sản phẩm: **không truyền `status` thì ẩn sản phẩm lưu trữ** (dành cho ô chọn sản phẩm khi tạo
  đơn, báo giá). Trang danh sách quản trị truyền `status=ALL`
- Trang quản trị có số đếm (Hãng, Danh mục...) dùng `refetchOnMount: 'always'` vì admin cache `staleTime` 30 giây
- Thêm giá trị enum trong PostgreSQL: **không dùng giá trị mới trong cùng migration**
- Migration: sửa `schema.prisma` → `prisma migrate dev --create-only` → nối phần SQL viết tay (CHECK, trigger) → `prisma migrate dev`

## Bẫy đã gặp (đừng lặp lại)

| Vấn đề | Cách xử lý |
|---|---|
| Sửa `packages/shared` mà không build | Luôn `pnpm build` rồi *Restart TS Server* |
| Prisma đòi xóa chỉ mục viết tay | Dùng chỉ mục **có điều kiện** (`WHERE`), Prisma sẽ bỏ qua |
| zsh nuốt `!`, `*`, `[ ]` và biến `path` | Đặt trong nháy đơn (vd: `'app/san-pham/[id]/page.tsx'`), tránh tên biến `path` |
| Dán lệnh có dòng `#` vào zsh báo `command not found: #` | Chạy một lần: `echo 'setopt interactivecomments' >> ~/.zshrc` |
| CLI shadcn không cài thư viện component cần | Sau `add` luôn chạy `pnpm --filter @ktm/ui typecheck` |
| `noUncheckedIndexedAccess` báo `possibly undefined` | Kiểm tra trước khi dùng, đây là lỗi thật |
| Menu CMS giật khi chuyển trang | Do trang chưa tồn tại → tạo `page.tsx` trước |
| `MEDIA_ROOT` tương đối | Dùng **đường dẫn tuyệt đối** |
| Cổng bị chiếm | `lsof -tiTCP:3001 -sTCP:LISTEN \| xargs -r kill` |
| `mapPrismaError` dịch P2003 thành "dữ liệu tham chiếu không tồn tại" | Sai nghĩa khi **xóa**; bắt P2003 riêng và trả `IN_USE` |
| Liên kết biến thể ↔ giá trị là `Cascade` | Xóa giá trị đang dùng sẽ **âm thầm** làm hỏng tổ hợp; luôn kiểm tra trước |
| `product_media` lưu `url`, không có FK tới ảnh | Xóa ảnh thư viện phải đếm `product_media` theo `url` (đã làm trong `ImageService.remove`) |
| Ảnh HEIC từ iPhone bị từ chối | Đổi sang JPG trước (iPhone: Cài đặt → Camera → Định dạng → Tương thích nhất) |
| `useSearchParams` trong trang client | Bọc component trong `<Suspense>`, nếu không Next.js lỗi khi build |
| Gom code bằng từ khóa tiếng Anh | Bỏ sót thư mục tên tiếng Việt (`san-pham`, `thu-vien-anh`) → dùng lệnh ở cuối file |
| Ảnh từ API (:4000) bị chặn `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` | Helmet đặt `Cross-Origin-Resource-Policy: same-origin`. Đã ghi đè thành `cross-origin` CHỈ cho `/media` (`setHeaders` trong `main.ts`). Production dùng Nginx phục vụ ảnh thì thêm `add_header Cross-Origin-Resource-Policy cross-origin;`. Ảnh cache `immutable` 1 năm: sửa header xong phải **Empty Cache and Hard Reload** |
| Số đếm ở trang quản trị không cập nhật sau khi xóa | Admin cache 30 giây → trang có số đếm dùng `refetchOnMount: 'always'` |
| "Mọi trạng thái" nhưng ẩn sản phẩm lưu trữ | Đã thay bằng tab trạng thái có số đếm, mặc định Tất cả |

## Khởi động

```bash
cd ~/Projects/huyhoang/khoathongminh
pnpm infra:up
pnpm dev
```

Tài khoản thử: `admin@ktm.vn` / `MatKhau@123` (quản trị), `sale@ktm.vn` (nhân viên KD).
Quản lý tài khoản: `pnpm --filter @ktm/api staff list|create|reset-password`

Xem thêm `README.md` ở thư mục gốc.

## Gom code cho cuộc trò chuyện mới

Tạo `~/Desktop/ktm-context.txt` gồm toàn bộ code admin, shared và các module API liên quan.
Sửa danh sách `MODULES` theo bước sắp làm (Bước 6: thêm `orders`). Muốn gom kèm SQL migration thì thêm
vòng `for f in packages/database/prisma/migrations/*/migration.sql; do ...; done` trước `} > "$OUT"`.

```bash
cd ~/Projects/huyhoang/khoathongminh
OUT="$HOME/Desktop/ktm-context.txt"
MODULES='catalog|media|audit|common|auth'
{
  echo '##### CAY THU MUC #####'
  git ls-files --cached --others --exclude-standard apps packages | grep -vE 'node_modules|\.next|dist/'
  git ls-files --cached --others --exclude-standard \
    | grep -E "^(apps/admin/src|packages/shared/src|apps/api/src/($MODULES))/" \
    | grep -E '\.(ts|tsx)$' \
    | grep -vE '\.(spec|test)\.tsx?$' \
    | while IFS= read -r f; do
        echo; echo "##### FILE: $f #####"; cat "$f"
      done
  for f in apps/api/src/app.module.ts apps/admin/package.json apps/api/package.json; do
    echo; echo "##### FILE: $f #####"; cat "$f"
  done
} > "$OUT"
wc -l "$OUT"; du -h "$OUT"
```