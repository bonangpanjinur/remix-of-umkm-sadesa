import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export default function EmailConfirmationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string })?.email || '';
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) {
      toast({ title: 'Email tidak ditemukan', variant: 'destructive' });
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      setResent(true);
      toast({ title: 'Email verifikasi dikirim ulang!' });
    } catch (err: any) {
      toast({ title: 'Gagal mengirim ulang', description: err.message, variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <div className="p-4">
        <button onClick={() => navigate('/auth')} className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col items-center justify-center px-6 text-center"
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Mail className="h-10 w-10 text-primary" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Cek Email Anda</h1>
        <p className="text-muted-foreground text-sm mb-2">
          Kami telah mengirim email verifikasi ke:
        </p>
        {email && (
          <p className="font-semibold text-foreground mb-6">{email}</p>
        )}

        <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left w-full max-w-sm">
          <h3 className="font-medium text-sm text-foreground mb-2">Langkah selanjutnya:</h3>
          <ol className="text-xs text-muted-foreground space-y-2 list-decimal pl-4">
            <li>Buka inbox email Anda (cek juga folder Spam)</li>
            <li>Klik link verifikasi di email tersebut</li>
            <li>Kembali ke aplikasi dan masuk dengan akun Anda</li>
          </ol>
        </div>

        <div className="space-y-3 w-full max-w-sm">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={resending || resent}
          >
            {resent ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Email terkirim!
              </>
            ) : (
              <>
                <RefreshCw className={`h-4 w-4 mr-2 ${resending ? 'animate-spin' : ''}`} />
                {resending ? 'Mengirim...' : 'Kirim ulang email'}
              </>
            )}
          </Button>

          <Button className="w-full" onClick={() => navigate('/auth')}>
            Kembali ke Halaman Masuk
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
