# SEO Changes — azhyshchev.de

**Date:** 2026-05-15  
**Goal:** Make the portfolio discoverable by German businesses searching for AI/automation services, and visible to AI crawlers (ChatGPT, Perplexity, Claude).

---

## 1. JSON-LD Structured Data — all pages

Added `<script type="application/ld+json">` blocks using the `@graph` pattern so all entities share a unified Knowledge Graph with cross-references via `@id`.

### Entity design

| Entity | @id | Pages |
|--------|-----|-------|
| Person | `https://azhyshchev.de/#person` | All pages (referenced by @id in subpages) |
| WebSite | `https://azhyshchev.de/#website` | index.html only (defined once) |
| WebPage | `https://azhyshchev.de/[page]#webpage` | Every page |
| ItemList | `https://azhyshchev.de/projects#list` | projects/index.html |
| SoftwareApplication | `https://azhyshchev.de/projects#[slug]` | Inside ItemList on projects page |

### Person schema (index.html — canonical definition)

```json
{
  "@type": "Person",
  "@id": "https://azhyshchev.de/#person",
  "name": "Mikhail Azhyshchev",
  "jobTitle": "AI-Enabled Automation Engineer",
  "url": "https://azhyshchev.de",
  "email": "azhischev1@gmail.com",
  "image": { "@type": "ImageObject", "url": "...", "contentUrl": "..." },
  "address": { "@type": "PostalAddress", "addressLocality": "Munich", "addressCountry": "DE" },
  "knowsLanguage": [Language objects for English, German, Russian],
  "sameAs": [LinkedIn, GitHub — no self-reference to own domain],
  "hasOccupation": [Role → Occupation nesting with startDate/endDate on Role]
}
```

### Errors fixed during refactor

| Error | Fix |
|-------|-----|
| `sameAs` included `"https://azhyshchev.de"` | Removed — sameAs is for external profiles only |
| `image` as plain string | Changed to `ImageObject` with `url` + `contentUrl` |
| `knowsLanguage: ["en","de","ru"]` | Changed to `[{"@type":"Language","name":"English"}, ...]` |
| `Occupation` had `startDate` directly | Correct: `Role` (has startDate/endDate) → `hasOccupation` → `Occupation` |
| Subpages missing `isPartOf` on WebPage | Added `"isPartOf":{"@id":"https://azhyshchev.de/#website"}` to all |
| `author` in subpages was inline Person | Changed to `{"@id":"https://azhyshchev.de/#person"}` |
| `areaServed: ["DE","EU"]` — "EU" not valid ISO | Replaced with Country objects: Germany, Austria, Switzerland |
| `ItemList` had no `@id` | Added `"@id":"https://azhyshchev.de/projects#list"` |
| `about` in skills had anonymous Person | Extracted to graph-level Person node with `@id` |
| No `dateModified` on WebPage nodes | Added `"dateModified":"2026-05-15"` everywhere |
| `WebSite` missing `publisher` | Added `"publisher":{"@id":"https://azhyshchev.de/#person"}` |

### Pages with JSON-LD added

- `portfolio/index.html` — Person + WebSite + WebPage
- `portfolio/projects/index.html` — WebPage + ItemList (6 SoftwareApplication items)
- `portfolio/experience/index.html` — WebPage + Person (hasOccupation array)
- `portfolio/articles/index.html` — CollectionPage with `about` (German topic descriptions)
- `portfolio/skills/index.html` — WebPage + Person with `knowsAbout` array
- `portfolio/contact/index.html` — WebPage + Person with ContactPoint + Language + Country

### Refactor pass 1 — fixes applied to all 6 project pages

| Fix | Pages affected |
|-----|----------------|
| Added `description` to WebPage JSON-LD node | ai-image-automation, wallpaper-visualization-automation, ai-music-saas |
| Added `BreadcrumbList` inside WebPage JSON-LD node | All 6 project pages |
| Added missing `twitter:description` meta tag | ai-image-automation |

### Refactor pass 2 — Google Rich Results warnings fixed

Google Rich Results Test showed 2 optional warnings on `SoftwareApplication` schema:
- `offers` — missing (optional but improves rich snippet)
- `aggregateRating` — missing (left intentionally — requires real user reviews, fake data gets penalized)

Fixed by adding `Offer` node to all 6 project pages:
```json
"offers": {
  "@type": "Offer",
  "price": "0",
  "priceCurrency": "EUR",
  "availability": "https://schema.org/InStock",
  "description": "Custom development — contact for pricing"
}
```

BreadcrumbList enables Google sitelinks breadcrumb display in search results:
```json
"breadcrumb": {
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://azhyshchev.de/" },
    { "@type": "ListItem", "position": 2, "name": "Projects", "item": "https://azhyshchev.de/projects" },
    { "@type": "ListItem", "position": 3, "name": "[Project Name]" }
  ]
}
```

---

## 2. Sitemap — portfolio/sitemap.xml

- Added `<lastmod>2026-05-15</lastmod>` to all main pages
- Added `<lastmod>2026-01-01</lastmod>` to legal pages (impressum, datenschutz, agb)
- Added 6 new project page URLs (priority 0.85)

```xml
https://azhyshchev.de/projects/ai-sales-agent-rag/
https://azhyshchev.de/projects/invoice-automation-germany/
https://azhyshchev.de/projects/b2b-lead-generation-germany/
https://azhyshchev.de/projects/ai-image-automation/
https://azhyshchev.de/projects/wallpaper-visualization-automation/
https://azhyshchev.de/projects/ai-music-saas/
```

---

## 3. robots.txt — portfolio/robots.txt

Added explicit permission for AI/LLM crawlers so the portfolio content is included in AI knowledge bases:

```
User-agent: GPTBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

Sitemap: https://azhyshchev.de/sitemap.xml
```

---

## 4. Individual project pages — 6 new URLs

**Problem:** Modal content (display:none) is not indexed by Google. All project details lived in `<div class="overlay" style="display:none">` — invisible to crawlers.

**Solution:** Created standalone HTML pages per project. Modal UX on `/projects` unchanged — cards now have an "Open full page →" link that goes to the dedicated URL.

### Pages created

| URL | File | Accent color | German keywords |
|-----|------|--------------|-----------------|
| `/projects/ai-sales-agent-rag/` | `projects/ai-sales-agent-rag/index.html` | --yellow | KI Verkaufsassistent, RAG agent e-commerce |
| `/projects/invoice-automation-germany/` | `projects/invoice-automation-germany/index.html` | --blue | Rechnungsautomatisierung Deutschland, DATEV, GoBD |
| `/projects/b2b-lead-generation-germany/` | `projects/b2b-lead-generation-germany/index.html` | --mint | Leadgenerierung Deutschland, Impressum scraping |
| `/projects/ai-image-automation/` | `projects/ai-image-automation/index.html` | --pink | KI Bildbearbeitung, Multimodal AI |
| `/projects/wallpaper-visualization-automation/` | `projects/wallpaper-visualization-automation/index.html` | --coral | Tapetenhändler, Raumvisualisierung, Innenarchitekten |
| `/projects/ai-music-saas/` | `projects/ai-music-saas/index.html` | --coral | AI Music SaaS, Full-Stack |

### Page structure (identical for all 6)

```
Sidebar with nav (Projects = active)
Breadcrumb: Home → Projects → [Project Name]        ← BreadcrumbList schema for Google
Hero: project-type + h1 + lead text + 4 metric-boxes
2×2 content-grid: .neo-card blocks (Architecture / Business impact / Engineering decisions / CTA)
Tech stack chips
CTA strip (black background, German-language headline)
Back link: ← Back to projects
Mobile bottom nav
Hamburger script
```

### JSON-LD on each project page

Every project page has:
- `WebPage` with `isPartOf`, `author @id`, `breadcrumb` (BreadcrumbList)
- `SoftwareApplication` with `applicationCategory`, `author @id`, `operatingSystem`, `offers`

---

## 5. Cards on /projects updated

Each of the 5 modal-based project cards now has an "Open full page →" link in the card footer pointing to its dedicated URL. The link uses `onclick="event.stopPropagation()"` so clicking it navigates to the page instead of opening the modal.

```html
<a class="read-link" href="/projects/ai-sales-agent-rag/" onclick="event.stopPropagation()">Open full page →</a>
```

---

## 6. German market targeting

Pages targeting the German B2B market use:

- **German meta keywords:** Rechnungsautomatisierung, Leadgenerierung, Geschäftsprozessautomatisierung, KI-Automatisierung, Tapetenhändler
- **German CTAs** on invoice, lead gen, and wallpaper pages:
  - "Rechnungen automatisch verarbeiten?"
  - "Automatische Leadgenerierung für den deutschen Markt?"
  - "Haben Sie ähnliche manuelle Prozesse in Ihrem Betrieb?"
- **German compliance references:** DATEV compatibility, GoBD compliance, Impressum legal structure, Handelsregisternummer
- **DACH areaServed** in contact/person schema: Germany, Austria, Switzerland

---

## 7. Article HTML pages — 4 new URLs ✅ Done 2026-05-15

**Problem:** `/articles` page linked to LinkedIn — Google cannot index LinkedIn content for your domain. No long-tail keyword traffic.

**Solution:** Created 4 standalone HTML article pages with full body text, Article JSON-LD, BreadcrumbList, and German SEO keywords.

| URL | File | Accent | German SEO focus |
|-----|------|--------|-----------------|
| `/articles/rag-sales-agent/` | `articles/rag-sales-agent/index.html` | --yellow | KI Verkaufsassistent, Hybrid RAG, LangGraph ReAct agent |
| `/articles/b2b-lead-pipeline-germany/` | `articles/b2b-lead-pipeline-germany/index.html` | --mint | B2B Leadgenerierung Deutschland, §7 UWG, Impressum scraping |
| `/articles/wallpaper-ai-automation/` | `articles/wallpaper-ai-automation/index.html` | --coral | Photoshop Automatisierung KI, Tapetenhändler, Raumvisualisierung |
| `/articles/ai-image-composer/` | `articles/ai-image-composer/index.html` | --pink | KI Bildkomposition, Gemini multimodal, kreative Prozesse |

**Also updated:**
- `articles/index.html` — added "Read full article →" links on matching cards; added 2 new cards (B2B lead pipeline, Wallpaper automation); fixed modal click handler to allow link navigation
- `sitemap.xml` — added 4 new article URLs (priority 0.85)

**JSON-LD on each article page:** `Article` + `WebPage` with `BreadcrumbList`, German `inLanguage: "de"` on Article node, `author @id` cross-reference.

---

## Current SEO scorecard (May 2026)

| Criterion | Score | Status | Notes |
|-----------|-------|--------|-------|
| Technical SEO | 8/10 | ✅ Improved | robots, sitemap, canonical, lastmod — all done |
| AI bot access | 9/10 | ✅ | GPTBot, Claude-Web, anthropic-ai, PerplexityBot explicitly allowed |
| Indexable content | 9/10 | ✅ Improved | 6 project pages + 4 article pages with full text (was 3/10 — modals/LinkedIn not indexed) |
| Keywords in page text | 8/10 | ✅ Improved | German keywords in visible body text on all project + article pages |
| JSON-LD schema | 9/10 | ✅ | Person, WebSite, WebPage, SoftwareApplication, Article, BreadcrumbList, Offer |
| For HR/recruiter | 6/10 | → Pending | Design attracts, but no inline skills list or testimonials |
| For hiring manager | 8/10 | ✅ Improved | Projects with metrics on dedicated pages |
| Mobile | 8/10 | ✅ | Bottom nav, mobile.css, responsive grid |
| Articles as content | 8/10 | ✅ Improved | 4 full HTML article pages live (was 3/10) |
| Backlinks | 2/10 | ❌ Gap | No external sites linking to azhyshchev.de yet |

---

## Remaining gaps (what's left to do)

### Gap 1 — Articles as HTML pages ✅ DONE
Created 4 full article pages: rag-sales-agent, b2b-lead-pipeline-germany, wallpaper-ai-automation, ai-image-composer. Pushed 2026-05-15.

### Gap 2 — Backlinks (zero currently)
**Current state:** No external sites link to azhyshchev.de.
**Why it matters:** Google ranks pages partly by how many other sites reference them.
**Quick wins:**
- Add link to azhyshchev.de in every LinkedIn post's first comment
- Add to GitHub profile README: `Portfolio: https://azhyshchev.de`
- Submit to: wellfound.com/u/profile, dev.to author profile, Munich tech directories

### Gap 3 — No German-language pages
**Current state:** All content in English. German businesses often search in German.
**Quick win (no layout changes needed):** Duplicate the 2 most commercial project pages in German:
- `/projekte/rechnungsautomatisierung/` — ranks for "Rechnungsautomatisierung Software"
- `/projekte/leadgenerierung-deutschland/` — ranks for "Leadgenerierung automatisieren"

---

## How to verify

1. **Google Rich Results Test:** https://search.google.com/test/rich-results — paste any page URL
2. **Schema.org Validator:** https://validator.schema.org — paste page URL
3. **Google Search Console:** submit sitemap.xml after deploying
4. **After deploy:** `site:azhyshchev.de` in Google — new project pages should appear within 1-4 weeks

---

## What to do next (priority order)

### Immediate (before next push)
- [ ] **Push to GitHub Pages** — run `git add . && git commit -m "SEO: JSON-LD, project pages, sitemap" && git push` inside `portfolio/` folder
- [ ] **Submit sitemap to Google Search Console** — go to https://search.google.com/search-console → Sitemaps → add `https://azhyshchev.de/sitemap.xml`
- [ ] **Request indexing** for each new project page in Search Console → URL Inspection → "Request indexing"

### Short-term (1-2 weeks)
- [ ] **Add OG image per project** — replace `Azhyschev.JPG` with project-specific screenshots or mockups in each project page's `og:image`. This dramatically improves LinkedIn share previews.
- [ ] **Link from LinkedIn articles** — add direct links to the project pages (e.g., `/projects/invoice-automation-germany/`) in your LinkedIn posts. Backlinks from LinkedIn accelerate indexing.
- [ ] **Add Google Analytics or Plausible** — track which project pages get organic traffic to know what's working.
- [ ] **Add `hreflang="de"` alternates** for German-language versions if you create DE pages in the future.

### Medium-term (1-3 months)
- [ ] **Create German-language versions** of the most commercial pages:
  - `/de/projekte/rechnungsautomatisierung/` — invoice automation in German
  - `/de/projekte/leadgenerierung-deutschland/` — B2B lead gen in German
  These would rank separately for German-language queries and reach SMBs who search only in German.
- [ ] **Add FAQ schema** to project pages — "Was ist Rechnungsautomatisierung?", "Wie funktioniert RAG?" Google shows these as expandable answers in search results (rich snippet).
- [ ] **Internal linking** — add "Related projects" links at the bottom of each project page pointing to 2-3 other relevant projects. This helps Google understand the relationship between pages and distributes PageRank.
- [ ] **Get backlinks** — submit to:
  - ProductHunt (for AI Music SaaS)
  - dev.to (technical write-ups linking back)
  - GitHub README linking to the live site
  - German tech communities (XING, Munich startup groups)

### Ongoing
- [ ] **Update `dateModified`** in all JSON-LD WebPage nodes whenever you update page content
- [ ] **Monitor Search Console** monthly for:
  - Which queries bring impressions (even at position 50+)
  - Core Web Vitals errors
  - Coverage errors (pages not indexed)
- [ ] **Add new project pages** as you complete new projects — the structure is now standardized
