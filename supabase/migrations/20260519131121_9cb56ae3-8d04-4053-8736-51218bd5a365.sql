ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS vod_arrival boolean NOT NULL DEFAULT true;