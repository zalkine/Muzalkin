-- ============================================================
-- Jam Session Enhancement  —  שירה בציבור
-- Adds: jam_members, jam_queue, role functions, promote/kick
-- ============================================================

-- ── 1. Extend jam_sessions ────────────────────────────────────────────────
ALTER TABLE jam_sessions
  ADD COLUMN IF NOT EXISTS current_transpose   int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_speed_index int NOT NULL DEFAULT 1;

-- ── 2. jam_members ────────────────────────────────────────────────────────
--   Persists role per user so it survives page refresh.
--   Roles: 'jamaneger' (manager) | 'jamember' (participant)

CREATE TABLE IF NOT EXISTS jam_members (
  id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid      NOT NULL REFERENCES jam_sessions(id) ON DELETE CASCADE,
  user_id     uuid      NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  role        text      NOT NULL CHECK (role IN ('jamaneger', 'jamember')),
  display_name text     NOT NULL DEFAULT '',
  joined_at   timestamp NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_jam_members_session ON jam_members(session_id);

ALTER TABLE jam_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jam_members: read active sessions"
  ON jam_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jam_sessions s
      WHERE s.id = session_id AND s.is_active = true
    )
  );

CREATE POLICY "jam_members: insert self"
  ON jam_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "jam_members: delete self"
  ON jam_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── 3. jam_queue ──────────────────────────────────────────────────────────
--   Ordered song list per session. All users can add directly (no approval).

CREATE TABLE IF NOT EXISTS jam_queue (
  id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid      NOT NULL REFERENCES jam_sessions(id) ON DELETE CASCADE,
  song_id     text      NOT NULL,
  source      text      NOT NULL CHECK (source IN ('cached', 'saved')),
  title       text      NOT NULL DEFAULT '',
  artist      text      NOT NULL DEFAULT '',
  position    int       NOT NULL,
  added_by    uuid      REFERENCES users(id) ON DELETE SET NULL,
  added_at    timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jam_queue_session_pos ON jam_queue(session_id, position);

ALTER TABLE jam_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jam_queue: read active sessions"
  ON jam_queue FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jam_sessions s
      WHERE s.id = session_id AND s.is_active = true
    )
  );

CREATE POLICY "jam_queue: insert authenticated"
  ON jam_queue FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "jam_queue: update authenticated"
  ON jam_queue FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "jam_queue: delete authenticated"
  ON jam_queue FOR DELETE TO authenticated
  USING (true);

-- ── 4. join_jam_session() ─────────────────────────────────────────────────
--   Atomically assigns role when a user joins:
--     < 2 managers already → 'jamaneger', otherwise → 'jamember'
--   ON CONFLICT DO UPDATE preserves role on page-refresh.

CREATE OR REPLACE FUNCTION join_jam_session(
  p_session_id  uuid,
  p_user_id     uuid,
  p_display_name text DEFAULT ''
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role          text;
  v_manager_count int;
BEGIN
  SELECT COUNT(*) INTO v_manager_count
  FROM jam_members
  WHERE session_id = p_session_id AND role = 'jamaneger';

  IF v_manager_count < 2 THEN
    v_role := 'jamaneger';
  ELSE
    v_role := 'jamember';
  END IF;

  INSERT INTO jam_members(session_id, user_id, role, display_name)
  VALUES (p_session_id, p_user_id, v_role, p_display_name)
  ON CONFLICT (session_id, user_id)
  DO UPDATE SET display_name = EXCLUDED.display_name
  RETURNING role INTO v_role;

  RETURN v_role;
END;
$$;

-- ── 5. kick_jam_member() ──────────────────────────────────────────────────
--   Jamaneger removes a jamember from the session.

CREATE OR REPLACE FUNCTION kick_jam_member(
  p_session_id         uuid,
  p_target_user_id     uuid,
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
  WHERE session_id = p_session_id AND user_id = p_target_user_id;
END;
$$;

-- ── 6. promote_jam_member() ───────────────────────────────────────────────
--   Jamaneger promotes a jamember to jamaneger.

CREATE OR REPLACE FUNCTION promote_jam_member(
  p_session_id         uuid,
  p_target_user_id     uuid,
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
    RAISE EXCEPTION 'Not authorised: only a jamaneger can promote members';
  END IF;

  UPDATE jam_members
  SET role = 'jamaneger'
  WHERE session_id = p_session_id AND user_id = p_target_user_id;
END;
$$;

-- ── 7. Backfill active sessions ───────────────────────────────────────────
--   Existing active sessions get their host recorded as a jamaneger.

INSERT INTO jam_members(session_id, user_id, role, display_name)
SELECT id, host_user_id, 'jamaneger', ''
FROM jam_sessions
WHERE is_active = true AND host_user_id IS NOT NULL
ON CONFLICT (session_id, user_id) DO NOTHING;
