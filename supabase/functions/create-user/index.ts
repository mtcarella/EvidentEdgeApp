import { corsHeaders, jsonResponse, requireCaller } from '../_shared/auth.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const auth = await requireCaller(req, { requireRoles: ['admin', 'super_admin'] });
  if (!auth.ok) return auth.response;
  const { supabase: supabaseAdmin } = auth;

  try {
    const { name, email, cell_phone, password, role } = await req.json();

    if (!name || !email || !password || !role) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }
    if (password.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
    }
    const allowedRoles = ['salesperson', 'closer', 'processor', 'admin', 'super_admin', 'sales_processor'];
    if (!allowedRoles.includes(role)) {
      return jsonResponse({ error: 'Invalid role' }, 400);
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) return jsonResponse({ error: authError.message }, 400);
    if (!authData.user) return jsonResponse({ error: 'Failed to create user' }, 500);

    const { data: newUser, error: profileError } = await supabaseAdmin
      .from('sales_people')
      .insert({
        user_id: authData.user.id,
        name,
        email,
        cell_phone: cell_phone || null,
        role,
        is_active: true,
      })
      .select()
      .single();

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return jsonResponse({ error: profileError.message }, 500);
    }

    const defaultModules = [
      'dashboard',
      'contact_search',
      'submit_performance_report',
      'resources',
      'conflict_check',
    ];

    const defaultPermissions = defaultModules.map((module) => ({
      user_id: newUser.id,
      module_name: module,
      has_access: true,
    }));

    const { error: permissionsError } = await supabaseAdmin
      .from('user_module_permissions')
      .insert(defaultPermissions);

    if (permissionsError) {
      console.error('Error creating default permissions:', permissionsError);
    }

    return jsonResponse({ success: true, message: 'User created successfully' });
  } catch (error: any) {
    console.error('Error creating user:', error?.message ?? error);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
