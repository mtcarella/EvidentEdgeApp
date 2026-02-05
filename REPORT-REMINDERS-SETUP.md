# Performance Report Reminder System

This document explains the automated system for checking and reminding users about missing performance reports.

## Overview

The system automatically:
1. **Every Friday at 8pm Eastern Time**: Checks which users (processors, sales_processors, closers) haven't submitted their performance reports for the week
2. **Every Monday at 8am Eastern Time**: Sends email reminders to users who haven't submitted their reports

## Components

### 1. Database Tables

**`performance_report_reminders`**
- Tracks which users need to be reminded about missing reports
- Stores reminder status and timestamps
- Links to users via the `sales_people` table

### 2. Database Functions

**`check_missing_reports()`**
- Runs every Friday at 8pm Eastern (Saturday 1am UTC during EST)
- Identifies users who haven't submitted reports for the current week
- Creates reminder records for users with missing reports

**`get_users_needing_reminders()`**
- Returns list of users who need reminder emails
- Includes user email, name, and week ending date

**`trigger_reminder_emails()`**
- Calls the edge function to send emails
- Runs every Monday at 8am Eastern (Monday 1pm UTC during EST)

### 3. Edge Function

**`send-report-reminders`**
- Retrieves users who need reminders from the database
- Sends email notifications via Resend email service
- Marks reminders as sent in the database
- Logs success and failure counts

### 4. Scheduled Jobs (pg_cron)

Two cron jobs are scheduled:
- **Friday Check**: `0 1 * * 6` (Saturday 1am UTC = Friday 8pm EST)
- **Monday Reminder**: `0 13 * * 1` (Monday 1pm UTC = Monday 8am EST)

## Required Configuration

### 1. Enable Extensions

The following PostgreSQL extensions must be enabled:
- `pg_cron` - For scheduled jobs
- `pg_net` - For making HTTP requests from database (optional, for automated edge function calls)

These should be enabled automatically by the migrations. If not, you may need to enable them manually in your Supabase dashboard under Database > Extensions.

### 2. Set Up Resend Email Service

The system uses [Resend](https://resend.com) for sending emails. You need to:

1. Create a Resend account at https://resend.com
2. Get your API key from the Resend dashboard
3. Add the API key to your Supabase project:
   - Go to your Supabase dashboard
   - Navigate to Project Settings > Edge Functions > Secrets
   - Add a new secret: `RESEND_API_KEY` with your Resend API key
4. Verify your domain in Resend (or use their testing domain)
5. Update the `from` email address in the edge function to match your verified domain

### 3. Configure Supabase URL (for pg_net integration)

If using pg_net to automatically trigger the edge function from the database:

```sql
-- Run this in your Supabase SQL Editor, replacing with your actual URL
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project-ref.supabase.co';
```

### 4. Timezone Considerations

The scheduled times are set for Eastern Time (UTC-5 during EST, UTC-4 during EDT).

**During Standard Time (EST - November to March):**
- Friday 8pm EST = Saturday 1am UTC ✓
- Monday 8am EST = Monday 1pm UTC ✓

**During Daylight Saving Time (EDT - March to November):**
- Friday 8pm EDT = Saturday 12am UTC (need to adjust)
- Monday 8am EDT = Monday 12pm UTC (need to adjust)

To adjust for daylight saving time, you can either:
- Update the cron schedules twice a year
- Use a timezone-aware scheduling service
- Accept a 1-hour difference during EDT

## Alternative Setup (Without pg_net)

If `pg_net` is not available or you prefer an external solution, you can trigger the Monday emails using:

### Option 1: External Cron Service

Use a service like GitHub Actions, Render Cron Jobs, or cron-job.org to call the edge function:

```bash
# Every Monday at 8am Eastern
curl -X POST https://your-project-ref.supabase.co/functions/v1/send-report-reminders \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Option 2: Serverless Platform

Deploy a simple serverless function on Vercel, Netlify, or similar that calls your edge function on a schedule.

## Manual Testing

### Test the Friday Check Function

```sql
-- Run this in your Supabase SQL Editor
SELECT check_missing_reports();
```

### Test Getting Users Needing Reminders

```sql
-- Run this in your Supabase SQL Editor
SELECT * FROM get_users_needing_reminders();
```

### Test Sending Reminder Emails

You can manually trigger the edge function by calling it via HTTP:

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/send-report-reminders \
  -H "Content-Type: application/json" \
  -d '{}'
```

Or using the database function (if pg_net is configured):

```sql
SELECT trigger_reminder_emails();
```

## Monitoring

### View Scheduled Cron Jobs

```sql
SELECT * FROM cron.job;
```

### View Cron Job History

```sql
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

### View Pending Reminders

```sql
SELECT
  prr.*,
  sp.name,
  sp.email
FROM performance_report_reminders prr
JOIN sales_people sp ON sp.id = prr.user_id
WHERE prr.reminder_sent = false
  AND prr.report_submitted = false
ORDER BY prr.week_ending_date DESC;
```

### View Sent Reminders

```sql
SELECT
  prr.*,
  sp.name,
  sp.email
FROM performance_report_reminders prr
JOIN sales_people sp ON sp.id = prr.user_id
WHERE prr.reminder_sent = true
ORDER BY prr.reminder_sent_at DESC
LIMIT 20;
```

## Email Template

The reminder email includes:
- Subject: "Reminder: Performance Report Past Due"
- User's name
- Week ending date (formatted)
- Request to submit the report

To customize the email template, edit the edge function at:
`supabase/functions/send-report-reminders/index.ts`

## Troubleshooting

### Cron Jobs Not Running

1. Check if pg_cron is enabled:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

2. Check cron job status:
```sql
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### Emails Not Being Sent

1. Verify Resend API key is set in Edge Function secrets
2. Check edge function logs in Supabase dashboard
3. Verify the email address in the `from` field matches your verified Resend domain
4. Check Resend dashboard for delivery logs

### pg_net Not Available

If pg_net is not available in your Supabase project:
1. Try enabling it in Database > Extensions
2. Use an external cron service instead (see Alternative Setup above)
3. Contact Supabase support to enable pg_net for your project

## Security Notes

- The edge function does not require JWT verification since it's called by system cron jobs
- Ensure your Resend API key is kept secure in Edge Function secrets
- The database functions use SECURITY DEFINER to run with elevated privileges
- Access to the `performance_report_reminders` table is restricted via Row Level Security

## Future Enhancements

Possible improvements to consider:
- Escalation emails to supervisors if reports remain unsubmitted
- Daily digest emails showing team compliance
- Dashboard showing real-time report submission status
- SMS reminders as an alternative to email
- Customizable reminder schedules per user or role
