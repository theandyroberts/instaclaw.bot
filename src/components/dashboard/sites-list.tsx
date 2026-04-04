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
    site.screenshot ? `${siteUrl(site.name)}/.screenshot.png` : "";

  return (
    <div className="space-y-2">
      <div className="divide-y divide-border">
        {sites.map((site) => (
          <div key={site.name} className="group flex gap-4 py-4 first:pt-0">
            {/* Thumbnail — small, on the left */}
            <a
              href={siteUrl(site.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0"
            >
              {site.screenshot ? (
                <div className="h-20 w-32 overflow-hidden rounded-md border border-border transition-all group-hover:border-primary/40 group-hover:shadow-md">
                  <img
                    src={screenshotUrl(site)}
                    alt={site.title || site.name}
                    className="h-full w-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="flex h-20 w-32 items-center justify-center rounded-md border border-border bg-gradient-to-br from-gray-800 to-gray-900">
                  <Globe className="h-5 w-5 text-gray-600" />
                </div>
              )}
            </a>

            {/* Text — drives the layout */}
            <div className="min-w-0 flex-1">
              <a
                href={siteUrl(site.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <h4 className="text-lg font-bold leading-tight group-hover:text-primary">
                  {site.title || site.name}
                </h4>
                {site.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-400 leading-relaxed">
                    {site.description}
                  </p>
                )}
              </a>
              <div className="mt-2 flex items-center gap-3">
                <a
                  href={siteUrl(site.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Go to site <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-xs text-gray-600 font-mono">{site.name}</span>
                <button
                  onClick={() => handleDelete(site.name)}
                  disabled={deleting === site.name}
                  className={`rounded p-0.5 transition-colors ${
                    confirmDelete === site.name
                      ? "text-red-500"
                      : "text-gray-500 opacity-0 group-hover:opacity-100 hover:text-red-400"
                  }`}
                  title={confirmDelete === site.name ? "Click again to confirm" : "Delete"}
                >
                  {deleting === site.name ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
                {confirmDelete === site.name && (
                  <span className="text-[10px] text-red-500">Click again to confirm</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
