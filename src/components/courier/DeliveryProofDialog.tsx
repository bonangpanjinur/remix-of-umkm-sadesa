/**
 * S4-01: Bukti Kirim Foto — upload foto selesai antar
 */
import { useState, useRef } from 'react';
import { Camera, Upload, X, CheckCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeliveryProofDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  onConfirmed: () => void;
}

export function DeliveryProofDialog({ open, onClose, orderId, orderNumber, onConfirmed }: DeliveryProofDialogProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Hanya file gambar yang diizinkan'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran foto maksimal 5MB'); return; }
    setPhoto(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const clearPhoto = () => {
    setPhoto(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  const handleSubmit = async () => {
    if (!photo) { toast.error('Harap ambil/upload foto bukti pengiriman'); return; }
    setUploading(true);
    try {
      // Upload photo
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('delivery-proofs')
        .upload(`${orderId}/${Date.now()}_${photo.name}`, photo, { upsert: true });

      let photoUrl = '';
      if (uploadError) {
        // fallback: use base64 stored as data URL (smaller stores)
        const reader = new FileReader();
        photoUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(photo);
        });
      } else {
        const { data: urlData } = supabase.storage.from('delivery-proofs').getPublicUrl(uploadData.path);
        photoUrl = urlData.publicUrl;
      }

      // Update order status to DELIVERED with proof
      const { error: orderError } = await supabase
        .from('orders' as any)
        .update({
          status: 'DELIVERED',
          delivered_at: new Date().toISOString(),
          delivery_proof_url: photoUrl,
          delivery_notes: notes || null,
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // Notify buyer
      const orderRes = await supabase.from('orders' as any).select('user_id').eq('id', orderId).maybeSingle();
      if (orderRes.data?.user_id) {
        await supabase.from('notifications' as any).insert({
          user_id: orderRes.data.user_id,
          title: 'Pesanan Terkirim!',
          message: `Pesanan #${orderNumber} telah berhasil dikirim. Tap untuk memberi rating kurir.`,
          type: 'order',
          link: `/orders`,
          data: JSON.stringify({ order_id: orderId, show_rating: true }),
        });
      }

      toast.success('Bukti pengiriman berhasil diunggah');
      onConfirmed();
      onClose();
    } catch (err: any) {
      toast.error('Gagal upload bukti: ' + (err.message || 'Coba lagi'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Bukti Pengiriman
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload foto bukti pengiriman untuk pesanan <strong>#{orderNumber}</strong>
          </p>

          {preview ? (
            <div className="relative">
              <img src={preview} alt="Preview" className="w-full h-48 object-cover rounded-lg border" />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={clearPhoto}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-8 w-8 text-primary" />
                <span className="text-xs">Ambil Foto</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-xs">Pilih File</span>
              </Button>
            </div>
          )}

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          <div>
            <Label className="text-sm">Catatan (opsional)</Label>
            <Textarea
              placeholder="Misal: Diterima oleh satpam, ditinggal di depan pintu, dll."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 resize-none"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploading}>Batal</Button>
          <Button onClick={handleSubmit} disabled={!photo || uploading}>
            {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mengupload...</> : <><CheckCircle className="h-4 w-4 mr-2" />Konfirmasi Terkirim</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
