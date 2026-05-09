import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Clock, XCircle, RefreshCw, QrCode, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';

interface QRPayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  tenantId: string;
  outletId: string;
  cashierName: string;
  storeName: string;
  authToken: string;
  onSuccess: (buyerName: string) => void;
}

type Status = 'creating' | 'waiting' | 'confirmed' | 'expired' | 'cancelled' | 'error';

export function QRPayDialog({
  open, onOpenChange, amount, tenantId, outletId,
  cashierName, storeName, authToken, onSuccess,
}: QRPayDialogProps) {
  const [status, setStatus] = useState<Status>('creating');
  const [sessionId, setSessionId] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [buyerName, setBuyerName] = useState('');
  const [qrUrl, setQrUrl] = useState('');

  const sseRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    sseRef.current?.close();
    sseRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const cancelSession = useCallback(async (sid: string) => {
    if (!sid) return;
    await fetch(`/api/qrpay/cancel/${sid}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    }).catch(() => {});
  }, [authToken]);

  const createSession = useCallback(async () => {
    cleanup();
    setStatus('creating');
    setSecondsLeft(300);
    setBuyerName('');

    try {
      const res = await fetch('/api/qrpay/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ tenantId, outletId, cashierName, storeName, amount }),
      });

      if (!res.ok) throw new Error('Gagal membuat sesi QR Pay');
      const data = await res.json();

      setSessionId(data.sessionId);
      setSessionToken(data.sessionToken);
      const fullQrUrl = `${window.location.origin}${data.qrUrl}`;
      setQrUrl(fullQrUrl);
      setStatus('waiting');

      // Subscribe SSE ke channel sesi ini
      await fetch('/api/sse/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ channel: `qrpay:${data.sessionId}` }),
      });

      // Countdown timer
      timerRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setStatus('expired');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Poll status sebagai fallback (SSE mungkin belum terhubung saat subscribe)
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/qrpay/status/${data.sessionId}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          const d = await r.json();
          if (d.status === 'confirmed') {
            clearInterval(pollRef.current!);
            clearInterval(timerRef.current!);
            setBuyerName(d.buyerName || 'Pembeli');
            setStatus('confirmed');
            onSuccess(d.buyerName || 'Pembeli');
          } else if (d.status === 'expired' || d.status === 'cancelled') {
            clearInterval(pollRef.current!);
            clearInterval(timerRef.current!);
            setStatus(d.status);
          }
        } catch {}
      }, 2000);

    } catch (err: any) {
      setStatus('error');
      toast.error(err.message || 'Gagal membuat QR Pay');
    }
  }, [authToken, tenantId, outletId, cashierName, storeName, amount, cleanup, onSuccess]);

  // SSE listener dari window-level event yang di-dispatch oleh useSSE global
  useEffect(() => {
    if (!open || !sessionId) return;

    const handler = (e: Event) => {
      const evt = e as CustomEvent;
      const data = evt.detail;
      if (!data || data.channel !== `qrpay:${sessionId}`) return;

      if (data.event === 'qrpay_confirmed') {
        cleanup();
        setBuyerName(data.payload?.buyerName || 'Pembeli');
        setStatus('confirmed');
        onSuccess(data.payload?.buyerName || 'Pembeli');
        toast.success(`Pembayaran dikonfirmasi oleh ${data.payload?.buyerName || 'Pembeli'}!`);
      } else if (data.event === 'qrpay_expired') {
        cleanup();
        setStatus('expired');
      } else if (data.event === 'qrpay_cancelled') {
        cleanup();
        setStatus('cancelled');
      }
    };

    window.addEventListener('sse_broadcast', handler);
    return () => window.removeEventListener('sse_broadcast', handler);
  }, [open, sessionId, cleanup, onSuccess]);

  // Buat sesi saat dialog buka
  useEffect(() => {
    if (open && amount > 0 && tenantId) {
      createSession();
    }
    return () => {
      if (!open) cleanup();
    };
  }, [open]);

  // Cancel saat tutup manual (status masih waiting)
  const handleClose = () => {
    if (status === 'waiting') cancelSession(sessionId);
    cleanup();
    onOpenChange(false);
  };

  const formatSeconds = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const timerColor = secondsLeft > 120 ? 'text-emerald-600' : secondsLeft > 60 ? 'text-amber-600' : 'text-red-600';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-emerald-600" />
            QR Pay
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount */}
          <div className="text-center bg-emerald-50 rounded-xl py-3">
            <p className="text-xs text-muted-foreground mb-0.5">Total Pembayaran</p>
            <p className="text-2xl font-bold text-emerald-700">{formatPrice(amount)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{storeName}</p>
          </div>

          {/* Status: Creating */}
          {status === 'creating' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-16 h-16 bg-muted rounded-2xl animate-pulse" />
              <p className="text-sm text-muted-foreground">Membuat QR Code...</p>
            </div>
          )}

          {/* Status: Waiting — QR tampil */}
          {status === 'waiting' && qrUrl && (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-4 rounded-2xl border-2 border-emerald-200 shadow-sm">
                <QRCodeSVG
                  value={qrUrl}
                  size={180}
                  level="H"
                  includeMargin={false}
                  fgColor="#065f46"
                />
              </div>

              <div className="flex items-center gap-1.5 text-sm">
                <Clock className={`h-4 w-4 ${timerColor}`} />
                <span className={`font-mono font-bold ${timerColor}`}>{formatSeconds(secondsLeft)}</span>
                <span className="text-muted-foreground">tersisa</span>
              </div>

              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 text-center">
                <Smartphone className="h-4 w-4 flex-shrink-0" />
                <span>Minta pembeli buka app DesaMart → scan QR ini untuk bayar</span>
              </div>

              <Badge variant="outline" className="text-xs">Menunggu konfirmasi pembayaran...</Badge>
            </div>
          )}

          {/* Status: Confirmed */}
          {status === 'confirmed' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-700">Pembayaran Berhasil!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Dibayar oleh <span className="font-semibold text-foreground">{buyerName}</span>
                </p>
                <p className="text-xl font-bold mt-2">{formatPrice(amount)}</p>
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleClose}>
                Selesai & Lanjut Transaksi
              </Button>
            </div>
          )}

          {/* Status: Expired */}
          {status === 'expired' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                <Clock className="h-8 w-8 text-amber-600" />
              </div>
              <div className="text-center">
                <p className="font-semibold">QR Pay Kedaluwarsa</p>
                <p className="text-sm text-muted-foreground">Buat QR baru untuk melanjutkan</p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full">
                <Button variant="outline" onClick={handleClose}>Batal</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={createSession}>
                  <RefreshCw className="h-4 w-4 mr-1.5" />Buat QR Baru
                </Button>
              </div>
            </div>
          )}

          {/* Status: Cancelled / Error */}
          {(status === 'cancelled' || status === 'error') && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <p className="font-semibold text-center">
                {status === 'cancelled' ? 'QR Pay Dibatalkan' : 'Gagal membuat QR Pay'}
              </p>
              <div className="grid grid-cols-2 gap-2 w-full">
                <Button variant="outline" onClick={handleClose}>Tutup</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={createSession}>
                  <RefreshCw className="h-4 w-4 mr-1.5" />Coba Lagi
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
