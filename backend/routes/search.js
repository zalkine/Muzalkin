/**
 * routes/search.js
 *
 * REST API for searching songs across multiple chord sources.
 *
 * Endpoint:
 *   GET /search?q=<query>&lang=<he|en>
 *
 * Returns a list of matching songs (no full chord data):
 *   [{ title, artist, source }]
 *
 * The caller (mobile app) is responsible for fetching full chords
 * via GET /chords?title=&artist=&lang= once the user picks a result.
 */

const express = require('express');
const { searchSources } = require('../services/search_router');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /search
// ---------------------------------------------------------------------------

router.get('/', async (req, res) => {
  const { q, lang } = req.query;

  if (!q || !String(q).trim()) {
    return res.status(400).json({ error: 'q query param is required' });
  }

  const language = lang === 'en' ? 'en' : 'he';

  try {
    const results = await searchSources(String(q).trim(), language);
    res.json(results);
  } catch (err) {
    console.error('[search] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
