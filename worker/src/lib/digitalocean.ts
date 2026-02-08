const DO_TOKEN = process.env.DIGITALOCEAN_TOKEN!;
const DO_SSH_KEY_ID = process.env.DO_SSH_KEY_ID!;
const API_BASE = "https://api.digitalocean.com/v2";

async function doFetch(path: string, options?: RequestInit): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DO_TOKEN}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DigitalOcean API error ${response.status}: ${body}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export interface DropletInfo {
  id: number;
  name: string;
  status: string;
  networks: {
    v4: Array<{ ip_address: string; type: string }>;
  };
}

export async function createDroplet(
  name: string,
  userData: string
): Promise<DropletInfo> {
  const data = await doFetch("/droplets", {
    method: "POST",
    body: JSON.stringify({
      name,
      region: "nyc1",
      size: "s-1vcpu-2gb",
      image: "docker-24-04",
      ssh_keys: [DO_SSH_KEY_ID],
      backups: false,
      ipv6: false,
      user_data: userData,
      tags: ["instaclaw", "customer"],
    }),
  });

  return data.droplet;
}

export async function getDroplet(dropletId: number): Promise<DropletInfo> {
  const data = await doFetch(`/droplets/${dropletId}`);
  return data.droplet;
}

export async function deleteDroplet(dropletId: number): Promise<void> {
  await doFetch(`/droplets/${dropletId}`, { method: "DELETE" });
}

export async function waitForDropletActive(
  dropletId: number,
  maxAttempts = 60
): Promise<DropletInfo> {
  for (let i = 0; i < maxAttempts; i++) {
    const droplet = await getDroplet(dropletId);
    if (droplet.status === "active") {
      return droplet;
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  throw new Error(`Droplet ${dropletId} did not become active within timeout`);
}

export function getDropletPublicIP(droplet: DropletInfo): string {
  const network = droplet.networks.v4.find((n) => n.type === "public");
  if (!network) {
    throw new Error("No public IPv4 address found on droplet");
  }
  return network.ip_address;
}

export async function createSnapshot(
  dropletId: number,
  name: string
): Promise<void> {
  await doFetch(`/droplets/${dropletId}/actions`, {
    method: "POST",
    body: JSON.stringify({
      type: "snapshot",
      name,
    }),
  });
}

export async function powerOffDroplet(dropletId: number): Promise<void> {
  await doFetch(`/droplets/${dropletId}/actions`, {
    method: "POST",
    body: JSON.stringify({ type: "power_off" }),
  });
}

export async function powerOnDroplet(dropletId: number): Promise<void> {
  await doFetch(`/droplets/${dropletId}/actions`, {
    method: "POST",
    body: JSON.stringify({ type: "power_on" }),
  });
}
