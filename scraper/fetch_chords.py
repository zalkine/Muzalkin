#!/usr/bin/env python3
"""
scraper/fetch_chords.py

Fetch and parse a chord page from a supported source.
Uses cloudscraper to bypass Cloudflare on Tab4U.

Usage:
    python3 scraper/fetch_chords.py tab4u <url>
    python3 scraper/fetch_chords.py ultimate_guitar <url>

Outputs a JSON object to stdout:
    {
        "title":      "שיר לשלום",
        "artist":     "להקת הנח\"ל",
        "language":   "he",
        "source":     "tab4u",
        "chords_data": [
            { "type": "section",  "content": "פזמון" },
            { "type": "chords",   "content": "Am\u00a0\u00a0\u00a0G\u00a0\u00a0F" },
            { "type": "lyrics",   "content": "תנו לשמש לעלות" }
        ]
    }

IMPORTANT — chord spacing:
    Tab4U pads chord cells with &nbsp; (\u00a0) so each chord's character
    position aligns with the syllable it sits above in the lyric row.
    We intentionally preserve \u00a0 in chord content strings.
    Only actual newline/tab characters are stripped from cell text.

Errors are written to stderr; exit code 1 on failure.
"""

import sys
import json
import re

import cloudscraper
from bs4 import BeautifulSoup


def make_scraper():
    return cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "mobile": False}
    )


# ---------------------------------------------------------------------------
# Language detection helper
# ---------------------------------------------------------------------------

_HEBREW_RE = re.compile(r'[\u05d0-\u05ea]')


def _detect_language(chords_data: list) -> str:
    """
    Detect language from chords_data by checking for Hebrew characters in lyrics.
    Returns 'he' if Hebrew is found, 'en' otherwise.
    """
    for line in chords_data:
        if line.get("type") == "lyrics" and _HEBREW_RE.search(line.get("content", "")):
            return "he"
    return "en"


# ---------------------------------------------------------------------------
# Tab4U chord page parser
# ---------------------------------------------------------------------------

def fetch_tab4u(url: str) -> dict:
    """
    Fetch and parse a Tab4U song page.

    Returns:
        {
            "title":      str,
            "artist":     str,
            "language":   "he" | "en",
            "source":     "tab4u",
            "chords_data": [ { "type": "chords"|"lyrics"|"section", "content": str } ]
        }
        or {} on failure.

    HTML structure inside #songContentTPL:
        <tr><td class="chords">Am\xa0\xa0\xa0G</td></tr>   ← chord row
        <tr><td class="song">בימים האחרונים</td></tr>       ← lyric row
        <tr><td class="songTag">Chorus</td></tr>             ← section header
    """
    scraper = make_scraper()
    print(f"[fetch_tab4u] fetching: {url}", file=sys.stderr)

    try:
        res = scraper.get(url, timeout=20)
    except Exception as e:
        print(f"[fetch_tab4u] request error: {e}", file=sys.stderr)
        return {}

    if res.status_code != 200:
        print(f"[fetch_tab4u] HTTP {res.status_code}", file=sys.stderr)
        return {}

    if "Just a moment" in res.text:
        print("[fetch_tab4u] Cloudflare challenge not bypassed", file=sys.stderr)
        return {}

    soup = BeautifulSoup(res.text, "html.parser")

    # ── Extract title ──────────────────────────────────────────────────────
    title = ""
    h1 = soup.find("h1")
    if h1:
        title = h1.get_text(strip=True)
        # Handle "אקורדים לשיר TITLE שלARTIST" prefix pattern (Tab4U Hebrew pages)
        m = re.match(r"^אקורדים לשיר\s+(.+?)\s+של.+$", title)
        if m:
            title = m.group(1).strip()
        else:
            # Strip site-appended suffixes like "שיר לשלום - אקורדים | Tab4U"
            title = re.sub(r"\s*[-–|]\s*אקורדים.*$", "", title, flags=re.I).strip()
            title = re.sub(r"\s*[-–|]\s*chords.*$",   "", title, flags=re.I).strip()
            title = re.sub(r"\s*\|.*$",                "", title).strip()

    # ── Extract artist ─────────────────────────────────────────────────────
    artist = ""
    artist_tag = soup.select_one(
        "span.artist_name, a.artist_link, "
        "span[itemprop='byArtist'], a[itemprop='byArtist'], "
        "h2.moreSongH2"
    )
    if artist_tag:
        artist = artist_tag.get_text(strip=True)
    else:
        # Fallback: first <h2> sometimes holds the artist name
        h2 = soup.find("h2")
        if h2:
            candidate = h2.get_text(strip=True)
            # Ignore h2s that look like section headers (e.g. "פזמון")
            if candidate and not re.match(
                r"^(פזמון|בית|גשר|קודה|אינטרו|chorus|verse|bridge|intro)", candidate, re.I
            ):
                artist = candidate

    # Strip trailing navigation suffixes like "קלפטר- שירים נוספים"
    if artist:
        artist = re.sub(r"[-–]\s*(שירים נוספים|עוד שירים|אקורדים).*$", "", artist).strip()

    # ── Parse chord content ────────────────────────────────────────────────
    tpl = soup.find(id="songContentTPL")
    if not tpl:
        print("[fetch_tab4u] #songContentTPL not found", file=sys.stderr)
        return {}

    chords_data = []

    for row in tpl.find_all("tr"):

        # ── Chord cells ────────────────────────────────────────────────────
        chord_cells = row.find_all("td", class_="chords")
        if chord_cells:
            parts = []
            for cell in chord_cells:
                # Strip only ASCII whitespace (\r\n\t\x20), NOT \xa0.
                # \xa0 (non-breaking space) is used by Tab4U to position each
                # chord above its matching syllable — must be preserved.
                text = cell.get_text(separator="").strip("\r\n\t ")
                if text.strip():           # only append non-blank cells
                    parts.append(text)
            # Join with no separator — trailing \xa0 inside each cell already
            # encodes the gap to the next chord.
            content = "".join(parts)
            if content.strip():
                chords_data.append({"type": "chords", "content": content})
            continue

        # ── Section header ─────────────────────────────────────────────────
        tag_cells = row.find_all("td", class_=re.compile(r"\bsongTag\b|\btag\b", re.I))
        if tag_cells:
            text = tag_cells[0].get_text().strip()
            if text:
                chords_data.append({"type": "section", "content": text})
            continue

        # ── Lyric cells ────────────────────────────────────────────────────
        song_cells = row.find_all("td", class_="song")
        if song_cells:
            # Lyrics use regular spaces — \xa0 → ' ' is intentional here
            text = song_cells[0].get_text(separator=" ").replace("\xa0", " ").strip()
            if text:
                chords_data.append({"type": "lyrics", "content": text})

    print(f"[fetch_tab4u] parsed {len(chords_data)} lines, title='{title}', artist='{artist}'",
          file=sys.stderr)

    if not chords_data:
        return {}

    return {
        "title":       title,
        "artist":      artist,
        "language":    _detect_language(chords_data),
        "source":      "tab4u",
        "chords_data": chords_data,
    }


# ---------------------------------------------------------------------------
# Ultimate Guitar chord page parser
# ---------------------------------------------------------------------------

def fetch_ultimate_guitar(url: str) -> dict:
    """
    Parse chords from an Ultimate Guitar chord/tab page.
    UG embeds all data as JSON inside <div class="js-store" data-content="...">.

    Returns:
        { "title", "artist", "language", "source", "chords_data" }
        or {} on failure.
    """
    from html import unescape as html_unescape

    scraper = make_scraper()
    print(f"[fetch_ug] fetching: {url}", file=sys.stderr)

    try:
        res = scraper.get(url, timeout=20)
    except Exception as e:
        print(f"[fetch_ug] request error: {e}", file=sys.stderr)
        return {}

    if res.status_code != 200:
        print(f"[fetch_ug] HTTP {res.status_code}", file=sys.stderr)
        return {}

    soup  = BeautifulSoup(res.text, "html.parser")
    store = soup.find("div", class_="js-store")
    if not store:
        print("[fetch_ug] js-store div not found", file=sys.stderr)
        return {}

    try:
        data     = json.loads(store.get("data-content", "{}"))
        page_data = (data.get("store", {})
                         .get("page", {})
                         .get("data", {}))
        tab_view  = page_data.get("tab_view", {})
        tab_meta  = tab_view.get("tab", {}) or page_data.get("tab", {})
        content   = tab_view.get("wiki_tab", {}).get("content", "")
    except Exception as e:
        print(f"[fetch_ug] JSON parse error: {e}", file=sys.stderr)
        return {}

    if not content:
        print("[fetch_ug] no tab content found", file=sys.stderr)
        return {}

    # Extract title and artist from the embedded JSON
    title  = (tab_meta.get("song_name")   or "").strip()
    artist = (tab_meta.get("artist_name") or "").strip()

    print(f"[fetch_ug] content length={len(content)}, title='{title}', artist='{artist}'",
          file=sys.stderr)

    chords_data = _parse_ug_content(html_unescape(content))

    if not chords_data:
        return {}

    return {
        "title":       title,
        "artist":      artist,
        "language":    _detect_language(chords_data),
        "source":      "ultimate_guitar",
        "chords_data": chords_data,
    }


def _parse_ug_content(content: str) -> list:
    """
    Parse UG tab content with [ch]CHORD[/ch] markers.

    Rules:
      - Lines that match [verse …], [chorus], etc.  → section
      - Lines whose non-whitespace content is entirely [ch]…[/ch] tokens → chords
        The chord string preserves spacing so positions align with the lyric below.
      - Lines with [ch] tokens mixed with real text → separate chord + lyric lines
      - Plain text lines  → lyrics
    """
    content = re.sub(r'\[/?tab\]', '', content)
    CHORD_IN_LINE = re.compile(r'\[ch\](.*?)\[/ch\]')

    result = []

    for raw_line in content.splitlines():
        line = raw_line.rstrip()

        # Section markers: [verse 1], [chorus], [bridge], etc.
        sec = re.match(
            r'^\[((verse|chorus|bridge|intro|outro|pre-chorus|interlude|solo)[^\]]*)\]$',
            line, re.I)
        if sec:
            result.append({"type": "section", "content": sec.group(1).strip().capitalize()})
            continue

        if not line.strip():
            continue

        chords_found = CHORD_IN_LINE.findall(line)
        if not chords_found:
            result.append({"type": "lyrics", "content": line.strip()})
            continue

        # Build chord string by replacing [ch]X[/ch] with X, preserving spacing
        chord_string = CHORD_IN_LINE.sub(lambda m: m.group(1), line)
        lyric_text   = CHORD_IN_LINE.sub('', line).strip()

        if not lyric_text:
            # Chord-only line: preserve spacing for positional alignment
            result.append({"type": "chords", "content": chord_string.strip()})
        else:
            # Mixed line: emit chord line then lyric line
            result.append({"type": "chords", "content": chord_string.strip()})
            result.append({"type": "lyrics",  "content": lyric_text})

    print(f"[fetch_ug] parsed {len(result)} lines", file=sys.stderr)
    return result


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: fetch_chords.py <source> <url>", file=sys.stderr)
        sys.exit(1)

    source = sys.argv[1].lower()
    url    = sys.argv[2]

    if source == "tab4u":
        out = fetch_tab4u(url)
    elif source in ("ultimate_guitar", "ug"):
        out = fetch_ultimate_guitar(url)
    else:
        print(f"[fetch_chords] Unknown source: {source}", file=sys.stderr)
        sys.exit(1)

    if not out:
        print(f"[fetch_chords] Failed to fetch from {url}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(out, ensure_ascii=False))
