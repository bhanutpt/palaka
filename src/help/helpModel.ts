import { buildChart, type ChartSection } from '../chart/chartModel';
import { toTelugu, type SchemeData } from '../engine';
import { EXAMPLES, RULES } from './rules';

/** Everything the help page shows, generated from the mapping file. No DOM. */
export interface HelpContent {
  title: string;
  intro: string[];
  /** The chart sections, reused as the scheme tables: key, letter and note of every entry. */
  sections: ChartSection[];
  rules: string[];
  examples: { roman: string; telugu: string }[];
  tips: { keys: string; action: string }[];
}

export function buildHelp(data: SchemeData, shortcut = 'Ctrl+Space'): HelpContent {
  return {
    title: `${data.name} ${data.version}`,
    intro: [
      'Type roman letters and get exact Telugu. One key sequence always gives one output, and any Telugu text converts back to one roman spelling. Nothing is guessed.',
      'The scheme is case-sensitive: lower case is the short or plain sound, upper case the long, retroflex or special one.',
    ],
    sections: buildChart(data),
    rules: RULES,
    examples: EXAMPLES.map((roman) => ({ roman, telugu: toTelugu(roman) })),
    tips: [
      { keys: shortcut, action: 'switch between Telugu and English typing' },
      { keys: 'Backspace', action: 'removes one roman key while a syllable is being typed, and one code point afterwards' },
      { keys: 'Ctrl+Z', action: 'undo, one syllable at a time' },
      { keys: 'Ctrl+F', action: 'find and replace; type the search in Telugu or in roman' },
      { keys: 'F6', action: 'move between the text and the chart; Escape in the chart goes back to the text' },
      { keys: 'Arrow keys', action: 'walk the toolbar buttons; Tab moves on to the next part of the screen' },
      { keys: 'F1', action: 'this help' },
    ],
  };
}
