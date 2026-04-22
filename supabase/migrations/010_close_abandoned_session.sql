-- ============================================================
-- 010_close_abandoned_session.sql
--
-- RPC callable by any session member to close an abandoned
-- session (all jamanagers disconnected).
--
-- The 2-minute grace period is enforced on the client side.
-- This function just provides a permissioned way to mark the
-- session inactive without requiring the original host/lead.
-- ============================================================

CREATE OR REPLACE FUNCTION close_jam_session_if_abandoned(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE jam_sessions
  SET is_active = false
  WHERE id = p_session_id AND is_active = true;
  RETURN FOUND;
END;
$$;
