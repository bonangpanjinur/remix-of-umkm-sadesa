import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Accessing environment variables in Vite
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Logging for debugging purposes (will be visible in browser console)
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error("Supabase configuration error: VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is missing.");
  console.info("Please ensure these variables are set in your .env file (local) or Vercel dashboard (production).");
} else {
  console.info("Supabase client initialized with URL:", SUPABASE_URL);
}

export const supabase = createClient<Database>(
  SUPABASE_URL || '', 
  SUPABASE_PUBLISHABLE_KEY || '', 
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      headers: { 'x-application-name': 'desamart' }
    }
  }
);
