"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, Lock } from "lucide-react";

interface InstanceNameFormProps {
  currentName: string | null;
}

const NAME_RE = /^[a-z0-9]{3,20}$/;

export function InstanceNameForm({ currentName }: InstanceNameFormProps) {
  const [name, setName] = useState(currentName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [locked, setLocked] = useState(!!currentName);

  const isValid = NAME_RE.test(name);
  const isChanged = name !== (currentName || "");

  async function handleSave() {
    if (!isValid || !isChanged || locked) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/instance/name", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      setSaved(true);
      setLocked(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (locked) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2 items-center">
          <Input
            value={name}
            disabled
            className="font-mono opacity-70"
          />
          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground">
          Your sites are at{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            &lt;site&gt;-{name}.instaclaw.bot
          </code>
        </p>
        <p className="text-xs text-muted-foreground">
          Subdomain is locked after first choice. Contact{" "}
          <a href="mailto:andy@sparkpoint.studio?subject=Change InstaClaw.bot subdomain" className="text-primary hover:underline">
            support
          </a>{" "}
          to change it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""));
            setError(null);
            setSaved(false);
          }}
          placeholder="e.g. bigbadbot"
          maxLength={20}
          className="font-mono"
        />
        <Button
          onClick={handleSave}
          disabled={!isValid || !isChanged || saving}
          size="sm"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : (
            "Save"
          )}
        </Button>
      </div>
      {name && !isValid && (
        <p className="text-xs text-amber-500">
          3-20 lowercase letters and numbers only
        </p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {isValid && (
        <p className="text-xs text-muted-foreground">
          Your sites will be at{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            &lt;site&gt;-{name}.instaclaw.bot
          </code>
        </p>
      )}
      <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 space-y-1.5">
        <p className="text-xs font-medium text-amber-500">
          Choose carefully -- this cannot be changed later.
        </p>
        <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
          <li>Keep it short -- it appears in every site URL</li>
          <li>Use your brand, business name, or bot name</li>
          <li>Make it something people can say out loud or type from memory</li>
          <li>Avoid random numbers -- <span className="font-mono">acme</span> reads better than <span className="font-mono">acme2024</span></li>
        </ul>
      </div>
    </div>
  );
}
