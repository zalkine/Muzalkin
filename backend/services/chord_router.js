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
    // Include chords_data so we can filter out bad (chord-less) entries
    .select('id, song_title, artist, language, source, fetched_at, chords_data')
    .eq('language', lang)
    .or(`song_title.ilike.%${q}%,artist.ilike.%${q}%`)
    .order('fetched_at', { ascending: false })
    .limit(40);

  if (error) {
    console.error('Cache search error:', error.message);
    return [];
  }

  // Skip entries that were cached without any chord lines (scraper bug from old code)
  const valid = (data || []).filter(row =>
    Array.isArray(row.chords_data) && row.chords_data.some(l => l.type === 'chords'),
  );

  // Return without chords_data (the search list only needs metadata)
  return valid.slice(0, 20).map(({ chords_data: _cd, ...rest }) => rest);
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

// Scrapers live in  <repo-root>/scraper/  (sibling of backend/)
const SCRAPER_DIR = path.join(__dirname, '..', '..', 'scraper');

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

// Returns array of { title, artist, source, url }
function searchTab4U(query) {
  return runPythonScraper('search.py', ['tab4u', query]) ?? [];
}

function searchUltimateGuitar(query) {
  return runPythonScraper('search.py', ['ug', query]) ?? [];
}

// Fetch and parse chords for a specific URL — returns ChordLine[] array
function fetchTab4UByUrl(url) {
  return runPythonScraper('fetch_chords.py', ['tab4u', url]);
}

function fetchUGByUrl(url) {
  return runPythonScraper('fetch_chords.py', ['ultimate_guitar', url]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search for songs. Returns up to 20 results.
 * Always runs both the cache lookup AND the scraper search, then merges them.
 * Cache hits (with an id) come first; new scraper results follow.
 * This ensures repeated searches for the same word always show the full list.
 *
 * Cache results: { id, song_title, artist, language, source }
 * Scraper results: { song_title, artist, source, source_url, language }
 */
async function searchChords(query, lang = 'he') {
  // Run cache lookup and scraper search in parallel
  const [cached, rawScraper] = await Promise.all([
    searchCache(query, lang),
    (async () => {
      const toResult = (r, src) => ({
        song_title: r.title,
        artist:     r.artist,
        source:     src || r.source || 'tab4u',
        source_url: r.url,
        language:   lang,
      });

      if (lang === 'he') {
        return searchTab4U(query).map(r => toResult(r, 'tab4u'));
      }
      const ug = searchUltimateGuitar(query).map(r => toResult(r, 'ultimate_guitar'));
      if (ug.length > 0) return ug;
      return searchTab4U(query).map(r => toResult(r, 'tab4u'));
    })(),
  ]);

  // Build a set of keys for cached results so we can deduplicate
  const cachedKeys = new Set(
    cached.map(r => `${r.song_title.toLowerCase()}|${(r.artist || '').toLowerCase()}`),
  );

  // Only add scraper results that aren't already in the cache
  const newFromScraper = rawScraper.filter(r => {
    const k = `${r.song_title.toLowerCase()}|${(r.artist || '').toLowerCase()}`;
    return !cachedKeys.has(k);
  });

  return [...cached, ...newFromScraper].slice(0, 20);
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

  if (existing) {
    // Only use the cached version if it actually has chord lines.
    // Entries cached by old buggy code may have only lyrics.
    const hasChords = Array.isArray(existing.chords_data) &&
      existing.chords_data.some(l => l.type === 'chords');
    if (hasChords) return existing;
    // Delete the bad entry so we re-scrape cleanly
    console.log(`Re-scraping ${url} — cached entry had no chord lines`);
    await getSupabase().from('cached_chords').delete().eq('id', existing.id);
  }

  // fetch_chords.py returns a ChordLine[] array directly (not a wrapped object)
  let chordsArray = null;
  if (source === 'ultimate_guitar') {
    chordsArray = fetchUGByUrl(url);
  } else {
    chordsArray = fetchTab4UByUrl(url);
  }

  if (!Array.isArray(chordsArray) || chordsArray.length === 0) return null;

  return saveToCache({
    title,
    artist,
    lang,
    source,
    chordsData: chordsArray,
    url,
  });
}

/**
 * Return full chord data for a single cached row.
 */
async function getChordsById(id) {
  return getCachedById(id);
}

module.exports = { searchChords, fetchChordsForSong, getChordsById };
