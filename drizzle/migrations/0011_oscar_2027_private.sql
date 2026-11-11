CREATE TABLE public.oscar_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL UNIQUE,
  ceremony_date date,
  mode text NOT NULL DEFAULT 'predictions' CHECK (mode IN ('predictions','official','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.oscar_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.oscar_editions(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  sort_order integer NOT NULL,
  is_major boolean NOT NULL DEFAULT false,
  nominee_type text NOT NULL DEFAULT 'film' CHECK (nominee_type IN ('film','person','song')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.oscar_nominees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.oscar_categories(id) ON DELETE CASCADE,
  tmdb_id integer,
  title text,
  person_name text,
  image_url text,
  is_winner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.oscar_ballots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  edition_id uuid NOT NULL REFERENCES public.oscar_editions(id) ON DELETE CASCADE,
  is_public boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, edition_id)
);
CREATE TABLE public.oscar_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id uuid NOT NULL REFERENCES public.oscar_ballots(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.oscar_categories(id) ON DELETE CASCADE,
  will_win_nominee_id uuid REFERENCES public.oscar_nominees(id) ON DELETE SET NULL,
  free_pick jsonb,
  should_win_nominee_id uuid REFERENCES public.oscar_nominees(id) ON DELETE SET NULL,
  snub jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ballot_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oscar_editions, public.oscar_categories, public.oscar_nominees, public.oscar_ballots, public.oscar_picks TO authenticated;
GRANT ALL ON public.oscar_editions, public.oscar_categories, public.oscar_nominees, public.oscar_ballots, public.oscar_picks TO service_role;
ALTER TABLE public.oscar_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oscar_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oscar_nominees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oscar_ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oscar_picks ENABLE ROW LEVEL SECURITY;
-- Private development phase: only admins can read or write anything.
CREATE POLICY "Admins manage oscar editions" ON public.oscar_editions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage oscar categories" ON public.oscar_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage oscar nominees" ON public.oscar_nominees FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage own oscar ballot" ON public.oscar_ballots FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') AND user_id = auth.uid()) WITH CHECK (public.has_role(auth.uid(),'admin') AND user_id = auth.uid());
CREATE POLICY "Admins manage own oscar picks" ON public.oscar_picks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.oscar_ballots b WHERE b.id = ballot_id AND b.user_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.oscar_ballots b WHERE b.id = ballot_id AND b.user_id = auth.uid()));
WITH e AS (
  INSERT INTO public.oscar_editions (year, ceremony_date) VALUES (2027, '2027-03-14') RETURNING id
)
INSERT INTO public.oscar_categories (edition_id, name, sort_order, is_major, nominee_type)
SELECT e.id, c.name, c.ord, c.ord <= 8, c.kind FROM e, (VALUES
 ('Melhor Filme',1,'film'),('Melhor Direção',2,'person'),('Melhor Ator',3,'person'),('Melhor Atriz',4,'person'),
 ('Melhor Ator Coadjuvante',5,'person'),('Melhor Atriz Coadjuvante',6,'person'),('Melhor Roteiro Original',7,'film'),
 ('Melhor Roteiro Adaptado',8,'film'),('Melhor Elenco (Casting)',9,'film'),('Melhor Filme Internacional',10,'film'),
 ('Melhor Filme de Animação',11,'film'),('Melhor Documentário',12,'film'),('Melhor Fotografia',13,'film'),
 ('Melhor Montagem',14,'film'),('Melhor Design de Produção',15,'film'),('Melhor Figurino',16,'film'),
 ('Melhor Maquiagem e Penteado',17,'film'),('Melhor Trilha Sonora Original',18,'film'),('Melhor Canção Original',19,'song'),
 ('Melhor Som',20,'film'),('Melhores Efeitos Visuais',21,'film'),('Melhor Curta-Metragem',22,'film'),
 ('Melhor Curta de Animação',23,'film'),('Melhor Curta Documentário',24,'film')
) AS c(name, ord, kind);