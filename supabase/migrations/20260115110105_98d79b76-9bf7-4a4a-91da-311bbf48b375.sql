-- Adicionar coluna rating para avaliação individual por item
ALTER TABLE public.user_drawer_assignments 
ADD COLUMN rating INTEGER CHECK (rating >= 1 AND rating <= 10);

-- Adicionar coluna comment para comentários individuais por item
ALTER TABLE public.user_drawer_assignments 
ADD COLUMN comment TEXT;