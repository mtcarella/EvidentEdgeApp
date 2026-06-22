import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders, escapeHtml, jsonResponse, requireCaller } from '../_shared/auth.ts';

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const auth = await requireCaller(req, { requireRoles: [] });
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  try {
    const {
      resourceId,
      recipientEmails,
      subject,
      message,
      senderEmail,
      additionalAttachments,
    }: EmailResourceRequest = await req.json();

    if (!resourceId || !recipientEmails || recipientEmails.length === 0 || !subject || !message) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .select('*')
      .eq('id', resourceId)
      .maybeSingle();

    if (resourceError || !resource) {
      return jsonResponse({ error: 'Resource not found' }, 404);
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('resources')
      .download(resource.file_path);

    if (downloadError || !fileData) {
      return jsonResponse({ error: 'Failed to download resource file' }, 500);
    }

    const fileArrayBuffer = await fileData.arrayBuffer();
    const fileBase64 = arrayBufferToBase64(fileArrayBuffer);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return jsonResponse({ error: 'Email service not configured.' }, 500);
    }

    const safeSenderEmail = senderEmail ? escapeHtml(senderEmail) : '';
    const footerText = senderEmail
      ? `To reply, please respond directly to ${safeSenderEmail}.`
      : 'This is an automated message from the Evident Edge system.';

    const safeMessage = escapeHtml(message);
    const safeTitle = escapeHtml(resource.title);

    const results = [];
    const errors = [];

    for (const email of recipientEmails) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
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
                  ${safeMessage.split('\n').map((line) => `<p style="margin: 8px 0;">${line}</p>`).join('')}
                </div>
                <p style="margin: 20px 0; padding: 15px; background: #e0f2fe; border-radius: 8px;">
                  <strong>Attached Document:</strong> ${safeTitle}.pdf
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
      } catch (error: any) {
        errors.push({ email, error: error.message });
      }
    }

    return jsonResponse({
      success: errors.length === 0,
      sent: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (error: any) {
    console.error('Error in email-resource:', error?.message ?? error);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
