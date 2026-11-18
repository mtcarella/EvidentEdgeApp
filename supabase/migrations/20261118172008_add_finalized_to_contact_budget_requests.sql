/*
# Add "finalized" tracking to Friends and Family requests

1. Modified Tables
- `contact_budget_requests`
  - `finalized` (boolean, default false): admin has marked the request as finalized
  - `finalized_at` (timestamptz, nullable): when it was marked finalized
  - `finalized_by` (uuid, nullable): auth user id of the admin who marked it

2. Security
- No policy changes. The existing UPDATE policy (super admins or users with the
  budget_requests module permission) already governs who can set these fields;
  requesting users still cannot update their own requests.

3. Notes
1. The approval process (status, reviewed_by, reviewed_at, budget deduction) is untouched.
*/

ALTER TABLE public.contact_budget_requests ADD COLUMN IF NOT EXISTS finalized boolean NOT NULL DEFAULT false;
ALTER TABLE public.contact_budget_requests ADD COLUMN IF NOT EXISTS finalized_at timestamptz;
ALTER TABLE public.contact_budget_requests ADD COLUMN IF NOT EXISTS finalized_by uuid;