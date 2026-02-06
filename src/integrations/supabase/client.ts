import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Mengambil URL dan Key dari Environment Variables (Vite/Vercel)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Log error jika variabel tidak ditemukan (untuk debugging)
if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase environment variables are missing. Please check your .env file or Vercel project settings.");
}

// Gunakan URL dummy jika variabel tidak ada untuk mencegah crash saat inisialisasi
// Namun tetap log error agar user tahu apa yang salah
const effectiveUrl = supabaseUrl || 'https://placeholder-project.supabase.co';
const effectiveKey = supabaseKey || 'placeholder-key';

// Membuat client Supabase yang terhubung ke project Anda sendiri
export const supabase = createClient<Database>(
  effectiveUrl,
  effectiveKey
);
