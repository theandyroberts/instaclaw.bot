"use client";

import type { ReactNode } from "react";

interface StepTransitionProps {
  stepKey: string;
  direction: "forward" | "back";
  children: ReactNode;
}

export function StepTransition({ stepKey, direction, children }: StepTransitionProps) {
  const animationName =
    direction === "forward" ? "slide-in-from-right" : "slide-in-from-left";

  return (
    <div
      key={stepKey}
      style={{
        animation: `${animationName} 0.3s ease-out both`,
      }}
    >
      {children}
    </div>
  );
}
