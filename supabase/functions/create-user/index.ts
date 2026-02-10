import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser } } = await supabaseAdmin.auth.getUser(token);

    if (!requestingUser) {
      throw new Error('Unauthorized');
    }

    const { data: requestingUserProfile } = await supabaseAdmin
      .from('sales_people')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (!requestingUserProfile || (requestingUserProfile.role !== 'admin' && requestingUserProfile.role !== 'super_admin')) {
      throw new Error('Forbidden: Admin access required');
    }

    const { name, email, cell_phone, password, role } = await req.json();

    if (!name || !email || !password || !role) {
      throw new Error('Missing required fields');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

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
      throw profileError;
    }

    const defaultModules = [
      'dashboard',
      'contact_search',
      'submit_performance_report',
      'resources',
      'conflict_check'
    ];

    const defaultPermissions = defaultModules.map(module => ({
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

    return new Response(
      JSON.stringify({ success: true, message: 'User created successfully' }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error creating user:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});