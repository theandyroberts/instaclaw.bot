"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";

export function ConsoleButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openConsole() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/instance/console", { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      const { consoleUrl } = await res.json();
      window.open(consoleUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open console");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button onClick={openConsole} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Opening...
          </>
        ) : (
          <>
            Open Control Panel
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
