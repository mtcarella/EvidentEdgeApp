import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders, escapeHtml, jsonResponse, requireCaller } from '../_shared/auth.ts';

interface AttachmentData {
  filename: string;
  content: string;
}

interface EmailResourceRequest {
  resourceId: string;
  recipientEmails: string[];
  recipientNames?: Record<string, string>;
  subject: string;
  message: string;
  senderEmail?: string;
  additionalAttachments?: AttachmentData[];
  linkUrl?: string;
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
      recipientNames,
      subject,
      message,
      senderEmail,
      additionalAttachments,
      linkUrl,
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

    const filePath = resource.file_path as string;
    const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filePath);
    const fileExtension = filePath.split('.').pop()?.toLowerCase() || 'pdf';

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

    const imageCid = isImage ? 'embedded-resource-image' : '';
    const imageMimeTypes: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
    };
    const imageContentType = imageMimeTypes[fileExtension] || 'image/png';

    const safeLinkUrl = linkUrl ? escapeHtml(linkUrl) : '';

    const results = [];
    const errors = [];

    for (const email of recipientEmails) {
      try {
        const attachments: Array<Record<string, string>> = [];

        if (isImage) {
          attachments.push({
            filename: `${resource.title}.${fileExtension}`,
            content: fileBase64,
            content_type: imageContentType,
            content_id: imageCid,
          });
        } else {
          attachments.push({
            filename: `${resource.title}.${fileExtension}`,
            content: fileBase64,
          });
        }

        if (additionalAttachments) {
          attachments.push(...additionalAttachments);
        }

        let firstName = recipientNames?.[email.toLowerCase()] || '';

        if (!firstName) {
          const { data: contactMatch } = await supabase
            .from('contacts')
            .select('first_name')
            .ilike('email', email)
            .limit(1)
            .maybeSingle();
          if (contactMatch?.first_name) {
            firstName = contactMatch.first_name;
          } else {
            const { data: userMatch } = await supabase
              .from('sales_people')
              .select('name')
              .ilike('email', email)
              .limit(1)
              .maybeSingle();
            if (userMatch?.name) {
              firstName = userMatch.name.split(' ')[0];
            }
          }
        }

        const greetingHtml = firstName
          ? `<p style="margin:0 0 16px 0;font-size:15px;color:#1e293b;">Hello ${escapeHtml(firstName)},</p>`
          : '';

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
            html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>img{max-width:100%!important;width:100%!important;height:auto!important;}</style>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:20px;">
    ${greetingHtml}
    ${safeMessage.split('\n').map((line) => `<p style="margin:8px 0;font-size:15px;color:#1e293b;">${line}</p>`).join('')}
  </td></tr>
  ${imageCid ? `<tr><td style="padding:10px 0 0 0;">
    ${safeLinkUrl ? `<!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]--><a href="${safeLinkUrl}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;border:0;"><img src="cid:${imageCid}" alt="${safeTitle}" width="1200" style="display:block;width:100%!important;max-width:100%!important;height:auto!important;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" /></a><!--[if mso]></td></tr></table><![endif]-->` : `<img src="cid:${imageCid}" alt="${safeTitle}" width="1200" style="display:block;width:100%!important;max-width:100%!important;height:auto!important;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />`}
  </td></tr>` : ''}
  <tr><td style="padding:20px;">
    <p style="color:#64748b;font-size:12px;margin:0;">${footerText}</p>
  </td></tr>
</table>
</body></html>`,
            attachments,
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
