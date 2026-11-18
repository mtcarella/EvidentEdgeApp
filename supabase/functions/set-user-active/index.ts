import { corsHeaders, jsonResponse, requireCaller } from '../_shared/auth.ts';

// ~100 years; Supabase auth has no "permanent" ban value.
const PERMANENT_BAN = '876000h';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const auth = await requireCaller(req, { requireRoles: ['admin', 'super_admin'] });
  if (!auth.ok) return auth.response;
  const { supabase: supabaseAdmin, caller } = auth;

  try {
    const { salesPersonId, active } = await req.json();
    if (typeof salesPersonId !== 'string' || typeof active !== 'boolean') {
      return jsonResponse({ error: 'salesPersonId and active are required' }, 400);
    }

    const { data: target, error: targetErr } = await supabaseAdmin
      .from('sales_people')
      .select('id, user_id')
      .eq('id', salesPersonId)
      .maybeSingle();

    if (targetErr || !target) {
      return jsonResponse({ error: 'User not found' }, 404);
    }

    if (!active && target.user_id === caller.user.id) {
      return jsonResponse({ error: 'You cannot deactivate yourself' }, 400);
    }

    const { error: updateErr } = await supabaseAdmin
      .from('sales_people')
      .update({ is_active: active })
      .eq('id', salesPersonId);

    if (updateErr) {
      console.error('is_active update failed:', updateErr.message);
      return jsonResponse({ error: 'Failed to update user status' }, 500);
    }

    if (target.user_id) {
      const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(target.user_id, {
        ban_duration: active ? 'none' : PERMANENT_BAN,
      });
      if (banErr) {
        console.error('Ban update failed:', banErr.message);
        await supabaseAdmin.from('sales_people').update({ is_active: !active }).eq('id', salesPersonId);
        return jsonResponse({ error: 'Failed to update sign-in access' }, 500);
      }
      if (!active) {
        const { error: revokeErr } = await supabaseAdmin.rpc('revoke_user_sessions', { target: target.user_id });
        if (revokeErr) console.error('Session revoke failed:', revokeErr.message);
      }
    }

    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error('set-user-active error:', error?.message ?? error);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
