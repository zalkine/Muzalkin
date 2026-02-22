/**
 * server.js — MuZalkin backend entry point
 *
 * Serves the chord-routing and song-management APIs.
 * Designed to run alongside Supabase (which handles auth and the DB directly).
 *
 * Routes:
 *   GET  /chords?title=&artist=&lang=   — fetch + cache chords
 *   GET  /songs                          — list user's saved songs
 *   GET  /songs/:id                      — get single song
 *   POST /songs                          — save/upsert song
 *   DELETE /songs/:id                    — delete song
 */

require('dotenv').config();

const path    = require('path');
const express = require('express');
const cors    = require('cors');

const chordsRouter = require('./routes/chords');
const songsRouter  = require('./routes/songs');
const searchRouter = require('./routes/search');

const app  = express();
const PORT = process.env.PORT ?? 3001;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use('/chords',  chordsRouter);
app.use('/songs',   songsRouter);
app.use('/search',  searchRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`MuZalkin backend listening on http://localhost:${PORT}`);
});
