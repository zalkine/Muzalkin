-- ============================================================
-- 008_lead_user_id.sql
-- Adds explicit lead_user_id to jam_sessions so the lead role
-- can be transferred between jamanagers mid-session.
-- NULL → falls back to host_user_id (backwards-compatible).
-- ============================================================

ALTER TABLE jam_sessions
  ADD COLUMN IF NOT EXISTS lead_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- ── take_jam_lead ─────────────────────────────────────────────────────────
-- Any jamanager can call this to take screen-control from the current lead.
-- SECURITY DEFINER bypasses the host-only RLS update policy.

CREATE OR REPLACE FUNCTION take_jam_lead(
  p_session_id uuid,
  p_user_id    uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM jam_members
    WHERE session_id = p_session_id
      AND user_id    = p_user_id
      AND role       = 'jamaneger'
  ) THEN
    RAISE EXCEPTION 'Only a jamanager can take the lead';
  END IF;

  UPDATE jam_sessions
  SET lead_user_id = p_user_id
  WHERE id = p_session_id;
END;
$$;
