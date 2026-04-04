"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { smoothScrollTo } from "@/lib/smooth-scroll";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
          <span className="text-foreground">Insta</span><span className="text-ember">Claw</span><span className="text-foreground">.bot</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <button
            onClick={() => smoothScrollTo("#how-it-works")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            How It Works
          </button>
          <button
            onClick={() => smoothScrollTo("#examples")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Examples
          </button>
          <button
            onClick={() => smoothScrollTo("#pricing")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Pricing
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign In
          </Link>
          <Button
            onClick={() => smoothScrollTo("#pricing")}
            className="bg-ember hover:bg-ember/90 text-white font-semibold"
          >
            Get Your AI Teammate
          </Button>
        </div>
      </div>
    </nav>
  );
}
