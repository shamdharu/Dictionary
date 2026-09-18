import { WordCard } from '../types';
import { DEFAULT_STARTER_CARDS } from '../constants';

export interface FreeDictionaryPhonetic {
  text?: string;
  audio?: string;
  sourceUrl?: string;
}

export interface FreeDictionaryDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

export interface FreeDictionaryMeaning {
  partOfSpeech: string;
  definitions: FreeDictionaryDefinition[];
  synonyms?: string[];
  antonyms?: string[];
}

export interface FreeDictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics?: FreeDictionaryPhonetic[];
  meanings?: FreeDictionaryMeaning[];
  sourceUrls?: string[];
}

/**
 * Queries Free Dictionary API via server proxy (to avoid browser CORS policy)
 * with a graceful direct fallback.
 */
export async function fetchFromFreeDictionary(rawWord: string): Promise<FreeDictionaryEntry | null> {
  const cleanWord = rawWord.trim().toLowerCase();
  if (!cleanWord) return null;

  // 1. Try server proxy first (avoids browser CORS issues completely)
  try {
    const proxyRes = await fetch(`/api/dictionary/${encodeURIComponent(cleanWord)}`);
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (Array.isArray(data) && data.length > 0) {
        return data[0] as FreeDictionaryEntry;
      }
    }
  } catch {
    // Proxy unavailable, attempt direct fallback below
  }

  // 2. Direct fallback (may be blocked by browser CORS on some custom domains)
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data[0] as FreeDictionaryEntry;
      }
    }
  } catch {
    // Silent catch: prevent browser console TypeError
  }

  return null;
}

/**
 * Direct client-side Tamil translator for browser environments
 * (Used as instant fallback if server /api/translate-word returns 404 on static hosts)
 */
export async function clientTranslateToTamil(text: string): Promise<string> {
  if (!text || !text.trim()) return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ta&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const parts = data[0].map((item: any) => item[0]).filter(Boolean);
        if (parts.length > 0) return parts.join(' ');
      }
    }
  } catch {
    // Fallback to MyMemory
  }

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
    // Silent
  }

  return '';
}

/**
 * Calls our server translation endpoint to translate English word, definition,
 * and example sentence into authentic, conversational Tamil.
 * Falls back seamlessly to client-side translation if server is unreachable.
 */
export async function translateWordContext(params: {
  word: string;
  definition?: string;
  example?: string;
  category?: string;
}): Promise<{ tamilMeaning: string; tamilSentence: string }> {
  try {
    const res = await fetch('/api/translate-word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        tamilMeaning: data.tamilMeaning || params.word,
        tamilSentence: data.tamilSentence || params.example || '',
      };
    }
  } catch {
    // Server translation endpoint unavailable, fall back to client translator
  }

  // Graceful client-side fallback (works on static hosting like Vercel)
  try {
    const [tamilMeaning, tamilSentence] = await Promise.all([
      clientTranslateToTamil(params.word),
      params.example ? clientTranslateToTamil(params.example) : Promise.resolve(''),
    ]);
    return {
      tamilMeaning: tamilMeaning || params.word,
      tamilSentence: tamilSentence || params.example || '',
    };
  } catch {
    return {
      tamilMeaning: params.word,
      tamilSentence: params.example || '',
    };
  }
}

/**
 * Full Pipeline requested by user:
 * Query authoritative server endpoint (/api/word-details) with built-in dictionary + Tamil translation
 * Falls back seamlessly to Free Dictionary client pipeline or client-side translator.
 */
export async function lookupDictionaryWord(rawWord: string, category: string = 'general'): Promise<WordCard | null> {
  const cleanWord = rawWord.trim();
  if (!cleanWord) return null;

  // 0. Check pre-verified starter cards first for instant 0ms result
  const starter = DEFAULT_STARTER_CARDS.find(
    c => c.id.toLowerCase() === cleanWord.toLowerCase() || c.word.toLowerCase() === cleanWord.toLowerCase()
  );
  if (starter) {
    return starter;
  }

  // 1. Primary: Server-side word lookup (handles dictionary + Gemini/Tamil translation with zero CORS)
  try {
    const res = await fetch(`/api/word-details?word=${encodeURIComponent(cleanWord)}&category=${encodeURIComponent(category)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.word && data.tamilMeaning) {
        return {
          ...data,
          dictionarySource: data.dictionarySource || 'Free Dictionary API (api.dictionaryapi.dev)',
        };
      }
    }
  } catch {
    // Fall back to client dictionary lookup
  }

  // 2. Secondary: Query Free Dictionary API (via proxy or direct)
  const dictEntry = await fetchFromFreeDictionary(cleanWord);

  if (dictEntry) {
    const phoneticText = dictEntry.phonetic || 
      dictEntry.phonetics?.find(p => p.text && p.text.trim().length > 0)?.text || '';

    let audioUrl = dictEntry.phonetics?.find(p => p.audio && p.audio.trim().length > 0)?.audio || '';
    if (audioUrl && audioUrl.startsWith('//')) {
      audioUrl = `https:${audioUrl}`;
    }

    let partOfSpeech = 'noun';
    let englishDefinition = '';
    let englishSentence = '';
    const synonymsSet = new Set<string>();
    const antonymsSet = new Set<string>();

    if (dictEntry.meanings && dictEntry.meanings.length > 0) {
      const primaryMeaning = dictEntry.meanings[0];
      partOfSpeech = primaryMeaning.partOfSpeech || 'noun';

      for (const m of dictEntry.meanings) {
        if (m.synonyms) m.synonyms.forEach(s => synonymsSet.add(s));
        if (m.antonyms) m.antonyms.forEach(a => antonymsSet.add(a));

        for (const d of m.definitions) {
          if (!englishDefinition) englishDefinition = d.definition;
          if (!englishSentence && d.example) {
            englishSentence = d.example;
            if (!partOfSpeech) partOfSpeech = m.partOfSpeech;
          }
          if (d.synonyms) d.synonyms.forEach(s => synonymsSet.add(s));
          if (d.antonyms) d.antonyms.forEach(a => antonymsSet.add(a));
        }
      }

      if (!englishDefinition && primaryMeaning.definitions[0]) {
        englishDefinition = primaryMeaning.definitions[0].definition;
      }
    }

    if (!englishSentence) {
      englishSentence = `The concept of "${dictEntry.word}" is essential in everyday communication.`;
    }

    const { tamilMeaning, tamilSentence } = await translateWordContext({
      word: dictEntry.word,
      definition: englishDefinition,
      example: englishSentence,
      category,
    });

    const card: WordCard = {
      id: dictEntry.word.toLowerCase(),
      word: dictEntry.word.charAt(0).toUpperCase() + dictEntry.word.slice(1),
      tamilMeaning,
      partOfSpeech,
      phonetic: phoneticText,
      englishDefinition,
      englishSentence,
      tamilSentence,
      category,
      synonyms: Array.from(synonymsSet).slice(0, 4),
      antonyms: Array.from(antonymsSet).slice(0, 4),
      audioUrl: audioUrl || undefined,
      source: 'free-dictionary-api',
      dictionarySource: 'Free Dictionary API (api.dictionaryapi.dev)',
    };

    return card;
  }

  // 3. Fallback: Pure client-side synthetic fallback (e.g. if fully offline)
  try {
    const tamilMeaning = await clientTranslateToTamil(cleanWord);
    const sampleSentence = `She used the word "${cleanWord}" clearly in everyday conversation.`;
    const tamilSentence = await clientTranslateToTamil(sampleSentence);

    return {
      id: cleanWord.toLowerCase(),
      word: cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1),
      tamilMeaning: tamilMeaning || cleanWord,
      partOfSpeech: 'noun',
      phonetic: '',
      englishDefinition: `Common vocabulary word relating to ${category}.`,
      englishSentence: sampleSentence,
      tamilSentence: tamilSentence || sampleSentence,
      category,
      synonyms: [],
      antonyms: [],
      source: 'client-fallback',
      dictionarySource: 'Bilingual Lexicon',
    };
  } catch {
    return null;
  }
}
