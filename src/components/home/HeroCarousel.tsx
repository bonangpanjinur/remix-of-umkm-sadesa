import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import fallback images
import heroVillage from '@/assets/hero-village.jpg';
import villageBojong from '@/assets/village-bojong.jpg';
import villageSukamaju from '@/assets/village-sukamaju.jpg';

export interface BannerSlide {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  linkUrl?: string;
}

interface HeroCarouselProps {
  slides: BannerSlide[];
  autoPlayInterval?: number;
}

const fallbackImages = [heroVillage, villageBojong, villageSukamaju];

export function HeroCarousel({ slides, autoPlayInterval = 5000 }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const slideCount = slides.length;

  const nextSlide = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % slideCount);
  }, [slideCount]);

  const prevSlide = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + slideCount) % slideCount);
  }, [slideCount]);

  const goToSlide = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  // Auto-play
  useEffect(() => {
    if (slideCount <= 1) return;
    
    const interval = setInterval(nextSlide, autoPlayInterval);
    return () => clearInterval(interval);
  }, [nextSlide, autoPlayInterval, slideCount]);

  if (slides.length === 0) {
    return (
      <section className="relative h-44 bg-muted flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No banners available</p>
      </section>
    );
  }

  const currentSlide = slides[currentIndex];
  const slideImage = currentSlide.image || fallbackImages[currentIndex % fallbackImages.length];

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
    }),
  };

  const slideContent = (
    <>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="bg-primary/20 text-primary-foreground text-[9px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
          🌾 Produk Desa Asli
        </span>
      </div>
      <h2 className="text-primary-foreground font-bold text-xl leading-tight max-w-[220px]">
        {currentSlide.title}
      </h2>
      {currentSlide.subtitle && (
        <p className="text-primary-foreground/80 text-xs mt-1.5 max-w-[200px]">
          {currentSlide.subtitle}
        </p>
      )}
      {currentSlide.linkUrl && (
        <span className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-xl mt-3 hover:bg-brand-dark transition shadow-brand">
          Lihat Sekarang
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      )}
    </>
  );

  return (
    <section className="relative h-44 overflow-hidden bg-muted">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          className="absolute inset-0"
        >
          <img
            src={slideImage}
            alt={currentSlide.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/80 via-foreground/50 to-transparent flex items-center">
            <div className="px-5">
              {currentSlide.linkUrl ? (
                <Link to={currentSlide.linkUrl} className="block">
                  {slideContent}
                </Link>
              ) : (
                <div>{slideContent}</div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      {slideCount > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/30 backdrop-blur-sm flex items-center justify-center text-primary-foreground hover:bg-background/50 transition z-10"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/30 backdrop-blur-sm flex items-center justify-center text-primary-foreground hover:bg-background/50 transition z-10"
            aria-label="Next slide"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Dot Indicators */}
      {slideCount > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                index === currentIndex
                  ? "bg-primary-foreground w-4"
                  : "bg-primary-foreground/40 hover:bg-primary-foreground/60"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
