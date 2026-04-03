import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Search, CheckCircle, Store, AlertCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

interface VerifikatorInfo {
  id: string;
  full_name: string | null;
  business_name: string | null;
  referral_code: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  verifikator_id: string;
}

export const MerchantGroupCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State untuk form pencarian
  const [loading, setLoading] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [searchedCodeData, setSearchedCodeData] = useState<any | null>(null);
  const [searchedVerifikator, setSearchedVerifikator] = useState<VerifikatorInfo | null>(null);

  // State untuk data keanggotaan saat ini
  const [initialLoading, setInitialLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [currentMerchantData, setCurrentMerchantData] = useState<any | null>(null);
  const [currentVerifikator, setCurrentVerifikator] = useState<VerifikatorInfo | null>(null);
  const [currentGroup, setCurrentGroup] = useState<GroupInfo | null>(null);

  useEffect(() => {
    if (user) {
      checkCurrentMembership();
    }
  }, [user]);

  const checkCurrentMembership = async () => {
    try {
      setInitialLoading(true);
      // 1. Ambil data merchant untuk cek verifikator_id, group_id, dan verifikator_code
      const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('id, verifikator_id, group_id, verifikator_code, trade_group')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (merchantError) {
        console.error('Error fetching merchant:', merchantError);
        return;
      }

      // Merchant dianggap bergabung jika memiliki verifikator_id, group_id, ATAU verifikator_code
      if (merchant && (merchant.verifikator_id || merchant.group_id || merchant.verifikator_code)) {
        setIsJoined(true);
        setCurrentMerchantData(merchant);

        let vId = merchant.verifikator_id;
        let vCode = merchant.verifikator_code;
        let tGroup = merchant.trade_group;

        // Jika verifikator_id belum ada tapi ada verifikator_code, coba cari verifikator_id
        if (!vId && vCode) {
          const { data: codeData } = await supabase
            .from('verifikator_codes')
            .select('verifikator_id, trade_group')
            .eq('code', vCode)
            .maybeSingle();
          
          if (codeData) {
            vId = codeData.verifikator_id;
            if (!tGroup) tGroup = codeData.trade_group;
          }
        }

        // 2. Ambil detail verifikator jika ID ditemukan
        if (vId) {
          const { data: verifikatorData } = await supabase
            .from('profiles')
            .select('id, full_name, phone, address')
            .eq('id', vId)
            .maybeSingle();

          if (verifikatorData) {
            setCurrentVerifikator({
              ...verifikatorData,
              business_name: tGroup || "Kelompok Dagang",
              referral_code: vCode,
              email: null
            });
          }
        }

        // 3. Ambil detail group jika ada
        if (merchant.group_id) {
          const { data: groupData } = await supabase
            .from('trade_groups')
            .select('id, name, description, verifikator_id')
            .eq('id', merchant.group_id)
            .maybeSingle();

          if (groupData) {
            setCurrentGroup(groupData);
          }
        }
      } else {
        setIsJoined(false);
        setCurrentVerifikator(null);
        setCurrentGroup(null);
        setCurrentMerchantData(null);
      }
    } catch (error) {
      console.error('Error checking membership:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const searchVerifikator = async () => {
    const trimmedCode = searchCode.trim().toUpperCase();
    if (!trimmedCode) {
      toast({
        title: "Kode kosong",
        description: "Mohon masukkan kode referal kelompok dagang",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Cari di tabel verifikator_codes
      const { data: codeData, error: codeError } = await supabase
        .from('verifikator_codes')
        .select('id, code, trade_group, verifikator_id, description')
        .ilike('code', trimmedCode)
        .eq('is_active', true)
        .maybeSingle();

      if (codeError || !codeData) {
        // Fallback: Cari di profiles (referral_code) jika ada (logic lama)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, phone, address')
          .ilike('referral_code', trimmedCode)
          .maybeSingle();

        if (profileError || !profileData) {
          toast({
            title: "Kode tidak ditemukan",
            description: "Pastikan kode kelompok dagang benar dan masih aktif.",
            variant: "destructive",
          });
          setSearchedVerifikator(null);
          setSearchedCodeData(null);
        } else {
          setSearchedCodeData({
            code: trimmedCode,
            trade_group: "Kelompok Dagang",
            verifikator_id: profileData.id
          });
          setSearchedVerifikator({
            ...profileData,
            business_name: "Kelompok Dagang",
            referral_code: trimmedCode,
            email: null
          });
        }
      } else {
        setSearchedCodeData(codeData);
        
        // Ambil info verifikator dari profile
        const { data: verifikatorProfile } = await supabase
          .from('profiles')
          .select('id, full_name, phone, address')
          .eq('id', codeData.verifikator_id)
          .maybeSingle();

        setSearchedVerifikator({
          id: codeData.verifikator_id,
          full_name: verifikatorProfile?.full_name || "Verifikator",
          business_name: codeData.trade_group,
          referral_code: codeData.code,
          phone: verifikatorProfile?.phone || null,
          email: null,
          address: verifikatorProfile?.address || null
        });
      }
    } catch (error) {
      console.error('Error searching:', error);
      toast({
        title: "Terjadi kesalahan",
        description: "Gagal mencari kelompok dagang.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async () => {
    if (!searchedVerifikator || !user || !searchedCodeData) return;

    setLoading(true);
    try {
      // Ambil ID merchant
      const { data: merchantData } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!merchantData) throw new Error("Merchant data not found");

      // Update merchant dengan info verifikator
      const { error } = await supabase
        .from('merchants')
        .update({ 
          verifikator_id: searchedVerifikator.id,
          verifikator_code: searchedCodeData.code,
          trade_group: searchedCodeData.trade_group
        })
        .eq('id', merchantData.id);

      if (error) throw error;

      toast({
        title: "Berhasil bergabung!",
        description: `Selamat datang di kelompok ${searchedVerifikator.business_name || searchedVerifikator.full_name}`,
      });
      
      // Bersihkan state pencarian
      setSearchedVerifikator(null);
      setSearchedCodeData(null);
      setSearchCode("");
      
      // Refresh data
      checkCurrentMembership();
    } catch (error) {
      console.error('Error joining group:', error);
      toast({
        title: "Gagal bergabung",
        description: "Terjadi kesalahan sistem. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // --- TAMPILAN LOADING ---
  if (initialLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-20 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  // --- TAMPILAN SUDAH BERGABUNG ---
  if (isJoined) {
    const displayName = currentGroup?.name || currentMerchantData?.trade_group || currentVerifikator?.business_name || "Kelompok Dagang";
    const verifikatorName = currentVerifikator?.full_name || "Verifikator Terdaftar";
    const code = currentMerchantData?.verifikator_code || currentVerifikator?.referral_code || "-";

    return (
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-green-100 rounded-full opacity-50 blur-2xl"></div>

        <CardHeader className="pb-3 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-green-100 p-2 rounded-full border border-green-200 shadow-sm">
                <ShieldCheck className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <CardTitle className="text-lg text-green-800">Status Kelompok</CardTitle>
                <CardDescription className="text-green-700/80 font-medium">
                  Terdaftar & Aktif
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-700 hover:bg-green-100 hover:text-green-900" onClick={checkCurrentMembership} title="Perbarui Data">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 relative z-10">
          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-green-100 shadow-sm transition-all hover:shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex items-center justify-center shrink-0">
                <Store className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-3 flex-1">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 leading-tight">
                    {displayName}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium mt-1 flex items-center gap-1">
                    <Users className="h-3 w-3" /> Verifikator: {verifikatorName}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Kode Kelompok</p>
                    <p className="text-sm font-mono font-semibold text-slate-800 tracking-wide select-all">
                      {code}
                    </p>
                  </div>
                  {currentVerifikator?.phone && (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Kontak</p>
                      <p className="text-sm font-medium text-slate-800">
                        {currentVerifikator.phone}
                      </p>
                    </div>
                  )}
                </div>

                {(currentGroup?.description || currentVerifikator?.address) && (
                  <div className="pt-1 border-t border-slate-100">
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5 mt-2">
                      <span className="shrink-0 mt-0.5">📍</span>
                      <span className="line-clamp-2">{currentGroup?.description || currentVerifikator?.address}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <Alert className="bg-blue-50/80 border-blue-100 text-blue-900">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="ml-2">
              <AlertTitle className="text-blue-800 font-semibold text-sm">Informasi</AlertTitle>
              <AlertDescription className="text-blue-700 text-xs">
                Anda telah bergabung dengan kelompok dagang ini. Silakan hubungi verifikator jika ada kendala.
              </AlertDescription>
            </div>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // --- TAMPILAN BELUM BERGABUNG (FORM PENCARIAN) ---
  return (
    <Card className="border-dashed border-2 border-slate-200 bg-slate-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <Users className="h-5 w-5 text-primary" />
          Gabung Kelompok Dagang
        </CardTitle>
        <CardDescription>
          Cari verifikator menggunakan <strong>Kode Referal</strong> untuk bergabung.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="KODE VERIFIKATOR (CONTOH: SU92BDX)"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="pl-9 uppercase font-medium tracking-wider bg-white"
              />
            </div>
            <Button onClick={searchVerifikator} disabled={loading} className="shrink-0 bg-primary hover:bg-primary/90">
              {loading ? "..." : "Cari"}
            </Button>
          </div>

          {searchedVerifikator && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-4 mb-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{searchedVerifikator.business_name || searchedVerifikator.full_name}</h4>
                  <p className="text-sm text-gray-500">{searchedVerifikator.full_name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono text-slate-600 border border-slate-200">
                      {searchedVerifikator.referral_code}
                    </span>
                    {searchedVerifikator.address && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        • {searchedVerifikator.address.substring(0, 30)}...
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button className="w-full" size="lg" onClick={joinGroup} disabled={loading}>
                Gabung ke Kelompok Ini
              </Button>
            </div>
          )}
        </div>
        
        <Alert className="bg-amber-50 border-amber-200">
          <div className="flex gap-3">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <AlertTitle className="text-amber-800 text-sm font-semibold">Belum memiliki kode?</AlertTitle>
              <AlertDescription className="text-amber-700 text-xs mt-1">
                Silakan hubungi koordinator dagang atau verifikator di wilayah Anda untuk meminta Kode Referal pendaftaran.
              </AlertDescription>
            </div>
          </div>
        </Alert>
      </CardContent>
    </Card>
  );
};
