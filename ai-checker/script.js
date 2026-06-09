document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resultsSection = document.getElementById('resultsSection');
    const loadingSection = document.getElementById('loadingSection');
    const errorMessage = document.getElementById('errorMessage');
    const breakdownGrid = document.getElementById('breakdownGrid');
    
    // API Config
    const API_BASE_URL = 'https://ai-readiness-api-production.up.railway.app'; 
    // const API_BASE_URL = 'http://localhost:8000'; 

    analyzeBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            showError('Please enter a valid URL');
            return;
        }

        // Reset UI
        errorMessage.classList.add('hidden');
        resultsSection.classList.add('hidden');
        loadingSection.classList.remove('hidden');
        analyzeBtn.disabled = true;

        try {
            console.log('Starting analysis for:', url);
            const response = await fetch(`${API_BASE_URL}/api/analyze?url=${encodeURIComponent(url)}`);
            const data = await response.json();

            if (!response.ok) {
                console.error('API Error Response:', data);
                throw new Error(data.detail || 'Analysis failed. Make sure the URL is accessible.');
            }

            console.log('Analysis result received:', data);
            displayResults(data);
        } catch (err) {
            console.error('Fetch Error:', err);
            if (err.message.includes('Failed to fetch')) {
                showError('Analysis service is temporarily unavailable. Please try again in a moment.');
            } else {
                showError(err.message);
            }
        } finally {
            loadingSection.classList.add('hidden');
            analyzeBtn.disabled = false;
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
        verdictBadge.textContent = data.verdict;
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
            warning.textContent = '⚠ JavaScript-rendered site — AI agents cannot read JS-only content. Score reflects what crawlers actually see.';
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

        document.getElementById('checkedAt').textContent = new Date(data.checked_at).toLocaleString();

        // Show CTA block if score is not optimal
        const ctaBlock = document.getElementById('ctaBlock');
        if (data.score < 80) {
            ctaBlock.classList.remove('hidden');
        } else {
            ctaBlock.classList.add('hidden');
        }

        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    function createCheckCard(id, check) {
        const card = document.createElement('div');
        card.className = 'check-card';
        
        const scorePercentage = (check.points / check.max) * 100;
        const scoreClass = getScoreClass(scorePercentage);

        card.innerHTML = `
            <div class="check-info">
                <div class="check-title">${formatTitle(id)}</div>
                <div class="check-detail">${check.detail}</div>
                ${check.recommendation ? `<div class="check-recommendation">💡 ${check.recommendation}</div>` : ''}
            </div>
            <div class="check-points ${scoreClass}">
                ${check.points === check.max ? '✅' : `${Math.round(check.points)}/${check.max}`}
            </div>
        `;
        return card;
    }

    const TITLES = {
        agent_readable_content: 'Agent Readable Content',
        server_side_rendering: 'Server-Side Rendering',
        ai_agent_access: 'AI Bot Access',
        llms_txt: 'llms.txt',
        markdown_availability: 'Markdown Availability',
        token_economics: 'Token Economics',
        performance: 'Performance',
        sitemap: 'Sitemap'
    };
    function formatTitle(str) {
        return TITLES[str] || str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
