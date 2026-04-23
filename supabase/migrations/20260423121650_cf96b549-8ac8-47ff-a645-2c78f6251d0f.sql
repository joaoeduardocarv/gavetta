-- Auto-friendship with founder (joaoeduardo) for every new user.
-- Founder profile id is fixed, but resolved dynamically by handle to stay robust.

CREATE OR REPLACE FUNCTION public.auto_friend_with_founder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_founder_id uuid;
BEGIN
  -- Look up founder by handle
  SELECT id INTO v_founder_id
  FROM public.profiles
  WHERE handle = 'joaoeduardo'
  LIMIT 1;

  -- Skip if founder doesn't exist or the new profile IS the founder
  IF v_founder_id IS NULL OR NEW.id = v_founder_id THEN
    RETURN NEW;
  END IF;

  -- Create accepted friendship: founder is the requester so RLS / semantics
  -- treat the new user as the addressee. Use ON CONFLICT-style guard via NOT EXISTS.
  IF NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (requester_id = v_founder_id AND addressee_id = NEW.id)
       OR (requester_id = NEW.id AND addressee_id = v_founder_id)
  ) THEN
    INSERT INTO public.friendships (requester_id, addressee_id, status)
    VALUES (v_founder_id, NEW.id, 'accepted');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_friend_with_founder ON public.profiles;
CREATE TRIGGER trg_auto_friend_with_founder
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_friend_with_founder();

-- Backfill: create accepted friendships for all existing users that aren't yet friends with the founder.
INSERT INTO public.friendships (requester_id, addressee_id, status)
SELECT
  (SELECT id FROM public.profiles WHERE handle = 'joaoeduardo' LIMIT 1) AS requester_id,
  p.id AS addressee_id,
  'accepted' AS status
FROM public.profiles p
WHERE p.handle <> 'joaoeduardo'
  AND NOT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE (f.requester_id = (SELECT id FROM public.profiles WHERE handle = 'joaoeduardo' LIMIT 1)
           AND f.addressee_id = p.id)
       OR (f.addressee_id = (SELECT id FROM public.profiles WHERE handle = 'joaoeduardo' LIMIT 1)
           AND f.requester_id = p.id)
  );