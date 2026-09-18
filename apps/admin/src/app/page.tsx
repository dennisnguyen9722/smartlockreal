'use client';

import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';

export default function DashboardPage() {
  const { staff } = useAuth();

  return (
    <>
      <PageHeader title="Tổng quan" description={`Xin chào ${staff?.fullName ?? ''}`} />
      <Card>
        <CardHeader>
          <CardTitle>Hệ thống đang được xây dựng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Các màn hình sẽ được hoàn thiện dần theo thứ tự: sản phẩm, kho, đơn hàng, báo giá, dịch vụ.</p>
          <p>Bạn dùng menu bên trái để di chuyển giữa các phần.</p>
        </CardContent>
      </Card>
    </>
  );
}
