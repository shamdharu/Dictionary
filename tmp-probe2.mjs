// Validates the real-time "hard word" discovery design before wiring it into the app.
const POS_TAGS = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
const MIN_FREQ = 0.02;
const MAX_FREQ = 6;

function readFrequency(tags = []) {
  const tag = tags.find((t) => t.startsWith('f:'));
  if (!tag) return null;
  const value = Number.parseFloat(tag.slice(2));
  return Number.isFinite(value) ? value : null;
}

function scoreDifficulty(word, frequency) {
  const rarity =
    (Math.log10(MAX_FREQ) - Math.log10(Math.max(frequency, MIN_FREQ))) /
    Math.log10(MAX_FREQ / MIN_FREQ);
  const rarityScore = Math.max(0, Math.min(1, rarity));
  const lengthScore = Math.max(0, Math.min(1, (word.length - 5) / 9));
  return Math.round((rarityScore * 0.65 + lengthScore * 0.35) * 100);
}

async function json(url) {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    return res.ok ? await res.json() : null;
  } catch (e) {
    return { __error: String(e.message || e) };
  }
}

const topics = ['greetings', 'emotions', 'food', 'work', 'travel', 'weather', 'family', 'daily routine', 'health', 'shopping'];

for (const topic of topics) {
  const data = await json(
    `https://api.datamuse.com/words?ml=${encodeURIComponent(topic)}&max=100&md=fp`
  );
  if (!Array.isArray(data)) {
    console.log(`\n### ${topic}: FAILED -> ${JSON.stringify(data)}`);
    continue;
  }
  const seen = new Set();
  const found = [];
  for (const entry of data) {
    const word = (entry.word || '').trim().toLowerCase();
    if (!word || seen.has(word)) continue;
    if (!/^[a-z]{6,}$/.test(word)) continue;
    const tags = entry.tags || [];
    const freq = readFrequency(tags);
    if (freq === null || freq < MIN_FREQ || freq > MAX_FREQ) continue;
    const pos = tags.map((t) => POS_TAGS[t]).find(Boolean);
    if (!pos) continue;
    seen.add(word);
    found.push({ w: word, f: Number(freq.toFixed(3)), pos, d: scoreDifficulty(word, freq) });
  }
  found.sort((a, b) => b.d - a.d);
  console.log(`\n### ${topic} -> ${found.length} hard words from ${data.length} raw`);
  console.log(
    '   ' +
      found
        .slice(0, 10)
        .map((x) => `${x.w}(f=${x.f},${x.pos},d=${x.d})`)
        .join(' ')
  );
}

// CORS behaviour for a browser-origin request
const corsRes = await fetch('https://api.datamuse.com/words?ml=travel&max=3', {
  headers: { Origin: 'http://localhost:3000' },
});
console.log('\n### Datamuse CORS header with Origin:', corsRes.headers.get('access-control-allow-origin'));

// Definition + real sentence for a discovered hard word
const def = await json('https://api.datamuse.com/words?sp=perspicacious&md=dp&max=1');
console.log('\n### def perspicacious:', JSON.stringify(def?.[0]?.defs));
const tat = await json('https://tatoeba.org/en/api_v0/search?from=eng&query=perspicacious&orphans=no&limit=5');
console.log(
  '### tatoeba perspicacious:',
  JSON.stringify((tat?.results || []).map((r) => r.text))
);