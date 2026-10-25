import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, readImportFiles } from '../../src/lib/files.js';
import { mergeImports } from '../../src/lib/instagram.js';

const file = (name, text, size = text.length) => ({ name, size, text: async () => text });

describe('browser file imports', () => {
  it('reads multiple follower files and merges duplicates', async () => {
    const json = (name) => JSON.stringify([{ string_list_data: [{ value: name }] }]);
    const results = await readImportFiles([
      file('followers_1.json', json('alice')), file('followers_2.json', json('ALICE')),
    ], 'followers');
    expect(results).toHaveLength(2);
    expect(mergeImports(results).accounts).toHaveLength(1);
  });

  it('rejects the whole batch when one split file is invalid', async () => {
    await expect(readImportFiles([file('followers_1.json', '[]'), file('followers_2.json', '{}')], 'followers')).rejects.toThrow('followers_2.json');
  });

  it('distinguishes missing input from an empty file list', async () => {
    await expect(readImportFiles([], 'followers')).rejects.toThrow('Choose at least one');
    expect((await readImportFiles([file('followers.json', '[]')], 'followers'))[0].accounts).toEqual([]);
  });

  it('rejects non-JSON files, oversized files, and unreadable files', async () => {
    await expect(readImportFiles([file('data.zip', '[]')], 'followers')).rejects.toThrow('.json');
    await expect(readImportFiles([file('data.json', '[]', MAX_FILE_BYTES + 1)], 'followers')).rejects.toThrow('25 MB');
    await expect(readImportFiles([{ name: 'data.json', size: 5, text: async () => { throw new Error('Access denied'); } }], 'followers')).rejects.toThrow('Access denied');
  });

  it('enforces file count and batch-size limits', async () => {
    await expect(readImportFiles(Array.from({ length: 51 }, () => file('data.json', '[]')), 'followers')).rejects.toThrow('at most 50');
    await expect(readImportFiles(Array.from({ length: 5 }, () => file('data.json', '[]', MAX_FILE_BYTES)), 'followers')).rejects.toThrow('100 MB');
    await expect(readImportFiles([file('one.json', '{}'), file('two.json', '{}')], 'following')).rejects.toThrow('one following');
  });
});
