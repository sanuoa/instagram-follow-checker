import { useRef, useState } from "react";
import Icon from "./components/Icon.jsx";
import ExportUpload from "./components/ExportUpload.jsx";
import Results from "./components/Results.jsx";
import { readExportSelection } from "./lib/files.js";
import { compareAccounts, mergeImports, parseExport } from "./lib/instagram.js";
import { demoFollowers, demoFollowing } from "./data/demo.js";
import "./styles.css";

const emptyImport = () => ({ status: "idle", files: [], error: "" });
const emptyImports = () => ({
  followers: emptyImport(),
  following: emptyImport(),
});

export default function App() {
  const [imports, setImports] = useState(emptyImports);
  const [comparison, setComparison] = useState(null);
  const [reportVersion, setReportVersion] = useState(0);
  const [isDemo, setIsDemo] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [notice, setNotice] = useState("");
  const [inputVersion, setInputVersion] = useState(0);
  const [ignoredFiles, setIgnoredFiles] = useState([]);
  // A newer selection or Clear invalidates an older, still-reading import.
  const versions = useRef({ followers: 0, comparison: 0 });
  const ready =
    imports.followers.status === "ready" &&
    imports.following.status === "ready";
  const busy =
    comparing ||
    Object.values(imports).some((state) => state.status === "loading");
  const followerCount =
    imports.followers.status === "ready"
      ? mergeImports(imports.followers.files).accounts.length
      : null;
  const followingCount =
    imports.following.status === "ready"
      ? mergeImports(imports.following.files).accounts.length
      : null;
  const hasData = Object.values(imports).some(
    (state) => state.status !== "idle",
  );

  async function handleImport(files) {
    const version = ++versions.current.followers;
    versions.current.comparison += 1;
    setComparing(false);
    setComparison(null);
    setIsDemo(false);
    setNotice("");
    setIgnoredFiles([]);
    setImports({
      followers: { status: "loading", files: [], error: "" },
      following: emptyImport(),
    });
    try {
      const results = await readExportSelection(files);
      if (versions.current.followers !== version) return;
      setImports({
        followers: { status: "ready", files: results.followers, error: "" },
        following: { status: "ready", files: results.following, error: "" },
      });
      setIgnoredFiles(results.ignored);
    } catch (error) {
      if (versions.current.followers !== version) return;
      setImports({
        followers: { status: "error", files: [], error: error.message },
        following: emptyImport(),
      });
    }
  }

  async function compare() {
    if (!ready || busy) return;
    const version = ++versions.current.comparison;
    setComparing(true);
    setNotice("");
    // Yield to the browser so it can paint the loading state first.
    await new Promise((resolve) => setTimeout(resolve, 30));
    if (versions.current.comparison !== version) return;
    setComparison(
      compareAccounts(
        mergeImports(imports.followers.files).accounts,
        mergeImports(imports.following.files).accounts,
      ),
    );
    setComparing(false);
    setNotice("Comparison complete. Your connection report is below.");
    setReportVersion((value) => value + 1);
  }

  function invalidatePendingWork() {
    versions.current.followers += 1;
    versions.current.comparison += 1;
    setComparing(false);
    setInputVersion((value) => value + 1);
  }

  function clearAll() {
    invalidatePendingWork();
    setImports(emptyImports());
    setIgnoredFiles([]);
    setComparison(null);
    setIsDemo(false);
    setNotice("All imported data and results have been cleared.");
  }

  function loadDemo() {
    invalidatePendingWork();
    setIgnoredFiles([]);
    const followers = {
      ...parseExport(demoFollowers, "followers"),
      name: "demo_followers.json",
    };
    const following = {
      ...parseExport(demoFollowing, "following"),
      name: "demo_following.json",
    };
    setImports({
      followers: { status: "ready", files: [followers], error: "" },
      following: { status: "ready", files: [following], error: "" },
    });
    setComparison(compareAccounts(followers.accounts, following.accounts));
    setIsDemo(true);
    setReportVersion((value) => value + 1);
    setNotice(
      "Fictional demo loaded: bob does not follow you back, you do not follow david back, and alice and charlie are mutual follows.",
    );
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="nav-inner">
          <a
            href="#main"
            className="brand"
            aria-label="Instagram Follow Checker home"
          >
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>
              FOLLOW<span className="brand-light"> / CHECKER</span>
              <small>INSTAGRAM EXPORT ANALYZER</small>
            </span>
          </a>
          <div className="nav-right">
            <a href="#how-it-works">
              How it works <Icon name="arrow" size={14} />
            </a>
            <span className="privacy-pill">
              <span className="status-dot" />
              100% local & private
            </span>
          </div>
        </div>
      </header>
      <main id="main" className="main-container">
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <div className="eyebrow hero-eyebrow">
              <span className="racing-stripes" aria-hidden="true">
                ///
              </span>{" "}
              YOUR CONNECTIONS. NO GUESSWORK.
            </div>
            <h1 id="page-title">
              Instagram
              <br />
              <span>
                Follow Checker<span className="title-dot">.</span>
              </span>
            </h1>
            <p>
              Get a clearer picture of your circle. Compare your Instagram
              export to see who follows you back, privately and on your terms.
            </p>
          </div>
          <div className="hero-aside">
            <div className="privacy-emblem">
              <Icon name="shield" size={34} />
            </div>
            <span>
              Your data stays
              <br />
              <strong>in your browser.</strong>
            </span>
            <small>No login. No uploads. No tracking.</small>
          </div>
        </section>

        <section className="stats-grid" aria-label="Account overview">
          <Stat
            label="Total followers"
            value={followerCount}
            icon="users"
            detail="Accounts following you"
          />
          <Stat
            label="Total following"
            value={followingCount}
            icon="user"
            detail="Accounts you follow"
          />
          <Stat
            label="Not following me back"
            value={comparison?.notFollowingBack.length ?? null}
            icon="arrow"
            detail="Following minus followers"
            tone="orange"
          />
          <Stat
            label="Mutual follows"
            value={comparison?.mutual.length ?? null}
            icon="mutual"
            detail="You follow each other"
            tone="mint"
          />
        </section>

        <section
          className="panel import-panel"
          aria-labelledby="import-heading"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">01 / START WITH YOUR EXPORT</span>
              <h2 id="import-heading">Bring your data. Keep control.</h2>
            </div>
            <button
              type="button"
              className="button button-demo"
              onClick={loadDemo}
            >
              <Icon name="spark" size={16} />
              Try a demo
            </button>
          </div>
          <p className="section-description">
            Select your Instagram JSON files together. We’ll detect followers
            and following automatically.
          </p>
          <ExportUpload
            imports={imports}
            ignoredFiles={ignoredFiles}
            onImport={handleImport}
            inputVersion={inputVersion}
          />
          <aside
            className="export-notice"
            aria-label="Where to export your Instagram data"
          >
            <Icon name="info" size={18} />
            <p>
              <strong>Need your Instagram data?</strong> Go to Instagram’s{" "}
              <a
                href="https://accountscenter.instagram.com/info_and_permissions/"
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                aria-label="Open Instagram Accounts Center (new tab)"
              >
                Accounts Center <Icon name="external" size={12} />
              </a>{" "}
              → Your information and permissions → Export your information.
              Choose <strong>Followers and following</strong>,{" "}
              <strong>JSON</strong> format, and an <strong>All time</strong>{" "}
              date range. Menu labels may vary.
            </p>
          </aside>
          <div className="import-actions">
            <span className="import-assurance">
              <Icon name="shield" size={16} />
              <span>
                {ready
                  ? "Both lists are valid. Ready when you are."
                  : "Your files never leave this browser."}
              </span>
            </span>
            <div className="action-buttons">
              {hasData && (
                <button
                  type="button"
                  className="text-button clear-button"
                  onClick={clearAll}
                >
                  <Icon name="trash" size={16} />
                  Clear all data
                </button>
              )}
              <button
                type="button"
                className="button button-primary"
                disabled={!ready || busy}
                onClick={compare}
              >
                {comparing ? "Comparing…" : "Compare accounts"}
                <Icon name="arrow" size={18} />
              </button>
            </div>
          </div>
          {isDemo && (
            <p className="demo-note">
              <Icon name="info" size={15} />
              You’re exploring fictional demo data. Importing your own files
              replaces the demo.
            </p>
          )}
          <p className="sr-only" role="status">
            {notice}
          </p>
        </section>

        {comparison ? (
          <Results
            key={reportVersion}
            comparison={comparison}
            isDemo={isDemo}
          />
        ) : (
          <section
            className="panel waiting-panel"
            aria-labelledby="waiting-heading"
          >
            <div className="empty-icon">
              <Icon name="mutual" size={28} />
            </div>
            <div>
              <h2 id="waiting-heading">Your circle, decoded.</h2>
              <p>
                Import both lists and hit Compare accounts. Your report will
                appear here.
              </p>
            </div>
            <span className="waiting-label">
              AWAITING YOUR DATA
              <Icon name="arrow" size={16} />
            </span>
          </section>
        )}

        <section
          id="how-it-works"
          className="guide"
          aria-labelledby="guide-heading"
        >
          <div className="guide-heading">
            <span className="eyebrow">A LITTLE HELP GETTING STARTED</span>
            <h2 id="guide-heading">From export to insight.</h2>
            <p>Use files from the same export for the clearest comparison.</p>
          </div>
          <div className="guide-steps">
            <GuideStep number="01" title="Request your export">
              In Instagram’s Accounts Center, look for Your information and
              permissions → Export your information. Choose your followers and
              following data, JSON format, and an all-time date range. Labels
              may vary.
            </GuideStep>
            <GuideStep number="02" title="Find the right files">
              Unzip the download, then look inside connections /
              followers_and_following. Select all followers_*.json files and
              following.json together in the upload area.
            </GuideStep>
            <GuideStep number="03" title="Compare your circle">
              Compare, switch categories, search, and export a CSV. Results
              reflect the imported files, not live changes. Reload or clear the
              page to erase your data.
            </GuideStep>
          </div>
        </section>
        <div className="privacy-note">
          <Icon name="lock" size={19} />
          <p>
            <strong>Private by design.</strong> Files, usernames, and results
            stay in memory on this page. No backend, database, analytics, or
            Instagram credentials. Nothing is saved when you reload.
          </p>
        </div>
      </main>
      <footer className="site-footer">
        <div className="footer-about">
          <span>
            FOLLOW / CHECKER<span className="footer-dot">·</span>Built for a
            clearer picture.
          </span>
          <span>Independent tool. Not affiliated with Instagram or Meta.</span>
        </div>
        <div className="footer-developer">
          <p>
            Developed by <strong>Sanupa Gunarathne</strong>
          </p>
          <nav
            className="footer-socials"
            aria-label="Developer social profiles"
          >
            {[
              {
                label: "LinkedIn",
                url: "https://www.linkedin.com/in/sanupa-gunarathne-a0a5852a6/",
              },
              { label: "GitHub", url: "https://github.com/sanuoa" },
              {
                label: "Instagram",
                url: "https://www.instagram.com/sanuoa.p/",
              },
            ].map(({ label, url }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                aria-label={`${label}: Sanupa Gunarathne (new tab)`}
              >
                {label}
                <Icon name="external" size={12} />
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}

function Stat({ label, value, icon, detail, tone = "" }) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        <Icon name={icon} size={18} />
      </div>
      <strong className="stat-value">
        {value === null ? "—" : value.toLocaleString()}
      </strong>
      <span className="stat-detail">{detail}</span>
    </div>
  );
}

function GuideStep({ number, title, children }) {
  return (
    <div className="guide-step">
      <span className="guide-number">{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  );
}
