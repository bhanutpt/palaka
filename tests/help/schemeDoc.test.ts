import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { schemeDoc } from '../../scripts/scheme-doc';

it('docs/SCHEME.md is current: run `npm run docs:scheme` after changing the mapping or the rules', () => {
  expect(readFileSync('docs/SCHEME.md', 'utf8').replace(/\r\n/g, '\n')).toBe(schemeDoc);
});
