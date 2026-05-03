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
        title = h1.get_text(separator=" ").strip()
        # Handle "אקורדים לשיר TITLE שלARTIST" prefix pattern (Tab4U Hebrew pages)
        m = re.match(r"^אקורדים לשיר\s+(.+?)\s+של.+$", title)
        if m:
            title = m.group(1).strip()
        else:
            # Strip site-appended suffixes like "שיר לשלום - אקורדים | Tab4U"
            title = re.sub(r"\s*[-–|]\s*אקורדים.*$", "", title, flags=re.I).strip()
            # English Tab4U: "Something Just Like This chords by Coldplay..."
            title = re.sub(r"\s+chords\b.*$",          "", title, flags=re.I).strip()
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
        artist = artist_tag.get_text(separator=" ").strip()
    else:
        # Fallback: first <h2> sometimes holds the artist name
        h2 = soup.find("h2")
        if h2:
            candidate = h2.get_text(separator=" ").strip()
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
    _debug_rows_printed = 0

    for row in tpl.find_all("tr"):

        # ── Chord cells ────────────────────────────────────────────────────
        chord_cells = row.find_all("td", class_="chords")
        if chord_cells:
            parts = []
            for cell in chord_cells:
                # Use \xa0 as separator so adjacent chord spans (English pages
                # wrap each chord name in its own <span>) are separated by a
                # non-breaking space rather than merged ("Em7D" → "Em7\xa0D").
                # For Hebrew pages the chord row is a single text node, so the
                # separator is never inserted and existing \xa0 alignment is kept.
                text = cell.get_text(separator="\xa0").strip("\r\n\t ")
                if text.strip():           # only append non-blank cells
                    parts.append(text)
            # Join cells, ensuring at least one \xa0 between adjacent chords
            # when the preceding cell has no trailing non-breaking space.
            # Without this, cells like "C" + "Am" → "CAm" instead of "C\xa0Am".
            pieces = []
            for idx, text in enumerate(parts):
                if idx > 0 and not parts[idx - 1].endswith('\xa0'):
                    pieces.append('\xa0')
                pieces.append(text)
            content = "".join(pieces)
            if content.strip():
                chords_data.append({"type": "chords", "content": content})
            else:
                # Chord cells found but content empty — log raw HTML to diagnose
                for cell in chord_cells[:2]:
                    print(f"[fetch_tab4u] EMPTY CHORD CELL html={cell.decode_contents()[:400]!r}",
                          file=sys.stderr)
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
            continue

        # ── Unrecognised row — log first 5 to help diagnose missing chords ─
        if _debug_rows_printed < 5:
            tds = row.find_all("td")
            if tds:
                classes = ['/'.join(td.get('class', ['?'])) for td in tds]
                sample  = row.decode_contents()[:300].replace('\n', ' ')
                print(f"[fetch_tab4u] UNKNOWN ROW td-classes={classes} html={sample!r}",
                      file=sys.stderr)
                _debug_rows_printed += 1

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
# Cifraclub chord page parser
# ---------------------------------------------------------------------------

# Chord word pattern: Am, G#, Fmaj7, Dsus4, A7(4), D4, Cadd9, C/E, C7M, GM,
# Am7b5 (half-diminished), etc.
_CHORD_WORD_RE = re.compile(
    r'^[A-G][#b]?'
    r'(?:m(?:aj\d*)?|M(?:aj\d*)?|min|sus[24]?|dim|aug|add\d+|b5|#5|\d+M?)*'
    r'(?:\([^)]*\))?'        # optional (4), (9), etc.
    r'(?:/[A-G][#b]?)?$'
)

# Guitar tab line: starts with a string name (E B G D A e) followed by |
_TAB_LINE_RE = re.compile(r'^[EBGDAe]\s*\|')

# Tokens that are allowed on a chord line but are not chord names:
# separators (/ | -) and repeat markers (2x, x2, (2x), (x2))
_NON_CHORD_TOKEN_RE = re.compile(
    r'^[/|\\,;-]$'
    r'|^\(?\d+[xX]\)?$'
    r'|^\(?[xX]\d+\)?$',
    re.I,
)


def _is_chord_line(line: str) -> bool:
    """
    Return True if the line is a chord line.
    Ignores repeat markers (2x, x2) and separator symbols (/ |) so that lines
    like 'Em7  D  Cadd9  G  (2x)' or 'Am / G / Em' are not misclassified as lyrics.
    """
    words = line.split()
    if not words:
        return False
    chord_words = [w for w in words if not _NON_CHORD_TOKEN_RE.match(w)]
    return bool(chord_words) and all(_CHORD_WORD_RE.match(w) for w in chord_words)


# Map common Spanish/Portuguese section names to English
_SECTION_MAP = [
    (re.compile(r'^dedilhado\b',          re.I), 'Fingerpicking'),
    (re.compile(r'^pré-refrão\b',         re.I), 'Pre-Chorus'),
    (re.compile(r'^pre-refrão\b',         re.I), 'Pre-Chorus'),
    (re.compile(r'^pré-chorus\b',         re.I), 'Pre-Chorus'),
    (re.compile(r'^pre-chorus\b',         re.I), 'Pre-Chorus'),
    (re.compile(r'^refrão\b',             re.I), 'Chorus'),
    (re.compile(r'^estribillo\b',         re.I), 'Chorus'),
    (re.compile(r'^coro\b',               re.I), 'Chorus'),
    (re.compile(r'^verso\b',              re.I), 'Verse'),
    (re.compile(r'^ponte\b',              re.I), 'Bridge'),
    (re.compile(r'^puente\b',             re.I), 'Bridge'),
    (re.compile(r'^interlúdio\b',         re.I), 'Interlude'),
    (re.compile(r'^interludio\b',         re.I), 'Interlude'),
    (re.compile(r'^first\s+part\b',       re.I), 'Verse 1'),
    (re.compile(r'^second\s+part\b',      re.I), 'Verse 2'),
    (re.compile(r'^third\s+part\b',       re.I), 'Verse 3'),
    (re.compile(r'^fourth\s+part\b',      re.I), 'Verse 4'),
]


def _translate_section(name: str) -> str:
    for pattern, english in _SECTION_MAP:
        if pattern.match(name):
            return english
    return name.capitalize()


def _parse_cifraclub_content(content: str) -> list:
    """
    Parse Cifraclub pre-tag content (positional chord-above-lyric format).

    Em7           G          ← chord line (chord names + spaces for alignment)
        Today is gonna       ← lyric line (leading spaces preserved for position)
    [Chorus]                 ← section header
    E|-0--3--...             ← guitar tab line  (type: 'tab')
    """
    result = []

    for raw_line in content.splitlines():
        line = raw_line.rstrip()

        # Section header: [Verse 1], [Chorus], [Bridge], etc.
        sec = re.match(r'^\[([^\]]+)\]', line)
        if sec:
            section_text = _translate_section(sec.group(1).strip())
            result.append({"type": "section", "content": section_text})
            rest = line[sec.end():].strip()
            if rest:
                if _is_chord_line(rest):
                    result.append({"type": "chords", "content": rest})
                else:
                    result.append({"type": "lyrics", "content": rest})
            continue

        if not line.strip():
            continue

        # Guitar tab line: E|-0--3--  B|-1--3-- etc.
        if _TAB_LINE_RE.match(line.strip()):
            result.append({"type": "tab", "content": line})
            continue

        if _is_chord_line(line):
            # Preserve full line (with spacing) so positions align with lyric below
            result.append({"type": "chords", "content": line})
        else:
            result.append({"type": "lyrics", "content": line})

    # Post-process: single lyrics lines that appear within a tab block are
    # technique instructions (e.g. "Parte 2 de 3"), not song lyrics.
    # Rule: mark a lyrics line as tab if a tab line appears within 5 lines after it
    # AND no other lyrics line appears in between (i.e. it's an isolated instruction).
    for i in range(len(result)):
        if result[i]['type'] != 'lyrics':
            continue
        tab_nearby = False
        other_lyric_before_tab = False
        for j in range(i + 1, min(len(result), i + 6)):
            t = result[j]['type']
            if t == 'tab':
                tab_nearby = True
                break
            if t == 'lyrics':
                other_lyric_before_tab = True
                break
        if tab_nearby and not other_lyric_before_tab:
            result[i] = {'type': 'tab', 'content': result[i]['content']}

    # Strip common leading whitespace from chord+lyric pairs to remove
    # cifraclub page-level indentation while preserving positional alignment.
    # For standalone chord-only lines, strip all leading whitespace.
    i = 0
    while i < len(result):
        if result[i]['type'] == 'chords':
            chord_content = result[i]['content']
            if i + 1 < len(result) and result[i + 1]['type'] == 'lyrics':
                lyric_content = result[i + 1]['content']
                chord_indent = len(chord_content) - len(chord_content.lstrip(' '))
                lyric_indent = len(lyric_content) - len(lyric_content.lstrip(' '))
                strip_n = min(chord_indent, lyric_indent)
                if strip_n > 0:
                    result[i]     = {'type': 'chords', 'content': chord_content[strip_n:]}
                    result[i + 1] = {'type': 'lyrics', 'content': lyric_content[strip_n:]}
                i += 2
            else:
                result[i] = {'type': 'chords', 'content': chord_content.lstrip()}
                i += 1
        else:
            i += 1

    return result


def fetch_cifraclub(url: str) -> dict:
    """
    Fetch and parse a Cifraclub chord page.

    Returns { title, artist, language, source, chords_data } or {} on failure.
    Chord content is in <pre id="js-cifra-content"> as positional plain text.
    """
    scraper = make_scraper()
    print(f"[fetch_cifraclub] fetching: {url}", file=sys.stderr)

    try:
        res = scraper.get(url, timeout=20)
    except Exception as e:
        print(f"[fetch_cifraclub] request error: {e}", file=sys.stderr)
        return {}

    if res.status_code != 200:
        print(f"[fetch_cifraclub] HTTP {res.status_code}", file=sys.stderr)
        return {}

    soup = BeautifulSoup(res.text, "html.parser")

    # Title and artist from og:title  →  "Song - Artist - CHORDS"
    title, artist = "", ""
    og = soup.find("meta", property="og:title")
    if og:
        raw = og.get("content", "")
        parts = [p.strip() for p in raw.split(" - ")]
        # Drop trailing "CHORDS" / "Tabs" suffix
        parts = [p for p in parts if p.upper() not in ("CHORDS", "TABS", "CIFRA", "ACORDES")]
        if len(parts) >= 2:
            title, artist = parts[0], parts[1]
        elif parts:
            title = parts[0]

    pre = soup.find("pre", id="js-cifra-content") or soup.find("pre")
    if not pre:
        print("[fetch_cifraclub] chord pre not found", file=sys.stderr)
        return {}

    chords_data = _parse_cifraclub_content(pre.get_text())

    if not chords_data:
        return {}

    print(f"[fetch_cifraclub] parsed {len(chords_data)} lines, title='{title}', artist='{artist}'",
          file=sys.stderr)

    return {
        "title":       title,
        "artist":      artist,
        "language":    _detect_language(chords_data),
        "source":      "cifraclub",
        "chords_data": chords_data,
    }


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
    elif source == "cifraclub":
        out = fetch_cifraclub(url)
    else:
        print(f"[fetch_chords] Unknown source: {source}", file=sys.stderr)
        sys.exit(1)

    if not out:
        print(f"[fetch_chords] Failed to fetch from {url}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(out, ensure_ascii=False))
