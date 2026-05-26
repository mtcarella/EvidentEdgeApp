import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendCommunicationRequest {
  type: 'email' | 'sms';
  recipients?: Array<{
    name: string;
    email?: string;
    phone?: string;
  }>;
  notifySuperAdmins?: boolean;
  subject?: string;
  message: string;
  senderName?: string;
  senderEmail?: string;
  sendCopyToSender?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { type, recipients: inputRecipients, notifySuperAdmins, subject, message, senderName, senderEmail, sendCopyToSender = false }: SendCommunicationRequest = await req.json();

    let recipients = inputRecipients ?? [];

    if (notifySuperAdmins) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: admins } = await supabaseAdmin
        .from("sales_people")
        .select("name, email")
        .eq("role", "super_admin")
        .eq("is_active", true);
      if (admins) {
        recipients = [
          ...recipients,
          ...admins.filter((a: { name: string; email: string | null }) => a.email).map((a: { name: string; email: string | null }) => ({ name: a.name, email: a.email! })),
        ];
      }
    }

    if (!type || !recipients.length || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const footerText = senderEmail
      ? `To reply, please respond directly to ${senderEmail}.`
      : 'This is an automated message from the Evident Edge system.';

    const results = [];
    const errors = [];

    if (type === 'email') {
      // Send emails using Resend
      const resendApiKey = Deno.env.get('RESEND_API_KEY');

      if (!resendApiKey) {
        return new Response(
          JSON.stringify({
            error: 'Email service not configured. Please contact your administrator to set up the RESEND_API_KEY.'
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      for (const recipient of recipients) {
        if (!recipient.email) {
          errors.push({ recipient: recipient.name, error: 'No email address' });
          continue;
        }

        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Evident Title <noreply@evidenttitle.com>',
              to: recipient.email,
              subject: subject || 'Message from Evident Title',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #1e40af;">Message from Evident Edge</h2>
                  <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    ${message.split('\n').map(line => `<p style="margin: 8px 0;">${line}</p>`).join('')}
                  </div>
                  <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
                    ${footerText}
                  </p>
                </div>
              `,
            }),
          });

          if (response.ok) {
            results.push({ recipient: recipient.name, status: 'sent' });
          } else {
            const errorData = await response.json();
            errors.push({ recipient: recipient.name, error: errorData.message || 'Failed to send' });
          }
        } catch (error) {
          errors.push({ recipient: recipient.name, error: error.message });
        }
      }

      if (sendCopyToSender && senderEmail) {
        const recipientNames = recipients.map(r => r.name).join(', ');
        try {
          const copyResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Evident Title <noreply@evidenttitle.com>',
              to: senderEmail,
              subject: `[Copy] ${subject || 'Message from Evident Title'}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #1e40af;">Copy of Your Sent Message</h2>
                  <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">
                    This is a copy of the message you sent to: <strong>${recipientNames}</strong>
                  </p>
                  <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    ${message.split('\n').map(line => `<p style="margin: 8px 0;">${line}</p>`).join('')}
                  </div>
                  <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
                    This is an automated copy from the Evident Edge system.
                  </p>
                </div>
              `,
            }),
          });

          if (!copyResponse.ok) {
            console.error('Failed to send copy to sender');
          }
        } catch (error) {
          console.error('Error sending copy to sender:', error);
        }
      }
    } else if (type === 'sms') {
      // Send SMS using Twilio
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        return new Response(
          JSON.stringify({
            error: 'SMS service not configured. Please contact your administrator to set up Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER).'
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      for (const recipient of recipients) {
        if (!recipient.phone) {
          errors.push({ recipient: recipient.name, error: 'No phone number' });
          continue;
        }

        try {
          // Format phone number to E.164 format if needed
          let phoneNumber = recipient.phone.replace(/\D/g, '');
          if (!phoneNumber.startsWith('1') && phoneNumber.length === 10) {
            phoneNumber = '1' + phoneNumber;
          }
          if (!phoneNumber.startsWith('+')) {
            phoneNumber = '+' + phoneNumber;
          }

          const smsBody = `${message}\n\n${footerText}`;

          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                To: phoneNumber,
                From: twilioPhoneNumber,
                Body: smsBody,
              }),
            }
          );

          if (response.ok) {
            results.push({ recipient: recipient.name, status: 'sent' });
          } else {
            const errorData = await response.json();
            errors.push({ recipient: recipient.name, error: errorData.message || 'Failed to send' });
          }
        } catch (error) {
          errors.push({ recipient: recipient.name, error: error.message });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        sent: results.length,
        failed: errors.length,
        results,
        errors,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-communication:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
