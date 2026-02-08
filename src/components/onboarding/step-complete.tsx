"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ExternalLink, MessageCircle } from "lucide-react";
import Link from "next/link";

interface StepCompleteProps {
  botUsername: string;
}

export function StepComplete({ botUsername }: StepCompleteProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-12 text-center">
        <CheckCircle className="mb-4 h-16 w-16 text-green-500" />
        <h2 className="mb-2 text-2xl font-bold text-gray-100">
          Your AI Assistant is Live!
        </h2>
        <p className="mb-6 max-w-md text-gray-500">
          Everything is set up and ready to go. Open Telegram and start chatting
          with your personal AI assistant.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Chat with @{botUsername}
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
