import { ReactNode, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  snapPoints?: number[];
  defaultSnapPoint?: number;
  showHandle?: boolean;
  closeOnOverlayClick?: boolean;
  className?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = [0.5, 0.9],
  defaultSnapPoint = 0,
  showHandle = true,
  closeOnOverlayClick = true,
  className,
}: BottomSheetProps) {
  const [currentSnapPoint, setCurrentSnapPoint] = useState(defaultSnapPoint);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    // Fast swipe down = close
    if (velocity > 500 || offset > 100) {
      onClose();
      return;
    }

    // Snap to nearest point
    const windowHeight = window.innerHeight;
    const currentY = sheetRef.current?.getBoundingClientRect().top || 0;
    const percentFromTop = currentY / windowHeight;

    let nearestIndex = 0;
    let minDistance = Infinity;

    snapPoints.forEach((point, index) => {
      const distance = Math.abs((1 - point) - percentFromTop);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = index;
      }
    });

    setCurrentSnapPoint(nearestIndex);
  };

  const currentHeight = snapPoints[currentSnapPoint] * 100;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={closeOnOverlayClick ? onClose : undefined}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: `${100 - currentHeight}%` }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-2xl',
              'touch-none',
              className
            )}
            style={{ height: `${currentHeight}vh` }}
          >
            {/* Handle */}
            {showHandle && (
              <div 
                className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
              </div>
            )}

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
                <h3 className="font-semibold text-lg">{title}</h3>
                <button
                  onClick={onClose}
                  className="p-2 -mr-2 rounded-full hover:bg-muted transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Simpler version for mobile filters
interface FilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
  title?: string;
  children: ReactNode;
}

export function FilterBottomSheet({
  isOpen,
  onClose,
  onApply,
  onReset,
  title = 'Filter',
  children,
}: FilterBottomSheetProps) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      snapPoints={[0.7, 0.9]}
    >
      <div className="p-4 space-y-4">
        {children}
      </div>

      {/* Fixed Bottom Actions */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4 flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 py-3 px-4 text-center border border-border rounded-xl font-medium hover:bg-muted transition"
        >
          Reset
        </button>
        <button
          onClick={() => {
            onApply();
            onClose();
          }}
          className="flex-1 py-3 px-4 text-center bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition"
        >
          Terapkan
        </button>
      </div>
    </BottomSheet>
  );
}
