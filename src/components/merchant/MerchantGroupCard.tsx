import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Users, Search, CheckCircle, Store, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../integrations/supabase/client";
import { useAuth } from "../../contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Skeleton } from "../../components/ui/skeleton";

interface VerifikatorInfo {
  id: string;
  full_name: string | null;
  business_name: string | null;
  referral_code: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export const MerchantGroupCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchCode, setSearchCode] = useState("");
  const [verifikator, setVerifikator] = useState<VerifikatorInfo | null>(null);
  const [currentVerifikator, setCurrentVerifikator] = useState<VerifikatorInfo | null>(null);

  useEffect(() => {
    if (user) {
      checkCurrentMembership();
    }
  }, [user]);

  const checkCurrentMembership = async () => {
    try {
      setInitialLoading(true);
      // Get current user's profile to find their verifikator_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('verifikator_id')
        .eq('id', user?.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setInitialLoading(false);
        return;
      }

      // If they have a verifikator_id, fetch that verifikator's details
      if (profile?.verifikator_id) {
        console.log("Found verifikator_id:", profile.verifikator_id);
        const { data: verifikatorData, error: verifikatorError } = await supabase
          .from('profiles')
          .select('id, full_name, business_name, referral_code, phone, email, address')
          .eq('id', profile.verifikator_id)
          .single();

        if (verifikatorError) {
          console.error('Error fetching verifikator details:', verifikatorError);
          // If we have an ID but can't fetch details (maybe deleted?), handle gracefully
        } else {
          console.log("Current verifikator details:", verifikatorData);
          setCurrentVerifikator(verifikatorData);
        }
      } else {
        console.log("No verifikator_id found on profile");
        setCurrentVerifikator(null);
      }
    } catch (error) {
      console.error('Error checking membership:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const searchVerifikator = async () => {
    if (!searchCode.trim()) {
      toast({
        title: "Kode kosong",
        description: "Mohon masukkan kode referal verifikator",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, business_name, referral_code, phone, email, address')
        .eq('referral_code', searchCode.toUpperCase())
        .eq('role', 'verifikator') // Ensure we only find verifikators
        .single();

      if (error || !data) {
        console.error('Search error:', error);
        toast({
          title: "Verifikator tidak ditemukan",
          description: "Pastikan kode referal yang anda masukkan benar dan pemilik kode adalah verifikator",
          variant: "destructive",
        });
        setVerifikator(null);
      } else {
        setVerifikator(data);
      }
    } catch (error) {
      console.error('Error searching verifikator:', error);
      toast({
        title: "Terjadi kesalahan",
        description: "Gagal mencari verifikator. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async () => {
    if (!verifikator || !user) return;

    setLoading(true);
    try {
      // Update merchant's profile with verifikator_id
      const { error } = await supabase
        .from('profiles')
        .update({ verifikator_id: verifikator.id })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Berhasil bergabung",
        description: `Anda telah bergabung dengan kelompok ${verifikator.business_name || verifikator.full_name}`,
      });
      
      setCurrentVerifikator(verifikator);
      setVerifikator(null);
      setSearchCode("");
      
      // Refresh membership status to be sure
      checkCurrentMembership();
    } catch (error) {
      console.error('Error joining group:', error);
      toast({
        title: "Gagal bergabung",
        description: "Terjadi kesalahan saat mencoba bergabung dengan kelompok",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Memuat Informasi Kelompok...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // State 1: Sudah bergabung dengan verifikator
  if (currentVerifikator) {
    return (
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-green-100 p-2 rounded-full">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-lg text-green-800">Anggota Kelompok Dagang</CardTitle>
                <CardDescription className="text-green-700/80">
                  Status: <span className="font-semibold text-green-700">Terverifikasi</span>
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={checkCurrentMembership} title="Refresh Data">
              <RefreshCw className="h-4 w-4 text-green-700" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-green-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="p-3 bg-green-50 rounded-lg shrink-0 flex items-center justify-center">
                <Store className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-2 flex-1">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">
                    {currentVerifikator.business_name || "Nama Kelompok"}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium">
                    Ketua/Verifikator: {currentVerifikator.full_name}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-2">
                  <div className="bg-green-50/50 p-2 rounded border border-green-100">
                    <span className="text-xs text-green-600 uppercase font-bold tracking-wider block mb-0.5">Kode Referal</span>
                    <span className="font-mono text-gray-700 font-medium">{currentVerifikator.referral_code}</span>
                  </div>
                  {currentVerifikator.phone && (
                    <div className="bg-green-50/50 p-2 rounded border border-green-100">
                      <span className="text-xs text-green-600 uppercase font-bold tracking-wider block mb-0.5">Kontak</span>
                      <span className="text-gray-700">{currentVerifikator.phone}</span>
                    </div>
                  )}
                </div>
                
                {currentVerifikator.address && (
                  <div className="text-sm text-gray-600 flex items-start gap-1.5 pt-1">
                    <span className="shrink-0 mt-0.5">📍</span>
                    <span>{currentVerifikator.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <Alert className="bg-blue-50 border-blue-200 text-blue-900">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800 font-semibold">Informasi Keanggotaan</AlertTitle>
            <AlertDescription className="text-blue-700 text-sm mt-1">
              Sebagai anggota, verifikator ini akan membantu memvalidasi produk, stok, dan transaksi Anda. Pastikan data produk Anda selalu update agar memudahkan proses verifikasi.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // State 2: Belum bergabung (Form Pencarian)
  return (
    <Card className="border-dashed border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Gabung Kelompok Dagang
        </CardTitle>
        <CardDescription>
          Anda belum terdaftar di kelompok dagang manapun. Masukkan kode referal verifikator Anda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Masukkan Kode (contoh: SU92BDXJ)"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="pl-9 uppercase font-medium tracking-wide"
              />
            </div>
            <Button onClick={searchVerifikator} disabled={loading}>
              {loading ? "Mencari..." : "Cari Verifikator"}
            </Button>
          </div>

          {verifikator && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-base text-gray-900">{verifikator.business_name || verifikator.full_name}</h4>
                  <p className="text-sm text-gray-500">{verifikator.full_name}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-mono">{verifikator.referral_code}</span>
                    <span>•</span>
                    <span className="line-clamp-1">{verifikator.address || "Lokasi tidak tersedia"}</span>
                  </div>
                </div>
              </div>
              <Button className="w-full" size="lg" onClick={joinGroup} disabled={loading}>
                Gabung dengan Kelompok Ini
              </Button>
            </div>
          )}
        </div>
        
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Belum punya kode?</AlertTitle>
          <AlertDescription className="text-yellow-700">
            Silakan hubungi verifikator atau koordinator dagang di wilayah Anda untuk mendapatkan kode referal.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};