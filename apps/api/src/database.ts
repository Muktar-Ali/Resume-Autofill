import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { createEmptyProfile, normalizeProfile, type ApplicantProfile } from "@application-copilot/shared";

export interface ProfileRepository {
  getProfile(): ApplicantProfile;
  saveProfile(profile: ApplicantProfile): ApplicantProfile;
  close(): void;
}

export function createProfileRepository(databasePath: string): ProfileRepository {
  if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);

  database.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      profile_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const find = database.prepare("SELECT profile_json FROM profiles WHERE id = 1");
  const upsert = database.prepare(`
    INSERT INTO profiles (id, profile_json, updated_at)
    VALUES (1, @profileJson, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      profile_json = excluded.profile_json,
      updated_at = excluded.updated_at
  `);

  return {
    getProfile() {
      const row = find.get() as { profile_json: string } | undefined;
      if (!row) return createEmptyProfile();
      return normalizeProfile(JSON.parse(row.profile_json) as ApplicantProfile);
    },
    saveProfile(input) {
      const profile = normalizeProfile(input);
      profile.updatedAt = new Date().toISOString();
      upsert.run({ profileJson: JSON.stringify(profile), updatedAt: profile.updatedAt });
      return profile;
    },
    close() {
      database.close();
    }
  };
}
