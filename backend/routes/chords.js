'use strict';

const { Router } = require('express');
const { searchChords, fetchChordsForSong, getChordsById } = require('../services/chord_router');

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/chords/search?q=<query>&lang=he
// ---------------------------------------------------------------------------

router.get('/search', async (req, res) => {
  const { q, lang = 'he' } = req.query;

  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Missing query parameter: q' });
  }
  if (!['he', 'en'].includes(lang)) {
    return res.status(400).json({ error: "lang must be 'he' or 'en'" });
  }

  try {
    const results = await searchChords(q.trim(), lang);
    res.json(results);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Failed to search chords' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/chords/fetch  — scrape & cache chords for a specific song URL
// Body: { url, title, artist, source, lang }
// Returns: the full cached_chords row (with id)
// ---------------------------------------------------------------------------

router.post('/fetch', async (req, res) => {
  const { url, title = '', artist = '', source, lang = 'he' } = req.body;

  if (!url || !source) {
    return res.status(400).json({ error: 'Missing url or source' });
  }
  if (!['he', 'en'].includes(lang)) {
    return res.status(400).json({ error: "lang must be 'he' or 'en'" });
  }

  try {
    const row = await fetchChordsForSong({ url, title, artist, source, lang });
    if (!row) return res.status(502).json({ error: 'Failed to fetch chords from source' });
    res.json(row);
  } catch (err) {
    console.error('Chord fetch error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/chords/:id  — full chord data for one cached_chords row
// ---------------------------------------------------------------------------

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const row = await getChordsById(id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    console.error('Chord fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch chords' });
  }
});

module.exports = router;
