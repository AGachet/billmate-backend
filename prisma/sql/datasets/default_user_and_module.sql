------
-- 1. Default user roles
------
INSERT INTO public.roles (name, is_active, updated_at)
VALUES
  ('guest', TRUE, NOW()),
  ('user', TRUE, NOW()),
  ('admin', TRUE, NOW()),
  ('superadmin', TRUE, NOW());

------
-- 2. Default modules
------
INSERT INTO public.modules (name, type, version, is_active)
VALUES
  ('user_creation', 'USER_MANAGEMENT', '1.0.0', TRUE);

------
-- 3. Link user_creation module (module_id: 1) to guest role (role_id: 1)
------
INSERT INTO public.roles_modules (role_id, module_id)
VALUES
  (1, 1);

------
-- 4. Create the first user (guest user)
------
DO $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO public.users (id, is_active, firstname, lastname, email, password, updated_at)
  VALUES (gen_random_uuid(), TRUE, 'User', 'Guest', 'user@appguest.com', 'passwordNotUsed', NOW())
  RETURNING id INTO user_id;

  ------
  -- 5. Default user preference (guest user)
  ------
  INSERT INTO public.users_preferences (user_id, locale, updated_at)
  VALUES (user_id, 'EN', NOW());

  ------
  -- 6. Link guest user (user_id: 1) to guest role (role_id: 1)
  ------
  INSERT INTO public.users_roles (user_id, role_id, updated_at)
  VALUES (user_id, 1, NOW());
END $$;