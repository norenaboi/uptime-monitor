// ── Shared types ─────────────────────────────────────────────────────────────

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

// ── Formatting helpers ────────────────────────────────────────────────────────

export function formatLastChecked(unix_timestamp: number | undefined): string {
  if (!unix_timestamp) return "Never";
  const date = new Date(unix_timestamp * 1000);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
}

export function formatSlotTime(date: Date): string {
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month} ${day}, ${hours}:${minutes}`;
}

// ── History bar ───────────────────────────────────────────────────────────────

export function buildHistoryBar(history: HistorySlot[]): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "history-bar";

  for (const slot of history) {
    const seg = document.createElement("div");
    seg.className = `bar-segment status-${slot.status}`;
    seg.dataset["tooltip"] =
      `${slot.time != null ? formatSlotTime(slot.time) + " - " : ""}${slot.status !== "unknown" ? slot.status : ""}`;
    bar.appendChild(seg);
  }

  return bar;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

export function initTooltip(tooltip: HTMLElement): void {
  document.addEventListener("mouseover", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const tooltipText = target.dataset["tooltip"];
    if (!tooltipText) return;

    tooltip.textContent = tooltipText;
    tooltip.style.display = "block";

    requestAnimationFrame(() => {
      const segRect = target.getBoundingClientRect();
      const tipRect = tooltip.getBoundingClientRect();

      const GAP = 6;
      const EDGE_PAD = 8;

      let left = segRect.left + segRect.width / 2 - tipRect.width / 2;
      left = Math.max(
        EDGE_PAD,
        Math.min(left, window.innerWidth - tipRect.width - EDGE_PAD),
      );

      let top = segRect.top - tipRect.height - GAP;
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
    const related = e.relatedTarget as HTMLElement | null;
    if (related && target.contains(related)) return;
    tooltip.style.display = "none";
  });
}

// ── API response mapping ──────────────────────────────────────────────────────

export function parseMonitorResponse(data: any[]): MonitorData[] {
  return data.map(
    (m: any): MonitorData => ({
      ...m,
      history: m.history.map(
        (h: any): HistorySlot => ({
          status: h.status,
          time: h.time != null ? new Date(h.time) : null,
        }),
      ),
    }),
  );
}
