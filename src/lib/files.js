import { parseJsonExport } from './instagram.js';

// Bounds protect the tab from accidentally loading an entire export archive.
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_BATCH_BYTES = 100 * 1024 * 1024;
export const MAX_FILES = 50;

export async function readImportFiles(files, kind) {
  const selected = Array.from(files);
  if (!selected.length) throw new Error(`Choose at least one ${kind} JSON file.`);
  if (kind === 'following' && selected.length !== 1) throw new Error('Choose one following JSON file.');
  if (selected.length > MAX_FILES) throw new Error(`Choose at most ${MAX_FILES} files at a time.`);
  if (selected.reduce((total, file) => total + file.size, 0) > MAX_BATCH_BYTES) {
    throw new Error('This selection exceeds 100 MB. Choose only the relationship JSON files.');
  }

  const results = [];
  const errors = [];
  // Read sequentially so split files don't all allocate JSON strings at once.
  for (const file of selected) {
    try {
      if (!/\.json$/i.test(file.name)) throw new Error('Choose a .json file, not HTML or a ZIP archive.');
      if (file.size > MAX_FILE_BYTES) throw new Error('File exceeds the 25 MB limit. Use split relationship files.');
      const result = parseJsonExport(await file.text(), kind);
      results.push({ ...result, name: file.name });
    } catch (error) {
      errors.push(`${file.name}: ${error.message}`);
    }
  }
  // One bad split file invalidates the batch. Partial lists could mislead you.
  if (errors.length) throw new Error(errors.join('\n'));
  return results;
}
