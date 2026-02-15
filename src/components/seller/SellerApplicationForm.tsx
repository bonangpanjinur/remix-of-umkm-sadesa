import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AddressSelector, AddressData, createEmptyAddressData } from "@/components/AddressSelector";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const formSchema = z.object({
  shopName: z.string().min(3, "Nama toko minimal 3 karakter"),
  description: z.string().min(10, "Deskripsi minimal 10 karakter"),
  address: z.string().min(10, "Alamat lengkap wajib diisi"),
  phone: z.string().min(10, "Nomor telepon tidak valid"),
});

export default function SellerApplicationForm() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressData, setAddressData] = useState<AddressData>(createEmptyAddressData());

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      shopName: "",
      description: "",
      address: "",
      phone: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!addressData.province || !addressData.city || !addressData.district || !addressData.village) {
      toast({
        variant: "destructive",
        title: "Lengkapi Alamat",
        description: "Semua field alamat (provinsi, kota, kecamatan, kelurahan) wajib dipilih",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ variant: "destructive", title: "Gagal", description: "Anda harus login terlebih dahulu" });
        return;
      }

      const { error } = await supabase.from('merchants').insert({
        user_id: user.id,
        name: values.shopName,
        business_description: values.description,
        phone: values.phone,
        address: values.address,
        province: addressData.provinceName,
        city: addressData.cityName,
        district: addressData.districtName,
        subdistrict: addressData.villageName,
        status: 'PENDING',
      });

      if (error) throw error;

      toast({ title: "Pendaftaran Berhasil", description: "Aplikasi merchant Anda telah dikirim untuk ditinjau." });
      navigate("/merchant/dashboard");
    } catch (error: any) {
      console.error("Submission error:", error);
      toast({ variant: "destructive", title: "Gagal Mengirim", description: error.message || "Terjadi kesalahan saat menyimpan data" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 bg-card rounded-2xl shadow-lg border border-border">
      <div className="mb-10 text-center">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
          <Store className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold text-foreground tracking-tight">Daftar Merchant Baru</h2>
        <p className="text-muted-foreground mt-3 text-lg">Mulai kembangkan usaha Anda bersama kami</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Section 1: Profil Usaha */}
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">1</div>
              <h3 className="text-xl font-bold text-foreground">Profil Usaha</h3>
            </div>
            
            <FormField control={form.control} name="shopName" render={({ field }) => (
              <FormItem>
                <FormLabel>Nama Toko / Usaha</FormLabel>
                <FormControl><Input placeholder="Contoh: Kedai Berkah Jaya" className="h-11" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Deskripsi Usaha</FormLabel>
                <FormControl>
                  <Textarea placeholder="Ceritakan sedikit tentang produk atau layanan Anda..." className="resize-none h-28" {...field} />
                </FormControl>
                <FormDescription>Minimal 10 karakter agar calon pelanggan mengenal usaha Anda.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Nomor WhatsApp Aktif</FormLabel>
                <FormControl><Input type="tel" placeholder="081234567890" className="h-11" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-8"></div>

          {/* Section 2: Lokasi Operasional */}
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">2</div>
              <h3 className="text-xl font-bold text-foreground">Lokasi Operasional</h3>
            </div>

            <AddressSelector
              value={addressData}
              onChange={setAddressData}
              showDetailInput={false}
            />

            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>Alamat Lengkap</FormLabel>
                <FormControl>
                  <Textarea placeholder="Nama jalan, blok, nomor rumah, RT/RW..." className="resize-none h-24" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <Button type="submit" className="w-full h-12 text-lg font-bold shadow-md hover:shadow-lg transition-all" disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Memproses Pendaftaran...</>
            ) : (
              "Daftar Sebagai Merchant"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
