import { useState, useEffect, useCallback, useRef } from "react";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { locationService, Region } from "@/services/locationService";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

// Schema validasi form
const formSchema = z.object({
  shopName: z.string().min(3, "Nama toko minimal 3 karakter"),
  description: z.string().min(10, "Deskripsi minimal 10 karakter"),
  province: z.string().min(1, "Provinsi wajib dipilih"),
  city: z.string().min(1, "Kota/Kabupaten wajib dipilih"),
  district: z.string().min(1, "Kecamatan wajib dipilih"),
  village: z.string().min(1, "Kelurahan wajib dipilih"),
  address: z.string().min(10, "Alamat lengkap wajib diisi"),
  phone: z.string().min(10, "Nomor telepon tidak valid"),
});

export default function SellerApplicationForm() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State untuk data wilayah
  const [provinces, setProvinces] = useState<Region[]>([]);
  const [cities, setCities] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [villages, setVillages] = useState<Region[]>([]);

  // State loading untuk dropdown wilayah
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false);
  const [isLoadingVillages, setIsLoadingVillages] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      shopName: "",
      description: "",
      province: "",
      city: "",
      district: "",
      village: "",
      address: "",
      phone: "",
    },
  });

  // 1. Fetch Provinsi saat komponen di-mount
  useEffect(() => {
    const fetchProvincesData = async () => {
      setIsLoadingProvinces(true);
      const data = await locationService.getProvinces();
      setProvinces(data);
      setIsLoadingProvinces(false);
    };
    fetchProvincesData();
  }, []);

  // 2. Handler perubahan Provinsi -> Fetch Kota
  const handleProvinceChange = async (value: string) => {
    form.setValue("province", value);
    // Reset field di bawahnya
    form.setValue("city", "");
    form.setValue("district", "");
    form.setValue("village", "");
    setCities([]);
    setDistricts([]);
    setVillages([]);

    if (value) {
      setIsLoadingCities(true);
      const data = await locationService.getRegencies(value);
      setCities(data);
      setIsLoadingCities(false);
    }
  };

  // 3. Handler perubahan Kota -> Fetch Kecamatan
  const handleCityChange = async (value: string) => {
    form.setValue("city", value);
    form.setValue("district", "");
    form.setValue("village", "");
    setDistricts([]);
    setVillages([]);

    if (value) {
      setIsLoadingDistricts(true);
      const data = await locationService.getDistricts(value);
      setDistricts(data);
      setIsLoadingDistricts(false);
    }
  };

  // 4. Handler perubahan Kecamatan -> Fetch Kelurahan
  const handleDistrictChange = async (value: string) => {
    form.setValue("district", value);
    form.setValue("village", "");
    setVillages([]);

    if (value) {
      setIsLoadingVillages(true);
      const data = await locationService.getVillages(value);
      setVillages(data);
      setIsLoadingVillages(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          variant: "destructive",
          title: "Gagal",
          description: "Anda harus login terlebih dahulu",
        });
        return;
      }

      // Mendapatkan nama wilayah dari ID untuk disimpan
      const provinceName = locationService.getNameById(provinces, values.province);
      const cityName = locationService.getNameById(cities, values.city);
      const districtName = locationService.getNameById(districts, values.district);
      const villageName = locationService.getNameById(villages, values.village);

      // Simpan ke database
      const { error } = await supabase
        .from('merchants') 
        .insert({
          user_id: user.id,
          name: values.shopName,
          business_description: values.description,
          phone: values.phone,
          address_detail: values.address,
          province: provinceName,
          city: cityName,
          district: districtName,
          subdistrict: villageName,
          status: 'PENDING',
        });

      if (error) throw error;

      toast({
        title: "Pendaftaran Berhasil",
        description: "Aplikasi merchant Anda telah dikirim untuk ditinjau.",
      });
      
      navigate("/merchant/dashboard");

    } catch (error: any) {
      console.error("Submission error:", error);
      toast({
        variant: "destructive",
        title: "Gagal Mengirim",
        description: error.message || "Terjadi kesalahan saat menyimpan data",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="mb-8 text-center">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
          <Store className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Daftar Merchant Baru</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Mulai berjualan dengan mengisi data usaha Anda</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center">1</span>
              Informasi Toko
            </h3>
            
            <FormField
              control={form.control}
              name="shopName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Toko</FormLabel>
                  <FormControl>
                    <Input placeholder="Contoh: Barokah Toko" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deskripsi Singkat</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Jelaskan produk yang Anda jual..." 
                      className="resize-none h-24"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nomor WhatsApp</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="08xxxxxxxxxx" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 my-6"></div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center">2</span>
              Lokasi Usaha
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provinsi</FormLabel>
                    <Select 
                      onValueChange={handleProvinceChange} 
                      value={field.value}
                      disabled={isLoadingProvinces}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingProvinces ? "Memuat..." : "Pilih Provinsi"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {provinces.map((prov) => (
                          <SelectItem key={prov.code} value={prov.code}>
                            {prov.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kota/Kabupaten</FormLabel>
                    <Select 
                      onValueChange={handleCityChange} 
                      value={field.value}
                      disabled={isLoadingCities || !form.watch("province")}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingCities ? "Memuat..." : "Pilih Kota"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cities.map((city) => (
                          <SelectItem key={city.code} value={city.code}>
                            {city.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kecamatan</FormLabel>
                    <Select 
                      onValueChange={handleDistrictChange} 
                      value={field.value}
                      disabled={isLoadingDistricts || !form.watch("city")}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingDistricts ? "Memuat..." : "Pilih Kecamatan"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {districts.map((dist) => (
                          <SelectItem key={dist.code} value={dist.code}>
                            {dist.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="village"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kelurahan/Desa</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={isLoadingVillages || !form.watch("district")}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingVillages ? "Memuat..." : "Pilih Kelurahan"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {villages.map((v) => (
                          <SelectItem key={v.code} value={v.code}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alamat Lengkap</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Nama jalan, nomor rumah, RT/RW..." 
                      className="resize-none h-20"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengirim...
              </>
            ) : (
              "Daftar Sekarang"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
