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
import { VariantBuilder, type OptionDraft, type VariantDraft } from '@/components/variant-builder';
import { useApiMutation } from '@/lib/hooks';
import {
  apiFieldErrors,
  buildCreateInfo,
  collectFieldErrors,
  EMPTY_INFO_DRAFT,
  type ProductInfoDraft,
} from '@/lib/product-form';

const EMPTY_VARIANT: VariantDraft = {
  key: '',
  optionValues: {},
  name: 'Mặc định',
  sku: '',
  price: '',
  compareAtPrice: '',
};

export default function NewProductPage() {
  const router = useRouter();

  const [info, setInfo] = useState<ProductInfoDraft>(EMPTY_INFO_DRAFT);
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([EMPTY_VARIANT]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /** Payload đầy đủ; dùng cho cả kiểm tra trước lẫn gửi đi */
  function buildPayload(): Record<string, unknown> {
    return {
      ...buildCreateInfo(info),
      options: options
        .filter((option) => option.code && option.values.some((value) => value.code))
        .map((option) => ({
          code: option.code,
          name: option.name.trim(),
          values: option.values.filter((value) => value.code),
        })),
      variants: variants.map((variant, index) => ({
        name: variant.name.trim(),
        price: Number(variant.price) || 0,
        ...(variant.sku.trim() ? { sku: variant.sku.trim() } : {}),
        ...(variant.compareAtPrice ? { compareAtPrice: Number(variant.compareAtPrice) } : {}),
        ...(Object.keys(variant.optionValues).length > 0 ? { optionValues: variant.optionValues } : {}),
        sortOrder: index,
      })),
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
            <CardTitle>Tùy chọn và biến thể</CardTitle>
          </CardHeader>
          <CardContent>
            <VariantBuilder
              options={options}
              variants={variants}
              onOptionsChange={setOptions}
              onVariantsChange={(next) => setVariants(next.length > 0 ? next : [EMPTY_VARIANT])}
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