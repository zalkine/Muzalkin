-- ============================================================
-- Chord App — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
-- pgcrypto is enabled by default on Supabase; gen_random_uuid() is available.
-- No extra extensions needed.

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE users (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text        NOT NULL UNIQUE,
  display_name text        NOT NULL,
  avatar_url   text,
  language     text        NOT NULL DEFAULT 'he' CHECK (language IN ('he', 'en')),
  created_at   timestamp   DEFAULT now()
);

CREATE TABLE songs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  artist      text        NOT NULL,
  language    text        DEFAULT 'he' CHECK (language IN ('he', 'en')),
  chords_data jsonb,                           -- [{ type: "chords"|"lyrics"|"section", content: "..." }]
  source_url  text,                            -- original URL chords were fetched from
  instrument  text        DEFAULT 'guitar'     CHECK (instrument IN ('guitar', 'piano')),
  transpose   int         DEFAULT 0,           -- semitone shift (-11 to +11)
  created_at  timestamp   DEFAULT now()
);

CREATE TABLE playlists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  is_public   boolean     NOT NULL DEFAULT false,
  created_at  timestamp   DEFAULT now()
);

CREATE TABLE playlist_songs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid        REFERENCES playlists(id) ON DELETE CASCADE,
  song_id     uuid        REFERENCES songs(id)     ON DELETE CASCADE,
  position    int,
  added_at    timestamp   DEFAULT now()
);

CREATE TABLE cached_chords (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  song_title  text        NOT NULL,
  artist      text        NOT NULL,
  language    text        DEFAULT 'he' CHECK (language IN ('he', 'en')),
  source      text        NOT NULL CHECK (source IN ('tab4u', 'nagnu', 'negina', 'ultimate_guitar', 'chordify')),
  chords_data jsonb       NOT NULL,
  raw_url     text,
  fetched_at  timestamp   DEFAULT now(),
  expires_at  timestamp                         -- NULL = never expires; set for time-sensitive sources
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Fast cache lookups by language + source + title
CREATE INDEX idx_cached_lang_source ON cached_chords (language, source, song_title);

-- Playlist ordering
CREATE INDEX idx_playlist_songs_position ON playlist_songs (playlist_id, position);

-- User's song library
CREATE INDEX idx_songs_user ON songs (user_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Enable RLS on all tables so Supabase Auth policies apply.
-- Without these, the anon/authenticated keys would have unrestricted access.

ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_chords  ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- users: each user can only read/update their own row
-- ------------------------------------------------------------
CREATE POLICY "users: select own"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users: update own"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Supabase Auth trigger inserts a row here on sign-up (see trigger below).
CREATE POLICY "users: insert own"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------
-- songs: owner has full access
-- ------------------------------------------------------------
CREATE POLICY "songs: select own"
  ON songs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "songs: insert own"
  ON songs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "songs: update own"
  ON songs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "songs: delete own"
  ON songs FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- playlists: owner has full access; anyone can read public playlists
-- ------------------------------------------------------------
CREATE POLICY "playlists: select own or public"
  ON playlists FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "playlists: insert own"
  ON playlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "playlists: update own"
  ON playlists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "playlists: delete own"
  ON playlists FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- playlist_songs: access mirrors playlist ownership
-- ------------------------------------------------------------
CREATE POLICY "playlist_songs: select"
  ON playlist_songs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM playlists p
      WHERE p.id = playlist_id
        AND (p.user_id = auth.uid() OR p.is_public = true)
    )
  );

CREATE POLICY "playlist_songs: insert own"
  ON playlist_songs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM playlists p
      WHERE p.id = playlist_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "playlist_songs: delete own"
  ON playlist_songs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM playlists p
      WHERE p.id = playlist_id AND p.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- cached_chords: readable by all authenticated users; writeable by service role only
-- The backend/scraper should use the SERVICE_ROLE key, not the anon key, when writing here.
-- ------------------------------------------------------------
CREATE POLICY "cached_chords: select authenticated"
  ON cached_chords FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- AUTH TRIGGER
-- ============================================================
-- Automatically creates a row in public.users whenever a new
-- Supabase Auth user is created (e.g. via Google OAuth).

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
