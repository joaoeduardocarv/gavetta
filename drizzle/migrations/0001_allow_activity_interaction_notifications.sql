ALTER TABLE public.notifications
  DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type = ANY (ARRAY[
      'friend_request'::text,
      'friend_accepted'::text,
      'recommendation'::text,
      'activity'::text,
      'activity_like'::text,
      'activity_comment'::text,
      'shared_drawer_invite'::text,
      'streaming_change'::text,
      'new_season'::text,
      'new_episodes'::text,
      'upcoming_content'::text,
      'rental_arrival'::text,
      'purchase_arrival'::text
    ])
  );