import { LoadingRows } from '@/components/data-states';
import { Skeleton } from '@ktm/ui/components/skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <LoadingRows rows={6} />
    </div>
  );
}
