const TAILSCALE_API_KEY = process.env.TAILSCALE_API_KEY!;
const TAILSCALE_TAILNET = process.env.TAILSCALE_TAILNET!;
const API_BASE = "https://api.tailscale.com";

interface TailscaleDevice {
  id: string;
  hostname: string;
  addresses: string[];
  connectedToControl: boolean;
}

async function tsFetch(path: string, options?: RequestInit): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TAILSCALE_API_KEY}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tailscale API error ${response.status}: ${body}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function getTailscaleDeviceByHostname(
  hostname: string
): Promise<TailscaleDevice | null> {
  const data = await tsFetch(
    `/api/v2/tailnet/${TAILSCALE_TAILNET}/devices`
  );
  const device = data.devices?.find(
    (d: TailscaleDevice) => d.hostname === hostname && d.connectedToControl
  );
  return device || null;
}

export async function waitForTailscaleDevice(
  hostname: string,
  maxAttempts = 60,
  intervalMs = 10000
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const device = await getTailscaleDeviceByHostname(hostname);
    if (device && device.addresses.length > 0) {
      // Return the 100.x.y.z Tailscale IP
      const tsIp = device.addresses.find((a) => a.startsWith("100."));
      if (tsIp) {
        return tsIp;
      }
    }
    if (i > 0 && i % 6 === 0) {
      console.log(
        `[tailscale] Still waiting for ${hostname} to join tailnet... (${(i * intervalMs) / 1000}s)`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(
    `Tailscale device ${hostname} did not appear after ${maxAttempts} attempts`
  );
}

export async function removeTailscaleDevice(deviceId: string): Promise<void> {
  await tsFetch(`/api/v2/device/${deviceId}`, { method: "DELETE" });
}
