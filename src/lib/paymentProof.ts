import { supabase } from '@/integrations/supabase/client';

function extractPaymentProofPath(url: string): string | null {
  try {
    const marker = '/payment-proofs/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    let path = url.substring(idx + marker.length);
    const q = path.indexOf('?');
    if (q !== -1) path = path.substring(0, q);
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

export async function getPaymentProofSignedUrl(
  storedUrl: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!storedUrl) return null;
  const path = extractPaymentProofPath(storedUrl);
  if (!path) return storedUrl;

  const { data, error } = await supabase.storage
    .from('payment-proofs')
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.warn('Failed to sign payment proof URL:', error?.message);
    return storedUrl;
  }
  return data.signedUrl;
}
