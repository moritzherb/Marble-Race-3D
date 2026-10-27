// Builds dist/index.html: the same page as prototype/index.html without the
// <html>/<head>/<body> wrapper, which the Claude artifact host adds itself.
// The scripts are published alongside it from prototype/src/.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

const html = readFileSync('prototype/index.html', 'utf8');
const head = html
  .match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];

mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', `${head.trim()}\n${body.trim()}\n`);
const scripts = readdirSync('prototype/src').filter((f) => f.endsWith('.js'));
console.log(`dist/index.html written; publish with ${scripts.length} scripts from prototype/src/`);
