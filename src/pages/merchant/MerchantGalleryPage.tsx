import { useState, useRef } from 'react';
import { Images, Plus, Trash2, GripVertical, Upload, Loader2, X } from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface GalleryItem {
  id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
}

export default function MerchantGalleryPage() {
  const { merchantId, loading: guardLoading } = useMerchantGuard();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingCaption, setEditingCaption] = useState<{ id: string; caption: string } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: gallery = [], isLoading } = useQuery<GalleryItem[]>({
    queryKey: ['merchant-gallery', merchantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('merchant_gallery')
        .select('id, image_url, caption, sort_order')
        .eq('merchant_id', merchantId!)
        .order('sort_order', { ascending: true });
      return (data || []) as GalleryItem[];
    },
    enabled: !!merchantId && !guardLoading,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('merchant_gallery').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-gallery', merchantId] });
      toast.success('Foto dihapus');
    },
    onError: () => toast.error('Gagal menghapus foto'),
  });

  const captionMutation = useMutation({
    mutationFn: async ({ id, caption }: { id: string; caption: string }) => {
      const { error } = await supabase.from('merchant_gallery').update({ caption: caption || null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-gallery', merchantId] });
      setEditingCaption(null);
      toast.success('Keterangan disimpan');
    },
    onError: () => toast.error('Gagal menyimpan keterangan'),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !merchantId) return;
    if (gallery.length + files.length > 10) {
      toast.error('Maksimal 10 foto galeri');
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} terlalu besar (maks 5MB)`);
          continue;
        }
        const ext = file.name.split('.').pop();
        const path = `${merchantId}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('merchant-gallery')
          .upload(path, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('merchant-gallery').getPublicUrl(path);
        const imageUrl = urlData?.publicUrl || uploadData?.fullPath || path;

        const nextOrder = gallery.length > 0 ? Math.max(...gallery.map(g => g.sort_order)) + 1 : 0;
        const { error: insertError } = await supabase.from('merchant_gallery').insert({
          merchant_id: merchantId,
          image_url: imageUrl,
          sort_order: nextOrder,
        });
        if (insertError) throw insertError;
      }
      queryClient.invalidateQueries({ queryKey: ['merchant-gallery', merchantId] });
      toast.success(`${files.length} foto berhasil diupload`);
    } catch (err: any) {
      toast.error('Gagal upload: ' + (err.message || 'Error tidak diketahui'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (guardLoading || isLoading) {
    return (
      <MerchantLayout title="Galeri Toko" subtitle="Kelola foto galeri toko Anda">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Galeri Toko" subtitle="Tampilkan foto toko di halaman publik (maks 10 foto)">
      <div className="space-y-6 max-w-3xl">
        {/* Upload area */}
        <Card className="border-dashed border-2 border-muted-foreground/30 hover:border-primary/50 transition-colors">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              {uploading ? (
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              ) : (
                <Upload className="h-8 w-8 text-primary" />
              )}
            </div>
            <div className="text-center">
              <p className="font-medium">Upload Foto Galeri</p>
              <p className="text-sm text-muted-foreground">PNG, JPG, WEBP hingga 5MB • {gallery.length}/10 foto</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || gallery.length >= 10}
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Pilih Foto
            </Button>
          </CardContent>
        </Card>

        {/* Gallery grid */}
        {gallery.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Images className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Belum ada foto galeri. Upload foto pertama Anda!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {gallery.map((item, index) => (
              <div key={item.id} className="relative group rounded-xl overflow-hidden border bg-muted aspect-square">
                <img
                  src={item.image_url}
                  alt={item.caption || `Foto ${index + 1}`}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setLightboxUrl(item.image_url)}
                />
                {/* Order badge */}
                <Badge className="absolute top-2 left-2 text-xs" variant="secondary">
                  {index + 1}
                </Badge>
                {/* Actions overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditingCaption({ id: item.id, caption: item.caption || '' })}
                  >
                    Edit Keterangan
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(item.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Hapus
                  </Button>
                </div>
                {/* Caption */}
                {item.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate">
                    {item.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Caption edit dialog */}
        <Dialog open={!!editingCaption} onOpenChange={() => setEditingCaption(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Keterangan Foto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Keterangan</Label>
                <Input
                  value={editingCaption?.caption || ''}
                  onChange={(e) => setEditingCaption(prev => prev ? { ...prev, caption: e.target.value } : null)}
                  placeholder="Contoh: Tampak depan toko, Produk andalan..."
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">{editingCaption?.caption?.length || 0}/100 karakter</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingCaption(null)}>Batal</Button>
                <Button
                  onClick={() => editingCaption && captionMutation.mutate(editingCaption)}
                  disabled={captionMutation.isPending}
                >
                  Simpan
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Lightbox */}
        {lightboxUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={() => setLightboxUrl(null)}
            >
              <X className="h-6 w-6" />
            </Button>
            <img
              src={lightboxUrl}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </MerchantLayout>
  );
}
