import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import { ArrowLeft, Ticket, Search, Copy, CheckCircle, Tag, Percent } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Voucher {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  discount_percent: number;
  discount_amount: number;
  min_purchase: number;
  max_discount: number | null;
  end_date: string;
  usage_limit: number | null;
  used_count: number;
  merchant_id: string | null;
  merchant_name: string | null;
}

export default function VoucherPage() {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('vouchers' as any)
        .select('*, merchants(name)')
        .eq('is_active', true)
        .gte('end_date', now)
        .order('created_at', { ascending: false });

      setVouchers(((data || []) as any[]).map(v => ({
        id: v.id,
        code: v.code,
        name: v.name,
        description: v.description,
        type: v.type,
        discount_percent: v.discount_percent || 0,
        discount_amount: v.discount_amount || 0,
        min_purchase: v.min_purchase || 0,
        max_discount: v.max_discount,
        end_date: v.end_date,
        usage_limit: v.usage_limit,
        used_count: v.used_count || 0,
        merchant_id: v.merchant_id,
        merchant_name: v.merchants?.name || null,
      })));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      toast.success(`Kode ${code} disalin!`);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const checkManualVoucher = async () => {
    if (!manualCode.trim()) return;
    setChecking(true);
    try {
      const { data } = await supabase
        .from('vouchers' as any)
        .select('*, merchants(name)')
        .eq('code', manualCode.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (!data) {
        toast.error('Kode voucher tidak ditemukan atau tidak aktif');
        return;
      }

      const v = data as any;
      if (new Date(v.end_date) < new Date()) {
        toast.error('Voucher sudah kedaluwarsa');
        return;
      }

      toast.success(`Voucher ditemukan: ${v.name}`);
      handleCopy(v.code);
    } catch {
      toast.error('Gagal mengecek voucher');
    } finally {
      setChecking(false);
    }
  };

  const filtered = vouchers.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.code.toLowerCase().includes(search.toLowerCase())
  );

  const getDiscountLabel = (v: Voucher) => {
    if (v.type === 'percent') return `${v.discount_percent}% OFF`;
    return `Rp ${v.discount_amount.toLocaleString('id-ID')} OFF`;
  };

  const platformVouchers = filtered.filter(v => !v.merchant_id);
  const merchantVouchers = filtered.filter(v => v.merchant_id);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />Kembali
        </Button>

        <div>
          <h1 className="text-xl font-bold">Voucher & Kupon</h1>
          <p className="text-sm text-muted-foreground">Gunakan kode diskon saat checkout</p>
        </div>

        {/* Manual code input */}
        <div className="flex gap-2">
          <Input
            placeholder="Masukkan kode voucher..."
            value={manualCode}
            onChange={e => setManualCode(e.target.value.toUpperCase())}
            className="font-mono uppercase"
            onKeyDown={e => e.key === 'Enter' && checkManualVoucher()}
          />
          <Button onClick={checkManualVoucher} disabled={checking || !manualCode.trim()}>
            {checking ? '...' : 'Cek'}
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari voucher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {platformVouchers.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Voucher Platform</h3>
                <div className="space-y-2">
                  {platformVouchers.map(v => <VoucherCard key={v.id} v={v} copied={copied} onCopy={handleCopy} getLabel={getDiscountLabel} />)}
                </div>
              </div>
            )}

            {merchantVouchers.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Voucher Toko</h3>
                <div className="space-y-2">
                  {merchantVouchers.map(v => <VoucherCard key={v.id} v={v} copied={copied} onCopy={handleCopy} getLabel={getDiscountLabel} />)}
                </div>
              </div>
            )}

            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Ticket className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Tidak ada voucher tersedia</p>
                <p className="text-sm mt-1">Pantau terus untuk penawaran terbaru!</p>
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function VoucherCard({ v, copied, onCopy, getLabel }: {
  v: Voucher;
  copied: string | null;
  onCopy: (code: string) => void;
  getLabel: (v: Voucher) => string;
}) {
  const daysLeft = Math.ceil((new Date(v.end_date).getTime() - Date.now()) / 86400000);
  const isAlmostExpired = daysLeft <= 3;
  const isFull = v.usage_limit !== null && v.used_count >= v.usage_limit;

  return (
    <div className={`border rounded-xl overflow-hidden ${isFull ? 'opacity-60' : ''}`}>
      <div className="flex">
        <div className={`w-20 flex items-center justify-center flex-col text-white text-center p-3 ${
          v.type === 'percent' ? 'bg-emerald-500' : 'bg-blue-500'
        }`}>
          {v.type === 'percent' ? <Percent className="h-5 w-5 mb-0.5" /> : <Tag className="h-5 w-5 mb-0.5" />}
          <span className="text-xs font-bold leading-tight">{getLabel(v)}</span>
        </div>
        <div className="flex-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm">{v.name}</p>
              {v.merchant_name && <p className="text-xs text-muted-foreground">{v.merchant_name}</p>}
              {v.min_purchase > 0 && <p className="text-xs text-muted-foreground">Min. {formatPrice(v.min_purchase)}</p>}
              {v.max_discount && <p className="text-xs text-muted-foreground">Maks. {formatPrice(v.max_discount)}</p>}
            </div>
            <button
              onClick={() => onCopy(v.code)}
              disabled={isFull}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold transition-colors ${
                copied === v.code
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-dashed hover:bg-muted'
              }`}
            >
              {copied === v.code ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {v.code}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <p className={`text-xs ${isAlmostExpired ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
              Berlaku hingga {format(new Date(v.end_date), 'dd MMM yyyy', { locale: idLocale })}
              {isAlmostExpired && ` (${daysLeft} hari lagi)`}
            </p>
            {isFull && <Badge className="text-xs bg-red-100 text-red-700">Habis</Badge>}
          </div>
        </div>
      </div>
    </div>
  );
}
