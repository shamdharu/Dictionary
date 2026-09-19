import express from 'express';
import dotenv from 'dotenv';
import {
  generateHardWordBatch,
  lookupWord,
  type GeneratedWordCard,
} from './wordSource';
import { allLookupTopics, resolveLookupTopic } from './topics';

dotenv.config();

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

/**
 * Short-lived cache of generated batches. Only used when the caller has not
 * excluded anything yet, so a learner is never handed a word twice.
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

const router = express.Router();

// 1. Health
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * 2. Real-time word feed.
 * Called automatically by the client as the learner scrolls — there is no
 * "fetch" button. Every word is discovered live from public dictionary data.
 */
router.post('/words', async (req, res) => {
  try {
    const { category = 'all', count = 3, excludeWords = [] } = req.body || {};

    const targetCount = Math.min(Math.max(Number(count) || 3, 1), 6);
    const excluded = Array.isArray(excludeWords)
      ? excludeWords.map((w: unknown) => String(w).toLowerCase()).slice(-400)
      : [];

    const categoryId = String(category);
    const topic = resolveLookupTopic(categoryId);

    const cacheKey = `${topic}|${targetCount}`;
    if (excluded.length === 0) {
      const cached = readCachedBatch(cacheKey);
      if (cached) {
        return res.json({ words: cached, source: 'cache' });
      }
    }

    const cards = await generateHardWordBatch(
      topic,
      categoryId,
      targetCount,
      excluded,
      allLookupTopics()
    );

    if (cards.length === 0) {
      return res.status(503).json({
        words: [],
        error: 'Live vocabulary sources are temporarily unavailable. Please retry.',
      });
    }

    writeCachedBatch(cacheKey, cards);
    return res.json({ words: cards, source: 'realtime' });
  } catch {
    return res.status(500).json({
      words: [],
      error: 'Failed to generate words in real time.',
    });
  }
});

/**
 * 3. Real-time lookup for one specific word.
 * Returns 404 when the word has no live English definition.
 */
router.get('/word-details', async (req, res) => {
  const word = String(req.query.word || '').trim();
  const category = String(req.query.category || 'all');

  if (!word) {
    return res.status(400).json({ error: 'word parameter is required' });
  }

  try {
    const card = await lookupWord(word, category, allLookupTopics());
    if (!card) {
      return res.status(404).json({ error: `No live English definition found for "${word}".` });
    }
    return res.json(card);
  } catch {
    return res.status(500).json({ error: 'Lookup failed.' });
  }
});

// Mount router at both '/api' and '/' so that Vercel rewrites (whether path prefix is kept or stripped) ALWAYS match!
app.use('/api', router);
app.use('/', router);

export default app;