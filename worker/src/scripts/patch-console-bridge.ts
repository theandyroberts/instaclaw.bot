import { connectSSH } from "../lib/ssh";
import { setupConsoleBridge } from "../lib/console-bridge";
import { prisma } from "../lib/prisma";

/**
 * One-time patch: install persistent console bridge (socat systemd service + iptables)
 * on all active instances. Replaces the ephemeral socat and tailscale serve setup.
 */
async function main() {
  const instances = await prisma.instance.findMany({
    where: { status: "active", tailscaleIp: { not: null } },
    select: { id: true, tailscaleIp: true },
  });

  for (const inst of instances) {
    const tag = `[patch:${inst.id.slice(0, 8)}]`;
    console.log(`${tag} Connecting to ${inst.tailscaleIp}...`);
    const ssh = await connectSSH(inst.tailscaleIp!);
    try {
      // Kill any ephemeral socat first
      console.log(`${tag} Cleaning up ephemeral socat...`);
      try {
        const { execSSH } = await import("../lib/ssh");
        await execSSH(ssh, "pkill -f 'socat.*18789' 2>/dev/null || true");
        // Also disable tailscale serve if still active
        await execSSH(ssh, "sudo tailscale serve reset 2>&1 || true");
      } catch {}

      console.log(`${tag} Installing persistent console bridge...`);
      await setupConsoleBridge(ssh);

      console.log(`${tag} DONE`);
    } finally {
      ssh.dispose();
    }
    console.log();
  }

  // Verify from worker
  await new Promise((r) => setTimeout(r, 3000));
  for (const inst of instances) {
    const tag = `[test:${inst.id.slice(0, 8)}]`;
    try {
      const r = await fetch(`http://${inst.tailscaleIp}:18789/`, {
        signal: AbortSignal.timeout(5000),
      });
      const body = await r.text();
      console.log(
        `${tag} HTTP ${r.status} — ${body.includes("OpenClaw") ? "OpenClaw Control loaded!" : body.slice(0, 80)}`
      );
    } catch (e) {
      console.log(`${tag} Failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
