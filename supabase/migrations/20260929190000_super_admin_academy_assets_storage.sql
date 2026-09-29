-- Super admins are identified by user_roles.is_super_admin, independent of role,
-- so the admin-only academy-assets policies rejected their uploads.

DROP POLICY IF EXISTS "Admins can upload academy assets" ON storage.objects;
CREATE POLICY "Admins can upload academy assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'academy-assets'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_super_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can update academy assets" ON storage.objects;
CREATE POLICY "Admins can update academy assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'academy-assets'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_super_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can delete academy assets" ON storage.objects;
CREATE POLICY "Admins can delete academy assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'academy-assets'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_super_admin(auth.uid())
  )
);
