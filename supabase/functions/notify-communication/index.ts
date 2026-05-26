import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_ATTACHMENT_SIZE = 8 * 1024 * 1024; // 8MB per file

interface NotifyCommunicationRequest {
  recipientUserIds: string[];
  subject: string;
  message: string;
  senderName: string;
  communicationId: string;
  appUrl: string;
}

interface EmailAttachment {
  filename: string;
  content: string; // base64
}

interface AttachmentRecord {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function fetchFileAsBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch (error) {
    console.error(`Failed to fetch file: ${url}`, error);
    return null;
  }
}

async function compressFile(
  buffer: ArrayBuffer,
  fileName: string
): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(fileName, buffer);
  const compressed = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return compressed;
}

async function prepareAttachments(
  attachmentRecords: AttachmentRecord[]
): Promise<EmailAttachment[]> {
  const emailAttachments: EmailAttachment[] = [];

  for (const record of attachmentRecords) {
    try {
      const buffer = await fetchFileAsBuffer(record.file_url);
      if (!buffer) {
        console.error(
          `Skipping attachment (fetch failed): ${record.file_name}`
        );
        continue;
      }

      let finalBuffer = buffer;
      let finalName = record.file_name;

      if (buffer.byteLength > MAX_ATTACHMENT_SIZE) {
        try {
          finalBuffer = await compressFile(buffer, record.file_name);
          finalName = `${record.file_name}.zip`;

          if (finalBuffer.byteLength > MAX_ATTACHMENT_SIZE) {
            console.error(
              `Skipping attachment (still too large after compression): ${record.file_name}`
            );
            continue;
          }
        } catch (compressError) {
          console.error(
            `Skipping attachment (compression failed): ${record.file_name}`,
            compressError
          );
          continue;
        }
      }

      emailAttachments.push({
        filename: finalName,
        content: arrayBufferToBase64(finalBuffer),
      });
    } catch (error) {
      console.error(
        `Skipping attachment (unexpected error): ${record.file_name}`,
        error
      );
    }
  }

  return emailAttachments;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const {
      recipientUserIds,
      subject,
      message,
      senderName,
      communicationId,
      appUrl,
    }: NotifyCommunicationRequest = await req.json();

    if (!recipientUserIds?.length || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch recipients
    const { data: recipients } = await supabaseAdmin
      .from("sales_people")
      .select("user_id, name, email")
      .in("user_id", recipientUserIds)
      .eq("is_active", true);

    if (!recipients?.length) {
      return new Response(
        JSON.stringify({ error: "No valid recipients found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch and prepare file attachments for the email
    let emailAttachments: EmailAttachment[] = [];
    if (communicationId) {
      const { data: attachmentRecords } = await supabaseAdmin
        .from("communication_attachments")
        .select("id, file_name, file_url, file_type, file_size")
        .eq("communication_id", communicationId);

      if (attachmentRecords?.length) {
        emailAttachments = await prepareAttachments(attachmentRecords);
      }
    }

    const conversationLink = appUrl || "https://evidentedge.netlify.app";

    const attachmentNotice =
      emailAttachments.length > 0
        ? `<p style="color: #475569; font-size: 13px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
            <strong>${emailAttachments.length} file${emailAttachments.length > 1 ? "s" : ""} attached</strong>
          </p>`
        : "";

    const results = [];
    const errors = [];

    for (const recipient of recipients) {
      if (!recipient.email) {
        errors.push({ name: recipient.name, error: "No email address" });
        continue;
      }

      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af; margin-bottom: 4px;">New Office Communication</h2>
            <p style="color: #64748b; font-size: 14px; margin-top: 0;">From: ${senderName}</p>
            ${subject ? `<p style="color: #334155; font-size: 14px; margin-bottom: 16px;"><strong>Subject:</strong> ${subject}</p>` : ""}
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1e40af;">
              ${message
                .split("\n")
                .map(
                  (line: string) =>
                    `<p style="margin: 8px 0; color: #1e293b;">${line}</p>`
                )
                .join("")}
            </div>
            ${attachmentNotice}
            <a href="${conversationLink}" style="display: inline-block; background: #1e40af; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 16px;">View in Evident Edge</a>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 30px;">
              This is an automated notification from Evident Edge. Please log in to view and respond to this message.
            </p>
          </div>
        `;

        const emailPayload: Record<string, unknown> = {
          from: "Evident Title <noreply@evidenttitle.com>",
          to: recipient.email,
          subject: subject
            ? `[Evident Edge] ${subject}`
            : `[Evident Edge] New message from ${senderName}`,
          html: emailHtml,
        };

        if (emailAttachments.length > 0) {
          emailPayload.attachments = emailAttachments;
        }

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailPayload),
        });

        if (response.ok) {
          results.push({ name: recipient.name, status: "sent" });
        } else {
          const errorData = await response.json();
          errors.push({
            name: recipient.name,
            error: errorData.message || "Failed to send",
          });
        }
      } catch (error) {
        errors.push({ name: recipient.name, error: error.message });
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in notify-communication:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
