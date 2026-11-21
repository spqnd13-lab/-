-- 인천 홈앤비즈 보안 매물장 기초 스키마 (미적용 초안)
-- 실제 배포 전 Supabase 프로젝트, 인증, 기존 테이블과 충돌 여부 검토 필수.
-- 기본 원칙: 인증 사용자라도 정책이 없으면 SELECT/INSERT/UPDATE/DELETE 불가.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS public.hb_staff_memberships (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'staff')),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hb_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_listing_id text UNIQUE,
  title text NOT NULL,
  assigned_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hb_listing_private_contacts (
  listing_id uuid PRIMARY KEY REFERENCES public.hb_listings(id) ON DELETE CASCADE,
  landlord_name text,
  landlord_phone text,
  tenant_name text,
  tenant_phone text,
  private_memo text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hb_ingest_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_event_id text NOT NULL,
  listing_id uuid REFERENCES public.hb_listings(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_event_id)
);

-- RLS enabled and forced. No client policies granted until auth + access model review.
ALTER TABLE public.hb_staff_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_staff_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hb_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_listings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hb_listing_private_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_listing_private_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hb_ingest_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_ingest_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.hb_staff_memberships FROM anon, authenticated;
REVOKE ALL ON public.hb_listings FROM anon, authenticated;
REVOKE ALL ON public.hb_listing_private_contacts FROM anon, authenticated;
REVOKE ALL ON public.hb_ingest_events FROM anon, authenticated;

COMMIT;
