import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  isProfileStarted,
  type ApplicantProfile,
  type FieldFillInstruction,
  type FieldFillResult
} from "@application-copilot/shared";
import { getProfile } from "../api";
import { scanApplicationPage } from "../content/detect-fields";
import { fillApplicationFields } from "../content/fill-fields";
import {
  createFieldPreview,
  getProfileValue,
  type FieldPreview
} from "../matching/field-matcher";
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
  const [filling, setFilling] = useState(false);
  const [actionError, setActionError] = useState("");
  const [results, setResults] = useState<FieldPreview[] | null>(null);
  const [fillResults, setFillResults] = useState<FieldFillResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scannedTabId, setScannedTabId] = useState<number | null>(null);

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
    setActionError("");
    setResults(null);
    setFillResults([]);
    setSelectedIds(new Set());
    setScannedTabId(null);

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
      const previews = fields.map((field) => createFieldPreview(field, profile));

      setResults(previews);
      setScannedTabId(tab.id);
      setSelectedIds(
        new Set(
          previews
            .filter((preview) => preview.classification === "recognized" && preview.hasSavedValue)
            .map((preview) => preview.fieldId)
        )
      );
    } catch (error) {
      showActionError(error, "This page could not be scanned.");
    } finally {
      setScanning(false);
    }
  }

  async function fillSelectedFields() {
    if (!profile || scannedTabId === null || !results) {
      setActionError("Scan the page and load your profile before filling fields.");
      return;
    }

    const instructions: FieldFillInstruction[] = results
      .filter(
        (result) =>
          selectedIds.has(result.fieldId) &&
          result.classification === "recognized" &&
          result.profilePath &&
          result.hasSavedValue
      )
      .map((result) => ({
        fieldId: result.fieldId,
        label: result.label,
        controlType: result.controlType,
        locator: result.locator,
        value: getProfileValue(profile, result.profilePath!)
      }));

    if (!instructions.length) {
      setActionError("Select at least one recognized field with a saved value.");
      return;
    }

    setFilling(true);
    setActionError("");
    setFillResults([]);

    try {
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: scannedTabId },
        func: fillApplicationFields,
        args: [instructions]
      });
      setFillResults(injectionResults[0]?.result ?? []);
    } catch (error) {
      showActionError(error, "The selected fields could not be filled.");
    } finally {
      setFilling(false);
    }
  }

  function showActionError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : fallback;
    setActionError(
      message.includes("Cannot access") || message.includes("chrome://")
        ? "Chrome protects this page from extensions. Open the demo or a regular webpage and try again."
        : message
    );
  }

  function toggleField(fieldId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  }

  return (
    <main>
      <p className="eyebrow">APPLICATION COPILOT</p>
      <h1>Application field preview</h1>
      <p className={`status ${profileError ? "error" : ""}`}>{profileMessage}</p>

      <div className="actions">
        <button type="button" onClick={scanPage} disabled={scanning || filling}>
          {scanning ? "Scanning…" : "Scan this page"}
        </button>
        <button className="secondary" type="button" onClick={() => chrome.runtime.openOptionsPage()}>
          {started ? "Review profile" : "Set up profile"}
        </button>
      </div>

      {actionError && <p className="scan-error" role="alert">{actionError}</p>}
      {results && (
        <ScanResults
          results={results}
          selectedIds={selectedIds}
          fillResults={fillResults}
          filling={filling}
          onToggle={toggleField}
          onFill={fillSelectedFields}
        />
      )}

      <p className="footnote">Only selected, empty fields are filled. Application Copilot never submits the form.</p>
    </main>
  );
}

function ScanResults({
  results,
  selectedIds,
  fillResults,
  filling,
  onToggle,
  onFill
}: {
  results: FieldPreview[];
  selectedIds: Set<string>;
  fillResults: FieldFillResult[];
  filling: boolean;
  onToggle: (fieldId: string) => void;
  onFill: () => void;
}) {
  const recognized = results.filter((result) => result.classification === "recognized").length;
  const unknown = results.filter((result) => result.classification === "unknown").length;
  const filled = fillResults.filter((result) => result.status === "filled").length;

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
        {results.map((result) => {
          const fillResult = fillResults.find((item) => item.fieldId === result.fieldId);
          const selectable = result.classification === "recognized" && result.hasSavedValue;

          return (
            <article className="field-result" key={result.fieldId}>
              <div className="field-result-heading">
                <span className={`badge ${result.classification}`}>
                  {CLASSIFICATION_LABELS[result.classification]}
                </span>
                <span className="control-type">{result.controlType}</span>
              </div>
              <div className="field-title-row">
                {selectable && (
                  <input
                    aria-label={`Select ${result.label}`}
                    type="checkbox"
                    checked={selectedIds.has(result.fieldId)}
                    onChange={() => onToggle(result.fieldId)}
                  />
                )}
                <h2>{result.label}</h2>
              </div>
              {result.profilePath ? (
                <p><code>{result.profilePath}</code> · {result.hasSavedValue ? "value saved" : "no saved value"}</p>
              ) : (
                <p>{result.explanation}</p>
              )}
              {fillResult && <p className={`fill-result ${fillResult.status}`}>{fillResult.message}</p>}
            </article>
          );
        })}
      </div>
      <button className="fill-button" type="button" onClick={onFill} disabled={!selectedIds.size || filling}>
        {filling ? "Filling…" : `Fill ${selectedIds.size} selected field${selectedIds.size === 1 ? "" : "s"}`}
      </button>
      {fillResults.length > 0 && (
        <p className="fill-summary" role="status">Filled {filled} of {fillResults.length} selected fields.</p>
      )}
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>
);
