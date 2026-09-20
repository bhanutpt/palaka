// Generates docs/SCHEME.md from scheme/palaka-hk.json, so the documentation cannot drift from the map.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schemeDoc } from './scheme-doc';

writeFileSync(fileURLToPath(new URL('../docs/SCHEME.md', import.meta.url)), schemeDoc, 'utf8');
console.log('docs/SCHEME.md written.');
