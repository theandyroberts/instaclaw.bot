import { NodeSSH } from "node-ssh";
import * as fs from "fs";

const SSH_KEY_PATH = process.env.SSH_PRIVATE_KEY_PATH || "/root/.ssh/id_rsa";

export async function connectSSH(ipAddress: string): Promise<NodeSSH> {
  const ssh = new NodeSSH();

  // Retry SSH connection (droplet may not be ready immediately)
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await ssh.connect({
        host: ipAddress,
        username: "root",
        privateKeyPath: SSH_KEY_PATH,
        readyTimeout: 10000,
      });
      return ssh;
    } catch {
      if (attempt === 29) {
        throw new Error(`Failed to SSH into ${ipAddress} after 30 attempts`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  throw new Error("Unreachable");
}

export async function execSSH(
  ssh: NodeSSH,
  command: string,
  cwd = "/opt/openclaw"
): Promise<string> {
  const result = await ssh.execCommand(command, { cwd });
  if (result.code !== 0 && result.code !== null) {
    throw new Error(
      `SSH command failed (code ${result.code}): ${result.stderr || result.stdout}`
    );
  }
  return result.stdout;
}

export async function writeFileSSH(
  ssh: NodeSSH,
  remotePath: string,
  content: string
): Promise<void> {
  // Write via stdin to avoid quoting issues
  const tmpFile = `/tmp/instaclaw-${Date.now()}`;
  await ssh.execCommand(`cat > ${remotePath}`, {
    stdin: content,
  });
}

export async function waitForSSH(ipAddress: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const ssh = new NodeSSH();
      await ssh.connect({
        host: ipAddress,
        username: "root",
        privateKeyPath: SSH_KEY_PATH,
        readyTimeout: 5000,
      });
      ssh.dispose();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
  throw new Error(`SSH not available on ${ipAddress} after ${maxAttempts} attempts`);
}
