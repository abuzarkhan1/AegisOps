import { cn } from "../lib/cn";

export function LoadingSkeleton({ className = "" }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-full bg-white/10", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <LoadingSkeleton className="h-10 w-72" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <LoadingSkeleton key={index} className="h-28" />
        ))}
      </div>
      <LoadingSkeleton className="h-96" />
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <LoadingSkeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export const CardSkeleton = LoadingSkeleton;
export const ChartSkeleton = LoadingSkeleton;
export const DetailDrawerSkeleton = LoadingSkeleton;
