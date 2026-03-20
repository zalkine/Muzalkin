/**
 * routes/chords.js
 *
 * REST API for fetching chord data.
 *
 * Endpoint:
 *   GET /chords?title=<title>&artist=<artist>&lang=<he|en>
 *
 * Flow:
 *  1. Validate query params.
 *  2. Delegate to chord_router (cache-first, then scrape).
 *  3. Return { chords_data, source, raw_url, from_cache }.
 */

const express = require('express');
const { routeChords } = require('../services/chord_router');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /chords
// ---------------------------------------------------------------------------

router.get('/', async (req, res) => {
  const { title, artist, lang, url, source } = req.query;

  if (!title) {
    return res.status(400).json({ error: 'title query param is required' });
  }

  const language = lang === 'en' ? 'en' : 'he';

  try {
    const result = await routeChords(
      String(title).trim(),
      artist ? String(artist).trim() : '',
      language,
      url    ? String(url).trim()    : null,
      source ? String(source).trim() : null,
    );

    if (!result) {
      return res.status(404).json({ error: 'No chord data found for this song' });
    }

    res.json(result);
  } catch (err) {
    console.error('[chords] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
