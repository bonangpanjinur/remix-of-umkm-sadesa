import { supabase } from '@/integrations/supabase/client';

function extractPath(url: string): string | null {
  try {
    const marker = '/pod-images/';
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

export async function getPodImageSignedUrl(
  storedUrl: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!storedUrl) return null;
  const path = extractPath(storedUrl);
  if (!path) return storedUrl;
  const { data, error } = await supabase.storage
    .from('pod-images')
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    console.warn('Failed to sign POD image URL:', error?.message);
    return null;
  }
  return data.signedUrl;
}
