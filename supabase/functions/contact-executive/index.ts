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

    // Parse request body
    const { subject, message, senderUserId, deliveryMethod = 'email' } = await req.json();

    if (!message || !senderUserId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: message, senderUserId' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (deliveryMethod === 'email' && !subject) {
      return new Response(
        JSON.stringify({ error: 'Subject is required for email delivery' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Get sender information
    const { data: sender, error: senderError } = await supabaseAdmin
      .from('sales_people')
      .select('name, email, role')
      .eq('user_id', senderUserId)
      .maybeSingle();

    if (senderError || !sender) {
      throw new Error('Failed to fetch sender information');
    }

    // Get all admin and super_admin users
    const { data: admins, error: adminsError } = await supabaseAdmin
      .from('sales_people')
      .select('email, name, cell_phone')
      .in('role', ['admin', 'super_admin'])
      .eq('is_active', true);

    if (adminsError) {
      throw adminsError;
    }

    if (!admins || admins.length === 0) {
      throw new Error('No active administrators found');
    }

    if (deliveryMethod === 'email') {
      // Get the Resend API key
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        throw new Error('RESEND_API_KEY environment variable is not set');
      }

      // Prepare recipient list
      const recipients = admins.map(admin => admin.email);

      // Send email to all admins
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
              <p style="margin: 0 0 10px 0;"><strong>From:</strong> ${sender.name}</p>
              <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${sender.email}</p>
              <p style="margin: 0 0 10px 0;"><strong>Role:</strong> ${sender.role}</p>
              <p style="margin: 0;"><strong>Subject:</strong> ${subject}</p>
            </div>
            <div style="padding: 20px; background-color: white; border: 1px solid #e5e7eb; border-top: none;">
              <h3 style="color: #374151; margin-top: 0;">Message:</h3>
              <div style="white-space: pre-wrap; color: #4b5563; line-height: 1.6;">${message}</div>
            </div>
            <div style="padding: 20px; background-color: #f9fafb; border-radius: 0 0 8px 8px; margin-top: -1px;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                To reply, please respond directly to <a href="mailto:${sender.email}" style="color: #2563eb;">${sender.email}</a>
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
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify(emailBody),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        throw new Error(`Failed to send email: ${errorText}`);
      }

      const result = await emailResponse.json();

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email sent successfully to all administrators',
          recipientCount: recipients.length,
          emailId: result.id,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else {
      // SMS delivery
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        throw new Error('Twilio credentials are not configured. Please contact your administrator.');
      }

      // Filter admins with valid cell phone numbers
      const adminsWithPhones = admins.filter(admin => admin.cell_phone && admin.cell_phone.trim());

      if (adminsWithPhones.length === 0) {
        throw new Error('No administrators have cell phone numbers configured for SMS delivery.');
      }

      // Send SMS to each admin
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
              'Authorization': authHeader,
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
      const successCount = results.filter(r => r.success).length;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Text messages sent successfully',
          recipientCount: successCount,
          totalAdmins: admins.length,
          adminsWithPhones: adminsWithPhones.length,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error: any) {
    console.error('Error sending contact executive message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
