import { useCallback, useEffect, useState } from 'react';
import { ImageOff, RefreshCw } from 'lucide-react';
import { getPodImageSignedUrl } from '@/lib/podImage';
import { cn } from '@/lib/utils';

interface PodImageProps {
  storedUrl: string | null | undefined;
  alt?: string;
  className?: string;
}

type Status = 'loading' | 'ready' | 'missing' | 'error';

/**
 * Image component that resolves a stored POD URL into a fresh signed URL.
 * - loading  → skeleton
 * - missing  → "Gambar tidak tersedia" (storedUrl null/empty)
 * - error    → "Gagal memuat, coba lagi" with retry button (signing failed)
 * - ready    → <img>
 */
export function PodImage({ storedUrl, alt = 'Bukti Pengiriman', className }: PodImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!storedUrl) {
      setStatus('missing');
      setSrc(null);
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
  }, [storedUrl, attempt]);

  if (status === 'loading') {
    return (
      <div
        className={cn('bg-muted animate-pulse rounded-md', className)}
        aria-label="Memuat gambar"
        role="status"
      />
    );
  }

  if (status === 'missing') {
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

  if (status === 'error') {
    return (
      <div
        className={cn(
          'bg-muted rounded-md flex flex-col items-center justify-center text-muted-foreground gap-2 p-2',
          className,
        )}
        role="alert"
      >
        <RefreshCw className="h-5 w-5" />
        <span className="text-xs text-center">Gagal memuat, coba lagi</span>
        <button
          type="button"
          onClick={retry}
          className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline"
        >
          Muat ulang
        </button>
      </div>
    );
  }

  return <img src={src!} alt={alt} className={className} loading="lazy" />;
}
