-- ============================================================
-- 007_join_role_preference.sql
-- Let joining users choose their own role instead of auto-assigning.
-- The session host always gets 'jamaneger' regardless of preference.
-- ============================================================

CREATE OR REPLACE FUNCTION join_jam_session(
  p_session_id     uuid,
  p_user_id        uuid,
  p_display_name   text DEFAULT '',
  p_preferred_role text DEFAULT 'jamember'   -- 'jamaneger' | 'jamember'
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role text;
BEGIN
  -- Host always becomes jamaneger regardless of preference
  SELECT CASE
    WHEN host_user_id = p_user_id THEN 'jamaneger'
    ELSE p_preferred_role
  END
  INTO v_role
  FROM jam_sessions
  WHERE id = p_session_id;

  -- Sanitise: reject unexpected values
  IF v_role NOT IN ('jamaneger', 'jamember') THEN
    v_role := 'jamember';
  END IF;

  -- Upsert: ON CONFLICT uses the partial unique index from migration 006.
  -- Page-refresh preserves the existing role (DO NOTHING on role column).
  INSERT INTO jam_members(session_id, user_id, role, display_name)
  VALUES (p_session_id, p_user_id, v_role, p_display_name)
  ON CONFLICT (session_id, user_id) WHERE user_id IS NOT NULL
  DO UPDATE SET display_name = EXCLUDED.display_name
  RETURNING role INTO v_role;

  RETURN v_role;
END;
$$;
