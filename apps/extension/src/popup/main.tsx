import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { isProfileStarted, type ApplicantProfile } from "@application-copilot/shared";
import { getProfile } from "../api";
import "./popup.css";

function Popup() {
  const [profile, setProfile] = useState<ApplicantProfile | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setError(true));
  }, []);

  const started = profile ? isProfileStarted(profile) : false;
  let message = "Checking your profile…";

  if (error) message = "The local server is not available. Start it, then reopen this popup.";
  if (profile) {
    message = started
      ? `Profile started for ${profile.personal.firstName || "you"}. You can update it at any time.`
      : "Start by adding the information you repeatedly type into applications.";
  }

  return (
    <main>
      <p className="eyebrow">APPLICATION COPILOT</p>
      <h1>Your application memory</h1>
      <p className={`status ${error ? "error" : ""}`}>{message}</p>
      <button type="button" onClick={() => chrome.runtime.openOptionsPage()}>
        {started ? "Review profile" : "Set up profile"}
      </button>
      <p className="footnote">Your profile is now stored in SQLite. Nothing is submitted automatically.</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>
);
