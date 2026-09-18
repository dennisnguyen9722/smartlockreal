import Link from 'next/link';
import { KeyRound, SearchX } from 'lucide-react';
import { Button } from '@ktm/ui/components/button';

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
        <KeyRound className="size-6" />
        Khóa Thông Minh Chính Hãng
      </Link>

      <div className="flex flex-col items-center gap-3">
        <SearchX className="size-12 text-muted-foreground" />
        <p className="text-3xl font-bold tracking-tight">404</p>
        <p className="max-w-md text-muted-foreground">
          Không tìm thấy trang này. Có thể trang chưa được xây dựng, hoặc đường dẫn đã thay đổi.
        </p>
      </div>

      <Link href="/">
        <Button>Về trang tổng quan</Button>
      </Link>
    </div>
  );
}
