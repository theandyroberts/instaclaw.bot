"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Globe, ExternalLink } from "lucide-react";

interface CustomDomain {
  id: string;
  domain: string;
  siteSlug: string;
  status: string;
  createdAt: string;
}

interface CustomDomainsFormProps {
  instanceId: string;
  initialDomains: CustomDomain[];
}

const statusColors: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  pending: "secondary",
  error: "destructive",
};

export function CustomDomainsForm({ instanceId, initialDomains }: CustomDomainsFormProps) {
  const [domains, setDomains] = useState<CustomDomain[]>(initialDomains);
  const [sites, setSites] = useState<string[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [selectedSite, setSelectedSite] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/instance/sites")
      .then((r) => r.json())
      .then((data) => {
        const siteList = (data.sites || []).filter((s: string) => s !== "index.html");
        setSites(siteList);
        if (siteList.length > 0 && !selectedSite) {
          setSelectedSite(siteList[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSites(false));
  }, []);

  const handleAdd = async () => {
    if (!newDomain || !selectedSite) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/instance/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.toLowerCase().trim(), siteSlug: selectedSite }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const record = await res.json();
      setDomains((prev) => [record, ...prev]);
      setNewDomain("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add domain");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (domain: string) => {
    setDeleting(domain);
    try {
      const res = await fetch("/api/instance/domains", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      if (res.ok) {
        setDomains((prev) => prev.filter((d) => d.domain !== domain));
      }
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Existing domains */}
      {domains.length > 0 && (
        <div className="space-y-2">
          {domains.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono truncate">{d.domain}</code>
                    <Badge variant={statusColors[d.status] || "secondary"} className="text-[10px]">
                      {d.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    Serves: {d.siteSlug}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(d.domain)}
                disabled={deleting === d.domain}
              >
                {deleting === d.domain ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new domain */}
      {loadingSites ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sites...
        </div>
      ) : sites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No published sites yet. Ask your bot to create a website first.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {sites.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <Input
              value={newDomain}
              onChange={(e) => {
                setNewDomain(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ""));
                setError(null);
              }}
              placeholder="www.mydomain.com"
              className="font-mono flex-1"
            />
            <Button onClick={handleAdd} disabled={!newDomain || !selectedSite || saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* DNS instructions */}
          <div className="rounded-md bg-muted/50 border border-border p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">DNS Setup Instructions</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Go to your domain registrar&apos;s DNS settings</li>
              <li>
                Add a <strong>CNAME</strong> record pointing your domain to{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                  worker.instaclaw.bot
                </code>
              </li>
              <li>Save and wait for DNS propagation (usually under 30 minutes)</li>
              <li>SSL is provisioned automatically on the first visit</li>
            </ol>
            <p className="text-[11px] text-muted-foreground">
              For root domains (no www), use an A record pointing to{" "}
              <code className="font-mono">157.245.83.185</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
