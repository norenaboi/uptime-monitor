import axios from "axios";
import * as db from "./db";

export function initChecks() {
  checkMonitors();
  setInterval(async () => {
    await checkMonitors();
  }, 3600_000);
}

async function checkMonitors() {
  const monitors = db.getAllMonitors();
  await Promise.all(
    monitors.map(async (monitor) => {
      try {
        const start = performance.now();
        const response = await axios.get(monitor.url, { timeout: 10_000 });
        const duration = performance.now() - start;
        db.recordCheck(
          monitor.id,
          response.status < 400 ? "up" : "down",
          response.status,
          duration,
        );
      } catch (error) {
        console.error("Failed to check monitor", monitor.id, error);
        db.recordCheck(monitor.id, "down", null, null);
      }
    }),
  );
}
