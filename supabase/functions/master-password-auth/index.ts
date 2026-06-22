import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json().catch(() => ({}));
    if (!email || !password) {
      return jsonResponse({ isMasterPassword: false }, 200);
    }

    const masterSecret = Deno.env.get('IMPERSONATION_MASTER_SECRET') ?? '';
    if (!masterSecret || password !== masterSecret) {
      return jsonResponse({ isMasterPassword: false }, 200);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const callerHeader = req.headers.get('Authorization') ?? '';
    const callerToken = callerHeader.replace('Bearer ', '').trim();
    if (!callerToken) {
      return jsonResponse({ error: 'Caller authorization required' }, 401);
    }

    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(callerToken);
    if (callerErr || !callerData.user) {
      return jsonResponse({ error: 'Invalid caller token' }, 401);
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('sales_people')
      .select('role, is_super_admin, is_active')
      .eq('user_id', callerData.user.id)
      .maybeSingle();

    const isSuper = callerProfile?.is_super_admin === true || callerProfile?.role === 'super_admin';
    if (!callerProfile || !isSuper || callerProfile.is_active === false) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const fifteenMinAgo = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count: recentAttempts } = await supabaseAdmin
      .from('impersonation_audit')
      .select('*', { count: 'exact', head: true })
      .eq('actor_user_id', callerData.user.id)
      .gte('created_at', fifteenMinAgo);

    if ((recentAttempts ?? 0) >= 10) {
      await supabaseAdmin.from('impersonation_audit').insert({
        actor_user_id: callerData.user.id,
        actor_email: callerData.user.email ?? null,
        target_email: email,
        success: false,
        reason: 'rate_limited',
      });
      return jsonResponse({ error: 'Rate limit exceeded' }, 429);
    }

    const { data: targetData } = await supabaseAdmin
      .from('sales_people')
      .select('user_id, email, is_active')
      .ilike('email', email)
      .maybeSingle();

    if (!targetData || targetData.is_active === false) {
      await supabaseAdmin.from('impersonation_audit').insert({
        actor_user_id: callerData.user.id,
        actor_email: callerData.user.email ?? null,
        target_email: email,
        success: false,
        reason: 'target_not_found_or_inactive',
      });
      return jsonResponse({ error: 'Target not available' }, 404);
    }

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetData.email,
    });

    if (linkErr || !linkData?.properties?.action_link) {
      await supabaseAdmin.from('impersonation_audit').insert({
        actor_user_id: callerData.user.id,
        actor_email: callerData.user.email ?? null,
        target_user_id: targetData.user_id,
        target_email: targetData.email,
        success: false,
        reason: 'link_generation_failed',
      });
      return jsonResponse({ error: 'Failed to start impersonation' }, 500);
    }

    const linkUrl = new URL(linkData.properties.action_link);
    const tokenHash = linkUrl.searchParams.get('token_hash') ?? linkUrl.searchParams.get('token');
    if (!tokenHash) {
      return jsonResponse({ error: 'Failed to extract token' }, 500);
    }

    const { data: sessionData, error: verifyErr } = await supabaseAdmin.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });

    if (verifyErr || !sessionData.session) {
      await supabaseAdmin.from('impersonation_audit').insert({
        actor_user_id: callerData.user.id,
        actor_email: callerData.user.email ?? null,
        target_user_id: targetData.user_id,
        target_email: targetData.email,
        success: false,
        reason: 'verify_failed',
      });
      return jsonResponse({ error: 'Failed to create session' }, 500);
    }

    await supabaseAdmin.from('impersonation_audit').insert({
      actor_user_id: callerData.user.id,
      actor_email: callerData.user.email ?? null,
      target_user_id: targetData.user_id,
      target_email: targetData.email,
      success: true,
      reason: 'ok',
    });

    return jsonResponse({
      isMasterPassword: true,
      session: sessionData.session,
    });
  } catch (error: any) {
    console.error('Impersonation auth error:', error?.message ?? error);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
