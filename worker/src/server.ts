import express from "express";
import * as crypto from "crypto";
import * as http from "http";
import httpProxy from "http-proxy";
import { createProxyMiddleware } from "http-proxy-middleware";
import { provisionQueue, configureQueue, lifecycleQueue, poolQueue } from "./queues";
import { prisma } from "./lib/prisma";

const SHARED_SECRET = process.env.WORKER_SHARED_SECRET!;
const CONSOLE_TOKEN_SECRET = process.env.CONSOLE_TOKEN_SECRET || SHARED_SECRET;
const CONSOLE_TOKEN_TTL = 4 * 60 * 60; // 4 hours in seconds

// ---------------------------------------------------------------------------
// Helpers: signed console tokens (HMAC-SHA256)
// ---------------------------------------------------------------------------

function signConsoleToken(instanceId: string, expiresAt: number): string {
  const payload = `${instanceId}:${expiresAt}`;
  const sig = crypto
    .createHmac("sha256", CONSOLE_TOKEN_SECRET)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function verifyConsoleToken(token: string): { instanceId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;
    const [instanceId, expiresAtStr, sig] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() / 1000 > expiresAt) return null;
    const expected = crypto
      .createHmac("sha256", CONSOLE_TOKEN_SECRET)
      .update(`${instanceId}:${expiresAt}`)
      .digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
      return null;
    return { instanceId };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers: detect subdomain requests
// ---------------------------------------------------------------------------

function getSubdomainSlug(host: string | undefined): string | null {
  if (!host) return null;
  // Strip port if present
  const hostname = host.split(":")[0];
  const match = hostname.match(/^([a-z0-9]+)\.instaclaw\.bot$/);
  if (!match) return null;
  // Exclude "worker" and "www" — those are not instance slugs
  const slug = match[1];
  if (slug === "worker" || slug === "www") return null;
  return slug;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) cookies[k.trim()] = v.join("=").trim();
  }
  return cookies;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

// --- Subdomain proxy middleware (runs BEFORE json parsing + bearer auth) ---
app.use(async (req, res, next) => {
  const slug = getSubdomainSlug(req.headers.host);
  if (!slug) return next();

  // Authenticate via ?ct= query param or console_token cookie
  // (?token= is reserved for the OpenClaw gateway token, passed through to the SPA)
  const tokenParam =
    typeof req.query.ct === "string" ? req.query.ct : null;
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies["console_token"] || null;
  const rawToken = tokenParam || cookieToken;

  if (!rawToken) {
    res.status(401).json({ error: "Missing console token" });
    return;
  }

  const verified = verifyConsoleToken(rawToken);
  if (!verified) {
    res.status(401).json({ error: "Invalid or expired console token" });
    return;
  }

  // Look up instance by ID prefix matching the slug
  const instance = await prisma.instance.findFirst({
    where: {
      id: { startsWith: slug },
      status: "active",
    },
    select: { id: true, tailscaleIp: true },
  });

  if (!instance || !instance.tailscaleIp) {
    res.status(404).json({ error: "Instance not found" });
    return;
  }

  // Verify the token is for this instance
  if (!instance.id.startsWith(slug)) {
    res.status(403).json({ error: "Token does not match instance" });
    return;
  }

  // Set httpOnly cookie on first request so WebSocket/asset requests carry auth
  if (tokenParam && !cookieToken) {
    res.cookie("console_token", rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: CONSOLE_TOKEN_TTL * 1000,
      path: "/",
    });
  }

  // Store target for the proxy
  (req as any).__proxyTarget = `http://${instance.tailscaleIp}:18789`;
  // Strip proxy headers so the gateway treats the connection as local
  delete req.headers["x-forwarded-for"];
  delete req.headers["x-forwarded-proto"];
  delete req.headers["x-forwarded-host"];
  delete req.headers["x-forwarded-port"];
  delete req.headers["x-real-ip"];
  req.headers.host = "127.0.0.1:18789";
  req.headers.origin = "http://127.0.0.1:18789";
  next();
});

// Create the proxy middleware instance (HTTP only — WebSocket upgrades
// are handled separately via handleConsoleUpgrade in index.ts)
const consoleProxy = createProxyMiddleware({
  router: (req) => (req as any).__proxyTarget,
  changeOrigin: false,
  ws: false,
  pathRewrite: undefined,
  on: {
    error: (err, _req, res) => {
      console.error("[console-proxy] Error:", err.message);
      if (res && "writeHead" in res) {
        (res as http.ServerResponse).writeHead(502);
        (res as http.ServerResponse).end("Bad Gateway");
      }
    },
  },
});

// Route subdomain requests to the proxy
app.use((req, res, next) => {
  if ((req as any).__proxyTarget) {
    consoleProxy(req, res, next);
  } else {
    next();
  }
});

// --- Standard body parsing + bearer auth for API routes ---
app.use(express.json());

app.use((req, res, next) => {
  // Health check is unauthenticated
  if (req.path === "/health") return next();
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${SHARED_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Console token endpoint (called by Next.js API)
// ---------------------------------------------------------------------------
app.post("/console/:instanceId/token", async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { userId } = req.body;

    // Verify instance belongs to user
    const instance = await prisma.instance.findUnique({
      where: { id: instanceId },
      select: { id: true, userId: true, status: true, gatewayToken: true },
    });

    if (!instance) {
      res.status(404).json({ error: "Instance not found" });
      return;
    }

    if (instance.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (instance.status !== "active") {
      res.status(400).json({ error: "Instance is not active" });
      return;
    }

    // Generate signed console token (for proxy auth)
    const expiresAt = Math.floor(Date.now() / 1000) + CONSOLE_TOKEN_TTL;
    const consoleToken = signConsoleToken(instanceId, expiresAt);
    const slug = instanceId.slice(0, 8);
    // ?token= is the OpenClaw gateway token (SPA reads it for WebSocket auth)
    // ?ct= is our signed console token (proxy reads it for access control)
    const gwToken = (instance as any).gatewayToken || "";
    const consoleUrl = `https://${slug}.instaclaw.bot/?token=${gwToken}&ct=${consoleToken}`;

    res.json({ consoleUrl, token: consoleToken, expiresAt });
  } catch (error) {
    console.error("Failed to generate console token:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// ---------------------------------------------------------------------------
// Job endpoints
// ---------------------------------------------------------------------------

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

// Allocate from pool (fast path)
app.post("/jobs/allocate", async (req, res) => {
  try {
    const { instanceId, userId } = req.body;
    const job = await poolQueue.add("pool-allocate", { instanceId, userId });
    res.json({ jobId: job.id, queue: "pool" });
  } catch (error) {
    console.error("Failed to enqueue allocate:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// Pool replenish (admin/manual)
app.post("/jobs/pool-replenish", async (req, res) => {
  try {
    const job = await poolQueue.add("pool-maintain", {}, {
      jobId: `pool-maintain-manual-${Date.now()}`,
    });
    res.json({ jobId: job.id, queue: "pool" });
  } catch (error) {
    console.error("Failed to enqueue pool-replenish:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// ---------------------------------------------------------------------------
// WebSocket proxy (using http-proxy directly — http-proxy-middleware's
// upgrade() doesn't support dynamic router targets properly)
// ---------------------------------------------------------------------------
const wsProxy = httpProxy.createProxyServer({ ws: true, changeOrigin: false, xfwd: false });
wsProxy.on("error", (err, _req, res) => {
  console.error("[console-ws] Error:", err.message);
});

async function handleConsoleUpgrade(
  req: http.IncomingMessage,
  socket: any,
  head: Buffer
) {
  const slug = getSubdomainSlug(req.headers.host);
  if (!slug) {
    socket.destroy();
    return;
  }

  // Parse console token from ?ct= param or cookie
  const cookies = parseCookies(req.headers.cookie);
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const tokenParam = url.searchParams.get("ct");
  const rawToken = tokenParam || cookies["console_token"];

  if (!rawToken || !verifyConsoleToken(rawToken)) {
    socket.destroy();
    return;
  }

  // Look up instance
  const instance = await prisma.instance.findFirst({
    where: { id: { startsWith: slug }, status: "active" },
    select: { id: true, tailscaleIp: true },
  });

  if (!instance?.tailscaleIp) {
    socket.destroy();
    return;
  }

  // Strip proxy headers so the gateway treats the connection as local
  delete req.headers["x-forwarded-for"];
  delete req.headers["x-forwarded-proto"];
  delete req.headers["x-forwarded-host"];
  delete req.headers["x-forwarded-port"];
  delete req.headers["x-real-ip"];
  req.headers.host = "127.0.0.1:18789";
  req.headers.origin = "http://127.0.0.1:18789";

  // Proxy the WebSocket upgrade directly to the instance
  wsProxy.ws(req, socket, head, {
    target: `http://${instance.tailscaleIp}:18789`,
  });
}

export { app, consoleProxy, handleConsoleUpgrade };
