const OPENROUTER_MANAGEMENT_KEY = process.env.OPENROUTER_MANAGEMENT_KEY!;
const API_BASE = "https://openrouter.ai/api/v1";

/** Monthly spend limits per plan (USD) */
export const PLAN_BUDGETS: Record<string, number> = {
  starter: 5,
  pro: 30,
};

async function orFetch(path: string, options?: RequestInit): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_MANAGEMENT_KEY}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${body}`);
  }

  return response.json();
}

export interface OpenRouterKey {
  hash: string;
  key: string;
  name: string;
  limit: number;
}

export async function createAPIKey(
  name: string,
  budgetLimit: number = 5
): Promise<OpenRouterKey> {
  const result = await orFetch("/keys", {
    method: "POST",
    body: JSON.stringify({
      name,
      limit: budgetLimit,
      limit_reset: "monthly",
    }),
  });

  return {
    hash: result.data.hash,
    key: result.key,
    name: result.data.name,
    limit: result.data.limit,
  };
}

export async function deleteAPIKey(hash: string): Promise<void> {
  await orFetch(`/keys/${hash}`, { method: "DELETE" });
}

export async function updateAPIKeyLimit(
  hash: string,
  limitUSD: number
): Promise<void> {
  await orFetch(`/keys/${hash}`, {
    method: "PATCH",
    body: JSON.stringify({ limit: limitUSD }),
  });
}

export async function getKeyUsage(hash: string): Promise<{
  usage: number;
  usage_monthly: number;
  limit: number | null;
  limit_remaining: number | null;
}> {
  const result = await orFetch(`/keys/${hash}`);
  return {
    usage: result.data.usage,
    usage_monthly: result.data.usage_monthly,
    limit: result.data.limit,
    limit_remaining: result.data.limit_remaining,
  };
}

export interface ActivityItem {
  date: string;
  model: string;
  provider_name: string;
  cost: number;
  num_requests: number;
  tokens_prompt: number;
  tokens_completion: number;
  tokens_reasoning: number;
}

export async function getActivity(date: string): Promise<ActivityItem[]> {
  const result = await orFetch(`/activity?date=${date}`);
  return result.data || [];
}
