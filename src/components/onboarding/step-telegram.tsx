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
import { Loader2, ExternalLink, CheckCircle } from "lucide-react";

interface StepTelegramProps {
  onComplete: () => void;
}

export function StepTelegram({ onComplete }: StepTelegramProps) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tokenRegex = /^\d{8,10}:[A-Za-z0-9_-]{35}$/;
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

      onComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Your Telegram Bot</CardTitle>
        <CardDescription>
          Follow these steps to create your bot and get a token.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Instructions */}
        <div className="rounded-lg bg-gray-50 p-4">
          <h3 className="mb-3 font-semibold text-gray-900">
            Step-by-step instructions:
          </h3>
          <ol className="space-y-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-medium text-violet-600">
                1
              </span>
              <span>
                Open Telegram and search for{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-violet-600 hover:underline"
                >
                  @BotFather
                  <ExternalLink className="ml-1 inline h-3 w-3" />
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-medium text-violet-600">
                2
              </span>
              <span>
                Send <code className="rounded bg-gray-200 px-1">/newbot</code>{" "}
                to BotFather
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-medium text-violet-600">
                3
              </span>
              <span>
                Choose a name for your bot (e.g., &quot;My AI Assistant&quot;)
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-medium text-violet-600">
                4
              </span>
              <span>
                Choose a username ending in &quot;bot&quot; (e.g.,
                &quot;myai_helper_bot&quot;)
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-medium text-violet-600">
                5
              </span>
              <span>
                BotFather will give you a token -- copy it and paste it below
              </span>
            </li>
          </ol>
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
              <p className="text-sm text-red-500">
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
