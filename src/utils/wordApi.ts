import { WordCard } from '../types';

/**
 * Client-side access to the real-time vocabulary engine.
 *
 * Note: the upstream word sources (Datamuse) do not send CORS headers, so this
 * must always go through our own server endpoint rather than being called from
 * the browser directly.
 */

interface RawWordCard {
  id?: string;
  word?: string;
  tamilMeaning?: string;
  partOfSpeech?: string;
  phonetic?: string;
  englishDefinition?: string;
  englishSentence?: string;
  tamilSentence?: string;
  category?: string;
  difficulty?: number;
  synonyms?: string[];
  antonyms?: string[];
  source?: string;
  dictionarySource?: string;
}

function normalizeCard(raw: RawWordCard): WordCard | null {
  const word = (raw?.word || raw?.id || '').trim();
  if (!word) return null;

  return {
    id: (raw.id || word).toLowerCase(),
    word,
    tamilMeaning: raw.tamilMeaning || word,
    partOfSpeech: raw.partOfSpeech || 'noun',
    phonetic: raw.phonetic || '',
    englishDefinition: raw.englishDefinition || '',
    englishSentence: raw.englishSentence || '',
    tamilSentence: raw.tamilSentence || '',
    category: raw.category || 'all',
    difficulty: typeof raw.difficulty === 'number' ? raw.difficulty : undefined,
    synonyms: Array.isArray(raw.synonyms) ? raw.synonyms : [],
    antonyms: Array.isArray(raw.antonyms) ? raw.antonyms : [],
    source: raw.source || 'realtime',
    dictionarySource: raw.dictionarySource,
  };
}

/**
 * Fetches a fresh batch of live, non-repeating hard words for a category.
 * Returns an empty array when the sources are unreachable so callers can retry
 * on the next scroll instead of rendering broken cards.
 */
export async function requestRealtimeWords(params: {
  category: string;
  count: number;
  excludeWords: string[];
}): Promise<WordCard[]> {
  try {
    const res = await fetch('/api/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const words = Array.isArray(data?.words) ? (data.words as RawWordCard[]) : [];

    return words
      .map(normalizeCard)
      .filter((card): card is WordCard => card !== null);
  } catch {
    return [];
  }
}

/**
 * Real-time lookup of a single specific word. Returns null when the word has no
 * live English definition.
 */
export async function requestWordDetails(
  word: string,
  category: string
): Promise<WordCard | null> {
  try {
    const res = await fetch(
      `/api/word-details?word=${encodeURIComponent(word)}&category=${encodeURIComponent(category)}`
    );
    if (!res.ok) return null;
    return normalizeCard(await res.json());
  } catch {
    return null;
  }
}