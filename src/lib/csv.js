import { profileUrl } from './instagram.js';

export function csvCell(value) {
  let text = String(value);
  // Quote escaping alone doesn't stop spreadsheet formulas. Check after
  // leading whitespace/control characters as well as at the first character.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createCsv(accounts) {
  return [
    'username,profile_url',
    ...accounts.map((account) => [account.username, profileUrl(account.username)].map(csvCell).join(',')),
  ].join('\r\n');
}

export function downloadCsv(accounts, category) {
  const blob = new Blob(['\uFEFF', createCsv(accounts)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `instagram-${category}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to begin reading the object URL before revoking it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
