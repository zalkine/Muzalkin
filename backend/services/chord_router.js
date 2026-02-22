/**
 * chord_router.js
 *
 * Smart source picker for chord data.
 *
 * Hebrew songs  → Tab4U → Nagnu → Negina (metadata fallback)
 * English songs → Ultimate Guitar → Chordify → Tab4U
 *
 * Flow for every request:
 *  1. Check `cached_chords` in Supabase — return immediately if fresh.
 *  2. Try each source in priority order until one succeeds.
 *  3. Normalise the raw HTML into the canonical chords_data format.
 *  4. Persist to `cached_chords` with a 7-day TTL.
 *  5. Return the normalised data.
 *
 * ChordLine: { type: 'chords' | 'lyrics' | 'section', content: string }
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY, // server-side: use service key, not anon key
);

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

/** Returns cached chords if they exist and have not expired, otherwise null. */
async function getCached(title, artist, language, source) {
  const { data } = await supabase
    .from('cached_chords')
    .select('chords_data, raw_url')
    .ilike('song_title', title)
    .ilike('artist', artist)
    .eq('language', language)
    .eq('source', source)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  return data ?? null;
}

/** Persist fetched chords to cached_chords (7-day TTL). */
async function persistCache(title, artist, language, source, chordsData, rawUrl) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('cached_chords').upsert({
    song_title: title,
    artist,
    language,
    source,
    chords_data: chordsData,
    raw_url: rawUrl,
    fetched_at: new Date().toISOString(),
    expires_at: expiresAt,
  });
}

// ---------------------------------------------------------------------------
// Delay helper (be polite to external sites)
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Scraper: Tab4U (Hebrew + English)
// ---------------------------------------------------------------------------

async function scrapeTab4U(title, artist) {
  try {
    const axios = require('axios');
    const cheerio = require('cheerio');

    const query = encodeURIComponent(`${title} ${artist}`);
    const searchUrl = `https://www.tab4u.com/resultsSimple?tab=songs&q=${query}`;

    console.log(`[Tab4U] Searching: ${searchUrl}`);
    await sleep(1000);
    const searchRes = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 MuZalkin/1.0' },
      timeout: 8000,
    });

    const $search = cheerio.load(searchRes.data);
    const firstLink = $search('a[href*="tabs/songs/"]').first().attr('href');
    console.log(`[Tab4U] First link found: ${firstLink}`);
    if (!firstLink) return null;

    const songUrl = firstLink.startsWith('http')
      ? firstLink
      : `https://www.tab4u.com/${firstLink.replace(/^\//, '')}`;

    await sleep(1000);
    const songRes = await axios.get(songUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 MuZalkin/1.0' },
      timeout: 8000,
    });

    const $ = cheerio.load(songRes.data);
    const chordsData = [];

    console.log(`[Tab4U] Song page fetched, #song_chords found: ${$('#song_chords').length}, spans: ${$('#song_chords span').length}`);

    $('#song_chords span').each((_, el) => {
      const cls = $(el).attr('class') ?? '';
      const text = $(el).text().trim();
      if (!text) return;

      if (cls.includes('chords')) {
        chordsData.push({ type: 'chords', content: text });
      } else if (cls.includes('title') || cls.includes('section')) {
        chordsData.push({ type: 'section', content: text });
      } else {
        chordsData.push({ type: 'lyrics', content: text });
      }
    });

    console.log(`[Tab4U] Parsed ${chordsData.length} lines`);
    if (chordsData.length === 0) return null;
    return { chords_data: chordsData, raw_url: songUrl };
  } catch (err) {
    console.error(`[Tab4U] Error: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scraper: Nagnu (Hebrew)
// ---------------------------------------------------------------------------

async function scrapeNagnu(title, artist) {
  try {
    const axios = require('axios');
    const cheerio = require('cheerio');

    const query = encodeURIComponent(`${title} ${artist}`);
    const searchUrl = `https://nagnu.co.il/?s=${query}`;

    await sleep(1000);
    const searchRes = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 MuZalkin/1.0' },
      timeout: 8000,
    });

    const $search = cheerio.load(searchRes.data);
    const firstLink = $search('article.post h2.entry-title a').first().attr('href');
    if (!firstLink) return null;

    await sleep(1000);
    const songRes = await axios.get(firstLink, {
      headers: { 'User-Agent': 'Mozilla/5.0 MuZalkin/1.0' },
      timeout: 8000,
    });

    const $ = cheerio.load(songRes.data);
    const chordsData = [];

    $('.entry-content pre, .entry-content p').each((_, el) => {
      const tag = $(el).prop('tagName').toLowerCase();
      const cls = $(el).attr('class') ?? '';
      const text = $(el).text().trim();
      if (!text) return;

      if (tag === 'pre' || cls.includes('chord')) {
        chordsData.push({ type: 'chords', content: text });
      } else {
        chordsData.push({ type: 'lyrics', content: text });
      }
    });

    if (chordsData.length === 0) return null;
    return { chords_data: chordsData, raw_url: firstLink };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scraper: Ultimate Guitar (English)
// UG is JS-rendered; we pull data from their embedded window.UGAPP store JSON.
// ---------------------------------------------------------------------------

async function scrapeUltimateGuitar(title, artist) {
  try {
    const axios = require('axios');

    const query = encodeURIComponent(`${title} ${artist}`);
    const searchUrl = `https://www.ultimate-guitar.com/search.php?title=${query}&type=Chords`;
    console.log(`[UG] Searching: ${searchUrl}`);

    await sleep(1000);
    const searchRes = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      },
      timeout: 10000,
    });

    const dataMatch = searchRes.data.match(/class="js-store" data-content="([^"]+)"/);
    console.log(`[UG] js-store found: ${!!dataMatch}`);
    if (!dataMatch) return null;

    const rawJson = dataMatch[1].replace(/&quot;/g, '"');
    const store = JSON.parse(rawJson);
    const results = store?.store?.page?.data?.results ?? [];

    const chordsResult = results.find((r) => r.type === 'Chords' && r.tab_url);
    if (!chordsResult) return null;

    await sleep(1000);
    const tabRes = await axios.get(chordsResult.tab_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Referer': 'https://www.ultimate-guitar.com/',
        'Cache-Control': 'max-age=0',
      },
      timeout: 10000,
    });

    const tabDataMatch = tabRes.data.match(/class="js-store" data-content="([^"]+)"/);
    if (!tabDataMatch) return null;

    const tabJson = tabDataMatch[1].replace(/&quot;/g, '"');
    const tabStore = JSON.parse(tabJson);
    const rawTab = tabStore?.store?.page?.data?.tab_view?.wiki_tab?.content ?? '';

    if (!rawTab) return null;

    const chordsData = parseUGContent(rawTab);
    console.log(`[UG] Parsed ${chordsData.length} lines`);
    if (chordsData.length === 0) return null;

    return { chords_data: chordsData, raw_url: chordsResult.tab_url };
  } catch (err) {
    console.error(`[UG] Error: ${err.message}`);
    return null;
  }
}

/**
 * Parse UG's [ch]...[/ch] and section marker notation into ChordLine[].
 * [ch]Am[/ch] → chord token; bare text lines → lyrics.
 */
function parseUGContent(raw) {
  const lines = raw.split('\n');
  const result = [];

  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped) continue;

    if (/^\[(Verse|Chorus|Bridge|Intro|Outro|Pre-Chorus|Interlude)/.test(stripped)) {
      result.push({ type: 'section', content: stripped.replace(/\[|\]/g, '') });
    } else if (stripped.includes('[ch]')) {
      const chordsOnly = stripped
        .replace(/\[ch\](.*?)\[\/ch\]/g, '$1')
        .replace(/\[\/tab\]|\[tab\]/g, '')
        .trim();
      if (chordsOnly) result.push({ type: 'chords', content: chordsOnly });
    } else {
      const lyric = stripped.replace(/\[tab\]|\[\/tab\]/g, '').trim();
      if (lyric) result.push({ type: 'lyrics', content: lyric });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

/**
 * Fetch chords for a song, using cache and the appropriate source cascade.
 *
 * @param {string} title
 * @param {string} artist
 * @param {'he'|'en'} lang
 * @returns {Promise<{ chords_data: object[], raw_url: string, source: string, from_cache: boolean } | null>}
 */
async function routeChords(title, artist, lang = 'he') {
  const sources =
    lang === 'he'
      ? [
          { name: 'tab4u', scrape: scrapeTab4U },
          { name: 'nagnu', scrape: scrapeNagnu },
        ]
      : [
          { name: 'ultimate_guitar', scrape: scrapeUltimateGuitar },
          { name: 'tab4u',           scrape: scrapeTab4U },
        ];

  for (const { name, scrape } of sources) {
    const cached = await getCached(title, artist, lang, name);
    if (cached) {
      return { ...cached, source: name, from_cache: true };
    }

    const result = await scrape(title, artist);
    if (result) {
      await persistCache(title, artist, lang, name, result.chords_data, result.raw_url);
      return { ...result, source: name, from_cache: false };
    }
  }

  return null;
}

module.exports = { routeChords };
