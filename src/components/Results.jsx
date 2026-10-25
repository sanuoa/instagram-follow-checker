import { useMemo, useState } from "react";
import { filterAccounts, profileUrl } from "../lib/instagram.js";
import { downloadCsv } from "../lib/csv.js";
import Icon from "./Icon.jsx";

const categories = [
  {
    key: "notFollowingBack",
    label: "Not following me back",
    short: "Not following back",
    icon: "user",
    tone: "orange",
  },
  {
    key: "youDoNotFollowBack",
    label: "I do not follow back",
    short: "You do not follow back",
    icon: "users",
    tone: "neutral",
  },
  {
    key: "mutual",
    label: "Mutual follows",
    short: "Mutual follow",
    icon: "mutual",
    tone: "mint",
  },
];
const PAGE_SIZE = 50;

export default function Results({ comparison, isDemo }) {
  const [categoryKey, setCategoryKey] = useState("notFollowingBack");
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("asc");
  const [page, setPage] = useState(1);
  const [exportMessage, setExportMessage] = useState("");
  const category = categories.find((item) => item.key === categoryKey);
  const visible = useMemo(
    () => filterAccounts(comparison[categoryKey], query, direction),
    [comparison, categoryKey, query, direction],
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageAccounts = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  function resetPage() {
    setPage(1);
    setExportMessage("");
  }

  return (
    <section className="results-panel panel" aria-labelledby="results-heading">
      <div className="section-heading results-heading">
        <div>
          <span className="eyebrow">02 / THE BREAKDOWN</span>
          <h2 id="results-heading">Your connection report</h2>
        </div>
        <span className={`pill ${isDemo ? "demo-pill" : "success-pill"}`}>
          <Icon name={isDemo ? "spark" : "check"} size={14} />
          {isDemo ? "Fictional demo" : "Comparison complete"}
        </span>
      </div>
      <p className="report-description">
        A snapshot of the files you imported. These results do not show who
        unfollowed you.
      </p>
      <div
        className="category-tabs"
        role="group"
        aria-label="Result categories"
      >
        {categories.map((item) => (
          <button
            type="button"
            key={item.key}
            className={`category-tab ${categoryKey === item.key ? "active" : ""} ${item.tone}`}
            aria-pressed={categoryKey === item.key}
            onClick={() => {
              setCategoryKey(item.key);
              resetPage();
            }}
          >
            <span>{item.label}</span>
            <span className="category-count">
              {comparison[item.key].length.toLocaleString()}
            </span>
          </button>
        ))}
      </div>
      <div className="results-toolbar">
        <label className="search-field">
          <Icon name="search" size={18} />
          <span className="sr-only">Search usernames</span>
          <input
            type="search"
            placeholder="Search usernames…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              resetPage();
            }}
          />
        </label>
        <label className="sort-field">
          <span className="sr-only">Sort usernames</span>
          <select
            value={direction}
            onChange={(event) => {
              setDirection(event.target.value);
              resetPage();
            }}
          >
            <option value="asc">Username: A–Z</option>
            <option value="desc">Username: Z–A</option>
          </select>
        </label>
        <button
          type="button"
          className="button button-secondary export-button"
          disabled={!visible.length}
          onClick={() => {
            try {
              downloadCsv(visible, categoryKey);
              setExportMessage(
                `Exported ${visible.length} filtered ${visible.length === 1 ? "account" : "accounts"}.`,
              );
            } catch {
              setExportMessage(
                "Export could not start. Please try again in your browser.",
              );
            }
          }}
        >
          <Icon name="download" size={17} />
          Export CSV
        </button>
      </div>
      <div className="result-meta" aria-live="polite">
        <span>
          <strong>{visible.length.toLocaleString()}</strong>{" "}
          {visible.length === 1 ? "account" : "accounts"}
          {query && ` matching “${query}”`}
          <span className="meta-divider">/</span>
          {category.label}
        </span>
        <span className="local-label">
          <Icon name="lock" size={13} />
          Only on this device
        </span>
      </div>
      {exportMessage && (
        <p className="export-message" role="status">
          {exportMessage}
        </p>
      )}
      {visible.length > 0 ? (
        <>
          <div className="table-scroll">
            <table className="results-table">
              <caption className="sr-only">
                {category.label}: {visible.length} accounts
              </caption>
              <thead>
                <tr>
                  <th scope="col">ACCOUNT</th>
                  <th scope="col">RELATIONSHIP</th>
                  <th scope="col">
                    <span className="sr-only">Instagram profile</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageAccounts.map((account) => (
                  <tr key={account.key}>
                    <td>
                      <span className="account-cell">
                        <span className="avatar" aria-hidden="true">
                          {account.username.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="username">@{account.username}</span>
                      </span>
                    </td>
                    <td>
                      <span className={`relationship-badge ${category.tone}`}>
                        <span className="status-dot" />
                        {category.short}
                      </span>
                    </td>
                    <td>
                      <a
                        className="profile-link"
                        href={profileUrl(account.username)}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        aria-label={`Open @${account.username} on Instagram (new tab)`}
                      >
                        <span>View profile</span>
                        <Icon name="external" size={15} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="results-footer">
            <span>
              Showing {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–
              {Math.min(page * PAGE_SIZE, visible.length).toLocaleString()} of{" "}
              {visible.length.toLocaleString()} · CSV includes all filtered
              results
            </span>
            {pageCount > 1 && (
              <div className="pagination">
                <button
                  className="button button-small"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span>
                  {page} / {pageCount}
                </span>
                <button
                  className="button button-small"
                  disabled={page === pageCount}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="empty-results">
          <div className="empty-icon">
            <Icon name={query ? "search" : category.icon} size={28} />
          </div>
          <h3>
            {query ? "No matching usernames" : "No accounts in this category"}
          </h3>
          <p>
            {query
              ? "Try another username or clear your search."
              : "Your imported files have no accounts with this relationship."}
          </p>
          {query && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setQuery("");
                resetPage();
              }}
            >
              Clear search
            </button>
          )}
        </div>
      )}
      <div className="report-note">
        <Icon name="info" size={16} />
        <p>
          Exports are a point-in-time snapshot, not live Instagram data. A
          single export cannot establish who unfollowed you. Profile links open
          Instagram only when you click them.
        </p>
      </div>
    </section>
  );
}
