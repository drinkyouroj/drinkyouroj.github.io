#!/usr/bin/env python3

from __future__ import annotations

import json
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path


FEED_URL = "https://drinkyouroj.substack.com/feed"
OUT_PATH = Path(__file__).resolve().parents[1] / "assets" / "substack.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def fetch(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "justinhearn.github.io feed fetcher (+https://github.com/drinkyouroj/justinhearn.github.io)",
            "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def text(el: ET.Element | None) -> str:
    if el is None or el.text is None:
        return ""
    return el.text.strip()


def parse_pubdate(pubdate: str) -> str:
    if not pubdate:
        return ""
    try:
        dt = parsedate_to_datetime(pubdate)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return ""


def parse_rss(xml_bytes: bytes, limit: int = 5) -> dict:
    root = ET.fromstring(xml_bytes)

    # Handle both RSS 2.0 and Atom-ish feeds. Substack typically uses RSS 2.0.
    channel = root.find("channel")
    if channel is None:
        # maybe Atom: <feed><entry>...
        entries = root.findall("{http://www.w3.org/2005/Atom}entry")
        posts = []
        for e in entries[:limit]:
            title = text(e.find("{http://www.w3.org/2005/Atom}title"))
            link_el = e.find("{http://www.w3.org/2005/Atom}link")
            url = (link_el.attrib.get("href", "") if link_el is not None else "").strip()
            updated = text(e.find("{http://www.w3.org/2005/Atom}updated"))
            posts.append({"title": title, "url": url, "date": updated})
        return {"source": FEED_URL, "updated_at": now_iso(), "posts": posts}

    title = text(channel.find("title"))
    link = text(channel.find("link"))

    items = channel.findall("item")
    posts = []
    for it in items[:limit]:
        posts.append(
            {
                "title": text(it.find("title")),
                "url": text(it.find("link")),
                "date": parse_pubdate(text(it.find("pubDate"))),
            }
        )

    return {
        "source": FEED_URL,
        "feed_title": title,
        "feed_url": link,
        "updated_at": now_iso(),
        "posts": posts,
    }


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def main() -> int:
    try:
        xml_bytes = fetch(FEED_URL)
        data = parse_rss(xml_bytes, limit=5)
        write_json(OUT_PATH, data)
        return 0
    except Exception as e:
        # If we can't update (network hiccup), keep the previous file if it exists.
        # Non-zero exit so CI can show it, but the site will still work.
        print(f"Failed to update Substack feed: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

