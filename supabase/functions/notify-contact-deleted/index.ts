import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Super-admin recipient for contact-deletion notifications.
const SUPER_ADMIN_EMAIL = "mtcarella@evidenttitle.com";
const SUPER_ADMIN_NAME = "Mike Carella";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const {
      contactName,
      contactEmail,
      deletedByName,
      deletedByUserId,
      deletedAt,
    } = await req.json();

    // RESEND_API_KEY must be set as a Supabase Edge Function secret.
    // Configure in the Supabase dashboard under Edge Functions > Secrets.
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const timestamp = deletedAt
      ? new Date(deletedAt).toLocaleString("en-US", { timeZone: "America/New_York" })
      : new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

    const subject = `Contact Deleted: ${contactName}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #b91c1c;">Contact Deleted</h2>
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #fecaca;">
          <p style="margin: 8px 0;"><strong>Contact Name:</strong> ${contactName ?? "(unknown)"}</p>
          <p style="margin: 8px 0;"><strong>Contact Email:</strong> ${contactEmail ?? "(none)"}</p>
          <p style="margin: 8px 0;"><strong>Deleted By:</strong> ${deletedByName ?? "(unknown)"}</p>
          <p style="margin: 8px 0;"><strong>User ID:</strong> ${deletedByUserId ?? "(unknown)"}</p>
          <p style="margin: 8px 0;"><strong>Timestamp (EST):</strong> ${timestamp}</p>
        </div>
        <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
          Automated notification from the Evident Edge system.
        </p>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Evident Title <noreply@evidenttitle.com>",
        to: SUPER_ADMIN_EMAIL,
        subject,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return new Response(
        JSON.stringify({ error: errorData.message || "Failed to send email", recipient: SUPER_ADMIN_NAME }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, recipient: SUPER_ADMIN_EMAIL }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error in notify-contact-deleted:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
