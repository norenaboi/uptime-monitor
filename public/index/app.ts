// ── Types ────────────────────────────────────────────────────────────────────

type CheckStatus = "up" | "down" | "unknown";

type HistorySlot = {
  time: Date;
  status: CheckStatus;
};

type MonitorData = {
  id: number;
  name: string;
  url: string;
  createdAt: number;
  currentStatus: CheckStatus;
  totalChecks: number;
  lastChecked: number;
  history: HistorySlot[];
};

// ── Helpers ────────────────────────────────────────────────────────

function formatLastChecked(unix_timestamp: number): string {
  let date = new Date(unix_timestamp * 1000);
  if (date === null) return "Never";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
}

function formatSlotTime(date: Date): string {
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month} ${day}, ${hours}:${minutes}`;
}

async function fetchStatus(): Promise<MonitorData[]> {
  try {
    const response = await fetch("/api/status");
    if (!response.ok) throw new Error("Failed to fetch status");
    const data = await response.json();
    return data.map(
      (m: any): MonitorData => ({
        ...m,
        history: m.history.map(
          (h: any): HistorySlot => ({
            status: h.status,
            time: new Date(h.time),
          }),
        ),
      }),
    );
  } catch {
    return [];
  }
}

let monitors: MonitorData[] = [];

// ── Render ───────────────────────────────────────────────────────────────────

function renderMonitor(monitor: MonitorData): HTMLElement {
  // Card
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

  const statusSpan = document.createElement("span");
  statusSpan.className = `monitor-status status-${monitor.currentStatus}`;
  statusSpan.textContent = monitor.currentStatus.toUpperCase();

  header.appendChild(nameLink);
  header.appendChild(statusSpan);

  // History bar
  const bar = document.createElement("div");
  bar.className = "history-bar";

  for (const slot of monitor.history) {
    const seg = document.createElement("div");
    seg.className = `bar-segment status-${slot.status}`;
    seg.dataset["tooltip"] = `${formatSlotTime(slot.time)} — ${slot.status}`;
    bar.appendChild(seg);
  }

  // Stats row
  const stats = document.createElement("div");
  stats.className = "monitor-stats";

  const checksSpan = document.createElement("span");
  checksSpan.textContent = `${monitor.totalChecks} total checks`;

  const lastCheckedSpan = document.createElement("span");
  lastCheckedSpan.textContent = `Last checked: ${formatLastChecked(monitor.lastChecked)}`;

  stats.appendChild(checksSpan);
  stats.appendChild(lastCheckedSpan);

  card.appendChild(header);
  card.appendChild(bar);
  card.appendChild(stats);

  return card;
}

// ── Tooltip (event delegation) ────────────────────────────────────────────────

const tooltip = document.getElementById("tooltip") as HTMLElement;

document.addEventListener("mouseover", (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const tooltipText = target.dataset["tooltip"];
  if (!tooltipText) return;

  tooltip.textContent = tooltipText;
  tooltip.style.display = "block";

  requestAnimationFrame(() => {
    const segRect = target.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();

    const GAP = 6; // px between bar segment top and tooltip bottom
    const EDGE_PAD = 8; // minimum distance from viewport edges

    // Horizontally centered over the segment
    let left = segRect.left + segRect.width / 2 - tipRect.width / 2;
    // Clamp to viewport
    left = Math.max(
      EDGE_PAD,
      Math.min(left, window.innerWidth - tipRect.width - EDGE_PAD),
    );

    // Position above the segment
    let top = segRect.top - tipRect.height - GAP;
    // If it would go off the top, flip below instead
    if (top < EDGE_PAD) {
      top = segRect.bottom + GAP;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  });
});

document.addEventListener("mouseout", (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.classList.contains("bar-segment")) return;

  // Only hide if we're truly leaving the segment (not moving to a child)
  const related = e.relatedTarget as HTMLElement | null;
  if (related && target.contains(related)) return;

  tooltip.style.display = "none";
});

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
