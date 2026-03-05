"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Loader2, ExternalLink, CheckCircle, X, Play } from "lucide-react";

interface StepTelegramProps {
  onComplete: () => void;
  botName?: string;
}

export function StepTelegram({ onComplete, botName }: StepTelegramProps) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [showVideo, setShowVideo] = useState(false);

  // Close modal on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setShowVideo(false);
  }, []);

  useEffect(() => {
    if (showVideo) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }
  }, [showVideo, handleKeyDown]);

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
        {/* Video tutorial thumbnail */}
        <button
          type="button"
          onClick={() => setShowVideo(true)}
          className="group relative w-full overflow-hidden rounded-lg border border-border"
          style={{ aspectRatio: "4/3" }}
        >
          {/* Dark screen background */}
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900" />

          {/* Screen text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-gray-500">
              Video tutorial
            </span>
            <span className="text-center text-lg font-bold tracking-wide text-gray-100 sm:text-xl">
              HOW TO SET UP TELEGRAM
            </span>

            {/* Play button */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 shadow-lg shadow-primary/20 transition-transform group-hover:scale-110">
              <Play className="h-7 w-7 text-white" style={{ marginLeft: 3 }} />
            </div>

            <span className="text-sm text-gray-500">1 min watch</span>
          </div>
        </button>

        {/* Video modal */}
        {showVideo && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowVideo(false); }}
          >
            <div className="relative w-full max-w-3xl px-4">
              {/* Close button */}
              <button
                type="button"
                onClick={() => setShowVideo(false)}
                className="absolute -top-12 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <X className="h-6 w-6" />
              </button>

              <div className="overflow-hidden rounded-lg bg-black">
                <video
                  src="https://assets.instaclaw.bot/tutorial/botfather-guide.mp4"
                  controls
                  autoPlay
                  playsInline
                  className="w-full"
                />
              </div>
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
                Choose a username ending in &quot;bot&quot;{botName ? <> (e.g., <code className="rounded bg-neutral-800 px-1">{botName}_bot</code>)</> : <> (e.g., &quot;myai_helper_bot&quot;)</>}
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
