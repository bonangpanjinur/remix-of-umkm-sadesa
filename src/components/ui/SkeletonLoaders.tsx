import { cn } from '@/lib/utils';
import { CSSProperties } from 'react';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function SkeletonBox({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className
      )}
      style={style}
    />
  );
}

// Product Card Skeleton
export function ProductCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <SkeletonBox className="h-32 w-full" />
      <div className="p-2.5 space-y-2">
        <SkeletonBox className="h-3 w-20" />
        <SkeletonBox className="h-4 w-full" />
        <div className="flex justify-between items-center">
          <SkeletonBox className="h-4 w-16" />
          <SkeletonBox className="h-6 w-6 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Merchant Card Skeleton
export function MerchantCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex gap-3">
        <SkeletonBox className="h-16 w-16 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonBox className="h-5 w-3/4" />
          <SkeletonBox className="h-3 w-1/2" />
          <div className="flex gap-2">
            <SkeletonBox className="h-5 w-12 rounded-full" />
            <SkeletonBox className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Order Card Skeleton
export function OrderCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex justify-between">
        <SkeletonBox className="h-4 w-24" />
        <SkeletonBox className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex gap-3">
        <SkeletonBox className="h-12 w-12 rounded-lg" />
        <div className="flex-1 space-y-2">
          <SkeletonBox className="h-4 w-full" />
          <SkeletonBox className="h-3 w-1/2" />
        </div>
      </div>
      <div className="flex justify-between pt-2 border-t border-border">
        <SkeletonBox className="h-4 w-20" />
        <SkeletonBox className="h-4 w-24" />
      </div>
    </div>
  );
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <SkeletonBox className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// Stats Card Skeleton
export function StatsCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-3">
        <SkeletonBox className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonBox className="h-3 w-20" />
          <SkeletonBox className="h-6 w-16" />
        </div>
      </div>
    </div>
  );
}

// Profile Skeleton
export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <SkeletonBox className="h-20 w-20 rounded-full" />
        <div className="space-y-2">
          <SkeletonBox className="h-6 w-32" />
          <SkeletonBox className="h-4 w-48" />
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonBox className="h-4 w-20" />
            <SkeletonBox className="h-10 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

// List Skeleton
export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
          <SkeletonBox className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <SkeletonBox className="h-4 w-3/4" />
            <SkeletonBox className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Form Skeleton
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonBox className="h-4 w-24" />
          <SkeletonBox className="h-10 w-full rounded-md" />
        </div>
      ))}
      <SkeletonBox className="h-10 w-full rounded-md mt-6" />
    </div>
  );
}

// Chart Skeleton
export function ChartSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <SkeletonBox className="h-5 w-32 mb-4" />
      <div className="h-64 flex items-end gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div 
            key={i} 
            className="flex-1 bg-muted animate-pulse rounded-t"
            style={{ height: `${Math.random() * 60 + 40}%` }} 
          />
        ))}
      </div>
    </div>
  );
}

// Grid Skeleton
export function GridSkeleton({ count = 6, columns = 2 }: { count?: number; columns?: number }) {
  return (
    <div 
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
