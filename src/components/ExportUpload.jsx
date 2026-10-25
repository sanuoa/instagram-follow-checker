import Icon from "./Icon.jsx";
import ImportSummary from "./ImportSummary.jsx";

export default function ExportUpload({
  imports,
  ignoredFiles,
  onImport,
  inputVersion,
}) {
  const state = imports.followers;
  const loading = state.status === "loading";
  const ready = state.status === "ready";
  return (
    <section
      className="import-card unified-upload"
      aria-labelledby="upload-title"
      aria-busy={loading}
    >
      <div className="import-card-heading">
        <div className="icon-box">
          <Icon name="upload" size={23} />
        </div>
        <span className="step-label">ONE PLACE / BOTH LISTS</span>
      </div>
      <h3 id="upload-title">Your Instagram export</h3>
      <p>
        Choose followers and following JSON files together, including every
        split followers file. A combined relationship JSON file works too.
      </p>
      <div className={`file-picker ${state.error ? "file-picker-error" : ""}`}>
        <input
          key={inputVersion}
          id="export-files"
          type="file"
          accept=".json,application/json"
          multiple
          disabled={loading}
          aria-label="Import Instagram JSON files"
          aria-describedby={`export-hint${state.error ? " export-error" : ""}`}
          aria-invalid={Boolean(state.error)}
          onChange={(event) => {
            if (event.target.files.length)
              onImport(Array.from(event.target.files));
            event.target.value = "";
          }}
        />
        <label htmlFor="export-files">
          <Icon
            name={loading ? "info" : ready ? "check" : "upload"}
            size={21}
          />
          <span>
            {loading
              ? "Reading files locally…"
              : ready
                ? "Replace selected files"
                : "Choose Instagram JSON files"}
          </span>
          <span className="file-type">JSON</span>
        </label>
      </div>
      <p className="file-hint" id="export-hint">
        followers_1.json + following.json, or one combined JSON
        <span>
          Select all required files together. Max 25 MB per file · 100 MB total
          · 50 files.
        </span>
      </p>
      {state.error && (
        <p className="error-message" role="alert" id="export-error">
          <Icon name="warning" size={17} />
          <span>{state.error}</span>
        </p>
      )}
      {ready && (
        <div className="detected-lists">
          <ImportSummary kind="followers" state={imports.followers} />
          <ImportSummary kind="following" state={imports.following} />
        </div>
      )}
      {ignoredFiles.length > 0 && (
        <p className="ignored-files">
          <strong>
            {ignoredFiles.length} unrelated{" "}
            {ignoredFiles.length === 1 ? "file" : "files"} ignored:
          </strong>{" "}
          {ignoredFiles.join(", ")}. Requests, close friends, and other activity
          are not follower lists.
        </p>
      )}
    </section>
  );
}
