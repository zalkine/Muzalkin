'use strict';

/**
 * /api/songs — save and retrieve user songs.
 * The caller must pass the user's Supabase JWT in Authorization: Bearer <token>.
 */

const { Router }       = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = Router();

const getSupabaseAnon  = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const getSupabaseAdmin = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

async function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error } = await getSupabaseAnon().auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  req.user = user;
  next();
}

async function optionalAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) { req.user = null; return next(); }
  const { data: { user } } = await getSupabaseAnon().auth.getUser(token);
  req.user = user ?? null;
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

  const { data: cached, error: cacheErr } = await getSupabaseAdmin()
    .from('cached_chords')
    .select('*')
    .eq('id', cached_chord_id)
    .single();

  if (cacheErr || !cached) {
    return res.status(404).json({ error: 'Cached chord not found' });
  }

  const { data: song, error: insertErr } = await getSupabaseAdmin()
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
  const { data, error } = await getSupabaseAdmin()
    .from('songs')
    .select('id, title, artist, language, instrument, transpose, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Failed to fetch songs' });

  res.json(data || []);
});

// ---------------------------------------------------------------------------
// GET /api/songs/:id  — fetch a single song
//   Allowed if: caller is the owner, OR song appears in at least one public playlist.
// ---------------------------------------------------------------------------

router.get('/:id', optionalAuth, async (req, res) => {
  const { data: song, error: songErr } = await getSupabaseAdmin()
    .from('songs')
    .select('id, title, artist, language, chords_data, source_url, user_id')
    .eq('id', req.params.id)
    .single();

  if (songErr || !song) return res.status(404).json({ error: 'Song not found' });

  const isOwner = req.user && song.user_id === req.user.id;

  if (!isOwner) {
    // Check if the song lives in at least one public playlist
    const { data: ps } = await getSupabaseAdmin()
      .from('playlist_songs')
      .select('playlist_id')
      .eq('song_id', req.params.id);

    if (!ps || ps.length === 0) return res.status(403).json({ error: 'Forbidden' });

    const playlistIds = ps.map(r => r.playlist_id);
    const { data: publicPl } = await getSupabaseAdmin()
      .from('playlists')
      .select('id')
      .in('id', playlistIds)
      .eq('is_public', true)
      .limit(1);

    if (!publicPl || publicPl.length === 0) return res.status(403).json({ error: 'Forbidden' });
  }

  res.json({
    id:          song.id,
    song_title:  song.title,
    artist:      song.artist,
    language:    song.language,
    chords_data: song.chords_data,
    raw_url:     song.source_url ?? null,
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/songs/:id
// ---------------------------------------------------------------------------

router.delete('/:id', requireAuth, async (req, res) => {
  const { error } = await getSupabaseAdmin()
    .from('songs')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: 'Failed to delete song' });

  res.status(204).send();
});

// ---------------------------------------------------------------------------
// PATCH /api/songs/:id/transpose
// Body: { transpose: number }
// ---------------------------------------------------------------------------

router.patch('/:id/transpose', requireAuth, async (req, res) => {
  const { transpose } = req.body;

  if (typeof transpose !== 'number' || transpose < -11 || transpose > 11) {
    return res.status(400).json({ error: 'transpose must be an integer between -11 and 11' });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('songs')
    .update({ transpose })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Failed to update transpose' });
  if (!data) return res.status(404).json({ error: 'Song not found' });

  res.json(data);
});

// ---------------------------------------------------------------------------
// PATCH /api/songs/preferences
// Body: { language?: 'he'|'en', instrument?: 'guitar'|'piano' }
// ---------------------------------------------------------------------------

router.patch('/preferences', requireAuth, async (req, res) => {
  const { language, instrument } = req.body;
  const updates = {};

  if (language !== undefined) {
    if (!['he', 'en'].includes(language)) {
      return res.status(400).json({ error: "language must be 'he' or 'en'" });
    }
    updates.language = language;
  }

  if (instrument !== undefined) {
    if (!['guitar', 'piano'].includes(instrument)) {
      return res.status(400).json({ error: "instrument must be 'guitar' or 'piano'" });
    }
    updates.instrument = instrument;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .update(updates)
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) {
    console.error('Preferences update error:', error.message);
    return res.status(500).json({ error: 'Failed to update preferences' });
  }

  res.json(data);
});

module.exports = router;
