import {
  type MonitorData,
  formatLastChecked,
  buildHistoryBar,
  initTooltip,
  parseMonitorResponse,
  computeUptimeRate,
  uptimeRateClass,
} from "../shared/utils.js";

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchStatus(): Promise<MonitorData[]> {
  try {
    const response = await fetch("/api/status");
    if (!response.ok) throw new Error("Failed to fetch status");
    return parseMonitorResponse(await response.json());
  } catch {
    return [];
  }
}

let monitors: MonitorData[] = [];

// ── Render ───────────────────────────────────────────────────────────────────

function renderMonitor(monitor: MonitorData): HTMLElement {
  const card = document.createElement("div");
  card.className = "monitor-card";

  // Header row
  const header = document.createElement("div");
  header.className = "monitor-header";

  const nameLink = document.createElement("a");
  nameLink.className = "monitor-name";
  nameLink.href = monitor.url;
  nameLink.target = "_blank";
  nameLink.rel = "noopener noreferrer";
  nameLink.textContent = monitor.name;

  let statusTemp: "up" | "down" | "unknown";
  let timeTemp: number | undefined;
  if (!monitor.lastCheck) {
    statusTemp = "unknown";
    timeTemp = undefined;
  } else {
    statusTemp = monitor.lastCheck.status;
    timeTemp = monitor.lastCheck.time;
  }

  const statusSpan = document.createElement("span");
  statusSpan.className = `monitor-status status-${statusTemp}`;
  statusSpan.textContent = statusTemp.toUpperCase();

  header.appendChild(nameLink);
  header.appendChild(statusSpan);

  // Uptime rate badge
  const rate = computeUptimeRate(monitor.history);
  const rateClass = uptimeRateClass(rate);

  const uptimeBadge = document.createElement("span");
  uptimeBadge.className = `uptime-badge uptime-${rateClass}`;
  uptimeBadge.textContent =
    rate !== null ? `${rate.toFixed(2)}% uptime` : "No data";

  header.appendChild(uptimeBadge);

  // Stats row
  const stats = document.createElement("div");
  stats.className = "monitor-stats";

  const checksSpan = document.createElement("span");
  checksSpan.textContent = `${monitor.totalChecks} total checks`;

  const lastCheckedSpan = document.createElement("span");
  lastCheckedSpan.textContent = `Last checked: ${formatLastChecked(timeTemp)}`;

  stats.appendChild(checksSpan);
  stats.appendChild(lastCheckedSpan);

  card.appendChild(header);
  card.appendChild(buildHistoryBar(monitor.history));
  card.appendChild(stats);

  return card;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

initTooltip(document.getElementById("tooltip") as HTMLElement);

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function render(): Promise<void> {
  const container = document.getElementById("monitors-container");
  if (!container) return;

  container.innerHTML = "";

  monitors = await fetchStatus();
  for (const monitor of monitors) {
    container.appendChild(renderMonitor(monitor));
  }
}

render();
setInterval(render, 30_000);
