#!/usr/bin/env python3
"""
scraper/search.py

Bypass-Cloudflare search for chord sources.
Called by Node.js backend via child_process.

Usage:
    python3 scraper/search.py tab4u  "שיר לשלום"
    python3 scraper/search.py ug     "wonderwall"

Outputs JSON array of { title, artist, source, url } to stdout.
"""

import sys
import json
import time
import re
from urllib.parse import urlencode, quote

import cloudscraper
from bs4 import BeautifulSoup

PAGE_SIZE = 30
MAX_PAGES = 1   # one page (30 results) is enough for search suggestions


def make_scraper():
    return cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "mobile": False}
    )


# ---------------------------------------------------------------------------
# Tab4U  (Hebrew + English)
# ---------------------------------------------------------------------------

def search_tab4u(query: str) -> list[dict]:
    scraper = make_scraper()
    results = []
    seen    = set()

    for page in range(MAX_PAGES):
        offset = page * PAGE_SIZE
        if offset == 0:
            url = f"https://www.tab4u.com/resultsSimple?tab=songs&q={quote(query)}"
        else:
            url = (
                f"https://www.tab4u.com/resultsSimple?"
                f"tab=songs&q={quote(query)}&n={PAGE_SIZE}&s={offset}"
            )

        if page > 0:
            time.sleep(1)

        try:
            res = scraper.get(url, timeout=15)
        except Exception as e:
            print(f"[tab4u] request error page {page+1}: {e}", file=sys.stderr)
            break

        if res.status_code != 200:
            print(f"[tab4u] HTTP {res.status_code} on page {page+1}", file=sys.stderr)
            break

        soup      = BeautifulSoup(res.text, "html.parser")
        new_count = 0

        for a in soup.find_all("a", href=re.compile(r"tabs/songs/")):
            href = a.get("href", "")
            if not href:
                continue

            title, artist = _parse_tab4u_href(href)

            if not title:
                # fallback: link text  →  "TITLE / ARTIST"
                text = re.sub(r"\s+", " ", a.get_text()).strip()
                if " / " in text:
                    parts  = text.split(" / ", 1)
                    title  = parts[0].strip()
                    artist = parts[1].strip()
                else:
                    title = text

            if not title:
                continue

            key = f"{title}|{artist}".lower()
            if key in seen:
                continue
            seen.add(key)
            new_count += 1

            results.append({
                "title" : title,
                "artist": artist,
                "source": "tab4u",
                "url"   : f"https://www.tab4u.com/{href}",
            })

        print(f"[tab4u] page {page+1}: {new_count} new (total {len(results)})", file=sys.stderr)
        if new_count == 0:
            break

    return results


def _parse_tab4u_href(href: str) -> tuple[str, str]:
    """Parse artist/title from  tabs/songs/ID_ARTIST_-_TITLE.html"""
    try:
        filename  = href.rstrip("/").rsplit("/", 1)[-1].replace(".html", "")
        without_id = re.sub(r"^\d+_", "", filename)
        decoded    = without_id.replace("_", " ")  # underscores are spaces
        # URL-percent-decode (handle %D7%A9 etc.) then HTML-entity decode
        from urllib.parse import unquote
        from html import unescape
        decoded = unescape(unquote(decoded))
        if " - " in decoded:
            sep    = decoded.index(" - ")
            artist = decoded[:sep].strip()
            title  = decoded[sep + 3:].strip()
            return title, artist
        return decoded.strip(), ""
    except Exception:
        return "", ""


# ---------------------------------------------------------------------------
# Ultimate Guitar  (English)
# ---------------------------------------------------------------------------

def search_ug(query: str) -> list[dict]:
    """
    UG embeds search results as JSON inside a <div class="js-store"> data-content
    attribute on the page.
    """
    scraper = make_scraper()
    url     = (
        "https://www.ultimate-guitar.com/search.php?"
        + urlencode({"search_type": "title", "value": query})
    )

    try:
        res = scraper.get(url, timeout=15)
    except Exception as e:
        print(f"[ug] request error: {e}", file=sys.stderr)
        return []

    if res.status_code != 200:
        print(f"[ug] HTTP {res.status_code}", file=sys.stderr)
        return []

    soup  = BeautifulSoup(res.text, "html.parser")
    store = soup.find("div", class_="js-store")
    if not store:
        print("[ug] js-store div not found", file=sys.stderr)
        return []

    try:
        data   = json.loads(store.get("data-content", "{}"))
        tabs   = (
            data.get("store", {})
                .get("page", {})
                .get("data", {})
                .get("results", [])
        )
    except Exception as e:
        print(f"[ug] JSON parse error: {e}", file=sys.stderr)
        return []

    results = []
    seen    = set()
    for tab in tabs:
        tab_type = tab.get("type", "")
        if tab_type not in ("Chords", "Tab", "chords", "tab"):
            continue
        title  = (tab.get("song_name") or "").strip()
        artist = (tab.get("artist_name") or "").strip()
        tab_url = tab.get("tab_url") or tab.get("href") or ""
        if not title:
            continue
        key = f"{title}|{artist}".lower()
        if key in seen:
            continue
        seen.add(key)
        results.append({"title": title, "artist": artist, "source": "ultimate_guitar", "url": tab_url})

    print(f"[ug] found {len(results)} results", file=sys.stderr)
    return results


# ---------------------------------------------------------------------------
# Cifraclub  (English + Spanish, accessible from cloud IPs)
# ---------------------------------------------------------------------------

def search_cifraclub(query: str) -> list[dict]:
    """
    Search cifraclub.com. Song links match /artist/song/ and live inside <li>
    elements that contain the title and artist as visible text.
    """
    scraper = make_scraper()
    url = f"https://www.cifraclub.com/pesquisa/?q={quote(query)}"

    try:
        res = scraper.get(url, timeout=15)
    except Exception as e:
        print(f"[cifraclub] request error: {e}", file=sys.stderr)
        return []

    if res.status_code != 200:
        print(f"[cifraclub] HTTP {res.status_code}", file=sys.stderr)
        return []

    soup    = BeautifulSoup(res.text, "html.parser")
    results = []
    seen    = set()
    # Song pages: exactly two path segments, both non-empty lowercase slugs.
    # Exclude known non-song first segments (categories, blog, artist index, etc.)
    SONG_HREF = re.compile(r'^/[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*/$')
    NON_SONG_PREFIX = re.compile(
        r'^/(blog|estilos|musico|artistas?|videos?|cifras?|bandas?|noticias?|letra|tags?|top|ranking)/'
    )
    SKIP_TEXT = {"opciones", "options", "cifra"}

    for a in soup.find_all("a", href=SONG_HREF):
        href = a.get("href", "")
        if href in seen:
            continue
        if NON_SONG_PREFIX.match(href):
            continue
        seen.add(href)

        li = a.find_parent("li")
        container = li if li else a.parent
        parts = [
            t.strip()
            for t in container.get_text("|").split("|")
            if t.strip() and not t.strip().isdigit()
            and t.strip().lower() not in SKIP_TEXT
        ]
        title  = parts[0] if len(parts) > 0 else ""
        artist = parts[1] if len(parts) > 1 else ""

        if not title or not artist:
            continue

        results.append({
            "title":  title,
            "artist": artist,
            "source": "cifraclub",
            "url":    f"https://www.cifraclub.com{href}",
        })

    print(f"[cifraclub] found {len(results)} results", file=sys.stderr)
    return results


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: search.py <source> <query>", file=sys.stderr)
        sys.exit(1)

    source = sys.argv[1].lower()
    query  = sys.argv[2]

    if source == "tab4u":
        out = search_tab4u(query)
    elif source in ("ug", "ultimate_guitar"):
        out = search_ug(query)
    elif source == "cifraclub":
        out = search_cifraclub(query)
    else:
        print(f"Unknown source: {source}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(out, ensure_ascii=False))
