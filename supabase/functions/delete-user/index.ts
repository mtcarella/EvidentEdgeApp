import { corsHeaders, jsonResponse, requireCaller } from '../_shared/auth.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const auth = await requireCaller(req, { requireRoles: ['admin', 'super_admin'] });
  if (!auth.ok) return auth.response;
  const { supabase: supabaseAdmin, caller } = auth;

  try {
    const { userId } = await req.json();
    if (!userId) {
      return jsonResponse({ error: 'User ID is required' }, 400);
    }

    if (userId === caller.user.id) {
      return jsonResponse({ error: 'Cannot delete yourself' }, 400);
    }

    const { error: salesPersonError } = await supabaseAdmin
      .from('sales_people')
      .delete()
      .eq('user_id', userId);

    if (salesPersonError) {
      console.error('Error deleting sales_people record:', salesPersonError);
      return jsonResponse({ error: `Failed to delete sales person: ${salesPersonError.message}` }, 500);
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId, false);

    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      return jsonResponse({ error: `Failed to delete auth user: ${deleteError.message}` }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error('Delete user error:', error?.message ?? error);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
