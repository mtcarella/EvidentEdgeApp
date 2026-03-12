import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AttachmentData {
  filename: string;
  content: string;
}

interface EmailResourceRequest {
  resourceId: string;
  recipientEmails: string[];
  subject: string;
  message: string;
  senderEmail?: string;
  additionalAttachments?: AttachmentData[];
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { resourceId, recipientEmails, subject, message, senderEmail, additionalAttachments }: EmailResourceRequest = await req.json();

    if (!resourceId || !recipientEmails || recipientEmails.length === 0 || !subject || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .select('*')
      .eq('id', resourceId)
      .maybeSingle();

    if (resourceError || !resource) {
      return new Response(
        JSON.stringify({ error: 'Resource not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('resources')
      .download(resource.file_path);

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: 'Failed to download resource file' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const fileArrayBuffer = await fileData.arrayBuffer();
    const fileBase64 = arrayBufferToBase64(fileArrayBuffer);

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

    const footerText = senderEmail
      ? `To reply, please respond directly to ${senderEmail}.`
      : 'This is an automated message from the Evident Edge system.';

    const results = [];
    const errors = [];

    for (const email of recipientEmails) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Evident Title <noreply@evidenttitle.com>',
            to: email,
            subject: subject,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1e40af;">Document from Evident Title</h2>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  ${message.split('\n').map(line => `<p style="margin: 8px 0;">${line}</p>`).join('')}
                </div>
                <p style="margin: 20px 0; padding: 15px; background: #e0f2fe; border-radius: 8px;">
                  <strong>Attached Document:</strong> ${resource.title}.pdf
                </p>
                <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
                  ${footerText}
                </p>
              </div>
            `,
            attachments: [
              {
                filename: `${resource.title}.pdf`,
                content: fileBase64,
              },
              ...(additionalAttachments || []),
            ],
          }),
        });

        if (response.ok) {
          results.push({ email, status: 'sent' });
        } else {
          const errorData = await response.json();
          errors.push({ email, error: errorData.message || 'Failed to send' });
        }
      } catch (error) {
        errors.push({ email, error: error.message });
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
    console.error('Error in email-resource:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
