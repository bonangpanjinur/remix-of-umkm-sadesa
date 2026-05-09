import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Clock, XCircle, QrCode, Loader2, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';

interface SessionInfo {
  sessionId: string;
  storeName: string;
  cashierName: string;
  amount: number;
  description: string;
  expiresAt: string;
  secondsLeft: number;
}

type PageStatus = 'loading' | 'ready' | 'confirming' | 'success' | 'error' | 'expired' | 'already_paid';

export default function QRPayConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, session } = useAuth();

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Ambil info sesi
  useEffect(() => {
    if (!token) { setPageStatus('error'); setErrorMsg('Token tidak valid'); return; }

    fetch(`/api/qrpay/info/${token}`)
      .then(async r => {
        if (r.status === 404) throw new Error('QR Pay tidak ditemukan atau sudah kedaluwarsa');
        if (r.status === 410) {
          const d = await r.json().catch(() => ({}));
          if ((d as any).status === 'confirmed') setPageStatus('already_paid');
          else setPageStatus('expired');
          setErrorMsg((d as any).error || 'QR Pay sudah tidak aktif');
          return null;
        }
        if (!r.ok) throw new Error('Gagal mengambil info pembayaran');
        return r.json();
      })
      .then(data => {
        if (!data) return;
        setSessionInfo(data as SessionInfo);
        setSecondsLeft((data as SessionInfo).secondsLeft);
        setPageStatus('ready');
      })
      .catch(err => {
        setPageStatus('error');
        setErrorMsg(err.message);
      });
  }, [token]);

  // Countdown
  useEffect(() => {
    if (pageStatus !== 'ready' || secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setPageStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pageStatus, secondsLeft]);

  const confirmPayment = async () => {
    if (!user || !session) {
      // Simpan QR token ke localStorage lalu redirect ke login
      localStorage.setItem('qrpay_redirect', `/qrpay/${token}`);
      navigate('/auth');
      return;
    }

    setPageStatus('confirming');
    try {
      const authToken = localStorage.getItem('session_token') || '';
      const profileRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const profile = profileRes.ok ? await profileRes.json() : null;
      const buyerName = profile?.full_name || profile?.email || user.email || 'Pembeli';

      const res = await fetch('/api/qrpay/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ sessionToken: token, buyerName }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Gagal mengkonfirmasi pembayaran');
      }

      setPageStatus('success');
    } catch (err: any) {
      setPageStatus('error');
      setErrorMsg(err.message || 'Terjadi kesalahan');
    }
  };

  const formatSeconds = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const timerColor = secondsLeft > 120 ? 'text-emerald-600' : secondsLeft > 60 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <QrCode className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">DesaMart QR Pay</h1>
          <p className="text-sm text-muted-foreground">Pembayaran Digital Cepat & Aman</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardContent className="p-6">
            {/* Loading */}
            {pageStatus === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
                <p className="text-sm text-muted-foreground">Memuat informasi pembayaran...</p>
              </div>
            )}

            {/* Ready — tampilkan detail dan tombol bayar */}
            {(pageStatus === 'ready' || pageStatus === 'confirming') && sessionInfo && (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">{sessionInfo.storeName}</p>
                  <p className="text-3xl font-bold text-emerald-700 mt-1">
                    {formatPrice(sessionInfo.amount)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{sessionInfo.description}</p>
                </div>

                <div className="border-t border-dashed pt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kasir</span>
                    <span className="font-medium">{sessionInfo.cashierName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Waktu tersisa</span>
                    <span className={`font-mono font-bold flex items-center gap-1 ${timerColor}`}>
                      <Clock className="h-3.5 w-3.5" />
                      {formatSeconds(secondsLeft)}
                    </span>
                  </div>
                </div>

                {!user ? (
                  <div className="space-y-3">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 text-center">
                      Login atau daftar DesaMart untuk membayar dengan QR Pay
                    </div>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-semibold"
                      onClick={confirmPayment}>
                      Login & Bayar Sekarang
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800 text-center">
                      Masuk sebagai <span className="font-semibold">{user.email}</span>
                    </div>
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-semibold"
                      onClick={confirmPayment}
                      disabled={pageStatus === 'confirming'}>
                      {pageStatus === 'confirming' ? (
                        <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Memproses...</>
                      ) : (
                        <>Bayar {formatPrice(sessionInfo.amount)}</>
                      )}
                    </Button>
                  </div>
                )}

                <p className="text-xs text-center text-muted-foreground">
                  Pembayaran diamankan oleh DesaMart. Tidak ada biaya tambahan.
                </p>
              </div>
            )}

            {/* Success */}
            {pageStatus === 'success' && (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-emerald-700">Pembayaran Berhasil!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatPrice(sessionInfo?.amount || 0)} telah dibayarkan ke {sessionInfo?.storeName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Tunjukkan layar ini ke kasir sebagai bukti pembayaran
                  </p>
                </div>
                <div className="w-full space-y-2">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate('/')}>
                    <ShoppingBag className="h-4 w-4 mr-2" />Kembali Belanja
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => navigate('/orders')}>
                    Lihat Riwayat Pembelian
                  </Button>
                </div>
              </div>
            )}

            {/* Expired */}
            {pageStatus === 'expired' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                  <Clock className="h-8 w-8 text-amber-600" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">QR Pay Kedaluwarsa</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    QR code ini sudah tidak aktif. Minta kasir untuk membuat QR baru.
                  </p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
                  Kembali ke Beranda
                </Button>
              </div>
            )}

            {/* Already Paid */}
            {pageStatus === 'already_paid' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">Sudah Dibayar</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Transaksi ini sudah dikonfirmasi sebelumnya.
                  </p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
                  Kembali ke Beranda
                </Button>
              </div>
            )}

            {/* Error */}
            {pageStatus === 'error' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
                <div className="text-center">
                  <p className="font-bold">Terjadi Kesalahan</p>
                  <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
                  Kembali ke Beranda
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          © 2026 DesaMart — Platform UMKM & Desa Wisata Indonesia
        </p>
      </div>
    </div>
  );
}
