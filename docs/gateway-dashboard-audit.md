# OpenClaw Gateway Dashboard Audit

## What is the Gateway Dashboard?

The OpenClaw Gateway Dashboard (branded "OpenClaw Control") is a built-in web UI that ships with every OpenClaw instance. It's a Lit-based single-page application served by the gateway on port 18789. It communicates with the gateway entirely over WebSocket using a JSON-RPC-like protocol.

In the InstaClaw.bot setup, each customer's dashboard is accessible at `https://<slug>.instaclaw.bot/` — proxied through our worker with signed-token authentication.

---

## What Works Out of the Box

### Chat
The core feature. Direct gateway chat session — you can type messages, see tool calls, and interact with the agent in real time. Supports session switching (Main Session dropdown) and creating new sessions.

### Channels
Shows connected messaging channels (Telegram, WhatsApp). Displays connection status, bot username, and polling state. You can see that Telegram is configured and running. WhatsApp pairing (QR code flow) is also available here.

### Sessions
Lists active sessions with metadata: model being used, token counts, chat type (Telegram, control-ui), and origin. Useful for seeing who's talking to the bot and how much they've used.

### Usage
Token usage and cost breakdown by day. Shows which models were called, how many tokens were consumed, and estimated cost. Useful for monitoring spend on Pro plan instances.

### Agents
Shows configured agents (typically one: "main"). The Files tab displays the workspace .md files (AGENTS.md, SOUL.md, USER.md, MEMORY.md, etc.) with file sizes and last-modified dates. You can view file contents directly. The Overview, Tools, Skills, and Config tabs provide additional agent configuration details.

### Skills
Full catalog of available skills — both bundled (built into OpenClaw) and managed (installed via skill packs). Shows which skills are eligible, disabled, or missing requirements. Useful for understanding what the agent can do.

### Config
Raw view of `openclaw.json` — the main configuration file. Shows model settings, plugin config, gateway token, skill configuration, and all runtime options. Can be edited directly (though changes require a gateway restart to take effect).

### Logs
Live tail of the gateway log file. Shows real-time events: incoming messages, tool calls, model requests, errors. Essential for debugging agent behavior.

---

## What Doesn't Work (or Is Irrelevant)

### Overview
Displays gateway connection info (WebSocket URL, token, status). In our proxied setup, this information is misleading — customers connect through our proxy, not directly to the gateway. The connection details shown here don't match what users actually use.

### Instances
Designed for multi-instance/multi-node OpenClaw deployments. Returns an empty response in our single-instance-per-customer architecture. No API method exists for this — the UI just shows a blank page.

### Nodes
For cluster/multi-device deployments where multiple devices connect to the same gateway. Returns an empty list in our setup since each customer has exactly one node. Not useful.

### Cron Jobs
The API works (lists configured jobs, run history), but clicking this nav item in the UI causes the entire dashboard to lock up — no other navigation or input works after visiting this page. Likely a rendering bug in this version of the SPA. Note: cron job information is also visible through the Agents section, so nothing is lost by hiding this.

### Debug
No dedicated API methods. Renders a raw RPC call interface — you can manually type WebSocket method names and parameters. A developer tool, not useful for customers.

### Docs
Links to external OpenClaw documentation. Not relevant to InstaClaw.bot customers who have their own support channels.

### Update Banner
When a newer version of OpenClaw is available, a banner appears: "Update available: v2026.3.13 (running v2026.3.8). Update now." Clicking "Update now" calls `update.run` via WebSocket, which returns `"skipped"` with reason `"not-git-install"` — because our instances run OpenClaw in Docker containers, not from a git checkout. The update mechanism simply cannot work in a containerized deployment. Updates must be orchestrated externally via SSH (Docker image rebuild + restart).

---

## What InstaClaw.bot Changed

### Cleaned Up the Sidebar
We inject a customisation script into the dashboard HTML via our proxy's `responseInterceptor`. This hides the six non-functional or problematic sidebar items (Overview, Cron Jobs, Instances, Nodes, Debug, Docs) and collapses empty section headers (the "Resources" group disappears when Docs is hidden). The result is a focused sidebar with only the sections that actually work: Chat, Channels, Sessions, Usage, Agents, Skills, Config, and Logs.

### Replaced the Update Button
Instead of hiding the broken "Update now" banner, we intercept the click. When a customer clicks "Update now":

1. The button text changes to "Requesting..."
2. A support request is submitted via Formspree with the instance's console panel URL, current version, and available version
3. The banner replaces with a green confirmation: "Update request submitted. We'll take care of it shortly."
4. The InstaClaw.bot admin receives the request and can perform the Docker-based update manually (rebuild image, pull new version, restart container)

This turns a broken button into a genuine support workflow — customers feel heard, and we maintain control over when and how updates roll out.

### How It Works (Technical)
The proxy uses `http-proxy-middleware`'s `responseInterceptor` to modify the gateway's HTML response before it reaches the browser. For `text/html` responses:

1. The Content-Security-Policy header is relaxed to allow inline scripts (`script-src 'self' 'unsafe-inline'`)
2. A `<script>` block is injected before `</head>`
3. The script polls for the Lit component's `renderRoot` (the shadow DOM boundary) and applies DOM modifications once the SPA has rendered

All other responses (JS, CSS, WebSocket, API calls) pass through unmodified. The customisations are purely cosmetic — no gateway functionality is altered.
