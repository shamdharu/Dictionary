import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { VOCABULARY_CATALOG } from './src/data/vocabularyCatalog.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory cache for API-fetched and translated words
const wordCache = new Map<string, any>();

// Lazy Gemini client helper
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!geminiClient && apiKey) {
    try {
      geminiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch {
      // Lazy initialization fallback
    }
  }
  return geminiClient;
}

// Helper: Free Google Translate endpoint for Tamil
async function translateToTamil(text: string): Promise<string> {
  if (!text || !text.trim()) return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ta&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translatedParts = data[0].map((item: any) => item[0]).filter(Boolean);
        return translatedParts.join(' ');
      }
    }
  } catch {
    // Silent fallback
  }

  // Second fallback: MyMemory API
  try {
    const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ta`;
    const mmRes = await fetch(mmUrl, { signal: AbortSignal.timeout(3000) });
    if (mmRes.ok) {
      const mmData = await mmRes.json();
      if (mmData?.responseData?.translatedText) {
        return mmData.responseData.translatedText;
      }
    }
  } catch {
    // Silent fallback
  }

  return '';
}

// API Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Real-time Dynamic Words Generation Endpoint
// Generates fresh, non-repeated everyday English words with Tamil translations
app.post('/api/realtime-words', async (req, res) => {
  try {
    const { 
      category = 'all', 
      count = 5, 
      excludeWords = [] 
    } = req.body || {};

    const targetCount = Math.min(Math.max(Number(count) || 3, 1), 6);
    const excludeList = Array.isArray(excludeWords) ? excludeWords.map((w: any) => String(w).toLowerCase()).slice(-80) : [];

    const ai = getGemini();

    if (ai) {
      const categoryPrompt = category && category !== 'all'
        ? `Focus strictly on practical everyday words related to "${category}".`
        : `Include a balanced variety of high-utility everyday words (such as food, work, travel, emotions, daily routine, shopping, health).`;

      const prompt = `You are an expert bilingual lexicographer specializing in conversational Tamil and English.
Generate exactly ${targetCount} USEFUL, COMMONLY-USED, PRACTICAL DAILY English vocabulary words with their Tamil meanings and example sentences.
Focus ONLY on words people actually use in conversation, office/work, home, and daily life.
Keep definitions and example sentences concise (1 short sentence each).
${categoryPrompt}

CRITICAL ANTI-REPETITION RULE:
Do NOT pick any of the following words that the user has already seen:
[${excludeList.join(', ')}]
Every generated word MUST be unique and completely new to the user!

Return a JSON object with a "words" array containing ${targetCount} items:
{
  "words": [
    {
      "id": "lowercase word",
      "word": "Capitalized Word",
      "tamilMeaning": "Accurate, clear Tamil meaning (பொருள்) in Tamil script",
      "partOfSpeech": "noun | verb | adjective | adverb",
      "phonetic": "Accurate IPA phonetic transcription e.g. /ˈpeɪ.ʃənt/",
      "englishDefinition": "1 brief learner-friendly sentence in English",
      "englishSentence": "Realistic everyday conversational English sentence",
      "tamilSentence": "Natural, authentic Tamil translation of that English sentence",
      "category": "${category !== 'all' ? category : 'daily routine'}",
      "synonyms": ["synonym1", "synonym2"]
    }
  ]
}

Format ONLY as pure raw JSON without markdown code blocks or commentary.`;

      const modelsToTry = ['gemini-2.5-flash', 'gemini-3.8-flash'];
      for (const modelName of modelsToTry) {
        try {
          const aiResponse = await Promise.race([
            ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
              },
            }),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout waiting for Gemini response')), 20000)
            ),
          ]);

          const rawText = aiResponse.text?.trim() || '';
          const cleanedText = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          const parsed = JSON.parse(cleanedText);

          if (parsed && Array.isArray(parsed.words) && parsed.words.length > 0) {
            const formattedWords = parsed.words.map((item: any, idx: number) => ({
              id: (item.id || item.word || `gen-${Date.now()}-${idx}`).toLowerCase().replace(/[^a-z0-9]/g, '-'),
              word: item.word || item.id,
              tamilMeaning: item.tamilMeaning || '',
              partOfSpeech: item.partOfSpeech || 'noun',
              phonetic: item.phonetic || '',
              englishDefinition: item.englishDefinition || '',
              englishSentence: item.englishSentence || '',
              tamilSentence: item.tamilSentence || '',
              category: item.category || (category !== 'all' ? category : 'daily routine'),
              synonyms: Array.isArray(item.synonyms) ? item.synonyms : [],
              source: 'gemini-realtime',
            }));

            // Cache newly generated words
            formattedWords.forEach((w: any) => wordCache.set(w.id, w));

            return res.json({ words: formattedWords, source: 'gemini-realtime', model: modelName });
          }
        } catch (genErr) {
          console.warn(`Gemini ${modelName} attempt error:`, genErr);
          // Try next model
        }
      }
    }

    // Fallback: If Gemini unavailable, use curated catalog or dictionary fallback
    // Filter out already seen words
    const catalogEntries = Object.entries(VOCABULARY_CATALOG)
      .filter(([id]) => !excludeList.includes(id.toLowerCase()))
      .filter(([_, data]) => category === 'all' || data.category === category);

    const pool = catalogEntries.length > 0 
      ? catalogEntries 
      : Object.entries(VOCABULARY_CATALOG);

    const shuffled = [...pool].sort(() => 0.5 - Math.random()).slice(0, targetCount);

    const fallbackWords = shuffled.map(([id, data]) => ({
      id,
      ...data,
      source: 'live-fallback',
    }));

    return res.json({ words: fallbackWords, source: 'live-fallback' });
  } catch (error: any) {
    console.error('Error generating realtime words:', error);
    return res.status(500).json({ error: 'Failed to generate realtime words', details: error.message });
  }
});

// Dynamic Word Detail Endpoint: uses Pre-seeded catalog -> Gemini -> Free Dictionary API -> Fallback
app.get('/api/word-details', async (req, res) => {
  const queryWord = (req.query.word as string || '').trim().toLowerCase();
  const category = (req.query.category as string || 'daily routine').toLowerCase();

  if (!queryWord) {
    return res.status(400).json({ error: 'Word parameter is required' });
  }

  const cacheKey = queryWord;
  if (wordCache.has(cacheKey)) {
    return res.json(wordCache.get(cacheKey));
  }

  // 1. Instant check against verified VOCABULARY_CATALOG (0ms latency, verified Tamil translations)
  if (VOCABULARY_CATALOG[queryWord]) {
    const item = VOCABULARY_CATALOG[queryWord];
    const card = {
      id: queryWord,
      ...item,
      category: item.category || category,
      source: 'verified-catalog',
    };
    wordCache.set(cacheKey, card);
    return res.json(card);
  }

  try {
    let word = queryWord.charAt(0).toUpperCase() + queryWord.slice(1);
    let partOfSpeech = 'noun';
    let phonetic = '';
    let englishDefinition = '';
    let englishSentence = '';
    let tamilMeaning = '';
    let tamilSentence = '';
    let synonyms: string[] = [];

    // 2. Try Gemini API with fallback models (gemini-3.8-flash -> gemini-3.1-flash-lite)
    const ai = getGemini();

    if (ai) {
      const modelsToTry = ['gemini-2.5-flash', 'gemini-3.8-flash'];
      for (const modelName of modelsToTry) {
        try {
          const prompt = `You are an expert bilingual lexicographer for Tamil and English.
Analyze the common daily English word: "${queryWord}".
Category: "${category}".
Provide a concise JSON with:
- word: Properly capitalized English word.
- partOfSpeech: (noun, verb, adjective, or adverb)
- phonetic: IPA phonetic transcription (e.g. /ˈɡreɪt.fəl/)
- englishDefinition: A simple, clear 1-sentence definition suitable for learners.
- tamilMeaning: Clear, natural Tamil translation of the word (பொருள்), separated by slash if 2 synonyms exist.
- englishSentence: A practical, natural daily conversation example sentence using the word.
- tamilSentence: The exact, fluent Tamil translation of that example sentence.
- synonyms: Array of 3 common English synonyms.

Format ONLY as raw JSON without markdown code fences.`;

          const aiResponse = await Promise.race([
            ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
              },
            }),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Gemini timeout')), 15000)
            ),
          ]);

          const textOutput = aiResponse.text?.trim() || '';
          const parsed = JSON.parse(textOutput);

          if (parsed.word && parsed.tamilMeaning && parsed.englishSentence) {
            const result = {
              id: queryWord,
              word: parsed.word,
              tamilMeaning: parsed.tamilMeaning,
              partOfSpeech: parsed.partOfSpeech || 'noun',
              phonetic: parsed.phonetic || '',
              englishDefinition: parsed.englishDefinition || '',
              englishSentence: parsed.englishSentence,
              tamilSentence: parsed.tamilSentence || '',
              category,
              synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : [],
              source: 'gemini-enhanced',
            };
            wordCache.set(cacheKey, result);
            return res.json(result);
          }
        } catch {
          // If gemini-3.8-flash experiences 503 or timeout, continue to next model or dictionary fallback
          continue;
        }
      }
    }

    // 3. Query Free Dictionary API with safe timeout
    try {
      const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(queryWord)}`, {
        signal: AbortSignal.timeout(3500),
      });

      if (dictRes.ok) {
        const dictData = await dictRes.json();
        if (Array.isArray(dictData) && dictData.length > 0) {
          const entry = dictData[0];
          word = entry.word ? entry.word.charAt(0).toUpperCase() + entry.word.slice(1) : word;
          phonetic = entry.phonetic || entry.phonetics?.find((p: any) => p.text)?.text || '';

          if (Array.isArray(entry.meanings) && entry.meanings.length > 0) {
            const primaryMeaning = entry.meanings[0];
            partOfSpeech = primaryMeaning.partOfSpeech || 'noun';
            if (Array.isArray(primaryMeaning.definitions) && primaryMeaning.definitions.length > 0) {
              const defObj = primaryMeaning.definitions.find((d: any) => d.example) || primaryMeaning.definitions[0];
              englishDefinition = defObj.definition || '';
              englishSentence = defObj.example || '';
            }
            if (Array.isArray(primaryMeaning.synonyms)) {
              synonyms = primaryMeaning.synonyms.slice(0, 3);
            }
          }
        }
      }
    } catch {
      // Safe fallback if dictionaryapi.dev is sluggish
    }

    // 4. Construct clean default context if missing
    if (!englishSentence) {
      englishSentence = `She used the word ${queryWord} naturally in everyday conversation.`;
    }
    if (!englishDefinition) {
      englishDefinition = `A commonly used English word relating to ${category}.`;
    }

    // 5. Auto-translate word and example sentence into Tamil using Free Translation API
    const [translatedMeaning, translatedSentence] = await Promise.all([
      translateToTamil(queryWord),
      translateToTamil(englishSentence),
    ]);

    tamilMeaning = translatedMeaning || `${queryWord}`;
    tamilSentence = translatedSentence || englishSentence;

    const result = {
      id: queryWord,
      word,
      tamilMeaning,
      partOfSpeech,
      phonetic,
      englishDefinition,
      englishSentence,
      tamilSentence,
      category,
      synonyms,
      source: 'dictionary-api-translated',
    };

    wordCache.set(cacheKey, result);
    return res.json(result);
  } catch (error: any) {
    // Fail-safe response so user feed never breaks
    const fallbackWord = queryWord.charAt(0).toUpperCase() + queryWord.slice(1);
    const fallbackCard = {
      id: queryWord,
      word: fallbackWord,
      tamilMeaning: `${fallbackWord} (பொருள்)`,
      partOfSpeech: 'noun',
      phonetic: '',
      englishDefinition: `Common daily-use vocabulary word in ${category}.`,
      englishSentence: `Learning the word ${queryWord} helps improve your conversational English.`,
      tamilSentence: `${queryWord} என்ற சொல்லைக் கற்றுக்கொள்வது உங்கள் அன்றாட ஆங்கிலப் பேச்சுத்திறனை மேம்படுத்துகிறது.`,
      category,
      synonyms: [],
      source: 'offline-fallback',
    };
    return res.json(fallbackCard);
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tamil-English Vocabulary Scroll server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
