const assert = require('assert');
const http = require('http');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

if (!process.env.OPENROUTER_API_KEY) {
  console.error("Error: OPENROUTER_API_KEY must be defined in the backend/.env to run live quality tests.");
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
    },

    // --- OFF-TOPIC TESTS (agent must decline and redirect, not answer directly) ---
    // offTopic: true — checks that reply contains redirect phrases and does NOT give a direct answer
    {
      lang: 'en',
      q: 'Can you write me a Python function to sort a list?',
      offTopic: true,
      mustNotContain: [/def sort/i, /sorted\(/i, /\.sort\(/i],
      mustContain: [/automation/i, /Mikhail/i, /scope/i, /B2B/i, /help/i]
    },
    {
      lang: 'en',
      q: "What's the weather like in Munich today?",
      offTopic: true,
      mustNotContain: [/°C/i, /celsius/i, /sunny/i, /cloudy/i, /rain/i, /forecast/i],
      mustContain: [/automation/i, /Mikhail/i, /assist/i, /scope/i, /help/i]
    },
    {
      lang: 'en',
      q: 'Tell me a joke.',
      offTopic: true,
      mustNotContain: [/why did/i, /knock knock/i, /punchline/i, /laughs/i],
      mustContain: [/automation/i, /Mikhail/i, /help/i, /scope/i, /B2B/i]
    },
    {
      lang: 'en',
      q: 'Who won the last FIFA World Cup?',
      offTopic: true,
      mustNotContain: [/Argentina/i, /France/i, /Brazil/i, /Germany/i, /Spain/i, /trophy/i],
      mustContain: [/automation/i, /Mikhail/i, /help/i, /scope/i]
    },
    {
      lang: 'en',
      q: 'Can you write me a cover letter for a job application?',
      offTopic: true,
      mustNotContain: [/Dear Hiring/i, /I am writing to apply/i, /sincerely/i],
      mustContain: [/automation/i, /Mikhail/i, /scope/i, /B2B/i]
    },
    {
      lang: 'de',
      q: 'Kannst du mir ein Python-Skript zum Sortieren einer Liste schreiben?',
      offTopic: true,
      mustNotContain: [/def sort/i, /sorted\(/i, /\.sort\(/i],
      mustContain: [/Automatisierung/i, /Mikhail/i, /helfen/i, /Bereich/i, /B2B/i]
    },
    {
      lang: 'de',
      q: 'Wie ist das Wetter heute in München?',
      offTopic: true,
      mustNotContain: [/°C/i, /Celsius/i, /sonnig/i, /bewölkt/i, /Regen/i, /Prognose/i],
      mustContain: [/Automatisierung/i, /Mikhail/i, /helfen/i, /Bereich/i]
    },
    {
      lang: 'de',
      q: 'Erzähl mir einen Witz.',
      offTopic: true,
      mustNotContain: [/Warum/i, /Klopf klopf/i, /lacht/i, /Pointe/i],
      mustContain: [/Automatisierung/i, /Mikhail/i, /helfen/i, /B2B/i]
    },
    {
      lang: 'de',
      q: 'Wer hat die letzte Fußball-Weltmeisterschaft gewonnen?',
      offTopic: true,
      mustNotContain: [/Argentinien/i, /Frankreich/i, /Brasilien/i, /Pokal/i],
      mustContain: [/Automatisierung/i, /Mikhail/i, /helfen/i]
    },

    // --- OBJECTION TESTS ---
    {
      lang: 'de',
      q: 'Sprechen Sie überhaupt Deutsch?',
      keys: [/Deutsch/i, /schriftlich/i, /E-Mail/i, /Englisch/i]
    },
    {
      lang: 'en',
      q: 'Do you speak German?',
      keys: [/German/i, /written/i, /email/i, /English/i, /communication/i]
    },
    {
      lang: 'de',
      q: 'Wir haben schon eine IT-Agentur, warum brauchen wir Sie?',
      keys: [/ersetzt/i, /spezialisiert/i, /KI/i, /Automatisierung/i, /parallel/i]
    },
    {
      lang: 'de',
      q: 'KI ist nichts für uns, wir sind ein traditionelles Geschäft.',
      keys: [/traditionell/i, /Feierabend/i, /Kerngeschäft/i, /Ergänzung/i, /Anfragen/i]
    },
    {
      lang: 'de',
      q: 'Wir hatten schon mal einen Chatbot und das hat nicht funktioniert.',
      keys: [/Skript/i, /Sprachmodell/i, /Unterschied/i, /verstehen/i, /modern/i]
    },
    {
      lang: 'en',
      q: 'We tried a chatbot before and it did not work.',
      keys: [/script/i, /language model/i, /difference/i, /understand/i, /modern/i]
    },
    {
      lang: 'de',
      q: 'Können Sie mir ein Beispiel zeigen?',
      keys: [/Demo/i, /Projekte/i, /azhyshchev\.de/i, /Beispiel/i, /live/i]
    },
    {
      lang: 'de',
      q: 'Was passiert nach dem Projekt wenn etwas nicht funktioniert?',
      keys: [/Support/i, /monatlich/i, /kündbar/i, /E-Mail/i, /erreichbar/i]
    },
    {
      lang: 'de',
      q: 'Wir haben gerade kein Budget dafür.',
      keys: [/Stunden/i, /rechnet/i, /Monate/i, /Konzept/i, /kostenlos/i]
    },
    {
      lang: 'de',
      q: 'Wir sind ein kleines Unternehmen, lohnt sich das überhaupt?',
      keys: [/klein/i, /Stunden/i, /lohnt/i, /Tag/i, /spart/i]
    },
    {
      lang: 'de',
      q: 'Ich muss das erst mit meinem Geschäftspartner besprechen.',
      keys: [/Konzept/i, /PDF/i, /E-Mail/i, /Partner/i, /kostenlos/i]
    },
    {
      lang: 'de',
      q: 'Warum soll ich Ihnen vertrauen? Sie haben mir einfach eine E-Mail geschickt.',
      keys: [/eingetragen/i, /Impressum/i, /LinkedIn/i, /Projekte/i, /Demo/i, /individuell/i]
    },

    // --- INTAKE MODE TESTS (agent must ask clarifying questions, not give a price) ---
    // intake: true — checks agent starts collecting info, asks for email, refuses to quote price
    {
      lang: 'en',
      q: 'I want to automate invoicing in my furniture store. How much would it cost?',
      intake: true,
      mustNotContain: [/€/i, /EUR/i, /\d{3,}/],
      mustContain: [/email/i, /details/i, /tell me/i, /question/i, /understand/i, /clarif/i, /describe/i, /workflow/i, /process/i, /Mikhail/i]
    },
    {
      lang: 'en',
      q: 'I run a kitchen studio in Munich and want an AI chatbot on my website.',
      intake: true,
      mustNotContain: [/€/i, /EUR/i, /\d{3,}/],
      mustContain: [/email/i, /question/i, /tell me/i, /understand/i, /clarif/i, /describe/i, /process/i, /Mikhail/i, /kitchen/i, /website/i, /chatbot/i]
    },
    {
      lang: 'de',
      q: 'Ich möchte meine Buchhaltung automatisieren. Was würde das kosten?',
      intake: true,
      mustNotContain: [/€/i, /EUR/i, /\d{3,}/],
      mustContain: [/E-Mail/i, /Fragen/i, /erzählen/i, /verstehen/i, /beschreiben/i, /Prozess/i, /Mikhail/i, /Angebot/i]
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
    const faqTests = questions.filter(q => !q.offTopic && !q.intake);
    const offTopicTests = questions.filter(q => q.offTopic);
    const intakeTests = questions.filter(q => q.intake);

    console.log(`\n======================================================`);
    console.log(`STARTING LIVE FAQ QUALITY EVALUATION SUITE`);
    console.log(`FAQ: ${faqTests.length} | Off-topic: ${offTopicTests.length} | Intake: ${intakeTests.length}`);
    console.log(`Total: ${questions.length} | Delay: 15s between live calls`);
    console.log(`======================================================\n`);

    let passed = 0;
    let failed = 0;
    const failures = [];

    for (let i = 0; i < questions.length; i++) {
      const test = questions[i];
      const { lang, q, offTopic, intake } = test;
      const label = offTopic ? '[OFF-TOPIC]' : intake ? '[INTAKE]' : '[FAQ]';
      console.log(`[Test ${i + 1}/${questions.length}] ${label} ${lang.toUpperCase()} | Q: "${q}"`);

      let res = null;
      try {
        res = await makeRequest('/api/chat', { message: q, lang });
        assert.strictEqual(res.status, 200, `HTTP ${res.status}. Body: ${JSON.stringify(res.body)}`);

        const reply = res.body.reply;
        assert.ok(reply, 'Reply must not be empty');

        // 1. Language check
        if (lang === 'de') {
          const hasGerman = /\b(ist|und|der|die|das|ich|sie|wir|zu|uns|es|ein|eine|einen|Mikhail|KI|auf|für|mit|von)\b/i.test(reply);
          assert.ok(hasGerman, `Expected German. Reply: "${reply}"`);
        } else {
          const hasEnglish = /\b(the|and|is|you|we|our|us|your|in|to|of|for|with|a|an|Mikhail|AI|chatbot|he|his|agent|services)\b/i.test(reply);
          const hasGerman = /\b(ist|und|der|die|das)\b/i.test(reply);
          assert.ok(hasEnglish, `Expected English. Reply: "${reply}"`);
          assert.ok(!hasGerman, `Must not contain German. Reply: "${reply}"`);
        }

        // 2. Sentence count check
        const sentences = countSentences(reply);
        console.log(` - Sentences: ${sentences}`);
        assert.ok(sentences >= 1 && sentences <= 10, `Sentence count ${sentences} out of range (1-10).`);

        if (offTopic || intake) {
          // 3a. Must NOT contain forbidden patterns
          for (const pattern of (test.mustNotContain || [])) {
            assert.ok(!pattern.test(reply), `Reply should not contain "${pattern}". Reply: "${reply}"`);
          }
          // 3b. Must contain at least one expected phrase
          const hasExpected = (test.mustContain || []).some(p => p.test(reply));
          assert.ok(hasExpected, `Expected one of: ${test.mustContain}. Reply: "${reply}"`);
          if (offTopic) console.log(` - Correctly declined and redirected.`);
          if (intake) console.log(` - Correctly entered intake mode.`);
        } else {
          // 3a. FAQ: must contain at least one key phrase
          const matchedList = test.keys.filter(p => p.test(reply));
          assert.ok(matchedList.length > 0, `No key phrases matched. Expected one of: ${test.keys}. Reply: "${reply}"`);
          console.log(` - Key match: ${matchedList.join(', ')}`);
        }

        console.log(` - Reply: "${reply.substring(0, 120)}${reply.length > 120 ? '...' : ''}"`);
        console.log(`PASS\n`);
        passed++;
      } catch (err) {
        console.error(`FAIL — ${err.message}\n`);
        failures.push({ i: i + 1, label, q, err: err.message });
        failed++;
      }

      if (i < questions.length - 1) {
        const isCached = res && res.headers && res.headers['x-from-cache'] === 'true';
        const sleepTime = isCached ? 50 : 15000;
        console.log(isCached ? ` (cached, no delay)\n` : ` Sleeping 15s...\n`);
        await sleep(sleepTime);
      }
    }

    console.log(`\n======================================================`);
    console.log(`RESULTS: ${passed} passed / ${failed} failed / ${questions.length} total`);
    if (failures.length > 0) {
      console.log(`\nFailed tests:`);
      failures.forEach(f => console.log(` [${f.i}] ${f.label} "${f.q}" — ${f.err}`));
    }
    console.log(`======================================================\n`);

    server.close(() => {
      process.exit(failed > 0 ? 1 : 0);
    });
  }

  runQualityEvaluation();
});
