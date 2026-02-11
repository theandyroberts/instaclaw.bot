import express from "express";
import { provisionQueue, configureQueue, lifecycleQueue } from "./queues";

const SHARED_SECRET = process.env.WORKER_SHARED_SECRET!;

const app = express();
app.use(express.json());

// Auth middleware
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${SHARED_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});

// Health check (no auth required -- override above)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Provision job
app.post("/jobs/provision", async (req, res) => {
  try {
    const { instanceId, userId } = req.body;
    const job = await provisionQueue.add("provision", { instanceId, userId });
    res.json({ jobId: job.id, queue: "provision" });
  } catch (error) {
    console.error("Failed to enqueue provision:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// Configure Telegram
app.post("/jobs/configure-telegram", async (req, res) => {
  try {
    const { instanceId, token } = req.body;
    const job = await configureQueue.add("configure-telegram", {
      instanceId,
      token,
    });
    res.json({ jobId: job.id, queue: "configure" });
  } catch (error) {
    console.error("Failed to enqueue configure-telegram:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// Configure Workspace
app.post("/jobs/configure-workspace", async (req, res) => {
  try {
    const { instanceId } = req.body;
    const job = await configureQueue.add("configure-workspace", {
      instanceId,
    });
    res.json({ jobId: job.id, queue: "configure" });
  } catch (error) {
    console.error("Failed to enqueue configure-workspace:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// Suspend
app.post("/jobs/suspend", async (req, res) => {
  try {
    const { instanceId } = req.body;
    const job = await lifecycleQueue.add("suspend", { instanceId });
    res.json({ jobId: job.id, queue: "lifecycle" });
  } catch (error) {
    console.error("Failed to enqueue suspend:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// Unsuspend
app.post("/jobs/unsuspend", async (req, res) => {
  try {
    const { instanceId } = req.body;
    const job = await lifecycleQueue.add("unsuspend", { instanceId });
    res.json({ jobId: job.id, queue: "lifecycle" });
  } catch (error) {
    console.error("Failed to enqueue unsuspend:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// Terminate
app.post("/jobs/terminate", async (req, res) => {
  try {
    const { instanceId } = req.body;
    const job = await lifecycleQueue.add("terminate", { instanceId });
    res.json({ jobId: job.id, queue: "lifecycle" });
  } catch (error) {
    console.error("Failed to enqueue terminate:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

export { app };
