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
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0a] px-4">
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-4xl font-bold">
          <span className="text-gray-400">Insta</span>
          <span className="text-red-500">Claw</span>
        </h1>
        <div className="mb-8 inline-flex items-center rounded-full border border-red-600/30 bg-red-950/20 px-4 py-1.5 text-sm text-red-400">
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
            className={`flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 ${shake ? "animate-[shake_0.3s_ease-in-out]" : ""}`}
            autoFocus
          />
          <button
            type="submit"
            className="rounded-md bg-red-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
