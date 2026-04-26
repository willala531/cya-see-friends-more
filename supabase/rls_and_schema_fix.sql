-- =============================================================================
-- CYA — Full schema + RLS fix
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- The script is idempotent: safe to re-run if you need to reset policies.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1 — ADD MISSING COLUMNS TO EXISTING TABLES
-- These ALTER TABLE ... ADD COLUMN IF NOT EXISTS statements are safe to run
-- even if the column already exists.
-- ─────────────────────────────────────────────────────────────────────────────

-- users: Google OAuth refresh token (written by AuthContext on sign-in)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS google_refresh_token text;

-- groups: activity interest IDs + repeat-filter persistence
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS group_interests text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS last_suggested_activity_id text;

-- hangout_suggestions: full RSVP-flow columns
ALTER TABLE public.hangout_suggestions
  ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;
ALTER TABLE public.hangout_suggestions
  ADD COLUMN IF NOT EXISTS rsvp_expires_at timestamptz;
ALTER TABLE public.hangout_suggestions
  ADD COLUMN IF NOT EXISTS vote_expires_at timestamptz;
ALTER TABLE public.hangout_suggestions
  ADD COLUMN IF NOT EXISTS vote_options jsonb;
ALTER TABLE public.hangout_suggestions
  ADD COLUMN IF NOT EXISTS winning_activity_id text;

-- rsvps: add 'maybe' to the response check constraint
ALTER TABLE public.rsvps
  DROP CONSTRAINT IF EXISTS rsvps_response_check;
ALTER TABLE public.rsvps
  ADD CONSTRAINT rsvps_response_check
  CHECK (response IN ('yes', 'no', 'maybe', 'pending'));

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2 — CREATE MISSING TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- notifications: in-app alerts written by Edge Functions (service_role)
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id   uuid        REFERENCES public.groups(id) ON DELETE CASCADE,
  message    text        NOT NULL,
  read       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- push_subscriptions: Web Push endpoint/keys per user
-- Using a single row per user (upsert on user_id) keeps it simple.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription jsonb       NOT NULL,       -- { endpoint, keys: { p256dh, auth } }
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)                          -- one active subscription per user
);

-- hangout_votes: one vote per user per hangout, on conflict update
CREATE TABLE IF NOT EXISTS public.hangout_votes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hangout_id  uuid        NOT NULL REFERENCES public.hangout_suggestions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_id text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hangout_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3 — ENABLE RLS ON EVERY TABLE
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hangout_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hangout_votes       ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 4 — SECURITY DEFINER HELPER FUNCTION
-- ─────────────────────────────────────────────────────────────────────────────
-- The group_members table's RLS policy would cause infinite recursion if it
-- referenced itself directly (PostgreSQL evaluates policies recursively).
-- The fix: a SECURITY DEFINER function that bypasses RLS for its own query,
-- then policies call this function instead of querying group_members directly.

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id  = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 5 — DROP ALL EXISTING POLICIES (clean slate)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      r.policyname, r.tablename
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 6 — RECREATE ALL POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

-- ── users ────────────────────────────────────────────────────────────────────
-- Users need to read their own row AND the display_name of group co-members
-- (required for RSVP lists which do `rsvps ( users ( id, display_name ) )`).

CREATE POLICY "users: select own or co-member"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid()
        AND gm2.user_id = users.id
    )
  );

CREATE POLICY "users: insert own profile"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users: update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── groups ───────────────────────────────────────────────────────────────────

CREATE POLICY "groups: select if member"
  ON public.groups FOR SELECT
  TO authenticated
  USING (public.is_group_member(id));

CREATE POLICY "groups: insert for authenticated"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "groups: update if member"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (public.is_group_member(id))
  WITH CHECK (public.is_group_member(id));

-- ── group_members ─────────────────────────────────────────────────────────────
-- Uses is_group_member() to avoid self-referential recursion.

CREATE POLICY "group_members: select if same group"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "group_members: insert own membership"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "group_members: delete own membership"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ── availability_blocks ───────────────────────────────────────────────────────
-- Own blocks always readable/writable.
-- Co-members can read each other's blocks (needed for group availability overlay).

CREATE POLICY "availability_blocks: select own or co-member"
  ON public.availability_blocks FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid()
        AND gm2.user_id = availability_blocks.user_id
    )
  );

CREATE POLICY "availability_blocks: insert own"
  ON public.availability_blocks FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "availability_blocks: update own"
  ON public.availability_blocks FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "availability_blocks: delete own"
  ON public.availability_blocks FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ── hangout_suggestions ───────────────────────────────────────────────────────

CREATE POLICY "hangout_suggestions: select if group member"
  ON public.hangout_suggestions FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "hangout_suggestions: insert if group member"
  ON public.hangout_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_group_member(group_id));

CREATE POLICY "hangout_suggestions: update if group member"
  ON public.hangout_suggestions FOR UPDATE
  TO authenticated
  USING (public.is_group_member(group_id))
  WITH CHECK (public.is_group_member(group_id));

-- ── rsvps ─────────────────────────────────────────────────────────────────────

CREATE POLICY "rsvps: select if group member"
  ON public.rsvps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hangout_suggestions hs
      WHERE hs.id = rsvps.hangout_id
        AND public.is_group_member(hs.group_id)
    )
  );

CREATE POLICY "rsvps: insert own"
  ON public.rsvps FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.hangout_suggestions hs
      WHERE hs.id = hangout_id
        AND public.is_group_member(hs.group_id)
    )
  );

CREATE POLICY "rsvps: update own"
  ON public.rsvps FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── notifications ─────────────────────────────────────────────────────────────
-- Edge Functions (service_role) insert notifications — they bypass RLS entirely.
-- Client side only needs select + update (mark as read).

CREATE POLICY "notifications: select own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications: update own (mark read)"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── push_subscriptions ────────────────────────────────────────────────────────

CREATE POLICY "push_subscriptions: select own"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "push_subscriptions: insert own"
  ON public.push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_subscriptions: update own"
  ON public.push_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_subscriptions: delete own"
  ON public.push_subscriptions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ── hangout_votes ─────────────────────────────────────────────────────────────

CREATE POLICY "hangout_votes: select if group member"
  ON public.hangout_votes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hangout_suggestions hs
      WHERE hs.id = hangout_votes.hangout_id
        AND public.is_group_member(hs.group_id)
    )
  );

CREATE POLICY "hangout_votes: insert own"
  ON public.hangout_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.hangout_suggestions hs
      WHERE hs.id = hangout_id
        AND public.is_group_member(hs.group_id)
    )
  );

CREATE POLICY "hangout_votes: update own"
  ON public.hangout_votes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- DONE. Verify with:
--   SELECT tablename, policyname, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, cmd;
-- =============================================================================
