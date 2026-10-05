import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  isProfileStarted,
  type ApplicantProfile,
  type FieldFillInstruction,
  type FieldFillResult
} from "@application-copilot/shared";
import { getProfile, matchLearnedAnswers, saveLearnedAnswer } from "../api";
import { scanApplicationPage } from "../content/detect-fields";
import { fillApplicationFields } from "../content/fill-fields";
import {
  applyLearnedAnswer,
  createFieldPreview,
  getProfileValue,
  type FieldPreview
} from "../matching/field-matcher";
import "./popup.css";

const CLASSIFICATION_LABELS: Record<FieldPreview["classification"], string> = {
  recognized: "Profile",
  learned: "Learned",
  unknown: "Unknown",
  draft: "Draft later",
  unsupported: "Unsupported",
  excluded: "Excluded"
};

function Popup() {
  const [profile, setProfile] = useState<ApplicantProfile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [filling, setFilling] = useState(false);
  const [savingAnswerId, setSavingAnswerId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [results, setResults] = useState<FieldPreview[] | null>(null);
  const [fillResults, setFillResults] = useState<FieldFillResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [scannedTabId, setScannedTabId] = useState<number | null>(null);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setProfileError(true));
  }, []);

  const started = profile ? isProfileStarted(profile) : false;
  let profileMessage = "Checking your profile…";

  if (profileError) profileMessage = "The local server is unavailable. Learned answers cannot be loaded or saved.";
  if (profile) {
    profileMessage = started
      ? `Profile ready for ${profile.personal.firstName || "you"}.`
      : "Add profile information before filling profile fields.";
  }

  async function scanPage() {
    setScanning(true);
    setActionError("");
    setResults(null);
    setFillResults([]);
    setSelectedIds(new Set());
    setAnswerDrafts({});
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
      const initialPreviews = fields.map((field) => createFieldPreview(field, profile));
      const unknownQuestions = initialPreviews
        .filter((preview) => preview.classification === "unknown")
        .map((preview) => ({
          fieldId: preview.fieldId,
          question: preview.label,
          controlType: preview.controlType
        }));

      let resolvedPreviews = initialPreviews;
      if (unknownQuestions.length) {
        try {
          const matches = await matchLearnedAnswers(unknownQuestions);
          const matchByFieldId = new Map(matches.map((match) => [match.fieldId, match.learnedAnswer]));
          resolvedPreviews = initialPreviews.map((preview) =>
            applyLearnedAnswer(preview, matchByFieldId.get(preview.fieldId) ?? null)
          );
        } catch {
          setActionError("Fields were scanned, but learned answers could not be checked. Confirm the local server is running.");
        }
      }

      setResults(resolvedPreviews);
      setScannedTabId(tab.id);
      setSelectedIds(
        new Set(
          resolvedPreviews
            .filter(
              (preview) =>
                ["recognized", "learned"].includes(preview.classification) &&
                preview.hasSavedValue
            )
            .map((preview) => preview.fieldId)
        )
      );
    } catch (error) {
      showActionError(error, "This page could not be scanned.");
    } finally {
      setScanning(false);
    }
  }

  async function saveUnknownAnswer(preview: FieldPreview) {
    const answer = answerDrafts[preview.fieldId]?.trim() ?? "";
    if (!answer) {
      setActionError("Enter an answer before saving it.");
      return;
    }

    setSavingAnswerId(preview.fieldId);
    setActionError("");

    try {
      const learnedAnswer = await saveLearnedAnswer({
        question: preview.label,
        answer,
        controlType: preview.controlType
      });
      setResults((current) =>
        current?.map((item) =>
          item.fieldId === preview.fieldId ? applyLearnedAnswer(item, learnedAnswer) : item
        ) ?? null
      );
      setSelectedIds((current) => new Set(current).add(preview.fieldId));
      setAnswerDrafts((current) => {
        const next = { ...current };
        delete next[preview.fieldId];
        return next;
      });
    } catch (error) {
      showActionError(error, "The answer could not be saved.");
    } finally {
      setSavingAnswerId(null);
    }
  }

  async function fillSelectedFields() {
    if (scannedTabId === null || !results) {
      setActionError("Scan the page before filling fields.");
      return;
    }

    const instructions = results.flatMap((result): FieldFillInstruction[] => {
      if (!selectedIds.has(result.fieldId) || !result.hasSavedValue) return [];
      if (!["recognized", "learned"].includes(result.classification)) return [];

      const value = result.profilePath && profile
        ? getProfileValue(profile, result.profilePath)
        : result.learnedAnswer?.answer ?? "";
      if (!value.trim()) return [];

      return [{
        fieldId: result.fieldId,
        label: result.label,
        controlType: result.controlType,
        locator: result.locator,
        value
      }];
    });

    if (!instructions.length) {
      setActionError("Select at least one profile or learned field with a saved value.");
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
          answerDrafts={answerDrafts}
          filling={filling}
          savingAnswerId={savingAnswerId}
          onToggle={toggleField}
          onAnswerChange={(fieldId, value) =>
            setAnswerDrafts((current) => ({ ...current, [fieldId]: value }))
          }
          onSaveAnswer={saveUnknownAnswer}
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
  answerDrafts,
  filling,
  savingAnswerId,
  onToggle,
  onAnswerChange,
  onSaveAnswer,
  onFill
}: {
  results: FieldPreview[];
  selectedIds: Set<string>;
  fillResults: FieldFillResult[];
  answerDrafts: Record<string, string>;
  filling: boolean;
  savingAnswerId: string | null;
  onToggle: (fieldId: string) => void;
  onAnswerChange: (fieldId: string, value: string) => void;
  onSaveAnswer: (preview: FieldPreview) => void;
  onFill: () => void;
}) {
  const known = results.filter((result) =>
    ["recognized", "learned"].includes(result.classification)
  ).length;
  const unknown = results.filter((result) => result.classification === "unknown").length;
  const filled = fillResults.filter((result) => result.status === "filled").length;

  if (!results.length) {
    return <div className="empty-result"><strong>No supported form controls found.</strong><span>Try a page containing a job application form.</span></div>;
  }

  return (
    <section className="results" aria-label="Detected application fields">
      <div className="results-summary">
        <strong>{results.length} fields detected</strong>
        <span>{known} known · {unknown} unknown</span>
      </div>
      <div className="field-list">
        {results.map((result) => {
          const fillResult = fillResults.find((item) => item.fieldId === result.fieldId);
          const selectable =
            ["recognized", "learned"].includes(result.classification) &&
            result.hasSavedValue;

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
              {result.classification === "unknown" && (
                <AnswerEditor
                  preview={result}
                  value={answerDrafts[result.fieldId] ?? ""}
                  saving={savingAnswerId === result.fieldId}
                  onChange={(value) => onAnswerChange(result.fieldId, value)}
                  onSave={() => onSaveAnswer(result)}
                />
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

function AnswerEditor({
  preview,
  value,
  saving,
  onChange,
  onSave
}: {
  preview: FieldPreview;
  value: string;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  const hasOptions = preview.options.length > 0;
  const isYesNoCheckbox = preview.controlType === "checkbox";

  return (
    <div className="answer-editor">
      {hasOptions || isYesNoCheckbox ? (
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose an answer</option>
          {(hasOptions
            ? preview.options
            : [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]
          ).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : preview.controlType === "textarea" ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter the reusable answer"
          rows={3}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter the reusable answer"
        />
      )}
      <button className="save-answer" type="button" onClick={onSave} disabled={!value.trim() || saving}>
        {saving ? "Saving…" : "Save answer"}
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>
);
