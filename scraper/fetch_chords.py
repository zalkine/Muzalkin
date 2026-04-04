#!/usr/bin/env python3
"""
scraper/fetch_chords.py

Fetch and parse a chord page from a supported source.
Uses cloudscraper to bypass Cloudflare on Tab4U.

Usage:
    python3 scraper/fetch_chords.py tab4u <url>

Outputs JSON array of ChordLine { type: "chords"|"lyrics"|"section", content }
to stdout.  Progress/debug logs go to stderr.
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
# Tab4U chord page parser
# ---------------------------------------------------------------------------

def fetch_tab4u(url: str) -> list[dict]:
    """
    Parse chords from a Tab4U song page.

    HTML structure inside #songContentTPL:
      <tr><td class="chords">Am  G</td></tr>   ← chord line
      <tr><td class="song">בימים האחרונים</td></tr> ← lyric line
      <tr><td class="songTag">Chorus</td></tr>  ← section header
    """
    scraper = make_scraper()
    print(f"[fetch_tab4u] fetching: {url}", file=sys.stderr)

    try:
        res = scraper.get(url, timeout=20)
    except Exception as e:
        print(f"[fetch_tab4u] request error: {e}", file=sys.stderr)
        return []

    if res.status_code != 200:
        print(f"[fetch_tab4u] HTTP {res.status_code}", file=sys.stderr)
        return []

    if "Just a moment" in res.text:
        print("[fetch_tab4u] Cloudflare challenge not bypassed", file=sys.stderr)
        return []

    soup = BeautifulSoup(res.text, "html.parser")
    tpl  = soup.find(id="songContentTPL")

    if not tpl:
        print("[fetch_tab4u] #songContentTPL not found", file=sys.stderr)
        return []

    result = []

    for row in tpl.find_all("tr"):
        # ── Chord cells ──
        chord_cells = row.find_all("td", class_="chords")
        if chord_cells:
            parts = []
            for cell in chord_cells:
                # Use separator="" and keep \xa0 (\u00a0) intact.
                # Tab4U pads chord cells with &nbsp; so that each chord's
                # character position in the string matches the character
                # position of the syllable it belongs to in the lyric below.
                # Replacing \xa0 → ' ' or joining cells with "  " destroys
                # that positional information.
                text = cell.get_text(separator="").rstrip()
                if text.strip():
                    parts.append(text)
            # Join with no separator — the trailing \u00a0 padding inside each
            # cell already encodes the gap to the next chord.
            content = "".join(parts)
            if content.strip():
                result.append({"type": "chords", "content": content})
            continue

        # ── Section header ──
        tag_cells = row.find_all("td", class_=re.compile(r"\bsongTag\b|\btag\b", re.I))
        if tag_cells:
            text = tag_cells[0].get_text().strip()
            if text:
                result.append({"type": "section", "content": text})
            continue

        # ── Lyric cells ──
        song_cells = row.find_all("td", class_="song")
        if song_cells:
            text = song_cells[0].get_text(separator=" ").replace("\xa0", " ").strip()
            if text:
                result.append({"type": "lyrics", "content": text})

    print(f"[fetch_tab4u] parsed {len(result)} lines", file=sys.stderr)
    return result


# ---------------------------------------------------------------------------
# Ultimate Guitar chord page parser
# ---------------------------------------------------------------------------

def fetch_ultimate_guitar(url: str) -> list[dict]:
    """
    Parse chords from an Ultimate Guitar chord/tab page.
    UG embeds JSON inside <div class="js-store" data-content="...">.
    Tab content uses [ch]CHORD[/ch] markers for chord names.
    """
    from html import unescape as html_unescape

    scraper = make_scraper()
    print(f"[fetch_ug] fetching: {url}", file=sys.stderr)

    try:
        res = scraper.get(url, timeout=20)
    except Exception as e:
        print(f"[fetch_ug] request error: {e}", file=sys.stderr)
        return []

    if res.status_code != 200:
        print(f"[fetch_ug] HTTP {res.status_code}", file=sys.stderr)
        return []

    soup  = BeautifulSoup(res.text, "html.parser")
    store = soup.find("div", class_="js-store")
    if not store:
        print("[fetch_ug] js-store div not found", file=sys.stderr)
        return []

    try:
        data     = json.loads(store.get("data-content", "{}"))
        tab_view = (data.get("store", {})
                        .get("page", {})
                        .get("data", {})
                        .get("tab_view", {}))
        content  = tab_view.get("wiki_tab", {}).get("content", "")
    except Exception as e:
        print(f"[fetch_ug] JSON parse error: {e}", file=sys.stderr)
        return []

    if not content:
        print("[fetch_ug] no tab content found", file=sys.stderr)
        return []

    print(f"[fetch_ug] content length={len(content)}", file=sys.stderr)
    return _parse_ug_content(html_unescape(content))


def _parse_ug_content(content: str) -> list[dict]:
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
            # Plain lyric line
            result.append({"type": "lyrics", "content": line.strip()})
            continue

        # Build chord string by replacing [ch]X[/ch] with X, preserving spacing
        chord_string = CHORD_IN_LINE.sub(lambda m: m.group(1), line)
        # Check if everything outside the chord tags is just whitespace
        lyric_text   = CHORD_IN_LINE.sub('', line).strip()

        if not lyric_text:
            # Chord-only line: preserve spacing for positional alignment
            result.append({"type": "chords", "content": chord_string.strip()})
        else:
            # Mixed line: output chord line then lyric line
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
        out = []

    print(json.dumps(out, ensure_ascii=False))
