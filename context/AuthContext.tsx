import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';

type AuthContextType = {
  session: Session | null;
  tenantId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  tenantId: null,
  loading: true,
  signOut: async () => undefined,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Al abrir la app, revisa si ya hay una sesión guardada
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Se ejecuta cada vez que cambia el estado de auth (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Cuando hay sesión, buscamos el tenant_id asociado a ese usuario
    async function fetchTenant() {
      if (!session?.user) {
        setTenantId(null);
        return;
      }
      const { data, error } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_user_id', session.user.id)
        .single();

      if (!error && data) setTenantId(data.id);
    }
    fetchTenant();
  }, [session]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, tenantId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);