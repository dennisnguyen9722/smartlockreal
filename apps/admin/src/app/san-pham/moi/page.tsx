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

/** Giá của sản phẩm; phiên bản nào không nhập giá riêng thì dùng các giá trị này */
interface BasePrice {
  price: string;
  compareAtPrice: string;
  sku: string;
}

const EMPTY_BASE: BasePrice = { price: '', compareAtPrice: '', sku: '' };

export default function NewProductPage() {
  const router = useRouter();

  const [info, setInfo] = useState<ProductInfoDraft>(EMPTY_INFO_DRAFT);
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [base, setBase] = useState<BasePrice>(EMPTY_BASE);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
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
      // Không có tùy chọn: một phiên bản "Mặc định" giữ giá của sản phẩm.
      // Có tùy chọn: phiên bản bỏ trống giá thì lấy giá chung, nhập riêng thì dùng giá riêng.
      variants:
        variants.length === 0
          ? [
              {
                name: 'Mặc định',
                price: Number(base.price) || 0,
                ...(base.sku.trim() ? { sku: base.sku.trim() } : {}),
                ...(base.compareAtPrice ? { compareAtPrice: Number(base.compareAtPrice) } : {}),
                sortOrder: 0,
              },
            ]
          : variants.map((variant, index) => {
              const compareAt = variant.compareAtPrice || base.compareAtPrice;
              return {
                name: variant.name.trim(),
                price: Number(variant.price || base.price) || 0,
                ...(variant.sku.trim() ? { sku: variant.sku.trim() } : {}),
                ...(compareAt ? { compareAtPrice: Number(compareAt) } : {}),
                ...(Object.keys(variant.optionValues).length > 0 ? { optionValues: variant.optionValues } : {}),
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
              options={options}
              variants={variants}
              onOptionsChange={setOptions}
              onVariantsChange={setVariants}
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
