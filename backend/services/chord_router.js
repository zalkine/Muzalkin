/**
 * chord_router.js
 *
 * Fetches and parses chord data for a given song.
 *
 * Priority:
 *   Hebrew → Tab4U (Python cloudscraper, Cloudflare bypass)
 *   English → Ultimate Guitar → Tab4U
 *
 * When a direct source URL is provided (from search results), it is used
 * immediately instead of re-searching. This is the primary code path.
 *
 * Cache:
 *   All successful fetches are stored in Supabase `cached_chords` (7-day TTL).
 *   Cache is checked before any network request.
 *
 * ChordLine: { type: 'chords' | 'lyrics' | 'section', content: string }
 */

const { spawn } = require('child_process');
const path      = require('path');

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const FETCH_CHORDS_PY = path.resolve(__dirname, '../../scraper/fetch_chords.py');
const SEARCH_PY       = path.resolve(__dirname, '../../scraper/search.py');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Helpers: run Python scripts
// ---------------------------------------------------------------------------

function runPython(args) {
  return new Promise((resolve) => {
    const proc   = spawn('python3', args);
    let stdout   = '';
    let stderr   = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (stderr.trim()) {
        stderr.trim().split('\n').forEach((l) => console.log('  [py]', l));
      }
      if (code !== 0) {
        console.error('[runPython] exited with code', code);
        return resolve(null);
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (e) {
        console.error('[runPython] JSON parse error:', e.message, '— stdout:', stdout.slice(0, 100));
        resolve(null);
      }
    });

    proc.on('error', (e) => {
      console.error('[runPython] spawn error:', e.message);
      resolve(null);
    });
  });
}

// ---------------------------------------------------------------------------
// Fetch: Tab4U chord page directly by URL
// ---------------------------------------------------------------------------

async function fetchTab4uByUrl(url) {
  console.log('[chord_router] fetching Tab4U by URL:', url);
  const lines = await runPython([FETCH_CHORDS_PY, 'tab4u', url]);
  if (!lines || lines.length === 0) return null;
  return { chords_data: lines, raw_url: url };
}

// ---------------------------------------------------------------------------
// Fetch: Tab4U by searching title+artist (fallback when no URL known)
// ---------------------------------------------------------------------------

async function fetchTab4uBySearch(title, artist) {
  console.log('[chord_router] searching Tab4U for:', title, artist);

  const query = artist ? `${title} ${artist}` : title;
  const results = await runPython([SEARCH_PY, 'tab4u', query]);
  if (!results || results.length === 0) return null;

  // Pick the best match
  const url = results[0].url;
  if (!url) return null;

  await sleep(500);
  return fetchTab4uByUrl(url);
}

// ---------------------------------------------------------------------------
// Fetch: Ultimate Guitar by search (English)
// ---------------------------------------------------------------------------

async function fetchUltimateGuitar(title, artist) {
  console.log('[chord_router] searching Ultimate Guitar for:', title, artist);

  const query   = artist ? `${title} ${artist}` : title;
  const results = await runPython([SEARCH_PY, 'ug', query]);
  if (!results || results.length === 0) return null;

  // UG search returns full tab content directly via the Python scraper
  // (the search.py only returns search metadata, so we need the chord_router
  //  to do its own UG scrape)
  const axios   = require('axios');
  const tabUrl  = results[0].url;
  if (!tabUrl) return null;

  try {
    await sleep(1000);
    const res = await axios.get(tabUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.ultimate-guitar.com/',
      },
      timeout: 10000,
    });

    const match = res.data.match(/class="js-store" data-content="([^"]+)"/);
    if (!match) return null;

    const store  = JSON.parse(match[1].replace(/&quot;/g, '"'));
    const rawTab = store?.store?.page?.data?.tab_view?.wiki_tab?.content ?? '';
    if (!rawTab) return null;

    return { chords_data: parseUGContent(rawTab), raw_url: tabUrl };
  } catch (err) {
    console.error('[UG] chord fetch error:', err.message);
    return null;
  }
}

function parseUGContent(raw) {
  const result = [];
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    if (/^\[(Verse|Chorus|Bridge|Intro|Outro|Pre-Chorus|Interlude)/.test(s)) {
      result.push({ type: 'section', content: s.replace(/\[|\]/g, '') });
    } else if (s.includes('[ch]')) {
      const chords = s.replace(/\[ch\](.*?)\[\/ch\]/g, '$1').replace(/\[\/tab\]|\[tab\]/g, '').trim();
      if (chords) result.push({ type: 'chords', content: chords });
    } else {
      const lyric = s.replace(/\[tab\]|\[\/tab\]/g, '').trim();
      if (lyric) result.push({ type: 'lyrics', content: lyric });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Supabase cache helpers
// ---------------------------------------------------------------------------

async function getCached(title, artist, lang) {
  const { data } = await supabase
    .from('cached_chords')
    .select('chords_data, raw_url, source')
    .ilike('song_title', title)
    .ilike('artist', artist)
    .eq('language', lang)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function persistCache(title, artist, lang, source, chordsData, rawUrl) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('cached_chords').upsert({
    song_title:  title,
    artist,
    language:    lang,
    source,
    chords_data: chordsData,
    raw_url:     rawUrl,
    fetched_at:  new Date().toISOString(),
    expires_at:  expiresAt,
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Fetch chords for a song.
 *
 * @param {string} title
 * @param {string} artist
 * @param {'he'|'en'} lang
 * @param {string|null} sourceUrl   - Direct URL from search result (preferred)
 * @param {string|null} source      - Source name: 'tab4u'|'negina'|'nagnu'|'ultimate_guitar'
 */
async function routeChords(title, artist, lang = 'he', sourceUrl = null, source = null) {
  // 1. Cache check
  const cached = await getCached(title, artist, lang);
  if (cached) {
    console.log('[chord_router] cache hit for:', title);
    return { ...cached, from_cache: true };
  }

  let result = null;

  // 2. If a direct URL was provided, use it first
  if (sourceUrl) {
    // For Tab4U URLs: fetch directly with Python cloudscraper
    if (sourceUrl.includes('tab4u.com')) {
      result = await fetchTab4uByUrl(sourceUrl);
    }
    // For Negina/Nagnu/unknown: we can't scrape their chord pages,
    // so fall through to Tab4U search below
    if (!result) {
      console.log('[chord_router] direct URL fetch failed, falling back to Tab4U search');
    }
  }

  // 3. Fallback: search Tab4U (or UG for English) by title+artist
  if (!result) {
    if (lang === 'en') {
      result = await fetchUltimateGuitar(title, artist)
            ?? await fetchTab4uBySearch(title, artist);
    } else {
      result = await fetchTab4uBySearch(title, artist);
    }
  }

  if (!result) {
    console.log('[chord_router] no chords found for:', title);
    return null;
  }

  // 4. Persist to cache
  const sourceName = source ?? (sourceUrl?.includes('tab4u') ? 'tab4u' : 'tab4u');
  await persistCache(title, artist, lang, sourceName, result.chords_data, result.raw_url);

  return { ...result, source: sourceName, from_cache: false };
}

module.exports = { routeChords };
