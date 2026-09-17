ALTER TABLE public.user_drawer_assignments
  DROP CONSTRAINT IF EXISTS user_drawer_assignments_user_id_production_id_production_ty_key;

ALTER TABLE public.user_drawer_assignments
  ADD CONSTRAINT user_drawer_assignments_user_drawer_production_unique
  UNIQUE (user_id, drawer_id, production_id, production_type);

CREATE OR REPLACE FUNCTION public.assign_user_drawer_position()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.position IS NULL THEN
    SELECT COALESCE(MAX(position), -1) + 1
      INTO NEW.position
      FROM public.user_drawer_assignments
     WHERE user_id = NEW.user_id
       AND drawer_id = NEW.drawer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_user_drawer_position_trigger ON public.user_drawer_assignments;
CREATE TRIGGER assign_user_drawer_position_trigger
BEFORE INSERT ON public.user_drawer_assignments
FOR EACH ROW
EXECUTE FUNCTION public.assign_user_drawer_position();

CREATE OR REPLACE FUNCTION public.reorder_user_drawer(
  _drawer_id text,
  _production_ids text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(_production_ids) AS requested(production_id)
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.user_drawer_assignments assignment
        WHERE assignment.user_id = auth.uid()
          AND assignment.drawer_id = _drawer_id
          AND assignment.production_id = requested.production_id
     )
  ) THEN
    RAISE EXCEPTION 'Invalid drawer contents';
  END IF;

  UPDATE public.user_drawer_assignments assignment
     SET position = ordered.position
    FROM (
      SELECT production_id, ordinality::integer - 1 AS position
        FROM unnest(_production_ids) WITH ORDINALITY AS items(production_id, ordinality)
    ) ordered
   WHERE assignment.user_id = auth.uid()
     AND assignment.drawer_id = _drawer_id
     AND assignment.production_id = ordered.production_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_user_drawer(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_user_drawer(text, text[]) TO authenticated;