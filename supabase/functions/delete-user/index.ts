import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data: adminCheck } = await supabaseAdmin
      .from('sales_people')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminCheck || adminCheck.role !== 'admin') {
      throw new Error('Only admins can delete users');
    }

    const { userId } = await req.json();
    if (!userId) {
      throw new Error('User ID is required');
    }

    // First, delete the sales_people record
    const { error: salesPersonError } = await supabaseAdmin
      .from('sales_people')
      .delete()
      .eq('user_id', userId);
    
    if (salesPersonError) {
      console.error('Error deleting sales_people record:', salesPersonError);
      throw new Error(`Failed to delete sales person: ${salesPersonError.message}`);
    }

    // Then delete the auth user (hard delete)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      userId,
      false
    );
    
    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      throw new Error(`Failed to delete auth user: ${deleteError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Delete user error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      }
    );
  }
});