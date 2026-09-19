// FINAL algorithm validation across all app categories.
const POS_TAGS = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
const MIN_FREQ = 0.05;
const MAX_FREQ = 2.2;
const MIN_LEN = 7;
const FORMAL = [
  /tion$/, /sion$/, /ity$/, /ous$/, /ive$/, /ance$/, /ence$/, /ment$/,
  /ology$/, /escent$/, /acious$/, /itude$/, /ism$/, /esque$/, /ify$/, /itude$/,
];
const INFLECTION = [/(?<!s)ings?$/, /ed$/, /ies$/, /es$/];

const clamp = (v) => Math.max(0, Math.min(1, v));

function readFrequency(tags = []) {
  const t = tags.find((x) => x.startsWith('f:'));
  const v = t ? Number.parseFloat(t.slice(2)) : NaN;
  return Number.isFinite(v) ? v : null;
}

function scoreDifficulty(word, freq) {
  const rarity = clamp((Math.log10(MAX_FREQ) - Math.log10(Math.max(freq, MIN_FREQ))) / Math.log10(MAX_FREQ / MIN_FREQ));
  const length = clamp((word.length - MIN_LEN) / 8);
  const formal = FORMAL.some((r) => r.test(word)) ? 1 : 0;
  return Math.round((rarity * 0.5 + length * 0.2 + formal * 0.3) * 100);
}

function stripHtml(s = '') {
  return s.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

const USER_AGENT = 'TamilVocabScroll/1.0 (educational vocabulary app; contact: local)';

async function json(url, ms = 7000) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(ms),
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

async function discover(topic) {
  const page = await json(`https://api.datamuse.com/words?ml=${encodeURIComponent(topic)}&max=250&md=fp`);
  if (!Array.isArray(page)) return [];
  const seen = new Set();
  const out = [];
  for (const e of page) {
    const word = (e.word || '').trim().toLowerCase();
    if (!word || seen.has(word)) continue;
    if (!/^[a-z]+$/.test(word)) continue;
    if (word.length < MIN_LEN) continue;
    if (INFLECTION.some((r) => r.test(word))) continue;
    const tags = e.tags || [];
    const freq = readFrequency(tags);
    if (freq === null || freq < MIN_FREQ || freq > MAX_FREQ) continue;
    const pos = tags.map((t) => POS_TAGS[t]).find(Boolean);
    if (!pos) continue;
    seen.add(word);
    out.push({ word, freq, pos, difficulty: scoreDifficulty(word, freq) });
  }
  return out.sort((a, b) => b.difficulty - a.difficulty);
}

async function wiktionary(word) {
  const data = await json(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`);
  const groups = data && Array.isArray(data.en) ? data.en : null;
  if (!groups) return null;
  for (const g of groups) {
    const pos = (g.partOfSpeech || '').toLowerCase();
    if (pos.includes('proper')) return null;
    const def = (g.definitions || []).map((d) => stripHtml(d.definition)).find((d) => d && d.length > 20);
    if (def) {
      const ex = (g.definitions || []).flatMap((d) => (d.parsedExamples || []).map((p) => stripHtml(p.example)))
        .find((e) => e && new RegExp(`\\b${word}\\w*\\b`, 'i').test(e) && e.length > 20);
      return { partOfSpeech: pos, definition: def, example: ex || '' };
    }
  }
  return null;
}

async function realSentence(word) {
  const d = await json(`https://tatoeba.org/en/api_v0/search?from=eng&query=${encodeURIComponent(word)}&orphans=no&limit=10`, 8000);
  const whole = new RegExp(`\\b${word}\\w*\\b`, 'i');
  const good = (d?.results || [])
    .filter((r) => r.lang === 'eng' && whole.test(r.text) && r.text.length >= 25 && r.text.length <= 130)
    .sort((a, b) => a.text.length - b.text.length);
  return good[0]?.text || '';
}

async function tamil(text) {
  const d = await json(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ta&dt=t&q=${encodeURIComponent(text)}`, 5000);
  return Array.isArray(d?.[0]) ? d[0].map((i) => i[0]).filter(Boolean).join(' ') : '';
}

const TOPICS = ['greetings', 'emotions', 'food', 'work', 'travel', 'weather', 'family', 'daily routine', 'health', 'shopping'];
const globals = new Set();

for (const topic of TOPICS) {
  const t0 = Date.now();
  const pool = await discover(topic);
  const shortlist = pool.filter((c) => !globals.has(c.word)).slice(0, 14);
  const checked = await Promise.all(shortlist.map(async (c) => ({ c, w: await wiktionary(c.word) })));
  const verified = checked.filter((x) => x.w);
  const picked = verified.slice(0, 3);

  console.log(`\n=== ${topic}  pool=${pool.length} shortlist=${shortlist.length} verified=${verified.length} ${Date.now() - t0}ms`);
  for (const { c, w } of picked) {
    globals.add(c.word);
    const sent = (await realSentence(c.word)) || w.example;
    const [ta] = await Promise.all([tamil(c.word)]);
    console.log(`  • ${c.word} [${w.partOfSpeech || c.pos}] f=${c.freq.toFixed(2)} d=${c.difficulty} ta="${ta}"`);
    console.log(`      ${w.definition.slice(0, 115)}`);
    console.log(`      sent: ${sent ? sent.slice(0, 110) : '(none)'}`);
  }
  if (picked.length === 0) console.log('   !!! NO VERIFIED WORDS — top rejected: ' + shortlist.slice(0, 6).map((c) => c.word).join(', '));
}