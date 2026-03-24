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

// Configure Node.js native fetch to use the environment proxy (HTTPS_PROXY)
// This is needed because Node 18+ fetch doesn't read proxy env vars automatically.
if (process.env.HTTPS_PROXY || process.env.https_proxy) {
  const { ProxyAgent, setGlobalDispatcher } = require('undici');
  setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY || process.env.https_proxy));
}

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

// Expose public Supabase config to the browser (anon key is safe to publish)
app.get('/config', (_req, res) => {
  res.json({
    supabaseUrl:     process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MuZalkin backend listening on http://0.0.0.0:${PORT}`);
});
