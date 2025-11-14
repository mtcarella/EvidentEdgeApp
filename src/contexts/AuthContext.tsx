import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface SalesPerson {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'salesperson' | 'closer' | 'processor' | 'admin' | 'super_admin';
}

interface AuthContextType {
  user: User | null;
  userProfile: SalesPerson | null;
  salesPerson: SalesPerson | null;
  loading: boolean;
  isAdmin: boolean;
  isAdminOrProcessor: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [salesPerson, setSalesPerson] = useState<SalesPerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const fetchSalesPerson = async (userId: string) => {
    const { data } = await supabase
      .from('sales_people')
      .select('id, user_id, name, email, role')
      .eq('user_id', userId)
      .maybeSingle();

    setSalesPerson(data);
  };

  const updateLastActivity = () => {
    setLastActivity(Date.now());
  };

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, updateLastActivity);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateLastActivity);
      });
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const checkInactivity = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivity;
      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        signOut();
        alert('You have been logged out due to inactivity.');
      }
    }, 60000);

    return () => clearInterval(checkInactivity);
  }, [user, lastActivity]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchSalesPerson(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchSalesPerson(session.user.id);
        } else {
          setSalesPerson(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (!error && data.user) {
      await supabase.from('sales_people').insert({
        user_id: data.user.id,
        name,
        email,
        is_active: true,
      });
    }

    return { error };
  };

  const signOut = async () => {
    setSalesPerson(null);
    setUser(null);
    await supabase.auth.signOut();
  };

  const isAdmin = salesPerson?.role === 'admin' || salesPerson?.role === 'super_admin';
  const isAdminOrProcessor = salesPerson?.role === 'admin' || salesPerson?.role === 'processor' || salesPerson?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, userProfile: salesPerson, salesPerson, loading, isAdmin, isAdminOrProcessor, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
