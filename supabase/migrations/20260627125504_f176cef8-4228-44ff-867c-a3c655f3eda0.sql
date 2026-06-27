CREATE OR REPLACE FUNCTION app_private.user_has_any_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

GRANT EXECUTE ON FUNCTION app_private.user_has_any_role(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users self-assign non-admin role" ON public.user_roles;
CREATE POLICY "Users choose first onboarding role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT app_private.user_has_any_role(auth.uid())
);