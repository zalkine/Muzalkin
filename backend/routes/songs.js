/**
 * routes/songs.js
 *
 * REST API for the `songs` table.
 *
 * All routes require a valid Supabase JWT in the Authorization header.
 * The user_id is extracted from the verified JWT — never trusted from the client.
 *
 * Endpoints:
 *   GET    /songs          — list authenticated user's saved songs
 *   GET    /songs/:id      — get a single song by UUID
 *   POST   /songs          — save / upsert a song
 *   DELETE /songs/:id      — delete a song
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Server-side Supabase client (service role bypasses RLS for admin ops,
// but here we use the anon key + user JWT to respect RLS policies).
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

// ---------------------------------------------------------------------------
// Auth middleware — extracts and verifies the Supabase JWT
// ---------------------------------------------------------------------------

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid token' });

  req.user = data.user;
  // Attach a user-scoped client so Supabase RLS applies correctly
  req.db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  next();
}

// ---------------------------------------------------------------------------
// GET /songs — list current user's songs
// ---------------------------------------------------------------------------

router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await req.db
    .from('songs')
    .select('id, title, artist, instrument, language, transpose, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ---------------------------------------------------------------------------
// GET /songs/:id — single song
// ---------------------------------------------------------------------------

router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await req.db
    .from('songs')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (error) return res.status(404).json({ error: 'Song not found' });
  res.json(data);
});

// ---------------------------------------------------------------------------
// POST /songs — save (upsert) a song
// ---------------------------------------------------------------------------

router.post('/', requireAuth, async (req, res) => {
  const { title, artist, language, chords_data, source_url, instrument, transpose } = req.body;

  if (!title || !artist) {
    return res.status(400).json({ error: 'title and artist are required' });
  }

  const { data, error } = await req.db
    .from('songs')
    .upsert(
      {
        user_id:    req.user.id,
        title:      title.trim(),
        artist:     artist.trim(),
        language:   language ?? 'he',
        chords_data: chords_data ?? null,
        source_url:  source_url ?? null,
        instrument:  instrument ?? 'guitar',
        transpose:   typeof transpose === 'number' ? transpose : 0,
      },
      { onConflict: 'user_id,title,artist' },
    )
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ---------------------------------------------------------------------------
// DELETE /songs/:id
// ---------------------------------------------------------------------------

router.delete('/:id', requireAuth, async (req, res) => {
  const { error } = await req.db
    .from('songs')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
