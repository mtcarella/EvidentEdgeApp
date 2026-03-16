/*
  # Allow All Authenticated Users to View Groups

  This migration adds a SELECT policy to allow all authenticated users to view
  user groups in the dropdown when sending communications.

  ## Security Changes
  - Adds new SELECT policy for user_groups allowing all authenticated users to view groups
  - This enables the groups dropdown to be populated for all users, not just admins

  ## Notes
  - Users can now see all available groups when selecting recipients
  - Group management (create, update, delete) remains admin-only
  - This fixes the issue where groups weren't showing in the communications dropdown
*/

-- Add SELECT policy for all authenticated users to view groups
CREATE POLICY "All users can view user groups"
ON user_groups FOR SELECT
TO authenticated
USING (true);
