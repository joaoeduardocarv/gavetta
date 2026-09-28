CREATE OR REPLACE FUNCTION public.assign_user_drawer_position()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.position IS NULL THEN
    UPDATE public.user_drawer_assignments
       SET position = COALESCE(position, 0) + 1
     WHERE user_id = NEW.user_id
       AND drawer_id = NEW.drawer_id;

    NEW.position := 0;
  END IF;

  RETURN NEW;
END;
$$;
