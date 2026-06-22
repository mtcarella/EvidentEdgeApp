import { corsHeaders, jsonResponse, getServiceClient } from '../_shared/auth.ts';

const SITE_URL = 'https://evidentedge.netlify.app';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return jsonResponse({ error: 'Email is required' }, 400);
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return jsonResponse({ error: 'Email service not configured' }, 500);
    }

    const supabase = getServiceClient();

    const redirectTo = `${SITE_URL}/reset-password`;

    // Generate a recovery link using the admin API
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo,
      },
    });

    if (linkError) {
      // Don't reveal whether email exists - always return success to prevent enumeration
      console.error('generateLink error:', linkError.message);
      return jsonResponse({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
    }

    if (!linkData?.properties?.action_link) {
      // Email doesn't exist - still return success to prevent enumeration
      return jsonResponse({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
    }

    // The action_link from generateLink goes to Supabase's verify endpoint.
    // It will redirect the user to the redirectTo URL after verification.
    const resetLink = linkData.properties.action_link;

    // Send the email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Evident Title <noreply@evidenttitle.com>',
        to: email,
        subject: 'Reset Your Password - Evident Edge',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3c4f54; margin: 0;">Evident Edge</h1>
            </div>
            <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
              <h2 style="color: #3c4f54; margin-top: 0;">Password Reset Request</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.5;">
                We received a request to reset your password. Click the button below to choose a new password.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}"
                   style="display: inline-block; background-color: #adce60; color: #3c4f54; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Reset My Password
                </a>
              </div>
              <p style="color: #64748b; font-size: 14px; line-height: 1.5;">
                If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
              </p>
              <p style="color: #64748b; font-size: 14px; line-height: 1.5;">
                This link will expire in 24 hours.
              </p>
            </div>
            <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px;">
                Evident Title Agency &bull; Evident Edge Platform
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Resend error:', JSON.stringify(errorData));
      return jsonResponse({ error: 'Failed to send reset email. Please try again later.' }, 500);
    }

    return jsonResponse({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (error: any) {
    console.error('send-password-reset error:', error?.message ?? error);
    return jsonResponse({ error: 'An unexpected error occurred. Please try again.' }, 500);
  }
});
