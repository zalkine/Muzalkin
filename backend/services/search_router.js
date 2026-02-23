/**
 * search_router.js
 *
 * Searches multiple chord sources for song titles matching a query.
 *
 * Hebrew songs  → Tab4U → Nagnu → Negina
 * English songs → Ultimate Guitar → Tab4U
 *
 * Tab4U and Ultimate Guitar are behind Cloudflare → delegated to the Python
 * cloudscraper script at  scraper/search.py.
 *
 * Returns a list of { title, artist, source } — no full chord data,
 * just enough for the user to pick a song. Full chords are fetched
 * on demand via chord_router.js.
 */

const { spawn }  = require('child_process');
const path       = require('path');
const axios      = require('axios');
const cheerio    = require('cheerio');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'he,en-US;q=0.9,en;q=0.8',
};

// Path to the Python scraper (relative to this file: backend/services/ → scraper/)
const SCRAPER_PY = path.resolve(__dirname, '../../scraper/search.py');

// ---------------------------------------------------------------------------
// Helper: call  python3 scraper/search.py <source> "<query>"
// Returns parsed JSON array or [] on failure.
// ---------------------------------------------------------------------------

function runPyScraper(source, query) {
  return new Promise((resolve) => {
    console.log(`[PyScraper:${source}] Starting for query: "${query}"`);
    const proc   = spawn('python3', [SCRAPER_PY, source, query]);
    let stdout   = '';
    let stderr   = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      // Forward Python's progress logs to Node console
      if (stderr) {
        stderr.trim().split('\n').forEach((line) => console.log(`  ${line}`));
      }
      if (code !== 0) {
        console.error(`[PyScraper:${source}] exited with code ${code}`);
        return resolve([]);
      }
      try {
        const results = JSON.parse(stdout.trim());
        console.log(`[PyScraper:${source}] returned ${results.length} results`);
        resolve(results);
      } catch (e) {
        console.error(`[PyScraper:${source}] JSON parse error:`, e.message);
        console.error('stdout snippet:', stdout.slice(0, 200));
        resolve([]);
      }
    });

    proc.on('error', (err) => {
      console.error(`[PyScraper:${source}] spawn error:`, err.message);
      resolve([]);
    });
  });
}

// ---------------------------------------------------------------------------
// Tab4U search — via Python cloudscraper (Cloudflare-protected)
// ---------------------------------------------------------------------------

async function searchTab4U(query) {
  return runPyScraper('tab4u', query);
}

// ---------------------------------------------------------------------------
// Ultimate Guitar search — via Python cloudscraper (Cloudflare-protected)
// ---------------------------------------------------------------------------

async function searchUltimateGuitar(query) {
  return runPyScraper('ug', query);
}

// ---------------------------------------------------------------------------
// Nagnu search (Hebrew) — WordPress, no Cloudflare
// URL: https://nagnu.co.il/?s=<query>
// ---------------------------------------------------------------------------

async function searchNagnu(query) {
  try {
    const q   = encodeURIComponent(query);
    const url = `https://nagnu.co.il/?s=${q}`;

    await sleep(500);
    const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
    console.log(`[SearchNagnu] status=${res.status} bodyLen=${res.data.length}`);
    const $   = cheerio.load(res.data);

    const results = [];
    const seen    = new Set();

    $('article.post, article').each((_, el) => {
      const $el     = $(el);
      const titleEl = $el.find('h2.entry-title a, h1 a, h2 a').first();
      let title     = titleEl.text().trim();
      let artist    = $el.find('.entry-meta .author, .artist, span[class*="artist"]').first().text().trim();

      if (!artist && title.includes(' - ')) {
        const parts = title.split(' - ');
        title  = parts[0].trim();
        artist = parts[1].trim();
      }

      if (!title) return;

      const key = `${title}|${artist}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      results.push({ title, artist, source: 'nagnu' });
    });

    console.log(`[SearchNagnu] found=${results.length} results`);
    return results;
  } catch (err) {
    console.error('[SearchNagnu] Error:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Negina search (Hebrew) — WordPress, no Cloudflare
// URL: https://www.negina.co.il/?s=<query>
// ---------------------------------------------------------------------------

async function searchNegina(query) {
  try {
    const q   = encodeURIComponent(query);
    const url = `https://www.negina.co.il/?s=${q}`;

    await sleep(500);
    const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
    console.log(`[SearchNegina] status=${res.status} bodyLen=${res.data.length}`);
    const $   = cheerio.load(res.data);

    const results = [];
    const seen    = new Set();

    $('article, .post, li.search-result').each((_, el) => {
      const $el     = $(el);
      const titleEl = $el.find('h1 a, h2 a, h3 a, h4 a, .entry-title a').first();
      let title     = titleEl.text().trim();
      let artist    = $el.find('.artist, .entry-meta .author, .singer, span[class*="artist"]').first().text().trim();

      if (!artist && title.includes(' - ')) {
        const parts = title.split(' - ');
        title  = parts[0].trim();
        artist = parts[1].trim();
      }

      if (!title) return;

      const key = `${title}|${artist}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      results.push({ title, artist, source: 'negina' });
    });

    console.log(`[SearchNegina] found=${results.length} results`);
    return results;
  } catch (err) {
    console.error('[SearchNegina] Error:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main: run all searches in parallel, merge results
// ---------------------------------------------------------------------------

/**
 * @param {string} query
 * @param {'he'|'en'} lang
 * @returns {Promise<Array<{ title: string, artist: string, source: string }>>}
 */
async function searchSources(query, lang = 'he') {
  let searches;

  if (lang === 'en') {
    searches = [
      searchUltimateGuitar(query),
      searchTab4U(query),
    ];
  } else {
    // Hebrew: Tab4U first (most results), then Nagnu + Negina in parallel
    searches = [
      searchTab4U(query),
      searchNagnu(query),
      searchNegina(query),
    ];
  }

  const rawResults = await Promise.allSettled(searches);

  const merged = [];
  const seen   = new Set();

  for (const settled of rawResults) {
    if (settled.status !== 'fulfilled') continue;
    for (const item of settled.value) {
      const key = `${item.title}|${item.artist}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  return merged;
}

module.exports = { searchSources };
