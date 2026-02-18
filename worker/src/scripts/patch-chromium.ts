/**
 * One-time patch script: adds Chromium to all active instances.
 *
 * Connects to each active instance via Tailscale SSH, writes the new
 * Dockerfile (extending alpine/openclaw with Chromium), rebuilds the
 * image, and restarts the container.
 *
 * Usage:
 *   npx tsx src/scripts/patch-chromium.ts
 *
 * Requires the same env vars as the worker (DATABASE_URL, SSH_PRIVATE_KEY_PATH).
 */

import { prisma } from "../lib/prisma";
import { connectSSH, execSSH, writeFileSSH } from "../lib/ssh";
import { generateDockerfile, generateDockerCompose } from "../lib/openclaw-config";

async function patchInstance(instance: {
  id: string;
  tailscaleIp: string;
  userId: string;
}) {
  const tag = `[patch:${instance.id.slice(0, 8)}]`;
  console.log(`${tag} Connecting to ${instance.tailscaleIp}...`);

  const ssh = await connectSSH(instance.tailscaleIp);

  try {
    // 1. Write the new Dockerfile
    console.log(`${tag} Writing Dockerfile...`);
    await writeFileSSH(ssh, "/opt/openclaw/Dockerfile", generateDockerfile());

    // 2. Read the existing docker-compose.yml to check if it already uses build
    const currentCompose = await execSSH(ssh, "cat /opt/openclaw/docker-compose.yml");
    if (currentCompose.includes("build:")) {
      console.log(`${tag} docker-compose.yml already uses build — skipping compose rewrite`);
    } else {
      // Rewrite docker-compose.yml: swap "image:" for "build:" and add Chrome env vars + shm_size.
      // We read the existing env vars from the running container to preserve tokens/keys.
      console.log(`${tag} Updating docker-compose.yml...`);
      const envJson = await execSSH(
        ssh,
        "docker compose exec -T openclaw-gateway env -0 2>/dev/null | tr '\\0' '\\n' || docker compose exec -T openclaw-gateway env",
        "/opt/openclaw"
      );

      // Extract the gateway token from existing env
      const gatewayTokenMatch = envJson.match(/OPENCLAW_GATEWAY_TOKEN=(.+)/);
      const gatewayToken = gatewayTokenMatch?.[1]?.trim() || "";

      if (!gatewayToken) {
        console.error(`${tag} Could not extract OPENCLAW_GATEWAY_TOKEN — skipping compose rewrite, will only add Dockerfile`);
      } else {
        // Extract other keys
        const extract = (key: string) => {
          const m = envJson.match(new RegExp(`${key}=(.+)`));
          return m?.[1]?.trim();
        };

        const compose = generateDockerCompose(gatewayToken, {
          openrouterApiKey: extract("OPENROUTER_API_KEY"),
          moonshotApiKey: extract("MOONSHOT_API_KEY"),
          braveApiKey: extract("BRAVE_API_KEY"),
          geminiApiKey: extract("GEMINI_API_KEY"),
        });
        await writeFileSSH(ssh, "/opt/openclaw/docker-compose.yml", compose);
      }
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

    // 7. Quick sanity check that chromium is there
    const chromiumVersion = await execSSH(
      ssh,
      "docker compose exec -T openclaw-gateway chromium-browser --version 2>/dev/null || echo 'not found'",
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
  console.log("=== Chromium Patch Script ===\n");

  // Find all active instances with a Tailscale IP
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

  // Patch sequentially to avoid overloading SSH / network
  for (const inst of instances) {
    const success = await patchInstance({
      id: inst.id,
      tailscaleIp: inst.tailscaleIp!,
      userId: inst.userId,
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
