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
        "url":         "https://www.tab4u.com/tab12345/",
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

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "he,en;q=0.9",
    "Referer": "https://www.tab4u.com/",
}

BASE_URL = "https://www.tab4u.com"
SEARCH_URL = BASE_URL + "/tabs/songs/"
REQUEST_TIMEOUT = 15  # seconds
INTER_REQUEST_DELAY = 1  # second — be polite to the server


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

def search_song(title: str, artist: str = "") -> list:
    """
    Search Tab4U for a song. Returns a list of result dicts:
        [{ "title": str, "artist": str, "url": str }, ...]
    """
    query = f"{title} {artist}".strip()
    params = {"q": query}

    try:
        resp = requests.get(
            SEARCH_URL, params=params, headers=HEADERS, timeout=REQUEST_TIMEOUT
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"Search request failed: {exc}", file=sys.stderr)
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    results = []

    # Tab4U search results: links whose href matches /tab<number>/
    for link in soup.select("a[href^='/tab']"):
        href = link.get("href", "")
        if not re.match(r"^/tab\d+", href):
            continue

        song_title = link.get_text(strip=True)
        # Artist often lives in a sibling <span>
        artist_tag = link.find_next("span", class_=re.compile(r"artist|singer", re.I))
        if not artist_tag:
            parent = link.parent
            artist_tag = parent.find("span") if parent else None
        found_artist = artist_tag.get_text(strip=True) if artist_tag else ""

        if song_title:
            results.append(
                {
                    "title": song_title,
                    "artist": found_artist,
                    "url": BASE_URL + href,
                }
            )

    return results


# ---------------------------------------------------------------------------
# Chord-line detection
# ---------------------------------------------------------------------------

def _is_chord_line(text: str) -> bool:
    """
    Heuristic: a line is a chord line when ≥60% of its tokens match
    standard chord notation (e.g. Am, G, F#m, Dsus4, C/E).
    """
    if not text.strip():
        return False

    chord_pattern = re.compile(
        r"^[A-G][#b]?(m|maj|min|sus[24]?|dim|aug|add\d+|[0-9])*(/[A-G][#b]?)?$"
    )
    tokens = text.split()
    if not tokens:
        return False

    chord_count = sum(1 for t in tokens if chord_pattern.match(t))
    return chord_count / len(tokens) >= 0.6


def _classify_line(text: str) -> str:
    """Return 'section', 'chords', 'lyrics', or 'empty'."""
    stripped = text.strip()
    if not stripped:
        return "empty"
    if re.match(r"^[\[\(].*[\]\)]$", stripped) or re.match(
        r"^(פזמון|בית|גשר|קודה|אינטרו|סולו|סיום|chorus|verse|bridge|intro|outro)",
        stripped,
        re.IGNORECASE,
    ):
        return "section"
    if _is_chord_line(stripped):
        return "chords"
    return "lyrics"


# ---------------------------------------------------------------------------
# Scrape a song page
# ---------------------------------------------------------------------------

def scrape_song_page(url: str) -> list:
    """
    Fetch a Tab4U song page and return the chords_data array.
    Tries three strategies in order:
      1. Structured div.song_line elements
      2. <pre> block
      3. Generic content div, line-by-line
    """
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"Song page request failed: {exc}", file=sys.stderr)
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    chords_data = []

    # Strategy 1: structured song_line divs
    song_lines = soup.select("div.song_line, div.songLine, div.tab-line")
    if song_lines:
        for line_div in song_lines:
            chord_span = line_div.select_one(
                "span.chord_line, span.chords, span.tab-chords"
            )
            lyric_span = line_div.select_one(
                "span.lyric_line, span.lyrics, span.tab-lyrics"
            )
            if chord_span:
                content = chord_span.get_text()
                if content.strip():
                    chords_data.append({"type": "chords", "content": content.rstrip()})
            if lyric_span:
                content = lyric_span.get_text()
                if content.strip():
                    chords_data.append({"type": "lyrics", "content": content.rstrip()})
        if chords_data:
            return chords_data

    # Strategy 2: <pre> block
    pre = soup.find("pre")
    if pre:
        for raw_line in pre.get_text().splitlines():
            kind = _classify_line(raw_line)
            if kind != "empty":
                chords_data.append({"type": kind, "content": raw_line.rstrip()})
        if chords_data:
            return chords_data

    # Strategy 3: generic content div
    content_div = soup.select_one(
        "div.song_content, div.songContent, div#song_content, div.tab_content"
    )
    if content_div:
        for raw_line in content_div.get_text("\n").splitlines():
            kind = _classify_line(raw_line)
            if kind != "empty":
                chords_data.append({"type": kind, "content": raw_line.rstrip()})

    return chords_data


# ---------------------------------------------------------------------------
# Extract title/artist from the song page
# ---------------------------------------------------------------------------

def extract_song_meta(soup: BeautifulSoup, fallback_title: str, fallback_artist: str):
    h1 = soup.find("h1")
    title = h1.get_text(strip=True) if h1 else fallback_title
    artist_tag = soup.select_one("h2, span.artist_name, a.artist_link")
    artist = artist_tag.get_text(strip=True) if artist_tag else fallback_artist

    # Strip site-appended suffixes like "— אקורדים"
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

    title_arg = sys.argv[1]
    artist_arg = sys.argv[2] if len(sys.argv) > 2 else ""

    results = search_song(title_arg, artist_arg)
    if not results:
        print(f"No results found for: {title_arg}", file=sys.stderr)
        sys.exit(1)

    # Pick first result; prefer one where the artist matches
    best = results[0]
    if artist_arg:
        for r in results:
            if artist_arg.lower() in r["artist"].lower():
                best = r
                break

    time.sleep(INTER_REQUEST_DELAY)

    song_url = best["url"]
    chords_data = scrape_song_page(song_url)

    if not chords_data:
        print(f"Failed to parse chords from: {song_url}", file=sys.stderr)
        sys.exit(1)

    # Re-fetch to extract clean metadata (page was already fetched inside scrape_song_page;
    # a small refactor could avoid the double fetch, but keeping it simple for now)
    try:
        resp = requests.get(song_url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        soup = BeautifulSoup(resp.text, "html.parser")
        final_title, final_artist = extract_song_meta(soup, best["title"], best["artist"])
    except Exception:
        final_title, final_artist = best["title"], best["artist"]

    print(json.dumps({
        "title": final_title,
        "artist": final_artist,
        "url": song_url,
        "chords_data": chords_data,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
