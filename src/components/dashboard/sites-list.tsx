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
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {sites.map((site) => (
          <div key={site.name} className="group relative">
            <a
              href={siteUrl(site.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-md border border-border transition-all hover:border-primary/40 hover:shadow-md"
            >
              {/* Thumbnail */}
              {site.screenshot ? (
                <div className="aspect-[4/3] w-full overflow-hidden bg-gray-900">
                  <img
                    src={screenshotUrl(site)}
                    alt={site.title || site.name}
                    className="h-full w-full object-cover object-top transition-transform group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <Globe className="h-5 w-5 text-gray-600" />
                </div>
              )}

              {/* Label */}
              <div className="px-3 py-2">
                <h4 className="truncate text-base font-semibold group-hover:text-primary">
                  {site.title || site.name}
                </h4>
                {site.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-400">
                    {site.description}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-gray-500 font-mono">{site.name}</p>
                )}
              </div>
            </a>

            {/* Delete — top-right corner on hover */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDelete(site.name);
              }}
              disabled={deleting === site.name}
              className={`absolute right-1 top-1 rounded p-1 opacity-0 transition-all group-hover:opacity-100 ${
                confirmDelete === site.name
                  ? "bg-red-600/90 text-white opacity-100"
                  : "bg-black/60 text-gray-300 hover:bg-red-600/80 hover:text-white"
              }`}
              title={confirmDelete === site.name ? "Click again to confirm" : "Delete site"}
            >
              {deleting === site.name ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </button>
            {confirmDelete === site.name && (
              <p className="mt-0.5 text-center text-[10px] text-red-500">
                Click again to confirm
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
