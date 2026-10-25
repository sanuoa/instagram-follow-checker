# Instagram Follow Checker

A private React application that compares **your own Instagram JSON export** to show which accounts follow you back. The dashboard uses plain CSS with a charcoal, orange, coral, and mint palette. No backend, database, account login, or Instagram API is needed.

**Results describe the imported files, not live Instagram activity. A single export cannot tell you who unfollowed you.**

## Start on your computer

Install **Node.js 24 LTS** (Node 22.12+ on the 22 release line also works). npm comes with Node. Check your installation:

```sh
node --version
npm --version
```

Open a terminal in this project folder, then run:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite in your browser. Leave the terminal running while you work. Edit a file in `src` and Vite will update the page automatically. Press **Ctrl+C** in the terminal to stop the server. There is no `.env` file or secret to configure.

Dependencies are already installed in the prepared cloud workspace. If npm cannot write its default cache there, use `npm ci --cache /tmp/instagram-follow-checker-npm`.

## Try it

Click **Try a demo** to load a small, entirely fictional dataset. It matches this example:

| Input or result       | Usernames             |
| --------------------- | --------------------- |
| Following             | alice, bob, charlie   |
| Followers             | alice, charlie, david |
| Not following me back | bob                   |
| I do not follow back  | david                 |
| Mutual follows        | alice, charlie        |

To compare your own data:

1. In Instagram's Accounts Center, find **Your information and permissions → Export your information** (the labels can change). Request your **followers and following**, choose **JSON**, and use an **all-time** date range.
2. Unzip the downloaded archive on your computer. The files are usually in `connections/followers_and_following/`.
3. Choose **all** your `followers_1.json`, `followers_2.json`, and other split followers files together in the followers input. Choose `following.json` in the separate following input.
4. Review the import counts and any skipped-record warnings, then click **Compare accounts**.
5. Choose a result category, search by username, and sort A–Z or Z–A. **Export CSV** downloads every account matching that category and search, in the selected order, including results on other pages.
6. Use **Clear all data** or reload the page to clear the imported data and results. Downloaded CSV files remain on your computer until you delete them.

Choosing files again replaces that input's whole selection; it does not append to it. Select split files together. Importing your own files clears both demo lists first, so demo usernames never mix with your data. Any change to an input removes the old report until you compare again.

## Supported JSON structures

The parser deliberately recognizes specific relationship schemas. It does not recursively search arbitrary export files for things that resemble usernames.

Followers can be a relationship-record array:

```json
[
  {
    "title": "",
    "media_list": [],
    "string_list_data": [{ "value": "alice" }]
  }
]
```

Followers also support a `relationships_followers` wrapper. Following must use a `relationships_following` wrapper:

```json
{
  "relationships_following": [
    { "title": "alice", "string_list_data": [{ "value": "alice" }] },
    { "title": "bob", "string_list_data": [] }
  ]
}
```

Important parsing rules:

- Relationship records may contain `title`, an empty `media_list`, and `string_list_data`. Unknown record fields or malformed optional fields are rejected or reported as skipped records. Message, comment, media, and `string_map_data` records are not supported.
- The parser reads all usable `string_list_data[].value` fields. A valid `title` is a fallback when there is no nonempty value. Title-only records require a relationship wrapper or an empty `media_list` to establish the record schema. Bare title-only objects in a followers array are unsupported.
- A supplied, invalid nonempty value is reported; it is never replaced by a guessed username. Usernames are never extracted from imported URLs.
- Usernames are trimmed, one leading `@` is removed, and comparison uses lowercase keys. Display keeps the first encountered spelling in each list. Valid usernames contain 1–30 ASCII letters, numbers, underscores, or periods; periods cannot be consecutive or at either end.
- Duplicates are removed within files and across split followers files. Totals count unique valid usernames.
- A real `[]` followers list or `{"relationships_following": []}` is valid empty input. Missing files, broken JSON, unsupported schemas, and nonempty lists without any usable usernames block comparison.
- Mixed valid and invalid records show skipped-record and invalid-entry counts, plus record-number details. Counts may overlap: a skipped record can contain invalid entries. Results use only valid entries, so review warnings before relying on them.
- If any split file fails validation, the **whole selection** is rejected. Partial split imports would give misleading comparisons. The app cannot know whether you forgot to select another split file.
- Limits: 25 MB per file, 100 MB per selection, at most 50 followers files, and one following file. Large files are read sequentially; results render 50 rows per page.

Use files from the same export and date range. Old or incomplete exports can produce incomplete results. Instagram can change its export format; unsupported formats show an error instead of guessed results.

## How the React code fits together

| File                            | Purpose                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.jsx`                  | Mounts the React application into `index.html`.                                                                                    |
| `src/App.jsx`                   | Holds import and comparison state, handles Compare, demo, and Clear, and arranges the dashboard.                                   |
| `src/components/ImportCard.jsx` | File input, import status, validation messages, and record diagnostics.                                                            |
| `src/components/Results.jsx`    | Category filters, search, sorting, pagination, profile links, and CSV download.                                                    |
| `src/lib/instagram.js`          | Pure functions for schema detection, parsing, username normalization, deduplication, comparison, filtering, and safe profile URLs. |
| `src/lib/files.js`              | Browser file reading, input limits, and all-or-nothing batch imports.                                                              |
| `src/lib/csv.js`                | CSV escaping, spreadsheet-formula protection, and the download helper.                                                             |
| `src/data/demo.js`              | The small fictional demo.                                                                                                          |
| `src/styles.css`                | Theme variables, layout, responsive styles, focus states, and reduced-motion support.                                              |
| `tests/fixtures/`               | Synthetic test files only. Never add real exports here.                                                                            |

`useState` stores information that affects the screen. When you import a file or choose a filter, its setter updates that information and React draws the relevant UI again. File data stays in this state; it is not stored in a database or browser storage.

`useRef` keeps request version numbers without causing a redraw. If you click Clear while a file is still being read, the old request's version no longer matches, so its result cannot put the cleared data back on screen. A new report also resets the result component's filters through its React `key`.

The parser is separate from React so you can understand and test it without a browser. Each account is `{ username, key }`: `username` is the display spelling and `key` is lowercase for comparisons. A `Map` removes duplicate keys. A `Set` makes checking whether a username appears in the other list quick:

- **Not following me back** = following minus followers.
- **I do not follow back** = followers minus following.
- **Mutual follows** = usernames in both lists.

`useMemo` reuses the filtered, sorted result until its inputs change. Sorting works on a new array, so it does not mutate the original comparison results.

## Development commands

```sh
npm run dev          # Start Vite with live updates
npm test             # Run the unit tests once
npm run test:watch   # Rerun unit tests while editing
npm run build        # Create the production site in dist/
npm run preview      # Serve the built site for local checking
npm run format       # Format the source, tests, and configuration
npm run format:check # Check formatting without changing files
```

For browser tests, install Playwright's Chromium once, then run:

```sh
npx playwright install chromium
npm run test:e2e
```

On Linux, Playwright may also need system browser dependencies; its installer will report them. A cloud workspace with Chromium already installed can use:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

The browser test command builds the application, starts a production preview server, runs desktop and mobile scenarios, and stops the server. Unit tests cover supported and rejected schemas, title fallbacks, split imports, normalization, duplicates, empty lists, comparisons, file limits, and CSV security. Browser tests cover the real import and comparison flow, warnings, filtering, sorting, downloaded CSV contents, pagination, clearing, reloads, stale reads, profile links, mobile overflow, and the absence of external requests during the import workflow. They use synthetic data only.

## Privacy and safety

All processing happens in the browser with the File API. The app makes no requests containing imports, usernames, or results. There are no analytics, remote fonts, external runtime services, cookies, local storage, IndexedDB, or service workers. The app does not request credentials, scrape Instagram, or automate unfollowing.

Profile URLs are constructed from validated usernames, never imported `href` values. They open Instagram only when clicked, in a new tab with `noopener noreferrer` and no referrer. CSV cells are quoted and escaped; formula-like cell prefixes are neutralized before download. Invalid usernames cannot reach the CSV or profile-link helpers.

Real exports, ZIPs, HTML exports, CSVs, and common private-data directories are ignored by Git. Keep your real downloads outside the checkout anyway. Only package manifests, the app entry HTML, and the explicitly allowed synthetic fixtures are exceptions. Clear removes app data from the page; it does not delete original files or downloaded CSVs on disk.

## Branch workflow

The implementation is integrated into **`dev`** with separate stage branches and commits:

- `feat/app-foundation`: React, Vite, dependencies, and npm scripts.
- `feat/export-comparison`: parsing, comparison, synthetic fixtures, and unit tests.
- `feat/dashboard`: dashboard, responsive theme, imports, result controls, and browser tests.
- `bug/import-diagnostics`: malformed-entry reporting and report filter reset fixes.
- `docs/development-guide`: this guide and final project housekeeping.

For your next change, branch from `dev`, make one focused change, run the checks, and commit it:

```sh
git switch dev
git switch -c feat/your-feature
# Edit files, then run the relevant tests and build.
git add src
git commit -m "feat: describe the change"
git switch dev
git merge --no-ff feat/your-feature
```

Use `bug/description` for a fix. Feature branches keep related work together; merging them into `dev` gathers the working app in one place. These branches and commits are local. Publish branches or open pull requests on GitHub when you choose to share them.
