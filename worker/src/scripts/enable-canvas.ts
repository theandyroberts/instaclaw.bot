import { connectSSH, execSSH } from "../lib/ssh";
import { prisma } from "../lib/prisma";

/**
 * One-time patch: create the canvas directory on all active instances
 * so the OpenClaw canvas host can serve public sites.
 *
 * Canvas is served at /__openclaw__/canvas/ on the gateway (port 18789).
 * The root directory is /home/node/.openclaw/canvas/ inside the container,
 * which maps to /opt/openclaw/home/.openclaw/canvas/ on the host.
 */
async function main() {
  const instances = await prisma.instance.findMany({
    where: { status: "active", tailscaleIp: { not: null } },
    select: { id: true, tailscaleIp: true, instanceName: true },
  });

  console.log(`Found ${instances.length} active instance(s)\n`);

  for (const inst of instances) {
    const tag = `[canvas:${inst.id.slice(0, 8)}]`;
    console.log(`${tag} Connecting to ${inst.tailscaleIp}...`);
    const ssh = await connectSSH(inst.tailscaleIp!);
    try {
      // Create canvas directory
      await execSSH(ssh, "mkdir -p /opt/openclaw/home/.openclaw/canvas", "/");
      console.log(`${tag} Canvas directory created`);

      // Verify via curl
      try {
        const result = await execSSH(
          ssh,
          "curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:18789/__openclaw__/canvas/ 2>/dev/null || echo 'failed'"
        );
        console.log(`${tag} Canvas endpoint: HTTP ${result.trim()}`);
      } catch {
        console.log(`${tag} Canvas endpoint check failed (gateway may need restart)`);
      }

      console.log(`${tag} instanceName: ${inst.instanceName || "(not set)"}`);
      console.log(`${tag} DONE\n`);
    } finally {
      ssh.dispose();
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
