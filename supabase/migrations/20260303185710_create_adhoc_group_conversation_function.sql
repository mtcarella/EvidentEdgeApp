/*
  # Create Ad-hoc Group Conversation Function

  1. New Function
    - `create_adhoc_group_conversation` - Creates a group conversation with any arbitrary set of users
    - Takes an array of user IDs and an optional group name
    - Always includes the calling user as a participant
    - Returns the conversation ID

  2. Changes
    - Enables messaging multiple people who may not be in a pre-defined user_group
*/

CREATE OR REPLACE FUNCTION create_adhoc_group_conversation(
  p_user_ids uuid[],
  p_group_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id uuid;
  v_user_id uuid;
  v_current_user_id uuid;
  v_final_name text;
BEGIN
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  IF array_length(p_user_ids, 1) IS NULL OR array_length(p_user_ids, 1) < 1 THEN
    RAISE EXCEPTION 'At least one user must be specified';
  END IF;

  IF p_group_name IS NOT NULL AND p_group_name != '' THEN
    v_final_name := p_group_name;
  ELSE
    SELECT string_agg(name, ', ' ORDER BY name)
    INTO v_final_name
    FROM sales_people
    WHERE user_id = ANY(p_user_ids)
    LIMIT 4;
  END IF;

  INSERT INTO conversations (is_group, group_name)
  VALUES (true, v_final_name)
  RETURNING id INTO v_conversation_id;

  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_current_user_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    IF v_user_id != v_current_user_id THEN
      INSERT INTO conversation_participants (conversation_id, user_id)
      VALUES (v_conversation_id, v_user_id)
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_conversation_id;
END;
$$;