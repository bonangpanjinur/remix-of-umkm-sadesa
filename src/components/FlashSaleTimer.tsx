import { useState, useEffect, useMemo } from 'react';
import { Zap, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FlashSaleTimerProps {
  endTime: string | Date;
  onEnd?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calculateTimeLeft(endTime: Date): TimeLeft {
  const total = endTime.getTime() - Date.now();
  
  if (total <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  return {
    hours: Math.floor(total / (1000 * 60 * 60)),
    minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((total % (1000 * 60)) / 1000),
    total,
  };
}

export function FlashSaleTimer({
  endTime,
  onEnd,
  size = 'md',
  showIcon = true,
  className,
}: FlashSaleTimerProps) {
  const endDate = useMemo(() => new Date(endTime), [endTime]);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(endDate));

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(endDate);
      setTimeLeft(newTimeLeft);

      if (newTimeLeft.total <= 0) {
        clearInterval(timer);
        onEnd?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate, onEnd]);

  const isEnding = timeLeft.total > 0 && timeLeft.total < 5 * 60 * 1000; // < 5 minutes
  const isExpired = timeLeft.total <= 0;

  const sizeClasses = {
    sm: {
      container: 'text-xs gap-1',
      box: 'w-6 h-6 text-xs',
      icon: 'h-3 w-3',
    },
    md: {
      container: 'text-sm gap-1.5',
      box: 'w-8 h-8 text-sm',
      icon: 'h-4 w-4',
    },
    lg: {
      container: 'text-base gap-2',
      box: 'w-10 h-10 text-base',
      icon: 'h-5 w-5',
    },
  };

  const sizes = sizeClasses[size];

  if (isExpired) {
    return (
      <div className={cn('flex items-center gap-1 text-muted-foreground', sizes.container, className)}>
        <Clock className={sizes.icon} />
        <span>Berakhir</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center',
        sizes.container,
        isEnding && 'text-destructive',
        className
      )}
    >
      {showIcon && (
        <Zap className={cn(sizes.icon, 'text-amber-500', isEnding && 'animate-pulse')} />
      )}

      <div className="flex items-center gap-0.5">
        <TimeBox value={timeLeft.hours} size={size} isEnding={isEnding} />
        <span className="font-bold">:</span>
        <TimeBox value={timeLeft.minutes} size={size} isEnding={isEnding} />
        <span className="font-bold">:</span>
        <TimeBox value={timeLeft.seconds} size={size} isEnding={isEnding} animate />
      </div>
    </div>
  );
}

function TimeBox({
  value,
  size,
  isEnding,
  animate = false,
}: {
  value: number;
  size: 'sm' | 'md' | 'lg';
  isEnding?: boolean;
  animate?: boolean;
}) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded font-bold',
        'bg-primary/10 text-primary',
        isEnding && 'bg-destructive/10 text-destructive',
        sizeClasses[size]
      )}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={value}
          initial={animate ? { y: -10, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          exit={animate ? { y: 10, opacity: 0 } : undefined}
          transition={{ duration: 0.15 }}
        >
          {String(value).padStart(2, '0')}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

// Compact version for product cards
export function FlashSaleBadge({
  endTime,
  discountPercent,
  className,
}: {
  endTime: string | Date;
  discountPercent: number;
  className?: string;
}) {
  const endDate = useMemo(() => new Date(endTime), [endTime]);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(endDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(endDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [endDate]);

  if (timeLeft.total <= 0) return null;

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <div className="flex items-center gap-1 bg-destructive text-destructive-foreground px-2 py-0.5 rounded text-[10px] font-bold">
        <Zap className="h-3 w-3" />
        <span>-{discountPercent}%</span>
      </div>
      <div className="text-[9px] text-muted-foreground flex items-center gap-0.5">
        <Clock className="h-2.5 w-2.5" />
        <span>
          {String(timeLeft.hours).padStart(2, '0')}:
          {String(timeLeft.minutes).padStart(2, '0')}:
          {String(timeLeft.seconds).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
