"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Server } from "lucide-react";

interface StepProvisionProps {
  message?: string;
  submessage?: string;
}

export function StepProvision({
  message = "Setting up your server...",
  submessage = "We're provisioning a dedicated server for your AI assistant. This usually takes 3-5 minutes.",
}: StepProvisionProps) {
  return (
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
  );
}
