// Validates the REFINED hard-word pipeline: multi-source discovery, inflection
// filtering, Wiktionary English verification, real sentences, Tamil translation.
const POS_TAGS = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', u: 'unknown' };
const MIN_FREQ = 0.05;
const MAX_FREQ = 8;

const INFLECTION = [/(?<!s)ings?$/, /ed$/, /ies$/, /es$/, /[^s]s$/];

function readFrequency(tags = []) {
  const t = tags.find((x) => x.startsWith('f:'));
  const v = t ? Number.parseFloat(t.slice(2)) : NaN;
  return Number.isFinite(v) ? v : null;
}

function isInflected(word) {
  return INFLECTION.some((r) => r.test(word));
}

function scoreDifficulty(word, freq) {
  const r = (Math.log10(MAX_FREQ) - Math.log10(Math.max(freq, MIN_FREQ))) / Math.log10(MAX_FREQ / MIN_FREQ);
  const rarity = Math.max(0, Math.min(1, r));
  const length = Math.max(0, Math.min(1, (word.length - 6) / 8));
  return Math.round((rarity * 0.7 + length * 0.3) * 100);
}

function stripHtml(s = '') {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function json(url, ms = 6000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { Accept: 'application/json' } });
    return res.ok ? await res.json() : null;
  } catch (e) {
    return null;
  }
}

async function discover(topic) {
  const urls = [
    `https://api.datamuse.com/words?ml=${encodeURIComponent(topic)}&max=200&md=dpf`,
    `https://api.datamuse.com/words?rel_trg=${encodeURIComponent(topic)}&max=200&md=dpf`,
  ];
  const pages = await Promise.all(urls.map((u) => json(u)));
  const out = [];
  const seen = new Set();
  for (const page of pages) {
    if (!Array.isArray(page)) continue;
    for (const e of page) {
      const word = (e.word || '').trim().toLowerCase();
      if (!word || seen.has(word)) continue;
      if (!/^[a-z]{6,}$/.test(word)) continue;
      if (isInflected(word)) continue;
      const tags = e.tags || [];
      const freq = readFrequency(tags);
      if (freq === null || freq < MIN_FREQ || freq > MAX_FREQ) continue;
      const pos = tags.map((t) => POS_TAGS[t]).find((p) => p && p !== 'unknown');
      if (!pos) continue;
      if (!Array.isArray(e.defs) || e.defs.length === 0) continue;
      seen.add(word);
      out.push({ word, freq, pos, difficulty: scoreDifficulty(word, freq), defs: e.defs });
    }
  }
  return out.sort((a, b) => b.difficulty - a.difficulty);
}

// Authoritative English check + quality definition
async function wiktionary(word) {
  const data = await json(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`, 6000);
  const groups = data && Array.isArray(data.en) ? data.en : null;
  if (!groups) return null;
  for (const g of groups) {
    const def = (g.definitions || []).map((d) => stripHtml(d.definition)).find((d) => d && d.length > 15);
    if (def) {
      const ex = (g.definitions || []).map((d) => (d.parsedExamples || []).map((p) => stripHtml(p.example))).flat().find((e) => e && e.includes(word));
      return { partOfSpeech: (g.partOfSpeech || '').toLowerCase(), definition: def, example: ex || '' };
    }
  }
  return null;
}

async function realSentence(word) {
  const d = await json(`https://tatoeba.org/en/api_v0/search?from=eng&query=${encodeURIComponent(word)}&orphans=no&limit=10`, 7000);
  const words = (d?.results || []).filter((r) => r.lang === 'eng');
  const whole = new RegExp(`\\b${word}\\w*\\b`, 'i');
  const good = words.filter((r) => whole.test(r.text) && r.text.length >= 25 && r.text.length <= 130);
  good.sort((a, b) => a.text.length - b.text.length);
  return good[0]?.text || '';
}

async function tamil(text) {
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ta&dt=t&q=${encodeURIComponent(text)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const d = await res.json();
      if (Array.isArray(d?.[0])) return d[0].map((i) => i[0]).filter(Boolean).join(' ');
    }
  } catch {}
  return '';
}

const TOPICS = ['greetings', 'work', 'emotions', 'travel', 'weather', 'food', 'health'];
const used = new Set();

for (const topic of TOPICS) {
  const t0 = Date.now();
  const pool = await discover(topic);
  const shortlist = pool.filter((c) => !used.has(c.word)).slice(0, 8);
  const verified = (await Promise.all(shortlist.map(async (c) => ({ c, w: await wiktionary(c.word) })))).filter((x) => x.w);

  console.log(`\n=== ${topic}  (pool=${pool.length}, verified=${verified.length}, ${Date.now() - t0}ms)`);
  for (const { c, w } of verified.slice(0, 4)) {
    used.add(c.word);
    const sent = (await realSentence(c.word)) || w.example;
    const [ta, tas] = await Promise.all([tamil(c.word), sent ? tamil(sent) : Promise.resolve('')]);
    console.log(`  ${c.word} [${w.partOfSpeech || c.pos}] d=${c.difficulty} tamil="${ta}"`);
    console.log(`     def:  ${w.definition.slice(0, 110)}`);
    console.log(`     e.g.: ${sent ? sent.slice(0, 120) : '(NO REAL SENTENCE FOUND)'}`);
    if (tas) console.log(`     ta :  ${tas.slice(0, 110)}`);
  }
}