"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Smile,
  Briefcase,
  Sparkles,
  PenLine,
  Bot,
  User,
  Zap,
  FileText,
  CheckCircle2,
  Circle,
} from "lucide-react";

interface BotConfig {
  botName: string;
  personality: string;
  customPersonality?: string;
  userName: string;
  userDescription?: string;
  timezone?: string;
  jobTitle?: string;
  useCases: string[];
  extraContext?: string;
}

interface LogEntry {
  step: string;
  message: string;
  ts: string;
}

interface StepProvisionProps {
  message?: string;
  submessage?: string;
  botConfig?: BotConfig | null;
  onComplete?: () => void;
}

const personalityLabels: Record<string, { label: string; icon: typeof Smile }> = {
  friendly: { label: "Friendly & Casual", icon: Smile },
  professional: { label: "Professional & Concise", icon: Briefcase },
  witty: { label: "Witty & Creative", icon: Sparkles },
  custom: { label: "Custom", icon: PenLine },
};

// The expected steps in order -- used to show upcoming steps as dimmed
const expectedSteps = [
  { step: "started", message: "Allocating your server" },
  { step: "droplet_created", message: "Server reserved" },
  { step: "droplet_active", message: "Server online" },
  { step: "cloud_init", message: "System ready" },
  { step: "docker_ready", message: "Docker ready" },
  { step: "pulling_images", message: "System image ready" },
  { step: "workspace_setup", message: "Personalizing your bot" },
  { step: "container_started", message: "Starting your bot" },
  { step: "base_complete", message: "Setup complete" },
];

export function StepProvision({
  message = "Setting up your server...",
  submessage = "We\u2019re configuring your dedicated server. This usually takes less than a minute.",
  botConfig,
  onComplete,
}: StepProvisionProps) {
  const [elapsed, setElapsed] = useState(0);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  // Poll for provision log + detect completion
  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch("/api/instance/status");
      if (!res.ok) return;
      const data = await res.json();
      if (data?.provisionLog && Array.isArray(data.provisionLog)) {
        setLogEntries(data.provisionLog);
      }
      // Auto-advance when provisioning completes
      if (data?.onboardingStep && !["awaiting_provision", "provisioning"].includes(data.onboardingStep)) {
        onComplete?.();
      }
    } catch {
      // Ignore
    }
  }, [onComplete]);

  useEffect(() => {
    fetchLog();
    const interval = setInterval(fetchLog, 3000);
    return () => clearInterval(interval);
  }, [fetchLog]);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine which steps are completed
  const completedSteps = new Set(logEntries.map((e) => e.step));
  const lastCompletedIndex = expectedSteps.reduce(
    (max, s, i) => (completedSteps.has(s.step) ? i : max),
    -1
  );

  const personality = botConfig?.personality
    ? personalityLabels[botConfig.personality] || { label: botConfig.personality, icon: Sparkles }
    : null;
  const PersonalityIcon = personality?.icon || Sparkles;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center py-10 text-center">
          <div className="mb-6 w-full max-w-md">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full w-1/3 rounded-full bg-red-500"
                style={{ animation: "indeterminate 2.5s ease-in-out infinite" }}
              />
            </div>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-100">{message}</h2>
          <p className="max-w-md text-gray-500">{submessage}</p>
        </CardContent>
      </Card>

      {/* Live provision log */}
      <Card>
        <CardContent className="py-6">
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
            Setup progress
          </h3>
          <div className="space-y-2.5">
            {expectedSteps.map((s, i) => {
              const isCompleted = completedSteps.has(s.step);
              const isActive = i === lastCompletedIndex + 1 && lastCompletedIndex >= 0;
              const isFuture = i > lastCompletedIndex + 1;
              // Use the actual log message if available, otherwise the expected message
              const logEntry = logEntries.find((e) => e.step === s.step);
              const displayMessage = logEntry?.message || s.message;

              return (
                <div
                  key={s.step}
                  className={`flex items-center gap-3 transition-opacity ${
                    isFuture ? "opacity-30" : "opacity-100"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-neutral-700" />
                  )}
                  <span
                    className={`text-sm ${
                      isCompleted
                        ? "text-gray-300"
                        : isActive
                          ? "text-gray-100 font-medium"
                          : "text-gray-600"
                    }`}
                  >
                    {displayMessage}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Reassurance after 60 seconds */}
      {elapsed >= 120 && (
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Your server is being set up in the background.
            You can safely close this page and come back anytime.
          </p>
        </div>
      )}

      {/* Bot summary */}
      {botConfig && (botConfig.botName || botConfig.personality) && (
        <Card>
          <CardContent className="py-6">
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
              Your bot at a glance
            </h3>
            <div className="space-y-3">
              {botConfig.botName && (
                <div className="flex items-center gap-3">
                  <Bot className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-gray-400">Name</span>
                  <span className="ml-auto text-sm font-medium text-gray-100">
                    {botConfig.botName}
                  </span>
                </div>
              )}
              {personality && (
                <div className="flex items-center gap-3">
                  <PersonalityIcon className="h-4 w-4 shrink-0 text-primary" />
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
                  <User className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-gray-400">Owner</span>
                  <span className="ml-auto text-sm font-medium text-gray-100">
                    {botConfig.userName}
                  </span>
                </div>
              )}
              {botConfig.useCases.length > 0 && (
                <div className="flex items-start gap-3">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-gray-400">Use cases</span>
                  <span className="ml-auto text-right text-sm font-medium text-gray-100">
                    {botConfig.useCases.join(", ")}
                  </span>
                </div>
              )}
              {botConfig.extraContext && (
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
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
