import { useState, useRef } from 'react';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { uploadFile, validateFile, compressImage, StorageBucket } from '@/lib/storage';
import { toast } from 'sonner';

interface ImageUploadProps {
  bucket: StorageBucket;
  path: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'wide';
  maxSizeMB?: number;
  placeholder?: string;
  disabled?: boolean;
}

export function ImageUpload({
  bucket,
  path,
  value,
  onChange,
  className,
  aspectRatio = 'square',
  maxSizeMB = 5,
  placeholder = 'Upload gambar',
  disabled = false,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const aspectRatioClass = {
    square: 'aspect-square',
    video: 'aspect-video',
    wide: 'aspect-[3/1]',
  }[aspectRatio];

  const handleFile = async (file: File) => {
    // Validate
    const error = validateFile(file, maxSizeMB);
    if (error) {
      toast.error(error);
      return;
    }

    setIsUploading(true);

    try {
      // Compress image
      const compressedFile = await compressImage(file);
      
      // Upload
      const result = await uploadFile({
        bucket,
        path,
        file: compressedFile,
      });

      if (result.error) {
        toast.error(result.error);
      } else if (result.url) {
        onChange(result.url);
        toast.success('Gambar berhasil diupload');
      }
    } catch (err) {
      toast.error('Gagal mengupload gambar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled || isUploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <div className={cn('relative', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleInputChange}
        disabled={disabled || isUploading}
        className="hidden"
      />
      
      <div
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          'relative overflow-hidden rounded-lg border-2 border-dashed transition-all cursor-pointer',
          aspectRatioClass,
          dragActive && 'border-primary bg-primary/5',
          !value && !dragActive && 'border-muted-foreground/25 hover:border-muted-foreground/50',
          value && 'border-transparent',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Preview"
              className="absolute inset-0 w-full h-full object-cover"
            />
            {!disabled && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <>
                <ImageIcon className="h-8 w-8" />
                <span className="text-sm text-center px-4">{placeholder}</span>
                <span className="text-xs">Maks. {maxSizeMB}MB</span>
              </>
            )}
          </div>
        )}
        
        {isUploading && value && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
