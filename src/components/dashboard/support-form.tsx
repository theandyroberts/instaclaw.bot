"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SupportForm() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("https://formspree.io/f/mgolzwzg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      if (!res.ok) throw new Error("Failed to send");
      setStatus("sent");
      setSubject("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <p className="text-sm text-green-600">
        Message sent! We&apos;ll get back to you soon.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        required
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <textarea
        placeholder="How can we help?"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
        rows={3}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={status === "sending"}>
          {status === "sending" ? "Sending..." : "Send"}
        </Button>
        {status === "error" && (
          <span className="text-sm text-red-500">Failed to send. Please try again.</span>
        )}
      </div>
    </form>
  );
}
