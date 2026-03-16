/*
  # Fix Group Conversation to Include Current User

  1. Problem
    - When a user starts a group conversation, they may not be in the user_group
    - This prevents them from being added as a participant and sending messages

  2. Solution
    - Modify get_or_create_group_conversation to always add the calling user
    - The user who initiates the group chat should always be a participant
*/

CREATE OR REPLACE FUNCTION get_or_create_group_conversation(
  p_group_id uuid,
  p_group_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id uuid;
  v_member record;
  v_current_user_id uuid;
BEGIN
  v_current_user_id := auth.uid();

  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE source_group_id = p_group_id;

  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (is_group, group_name, source_group_id)
    VALUES (true, p_group_name, p_group_id)
    RETURNING id INTO v_conversation_id;

    FOR v_member IN
      SELECT user_id FROM user_group_members WHERE group_id = p_group_id
    LOOP
      INSERT INTO conversation_participants (conversation_id, user_id)
      VALUES (v_conversation_id, v_member.user_id)
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END LOOP;

    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conversation_id, v_current_user_id)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  ELSE
    UPDATE conversations
    SET group_name = p_group_name
    WHERE id = v_conversation_id;

    FOR v_member IN
      SELECT user_id FROM user_group_members WHERE group_id = p_group_id
    LOOP
      INSERT INTO conversation_participants (conversation_id, user_id)
      VALUES (v_conversation_id, v_member.user_id)
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END LOOP;

    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conversation_id, v_current_user_id)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  RETURN v_conversation_id;
END;
$$;