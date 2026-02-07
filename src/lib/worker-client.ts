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

export async function enqueueTelegramConfig(instanceId: string, token: string) {
  return callWorker("/jobs/configure-telegram", { instanceId, token });
}

export async function enqueueLLMConfig(instanceId: string, provider: string, plan: string) {
  return callWorker("/jobs/configure-llm", { instanceId, provider, plan });
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
