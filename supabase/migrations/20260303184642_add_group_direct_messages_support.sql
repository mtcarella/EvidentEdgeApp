/*
  # Add Group Direct Messages Support

  1. Changes
    - Add `is_group` boolean column to conversations table for group chats
    - Add `group_name` text column for naming group conversations
    - Add `source_group_id` column to link with user_groups table

  2. New Function
    - `get_or_create_group_conversation` - Creates or retrieves a group conversation
      based on an existing user_group, syncing participants

  3. Indexes
    - Add indexes for performance on new columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'is_group'
  ) THEN
    ALTER TABLE conversations ADD COLUMN is_group boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'group_name'
  ) THEN
    ALTER TABLE conversations ADD COLUMN group_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'source_group_id'
  ) THEN
    ALTER TABLE conversations ADD COLUMN source_group_id uuid REFERENCES user_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_is_group ON conversations(is_group);
CREATE INDEX IF NOT EXISTS idx_conversations_source_group ON conversations(source_group_id);

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
BEGIN
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

    DELETE FROM conversation_participants
    WHERE conversation_id = v_conversation_id
    AND user_id NOT IN (
      SELECT user_id FROM user_group_members WHERE group_id = p_group_id
    );
  END IF;

  RETURN v_conversation_id;
END;
$$;