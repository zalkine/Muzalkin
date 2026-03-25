'use strict';

/**
 * /api/playlists — playlist management and song-to-playlist association.
 * All routes require a valid Supabase JWT in Authorization: Bearer <token>.
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

// ---------------------------------------------------------------------------
// GET /api/playlists  — list user's playlists with song count
// ---------------------------------------------------------------------------

router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('playlists')
    .select('id, name, description, is_public, created_at, playlist_songs(count)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Failed to fetch playlists' });

  const playlists = (data || []).map((p) => ({
    id:          p.id,
    name:        p.name,
    description: p.description,
    is_public:   p.is_public,
    created_at:  p.created_at,
    song_count:  p.playlist_songs?.[0]?.count ?? 0,
  }));

  res.json(playlists);
});

// ---------------------------------------------------------------------------
// POST /api/playlists  — create a new playlist
// Body: { name: string, description?: string, is_public?: boolean }
// ---------------------------------------------------------------------------

router.post('/', requireAuth, async (req, res) => {
  const { name, description = null, is_public = false } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Missing playlist name' });
  }

  const { data, error } = await supabaseAdmin
    .from('playlists')
    .insert({
      user_id:     req.user.id,
      name:        name.trim(),
      description,
      is_public,
    })
    .select()
    .single();

  if (error) {
    console.error('Playlist insert error:', error.message);
    return res.status(500).json({ error: 'Failed to create playlist' });
  }

  res.status(201).json(data);
});

// ---------------------------------------------------------------------------
// GET /api/playlists/:id/songs  — list songs in a playlist
// ---------------------------------------------------------------------------

router.get('/:id/songs', requireAuth, async (req, res) => {
  // Verify playlist belongs to user
  const { data: playlist, error: plErr } = await supabaseAdmin
    .from('playlists')
    .select('id, user_id')
    .eq('id', req.params.id)
    .single();

  if (plErr || !playlist) return res.status(404).json({ error: 'Playlist not found' });
  if (playlist.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabaseAdmin
    .from('playlist_songs')
    .select('id, position, added_at, songs(id, title, artist, language, instrument, transpose)')
    .eq('playlist_id', req.params.id)
    .order('position', { ascending: true });

  if (error) return res.status(500).json({ error: 'Failed to fetch playlist songs' });

  res.json(data || []);
});

// ---------------------------------------------------------------------------
// POST /api/playlists/:id/songs  — add a song to a playlist
// Body: { song_id: string }
// ---------------------------------------------------------------------------

router.post('/:id/songs', requireAuth, async (req, res) => {
  const { song_id } = req.body;

  if (!song_id) {
    return res.status(400).json({ error: 'Missing song_id' });
  }

  // Verify playlist belongs to user
  const { data: playlist, error: plErr } = await supabaseAdmin
    .from('playlists')
    .select('id, user_id')
    .eq('id', req.params.id)
    .single();

  if (plErr || !playlist) return res.status(404).json({ error: 'Playlist not found' });
  if (playlist.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  // Verify song belongs to user
  const { data: song, error: songErr } = await supabaseAdmin
    .from('songs')
    .select('id, user_id')
    .eq('id', song_id)
    .single();

  if (songErr || !song) return res.status(404).json({ error: 'Song not found' });
  if (song.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  // Get current max position
  const { data: posData } = await supabaseAdmin
    .from('playlist_songs')
    .select('position')
    .eq('playlist_id', req.params.id)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = posData && posData.length > 0 ? (posData[0].position ?? 0) + 1 : 0;

  const { data, error } = await supabaseAdmin
    .from('playlist_songs')
    .insert({
      playlist_id: req.params.id,
      song_id,
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    console.error('Playlist song insert error:', error.message);
    return res.status(500).json({ error: 'Failed to add song to playlist' });
  }

  res.status(201).json(data);
});

// ---------------------------------------------------------------------------
// DELETE /api/playlists/:id/songs/:songId  — remove a song from a playlist
// ---------------------------------------------------------------------------

router.delete('/:id/songs/:songId', requireAuth, async (req, res) => {
  // Verify playlist belongs to user
  const { data: playlist, error: plErr } = await supabaseAdmin
    .from('playlists')
    .select('id, user_id')
    .eq('id', req.params.id)
    .single();

  if (plErr || !playlist) return res.status(404).json({ error: 'Playlist not found' });
  if (playlist.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { error } = await supabaseAdmin
    .from('playlist_songs')
    .delete()
    .eq('playlist_id', req.params.id)
    .eq('song_id', req.params.songId);

  if (error) return res.status(500).json({ error: 'Failed to remove song from playlist' });

  res.status(204).send();
});

// ---------------------------------------------------------------------------
// PATCH /api/songs/:id/transpose  — update transpose value for a saved song
// Body: { transpose: number }
// ---------------------------------------------------------------------------

module.exports = router;
