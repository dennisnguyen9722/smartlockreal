'use client';

import { ExternalLink, MapPin } from 'lucide-react';
import { directionsUrl, mapEmbedUrl, parseCoordinates, showroomPath } from '@ktm/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { OpeningHoursEditor } from '@/components/showroom/opening-hours-editor';
import { ShowroomImages } from '@/components/showroom/showroom-images';
import { SlugField } from '@/components/slug-field';
import { useApiQuery } from '@/lib/hooks';
import type { ShowroomDraft } from '@/lib/showroom-form';

interface GeoUnit {
    code: string;
    name: string;
}

const SELECT = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50 aria-invalid:border-destructive';
const TEXTAREA = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm';

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

/** Form showroom dùng chung cho trang tạo mới và trang chi tiết */
export function ShowroomForm({
    mode,
    value,
    onChange,
    errors,
    disabled,
}: {
    mode: 'create' | 'edit';
    value: ShowroomDraft;
    onChange: (next: ShowroomDraft) => void;
    errors: Record<string, string>;
    disabled?: boolean;
}) {
    const set = <K extends keyof ShowroomDraft>(key: K, next: ShowroomDraft[K]) => onChange({ ...value, [key]: next });

    const provinces = useApiQuery<GeoUnit[]>(['geo', 'provinces'], '/geo/provinces', { staleTime: Infinity });
    const wards = useApiQuery<GeoUnit[]>(['geo', 'wards', value.provinceCode], `/geo/provinces/${value.provinceCode}/wards`, {
        enabled: Boolean(value.provinceCode),
        staleTime: Infinity,
    });

    const coordinates = parseCoordinates(value.coordinates);
    const shortLink = /maps\.app\.goo\.gl|goo\.gl\/maps/.test(value.coordinates);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Thông tin chung</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Tên showroom *</Label>
                        <Input
                            value={value.name}
                            onChange={(event) => set('name', event.target.value)}
                            placeholder="Showroom Khóa Thông Minh Quận 1"
                            autoFocus={mode === 'create'}
                            aria-invalid={Boolean(errors.name) || undefined}
                        />
                        <FieldError message={errors.name} />
                    </div>

                    <SlugField name={value.name} value={value.slug} onChange={(slug) => set('slug', slug)} isEditing={mode === 'edit'} error={errors.slug} />
                    {value.slug && (
                        <p className="-mt-2 text-xs text-muted-foreground">Trang trên website: {showroomPath(value.slug)}</p>
                    )}

                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label>Số điện thoại</Label>
                            <Input value={value.phone} onChange={(event) => set('phone', event.target.value)} placeholder="028 3822 1234" inputMode="tel" />
                            <FieldError message={errors.phone} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Email</Label>
                            <Input type="email" value={value.email} onChange={(event) => set('email', event.target.value)} />
                            <FieldError message={errors.email} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Thứ tự hiển thị</Label>
                            <Input inputMode="numeric" value={value.sortOrder} onChange={(event) => set('sortOrder', event.target.value)} />
                            {errors.sortOrder ? <FieldError message={errors.sortOrder} /> : <p className="text-xs text-muted-foreground">Số nhỏ hiện trước</p>}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Giới thiệu</Label>
                        <textarea
                            value={value.description}
                            onChange={(event) => set('description', event.target.value)}
                            rows={4}
                            placeholder="Không gian trưng bày, dòng khóa có sẵn để trải nghiệm, chỗ đậu xe..."
                            className={TEXTAREA}
                        />
                        <FieldError message={errors.description} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Địa chỉ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Tỉnh/Thành phố *</Label>
                            <select
                                value={value.provinceCode}
                                onChange={(event) => onChange({ ...value, provinceCode: event.target.value, wardCode: '' })}
                                className={SELECT}
                                aria-invalid={Boolean(errors.provinceCode) || undefined}
                            >
                                <option value="">— Chọn tỉnh/thành phố —</option>
                                {(provinces.data ?? []).map((item) => (
                                    <option key={item.code} value={item.code}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                            {errors.provinceCode ? (
                                <FieldError message={errors.provinceCode} />
                            ) : (
                                <p className="text-xs text-muted-foreground">Hiện hỗ trợ showroom ở TP. Hồ Chí Minh và Hà Nội</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Phường/Xã *</Label>
                            <select
                                value={value.wardCode}
                                onChange={(event) => set('wardCode', event.target.value)}
                                disabled={!value.provinceCode || wards.isPending}
                                className={SELECT}
                                aria-invalid={Boolean(errors.wardCode) || undefined}
                            >
                                <option value="">{value.provinceCode ? '— Chọn phường/xã —' : 'Chọn tỉnh trước'}</option>
                                {(wards.data ?? []).map((item) => (
                                    <option key={item.code} value={item.code}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                            <FieldError message={errors.wardCode} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Số nhà, tên đường *</Label>
                        <Input value={value.street} onChange={(event) => set('street', event.target.value)} placeholder="123 Nguyễn Văn Linh" />
                        <FieldError message={errors.street} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Bản đồ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Tọa độ</Label>
                        <Input
                            value={value.coordinates}
                            onChange={(event) => set('coordinates', event.target.value)}
                            placeholder="10.7769, 106.7009"
                            aria-invalid={Boolean(errors.coordinates) || undefined}
                        />
                        {errors.coordinates ? (
                            <FieldError message={errors.coordinates} />
                        ) : shortLink ? (
                            <p className="text-xs text-amber-600">
                                Link rút gọn không đọc được tọa độ. Mở link đó trên máy tính rồi chép lại link đầy đủ trên thanh địa chỉ, hoặc
                                chép dòng tọa độ như hướng dẫn dưới.
                            </p>
                        ) : value.coordinates && !coordinates ? (
                            <p className="text-xs text-amber-600">Chưa đọc được tọa độ từ nội dung vừa dán</p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Trên Google Maps: bấm chuột phải vào đúng vị trí showroom, bấm dòng số đầu tiên (vd 10.7769, 106.7009) để sao
                                chép, rồi dán vào đây. Dán link Google Maps đầy đủ cũng được.
                            </p>
                        )}
                    </div>

                    {coordinates ? (
                        <div className="space-y-2">
                            <iframe
                                title="Bản đồ showroom"
                                src={mapEmbedUrl(coordinates)}
                                className="h-64 w-full rounded-lg border"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                            <a
                                href={directionsUrl(coordinates)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                                <ExternalLink className="size-3" />
                                Mở chỉ đường để kiểm tra vị trí
                            </a>
                        </div>
                    ) : (
                        <div className="flex h-32 items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground">
                            <MapPin className="size-4" />
                            Nhập tọa độ để xem bản đồ
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>Link Google Maps của showroom</Label>
                        <Input
                            value={value.googleMapsUrl}
                            onChange={(event) => set('googleMapsUrl', event.target.value)}
                            placeholder="https://maps.app.goo.gl/..."
                        />
                        {errors.googleMapsUrl ? (
                            <FieldError message={errors.googleMapsUrl} />
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Không bắt buộc. Nếu showroom đã có trang trên Google Maps (có đánh giá của khách), dán link đó để website dẫn
                                về đúng trang.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Giờ mở cửa</CardTitle>
                </CardHeader>
                <CardContent>
                    <OpeningHoursEditor value={value.hours} onChange={(hours) => set('hours', hours)} error={errors.hours} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Ảnh showroom</CardTitle>
                </CardHeader>
                <CardContent>
                    <ShowroomImages value={value.imageUrls} onChange={(urls) => set('imageUrls', urls)} disabled={disabled} error={errors.imageUrls} />
                </CardContent>
            </Card>
        </div>
    );
}