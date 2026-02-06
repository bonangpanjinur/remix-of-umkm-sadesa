import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Mengambil URL dan Key dari Environment Variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase environment variables are missing.");
}

export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseKey || ''
);
