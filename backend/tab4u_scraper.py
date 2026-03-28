#!/usr/bin/env python3
"""
Tab4U Hebrew chord scraper.

Usage:
    python3 tab4u_scraper.py "<title>" "<artist>"
    python3 tab4u_scraper.py "לאט לאט"
    python3 tab4u_scraper.py "לאט לאט" "עידן רייכל"

Output (stdout): JSON object
    {
        "title":       "לאט לאט",
        "artist":      "עידן רייכל",
        "url":         "https://www.tab4u.com/tabs/songs/...",
        "chords_data": [
            { "type": "section", "content": "פזמון" },
            { "type": "chords",  "content": "Am  G  F  E" },
            { "type": "lyrics",  "content": "לאט לאט ילך האור" },
            ...
        ]
    }

Errors are written to stderr; exit code 1 on failure.
Respects 1-second delay between requests as per project rules.
"""

import json
import re
import sys
import time
from urllib.parse import quote, unquote
from html import unescape

import cloudscraper
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL   = "https://www.tab4u.com"
REQUEST_TIMEOUT       = 20  # seconds
INTER_REQUEST_DELAY   = 1   # second — be polite to the server


def make_scraper():
    return cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "mobile": False}
    )


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

def search_song(title: str, artist: str = "") -> list:
    """
    Search Tab4U for a song. Returns a list of result dicts:
        [{ "title": str, "artist": str, "url": str }, ...]
    """
    query   = f"{title} {artist}".strip()
    url     = f"{BASE_URL}/resultsSimple?tab=songs&q={quote(query)}"
    scraper = make_scraper()

    try:
        res = scraper.get(url, timeout=REQUEST_TIMEOUT)
    except Exception as exc:
        print(f"Search request failed: {exc}", file=sys.stderr)
        return []

    if res.status_code != 200:
        print(f"Search HTTP {res.status_code}", file=sys.stderr)
        return []

    if "Just a moment" in res.text:
        print("Cloudflare challenge not bypassed", file=sys.stderr)
        return []

    soup    = BeautifulSoup(res.text, "html.parser")
    results = []
    seen    = set()

    for a in soup.find_all("a", href=re.compile(r"tabs/songs/\d+")):
        href = a.get("href", "")
        if not href:
            continue

        song_title, song_artist = _parse_tab4u_href(href)

        if not song_title:
            text = re.sub(r"\s+", " ", a.get_text()).strip()
            if " / " in text:
                parts      = text.split(" / ", 1)
                song_title  = parts[0].strip()
                song_artist = parts[1].strip()
            else:
                song_title = text

        if not song_title:
            continue

        key = f"{song_title}|{song_artist}".lower()
        if key in seen:
            continue
        seen.add(key)

        full_url = BASE_URL + "/" + href.lstrip("/")
        results.append({"title": song_title, "artist": song_artist, "url": full_url})

    print(f"Search found {len(results)} results", file=sys.stderr)
    return results


def _parse_tab4u_href(href: str) -> tuple:
    """Parse artist/title from  tabs/songs/ID_ARTIST_-_TITLE.html"""
    try:
        filename   = href.rstrip("/").rsplit("/", 1)[-1].replace(".html", "")
        without_id = re.sub(r"^\d+_", "", filename)
        decoded    = unescape(unquote(without_id.replace("_", " ")))
        if " - " in decoded:
            sep    = decoded.index(" - ")
            artist = decoded[:sep].strip()
            title  = decoded[sep + 3:].strip()
            return title, artist
        return decoded.strip(), ""
    except Exception:
        return "", ""


# ---------------------------------------------------------------------------
# Scrape a song page
# ---------------------------------------------------------------------------

def scrape_song_page(url: str) -> list:
    """
    Fetch a Tab4U song page and return the chords_data array.
    Parses the #songContentTPL table structure.
    """
    scraper = make_scraper()
    try:
        res = scraper.get(url, timeout=REQUEST_TIMEOUT)
        res.raise_for_status()
    except Exception as exc:
        print(f"Song page request failed: {exc}", file=sys.stderr)
        return []

    if "Just a moment" in res.text:
        print("Cloudflare challenge not bypassed on song page", file=sys.stderr)
        return []

    soup = BeautifulSoup(res.text, "html.parser")

    # Strategy 1: #songContentTPL table (current Tab4U structure)
    tpl = soup.find(id="songContentTPL")
    if tpl:
        result = []
        for row in tpl.find_all("tr"):
            chord_cells = row.find_all("td", class_="chords")
            if chord_cells:
                parts = []
                for cell in chord_cells:
                    text = cell.get_text(separator=" ").replace("\xa0", " ").strip()
                    text = re.sub(r"  +", "  ", text)
                    if text:
                        parts.append(text)
                content = "  ".join(parts)
                if content:
                    result.append({"type": "chords", "content": content})
                continue

            tag_cells = row.find_all("td", class_=re.compile(r"\bsongTag\b|\btag\b", re.I))
            if tag_cells:
                text = tag_cells[0].get_text().strip()
                if text:
                    result.append({"type": "section", "content": text})
                continue

            song_cells = row.find_all("td", class_="song")
            if song_cells:
                text = song_cells[0].get_text(separator=" ").replace("\xa0", " ").strip()
                if text:
                    result.append({"type": "lyrics", "content": text})

        if result:
            return result

    # Strategy 2: structured div.song_line elements
    song_lines = soup.select("div.song_line, div.songLine, div.tab-line")
    if song_lines:
        result = []
        for line_div in song_lines:
            chord_span = line_div.select_one("span.chord_line, span.chords, span.tab-chords")
            lyric_span = line_div.select_one("span.lyric_line, span.lyrics, span.tab-lyrics")
            if chord_span:
                content = chord_span.get_text()
                if content.strip():
                    result.append({"type": "chords", "content": content.rstrip()})
            if lyric_span:
                content = lyric_span.get_text()
                if content.strip():
                    result.append({"type": "lyrics", "content": content.rstrip()})
        if result:
            return result

    # Strategy 3: <pre> block
    pre = soup.find("pre")
    if pre:
        result = []
        for raw_line in pre.get_text().splitlines():
            kind = _classify_line(raw_line)
            if kind != "empty":
                result.append({"type": kind, "content": raw_line.rstrip()})
        if result:
            return result

    return []


# ---------------------------------------------------------------------------
# Chord-line detection (fallback classifier)
# ---------------------------------------------------------------------------

def _classify_line(text: str) -> str:
    stripped = text.strip()
    if not stripped:
        return "empty"
    if re.match(r"^[\[\(].*[\]\)]$", stripped) or re.match(
        r"^(פזמון|בית|גשר|קודה|אינטרו|סולו|סיום|chorus|verse|bridge|intro|outro)",
        stripped, re.IGNORECASE,
    ):
        return "section"
    chord_pattern = re.compile(
        r"^[A-G][#b]?(m|maj|min|sus[24]?|dim|aug|add\d+|[0-9])*(/[A-G][#b]?)?$"
    )
    tokens = stripped.split()
    if tokens:
        chord_count = sum(1 for t in tokens if chord_pattern.match(t))
        if chord_count / len(tokens) >= 0.6:
            return "chords"
    return "lyrics"


# ---------------------------------------------------------------------------
# Extract title/artist from the song page
# ---------------------------------------------------------------------------

def extract_song_meta(soup: BeautifulSoup, fallback_title: str, fallback_artist: str):
    h1    = soup.find("h1")
    title = h1.get_text(strip=True) if h1 else fallback_title
    artist_tag = soup.select_one("h2, span.artist_name, a.artist_link")
    artist = artist_tag.get_text(strip=True) if artist_tag else fallback_artist

    title = re.sub(r"\s*[-–|]\s*אקורדים.*$", "", title, flags=re.IGNORECASE).strip()
    title = re.sub(r"\s*[-–|]\s*chords.*$", "", title, flags=re.IGNORECASE).strip()

    return title or fallback_title, artist or fallback_artist


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print("Usage: tab4u_scraper.py <title> [artist]", file=sys.stderr)
        sys.exit(1)

    title_arg  = sys.argv[1]
    artist_arg = sys.argv[2] if len(sys.argv) > 2 else ""

    results = search_song(title_arg, artist_arg)
    if not results:
        print(f"No results found for: {title_arg}", file=sys.stderr)
        sys.exit(1)

    best = results[0]
    if artist_arg:
        for r in results:
            if artist_arg.lower() in r["artist"].lower():
                best = r
                break

    time.sleep(INTER_REQUEST_DELAY)

    song_url   = best["url"]
    chords_data = scrape_song_page(song_url)

    if not chords_data:
        print(f"Failed to parse chords from: {song_url}", file=sys.stderr)
        sys.exit(1)

    try:
        final_title  = best["title"]  or title_arg
        final_artist = best["artist"] or artist_arg
        # Try to get cleaner artist from the page only if URL parsing gave nothing
        if not final_artist:
            resp2 = make_scraper().get(song_url, timeout=REQUEST_TIMEOUT)
            soup2 = BeautifulSoup(resp2.text, "html.parser")
            _, final_artist = extract_song_meta(soup2, final_title, artist_arg)
    except Exception:
        final_title, final_artist = best["title"], best["artist"]

    print(json.dumps({
        "title":      final_title,
        "artist":     final_artist,
        "url":        song_url,
        "chords_data": chords_data,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
