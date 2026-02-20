import { Share2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

interface ShareStoreButtonProps {
  merchantName: string;
  slug?: string | null;
  merchantId: string;
}

export function ShareStoreButton({ merchantName, slug, merchantId }: ShareStoreButtonProps) {
  const [copied, setCopied] = useState(false);

  const getStoreUrl = () => {
    const base = window.location.origin;
    if (slug) return `${base}/s/${slug}`;
    return `${base}/merchant/${merchantId}`;
  };

  const handleShare = async () => {
    const url = getStoreUrl();
    const shareData = {
      title: merchantName,
      text: `Kunjungi toko ${merchantName}`,
      url,
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  const handleCopy = async () => {
    const url = getStoreUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: 'Link disalin!', description: url });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Gagal menyalin', variant: 'destructive' });
    }
  };

  return (
    <button
      onClick={handleShare}
      className="w-10 h-10 bg-foreground/20 backdrop-blur rounded-full flex items-center justify-center text-primary-foreground hover:bg-foreground/40 transition border border-primary-foreground/20"
    >
      {copied ? <Check className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
    </button>
  );
}
