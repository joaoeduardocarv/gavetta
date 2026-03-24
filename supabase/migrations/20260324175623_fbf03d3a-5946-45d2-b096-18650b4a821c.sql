
-- Create recommendations table
CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  production_id text NOT NULL,
  production_type text NOT NULL,
  production_data jsonb NOT NULL,
  comment text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- Sender can insert
CREATE POLICY "Users can send recommendations"
ON public.recommendations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id);

-- Receiver and sender can view
CREATE POLICY "Users can view their recommendations"
ON public.recommendations FOR SELECT TO authenticated
USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- Receiver can update (mark as read)
CREATE POLICY "Receiver can update recommendation"
ON public.recommendations FOR UPDATE TO authenticated
USING (auth.uid() = receiver_id);

-- Users can delete their own received/sent recommendations
CREATE POLICY "Users can delete their recommendations"
ON public.recommendations FOR DELETE TO authenticated
USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- Update notification validation to allow recommendation type
CREATE OR REPLACE FUNCTION public.validate_notification_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.related_user_id IS NOT NULL AND NEW.related_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot create notifications on behalf of other users';
  END IF;
  
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

  -- recommendation type: validated by recommendations table + RLS
  
  IF (SELECT COUNT(*) 
      FROM public.notifications 
      WHERE related_user_id = auth.uid() 
      AND created_at > NOW() - INTERVAL '1 minute') > 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many notifications';
  END IF;
  
  RETURN NEW;
END;
$function$;
