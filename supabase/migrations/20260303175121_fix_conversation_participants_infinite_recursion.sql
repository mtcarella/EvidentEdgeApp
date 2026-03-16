/*
  # Fix Infinite Recursion in conversation_participants RLS Policy

  1. Problem
    - The SELECT policy on conversation_participants references itself causing infinite recursion
    - This prevents users from sending messages or viewing conversation participants

  2. Solution
    - Drop the problematic policy
    - Create a new policy that either:
      a) Allows users to see participants where they themselves are a participant (simple check)
      b) Uses a SECURITY DEFINER function to bypass RLS for the check

  3. Changes
    - Drop "Users can view participants of their conversations" policy
    - Create new policy that checks user_id directly or uses subquery on conversations table
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON conversation_participants;

-- Create a helper function that bypasses RLS to check if user is in conversation
CREATE OR REPLACE FUNCTION user_is_conversation_participant(conv_id uuid, check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = conv_id
    AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policy using the SECURITY DEFINER function
CREATE POLICY "Users can view participants of their conversations"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (
    user_is_conversation_participant(conversation_id, auth.uid())
  );

-- Also fix the conversations policies to use the same approach
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;

CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    user_is_conversation_participant(id, auth.uid())
  );

CREATE POLICY "Users can update their conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    user_is_conversation_participant(id, auth.uid())
  )
  WITH CHECK (
    user_is_conversation_participant(id, auth.uid())
  );

-- Fix direct_messages policies to use the helper function
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON direct_messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON direct_messages;

CREATE POLICY "Users can view messages in their conversations"
  ON direct_messages FOR SELECT
  TO authenticated
  USING (
    user_is_conversation_participant(conversation_id, auth.uid())
  );

CREATE POLICY "Users can send messages to their conversations"
  ON direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    user_is_conversation_participant(conversation_id, auth.uid())
  );
