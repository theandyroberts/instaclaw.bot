import express from "express";
import * as crypto from "crypto";
import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import httpProxy from "http-proxy";
import { createProxyMiddleware, responseInterceptor } from "http-proxy-middleware";
import {
  provisionQueue,
  configureTelegramQueue,
  configureWorkspaceQueue,
  updatePlanQueue,
  suspendQueue,
  unsuspendQueue,
  terminateQueue,
  poolQueue,
  poolAllocateQueue,
  auditQueue,
  updateInstanceNameQueue,
} from "./queues";
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

type SubdomainRoute =
  | { type: "control"; slug: string }             // cmlsj9x8.instaclaw.bot
  | { type: "site"; name: string; site: string }  // electricians-bigbadbot.instaclaw.bot
  | null;

function parseSubdomain(host: string | undefined): SubdomainRoute {
  if (!host) return null;
  const hostname = host.split(":")[0];
  const match = hostname.match(/^(.+)\.instaclaw\.bot$/);
  if (!match) return null;
  const sub = match[1];
  if (sub === "worker" || sub === "www") return null;

  // If contains hyphen: split on LAST hyphen → site + instance name
  // Instance names are alphanumeric only (no hyphens), site names can have hyphens
  const lastDash = sub.lastIndexOf("-");
  if (lastDash > 0) {
    return {
      type: "site",
      site: sub.slice(0, lastDash),     // "electricians" or "my-dashboard"
      name: sub.slice(lastDash + 1),    // "bigbadbot"
    };
  }

  // No hyphen: 8-char alphanumeric starting with 'c' → control panel (CUID prefix)
  if (/^c[a-z0-9]{7}$/.test(sub)) {
    return { type: "control", slug: sub };
  }

  // Otherwise treat as instance name (future: instance homepage)
  return null;
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
const FAVICON_PATH = path.join(__dirname, "..", "favicon.ico");

// --- Caddy on-demand TLS check (unauthenticated — Caddy calls this) ---
app.get("/domain-check", async (req, res) => {
  const domain = typeof req.query.domain === "string" ? req.query.domain.toLowerCase() : null;
  if (!domain) { res.status(400).end(); return; }
  const record = await prisma.customDomain.findUnique({
    where: { domain },
    select: { id: true },
  });
  res.status(record ? 200 : 404).end();
});

// --- Subdomain proxy middleware (runs BEFORE json parsing + bearer auth) ---
app.use(async (req, res, next) => {
  const route = parseSubdomain(req.headers.host);

  // --- CUSTOM DOMAIN ROUTE (non-instaclaw.bot hostname) ---
  if (!route) {
    const hostname = req.headers.host?.split(":")[0]?.toLowerCase();
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1" && !hostname.endsWith(".instaclaw.bot")) {
      const customDomain = await prisma.customDomain.findUnique({
        where: { domain: hostname },
        include: {
          instance: {
            select: { id: true, tailscaleIp: true, gatewayToken: true, status: true },
          },
        },
      });

      if (
        customDomain?.instance.status === "active" &&
        customDomain.instance.tailscaleIp &&
        customDomain.instance.gatewayToken
      ) {
        // Lazy-update status to active on first successful proxy
        if (customDomain.status === "pending") {
          prisma.customDomain.update({
            where: { id: customDomain.id },
            data: { status: "active" },
          }).catch(() => {});
        }

        if (req.url === "/favicon.ico") {
          if (fs.existsSync(FAVICON_PATH)) {
            res.type("image/x-icon").send(fs.readFileSync(FAVICON_PATH));
          } else {
            res.status(404).end();
          }
          return;
        }

        const originalPath = req.url || "/";
        req.url = `/__openclaw__/canvas/${customDomain.siteSlug}${originalPath}`;
        req.headers.authorization = `Bearer ${customDomain.instance.gatewayToken}`;
        delete req.headers["x-forwarded-for"];
        delete req.headers["x-forwarded-proto"];
        delete req.headers["x-forwarded-host"];
        delete req.headers["x-forwarded-port"];
        delete req.headers["x-real-ip"];
        req.headers.host = "127.0.0.1:18789";
        req.headers.origin = "http://127.0.0.1:18789";
        (req as any).__proxyTarget = `http://${customDomain.instance.tailscaleIp}:18789`;
        (req as any).__isCanvasSite = true;
        return next();
      }
    }
    return next();
  }

  // ---- PUBLIC SITE ROUTE (no auth required) ----
  if (route.type === "site") {
    // Serve InstaClaw favicon for all canvas sites
    if (req.url === "/favicon.ico") {
      if (fs.existsSync(FAVICON_PATH)) {
        res.type("image/x-icon").send(fs.readFileSync(FAVICON_PATH));
      } else {
        res.status(404).end();
      }
      return;
    }

    const instance = await prisma.instance.findFirst({
      where: { instanceName: route.name, status: "active" },
      select: { id: true, tailscaleIp: true, gatewayToken: true },
    });

    if (!instance?.tailscaleIp || !instance.gatewayToken) {
      res.status(404).send("Site not found");
      return;
    }

    // Rewrite path to canvas sub-path: / → /__openclaw__/canvas/<site>/
    const originalPath = req.url || "/";
    req.url = `/__openclaw__/canvas/${route.site}${originalPath}`;

    // Authenticate to gateway with stored gateway token
    req.headers.authorization = `Bearer ${instance.gatewayToken}`;

    // Strip proxy headers + rewrite Host/Origin
    delete req.headers["x-forwarded-for"];
    delete req.headers["x-forwarded-proto"];
    delete req.headers["x-forwarded-host"];
    delete req.headers["x-forwarded-port"];
    delete req.headers["x-real-ip"];
    req.headers.host = "127.0.0.1:18789";
    req.headers.origin = "http://127.0.0.1:18789";

    (req as any).__proxyTarget = `http://${instance.tailscaleIp}:18789`;
    (req as any).__isCanvasSite = true;
    return next();
  }

  // ---- CONTROL PANEL ROUTE (auth required) ----
  const slug = route.slug;

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

// ---------------------------------------------------------------------------
// Canvas site injection — GA4 analytics, SEO meta, and "Built with" footer.
// Injected into every public canvas site HTML response.
// ---------------------------------------------------------------------------
const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID || "";

const CANVAS_HEAD_INJECT = GA_MEASUREMENT_ID
  ? `<!-- InstaClaw Analytics & SEO -->
<meta name="generator" content="InstaClaw">
<meta property="og:site_name" content="InstaClaw">
<link rel="icon" href="https://instaclaw.bot/favicon.ico">
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{cookie_flags:'SameSite=None;Secure'});
</script>`
  : `<!-- InstaClaw SEO -->
<meta name="generator" content="InstaClaw">
<meta property="og:site_name" content="InstaClaw">
<link rel="icon" href="https://instaclaw.bot/favicon.ico">`;

const CANVAS_BODY_INJECT = `
<div style="text-align:center;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#888;border-top:1px solid rgba(128,128,128,0.15);margin-top:40px">
  Built with <a href="https://instaclaw.bot?ref=canvas" target="_blank" rel="noopener" style="color:#3b82f6;text-decoration:none;font-weight:500">InstaClaw</a>
</div>`;

// ---------------------------------------------------------------------------
// Console UI customisation script — injected into the SPA HTML.
// Hides unused sidebar sections, replaces the "Update now" banner with a
// support-request flow, and removes the Cron Jobs nav item (buggy).
// ---------------------------------------------------------------------------
const CONSOLE_INJECT_SCRIPT = `
<script>
(function() {
  const HIDE_TABS = new Set([
    "overview", "cron", "instances", "nodes", "debug", "docs"
  ]);

  // Also hide the "Agent" and "Resources" section headers when all their
  // children are hidden.  "nodes" is the only visible child of neither
  // section, but we keep agents/skills visible so only Resources disappears.

  function hideNavItems(root) {
    // Nav items: <a class="nav-item ..."> with inner <span class="nav-item__text">
    root.querySelectorAll('.nav-item').forEach(function(el) {
      var text = el.querySelector('.nav-item__text');
      if (!text) return;
      var label = text.textContent.trim().toLowerCase().replace(/\\s+/g, '');
      // "cron jobs" → "cronjobs"
      var tab = label === 'cronjobs' ? 'cron' : label;
      if (HIDE_TABS.has(tab)) {
        el.style.display = 'none';
      }
    });

    // Hide empty nav-group headers (the "Resources" label when Docs is hidden)
    root.querySelectorAll('.nav-group').forEach(function(g) {
      var visible = Array.from(g.querySelectorAll('.nav-item')).filter(
        function(i) { return i.style.display !== 'none'; }
      );
      // nav-group contains a label + items; if no items visible, hide group
      if (visible.length === 0) {
        g.style.display = 'none';
      }
    });
  }

  function interceptUpdateBanner(root) {
    var banner = root.querySelector('.update-banner');
    if (!banner || banner.dataset.intercepted) return;
    banner.dataset.intercepted = 'true';

    var btn = banner.querySelector('.update-banner__btn');
    if (!btn) return;

    // Replace click behaviour
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Collect context
      var slug = location.hostname.split('.')[0];
      var version = banner.textContent || '';
      var match = version.match(/v([\\d.]+)/g) || [];

      var payload = {
        subject: 'Update request from console panel',
        message: 'A user clicked Update Now on their console panel.',
        _controlPanel: location.origin + '/',
        _currentVersion: match[1] || 'unknown',
        _availableVersion: match[0] || 'unknown',
        _slug: slug
      };

      btn.textContent = 'Requesting...';
      btn.disabled = true;

      fetch('https://formspree.io/f/mgolzwzg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function(r) {
        if (r.ok) {
          banner.innerHTML =
            '<span style="color:#4ade80">\\u2714 Update request submitted. We\\'ll take care of it shortly.</span>';
        } else {
          btn.textContent = 'Update now';
          btn.disabled = false;
          alert('Failed to submit request. Please try again.');
        }
      }).catch(function() {
        btn.textContent = 'Update now';
        btn.disabled = false;
        alert('Network error. Please try again.');
      });
    }, true); // capture phase to beat the SPA handler
  }

  // Poll for Lit renderRoot (not shadowRoot — Lit exposes the shadow root
  // via renderRoot, and element.shadowRoot may return null in some builds).
  var attempts = 0;
  var done = false;
  var poll = setInterval(function() {
    try {
      var app = document.querySelector('openclaw-app');
      if (!app) return;
      var root = app.renderRoot || app.shadowRoot;
      if (!root || !root.querySelectorAll) return;
      var items = root.querySelectorAll('.nav-item');
      if (items.length > 0) {
        hideNavItems(root);
        interceptUpdateBanner(root);
        if (!done) {
          console.log('[instaclaw] customisations applied (' + items.length + ' nav items)');
          done = true;
        }
      }
    } catch (err) {
      console.warn('[instaclaw]', err);
    }
    if (++attempts > 150) clearInterval(poll);
  }, 200);
})();
</script>`;

// Create the proxy middleware instance (HTTP only — WebSocket upgrades
// are handled separately via handleConsoleUpgrade in index.ts)
const consoleProxy = createProxyMiddleware({
  router: (req) => (req as any).__proxyTarget,
  changeOrigin: false,
  ws: false,
  selfHandleResponse: true,
  pathRewrite: undefined,
  on: {
    proxyRes: responseInterceptor(async (buffer, proxyRes, req, res) => {
      const contentType = proxyRes.headers["content-type"] || "";
      if (contentType.includes("text/html")) {
        // Relax CSP to allow our inline script
        const csp = proxyRes.headers["content-security-policy"];
        if (csp) {
          (res as http.ServerResponse).setHeader(
            "content-security-policy",
            (csp as string).replace(
              "script-src 'self'",
              "script-src 'self' 'unsafe-inline'"
            )
          );
        }

        let html = buffer.toString("utf-8");

        if ((req as any).__isCanvasSite) {
          // Canvas site: inject analytics + SEO in head, "Built with" footer before </body>
          html = html.replace("</head>", CANVAS_HEAD_INJECT + "\n</head>");
          html = html.replace("</body>", CANVAS_BODY_INJECT + "\n</body>");
        } else {
          // Console UI: inject customisation script
          html = html.replace("</head>", CONSOLE_INJECT_SCRIPT + "</head>");
        }

        return html;
      }
      return buffer;
    }),
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

// --- Favicon (no auth — serves for reports + canvas sites) ---
app.get("/favicon.ico", (_req, res) => {
  if (fs.existsSync(FAVICON_PATH)) {
    res.type("image/x-icon").send(fs.readFileSync(FAVICON_PATH));
  } else {
    res.status(404).end();
  }
});

// --- Public reports route (no auth) ---
const REPORTS_DIR = path.join(__dirname, "..", "reports");
app.get("/reports/:slug", (req, res) => {
  const slug = req.params.slug.replace(/[^a-z0-9-]/gi, "");
  const file = path.join(REPORTS_DIR, `${slug}.html`);
  if (!fs.existsSync(file)) {
    res.status(404).send("Report not found");
    return;
  }
  res.type("html").send(fs.readFileSync(file, "utf-8"));
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
    // ?ct= is our signed console token (proxy reads it for access control)
    // #token= is the OpenClaw gateway token (SPA reads it from hash for WebSocket auth)
    // NOTE: v2026.3.13+ reads token from URL hash, not query string
    const gwToken = (instance as any).gatewayToken || "";
    const consoleUrl = `https://${slug}.instaclaw.bot/?ct=${consoleToken}#token=${gwToken}`;

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
    const job = await configureTelegramQueue.add("configure-telegram", {
      instanceId,
      token,
    });
    res.json({ jobId: job.id, queue: "configure-telegram" });
  } catch (error) {
    console.error("Failed to enqueue configure-telegram:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// Configure Workspace
app.post("/jobs/configure-workspace", async (req, res) => {
  try {
    const { instanceId } = req.body;
    const job = await configureWorkspaceQueue.add("configure-workspace", {
      instanceId,
    });
    res.json({ jobId: job.id, queue: "configure-workspace" });
  } catch (error) {
    console.error("Failed to enqueue configure-workspace:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// Suspend
app.post("/jobs/suspend", async (req, res) => {
  try {
    const { instanceId } = req.body;
    const job = await suspendQueue.add("suspend", { instanceId });
    res.json({ jobId: job.id, queue: "suspend" });
  } catch (error) {
    console.error("Failed to enqueue suspend:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// Unsuspend
app.post("/jobs/unsuspend", async (req, res) => {
  try {
    const { instanceId } = req.body;
    const job = await unsuspendQueue.add("unsuspend", { instanceId });
    res.json({ jobId: job.id, queue: "unsuspend" });
  } catch (error) {
    console.error("Failed to enqueue unsuspend:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// Terminate
app.post("/jobs/terminate", async (req, res) => {
  try {
    const { instanceId } = req.body;
    const job = await terminateQueue.add("terminate", { instanceId });
    res.json({ jobId: job.id, queue: "terminate" });
  } catch (error) {
    console.error("Failed to enqueue terminate:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// Allocate from pool (fast path)
app.post("/jobs/allocate", async (req, res) => {
  try {
    const { instanceId, userId } = req.body;
    const job = await poolAllocateQueue.add("pool-allocate", { instanceId, userId });
    res.json({ jobId: job.id, queue: "pool-allocate" });
  } catch (error) {
    console.error("Failed to enqueue allocate:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// Update plan (OpenRouter key limit + model config)
app.post("/jobs/update-plan", async (req, res) => {
  try {
    const { instanceId, newPlan } = req.body;
    const job = await updatePlanQueue.add("update-plan", {
      instanceId,
      newPlan,
    });
    res.json({ jobId: job.id, queue: "update-plan" });
  } catch (error) {
    console.error("Failed to enqueue update-plan:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// Model audit (manual trigger)
app.post("/jobs/model-audit", async (req, res) => {
  try {
    const job = await auditQueue.add("model-audit", {}, {
      jobId: `model-audit-manual-${Date.now()}`,
    });
    res.json({ jobId: job.id, queue: "audit" });
  } catch (error) {
    console.error("Failed to enqueue model-audit:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// Update instance name (re-deploy skill files)
app.post("/jobs/update-instance-name", async (req, res) => {
  try {
    const { instanceId } = req.body;
    const job = await updateInstanceNameQueue.add("update-instance-name", { instanceId });
    res.json({ jobId: job.id, queue: "update-instance-name" });
  } catch (error) {
    console.error("Failed to enqueue update-instance-name:", error);
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

// List public sites for an instance (with metadata scraped from HTML)
app.get("/instances/:instanceId/sites", async (req, res) => {
  try {
    const { instanceId } = req.params;
    const instance = await prisma.instance.findUnique({
      where: { id: instanceId },
      select: { tailscaleIp: true, status: true },
    });

    if (!instance || instance.status !== "active" || !instance.tailscaleIp) {
      res.json({ sites: [] });
      return;
    }

    const { connectSSH, execSSH } = await import("./lib/ssh");
    const ssh = await connectSSH(instance.tailscaleIp);
    try {
      const output = await execSSH(
        ssh,
        "ls /opt/openclaw/home/.openclaw/canvas/ 2>/dev/null || true"
      );
      const siteNames = output
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s && s !== ".trash");

      // Scrape title + description from each site's index.html
      const sites = await Promise.all(
        siteNames.map(async (name) => {
          let title = "";
          let description = "";
          let screenshot = "";
          try {
            const head = await execSSH(
              ssh,
              `head -50 /opt/openclaw/home/.openclaw/canvas/${name}/index.html 2>/dev/null || true`
            );
            const titleMatch = head.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) title = titleMatch[1].trim();
            const descMatch = head.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
              || head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
            if (descMatch) description = descMatch[1].trim();
            // Check for screenshot
            const hasScreenshot = await execSSH(
              ssh,
              `test -f /opt/openclaw/home/.openclaw/canvas/${name}/.screenshot.png && echo yes || echo no`
            );
            if (hasScreenshot.trim() === "yes") {
              screenshot = `/__openclaw__/canvas/${name}/.screenshot.png`;
            }
          } catch {
            // Non-blocking — site still appears without metadata
          }
          return { name, title, description, screenshot };
        })
      );

      res.json({ sites });
    } finally {
      ssh.dispose();
    }
  } catch (error) {
    console.error("Failed to list sites:", error);
    res.json({ sites: [] });
  }
});

// Soft-delete a public site (mv to .trash/)
app.delete("/instances/:instanceId/sites/:siteName", async (req, res) => {
  try {
    const { instanceId, siteName } = req.params;

    // Validate site name (prevent path traversal)
    if (!siteName || /[\/\.\s]/.test(siteName)) {
      res.status(400).json({ error: "Invalid site name" });
      return;
    }

    const instance = await prisma.instance.findUnique({
      where: { id: instanceId },
      select: { tailscaleIp: true, status: true },
    });

    if (!instance || instance.status !== "active" || !instance.tailscaleIp) {
      res.status(404).json({ error: "Instance not found or inactive" });
      return;
    }

    const { connectSSH, execSSH } = await import("./lib/ssh");
    const ssh = await connectSSH(instance.tailscaleIp);
    try {
      const canvasBase = "/opt/openclaw/home/.openclaw/canvas";
      // Check site exists
      const exists = await execSSH(
        ssh,
        `test -d ${canvasBase}/${siteName} && echo yes || echo no`
      );
      if (exists.trim() !== "yes") {
        res.status(404).json({ error: "Site not found" });
        return;
      }
      // Move to .trash/ with timestamp to avoid collisions
      const ts = Date.now();
      await execSSH(
        ssh,
        `mkdir -p ${canvasBase}/.trash && mv ${canvasBase}/${siteName} ${canvasBase}/.trash/${siteName}.${ts}`
      );
      res.json({ success: true });
    } finally {
      ssh.dispose();
    }
  } catch (error) {
    console.error("Failed to delete site:", error);
    res.status(500).json({ error: "Failed to delete site" });
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
  const route = parseSubdomain(req.headers.host);
  if (!route) {
    socket.destroy();
    return;
  }

  // ---- PUBLIC SITE WEBSOCKET (for canvas live reload) ----
  if (route.type === "site") {
    const instance = await prisma.instance.findFirst({
      where: { instanceName: route.name, status: "active" },
      select: { id: true, tailscaleIp: true, gatewayToken: true },
    });

    if (!instance?.tailscaleIp || !instance.gatewayToken) {
      socket.destroy();
      return;
    }

    // Rewrite path to canvas sub-path
    const originalUrl = req.url || "/";
    req.url = `/__openclaw__/canvas/${route.site}${originalUrl}`;
    req.headers.authorization = `Bearer ${instance.gatewayToken}`;

    delete req.headers["x-forwarded-for"];
    delete req.headers["x-forwarded-proto"];
    delete req.headers["x-forwarded-host"];
    delete req.headers["x-forwarded-port"];
    delete req.headers["x-real-ip"];
    req.headers.host = "127.0.0.1:18789";
    req.headers.origin = "http://127.0.0.1:18789";

    wsProxy.ws(req, socket, head, {
      target: `http://${instance.tailscaleIp}:18789`,
    });
    return;
  }

  // ---- CONTROL PANEL WEBSOCKET (auth required) ----
  const slug = route.slug;

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
