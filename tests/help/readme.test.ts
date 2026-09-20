import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toTelugu } from '../../src/engine';

/** The README shows a few typed examples. They are checked against the engine so that they can never go stale. */

const readme = readFileSync('README.md', 'utf8');
// The examples table is the one headed Typed / Result; it ends at the first blank line.
const examples = readme.slice(readme.indexOf('| Typed | Result |')).split(/^\s*$/m)[0];
const rows = [...examples.matchAll(/^\| `([^`]+)` \| ([^|]+?) \|$/gm)].map(([, roman, telugu]) => [roman, telugu]);

describe('README', () => {
  it('has an examples table', () => {
    expect(rows.length).toBeGreaterThanOrEqual(6);
  });

  it.each(rows)('%s gives %s', (roman, telugu) => {
    expect(toTelugu(roman)).toBe(telugu);
  });

  it('points to the scheme, the plan and the architecture', () => {
    for (const path of ['docs/SCHEME.md', 'docs/PLAN.md', 'docs/ARCHITECTURE.md', 'CHANGELOG.md']) expect(readme).toContain(path);
  });
});
