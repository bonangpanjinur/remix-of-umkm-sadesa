import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const SEO = () => {
  const location = useLocation();

  useEffect(() => {
    const updateSEO = async () => {
      try {
        const path = location.pathname;
        
        // Fetch SEO settings for current path
        const { data, error } = await supabase
          .from('seo_settings')
          .select('*')
          .eq('page_path', path)
          .maybeSingle();

        if (error || !data) {
          // If no specific settings, we could either do nothing or use defaults
          // For now, let's not override if not found to keep index.html defaults
          return;
        }

        // Update Title
        if (data.title) {
          document.title = data.title;
        }

        // Update Meta Tags
        const updateMeta = (name: string, content: string | null, isProperty = false) => {
          if (!content) return;
          let element = isProperty 
            ? document.querySelector(`meta[property="${name}"]`)
            : document.querySelector(`meta[name="${name}"]`);
          
          if (!element) {
            element = document.createElement('meta');
            if (isProperty) {
              element.setAttribute('property', name);
            } else {
              element.setAttribute('name', name);
            }
            document.head.appendChild(element);
          }
          element.setAttribute('content', content);
        };

        updateMeta('description', data.description);
        updateMeta('keywords', data.keywords);
        updateMeta('robots', data.robots);
        updateMeta('og:title', data.og_title || data.title, true);
        updateMeta('og:description', data.og_description || data.description, true);
        updateMeta('og:image', data.og_image, true);
        updateMeta('twitter:title', data.og_title || data.title);
        updateMeta('twitter:description', data.og_description || data.description);
        updateMeta('twitter:image', data.og_image);

        // Update Canonical
        if (data.canonical_url) {
          let canonical = document.querySelector('link[rel="canonical"]');
          if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            document.head.appendChild(canonical);
          }
          canonical.setAttribute('href', data.canonical_url);
        }

      } catch (err) {
        console.error('Error updating SEO tags:', err);
      }
    };

    updateSEO();
  }, [location]);

  return null;
};
