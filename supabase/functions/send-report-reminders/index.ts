import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const EST_TIMEZONE = 'America/New_York';

function nowInEST(): Date {
  const now = new Date();
  const estString = now.toLocaleString('en-US', { timeZone: EST_TIMEZONE });
  return new Date(estString);
}

function formatDateEST(date: Date | string, options: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { ...options, timeZone: EST_TIMEZONE });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const isTestMode = url.searchParams.get('test') === 'true';
    const testEmail = url.searchParams.get('email') || 'mtcarella@evidenttitle.com';
    const reportType = url.searchParams.get('type') || 'weekly'; // 'daily' or 'weekly'

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

    // Get the Resend API key from environment variables
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    // Handle test mode
    if (isTestMode) {
      // Look up the user's name from the database
      const { data: userData, error: userError } = await supabaseAdmin
        .from('sales_people')
        .select('name')
        .eq('email', testEmail)
        .maybeSingle();

      const userName = userData?.name || 'there';

      const testDate = nowInEST();
      const dateFormatted = formatDateEST(testDate, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const reportLabel = reportType === 'daily' ? 'daily report' : 'performance report';
      const dateLabel = reportType === 'daily' ? dateFormatted : `the week ending ${dateFormatted}`;

      const emailBody = {
        from: 'Performance Reports <noreply@evidenttitle.com>',
        to: [testEmail],
        subject: `TEST: ${reportType === 'daily' ? 'Daily' : 'Weekly'} Report Past Due Reminder`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">${reportType === 'daily' ? 'Daily' : 'Performance'} Report Past Due</h2>
            <p>Hi ${userName},</p>
            <p>This is a reminder that your ${reportLabel} for <strong>${dateLabel}</strong> is past due.</p>
            <p>Please submit your ${reportLabel} as soon as possible.</p>
            <br/>
            <p>Thank you,<br/><strong>The Team</strong></p>
            <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px;">This is a TEST email to verify formatting and functionality.</p>
          </div>
        `,
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
        throw new Error(`Failed to send test email: ${errorText}`);
      }

      const result = await emailResponse.json();

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Test email sent successfully',
          recipient: testEmail,
          emailId: result.id,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Query for users who need reminders
    const { data: usersNeedingReminders, error: queryError } = await supabaseAdmin
      .rpc('get_users_needing_reminders', { reminder_type: reportType });

    if (queryError) {
      throw queryError;
    }

    if (!usersNeedingReminders || usersNeedingReminders.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No reminders to send',
          count: 0
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const emailsSent: string[] = [];
    const emailsFailed: string[] = [];

    // Send email to each user
    for (const user of usersNeedingReminders) {
      try {
        const reportDate = user.report_type === 'daily' ? user.report_date : user.week_ending_date;
        const dateFormatted = formatDateEST(reportDate, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        const reportLabel = user.report_type === 'daily' ? 'daily report' : 'performance report';
        const dateLabel = user.report_type === 'daily' ? dateFormatted : `the week ending ${dateFormatted}`;
        const subjectPrefix = user.report_type === 'daily' ? 'Daily' : 'Weekly';

        const emailBody = {
          from: 'Performance Reports <noreply@evidenttitle.com>',
          to: [user.user_email],
          subject: `Reminder: ${subjectPrefix} Report Past Due`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">${subjectPrefix} Report Past Due</h2>
              <p>Hi ${user.user_name},</p>
              <p>This is a reminder that your ${reportLabel} for <strong>${dateLabel}</strong> is past due.</p>
              <p>Please submit your ${reportLabel} as soon as possible.</p>
              <br/>
              <p>Thank you,<br/><strong>The Team</strong></p>
            </div>
          `,
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
          console.error(`Failed to send email to ${user.user_email}:`, errorText);
          emailsFailed.push(user.user_email);
          continue;
        }

        emailsSent.push(user.user_email);

        // Mark reminder as sent
        const now = nowInEST().toISOString();
        const { error: updateError } = await supabaseAdmin
          .from('performance_report_reminders')
          .update({
            reminder_sent: true,
            reminder_sent_at: now,
            updated_at: now,
          })
          .eq('user_id', user.user_id)
          .eq('week_ending_date', user.week_ending_date)
          .eq('report_type', user.report_type)
          .eq('report_date', user.report_date);

        if (updateError) {
          console.error(`Failed to update reminder status for ${user.user_email}:`, updateError);
        }
      } catch (emailError: any) {
        console.error(`Error processing reminder for ${user.user_email}:`, emailError);
        emailsFailed.push(user.user_email);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${emailsSent.length} reminders`,
        emailsSent,
        emailsFailed,
        totalProcessed: usersNeedingReminders.length,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error sending reminders:', error);
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