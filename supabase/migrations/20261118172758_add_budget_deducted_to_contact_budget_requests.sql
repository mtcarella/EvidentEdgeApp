/*
# Track whether a Friends and Family request has been charged to the budget

1. Modified Tables
- `contact_budget_requests`
  - `budget_deducted` (boolean, default false): true once the requester's budget
    has been reduced for this request.

2. Data
- Every request already approved before this change was charged at approval
  time, so those rows are marked `budget_deducted = true`. This prevents a second
  charge when an admin later marks them finalized.

3. Security
- No policy changes. The existing UPDATE policy (super admins or users with the
  budget_requests module permission) governs who can change this field.

4. Notes
1. Going forward the budget is reduced only when a request is both approved AND
   finalized; the app flips this flag atomically to prevent double charges.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contact_budget_requests' AND column_name = 'budget_deducted'
  ) THEN
    ALTER TABLE public.contact_budget_requests ADD COLUMN budget_deducted boolean NOT NULL DEFAULT false;
    UPDATE public.contact_budget_requests SET budget_deducted = true WHERE status = 'approved';
  END IF;
END $$;