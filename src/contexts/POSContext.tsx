import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface POSTenant {
  id: string;
  name: string;
  logo_url?: string;
  phone?: string;
  address?: string;
  currency: string;
  timezone: string;
}

interface POSOutlet {
  id: string;
  tenant_id: string;
  name: string;
  address?: string;
  phone?: string;
  is_active: boolean;
}

interface POSContextType {
  tenant: POSTenant | null;
  activeOutlet: POSOutlet | null;
  outlets: POSOutlet[];
  loading: boolean;
  setActiveOutlet: (outlet: POSOutlet) => void;
  refetchTenant: () => Promise<void>;
  refetchOutlets: () => Promise<void>;
  formatCurrency: (amount: number) => string;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export function POSProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<POSTenant | null>(null);
  const [outlets, setOutlets] = useState<POSOutlet[]>([]);
  const [activeOutlet, setActiveOutlet] = useState<POSOutlet | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenant = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('pos_tenants' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      setTenant(data as unknown as POSTenant | null);
    } catch (err) {
      console.error('Error fetching POS tenant:', err);
    }
  };

  const fetchOutlets = async () => {
    if (!tenant) return;
    try {
      const { data } = await supabase
        .from('pos_outlets' as any)
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name');
      const outletList = (data || []) as unknown as POSOutlet[];
      setOutlets(outletList);
      if (!activeOutlet && outletList.length > 0) {
        setActiveOutlet(outletList[0]);
      }
    } catch (err) {
      console.error('Error fetching outlets:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchTenant();
      setLoading(false);
    };
    if (user) init();
    else setLoading(false);
  }, [user]);

  useEffect(() => {
    if (tenant) fetchOutlets();
  }, [tenant]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: tenant?.currency || 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <POSContext.Provider value={{
      tenant,
      activeOutlet,
      outlets,
      loading,
      setActiveOutlet,
      refetchTenant: fetchTenant,
      refetchOutlets: fetchOutlets,
      formatCurrency,
    }}>
      {children}
    </POSContext.Provider>
  );
}

export function usePOS() {
  const ctx = useContext(POSContext);
  if (!ctx) throw new Error('usePOS must be used within POSProvider');
  return ctx;
}
