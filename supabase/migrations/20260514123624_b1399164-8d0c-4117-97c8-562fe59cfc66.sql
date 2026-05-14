CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_username TEXT;
  v_avatar_url TEXT;
  v_handle TEXT;
  v_base_handle TEXT;
  v_suffix INT := 1;
  v_max_attempts INT := 50;
  v_short_id TEXT := lower(substring(replace(new.id::text, '-', '') from 1 for 6));
BEGIN
  v_username := TRIM(coalesce(new.raw_user_meta_data ->> 'username', ''));
  v_avatar_url := new.raw_user_meta_data ->> 'avatar_url';
  v_handle := LOWER(TRIM(coalesce(new.raw_user_meta_data ->> 'handle', '')));

  -- ───── Sanitização de username ─────
  -- Strip caracteres proibidos (mantém letras Unicode, dígitos, _ - . espaço ')
  IF v_username <> '' THEN
    v_username := regexp_replace(v_username, '[^[:alpha:][:digit:]_\-\. '']', '', 'g');
    v_username := TRIM(v_username);
  END IF;

  -- Fallback: deriva do local-part do email se vazio/inválido
  IF v_username IS NULL OR length(v_username) < 2 THEN
    v_username := TRIM(split_part(new.email, '@', 1));
    v_username := regexp_replace(coalesce(v_username, ''), '[^[:alpha:][:digit:]_\-\. '']', '', 'g');
  END IF;

  -- Pad se ainda for muito curto
  IF v_username IS NULL OR length(v_username) < 2 THEN
    v_username := 'user_' || v_short_id;
  END IF;

  -- Trunca se passar de 50
  IF length(v_username) > 50 THEN
    v_username := substring(v_username from 1 for 50);
  END IF;

  -- ───── Sanitização de handle ─────
  -- Remove acentos via translate, depois força [a-z0-9_]
  IF v_handle <> '' THEN
    v_handle := translate(v_handle,
      'áàâãäåçéèêëíìîïñóòôõöúùûüýÿ',
      'aaaaaaceeeeiiiinooooouuuuyy');
    v_handle := regexp_replace(v_handle, '[^a-z0-9_]', '_', 'g');
    v_handle := regexp_replace(v_handle, '_+', '_', 'g');
    v_handle := trim(both '_' from v_handle);
  END IF;

  -- Fallback: deriva do local-part do email
  IF v_handle IS NULL OR length(v_handle) < 3 THEN
    v_handle := lower(coalesce(split_part(new.email, '@', 1), ''));
    v_handle := translate(v_handle,
      'áàâãäåçéèêëíìîïñóòôõöúùûüýÿ',
      'aaaaaaceeeeiiiinooooouuuuyy');
    v_handle := regexp_replace(v_handle, '[^a-z0-9_]', '_', 'g');
    v_handle := regexp_replace(v_handle, '_+', '_', 'g');
    v_handle := trim(both '_' from v_handle);
  END IF;

  -- Pad se ainda for muito curto
  IF v_handle IS NULL OR length(v_handle) < 3 THEN
    v_handle := 'user_' || v_short_id;
  END IF;

  -- Trunca se passar de 30
  IF length(v_handle) > 30 THEN
    v_handle := substring(v_handle from 1 for 30);
  END IF;

  -- ───── Avatar URL: limpa se for grande demais ─────
  IF v_avatar_url IS NOT NULL AND length(v_avatar_url) > 500 THEN
    v_avatar_url := NULL;
  END IF;

  -- ───── Auto-suffix do handle se já existir ─────
  v_base_handle := v_handle;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(handle) = v_handle) AND v_suffix <= v_max_attempts LOOP
    v_suffix := v_suffix + 1;
    IF LENGTH(v_base_handle) + LENGTH(v_suffix::text) > 30 THEN
      v_handle := SUBSTRING(v_base_handle FROM 1 FOR (30 - LENGTH(v_suffix::text))) || v_suffix::text;
    ELSE
      v_handle := v_base_handle || v_suffix::text;
    END IF;
  END LOOP;

  -- Último recurso: handle baseado no UUID do user (sempre único)
  IF v_suffix > v_max_attempts THEN
    v_handle := 'user_' || v_short_id;
  END IF;

  INSERT INTO public.profiles (id, username, avatar_url, handle)
  VALUES (new.id, v_username, v_avatar_url, v_handle);

  RETURN new;
END;
$function$;