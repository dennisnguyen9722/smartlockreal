#!/usr/bin/env python3
"""
VÁ LẠI HÀM setFeatured() VÀO product.service.ts.

VÌ SAO CẦN:
Tôi gửi nhầm một bản product.service.ts dựng từ bản chụp CŨ của dự án — bản đó
có trước lúc chạy them-noi-bat.py, nên thiếu hàm setFeatured() và bộ lọc
?featured=true. Chép đè lên là mất hai thứ đó, và API không biên dịch được:

    error TS2339: Property 'setFeatured' does not exist on type 'ProductService'.

Script này KHÔNG chép đè file. Nó đọc file đang có trên máy bạn và chỉ chèn lại
đúng hai đoạn thiếu, nên mọi thứ khác trong file giữ nguyên.

Hai đoạn được chèn (y hệt bản them-noi-bat.py đã làm lần đầu):
  1. Bộ lọc isFeatured trong hàm list()
  2. Hàm setFeatured(), đặt ngay trước changeStatus()

Chạy từ THƯ MỤC GỐC dự án:
    python3 va-lai-noi-bat.py

Chạy lại nhiều lần vẫn an toàn — có rồi thì bỏ qua. Bản gốc giữ ở *.bak.
"""
import shutil
import sys
from pathlib import Path

GOC = Path.cwd()
TEP = 'apps/api/src/catalog/product.service.ts'

daVa = []
boQua = []


def va(duong_dan, kiem_tra, cac_thay_the):
    """kiem_tra: chuỗi, có rồi thì coi như đã vá. cac_thay_the: [(cũ, mới)]"""
    p = GOC / duong_dan
    if not p.exists():
        print(f'✗ Không thấy {duong_dan}')
        print('  Script phải chạy từ THƯ MỤC GỐC dự án (chỗ có thư mục apps/ và packages/).')
        sys.exit(1)
    s = p.read_text(encoding='utf-8')
    if kiem_tra in s:
        boQua.append(f'{duong_dan}  ({kiem_tra})')
        return
    for cu, moi in cac_thay_the:
        if cu not in s:
            print(f'✗ {duong_dan} có cấu trúc khác dự kiến. Dừng lại, chưa sửa gì.')
            print(f'  Không tìm thấy đoạn:\n  {cu.strip()[:160]}')
            sys.exit(1)
        s = s.replace(cu, moi, 1)
    shutil.copy(p, str(p) + '.bak')
    p.write_text(s, encoding='utf-8')
    daVa.append(f'{duong_dan}  ({kiem_tra})')


# ------------------------------------------------- 1. bộ lọc trong list()
va(
    TEP,
    "query.featured ===",
    [
        (
            "      ...(query.categoryId ? { categoryId: query.categoryId } : {}),",
            "      ...(query.categoryId ? { categoryId: query.categoryId } : {}),\n"
            "      ...(query.featured ? { isFeatured: query.featured === 'true' } : {}),",
        )
    ],
)

# ------------------------------------------------- 2. hàm setFeatured()
va(
    TEP,
    'async setFeatured',
    [
        (
            '  async changeStatus(',
            '''  /**
   * Đặt lại toàn bộ danh sách nổi bật.
   * Làm trong một giao dịch: bỏ hết cờ cũ rồi bật lại theo đúng thứ tự gửi lên.
   * Nếu tách hai lần gọi, lỡ đứt giữa chừng là trang chủ trống không còn gì.
   */
  async setFeatured(ids: string[], staffId: string, ctx: AuditContext) {
    if (ids.length > 0) {
      const dem = await this.db.product.count({ where: { id: { in: ids } } });
      if (dem !== ids.length) {
        throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, {
          hint: 'Có sản phẩm trong danh sách không còn tồn tại, tải lại trang rồi chọn lại',
        });
      }
    }

    await this.db.$transaction([
      this.db.product.updateMany({
        where: { isFeatured: true },
        data: { isFeatured: false, featuredOrder: 0 },
      }),
      ...ids.map((id, index) =>
        this.db.product.update({
          where: { id },
          data: { isFeatured: true, featuredOrder: index },
        }),
      ),
    ]);

    await this.audit.log({
      staffId,
      action: 'product.featured',
      entityType: 'PRODUCT',
      changes: { after: { ids } },
      ctx,
    });

    return { count: ids.length };
  }

  async changeStatus(''',
        )
    ],
)


print()
for muc in daVa:
    print(f'✓ Đã vá   {muc}')
for muc in boQua:
    print(f'· Có sẵn  {muc}')

if daVa:
    print('\nXong. Chạy lại máy chủ API:')
    print('    pnpm --filter @ktm/api dev')
else:
    print('\nFile đã đủ cả hai đoạn, không phải sửa gì.')
print()
