import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { supabaseProxy } from './supabaseProxy';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const useProxy = import.meta.env.VITE_USE_PROXY === 'true';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const directClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'supabase.auth.token',
    storage: window.localStorage,
  },
});

export const supabase = useProxy ? (supabaseProxy as any) : directClient;
