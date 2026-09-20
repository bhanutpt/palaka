import { normalise } from '../engine';

/** Reads a text file as UTF-8, cleaned up the same way as pasted text. */
export async function readTextFile(file: File): Promise<string> {
  return normalise(await file.text());
}

/** A file name the common file systems accept, ending in .txt. */
export function fileNameFor(title: string): string {
  // eslint-disable-next-line no-control-regex
  const base = title.replace(/\.txt$/i, '').replace(/[\\/:*?"<>|\x00-\x1F]/g, ' ').replace(/ +/g, ' ').trim();
  return `${base || 'palaka'}.txt`;
}

/** Offers the text as a UTF-8 download (no BOM). */
export function downloadText(title: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileNameFor(title);
  link.click();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // No clipboard permission (or an insecure context): the old selection-based copy still works.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  }
}
