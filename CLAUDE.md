# 🎸 MuZalkin — Project Context for Claude Code
> Read this file at the start of every session. It contains all architectural decisions made before coding began.
---
## What We're Building
A **bilingual Hebrew/English chord app** for guitar and piano.
- Users search for songs → app fetches chords from the web → displays them beautifully
- Friends can share playlists and saved songs
- Available as: React Native mobile app (iOS + Android) + React web app
---
## Tech Stack
| Layer | Technology | Why |
|---|---|---|
| Database + Auth | **Supabase** (PostgreSQL) | Free tier, no backend server needed to start |
| Mobile | **React Native** (Expo) | One codebase for iOS + Android |
| Web | **React** (Vite) | Share components with mobile where possible |
| i18n | **i18next** | Works across React Native and React web |
| Chord scraping | **Python** (requests + BeautifulSoup) | Already written — see `scraper/tab4u_scraper.py` |
| Caching | **Supabase** `cached_chords` table | Avoid re-fetching the same song twice |
---
## Database Schema (Supabase / PostgreSQL)
### Table: `users`
```sql
CREATE TABLE users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL UNIQUE,
  display_name text NOT NULL,
  avatar_url   text,
  language     text NOT NULL DEFAULT 'he' CHECK (language IN ('he', 'en')),
  created_at   timestamp DEFAULT now()
);
```
### Table: `songs`
```sql
CREATE TABLE songs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  artist      text NOT NULL,
  language    text DEFAULT 'he' CHECK (language IN ('he', 'en')),
  chords_data jsonb,         -- full chord + lyrics structure
  source_url  text,          -- where chords came from
  instrument  text DEFAULT 'guitar', -- 'guitar' | 'piano'
  transpose   int  DEFAULT 0,        -- semitone shift
  created_at  timestamp DEFAULT now()
);
```
### Table: `playlists`
```sql
CREATE TABLE playlists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  is_public   boolean NOT NULL DEFAULT false,
  created_at  timestamp DEFAULT now()
);
```
### Table: `playlist_songs`
```sql
CREATE TABLE playlist_songs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid REFERENCES playlists(id) ON DELETE CASCADE,
  song_id     uuid REFERENCES songs(id) ON DELETE CASCADE,
  position    int,
  added_at    timestamp DEFAULT now()
);
```
### Table: `cached_chords`
```sql
CREATE TABLE cached_chords (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_title  text NOT NULL,
  artist      text NOT NULL,
  language    text DEFAULT 'he' CHECK (language IN ('he', 'en')),
  source      text NOT NULL, -- 'tab4u' | 'nagnu' | 'ultimate_guitar' | 'chordify'
  chords_data jsonb NOT NULL,
  raw_url     text,
  fetched_at  timestamp DEFAULT now(),
  expires_at  timestamp
);
CREATE INDEX idx_cached_lang_source ON cached_chords (language, source, song_title);
```
---
## Chord Sources (Priority Order)
### Hebrew songs → try in this order:
1. **Tab4U** (`tab4u.com`) — largest Hebrew chord DB, scraping-based
2. **Nagnu** (`nagnu.co.il`) — community Hebrew chords, clean URLs
3. **Negina** (`negina.co.il`) — partial paywall, use for metadata fallback
### English songs → try in this order:
1. **Ultimate Guitar** (`ultimate-guitar.com`) — largest global chord DB
2. **Chordify** (`chordify.net`) — auto-generates chords from audio
3. **Tab4U** (English section) — secondary fallback
### Both languages:
- **Spotify API** — for song metadata only (album art, BPM, key signature). No chords.
### Caching rule:
Always check `cached_chords` table BEFORE hitting any external source.
After fetching, always save to `cached_chords`.
---
## i18n / Bilingual Rules
- Language is stored per user in `users.language` ('he' or 'en')
- User changes language manually in Settings — NO auto-detection
- Hebrew → RTL layout (`I18nManager.forceRTL(true)` in React Native)
- English → LTR layout (default)
- Translation files: `locales/he.json` and `locales/en.json`
- **Never hardcode UI text** — always use `t('key')` from i18next
- Font: **Noto Sans Hebrew** for Hebrew, **Sora** for English
- Chord notation is the same in both languages (Am, G, F#m etc.)
### Key translation keys to maintain:
```
search, playlists, save_song, my_songs, settings, language,
instrument_guitar, instrument_piano, no_results, transpose,
add_to_playlist, share, loading, error_fetch, auto_scroll
```
---
## Project Folder Structure
```
MuZalkin/
├── CLAUDE.md                  ← this file
├── scraper/
│   └── tab4u_scraper.py       ← already written, use as base for other scrapers
├── backend/                   ← Node.js API (if needed beyond Supabase)
│   ├── routes/
│   │   ├── songs.js
│   │   └── chords.js
│   └── services/
│       └── chord_router.js    ← smart source picker
├── mobile/                    ← React Native (Expo)
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── search.tsx
│   │   │   ├── playlists.tsx
│   │   │   └── settings.tsx
│   │   └── song/[id].tsx
│   ├── components/
│   │   ├── ChordDisplay.tsx   ← renders chords + lyrics
│   │   └── SongCard.tsx
│   └── locales/
│       ├── he.json
│       └── en.json
└── web/                       ← React (Vite)
    ├── src/
    │   ├── pages/
    │   └── components/
    └── locales/               ← same files as mobile
        ├── he.json
        └── en.json
```
---
## Coding Conventions
- Language: **TypeScript** for all frontend (mobile + web)
- Style: **Prettier** + **ESLint** — run before committing
- Components: functional only, no class components
- State: **React Context** for auth/language, local `useState` for UI state
- API calls: always use `async/await`, always handle errors
- Never commit secrets — use `.env` files for Supabase URL + key
- Expo client env vars must be prefixed `EXPO_PUBLIC_` to be accessible in the app bundle
- Supabase client is a singleton — always import from `mobile/lib/supabase.ts`
---
## Development Phases
### Phase 1 — MVP (start here)
- [ ] Supabase project setup + all 5 tables created
- [ ] Supabase Auth (Google login)
- [ ] Search screen (Hebrew) → Tab4U scraper → display chords
- [ ] Save song to `songs` table
- [ ] Basic playlist creation
### Phase 2 — Bilingual
- [ ] i18next setup + `he.json` + `en.json`
- [ ] RTL/LTR toggle in Settings
- [ ] English search → Ultimate Guitar scraper
### Phase 3 — Polish
- [ ] Auto-scroll during playing
- [ ] Transpose (shift chords up/down)
- [ ] Share song by link
- [ ] Offline mode (cached songs available without internet)
---
## Important Notes for Claude Code
1. **Always check the cache first** before calling any scraper
2. **Supabase client** is initialized once in `lib/supabase.ts` — import from there
3. The `chords_data` JSON field stores lines as: `[{ type: "chords"|"lyrics"|"section", content: "..." }]`
4. When scraping, add a **1 second delay** between requests — don't hammer external sites
5. React Native and Web share the same `locales/` folder — keep them in sync
6. All text direction logic lives in `hooks/useLanguage.ts`
