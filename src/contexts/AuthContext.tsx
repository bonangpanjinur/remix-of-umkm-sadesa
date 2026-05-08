import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/types/auth';

const AUTH_CHANNEL_NAME = 'desamart_auth';

interface AuthUser {
  id: string;
  email: string;
  user_metadata?: { full_name?: string };
}

interface AuthSession {
  user: AuthUser;
  access_token: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  roles: AppRole[];
  loading: boolean;
  rolesLoading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ data: any; error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  isAdmin: boolean;
  isVerifikator: boolean;
  isMerchant: boolean;
  isCourier: boolean;
  isAdminDesa: boolean;
  refetchRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  const fetchUserRoles = useCallback(async (userId: string) => {
    try {
      setRolesLoading(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) throw error;

      const userRoles = (data || []).map(r => r.role as AppRole);
      setRoles(userRoles.length > 0 ? userRoles : ['buyer']);
    } catch (err) {
      console.error('Error fetching user roles:', err);
      setRoles(['buyer']);
    } finally {
      setRolesLoading(false);
    }
  }, []);

  const refetchRoles = useCallback(async () => {
    if (user) {
      await fetchUserRoles(user.id);
    }
  }, [user, fetchUserRoles]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session as AuthSession | null);
        setUser(session?.user as AuthUser | null ?? null);

        if (session?.user) {
          await fetchUserRoles(session.user.id);
        } else {
          setRoles([]);
          setRolesLoading(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session as AuthSession | null);
      setUser(session?.user as AuthUser | null ?? null);

      if (session?.user) {
        await fetchUserRoles(session.user.id);
      } else {
        setRolesLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRoles]);

  // R-03: Multi-tab auth sync via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
    broadcastRef.current = channel;

    channel.onmessage = (event: MessageEvent) => {
      const { type } = event.data as { type: 'LOGOUT' | 'LOGIN' };

      if (type === 'LOGOUT') {
        // Tab lain logout — bersihkan state di tab ini tanpa memanggil signOut lagi
        supabase.auth.signOut().catch(() => {});
        setUser(null);
        setSession(null);
        setRoles([]);
        setLoading(false);
        setRolesLoading(false);
        // Arahkan ke halaman auth
        window.location.href = '/auth';
      } else if (type === 'LOGIN') {
        // Tab lain login — refresh session agar tab ini ikut terotentikasi
        supabase.auth.getSession().then(async ({ data: { session } }) => {
          if (session?.user) {
            setSession(session as AuthSession | null);
            setUser(session.user as AuthUser);
            await fetchUserRoles(session.user.id);
            setLoading(false);
          }
        });
      }
    };

    return () => {
      channel.close();
      broadcastRef.current = null;
    };
  }, [fetchUserRoles]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!error) {
      broadcastRef.current?.postMessage({ type: 'LOGIN' });
    }
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
    // R-03: Beritahu semua tab lain agar ikut logout
    broadcastRef.current?.postMessage({ type: 'LOGOUT' });
  };

  const hasRole = useCallback((role: AppRole): boolean => {
    return roles.includes(role);
  }, [roles]);

  const hasAnyRole = useCallback((checkRoles: AppRole[]): boolean => {
    return checkRoles.some(role => roles.includes(role));
  }, [roles]);

  const isAdmin = hasRole('admin');
  const isVerifikator = hasRole('verifikator');
  const isMerchant = hasRole('merchant');
  const isCourier = hasRole('courier');
  const isAdminDesa = hasRole('admin_desa');

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        loading,
        rolesLoading,
        signUp,
        signIn,
        signOut,
        hasRole,
        hasAnyRole,
        isAdmin,
        isVerifikator,
        isMerchant,
        isCourier,
        isAdminDesa,
        refetchRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
