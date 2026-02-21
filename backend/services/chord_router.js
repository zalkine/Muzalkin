'use strict';

/**
 * chord_router.js
 *
 * Cache-first chord fetcher. Always checks cached_chords before calling any
 * scraper. After scraping, persists results so the same song is never fetched
 * twice.
 *
 * Priority order (from CLAUDE.md):
 *   Hebrew  → Tab4U → Nagnu → Negina
 *   English → Ultimate Guitar → Chordify → Tab4U
 *
 * Phase 1 implements Tab4U (Hebrew). Other sources are stubs.
 */

const path          = require('path');
const { spawnSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

// Service-role client — required for writing to cached_chords
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

async function searchCache(query, lang) {
  const q = query.trim();
  const { data, error } = await supabase
    .from('cached_chords')
    .select('id, song_title, artist, language, source, fetched_at')
    .eq('language', lang)
    .or(`song_title.ilike.%${q}%,artist.ilike.%${q}%`)
    .order('fetched_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Cache search error:', error.message);
    return [];
  }
  return data || [];
}

async function getCachedById(id) {
  const { data, error } = await supabase
    .from('cached_chords')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

async function saveToCache({ title, artist, lang, source, chordsData, url }) {
  const { data, error } = await supabase
    .from('cached_chords')
    .insert({
      song_title:  title,
      artist:      artist,
      language:    lang,
      source,
      chords_data: chordsData,
      raw_url:     url,
      expires_at:  null,
    })
    .select()
    .single();

  if (error) {
    console.error('Cache write error:', error.message);
    return null;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Scrapers
// ---------------------------------------------------------------------------

const SCRAPER_DIR = path.join(__dirname, '../../scraper');

function runTab4UScraper(title, artist = '') {
  const args = artist ? [title, artist] : [title];
  const result = spawnSync(
    'python3',
    [path.join(SCRAPER_DIR, 'tab4u_scraper.py'), ...args],
    { encoding: 'utf-8', timeout: 30_000 },
  );

  if (result.error) {
    console.error('Tab4U scraper spawn error:', result.error.message);
    return null;
  }
  if (result.status !== 0) {
    console.error('Tab4U scraper stderr:', result.stderr);
    return null;
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    console.error('Tab4U scraper returned invalid JSON');
    return null;
  }
}

// Stub — Phase 2
function runUltimateGuitarScraper(_title, _artist) {
  console.warn('Ultimate Guitar scraper not yet implemented');
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search for songs. Cache-first; scrapes if nothing found.
 * @returns {Array<{ id, song_title, artist, language, source }>}
 */
async function searchChords(query, lang = 'he') {
  const cached = await searchCache(query, lang);
  if (cached.length > 0) return cached;

  const scraped = lang === 'he'
    ? runTab4UScraper(query)
    : runUltimateGuitarScraper(query, '');

  if (!scraped) return [];

  const row = await saveToCache({
    title:      scraped.title,
    artist:     scraped.artist,
    lang,
    source:     lang === 'he' ? 'tab4u' : 'ultimate_guitar',
    chordsData: scraped.chords_data,
    url:        scraped.url,
  });

  if (!row) return [];

  return [{ id: row.id, song_title: row.song_title, artist: row.artist, language: row.language, source: row.source }];
}

/**
 * Return full chord data for a single cached row.
 */
async function getChordsById(id) {
  return getCachedById(id);
}

module.exports = { searchChords, getChordsById };
