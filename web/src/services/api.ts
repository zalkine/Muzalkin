import { mockSongs } from '../data/mockSongs';
import type { Song } from '../utils/chords';

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

/**
 * Search songs. Falls back to mock data when no backend is configured.
 */
export async function searchSongs(
  query: string,
  language?: 'he' | 'en',
): Promise<Song[]> {
  if (API_URL) {
    try {
      const params = new URLSearchParams({ q: query });
      if (language) params.set('lang', language);
      const res = await fetch(`${API_URL}/api/search?${params}`);
      if (res.ok) return res.json();
    } catch {
      // fall through to mock
    }
  }

  const q = query.toLowerCase();
  return mockSongs.filter((s) => {
    const matchesQuery =
      !q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
    const matchesLang = !language || s.language === language;
    return matchesQuery && matchesLang;
  });
}

/**
 * Get a single song's chord data by ID.
 */
export async function getSongChords(songId: string): Promise<Song | null> {
  if (API_URL) {
    try {
      const res = await fetch(`${API_URL}/api/songs/${songId}`);
      if (res.ok) return res.json();
    } catch {
      // fall through to mock
    }
  }

  return mockSongs.find((s) => s.id === songId) ?? null;
}
