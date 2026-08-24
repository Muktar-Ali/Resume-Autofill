import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { createEmptyProfile, type ApplicantProfile, type YesNoAnswer } from "@application-copilot/shared";
import { getProfile, saveProfile } from "../api";
import "./options.css";

type GroupName = "personal" | "links" | "work";

function Options() {
  const [profile, setProfile] = useState<ApplicantProfile>(createEmptyProfile());
  const [status, setStatus] = useState("Connecting to the local server…");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProfile()
      .then((value) => {
        setProfile(value);
        setStatus(value.updatedAt ? `Last saved ${new Date(value.updatedAt).toLocaleString()}.` : "Add your information, then save it.");
      })
      .catch(() => setStatus("Cannot reach the local server. Start it and reload this page."));
  }, []);

  function update(group: GroupName, field: string, value: string) {
    setProfile((current) => ({
      ...current,
      [group]: { ...current[group], [field]: value }
    }));
    setStatus("You have unsaved changes.");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus("Saving to SQLite…");

    try {
      const saved = await saveProfile(profile);
      setProfile(saved);
      setStatus(`Saved to SQLite at ${new Date(saved.updatedAt!).toLocaleTimeString()}.`);
    } catch {
      setStatus("Could not save. Confirm the local server is running and try again.");
    } finally {
      setSaving(false);
    }
  }

  const p = profile.personal;
  const l = profile.links;
  const w = profile.work;

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">APPLICATION COPILOT</p>
          <h1>Build your reusable profile</h1>
          <p className="intro">React powers this interface; your profile is stored by the local Node API in SQLite.</p>
        </div>
        <div className="privacy-note"><span>◉</span><p><strong>Local architecture</strong><br />The API listens only on your computer.</p></div>
      </header>
      <main>
        <form onSubmit={submit}>
          <ProfileSection number="01" title="Personal information" description="The basics most applications request.">
            <TextField label="First name" value={p.firstName} onChange={(v) => update("personal", "firstName", v)} autoComplete="given-name" />
            <TextField label="Last name" value={p.lastName} onChange={(v) => update("personal", "lastName", v)} autoComplete="family-name" />
            <TextField label="Preferred name" value={p.preferredName} onChange={(v) => update("personal", "preferredName", v)} />
            <TextField label="Email" type="email" value={p.email} onChange={(v) => update("personal", "email", v)} autoComplete="email" />
            <TextField label="Phone" type="tel" value={p.phone} onChange={(v) => update("personal", "phone", v)} autoComplete="tel" />
            <TextField label="City" value={p.city} onChange={(v) => update("personal", "city", v)} />
            <TextField label="State or region" value={p.state} onChange={(v) => update("personal", "state", v)} />
            <TextField label="Country" value={p.country} onChange={(v) => update("personal", "country", v)} />
            <TextField label="Postal code" value={p.postalCode} onChange={(v) => update("personal", "postalCode", v)} />
          </ProfileSection>
          <ProfileSection number="02" title="Professional links" description="Public pages you commonly share with employers.">
            <TextField label="LinkedIn URL" type="url" value={l.linkedin} onChange={(v) => update("links", "linkedin", v)} placeholder="https://linkedin.com/in/…" />
            <TextField label="GitHub URL" type="url" value={l.github} onChange={(v) => update("links", "github", v)} placeholder="https://github.com/…" />
            <TextField label="Portfolio URL" type="url" value={l.portfolio} onChange={(v) => update("links", "portfolio", v)} placeholder="https://…" />
          </ProfileSection>
          <ProfileSection number="03" title="Current work details" description="Full employment and education history comes next.">
            <TextField label="Current title" value={w.currentTitle} onChange={(v) => update("work", "currentTitle", v)} />
            <TextField label="Current company" value={w.currentCompany} onChange={(v) => update("work", "currentCompany", v)} />
            <TextField label="Years of experience" type="number" value={w.yearsOfExperience} onChange={(v) => update("work", "yearsOfExperience", v)} />
            <SelectField label="Authorized to work?" value={w.authorizedToWork} onChange={(v) => update("work", "authorizedToWork", v)} />
            <SelectField label="Require sponsorship?" value={w.requiresSponsorship} onChange={(v) => update("work", "requiresSponsorship", v)} />
          </ProfileSection>
          <div className="save-bar">
            <p role="status" aria-live="polite">{status}</p>
            <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
          </div>
        </form>
      </main>
    </>
  );
}

function ProfileSection({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return <section><div className="section-heading"><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></div><div className="field-grid">{children}</div></section>;
}

function TextField({ label, value, onChange, type = "text", ...props }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string; placeholder?: string }) {
  return <label>{label}<input {...props} type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function SelectField({ label, value, onChange }: { label: string; value: YesNoAnswer; onChange: (value: YesNoAnswer) => void }) {
  return <label>{label}<select value={value} onChange={(e) => onChange(e.target.value as YesNoAnswer)}><option value="">Not answered</option><option value="yes">Yes</option><option value="no">No</option></select></label>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Options /></StrictMode>);
