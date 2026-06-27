
CREATE POLICY "Users self-assign non-admin role"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role <> 'admin');

CREATE POLICY "Users delete own non-admin role"
  ON public.user_roles FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND role <> 'admin');
