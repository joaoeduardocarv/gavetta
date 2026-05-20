ALTER TABLE public.notification_preferences 
  ADD COLUMN IF NOT EXISTS rental_arrival boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS purchase_arrival boolean NOT NULL DEFAULT true;

ALTER TABLE public.notification_preferences DROP COLUMN IF EXISTS vod_arrival;