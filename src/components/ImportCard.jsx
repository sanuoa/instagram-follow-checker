import { useId } from "react";
import Icon from "./Icon.jsx";
import { mergeImports } from "../lib/instagram.js";

export default function ImportCard({ kind, state, onImport, inputVersion }) {
  const id = useId();
  const isFollowers = kind === "followers";
  const ready = state.status === "ready";
  const loading = state.status === "loading";
  const summary = ready ? mergeImports(state.files) : null;
  const skipped = state.files.reduce(
    (sum, file) => sum + file.skippedRecords,
    0,
  );
  const invalid = state.files.reduce(
    (sum, file) => sum + file.invalidEntries,
    0,
  );
  const hasWarnings = skipped > 0 || invalid > 0;

  return (
    <section
      className={`import-card ${ready ? "import-ready" : ""}`}
      aria-labelledby={`${id}-title`}
      aria-busy={loading}
    >
      <div className="import-card-heading">
        <div className="icon-box">
          <Icon name={isFollowers ? "users" : "user"} size={23} />
        </div>
        <span className="step-label">FILE {isFollowers ? "01" : "02"}</span>
      </div>
      <h3 id={`${id}-title`}>
        {isFollowers ? "Your followers" : "Your following"}
      </h3>
      <p>
        {isFollowers
          ? "The accounts that follow you. Add every split file."
          : "The accounts you follow. Choose your following file."}
      </p>
      <div
        className={`file-picker ${state.status === "error" ? "file-picker-error" : ""}`}
      >
        <input
          key={inputVersion}
          id={id}
          type="file"
          accept=".json,application/json"
          multiple={isFollowers}
          disabled={loading}
          aria-label={
            isFollowers
              ? "Import followers JSON files"
              : "Import following JSON file"
          }
          aria-describedby={`${id}-hint${state.error ? ` ${id}-error` : ""}`}
          aria-invalid={state.status === "error"}
          onChange={(event) => {
            if (event.target.files.length)
              onImport(kind, Array.from(event.target.files));
            event.target.value = "";
          }}
        />
        <label htmlFor={id}>
          <Icon
            name={loading ? "info" : ready ? "check" : "upload"}
            size={21}
          />
          <span>
            {loading
              ? "Reading files locally…"
              : ready
                ? "Replace selected files"
                : `Choose ${isFollowers ? "followers files" : "following file"}`}
          </span>
          <span className="file-type">JSON</span>
        </label>
      </div>
      <p className="file-hint" id={`${id}-hint`}>
        {isFollowers
          ? "followers_1.json, followers_2.json, …"
          : "following.json"}
        <span>
          {isFollowers ? "Select all split files together." : "One file."} Max
          25 MB per file.
        </span>
      </p>
      {ready && (
        <div className="import-summary" role="status">
          <div className="import-success">
            <Icon name="check" size={16} />
            <strong>
              {summary.accounts.length.toLocaleString()} unique {kind}
            </strong>
            <span>
              · {state.files.length}{" "}
              {state.files.length === 1 ? "file" : "files"}
            </span>
          </div>
          {summary.accounts.length === 0 && (
            <p>
              Valid empty list imported. This is different from missing data.
            </p>
          )}
          {summary.duplicates > 0 && (
            <p>
              {summary.duplicates.toLocaleString()} duplicate{" "}
              {summary.duplicates === 1 ? "username" : "usernames"} removed.
            </p>
          )}
          {hasWarnings && (
            <p className="warning-text">
              <Icon name="warning" size={14} /> {skipped} skipped records ·{" "}
              {invalid} invalid username entries. Results use valid entries
              only.
            </p>
          )}
          <details className="import-details">
            <summary>
              {hasWarnings
                ? "Review files and skipped records"
                : "View imported files"}
            </summary>
            {state.files.map((file, index) => (
              <div className="file-detail" key={`${file.name}-${index}`}>
                <strong>{file.name}</strong>
                <span>
                  {file.schema} · {file.recordCount.toLocaleString()} records
                </span>
                {file.issues.slice(0, 20).map((issue, issueIndex) => (
                  <p key={issueIndex}>
                    Record {issue.record}: {issue.message}
                  </p>
                ))}
                {file.issues.length > 20 && (
                  <p>
                    Showing 20 of {file.issues.length.toLocaleString()} issues.
                  </p>
                )}
              </div>
            ))}
          </details>
        </div>
      )}
      {state.error && (
        <p role="alert" className="error-message" id={`${id}-error`}>
          <Icon name="warning" size={17} />
          <span>{state.error}</span>
        </p>
      )}
    </section>
  );
}
