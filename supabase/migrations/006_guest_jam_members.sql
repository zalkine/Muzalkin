-- ============================================================
-- 006_guest_jam_members.sql
-- Allow unauthenticated users to join jam sessions as guests.
-- Guests identify themselves with a guest_token (UUID stored
-- in localStorage) instead of a Supabase user_id.
-- ============================================================

-- 1. Make user_id nullable — guests won't have one
ALTER TABLE jam_members ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add guest_token column for anonymous participants
ALTER TABLE jam_members ADD COLUMN IF NOT EXISTS guest_token uuid;

-- 3. Exactly one of user_id / guest_token must be set per row
ALTER TABLE jam_members ADD CONSTRAINT jam_members_identity_check
  CHECK (
    (user_id IS NOT NULL AND guest_token IS NULL) OR
    (user_id IS NULL     AND guest_token IS NOT NULL)
  );

-- 4. Replace UNIQUE(session_id, user_id) with two partial unique indexes
--    (the original implicit constraint only covered user_id, now nullable)
ALTER TABLE jam_members DROP CONSTRAINT IF EXISTS jam_members_session_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS jam_members_session_user
  ON jam_members(session_id, user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS jam_members_session_guest
  ON jam_members(session_id, guest_token) WHERE guest_token IS NOT NULL;

-- 5. Allow anonymous clients to read members of active sessions
CREATE POLICY "jam_members: anon read active sessions"
  ON jam_members FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM jam_sessions s
      WHERE s.id = session_id AND s.is_active = true
    )
  );

-- 6. Allow anonymous clients to read the queue of active sessions
CREATE POLICY "jam_queue: anon read active sessions"
  ON jam_queue FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM jam_sessions s
      WHERE s.id = session_id AND s.is_active = true
    )
  );

-- 7. Allow anonymous clients to add songs to the queue
CREATE POLICY "jam_queue: anon insert"
  ON jam_queue FOR INSERT TO anon
  WITH CHECK (true);

-- ── 8. join_jam_session_guest ─────────────────────────────────────────────
--   Guests are always assigned 'jamember' (never jamanager).
--   ON CONFLICT updates the display name so page-refresh works.
--   SECURITY DEFINER bypasses RLS for the insert.

CREATE OR REPLACE FUNCTION join_jam_session_guest(
  p_session_id   uuid,
  p_guest_token  uuid,
  p_display_name text DEFAULT ''
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO jam_members(session_id, guest_token, role, display_name)
  VALUES (p_session_id, p_guest_token, 'jamember', p_display_name)
  ON CONFLICT (session_id, guest_token) WHERE guest_token IS NOT NULL
  DO UPDATE SET display_name = EXCLUDED.display_name;

  RETURN 'jamember';
END;
$$;

-- ── 9. leave_jam_guest ────────────────────────────────────────────────────
--   Called when a guest leaves voluntarily.
--   SECURITY DEFINER so anon clients can execute it without direct RLS.

CREATE OR REPLACE FUNCTION leave_jam_guest(
  p_session_id  uuid,
  p_guest_token uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM jam_members
  WHERE session_id = p_session_id AND guest_token = p_guest_token;
END;
$$;

-- ── 10. kick_jam_guest ────────────────────────────────────────────────────
--   Jamaneger removes a guest participant.

CREATE OR REPLACE FUNCTION kick_jam_guest(
  p_session_id         uuid,
  p_guest_token        uuid,
  p_requesting_user_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM jam_members
    WHERE session_id = p_session_id
      AND user_id    = p_requesting_user_id
      AND role       = 'jamaneger'
  ) THEN
    RAISE EXCEPTION 'Not authorised: only a jamaneger can kick members';
  END IF;

  DELETE FROM jam_members
  WHERE session_id = p_session_id AND guest_token = p_guest_token;
END;
$$;
