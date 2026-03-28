#!/usr/bin/env python3
"""
Ultimate Guitar English chord scraper.

Usage:
    python3 ultimate_guitar_scraper.py "<title>" "<artist>"
    python3 ultimate_guitar_scraper.py "hotel california"
    python3 ultimate_guitar_scraper.py "blackbird" "beatles"

Output (stdout): JSON object
    {
        "title":       "Hotel California",
        "artist":      "Eagles",
        "url":         "https://tabs.ultimate-guitar.com/tab/...",
        "chords_data": [
            { "type": "section", "content": "Verse" },
            { "type": "chords",  "content": "Am  E  G  D" },
            { "type": "lyrics",  "content": "On a dark desert highway" },
            ...
        ]
    }

Errors are written to stderr; exit code 1 on failure.
Respects 1-second delay between requests as per project rules.

Strategy:
  Ultimate Guitar embeds all page data in a <div class="js-store" data-content="...">
  attribute as HTML-escaped JSON. We parse that JSON to extract search results
  and tab content without needing JavaScript rendering.
"""

import html
import json
import re
import sys
import time
import urllib.parse

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://www.ultimate-guitar.com/",
}

BASE_URL = "https://www.ultimate-guitar.com"
SEARCH_URL = BASE_URL + "/search.php"
REQUEST_TIMEOUT = 20  # seconds
INTER_REQUEST_DELAY = 1  # second — be polite to the server


# ---------------------------------------------------------------------------
# Helpers: extract UG's embedded JSON store
# ---------------------------------------------------------------------------

def _extract_js_store(html_text: str) -> dict:
    """
    UG embeds page state in: <div class="js-store" data-content="...">
    The data-content value is HTML-escaped JSON.
    Returns the parsed dict, or {} on failure.
    """
    soup = BeautifulSoup(html_text, "html.parser")
    store_div = soup.find("div", class_="js-store")
    if not store_div:
        return {}

    raw = store_div.get("data-content", "")
    if not raw:
        return {}

    try:
        return json.loads(html.unescape(raw))
    except json.JSONDecodeError:
        return {}


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

def search_song(title: str, artist: str = "") -> list:
    """
    Search Ultimate Guitar for a song. Returns list of result dicts:
        [{ "title": str, "artist": str, "url": str, "type": str }, ...]
    Filters to 'Chords' type tabs only.
    """
    query = f"{title} {artist}".strip()
    params = {
        "search_type": "title",
        "value": query,
    }

    try:
        resp = requests.get(
            SEARCH_URL, params=params, headers=HEADERS, timeout=REQUEST_TIMEOUT
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"UG search request failed: {exc}", file=sys.stderr)
        return []

    store = _extract_js_store(resp.text)

    # Navigate into the store: store.page.data.results
    try:
        results_raw = store["store"]["page"]["data"]["results"]
    except (KeyError, TypeError):
        print("UG: could not find results in page store", file=sys.stderr)
        return []

    results = []
    for item in results_raw:
        tab_type = item.get("type", "")
        # Only accept Chords tabs (not Guitar Pro, Bass, etc.)
        if tab_type not in ("Chords", "chords"):
            continue

        song_name = item.get("song_name", "") or item.get("song_name_t", "")
        artist_name = item.get("artist_name", "") or item.get("artist_name_t", "")
        tab_url = item.get("tab_url", "")

        if song_name and tab_url:
            results.append({
                "title": song_name,
                "artist": artist_name,
                "url": tab_url,
            })

    return results


# ---------------------------------------------------------------------------
# Chord-line detection (same heuristic as tab4u_scraper)
# ---------------------------------------------------------------------------

def _is_chord_line(text: str) -> bool:
    """
    Returns True when ≥60% of space-separated tokens match chord notation.
    Supports: Am, G, F#m, Dsus4, C/E, Cadd9, Gmaj7, etc.
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
        r"^(verse|chorus|bridge|intro|outro|pre.?chorus|interlude|solo|coda)",
        stripped,
        re.IGNORECASE,
    ):
        return "section"
    if _is_chord_line(stripped):
        return "chords"
    return "lyrics"


# ---------------------------------------------------------------------------
# Scrape a tab page
# ---------------------------------------------------------------------------

def scrape_tab_page(url: str) -> dict:
    """
    Fetch a UG tab page and extract chords_data + metadata.
    Returns { title, artist, url, chords_data } or {} on failure.
    """
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"UG tab page request failed: {exc}", file=sys.stderr)
        return {}

    store = _extract_js_store(resp.text)

    # The tab content lives at store.page.data.tab_view.wiki_tab.content
    try:
        tab_data = store["store"]["page"]["data"]
        tab_view = tab_data.get("tab_view", {})
        wiki_tab = tab_view.get("wiki_tab", {})
        content = wiki_tab.get("content", "")
        tab_meta = tab_data.get("tab", {})
        title = tab_meta.get("song_name", "") or tab_meta.get("song_name_t", "")
        artist = tab_meta.get("artist_name", "") or tab_meta.get("artist_name_t", "")
    except (KeyError, TypeError):
        content = ""
        title = ""
        artist = ""

    if not content:
        # Fallback: look for [tab] blocks in raw HTML
        soup = BeautifulSoup(resp.text, "html.parser")
        pre = soup.find("pre")
        content = pre.get_text() if pre else ""

    if not content:
        return {}

    chords_data = _parse_ug_content(content)

    return {
        "title": title,
        "artist": artist,
        "url": url,
        "chords_data": chords_data,
    }


# ---------------------------------------------------------------------------
# Parse UG [tab] content format
# ---------------------------------------------------------------------------

def _parse_ug_content(content: str) -> list:
    """
    UG chord tabs use markers like [ch]Am[/ch] for inline chords and
    [tab]...[/tab] for chord+lyric blocks. Section headers are in [Verse], etc.

    We strip the markup and classify each line.
    """
    # Remove [tab] / [/tab] wrappers
    content = re.sub(r"\[/?tab\]", "", content)

    # Strip [ch]...[/ch] inline chord markers FIRST (keep the chord text)
    # Must happen before the general [..] stripper below, otherwise
    # [ch]Am[/ch] gets mangled to chAm/ch and never recognised as chords.
    content = re.sub(r"\[ch\](.*?)\[/ch\]", r"\1", content)

    # Extract section markers like [Verse 1], [Chorus]
    # Replace them with the bare text on their own line
    content = re.sub(r"\[([^\]]+)\]", r"\1", content)

    chords_data = []
    for raw_line in content.splitlines():
        kind = _classify_line(raw_line)
        if kind == "empty":
            continue
        chords_data.append({"type": kind, "content": raw_line.rstrip()})

    return chords_data


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print("Usage: ultimate_guitar_scraper.py <title> [artist]", file=sys.stderr)
        sys.exit(1)

    title_arg = sys.argv[1]
    artist_arg = sys.argv[2] if len(sys.argv) > 2 else ""

    results = search_song(title_arg, artist_arg)
    if not results:
        print(f"No UG results found for: {title_arg}", file=sys.stderr)
        sys.exit(1)

    # Pick best match: prefer exact artist match if provided
    best = results[0]
    if artist_arg:
        for r in results:
            if artist_arg.lower() in r["artist"].lower():
                best = r
                break

    time.sleep(INTER_REQUEST_DELAY)

    result = scrape_tab_page(best["url"])

    if not result or not result.get("chords_data"):
        print(f"Failed to parse chords from: {best['url']}", file=sys.stderr)
        sys.exit(1)

    # Fill metadata gaps with search result data
    if not result.get("title"):
        result["title"] = best["title"]
    if not result.get("artist"):
        result["artist"] = best["artist"]

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
