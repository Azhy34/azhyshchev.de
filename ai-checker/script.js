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
            const response = await fetch(`${API_BASE_URL}/api/analyze?url=${encodeURIComponent(url)}`);
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
        scoreVal.className = 'score-num ' + getScoreClass(data.score);
        
        const verdictBadge = document.getElementById('verdictBadge');
        let verdictText = data.verdict;
        if (data.score >= 80) verdictText = t.verdicts.optimal;
        else if (data.score >= 55) verdictText = t.verdicts.needsImprovement;
        else verdictText = t.verdicts.critical;

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

        // Show bottom CTA block if score is not optimal
        const ctaBlock = document.getElementById('ctaBlock');
        if (ctaBlock) {
            if (data.score < 80) {
                ctaBlock.classList.remove('hidden');
            } else {
                ctaBlock.classList.add('hidden');
            }
        }

        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    function createCheckCard(id, check) {
        const card = document.createElement('div');
        card.className = 'check-card';
        
        const scorePercentage = (check.points / check.max) * 100;
        const scoreClass = getScoreClass(scorePercentage);

        const localizedTitle = t.titles[id] || formatTitle(id);
        const localizedDetail = t.details[check.detail] || check.detail;
        const localizedRec = check.recommendation ? (t.recommendations[check.recommendation] || check.recommendation) : null;

        card.innerHTML = `
            <div class="check-info">
                <div class="check-title">${localizedTitle}</div>
                <div class="check-detail">${localizedDetail}</div>
                ${localizedRec ? `<div class="check-recommendation">💡 ${localizedRec}</div>` : ''}
            </div>
            <div class="check-points ${scoreClass}">
                ${check.points === check.max ? '✅' : `${Math.round(check.points)}/${check.max}`}
            </div>
        `;
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

    function getBgClass(score) {
        if (score >= 80) return 'bg-high';
        if (score >= 50) return 'bg-mid';
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
