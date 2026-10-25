import Icon from "./Icon.jsx";
import { mergeImports } from "../lib/instagram.js";

export default function ImportSummary({ kind, state }) {
  const ready = state.status === "ready";
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
    <div>
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
    </div>
  );
}
