/**
 * debug_tab4u.js
 * Run with:  node backend/debug_tab4u.js "your search query"
 *
 * Fetches the Tab4U search page and dumps:
 *   - HTTP status + body length
 *   - First 1500 chars of raw HTML
 *   - All <a> tags that mention "tabs" or "song"
 *   - Any matched results using the current selector
 */

const axios   = require('axios');
const cheerio = require('cheerio');

const query = process.argv[2] || 'שלום';

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'he,en-US;q=0.9,en;q=0.8',
  'Referer':         'https://www.tab4u.com/',
};

async function main() {
  const q   = encodeURIComponent(query);
  const url = `https://www.tab4u.com/resultsSimple?tab=songs&q=${q}`;

  console.log(`\nFetching: ${url}\n`);

  const res = await axios.get(url, { headers: HEADERS, timeout: 10000 });

  console.log(`Status:      ${res.status}`);
  console.log(`Body length: ${res.data.length} chars`);
  console.log(`\n--- First 1500 chars of HTML ---`);
  console.log(res.data.slice(0, 1500));
  console.log(`--- End of snippet ---\n`);

  const $ = cheerio.load(res.data);

  // Show ALL <a> hrefs so we can see the real URL pattern
  const allLinks = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('song') || href.includes('tab') || href.includes('tabs')) {
      allLinks.push(href);
    }
  });
  console.log(`All song/tab-related <a> hrefs (first 20):`);
  allLinks.slice(0, 20).forEach((h) => console.log(' ', h));

  // Test the current selector
  const current = $('a[href*="tabs/songs/"]');
  console.log(`\nSelector  a[href*="tabs/songs/"]  →  ${current.length} matches`);

  // Try alternative selectors
  [
    'a[href*="/tabs/"]',
    'a[href*="song"]',
    '.results a',
    'table a',
    'td a',
    '.song-name',
    '.song_name',
    'li.song a',
    'a.song',
  ].forEach((sel) => {
    const count = $(sel).length;
    if (count > 0) console.log(`  ${sel}  →  ${count} matches`);
  });
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
