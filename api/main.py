from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import urllib.robotparser
import requests
import datetime
import os
import json
import psycopg2
from urllib.parse import urlparse
from bs4 import BeautifulSoup
import uvicorn

app = FastAPI(title="AI Readiness Checker API")

DATABASE_URL = os.environ.get("DATABASE_URL", "")

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
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"DB init error: {e}")

def log_check(result: dict, ip: str, user_agent: str):
    if not DATABASE_URL:
        return
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO ai_checker_logs (url, score, verdict, breakdown, ip, user_agent) VALUES (%s, %s, %s, %s, %s, %s)",
            (result["url"], result["score"], result["verdict"], json.dumps(result["breakdown"]), ip, user_agent)
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
    try:
        r = requests.get(f"{base_url.rstrip('/')}/llms.txt", headers=_HEADERS, timeout=5)
        if r.status_code == 200 and len(r.text) > 50:
            return (15, 15, "llms.txt found", None)
        r_full = requests.get(f"{base_url.rstrip('/')}/llms-full.txt", headers=_HEADERS, timeout=5)
        if r_full.status_code == 200 and len(r_full.text) > 50:
            return (15, 15, "llms-full.txt found", None)
    except Exception:
        pass
    return (0, 15, "llms.txt missing", "Create an llms.txt file")

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
    soup = BeautifulSoup(html, 'html.parser')
    body = soup.find('body')
    if not body:
        return True
    body_text = body.get_text(separator=' ', strip=True)
    if len(body_text) > 300:
        return False
    csr_markers = [
        soup.find('div', id='root'),
        soup.find('div', id='app'),
        soup.find('div', id='__next'),
        soup.find('div', id='__nuxt'),
    ]
    return any(m is not None for m in csr_markers)

def _check_ssr(html: str, is_csr: bool) -> tuple[int, int, str, str | None]:
    if is_csr:
        return (0, 10, "JavaScript-rendered site (CSR)", "Switch to SSR/SSG — AI agents can't execute JavaScript")
    soup = BeautifulSoup(html, 'html.parser')
    body = soup.find('body')
    if not body:
        return (0, 10, "Missing body tag", "Enable Server-Side Rendering (SSR)")
    if len(body.get_text(separator=' ', strip=True)) > 500:
        return (10, 10, "Good SSR/SSG detected", None)
    return (0, 10, "Little visible HTML text", "Serve content directly in HTML")

def _check_agent_readable_content(html: str, is_csr: bool) -> tuple[int, int, str, str | None]:
    if is_csr:
        return (0, 20, "Content not accessible — JavaScript required", "Switch to Next.js/Nuxt SSR so AI crawlers can read your content")
    soup = BeautifulSoup(html, 'html.parser')
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        tag.decompose()
    main_node = soup.find('main') or soup.find('article') or soup.find('body')
    if not main_node:
        return (0, 20, "No readable content found", "Structure content using <main> or <article>")
    word_count = len(main_node.get_text(separator=' ', strip=True).split())
    if word_count >= 2000: return (20, 20, f"{word_count} words", None)
    elif word_count >= 1000: return (15, 20, f"{word_count} words", "Expand content")
    elif word_count >= 500: return (10, 20, f"{word_count} words", "Expand content")
    elif word_count >= 200: return (5, 20, f"{word_count} words", "Expand content")
    return (0, 20, f"Only {word_count} words", "Provide significantly more text")

def _check_markdown_availability(base_url: str) -> tuple[int, int, str, str | None]:
    try:
        md_headers = {**_HEADERS, "Accept": "text/markdown"}
        r = requests.get(base_url, headers=md_headers, timeout=5)
        if r.status_code == 200 and "text/markdown" in r.headers.get("Content-Type", ""):
            return (15, 15, "Markdown available via Accept-Header", None)
        for path in ["/index.md", "/README.md"]:
            r = requests.get(f"{base_url.rstrip('/')}{path}", headers=_HEADERS, timeout=5)
            if r.status_code == 200 and r.text.strip().startswith("#"):
                return (15, 15, f"Markdown found at {path}", None)
    except Exception:
        pass
    return (0, 15, "No Markdown endpoint (normal for most sites)", "Offer a Markdown variant of your content")

def _check_performance(elapsed_ms: float) -> tuple[int, int, str, str | None]:
    if elapsed_ms < 200: return (10, 10, f"{int(elapsed_ms)}ms (Very fast)", None)
    elif elapsed_ms < 500: return (7, 10, f"{int(elapsed_ms)}ms", "Optimize TTFB")
    elif elapsed_ms < 1000: return (4, 10, f"{int(elapsed_ms)}ms", "Optimize TTFB")
    return (0, 10, f"{int(elapsed_ms)}ms (Too slow)", "Critically optimize TTFB")

def _check_token_economics(text: str) -> tuple[int, int, str, str | None]:
    tokens = len(text) / 4
    if tokens < 50000: return (15, 15, f"~{int(tokens)} Tokens (Optimal)", None)
    elif tokens < 100000: return (10, 15, f"~{int(tokens)} Tokens", "Streamline DOM structure")
    elif tokens < 200000: return (5, 15, f"~{int(tokens)} Tokens", "Heavily streamline DOM")
    return (0, 15, f"~{int(tokens)} Tokens (Too large)", "Drastically reduce code/text")

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
            final_url = r.url # Handle redirects
            elapsed_ms = r.elapsed.total_seconds() * 1000
        except Exception as e:
            return {"score": 0, "verdict": "Critical", "error": f"Could not reach website: {str(e)}", "url": url}

        # 2. Fetch robots.txt (always from origin, not from a sub-path)
        parsed_final = urlparse(final_url)
        base_origin = f"{parsed_final.scheme}://{parsed_final.netloc}"
        try:
            robots_url = f"{base_origin}/robots.txt"
            r_robots = requests.get(robots_url, headers=_HEADERS, timeout=5)
            robots_txt = r_robots.text if r_robots.status_code == 200 else ""
        except Exception:
            robots_txt = ""

        # 3. Extract main text safely
        main_text = ""
        try:
            soup = BeautifulSoup(html, 'html.parser')
            # Remove noise
            for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]): 
                tag.decompose()
            
            # Try to find content nodes in order of preference
            content_node = soup.find('main') or soup.find('article') or soup.find('div', class_=lambda x: x and ('content' in x.lower() or 'main' in x.lower())) or soup.find('body')
            
            if content_node:
                main_text = content_node.get_text(separator=' ', strip=True)
            else:
                main_text = html # Fallback to raw html if body is missing (unlikely)
        except Exception:
            main_text = html

        is_csr = _detect_csr(html)
        checks = {
            "agent_readable_content": _check_agent_readable_content(html, is_csr),
            "server_side_rendering": _check_ssr(html, is_csr),
            "ai_agent_access": _check_ai_bot_access(robots_txt),
            "llms_txt": _check_llms_txt(base_origin),
            "markdown_availability": _check_markdown_availability(base_origin),
            "token_economics": _check_token_economics(main_text),
            "performance": _check_performance(elapsed_ms),
            "sitemap": _check_sitemap(base_origin, robots_txt)
        }

        breakdown = {}
        total_points = 0
        for key, result in checks.items():
            pts, max_pts, detail, rec = result
            breakdown[key] = {"points": pts, "max": max_pts, "detail": detail, "recommendation": rec}
            total_points += pts
            
        # Score calculation (normalized to 100)
        max_possible = sum(c[1] for c in checks.values())
        score = min(100, round((total_points / max_possible) * 100))
        
        return {
            "score": score,
            "verdict": "Optimal" if score >= 80 else "Needs Improvement" if score >= 55 else "Critical",
            "breakdown": breakdown,
            "is_csr": is_csr,
            "url": final_url,
            "checked_at": now
        }
    except Exception as e:
        return {"score": 0, "verdict": "Critical", "error": f"Internal Error: {str(e)}", "url": url}

import os
import uvicorn

@app.get("/api/analyze")
async def analyze(request: Request, url: str = Query(..., description="The URL of the website to analyze")):
    result = audit_ai_readiness(url)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    user_agent = request.headers.get("user-agent", "")
    log_check(result, ip, user_agent)
    return result

@app.get("/api/logs")
async def logs(limit: int = 50):
    if not DATABASE_URL:
        return []
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, url, score, verdict, ip, user_agent, checked_at FROM ai_checker_logs ORDER BY checked_at DESC LIMIT %s",
            (limit,)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [
            {"id": r[0], "url": r[1], "score": r[2], "verdict": r[3], "ip": r[4], "user_agent": r[5], "checked_at": r[6]}
            for r in rows
        ]
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
