import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  compareAccounts, filterAccounts, mergeImports, normalizeUsername,
  parseExport, parseJsonExport, profileUrl,
} from '../../src/lib/instagram.js';
import { demoFollowers, demoFollowing } from '../../src/data/demo.js';

const record = (value) => ({ title: '', media_list: [], string_list_data: [{ value }] });
const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
const names = (accounts) => accounts.map((account) => account.username);

describe('username validation', () => {
  it('trims whitespace and a leading @, compares without case, and keeps display case', () => {
    expect(normalizeUsername('  @Alice.Smith_2  ')).toEqual({ username: 'Alice.Smith_2', key: 'alice.smith_2' });
  });

  it.each(['', ' ', '@@alice', 'two names', 'https://instagram.com/alice', '=SUM(A1)',
    '+alice', '-alice', 'a/b', 'a?b', '<script>', '.alice', 'alice.', 'a..b', 'a'.repeat(31), null, 123])(
    'rejects invalid username %s', (value) => expect(normalizeUsername(value)).toBeNull(),
  );
});

describe('explicit export schemas', () => {
  it('parses followers arrays and following wrappers', () => {
    expect(names(parseExport(fixture('followers_1.json'), 'followers').accounts)).toEqual(['alice', 'charlie']);
    expect(names(parseExport(fixture('following.json'), 'following').accounts)).toEqual(['alice', 'bob', 'charlie']);
  });

  it('supports a followers relationship wrapper', () => {
    expect(names(parseExport({ relationships_followers: [record('alice')] }, 'followers').accounts)).toEqual(['alice']);
  });

  it('uses valid titles when value fields are absent', () => {
    const followers = [{ title: ' @Alice ', media_list: [], string_list_data: [] }];
    const following = { relationships_following: [{ title: 'Bob', string_list_data: [{ href: 'ignored' }] }, { title: 'Charlie' }] };
    expect(names(parseExport(followers, 'followers').accounts)).toEqual(['Alice']);
    expect(names(parseExport(following, 'following').accounts)).toEqual(['Bob', 'Charlie']);
  });

  it('reads all value entries, preferring them over record titles', () => {
    const input = [{ title: 'different', string_list_data: [{ value: 'alice' }, { value: 'bob' }] }];
    expect(names(parseExport(input, 'followers').accounts)).toEqual(['alice', 'bob']);
  });

  it('does not replace an invalid supplied value with a guessed title', () => {
    expect(() => parseExport([{ title: 'alice', string_list_data: [{ value: 'not a username' }] }], 'followers')).toThrow('No valid usernames');
  });

  it('deduplicates within files and across split follower exports', () => {
    const first = parseExport(fixture('followers_1.json'), 'followers');
    const second = parseExport([...fixture('followers_2.json'), record('DAVID')], 'followers');
    const merged = mergeImports([first, second]);
    expect(names(merged.accounts)).toEqual(['alice', 'charlie', 'david']);
    expect(merged.duplicates).toBe(2);
  });

  it('reports skipped records and invalid entries without inventing usernames', () => {
    const input = [record('alice'), null, record('invalid username'), { title: 'guess' },
      { string_list_data: [{ value: 'bob' }, { value: '=bad' }] }];
    const result = parseExport(input, 'followers');
    expect(names(result.accounts)).toEqual(['alice', 'bob']);
    expect(result.skippedRecords).toBe(3);
    expect(result.invalidEntries).toBe(2);
    expect(result.issues.map((issue) => issue.record)).toEqual([2, 3, 4, 5]);
  });

  it.each([[], { relationships_followers: [] }].map((input) => ({ input })))('accepts a genuinely empty followers list', ({ input }) => {
    const result = parseExport(input, 'followers');
    expect(result.accounts).toEqual([]);
    expect(result.recordCount).toBe(0);
  });

  it('accepts an empty following list', () => {
    expect(parseExport({ relationships_following: [] }, 'following').accounts).toEqual([]);
  });

  it.each([null, '', {}, { messages: [] }, { relationships_following: [] }, [{ title: 'alice' }],
    [{ string_map_data: { Username: { value: 'alice' } } }], [{ title: 'alice', media_list: ['photo'] }],
    [{ title: 'alice', string_list_data: [], comments: [] }], [{ string_list_data: 'alice' }]].map((input) => ({ input })))(
    'rejects unsupported or unrelated followers input %#', ({ input }) => {
      expect(() => parseExport(input, 'followers')).toThrow(/Unsupported/);
    },
  );

  it('rejects wrong-category files and ambiguous wrappers', () => {
    expect(() => parseExport([record('alice')], 'following')).toThrow('Unsupported');
    expect(() => parseExport({ relationships_followers: [], relationships_following: [] }, 'following')).toThrow('Unsupported');
    expect(() => parseExport({ relationships_following: {} }, 'following')).toThrow('must be an array');
  });

  it.each([[record('')], [record('not valid')], [{ string_list_data: [] }]].map((input) => ({ input })))(
    'does not present all-invalid input as a valid empty list %#', ({ input }) => {
      expect(() => parseExport(input, 'followers')).toThrow(/not an empty/);
    },
  );

  it('rejects broken JSON and supports a byte-order mark', () => {
    expect(() => parseJsonExport('{broken', 'followers')).toThrow('not valid JSON');
    expect(parseJsonExport('\uFEFF[]', 'followers').accounts).toEqual([]);
  });

  it('never derives a username from a link', () => {
    expect(() => parseExport([{ string_list_data: [{ href: 'https://www.instagram.com/alice/' }] }], 'followers')).toThrow('No valid usernames');
  });
});

describe('set comparisons', () => {
  it('matches the acceptance example', () => {
    const result = compareAccounts(parseExport(demoFollowers, 'followers').accounts, parseExport(demoFollowing, 'following').accounts);
    expect(names(result.notFollowingBack)).toEqual(['bob']);
    expect(names(result.youDoNotFollowBack)).toEqual(['david']);
    expect(names(result.mutual)).toEqual(['alice', 'charlie']);
  });

  it('handles empty sets on either side', () => {
    const alice = parseExport([record('alice')], 'followers').accounts;
    expect(compareAccounts([], alice)).toEqual({ notFollowingBack: alice, youDoNotFollowBack: [], mutual: [] });
    expect(compareAccounts(alice, [])).toEqual({ notFollowingBack: [], youDoNotFollowBack: alice, mutual: [] });
    expect(compareAccounts([], []).mutual).toEqual([]);
  });

  it('compares normalized keys and preserves the following display spelling', () => {
    const followers = parseExport([record(' @ALICE ')], 'followers').accounts;
    const following = parseExport({ relationships_following: [record('alice')] }, 'following').accounts;
    expect(names(compareAccounts(followers, following).mutual)).toEqual(['alice']);
  });

  it('searches and sorts without changing the original list', () => {
    const accounts = parseExport([record('bob'), record('Alice'), record('charlie')], 'followers').accounts;
    expect(names(filterAccounts(accounts, ' @AL ', 'asc'))).toEqual(['Alice']);
    expect(names(filterAccounts(accounts, '', 'desc'))).toEqual(['charlie', 'bob', 'Alice']);
    expect(names(accounts)).toEqual(['bob', 'Alice', 'charlie']);
  });

  it('builds links only from validated usernames', () => {
    expect(profileUrl('@Alice')).toBe('https://www.instagram.com/Alice/');
    expect(() => profileUrl('https://evil.example')).toThrow('invalid');
  });
});
