------------------------------------------------------------
-- Function called to verify and generate the reset token --
-- for the user password reset procedure.                 --
------------------------------------------------------------

CREATE OR REPLACE
  FUNCTION public.generate_reset_token(
      email_arg TEXT,
      token_arg TEXT
    )
    RETURNS TEXT
    LANGUAGE plpgsql
  AS
$$

DECLARE
  user_exists INT;
  reset_token TEXT;

BEGIN
  SELECT COUNT(*)
  	INTO user_exists
  	FROM public.users u
  	WHERE LOWER(u.email) = LOWER(email_arg);

  IF user_exists = 0 THEN
    RETURN NULL;
  ELSE
    SELECT CONCAT(token_arg, '.', ENCODE(DIGEST(CONCAT(email_arg, token_arg, TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SSUS')), 'sha256'), 'hex')) INTO reset_token;
    RETURN reset_token;
  END IF;

END;
$$;