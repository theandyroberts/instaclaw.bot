/**
 * STANDALONE patch script — adds Chromium to all active customer instances.
 * Self-contained: inlines the Dockerfile + docker-compose changes so you
 * don't need to update any other source files on the worker droplet.
 *
 * Usage (from /opt/instaclaw/worker):
 *   npx tsx src/scripts/patch-chromium-standalone.ts
 */

import { prisma } from "../lib/prisma";
import { connectSSH, execSSH, writeFileSSH } from "../lib/ssh";

// --- Inlined: the new Dockerfile content ---
const DOCKERFILE = `FROM alpine/openclaw:latest
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \\
    chromium \\
    chromium-driver \\
    fonts-freefont-ttf \\
    && rm -rf /var/lib/apt/lists/*
USER node
`;

// --- Inlined: docker-compose patch logic ---
function patchComposeContent(existingCompose: string): string {
  let patched = existingCompose;

  // Swap "image: alpine/openclaw:latest" → "build: ."
  patched = patched.replace(
    /image:\s*alpine\/openclaw:latest/,
    "build: ."
  );

  // Add shm_size after "build: ." if not already present
  if (!patched.includes("shm_size:")) {
    patched = patched.replace(
      /build:\s*\./,
      'build: .\n    shm_size: "256m"'
    );
  }

  // Add Chrome env vars if not already present
  if (!patched.includes("CHROME_BIN")) {
    // Find the last environment variable line and append after it
    const envVars = [
      "      - CHROME_BIN=/usr/bin/chromium",
      '      - CHROMIUM_FLAGS=--no-sandbox --headless=new --disable-gpu --disable-dev-shm-usage',
      "      - PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium",
      "      - SELENIUM_BROWSER_PATH=/usr/bin/chromium",
    ].join("\n");

    // Insert before "    ports:" line
    patched = patched.replace(
      /(\n\s+ports:)/,
      `\n${envVars}$1`
    );
  }

  return patched;
}

async function patchInstance(instance: {
  id: string;
  tailscaleIp: string;
}) {
  const tag = `[patch:${instance.id.slice(0, 8)}]`;
  console.log(`${tag} Connecting to ${instance.tailscaleIp}...`);

  const ssh = await connectSSH(instance.tailscaleIp);

  try {
    // 1. Write the Dockerfile
    console.log(`${tag} Writing Dockerfile...`);
    await writeFileSSH(ssh, "/opt/openclaw/Dockerfile", DOCKERFILE);

    // 2. Read + patch the existing docker-compose.yml (preserves all existing env vars/tokens)
    console.log(`${tag} Patching docker-compose.yml...`);
    const currentCompose = await execSSH(ssh, "cat /opt/openclaw/docker-compose.yml");

    if (currentCompose.includes("build:") && currentCompose.includes("CHROME_BIN")) {
      console.log(`${tag} docker-compose.yml already patched — skipping rewrite`);
    } else {
      const patched = patchComposeContent(currentCompose);
      await writeFileSSH(ssh, "/opt/openclaw/docker-compose.yml", patched);
    }

    // 3. Stop existing container
    console.log(`${tag} Stopping container...`);
    await execSSH(ssh, "docker compose down", "/opt/openclaw");

    // 4. Build new image with Chromium
    console.log(`${tag} Building image (this takes ~1-2 min)...`);
    await execSSH(ssh, "docker compose build --pull", "/opt/openclaw");

    // 5. Start it back up
    console.log(`${tag} Starting container...`);
    await execSSH(ssh, "docker compose up -d", "/opt/openclaw");

    // 6. Verify
    await new Promise((r) => setTimeout(r, 5000));
    const status = await execSSH(
      ssh,
      'docker compose ps openclaw-gateway --format "{{.State}}"',
      "/opt/openclaw"
    );
    console.log(`${tag} Container state: ${status.trim()}`);

    // 7. Sanity check chromium
    const chromiumVersion = await execSSH(
      ssh,
      "docker compose exec -T openclaw-gateway chromium --version 2>/dev/null || echo 'not found'",
      "/opt/openclaw"
    );
    console.log(`${tag} Chromium: ${chromiumVersion.trim()}`);

    console.log(`${tag} DONE`);
    return true;
  } catch (err) {
    console.error(`${tag} FAILED:`, err instanceof Error ? err.message : err);
    return false;
  } finally {
    ssh.dispose();
  }
}

async function main() {
  console.log("=== Chromium Patch Script (Standalone) ===\n");

  const instances = await prisma.instance.findMany({
    where: {
      status: "active",
      tailscaleIp: { not: null },
    },
    select: {
      id: true,
      tailscaleIp: true,
      userId: true,
      user: { select: { email: true, name: true } },
    },
  });

  if (instances.length === 0) {
    console.log("No active instances found. Nothing to patch.");
    process.exit(0);
  }

  console.log(`Found ${instances.length} active instance(s) to patch:\n`);
  for (const inst of instances) {
    console.log(`  - ${inst.id.slice(0, 8)}  ${inst.user?.email || "?"}  @ ${inst.tailscaleIp}`);
  }
  console.log();

  const results: { id: string; success: boolean }[] = [];

  for (const inst of instances) {
    const success = await patchInstance({
      id: inst.id,
      tailscaleIp: inst.tailscaleIp!,
    });
    results.push({ id: inst.id, success });
    console.log();
  }

  // Summary
  console.log("=== Summary ===");
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`  Patched: ${succeeded}/${results.length}`);
  if (failed > 0) {
    console.log(`  Failed:  ${failed}`);
    for (const r of results.filter((r) => !r.success)) {
      console.log(`    - ${r.id}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
