CREATE OR REPLACE FUNCTION public.is_email_allowed(_email text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(trim(coalesce(_email, '')));
  v_local text;
  v_domain text;
  v_tld text;
  v_blocked_tlds text[] := ARRAY['test','example','invalid','localhost','local','internal','lan'];
  v_blocked_domains text[] := ARRAY[
    'example.com','example.org','example.net','email.test',
    '10minutemail.com','10minutemail.net','20minutemail.com','33mail.com','anonbox.net','armyspy.com',
    'burnermail.io','cuvox.de','dayrep.com','discard.email','dispostable.com','einrot.com',
    'emailondeck.com','emailtemporario.com.br','fakeinbox.com','fakemail.net','fleckens.hu',
    'getairmail.com','getnada.com','grr.la','guerrillamail.com','guerrillamail.info','guerrillamail.net',
    'guerrillamail.org','guerrillamailblock.com','harakirimail.com','inboxbear.com','inboxkitten.com',
    'jetable.org','mail-temporaire.fr','mail7.io','mailcatch.com','maildrop.cc','mailinator.com',
    'mailnesia.com','mailsac.com','mintemail.com','moakt.com','mohmal.com','mytemp.email','nada.email',
    'one-time.email','opayq.com','pokemail.net','rhyta.com','sharklasers.com','spam4.me','spambog.com',
    'spamgourmet.com','superrito.com','teleworm.us','temp-mail.io','temp-mail.org','tempail.com',
    'tempinbox.com','tempm.com','tempmail.com','tempmail.net','tempmailo.com','tempr.email',
    'throwawaymail.com','tmail.ws','trashmail.com','trashmail.de','trbvm.com','vomoto.com',
    'yopmail.com','yopmail.fr','yopmail.net','zetmail.com'
  ];
  v_blocked_locals text[] := ARRAY['noreply','no-reply','donotreply','do-not-reply','postmaster',
    'mailer-daemon','abuse','spam','test','teste','testing','example','asdf','aaaa','qwerty'];
  d text;
BEGIN
  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RETURN false;
  END IF;

  v_local := split_part(v_email, '@', 1);
  v_domain := split_part(v_email, '@', 2);
  v_tld := regexp_replace(v_domain, '^.*\.', '');

  IF v_tld = ANY (v_blocked_tlds) THEN RETURN false; END IF;
  IF v_domain = ANY (v_blocked_domains) THEN RETURN false; END IF;

  FOREACH d IN ARRAY v_blocked_domains LOOP
    IF v_domain LIKE '%.' || d THEN RETURN false; END IF;
  END LOOP;

  v_local := split_part(v_local, '+', 1);
  IF v_local = ANY (v_blocked_locals) THEN RETURN false; END IF;
  IF replace(v_local, '.', '') = ANY (v_blocked_locals) THEN RETURN false; END IF;

  RETURN true;
END;
$$;

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
  -- Camada de segurança: recusa emails descartáveis / de teste / genéricos
  IF new.email IS NOT NULL AND NOT public.is_email_allowed(new.email) THEN
    RAISE EXCEPTION 'Email address not allowed'
      USING ERRCODE = '23514';
  END IF;

  v_username := TRIM(coalesce(new.raw_user_meta_data ->> 'username', ''));
  v_avatar_url := new.raw_user_meta_data ->> 'avatar_url';
  v_handle := LOWER(TRIM(coalesce(new.raw_user_meta_data ->> 'handle', '')));

  IF v_username <> '' THEN
    v_username := regexp_replace(v_username, '[^[:alpha:][:digit:]_\-\. '']', '', 'g');
    v_username := TRIM(v_username);
  END IF;

  IF v_username IS NULL OR length(v_username) < 2 THEN
    v_username := TRIM(split_part(new.email, '@', 1));
    v_username := regexp_replace(coalesce(v_username, ''), '[^[:alpha:][:digit:]_\-\. '']', '', 'g');
  END IF;

  IF v_username IS NULL OR length(v_username) < 2 THEN
    v_username := 'user_' || v_short_id;
  END IF;

  IF length(v_username) > 50 THEN
    v_username := substring(v_username from 1 for 50);
  END IF;

  IF v_handle <> '' THEN
    v_handle := translate(v_handle,
      'áàâãäåçéèêëíìîïñóòôõöúùûüýÿ',
      'aaaaaaceeeeiiiinooooouuuuyy');
    v_handle := regexp_replace(v_handle, '[^a-z0-9_]', '_', 'g');
    v_handle := regexp_replace(v_handle, '_+', '_', 'g');
    v_handle := trim(both '_' from v_handle);
  END IF;

  IF v_handle IS NULL OR length(v_handle) < 3 THEN
    v_handle := lower(coalesce(split_part(new.email, '@', 1), ''));
    v_handle := translate(v_handle,
      'áàâãäåçéèêëíìîïñóòôõöúùûüýÿ',
      'aaaaaaceeeeiiiinooooouuuuyy');
    v_handle := regexp_replace(v_handle, '[^a-z0-9_]', '_', 'g');
    v_handle := regexp_replace(v_handle, '_+', '_', 'g');
    v_handle := trim(both '_' from v_handle);
  END IF;

  IF v_handle IS NULL OR length(v_handle) < 3 THEN
    v_handle := 'user_' || v_short_id;
  END IF;

  IF length(v_handle) > 30 THEN
    v_handle := substring(v_handle from 1 for 30);
  END IF;

  IF v_avatar_url IS NOT NULL AND length(v_avatar_url) > 500 THEN
    v_avatar_url := NULL;
  END IF;

  v_base_handle := v_handle;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(handle) = v_handle) AND v_suffix <= v_max_attempts LOOP
    v_suffix := v_suffix + 1;
    IF LENGTH(v_base_handle) + LENGTH(v_suffix::text) > 30 THEN
      v_handle := SUBSTRING(v_base_handle FROM 1 FOR (30 - LENGTH(v_suffix::text))) || v_suffix::text;
    ELSE
      v_handle := v_base_handle || v_suffix::text;
    END IF;
  END LOOP;

  IF v_suffix > v_max_attempts THEN
    v_handle := 'user_' || v_short_id;
  END IF;

  INSERT INTO public.profiles (id, username, avatar_url, handle)
  VALUES (new.id, v_username, v_avatar_url, v_handle);

  RETURN new;
END;
$function$;