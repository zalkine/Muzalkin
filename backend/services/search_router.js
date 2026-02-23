/**
 * search_router.js
 *
 * Searches multiple chord sources for song titles matching a query.
 *
 * Hebrew songs  → Tab4U → Negina → Nagnu
 * English songs → Ultimate Guitar → Tab4U
 *
 * Returns a list of { title, artist, source } — no full chord data,
 * just enough for the user to pick a song. Full chords are fetched
 * on demand via chord_router.js.
 */

const axios  = require('axios');
const cheerio = require('cheerio');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'he,en-US;q=0.9,en;q=0.8',
};

// ---------------------------------------------------------------------------
// Tab4U search (Hebrew + English)
// URL: https://www.tab4u.com/resultsSimple?tab=songs&q=<query>
// ---------------------------------------------------------------------------

async function searchTab4U(query) {
  try {
    const q   = encodeURIComponent(query);
    const url = `https://www.tab4u.com/resultsSimple?tab=songs&q=${q}`;

    await sleep(1000);
    const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
    console.log(`[SearchTab4U] status=${res.status} bodyLen=${res.data.length}`);
    const $   = cheerio.load(res.data);

    const results = [];
    const seen    = new Set();

    // Tab4U results: each song link is <a href="/tabs/songs/...">
    // Title and artist are in surrounding table cells
    $('a[href*="/tabs/songs/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      // Try to read title from the link text or from a sibling td
      const $row  = $(el).closest('tr');
      let title   = $(el).text().trim();
      let artist  = '';

      if ($row.length) {
        const cells = $row.find('td');
        if (cells.length >= 2) {
          title  = $(cells[0]).text().trim() || title;
          artist = $(cells[1]).text().trim();
        }
      }

      // Fallback: split "Title - Artist" pattern
      if (!artist && title.includes(' - ')) {
        const parts = title.split(' - ');
        title  = parts[0].trim();
        artist = parts[1].trim();
      }

      if (!title) return;

      const key = `${title}|${artist}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      results.push({ title, artist, source: 'tab4u' });
    });

    console.log(`[SearchTab4U] found=${results.length} results`);
    return results.slice(0, 8);
  } catch (err) {
    console.error('[SearchTab4U] Error:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Negina search (Hebrew)
// URL: https://www.negina.co.il/?s=<query>
// WordPress-based site
// ---------------------------------------------------------------------------

async function searchNegina(query) {
  try {
    const q   = encodeURIComponent(query);
    const url = `https://www.negina.co.il/?s=${q}`;

    await sleep(1000);
    const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
    console.log(`[SearchNegina] status=${res.status} bodyLen=${res.data.length}`);
    const $   = cheerio.load(res.data);

    const results = [];
    const seen    = new Set();

    // WordPress archive: each result is an article/li with a title link
    $('article, .post, li.search-result').each((_, el) => {
      const $el = $(el);

      // Title from h1/h2/h3/h4 link inside the article
      const titleEl = $el.find('h1 a, h2 a, h3 a, h4 a, .entry-title a').first();
      let title     = titleEl.text().trim();

      // Artist from meta or author span
      let artist = $el.find('.artist, .entry-meta .author, .singer, span[class*="artist"]').first().text().trim();

      // Fallback: split "Title - Artist" from title
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
    return results.slice(0, 8);
  } catch (err) {
    console.error('[SearchNegina] Error:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Nagnu search (Hebrew)
// URL: https://nagnu.co.il/?s=<query>
// WordPress-based site
// ---------------------------------------------------------------------------

async function searchNagnu(query) {
  try {
    const q   = encodeURIComponent(query);
    const url = `https://nagnu.co.il/?s=${q}`;

    await sleep(1000);
    const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
    console.log(`[SearchNagnu] status=${res.status} bodyLen=${res.data.length}`);
    const $   = cheerio.load(res.data);

    const results = [];
    const seen    = new Set();

    // WordPress archive — same as Negina
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
    return results.slice(0, 8);
  } catch (err) {
    console.error('[SearchNagnu] Error:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Ultimate Guitar search (English)
// ---------------------------------------------------------------------------

async function searchUltimateGuitar(query) {
  try {
    const q   = encodeURIComponent(query);
    const url = `https://www.ultimate-guitar.com/search.php?title=${q}&type=Chords`;

    await sleep(1000);
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 10000,
    });

    const dataMatch = res.data.match(/class="js-store" data-content="([^"]+)"/);
    if (!dataMatch) return [];

    const rawJson = dataMatch[1].replace(/&quot;/g, '"');
    const store   = JSON.parse(rawJson);
    const items   = store?.store?.page?.data?.results ?? [];

    return items
      .filter((r) => r.type === 'Chords' && r.song_name)
      .slice(0, 8)
      .map((r) => ({
        title:  r.song_name,
        artist: r.artist_name ?? '',
        source: 'ultimate_guitar',
      }));
  } catch (err) {
    console.error('[SearchUG] Error:', err.message);
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
    // Hebrew: Tab4U first, then Negina, then Nagnu — all in parallel
    searches = [
      searchTab4U(query),
      searchNegina(query),
      searchNagnu(query),
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
