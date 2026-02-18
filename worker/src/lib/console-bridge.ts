import type { NodeSSH } from "node-ssh";
import { execSSH, writeFileSSH } from "./ssh";

/**
 * Write a file to a root-owned path via sudo.
 * Writes to a temp file first, then sudo-moves it.
 */
async function writeSudoFile(ssh: NodeSSH, remotePath: string, content: string): Promise<void> {
  const tmp = `/tmp/instaclaw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await writeFileSSH(ssh, tmp, content);
  await execSSH(ssh, `sudo mv ${tmp} ${remotePath}`);
}

/**
 * Set up the OpenClaw Console bridge on an instance.
 *
 * Creates two systemd services:
 * 1. openclaw-console-bridge — socat binding on the Tailscale IP, forwarding to localhost:18789
 * 2. openclaw-console-iptables — iptables ACCEPT rule for port 18789 from the Tailscale range
 *
 * This allows the worker to proxy HTTP/WebSocket traffic to the OpenClaw Control UI
 * via the Tailscale network.
 */
export async function setupConsoleBridge(ssh: NodeSSH): Promise<void> {
  // 1. Write the socat bridge systemd unit
  const socatUnit = `[Unit]
Description=OpenClaw Console Bridge (socat)
After=tailscaled.service docker.service
Wants=tailscaled.service

[Service]
Type=simple
ExecStart=/bin/bash -c 'TSIP=$$(tailscale ip -4) && exec socat TCP-LISTEN:18789,bind=$$TSIP,fork,reuseaddr TCP:127.0.0.1:18789'
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`;
  await writeSudoFile(ssh, "/etc/systemd/system/openclaw-console-bridge.service", socatUnit);

  // 2. Write the iptables rule systemd unit
  const iptablesUnit = `[Unit]
Description=Allow Tailscale access to OpenClaw console port
After=tailscaled.service

[Service]
Type=oneshot
ExecStart=/bin/bash -c '/sbin/iptables -C ts-input -s 100.64.0.0/10 -p tcp --dport 18789 -j ACCEPT 2>/dev/null || /sbin/iptables -I ts-input 3 -s 100.64.0.0/10 -p tcp --dport 18789 -j ACCEPT'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
`;
  await writeSudoFile(ssh, "/etc/systemd/system/openclaw-console-iptables.service", iptablesUnit);

  // 3. Ensure socat is installed
  await execSSH(ssh, "which socat || sudo apt-get install -y socat 2>&1");

  // 4. Enable and start both services
  await execSSH(ssh, "sudo systemctl daemon-reload");
  await execSSH(ssh, "sudo systemctl enable --now openclaw-console-iptables.service 2>&1");
  await execSSH(ssh, "sudo systemctl enable --now openclaw-console-bridge.service 2>&1");
}
