import { useState, useEffect } from 'react';
import { Shield, Info, FileCheck, ExternalLink, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { supabase } from '../../integrations/supabase/client';
import { toast } from 'sonner';

interface HalalRegistrationInfoProps {
  onStatusChange: (status: 'NONE' | 'PENDING_VERIFICATION' | 'REQUESTED', fileUrl?: string, ktpUrl?: string) => void;
}

export function HalalRegistrationInfo({ onStatusChange }: HalalRegistrationInfoProps) {
  const [hasCertificate, setHasCertificate] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [ktpUrl, setKtpUrl] = useState<string | null>(null);
  const [regulation, setRegulation] = useState<string>('');

  useEffect(() => {
    const fetchRegulation = async () => {
      const { data, error } = await supabase
        .from('halal_regulations')
        .select('content')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        setRegulation(data.content);
      }
    };
    fetchRegulation();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'certificate' | 'ktp') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${type}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('merchants')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('merchants')
        .getPublicUrl(filePath);

      if (type === 'certificate') {
        setCertificateUrl(publicUrl);
        onStatusChange('PENDING_VERIFICATION', publicUrl, ktpUrl || undefined);
      } else {
        setKtpUrl(publicUrl);
        onStatusChange('REQUESTED', certificateUrl || undefined, publicUrl);
      }
      toast.success(`${type === 'certificate' ? 'Sertifikat' : 'KTP'} berhasil diunggah`);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Gagal mengunggah file');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4 bg-card border rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Sertifikasi Halal</h3>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Apakah sudah memiliki sertifikat halal?</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={hasCertificate === 'yes' ? 'default' : 'outline'}
              onClick={() => {
                setHasCertificate('yes');
                onStatusChange('NONE');
              }}
              className="w-full"
            >
              Sudah
            </Button>
            <Button
              type="button"
              variant={hasCertificate === 'no' ? 'default' : 'outline'}
              onClick={() => {
                setHasCertificate('no');
                onStatusChange('NONE');
              }}
              className="w-full"
            >
              Belum
            </Button>
          </div>
        </div>

        {hasCertificate === 'yes' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
              <Label>Unggah Sertifikat Halal (Foto/PDF)</Label>
              <div className="relative">
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileUpload(e, 'certificate')}
                  className="hidden"
                  id="halal-upload"
                  disabled={isUploading}
                />
                <label
                  htmlFor="halal-upload"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  {isUploading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  ) : certificateUrl ? (
                    <div className="flex flex-col items-center text-primary">
                      <CheckCircle2 className="w-8 h-8 mb-2" />
                      <span className="text-xs font-medium">Sertifikat Terunggah</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-muted-foreground">
                      <Upload className="w-8 h-8 mb-2" />
                      <span className="text-xs">Klik untuk unggah sertifikat</span>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>
        )}

        {hasCertificate === 'no' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex gap-3 items-start">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-primary">Jangan khawatir, sertifikat halal gratis!</p>
                <p className="text-muted-foreground">Kami akan membantu proses pembuatannya untuk usaha kuliner Anda.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Unggah Foto KTP (Syarat Pengajuan)</Label>
              <div className="relative">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'ktp')}
                  className="hidden"
                  id="ktp-upload"
                  disabled={isUploading}
                />
                <label
                  htmlFor="ktp-upload"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  {isUploading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  ) : ktpUrl ? (
                    <div className="flex flex-col items-center text-primary">
                      <CheckCircle2 className="w-8 h-8 mb-2" />
                      <span className="text-xs font-medium">KTP Terunggah</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-muted-foreground">
                      <Upload className="w-8 h-8 mb-2" />
                      <span className="text-xs">Klik untuk unggah foto KTP</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full text-xs h-9"
                onClick={() => window.open('https://www.halal.go.id/', '_blank')}
              >
                <ExternalLink className="w-3 h-3 mr-2" />
                Lihat Regulasi Halal Pemerintah
              </Button>
            </div>
            
            {regulation && (
              <div className="text-[10px] text-muted-foreground bg-muted p-2 rounded border italic">
                {regulation}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
