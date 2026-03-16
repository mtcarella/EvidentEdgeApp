/*
  # Auto-create announcement on resource upload

  1. New Function
    - `create_announcement_for_resource()` - Trigger function that creates an announcement
      when a new resource is uploaded

  2. New Trigger
    - `on_resource_insert_create_announcement` - Fires after INSERT on resources table
    
  3. Behavior
    - Creates an announcement with title "New Resource: [Resource Title]"
    - Sets category to 'informational'
    - Links the announcement to the uploader
    - Includes information about the resource category
*/

CREATE OR REPLACE FUNCTION create_announcement_for_resource()
RETURNS TRIGGER AS $$
DECLARE
  uploader_name TEXT;
  resource_type TEXT;
  announcement_content TEXT;
BEGIN
  SELECT name INTO uploader_name
  FROM sales_people
  WHERE id = NEW.uploaded_by;

  IF NEW.file_path LIKE 'http://%' OR NEW.file_path LIKE 'https://%' THEN
    resource_type := 'link';
  ELSIF NEW.file_path LIKE '%.mp4' OR NEW.file_path LIKE '%.webm' OR NEW.file_path LIKE '%.mov' OR NEW.file_path LIKE '%.avi' OR NEW.file_path LIKE '%.wmv' THEN
    resource_type := 'video';
  ELSE
    resource_type := 'document';
  END IF;

  announcement_content := 'A new ' || resource_type || ' has been added to the Resources section in the "' || NEW.category || '" category.';
  
  IF uploader_name IS NOT NULL THEN
    announcement_content := announcement_content || ' (Uploaded by ' || uploader_name || ')';
  END IF;

  INSERT INTO announcements (
    title,
    content,
    category,
    is_active,
    is_pinned,
    created_by,
    expires_at
  ) VALUES (
    'New Resource: ' || NEW.title,
    announcement_content,
    'informational',
    true,
    false,
    NEW.uploaded_by,
    NOW() + INTERVAL '7 days'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_resource_insert_create_announcement ON resources;

CREATE TRIGGER on_resource_insert_create_announcement
  AFTER INSERT ON resources
  FOR EACH ROW
  EXECUTE FUNCTION create_announcement_for_resource();