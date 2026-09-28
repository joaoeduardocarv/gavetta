WITH target AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, drawer_id
           ORDER BY created_at DESC
         )::integer - 1 AS new_position
    FROM public.user_drawer_assignments
   WHERE user_id = '35c7e3d3-fe00-4e29-84f9-8243ac507c67'::uuid
     AND (
       (drawer_id = 'watching' AND production_id = 'tv-206828')
       OR
       (drawer_id = 'watched' AND production_id IN ('movie-1081003', 'movie-10843'))
     )
), shifted AS (
  UPDATE public.user_drawer_assignments assignment
     SET position = COALESCE(assignment.position, 0) + CASE
       WHEN assignment.drawer_id = 'watched' THEN 2
       WHEN assignment.drawer_id = 'watching' THEN 1
       ELSE 0
     END
   WHERE assignment.user_id = '35c7e3d3-fe00-4e29-84f9-8243ac507c67'::uuid
     AND assignment.drawer_id IN ('watched', 'watching')
     AND assignment.id NOT IN (SELECT id FROM target)
  RETURNING assignment.id
)
UPDATE public.user_drawer_assignments assignment
   SET position = target.new_position
  FROM target
 WHERE assignment.id = target.id;
