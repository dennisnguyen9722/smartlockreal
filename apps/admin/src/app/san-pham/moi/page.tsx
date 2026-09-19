'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { ProductCreateSchema, type HighlightGroup, type Paginated } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { HighlightEditor } from '@/components/highlight-editor';
import { PageHeader } from '@/components/page-header';
import { SlugField } from '@/components/slug-field';
import { SpecInputs, type SpecShape } from '@/components/spec-inputs';
import { VariantBuilder, type OptionDraft, type VariantDraft } from '@/components/variant-builder';
import { ApiError } from '@/lib/api';
import { useApiMutation, useApiQuery } from '@/lib/hooks';
import { PRODUCT_TYPE_LABEL } from '@/lib/format';

interface BrandOption {
  id: string;
  name: string;
}
interface CategoryNode {
  id: string;
  name: string;
  children: CategoryNode[];
}

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

  const [type, setType] = useState('LOCK');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [manufacturerCode, setManufacturerCode] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('24');
  const [shortDescription, setShortDescription] = useState('');
  const [specs, setSpecs] = useState<Record<string, unknown>>({});
  const [highlights, setHighlights] = useState<HighlightGroup[]>([]);
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([EMPTY_VARIANT]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const brands = useApiQuery<Paginated<BrandOption>>(['brands', 'options'], '/catalog/brands?pageSize=100');
  const categories = useApiQuery<CategoryNode[]>(['categories', 'tree'], '/catalog/categories/tree');

  // Khuôn thông số tải lại mỗi khi đổi danh mục
  const shapes = useApiQuery<SpecShape[]>(
    ['specs', categoryId, 'shapes'],
    `/catalog/categories/${categoryId}/specs/shapes`,
    { enabled: Boolean(categoryId) },
  );

  // Đổi danh mục thì bỏ các thông số không còn thuộc danh mục mới
  useEffect(() => {
    if (!shapes.data) return;
    const allowed = new Set(shapes.data.map((shape) => shape.code));
    setSpecs((current) => {
      const next: Record<string, unknown> = {};
      for (const [code, value] of Object.entries(current)) {
        if (allowed.has(code)) next[code] = value;
      }
      return next;
    });
  }, [shapes.data]);

  const flatCategories: { id: string; name: string; depth: number }[] = [];
  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const node of nodes) {
      flatCategories.push({ id: node.id, name: node.name, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(categories.data ?? [], 0);

  /** Bỏ nhóm trống và dòng trống trước khi gửi */
  function cleanHighlights(): HighlightGroup[] {
    return highlights
      .map((group) => ({
        title: group.title.trim(),
        items: group.items.map((item) => item.trim()).filter(Boolean),
      }))
      .filter((group) => group.title && group.items.length > 0);
  }

  const create = useApiMutation<{ id: string }, void>(
    () => {
      const body: Record<string, unknown> = {
        type,
        name: name.trim(),
        categoryId,
        specs,
        highlights: cleanHighlights(),
        warrantyMonths: Number(warrantyMonths) || 0,
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
      if (slug.trim()) body.slug = slug.trim();
      if (brandId) body.brandId = brandId;
      if (manufacturerCode.trim()) body.manufacturerCode = manufacturerCode.trim();
      if (shortDescription.trim()) body.shortDescription = shortDescription.trim();

      return { path: '/catalog/products', method: 'POST', body };
    },
    {
      invalidate: [['products']],
      onSuccess: (product) => {
        toast.success('Đã tạo sản phẩm');
        router.push(`/san-pham/${product.id}`);
      },
      onError: (error) => {
        if (error instanceof ApiError && Array.isArray(error.details)) {
          const next: Record<string, string> = {};
          for (const item of error.details as { field: string; message: string }[]) {
            next[item.field] = item.message;
          }
          setErrors(next);
          toast.error('Dữ liệu chưa hợp lệ, xem các ô báo đỏ');
          return;
        }
        toast.error(error.message);
      },
    },
  );

  function submit() {
    // Kiểm tra trước bằng chính schema của API
    const payload = {
      type,
      name: name.trim(),
      categoryId: categoryId || undefined,
      ...(brandId ? { brandId } : {}),
      specs,
      highlights: cleanHighlights(),
      options: options
        .filter((option) => option.code && option.values.some((value) => value.code))
        .map((option) => ({
          code: option.code,
          name: option.name.trim(),
          values: option.values.filter((value) => value.code),
        })),
      variants: variants.map((variant) => ({
        name: variant.name.trim(),
        price: Number(variant.price) || 0,
        ...(variant.compareAtPrice ? { compareAtPrice: Number(variant.compareAtPrice) } : {}),
        ...(Object.keys(variant.optionValues).length > 0 ? { optionValues: variant.optionValues } : {}),
      })),
    };

    const parsed = ProductCreateSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        // Gom lỗi của biến thể về một dòng cho dễ đọc
        next[path.startsWith('variants') ? 'variants' : path.startsWith('highlights') ? 'highlights' : path] =
          issue.message;
      }
      setErrors(next);
      toast.error('Vui lòng kiểm tra các ô báo đỏ');
      return;
    }

    setErrors({});
    create.mutate();
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
        <Card>
          <CardHeader>
            <CardTitle>1. Thông tin chung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Loại sản phẩm *</Label>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {Object.entries(PRODUCT_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Hãng {type === 'LOCK' && <span className="text-destructive">*</span>}</Label>
                <select
                  value={brandId}
                  onChange={(event) => setBrandId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">— Chưa chọn —</option>
                  {(brands.data?.items ?? []).map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
                {errors.brandId && <p className="text-xs text-destructive">{errors.brandId}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tên sản phẩm *</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Khóa vân tay Samsung SHP-DP609"
                autoFocus
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <SlugField name={name} value={slug} onChange={setSlug} isEditing={false} error={errors.slug} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Danh mục *</Label>
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">— Chưa chọn —</option>
                  {flatCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {'\u00A0\u00A0'.repeat(category.depth)}
                      {category.depth > 0 ? '└ ' : ''}
                      {category.name}
                    </option>
                  ))}
                </select>
                {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Mã model của hãng</Label>
                <Input
                  value={manufacturerCode}
                  onChange={(event) => setManufacturerCode(event.target.value)}
                  placeholder="SHP-DP609"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Bảo hành (tháng)</Label>
                <Input
                  type="number"
                  value={warrantyMonths}
                  onChange={(event) => setWarrantyMonths(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Mô tả ngắn</Label>
              <textarea
                value={shortDescription}
                onChange={(event) => setShortDescription(event.target.value)}
                rows={2}
                placeholder="Hiển thị ở danh sách sản phẩm trên website"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Thông số kỹ thuật</CardTitle>
          </CardHeader>
          <CardContent>
            {!categoryId ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Chọn danh mục ở phần trên để hiện các thông số tương ứng.
              </p>
            ) : shapes.isPending ? (
              <p className="text-sm text-muted-foreground">Đang tải thông số...</p>
            ) : (
              <SpecInputs shapes={shapes.data ?? []} values={specs} onChange={setSpecs} errors={errors} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Điểm nổi bật</CardTitle>
          </CardHeader>
          <CardContent>
            <HighlightEditor value={highlights} onChange={setHighlights} error={errors.highlights} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Tùy chọn và biến thể</CardTitle>
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
