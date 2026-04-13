'use strict';

require('dotenv').config();

const path    = require('path');
const express = require('express');
const cors    = require('cors');

const chordsRouter    = require('./routes/chords');
const songsRouter     = require('./routes/songs');
const playlistsRouter = require('./routes/playlists');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));

app.use(express.json());

app.use('/api/chords',    chordsRouter);
app.use('/api/songs',     songsRouter);
app.use('/api/playlists', playlistsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '2.0.0' }));

// Serve the built React web app
const webDist = path.join(__dirname, 'public');
// Cache JS/CSS assets aggressively (content-hashed filenames), but never cache index.html
app.use(express.static(webDist, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
  },
}));

// SPA fallback — send index.html for any non-API route
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.sendFile(path.join(webDist, 'index.html'));
});

// Bind to 0.0.0.0 for Google Cloud compatibility
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MuZalkin backend running on http://0.0.0.0:${PORT}`);
});
