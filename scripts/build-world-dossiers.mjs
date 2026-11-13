import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { worldV1 } from '../lib/world/data-v1.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = readFileSync(resolve(root, 'docs/PELOTONIA_COMPLETE_WORLD_SPEC_V1_1.md'), 'utf8').replace(/\r\n/g, '\n');
const section = source.match(/## 6\. Complete macro-grid dossiers\s+([\s\S]*?)(?=\n## 7\.)/)?.[1];
if (!section) throw new Error('Missing dossier section');
const headers = [...section.matchAll(/^### ([A-P](?:[1-9]|1[0-2])) — ([^\r\n]+)$/gm)];
const cells = headers.map((match, i) => {
  const id = match[1], region = match[2];
  const body = section.slice(match.index + match[0].length, headers[i + 1]?.index ?? section.length);
  const physical = body.match(/^- \*\*Physical character:\*\* ([^\r\n]+)/m)?.[1];
  if (!physical) throw new Error(`Missing physical character for ${id}`);
  const features = [...body.matchAll(/^  - \*\*(.+?)\*\* — ([^\r\n]+?)\.$/gm)].map(item => {
    const kind = item[2];
    const name = kind === 'major city' ? item[1].replace(/ — [^—]+$/, '') : item[1];
    return { name, kind };
  });
  if (region !== 'Ocean' && features.length === 0) throw new Error(`Land cell ${id} has no named content`);
  if (region === 'Ocean' && !body.includes('intentionally sparse open ocean') && features.length === 0) throw new Error(`Ocean cell ${id} is neither sparse nor named`);
  const canonical = worldV1.objects.find(o => o.id === `GRID-${id}`);
  const regionName = worldV1.objects.find(o => o.id === canonical?.properties.regionId)?.name ?? 'Ocean';
  if (!canonical) throw new Error(`Missing World 1.0 cell ${id}`);
  if (regionName !== region) console.warn(`Classification revision ${id}: ${regionName} → ${region}`);
  return { id, region, physical, features };
});
if (cells.length !== 192 || new Set(cells.map(c => c.id)).size !== 192 || cells.reduce((n,c) => n+c.features.length,0) !== 1561) throw new Error('Dossier coverage/count mismatch');
const output = `// Generated from docs/PELOTONIA_COMPLETE_WORLD_SPEC_V1_1.md by scripts/build-world-dossiers.mjs.\n// IDs are assigned in data-v1-1.mjs; changing an editable name does not change identity.\nexport const macroDossiers = ${JSON.stringify(cells,null,2)};\n`;
const target = resolve(root, 'lib/world/macro-dossiers.mjs');
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('Regenerate macro-dossiers.mjs from the authoritative spec');
} else writeFileSync(target, output);
console.log(`${cells.length} cells, ${cells.reduce((n,c) => n+c.features.length,0)} listed objects`);
