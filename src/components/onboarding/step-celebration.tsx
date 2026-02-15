"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink, MessageCircle } from "lucide-react";
import Link from "next/link";

interface StepCelebrationProps {
  botUsername: string;
  botName?: string;
}

function getTelegramUrl(botUsername: string): string {
  if (typeof navigator === "undefined") return `https://t.me/${botUsername}`;

  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);

  if (isMobile) {
    return `https://t.me/${botUsername}`;
  }

  return `https://web.telegram.org/k/#@${botUsername}`;
}

const confettiColors = [
  "bg-red-500",
  "bg-orange-400",
  "bg-yellow-400",
  "bg-white",
  "bg-red-400",
  "bg-orange-300",
];

export function StepCelebration({ botUsername, botName }: StepCelebrationProps) {
  const confettiPieces = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 3}s`,
      duration: `${2 + Math.random() * 3}s`,
      color: confettiColors[i % confettiColors.length],
      size: Math.random() > 0.5 ? "h-2 w-2" : "h-1.5 w-3",
      rotate: Math.random() > 0.5 ? "rounded-full" : "rounded-sm",
    }));
  }, []);

  return (
    <div className="relative flex min-h-[75vh] flex-col items-center justify-center overflow-hidden text-center">
      {/* Confetti layer */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confettiPieces.map((piece) => (
          <div
            key={piece.id}
            className={`absolute ${piece.color} ${piece.size} ${piece.rotate} opacity-80`}
            style={{
              left: piece.left,
              top: "-5%",
              animation: `confetti-fall ${piece.duration} ${piece.delay} ease-in infinite`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 space-y-6 px-4">
        {/* Animated checkmark */}
        <div
          className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-500/20"
          style={{ animation: "scale-in 0.6s ease-out forwards" }}
        >
          <CheckCircle2 className="h-16 w-16 text-green-400" />
        </div>

        <h1 className="bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
          You&apos;re All Set!
        </h1>

        {botName && (
          <p className="text-lg text-gray-400">
            <span className="font-medium text-gray-200">{botName}</span> is ready to go
          </p>
        )}

        <p className="mx-auto max-w-lg text-xl text-gray-300">
          Your AI assistant is live and ready to chat on Telegram.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col justify-center gap-4 pt-4 sm:flex-row">
          {botUsername && (
            <Button size="lg" className="h-14 px-8 text-lg" asChild>
              <a
                href={getTelegramUrl(botUsername)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Open Telegram
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
          <Button size="lg" variant="outline" className="h-14 px-8 text-lg" asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
