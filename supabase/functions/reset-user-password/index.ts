import { corsHeaders, jsonResponse, requireCaller } from '../_shared/auth.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const auth = await requireCaller(req, { requireRoles: ['admin', 'super_admin'] });
  if (!auth.ok) return auth.response;
  const { supabase: supabaseAdmin } = auth;

  try {
    const { userId, newPassword } = await req.json();
    if (!userId || !newPassword) {
      return jsonResponse({ error: 'User ID and new password are required' }, 400);
    }
    if (newPassword.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
    }

    // Update the user's password and ensure email is confirmed so they can log in
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        password: newPassword,
        email_confirm: true,
      }
    );

    if (updateError) {
      console.error('updateUserById error:', JSON.stringify(updateError));
      return jsonResponse({ error: `Failed to update password: ${updateError.message}` }, 500);
    }
    if (!updateData?.user) {
      return jsonResponse({ error: 'No user data returned from update' }, 500);
    }

    return jsonResponse({
      success: true,
      message: 'Password updated successfully. User can now log in with the new password.',
      userId: updateData.user.id,
    });
  } catch (error: any) {
    console.error('Reset password error:', error?.message ?? error);
    return jsonResponse({ error: error?.message || 'Internal error' }, 500);
  }
});
