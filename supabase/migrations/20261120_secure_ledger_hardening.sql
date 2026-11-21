-- Apply after foundation and access. Preserve all existing rows.
BEGIN;
ALTER TABLE public.hb_listings ALTER COLUMN legacy_listing_id SET NOT NULL;
ALTER TABLE public.hb_listings ADD CONSTRAINT hb_legacy_nonempty CHECK (length(trim(legacy_listing_id)) > 0);
ALTER TABLE public.hb_listing_private_contacts DROP CONSTRAINT IF EXISTS hb_landlord_phone_length;
ALTER TABLE public.hb_listing_private_contacts ADD CONSTRAINT hb_landlord_phone_length CHECK (length(coalesce(landlord_phone,'')) <= 30);
ALTER TABLE public.hb_listing_private_contacts ADD CONSTRAINT hb_tenant_phone_length CHECK (length(coalesce(tenant_phone,'')) <= 30);
ALTER TABLE public.hb_listing_private_contacts ADD CONSTRAINT hb_memo_length CHECK (length(coalesce(private_memo,'')) <= 2000);
-- Only a currently active administrator can see membership details and assign listings.
CREATE OR REPLACE FUNCTION public.hb_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.hb_staff_memberships m WHERE m.user_id = (SELECT auth.uid()) AND m.active AND m.role = 'admin') $$;
REVOKE ALL ON FUNCTION public.hb_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_is_admin() TO authenticated;
CREATE POLICY hb_memberships_read ON public.hb_staff_memberships FOR SELECT TO authenticated
 USING (user_id = (SELECT auth.uid()) OR public.hb_is_admin());
GRANT SELECT (user_id,role,active) ON public.hb_staff_memberships TO authenticated;
CREATE POLICY hb_listings_update ON public.hb_listings FOR UPDATE TO authenticated
 USING (public.hb_is_admin()) WITH CHECK (public.hb_is_admin());
GRANT UPDATE (title,assigned_user_id,updated_at) ON public.hb_listings TO authenticated;
-- Prevent arbitrary UUID assignments to inactive or unknown accounts.
CREATE OR REPLACE FUNCTION public.hb_valid_assignment(target_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT target_user IS NULL OR EXISTS (SELECT 1 FROM public.hb_staff_memberships m WHERE m.user_id = target_user AND m.active AND m.role = 'staff') $$;
REVOKE ALL ON FUNCTION public.hb_valid_assignment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_valid_assignment(uuid) TO authenticated;
ALTER TABLE public.hb_listings ADD CONSTRAINT hb_assignment_requires_active_staff CHECK (public.hb_valid_assignment(assigned_user_id));
-- Function also checks that a referenced listing exists; never authorize a missing row.
CREATE OR REPLACE FUNCTION public.hb_can_access_listing(target_listing uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.hb_staff_memberships m JOIN public.hb_listings l ON l.id = target_listing
 WHERE m.user_id = (SELECT auth.uid()) AND m.active AND (m.role = 'admin' OR (m.role = 'staff' AND l.assigned_user_id = m.user_id))) $$;
REVOKE ALL ON FUNCTION public.hb_can_access_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_can_access_listing(uuid) TO authenticated;
-- Audit writer is a trigger, never directly writable by the browser.
CREATE TABLE IF NOT EXISTS public.hb_contact_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, listing_id uuid NOT NULL, actor_id uuid,
 operation text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hb_contact_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_contact_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.hb_contact_audit FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.hb_audit_contact_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ BEGIN INSERT INTO public.hb_contact_audit(listing_id,actor_id,operation)
 VALUES (NEW.listing_id, (SELECT auth.uid()), TG_OP); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.hb_audit_contact_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS hb_contact_audit_trigger ON public.hb_listing_private_contacts;
CREATE TRIGGER hb_contact_audit_trigger AFTER INSERT OR UPDATE ON public.hb_listing_private_contacts
 FOR EACH ROW EXECUTE FUNCTION public.hb_audit_contact_change();
COMMIT;
