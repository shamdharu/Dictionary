// FINAL architecture: ONE Datamuse call provides words + POS + frequency + definitions.
// Wiktionary is only a rare fallback. Validates quality across all categories.
const POS_TAGS = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', u: 'unknown' };
const MIN_FREQ = 0.05, MAX_FREQ = 2.2, MIN_LEN = 7;
const FORMAL = [/tion$/, /sion$/, /ity$/, /ous$/, /ive$/, /ance$/, /ence$/, /ment$/, /ology$/, /escent$/, /acious$/, /itude$/, /ism$/, /esque$/];
const INFLECTION = [/(?<!s)ings?$/, /ed$/, /ies$/, /es$/];
const clamp = (v) => Math.max(0, Math.min(1, v));
const UA = 'TamilVocabScroll/1.0 (educational vocabulary app)';

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

async function json(url, ms = 7000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { Accept: 'application/json', 'User-Agent': UA } });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

const POS_LABEL = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };

// Single call -> candidates WITH definitions already attached
async function discover(topic) {
  const page = await json(`https://api.datamuse.com/words?ml=${encodeURIComponent(topic)}&max=250&md=dpf`);
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
    const pos = tags.map((t) => POS_TAGS[t]).find((p) => p && p !== 'unknown');
    if (!pos) continue;

    const parsed = (e.defs || []).map((d) => {
      const i = d.indexOf('\t');
      if (i === -1) return { pos: pos, text: d.trim() };
      return { pos: POS_LABEL[d.slice(0, i).trim()] || pos, text: d.slice(i + 1).trim() };
    }).filter((d) => d.text.length > 15);

    if (parsed.length === 0) continue;
    seen.add(word);
    out.push({ word, freq, pos, defs: parsed, difficulty: scoreDifficulty(word, freq) });
  }
  return out.sort((a, b) => b.difficulty - a.difficulty);
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
  const picks = pool.filter((c) => !globals.has(c.word)).slice(0, 3);
  console.log(`\n=== ${topic}  pool=${pool.length} (with definitions)  ${Date.now() - t0}ms`);
  for (const c of picks) {
    globals.add(c.word);
    const def = c.defs.find((d) => d.pos === c.pos) || c.defs[0];
    const sent = await realSentence(c.word);
    const ta = await tamil(c.word);
    const tas = sent ? await tamil(sent) : '';
    console.log(`  • ${c.word} [${def.pos}] f=${c.freq.toFixed(2)} d=${c.difficulty} ta="${ta}"`);
    console.log(`      ${def.text.slice(0, 110)}`);
    console.log(`      sent: ${sent ? sent.slice(0, 105) : '(none)'}`);
    if (tas) console.log(`      ta  : ${tas.slice(0, 100)}`);
  }
  if (picks.length === 0) console.log('   !!! EMPTY');
}