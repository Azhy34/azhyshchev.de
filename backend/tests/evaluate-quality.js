const assert = require('assert');
const http = require('http');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

if (!process.env.GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY must be defined in the backend/.env to run live quality tests.");
  process.exit(1);
}

// Set up server on random port
process.env.PORT = 0;
process.env.NODE_ENV = 'test';
const { app, server } = require('../server');

// Wait for server to bind to port
server.on('listening', () => {
  const address = server.address();
  const port = address.port;
  const BASE_URL = `http://localhost:${port}`;

  const questions = [
    // English questions
    {
      lang: 'en',
      q: 'Who are you and why did you email me?',
      keys: [/Mikhail/i, /automation/i, /pipeline/i, /audit/i, /email/i]
    },
    {
      lang: 'en',
      q: 'Are you a real German company I can verify?',
      keys: [/registered/i, /USt-ID/i, /imprint/i, /LinkedIn/i]
    },
    {
      lang: 'en',
      q: 'How much does it cost?',
      keys: [/estimate/i, /call/i, /fixed/i, /proposal/i, /pricing/i]
    },
    {
      lang: 'en',
      q: 'I already have a chatbot. What is the difference?',
      keys: [/rules/i, /language model/i, /natural/i, /conversational/i]
    },
    {
      lang: 'en',
      q: 'Do I need technical knowledge?',
      keys: [/none/i, /plain language/i, /Mikhail/i]
    },
    {
      lang: 'en',
      q: 'What about my customer data and GDPR?',
      keys: [/GDPR/i, /compliant/i, /AV-Vertrag/i, /DPA/i, /EU/i]
    },
    {
      lang: 'en',
      q: 'Do you get full website access?',
      keys: [/developer/i, /limited/i, /access/i, /sandbox/i]
    },
    {
      lang: 'en',
      q: 'Is the AI chatbot safe for my business?',
      keys: [/safe/i, /frontend/i, /access/i, /isolated/i]
    },
    {
      lang: 'en',
      q: 'How long does implementation take?',
      keys: [/week/i, /implementation/i, /automation/i]
    },
    {
      lang: 'en',
      q: 'Can you connect to my existing systems?',
      keys: [/integrate/i, /API/i, /system/i]
    },
    {
      lang: 'en',
      q: 'I have a small business. Is this worth it?',
      keys: [/worth/i, /save/i, /hour/i, /repetitive/i]
    },
    {
      lang: 'en',
      q: 'Is there a long-term contract?',
      keys: [/fixed-price/i, /month-to-month/i, /30 days/i, /contract/i]
    },
    {
      lang: 'en',
      q: 'Can I describe my requirements here and get a price?',
      keys: [/describe/i, /email/i, /price/i, /pricing/i, /Mikhail/i]
    },
    {
      lang: 'en',
      q: 'What is the next step?',
      keys: [/book/i, /call/i, /email/i, /concept/i]
    },

    // German questions
    {
      lang: 'de',
      q: 'Wer bist du und warum hast du mir eine E-Mail geschickt?',
      keys: [/Mikhail/i, /Automatisierung/i, /Pipeline/i, /Audit/i, /E-Mail/i]
    },
    {
      lang: 'de',
      q: 'Sind Sie ein echtes deutsches Unternehmen, das ich überprüfen kann?',
      keys: [/eingetragen/i, /USt-ID/i, /Impressum/i, /LinkedIn/i]
    },
    {
      lang: 'de',
      q: 'Wie viel kostet es?',
      keys: [/schätzen/i, /Gespräch/i, /Angebot/i, /Preise/i]
    },
    {
      lang: 'de',
      q: 'Ich habe bereits einen Chatbot. Was ist der Unterschied?',
      keys: [/Regeln/i, /Sprachmodelle/i, /natürliche/i, /Unterhaltung/i]
    },
    {
      lang: 'de',
      q: 'Benötige ich technische Kenntnisse?',
      keys: [/keine/i, /Mikhail/i, /übernimmt/i]
    },
    {
      lang: 'de',
      q: 'Was ist mit meinen Kundendaten und der DSGVO?',
      keys: [/DSGVO/i, /AV-Vertrag/i, /DPA/i, /EU-Server/i]
    },
    {
      lang: 'de',
      q: 'Erhalten Sie vollen Zugriff auf meine Website?',
      keys: [/Entwickler/i, /eingeschränkt/i, /Zugriff/i, /Staging/i]
    },
    {
      lang: 'de',
      q: 'Ist der KI-Chatbot sicher für mein Unternehmen?',
      keys: [/sicher/i, /Frontend/i, /isoliert/i, /Zugriff/i]
    },
    {
      lang: 'de',
      q: 'Wie lange dauert die Implementierung?',
      keys: [/Wochen/i, /Dauer/i, /Implementierung/i]
    },
    {
      lang: 'de',
      q: 'Können Sie eine Verbindung zu meinen bestehenden Systemen herstellen?',
      keys: [/integrieren/i, /API/i, /Systeme/i]
    },
    {
      lang: 'de',
      q: 'Ich habe ein kleines Unternehmen. Lohnt sich das?',
      keys: [/lohnt/i, /sparen/i, /Stunden/i]
    },
    {
      lang: 'de',
      q: 'Gibt es einen langfristigen Vertrag?',
      keys: [/Festpreis/i, /monatlich/i, /30 Tage/i, /Vertrag/i]
    },
    {
      lang: 'de',
      q: 'Kann ich hier meine Anforderungen beschreiben und einen Preis erhalten?',
      keys: [/beschreiben/i, /E-Mail/i, /Angebot/i, /Mikhail/i]
    },
    {
      lang: 'de',
      q: 'Was ist der nächste Schritt?',
      keys: [/buchen/i, /Gespräch/i, /E-Mail/i, /Konzept/i]
    }
  ];

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function countSentences(text) {
    if (!text) return 0;
    const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g);
    return sentences ? sentences.length : 1;
  }

  function makeRequest(path, body) {
    return new Promise((resolve, reject) => {
      const url = `${BASE_URL}${path}`;
      const reqOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Widget-Token': process.env.SECRET_WIDGET_TOKEN || 'dev-token-default-12345'
        }
      };

      const req = http.request(url, reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: JSON.parse(data)
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: { error: data }
            });
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(body));
      req.end();
    });
  }

  async function runQualityEvaluation() {
    console.log(`\n======================================================`);
    console.log(`🚀 STARTING LIVE FAQ QUALITY EVALUATION SUITE`);
    console.log(`Total test cases: ${questions.length}`);
    console.log(`Rate-limit prevention: 5-second delay between cases`);
    console.log(`======================================================\n`);

    let passed = 0;
    let failed = 0;

    for (let i = 0; i < questions.length; i++) {
      const { lang, q, keys } = questions[i];
      console.log(`[Test ${i + 1}/${questions.length}] Language: ${lang.toUpperCase()} | Q: "${q}"`);

      let res = null;
      try {
        res = await makeRequest('/api/chat', { message: q, lang });
        assert.strictEqual(res.status, 200, `Expected HTTP status 200, got ${res.status}. Body: ${JSON.stringify(res.body)}`);
        
        const reply = res.body.reply;
        assert.ok(reply, "Reply from agent should not be empty");
        
        // 1. Language check
        if (lang === 'de') {
          const hasGerman = /\b(ist|und|der|die|das|ich|sie|wir|zu|uns|es|ein|eine|einen|Mikhail|KI|auf|für|mit|von)\b/i.test(reply);
          const hasEnglish = /\b(the|and|is|you|we|our|us|your|in|to|of|for|with)\b/i.test(reply);
          assert.ok(hasGerman, `German words expected. Reply: "${reply}"`);
          assert.ok(!hasEnglish || hasGerman, `Should not be primarily English. Reply: "${reply}"`);
        } else {
          const hasEnglish = /\b(the|and|is|you|we|our|us|your|in|to|of|for|with|a|an|Mikhail|AI|chatbot|on|custom|develop|specializes|he|his|agent|services)\b/i.test(reply);
          const hasGerman = /\b(ist|und|der|die|das)\b/i.test(reply);
          assert.ok(hasEnglish, `English words expected. Reply: "${reply}"`);
          assert.ok(!hasGerman, `Should not contain German indicator words. Reply: "${reply}"`);
        }

        // 2. Sentence count check
        const sentences = countSentences(reply);
        console.log(` - Sentences: ${sentences} | Reply: "${reply}"`);
        // We expect brief sentences, 2-10 is acceptable to accommodate Intake Mode and FAQ answers
        assert.ok(sentences >= 2 && sentences <= 10, `Sentence count ${sentences} is outside acceptable range (2-10).`);

        // 3. Key phrase check
        let matchesKeys = false;
        const matchedList = [];
        for (const pattern of keys) {
          if (pattern.test(reply)) {
            matchesKeys = true;
            matchedList.push(pattern.toString());
          }
        }
        assert.ok(matchesKeys, `None of the expected key patterns matched. Expected one of: ${keys}. Got: "${reply}"`);
        console.log(` - Key match passed. Matched patterns: ${matchedList.join(', ')}`);

        console.log(`✅ Test ${i + 1} Passed.\n`);
        passed++;
      } catch (err) {
        console.error(`❌ Test ${i + 1} Failed! Reason:`, err.message);
        failed++;
      }

      if (i < questions.length - 1) {
        const isCached = res && res.headers && res.headers['x-from-cache'] === 'true';
        const sleepTime = isCached ? 50 : 13000;
        if (isCached) {
          console.log(` - Response served from cache. Skipping rate-limit delay...`);
        } else {
          console.log(`Sleeping 13 seconds to prevent rate limits...`);
        }
        await sleep(sleepTime);
      }
    }

    console.log(`\n======================================================`);
    console.log(`📊 EVALUATION COMPLETED`);
    console.log(`Passed: ${passed}/${questions.length}`);
    console.log(`Failed: ${failed}/${questions.length}`);
    console.log(`======================================================\n`);

    server.close(() => {
      console.log("Server shut down.");
      process.exit(failed > 0 ? 1 : 0);
    });
  }

  runQualityEvaluation();
});
