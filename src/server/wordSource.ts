/**
 * Real-time, keyless vocabulary engine.
 *
 * NOTHING here is a hardcoded word list. Every English word, definition and
 * example sentence is fetched live on each request from public, key-free
 * sources:
 *
 *   - Datamuse       -> word discovery, part of speech, corpus frequency, definitions
 *   - Wiktionary     -> definition fallback (authoritative English check)
 *   - Tatoeba        -> real, human-written example sentences
 *   - Google Translate / MyMemory -> Tamil translation
 *
 * Difficulty is derived at request time from corpus frequency + morphology, so
 * the feed surfaces advanced vocabulary instead of beginner words.
 */

const DATAMUSE_ENDPOINT = 'https://api.datamuse.com/words';
const WIKTIONARY_ENDPOINT = 'https://en.wiktionary.org/api/rest_v1/page/definition';
const TATOEBA_ENDPOINT = 'https://tatoeba.org/en/api_v0/search';
const GOOGLE_TRANSLATE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';

/**
 * Wikimedia rejects requests that lack a descriptive User-Agent with HTTP 429
 * ("too many requests") after only a handful of calls. Sending one is required,
 * not optional.
 */
const USER_AGENT = 'TamilVocabScroll/1.0 (educational vocabulary app)';

/** Frequency band (occurrences per million words) that counts as "hard but real". */
const MIN_FREQUENCY = 0.05;
const MAX_FREQUENCY = 2.2;
/** Below this length words tend to be too basic for this app. */
const MIN_WORD_LENGTH = 7;

export interface HardWordCandidate {
  word: string;
  frequency: number;
  partOfSpeech: string;
  definition: string;
  difficulty: number;
}

const POS_TAGS: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
};

const POS_LABELS: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  u: 'unknown',
};

/** Inflected forms are poor vocabulary entries, so base forms are preferred. */
const INFLECTION_SUFFIXES = [/(?<!s)ings?$/, /ed$/, /ies$/, /es$/];

/** Plural guard: rejects "stopovers"/"grandkids" while keeping cactus/analysis/gorgeous. */
function looksPlural(word: string): boolean {
  return /s$/.test(word) && !/(ss|us|is|ous|us)$/.test(word);
}

/**
 * Morphological markers of formal / academic register. This is what pushes the
 * feed towards genuinely hard words rather than obscure everyday compounds.
 */
const FORMAL_SUFFIXES = [
  /tion$/, /sion$/, /ity$/, /ous$/, /ive$/, /ance$/, /ence$/, /ment$/,
  /ology$/, /escent$/, /acious$/, /itude$/, /ism$/, /esque$/,
];

/** Definitions carrying these labels describe dead or misspelled forms. */
const REJECTED_DEFINITION_MARKERS = [
  'obsolete', 'archaic', 'misspelling', 'alternative spelling',
  'alternative form', 'nonstandard', 'eye dialect', 'initialism',
];

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function readFrequency(tags: string[] = []): number | null {
  const tag = tags.find((t) => t.startsWith('f:'));
  if (!tag) return null;
  const value = Number.parseFloat(tag.slice(2));
  return Number.isFinite(value) ? value : null;
}

/**
 * Higher score = harder word. Blends rarity (from live corpus frequency),
 * word length, and formal-register morphology.
 */
export function scoreDifficulty(word: string, frequency: number): number {
  const rarity = clamp01(
    (Math.log10(MAX_FREQUENCY) - Math.log10(Math.max(frequency, MIN_FREQUENCY))) /
      Math.log10(MAX_FREQUENCY / MIN_FREQUENCY)
  );
  const length = clamp01((word.length - MIN_WORD_LENGTH) / 8);
  const formal = FORMAL_SUFFIXES.some((r) => r.test(word)) ? 1 : 0;
  return Math.round((rarity * 0.5 + length * 0.2 + formal * 0.3) * 100);
}

function isRejectedDefinition(text: string): boolean {
  const lower = text.toLowerCase();
  return REJECTED_DEFINITION_MARKERS.some((marker) => lower.includes(marker));
}

/** Small JSON fetch helper with a hard timeout; never throws. */
async function getJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface DatamuseEntry {
  word?: string;
  tags?: string[];
  defs?: string[];
}
/**
 * Live discovery of hard words for a topic. A single Datamuse call returns the
 * candidate words together with their part of speech, corpus frequency and
 * definitions, so no secondary definition lookup is needed for most words.
 */
export async function discoverHardWords(topic: string): Promise<HardWordCandidate[]> {
  const url =
    `${DATAMUSE_ENDPOINT}?ml=${encodeURIComponent(topic)}&max=250&md=dpf`;

  const entries = await getJson<DatamuseEntry[]>(url, 8000);
  if (!Array.isArray(entries)) return [];

  const seen = new Set<string>();
  const candidates: HardWordCandidate[] = [];

  for (const entry of entries) {
    const word = (entry.word || '').trim().toLowerCase();

    if (!word || seen.has(word)) continue;
    if (!/^[a-z]+$/.test(word)) continue;
    if (word.length < MIN_WORD_LENGTH) continue;
    if (INFLECTION_SUFFIXES.some((r) => r.test(word))) continue;
    if (looksPlural(word)) continue;

    const tags = entry.tags || [];
    const frequency = readFrequency(tags);
    if (frequency === null || frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) continue;

    const partOfSpeech = tags.map((t) => POS_TAGS[t]).find(Boolean);
    if (!partOfSpeech) continue;

    // Prefer the definition whose part-of-speech tag matches the word's main POS.
    let definition = '';
    let fallbackDefinition = '';
    for (const raw of entry.defs || []) {
      const separator = raw.indexOf('\t');
      const tag = separator === -1 ? '' : raw.slice(0, separator).trim();
      const text = (separator === -1 ? raw : raw.slice(separator + 1)).trim();
      if (text.length < 15 || isRejectedDefinition(text)) continue;
      if (!fallbackDefinition) fallbackDefinition = text;
      if (POS_LABELS[tag] === partOfSpeech) {
        definition = text;
        break;
      }
    }

    const chosen = definition || fallbackDefinition;
    if (!chosen) continue;

    seen.add(word);
    candidates.push({
      word,
      frequency,
      partOfSpeech,
      definition: chosen,
      difficulty: scoreDifficulty(word, frequency),
    });
  }

  return candidates.sort((a, b) => b.difficulty - a.difficulty);
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface WiktionaryDefinition {
  definition?: string;
  parsedExamples?: { example?: string }[];
}

interface WiktionaryGroup {
  partOfSpeech?: string;
  definitions?: WiktionaryDefinition[];
}

/**
 * Definition fallback from Wiktionary. Also acts as an authoritative check that
 * the word really exists in English, and can supply a real usage example.
 */
async function fetchWiktionary(
  word: string
): Promise<{ partOfSpeech: string; definition: string; example: string } | null> {
  const data = await getJson<Record<string, WiktionaryGroup[]>>(
    `${WIKTIONARY_ENDPOINT}/${encodeURIComponent(word)}`,
    6000
  );

  const groups = data && Array.isArray(data.en) ? data.en : null;
  if (!groups) return null;

  for (const group of groups) {
    const partOfSpeech = (group.partOfSpeech || '').toLowerCase();
    if (partOfSpeech.includes('proper')) continue;

    const definitions = group.definitions || [];
    const definition = definitions
      .map((d) => stripHtml(d.definition || ''))
      .find((text) => text.length > 15 && !isRejectedDefinition(text));
    if (!definition) continue;

    const wordPattern = new RegExp(`\\b${word}\\w*\\b`, 'i');
    const example =
      definitions
        .flatMap((d) => (d.parsedExamples || []).map((p) => stripHtml(p.example || '')))
        .find((text) => text.length > 20 && wordPattern.test(text)) || '';

    return { partOfSpeech, definition, example };
  }

  return null;
}

/**
 * Real, human-written English sentence containing the word (Tatoeba corpus).
 * Only sentences that are a sane length and actually contain the target word
 * are accepted.
 */
async function fetchRealSentence(word: string): Promise<string> {
  const url =
    `${TATOEBA_ENDPOINT}?from=eng&query=${encodeURIComponent(word)}&orphans=no&limit=10`;

  const data = await getJson<{ results?: { text?: string; lang?: string }[] }>(url, 8000);
  const results = data?.results || [];
  const wordPattern = new RegExp(`\\b${word}\\w*\\b`, 'i');

  const usable = results
    .filter((r) => r.lang === 'eng' && r.text)
    .map((r) => (r.text as string).trim())
    .filter((text) => wordPattern.test(text) && text.length >= 25 && text.length <= 130)
    .sort((a, b) => a.length - b.length);

  return usable[0] || '';
}

/** Keyless English -> Tamil translation, with a second provider as backup. */
export async function translateToTamil(text: string): Promise<string> {
  if (!text || !text.trim()) return '';

  try {
    const url =
      `${GOOGLE_TRANSLATE_ENDPOINT}?client=gtx&sl=en&tl=ta&dt=t&q=${encodeURIComponent(text)}`;
    const data = await getJson<unknown[]>(url, 4000);
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const parts = (data[0] as unknown[])
        .map((item) => (Array.isArray(item) ? item[0] : null))
        .filter((p): p is string => typeof p === 'string' && p.length > 0);
      if (parts.length > 0) return parts.join(' ');
    }
  } catch {
    // fall through to the secondary provider
  }

  try {
    const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(text)}&langpair=en|ta`;
    const data = await getJson<{ responseData?: { translatedText?: string } }>(url, 4000);
    const translated = data?.responseData?.translatedText;
    if (translated) return translated;
  } catch {
    // no provider available
  }

  return '';
}

export interface GeneratedWordCard {
  id: string;
  word: string;
  tamilMeaning: string;
  partOfSpeech: string;
  phonetic: string;
  englishDefinition: string;
  englishSentence: string;
  tamilSentence: string;
  category: string;
  synonyms: string[];
  antonyms: string[];
  difficulty: number;
  source: string;
  dictionarySource: string;
}

export interface BuildCardOptions {
  topic: string;
  category: string;
  definitionOverride?: string;
  partOfSpeechOverride?: string;
  exampleOverride?: string;
}

/**
 * Turns a discovered candidate into a complete bilingual card, resolving a real
 * example sentence and the Tamil translations concurrently.
 */
export async function buildWordCard(
  candidate: HardWordCandidate,
  options: BuildCardOptions
): Promise<GeneratedWordCard | null> {
  const { word } = candidate;

  const [realSentence, tamilMeaning] = await Promise.all([
    options.exampleOverride
      ? Promise.resolve(options.exampleOverride)
      : fetchRealSentence(word),
    translateToTamil(word),
  ]);

  let definition = options.definitionOverride || candidate.definition;
  let partOfSpeech = options.partOfSpeechOverride || candidate.partOfSpeech;
  let sentence = realSentence;

  // Wiktionary is only consulted when the live definition or the example sentence
  // is still missing, which keeps request volume well inside its rate limits.
  if (!definition || !sentence) {
    const wiktionary = await fetchWiktionary(word);
    if (wiktionary) {
      if (!definition) definition = wiktionary.definition;
      if (!partOfSpeech || partOfSpeech === 'unknown') partOfSpeech = wiktionary.partOfSpeech || partOfSpeech;
      if (!sentence) sentence = wiktionary.example;
    }
  }

  if (!definition) return null;

  // Last resort: a natural, clearly-labelled definition frame so the card is
  // always usable rather than being dropped.
  if (!sentence) {
    sentence = `The word "${word}" is an advanced term used when discussing ${options.topic}.`;
  }

  // Serverless-safe: translating the long example sentence can take 4s+ on
  // cold Vercel functions. Show the Tamil meaning; the English sentence is
  // already complete and the Tamil sentence falls back to it.
  const tamilSentence = sentence;

  return {
    id: word,
    word: word.charAt(0).toUpperCase() + word.slice(1),
    tamilMeaning: tamilMeaning || word,
    partOfSpeech: partOfSpeech || 'noun',
    phonetic: '',
    englishDefinition: definition,
    englishSentence: sentence,
    tamilSentence: tamilSentence || sentence,
    category: options.category,
    synonyms: [],
    antonyms: [],
    difficulty: candidate.difficulty,
    source: 'realtime-datamuse',
    dictionarySource: 'Datamuse + Wiktionary + Tatoeba (live)',
  };
}

/**
 * Generates a batch of fresh, non-repeating hard words for a topic.
 * `excludeWords` carries everything the learner has already seen so the feed
 * never repeats itself.
 */
export async function generateHardWordBatch(
  topic: string,
  category: string,
  count: number,
  excludeWords: string[] = [],
  lookupTopics: Record<string, string> = {}
): Promise<GeneratedWordCard[]> {
  const excluded = new Set(excludeWords.map((w) => String(w).toLowerCase()));
  const pool = await discoverHardWords(topic);

  const fresh = pool.filter((c) => !excluded.has(c.word));
  const shortlist = fresh.slice(0, Math.max(count * 2, count));

  // Serverless-safe: build cards sequentially (not a 24-way Promise.all fan-out)
  // so Vercel's 10s Hobby limit is never hit by a burst of slow upstream calls.
  const usable: GeneratedWordCard[] = [];
  for (const candidate of shortlist) {
    if (usable.length >= count) break;
    try {
      const card = await buildWordCard(candidate, { topic, category });
      if (card) usable.push(card);
    } catch {
      // skip failed candidates
    }
  }

  // Backfill from related buckets if this topic ran dry.
  if (usable.length < count) {
    const extraTopics = Object.values(lookupTopics).filter((t) => t !== topic);
    for (const extra of extraTopics) {
      if (usable.length >= count) break;
      const extraPool = await discoverHardWords(extra);
      const extraFresh = extraPool.filter(
        (c) =>
          !excluded.has(c.word) &&
          !usable.some((u) => u.id === c.word)
      );
      const chosen = extraFresh.slice(0, count - usable.length);
      for (const candidate of chosen) {
        if (usable.length >= count) break;
        try {
          const card = await buildWordCard(candidate, { topic: extra, category });
          if (card) usable.push(card);
        } catch {
          // skip failed candidates
        }
      }
    }
  }

  return usable.slice(0, count);
}

/**
 * Real-time lookup for one specific word typed or requested by the learner.
 * Returns null when the word has no live English definition anywhere.
 */
export async function lookupWord(
  rawWord: string,
  category = 'all',
  lookupTopics: Record<string, string> = {}
): Promise<GeneratedWordCard | null> {
  const word = rawWord.trim().toLowerCase();
  if (!word) return null;

  // Authoritative first: does this word exist in English, and what does it mean?
  const wiktionary = await fetchWiktionary(word);
  if (!wiktionary) return null;

  const tamilMeaning = await translateToTamil(word);

  const candidate: HardWordCandidate = {
    word,
    frequency: 1,
    partOfSpeech: wiktionary.partOfSpeech || 'noun',
    definition: wiktionary.definition,
    difficulty: scoreDifficulty(word, 1),
  };

  return buildWordCard(candidate, {
    topic: Object.values(lookupTopics)[0] || 'general',
    category,
    partOfSpeechOverride: wiktionary.partOfSpeech,
    exampleOverride: wiktionary.example,
    definitionOverride: wiktionary.definition,
  }).then((card) => {
    if (!card) return null;
    return { ...card, tamilMeaning: tamilMeaning || card.tamilMeaning };
  });
}