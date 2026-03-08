
CREATE OR REPLACE FUNCTION public.validate_notification_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Validate shared_drawer_invite: must have pending membership created by the sender
  IF NEW.type = 'shared_drawer_invite' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.shared_drawer_members
      WHERE invited_by = auth.uid()
      AND user_id = NEW.user_id
      AND id::text = NEW.related_content_id
      AND status = 'pending'
    ) THEN
      -- Also check by drawer_id
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_drawer_members
        WHERE invited_by = auth.uid()
        AND user_id = NEW.user_id
        AND status = 'pending'
      ) THEN
        RAISE EXCEPTION 'Invalid shared drawer invite notification: no pending membership found';
      END IF;
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
$function$;
