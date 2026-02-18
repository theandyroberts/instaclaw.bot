const DO_TOKEN = process.env.DIGITALOCEAN_TOKEN!;
const API_BASE = "https://api.digitalocean.com/v2";

const FIREWALL_NAME = "instaclaw-fleet";

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

export async function ensureFirewall(): Promise<string> {
  // Check if firewall already exists
  const data = await doFetch("/firewalls");
  const existing = data.firewalls?.find(
    (fw: any) => fw.name === FIREWALL_NAME
  );

  if (existing) {
    return existing.id;
  }

  // Create firewall with Tailscale-only access
  const result = await doFetch("/firewalls", {
    method: "POST",
    body: JSON.stringify({
      name: FIREWALL_NAME,
      inbound_rules: [
        {
          protocol: "udp",
          ports: "41641",
          sources: { addresses: ["0.0.0.0/0", "::/0"] },
        },
        {
          protocol: "icmp",
          ports: "0",
          sources: { addresses: ["0.0.0.0/0", "::/0"] },
        },
      ],
      outbound_rules: [
        {
          protocol: "tcp",
          ports: "all",
          destinations: { addresses: ["0.0.0.0/0", "::/0"] },
        },
        {
          protocol: "udp",
          ports: "all",
          destinations: { addresses: ["0.0.0.0/0", "::/0"] },
        },
        {
          protocol: "icmp",
          ports: "0",
          destinations: { addresses: ["0.0.0.0/0", "::/0"] },
        },
      ],
      tags: ["instaclaw"],
    }),
  });

  console.log(`[firewall] Created DO cloud firewall: ${result.firewall.id}`);
  return result.firewall.id;
}
