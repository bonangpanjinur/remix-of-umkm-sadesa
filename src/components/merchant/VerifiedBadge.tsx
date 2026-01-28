import { BadgeCheck, Shield, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type BadgeType = 'verified' | 'popular' | 'new';
type BadgeSize = 'sm' | 'md' | 'lg';

interface VerifiedBadgeProps {
  type?: BadgeType;
  size?: BadgeSize;
  showLabel?: boolean;
  className?: string;
}

const badgeConfig: Record<BadgeType, {
  icon: typeof BadgeCheck;
  label: string;
  description: string;
  bgClass: string;
  textClass: string;
  iconClass: string;
}> = {
  verified: {
    icon: BadgeCheck,
    label: 'Terverifikasi',
    description: 'Toko ini telah diverifikasi oleh tim kami',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-400',
    iconClass: 'text-blue-500',
  },
  popular: {
    icon: Award,
    label: 'Populer',
    description: 'Toko dengan penjualan dan rating tinggi',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-700 dark:text-amber-400',
    iconClass: 'text-amber-500',
  },
  new: {
    icon: Shield,
    label: 'Baru',
    description: 'Toko baru bergabung',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    textClass: 'text-green-700 dark:text-green-400',
    iconClass: 'text-green-500',
  },
};

const sizeConfig: Record<BadgeSize, {
  iconSize: string;
  padding: string;
  textSize: string;
}> = {
  sm: {
    iconSize: 'h-3 w-3',
    padding: 'px-1.5 py-0.5',
    textSize: 'text-[10px]',
  },
  md: {
    iconSize: 'h-4 w-4',
    padding: 'px-2 py-1',
    textSize: 'text-xs',
  },
  lg: {
    iconSize: 'h-5 w-5',
    padding: 'px-3 py-1.5',
    textSize: 'text-sm',
  },
};

export function VerifiedBadge({
  type = 'verified',
  size = 'md',
  showLabel = true,
  className,
}: VerifiedBadgeProps) {
  const config = badgeConfig[type];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  const badge = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        config.bgClass,
        config.textClass,
        sizes.padding,
        sizes.textSize,
        className
      )}
    >
      <Icon className={cn(sizes.iconSize, config.iconClass)} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );

  if (!showLabel) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}

// Icon only version for tight spaces
export function VerifiedIcon({
  size = 'md',
  className,
}: {
  size?: BadgeSize;
  className?: string;
}) {
  const sizes = sizeConfig[size];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <BadgeCheck className={cn(sizes.iconSize, 'text-blue-500', className)} />
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">Toko Terverifikasi</p>
        <p className="text-xs text-muted-foreground">
          Toko ini telah diverifikasi oleh tim kami
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

// Inline version for use next to merchant name
export function MerchantVerificationStatus({
  isVerified,
  badge,
  className,
}: {
  isVerified?: boolean;
  badge?: 'VERIFIED' | 'POPULAR' | 'NEW' | null;
  className?: string;
}) {
  const badgeType = badge?.toLowerCase() as BadgeType | undefined;

  if (isVerified) {
    return <VerifiedBadge type="verified" size="sm" showLabel={false} className={className} />;
  }

  if (badgeType && badgeConfig[badgeType]) {
    return <VerifiedBadge type={badgeType} size="sm" showLabel={false} className={className} />;
  }

  return null;
}
