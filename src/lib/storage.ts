import { supabase } from '@/integrations/supabase/client';

export type StorageBucket = 'products' | 'product-images' | 'tourism-images' | 'profile-images' | 'merchant-images' | 'promotions' | 'pod-images' | 'village-images';

interface UploadOptions {
  bucket: StorageBucket;
  path: string;
  file: File;
  onProgress?: (progress: number) => void;
}

interface UploadResult {
  url: string | null;
  error: string | null;
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile({ bucket, path, file }: UploadOptions): Promise<UploadResult> {
  try {
    // Generate unique filename
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${path}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { url: null, error: uploadError.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return { url: urlData.publicUrl, error: null };
  } catch (err) {
    console.error('Upload exception:', err);
    return { url: null, error: 'Gagal mengupload file' };
  }
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(bucket: StorageBucket, url: string): Promise<boolean> {
  try {
    // Extract path from URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split(`/storage/v1/object/public/${bucket}/`);
    if (pathParts.length < 2) return false;
    
    const filePath = decodeURIComponent(pathParts[1]);
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Delete exception:', err);
    return false;
  }
}

/**
 * Validate file before upload
 */
export function validateFile(file: File, maxSizeMB: number = 5): string | null {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  
  if (!allowedTypes.includes(file.type)) {
    return 'Format file tidak didukung. Gunakan JPG, PNG, WebP, atau GIF.';
  }
  
  if (file.size > maxSizeMB * 1024 * 1024) {
    return `Ukuran file maksimal ${maxSizeMB}MB.`;
  }
  
  return null;
}

/**
 * Compress image before upload
 */
export async function compressImage(file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<File> {
  return new Promise((resolve) => {
    // If file is small enough or not compressible, return as-is
    if (file.size < 500 * 1024 || file.type === 'image/gif') {
      resolve(file);
      return;
    }

    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;
      
      // Scale down if larger than maxWidth
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}
