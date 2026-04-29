'use strict';

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
// GET /api/playlists  — list user's own + all public playlists, sorted by
//                      song count descending (most popular first)
// ---------------------------------------------------------------------------

router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await getSupabaseAdmin()
    .from('playlists')
    .select('id, name, description, is_public, created_at, user_id, users(display_name), playlist_songs(count)')
    .or(`user_id.eq.${req.user.id},is_public.eq.true`);

  if (error) return res.status(500).json({ error: 'Failed to fetch playlists' });

  const playlists = (data || [])
    .map((p) => ({
      id:           p.id,
      name:         p.name,
      description:  p.description,
      is_public:    p.is_public,
      created_at:   p.created_at,
      is_owner:     p.user_id === req.user.id,
      creator_name: p.users?.display_name ?? 'Unknown',
      song_count:   p.playlist_songs?.[0]?.count ?? 0,
    }))
    .sort((a, b) => b.song_count - a.song_count);

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

  const { data, error } = await getSupabaseAdmin()
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
// PATCH /api/playlists/:id  — update name and/or is_public (owner only)
// Body: { name?: string, is_public?: boolean }
// ---------------------------------------------------------------------------

router.patch('/:id', requireAuth, async (req, res) => {
  const { data: playlist, error: plErr } = await getSupabaseAdmin()
    .from('playlists')
    .select('id, user_id')
    .eq('id', req.params.id)
    .single();

  if (plErr || !playlist) return res.status(404).json({ error: 'Playlist not found' });
  if (playlist.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const updates = {};
  if (req.body.name !== undefined)      updates.name      = req.body.name.trim();
  if (req.body.is_public !== undefined) updates.is_public = req.body.is_public;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('playlists')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Failed to update playlist' });
  res.json(data);
});

// ---------------------------------------------------------------------------
// DELETE /api/playlists/:id  — delete a playlist (owner only)
//                              playlist_songs are removed via ON DELETE CASCADE
// ---------------------------------------------------------------------------

router.delete('/:id', requireAuth, async (req, res) => {
  const { data: playlist, error: plErr } = await getSupabaseAdmin()
    .from('playlists')
    .select('id, user_id')
    .eq('id', req.params.id)
    .single();

  if (plErr || !playlist) return res.status(404).json({ error: 'Playlist not found' });
  if (playlist.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { error } = await getSupabaseAdmin()
    .from('playlists')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: 'Failed to delete playlist' });
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// GET /api/playlists/:id/songs  — list songs in a playlist
//                                 non-owners may view if playlist is public
// ---------------------------------------------------------------------------

router.get('/:id/songs', requireAuth, async (req, res) => {
  const { data: playlist, error: plErr } = await getSupabaseAdmin()
    .from('playlists')
    .select('id, user_id, is_public')
    .eq('id', req.params.id)
    .single();

  if (plErr || !playlist) return res.status(404).json({ error: 'Playlist not found' });

  const isOwner  = playlist.user_id === req.user.id;
  const canView  = isOwner || playlist.is_public;
  if (!canView) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await getSupabaseAdmin()
    .from('playlist_songs')
    .select('id, position, added_at, songs(id, title, artist, language, instrument, transpose)')
    .eq('playlist_id', req.params.id)
    .order('position', { ascending: true });

  if (error) return res.status(500).json({ error: 'Failed to fetch playlist songs' });

  res.json(data || []);
});

// ---------------------------------------------------------------------------
// POST /api/playlists/:id/songs  — add a song to a playlist (owner only)
// Body: { song_id: string }
// ---------------------------------------------------------------------------

router.post('/:id/songs', requireAuth, async (req, res) => {
  const { song_id } = req.body;

  if (!song_id) {
    return res.status(400).json({ error: 'Missing song_id' });
  }

  const { data: playlist, error: plErr } = await getSupabaseAdmin()
    .from('playlists')
    .select('id, user_id')
    .eq('id', req.params.id)
    .single();

  if (plErr || !playlist) return res.status(404).json({ error: 'Playlist not found' });
  if (playlist.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { data: song, error: songErr } = await getSupabaseAdmin()
    .from('songs')
    .select('id, user_id')
    .eq('id', song_id)
    .single();

  if (songErr || !song) return res.status(404).json({ error: 'Song not found' });
  if (song.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { data: posData } = await getSupabaseAdmin()
    .from('playlist_songs')
    .select('position')
    .eq('playlist_id', req.params.id)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = posData && posData.length > 0 ? (posData[0].position ?? 0) + 1 : 0;

  const { data, error } = await getSupabaseAdmin()
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
// DELETE /api/playlists/:id/songs/:songId  — remove a song (owner only)
// ---------------------------------------------------------------------------

router.delete('/:id/songs/:songId', requireAuth, async (req, res) => {
  const { data: playlist, error: plErr } = await getSupabaseAdmin()
    .from('playlists')
    .select('id, user_id')
    .eq('id', req.params.id)
    .single();

  if (plErr || !playlist) return res.status(404).json({ error: 'Playlist not found' });
  if (playlist.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { error } = await getSupabaseAdmin()
    .from('playlist_songs')
    .delete()
    .eq('playlist_id', req.params.id)
    .eq('song_id', req.params.songId);

  if (error) return res.status(500).json({ error: 'Failed to remove song from playlist' });

  res.status(204).send();
});

module.exports = router;
