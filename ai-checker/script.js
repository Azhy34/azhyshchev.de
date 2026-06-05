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
                showError('Cannot connect to the analysis engine. Please ensure you have run "python main.py" in the portfolio/api folder.');
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

        // Grid
        breakdownGrid.innerHTML = '';
        const keys = Object.keys(data.breakdown);
        keys.forEach(key => {
            const check = data.breakdown[key];
            const card = createCheckCard(key, check);
            breakdownGrid.appendChild(card);
        });

        document.getElementById('checkedAt').textContent = new Date(data.checked_at).toLocaleString();
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

    function formatTitle(str) {
        return str.split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
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
});
