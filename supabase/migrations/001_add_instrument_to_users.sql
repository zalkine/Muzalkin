-- Migration 001: Add instrument preference column to users table
--
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- or via: supabase db push (if using Supabase CLI)
--
-- This adds the instrument preference (guitar/piano) to the users profile
-- so it persists across devices and sessions.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS instrument text
  NOT NULL DEFAULT 'guitar'
  CHECK (instrument IN ('guitar', 'piano'));

-- Update the auth trigger to include instrument when creating new users
-- (no change needed — the trigger doesn't set instrument; it defaults to 'guitar')
