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
 */

const path          = require('path');
const { spawnSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

// Service-role client — required for writing to cached_chords
// Deferred to avoid crashing at startup if env vars are not yet set
function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
  );
}

// Anon client for reads — works even if SERVICE_KEY is missing
function getSupabaseAnon() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
  );
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

async function searchCache(query, lang) {
  const q = query.trim();
  const { data, error } = await getSupabaseAnon()
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
  const { data, error } = await getSupabaseAnon()
    .from('cached_chords')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

async function saveToCache({ title, artist, lang, source, chordsData, url }) {
  const { data, error } = await getSupabase()
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

const SCRAPER_DIR = path.join(__dirname, '..');

function runPythonScraper(scriptName, args) {
  const result = spawnSync(
    'python3',
    [path.join(SCRAPER_DIR, scriptName), ...args],
    { encoding: 'utf-8', timeout: 30_000 },
  );

  if (result.error) {
    console.error(`${scriptName} spawn error:`, result.error.message);
    return null;
  }
  if (result.status !== 0) {
    console.error(`${scriptName} stderr:`, result.stderr);
    return null;
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    console.error(`${scriptName} returned invalid JSON`);
    return null;
  }
}

// Returns array of { title, artist, url } — no chords scraped yet
function searchTab4U(query, artist = '') {
  const args = ['--search-only', query];
  if (artist) args.push(artist);
  return runPythonScraper('tab4u_scraper.py', args) ?? [];
}

function searchUltimateGuitar(query, artist = '') {
  const args = ['--search-only', query];
  if (artist) args.push(artist);
  return runPythonScraper('ultimate_guitar_scraper.py', args) ?? [];
}

// Fetch and parse chords for a specific URL
function fetchTab4UByUrl(url, title = '', artist = '') {
  return runPythonScraper('tab4u_scraper.py', ['--url', url, title, artist]);
}

function fetchUGByUrl(url, title = '', artist = '') {
  return runPythonScraper('ultimate_guitar_scraper.py', ['--url', url, title, artist]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search for songs. Returns up to 20 results.
 * Cache results are returned as { id, song_title, artist, language, source }.
 * Scraper results (cache miss) are returned as { song_title, artist, source, source_url }.
 */
async function searchChords(query, lang = 'he') {
  const cached = await searchCache(query, lang);
  if (cached.length > 0) return cached;

  let scraperResults = [];

  if (lang === 'he') {
    scraperResults = searchTab4U(query).map(r => ({
      song_title: r.title,
      artist:     r.artist,
      source:     'tab4u',
      source_url: r.url,
      language:   lang,
    }));
  } else {
    scraperResults = searchUltimateGuitar(query).map(r => ({
      song_title: r.title,
      artist:     r.artist,
      source:     'ultimate_guitar',
      source_url: r.url,
      language:   lang,
    }));

    if (scraperResults.length === 0) {
      scraperResults = searchTab4U(query).map(r => ({
        song_title: r.title,
        artist:     r.artist,
        source:     'tab4u',
        source_url: r.url,
        language:   lang,
      }));
    }
  }

  return scraperResults.slice(0, 20);
}

/**
 * Fetch full chords for a specific song URL. Checks cache by URL first.
 * On cache miss: scrapes, saves to cache, returns the cached_chords row.
 */
async function fetchChordsForSong({ url, title, artist, source, lang }) {
  // Check if already cached by URL
  const { data: existing } = await getSupabase()
    .from('cached_chords')
    .select('*')
    .eq('raw_url', url)
    .limit(1)
    .single();

  if (existing) return existing;

  let scraped = null;
  if (source === 'ultimate_guitar') {
    scraped = fetchUGByUrl(url, title, artist);
  } else {
    scraped = fetchTab4UByUrl(url, title, artist);
  }

  if (!scraped || !scraped.chords_data) return null;

  return saveToCache({
    title:      scraped.title  || title,
    artist:     scraped.artist || artist,
    lang,
    source,
    chordsData: scraped.chords_data,
    url:        scraped.url || url,
  });
}

/**
 * Return full chord data for a single cached row.
 */
async function getChordsById(id) {
  return getCachedById(id);
}

module.exports = { searchChords, fetchChordsForSong, getChordsById };
