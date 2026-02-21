'use strict';

const { Router } = require('express');
const { searchChords, getChordsById } = require('../services/chord_router');

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
