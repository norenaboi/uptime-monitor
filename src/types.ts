// --- Types -----------------------------------------------------------------

export type Subfolder = "index" | "admin" | "login";
export type File = "index.html" | "admin.html" | "login.html" | "404";

export type Monitor = {
  id: number;
  name: string;
  url: string;
  created_at: number;
};

export type Check = {
  id: number;
  monitor_id: number;
  status: "up" | "down";
  status_code: number | null;
  response_time_ms: number | null;
  checked_at: number;
};

export type CheckStatus = {
  status: "up" | "down" | "unknown";
  time: number;
};

export type HistorySlot = {
  time: Date | null;
  status: "up" | "down" | "unknown";
};

export type MonitorData = {
  id: number;
  name: string;
  url: string;
  createdAt: number;
  lastCheck: CheckStatus;
  totalChecks: number;
  history: HistorySlot[];
};
