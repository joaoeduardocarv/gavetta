ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_selected_at TIMESTAMPTZ;