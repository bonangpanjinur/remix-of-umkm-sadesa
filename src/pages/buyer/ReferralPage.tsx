import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';
import { ArrowLeft, Users, Copy, Share2, Gift, CheckCircle, TrendingUp, Link } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ReferralUsage {
  id: string;
  referred_id: string;
  referrer_reward: number;
  referred_reward: number;
  reward_status: string;
  created_at: string;
  referred_user?: { full_name: string; email: string };
}

const REFERRER_REWARD = 25000;
const REFERRED_REWARD = 15000;

export default function ReferralPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState('');
  const [usages, setUsages] = useState<ReferralUsage[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [inputCode, setInputCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const generateCode = (userId: string) =>
    'DESA' + userId.replace(/-/g, '').substring(0, 8).toUpperCase();

  const fetchData = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('referral_code, referred_by')
        .eq('id', user!.id)
        .maybeSingle();

      let code = (profile as any)?.referral_code;
      if (!code) {
        code = generateCode(user!.id);
        await supabase.from('profiles').update({ referral_code: code }).eq('id', user!.id);
      }
      setReferralCode(code);

      const { data: usageData } = await (supabase as any)
        .from('referral_usages')
        .select('*')
        .eq('referrer_id', user!.id)
        .order('created_at', { ascending: false });

      const list = (usageData || []) as ReferralUsage[];
      setUsages(list);
      setTotalEarned(list.filter(u => u.reward_status === 'confirmed').reduce((s, u) => s + u.referrer_reward, 0));
    } catch (err) {
      console.error('Error fetching referral:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast.success('Kode referral disalin!');
  };

  const shareCode = () => {
    const text = `🎁 Belanja di DesaMart dan dapatkan diskon ${formatPrice(REFERRED_REWARD)}!\nGunakan kode referral saya: *${referralCode}*\nDaftar & belanja sekarang di DesaMart — Produk Asli Desa Indonesia 🌿`;
    if (navigator.share) {
      navigator.share({ title: 'DesaMart Referral', text });
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Teks referral disalin ke clipboard!');
    }
  };

  const submitReferralCode = async () => {
    if (!inputCode.trim()) return;
    setSubmitting(true);
    try {
      const { data: referrerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', inputCode.trim().toUpperCase())
        .maybeSingle();

      if (!referrerProfile) {
        toast.error('Kode referral tidak ditemukan');
        return;
      }
      if ((referrerProfile as any).id === user!.id) {
        toast.error('Tidak bisa menggunakan kode referral sendiri');
        return;
      }

      const { data: myProfile } = await supabase.from('profiles').select('referred_by').eq('id', user!.id).maybeSingle();
      if ((myProfile as any)?.referred_by) {
        toast.error('Kamu sudah pernah memasukkan kode referral');
        return;
      }

      await supabase.from('profiles').update({ referred_by: (referrerProfile as any).id }).eq('id', user!.id);
      await (supabase as any).from('referral_usages').insert({
        referrer_id: (referrerProfile as any).id,
        referred_id: user!.id,
        referral_code: inputCode.trim().toUpperCase(),
        referrer_reward: REFERRER_REWARD,
        referred_reward: REFERRED_REWARD,
        reward_status: 'pending',
      });

      toast.success(`Kode referral berhasil! Kamu dan pengundang mendapat reward setelah transaksi pertama.`);
      setInputCode('');
    } catch (err) {
      toast.error('Gagal memasukkan kode referral');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (s: string) => s === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : s === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500';
  const statusLabel = (s: string) => s === 'confirmed' ? 'Dikonfirmasi' : s === 'pending' ? 'Menunggu' : 'Kedaluwarsa';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
        </Button>
        <h1 className="text-xl font-bold text-gray-900 mb-4">Program Referral</h1>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Hero Card */}
            <Card className="bg-gradient-to-br from-violet-500 to-purple-700 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="h-5 w-5" />
                  <span className="font-semibold">Ajak Teman, Dapat Reward!</span>
                </div>
                <p className="text-sm opacity-90 mb-3">
                  Kamu dapat <strong>{formatPrice(REFERRER_REWARD)}</strong> dan temanmu dapat <strong>{formatPrice(REFERRED_REWARD)}</strong> untuk setiap teman yang berhasil bergabung dan belanja.
                </p>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 opacity-70" />
                  <span className="text-sm opacity-80">Total earned: <strong>{formatPrice(totalEarned)}</strong></span>
                  <span className="text-sm opacity-80">• {usages.filter(u => u.reward_status === 'confirmed').length} teman berhasil</span>
                </div>
              </CardContent>
            </Card>

            {/* Your Referral Code */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Link className="h-4 w-4 text-violet-600" /> Kode Referral Kamu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-4 py-3">
                  <span className="flex-1 text-xl font-bold tracking-widest text-violet-700 font-mono">{referralCode}</span>
                  <Button variant="ghost" size="icon" onClick={copyCode} className="text-violet-600 hover:bg-violet-100">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button onClick={shareCode} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                  <Share2 className="h-4 w-4 mr-2" /> Bagikan ke Teman
                </Button>
              </CardContent>
            </Card>

            {/* Enter referral code */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Punya Kode Referral?</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Input
                  placeholder="Masukkan kode referral teman"
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value.toUpperCase())}
                  className="font-mono uppercase"
                  maxLength={16}
                />
                <Button onClick={submitReferralCode} disabled={submitting || !inputCode.trim()} className="shrink-0">
                  {submitting ? 'Proses...' : 'Gunakan'}
                </Button>
              </CardContent>
            </Card>

            {/* History */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-600" /> Teman yang Berhasil Diundang ({usages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {usages.length === 0 ? (
                  <div className="text-center py-6">
                    <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-40" />
                    <p className="text-sm text-muted-foreground">Belum ada teman yang diundang</p>
                    <p className="text-xs text-muted-foreground mt-1">Bagikan kode referralmu sekarang!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {usages.map(u => (
                      <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          <div>
                            <p className="text-sm font-medium">Teman #{u.id.substring(0, 8).toUpperCase()}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(u.created_at), 'd MMM yyyy', { locale: idLocale })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-emerald-600">+{formatPrice(u.referrer_reward)}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor(u.reward_status)}`}>
                            {statusLabel(u.reward_status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
