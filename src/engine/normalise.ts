/**
 * Clean-up applied to text that comes from outside (paste, file open).
 * NFC composes the deprecated two-part ai (U+0C46 U+0C56) into U+0C48.
 */
export function normalise(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .normalize('NFC');
}
