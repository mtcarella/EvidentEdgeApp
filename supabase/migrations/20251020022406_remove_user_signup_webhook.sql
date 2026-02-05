/*
  # Remove User Signup Webhook

  ## Changes Made
    - Drop the trigger and function that was causing signup failures
    - The webhook approach requires additional Supabase configuration that isn't available
    - We'll handle notifications differently (from the frontend after successful signup)
*/

-- Drop the trigger
DROP TRIGGER IF EXISTS on_user_signup_notify ON auth.users;

-- Drop the function
DROP FUNCTION IF EXISTS notify_new_user_signup();
