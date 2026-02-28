import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "@/integrations/supabase/client";

// Function to generate and inject dynamic manifest
const injectDynamicManifest = async () => {
  // Only attempt if Supabase URL is configured
  if (!import.meta.env.VITE_SUPABASE_URL) {
    console.warn("Skipping dynamic manifest: Supabase URL not configured");
    return;
  }

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('category', 'pwa')
      .eq('key', 'pwa_config')
      .maybeSingle();

    if (error) {
      // If table doesn't exist or other DB error, fail silently
      console.warn("Dynamic manifest query failed:", error.message);
      return;
    }

    if (data) {
      const config = data.value as any;
      const manifest = {
        name: config.appName || "DesaMart",
        short_name: config.shortName || "DesaMart",
        description: config.description || "",
        start_url: "/",
        display: "standalone",
        background_color: config.backgroundColor || "#ffffff",
        theme_color: config.themeColor || "#10b981",
        icons: (config.icons || []).map((icon: any) => ({
          src: icon.src,
          sizes: icon.sizes,
          type: icon.type,
          purpose: "any maskable"
        }))
      };

      const stringManifest = JSON.stringify(manifest);
      const blob = new Blob([stringManifest], { type: 'application/json' });
      const manifestURL = URL.createObjectURL(blob);
      
      // Remove existing manifest link if any
      const existingLink = document.querySelector('link[rel="manifest"]');
      if (existingLink) {
        existingLink.remove();
      }

      // Create and append new manifest link
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = manifestURL;
      document.head.appendChild(link);
      
      console.log("Dynamic manifest injected successfully");
    }
  } catch (err) {
    // Catch network errors or other unexpected failures
    console.error("Failed to inject dynamic manifest:", err);
  }
};

// Inject manifest immediately
injectDynamicManifest();

createRoot(document.getElementById("root")!).render(<App />);
