// Build-time check of scheme/palaka-hk.json; a non-zero exit fails the build.
import { schemeData, validateScheme } from '../src/engine';

const errors = validateScheme(schemeData);
if (errors.length > 0) {
  console.error(`scheme/palaka-hk.json is invalid (${errors.length} problems):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`${schemeData.name} ${schemeData.version}: ${schemeData.entries.length} entries, valid.`);
