import { describe, expect, it } from 'vitest';
import { schemeData, toTelugu } from '../../src/engine';
import { buildHelp } from '../../src/help/helpModel';

const help = buildHelp(schemeData, 'F9');

describe('buildHelp', () => {
  it('lists every key of the mapping', () => {
    const keys = help.sections.flatMap((s) => s.rows.flat()).filter((t) => !t.isSign).map((t) => t.key);
    expect(keys.sort()).toEqual(schemeData.entries.map((e) => e.key).sort());
  });

  it('computes its examples with the engine', () => {
    expect(help.examples.length).toBeGreaterThanOrEqual(10);
    for (const { roman, telugu } of help.examples) expect(telugu).toBe(toTelugu(roman));
    expect(help.examples[0]).toEqual({ roman: 'palaka', telugu: 'పలక' });
  });

  it('carries the scheme version, the rules and the current shortcut', () => {
    expect(help.title).toBe(`Palaka-HK ${schemeData.version}`);
    expect(help.rules.length).toBeGreaterThanOrEqual(9);
    expect(help.tips[0].keys).toBe('F9');
  });
});
