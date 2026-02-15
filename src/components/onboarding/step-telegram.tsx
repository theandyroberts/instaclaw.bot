"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ExternalLink, CheckCircle, PlayCircle, ChevronDown, ChevronUp } from "lucide-react";

interface StepTelegramProps {
  onComplete: () => void;
  botName?: string;
}

export function StepTelegram({ onComplete, botName }: StepTelegramProps) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [showTutorial, setShowTutorial] = useState(false);

  const tokenRegex = /^\d{8,10}:[A-Za-z0-9_-]{34,}$/;
  const isValidFormat = tokenRegex.test(token);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidFormat) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/instance/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to configure Telegram bot");
      }

      setConnecting(true);
      onComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      setLoading(false);
    }
  };

  if (connecting) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
          <h2 className="mb-2 text-xl font-semibold text-gray-100">{botName ? `Connecting ${botName}...` : "Connecting your bot..."}</h2>
          <p className="text-gray-500">Configuring Telegram integration. Almost there!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{botName ? `Connect ${botName} to Telegram` : "Create Your Telegram Bot"}</CardTitle>
        <CardDescription>
          {botName
            ? `Create a Telegram bot for ${botName} and paste the token below.`
            : "Follow these steps to create your bot and get a token."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Video tutorial toggle */}
        <button
          type="button"
          onClick={() => setShowTutorial(!showTutorial)}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-neutral-900/50 px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-neutral-800"
        >
          <PlayCircle className="h-5 w-5 text-primary" />
          {showTutorial ? "Hide tutorial" : "Watch how to do this"}
          {showTutorial ? (
            <ChevronUp className="ml-auto h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="ml-auto h-4 w-4 text-gray-500" />
          )}
        </button>

        {showTutorial && (
          <div className="aspect-video rounded-lg border border-border bg-neutral-900 flex items-center justify-center">
            {/* When video exists: <video src="/tutorial/botfather-guide.mp4" controls className="w-full rounded-lg" /> */}
            <div className="text-center text-gray-500">
              <PlayCircle className="mx-auto mb-2 h-12 w-12" />
              <p className="text-sm">Tutorial video coming soon</p>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="rounded-lg bg-card p-4">
          <h3 className="mb-3 font-semibold text-gray-100">
            Step-by-step instructions:
          </h3>
          <ol className="space-y-3 text-sm text-gray-300">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                1
              </span>
              <span>
                Open Telegram and search for{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  @BotFather
                  <ExternalLink className="ml-1 inline h-3 w-3" />
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                2
              </span>
              <span>
                Send <code className="rounded bg-neutral-800 px-1">/newbot</code>{" "}
                to BotFather
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                3
              </span>
              <span>
                Choose a name for your bot{botName ? <> (e.g., &quot;{botName}&quot;)</> : <> (e.g., &quot;My AI Assistant&quot;)</>}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                4
              </span>
              <span>
                Choose a username ending in &quot;bot&quot; (e.g.,
                &quot;myai_helper_bot&quot;)
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                5
              </span>
              <span>
                BotFather will give you a token -- copy it and paste it below
              </span>
            </li>
          </ol>
        </div>

        {/* Token tip callout */}
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-3">
          <p className="text-sm text-amber-200">
            <strong>Tip:</strong> After creating your bot, the token appears in the middle of BotFather&apos;s
            response -- scroll UP in the chat to find it. It looks like: <code className="rounded bg-amber-950/50 px-1">1234567890:ABC...</code>
          </p>
        </div>

        {/* Token input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="token">Bot Token</Label>
            <Input
              id="token"
              type="text"
              placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ1234567890a"
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
              className="font-mono text-sm"
            />
            {token && !isValidFormat && (
              <p className="text-sm text-primary">
                Token format looks incorrect. It should look like:
                1234567890:ABCdefGHIjklMNOpqrSTUvwx...
              </p>
            )}
            {token && isValidFormat && (
              <p className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-3 w-3" />
                Token format looks good
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!isValidFormat || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying token...
              </>
            ) : (
              "Connect Telegram Bot"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
