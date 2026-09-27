import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { isProfileStarted, type ApplicantProfile } from "@application-copilot/shared";
import { getProfile } from "../api";
import { scanApplicationPage } from "../content/detect-fields";
import { createFieldPreview, type FieldPreview } from "../matching/field-matcher";
import "./popup.css";

const CLASSIFICATION_LABELS: Record<FieldPreview["classification"], string> = {
  recognized: "Recognized",
  unknown: "Unknown",
  unsupported: "Unsupported",
  excluded: "Excluded"
};

function Popup() {
  const [profile, setProfile] = useState<ApplicantProfile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [results, setResults] = useState<FieldPreview[] | null>(null);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setProfileError(true));
  }, []);

  const started = profile ? isProfileStarted(profile) : false;
  let profileMessage = "Checking your profile…";

  if (profileError) profileMessage = "The profile server is unavailable. Scanning can still identify fields.";
  if (profile) {
    profileMessage = started
      ? `Profile ready for ${profile.personal.firstName || "you"}.`
      : "Add profile information before filling applications.";
  }

  async function scanPage() {
    setScanning(true);
    setScanError("");
    setResults(null);

    try {
      if (!chrome.scripting?.executeScript) {
        throw new Error(
          "Chrome has not loaded the scanner permission yet. Reload Application Copilot on chrome://extensions, then try again."
        );
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) throw new Error("No active browser tab was found.");

      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scanApplicationPage
      });
      const fields = injectionResults[0]?.result ?? [];
      setResults(fields.map((field) => createFieldPreview(field, profile)));
    } catch (error) {
      const message = error instanceof Error ? error.message : "This page could not be scanned.";
      setScanError(
        message.includes("Cannot access") || message.includes("chrome://")
          ? "Chrome protects this page from extensions. Open the demo or a regular webpage and try again."
          : message
      );
    } finally {
      setScanning(false);
    }
  }

  return (
    <main>
      <p className="eyebrow">APPLICATION COPILOT</p>
      <h1>Application field preview</h1>
      <p className={`status ${profileError ? "error" : ""}`}>{profileMessage}</p>

      <div className="actions">
        <button type="button" onClick={scanPage} disabled={scanning}>
          {scanning ? "Scanning…" : "Scan this page"}
        </button>
        <button className="secondary" type="button" onClick={() => chrome.runtime.openOptionsPage()}>
          {started ? "Review profile" : "Set up profile"}
        </button>
      </div>

      {scanError && <p className="scan-error" role="alert">{scanError}</p>}
      {results && <ScanResults results={results} />}

      <p className="footnote">Scanning reads field structure only. It does not read entered values, fill fields, or submit forms.</p>
    </main>
  );
}

function ScanResults({ results }: { results: FieldPreview[] }) {
  const recognized = results.filter((result) => result.classification === "recognized").length;
  const unknown = results.filter((result) => result.classification === "unknown").length;

  if (!results.length) {
    return <div className="empty-result"><strong>No supported form controls found.</strong><span>Try a page containing a job application form.</span></div>;
  }

  return (
    <section className="results" aria-label="Detected application fields">
      <div className="results-summary">
        <strong>{results.length} fields detected</strong>
        <span>{recognized} recognized · {unknown} unknown</span>
      </div>
      <div className="field-list">
        {results.map((result, index) => (
          <article className="field-result" key={`${result.fieldId}-${index}`}>
            <div className="field-result-heading">
              <span className={`badge ${result.classification}`}>
                {CLASSIFICATION_LABELS[result.classification]}
              </span>
              <span className="control-type">{result.controlType}</span>
            </div>
            <h2>{result.label}</h2>
            {result.profilePath ? (
              <p><code>{result.profilePath}</code> · {result.hasSavedValue ? "value saved" : "no saved value"}</p>
            ) : (
              <p>{result.explanation}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>
);
