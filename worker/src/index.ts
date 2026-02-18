import { app, consoleProxy } from "./server";

// Import workers to register them
import "./workers/provision";
import "./workers/configure-telegram";
import "./workers/configure-workspace";
import "./workers/suspend";
import "./workers/unsuspend";
import "./workers/terminate";
import "./workers/pool-create";
import "./workers/pool-allocate";
import { scheduleHealthChecks } from "./workers/health-check";
import { schedulePoolMaintenance } from "./workers/pool-maintain";
import { ensureFirewall } from "./lib/firewall";

const PORT = parseInt(process.env.PORT || "3001");

const server = app.listen(PORT, async () => {
  console.log(`Worker API server listening on port ${PORT}`);
  console.log("All workers registered and ready");

  // Ensure DO cloud firewall exists at startup
  try {
    const fwId = await ensureFirewall();
    console.log(`DO cloud firewall ready: ${fwId}`);
  } catch (err) {
    console.error("Failed to ensure DO firewall:", err);
  }

  // Schedule health checks
  scheduleHealthChecks().catch((err) => {
    console.error("Failed to schedule health checks:", err);
  });

  // Schedule pool maintenance
  schedulePoolMaintenance().catch((err) => {
    console.error("Failed to schedule pool maintenance:", err);
  });
});

// WebSocket upgrade handling for console proxy
server.on("upgrade", (req, socket, head) => {
  consoleProxy.upgrade(req, socket as any, head);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down...");
  process.exit(0);
});
