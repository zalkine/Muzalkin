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
                text = cell.get_text(separator=" ").replace("\xa0", " ").strip()
                # collapse multiple whitespace but keep single spaces between chords
                text = re.sub(r"  +", "  ", text)
                if text:
                    parts.append(text)
            content = "  ".join(parts)
            if content:
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
    else:
        print(f"[fetch_chords] Unknown source: {source}", file=sys.stderr)
        out = []

    print(json.dumps(out, ensure_ascii=False))
