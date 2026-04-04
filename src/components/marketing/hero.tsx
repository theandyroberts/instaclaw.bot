"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";
import { smoothScrollTo } from "@/lib/smooth-scroll";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 py-28 md:py-40">
      {/* Subtle gradient glow */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, rgba(191,245,73,0.04) 0%, rgba(235,66,3,0.06) 50%, rgba(191,245,73,0.03) 100%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-8 lg:gap-16">
          {/* Left — Copy */}
          <div>
            <div className="mb-6 inline-flex items-center rounded-full border border-border bg-card px-4 py-1.5 text-sm text-foreground shadow-sm">
              <Zap className="mr-2 h-4 w-4 text-ember" />
              Powered by OpenClaw — the #1 open-source AI assistant
            </div>

            <h1
              className="mb-8 text-5xl font-bold leading-[1.08] tracking-tight text-foreground md:text-6xl lg:text-7xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Meet your<br />
              <span className="text-lime">AI teammate.</span>
            </h1>

            <p className="mb-5 max-w-lg text-xl text-muted-foreground md:text-2xl leading-relaxed">
              InstaClaw gives you a fast, secure way to run OpenClaw on a dedicated server — so it can research, monitor, and complete work for you automatically.
            </p>
            <p className="mb-12 max-w-lg text-lg text-muted-foreground leading-relaxed">
              Tell your OpenClaw teammate what to do and it keeps working in the background — gathering information, watching for changes, and publishing results.
            </p>

            <Button
              size="lg"
              className="bg-ember hover:bg-ember/90 text-white text-lg px-10 py-7 font-semibold rounded-xl shadow-lg shadow-ember/20"
              onClick={() => smoothScrollTo("#pricing")}
            >
              Get Your AI Teammate
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <p className="mt-5 text-sm text-muted-foreground">
              Your teammate starts working in minutes.
            </p>
          </div>

          {/* Right — Animated Illustration */}
          <div className="relative flex items-center justify-center">
            <div className="relative h-80 w-80 lg:h-[420px] lg:w-[420px]">

              {/* Pulsing teal glow behind mascot */}
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-52 w-52 rounded-full bg-lime/15 blur-3xl"
                style={{ animation: "glow-pulse 6s ease-in-out infinite" }}
              />

              {/* Central mascot — gentle float */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div style={{ animation: "mascot-float 5s ease-in-out infinite" }}>
                  <Image
                    src="/images/OpenClawMascot.png"
                    alt="OpenClaw mascot"
                    width={164}
                    height={120}
                    className="drop-shadow-lg"
                    priority
                  />
                </div>
              </div>

              {/* OpenClaw logo — top left */}
              <div
                className="absolute left-2 top-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-card shadow-md"
                style={{ animation: "float-a 4.2s ease-in-out infinite" }}
              >
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8.5 2 5 4.5 5 9c0 2 .8 3.5 2 4.5L5.5 18c-.3.8.1 1.5.8 1.8l1.5.6c.7.3 1.5-.1 1.8-.8l1-3c.4.1.9.1 1.4.1s1-.1 1.4-.1l1 3c.3.7 1.1 1.1 1.8.8l1.5-.6c.7-.3 1.1-1 .8-1.8L16 13.5c1.2-1 2-2.5 2-4.5 0-4.5-3.5-7-6-7Z" fill="#BFF549" />
                  <circle cx="9.5" cy="8.5" r="1.5" fill="white" />
                  <circle cx="14.5" cy="8.5" r="1.5" fill="white" />
                </svg>
              </div>

              {/* OpenAI logo — top right */}
              <div
                className="absolute right-2 top-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-card shadow-md"
                style={{ animation: "float-b 5.1s ease-in-out infinite" }}
              >
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073ZM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494ZM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646ZM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872v.024Zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667Zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66v.018ZM8.318 12.898l-2.024-1.166a.07.07 0 0 1-.038-.052V6.098a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.49a.795.795 0 0 0-.392.68l-.003 6.728h.009Zm1.1-2.365 2.602-1.5 2.601 1.5v3.001l-2.6 1.5-2.603-1.5v-3Z" fill="#10a37f" />
                </svg>
              </div>

              {/* Claude logo — bottom left */}
              <div
                className="absolute bottom-16 left-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-card shadow-md"
                style={{ animation: "float-c 4.7s ease-in-out infinite" }}
              >
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4.709 15.955l4.397-10.985c.245-.612.367-.918.53-1.017a.5.5 0 0 1 .478-.033c.17.084.311.38.593.97l4.905 10.263c.157.328.236.492.21.629a.5.5 0 0 1-.199.325c-.113.082-.293.102-.654.142l-9.796 1.093c-.386.043-.579.064-.709-.006a.5.5 0 0 1-.252-.35c-.03-.144.055-.33.225-.7l.272-.33Z" fill="#D97757" />
                  <path d="M14.533 17.079l4.06-1.448c.415-.148.622-.222.727-.352a.5.5 0 0 0 .087-.432c-.038-.158-.21-.302-.555-.59L11.77 8.562c-.318-.266-.477-.399-.614-.406a.5.5 0 0 0-.382.145c-.1.104-.148.3-.245.692l-2.205 8.93c-.104.42-.155.63-.098.78a.5.5 0 0 0 .312.295c.148.054.361.017.787-.057l5.208-.862Z" fill="#D97757" />
                </svg>
              </div>

              {/* Report ready pill — bottom right */}
              <div
                className="absolute bottom-20 right-6 flex h-14 w-32 items-center justify-center rounded-xl bg-card shadow-md border border-border"
                style={{ animation: "float-d 3.9s ease-in-out infinite" }}
              >
                <span className="text-sm text-muted-foreground font-medium">Report ready</span>
              </div>

              {/* Browser mockup — right side */}
              <div
                className="absolute -right-4 top-28 w-36 rounded-lg bg-card shadow-lg border border-border overflow-hidden"
                style={{ animation: "float-b 6s ease-in-out infinite 1.5s" }}
              >
                <div className="flex items-center gap-1 px-2 py-1.5 bg-secondary border-b border-border">
                  <div className="h-1.5 w-1.5 rounded-full bg-ember/50" />
                  <div className="h-1.5 w-1.5 rounded-full bg-peach/50" />
                  <div className="h-1.5 w-1.5 rounded-full bg-lime/50" />
                </div>
                <div className="px-2 py-2 space-y-1.5">
                  <div className="h-1.5 w-full rounded bg-lime/15" />
                  <div className="h-1.5 w-3/4 rounded bg-card" />
                  <div className="h-1.5 w-5/6 rounded bg-lime/10" />
                </div>
              </div>

              {/* Animated connection lines — dashes flow continuously */}
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 420 420"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M80 70 L175 180"
                  stroke="#BFF549"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.35"
                  style={{ animation: "dash-flow 2s linear infinite" }}
                />
                <path
                  d="M340 80 L245 180"
                  stroke="#BFF549"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.35"
                  style={{ animation: "dash-flow 2.4s linear infinite reverse" }}
                />
                <path
                  d="M90 320 L175 240"
                  stroke="#BFF549"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.35"
                  style={{ animation: "dash-flow 1.8s linear infinite 0.5s" }}
                />
                <path
                  d="M320 300 L245 240"
                  stroke="#BFF549"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.35"
                  style={{ animation: "dash-flow 2.2s linear infinite reverse 0.3s" }}
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
