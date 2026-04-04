const WORKER_URL = process.env.WORKER_API_URL!;
const WORKER_SECRET = process.env.WORKER_SHARED_SECRET!;

interface WorkerJobResponse {
  jobId: string;
  queue: string;
}

async function callWorker(endpoint: string, data: Record<string, unknown>): Promise<WorkerJobResponse> {
  const response = await fetch(`${WORKER_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WORKER_SECRET}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Worker API error: ${response.status} ${error}`);
  }

  return response.json();
}

export async function enqueueProvision(instanceId: string, userId: string) {
  return callWorker("/jobs/provision", { instanceId, userId });
}

export async function enqueueAllocate(instanceId: string, userId: string) {
  return callWorker("/jobs/allocate", { instanceId, userId });
}

export async function enqueueTelegramConfig(instanceId: string, token: string) {
  return callWorker("/jobs/configure-telegram", { instanceId, token });
}

export async function enqueueWorkspaceConfig(instanceId: string) {
  return callWorker("/jobs/configure-workspace", { instanceId });
}

export async function enqueueSuspend(instanceId: string) {
  return callWorker("/jobs/suspend", { instanceId });
}

export async function enqueueUnsuspend(instanceId: string) {
  return callWorker("/jobs/unsuspend", { instanceId });
}

export async function enqueueTerminate(instanceId: string) {
  return callWorker("/jobs/terminate", { instanceId });
}

export async function enqueueUpdatePlan(instanceId: string, newPlan: string) {
  return callWorker("/jobs/update-plan", { instanceId, newPlan });
}

export async function enqueueNameUpdate(instanceId: string) {
  return callWorker("/jobs/update-instance-name", { instanceId });
}

export interface SiteInfo {
  name: string;
  title: string;
  description: string;
  screenshot: string;
}

export async function listSites(instanceId: string): Promise<SiteInfo[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${WORKER_URL}/instances/${instanceId}/sites`, {
      headers: {
        Authorization: `Bearer ${WORKER_SECRET}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) return [];
    const data = await response.json();
    const sites = data.sites || [];
    // Handle both old format (string[]) and new format (SiteInfo[])
    return sites.map((s: string | SiteInfo) =>
      typeof s === "string" ? { name: s, title: "", description: "", screenshot: "" } : s
    );
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function deleteSite(instanceId: string, siteName: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${WORKER_URL}/instances/${instanceId}/sites/${encodeURIComponent(siteName)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${WORKER_SECRET}`,
      },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getConsoleUrl(
  instanceId: string,
  userId: string
): Promise<{ consoleUrl: string; token: string; expiresAt: number }> {
  const response = await fetch(`${WORKER_URL}/console/${instanceId}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WORKER_SECRET}`,
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Worker API error: ${response.status} ${error}`);
  }

  return response.json();
}
