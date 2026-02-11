"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Server,
  Smile,
  Briefcase,
  Sparkles,
  PenLine,
  Bot,
  User,
  Zap,
  FileText,
} from "lucide-react";

interface BotConfig {
  botName: string;
  personality: string;
  customPersonality?: string;
  userName: string;
  userDescription?: string;
  useCases: string[];
  extraContext?: string;
}

interface StepProvisionProps {
  message?: string;
  submessage?: string;
  botConfig?: BotConfig | null;
}

const personalityLabels: Record<string, { label: string; icon: typeof Smile }> = {
  friendly: { label: "Friendly & Casual", icon: Smile },
  professional: { label: "Professional & Concise", icon: Briefcase },
  witty: { label: "Witty & Creative", icon: Sparkles },
  custom: { label: "Custom", icon: PenLine },
};

export function StepProvision({
  message = "Setting up your server...",
  submessage = "We\u2019re provisioning a dedicated server for your AI assistant. This usually takes 3\u20135 minutes.",
  botConfig,
}: StepProvisionProps) {
  const personality = botConfig?.personality
    ? personalityLabels[botConfig.personality] || { label: botConfig.personality, icon: Sparkles }
    : null;
  const PersonalityIcon = personality?.icon || Sparkles;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="relative mb-6">
            <Server className="h-16 w-16 text-red-400" />
            <Loader2 className="absolute -bottom-1 -right-1 h-6 w-6 animate-spin text-red-500" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-100">{message}</h2>
          <p className="max-w-md text-gray-500">{submessage}</p>
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Please keep this page open
          </div>
        </CardContent>
      </Card>

      {botConfig && (botConfig.botName || botConfig.personality) && (
        <Card>
          <CardContent className="py-6">
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
              Your bot at a glance
            </h3>
            <div className="space-y-3">
              {botConfig.botName && (
                <div className="flex items-center gap-3">
                  <Bot className="h-4 w-4 shrink-0 text-red-400" />
                  <span className="text-sm text-gray-400">Name</span>
                  <span className="ml-auto text-sm font-medium text-gray-100">
                    {botConfig.botName}
                  </span>
                </div>
              )}
              {personality && (
                <div className="flex items-center gap-3">
                  <PersonalityIcon className="h-4 w-4 shrink-0 text-red-400" />
                  <span className="text-sm text-gray-400">Personality</span>
                  <span className="ml-auto text-sm font-medium text-gray-100">
                    {botConfig.personality === "custom"
                      ? botConfig.customPersonality || "Custom"
                      : personality.label}
                  </span>
                </div>
              )}
              {botConfig.userName && (
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 shrink-0 text-red-400" />
                  <span className="text-sm text-gray-400">Owner</span>
                  <span className="ml-auto text-sm font-medium text-gray-100">
                    {botConfig.userName}
                  </span>
                </div>
              )}
              {botConfig.useCases.length > 0 && (
                <div className="flex items-start gap-3">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <span className="text-sm text-gray-400">Use cases</span>
                  <span className="ml-auto text-right text-sm font-medium text-gray-100">
                    {botConfig.useCases.join(", ")}
                  </span>
                </div>
              )}
              {botConfig.extraContext && (
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-red-400" />
                  <span className="text-sm text-gray-400">Custom instructions</span>
                  <span className="ml-auto text-sm font-medium text-green-400">
                    Included
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
