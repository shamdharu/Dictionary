import type { VercelRequest, VercelResponse } from '@vercel/node';
import { lookupWord } from '../src/server/wordSource';
import { allLookupTopics } from '../src/server/topics';

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
}

/** GET /api/word-details?word=...&category=... — live lookup of one word. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

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
  } catch (err) {
    console.error('GET /api/word-details failed:', err);
    return res.status(500).json({ error: 'Lookup failed.' });
  }
}
