"use client";

import { useState } from "react";
import { ExternalLink, Trash2, Loader2, Globe } from "lucide-react";
import type { SiteInfo } from "@/lib/worker-client";

export function SitesList({
  initialSites,
  instanceName,
}: {
  initialSites: SiteInfo[];
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
        setSites((prev) => prev.filter((s) => s.name !== siteName));
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

  const siteUrl = (name: string) => `https://${name}-${instanceName}.instaclaw.bot`;
  const screenshotUrl = (site: SiteInfo) =>
    site.screenshot ? `${siteUrl(site.name)}/.screenshot.jpg` : "";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {sites.map((site) => (
          <div key={site.name}>
            <a
              href={siteUrl(site.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="group block overflow-hidden rounded-lg border border-border transition-all hover:border-primary/40 hover:shadow-md"
            >
              {/* Screenshot or placeholder */}
              {site.screenshot ? (
                <div className="aspect-[16/9] w-full overflow-hidden bg-gray-900">
                  <img
                    src={screenshotUrl(site)}
                    alt={site.title || site.name}
                    className="h-full w-full object-cover object-top transition-transform group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <Globe className="h-8 w-8 text-gray-600" />
                </div>
              )}

              {/* Content */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-semibold group-hover:text-primary">
                      {site.title || site.name}
                    </h4>
                    {site.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">
                        {site.description}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-gray-500">{site.name}</p>
                    )}
                  </div>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-500 group-hover:text-primary" />
                </div>
              </div>
            </a>

            {/* Delete button below card */}
            <div className="mt-1 flex items-center justify-end gap-1">
              <span className="text-[10px] text-gray-500 font-mono">{site.name}</span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete(site.name);
                }}
                disabled={deleting === site.name}
                className={`rounded p-1 transition-colors ${
                  confirmDelete === site.name
                    ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                }`}
                title={confirmDelete === site.name ? "Click again to confirm" : "Delete site"}
              >
                {deleting === site.name ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </button>
            </div>
            {confirmDelete === site.name && (
              <p className="mt-0.5 text-[10px] text-red-500 text-right">
                Click trash again to confirm. Recoverable for 30 days.
              </p>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
