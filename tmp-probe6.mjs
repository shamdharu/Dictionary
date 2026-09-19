const words = ['ablution', 'escapism', 'banality', 'adjournment', 'commercialism', 'invulnerability'];

async function probe(label, headers, delayMs) {
  console.log(`\n--- ${label} ---`);
  for (const w of words) {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    try {
      const res = await fetch(
        `https://en.wiktionary.org/api/rest_v1/page/definition/${w}`,
        { headers, signal: AbortSignal.timeout(8000) }
      );
      const text = await res.text();
      let hasEn = false;
      try { hasEn = Array.isArray(JSON.parse(text).en); } catch {}
      console.log(`  ${w}: ${res.status} hasEn=${hasEn} retry-after=${res.headers.get('retry-after')} | ${text.slice(0, 90).replace(/\n/g, ' ')}`);
    } catch (e) {
      console.log(`  ${w}: ERROR ${e.message}`);
    }
  }
}

// 1. Rapid fire, no UA (mimics what the app would do)
await probe('rapid, no UA', { Accept: 'application/json' }, 0);
// 2. Rapid fire, descriptive UA (Wikimedia policy compliance)
await probe('rapid, descriptive UA', { Accept: 'application/json', 'User-Agent': 'TamilVocabScroll/1.0 (https://example.com; educational vocabulary app)' }, 0);