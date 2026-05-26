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
    const {
      action,
      requestingUserName,
      requestingUserEmail,
      requestDate,
      buyerBorrowerName,
      fileNumber,
      transactionType,
      relationship,
      status,
    } = await req.json();

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

    const transactionLabel = transactionType === "purchase" ? "Purchase ($100)" : "Refi ($50)";
    const results: { name: string; status: string }[] = [];
    const errors: { name: string; error: string }[] = [];

    const sendEmail = async (to: string, subject: string, html: string) => {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Evident Title <noreply@evidenttitle.com>",
          to,
          subject,
          html,
        }),
      });
      return response;
    };

    if (action === "submitted") {
      // Notify all super admins
      const { data: superAdmins } = await supabase
        .from("sales_people")
        .select("name, email")
        .eq("role", "super_admin")
        .eq("is_active", true);

      const adminHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #047857;">New Friends and Family Request</h2>
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #bbf7d0;">
            <p style="margin: 8px 0;"><strong>Requesting User:</strong> ${requestingUserName}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${requestDate}</p>
            <p style="margin: 8px 0;"><strong>Buyer/Borrower:</strong> ${buyerBorrowerName}</p>
            <p style="margin: 8px 0;"><strong>File Number:</strong> ${fileNumber}</p>
            <p style="margin: 8px 0;"><strong>Transaction Type:</strong> ${transactionLabel}</p>
            <p style="margin: 8px 0;"><strong>Relationship:</strong> ${relationship}</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">Please log in to Evident Edge to approve or reject this request.</p>
          <p style="color: #94a3b8; font-size: 11px; margin-top: 30px;">This is an automated notification from the Evident Edge system.</p>
        </div>
      `;

      if (superAdmins) {
        for (const admin of superAdmins) {
          if (!admin.email) continue;
          try {
            const res = await sendEmail(admin.email, `New Friends and Family Request from ${requestingUserName}`, adminHtml);
            if (res.ok) results.push({ name: admin.name, status: "sent" });
            else errors.push({ name: admin.name, error: "Failed to send" });
          } catch (err: any) {
            errors.push({ name: admin.name, error: err.message });
          }
        }
      }

      // Send confirmation to requesting user
      if (requestingUserEmail) {
        const userHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #047857;">Friends and Family Request Received</h2>
            <p>Your Friends and Family request has been submitted and is pending approval.</p>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 8px 0;"><strong>Date:</strong> ${requestDate}</p>
              <p style="margin: 8px 0;"><strong>Buyer/Borrower:</strong> ${buyerBorrowerName}</p>
              <p style="margin: 8px 0;"><strong>File Number:</strong> ${fileNumber}</p>
              <p style="margin: 8px 0;"><strong>Transaction Type:</strong> ${transactionLabel}</p>
              <p style="margin: 8px 0;"><strong>Relationship:</strong> ${relationship}</p>
            </div>
            <p style="color: #64748b; font-size: 13px;">You will receive another email when your request is reviewed.</p>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 30px;">This is an automated notification from the Evident Edge system.</p>
          </div>
        `;
        try {
          await sendEmail(requestingUserEmail, "Friends and Family Request Submitted - Pending Approval", userHtml);
        } catch (err: any) {
          console.error("Failed to send user confirmation:", err);
        }
      }
    } else if (action === "reviewed") {
      // Notify requesting user of approval/rejection
      if (requestingUserEmail) {
        const isApproved = status === "approved";
        const statusLabel = isApproved ? "Approved" : "Rejected";
        const statusColor = isApproved ? "#047857" : "#dc2626";
        const deductionNote = isApproved
          ? `<p style="margin: 8px 0;"><strong>Budget Deduction:</strong> ${transactionType === "purchase" ? "$100.00" : "$50.00"}</p>`
          : "";

        const userHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: ${statusColor};">Friends and Family Request ${statusLabel}</h2>
            <p>Your Friends and Family request has been <strong>${statusLabel.toLowerCase()}</strong>.</p>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 8px 0;"><strong>Buyer/Borrower:</strong> ${buyerBorrowerName}</p>
              <p style="margin: 8px 0;"><strong>File Number:</strong> ${fileNumber}</p>
              <p style="margin: 8px 0;"><strong>Transaction Type:</strong> ${transactionLabel}</p>
              ${deductionNote}
            </div>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 30px;">This is an automated notification from the Evident Edge system.</p>
          </div>
        `;
        try {
          await sendEmail(requestingUserEmail, `Friends and Family Request ${statusLabel}`, userHtml);
          results.push({ name: requestingUserName, status: "sent" });
        } catch (err: any) {
          errors.push({ name: requestingUserName, error: err.message });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: errors.length === 0, sent: results.length, failed: errors.length, results, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-budget-request:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
