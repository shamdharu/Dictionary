const out = [];

async function probe(label, url, opts) {
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    out.push({
      label,
      status: res.status,
      cors: res.headers.get('access-control-allow-origin'),
      sample: json ? JSON.stringify(json).slice(0, 800) : text.slice(0, 200),
    });
  } catch (e) {
    out.push({ label, error: String(e.message || e), cause: e.cause && e.cause.code });
  }
}

await probe('datamuse-ml-freq', 'https://api.datamuse.com/words?ml=travel&max=15&md=fp');
await probe('datamuse-topics', 'https://api.datamuse.com/words?topics=travel&max=15&md=f');
await probe('datamuse-def', 'https://api.datamuse.com/words?sp=ephemeral&md=dpf&max=1');
await probe('tatoeba', 'https://tatoeba.org/en/api_v0/search?from=eng&query=ephemeral&orphans=no&unapproved=no&limit=2');
await probe('wiktionary', 'https://en.wiktionary.org/api/rest_v1/page/definition/ephemeral');

console.log(JSON.stringify(out, null, 2));