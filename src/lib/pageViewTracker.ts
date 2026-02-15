import { supabase } from '@/integrations/supabase/client';

let trackedPages = new Set<string>();

export async function trackPageView(options: {
  merchantId?: string;
  productId?: string;
  pageType: 'store' | 'product';
}) {
  const key = `${options.pageType}-${options.merchantId || ''}-${options.productId || ''}`;
  
  // Prevent duplicate tracking in same session
  if (trackedPages.has(key)) return;
  trackedPages.add(key);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('page_views').insert({
      merchant_id: options.merchantId || null,
      product_id: options.productId || null,
      viewer_id: user?.id || null,
      page_type: options.pageType,
    });
  } catch (error) {
    // Silent fail - don't interrupt user experience
    console.error('Page view tracking error:', error);
  }
}
