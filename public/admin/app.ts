import {
  type MonitorData,
  formatLastChecked,
  buildHistoryBar,
  initTooltip,
  parseMonitorResponse,
} from "../shared/utils.js";

// ── Helpers ────────────────────────────────────────────────────────

function requireMasterKey(): string {
  const masterKey = sessionStorage.getItem("masterKey");
  if (!masterKey) window.location.href = "/admin/login";
  return masterKey as string;
}

async function fetchStatus(): Promise<MonitorData[]> {
  try {
    const response = await fetch("/api/status", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: requireMasterKey(),
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        setTimeout(() => {
          window.location.href = "/login";
        }, 5_000);
        throw new Error("Invalid master key");
      }
      throw new Error("Failed to fetch status");
    }

    return parseMonitorResponse(await response.json());
  } catch (error: any) {
    return [];
  }
}

let monitors: MonitorData[] = [];
// ── State ────────────────────────────────────────────────────────────────────

let editingId: number | null = null;
let deletingId: number | null = null;

// ── DOM references ───────────────────────────────────────────────────────────

const monitorModal = document.getElementById("monitor-modal") as HTMLElement;
const deleteModal = document.getElementById("delete-modal") as HTMLElement;
const modalTitle = document.getElementById("modal-title") as HTMLElement;
const modalName = document.getElementById("modal-name") as HTMLInputElement;
const modalUrl = document.getElementById("modal-url") as HTMLInputElement;
const modalSubmitBtn = document.getElementById(
  "modal-submit-btn",
) as HTMLButtonElement;
const deleteMonitorName = document.getElementById(
  "delete-monitor-name",
) as HTMLElement;
const tooltip = document.getElementById("tooltip") as HTMLElement;

// ── SVG helpers ──────────────────────────────────────────────────────────────

function makeSvg(viewBox: string, pathD: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathD);
  svg.appendChild(path);
  return svg;
}

const EDIT_PATH =
  "M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z";

const TRASH_PATH =
  "M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z";

// ── Render ───────────────────────────────────────────────────────────────────

function renderMonitor(monitor: MonitorData): HTMLElement {
  // Card
  const card = document.createElement("div");
  card.className = "monitor-card";

  // ── Name row ──────────────────────────────────────────────────────────────
  const nameRow = document.createElement("div");
  nameRow.className = "monitor-name-row";

  const nameLink = document.createElement("a");
  nameLink.className = "monitor-name";
  nameLink.href = monitor.url;
  nameLink.target = "_blank";
  nameLink.rel = "noopener noreferrer";
  nameLink.textContent = monitor.name;

  // Edit button
  const editBtn = document.createElement("button");
  editBtn.className = "icon-btn edit-btn";
  editBtn.title = "Edit";
  editBtn.dataset["id"] = String(monitor.id);
  editBtn.appendChild(makeSvg("0 0 16 16", EDIT_PATH));

  // Delete button
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "icon-btn delete-btn";
  deleteBtn.title = "Delete";
  deleteBtn.dataset["id"] = String(monitor.id);
  deleteBtn.appendChild(makeSvg("0 0 16 16", TRASH_PATH));

  nameRow.appendChild(nameLink);
  nameRow.appendChild(editBtn);
  nameRow.appendChild(deleteBtn);

  // ── Status row ────────────────────────────────────────────────────────────
  const statusRow = document.createElement("div");
  statusRow.className = "monitor-status-row";

  let statusTemp: "up" | "down" | "unknown";
  let timeTemp: number | undefined;
  if (!monitor.lastCheck) {
    statusTemp = "unknown";
    timeTemp = undefined;
  } else {
    statusTemp = monitor.lastCheck.status;
    timeTemp = monitor.lastCheck.time;
  }

  const statusDot = document.createElement("span");
  statusDot.className = `status-dot status-${statusTemp}`;

  const statusText = document.createElement("span");
  statusText.className = `status-text status-${statusTemp}`;
  statusText.textContent = statusTemp.toUpperCase();

  const lastCheckedSpan = document.createElement("span");
  lastCheckedSpan.textContent = `· Last checked: ${formatLastChecked(timeTemp)}`;

  statusRow.appendChild(statusDot);
  statusRow.appendChild(statusText);
  statusRow.appendChild(lastCheckedSpan);

  // ── Assemble card ─────────────────────────────────────────────────────────
  card.appendChild(nameRow);
  card.appendChild(buildHistoryBar(monitor.history));
  card.appendChild(statusRow);

  return card;
}

// ── Modal: Create / Edit ─────────────────────────────────────────────────────

function openCreateModal(): void {
  editingId = null;
  modalTitle.textContent = "Create Monitor";
  modalSubmitBtn.textContent = "Create";
  modalName.value = "";
  modalUrl.value = "";
  monitorModal.style.display = "flex";
  // Focus the first field after display kicks in
  requestAnimationFrame(() => modalName.focus());
}

function openEditModal(id: number): void {
  const m = monitors.find((mon) => mon.id === id);
  if (!m) return;

  editingId = id;
  modalTitle.textContent = "Edit Monitor";
  modalSubmitBtn.textContent = "Save";
  modalName.value = m.name;
  modalUrl.value = m.url;
  monitorModal.style.display = "flex";
  requestAnimationFrame(() => modalName.focus());
}

function closeMonitorModal(): void {
  monitorModal.style.display = "none";
  editingId = null;
}

async function handleModalSubmit(): Promise<void> {
  const name = modalName.value.trim();
  const url = modalUrl.value.trim();

  if (!name || !url) {
    // Highlight the empty field(s) briefly
    if (!name) modalName.focus();
    else modalUrl.focus();
    return;
  }

  if (editingId !== null) {
    await fetch(`/api/monitor/${editingId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: requireMasterKey(),
      },
      body: JSON.stringify({ name, url }),
    });
    // Update existing monitor
    const m = monitors.find((mon) => mon.id === editingId);
    if (m) {
      m.name = name;
      m.url = url;
    }
  } else {
    const res = await fetch("/api/monitor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: requireMasterKey(),
      },
      body: JSON.stringify({ name, url }),
    });

    if (!res.ok) {
      if (res.status === 409) {
        const err = await res.json();
        alert(err.error);
      }
      return;
    }
  }

  closeMonitorModal();
  render();
}

// ── Modal: Delete ─────────────────────────────────────────────────────────────

function openDeleteModal(id: number): void {
  const m = monitors.find((mon) => mon.id === id);
  if (!m) return;

  let masterKey: string | null = sessionStorage.getItem("masterKey");
  if (!masterKey) {
    window.location.href = "/admin/login";
    return;
  }

  deletingId = id;
  deleteMonitorName.textContent = m.name;
  deleteModal.style.display = "flex";
}

function closeDeleteModal(): void {
  deleteModal.style.display = "none";
  deletingId = null;
}

function handleDeleteConfirm(): void {
  monitors = monitors.filter((m) => m.id !== deletingId);
  fetch(`/api/monitor/${deletingId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: requireMasterKey(),
    },
  });
  closeDeleteModal();
  render();
}

// ── Event listeners ───────────────────────────────────────────────────────────

// Header buttons
document
  .getElementById("create-btn")!
  .addEventListener("click", openCreateModal);

document.getElementById("logout-btn")!.addEventListener("click", () => {
  sessionStorage.removeItem("masterKey");
  document.cookie = `masterKey=${encodeURIComponent("")}; path=/; SameSite=Strict`;
  window.location.href = "/login";
});

// Create/Edit modal controls
document
  .getElementById("modal-close-btn")!
  .addEventListener("click", closeMonitorModal);
document
  .getElementById("modal-cancel-btn")!
  .addEventListener("click", closeMonitorModal);
document
  .getElementById("modal-submit-btn")!
  .addEventListener("click", handleModalSubmit);

// Submit on Enter inside form inputs
[modalName, modalUrl].forEach((input) => {
  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") handleModalSubmit();
  });
});

// Delete modal controls
document
  .getElementById("delete-close-btn")!
  .addEventListener("click", closeDeleteModal);
document
  .getElementById("delete-cancel-btn")!
  .addEventListener("click", closeDeleteModal);
document
  .getElementById("delete-confirm-btn")!
  .addEventListener("click", handleDeleteConfirm);

// Close modals on backdrop click
monitorModal.addEventListener("click", (e: MouseEvent) => {
  if (e.target === monitorModal) closeMonitorModal();
});

deleteModal.addEventListener("click", (e: MouseEvent) => {
  if (e.target === deleteModal) closeDeleteModal();
});

// Close modals on Escape key
document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    if (monitorModal.style.display === "flex") closeMonitorModal();
    if (deleteModal.style.display === "flex") closeDeleteModal();
  }
});

// ── Event delegation for edit / delete buttons ────────────────────────────────

const monitorsContainer = document.getElementById("monitors-container")!;
monitorsContainer.addEventListener("click", (e: MouseEvent) => {
  const btn = (e.target as HTMLElement).closest(
    ".edit-btn, .delete-btn",
  ) as HTMLElement | null;
  if (!btn) return;

  const id = parseInt(btn.dataset["id"] ?? "", 10);
  if (isNaN(id)) return;

  if (btn.classList.contains("edit-btn")) {
    openEditModal(id);
  } else {
    openDeleteModal(id);
  }
});

// ── Tooltip ───────────────────────────────────────────────────────────────────

initTooltip(tooltip);

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function render(): Promise<void> {
  const container = document.getElementById("monitors-container");
  if (!container) return;

  const masterKey: string | null = sessionStorage.getItem("masterKey");
  if (!masterKey) {
    window.location.href = "/login";
    return;
  }

  container.innerHTML = "";

  monitors = await fetchStatus();
  for (const monitor of monitors) {
    container.appendChild(renderMonitor(monitor));
  }
}

render();
setInterval(render, 30_000);
