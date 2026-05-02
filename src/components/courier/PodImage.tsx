import { useEffect, useState } from 'react';
import { getPodImageSignedUrl } from '@/lib/podImage';

interface PodImageProps {
  storedUrl: string | null | undefined;
  alt?: string;
  className?: string;
}

/**
 * Image component that resolves a stored POD URL into a fresh signed URL.
 * Use this anywhere a POD image is displayed since the bucket is private.
 */
export function PodImage({ storedUrl, alt = 'Bukti Pengiriman', className }: PodImageProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPodImageSignedUrl(storedUrl).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [storedUrl]);

  if (!src) return null;
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
