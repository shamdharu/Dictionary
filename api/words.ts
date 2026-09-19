import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  generateHardWordBatch,
  type GeneratedWordCard,
} from '../src/server/wordSource';
import {
  allLookupTopics,
  resolveLookupTopic,
} from '../src/server/topics';

/**
 * Short-lived cache of generated batches. Only used when the caller has not
 * excluded anything yet, so a learner is never handed a word twice.
 * NOTE: serverless instances are ephemeral — this is a best-effort cache only.
 */
const batchCache = new Map<string, { at: number; cards: GeneratedWordCard[] }>();
const BATCH_CACHE_TTL_MS = 90_000;
const BATCH_CACHE_MAX_ENTRIES = 60;

function readCachedBatch(key: string): GeneratedWordCard[] | null {
  const entry = batchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > BATCH_CACHE_TTL_MS) {
    batchCache.delete(key);
    return null;
  }
  return entry.cards;
}

function writeCachedBatch(key: string, cards: GeneratedWordCard[]): void {
  if (batchCache.size >= BATCH_CACHE_MAX_ENTRIES) {
    const oldest = batchCache.keys().next().value;
    if (oldest !== undefined) batchCache.delete(oldest);
  }
  batchCache.set(key, { at: Date.now(), cards });
}

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
}

/**
 * POST /api/words — real-time word feed.
 *
 * Serverless-safe: the generator is raced against a 9s budget so Vercel's
 * 10s Hobby limit returns words instead of FUNCTION_INVOCATION_TIMEOUT.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ words: [], error: 'Method not allowed' });

  const BUDGET_MS = 9000;
  const started = Date.now();
  const timeLeft = () => BUDGET_MS - (Date.now() - started);

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { category = 'all', count = 3, excludeWords = [] } = body;

    const targetCount = Math.min(Math.max(Number(count) || 3, 1), 6);
    const excluded = Array.isArray(excludeWords)
      ? excludeWords.map((w: unknown) => String(w).toLowerCase()).slice(-400)
      : [];

    const categoryId = String(category);
    const topic = resolveLookupTopic(categoryId);

    const cacheKey = `${topic}|${targetCount}`;
    if (excluded.length === 0) {
      const cached = readCachedBatch(cacheKey);
      if (cached) return res.json({ words: cached, source: 'cache' });
    }

    const generation = generateHardWordBatch(
      topic,
      categoryId,
      targetCount,
      excluded,
      allLookupTopics()
    );

    let cards: GeneratedWordCard[] = [];
    try {
      cards = await Promise.race([
        generation,
        new Promise<GeneratedWordCard[]>((resolve) =>
          setTimeout(() => resolve([]), Math.max(1000, timeLeft()))
        ),
      ]);
      // If the race resolved empty due to timeout but generation later
      // finishes, cache it for the next scroll.
      void generation.then((late) => {
        if (late.length > 0) writeCachedBatch(cacheKey, late);
      });
    } catch {
      cards = [];
    }

    if (cards.length === 0) {
      return res.status(503).json({
        words: [],
        error: 'Live vocabulary sources are temporarily unavailable. Please retry.',
      });
    }

    writeCachedBatch(cacheKey, cards);
    return res.json({ words: cards, source: 'realtime' });
  } catch (err) {
    console.error('POST /api/words failed:', err);
    return res.status(500).json({
      words: [],
      error: 'Failed to generate words in real time.',
    });
  }
}
