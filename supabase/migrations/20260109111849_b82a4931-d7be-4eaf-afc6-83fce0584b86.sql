-- Create table for user drawer assignments
CREATE TABLE public.user_drawer_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drawer_id TEXT NOT NULL, -- 'to-watch', 'watching', 'watched' or custom drawer id
  production_id TEXT NOT NULL, -- ID from TMDB API
  production_type TEXT NOT NULL CHECK (production_type IN ('movie', 'tv')),
  production_data JSONB NOT NULL, -- Store full content data for display
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique assignment per user/production
  UNIQUE(user_id, production_id, production_type)
);

-- Create table for custom drawers
CREATE TABLE public.user_custom_drawers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'folder',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique drawer names per user
  UNIQUE(user_id, name)
);

-- Enable Row Level Security
ALTER TABLE public.user_drawer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_drawers ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_drawer_assignments
CREATE POLICY "Users can view their own assignments"
ON public.user_drawer_assignments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assignments"
ON public.user_drawer_assignments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assignments"
ON public.user_drawer_assignments
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assignments"
ON public.user_drawer_assignments
FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for user_custom_drawers
CREATE POLICY "Users can view their own drawers"
ON public.user_custom_drawers
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own drawers"
ON public.user_custom_drawers
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drawers"
ON public.user_custom_drawers
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drawers"
ON public.user_custom_drawers
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_user_drawer_assignments_user_id ON public.user_drawer_assignments(user_id);
CREATE INDEX idx_user_drawer_assignments_drawer_id ON public.user_drawer_assignments(drawer_id);
CREATE INDEX idx_user_custom_drawers_user_id ON public.user_custom_drawers(user_id);