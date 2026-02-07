-- Fix 1: Update handle_new_user function with proper input validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_avatar_url TEXT;
BEGIN
  v_username := TRIM(new.raw_user_meta_data ->> 'username');
  v_avatar_url := new.raw_user_meta_data ->> 'avatar_url';
  
  -- Validate username: must be 2-50 characters
  IF v_username IS NULL OR LENGTH(v_username) < 2 OR LENGTH(v_username) > 50 THEN
    RAISE EXCEPTION 'Invalid username: must be 2-50 characters';
  END IF;
  
  -- Validate username format: only alphanumeric, underscore, hyphen, and spaces
  IF v_username !~ '^[a-zA-Z0-9_\- ]+$' THEN
    RAISE EXCEPTION 'Invalid username: only alphanumeric, underscore, hyphen, and spaces allowed';
  END IF;
  
  -- Validate avatar_url if provided (max 500 chars)
  IF v_avatar_url IS NOT NULL AND LENGTH(v_avatar_url) > 500 THEN
    RAISE EXCEPTION 'Invalid avatar_url: too long';
  END IF;
  
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (new.id, v_username, v_avatar_url);
  
  RETURN new;
END;
$$;

-- Fix 2: Create validation trigger for notifications to prevent spam
CREATE OR REPLACE FUNCTION public.validate_notification_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Ensure related_user_id matches authenticated user (sender must be themselves)
  IF NEW.related_user_id IS NOT NULL AND NEW.related_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot create notifications on behalf of other users';
  END IF;
  
  -- Validate friend_request notifications: must have pending friendship
  IF NEW.type = 'friend_request' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.friendships 
      WHERE requester_id = auth.uid() 
      AND addressee_id = NEW.user_id 
      AND status = 'pending'
    ) THEN
      RAISE EXCEPTION 'Invalid friend request notification: no pending friendship found';
    END IF;
  END IF;
  
  -- Validate friend_accepted notifications: must have accepted friendship
  IF NEW.type = 'friend_accepted' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.friendships 
      WHERE addressee_id = auth.uid() 
      AND requester_id = NEW.user_id 
      AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Invalid friend accepted notification: no accepted friendship found';
    END IF;
  END IF;
  
  -- Rate limiting: max 20 notifications per user per minute
  IF (SELECT COUNT(*) 
      FROM public.notifications 
      WHERE related_user_id = auth.uid() 
      AND created_at > NOW() - INTERVAL '1 minute') > 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many notifications';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for notification validation
DROP TRIGGER IF EXISTS validate_notification_insert_trigger ON public.notifications;
CREATE TRIGGER validate_notification_insert_trigger
  BEFORE INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_notification_insert();