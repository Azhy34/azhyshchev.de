from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import urllib.robotparser
import requests
import datetime
import hashlib
import os
import json
import time
import psycopg2
from urllib.parse import urlparse
from bs4 import BeautifulSoup
import uvicorn

app = FastAPI(title="AI Readiness Checker API")

# Short-lived cache so repeated clicks on the same URL don't re-hit the
# target site (avoids tripping target-side anti-bot rate limits).
_ANALYZE_CACHE_TTL = 600  # seconds
_analyze_cache: dict[str, tuple[float, dict]] = {}

DATABASE_URL = os.environ.get("DATABASE_URL", "")
# Token required for /api/logs and /api/leads (they expose visitor hashes).
LOG_TOKEN = os.environ.get("CHECKER_LOG_TOKEN", "")
# Salt for the visitor IP hash. Set IP_HASH_SALT on Cloud Run for real deployments.
IP_HASH_SALT = os.environ.get("IP_HASH_SALT", "ai-checker")

# Lead-analytics columns. Existing tables are migrated on startup via
# ALTER TABLE ... ADD COLUMN IF NOT EXISTS, so no manual migration is needed.
_LOG_EXTRA_COLUMNS = {
    "domain": "TEXT",
    "gaps": "JSONB",
    "ip_hash": "TEXT",
    "lang": "TEXT",
    "referrer": "TEXT",
    "utm_source": "TEXT",
    "utm_medium": "TEXT",
    "utm_campaign": "TEXT",
    "cached": "BOOLEAN DEFAULT FALSE",
    "error": "TEXT",
}

def get_db():
    return psycopg2.connect(DATABASE_URL)

def init_db():
    if not DATABASE_URL:
        return
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ai_checker_logs (
                id          BIGSERIAL PRIMARY KEY,
                url         TEXT NOT NULL,
                score       INT,
                verdict     TEXT,
                breakdown   JSONB,
                ip          TEXT,
                user_agent  TEXT,
                checked_at  TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        for column, column_type in _LOG_EXTRA_COLUMNS.items():
            cur.execute(
                f"ALTER TABLE ai_checker_logs ADD COLUMN IF NOT EXISTS {column} {column_type}"
            )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS ai_checker_logs_domain_idx "
            "ON ai_checker_logs (domain, checked_at DESC)"
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS ai_checker_logs_checked_at_idx "
            "ON ai_checker_logs (checked_at DESC)"
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"DB init error: {e}")


def _normalize_domain(url: str) -> str:
    """example.com — no scheme, no path, no leading "www." (one lead per domain)."""
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return ""
    return host[4:] if host.startswith("www.") else host


def _hash_ip(ip: str) -> str:
    """Store a salted hash instead of the raw visitor IP (GDPR data minimisation)."""
    return hashlib.sha256(f"{IP_HASH_SALT}:{ip}".encode("utf-8")).hexdigest()[:32]


def _extract_gaps(breakdown: dict) -> list[dict]:
    """Every check that did not earn full marks — this is the actual sales argument."""
    gaps = []
    for key, entry in breakdown.items():
        max_points = entry.get("max", 0) or 0
        points = entry.get("points", 0) or 0
        if max_points and points < max_points:
            gaps.append({
                "check": key,
                "points": points,
                "max": max_points,
                "detail": entry.get("detail"),
                "recommendation": entry.get("recommendation"),
            })
    return gaps

def log_check(result: dict, meta: dict) -> None:
    """Record one run: always emit a structured log line, persist to Postgres if configured.

    Cache hits and failed runs (anti-bot 403/429, timeouts) are logged as well —
    they are real visitor intent and used to disappear from the stats entirely.
    """
    breakdown = result.get("breakdown") or {}
    gaps = _extract_gaps(breakdown)
    payload = {
        "event": "ai_checker_run",
        "url": result.get("url"),
        "domain": _normalize_domain(result.get("url") or ""),
        "score": result.get("score"),
        "verdict": result.get("verdict"),
        "gaps": [gap["check"] for gap in gaps],
        "cached": bool(meta.get("cached")),
        "error": result.get("error"),
        "lang": meta.get("lang"),
        "referrer": meta.get("referrer"),
        "utm_source": meta.get("utm_source"),
        "utm_medium": meta.get("utm_medium"),
        "utm_campaign": meta.get("utm_campaign"),
        "ip_hash": _hash_ip(meta.get("ip", "")),
        "checked_at": result.get("checked_at"),
    }
    # → Cloud Logging jsonPayload (works even when DATABASE_URL is not configured)
    print(json.dumps(payload, ensure_ascii=False))

    if not DATABASE_URL:
        return
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO ai_checker_logs
               (url, domain, score, verdict, breakdown, gaps, ip, ip_hash, user_agent,
                lang, referrer, utm_source, utm_medium, utm_campaign, cached, error)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                result.get("url"),
                payload["domain"],
                result.get("score"),
                result.get("verdict"),
                json.dumps(breakdown),
                json.dumps(gaps),
                meta.get("ip"),
                payload["ip_hash"],
                meta.get("user_agent"),
                meta.get("lang"),
                meta.get("referrer"),
                meta.get("utm_source"),
                meta.get("utm_medium"),
                meta.get("utm_campaign"),
                bool(meta.get("cached")),
                result.get("error"),
            ),
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"DB log error: {e}")

init_db()

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domain
    allow_methods=["*"],
    allow_headers=["*"],
)

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1"
}

# ---------------------------------------------------------------------------
# Cookie-consent wall detection
# ---------------------------------------------------------------------------
_CONSENT_MARKERS = [
    "cookiebot", "usercentrics", "onetrust", "borlabs-cookie",
    "consentmanager", "cmplz",
]

def _has_consent_wall(html: str, soup: BeautifulSoup) -> bool:
    """Return True if a consent wall is detected AND body text is thin."""
    lower = html.lower()
    has_marker = any(m in lower for m in _CONSENT_MARKERS)
    if not has_marker:
        return False
    body = soup.find("body")
    visible = body.get_text(separator=" ", strip=True) if body else ""
    return len(visible) < 500


def _is_soft_404_body(text: str, content_type: str = "") -> bool:
    """Return True if the response body looks like an HTML page (not a real llms.txt).

    A genuine llms.txt is plain text / markdown — it never starts with '<'.
    Guard covers: BOM-prefixed doctype, HTML comments before doctype,
    <head>/<meta>/<script> openers, and CDN/Wix comment wrappers.
    Also fires when the server declares Content-Type: text/html.
    """
    if "text/html" in content_type.lower():
        return True
    # Strip UTF-8 BOM (\xef\xbb\xbf) that .strip() does not remove
    stripped = text.strip()
    if stripped.startswith("\xef\xbb\xbf"):
        stripped = stripped[3:]
    return stripped.lstrip().lower().startswith("<")


def _check_ai_bot_access(robots_txt: str) -> tuple[int, int, str, str | None]:
    bots = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot", "Bytespider", "anthropic-ai", "Applebot-Extended"]
    max_points = 15
    points_per_bot = max_points / len(bots)

    if not robots_txt.strip():
        return (15, 15, "All AI bots allowed (no block)", None)

    rp = urllib.robotparser.RobotFileParser()
    rp.parse(robots_txt.splitlines())

    allowed_count = 0
    blocked_bots = []
    for bot in bots:
        if rp.can_fetch(bot, "/"):
            allowed_count += 1
        else:
            blocked_bots.append(bot)

    points = allowed_count * points_per_bot
    if blocked_bots:
        return (points, max_points, f"Blocked AI bots: {', '.join(blocked_bots)}", "Allow popular AI crawlers in robots.txt")
    return (points, max_points, "All major AI bots allowed", None)


def _check_llms_txt(base_url: str) -> tuple[int, int, str, str | None]:
    """Bonus check — 10 points if a real llms.txt exists."""
    max_points = 10
    try:
        r = requests.get(f"{base_url.rstrip('/')}/llms.txt", headers=_HEADERS, timeout=5)
        ct = r.headers.get("Content-Type", "")
        if r.status_code == 200 and len(r.text) > 50 and not _is_soft_404_body(r.text, ct):
            return (10, 10, "llms.txt found", None)
        r_full = requests.get(f"{base_url.rstrip('/')}/llms-full.txt", headers=_HEADERS, timeout=5)
        ct_full = r_full.headers.get("Content-Type", "")
        if r_full.status_code == 200 and len(r_full.text) > 50 and not _is_soft_404_body(r_full.text, ct_full):
            return (10, 10, "llms-full.txt found", None)
    except Exception:
        pass
    return (0, 10, "llms.txt missing", "Create an llms.txt file — 10 bonus points")


def _check_sitemap(base_url: str, robots_txt: str) -> tuple[int, int, str, str | None]:
    if "Sitemap:" in robots_txt:
        return (10, 10, "Sitemap found in robots.txt", None)
    for path in ["/sitemap.xml", "/sitemap_index.xml"]:
        try:
            r = requests.get(f"{base_url.rstrip('/')}{path}", headers=_HEADERS, timeout=5)
            if r.status_code == 200 and ("<urlset" in r.text or "<sitemapindex" in r.text):
                return (10, 10, f"Sitemap found at {path}", None)
        except Exception:
            pass
    return (0, 10, "No sitemap found", "Generate XML sitemap")


def _detect_csr(html: str) -> bool:
    """Return True if the page appears to be a client-side rendered shell."""
    soup = BeautifulSoup(html, 'html.parser')
    body = soup.find('body')
    if not body:
        return True
    body_text = body.get_text(separator=' ', strip=True)
    if len(body_text) > 500:  # aligned with _check_ssr threshold
        return False
    csr_markers = [
        soup.find('div', id='root'),
        soup.find('div', id='app'),
        soup.find('div', id='__next'),
        soup.find('div', id='__nuxt'),
    ]
    return any(m is not None for m in csr_markers)


def _check_ssr(html: str, is_csr: bool, consent_wall: bool) -> tuple[int, int, str, str | None]:
    if consent_wall:
        return (10, 10, "SSR check prevented by cookie consent banner — full points granted", None)
    if is_csr:
        return (0, 10, "JavaScript-rendered site (CSR)", "Switch to SSR/SSG — AI agents can't execute JavaScript")
    soup = BeautifulSoup(html, 'html.parser')
    body = soup.find('body')
    if not body:
        return (0, 10, "Missing body tag", "Enable Server-Side Rendering (SSR)")
    if len(body.get_text(separator=' ', strip=True)) > 500:
        return (10, 10, "Good SSR/SSG detected", None)
    return (0, 10, "Little visible HTML text", "Serve content directly in HTML")


def _check_agent_readable_content(html: str, is_csr: bool, consent_wall: bool) -> tuple[int, int, str, str | None]:
    if consent_wall:
        return (10, 20, "Content check limited by cookie consent banner — partial points granted", None)
    if is_csr:
        return (0, 20, "Content not accessible — JavaScript required", "Switch to Next.js/Nuxt SSR so AI crawlers can read your content")
    soup = BeautifulSoup(html, 'html.parser')
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        tag.decompose()
    main_node = soup.find('main') or soup.find('article') or soup.find('body')
    if not main_node:
        return (0, 20, "No readable content found", "Structure content using <main> or <article>")
    word_count = len(main_node.get_text(separator=' ', strip=True).split())
    if word_count >= 800:
        return (20, 20, f"{word_count} words (Optimal)", None)
    elif word_count >= 400:
        return (16, 20, f"{word_count} words", "Consider expanding body content to 800+ words for deeper LLM grounding")
    elif word_count >= 200:
        return (10, 20, f"{word_count} words", "Expand semantic textual content for LLM ingestion")
    return (0, 20, f"Only {word_count} words", "Provide significantly more readable text for AI engines")


def _check_markdown_availability(base_url: str) -> tuple[int, int, str, str | None]:
    """Bonus check — 5 points if a Markdown endpoint exists."""
    max_points = 5
    try:
        md_headers = {**_HEADERS, "Accept": "text/markdown"}
        r = requests.get(base_url, headers=md_headers, timeout=5)
        if r.status_code == 200 and "text/markdown" in r.headers.get("Content-Type", ""):
            return (5, 5, "Markdown available via Accept-Header", None)
        for path in ["/index.md", "/README.md"]:
            r = requests.get(f"{base_url.rstrip('/')}{path}", headers=_HEADERS, timeout=5)
            if r.status_code == 200 and r.text.strip().startswith("#"):
                return (5, 5, f"Markdown found at {path}", None)
    except Exception:
        pass
    return (0, 5, "No Markdown endpoint (normal for most sites)", "Offer a Markdown variant of your content")


def _check_schema_org(html: str) -> tuple[int, int, str, str | None]:
    """Check for JSON-LD or Microdata Schema.org structured data (entity graphs for AI engines)."""
    soup = BeautifulSoup(html, 'html.parser')
    scripts = soup.find_all('script', type='application/ld+json')
    types_found = set()
    for s in scripts:
        try:
            content = json.loads(s.string or "{}")
            if isinstance(content, dict):
                if "@graph" in content and isinstance(content["@graph"], list):
                    for node in content["@graph"]:
                        if isinstance(node, dict) and "@type" in node:
                            types_found.add(str(node["@type"]))
                elif "@type" in content:
                    types_found.add(str(content["@type"]))
            elif isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and "@type" in item:
                        types_found.add(str(item["@type"]))
        except Exception:
            pass

    if types_found:
        names = ", ".join(sorted(list(types_found))[:3])
        return (10, 10, f"JSON-LD Schema detected ({names})", None)
    
    # Check microdata fallback
    if soup.find(attrs={"itemscope": True}):
        return (7, 10, "Microdata Schema detected (upgrade to JSON-LD)", "Switch to JSON-LD Schema.org format for better LLM parsing")

    return (0, 10, "No Schema.org detected", "Add JSON-LD Schema.org markup (Organization, Product, FAQPage)")


def _check_performance(elapsed_ms: float) -> tuple[int, int, str, str | None]:
    if elapsed_ms < 200: return (10, 10, f"{int(elapsed_ms)}ms (Very fast)", None)
    elif elapsed_ms < 500: return (7, 10, f"{int(elapsed_ms)}ms", "Optimize TTFB")
    elif elapsed_ms < 1500: return (4, 10, f"{int(elapsed_ms)}ms", "Optimize TTFB")
    return (0, 10, f"{int(elapsed_ms)}ms (Too slow)", "Critically optimize TTFB")


def _check_token_economics(text: str) -> tuple[int, int, str, str | None]:
    """Max 10 points of the 100-point total (was 15 of a 105-point scale).

    Zero extractable text is a defect, not a win: it used to score a full 15/15
    for "~0 Tokens (Optimal)", which silently paid out points on empty pages.
    """
    tokens = len(text) / 4
    if tokens < 1: return (0, 10, "No extractable text", "Serve real text content in the initial HTML")
    elif tokens < 50000: return (10, 10, f"~{int(tokens)} Tokens (Optimal)", None)
    elif tokens < 100000: return (7, 10, f"~{int(tokens)} Tokens", "Streamline DOM structure")
    elif tokens < 200000: return (3, 10, f"~{int(tokens)} Tokens", "Heavily streamline DOM")
    return (0, 10, f"~{int(tokens)} Tokens (Too large)", "Drastically reduce code/text")


# Sum of every check's max — the score is a plain sum, so this MUST stay 100.
# BASE (7 checks): 20 + 15 + 10 + 10 + 10 + 10 + 10 = 85
# BONUS:           llms_txt 10 + markdown_availability 5 = 15
TOTAL_MAX = 100


def _compute_score(breakdown: dict) -> int:
    """Final score = plain sum of all check points (max = TOTAL_MAX = 100).

    Previous formula was `min(100, round(base * 100 / 90) + llms_bonus + md_bonus)`:
    the base percentage already had 100 as its ceiling, so the additive bonuses
    could only paper over lost base points — a site with 84/90 base + llms.txt
    came out as 103 → 100 "Optimal" while two cards still showed gaps.
    With a plain sum, 100 is reachable ONLY when every check is full.
    """
    return int(round(sum(entry["points"] for entry in breakdown.values())))


def _verdict_for_score(score: int) -> str:
    """Verdict bands for the 0-100 plain-sum score."""
    if score >= 90:
        return "Optimal"
    if score >= 70:
        return "Needs Improvement"
    return "Critical"


def audit_ai_readiness(url: str) -> dict:
    parsed = urlparse(url)
    if not parsed.scheme: url = "https://" + url
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        # 1. Fetch HTML with better timeout and error handling
        try:
            r = requests.get(url, headers=_HEADERS, timeout=10, allow_redirects=True)
            r.raise_for_status()
            html = r.text
            final_url = r.url  # Handle redirects
            elapsed_ms = r.elapsed.total_seconds() * 1000
        except requests.exceptions.HTTPError as e:
            code = e.response.status_code if e.response is not None else None
            if code in (403, 405, 429):
                return {
                    "score": 0, "verdict": "Critical",
                    "error": "This website's security system blocked our automated check (it likely blocks bots/scrapers in general). This isn't an issue with the checker — try again later or check a different page.",
                    "url": url,
                }
            return {"score": 0, "verdict": "Critical", "error": f"Could not reach website: {str(e)}", "url": url}
        except Exception as e:
            return {"score": 0, "verdict": "Critical", "error": f"Could not reach website: {str(e)}", "url": url}

        # 2. base_origin from final URL (handles http→https redirects and path-URLs)
        parsed_final = urlparse(final_url)
        base_origin = f"{parsed_final.scheme}://{parsed_final.netloc}"

        # 3. Fetch robots.txt (always from origin)
        try:
            robots_url = f"{base_origin}/robots.txt"
            r_robots = requests.get(robots_url, headers=_HEADERS, timeout=5)
            robots_txt = r_robots.text if r_robots.status_code == 200 else ""
        except Exception:
            robots_txt = ""

        # 4. Detect consent wall and CSR
        soup_main = BeautifulSoup(html, 'html.parser')
        consent_wall = _has_consent_wall(html, soup_main)
        is_csr = _detect_csr(html)

        # 5. Extract main text for token economics
        main_text = ""
        try:
            soup = BeautifulSoup(html, 'html.parser')
            for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
                tag.decompose()
            candidates = [n for n in (soup.find('main'), soup.find('article'), soup.find('body')) if n]
            if candidates:
                # Richest node wins. The old chain stopped at the first
                # <div class="...content...">, which on some sites is an empty
                # decorative wrapper: content check saw ~800 words while token
                # economics saw 0 tokens (and paid out a full 15/15 for it).
                content_node = max(
                    candidates,
                    key=lambda n: len(n.get_text(separator=' ', strip=True)),
                )
                main_text = content_node.get_text(separator=' ', strip=True)
            else:
                main_text = html
        except Exception:
            main_text = html

        # 6. Run checks
        base_checks = {
            "ai_agent_access": _check_ai_bot_access(robots_txt),
            "sitemap": _check_sitemap(base_origin, robots_txt),
            "server_side_rendering": _check_ssr(html, is_csr, consent_wall),
            "agent_readable_content": _check_agent_readable_content(html, is_csr, consent_wall),
            "schema_org": _check_schema_org(html),
            "performance": _check_performance(elapsed_ms),
            "token_economics": _check_token_economics(main_text),
        }
        bonus_checks = {
            "llms_txt": _check_llms_txt(base_origin),
            "markdown_availability": _check_markdown_availability(base_origin),
        }

        breakdown = {}
        for key, result in base_checks.items():
            pts, max_pts, detail, rec = result
            entry = {"points": pts, "max": max_pts, "detail": detail, "recommendation": rec}
            if consent_wall and key in ("server_side_rendering", "agent_readable_content"):
                entry["neutral"] = True
            breakdown[key] = entry

        for key, result in bonus_checks.items():
            pts, max_pts, detail, rec = result
            breakdown[key] = {
                "points": pts, "max": max_pts,
                "detail": detail, "recommendation": rec,
                "bonus": True,
            }

        score = _compute_score(breakdown)
        verdict = _verdict_for_score(score)

        result_dict = {
            "score": score,
            "verdict": verdict,
            "breakdown": breakdown,
            "is_csr": is_csr,
            "url": final_url,
            "checked_at": now,
        }
        if consent_wall:
            result_dict["consent_wall"] = True
        return result_dict

    except Exception as e:
        return {"score": 0, "verdict": "Critical", "error": f"Internal Error: {str(e)}", "url": url}


import os
import uvicorn

def _client_meta(request: Request, lang, utm_source, utm_medium, utm_campaign) -> dict:
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")
    return {
        "ip": ip,
        "user_agent": request.headers.get("user-agent", "")[:512],
        "referrer": request.headers.get("referer", "")[:512],
        "lang": (lang or "")[:8],
        "utm_source": (utm_source or "")[:64],
        "utm_medium": (utm_medium or "")[:64],
        "utm_campaign": (utm_campaign or "")[:64],
    }


@app.get("/api/analyze")
async def analyze(
    request: Request,
    url: str = Query(..., description="The URL of the website to analyze"),
    lang: str | None = Query(None, description="Checker page language (en|de)"),
    utm_source: str | None = Query(None),
    utm_medium: str | None = Query(None),
    utm_campaign: str | None = Query(None),
):
    meta = _client_meta(request, lang, utm_source, utm_medium, utm_campaign)

    cache_key = url.strip().lower()
    cached_entry = _analyze_cache.get(cache_key)
    if cached_entry and time.time() - cached_entry[0] < _ANALYZE_CACHE_TTL:
        result = cached_entry[1]
        log_check(result, {**meta, "cached": True})
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result

    result = audit_ai_readiness(url)
    _analyze_cache[cache_key] = (time.time(), result)
    log_check(result, meta)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

def _require_log_token(request: Request) -> None:
    """Reading visitor hashes/domains requires CHECKER_LOG_TOKEN when it is set."""
    if not LOG_TOKEN:
        return
    if request.headers.get("x-log-token") != LOG_TOKEN:
        raise HTTPException(status_code=401, detail="Missing or invalid X-Log-Token header")


@app.get("/api/logs")
async def logs(
    request: Request,
    limit: int = 50,
    days: int = 30,
    domain: str | None = None,
    max_score: int | None = None,
):
    _require_log_token(request)
    if not DATABASE_URL:
        return {
            "enabled": False,
            "hint": "DATABASE_URL is not configured — runs still land in Cloud Logging (jsonPayload.event=ai_checker_run)",
            "rows": [],
        }
    try:
        conn = get_db()
        cur = conn.cursor()
        sql = (
            "SELECT id, url, domain, score, verdict, gaps, lang, utm_source, utm_campaign, "
            "cached, error, ip_hash, checked_at "
            "FROM ai_checker_logs "
            "WHERE checked_at >= NOW() - (%s * INTERVAL '1 day')"
        )
        params: list = [max(1, min(days, 365))]
        if domain:
            sql += " AND domain = %s"
            params.append(domain.lower().replace("www.", ""))
        if max_score is not None:
            sql += " AND score <= %s"
            params.append(max_score)
        sql += " ORDER BY checked_at DESC LIMIT %s"
        params.append(max(1, min(limit, 500)))
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {
            "enabled": True,
            "rows": [
                {
                    "id": r[0], "url": r[1], "domain": r[2], "score": r[3], "verdict": r[4],
                    "gaps": r[5], "lang": r[6], "utm_source": r[7], "utm_campaign": r[8],
                    "cached": r[9], "error": r[10], "ip_hash": r[11],
                    "checked_at": r[12].isoformat() if r[12] else None,
                }
                for r in rows
            ],
        }
    except Exception as e:
        return {"enabled": False, "error": str(e), "rows": []}


@app.get("/api/leads")
async def leads(
    request: Request,
    days: int = 30,
    max_score: int = 90,
    limit: int = 100,
):
    """Domains worth following up: they ran the checker, still have gaps, newest first."""
    _require_log_token(request)
    if not DATABASE_URL:
        return {"enabled": False, "hint": "DATABASE_URL is not configured", "rows": []}
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT r.domain,
                   COUNT(DISTINCT r.id)                        AS runs,
                   MIN(r.score)                                AS min_score,
                   MAX(r.score)                                AS max_score,
                   MAX(r.checked_at)                           AS last_seen,
                   COALESCE(
                       jsonb_agg(DISTINCT g->>'check')
                       FILTER (WHERE g->>'check' IS NOT NULL),
                       '[]'::jsonb
                   )                                           AS gaps
            FROM ai_checker_logs r
            LEFT JOIN LATERAL jsonb_array_elements(COALESCE(r.gaps, '[]'::jsonb)) g ON TRUE
            WHERE r.checked_at >= NOW() - (%s * INTERVAL '1 day')
              AND r.domain IS NOT NULL AND r.domain <> ''
              AND r.score IS NOT NULL
            GROUP BY r.domain
            HAVING MAX(r.score) <= %s
            ORDER BY MAX(r.checked_at) DESC
            LIMIT %s
            """,
            (max(1, min(days, 365)), max_score, max(1, min(limit, 500))),
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {
            "enabled": True,
            "rows": [
                {
                    "domain": r[0], "runs": r[1], "min_score": r[2], "max_score": r[3],
                    "last_seen": r[4].isoformat() if r[4] else None, "gaps": r[5],
                }
                for r in rows
            ],
        }
    except Exception as e:
        return {"enabled": False, "error": str(e), "rows": []}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
