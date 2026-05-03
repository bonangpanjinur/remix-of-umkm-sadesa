import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { getPodImageSignedUrl } from '@/lib/podImage';
import { cn } from '@/lib/utils';

interface PodImageProps {
  storedUrl: string | null | undefined;
  alt?: string;
  className?: string;
}

/**
 * Image component that resolves a stored POD URL into a fresh signed URL.
 * Shows a skeleton while loading and a fallback icon if it fails.
 */
export function PodImage({ storedUrl, alt = 'Bukti Pengiriman', className }: PodImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    if (!storedUrl) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    getPodImageSignedUrl(storedUrl)
      .then((url) => {
        if (cancelled) return;
        if (url) {
          setSrc(url);
          setStatus('ready');
        } else {
          setStatus('error');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [storedUrl]);

  if (status === 'loading') {
    return <div className={cn('bg-muted animate-pulse rounded-md', className)} aria-label="Memuat gambar" />;
  }

  if (status === 'error' || !src) {
    return (
      <div
        className={cn(
          'bg-muted rounded-md flex flex-col items-center justify-center text-muted-foreground gap-1 p-2',
          className,
        )}
        role="img"
        aria-label={`${alt} tidak tersedia`}
      >
        <ImageOff className="h-6 w-6" />
        <span className="text-xs">Gambar tidak tersedia</span>
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
