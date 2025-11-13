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
    console.log('=== Starting password reset function ===');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey,
      hasAnonKey: !!anonKey
    });

    const supabaseAdmin = createClient(
      supabaseUrl ?? '',
      serviceRoleKey ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      supabaseUrl ?? '',
      anonKey ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    console.log('Getting user from token...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      console.error('Error getting user:', userError);
      throw new Error(`Failed to get user: ${userError.message}`);
    }
    if (!user) {
      throw new Error('Unauthorized - no user found');
    }
    console.log('User found:', user.id);

    console.log('Checking admin role...');
    const { data: adminCheck, error: roleError } = await supabaseAdmin
      .from('sales_people')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError) {
      console.error('Error checking role:', roleError);
      throw new Error(`Failed to check role: ${roleError.message}`);
    }

    console.log('Role check result:', adminCheck);

    if (!adminCheck || adminCheck.role !== 'admin') {
      throw new Error('Only admins can reset passwords');
    }

    const { userId, newPassword } = await req.json();
    if (!userId || !newPassword) {
      throw new Error('User ID and new password are required');
    }

    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    console.log('Attempting to update password for user:', userId);
    console.log('New password length:', newPassword.length);

    // Update the password using admin API
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    console.log('Update result:', JSON.stringify({ data: updateData, error: updateError }, null, 2));

    if (updateError) {
      console.error('Update error details:', JSON.stringify(updateError, null, 2));
      throw new Error(`Failed to update password: ${updateError.message || JSON.stringify(updateError)}`);
    }

    if (!updateData?.user) {
      throw new Error('No user data returned from update');
    }
    
    console.log('Password successfully updated for user:', updateData.user.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password updated successfully. User will need to log in with the new password.',
        userId: updateData.user.id
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
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