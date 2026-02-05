# Quick Setup Guide: Performance Report Reminders

Follow these steps to complete the setup of the automated reminder system.

## Step 1: Set Up Resend Email Service

1. **Create Resend Account**
   - Go to https://resend.com and sign up
   - Verify your email address

2. **Get API Key**
   - Navigate to API Keys in the Resend dashboard
   - Create a new API key
   - Copy the API key (it won't be shown again)

3. **Add API Key to Supabase**
   - Go to your Supabase dashboard: https://supabase.com/dashboard/project/qopxgmdizdlcxecvnwka
   - Navigate to: Project Settings > Edge Functions > Secrets
   - Click "Add new secret"
   - Name: `RESEND_API_KEY`
   - Value: Paste your Resend API key
   - Click "Save"

4. **Configure Domain (Optional but Recommended)**
   - In Resend dashboard, add and verify your domain
   - This allows you to send emails from your own domain
   - If you skip this, you can use Resend's testing domain

5. **Update Email From Address**
   - Edit `supabase/functions/send-report-reminders/index.ts`
   - Line ~66: Update the `from` field to match your verified domain:
     ```typescript
     from: 'Performance Reports <noreply@yourdomain.com>',
     ```
   - Or use Resend's testing domain: `onboarding@resend.dev`

## Step 2: Configure Supabase URL for Automated Triggers

Run this SQL command in your Supabase SQL Editor (Dashboard > SQL Editor):

```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://qopxgmdizdlcxecvnwka.supabase.co';
```

## Step 3: Enable Required Extensions

Check that these extensions are enabled in your Supabase project:

1. Go to: Database > Extensions
2. Enable the following if not already enabled:
   - `pg_cron` (for scheduled jobs)
   - `pg_net` (for HTTP requests from database)

If these extensions are not available in your project, contact Supabase support or use the alternative setup method.

## Step 4: Test the System

### Test 1: Check for Missing Reports

Run in SQL Editor:
```sql
SELECT check_missing_reports();
```

### Test 2: View Users Needing Reminders

Run in SQL Editor:
```sql
SELECT * FROM get_users_needing_reminders();
```

### Test 3: Send Test Email

Option A - Via Edge Function (direct):
```bash
curl -X POST https://qopxgmdizdlcxecvnwka.supabase.co/functions/v1/send-report-reminders \
  -H "Content-Type: application/json" \
  -d '{}'
```

Option B - Via Database Function (if pg_net is configured):
```sql
SELECT trigger_reminder_emails();
```

## Step 5: Verify Cron Jobs Are Scheduled

Run in SQL Editor:
```sql
-- View scheduled jobs
SELECT * FROM cron.job;

-- View recent job runs
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

You should see two jobs:
- `check_missing_performance_reports` - Runs Saturdays at 1am UTC (Friday 8pm EST)
- `send_reminder_emails` - Runs Mondays at 1pm UTC (Monday 8am EST)

## Alternative Setup (If pg_net is not available)

If `pg_net` is not available, use an external cron service to call the edge function:

### Option 1: GitHub Actions

Create `.github/workflows/send-reminders.yml`:

```yaml
name: Send Performance Report Reminders

on:
  schedule:
    # Runs every Monday at 1pm UTC (8am EST)
    - cron: '0 13 * * 1'
  workflow_dispatch:

jobs:
  send-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Call Edge Function
        run: |
          curl -X POST https://qopxgmdizdlcxecvnwka.supabase.co/functions/v1/send-report-reminders \
            -H "Content-Type: application/json" \
            -d '{}'
```

### Option 2: cron-job.org

1. Go to https://cron-job.org
2. Create a free account
3. Create a new cron job:
   - URL: `https://qopxgmdizdlcxecvnwka.supabase.co/functions/v1/send-report-reminders`
   - Schedule: Every Monday at 13:00 UTC
   - Method: POST
   - Request body: `{}`

## Timezone Notes

**Current Configuration:**
- Friday check: Saturday 1am UTC = Friday 8pm EST
- Monday reminder: Monday 1pm UTC = Monday 8am EST

**During Daylight Saving Time (March-November):**
Eastern Time is UTC-4 (instead of UTC-5), so times will be off by 1 hour:
- Saturday 1am UTC = Friday 9pm EDT (1 hour late)
- Monday 1pm UTC = Monday 9am EDT (1 hour late)

**To adjust for EDT**, update the cron schedules to:
```sql
-- For EDT (March-November)
-- Friday 8pm EDT = Saturday 12am UTC
SELECT cron.schedule('check_missing_performance_reports', '0 0 * * 6', 'SELECT check_missing_reports();');

-- Monday 8am EDT = Monday 12pm UTC
SELECT cron.schedule('send_reminder_emails', '0 12 * * 1', 'SELECT trigger_reminder_emails();');
```

## Monitoring

### View Pending Reminders Dashboard

Run in SQL Editor:
```sql
SELECT
  sp.name,
  sp.email,
  prr.week_ending_date,
  prr.reminder_sent,
  prr.reminder_sent_at
FROM performance_report_reminders prr
JOIN sales_people sp ON sp.id = prr.user_id
WHERE prr.report_submitted = false
ORDER BY prr.week_ending_date DESC, sp.name;
```

### Check Resend Email Logs

Go to your Resend dashboard to see:
- Emails sent
- Delivery status
- Bounce/complaint reports

## Troubleshooting

**Problem: Cron jobs not showing up**
- Check if pg_cron extension is enabled
- Run: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`

**Problem: Emails not being sent**
- Verify RESEND_API_KEY is set in Edge Function secrets
- Check Resend dashboard for errors
- Verify the `from` email matches a verified domain

**Problem: Edge function not being called**
- Check if pg_net is enabled
- View edge function logs in Supabase dashboard
- Try calling the edge function manually (see Test 3 above)

## Support

For detailed documentation, see: `REPORT-REMINDERS-SETUP.md`

For questions about:
- Resend: https://resend.com/docs
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- pg_cron: https://supabase.com/docs/guides/database/extensions/pgcron
