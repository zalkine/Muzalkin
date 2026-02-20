# MuZalkin

A bilingual Hebrew/English chord app for guitar and piano. Users search for songs, the app fetches chords from the web, and displays them with support for RTL (Hebrew) and LTR (English) layouts. Available as a React Native mobile app (iOS + Android) and a React web app.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | v22+ | [nodejs.org](https://nodejs.org) |
| Python | 3.10+ | [python.org](https://python.org) |
| Expo CLI | latest | `npm install -g expo-cli` |
| Supabase account | — | [supabase.com](https://supabase.com) |

---

## Project Structure

```
MuZalkin/
├── CLAUDE.md               — AI assistant context (read first)
├── README.md               — this file
├── supabase/
│   └── schema.sql          — run once to create all DB tables
├── scraper/
│   └── tab4u_scraper.py    — Hebrew chord scraper (Tab4U)
├── backend/                — Node.js API layer (optional, beyond Supabase)
│   ├── routes/
│   └── services/
├── mobile/                 — React Native (Expo)
│   ├── app/
│   ├── components/
│   └── locales/
└── web/                    — React + Vite
    ├── src/
    └── locales/
```

---

## 1 — Supabase Setup

### 1.1 Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **anon public key** (Settings → API).

### 1.2 Run the database schema

1. In the Supabase dashboard, open **SQL Editor → New Query**.
2. Paste the contents of `supabase/schema.sql` and click **Run**.

This creates all 5 tables (`users`, `songs`, `playlists`, `playlist_songs`, `cached_chords`), indexes, Row Level Security policies, and the auth trigger that auto-creates a user profile on sign-up.

### 1.3 Enable Google Auth

1. In the Supabase dashboard, go to **Authentication → Providers → Google**.
2. Enable it and fill in your Google OAuth **Client ID** and **Client Secret**.
3. Add your app's redirect URL to the allowed list.

---

## 2 — Environment Variables

Copy `mobile/.env.example` to `mobile/.env` and fill in your values. **Never commit `.env`.**

```env
# mobile/.env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key-here
```

> The `EXPO_PUBLIC_` prefix is required for Expo to bundle variables into the client app.

For the backend/scraper that writes to `cached_chords`, use the **service role key** (never expose this in the mobile app):

```env
# backend/.env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

---

## 3 — Mobile App Setup (React Native / Expo)

```bash
cd mobile
npm install
npx expo start
```

- Press `i` to open iOS Simulator, `a` for Android emulator.
- Scan the QR code with the **Expo Go** app to run on a physical device.

---

## 4 — Web App Setup (React / Vite)

```bash
cd web
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## 5 — Python Scraper Setup

```bash
cd scraper
pip install requests beautifulsoup4
python tab4u_scraper.py
```

The scraper always checks the `cached_chords` Supabase table before making a network request, and saves results back to the cache after fetching.

---

## Development Notes

- **Translation files** — `mobile/locales/` and `web/locales/` must stay in sync. Edit both when adding a new key.
- **Chord data format** — `chords_data` is stored as JSONB: `[{ type: "chords" | "lyrics" | "section", content: "..." }]`
- **Language toggle** — users switch language manually in Settings. Hebrew forces RTL layout; English uses LTR.
- **Secrets** — never commit `.env` files or Supabase keys. Add `.env` to `.gitignore`.

---

## Development Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — MVP | In progress | Supabase setup, auth, Hebrew search, save songs, playlists |
| 2 — Bilingual | Planned | i18next, RTL/LTR toggle, English chord sources |
| 3 — Polish | Planned | Auto-scroll, transpose, share by link, offline mode |
