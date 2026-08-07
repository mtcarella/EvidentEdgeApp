import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type AuthorizedCaller = {
  user: { id: string; email?: string | null };
  profile: {
    id: string;
    user_id: string;
    role: string;
    is_active: boolean;
    is_super_admin: boolean | null;
    name?: string | null;
    email?: string | null;
  };
};

export type AuthOptions = {
  // Required role(s). Empty array = any active staff member.
  requireRoles?: string[];
  // Trigger sources (e.g. cron) may pass the service-role key directly to bypass user auth.
  allowServiceRole?: boolean;
};

/**
 * Verify the caller's bearer token, look up their sales_people profile, and
 * return both. Returns null with a Response when caller is unauthorized; the
 * caller should return that Response immediately.
 */
export async function requireCaller(
  req: Request,
  opts: AuthOptions = {}
): Promise<{ ok: true; supabase: SupabaseClient; caller: AuthorizedCaller } | { ok: false; response: Response }> {
  const supabase = getServiceClient();
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return { ok: false, response: jsonResponse({ error: 'Unauthorized: no token provided' }, 401) };
  }

  if (opts.allowServiceRole && token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return {
      ok: true,
      supabase,
      caller: {
        user: { id: '00000000-0000-0000-0000-000000000000', email: 'service_role' },
        profile: {
          id: '00000000-0000-0000-0000-000000000000',
          user_id: '00000000-0000-0000-0000-000000000000',
          role: 'service_role',
          is_active: true,
          is_super_admin: true,
          name: 'service_role',
          email: 'service_role',
        },
      },
    };
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) {
    console.error('getUser failed:', userErr?.message ?? 'no user returned');
    return { ok: false, response: jsonResponse({ error: `Unauthorized: ${userErr?.message ?? 'invalid token'}` }, 401) };
  }

  const { data: profile, error: profileErr } = await supabase
    .from('sales_people')
    .select('id, user_id, role, is_active, is_super_admin, name, email')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (profileErr || !profile || profile.is_active === false) {
    return { ok: false, response: jsonResponse({ error: 'Forbidden' }, 403) };
  }

  if (opts.requireRoles && opts.requireRoles.length > 0) {
    const isSuper = profile.is_super_admin === true || profile.role === 'super_admin';
    if (!opts.requireRoles.includes(profile.role) && !isSuper) {
      return { ok: false, response: jsonResponse({ error: 'Forbidden' }, 403) };
    }
  }

  return {
    ok: true,
    supabase,
    caller: {
      user: { id: userData.user.id, email: userData.user.email ?? null },
      profile,
    },
  };
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPE_MAP[c] ?? c);
}
