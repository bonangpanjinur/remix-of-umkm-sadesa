import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface SavedAddress {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  phone: string;
  province_id: string | null;
  province_name: string | null;
  city_id: string | null;
  city_name: string | null;
  district_id: string | null;
  district_name: string | null;
  village_id: string | null;
  village_name: string | null;
  address_detail: string | null;
  full_address: string | null;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedAddressInput {
  label: string;
  recipient_name: string;
  phone: string;
  province_id?: string;
  province_name?: string;
  city_id?: string;
  city_name?: string;
  district_id?: string;
  district_name?: string;
  village_id?: string;
  village_name?: string;
  address_detail?: string;
  full_address?: string;
  lat?: number;
  lng?: number;
  is_default?: boolean;
}

export function useSavedAddresses() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAddresses = async () => {
    if (!user) {
      setAddresses([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (error) {
      console.error('Error fetching addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, [user]);

  const addAddress = async (input: SavedAddressInput): Promise<SavedAddress | null> => {
    if (!user) return null;

    try {
      // If this is set as default, unset other defaults first
      if (input.is_default) {
        await supabase
          .from('saved_addresses')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const { data, error } = await supabase
        .from('saved_addresses')
        .insert({
          user_id: user.id,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchAddresses();
      toast({ title: 'Alamat berhasil disimpan' });
      return data;
    } catch (error) {
      console.error('Error adding address:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan alamat';
      toast({ 
        title: 'Gagal menyimpan alamat', 
        description: errorMessage,
        variant: 'destructive' 
      });
      return null;
    }
  };

  const updateAddress = async (id: string, input: Partial<SavedAddressInput>): Promise<boolean> => {
    if (!user) return false;

    try {
      // If this is set as default, unset other defaults first
      if (input.is_default) {
        await supabase
          .from('saved_addresses')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const { error } = await supabase
        .from('saved_addresses')
        .update(input)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchAddresses();
      toast({ title: 'Alamat berhasil diperbarui' });
      return true;
    } catch (error) {
      console.error('Error updating address:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat memperbarui alamat';
      toast({ 
        title: 'Gagal memperbarui alamat', 
        description: errorMessage,
        variant: 'destructive' 
      });
      return false;
    }
  };

  const deleteAddress = async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('saved_addresses')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchAddresses();
      toast({ title: 'Alamat berhasil dihapus' });
      return true;
    } catch (error) {
      console.error('Error deleting address:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat menghapus alamat';
      toast({ 
        title: 'Gagal menghapus alamat', 
        description: errorMessage,
        variant: 'destructive' 
      });
      return false;
    }
  };

  const setDefaultAddress = async (id: string): Promise<boolean> => {
    return updateAddress(id, { is_default: true });
  };

  const getDefaultAddress = (): SavedAddress | undefined => {
    return addresses.find(a => a.is_default) || addresses[0];
  };

  return {
    addresses,
    loading,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    getDefaultAddress,
    refetch: fetchAddresses,
  };
}
