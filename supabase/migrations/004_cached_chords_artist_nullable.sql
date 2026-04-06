-- Migration 004: make cached_chords.artist nullable
--
-- The scraper may not always be able to extract an artist name from the page
-- (e.g. instrumental tracks, unknown artists). Relaxing the NOT NULL
-- constraint prevents insert failures in those cases.
-- The application treats an empty/null artist as "Unknown".

ALTER TABLE cached_chords
  ALTER COLUMN artist DROP NOT NULL,
  ALTER COLUMN artist SET DEFAULT '';

-- Backfill any existing NULLs (safety measure if constraint was ever bypassed)
UPDATE cached_chords SET artist = '' WHERE artist IS NULL;
