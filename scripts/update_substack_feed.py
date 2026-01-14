#!/usr/bin/env python3

from __future__ import annotations

import json
import random
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path


FEED_URL = "https://drinkyouroj.substack.com/feed"
ARCHIVE_URL_TEMPLATE = "https://drinkyouroj.substack.com/api/v1/archive?limit={limit}"
JINA_PROXY_TEMPLATE = "https://r.jina.ai/http://{url}"
OUT_PATH = Path(__file__).resolve().parents[1] / "assets" / "substack.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def fetch(url: str, max_retries: int = 3) -> bytes:
    """Fetch URL using curl (better Cloudflare handling) with retry logic."""
    last_error = None
    
    for attempt in range(max_retries):
        try:
            # Use curl which handles Cloudflare better than urllib
            # -L: follow redirects
            # -s: silent mode (no progress)
            # -S: show errors even in silent mode
            # -f: fail on HTTP errors
            # --max-time: timeout
            # --retry: automatic retries for transient errors
            # --retry-delay: delay between retries
            # --user-agent: browser-like user agent
            # --header: additional headers
            cmd = [
                "curl",
                "-L",  # Follow redirects
                "-s",  # Silent
                "-S",  # Show errors
                "-f",  # Fail on HTTP errors
                "--max-time", "30",
                "--retry", "2",
                "--retry-delay", "1",
                "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "--header", "Accept: application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1",
                "--header", "Accept-Language: en-US,en;q=0.9",
                "--header", "Referer: https://drinkyouroj.substack.com/",
                "--header", "DNT: 1",
                "--header", "Connection: keep-alive",
                "--header", "Upgrade-Insecure-Requests: 1",
                url,
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=35,
                check=False
            )
            
            if result.returncode != 0:
                error_msg = result.stderr.decode('utf-8', errors='ignore')
                if "403" in error_msg or result.returncode == 22:  # curl exit code 22 = HTTP error
                    if attempt < max_retries - 1:
                        wait_time = (2 ** attempt) + (random.random() * 2)
                        print(f"Got 403 Forbidden, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})...", file=sys.stderr)
                        time.sleep(wait_time)
                        continue
                    raise urllib.error.HTTPError(url, 403, f"curl failed: {error_msg}", None, None)
                raise RuntimeError(f"curl failed with code {result.returncode}: {error_msg}")
            
            data = result.stdout
            
            # Check if we got HTML instead of XML (Cloudflare challenge page)
            if data.startswith(b"<!DOCTYPE") or data.startswith(b"<html") or b"Just a moment" in data:
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) + (random.random() * 2)
                    print(f"Received Cloudflare challenge page, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})...", file=sys.stderr)
                    time.sleep(wait_time)
                    continue
                raise urllib.error.HTTPError(
                    url, 403, "Received Cloudflare challenge page instead of XML",
                    None, None
                )
            
            # Verify it's XML or JSON
            stripped = data.lstrip()
            if not (
                stripped.startswith(b"<?xml")
                or stripped.startswith(b"<rss")
                or stripped.startswith(b"<feed")
                or stripped.startswith(b"{")
                or stripped.startswith(b"[")
            ):
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) + (random.random() * 2)
                    print(
                        f"Received non-XML/JSON response, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})...",
                        file=sys.stderr,
                    )
                    time.sleep(wait_time)
                    continue
                raise ValueError(f"Response is not XML/JSON: {data[:200].decode('utf-8', errors='ignore')}")
            
            return data
            
        except subprocess.TimeoutExpired:
            last_error = TimeoutError("Request timed out")
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) + (random.random() * 2)
                print(f"Request timed out, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})...", file=sys.stderr)
                time.sleep(wait_time)
                continue
            raise
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) + (random.random() * 2)
                print(f"Request failed: {e}, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})...", file=sys.stderr)
                time.sleep(wait_time)
                continue
            raise
    
    # If we get here, all retries failed
    raise last_error if last_error else RuntimeError("All retry attempts failed")


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


def extract_cover_image(item: ET.Element) -> str:
    """Extract cover image from enclosure tag or content:encoded."""
    # First try enclosure tag (most common for Substack)
    enclosure = item.find("enclosure")
    if enclosure is not None:
        url = enclosure.attrib.get("url", "").strip()
        if url:
            return url
    
    # Fallback: try to extract from content:encoded HTML
    content_encoded = item.find("{http://purl.org/rss/1.0/modules/content/}encoded")
    if content_encoded is not None and content_encoded.text:
        # Look for first image in content
        img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', content_encoded.text)
        if img_match:
            return img_match.group(1)
    
    return ""


def parse_rss(xml_bytes: bytes, limit: int = 6) -> dict:
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
            summary = text(e.find("{http://www.w3.org/2005/Atom}summary"))
            posts.append({
                "title": title,
                "subtitle": summary,
                "url": url,
                "date": updated,
                "cover_image": "",
            })
        return {"source": FEED_URL, "updated_at": now_iso(), "posts": posts}

    title = text(channel.find("title"))
    link = text(channel.find("link"))

    items = channel.findall("item")
    posts = []
    for it in items[:limit]:
        post = {
            "title": text(it.find("title")),
            "subtitle": text(it.find("description")),
            "url": text(it.find("link")),
            "date": parse_pubdate(text(it.find("pubDate"))),
            "cover_image": extract_cover_image(it),
        }
        posts.append(post)

    return {
        "source": FEED_URL,
        "feed_title": title,
        "feed_url": link,
        "updated_at": now_iso(),
        "posts": posts,
    }


def parse_archive(json_bytes: bytes, limit: int = 6) -> dict:
    items = json.loads(json_bytes.decode("utf-8"))
    posts = []
    for it in items[:limit]:
        title = it.get("title") or "Untitled"
        subtitle = it.get("subtitle") or it.get("description") or ""
        url = it.get("canonical_url") or ""
        if not url and it.get("slug"):
            url = f"https://drinkyouroj.substack.com/p/{it['slug']}"
        date = it.get("post_date") or ""
        cover_image = it.get("cover_image") or ""
        posts.append(
            {
                "title": title,
                "subtitle": subtitle,
                "url": url,
                "date": date,
                "cover_image": cover_image,
            }
        )

    return {
        "source": ARCHIVE_URL_TEMPLATE.format(limit=limit),
        "feed_title": "The Civic Node",
        "feed_url": "https://drinkyouroj.substack.com",
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
        limit = 6
        # Prefer the JSON archive API (less likely to be blocked).
        archive_url = ARCHIVE_URL_TEMPLATE.format(limit=limit)
        candidates = [
            archive_url,
            JINA_PROXY_TEMPLATE.format(url=archive_url.replace("https://", "")),
            FEED_URL,
            JINA_PROXY_TEMPLATE.format(url=FEED_URL.replace("https://", "")),
        ]

        data = None
        last_error = None
        for url in candidates:
            try:
                payload = fetch(url)
                stripped = payload.lstrip()
                if stripped.startswith((b"[", b"{")):
                    data = parse_archive(payload, limit=limit)
                    break
                if stripped.startswith((b"<?xml", b"<rss", b"<feed")):
                    data = parse_rss(payload, limit=limit)
                    break
            except Exception as e:
                last_error = e
                continue

        if data is None:
            raise last_error if last_error else RuntimeError("All fetch attempts failed")
        write_json(OUT_PATH, data)
        return 0
    except Exception as e:
        # If we can't update (network hiccup), keep the previous file if it exists.
        # Non-zero exit so CI can show it, but the site will still work.
        print(f"Failed to update Substack feed: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

