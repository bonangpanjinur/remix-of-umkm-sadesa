import { useState, useRef } from 'react';
import { Upload, X, Loader2, ImageIcon, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { uploadFile, validateFile, compressImage } from '@/lib/storage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentProofUploadProps {
  orderId: string;
  currentProofUrl?: string | null;
  onUploaded: (url: string) => void;
  disabled?: boolean;
}

export function PaymentProofUpload({ orderId, currentProofUrl, onUploaded, disabled = false }: PaymentProofUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(currentProofUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const error = validateFile(file, 5);
    if (error) {
      toast.error(error);
      return;
    }

    setIsUploading(true);
    try {
      const compressedFile = await compressImage(file);
      const result = await uploadFile({
        bucket: 'payment-proofs',
        path: `orders/${orderId}`,
        file: compressedFile,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.url) {
        // Update order with payment proof URL
        const { error: updateError } = await supabase
          .from('orders')
          .update({ 
            payment_proof_url: result.url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        if (updateError) {
          toast.error('Gagal menyimpan bukti pembayaran');
          return;
        }

        setProofUrl(result.url);
        onUploaded(result.url);
        toast.success('Bukti pembayaran berhasil diupload');
      }
    } catch (err) {
      toast.error('Gagal mengupload bukti pembayaran');
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        disabled={disabled || isUploading}
        className="hidden"
      />

      {proofUrl ? (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img
              src={proofUrl}
              alt="Bukti pembayaran"
              className="w-full h-48 object-cover"
            />
            <div className="absolute top-2 left-2">
              <div className="flex items-center gap-1 bg-success/90 text-white px-2 py-1 rounded-full text-xs font-medium">
                <CheckCircle className="h-3 w-3" />
                Terupload
              </div>
            </div>
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Ganti Bukti Pembayaran
            </Button>
          )}
        </div>
      ) : (
        <div
          onClick={() => !disabled && !isUploading && inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all',
            'hover:border-primary/50 hover:bg-primary/5',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Mengupload...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">Upload Bukti Pembayaran</p>
              <p className="text-xs text-muted-foreground">
                Foto struk transfer / screenshot pembayaran
              </p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP • Maks. 5MB</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
