-- Allow unauthenticated users to read cached chords.
-- Chord data is not personal — it's scraped song data.
DROP POLICY IF EXISTS "cached_chords: select authenticated" ON cached_chords;

CREATE POLICY "cached_chords: select anon"
  ON cached_chords FOR SELECT
  TO anon, authenticated
  USING (true);
