document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resultsSection = document.getElementById('resultsSection');
    const loadingSection = document.getElementById('loadingSection');
    const errorMessage = document.getElementById('errorMessage');
    const breakdownGrid = document.getElementById('breakdownGrid');
    
    // API Config (Google Cloud Run europe-west3 Frankfurt)
    const API_BASE_URL = 'https://ai-readiness-api-377331886416.europe-west3.run.app'; 
    // const API_BASE_URL = 'http://localhost:8000'; 

    // Detect current page language
    const currentLang = (document.documentElement.lang || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';

    const I18N = {
        en: {
            enterValidUrl: 'Please enter a valid URL',
            serviceUnavailable: 'Analysis service is temporarily unavailable. Please try again in a moment.',
            genericFailed: 'Analysis failed. Make sure the URL is accessible.',
            csrWarning: '⚠ JavaScript-rendered site — AI agents cannot read JS-only content. Score reflects what crawlers actually see.',
            verdicts: {
                optimal: 'Optimal',
                needsImprovement: 'Needs Improvement',
                critical: 'Critical'
            },
            titles: {
                agent_readable_content: 'Agent Readable Content',
                server_side_rendering: 'Server-Side Rendering',
                ai_agent_access: 'AI Bot Access',
                schema_org: 'Schema.org Entity Graph',
                llms_txt: 'llms.txt',
                markdown_availability: 'Markdown Availability',
                token_economics: 'Token Economics',
                performance: 'Performance (TTFB)',
                sitemap: 'XML Sitemap'
            },
            details: {
                'All major AI bots allowed': 'All major AI bots allowed (GPTBot, ClaudeBot, PerplexityBot)',
                'Sitemap found in robots.txt': 'Sitemap declared in robots.txt',
                'Good SSR/SSG detected': 'Clean server-side HTML rendered',
                'llms.txt found': 'Valid llms.txt manifest detected',
                'Markdown found at /index.md': 'Clean markdown endpoint available (/index.md)',
                'Markdown found at /README.md': 'Markdown endpoint available (/README.md)',
                'No Schema.org detected': 'No JSON-LD Schema.org entity markup found',
                'JavaScript-rendered site (CSR)': 'Client-side rendered shell (React/Vue/Angular)'
            },
            recommendations: {
                'Expand content': 'Provide more semantic textual content for LLM ingestion',
                'Add JSON-LD Schema.org markup (Organization, Product, FAQPage)': 'Add JSON-LD Schema.org markup (Organization, WebApplication, FAQPage)',
                'Switch to Next.js/Nuxt SSR so AI crawlers can read your content': 'Switch to SSR/SSG so AI crawlers can read without JavaScript',
                'Switch to SSR/SSG — AI agents can\'t execute JavaScript': 'Enable server-side rendering for AI crawler accessibility'
            },
            explainToggle: 'What is this? How to fix it',
            explainHide: 'Hide explanation',
            explainWhat: 'What it means',
            explainFix: 'How to fix',
            explain: {
                agent_readable_content: {
                    what: 'How much real text an AI crawler finds in the first HTML response — that text is all ChatGPT or Perplexity can quote.',
                    fix: 'Ship 800+ words of copy inside <main>/<article>, not in images, PDFs or JS widgets.'
                },
                ai_agent_access: {
                    what: 'Whether robots.txt lets the AI crawlers in: GPTBot, ClaudeBot, PerplexityBot and 5 more.',
                    fix: 'Drop the Disallow rules for those bots — one "User-agent: GPTBot" + "Allow: /" block per crawler.'
                },
                server_side_rendering: {
                    what: 'Does your HTML arrive with the content already inside, or does JavaScript build it in the browser?',
                    fix: 'Move to SSR/SSG (Next.js, Nuxt, Astro) or prerender pages — AI crawlers do not execute JavaScript.'
                },
                schema_org: {
                    what: 'Machine-readable JSON-LD that tells AI what your page is about: Organization, Person, Product, FAQ.',
                    fix: 'Add JSON-LD in a script tag of type application/ld+json. Microdata still counts, but scores lower.'
                },
                performance: {
                    what: 'Time to first byte: how fast your server answers one crawler request.',
                    fix: 'Cache HTML at the edge (CDN) and cut server-side work. Target: under 200 ms.'
                },
                token_economics: {
                    what: 'How many tokens your page costs to read (characters ÷ 4). A bloated DOM burns the crawler\'s context budget.',
                    fix: 'Trim markup, drop inline scripts, hidden blocks and repeated boilerplate so the real text dominates.'
                },
                sitemap: {
                    what: 'An XML sitemap tells crawlers which pages exist, so nothing valuable stays undiscovered.',
                    fix: 'Publish /sitemap.xml and reference it with a "Sitemap:" line in robots.txt.'
                },
                llms_txt: {
                    what: 'llms.txt is a small Markdown file that summarises your site for AI models — like robots.txt, but for LLMs.',
                    fix: 'Publish /llms.txt with your key pages and one-line descriptions (+10 points).'
                },
                markdown_availability: {
                    what: 'Whether a page can also be served as clean Markdown — the cheapest format for an LLM to ingest.',
                    fix: 'Offer /index.md or an "Accept: text/markdown" variant. Bonus only — most sites skip it.'
                }
            }
        },
        de: {
            enterValidUrl: 'Bitte geben Sie eine gültige URL ein',
            serviceUnavailable: 'Der Analysedienst ist vorübergehend nicht erreichbar. Bitte versuchen Sie es gleich erneut.',
            genericFailed: 'Analyse fehlgeschlagen. Bitte prüfen Sie, ob die URL öffentlich erreichbar ist.',
            csrWarning: '⚠ JavaScript-gerenderte Website — KI-Agenten können reine JS-Inhalte nicht ausführen. Der Score zeigt, was KI-Crawler tatsächlich sehen.',
            verdicts: {
                optimal: 'Optimal',
                needsImprovement: 'Verbesserungswürdig',
                critical: 'Kritisch'
            },
            titles: {
                agent_readable_content: 'KI-lesbarer Textinhalt',
                server_side_rendering: 'Serverseitiges Rendering (SSR)',
                ai_agent_access: 'KI-Crawler-Zugriff',
                schema_org: 'Schema.org Entity Graph',
                llms_txt: 'llms.txt Manifest',
                markdown_availability: 'Markdown-Endpunkt',
                token_economics: 'Token-Ökonomie',
                performance: 'Ladezeit & Performance',
                sitemap: 'XML-Sitemap'
            },
            details: {
                'All major AI bots allowed': 'Alle wichtigen KI-Bots erlaubt (GPTBot, ClaudeBot, Perplexity)',
                'Sitemap found in robots.txt': 'Sitemap in robots.txt hinterlegt',
                'Good SSR/SSG detected': 'Sauberes serverseitiges HTML gerendert',
                'llms.txt found': 'Gültiges llms.txt Manifest gefunden',
                'Markdown found at /index.md': 'Reiner Markdown-Endpunkt verfügbar (/index.md)',
                'Markdown found at /README.md': 'Markdown-Endpunkt verfügbar (/README.md)',
                'No Schema.org detected': 'Keine JSON-LD Schema.org Daten gefunden',
                'JavaScript-rendered site (CSR)': 'Client-seitiges JS-Rendering (React/Vue/Angular)'
            },
            recommendations: {
                'Expand content': 'Mehr semantischen Fließtext für KI-Crawler bereitstellen',
                'Add JSON-LD Schema.org markup (Organization, Product, FAQPage)': 'JSON-LD Schema.org Entitäten hinzufügen (Organization, FAQPage)',
                'Switch to Next.js/Nuxt SSR so AI crawlers can read your content': 'Auf SSR/SSG umstellen, damit KI-Crawler Inhalte ohne JS lesen können',
                'Switch to SSR/SSG — AI agents can\'t execute JavaScript': 'Serverseitiges Rendering aktivieren für vollständige KI-Sichtbarkeit'
            },
            explainToggle: 'Was ist das? So beheben',
            explainHide: 'Erklärung ausblenden',
            explainWhat: 'Was es bedeutet',
            explainFix: 'So beheben',
            explain: {
                agent_readable_content: {
                    what: 'Wie viel echter Text ein KI-Crawler in der ersten HTML-Antwort findet — genau dieser Text kann von ChatGPT oder Perplexity zitiert werden.',
                    fix: '800+ Wörter Text in <main>/<article> ausliefern, nicht in Bildern, PDFs oder JS-Widgets.'
                },
                ai_agent_access: {
                    what: 'Ob robots.txt die KI-Crawler überhaupt reinlässt: GPTBot, ClaudeBot, PerplexityBot und 5 weitere.',
                    fix: 'Disallow-Regeln für diese Bots entfernen — je Crawler ein Block "User-agent: GPTBot" + "Allow: /".'
                },
                server_side_rendering: {
                    what: 'Kommt der Inhalt schon im HTML an, oder baut JavaScript ihn erst im Browser?',
                    fix: 'Auf SSR/SSG umstellen (Next.js, Nuxt, Astro) oder Seiten vorrendern — KI-Crawler führen kein JavaScript aus.'
                },
                schema_org: {
                    what: 'Maschinenlesbares JSON-LD, das der KI sagt, worum es auf der Seite geht: Organization, Person, Product, FAQ.',
                    fix: 'JSON-LD in einem Script-Tag vom Typ application/ld+json einbauen. Microdata zählt, aber mit weniger Punkten.'
                },
                performance: {
                    what: 'Time to first byte: wie schnell Ihr Server eine einzelne Crawler-Anfrage beantwortet.',
                    fix: 'HTML am Edge cachen (CDN) und Serverarbeit reduzieren. Ziel: unter 200 ms.'
                },
                token_economics: {
                    what: 'Wie viele Tokens die Seite zum Lesen kostet (Zeichen ÷ 4). Ein aufgeblähtes DOM verbraucht das Kontextbudget des Crawlers.',
                    fix: 'Markup verschlanken, Inline-Skripte, versteckte Blöcke und wiederholte Boilerplate entfernen.'
                },
                sitemap: {
                    what: 'Eine XML-Sitemap zeigt Crawlern, welche Seiten existieren — sonst bleiben Inhalte unentdeckt.',
                    fix: '/sitemap.xml veröffentlichen und in robots.txt mit einer "Sitemap:"-Zeile verlinken.'
                },
                llms_txt: {
                    what: 'llms.txt ist eine kleine Markdown-Datei, die Ihre Website für KI-Modelle zusammenfasst — wie robots.txt, nur für LLMs.',
                    fix: '/llms.txt mit den wichtigsten Seiten und Ein-Satz-Beschreibungen anlegen (+10 Punkte).'
                },
                markdown_availability: {
                    what: 'Ob eine Seite auch als sauberes Markdown ausgeliefert werden kann — das günstigste Format für ein LLM.',
                    fix: '/index.md oder eine Variante mit "Accept: text/markdown" anbieten. Nur Bonus — die meisten Seiten haben das nicht.'
                }
            }
        }
    };

    const t = I18N[currentLang];

    async function handleAnalyze() {
        let url = urlInput.value.trim();
        if (!url) {
            showError(t.enterValidUrl);
            return;
        }

        // Auto-prepend https:// if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
            urlInput.value = url;
        }

        // Reset UI
        errorMessage.classList.add('hidden');
        resultsSection.classList.add('hidden');
        document.getElementById('inlineCta').classList.add('hidden');
        loadingSection.classList.remove('hidden');
        analyzeBtn.disabled = true;

        try {
            console.log('Starting analysis for:', url);
            // Propagate page language + campaign params so a logged run knows its source
            const query = new URLSearchParams({ url: url, lang: currentLang });
            const pageParams = new URLSearchParams((window.location && window.location.search) || '');
            ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (key) {
                const value = pageParams.get(key);
                if (value) query.set(key, value);
            });
            const response = await fetch(`${API_BASE_URL}/api/analyze?${query.toString()}`);
            const data = await response.json();

            if (!response.ok) {
                console.error('API Error Response:', data);
                throw new Error(data.detail || t.genericFailed);
            }

            console.log('Analysis result received:', data);
            displayResults(data);
        } catch (err) {
            console.error('Fetch Error:', err);
            if (err.message && err.message.includes('Failed to fetch')) {
                showError(t.serviceUnavailable);
            } else {
                showError(err.message || t.genericFailed);
            }
        } finally {
            loadingSection.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    }

    // Trigger on Button Click
    analyzeBtn.addEventListener('click', handleAnalyze);

    // 🐛 Fix: Trigger on Enter keypress
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAnalyze();
        }
    });

    function displayResults(data) {
        // Top section
        document.getElementById('targetUrl').textContent = data.url;
        const scoreVal = document.getElementById('scoreValue');
        scoreVal.textContent = data.score;
        
        // Color coding score
        scoreVal.className = 'score-num ' + getTotalScoreClass(data.score);
        
        const verdictBadge = document.getElementById('verdictBadge');
        // Backend owns the thresholds (>=90 Optimal, >=70 Needs Improvement) —
        // localize its verdict instead of re-deriving it from the score here.
        const verdictLabels = {
            'Optimal': t.verdicts.optimal,
            'Needs Improvement': t.verdicts.needsImprovement,
            'Critical': t.verdicts.critical
        };
        const verdictText = verdictLabels[data.verdict] || data.verdict;

        verdictBadge.textContent = verdictText;
        verdictBadge.className = 'verdict-badge ' + getBgClass(data.score);

        // Progress bar
        const progressBar = document.getElementById('progressBar');
        progressBar.style.width = data.score + '%';
        progressBar.className = 'progress-bar ' + getBgClass(data.score);

        // CSR warning badge
        const existing = document.getElementById('csrWarning');
        if (existing) existing.remove();
        if (data.is_csr) {
            const warning = document.createElement('div');
            warning.id = 'csrWarning';
            warning.className = 'csr-warning';
            warning.textContent = t.csrWarning;
            document.getElementById('resultsSection').insertBefore(warning, breakdownGrid);
        }

        // CSR explainer block
        const csrExplainer = document.getElementById('csrExplainer');
        if (data.is_csr) {
            csrExplainer.classList.remove('hidden');
        } else {
            csrExplainer.classList.add('hidden');
        }

        // Grid
        breakdownGrid.innerHTML = '';
        const keys = Object.keys(data.breakdown);
        keys.forEach(key => {
            const check = data.breakdown[key];
            const card = createCheckCard(key, check);
            breakdownGrid.appendChild(card);
        });

        const localeString = currentLang === 'de' ? 'de-DE' : 'en-US';
        document.getElementById('checkedAt').textContent = new Date(data.checked_at).toLocaleString(localeString);

        // Show inline CTA always after analysis
        document.getElementById('inlineCta').classList.remove('hidden');

        // Show bottom CTA block whenever any check is not full.
        // Score alone can no longer hide gaps (score is a plain sum of all checks),
        // but a 100/-near-100 site with one gap still deserves the fix-it CTA.
        const ctaBlock = document.getElementById('ctaBlock');
        if (ctaBlock) {
            const hasGaps = Object.values(data.breakdown).some(function (check) {
                return check.points < check.max;
            });
            if (hasGaps) {
                ctaBlock.classList.remove('hidden');
            } else {
                ctaBlock.classList.add('hidden');
            }
        }

        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Escape API/i18n-provided text before injecting it into innerHTML
    // (explanation strings legitimately contain <main>, <article>, "quotes").
    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }

    function createCheckCard(id, check) {
        const card = document.createElement('div');
        card.className = 'check-card';
        
        const scorePercentage = (check.points / check.max) * 100;
        const scoreClass = getScoreClass(scorePercentage);

        const localizedTitle = t.titles[id] || formatTitle(id);
        const localizedDetail = t.details[check.detail] || check.detail;
        const localizedRec = check.recommendation ? (t.recommendations[check.recommendation] || check.recommendation) : null;

        // Short "what it means / how to fix" note. Collapsed by default on purpose:
        // cards stay scannable and the "I fix it for you" CTA keeps its weight.
        const explanation = (t.explain && t.explain[id]) || null;
        const explainHtml = explanation ? `
                <button type="button" class="check-explain-toggle" aria-expanded="false">${t.explainToggle}</button>
                <div class="check-explain-panel hidden">
                    <div class="check-explain-row">
                        <span class="check-explain-label">${t.explainWhat}</span>
                        ${escapeHtml(explanation.what)}
                    </div>
                    <div class="check-explain-row">
                        <span class="check-explain-label">${t.explainFix}</span>
                        ${escapeHtml(explanation.fix)}
                    </div>
                </div>` : '';

        card.innerHTML = `
            <div class="check-info">
                <div class="check-title">${localizedTitle}</div>
                <div class="check-detail">${localizedDetail}</div>
                ${localizedRec ? `<div class="check-recommendation">💡 ${localizedRec}</div>` : ''}
                ${explainHtml}
            </div>
            <div class="check-points ${scoreClass}">
                ${check.points === check.max ? '✅' : `${Math.round(check.points)}/${check.max}`}
            </div>
        `;

        const explainToggle = card.querySelector('.check-explain-toggle');
        if (explainToggle) {
            explainToggle.addEventListener('click', function () {
                const panel = card.querySelector('.check-explain-panel');
                const isOpen = !panel.classList.toggle('hidden');
                explainToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                explainToggle.textContent = isOpen ? t.explainHide : t.explainToggle;
                if (isOpen && typeof gtag === 'function') {
                    gtag('event', 'check_explain_open', {
                        check: id,
                        page_language: document.documentElement.lang || 'en'
                    });
                }
            });
        }

        return card;
    }

    function formatTitle(str) {
        return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    function getScoreClass(score) {
        if (score >= 80) return 'score-high';
        if (score >= 50) return 'score-mid';
        return 'score-low';
    }

    // Total-score bands mirror the backend verdict thresholds (>=90 / >=70).
    function getTotalScoreClass(score) {
        if (score >= 90) return 'score-high';
        if (score >= 70) return 'score-mid';
        return 'score-low';
    }

    function getBgClass(score) {
        if (score >= 90) return 'bg-high';
        if (score >= 70) return 'bg-mid';
        return 'bg-low';
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.classList.remove('hidden');
    }

    document.querySelectorAll('.faq-q').forEach(function(q) {
        q.addEventListener('click', function() {
            var item = q.closest('.faq-item');
            var isOpen = item.classList.toggle('open');
            if (isOpen && typeof gtag === 'function') {
                gtag('event', 'faq_open', {
                    question: q.textContent.trim().substring(0, 60),
                    page_language: document.documentElement.lang || 'en'
                });
            }
        });
    });
});
