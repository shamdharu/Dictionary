import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Topic seed words used to query the Free Dictionary API dynamically when needed
export const CATEGORY_TOPIC_WORDS: Record<string, string[]> = {
  greetings: ['welcome', 'cordial', 'salute', 'embrace', 'reception', 'compliment', 'respectful', 'courtesy', 'hospitality', 'farewell'],
  emotions: ['cheerful', 'delighted', 'furious', 'serene', 'optimistic', 'melancholy', 'anxious', 'compassion', 'generous', 'patient'],
  food: ['flavor', 'delicious', 'aroma', 'nourish', 'appetite', 'crispy', 'savory', 'refreshing', 'nutrition', 'spicy'],
  work: ['efficient', 'collaborate', 'punctual', 'deadline', 'initiative', 'schedule', 'productive', 'diligent', 'responsibility'],
  travel: ['journey', 'destination', 'itinerary', 'voyage', 'passenger', 'scenic', 'explore', 'expedition', 'departure', 'arrival'],
  weather: ['breeze', 'monsoon', 'scorching', 'chilly', 'humidity', 'forecast', 'downpour', 'blizzard', 'climate'],
  family: ['harmony', 'kinship', 'affection', 'sibling', 'companion', 'guidance', 'heritage', 'bond', 'relative'],
  'daily routine': ['routine', 'organize', 'habitual', 'punctual', 'exercise', 'chore', 'discipline', 'restful', 'grocery'],
  health: ['wellness', 'immunity', 'remedy', 'vitality', 'hygiene', 'fitness', 'nutrition', 'recovery', 'prescription'],
  shopping: ['purchase', 'discount', 'bargain', 'expense', 'affordable', 'receipt', 'warranty', 'retail', 'savings'],
};

export const app = express();

// Enable universal CORS so browser clients on Vercel or localhost never face CORS blocks
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json());

// In-memory cache for API-fetched and translated words
const wordCache = new Map<string, any>();

// Circuit breaker to prevent hammering Gemini when user's quota is exhausted (429)
let geminiQuotaCooldownUntil = 0;

function isGeminiAvailable(): boolean {
  if (Date.now() < geminiQuotaCooldownUntil) {
    return false;
  }
  return Boolean(process.env.GEMINI_API_KEY);
}

function handleGeminiError(err: any) {
  const errMsg = String(err?.message || err || '');
  const isQuota = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded');
  if (isQuota) {
    geminiQuotaCooldownUntil = Date.now() + 60000;
  }
}

// Lazy Gemini client helper
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!isGeminiAvailable()) return null;
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
export async function translateToTamil(text: string): Promise<string> {
  if (!text || !text.trim()) return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ta&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translatedParts = data[0].map((item: any) => item[0]).filter(Boolean);
        if (translatedParts.length > 0) return translatedParts.join(' ');
      }
    }
  } catch {
    // Silent fallback
  }

  // Second fallback: MyMemory API
  try {
    const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ta`;
    const mmRes = await fetch(mmUrl, { signal: AbortSignal.timeout(2500) });
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

// Helper: Query Free Dictionary API & translate to Tamil
export async function fetchDictionaryWordCard(queryWord: string, category: string = 'daily routine'): Promise<any> {
  let word = queryWord.charAt(0).toUpperCase() + queryWord.slice(1);
  let partOfSpeech = 'noun';
  let phonetic = '';
  let englishDefinition = '';
  let englishSentence = '';
  let tamilMeaning = '';
  let tamilSentence = '';
  let synonyms: string[] = [];
  let antonyms: string[] = [];
  let audioUrl = '';

  try {
    const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(queryWord)}`, {
      signal: AbortSignal.timeout(2500),
    });

    if (dictRes.ok) {
      const dictData = await dictRes.json();
      if (Array.isArray(dictData) && dictData.length > 0) {
        const entry = dictData[0];
        word = entry.word ? entry.word.charAt(0).toUpperCase() + entry.word.slice(1) : word;
        phonetic = entry.phonetic || entry.phonetics?.find((p: any) => p.text)?.text || '';

        const foundAudio = entry.phonetics?.find((p: any) => p.audio && p.audio.trim().length > 0)?.audio;
        if (foundAudio) {
          audioUrl = foundAudio.startsWith('//') ? `https:${foundAudio}` : foundAudio;
        }

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
          if (Array.isArray(primaryMeaning.antonyms)) {
            antonyms = primaryMeaning.antonyms.slice(0, 3);
          }
        }
      }
    }
  } catch {
    // Safe fallback if dictionary API times out
  }

  if (!englishSentence) {
    englishSentence = `She used the word "${queryWord}" naturally in everyday conversation.`;
  }
  if (!englishDefinition) {
    englishDefinition = `A commonly used English word relating to ${category}.`;
  }

  const [translatedMeaning, translatedSentence] = await Promise.all([
    translateToTamil(queryWord),
    translateToTamil(englishSentence),
  ]);

  tamilMeaning = translatedMeaning || queryWord;
  tamilSentence = translatedSentence || englishSentence;

  return {
    id: queryWord.toLowerCase(),
    word,
    tamilMeaning,
    partOfSpeech,
    phonetic,
    englishDefinition,
    englishSentence,
    tamilSentence,
    category,
    synonyms,
    antonyms,
    audioUrl: audioUrl || undefined,
    source: 'dictionary-api-translated',
    dictionarySource: 'Free Dictionary API (api.dictionaryapi.dev)',
  };
}

// Router containing all API endpoints
const router = express.Router();

// 1. Health
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 2. Server proxy for Free Dictionary API (solves browser CORS completely)
router.get('/dictionary/:word', async (req, res) => {
  const queryWord = (req.params.word || '').trim().toLowerCase();
  if (!queryWord) return res.status(400).json({ error: 'Word parameter required' });

  try {
    const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(queryWord)}`, {
      signal: AbortSignal.timeout(3000),
    });

    if (dictRes.ok) {
      const data = await dictRes.json();
      return res.json(data);
    }
    return res.status(dictRes.status).json({ error: 'Word not found in Free Dictionary' });
  } catch {
    return res.status(503).json({ error: 'Free Dictionary API unavailable from server' });
  }
});

// 3. Translation endpoint
router.post('/translate-word', async (req, res) => {
  try {
    const { word, definition = '', example = '', category = 'general' } = req.body || {};
    if (!word) {
      return res.status(400).json({ error: 'Word is required' });
    }

    const ai = getGemini();
    if (ai) {
      try {
        const prompt = `You are an expert English-Tamil bilingual lexicographer.
Provide accurate, natural Tamil translation for:
Word: "${word}"
Definition: "${definition}"
Example: "${example}"
Category: "${category}"

Return ONLY a raw JSON object:
{
  "tamilMeaning": "Accurate clear Tamil meaning in Tamil script",
  "tamilSentence": "Natural Tamil translation of the example sentence"
}`;

        const aiResponse = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' },
          }),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Translation timeout')), 3500)
          ),
        ]);

        const rawText = aiResponse.text?.trim() || '';
        const cleanedText = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleanedText);

        if (parsed.tamilMeaning) {
          return res.json({
            tamilMeaning: parsed.tamilMeaning,
            tamilSentence: parsed.tamilSentence || example,
          });
        }
      } catch (err) {
        handleGeminiError(err);
      }
    }

    const [tamilMeaning, tamilSentence] = await Promise.all([
      translateToTamil(word),
      example ? translateToTamil(example) : Promise.resolve(''),
    ]);

    return res.json({
      tamilMeaning: tamilMeaning || word,
      tamilSentence: tamilSentence || example,
    });
  } catch {
    return res.json({
      tamilMeaning: req.body?.word || '',
      tamilSentence: req.body?.example || '',
    });
  }
});

// 4. Real-time Dynamic Words Generation Endpoint
router.post('/realtime-words', async (req, res) => {
  try {
    const { 
      category = 'all', 
      count = 3, 
      excludeWords = [] 
    } = req.body || {};

    const targetCount = Math.min(Math.max(Number(count) || 3, 1), 5);
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

      try {
        const aiResponse = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            },
          }),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout waiting for Gemini response')), 3500)
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

          formattedWords.forEach((w: any) => wordCache.set(w.id, w));
          return res.json({ words: formattedWords, source: 'gemini-realtime' });
        }
      } catch (genErr) {
        handleGeminiError(genErr);
      }
    }

    // Fallback: Query using topic seed words
    let candidateWords: string[] = [];
    if (category !== 'all' && CATEGORY_TOPIC_WORDS[category]) {
      candidateWords = CATEGORY_TOPIC_WORDS[category];
    } else {
      candidateWords = Object.values(CATEGORY_TOPIC_WORDS).flat();
    }

    const availableWords = candidateWords.filter(w => !excludeList.includes(w.toLowerCase()));
    const wordsToFetch = (availableWords.length >= targetCount ? availableWords : candidateWords)
      .sort(() => 0.5 - Math.random())
      .slice(0, targetCount);

    const fallbackWords = await Promise.all(
      wordsToFetch.map(w => fetchDictionaryWordCard(w, category !== 'all' ? category : 'daily routine'))
    );

    fallbackWords.forEach((w: any) => wordCache.set(w.id, w));
    return res.json({ words: fallbackWords, source: 'dictionary-api' });
  } catch (error: any) {
    return res.json({ words: [], source: 'empty-fallback' });
  }
});

// 5. Dynamic Word Detail Endpoint: Gemini -> Free Dictionary API -> Safe Fallback
router.get('/word-details', async (req, res) => {
  const queryWord = (req.query.word as string || '').trim().toLowerCase();
  const category = (req.query.category as string || 'daily routine').toLowerCase();

  if (!queryWord) {
    return res.status(400).json({ error: 'Word parameter is required' });
  }

  const cacheKey = queryWord;
  if (wordCache.has(cacheKey)) {
    return res.json(wordCache.get(cacheKey));
  }

  try {
    const ai = getGemini();

    if (ai) {
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
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            },
          }),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Gemini timeout')), 3500)
          ),
        ]);

        const textOutput = aiResponse.text?.trim() || '';
        const cleaned = textOutput.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleaned);

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
      } catch (err) {
        handleGeminiError(err);
      }
    }

    // 2. Query Free Dictionary API + translate to Tamil
    const result = await fetchDictionaryWordCard(queryWord, category);
    wordCache.set(cacheKey, result);
    return res.json(result);
  } catch (error: any) {
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

// Mount router at both '/api' and '/' so that Vercel rewrites (whether path prefix is kept or stripped) ALWAYS match!
app.use('/api', router);
app.use('/', router);

export default app;
