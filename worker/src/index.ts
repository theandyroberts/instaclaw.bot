import { app } from "./server";

// Import workers to register them
import "./workers/provision";
import "./workers/configure-telegram";
import "./workers/configure-workspace";
import "./workers/suspend";
import "./workers/unsuspend";
import "./workers/terminate";
import { scheduleHealthChecks } from "./workers/health-check";

const PORT = parseInt(process.env.PORT || "3001");

app.listen(PORT, () => {
  console.log(`Worker API server listening on port ${PORT}`);
  console.log("All workers registered and ready");

  // Schedule health checks
  scheduleHealthChecks().catch((err) => {
    console.error("Failed to schedule health checks:", err);
  });
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
