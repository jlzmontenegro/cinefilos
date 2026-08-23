// Recorre todo el grupo siguiendo la cadena rel="next" y guarda los registros crudos.
import fs from 'node:fs';
import { fetchHead, parseTopic, sleep, GROUP } from './lib.mjs';

const OUT = 'raw.jsonl';
const STATE = 'crawl-state.json';
const START = process.env.START_ID || '158511219202261';

const seen = new Set();
let cursor = START;

// Reanudar si ya hay avance
if (fs.existsSync(OUT)) {
  for (const line of fs.readFileSync(OUT, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { seen.add(JSON.parse(line).id); } catch {}
  }
}
if (fs.existsSync(STATE)) {
  try { cursor = JSON.parse(fs.readFileSync(STATE, 'utf8')).cursor || START; } catch {}
}

const out = fs.createWriteStream(OUT, { flags: 'a' });
let n = seen.size, fails = 0, t0 = Date.now();
console.log('inicio; ya tengo', n, 'cursor', cursor);

while (cursor) {
  if (seen.has(cursor)) {
    // ya visitado: sigue la cadena leyendo el next guardado no es posible, así que refetch ligero
  }
  let rec = null;
  try {
    const { html, status } = await fetchHead(`https://ok.ru/${GROUP}/topic/${cursor}`);
    if (status === 404) { console.log('404', cursor); break; }
    rec = parseTopic(html);
  } catch (e) {
    fails++;
    console.log('ERR', cursor, e.message, 'fails', fails);
    if (fails > 40) break;
    await sleep(3000);
    continue;
  }
  if (!rec || !rec.id) { console.log('sin datos', cursor); break; }

  if (!seen.has(rec.id)) {
    seen.add(rec.id);
    out.write(JSON.stringify(rec) + '\n');
    n++;
  }
  const nxt = rec.nextId && rec.nextId !== rec.id ? rec.nextId : null;
  fs.writeFileSync(STATE, JSON.stringify({ cursor: nxt, n, ts: Date.now() }));
  if (n % 100 === 0) {
    const mins = (Date.now() - t0) / 60000;
    console.log(`${n} posts | ${mins.toFixed(1)} min | ${(n / Math.max(mins, 0.01)).toFixed(0)}/min | cursor ${nxt}`);
  }
  if (!nxt || seen.has(nxt)) {
    if (nxt && seen.has(nxt)) console.log('ciclo detectado en', nxt);
    cursor = null;
    break;
  }
  cursor = nxt;
  await sleep(90);
}
out.end();
console.log('FIN. total', n, 'en', ((Date.now() - t0) / 60000).toFixed(1), 'min');
