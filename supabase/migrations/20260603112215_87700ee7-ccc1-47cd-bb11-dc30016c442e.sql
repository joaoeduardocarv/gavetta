ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
UPDATE public.profiles SET onboarded_at = COALESCE(onboarded_at, created_at);