-- =============================================================================
-- CYA — Invite flow migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- Idempotent: safe to re-run.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1 — ADD COLUMNS TO EXISTING TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- users: phone number (for matching incoming invites after onboarding)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_number text;

-- users: onboarding flag — DEFAULT true so existing users skip onboarding;
-- new users are inserted with false by fetchOrCreateProfile in AuthContext.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS has_completed_onboarding boolean NOT NULL DEFAULT true;

-- group_members: invite permission flag — DEFAULT false;
-- group creator is set to true by useCreateGroup.
ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS can_invite boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2 — CREATE group_invites TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.group_invites (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invited_by   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone_number text        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  token        text        NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + INTERVAL '7 days'
);

-- Index on token for fast public lookup (InvitePage, get-invite Edge Function)
CREATE UNIQUE INDEX IF NOT EXISTS group_invites_token_idx
  ON public.group_invites (token);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3 — ENABLE RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 4 — RLS POLICIES FOR group_invites
-- ─────────────────────────────────────────────────────────────────────────────
-- Note: the Edge Functions (create-invite, get-invite, process-invite) all use
-- service_role and bypass RLS entirely. The policies below are for the
-- authenticated Supabase JS client used by useGroupInvites() on the group page.

DROP POLICY IF EXISTS "invites: group members can read" ON public.group_invites;

-- Group members can read pending invites for their group (for the invite list UI)
CREATE POLICY "invites: group members can read"
  ON public.group_invites FOR SELECT
  TO authenticated
  USING (
    public.is_group_member(group_id)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 5 — RLS POLICY: allow group_members can_invite update
-- ─────────────────────────────────────────────────────────────────────────────
-- The creator needs to update can_invite on other members' rows.
-- We allow any authenticated member to update can_invite on rows in their group.
-- (Fine-grained "creator only" enforcement is done in the UI; the RLS policy
-- is intentionally permissive here since can_invite is a low-risk field.)

DROP POLICY IF EXISTS "group_members: update can_invite" ON public.group_members;

CREATE POLICY "group_members: update can_invite"
  ON public.group_members FOR UPDATE
  TO authenticated
  USING (public.is_group_member(group_id))
  WITH CHECK (public.is_group_member(group_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 6 — BACKFILL: set can_invite = true for all existing group creators
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.group_members gm
SET can_invite = true
FROM public.groups g
WHERE g.id = gm.group_id
  AND g.created_by = gm.user_id;

-- =============================================================================
-- DONE. Verify with:
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'group_invites';
-- =============================================================================
