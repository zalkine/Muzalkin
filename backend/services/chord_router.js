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

console.log('[chord_router] v2 loaded, SUPABASE_SERVICE_KEY set:', !!process.env.SUPABASE_SERVICE_KEY);

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
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return [];
  const q = query.trim();
  let data, error;
  try {
    ({ data, error } = await getSupabaseAnon()
      .from('cached_chords')
      // Include chords_data so we can filter out bad (chord-less) entries
      .select('id, song_title, artist, language, source, fetched_at, chords_data')
      .eq('language', lang)
      .or(`song_title.ilike.%${q}%,artist.ilike.%${q}%`)
      .order('fetched_at', { ascending: false })
      .limit(40));
  } catch (e) {
    console.warn('Cache search skipped (Supabase unavailable):', e.message);
    return [];
  }

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
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return null;
  try {
    const { data, error } = await getSupabaseAnon()
      .from('cached_chords')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  } catch (e) {
    console.warn('getCachedById skipped:', e.message);
    return null;
  }
}

async function saveToCache({ title, artist, lang, source, chordsData, url }) {
  const { data, error } = await getSupabase()
    .from('cached_chords')
    .insert({
      song_title:  title,
      artist:      artist || '',
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

// In Docker:  COPY backend/ → /app/, COPY scraper/ → /app/scraper/
//   __dirname = /app/services  →  ../scraper = /app/scraper  ✓
// In local dev: backend/services/ → ../../scraper = repo-root/scraper/ ✓
const SCRAPER_DIR = process.env.SCRAPER_DIR
  || (require('fs').existsSync(path.join(__dirname, '..', 'scraper'))
      ? path.join(__dirname, '..', 'scraper')        // Docker / Cloud Run
      : path.join(__dirname, '..', '..', 'scraper')); // local dev

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
    console.error(`${scriptName} exited ${result.status}, stderr:`, result.stderr);
    return null;
  }
  if (!result.stdout || !result.stdout.trim()) {
    console.error(`${scriptName} returned empty output, stderr:`, result.stderr);
    return null;
  }

  // Always forward Python stderr so debug prints are visible in Cloud Run logs
  if (result.stderr && result.stderr.trim()) {
    console.log(`[${scriptName} stderr]`, result.stderr.trim());
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    console.error(`${scriptName} returned invalid JSON:`, result.stdout.slice(0, 200));
    return null;
  }
}

// Returns array of { title, artist, source, url }
function searchTab4U(query, lang = 'he') {
  return runPythonScraper('search.py', ['tab4u', query, lang]) ?? [];
}

function searchUltimateGuitar(query) {
  return runPythonScraper('search.py', ['ug', query]) ?? [];
}

function searchCifraclub(query) {
  return runPythonScraper('search.py', ['cifraclub', query]) ?? [];
}

/**
 * Fetch and parse chords for a specific URL.
 * fetch_chords.py now returns a full object:
 *   { title, artist, language, source, chords_data: ChordLine[] }
 * Returns that object, or null on failure.
 */
function fetchByUrl(source, url) {
  const src = ['ultimate_guitar', 'tab4u', 'cifraclub'].includes(source) ? source : 'tab4u';
  const raw = runPythonScraper('fetch_chords.py', [src, url]);
  if (!raw) return null;
  // Expected: { title, artist, language, source, chords_data }
  if (raw && typeof raw === 'object' && Array.isArray(raw.chords_data)) return raw;
  // Backward-compat: plain array (old scraper format)
  if (Array.isArray(raw)) return { title: '', artist: '', language: null, source: src, chords_data: raw };
  return null;
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
        return searchTab4U(query, 'he').map(r => toResult(r, 'tab4u'));
      }
      // English: Tab4U English subdomain (en.tab4u.com) is the preferred source —
      // it uses the correct domain so fetched URLs work and the parser returns chords.
      // Cifraclub supplements with additional results; UG is tried but may 403.
      const tab4uResults = searchTab4U(query, 'en').map(r => toResult(r, 'tab4u'));
      const cifraResults = searchCifraclub(query).map(r => toResult(r, 'cifraclub'));
      const ugResults    = searchUltimateGuitar(query).map(r => toResult(r, 'ultimate_guitar'));

      // Merge: Tab4U first (preferred), then Cifraclub, then UG
      const seenEn = new Set();
      const mergedEn = [];
      for (const r of [...tab4uResults, ...cifraResults, ...ugResults]) {
        const k = `${r.song_title.toLowerCase()}|${(r.artist || '').toLowerCase()}`;
        if (!seenEn.has(k)) {
          seenEn.add(k);
          mergedEn.push(r);
        }
      }
      return mergedEn;
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

// ---------------------------------------------------------------------------
// English fetch helper — try Cifraclub first (richer chord data), then Tab4U
// ---------------------------------------------------------------------------

/**
 * Convert a string to a URL-safe slug:  "Don't Stop Me Now" → "dont-stop-me-now"
 */
function slugify(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Try to fetch chords from Cifraclub using a URL derived from title+artist.
 * Returns the scraper result object, or null if the song isn't on Cifraclub.
 */
function tryFetchCifraclub(title, artist) {
  if (!title) return null;
  const artistSlug = slugify(artist);
  const titleSlug  = slugify(title);
  if (!artistSlug || !titleSlug) return null;
  const guessUrl = `https://www.cifraclub.com/${artistSlug}/${titleSlug}/`;
  const result = fetchByUrl('cifraclub', guessUrl);
  if (!result || !Array.isArray(result.chords_data)) return null;
  const chordLines = result.chords_data.filter(l => l.type === 'chords');
  if (chordLines.length < 2) return null;  // Too sparse — not a real chord page
  // Attach the URL we used
  result.raw_url = guessUrl;
  return result;
}

/**
 * Fetch full chords for a specific song URL. Checks cache by URL first.
 * On cache miss: scrapes, saves to cache, returns the cached_chords row.
 */
async function fetchChordsForSong({ url, title, artist, source, lang }) {
  // Check if already cached by URL (ignore Supabase errors — cache is best-effort)
  try {
    const { data: existing } = await getSupabase()
      .from('cached_chords')
      .select('*')
      .eq('raw_url', url)
      .limit(1)
      .single();

    if (existing) {
      const hasChords = Array.isArray(existing.chords_data) &&
        existing.chords_data.some(l => l.type === 'chords');
      if (hasChords) return existing;
      console.log(`Re-scraping ${url} — cached entry had no chord lines`);
      await getSupabase().from('cached_chords').delete().eq('id', existing.id);
    }
  } catch (cacheErr) {
    console.warn('Cache lookup skipped (Supabase unreachable):', cacheErr.message);
  }

  // For English Tab4U results, fetch Tab4U directly (en.tab4u.com URLs from search
  // are correct). Fall back to Cifraclub URL guessing only if Tab4U returns no chords.
  let scraped = null;
  let effectiveUrl    = url;
  let effectiveSource = source;

  if (lang === 'en' && source === 'tab4u' && title) {
    console.log(`[fetch] English Tab4U song — fetching '${title}' by '${artist}'`);
    scraped = fetchByUrl('tab4u', url);
    const chordLines = scraped?.chords_data?.filter(l => l.type === 'chords').length ?? 0;
    if (chordLines < 2) {
      console.log(`[fetch] Tab4U returned ${chordLines} chord lines — trying Cifraclub fallback`);
      scraped = null;
      const cifraResult = tryFetchCifraclub(title, artist);
      if (cifraResult) {
        console.log(`[fetch] Cifraclub fallback succeeded: ${cifraResult.chords_data.length} lines`);
        scraped         = cifraResult;
        effectiveUrl    = cifraResult.raw_url;
        effectiveSource = 'cifraclub';
      }
    } else {
      console.log(`[fetch] Tab4U succeeded: ${chordLines} chord lines`);
    }
  }

  if (!scraped) {
    // fetch_chords.py returns { title, artist, language, source, chords_data }
    console.log(`[fetch] scraping source=${effectiveSource} url=${effectiveUrl}`);
    scraped = fetchByUrl(effectiveSource, effectiveUrl);

    console.log(`[fetch] scraper returned:`, scraped
      ? `${scraped.chords_data?.length} lines, title='${scraped.title}', artist='${scraped.artist}'`
      : 'null');
  }

  if (!scraped || !Array.isArray(scraped.chords_data) || scraped.chords_data.length === 0) return null;

  // Prefer page-scraped metadata over URL-parsed values passed in
  const finalTitle  = scraped.title    || title;
  const finalArtist = scraped.artist   || artist;
  const finalLang   = scraped.language || lang;

  // Try to cache — if Supabase is unreachable, still return the scraped data
  try {
    const cached = await saveToCache({
      title:      finalTitle,
      artist:     finalArtist,
      lang:       finalLang,
      source:     effectiveSource,
      chordsData: scraped.chords_data,
      url:        effectiveUrl,
    });
    if (cached) return cached;
  } catch (saveErr) {
    console.warn('Cache save skipped (Supabase unreachable):', saveErr.message);
  }

  // Return scraped data directly without a cache ID
  return {
    song_title:  finalTitle,
    artist:      finalArtist,
    language:    finalLang,
    source:      effectiveSource,
    chords_data: scraped.chords_data,
    raw_url:     effectiveUrl,
  };
}

/**
 * Return full chord data for a single cached row.
 */
async function getChordsById(id) {
  return getCachedById(id);
}

module.exports = { searchChords, fetchChordsForSong, getChordsById };
