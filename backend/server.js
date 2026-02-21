'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const chordsRouter = require('./routes/chords');
const songsRouter  = require('./routes/songs');

const app  = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'DELETE'],
}));

app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use('/api/chords', chordsRouter);
app.use('/api/songs',  songsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`MuZalkin backend running on http://localhost:${PORT}`);
});
