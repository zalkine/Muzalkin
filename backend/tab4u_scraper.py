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

def _parse_tab4u_row(row) -> list:
    """
    Parse one row of Tab4U's #songContentTPL table.

    Tab4U interleaves chord cells and lyric cells in the SAME row:
        <td class="chords">D</td><td class="song">שוב </td>
        <td class="chords">Dmaj7</td><td class="song">אני מוצץ גבעול</td>

    We walk all cells left-to-right, pairing each chord with the lyric
    segment that immediately follows it.  This produces a rich 'line' entry:
        { type: 'line', segments: [{chord: 'D', lyric: 'שוב '},
                                   {chord: 'Dmaj7', lyric: 'אני מוצץ גבעול'}] }

    Rows that only have section-tag cells or only lyric cells (no chord
    above that line) fall back to the simpler legacy format.
    """
    # Section / tag rows
    tag_cells = row.find_all("td", class_=re.compile(r"\bsongTag\b|\btag\b", re.I))
    if tag_cells:
        text = tag_cells[0].get_text().strip()
        if text:
            return [{"type": "section", "content": text}]
        return []

    cells = row.find_all("td")
    has_chords = any("chords" in (c.get("class") or []) for c in cells)
    has_song   = any("song"   in (c.get("class") or []) for c in cells)

    if has_chords and has_song:
        # Rich interleaved format
        segments = []
        pending_chord = ""
        for cell in cells:
            classes = cell.get("class") or []
            raw = cell.get_text(separator=" ").replace("\xa0", " ")
            text = re.sub(r"  +", " ", raw).strip()
            if "chords" in classes:
                pending_chord = text
            elif "song" in classes:
                lyric = cell.get_text(separator="").replace("\xa0", " ")
                segments.append({"chord": pending_chord, "lyric": lyric})
                pending_chord = ""
        # Trailing chord with no following lyric — attach to last segment
        if pending_chord and segments:
            segments[-1]["chord"] = (segments[-1]["chord"] + "  " + pending_chord).strip()
        if any(s.get("chord") for s in segments):
            return [{"type": "line", "segments": segments}]
        full = "".join(s.get("lyric", "") for s in segments).strip()
        return [{"type": "lyrics", "content": full}] if full else []

    if has_chords:
        parts = [
            re.sub(r"  +", "  ", c.get_text(separator=" ").replace("\xa0", " ")).strip()
            for c in row.find_all("td", class_="chords")
        ]
        content = "  ".join(p for p in parts if p)
        return [{"type": "chords", "content": content}] if content else []

    if has_song:
        text = row.find("td", class_="song").get_text(separator=" ").replace("\xa0", " ").strip()
        return [{"type": "lyrics", "content": text}] if text else []

    return []


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
            result.extend(_parse_tab4u_row(row))
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

def fetch_by_url(url: str, fallback_title: str = "", fallback_artist: str = "") -> dict:
    """Scrape chords for a known song URL and return the full result dict."""
    chords_data = scrape_song_page(url)
    if not chords_data:
        return {}
    title, artist = _parse_tab4u_href(url)
    final_title  = title  or fallback_title
    final_artist = artist or fallback_artist
    if not final_artist:
        try:
            resp2 = make_scraper().get(url, timeout=REQUEST_TIMEOUT)
            soup2 = BeautifulSoup(resp2.text, "html.parser")
            _, final_artist = extract_song_meta(soup2, final_title, fallback_artist)
        except Exception:
            pass
    return {"title": final_title, "artist": final_artist, "url": url, "chords_data": chords_data}


def main():
    args = sys.argv[1:]

    # --search-only: return JSON array of search results without scraping chords
    if args and args[0] == "--search-only":
        args = args[1:]
        if not args:
            print("Usage: tab4u_scraper.py --search-only <title> [artist]", file=sys.stderr)
            sys.exit(1)
        title_arg  = args[0]
        artist_arg = args[1] if len(args) > 1 else ""
        results = search_song(title_arg, artist_arg)
        print(json.dumps(results, ensure_ascii=False))
        return

    # --url: scrape a specific song URL (title/artist are optional metadata hints)
    if args and args[0] == "--url":
        if len(args) < 2:
            print("Usage: tab4u_scraper.py --url <url> [title] [artist]", file=sys.stderr)
            sys.exit(1)
        song_url       = args[1]
        fallback_title  = args[2] if len(args) > 2 else ""
        fallback_artist = args[3] if len(args) > 3 else ""
        result = fetch_by_url(song_url, fallback_title, fallback_artist)
        if not result:
            print(f"Failed to scrape chords from: {song_url}", file=sys.stderr)
            sys.exit(1)
        print(json.dumps(result, ensure_ascii=False))
        return

    # Default: search + auto-pick best result + scrape chords
    if not args:
        print("Usage: tab4u_scraper.py <title> [artist]", file=sys.stderr)
        sys.exit(1)

    title_arg  = args[0]
    artist_arg = args[1] if len(args) > 1 else ""

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

    result = fetch_by_url(best["url"], best["title"] or title_arg, best["artist"] or artist_arg)
    if not result:
        print(f"Failed to parse chords from: {best['url']}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
