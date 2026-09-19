import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/words lives in api/words.ts.
 * This file only handles the bare /api path (e.g. /api or /api/ with no
 * sub-path) so it never shadows the real endpoints.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  if (_req.method === 'OPTIONS') return res.status(204).end();
  return res.status(404).json({
    words: [],
    error: 'Unknown API endpoint. Use /api/words, /api/word-details or /api/health.',
  });
}

