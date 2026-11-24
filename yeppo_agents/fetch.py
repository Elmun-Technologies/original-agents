"""Polite HTTP for source sites (CLAUDE.md "Saytlarga hurmat"):
robots.txt re-read every run, one thread, random 5-10 s pause, 12 h cache, honest User-Agent,
daily page limit, and a hard stop on 403/429/captcha — never worked around (no proxies, no fake browser).
Every request is logged (URL, status, time); no personal data is involved.
"""
import hashlib
import json
import logging
import random
import re
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx

from yeppo_agents.settings import DATA, TZ, cfg, env

log = logging.getLogger(__name__)
CAPTCHA = ("captcha", "cf-challenge", "attention required", "access restricted", "are you a robot")


class Blocked(Exception):
    """The site refused us. Stop the run and tell the admin."""


class NotAllowed(Exception):
    """robots.txt disallows this URL."""


def user_agent() -> str:
    contact = env("SCRAPER_CONTACT_EMAIL") or "admin"
    return f"YeppoBot/1.0 (Yeppo cosmetics shop, Uzbekistan; contact: {contact})"


class Robots:
    """robots.txt with Google-style wildcards (`*`, `$`) and longest-match precedence (RFC 9309).
    urllib.robotparser ignores wildcards, and the sources use them (e.g. `Disallow: /*?sort`)."""

    def __init__(self, text: str, agent: str = "yeppobot"):
        groups: list[tuple[list[str], list[tuple[bool, str]]]] = []
        agents: list[str] = []
        rules: list[tuple[bool, str]] = []
        for raw in text.splitlines():
            line = raw.split("#", 1)[0].strip()
            if ":" not in line:
                continue
            k, v = (x.strip() for x in line.split(":", 1))
            k = k.lower()
            if k == "user-agent":
                if rules:
                    groups.append((agents, rules))
                    agents, rules = [], []
                agents.append(v.lower())
            elif k in ("allow", "disallow") and agents:
                if v:
                    rules.append((k == "allow", v))
        if agents:
            groups.append((agents, rules))
        mine = [r for a, r in groups if any(x != "*" and x in agent for x in a)]
        self.rules = [x for r in (mine or [r for a, r in groups if "*" in a]) for x in r]

    @staticmethod
    def _re(path: str) -> re.Pattern:
        end = path.endswith("$")
        body = re.escape(path.rstrip("$")).replace(r"\*", ".*")
        return re.compile(body + ("$" if end else ""))

    def allowed(self, url: str) -> bool:
        u = urlparse(url)
        target = (u.path or "/") + (f"?{u.query}" if u.query else "")
        best = None
        for allow, path in self.rules:
            if self._re(path).match(target) and (best is None or len(path) > len(best[1]) or (len(path) == len(best[1]) and allow)):
                best = (allow, path)
        return best is None or best[0]


class Fetcher:
    def __init__(self, base_url: str, *, sleep=time.sleep, client: httpx.Client | None = None, cache_dir: Path | None = None):
        s = cfg()["source"]
        self.base = base_url.rstrip("/")
        self.delay = s["delay_seconds"]
        self.cache_s = s["cache_hours"] * 3600
        self.limit = s["daily_page_limit"]
        self.sleep = sleep
        self.client = client or httpx.Client(headers={"User-Agent": user_agent()}, timeout=40, follow_redirects=True)
        self.cache = cache_dir or DATA / "cache" / urlparse(self.base).netloc
        self.cache.mkdir(parents=True, exist_ok=True)
        self.counter = DATA / "fetch_count.json"
        self.robots: Robots | None = None
        self._last = 0.0

    # --- robots ---------------------------------------------------------
    def load_robots(self) -> None:
        r = self._get(f"{self.base}/robots.txt", check_robots=False, use_cache=False)  # re-read every run
        self.robots = Robots(r)

    def allowed(self, url: str) -> bool:
        if self.robots is None:
            self.load_robots()
        return self.robots.allowed(url)

    # --- daily counter ----------------------------------------------------
    def _count(self) -> int:
        today = datetime.now(TZ).date().isoformat()
        try:
            d = json.loads(self.counter.read_text())
        except Exception:
            d = {}
        n = d.get(today, 0) + 1
        self.counter.parent.mkdir(parents=True, exist_ok=True)
        self.counter.write_text(json.dumps({today: n}))
        return n

    # --- fetch ------------------------------------------------------------
    def _inside(self, url: str) -> None:
        a, b = urlparse(url), urlparse(self.base)
        if (a.scheme, a.netloc) != (b.scheme, b.netloc):  # exact host: "base.evil.com" is not ours
            raise NotAllowed(f"outside {self.base}: {url}")

    def get(self, url: str) -> str:
        self._inside(url)
        return self._get(url, check_robots=True)

    def get_bytes(self, url: str) -> bytes:
        """A product photo from the source host — same robots/pause/limit/stop rules as pages."""
        self._inside(url)
        return self._get(url, check_robots=True, binary=True)

    def _get(self, url: str, check_robots: bool, use_cache: bool = True, binary: bool = False):
        key = self.cache / (hashlib.sha1(url.encode()).hexdigest() + (".bin" if binary else ".html"))
        if use_cache and key.exists() and time.time() - key.stat().st_mtime < self.cache_s:
            return key.read_bytes() if binary else key.read_text(encoding="utf-8")
        if check_robots and not self.allowed(url):
            raise NotAllowed(url)
        if self._count() > self.limit:
            raise Blocked(f"kunlik limit ({self.limit} sahifa) tugadi")
        wait = random.uniform(*self.delay) - (time.time() - self._last)
        if self._last and wait > 0:
            self.sleep(wait)
        t0 = time.time()
        try:
            resp = self.client.get(url)
        except httpx.HTTPError as e:
            log.warning("GET %s -> %s", url, type(e).__name__)
            raise
        finally:
            self._last = time.time()
        log.info("GET %s -> %s %.1fs", url, resp.status_code, time.time() - t0)
        if resp.status_code in (403, 429, 503):
            raise Blocked(f"{resp.status_code} — {url}")
        if binary and resp.headers.get("content-type", "").startswith("image/"):
            resp.raise_for_status()
            key.write_bytes(resp.content)
            return resp.content
        head = resp.text[:4000].lower()
        if any(c in head for c in CAPTCHA):
            raise Blocked(f"captcha/himoya sahifasi — {url}")
        resp.raise_for_status()
        if binary:  # asked for a photo, got a page
            raise httpx.HTTPError(f"not an image: {url}")
        key.write_text(resp.text, encoding="utf-8")
        return resp.text
