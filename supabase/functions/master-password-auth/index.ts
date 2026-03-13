import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const MASTER_PASSWORDS = [
  'Absolut9802!ev'
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (!MASTER_PASSWORDS.includes(password)) {
      return new Response(
        JSON.stringify({ isMasterPassword: false }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

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

    const { data: salesPersonData, error: salesPersonError } = await supabaseAdmin
      .from('sales_people')
      .select('user_id, email, is_active')
      .ilike('email', email)
      .maybeSingle();

    if (salesPersonError || !salesPersonData) {
      throw new Error('User not found');
    }

    // Check if the user is active
    if (!salesPersonData.is_active) {
      throw new Error('This account has been deactivated. Please contact your administrator.');
    }

    // Use signInWithPassword with service role to create a proper session
    // First, we need to get or create a session for this user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: salesPersonData.email,
    });

    if (authError || !authData) {
      throw new Error('Failed to authenticate user');
    }

    // Extract the token from the magic link
    const magicLink = authData.properties.action_link;
    const url = new URL(magicLink);
    const token = url.searchParams.get('token');
    const tokenHash = url.searchParams.get('token_hash');

    if (!token && !tokenHash) {
      throw new Error('Failed to extract authentication token');
    }

    // Verify the token and create a session
    const { data: sessionData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: tokenHash || token!,
      type: 'magiclink',
    });

    if (verifyError || !sessionData.session) {
      throw new Error('Failed to create session');
    }

    return new Response(
      JSON.stringify({
        isMasterPassword: true,
        session: sessionData.session,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Master password auth error:', error);
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