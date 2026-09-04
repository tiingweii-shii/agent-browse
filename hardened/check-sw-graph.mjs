// Walks the service worker's static relative-import graph from manifest.json and
// asserts every specifier resolves inside the package. Catches the class of bug
// where an unbundled MV3 worker references a file that isn't shipped (which makes
// Chrome silently abort service-worker registration).
//
// Usage: node hardened/check-sw-graph.mjs [extension-root]   (default: repo root)
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const entry = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).background.service_worker;
const seen = new Set();
const missing = [];

(function walk(rel) {
  if (seen.has(rel)) return;
  seen.add(rel);
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) { missing.push(rel); return; }
  for (const m of fs.readFileSync(abs, 'utf8')
        .matchAll(/^\s*(?:import|export)[^\n]*?from\s*['"](\.[^'"]+)['"]/gm)) {
    walk(path.normalize(path.join(path.dirname(rel), m[1])));
  }
})(entry);

if (missing.length) {
  console.error('Unresolved imports in service worker graph:\n  ' + missing.join('\n  '));
  process.exit(1);
}
console.log(`OK — ${seen.size} modules resolve`);
