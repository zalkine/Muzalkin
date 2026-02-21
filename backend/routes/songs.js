'use strict';

/**
 * /api/songs — save and retrieve user songs.
 * The caller must pass the user's Supabase JWT in Authorization: Bearer <token>.
 */

const { Router }       = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = Router();

const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

async function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  req.user = user;
  next();
}

// ---------------------------------------------------------------------------
// POST /api/songs  — save a song from cached_chords to the user's library
// Body: { cached_chord_id: string, instrument?: 'guitar'|'piano' }
// ---------------------------------------------------------------------------

router.post('/', requireAuth, async (req, res) => {
  const { cached_chord_id, instrument = 'guitar' } = req.body;

  if (!cached_chord_id) {
    return res.status(400).json({ error: 'Missing cached_chord_id' });
  }

  const { data: cached, error: cacheErr } = await supabaseAdmin
    .from('cached_chords')
    .select('*')
    .eq('id', cached_chord_id)
    .single();

  if (cacheErr || !cached) {
    return res.status(404).json({ error: 'Cached chord not found' });
  }

  const { data: song, error: insertErr } = await supabaseAdmin
    .from('songs')
    .insert({
      user_id:     req.user.id,
      title:       cached.song_title,
      artist:      cached.artist,
      language:    cached.language,
      chords_data: cached.chords_data,
      source_url:  cached.raw_url,
      instrument,
      transpose:   0,
    })
    .select()
    .single();

  if (insertErr) {
    console.error('Song insert error:', insertErr.message);
    return res.status(500).json({ error: 'Failed to save song' });
  }

  res.status(201).json(song);
});

// ---------------------------------------------------------------------------
// GET /api/songs
// ---------------------------------------------------------------------------

router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('songs')
    .select('id, title, artist, language, instrument, transpose, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Failed to fetch songs' });

  res.json(data || []);
});

// ---------------------------------------------------------------------------
// DELETE /api/songs/:id
// ---------------------------------------------------------------------------

router.delete('/:id', requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('songs')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: 'Failed to delete song' });

  res.status(204).send();
});

module.exports = router;
