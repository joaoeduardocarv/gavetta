-- Drop trigger if it exists on profiles
DROP TRIGGER IF EXISTS auto_friend_with_founder_trigger ON public.profiles;
DROP TRIGGER IF EXISTS trg_auto_friend_with_founder ON public.profiles;
DROP TRIGGER IF EXISTS auto_friend_founder ON public.profiles;

-- Drop the function
DROP FUNCTION IF EXISTS public.auto_friend_with_founder() CASCADE;

-- Remove auto-created friendships where founder was the requester
DELETE FROM public.friendships
WHERE status = 'accepted'
  AND requester_id = (SELECT id FROM public.profiles WHERE handle = 'joaoeduardo' LIMIT 1);