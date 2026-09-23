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
| TinyMCE (cloud) | `@tinymce/tinymce-react` **6.3.0**, bản TinyMCE 8 | Tải từ `cdn.tiny.cloud` bằng `NEXT_PUBLIC_TINYMCE_API_KEY` (`apps/admin/.env.local`). Gói `tinymce@8.9.1` chỉ cài **devDependencies để có kiểu**. Lên production phải thêm tên miền admin vào *Approved Domains* của tài khoản Tiny |
| sanitize-html | 2.17.7 | Lọc HTML từ TinyMCE ở máy chủ (`apps/api/src/common/rich-text.ts`) |
| Be Vietnam Pro | qua `next/font/google` | Phông CMS, có bộ dấu tiếng Việt đầy đủ; nạp ở `apps/admin/src/app/layout.tsx`, biến `--font-be-vietnam-pro` |

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
| Showroom | Có showroom để khách xem hàng trưng bày, **không theo dõi hàng**. Showroom = dòng `locations` có `type = STORE` (dòng `WAREHOUSE` là di sản, ẩn khỏi CMS, không chọn được làm nơi nhận hàng). Dùng cho SEO địa phương và cho đơn nhận tại showroom |
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
| Báo giá công trình | Một báo giá → một đơn (kênh `PROJECT`, **giữ nguyên giá đã báo**, `price_source = QUOTE`). Sửa sau khi gửi = tạo phiên bản mới. **Không mua nợ** |
| Duyệt báo giá | Giảm **quá** `quote.approval_threshold_bps` (mặc định 1000 = 10%) so với giá niêm yết thì cần `quote.approve` (quản trị) duyệt trước khi gửi. Trả lại phải ghi lý do. Đã duyệt mà sửa → về Nháp, **mất duyệt** |
| Gửi báo giá | Trang in A4 `/bao-gia/[id]/in` → trình duyệt "Lưu thành PDF" → gửi Zalo/Email → bấm "Đã gửi khách". `pdf_url` lưu đường dẫn trang in. Trang in luôn dùng thông tin công ty **mới nhất** |
| Hết hạn báo giá | Worker, hàng đợi `maintenance`, **00:05 giờ VN** mỗi ngày: báo giá *Đã gửi* quá `valid_until` → *Hết hạn* (khách đã đồng ý thì giữ) |
| Khách hàng | Cá nhân: SĐT bắt buộc, duy nhất. Doanh nghiệp: bắt buộc tên công ty, MST duy nhất. Luôn có đúng một người liên hệ chính. **Không xóa khách** |
| Bảo hành, đổi trả | **Do hãng xử lý.** Công ty chỉ cần **tra cứu** theo số điện thoại hoặc serial (máy nào, ngày giao) để báo hãng |
| Lắp đặt | Do **kỹ thuật của hãng**. Không có lịch kỹ thuật viên; đơn chỉ lưu ngày hẹn và ghi chú kỹ thuật hãng |
| Không bán nợ | Chỉ **Hoàn tất** được khi đã thu đủ tiền. Hủy đơn đã thu tiền phải **ghi hoàn tiền trước** |
| Quyền hủy đơn | Cần `order.cancel` (hiện chỉ quản trị). Nhân viên KD thấy nút chuyển bước nhưng không thấy nút Hủy |
| Sửa sản phẩm trong đơn | Chỉ ở *Chờ xác nhận* và *Đã xác nhận*. Dòng có sẵn **giữ đúng giá đã chốt**, dù giá niêm yết đổi sau đó |
| Ghi nhận thanh toán | Nhân viên ghi khoản **đã thực nhận** (tiền mặt, chuyển khoản, COD). Không thu vượt, không hoàn quá. Ghi nhầm thì **hủy khoản** (giữ dấu vết), không xóa. Chuyển khoản tự sinh nội dung CK duy nhất `DH2609210003 1` |
| Serial | Nhập tay, **mỗi máy một ô**, không bắt buộc đủ. Mở từ *Hàng về*, sau Hoàn tất vẫn ghi bổ sung được. Công ty **không dùng máy quét mã vạch** |
| Địa chỉ | 2 cấp **34 tỉnh / 3.321 phường-xã** (Nghị quyết 202/2025/QH15). Dữ liệu cố định trong `apps/api/src/geo/vn-admin-units.ts`, trích từ gói MIT `vietnam-address-database@1.0.0` (không cài gói vào dự án) |
| Ảnh | Lưu **trên server** (`MEDIA_ROOT`), đường dẫn `<năm>/<tháng>/<hash>.webp`. Ảnh khách gửi kèm đánh giá lưu riêng `reviews/<năm>/<tháng>/<uuid>.webp`, **không** vào Thư viện ảnh |
| Đánh giá | Khách viết **thẳng ở trang sản phẩm** (đổi ở Bước 8, bỏ kiểu link mời; bảng `review_requests` để nguyên, không dùng). 5 lớp chặn: mọi đánh giá **chờ duyệt**; **bắt buộc SĐT** (không hiện công khai); SĐT khớp đơn *Hoàn tất* có sản phẩm → tự gắn **"Đã mua hàng"** (`verified_purchase` + `order_line_id`); mỗi SĐT **1 đánh giá chưa bị từ chối / sản phẩm**, 5 lần/giờ/IP; tối đa **5 ảnh × 5 MB**, từ chối thì xóa ảnh. Bắt buộc đồng ý chính sách dữ liệu cá nhân |

### Nội dung và cấu hình (chốt ở Bước 8)

| Chủ đề | Quyết định |
|---|---|
| Cấu hình | Chỉ khóa khai báo trong **registry** `packages/shared/src/settings.ts` mới đọc/sửa được (kèm schema Zod, nhãn tiếng Việt). Khóa di sản và khóa chưa có code dùng (`order.deposit_*`, `pricing.rounding_*`, `vat.default_rate_bps`, `payment.*`, `review.request_valid_days`...) **không khai báo nên tự ẩn**. Nguyên tắc: **chỉ hiện ô sửa xong có tác dụng thật**. 3 tab: Thông tin công ty / SEO chung / Quy tắc bán hàng. Khóa chưa có trong database dùng `defaultValue`, lần lưu đầu tự tạo dòng (không cần migration) |
| Đọc cấu hình | Mọi module đọc qua `SettingsService` (module `@Global`): `values()`, `number(key)`, `text(key)`, `companyInfo()`. Cache Redis `settings:values:v1` 60 giây, lưu xong xóa cache; Redis lỗi thì đọc thẳng database |
| VAT | Thuế suất nằm ở **từng biến thể** (`vatRateBps`) và được **chụp vào dòng đơn/báo giá** lúc tạo → đổi VAT không ảnh hưởng đơn cũ. `vat.default_rate_bps` chưa được dùng (tạo biến thể và nhập Excel đang gõ cứng 1000) |
| Tra cứu bảo hành | Một ô tìm cùng lúc theo **SĐT** (đặt hàng, người nhận, khách, người liên hệ doanh nghiệp), **serial** (gõ một phần, ≥ 4 ký tự) và **mã đơn**. Hạn bảo hành là **ước tính**: ngày hoàn tất đơn + `warrantyMonths` hiện tại của sản phẩm (không chụp vào đơn). Nút "Sao chép báo hãng". Không dùng bảng `warranties`/`serial_units` |
| Showroom trên website | Bật "Hiện trên website" phải có đường dẫn, địa chỉ chuẩn, SĐT, giờ mở cửa (tọa độ, ảnh, mô tả là nên có). Tắt showroom thì tự gỡ khỏi website. **Chỉ TP.HCM và Hà Nội** (cột `region` là enum `HCM/HN` dùng chung bảng giá; tỉnh khác cần migration thêm enum). Chỉ xóa được showroom **chưa có đơn** nhận hàng. Bản đồ nhúng `output=embed`, **không cần API key Google** |
| Soạn nội dung | **TinyMCE** (bài viết, trang tĩnh, chính sách, câu trả lời FAQ). Trình duyệt gửi HTML, **máy chủ luôn lọc lại** bằng danh sách thẻ cho phép. Không có màu chữ, cỡ chữ, font; căn lề bằng class; tiêu đề trong bài chỉ h2–h4; có bảng và video **YouTube**; ảnh luôn tải lên Thư viện ảnh (kể cả dán/kéo thả), **chặn ảnh base64**. Cột `content_json` để `{}` |
| Bài viết | Nháp → Đã đăng (ngay hoặc **hẹn giờ**) → Nháp; Nháp/Đã đăng → Lưu trữ → Nháp. Bắt buộc tiêu đề + nội dung; bài đang đăng không được sửa thành trống. Chỉ xóa bài **chưa từng lên website**. Đường dẫn `/bai-viet/<slug>` (`postPath()`). Chuyên mục xóa được (bài về "Chưa phân loại"). Tối đa 12 sản phẩm gắn kèm |
| Trang tĩnh | Đường dẫn ngay dưới tên miền `/<slug>` (`pagePath()`), **chặn các slug dành riêng** `PAGE_RESERVED_SLUGS`. Không hẹn giờ, không chuyên mục. Quy tắc xóa/lưu trữ giống bài viết |
| Chính sách | Theo **phiên bản, bất biến** (trigger database chặn UPDATE/DELETE `policy_versions`). Sửa = tạo bản mới (chép từ bản đang xem), hiệu lực ngay hoặc **ngày tương lai**, không lùi về quá khứ. Website hiện bản mới nhất đã tới hiệu lực. 6 loại cố định `POLICY_CODES`, đường dẫn `/chinh-sach/<slug>` (`policyPath()`). **Chỉ quản trị** (`setting.manage`) tạo phiên bản. Đặt hàng ghi đúng phiên bản `PRIVACY` đang hiện (chưa có thì dùng hằng `PRIVACY_POLICY_VERSION = '2026-09'`) |
| FAQ | 5 nhóm cố định `FAQ_GROUPS`. Câu gắn sản phẩm hiện ở trang sản phẩm, câu chung ở trang FAQ. Sắp xếp theo nhóm hoặc theo sản phẩm. Ẩn/hiện, xóa được |
| Banner | 4 vị trí `HOME_HERO`, `HOME_SECONDARY`, `CATEGORY_TOP`, `POPUP`, mỗi vị trí có kích thước ảnh khuyến nghị (`BANNER_PLACEMENT_INFO`). Ảnh điện thoại không bắt buộc. Tình trạng tự tính từ bật/tắt + thời gian chạy. `CATEGORY_TOP` chọn danh mục hoặc để trống = mọi danh mục; **xóa danh mục thì xóa banner riêng của nó** (Cascade). Link phải bắt đầu bằng `/` hoặc `https://`. Xóa được |
| Đổi slug nội dung đã đăng | Sản phẩm, showroom, bài viết, trang tĩnh: **tự tạo redirect 301**, cùng quy tắc (xóa redirect xuất phát từ đường dẫn mới, trỏ lại các redirect cũ, không tạo chuỗi) |

### Hệ thống và báo cáo (chốt ở Bước 9)

| Chủ đề | Quyết định |
|---|---|
| Giá và khuyến mãi | **BỎ module này.** Giá sau chiết khấu nhập thẳng vào giá niêm yết của biến thể; muốn khách thấy đang giảm thì dùng giá gạch ngang `compareAtPrice`. Các bảng flash sale, voucher, bảng giá nhóm giữ trong database nhưng không dùng, không có giao diện (như các bảng kho). Mục này đã bỏ khỏi menu |
| Nhân viên | **Không xóa nhân viên đang dùng**: đơn, báo giá, nhật ký đều trỏ tới (`Restrict`). Chỉ xóa được tài khoản **chưa từng đăng nhập và chưa có chứng từ** (tạo nhầm email); còn lại thì **khóa**. Luôn còn ít nhất một quản trị đang hoạt động; không tự khóa / tự đổi vai trò / tự đặt lại mật khẩu của chính mình |
| Mật khẩu | Quản trị tạo tài khoản hoặc đặt lại mật khẩu → hệ thống sinh **mật khẩu tạm** dạng `Kt7m-Xp4q-Rw9z` (bỏ ký tự dễ nhầm), **chỉ hiện một lần**, không lưu, không ghi nhật ký. Nhân viên tự đổi ở `/tai-khoan` (phải nhập mật khẩu hiện tại) |
| Thu hồi phiên | Khóa tài khoản, đổi vai trò, đặt lại mật khẩu → **thu hồi mọi phiên ngay** (đánh dấu Redis như `AuthService`), vì quyền nằm trong access token còn hạn 15 phút |
| Nhật ký | Chỉ ĐỌC, không sửa không xóa. Hành động lưu dạng `<đối tượng>.<việc>`; nhãn tiếng Việt trong `AUDIT_ACTION_LABEL` (`packages/shared/src/schemas/audit.ts`) — thêm hành động mới ở API thì thêm nhãn ở đây |
| Doanh thu | Ghi nhận khi đơn **Hoàn tất**, tính theo `completed_at`, gom nhóm theo **giờ Việt Nam**. Đơn đang xử lý chưa tính. "Còn phải thu" = tổng tiền đơn hoàn tất trừ đã thu. "Bán chạy" chỉ tính dòng `PRODUCT` và `BUNDLE` (các dòng khác giá 0 nên không đếm trùng) |
| Ai xem được tiền | `report.view` chỉ quản trị. Nhân viên kinh doanh **không thấy doanh thu** ở trang chủ lẫn menu Báo cáo; trang chủ của họ chỉ đếm việc của chính mình |
| Trang chủ CMS | Trả lời "hôm nay phải làm gì": việc cần làm trước, số liệu sau. Mỗi ô dẫn sang danh sách đã lọc sẵn qua URL |
| Giao diện CMS | Giữ nguyên bảng màu hiện có; bảng màu và nhận diện sẽ chốt **cùng lúc với storefront** (Bước 10–12). Logo chưa có, làm sau |

### Sản phẩm và biến thể (chốt ở Bước 5)

| Chủ đề | Quyết định |
|---|---|
| Biến thể | Người dùng nhập **"Tên biến thể: Màu sắc / Giá trị: Đen"** + **thuộc tính kết hợp** (App: TTLock). Bên dưới là `product_options` (tối đa **3**) và `product_option_values`. Mỗi biến thể có giá, SKU, ảnh riêng |
| Thêm thuộc tính cho sản phẩm đã có biến thể | Hỏi "biến thể đang có thuộc giá trị nào"; biến thể cũ giữ SKU, giá, tồn kho, lịch sử. **Không hỗ trợ bớt thuộc tính** (gây trùng tổ hợp) — tắt biến thể thay thế |
| Mã tùy chọn/giá trị | Sinh từ nhãn, **không bao giờ đổi** (ghép thành `optionKey`). Sửa nhãn thì chỉ đổi phần hiển thị. "ttlock" tự khớp "TTLock" đã có |
| Tồn kho | **Không nhập ở biến thể**, và từ Bước 6 công ty **không quản lý kho** (xem mục Kho ở trên) |
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

**Bước 6: Đơn hàng** ✅
- Chuyển mô hình sang **nhận đơn rồi đặt hãng**; migration `orders_brand_sourcing`; bỏ menu Kho, Dịch vụ
- **Lõi tạo đơn** `OrderService.createInTx` dùng chung cho web và nhân viên: tìm/tạo khách theo SĐT
  (`INSERT ... ON CONFLICT` trên unique index có điều kiện), chụp tên/SKU/giá, sinh mã `DH-yymmdd-0001`
- **Đặt hàng từ website** `POST /shop/orders` (công khai): mã chống trùng `idempotencyKey`, 5 đơn/10 phút/IP,
  ô bẫy chống bot, `.strict()` (không cho khách gửi giá), bắt buộc đồng ý chính sách dữ liệu (Nghị định 13/2023)
- **Thông báo realtime** `order:created` tới mọi vai trò có `order.view`: danh sách tự cập nhật; đơn web có
  thông báo nổi + chuông (nút 🔔 để mở khóa âm thanh) + thông báo hệ điều hành khi đang ở tab khác
- **Danh sách đơn** `/don-hang`: tab trạng thái kèm số đếm (mặc định *Đang xử lý*), tìm theo mã/SĐT/tên, lọc kênh, "đơn của tôi"
- **Chi tiết đơn** `/don-hang/[id]`: thanh quy trình + nút bước tiếp/lùi bước/hủy, sản phẩm + sửa sản phẩm, giao lắp
  (chọn tỉnh → phường), hóa đơn VAT, thanh toán (tự điền số tiền theo khoản thu), serial, nội bộ, lịch sử
- **Tạo đơn** `/don-hang/moi`: nhận ra khách cũ theo SĐT (gợi ý tên, địa chỉ lần trước), tìm sản phẩm theo tên/SKU, sửa giá
- Chống ghi đè bằng cột `orders.version` (`expectedVersion` → `EDIT_CONFLICT`)

**Bước 7: Khách hàng + Báo giá công trình** ✅
- **Khách hàng** `/khach-hang`: tab Doanh nghiệp/Cá nhân, tìm theo tên/SĐT/công ty/MST, tổng đã mua (đơn Hoàn tất);
  chi tiết có người liên hệ (một người chính), lịch sử 20 đơn gần nhất; báo trùng SĐT/MST kèm nút mở khách đã có
- **Báo giá** `/bao-gia`: lập báo giá (chọn khách, người nhận, công trình, giá báo từng dòng, % giảm tự tính,
  "tiết kiệm so với giá lẻ"), duyệt, gửi, khách đồng ý/từ chối, phiên bản mới, **chuyển thành đơn**
- **Trang in** A4 có "Bằng chữ" (`lib/vn-number-words.ts`), điều khoản, thông tin chuyển khoản, chỗ ký
- **Worker** đã kết nối database (`@ktm/database`, `DATABASE_URL`); hàng đợi `maintenance` với `upsertJobScheduler`
- Thông tin công ty: các khóa `company.*` trong `system_settings` (migration chỉ chèn dữ liệu)

**Bước 8: Nội dung + Cấu hình** ✅
- **Cấu hình** `/cau-hinh`: 3 tab, form tự dựng từ registry, chỉ gửi ô đã đổi, chống ghi đè theo nhóm
  (`pg_advisory_xact_lock` + `expectedUpdatedAt`), nhắc ô còn giá trị mẫu "Chưa cập nhật", ô mã Google nhận nguyên thẻ `<meta>`,
  xem trước trên Google. Logo và ảnh chia sẻ tải lên Thư viện ảnh
- **Tra cứu bảo hành** `/bao-hanh` (menu Bán hàng, cả 2 vai trò)
- **Showroom** `/showroom`: danh sách, thêm, sửa (địa chỉ 2 cấp, dán tọa độ hoặc link Google Maps có bản đồ xem trước,
  giờ mở cửa 7 ngày, tối đa 10 ảnh), thẻ Trạng thái liệt kê thiếu gì để đăng, xóa khi chưa có đơn
- **Bài viết** `/bai-viet`: 5 tab (Tất cả/Nháp/Đã đăng/Hẹn giờ/Lưu trữ), trang soạn TinyMCE + ảnh bìa + chuyên mục + tóm tắt
  + SEO + sản phẩm trong bài, nút "Lưu và đăng ngay"/Hẹn giờ; `/bai-viet/chuyen-muc`
- **Banner** `/banner`: tab theo vị trí, hộp thoại thêm/sửa có nhắc ảnh lệch tỉ lệ, đổi thứ tự, bật/tắt, cảnh báo nhiều popup
- **Trang tĩnh** `/trang`, **Chính sách** `/chinh-sach` (tổng quan 6 loại, lịch sử phiên bản, tạo bản mới có xác nhận),
  **Câu hỏi thường gặp** `/cau-hoi` (tab nhóm + tab "Theo sản phẩm", TinyMCE bản gọn)
- **Đánh giá** `/danh-gia`: tab Chờ duyệt (cũ nhất trước)/Đã duyệt/Từ chối, lọc sao, "Đã mua hàng", tìm SĐT;
  xem ảnh phóng to; duyệt, từ chối (lý do bấm nhanh), gỡ xuống, duyệt lại, trả lời công khai.
  Điểm sản phẩm (`rating_count`, `rating_sum`) do **trigger** tự tính từ đánh giá đã duyệt
- `mapPrismaError` dịch lỗi CHECK/trigger (SQLSTATE `23514`) thành `VALIDATION_FAILED` thay vì `INTERNAL_ERROR`
- Sửa lỗi `useApiQuery` (`...options` ghi đè điều kiện đăng nhập của `enabled`)
- Migration Bước 8: `showrooms` (cột SEO cho `locations`), `banner_category` (`banners.category_id`),
  `open_reviews` + `open_reviews_checks` (`order_line_id` cho trống, `reviewer_phone`, `verified_purchase`, viết lại trigger)

**Bước 9: Hệ thống** ✅
- **Nhân viên** `/nhan-vien`: danh sách, thêm (mật khẩu tạm hiện một lần, kèm nút sao chép tin nhắn gửi nhân viên),
  sửa, đổi vai trò, khóa/mở, gỡ khóa tạm, đặt lại mật khẩu, xem và đăng xuất từng phiên hoặc tất cả, xóa tài khoản chưa từng dùng
- **Tài khoản của tôi** `/tai-khoan`: đổi mật khẩu (có danh sách yêu cầu tự tick), xem máy đang đăng nhập,
  đăng xuất từng máy hoặc mọi máy khác. Vào bằng cách bấm tên mình ở đáy menu trái
- **Nhật ký** `/nhat-ky`: lọc theo người, nhóm hành động, hành động, khoảng thời gian; mở từng dòng xem bảng
  Trường / Trước / Sau, IP, thiết bị, traceId; nút "Xem toàn bộ lịch sử của đối tượng này"
- **Báo cáo** `/bao-cao`: chọn kỳ nhanh hoặc tự chọn, 7 ô số tổng quan (doanh thu và số đơn có so sánh kỳ trước),
  biểu đồ cột vẽ bằng SVG thuần (không thêm thư viện), doanh thu theo kênh bán và theo nhân viên, top 10 bán chạy
- **Trang chủ** `/`: ô việc cần làm (đơn chờ xác nhận, chờ hàng về, đang giao lắp, báo giá chờ duyệt,
  báo giá sắp hết hạn, đơn chưa thu đủ, đánh giá chờ duyệt) + doanh thu và hoạt động gần đây cho quản trị
- Trang Đơn hàng và Báo giá đọc bộ lọc từ URL (`?status=...&mine=true`) để trang chủ dẫn sang được
- **Giao diện nền (9.5)**: phông Be Vietnam Pro, chữ số cùng bề rộng toàn hệ thống, menu trái gọn (mục đang mở
  dùng vạch trái, khối tài khoản ở đáy), bảng dày hơn, màn hình lỗi/trống rõ ràng hơn, phân trang tự ẩn khi chỉ có 1 trang

### API hệ thống (`/api/v1`, Bước 9)

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET / POST | `/staff` | Danh sách nhân viên; tạo (trả mật khẩu tạm một lần) |
| GET / PATCH / DELETE | `/staff/:id` | Chi tiết (kèm phiên, thống kê); sửa; xóa khi chưa từng dùng |
| POST | `/staff/:id/status` | `DISABLE`, `ENABLE`, `UNLOCK` |
| POST | `/staff/:id/reset-password`, `/staff/:id/revoke-sessions` | Đặt lại mật khẩu; đăng xuất khỏi mọi máy |
| GET / DELETE | `/staff/me/sessions`, `/staff/me/sessions/:id` | Phiên của chính mình; đăng xuất phiên khác hoặc một phiên |
| GET | `/audit-logs`, `/audit-logs/actors` | Nhật ký có lọc; danh sách người từng thao tác |
| GET | `/reports/overview?from=&to=` | Báo cáo đầy đủ (quyền `report.view`) |
| GET | `/reports/dashboard` | Trang chủ; nội dung tự cắt theo quyền của người đăng nhập |

### API nội dung và cấu hình (`/api/v1`, Bước 8)

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET / PATCH | `/settings`, `/settings/:group` | Cả 3 nhóm; lưu một nhóm (`company`, `seo`, `sales`), chỉ khóa đã đổi + `expectedUpdatedAt` |
| GET | `/warranty/lookup?q=` | Tra cứu bảo hành (tối đa 50 đơn, không tính đơn hủy) |
| GET / POST | `/showrooms` | Danh sách (chỉ `STORE`, kèm `missing`); thêm |
| GET / PATCH / DELETE | `/showrooms/:id` | Chi tiết (kèm `orderCount`); sửa; xóa khi chưa có đơn |
| GET / POST / PATCH / DELETE | `/post-categories`, `/post-categories/:id` | Chuyên mục bài viết |
| GET / POST | `/posts` | Danh sách (kèm `statusCounts`); tạo |
| GET / PATCH / DELETE | `/posts/:id` | Chi tiết; sửa; xóa (chỉ bài chưa từng đăng) |
| POST | `/posts/:id/status` | `PUBLISH` (kèm `publishAt` để hẹn giờ), `UNPUBLISH`, `ARCHIVE`, `RESTORE` |
| GET / POST | `/banners`; POST `/banners/reorder` | Danh sách; thêm; sắp xếp một vị trí (gửi đủ id) |
| PATCH / DELETE | `/banners/:id` | Sửa; xóa |
| GET / POST | `/pages`; GET/PATCH/DELETE `/pages/:id`; POST `/pages/:id/status` | Trang tĩnh |
| GET | `/policies`, `/policies/:code/versions`, `/policies/versions/:id` | Tổng quan; lịch sử; một phiên bản |
| POST | `/policies/versions` | Tạo phiên bản (quyền `setting.manage`) |
| GET / POST | `/faqs?groupCode=&productId=&scope=`; POST `/faqs/reorder` | FAQ; sắp xếp theo nhóm hoặc sản phẩm |
| PATCH / DELETE | `/faqs/:id` | Sửa; xóa |
| POST | `/shop/reviews` | **Công khai**, `multipart/form-data` (trường chữ + tối đa 5 file `photos`), 5 lần/giờ/IP |
| GET | `/reviews?status=&rating=&verified=&search=` | Danh sách duyệt (kèm `statusCounts`) |
| POST / PUT | `/reviews/:id/approve`, `/reviews/:id/reject`, `/reviews/:id/reply` | Duyệt; từ chối (bắt buộc `reason`); trả lời (`content: null` để gỡ) |

### API khách hàng, báo giá (`/api/v1`)

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET / POST | `/customers`, `/customers/groups` | Danh sách (kèm tổng đã mua), nhóm khách; thêm khách |
| GET / PATCH | `/customers/:id` | Chi tiết (kèm `stats`, 20 đơn gần nhất); sửa |
| POST / PATCH / DELETE | `/customers/:id/contacts`, `/customers/contacts/:contactId` | Người liên hệ |
| GET / POST | `/quotes` | Danh sách (kèm `statusCounts`, ẩn bản đã thay); lập báo giá |
| GET / PATCH | `/quotes/:id` | Chi tiết (kèm `revisions`, `savings`, `approvalThresholdBps`); sửa khi Nháp |
| GET | `/quotes/:id/print` | Dữ liệu trang in + `CompanyInfo` |
| PUT | `/quotes/:id/lines` | Thay dòng (chỉ Nháp; trigger database cũng chặn) |
| POST | `/quotes/:id/actions` | `SUBMIT`, `WITHDRAW`, `APPROVE`, `RETURN`, `REOPEN`, `CANCEL`, `MARK_SENT`, `ACCEPT`, `REJECT` |
| POST | `/quotes/:id/revise`, `/quotes/:id/convert` | Phiên bản mới (trả về bản mới); tạo đơn (trả `orderId`, `orderCode`) |

### API đơn hàng (`/api/v1`)

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| POST | `/shop/orders` | **Công khai**: khách đặt trên website |
| GET | `/geo/provinces`, `/geo/provinces/:code/wards` | **Công khai**: tỉnh/thành, phường/xã (cache 1 ngày) |
| GET / POST | `/orders` | Danh sách (kèm `statusCounts`); nhân viên tạo đơn |
| GET | `/orders/customer-lookup?phone=`, `/orders/pickup-locations`, `/orders/assignees` | Tra khách cũ, showroom nhận hàng, người phụ trách |
| GET / PATCH | `/orders/:id` | Chi tiết (kèm `allowedTransitions`, `nextStepBlockers`, `balanceDue`); sửa thông tin, VAT |
| PUT | `/orders/:id/lines` | Thay toàn bộ sản phẩm (trước *Đã đặt hãng*) |
| POST | `/orders/:id/status` | Chuyển trạng thái theo `ORDER_TRANSITIONS` trong `shared` |
| POST | `/orders/:id/payments`, `/orders/payments/:paymentId/cancel` | Ghi nhận / hủy khoản thu |
| PATCH | `/orders/lines/:lineId/serials` | Serial từng máy |

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
| 6. Đơn hàng | ✅ Xong |
| 7. Khách hàng + Báo giá công trình | ✅ Xong |
| 8. Nội dung + Cấu hình | ✅ Xong |
| 9. Hệ thống (Nhân viên, Nhật ký, Báo cáo, Trang chủ, giao diện nền) | ✅ Xong — **CMS đã đủ chức năng, menu không còn mục "Sắp có"** |
| **10. Storefront** (tiếp theo) | Website bán hàng. Phần API công khai: sản phẩm, danh mục, bài viết, trang tĩnh, chính sách, FAQ, showroom, banner đang chạy, đánh giá đã duyệt, dữ liệu SEO công khai từ `/settings`. Phần web: trang chủ, danh mục, chi tiết sản phẩm, giỏ hàng, **form đặt hàng ngắn gọn**, ô viết đánh giá có ảnh, tra cứu đơn, sitemap, `robots.txt`, schema.org (`Product`, `LocalBusiness`, `FAQPage`, `Article`, `BreadcrumbList`) |
| 11. Nhận diện và giao diện | Chốt bảng màu, làm logo, chỉnh giao diện storefront và CMS một lượt |
| 12. Triển khai | Máy chủ, Nginx, HTTPS, sao lưu database và `MEDIA_ROOT`, giám sát, hướng dẫn sử dụng cho nhân viên |

Công ty đã làm xong toàn bộ CMS trước, giờ mới sang storefront. Thứ tự Bước 10–12 là đề xuất, chốt lại khi bắt đầu.

**Migration `orders_brand_sourcing`** (Bước 6): thêm trạng thái `ORDERED_FROM_BRAND`, `GOODS_ARRIVED`;
cột `ship_address_raw`, `brand_order_ref`, `brand_ordered_at`, `goods_arrived_at`, `scheduled_at`,
`brand_technician_note`, `assigned_staff_id` ở `orders`; `serial_numbers` ở `order_lines`.
CHECK địa chỉ đầy đủ chỉ áp dụng từ khi đơn đã xác nhận. Quy tắc thời gian của 2 trạng thái mới do API kiểm tra
(PostgreSQL không cho dùng giá trị enum mới trong cùng migration).

### Việc tồn (làm khi có thời gian hoặc khi cần)

- Nhập ảnh hàng loạt theo tên file = SKU
- Đổi tên thuộc tính (vd: "Màu" → "Màu sắc")
- Màn hình khai báo thành phần combo (checklist combo đang chặn đăng bán)
- Ô "Nhóm lắp đặt" trong form sản phẩm
- Sửa alt text ảnh; gán lại ảnh sang biến thể khác
- Migration thêm `product_media.media_asset_id` (FK Restrict) thay cho việc đối chiếu theo `url`
- Cảnh báo rời trang khi còn thay đổi chưa lưu chỉ chạy lúc đóng tab/tải lại, chưa chặn khi bấm menu
- Trang Hãng/Danh mục hiển thị tách "N sản phẩm · M lưu trữ"
- Có thể viết thêm migration CHECK thời gian cho `ORDERED_FROM_BRAND`/`GOODS_ARRIVED` (sau khi enum đã có)
- Sự kiện realtime khi đơn **đổi trạng thái** (hiện chỉ có `order:created`), để nhân viên khác thấy ngay
- Sửa showroom nhận hàng ở trang chi tiết đơn (API đã nhận `fulfillmentLocationId`, giao diện chưa có)
- Đổi hình thức nhận hàng (giao tận nơi ↔ nhận tại showroom) sau khi đã tạo đơn
- Cân nhắc cho nhân viên KD quyền `order.cancel`
- In phiếu giao hàng / phiếu xác nhận đơn cho khách
- Trang chi tiết đơn: hiện liên kết về báo giá gốc (đơn kênh Công trình có `quote_id`)
- Tạo PDF phía máy chủ (hiện dùng "Lưu thành PDF" của trình duyệt)
- Nhóm khách có `discount_bps` nhưng chưa áp giá theo nhóm (các lớp giá sẽ làm cùng Flash sale/voucher)
- Rà giao diện từng trang sau khi dùng thật: bật tiêu đề cột dính (`table-sticky`) cho bảng dài, gom bộ lọc cho gọn
  (phần nền đã làm ở 9.5; bảng màu chờ chốt cùng storefront)
- Chọn ảnh có sẵn từ Thư viện ảnh cho các ô ảnh (hiện chỉ có "Tải ảnh lên")
- Nhân viên: gửi email mời đặt mật khẩu thay cho mật khẩu tạm đọc qua Zalo (cần dịch vụ gửi email)
- Nhật ký: xuất Excel khi cần đối chiếu; tự dọn dòng quá cũ nếu bảng phình to
- Báo cáo: tùy chọn tính doanh thu theo **ngày thu tiền** thay vì ngày hoàn tất, nếu kế toán yêu cầu
- Nối `vat.default_rate_bps` vào tạo biến thể và nhập Excel, rồi mới đưa ô VAT lên trang Cấu hình
- Ghi lại lần đồng ý chính sách **mới** của khách cũ (hiện chỉ ghi lần đồng ý đầu tiên) — làm cùng trang đặt hàng Bước 10
- Xóa sản phẩm thì đánh giá bị xóa theo (Cascade) nhưng **file ảnh đánh giá còn trên ổ đĩa**
- Ảnh đánh giá đang chờ duyệt vẫn mở được nếu biết đúng đường dẫn (tên ngẫu nhiên). Cần chặn hẳn thì phục vụ qua API có kiểm tra
- Lỗi multer khi ảnh quá cỡ trả câu tiếng Anh (storefront nên kiểm tra dung lượng trước khi gửi)
- Cảnh báo `DeprecationWarning: Calling client.query() when the client is already executing a query` của `pg` trong log API
- Tra cứu serial quét cả bảng `order_lines`; đơn nhiều lên thì thêm chỉ mục trigram (`pg_trgm`)
- Hạn bảo hành tính theo `warrantyMonths` **hiện tại** của sản phẩm; cần chính xác thì thêm cột `order_lines.warranty_months`
- Showroom ngoài TP.HCM/Hà Nội: migration thêm giá trị enum `region`
- Chọn ảnh có sẵn từ Thư viện ảnh (hiện các ô ảnh ở Cấu hình, Showroom, Bài viết, Banner chỉ có "Tải ảnh lên")
- Lưu nháp bài viết/chính sách vào `localStorage` phòng mất khi trình duyệt lỗi

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
  → **`pnpm --filter @ktm/database build`**
- Khóa lạc quan cho đơn: mọi thao tác ghi gửi `expectedVersion`; service dùng `bumpVersion()` (`updateMany` theo
  `id + version`, tăng `version`) → không khớp thì `EDIT_CONFLICT`. Giao diện dùng hook `useOrderAction`
- Endpoint công khai: `@Public()` + `@RateLimit({ name, limit, windowSeconds })` + schema `.strict()`; thao tác tạo
  có thể bị gửi lại thì dùng `idempotencyKey`
- Phát realtime **sau khi transaction commit**, bọc `try/catch`: lỗi realtime không bao giờ làm hỏng nghiệp vụ
- Trong transaction PostgreSQL **không bắt lỗi trùng bằng try/catch** (transaction bị hủy); dùng `ON CONFLICT DO NOTHING`
- `uuidv7()` có sẵn trong PostgreSQL 18, dùng khi phải `INSERT` bằng SQL thô
- Mã chứng từ: `nextDocumentCode(tx, DOCUMENT_PREFIX.X)` trong `apps/api/src/common/document-code.ts`, gọi TRONG transaction
- Số điện thoại: lưu `+84...` (`normalizeVnPhone`), hiển thị `0901 234 567` (`formatVnPhone`), cùng trong `shared`
- Giờ nhập/hiển thị ở admin: `toLocalInput` / `fromLocalInput` / `formatDateTimeVn` (giờ Việt Nam) trong `lib/order-types.ts`
- **Cấu hình mới**: khai báo khóa trong registry `packages/shared/src/settings.ts` (nhóm, nhãn, `input`, schema trả về `string | number`,
  `defaultValue`) → build shared → đọc bằng `SettingsService`. Không đọc thẳng bảng `system_settings`
- **Nội dung soạn bằng TinyMCE**: giao diện dùng `RichTextEditor` (`compact` cho ô ngắn), máy chủ **luôn** gọi `sanitizeRichHtml()`
  trong `apps/api/src/common/rich-text.ts` trước khi lưu. Thêm nút/định dạng ở trình soạn thảo thì **thêm thẻ/thuộc tính tương ứng
  vào danh sách lọc**, nếu không sẽ bị bỏ khi lưu. Hiển thị lại trong CMS bằng `RichHtmlView` (chỉ cho HTML từ API)
- So sánh "có thay đổi chưa lưu" với nội dung TinyMCE: lấy HTML **sau khi TinyMCE chuẩn hóa** (`onReady`) làm mốc
- Đường dẫn trên website **chỉ lấy từ hàm trong `shared`**: `productPath`, `postPath`, `pagePath`, `policyPath`, `showroomPath`
  (API dùng khi tạo redirect, storefront dùng khi dựng link)
- **Ảnh lưu theo `url` (không có khóa ngoại)** phải được đếm trong `ImageService.remove` trước khi cho xóa ở Thư viện ảnh:
  `product_media.url`, khóa ảnh trong `system_settings` (`input: 'image'`), `locations.image_urls`, `posts.content_html`.
  Ảnh bìa bài viết và ảnh banner có khóa ngoại tới `media_assets`. Thêm chỗ mới lưu ảnh theo url thì **thêm vào đây**
- Sắp xếp thứ tự (banner, FAQ): endpoint `POST .../reorder` gửi **đủ id** của phạm vi theo thứ tự mới; thiếu/thừa → `EDIT_CONFLICT`.
  Route `reorder` khai báo **trước** `:id`
- Không có cột phiên bản: khóa lạc quan bằng `updateMany({ where: { id, updatedAt } })`; nhóm không có dòng cố định (cấu hình)
  thì dùng `pg_advisory_xact_lock(hashtext(...))`
- Cho phép một dữ liệu trùng có điều kiện (vd: mỗi SĐT một đánh giá chưa bị từ chối) mà **không** tạo chỉ mục viết tay:
  khóa `pg_advisory_xact_lock` theo khóa nghiệp vụ rồi kiểm tra trong cùng transaction
- Upload công khai: gửi **một lần** cả chữ lẫn file (`multipart`, `FilesInterceptor` có `limits`), xử lý ảnh trước transaction,
  transaction lỗi thì dọn file. Kiểm tra byte đầu file, không tin đuôi tên file; `sharp().rotate()` rồi xuất WebP để bỏ EXIF/GPS
- Trang có bộ lọc/tab: đặt trên URL (`?status=`, `?tab=`...) bằng `router.replace(..., { scroll: false })`, bọc `<Suspense>`
- Trang soạn nội dung dài: `staleTime: Infinity, refetchOnWindowFocus: false` để không tự tải lại đè phần đang viết
- File tải về trùng tên (`page.tsx`...): Claude đặt tên riêng khi gửi (`bai-viet-id-page.tsx`), lệnh `cp` đặt lại tên đúng
- Khung ứng dụng cao đúng màn hình (`h-svh overflow-hidden`); chỉ danh sách menu và vùng nội dung được cuộn.
  Thêm vùng cuộn mới thì khai báo rõ `overflow-y-auto`, đừng để cả trang cuộn
- Số tiền: không cần class riêng, `tabular-nums` đã bật toàn hệ thống ở `globals.css`; cột số dùng class `cell-number`
- Bảng dài: `<Table containerClassName="max-h-[60vh]" className="table-sticky">` để tiêu đề cột dính khi cuộn
- Trang có tab hoặc bộ lọc: đặt trên URL để trang chủ và link chia sẻ mở đúng danh sách

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
| Sau migration, TypeScript báo enum/cột mới "không tồn tại" | API đọc kiểu từ `packages/database/dist`. Chạy `pnpm --filter @ktm/database build` (gồm `prisma generate` + `tsc`) rồi *Restart TS Server*. `tsc --watch` của `pnpm dev` **không** theo dõi `schema.prisma` |
| Sửa `seed.ts` nhưng seed không đổi | `db:seed` chạy `dist/seed.js` → build `@ktm/database` trước |
| `curl` trả rỗng, `Unexpected end of JSON input` | API chưa chạy: mở terminal riêng chạy `pnpm dev`. Dùng `curl -sS` để thấy lỗi kết nối |
| Seed chưa có nhóm khách → tạo đơn lỗi | `customers.group_id` bắt buộc; seed tạo `RETAIL` (mặc định) và `PROJECT` |
| Trình duyệt không phát chuông | Chặn âm thanh khi chưa tương tác: phải bấm nút 🔔 một lần; lựa chọn lưu ở `localStorage` |
| Dòng báo giá không sửa được | Trigger `quote_lines_draft_only`: chỉ khi báo giá **Nháp**. Đã gửi → tạo phiên bản mới |
| Tạo phiên bản mới báo giá lỗi trùng | Unique `quotes_one_current_revision`: chuyển bản cũ sang `SUPERSEDED` **trước**, rồi mới thêm bản mới (cùng transaction) |
| Worker thêm dependency workspace | `pnpm install` rồi `pnpm --filter @ktm/database build` trước khi chạy worker |
| Nối SQL viết tay vào migration (`cat ... >>`) không thành công mà vẫn chạy `migrate dev` | Database thiếu CHECK/trigger mới mà không báo gì (lỗi lộ ra lúc chạy: trigger cũ chặn). **Luôn `grep` kiểm tra SQL đã nằm trong file trước khi `migrate dev`**. Migration đã chạy thì không sửa; tạo migration mới viết kiểu **chạy lặp không sao** (`DROP CONSTRAINT IF EXISTS` rồi `ADD`, `CREATE OR REPLACE FUNCTION`) |
| Nới ràng buộc cột (vd `order_line_id` cho trống) mà quên trigger cũ | Rà các trigger đang kiểm tra cột đó (`grep` trong migration `platform`) và viết lại cùng lúc |
| Lỗi CHECK/trigger thành `INTERNAL_ERROR` | Đã sửa `mapPrismaError` (SQLSTATE `23514`). Trigger tự viết nên `RAISE EXCEPTION` bằng **tiếng Việt** vì câu này hiện cho người dùng |
| Zod: schema dựng động từ danh sách (registry) | TypeScript suy ra `unknown` → khai báo rõ kiểu trả về (`z.ZodType<...>`) |
| TinyMCE tự sửa HTML lúc mở | Vừa mở đã báo "có thay đổi" → lấy HTML đã chuẩn hóa ở `onInit` làm mốc (xem `RichTextEditor onReady`) |
| `.env.local` của admin không có tác dụng | Next.js chỉ đọc lúc khởi động → tắt rồi chạy lại `pnpm dev` |
| Tên icon trong `navigation.ts` sai | `app-shell` tự thay bằng hình tròn, không báo lỗi → kiểm tra tên trên lucide.dev |
| Link rút gọn `maps.app.goo.gl` | Không đọc được tọa độ; dán dòng tọa độ (chuột phải trên Google Maps) hoặc link đầy đủ |
| `curl: (26) Failed to open/read local data` | File đính kèm `-F photos=@...` không tồn tại |
| `min-h-svh` cho khung ứng dụng | Menu trái dài hơn màn hình sẽ đẩy cả trang cao lên, sinh thanh cuộn thừa và cắt mất nút cuối menu. Dùng `h-svh overflow-hidden` rồi cho từng vùng cuộn riêng |
| Chỉ đặt `overflow-x-auto` (dải tab) | Theo chuẩn CSS, một trục `auto` thì trục kia thành `auto`, nên dư 1px là hiện thanh cuộn dọc nhỏ. `globals.css` đã khóa trục dọc cho các phần tử chỉ cuộn ngang |
| `next/font` không đổi phông | Chỉ nạp lúc khởi động: phải tắt rồi chạy lại `pnpm dev` |
| Xóa bản ghi có nhiều khóa ngoại `Restrict` (nhân viên) | Chỉ đăng nhập một lần là đã có dòng nhật ký nên không xóa được nữa. Quy tắc chung: **chưa từng dùng thì xóa, đã dùng thì khóa/lưu trữ** |
| `pnpm dev` lỗi `ENOTEMPTY ... generated/prisma` | `database:build` và `database:dev` cùng chạy `prisma generate`. Đã thêm `packages/database/turbo.json` (dev phụ thuộc build) và bỏ `prisma generate` khỏi script `dev` |

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

Tạo `~/Desktop/ktm-context.txt` gồm toàn bộ code admin, shared, worker, các module API liên quan và SQL migration.
Sửa danh sách `MODULES` theo bước sắp làm. Bước 10 (Storefront) cần: `catalog|content|posts|banners|reviews|showrooms|settings|orders|customers|common|geo|media`,
và gom thêm `apps/web/src` (hiện gần như trống) thay cho `apps/admin/src`.
Module API hiện có: `auth audit banners catalog common config content customers database geo media orders posts quotes redis reports reviews settings showrooms staff warranty`.
Giao diện nền (`packages/ui`, CSS, cấu hình Tailwind) KHÔNG nằm trong lệnh này; cần thì gom riêng (xem `ktm-ui.txt` ở Bước 9.5).
File `vn-admin-units.ts` (3.321 phường-xã) bị bỏ ra vì rất nặng.

```bash
cd ~/Projects/huyhoang/khoathongminh
OUT="$HOME/Desktop/ktm-context.txt"
MODULES='auth|audit|common|settings|catalog|orders|quotes|customers|redis|config'
{
  echo '##### CAY THU MUC #####'
  git ls-files --cached --others --exclude-standard apps packages | grep -vE 'node_modules|\.next|dist/'
  git ls-files --cached --others --exclude-standard \
    | grep -E "^(apps/admin/src|packages/shared/src|apps/worker/src|apps/api/src/($MODULES))/" \
    | grep -E '\.(ts|tsx)$' \
    | grep -vE '\.(spec|test)\.tsx?$' \
    | grep -v 'vn-admin-units.ts' \
    | while IFS= read -r f; do
        echo; echo "##### FILE: $f #####"; cat "$f"
      done
  for f in packages/database/prisma/migrations/*/migration.sql packages/database/src/seed.ts; do
    [ -f "$f" ] && { echo; echo "##### FILE: $f #####"; cat "$f"; }
  done
  for f in apps/api/src/app.module.ts apps/api/src/main.ts apps/admin/package.json apps/api/package.json; do
    echo; echo "##### FILE: $f #####"; cat "$f"
  done
} > "$OUT"
wc -l "$OUT"; du -h "$OUT"
```