import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { Monitor, Check } from "./types";

const DB_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DB_DIR, "uptime.db");

// Create the data folder if it doesn't exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export const db = new Database(DB_PATH, {});

// --- db init -----------------------------------------------------------------

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  -- monitors: one row per URL you want to watch
  CREATE TABLE IF NOT EXISTS monitors (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,           -- friendly label, e.g. "My API"
    url         TEXT    NOT NULL UNIQUE,    -- the URL that gets pinged
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- checks: one row per completed ping attempt
  CREATE TABLE IF NOT EXISTS checks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id      INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status          TEXT    NOT NULL CHECK(status IN ('up', 'down')),
    status_code     INTEGER,
    response_time_ms INTEGER,
    checked_at      INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Index so fetching the history for a single monitor is fast.
  CREATE INDEX IF NOT EXISTS idx_checks_monitor_id ON checks(monitor_id);
`);

// --- Statements -----------------------------------------------------------------

const stmtInsertMonitor = db.prepare<{
  name: string;
  url: string;
}>(`INSERT INTO monitors (name, url) VALUES (@name, @url)`);

const stmtEditMonitor = db.prepare<{
  id: number;
  name?: string;
  url?: string;
}>(`UPDATE monitors SET name = @name, url = @url WHERE id = @id`);

const stmtGetAllMonitors = db.prepare<[], Monitor>(
  `SELECT * FROM monitors ORDER BY created_at DESC`,
);

const stmtGetMonitorById = db.prepare<[number], Monitor>(
  `SELECT * FROM monitors WHERE id = ?`,
);

const stmtDeleteMonitor = db.prepare<[number], void>(
  `DELETE FROM monitors WHERE id = ?`,
);

// --- Checks -----------------------------------------------------------------

const stmtInsertCheck = db.prepare<{
  monitor_id: number;
  status: "up" | "down";
  status_code: number | null;
  response_time_ms: number | null;
}>(
  `INSERT INTO checks (monitor_id, status, status_code, response_time_ms)
   VALUES (@monitor_id, @status, @status_code, @response_time_ms)`,
);

const stmtGetAllChecks = db.prepare<[number], Check>(
  `SELECT * FROM checks WHERE monitor_id = ?`,
);

// --- Helpers -----------------------------------------------------------------

export function createMonitor(name: string, url: string): Monitor {
  try {
    const { lastInsertRowid } = stmtInsertMonitor.run({ name, url });
    return stmtGetMonitorById.get(Number(lastInsertRowid)) as Monitor;
  } catch (err: any) {
    if (err?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw Object.assign(new Error(`A monitor for "${url}" already exists.`), {
        code: "DUPLICATE_URL",
      });
    }
    throw err;
  }
}

export function editMonitor(id: number, name?: string, url?: string): Monitor {
  const existing = getMonitorById(id);
  if (!existing)
    throw Object.assign(new Error("Monitor not found"), { status: 404 });
  stmtEditMonitor.run({
    id,
    name: name ?? existing.name,
    url: url ?? existing.url,
  });
  return stmtGetMonitorById.get(id) as Monitor;
}

export function deleteMonitor(id: number): boolean {
  const { changes } = stmtDeleteMonitor.run(id);
  return changes > 0;
}

export function getAllMonitors(): Monitor[] {
  return stmtGetAllMonitors.all();
}

export function getMonitorById(id: number): Monitor | undefined {
  return stmtGetMonitorById.get(id);
}

export function recordCheck(
  monitor_id: number,
  status: "up" | "down",
  status_code: number | null,
  response_time_ms: number | null,
): void {
  stmtInsertCheck.run({ monitor_id, status, status_code, response_time_ms });
}

export function getAllChecks(monitor_id: number): Check[] {
  return stmtGetAllChecks.all(monitor_id);
}
