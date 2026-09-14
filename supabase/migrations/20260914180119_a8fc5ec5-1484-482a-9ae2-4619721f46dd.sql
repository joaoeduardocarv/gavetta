ALTER TABLE public.title_awards
ADD COLUMN award_details jsonb NOT NULL DEFAULT '[]'::jsonb;