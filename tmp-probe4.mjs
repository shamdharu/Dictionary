const words = ['gastronomy', 'meteorologist', 'inclemency', 'hitchhike', 'patronymic', 'quotidian', 'shortcake'];

async function raw(label, word, headers) {
  try {
    const res = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
    const text = await res.text();
    let hasEn = false;
    let keys = '';
    try {
      const j = JSON.parse(text);
      keys = Object.keys(j).join(',');
      hasEn = Array.isArray(j.en) && j.en.length > 0;
    } catch {}
    console.log(`${label} ${word}: status=${res.status} hasEn=${hasEn} keys=[${keys}] body=${text.slice(0, 120).replace(/\n/g, ' ')}`);
  } catch (e) {
    console.log(`${label} ${word}: ERROR ${e.message} cause=${e.cause && e.cause.code}`);
  }
}

console.log('--- no custom UA ---');
for (const w of words) await raw('noUA ', w, { Accept: 'application/json' });

console.log('\n--- with descriptive UA ---');
for (const w of words) await raw('withUA', w, { Accept: 'application/json', 'User-Agent': 'TamilVocabScroll/1.0 (educational app)' });