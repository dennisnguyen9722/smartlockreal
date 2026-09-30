'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { ProductCreateSchema } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { PageHeader } from '@/components/page-header';
import { ProductInfoForm } from '@/components/product-info-form';
import { VariantBuilder, type VersionDraft } from '@/components/variant-builder';
import { slugifyVi } from '@ktm/shared';
import { useApiMutation } from '@/lib/hooks';
import {
  apiFieldErrors,
  buildCreateInfo,
  collectFieldErrors,
  EMPTY_INFO_DRAFT,
  type ProductInfoDraft,
} from '@/lib/product-form';

/** Giá của sản phẩm; phiên bản nào không nhập giá riêng thì dùng các giá trị này */
interface BasePrice {
  price: string;
  compareAtPrice: string;
  sku: string;
}

const EMPTY_BASE: BasePrice = { price: '', compareAtPrice: '', sku: '' };

/** Mã chưa dùng trong danh sách: "den" -> "den-2" (mã nội bộ, không đổi sau khi lưu) */
function uniqueCode(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}-${index}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export default function NewProductPage() {
  const router = useRouter();

  const [info, setInfo] = useState<ProductInfoDraft>(EMPTY_INFO_DRAFT);
  const [base, setBase] = useState<BasePrice>(EMPTY_BASE);
  const [groupName, setGroupName] = useState('Màu sắc');
  const [versions, setVersions] = useState<VersionDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Payload đầy đủ; dùng cho cả kiểm tra trước lẫn gửi đi.
   * Màn hình chỉ có "giá sản phẩm" và danh sách phiên bản; ở đây dựng lại đúng cấu trúc API cần:
   * một tùy chọn (vd Màu sắc) và các phiên bản gắn giá trị của tùy chọn đó.
   */
  function buildPayload(): Record<string, unknown> {
    const filled = versions.filter((version) => version.value.trim());
    const group = groupName.trim() || 'Phiên bản';
    const groupCode = slugifyVi(group) || 'phien-ban';

    // Mã giá trị phải duy nhất: "Đen" và "Đen nhám" lúc gõ dở đều ra mã "den"
    const codes: string[] = [];
    const rows = filled.map((version) => {
      const code = uniqueCode(slugifyVi(version.value) || 'gt', codes);
      codes.push(code);
      return { code, version };
    });

    return {
      ...buildCreateInfo(info),
      options:
        rows.length > 0
          ? [{ code: groupCode, name: group, values: rows.map((row) => ({ code: row.code, value: row.version.value.trim() })) }]
          : [],
      variants:
        rows.length === 0
          ? [
              {
                name: 'Mặc định',
                price: Number(base.price) || 0,
                ...(base.sku.trim() ? { sku: base.sku.trim() } : {}),
                ...(base.compareAtPrice ? { compareAtPrice: Number(base.compareAtPrice) } : {}),
                sortOrder: 0,
              },
            ]
          : rows.map(({ code, version }, index) => {
              const compareAt = version.compareAtPrice || base.compareAtPrice;
              return {
                name: version.value.trim(),
                // Phiên bản bỏ trống giá thì bán theo giá chung của sản phẩm
                price: Number(version.price || base.price) || 0,
                ...(version.sku.trim() ? { sku: version.sku.trim() } : {}),
                ...(compareAt ? { compareAtPrice: Number(compareAt) } : {}),
                optionValues: { [groupCode]: code },
                sortOrder: index,
              };
            }),
    };
  }

  const create = useApiMutation<{ id: string }, Record<string, unknown>>(
    (body) => ({ path: '/catalog/products', method: 'POST', body }),
    {
      invalidate: [['products']],
      onSuccess: (product) => {
        toast.success('Đã tạo sản phẩm. Hãy thêm ảnh trước khi đăng bán.');
        router.push(`/san-pham/${product.id}?tab=media`);
      },
      onError: (error) => {
        const fieldErrors = apiFieldErrors(error);
        if (fieldErrors) {
          setErrors(fieldErrors);
          toast.error('Dữ liệu chưa hợp lệ, xem các ô báo đỏ');
          return;
        }
        toast.error(error.message);
      },
    },
  );

  function submit() {
    // Phiên bản đã thêm thì phải có tên, nếu không website không biết hiện gì cho khách chọn
    const missing = versions.findIndex((version) => !version.value.trim());
    if (missing >= 0) {
      setErrors({ [`versions.${missing}.value`]: 'Nhập tên phiên bản, hoặc xóa dòng này' });
      toast.error('Vui lòng kiểm tra các ô báo đỏ');
      return;
    }

    const payload = buildPayload();

    // Kiểm tra trước bằng chính schema của API
    const parsed = ProductCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(collectFieldErrors(parsed.error.issues));
      toast.error('Vui lòng kiểm tra các ô báo đỏ');
      return;
    }

    setErrors({});
    create.mutate(payload);
  }

  return (
    <>
      <PageHeader
        title="Thêm sản phẩm"
        description="Ảnh sẽ được thêm sau khi lưu"
        actions={
          <Link href="/san-pham">
            <Button variant="outline">
              <ArrowLeft className="size-4" />
              Quay lại
            </Button>
          </Link>
        }
      />

      <div className="max-w-4xl space-y-6">
        <ProductInfoForm mode="create" value={info} onChange={setInfo} errors={errors} />

        <Card>
          <CardHeader>
            <CardTitle>Giá bán</CardTitle>
          </CardHeader>
          <CardContent>
            <VariantBuilder
              basePrice={base.price}
              baseCompareAtPrice={base.compareAtPrice}
              baseSku={base.sku}
              onBaseChange={(patch) => setBase({ ...base, ...patch })}
              groupName={groupName}
              onGroupNameChange={setGroupName}
              versions={versions}
              onVersionsChange={setVersions}
              errors={errors}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pb-8">
          <Link href="/san-pham">
            <Button variant="outline" disabled={create.isPending}>
              Hủy
            </Button>
          </Link>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Đang lưu...' : 'Tạo sản phẩm'}
          </Button>
        </div>
      </div>
    </>
  );
}
