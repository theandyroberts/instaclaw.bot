"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PartyPopper, ExternalLink, MessageCircle } from "lucide-react";
import Link from "next/link";

interface StepCelebrationProps {
  botUsername: string;
}

function getTelegramUrl(botUsername: string): string {
  if (typeof navigator === "undefined") return `https://t.me/${botUsername}`;

  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);

  if (isMobile) {
    return `https://t.me/${botUsername}`;
  }

  // Desktop: open Telegram web client directly
  return `https://web.telegram.org/k/#@${botUsername}`;
}

export function StepCelebration({ botUsername }: StepCelebrationProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-12 text-center">
        <PartyPopper className="mb-4 h-16 w-16 text-red-400" />
        <h2 className="mb-2 text-2xl font-bold text-gray-100">
          Your AI Assistant is Ready!
        </h2>
        <p className="mb-8 max-w-md text-gray-400">
          Everything is set up and live. Open Telegram and send your first
          message to start a conversation with your personal AI.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          {botUsername && (
            <Button size="lg" asChild>
              <a
                href={getTelegramUrl(botUsername)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Send Your First Message
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
          <Button size="lg" variant="outline" asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
