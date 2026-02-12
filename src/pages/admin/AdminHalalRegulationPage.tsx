import { useState, useEffect } from 'react';
import { FileText, Save, Loader2, Info } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function AdminHalalRegulationPage() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchRegulation = async () => {
      try {
        const { data, error } = await supabase
          .from('halal_regulations')
          .select('content')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (data) setContent(data.content);
      } catch (error) {
        console.error('Error fetching regulation:', error);
        toast.error('Gagal memuat data regulasi');
      } finally {
        setLoading(false);
      }
    };

    fetchRegulation();
  }, []);

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('Konten regulasi tidak boleh kosong');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('halal_regulations')
        .insert({ content: content.trim() });

      if (error) throw error;
      toast.success('Regulasi berhasil diperbarui');
    } catch (error) {
      console.error('Error saving regulation:', error);
      toast.error('Gagal menyimpan regulasi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Manajemen Regulasi Halal" subtitle="Atur konten informasi regulasi pemerintah untuk merchant">
      <div className="max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Konten Regulasi
            </CardTitle>
            <CardDescription>
              Konten ini akan ditampilkan kepada merchant kuliner yang belum memiliki sertifikat halal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex gap-3 items-start mb-2">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Gunakan bahasa yang jelas dan informatif. Anda bisa memasukkan informasi mengenai kewajiban sertifikasi halal per Oktober 2026 atau prosedur pendaftaran gratis.
              </p>
            </div>

            <div className="space-y-2">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Masukkan isi regulasi di sini..."
                className="min-h-[300px] font-sans text-sm leading-relaxed"
                disabled={loading}
              />
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={handleSave} 
                disabled={saving || loading}
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan Perubahan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
