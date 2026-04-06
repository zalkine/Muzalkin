-- ============================================================
-- Jam Sessions  —  שירה בציבור
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

CREATE TABLE jam_sessions (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text    NOT NULL UNIQUE,        -- 6-char join code, e.g. "ABC123"
  host_user_id        uuid    REFERENCES users(id) ON DELETE CASCADE,
  current_song_id     text,                           -- ID in cached_chords or songs table
  current_song_source text    NOT NULL DEFAULT 'cached',  -- 'cached' | 'saved'
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_jam_sessions_code_active ON jam_sessions(code) WHERE is_active = true;

-- Row-level security: only the host can update/delete their own session
ALTER TABLE jam_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read active sessions"
  ON jam_sessions FOR SELECT
  USING (is_active = true);

CREATE POLICY "authenticated users can create sessions"
  ON jam_sessions FOR INSERT
  TO authenticated
  WITH CHECK (host_user_id = auth.uid());

CREATE POLICY "host can update their session"
  ON jam_sessions FOR UPDATE
  TO authenticated
  USING (host_user_id = auth.uid());

CREATE POLICY "host can delete their session"
  ON jam_sessions FOR DELETE
  TO authenticated
  USING (host_user_id = auth.uid());
