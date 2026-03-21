"use client";

import { useState } from "react";
import { ExternalLink, Trash2, Loader2 } from "lucide-react";

export function SitesList({
  initialSites,
  instanceName,
}: {
  initialSites: string[];
  instanceName: string;
}) {
  const [sites, setSites] = useState(initialSites);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(siteName: string) {
    if (confirmDelete !== siteName) {
      setConfirmDelete(siteName);
      setError(null);
      return;
    }

    setDeleting(siteName);
    setConfirmDelete(null);
    setError(null);
    try {
      const res = await fetch("/api/instance/sites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteName }),
      });
      if (res.ok) {
        setSites((prev) => prev.filter((s) => s !== siteName));
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to delete site");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setDeleting(null);
    }
  }

  if (sites.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        Try asking your bot: &quot;Build me a dashboard of coffee shops in Austin&quot;
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {sites.map((site) => (
        <div key={site}>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm font-medium">{site}</span>
            <div className="flex items-center gap-2">
              <a
                href={`https://${site}-${instanceName}.instaclaw.bot`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Go to site
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                onClick={() => handleDelete(site)}
                disabled={deleting === site}
                className={`ml-1 rounded p-1 transition-colors ${
                  confirmDelete === site
                    ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                }`}
                title={confirmDelete === site ? "Click again to confirm" : "Delete site"}
              >
                {deleting === site ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
          {confirmDelete === site && (
            <p className="mt-1 text-xs text-red-500">
              Click the trash icon again to confirm deletion. The site can be recovered within 30 days.
            </p>
          )}
        </div>
      ))}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
