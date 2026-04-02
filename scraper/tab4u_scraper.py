"""
Tab4U Scraper — extracts chords with positional data from tab4u.com

Output format (chords_data):
[
  { "type": "section", "content": "פזמון" },
  {
    "type": "line",
    "lyrics": "שלום לך ארץ נהדרת",
    "chords": [
      { "chord": "Am", "position": 0 },
      { "chord": "G", "position": 9 }
    ]
  }
]

Usage:
    from tab4u_scraper import search_tab4u, scrape_song

    results = search_tab4u("הללויה")
    song = scrape_song(results[0]["url"])
"""

import re
import time
import json
from typing import Optional
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup, Tag

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
}

BASE_URL = "https://www.tab4u.com"
SEARCH_URL = BASE_URL + "/results?tab=songs&q={query}"
REQUEST_DELAY = 1.0  # seconds between requests


def _get(url: str) -> Optional[BeautifulSoup]:
    """Fetch a URL and return parsed soup, or None on failure."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        # Tab4U may use windows-1255 or utf-8
        resp.encoding = resp.apparent_encoding or "utf-8"
        return BeautifulSoup(resp.text, "html.parser")
    except requests.RequestException as e:
        print(f"[tab4u] Request failed: {e}")
        return None


def search_tab4u(query: str, limit: int = 10) -> list[dict]:
    """
    Search Tab4U for songs matching the query.

    Returns: [{ "title": str, "artist": str, "url": str }]
    """
    url = SEARCH_URL.format(query=quote_plus(query))
    soup = _get(url)
    if not soup:
        return []

    results = []
    # Tab4U search results are typically in a table or list of song links
    for link in soup.select("a.ruSongLink, a[href*='/tabs/songs/']"):
        href = link.get("href", "")
        if not href or "/tabs/songs/" not in href:
            continue

        title = link.get_text(strip=True)
        # Try to find artist nearby (usually in a sibling or parent element)
        artist = ""
        parent_row = link.find_parent("tr") or link.find_parent("div")
        if parent_row:
            artist_el = parent_row.select_one(".ruArtist, .artist, a[href*='/tabs/artists/']")
            if artist_el:
                artist = artist_el.get_text(strip=True)

        full_url = href if href.startswith("http") else BASE_URL + href
        results.append({"title": title, "artist": artist, "url": full_url})

        if len(results) >= limit:
            break

    return results


def _extract_table_based(soup: BeautifulSoup) -> list[dict]:
    """
    Extract chords from table-based layout.
    Tab4U often uses tables where:
    - One row contains chord cells
    - The next row contains lyrics cells
    Chords are positioned by their table cell alignment with lyrics.
    """
    lines = []
    # Look for the main song content area
    song_div = (
        soup.select_one("#songContentTPpowerful")
        or soup.select_one(".song_content")
        or soup.select_one("#songContent")
        or soup.select_one(".songContentBody")
    )
    if not song_div:
        return []

    tables = song_div.find_all("table")
    if not tables:
        return _extract_pre_based(song_div)

    for table in tables:
        rows = table.find_all("tr")
        i = 0
        while i < len(rows):
            row = rows[i]
            cells = row.find_all("td")

            # Check if this row contains chords (look for chord-like content)
            chord_cells = []
            is_chord_row = False
            for cell in cells:
                text = cell.get_text(strip=True)
                if _is_chord(text):
                    is_chord_row = True
                chord_cells.append(text)

            if is_chord_row and i + 1 < len(rows):
                # Next row should be lyrics
                lyric_row = rows[i + 1]
                lyric_cells = [td.get_text() for td in lyric_row.find_all("td")]

                # Build lyrics string and track chord positions
                lyrics = ""
                chords = []
                for j in range(max(len(chord_cells), len(lyric_cells))):
                    lyric_text = lyric_cells[j] if j < len(lyric_cells) else ""
                    chord_text = chord_cells[j].strip() if j < len(chord_cells) else ""

                    if chord_text and _is_chord(chord_text):
                        chords.append({"chord": chord_text, "position": len(lyrics)})

                    lyrics += lyric_text

                lyrics = lyrics.rstrip()
                if lyrics or chords:
                    lines.append({
                        "type": "line",
                        "lyrics": lyrics,
                        "chords": chords,
                    })
                i += 2
            else:
                # Could be a section header or plain text
                text = row.get_text(strip=True)
                if text and _is_section_header(text):
                    lines.append({"type": "section", "content": text})
                elif text and not is_chord_row:
                    lines.append({
                        "type": "line",
                        "lyrics": text,
                        "chords": [],
                    })
                i += 1

    return lines


def _extract_pre_based(container: Tag) -> list[dict]:
    """
    Extract chords from pre-formatted or span-based layout.
    Chords and lyrics alternate on lines, with chords positioned by spaces.
    """
    lines = []

    # Get all text lines from the container
    # Try <pre> first, then fall back to line-by-line extraction
    pre = container.find("pre")
    if pre:
        raw_lines = pre.get_text().split("\n")
    else:
        # Extract lines from nested elements
        raw_lines = []
        for el in container.children:
            if isinstance(el, Tag):
                text = el.get_text()
                raw_lines.extend(text.split("\n"))
            elif isinstance(el, str):
                raw_lines.extend(el.split("\n"))

    i = 0
    while i < len(raw_lines):
        line = raw_lines[i]

        if not line.strip():
            i += 1
            continue

        if _is_section_header(line.strip()):
            lines.append({"type": "section", "content": line.strip()})
            i += 1
            continue

        if _line_is_all_chords(line):
            # This is a chord line — next line should be lyrics
            chords = _parse_chord_positions(line)
            lyrics = ""
            if i + 1 < len(raw_lines) and not _line_is_all_chords(raw_lines[i + 1]):
                lyrics = raw_lines[i + 1].rstrip()
                i += 2
            else:
                i += 1

            lines.append({
                "type": "line",
                "lyrics": lyrics,
                "chords": chords,
            })
        else:
            # Plain lyrics line with no chords
            lines.append({
                "type": "line",
                "lyrics": line.rstrip(),
                "chords": [],
            })
            i += 1

    return lines


def _is_chord(text: str) -> bool:
    """Check if a string looks like a chord (e.g., Am, C#m7, Bb, Dsus4)."""
    return bool(re.match(
        r"^[A-G][#b]?(m|maj|min|dim|aug|sus|add|M)?[0-9]*(sus[0-9])?(/[A-G][#b]?)?$",
        text.strip(),
    ))


def _line_is_all_chords(line: str) -> bool:
    """Check if a line consists entirely of chord names and whitespace."""
    tokens = line.split()
    if not tokens:
        return False
    chord_count = sum(1 for t in tokens if _is_chord(t))
    return chord_count >= len(tokens) * 0.7 and chord_count > 0


def _is_section_header(text: str) -> bool:
    """Check if text looks like a section header (e.g., 'פזמון', 'Verse 1')."""
    section_patterns = [
        r"^(פזמון|בית|קודה|גשר|אינטרו|סיום|אאוטרו)",
        r"^(verse|chorus|bridge|intro|outro|pre-chorus|coda|interlude)",
        r"^\[.*\]$",
    ]
    text_lower = text.lower().strip("[](): ")
    return any(re.match(p, text_lower, re.IGNORECASE) for p in section_patterns)


def _parse_chord_positions(line: str) -> list[dict]:
    """
    Parse a chord-only line and return chords with their character positions.
    E.g., "Am      G       F" -> [{"chord":"Am","position":0}, {"chord":"G","position":8}, ...]
    """
    chords = []
    for match in re.finditer(r"[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|M)?[0-9]*(?:sus[0-9])?(?:/[A-G][#b]?)?", line):
        chords.append({"chord": match.group(), "position": match.start()})
    return chords


def scrape_song(url: str) -> Optional[dict]:
    """
    Scrape a song page and return structured chord data.

    Returns: {
        "title": str,
        "artist": str,
        "chords_data": [...]
    }
    """
    soup = _get(url)
    if not soup:
        return None

    # Extract title and artist
    title = ""
    artist = ""
    title_el = soup.select_one("h1.song_name, h1, .songTitle")
    if title_el:
        title = title_el.get_text(strip=True)
    artist_el = soup.select_one("a.artist_link, .artistName, a[href*='/tabs/artists/']")
    if artist_el:
        artist = artist_el.get_text(strip=True)

    # Try table-based extraction first, then fall back to pre-based
    chords_data = _extract_table_based(soup)

    return {
        "title": title,
        "artist": artist,
        "url": url,
        "chords_data": chords_data,
    }


def scrape_with_cache_check(
    title: str,
    artist: str,
    supabase_client=None,
) -> Optional[dict]:
    """
    Check Supabase cache before scraping. Save results after scraping.
    """
    # Check cache first
    if supabase_client:
        try:
            result = (
                supabase_client.table("cached_chords")
                .select("*")
                .eq("song_title", title)
                .eq("artist", artist)
                .eq("source", "tab4u")
                .limit(1)
                .execute()
            )
            if result.data:
                return result.data[0]
        except Exception as e:
            print(f"[tab4u] Cache check failed: {e}")

    # Search and scrape
    results = search_tab4u(f"{title} {artist}", limit=3)
    if not results:
        return None

    time.sleep(REQUEST_DELAY)

    song = scrape_song(results[0]["url"])
    if not song:
        return None

    # Save to cache
    if supabase_client and song.get("chords_data"):
        try:
            supabase_client.table("cached_chords").insert({
                "song_title": title,
                "artist": artist,
                "language": "he",
                "source": "tab4u",
                "chords_data": song["chords_data"],
                "raw_url": song["url"],
            }).execute()
        except Exception as e:
            print(f"[tab4u] Cache save failed: {e}")

    return song


# --- CLI ---

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python tab4u_scraper.py <search query>")
        print("       python tab4u_scraper.py --url <song-url>")
        sys.exit(1)

    if sys.argv[1] == "--url" and len(sys.argv) >= 3:
        result = scrape_song(sys.argv[2])
        if result:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print("Failed to scrape song.")
    else:
        query = " ".join(sys.argv[1:])
        print(f"Searching for: {query}")
        results = search_tab4u(query)
        for r in results:
            print(f"  {r['title']} — {r['artist']}")
            print(f"    {r['url']}")

        if results:
            print(f"\nScraping first result...")
            time.sleep(REQUEST_DELAY)
            song = scrape_song(results[0]["url"])
            if song:
                print(json.dumps(song, ensure_ascii=False, indent=2))
