/**
 * Neobrutalist Chat Widget Script
 * Instantiates a floating chat widget with English/German language options,
 * in-memory history management, client-side input sanitization, and API integration.
 */

(function() {
  'use strict';

  // Available Translations
  const translations = {
    de: {
      title: "FAQ Chat",
      langSelectTitle: "Wähle deine Sprache",
      langSelectSubtitle: "Wie möchtest du fortfahren?",
      placeholder: "Schreibe eine Nachricht...",
      send: "Senden",
      welcome: "Hallo! Ich bin dein Portfolio-Assistent. Wie kann ich dir heute helfen? (Falls du ein personalisiertes B2B-Audit erhalten hast, nenne mir gerne die entsprechende E-Mail-Adresse, damit ich deine Ergebnisse abrufen und dir präziser helfen kann!)",
      error429: "Zu viele Anfragen. Bitte versuche es später noch einmal oder wende dich direkt an azhyshchev@gmail.com.",
      error503: "Der Dienst ist derzeit nicht verfügbar. Bitte wende dich direkt an azhyshchev@gmail.com.",
      errorGeneric: "Ein Fehler ist aufgetreten. Bitte wende dich direkt an azhyshchev@gmail.com."
    },
    en: {
      title: "FAQ Chat",
      langSelectTitle: "Choose your language",
      langSelectSubtitle: "Select language to start chatting",
      placeholder: "Type a message...",
      send: "Send",
      welcome: "Hello! I'm your portfolio assistant. How can I help you today? (If you received a personalized B2B audit, feel free to share the email address it was sent to so I can retrieve your results and assist you more precisely!)",
      error429: "Too many requests. Please try again later or email azhyshchev@gmail.com directly.",
      error503: "The service is temporarily unavailable. Please email azhyshchev@gmail.com directly.",
      errorGeneric: "An error occurred. Please email azhyshchev@gmail.com directly."
    }
  };

  // Generate a unique session ID
  const generateSessionId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
  };

  // State Management
  let currentLang = null;
  let conversationHistory = []; // Limit: 8 messages total (4 rounds)
  let isWaitingResponse = false;
  let savedScrollY = 0;

  // Retrieve or generate unique sessionId
  let sessionId = sessionStorage.getItem('portfolio_chat_session_id');
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem('portfolio_chat_session_id', sessionId);
  }

  // Synchronously capture current script details at load time
  // (document.currentScript is only defined during synchronous execution)
  const currentScript = document.currentScript || document.querySelector('script[src*="chat-widget.js"]');
  const widgetToken = (currentScript && currentScript.getAttribute('data-token')) || 'dev-token-default-12345';
  
  // Resolve API Endpoint
  const getApiUrl = () => {
    const hostname = window.location.hostname;
    // Check if development environment (localhost)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      return 'http://localhost:3000/api/chat';
    }
    return '/api/chat';
  };
  const widgetApiUrl = (currentScript && currentScript.getAttribute('data-api-url')) || getApiUrl();
  const scriptSrc = currentScript ? currentScript.src : '';
  const cssUrl = scriptSrc ? scriptSrc.replace('.js', '.css') : '/js/chat-widget.css';

  // Input Sanitizer: Strips HTML tags client-side
  const sanitizeInput = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/<\/?[^>]+(>|$)/g, '');
  };

  // Setup DOM Elements and Widget Logic
  const initChatWidget = () => {
    // 1. Resolve and inject CSS
    const linkEl = document.createElement('link');
    linkEl.rel = 'stylesheet';
    linkEl.href = cssUrl;
    document.head.appendChild(linkEl);

    // 2. Create and Inject the Chat Widget Structure
    const container = document.createElement('div');
    container.id = 'neobrutalist-chat-widget';
    container.className = 'nbw-container';
    container.innerHTML = `
      <!-- Launcher Pill Button -->
      <button class="nbw-launcher" id="nbw-launcher" aria-label="Open AI chat assistant" aria-haspopup="dialog" aria-expanded="false">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">
          <path d="M12 3l-1.9 5.8a2 2 0 0 1-1.2 1.2L3 12l5.8 1.9a2 2 0 0 1 1.2 1.2L12 21l1.9-5.8a2 2 0 0 1 1.2-1.2L21 12l-5.8-1.9a2 2 0 0 1-1.2-1.2Z"></path>
        </svg>
        <span class="nbw-launcher-text">ASK AI</span>
      </button>

      <!-- Chat Drawer -->
      <div class="nbw-drawer" id="nbw-drawer" style="display: none;" role="dialog" aria-label="Chat window">
        <!-- Header -->
        <div class="nbw-header">
          <span class="nbw-title" id="nbw-header-title">FAQ Chat</span>
          <div class="nbw-header-actions">
            <a class="nbw-book-btn" href="https://calendly.com/azhyshchev/30min?utm_source=portfolio&utm_medium=chat_widget&utm_campaign=booking&utm_content=chat_header" target="_blank" rel="noreferrer" aria-label="Book a call">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="0"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Book a call
            </a>
            <button class="nbw-lang-toggle" id="nbw-lang-toggle" style="display: none;" aria-label="Change language selection"></button>
            <button class="nbw-close-btn" id="nbw-close-btn" aria-label="Close chat window">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Scrollable screens wrapper -->
        <div class="nbw-body">
          <!-- Screen 1: Language Choice -->
          <div class="nbw-screen nbw-screen-lang" id="nbw-screen-lang">
            <h3 class="nbw-screen-title">Wähle deine Sprache<br>Choose your language</h3>
            <p class="nbw-screen-subtitle">Wie möchtest du chatten? / Select your language</p>
            <div class="nbw-lang-buttons">
              <button class="nbw-lang-btn" data-lang="de">Deutsch</button>
              <button class="nbw-lang-btn" data-lang="en">English</button>
            </div>
          </div>

          <!-- Screen 2: Conversation View -->
          <div class="nbw-screen nbw-screen-chat" id="nbw-screen-chat" style="display: none;">
            <div class="nbw-messages" id="nbw-messages"></div>
            
            <!-- Typing Indicator -->
            <div class="nbw-typing" id="nbw-typing" style="display: none;" aria-live="polite" aria-label="Assistant is typing">
              <span class="nbw-dot"></span>
              <span class="nbw-dot"></span>
              <span class="nbw-dot"></span>
            </div>
          </div>
        </div>

        <!-- Footer / Input Form -->
        <div class="nbw-footer" id="nbw-footer" style="display: none;">
          <div class="nbw-input-container">
            <textarea class="nbw-input" id="nbw-input" rows="1" maxlength="500" placeholder="Type a message..." aria-label="Write your message"></textarea>
            <div class="nbw-counter" id="nbw-counter">0 / 500</div>
          </div>
          <button class="nbw-send-btn" id="nbw-send-btn" aria-label="Send message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // 3. Cache DOM Element References
    const launcher = document.getElementById('nbw-launcher');
    const drawer = document.getElementById('nbw-drawer');
    const closeBtn = document.getElementById('nbw-close-btn');
    const langToggle = document.getElementById('nbw-lang-toggle');
    const chatInput = document.getElementById('nbw-input');
    const chatCounter = document.getElementById('nbw-counter');
    const sendBtn = document.getElementById('nbw-send-btn');
    
    const screenLang = document.getElementById('nbw-screen-lang');
    const screenChat = document.getElementById('nbw-screen-chat');
    const footer = document.getElementById('nbw-footer');
    const messagesBox = document.getElementById('nbw-messages');
    const typingIndicator = document.getElementById('nbw-typing');

    // 4. Auxiliary functions
    const scrollToBottom = () => {
      screenChat.scrollTop = screenChat.scrollHeight;
    };

    const showScreen = (screen) => {
      if (screen === 'lang') {
        screenLang.style.display = 'flex';
        screenChat.style.display = 'none';
        footer.style.display = 'none';
        langToggle.style.display = 'none';
      } else {
        screenLang.style.display = 'none';
        screenChat.style.display = 'flex';
        footer.style.display = 'flex';
        langToggle.style.display = 'inline-block';
        langToggle.textContent = currentLang.toUpperCase();
        chatInput.placeholder = translations[currentLang].placeholder;
        chatInput.focus();
      }
    };

    const trackEvent = (name, params = {}) => {
      if (typeof window.gtag === 'function') {
        window.gtag('event', name, params);
      }
    };

    const openDrawer = () => {
      launcher.style.display = 'none';
      launcher.setAttribute('aria-expanded', 'true');
      drawer.style.display = 'flex';
      drawer.classList.remove('closing');
      trackEvent('chat_open');
      
      // Lock background scrolling on mobile
      if (window.innerWidth <= 480) {
        savedScrollY = window.scrollY;
        document.body.style.top = `-${savedScrollY}px`;
        document.body.classList.add('nbw-no-scroll');
      }

      // Check if language has already been selected and persisted in sessionStorage
      const savedLang = sessionStorage.getItem('portfolio_chat_lang');
      if (savedLang && translations[savedLang]) {
        currentLang = savedLang;
        showScreen('chat');
        // Load initial assistant prompt if the messages container is empty
        if (messagesBox.children.length === 0) {
          appendMessage('assistant', translations[currentLang].welcome);
        }
      } else {
        showScreen('lang');
      }
    };

    const closeDrawer = () => {
      drawer.classList.add('closing');
      launcher.setAttribute('aria-expanded', 'false');
      
      // Unlock background scrolling and restore scroll position
      document.body.classList.remove('nbw-no-scroll');
      document.body.style.top = '';
      window.scrollTo(0, savedScrollY);
      
      let animationEnded = false;
      const handleCloseAnimation = (e) => {
        if (e && e.target !== drawer) return;
        if (animationEnded) return;
        animationEnded = true;
        
        drawer.style.display = 'none';
        drawer.classList.remove('closing');
        launcher.style.display = 'flex';
        drawer.removeEventListener('animationend', handleCloseAnimation);
      };

      drawer.addEventListener('animationend', handleCloseAnimation);

      // Fallback timeout to ensure launcher is restored even if animationend event is missed
      setTimeout(() => {
        if (!animationEnded) {
          handleCloseAnimation();
        }
      }, 300);
    };

    const appendMessage = (role, text) => {
      const msg = document.createElement('div');
      msg.className = `nbw-msg nbw-msg-${role}`;
      // Escape HTML first (XSS), then make URLs clickable
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      msg.innerHTML = escaped.replace(
        /(https?:\/\/[^\s<>"]+)/g,
        '<a href="$1" target="_blank" rel="noreferrer noopener">$1</a>'
      );
      messagesBox.appendChild(msg);
      scrollToBottom();
    };

    const handleLanguageSelection = (lang) => {
      if (translations[lang]) {
        currentLang = lang;
        sessionStorage.setItem('portfolio_chat_lang', lang);
        trackEvent('chat_language_selected', { language: lang });
        conversationHistory = [];
        messagesBox.innerHTML = '';
        
        showScreen('chat');
        appendMessage('assistant', translations[lang].welcome);
      }
    };

    const resetLanguage = () => {
      sessionStorage.removeItem('portfolio_chat_lang');
      currentLang = null;
      conversationHistory = [];
      messagesBox.innerHTML = '';
      showScreen('lang');
    };

    const sendMessage = async () => {
      if (isWaitingResponse) return;

      const rawInput = chatInput.value;
      const sanitized = sanitizeInput(rawInput).trim();

      if (!sanitized) return;

      // 1. Append user message to UI immediately
      appendMessage('user', sanitized);
      trackEvent('chat_message_sent', { language: currentLang });
      if (/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(sanitized)) {
        trackEvent('generate_lead', { method: 'chat_email' });
      }

      // 2. Clear input area and reset heights & counters
      chatInput.value = '';
      chatInput.style.height = 'auto';
      chatCounter.textContent = '0 / 500';
      chatCounter.classList.remove('limit-reached');

      // 3. Display typing indicator
      isWaitingResponse = true;
      typingIndicator.style.display = 'inline-flex';
      scrollToBottom();

      // 4. Capture current history and send payload to API
      const historyCopy = [...conversationHistory];
      const payload = {
        message: sanitized,
        lang: currentLang,
        history: historyCopy,
        sessionId: sessionId
      };

      try {
        const response = await fetch(widgetApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Widget-Token': widgetToken
          },
          body: JSON.stringify(payload)
        });

        // Hide typing indicator
        typingIndicator.style.display = 'none';
        isWaitingResponse = false;

        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        const reply = data.reply || data.message || '';

        // 5. Append assistant reply to UI
        appendMessage('assistant', reply);

        // 6. Push local messages to conversation history array (Limit: 8 messages / 4 rounds)
        conversationHistory.push({ role: 'user', parts: [{ text: sanitized }] });
        conversationHistory.push({ role: 'model', parts: [{ text: reply }] });

        while (conversationHistory.length > 8) {
          conversationHistory.shift();
        }

      } catch (err) {
        // Hide typing indicator
        typingIndicator.style.display = 'none';
        isWaitingResponse = false;

        console.error('Chat Widget communication failure:', err);

        let status = 0;
        if (err && typeof err.status === 'number') {
          status = err.status;
        }

        // Show friendly user message depending on response status code
        let errorMessage = '';
        if (status === 429) {
          errorMessage = translations[currentLang].error429;
        } else if (status === 503) {
          errorMessage = translations[currentLang].error503;
        } else {
          errorMessage = translations[currentLang].errorGeneric;
        }

        appendMessage('error', errorMessage);
      }
    };

    // 5. Event Listeners Setup
    
    // Toggle widget view
    launcher.addEventListener('click', openDrawer);
    closeBtn.addEventListener('click', closeDrawer);

    // Language selection screen buttons
    screenLang.addEventListener('click', (e) => {
      const btn = e.target.closest('.nbw-lang-btn');
      if (btn) {
        const selected = btn.getAttribute('data-lang');
        handleLanguageSelection(selected);
      }
    });

    // Reset language button in header
    langToggle.addEventListener('click', resetLanguage);

    // Dynamic input heights and limit enforcement
    chatInput.addEventListener('input', () => {
      // Auto-grow height up to maximum styled height
      chatInput.style.height = 'auto';
      chatInput.style.height = `${Math.min(chatInput.scrollHeight, 80)}px`;

      // Character counter update
      const length = chatInput.value.length;
      chatCounter.textContent = `${length} / 500`;

      if (length >= 500) {
        chatCounter.classList.add('limit-reached');
      } else {
        chatCounter.classList.remove('limit-reached');
      }
    });

    // Handle enter submission (exclude Shift+Enter)
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Send button click
    sendBtn.addEventListener('click', sendMessage);
  };

  // 6. Page load trigger with a brief delay (500ms) for smoother rendering
  const startWidgetTimer = () => {
    setTimeout(initChatWidget, 500);
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    startWidgetTimer();
  } else {
    document.addEventListener('DOMContentLoaded', startWidgetTimer);
  }

})();
