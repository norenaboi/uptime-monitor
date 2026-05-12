import { Router, Request, Response } from "express";
import { verifyMasterKey } from "./middleware";
import {
  Subfolder,
  File,
  MonitorData,
  CheckStatus,
  HistorySlot,
} from "./types";
import * as db from "./db";
import path from "path";
import fs from "fs";
import crypto from "crypto";
export const router = Router();

// ── Status cache ──────────────────────────────────────────────────────────────

interface StatusCache {
  data: MonitorData[];
  cachedAt: number;
}

let statusCache: StatusCache | null = null;
const CACHE_TTL = 60_000; // 60 seconds

function invalidateStatusCache(): void {
  statusCache = null;
}

// ── generateHistory ───────────────────────────────────────────────────────────

function generateHistory(
  totalChecks: number,
  checks: CheckStatus[],
): HistorySlot[] {
  const SLOTS = 168;
  const slots: HistorySlot[] = [];

  for (let i = 0; i < SLOTS; i++) {
    const timesAgo = SLOTS - 1 - i;

    let check: CheckStatus;
    let status: "up" | "down" | "unknown";
    let time: Date | null;
    if (timesAgo >= totalChecks) {
      status = "unknown";
      time = null;
    } else {
      check = checks[checks.length - 1 - timesAgo];
      status = check.status;
      time = check.time != null ? new Date(check.time * 1000) : null;
    }

    slots.push({ time, status });
  }

  return slots;
}

function pathFinder(subfolder: Subfolder, file: File): string {
  if (file === "404") {
    return path.join(__dirname, "..", "public", "404.html");
  }
  const filePath: string = path.join(
    __dirname,
    "..",
    "public",
    subfolder,
    file,
  );
  return fs.existsSync(filePath) ? filePath : pathFinder("index", "404");
}

router.get("/", (req: Request, res: Response) => {
  return res.sendFile(pathFinder("index", "index.html"));
});

router.get("/login", (req: Request, res: Response) => {
  return res.sendFile(pathFinder("login", "login.html"));
});

function getCookie(req: Request, name: string): string | undefined {
  return req.headers.cookie
    ?.split(";")
    .find((c) => c.trim().startsWith(name + "="))
    ?.trim()
    .slice(name.length + 1);
}

router.get("/admin", (req: Request, res: Response) => {
  const provided = getCookie(req, "masterKey");
  const expected = process.env.MASTER_KEY;
  let valid = false;
  try {
    valid =
      provided !== undefined &&
      expected !== undefined &&
      provided.length === expected.length &&
      crypto.timingSafeEqual(
        Buffer.from(decodeURIComponent(provided)),
        Buffer.from(expected),
      );
  } catch (_) {}
  if (!valid) {
    return res.sendFile(pathFinder("index", "404"));
  }
  return res.sendFile(pathFinder("admin", "admin.html"));
});

router.get("/api/status", (req: Request, res: Response) => {
  const now = Date.now();
  if (statusCache && now - statusCache.cachedAt < CACHE_TTL) {
    return res.json(statusCache.data);
  }

  const monitors = db.getAllMonitors();
  const data: MonitorData[] = monitors.map((monitor) => {
    const checks = db.getAllChecks(monitor.id);
    const total = checks.length;
    const statuses: CheckStatus[] = checks.map((c) => ({
      status: c.status,
      time: c.checked_at,
    }));

    return {
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      createdAt: monitor.created_at,
      lastCheck: statuses[total - 1],
      totalChecks: total,
      history: generateHistory(total, statuses),
    };
  });

  statusCache = { data, cachedAt: now };
  return res.json(data);
});

router.get("/api/monitors", verifyMasterKey, (req: Request, res: Response) => {
  return res.json(db.getAllMonitors());
});

router.get(
  "/api/monitor/:id",
  verifyMasterKey,
  (req: Request, res: Response) => {
    const monitor = db.getMonitorById(Number(req.params.id));
    return monitor ? res.json(monitor) : res.sendStatus(404);
  },
);

router.put(
  "/api/monitor/:id",
  verifyMasterKey,
  (req: Request, res: Response) => {
    const monitor = db.editMonitor(
      Number(req.params.id),
      req.body.name,
      req.body.url,
    );
    invalidateStatusCache();
    return monitor ? res.json(monitor) : res.sendStatus(404);
  },
);

router.post("/api/monitor", verifyMasterKey, (req: Request, res: Response) => {
  try {
    const monitor = db.createMonitor(req.body.name, req.body.url);
    invalidateStatusCache();
    return monitor ? res.json(monitor) : res.sendStatus(400);
  } catch (err: any) {
    if (err?.code === "DUPLICATE_URL") {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
});

router.delete(
  "/api/monitor/:id",
  verifyMasterKey,
  (req: Request, res: Response) => {
    const deleted = db.deleteMonitor(Number(req.params.id));
    invalidateStatusCache();
    return deleted ? res.sendStatus(204) : res.sendStatus(404);
  },
);

router.get(
  "/api/checks/:id",
  verifyMasterKey,
  (req: Request, res: Response) => {
    return res.json(db.getAllChecks(Number(req.params.id)));
  },
);

router.get("*path", (req: Request, res: Response) => {
  return res.sendFile(pathFinder("index", "404"));
});
