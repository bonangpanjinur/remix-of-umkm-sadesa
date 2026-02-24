import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeStats {
  // Orders
  totalOrders: number;
  newOrders: number;
  processingOrders: number;
  completedOrders: number;
  todayOrders: number;
  todayRevenue: number;
  
  // Entities
  totalMerchants: number;
  activeMerchants: number;
  pendingMerchants: number;
  
  totalCouriers: number;
  availableCouriers: number;
  pendingCouriers: number;
  
  totalVillages: number;
  activeVillages: number;
  pendingVillages: number;
  
  totalProducts: number;
  activeProducts: number;
  
  // Last updated
  lastUpdated: Date;
}

interface RealtimeEvent {
  type: 'order' | 'merchant' | 'courier' | 'village' | 'product';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  data: Record<string, unknown>;
  timestamp: Date;
}

export function useRealtimeStats() {
  const [stats, setStats] = useState<RealtimeStats>({
    totalOrders: 0,
    newOrders: 0,
    processingOrders: 0,
    completedOrders: 0,
    todayOrders: 0,
    todayRevenue: 0,
    totalMerchants: 0,
    activeMerchants: 0,
    pendingMerchants: 0,
    totalCouriers: 0,
    availableCouriers: 0,
    pendingCouriers: 0,
    totalVillages: 0,
    activeVillages: 0,
    pendingVillages: 0,
    totalProducts: 0,
    activeProducts: 0,
    lastUpdated: new Date(),
  });
  
  const [recentEvents, setRecentEvents] = useState<RealtimeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch initial stats
  const fetchStats = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const [
        ordersRes,
        todayOrdersRes,
        merchantsRes,
        couriersRes,
        villagesRes,
        productsRes,
      ] = await Promise.all([
        // All orders with status counts
        supabase.from('orders').select('id, status, total'),
        // Today's orders
        supabase.from('orders').select('id, total, status').gte('created_at', `${today}T00:00:00`),
        // Merchants
        supabase.from('merchants').select('id, status, registration_status'),
        // Couriers
        supabase.from('couriers').select('id, status, registration_status, is_available'),
        // Villages
        supabase.from('villages').select('id, is_active, registration_status'),
        // Products
        supabase.from('products').select('id, is_active'),
      ]);

      const orders = ordersRes.data || [];
      const todayOrders = todayOrdersRes.data || [];
      const merchants = merchantsRes.data || [];
      const couriers = couriersRes.data || [];
      const villages = villagesRes.data || [];
      const products = productsRes.data || [];

      setStats({
        // Orders
        totalOrders: orders.length,
        newOrders: orders.filter(o => o.status === 'NEW').length,
        processingOrders: orders.filter(o => ['PROCESSED', 'SENT'].includes(o.status)).length,
        completedOrders: orders.filter(o => o.status === 'DONE').length,
        todayOrders: todayOrders.length,
        todayRevenue: todayOrders.filter(o => o.status === 'DONE').reduce((sum, o) => sum + (o.total || 0), 0),
        
        // Merchants
        totalMerchants: merchants.length,
        activeMerchants: merchants.filter(m => m.status === 'ACTIVE').length,
        pendingMerchants: merchants.filter(m => m.registration_status === 'PENDING').length,
        
        // Couriers
        totalCouriers: couriers.length,
        availableCouriers: couriers.filter(c => c.is_available && c.status === 'ACTIVE').length,
        pendingCouriers: couriers.filter(c => c.registration_status === 'PENDING').length,
        
        // Villages
        totalVillages: villages.length,
        activeVillages: villages.filter(v => v.is_active).length,
        pendingVillages: villages.filter(v => v.registration_status === 'PENDING').length,
        
        // Products
        totalProducts: products.length,
        activeProducts: products.filter(p => p.is_active).length,
        
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error('Error fetching realtime stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Add event to recent events
  const addEvent = useCallback((event: Omit<RealtimeEvent, 'timestamp'>) => {
    const newEvent = { ...event, timestamp: new Date() };
    setRecentEvents(prev => [newEvent, ...prev].slice(0, 20)); // Keep last 20 events
  }, []);

  useEffect(() => {
    fetchStats();

    // Set up realtime subscriptions
    const channels: RealtimeChannel[] = [];

    // Orders channel
    const ordersChannel = supabase
      .channel('realtime-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          
          addEvent({
            type: 'order',
            action: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            data: payload.new as Record<string, unknown> || payload.old as Record<string, unknown> || {},
          });
          fetchStats(); // Refresh stats on any order change
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        }
      });
    channels.push(ordersChannel);

    // Merchants channel
    const merchantsChannel = supabase
      .channel('realtime-merchants')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'merchants' },
        (payload) => {
          
          addEvent({
            type: 'merchant',
            action: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            data: payload.new as Record<string, unknown> || payload.old as Record<string, unknown> || {},
          });
          fetchStats();
        }
      )
      .subscribe();
    channels.push(merchantsChannel);

    // Couriers channel
    const couriersChannel = supabase
      .channel('realtime-couriers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'couriers' },
        (payload) => {
          
          addEvent({
            type: 'courier',
            action: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            data: payload.new as Record<string, unknown> || payload.old as Record<string, unknown> || {},
          });
          fetchStats();
        }
      )
      .subscribe();
    channels.push(couriersChannel);

    // Villages channel
    const villagesChannel = supabase
      .channel('realtime-villages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'villages' },
        (payload) => {
          
          addEvent({
            type: 'village',
            action: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            data: payload.new as Record<string, unknown> || payload.old as Record<string, unknown> || {},
          });
          fetchStats();
        }
      )
      .subscribe();
    channels.push(villagesChannel);

    // Products channel
    const productsChannel = supabase
      .channel('realtime-products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          
          addEvent({
            type: 'product',
            action: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            data: payload.new as Record<string, unknown> || payload.old as Record<string, unknown> || {},
          });
          fetchStats();
        }
      )
      .subscribe();
    channels.push(productsChannel);

    // Cleanup
    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
      setIsConnected(false);
    };
  }, [fetchStats, addEvent]);

  return {
    stats,
    recentEvents,
    isConnected,
    loading,
    refresh: fetchStats,
  };
}
