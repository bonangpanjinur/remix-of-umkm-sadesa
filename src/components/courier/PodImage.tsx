import { useCallback, useEffect, useState } from 'react';
import { ImageOff, RefreshCw } from 'lucide-react';
import { getPodImageSignedUrl } from '@/lib/podImage';
import { useTranslation } from '@/lib/i18n';
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
 * - missing  → "Image not available" (storedUrl null/empty)
 * - error    → "Failed to load, try again" with retry button (signing failed)
 * - ready    → <img>
 *
 * All user-facing copy is i18n-aware via useTranslation().
 */
export function PodImage({ storedUrl, alt, className }: PodImageProps) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);

  const resolvedAlt = alt ?? t('pod.alt' as never) ?? 'Bukti Pengiriman';
  // 'pod.alt' is optional; fall back gracefully.
  const safeAlt = typeof resolvedAlt === 'string' && resolvedAlt !== 'pod.alt' ? resolvedAlt : alt ?? 'Bukti Pengiriman';

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
        aria-label={t('pod.loading')}
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
        aria-label={`${safeAlt} — ${t('pod.unavailable')}`}
      >
        <ImageOff className="h-6 w-6" />
        <span className="text-xs">{t('pod.unavailable')}</span>
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
        <span className="text-xs text-center">{t('pod.loadFailed')}</span>
        <button
          type="button"
          onClick={retry}
          className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline"
        >
          {t('pod.retry')}
        </button>
      </div>
    );
  }

  return <img src={src!} alt={safeAlt} className={className} loading="lazy" />;
}
