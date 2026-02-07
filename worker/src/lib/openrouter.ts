const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const API_BASE = "https://openrouter.ai/api/v1";

async function orFetch(path: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
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
  id: string;
  key: string;
  name: string;
  limit: number;
}

export async function createAPIKey(
  name: string,
  budgetLimit: number = 15
): Promise<OpenRouterKey> {
  // OpenRouter API key provisioning
  // Note: OpenRouter's actual API for key management may differ;
  // this is a placeholder that should be adapted to their current API
  const data = await orFetch("/keys", {
    method: "POST",
    body: JSON.stringify({
      name,
      limit: budgetLimit,
      period: "month",
    }),
  });

  return {
    id: data.id,
    key: data.key,
    name: data.name,
    limit: data.limit,
  };
}

export async function deleteAPIKey(keyId: string): Promise<void> {
  await orFetch(`/keys/${keyId}`, { method: "DELETE" });
}

export async function getKeyUsage(keyId: string): Promise<{ used: number; limit: number }> {
  const data = await orFetch(`/keys/${keyId}/usage`);
  return { used: data.used, limit: data.limit };
}
