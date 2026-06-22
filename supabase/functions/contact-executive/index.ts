import { corsHeaders, escapeHtml, jsonResponse, requireCaller } from '../_shared/auth.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const auth = await requireCaller(req, { requireRoles: [] });
  if (!auth.ok) return auth.response;
  const { supabase: supabaseAdmin, caller } = auth;

  try {
    const { subject, message, deliveryMethod = 'email' } = await req.json();

    if (!message) {
      return jsonResponse({ error: 'Missing required field: message' }, 400);
    }
    if (deliveryMethod === 'email' && !subject) {
      return jsonResponse({ error: 'Subject is required for email delivery' }, 400);
    }

    const { data: sender, error: senderError } = await supabaseAdmin
      .from('sales_people')
      .select('name, email, role')
      .eq('user_id', caller.user.id)
      .maybeSingle();

    if (senderError || !sender) {
      return jsonResponse({ error: 'Failed to fetch sender information' }, 500);
    }

    const { data: admins, error: adminsError } = await supabaseAdmin
      .from('sales_people')
      .select('email, name, cell_phone')
      .in('role', ['admin', 'super_admin'])
      .eq('is_active', true);

    if (adminsError) {
      return jsonResponse({ error: adminsError.message }, 500);
    }
    if (!admins || admins.length === 0) {
      return jsonResponse({ error: 'No active administrators found' }, 404);
    }

    if (deliveryMethod === 'email') {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        return jsonResponse({ error: 'Email service not configured' }, 500);
      }

      const recipients = admins.map((a) => a.email);
      const safeSubject = escapeHtml(subject);
      const safeMessage = escapeHtml(message);
      const safeName = escapeHtml(sender.name);
      const safeEmail = escapeHtml(sender.email);
      const safeRole = escapeHtml(sender.role);

      const emailBody = {
        from: 'Evident Title Contact <noreply@evidenttitle.com>',
        to: recipients,
        subject: `[Contact Executive] ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">Contact Executive Message</h2>
            </div>
            <div style="background-color: #f3f4f6; padding: 20px; border-left: 4px solid #2563eb;">
              <p style="margin: 0 0 10px 0;"><strong>From:</strong> ${safeName}</p>
              <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${safeEmail}</p>
              <p style="margin: 0 0 10px 0;"><strong>Role:</strong> ${safeRole}</p>
              <p style="margin: 0;"><strong>Subject:</strong> ${safeSubject}</p>
            </div>
            <div style="padding: 20px; background-color: white; border: 1px solid #e5e7eb; border-top: none;">
              <h3 style="color: #374151; margin-top: 0;">Message:</h3>
              <div style="white-space: pre-wrap; color: #4b5563; line-height: 1.6;">${safeMessage}</div>
            </div>
            <div style="padding: 20px; background-color: #f9fafb; border-radius: 0 0 8px 8px; margin-top: -1px;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                To reply, please respond directly to <a href="mailto:${safeEmail}" style="color: #2563eb;">${safeEmail}</a>
              </p>
            </div>
          </div>
        `,
        reply_to: sender.email,
      };

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify(emailBody),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error('Resend error:', errorText);
        return jsonResponse({ error: 'Failed to send email' }, 502);
      }

      const result = await emailResponse.json();
      return jsonResponse({
        success: true,
        message: 'Email sent successfully to all administrators',
        recipientCount: recipients.length,
        emailId: result.id,
      });
    } else {
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        return jsonResponse({ error: 'Twilio credentials are not configured.' }, 500);
      }

      const adminsWithPhones = admins.filter((a) => a.cell_phone && a.cell_phone.trim());
      if (adminsWithPhones.length === 0) {
        return jsonResponse({ error: 'No administrators have cell phone numbers configured.' }, 400);
      }

      const smsPromises = adminsWithPhones.map(async (admin) => {
        const smsBody = `[Evident Title]\nFrom: ${sender.name} (${sender.role})\n\n${message}`;
        const authHeader = 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`);

        const formData = new URLSearchParams();
        formData.append('To', admin.cell_phone);
        formData.append('From', twilioPhoneNumber);
        formData.append('Body', smsBody);

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to send SMS to ${admin.name}:`, errorText);
          return { success: false, admin: admin.name };
        }
        return { success: true, admin: admin.name };
      });

      const results = await Promise.all(smsPromises);
      const successCount = results.filter((r) => r.success).length;

      return jsonResponse({
        success: true,
        message: 'Text messages sent successfully',
        recipientCount: successCount,
        totalAdmins: admins.length,
        adminsWithPhones: adminsWithPhones.length,
      });
    }
  } catch (error: any) {
    console.error('Error sending contact executive message:', error?.message ?? error);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
