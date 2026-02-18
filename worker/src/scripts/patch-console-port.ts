/**
 * STANDALONE patch script — fixes port mapping and saves gateway tokens for all active instances.
 *
 * For each active instance:
 * 1. Fix docker-compose port mapping (8080:8080 -> 18789:18789)
 * 2. Extract OPENCLAW_GATEWAY_TOKEN from existing docker-compose.yml
 * 3. Save the gateway token to the database
 * 4. Restart the container with docker compose up -d
 *
 * Usage (from /opt/instaclaw/worker):
 *   npx tsx src/scripts/patch-console-port.ts
 */

import { prisma } from "../lib/prisma";
import { connectSSH, execSSH, writeFileSSH } from "../lib/ssh";

async function patchInstance(instance: {
  id: string;
  tailscaleIp: string;
}): Promise<boolean> {
  const tag = `[patch:${instance.id.slice(0, 8)}]`;
  console.log(`${tag} Connecting to ${instance.tailscaleIp}...`);

  const ssh = await connectSSH(instance.tailscaleIp);

  try {
    // 1. Read existing docker-compose.yml
    console.log(`${tag} Reading docker-compose.yml...`);
    const compose = await execSSH(ssh, "cat /opt/openclaw/docker-compose.yml");

    // 2. Extract gateway token
    const tokenMatch = compose.match(/OPENCLAW_GATEWAY_TOKEN=([^\s\n]+)/);
    const gatewayToken = tokenMatch ? tokenMatch[1] : null;

    if (!gatewayToken) {
      console.log(`${tag} WARNING: Could not extract gateway token`);
    } else {
      console.log(`${tag} Gateway token: ${gatewayToken.slice(0, 8)}...`);
    }

    // 3. Fix port mapping if needed
    if (compose.includes("8080:8080")) {
      console.log(`${tag} Fixing port mapping 8080 -> 18789...`);
      const patched = compose.replace(
        /127\.0\.0\.1:8080:8080/g,
        "127.0.0.1:18789:18789"
      );
      await writeFileSSH(ssh, "/opt/openclaw/docker-compose.yml", patched);
    } else if (compose.includes("18789:18789")) {
      console.log(`${tag} Port mapping already correct (18789)`);
    } else {
      console.log(`${tag} WARNING: Unexpected port mapping in compose file`);
    }

    // 4. Save gateway token to database
    if (gatewayToken) {
      await prisma.instance.update({
        where: { id: instance.id },
        data: { gatewayToken },
      });
      console.log(`${tag} Saved gateway token to database`);
    }

    // 5. Restart container
    console.log(`${tag} Restarting container...`);
    await execSSH(ssh, "docker compose up -d", "/opt/openclaw");

    // 6. Verify
    await new Promise((r) => setTimeout(r, 5000));
    const status = await execSSH(
      ssh,
      'docker compose ps openclaw-gateway --format "{{.State}}"',
      "/opt/openclaw"
    );
    console.log(`${tag} Container state: ${status.trim()}`);

    // 7. Quick check: can we reach the web UI on 18789?
    try {
      const curlResult = await execSSH(
        ssh,
        "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18789/ --connect-timeout 5"
      );
      console.log(`${tag} Web UI HTTP status: ${curlResult.trim()}`);
    } catch {
      console.log(`${tag} Web UI not responding yet (may need more startup time)`);
    }

    console.log(`${tag} DONE`);
    return true;
  } catch (err) {
    console.error(`${tag} FAILED:`, err instanceof Error ? err.message : err);
    return false;
  } finally {
    ssh.dispose();
  }
}

async function patchPoolDroplets() {
  console.log("\n=== Patching Pool Droplets ===\n");

  const poolDroplets = await prisma.poolDroplet.findMany({
    where: {
      status: { in: ["ready", "allocated"] },
      tailscaleIp: { not: null },
    },
    select: {
      id: true,
      tailscaleIp: true,
      status: true,
    },
  });

  if (poolDroplets.length === 0) {
    console.log("No pool droplets to patch.");
    return 0;
  }

  console.log(`Found ${poolDroplets.length} pool droplet(s) to patch:\n`);
  let failed = 0;

  for (const pd of poolDroplets) {
    const tag = `[pool:${pd.id.slice(0, 8)}]`;
    console.log(`${tag} Connecting to ${pd.tailscaleIp}...`);
    const ssh = await connectSSH(pd.tailscaleIp!);

    try {
      const compose = await execSSH(ssh, "cat /opt/openclaw/docker-compose.yml");

      // Extract and save token
      const tokenMatch = compose.match(/OPENCLAW_GATEWAY_TOKEN=([^\s\n]+)/);
      if (tokenMatch) {
        await prisma.poolDroplet.update({
          where: { id: pd.id },
          data: { gatewayToken: tokenMatch[1] },
        });
        console.log(`${tag} Saved gateway token`);
      }

      // Fix port mapping
      if (compose.includes("8080:8080")) {
        const patched = compose.replace(
          /127\.0\.0\.1:8080:8080/g,
          "127.0.0.1:18789:18789"
        );
        await writeFileSSH(ssh, "/opt/openclaw/docker-compose.yml", patched);
        console.log(`${tag} Fixed port mapping`);

        // Only restart allocated (running) pool droplets
        if (pd.status === "allocated") {
          await execSSH(ssh, "docker compose up -d", "/opt/openclaw");
          console.log(`${tag} Restarted container`);
        }
      }

      console.log(`${tag} DONE`);
    } catch (err) {
      console.error(`${tag} FAILED:`, err instanceof Error ? err.message : err);
      failed++;
    } finally {
      ssh.dispose();
    }
  }

  return failed;
}

async function main() {
  console.log("=== Console Port Patch Script ===\n");

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
    console.log("No active instances found.");
  } else {
    console.log(`Found ${instances.length} active instance(s) to patch:\n`);
    for (const inst of instances) {
      console.log(
        `  - ${inst.id.slice(0, 8)}  ${inst.user?.email || "?"}  @ ${inst.tailscaleIp}`
      );
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
    console.log("=== Instance Summary ===");
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    console.log(`  Patched: ${succeeded}/${results.length}`);
    if (failed > 0) {
      console.log(`  Failed:  ${failed}`);
      for (const r of results.filter((r) => !r.success)) {
        console.log(`    - ${r.id}`);
      }
    }
  }

  // Also patch pool droplets
  const poolFailed = await patchPoolDroplets();

  const totalFailed =
    (instances.length > 0
      ? instances.length -
        instances.filter(() => true).length +
        0
      : 0) + poolFailed;

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
