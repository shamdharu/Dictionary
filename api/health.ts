import type { VercelRequest, VercelResponse } from '@vercel/node';

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
}

/** GET /api/health — liveness probe. */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (_req.method === 'OPTIONS') return res.status(204).end();
  return res.json({ status: 'ok', timestamp: new Date().toISOString() });
}
