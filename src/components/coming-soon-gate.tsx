"use client";

import { useState, useEffect } from "react";

const PASSPHRASE = "Toulouse-Lautrec";
const STORAGE_KEY = "instaclaw-gate-passed";

export function ComingSoonGate({ children }: { children: React.ReactNode }) {
  const [passed, setPassed] = useState(true); // default true to avoid flash
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    setPassed(stored === "true");
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() === PASSPHRASE) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      setPassed(true);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  if (passed) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-4xl font-bold">
          <span className="text-white">Insta</span>
          <span className="text-primary">Claw</span>
        </h1>
        <div className="mb-8 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary">
          Coming Soon
        </div>
        <p className="mb-2 text-lg text-gray-300">
          We&apos;re putting the finishing touches on your AI assistant platform.
        </p>
        <p className="mb-10 text-gray-500">
          Have the passphrase? Enter it below for early access.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter passphrase..."
            className={`flex-1 rounded-md border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${shake ? "animate-[shake_0.3s_ease-in-out]" : ""}`}
            autoFocus
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
