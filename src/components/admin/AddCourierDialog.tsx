import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AddCourierDialogProps {
  onSuccess: () => void;
}

export function AddCourierDialog({ onSuccess }: AddCourierDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    province: 'Jawa Barat',
    city: '',
    district: '',
    subdistrict: '',
    address: '',
    ktp_number: '',
    vehicle_type: 'motor',
    vehicle_plate: '',
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || !formData.ktp_number) {
      toast.error('Nama, telepon, dan No. KTP wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('couriers').insert({
        name: formData.name,
        phone: formData.phone,
        email: formData.email || null,
        province: formData.province,
        city: formData.city,
        district: formData.district,
        subdistrict: formData.subdistrict,
        address: formData.address,
        ktp_number: formData.ktp_number,
        ktp_image_url: 'https://placeholder.co/400x300?text=KTP', // Placeholder for admin-added
        photo_url: 'https://placeholder.co/200x200?text=Foto',
        vehicle_type: formData.vehicle_type,
        vehicle_plate: formData.vehicle_plate || null,
        vehicle_image_url: 'https://placeholder.co/400x300?text=Kendaraan',
        registration_status: 'APPROVED', // Direct approval by admin
        status: 'ACTIVE',
        approved_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success('Kurir berhasil ditambahkan');
      setOpen(false);
      resetForm();
      onSuccess();
    } catch (error) {
      console.error('Error adding courier:', error);
      toast.error('Gagal menambahkan kurir');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      province: 'Jawa Barat',
      city: '',
      district: '',
      subdistrict: '',
      address: '',
      ktp_number: '',
      vehicle_type: 'motor',
      vehicle_plate: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Kurir
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Kurir Baru</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nama Lengkap *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nama kurir"
              />
            </div>
            <div>
              <Label>No. Telepon *</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="08xxxxxxxxxx"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@contoh.com"
              />
            </div>
          </div>

          {/* Identity */}
          <div>
            <Label>No. KTP *</Label>
            <Input
              value={formData.ktp_number}
              onChange={(e) => setFormData({ ...formData, ktp_number: e.target.value })}
              placeholder="16 digit nomor KTP"
              maxLength={16}
            />
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Provinsi</Label>
              <Input
                value={formData.province}
                onChange={(e) => setFormData({ ...formData, province: e.target.value })}
              />
            </div>
            <div>
              <Label>Kota/Kabupaten</Label>
              <Input
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Kota/Kabupaten"
              />
            </div>
            <div>
              <Label>Kecamatan</Label>
              <Input
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                placeholder="Kecamatan"
              />
            </div>
            <div>
              <Label>Kelurahan/Desa</Label>
              <Input
                value={formData.subdistrict}
                onChange={(e) => setFormData({ ...formData, subdistrict: e.target.value })}
                placeholder="Kelurahan/Desa"
              />
            </div>
          </div>

          <div>
            <Label>Alamat Lengkap</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Jl. Contoh No. 123"
            />
          </div>

          {/* Vehicle */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Jenis Kendaraan</Label>
              <Select
                value={formData.vehicle_type}
                onValueChange={(v) => setFormData({ ...formData, vehicle_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="motor">Motor</SelectItem>
                  <SelectItem value="mobil">Mobil</SelectItem>
                  <SelectItem value="sepeda">Sepeda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plat Nomor</Label>
              <Input
                value={formData.vehicle_plate}
                onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value.toUpperCase() })}
                placeholder="B 1234 ABC"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Menyimpan...' : 'Tambah Kurir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
