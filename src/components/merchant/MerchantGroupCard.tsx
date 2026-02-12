import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, Copy, Plus, LogIn, Loader2 } from "lucide-react";

export default function MerchantGroupCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [currentGroup, setCurrentGroup] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCurrentGroup();
  }, []);

  const fetchCurrentGroup = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Cari profil merchant milik user
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id, trade_group_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (merchant?.trade_group_id) {
        const { data: group } = await supabase
          .from('trade_groups')
          .select('*')
          .eq('id', merchant.trade_group_id)
          .single();
        
        setCurrentGroup(group);
      }
    } catch (error) {
      console.error("Error fetching group:", error);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast({ title: "Peringatan", description: "Nama kelompok harus diisi", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Silakan login terlebih dahulu");

      // GENERATE KODE UNIK OTOMATIS
      // Database mewajibkan kolom 'code' terisi (NOT NULL).
      // Kita buat kode acak 6 karakter, misal: G-A1B2C3
      const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const generatedCode = `G-${randomCode}`;

      // Insert kelompok dagang baru dengan menyertakan 'code'
      const { data: newGroup, error: groupError } = await supabase
        .from('trade_groups')
        .insert({
          name: groupName,
          code: generatedCode, // <- Ini perbaikan utamanya: mengisi kolom code
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Update merchant untuk masuk ke kelompok baru
      const { error: updateError } = await supabase
        .from('merchants')
        .update({ trade_group_id: newGroup.id })
        .eq('user_id', user.id);

      if (updateError) {
        console.error("Gagal update merchant info, mencoba fallback...", updateError);
        // Fallback jika menggunakan merchant_profiles (untuk kompatibilitas backward)
        await supabase
          .from('merchant_profiles')
          .update({ trade_group_id: newGroup.id })
          .eq('user_id', user.id);
      }

      setCurrentGroup(newGroup);
      toast({ title: "Berhasil", description: `Kelompok '${groupName}' berhasil dibuat dengan kode ${generatedCode}` });
      setGroupName("");
    } catch (error: any) {
      console.error("Create group error:", error);
      toast({
        title: "Gagal membuat kelompok",
        description: error.message || "Terjadi kesalahan pada database",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!joinCode.trim()) return;
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Silakan login terlebih dahulu");

      // Cari grup berdasarkan kode yang diinput
      const { data: group, error: findError } = await supabase
        .from('trade_groups')
        .select('*')
        .eq('code', joinCode.trim().toUpperCase()) // Pastikan uppercase saat mencari
        .single();

      if (findError || !group) {
        throw new Error("Kelompok tidak ditemukan. Pastikan kode benar.");
      }

      // Update merchant join ke grup
      const { error: updateError } = await supabase
        .from('merchants')
        .update({ trade_group_id: group.id })
        .eq('user_id', user.id);

      if (updateError) {
        // Fallback
        await supabase
          .from('merchant_profiles')
          .update({ trade_group_id: group.id })
          .eq('user_id', user.id);
      }

      setCurrentGroup(group);
      toast({ title: "Berhasil", description: `Berhasil bergabung ke kelompok ${group.name}` });
      setJoinCode("");
    } catch (error: any) {
      toast({
        title: "Gagal bergabung",
        description: error.message || "Terjadi kesalahan",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('merchants')
        .update({ trade_group_id: null })
        .eq('user_id', user.id);

      if (error) {
        await supabase
          .from('merchant_profiles')
          .update({ trade_group_id: null })
          .eq('user_id', user.id);
      }

      setCurrentGroup(null);
      toast({ title: "Berhasil", description: "Berhasil keluar dari kelompok" });
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = () => {
    if (currentGroup?.code) {
      navigator.clipboard.writeText(currentGroup.code);
      toast({ title: "Tersalin", description: "Kode kelompok disalin ke clipboard" });
    }
  };

  if (currentGroup) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Kelompok Dagang Anda
          </CardTitle>
          <CardDescription>Informasi kelompok dagang yang Anda ikuti saat ini.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Nama Kelompok</p>
            <p className="text-lg font-semibold">{currentGroup.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Kode Undangan (Referral)</p>
            <div className="flex items-center gap-2">
              <code className="px-3 py-1.5 bg-muted rounded-md font-mono text-lg tracking-widest text-primary font-bold">
                {currentGroup.code}
              </code>
              <Button variant="outline" size="icon" onClick={copyCode}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Bagikan kode ini agar pedagang lain bisa bergabung ke kelompok Anda.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10" onClick={handleLeaveGroup} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Keluar dari Kelompok
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Kelompok Dagang
        </CardTitle>
        <CardDescription>
          Bergabung dengan kelompok dagang komunitas untuk saling berkolaborasi, atau buat kelompok Anda sendiri.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h3 className="font-medium text-sm">Buat Kelompok Baru</h3>
          <div className="flex gap-2">
            <Input
              placeholder="Masukkan nama kelompok..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={isLoading}
            />
            <Button onClick={handleCreateGroup} disabled={isLoading || !groupName.trim()}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Buat
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Kode referral kelompok akan dibuat otomatis setelah Anda menekan tombol Buat.
          </p>
        </div>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-muted" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground font-medium">Atau</span>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-medium text-sm">Bergabung ke Kelompok</h3>
          <div className="flex gap-2">
            <Input
              placeholder="Masukkan kode unik (cth: G-A1B2C3)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              disabled={isLoading}
              className="uppercase"
            />
            <Button variant="secondary" onClick={handleJoinGroup} disabled={isLoading || !joinCode.trim()}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
              Gabung
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}