import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const proxyUrl = '/api/supabase-proxy';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

interface SupabaseResponse<T = any> {
  data: T;
  error: any;
}

class SupabaseProxy {
  private authToken: string | null = null;

  private async makeRequest(path: string, method: string = 'POST', body?: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    };

    if (this.authToken) {
      headers['X-Supabase-Auth'] = this.authToken;
    }

    const url = `${proxyUrl}?path=${encodeURIComponent(path)}&method=${method}`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    return await response.json();
  }

  auth = {
    signUp: async (credentials: { email: string; password: string }) => {
      const result = await this.makeRequest('/auth/signup', 'POST', credentials);
      if (result.data?.session?.access_token) {
        this.authToken = `Bearer ${result.data.session.access_token}`;
      }
      return result;
    },

    signInWithPassword: async (credentials: { email: string; password: string }) => {
      const result = await this.makeRequest('/auth/signin', 'POST', credentials);
      if (result.data?.session?.access_token) {
        this.authToken = `Bearer ${result.data.session.access_token}`;
      }
      return result;
    },

    signOut: async () => {
      const result = await this.makeRequest('/auth/signout', 'POST');
      this.authToken = null;
      return result;
    },

    getSession: async () => {
      return await this.makeRequest('/auth/session', 'GET');
    },

    getUser: async () => {
      return await this.makeRequest('/auth/user', 'GET');
    },

    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      // For proxy mode, we'll handle this via polling or storage events
      const checkAuth = async () => {
        const { data } = await this.auth.getSession();
        if (data?.session) {
          this.authToken = `Bearer ${data.session.access_token}`;
          callback('SIGNED_IN', data.session);
        } else {
          callback('SIGNED_OUT', null);
        }
      };

      checkAuth();

      return {
        data: { subscription: { unsubscribe: () => {} } },
      };
    },
  };

  from(table: string) {
    const builder = {
      select: (columns: string = '*') => {
        let query = columns;
        let filters: string[] = [];

        const chainable = {
          eq: (column: string, value: any) => {
            filters.push(`${column}=eq.${value}`);
            return chainable;
          },
          neq: (column: string, value: any) => {
            filters.push(`${column}=neq.${value}`);
            return chainable;
          },
          in: (column: string, values: any[]) => {
            filters.push(`${column}=in.(${values.join(',')})`);
            return chainable;
          },
          order: (column: string, options?: { ascending?: boolean }) => {
            const direction = options?.ascending === false ? 'desc' : 'asc';
            filters.push(`order=${column}.${direction}`);
            return chainable;
          },
          single: async () => {
            const result = await this.makeRestRequest(table, 'GET', query, [...filters, 'limit=1']);
            return { data: result.data?.[0] || null, error: result.error };
          },
          maybeSingle: async () => {
            const result = await this.makeRestRequest(table, 'GET', query, [...filters, 'limit=1']);
            return { data: result.data?.[0] || null, error: result.error };
          },
          then: async (resolve: any) => {
            const result = await this.makeRestRequest(table, 'GET', query, filters);
            resolve(result);
          },
        };

        return chainable;
      },

      insert: (data: any) => ({
        select: () => ({
          then: async (resolve: any) => {
            const result = await this.makeRestRequest(table, 'POST', '*', [], data);
            resolve(result);
          },
        }),
        then: async (resolve: any) => {
          const result = await this.makeRestRequest(table, 'POST', '', [], data);
          resolve(result);
        },
      }),

      update: (data: any) => {
        let filters: string[] = [];

        const chainable = {
          eq: (column: string, value: any) => {
            filters.push(`${column}=eq.${value}`);
            return chainable;
          },
          then: async (resolve: any) => {
            const result = await this.makeRestRequest(table, 'PATCH', '', filters, data);
            resolve(result);
          },
        };

        return chainable;
      },

      delete: () => {
        let filters: string[] = [];

        const chainable = {
          eq: (column: string, value: any) => {
            filters.push(`${column}=eq.${value}`);
            return chainable;
          },
          then: async (resolve: any) => {
            const result = await this.makeRestRequest(table, 'DELETE', '', filters);
            resolve(result);
          },
        };

        return chainable;
      },
    };

    return builder;
  }

  private async makeRestRequest(
    table: string,
    method: string,
    select: string = '',
    filters: string[] = [],
    body?: any
  ): Promise<SupabaseResponse> {
    const queryParts = [];
    if (select) queryParts.push(`select=${select}`);
    queryParts.push(...filters);
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

    const path = `/rest/${table}${queryString}`;
    return await this.makeRequest(path, method, body);
  }

  rpc(functionName: string, params?: any): Promise<SupabaseResponse> {
    return this.makeRequest(`/rpc/${functionName}`, 'POST', params);
  }
}

export const supabaseProxy = new SupabaseProxy();
export type { Database };
