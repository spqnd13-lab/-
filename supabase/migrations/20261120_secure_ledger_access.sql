-- Secure contact storage: run in Supabase SQL Editor only after review.
-- The previous foundation migration must be applied first.
BEGIN;
CREATE OR REPLACE FUNCTION public.hb_can_access_listing(target_listing uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.hb_staff_memberships m
  LEFT JOIN public.hb_listings l ON l.id = target_listing
  WHERE m.user_id = (SELECT auth.uid()) AND m.active
    AND (m.role = 'admin' OR (m.role = 'staff' AND l.assigned_user_id = m.user_id))
 );
$$;
REVOKE ALL ON FUNCTION public.hb_can_access_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_can_access_listing(uuid) TO authenticated;

CREATE POLICY hb_listings_read ON public.hb_listings FOR SELECT TO authenticated
 USING (public.hb_can_access_listing(id));
CREATE POLICY hb_listings_insert ON public.hb_listings FOR INSERT TO authenticated
 WITH CHECK (EXISTS (SELECT 1 FROM public.hb_staff_memberships m WHERE m.user_id = (SELECT auth.uid()) AND m.active AND m.role = 'admin'));
CREATE POLICY hb_contacts_read ON public.hb_listing_private_contacts FOR SELECT TO authenticated
 USING (public.hb_can_access_listing(listing_id));
CREATE POLICY hb_contacts_insert ON public.hb_listing_private_contacts FOR INSERT TO authenticated
 WITH CHECK (public.hb_can_access_listing(listing_id));
CREATE POLICY hb_contacts_update ON public.hb_listing_private_contacts FOR UPDATE TO authenticated
 USING (public.hb_can_access_listing(listing_id))
 WITH CHECK (public.hb_can_access_listing(listing_id));

GRANT SELECT, INSERT ON public.hb_listings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.hb_listing_private_contacts TO authenticated;
-- No client write to memberships or ingest events. No anonymous access.
COMMIT;
