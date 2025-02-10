-------------------------------------------------------------------
-- Function called to verify users access on a list of specified --
-- modules name and version (version is optional).               --
-------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_user_modules_access(
  checked_user_ids INT[],
  module_names TEXT[]
)
RETURNS TABLE (modules_access_granted BOOLEAN, error_message TEXT) AS $$

DECLARE
  active_user_ids INT[];        -- List of active requested users
  active_module_ids INT[];      -- List of active requested modules
  active_user_role_ids INT[];   -- List of active roles of requested users
  active_user_module_ids INT[]; -- List of active modules of requested users
  diff INT[];

  total_users INT;              -- Number of users in checked_user_ids
  module_spec TEXT;			        -- Item of module_names
  module_id INT;                -- Module ID iterator
  module_name TEXT;		          -- Extracted module name iterator
  module_version TEXT;		      -- Extracted module version iterator

BEGIN

  ------
  -- 1. Check users exist and are active.
  ------

  total_users := array_length(checked_user_ids, 1); -- Get the total number of users to check

  SELECT ARRAY_AGG(id) INTO active_user_ids
  FROM public.users u WHERE u.id = ANY(checked_user_ids) AND u.is_active = TRUE;

  IF active_user_ids IS NULL OR array_length(active_user_ids, 1) <> total_users THEN
    diff := (SELECT ARRAY(SELECT UNNEST(checked_user_ids) EXCEPT SELECT UNNEST(active_user_ids)));
    RETURN QUERY VALUES (FALSE, 'User(s) ' || array_to_string(diff, ', ') || ' does not exist or are not active');
    RETURN;
  END IF;


  ------
  -- 2. Check if modules exist and are active.
  ------

  FOREACH module_spec IN ARRAY module_names
  LOOP

  	module_id := NULL;                               -- Reset module_id for each iteration
    module_version := NULL;                          -- Reset module_version for each iteration
    module_name := SPLIT_PART(module_spec, '/', 1);  -- Extract the module name

    -- Extract the module version if specified
    IF SPLIT_PART(module_spec, '/', 2) <> '' THEN
      module_version := SPLIT_PART(module_spec, '/', 2);
    END IF;

    -- If the version is not specified, consider the most recent version
    IF module_version IS NULL THEN
      SELECT id, version INTO module_id, module_version
      FROM public.modules m WHERE m.name = module_name AND m.is_active = TRUE
      ORDER BY m.created_at DESC LIMIT 1;

      IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'No active module found for: ' || module_name;
        RETURN;
	  ELSE
	  	active_module_ids := array_append(active_module_ids, module_id);
        CONTINUE;
      END IF;
    END IF;

    -- Check if the specified version exists and is active
    SELECT id INTO module_id
    FROM public.modules m WHERE m.name = module_name AND m.version = module_version AND m.is_active = TRUE LIMIT 1;

    IF NOT FOUND THEN
      RETURN QUERY SELECT FALSE, 'No active module found for: ' || module_name || '/' || module_version;
      RETURN;
	ELSE
	 active_module_ids := array_append(active_module_ids, module_id);
    END IF;
  END LOOP;


  ------
  -- 3. Check if users have existing and active roles.
  ------

  SELECT ARRAY_AGG(DISTINCT role_id) INTO active_user_role_ids
  FROM public.link_users_roles lur
  	JOIN public.roles r ON r.id = lur.role_id AND r.is_active = TRUE
  WHERE lur.user_id = ANY(active_user_ids);

  IF active_user_role_ids IS NULL THEN
    RETURN QUERY VALUES (FALSE, 'User(s) ' || array_to_string(active_user_ids, ', ') || ' does not have active roles');
    RETURN;
  END IF;


  ------
  -- 4. Check that active user roles cover access to all the required modules.
  ------

  SELECT ARRAY_AGG(DISTINCT lrm.module_id) INTO active_user_module_ids
  FROM public.link_roles_modules lrm
  	JOIN public.modules m ON m.id = lrm.module_id AND m.is_active = TRUE
  WHERE lrm.role_id = ANY(active_user_role_ids);

  IF active_user_module_ids IS NULL THEN
    RETURN QUERY VALUES (FALSE, 'User(s) ' || array_to_string(active_user_ids, ', ') || ' does not have active modules');
    RETURN;
  ELSE

    SELECT ARRAY_AGG(unnested_module_id) INTO diff
    FROM unnest(active_module_ids) AS unnested_module_id
    WHERE NOT unnested_module_id = ANY(active_user_module_ids);

    IF diff IS NOT NULL AND array_length(diff, 1) > 0 THEN
      RETURN QUERY SELECT FALSE, 'User(s) ' || array_to_string(active_user_ids, ', ') || ' does not have access to module(s) with ID(s): ' || array_to_string(diff, ', ');
      RETURN;
    END IF;
  END IF;

  ------
  -- 5. Return TRUE if all module access granted.
  ------
  RETURN QUERY VALUES (TRUE, NULL);
END;
$$ LANGUAGE plpgsql;