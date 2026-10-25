// A username is data, never a URL or a piece of HTML.
export function normalizeUsername(value) {
  if (typeof value !== "string") return null;
  const username = value.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) return null;
  if (
    username.startsWith(".") ||
    username.endsWith(".") ||
    username.includes("..")
  )
    return null;
  return { username, key: username.toLowerCase() };
}

export class ImportError extends Error {
  constructor(message) {
    super(message);
    this.name = "ImportError";
  }
}

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const recordFields = new Set(["title", "media_list", "string_list_data"]);

function isRelationshipRecord(record, hasWrapper) {
  if (!isObject(record)) return false;
  // Restrict this schema so comment, message, and other export records aren't
  // interpreted as relationships just because they contain a title or value.
  if (Object.keys(record).some((key) => !recordFields.has(key))) return false;
  if (
    has(record, "media_list") &&
    (!Array.isArray(record.media_list) || record.media_list.length > 0)
  )
    return false;
  if (has(record, "string_list_data"))
    return Array.isArray(record.string_list_data);
  // A title alone needs context: either a relationship wrapper or media_list.
  return (
    has(record, "title") && (hasWrapper || Array.isArray(record.media_list))
  );
}

function detectSchema(data, kind) {
  if (!["followers", "following"].includes(kind))
    throw new ImportError("Unknown import category.");
  if (kind === "followers" && Array.isArray(data)) {
    return {
      records: data,
      schema: "Followers relationship array",
      hasWrapper: false,
    };
  }

  const field =
    kind === "followers"
      ? "relationships_followers"
      : "relationships_following";
  const otherField =
    kind === "followers"
      ? "relationships_following"
      : "relationships_followers";
  if (isObject(data) && has(data, field) && !has(data, otherField)) {
    if (!Array.isArray(data[field]))
      throw new ImportError(`${field} must be an array.`);
    return { records: data[field], schema: field, hasWrapper: true };
  }

  const expected =
    kind === "followers"
      ? "a followers relationship array or an object with relationships_followers"
      : "an object with a relationships_following array";
  throw new ImportError(
    `Unsupported ${kind} structure. Expected ${expected}. Choose the matching JSON file from your Instagram export, not a different activity file.`,
  );
}

export function parseExport(data, kind) {
  const { records, schema, hasWrapper } = detectSchema(data, kind);
  const accounts = new Map();
  const issues = [];
  let skippedRecords = 0;
  let invalidEntries = 0;
  let duplicates = 0;

  if (
    records.length &&
    !records.some((record) => isRelationshipRecord(record, hasWrapper))
  ) {
    throw new ImportError(
      `Unsupported ${kind} records. No recognized relationship records were found. Use the followers/following JSON export, not messages, comments, or other activity.`,
    );
  }

  records.forEach((record, index) => {
    const report = (message) => issues.push({ record: index + 1, message });
    if (!isRelationshipRecord(record, hasWrapper)) {
      skippedRecords += 1;
      report("Skipped: unsupported relationship record.");
      return;
    }

    const entries = record.string_list_data ?? [];
    // Prefer value fields. Fall back to title only when no nonempty value was
    // supplied; an invalid supplied value must not turn into a guessed name.
    const hasValues = entries.some(
      (entry) => isObject(entry) && has(entry, "value") && entry.value !== "",
    );
    const candidates = hasValues
      ? entries.map((entry) => entry?.value)
      : [record.title];
    let validCount = 0;

    candidates.forEach((candidate) => {
      const account = normalizeUsername(candidate);
      if (!account) {
        invalidEntries += 1;
        report(
          "Skipped an invalid or missing username. Usernames must be 1–30 letters, numbers, underscores, or validly placed periods.",
        );
        return;
      }
      validCount += 1;
      if (accounts.has(account.key)) duplicates += 1;
      else accounts.set(account.key, account);
    });
    if (validCount === 0) skippedRecords += 1;
  });

  // [] is a real empty list. A nonempty list that could not be parsed is not.
  if (records.length && accounts.size === 0) {
    throw new ImportError(
      `No valid usernames in ${records.length} ${kind} record(s); ${skippedRecords} record(s) skipped. This is invalid input, not an empty relationship list. Check that you selected the correct JSON export.`,
    );
  }

  return {
    accounts: [...accounts.values()],
    schema,
    recordCount: records.length,
    skippedRecords,
    invalidEntries,
    duplicates,
    issues,
  };
}

export function parseJsonExport(text, kind) {
  let data;
  try {
    // Some downloaded JSON files include a UTF-8 byte-order mark.
    data = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new ImportError(
      "This file is not valid JSON. Request a JSON-format Instagram export and choose the original .json file.",
    );
  }
  return parseExport(data, kind);
}

export function mergeImports(imports) {
  const accounts = new Map();
  let duplicates = 0;
  imports.forEach((result) => {
    duplicates += result.duplicates;
    result.accounts.forEach((account) => {
      if (accounts.has(account.key)) duplicates += 1;
      else accounts.set(account.key, account);
    });
  });
  return { accounts: [...accounts.values()], duplicates };
}

export function compareAccounts(followers, following) {
  const followerKeys = new Set(followers.map((account) => account.key));
  const followingKeys = new Set(following.map((account) => account.key));
  return {
    notFollowingBack: following.filter(
      (account) => !followerKeys.has(account.key),
    ),
    youDoNotFollowBack: followers.filter(
      (account) => !followingKeys.has(account.key),
    ),
    mutual: following.filter((account) => followerKeys.has(account.key)),
  };
}

export function filterAccounts(accounts, query, direction = "asc") {
  const search = query.trim().replace(/^@/, "").toLowerCase();
  return accounts
    .filter((account) => account.key.includes(search))
    .sort(
      (a, b) =>
        (direction === "desc" ? -1 : 1) * a.key.localeCompare(b.key, "en"),
    );
}

export function profileUrl(username) {
  const account = normalizeUsername(username);
  if (!account) throw new Error("Cannot link an invalid Instagram username.");
  return `https://www.instagram.com/${encodeURIComponent(account.username)}/`;
}
