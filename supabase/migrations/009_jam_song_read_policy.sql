-- ============================================================
-- 009_jam_song_read_policy.sql
-- Allow any user (including guests) to read a song that is
-- currently referenced in an active jam queue.
--
-- Without this, jamembers who don't own the song get a 403
-- when SongDetailPage tries to load it from the songs table.
-- ============================================================

CREATE POLICY "songs in active jam sessions are readable"
ON songs FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM   jam_queue   jq
    JOIN   jam_sessions js ON js.id = jq.session_id
    WHERE  jq.song_id::uuid = songs.id
      AND  js.is_active = true
  )
);
