import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { prospectName, prospectType, assignedTo, addedBy } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: superAdmins, error: adminError } = await supabase
      .from("sales_people")
      .select("name, email")
      .eq("role", "super_admin")
      .eq("is_active", true);

    if (adminError) throw adminError;

    if (!superAdmins || superAdmins.length === 0) {
      return new Response(
        JSON.stringify({ message: "No super admins found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typeLabel: Record<string, string> = {
      buyer: "Buyer",
      realtor: "Realtor",
      attorney: "Attorney",
      loan_officer: "Loan Officer",
      vendor: "Vendor",
    };

    const subject = `New Prospect Added: ${prospectName}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">New Prospect Added</h2>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 8px 0;"><strong>Name:</strong> ${prospectName}</p>
          <p style="margin: 8px 0;"><strong>Type:</strong> ${typeLabel[prospectType] ?? prospectType}</p>
          <p style="margin: 8px 0;"><strong>Assigned To:</strong> ${assignedTo}</p>
          <p style="margin: 8px 0;"><strong>Added By:</strong> ${addedBy}</p>
        </div>
        <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
          This is an automated notification from the Evident Edge system.
        </p>
      </div>
    `;

    const results = [];
    const errors = [];

    for (const admin of superAdmins) {
      if (!admin.email) {
        errors.push({ name: admin.name, error: "No email address" });
        continue;
      }

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Evident Title <noreply@evidenttitle.com>",
            to: admin.email,
            subject,
            html: htmlBody,
          }),
        });

        if (response.ok) {
          results.push({ name: admin.name, status: "sent" });
        } else {
          const errorData = await response.json();
          errors.push({ name: admin.name, error: errorData.message || "Failed to send" });
        }
      } catch (err: any) {
        errors.push({ name: admin.name, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ success: errors.length === 0, sent: results.length, failed: errors.length, results, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-prospect-added:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
